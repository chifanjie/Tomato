import { z } from "zod";

import {
  assertDataObjectDescriptorsBeforeSchemaV1,
  assertJsonDataTreeBeforeSchemaV1,
} from "./domain-crypto.js";
import {
  canonicalizeJcsSafeIntegerUtf8V1,
  parseCanonicalJcsSafeIntegerUtf8V1,
} from "./jcs.js";
import {
  ContentDigestV1Schema,
  type CanonicalPublicKeyBytes32V1,
  type ContentDigestV1,
} from "./primitives.js";
import {
  ProviderBootstrapTrustBundlePinV1Schema,
  type ProviderBootstrapTrustBundlePinV1,
} from "./provider-distribution-trust.js";
import {
  ProviderRegistryRecoveryPublicKeyV1Schema,
  ProviderRegistryRootMetadataEnvelopeV1Schema,
  ProviderRegistryRootPublicKeyV1Schema,
  validateProviderRegistryRecoveryPublicKeyV1,
  validateProviderRegistryRootMetadataEnvelopeStructureV1,
  validateProviderRegistryRootPublicKeyV1,
  verifyProviderRegistryBootstrapRootSelfSignatureV1,
  type ProviderRegistryRecoveryPublicKeyV1,
  type ProviderRegistryRootMetadataEnvelopeV1,
  type ProviderRegistryRootPublicKeyV1,
} from "./provider-registry-trust.js";
import {
  PROVIDER_TRUST_HISTORY_POLICY_V1,
  ProviderTrustHistoryPolicyV1Schema,
} from "./provider-trust-policy.js";
import { sha256InternalV1 } from "./sha256.js";
import {
  PROVIDER_STRICT_ED25519_ADVERSARIAL_MANIFEST_CONTENT_DIGEST_V1,
  PROVIDER_STRICT_ED25519_ADVERSARIAL_MANIFEST_DOMAIN_V1,
  PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1,
  PROVIDER_STRICT_ED25519_REQUIRED_CASE_IDS_V1,
  ProviderStrictEd25519AdversarialManifestEnvelopeV1Schema,
  ProviderStrictEd25519CryptoCapabilityV1Schema,
  getProviderStrictEd25519CryptoCapabilityBytesV1,
  validateProviderStrictEd25519PointWithCapabilityV1,
  type ProviderStrictEd25519AdversarialManifestEnvelopeV1,
  type ProviderStrictEd25519OpaqueCapabilityV1,
} from "./strict-ed25519-conformance.js";

export const PROVIDER_BOOTSTRAP_TRUST_BUNDLE_RESOURCE_PATH_V1 =
  "provider/bootstrap-trust-bundle-v1.json" as const;
export const PROVIDER_BOOTSTRAP_TRUST_BUNDLE_MAX_BYTES_V1 = 4_194_304;
export const PROVIDER_BOOTSTRAP_TRUST_BUNDLE_DOMAIN_V1 =
  "provider-bootstrap-trust-bundle-v1" as const;

type ProviderRegistryRecoveryKeyTripleV1 = [
  ProviderRegistryRecoveryPublicKeyV1,
  ProviderRegistryRecoveryPublicKeyV1,
  ProviderRegistryRecoveryPublicKeyV1,
];
const ProviderRegistryRecoveryKeyTripleV1Schema = z
  .array(ProviderRegistryRecoveryPublicKeyV1Schema)
  .length(3) as unknown as z.ZodType<ProviderRegistryRecoveryKeyTripleV1>;

export const ProviderBootstrapTrustBundleV1Schema = z.strictObject({
  profile: z.literal("provider_bootstrap_trust_bundle_v1"),
  strictCryptoCapability: ProviderStrictEd25519CryptoCapabilityV1Schema,
  bootstrapProviderRegistryRoot: ProviderRegistryRootPublicKeyV1Schema,
  bootstrapProviderRegistryRootMetadata:
    ProviderRegistryRootMetadataEnvelopeV1Schema,
  providerRegistryRecoveryKeys: ProviderRegistryRecoveryKeyTripleV1Schema,
  providerRegistryRecoveryThreshold: z.literal(2),
  providerTrustHistoryPolicy: ProviderTrustHistoryPolicyV1Schema,
});
export type ProviderBootstrapTrustBundleV1 = z.infer<
  typeof ProviderBootstrapTrustBundleV1Schema
>;

export const ProviderBootstrapTrustBundleEnvelopeV1Schema = z.strictObject({
  schemaVersion: z.literal(1),
  recordType: z.literal("provider_bootstrap_trust_bundle"),
  contentDigest: ContentDigestV1Schema,
  payload: ProviderBootstrapTrustBundleV1Schema,
});
export type ProviderBootstrapTrustBundleEnvelopeV1 = z.infer<
  typeof ProviderBootstrapTrustBundleEnvelopeV1Schema
>;

export const PROVIDER_BOOTSTRAP_TRUST_BUNDLE_CONTENT_DIGEST_V1 =
  ContentDigestV1Schema.parse(
    "sha256:a9aad99fd56ce76cf315514f258965e3d77e4da9e6a13897f42a27513a5c1cbc",
  );
export const PROVIDER_BOOTSTRAP_TRUST_BUNDLE_PIN_V1 = deepFreezeJson(
  ProviderBootstrapTrustBundlePinV1Schema.parse({
    locatorProfile: "distribution_provider_bootstrap_trust_bundle_v1",
    contentDigest: PROVIDER_BOOTSTRAP_TRUST_BUNDLE_CONTENT_DIGEST_V1,
  }),
);

export interface ValidateProviderBootstrapTrustBundleStructureV1Input {
  readonly bundleEnvelopeBytes: Uint8Array;
  readonly strictManifestEnvelopeBytes: Uint8Array;
  readonly strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1;
}

export interface ProviderBootstrapTrustBundleStructureValidationV1 {
  readonly authority: "none_structure_only";
  readonly bundleEnvelope: ProviderBootstrapTrustBundleEnvelopeV1;
  readonly strictManifestEnvelope:
    ProviderStrictEd25519AdversarialManifestEnvelopeV1;
}

export class ProviderBootstrapTrustStructureError extends Error {
  readonly code = "provider_unavailable" as const;
  readonly reason = "attestation_invalid" as const;

  constructor() {
    super("Provider bootstrap trust structure validation failed");
    this.name = "ProviderBootstrapTrustStructureError";
  }
}

const BASE64URL_PREFIX = "base64url:";
const BASE64URL_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const objectGetPrototypeOfV1 = Object.getPrototypeOf;
const reflectApplyV1 = Reflect.apply;
const uint8ArrayConstructorV1 = Uint8Array;
const uint8ArrayPrototypeV1 = uint8ArrayConstructorV1.prototype;
const typedArrayPrototypeV1 = objectGetPrototypeOfV1(
  uint8ArrayPrototypeV1,
);
const typedArrayByteLengthGetterV1 = Object.getOwnPropertyDescriptor(
  typedArrayPrototypeV1,
  "byteLength",
)?.get;
const typedArrayBufferGetterV1 = Object.getOwnPropertyDescriptor(
  typedArrayPrototypeV1,
  "buffer",
)?.get;
const arrayBufferByteLengthGetterV1 = Object.getOwnPropertyDescriptor(
  ArrayBuffer.prototype,
  "byteLength",
)?.get;
const uint8ArraySetV1 = uint8ArrayPrototypeV1.set;

function bytesToLowerHex(bytes: Uint8Array): string {
  let output = "";
  for (const byte of bytes) output += byte.toString(16).padStart(2, "0");
  return output;
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= left[index]! ^ right[index]!;
  }
  return difference === 0;
}

function canonicalJsonEqual(left: unknown, right: unknown): boolean {
  return bytesEqual(
    canonicalizeJcsSafeIntegerUtf8V1(left),
    canonicalizeJcsSafeIntegerUtf8V1(right),
  );
}

function deepFreezeJson<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) deepFreezeJson(child);
    Object.freeze(value);
  }
  return value;
}

function contentDigestForDomainV1(
  domain: string,
  payload: object,
): ContentDigestV1 {
  const preimage = canonicalizeJcsSafeIntegerUtf8V1([domain, payload]);
  return ContentDigestV1Schema.parse(
    `sha256:${bytesToLowerHex(sha256InternalV1(preimage))}`,
  );
}

function isIntrinsicArrayBufferV1(value: unknown): boolean {
  if (arrayBufferByteLengthGetterV1 === undefined) return false;
  try {
    reflectApplyV1(arrayBufferByteLengthGetterV1, value, []);
    return true;
  } catch {
    return false;
  }
}

function snapshotBoundedUint8ArrayV1(
  bytes: unknown,
  maxBytes: number,
): Uint8Array {
  if (
    bytes === null ||
    typeof bytes !== "object" ||
    typedArrayByteLengthGetterV1 === undefined ||
    typedArrayBufferGetterV1 === undefined
  ) {
    throw new TypeError("invalid bootstrap trust resource");
  }
  let byteLength: number;
  let backingBuffer: unknown;
  try {
    byteLength = reflectApplyV1(
      typedArrayByteLengthGetterV1,
      bytes,
      [],
    ) as number;
    backingBuffer = reflectApplyV1(
      typedArrayBufferGetterV1,
      bytes,
      [],
    );
  } catch {
    throw new TypeError("invalid bootstrap trust resource");
  }
  if (
    objectGetPrototypeOfV1(bytes) !== uint8ArrayPrototypeV1 ||
    !Number.isSafeInteger(byteLength) ||
    byteLength < 0 ||
    byteLength > maxBytes ||
    !isIntrinsicArrayBufferV1(backingBuffer)
  ) {
    throw new TypeError("invalid bootstrap trust resource");
  }
  const snapshot = new uint8ArrayConstructorV1(byteLength);
  try {
    reflectApplyV1(uint8ArraySetV1, snapshot, [bytes]);
  } catch {
    throw new TypeError("invalid bootstrap trust resource");
  }
  const snapshotByteLength = reflectApplyV1(
    typedArrayByteLengthGetterV1,
    snapshot,
    [],
  ) as number;
  if (snapshotByteLength !== byteLength || snapshotByteLength > maxBytes) {
    throw new TypeError("invalid bootstrap trust resource");
  }
  return snapshot;
}

function parseCanonicalResourceV1(
  bytes: unknown,
  maxBytes: number,
): unknown {
  return parseCanonicalJcsSafeIntegerUtf8V1(
    snapshotBoundedUint8ArrayV1(bytes, maxBytes),
  );
}

function requireExactInputV1(
  input: unknown,
): ValidateProviderBootstrapTrustBundleStructureV1Input {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const keys = Object.keys(descriptors).sort();
  const expected = [
    "bundleEnvelopeBytes",
    "strictCryptoCapability",
    "strictManifestEnvelopeBytes",
  ];
  if (
    keys.length !== expected.length ||
    keys.some((key, index) => key !== expected[index])
  ) {
    throw new TypeError("invalid bootstrap trust validation input");
  }
  return {
    bundleEnvelopeBytes: descriptors.bundleEnvelopeBytes?.value as Uint8Array,
    strictManifestEnvelopeBytes:
      descriptors.strictManifestEnvelopeBytes?.value as Uint8Array,
    strictCryptoCapability:
      descriptors.strictCryptoCapability
        ?.value as ProviderStrictEd25519OpaqueCapabilityV1,
  };
}

function decodeCanonicalPublicKeyBytes32V1(
  value: CanonicalPublicKeyBytes32V1,
): Uint8Array {
  const body = value.slice(BASE64URL_PREFIX.length);
  const decoded = new Uint8Array(32);
  let accumulator = 0;
  let availableBits = 0;
  let outputOffset = 0;

  for (const character of body) {
    const digit = BASE64URL_ALPHABET.indexOf(character);
    if (digit < 0) throw new TypeError("invalid canonical public key bytes");
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
    throw new TypeError("public key must decode to exactly 32 canonical bytes");
  }
  return decoded;
}

function validateStrictManifestEnvelopeV1(
  input: unknown,
): ProviderStrictEd25519AdversarialManifestEnvelopeV1 {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  const envelope =
    ProviderStrictEd25519AdversarialManifestEnvelopeV1Schema.parse(input);
  if (envelope.manifestVersion !== envelope.payload.manifestVersion) {
    throw new TypeError("strict manifest version mismatch");
  }
  const actualCaseIds = envelope.payload.cases.map((item) => item.caseId);
  if (
    actualCaseIds.length !==
      PROVIDER_STRICT_ED25519_REQUIRED_CASE_IDS_V1.length ||
    actualCaseIds.some(
      (caseId, index) =>
        caseId !== PROVIDER_STRICT_ED25519_REQUIRED_CASE_IDS_V1[index],
    )
  ) {
    throw new TypeError("strict manifest case coverage mismatch");
  }
  const derivedDigest = contentDigestForDomainV1(
    PROVIDER_STRICT_ED25519_ADVERSARIAL_MANIFEST_DOMAIN_V1,
    envelope.payload,
  );
  if (
    envelope.contentDigest !==
      PROVIDER_STRICT_ED25519_ADVERSARIAL_MANIFEST_CONTENT_DIGEST_V1 ||
    derivedDigest !==
      PROVIDER_STRICT_ED25519_ADVERSARIAL_MANIFEST_CONTENT_DIGEST_V1
  ) {
    throw new TypeError("strict manifest digest mismatch");
  }
  return envelope;
}

export function deriveProviderBootstrapTrustBundleContentDigestV1(
  input: unknown,
): ContentDigestV1 {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  const payload = ProviderBootstrapTrustBundleV1Schema.parse(input);
  return contentDigestForDomainV1(
    PROVIDER_BOOTSTRAP_TRUST_BUNDLE_DOMAIN_V1,
    payload,
  );
}

export function validateProviderBootstrapTrustBundleEnvelopeV1(
  input: unknown,
): ProviderBootstrapTrustBundleEnvelopeV1 {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  const envelope =
    ProviderBootstrapTrustBundleEnvelopeV1Schema.parse(input);
  if (
    envelope.contentDigest !==
    deriveProviderBootstrapTrustBundleContentDigestV1(envelope.payload)
  ) {
    throw new TypeError("bootstrap trust bundle digest mismatch");
  }
  return envelope;
}

export function createProviderBootstrapTrustBundlePinV1(
  input: unknown,
): ProviderBootstrapTrustBundlePinV1 {
  const envelope = validateProviderBootstrapTrustBundleEnvelopeV1(input);
  return ProviderBootstrapTrustBundlePinV1Schema.parse({
    locatorProfile: "distribution_provider_bootstrap_trust_bundle_v1",
    contentDigest: envelope.contentDigest,
  });
}

function validateBundleRootClosureV1(
  bundle: ProviderBootstrapTrustBundleV1,
): {
  readonly root: ProviderRegistryRootPublicKeyV1;
  readonly metadata: ProviderRegistryRootMetadataEnvelopeV1;
  readonly recoveryKeys: readonly ProviderRegistryRecoveryPublicKeyV1[];
} {
  const root = validateProviderRegistryRootPublicKeyV1(
    bundle.bootstrapProviderRegistryRoot,
  );
  const metadata = validateProviderRegistryRootMetadataEnvelopeStructureV1(
    bundle.bootstrapProviderRegistryRootMetadata,
  );
  const recoveryKeys = bundle.providerRegistryRecoveryKeys.map((key) =>
    validateProviderRegistryRecoveryPublicKeyV1(key),
  );
  if (
    metadata.rootGeneration !== 1 ||
    metadata.payload.rootGeneration !== 1 ||
    metadata.payload.activation !== "bootstrap" ||
    metadata.payload.predecessor.state !== "genesis" ||
    metadata.payload.recoverySignatures.length !== 0 ||
    !canonicalJsonEqual(root, metadata.payload.activeRoot)
  ) {
    throw new TypeError("bootstrap registry root closure mismatch");
  }

  for (let index = 1; index < recoveryKeys.length; index += 1) {
    if (
      recoveryKeys[index - 1]!.recoveryKeyId >=
      recoveryKeys[index]!.recoveryKeyId
    ) {
      throw new TypeError("recovery keys must be strictly ordered");
    }
  }
  const publicKeyMaterials = [
    root.publicKeyBytes,
    ...recoveryKeys.map((key) => key.publicKeyBytes),
  ];
  if (new Set(publicKeyMaterials).size !== publicKeyMaterials.length) {
    throw new TypeError("bootstrap trust key material must be unique");
  }
  return { root, metadata, recoveryKeys };
}

async function validateProviderBootstrapTrustBundleStructureInternalV1(
  input: ValidateProviderBootstrapTrustBundleStructureV1Input,
): Promise<ProviderBootstrapTrustBundleStructureValidationV1> {
  const exactInput = requireExactInputV1(input);
  const bundleUnknown = parseCanonicalResourceV1(
    exactInput.bundleEnvelopeBytes,
    PROVIDER_BOOTSTRAP_TRUST_BUNDLE_MAX_BYTES_V1,
  );
  const manifestUnknown = parseCanonicalResourceV1(
    exactInput.strictManifestEnvelopeBytes,
    PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1,
  );
  const bundleEnvelope =
    validateProviderBootstrapTrustBundleEnvelopeV1(bundleUnknown);
  const strictManifestEnvelope =
    validateStrictManifestEnvelopeV1(manifestUnknown);

  const liveCapabilityUnknown = parseCanonicalJcsSafeIntegerUtf8V1(
    getProviderStrictEd25519CryptoCapabilityBytesV1(
      exactInput.strictCryptoCapability,
    ),
  );
  const liveCapability =
    ProviderStrictEd25519CryptoCapabilityV1Schema.parse(
      liveCapabilityUnknown,
    );
  if (
    !canonicalJsonEqual(
      bundleEnvelope.payload.strictCryptoCapability,
      liveCapability,
    ) ||
    !canonicalJsonEqual(
      bundleEnvelope.payload.strictCryptoCapability.adversarialManifest,
      {
        locatorProfile:
          "distribution_provider_strict_ed25519_adversarial_manifest_v1",
        manifestVersion: strictManifestEnvelope.manifestVersion,
        contentDigest: strictManifestEnvelope.contentDigest,
      },
    ) ||
    strictManifestEnvelope.payload.verificationProfile !==
      liveCapability.verificationProfile ||
    !canonicalJsonEqual(
      bundleEnvelope.payload.providerTrustHistoryPolicy,
      PROVIDER_TRUST_HISTORY_POLICY_V1,
    )
  ) {
    throw new TypeError("bootstrap strict capability closure mismatch");
  }

  const { metadata, recoveryKeys } = validateBundleRootClosureV1(
    bundleEnvelope.payload,
  );
  for (const recoveryKey of recoveryKeys) {
    const admitted =
      await validateProviderStrictEd25519PointWithCapabilityV1(
        exactInput.strictCryptoCapability,
        decodeCanonicalPublicKeyBytes32V1(recoveryKey.publicKeyBytes),
      );
    if (!admitted) throw new TypeError("recovery key point rejected");
  }
  if (
    !(await verifyProviderRegistryBootstrapRootSelfSignatureV1(
      metadata,
      exactInput.strictCryptoCapability,
    ))
  ) {
    throw new TypeError("bootstrap root self-signature rejected");
  }

  return deepFreezeJson({
    authority: "none_structure_only" as const,
    bundleEnvelope,
    strictManifestEnvelope,
  });
}

export async function validateProviderBootstrapTrustBundleStructureV1(
  input: ValidateProviderBootstrapTrustBundleStructureV1Input,
): Promise<ProviderBootstrapTrustBundleStructureValidationV1> {
  try {
    return await validateProviderBootstrapTrustBundleStructureInternalV1(
      input,
    );
  } catch {
    throw new ProviderBootstrapTrustStructureError();
  }
}
