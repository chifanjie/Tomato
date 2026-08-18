import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
} from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

import type { ProviderBootstrapTrustBundleV1 } from "../src/bootstrap-trust-bundle.js";
import { canonicalizeJcsSafeIntegerUtf8V1 } from "../src/jcs.js";
import type { ProviderMigrationIdV1 } from "../src/primitives.js";
import {
  createProviderRegistryPreparedDirectSuccessorExpectedMembersInternalV1,
  isProviderRegistryPreparedDirectSuccessorEnvelopeWithinByteLimitsInternalV1,
  isProviderRegistryPreparedDirectSuccessorGenerationWithinLimitInternalV1,
  validateProviderRegistryPreparedDirectSuccessorMemberTransitionsInternalV1,
  validateProviderRegistryManifestHistoryV1,
  type ProviderRegistryManifestHistoryValidationV1,
  type ValidateProviderRegistryManifestHistoryV1Input,
} from "../src/provider-registry-manifest-history.js";
import {
  bindProviderRegistryPreparedSuccessorCohortToFinalCandidateInternalV1,
  bindProviderRegistryPreparedSuccessorSeedToCohortInternalV1,
  createPreparedRegistryHistorySnapshotInternalV1,
  diagnoseProviderRegistryPreparedDirectSuccessorInternalV1,
  diagnoseProviderRegistryProspectiveEntryTemporaryAdmissionInternalV1,
  diagnoseProviderRegistryManifestHistoryPreparedInternalV1,
  discardPreparedRegistryHistoryInputInternalV1,
  discardProviderRegistryPreparedSuccessorCohortInternalV1,
  discardProviderRegistryPreparedSuccessorFinalInternalV1,
  discardProviderRegistryPreparedSuccessorSeedInternalV1,
  discardRegistryHistoryVerifiedWitnessInternalV1,
  mintProviderRegistryProspectiveEntryTemporaryAdmissionCapabilityInternalV1,
  registerPreparedRegistryHistoryInputInternalV1,
  takeRegistryHistoryVerifiedWitnessInternalV1,
  type PreparedRegistryHistoryInputHandleV1,
  type RegistryTrustWitnessHandleV1,
} from "../src/provider-registry-history-prepared-internal.js";
import {
  ProviderRegistryManifestEnvelopeV1Schema,
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
  deriveStoreDurableObjectProviderRuntimeAttestationContentDigestV1,
  deriveStoreProviderVerificationKeyIdV1,
  type ProviderRegistryManifestEnvelopeV1,
  type ProviderRegistryManifestV1,
  type StoreDurableObjectProviderRegistryEntryV1,
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

interface RegistryHistoryPreparedFixtureV1 {
  readonly installationIdentityGenerationId:
    ValidateProviderRegistryManifestHistoryV1Input["installationIdentityGenerationId"];
  readonly bootstrapTrustBundle: ProviderBootstrapTrustBundleV1;
  readonly rootMetadataHistory: readonly ProviderRegistryRootMetadataEnvelopeV1[];
  readonly registryManifestHistory: readonly ProviderRegistryManifestEnvelopeV1[];
  readonly expected: {
    readonly cryptoClosure: {
      readonly postAttestationPointCalls: number;
      readonly postAttestationSignatureCalls: number;
    };
  };
}

interface DetachedRegistryPreparedFieldsV1 {
  installationIdentityGenerationId:
    ValidateProviderRegistryManifestHistoryV1Input["installationIdentityGenerationId"];
  bootstrapTrustBundle: ProviderBootstrapTrustBundleV1;
  rootMetadataHistory: ProviderRegistryRootMetadataEnvelopeV1[];
  registryManifestHistory: ProviderRegistryManifestEnvelopeV1[];
}

interface PreparedInvocationV1 {
  readonly requestIdentity: Readonly<
    ValidateProviderRegistryManifestHistoryV1Input
  >;
  readonly inputHandle: PreparedRegistryHistoryInputHandleV1;
  readonly detached: Readonly<DetachedRegistryPreparedFieldsV1>;
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
) as RegistryHistoryPreparedFixtureV1;

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

function resetCryptoCalls(): void {
  pointCalls = 0;
  signatureCalls = 0;
}

function recursivelyFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor !== undefined && "value" in descriptor) {
        recursivelyFreeze(descriptor.value);
      }
    }
    Object.freeze(value);
  }
  return value;
}

function createPreparedInvocation(
  mutate?: (draft: DetachedRegistryPreparedFieldsV1) => void,
): PreparedInvocationV1 {
  const detached = structuredClone({
    installationIdentityGenerationId:
      fixture.installationIdentityGenerationId,
    bootstrapTrustBundle: fixture.bootstrapTrustBundle,
    rootMetadataHistory: fixture.rootMetadataHistory,
    registryManifestHistory: fixture.registryManifestHistory,
  }) as DetachedRegistryPreparedFieldsV1;
  mutate?.(detached);
  recursivelyFreeze(detached);

  const requestIdentity = Object.freeze({
    bootstrapTrustBundle: detached.bootstrapTrustBundle,
    installationIdentityGenerationId:
      detached.installationIdentityGenerationId,
    registryManifestHistory: detached.registryManifestHistory,
    rootMetadataHistory: detached.rootMetadataHistory,
    strictCryptoCapability: capability,
  });
  const snapshot = createPreparedRegistryHistorySnapshotInternalV1({
    installationIdentityGenerationId:
      detached.installationIdentityGenerationId,
    bootstrapTrustBundle: detached.bootstrapTrustBundle,
    rootMetadataHistory: detached.rootMetadataHistory,
    registryManifestHistory: detached.registryManifestHistory,
    strictCryptoCapability: capability,
  });
  const inputHandle = registerPreparedRegistryHistoryInputInternalV1(
    requestIdentity,
    snapshot,
    capability,
  );
  return { requestIdentity, inputHandle, detached };
}

function fakeOpaqueIdentity<T extends object>(): T {
  return Object.freeze(Object.create(null)) as T;
}

function preparedSuccessorFinalCandidateIdentityV1(
  destinationEntry: StoreDurableObjectProviderRegistryEntryV1,
  marker: string,
): object {
  return recursivelyFreeze({
    marker,
    destinationTrust: {
      authorization: {
        prospectiveDestinationCut: {
          prospectiveRegistryEntry: destinationEntry,
          currentSupportCatalogEnvelope: {},
          currentSupportCatalog: {},
          currentReleaseTargetUniverseEnvelope: {},
        },
      },
    },
  });
}

const prospectiveProviderId = "durable-object-provider:native-c" as const;
const prospectiveSemanticPolicyDigest =
  `sha256:${"c".repeat(64)}` as const;
const currentRootPrivateKey = createPrivateKey({
  key: Buffer.concat([
    Buffer.from("302e020100300506032b657004220420", "hex"),
    Buffer.from("30".repeat(32), "hex"),
  ]),
  format: "der",
  type: "pkcs8",
});

function registrySignatureForCurrentRootV1(message: Uint8Array): string {
  const currentRoot = fixture.rootMetadataHistory.at(-1)!.payload.activeRoot;
  return `provider-registry-ed25519:${currentRoot.rootKeyId}:${sign(
    null,
    Buffer.from(message),
    currentRootPrivateKey,
  ).toString("hex")}`;
}

function deterministicPublicKeyFactsV1(seedByte: number): Readonly<{
  publicKeyBytes: `base64url:${string}`;
  publicKeyDigest: `sha256:${string}`;
}> {
  const privateKey = createPrivateKey({
    key: Buffer.concat([
      Buffer.from("302e020100300506032b657004220420", "hex"),
      Buffer.alloc(32, seedByte),
    ]),
    format: "der",
    type: "pkcs8",
  });
  const spki = createPublicKey(privateKey).export({
    format: "der",
    type: "spki",
  });
  const raw = Buffer.from(spki.subarray(spki.byteLength - 32));
  return Object.freeze({
    publicKeyBytes: `base64url:${raw.toString("base64url")}`,
    publicKeyDigest: `sha256:${createHash("sha256").update(raw).digest("hex")}`,
  });
}

function canonicalPublicKeyDigestV1(
  publicKeyBytes: string,
): `sha256:${string}` {
  const raw = Buffer.from(publicKeyBytes.slice("base64url:".length), "base64url");
  return `sha256:${createHash("sha256").update(raw).digest("hex")}`;
}

function currentEnabledEntryV1(): StoreDurableObjectProviderRegistryEntryV1 {
  const member = fixture.registryManifestHistory
    .at(-1)!
    .payload.members.find((candidate) => candidate.disposition === "enabled");
  if (member === undefined || member.disposition !== "enabled") {
    throw new Error("fixture must have one enabled tip Entry");
  }
  return member.registryEntry;
}

function prospectiveEntryV1(options: Readonly<{
  aliasExistingProviderMaterial?: boolean;
}> = {}): StoreDurableObjectProviderRegistryEntryV1 {
  const currentEntry = currentEnabledEntryV1();
  const usages = [
    "containment_proof",
    "journal_version",
    "migration_semantic_proof",
    "operation_receipt",
    "state_version",
  ] as const;
  const verificationRecords = usages.map((usage, index) => {
    const aliased = options.aliasExistingProviderMaterial === true &&
      usage === "operation_receipt"
      ? currentEntry.verificationKeys.publicKeyRecords.find(
          (record) => record.usage === usage,
        )
      : undefined;
    const key = deterministicPublicKeyFactsV1(0x90 + index);
    const publicKeyBytes = (aliased?.publicKeyBytes ??
      key.publicKeyBytes) as typeof key.publicKeyBytes;
    const unsigned = {
      profile:
        "store_durable_object_provider_verification_public_key_v1" as const,
      providerId: prospectiveProviderId,
      registryGenerationIntroduced: 1,
      keyId: deriveStoreProviderVerificationKeyIdV1({
        providerId: prospectiveProviderId,
        usage,
        publicKeyBytes,
      }),
      usage,
      algorithm: "ed25519" as const,
      publicKeyBytes,
      publicKeyDigest: aliased === undefined
        ? key.publicKeyDigest
        : canonicalPublicKeyDigestV1(publicKeyBytes),
    };
    return StoreDurableObjectProviderVerificationPublicKeyV1Schema.parse({
      ...unsigned,
      registrySignature: registrySignatureForCurrentRootV1(
        createStoreDurableObjectProviderVerificationPublicKeySignatureMessageV1(
          unsigned,
          fixture.rootMetadataHistory.at(-1)!.rootKeyId,
        ),
      ),
    });
  });
  verificationRecords.sort((left, right) =>
    Buffer.compare(
      Buffer.from(`${left.providerId}\u0000${left.usage}\u0000${left.keyId}`),
      Buffer.from(`${right.providerId}\u0000${right.usage}\u0000${right.keyId}`),
    ),
  );
  const activeByUsage = new Map(
    verificationRecords.map((record) => [record.usage, record.keyId]),
  );
  const bindingUnsigned = {
    profile:
      "store_durable_object_provider_binding_derivation_generation_v1" as const,
    providerId: prospectiveProviderId,
    registryGenerationIntroduced: 1,
    generation: 1,
    algorithm: "hmac_sha256_provider_private" as const,
    keyCommitmentDigest: `sha256:${"d".repeat(64)}` as const,
  };
  const bindingRecord =
    StoreDurableObjectProviderBindingDerivationGenerationV1Schema.parse({
      ...bindingUnsigned,
      registrySignature: registrySignatureForCurrentRootV1(
        createStoreDurableObjectProviderBindingDerivationGenerationSignatureMessageV1(
          bindingUnsigned,
          fixture.rootMetadataHistory.at(-1)!.rootKeyId,
        ),
      ),
    });

  const { registrySignature: _runtimeSignature, ...runtimeTemplate } =
    currentEntry.runtimeAttestation.payload;
  const runtimeUnsigned = {
    ...runtimeTemplate,
    providerId: prospectiveProviderId,
    semanticProviderPolicyDigest: prospectiveSemanticPolicyDigest,
  };
  const runtimePayload =
    StoreDurableObjectProviderRuntimeAttestationV1Schema.parse({
      ...runtimeUnsigned,
      registrySignature: registrySignatureForCurrentRootV1(
        createStoreDurableObjectProviderRuntimeAttestationSignatureMessageV1(
          runtimeUnsigned,
          fixture.rootMetadataHistory.at(-1)!.rootKeyId,
        ),
      ),
    });
  const runtimeAttestation = {
    profile:
      "store_durable_object_provider_runtime_attestation_pin_v1" as const,
    contentDigest:
      deriveStoreDurableObjectProviderRuntimeAttestationContentDigestV1(
        runtimePayload,
      ),
    payload: runtimePayload,
  };
  const entryUnsigned = {
    profile: "store_durable_object_provider_registry_entry_v1" as const,
    installationIdentityGenerationId:
      fixture.installationIdentityGenerationId,
    activeRootMetadata:
      fixture.registryManifestHistory.at(-1)!.payload.activeRootMetadata,
    registryRootKeyId: fixture.rootMetadataHistory.at(-1)!.rootKeyId,
    providerId: prospectiveProviderId,
    semanticProviderPolicyDigest: prospectiveSemanticPolicyDigest,
    providerFeasibilityEvidence: currentEntry.providerFeasibilityEvidence,
    runtimeAttestation,
    verificationKeys: {
      profile:
        "store_durable_object_provider_verification_keys_v1" as const,
      activeKeyIds: {
        operationReceipt: activeByUsage.get("operation_receipt")!,
        containmentProof: activeByUsage.get("containment_proof")!,
        stateVersion: activeByUsage.get("state_version")!,
        journalVersion: activeByUsage.get("journal_version")!,
      },
      activeBindingDerivationKeyGeneration: 1,
      publicKeyRecords: verificationRecords,
      bindingDerivationGenerationRecords: [bindingRecord],
      compromisedRevokedKeyIds: [],
      compromisedRevokedBindingDerivationGenerations: [],
    },
    feasibilityApprovalKeys: currentEntry.feasibilityApprovalKeys,
    status: "enabled" as const,
    registryGeneration: 1 as const,
  };
  return StoreDurableObjectProviderRegistryEntryV1Schema.parse({
    ...entryUnsigned,
    registrySignature: registrySignatureForCurrentRootV1(
      createStoreDurableObjectProviderRegistryEntrySignatureMessageV1(
        entryUnsigned,
        fixture.rootMetadataHistory.at(-1)!.rootKeyId,
      ),
    ),
  });
}

function expectHistoryCryptoCalls(multiplier = 1): void {
  expect(pointCalls).toBe(
    fixture.expected.cryptoClosure.postAttestationPointCalls * multiplier,
  );
  expect(signatureCalls).toBe(
    fixture.expected.cryptoClosure.postAttestationSignatureCalls * multiplier,
  );
}

function expectPreparedFailure(
  result: Awaited<
    ReturnType<
      typeof diagnoseProviderRegistryManifestHistoryPreparedInternalV1
    >
  >,
  stage = "history_input",
  reason = "schema_invalid",
): void {
  expect(result).toEqual({ ok: false, stage, reason });
}

async function temporaryAdmissionCapabilityV1(
  mutate?: (draft: DetachedRegistryPreparedFieldsV1) => void,
) {
  const prepared = createPreparedInvocation(mutate);
  const registryResult =
    await diagnoseProviderRegistryManifestHistoryPreparedInternalV1(
      prepared.requestIdentity,
      prepared.inputHandle,
      capability,
    );
  if (!registryResult.ok) {
    throw new Error("prepared Registry fixture must validate");
  }
  const temporaryCapability =
    mintProviderRegistryProspectiveEntryTemporaryAdmissionCapabilityInternalV1(
      registryResult.value.closure,
      capability,
    );
  discardRegistryHistoryVerifiedWitnessInternalV1(
    registryResult.value.closure,
    registryResult.value.registryTrustWitnessHandle,
    capability,
  );
  return {
    closure: registryResult.value.closure,
    temporaryCapability,
  };
}

const freshFormalMigrationIdV1 =
  `provider-migration:${"a".repeat(22)}` as ProviderMigrationIdV1;
const retainedFormalMigrationIdV1 =
  "provider-migration:f43247b5ad7b40b0ea13c3" as ProviderMigrationIdV1;

function manifestSignatureForCurrentRootV1(message: Uint8Array): string {
  const currentRoot = fixture.rootMetadataHistory.at(-1)!.payload.activeRoot;
  return `provider-registry-manifest-ed25519:${currentRoot.rootKeyId}:${sign(
    null,
    Buffer.from(message),
    currentRootPrivateKey,
  ).toString("hex")}`;
}

interface PreparedSuccessorEnvelopeOptionsV1 {
  readonly envelopeMigrationId?: ProviderMigrationIdV1;
  readonly omitDestinationMember?: boolean;
  readonly predecessorGenerationId?: ProviderRegistryManifestEnvelopeV1["generationId"];
  readonly routingDestinationProviderId?: StoreDurableObjectProviderRegistryEntryV1["providerId"];
  readonly signatureMode?: "valid" | "bitflip" | "wrong_root";
}

function preparedSuccessorEnvelopeV1(
  destinationEntry: StoreDurableObjectProviderRegistryEntryV1,
  formalMigrationId: ProviderMigrationIdV1,
  options: PreparedSuccessorEnvelopeOptionsV1 = {},
): ProviderRegistryManifestEnvelopeV1 {
  const currentEnvelope = fixture.registryManifestHistory.at(-1)!;
  const current = currentEnvelope.payload;
  const source = current.members.find(
    (member) => member.disposition === "enabled",
  );
  if (source === undefined || source.disposition !== "enabled") {
    throw new Error("fixture tip must have one enabled source");
  }
  const destinationMember = {
    providerId: destinationEntry.providerId,
    disposition: "enabled" as const,
    registryEntryContentDigest:
      deriveStoreDurableObjectProviderRegistryEntryContentDigestV1(
        destinationEntry,
      ),
    registryEntry: destinationEntry,
  };
  const members = structuredClone(current.members);
  if (options.omitDestinationMember !== true) {
    members.push(structuredClone(destinationMember));
    members.sort((left, right) =>
      Buffer.compare(
        Buffer.from(left.providerId, "utf8"),
        Buffer.from(right.providerId, "utf8"),
      ),
    );
  }
  const predecessor = {
    state: "manifest" as const,
    generationId:
      options.predecessorGenerationId ?? currentEnvelope.generationId,
    contentDigest: currentEnvelope.contentDigest,
  };
  const routing = {
    state: "migration" as const,
    migrationId: options.envelopeMigrationId ?? formalMigrationId,
    sourceProviderId: source.providerId,
    destinationProviderId:
      options.routingDestinationProviderId ?? destinationEntry.providerId,
    activeForMigrationWrites: source.providerId,
    phase: "prepared" as const,
  };
  const generationId = deriveProviderRegistryManifestGenerationIdV1({
    installationIdentityGenerationId:
      current.installationIdentityGenerationId,
    activeRootMetadata: current.activeRootMetadata,
    manifestGeneration: current.manifestGeneration + 1,
    predecessor,
    members,
    routing,
  });
  const unsigned = {
    profile: "provider_registry_manifest_v1" as const,
    generationId,
    installationIdentityGenerationId:
      current.installationIdentityGenerationId,
    activeRootMetadata: current.activeRootMetadata,
    manifestGeneration: current.manifestGeneration + 1,
    predecessor,
    members,
    routing,
    issuedAt: current.issuedAt,
  };
  let manifestSignature = manifestSignatureForCurrentRootV1(
    createProviderRegistryManifestSignatureMessageV1(
      unsigned,
      fixture.rootMetadataHistory.at(-1)!.rootKeyId,
    ),
  );
  if (options.signatureMode === "bitflip") {
    manifestSignature = `${manifestSignature.slice(0, -1)}${
      manifestSignature.endsWith("0") ? "1" : "0"
    }`;
  } else if (options.signatureMode === "wrong_root") {
    manifestSignature = manifestSignature.replace(
      fixture.rootMetadataHistory.at(-1)!.rootKeyId,
      fixture.rootMetadataHistory[0]!.rootKeyId,
    );
  }
  const payload = {
    ...unsigned,
    manifestSignature,
  } as ProviderRegistryManifestV1;
  return recursivelyFreeze(
    ProviderRegistryManifestEnvelopeV1Schema.parse({
      schemaVersion: 1,
      recordType: "provider_registry_manifest",
      generationId,
      contentDigest: deriveProviderRegistryManifestContentDigestV1(payload),
      payload,
    }),
  );
}

async function finalBoundPreparedSuccessorV1(
  destinationEntry = prospectiveEntryV1(),
  mutate?: (draft: DetachedRegistryPreparedFieldsV1) => void,
) {
  const prepared = await temporaryAdmissionCapabilityV1(mutate);
  const admission =
    await diagnoseProviderRegistryProspectiveEntryTemporaryAdmissionInternalV1(
      prepared.temporaryCapability,
      {
        prospectiveRegistryEntryContentDigest:
          deriveStoreDurableObjectProviderRegistryEntryContentDigestV1(
            destinationEntry,
          ),
        prospectiveRegistryEntry: destinationEntry,
      },
    );
  if (!admission.ok) {
    throw new Error("prospective destination must be temporarily admitted");
  }
  const cohortIdentity = recursivelyFreeze({
    profile: "prepared_registry_successor_test_cohort_v1",
  });
  const cohortCapability =
    bindProviderRegistryPreparedSuccessorSeedToCohortInternalV1(
      admission.value.preparedRegistrySuccessorSeed,
      cohortIdentity,
    );
  const finalCandidateIdentity = preparedSuccessorFinalCandidateIdentityV1(
    destinationEntry,
    "prepared_registry_successor_test_final_candidate_v1",
  );
  const finalCapability =
    bindProviderRegistryPreparedSuccessorCohortToFinalCandidateInternalV1(
      cohortIdentity,
      cohortCapability,
      finalCandidateIdentity,
    );
  return {
    cohortIdentity,
    cohortCapability,
    destinationEntry,
    finalCandidateIdentity,
    finalCapability,
  };
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

describe("prepared Registry/Root retained-history internals", () => {
  it("temporarily admits a new gen1 Entry on a seven-collection copy and burns the opaque cap", async () => {
    const candidate = prospectiveEntryV1();
    const contentDigest =
      deriveStoreDurableObjectProviderRegistryEntryContentDigestV1(candidate);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const prepared = await temporaryAdmissionCapabilityV1();
      expect(Object.isFrozen(prepared.temporaryCapability)).toBe(true);
      expect(Object.getPrototypeOf(prepared.temporaryCapability)).toBeNull();
      expect(Reflect.ownKeys(prepared.temporaryCapability)).toEqual([]);
      expect(() =>
        mintProviderRegistryProspectiveEntryTemporaryAdmissionCapabilityInternalV1(
          prepared.closure,
          capability,
        ),
      ).toThrow(TypeError);

      const result =
        await diagnoseProviderRegistryProspectiveEntryTemporaryAdmissionInternalV1(
          prepared.temporaryCapability,
          {
            prospectiveRegistryEntryContentDigest: contentDigest,
            prospectiveRegistryEntry: candidate,
          },
        );
      expect(result).toMatchObject({
        ok: true,
        value: {
          authority:
            "none_registry_prospective_entry_temporary_admission_only",
          installationIdentityGenerationId:
            fixture.installationIdentityGenerationId,
          providerId: prospectiveProviderId,
          registryEntryContentDigest: contentDigest,
          registryGeneration: 1,
          copiedRetainedStateCollectionCount: 7,
          retainedStateMutationCount: 0,
        },
      });
      if (!result.ok) throw new Error("temporary admission must succeed");
      expect(Object.isFrozen(result.value.preparedRegistrySuccessorSeed)).toBe(
        true,
      );
      expect(
        Object.getPrototypeOf(result.value.preparedRegistrySuccessorSeed),
      ).toBeNull();
      expect(
        Reflect.ownKeys(result.value.preparedRegistrySuccessorSeed),
      ).toEqual([]);
      expect(
        discardProviderRegistryPreparedSuccessorSeedInternalV1(
          result.value.preparedRegistrySuccessorSeed,
        ),
      ).toBe(true);
      expect(
        await diagnoseProviderRegistryProspectiveEntryTemporaryAdmissionInternalV1(
          prepared.temporaryCapability,
          {
            prospectiveRegistryEntryContentDigest: contentDigest,
            prospectiveRegistryEntry: candidate,
          },
        ),
      ).toEqual({
        ok: false,
        stage: "history_input",
        reason: "schema_invalid",
      });
    }
  });

  it("preserves the owner closure after a wrong temporary-admission binding", async () => {
    const prepared = createPreparedInvocation();
    const registryResult =
      await diagnoseProviderRegistryManifestHistoryPreparedInternalV1(
        prepared.requestIdentity,
        prepared.inputHandle,
        capability,
      );
    if (!registryResult.ok) {
      throw new Error("prepared Registry fixture must validate");
    }
    const wrongCryptoCapability = Object.freeze(
      Object.create(null),
    ) as typeof capability;
    expect(() =>
      mintProviderRegistryProspectiveEntryTemporaryAdmissionCapabilityInternalV1(
        registryResult.value.closure,
        wrongCryptoCapability,
      ),
    ).toThrow(TypeError);
    const temporaryCapability =
      mintProviderRegistryProspectiveEntryTemporaryAdmissionCapabilityInternalV1(
        registryResult.value.closure,
        capability,
      );
    discardRegistryHistoryVerifiedWitnessInternalV1(
      registryResult.value.closure,
      registryResult.value.registryTrustWitnessHandle,
      capability,
    );
    const candidate = prospectiveEntryV1();
    await expect(
      diagnoseProviderRegistryProspectiveEntryTemporaryAdmissionInternalV1(
        temporaryCapability,
        {
          prospectiveRegistryEntryContentDigest:
            deriveStoreDurableObjectProviderRegistryEntryContentDigestV1(
              candidate,
            ),
          prospectiveRegistryEntry: candidate,
        },
      ),
    ).resolves.toMatchObject({ ok: true });
  });

  it("returns nonthenable temporary-admission success and failure records", async () => {
    const prepared = await temporaryAdmissionCapabilityV1();
    const candidate = prospectiveEntryV1();
    const input = {
      prospectiveRegistryEntryContentDigest:
        deriveStoreDurableObjectProviderRegistryEntryContentDigestV1(
          candidate,
        ),
      prospectiveRegistryEntry: candidate,
    };
    const previousThen = Object.getOwnPropertyDescriptor(Object.prototype, "then");
    let reads = 0;
    let success:
      | Awaited<
          ReturnType<
            typeof diagnoseProviderRegistryProspectiveEntryTemporaryAdmissionInternalV1
          >
        >
      | undefined;
    let replay:
      | Awaited<
          ReturnType<
            typeof diagnoseProviderRegistryProspectiveEntryTemporaryAdmissionInternalV1
          >
        >
      | undefined;
    try {
      Object.defineProperty(Object.prototype, "then", {
        configurable: true,
        get() {
          reads += 1;
          throw new Error("prototype then must not be read");
        },
      });
      success =
        await diagnoseProviderRegistryProspectiveEntryTemporaryAdmissionInternalV1(
          prepared.temporaryCapability,
          input,
        );
      replay =
        await diagnoseProviderRegistryProspectiveEntryTemporaryAdmissionInternalV1(
          prepared.temporaryCapability,
          input,
        );
    } finally {
      if (previousThen === undefined) {
        delete (Object.prototype as { then?: unknown }).then;
      } else {
        Object.defineProperty(Object.prototype, "then", previousThen);
      }
    }
    expect(reads).toBe(0);
    expect(success).toMatchObject({ ok: true });
    expect(Object.getPrototypeOf(success)).toBeNull();
    if (success?.ok === true) {
      expect(Object.getPrototypeOf(success.value)).toBeNull();
    }
    expect(replay).toEqual({
      ok: false,
      stage: "history_input",
      reason: "schema_invalid",
    });
    expect(Object.getPrototypeOf(replay)).toBeNull();
  });

  it("checks all retained member IDs and existing material owners before temporary admission", async () => {
    const retainedEntry = currentEnabledEntryV1();
    const retainedCapability = await temporaryAdmissionCapabilityV1();
    expect(
      await diagnoseProviderRegistryProspectiveEntryTemporaryAdmissionInternalV1(
        retainedCapability.temporaryCapability,
        {
          prospectiveRegistryEntryContentDigest:
            deriveStoreDurableObjectProviderRegistryEntryContentDigestV1(
              retainedEntry,
            ),
          prospectiveRegistryEntry: retainedEntry,
        },
      ),
    ).toEqual({
      ok: false,
      stage: "member_set",
      reason: "member_transition_invalid",
    });

    const aliasedEntry = prospectiveEntryV1({
      aliasExistingProviderMaterial: true,
    });
    const aliasCapability = await temporaryAdmissionCapabilityV1();
    expect(
      await diagnoseProviderRegistryProspectiveEntryTemporaryAdmissionInternalV1(
        aliasCapability.temporaryCapability,
        {
          prospectiveRegistryEntryContentDigest:
            deriveStoreDurableObjectProviderRegistryEntryContentDigestV1(
              aliasedEntry,
            ),
          prospectiveRegistryEntry: aliasedEntry,
        },
      ),
    ).toEqual({
      ok: false,
      stage: "material_closure",
      reason: "public_key_material_alias",
    });
  });

  it("claims before input validation and never restores a failed temporary-admit cap", async () => {
    const prepared = await temporaryAdmissionCapabilityV1();
    expect(
      await diagnoseProviderRegistryProspectiveEntryTemporaryAdmissionInternalV1(
        prepared.temporaryCapability,
        { prospectiveRegistryEntry: prospectiveEntryV1() },
      ),
    ).toEqual({
      ok: false,
      stage: "history_input",
      reason: "schema_invalid",
    });
    const candidate = prospectiveEntryV1();
    expect(
      await diagnoseProviderRegistryProspectiveEntryTemporaryAdmissionInternalV1(
        prepared.temporaryCapability,
        {
          prospectiveRegistryEntryContentDigest:
            deriveStoreDurableObjectProviderRegistryEntryContentDigestV1(
              candidate,
            ),
          prospectiveRegistryEntry: candidate,
        },
      ),
    ).toEqual({
      ok: false,
      stage: "history_input",
      reason: "schema_invalid",
    });
  });

  it("keeps the exact detached histories, preserves 24/38, and yields a distinct one-shot witness", async () => {
    const prepared = createPreparedInvocation();
    const impostorRequest = Object.freeze({ ...prepared.requestIdentity });
    resetCryptoCalls();

    expectPreparedFailure(
      await diagnoseProviderRegistryManifestHistoryPreparedInternalV1(
        impostorRequest,
        prepared.inputHandle,
        capability,
      ),
    );
    expect(pointCalls).toBe(0);
    expect(signatureCalls).toBe(0);

    const result =
      await diagnoseProviderRegistryManifestHistoryPreparedInternalV1(
        prepared.requestIdentity,
        prepared.inputHandle,
        capability,
      );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expectHistoryCryptoCalls();

    const { closure, copyLedger, registryTrustWitnessHandle } = result.value;
    expect(closure.rootMetadataHistory).toBe(
      prepared.detached.rootMetadataHistory,
    );
    expect(closure.registryManifestHistory).toBe(
      prepared.detached.registryManifestHistory,
    );
    for (
      let index = 0;
      index < prepared.detached.rootMetadataHistory.length;
      index += 1
    ) {
      expect(closure.rootMetadataHistory[index]).toBe(
        prepared.detached.rootMetadataHistory[index],
      );
    }
    for (
      let index = 0;
      index < prepared.detached.registryManifestHistory.length;
      index += 1
    ) {
      expect(closure.registryManifestHistory[index]).toBe(
        prepared.detached.registryManifestHistory[index],
      );
    }
    expect(copyLedger).toEqual({
      preparedHistorySnapshotAttemptCount: 0,
      retainedParallelHistoryGraphCount: 0,
      nestedPreparedSnapshotAttemptCount: 0,
    });
    expect(Object.isFrozen(copyLedger)).toBe(true);
    expect(registryTrustWitnessHandle).not.toBe(prepared.inputHandle);
    expect(Object.isFrozen(prepared.inputHandle)).toBe(true);
    expect(Object.isFrozen(registryTrustWitnessHandle)).toBe(true);
    expect(Reflect.ownKeys(prepared.inputHandle)).toEqual([]);
    expect(Reflect.ownKeys(registryTrustWitnessHandle)).toEqual([]);

    const impostorClosure = Object.freeze({ ...closure });
    expect(
      takeRegistryHistoryVerifiedWitnessInternalV1(
        impostorClosure,
        registryTrustWitnessHandle,
        capability,
      ),
    ).toBeUndefined();
    const witness = takeRegistryHistoryVerifiedWitnessInternalV1(
      closure,
      registryTrustWitnessHandle,
      capability,
    );
    expect(witness).toBeDefined();
    if (witness === undefined) return;

    const tipManifest = prepared.detached.registryManifestHistory.at(-1)!;
    const tipRoot = prepared.detached.rootMetadataHistory.find(
      (candidate) =>
        candidate.rootGeneration ===
          tipManifest.payload.activeRootMetadata.rootGeneration &&
        candidate.rootKeyId ===
          tipManifest.payload.activeRootMetadata.rootKeyId &&
        candidate.contentDigest ===
          tipManifest.payload.activeRootMetadata.contentDigest,
    )!;
    const enabledTipMembers = tipManifest.payload.members.filter(
      (member) => member.disposition === "enabled",
    );
    expect(witness.suppliedHistoryTipRoot).toBe(
      tipRoot.payload.activeRoot,
    );
    expect(witness.tipManifestGenerationId).toBe(tipManifest.generationId);
    expect(witness.tipManifestContentDigest).toBe(tipManifest.contentDigest);
    expect(witness.verifiedTipEntries).toHaveLength(enabledTipMembers.length);
    for (let index = 0; index < enabledTipMembers.length; index += 1) {
      expect(witness.verifiedTipEntries[index]!.runtimeAttestation).toBe(
        enabledTipMembers[index]!.registryEntry.runtimeAttestation,
      );
      expect(
        witness.verifiedTipEntries[index]!
          .historicallyVerifiedApproverPublicKeys,
      ).toBe(
        enabledTipMembers[index]!.registryEntry.feasibilityApprovalKeys
          .publicKeyRecords,
      );
    }
    expect(
      takeRegistryHistoryVerifiedWitnessInternalV1(
        closure,
        registryTrustWitnessHandle,
        capability,
      ),
    ).toBeUndefined();
    expect(
      discardRegistryHistoryVerifiedWitnessInternalV1(
        closure,
        registryTrustWitnessHandle,
        capability,
      ),
    ).toBe(false);

    const callsAfterSuccess = { pointCalls, signatureCalls };
    expectPreparedFailure(
      await diagnoseProviderRegistryManifestHistoryPreparedInternalV1(
        prepared.requestIdentity,
        prepared.inputHandle,
        capability,
      ),
    );
    expect({ pointCalls, signatureCalls }).toEqual(callsAfterSuccess);
  });

  it("atomically consumes an exact request on wrong handle or capability", async () => {
    const wrongHandleInvocation = createPreparedInvocation();
    const wrongHandle =
      fakeOpaqueIdentity<PreparedRegistryHistoryInputHandleV1>();
    resetCryptoCalls();
    expectPreparedFailure(
      await diagnoseProviderRegistryManifestHistoryPreparedInternalV1(
        wrongHandleInvocation.requestIdentity,
        wrongHandle,
        capability,
      ),
    );
    expectPreparedFailure(
      await diagnoseProviderRegistryManifestHistoryPreparedInternalV1(
        wrongHandleInvocation.requestIdentity,
        wrongHandleInvocation.inputHandle,
        capability,
      ),
    );

    const wrongCapabilityInvocation = createPreparedInvocation();
    const wrongCapability =
      fakeOpaqueIdentity<ProviderStrictEd25519OpaqueCapabilityV1>();
    expectPreparedFailure(
      await diagnoseProviderRegistryManifestHistoryPreparedInternalV1(
        wrongCapabilityInvocation.requestIdentity,
        wrongCapabilityInvocation.inputHandle,
        wrongCapability,
      ),
    );
    expectPreparedFailure(
      await diagnoseProviderRegistryManifestHistoryPreparedInternalV1(
        wrongCapabilityInvocation.requestIdentity,
        wrongCapabilityInvocation.inputHandle,
        capability,
      ),
    );
    expect(pointCalls).toBe(0);
    expect(signatureCalls).toBe(0);
  });

  it("isolates same-capability concurrent invocations and their witness handles", async () => {
    const first = createPreparedInvocation();
    const second = createPreparedInvocation();
    resetCryptoCalls();
    const [firstResult, secondResult] = await Promise.all([
      diagnoseProviderRegistryManifestHistoryPreparedInternalV1(
        first.requestIdentity,
        first.inputHandle,
        capability,
      ),
      diagnoseProviderRegistryManifestHistoryPreparedInternalV1(
        second.requestIdentity,
        second.inputHandle,
        capability,
      ),
    ]);
    expect(firstResult.ok).toBe(true);
    expect(secondResult.ok).toBe(true);
    if (!firstResult.ok || !secondResult.ok) return;
    expectHistoryCryptoCalls(2);
    expect(firstResult.value.closure).not.toBe(secondResult.value.closure);
    expect(firstResult.value.registryTrustWitnessHandle).not.toBe(
      secondResult.value.registryTrustWitnessHandle,
    );
    expect(
      takeRegistryHistoryVerifiedWitnessInternalV1(
        firstResult.value.closure,
        secondResult.value.registryTrustWitnessHandle,
        capability,
      ),
    ).toBeUndefined();
    expect(
      takeRegistryHistoryVerifiedWitnessInternalV1(
        secondResult.value.closure,
        secondResult.value.registryTrustWitnessHandle,
        fakeOpaqueIdentity<ProviderStrictEd25519OpaqueCapabilityV1>(),
      ),
    ).toBeUndefined();
    // An exact-key attempt consumes each entry before handle/capability checks.
    expect(
      takeRegistryHistoryVerifiedWitnessInternalV1(
        firstResult.value.closure,
        firstResult.value.registryTrustWitnessHandle,
        capability,
      ),
    ).toBeUndefined();
    expect(
      takeRegistryHistoryVerifiedWitnessInternalV1(
        secondResult.value.closure,
        secondResult.value.registryTrustWitnessHandle,
        capability,
      ),
    ).toBeUndefined();
  });

  it("cleans the prepared entry on Registry failure and never returns a witness handle", async () => {
    const prepared = createPreparedInvocation((draft) => {
      const manifest = draft.registryManifestHistory[0]!.payload;
      manifest.manifestSignature = `${manifest.manifestSignature.slice(0, -1)}${
        manifest.manifestSignature.endsWith("0") ? "1" : "0"
      }` as typeof manifest.manifestSignature;
    });
    resetCryptoCalls();
    const result =
      await diagnoseProviderRegistryManifestHistoryPreparedInternalV1(
        prepared.requestIdentity,
        prepared.inputHandle,
        capability,
      );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.stage).toBe("manifest_signature");
      expect(result.reason).toBe("signature_invalid");
    }
    expect("value" in result).toBe(false);
    const callsAfterFailure = { pointCalls, signatureCalls };
    expectPreparedFailure(
      await diagnoseProviderRegistryManifestHistoryPreparedInternalV1(
        prepared.requestIdentity,
        prepared.inputHandle,
        capability,
      ),
    );
    expect({ pointCalls, signatureCalls }).toEqual(callsAfterFailure);
  });

  it("keeps ordinary public Registry validation outside both private maps", async () => {
    resetCryptoCalls();
    const publicClosure = await validateProviderRegistryManifestHistoryV1({
      installationIdentityGenerationId:
        fixture.installationIdentityGenerationId,
      bootstrapTrustBundle: structuredClone(fixture.bootstrapTrustBundle),
      rootMetadataHistory: structuredClone(fixture.rootMetadataHistory),
      registryManifestHistory: structuredClone(
        fixture.registryManifestHistory,
      ),
      strictCryptoCapability: capability,
    });
    expectHistoryCryptoCalls();
    expect(
      takeRegistryHistoryVerifiedWitnessInternalV1(
        publicClosure,
        fakeOpaqueIdentity<RegistryTrustWitnessHandleV1>(),
        capability,
      ),
    ).toBeUndefined();
  });

  it("rejects duplicate registration without deleting the original binding", () => {
    const prepared = createPreparedInvocation();
    const duplicateSnapshot = createPreparedRegistryHistorySnapshotInternalV1({
      installationIdentityGenerationId:
        prepared.detached.installationIdentityGenerationId,
      bootstrapTrustBundle: prepared.detached.bootstrapTrustBundle,
      rootMetadataHistory: prepared.detached.rootMetadataHistory,
      registryManifestHistory: prepared.detached.registryManifestHistory,
      strictCryptoCapability: capability,
    });
    expect(() =>
      registerPreparedRegistryHistoryInputInternalV1(
        prepared.requestIdentity,
        duplicateSnapshot,
        capability,
      ),
    ).toThrow(TypeError);
    expect(
      discardPreparedRegistryHistoryInputInternalV1(
        prepared.requestIdentity,
        prepared.inputHandle,
        capability,
      ),
    ).toBe(true);
  });
});

describe("prepared Registry retained direct-successor continuation", () => {
  it("validates one externally root-signed prepared successor without publishing or copying history", async () => {
    const bound = await finalBoundPreparedSuccessorV1();
    const envelope = preparedSuccessorEnvelopeV1(
      bound.destinationEntry,
      freshFormalMigrationIdV1,
    );
    resetCryptoCalls();

    const result =
      await diagnoseProviderRegistryPreparedDirectSuccessorInternalV1(
        bound.finalCandidateIdentity,
        bound.finalCapability,
        {
          formalMigrationId: freshFormalMigrationIdV1,
          externallySignedManifestEnvelope: envelope,
        },
      );

    expect(result).toMatchObject({
      ok: true,
      value: {
        authority: "none",
        validationScope:
          "direct_successor_of_retained_steady_tip_not_current_or_published",
        installationIdentityGenerationId:
          fixture.installationIdentityGenerationId,
        formalMigrationId: freshFormalMigrationIdV1,
        sourceProviderId: "durable-object-provider:native-b",
        destinationProviderId: prospectiveProviderId,
        retainedPrefixIdentityPreserved: true,
        externallySignedEnvelopeIdentityPreserved: true,
        copiedRetainedStateCollectionCount: 7,
        retainedStateCopyOperationCount: 1,
        retainedStateMutationCount: 0,
        registryManifestPublicationCount: 0,
        validatedManifestGenerationCountIncludingDirectSuccessor:
          fixture.registryManifestHistory.length + 1,
      },
    });
    expect(pointCalls).toBe(0);
    expect(signatureCalls).toBe(1);
    expect(Object.getPrototypeOf(result)).toBeNull();
    if (!result.ok) throw new Error("prepared successor must validate");
    expect(Object.getPrototypeOf(result.value)).toBeNull();
    expect(result.value.retainedSteadyTipRegistryManifest).toEqual({
      locatorProfile: "installation_provider_registry_manifest_v1",
      manifestGeneration:
        fixture.registryManifestHistory.at(-1)!.payload.manifestGeneration,
      generationId: fixture.registryManifestHistory.at(-1)!.generationId,
      contentDigest: fixture.registryManifestHistory.at(-1)!.contentDigest,
    });
    expect(result.value.preparedDirectSuccessorRegistryManifest).toEqual({
      locatorProfile: "installation_provider_registry_manifest_v1",
      manifestGeneration: envelope.payload.manifestGeneration,
      generationId: envelope.generationId,
      contentDigest: envelope.contentDigest,
    });
    expect(
      result.value.retainedTrustHistoryCanonicalBytesIncludingDirectSuccessor,
    ).toBeGreaterThan(result.value.preparedManifestCanonicalBytes);

    expect(
      await diagnoseProviderRegistryPreparedDirectSuccessorInternalV1(
        bound.finalCandidateIdentity,
        bound.finalCapability,
        {
          formalMigrationId: freshFormalMigrationIdV1,
          externallySignedManifestEnvelope: envelope,
        },
      ),
    ).toEqual({
      ok: false,
      stage: "history_input",
      reason: "schema_invalid",
    });
    expect(signatureCalls).toBe(1);
  });

  it("compares foreign candidate/capability tuples before delete and gives each owner one winner", async () => {
    const left = await finalBoundPreparedSuccessorV1();
    const right = await finalBoundPreparedSuccessorV1();
    const leftEnvelope = preparedSuccessorEnvelopeV1(
      left.destinationEntry,
      freshFormalMigrationIdV1,
    );
    const rightEnvelope = preparedSuccessorEnvelopeV1(
      right.destinationEntry,
      freshFormalMigrationIdV1,
    );
    const input = {
      formalMigrationId: freshFormalMigrationIdV1,
      externallySignedManifestEnvelope: leftEnvelope,
    };

    expect(
      await diagnoseProviderRegistryPreparedDirectSuccessorInternalV1(
        left.finalCandidateIdentity,
        right.finalCapability,
        input,
      ),
    ).toEqual({
      ok: false,
      stage: "history_input",
      reason: "schema_invalid",
    });
    await expect(
      diagnoseProviderRegistryPreparedDirectSuccessorInternalV1(
        left.finalCandidateIdentity,
        left.finalCapability,
        input,
      ),
    ).resolves.toMatchObject({ ok: true });
    await expect(
      diagnoseProviderRegistryPreparedDirectSuccessorInternalV1(
        right.finalCandidateIdentity,
        right.finalCapability,
        {
          formalMigrationId: freshFormalMigrationIdV1,
          externallySignedManifestEnvelope: rightEnvelope,
        },
      ),
    ).resolves.toMatchObject({ ok: true });

    const concurrent = await finalBoundPreparedSuccessorV1();
    const concurrentInput = {
      formalMigrationId: freshFormalMigrationIdV1,
      externallySignedManifestEnvelope: preparedSuccessorEnvelopeV1(
        concurrent.destinationEntry,
        freshFormalMigrationIdV1,
      ),
    };
    const outcomes = await Promise.all([
      diagnoseProviderRegistryPreparedDirectSuccessorInternalV1(
        concurrent.finalCandidateIdentity,
        concurrent.finalCapability,
        concurrentInput,
      ),
      diagnoseProviderRegistryPreparedDirectSuccessorInternalV1(
        concurrent.finalCandidateIdentity,
        concurrent.finalCapability,
        concurrentInput,
      ),
    ]);
    expect(outcomes.filter((outcome) => outcome.ok)).toHaveLength(1);
    expect(outcomes.filter((outcome) => !outcome.ok)).toEqual([
      { ok: false, stage: "history_input", reason: "schema_invalid" },
    ]);
  });

  it("permanently burns a correct claim before Schema or signature validation", async () => {
    const bound = await finalBoundPreparedSuccessorV1();
    const invalidEnvelope = preparedSuccessorEnvelopeV1(
      bound.destinationEntry,
      freshFormalMigrationIdV1,
      { signatureMode: "bitflip" },
    );
    expect(
      await diagnoseProviderRegistryPreparedDirectSuccessorInternalV1(
        bound.finalCandidateIdentity,
        bound.finalCapability,
        {
          formalMigrationId: freshFormalMigrationIdV1,
          externallySignedManifestEnvelope: invalidEnvelope,
        },
      ),
    ).toEqual({
      ok: false,
      stage: "manifest_signature",
      reason: "signature_invalid",
    });
    expect(
      await diagnoseProviderRegistryPreparedDirectSuccessorInternalV1(
        bound.finalCandidateIdentity,
        bound.finalCapability,
        {
          formalMigrationId: freshFormalMigrationIdV1,
          externallySignedManifestEnvelope: preparedSuccessorEnvelopeV1(
            bound.destinationEntry,
            freshFormalMigrationIdV1,
          ),
        },
      ),
    ).toEqual({
      ok: false,
      stage: "history_input",
      reason: "schema_invalid",
    });
  });

  it.each([
    {
      name: "wrong root signature",
      formalMigrationId: freshFormalMigrationIdV1,
      options: { signatureMode: "wrong_root" as const },
      stage: "manifest_signature",
      reason: "signature_invalid",
    },
    {
      name: "wrong predecessor",
      formalMigrationId: freshFormalMigrationIdV1,
      options: {
        predecessorGenerationId:
          fixture.registryManifestHistory[0]!.generationId,
      },
      stage: "manifest_predecessor",
      reason: "predecessor_pin_mismatch",
    },
    {
      name: "missing admitted destination member",
      formalMigrationId: freshFormalMigrationIdV1,
      options: { omitDestinationMember: true },
      stage: "routing",
      reason: "routing_invalid",
    },
    {
      name: "routing destination mismatch",
      formalMigrationId: freshFormalMigrationIdV1,
      options: {
        routingDestinationProviderId:
          "durable-object-provider:native-b" as StoreDurableObjectProviderRegistryEntryV1["providerId"],
      },
      stage: "routing",
      reason: "routing_invalid",
    },
    {
      name: "formal ID differs from signed routing",
      formalMigrationId: freshFormalMigrationIdV1,
      options: {
        envelopeMigrationId:
          `provider-migration:${"b".repeat(22)}` as ProviderMigrationIdV1,
      },
      stage: "routing",
      reason: "routing_invalid",
    },
    {
      name: "formal ID is reused anywhere in retained history",
      formalMigrationId: retainedFormalMigrationIdV1,
      options: {},
      stage: "routing",
      reason: "routing_invalid",
    },
  ])("rejects $name", async ({ formalMigrationId, options, stage, reason }) => {
    const bound = await finalBoundPreparedSuccessorV1();
    const envelope = preparedSuccessorEnvelopeV1(
      bound.destinationEntry,
      formalMigrationId,
      options,
    );
    expect(
      await diagnoseProviderRegistryPreparedDirectSuccessorInternalV1(
        bound.finalCandidateIdentity,
        bound.finalCapability,
        {
          formalMigrationId,
          externallySignedManifestEnvelope: envelope,
        },
      ),
    ).toEqual({ ok: false, stage, reason });
  });

  it("supports exact discard at every lifecycle state without letting a foreign identity burn its owner", async () => {
    const destinationEntry = prospectiveEntryV1();
    const prepared = await temporaryAdmissionCapabilityV1();
    const admission =
      await diagnoseProviderRegistryProspectiveEntryTemporaryAdmissionInternalV1(
        prepared.temporaryCapability,
        {
          prospectiveRegistryEntryContentDigest:
            deriveStoreDurableObjectProviderRegistryEntryContentDigestV1(
              destinationEntry,
            ),
          prospectiveRegistryEntry: destinationEntry,
        },
      );
    if (!admission.ok) throw new Error("temporary admission must succeed");
    const cohortIdentity = recursivelyFreeze({ cohort: 1 });
    const cohortCapability =
      bindProviderRegistryPreparedSuccessorSeedToCohortInternalV1(
        admission.value.preparedRegistrySuccessorSeed,
        cohortIdentity,
      );
    expect(
      discardProviderRegistryPreparedSuccessorCohortInternalV1(
        recursivelyFreeze({ cohort: 1 }),
        cohortCapability,
      ),
    ).toBe(false);
    expect(
      discardProviderRegistryPreparedSuccessorCohortInternalV1(
        cohortIdentity,
        cohortCapability,
      ),
    ).toBe(true);

    const finalBound = await finalBoundPreparedSuccessorV1();
    expect(
      discardProviderRegistryPreparedSuccessorFinalInternalV1(
        recursivelyFreeze({ ...finalBound.finalCandidateIdentity }),
        finalBound.finalCapability,
      ),
    ).toBe(false);
    expect(
      discardProviderRegistryPreparedSuccessorFinalInternalV1(
        finalBound.finalCandidateIdentity,
        finalBound.finalCapability,
      ),
    ).toBe(true);
    expect(
      discardProviderRegistryPreparedSuccessorFinalInternalV1(
        finalBound.finalCandidateIdentity,
        finalBound.finalCapability,
      ),
    ).toBe(false);
  });

  it("enforces generation and canonical-byte limits at exact B/B+1 boundaries using captured number checks", () => {
    const generationLimit = 4_096;
    expect(
      isProviderRegistryPreparedDirectSuccessorGenerationWithinLimitInternalV1(
        generationLimit - 1,
        generationLimit,
      ),
    ).toBe(true);
    expect(
      isProviderRegistryPreparedDirectSuccessorGenerationWithinLimitInternalV1(
        generationLimit,
        generationLimit,
      ),
    ).toBe(false);

    const envelope = preparedSuccessorEnvelopeV1(
      prospectiveEntryV1(),
      freshFormalMigrationIdV1,
    );
    const envelopeBytes = canonicalizeJcsSafeIntegerUtf8V1(envelope).byteLength;
    const retainedBytes = 100;
    expect(
      isProviderRegistryPreparedDirectSuccessorEnvelopeWithinByteLimitsInternalV1(
        envelopeBytes,
        retainedBytes,
        envelopeBytes,
        retainedBytes + envelopeBytes,
      ),
    ).toBe(true);
    expect(
      isProviderRegistryPreparedDirectSuccessorEnvelopeWithinByteLimitsInternalV1(
        envelopeBytes + 1,
        retainedBytes,
        envelopeBytes,
        retainedBytes + envelopeBytes + 1,
      ),
    ).toBe(false);
    expect(
      isProviderRegistryPreparedDirectSuccessorEnvelopeWithinByteLimitsInternalV1(
        envelopeBytes + 1,
        retainedBytes,
        envelopeBytes + 1,
        retainedBytes + envelopeBytes,
      ),
    ).toBe(false);

    const originalSafeInteger = Object.getOwnPropertyDescriptor(
      Number,
      "isSafeInteger",
    );
    let capturedCheckResult = false;
    try {
      Object.defineProperty(Number, "isSafeInteger", {
        configurable: true,
        value() {
          throw new Error("ambient Number.isSafeInteger must not be called");
        },
      });
      capturedCheckResult =
        isProviderRegistryPreparedDirectSuccessorGenerationWithinLimitInternalV1(
          generationLimit - 1,
          generationLimit,
        );
    } finally {
      if (originalSafeInteger !== undefined) {
        Object.defineProperty(Number, "isSafeInteger", originalSafeInteger);
      }
    }
    expect(capturedCheckResult).toBe(true);
  });

  it("builds expected members without ambient Array iteration", () => {
    const currentMembers = fixture.registryManifestHistory.at(-1)!.payload
      .members;
    const destinationEntry = prospectiveEntryV1();
    const destinationMember = recursivelyFreeze({
      providerId: destinationEntry.providerId,
      disposition: "enabled" as const,
      registryEntryContentDigest:
        deriveStoreDurableObjectProviderRegistryEntryContentDigestV1(
          destinationEntry,
        ),
      registryEntry: destinationEntry,
    });
    const originalIterator = Object.getOwnPropertyDescriptor(
      Array.prototype,
      Symbol.iterator,
    );
    let expectedMembers: ReturnType<
      typeof createProviderRegistryPreparedDirectSuccessorExpectedMembersInternalV1
    > = [];
    try {
      Object.defineProperty(Array.prototype, Symbol.iterator, {
        configurable: true,
        value() {
          throw new Error("ambient Array iterator must not be called");
        },
      });
      expectedMembers =
        createProviderRegistryPreparedDirectSuccessorExpectedMembersInternalV1(
          currentMembers,
          destinationMember,
        );
    } finally {
      if (originalIterator !== undefined) {
        Object.defineProperty(
          Array.prototype,
          Symbol.iterator,
          originalIterator,
        );
      }
    }
    expect(expectedMembers).toHaveLength(currentMembers.length + 1);
    expect(
      expectedMembers.find(
        (member) => member.providerId === destinationEntry.providerId,
      ),
    ).toBe(destinationMember);
  });

  it("validates the retained member transition without ambient Array iteration", () => {
    const destinationEntry = prospectiveEntryV1();
    const previous = fixture.registryManifestHistory.at(-1)!.payload;
    const current = preparedSuccessorEnvelopeV1(
      destinationEntry,
      freshFormalMigrationIdV1,
    ).payload;
    const originalIterator = Object.getOwnPropertyDescriptor(
      Array.prototype,
      Symbol.iterator,
    );
    let iteratorReads = 0;
    try {
      Object.defineProperty(Array.prototype, Symbol.iterator, {
        configurable: true,
        value() {
          iteratorReads += 1;
          throw new Error("ambient Array iterator must not be called");
        },
      });
      validateProviderRegistryPreparedDirectSuccessorMemberTransitionsInternalV1(
        previous,
        current,
      );
    } finally {
      if (originalIterator !== undefined) {
        Object.defineProperty(
          Array.prototype,
          Symbol.iterator,
          originalIterator,
        );
      }
    }
    expect(iteratorReads).toBe(0);
  });

  it("does not consult ambient Array.at or Map iteration and returns nonthenable carriers", async () => {
    const destinationEntry = prospectiveEntryV1();
    const prepared = await temporaryAdmissionCapabilityV1();
    const admission =
      await diagnoseProviderRegistryProspectiveEntryTemporaryAdmissionInternalV1(
        prepared.temporaryCapability,
        {
          prospectiveRegistryEntryContentDigest:
            deriveStoreDurableObjectProviderRegistryEntryContentDigestV1(
              destinationEntry,
            ),
          prospectiveRegistryEntry: destinationEntry,
        },
      );
    if (!admission.ok) throw new Error("temporary admission must succeed");
    const envelope = preparedSuccessorEnvelopeV1(
      destinationEntry,
      freshFormalMigrationIdV1,
    );
    const cohortIdentity = recursivelyFreeze({ cohort: "at-poison" });
    const cohortCapability =
      bindProviderRegistryPreparedSuccessorSeedToCohortInternalV1(
        admission.value.preparedRegistrySuccessorSeed,
        cohortIdentity,
      );
    const candidateIdentity = preparedSuccessorFinalCandidateIdentityV1(
      destinationEntry,
      "at-poison",
    );
    const finalCapability =
      bindProviderRegistryPreparedSuccessorCohortToFinalCandidateInternalV1(
        cohortIdentity,
        cohortCapability,
        candidateIdentity,
      );
    const originalAt = Object.getOwnPropertyDescriptor(Array.prototype, "at");
    const originalMapIterator = Object.getOwnPropertyDescriptor(
      Map.prototype,
      Symbol.iterator,
    );
    let mapIteratorReads = 0;
    let result:
      | Awaited<
          ReturnType<
            typeof diagnoseProviderRegistryPreparedDirectSuccessorInternalV1
          >
        >
      | undefined;
    try {
      Object.defineProperty(Array.prototype, "at", {
        configurable: true,
        value() {
          throw new Error("ambient Array.prototype.at must not be called");
        },
      });
      Object.defineProperty(Map.prototype, Symbol.iterator, {
        configurable: true,
        value() {
          mapIteratorReads += 1;
          throw new Error("ambient Map iterator must not be called");
        },
      });
      result =
        await diagnoseProviderRegistryPreparedDirectSuccessorInternalV1(
          candidateIdentity,
          finalCapability,
          {
            formalMigrationId: freshFormalMigrationIdV1,
            externallySignedManifestEnvelope: envelope,
          },
        );
    } finally {
      if (originalAt === undefined) {
        delete (Array.prototype as { at?: unknown }).at;
      } else {
        Object.defineProperty(Array.prototype, "at", originalAt);
      }
      if (originalMapIterator !== undefined) {
        Object.defineProperty(
          Map.prototype,
          Symbol.iterator,
          originalMapIterator,
        );
      }
    }
    expect(mapIteratorReads).toBe(0);
    expect(result).toMatchObject({ ok: true });
    expect(Object.getPrototypeOf(result)).toBeNull();
    if (result?.ok === true) {
      expect(Object.getPrototypeOf(result.value)).toBeNull();
    }
  });
});

describe("prepared Registry/Root architecture boundary", () => {
  const manifestSource = readFileSync(
    fileURLToPath(
      new URL("../src/provider-registry-manifest-history.ts", import.meta.url),
    ),
    "utf8",
  );
  const rootSource = readFileSync(
    fileURLToPath(
      new URL("../src/provider-registry-root-history.ts", import.meta.url),
    ),
    "utf8",
  );
  const handleSource = readFileSync(
    fileURLToPath(
      new URL(
        "../src/provider-registry-history-prepared-handle-internal.ts",
        import.meta.url,
      ),
    ),
    "utf8",
  );
  const successorHandleSource = readFileSync(
    fileURLToPath(
      new URL(
        "../src/provider-registry-history-prepared-successor-handle-internal.ts",
        import.meta.url,
      ),
    ),
    "utf8",
  );

  it("has no public prepared export and calls no public/snapshot wrapper", () => {
    expect(manifestSource).not.toMatch(
      /export\s+(?:async\s+)?function\s+diagnoseProviderRegistryManifestHistoryPreparedInternalV1/u,
    );
    expect(rootSource).not.toMatch(
      /export\s+(?:async\s+)?function\s+validateProviderRegistryRootMetadataHistoryPreparedInternalV1/u,
    );

    const manifestPreparedCore = manifestSource.slice(
      manifestSource.indexOf("async function validatePreparedInternalV1"),
      manifestSource.indexOf(
        "async function diagnoseProviderRegistryManifestHistoryPreparedInternalV1",
      ),
    );
    expect(manifestPreparedCore).not.toContain("snapshotExactInputV1(");
    expect(manifestPreparedCore).not.toContain(
      "snapshotManifestHistoryCandidatesV1(",
    );
    expect(manifestPreparedCore).not.toContain("snapshotBoundedJsonV1(");
    expect(manifestPreparedCore).not.toContain(
      "validateProviderRegistryRootMetadataHistoryV1(",
    );
    expect(manifestPreparedCore).toContain(
      "validateProviderRegistryRootMetadataHistoryPreparedInternalV1(",
    );

    const rootPreparedCore = rootSource.slice(
      rootSource.indexOf(
        "async function validateProviderRegistryRootMetadataHistoryPreparedInternalV1",
      ),
      rootSource.indexOf(
        "registerProviderRegistryRootHistoryPreparedValidatorInternalV1(",
      ),
    );
    expect(rootPreparedCore).not.toContain(
      "snapshotRootMetadataHistoryCandidatesV1(",
    );
    expect(rootPreparedCore).not.toContain(
      "snapshotBoundedEnvelopeJsonV1(",
    );
    expect(rootPreparedCore).not.toContain(
      "validateProviderRegistryRootMetadataHistoryV1(",
    );
    expect(rootPreparedCore).not.toContain(
      "diagnoseProviderRegistryRootMetadataHistoryInternalV1(",
    );
  });

  it("owns exactly the two distinct private WeakMaps required by the handoff", () => {
    expect(handleSource.match(/new CapturedWeakMapV1</gu)).toHaveLength(2);
    expect(handleSource).toContain("preparedRegistryHistorySnapshotsV1");
    expect(handleSource).toContain("registryHistoryVerifiedWitnessesV1");
  });

  it("keeps the successor continuation package-private and free of ambient at/spread/number/type-error seams", () => {
    expect(successorHandleSource.match(/new CapturedWeakMapV1</gu)).toHaveLength(
      3,
    );
    expect(successorHandleSource).not.toContain(".at(");
    const directCore = manifestSource.slice(
      manifestSource.indexOf(
        "function assertExactDeepFrozenManifestEnvelopeIdentityInternalV1",
      ),
      manifestSource.indexOf("function validateEntryCollectionsV1"),
    );
    expect(directCore).not.toContain("[...current.members");
    expect(directCore).not.toContain("Number.isSafeInteger(");
    expect(directCore).not.toContain("new TypeError(");
    expect(directCore).not.toContain("Array.prototype");
    expect(directCore).not.toContain(
      "cloneRegistryHistoryStateForTemporaryAdmissionInternalV1(",
    );
    expect(directCore).not.toContain("validateRegistryEntryV1(");
    expect(directCore).not.toContain("mapSetV1(");
    expect(directCore).not.toContain("setAddV1(");
    expect(directCore.match(/requireRootSignatureV1\(/gu)).toHaveLength(1);
  });
});
