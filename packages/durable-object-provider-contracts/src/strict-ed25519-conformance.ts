import { z } from "./zod-runtime.js";

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
import {
  STRICT_ED25519_VERIFICATION_PROFILE_V1,
  validatePrimeSubgroupPoint as validatePrimeSubgroupPointReferenceV1,
  verifyRawEd25519 as verifyRawEd25519ReferenceV1,
} from "./strict-ed25519.js";
import {
  copyProviderStrictEd25519ByteRangeInternalV1,
  copyProviderStrictEd25519BytesInternalV1,
  copyProviderStrictEd25519CryptoCapabilityBytesV1,
  getProviderStrictEd25519OpaqueCapabilityMethodsV1,
  registerProviderStrictEd25519OpaqueCapabilityStateV1,
  type ProviderStrictEd25519BoundMethodsInternalV1,
} from "./strict-ed25519-capability-internal.js";
import { hardenProviderPointPromiseV1 } from "./provider-point-runtime-internal.js";

const CapturedArrayPrototypeMapV1 = Array.prototype.map;
const CapturedFunctionPrototypeHasInstanceV1 =
  Function.prototype[Symbol.hasInstance];
const CapturedNumberIsFiniteV1 = Number.isFinite;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedPerformanceV1 = performance;
const CapturedPerformanceNowV1 = performance.now;
const CapturedPromiseV1 = Promise;
const CapturedPromisePrototypeThenV1 = Promise.prototype.then;
const CapturedQueueMicrotaskV1 = queueMicrotask;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedUint8ArrayV1 = Uint8Array;
const CapturedTypedArrayPrototypeV1 = Object.getPrototypeOf(
  Uint8Array.prototype,
);
const CapturedTypedArrayByteLengthGetterV1 =
  Object.getOwnPropertyDescriptor(
    CapturedTypedArrayPrototypeV1,
    "byteLength",
  )?.get;
const CapturedValidatePrimeSubgroupPointReferenceV1 =
  CapturedObjectFreezeV1(validatePrimeSubgroupPointReferenceV1);
const CapturedVerifyRawEd25519ReferenceV1 = CapturedObjectFreezeV1(
  verifyRawEd25519ReferenceV1,
);

if (CapturedTypedArrayByteLengthGetterV1 === undefined) {
  throw new TypeError("Uint8Array byteLength primordial unavailable");
}

function arrayMapV1<T, U>(
  array: readonly T[],
  callback: (value: T, index: number, source: readonly T[]) => U,
): U[] {
  return CapturedReflectApplyV1(CapturedArrayPrototypeMapV1, array, [
    callback,
  ]) as U[];
}

function hardenPromiseV1<T>(promise: Promise<T>): Promise<T> {
  return hardenProviderPointPromiseV1(promise);
}

function monotonicNowV1(): number {
  const value = CapturedReflectApplyV1(
    CapturedPerformanceNowV1,
    CapturedPerformanceV1,
    [],
  ) as number;
  if (!CapturedNumberIsFiniteV1(value)) {
    throw new TypeError("monotonic clock unavailable");
  }
  return value;
}

function isCapturedPromiseV1(value: unknown): value is Promise<unknown> {
  return CapturedReflectApplyV1(
    CapturedFunctionPrototypeHasInstanceV1,
    CapturedPromiseV1,
    [value],
  ) as boolean;
}

function isCapturedUint8ArrayV1(value: unknown): value is Uint8Array {
  return CapturedReflectApplyV1(
    CapturedFunctionPrototypeHasInstanceV1,
    CapturedUint8ArrayV1,
    [value],
  ) as boolean;
}

function capturedUint8ArrayByteLengthV1(value: Uint8Array): number {
  return CapturedReflectApplyV1(
    CapturedTypedArrayByteLengthGetterV1!,
    value,
    [],
  ) as number;
}

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

const providerStrictEd25519CapabilityOwnerV1 =
  ProviderStrictEd25519AttestationError;

declare const providerStrictEd25519OpaqueCapabilityBrandV1: unique symbol;
export interface ProviderStrictEd25519OpaqueCapabilityV1 {
  readonly [providerStrictEd25519OpaqueCapabilityBrandV1]: true;
}

const BASE64URL_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function decodeCanonicalByteStringV1(value: string): Uint8Array {
  const body = value.slice("base64url:".length);
  const decoded = new CapturedUint8ArrayV1(decodedByteLength(value));
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
): ProviderStrictEd25519BoundMethodsInternalV1 {
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

  const frozenMethodTable = CapturedObjectFreezeV1({
    verificationProfile,
    validatePrimeSubgroupPoint,
    verifyRawEd25519,
  });
  return CapturedObjectFreezeV1({
    validatePrimeSubgroupPoint: (encodedPoint: Uint8Array) =>
      CapturedReflectApplyV1(validatePrimeSubgroupPoint, frozenMethodTable, [
        encodedPoint,
      ]) as ProviderStrictEd25519CryptoResultV1,
    verifyRawEd25519: (
      publicKey: Uint8Array,
      message: Uint8Array,
      signature: Uint8Array,
    ) =>
      CapturedReflectApplyV1(verifyRawEd25519, frozenMethodTable, [
        publicKey,
        message,
        signature,
      ]) as ProviderStrictEd25519CryptoResultV1,
  });
}

function invokeOperationWithHostTimeoutV1<T>(
  operation: () => T | Promise<T>,
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  let didSettle = false;
  const settled = new CapturedPromiseV1<T>((resolve, reject) => {
    let startedAt: number;
    try {
      startedAt = monotonicNowV1();
    } catch (error) {
      reject(error);
      return;
    }
    const clearHostTimerV1 = () => {
      if (timeoutHandle === undefined) return;
      // The timer provider is intentionally resolved from the captured realm
      // at call time so an embedding host (and deterministic fake-timer KATs)
      // can supply its clock. Timer replacement is outside the crypto
      // primordial-freeze contract; settlement methods remain captured.
      globalThis.clearTimeout(timeoutHandle);
      timeoutHandle = undefined;
    };
    const settleValueV1 = (value: T) => {
      if (didSettle) return;
      try {
        if (
          monotonicNowV1() - startedAt >=
          PROVIDER_STRICT_ED25519_HOST_OPERATION_TIMEOUT_MS_V1
        ) {
          settleErrorV1(new TypeError("host timeout"));
          return;
        }
      } catch (error) {
        settleErrorV1(error);
        return;
      }
      didSettle = true;
      clearHostTimerV1();
      resolve(value);
    };
    const settleErrorV1 = (error: unknown) => {
      if (didSettle) return;
      didSettle = true;
      clearHostTimerV1();
      reject(error);
    };
    const failIfDeadlineExpiredV1 = (): boolean => {
      if (didSettle) return true;
      try {
        if (
          monotonicNowV1() - startedAt <
          PROVIDER_STRICT_ED25519_HOST_OPERATION_TIMEOUT_MS_V1
        ) {
          return false;
        }
      } catch (error) {
        settleErrorV1(error);
        return true;
      }
      settleErrorV1(new TypeError("host timeout"));
      return true;
    };

    try {
      timeoutHandle = globalThis.setTimeout(
        () => settleErrorV1(new TypeError("host timeout")),
        PROVIDER_STRICT_ED25519_HOST_OPERATION_TIMEOUT_MS_V1,
      );
      CapturedReflectApplyV1(
        CapturedQueueMicrotaskV1,
        undefined,
        [() => {
          // Attach both settlement callbacks without creating a post-start
          // async/await Promise.  The rejection callback remains attached
          // after timeout, so a late host rejection is still consumed.
          try {
            if (failIfDeadlineExpiredV1()) return;
            const produced = CapturedReflectApplyV1(
              operation,
              undefined,
              [],
            ) as T | Promise<T>;
            if (
              produced === null ||
              (typeof produced !== "object" &&
                typeof produced !== "function")
            ) {
              settleValueV1(produced as T);
              return;
            }

            if (isCapturedPromiseV1(produced)) {
              // A native Promise is host-owned. Observe it through the
              // bootstrap-captured intrinsic without defining properties or
              // freezing it; frozen/non-extensible Promises remain valid host
              // results. The settled Promise created above is still hardened
              // before it crosses our public boundary.
              CapturedReflectApplyV1(
                CapturedPromisePrototypeThenV1,
                produced,
                [settleValueV1, settleErrorV1],
              );
              failIfDeadlineExpiredV1();
              return;
            }

            const then = (produced as { readonly then?: unknown }).then;
            if (typeof then !== "function") {
              settleValueV1(produced as T);
              return;
            }
            CapturedReflectApplyV1(then, produced, [
              settleValueV1,
              settleErrorV1,
            ]);
            failIfDeadlineExpiredV1();
          } catch (error) {
            settleErrorV1(error);
          }
        }],
      );
    } catch (error) {
      settleErrorV1(error);
    }
  });
  return hardenPromiseV1(settled);
}

function invokeBooleanMethod(
  method: (...args: Uint8Array[]) => ProviderStrictEd25519CryptoResultV1,
  inputs: readonly Uint8Array[],
): Promise<boolean> {
  const operation = (async () => {
    const callInputs = arrayMapV1(inputs, (value) =>
      copyProviderStrictEd25519BytesInternalV1(value),
    );
    const snapshots = arrayMapV1(callInputs, (value) =>
      copyProviderStrictEd25519BytesInternalV1(value),
    );
    const result = await invokeOperationWithHostTimeoutV1(() =>
      CapturedReflectApplyV1(method, undefined, callInputs) as
        ProviderStrictEd25519CryptoResultV1,
    );
    for (let index = 0; index < callInputs.length; index += 1) {
      if (!bytesEqual(callInputs[index]!, snapshots[index]!)) {
        throw new TypeError("host input mutation");
      }
    }
    if (typeof result !== "boolean") throw new TypeError("host result");
    return result;
  })();
  return hardenPromiseV1(operation);
}

function invokeHostBooleanMethodAgainstReferenceV1(
  hostMethod: (
    ...args: Uint8Array[]
  ) => ProviderStrictEd25519CryptoResultV1,
  referenceMethod: (...args: Uint8Array[]) => boolean,
  inputs: readonly Uint8Array[],
): Promise<boolean> {
  const operation = (async () => {
    // Snapshot once before the first await.  The reference and the host then
    // receive independent arrays carrying the exact same bytes, so an
    // untrusted host cannot mutate the reference monitor's input.
    const referenceInputs = arrayMapV1(inputs, (value) =>
      copyProviderStrictEd25519BytesInternalV1(value),
    );
    const hostInputs = arrayMapV1(referenceInputs, (value) =>
      copyProviderStrictEd25519BytesInternalV1(value),
    );
    const referenceResult = CapturedReflectApplyV1(
      referenceMethod,
      undefined,
      referenceInputs,
    ) as boolean;
    if (typeof referenceResult !== "boolean") {
      throw new TypeError("strict reference result");
    }

    const hostResult = await invokeOperationWithHostTimeoutV1(() =>
      CapturedReflectApplyV1(hostMethod, undefined, hostInputs) as
        ProviderStrictEd25519CryptoResultV1,
    );
    for (let index = 0; index < hostInputs.length; index += 1) {
      if (!bytesEqual(hostInputs[index]!, referenceInputs[index]!)) {
        throw new TypeError("host input mutation");
      }
    }
    if (typeof hostResult !== "boolean") {
      throw new TypeError("host result");
    }
    if (hostResult !== referenceResult) {
      throw new TypeError("host/reference divergence");
    }
    return hostResult;
  })();
  return hardenPromiseV1(operation);
}

function bindStrictReferenceMonitorV1(
  hostMethods: ProviderStrictEd25519BoundMethodsInternalV1,
): ProviderStrictEd25519BoundMethodsInternalV1 {
  const monitoredValidatePrimeSubgroupPoint = CapturedObjectFreezeV1(
    (encodedPoint: Uint8Array) =>
      invokeHostBooleanMethodAgainstReferenceV1(
        hostMethods.validatePrimeSubgroupPoint,
        CapturedValidatePrimeSubgroupPointReferenceV1,
        [encodedPoint],
      ),
  );
  const monitoredVerifyRawEd25519 = CapturedObjectFreezeV1(
    (
      publicKey: Uint8Array,
      message: Uint8Array,
      signature: Uint8Array,
    ) =>
      invokeHostBooleanMethodAgainstReferenceV1(
        hostMethods.verifyRawEd25519,
        CapturedVerifyRawEd25519ReferenceV1,
        [publicKey, message, signature],
      ),
  );
  return CapturedObjectFreezeV1({
    validatePrimeSubgroupPoint: monitoredValidatePrimeSubgroupPoint,
    verifyRawEd25519: monitoredVerifyRawEd25519,
  });
}

async function parseAndVerifyManifestResource(
  resourceBytes: Uint8Array,
): Promise<ProviderStrictEd25519AdversarialManifestEnvelopeV1> {
  if (
    !isCapturedUint8ArrayV1(resourceBytes) ||
    capturedUint8ArrayByteLengthV1(resourceBytes) >
      PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1
  ) {
    throw new TypeError("manifest resource");
  }
  const parsedUnknown = parseCanonicalJcsSafeIntegerUtf8V1(
    copyProviderStrictEd25519BytesInternalV1(resourceBytes),
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

function loadFixedManifestResource(
  resourceHost: ProviderStrictEd25519FixedResourceHostV1,
): Promise<Uint8Array> {
  const operation = (async () => {
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
    const frozenResourceHost = CapturedObjectFreezeV1({
      readFixedSignedPackageResource,
    });
    const resourceBytes = await invokeOperationWithHostTimeoutV1(() =>
      CapturedReflectApplyV1(
          readFixedSignedPackageResource,
          frozenResourceHost,
          [
            PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
            PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1,
          ],
        ) as ProviderStrictEd25519FixedResourceResultV1,
    );
    if (!isCapturedUint8ArrayV1(resourceBytes)) {
      throw new TypeError("manifest resource");
    }
    return resourceBytes;
  })();
  return hardenPromiseV1(operation);
}

async function runExactHostKat(
  methods: ProviderStrictEd25519BoundMethodsInternalV1,
  manifest: ProviderStrictEd25519AdversarialManifestV1,
): Promise<void> {
  for (const vector of manifest.cases) {
    const publicKey = decodeCanonicalByteStringV1(vector.publicKeyBytes);
    const message = decodeCanonicalByteStringV1(vector.messageBytes);
    const signature = decodeCanonicalByteStringV1(vector.signatureBytes);
    const encodedR = copyProviderStrictEd25519ByteRangeInternalV1(
      signature,
      0,
      32,
    );

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

function requireOpaqueMethods(
  capability: ProviderStrictEd25519OpaqueCapabilityV1,
): ProviderStrictEd25519BoundMethodsInternalV1 {
  try {
    return getProviderStrictEd25519OpaqueCapabilityMethodsV1(
      providerStrictEd25519CapabilityOwnerV1,
      capability,
    );
  } catch {
    throw new ProviderStrictEd25519AttestationError();
  }
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
  const monitoredMethods = bindStrictReferenceMonitorV1(methods);

  const opaqueHandle = CapturedObjectFreezeV1(
    {},
  ) as ProviderStrictEd25519OpaqueCapabilityV1;
  registerProviderStrictEd25519OpaqueCapabilityStateV1(
    providerStrictEd25519CapabilityOwnerV1,
    opaqueHandle,
    monitoredMethods,
    canonicalizeJcsSafeIntegerUtf8V1(
      PROVIDER_STRICT_ED25519_CRYPTO_CAPABILITY_V1,
    ),
  );
  return opaqueHandle;
}

export function attestProviderStrictEd25519CryptoHostV1(
  input: AttestProviderStrictEd25519CryptoHostV1Input,
): Promise<ProviderStrictEd25519OpaqueCapabilityV1> {
  const operation = (async () => {
    try {
      return await invokeOperationWithHostTimeoutV1(() =>
        attestProviderStrictEd25519CryptoHostInternalV1(input),
      );
    } catch {
      throw new ProviderStrictEd25519AttestationError();
    }
  })();
  return hardenPromiseV1(operation);
}

export function getProviderStrictEd25519CryptoCapabilityBytesV1(
  capability: ProviderStrictEd25519OpaqueCapabilityV1,
): Uint8Array {
  try {
    return copyProviderStrictEd25519CryptoCapabilityBytesV1(
      providerStrictEd25519CapabilityOwnerV1,
      capability,
    );
  } catch {
    throw new ProviderStrictEd25519AttestationError();
  }
}

export function validateProviderStrictEd25519PointWithCapabilityV1(
  capability: ProviderStrictEd25519OpaqueCapabilityV1,
  encodedPoint: Uint8Array,
): Promise<boolean> {
  const operation = (async () => {
    const methods = requireOpaqueMethods(capability);
    if (
      !isCapturedUint8ArrayV1(encodedPoint) ||
      capturedUint8ArrayByteLengthV1(encodedPoint) !== 32
    ) {
      return false;
    }
    try {
      return await invokeBooleanMethod(
        methods.validatePrimeSubgroupPoint,
        [encodedPoint],
      );
    } catch {
      throw new ProviderStrictEd25519AttestationError();
    }
  })();
  return hardenPromiseV1(operation);
}

export function verifyRawEd25519WithCapabilityV1(
  capability: ProviderStrictEd25519OpaqueCapabilityV1,
  publicKey: Uint8Array,
  message: Uint8Array,
  signature: Uint8Array,
): Promise<boolean> {
  const operation = (async () => {
    const methods = requireOpaqueMethods(capability);
    if (
      !isCapturedUint8ArrayV1(publicKey) ||
      !isCapturedUint8ArrayV1(message) ||
      !isCapturedUint8ArrayV1(signature) ||
      capturedUint8ArrayByteLengthV1(publicKey) !== 32 ||
      capturedUint8ArrayByteLengthV1(signature) !== 64
    ) {
      return false;
    }
    try {
      return await invokeBooleanMethod(methods.verifyRawEd25519, [
        publicKey,
        message,
        signature,
      ]);
    } catch {
      throw new ProviderStrictEd25519AttestationError();
    }
  })();
  return hardenPromiseV1(operation);
}
