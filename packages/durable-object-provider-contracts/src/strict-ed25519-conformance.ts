import { z } from "zod";

import { assertDataObjectDescriptorsBeforeSchemaV1 } from "./domain-crypto.js";
import {
  canonicalizeJcsSafeIntegerUtf8V1,
  parseCanonicalJcsSafeIntegerUtf8V1,
} from "./jcs.js";
import {
  CanonicalByteStringV1Schema,
  ContentDigestV1Schema,
} from "./primitives.js";
import { sha256InternalV1 } from "./sha256.js";
import { STRICT_ED25519_VERIFICATION_PROFILE_V1 } from "./strict-ed25519.js";

export const PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1 =
  "provider/ed25519-strict-host-conformance-v1.json" as const;
export const PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1 = 4_194_304;
export const PROVIDER_STRICT_ED25519_HOST_OPERATION_TIMEOUT_MS_V1 = 30_000;
export const PROVIDER_STRICT_ED25519_ADVERSARIAL_MANIFEST_DOMAIN_V1 =
  "provider-strict-ed25519-adversarial-manifest-v1" as const;

export const PROVIDER_STRICT_ED25519_REQUIRED_CASE_IDS_V1 = Object.freeze([
  "caller-prehash-substitution",
  "ed25519ctx-substitution",
  "ed25519ph-substitution",
  "equation-message-bitflip",
  "identity-universal-forgery",
  "provider-wrapper-valid",
  "public-key-31-bytes",
  "public-key-33-bytes",
  "public-key-identity",
  "public-key-mixed-order",
  "public-key-negative-zero",
  "public-key-nonsquare",
  "public-key-small-order",
  "public-key-y-equals-p",
  "r-identity",
  "r-mixed-order",
  "r-noncanonical",
  "r-small-order",
  "rfc8032-empty-valid",
  "rfc8032-one-byte-valid",
  "rfc8032-test-1024-valid",
  "rfc8032-two-byte-valid",
  "s-equals-l",
  "s-l-plus-one",
  "s-max",
  "s-plus-l-malleability",
  "signature-63-bytes",
  "signature-65-bytes",
] as const);

export const PROVIDER_STRICT_ED25519_CASE_CATEGORIES_V1 = Object.freeze([
  "rfc8032_valid",
  "provider_wrapper_valid",
  "public_key_length",
  "signature_length",
  "public_key_noncanonical",
  "public_key_identity_or_small_order",
  "public_key_mixed_order",
  "r_noncanonical",
  "r_identity_or_small_order",
  "r_mixed_order",
  "s_out_of_range",
  "equation_mismatch",
  "context_or_prehash_substitution",
] as const);

export const ProviderEd25519VerificationProfileV1Schema = z.literal(
  STRICT_ED25519_VERIFICATION_PROFILE_V1,
);
export type ProviderEd25519VerificationProfileV1 = z.infer<
  typeof ProviderEd25519VerificationProfileV1Schema
>;

const ProviderStrictEd25519ExpectedResultV1Schema = z.enum([
  "accept",
  "reject",
]);

const ProviderStrictEd25519SignatureBytesV1Schema = z
  .string()
  .regex(
    /^base64url:(?=[A-Za-z0-9_-]{43,}$)(?:[A-Za-z0-9_-]{4})*(?:[A-Za-z0-9_-][AQgw]|[A-Za-z0-9_-]{2}[AEIMQUYcgkosw048])?$/u,
  )
  .brand<"CanonicalByteStringV1">();

function decodedByteLength(value: string): number {
  const bodyLength = value.length - "base64url:".length;
  return Math.floor((bodyLength * 6) / 8);
}

export const ProviderStrictEd25519AdversarialCaseV1Schema = z.strictObject({
  caseId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
  category: z.enum(PROVIDER_STRICT_ED25519_CASE_CATEGORIES_V1),
  publicKeyBytes: CanonicalByteStringV1Schema,
  messageBytes: CanonicalByteStringV1Schema,
  signatureBytes: ProviderStrictEd25519SignatureBytesV1Schema,
  expectedPublicKeyPointAdmission:
    ProviderStrictEd25519ExpectedResultV1Schema,
  expectedSignatureRPointAdmission:
    ProviderStrictEd25519ExpectedResultV1Schema,
  expectedResult: ProviderStrictEd25519ExpectedResultV1Schema,
});
export type ProviderStrictEd25519AdversarialCaseV1 = z.infer<
  typeof ProviderStrictEd25519AdversarialCaseV1Schema
>;

export const ProviderStrictEd25519AdversarialManifestV1Schema = z.strictObject({
  profile: z.literal("provider_strict_ed25519_adversarial_manifest_v1"),
  manifestVersion: z.literal(1),
  verificationProfile: ProviderEd25519VerificationProfileV1Schema,
  cases: z
    .array(ProviderStrictEd25519AdversarialCaseV1Schema)
    .length(PROVIDER_STRICT_ED25519_REQUIRED_CASE_IDS_V1.length),
});
export type ProviderStrictEd25519AdversarialManifestV1 = z.infer<
  typeof ProviderStrictEd25519AdversarialManifestV1Schema
>;

export const ProviderStrictEd25519AdversarialManifestEnvelopeV1Schema =
  z.strictObject({
    schemaVersion: z.literal(1),
    recordType: z.literal(
      "provider_strict_ed25519_adversarial_manifest",
    ),
    manifestVersion: z.literal(1),
    contentDigest: ContentDigestV1Schema,
    payload: ProviderStrictEd25519AdversarialManifestV1Schema,
  });
export type ProviderStrictEd25519AdversarialManifestEnvelopeV1 = z.infer<
  typeof ProviderStrictEd25519AdversarialManifestEnvelopeV1Schema
>;

export const ProviderStrictEd25519AdversarialManifestPinV1Schema =
  z.strictObject({
    locatorProfile: z.literal(
      "distribution_provider_strict_ed25519_adversarial_manifest_v1",
    ),
    manifestVersion: z.literal(1),
    contentDigest: ContentDigestV1Schema,
  });
export type ProviderStrictEd25519AdversarialManifestPinV1 = z.infer<
  typeof ProviderStrictEd25519AdversarialManifestPinV1Schema
>;

export const ProviderStrictEd25519CryptoCapabilityV1Schema = z.strictObject({
  profile: z.literal("provider_strict_ed25519_crypto_capability_v1"),
  verificationProfile: ProviderEd25519VerificationProfileV1Schema,
  adversarialManifest:
    ProviderStrictEd25519AdversarialManifestPinV1Schema,
});
export type ProviderStrictEd25519CryptoCapabilityV1 = z.infer<
  typeof ProviderStrictEd25519CryptoCapabilityV1Schema
>;

export const PROVIDER_STRICT_ED25519_ADVERSARIAL_MANIFEST_CONTENT_DIGEST_V1 =
  ContentDigestV1Schema.parse(
    "sha256:6c65e40a20d82c557ba6485008bce62a903d81ff15cc859fab589d203904f1d9",
  );

function deepFreezeJson<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) deepFreezeJson(child);
    Object.freeze(value);
  }
  return value;
}

export const PROVIDER_STRICT_ED25519_ADVERSARIAL_MANIFEST_PIN_V1 =
  deepFreezeJson(
    ProviderStrictEd25519AdversarialManifestPinV1Schema.parse({
      locatorProfile:
        "distribution_provider_strict_ed25519_adversarial_manifest_v1",
      manifestVersion: 1,
      contentDigest:
        PROVIDER_STRICT_ED25519_ADVERSARIAL_MANIFEST_CONTENT_DIGEST_V1,
    }),
  );

export const PROVIDER_STRICT_ED25519_CRYPTO_CAPABILITY_V1 = deepFreezeJson(
  ProviderStrictEd25519CryptoCapabilityV1Schema.parse({
    profile: "provider_strict_ed25519_crypto_capability_v1",
    verificationProfile: STRICT_ED25519_VERIFICATION_PROFILE_V1,
    adversarialManifest:
      PROVIDER_STRICT_ED25519_ADVERSARIAL_MANIFEST_PIN_V1,
  }),
);

export type ProviderStrictEd25519CryptoResultV1 =
  | boolean
  | Promise<boolean>;

export interface ProviderStrictEd25519CryptoHostV1 {
  readonly verificationProfile: ProviderEd25519VerificationProfileV1;
  validatePrimeSubgroupPoint(
    encodedPoint: Uint8Array,
  ): ProviderStrictEd25519CryptoResultV1;
  verifyRawEd25519(
    publicKey: Uint8Array,
    message: Uint8Array,
    signature: Uint8Array,
  ): ProviderStrictEd25519CryptoResultV1;
}

export type ProviderStrictEd25519FixedResourceResultV1 =
  | Uint8Array
  | Promise<Uint8Array>;

/**
 * Portable signed-package resolver boundary. The attestor, never its caller,
 * selects the single fixed resource path and immutable pre-materialization cap.
 */
export interface ProviderStrictEd25519FixedResourceHostV1 {
  readFixedSignedPackageResource(
    resourcePath: typeof PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
    maxBytes: typeof PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1,
  ): ProviderStrictEd25519FixedResourceResultV1;
}

export interface AttestProviderStrictEd25519CryptoHostV1Input {
  readonly host: ProviderStrictEd25519CryptoHostV1;
  readonly resourceHost: ProviderStrictEd25519FixedResourceHostV1;
}

export class ProviderStrictEd25519AttestationError extends Error {
  readonly code = "provider_unavailable" as const;
  readonly reason = "attestation_invalid" as const;

  constructor() {
    super("Strict Ed25519 host attestation failed");
    this.name = "ProviderStrictEd25519AttestationError";
  }
}

declare const providerStrictEd25519OpaqueCapabilityBrandV1: unique symbol;
export interface ProviderStrictEd25519OpaqueCapabilityV1 {
  readonly [providerStrictEd25519OpaqueCapabilityBrandV1]: true;
}

interface BoundStrictEd25519MethodsV1 {
  readonly validatePrimeSubgroupPoint: (
    encodedPoint: Uint8Array,
  ) => ProviderStrictEd25519CryptoResultV1;
  readonly verifyRawEd25519: (
    publicKey: Uint8Array,
    message: Uint8Array,
    signature: Uint8Array,
  ) => ProviderStrictEd25519CryptoResultV1;
}

interface OpaqueCapabilityStateV1 {
  readonly methods: BoundStrictEd25519MethodsV1;
  readonly capabilityBytes: Uint8Array;
}

const opaqueCapabilityStatesV1 = new WeakMap<
  object,
  OpaqueCapabilityStateV1
>();

const BASE64URL_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function decodeCanonicalByteStringV1(value: string): Uint8Array {
  const body = value.slice("base64url:".length);
  const decoded = new Uint8Array(decodedByteLength(value));
  let accumulator = 0;
  let availableBits = 0;
  let outputOffset = 0;

  for (const character of body) {
    const digit = BASE64URL_ALPHABET.indexOf(character);
    if (digit < 0) throw new TypeError("invalid canonical byte string");
    accumulator = (accumulator << 6) | digit;
    availableBits += 6;
    if (availableBits >= 8) {
      availableBits -= 8;
      decoded[outputOffset] = (accumulator >>> availableBits) & 0xff;
      outputOffset += 1;
      accumulator &= (1 << availableBits) - 1;
    }
  }

  if (outputOffset !== decoded.byteLength || accumulator !== 0) {
    throw new TypeError("invalid canonical byte string");
  }
  return decoded;
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= left[index]! ^ right[index]!;
  }
  return difference === 0;
}

function bytesToLowerHex(bytes: Uint8Array): string {
  let output = "";
  for (const byte of bytes) output += byte.toString(16).padStart(2, "0");
  return output;
}

function expectedBoolean(value: "accept" | "reject"): boolean {
  return value === "accept";
}

function assertExactRequiredCases(
  manifest: ProviderStrictEd25519AdversarialManifestV1,
): void {
  for (
    let index = 0;
    index < PROVIDER_STRICT_ED25519_REQUIRED_CASE_IDS_V1.length;
    index += 1
  ) {
    const currentCase = manifest.cases[index];
    const requiredCaseId =
      PROVIDER_STRICT_ED25519_REQUIRED_CASE_IDS_V1[index]!;
    if (currentCase === undefined || currentCase.caseId !== requiredCaseId) {
      throw new TypeError("case set");
    }

    const shouldAccept =
      requiredCaseId === "provider-wrapper-valid" ||
      requiredCaseId.startsWith("rfc8032-");
    if (expectedBoolean(currentCase.expectedResult) !== shouldAccept) {
      throw new TypeError("case result set");
    }
  }
}

function captureBoundMethods(
  host: ProviderStrictEd25519CryptoHostV1,
): BoundStrictEd25519MethodsV1 {
  assertDataObjectDescriptorsBeforeSchemaV1(host);
  const descriptors = Object.getOwnPropertyDescriptors(host);
  const hostKeys = Object.keys(descriptors).sort();
  if (
    hostKeys.length !== 3 ||
    hostKeys[0] !== "validatePrimeSubgroupPoint" ||
    hostKeys[1] !== "verificationProfile" ||
    hostKeys[2] !== "verifyRawEd25519"
  ) {
    throw new TypeError("host profile");
  }
  const verificationProfile = descriptors.verificationProfile?.value;
  const validatePrimeSubgroupPoint =
    descriptors.validatePrimeSubgroupPoint?.value;
  const verifyRawEd25519 = descriptors.verifyRawEd25519?.value;
  if (
    verificationProfile !== STRICT_ED25519_VERIFICATION_PROFILE_V1 ||
    typeof validatePrimeSubgroupPoint !== "function" ||
    typeof verifyRawEd25519 !== "function"
  ) {
    throw new TypeError("host methods");
  }

  const frozenMethodTable = Object.freeze({
    verificationProfile,
    validatePrimeSubgroupPoint,
    verifyRawEd25519,
  });
  return Object.freeze({
    validatePrimeSubgroupPoint: (encodedPoint: Uint8Array) =>
      Reflect.apply(validatePrimeSubgroupPoint, frozenMethodTable, [
        encodedPoint,
      ]) as ProviderStrictEd25519CryptoResultV1,
    verifyRawEd25519: (
      publicKey: Uint8Array,
      message: Uint8Array,
      signature: Uint8Array,
    ) =>
      Reflect.apply(verifyRawEd25519, frozenMethodTable, [
        publicKey,
        message,
        signature,
      ]) as ProviderStrictEd25519CryptoResultV1,
  });
}

async function withHostTimeout<T>(operation: Promise<T>): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new TypeError("host timeout")),
      PROVIDER_STRICT_ED25519_HOST_OPERATION_TIMEOUT_MS_V1,
    );
  });
  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
  }
}

async function invokeBooleanMethod(
  method: (...args: Uint8Array[]) => ProviderStrictEd25519CryptoResultV1,
  inputs: readonly Uint8Array[],
): Promise<boolean> {
  const callInputs = inputs.map((value) => value.slice());
  const snapshots = callInputs.map((value) => value.slice());
  const result = await withHostTimeout(
    Promise.resolve().then(() => method(...callInputs)),
  );
  for (let index = 0; index < callInputs.length; index += 1) {
    if (!bytesEqual(callInputs[index]!, snapshots[index]!)) {
      throw new TypeError("host input mutation");
    }
  }
  if (typeof result !== "boolean") throw new TypeError("host result");
  return result;
}

async function parseAndVerifyManifestResource(
  resourceBytes: Uint8Array,
): Promise<ProviderStrictEd25519AdversarialManifestEnvelopeV1> {
  if (
    !(resourceBytes instanceof Uint8Array) ||
    resourceBytes.byteLength > PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1
  ) {
    throw new TypeError("manifest resource");
  }
  const parsedUnknown = parseCanonicalJcsSafeIntegerUtf8V1(
    resourceBytes.slice(),
  );
  assertDataObjectDescriptorsBeforeSchemaV1(parsedUnknown);
  const envelope =
    ProviderStrictEd25519AdversarialManifestEnvelopeV1Schema.parse(
      parsedUnknown,
    );
  if (envelope.manifestVersion !== envelope.payload.manifestVersion) {
    throw new TypeError("manifest version");
  }
  assertExactRequiredCases(envelope.payload);

  const digestPreimage = canonicalizeJcsSafeIntegerUtf8V1([
    PROVIDER_STRICT_ED25519_ADVERSARIAL_MANIFEST_DOMAIN_V1,
    envelope.payload,
  ]);
  const derivedContentDigest = ContentDigestV1Schema.parse(
    `sha256:${bytesToLowerHex(sha256InternalV1(digestPreimage))}`,
  );
  if (
    envelope.contentDigest !==
      PROVIDER_STRICT_ED25519_ADVERSARIAL_MANIFEST_CONTENT_DIGEST_V1 ||
    derivedContentDigest !==
      PROVIDER_STRICT_ED25519_ADVERSARIAL_MANIFEST_CONTENT_DIGEST_V1
  ) {
    throw new TypeError("manifest digest");
  }
  return envelope;
}

async function loadFixedManifestResource(
  resourceHost: ProviderStrictEd25519FixedResourceHostV1,
): Promise<Uint8Array> {
  assertDataObjectDescriptorsBeforeSchemaV1(resourceHost);
  const descriptors = Object.getOwnPropertyDescriptors(resourceHost);
  const resourceHostKeys = Object.keys(descriptors);
  if (
    resourceHostKeys.length !== 1 ||
    resourceHostKeys[0] !== "readFixedSignedPackageResource"
  ) {
    throw new TypeError("resource host");
  }
  const readFixedSignedPackageResource =
    descriptors.readFixedSignedPackageResource?.value;
  if (typeof readFixedSignedPackageResource !== "function") {
    throw new TypeError("resource host");
  }
  const frozenResourceHost = Object.freeze({
    readFixedSignedPackageResource,
  });
  const resourceBytes = await withHostTimeout(
    Promise.resolve().then(
      () =>
        Reflect.apply(
          readFixedSignedPackageResource,
          frozenResourceHost,
          [
            PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
            PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1,
          ],
        ) as ProviderStrictEd25519FixedResourceResultV1,
    ),
  );
  if (!(resourceBytes instanceof Uint8Array)) {
    throw new TypeError("manifest resource");
  }
  return resourceBytes;
}

async function runExactHostKat(
  methods: BoundStrictEd25519MethodsV1,
  manifest: ProviderStrictEd25519AdversarialManifestV1,
): Promise<void> {
  for (const vector of manifest.cases) {
    const publicKey = decodeCanonicalByteStringV1(vector.publicKeyBytes);
    const message = decodeCanonicalByteStringV1(vector.messageBytes);
    const signature = decodeCanonicalByteStringV1(vector.signatureBytes);
    const encodedR = signature.slice(0, 32);

    const publicKeyAdmission = await invokeBooleanMethod(
      methods.validatePrimeSubgroupPoint,
      [publicKey],
    );
    if (
      publicKeyAdmission !==
      expectedBoolean(vector.expectedPublicKeyPointAdmission)
    ) {
      throw new TypeError("point admission mismatch");
    }

    const signatureRAdmission = await invokeBooleanMethod(
      methods.validatePrimeSubgroupPoint,
      [encodedR],
    );
    if (
      signatureRAdmission !==
      expectedBoolean(vector.expectedSignatureRPointAdmission)
    ) {
      throw new TypeError("point admission mismatch");
    }

    const verification = await invokeBooleanMethod(
      methods.verifyRawEd25519,
      [publicKey, message, signature],
    );
    if (verification !== expectedBoolean(vector.expectedResult)) {
      throw new TypeError("signature verification mismatch");
    }
  }
}

function requireOpaqueState(
  capability: ProviderStrictEd25519OpaqueCapabilityV1,
): OpaqueCapabilityStateV1 {
  if (
    capability === null ||
    typeof capability !== "object" ||
    !opaqueCapabilityStatesV1.has(capability)
  ) {
    throw new ProviderStrictEd25519AttestationError();
  }
  return opaqueCapabilityStatesV1.get(capability)!;
}

async function attestProviderStrictEd25519CryptoHostInternalV1(
  input: AttestProviderStrictEd25519CryptoHostV1Input,
): Promise<ProviderStrictEd25519OpaqueCapabilityV1> {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  const inputDescriptors = Object.getOwnPropertyDescriptors(input);
  const inputKeys = Object.keys(inputDescriptors).sort();
  if (
    inputKeys.length !== 2 ||
    inputKeys[0] !== "host" ||
    inputKeys[1] !== "resourceHost"
  ) {
    throw new TypeError("attestation input");
  }
  const host = inputDescriptors.host?.value as
    | ProviderStrictEd25519CryptoHostV1
    | undefined;
  const resourceHost = inputDescriptors.resourceHost?.value as
    | ProviderStrictEd25519FixedResourceHostV1
    | undefined;
  if (host === undefined || resourceHost === undefined) {
    throw new TypeError("attestation input");
  }
  const manifestResourceBytes = await loadFixedManifestResource(
    resourceHost,
  );
  const envelope =
    await parseAndVerifyManifestResource(manifestResourceBytes);
  const methods = captureBoundMethods(host);
  await runExactHostKat(methods, envelope.payload);

  const opaqueHandle = Object.freeze(
    {},
  ) as ProviderStrictEd25519OpaqueCapabilityV1;
  opaqueCapabilityStatesV1.set(opaqueHandle, {
    methods,
    capabilityBytes: canonicalizeJcsSafeIntegerUtf8V1(
      PROVIDER_STRICT_ED25519_CRYPTO_CAPABILITY_V1,
    ),
  });
  return opaqueHandle;
}

export async function attestProviderStrictEd25519CryptoHostV1(
  input: AttestProviderStrictEd25519CryptoHostV1Input,
): Promise<ProviderStrictEd25519OpaqueCapabilityV1> {
  try {
    return await withHostTimeout(
      attestProviderStrictEd25519CryptoHostInternalV1(input),
    );
  } catch {
    throw new ProviderStrictEd25519AttestationError();
  }
}

export function getProviderStrictEd25519CryptoCapabilityBytesV1(
  capability: ProviderStrictEd25519OpaqueCapabilityV1,
): Uint8Array {
  return requireOpaqueState(capability).capabilityBytes.slice();
}

export async function validateProviderStrictEd25519PointWithCapabilityV1(
  capability: ProviderStrictEd25519OpaqueCapabilityV1,
  encodedPoint: Uint8Array,
): Promise<boolean> {
  const state = requireOpaqueState(capability);
  if (!(encodedPoint instanceof Uint8Array) || encodedPoint.byteLength !== 32) {
    return false;
  }
  try {
    return await invokeBooleanMethod(
      state.methods.validatePrimeSubgroupPoint,
      [encodedPoint],
    );
  } catch {
    throw new ProviderStrictEd25519AttestationError();
  }
}

export async function verifyRawEd25519WithCapabilityV1(
  capability: ProviderStrictEd25519OpaqueCapabilityV1,
  publicKey: Uint8Array,
  message: Uint8Array,
  signature: Uint8Array,
): Promise<boolean> {
  const state = requireOpaqueState(capability);
  if (
    !(publicKey instanceof Uint8Array) ||
    !(message instanceof Uint8Array) ||
    !(signature instanceof Uint8Array) ||
    publicKey.byteLength !== 32 ||
    signature.byteLength !== 64
  ) {
    return false;
  }
  try {
    return await invokeBooleanMethod(state.methods.verifyRawEd25519, [
      publicKey,
      message,
      signature,
    ]);
  } catch {
    throw new ProviderStrictEd25519AttestationError();
  }
}
