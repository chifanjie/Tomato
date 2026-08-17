import { chmod, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  runProviderRuntimeRealFilesystemConformanceV1,
  type RunProviderRuntimeRealFilesystemConformanceOptionsV1,
} from "../src/conformance-runner.js";
import { probeProviderRuntimeTargetV1 } from "../src/target-inspection.js";

const PROVIDER_ID = "durable-object-provider:real-fs-runner-test";
const BINARY_DIGEST = `sha256:${"1".repeat(64)}`;
const POLICY_DIGEST = `sha256:${"2".repeat(64)}`;
const CAPABILITY_DIGEST = `sha256:${"3".repeat(64)}`;
const roots = new Set<string>();

afterEach(async () => {
  await Promise.all([...roots].map((root) => rm(root, { recursive: true, force: true })));
  roots.clear();
});

async function targetOptionsV1(): Promise<RunProviderRuntimeRealFilesystemConformanceOptionsV1> {
  const root = await mkdtemp(join(tmpdir(), "provider-real-fs-runner-"));
  roots.add(root);
  await chmod(root, 0o700);
  return {
    targetInspection: await probeProviderRuntimeTargetV1(root),
    providerId: PROVIDER_ID,
    binaryDigest: BINARY_DIGEST,
    policyDigest: POLICY_DIGEST,
    capabilityDigest: CAPABILITY_DIGEST,
  };
}

describe("provider runtime real-filesystem conformance runner", () => {
  it("passes exact-object, immutable replay, external CAS, and restart recovery on the inspected target", async () => {
    const options = await targetOptionsV1();
    const result = await runProviderRuntimeRealFilesystemConformanceV1(options);

    expect(result).toMatchObject({
      schemaVersion: 1,
      profile:
        "understand_code_provider_runtime_real_filesystem_conformance_candidate_v1",
      status: "candidate_passed",
      authority: "none",
      strongWriteStatus: "locked",
      registryEvidenceStatus: "pending_signed_registry_evidence",
      bindings: {
        providerId: PROVIDER_ID,
        targetFingerprintDigest: options.targetInspection.targetFingerprintDigest,
        binaryDigest: BINARY_DIGEST,
        policyDigest: POLICY_DIGEST,
        capabilityDigest: CAPABILITY_DIGEST,
      },
      journalRevision: 1,
      cases: [
        { caseId: "exact_object_write_read", outcome: "passed", resultCode: "passed" },
        { caseId: "immutable_no_replace_replay", outcome: "passed", resultCode: "passed" },
        { caseId: "external_compare_and_set", outcome: "passed", resultCode: "passed" },
        { caseId: "restart_recovery", outcome: "passed", resultCode: "passed" },
        { caseId: "target_continuity", outcome: "passed", resultCode: "passed" },
      ],
    });
    expect(result.resultDigest).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(result.fixtureObjectDigest).toMatch(/^sha256:[0-9a-f]{64}$/u);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(options.targetInspection.canonicalRootPath);
    expect(serialized).not.toContain("canonicalRootPath");
    expect(serialized).not.toContain("rootInode");
    expect(result).not.toHaveProperty("continuity");
    expect(result.target).not.toHaveProperty("continuity");
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.cases)).toBe(true);
    expect(await readdir(options.targetInspection.canonicalRootPath)).toEqual([]);
  });

  it("returns a redacted failed candidate when initial target continuity is lost", async () => {
    const options = await targetOptionsV1();
    await rm(options.targetInspection.canonicalRootPath, {
      recursive: true,
      force: true,
    });
    roots.delete(options.targetInspection.canonicalRootPath);

    const result = await runProviderRuntimeRealFilesystemConformanceV1(options);

    expect(result).toMatchObject({
      status: "candidate_failed",
      authority: "none",
      strongWriteStatus: "locked",
      registryEvidenceStatus: "pending_signed_registry_evidence",
      journalRevision: null,
      cases: [
        { caseId: "exact_object_write_read", outcome: "not_run", resultCode: "not_run" },
        { caseId: "immutable_no_replace_replay", outcome: "not_run", resultCode: "not_run" },
        { caseId: "external_compare_and_set", outcome: "not_run", resultCode: "not_run" },
        { caseId: "restart_recovery", outcome: "not_run", resultCode: "not_run" },
        { caseId: "target_continuity", outcome: "failed", resultCode: "root_not_found" },
      ],
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(options.targetInspection.canonicalRootPath);
    expect(serialized).not.toContain("lstat");
    expect(serialized).not.toContain("ENOENT");
  });
});
