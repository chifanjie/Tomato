import type {
  RepoPulsePersistedPayloadV1,
  RepoPulseSurfaceResponseV1,
  RepositorySnapshotPersistedPayloadV1,
  RepositorySnapshotSurfaceResponseV1,
} from "@understand-code/contracts";

type StrongRepositorySnapshotV1 = Extract<
  RepositorySnapshotPersistedPayloadV1,
  { profile: "repository_snapshot_path_safe_v1" }
>;
type StrongRepositorySnapshotSurfaceViewV1 = Extract<
  RepositorySnapshotSurfaceResponseV1,
  { viewKind: "strong_repository_snapshot" }
>;
type StrongRepoPulseV1 = Extract<
  RepoPulsePersistedPayloadV1,
  { profile: "repo_pulse_path_safe_v1" }
>;
type StrongRepoPulseSurfaceViewV1 = Extract<
  RepoPulseSurfaceResponseV1,
  { viewKind: "strong_repo_pulse" }
>;

function projectBranchState(
  branchState: StrongRepositorySnapshotV1["branchState"],
): StrongRepositorySnapshotSurfaceViewV1["branchState"] {
  if (branchState.status === "detached") {
    return { status: "detached" };
  }
  if (branchState.status === "safe") {
    return {
      status: "safe",
      name: branchState.name,
    };
  }
  return {
    status: "redacted",
    boundaryCode: branchState.boundaryCode,
  };
}

function projectHeadState(
  headState: StrongRepositorySnapshotV1["headState"],
): StrongRepositorySnapshotSurfaceViewV1["headState"] {
  if (headState.kind === "commit") {
    return {
      kind: "commit",
      commit: headState.commit,
    };
  }
  return {
    kind: "unborn",
    emptyTreeObjectId: headState.emptyTreeObjectId,
  };
}

function projectChange(
  change: StrongRepositorySnapshotV1["changes"][number],
): StrongRepositorySnapshotSurfaceViewV1["changes"][number] {
  const projected: StrongRepositorySnapshotSurfaceViewV1["changes"][number] = {
    id: change.id,
    path: change.path,
    source: change.source,
    kind: change.kind,
  };
  if (change.oldPath !== undefined) {
    projected.oldPath = change.oldPath;
  }
  if (change.contentDigest !== undefined) {
    projected.contentDigest = change.contentDigest;
  }
  if (change.previousContentDigest !== undefined) {
    projected.previousContentDigest = change.previousContentDigest;
  }
  return projected;
}

function projectRedactedChange(
  change: StrongRepositorySnapshotV1["redactedChanges"][number],
): StrongRepositorySnapshotSurfaceViewV1["redactedChanges"][number] {
  return {
    id: change.id,
    source: change.source,
    kind: change.kind,
    boundaryCode: change.boundaryCode,
    count: change.count,
  };
}

function projectUnknownState(
  state: StrongRepositorySnapshotV1["unknownStates"][number],
): StrongRepositorySnapshotSurfaceViewV1["unknownStates"][number] {
  return {
    id: state.id,
    code: state.code,
    count: state.count,
  };
}

function projectStrongRepositorySnapshot(
  snapshot: StrongRepositorySnapshotV1,
): StrongRepositorySnapshotSurfaceViewV1 {
  return {
    viewVersion: 1,
    viewKind: "strong_repository_snapshot",
    snapshotId: snapshot.snapshotId,
    repositoryId: snapshot.repositoryId,
    worktreeId: snapshot.worktreeId,
    branchState: projectBranchState(snapshot.branchState),
    objectFormat: snapshot.objectFormat,
    headState: projectHeadState(snapshot.headState),
    captureStatus: snapshot.captureStatus,
    accounting: {
      rawLayerUnitCount: snapshot.accounting.rawLayerUnitCount,
      candidateUnitCount: snapshot.accounting.candidateUnitCount,
      safeChangeCount: snapshot.accounting.safeChangeCount,
      redactedKnownChangeCount: snapshot.accounting.redactedKnownChangeCount,
      unknownStateCount: snapshot.accounting.unknownStateCount,
    },
    changes: snapshot.changes.map(projectChange),
    redactedChanges: snapshot.redactedChanges.map(projectRedactedChange),
    unknownStates: snapshot.unknownStates.map(projectUnknownState),
    capturedAt: snapshot.createdAt,
    strongOperationSupported: true,
  };
}

/**
 * Projects either persisted Snapshot profile onto its frozen Repository Surface.
 * The projection deliberately constructs every nested value so unrecognised
 * persisted fields cannot cross the Surface boundary.
 */
export function projectRepositorySnapshotSurface(
  snapshot: RepositorySnapshotPersistedPayloadV1,
): RepositorySnapshotSurfaceResponseV1 {
  if ("profile" in snapshot) {
    if (snapshot.profile !== "repository_snapshot_path_safe_v1") {
      throw new TypeError("unsupported repository Snapshot profile");
    }
    return projectStrongRepositorySnapshot(snapshot);
  }
  return {
    viewVersion: 1,
    viewKind: "legacy_repository_snapshot_redacted",
    sourceCaptureStatus: snapshot.captureStatus,
    aggregateChangeCount: snapshot.changes.length,
    capturedAt: snapshot.createdAt,
    strongOperationSupported: false,
  };
}

function projectStrongRepoPulse(
  pulse: StrongRepoPulseV1,
): StrongRepoPulseSurfaceViewV1 {
  return {
    viewVersion: 1,
    viewKind: "strong_repo_pulse",
    evaluatedSnapshotId: pulse.evaluatedSnapshotId,
    status: pulse.status,
    branchState: projectBranchState(pulse.repositoryState.branchState),
    safeChangeCount: pulse.security.safeChangeCount,
    redactedChangeCount: pulse.security.redactedChangeCount,
    unknownStateCount: pulse.security.unknownStateCount,
    redactionBoundaryCodes: pulse.security.redactionBoundaryCodes.map(
      (code) => code,
    ),
    uncertaintyCodes: pulse.security.uncertaintyCodes.map((code) => code),
    evaluatedAt: pulse.evaluatedAt,
    strongOperationSupported: true,
  };
}

/** Projects either persisted Pulse profile without exposing legacy detail. */
export function projectRepoPulseSurface(
  pulse: RepoPulsePersistedPayloadV1,
): RepoPulseSurfaceResponseV1 {
  if ("profile" in pulse) {
    if (pulse.profile !== "repo_pulse_path_safe_v1") {
      throw new TypeError("unsupported Repo Pulse profile");
    }
    return projectStrongRepoPulse(pulse);
  }
  if (pulse.changeSummary === undefined) {
    return {
      viewVersion: 1,
      viewKind: "legacy_repo_pulse_redacted",
      status: pulse.status,
      evaluatedAt: pulse.evaluatedAt,
      strongOperationSupported: false,
    };
  }
  return {
    viewVersion: 1,
    viewKind: "legacy_repo_pulse_redacted",
    status: pulse.status,
    aggregateChangeCount: pulse.changeSummary.total,
    evaluatedAt: pulse.evaluatedAt,
    strongOperationSupported: false,
  };
}
