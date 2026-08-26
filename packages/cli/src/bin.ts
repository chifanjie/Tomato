import { CliArgumentError, helpText, parseCliArguments } from "./argv.js";
import { resolveInitialBinding } from "./binding/root-binding.js";
import { PRODUCT_VERSION } from "./constants.js";
import { writeDiagnostic } from "./logging/stderr.js";
import { runStdioServer } from "./mcp/server.js";
import { runReleaseDoctorV1 } from "./release-doctor.js";
import { runHostRegistrationDoctorV1 } from "./host-registration-doctor.js";
import { runProviderDoctorV1 } from "./provider/provider-doctor.js";
import { runProviderRuntimeChildV1 } from "./provider/runtime-child.js";
import {
  doctorProviderServiceV1,
  installProviderServiceV1,
  ProviderServiceInstallerErrorV1,
  rollbackProviderServiceV1,
  uninstallProviderServiceV1,
  upgradeProviderServiceV1,
} from "./provider/provider-service-installer.js";
import { runDurableObjectProviderRuntimeCliV1 } from "@understand-code/durable-object-provider-runtime/cli";
import {
  ProviderServiceHandoffErrorV1,
  ProviderServiceInstallationLifecycleErrorV1,
} from "@understand-code/durable-object-provider-runtime";
import {
  InstallationLifecycleError,
  doctorInstallationV1,
  installInstallationV1,
  rollbackInstallationV1,
  uninstallInstallationV1,
  upgradeInstallationV1,
} from "@understand-code/installation-lifecycle";

function installationInput(
  invocation: Extract<Awaited<ReturnType<typeof parseCliArguments>>, { kind: "installation" }>,
): { readonly root?: string; readonly home?: string; readonly host?: "codex" | "claude" } {
  return {
    ...(invocation.root === undefined ? {} : { root: invocation.root }),
    ...(invocation.home === undefined ? {} : { home: invocation.home }),
    ...(invocation.host === undefined ? {} : { host: invocation.host }),
  };
}

async function runInstallation(
  invocation: Extract<Awaited<ReturnType<typeof parseCliArguments>>, { kind: "installation" }>,
): Promise<void> {
  if (
    invocation.operation === "doctor" &&
    invocation.root === undefined &&
    invocation.home === undefined &&
    invocation.host === undefined &&
    invocation.provider !== true &&
    invocation.providerService !== true
  ) {
    const result = await runReleaseDoctorV1();
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (!result.ok) process.exitCode = 1;
    return;
  }
  if (invocation.operation === "doctor" && invocation.host !== undefined) {
    const result = await runHostRegistrationDoctorV1({
      host: invocation.host,
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (!result.ok) process.exitCode = 1;
    return;
  }
  const input = installationInput(invocation);
  try {
    if (invocation.operation === "doctor" && invocation.provider === true) {
      if (invocation.root === undefined) throw new CliArgumentError();
      const result = await runProviderDoctorV1({
        targetRoot: invocation.root,
        ...(invocation.serviceConfig === undefined
          ? {}
          : { serviceConfigPath: invocation.serviceConfig }),
        ...(invocation.serviceReadiness === undefined
          ? {}
          : { serviceReadinessPath: invocation.serviceReadiness }),
      });
      process.stdout.write(`${JSON.stringify(result)}\n`);
      if (!result.ok) process.exitCode = 1;
      return;
    }
    if (invocation.providerService === true) {
      if (
        invocation.root === undefined ||
        invocation.serviceManifest === undefined
      ) {
        throw new CliArgumentError();
      }
      const target = {
        root: invocation.root,
        serviceManifest: invocation.serviceManifest,
      };
      if (invocation.operation === "install") {
        if (
          invocation.serviceConfig === undefined ||
          invocation.serviceKey === undefined
        ) {
          throw new CliArgumentError();
        }
        const result = await installProviderServiceV1({
          ...target,
          serviceConfig: invocation.serviceConfig,
          serviceKey: invocation.serviceKey,
          ...(invocation.serviceDescriptor === undefined
            ? {}
            : { serviceDescriptor: invocation.serviceDescriptor }),
        });
        process.stdout.write(`${JSON.stringify(result)}\n`);
        if (!result.ok) process.exitCode = 1;
        return;
      }
      if (invocation.operation === "upgrade") {
        if (invocation.serviceConfig === undefined) throw new CliArgumentError();
        const result = await upgradeProviderServiceV1({
          ...target,
          serviceConfig: invocation.serviceConfig,
        });
        process.stdout.write(`${JSON.stringify(result)}\n`);
        if (!result.ok) process.exitCode = 1;
        return;
      }
      if (invocation.operation === "doctor") {
        const result = await doctorProviderServiceV1(target);
        process.stdout.write(`${JSON.stringify(result)}\n`);
        if (!result.ok) process.exitCode = 1;
        return;
      }
      if (invocation.operation === "rollback") {
        const result = await rollbackProviderServiceV1(target);
        process.stdout.write(`${JSON.stringify(result)}\n`);
        if (!result.ok) process.exitCode = 1;
        return;
      }
      const result = await uninstallProviderServiceV1(target);
      process.stdout.write(`${JSON.stringify(result)}\n`);
      if (!result.ok) process.exitCode = 1;
      return;
    }
    if (invocation.operation === "install") {
      const result = await installInstallationV1({
        ...input,
        version: PRODUCT_VERSION,
      });
      process.stdout.write(`${JSON.stringify({ ok: result.status !== "refused", ...result })}\n`);
      if (result.status === "refused") process.exitCode = 1;
      return;
    }
    if (invocation.operation === "upgrade") {
      const result = await upgradeInstallationV1({
        ...input,
        version: PRODUCT_VERSION,
      });
      process.stdout.write(
        `${JSON.stringify({ ok: result.status === "updated" || result.status === "already_current", ...result })}\n`,
      );
      if (result.status === "refused" || result.status === "not_installed") {
        process.exitCode = 1;
      }
      return;
    }
    if (invocation.operation === "rollback") {
      const result = await rollbackInstallationV1(input);
      process.stdout.write(
        `${JSON.stringify({ ok: result.status === "rolled_back" || result.status === "not_available", ...result })}\n`,
      );
      if (result.status === "refused" || result.status === "partial" || result.status === "not_installed") {
        process.exitCode = 1;
      }
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
    if (
      error instanceof ProviderServiceInstallerErrorV1 ||
      error instanceof ProviderServiceHandoffErrorV1 ||
      error instanceof ProviderServiceInstallationLifecycleErrorV1
    ) {
      process.stdout.write(
        `${JSON.stringify({
          ok: false,
          error: {
            code: error.code,
            message: "Provider service lifecycle request was rejected.",
          },
        })}\n`,
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
  if (invocation.kind === "provider_service_runtime") {
    await runDurableObjectProviderRuntimeCliV1([
      "--service-config",
      invocation.serviceConfig,
    ]);
    return;
  }
  if (invocation.kind === "provider_runtime") {
    await runProviderRuntimeChildV1(invocation);
    return;
  }
  if (invocation.kind === "installation") {
    await runInstallation(invocation);
    return;
  }

  const initialBinding = await resolveInitialBinding(invocation.rootCandidates);
  await runStdioServer({
    initialBinding,
    ...(invocation.canonicalInstallationRoot === undefined
      ? {}
      : {
          canonicalInstallationRoot:
            invocation.canonicalInstallationRoot,
        }),
  });
}

try {
  await main();
} catch {
  writeDiagnostic("internal_error");
  process.exitCode = 1;
}
