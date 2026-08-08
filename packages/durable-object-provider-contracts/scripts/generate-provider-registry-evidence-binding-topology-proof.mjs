import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  TOPOLOGY_PROOF_RESOURCE_PATH_V1,
  assertGeneratedSchemaInventoryFreshV1,
  generateProviderRegistryEvidenceBindingTopologyProofV1,
  precomputeProviderRegistryEvidenceBindingParserRuntimeTraceTokenV1,
  serializeTopologyProofV1,
} from "./lib/provider-registry-evidence-binding-topology-proof.mjs";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const resourcePath = join(
  packageRoot,
  ...TOPOLOGY_PROOF_RESOURCE_PATH_V1.split("/"),
);
const sourcePath = join(
  packageRoot,
  "src/provider-registry-evidence-binding-topology-proof.ts",
);
const checkOnly = process.argv.includes("--check");
const printOnly = process.argv.includes("--stdout");

function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function extractSourceAnchor(source, name, pattern) {
  const match = source.match(
    new RegExp(`export const ${name} =\\s*${pattern}\\s+as const;`, "u"),
  );
  if (match === null) {
    throw new Error(`topology proof source anchor ${name} is missing`);
  }
  return match[1];
}

async function generateSchemasFromFreshSourceEmit() {
  const temporaryOutDir = await mkdtemp(
    join(packageRoot, ".topology-proof-source-emit-"),
  );
  try {
    execFileSync(
      process.execPath,
      [
        join(packageRoot, "node_modules/typescript/bin/tsc"),
        "-p",
        join(packageRoot, "tsconfig.json"),
        "--outDir",
        temporaryOutDir,
        "--declaration",
        "false",
        "--declarationMap",
        "false",
        "--sourceMap",
        "false",
        "--incremental",
        "false",
      ],
      { cwd: packageRoot, stdio: "pipe" },
    );
    const freshModule = await import(
      `${pathToFileURL(join(temporaryOutDir, "json-schema.js")).href}?topology-proof-fresh=${Date.now()}`
    );
    return {
      generatedSchemas: freshModule.generateProviderContractJsonSchemasV1(),
      runtimeModuleRoot: temporaryOutDir,
    };
  } catch (error) {
    await rm(temporaryOutDir, { recursive: true, force: true });
    throw error;
  }
}

const precomputedParserRuntimeTraceToken =
  await precomputeProviderRegistryEvidenceBindingParserRuntimeTraceTokenV1({
    packageRoot,
  });
const distModule = await import(
  `${pathToFileURL(join(packageRoot, "dist/json-schema.js")).href}?topology-proof-dist=${Date.now()}`
);
const distGeneratedSchemas =
  distModule.generateProviderContractJsonSchemasV1();
let generatedSchemas = distGeneratedSchemas;
let freshRuntimeModuleRoot;
let proof;
try {
  if (checkOnly) {
    const freshSourceEmit = await generateSchemasFromFreshSourceEmit();
    const sourceGeneratedSchemas = freshSourceEmit.generatedSchemas;
    freshRuntimeModuleRoot = freshSourceEmit.runtimeModuleRoot;
    assertGeneratedSchemaInventoryFreshV1(
      sourceGeneratedSchemas,
      distGeneratedSchemas,
    );
    generatedSchemas = sourceGeneratedSchemas;
  }
  proof = await generateProviderRegistryEvidenceBindingTopologyProofV1({
    packageRoot,
    generatedSchemas,
    runtimeModuleRoot: freshRuntimeModuleRoot,
    precomputedParserRuntimeTraceToken,
  });
} finally {
  if (freshRuntimeModuleRoot !== undefined) {
    await rm(freshRuntimeModuleRoot, { recursive: true, force: true });
  }
}
const bytes = Buffer.from(serializeTopologyProofV1(proof), "utf8");
if (printOnly) {
  await new Promise((resolveWrite, rejectWrite) => {
    process.stdout.write(bytes, (error) =>
      error === null || error === undefined
        ? resolveWrite()
        : rejectWrite(error),
    );
  });
  process.exit(0);
}

if (!checkOnly) {
  await mkdir(dirname(resourcePath), { recursive: true });
  await writeFile(resourcePath, bytes);
  process.stdout.write(
    [
      `Generated ${TOPOLOGY_PROOF_RESOURCE_PATH_V1}.`,
      `byteLength=${bytes.byteLength}`,
      `rawSha256=${sha256Hex(bytes)}`,
      `aggregateSemanticDigest=${proof.aggregateSemanticDigest}`,
      `status=${proof.status}`,
    ].join("\n") + "\n",
  );
  process.exit(0);
}

const mismatches = [];
let existingBytes;
try {
  existingBytes = await readFile(resourcePath);
} catch {
  mismatches.push(`missing topology proof resource: ${TOPOLOGY_PROOF_RESOURCE_PATH_V1}`);
}
if (existingBytes !== undefined && !existingBytes.equals(bytes)) {
  mismatches.push(`stale topology proof resource: ${TOPOLOGY_PROOF_RESOURCE_PATH_V1}`);
}

let source;
try {
  source = await readFile(sourcePath, "utf8");
} catch {
  mismatches.push("missing topology proof TypeScript source");
}
if (source !== undefined) {
  const anchoredLength = Number(
    extractSourceAnchor(
      source,
      "PROVIDER_REGISTRY_EVIDENCE_BINDING_TOPOLOGY_PROOF_RESOURCE_BYTE_LENGTH_V1",
      "([0-9_]+)",
    ).replaceAll("_", ""),
  );
  const anchoredRawSha256 = extractSourceAnchor(
    source,
    "PROVIDER_REGISTRY_EVIDENCE_BINDING_TOPOLOGY_PROOF_RESOURCE_SHA256_HEX_V1",
    '"([0-9a-f]{64})"',
  );
  const anchoredSemanticDigest = extractSourceAnchor(
    source,
    "PROVIDER_REGISTRY_EVIDENCE_BINDING_TOPOLOGY_PROOF_AGGREGATE_SEMANTIC_DIGEST_V1",
    '"(sha256:[0-9a-f]{64})"',
  );
  if (anchoredLength !== bytes.byteLength) {
    mismatches.push("topology proof byte-length source anchor drifted");
  }
  if (anchoredRawSha256 !== sha256Hex(bytes)) {
    mismatches.push("topology proof raw SHA-256 source anchor drifted");
  }
  if (anchoredSemanticDigest !== proof.aggregateSemanticDigest) {
    mismatches.push("topology proof semantic source anchor drifted");
  }
}

if (
  proof.status !== "accepted_after_contract_reopen" ||
  proof.contractReopenRequired ||
  !proof.priorContractReopenRequired ||
  proof.capAssessment.priorFailures.length === 0 ||
  proof.capAssessment.adoptedFailures.length !== 0 ||
  !proof.capAssessment.adoptedAssessment.withinSoundUpper
) {
  mismatches.push(
    "the prior D-37 failure evidence or adopted-cap acceptance evidence drifted",
  );
}

if (mismatches.length !== 0) {
  for (const mismatch of mismatches) process.stderr.write(`${mismatch}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Verified accepted-after-contract-reopen topology proof ${TOPOLOGY_PROOF_RESOURCE_PATH_V1}.\n`,
  );
}
