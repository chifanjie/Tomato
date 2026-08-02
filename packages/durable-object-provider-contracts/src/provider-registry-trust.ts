import { z } from "zod";

import {
  assertDataObjectDescriptorsBeforeSchemaV1,
  assertJsonDataTreeBeforeSchemaV1,
} from "./domain-crypto.js";
import { canonicalizeJcsSafeIntegerUtf8V1 } from "./jcs.js";
import {
  CanonicalPublicKeyBytes32V1Schema,
  ContentDigestV1Schema,
  Ed25519PublicKeyDigestV1Schema,
  ProviderRegistryRootKeyIdV1Schema,
  type CanonicalPublicKeyBytes32V1,
  type ContentDigestV1,
  type Ed25519PublicKeyDigestV1,
  type ProviderRegistryRootKeyIdV1,
} from "./primitives.js";
import {
  PROVIDER_REGISTRY_ROOT_KEY_ID_DOMAIN_V1,
  ProviderRegistryRootKeyIdFieldsV1Schema,
} from "./provider-foundation.js";
import { sha256InternalV1 } from "./sha256.js";
import {
  validateProviderStrictEd25519PointWithCapabilityV1,
  verifyRawEd25519WithCapabilityV1,
  type ProviderStrictEd25519OpaqueCapabilityV1,
} from "./strict-ed25519-conformance.js";

export const PROVIDER_REGISTRY_RECOVERY_KEY_ID_DOMAIN_V1 =
  "provider-registry-recovery-key-id-v1" as const;
export const PROVIDER_REGISTRY_ROOT_METADATA_DOMAIN_V1 =
  "provider-registry-root-metadata-v1" as const;
export const PROVIDER_REGISTRY_ROOT_SELF_SIGNATURE_DOMAIN_V1 =
  "provider-registry-root-self-signature-v1" as const;
export const PROVIDER_REGISTRY_ROOT_CROSS_SIGNATURE_DOMAIN_V1 =
  "provider-registry-root-cross-signature-v1" as const;
export const PROVIDER_REGISTRY_ROOT_RECOVERY_SIGNATURE_DOMAIN_V1 =
  "provider-registry-root-recovery-signature-v1" as const;

const BASE64URL_PREFIX = "base64url:";
const BASE64URL_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const RFC3339_UTC_PATTERN =
  /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?Z$/u;
const PROVIDER_ROOT_SELF_SIGNATURE_PATTERN =
  /^provider-root-self-ed25519:([0-9a-f]{22}):([0-9a-f]{128})$/u;
const PROVIDER_ROOT_CROSS_SIGNATURE_PATTERN =
  /^provider-root-cross-ed25519:([0-9a-f]{22}):([0-9a-f]{128})$/u;
const PROVIDER_ROOT_RECOVERY_SIGNATURE_PATTERN =
  /^provider-root-recovery-ed25519:([0-9a-f]{22}):([0-9a-f]{128})$/u;

function isRealUtcTimestamp(value: string): boolean {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?Z$/u.exec(
      value,
    );
  if (match === null) return false;
  const [, year, month, day, hour, minute, second] = match;
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    hour === undefined ||
    minute === undefined ||
    second === undefined
  ) {
    return false;
  }

  const expected = [year, month, day, hour, minute, second].map(Number);
  const date = new Date(0);
  date.setUTCFullYear(expected[0]!, expected[1]! - 1, expected[2]!);
  date.setUTCHours(expected[3]!, expected[4]!, expected[5]!, 0);
  return (
    date.getUTCFullYear() === expected[0] &&
    date.getUTCMonth() + 1 === expected[1] &&
    date.getUTCDate() === expected[2] &&
    date.getUTCHours() === expected[3] &&
    date.getUTCMinutes() === expected[4] &&
    date.getUTCSeconds() === expected[5]
  );
}

const ProviderRegistryPositiveSafeIntegerV1Schema = z
  .number()
  .int()
  .min(1)
  .max(Number.MAX_SAFE_INTEGER);

export const ProviderRegistryIsoTimestampV1Schema = z
  .string()
  .regex(RFC3339_UTC_PATTERN)
  .refine(isRealUtcTimestamp, "timestamp must be a real RFC 3339 UTC value")
  .brand<"ProviderRegistryIsoTimestampV1">();
export type ProviderRegistryIsoTimestampV1 = z.infer<
  typeof ProviderRegistryIsoTimestampV1Schema
>;

export const ProviderRegistryRecoveryKeyIdV1Schema = z
  .string()
  .regex(/^[0-9a-f]{22}$/u)
  .brand<"ProviderRegistryRecoveryKeyIdV1">();
export type ProviderRegistryRecoveryKeyIdV1 = z.infer<
  typeof ProviderRegistryRecoveryKeyIdV1Schema
>;

export const ProviderRegistryRecoveryKeyIdFieldsV1Schema = z
  .strictObject({
    publicKeyBytes: CanonicalPublicKeyBytes32V1Schema,
  })
  .brand<"ProviderRegistryRecoveryKeyIdFieldsV1">();
export type ProviderRegistryRecoveryKeyIdFieldsV1 = z.infer<
  typeof ProviderRegistryRecoveryKeyIdFieldsV1Schema
>;

export const ProviderRegistryRootSelfSignatureV1Schema = z
  .string()
  .regex(PROVIDER_ROOT_SELF_SIGNATURE_PATTERN)
  .brand<"ProviderRegistryRootSelfSignatureV1">();
export type ProviderRegistryRootSelfSignatureV1 = z.infer<
  typeof ProviderRegistryRootSelfSignatureV1Schema
>;

export const ProviderRegistryRootCrossSignatureV1Schema = z
  .string()
  .regex(PROVIDER_ROOT_CROSS_SIGNATURE_PATTERN)
  .brand<"ProviderRegistryRootCrossSignatureV1">();
export type ProviderRegistryRootCrossSignatureV1 = z.infer<
  typeof ProviderRegistryRootCrossSignatureV1Schema
>;

export const ProviderRegistryRootRecoverySignatureV1Schema = z
  .string()
  .regex(PROVIDER_ROOT_RECOVERY_SIGNATURE_PATTERN)
  .brand<"ProviderRegistryRootRecoverySignatureV1">();
export type ProviderRegistryRootRecoverySignatureV1 = z.infer<
  typeof ProviderRegistryRootRecoverySignatureV1Schema
>;

export const ProviderRegistryRootPublicKeyV1Schema = z.strictObject({
  profile: z.literal("provider_registry_root_public_key_v1"),
  rootKeyId: ProviderRegistryRootKeyIdV1Schema,
  algorithm: z.literal("ed25519"),
  publicKeyBytes: CanonicalPublicKeyBytes32V1Schema,
  publicKeyDigest: Ed25519PublicKeyDigestV1Schema,
});
export type ProviderRegistryRootPublicKeyV1 = z.infer<
  typeof ProviderRegistryRootPublicKeyV1Schema
>;

export const ProviderRegistryRecoveryPublicKeyV1Schema = z.strictObject({
  profile: z.literal("provider_registry_recovery_public_key_v1"),
  recoveryKeyId: ProviderRegistryRecoveryKeyIdV1Schema,
  algorithm: z.literal("ed25519"),
  publicKeyBytes: CanonicalPublicKeyBytes32V1Schema,
  publicKeyDigest: Ed25519PublicKeyDigestV1Schema,
});
export type ProviderRegistryRecoveryPublicKeyV1 = z.infer<
  typeof ProviderRegistryRecoveryPublicKeyV1Schema
>;

const ProviderRegistryRootGenesisPredecessorV1Schema = z.strictObject({
  state: z.literal("genesis"),
});

const ProviderRegistryRootMetadataPredecessorV1Schema = z.strictObject({
  state: z.literal("root_metadata"),
  rootGeneration: ProviderRegistryPositiveSafeIntegerV1Schema,
  rootKeyId: ProviderRegistryRootKeyIdV1Schema,
  contentDigest: ContentDigestV1Schema,
});

const providerRegistryRootMetadataCommonShapeV1 = {
  profile: z.literal("provider_registry_root_metadata_v1"),
  rootGeneration: ProviderRegistryPositiveSafeIntegerV1Schema,
  activeRoot: ProviderRegistryRootPublicKeyV1Schema,
  issuedAt: ProviderRegistryIsoTimestampV1Schema,
  selfSignature: ProviderRegistryRootSelfSignatureV1Schema,
} as const;

const ProviderRegistryNoRecoverySignaturesV1Schema = z
  .array(ProviderRegistryRootRecoverySignatureV1Schema)
  .length(0) as unknown as z.ZodType<[]>;
type ProviderRegistryRecoverySignatureQuorumV1 = [
  ProviderRegistryRootRecoverySignatureV1,
  ProviderRegistryRootRecoverySignatureV1,
];
const ProviderRegistryRecoverySignatureQuorumV1Schema = z
  .array(ProviderRegistryRootRecoverySignatureV1Schema)
  .length(2) as unknown as z.ZodType<ProviderRegistryRecoverySignatureQuorumV1>;

const ProviderRegistryBootstrapRootMetadataV1Schema = z.strictObject({
  ...providerRegistryRootMetadataCommonShapeV1,
  activation: z.literal("bootstrap"),
  predecessor: ProviderRegistryRootGenesisPredecessorV1Schema,
  recoverySignatures: ProviderRegistryNoRecoverySignaturesV1Schema,
});

const ProviderRegistryPlannedRolloverRootMetadataV1Schema = z.strictObject({
  ...providerRegistryRootMetadataCommonShapeV1,
  activation: z.literal("planned_rollover"),
  predecessor: ProviderRegistryRootMetadataPredecessorV1Schema,
  predecessorCrossSignature: ProviderRegistryRootCrossSignatureV1Schema,
  recoverySignatures: ProviderRegistryRecoverySignatureQuorumV1Schema,
});

const ProviderRegistryCompromiseRecoveryRootMetadataV1Schema = z.strictObject({
  ...providerRegistryRootMetadataCommonShapeV1,
  activation: z.literal("compromise_recovery"),
  predecessor: ProviderRegistryRootMetadataPredecessorV1Schema,
  recoverySignatures: ProviderRegistryRecoverySignatureQuorumV1Schema,
});

export const ProviderRegistryRootMetadataV1Schema = z.discriminatedUnion(
  "activation",
  [
    ProviderRegistryBootstrapRootMetadataV1Schema,
    ProviderRegistryPlannedRolloverRootMetadataV1Schema,
    ProviderRegistryCompromiseRecoveryRootMetadataV1Schema,
  ],
);
export type ProviderRegistryRootMetadataV1 = z.infer<
  typeof ProviderRegistryRootMetadataV1Schema
>;

const providerRegistryRootUnsignedClaimsCommonShapeV1 = {
  profile: z.literal("provider_registry_root_metadata_v1"),
  rootGeneration: ProviderRegistryPositiveSafeIntegerV1Schema,
  activeRoot: ProviderRegistryRootPublicKeyV1Schema,
  issuedAt: ProviderRegistryIsoTimestampV1Schema,
} as const;

export const ProviderRegistryRootMetadataUnsignedClaimsV1Schema =
  z.discriminatedUnion("activation", [
    z.strictObject({
      ...providerRegistryRootUnsignedClaimsCommonShapeV1,
      activation: z.literal("bootstrap"),
      predecessor: ProviderRegistryRootGenesisPredecessorV1Schema,
    }),
    z.strictObject({
      ...providerRegistryRootUnsignedClaimsCommonShapeV1,
      activation: z.literal("planned_rollover"),
      predecessor: ProviderRegistryRootMetadataPredecessorV1Schema,
    }),
    z.strictObject({
      ...providerRegistryRootUnsignedClaimsCommonShapeV1,
      activation: z.literal("compromise_recovery"),
      predecessor: ProviderRegistryRootMetadataPredecessorV1Schema,
    }),
  ]);
export type ProviderRegistryRootMetadataUnsignedClaimsV1 = z.infer<
  typeof ProviderRegistryRootMetadataUnsignedClaimsV1Schema
>;

export const ProviderRegistryRootMetadataEnvelopeV1Schema = z.strictObject({
  schemaVersion: z.literal(1),
  recordType: z.literal("provider_registry_root_metadata"),
  rootGeneration: ProviderRegistryPositiveSafeIntegerV1Schema,
  rootKeyId: ProviderRegistryRootKeyIdV1Schema,
  contentDigest: ContentDigestV1Schema,
  payload: ProviderRegistryRootMetadataV1Schema,
});
export type ProviderRegistryRootMetadataEnvelopeV1 = z.infer<
  typeof ProviderRegistryRootMetadataEnvelopeV1Schema
>;

export const ProviderRegistryRootMetadataPinV1Schema = z.strictObject({
  locatorProfile: z.literal(
    "installation_provider_registry_root_metadata_v1",
  ),
  rootGeneration: ProviderRegistryPositiveSafeIntegerV1Schema,
  rootKeyId: ProviderRegistryRootKeyIdV1Schema,
  contentDigest: ContentDigestV1Schema,
});
export type ProviderRegistryRootMetadataPinV1 = z.infer<
  typeof ProviderRegistryRootMetadataPinV1Schema
>;

export const ProviderRegistryRootSelfSignatureWrapperV1Schema = z.strictObject({
  rootKeyId: ProviderRegistryRootKeyIdV1Schema,
  domain: z.literal(PROVIDER_REGISTRY_ROOT_SELF_SIGNATURE_DOMAIN_V1),
  claims: ProviderRegistryRootMetadataUnsignedClaimsV1Schema,
});
export type ProviderRegistryRootSelfSignatureWrapperV1 = z.infer<
  typeof ProviderRegistryRootSelfSignatureWrapperV1Schema
>;

function bytesToLowerHex(bytes: Uint8Array): string {
  let output = "";
  for (const byte of bytes) output += byte.toString(16).padStart(2, "0");
  return output;
}

function lowerHexToBytes(hex: string): Uint8Array {
  if (!/^(?:[0-9a-f]{2})+$/u.test(hex)) {
    throw new TypeError("signature must contain complete lowercase octets");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
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

function deriveShortKeyIdV1(
  domain: typeof PROVIDER_REGISTRY_ROOT_KEY_ID_DOMAIN_V1 | typeof PROVIDER_REGISTRY_RECOVERY_KEY_ID_DOMAIN_V1,
  fields: { readonly publicKeyBytes: CanonicalPublicKeyBytes32V1 },
): string {
  const preimage = canonicalizeJcsSafeIntegerUtf8V1([domain, fields]);
  return bytesToLowerHex(sha256InternalV1(preimage)).slice(0, 22);
}

export function deriveProviderRegistryRootKeyIdInternalV1(
  input: unknown,
): ProviderRegistryRootKeyIdV1 {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  const fields = ProviderRegistryRootKeyIdFieldsV1Schema.parse(input);
  return ProviderRegistryRootKeyIdV1Schema.parse(
    deriveShortKeyIdV1(PROVIDER_REGISTRY_ROOT_KEY_ID_DOMAIN_V1, fields),
  );
}

export function deriveProviderRegistryRecoveryKeyIdInternalV1(
  input: unknown,
): ProviderRegistryRecoveryKeyIdV1 {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  const fields = ProviderRegistryRecoveryKeyIdFieldsV1Schema.parse(input);
  return ProviderRegistryRecoveryKeyIdV1Schema.parse(
    deriveShortKeyIdV1(PROVIDER_REGISTRY_RECOVERY_KEY_ID_DOMAIN_V1, fields),
  );
}

export function deriveProviderEd25519PublicKeyDigestInternalV1(
  publicKeyBytes: unknown,
): Ed25519PublicKeyDigestV1 {
  const canonicalPublicKey =
    CanonicalPublicKeyBytes32V1Schema.parse(publicKeyBytes);
  const rawPublicKey = decodeCanonicalPublicKeyBytes32V1(canonicalPublicKey);
  return Ed25519PublicKeyDigestV1Schema.parse(
    `sha256:${bytesToLowerHex(sha256InternalV1(rawPublicKey))}`,
  );
}

export function validateProviderRegistryRootPublicKeyV1(
  input: unknown,
): ProviderRegistryRootPublicKeyV1 {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  const publicKey = ProviderRegistryRootPublicKeyV1Schema.parse(input);
  const expectedKeyId = deriveProviderRegistryRootKeyIdInternalV1({
    publicKeyBytes: publicKey.publicKeyBytes,
  });
  const expectedDigest = deriveProviderEd25519PublicKeyDigestInternalV1(
    publicKey.publicKeyBytes,
  );
  if (
    publicKey.rootKeyId !== expectedKeyId ||
    publicKey.publicKeyDigest !== expectedDigest
  ) {
    throw new TypeError("registry root public key material mismatch");
  }
  return publicKey;
}

export function validateProviderRegistryRecoveryPublicKeyV1(
  input: unknown,
): ProviderRegistryRecoveryPublicKeyV1 {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  const publicKey = ProviderRegistryRecoveryPublicKeyV1Schema.parse(input);
  const expectedKeyId = deriveProviderRegistryRecoveryKeyIdInternalV1({
    publicKeyBytes: publicKey.publicKeyBytes,
  });
  const expectedDigest = deriveProviderEd25519PublicKeyDigestInternalV1(
    publicKey.publicKeyBytes,
  );
  if (
    publicKey.recoveryKeyId !== expectedKeyId ||
    publicKey.publicKeyDigest !== expectedDigest
  ) {
    throw new TypeError("registry recovery public key material mismatch");
  }
  return publicKey;
}

export function projectProviderRegistryRootMetadataUnsignedClaimsV1(
  input: unknown,
): ProviderRegistryRootMetadataUnsignedClaimsV1 {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  const metadata = ProviderRegistryRootMetadataV1Schema.parse(input);
  return ProviderRegistryRootMetadataUnsignedClaimsV1Schema.parse({
    profile: metadata.profile,
    rootGeneration: metadata.rootGeneration,
    activeRoot: metadata.activeRoot,
    issuedAt: metadata.issuedAt,
    activation: metadata.activation,
    predecessor: metadata.predecessor,
  });
}

export function deriveProviderRegistryRootMetadataContentDigestV1(
  input: unknown,
): ContentDigestV1 {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  const metadata = ProviderRegistryRootMetadataV1Schema.parse(input);
  const preimage = canonicalizeJcsSafeIntegerUtf8V1([
    PROVIDER_REGISTRY_ROOT_METADATA_DOMAIN_V1,
    metadata,
  ]);
  return ContentDigestV1Schema.parse(
    `sha256:${bytesToLowerHex(sha256InternalV1(preimage))}`,
  );
}

interface ParsedRootSignatureV1<KeyId> {
  readonly keyId: KeyId;
  readonly signatureBytes: Uint8Array;
}

function parseRootSelfSignatureV1(
  input: unknown,
): ParsedRootSignatureV1<ProviderRegistryRootKeyIdV1> | undefined {
  const parsed = ProviderRegistryRootSelfSignatureV1Schema.safeParse(input);
  if (!parsed.success) return undefined;
  const match = PROVIDER_ROOT_SELF_SIGNATURE_PATTERN.exec(parsed.data);
  if (match === null || match[1] === undefined || match[2] === undefined) {
    return undefined;
  }
  return {
    keyId: ProviderRegistryRootKeyIdV1Schema.parse(match[1]),
    signatureBytes: lowerHexToBytes(match[2]),
  };
}

function signatureKeyId(
  signature: string,
  pattern: RegExp,
): string | undefined {
  return pattern.exec(signature)?.[1];
}

export function createProviderRegistryRootSelfSignatureMessageV1(
  input: unknown,
): Uint8Array {
  const claims = projectProviderRegistryRootMetadataUnsignedClaimsV1(input);
  const activeRoot = validateProviderRegistryRootPublicKeyV1(claims.activeRoot);
  const wrapper = ProviderRegistryRootSelfSignatureWrapperV1Schema.parse({
    rootKeyId: activeRoot.rootKeyId,
    domain: PROVIDER_REGISTRY_ROOT_SELF_SIGNATURE_DOMAIN_V1,
    claims,
  });
  return canonicalizeJcsSafeIntegerUtf8V1([
    PROVIDER_REGISTRY_ROOT_SELF_SIGNATURE_DOMAIN_V1,
    wrapper,
  ]);
}

/**
 * Closes wire fields and signature signer identifiers only. It deliberately
 * does not authorize a rollover or verify predecessor/recovery quorum.
 */
export function validateProviderRegistryRootMetadataEnvelopeStructureV1(
  input: unknown,
): ProviderRegistryRootMetadataEnvelopeV1 {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  const envelope = ProviderRegistryRootMetadataEnvelopeV1Schema.parse(input);
  const activeRoot = validateProviderRegistryRootPublicKeyV1(
    envelope.payload.activeRoot,
  );
  const selfSignature = parseRootSelfSignatureV1(
    envelope.payload.selfSignature,
  );
  if (
    envelope.rootGeneration !== envelope.payload.rootGeneration ||
    envelope.rootKeyId !== activeRoot.rootKeyId ||
    envelope.contentDigest !==
      deriveProviderRegistryRootMetadataContentDigestV1(envelope.payload) ||
    selfSignature === undefined ||
    selfSignature.keyId !== activeRoot.rootKeyId
  ) {
    throw new TypeError("registry root metadata envelope mismatch");
  }

  if (envelope.payload.activation === "planned_rollover") {
    const predecessorSigner = signatureKeyId(
      envelope.payload.predecessorCrossSignature,
      PROVIDER_ROOT_CROSS_SIGNATURE_PATTERN,
    );
    if (predecessorSigner !== envelope.payload.predecessor.rootKeyId) {
      throw new TypeError("registry root predecessor signature mismatch");
    }
  }

  if (envelope.payload.activation !== "bootstrap") {
    const recoverySignerIds = envelope.payload.recoverySignatures.map(
      (signature) =>
        signatureKeyId(signature, PROVIDER_ROOT_RECOVERY_SIGNATURE_PATTERN),
    );
    if (
      recoverySignerIds.some((keyId) => keyId === undefined) ||
      recoverySignerIds[0]! >= recoverySignerIds[1]!
    ) {
      throw new TypeError("registry root recovery signatures must be ordered");
    }
  }
  return envelope;
}

export async function verifyProviderRegistryRootSelfSignatureV1(
  input: unknown,
  capability: ProviderStrictEd25519OpaqueCapabilityV1,
): Promise<boolean> {
  let metadata: ProviderRegistryRootMetadataV1;
  try {
    assertDataObjectDescriptorsBeforeSchemaV1(input);
    assertJsonDataTreeBeforeSchemaV1(input);
    metadata = ProviderRegistryRootMetadataV1Schema.parse(input);
  } catch {
    return false;
  }

  let activeRoot: ProviderRegistryRootPublicKeyV1;
  try {
    activeRoot = validateProviderRegistryRootPublicKeyV1(metadata.activeRoot);
  } catch {
    return false;
  }
  const parsedSignature = parseRootSelfSignatureV1(metadata.selfSignature);
  if (
    parsedSignature === undefined ||
    parsedSignature.keyId !== activeRoot.rootKeyId
  ) {
    return false;
  }

  const rawPublicKey = decodeCanonicalPublicKeyBytes32V1(
    activeRoot.publicKeyBytes,
  );
  if (
    !(await validateProviderStrictEd25519PointWithCapabilityV1(
      capability,
      rawPublicKey,
    ))
  ) {
    return false;
  }
  const message = createProviderRegistryRootSelfSignatureMessageV1(metadata);
  return verifyRawEd25519WithCapabilityV1(
    capability,
    rawPublicKey,
    message,
    parsedSignature.signatureBytes,
  );
}

export async function verifyProviderRegistryBootstrapRootSelfSignatureV1(
  input: unknown,
  capability: ProviderStrictEd25519OpaqueCapabilityV1,
): Promise<boolean> {
  let envelope: ProviderRegistryRootMetadataEnvelopeV1;
  try {
    envelope = validateProviderRegistryRootMetadataEnvelopeStructureV1(input);
  } catch {
    return false;
  }
  if (
    envelope.payload.activation !== "bootstrap" ||
    envelope.payload.rootGeneration !== 1 ||
    envelope.rootGeneration !== 1
  ) {
    return false;
  }
  return verifyProviderRegistryRootSelfSignatureV1(
    envelope.payload,
    capability,
  );
}
