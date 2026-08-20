import { resolveInitialBinding } from "./binding/root-binding.js";
import { PRODUCT_VERSION } from "./constants.js";
import { writeDiagnostic } from "./logging/stderr.js";
import { runStdioServer } from "./mcp/server.js";
import {
  parsePreviewCliArgumentsV1,
  PreviewCliArgumentErrorV1,
  previewHelpTextV1,
} from "./preview-argv.js";

async function main(): Promise<void> {
  let invocation;
  try {
    invocation = parsePreviewCliArgumentsV1(process.argv.slice(2));
  } catch (error) {
    if (error instanceof PreviewCliArgumentErrorV1) {
      writeDiagnostic("configuration_error");
      process.exitCode = 2;
      return;
    }
    throw error;
  }

  if (invocation.kind === "help") {
    process.stdout.write(previewHelpTextV1());
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
