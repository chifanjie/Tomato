/**
 * Package-private C09-I history-reuse entry.  It consumes the Registry
 * witness exactly once, binds it to the exact detached L request, and then
 * invokes the registered no-snapshot Runtime semantic core.
 */

import type {
  ContentDigestV1,
  DurableObjectIdentityProviderIdV1,
} from "./primitives.js";
import type { ProviderRegistryManifestHistoryValidationV1 } from "./provider-registry-manifest-history.js";
import {
  createProviderRegistryPreparedCopyLedgerInternalV1,
  takeRegistryHistoryVerifiedWitnessInternalV1,
  type ProviderRegistryPreparedCopyLedgerV1,
  type RegistryHistoryVerifiedTipEntryV1,
  type RegistryTrustWitnessHandleV1,
} from "./provider-registry-history-prepared-handle-internal.js";
import {
  createStoreDurableObjectProviderRuntimeAttestationSignatureMessageV1,
  type ProviderFeasibilityApproverPublicKeyV1,
  type StoreDurableObjectProviderRuntimeAttestationV1,
} from "./provider-registry-records.js";
import type { ProviderRegistryRootPublicKeyV1 } from "./provider-registry-trust.js";
import {
  createPreparedDistributionVerificationContextInternalV1,
  readPreparedDistributionSignatureVerificationCountInternalV1,
  type PreparedDistributionVerificationContextV1,
} from "./provider-real-filesystem-source-internal.js";
import type {
  ProviderRuntimeAttestationPointClosureDiagnosticResultV1,
  ProviderRuntimeAttestationPointClosureValidationV1,
  ProviderRuntimeAttestationPointInvalidReasonV1,
  ProviderRuntimeAttestationPointInvalidStageV1,
  ValidateProviderRuntimeAttestationPointClosureV1Input,
} from "./provider-runtime-attestation-point.js";
import {
  createProviderNonThenableFrozenRecordV1,
  hardenProviderPointPromiseV1,
} from "./provider-point-runtime-internal.js";
import {
  assertProviderStrictEd25519CryptoCapabilityIdentityV1,
} from "./strict-ed25519-capability-internal.js";
import {
  ProviderStrictEd25519AttestationError,
  validateProviderStrictEd25519PointWithCapabilityV1,
  verifyRawEd25519WithCapabilityV1,
  type ProviderStrictEd25519OpaqueCapabilityV1,
} from "./strict-ed25519-conformance.js";

const CapturedObjectCreateV1 = Object.create;
const CapturedObjectDefinePropertyV1 = Object.defineProperty;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedObjectGetOwnPropertyDescriptorV1 =
  Object.getOwnPropertyDescriptor;
const CapturedObjectGetPrototypeOfV1 = Object.getPrototypeOf;
const CapturedObjectIsFrozenV1 = Object.isFrozen;
const CapturedObjectPrototypeV1 = Object.prototype;
const CapturedNumberParseIntV1 = Number.parseInt;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedReflectOwnKeysV1 = Reflect.ownKeys;
const CapturedRegExpPrototypeExecV1 = RegExp.prototype.exec;
const CapturedStringPrototypeIndexOfV1 = String.prototype.indexOf;
const CapturedStringPrototypeSliceV1 = String.prototype.slice;
const CapturedTypeErrorV1 = TypeError;
const CapturedUint8ArrayV1 = Uint8Array;

const PREPARED_RUNTIME_INPUT_KEYS_V1 = CapturedObjectFreezeV1([
  "activeRoot",
  "activeRootMetadata",
  "distributionRootBinding",
  "fixtureCorpusManifest",
  "publicSupportTaxonomy",
  "realFilesystemConformanceResult",
  "realFilesystemConformanceResultLocator",
  "realFilesystemConformanceResultPin",
  "releaseMatrix",
  "runtimeAttestation",
  "semanticProviderPolicy",
  "strictCryptoCapability",
  "suiteManifest",
  "targetDiscoveryFixtureManifest",
  "targetDiscoveryResult",
  "targetDiscoveryRunnerRun",
] as const);

type PreparedRuntimeCoreV1 = (
  input: ValidateProviderRuntimeAttestationPointClosureV1Input,
  context: PreparedDistributionVerificationContextV1,
) => Promise<ProviderRuntimeAttestationPointClosureDiagnosticResultV1>;

let preparedRuntimeCoreV1: PreparedRuntimeCoreV1 | undefined;

export interface ProviderRuntimeAttestationHistoryReuseTrustResultV1 {
  readonly runtimeAttestationPointClosure:
    ProviderRuntimeAttestationPointClosureValidationV1;
  readonly historicallyVerifiedApproverPublicKeys:
    readonly ProviderFeasibilityApproverPublicKeyV1[];
  readonly suppliedHistoryTipRoot: ProviderRegistryRootPublicKeyV1;
  readonly verifiedSelectedEntry: RegistryHistoryVerifiedTipEntryV1;
  readonly copyLedger: ProviderRegistryPreparedCopyLedgerV1;
}

interface PreparedRuntimeDiagnosticFailureV1 {
  readonly ok: false;
  readonly stage: ProviderRuntimeAttestationPointInvalidStageV1;
  readonly reason: ProviderRuntimeAttestationPointInvalidReasonV1;
  readonly sourceSignatureVerificationPrefix: number;
  readonly copyLedger: ProviderRegistryPreparedCopyLedgerV1;
}

interface PreparedRuntimeDiagnosticSuccessV1 {
  readonly ok: true;
  readonly value: ProviderRuntimeAttestationHistoryReuseTrustResultV1;
  readonly sourceSignatureVerificationPrefix: 6;
  readonly copyLedger: ProviderRegistryPreparedCopyLedgerV1;
}

export type ProviderRuntimeAttestationHistoryReuseDiagnosticResultV1 =
  | PreparedRuntimeDiagnosticFailureV1
  | PreparedRuntimeDiagnosticSuccessV1;

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

function preparedFailureV1(
  stage: ProviderRuntimeAttestationPointInvalidStageV1,
  reason: ProviderRuntimeAttestationPointInvalidReasonV1,
  sourceSignatureVerificationPrefix: number,
  copyLedger: ProviderRegistryPreparedCopyLedgerV1,
): PreparedRuntimeDiagnosticFailureV1 {
  return createFrozenRecordV1<PreparedRuntimeDiagnosticFailureV1>([
    ["ok", false],
    ["stage", stage],
    ["reason", reason],
    [
      "sourceSignatureVerificationPrefix",
      sourceSignatureVerificationPrefix,
    ],
    ["copyLedger", copyLedger],
  ]);
}

function assertExactPreparedRuntimeInputV1(
  input: unknown,
): asserts input is ValidateProviderRuntimeAttestationPointClosureV1Input {
  if (
    input === null ||
    (typeof input !== "object" && typeof input !== "function") ||
    !CapturedObjectIsFrozenV1(input)
  ) {
    throw new CapturedTypeErrorV1(
      "prepared Runtime input must be one exact frozen object",
    );
  }
  const prototype = CapturedObjectGetPrototypeOfV1(input);
  if (prototype !== CapturedObjectPrototypeV1 && prototype !== null) {
    throw new CapturedTypeErrorV1(
      "prepared Runtime input must use a plain prototype",
    );
  }
  const ownKeys = CapturedReflectOwnKeysV1(input);
  if (ownKeys.length !== PREPARED_RUNTIME_INPUT_KEYS_V1.length) {
    throw new CapturedTypeErrorV1(
      "prepared Runtime input must have exactly sixteen fields",
    );
  }
  for (let index = 0; index < PREPARED_RUNTIME_INPUT_KEYS_V1.length; index += 1) {
    const key = PREPARED_RUNTIME_INPUT_KEYS_V1[index]!;
    if (ownKeys[index] !== key) {
      throw new CapturedTypeErrorV1(
        "prepared Runtime input fields are not in their exact order",
      );
    }
    const descriptor = CapturedObjectGetOwnPropertyDescriptorV1(input, key);
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      throw new CapturedTypeErrorV1(
        "prepared Runtime input fields must be enumerable own data",
      );
    }
  }
}

function hasRegistryClosureAuthorityV1(
  closure: ProviderRegistryManifestHistoryValidationV1,
): boolean {
  if (!CapturedObjectIsFrozenV1(closure)) return false;
  const descriptor = CapturedObjectGetOwnPropertyDescriptorV1(
    closure,
    "authority",
  );
  return (
    descriptor !== undefined &&
    "value" in descriptor &&
    descriptor.enumerable === true &&
    descriptor.value === "none_registry_structure_and_history_only"
  );
}

function preparedPointFailureV1(
  stage: ProviderRuntimeAttestationPointInvalidStageV1,
  reason: ProviderRuntimeAttestationPointInvalidReasonV1,
): ProviderRuntimeAttestationPointClosureDiagnosticResultV1 {
  return createProviderNonThenableFrozenRecordV1({
    ok: false as const,
    stage,
    reason,
  });
}

function regExpExecV1(pattern: RegExp, value: string): RegExpExecArray | null {
  return CapturedReflectApplyV1(CapturedRegExpPrototypeExecV1, pattern, [
    value,
  ]) as RegExpExecArray | null;
}

function stringSliceV1(value: string, start: number, end?: number): string {
  return CapturedReflectApplyV1(CapturedStringPrototypeSliceV1, value, [
    start,
    end,
  ]) as string;
}

function stringIndexOfV1(value: string, search: string): number {
  return CapturedReflectApplyV1(CapturedStringPrototypeIndexOfV1, value, [
    search,
  ]) as number;
}

const REGISTRY_SIGNATURE_PATTERN_V1 =
  /^provider-registry-ed25519:([0-9a-f]{22}):([0-9a-f]{128})$/u;
const BASE64URL_PREFIX_V1 = "base64url:";
const BASE64URL_ALPHABET_V1 =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function lowerHexToBytesV1(hex: string): Uint8Array {
  if (hex.length === 0 || hex.length % 2 !== 0) {
    throw new CapturedTypeErrorV1("signature is not lowercase octets");
  }
  const bytes = new CapturedUint8ArrayV1(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    const octet = stringSliceV1(hex, index * 2, index * 2 + 2);
    if (regExpExecV1(/^[0-9a-f]{2}$/u, octet) === null) {
      throw new CapturedTypeErrorV1("signature is not lowercase octets");
    }
    bytes[index] = CapturedNumberParseIntV1(octet, 16);
  }
  return bytes;
}

function decodeCanonicalPublicKeyBytes32V1(value: string): Uint8Array {
  if (stringSliceV1(value, 0, BASE64URL_PREFIX_V1.length) !== BASE64URL_PREFIX_V1) {
    throw new CapturedTypeErrorV1("public key bytes have the wrong prefix");
  }
  const body = stringSliceV1(value, BASE64URL_PREFIX_V1.length);
  const decoded = new CapturedUint8ArrayV1(32);
  let accumulator = 0;
  let availableBits = 0;
  let offset = 0;
  for (let index = 0; index < body.length; index += 1) {
    const digit = stringIndexOfV1(
      BASE64URL_ALPHABET_V1,
      stringSliceV1(body, index, index + 1),
    );
    if (digit < 0) {
      throw new CapturedTypeErrorV1("public key bytes are not base64url");
    }
    accumulator = (accumulator << 6) | digit;
    availableBits += 6;
    if (availableBits >= 8) {
      availableBits -= 8;
      if (offset >= decoded.byteLength) {
        throw new CapturedTypeErrorV1("public key bytes exceed raw32");
      }
      decoded[offset] = (accumulator >>> availableBits) & 0xff;
      offset += 1;
      accumulator &= (1 << availableBits) - 1;
    }
  }
  if (offset !== 32 || availableBits !== 2 || accumulator !== 0) {
    throw new CapturedTypeErrorV1("public key bytes are not canonical raw32");
  }
  return decoded;
}

async function admitPreparedActiveRootV1(
  input: ValidateProviderRuntimeAttestationPointClosureV1Input,
): Promise<ProviderRegistryRootPublicKeyV1> {
  const activeRoot = input.activeRoot as ProviderRegistryRootPublicKeyV1;
  try {
    const accepted = await validateProviderStrictEd25519PointWithCapabilityV1(
      input.strictCryptoCapability,
      decodeCanonicalPublicKeyBytes32V1(activeRoot.publicKeyBytes),
    );
    if (!accepted) {
      throw new CapturedTypeErrorV1("active root point is not admitted");
    }
  } catch {
    throw new CapturedTypeErrorV1("prepared active root admission failed");
  }
  return activeRoot;
}

async function verifyPreparedRuntimeSignatureV1(
  input: ValidateProviderRuntimeAttestationPointClosureV1Input,
  activeRoot: ProviderRegistryRootPublicKeyV1,
): Promise<ProviderRuntimeAttestationPointClosureDiagnosticResultV1 | undefined> {
  const runtime = input.runtimeAttestation
    .payload as StoreDurableObjectProviderRuntimeAttestationV1;
  const match = regExpExecV1(
    REGISTRY_SIGNATURE_PATTERN_V1,
    runtime.registrySignature,
  );
  if (match?.[1] === undefined || match[2] === undefined) {
    return preparedPointFailureV1("runtime_structure", "schema_invalid");
  }
  if (match[1] !== activeRoot.rootKeyId) {
    return preparedPointFailureV1("runtime_root", "root_mismatch");
  }
  let message: Uint8Array;
  try {
    message =
      createStoreDurableObjectProviderRuntimeAttestationSignatureMessageV1(
        runtime,
        activeRoot.rootKeyId,
      );
  } catch {
    return preparedPointFailureV1("runtime_root", "root_mismatch");
  }
  try {
    const accepted = await verifyRawEd25519WithCapabilityV1(
      input.strictCryptoCapability,
      decodeCanonicalPublicKeyBytes32V1(activeRoot.publicKeyBytes),
      message,
      lowerHexToBytesV1(match[2]),
    );
    if (!accepted) {
      return preparedPointFailureV1(
        "runtime_signature",
        "signature_invalid",
      );
    }
  } catch {
    return preparedPointFailureV1("runtime_signature", "signature_invalid");
  }
  return undefined;
}

export function registerProviderRuntimeAttestationPreparedCoreInternalV1(
  core: PreparedRuntimeCoreV1,
): void {
  if (preparedRuntimeCoreV1 !== undefined) {
    throw new CapturedTypeErrorV1(
      "prepared Runtime attestation core is already registered",
    );
  }
  preparedRuntimeCoreV1 = CapturedObjectFreezeV1(core);
}

/**
 * Runs the Runtime core over an exact, already-detached input without taking a
 * second snapshot. Unlike the Registry-history reuse entry below, this entry
 * establishes its own root admission and verifies the Runtime root signature;
 * it therefore carries no trust forward from a Registry witness.
 */
export function diagnoseProviderRuntimeAttestationPointPreparedInternalV1(
  input: ValidateProviderRuntimeAttestationPointClosureV1Input,
): Promise<ProviderRuntimeAttestationPointClosureDiagnosticResultV1> {
  const operation = (async () => {
    const copyLedger = createProviderRegistryPreparedCopyLedgerInternalV1();
    try {
      assertExactPreparedRuntimeInputV1(input);
      assertProviderStrictEd25519CryptoCapabilityIdentityV1(
        ProviderStrictEd25519AttestationError,
        input.strictCryptoCapability,
      );
    } catch {
      return preparedPointFailureV1("input", "schema_invalid");
    }

    let activeRoot: ProviderRegistryRootPublicKeyV1;
    try {
      activeRoot = await admitPreparedActiveRootV1(input);
    } catch {
      return preparedPointFailureV1(
        "conformance_result_closure",
        "source_invalid",
      );
    }

    if (preparedRuntimeCoreV1 === undefined) {
      return preparedPointFailureV1("input", "schema_invalid");
    }
    const context = createPreparedDistributionVerificationContextInternalV1(
      input.strictCryptoCapability,
      input.activeRoot,
      copyLedger,
    );
    let diagnostic: ProviderRuntimeAttestationPointClosureDiagnosticResultV1;
    try {
      diagnostic = await hardenProviderPointPromiseV1(
        preparedRuntimeCoreV1(input, context),
      );
    } catch {
      return preparedPointFailureV1("input", "schema_invalid");
    }
    const sourceSignatureVerificationPrefix =
      readPreparedDistributionSignatureVerificationCountInternalV1(context);
    if (!diagnostic.ok) {
      return preparedPointFailureV1(diagnostic.stage, diagnostic.reason);
    }
    if (sourceSignatureVerificationPrefix !== 6) {
      return preparedPointFailureV1(
        "conformance_result_closure",
        "source_invalid",
      );
    }

    const runtimeSignatureFailure = await verifyPreparedRuntimeSignatureV1(
      input,
      activeRoot,
    );
    if (runtimeSignatureFailure !== undefined) {
      return runtimeSignatureFailure;
    }
    return createProviderNonThenableFrozenRecordV1({
      ok: true as const,
      value: diagnostic.value,
    });
  })();
  const hardenedOperation = hardenProviderPointPromiseV1(operation);
  return hardenedOperation.then(
    (diagnostic) => diagnostic,
    () => preparedPointFailureV1("input", "schema_invalid"),
  );
}

export async function diagnoseProviderRuntimeAttestationPointFromRegistryHistoryInternalV1(
  input: ValidateProviderRuntimeAttestationPointClosureV1Input,
  registryManifestHistoryClosure:
    ProviderRegistryManifestHistoryValidationV1,
  registryTrustWitnessHandle: RegistryTrustWitnessHandleV1,
  selectedProviderId: DurableObjectIdentityProviderIdV1,
  selectedRegistryEntryContentDigest: ContentDigestV1,
  capabilityIdentity: ProviderStrictEd25519OpaqueCapabilityV1,
): Promise<ProviderRuntimeAttestationHistoryReuseDiagnosticResultV1> {
  const copyLedger = createProviderRegistryPreparedCopyLedgerInternalV1();
  let witness;
  try {
    // take performs has -> get -> delete before comparing handle/capability, so
    // every exact-closure invocation is one-shot even on a wrong token.
    witness = takeRegistryHistoryVerifiedWitnessInternalV1(
      registryManifestHistoryClosure,
      registryTrustWitnessHandle,
      capabilityIdentity,
    );
  } catch {
    return preparedFailureV1("input", "schema_invalid", 0, copyLedger);
  }
  if (witness === undefined) {
    return preparedFailureV1("input", "schema_invalid", 0, copyLedger);
  }

  try {
    assertExactPreparedRuntimeInputV1(input);
  } catch {
    return preparedFailureV1("input", "schema_invalid", 0, copyLedger);
  }
  if (
    !hasRegistryClosureAuthorityV1(registryManifestHistoryClosure) ||
    input.strictCryptoCapability !== capabilityIdentity ||
    witness.strictCryptoCapability !== capabilityIdentity
  ) {
    return preparedFailureV1("input", "schema_invalid", 0, copyLedger);
  }
  if (input.activeRoot !== witness.suppliedHistoryTipRoot) {
    return preparedFailureV1("runtime_root", "root_mismatch", 0, copyLedger);
  }

  let verifiedSelectedEntry: RegistryHistoryVerifiedTipEntryV1 | undefined;
  for (let index = 0; index < witness.verifiedTipEntries.length; index += 1) {
    const candidate = witness.verifiedTipEntries[index]!;
    if (
      candidate.providerId === selectedProviderId &&
      candidate.registryEntryContentDigest ===
        selectedRegistryEntryContentDigest
    ) {
      if (verifiedSelectedEntry !== undefined) {
        return preparedFailureV1(
          "runtime_result_binding",
          "binding_mismatch",
          0,
          copyLedger,
        );
      }
      verifiedSelectedEntry = candidate;
    }
  }
  if (
    verifiedSelectedEntry === undefined ||
    verifiedSelectedEntry.runtimeAttestation !== input.runtimeAttestation
  ) {
    return preparedFailureV1(
      "runtime_result_binding",
      "binding_mismatch",
      0,
      copyLedger,
    );
  }
  if (preparedRuntimeCoreV1 === undefined) {
    return preparedFailureV1("input", "schema_invalid", 0, copyLedger);
  }

  const context = createPreparedDistributionVerificationContextInternalV1(
    capabilityIdentity,
    witness.suppliedHistoryTipRoot,
    copyLedger,
  );
  let diagnostic: ProviderRuntimeAttestationPointClosureDiagnosticResultV1;
  try {
    diagnostic = await preparedRuntimeCoreV1(input, context);
  } catch {
    return preparedFailureV1(
      "input",
      "schema_invalid",
      readPreparedDistributionSignatureVerificationCountInternalV1(context),
      copyLedger,
    );
  }
  const sourceSignatureVerificationPrefix =
    readPreparedDistributionSignatureVerificationCountInternalV1(context);
  if (!diagnostic.ok) {
    return preparedFailureV1(
      diagnostic.stage,
      diagnostic.reason,
      sourceSignatureVerificationPrefix,
      copyLedger,
    );
  }
  if (sourceSignatureVerificationPrefix !== 6) {
    return preparedFailureV1(
      "conformance_result_closure",
      "source_invalid",
      sourceSignatureVerificationPrefix,
      copyLedger,
    );
  }

  const value = createFrozenRecordV1<
    ProviderRuntimeAttestationHistoryReuseTrustResultV1
  >([
    ["runtimeAttestationPointClosure", diagnostic.value],
    [
      "historicallyVerifiedApproverPublicKeys",
      verifiedSelectedEntry.historicallyVerifiedApproverPublicKeys,
    ],
    ["suppliedHistoryTipRoot", witness.suppliedHistoryTipRoot],
    ["verifiedSelectedEntry", verifiedSelectedEntry],
    ["copyLedger", copyLedger],
  ]);
  return createFrozenRecordV1<PreparedRuntimeDiagnosticSuccessV1>([
    ["ok", true],
    ["value", value],
    ["sourceSignatureVerificationPrefix", 6],
    ["copyLedger", copyLedger],
  ]);
}

CapturedObjectFreezeV1(registerProviderRuntimeAttestationPreparedCoreInternalV1);
CapturedObjectFreezeV1(
  diagnoseProviderRuntimeAttestationPointPreparedInternalV1,
);
CapturedObjectFreezeV1(
  diagnoseProviderRuntimeAttestationPointFromRegistryHistoryInternalV1,
);
