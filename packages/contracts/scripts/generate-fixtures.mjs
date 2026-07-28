import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ArtifactManifestV1Schema,
  ChangeCheckArtifactV1Schema,
  ClaimLedgerArtifactV1Schema,
  EvidenceLedgerArtifactV1Schema,
  ImpactArtifactV1Schema,
  RepoPulseArtifactV1Schema,
  RepositorySnapshotArtifactV1Schema,
  TaskArtifactBundleV1Schema,
  TaskBriefArtifactV1Schema,
  TaskManifestArtifactV1Schema,
  VerificationArtifactV1Schema,
  canonicalizeJson,
} from "../dist/index.js";

const scriptPath = fileURLToPath(import.meta.url);
const packageRoot = resolve(dirname(scriptPath), "..");
const fixtureRoot = join(packageRoot, "fixtures", "v1");
const checkOnly = process.argv.includes("--check");

const producerVersion = "3.0.0-alpha.1";
const repositoryId = "repository:fixture";
const worktreeId = "worktree:fixture";
const taskId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const baselineSnapshotId = "snapshot:baseline";
const latestSnapshotId = "snapshot:actual";
const createdAt = "2026-07-28T08:00:00Z";
const updatedAt = "2026-07-28T08:12:00Z";
const headCommit = "a".repeat(40);

function digestBytes(value) {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function digestJson(value) {
  return digestBytes(canonicalizeJson(value));
}

function envelope(artifactType, artifactId, payload, options = {}) {
  return {
    schemaVersion: 1,
    artifactType,
    artifactId,
    repositoryId,
    worktreeId,
    sourceSnapshotId: options.sourceSnapshotId ?? latestSnapshotId,
    ...(options.taskId === undefined ? {} : { taskId: options.taskId }),
    revision: options.revision ?? 0,
    producerVersion,
    createdAt: options.createdAt ?? updatedAt,
    contentDigest: digestJson(payload),
    payload,
  };
}

const repositorySnapshot = {
  schemaVersion: 1,
  snapshotId: latestSnapshotId,
  repositoryId,
  worktreeId,
  rootIdentity: "root:fixture",
  branch: "feature/reference-fixture",
  headCommit,
  baseCommit: headCommit,
  mergeBase: headCommit,
  indexDigest: digestJson({ files: [] }),
  worktreeDigest: digestJson({ files: ["src/task.ts"] }),
  untrackedDigest: digestJson({ files: [] }),
  ignoreDigest: digestJson({ rules: [".understand-code/tasks/"] }),
  createdAt: updatedAt,
  captureStatus: "complete",
  limitations: [],
  changes: [
    {
      id: "change:implementation",
      path: "src/task.ts",
      source: "unstaged",
      kind: "modified",
      contentDigest: digestJson("new implementation"),
      previousContentDigest: digestJson("old implementation"),
    },
  ],
};

const repoPulse = {
  evaluatedSnapshotId: latestSnapshotId,
  baselineSnapshotId,
  status: "fresh",
  artifactFreshness: {
    graph: "fresh",
    wiki: "fresh",
    evidence: "fresh",
    diff: "fresh",
    task: "fresh",
  },
  repositoryState: {
    rootIdentity: repositorySnapshot.rootIdentity,
    branch: repositorySnapshot.branch,
    baselineCommit: headCommit,
    headCommit,
    mergeBase: headCommit,
    ahead: 0,
    behind: 0,
    captureStatus: "complete",
    limitations: [],
  },
  changeSummary: {
    total: 1,
    bySource: {
      committed: 0,
      staged: 0,
      unstaged: 1,
      untracked: 0,
      conflict: 0,
    },
    byKind: {
      added: 0,
      modified: 1,
      deleted: 0,
      renamed: 0,
      copied: 0,
      type_changed: 0,
    },
  },
  completeness: {
    parser: { status: "complete", coverage: 1, reasons: [] },
    callGraph: { status: "complete", coverage: 1, reasons: [] },
  },
  recommendedRefresh: "none",
  errors: [],
  unknowns: [],
  reasons: [],
  evaluatedAt: updatedAt,
};

const eventSteps = [
  { action: { type: "task_created" }, resultingStatus: "created" },
  {
    action: { type: "transition_status", to: "context_ready" },
    resultingStatus: "context_ready",
  },
  {
    action: { type: "confirm_goal", claimId: "claim:goal" },
    resultingStatus: "context_ready",
  },
  {
    action: {
      type: "confirm_acceptance_criteria",
      claimIds: ["claim:acceptance"],
    },
    resultingStatus: "context_ready",
  },
  {
    action: {
      type: "confirm_plan",
      plannedChangeIds: ["planned-change:task"],
    },
    resultingStatus: "context_ready",
  },
  {
    action: { type: "transition_status", to: "planned" },
    resultingStatus: "planned",
  },
  {
    action: { type: "transition_status", to: "in_progress" },
    resultingStatus: "in_progress",
  },
  {
    action: { type: "transition_status", to: "check_required" },
    resultingStatus: "check_required",
  },
  {
    action: {
      type: "change_checked",
      changeCheckArtifactId: "artifact:change-check",
      changeCheckId: "change-check:final",
    },
    resultingStatus: "check_required",
  },
  {
    action: { type: "transition_status", to: "verification_required" },
    resultingStatus: "verification_required",
  },
  {
    action: {
      type: "verification_recorded",
      verificationRecordId: "verification:test",
    },
    resultingStatus: "verification_required",
  },
  {
    action: { type: "transition_status", to: "verified" },
    resultingStatus: "verified",
  },
];

const events = [];
for (const [index, step] of eventSteps.entries()) {
  const revision = index + 1;
  const previousStatus = events.at(-1)?.resultingStatus;
  const partial = {
    schemaVersion: 1,
    eventId: `event:${revision}`,
    repositoryId,
    worktreeId,
    taskId,
    previousRevision: revision - 1,
    revision,
    actor: revision === 1 ? "codex" : "developer",
    idempotencyKey: `fixture-request-${revision}`,
    requestDigest: digestJson(step.action),
    sourceSnapshotId: latestSnapshotId,
    occurredAt: `2026-07-28T08:${String(index).padStart(2, "0")}:00Z`,
    ...(previousStatus === undefined ? {} : { previousStatus }),
    resultingStatus: step.resultingStatus,
    action: step.action,
    ...(revision === 1
      ? {}
      : { previousEventDigest: events.at(-1).eventDigest }),
  };
  events.push({ ...partial, eventDigest: digestJson(partial) });
}

const manifest = {
  schemaVersion: 1,
  taskId,
  title: "Preserve evidence across Agent handoffs",
  originalIntent:
    "Keep task evidence stable when Codex and Claude continue the same change.",
  status: "verified",
  repositoryId,
  worktreeId,
  baselineSnapshotId,
  latestSnapshotId,
  currentChangeCheckId: "change-check:final",
  currentChangeCheckRevision: 9,
  createdAt,
  updatedAt,
  producerVersion,
  revision: events.length,
};

const brief = {
  originalIntent: manifest.originalIntent,
  goalClaimId: "claim:goal",
  nonGoalClaimIds: [],
  acceptanceClaimIds: ["claim:acceptance"],
  readingPath: [
    {
      id: "reading:task",
      order: 0,
      kind: "symbol",
      filePath: "src/task.ts",
      symbolId: "symbol:task-handler",
      claimIds: ["claim:recommendation"],
      evidenceIds: ["evidence:source"],
    },
  ],
  plannedChanges: [
    {
      id: "planned-change:task",
      candidateLevel: "likely_change",
      filePath: "src/task.ts",
      symbolId: "symbol:task-handler",
      intent: "Use stable Claim and Evidence identifiers.",
      claimIds: ["claim:recommendation"],
      impactPathIds: ["impact:task-to-consumer"],
    },
  ],
  assumptionClaimIds: [],
  riskClaimIds: [],
  unknownClaimIds: [],
  verificationPlan: [
    {
      id: "verification-plan:contracts",
      acceptanceClaimIds: ["claim:acceptance"],
      method: "test",
      description: "Run the shared contract suite.",
      required: true,
    },
  ],
};

const claims = [
  {
    id: "claim:goal",
    taskId,
    kind: "goal",
    statement: "Agent handoffs preserve one task context.",
    epistemicStatus: "human_confirmed",
    lifecycleStatus: "supported",
    freshness: "current",
    sourceSnapshotId: latestSnapshotId,
    evidenceIds: ["evidence:goal"],
    findingIds: [],
    verificationRecordIds: [],
    confirmationEventId: "event:3",
    createdAt,
    updatedAt,
  },
  {
    id: "claim:acceptance",
    taskId,
    kind: "acceptance",
    statement: "The same artifact parses in every supported consumer.",
    epistemicStatus: "human_confirmed",
    lifecycleStatus: "supported",
    freshness: "current",
    sourceSnapshotId: latestSnapshotId,
    evidenceIds: ["evidence:acceptance"],
    findingIds: [],
    verificationRecordIds: ["verification:test"],
    confirmationEventId: "event:4",
    createdAt,
    updatedAt,
  },
  {
    id: "claim:recommendation",
    taskId,
    kind: "recommendation",
    statement: "Change the task handler while preserving stable IDs.",
    epistemicStatus: "observed",
    lifecycleStatus: "supported",
    freshness: "current",
    sourceSnapshotId: latestSnapshotId,
    evidenceIds: ["evidence:source"],
    findingIds: ["finding:planned-completed"],
    verificationRecordIds: [],
    createdAt,
    updatedAt,
  },
  {
    id: "claim:finding-planned-completed",
    taskId,
    kind: "finding",
    statement: "The planned task-handler change is present in the final Snapshot.",
    epistemicStatus: "observed",
    lifecycleStatus: "supported",
    freshness: "current",
    sourceSnapshotId: latestSnapshotId,
    evidenceIds: ["evidence:source"],
    findingIds: ["finding:planned-completed"],
    verificationRecordIds: [],
    createdAt,
    updatedAt,
  },
];

const evidence = [
  {
    id: "evidence:goal",
    kind: "human",
    epistemicStatus: "human_confirmed",
    freshness: "current",
    claimIds: ["claim:goal"],
    nodeIds: [],
    producedBy: "codex",
    createdAt,
    observedAtSnapshotId: latestSnapshotId,
    confirmation: {
      actor: "developer",
      input: "Preserve one task context across Agent handoffs.",
      confirmedAt: "2026-07-28T08:02:00Z",
    },
  },
  {
    id: "evidence:acceptance",
    kind: "human",
    epistemicStatus: "human_confirmed",
    freshness: "current",
    claimIds: ["claim:acceptance"],
    nodeIds: [],
    producedBy: "codex",
    createdAt,
    observedAtSnapshotId: latestSnapshotId,
    confirmation: {
      actor: "developer",
      input: "Require cross-consumer parsing.",
      confirmedAt: "2026-07-28T08:03:00Z",
    },
  },
  {
    id: "evidence:source",
    kind: "source",
    epistemicStatus: "observed",
    freshness: "current",
    claimIds: [
      "claim:recommendation",
      "claim:finding-planned-completed",
    ],
    nodeIds: ["symbol:task-handler"],
    producedBy: "core",
    createdAt,
    observedAtSnapshotId: latestSnapshotId,
    filePath: "src/task.ts",
    lineRange: [10, 24],
    excerpt: "export function updateTask() { /* fixture */ }",
    commit: headCommit,
    contentHash: digestJson("export function updateTask() { /* fixture */ }"),
  },
];

const impactPaths = [
  {
    id: "impact:task-to-consumer",
    sourceNodeId: "symbol:task-handler",
    targetNodeId: "symbol:agent-consumer",
    classification: "observed",
    claimIds: ["claim:recommendation"],
    steps: [
      {
        source: "symbol:task-handler",
        edgeType: "calls",
        target: "symbol:agent-consumer",
        direction: "downstream",
        evidenceId: "evidence:source",
        confidence: "exact",
      },
    ],
  },
];

const changeCheck = {
  schemaVersion: 1,
  id: "change-check:final",
  taskId,
  taskRevision: 9,
  baselineSnapshotId,
  actualSnapshotId: latestSnapshotId,
  findings: [
    {
      id: "finding:planned-completed",
      type: "planned_completed",
      severity: "info",
      blocking: false,
      summary: "The planned task handler changed.",
      claimIds: [
        "claim:recommendation",
        "claim:finding-planned-completed",
      ],
      plannedChangeIds: ["planned-change:task"],
      actualChangeIds: ["change:implementation"],
      evidenceIds: ["evidence:source"],
      impactPathIds: ["impact:task-to-consumer"],
    },
  ],
  generatedAt: "2026-07-28T08:08:00Z",
};

const verificationRecords = [
  {
    id: "verification:test",
    taskId,
    verificationPlanEntryId: "verification-plan:contracts",
    attempt: 1,
    kind: "test",
    status: "passed",
    command: "pnpm --filter @understand-code/contracts test",
    exitCode: 0,
    durationMs: 950,
    outputDigest: digestJson("77 tests passed"),
    summary: "Shared contract tests passed.",
    claimIds: ["claim:acceptance"],
    snapshotId: latestSnapshotId,
    recordedAt: "2026-07-28T08:10:00Z",
    actor: "developer",
  },
];

const idempotencyRecords = events.map((event) => ({
  schemaVersion: 1,
  worktreeId,
  scope:
    event.revision === 1
      ? { kind: "task_create", createScope: "build_task_brief" }
      : { kind: "task", taskId },
  idempotencyKey: event.idempotencyKey,
  actor: event.actor,
  requestDigest: event.requestDigest,
  taskId,
  resultRevision: event.revision,
  eventId: event.eventId,
  resultDigest: digestJson({
    taskId,
    revision: event.revision,
    eventId: event.eventId,
  }),
  createdAt: event.occurredAt,
}));

const taskBundle = {
  manifest,
  brief,
  claims,
  evidence,
  impactPaths,
  changeChecks: [changeCheck],
  verificationRecords,
  events,
  idempotencyRecords,
};

const artifacts = {
  "repository-snapshot.json": envelope(
    "repository_snapshot",
    "artifact:repository-snapshot",
    repositorySnapshot,
  ),
  "repo-pulse.json": envelope("repo_pulse", "artifact:repo-pulse", repoPulse),
  "task.json": envelope("task_manifest", "artifact:task-manifest", manifest, {
    taskId,
    revision: manifest.revision,
  }),
  "task-brief.json": envelope("task_brief", "artifact:task-brief", brief, {
    taskId,
    revision: manifest.revision,
  }),
  "claims.json": envelope(
    "claim_ledger",
    "artifact:claim-ledger",
    { claims },
    { taskId, revision: manifest.revision },
  ),
  "evidence.json": envelope(
    "evidence_ledger",
    "artifact:evidence-ledger",
    { evidence },
    { taskId, revision: manifest.revision },
  ),
  "impact.json": envelope(
    "impact",
    "artifact:impact",
    { paths: impactPaths },
    { taskId, revision: manifest.revision },
  ),
  "change-check.json": envelope(
    "change_check",
    "artifact:change-check",
    changeCheck,
    { taskId, revision: manifest.revision },
  ),
  "verification.json": envelope(
    "verification",
    "artifact:verification",
    { records: verificationRecords },
    { taskId, revision: manifest.revision },
  ),
};

const eventsJsonl = `${events.map((event) => canonicalizeJson(event)).join("\n")}\n`;

const descriptors = [
  {
    fileName: "repository-snapshot.json",
    artifactType: "repository_snapshot",
    artifactId: "artifact:repository-snapshot",
    path: `.understand-code/snapshots/${latestSnapshotId}.json`,
    dependencies: [],
  },
  {
    fileName: "repo-pulse.json",
    artifactType: "repo_pulse",
    artifactId: "artifact:repo-pulse",
    path: ".understand-code/repo-pulse.json",
    dependencies: ["artifact:repository-snapshot"],
  },
  {
    fileName: "task.json",
    artifactType: "task_manifest",
    artifactId: "artifact:task-manifest",
    path: `.understand-code/tasks/${taskId}/task.json`,
    dependencies: ["artifact:repository-snapshot", "artifact:repo-pulse"],
  },
  {
    fileName: "claims.json",
    artifactType: "claim_ledger",
    artifactId: "artifact:claim-ledger",
    path: `.understand-code/tasks/${taskId}/claims.json`,
    dependencies: ["artifact:task-manifest"],
  },
  {
    fileName: "evidence.json",
    artifactType: "evidence_ledger",
    artifactId: "artifact:evidence-ledger",
    path: `.understand-code/tasks/${taskId}/evidence.json`,
    dependencies: ["artifact:task-manifest", "artifact:claim-ledger"],
  },
  {
    fileName: "impact.json",
    artifactType: "impact",
    artifactId: "artifact:impact",
    path: `.understand-code/tasks/${taskId}/impact.json`,
    dependencies: ["artifact:claim-ledger", "artifact:evidence-ledger"],
  },
  {
    fileName: "task-brief.json",
    artifactType: "task_brief",
    artifactId: "artifact:task-brief",
    path: `.understand-code/tasks/${taskId}/task-brief.json`,
    dependencies: [
      "artifact:task-manifest",
      "artifact:claim-ledger",
      "artifact:evidence-ledger",
      "artifact:impact",
    ],
  },
  {
    fileName: "change-check.json",
    artifactType: "change_check",
    artifactId: "artifact:change-check",
    path: `.understand-code/tasks/${taskId}/change-check.json`,
    dependencies: [
      "artifact:task-brief",
      "artifact:evidence-ledger",
      "artifact:impact",
    ],
  },
  {
    fileName: "verification.json",
    artifactType: "verification",
    artifactId: "artifact:verification",
    path: `.understand-code/tasks/${taskId}/verification.json`,
    dependencies: ["artifact:change-check", "artifact:claim-ledger"],
  },
].map((definition) => {
  const artifact = artifacts[definition.fileName];
  return {
    descriptorVersion: 1,
    artifactId: definition.artifactId,
    artifactType: definition.artifactType,
    storageFormat: "enveloped_v1",
    path: definition.path,
    schemaVersion: 1,
    producerVersion,
    sourceSnapshotId: latestSnapshotId,
    ...(definition.artifactType.startsWith("task_") ||
    [
      "claim_ledger",
      "evidence_ledger",
      "impact",
      "change_check",
      "verification",
    ].includes(definition.artifactType)
      ? { taskId }
      : {}),
    revision: artifact.revision,
    contentDigest: artifact.contentDigest,
    state: "current",
    freshness: "fresh",
    generatedAt: artifact.createdAt,
    dependencies: definition.dependencies.map((dependencyId) => {
      const dependency = Object.values(artifacts).find(
        (candidate) => candidate.artifactId === dependencyId,
      );
      return {
        artifactId: dependencyId,
        relation: "requires",
        requiredDigest: dependency.contentDigest,
        requiredSnapshotId: latestSnapshotId,
      };
    }),
  };
});

descriptors.push({
  descriptorVersion: 1,
  artifactId: "artifact:task-events",
  artifactType: "task_event_log",
  storageFormat: "jsonl_v1",
  path: `.understand-code/tasks/${taskId}/events.jsonl`,
  schemaVersion: 1,
  producerVersion,
  sourceSnapshotId: latestSnapshotId,
  taskId,
  revision: manifest.revision,
  contentDigest: digestBytes(eventsJsonl),
  state: "current",
  freshness: "fresh",
  generatedAt: updatedAt,
  dependencies: [
    {
      artifactId: "artifact:task-manifest",
      relation: "requires",
      requiredDigest: artifacts["task.json"].contentDigest,
      requiredSnapshotId: latestSnapshotId,
    },
  ],
});

const artifactManifest = {
  schemaVersion: 1,
  repositoryId,
  worktreeId,
  status: "ready",
  latestSnapshotId,
  producerVersion,
  updatedAt,
  reasons: [],
  artifacts: descriptors,
};

const parsers = {
  "repository-snapshot.json": RepositorySnapshotArtifactV1Schema,
  "repo-pulse.json": RepoPulseArtifactV1Schema,
  "task.json": TaskManifestArtifactV1Schema,
  "task-brief.json": TaskBriefArtifactV1Schema,
  "claims.json": ClaimLedgerArtifactV1Schema,
  "evidence.json": EvidenceLedgerArtifactV1Schema,
  "impact.json": ImpactArtifactV1Schema,
  "change-check.json": ChangeCheckArtifactV1Schema,
  "verification.json": VerificationArtifactV1Schema,
};

for (const [fileName, artifact] of Object.entries(artifacts)) {
  parsers[fileName].parse(artifact);
}
TaskArtifactBundleV1Schema.parse(taskBundle);
ArtifactManifestV1Schema.parse(artifactManifest);

const invalidFixtures = {
  "blocked-task-without-state.json": {
    ...artifacts["task.json"],
    contentDigest: digestJson({ ...manifest, status: "blocked" }),
    payload: { ...manifest, status: "blocked" },
  },
  "dangling-task-bundle.json": {
    ...taskBundle,
    claims: claims.map((claim) =>
      claim.id === "claim:recommendation"
        ? { ...claim, evidenceIds: ["evidence:missing"] }
        : claim,
    ),
  },
  "digest-mismatch-artifact.json": {
    ...artifacts["repository-snapshot.json"],
    contentDigest: `sha256:${"0".repeat(64)}`,
  },
  "unknown-version-artifact.json": {
    ...artifacts["repository-snapshot.json"],
    schemaVersion: 2,
  },
  "stale-dependency-manifest.json": {
    ...artifactManifest,
    artifacts: artifactManifest.artifacts.map((descriptor) =>
      descriptor.artifactId === "artifact:repository-snapshot"
        ? { ...descriptor, freshness: "stale" }
        : descriptor,
    ),
  },
};

const legacyFixtures = {
  "graph-v1.json": {
    version: "1.0.0",
    project: {
      name: "contract-fixture",
      languages: ["TypeScript"],
      frameworks: [],
      description: "Minimal legacy graph fixture.",
      analyzedAt: createdAt,
      gitCommitHash: headCommit,
    },
    nodes: [
      {
        id: "file:src/task.ts",
        type: "file",
        name: "task.ts",
        filePath: "src/task.ts",
        summary: "Fixture task implementation.",
        tags: ["fixture"],
        complexity: "simple",
      },
    ],
    edges: [],
    layers: [],
    tour: [],
  },
  "meta-v1.json": {
    lastAnalyzedAt: createdAt,
    gitCommitHash: headCommit,
    version: "1.0.0",
    analyzedFiles: 1,
  },
  "fingerprints-v1.json": {
    version: "1.0.0",
    gitCommitHash: headCommit,
    generatedAt: createdAt,
    files: {},
  },
  "wiki-index-v1.json": {
    version: 1,
    generatedAt: createdAt,
    projectName: "contract-fixture",
    source: {
      outputLanguage: "zh-CN",
      graphDigest: digestJson("legacy graph"),
      generationMode: "writer",
      gitCommitHash: headCommit,
    },
    pages: [
      {
        id: "page:legacy-task",
        title: "任务模块",
        category: "file",
        summary: "Legacy Wiki V1 task fixture.",
        markdownPath: "knowledge-base/files/task.md",
        explainedNodeIds: ["file:src/task.ts"],
        relatedNodeIds: ["function:src/task.ts:updateTask"],
        evidenceIds: ["wiki-v1-evidence:task"],
        coverage: "partial",
        quality: "generated",
        searchTerms: ["task", "updateTask"],
      },
    ],
    evidence: [
      {
        id: "wiki-v1-evidence:task",
        label: "Task implementation",
        filePath: "src/task.ts",
        lineRange: [1, 2],
        nodeIds: ["file:src/task.ts"],
      },
    ],
    gaps: [
      {
        id: "wiki-v1-gap:update-task",
        nodeId: "function:src/task.ts:updateTask",
        reason: "The related function needs dedicated documentation.",
        severity: "medium",
      },
    ],
  },
  "wiki-index-v2.json": {
    version: 2,
    generatedAt: createdAt,
    projectName: "contract-fixture",
    source: {
      outputLanguage: "zh-CN",
      generationMode: "writer",
      graphDigest: digestJson("legacy graph"),
      gitCommitHash: headCommit,
      sourceRootIdentity: "fixture-root",
    },
    mainReadiness: {
      status: "ready",
      reasons: [],
      routePageIds: ["page:overview"],
    },
    referenceCoverage: {
      status: "complete",
      files: { covered: 1, total: 1, missingIds: [] },
      functions: { covered: 0, total: 0, missingIds: [] },
      types: { covered: 0, total: 0, missingIds: [] },
    },
    pages: [
      {
        id: "page:overview",
        title: "项目总览",
        summary: "Legacy Wiki V2 fixture.",
        markdownPath: "knowledge-base/overview.md",
        role: "featured",
        category: "overview",
        quality: "generated",
        generationStatus: "complete",
        directNodeIds: ["file:src/task.ts"],
        contextNodeIds: [],
        evidenceIds: ["wiki-evidence:task"],
        searchTerms: ["task"],
        route: { order: 0, stage: "purpose" },
      },
    ],
    nodeDocumentation: [
      {
        nodeId: "file:src/task.ts",
        relation: "direct",
        quality: "generated",
        evidenceHealth: "source-linked",
        generationStatus: "complete",
        referenceCoverage: "anchored",
        directPageIds: ["page:overview"],
        contextPageIds: [],
        evidenceIds: ["wiki-evidence:task"],
        primaryPageId: "page:overview",
        anchor: "task",
      },
    ],
    evidence: [
      {
        id: "wiki-evidence:task",
        nodeIds: ["file:src/task.ts"],
        filePath: "src/task.ts",
        lineRange: [1, 1],
        excerpt: "export const task = true;",
        evidenceType: "production",
      },
    ],
  },
  "wiki-search-v2.json": {
    version: 2,
    generatedAt: createdAt,
    records: [
      {
        id: "page:page%3Aoverview",
        kind: "page",
        title: "项目总览",
        summary: "Legacy Wiki V2 search fixture.",
        content: "# 项目总览",
        pageId: "page:overview",
        role: "featured",
        category: "overview",
        relation: "direct",
        terms: ["task"],
        businessTerms: ["任务"],
      },
    ],
  },
  "wiki-document-traces-v2.json": {
    version: 2,
    generatedAt: createdAt,
    traces: [
      {
        pageId: "page:overview",
        directNodeIds: ["file:src/task.ts"],
        contextNodeIds: [],
        evidenceIds: ["wiki-evidence:task"],
        quality: "generated",
        generationStatus: "complete",
        issues: [],
        claims: [
          {
            id: "wiki-claim:task",
            text: "Task fixture documents the task implementation.",
            nodeIds: ["file:src/task.ts"],
            evidenceIds: ["wiki-evidence:task"],
          },
        ],
      },
    ],
  },
  "wiki-generation-report-v2.json": {
    version: 2,
    generatedAt: createdAt,
    generationMode: "writer",
    source: {
      outputLanguage: "zh-CN",
      sourceRootIdentity: "fixture-root",
      graphDigest: digestJson("legacy graph"),
      gitCommitHash: headCommit,
    },
    sourceRead: {
      covered: 1,
      total: 1,
      missingIds: [],
    },
    mainReadiness: {
      status: "ready",
      reasons: [],
      routePageIds: ["page:overview"],
    },
    referenceCoverage: {
      status: "complete",
      files: { covered: 1, total: 1, missingIds: [] },
      functions: { covered: 0, total: 0, missingIds: [] },
      types: { covered: 0, total: 0, missingIds: [] },
    },
    warnings: [],
    errors: [],
  },
  "diff-overlay-v1.json": {
    version: "1.0.0",
    baseCommit: headCommit,
    targetCommit: headCommit,
    files: [],
  },
};

const expectedFiles = new Map();
for (const [fileName, value] of Object.entries(artifacts)) {
  expectedFiles.set(
    join("reference", fileName),
    `${JSON.stringify(value, null, 2)}\n`,
  );
}
expectedFiles.set(
  join("reference", "artifact-manifest.json"),
  `${JSON.stringify(artifactManifest, null, 2)}\n`,
);
expectedFiles.set(
  join("reference", "task-bundle.json"),
  `${JSON.stringify(taskBundle, null, 2)}\n`,
);
expectedFiles.set(join("reference", "events.jsonl"), eventsJsonl);
expectedFiles.set(
  join("reference", "repository-error-snapshot.json"),
  `${JSON.stringify(
    {
      ...repositorySnapshot,
      headCommit: undefined,
      baseCommit: undefined,
      mergeBase: undefined,
      captureStatus: "error",
      limitations: ["Git repository state is unavailable."],
      changes: [],
    },
    null,
    2,
  )}\n`,
);
for (const [fileName, value] of Object.entries(invalidFixtures)) {
  expectedFiles.set(
    join("invalid", fileName),
    `${JSON.stringify(value, null, 2)}\n`,
  );
}
expectedFiles.set(join("invalid", "corrupt-json.txt"), '{"schemaVersion":1,\n');
for (const [fileName, value] of Object.entries(legacyFixtures)) {
  expectedFiles.set(
    join("legacy", fileName),
    `${JSON.stringify(value, null, 2)}\n`,
  );
}

const mismatches = [];
if (!checkOnly) {
  for (const relativePath of expectedFiles.keys()) {
    await mkdir(dirname(join(fixtureRoot, relativePath)), { recursive: true });
  }
}

for (const [relativePath, serialized] of expectedFiles) {
  const filePath = join(fixtureRoot, relativePath);
  if (checkOnly) {
    let current;
    try {
      current = await readFile(filePath, "utf8");
    } catch {
      mismatches.push(`missing fixture: ${relativePath}`);
      continue;
    }
    if (current !== serialized) mismatches.push(`stale fixture: ${relativePath}`);
  } else {
    await writeFile(filePath, serialized, "utf8");
  }
}

if (checkOnly) {
  for (const directory of ["reference", "invalid", "legacy"]) {
    let existing = [];
    try {
      existing = await readdir(join(fixtureRoot, directory));
    } catch {
      mismatches.push(`missing fixture directory: ${directory}`);
      continue;
    }
    for (const fileName of existing) {
      const relativePath = join(directory, fileName);
      if (!expectedFiles.has(relativePath)) {
        mismatches.push(`unexpected fixture: ${relativePath}`);
      }
    }
  }
}

if (mismatches.length > 0) {
  for (const mismatch of mismatches) process.stderr.write(`${mismatch}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    checkOnly
      ? `Verified ${expectedFiles.size} contract fixtures.\n`
      : `Generated ${expectedFiles.size} contract fixtures.\n`,
  );
}
