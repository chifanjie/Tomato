/**
 * Package-private no-snapshot bridge shared by the prepared C09-I -> H -> G
 * -> F path.  Public point modules register their private semantic core here;
 * callers outside that prepared chain cannot manufacture the crypto context
 * because its mutable counter state is held only in the captured WeakMap.
 */

import type {
  ProviderRealFilesystemSourceClosureDiagnosticResultV1,
  ValidateProviderRealFilesystemSourceClosureV1Input,
} from "./provider-real-filesystem-source.js";
import {
  assertProviderRegistryPreparedCopyLedgerZeroInternalV1,
  type ProviderRegistryPreparedCopyLedgerV1,
} from "./provider-registry-history-prepared-handle-internal.js";
import type { ProviderRegistryRootPublicKeyV1 } from "./provider-registry-trust.js";
import type { ProviderStrictEd25519OpaqueCapabilityV1 } from "./strict-ed25519-conformance.js";

const CapturedObjectCreateV1 = Object.create;
const CapturedObjectDefinePropertyV1 = Object.defineProperty;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedWeakMapV1 = WeakMap;
const CapturedWeakMapGetV1 = CapturedWeakMapV1.prototype.get;
const CapturedWeakMapHasV1 = CapturedWeakMapV1.prototype.has;
const CapturedWeakMapSetV1 = CapturedWeakMapV1.prototype.set;
const CapturedFunctionPrototypeBindV1 = Function.prototype.bind;
const CapturedFunctionPrototypeCallV1 = Function.prototype.call;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedTypeErrorV1 = TypeError;

function bindUncurriedAtBootstrapV1(method: Function): Function {
  return CapturedObjectFreezeV1(
    CapturedReflectApplyV1(
      CapturedFunctionPrototypeBindV1,
      CapturedFunctionPrototypeCallV1,
      CapturedObjectFreezeV1([method]),
    ) as Function,
  );
}

const weakMapGetV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapGetV1,
) as <T>(map: WeakMap<object, T>, key: object) => T | undefined;
const weakMapHasV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapHasV1,
) as <T>(map: WeakMap<object, T>, key: object) => boolean;
const weakMapSetV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapSetV1,
) as <T>(map: WeakMap<object, T>, key: object, value: T) => void;

export interface PreparedDistributionVerificationContextV1 {
  readonly strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1;
  readonly verifiedActiveRoot: ProviderRegistryRootPublicKeyV1;
  readonly copyLedger: ProviderRegistryPreparedCopyLedgerV1;
}

interface PreparedDistributionVerificationStateV1 {
  signatureVerificationCount: number;
}

const preparedContextStatesV1 = new CapturedWeakMapV1<
  PreparedDistributionVerificationContextV1,
  PreparedDistributionVerificationStateV1
>();

type PreparedSourceCoreV1 = (
  input: ValidateProviderRealFilesystemSourceClosureV1Input,
  context: PreparedDistributionVerificationContextV1,
) => Promise<ProviderRealFilesystemSourceClosureDiagnosticResultV1>;

let preparedSourceCoreV1: PreparedSourceCoreV1 | undefined;

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

function requirePreparedContextStateV1(
  context: PreparedDistributionVerificationContextV1,
): PreparedDistributionVerificationStateV1 {
  if (!weakMapHasV1(preparedContextStatesV1, context)) {
    throw new CapturedTypeErrorV1(
      "prepared distribution verification context is not genuine",
    );
  }
  const state = weakMapGetV1(preparedContextStatesV1, context);
  if (state === undefined) {
    throw new CapturedTypeErrorV1(
      "prepared distribution verification context is inconsistent",
    );
  }
  assertProviderRegistryPreparedCopyLedgerZeroInternalV1(context.copyLedger);
  return state;
}

export function createPreparedDistributionVerificationContextInternalV1(
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
  verifiedActiveRoot: ProviderRegistryRootPublicKeyV1,
  copyLedger: ProviderRegistryPreparedCopyLedgerV1,
): PreparedDistributionVerificationContextV1 {
  assertProviderRegistryPreparedCopyLedgerZeroInternalV1(copyLedger);
  const context = CapturedObjectCreateV1(null) as object;
  defineFrozenEnumerableDataV1(
    context,
    "strictCryptoCapability",
    strictCryptoCapability,
  );
  defineFrozenEnumerableDataV1(context, "verifiedActiveRoot", verifiedActiveRoot);
  defineFrozenEnumerableDataV1(context, "copyLedger", copyLedger);
  const frozen = CapturedObjectFreezeV1(
    context,
  ) as PreparedDistributionVerificationContextV1;
  weakMapSetV1(preparedContextStatesV1, frozen, {
    signatureVerificationCount: 0,
  });
  return frozen;
}

export function assertPreparedDistributionInputBindingsInternalV1(
  context: PreparedDistributionVerificationContextV1,
  activeRoot: ProviderRegistryRootPublicKeyV1,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): void {
  requirePreparedContextStateV1(context);
  if (
    context.verifiedActiveRoot !== activeRoot ||
    context.strictCryptoCapability !== strictCryptoCapability
  ) {
    throw new CapturedTypeErrorV1(
      "prepared distribution input is not identity-bound to its witness",
    );
  }
}

/** Records an actual host signature-verification invocation, including false/throw. */
export function recordPreparedDistributionSignatureVerificationInternalV1(
  context: PreparedDistributionVerificationContextV1,
): void {
  const state = requirePreparedContextStateV1(context);
  if (state.signatureVerificationCount >= 6) {
    throw new CapturedTypeErrorV1(
      "prepared distribution path exceeded its six-signature budget",
    );
  }
  state.signatureVerificationCount += 1;
}

export function readPreparedDistributionSignatureVerificationCountInternalV1(
  context: PreparedDistributionVerificationContextV1,
): number {
  return requirePreparedContextStateV1(context).signatureVerificationCount;
}

export function registerProviderRealFilesystemSourcePreparedCoreInternalV1(
  core: PreparedSourceCoreV1,
): void {
  if (preparedSourceCoreV1 !== undefined) {
    throw new CapturedTypeErrorV1(
      "prepared real-filesystem source core is already registered",
    );
  }
  preparedSourceCoreV1 = CapturedObjectFreezeV1(core);
}

export function diagnoseProviderRealFilesystemSourcePreparedInternalV1(
  input: ValidateProviderRealFilesystemSourceClosureV1Input,
  context: PreparedDistributionVerificationContextV1,
): Promise<ProviderRealFilesystemSourceClosureDiagnosticResultV1> {
  requirePreparedContextStateV1(context);
  if (preparedSourceCoreV1 === undefined) {
    throw new CapturedTypeErrorV1(
      "prepared real-filesystem source core is unavailable",
    );
  }
  return preparedSourceCoreV1(input, context);
}

CapturedObjectFreezeV1(createPreparedDistributionVerificationContextInternalV1);
CapturedObjectFreezeV1(assertPreparedDistributionInputBindingsInternalV1);
CapturedObjectFreezeV1(recordPreparedDistributionSignatureVerificationInternalV1);
CapturedObjectFreezeV1(readPreparedDistributionSignatureVerificationCountInternalV1);
CapturedObjectFreezeV1(registerProviderRealFilesystemSourcePreparedCoreInternalV1);
CapturedObjectFreezeV1(diagnoseProviderRealFilesystemSourcePreparedInternalV1);
