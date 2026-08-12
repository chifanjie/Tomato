import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import * as publicApi from "../src/index.js";

const sourceRoot = fileURLToPath(new URL("../src", import.meta.url));
const packageManifest = JSON.parse(
  readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"),
) as { exports: Record<string, unknown> };

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolutePath);
    return entry.isFile() && entry.name.endsWith(".ts") ? [absolutePath] : [];
  });
}

describe("provider contract runtime boundary", () => {
  it("has no Node, filesystem, process, Buffer, or host crypto dependencies", () => {
    const forbiddenImport =
      /(?:from\s*|import\s*(?:\(\s*)?|require\s*\(\s*)["'](?:node:|fs(?:\/|["'])|path(?:\/|["'])|crypto(?:\/|["'])|child_process(?:\/|["']))/u;
    const forbiddenHostGlobal =
      /(?:^|[^\w$])(?:process|Buffer)(?:\s*[.([]|\s*$)/mu;
    for (const filePath of sourceFiles(sourceRoot)) {
      const source = readFileSync(filePath, "utf8");
      expect(source, filePath).not.toMatch(forbiddenImport);
      expect(source, filePath).not.toMatch(forbiddenHostGlobal);
    }
  });

  it("does not expose arbitrary domain or prefix derivation helpers", () => {
    expect(publicApi).not.toHaveProperty("createDomainPreimageBytesV1");
    expect(publicApi).not.toHaveProperty("deriveSemanticHashV1");
    expect(publicApi).not.toHaveProperty("deriveKeyedStateTokenForDomainV1");
    expect(publicApi).not.toHaveProperty(
      "deriveProviderStrongReadyActiveWriterSelectionsInternalV1",
    );
    expect(publicApi).not.toHaveProperty(
      "classifyProviderStrongReadyActiveWriterMatchCountInternalV1",
    );
    expect(packageManifest.exports).not.toHaveProperty("./domain-crypto");
    expect(packageManifest.exports).not.toHaveProperty("./provider-foundation");
    expect(packageManifest.exports).not.toHaveProperty(
      "./provider-strong-ready-acceptance-candidate-internal",
    );
  });

  it("uses strict object schemas rather than silent unknown-field stripping", () => {
    for (const filePath of sourceFiles(sourceRoot)) {
      const source = readFileSync(filePath, "utf8");
      expect(source, filePath).not.toMatch(/\bz\.object\s*\(/u);
      expect(source, filePath).not.toMatch(/\.passthrough\s*\(/u);
    }
  });
});
