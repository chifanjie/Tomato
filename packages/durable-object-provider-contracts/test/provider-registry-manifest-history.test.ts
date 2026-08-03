import {
  createPrivateKey,
  sign,
  type KeyObject,
} from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

import type { ProviderBootstrapTrustBundleV1 } from "../src/bootstrap-trust-bundle.js";
import { canonicalizeJcsSafeIntegerUtf8V1 } from "../src/jcs.js";
import {
  ProviderRegistryManifestHistoryValidationError,
  diagnoseProviderRegistryManifestHistoryInternalV1,
  isProviderRegistryRetainedTrustHistoryWithinBudgetInternalV1,
  validateProviderRegistryManifestHistoryV1,
  type ValidateProviderRegistryManifestHistoryV1Input,
} from "../src/provider-registry-manifest-history.js";
import {
  ProviderRegistryManifestEnvelopeV1Schema,
  ProviderRegistryManifestV1Schema,
  StoreDurableObjectProviderBindingDerivationGenerationV1Schema,
  StoreDurableObjectProviderRegistryEntryV1Schema,
  StoreDurableObjectProviderRuntimeAttestationV1Schema,
  StoreDurableObjectProviderVerificationPublicKeyV1Schema,
  createProviderRegistryManifestSignatureMessageV1,
  createStoreDurableObjectProviderBindingDerivationGenerationSignatureMessageV1,
  createStoreDurableObjectProviderRegistryEntrySignatureMessageV1,
  createStoreDurableObjectProviderRuntimeAttestationSignatureMessageV1,
  createStoreDurableObjectProviderVerificationPublicKeySignatureMessageV1,
  deriveProviderRegistryManifestContentDigestV1,
  deriveProviderRegistryManifestGenerationIdV1,
  deriveStoreDurableObjectProviderRegistryEntryContentDigestV1,
  projectProviderFeasibilityApproverPublicKeyUnsignedClaimsV1,
  projectStoreDurableObjectProviderBindingDerivationGenerationUnsignedClaimsV1,
  type ProviderRegistryManifestEnvelopeV1,
  type ProviderRegistryManifestV1,
  type StoreDurableObjectProviderBindingDerivationGenerationV1,
  type StoreDurableObjectProviderRegistryEntryV1,
  type StoreDurableObjectProviderRuntimeAttestationV1,
  type StoreDurableObjectProviderVerificationPublicKeyV1,
} from "../src/provider-registry-records.js";
import type { ProviderRegistryRootMetadataEnvelopeV1 } from "../src/provider-registry-trust.js";
import {
  PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1,
  PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
  attestProviderStrictEd25519CryptoHostV1,
  type ProviderStrictEd25519OpaqueCapabilityV1,
} from "../src/strict-ed25519-conformance.js";
import {
  STRICT_ED25519_VERIFICATION_PROFILE_V1,
  validatePrimeSubgroupPoint,
  verifyRawEd25519,
} from "../src/strict-ed25519.js";

interface RegistryHistoryFixtureV1 {
  readonly installationIdentityGenerationId:
    ValidateProviderRegistryManifestHistoryV1Input["installationIdentityGenerationId"];
  readonly bootstrapTrustBundle: ProviderBootstrapTrustBundleV1;
  readonly rootMetadataHistory: readonly ProviderRegistryRootMetadataEnvelopeV1[];
  readonly registryManifestHistory: readonly ProviderRegistryManifestEnvelopeV1[];
  readonly deterministicSeeds: {
    readonly rootHistoryDependencySeeds: {
      readonly bootstrapRootSeedHex: string;
      readonly plannedRootSeedHex: string;
      readonly compromiseRootSeedHex: string;
    };
  };
  readonly expected: {
    readonly registryManifestCount: number;
    readonly retainedRootMetadataCanonicalBytes: number;
    readonly retainedRegistryManifestCanonicalBytes: number;
    readonly retainedTrustHistoryCanonicalBytes: number;
    readonly currentRootMetadata: unknown;
    readonly currentRegistryManifest: unknown;
    readonly cryptoClosure: {
      readonly postAttestationPointCalls: number;
      readonly postAttestationSignatureCalls: number;
    };
  };
}

const fixture = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL(
        "../fixtures/v1/golden/provider-registry-entry-manifest-history-v1.json",
        import.meta.url,
      ),
    ),
    "utf8",
  ),
) as RegistryHistoryFixtureV1;

const strictManifestBytes = new Uint8Array(
  readFileSync(
    fileURLToPath(
      new URL(
        "../provider/ed25519-strict-host-conformance-v1.json",
        import.meta.url,
      ),
    ),
  ),
);

let capability: ProviderStrictEd25519OpaqueCapabilityV1;
let pointCalls = 0;
let signatureCalls = 0;
let manifestSignatureCalls = 0;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function resetCryptoCalls(): void {
  pointCalls = 0;
  signatureCalls = 0;
  manifestSignatureCalls = 0;
}

function request(
  registryManifestHistory: readonly ProviderRegistryManifestEnvelopeV1[] =
    fixture.registryManifestHistory,
  rootMetadataHistory: readonly ProviderRegistryRootMetadataEnvelopeV1[] =
    fixture.rootMetadataHistory,
): ValidateProviderRegistryManifestHistoryV1Input {
  return {
    installationIdentityGenerationId:
      fixture.installationIdentityGenerationId,
    bootstrapTrustBundle: fixture.bootstrapTrustBundle,
    rootMetadataHistory,
    registryManifestHistory,
    strictCryptoCapability: capability,
  };
}

function rootSeedHex(rootGeneration: number): string {
  const seeds = fixture.deterministicSeeds.rootHistoryDependencySeeds;
  const seed = [
    seeds.bootstrapRootSeedHex,
    seeds.plannedRootSeedHex,
    seeds.compromiseRootSeedHex,
  ][rootGeneration - 1];
  if (seed === undefined) throw new TypeError("unknown fixture root generation");
  return seed;
}

function rootPrivateKey(rootGeneration: number): KeyObject {
  const seed = Buffer.from(rootSeedHex(rootGeneration), "hex");
  return createPrivateKey({
    key: Buffer.concat([
      Buffer.from("302e020100300506032b657004220420", "hex"),
      seed,
    ]),
    format: "der",
    type: "pkcs8",
  });
}

function rootKeyId(rootGeneration: number): string {
  const envelope = fixture.rootMetadataHistory[rootGeneration - 1];
  if (envelope === undefined) throw new TypeError("unknown fixture root");
  return envelope.rootKeyId;
}

function rootSignature(
  prefix: "provider-registry-ed25519" | "provider-registry-manifest-ed25519",
  rootGeneration: number,
  message: Uint8Array,
): string {
  return `${prefix}:${rootKeyId(rootGeneration)}:${sign(
    null,
    Buffer.from(message),
    rootPrivateKey(rootGeneration),
  ).toString("hex")}`;
}

function flipLastSignatureBit<T extends string>(signature: T): T {
  const last = signature.at(-1);
  if (last === undefined) throw new TypeError("signature is empty");
  return `${signature.slice(0, -1)}${last === "0" ? "1" : "0"}` as T;
}

function independentlyValidWrongDomainSignature(
  claims: object,
  wrongDomain: string,
  rootGeneration: number,
): string {
  const message = canonicalizeJcsSafeIntegerUtf8V1([
    wrongDomain,
    {
      rootKeyId: rootKeyId(rootGeneration),
      domain: wrongDomain,
      claims,
    },
  ]);
  const registrySignature = rootSignature(
    "provider-registry-ed25519",
    rootGeneration,
    message,
  );
  const signatureHex = registrySignature.split(":")[2];
  const publicKeyWire =
    fixture.rootMetadataHistory[rootGeneration - 1]?.payload.activeRoot
      .publicKeyBytes;
  if (signatureHex === undefined || publicKeyWire === undefined) {
    throw new TypeError("fixture root signature material is absent");
  }
  expect(
    verifyRawEd25519(
      new Uint8Array(
        Buffer.from(publicKeyWire.slice("base64url:".length), "base64url"),
      ),
      message,
      new Uint8Array(Buffer.from(signatureHex, "hex")),
    ),
  ).toBe(true);
  return registrySignature;
}

function resignVerificationRecord(
  input: StoreDurableObjectProviderVerificationPublicKeyV1,
  rootGeneration: number,
): StoreDurableObjectProviderVerificationPublicKeyV1 {
  const { registrySignature: _oldSignature, ...unsignedClaims } = input;
  return StoreDurableObjectProviderVerificationPublicKeyV1Schema.parse({
    ...unsignedClaims,
    registrySignature: rootSignature(
      "provider-registry-ed25519",
      rootGeneration,
      createStoreDurableObjectProviderVerificationPublicKeySignatureMessageV1(
        unsignedClaims,
        rootKeyId(rootGeneration),
      ),
    ),
  });
}

function resignBindingRecord(
  input: StoreDurableObjectProviderBindingDerivationGenerationV1,
  rootGeneration: number,
): StoreDurableObjectProviderBindingDerivationGenerationV1 {
  const { registrySignature: _oldSignature, ...unsignedClaims } = input;
  return StoreDurableObjectProviderBindingDerivationGenerationV1Schema.parse({
    ...unsignedClaims,
    registrySignature: rootSignature(
      "provider-registry-ed25519",
      rootGeneration,
      createStoreDurableObjectProviderBindingDerivationGenerationSignatureMessageV1(
        unsignedClaims,
        rootKeyId(rootGeneration),
      ),
    ),
  });
}

function resignRuntime(
  input: StoreDurableObjectProviderRuntimeAttestationV1,
  rootGeneration: number,
): StoreDurableObjectProviderRuntimeAttestationV1 {
  const { registrySignature: _oldSignature, ...unsignedClaims } = input;
  return StoreDurableObjectProviderRuntimeAttestationV1Schema.parse({
    ...unsignedClaims,
    registrySignature: rootSignature(
      "provider-registry-ed25519",
      rootGeneration,
      createStoreDurableObjectProviderRuntimeAttestationSignatureMessageV1(
        unsignedClaims,
        rootKeyId(rootGeneration),
      ),
    ),
  });
}

function resignEntry(
  input: StoreDurableObjectProviderRegistryEntryV1,
  rootGeneration: number,
): StoreDurableObjectProviderRegistryEntryV1 {
  const { registrySignature: _oldSignature, ...unsignedClaims } = input;
  return StoreDurableObjectProviderRegistryEntryV1Schema.parse({
    ...unsignedClaims,
    registrySignature: rootSignature(
      "provider-registry-ed25519",
      rootGeneration,
      createStoreDurableObjectProviderRegistryEntrySignatureMessageV1(
        unsignedClaims,
        rootKeyId(rootGeneration),
      ),
    ),
  });
}

function resignManifest(
  input: ProviderRegistryManifestV1,
  rootGeneration: number,
): ProviderRegistryManifestEnvelopeV1 {
  const { manifestSignature: _oldSignature, ...oldUnsignedClaims } = input;
  const generationId = deriveProviderRegistryManifestGenerationIdV1(
    oldUnsignedClaims,
  );
  const unsignedClaims = { ...oldUnsignedClaims, generationId };
  const payload = ProviderRegistryManifestV1Schema.parse({
    ...unsignedClaims,
    manifestSignature: rootSignature(
      "provider-registry-manifest-ed25519",
      rootGeneration,
      createProviderRegistryManifestSignatureMessageV1(
        unsignedClaims,
        rootKeyId(rootGeneration),
      ),
    ),
  });
  return ProviderRegistryManifestEnvelopeV1Schema.parse({
    schemaVersion: 1,
    recordType: "provider_registry_manifest",
    generationId,
    contentDigest: deriveProviderRegistryManifestContentDigestV1(payload),
    payload,
  });
}

function replaceEntry(
  history: ProviderRegistryManifestEnvelopeV1[],
  manifestIndex: number,
  providerId: string,
  entry: StoreDurableObjectProviderRegistryEntryV1,
): void {
  const envelope = history[manifestIndex];
  if (envelope === undefined) throw new TypeError("manifest is absent");
  const payload = clone(envelope.payload);
  payload.members = payload.members.map((member) =>
    member.providerId === providerId && member.disposition === "enabled"
      ? {
          ...member,
          registryEntryContentDigest:
            deriveStoreDurableObjectProviderRegistryEntryContentDigestV1(
              entry,
            ),
          registryEntry: entry,
        }
      : member,
  ) as typeof payload.members;
  history[manifestIndex] = resignManifest(
    payload,
    payload.activeRootMetadata.rootGeneration,
  );
}

function enabledEntry(
  history: readonly ProviderRegistryManifestEnvelopeV1[],
  manifestIndex: number,
  providerId: string,
): StoreDurableObjectProviderRegistryEntryV1 {
  const member = history[manifestIndex]?.payload.members.find(
    (candidate) =>
      candidate.providerId === providerId &&
      candidate.disposition === "enabled",
  );
  if (member === undefined || member.disposition !== "enabled") {
    throw new TypeError("fixture enabled member is absent");
  }
  return clone(member.registryEntry);
}

beforeAll(async () => {
  capability = await attestProviderStrictEd25519CryptoHostV1({
    host: {
      verificationProfile: STRICT_ED25519_VERIFICATION_PROFILE_V1,
      validatePrimeSubgroupPoint(point) {
        pointCalls += 1;
        return validatePrimeSubgroupPoint(point);
      },
      verifyRawEd25519(publicKey, message, signature) {
        signatureCalls += 1;
        if (
          new TextDecoder().decode(message).startsWith(
            '["provider-registry-manifest-signature-v1",',
          )
        ) {
          manifestSignatureCalls += 1;
        }
        return verifyRawEd25519(publicKey, message, signature);
      },
    },
    resourceHost: {
      readFixedSignedPackageResource(path, maxBytes) {
        expect(path).toBe(PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1);
        expect(maxBytes).toBe(PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1);
        return strictManifestBytes.slice();
      },
    },
  });
});

describe("provider registry manifest retained history", () => {
  it("validates the complete rollover/migration/tombstone golden with unique crypto closure", async () => {
    const inputHistory = clone(fixture.registryManifestHistory);
    resetCryptoCalls();

    const result = await validateProviderRegistryManifestHistoryV1(
      request(inputHistory, clone(fixture.rootMetadataHistory)),
    );

    expect(result).toMatchObject({
      authority: "none_registry_structure_and_history_only",
      currentRootMetadata: fixture.expected.currentRootMetadata,
      currentRegistryManifest: fixture.expected.currentRegistryManifest,
      retainedRootMetadataGenerationCount: 3,
      retainedRegistryManifestGenerationCount:
        fixture.expected.registryManifestCount,
      retainedRootMetadataCanonicalBytes:
        fixture.expected.retainedRootMetadataCanonicalBytes,
      retainedRegistryManifestCanonicalBytes:
        fixture.expected.retainedRegistryManifestCanonicalBytes,
      retainedTrustHistoryCanonicalBytes:
        fixture.expected.retainedTrustHistoryCanonicalBytes,
    });
    expect(pointCalls).toBe(
      fixture.expected.cryptoClosure.postAttestationPointCalls,
    );
    expect(signatureCalls).toBe(
      fixture.expected.cryptoClosure.postAttestationSignatureCalls,
    );
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.registryManifestHistory)).toBe(true);
    expect(
      Object.isFrozen(
        result.registryManifestHistory[2]!.payload.members[0],
      ),
    ).toBe(true);

    const retainedIssuedAt = result.registryManifestHistory[6]!.payload.issuedAt;
    (inputHistory[6]!.payload as { issuedAt: string }).issuedAt =
      "2099-01-01T00:00:00Z";
    expect(result.registryManifestHistory[6]!.payload.issuedAt).toBe(
      retainedIssuedAt,
    );
  });

  it("enforces the combined retained-history byte budget at its exact boundary", () => {
    const maxBytes =
      fixture.bootstrapTrustBundle.providerTrustHistoryPolicy
        .maxTotalTrustHistoryLogicalBytesPerInstallationIdentity;

    expect(
      isProviderRegistryRetainedTrustHistoryWithinBudgetInternalV1(
        maxBytes - 1,
        1,
        maxBytes,
      ),
    ).toBe(true);
    expect(
      isProviderRegistryRetainedTrustHistoryWithinBudgetInternalV1(
        maxBytes - 1,
        2,
        maxBytes,
      ),
    ).toBe(false);
    expect(
      isProviderRegistryRetainedTrustHistoryWithinBudgetInternalV1(
        maxBytes,
        0,
        maxBytes,
      ),
    ).toBe(true);
    expect(
      isProviderRegistryRetainedTrustHistoryWithinBudgetInternalV1(
        -1,
        0,
        maxBytes,
      ),
    ).toBe(false);
    expect(
      isProviderRegistryRetainedTrustHistoryWithinBudgetInternalV1(
        Number.MAX_SAFE_INTEGER,
        1,
        Number.MAX_SAFE_INTEGER,
      ),
    ).toBe(false);
  });

  it("rejects a first-seen key backdated to an earlier Entry generation", async () => {
    const history = clone(fixture.registryManifestHistory.slice(0, 2));
    const providerId = "durable-object-provider:native-a";
    const entry = enabledEntry(history, 1, providerId);
    const rotatedIndex = entry.verificationKeys.publicKeyRecords.findIndex(
      (record) => record.registryGenerationIntroduced === 2,
    );
    const rotated = entry.verificationKeys.publicKeyRecords[rotatedIndex];
    if (rotated === undefined) throw new TypeError("rotated fixture key absent");
    entry.verificationKeys.publicKeyRecords[rotatedIndex] =
      resignVerificationRecord(
        { ...rotated, registryGenerationIntroduced: 1 },
        1,
      );
    replaceEntry(history, 1, providerId, resignEntry(entry, 2));

    await expect(
      diagnoseProviderRegistryManifestHistoryInternalV1(
        request(history, fixture.rootMetadataHistory.slice(0, 2)),
      ),
    ).resolves.toEqual({
      ok: false,
      stage: "key_history",
      reason: "record_history_invalid",
    });
  });

  it("requires a first-seen runtime to be signed by the Entry current root", async () => {
    const history = clone(fixture.registryManifestHistory.slice(0, 2));
    const providerId = "durable-object-provider:native-a";
    const entry = enabledEntry(history, 1, providerId);
    entry.runtimeAttestation.payload = resignRuntime(
      entry.runtimeAttestation.payload,
      1,
    );
    replaceEntry(history, 1, providerId, resignEntry(entry, 2));

    await expect(
      diagnoseProviderRegistryManifestHistoryInternalV1(
        request(history, fixture.rootMetadataHistory.slice(0, 2)),
      ),
    ).resolves.toEqual({
      ok: false,
      stage: "record_signature",
      reason: "signature_invalid",
    });
  });

  it("rejects binding and approver signature bitflips and valid wrong-domain signatures", async () => {
    const providerId = "durable-object-provider:native-a";
    const cases = [
      {
        name: "binding bitflip",
        mutate(entry: StoreDurableObjectProviderRegistryEntryV1): void {
          const record = entry.verificationKeys
            .bindingDerivationGenerationRecords[0];
          if (record === undefined) throw new TypeError("binding fixture absent");
          record.registrySignature = flipLastSignatureBit(
            record.registrySignature,
          );
        },
      },
      {
        name: "binding wrong domain",
        mutate(entry: StoreDurableObjectProviderRegistryEntryV1): void {
          const record = entry.verificationKeys
            .bindingDerivationGenerationRecords[0];
          if (record === undefined) throw new TypeError("binding fixture absent");
          record.registrySignature = independentlyValidWrongDomainSignature(
            projectStoreDurableObjectProviderBindingDerivationGenerationUnsignedClaimsV1(
              record,
            ),
            "store-durable-object-provider-binding-derivation-generation-wrong-signature-v1",
            1,
          ) as typeof record.registrySignature;
        },
      },
      {
        name: "approver bitflip",
        mutate(entry: StoreDurableObjectProviderRegistryEntryV1): void {
          const record = entry.feasibilityApprovalKeys.publicKeyRecords[0];
          if (record === undefined) throw new TypeError("approver fixture absent");
          record.registrySignature = flipLastSignatureBit(
            record.registrySignature,
          );
        },
      },
      {
        name: "approver wrong domain",
        mutate(entry: StoreDurableObjectProviderRegistryEntryV1): void {
          const record = entry.feasibilityApprovalKeys.publicKeyRecords[0];
          if (record === undefined) throw new TypeError("approver fixture absent");
          record.registrySignature = independentlyValidWrongDomainSignature(
            projectProviderFeasibilityApproverPublicKeyUnsignedClaimsV1(record),
            "provider-feasibility-approver-public-key-wrong-signature-v1",
            1,
          ) as typeof record.registrySignature;
        },
      },
    ];

    for (const testCase of cases) {
      const history = clone(fixture.registryManifestHistory.slice(0, 1));
      const entry = enabledEntry(history, 0, providerId);
      testCase.mutate(entry);
      replaceEntry(history, 0, providerId, resignEntry(entry, 1));

      await expect(
        diagnoseProviderRegistryManifestHistoryInternalV1(
          request(history, fixture.rootMetadataHistory.slice(0, 1)),
        ),
        testCase.name,
      ).resolves.toEqual({
        ok: false,
        stage: "record_signature",
        reason: "signature_invalid",
      });
    }
  });

  it("rejects binding histories that start at two, contain a gap, or change provider", async () => {
    const providerId = "durable-object-provider:native-a";
    const destinationBinding = enabledEntry(
      fixture.registryManifestHistory,
      2,
      "durable-object-provider:native-b",
    ).verificationKeys.bindingDerivationGenerationRecords[0];
    if (destinationBinding === undefined) {
      throw new TypeError("destination binding fixture absent");
    }
    const cases = [
      {
        name: "starts at two",
        mutate(entry: StoreDurableObjectProviderRegistryEntryV1): void {
          const first = entry.verificationKeys
            .bindingDerivationGenerationRecords[0];
          if (first === undefined) throw new TypeError("binding fixture absent");
          entry.verificationKeys.bindingDerivationGenerationRecords = [
            resignBindingRecord({ ...first, generation: 2 }, 1),
          ];
          entry.verificationKeys.activeBindingDerivationKeyGeneration = 2;
        },
      },
      {
        name: "generation gap",
        mutate(entry: StoreDurableObjectProviderRegistryEntryV1): void {
          const first = entry.verificationKeys
            .bindingDerivationGenerationRecords[0];
          if (first === undefined) throw new TypeError("binding fixture absent");
          entry.verificationKeys.bindingDerivationGenerationRecords.push(
            resignBindingRecord(
              {
                ...first,
                generation: 3,
                keyCommitmentDigest: destinationBinding.keyCommitmentDigest,
              },
              1,
            ),
          );
        },
      },
      {
        name: "provider mismatch",
        mutate(entry: StoreDurableObjectProviderRegistryEntryV1): void {
          const first = entry.verificationKeys
            .bindingDerivationGenerationRecords[0];
          if (first === undefined) throw new TypeError("binding fixture absent");
          entry.verificationKeys.bindingDerivationGenerationRecords = [
            resignBindingRecord(
              {
                ...first,
                providerId: destinationBinding.providerId,
              },
              1,
            ),
          ];
        },
      },
    ];

    for (const testCase of cases) {
      const history = clone(fixture.registryManifestHistory.slice(0, 1));
      const entry = enabledEntry(history, 0, providerId);
      testCase.mutate(entry);
      replaceEntry(history, 0, providerId, resignEntry(entry, 1));

      await expect(
        diagnoseProviderRegistryManifestHistoryInternalV1(
          request(history, fixture.rootMetadataHistory.slice(0, 1)),
        ),
        testCase.name,
      ).resolves.toEqual({
        ok: false,
        stage: "key_history",
        reason: "record_history_invalid",
      });
    }
  });

  it("rejects removal from a nested append-only verification history", async () => {
    const history = clone(fixture.registryManifestHistory.slice(0, 2));
    const providerId = "durable-object-provider:native-a";
    const entry = enabledEntry(history, 1, providerId);
    entry.verificationKeys.publicKeyRecords =
      entry.verificationKeys.publicKeyRecords.filter(
        (record) => record.usage !== "migration_semantic_proof",
      );
    replaceEntry(history, 1, providerId, resignEntry(entry, 2));

    await expect(
      diagnoseProviderRegistryManifestHistoryInternalV1(
        request(history, fixture.rootMetadataHistory.slice(0, 2)),
      ),
    ).resolves.toMatchObject({
      ok: false,
      stage: "key_history",
      reason: "record_history_invalid",
    });
  });

  it("rejects revocation IDs that do not close over retained records", async () => {
    const history = clone(fixture.registryManifestHistory.slice(0, 2));
    const providerId = "durable-object-provider:native-a";
    const entry = enabledEntry(history, 1, providerId);
    entry.verificationKeys.compromisedRevokedKeyIds = ["0".repeat(22)] as never;
    replaceEntry(history, 1, providerId, resignEntry(entry, 2));

    await expect(
      diagnoseProviderRegistryManifestHistoryInternalV1(
        request(history, fixture.rootMetadataHistory.slice(0, 2)),
      ),
    ).resolves.toMatchObject({
      ok: false,
      stage: "key_history",
      reason: "revocation_invalid",
    });
  });

  it("requires enabled providers in one migration Manifest to share approval history", async () => {
    const history = clone(fixture.registryManifestHistory.slice(0, 3));
    const providerId = "durable-object-provider:native-b";
    const entry = enabledEntry(history, 2, providerId);
    const active = entry.feasibilityApprovalKeys.activeKeyIds;
    entry.feasibilityApprovalKeys.activeKeyIds = {
      qa: active.release,
      release: active.qa,
    };
    replaceEntry(history, 2, providerId, resignEntry(entry, 3));

    await expect(
      diagnoseProviderRegistryManifestHistoryInternalV1(request(history)),
    ).resolves.toMatchObject({
      ok: false,
      stage: "key_history",
      reason: "record_history_invalid",
    });
  });

  it("rejects migration phase skipping and permanent tombstone disappearance", async () => {
    const phaseHistory = clone(fixture.registryManifestHistory.slice(0, 4));
    const phasePayload = clone(phaseHistory[3]!.payload);
    if (phasePayload.routing.state !== "migration") {
      throw new TypeError("fixture migration phase absent");
    }
    phasePayload.routing.phase = "source_drained";
    phaseHistory[3] = resignManifest(phasePayload, 3);
    await expect(
      diagnoseProviderRegistryManifestHistoryInternalV1(
        request(phaseHistory),
      ),
    ).resolves.toMatchObject({
      ok: false,
      stage: "routing",
      reason: "routing_invalid",
    });

    const tombstoneHistory = clone(fixture.registryManifestHistory.slice());
    const finalPayload = clone(tombstoneHistory[6]!.payload);
    finalPayload.members = finalPayload.members.filter(
      (member) => member.disposition === "enabled",
    ) as typeof finalPayload.members;
    tombstoneHistory[6] = resignManifest(finalPayload, 3);
    await expect(
      diagnoseProviderRegistryManifestHistoryInternalV1(
        request(tombstoneHistory),
      ),
    ).resolves.toMatchObject({
      ok: false,
      stage: "member_set",
      reason: "member_transition_invalid",
    });
  });

  it("requires the genesis Manifest routing state to be steady", async () => {
    const payload = clone(fixture.registryManifestHistory[0]!.payload);
    const destination = clone(
      fixture.registryManifestHistory[2]!.payload.members.find(
        (member) =>
          member.providerId === "durable-object-provider:native-b" &&
          member.disposition === "enabled",
      ),
    );
    const migrationRouting = fixture.registryManifestHistory[2]!.payload.routing;
    if (destination === undefined || migrationRouting.state !== "migration") {
      throw new TypeError("prepared migration fixture is absent");
    }
    payload.members = [...payload.members, destination];
    payload.routing = clone(migrationRouting);
    const history = [resignManifest(payload, 1)];

    await expect(
      diagnoseProviderRegistryManifestHistoryInternalV1(
        request(history, fixture.rootMetadataHistory.slice(0, 1)),
      ),
    ).resolves.toEqual({
      ok: false,
      stage: "routing",
      reason: "routing_invalid",
    });
  });

  it("rejects an invalid Manifest signature through the public opaque error", async () => {
    const history = clone(fixture.registryManifestHistory);
    const payload = history[6]!.payload;
    const signature = payload.manifestSignature;
    payload.manifestSignature = `${signature.slice(0, -1)}${
      signature.endsWith("0") ? "1" : "0"
    }` as typeof signature;

    await expect(
      validateProviderRegistryManifestHistoryV1(request(history)),
    ).rejects.toEqual(expect.any(ProviderRegistryManifestHistoryValidationError));
    await expect(
      validateProviderRegistryManifestHistoryV1(request(history)),
    ).rejects.toMatchObject({
      code: "provider_unavailable",
      reason: "attestation_invalid",
    });
  });

  it("maps malformed Root history before any Manifest signature verification", async () => {
    const rootHistory = clone(fixture.rootMetadataHistory.slice(0, 1));
    Object.defineProperty(rootHistory[0]!.payload, "callerPath", {
      value: "must-not-be-accepted",
      enumerable: true,
      configurable: true,
      writable: true,
    });
    resetCryptoCalls();

    await expect(
      diagnoseProviderRegistryManifestHistoryInternalV1(
        request(fixture.registryManifestHistory.slice(0, 1), rootHistory),
      ),
    ).resolves.toEqual({
      ok: false,
      stage: "root_history",
      reason: "root_history_invalid",
    });
    expect(manifestSignatureCalls).toBe(0);
  });

  it("bounds hostile history before crypto and never invokes accessors", async () => {
    const oversized = new Array<ProviderRegistryManifestEnvelopeV1>(4_097).fill(
      fixture.registryManifestHistory[0]!,
    );
    resetCryptoCalls();
    await expect(
      diagnoseProviderRegistryManifestHistoryInternalV1(request(oversized)),
    ).resolves.toEqual({
      ok: false,
      stage: "history_limit",
      reason: "history_generation_limit_exceeded",
    });
    expect(pointCalls).toBe(0);
    expect(signatureCalls).toBe(0);

    let millionArrayOwnKeysCalls = 0;
    const millionArray = new Proxy(new Array<unknown>(1_000_000), {
      ownKeys(target) {
        millionArrayOwnKeysCalls += 1;
        return Reflect.ownKeys(target);
      },
    });
    const millionArrayEnvelope = clone(fixture.registryManifestHistory[0]!);
    millionArrayEnvelope.payload.members = millionArray as never;
    resetCryptoCalls();
    await expect(
      diagnoseProviderRegistryManifestHistoryInternalV1(
        request(
          [millionArrayEnvelope],
          fixture.rootMetadataHistory.slice(0, 1),
        ),
      ),
    ).resolves.toEqual({
      ok: false,
      stage: "history_limit",
      reason: "envelope_byte_limit_exceeded",
    });
    expect(millionArrayOwnKeysCalls).toBe(0);
    expect(pointCalls).toBe(0);
    expect(signatureCalls).toBe(0);

    const wideObject: Record<string, unknown> = {};
    for (let index = 0; index < 65_537; index += 1) {
      wideObject[`field${index}`] = null;
    }
    let wideObjectDescriptorCalls = 0;
    const proxiedWideObject = new Proxy(wideObject, {
      getOwnPropertyDescriptor(target, key) {
        wideObjectDescriptorCalls += 1;
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    const wideObjectEnvelope = clone(fixture.registryManifestHistory[0]!);
    wideObjectEnvelope.payload.members = proxiedWideObject as never;
    resetCryptoCalls();
    await expect(
      diagnoseProviderRegistryManifestHistoryInternalV1(
        request(
          [wideObjectEnvelope],
          fixture.rootMetadataHistory.slice(0, 1),
        ),
      ),
    ).resolves.toEqual({
      ok: false,
      stage: "history_limit",
      reason: "envelope_byte_limit_exceeded",
    });
    expect(wideObjectDescriptorCalls).toBe(0);
    expect(pointCalls).toBe(0);
    expect(signatureCalls).toBe(0);

    let getterCalls = 0;
    const hostile = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(hostile, "payload", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return fixture.registryManifestHistory[0]!.payload;
      },
    });
    resetCryptoCalls();
    await expect(
      diagnoseProviderRegistryManifestHistoryInternalV1(
        request([hostile as never]),
      ),
    ).resolves.toMatchObject({ ok: false });
    expect(getterCalls).toBe(0);
    expect(pointCalls).toBe(0);
    expect(signatureCalls).toBe(0);
  });

  it("snapshots caller-owned Root history once before delegated crypto validation", async () => {
    let ownKeysCalls = 0;
    const proxiedBootstrapRoot = new Proxy(
      clone(fixture.rootMetadataHistory[0]!),
      {
        ownKeys(target) {
          ownKeysCalls += 1;
          return Reflect.ownKeys(target);
        },
      },
    );
    const rootHistory = [
      proxiedBootstrapRoot,
      ...clone(fixture.rootMetadataHistory.slice(1)),
    ];

    const diagnostic =
      await diagnoseProviderRegistryManifestHistoryInternalV1(
        request(fixture.registryManifestHistory, rootHistory),
      );

    expect(diagnostic).toMatchObject({ ok: true });
    expect(ownKeysCalls).toBe(1);
  });
});
