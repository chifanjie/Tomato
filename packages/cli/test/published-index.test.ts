import { PathSafeRepositorySnapshotIdV1Schema, StrongRepoPulseV1Schema, StrongRepositorySnapshotV1Schema } from "@understand-code/contracts";
import { parseWikiIndexV2 } from "@understand-code/core/knowledge-base";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ openIndex: vi.fn() }));
vi.mock("../src/runtime/repository-indexer.js", async (importOriginal) => ({
  ...await importOriginal<typeof import("../src/runtime/repository-indexer.js")>(),
  openActiveRepositoryIndexV1: mocks.openIndex,
}));

import { PRODUCT_VERSION } from "../src/constants.js";
import { createWorkbenchDashboardReaderInternalV1 } from "../src/handlers/tools.js";

const digest = (c: string) => `sha256:${c.repeat(64)}` as const;
const snapshotId = (c: string) => PathSafeRepositorySnapshotIdV1Schema.parse(`snapshot-${c.repeat(64)}`);
const repositoryId = `repo-hmac-${"1".repeat(64)}`;
const worktreeId = `worktree-hmac-${"2".repeat(64)}`;
const generationId = `generation-${"3".repeat(64)}`;
const oldHead = "a".repeat(40);
const currentHead = "b".repeat(40);
const timestamp = "2026-08-31T00:00:00.000Z";

function snapshot(id: string, head: string) {
  const token = `hmac-sha256:${"4".repeat(64)}`;
  return StrongRepositorySnapshotV1Schema.parse({
    schemaVersion: 1, profile: "repository_snapshot_path_safe_v1", snapshotId: id,
    repositoryId, worktreeId, rootIdentity: `root-hmac-${"5".repeat(64)}`,
    branchState: { status: "detached" }, objectFormat: "sha1",
    headState: { kind: "commit", commit: head }, repositoryStateToken: token,
    indexToken: token, worktreeToken: token, untrackedToken: token, ignoreToken: token,
    securityScanPolicyDigest: digest("6"), safeGitExecutionDigest: digest("7"),
    createdAt: timestamp, captureStatus: "complete",
    accounting: { rawLayerUnitCount: 0, candidateUnitCount: 0, safeChangeCount: 0,
      redactedKnownChangeCount: 0, unknownStateCount: 0 },
    changes: [], redactedChanges: [], unknownStates: [],
  });
}

function fixture(historical = true) {
  const old = snapshot(snapshotId("a"), oldHead);
  const current = historical ? snapshot(snapshotId("b"), currentHead) : old;
  const pulse = StrongRepoPulseV1Schema.parse({
    profile: "repo_pulse_path_safe_v1", evaluatedSnapshotId: current.snapshotId,
    evaluatedSnapshotContentDigest: digest("8"), status: "fresh",
    artifactFreshness: { graph: "fresh", wiki: "fresh", evidence: "fresh", diff: "fresh", task: "fresh" },
    repositoryState: { repositoryId, worktreeId, rootIdentity: current.rootIdentity,
      branchState: current.branchState, objectFormat: current.objectFormat,
      headState: current.headState, repositoryStateToken: current.repositoryStateToken,
      captureStatus: "complete" },
    changeSummary: { total: 0,
      bySource: { committed: 0, staged: 0, unstaged: 0, untracked: 0, conflict: 0 },
      byKind: { added: 0, modified: 0, deleted: 0, renamed: 0, copied: 0, type_changed: 0 } },
    security: { snapshotProfile: "repository_snapshot_path_safe_v1", safeChangeCount: 0,
      redactedChangeCount: 0, unknownStateCount: 0, redactionBoundaryCodes: [], uncertaintyCodes: [] },
    securityScanPolicyDigest: digest("6"), safeGitExecutionDigest: digest("7"),
    completeness: { parser: { status: "complete", coverage: 1, reasonCodes: [] },
      callGraph: { status: "complete", coverage: 1, reasonCodes: [] } },
    recommendedRefresh: "none", diagnosticCodes: [], evaluatedAt: timestamp,
  });
  const graph = { version: "1.0.0", project: { name: "published", languages: ["TypeScript"],
    frameworks: [], description: "historical fixture", analyzedAt: timestamp, gitCommitHash: oldHead },
    nodes: [{ id: "file:old.ts", type: "file", name: "old.ts", filePath: "old.ts",
      summary: "old source", tags: [], complexity: "simple" }], edges: [], layers: [], tour: [] };
  const meta = { version: "1.0.0", gitCommitHash: oldHead, lastAnalyzedAt: timestamp, analyzedFiles: 0 };
  const wiki = { version: 2, generatedAt: timestamp, projectName: "published",
    source: { outputLanguage: "en", generationMode: "preview", graphDigest: "a".repeat(64),
      gitCommitHash: oldHead, sourceRootIdentity: "/fixture" },
    mainReadiness: { status: "ready", reasons: [], routePageIds: ["page:old"] },
    referenceCoverage: { status: "complete", files: { covered: 0, total: 0, missingIds: [] },
      functions: { covered: 0, total: 0, missingIds: [] }, types: { covered: 0, total: 0, missingIds: [] } },
    pages: [{ id: "page:old", title: "Old page", summary: "published page", markdownPath: "knowledge-base/old.md",
      role: "featured", category: "overview", quality: "generated", generationStatus: "complete",
      directNodeIds: ["file:old.ts"], contextNodeIds: [], evidenceIds: ["evidence:old"], searchTerms: [], route: { order: 0, stage: "purpose" } }],
    nodeDocumentation: [], evidence: [{ id: "evidence:old", nodeIds: ["file:old.ts"],
      filePath: "old.ts", lineRange: [1, 1], excerpt: "export const old = true;", evidenceType: "production" }] };
  const files = new Map<string, unknown>([
    ["knowledge-graph.json", graph], ["meta.json", meta], ["knowledge-base/wiki-index.json", wiki],
    ["knowledge-base/search-index.json", { version: 2, generatedAt: timestamp, records: [] }],
    ["knowledge-base/old.md", "# Published old page\n"],
  ]);
  const authority = { sourceSnapshotId: old.snapshotId, finalizedProviderRevision: 7,
    generationId, generationManifestDigest: digest("9"), sourceInventoryDigest: digest("a") };
  const index = { authority: { sourceSnapshotId: authority.sourceSnapshotId, finalizedProviderRevision: 7 },
    generation: { generationId, generationManifestDigest: authority.generationManifestDigest,
      sourceInventoryDigest: authority.sourceInventoryDigest },
    read: vi.fn(async (name: string) => {
      const value = files.get(name);
      if (value === undefined) throw Error("missing indexed file");
      return Buffer.from(typeof value === "string" ? value : JSON.stringify(value));
    }) };
  mocks.openIndex.mockResolvedValue(index);
  const inspect = vi.fn(async () => ({ ...authority }));
  const snapshots = new Map([[old.snapshotId, old], [current.snapshotId, current]]);
  const runtime = { store: { repositoryId, worktreeId, layout: { worktreeRoot: "/fixture" },
    readArtifact: vi.fn(async (kind: string, input?: { snapshotId: string }) => ({ artifact: {
      artifactType: kind, payload: kind === "repo_pulse" ? pulse : snapshots.get(PathSafeRepositorySnapshotIdV1Schema.parse(input!.snapshotId)),
    } })) }, providerClient: { inspectIndexPublicationAuthority: inspect } };
  const reader = createWorkbenchDashboardReaderInternalV1(
    runtime as unknown as Parameters<typeof createWorkbenchDashboardReaderInternalV1>[0],
  );
  const read = (kind: string, extra: Record<string, unknown> = {}) => reader({
    productVersion: PRODUCT_VERSION, repositoryId, worktreeId, sourceSnapshotId: current.snapshotId,
    headCommit: current.headState.kind === "commit" ? current.headState.commit : null,
    freshness: "fresh", route: { view: "graph" }, kind,
    ...(kind === "wiki_page" ? { relativePath: "knowledge-base/old.md" } : {}), ...extra,
  } as Parameters<typeof reader>[0]);
  return { read, authority, inspect, index, files, graph, meta, wiki, pulse, snapshots };
}

beforeEach(() => vi.clearAllMocks());

describe("explicit Provider-pinned published Dashboard knowledge", () => {
  it("keeps default current reads closed to an older published generation", async () => {
    const f = fixture();
    for (const kind of ["meta", "graph", "wiki_index", "wiki_search", "wiki_page"]) {
      expect(await f.read(kind)).toEqual({ status: "unavailable" });
    }
    expect(f.index.read).not.toHaveBeenCalled();
  });

  it("discovers the exact historical cut via meta without using current session HEAD", async () => {
    const f = fixture();
    expect(await f.read("meta", { indexVersion: "published" })).toEqual({ status: "ready", json: {
      ...f.meta, knowledgeVersion: { status: "historical", generationId,
        sourceSnapshotId: snapshotId("a"), currentSnapshotId: snapshotId("b"), finalizedProviderRevision: 7 },
    } });
  });

  it("labels a published cut current only when its Snapshot equals the Pulse", async () => {
    const f = fixture(false);
    expect(await f.read("meta", { indexVersion: "published" })).toMatchObject({ status: "ready",
      json: { knowledgeVersion: { status: "current", sourceSnapshotId: snapshotId("a"), currentSnapshotId: snapshotId("a") } } });
    expect(await f.read("graph")).toMatchObject({ status: "ready" });
  });

  it.each(["graph", "wiki_index", "wiki_search", "wiki_page"])("reads %s only from the discovered generation", async (kind) => {
    const f = fixture();
    const wikiValidation = parseWikiIndexV2(f.wiki);
    expect(wikiValidation.ok, JSON.stringify(wikiValidation)).toBe(true);
    const result = await f.read(kind, { indexVersion: "published", indexGenerationId: generationId });
    expect(result).toMatchObject({ status: "ready" });
    if (kind === "wiki_page") expect(result).toMatchObject({ text: "# Published old page\n" });
  });

  it.each(["sourceSnapshotId", "finalizedProviderRevision", "generationId", "generationManifestDigest", "sourceInventoryDigest"])("rejects a mismatched Provider %s pin", async (field) => {
    const f = fixture();
    Object.assign(f.authority, { [field]: field === "finalizedProviderRevision" ? 8 : "different" });
    expect(await f.read("meta", { indexVersion: "published" })).not.toMatchObject({ status: "ready" });
    expect(f.index.read).not.toHaveBeenCalled();
  });

  it.each([undefined, "generation-bad", `generation-${"f".repeat(64)}`])("rejects missing, invalid, or changed generation %s", async (pin) => {
    const f = fixture(false);
    for (const kind of ["graph", "wiki_index", "wiki_search", "wiki_page"]) {
      expect(await f.read(kind, { indexVersion: "published", indexGenerationId: pin })).not.toMatchObject({ status: "ready" });
    }
  });

  it("rejects switching the active generation after meta discovery", async () => {
    const f = fixture();
    expect(await f.read("meta", { indexVersion: "published" })).toMatchObject({ status: "ready" });
    f.authority.generationId = f.index.generation.generationId = `generation-${"f".repeat(64)}`;
    expect(await f.read("wiki_page", { indexVersion: "published", indexGenerationId: generationId })).not.toMatchObject({ status: "ready" });
  });

  it.each(["graph", "meta", "wiki_index"])("rejects a %s whose commit disagrees within the pinned historical generation", async (kind) => {
    const f = fixture();
    if (kind === "graph") f.graph.project.gitCommitHash = currentHead;
    if (kind === "meta") f.meta.gitCommitHash = currentHead;
    if (kind === "wiki_index") f.wiki.source.gitCommitHash = currentHead;
    expect(await f.read(kind, { indexVersion: "published", indexGenerationId: generationId })).not.toMatchObject({ status: "ready" });
  });

  it("keeps session identity and current Pulse binding mandatory in published mode", async () => {
    const f = fixture();
    expect(await f.read("meta", { indexVersion: "published", repositoryId: "other" })).toEqual({ status: "invalid" });
    f.pulse.evaluatedSnapshotId = snapshotId("c");
    expect(await f.read("meta", { indexVersion: "published" })).toEqual({ status: "stale" });
  });

  it("does not promote an unauthenticated local historical Snapshot to authority", async () => {
    const f = fixture();
    f.snapshots.delete(snapshotId("a"));
    expect(await f.read("meta", { indexVersion: "published" })).toMatchObject({ status: "ready" });
  });

  it("rejects a Provider pin rotation during the content read", async () => {
    const f = fixture();
    f.index.read.mockImplementationOnce(async () => {
      f.authority.generationId = `generation-${"e".repeat(64)}`;
      return Buffer.from(JSON.stringify(f.graph));
    });
    expect(await f.read("graph", { indexVersion: "published", indexGenerationId: generationId })).toEqual({ status: "unavailable" });
  });
});
