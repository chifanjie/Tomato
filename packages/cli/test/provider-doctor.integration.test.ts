import { randomUUID } from "node:crypto";
import { chmod, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { runProviderDoctorV1 } from "../src/provider/provider-doctor.js";

describe("Provider Doctor", () => {
  it(
    "verifies child IPC, fixed-locator storage, CAS, and restart while keeping strong authority locked",
    {
      skip:
        process.platform === "darwin" &&
        process.env.CODEX_SANDBOX === "seatbelt",
      timeout: 20_000,
    },
    async () => {
      const targetRoot = await mkdtemp(join(tmpdir(), "ucpd-target-"));
      // A normal workspace/volume target need not itself be a private runtime
      // directory. The doctor creates a private 0700 probe root underneath it.
      await chmod(targetRoot, 0o755);
      const result = await runProviderDoctorV1({ targetRoot });
      await rm(targetRoot, { recursive: true, force: true });

      expect(result).toMatchObject({
        ok: true,
        status: "durable_candidate",
        evidenceFreshness: "ephemeral_process_probe",
        strongStore: {
          available: false,
          authority: "read_only",
          reason: "os_principal_unverified",
          error: {
            code: "provider_unavailable",
            details: { reason: "attestation_invalid" },
          },
        },
        targetProbe: {
          status: "passed",
          continuity: "stable",
          rootMode: "owner_only_0700",
          isolation: "same_uid_private_directory",
          targetFingerprintDigest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
        },
        conformance: {
          status: "candidate_passed",
          authority: "none",
          strongWriteStatus: "locked",
          registryEvidenceStatus: "pending_signed_registry_evidence",
        },
        runtime: {
          isolation: "two_child_processes",
          authenticatedIpc: "passed",
          fixedLocatorObject: "passed",
          compareCommit: "passed",
          restartRecovery: "passed",
          finalJournalRevision: 1,
        },
      });
      if (!result.ok) throw new Error("provider doctor fixture unexpectedly failed");
      expect(result.conformance.cases).toEqual(
        expect.arrayContaining([
          { caseId: "exact_object_write_read", outcome: "passed", resultCode: "passed" },
          { caseId: "restart_recovery", outcome: "passed", resultCode: "passed" },
        ]),
      );
    },
  );

  it("returns the opaque provider_unavailable result when a runtime cannot start", async () => {
    const targetRoot = await mkdtemp(join(tmpdir(), "ucpd-failure-target-"));
    const result = await runProviderDoctorV1({
      targetRoot,
      serviceConfigPath: join(targetRoot, "missing-service-config.json"),
      serviceReadinessPath: join(targetRoot, "missing-service-readiness.json"),
      runtimeCommand: {
        entrypoint: join(tmpdir(), `missing-provider-runtime-${randomUUID()}.mjs`),
        argumentPrefix: [],
      },
      readyTimeoutMs: 500,
    });
    await rm(targetRoot, { recursive: true, force: true });

    expect(result).toMatchObject({
      ok: false,
      status: "unavailable",
      evidenceFreshness: "ephemeral_target_probe",
      strongStore: {
        available: false,
        authority: "read_only",
        reason: "runtime_probe_failed",
        error: {
          code: "provider_unavailable",
          details: { reason: "unavailable" },
        },
      },
      targetProbe: {
        status: "passed",
        continuity: "stable",
        rootMode: "owner_only_0700",
        isolation: "same_uid_private_directory",
        targetFingerprintDigest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
      },
      service: {
        status: "unavailable",
        authority: "read_only",
        strongWrites: "locked",
        reason: "service_not_provisioned",
      },
      runtime: { probe: "failed" },
    });
  });
});
