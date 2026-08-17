import { createHash, randomBytes } from "node:crypto";
import { chmod, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";

import { canonicalizeJcsSafeIntegerV1 } from "@understand-code/durable-object-provider-contracts/jcs";
import {
  ProviderRuntimeIpcFixedObjectLocatorV1Schema,
  type ProviderRuntimeIpcFixedObjectLocatorV1,
} from "@understand-code/durable-object-provider-contracts/provider-runtime-ipc-v1";
import {
  ContentDigestV1Schema,
  DurableObjectIdentityProviderIdV1Schema,
  type ContentDigestV1,
  type DurableObjectIdentityProviderIdV1,
} from "@understand-code/durable-object-provider-contracts/primitives";

import {
  DurableObjectProviderRuntimeStoreV1,
  ProviderRuntimeStorageErrorV1,
  type ProviderRuntimeStorageErrorCodeV1,
} from "./storage.js";
import {
  assertProviderRuntimeTargetContinuityV1,
  probeProviderRuntimeTargetV1,
  ProviderRuntimeTargetInspectionErrorV1,
  type ProviderRuntimeTargetErrorCodeV1,
  type ProviderRuntimeTargetInspectionV1,
  type ProviderRuntimeTargetPublicProjectionV1,
} from "./target-inspection.js";

export const PROVIDER_RUNTIME_REAL_FILESYSTEM_CONFORMANCE_CANDIDATE_PROFILE_V1 =
  "understand_code_provider_runtime_real_filesystem_conformance_candidate_v1" as const;

const RESULT_DIGEST_DOMAIN_V1 =
  "understand-code-provider-runtime-real-filesystem-conformance-candidate-v1" as const;
const FIXTURE_DOMAIN_V1 =
  "understand-code-provider-runtime-real-filesystem-conformance-fixture-v1" as const;
const EXECUTION_DOMAIN_V1 =
  "understand-code-provider-runtime-real-filesystem-conformance-execution-v1" as const;

export type ProviderRuntimeRealFilesystemConformanceCaseIdV1 =
  | "exact_object_write_read"
  | "immutable_no_replace_replay"
  | "external_compare_and_set"
  | "restart_recovery"
  | "target_continuity";

export type ProviderRuntimeRealFilesystemConformanceCaseOutcomeV1 =
  | "passed"
  | "failed"
  | "not_run";

export type ProviderRuntimeRealFilesystemConformanceResultCodeV1 =
  | "passed"
  | "not_run"
  | "assertion_failed"
  | "runtime_failure"
  | ProviderRuntimeStorageErrorCodeV1
  | ProviderRuntimeTargetErrorCodeV1;

export interface ProviderRuntimeRealFilesystemConformanceCaseResultV1 {
  readonly caseId: ProviderRuntimeRealFilesystemConformanceCaseIdV1;
  readonly outcome: ProviderRuntimeRealFilesystemConformanceCaseOutcomeV1;
  readonly resultCode: ProviderRuntimeRealFilesystemConformanceResultCodeV1;
}

export interface ProviderRuntimeRealFilesystemConformanceBindingsV1 {
  readonly providerId: DurableObjectIdentityProviderIdV1;
  readonly targetFingerprintDigest: ContentDigestV1;
  readonly binaryDigest: ContentDigestV1;
  readonly policyDigest: ContentDigestV1;
  readonly capabilityDigest: ContentDigestV1;
}

export interface ProviderRuntimeRealFilesystemConformanceCandidateV1 {
  readonly schemaVersion: 1;
  readonly profile: typeof PROVIDER_RUNTIME_REAL_FILESYSTEM_CONFORMANCE_CANDIDATE_PROFILE_V1;
  readonly status: "candidate_passed" | "candidate_failed";
  /** This unsigned runtime observation can never grant Provider authority. */
  readonly authority: "none";
  readonly strongWriteStatus: "locked";
  readonly registryEvidenceStatus: "pending_signed_registry_evidence";
  readonly bindings: ProviderRuntimeRealFilesystemConformanceBindingsV1;
  readonly target: ProviderRuntimeTargetPublicProjectionV1;
  readonly executionDigest: ContentDigestV1;
  readonly fixtureObjectDigest: ContentDigestV1;
  readonly journalRevision: number | null;
  readonly cases: readonly ProviderRuntimeRealFilesystemConformanceCaseResultV1[];
  readonly completedAt: string;
  readonly resultDigest: ContentDigestV1;
}

export interface RunProviderRuntimeRealFilesystemConformanceOptionsV1 {
  /** Private target evidence. The canonical path is consumed but never returned. */
  readonly targetInspection: ProviderRuntimeTargetInspectionV1;
  readonly providerId: string;
  readonly binaryDigest: string;
  readonly policyDigest: string;
  readonly capabilityDigest: string;
}

class ProviderRuntimeConformanceAssertionErrorV1 extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderRuntimeConformanceAssertionErrorV1";
  }
}

const CASE_IDS_V1 = Object.freeze([
  "exact_object_write_read",
  "immutable_no_replace_replay",
  "external_compare_and_set",
  "restart_recovery",
  "target_continuity",
] as const satisfies readonly ProviderRuntimeRealFilesystemConformanceCaseIdV1[]);

function sha256DigestV1(bytes: string | Uint8Array): ContentDigestV1 {
  return ContentDigestV1Schema.parse(
    `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
  );
}

function domainDigestV1(domain: string, value: object): ContentDigestV1 {
  return sha256DigestV1(
    canonicalizeJcsSafeIntegerV1({
      domain,
      value,
    }),
  );
}

function assertV1(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ProviderRuntimeConformanceAssertionErrorV1(message);
}

function failureCodeV1(
  error: unknown,
): ProviderRuntimeRealFilesystemConformanceResultCodeV1 {
  if (error instanceof ProviderRuntimeStorageErrorV1) return error.code;
  if (error instanceof ProviderRuntimeTargetInspectionErrorV1) return error.code;
  if (error instanceof ProviderRuntimeConformanceAssertionErrorV1) {
    return "assertion_failed";
  }
  return "runtime_failure";
}

function passedCaseV1(
  caseId: ProviderRuntimeRealFilesystemConformanceCaseIdV1,
): ProviderRuntimeRealFilesystemConformanceCaseResultV1 {
  return Object.freeze({ caseId, outcome: "passed", resultCode: "passed" });
}

function failedCaseV1(
  caseId: ProviderRuntimeRealFilesystemConformanceCaseIdV1,
  resultCode: ProviderRuntimeRealFilesystemConformanceResultCodeV1,
): ProviderRuntimeRealFilesystemConformanceCaseResultV1 {
  return Object.freeze({ caseId, outcome: "failed", resultCode });
}

function notRunCaseV1(
  caseId: ProviderRuntimeRealFilesystemConformanceCaseIdV1,
): ProviderRuntimeRealFilesystemConformanceCaseResultV1 {
  return Object.freeze({ caseId, outcome: "not_run", resultCode: "not_run" });
}

function freezeTargetProjectionV1(
  target: ProviderRuntimeTargetPublicProjectionV1,
): ProviderRuntimeTargetPublicProjectionV1 {
  return Object.freeze({
    platform: target.platform,
    architecture: target.architecture,
    filesystemTypeCode: target.filesystemTypeCode,
    rootMode: target.rootMode,
    isolation: target.isolation,
  });
}

function freezeBindingsV1(
  bindings: ProviderRuntimeRealFilesystemConformanceBindingsV1,
): ProviderRuntimeRealFilesystemConformanceBindingsV1 {
  return Object.freeze({ ...bindings });
}

function buildCandidateV1(input: {
  readonly status: "candidate_passed" | "candidate_failed";
  readonly bindings: ProviderRuntimeRealFilesystemConformanceBindingsV1;
  readonly target: ProviderRuntimeTargetPublicProjectionV1;
  readonly executionDigest: ContentDigestV1;
  readonly fixtureObjectDigest: ContentDigestV1;
  readonly journalRevision: number | null;
  readonly cases: readonly ProviderRuntimeRealFilesystemConformanceCaseResultV1[];
}): ProviderRuntimeRealFilesystemConformanceCandidateV1 {
  const payload = Object.freeze({
    schemaVersion: 1 as const,
    profile: PROVIDER_RUNTIME_REAL_FILESYSTEM_CONFORMANCE_CANDIDATE_PROFILE_V1,
    status: input.status,
    authority: "none" as const,
    strongWriteStatus: "locked" as const,
    registryEvidenceStatus: "pending_signed_registry_evidence" as const,
    bindings: freezeBindingsV1(input.bindings),
    target: freezeTargetProjectionV1(input.target),
    executionDigest: input.executionDigest,
    fixtureObjectDigest: input.fixtureObjectDigest,
    journalRevision: input.journalRevision,
    cases: Object.freeze([...input.cases]),
    completedAt: new Date().toISOString(),
  });
  return Object.freeze({
    ...payload,
    resultDigest: domainDigestV1(RESULT_DIGEST_DOMAIN_V1, payload),
  });
}

/**
 * Exercise the durable runtime store on the inspected filesystem target.
 *
 * The returned record is intentionally unsigned and path-redacted. Passing
 * means only that this execution observed the required runtime semantics; it
 * cannot unlock strong writes until separately signed Registry evidence binds
 * the same provider, target, binary, policy, and capability digests.
 */
export async function runProviderRuntimeRealFilesystemConformanceV1(
  options: RunProviderRuntimeRealFilesystemConformanceOptionsV1,
): Promise<ProviderRuntimeRealFilesystemConformanceCandidateV1> {
  const providerId = DurableObjectIdentityProviderIdV1Schema.parse(
    options.providerId,
  );
  const binaryDigest = ContentDigestV1Schema.parse(options.binaryDigest);
  const policyDigest = ContentDigestV1Schema.parse(options.policyDigest);
  const capabilityDigest = ContentDigestV1Schema.parse(options.capabilityDigest);
  const targetFingerprintDigest = ContentDigestV1Schema.parse(
    options.targetInspection.targetFingerprintDigest,
  );
  const bindings = {
    providerId,
    targetFingerprintDigest,
    binaryDigest,
    policyDigest,
    capabilityDigest,
  } satisfies ProviderRuntimeRealFilesystemConformanceBindingsV1;

  const executionDigest = domainDigestV1(EXECUTION_DOMAIN_V1, {
    random: `base64url:${randomBytes(32).toString("base64url")}`,
    bindings,
  });
  const fixtureBytes = Buffer.from(
    canonicalizeJcsSafeIntegerV1({
      domain: FIXTURE_DOMAIN_V1,
      executionDigest,
      bindings,
    }),
    "utf8",
  );
  const fixtureObjectDigest = sha256DigestV1(fixtureBytes);
  const locator = ProviderRuntimeIpcFixedObjectLocatorV1Schema.parse({
    providerId,
    contentDigest: fixtureObjectDigest,
  });
  const encodedFixture = `base64url:${fixtureBytes.toString("base64url")}`;
  const cases = CASE_IDS_V1.map(notRunCaseV1);
  let activeCaseIndex = 0;
  let journalRevision: number | null = null;
  let target: ProviderRuntimeTargetInspectionV1;

  // Initial continuity failures are evidence outcomes, not exceptions that
  // can leak a filesystem path through an error message.
  try {
    target = await assertProviderRuntimeTargetContinuityV1(
      options.targetInspection,
    );
    assertV1(
      target.targetFingerprintDigest === targetFingerprintDigest,
      "target public fingerprint did not match the supplied baseline",
    );
  } catch (error) {
    cases[CASE_IDS_V1.length - 1] = failedCaseV1(
      "target_continuity",
      failureCodeV1(error),
    );
    return buildCandidateV1({
      status: "candidate_failed",
      bindings,
      target: options.targetInspection.publicProjection,
      executionDigest,
      fixtureObjectDigest,
      journalRevision,
      cases,
    });
  }

  let probeRootPath: string | undefined;
  let probeTarget: ProviderRuntimeTargetInspectionV1 | undefined;
  let status: "candidate_passed" | "candidate_failed" = "candidate_failed";

  try {
    // Never place conformance objects or journal records in a live runtime
    // root. The private child remains on the inspected target filesystem and
    // is removed before the path-redacted candidate is returned.
    probeRootPath = await mkdtemp(
      join(target.canonicalRootPath, ".uc-provider-conformance-"),
    );
    await chmod(probeRootPath, 0o700);
    probeTarget = await probeProviderRuntimeTargetV1(probeRootPath);
    assertV1(
      probeTarget.targetFingerprintDigest === targetFingerprintDigest,
      "ephemeral probe did not remain on the inspected target profile",
    );
    const store = new DurableObjectProviderRuntimeStoreV1({
      rootPath: probeTarget.canonicalRootPath,
      providerId,
    });
    await store.initialize();

    const write = await store.writeFixedObject(
      locator,
      fixtureBytes.byteLength,
      encodedFixture,
    );
    assertV1(write.resolution === "committed", "fixture was not newly committed");
    assertV1(
      write.verifiedContentDigest === fixtureObjectDigest,
      "fixture write digest did not match",
    );
    const read = await store.readFixedObject(locator);
    assertV1(read.bytes === encodedFixture, "fixture read bytes did not match");
    assertV1(
      read.logicalBytes === fixtureBytes.byteLength &&
        read.verifiedContentDigest === fixtureObjectDigest,
      "fixture read metadata did not match",
    );
    cases[activeCaseIndex] = passedCaseV1(CASE_IDS_V1[activeCaseIndex]!);

    activeCaseIndex += 1;
    const replay = await store.writeFixedObject(
      locator,
      fixtureBytes.byteLength,
      encodedFixture,
    );
    assertV1(replay.resolution === "replayed", "immutable replay was not detected");
    const conflictingBytes = Buffer.from(fixtureBytes);
    conflictingBytes[0] = conflictingBytes[0]! ^ 0x01;
    let conflictRejected = false;
    try {
      await store.writeFixedObject(
        locator,
        conflictingBytes.byteLength,
        `base64url:${conflictingBytes.toString("base64url")}`,
      );
    } catch (error) {
      conflictRejected =
        error instanceof ProviderRuntimeStorageErrorV1 &&
        error.code === "object_digest_mismatch";
    }
    assertV1(conflictRejected, "conflicting fixed-locator bytes were not rejected");
    const afterConflict = await store.readFixedObject(locator);
    assertV1(
      afterConflict.bytes === encodedFixture,
      "conflicting write replaced immutable fixture bytes",
    );
    cases[activeCaseIndex] = passedCaseV1(CASE_IDS_V1[activeCaseIndex]!);

    activeCaseIndex += 1;
    const beforeCommit = store.inspectState();
    const operationNonce = randomBytes(16).toString("hex");
    const mutation = {
      expectedRevision: beforeCommit.revision,
      operationNonce,
      phase: "real_fs_conformance_candidate",
      artifacts: {
        executionDigest,
        fixtureObjectDigest,
        targetFingerprintDigest,
      },
    } as const;
    const committed = await store.compareCommit(mutation);
    assertV1(committed.resolution === "committed", "CAS mutation did not commit");
    assertV1(
      committed.state.revision === beforeCommit.revision + 1,
      "CAS revision did not advance exactly once",
    );
    const replayedCommit = await store.compareCommit(mutation);
    assertV1(
      replayedCommit.resolution === "replayed" &&
        replayedCommit.state.revision === committed.state.revision,
      "CAS replay did not preserve the committed revision",
    );
    const external = new DurableObjectProviderRuntimeStoreV1({
      rootPath: probeTarget.canonicalRootPath,
      providerId,
    });
    await external.initialize();
    const stale = await external.compareCommit({
      expectedRevision: beforeCommit.revision,
      operationNonce: randomBytes(16).toString("hex"),
      phase: "real_fs_conformance_stale_probe",
      artifacts: { executionDigest },
    });
    assertV1(
      stale.resolution === "stale" &&
        stale.state.revision === committed.state.revision,
      "external stale CAS was not rejected against durable state",
    );
    journalRevision = committed.state.revision;
    cases[activeCaseIndex] = passedCaseV1(CASE_IDS_V1[activeCaseIndex]!);

    activeCaseIndex += 1;
    const restarted = new DurableObjectProviderRuntimeStoreV1({
      rootPath: probeTarget.canonicalRootPath,
      providerId,
    });
    await restarted.initialize();
    const recoveredState = restarted.inspectState();
    assertV1(
      recoveredState.revision === committed.state.revision &&
        recoveredState.operationNonce === operationNonce &&
        recoveredState.phase === mutation.phase,
      "restart did not recover the committed journal head",
    );
    const recoveredObject = await restarted.readFixedObject(
      locator as ProviderRuntimeIpcFixedObjectLocatorV1,
    );
    assertV1(
      recoveredObject.bytes === encodedFixture &&
        recoveredObject.verifiedContentDigest === fixtureObjectDigest,
      "restart did not recover the immutable fixture",
    );
    cases[activeCaseIndex] = passedCaseV1(CASE_IDS_V1[activeCaseIndex]!);
    activeCaseIndex += 1;
    status = "candidate_passed";
  } catch (error) {
    cases[activeCaseIndex] = failedCaseV1(
      CASE_IDS_V1[activeCaseIndex] ?? CASE_IDS_V1.at(-1)!,
      failureCodeV1(error),
    );
  }

  let continuityFailure:
    | ProviderRuntimeRealFilesystemConformanceResultCodeV1
    | undefined;
  if (probeTarget !== undefined) {
    try {
      const finalProbeTarget =
        await assertProviderRuntimeTargetContinuityV1(probeTarget);
      assertV1(
        finalProbeTarget.targetFingerprintDigest === targetFingerprintDigest,
        "ephemeral target fingerprint changed during conformance",
      );
    } catch (error) {
      continuityFailure = failureCodeV1(error);
    }
  } else {
    continuityFailure = "runtime_failure";
  }

  if (probeRootPath !== undefined) {
    try {
      await rm(probeRootPath, { recursive: true, force: true });
    } catch {
      continuityFailure = "runtime_failure";
    }
  }

  try {
    const finalTarget = await assertProviderRuntimeTargetContinuityV1(target);
    assertV1(
      finalTarget.targetFingerprintDigest === targetFingerprintDigest,
      "inspected target fingerprint changed during conformance",
    );
  } catch (error) {
    continuityFailure = failureCodeV1(error);
  }

  if (continuityFailure === undefined) {
    cases[CASE_IDS_V1.length - 1] = passedCaseV1("target_continuity");
  } else {
    cases[CASE_IDS_V1.length - 1] = failedCaseV1(
      "target_continuity",
      continuityFailure,
    );
    status = "candidate_failed";
  }

  return buildCandidateV1({
    status,
    bindings,
    target: target.publicProjection,
    executionDigest,
    fixtureObjectDigest,
    journalRevision,
    cases,
  });
}
