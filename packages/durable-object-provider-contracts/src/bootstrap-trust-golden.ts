import { z } from "./zod-runtime.js";

import {
  PROVIDER_BOOTSTRAP_TRUST_BUNDLE_CONTENT_DIGEST_V1,
  PROVIDER_BOOTSTRAP_TRUST_BUNDLE_DOMAIN_V1,
  PROVIDER_BOOTSTRAP_TRUST_BUNDLE_PIN_V1,
  PROVIDER_BOOTSTRAP_TRUST_BUNDLE_RESOURCE_PATH_V1,
  ProviderBootstrapTrustBundleV1Schema,
  deriveProviderBootstrapTrustBundleContentDigestV1,
} from "./bootstrap-trust-bundle.js";
import {
  assertDataObjectDescriptorsBeforeSchemaV1,
  assertJsonDataTreeBeforeSchemaV1,
} from "./domain-crypto.js";
import {
  RFC8785_JCS_SAFE_INTEGER_PROFILE_V1,
  canonicalizeJcsSafeIntegerUtf8V1,
} from "./jcs.js";
import {
  assertFixedResourceByteAnchorInternalV1,
  parseFixedUtf8JsonResourceInternalV1,
  snapshotBoundedFixedResourceBytesInternalV1,
} from "./fixed-resource.js";
import {
  CanonicalPublicKeyBytes32V1Schema,
  ContentDigestV1Schema,
  Ed25519PublicKeyDigestV1Schema,
  ProviderRegistryRootKeyIdV1Schema,
  type ContentDigestV1,
} from "./primitives.js";
import {
  PROVIDER_SIGNED_PACKAGE_IDENTITY_DOMAIN_V1,
  ProviderBootstrapTrustBundlePinV1Schema,
  ProviderSignedPackageIdentityFieldsV1Schema,
  deriveProviderSignedPackageIdentityDigestV1,
} from "./provider-distribution-trust.js";
import {
  PROVIDER_REGISTRY_RECOVERY_KEY_ID_DOMAIN_V1,
  PROVIDER_REGISTRY_ROOT_METADATA_DOMAIN_V1,
  PROVIDER_REGISTRY_ROOT_SELF_SIGNATURE_DOMAIN_V1,
  ProviderRegistryRecoveryKeyIdFieldsV1Schema,
  ProviderRegistryRecoveryKeyIdV1Schema,
  ProviderRegistryRootMetadataUnsignedClaimsV1Schema,
  ProviderRegistryRootMetadataV1Schema,
  ProviderRegistryRootSelfSignatureV1Schema,
  ProviderRegistryRootSelfSignatureWrapperV1Schema,
  createProviderRegistryRootSelfSignatureMessageV1,
  deriveProviderEd25519PublicKeyDigestInternalV1,
  deriveProviderRegistryRecoveryKeyIdInternalV1,
  deriveProviderRegistryRootMetadataContentDigestV1,
  projectProviderRegistryRootMetadataUnsignedClaimsV1,
  validateProviderRegistryRootPublicKeyV1,
} from "./provider-registry-trust.js";
import { sha256InternalV1 } from "./sha256.js";
import {
  providerTrustDiagnosticFailureInternalV1,
  providerTrustDiagnosticSuccessInternalV1,
  type ProviderTrustDiagnosticResultV1,
} from "./provider-trust-diagnostics.js";
import {
  PROVIDER_STRICT_ED25519_ADVERSARIAL_MANIFEST_PIN_V1,
  ProviderStrictEd25519AdversarialManifestPinV1Schema,
  validateProviderStrictEd25519PointWithCapabilityV1,
  verifyRawEd25519WithCapabilityV1,
  type ProviderStrictEd25519OpaqueCapabilityV1,
} from "./strict-ed25519-conformance.js";
import {
  STRICT_ED25519_VERIFICATION_PROFILE_V1,
} from "./strict-ed25519.js";

export const PROVIDER_BOOTSTRAP_TRUST_GOLDEN_MANIFEST_RESOURCE_PATH_V1 =
  "fixtures/v1/golden/provider-bootstrap-structure-crypto-v1.json" as const;
export const PROVIDER_BOOTSTRAP_TRUST_GOLDEN_MANIFEST_MAX_BYTES_V1 =
  1_048_576;
export const PROVIDER_BOOTSTRAP_TRUST_GOLDEN_MANIFEST_PROFILE_V1 =
  "provider_bootstrap_structure_crypto_golden_manifest_v1" as const;
export const PROVIDER_BOOTSTRAP_TRUST_GOLDEN_MANIFEST_RESOURCE_BYTE_LENGTH_V1 =
  41_713;
export const PROVIDER_BOOTSTRAP_TRUST_GOLDEN_MANIFEST_RESOURCE_SHA256_HEX_V1 =
  "b55028577e024df64ed1bb21a5c36089a235df1de95ced0168de025e632a92d8" as const;
export const PROVIDER_BOOTSTRAP_TRUST_GOLDEN_MANIFEST_SEMANTIC_CONTENT_DIGEST_V1 =
  ContentDigestV1Schema.parse(
    "sha256:791dcb58e8168c8731edb7c96198d9c50da543a43d13a534ef02462fd5bed83c",
  );
export const PROVIDER_BOOTSTRAP_TRUST_BUNDLE_GOLDEN_RESOURCE_PATH_V1 =
  "fixtures/v1/golden/bootstrap-trust-bundle-v1.json" as const;

const LowerHexBytesV1Schema = z
  .string()
  .regex(/^(?:[0-9a-f]{2})+$/u);
const LowerHex32BytesV1Schema = z.string().regex(/^[0-9a-f]{64}$/u);
const LowerHex64BytesV1Schema = z.string().regex(/^[0-9a-f]{128}$/u);
const Sha256HexV1Schema = z.string().regex(/^[0-9a-f]{64}$/u);

const ExpectedDomainDigestV1Schema = z.strictObject({
  canonicalPreimageUtf8Hex: LowerHexBytesV1Schema,
  sha256Hex: Sha256HexV1Schema,
  contentDigest: ContentDigestV1Schema,
});

const ProviderSignedPackageIdentityGoldenVectorV1Schema = z.strictObject({
  caseId: z.literal(PROVIDER_SIGNED_PACKAGE_IDENTITY_DOMAIN_V1),
  domain: z.literal(PROVIDER_SIGNED_PACKAGE_IDENTITY_DOMAIN_V1),
  fields: ProviderSignedPackageIdentityFieldsV1Schema,
  expected: ExpectedDomainDigestV1Schema,
});

const ProviderBootstrapTrustBundleGoldenVectorV1Schema = z.strictObject({
  caseId: z.literal(PROVIDER_BOOTSTRAP_TRUST_BUNDLE_DOMAIN_V1),
  domain: z.literal(PROVIDER_BOOTSTRAP_TRUST_BUNDLE_DOMAIN_V1),
  fields: ProviderBootstrapTrustBundleV1Schema,
  expected: ExpectedDomainDigestV1Schema,
});

const ProviderRegistryRootMetadataGoldenVectorV1Schema = z.strictObject({
  caseId: z.literal(PROVIDER_REGISTRY_ROOT_METADATA_DOMAIN_V1),
  domain: z.literal(PROVIDER_REGISTRY_ROOT_METADATA_DOMAIN_V1),
  fields: ProviderRegistryRootMetadataV1Schema,
  expected: ExpectedDomainDigestV1Schema.extend({
    envelopeRootGeneration: z.literal(1),
    envelopeRootKeyId: ProviderRegistryRootKeyIdV1Schema,
    envelopeContentDigest: ContentDigestV1Schema,
  }),
});

const ProviderRegistryRootSelfSignatureExpectedV1Schema = z.strictObject({
  unsignedClaims: ProviderRegistryRootMetadataUnsignedClaimsV1Schema,
  signerWrapper: ProviderRegistryRootSelfSignatureWrapperV1Schema,
  canonicalMessageUtf8Hex: LowerHexBytesV1Schema,
  sha256Hex: Sha256HexV1Schema,
  rootKeyId: ProviderRegistryRootKeyIdV1Schema,
  publicKeyBytes: CanonicalPublicKeyBytes32V1Schema,
  rawPublicKeyHex: LowerHex32BytesV1Schema,
  publicKeyDigest: Ed25519PublicKeyDigestV1Schema,
  rawSignatureHex: LowerHex64BytesV1Schema,
  signature: ProviderRegistryRootSelfSignatureV1Schema,
  expectedSignatureResult: z.literal("valid_non_authoritative_fixture"),
});

const BootstrapRootSelfSignatureVerificationGoldenVectorV1Schema =
  z.strictObject({
    caseId: z.literal(
      "provider-registry-root-self-signature-fixed-bundle-v1",
    ),
    domain: z.literal(PROVIDER_REGISTRY_ROOT_SELF_SIGNATURE_DOMAIN_V1),
    signatureOrigin: z.literal(
      "fixed_bundle_one_time_seed_not_retained",
    ),
    fields: ProviderRegistryRootMetadataV1Schema,
    expected: ProviderRegistryRootSelfSignatureExpectedV1Schema,
  });

const DeterministicRootSelfSignatureSigningGoldenVectorV1Schema =
  z.strictObject({
    caseId: z.literal(
      "provider-registry-root-self-signature-deterministic-v1",
    ),
    domain: z.literal(PROVIDER_REGISTRY_ROOT_SELF_SIGNATURE_DOMAIN_V1),
    keyPurpose: z.literal(
      "non_production_deterministic_fixture_only",
    ),
    relationToFixedBundle: z.literal("independent_key_material"),
    rfc8032TestSeedHex: LowerHex32BytesV1Schema,
    fields: ProviderRegistryRootMetadataV1Schema,
    expected: ProviderRegistryRootSelfSignatureExpectedV1Schema,
  });

const ProviderRegistryRecoveryKeyIdGoldenVectorV1Schema = z.strictObject({
  caseId: z.string().regex(
    /^provider-registry-recovery-key-id-[0-2]-v1$/u,
  ),
  domain: z.literal(PROVIDER_REGISTRY_RECOVERY_KEY_ID_DOMAIN_V1),
  recoveryKeyOrdinal: z.union([
    z.literal(0),
    z.literal(1),
    z.literal(2),
  ]),
  fields: ProviderRegistryRecoveryKeyIdFieldsV1Schema,
  expected: z.strictObject({
    canonicalPreimageUtf8Hex: LowerHexBytesV1Schema,
    sha256Hex: Sha256HexV1Schema,
    id: ProviderRegistryRecoveryKeyIdV1Schema,
    rawPublicKeyHex: LowerHex32BytesV1Schema,
    publicKeyDigest: Ed25519PublicKeyDigestV1Schema,
  }),
});

const ProviderRegistryRecoveryKeyIdGoldenTripleV1Schema = z.tuple([
  ProviderRegistryRecoveryKeyIdGoldenVectorV1Schema.extend({
    caseId: z.literal("provider-registry-recovery-key-id-0-v1"),
    recoveryKeyOrdinal: z.literal(0),
  }),
  ProviderRegistryRecoveryKeyIdGoldenVectorV1Schema.extend({
    caseId: z.literal("provider-registry-recovery-key-id-1-v1"),
    recoveryKeyOrdinal: z.literal(1),
  }),
  ProviderRegistryRecoveryKeyIdGoldenVectorV1Schema.extend({
    caseId: z.literal("provider-registry-recovery-key-id-2-v1"),
    recoveryKeyOrdinal: z.literal(2),
  }),
]);

export const ProviderBootstrapTrustGoldenManifestV1Schema = z.strictObject({
  schemaVersion: z.literal(1),
  profile: z.literal(
    PROVIDER_BOOTSTRAP_TRUST_GOLDEN_MANIFEST_PROFILE_V1,
  ),
  canonicalizationProfile: z.literal(
    RFC8785_JCS_SAFE_INTEGER_PROFILE_V1,
  ),
  verificationProfile: z.literal(
    STRICT_ED25519_VERIFICATION_PROFILE_V1,
  ),
  fixtureAuthority: z.literal("none_structure_only"),
  fixedBundleResource: z.strictObject({
    packageResourcePath: z.literal(
      PROVIDER_BOOTSTRAP_TRUST_BUNDLE_RESOURCE_PATH_V1,
    ),
    goldenResourcePath: z.literal(
      PROVIDER_BOOTSTRAP_TRUST_BUNDLE_GOLDEN_RESOURCE_PATH_V1,
    ),
    resourceByteLength: z.literal(6_518),
    resourceBytesSha256Hex: Sha256HexV1Schema,
    bundlePayloadContentDigest: ContentDigestV1Schema,
    bootstrapTrustBundlePin: ProviderBootstrapTrustBundlePinV1Schema,
    strictManifestPin:
      ProviderStrictEd25519AdversarialManifestPinV1Schema,
  }),
  vectors: z.strictObject({
    signedPackageIdentityDigest:
      ProviderSignedPackageIdentityGoldenVectorV1Schema,
    bootstrapTrustBundleDigest:
      ProviderBootstrapTrustBundleGoldenVectorV1Schema,
    bootstrapRootMetadataDigest:
      ProviderRegistryRootMetadataGoldenVectorV1Schema,
    bootstrapRootSelfSignatureVerification:
      BootstrapRootSelfSignatureVerificationGoldenVectorV1Schema,
    deterministicRootSelfSignatureSigning:
      DeterministicRootSelfSignatureSigningGoldenVectorV1Schema,
    recoveryKeyIds: ProviderRegistryRecoveryKeyIdGoldenTripleV1Schema,
  }),
});
export type ProviderBootstrapTrustGoldenManifestV1 = z.infer<
  typeof ProviderBootstrapTrustGoldenManifestV1Schema
>;

export interface ProviderBootstrapTrustGoldenManifestValidationV1 {
  readonly authority: "none_structure_only";
  readonly manifest: ProviderBootstrapTrustGoldenManifestV1;
}

/**
 * Package-private raw resource Pin diagnostic shared by the public resource
 * verifier and the deterministic rejection runner.
 */
export function diagnoseProviderBootstrapTrustGoldenResourceAnchorInternalV1(
  snapshot: Uint8Array,
): ProviderTrustDiagnosticResultV1<Uint8Array> {
  try {
    assertFixedResourceByteAnchorInternalV1(
      snapshot,
      PROVIDER_BOOTSTRAP_TRUST_GOLDEN_MANIFEST_RESOURCE_BYTE_LENGTH_V1,
      PROVIDER_BOOTSTRAP_TRUST_GOLDEN_MANIFEST_RESOURCE_SHA256_HEX_V1,
    );
  } catch {
    return providerTrustDiagnosticFailureInternalV1(
      "compiled_golden_anchor",
      "fixed_resource_identity_mismatch",
    );
  }
  return providerTrustDiagnosticSuccessInternalV1(snapshot);
}

function bytesToLowerHex(bytes: Uint8Array): string {
  let output = "";
  for (const byte of bytes) output += byte.toString(16).padStart(2, "0");
  return output;
}

function lowerHexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function decodeCanonicalPublicKeyBytes32V1(value: string): Uint8Array {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const body = value.slice("base64url:".length);
  const decoded = new Uint8Array(32);
  let accumulator = 0;
  let availableBits = 0;
  let outputOffset = 0;
  for (const character of body) {
    const digit = alphabet.indexOf(character);
    if (digit < 0) throw new TypeError("invalid golden public key");
    accumulator = (accumulator << 6) | digit;
    availableBits += 6;
    if (availableBits >= 8) {
      availableBits -= 8;
      decoded[outputOffset] = (accumulator >>> availableBits) & 0xff;
      outputOffset += 1;
      accumulator &= (1 << availableBits) - 1;
    }
  }
  if (outputOffset !== 32 || availableBits !== 2 || accumulator !== 0) {
    throw new TypeError("invalid golden public key");
  }
  return decoded;
}

function deepFreezeJson<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) deepFreezeJson(child);
    Object.freeze(value);
  }
  return value;
}

function assertEqual(
  actual: string | number,
  expected: string | number,
  context: string,
): void {
  if (actual !== expected) {
    throw new Error(`${context} golden mismatch`);
  }
}

function assertCanonicalEqual(
  actual: unknown,
  expected: unknown,
  context: string,
): void {
  assertEqual(
    bytesToLowerHex(canonicalizeJcsSafeIntegerUtf8V1(actual)),
    bytesToLowerHex(canonicalizeJcsSafeIntegerUtf8V1(expected)),
    context,
  );
}

function verifyDomainDigestV1(
  domain: string,
  fields: object,
  expected: {
    readonly canonicalPreimageUtf8Hex: string;
    readonly sha256Hex: string;
    readonly contentDigest: ContentDigestV1;
  },
  context: string,
): void {
  const preimage = canonicalizeJcsSafeIntegerUtf8V1([domain, fields]);
  const sha256Hex = bytesToLowerHex(sha256InternalV1(preimage));
  assertEqual(
    bytesToLowerHex(preimage),
    expected.canonicalPreimageUtf8Hex,
    `${context} preimage`,
  );
  assertEqual(sha256Hex, expected.sha256Hex, `${context} SHA-256`);
  assertEqual(
    `sha256:${sha256Hex}`,
    expected.contentDigest,
    `${context} content digest`,
  );
}

function domainDigestVectorMatchesV1(
  domain: string,
  fields: object,
  expected: {
    readonly canonicalPreimageUtf8Hex: string;
    readonly sha256Hex: string;
    readonly contentDigest: ContentDigestV1;
  },
): boolean {
  const preimage = canonicalizeJcsSafeIntegerUtf8V1([domain, fields]);
  const sha256Hex = bytesToLowerHex(sha256InternalV1(preimage));
  return (
    bytesToLowerHex(preimage) ===
      expected.canonicalPreimageUtf8Hex &&
    sha256Hex === expected.sha256Hex &&
    `sha256:${sha256Hex}` === expected.contentDigest
  );
}

/**
 * Package-private deep-vector diagnostic used by the invalid-vector runner.
 * The public verifier calls the same core after the compiled semantic anchor,
 * so a Pin failure cannot make deeper regression vectors pass accidentally.
 */
export function diagnoseProviderBootstrapTrustGoldenStaticContractInternalV1(
  input: unknown,
): ProviderTrustDiagnosticResultV1<ProviderBootstrapTrustGoldenManifestV1> {
  let manifest: ProviderBootstrapTrustGoldenManifestV1;
  try {
    assertDataObjectDescriptorsBeforeSchemaV1(input);
    assertJsonDataTreeBeforeSchemaV1(input);
    manifest =
      ProviderBootstrapTrustGoldenManifestV1Schema.parse(input);
  } catch {
    return providerTrustDiagnosticFailureInternalV1(
      "golden_schema",
      "schema_invalid",
    );
  }

  const vectors = manifest.vectors;
  const fixedKeyMaterials = new Set<string>([
    vectors.bootstrapRootMetadataDigest.fields.activeRoot.publicKeyBytes,
    ...vectors.recoveryKeyIds.map(
      (vector) => vector.fields.publicKeyBytes,
    ),
  ]);
  if (
    fixedKeyMaterials.has(
      vectors.deterministicRootSelfSignatureSigning.expected
        .publicKeyBytes,
    )
  ) {
    return providerTrustDiagnosticFailureInternalV1(
      "golden_semantic",
      "key_material_alias",
    );
  }

  if (
    !domainDigestVectorMatchesV1(
      vectors.signedPackageIdentityDigest.domain,
      vectors.signedPackageIdentityDigest.fields,
      vectors.signedPackageIdentityDigest.expected,
    ) ||
    !domainDigestVectorMatchesV1(
      vectors.bootstrapTrustBundleDigest.domain,
      vectors.bootstrapTrustBundleDigest.fields,
      vectors.bootstrapTrustBundleDigest.expected,
    ) ||
    !domainDigestVectorMatchesV1(
      vectors.bootstrapRootMetadataDigest.domain,
      vectors.bootstrapRootMetadataDigest.fields,
      vectors.bootstrapRootMetadataDigest.expected,
    )
  ) {
    return providerTrustDiagnosticFailureInternalV1(
      "golden_semantic",
      "expected_bytes_mismatch",
    );
  }

  for (const vector of vectors.recoveryKeyIds) {
    const preimage = canonicalizeJcsSafeIntegerUtf8V1([
      vector.domain,
      vector.fields,
    ]);
    const sha256Hex = bytesToLowerHex(sha256InternalV1(preimage));
    if (
      bytesToLowerHex(preimage) !==
        vector.expected.canonicalPreimageUtf8Hex ||
      sha256Hex !== vector.expected.sha256Hex ||
      sha256Hex.slice(0, 22) !== vector.expected.id
    ) {
      return providerTrustDiagnosticFailureInternalV1(
        "golden_semantic",
        "expected_bytes_mismatch",
      );
    }
  }
  return providerTrustDiagnosticSuccessInternalV1(manifest);
}

/**
 * Package-private semantic Pin diagnostic shared by the public verifier and
 * coherent-alternate rejection vectors.
 */
export function diagnoseProviderBootstrapTrustGoldenCompiledAnchorInternalV1(
  manifest: ProviderBootstrapTrustGoldenManifestV1,
): ProviderTrustDiagnosticResultV1<ProviderBootstrapTrustGoldenManifestV1> {
  const contentDigest = ContentDigestV1Schema.parse(
    `sha256:${bytesToLowerHex(
      sha256InternalV1(canonicalizeJcsSafeIntegerUtf8V1(manifest)),
    )}`,
  );
  if (
    contentDigest !==
    PROVIDER_BOOTSTRAP_TRUST_GOLDEN_MANIFEST_SEMANTIC_CONTENT_DIGEST_V1
  ) {
    return providerTrustDiagnosticFailureInternalV1(
      "compiled_golden_anchor",
      "compiled_digest_mismatch",
    );
  }
  return providerTrustDiagnosticSuccessInternalV1(manifest);
}

async function verifyRootSelfSignatureVectorV1(
  vector:
    | z.infer<
        typeof BootstrapRootSelfSignatureVerificationGoldenVectorV1Schema
      >
    | z.infer<
        typeof DeterministicRootSelfSignatureSigningGoldenVectorV1Schema
      >,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): Promise<void> {
  const claims = projectProviderRegistryRootMetadataUnsignedClaimsV1(
    vector.fields,
  );
  const activeRoot = validateProviderRegistryRootPublicKeyV1(
    vector.fields.activeRoot,
  );
  const signerWrapper =
    ProviderRegistryRootSelfSignatureWrapperV1Schema.parse({
      rootKeyId: activeRoot.rootKeyId,
      domain: vector.domain,
      claims,
    });
  assertCanonicalEqual(
    claims,
    vector.expected.unsignedClaims,
    `${vector.caseId} unsigned claims`,
  );
  assertCanonicalEqual(
    signerWrapper,
    vector.expected.signerWrapper,
    `${vector.caseId} signer wrapper`,
  );
  const message = createProviderRegistryRootSelfSignatureMessageV1(
    vector.fields,
  );
  assertEqual(
    bytesToLowerHex(message),
    vector.expected.canonicalMessageUtf8Hex,
    `${vector.caseId} message`,
  );
  assertEqual(
    bytesToLowerHex(sha256InternalV1(message)),
    vector.expected.sha256Hex,
    `${vector.caseId} SHA-256`,
  );
  assertEqual(
    activeRoot.rootKeyId,
    vector.expected.rootKeyId,
    `${vector.caseId} root key ID`,
  );
  assertEqual(
    activeRoot.publicKeyBytes,
    vector.expected.publicKeyBytes,
    `${vector.caseId} public key`,
  );
  assertEqual(
    activeRoot.publicKeyDigest,
    vector.expected.publicKeyDigest,
    `${vector.caseId} public key digest`,
  );
  const rawPublicKey = decodeCanonicalPublicKeyBytes32V1(
    vector.expected.publicKeyBytes,
  );
  assertEqual(
    bytesToLowerHex(rawPublicKey),
    vector.expected.rawPublicKeyHex,
    `${vector.caseId} raw public key`,
  );
  assertEqual(
    vector.fields.selfSignature,
    vector.expected.signature,
    `${vector.caseId} wire signature`,
  );
  const signatureParts = vector.expected.signature.split(":");
  assertEqual(
    signatureParts[1] ?? "",
    activeRoot.rootKeyId,
    `${vector.caseId} signer key ID`,
  );
  assertEqual(
    signatureParts[2] ?? "",
    vector.expected.rawSignatureHex,
    `${vector.caseId} raw signature`,
  );
  const rawSignature = lowerHexToBytes(
    vector.expected.rawSignatureHex,
  );
  if (
    !(await validateProviderStrictEd25519PointWithCapabilityV1(
      strictCryptoCapability,
      rawPublicKey,
    )) ||
    !(await verifyRawEd25519WithCapabilityV1(
      strictCryptoCapability,
      rawPublicKey,
      message,
      rawSignature,
    ))
  ) {
    throw new Error(`${vector.caseId} strict signature mismatch`);
  }
}

/**
 * Verifies a parsed manifest against the compiled semantic anchor. Resource
 * consumers should prefer verifyProviderBootstrapTrustGoldenManifestResourceV1
 * so the exact raw bytes are anchored before JSON interpretation. A successful
 * result does not authenticate a package, registry root, or provider capability.
 */
export async function verifyProviderBootstrapTrustGoldenManifestV1(
  input: unknown,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): Promise<ProviderBootstrapTrustGoldenManifestValidationV1> {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  const manifest = ProviderBootstrapTrustGoldenManifestV1Schema.parse(input);
  const compiledAnchorDiagnostic =
    diagnoseProviderBootstrapTrustGoldenCompiledAnchorInternalV1(
      manifest,
    );
  if (!compiledAnchorDiagnostic.ok) {
    throw new Error(
      "bootstrap trust golden manifest compiled digest golden mismatch",
    );
  }
  const staticContractDiagnostic =
    diagnoseProviderBootstrapTrustGoldenStaticContractInternalV1(
      manifest,
    );
  if (!staticContractDiagnostic.ok) {
    throw new Error(
      "bootstrap trust golden manifest static contract mismatch",
    );
  }
  const vectors = manifest.vectors;

  assertEqual(
    manifest.fixedBundleResource.bundlePayloadContentDigest,
    PROVIDER_BOOTSTRAP_TRUST_BUNDLE_CONTENT_DIGEST_V1,
    "fixed Bundle content digest",
  );
  assertCanonicalEqual(
    manifest.fixedBundleResource.bootstrapTrustBundlePin,
    PROVIDER_BOOTSTRAP_TRUST_BUNDLE_PIN_V1,
    "fixed Bundle Pin",
  );
  assertCanonicalEqual(
    manifest.fixedBundleResource.strictManifestPin,
    PROVIDER_STRICT_ED25519_ADVERSARIAL_MANIFEST_PIN_V1,
    "fixed strict manifest Pin",
  );

  verifyDomainDigestV1(
    vectors.signedPackageIdentityDigest.domain,
    vectors.signedPackageIdentityDigest.fields,
    vectors.signedPackageIdentityDigest.expected,
    vectors.signedPackageIdentityDigest.caseId,
  );
  assertEqual(
    deriveProviderSignedPackageIdentityDigestV1(
      vectors.signedPackageIdentityDigest.fields,
    ),
    vectors.signedPackageIdentityDigest.expected.contentDigest,
    vectors.signedPackageIdentityDigest.caseId,
  );
  assertCanonicalEqual(
    vectors.signedPackageIdentityDigest.fields.bootstrapTrustBundle,
    manifest.fixedBundleResource.bootstrapTrustBundlePin,
    "signed package Bundle Pin",
  );

  verifyDomainDigestV1(
    vectors.bootstrapTrustBundleDigest.domain,
    vectors.bootstrapTrustBundleDigest.fields,
    vectors.bootstrapTrustBundleDigest.expected,
    vectors.bootstrapTrustBundleDigest.caseId,
  );
  assertEqual(
    deriveProviderBootstrapTrustBundleContentDigestV1(
      vectors.bootstrapTrustBundleDigest.fields,
    ),
    vectors.bootstrapTrustBundleDigest.expected.contentDigest,
    vectors.bootstrapTrustBundleDigest.caseId,
  );
  assertEqual(
    vectors.bootstrapTrustBundleDigest.expected.contentDigest,
    manifest.fixedBundleResource.bundlePayloadContentDigest,
    "Bundle vector to fixed resource",
  );
  assertCanonicalEqual(
    vectors.bootstrapTrustBundleDigest.fields.strictCryptoCapability
      .adversarialManifest,
    manifest.fixedBundleResource.strictManifestPin,
    "Bundle strict manifest Pin",
  );
  assertCanonicalEqual(
    vectors.bootstrapTrustBundleDigest.fields
      .bootstrapProviderRegistryRoot,
    vectors.bootstrapRootMetadataDigest.fields.activeRoot,
    "Bundle root to metadata active root",
  );
  assertCanonicalEqual(
    vectors.bootstrapTrustBundleDigest.fields
      .bootstrapProviderRegistryRootMetadata.payload,
    vectors.bootstrapRootMetadataDigest.fields,
    "Bundle root metadata payload",
  );
  assertEqual(
    vectors.bootstrapTrustBundleDigest.fields
      .bootstrapProviderRegistryRootMetadata.rootGeneration,
    vectors.bootstrapRootMetadataDigest.expected
      .envelopeRootGeneration,
    "Bundle root metadata Envelope generation",
  );
  assertEqual(
    vectors.bootstrapTrustBundleDigest.fields
      .bootstrapProviderRegistryRootMetadata.rootKeyId,
    vectors.bootstrapRootMetadataDigest.expected.envelopeRootKeyId,
    "Bundle root metadata Envelope key ID",
  );
  assertEqual(
    vectors.bootstrapTrustBundleDigest.fields
      .bootstrapProviderRegistryRootMetadata.contentDigest,
    vectors.bootstrapRootMetadataDigest.expected
      .envelopeContentDigest,
    "Bundle root metadata Envelope digest",
  );

  verifyDomainDigestV1(
    vectors.bootstrapRootMetadataDigest.domain,
    vectors.bootstrapRootMetadataDigest.fields,
    vectors.bootstrapRootMetadataDigest.expected,
    vectors.bootstrapRootMetadataDigest.caseId,
  );
  assertEqual(
    deriveProviderRegistryRootMetadataContentDigestV1(
      vectors.bootstrapRootMetadataDigest.fields,
    ),
    vectors.bootstrapRootMetadataDigest.expected.contentDigest,
    vectors.bootstrapRootMetadataDigest.caseId,
  );
  assertEqual(
    vectors.bootstrapRootMetadataDigest.expected.envelopeRootGeneration,
    vectors.bootstrapRootMetadataDigest.fields.rootGeneration,
    "root metadata Envelope generation",
  );
  assertEqual(
    vectors.bootstrapRootMetadataDigest.expected.envelopeRootKeyId,
    vectors.bootstrapRootMetadataDigest.fields.activeRoot.rootKeyId,
    "root metadata Envelope key ID",
  );
  assertEqual(
    vectors.bootstrapRootMetadataDigest.expected.envelopeContentDigest,
    vectors.bootstrapRootMetadataDigest.expected.contentDigest,
    "root metadata Envelope digest",
  );
  assertCanonicalEqual(
    vectors.bootstrapRootSelfSignatureVerification.fields,
    vectors.bootstrapRootMetadataDigest.fields,
    "fixed Bundle root signature metadata",
  );

  await verifyRootSelfSignatureVectorV1(
    vectors.bootstrapRootSelfSignatureVerification,
    strictCryptoCapability,
  );
  await verifyRootSelfSignatureVectorV1(
    vectors.deterministicRootSelfSignatureSigning,
    strictCryptoCapability,
  );

  const fixedKeyMaterials = new Set<string>([
    vectors.bootstrapRootMetadataDigest.fields.activeRoot.publicKeyBytes,
  ]);
  for (const vector of vectors.recoveryKeyIds) {
    const bundledRecoveryKey =
      vectors.bootstrapTrustBundleDigest.fields
        .providerRegistryRecoveryKeys[vector.recoveryKeyOrdinal];
    assertEqual(
      bundledRecoveryKey.publicKeyBytes,
      vector.fields.publicKeyBytes,
      `${vector.caseId} Bundle public key`,
    );
    assertEqual(
      bundledRecoveryKey.recoveryKeyId,
      vector.expected.id,
      `${vector.caseId} Bundle key ID`,
    );
    assertEqual(
      bundledRecoveryKey.publicKeyDigest,
      vector.expected.publicKeyDigest,
      `${vector.caseId} Bundle public-key digest`,
    );
    const preimage = canonicalizeJcsSafeIntegerUtf8V1([
      vector.domain,
      vector.fields,
    ]);
    const sha256Hex = bytesToLowerHex(sha256InternalV1(preimage));
    assertEqual(
      bytesToLowerHex(preimage),
      vector.expected.canonicalPreimageUtf8Hex,
      `${vector.caseId} preimage`,
    );
    assertEqual(
      sha256Hex,
      vector.expected.sha256Hex,
      `${vector.caseId} SHA-256`,
    );
    assertEqual(
      deriveProviderRegistryRecoveryKeyIdInternalV1(vector.fields),
      vector.expected.id,
      vector.caseId,
    );
    assertEqual(
      sha256Hex.slice(0, 22),
      vector.expected.id,
      `${vector.caseId} truncated ID`,
    );
    const rawPublicKey = decodeCanonicalPublicKeyBytes32V1(
      vector.fields.publicKeyBytes,
    );
    assertEqual(
      bytesToLowerHex(rawPublicKey),
      vector.expected.rawPublicKeyHex,
      `${vector.caseId} raw public key`,
    );
    assertEqual(
      deriveProviderEd25519PublicKeyDigestInternalV1(
        vector.fields.publicKeyBytes,
      ),
      vector.expected.publicKeyDigest,
      `${vector.caseId} raw public-key digest`,
    );
    if (fixedKeyMaterials.has(vector.fields.publicKeyBytes)) {
      throw new Error(`${vector.caseId} key material alias`);
    }
    fixedKeyMaterials.add(vector.fields.publicKeyBytes);
  }
  if (
    fixedKeyMaterials.has(
      vectors.deterministicRootSelfSignatureSigning.expected
        .publicKeyBytes,
    )
  ) {
    throw new Error("deterministic fixture key aliases fixed Bundle key");
  }

  return deepFreezeJson({
    authority: "none_structure_only",
    manifest,
  });
}

/**
 * Verifies the exact immutable fixture resource before interpreting its JSON.
 * This is the preferred entry point for package, provider, and browser runners.
 */
export async function verifyProviderBootstrapTrustGoldenManifestResourceV1(
  resourceBytes: unknown,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): Promise<ProviderBootstrapTrustGoldenManifestValidationV1> {
  const snapshot = snapshotBoundedFixedResourceBytesInternalV1(
    resourceBytes,
    PROVIDER_BOOTSTRAP_TRUST_GOLDEN_MANIFEST_MAX_BYTES_V1,
  );
  const resourceAnchorDiagnostic =
    diagnoseProviderBootstrapTrustGoldenResourceAnchorInternalV1(
      snapshot,
    );
  if (!resourceAnchorDiagnostic.ok) {
    throw new TypeError("fixed resource byte anchor mismatch");
  }
  return verifyProviderBootstrapTrustGoldenManifestV1(
    parseFixedUtf8JsonResourceInternalV1(
      resourceAnchorDiagnostic.value,
    ),
    strictCryptoCapability,
  );
}
