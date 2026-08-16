import { CliArgumentError, helpText, parseCliArguments } from "./argv.js";
import { resolveInitialBinding } from "./binding/root-binding.js";
import { PRODUCT_VERSION } from "./constants.js";
import { writeDiagnostic } from "./logging/stderr.js";
import { runStdioServer } from "./mcp/server.js";
import {
  InstallationLifecycleError,
  doctorInstallationV1,
  installInstallationV1,
  uninstallInstallationV1,
} from "@understand-code/installation-lifecycle";

function installationInput(
  invocation: Extract<Awaited<ReturnType<typeof parseCliArguments>>, { kind: "installation" }>,
): { readonly root?: string; readonly home?: string } {
  return {
    ...(invocation.root === undefined ? {} : { root: invocation.root }),
    ...(invocation.home === undefined ? {} : { home: invocation.home }),
  };
}

async function runInstallation(
  invocation: Extract<Awaited<ReturnType<typeof parseCliArguments>>, { kind: "installation" }>,
): Promise<void> {
  const input = installationInput(invocation);
  try {
    if (invocation.operation === "install") {
      const result = await installInstallationV1({
        ...input,
        version: PRODUCT_VERSION,
      });
      process.stdout.write(`${JSON.stringify({ ok: result.status !== "refused", ...result })}\n`);
      if (result.status === "refused") process.exitCode = 1;
      return;
    }
    if (invocation.operation === "doctor") {
      const result = await doctorInstallationV1(input);
      process.stdout.write(`${JSON.stringify(result)}\n`);
      if (!result.ok) process.exitCode = 1;
      return;
    }
    const result = await uninstallInstallationV1(input);
    process.stdout.write(
      `${JSON.stringify({ ok: result.status === "removed" || result.status === "not_installed", ...result })}\n`,
    );
    if (result.status === "refused" || result.status === "partial") process.exitCode = 1;
  } catch (error) {
    if (error instanceof InstallationLifecycleError) {
      process.stdout.write(
        `${JSON.stringify({ ok: false, error: { code: error.code, message: error.message } })}\n`,
      );
      process.exitCode = 2;
      return;
    }
    throw error;
  }
}

async function main(): Promise<void> {
  let invocation;
  try {
    invocation = parseCliArguments(process.argv.slice(2));
  } catch (error) {
    if (error instanceof CliArgumentError) {
      writeDiagnostic("configuration_error");
      process.exitCode = 2;
      return;
    }
    throw error;
  }

  if (invocation.kind === "help") {
    process.stdout.write(helpText());
    return;
  }
  if (invocation.kind === "version") {
    process.stdout.write(`${PRODUCT_VERSION}\n`);
    return;
  }
  if (invocation.kind === "installation") {
    await runInstallation(invocation);
    return;
  }

  const initialBinding = await resolveInitialBinding(invocation.rootCandidates);
  await runStdioServer({ initialBinding });
}

try {
  await main();
} catch {
  writeDiagnostic("internal_error");
  process.exitCode = 1;
}
