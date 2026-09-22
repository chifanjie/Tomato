import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import * as publicApi from "../src/index.js";

describe("public Artifact Store boundary", () => {
  it("exposes high-level persistence without raw write or lock primitives", () => {
    const exported = publicApi as Record<string, unknown>;
    expect(exported.ArtifactStore).toBeTypeOf("function");
    expect(exported.adaptWikiV2EvidenceAndClaims).toBeTypeOf("function");
    expect(exported.withIndexJobStateLock).toBeTypeOf("function");
    for (const internalName of [
      "atomicWriteFile",
      "atomicWriteJson",
      "acquireStoreLock",
      "withStoreLock",
      "ensureManagedDirectory",
      "resolveManagedPath",
    ]) {
      expect(exported).not.toHaveProperty(internalName);
    }
  });

  it("does not publish raw atomic or lock subpath exports", async () => {
    const packageJson = JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf8"),
    ) as { exports?: Record<string, unknown> };
    expect(packageJson.exports).not.toHaveProperty("./atomic");
    expect(packageJson.exports).not.toHaveProperty("./lock");
  });
});
