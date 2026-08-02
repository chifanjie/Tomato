import { z } from "zod";

import {
  ProviderBootstrapTrustBundleV1Schema,
  diagnoseProviderBootstrapTrustBundleRootClosureInternalV1,
  type ProviderBootstrapTrustBundleV1,
} from "./bootstrap-trust-bundle.js";
import {
  assertJsonDataTreeBeforeSchemaV1,
} from "./domain-crypto.js";
import {
  PROVIDER_REGISTRY_ROOT_CROSS_SIGNATURE_DOMAIN_V1,
  PROVIDER_REGISTRY_ROOT_RECOVERY_SIGNATURE_DOMAIN_V1,
  ProviderRegistryCompromiseRecoveryRootMetadataUnsignedClaimsV1Schema,
  ProviderRegistryPlannedRolloverRootMetadataUnsignedClaimsV1Schema,
  ProviderRegistryRecoveryKeyIdV1Schema,
  ProviderRegistryRootMetadataEnvelopeV1Schema,
  ProviderRegistryRootMetadataPinV1Schema,
  diagnoseProviderRegistryRootMetadataEnvelopeStructureInternalV1,
  projectProviderRegistryRootMetadataUnsignedClaimsV1,
  verifyProviderRegistryBootstrapRootSelfSignatureV1,
  verifyProviderRegistryRootSelfSignatureV1,
  type ProviderRegistryRecoveryPublicKeyV1,
  type ProviderRegistryRootMetadataEnvelopeV1,
  type ProviderRegistryRootMetadataPinV1,
  type ProviderRegistryRootMetadataV1,
  type ProviderRegistryRootPublicKeyV1,
} from "./provider-registry-trust.js";
import { canonicalizeJcsSafeIntegerUtf8V1 } from "./jcs.js";
import {
  ProviderRegistryRootKeyIdV1Schema,
} from "./primitives.js";
import {
  getProviderStrictEd25519CryptoCapabilityBytesV1,
  validateProviderStrictEd25519PointWithCapabilityV1,
  verifyRawEd25519WithCapabilityV1,
  type ProviderStrictEd25519OpaqueCapabilityV1,
} from "./strict-ed25519-conformance.js";

const BASE64URL_PREFIX = "base64url:";
const BASE64URL_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const ROOT_CROSS_SIGNATURE_PATTERN =
  /^provider-root-cross-ed25519:([0-9a-f]{22}):([0-9a-f]{128})$/u;
const ROOT_RECOVERY_SIGNATURE_PATTERN =
  /^provider-root-recovery-ed25519:([0-9a-f]{22}):([0-9a-f]{128})$/u;

export const ProviderRegistryRootCrossSignatureWrapperV1Schema =
  z.strictObject({
    rootKeyId: ProviderRegistryRootKeyIdV1Schema,
    domain: z.literal(PROVIDER_REGISTRY_ROOT_CROSS_SIGNATURE_DOMAIN_V1),
    claims:
      ProviderRegistryPlannedRolloverRootMetadataUnsignedClaimsV1Schema,
  });
export type ProviderRegistryRootCrossSignatureWrapperV1 = z.infer<
  typeof ProviderRegistryRootCrossSignatureWrapperV1Schema
>;

export const ProviderRegistryRootRecoverySignatureWrapperV1Schema =
  z.strictObject({
    recoveryKeyId: ProviderRegistryRecoveryKeyIdV1Schema,
    domain: z.literal(PROVIDER_REGISTRY_ROOT_RECOVERY_SIGNATURE_DOMAIN_V1),
    claims: z.discriminatedUnion("activation", [
      ProviderRegistryPlannedRolloverRootMetadataUnsignedClaimsV1Schema,
      ProviderRegistryCompromiseRecoveryRootMetadataUnsignedClaimsV1Schema,
    ]),
  });
export type ProviderRegistryRootRecoverySignatureWrapperV1 = z.infer<
  typeof ProviderRegistryRootRecoverySignatureWrapperV1Schema
>;

export interface ValidateProviderRegistryRootMetadataHistoryV1Input {
  readonly bootstrapTrustBundle: ProviderBootstrapTrustBundleV1;
  readonly rootMetadataHistory: readonly ProviderRegistryRootMetadataEnvelopeV1[];
  readonly strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1;
}

export interface ProviderRegistryRootMetadataHistoryValidationV1 {
  /** Structural/history validation is not production authorization. */
  readonly authority: "none_structure_and_history_only";
  readonly currentRootMetadata: ProviderRegistryRootMetadataPinV1;
  readonly retainedRootMetadataGenerationCount: number;
  readonly retainedRootMetadataCanonicalBytes: number;
  readonly rootMetadataHistory: readonly ProviderRegistryRootMetadataEnvelopeV1[];
}

export type ProviderRegistryRootHistoryDiagnosticStageV1 =
  | "history_input"
  | "history_limit"
  | "bootstrap_anchor"
  | "root_metadata_envelope"
  | "root_key_admission"
  | "history_predecessor"
  | "root_self_signature"
  | "root_cross_signature"
  | "root_recovery_signature"
  | "root_material_closure";

export type ProviderRegistryRootHistoryDiagnosticReasonV1 =
  | "schema_invalid"
  | "history_empty"
  | "history_generation_limit_exceeded"
  | "envelope_byte_limit_exceeded"
  | "history_total_byte_limit_exceeded"
  | "bootstrap_metadata_mismatch"
  | "envelope_mismatch"
  | "generation_not_contiguous"
  | "predecessor_pin_mismatch"
  | "root_key_material_alias"
  | "point_admission_failed"
  | "self_signature_invalid"
  | "cross_signature_invalid"
  | "recovery_quorum_invalid";

export interface ProviderRegistryRootHistoryDiagnosticFailureV1 {
  readonly ok: false;
  readonly stage: ProviderRegistryRootHistoryDiagnosticStageV1;
  readonly reason: ProviderRegistryRootHistoryDiagnosticReasonV1;
}

export interface ProviderRegistryRootHistoryDiagnosticSuccessV1 {
  readonly ok: true;
  readonly value: ProviderRegistryRootMetadataHistoryValidationV1;
}

export type ProviderRegistryRootHistoryDiagnosticResultV1 =
  | ProviderRegistryRootHistoryDiagnosticSuccessV1
  | ProviderRegistryRootHistoryDiagnosticFailureV1;

export class ProviderRegistryRootHistoryValidationError extends Error {
  readonly code = "provider_unavailable" as const;
  readonly reason = "attestation_invalid" as const;

  constructor() {
    super("Provider registry root metadata history validation failed");
    this.name = "ProviderRegistryRootHistoryValidationError";
  }
}

class RootHistoryDiagnosticSignal extends Error {
  constructor(
    readonly stage: ProviderRegistryRootHistoryDiagnosticStageV1,
    readonly reason: ProviderRegistryRootHistoryDiagnosticReasonV1,
  ) {
    super("root history diagnostic");
  }
}

function fail(
  stage: ProviderRegistryRootHistoryDiagnosticStageV1,
  reason: ProviderRegistryRootHistoryDiagnosticReasonV1,
): never {
  throw new RootHistoryDiagnosticSignal(stage, reason);
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= left[index]! ^ right[index]!;
  }
  return difference === 0;
}

function decodeCanonicalPublicKeyBytes32V1(value: string): Uint8Array {
  if (!value.startsWith(BASE64URL_PREFIX)) {
    throw new TypeError("invalid canonical public key bytes");
  }
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
      if (outputOffset >= decoded.byteLength) {
        throw new TypeError("invalid canonical public key bytes");
      }
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

function lowerHexToBytes(hex: string): Uint8Array {
  if (!/^[0-9a-f]{128}$/u.test(hex)) {
    throw new TypeError("invalid Ed25519 signature bytes");
  }
  const bytes = new Uint8Array(64);
  for (let index = 0; index < bytes.byteLength; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function deepFreezeJson<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) deepFreezeJson(child);
    Object.freeze(value);
  }
  return value;
}

function canonicalJsonEqual(left: unknown, right: unknown): boolean {
  return bytesEqual(
    canonicalizeJcsSafeIntegerUtf8V1(left),
    canonicalizeJcsSafeIntegerUtf8V1(right),
  );
}

function requireExactInput(
  input: unknown,
): ValidateProviderRegistryRootMetadataHistoryV1Input {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("invalid root history input");
  }
  let prototype: object | null;
  let symbols: symbol[];
  let descriptors: PropertyDescriptorMap;
  try {
    prototype = Object.getPrototypeOf(input) as object | null;
    symbols = Object.getOwnPropertySymbols(input);
    descriptors = Object.getOwnPropertyDescriptors(input);
  } catch {
    throw new TypeError("invalid root history input");
  }
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError("invalid root history input");
  }
  if (symbols.length !== 0) {
    throw new TypeError("invalid root history input");
  }
  const keys = Object.keys(descriptors).sort();
  const expected = [
    "bootstrapTrustBundle",
    "rootMetadataHistory",
    "strictCryptoCapability",
  ];
  if (
    keys.length !== expected.length ||
    keys.some((key, index) => key !== expected[index])
  ) {
    throw new TypeError("invalid root history input");
  }
  for (const key of expected) {
    const descriptor = descriptors[key];
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      throw new TypeError("invalid root history input");
    }
  }
  return {
    bootstrapTrustBundle: descriptors.bootstrapTrustBundle!
      .value as ProviderBootstrapTrustBundleV1,
    rootMetadataHistory: descriptors.rootMetadataHistory!
      .value as readonly ProviderRegistryRootMetadataEnvelopeV1[],
    strictCryptoCapability: descriptors.strictCryptoCapability!
      .value as ProviderStrictEd25519OpaqueCapabilityV1,
  };
}

function snapshotRootMetadataHistoryCandidatesV1(
  input: unknown,
  maxGenerationCount: number,
): readonly unknown[] {
  let isArray: boolean;
  let prototype: object | null;
  let symbols: symbol[];
  let preliminaryLength: number;
  let descriptors: PropertyDescriptorMap;
  try {
    isArray = Array.isArray(input);
    if (!isArray || input === null || typeof input !== "object") {
      throw new TypeError("root metadata history must be an array");
    }
    prototype = Object.getPrototypeOf(input) as object | null;
    if (prototype !== Array.prototype) {
      throw new TypeError("root metadata history must be a plain array");
    }
    const lengthDescriptor = Object.getOwnPropertyDescriptor(
      input,
      "length",
    );
    if (
      lengthDescriptor === undefined ||
      !("value" in lengthDescriptor) ||
      lengthDescriptor.enumerable !== false ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 0
    ) {
      throw new TypeError("root metadata history has an invalid length");
    }
    preliminaryLength = lengthDescriptor.value as number;
    if (preliminaryLength > maxGenerationCount) {
      return fail(
        "history_limit",
        "history_generation_limit_exceeded",
      );
    }
    symbols = Object.getOwnPropertySymbols(input);
    descriptors = Object.getOwnPropertyDescriptors(input);
  } catch (error) {
    if (error instanceof RootHistoryDiagnosticSignal) throw error;
    throw new TypeError("root metadata history must be an array");
  }
  if (symbols.length !== 0) {
    throw new TypeError("root metadata history must be a plain array");
  }

  const lengthDescriptor = descriptors.length;
  if (
    lengthDescriptor === undefined ||
    !("value" in lengthDescriptor) ||
    lengthDescriptor.enumerable !== false ||
    !Number.isSafeInteger(lengthDescriptor.value) ||
    lengthDescriptor.value < 0 ||
    lengthDescriptor.value !== preliminaryLength
  ) {
    throw new TypeError("root metadata history has an invalid length");
  }
  const length = lengthDescriptor.value as number;
  if (length > maxGenerationCount) {
    return fail(
      "history_limit",
      "history_generation_limit_exceeded",
    );
  }

  const keys = Object.keys(descriptors);
  if (keys.length !== length + 1) {
    throw new TypeError(
      "root metadata history must contain only dense array elements",
    );
  }
  const snapshot = new Array<unknown>(length);
  for (let index = 0; index < length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      throw new TypeError("root metadata history must be dense");
    }
    snapshot[index] = descriptor.value;
  }
  return Object.freeze(snapshot);
}

function snapshotBoundedEnvelopeJsonV1(
  input: unknown,
  maxCanonicalBytes: number,
): unknown {
  const seen = new WeakSet<object>();
  let canonicalByteLowerBound = 0;

  function chargeCanonicalLowerBound(units: number): void {
    canonicalByteLowerBound += units;
    if (canonicalByteLowerBound > maxCanonicalBytes) {
      return fail(
        "history_limit",
        "envelope_byte_limit_exceeded",
      );
    }
  }

  function snapshot(value: unknown): unknown {
    if (value === null) {
      chargeCanonicalLowerBound(4);
      return null;
    }
    if (typeof value === "string") {
      chargeCanonicalLowerBound(value.length + 2);
      return value;
    }
    if (typeof value === "boolean") {
      chargeCanonicalLowerBound(value ? 4 : 5);
      return value;
    }
    if (typeof value === "number") {
      chargeCanonicalLowerBound(1);
      return value;
    }
    if (typeof value !== "object") {
      throw new TypeError("root metadata envelope must be JSON data");
    }
    if (seen.has(value)) {
      throw new TypeError("root metadata envelope must be a JSON tree");
    }
    seen.add(value);

    let isArray: boolean;
    let prototype: object | null;
    let symbols: symbol[];
    let descriptors: PropertyDescriptorMap;
    try {
      isArray = Array.isArray(value);
      prototype = Object.getPrototypeOf(value) as object | null;
      symbols = Object.getOwnPropertySymbols(value);
      if (isArray) {
        const lengthDescriptor = Object.getOwnPropertyDescriptor(
          value,
          "length",
        );
        if (
          lengthDescriptor === undefined ||
          !("value" in lengthDescriptor) ||
          !Number.isSafeInteger(lengthDescriptor.value) ||
          lengthDescriptor.value < 0 ||
          lengthDescriptor.value > maxCanonicalBytes
        ) {
          return fail(
            "history_limit",
            "envelope_byte_limit_exceeded",
          );
        }
      }
      descriptors = Object.getOwnPropertyDescriptors(value);
    } catch (error) {
      if (error instanceof RootHistoryDiagnosticSignal) throw error;
      throw new TypeError("root metadata envelope must be JSON data");
    }
    if (
      (isArray && prototype !== Array.prototype) ||
      (!isArray &&
        prototype !== Object.prototype &&
        prototype !== null) ||
      symbols.length !== 0
    ) {
      throw new TypeError(
        "root metadata envelope must use plain JSON containers",
      );
    }

    if (isArray) {
      const lengthDescriptor = descriptors.length;
      if (
        lengthDescriptor === undefined ||
        !("value" in lengthDescriptor) ||
        lengthDescriptor.enumerable !== false ||
        !Number.isSafeInteger(lengthDescriptor.value) ||
        lengthDescriptor.value < 0 ||
        lengthDescriptor.value > maxCanonicalBytes
      ) {
        return fail(
          "history_limit",
          "envelope_byte_limit_exceeded",
        );
      }
      const length = lengthDescriptor.value as number;
      if (Object.keys(descriptors).length !== length + 1) {
        throw new TypeError(
          "root metadata envelope arrays must be dense",
        );
      }
      chargeCanonicalLowerBound(2 + Math.max(0, length - 1));
      const output = new Array<unknown>(length);
      for (let index = 0; index < length; index += 1) {
        const descriptor = descriptors[String(index)];
        if (
          descriptor === undefined ||
          !("value" in descriptor) ||
          descriptor.enumerable !== true
        ) {
          throw new TypeError(
            "root metadata envelope arrays must be dense",
          );
        }
        output[index] = snapshot(descriptor.value);
      }
      return output;
    }

    const output: Record<string, unknown> = {};
    const keys = Object.keys(descriptors);
    chargeCanonicalLowerBound(2 + Math.max(0, keys.length - 1));
    for (const key of keys) {
      const descriptor = descriptors[key];
      if (
        descriptor === undefined ||
        !("value" in descriptor) ||
        descriptor.enumerable !== true
      ) {
        throw new TypeError(
          "root metadata envelope properties must be enumerable data properties",
        );
      }
      chargeCanonicalLowerBound(key.length + 3);
      Object.defineProperty(output, key, {
        value: snapshot(descriptor.value),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
    return output;
  }

  return snapshot(input);
}

export function createProviderRegistryRootCrossSignatureMessageV1(
  input: unknown,
): Uint8Array {
  const claims = projectProviderRegistryRootMetadataUnsignedClaimsV1(input);
  if (claims.activation !== "planned_rollover") {
    throw new TypeError(
      "only planned rollover metadata has a predecessor cross signer",
    );
  }
  const wrapper = ProviderRegistryRootCrossSignatureWrapperV1Schema.parse({
    rootKeyId: claims.predecessor.rootKeyId,
    domain: PROVIDER_REGISTRY_ROOT_CROSS_SIGNATURE_DOMAIN_V1,
    claims,
  });
  return canonicalizeJcsSafeIntegerUtf8V1([
    PROVIDER_REGISTRY_ROOT_CROSS_SIGNATURE_DOMAIN_V1,
    wrapper,
  ]);
}

export function createProviderRegistryRootRecoverySignatureMessageV1(
  input: unknown,
  recoveryKeyId: unknown,
): Uint8Array {
  const claims = projectProviderRegistryRootMetadataUnsignedClaimsV1(input);
  if (claims.activation === "bootstrap") {
    throw new TypeError("bootstrap metadata has no recovery quorum");
  }
  const wrapper = ProviderRegistryRootRecoverySignatureWrapperV1Schema.parse({
    recoveryKeyId: ProviderRegistryRecoveryKeyIdV1Schema.parse(recoveryKeyId),
    domain: PROVIDER_REGISTRY_ROOT_RECOVERY_SIGNATURE_DOMAIN_V1,
    claims,
  });
  return canonicalizeJcsSafeIntegerUtf8V1([
    PROVIDER_REGISTRY_ROOT_RECOVERY_SIGNATURE_DOMAIN_V1,
    wrapper,
  ]);
}

function parseSignature(
  signature: string,
  pattern: RegExp,
): { readonly keyId: string; readonly signatureBytes: Uint8Array } {
  const match = pattern.exec(signature);
  if (match === null || match[1] === undefined || match[2] === undefined) {
    throw new TypeError("invalid root metadata signature");
  }
  return { keyId: match[1], signatureBytes: lowerHexToBytes(match[2]) };
}

function metadataPin(
  envelope: ProviderRegistryRootMetadataEnvelopeV1,
): ProviderRegistryRootMetadataPinV1 {
  return ProviderRegistryRootMetadataPinV1Schema.parse({
    locatorProfile: "installation_provider_registry_root_metadata_v1",
    rootGeneration: envelope.rootGeneration,
    rootKeyId: envelope.rootKeyId,
    contentDigest: envelope.contentDigest,
  });
}

async function admitPoint(
  capability: ProviderStrictEd25519OpaqueCapabilityV1,
  publicKeyBytes: string,
): Promise<boolean> {
  return validateProviderStrictEd25519PointWithCapabilityV1(
    capability,
    decodeCanonicalPublicKeyBytes32V1(publicKeyBytes),
  );
}

async function verifyCrossSignature(
  metadata: ProviderRegistryRootMetadataV1 & {
    readonly activation: "planned_rollover";
  },
  predecessorRoot: ProviderRegistryRootPublicKeyV1,
  capability: ProviderStrictEd25519OpaqueCapabilityV1,
): Promise<boolean> {
  const parsed = parseSignature(
    metadata.predecessorCrossSignature,
    ROOT_CROSS_SIGNATURE_PATTERN,
  );
  if (
    parsed.keyId !== metadata.predecessor.rootKeyId ||
    parsed.keyId !== predecessorRoot.rootKeyId
  ) {
    return false;
  }
  return verifyRawEd25519WithCapabilityV1(
    capability,
    decodeCanonicalPublicKeyBytes32V1(predecessorRoot.publicKeyBytes),
    createProviderRegistryRootCrossSignatureMessageV1(metadata),
    parsed.signatureBytes,
  );
}

async function verifyRecoveryQuorum(
  metadata: Exclude<
    ProviderRegistryRootMetadataV1,
    { readonly activation: "bootstrap" }
  >,
  recoveryKeys: readonly ProviderRegistryRecoveryPublicKeyV1[],
  capability: ProviderStrictEd25519OpaqueCapabilityV1,
): Promise<boolean> {
  if (metadata.recoverySignatures.length !== 2) return false;
  const recoveryById = new Map(
    recoveryKeys.map((key) => [key.recoveryKeyId, key] as const),
  );
  let previousKeyId: string | undefined;
  for (const signature of metadata.recoverySignatures) {
    const parsed = parseSignature(signature, ROOT_RECOVERY_SIGNATURE_PATTERN);
    if (
      (previousKeyId !== undefined && previousKeyId >= parsed.keyId) ||
      !recoveryById.has(
        ProviderRegistryRecoveryKeyIdV1Schema.parse(parsed.keyId),
      )
    ) {
      return false;
    }
    const recoveryKey = recoveryById.get(
      ProviderRegistryRecoveryKeyIdV1Schema.parse(parsed.keyId),
    )!;
    if (
      !(await verifyRawEd25519WithCapabilityV1(
        capability,
        decodeCanonicalPublicKeyBytes32V1(recoveryKey.publicKeyBytes),
        createProviderRegistryRootRecoverySignatureMessageV1(
          metadata,
          recoveryKey.recoveryKeyId,
        ),
        parsed.signatureBytes,
      ))
    ) {
      return false;
    }
    previousKeyId = parsed.keyId;
  }
  return true;
}

async function requireCryptoValidationV1(
  stage: ProviderRegistryRootHistoryDiagnosticStageV1,
  reason: ProviderRegistryRootHistoryDiagnosticReasonV1,
  validate: () => Promise<boolean>,
): Promise<void> {
  try {
    if (!(await validate())) return fail(stage, reason);
  } catch (error) {
    if (error instanceof RootHistoryDiagnosticSignal) throw error;
    return fail(stage, reason);
  }
}

async function validateInternal(
  input: unknown,
): Promise<ProviderRegistryRootMetadataHistoryValidationV1> {
  let exactInput: ValidateProviderRegistryRootMetadataHistoryV1Input;
  try {
    exactInput = requireExactInput(input);
  } catch {
    return fail("history_input", "schema_invalid");
  }

  let bundle: ProviderBootstrapTrustBundleV1;
  try {
    assertJsonDataTreeBeforeSchemaV1(
      exactInput.bootstrapTrustBundle,
    );
    bundle = ProviderBootstrapTrustBundleV1Schema.parse(
      exactInput.bootstrapTrustBundle,
    );
  } catch {
    return fail("bootstrap_anchor", "schema_invalid");
  }
  const rootClosure =
    diagnoseProviderBootstrapTrustBundleRootClosureInternalV1(bundle);
  if (!rootClosure.ok) {
    return fail("bootstrap_anchor", "schema_invalid");
  }

  try {
    if (
      !bytesEqual(
        canonicalizeJcsSafeIntegerUtf8V1(bundle.strictCryptoCapability),
        getProviderStrictEd25519CryptoCapabilityBytesV1(
          exactInput.strictCryptoCapability,
        ),
      )
    ) {
      return fail("bootstrap_anchor", "schema_invalid");
    }
  } catch (error) {
    if (error instanceof RootHistoryDiagnosticSignal) throw error;
    return fail("bootstrap_anchor", "schema_invalid");
  }

  let historyUnknown: readonly unknown[];
  try {
    historyUnknown = snapshotRootMetadataHistoryCandidatesV1(
      exactInput.rootMetadataHistory,
      bundle.providerTrustHistoryPolicy
        .maxRootMetadataGenerationCountPerInstallationIdentity,
    );
  } catch (error) {
    if (error instanceof RootHistoryDiagnosticSignal) throw error;
    return fail("history_input", "schema_invalid");
  }
  if (historyUnknown.length === 0) {
    return fail("history_input", "history_empty");
  }

  const { root, metadata: bootstrapMetadata, recoveryKeys } =
    rootClosure.value;
  await requireCryptoValidationV1(
    "root_key_admission",
    "point_admission_failed",
    () =>
      admitPoint(
        exactInput.strictCryptoCapability,
        root.publicKeyBytes,
      ),
  );
  for (const recoveryKey of recoveryKeys) {
    await requireCryptoValidationV1(
      "root_key_admission",
      "point_admission_failed",
      () =>
        admitPoint(
          exactInput.strictCryptoCapability,
          recoveryKey.publicKeyBytes,
        ),
    );
  }
  await requireCryptoValidationV1(
    "root_self_signature",
    "self_signature_invalid",
    () =>
      verifyProviderRegistryBootstrapRootSelfSignatureV1(
        bootstrapMetadata,
        exactInput.strictCryptoCapability,
      ),
  );

  const history: ProviderRegistryRootMetadataEnvelopeV1[] = [];
  const seenRootMaterials = new Set<string>();
  const recoveryMaterials = new Set(
    recoveryKeys.map((key) => key.publicKeyBytes),
  );
  let retainedCanonicalBytes = 0;

  for (let index = 0; index < historyUnknown.length; index += 1) {
    let envelope: ProviderRegistryRootMetadataEnvelopeV1;
    let canonicalBytes: Uint8Array;
    try {
      const envelopeSnapshot = snapshotBoundedEnvelopeJsonV1(
        historyUnknown[index],
        bundle.providerTrustHistoryPolicy
          .maxSingleTrustEnvelopeLogicalBytes,
      );
      canonicalBytes = canonicalizeJcsSafeIntegerUtf8V1(
        envelopeSnapshot,
      );
      if (
        canonicalBytes.byteLength >
        bundle.providerTrustHistoryPolicy.maxSingleTrustEnvelopeLogicalBytes
      ) {
        return fail(
          "history_limit",
          "envelope_byte_limit_exceeded",
        );
      }
      const envelopeDiagnostic =
        diagnoseProviderRegistryRootMetadataEnvelopeStructureInternalV1(
          envelopeSnapshot,
        );
      if (!envelopeDiagnostic.ok) {
        return fail(
          "root_metadata_envelope",
          envelopeDiagnostic.reason === "schema_invalid"
            ? "schema_invalid"
            : "envelope_mismatch",
        );
      }
      envelope = envelopeDiagnostic.value;
    } catch (error) {
      if (error instanceof RootHistoryDiagnosticSignal) throw error;
      return fail("root_metadata_envelope", "schema_invalid");
    }
    const nextRetainedCanonicalBytes =
      retainedCanonicalBytes + canonicalBytes.byteLength;
    if (
      nextRetainedCanonicalBytes >
      bundle.providerTrustHistoryPolicy
        .maxTotalTrustHistoryLogicalBytesPerInstallationIdentity
    ) {
      return fail(
        "history_limit",
        "history_total_byte_limit_exceeded",
      );
    }
    retainedCanonicalBytes = nextRetainedCanonicalBytes;

    const expectedGeneration = index + 1;
    if (envelope.rootGeneration !== expectedGeneration) {
      return fail("history_predecessor", "generation_not_contiguous");
    }

    if (index === 0) {
      if (!canonicalJsonEqual(envelope, bootstrapMetadata)) {
        return fail("bootstrap_anchor", "bootstrap_metadata_mismatch");
      }
    } else {
      const predecessor = history[index - 1]!;
      if (
        envelope.payload.activation === "bootstrap" ||
        envelope.payload.predecessor.rootGeneration !==
          predecessor.rootGeneration ||
        envelope.payload.predecessor.rootKeyId !== predecessor.rootKeyId ||
        envelope.payload.predecessor.contentDigest !== predecessor.contentDigest
      ) {
        return fail("history_predecessor", "predecessor_pin_mismatch");
      }
    }

    const payload = envelope.payload;
    const activeRoot = payload.activeRoot;
    if (
      seenRootMaterials.has(activeRoot.publicKeyBytes) ||
      recoveryMaterials.has(activeRoot.publicKeyBytes)
    ) {
      return fail("root_material_closure", "root_key_material_alias");
    }
    seenRootMaterials.add(activeRoot.publicKeyBytes);
    await requireCryptoValidationV1(
      "root_key_admission",
      "point_admission_failed",
      () =>
        admitPoint(
          exactInput.strictCryptoCapability,
          activeRoot.publicKeyBytes,
        ),
    );
    await requireCryptoValidationV1(
      "root_self_signature",
      "self_signature_invalid",
      () =>
        verifyProviderRegistryRootSelfSignatureV1(
          payload,
          exactInput.strictCryptoCapability,
        ),
    );
    if (payload.activation === "planned_rollover") {
      const predecessor = history[index - 1];
      await requireCryptoValidationV1(
        "root_cross_signature",
        "cross_signature_invalid",
        () =>
          predecessor === undefined
            ? Promise.resolve(false)
            : verifyCrossSignature(
                payload,
                predecessor.payload.activeRoot,
                exactInput.strictCryptoCapability,
              ),
      );
    }
    if (payload.activation !== "bootstrap") {
      await requireCryptoValidationV1(
        "root_recovery_signature",
        "recovery_quorum_invalid",
        () =>
          verifyRecoveryQuorum(
            payload,
            recoveryKeys,
            exactInput.strictCryptoCapability,
          ),
      );
    }
    history.push(envelope);
  }

  const current = history[history.length - 1]!;
  return deepFreezeJson({
    authority: "none_structure_and_history_only" as const,
    currentRootMetadata: metadataPin(current),
    retainedRootMetadataGenerationCount: history.length,
    retainedRootMetadataCanonicalBytes: retainedCanonicalBytes,
    rootMetadataHistory: history,
  });
}

export async function diagnoseProviderRegistryRootMetadataHistoryInternalV1(
  input: unknown,
): Promise<ProviderRegistryRootHistoryDiagnosticResultV1> {
  try {
    return { ok: true, value: await validateInternal(input) };
  } catch (error) {
    if (error instanceof RootHistoryDiagnosticSignal) {
      return { ok: false, stage: error.stage, reason: error.reason };
    }
    return {
      ok: false,
      stage: "history_input",
      reason: "schema_invalid",
    };
  }
}

export async function validateProviderRegistryRootMetadataHistoryV1(
  input: unknown,
): Promise<ProviderRegistryRootMetadataHistoryValidationV1> {
  const diagnostic =
    await diagnoseProviderRegistryRootMetadataHistoryInternalV1(input);
  if (!diagnostic.ok) {
    throw new ProviderRegistryRootHistoryValidationError();
  }
  return diagnostic.value;
}
