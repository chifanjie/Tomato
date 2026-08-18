import {
  createHash,
  createHmac,
  createPublicKey,
  randomBytes,
  verify,
} from "node:crypto";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createConnection, type Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CanonicalByteStringV1Schema,
  ContentDigestV1Schema,
  DurableObjectIdentityProviderIdV1Schema,
  InstallationIdentityGenerationIdV1Schema,
  KeyedStateTokenV1Schema,
  LowerHex32V1Schema,
} from "@understand-code/durable-object-provider-contracts/primitives";
import {
  canonicalizeJcsSafeIntegerUtf8V1,
} from "@understand-code/durable-object-provider-contracts/jcs";
import {
  mintProviderServiceInstallationIdentityVerificationCapabilityInternalV1,
} from "@understand-code/durable-object-provider-contracts/provider-service-installation-identity-custody-internal";
import type { ProviderMigrationDurableExecutionSummaryV1 } from "@understand-code/durable-object-provider-contracts/provider-migration-durable-execution";
import {
  ProviderStrongReadyAcceptanceGenerationPinCandidateV1Schema,
  ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema,
  PROVIDER_ACCEPTANCE_STATE_TOKEN_DOMAIN_V1,
  deriveProviderStrongReadyAcceptanceStateContentDigestV1,
  deriveProviderStrongReadyAcceptanceStateGenerationIdV1,
} from "@understand-code/durable-object-provider-contracts/provider-strong-ready-acceptance-candidate";
import {
  PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
  ProviderRuntimeIpcClientHelloV1Schema,
  ProviderRuntimeIpcPrincipalAttestationV1Schema,
  ProviderRuntimeIpcPrincipalChallengeV1Schema,
  ProviderRuntimeIpcRequestV1Schema,
  ProviderRuntimeIpcResponseV1Schema,
  ProviderRuntimeIpcServerHelloV1Schema,
  ProviderRuntimeIpcStrongMutationRequestClaimsV1Schema,
  ProviderRuntimeIpcStrongMutationRequestV1Schema,
  ProviderRuntimeIpcStrongMutationResponseV1Schema,
  canonicalizeProviderRuntimeIpcAuthenticatedClaimsV1,
  canonicalizeProviderRuntimeIpcPrincipalAttestationTranscriptV1,
  canonicalizeProviderRuntimeIpcStrongMutationRequestV1,
  canonicalizeProviderRuntimeIpcStrongMutationResponseClaimsV1,
  canonicalizeProviderRuntimeIpcStrongMutationSessionBindingV1,
} from "@understand-code/durable-object-provider-contracts/provider-runtime-ipc-v1";

import { diagnoseProviderRuntimeDurableExecutionPrincipalHeadV1 } from "../src/durable-execution-principal-head.js";
import {
  verifyProviderRuntimeLivePrincipalChallengeV1,
  verifyProviderRuntimeLivePrincipalKernelAcceptanceIdentityChallengeV1,
  verifyProviderRuntimeLivePrincipalKernelPeerChallengeV1,
} from "../src/live-principal-challenge.js";
import { DurableObjectProviderRuntimeServerV1 } from "../src/server.js";
import {
  mintProviderRuntimeStrongMutationAuthorityVerifierCapabilityInternalV1,
} from "../src/strong-mutation-session-authority-internal.js";
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
  "installation-identity-generation:4fe634940e20afac35e02d" as const;
const TARGET_PROFILE_ID = `provider-target-profile:${"e".repeat(64)}`;
const INSTALLATION_IDENTITY_KEY = new Uint8Array(
  Array.from({ length: 32 }, (_value, index) => index),
);

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
  readonly acceptanceIdentityVerificationCapability?: ConstructorParameters<
    typeof DurableObjectProviderRuntimeServerV1
  >[0]["acceptanceIdentityVerificationCapability"];
  readonly mutationPolicy?: ConstructorParameters<
    typeof DurableObjectProviderRuntimeServerV1
  >[0]["mutationPolicy"];
  readonly strongMutationAuthorityVerifier?: ConstructorParameters<
    typeof DurableObjectProviderRuntimeServerV1
  >[0]["strongMutationAuthorityVerifier"];
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
    acceptanceIdentityVerificationCapability:
      input?.acceptanceIdentityVerificationCapability,
    mutationPolicy: input?.mutationPolicy,
    strongMutationAuthorityVerifier:
      input?.strongMutationAuthorityVerifier,
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
  const unsigned = {
    profile: "provider_acceptance_state_v1" as const,
    generationId,
    installationIdentityGenerationId: INSTALLATION_IDENTITY,
    acceptanceOrdinal: 1,
    predecessor,
    configuration,
    acceptedAt: "2026-08-18T09:00:00Z",
  };
  const acceptanceToken = KeyedStateTokenV1Schema.parse(
    `hmac-sha256:${createHmac("sha256", INSTALLATION_IDENTITY_KEY)
      .update(
        canonicalizeJcsSafeIntegerUtf8V1([
          PROVIDER_ACCEPTANCE_STATE_TOKEN_DOMAIN_V1,
          unsigned,
        ]),
      )
      .digest("hex")}`,
  );
  const payload = { ...unsigned, acceptanceToken };
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

async function identityVerificationCapabilityV1() {
  return mintProviderServiceInstallationIdentityVerificationCapabilityInternalV1({
    installationIdentityKey: INSTALLATION_IDENTITY_KEY.slice(),
    initializationNonce: LowerHex32V1Schema.parse(
      "000102030405060708090a0b0c0d0e0f",
    ),
    installationIdentityGenerationId:
      InstallationIdentityGenerationIdV1Schema.parse(INSTALLATION_IDENTITY),
    keyCheckToken: KeyedStateTokenV1Schema.parse(
      "hmac-sha256:9b585cbb13d23ae739df3988278dfdc09ed612ccd8af853ac26f570bc8ce2eef",
    ),
  });
}

function acceptanceIdentityProofV1(
  acceptance: ReturnType<typeof finalAcceptanceV1>,
) {
  return {
    generationId: acceptance.envelope.generationId,
    contentDigest: acceptance.envelope.contentDigest,
    acceptanceOrdinal: acceptance.envelope.payload.acceptanceOrdinal,
    installationIdentityGenerationId:
      acceptance.envelope.installationIdentityGenerationId,
  };
}

function sha256V1(bytes: Uint8Array) {
  return ContentDigestV1Schema.parse(
    `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
  );
}

async function connectSocketV1(socketPath: string): Promise<Socket> {
  return new Promise<Socket>((resolvePromise, rejectPromise) => {
    const socket = createConnection(socketPath);
    socket.once("connect", () => resolvePromise(socket));
    socket.once("error", rejectPromise);
  });
}

async function openStrongContinuationV1(
  socketPath: string,
  challengeValue = randomBytes(32).toString("hex"),
) {
  const socket = await connectSocketV1(socketPath);
  const lines = createInterface({ input: socket, crlfDelay: Infinity });
  const iterator = lines[Symbol.asyncIterator]();
  const challenge = ProviderRuntimeIpcPrincipalChallengeV1Schema.parse({
    protocol: PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
    kind: "principal_challenge",
    challenge: challengeValue,
    acceptanceIdentityProofRequested: true,
    sessionContinuationRequested: true,
  });
  socket.write(`${JSON.stringify(challenge)}\n`);
  const line = await iterator.next();
  if (line.done) throw new Error("principal continuation closed");
  const attestation = ProviderRuntimeIpcPrincipalAttestationV1Schema.parse(
    JSON.parse(line.value),
  );
  return { socket, lines, iterator, attestation };
}

function signHmacWireV1<T extends Readonly<Record<string, unknown>>>(
  authKey: Uint8Array,
  unsigned: T,
) {
  const placeholder = {
    ...unsigned,
    authTag: `hmac-sha256:${"0".repeat(64)}`,
  } as unknown as Parameters<
    typeof canonicalizeProviderRuntimeIpcAuthenticatedClaimsV1
  >[0];
  return {
    ...unsigned,
    authTag: `hmac-sha256:${createHmac("sha256", authKey)
      .update(canonicalizeProviderRuntimeIpcAuthenticatedClaimsV1(placeholder))
      .digest("hex")}`,
  };
}

async function callHmacCompareCommitV1(
  socketPath: string,
  authKey: Uint8Array,
  payload: {
    readonly expectedRevision: number;
    readonly operationNonce: string;
    readonly phase: string;
    readonly artifacts: Readonly<Record<string, unknown>>;
  },
) {
  const socket = await connectSocketV1(socketPath);
  const lines = createInterface({ input: socket, crlfDelay: Infinity });
  const iterator = lines[Symbol.asyncIterator]();
  try {
    const clientNonce = randomBytes(32).toString("hex");
    const hello = ProviderRuntimeIpcClientHelloV1Schema.parse(
      signHmacWireV1(authKey, {
        protocol: PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
        kind: "client_hello",
        clientNonce,
        capabilityDigest: CAPABILITY_DIGEST,
      }),
    );
    socket.write(`${JSON.stringify(hello)}\n`);
    const helloLine = await iterator.next();
    if (helloLine.done) throw new Error("runtime closed before HMAC hello");
    const serverHello = ProviderRuntimeIpcServerHelloV1Schema.parse(
      JSON.parse(helloLine.value),
    );
    const request = ProviderRuntimeIpcRequestV1Schema.parse(
      signHmacWireV1(authKey, {
        protocol: PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
        kind: "request",
        sessionId: serverHello.sessionId,
        requestId: randomBytes(16).toString("hex"),
        sequence: 1,
        capabilityDigest: CAPABILITY_DIGEST,
        operation: "compare_commit",
        payload,
      }),
    );
    socket.write(`${JSON.stringify(request)}\n`);
    const responseLine = await iterator.next();
    if (responseLine.done) throw new Error("runtime closed before HMAC response");
    return ProviderRuntimeIpcResponseV1Schema.parse(
      JSON.parse(responseLine.value),
    );
  } finally {
    lines.close();
    socket.destroy();
  }
}

function strongWriteRequestV1(
  attestation: ReturnType<
    typeof ProviderRuntimeIpcPrincipalAttestationV1Schema.parse
  >,
  bytes: Uint8Array,
  nonceDigit: string,
) {
  const operationNonce = LowerHex32V1Schema.parse(nonceDigit.repeat(32));
  const payload = {
    locator: {
      providerId: PROVIDER_ID,
      contentDigest: sha256V1(bytes),
    },
    logicalBytes: bytes.byteLength,
    bytes: CanonicalByteStringV1Schema.parse(
      `base64url:${Buffer.from(bytes).toString("base64url")}`,
    ),
  };
  const requestDigest = sha256V1(
    canonicalizeProviderRuntimeIpcStrongMutationRequestV1(
      ProviderRuntimeIpcStrongMutationRequestClaimsV1Schema.parse({
        operation: "write_object",
        operationNonce,
        payload,
      }),
    ),
  );
  const principalAttestationDigest = sha256V1(
    canonicalizeProviderRuntimeIpcPrincipalAttestationTranscriptV1(
      attestation,
    ),
  );
  const authorityGrant = CanonicalByteStringV1Schema.parse("base64url:AQ");
  const bindingDigest = sha256V1(
    canonicalizeProviderRuntimeIpcStrongMutationSessionBindingV1({
      principalAttestationDigest,
      operation: "write_object",
      operationNonce,
      requestDigest,
      authorityGrant,
    }),
  );
  return ProviderRuntimeIpcStrongMutationRequestV1Schema.parse({
    protocol: PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
    kind: "strong_mutation_request",
    requestId: randomBytes(16).toString("hex"),
    principalAttestationDigest,
    bindingDigest,
    operation: "write_object",
    operationNonce,
    requestDigest,
    authorityGrant,
    payload,
  });
}

function verifyStrongResponseSignatureV1(
  publicKeyValue: string,
  response: ReturnType<
    typeof ProviderRuntimeIpcStrongMutationResponseV1Schema.parse
  >,
): boolean {
  const publicKey = createPublicKey({
    key: Buffer.from(publicKeyValue.slice("base64url:".length), "base64url"),
    format: "der",
    type: "spki",
  });
  return verify(
    null,
    canonicalizeProviderRuntimeIpcStrongMutationResponseClaimsV1(response),
    publicKey,
    Buffer.from(response.signature.slice("base64url:".length), "base64url"),
  );
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

  it("joins the kernel peer and signed current Acceptance identity on one socket", async () => {
    const { config, server } = await fixtureV1({
      acceptanceIdentityVerificationCapability:
        await identityVerificationCapabilityV1(),
    });
    const acceptance = finalAcceptanceV1();
    await server.store.compareCommit({
      expectedRevision: 0,
      operationNonce: "2".repeat(32),
      phase: "final_strong_ready",
      artifacts: {
        finalStrongReadyAcceptance: {
          finalStrongReadyAcceptanceEnvelope: acceptance.envelope,
          finalStrongReadyAcceptancePin: acceptance.pin,
        },
      },
    });
    const state = server.store.inspectState();

    await expect(
      verifyProviderRuntimeLivePrincipalKernelPeerChallengeV1({
        config,
        expectedJournalRevision: state.revision,
        expectedJournalPhase: state.phase,
        expectedJournalMutationDigest: state.mutationDigest,
      }),
    ).resolves.toMatchObject({
      status: "principal_key_and_kernel_os_peer_live_candidate",
      strongWriteStatus: "locked",
    });

    await expect(
      verifyProviderRuntimeLivePrincipalKernelAcceptanceIdentityChallengeV1({
        config,
        expectedJournalRevision: state.revision,
        expectedJournalPhase: state.phase,
        expectedJournalMutationDigest: state.mutationDigest,
        expectedInstallationIdentityDigest: INSTALLATION_DIGEST,
        expectedAcceptanceIdentity: acceptanceIdentityProofV1(acceptance),
      }),
    ).resolves.toMatchObject({
      status:
        "principal_key_kernel_os_peer_and_acceptance_identity_live_candidate",
      authority: "none",
      accessMode: "read_only",
      strongWriteStatus: "locked",
      requiredNext: "final_acceptance_authority_closeout",
      principalKey: { bindings: { processId: process.pid } },
      kernelPeer: { bindings: { pid: process.pid } },
      acceptanceIdentity: acceptanceIdentityProofV1(acceptance),
    });
  });

  it("returns one locked failure when the signed Acceptance proof is absent or mismatched", async () => {
    const missing = await fixtureV1();
    const acceptance = finalAcceptanceV1();
    await missing.server.store.compareCommit({
      expectedRevision: 0,
      operationNonce: "3".repeat(32),
      phase: "final_strong_ready",
      artifacts: {
        finalStrongReadyAcceptance: {
          finalStrongReadyAcceptanceEnvelope: acceptance.envelope,
          finalStrongReadyAcceptancePin: acceptance.pin,
        },
      },
    });
    const missingState = missing.server.store.inspectState();
    const options = {
      config: missing.config,
      expectedJournalRevision: missingState.revision,
      expectedJournalPhase: missingState.phase,
      expectedJournalMutationDigest: missingState.mutationDigest,
      expectedAcceptanceIdentity: acceptanceIdentityProofV1(acceptance),
    };

    await expect(
      verifyProviderRuntimeLivePrincipalKernelAcceptanceIdentityChallengeV1(
        options,
      ),
    ).resolves.toEqual({
      status: "unavailable",
      authority: "none",
      accessMode: "read_only",
      strongWriteStatus: "locked",
      reason: "acceptance_identity_invalid",
    });

    const valid = await fixtureV1({
      acceptanceIdentityVerificationCapability:
        await identityVerificationCapabilityV1(),
    });
    await valid.server.store.compareCommit({
      expectedRevision: 0,
      operationNonce: "4".repeat(32),
      phase: "final_strong_ready",
      artifacts: {
        finalStrongReadyAcceptance: {
          finalStrongReadyAcceptanceEnvelope: acceptance.envelope,
          finalStrongReadyAcceptancePin: acceptance.pin,
        },
      },
    });
    const validState = valid.server.store.inspectState();
    await expect(
      verifyProviderRuntimeLivePrincipalKernelAcceptanceIdentityChallengeV1({
        ...options,
        config: valid.config,
        expectedJournalRevision: validState.revision,
        expectedJournalMutationDigest: validState.mutationDigest,
        expectedAcceptanceIdentity: {
          ...options.expectedAcceptanceIdentity,
          contentDigest: ContentDigestV1Schema.parse(
            `sha256:${"f".repeat(64)}`,
          ),
        },
      }),
    ).resolves.toMatchObject({
      status: "unavailable",
      strongWriteStatus: "locked",
      reason: "acceptance_identity_invalid",
    });
  });

  it("executes one grant-consumed strong mutation without reading the service HMAC key", async () => {
    const verifierCapability =
      mintProviderRuntimeStrongMutationAuthorityVerifierCapabilityInternalV1({
        consumeGrant(context) {
          return context.authorityGrant === "base64url:AQ" &&
            context.journalHead.phase === "final_strong_ready";
        },
      });
    const { config, server } = await fixtureV1({
      acceptanceIdentityVerificationCapability:
        await identityVerificationCapabilityV1(),
      mutationPolicy: "acceptance_authority_session_required",
      strongMutationAuthorityVerifier: verifierCapability,
    });
    const acceptance = finalAcceptanceV1();
    await server.store.compareCommit({
      expectedRevision: 0,
      operationNonce: "7".repeat(32),
      phase: "final_strong_ready",
      artifacts: {
        finalStrongReadyAcceptance: {
          finalStrongReadyAcceptanceEnvelope: acceptance.envelope,
          finalStrongReadyAcceptancePin: acceptance.pin,
        },
      },
    });

    const continuation = await openStrongContinuationV1(server.socketPath);
    try {
      expect(continuation.attestation.acceptanceIdentity).toEqual(
        acceptanceIdentityProofV1(acceptance),
      );
      const request = strongWriteRequestV1(
        continuation.attestation,
        Buffer.from("non-HMAC authorized object", "utf8"),
        "8",
      );
      continuation.socket.write(`${JSON.stringify(request)}\n`);
      const line = await continuation.iterator.next();
      expect(line.done).toBe(false);
      const response =
        ProviderRuntimeIpcStrongMutationResponseV1Schema.parse(
          JSON.parse(line.value!),
        );
      expect(response).toMatchObject({
        ok: true,
        operation: "write_object",
        requestId: request.requestId,
        principalAttestationDigest: request.principalAttestationDigest,
        bindingDigest: request.bindingDigest,
        requestDigest: request.requestDigest,
        payload: { operation: "write_object", resolution: "committed" },
      });
      expect(verifyStrongResponseSignatureV1(config.publicKey, response)).toBe(
        true,
      );
    } finally {
      continuation.lines.close();
      continuation.socket.destroy();
    }
  });

  it("binds an unconsumed exact request to its original continuation socket", async () => {
    let consumeCalls = 0;
    const consumedGrants = new Set<string>();
    const verifierCapability =
      mintProviderRuntimeStrongMutationAuthorityVerifierCapabilityInternalV1({
        consumeGrant(context) {
          consumeCalls += 1;
          if (consumedGrants.has(context.authorityGrant)) return false;
          consumedGrants.add(context.authorityGrant);
          return true;
        },
      });
    const { server } = await fixtureV1({
      acceptanceIdentityVerificationCapability:
        await identityVerificationCapabilityV1(),
      mutationPolicy: "acceptance_authority_session_required",
      strongMutationAuthorityVerifier: verifierCapability,
    });
    const acceptance = finalAcceptanceV1();
    await server.store.compareCommit({
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

    const challenge = "2".repeat(64);
    const first = await openStrongContinuationV1(server.socketPath, challenge);
    const request = strongWriteRequestV1(
      first.attestation,
      Buffer.from("one socket-bound committed object", "utf8"),
      "3",
    );
    const transplanted = await openStrongContinuationV1(
      server.socketPath,
      challenge,
    );
    const writeObject = vi.spyOn(server.store, "writeFixedObject");
    try {
      expect(first.attestation.connectionNonce).toMatch(/^[0-9a-f]{64}$/u);
      expect(transplanted.attestation.connectionNonce).toMatch(
        /^[0-9a-f]{64}$/u,
      );
      expect(transplanted.attestation.connectionNonce).not.toBe(
        first.attestation.connectionNonce,
      );
      expect(transplanted.attestation).not.toEqual(first.attestation);

      transplanted.socket.write(`${JSON.stringify(request)}\n`);
      const transplantedLine = await transplanted.iterator.next();
      expect(transplantedLine.done).toBe(false);
      expect(
        ProviderRuntimeIpcStrongMutationResponseV1Schema.parse(
          JSON.parse(transplantedLine.value!),
        ),
      ).toMatchObject({
        ok: false,
        bindingDigest: request.bindingDigest,
        error: { code: "capability_mismatch" },
      });
      expect(consumeCalls).toBe(0);
      expect(writeObject).not.toHaveBeenCalled();

      first.socket.write(`${JSON.stringify(request)}\n`);
      const firstLine = await first.iterator.next();
      expect(firstLine.done).toBe(false);
      expect(
        ProviderRuntimeIpcStrongMutationResponseV1Schema.parse(
          JSON.parse(firstLine.value!),
        ),
      ).toMatchObject({
        ok: true,
        bindingDigest: request.bindingDigest,
      });
      expect(consumeCalls).toBe(1);
      expect(consumedGrants).toEqual(new Set([request.authorityGrant]));
      expect(writeObject).toHaveBeenCalledTimes(1);
    } finally {
      first.lines.close();
      first.socket.destroy();
      transplanted.lines.close();
      transplanted.socket.destroy();
    }
  });

  it("rechecks the attested head after a queued plain wire mutation commits", async () => {
    let consumeCalls = 0;
    const verifierCapability =
      mintProviderRuntimeStrongMutationAuthorityVerifierCapabilityInternalV1({
        consumeGrant() {
          consumeCalls += 1;
          return true;
        },
      });
    const { server, authKey } = await fixtureV1({
      acceptanceIdentityVerificationCapability:
        await identityVerificationCapabilityV1(),
      mutationPolicy: "hmac_candidate",
      strongMutationAuthorityVerifier: verifierCapability,
    });
    const acceptance = finalAcceptanceV1();
    await server.store.compareCommit({
      expectedRevision: 0,
      operationNonce: "4".repeat(32),
      phase: "final_strong_ready",
      artifacts: {
        finalStrongReadyAcceptance: {
          finalStrongReadyAcceptanceEnvelope: acceptance.envelope,
          finalStrongReadyAcceptancePin: acceptance.pin,
        },
      },
    });
    const continuation = await openStrongContinuationV1(server.socketPath);
    const request = strongWriteRequestV1(
      continuation.attestation,
      Buffer.from("must remain absent after queued head drift", "utf8"),
      "5",
    );

    let signalPlainEntered!: () => void;
    const plainEntered = new Promise<void>((resolvePromise) => {
      signalPlainEntered = resolvePromise;
    });
    let releasePlain!: () => void;
    const plainRelease = new Promise<void>((resolvePromise) => {
      releasePlain = resolvePromise;
    });
    const compareCommit = server.store.compareCommit.bind(server.store);
    vi.spyOn(server.store, "compareCommit").mockImplementationOnce(
      async (input) => {
        signalPlainEntered();
        await plainRelease;
        return compareCommit(input);
      },
    );
    const plainCommit = callHmacCompareCommitV1(
      server.socketPath,
      authKey,
      {
        expectedRevision: 1,
        operationNonce: "6".repeat(32),
        phase: "plain_wire_won_queue",
        artifacts: { winner: "plain" },
      },
    );
    await plainEntered;

    let signalStrongPrecheck!: () => void;
    const strongPrechecked = new Promise<void>((resolvePromise) => {
      signalStrongPrecheck = resolvePromise;
    });
    const inspectState = server.store.inspectState.bind(server.store);
    vi.spyOn(server.store, "inspectState").mockImplementation(() => {
      signalStrongPrecheck();
      return inspectState();
    });
    const writeObject = vi.spyOn(server.store, "writeFixedObject");
    try {
      continuation.socket.write(`${JSON.stringify(request)}\n`);
      await strongPrechecked;
      releasePlain();
      await expect(plainCommit).resolves.toMatchObject({
        ok: true,
        payload: {
          operation: "compare_commit",
          state: { revision: 2, phase: "plain_wire_won_queue" },
        },
      });
      const strongLine = await continuation.iterator.next();
      expect(strongLine.done).toBe(false);
      expect(
        ProviderRuntimeIpcStrongMutationResponseV1Schema.parse(
          JSON.parse(strongLine.value!),
        ),
      ).toMatchObject({
        ok: false,
        error: { code: "capability_mismatch" },
      });
      expect(consumeCalls).toBe(0);
      expect(writeObject).not.toHaveBeenCalled();
    } finally {
      releasePlain();
      continuation.lines.close();
      continuation.socket.destroy();
    }
  });

  it("keeps a public grant and signed proof locked when no verifier is injected", async () => {
    const { server } = await fixtureV1({
      acceptanceIdentityVerificationCapability:
        await identityVerificationCapabilityV1(),
      mutationPolicy: "acceptance_authority_session_required",
    });
    const acceptance = finalAcceptanceV1();
    await server.store.compareCommit({
      expectedRevision: 0,
      operationNonce: "c".repeat(32),
      phase: "final_strong_ready",
      artifacts: {
        finalStrongReadyAcceptance: {
          finalStrongReadyAcceptanceEnvelope: acceptance.envelope,
          finalStrongReadyAcceptancePin: acceptance.pin,
        },
      },
    });
    const continuation = await openStrongContinuationV1(server.socketPath);
    const request = strongWriteRequestV1(
      continuation.attestation,
      Buffer.from("must remain absent without verifier", "utf8"),
      "d",
    );
    const writeObject = vi.spyOn(server.store, "writeFixedObject");
    try {
      continuation.socket.write(`${JSON.stringify(request)}\n`);
      const line = await continuation.iterator.next();
      expect(line.done).toBe(false);
      expect(
        ProviderRuntimeIpcStrongMutationResponseV1Schema.parse(
          JSON.parse(line.value!),
        ),
      ).toMatchObject({
        ok: false,
        error: { code: "capability_mismatch" },
      });
      expect(writeObject).not.toHaveBeenCalled();
    } finally {
      continuation.lines.close();
      continuation.socket.destroy();
    }
  });

  it("rejects journal-head drift before consuming the authority grant", async () => {
    let consumeCalls = 0;
    const verifierCapability =
      mintProviderRuntimeStrongMutationAuthorityVerifierCapabilityInternalV1({
        consumeGrant() {
          consumeCalls += 1;
          return true;
        },
      });
    const { server } = await fixtureV1({
      acceptanceIdentityVerificationCapability:
        await identityVerificationCapabilityV1(),
      mutationPolicy: "acceptance_authority_session_required",
      strongMutationAuthorityVerifier: verifierCapability,
    });
    const acceptance = finalAcceptanceV1();
    await server.store.compareCommit({
      expectedRevision: 0,
      operationNonce: "9".repeat(32),
      phase: "final_strong_ready",
      artifacts: {
        finalStrongReadyAcceptance: {
          finalStrongReadyAcceptanceEnvelope: acceptance.envelope,
          finalStrongReadyAcceptancePin: acceptance.pin,
        },
      },
    });
    const continuation = await openStrongContinuationV1(server.socketPath);
    const request = strongWriteRequestV1(
      continuation.attestation,
      Buffer.from("must remain absent after drift", "utf8"),
      "a",
    );
    await server.store.compareCommit({
      expectedRevision: 1,
      operationNonce: "b".repeat(32),
      phase: "head_drifted",
      artifacts: { drift: true },
    });
    const writeObject = vi.spyOn(server.store, "writeFixedObject");
    try {
      continuation.socket.write(`${JSON.stringify(request)}\n`);
      const line = await continuation.iterator.next();
      expect(line.done).toBe(false);
      const response =
        ProviderRuntimeIpcStrongMutationResponseV1Schema.parse(
          JSON.parse(line.value!),
        );
      expect(response).toMatchObject({
        ok: false,
        error: {
          code: "capability_mismatch",
          message: "runtime mutation capability is unavailable",
        },
      });
      expect(consumeCalls).toBe(0);
      expect(writeObject).not.toHaveBeenCalled();
    } finally {
      continuation.lines.close();
      continuation.socket.destroy();
    }
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
