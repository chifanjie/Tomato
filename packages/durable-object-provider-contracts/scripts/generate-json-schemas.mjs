import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { generateProviderContractJsonSchemasV1 } from "../dist/json-schema.js";

const scriptPath = fileURLToPath(import.meta.url);
const packageRoot = resolve(dirname(scriptPath), "..");
const schemaRoot = join(packageRoot, "schemas", "v1");
const checkOnly = process.argv.includes("--check");
const printOnly = process.argv.includes("--stdout");

function serialize(schema) {
  return `${JSON.stringify(schema, null, 2)}\n`;
}

const generated = generateProviderContractJsonSchemasV1();
if (printOnly) {
  process.stdout.write(`${JSON.stringify(generated, null, 2)}\n`);
  process.exit(0);
}

const expectedNames = new Set(
  Object.keys(generated).map((name) => `${name}.schema.json`),
);
const mismatches = [];

if (checkOnly) {
  let existingNames = [];
  try {
    existingNames = (await readdir(schemaRoot)).filter((name) =>
      name.endsWith(".schema.json"),
    );
  } catch {
    mismatches.push("schema directory is missing");
  }
  for (const existingName of existingNames) {
    if (!expectedNames.has(existingName)) {
      mismatches.push(`unexpected generated schema: ${existingName}`);
    }
  }
} else {
  await mkdir(schemaRoot, { recursive: true });
}

for (const [name, schema] of Object.entries(generated)) {
  const fileName = `${name}.schema.json`;
  const filePath = join(schemaRoot, fileName);
  const serialized = serialize(schema);
  if (checkOnly) {
    let current;
    try {
      current = await readFile(filePath, "utf8");
    } catch {
      mismatches.push(`missing generated schema: ${fileName}`);
      continue;
    }
    if (current !== serialized) mismatches.push(`stale generated schema: ${fileName}`);
  } else {
    await writeFile(filePath, serialized, "utf8");
  }
}

if (mismatches.length !== 0) {
  for (const mismatch of mismatches) process.stderr.write(`${mismatch}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    checkOnly
      ? `Verified ${expectedNames.size} generated provider JSON Schemas.\n`
      : `Generated ${expectedNames.size} provider JSON Schemas.\n`,
  );
}
