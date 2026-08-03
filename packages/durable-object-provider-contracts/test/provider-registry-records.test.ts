import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  PROVIDER_FEASIBILITY_APPROVER_PUBLIC_KEY_SIGNATURE_DOMAIN_V1,
  PROVIDER_REGISTRY_MANIFEST_DOMAIN_V1,
  PROVIDER_REGISTRY_MANIFEST_ID_DOMAIN_V1,
  PROVIDER_REGISTRY_MANIFEST_SIGNATURE_DOMAIN_V1,
  ProviderFeasibilityApproverPublicKeyV1Schema,
  ProviderRegistryManifestEnvelopeV1Schema,
  ProviderRegistryManifestPinV1Schema,
  ProviderRegistryManifestV1Schema,
  STORE_DURABLE_OBJECT_PROVIDER_BINDING_DERIVATION_GENERATION_SIGNATURE_DOMAIN_V1,
  STORE_DURABLE_OBJECT_PROVIDER_REGISTRY_ENTRY_DOMAIN_V1,
  STORE_DURABLE_OBJECT_PROVIDER_REGISTRY_ENTRY_SIGNATURE_DOMAIN_V1,
  STORE_DURABLE_OBJECT_PROVIDER_VERIFICATION_PUBLIC_KEY_SIGNATURE_DOMAIN_V1,
  STORE_PROVIDER_RUNTIME_ATTESTATION_SIGNATURE_DOMAIN_V1,
  StoreDurableObjectProviderRegistryEntryV1Schema,
  StoreDurableObjectProviderVerificationKeysV1Schema,
  createProviderFeasibilityApproverPublicKeySignatureMessageV1,
  createProviderRegistryManifestSignatureMessageV1,
  createStoreDurableObjectProviderBindingDerivationGenerationSignatureMessageV1,
  createStoreDurableObjectProviderRegistryEntrySignatureMessageV1,
  createStoreDurableObjectProviderRuntimeAttestationSignatureMessageV1,
  createStoreDurableObjectProviderVerificationPublicKeySignatureMessageV1,
  deriveProviderFeasibilityApproverKeyIdV1,
  deriveProviderRegistryManifestContentDigestV1,
  deriveProviderRegistryManifestGenerationIdV1,
  deriveStoreDurableObjectProviderRegistryEntryContentDigestV1,
  deriveStoreDurableObjectProviderRuntimeAttestationContentDigestV1,
  deriveStoreProviderVerificationKeyIdV1,
  projectProviderRegistryManifestIdFieldsV1,
  projectProviderRegistryManifestUnsignedClaimsV1,
  projectStoreDurableObjectProviderRegistryEntryUnsignedClaimsV1,
  validateProviderFeasibilityApproverPublicKeyStructureV1,
  validateStoreDurableObjectProviderVerificationPublicKeyStructureV1,
} from "../src/provider-registry-records.js";

const ROOT_KEY_ID = "a".repeat(22);
const PROVIDER_A = "durable-object-provider:a";
const PROVIDER_B = "durable-object-provider:b";
const INSTALLATION_ID = `installation-identity-generation:${"b".repeat(22)}`;
const ZERO_SIGNATURE = "0".repeat(128);

function contentDigest(character: string): string {
  return `sha256:${character.repeat(64)}`;
}

function publicKey(byte: number): {
  publicKeyBytes: string;
  publicKeyDigest: string;
} {
  const raw = Buffer.alloc(32, byte);
  return {
    publicKeyBytes: `base64url:${raw.toString("base64url")}`,
    publicKeyDigest: `sha256:${createHash("sha256").update(raw).digest("hex")}`,
  };
}

function registrySignature(character = "0"): string {
  return `provider-registry-ed25519:${ROOT_KEY_ID}:${character.repeat(128)}`;
}

function manifestSignature(character = "0"): string {
  return `provider-registry-manifest-ed25519:${ROOT_KEY_ID}:${character.repeat(128)}`;
}

function rootPin(): Record<string, unknown> {
  return {
    locatorProfile: "installation_provider_registry_root_metadata_v1",
    rootGeneration: 1,
    rootKeyId: ROOT_KEY_ID,
    contentDigest: contentDigest("1"),
  };
}

function verificationRecord(usage: string): Record<string, unknown> {
  const key = publicKey(7);
  const keyId = deriveStoreProviderVerificationKeyIdV1({
    providerId: PROVIDER_A,
    usage,
    publicKeyBytes: key.publicKeyBytes,
  });
  return {
    profile: "store_durable_object_provider_verification_public_key_v1",
    providerId: PROVIDER_A,
    registryGenerationIntroduced: 1,
    keyId,
    usage,
    algorithm: "ed25519",
    ...key,
    registrySignature: registrySignature(),
  };
}

function approverRecord(role: "qa" | "release"): Record<string, unknown> {
  const key = publicKey(role === "qa" ? 8 : 9);
  const keyId = deriveProviderFeasibilityApproverKeyIdV1({
    role,
    publicKeyBytes: key.publicKeyBytes,
  });
  return {
    profile: "provider_feasibility_approver_public_key_v1",
    distributionRegistryGenerationIntroduced: 1,
    role,
    keyId,
    algorithm: "ed25519",
    ...key,
    registrySignature: registrySignature(),
  };
}

function registryEntry(): Record<string, any> {
  const usages = [
    "containment_proof",
    "journal_version",
    "migration_semantic_proof",
    "operation_receipt",
    "state_version",
  ];
  const records = usages.map(verificationRecord);
  const byUsage = new Map(records.map((record) => [record.usage, record.keyId]));
  const qa = approverRecord("qa");
  const release = approverRecord("release");
  const runtimePayload = {
    profile: "store_durable_object_provider_runtime_attestation_v1",
    providerId: PROVIDER_A,
    semanticProviderPolicyDigest: contentDigest("2"),
    implementationDigest: contentDigest("3"),
    binaryAttestationDigest: contentDigest("4"),
    ipcEndpointAttestationDigest: contentDigest("5"),
    osPlatform: "darwin",
    osReleaseFamilyCode: `provider-os-family:${"c".repeat(22)}`,
    osBuildDigest: contentDigest("6"),
    architecture: "arm64",
    filesystemProfileDigest: contentDigest("7"),
    realFilesystemConformanceResultDigest: contentDigest("8"),
    attestationGeneration: 1,
    issuedAt: "2026-08-03T01:02:03Z",
    registrySignature: registrySignature(),
  };
  return {
    profile: "store_durable_object_provider_registry_entry_v1",
    installationIdentityGenerationId: INSTALLATION_ID,
    activeRootMetadata: rootPin(),
    registryRootKeyId: ROOT_KEY_ID,
    registryGeneration: 1,
    providerId: PROVIDER_A,
    semanticProviderPolicyDigest: contentDigest("2"),
    providerFeasibilityEvidence: {
      locatorProfile: "installation_provider_feasibility_evidence_v1",
      evidenceId: `provider-feasibility-evidence:${"d".repeat(22)}`,
      contentDigest: contentDigest("9"),
    },
    runtimeAttestation: {
      profile: "store_durable_object_provider_runtime_attestation_pin_v1",
      contentDigest:
        deriveStoreDurableObjectProviderRuntimeAttestationContentDigestV1(
          runtimePayload,
        ),
      payload: runtimePayload,
    },
    verificationKeys: {
      profile: "store_durable_object_provider_verification_keys_v1",
      activeKeyIds: {
        operationReceipt: byUsage.get("operation_receipt"),
        containmentProof: byUsage.get("containment_proof"),
        stateVersion: byUsage.get("state_version"),
        journalVersion: byUsage.get("journal_version"),
      },
      activeBindingDerivationKeyGeneration: 1,
      publicKeyRecords: records,
      bindingDerivationGenerationRecords: [
        {
          profile:
            "store_durable_object_provider_binding_derivation_generation_v1",
          providerId: PROVIDER_A,
          registryGenerationIntroduced: 1,
          generation: 1,
          algorithm: "hmac_sha256_provider_private",
          keyCommitmentDigest: contentDigest("a"),
          registrySignature: registrySignature(),
        },
      ],
      compromisedRevokedKeyIds: [],
      compromisedRevokedBindingDerivationGenerations: [],
    },
    feasibilityApprovalKeys: {
      profile: "provider_feasibility_approval_keys_v1",
      activeKeyIds: { qa: qa.keyId, release: release.keyId },
      publicKeyRecords: [qa, release],
      compromisedRevokedKeyIds: [],
    },
    status: "enabled",
    registrySignature: registrySignature(),
  };
}

function manifest(entry = registryEntry()): Record<string, any> {
  const member = {
    providerId: PROVIDER_A,
    disposition: "enabled",
    registryEntryContentDigest:
      deriveStoreDurableObjectProviderRegistryEntryContentDigestV1(entry),
    registryEntry: entry,
  };
  const idFields = {
    installationIdentityGenerationId: INSTALLATION_ID,
    activeRootMetadata: rootPin(),
    manifestGeneration: 1,
    predecessor: { state: "genesis" },
    members: [member],
    routing: { state: "steady" },
  };
  return {
    profile: "provider_registry_manifest_v1",
    generationId: deriveProviderRegistryManifestGenerationIdV1(idFields),
    ...idFields,
    issuedAt: "2026-08-03T01:02:03Z",
    manifestSignature: manifestSignature(),
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function decodedMessage(message: Uint8Array): any[] {
  return JSON.parse(new TextDecoder().decode(message)) as any[];
}

describe("provider Registry records", () => {
  it("freezes exact domains and branded wire prefixes", () => {
    expect(STORE_DURABLE_OBJECT_PROVIDER_REGISTRY_ENTRY_DOMAIN_V1).toBe(
      "store-durable-object-provider-registry-entry-v1",
    );
    expect(PROVIDER_REGISTRY_MANIFEST_ID_DOMAIN_V1).toBe(
      "provider-registry-manifest-id-v1",
    );
    expect(PROVIDER_REGISTRY_MANIFEST_DOMAIN_V1).toBe(
      "provider-registry-manifest-v1",
    );
    expect(() =>
      ProviderRegistryManifestV1Schema.parse({
        ...manifest(),
        generationId: `provider-registry-manifest:${"A".repeat(22)}`,
      }),
    ).toThrow();
    expect(() =>
      ProviderRegistryManifestV1Schema.parse({
        ...manifest(),
        manifestSignature: `provider-registry-ed25519:${ROOT_KEY_ID}:${ZERO_SIGNATURE}`,
      }),
    ).toThrow();
  });

  it("keeps five key usages while the active map has exactly four entries", () => {
    const entry = registryEntry();
    expect(StoreDurableObjectProviderVerificationKeysV1Schema.parse(
      entry.verificationKeys,
    ).publicKeyRecords.map(({ usage }) => usage)).toContain(
      "migration_semantic_proof",
    );
    const extraActive = clone(entry.verificationKeys);
    extraActive.activeKeyIds.migrationSemanticProof =
      extraActive.publicKeyRecords[2].keyId;
    expect(() =>
      StoreDurableObjectProviderVerificationKeysV1Schema.parse(extraActive),
    ).toThrow();
  });

  it("derives and validates provider and approver key IDs independently from raw-key digests", () => {
    const entry = registryEntry();
    const providerKey = entry.verificationKeys.publicKeyRecords[0];
    expect(deriveStoreProviderVerificationKeyIdV1(providerKey)).toBe(
      providerKey.keyId,
    );
    expect(
      validateStoreDurableObjectProviderVerificationPublicKeyStructureV1(
        providerKey,
      ),
    ).toEqual(providerKey);
    expect(providerKey.publicKeyDigest.slice(7, 29)).not.toBe(providerKey.keyId);

    const approver = entry.feasibilityApprovalKeys.publicKeyRecords[0];
    expect(deriveProviderFeasibilityApproverKeyIdV1(approver)).toBe(
      approver.keyId,
    );
    expect(
      validateProviderFeasibilityApproverPublicKeyStructureV1(approver),
    ).toEqual(approver);

    const badDigest = { ...providerKey, publicKeyDigest: contentDigest("f") };
    expect(() =>
      validateStoreDurableObjectProviderVerificationPublicKeyStructureV1(
        badDigest,
      ),
    ).toThrow(/material mismatch/u);
  });

  it("uses atomic Entry genesis/successor branches and closed nested records", () => {
    const entry = registryEntry();
    expect(StoreDurableObjectProviderRegistryEntryV1Schema.parse(entry)).toEqual(
      entry,
    );

    expect(() =>
      StoreDurableObjectProviderRegistryEntryV1Schema.parse({
        ...entry,
        predecessorRegistryEntryContentDigest: contentDigest("e"),
      }),
    ).toThrow();
    expect(() =>
      StoreDurableObjectProviderRegistryEntryV1Schema.parse({
        ...entry,
        registryGeneration: 2,
      }),
    ).toThrow();
    expect(() =>
      StoreDurableObjectProviderRegistryEntryV1Schema.parse({
        ...entry,
        callerPath: "/untrusted/registry.json",
      }),
    ).toThrow();
  });

  it("enforces canonical array order and exact revocation scalar fields", () => {
    const entry = registryEntry();
    const reversed = clone(entry.verificationKeys);
    reversed.publicKeyRecords.reverse();
    expect(() =>
      StoreDurableObjectProviderVerificationKeysV1Schema.parse(reversed),
    ).toThrow(/sorted and unique/u);

    const duplicateRevocation = clone(entry.verificationKeys);
    duplicateRevocation.compromisedRevokedKeyIds = [
      entry.verificationKeys.publicKeyRecords[0].keyId,
      entry.verificationKeys.publicKeyRecords[0].keyId,
    ];
    expect(() =>
      StoreDurableObjectProviderVerificationKeysV1Schema.parse(
        duplicateRevocation,
      ),
    ).toThrow(/sorted and unique/u);

    const inventedRevocationRecord = clone(entry.verificationKeys);
    inventedRevocationRecord.compromisedKeyRevocations = [];
    expect(() =>
      StoreDurableObjectProviderVerificationKeysV1Schema.parse(
        inventedRevocationRecord,
      ),
    ).toThrow();
  });

  it("uses atomic Manifest genesis/successor branches and sorted unique members", () => {
    const value = manifest();
    expect(ProviderRegistryManifestV1Schema.parse(value)).toEqual(value);
    expect(() =>
      ProviderRegistryManifestV1Schema.parse({
        ...value,
        manifestGeneration: 2,
      }),
    ).toThrow();
    expect(() =>
      ProviderRegistryManifestV1Schema.parse({
        ...value,
        predecessor: {
          state: "manifest",
          generationId: value.generationId,
          contentDigest: contentDigest("e"),
        },
      }),
    ).toThrow();

    const reversedMembers = clone(value);
    reversedMembers.members = [
      {
        providerId: PROVIDER_B,
        disposition: "revoked",
        lastEnabledRegistryEntryContentDigest: contentDigest("f"),
        revokedAtManifestGeneration: 1,
        reason: "provider_compromised",
      },
      ...reversedMembers.members,
    ];
    expect(() => ProviderRegistryManifestV1Schema.parse(reversedMembers)).toThrow(
      /sorted and unique/u,
    );
  });

  it("separates Entry digest, Manifest stable ID, and Manifest content digest projections", () => {
    const entry = registryEntry();
    const entryDigest =
      deriveStoreDurableObjectProviderRegistryEntryContentDigestV1(entry);
    const changedEntrySignature = clone(entry);
    changedEntrySignature.registrySignature = registrySignature("1");
    expect(
      deriveStoreDurableObjectProviderRegistryEntryContentDigestV1(
        changedEntrySignature,
      ),
    ).toBe(entryDigest);
    expect(
      projectStoreDurableObjectProviderRegistryEntryUnsignedClaimsV1(entry),
    ).not.toHaveProperty("registrySignature");

    const first = manifest(entry);
    const bareIdFields = projectProviderRegistryManifestIdFieldsV1(first);
    const unsignedManifest = projectProviderRegistryManifestUnsignedClaimsV1(first);
    expect(deriveProviderRegistryManifestGenerationIdV1(first)).toBe(
      first.generationId,
    );
    expect(deriveProviderRegistryManifestGenerationIdV1(unsignedManifest)).toBe(
      first.generationId,
    );
    expect(deriveProviderRegistryManifestGenerationIdV1(bareIdFields)).toBe(
      first.generationId,
    );
    expect(bareIdFields).not.toHaveProperty("generationId");
    expect(bareIdFields).not.toHaveProperty("issuedAt");
    expect(bareIdFields).not.toHaveProperty("manifestSignature");
    const changedMemberSignature = manifest(changedEntrySignature);
    expect(changedMemberSignature.generationId).not.toBe(first.generationId);

    const changedIssuedAt = clone(first);
    changedIssuedAt.issuedAt = "2026-08-03T01:02:04Z";
    expect(
      deriveProviderRegistryManifestGenerationIdV1(
        projectProviderRegistryManifestIdFieldsV1(changedIssuedAt),
      ),
    ).toBe(first.generationId);
    expect(deriveProviderRegistryManifestContentDigestV1(changedIssuedAt)).not.toBe(
      deriveProviderRegistryManifestContentDigestV1(first),
    );

    const changedManifestSignature = clone(first);
    changedManifestSignature.manifestSignature = manifestSignature("2");
    expect(
      deriveProviderRegistryManifestContentDigestV1(changedManifestSignature),
    ).toBe(deriveProviderRegistryManifestContentDigestV1(first));
    expect(projectProviderRegistryManifestUnsignedClaimsV1(first)).not.toHaveProperty(
      "manifestSignature",
    );
  });

  it("builds all six exact registry-root signer-wrapper messages", () => {
    const entry = registryEntry();
    const manifestValue = manifest(entry);
    const examples = [
      [
        createStoreDurableObjectProviderRuntimeAttestationSignatureMessageV1(
          entry.runtimeAttestation.payload,
        ),
        STORE_PROVIDER_RUNTIME_ATTESTATION_SIGNATURE_DOMAIN_V1,
      ],
      [
        createStoreDurableObjectProviderVerificationPublicKeySignatureMessageV1(
          entry.verificationKeys.publicKeyRecords[0],
        ),
        STORE_DURABLE_OBJECT_PROVIDER_VERIFICATION_PUBLIC_KEY_SIGNATURE_DOMAIN_V1,
      ],
      [
        createStoreDurableObjectProviderBindingDerivationGenerationSignatureMessageV1(
          entry.verificationKeys.bindingDerivationGenerationRecords[0],
        ),
        STORE_DURABLE_OBJECT_PROVIDER_BINDING_DERIVATION_GENERATION_SIGNATURE_DOMAIN_V1,
      ],
      [
        createProviderFeasibilityApproverPublicKeySignatureMessageV1(
          entry.feasibilityApprovalKeys.publicKeyRecords[0],
        ),
        PROVIDER_FEASIBILITY_APPROVER_PUBLIC_KEY_SIGNATURE_DOMAIN_V1,
      ],
      [
        createStoreDurableObjectProviderRegistryEntrySignatureMessageV1(entry),
        STORE_DURABLE_OBJECT_PROVIDER_REGISTRY_ENTRY_SIGNATURE_DOMAIN_V1,
      ],
      [
        createProviderRegistryManifestSignatureMessageV1(manifestValue),
        PROVIDER_REGISTRY_MANIFEST_SIGNATURE_DOMAIN_V1,
      ],
    ] as const;

    for (const [message, domain] of examples) {
      const tuple = decodedMessage(message);
      expect(tuple).toHaveLength(2);
      expect(tuple[0]).toBe(domain);
      expect(tuple[1]).toMatchObject({ rootKeyId: ROOT_KEY_ID, domain });
      expect(tuple[1].claims).not.toHaveProperty("registrySignature");
      expect(tuple[1].claims).not.toHaveProperty("manifestSignature");
    }

    expect(() =>
      createStoreDurableObjectProviderRuntimeAttestationSignatureMessageV1(
        entry.runtimeAttestation.payload,
        "b".repeat(22),
      ),
    ).toThrow(/root key ID mismatch/u);
    expect(() =>
      createProviderRegistryManifestSignatureMessageV1(
        manifestValue,
        "b".repeat(22),
      ),
    ).toThrow(/root key ID mismatch/u);
  });

  it("closes Envelope and fixed-locator Pin wire fields", () => {
    const payload = manifest();
    const content = deriveProviderRegistryManifestContentDigestV1(payload);
    const envelope = {
      schemaVersion: 1,
      recordType: "provider_registry_manifest",
      generationId: payload.generationId,
      contentDigest: content,
      payload,
    };
    expect(ProviderRegistryManifestEnvelopeV1Schema.parse(envelope)).toEqual(
      envelope,
    );
    expect(
      ProviderRegistryManifestPinV1Schema.parse({
        locatorProfile: "installation_provider_registry_manifest_v1",
        manifestGeneration: 1,
        generationId: payload.generationId,
        contentDigest: content,
      }),
    ).toBeTruthy();
    expect(() =>
      ProviderRegistryManifestEnvelopeV1Schema.parse({
        ...envelope,
        path: "provider/registry-manifests/latest.json",
      }),
    ).toThrow();
  });
});
