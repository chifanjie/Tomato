import { CliArgumentError, helpText, parseCliArguments } from "./argv.js";
import { resolveInitialBinding } from "./binding/root-binding.js";
import { PRODUCT_VERSION } from "./constants.js";
import { writeDiagnostic } from "./logging/stderr.js";
import { runStdioServer } from "./mcp/server.js";

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

  const initialBinding = await resolveInitialBinding(invocation.rootCandidates);
  await runStdioServer({ initialBinding });
}

try {
  await main();
} catch {
  writeDiagnostic("internal_error");
  process.exitCode = 1;
}
