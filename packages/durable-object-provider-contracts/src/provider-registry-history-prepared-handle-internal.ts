/**
 * Package-private handles and callback registrations for the C09-1L prepared
 * Registry path.  The side-effect bridge lives in the sibling
 * `provider-registry-history-prepared-internal.ts` module.
 *
 * Authority is carried by exact request/closure identity, a fresh opaque
 * one-shot handle, and the original strict-crypto capability identity.  None
 * of the symbols in this module are re-exported by the package.
 */

import type { ProviderBootstrapTrustBundleV1 } from "./bootstrap-trust-bundle.js";
import type {
  ContentDigestV1,
  DurableObjectIdentityProviderIdV1,
  InstallationIdentityGenerationIdV1,
  ProviderRegistryManifestGenerationIdV1,
} from "./primitives.js";
import type { ProviderRegistryManifestHistoryValidationV1 } from "./provider-registry-manifest-history.js";
import type { ProviderRegistryRootMetadataHistoryValidationV1 } from "./provider-registry-root-history.js";
import type {
  ProviderFeasibilityApproverPublicKeyV1,
  ProviderRegistryManifestEnvelopeV1,
  StoreDurableObjectProviderRuntimeAttestationPinV1,
} from "./provider-registry-records.js";
import type {
  ProviderRegistryRootMetadataEnvelopeV1,
  ProviderRegistryRootPublicKeyV1,
} from "./provider-registry-trust.js";
import type { ProviderStrictEd25519OpaqueCapabilityV1 } from "./strict-ed25519-conformance.js";

const CapturedObjectCreateV1 = Object.create;
const CapturedObjectDefinePropertyV1 = Object.defineProperty;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedObjectGetOwnPropertyDescriptorV1 =
  Object.getOwnPropertyDescriptor;
const CapturedObjectGetPrototypeOfV1 = Object.getPrototypeOf;
const CapturedObjectIsFrozenV1 = Object.isFrozen;
const CapturedObjectPrototypeV1 = Object.prototype;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedReflectOwnKeysV1 = Reflect.ownKeys;
const CapturedFunctionPrototypeBindV1 = Function.prototype.bind;
const CapturedFunctionPrototypeCallV1 = Function.prototype.call;
const CapturedWeakMapV1 = WeakMap;
const CapturedWeakMapDeleteV1 = CapturedWeakMapV1.prototype.delete;
const CapturedWeakMapGetV1 = CapturedWeakMapV1.prototype.get;
const CapturedWeakMapHasV1 = CapturedWeakMapV1.prototype.has;
const CapturedWeakMapSetV1 = CapturedWeakMapV1.prototype.set;
const CapturedTypeErrorV1 = TypeError;

function bindUncurriedAtBootstrapV1(method: Function): Function {
  const argumentsList = CapturedObjectFreezeV1([method]);
  return CapturedObjectFreezeV1(
    CapturedReflectApplyV1(
      CapturedFunctionPrototypeBindV1,
      CapturedFunctionPrototypeCallV1,
      argumentsList,
    ) as Function,
  );
}

const weakMapDeleteV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapDeleteV1,
) as <T>(map: WeakMap<object, T>, key: object) => boolean;
const weakMapGetV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapGetV1,
) as <T>(map: WeakMap<object, T>, key: object) => T | undefined;
const weakMapHasV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapHasV1,
) as <T>(map: WeakMap<object, T>, key: object) => boolean;
const weakMapSetV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapSetV1,
) as <T>(map: WeakMap<object, T>, key: object, value: T) => void;

const PREPARED_REGISTRY_REQUEST_KEYS_V1 = CapturedObjectFreezeV1([
  "bootstrapTrustBundle",
  "installationIdentityGenerationId",
  "registryManifestHistory",
  "rootMetadataHistory",
  "strictCryptoCapability",
] as const);

declare const PreparedRegistryHistoryInputHandleBrandV1: unique symbol;
declare const RegistryTrustWitnessHandleBrandV1: unique symbol;

/** Fresh opaque token paired with one exact five-field Registry request. */
export type PreparedRegistryHistoryInputHandleV1 = Readonly<
  Record<never, never>
> & {
  readonly [PreparedRegistryHistoryInputHandleBrandV1]: true;
};

/** Fresh opaque token paired with one exact successful Registry closure. */
export type RegistryTrustWitnessHandleV1 = Readonly<Record<never, never>> & {
  readonly [RegistryTrustWitnessHandleBrandV1]: true;
};

export interface ProviderRegistryPreparedCopyLedgerV1 {
  readonly preparedHistorySnapshotAttemptCount: 0;
  readonly retainedParallelHistoryGraphCount: 0;
  readonly nestedPreparedSnapshotAttemptCount: 0;
}

/** The detached five-field Registry source plus its private copy ledger. */
export interface PreparedRegistryHistorySnapshotV1 {
  readonly installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  readonly bootstrapTrustBundle: ProviderBootstrapTrustBundleV1;
  readonly rootMetadataHistory: readonly ProviderRegistryRootMetadataEnvelopeV1[];
  readonly registryManifestHistory: readonly ProviderRegistryManifestEnvelopeV1[];
  readonly strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1;
  readonly copyLedger: ProviderRegistryPreparedCopyLedgerV1;
}

export interface RegistryHistoryVerifiedTipEntryV1 {
  readonly providerId: DurableObjectIdentityProviderIdV1;
  readonly registryEntryContentDigest: ContentDigestV1;
  readonly runtimeAttestation: StoreDurableObjectProviderRuntimeAttestationPinV1;
  readonly historicallyVerifiedApproverPublicKeys: readonly ProviderFeasibilityApproverPublicKeyV1[];
}

/**
 * Crypto facts proved by the same supplied-history invocation.  The arrays
 * retain only exact detached record references; they are not a second history
 * object graph.
 */
export interface RegistryHistoryVerifiedCryptoWitnessV1 {
  readonly strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1;
  readonly suppliedHistoryTipRoot: ProviderRegistryRootPublicKeyV1;
  readonly tipManifestGenerationId: ProviderRegistryManifestGenerationIdV1;
  readonly tipManifestContentDigest: ContentDigestV1;
  readonly verifiedTipEntries: readonly RegistryHistoryVerifiedTipEntryV1[];
}

export type ValidateProviderRegistryRootMetadataHistoryPreparedInternalV1Input =
  Pick<
    PreparedRegistryHistorySnapshotV1,
    | "bootstrapTrustBundle"
    | "rootMetadataHistory"
    | "strictCryptoCapability"
    | "copyLedger"
  >;

export type RegistryManifestHistoryPreparedStageInternalV1 =
  | "history_input"
  | "history_limit"
  | "root_history"
  | "manifest_envelope"
  | "root_binding"
  | "manifest_predecessor"
  | "manifest_signature"
  | "member_set"
  | "registry_entry"
  | "record_signature"
  | "key_admission"
  | "key_history"
  | "material_closure"
  | "routing";

export type RegistryManifestHistoryPreparedReasonInternalV1 =
  | "schema_invalid"
  | "history_empty"
  | "history_generation_limit_exceeded"
  | "envelope_byte_limit_exceeded"
  | "history_total_byte_limit_exceeded"
  | "root_history_invalid"
  | "envelope_mismatch"
  | "root_pin_mismatch"
  | "root_generation_rollback"
  | "generation_not_contiguous"
  | "predecessor_pin_mismatch"
  | "signature_invalid"
  | "member_order_invalid"
  | "member_transition_invalid"
  | "entry_mismatch"
  | "entry_successor_invalid"
  | "record_history_invalid"
  | "active_record_invalid"
  | "revocation_invalid"
  | "point_admission_failed"
  | "public_key_material_alias"
  | "routing_invalid";

export interface ProviderRegistryManifestHistoryPreparedValidationInternalV1 {
  readonly closure: ProviderRegistryManifestHistoryValidationV1;
  readonly registryTrustWitnessHandle: RegistryTrustWitnessHandleV1;
  readonly copyLedger: ProviderRegistryPreparedCopyLedgerV1;
}

interface ProviderRegistryManifestHistoryPreparedDiagnosticFailureInternalV1 {
  readonly ok: false;
  readonly stage: RegistryManifestHistoryPreparedStageInternalV1;
  readonly reason: RegistryManifestHistoryPreparedReasonInternalV1;
}

interface ProviderRegistryManifestHistoryPreparedDiagnosticSuccessInternalV1 {
  readonly ok: true;
  readonly value: ProviderRegistryManifestHistoryPreparedValidationInternalV1;
}

export type ProviderRegistryManifestHistoryPreparedDiagnosticResultInternalV1 =
  | ProviderRegistryManifestHistoryPreparedDiagnosticSuccessInternalV1
  | ProviderRegistryManifestHistoryPreparedDiagnosticFailureInternalV1;

type ProviderRegistryRootHistoryPreparedValidatorInternalV1 = (
  input: ValidateProviderRegistryRootMetadataHistoryPreparedInternalV1Input,
) => Promise<ProviderRegistryRootMetadataHistoryValidationV1>;

type ProviderRegistryManifestHistoryPreparedValidatorInternalV1 = (
  requestIdentity: unknown,
  inputHandle: PreparedRegistryHistoryInputHandleV1,
  capabilityIdentity: ProviderStrictEd25519OpaqueCapabilityV1,
) => Promise<ProviderRegistryManifestHistoryPreparedDiagnosticResultInternalV1>;

interface PreparedRegistryHistoryMapEntryV1 {
  readonly handle: PreparedRegistryHistoryInputHandleV1;
  readonly capabilityIdentity: ProviderStrictEd25519OpaqueCapabilityV1;
  readonly snapshot: PreparedRegistryHistorySnapshotV1;
}

interface RegistryHistoryWitnessMapEntryV1 {
  readonly handle: RegistryTrustWitnessHandleV1;
  readonly capabilityIdentity: ProviderStrictEd25519OpaqueCapabilityV1;
  readonly witness: RegistryHistoryVerifiedCryptoWitnessV1;
}

const preparedRegistryHistorySnapshotsV1 = new CapturedWeakMapV1<
  object,
  PreparedRegistryHistoryMapEntryV1
>();
const registryHistoryVerifiedWitnessesV1 = new CapturedWeakMapV1<
  ProviderRegistryManifestHistoryValidationV1,
  RegistryHistoryWitnessMapEntryV1
>();

let providerRegistryRootHistoryPreparedValidatorInternalV1:
  | ProviderRegistryRootHistoryPreparedValidatorInternalV1
  | undefined;
let providerRegistryManifestHistoryPreparedValidatorInternalV1:
  | ProviderRegistryManifestHistoryPreparedValidatorInternalV1
  | undefined;

function isObjectIdentityV1(value: unknown): value is object {
  return (
    value !== null &&
    (typeof value === "object" || typeof value === "function")
  );
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

function createOpaqueHandleV1<T extends object>(): T {
  return CapturedObjectFreezeV1(CapturedObjectCreateV1(null)) as T;
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

function readExactRequestFieldsV1(
  requestIdentity: object,
): Readonly<Record<string, unknown>> {
  const prototype = CapturedObjectGetPrototypeOfV1(requestIdentity);
  if (
    prototype !== CapturedObjectPrototypeV1 &&
    prototype !== null
  ) {
    throw new CapturedTypeErrorV1(
      "prepared Registry request must use a plain prototype",
    );
  }
  if (!CapturedObjectIsFrozenV1(requestIdentity)) {
    throw new CapturedTypeErrorV1("prepared Registry request must be frozen");
  }
  const ownKeys = CapturedReflectOwnKeysV1(requestIdentity);
  if (ownKeys.length !== PREPARED_REGISTRY_REQUEST_KEYS_V1.length) {
    throw new CapturedTypeErrorV1(
      "prepared Registry request must have exactly five fields",
    );
  }
  for (let keyIndex = 0; keyIndex < ownKeys.length; keyIndex += 1) {
    const ownKey = ownKeys[keyIndex];
    let expected = false;
    for (
      let expectedIndex = 0;
      expectedIndex < PREPARED_REGISTRY_REQUEST_KEYS_V1.length;
      expectedIndex += 1
    ) {
      if (ownKey === PREPARED_REGISTRY_REQUEST_KEYS_V1[expectedIndex]) {
        expected = true;
        break;
      }
    }
    if (!expected) {
      throw new CapturedTypeErrorV1(
        "prepared Registry request must have exactly the five allowed fields",
      );
    }
  }
  const fields = CapturedObjectCreateV1(null) as Record<string, unknown>;
  for (
    let index = 0;
    index < PREPARED_REGISTRY_REQUEST_KEYS_V1.length;
    index += 1
  ) {
    const key = PREPARED_REGISTRY_REQUEST_KEYS_V1[index]!;
    const descriptor = CapturedObjectGetOwnPropertyDescriptorV1(
      requestIdentity,
      key,
    );
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      throw new CapturedTypeErrorV1(
        "prepared Registry request fields must be enumerable own data",
      );
    }
    defineFrozenEnumerableDataV1(fields, key, descriptor.value);
  }
  return CapturedObjectFreezeV1(fields);
}

export function createProviderRegistryPreparedCopyLedgerInternalV1(): ProviderRegistryPreparedCopyLedgerV1 {
  return createFrozenRecordV1<ProviderRegistryPreparedCopyLedgerV1>([
    ["preparedHistorySnapshotAttemptCount", 0],
    ["retainedParallelHistoryGraphCount", 0],
    ["nestedPreparedSnapshotAttemptCount", 0],
  ]);
}

export function createPreparedRegistryHistorySnapshotInternalV1(
  fields: Omit<PreparedRegistryHistorySnapshotV1, "copyLedger">,
): PreparedRegistryHistorySnapshotV1 {
  return createFrozenRecordV1<PreparedRegistryHistorySnapshotV1>([
    ["installationIdentityGenerationId", fields.installationIdentityGenerationId],
    ["bootstrapTrustBundle", fields.bootstrapTrustBundle],
    ["rootMetadataHistory", fields.rootMetadataHistory],
    ["registryManifestHistory", fields.registryManifestHistory],
    ["strictCryptoCapability", fields.strictCryptoCapability],
    ["copyLedger", createProviderRegistryPreparedCopyLedgerInternalV1()],
  ]);
}

export function assertProviderRegistryPreparedCopyLedgerZeroInternalV1(
  ledger: ProviderRegistryPreparedCopyLedgerV1,
): void {
  if (
    ledger.preparedHistorySnapshotAttemptCount !== 0 ||
    ledger.retainedParallelHistoryGraphCount !== 0 ||
    ledger.nestedPreparedSnapshotAttemptCount !== 0
  ) {
    throw new CapturedTypeErrorV1(
      "prepared Registry path attempted a forbidden history copy",
    );
  }
}

export function registerProviderRegistryRootHistoryPreparedValidatorInternalV1(
  validatorIdentity: ProviderRegistryRootHistoryPreparedValidatorInternalV1,
): void {
  if (
    typeof validatorIdentity !== "function" ||
    providerRegistryRootHistoryPreparedValidatorInternalV1 !== undefined
  ) {
    throw new CapturedTypeErrorV1(
      "prepared Root-history validator registration is invalid",
    );
  }
  CapturedObjectFreezeV1(validatorIdentity);
  providerRegistryRootHistoryPreparedValidatorInternalV1 = validatorIdentity;
}

export function validateProviderRegistryRootMetadataHistoryPreparedInternalV1(
  input: ValidateProviderRegistryRootMetadataHistoryPreparedInternalV1Input,
): Promise<ProviderRegistryRootMetadataHistoryValidationV1> {
  const validator = providerRegistryRootHistoryPreparedValidatorInternalV1;
  if (validator === undefined) {
    throw new CapturedTypeErrorV1(
      "prepared Root-history validator is not registered",
    );
  }
  return validator(input);
}

export function registerProviderRegistryManifestHistoryPreparedValidatorInternalV1(
  validatorIdentity: ProviderRegistryManifestHistoryPreparedValidatorInternalV1,
): void {
  if (
    typeof validatorIdentity !== "function" ||
    providerRegistryManifestHistoryPreparedValidatorInternalV1 !== undefined
  ) {
    throw new CapturedTypeErrorV1(
      "prepared Registry-history validator registration is invalid",
    );
  }
  CapturedObjectFreezeV1(validatorIdentity);
  providerRegistryManifestHistoryPreparedValidatorInternalV1 =
    validatorIdentity;
}

export function diagnoseProviderRegistryManifestHistoryPreparedInternalV1(
  requestIdentity: unknown,
  inputHandle: PreparedRegistryHistoryInputHandleV1,
  capabilityIdentity: ProviderStrictEd25519OpaqueCapabilityV1,
): Promise<ProviderRegistryManifestHistoryPreparedDiagnosticResultInternalV1> {
  const validator = providerRegistryManifestHistoryPreparedValidatorInternalV1;
  if (validator === undefined) {
    throw new CapturedTypeErrorV1(
      "prepared Registry-history validator is not registered",
    );
  }
  return validator(requestIdentity, inputHandle, capabilityIdentity);
}

export function registerPreparedRegistryHistoryInputInternalV1(
  requestIdentity: object,
  snapshot: PreparedRegistryHistorySnapshotV1,
  capabilityIdentity: ProviderStrictEd25519OpaqueCapabilityV1,
): PreparedRegistryHistoryInputHandleV1 {
  if (weakMapHasV1(preparedRegistryHistorySnapshotsV1, requestIdentity)) {
    throw new CapturedTypeErrorV1(
      "prepared Registry request is already registered",
    );
  }
  const fields = readExactRequestFieldsV1(requestIdentity);
  if (
    fields.installationIdentityGenerationId !==
      snapshot.installationIdentityGenerationId ||
    fields.bootstrapTrustBundle !== snapshot.bootstrapTrustBundle ||
    fields.rootMetadataHistory !== snapshot.rootMetadataHistory ||
    fields.registryManifestHistory !== snapshot.registryManifestHistory ||
    fields.strictCryptoCapability !== capabilityIdentity ||
    snapshot.strictCryptoCapability !== capabilityIdentity
  ) {
    throw new CapturedTypeErrorV1(
      "prepared Registry request does not match its detached snapshot",
    );
  }
  assertProviderRegistryPreparedCopyLedgerZeroInternalV1(snapshot.copyLedger);
  const handle =
    createOpaqueHandleV1<PreparedRegistryHistoryInputHandleV1>();
  const entry = createFrozenRecordV1<PreparedRegistryHistoryMapEntryV1>([
    ["handle", handle],
    ["capabilityIdentity", capabilityIdentity],
    ["snapshot", snapshot],
  ]);
  weakMapSetV1(preparedRegistryHistorySnapshotsV1, requestIdentity, entry);
  return handle;
}

/** Atomically has/get/deletes one prepared request before checking its bindings. */
export function takePreparedRegistryHistoryInputInternalV1(
  requestIdentity: unknown,
  handle: PreparedRegistryHistoryInputHandleV1,
  capabilityIdentity: ProviderStrictEd25519OpaqueCapabilityV1,
): PreparedRegistryHistorySnapshotV1 | undefined {
  if (!isObjectIdentityV1(requestIdentity)) return undefined;
  if (!weakMapHasV1(preparedRegistryHistorySnapshotsV1, requestIdentity)) {
    return undefined;
  }
  const entry = weakMapGetV1(
    preparedRegistryHistorySnapshotsV1,
    requestIdentity,
  );
  if (
    entry === undefined ||
    !weakMapDeleteV1(preparedRegistryHistorySnapshotsV1, requestIdentity)
  ) {
    throw new CapturedTypeErrorV1(
      "prepared Registry request state is inconsistent",
    );
  }
  if (
    entry.handle !== handle ||
    entry.capabilityIdentity !== capabilityIdentity ||
    entry.snapshot.strictCryptoCapability !== capabilityIdentity
  ) {
    return undefined;
  }
  assertProviderRegistryPreparedCopyLedgerZeroInternalV1(
    entry.snapshot.copyLedger,
  );
  return entry.snapshot;
}

export function discardPreparedRegistryHistoryInputInternalV1(
  requestIdentity: unknown,
  handle: PreparedRegistryHistoryInputHandleV1,
  capabilityIdentity: ProviderStrictEd25519OpaqueCapabilityV1,
): boolean {
  if (!isObjectIdentityV1(requestIdentity)) return false;
  if (!weakMapHasV1(preparedRegistryHistorySnapshotsV1, requestIdentity)) {
    return false;
  }
  const entry = weakMapGetV1(
    preparedRegistryHistorySnapshotsV1,
    requestIdentity,
  );
  if (
    entry === undefined ||
    entry.handle !== handle ||
    entry.capabilityIdentity !== capabilityIdentity
  ) {
    return false;
  }
  return weakMapDeleteV1(preparedRegistryHistorySnapshotsV1, requestIdentity);
}

export function createRegistryHistoryVerifiedCryptoWitnessInternalV1(
  fields: RegistryHistoryVerifiedCryptoWitnessV1,
): RegistryHistoryVerifiedCryptoWitnessV1 {
  if (!CapturedObjectIsFrozenV1(fields.verifiedTipEntries)) {
    throw new CapturedTypeErrorV1(
      "prepared Registry witness indexes must be frozen",
    );
  }
  for (let index = 0; index < fields.verifiedTipEntries.length; index += 1) {
    const entry = fields.verifiedTipEntries[index]!;
    if (
      !CapturedObjectIsFrozenV1(entry) ||
      !CapturedObjectIsFrozenV1(
        entry.historicallyVerifiedApproverPublicKeys,
      )
    ) {
      throw new CapturedTypeErrorV1(
        "prepared Registry witness Entry indexes must be frozen",
      );
    }
  }
  return createFrozenRecordV1<RegistryHistoryVerifiedCryptoWitnessV1>([
    ["strictCryptoCapability", fields.strictCryptoCapability],
    ["suppliedHistoryTipRoot", fields.suppliedHistoryTipRoot],
    ["tipManifestGenerationId", fields.tipManifestGenerationId],
    ["tipManifestContentDigest", fields.tipManifestContentDigest],
    ["verifiedTipEntries", fields.verifiedTipEntries],
  ]);
}

export function registerRegistryHistoryVerifiedWitnessInternalV1(
  closureIdentity: ProviderRegistryManifestHistoryValidationV1,
  witness: RegistryHistoryVerifiedCryptoWitnessV1,
  capabilityIdentity: ProviderStrictEd25519OpaqueCapabilityV1,
): RegistryTrustWitnessHandleV1 {
  if (!CapturedObjectIsFrozenV1(closureIdentity)) {
    throw new CapturedTypeErrorV1(
      "prepared Registry closure identity must be frozen",
    );
  }
  if (
    witness.strictCryptoCapability !== capabilityIdentity ||
    !CapturedObjectIsFrozenV1(witness)
  ) {
    throw new CapturedTypeErrorV1(
      "prepared Registry witness is not bound to its capability",
    );
  }
  if (weakMapHasV1(registryHistoryVerifiedWitnessesV1, closureIdentity)) {
    throw new CapturedTypeErrorV1(
      "prepared Registry witness is already registered",
    );
  }
  const handle = createOpaqueHandleV1<RegistryTrustWitnessHandleV1>();
  const entry = createFrozenRecordV1<RegistryHistoryWitnessMapEntryV1>([
    ["handle", handle],
    ["capabilityIdentity", capabilityIdentity],
    ["witness", witness],
  ]);
  weakMapSetV1(registryHistoryVerifiedWitnessesV1, closureIdentity, entry);
  return handle;
}

/** Atomically has/get/deletes one verified witness before checking bindings. */
export function takeRegistryHistoryVerifiedWitnessInternalV1(
  closureIdentity: unknown,
  handle: RegistryTrustWitnessHandleV1,
  capabilityIdentity: ProviderStrictEd25519OpaqueCapabilityV1,
): RegistryHistoryVerifiedCryptoWitnessV1 | undefined {
  if (!isObjectIdentityV1(closureIdentity)) return undefined;
  if (!weakMapHasV1(registryHistoryVerifiedWitnessesV1, closureIdentity)) {
    return undefined;
  }
  const entry = weakMapGetV1(
    registryHistoryVerifiedWitnessesV1,
    closureIdentity,
  );
  if (
    entry === undefined ||
    !weakMapDeleteV1(registryHistoryVerifiedWitnessesV1, closureIdentity)
  ) {
    throw new CapturedTypeErrorV1(
      "prepared Registry witness state is inconsistent",
    );
  }
  if (
    entry.handle !== handle ||
    entry.capabilityIdentity !== capabilityIdentity ||
    entry.witness.strictCryptoCapability !== capabilityIdentity
  ) {
    return undefined;
  }
  return entry.witness;
}

export function discardRegistryHistoryVerifiedWitnessInternalV1(
  closureIdentity: unknown,
  handle: RegistryTrustWitnessHandleV1,
  capabilityIdentity: ProviderStrictEd25519OpaqueCapabilityV1,
): boolean {
  if (!isObjectIdentityV1(closureIdentity)) return false;
  if (!weakMapHasV1(registryHistoryVerifiedWitnessesV1, closureIdentity)) {
    return false;
  }
  const entry = weakMapGetV1(
    registryHistoryVerifiedWitnessesV1,
    closureIdentity,
  );
  if (
    entry === undefined ||
    entry.handle !== handle ||
    entry.capabilityIdentity !== capabilityIdentity
  ) {
    return false;
  }
  return weakMapDeleteV1(registryHistoryVerifiedWitnessesV1, closureIdentity);
}

CapturedObjectFreezeV1(createProviderRegistryPreparedCopyLedgerInternalV1);
CapturedObjectFreezeV1(createPreparedRegistryHistorySnapshotInternalV1);
CapturedObjectFreezeV1(assertProviderRegistryPreparedCopyLedgerZeroInternalV1);
CapturedObjectFreezeV1(
  registerProviderRegistryRootHistoryPreparedValidatorInternalV1,
);
CapturedObjectFreezeV1(
  validateProviderRegistryRootMetadataHistoryPreparedInternalV1,
);
CapturedObjectFreezeV1(
  registerProviderRegistryManifestHistoryPreparedValidatorInternalV1,
);
CapturedObjectFreezeV1(
  diagnoseProviderRegistryManifestHistoryPreparedInternalV1,
);
CapturedObjectFreezeV1(registerPreparedRegistryHistoryInputInternalV1);
CapturedObjectFreezeV1(takePreparedRegistryHistoryInputInternalV1);
CapturedObjectFreezeV1(discardPreparedRegistryHistoryInputInternalV1);
CapturedObjectFreezeV1(createRegistryHistoryVerifiedCryptoWitnessInternalV1);
CapturedObjectFreezeV1(registerRegistryHistoryVerifiedWitnessInternalV1);
CapturedObjectFreezeV1(takeRegistryHistoryVerifiedWitnessInternalV1);
CapturedObjectFreezeV1(discardRegistryHistoryVerifiedWitnessInternalV1);
