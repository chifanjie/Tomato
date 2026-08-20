import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  deriveProviderRuntimeIpcStrongMutationAuthorityGrantContentDigestV1,
  type ProviderRuntimeIpcPrincipalAttestationV1,
  type ProviderRuntimeIpcStrongMutationRequestV1,
  type ProviderRuntimeIpcStrongMutationResponseV1,
} from "@understand-code/durable-object-provider-contracts/provider-runtime-ipc-v1";
import { ProviderAcceptanceCurrentReadV1Schema } from "@understand-code/durable-object-provider-contracts/provider-acceptance";
import { afterEach, describe, expect, it } from "vitest";

import {
  classifyProviderStrongMutationTrustEvidenceSnapshotAdmissionForTestInternalV1,
  createProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1,
  inspectProviderStrongMutationBrokerSnapshotForTestInternalV1,
  openProviderAcceptanceAuthorityStoreForTestInternalV1,
  openProviderStrongMutationBrokerStoreForTestInternalV1,
  provisionProviderAcceptanceAuthorityForTestInternalV1,
  providerStrongMutationTrustEvidenceSnapshotLimitsForTestInternalV1,
} from "../src/test-seam-internal.js";
import {
  TEST_INSTALLATION_IDENTITY_KEY,
  cloneJsonV1,
  genesisRequestV1,
  operationNonceV1,
  successorRequestV1,
  testAuthorityClockV1,
} from "./acceptance-store-fixtures.js";
import {
  TEST_BROKER_INSTALLATION_IDENTITY_GENERATION_ID,
  brokerResolveRequestV1,
  currentAcceptanceIdentityV1,
  strongMutationBindingDigestOracleV1,
  strongMutationPrincipalAttestationV1,
  strongMutationRequestV1,
  strongMutationResponseV1,
  strongMutationTrustedConfigurationV1,
  strongMutationTrustEvidenceV1,
  strongMutationTrustRegistryV1,
  strongMutationTrustVerifierV1,
  type StrongMutationTrustRegistryV1,
} from "./strong-mutation-broker-fixtures.js";

const fixtureRoots = new Set<string>();

afterEach(async () => {
  await Promise.all(
    [...fixtureRoots].map((root) => rm(root, { recursive: true, force: true })),
  );
  fixtureRoots.clear();
});

type EvidenceV1 = ReturnType<typeof strongMutationTrustEvidenceV1>;

async function fixtureV1(options: Readonly<{
  acceptanceRegistry?: StrongMutationTrustRegistryV1;
  evidenceRegistry?: StrongMutationTrustRegistryV1;
  configuration?: ReturnType<typeof strongMutationTrustedConfigurationV1>;
  principalAttestation?: (
    identity: ReturnType<typeof currentAcceptanceIdentityV1>,
  ) => ProviderRuntimeIpcPrincipalAttestationV1;
  readEvidence?: (
    query: Parameters<
      NonNullable<Parameters<typeof strongMutationTrustVerifierV1>[0]>
    >[0],
    evidence: EvidenceV1,
  ) => unknown | Promise<unknown>;
}> = {}) {
  const root = await mkdtemp(join(tmpdir(), "broker-trust-verifier-"));
  fixtureRoots.add(root);
  const capability =
    createProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1(root);
  await provisionProviderAcceptanceAuthorityForTestInternalV1(capability, {
    installationIdentityGenerationId:
      TEST_BROKER_INSTALLATION_IDENTITY_GENERATION_ID,
    installationIdentityKey: TEST_INSTALLATION_IDENTITY_KEY,
  });
  const acceptanceRegistry =
    options.acceptanceRegistry ?? strongMutationTrustRegistryV1();
  const acceptance =
    await openProviderAcceptanceAuthorityStoreForTestInternalV1(capability, {
      clock: testAuthorityClockV1,
    });
  await acceptance.compareAppend(genesisRequestV1({
    installationIdentityGenerationId:
      TEST_BROKER_INSTALLATION_IDENTITY_GENERATION_ID,
    configuration:
      options.configuration ??
      strongMutationTrustedConfigurationV1(acceptanceRegistry),
  }));
  const read = await acceptance.readCurrent();
  if (read.state !== "current") throw new Error("expected Acceptance current");
  const current = ProviderAcceptanceCurrentReadV1Schema.parse(read.current);
  const identity = currentAcceptanceIdentityV1(current);
  const principalAttestation =
    options.principalAttestation?.(identity) ??
    strongMutationPrincipalAttestationV1(identity);
  const evidenceRegistry = options.evidenceRegistry ?? acceptanceRegistry;
  const evidence = strongMutationTrustEvidenceV1(identity, {
    registry: evidenceRegistry,
    principalAttestation,
  });
  let evidenceReadCount = 0;
  const verifier = await strongMutationTrustVerifierV1(async (query) => {
    evidenceReadCount += 1;
    return options.readEvidence === undefined
      ? evidence
      : await options.readEvidence(query, evidence);
  });
  const broker =
    await openProviderStrongMutationBrokerStoreForTestInternalV1(
      capability,
      verifier,
      { clock: testAuthorityClockV1 },
    );
  return {
    root,
    capability,
    acceptance,
    current,
    principalAttestation,
    evidence,
    evidenceRegistry,
    verifier,
    broker,
    evidenceReadCount: () => evidenceReadCount,
  };
}

async function brokerArtifactsV1(root: string): Promise<readonly string[]> {
  return (await readdir(join(root, "runtime-state/private")))
    .filter((name) => name.includes("strong-mutation-broker"))
    .sort();
}

async function expectBeginRejectedWithoutWriteV1(
  fixture: Awaited<ReturnType<typeof fixtureV1>>,
  request: unknown,
): Promise<void> {
  expect(await brokerArtifactsV1(fixture.root)).toEqual([]);
  await expect(fixture.broker.begin(request)).rejects.toMatchObject({
    code: "invalid_request",
  });
  expect(await brokerArtifactsV1(fixture.root)).toEqual([]);
}

function requestWithGrantSignatureLengthV1(
  request: ProviderRuntimeIpcStrongMutationRequestV1,
  length: number,
): unknown {
  const mutated: any = cloneJsonV1(request);
  mutated.authorityGrant.payload.signature =
    `base64url:${Buffer.alloc(length, 0x5a).toString("base64url")}`;
  mutated.authorityGrant.contentDigest =
    deriveProviderRuntimeIpcStrongMutationAuthorityGrantContentDigestV1(
      mutated.authorityGrant.payload,
    );
  mutated.bindingDigest = strongMutationBindingDigestOracleV1({
    principalAttestationDigest: mutated.principalAttestationDigest,
    operation: mutated.operation,
    operationNonce: mutated.operationNonce,
    requestDigest: mutated.requestDigest,
    authorityGrant: mutated.authorityGrant,
  });
  return mutated;
}

describe("strong-mutation strict trust verifier", () => {
  it.each(["initial", "rotated"] as const)(
    "accepts the %s active Registry key, grant-bound principal self-signature, and response while remaining locked",
    async (state) => {
      const registry = strongMutationTrustRegistryV1(state);
      const fixture = await fixtureV1({
        acceptanceRegistry: registry,
        evidenceRegistry: registry,
      });
      const request = strongMutationRequestV1(fixture.current, {
        registry,
        principalAttestation: fixture.principalAttestation,
      });
      const begun = await fixture.broker.begin(request);
      expect(begun).toMatchObject({
        resolution: "recorded",
        disposition: "created",
        intent: {
          state: "pending",
          strongWrites: "locked",
          executionFence: "not_established",
          grantVerification:
            "strict_registry_acceptance_grant_bound_principal_self_signature_verified_v1",
          verificationCertificate: {
            verificationAlgorithm: "strict_ed25519_v1",
            grantSigner: {
              keyId: registry.activeKey.keyId,
              publicKeyBytes: registry.activeKey.publicKeyBytes,
              publicKeyDigest: registry.activeKey.publicKeyDigest,
            },
            grantContentDigest: request.authorityGrant.contentDigest,
            principalAttestationDigest: request.principalAttestationDigest,
          },
        },
      });
      if (begun.resolution !== "recorded") throw new Error("expected intent");
      const response = strongMutationResponseV1(request);
      const resolved = await fixture.broker.resolve(
        brokerResolveRequestV1(begun.intent, response),
      );
      expect(resolved).toMatchObject({
        resolution: "resolved",
        disposition: "created",
        intent: {
          state: "resolved",
          responseVerification:
            "strict_grant_bound_principal_response_signature_verified_v1",
          executionFence: "not_established",
          strongWrites: "locked",
        },
      });
      expect(fixture.broker).toMatchObject({
        strongWrites: "locked",
        executionFence: "not_established",
      });
    },
  );

  it("keeps a G1 pending intent verifiable while Acceptance advances to a different strong-ready G2 Registry pin", async () => {
    const registryG1 = strongMutationTrustRegistryV1("initial");
    const registryG2 = strongMutationTrustRegistryV1("rotated");
    const g1Manifest = registryG1.history.at(-1)!;
    const g2Manifest = registryG2.history.at(-1)!;
    const fixture = await fixtureV1({
      acceptanceRegistry: registryG1,
      evidenceRegistry: registryG1,
      readEvidence: (query) => {
        const registry = query.registryManifest.contentDigest ===
            g1Manifest.contentDigest
          ? registryG1
          : query.registryManifest.contentDigest === g2Manifest.contentDigest
          ? registryG2
          : undefined;
        if (registry === undefined) throw new Error("unknown Registry pin");
        return strongMutationTrustEvidenceV1(query.acceptanceIdentity, {
          registry,
          principalAttestation: strongMutationPrincipalAttestationV1(
            query.acceptanceIdentity,
          ),
        });
      },
    });
    const requestG1 = strongMutationRequestV1(fixture.current, {
      registry: registryG1,
      principalAttestation: fixture.principalAttestation,
    });
    const begunG1 = await fixture.broker.begin(requestG1);
    if (begunG1.resolution !== "recorded") throw new Error("expected G1 intent");
    await fixture.acceptance.compareAppend(successorRequestV1({
      current: fixture.current,
      operationNonce: operationNonceV1(2),
      configuration: strongMutationTrustedConfigurationV1(registryG2),
    }));
    const g2Read = await fixture.acceptance.readCurrent();
    if (g2Read.state !== "current") throw new Error("expected G2 current");
    const currentG2 = ProviderAcceptanceCurrentReadV1Schema.parse(
      g2Read.current,
    );
    const requestG2 = strongMutationRequestV1(currentG2, {
      registry: registryG2,
      principalAttestation: strongMutationPrincipalAttestationV1(
        currentAcceptanceIdentityV1(currentG2),
      ),
      nonceDigit: "6",
      requestId: "6".repeat(32),
    });
    const begunG2 = await fixture.broker.begin(requestG2);
    expect(begunG2).toMatchObject({
      resolution: "recorded",
      disposition: "created",
      intent: {
        acceptanceIdentity: currentAcceptanceIdentityV1(currentG2),
      },
    });
    const responseG1 = strongMutationResponseV1(requestG1);
    const created = await fixture.broker.resolve(
      brokerResolveRequestV1(begunG1.intent, responseG1),
    );
    expect(created).toMatchObject({
      resolution: "resolved",
      disposition: "created",
      intent: {
        responseVerification:
          "strict_grant_bound_principal_response_signature_verified_v1",
        executionFence: "not_established",
      },
    });
    const restarted =
      await openProviderStrongMutationBrokerStoreForTestInternalV1(
        fixture.capability,
        fixture.verifier,
        { clock: testAuthorityClockV1 },
      );
    await expect(restarted.resolve(
      brokerResolveRequestV1(begunG1.intent, responseG1),
    )).resolves.toMatchObject({
      resolution: "resolved",
      disposition: "replayed",
      intent: { executionFence: "not_established" },
    });
    await expect(restarted.begin(requestG2)).resolves.toMatchObject({
      resolution: "recorded",
      disposition: "replayed",
      intent: { state: "pending" },
    });
    await expect(
      inspectProviderStrongMutationBrokerSnapshotForTestInternalV1(
        fixture.capability,
        fixture.verifier,
      ),
    ).resolves.toMatchObject({
      intentCount: 2,
      pendingCount: 1,
      resolvedCount: 1,
    });
  });

  it.each([
    "rotated key",
    "wrong signer keyId",
    "revoked key",
    "wrong key usage",
    "wrong key provider",
    "wrong Registry entry digest",
    "wrong active writer",
    "wrong Acceptance Registry pin",
    "grant signature bitflip",
    "principal provider join",
    "principal SPKI prefix",
    "principal signature bitflip",
    "principal transcript/digest join",
  ] as const)("rejects %s before the first broker write", async (name) => {
    let registry = strongMutationTrustRegistryV1();
    let fixtureOptions: Parameters<typeof fixtureV1>[0] = {};
    let requestOptions: Parameters<typeof strongMutationRequestV1>[1] = {};

    if (name === "rotated key") {
      registry = strongMutationTrustRegistryV1("rotated");
      fixtureOptions = {
        acceptanceRegistry: registry,
        evidenceRegistry: registry,
      };
      requestOptions = {
        registry,
        signerKey: registry.initialKey,
        signerSeed: registry.initialSeed,
      };
    } else if (name === "wrong signer keyId") {
      const otherKey = strongMutationTrustRegistryV1("rotated").activeKey;
      requestOptions = {
        registry,
        signerKeyId: otherKey.keyId,
      };
    } else if (name === "revoked key") {
      registry = strongMutationTrustRegistryV1("revoked");
      fixtureOptions = {
        acceptanceRegistry: registry,
        evidenceRegistry: registry,
      };
      requestOptions = { registry };
    } else if (name === "wrong key usage") {
      registry = strongMutationTrustRegistryV1("initial", {
        initialKeyUsage: "operation_receipt",
      });
      fixtureOptions = {
        acceptanceRegistry: registry,
        evidenceRegistry: registry,
      };
      requestOptions = { registry };
    } else if (name === "wrong key provider") {
      registry = strongMutationTrustRegistryV1("initial", {
        initialKeyProviderId: "durable-object-provider:native-a",
      });
      fixtureOptions = {
        acceptanceRegistry: registry,
        evidenceRegistry: registry,
      };
      requestOptions = { registry };
    } else if (name === "wrong Registry entry digest") {
      fixtureOptions = {
        configuration: strongMutationTrustedConfigurationV1(registry, {
          selectorEntryContentDigest: `sha256:${"0".repeat(64)}`,
        }),
      };
      requestOptions = { registry };
    } else if (name === "wrong active writer") {
      fixtureOptions = {
        configuration: strongMutationTrustedConfigurationV1(registry, {
          selectorProviderId: "durable-object-provider:native-a",
        }),
      };
      requestOptions = { registry };
    } else if (name === "wrong Acceptance Registry pin") {
      const rotated = strongMutationTrustRegistryV1("rotated");
      fixtureOptions = {
        acceptanceRegistry: registry,
        evidenceRegistry: rotated,
      };
      requestOptions = { registry: rotated };
    } else if (name === "grant signature bitflip") {
      requestOptions = { registry, grantSignatureBitFlip: true };
    } else if (name === "principal provider join") {
      fixtureOptions = {
        principalAttestation: (identity) =>
          strongMutationPrincipalAttestationV1(identity, {
            claimsOverrides: {
              providerId: "durable-object-provider:native-a",
            },
          }),
      };
    } else if (name === "principal SPKI prefix") {
      fixtureOptions = {
        principalAttestation: (identity) => {
          const valid = strongMutationPrincipalAttestationV1(identity);
          const spki = Buffer.from(
            valid.publicKey.slice("base64url:".length),
            "base64url",
          );
          spki[0] = (spki[0] ?? 0) ^ 1;
          return strongMutationPrincipalAttestationV1(identity, {
            publicKey: `base64url:${spki.toString("base64url")}`,
          });
        },
      };
    } else if (name === "principal signature bitflip") {
      fixtureOptions = {
        principalAttestation: (identity) =>
          strongMutationPrincipalAttestationV1(identity, {
            signatureBitFlip: true,
          }),
      };
    } else if (name === "principal transcript/digest join") {
      fixtureOptions = {
        readEvidence: (_query, evidence) => ({
          ...evidence,
          principalAttestation: strongMutationPrincipalAttestationV1(
            evidence.principalAttestation.acceptanceIdentity!,
            { claimsOverrides: { challenge: "c".repeat(64) } },
          ),
        }),
      };
    }

    const fixture = await fixtureV1(fixtureOptions);
    const request = strongMutationRequestV1(fixture.current, {
      registry,
      principalAttestation: fixture.principalAttestation,
      ...requestOptions,
    });
    await expectBeginRejectedWithoutWriteV1(fixture, request);
  });

  it.each([0, 63, 65])(
    "rejects a %i-byte grant signature at the formal envelope boundary before any broker write",
    async (length) => {
      const fixture = await fixtureV1();
      const request = strongMutationRequestV1(fixture.current, {
        registry: fixture.evidenceRegistry,
        principalAttestation: fixture.principalAttestation,
      });
      expect(() => requestWithGrantSignatureLengthV1(request, length))
        .toThrow();
      expect(await brokerArtifactsV1(fixture.root)).toEqual([]);
    },
  );

  it("rejects response-claim, signature-bit, and signature-length tampering at zero broker writes", async () => {
    const fixture = await fixtureV1();
    const request = strongMutationRequestV1(fixture.current, {
      registry: fixture.evidenceRegistry,
      principalAttestation: fixture.principalAttestation,
    });
    const begun = await fixture.broker.begin(request);
    if (begun.resolution !== "recorded") throw new Error("expected intent");
    const before = await inspectProviderStrongMutationBrokerSnapshotForTestInternalV1(
      fixture.capability,
      fixture.verifier,
    );
    const valid = strongMutationResponseV1(request);
    const claimsBitflip: any = cloneJsonV1(valid);
    claimsBitflip.payload.resolution = "replayed";
    const signatureBitflip = strongMutationResponseV1(request, {
      signatureBitFlip: true,
    });
    const wrongKey = strongMutationResponseV1(request, { signerSeed: 0x52 });
    const invalidResponses: unknown[] = [
      claimsBitflip,
      signatureBitflip,
      wrongKey,
    ];
    for (const length of [0, 63, 65]) {
      const invalid: any = cloneJsonV1(valid);
      invalid.signature =
        `base64url:${Buffer.alloc(length, 0x6b).toString("base64url")}`;
      invalidResponses.push(invalid);
    }
    for (const response of invalidResponses) {
      await expect(fixture.broker.resolve(
        brokerResolveRequestV1(
          begun.intent,
          response as ProviderRuntimeIpcStrongMutationResponseV1,
        ),
      )).rejects.toMatchObject({ code: "invalid_request" });
      await expect(
        inspectProviderStrongMutationBrokerSnapshotForTestInternalV1(
          fixture.capability,
          fixture.verifier,
        ),
      ).resolves.toEqual(before);
    }
  });

  it("reads evidence once per intent and reuses the exact-pin validated Registry closure while reparsing every principal attestation", async () => {
    const fixture = await fixtureV1();
    for (const nonceDigit of ["3", "4", "5"]) {
      const request = strongMutationRequestV1(fixture.current, {
        nonceDigit,
        requestId: nonceDigit.repeat(32),
        registry: fixture.evidenceRegistry,
        principalAttestation: fixture.principalAttestation,
      });
      await fixture.broker.begin(request);
    }
    let reads = 0;
    const cachedVerifier = await strongMutationTrustVerifierV1(() => {
      reads += 1;
      if (reads === 1) return fixture.evidence;
      return {
        bootstrapTrustBundle: "must-not-be-read-on-same-pin-cache-hit",
        rootMetadataHistory: "must-not-be-read-on-same-pin-cache-hit",
        registryManifestHistory: "must-not-be-read-on-same-pin-cache-hit",
        principalAttestation: fixture.principalAttestation,
      };
    });
    await expect(
      inspectProviderStrongMutationBrokerSnapshotForTestInternalV1(
        fixture.capability,
        cachedVerifier,
      ),
    ).resolves.toMatchObject({ intentCount: 3, pendingCount: 3 });
    expect(reads).toBe(3);
  });

  it.each([
    {
      dimension: "preclone work units",
      select: (limits: ReturnType<
        typeof providerStrongMutationTrustEvidenceSnapshotLimitsForTestInternalV1
      >) => limits.maxPrecloneAllocationWorkUnits,
      admitted: (limit: number) => ({
        precloneAllocationWorkUnits: limit,
        evidenceWrapperDepth: 0,
      }),
      rejected: (limit: number) => ({
        precloneAllocationWorkUnits: limit + 1,
        evidenceWrapperDepth: 0,
      }),
      reason: "preclone_work_units",
    },
    {
      dimension: "evidence wrapper depth",
      select: (limits: ReturnType<
        typeof providerStrongMutationTrustEvidenceSnapshotLimitsForTestInternalV1
      >) => limits.maxEvidenceWrapperDepth,
      admitted: (limit: number) => ({
        precloneAllocationWorkUnits: 0,
        evidenceWrapperDepth: limit,
      }),
      rejected: (limit: number) => ({
        precloneAllocationWorkUnits: 0,
        evidenceWrapperDepth: limit + 1,
      }),
      reason: "depth",
    },
  ] as const)("admits $dimension at N and rejects N+1", (testCase) => {
    const limits =
      providerStrongMutationTrustEvidenceSnapshotLimitsForTestInternalV1();
    const limit = testCase.select(limits);
    expect(
      classifyProviderStrongMutationTrustEvidenceSnapshotAdmissionForTestInternalV1(
        testCase.admitted(limit),
      ),
    ).toEqual({ admitted: true });
    expect(
      classifyProviderStrongMutationTrustEvidenceSnapshotAdmissionForTestInternalV1(
        testCase.rejected(limit),
      ),
    ).toEqual({ admitted: false, reason: testCase.reason });
  });
});
