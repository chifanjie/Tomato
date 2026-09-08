import {
  createHash,
  createHmac,
  generateKeyPairSync,
  randomBytes,
  sign,
} from "node:crypto";
import { chmod, mkdtemp, rm } from "node:fs/promises";
import { createServer, type Server, type Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  deriveStoreProviderVerificationKeyIdV1,
} from "@understand-code/durable-object-provider-contracts/provider-registry";
import {
  canonicalizeJcsSafeIntegerUtf8V1,
} from "@understand-code/durable-object-provider-contracts/jcs";
import {
  CanonicalByteStringV1Schema,
  CanonicalPublicKeyBytes32V1Schema,
  ContentDigestV1Schema,
  DurableObjectIdentityProviderIdV1Schema,
  InstallationIdentityGenerationIdV1Schema,
  KeyedStateTokenV1Schema,
  LowerHex32V1Schema,
  ProviderTargetProfileIdV1Schema,
  ProviderRegistryManifestGenerationIdV1Schema,
  StoreProviderVerificationKeyIdV1Schema,
  type StoreProviderVerificationKeyIdV1,
} from "@understand-code/durable-object-provider-contracts/primitives";
import {
  mintProviderServiceInstallationIdentityVerificationCapabilityInternalV1,
} from "@understand-code/durable-object-provider-contracts/provider-service-installation-identity-custody-internal";
import {
  PROVIDER_RUNTIME_IPC_MAX_FRAME_BYTES_V1,
  PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
  ProviderRuntimeIpcPrincipalAttestationClaimsV1Schema,
  ProviderRuntimeIpcPrincipalAttestationV1Schema,
  ProviderRuntimeIpcPrincipalChallengeV1Schema,
  ProviderRuntimeIpcStrongMutationRequestV1Schema,
  ProviderRuntimeIpcStrongMutationResponseV1Schema,
  canonicalizeProviderRuntimeIpcPrincipalAttestationClaimsV1,
  canonicalizeProviderRuntimeIpcStrongMutationResponseClaimsV1,
} from "@understand-code/durable-object-provider-contracts/provider-runtime-ipc-v1";
import {
  PROVIDER_ACCEPTANCE_STATE_TOKEN_DOMAIN_V1,
  ProviderStrongReadyAcceptanceGenerationPinCandidateV1Schema,
  ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema,
  deriveProviderStrongReadyAcceptanceStateContentDigestV1,
  deriveProviderStrongReadyAcceptanceStateGenerationIdV1,
} from "@understand-code/durable-object-provider-contracts/provider-strong-ready-acceptance-candidate";
import {
  DurableObjectProviderRuntimeServerV1,
  PROVIDER_RUNTIME_DURABLE_LIFECYCLE_ARTIFACT_KEYS_V1,
  createProviderServiceHandoffConfigV1,
  generateProviderServiceSigningKeyPairV1,
} from "@understand-code/durable-object-provider-runtime";
import {
  mintProviderRuntimeStrongMutationAuthorityVerifierCapabilityInternalV1,
} from "../../durable-object-provider-runtime/dist/strong-mutation-session-authority-internal.js";

import {
  consumeProviderRuntimeStrongMutationAuthorityGrantSignerCapabilityInternalV1,
  mintProviderRuntimeStrongMutationAuthorityGrantSignerCapabilityInternalV1,
  type ProviderRuntimeStrongMutationAuthorityGrantSignerCapabilityInternalV1,
} from "../src/provider-runtime-strong-mutation-authority-grant-signer-internal.js";
import {
  exchangeProviderRuntimeStrongMutationSameSocketInternalV1,
} from "../src/provider-runtime-strong-mutation-client-internal.js";

const PROVIDER_ID = DurableObjectIdentityProviderIdV1Schema.parse(
  "durable-object-provider:strong-client",
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
const TARGET_FINGERPRINT_DIGEST = ContentDigestV1Schema.parse(
  `sha256:${"d".repeat(64)}`,
);
const TARGET_PROFILE_ID = ProviderTargetProfileIdV1Schema.parse(
  `provider-target-profile:${"e".repeat(64)}`,
);
const INSTALLATION_IDENTITY =
  "installation-identity-generation:4fe634940e20afac35e02d" as const;
const INSTALLATION_IDENTITY_KEY = Uint8Array.from(
  { length: 32 },
  (_value, index) => index,
);

const roots = new Set<string>();
const servers = new Set<DurableObjectProviderRuntimeServerV1>();
const scriptedServers = new Set<Server>();
const scriptedSockets = new Set<Socket>();

afterEach(async () => {
  await Promise.all([...servers].map((server) => server.close()));
  servers.clear();
  for (const socket of scriptedSockets) socket.destroy();
  scriptedSockets.clear();
  await Promise.all(
    [...scriptedServers].map(
      (server) =>
        new Promise<void>((resolvePromise) => {
          server.close(() => resolvePromise());
        }),
    ),
  );
  scriptedServers.clear();
  await Promise.all(
    [...roots].map((root) => rm(root, { recursive: true, force: true })),
  );
  roots.clear();
});

function finalAcceptanceV1() {
  const registryManifest = {
    locatorProfile: "installation_provider_registry_manifest_v1" as const,
    manifestGeneration: 1,
    generationId: ProviderRegistryManifestGenerationIdV1Schema.parse(
      `provider-registry-manifest:${"2".repeat(22)}`,
    ),
    contentDigest: ContentDigestV1Schema.parse(
      `sha256:${"2".repeat(64)}`,
    ),
  };
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
      providerRegistryManifest: registryManifest,
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
    acceptedAt: "2026-08-19T09:00:00Z",
  };
  const payload = {
    ...unsigned,
    acceptanceToken: KeyedStateTokenV1Schema.parse(
      `hmac-sha256:${createHmac("sha256", INSTALLATION_IDENTITY_KEY)
        .update(
          canonicalizeJcsSafeIntegerUtf8V1([
            PROVIDER_ACCEPTANCE_STATE_TOKEN_DOMAIN_V1,
            unsigned,
          ]),
        )
        .digest("hex")}`,
    ),
  };
  const envelope =
    ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema.parse({
      schemaVersion: 1,
      recordType: "provider_acceptance_state",
      generationId,
      installationIdentityGenerationId: INSTALLATION_IDENTITY,
      acceptedAt: payload.acceptedAt,
      contentDigest:
        deriveProviderStrongReadyAcceptanceStateContentDigestV1(payload),
      payload,
    });
  const pin =
    ProviderStrongReadyAcceptanceGenerationPinCandidateV1Schema.parse({
      locatorProfile: "installation_provider_acceptance_state_v1",
      acceptanceOrdinal: 1,
      generationId: envelope.generationId,
      contentDigest: envelope.contentDigest,
    });
  return { envelope, pin, registryManifest };
}

async function acceptanceVerificationCapabilityV1() {
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

async function lockedRuntimeFixtureV1(input?: {
  readonly testOnlyAuthorizeStrongMutation?: boolean;
}) {
  const root = await mkdtemp(join(tmpdir(), "uc-strong-client-"));
  roots.add(root);
  await chmod(root, 0o700);
  const signing = generateProviderServiceSigningKeyPairV1();
  const config = createProviderServiceHandoffConfigV1({
    privateKey: signing.privateKey,
    payload: {
      schemaVersion: 1,
      profile: "understand_code_provider_service_handoff_payload_v1",
      platform: process.platform === "darwin" ? "darwin" : "linux",
      serviceLabel: "uc-strong-client-test",
      providerId: PROVIDER_ID,
      principal: {
        kind: "dedicated_os_principal",
        name: "ucprovider",
        uid: process.getuid!(),
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
  const server = new DurableObjectProviderRuntimeServerV1({
    rootPath: root,
    socketPath: config.payload.socketPath,
    providerId: PROVIDER_ID,
    authKey: randomBytes(32),
    authorizedCapabilityDigest: CAPABILITY_DIGEST,
    principalAttestation: {
      privateKey: signing.privateKey,
      handoffPayloadDigest: config.payloadDigest,
      publicKey: config.publicKey,
    },
    acceptanceIdentityVerificationCapability:
      await acceptanceVerificationCapabilityV1(),
    mutationPolicy: "acceptance_authority_session_required",
    ...(input?.testOnlyAuthorizeStrongMutation === true
      ? {
          // Test-only wire exerciser. This is not a production verifier and
          // intentionally proves no Registry/target/replay authority.
          strongMutationAuthorityVerifier:
            mintProviderRuntimeStrongMutationAuthorityVerifierCapabilityInternalV1({
              consumeGrant: () => true,
            }),
        }
      : {}),
  });
  await server.start();
  servers.add(server);
  const acceptance = finalAcceptanceV1();
  await server.store.compareCommit({
    expectedRevision: 0,
    operationNonce: "1".repeat(32),
    phase: "final_strong_ready",
    artifacts: {
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
    },
  });
  const state = server.store.inspectState();
  const acceptanceIdentity = {
    generationId: acceptance.envelope.generationId,
    contentDigest: acceptance.envelope.contentDigest,
    acceptanceOrdinal: acceptance.envelope.payload.acceptanceOrdinal,
    installationIdentityGenerationId:
      acceptance.envelope.installationIdentityGenerationId,
  };
  return {
    config,
    server,
    state,
    acceptance,
    acceptanceIdentity,
    signing,
  };
}

function grantKeyV1() {
  const pair = generateKeyPairSync("ed25519");
  const publicSpki = Buffer.from(
    pair.publicKey.export({ format: "der", type: "spki" }),
  );
  const publicKeyBytes = CanonicalPublicKeyBytes32V1Schema.parse(
    `base64url:${publicSpki.subarray(-32).toString("base64url")}`,
  );
  return {
    privateKeyPkcs8: () => new Uint8Array(
      pair.privateKey.export({ format: "der", type: "pkcs8" }),
    ),
    publicKeyBytes,
    signerKeyId: deriveStoreProviderVerificationKeyIdV1({
      providerId: PROVIDER_ID,
      usage: "strong_mutation_authority_grant",
      publicKeyBytes,
    }),
  };
}

function exchangeInputV1(
  fixture: Awaited<ReturnType<typeof lockedRuntimeFixtureV1>>,
  mintSigner: Parameters<
    typeof exchangeProviderRuntimeStrongMutationSameSocketInternalV1
  >[0]["mintSigner"],
  signerKeyId: StoreProviderVerificationKeyIdV1 =
    StoreProviderVerificationKeyIdV1Schema.parse("a".repeat(22)),
  journalRevision = fixture.state.revision,
) {
  const bytes = Buffer.from("locked strong mutation wire bytes", "utf8");
  return {
    socketPath: fixture.config.payload.socketPath,
    expectedPrincipal: {
      providerId: PROVIDER_ID,
      capabilityDigest: CAPABILITY_DIGEST,
      handoffPayloadDigest: fixture.config.payloadDigest,
      servicePublicKey: CanonicalByteStringV1Schema.parse(
        fixture.config.publicKey,
      ),
      journalHead: {
        revision: journalRevision,
        phase: fixture.state.phase,
        mutationDigest: fixture.state.mutationDigest,
      },
      acceptanceIdentity: fixture.acceptanceIdentity,
    },
    grantStaticFields: {
      signerKeyId,
      targetProfileId: TARGET_PROFILE_ID,
      targetFingerprintDigest: TARGET_FINGERPRINT_DIGEST,
      registryManifest: fixture.acceptance.registryManifest,
    },
    request: {
      operation: "write_object" as const,
      operationNonce: LowerHex32V1Schema.parse("2".repeat(32)),
      payload: {
        locator: {
          providerId: PROVIDER_ID,
          contentDigest: ContentDigestV1Schema.parse(
            `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
          ),
        },
        logicalBytes: bytes.byteLength,
        bytes: CanonicalByteStringV1Schema.parse(
          `base64url:${bytes.toString("base64url")}`,
        ),
      },
    },
    mintSigner,
  };
}

async function replaceWithScriptedServerV1(
  fixture: Awaited<ReturnType<typeof lockedRuntimeFixtureV1>>,
  behavior: Readonly<{
    readonly tamperPrincipalSignature?: boolean;
    readonly driftResponseEcho?: boolean;
    readonly closeAfterStrongRequest?: boolean;
    readonly stallBeforePrincipal?: boolean;
    readonly closeAfterPrincipal?: boolean;
    readonly sendOversizedUnterminatedPrincipalFrame?: boolean;
    readonly appendTrailingResponseFrame?: boolean;
  }>,
) {
  await fixture.server.close();
  servers.delete(fixture.server);
  let connectionCount = 0;
  let strongRequestCount = 0;
  const server = createServer((socket) => {
    scriptedSockets.add(socket);
    socket.once("close", () => scriptedSockets.delete(socket));
    socket.on("error", () => undefined);
    connectionCount += 1;
    const lines = createInterface({ input: socket, crlfDelay: Infinity });
    const iterator = lines[Symbol.asyncIterator]();
    void (async () => {
      try {
        const first = await iterator.next();
        if (first.done) throw new Error("challenge missing");
        const challenge = ProviderRuntimeIpcPrincipalChallengeV1Schema.parse(
          JSON.parse(first.value),
        );
        if (behavior.stallBeforePrincipal === true) return;
        if (
          behavior.sendOversizedUnterminatedPrincipalFrame === true
        ) {
          socket.write(
            Buffer.alloc(
              PROVIDER_RUNTIME_IPC_MAX_FRAME_BYTES_V1 + 1,
              0x61,
            ),
          );
          return;
        }
        const claims =
          ProviderRuntimeIpcPrincipalAttestationClaimsV1Schema.parse({
            providerId: PROVIDER_ID,
            capabilityDigest: CAPABILITY_DIGEST,
            challenge: challenge.challenge,
            connectionNonce: "9".repeat(64),
            processId: process.pid,
            revision: fixture.state.revision,
            phase: fixture.state.phase,
            mutationDigest: fixture.state.mutationDigest,
            handoffPayloadDigest: fixture.config.payloadDigest,
            publicKey: fixture.config.publicKey,
            acceptanceIdentity: fixture.acceptanceIdentity,
          });
        const principalSigningKey = behavior.tamperPrincipalSignature === true
          ? generateKeyPairSync("ed25519").privateKey
          : fixture.signing.privateKey;
        const attestation = ProviderRuntimeIpcPrincipalAttestationV1Schema.parse({
          protocol: PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
          kind: "principal_attestation",
          ...claims,
          signature: `base64url:${sign(
            null,
            canonicalizeProviderRuntimeIpcPrincipalAttestationClaimsV1(claims),
            principalSigningKey,
          ).toString("base64url")}`,
        });
        const attestationFrame = `${JSON.stringify(attestation)}\n`;
        if (behavior.closeAfterPrincipal === true) {
          socket.end(attestationFrame);
          return;
        }
        socket.write(attestationFrame);

        const second = await iterator.next();
        if (second.done) return;
        const request = ProviderRuntimeIpcStrongMutationRequestV1Schema.parse(
          JSON.parse(second.value),
        );
        strongRequestCount += 1;
        if (behavior.closeAfterStrongRequest === true) {
          socket.destroy();
          return;
        }
        const unsigned = ProviderRuntimeIpcStrongMutationResponseV1Schema.parse({
          protocol: PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
          kind: "strong_mutation_response",
          requestId: behavior.driftResponseEcho === true
            ? "f".repeat(32)
            : request.requestId,
          principalAttestationDigest: request.principalAttestationDigest,
          bindingDigest: request.bindingDigest,
          operation: request.operation,
          operationNonce: request.operationNonce,
          requestDigest: request.requestDigest,
          ok: false,
          error: {
            code: "capability_mismatch",
            message: "scripted test denial",
          },
          signature: `base64url:${Buffer.alloc(64).toString("base64url")}`,
        });
        const response = ProviderRuntimeIpcStrongMutationResponseV1Schema.parse({
          ...unsigned,
          signature: `base64url:${sign(
            null,
            canonicalizeProviderRuntimeIpcStrongMutationResponseClaimsV1(
              unsigned,
            ),
            fixture.signing.privateKey,
          ).toString("base64url")}`,
        });
        socket.end(
          `${JSON.stringify(response)}\n${behavior.appendTrailingResponseFrame === true ? "{}\n" : ""}`,
        );
      } catch {
        socket.destroy();
      } finally {
        lines.close();
      }
    })();
  });
  await new Promise<void>((resolvePromise, rejectPromise) => {
    server.once("error", rejectPromise);
    server.listen(fixture.config.payload.socketPath, () => {
      server.off("error", rejectPromise);
      resolvePromise();
    });
  });
  scriptedServers.add(server);
  return {
    get connectionCount() {
      return connectionCount;
    },
    get strongRequestCount() {
      return strongRequestCount;
    },
  };
}

describe("client-private same-socket strong mutation exchange", () => {
  it("completes the real same-socket wire with an explicit test-only verifier", async () => {
    const fixture = await lockedRuntimeFixtureV1({
      testOnlyAuthorizeStrongMutation: true,
    });
    const grantKey = grantKeyV1();
    const mintSigner = vi.fn((grantFields) => {
      expect(grantFields.targetProfileId).toBe(TARGET_PROFILE_ID);
      expect(grantFields.targetFingerprintDigest).toBe(
        TARGET_FINGERPRINT_DIGEST,
      );
      return mintProviderRuntimeStrongMutationAuthorityGrantSignerCapabilityInternalV1({
        privateKeyPkcs8: grantKey.privateKeyPkcs8(),
        expectedPublicKeyBytes: grantKey.publicKeyBytes,
        grantFields,
      });
    });

    await expect(
      exchangeProviderRuntimeStrongMutationSameSocketInternalV1(
        exchangeInputV1(fixture, mintSigner, grantKey.signerKeyId),
      ),
    ).resolves.toMatchObject({
      operation: "write_object",
      resolution: "committed",
    });
    expect(mintSigner).toHaveBeenCalledTimes(1);
  });

  it("reaches the real locked runtime over one continuation and verifies its signed denial", async () => {
    const fixture = await lockedRuntimeFixtureV1();
    const grantKey = grantKeyV1();
    const mintSigner = vi.fn((grantFields) =>
      mintProviderRuntimeStrongMutationAuthorityGrantSignerCapabilityInternalV1({
        privateKeyPkcs8: grantKey.privateKeyPkcs8(),
        expectedPublicKeyBytes: grantKey.publicKeyBytes,
        grantFields,
      })
    );
    const input = exchangeInputV1(
      fixture,
      mintSigner,
      grantKey.signerKeyId,
    );

    await expect(
      exchangeProviderRuntimeStrongMutationSameSocketInternalV1(input),
    ).rejects.toMatchObject({
      code: "runtime_rejected",
      runtimeCode: "capability_mismatch",
    });
    expect(mintSigner).toHaveBeenCalledTimes(1);
    expect(fixture.server.store.inspectState()).toEqual(fixture.state);
  });

  it("rejects journal drift before requesting or consuming a signer", async () => {
    const fixture = await lockedRuntimeFixtureV1();
    const mintSigner = vi.fn();
    const input = exchangeInputV1(
      fixture,
      mintSigner,
      undefined,
      fixture.state.revision + 1,
    );

    await expect(
      exchangeProviderRuntimeStrongMutationSameSocketInternalV1(input),
    ).rejects.toMatchObject({ code: "principal_invalid" });
    expect(mintSigner).not.toHaveBeenCalled();
  });

  it("rejects a bad principal signature before requesting a signer", async () => {
    const fixture = await lockedRuntimeFixtureV1();
    const scripted = await replaceWithScriptedServerV1(fixture, {
      tamperPrincipalSignature: true,
    });
    const mintSigner = vi.fn();

    await expect(
      exchangeProviderRuntimeStrongMutationSameSocketInternalV1(
        exchangeInputV1(fixture, mintSigner),
      ),
    ).rejects.toMatchObject({ code: "principal_invalid" });
    expect(mintSigner).not.toHaveBeenCalled();
    expect(scripted.connectionCount).toBe(1);
    expect(scripted.strongRequestCount).toBe(0);
  });

  it("maps a silent post-connect timeout to one typed transport failure", async () => {
    const fixture = await lockedRuntimeFixtureV1();
    const scripted = await replaceWithScriptedServerV1(fixture, {
      stallBeforePrincipal: true,
    });
    const mintSigner = vi.fn();

    await expect(
      exchangeProviderRuntimeStrongMutationSameSocketInternalV1({
        ...exchangeInputV1(fixture, mintSigner),
        timeoutMs: 25,
      }),
    ).rejects.toMatchObject({ code: "transport_unavailable" });
    expect(mintSigner).not.toHaveBeenCalled();
    expect(scripted.connectionCount).toBe(1);
    expect(scripted.strongRequestCount).toBe(0);
  });

  it("maps peer close or EPIPE after attestation and burns the sole grant", async () => {
    const fixture = await lockedRuntimeFixtureV1();
    const scripted = await replaceWithScriptedServerV1(fixture, {
      closeAfterPrincipal: true,
    });
    const grantKey = grantKeyV1();
    let issued:
      | ProviderRuntimeStrongMutationAuthorityGrantSignerCapabilityInternalV1
      | undefined;
    const mintSigner = vi.fn((grantFields) => {
      issued =
        mintProviderRuntimeStrongMutationAuthorityGrantSignerCapabilityInternalV1({
          privateKeyPkcs8: grantKey.privateKeyPkcs8(),
          expectedPublicKeyBytes: grantKey.publicKeyBytes,
          grantFields,
        });
      return issued;
    });

    await expect(
      exchangeProviderRuntimeStrongMutationSameSocketInternalV1(
        exchangeInputV1(fixture, mintSigner, grantKey.signerKeyId),
      ),
    ).rejects.toMatchObject({ code: "transport_unavailable" });
    expect(mintSigner).toHaveBeenCalledTimes(1);
    expect(scripted.connectionCount).toBe(1);
    expect(scripted.strongRequestCount).toBe(0);
    expect(
      consumeProviderRuntimeStrongMutationAuthorityGrantSignerCapabilityInternalV1(
        issued!,
      ),
    ).toBeUndefined();
  });

  it("destroys an unterminated oversized frame before requesting a signer", async () => {
    const fixture = await lockedRuntimeFixtureV1();
    const scripted = await replaceWithScriptedServerV1(fixture, {
      sendOversizedUnterminatedPrincipalFrame: true,
    });
    const mintSigner = vi.fn();

    await expect(
      exchangeProviderRuntimeStrongMutationSameSocketInternalV1(
        exchangeInputV1(fixture, mintSigner),
      ),
    ).rejects.toMatchObject({ code: "transport_unavailable" });
    expect(mintSigner).not.toHaveBeenCalled();
    expect(scripted.connectionCount).toBe(1);
    expect(scripted.strongRequestCount).toBe(0);
  });

  it("rejects a validly signed response whose request echo drifted", async () => {
    const fixture = await lockedRuntimeFixtureV1();
    const scripted = await replaceWithScriptedServerV1(fixture, {
      driftResponseEcho: true,
    });
    const grantKey = grantKeyV1();
    const mintSigner = vi.fn((grantFields) =>
      mintProviderRuntimeStrongMutationAuthorityGrantSignerCapabilityInternalV1({
        privateKeyPkcs8: grantKey.privateKeyPkcs8(),
        expectedPublicKeyBytes: grantKey.publicKeyBytes,
        grantFields,
      })
    );

    await expect(
      exchangeProviderRuntimeStrongMutationSameSocketInternalV1(
        exchangeInputV1(fixture, mintSigner, grantKey.signerKeyId),
      ),
    ).rejects.toMatchObject({ code: "response_invalid" });
    expect(mintSigner).toHaveBeenCalledTimes(1);
    expect(scripted.connectionCount).toBe(1);
    expect(scripted.strongRequestCount).toBe(1);
  });

  it("rejects a signed response followed by a trailing frame", async () => {
    const fixture = await lockedRuntimeFixtureV1();
    const scripted = await replaceWithScriptedServerV1(fixture, {
      appendTrailingResponseFrame: true,
    });
    const grantKey = grantKeyV1();
    const mintSigner = vi.fn((grantFields) =>
      mintProviderRuntimeStrongMutationAuthorityGrantSignerCapabilityInternalV1({
        privateKeyPkcs8: grantKey.privateKeyPkcs8(),
        expectedPublicKeyBytes: grantKey.publicKeyBytes,
        grantFields,
      })
    );

    await expect(
      exchangeProviderRuntimeStrongMutationSameSocketInternalV1(
        exchangeInputV1(fixture, mintSigner, grantKey.signerKeyId),
      ),
    ).rejects.toMatchObject({ code: "transport_unavailable" });
    expect(mintSigner).toHaveBeenCalledTimes(1);
    expect(scripted.connectionCount).toBe(1);
    expect(scripted.strongRequestCount).toBe(1);
  });

  it("does not reconnect or mint another grant after post-consume transport failure", async () => {
    const fixture = await lockedRuntimeFixtureV1();
    const scripted = await replaceWithScriptedServerV1(fixture, {
      closeAfterStrongRequest: true,
    });
    const grantKey = grantKeyV1();
    const mintSigner = vi.fn((grantFields) =>
      mintProviderRuntimeStrongMutationAuthorityGrantSignerCapabilityInternalV1({
        privateKeyPkcs8: grantKey.privateKeyPkcs8(),
        expectedPublicKeyBytes: grantKey.publicKeyBytes,
        grantFields,
      })
    );

    await expect(
      exchangeProviderRuntimeStrongMutationSameSocketInternalV1(
        exchangeInputV1(fixture, mintSigner, grantKey.signerKeyId),
      ),
    ).rejects.toMatchObject({ code: "transport_unavailable" });
    expect(mintSigner).toHaveBeenCalledTimes(1);
    expect(scripted.connectionCount).toBe(1);
    expect(scripted.strongRequestCount).toBe(1);
  });
});
