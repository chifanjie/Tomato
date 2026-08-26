import {
  PathSafeRepositorySnapshotIdV1Schema,
  StrongVerificationRecordV1Schema,
  VerificationPlanEntryIdV1Schema,
} from "@understand-code/contracts";
import { describe, expect, it } from "vitest";

import { scanStrongVerificationDetailV1 } from "../src/strong-verification-detail.js";

const taskId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const snapshotId = PathSafeRepositorySnapshotIdV1Schema.parse(
  `snapshot-${"a".repeat(64)}`,
);
const planId = VerificationPlanEntryIdV1Schema.parse(
  `verification-plan:${"b".repeat(22)}`,
);
const equalityKey = Buffer.alloc(32, 7);
const equalityAuthority = () => ({
  provenance: "provider_installation_owner_v1" as const,
  async commit(domain: string, canonicalValue: string) {
    return `hmac-sha256:${createHmac("sha256", equalityKey)
      .update(domain, "utf8")
      .update("\0", "utf8")
      .update(canonicalValue, "utf8")
      .digest("hex")}`;
  },
});

function input(overrides: Record<string, unknown> = {}) {
  return {
    profile: "record_verification_strong_v1" as const,
    taskId,
    snapshotId,
    verificationPlanEntryId: planId,
    method: "test" as const,
    status: "passed" as const,
    claimIds: ["claim:acceptance"],
    command: {
      executable: "pnpm",
      arguments: ["test"],
      workingDirectory: "repository_root" as const,
      environmentKeys: ["CI"],
    },
    exitCode: 0,
    expectedRevision: 6,
    idempotencyKey: "verification-once",
    actor: "codex",
    ...overrides,
  };
}

const raw = (value: Uint8Array | string): string =>
  `base64url:${Buffer.from(value).toString("base64url")}`;

describe("strong Verification private detail scanner", () => {
  it("stores only a keyed commitment and safe digests, never raw output", async () => {
    const sentinel = "SAFE_RAW_SENTINEL_15C";
    const scanned = await scanStrongVerificationDetailV1(
      input({
        summary: "Focused package tests passed.",
        rawOutputBase64url: raw(sentinel),
      }),
      equalityAuthority(),
    );

    expect(scanned.detail).toMatchObject({ status: "stored" });
    expect(scanned.detailFields).toEqual([
      "command",
      "exit_code",
      "summary",
      "raw_output",
    ]);
    expect(scanned.ownerOnlyDetail).toMatchObject({
      outputDigest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
    });
    expect(JSON.stringify(scanned.ownerOnlyDetail)).not.toContain(
      "Focused package tests passed.",
    );
    expect(JSON.stringify(scanned.ownerOnlyDetail)).not.toContain(sentinel);
    expect(JSON.stringify(scanned.detail)).not.toContain(sentinel);

    const publicRecord = StrongVerificationRecordV1Schema.parse({
      profile: "verification_record_strong_v1",
      id: `verification-record:${"c".repeat(22)}`,
      taskId,
      verificationPlanEntryId: planId,
      contextGenerationId: `context-generation:${"d".repeat(22)}`,
      attempt: 1,
      method: "test",
      status: "passed",
      publicResultCode: "verification_passed",
      claimIds: ["claim:acceptance"],
      snapshotId,
      changeCheckArtifactId: `artifact:change_check:${taskId}`,
      changeCheckContentDigest: `sha256:${"e".repeat(64)}`,
      detail: scanned.detail,
      recordedAt: "2026-08-25T00:00:07.000Z",
    });
    expect(JSON.stringify(publicRecord)).not.toContain(sentinel);
    expect(
      StrongVerificationRecordV1Schema.safeParse({
        ...publicRecord,
        rawOutput: sentinel,
      }).success,
    ).toBe(false);
  });

  it.each([
    [
      "secret",
      { rawOutputBase64url: raw("Authorization: Bearer abcdefghijklmnop") },
      ["secret_detected"],
    ],
    [
      "host path",
      {
        command: {
          executable: "node",
          arguments: ["/Users/private/repository/test.mjs"],
          workingDirectory: "repository_root",
          environmentKeys: [],
        },
      },
      ["host_path_detected"],
    ],
    [
      "generic POSIX host path",
      {
        command: {
          executable: "node",
          arguments: ["/root/a", "/etc/a", "/opt/a", "/mnt/a", "/Volumes/a", "/workspace/a"],
          workingDirectory: "repository_root",
          environmentKeys: [],
        },
      },
      ["host_path_detected"],
    ],
    [
      "UNC host path",
      {
        command: {
          executable: "node",
          arguments: ["\\\\server\\share\\test.mjs"],
          workingDirectory: "repository_root",
          environmentKeys: [],
        },
      },
      ["host_path_detected"],
    ],
    ["control character", { summary: "bad\u0000summary" }, ["control_character"]],
    ["invalid UTF-8", { rawOutputBase64url: raw(Uint8Array.from([0xff])) }, ["invalid_utf8"]],
  ])("redacts %s without retaining a private detail", async (_name, overrides, codes) => {
    const scanned = await scanStrongVerificationDetailV1(
      input(overrides as Record<string, unknown>),
      equalityAuthority(),
    );
    expect(scanned.detail).toEqual({
      status: "redacted",
      redactionCodes: codes,
    });
    expect(scanned.ownerOnlyDetail).toBeUndefined();
    expect(JSON.stringify(scanned)).not.toContain("/Users/private");
    expect(JSON.stringify(scanned)).not.toContain("abcdefghijklmnop");
  });

  it("binds replay equality to the complete raw input without exposing it", async () => {
    const first = await scanStrongVerificationDetailV1(
      input({ rawOutputBase64url: raw("first output") }),
      equalityAuthority(),
    );
    const second = await scanStrongVerificationDetailV1(
      input({ rawOutputBase64url: raw("second output") }),
      equalityAuthority(),
    );
    expect(second.fullInputEqualityTag).not.toBe(first.fullInputEqualityTag);
    expect(second.detail).toEqual(first.detail);
    expect(second.ownerOnlyDetailCommitment).not.toBe(
      first.ownerOnlyDetailCommitment,
    );
    expect(JSON.stringify([first.detail, second.detail])).not.toContain("output");
  });

  it("recreates the composer with the same owner key without changing equality", async () => {
    const operation = input({ rawOutputBase64url: raw("stable replay input") });
    const first = await scanStrongVerificationDetailV1(operation, equalityAuthority());
    const afterRestart = await scanStrongVerificationDetailV1(
      operation,
      equalityAuthority(),
    );
    expect(afterRestart.fullInputEqualityTag).toBe(first.fullInputEqualityTag);
    expect(afterRestart.detail).toEqual(first.detail);
    expect(JSON.stringify(afterRestart)).not.toContain(equalityKey.toString("hex"));
    expect(JSON.stringify(afterRestart)).not.toContain("stable replay input");
  });
});
import { createHmac } from "node:crypto";
