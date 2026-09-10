import { afterEach, expect, it, vi } from "vitest";
const probes = vi.hoisted(() => ({ provider: 0 }));
vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return { ...actual, lstat: async (...args: Parameters<typeof actual.lstat>) => {
    if (String(args[0]) === "/opt/understand-code/bin/git") {
      probes.provider++;
      throw Object.assign(new Error("installed Provider executable is inaccessible"), { code: "EACCES" });
    }
    return actual.lstat(...args);
  } };
});
import { captureBoundRepositorySnapshot, captureLocalRepositorySnapshot } from "../src/runtime/context.js";
import { cleanupTemporaryDirectories, createGitRepository } from "./helpers.js";
afterEach(cleanupTemporaryDirectories);
it("keeps an invalid installed Linux Provider gate separate from explicit local capture", async () => {
  const root = await createGitRepository({ seedArtifacts: false });
  const platform = Object.getOwnPropertyDescriptor(process, "platform")!;
  try {
    Object.defineProperty(process, "platform", { ...platform, value: "linux" });
    await expect(captureBoundRepositorySnapshot(root)).rejects.toMatchObject({ code: "EACCES" });
    expect(probes.provider).toBe(1);
    const local = await captureLocalRepositorySnapshot(root);
    expect(local.canonicalRoot).toBe(root);
    expect(local.snapshot.captureStatus).toBe("complete");
    expect(probes.provider).toBe(1);
  } finally { Object.defineProperty(process, "platform", platform); }
});
