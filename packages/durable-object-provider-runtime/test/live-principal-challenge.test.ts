import {
  createHash,
  createHmac,
  createPublicKey,
  randomBytes,
  sign,
  verify,
  type KeyObject,
} from "node:crypto";
import {
  chmod,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
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
  ProviderRuntimeIpcAcceptanceIdentityProofV1Schema,
  ProviderRuntimeIpcClientHelloV1Schema,
  ProviderRuntimeIpcPrincipalAttestationV1Schema,
  ProviderRuntimeIpcPrincipalChallengeV1Schema,
  ProviderRuntimeIpcRequestV1Schema,
  ProviderRuntimeIpcResponseV1Schema,
  ProviderRuntimeIpcServerHelloV1Schema,
  ProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeV1Schema,
  ProviderRuntimeIpcStrongMutationRequestClaimsV1Schema,
  ProviderRuntimeIpcStrongMutationRequestV1Schema,
  ProviderRuntimeIpcStrongMutationResponseV1Schema,
  canonicalizeProviderRuntimeIpcAuthenticatedClaimsV1,
  canonicalizeProviderRuntimeIpcPrincipalAttestationTranscriptV1,
  canonicalizeProviderRuntimeIpcStrongMutationRequestV1,
  canonicalizeProviderRuntimeIpcStrongMutationResponseClaimsV1,
  canonicalizeProviderRuntimeIpcStrongMutationSessionBindingV1,
  deriveProviderRuntimeIpcStrongMutationAuthorityGrantContentDigestV1,
  deriveProviderRuntimeIpcStrongMutationAuthorityGrantIdV1,
  type ProviderRuntimeIpcStrongMutationResponseV1,
} from "@understand-code/durable-object-provider-contracts/provider-runtime-ipc-v1";

import { diagnoseProviderRuntimeDurableExecutionPrincipalHeadV1 } from "../src/durable-execution-principal-head.js";
import { PROVIDER_RUNTIME_DURABLE_LIFECYCLE_ARTIFACT_KEYS_V1 } from "../src/durable-lifecycle-artifacts.js";
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
const TARGET_FINGERPRINT_DIGEST = ContentDigestV1Schema.parse(
  `sha256:${"d".repeat(64)}`,
);
const STRONG_MUTATION_NONCE_RECEIPT_ERA_NAME_V1 =
  "nonce-receipt-era-v1.json" as const;
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
  readonly signingKey: KeyObject;
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
  return { config, server, authKey, signingKey: signing.privateKey };
}

async function restartStrongFixtureServerV1(input: {
  readonly config: ProviderServiceHandoffConfigV1;
  readonly authKey: Uint8Array;
  readonly signingKey: KeyObject;
  readonly verifier: ConstructorParameters<
    typeof DurableObjectProviderRuntimeServerV1
  >[0]["strongMutationAuthorityVerifier"];
}): Promise<DurableObjectProviderRuntimeServerV1> {
  return new DurableObjectProviderRuntimeServerV1({
    rootPath: input.config.payload.runtimeRoot,
    socketPath: input.config.payload.socketPath,
    providerId: PROVIDER_ID,
    authKey: input.authKey,
    authorizedCapabilityDigest: CAPABILITY_DIGEST,
    principalAttestation: {
      privateKey: input.signingKey,
      handoffPayloadDigest: input.config.payloadDigest,
      publicKey: input.config.publicKey,
    },
    acceptanceIdentityVerificationCapability:
      await identityVerificationCapabilityV1(),
    mutationPolicy: "acceptance_authority_session_required",
    strongMutationAuthorityVerifier: input.verifier,
  });
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

function finalStrongReadyArtifactsV1(
  acceptance: ReturnType<typeof finalAcceptanceV1>,
) {
  return {
    ...Object.fromEntries(
      PROVIDER_RUNTIME_DURABLE_LIFECYCLE_ARTIFACT_KEYS_V1.map((key) => [
        key,
        {},
      ]),
    ),
    finalStrongReadyAcceptance: {
      finalStrongReadyAcceptanceEnvelope: acceptance.envelope,
      finalStrongReadyAcceptancePin: acceptance.pin,
    },
  };
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

function recoverableStrongMutationVerifierV1() {
  const grantedBindings = new Set<string>();
  const authorityOrdinals = new Map<string, number>();
  const firstAuthorities = new Map<
    string,
    Readonly<{ readonly ordinal: number; readonly bindingDigest: string }>
  >();
  let nextAuthorityOrdinal = 1;
  return mintProviderRuntimeStrongMutationAuthorityVerifierCapabilityInternalV1({
    consumeGrant(context) {
      if (grantedBindings.has(context.bindingDigest)) {
        return { disposition: "recover" as const };
      }
      grantedBindings.add(context.bindingDigest);
      return { disposition: "execute" as const };
    },
    resolveGrant() {
      return true;
    },
    inspectLegacyOutcomeAuthority({ request }) {
      let intentOrdinal = authorityOrdinals.get(request.bindingDigest);
      if (intentOrdinal === undefined) {
        intentOrdinal = nextAuthorityOrdinal;
        nextAuthorityOrdinal += 1;
        authorityOrdinals.set(request.bindingDigest, intentOrdinal);
      }
      let first = firstAuthorities.get(request.operationNonce);
      if (first === undefined) {
        first = Object.freeze({
          ordinal: intentOrdinal,
          bindingDigest: request.bindingDigest,
        });
        firstAuthorities.set(request.operationNonce, first);
      }
      return Object.freeze({
        intentOrdinal,
        firstIntentOrdinal: first.ordinal,
        firstBindingDigest: ContentDigestV1Schema.parse(first.bindingDigest),
      });
    },
  });
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

function strongRequestV1(
  attestation: ReturnType<
    typeof ProviderRuntimeIpcPrincipalAttestationV1Schema.parse
  >,
  claimsInput: unknown,
) {
  const claims = ProviderRuntimeIpcStrongMutationRequestClaimsV1Schema.parse(
    claimsInput,
  );
  const { operation, operationNonce, payload } = claims;
  const requestDigest = sha256V1(
    canonicalizeProviderRuntimeIpcStrongMutationRequestV1(claims),
  );
  const principalAttestationDigest = sha256V1(
    canonicalizeProviderRuntimeIpcPrincipalAttestationTranscriptV1(
      attestation,
    ),
  );
  const grantFields = {
    signerKeyId: "a".repeat(22),
    providerId: PROVIDER_ID,
    targetProfileId: TARGET_PROFILE_ID,
    targetFingerprintDigest: TARGET_FINGERPRINT_DIGEST,
    registryManifest: {
      locatorProfile: "installation_provider_registry_manifest_v1" as const,
      manifestGeneration: 1,
      generationId: `provider-registry-manifest:${"b".repeat(22)}`,
      contentDigest: `sha256:${"c".repeat(64)}`,
    },
    acceptanceIdentity:
      ProviderRuntimeIpcAcceptanceIdentityProofV1Schema.parse(
        attestation.acceptanceIdentity,
      ),
    capabilityDigest: CAPABILITY_DIGEST,
    principalAttestationDigest,
    journalHead: {
      revision: attestation.revision,
      phase: attestation.phase,
      mutationDigest: attestation.mutationDigest,
    },
    operation,
    operationNonce,
    requestDigest,
  };
  const grantId =
    deriveProviderRuntimeIpcStrongMutationAuthorityGrantIdV1(grantFields);
  const grantPayload = {
    profile:
      "provider_runtime_ipc_strong_mutation_authority_grant_v1" as const,
    grantId,
    ...grantFields,
    signature: `base64url:${Buffer.alloc(64).toString("base64url")}`,
  };
  const authorityGrant =
    ProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeV1Schema.parse({
      schemaVersion: 1,
      recordType:
        "provider_runtime_ipc_strong_mutation_authority_grant",
      grantId,
      contentDigest:
        deriveProviderRuntimeIpcStrongMutationAuthorityGrantContentDigestV1(
          grantPayload,
        ),
      payload: grantPayload,
    });
  const bindingDigest = sha256V1(
    canonicalizeProviderRuntimeIpcStrongMutationSessionBindingV1({
      principalAttestationDigest,
      operation,
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
    operation,
    operationNonce,
    requestDigest,
    authorityGrant,
    payload,
  });
}

function strongWriteRequestV1(
  attestation: ReturnType<
    typeof ProviderRuntimeIpcPrincipalAttestationV1Schema.parse
  >,
  bytes: Uint8Array,
  nonceDigit: string,
) {
  const operationNonce = LowerHex32V1Schema.parse(nonceDigit.repeat(32));
  return strongRequestV1(attestation, {
    operation: "write_object",
    operationNonce,
    payload: {
      locator: {
        providerId: PROVIDER_ID,
        contentDigest: sha256V1(bytes),
      },
      logicalBytes: bytes.byteLength,
      bytes: CanonicalByteStringV1Schema.parse(
        `base64url:${Buffer.from(bytes).toString("base64url")}`,
      ),
    },
  });
}

async function executeStrongWriteV1(
  server: DurableObjectProviderRuntimeServerV1,
  bytes: Uint8Array,
  nonceDigit: string,
) {
  const continuation = await openStrongContinuationV1(server.socketPath);
  const request = strongWriteRequestV1(
    continuation.attestation,
    bytes,
    nonceDigit,
  );
  try {
    continuation.socket.write(`${JSON.stringify(request)}\n`);
    const line = await continuation.iterator.next();
    if (line.done) throw new Error("runtime closed before strong response");
    const response = ProviderRuntimeIpcStrongMutationResponseV1Schema.parse(
      JSON.parse(line.value),
    );
    if (!response.ok) throw new Error(response.error.message);
    return { request, response };
  } finally {
    continuation.lines.close();
    continuation.socket.destroy();
  }
}

function strongCompareRequestV1(
  attestation: ReturnType<
    typeof ProviderRuntimeIpcPrincipalAttestationV1Schema.parse
  >,
  input: {
    readonly expectedRevision: number;
    readonly nonceDigit: string;
    readonly phase: string;
    readonly artifacts: Readonly<Record<string, unknown>>;
  },
) {
  const operationNonce = LowerHex32V1Schema.parse(
    input.nonceDigit.repeat(32),
  );
  return strongRequestV1(attestation, {
    operation: "compare_commit",
    operationNonce,
    payload: {
      expectedRevision: input.expectedRevision,
      operationNonce,
      phase: input.phase,
      artifacts: input.artifacts,
    },
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
      artifacts: finalStrongReadyArtifactsV1(acceptance),
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
      artifacts: finalStrongReadyArtifactsV1(acceptance),
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
      artifacts: finalStrongReadyArtifactsV1(acceptance),
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
    const resolvedResponses: ProviderRuntimeIpcStrongMutationResponseV1[] = [];
    const verifierCapability =
      mintProviderRuntimeStrongMutationAuthorityVerifierCapabilityInternalV1({
        consumeGrant(context) {
          return context.authorityGrant.payload.providerId === PROVIDER_ID &&
            context.journalHead.phase === "final_strong_ready";
        },
        resolveGrant({ response }) {
          resolvedResponses.push(response);
          return true;
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
      artifacts: finalStrongReadyArtifactsV1(acceptance),
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
      expect(resolvedResponses).toEqual([response]);
    } finally {
      continuation.lines.close();
      continuation.socket.destroy();
    }
  });

  it("durably binds one operation nonce to one strong request", async () => {
    const grantedBindings = new Set<string>();
    const verifierCapability =
      mintProviderRuntimeStrongMutationAuthorityVerifierCapabilityInternalV1({
        consumeGrant(context) {
          if (grantedBindings.has(context.bindingDigest)) {
            return { disposition: "recover" as const };
          }
          grantedBindings.add(context.bindingDigest);
          return { disposition: "execute" as const };
        },
        resolveGrant() {
          return true;
        },
      });
    const { config, server, authKey, signingKey } = await fixtureV1({
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
      artifacts: finalStrongReadyArtifactsV1(acceptance),
    });

    const first = await openStrongContinuationV1(server.socketPath);
    const firstRequest = strongWriteRequestV1(
      first.attestation,
      Buffer.from("nonce-bound-first-object", "utf8"),
      "8",
    );
    let firstResponse!: ReturnType<
      typeof ProviderRuntimeIpcStrongMutationResponseV1Schema.parse
    >;
    try {
      first.socket.write(`${JSON.stringify(firstRequest)}\n`);
      const line = await first.iterator.next();
      expect(line.done).toBe(false);
      firstResponse = ProviderRuntimeIpcStrongMutationResponseV1Schema.parse(
        JSON.parse(line.value!),
      );
      expect(firstResponse).toMatchObject({
        ok: true,
        operationNonce: firstRequest.operationNonce,
        requestDigest: firstRequest.requestDigest,
      });
    } finally {
      first.lines.close();
      first.socket.destroy();
    }

    await server.store.compareCommit({
      expectedRevision: 1,
      operationNonce: "6".repeat(32),
      phase: "final_strong_ready",
      artifacts: finalStrongReadyArtifactsV1(acceptance),
    });
    const replay = await openStrongContinuationV1(server.socketPath);
    const replayRequest = strongWriteRequestV1(
      replay.attestation,
      Buffer.from("nonce-bound-first-object", "utf8"),
      "8",
    );
    expect(replayRequest.requestDigest).toBe(firstRequest.requestDigest);
    expect(replayRequest.bindingDigest).not.toBe(firstRequest.bindingDigest);
    let replayResponse!: ReturnType<
      typeof ProviderRuntimeIpcStrongMutationResponseV1Schema.parse
    >;
    try {
      replay.socket.write(`${JSON.stringify(replayRequest)}\n`);
      const line = await replay.iterator.next();
      expect(line.done).toBe(false);
      replayResponse = ProviderRuntimeIpcStrongMutationResponseV1Schema.parse(
        JSON.parse(line.value!),
      );
      expect(replayResponse).toMatchObject({
        ok: true,
        bindingDigest: replayRequest.bindingDigest,
        operationNonce: replayRequest.operationNonce,
        requestDigest: replayRequest.requestDigest,
        payload: { resolution: "committed" },
      });
      expect(replayResponse.ok && firstResponse.ok
        ? replayResponse.payload
        : undefined).toEqual(firstResponse.ok ? firstResponse.payload : undefined);
    } finally {
      replay.lines.close();
      replay.socket.destroy();
    }

    const outcomes = await server.store.inspectStrongMutationOutcomesForRecoveryV1();
    expect(outcomes).toHaveLength(1);
    expect(outcomes.map((outcome) => outcome.request.requestDigest)).toEqual([
      firstRequest.requestDigest,
    ]);
    expect(await readdir(server.store.strongMutationOutcomesPath)).toEqual([
      `${firstRequest.bindingDigest.slice("sha256:".length)}.json`,
      `nonce-${firstRequest.operationNonce}.json`,
      STRONG_MUTATION_NONCE_RECEIPT_ERA_NAME_V1,
    ].sort());
    const nonceReceipt = JSON.parse(await readFile(join(
      server.store.strongMutationOutcomesPath,
      `nonce-${firstRequest.operationNonce}.json`,
    ), "utf8")) as Record<string, unknown>;
    expect(nonceReceipt).toMatchObject({
      profile: "provider_runtime_strong_mutation_nonce_receipt_v1",
      providerId: PROVIDER_ID,
      operation: "write_object",
      operationNonce: firstRequest.operationNonce,
      requestDigest: firstRequest.requestDigest,
      request: firstRequest,
      response: firstResponse,
    });

    await server.close();
    servers.delete(server);
    const restarted = new DurableObjectProviderRuntimeServerV1({
      rootPath: config.payload.runtimeRoot,
      socketPath: config.payload.socketPath,
      providerId: PROVIDER_ID,
      authKey,
      authorizedCapabilityDigest: CAPABILITY_DIGEST,
      principalAttestation: {
        privateKey: signingKey,
        handoffPayloadDigest: config.payloadDigest,
        publicKey: config.publicKey,
      },
      acceptanceIdentityVerificationCapability:
        await identityVerificationCapabilityV1(),
      mutationPolicy: "acceptance_authority_session_required",
      strongMutationAuthorityVerifier: verifierCapability,
    });
    await restarted.start();
    servers.add(restarted);
    expect(
      await restarted.store.inspectStrongMutationOutcomesForRecoveryV1(),
    ).toHaveLength(1);

    for (let aliasIndex = 0; aliasIndex < 4; aliasIndex += 1) {
      const alias = await openStrongContinuationV1(restarted.socketPath);
      const aliasRequest = strongWriteRequestV1(
        alias.attestation,
        Buffer.from("nonce-bound-first-object", "utf8"),
        "8",
      );
      try {
        alias.socket.write(`${JSON.stringify(aliasRequest)}\n`);
        const line = await alias.iterator.next();
        expect(line.done).toBe(false);
        const aliasResponse =
          ProviderRuntimeIpcStrongMutationResponseV1Schema.parse(
            JSON.parse(line.value!),
          );
        expect(aliasResponse.ok && firstResponse.ok
          ? aliasResponse.payload
          : undefined).toEqual(
            firstResponse.ok ? firstResponse.payload : undefined,
          );
      } finally {
        alias.lines.close();
        alias.socket.destroy();
      }
      expect(await readdir(restarted.store.strongMutationOutcomesPath))
        .toEqual([
          `${firstRequest.bindingDigest.slice("sha256:".length)}.json`,
          `nonce-${firstRequest.operationNonce}.json`,
          STRONG_MUTATION_NONCE_RECEIPT_ERA_NAME_V1,
        ].sort());
    }

    const conflicting = await openStrongContinuationV1(restarted.socketPath);
    const conflictingRequest = strongWriteRequestV1(
      conflicting.attestation,
      Buffer.from("nonce-bound-different-object", "utf8"),
      "8",
    );
    if (conflictingRequest.operation !== "write_object") {
      throw new Error("expected strong write request");
    }
    expect(conflictingRequest.requestDigest).not.toBe(firstRequest.requestDigest);
    try {
      conflicting.socket.write(`${JSON.stringify(conflictingRequest)}\n`);
      const line = await conflicting.iterator.next();
      expect(line.done).toBe(false);
      expect(ProviderRuntimeIpcStrongMutationResponseV1Schema.parse(
        JSON.parse(line.value!),
      )).toMatchObject({
        ok: false,
        operationNonce: firstRequest.operationNonce,
        requestDigest: conflictingRequest.requestDigest,
        error: { code: "operation_nonce_conflict" },
      });
    } finally {
      conflicting.lines.close();
      conflicting.socket.destroy();
    }

    await expect(
      restarted.store.readFixedObject(conflictingRequest.payload.locator),
    ).rejects.toMatchObject({ code: "object_not_found" });
  });

  it("replays the first stale compare after the head advances and the principal changes", async () => {
    const grantedBindings = new Set<string>();
    const verifierCapability =
      mintProviderRuntimeStrongMutationAuthorityVerifierCapabilityInternalV1({
        consumeGrant(context) {
          if (grantedBindings.has(context.bindingDigest)) {
            return { disposition: "recover" as const };
          }
          grantedBindings.add(context.bindingDigest);
          return { disposition: "execute" as const };
        },
        resolveGrant() {
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
    const artifacts = finalStrongReadyArtifactsV1(acceptance);
    await server.store.compareCommit({
      expectedRevision: 0,
      operationNonce: "1".repeat(32),
      phase: "final_strong_ready",
      artifacts,
    });

    const first = await openStrongContinuationV1(server.socketPath);
    const firstRequest = strongCompareRequestV1(first.attestation, {
      expectedRevision: 2,
      nonceDigit: "2",
      phase: "final_strong_ready",
      artifacts,
    });
    let firstResponse!: ReturnType<
      typeof ProviderRuntimeIpcStrongMutationResponseV1Schema.parse
    >;
    try {
      first.socket.write(`${JSON.stringify(firstRequest)}\n`);
      const line = await first.iterator.next();
      expect(line.done).toBe(false);
      firstResponse = ProviderRuntimeIpcStrongMutationResponseV1Schema.parse(
        JSON.parse(line.value!),
      );
      expect(firstResponse).toMatchObject({
        ok: true,
        payload: {
          operation: "compare_commit",
          resolution: "stale",
          state: { revision: 1 },
        },
      });
    } finally {
      first.lines.close();
      first.socket.destroy();
    }

    await server.store.compareCommit({
      expectedRevision: 1,
      operationNonce: "3".repeat(32),
      phase: "final_strong_ready",
      artifacts,
    });
    expect(server.store.inspectState().revision).toBe(2);

    const replay = await openStrongContinuationV1(server.socketPath);
    const replayRequest = strongCompareRequestV1(replay.attestation, {
      expectedRevision: 2,
      nonceDigit: "2",
      phase: "final_strong_ready",
      artifacts,
    });
    expect(replayRequest.requestDigest).toBe(firstRequest.requestDigest);
    expect(replayRequest.bindingDigest).not.toBe(firstRequest.bindingDigest);
    try {
      replay.socket.write(`${JSON.stringify(replayRequest)}\n`);
      const line = await replay.iterator.next();
      expect(line.done).toBe(false);
      const replayResponse =
        ProviderRuntimeIpcStrongMutationResponseV1Schema.parse(
          JSON.parse(line.value!),
        );
      expect(replayResponse.ok && firstResponse.ok
        ? replayResponse.payload
        : undefined).toEqual(firstResponse.ok ? firstResponse.payload : undefined);
      expect(server.store.inspectState().revision).toBe(2);
    } finally {
      replay.lines.close();
      replay.socket.destroy();
    }

    const conflicting = await openStrongContinuationV1(server.socketPath);
    const conflictingRequest = strongCompareRequestV1(
      conflicting.attestation,
      {
        expectedRevision: 3,
        nonceDigit: "2",
        phase: "final_strong_ready",
        artifacts,
      },
    );
    expect(conflictingRequest.requestDigest).not.toBe(firstRequest.requestDigest);
    try {
      conflicting.socket.write(`${JSON.stringify(conflictingRequest)}\n`);
      const line = await conflicting.iterator.next();
      expect(line.done).toBe(false);
      expect(ProviderRuntimeIpcStrongMutationResponseV1Schema.parse(
        JSON.parse(line.value!),
      )).toMatchObject({
        ok: false,
        error: { code: "operation_nonce_conflict" },
      });
      expect(server.store.inspectState().revision).toBe(2);
    } finally {
      conflicting.lines.close();
      conflicting.socket.destroy();
    }
  });

  it("migrates a HEAD-format outcome-only store before replay and keeps the marker across restart", async () => {
    const verifier = recoverableStrongMutationVerifierV1();
    const { config, server, authKey, signingKey } = await fixtureV1({
      acceptanceIdentityVerificationCapability:
        await identityVerificationCapabilityV1(),
      mutationPolicy: "acceptance_authority_session_required",
      strongMutationAuthorityVerifier: verifier,
    });
    const acceptance = finalAcceptanceV1();
    await server.store.compareCommit({
      expectedRevision: 0,
      operationNonce: "a".repeat(32),
      phase: "final_strong_ready",
      artifacts: finalStrongReadyArtifactsV1(acceptance),
    });
    const bytes = Buffer.from("head-outcome-only-upgrade", "utf8");
    const first = await executeStrongWriteV1(server, bytes, "b");
    const outcomesPath = server.store.strongMutationOutcomesPath;
    const outcomePath = join(
      outcomesPath,
      `${first.request.bindingDigest.slice("sha256:".length)}.json`,
    );
    const receiptPath = join(
      outcomesPath,
      `nonce-${first.request.operationNonce}.json`,
    );
    const markerPath = join(
      outcomesPath,
      STRONG_MUTATION_NONCE_RECEIPT_ERA_NAME_V1,
    );
    const outcomeBeforeUpgrade = await readFile(outcomePath);

    await server.close();
    servers.delete(server);
    await rm(receiptPath);
    await rm(markerPath);
    expect(await readdir(outcomesPath)).toEqual([
      `${first.request.bindingDigest.slice("sha256:".length)}.json`,
    ]);

    const restarted = await restartStrongFixtureServerV1({
      config,
      authKey,
      signingKey,
      verifier,
    });
    await restarted.start();
    servers.add(restarted);
    expect(await readFile(outcomePath)).toEqual(outcomeBeforeUpgrade);
    expect(JSON.parse(await readFile(receiptPath, "utf8"))).toMatchObject({
      profile: "provider_runtime_strong_mutation_nonce_receipt_v1",
      request: first.request,
      response: first.response,
    });
    expect(JSON.parse(await readFile(markerPath, "utf8"))).toMatchObject({
      profile: "provider_runtime_strong_mutation_nonce_receipt_era_v1",
      providerId: PROVIDER_ID,
      outcomeProfile: "provider_runtime_strong_mutation_outcome_v1",
      nonceReceiptProfile:
        "provider_runtime_strong_mutation_nonce_receipt_v1",
    });
    expect(
      (await restarted.store.inspectStrongMutationOutcomesForRecoveryV1())[0]
        ?.response,
    ).toEqual(first.response);

    const replay = await executeStrongWriteV1(restarted, bytes, "b");
    expect(replay.request.requestDigest).toBe(first.request.requestDigest);
    expect(replay.request.bindingDigest).not.toBe(first.request.bindingDigest);
    expect(replay.response.payload).toEqual(first.response.payload);

    await restarted.close();
    servers.delete(restarted);
    const secondRestart = await restartStrongFixtureServerV1({
      config,
      authKey,
      signingKey,
      verifier,
    });
    await secondRestart.start();
    servers.add(secondRestart);
    expect(await readFile(outcomePath)).toEqual(outcomeBeforeUpgrade);
    expect(
      (await secondRestart.store.inspectStrongMutationOutcomesForRecoveryV1())
        [0]?.response,
    ).toEqual(first.response);

    await secondRestart.close();
    servers.delete(secondRestart);
    await rm(receiptPath);
    const receiptEraCorrupt = await restartStrongFixtureServerV1({
      config,
      authKey,
      signingKey,
      verifier,
    });
    await expect(receiptEraCorrupt.start()).rejects.toMatchObject({
      code: "journal_corrupt",
    });
    await receiptEraCorrupt.close();
  });

  it("uses broker append order when a HEAD store retained multiple bindings for one logical nonce", async () => {
    const initialVerifier = recoverableStrongMutationVerifierV1();
    const { config, server, authKey, signingKey } = await fixtureV1({
      acceptanceIdentityVerificationCapability:
        await identityVerificationCapabilityV1(),
      mutationPolicy: "acceptance_authority_session_required",
      strongMutationAuthorityVerifier: initialVerifier,
    });
    await server.store.compareCommit({
      expectedRevision: 0,
      operationNonce: "8".repeat(32),
      phase: "final_strong_ready",
      artifacts: finalStrongReadyArtifactsV1(finalAcceptanceV1()),
    });
    const bytes = Buffer.from("legacy-multiple-binding-authority", "utf8");
    const first = await executeStrongWriteV1(server, bytes, "9");
    const alias = await executeStrongWriteV1(server, bytes, "9");
    expect(alias.request.requestDigest).toBe(first.request.requestDigest);
    expect(alias.request.bindingDigest).not.toBe(first.request.bindingDigest);
    if (!alias.response.ok) throw new Error("expected successful alias");
    const replayUnsigned = ProviderRuntimeIpcStrongMutationResponseV1Schema.parse({
      ...alias.response,
      payload: { ...alias.response.payload, resolution: "replayed" },
      signature: `base64url:${Buffer.alloc(64).toString("base64url")}`,
    });
    const replayResponse = ProviderRuntimeIpcStrongMutationResponseV1Schema.parse({
      ...replayUnsigned,
      signature: `base64url:${sign(
        null,
        canonicalizeProviderRuntimeIpcStrongMutationResponseClaimsV1(
          replayUnsigned,
        ),
        signingKey,
      ).toString("base64url")}`,
    });
    expect(verifyStrongResponseSignatureV1(config.publicKey, replayResponse))
      .toBe(true);

    const outcomesPath = server.store.strongMutationOutcomesPath;
    await server.close();
    servers.delete(server);
    await rm(join(
      outcomesPath,
      `nonce-${first.request.operationNonce}.json`,
    ));
    await rm(join(
      outcomesPath,
      STRONG_MUTATION_NONCE_RECEIPT_ERA_NAME_V1,
    ));
    const aliasOutcomeWithoutDigest = {
      profile: "provider_runtime_strong_mutation_outcome_v1" as const,
      providerId: PROVIDER_ID,
      bindingDigest: alias.request.bindingDigest,
      request: alias.request,
      response: replayResponse,
      phase: "completed" as const,
    };
    await writeFile(
      join(
        outcomesPath,
        `${alias.request.bindingDigest.slice("sha256:".length)}.json`,
      ),
      Buffer.concat([
        Buffer.from(canonicalizeJcsSafeIntegerUtf8V1({
          ...aliasOutcomeWithoutDigest,
          outcomeDigest: sha256V1(canonicalizeJcsSafeIntegerUtf8V1({
            domain:
              "understand-code-provider-runtime-strong-mutation-outcome-v1",
            outcome: aliasOutcomeWithoutDigest,
          })),
        })),
        Buffer.from("\n", "utf8"),
      ]),
      { mode: 0o600 },
    );

    const retainedResponses = new Map([
      [first.request.bindingDigest, first.response],
      [alias.request.bindingDigest, replayResponse],
    ]);
    const migrationVerifier =
      mintProviderRuntimeStrongMutationAuthorityVerifierCapabilityInternalV1({
        consumeGrant(context) {
          const retained = retainedResponses.get(context.bindingDigest);
          return retained === undefined
            ? { disposition: "execute" as const }
            : { disposition: "resolved" as const, response: retained };
        },
        resolveGrant() {
          return true;
        },
        inspectLegacyOutcomeAuthority({ request, response }) {
          if (
            !verifyStrongResponseSignatureV1(config.publicKey, response) ||
            !retainedResponses.has(request.bindingDigest)
          ) return false;
          return Object.freeze({
            intentOrdinal: request.bindingDigest === first.request.bindingDigest
              ? 1
              : 2,
            firstIntentOrdinal: 1,
            firstBindingDigest: first.request.bindingDigest,
          });
        },
      });
    const restarted = await restartStrongFixtureServerV1({
      config,
      authKey,
      signingKey,
      verifier: migrationVerifier,
    });
    await restarted.start();
    servers.add(restarted);
    const receipt = JSON.parse(await readFile(
      join(outcomesPath, `nonce-${first.request.operationNonce}.json`),
      "utf8",
    )) as Record<string, unknown>;
    expect(receipt).toMatchObject({
      request: first.request,
      response: first.response,
    });
    const postMigrationAlias = await executeStrongWriteV1(
      restarted,
      bytes,
      "9",
    );
    expect(postMigrationAlias.response.payload).toEqual(first.response.payload);

    await restarted.close();
    servers.delete(restarted);
    await rm(join(
      outcomesPath,
      `${first.request.bindingDigest.slice("sha256:".length)}.json`,
    ));
    await rm(join(
      outcomesPath,
      `nonce-${first.request.operationNonce}.json`,
    ));
    await rm(join(
      outcomesPath,
      STRONG_MUTATION_NONCE_RECEIPT_ERA_NAME_V1,
    ));
    const recoveredWithoutFirst = await restartStrongFixtureServerV1({
      config,
      authKey,
      signingKey,
      verifier: migrationVerifier,
    });
    await recoveredWithoutFirst.start();
    servers.add(recoveredWithoutFirst);
    expect(JSON.parse(await readFile(
      join(outcomesPath, `nonce-${first.request.operationNonce}.json`),
      "utf8",
    ))).toMatchObject({
      request: alias.request,
      response: replayResponse,
    });
  });

  it("writes no migration receipt or marker for a self-hashed outcome with an invalid principal signature", async () => {
    const verifier = recoverableStrongMutationVerifierV1();
    const { config, server, authKey, signingKey } = await fixtureV1({
      acceptanceIdentityVerificationCapability:
        await identityVerificationCapabilityV1(),
      mutationPolicy: "acceptance_authority_session_required",
      strongMutationAuthorityVerifier: verifier,
    });
    await server.store.compareCommit({
      expectedRevision: 0,
      operationNonce: "a".repeat(32),
      phase: "final_strong_ready",
      artifacts: finalStrongReadyArtifactsV1(finalAcceptanceV1()),
    });
    const outcome = await executeStrongWriteV1(
      server,
      Buffer.from("invalid-legacy-signature", "utf8"),
      "f",
    );
    const outcomesPath = server.store.strongMutationOutcomesPath;
    const outcomePath = join(
      outcomesPath,
      `${outcome.request.bindingDigest.slice("sha256:".length)}.json`,
    );
    await server.close();
    servers.delete(server);
    await rm(join(
      outcomesPath,
      `nonce-${outcome.request.operationNonce}.json`,
    ));
    await rm(join(
      outcomesPath,
      STRONG_MUTATION_NONCE_RECEIPT_ERA_NAME_V1,
    ));
    const parsed = JSON.parse(await readFile(outcomePath, "utf8")) as Record<
      string,
      unknown
    >;
    const invalidResponse = ProviderRuntimeIpcStrongMutationResponseV1Schema.parse({
      ...(parsed.response as Record<string, unknown>),
      signature: `base64url:${Buffer.alloc(64).toString("base64url")}`,
    });
    const { outcomeDigest: _outcomeDigest, ...withoutDigest } = parsed;
    const tamperedWithoutDigest = { ...withoutDigest, response: invalidResponse };
    await writeFile(
      outcomePath,
      Buffer.concat([
        Buffer.from(canonicalizeJcsSafeIntegerUtf8V1({
          ...tamperedWithoutDigest,
          outcomeDigest: sha256V1(canonicalizeJcsSafeIntegerUtf8V1({
            domain:
              "understand-code-provider-runtime-strong-mutation-outcome-v1",
            outcome: tamperedWithoutDigest,
          })),
        })),
        Buffer.from("\n", "utf8"),
      ]),
      { mode: 0o600 },
    );
    const beforeNames = await readdir(outcomesPath);
    const beforeBytes = await readFile(outcomePath);
    const rejectingVerifier =
      mintProviderRuntimeStrongMutationAuthorityVerifierCapabilityInternalV1({
        consumeGrant() {
          throw new Error("legacy inspection must fail before grant recovery");
        },
        inspectLegacyOutcomeAuthority({ response }) {
          return verifyStrongResponseSignatureV1(config.publicKey, response)
            ? {
                intentOrdinal: 1,
                firstIntentOrdinal: 1,
                firstBindingDigest: outcome.request.bindingDigest,
              }
            : false;
        },
      });
    const rejected = await restartStrongFixtureServerV1({
      config,
      authKey,
      signingKey,
      verifier: rejectingVerifier,
    });
    await expect(rejected.start()).rejects.toThrow(
      "runtime mutation capability is unavailable",
    );
    await rejected.close();
    expect(await readdir(outcomesPath)).toEqual(beforeNames);
    expect(await readFile(outcomePath)).toEqual(beforeBytes);
  });

  it("rejects conflicting HEAD outcomes before writing any nonce receipt or era marker", async () => {
    const firstVerifier = recoverableStrongMutationVerifierV1();
    const firstFixture = await fixtureV1({
      acceptanceIdentityVerificationCapability:
        await identityVerificationCapabilityV1(),
      mutationPolicy: "acceptance_authority_session_required",
      strongMutationAuthorityVerifier: firstVerifier,
    });
    const secondVerifier = recoverableStrongMutationVerifierV1();
    const secondFixture = await fixtureV1({
      acceptanceIdentityVerificationCapability:
        await identityVerificationCapabilityV1(),
      mutationPolicy: "acceptance_authority_session_required",
      strongMutationAuthorityVerifier: secondVerifier,
    });
    const artifacts = finalStrongReadyArtifactsV1(finalAcceptanceV1());
    await firstFixture.server.store.compareCommit({
      expectedRevision: 0,
      operationNonce: "c".repeat(32),
      phase: "final_strong_ready",
      artifacts,
    });
    await secondFixture.server.store.compareCommit({
      expectedRevision: 0,
      operationNonce: "c".repeat(32),
      phase: "final_strong_ready",
      artifacts,
    });
    const first = await executeStrongWriteV1(
      firstFixture.server,
      Buffer.from("first-head-nonce-owner", "utf8"),
      "d",
    );
    const second = await executeStrongWriteV1(
      secondFixture.server,
      Buffer.from("second-head-nonce-owner", "utf8"),
      "d",
    );
    expect(second.request.operationNonce).toBe(first.request.operationNonce);
    expect(second.request.bindingDigest).not.toBe(first.request.bindingDigest);

    const firstOutcomesPath =
      firstFixture.server.store.strongMutationOutcomesPath;
    const secondOutcomePath = join(
      secondFixture.server.store.strongMutationOutcomesPath,
      `${second.request.bindingDigest.slice("sha256:".length)}.json`,
    );
    await firstFixture.server.close();
    servers.delete(firstFixture.server);
    await secondFixture.server.close();
    servers.delete(secondFixture.server);
    await rm(join(
      firstOutcomesPath,
      `nonce-${first.request.operationNonce}.json`,
    ));
    await rm(join(
      firstOutcomesPath,
      STRONG_MUTATION_NONCE_RECEIPT_ERA_NAME_V1,
    ));
    await writeFile(
      join(
        firstOutcomesPath,
        `${second.request.bindingDigest.slice("sha256:".length)}.json`,
      ),
      await readFile(secondOutcomePath),
      { mode: 0o600 },
    );

    const rejected = await restartStrongFixtureServerV1({
      config: firstFixture.config,
      authKey: firstFixture.authKey,
      signingKey: firstFixture.signingKey,
      verifier: firstVerifier,
    });
    await expect(rejected.start()).rejects.toMatchObject({
      code: "journal_corrupt",
    });
    await rejected.close();
    expect(await readdir(firstOutcomesPath)).toEqual([
      `${first.request.bindingDigest.slice("sha256:".length)}.json`,
      `${second.request.bindingDigest.slice("sha256:".length)}.json`,
    ].sort());
  });

  it("resumes a partially fsynced legacy receipt backfill before writing the era marker", async () => {
    const verifier = recoverableStrongMutationVerifierV1();
    const { config, server, authKey, signingKey } = await fixtureV1({
      acceptanceIdentityVerificationCapability:
        await identityVerificationCapabilityV1(),
      mutationPolicy: "acceptance_authority_session_required",
      strongMutationAuthorityVerifier: verifier,
    });
    await server.store.compareCommit({
      expectedRevision: 0,
      operationNonce: "e".repeat(32),
      phase: "final_strong_ready",
      artifacts: finalStrongReadyArtifactsV1(finalAcceptanceV1()),
    });
    const first = await executeStrongWriteV1(
      server,
      Buffer.from("first-backfill", "utf8"),
      "1",
    );
    const second = await executeStrongWriteV1(
      server,
      Buffer.from("second-backfill", "utf8"),
      "2",
    );
    const outcomesPath = server.store.strongMutationOutcomesPath;
    await server.close();
    servers.delete(server);
    await rm(join(outcomesPath, `nonce-${first.request.operationNonce}.json`));
    await rm(join(outcomesPath, `nonce-${second.request.operationNonce}.json`));
    await rm(join(
      outcomesPath,
      STRONG_MUTATION_NONCE_RECEIPT_ERA_NAME_V1,
    ));

    const cutRestart = await restartStrongFixtureServerV1({
      config,
      authKey,
      signingKey,
      verifier,
    });
    cutRestart.store
      .armTestStrongMutationNonceReceiptMigrationBackfillCutOnceV1();
    await expect(cutRestart.start()).rejects.toMatchObject({
      code: "storage_failure",
    });
    await cutRestart.close();
    const afterCut = await readdir(outcomesPath);
    expect(afterCut.filter((name) => /^nonce-[0-9a-f]{32}\.json$/u.test(name)))
      .toHaveLength(1);
    expect(afterCut).not.toContain(STRONG_MUTATION_NONCE_RECEIPT_ERA_NAME_V1);

    const converged = await restartStrongFixtureServerV1({
      config,
      authKey,
      signingKey,
      verifier,
    });
    await converged.start();
    servers.add(converged);
    const afterRecovery = await readdir(outcomesPath);
    expect(afterRecovery.filter(
      (name) => /^nonce-[0-9a-f]{32}\.json$/u.test(name),
    )).toHaveLength(2);
    expect(afterRecovery).toContain(STRONG_MUTATION_NONCE_RECEIPT_ERA_NAME_V1);
    expect(await converged.store.inspectStrongMutationOutcomesForRecoveryV1())
      .toHaveLength(2);
  });

  it("recovers the byte-identical first authority after the nonce receipt fsync cut", async () => {
    const grantedBindings = new Set<string>();
    const verifierCapability =
      mintProviderRuntimeStrongMutationAuthorityVerifierCapabilityInternalV1({
        consumeGrant(context) {
          if (grantedBindings.has(context.bindingDigest)) {
            return { disposition: "recover" as const };
          }
          grantedBindings.add(context.bindingDigest);
          return { disposition: "execute" as const };
        },
        resolveGrant() {
          return true;
        },
      });
    const { config, server, authKey, signingKey } = await fixtureV1({
      acceptanceIdentityVerificationCapability:
        await identityVerificationCapabilityV1(),
      mutationPolicy: "acceptance_authority_session_required",
      strongMutationAuthorityVerifier: verifierCapability,
    });
    const acceptance = finalAcceptanceV1();
    await server.store.compareCommit({
      expectedRevision: 0,
      operationNonce: "4".repeat(32),
      phase: "final_strong_ready",
      artifacts: finalStrongReadyArtifactsV1(acceptance),
    });
    server.store.armTestStrongMutationNonceReceiptPersistCutOnceV1();
    const continuation = await openStrongContinuationV1(server.socketPath);
    const bytes = Buffer.from("nonce-receipt-before-binding-wal", "utf8");
    const request = strongWriteRequestV1(
      continuation.attestation,
      bytes,
      "5",
    );
    try {
      continuation.socket.write(`${JSON.stringify(request)}\n`);
      const line = await continuation.iterator.next();
      expect(line.done).toBe(true);
    } finally {
      continuation.lines.close();
      continuation.socket.destroy();
    }

    const nonceReceiptPath = join(
      server.store.strongMutationOutcomesPath,
      `nonce-${request.operationNonce}.json`,
    );
    const receiptBeforeRestart = JSON.parse(
      await readFile(nonceReceiptPath, "utf8"),
    ) as Record<string, unknown>;
    expect(receiptBeforeRestart).toMatchObject({
      request,
      response: {
        ok: true,
        bindingDigest: request.bindingDigest,
        requestDigest: request.requestDigest,
      },
    });
    expect(await readdir(server.store.strongMutationOutcomesPath)).toEqual([
      `nonce-${request.operationNonce}.json`,
      STRONG_MUTATION_NONCE_RECEIPT_ERA_NAME_V1,
    ]);

    await server.close();
    servers.delete(server);
    const restarted = new DurableObjectProviderRuntimeServerV1({
      rootPath: config.payload.runtimeRoot,
      socketPath: config.payload.socketPath,
      providerId: PROVIDER_ID,
      authKey,
      authorizedCapabilityDigest: CAPABILITY_DIGEST,
      principalAttestation: {
        privateKey: signingKey,
        handoffPayloadDigest: config.payloadDigest,
        publicKey: config.publicKey,
      },
      acceptanceIdentityVerificationCapability:
        await identityVerificationCapabilityV1(),
      mutationPolicy: "acceptance_authority_session_required",
      strongMutationAuthorityVerifier: verifierCapability,
    });
    await restarted.start();
    servers.add(restarted);
    const recovered =
      await restarted.store.inspectStrongMutationOutcomesForRecoveryV1();
    expect(recovered).toHaveLength(1);
    expect(recovered[0]).toMatchObject({
      phase: "completed",
      request,
      response: receiptBeforeRestart.response,
    });
    await expect(
      restarted.store.readFixedObject(request.operation === "write_object"
        ? request.payload.locator
        : (() => { throw new Error("expected write request"); })()),
    ).resolves.toMatchObject({ logicalBytes: bytes.byteLength });
  });

  it("rejects a self-consistent final lifecycle A-to-B-to-A journal history", async () => {
    const { config, server, authKey, signingKey } = await fixtureV1();
    const acceptance = finalAcceptanceV1();
    const artifacts = finalStrongReadyArtifactsV1(acceptance);
    for (let revision = 0; revision < 3; revision += 1) {
      await server.store.compareCommit({
        expectedRevision: revision,
        operationNonce: (revision + 6).toString(16).repeat(32),
        phase: "final_strong_ready",
        artifacts,
      });
    }
    await server.close();
    servers.delete(server);

    type MutableJournalRecordV1 = {
      ordinal: number;
      expectedRevision: number;
      revision: number;
      operationNonce: string;
      mutationDigest: string;
      phase: string;
      artifacts: Record<string, unknown>;
      previousReceiptDigest: string;
      receiptDigest: string;
    };
    const journalPath = join(config.payload.runtimeRoot, "journal", "state.json");
    const disk = JSON.parse(await readFile(journalPath, "utf8")) as {
      state: Record<string, unknown>;
      records: MutableJournalRecordV1[];
    };
    disk.records[1]!.artifacts = {
      ...disk.records[1]!.artifacts,
      preparedCatalogSuccessor: { foreignLifecycle: true },
    };
    for (let index = 1; index < disk.records.length; index += 1) {
      const record = disk.records[index]!;
      record.mutationDigest = sha256V1(
        canonicalizeJcsSafeIntegerUtf8V1({
          domain: "understand-code-durable-provider-operation-mutation-v1",
          expectedRevision: record.expectedRevision,
          operationNonce: record.operationNonce,
          phase: record.phase,
          artifacts: record.artifacts,
        }),
      );
      record.previousReceiptDigest = disk.records[index - 1]!.receiptDigest;
      const { receiptDigest: _receiptDigest, ...recordWithoutReceipt } = record;
      record.receiptDigest = sha256V1(
        canonicalizeJcsSafeIntegerUtf8V1({
          domain: "understand-code-durable-provider-operation-receipt-v1",
          record: recordWithoutReceipt,
        }),
      );
    }
    const last = disk.records.at(-1)!;
    disk.state = {
      profile: "provider_runtime_durable_journal_state_v1",
      revision: last.revision,
      phase: last.phase,
      operationNonce: last.operationNonce,
      mutationDigest: last.mutationDigest,
      artifacts: last.artifacts,
    };
    await writeFile(
      journalPath,
      Buffer.concat([
        Buffer.from(canonicalizeJcsSafeIntegerUtf8V1(disk)),
        Buffer.from("\n", "utf8"),
      ]),
      { mode: 0o600 },
    );

    const restarted = new DurableObjectProviderRuntimeServerV1({
      rootPath: config.payload.runtimeRoot,
      socketPath: config.payload.socketPath,
      providerId: PROVIDER_ID,
      authKey,
      authorizedCapabilityDigest: CAPABILITY_DIGEST,
      principalAttestation: {
        privateKey: signingKey,
        handoffPayloadDigest: config.payloadDigest,
        publicKey: config.publicKey,
      },
    });
    await expect(restarted.start()).rejects.toMatchObject({
      code: "journal_corrupt",
    });
    await restarted.close();
  });

  it("keeps a prepared success pending when completed-outcome persistence fails", async () => {
    let pending = false;
    const resolvedResponses: ProviderRuntimeIpcStrongMutationResponseV1[] = [];
    const verifierCapability =
      mintProviderRuntimeStrongMutationAuthorityVerifierCapabilityInternalV1({
        consumeGrant() {
          if (!pending) {
            pending = true;
            return { disposition: "execute" as const };
          }
          return { disposition: "recover" as const };
        },
        resolveGrant({ response }) {
          resolvedResponses.push(response);
          return true;
        },
      });
    const verification = await identityVerificationCapabilityV1();
    const { config, server, authKey, signingKey } = await fixtureV1({
      acceptanceIdentityVerificationCapability: verification,
      mutationPolicy: "acceptance_authority_session_required",
      strongMutationAuthorityVerifier: verifierCapability,
    });
    const acceptance = finalAcceptanceV1();
    await server.store.compareCommit({
      expectedRevision: 0,
      operationNonce: "9".repeat(32),
      phase: "final_strong_ready",
      artifacts: finalStrongReadyArtifactsV1(acceptance),
    });
    server.store.armTestStrongMutationCompletedOutcomePersistFailureOnceV1();
    const continuation = await openStrongContinuationV1(server.socketPath);
    const bytes = Buffer.from("completed-outcome-persist-cut", "utf8");
    const request = strongWriteRequestV1(continuation.attestation, bytes, "a");
    if (request.operation !== "write_object") {
      throw new Error("expected strong write request");
    }
    try {
      continuation.socket.write(`${JSON.stringify(request)}\n`);
      await expect(continuation.iterator.next()).resolves.toMatchObject({
        done: true,
      });
      expect(resolvedResponses).toEqual([]);
      await expect(
        server.store.readFixedObject(request.payload.locator),
      ).resolves.toMatchObject({
        logicalBytes: bytes.byteLength,
        verifiedContentDigest: request.payload.locator.contentDigest,
      });
    } finally {
      continuation.lines.close();
      continuation.socket.destroy();
    }

    await server.close();
    servers.delete(server);
    const restarted = new DurableObjectProviderRuntimeServerV1({
      rootPath: config.payload.runtimeRoot,
      socketPath: config.payload.socketPath,
      providerId: PROVIDER_ID,
      authKey,
      authorizedCapabilityDigest: CAPABILITY_DIGEST,
      principalAttestation: {
        privateKey: signingKey,
        handoffPayloadDigest: config.payloadDigest,
        publicKey: config.publicKey,
      },
      acceptanceIdentityVerificationCapability:
        await identityVerificationCapabilityV1(),
      mutationPolicy: "acceptance_authority_session_required",
      strongMutationAuthorityVerifier: verifierCapability,
    });
    const replayWrite = vi.spyOn(restarted.store, "writeFixedObject");
    await restarted.start();
    servers.add(restarted);
    expect(replayWrite).toHaveBeenCalledTimes(1);
    expect(resolvedResponses).toHaveLength(1);
    expect(resolvedResponses[0]).toMatchObject({
      ok: true,
      bindingDigest: request.bindingDigest,
      operation: "write_object",
      payload: { operation: "write_object", resolution: "committed" },
    });
  });

  it("recovers a durable signed outcome after resolve failure without executing the mutation again", async () => {
    let pending = false;
    let resolved = false;
    let resolveCalls = 0;
    const verifierCapability =
      mintProviderRuntimeStrongMutationAuthorityVerifierCapabilityInternalV1({
        consumeGrant() {
          if (resolved) return false;
          if (!pending) {
            pending = true;
            return { disposition: "execute" as const };
          }
          return { disposition: "recover" as const };
        },
        resolveGrant() {
          resolveCalls += 1;
          if (resolveCalls === 1) return false;
          resolved = true;
          return true;
        },
      });
    const verification = await identityVerificationCapabilityV1();
    const { config, server, authKey, signingKey } = await fixtureV1({
      acceptanceIdentityVerificationCapability: verification,
      mutationPolicy: "acceptance_authority_session_required",
      strongMutationAuthorityVerifier: verifierCapability,
    });
    const acceptance = finalAcceptanceV1();
    await server.store.compareCommit({
      expectedRevision: 0,
      operationNonce: "2".repeat(32),
      phase: "final_strong_ready",
      artifacts: finalStrongReadyArtifactsV1(acceptance),
    });
    const continuation = await openStrongContinuationV1(server.socketPath);
    const bytes = Buffer.from("durable resolve recovery", "utf8");
    const request = strongWriteRequestV1(continuation.attestation, bytes, "3");
    if (request.operation !== "write_object") {
      throw new Error("expected strong write request");
    }
    const firstWrite = vi.spyOn(server.store, "writeFixedObject");
    try {
      continuation.socket.write(`${JSON.stringify(request)}\n`);
      await expect(continuation.iterator.next()).resolves.toMatchObject({
        done: true,
      });
      expect(firstWrite).toHaveBeenCalledTimes(1);
    } finally {
      continuation.lines.close();
      continuation.socket.destroy();
    }

    await server.close();
    servers.delete(server);
    const restarted = new DurableObjectProviderRuntimeServerV1({
      rootPath: config.payload.runtimeRoot,
      socketPath: config.payload.socketPath,
      providerId: PROVIDER_ID,
      authKey,
      authorizedCapabilityDigest: CAPABILITY_DIGEST,
      principalAttestation: {
        privateKey: signingKey,
        handoffPayloadDigest: config.payloadDigest,
        publicKey: config.publicKey,
      },
      acceptanceIdentityVerificationCapability:
        await identityVerificationCapabilityV1(),
      mutationPolicy: "acceptance_authority_session_required",
      strongMutationAuthorityVerifier: verifierCapability,
    });
    const replayWrite = vi.spyOn(restarted.store, "writeFixedObject");
    await restarted.start();
    servers.add(restarted);
    expect(resolveCalls).toBe(2);
    expect(resolved).toBe(true);
    expect(replayWrite).not.toHaveBeenCalled();
    await expect(
      restarted.store.readFixedObject(request.payload.locator),
    ).resolves.toMatchObject({
      logicalBytes: bytes.byteLength,
      verifiedContentDigest: request.payload.locator.contentDigest,
    });
  });

  it("binds an unconsumed exact request to its original continuation socket", async () => {
    let consumeCalls = 0;
    const consumedGrants = new Set<string>();
    const verifierCapability =
      mintProviderRuntimeStrongMutationAuthorityVerifierCapabilityInternalV1({
        consumeGrant(context) {
          consumeCalls += 1;
          if (consumedGrants.has(context.authorityGrant.grantId)) return false;
          consumedGrants.add(context.authorityGrant.grantId);
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
      artifacts: finalStrongReadyArtifactsV1(acceptance),
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
      expect(consumedGrants).toEqual(
        new Set([request.authorityGrant.grantId]),
      );
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
      artifacts: finalStrongReadyArtifactsV1(acceptance),
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
        phase: "final_strong_ready",
        artifacts: finalStrongReadyArtifactsV1(acceptance),
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
          state: { revision: 2, phase: "final_strong_ready" },
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
      artifacts: finalStrongReadyArtifactsV1(acceptance),
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
      artifacts: finalStrongReadyArtifactsV1(acceptance),
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
      phase: "final_strong_ready",
      artifacts: finalStrongReadyArtifactsV1(acceptance),
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
      artifacts: finalStrongReadyArtifactsV1(acceptance),
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
