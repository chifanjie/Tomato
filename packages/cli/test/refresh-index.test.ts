import { access, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const sideEffects = vi.hoisted(() => ({
  buildRepositoryIndex: vi.fn(),
  captureBoundRepositorySnapshot: vi.fn(),
  openStore: vi.fn(),
}));

vi.mock("@understand-code/artifact-store", () => ({
  ArtifactStore: { open: sideEffects.openStore },
  ArtifactStoreError: class ArtifactStoreError extends Error {},
  sha256CanonicalJson: vi.fn(),
}));

vi.mock("../src/runtime/context.js", () => ({
  captureBoundRepositorySnapshot: sideEffects.captureBoundRepositorySnapshot,
  fingerprintPublishedSnapshot: vi.fn(),
}));

vi.mock("../src/runtime/repository-indexer.js", () => ({
  RepositoryIndexError: class RepositoryIndexError extends Error {},
  buildRepositoryIndex: sideEffects.buildRepositoryIndex,
}));

import { ToolFailure } from "../src/errors/tool-errors.js";
import { refreshIndex } from "../src/handlers/refresh-index.js";

afterEach(() => {
  vi.clearAllMocks();
});

describe("refreshIndex strong-write capability lock", () => {
  it("fails closed before capture, index build, Store access, or repository writes", async () => {
    const root = await mkdtemp(
      path.join(tmpdir(), "understand-code-refresh-lock-"),
    );
    const entriesBefore = await readdir(root);

    try {
      let failure: unknown;
      try {
        await refreshIndex(
          {
            mode: "full",
            idempotencyKey: "refresh-lock-test",
            actor: "agent:cli-test",
          },
          root,
        );
      } catch (error) {
        failure = error;
      }

      expect(failure).toBeInstanceOf(ToolFailure);
      expect((failure as ToolFailure).result).toEqual({
        isError: true,
        content: [
          {
            type: "text",
            text: "The strong Store is unavailable. Run Doctor for details.",
          },
        ],
        structuredContent: {
          error: {
            schemaVersion: 1,
            code: "provider_unavailable",
            details: { reason: "unavailable" },
          },
        },
      });
      expect(sideEffects.captureBoundRepositorySnapshot).not.toHaveBeenCalled();
      expect(sideEffects.buildRepositoryIndex).not.toHaveBeenCalled();
      expect(sideEffects.openStore).not.toHaveBeenCalled();
      expect(await readdir(root)).toEqual(entriesBefore);
      await expect(
        access(path.join(root, ".understand-code")),
      ).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
});
