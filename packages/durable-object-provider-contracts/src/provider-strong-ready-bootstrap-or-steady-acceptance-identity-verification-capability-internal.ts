/**
 * Package-private D-40 Installation Identity verification authority.
 *
 * This is only a none-authority reference-candidate seam. A successfully
 * minted handle proves that the supplied test tuple was internally
 * self-consistent at mint time. It does not prove persisted Installation
 * Identity state, OS-isolated key custody, crash durability, or provider I/O
 * authority. The raw key and captured crypto host never leave this module's
 * private WeakMap.
 */

import type { ProviderCryptoHostV1 } from "./domain-crypto.js";
import {
  InstallationIdentityGenerationIdV1Schema,
  KeyedStateTokenV1Schema,
  LowerHex32V1Schema,
  type InstallationIdentityGenerationIdV1,
  type KeyedStateTokenV1,
  type LowerHex32V1,
} from "./primitives.js";
import {
  INSTALLATION_IDENTITY_GENERATION_DOMAIN_V1,
  INSTALLATION_IDENTITY_KEY_CHECK_DOMAIN_V1,
} from "./provider-foundation.js";
import {
  PROVIDER_STRONG_READY_BOOTSTRAP_OR_STEADY_ACCEPTANCE_COMPARE_APPEND_RECEIPT_TOKEN_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_STRONG_READY_BOOTSTRAP_OR_STEADY_ACCEPTANCE_CURRENT_VERSION_TOKEN_REFERENCE_CANDIDATE_DOMAIN_V1,
  projectProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptUnsignedReferenceCandidateV1,
  projectProviderStrongReadyBootstrapOrSteadyAcceptanceCurrentVersionTokenFieldsReferenceCandidateV1,
} from "./provider-strong-ready-bootstrap-or-steady-acceptance-compare-append-reference-candidate-wire.js";
import {
  captureProviderPointDetachedExactDataObjectV1,
} from "./provider-point-raw-admission-internal.js";
import {
  createProviderPointFulfilledPromiseV1,
  createProviderPointRejectedPromiseV1,
  hardenProviderPointPromiseV1,
} from "./provider-point-runtime-internal.js";
import {
  PROVIDER_ACCEPTANCE_STATE_TOKEN_DOMAIN_V1,
  ProviderStrongReadyAcceptanceStateCandidateV1Schema,
  ProviderStrongReadyAcceptanceStateUnsignedCandidateV1Schema,
  type ProviderStrongReadyAcceptanceStateUnsignedCandidateV1,
} from "./provider-strong-ready-acceptance-candidate.js";

const CapturedFunctionPrototypeBindV1 = Function.prototype.bind;
const CapturedFunctionPrototypeCallV1 = Function.prototype.call;
const CapturedFunctionPrototypeHasInstanceV1 =
  Function.prototype[Symbol.hasInstance];
const CapturedArrayIsArrayV1 = Array.isArray;
const CapturedArrayPrototypeV1 = Array.prototype;
const CapturedArrayPrototypeSortV1 = Array.prototype.sort;
const CapturedJsonStringifyV1 = JSON.stringify;
const CapturedNumberIsSafeIntegerV1 = Number.isSafeInteger;
const CapturedObjectCreateV1 = Object.create;
const CapturedObjectDefinePropertyV1 = Object.defineProperty;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedObjectGetOwnPropertyDescriptorV1 =
  Object.getOwnPropertyDescriptor;
const CapturedObjectGetOwnPropertyDescriptorsV1 =
  Object.getOwnPropertyDescriptors;
const CapturedObjectGetOwnPropertySymbolsV1 = Object.getOwnPropertySymbols;
const CapturedObjectGetPrototypeOfV1 = Object.getPrototypeOf;
const CapturedObjectIsV1 = Object.is;
const CapturedObjectKeysV1 = Object.keys;
const CapturedObjectPrototypeV1 = Object.prototype;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedReflectOwnKeysV1 = Reflect.ownKeys;
const CapturedStringV1 = String;
const CapturedStringPrototypeCharCodeAtV1 = String.prototype.charCodeAt;
const CapturedTextEncoderV1 = TextEncoder;
const CapturedTextEncoderPrototypeEncodeV1 = TextEncoder.prototype.encode;
const CapturedTypeErrorV1 = TypeError;
const CapturedUint8ArrayV1 = Uint8Array;
const CapturedTypedArrayPrototypeV1 = CapturedObjectGetPrototypeOfV1(
  CapturedUint8ArrayV1.prototype,
);
const CapturedTypedArrayByteLengthGetterCandidateV1 =
  CapturedObjectGetOwnPropertyDescriptorV1(
    CapturedTypedArrayPrototypeV1,
    "byteLength",
  )?.get;
const CapturedWeakMapV1 = WeakMap;
const CapturedWeakMapGetV1 = CapturedWeakMapV1.prototype.get;
const CapturedWeakMapHasV1 = CapturedWeakMapV1.prototype.has;
const CapturedWeakMapSetV1 = CapturedWeakMapV1.prototype.set;
const CapturedWeakSetV1 = WeakSet;
const CapturedWeakSetAddV1 = CapturedWeakSetV1.prototype.add;
const CapturedWeakSetHasV1 = CapturedWeakSetV1.prototype.has;

if (CapturedTypedArrayByteLengthGetterCandidateV1 === undefined) {
  throw new CapturedTypeErrorV1("Uint8Array byteLength primordial unavailable");
}

function bindUncurriedAtBootstrapV1(method: Function): Function {
  return CapturedObjectFreezeV1(
    CapturedReflectApplyV1(
      CapturedFunctionPrototypeBindV1,
      CapturedFunctionPrototypeCallV1,
      CapturedObjectFreezeV1([method]),
    ) as Function,
  );
}

function bindMethodAtBootstrapV1(method: Function, receiver: object): Function {
  return CapturedObjectFreezeV1(
    CapturedReflectApplyV1(
      CapturedFunctionPrototypeBindV1,
      method,
      CapturedObjectFreezeV1([receiver]),
    ) as Function,
  );
}

const functionHasInstanceV1 = bindUncurriedAtBootstrapV1(
  CapturedFunctionPrototypeHasInstanceV1,
) as (constructor: Function, value: unknown) => boolean;
const stringCharCodeAtV1 = bindUncurriedAtBootstrapV1(
  CapturedStringPrototypeCharCodeAtV1,
) as (receiver: string, index: number) => number;
const typedArrayByteLengthV1 = bindUncurriedAtBootstrapV1(
  CapturedTypedArrayByteLengthGetterCandidateV1,
) as (value: Uint8Array) => number;
const weakMapGetV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapGetV1,
) as <K extends object, V>(map: WeakMap<K, V>, key: K) => V | undefined;
const weakMapHasV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapHasV1,
) as <K extends object>(map: WeakMap<K, unknown>, key: K) => boolean;
const weakMapSetV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapSetV1,
) as <K extends object, V>(map: WeakMap<K, V>, key: K, value: V) => void;
const weakSetAddV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakSetAddV1,
) as <T extends object>(set: WeakSet<T>, value: T) => void;
const weakSetHasV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakSetHasV1,
) as <T extends object>(set: WeakSet<T>, value: T) => boolean;
const parseInitializationNonceV1 = bindMethodAtBootstrapV1(
  LowerHex32V1Schema.parse,
  LowerHex32V1Schema,
) as (value: unknown) => LowerHex32V1;
const parseInstallationIdentityGenerationIdV1 = bindMethodAtBootstrapV1(
  InstallationIdentityGenerationIdV1Schema.parse,
  InstallationIdentityGenerationIdV1Schema,
) as (value: unknown) => InstallationIdentityGenerationIdV1;
const parseKeyedStateTokenV1 = bindMethodAtBootstrapV1(
  KeyedStateTokenV1Schema.parse,
  KeyedStateTokenV1Schema,
) as (value: unknown) => KeyedStateTokenV1;
const parseSignedAcceptanceStateV1 = bindMethodAtBootstrapV1(
  ProviderStrongReadyAcceptanceStateCandidateV1Schema.parse,
  ProviderStrongReadyAcceptanceStateCandidateV1Schema,
) as (value: unknown) => ReturnType<
  typeof ProviderStrongReadyAcceptanceStateCandidateV1Schema.parse
>;
const parseUnsignedAcceptanceStateV1 = bindMethodAtBootstrapV1(
  ProviderStrongReadyAcceptanceStateUnsignedCandidateV1Schema.parse,
  ProviderStrongReadyAcceptanceStateUnsignedCandidateV1Schema,
) as (value: unknown) => ProviderStrongReadyAcceptanceStateUnsignedCandidateV1;

const CapturedUtf8EncoderV1 = CapturedObjectFreezeV1(
  new CapturedTextEncoderV1(),
);
const MINT_INPUT_KEYS_V1 = CapturedObjectFreezeV1([
  "initializationNonce",
  "installationIdentityGenerationId",
  "keyCheckToken",
  "installationIdentityKey",
  "cryptoHost",
] as const);
const CRYPTO_HOST_KEYS_V1 = CapturedObjectFreezeV1([
  "sha256",
  "hmacSha256",
] as const);

declare const providerAcceptanceIdentityVerificationCapabilityBrandV1:
  unique symbol;
export interface ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1 {
  readonly [providerAcceptanceIdentityVerificationCapabilityBrandV1]: true;
}

export interface MintProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityInternalV1Input {
  readonly initializationNonce: LowerHex32V1;
  readonly installationIdentityGenerationId:
    InstallationIdentityGenerationIdV1;
  readonly keyCheckToken: KeyedStateTokenV1;
  readonly installationIdentityKey: Uint8Array;
  readonly cryptoHost: ProviderCryptoHostV1;
}

export type ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityStageInternalV1 =
  "identity_verification_capability";
export type ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityReasonInternalV1 =
  "capability_invalid";

const identityCapabilityErrorsV1 = new CapturedWeakSetV1<object>();

export class ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityErrorInternalV1 extends CapturedTypeErrorV1 {
  readonly stage = "identity_verification_capability" as const;
  readonly reason = "capability_invalid" as const;

  constructor() {
    super("provider Acceptance identity verification failed");
    this.name =
      "ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityErrorInternalV1";
    weakSetAddV1(identityCapabilityErrorsV1, this);
    CapturedObjectFreezeV1(this);
  }
}

export function isProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityErrorInternalV1(
  value: unknown,
): value is ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityErrorInternalV1 {
  return isObjectIdentityV1(value) &&
    weakSetHasV1(identityCapabilityErrorsV1, value);
}

interface CapturedProviderCryptoHostInternalV1 {
  readonly receiver: object;
  readonly sha256: Function;
  readonly hmacSha256: Function;
}

interface ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityStateInternalV1 {
  readonly installationIdentityGenerationId:
    InstallationIdentityGenerationIdV1;
  readonly installationIdentityKey: Uint8Array;
  readonly cryptoHost: CapturedProviderCryptoHostInternalV1;
}

const identityCapabilityStatesV1 = new CapturedWeakMapV1<
  object,
  ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityStateInternalV1
>();

function isObjectIdentityV1(value: unknown): value is object {
  return value !== null &&
    (typeof value === "object" || typeof value === "function");
}

function failCapabilityV1(): never {
  throw new ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityErrorInternalV1();
}

function defineFrozenEnumerableDataV1(
  target: object,
  key: string,
  value: unknown,
): void {
  const descriptor = CapturedObjectCreateV1(null) as Record<string, unknown>;
  descriptor.value = value;
  descriptor.enumerable = true;
  descriptor.configurable = false;
  descriptor.writable = false;
  CapturedObjectDefinePropertyV1(target, key, descriptor);
}

function createFrozenRecordV1<T extends object>(
  entries: readonly (readonly [string, unknown])[],
): T {
  const record = CapturedObjectCreateV1(null) as object;
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]!;
    defineFrozenEnumerableDataV1(record, entry[0], entry[1]);
  }
  return CapturedObjectFreezeV1(record) as T;
}

function copyExactUint8ArrayV1(value: unknown, byteLength: number): Uint8Array {
  if (!functionHasInstanceV1(CapturedUint8ArrayV1, value)) {
    return failCapabilityV1();
  }
  let observedByteLength: number;
  try {
    observedByteLength = typedArrayByteLengthV1(value as Uint8Array);
  } catch {
    return failCapabilityV1();
  }
  if (observedByteLength !== byteLength) return failCapabilityV1();
  const copy = new CapturedUint8ArrayV1(byteLength);
  for (let index = 0; index < byteLength; index += 1) {
    copy[index] = (value as Uint8Array)[index]!;
  }
  return copy;
}

function captureCryptoHostV1(value: unknown): CapturedProviderCryptoHostInternalV1 {
  const fields = captureProviderPointDetachedExactDataObjectV1(
    value,
    CRYPTO_HOST_KEYS_V1,
  );
  if (
    typeof fields.sha256 !== "function" ||
    typeof fields.hmacSha256 !== "function" ||
    !isObjectIdentityV1(value)
  ) {
    return failCapabilityV1();
  }
  return createFrozenRecordV1<CapturedProviderCryptoHostInternalV1>([
    ["receiver", value],
    ["sha256", fields.sha256],
    ["hmacSha256", fields.hmacSha256],
  ]);
}

function textEncoderEncodeV1(value: string): Uint8Array {
  return CapturedReflectApplyV1(
    CapturedTextEncoderPrototypeEncodeV1,
    CapturedUtf8EncoderV1,
    [value],
  ) as Uint8Array;
}

function createDomainPreimageBytesInternalV1(
  domain: string,
  fields: object,
): Uint8Array {
  return textEncoderEncodeV1(
    canonicalizeTrustedJsonV1(CapturedObjectFreezeV1([domain, fields])),
  );
}

/**
 * Canonicalizes only already-schema-parsed internal projections. Unlike the
 * public JCS helper, every mutable primordial used here is captured at module
 * initialization so later realm poisoning cannot alter an owner-HMAC
 * preimage. Aliases are rejected along with cycles; schema-validated
 * reference-Candidate projections are JSON trees, so accepting an alias would
 * add no legitimate value.
 */
function canonicalizeTrustedJsonV1(value: unknown): string {
  const seen = new CapturedWeakSetV1<object>();

  function quoteStringV1(input: string): string {
    for (let index = 0; index < input.length; index += 1) {
      const codeUnit = stringCharCodeAtV1(input, index);
      if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
        const next = stringCharCodeAtV1(input, index + 1);
        if (!(next >= 0xdc00 && next <= 0xdfff)) {
          throw new CapturedTypeErrorV1(
            "canonical projection contains an unpaired high surrogate",
          );
        }
        index += 1;
      } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
        throw new CapturedTypeErrorV1(
          "canonical projection contains an unpaired low surrogate",
        );
      }
    }
    const quoted = CapturedJsonStringifyV1(input);
    if (typeof quoted !== "string") {
      throw new CapturedTypeErrorV1("canonical string encoding failed");
    }
    return quoted;
  }

  function canonicalizeValueV1(input: unknown): string {
    if (input === null) return "null";
    switch (typeof input) {
      case "boolean":
        return input ? "true" : "false";
      case "string":
        return quoteStringV1(input);
      case "number": {
        if (
          !CapturedNumberIsSafeIntegerV1(input) ||
          CapturedObjectIsV1(input, -0)
        ) {
          throw new CapturedTypeErrorV1(
            "canonical projection number must be a safe non-negative-zero integer",
          );
        }
        const encoded = CapturedJsonStringifyV1(input);
        if (typeof encoded !== "string") {
          throw new CapturedTypeErrorV1("canonical number encoding failed");
        }
        return encoded;
      }
      case "object":
        break;
      default:
        throw new CapturedTypeErrorV1(
          "canonical projection contains a non-JSON value",
        );
    }

    if (weakSetHasV1(seen, input)) {
      throw new CapturedTypeErrorV1(
        "canonical projection must be an identity-disjoint JSON tree",
      );
    }
    weakSetAddV1(seen, input);

    if (CapturedArrayIsArrayV1(input)) {
      if (CapturedObjectGetPrototypeOfV1(input) !== CapturedArrayPrototypeV1) {
        throw new CapturedTypeErrorV1(
          "canonical projection arrays must use the intrinsic prototype",
        );
      }
      if (CapturedObjectGetOwnPropertySymbolsV1(input).length !== 0) {
        throw new CapturedTypeErrorV1(
          "canonical projection arrays must not contain symbols",
        );
      }
      const ownKeys = CapturedReflectOwnKeysV1(input);
      if (ownKeys.length !== input.length + 1) {
        throw new CapturedTypeErrorV1(
          "canonical projection arrays must be dense and exact",
        );
      }
      let output = "[";
      for (let index = 0; index < input.length; index += 1) {
        const descriptor = CapturedObjectGetOwnPropertyDescriptorV1(
          input,
          CapturedStringV1(index),
        );
        if (
          descriptor === undefined ||
          !("value" in descriptor) ||
          descriptor.enumerable !== true
        ) {
          throw new CapturedTypeErrorV1(
            "canonical projection arrays require enumerable data elements",
          );
        }
        if (index !== 0) output += ",";
        output += canonicalizeValueV1(descriptor.value);
      }
      return `${output}]`;
    }

    const prototype = CapturedObjectGetPrototypeOfV1(input);
    if (prototype !== CapturedObjectPrototypeV1 && prototype !== null) {
      throw new CapturedTypeErrorV1(
        "canonical projection objects must use a plain prototype",
      );
    }
    if (CapturedObjectGetOwnPropertySymbolsV1(input).length !== 0) {
      throw new CapturedTypeErrorV1(
        "canonical projection objects must not contain symbols",
      );
    }
    const descriptors = CapturedObjectGetOwnPropertyDescriptorsV1(input);
    const keys = CapturedObjectKeysV1(descriptors);
    CapturedReflectApplyV1(CapturedArrayPrototypeSortV1, keys, [
      (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0,
    ]);
    let output = "{";
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index]!;
      const descriptor = descriptors[key];
      if (
        descriptor === undefined ||
        !("value" in descriptor) ||
        descriptor.enumerable !== true
      ) {
        throw new CapturedTypeErrorV1(
          "canonical projection objects require enumerable data properties",
        );
      }
      if (index !== 0) output += ",";
      output += `${quoteStringV1(key)}:${canonicalizeValueV1(
        descriptor.value,
      )}`;
    }
    return `${output}}`;
  }

  return canonicalizeValueV1(value);
}

function bytesToLowerHexV1(bytes: Uint8Array, byteLength: number): string {
  const alphabet = "0123456789abcdef";
  let output = "";
  for (let index = 0; index < byteLength; index += 1) {
    const byte = bytes[index]!;
    output += alphabet[(byte >>> 4) & 0x0f]!;
    output += alphabet[byte & 0x0f]!;
  }
  return output;
}

function invokeCryptoHostDigestV1(
  host: CapturedProviderCryptoHostInternalV1,
  method: "sha256" | "hmacSha256",
  key: Uint8Array | undefined,
  message: Uint8Array,
): Promise<Uint8Array> {
  let produced: unknown;
  try {
    produced = method === "sha256"
      ? CapturedReflectApplyV1(host.sha256, host.receiver, [
        copyExactUint8ArrayV1(message, typedArrayByteLengthV1(message)),
      ])
      : CapturedReflectApplyV1(host.hmacSha256, host.receiver, [
        copyExactUint8ArrayV1(key, 32),
        copyExactUint8ArrayV1(message, typedArrayByteLengthV1(message)),
      ]);
  } catch (error) {
    return createProviderPointRejectedPromiseV1(error);
  }
  return createProviderPointFulfilledPromiseV1(produced).then((result) =>
    copyExactUint8ArrayV1(result, 32)
  );
}

function deriveInstallationIdentityGenerationIdInternalV1(
  initializationNonce: LowerHex32V1,
  host: CapturedProviderCryptoHostInternalV1,
): Promise<InstallationIdentityGenerationIdV1> {
  const fields = createFrozenRecordV1<Readonly<{
    initializationNonce: LowerHex32V1;
  }>>([["initializationNonce", initializationNonce]]);
  const message = createDomainPreimageBytesInternalV1(
    INSTALLATION_IDENTITY_GENERATION_DOMAIN_V1,
    fields,
  );
  return invokeCryptoHostDigestV1(host, "sha256", undefined, message).then(
    (digest) => parseInstallationIdentityGenerationIdV1(
      `installation-identity-generation:${bytesToLowerHexV1(digest, 11)}`,
    ),
  );
}

function deriveKeyedTokenForDomainInternalV1(
  state: ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityStateInternalV1,
  domain: string,
  fields: object,
): Promise<KeyedStateTokenV1> {
  const message = createDomainPreimageBytesInternalV1(domain, fields);
  return invokeCryptoHostDigestV1(
    state.cryptoHost,
    "hmacSha256",
    state.installationIdentityKey,
    message,
  ).then((digest) =>
    parseKeyedStateTokenV1(
      `hmac-sha256:${bytesToLowerHexV1(digest, 32)}`,
    )
  );
}

function fixedLengthStringEqualV1(left: string, right: string): boolean {
  const maxLength = left.length > right.length ? left.length : right.length;
  let difference = left.length ^ right.length;
  for (let index = 0; index < maxLength; index += 1) {
    const leftCode = index < left.length ? stringCharCodeAtV1(left, index) : 0;
    const rightCode = index < right.length
      ? stringCharCodeAtV1(right, index)
      : 0;
    difference |= leftCode ^ rightCode;
  }
  return difference === 0;
}

function createOpaqueCapabilityV1(): ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1 {
  return CapturedObjectFreezeV1(
    CapturedObjectCreateV1(null),
  ) as ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1;
}

function prepareMintInputV1(
  input: unknown,
): Readonly<{
  initializationNonce: LowerHex32V1;
  installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  keyCheckToken: KeyedStateTokenV1;
  installationIdentityKey: Uint8Array;
  cryptoHost: CapturedProviderCryptoHostInternalV1;
}> {
  try {
    const fields = captureProviderPointDetachedExactDataObjectV1(
      input,
      MINT_INPUT_KEYS_V1,
    );
    return createFrozenRecordV1([
      ["initializationNonce", parseInitializationNonceV1(
        fields.initializationNonce,
      )],
      ["installationIdentityGenerationId",
        parseInstallationIdentityGenerationIdV1(
          fields.installationIdentityGenerationId,
        )],
      ["keyCheckToken", parseKeyedStateTokenV1(fields.keyCheckToken)],
      ["installationIdentityKey", copyExactUint8ArrayV1(
        fields.installationIdentityKey,
        32,
      )],
      ["cryptoHost", captureCryptoHostV1(fields.cryptoHost)],
    ]);
  } catch {
    return failCapabilityV1();
  }
}

async function mintInternalV1(
  prepared: ReturnType<typeof prepareMintInputV1>,
): Promise<ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1> {
  try {
    const derivedGenerationId =
      await deriveInstallationIdentityGenerationIdInternalV1(
        prepared.initializationNonce,
        prepared.cryptoHost,
      );
    if (
      !fixedLengthStringEqualV1(
        derivedGenerationId,
        prepared.installationIdentityGenerationId,
      )
    ) {
      return failCapabilityV1();
    }
    const provisionalState =
      createFrozenRecordV1<ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityStateInternalV1>([
        ["installationIdentityGenerationId", derivedGenerationId],
        ["installationIdentityKey", prepared.installationIdentityKey],
        ["cryptoHost", prepared.cryptoHost],
      ]);
    const keyCheckFields = createFrozenRecordV1<Readonly<{
      generationId: InstallationIdentityGenerationIdV1;
      initializationNonce: LowerHex32V1;
    }>>([
      ["generationId", derivedGenerationId],
      ["initializationNonce", prepared.initializationNonce],
    ]);
    const derivedKeyCheckToken = await deriveKeyedTokenForDomainInternalV1(
      provisionalState,
      INSTALLATION_IDENTITY_KEY_CHECK_DOMAIN_V1,
      keyCheckFields,
    );
    if (
      !fixedLengthStringEqualV1(
        derivedKeyCheckToken,
        prepared.keyCheckToken,
      )
    ) {
      return failCapabilityV1();
    }
    const capability = createOpaqueCapabilityV1();
    weakMapSetV1(identityCapabilityStatesV1, capability, provisionalState);
    return capability;
  } catch (error) {
    if (
      isProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityErrorInternalV1(error)
    ) {
      throw error;
    }
    return failCapabilityV1();
  }
}

/** Package-private mint; this module is absent from the public export map. */
export function mintProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityInternalV1(
  input: MintProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityInternalV1Input,
): Promise<ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1> {
  let prepared: ReturnType<typeof prepareMintInputV1>;
  try {
    prepared = prepareMintInputV1(input);
  } catch (error) {
    return createProviderPointRejectedPromiseV1(error);
  }
  return hardenProviderPointPromiseV1(mintInternalV1(prepared));
}

function requireCapabilityV1(
  capability: unknown,
): ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityStateInternalV1 {
  if (
    !isObjectIdentityV1(capability) ||
    !weakMapHasV1(identityCapabilityStatesV1, capability)
  ) {
    return failCapabilityV1();
  }
  const state = weakMapGetV1(identityCapabilityStatesV1, capability);
  if (state === undefined) return failCapabilityV1();
  return state;
}

export function getProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityInstallationIdentityGenerationIdInternalV1(
  capability: unknown,
): InstallationIdentityGenerationIdV1 {
  return requireCapabilityV1(capability).installationIdentityGenerationId;
}

export function assertProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityInternalV1(
  capability: unknown,
  installationIdentityGenerationId: unknown,
): asserts capability is ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1 {
  const state = requireCapabilityV1(capability);
  if (typeof installationIdentityGenerationId !== "string") {
    return failCapabilityV1();
  }
  if (
    !fixedLengthStringEqualV1(
      state.installationIdentityGenerationId,
      installationIdentityGenerationId,
    )
  ) {
    return failCapabilityV1();
  }
}

function requireCapabilityForIdentityV1(
  capability: unknown,
  installationIdentityGenerationId: unknown,
): ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityStateInternalV1 {
  assertProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityInternalV1(
    capability,
    installationIdentityGenerationId,
  );
  return requireCapabilityV1(capability);
}

function projectUnsignedAcceptanceStateV1(
  input: unknown,
): ProviderStrongReadyAcceptanceStateUnsignedCandidateV1 {
  try {
    const signed = parseSignedAcceptanceStateV1(input);
    return parseUnsignedAcceptanceStateV1(createFrozenRecordV1([
      ["profile", signed.profile],
      ["generationId", signed.generationId],
      ["installationIdentityGenerationId",
        signed.installationIdentityGenerationId],
      ["acceptanceOrdinal", signed.acceptanceOrdinal],
      ["predecessor", signed.predecessor],
      ["configuration", signed.configuration],
      ["acceptedAt", signed.acceptedAt],
    ]));
  } catch {
    return parseUnsignedAcceptanceStateV1(input);
  }
}

const MIGRATION_ONLY_ACCEPTANCE_UNSIGNED_KEYS_INTERNAL_V1 =
  CapturedObjectFreezeV1([
    "profile",
    "generationId",
    "installationIdentityGenerationId",
    "acceptanceOrdinal",
    "predecessor",
    "configuration",
    "acceptedAt",
  ] as const);

/**
 * Package-private identity-keyed projection for the branch-specific
 * migration-only Acceptance family. The caller must first validate the full
 * branch schema; this authority independently enforces the exact unsigned
 * projection and Installation Identity before touching the retained key.
 */
function projectUnsignedMigrationOnlyAcceptanceStateInternalV1(
  input: unknown,
): object {
  const fields = captureProviderPointDetachedExactDataObjectV1(
    input,
    MIGRATION_ONLY_ACCEPTANCE_UNSIGNED_KEYS_INTERNAL_V1,
  );
  if (
    fields.profile !==
      "provider_migration_same_installation_identity_current_strong_source_normal_migration_only_acceptance_payload_reference_candidate_v1"
  ) {
    return failCapabilityV1();
  }
  return createFrozenRecordV1([
    ["profile", fields.profile],
    ["generationId", fields.generationId],
    [
      "installationIdentityGenerationId",
      fields.installationIdentityGenerationId,
    ],
    ["acceptanceOrdinal", fields.acceptanceOrdinal],
    ["predecessor", fields.predecessor],
    ["configuration", fields.configuration],
    ["acceptedAt", fields.acceptedAt],
  ]);
}

function assertProjectedIdentityV1(
  state: ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityStateInternalV1,
  projectedInstallationIdentityGenerationId: unknown,
): void {
  let projected: InstallationIdentityGenerationIdV1;
  try {
    projected = parseInstallationIdentityGenerationIdV1(
      projectedInstallationIdentityGenerationId,
    );
  } catch {
    return failCapabilityV1();
  }
  if (
    !fixedLengthStringEqualV1(
      state.installationIdentityGenerationId,
      projected,
    )
  ) {
    return failCapabilityV1();
  }
}

function deriveProjectedTokenV1(
  capability: unknown,
  installationIdentityGenerationId: unknown,
  domain: string,
  project: () => object,
  projectedIdentity: (projection: object) => unknown,
): Promise<KeyedStateTokenV1> {
  let state: ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityStateInternalV1;
  let projection: object;
  try {
    state = requireCapabilityForIdentityV1(
      capability,
      installationIdentityGenerationId,
    );
    projection = project();
    assertProjectedIdentityV1(state, projectedIdentity(projection));
  } catch (error) {
    return createProviderPointRejectedPromiseV1(error);
  }
  return deriveKeyedTokenForDomainInternalV1(state, domain, projection);
}

function verifyProjectedTokenV1(
  derived: Promise<KeyedStateTokenV1>,
  suppliedToken: unknown,
): Promise<boolean> {
  let supplied: KeyedStateTokenV1;
  try {
    supplied = parseKeyedStateTokenV1(suppliedToken);
  } catch (error) {
    return createProviderPointRejectedPromiseV1(error);
  }
  return derived.then((expected) =>
    fixedLengthStringEqualV1(expected, supplied)
  );
}

export function deriveProviderAcceptanceStateTokenWithIdentityCapabilityInternalV1(
  capability: unknown,
  installationIdentityGenerationId: unknown,
  input: unknown,
): Promise<KeyedStateTokenV1> {
  return deriveProjectedTokenV1(
    capability,
    installationIdentityGenerationId,
    PROVIDER_ACCEPTANCE_STATE_TOKEN_DOMAIN_V1,
    () => projectUnsignedAcceptanceStateV1(input),
    (projection) =>
      (projection as ProviderStrongReadyAcceptanceStateUnsignedCandidateV1)
        .installationIdentityGenerationId,
  );
}

export function verifyProviderAcceptanceStateTokenWithIdentityCapabilityInternalV1(
  capability: unknown,
  installationIdentityGenerationId: unknown,
  input: unknown,
  suppliedToken: unknown,
): Promise<boolean> {
  return verifyProjectedTokenV1(
    deriveProviderAcceptanceStateTokenWithIdentityCapabilityInternalV1(
      capability,
      installationIdentityGenerationId,
      input,
    ),
    suppliedToken,
  );
}

export function deriveProviderMigrationOnlyAcceptanceStateTokenWithIdentityCapabilityInternalV1(
  capability: unknown,
  installationIdentityGenerationId: unknown,
  unsignedMigrationOnlyAcceptance: unknown,
): Promise<KeyedStateTokenV1> {
  return deriveProjectedTokenV1(
    capability,
    installationIdentityGenerationId,
    PROVIDER_ACCEPTANCE_STATE_TOKEN_DOMAIN_V1,
    () =>
      projectUnsignedMigrationOnlyAcceptanceStateInternalV1(
        unsignedMigrationOnlyAcceptance,
      ),
    (projection) =>
      (projection as { readonly installationIdentityGenerationId?: unknown })
        .installationIdentityGenerationId,
  );
}

export function verifyProviderMigrationOnlyAcceptanceStateTokenWithIdentityCapabilityInternalV1(
  capability: unknown,
  installationIdentityGenerationId: unknown,
  unsignedMigrationOnlyAcceptance: unknown,
  suppliedToken: unknown,
): Promise<boolean> {
  return verifyProjectedTokenV1(
    deriveProviderMigrationOnlyAcceptanceStateTokenWithIdentityCapabilityInternalV1(
      capability,
      installationIdentityGenerationId,
      unsignedMigrationOnlyAcceptance,
    ),
    suppliedToken,
  );
}

export function deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCurrentVersionTokenWithIdentityCapabilityInternalV1(
  capability: unknown,
  installationIdentityGenerationId: unknown,
  input: unknown,
): Promise<KeyedStateTokenV1> {
  return deriveProjectedTokenV1(
    capability,
    installationIdentityGenerationId,
    PROVIDER_STRONG_READY_BOOTSTRAP_OR_STEADY_ACCEPTANCE_CURRENT_VERSION_TOKEN_REFERENCE_CANDIDATE_DOMAIN_V1,
    () => projectProviderStrongReadyBootstrapOrSteadyAcceptanceCurrentVersionTokenFieldsReferenceCandidateV1(
      input as never,
    ),
    (projection) =>
      (projection as { readonly installationIdentityGenerationId: unknown })
        .installationIdentityGenerationId,
  );
}

export function verifyProviderStrongReadyBootstrapOrSteadyAcceptanceCurrentVersionTokenWithIdentityCapabilityInternalV1(
  capability: unknown,
  installationIdentityGenerationId: unknown,
  input: unknown,
  suppliedToken: unknown,
): Promise<boolean> {
  return verifyProjectedTokenV1(
    deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCurrentVersionTokenWithIdentityCapabilityInternalV1(
      capability,
      installationIdentityGenerationId,
      input,
    ),
    suppliedToken,
  );
}

export function deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptTokenWithIdentityCapabilityInternalV1(
  capability: unknown,
  installationIdentityGenerationId: unknown,
  input: unknown,
): Promise<KeyedStateTokenV1> {
  return deriveProjectedTokenV1(
    capability,
    installationIdentityGenerationId,
    PROVIDER_STRONG_READY_BOOTSTRAP_OR_STEADY_ACCEPTANCE_COMPARE_APPEND_RECEIPT_TOKEN_REFERENCE_CANDIDATE_DOMAIN_V1,
    () => projectProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptUnsignedReferenceCandidateV1(
      input as never,
    ),
    (projection) =>
      (projection as { readonly installationIdentityGenerationId: unknown })
        .installationIdentityGenerationId,
  );
}

export function verifyProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptTokenWithIdentityCapabilityInternalV1(
  capability: unknown,
  installationIdentityGenerationId: unknown,
  input: unknown,
  suppliedToken: unknown,
): Promise<boolean> {
  return verifyProjectedTokenV1(
    deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptTokenWithIdentityCapabilityInternalV1(
      capability,
      installationIdentityGenerationId,
      input,
    ),
    suppliedToken,
  );
}

CapturedObjectFreezeV1(
  mintProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityInternalV1,
);
CapturedObjectFreezeV1(
  getProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityInstallationIdentityGenerationIdInternalV1,
);
CapturedObjectFreezeV1(
  assertProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityInternalV1,
);
CapturedObjectFreezeV1(
  deriveProviderAcceptanceStateTokenWithIdentityCapabilityInternalV1,
);
CapturedObjectFreezeV1(
  verifyProviderAcceptanceStateTokenWithIdentityCapabilityInternalV1,
);
CapturedObjectFreezeV1(
  deriveProviderMigrationOnlyAcceptanceStateTokenWithIdentityCapabilityInternalV1,
);
CapturedObjectFreezeV1(
  verifyProviderMigrationOnlyAcceptanceStateTokenWithIdentityCapabilityInternalV1,
);
CapturedObjectFreezeV1(
  deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCurrentVersionTokenWithIdentityCapabilityInternalV1,
);
CapturedObjectFreezeV1(
  verifyProviderStrongReadyBootstrapOrSteadyAcceptanceCurrentVersionTokenWithIdentityCapabilityInternalV1,
);
CapturedObjectFreezeV1(
  deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptTokenWithIdentityCapabilityInternalV1,
);
CapturedObjectFreezeV1(
  verifyProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptTokenWithIdentityCapabilityInternalV1,
);
