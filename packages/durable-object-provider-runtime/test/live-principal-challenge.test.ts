import { randomBytes } from "node:crypto";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import {
  ContentDigestV1Schema,
  DurableObjectIdentityProviderIdV1Schema,
} from "@understand-code/durable-object-provider-contracts/primitives";
import type { ProviderMigrationDurableExecutionSummaryV1 } from "@understand-code/durable-object-provider-contracts/provider-migration-durable-execution";
import {
  ProviderStrongReadyAcceptanceGenerationPinCandidateV1Schema,
  ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema,
  deriveProviderStrongReadyAcceptanceStateContentDigestV1,
  deriveProviderStrongReadyAcceptanceStateGenerationIdV1,
} from "@understand-code/durable-object-provider-contracts/provider-strong-ready-acceptance-candidate";

import { diagnoseProviderRuntimeDurableExecutionPrincipalHeadV1 } from "../src/durable-execution-principal-head.js";
import {
  verifyProviderRuntimeLivePrincipalChallengeV1,
  verifyProviderRuntimeLivePrincipalKernelPeerChallengeV1,
} from "../src/live-principal-challenge.js";
import { DurableObjectProviderRuntimeServerV1 } from "../src/server.js";
import {
  createProviderServiceHandoffConfigV1,
  generateProviderServiceSigningKeyPairV1,
  type ProviderServiceHandoffConfigV1,
} from "../src/service-handoff.js";

const PROVIDER_ID = DurableObjectIdentityProviderIdV1Schema.parse(
  "durable-object-provider:principal-live-test",
);
const CAPABILITY_DIGEST = ContentDigestV1Schema.parse(
  `sha256:${"a".repeat(64)}`,
);
const INSTALLATION_DIGEST = ContentDigestV1Schema.parse(
  `sha256:${"b".repeat(64)}`,
);
const BINARY_DIGEST = ContentDigestV1Schema.parse(
  `sha256:${"c".repeat(64)}`,
);
const INSTALLATION_IDENTITY =
  `installation-identity-generation:${"d".repeat(22)}` as const;
const TARGET_PROFILE_ID = `provider-target-profile:${"e".repeat(64)}`;

const roots = new Set<string>();
const servers = new Set<DurableObjectProviderRuntimeServerV1>();

afterEach(async () => {
  await Promise.all([...servers].map((server) => server.close()));
  servers.clear();
  await Promise.all([...roots].map((root) => rm(root, { recursive: true, force: true })));
  roots.clear();
});

async function fixtureV1(input?: {
  readonly principalUid?: number;
}): Promise<{
  readonly config: ProviderServiceHandoffConfigV1;
  readonly server: DurableObjectProviderRuntimeServerV1;
  readonly authKey: Uint8Array;
}> {
  const root = await mkdtemp(join(tmpdir(), "uc-principal-live-"));
  roots.add(root);
  await chmod(root, 0o700);
  const signing = generateProviderServiceSigningKeyPairV1();
  const config = createProviderServiceHandoffConfigV1({
    privateKey: signing.privateKey,
    payload: {
      schemaVersion: 1,
      profile: "understand_code_provider_service_handoff_payload_v1",
      platform: process.platform === "darwin" ? "darwin" : "linux",
      serviceLabel: "uc-principal-live-test",
      providerId: PROVIDER_ID,
      principal: {
        kind: "dedicated_os_principal",
        name: "ucprovider",
        uid: input?.principalUid ?? process.getuid!(),
        gid: process.getgid!(),
      },
      runtimeRoot: root,
      socketPath: join(root, "runtime.sock"),
      executablePath: process.execPath,
      configPath: join(root, "service.json"),
      authKeyPath: join(root, "auth.key"),
      readinessPath: join(root, "readiness.json"),
      signingKeyPath: join(root, "signing.key"),
      installationIdentityDigest: INSTALLATION_DIGEST,
      binaryDigest: BINARY_DIGEST,
      capabilityDigest: CAPABILITY_DIGEST,
    },
  });
  const authKey = randomBytes(32);
  await writeFile(config.payload.authKeyPath, authKey, { mode: 0o600 });
  const server = new DurableObjectProviderRuntimeServerV1({
    rootPath: root,
    socketPath: config.payload.socketPath,
    providerId: PROVIDER_ID,
    authKey,
    authorizedCapabilityDigest: CAPABILITY_DIGEST,
    principalAttestation: {
      privateKey: signing.privateKey,
      handoffPayloadDigest: config.payloadDigest,
      publicKey: config.publicKey,
    },
  });
  await server.start();
  servers.add(server);
  return { config, server, authKey };
}

function finalAcceptanceV1() {
  const configuration = {
    state: "strong_ready" as const,
    core: {
      activeRootMetadata: {
        locatorProfile:
          "installation_provider_registry_root_metadata_v1" as const,
        rootGeneration: 1,
        rootKeyId: "1".repeat(22),
        contentDigest: `sha256:${"1".repeat(64)}` as const,
      },
      providerRegistryManifest: {
        locatorProfile:
          "installation_provider_registry_manifest_v1" as const,
        manifestGeneration: 1,
        generationId: `provider-registry-manifest:${"2".repeat(22)}`,
        contentDigest: `sha256:${"2".repeat(64)}` as const,
      },
      providerSupportCatalog: {
        locatorProfile:
          "distribution_provider_feasibility_support_catalog_v1" as const,
        catalogGeneration: 1,
        contentDigest: `sha256:${"3".repeat(64)}` as const,
      },
      activeWriterSelector: {
        profile: "provider_active_writer_selector_v1" as const,
        selections: [{
          targetProfileId: TARGET_PROFILE_ID,
          providerId: PROVIDER_ID,
          registryEntryContentDigest: `sha256:${"4".repeat(64)}` as const,
          semanticProviderPolicyDigest: `sha256:${"5".repeat(64)}` as const,
          providerFeasibilityEvidence: {
            locatorProfile:
              "installation_provider_feasibility_evidence_v1" as const,
            evidenceId: `provider-feasibility-evidence:${"6".repeat(22)}`,
            contentDigest: `sha256:${"6".repeat(64)}` as const,
          },
          runtimeAttestationContentDigest:
            `sha256:${"7".repeat(64)}` as const,
          bindingDerivationKeyGeneration: 1,
        }],
      },
    },
    activation: { origin: "bootstrap_or_steady_successor" as const },
  };
  const predecessor = { state: "genesis" as const };
  const generationId = deriveProviderStrongReadyAcceptanceStateGenerationIdV1({
    installationIdentityGenerationId: INSTALLATION_IDENTITY,
    acceptanceOrdinal: 1,
    predecessor,
    configuration,
  });
  const payload = {
    profile: "provider_acceptance_state_v1" as const,
    generationId,
    installationIdentityGenerationId: INSTALLATION_IDENTITY,
    acceptanceOrdinal: 1,
    predecessor,
    configuration,
    acceptedAt: "2026-08-18T09:00:00Z",
    acceptanceToken: `hmac-sha256:${"8".repeat(64)}`,
  };
  const envelope =
    ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema.parse({
      schemaVersion: 1,
      recordType: "provider_acceptance_state",
      generationId,
      installationIdentityGenerationId: INSTALLATION_IDENTITY,
      acceptedAt: payload.acceptedAt,
      contentDigest: deriveProviderStrongReadyAcceptanceStateContentDigestV1(
        payload,
      ),
      payload,
    });
  const pin =
    ProviderStrongReadyAcceptanceGenerationPinCandidateV1Schema.parse({
      locatorProfile: "installation_provider_acceptance_state_v1",
      acceptanceOrdinal: envelope.payload.acceptanceOrdinal,
      generationId: envelope.generationId,
      contentDigest: envelope.contentDigest,
    });
  return { envelope, pin };
}

describe("live provider principal challenge", () => {
  it("proves the signed handoff key is live without reading the HMAC key", async () => {
    const { config } = await fixtureV1();

    await expect(
      verifyProviderRuntimeLivePrincipalChallengeV1({
        config,
        expectedJournalRevision: 0,
        expectedJournalPhase: "uninitialized",
        expectedJournalMutationDigest: "none",
        expectedInstallationIdentityDigest: INSTALLATION_DIGEST,
      }),
    ).resolves.toEqual({
      status: "principal_key_live_candidate",
      authority: "none",
      accessMode: "read_only",
      strongWriteStatus: "locked",
      requiredNext: "kernel_os_peer_and_acceptance_token_gate",
      bindings: {
        providerId: PROVIDER_ID,
        capabilityDigest: CAPABILITY_DIGEST,
        handoffPayloadDigest: config.payloadDigest,
        servicePublicKey: config.publicKey,
        processId: process.pid,
        journalRevision: 0,
        journalPhase: "uninitialized",
        journalMutationDigest: "none",
      },
    });

    await expect(
      verifyProviderRuntimeLivePrincipalKernelPeerChallengeV1({
        config,
        expectedJournalRevision: 0,
        expectedJournalPhase: "uninitialized",
        expectedJournalMutationDigest: "none",
        expectedInstallationIdentityDigest: INSTALLATION_DIGEST,
      }),
    ).resolves.toMatchObject({
      status: "principal_key_and_kernel_os_peer_live_candidate",
      authority: "none",
      accessMode: "read_only",
      strongWriteStatus: "locked",
      requiredNext: "acceptance_identity_token_gate",
      principalKey: { bindings: { processId: process.pid } },
      kernelPeer: {
        authority: "none",
        accessMode: "read_only",
        strongWriteStatus: "locked",
        bindings: {
          uid: process.getuid!(),
          gid: process.getgid!(),
          pid: process.pid,
        },
      },
    });
  });

  it("rejects a different signed key and a different journal head", async () => {
    const { config } = await fixtureV1();
    const wrongSigning = generateProviderServiceSigningKeyPairV1();
    const wrongKeyConfig = createProviderServiceHandoffConfigV1({
      privateKey: wrongSigning.privateKey,
      payload: config.payload,
    });

    await expect(
      verifyProviderRuntimeLivePrincipalChallengeV1({
        config: wrongKeyConfig,
        expectedJournalRevision: 0,
        expectedJournalPhase: "uninitialized",
        expectedJournalMutationDigest: "none",
      }),
    ).resolves.toMatchObject({
      status: "unavailable",
      reason: "signature_invalid",
      strongWriteStatus: "locked",
    });

    await expect(
      verifyProviderRuntimeLivePrincipalChallengeV1({
        config,
        expectedJournalRevision: 0,
        expectedJournalPhase: "final_strong_ready",
        expectedJournalMutationDigest: "none",
      }),
    ).resolves.toMatchObject({
      status: "unavailable",
      reason: "binding_mismatch",
      strongWriteStatus: "locked",
    });

    const mismatched = await fixtureV1({
      principalUid: process.getuid!() + 1,
    });
    await expect(
      verifyProviderRuntimeLivePrincipalKernelPeerChallengeV1({
        config: mismatched.config,
        expectedJournalRevision: 0,
        expectedJournalPhase: "uninitialized",
        expectedJournalMutationDigest: "none",
      }),
    ).resolves.toEqual({
      status: "unavailable",
      authority: "none",
      accessMode: "read_only",
      strongWriteStatus: "locked",
      reason: "kernel_peer_identity_mismatch",
    });
  });

  it("binds a public durable execution result to the same live journal head", async () => {
    const { config, server, authKey } = await fixtureV1();
    const acceptance = finalAcceptanceV1();
    const committed = await server.store.compareCommit({
      expectedRevision: 0,
      operationNonce: "1".repeat(32),
      phase: "final_strong_ready",
      artifacts: {
        finalStrongReadyAcceptance: {
          finalStrongReadyAcceptanceEnvelope: acceptance.envelope,
          finalStrongReadyAcceptancePin: acceptance.pin,
        },
      },
    });
    expect(committed.resolution).toBe("committed");
    const state = server.store.inspectState();
    const execution: ProviderMigrationDurableExecutionSummaryV1 = {
      profile: "provider_migration_durable_execution_summary_v1" as const,
      durability:
        "separate_process_private_filesystem_durable_candidate_v1" as const,
      osIsolationAuthority:
        "not_yet_proven_service_principal_v1" as const,
      strongWriteCapability:
        "locked_to_verified_runtime_selection_v1" as const,
      sourceProviderId: "durable-object-provider:source",
      destinationProviderId: PROVIDER_ID,
      copiedObjectCount: 1,
      copiedLogicalBytes: 7,
      finalJournalRevision: state.revision,
      finalJournalPhase: "final_strong_ready",
      finalJournalMutationDigest: ContentDigestV1Schema.parse(
        state.mutationDigest,
      ),
      finalStrongReadyAcceptancePin: acceptance.pin,
    };

    await expect(
      diagnoseProviderRuntimeDurableExecutionPrincipalHeadV1({
        config,
        authKey,
        execution,
        expectedInstallationIdentityDigest: INSTALLATION_DIGEST,
      }),
    ).resolves.toMatchObject({
      ok: true,
      value: {
        status: "durable_execution_principal_head_candidate",
        authority: "none",
        strongWriteStatus: "locked",
        acceptanceTokenStatus: "not_verified",
        kernelPeerStatus: "not_verified",
        bindings: {
          providerId: PROVIDER_ID,
          journalRevision: state.revision,
          journalMutationDigest: state.mutationDigest,
          finalStrongReadyAcceptancePin:
            execution.finalStrongReadyAcceptancePin,
        },
      },
    });

    await expect(
      diagnoseProviderRuntimeDurableExecutionPrincipalHeadV1({
        config,
        authKey,
        execution: {
          ...execution,
          finalJournalMutationDigest: ContentDigestV1Schema.parse(
            `sha256:${"f".repeat(64)}`,
          ),
        },
      }),
    ).resolves.toEqual({
      ok: false,
      code: "provider_unavailable",
      reason: "attestation_invalid",
    });

    await expect(
      diagnoseProviderRuntimeDurableExecutionPrincipalHeadV1({
        config,
        authKey,
        execution: {
          ...execution,
          finalStrongReadyAcceptancePin:
            ProviderStrongReadyAcceptanceGenerationPinCandidateV1Schema.parse({
              ...execution.finalStrongReadyAcceptancePin,
              contentDigest: `sha256:${"f".repeat(64)}`,
            }),
        },
      }),
    ).resolves.toEqual({
      ok: false,
      code: "provider_unavailable",
      reason: "attestation_invalid",
    });
  });
});
