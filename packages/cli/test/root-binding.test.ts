import { mkdir, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  RootBindingSession,
  resolveInitialBinding,
} from "../src/binding/root-binding.js";
import {
  cleanupTemporaryDirectories,
  createGitRepository,
  createTemporaryDirectory,
} from "./helpers.js";

afterEach(cleanupTemporaryDirectories);

describe("explicit root binding", () => {
  it("binds only an exact Git worktree root", async () => {
    const root = await createGitRepository({ seedArtifacts: false });
    await mkdir(path.join(root, "nested"));

    await expect(resolveInitialBinding([root])).resolves.toEqual({
      kind: "bound",
      canonicalRoot: root,
    });
    await expect(
      resolveInitialBinding([path.join(root, "nested")]),
    ).resolves.toEqual({
      kind: "binding_error",
      reason: "root_unavailable",
    });
  });

  it("canonicalizes a symlink without changing the worktree authority", async () => {
    const root = await createGitRepository({ seedArtifacts: false });
    const parent = await createTemporaryDirectory("understand-code-link-");
    const link = path.join(parent, "repository-link");
    await symlink(root, link, "dir");

    await expect(resolveInitialBinding([link])).resolves.toEqual({
      kind: "bound",
      canonicalRoot: root,
    });
  });

  it("maps missing, file, relative, and repeated roots without cwd fallback", async () => {
    const root = await createGitRepository({ seedArtifacts: false });
    const file = path.join(root, "root.txt");
    await writeFile(file, "not a directory", "utf8");

    await expect(resolveInitialBinding([])).resolves.toEqual({
      kind: "binding_error",
      reason: "root_missing",
    });
    await expect(resolveInitialBinding([file])).resolves.toEqual({
      kind: "binding_error",
      reason: "root_not_directory",
    });
    await expect(resolveInitialBinding(["relative/repository"])).resolves.toEqual({
      kind: "binding_error",
      reason: "root_unavailable",
    });
    await expect(resolveInitialBinding([root, root])).resolves.toEqual({
      kind: "binding_error",
      reason: "root_conflict",
    });
    await expect(resolveInitialBinding([root, path.dirname(root)])).resolves.toEqual({
      kind: "binding_error",
      reason: "root_conflict",
    });
  });
});

describe("advertised Roots membership", () => {
  it("allows an ancestor without expanding the frozen canonical authority", async () => {
    const root = await createGitRepository({ seedArtifacts: false });
    const session = new RootBindingSession({ kind: "bound", canonicalRoot: root });
    session.configureClientRoots(true);

    expect(session.requireCanonicalRoot()).toEqual({
      kind: "binding_error",
      reason: "root_unavailable",
    });
    expect(session.errorReason).toBeUndefined();
    await session.applyRootsResult({
      roots: [{ uri: pathToFileURL(path.dirname(root)).href }],
    });
    expect(session.requireCanonicalRoot()).toEqual({
      kind: "bound",
      canonicalRoot: root,
    });
  });

  it("blocks immediately during refresh and permanently locks on a subdirectory", async () => {
    const root = await createGitRepository({ seedArtifacts: false });
    const subdirectory = path.join(root, "src");
    const session = new RootBindingSession({ kind: "bound", canonicalRoot: root });
    session.configureClientRoots(true);
    await session.applyRootsResult({
      roots: [{ uri: pathToFileURL(root).href }],
    });
    session.beginRootsValidation();

    expect(session.requireCanonicalRoot()).toEqual({
      kind: "binding_error",
      reason: "root_unavailable",
    });
    expect(session.errorReason).toBeUndefined();
    await session.applyRootsResult({
      roots: [{ uri: pathToFileURL(subdirectory).href }],
    });
    expect(session.requireCanonicalRoot()).toEqual({
      kind: "binding_error",
      reason: "root_not_allowed",
    });
    await session.applyRootsResult({
      roots: [{ uri: pathToFileURL(root).href }],
    });
    expect(session.requireCanonicalRoot()).toEqual({
      kind: "binding_error",
      reason: "root_not_allowed",
    });
  });
});
