import { createHash, randomBytes, randomUUID } from "node:crypto";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import {
  ContentDigestV1Schema,
  DurableObjectIdentityProviderIdV1Schema,
} from "@understand-code/durable-object-provider-contracts/primitives";
import {
  DurableObjectProviderRuntimeServerV1,
  createProviderServiceHandoffConfigV1,
  createProviderServiceReadinessReceiptV1,
  generateProviderServiceSigningKeyPairV1,
  probeProviderRuntimeTargetV1,
} from "@understand-code/durable-object-provider-runtime";

import { runProviderDoctorV1 } from "../src/provider/provider-doctor.js";

const SERVICE_PROVIDER_ID = DurableObjectIdentityProviderIdV1Schema.parse(
  "durable-object-provider:doctor-kernel-peer",
);
const SERVICE_CAPABILITY_DIGEST = ContentDigestV1Schema.parse(
  `sha256:${"a".repeat(64)}`,
);
const SERVICE_INSTALLATION_DIGEST = ContentDigestV1Schema.parse(
  `sha256:${"b".repeat(64)}`,
);

async function executableDigestV1(path: string) {
  return ContentDigestV1Schema.parse(
    `sha256:${createHash("sha256")
      .update(await readFile(path))
      .digest("hex")}`,
  );
}

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

  it(
    "projects a redacted kernel peer candidate over the exact live service journal head",
    {
      skip:
        process.platform === "darwin" &&
        process.env.CODEX_SANDBOX === "seatbelt",
      timeout: 30_000,
    },
    async () => {
      const targetRoot = await mkdtemp(join(tmpdir(), "ucpd-kernel-target-"));
      const serviceRoot = await mkdtemp(join(tmpdir(), "ucpd-kernel-service-"));
      await chmod(serviceRoot, 0o700);
      const signing = generateProviderServiceSigningKeyPairV1();
      const authKey = randomBytes(32);
      const config = createProviderServiceHandoffConfigV1({
        privateKey: signing.privateKey,
        payload: {
          schemaVersion: 1,
          profile: "understand_code_provider_service_handoff_payload_v1",
          platform: process.platform === "darwin" ? "darwin" : "linux",
          serviceLabel: "uc-doctor-kernel-peer",
          providerId: SERVICE_PROVIDER_ID,
          principal: {
            kind: "dedicated_os_principal",
            name: "ucprovider",
            uid: process.getuid!(),
            gid: process.getgid!(),
          },
          runtimeRoot: serviceRoot,
          socketPath: join(serviceRoot, "runtime.sock"),
          executablePath: process.execPath,
          configPath: join(serviceRoot, "service.json"),
          authKeyPath: join(serviceRoot, "auth.key"),
          readinessPath: join(serviceRoot, "readiness.json"),
          signingKeyPath: join(serviceRoot, "signing.key"),
          installationIdentityDigest: SERVICE_INSTALLATION_DIGEST,
          binaryDigest: await executableDigestV1(process.execPath),
          capabilityDigest: SERVICE_CAPABILITY_DIGEST,
        },
      });
      await writeFile(config.payload.configPath, `${JSON.stringify(config)}\n`, {
        mode: 0o644,
      });
      await writeFile(config.payload.authKeyPath, authKey, { mode: 0o600 });
      const server = new DurableObjectProviderRuntimeServerV1({
        rootPath: serviceRoot,
        socketPath: config.payload.socketPath,
        providerId: SERVICE_PROVIDER_ID,
        authKey,
        authorizedCapabilityDigest: SERVICE_CAPABILITY_DIGEST,
        principalAttestation: {
          privateKey: signing.privateKey,
          handoffPayloadDigest: config.payloadDigest,
          publicKey: config.publicKey,
        },
      });

      try {
        await server.start();
        const target = await probeProviderRuntimeTargetV1(serviceRoot);
        const readiness = createProviderServiceReadinessReceiptV1({
          config,
          observedUid: process.getuid!(),
          observedGid: process.getgid!(),
          targetFingerprintDigest: ContentDigestV1Schema.parse(
            target.targetFingerprintDigest,
          ),
          nonce: randomBytes(16),
          privateKey: signing.privateKey,
        });
        await writeFile(
          config.payload.readinessPath,
          `${JSON.stringify(readiness)}\n`,
          { mode: 0o600 },
        );

        const result = await runProviderDoctorV1({
          targetRoot,
          serviceConfigPath: config.payload.configPath,
          serviceReadinessPath: config.payload.readinessPath,
          expectedInstallationIdentityDigest: SERVICE_INSTALLATION_DIGEST,
          // A same-UID test process cannot manufacture the dedicated-principal
          // ownership that production readiness requires. Keep the real UDS,
          // signed handoff, authenticated head read, and native peer syscall;
          // replace only that privileged receipt ownership observation.
          liveReadinessReader: async () => ({
            status: "signed_candidate",
            authority: "read_only",
            strongWrites: "locked",
            platform: process.platform === "darwin" ? "darwin" : "linux",
            serviceLabel: config.payload.serviceLabel,
            providerId: SERVICE_PROVIDER_ID,
            principalUid: config.payload.principal.uid,
            targetFingerprintDigest: ContentDigestV1Schema.parse(
              target.targetFingerprintDigest,
            ),
          }),
        });

        expect(result).toMatchObject({
          ok: true,
          status: "durable_candidate",
          strongStore: {
            available: false,
            authority: "read_only",
            reason: "acceptance_identity_unverified",
          },
          service: {
            status: "valid_unprovisioned",
            authority: "read_only",
            strongWrites: "locked",
          },
          liveReadiness: {
            status: "live_candidate",
            authority: "read_only",
            strongWrites: "locked",
            inspectedRevision: 0,
          },
          kernelPeerIdentity: {
            status: "candidate",
            authority: "none",
            accessMode: "read_only",
            strongWrites: "locked",
            mechanism:
              process.platform === "linux"
                ? "linux_so_peercred"
                : "darwin_getpeereid_local_peercred_peerpid",
            identityBinding: "exact",
            journalHead: "exact",
            requiredNext: "acceptance_identity_token_gate",
          },
        });
        expect(JSON.stringify(result.kernelPeerIdentity)).not.toContain(
          `\"uid\":${process.getuid!()}`,
        );
        expect(JSON.stringify(result.kernelPeerIdentity)).not.toContain(
          `\"gid\":${process.getgid!()}`,
        );
        expect(JSON.stringify(result.kernelPeerIdentity)).not.toContain(
          `\"pid\":${process.pid}`,
        );
      } finally {
        authKey.fill(0);
        await server.close();
        await Promise.all([
          rm(targetRoot, { recursive: true, force: true }),
          rm(serviceRoot, { recursive: true, force: true }),
        ]);
      }
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
      liveReadiness: {
        status: "unavailable",
        authority: "read_only",
        strongWrites: "locked",
        reason: "invalid_config",
      },
      kernelPeerIdentity: {
        status: "unavailable",
        authority: "none",
        accessMode: "read_only",
        strongWrites: "locked",
        reason: "unavailable",
      },
      runtime: { probe: "failed" },
    });
  });
});
