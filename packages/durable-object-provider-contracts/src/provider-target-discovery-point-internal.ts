import type {
  ProviderTargetDiscoveryPointClosureValidationV1,
  ValidateProviderTargetDiscoveryPointClosureV1Input,
} from "./provider-target-discovery-point.js";

const CapturedObjectCreateV1 = Object.create;
const CapturedObjectDefinePropertyV1 = Object.defineProperty;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedFunctionPrototypeBindV1 = Function.prototype.bind;
const CapturedFunctionPrototypeCallV1 = Function.prototype.call;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedWeakMapV1 = WeakMap;
const CapturedWeakMapDeleteV1 = CapturedWeakMapV1.prototype.delete;
const CapturedWeakMapGetV1 = CapturedWeakMapV1.prototype.get;
const CapturedWeakMapHasV1 = CapturedWeakMapV1.prototype.has;
const CapturedWeakMapSetV1 = CapturedWeakMapV1.prototype.set;
const CapturedTypeErrorV1 = TypeError;

function bindUncurriedAtBootstrapV1(method: Function): Function {
  const argumentsList = CapturedObjectFreezeV1([method]);
  return CapturedReflectApplyV1(
    CapturedFunctionPrototypeBindV1,
    CapturedFunctionPrototypeCallV1,
    argumentsList,
  ) as Function;
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

/**
 * The detached C09-1G input. Its ten JSON fields are recursively frozen by
 * the admission layer; the opaque capability deliberately retains its exact
 * original identity and is never recursively frozen here.
 *
 * @internal
 */
export type ProviderTargetDiscoveryPointSnapshotV1 = Readonly<
  ValidateProviderTargetDiscoveryPointClosureV1Input
>;

const preSnapshotsV1 = new CapturedWeakMapV1<
  object,
  ProviderTargetDiscoveryPointSnapshotV1
>();
const closureSnapshotsV1 = new CapturedWeakMapV1<
  object,
  ProviderTargetDiscoveryPointSnapshotV1
>();

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

/** Creates the exact frozen, null-prototype eleven-field snapshot wrapper. @internal */
export function createProviderTargetDiscoveryPointSnapshotV1(
  fields: ValidateProviderTargetDiscoveryPointClosureV1Input,
): ProviderTargetDiscoveryPointSnapshotV1 {
  const snapshot = CapturedObjectCreateV1(null) as Record<string, unknown>;
  defineFrozenEnumerableDataV1(snapshot, "activeRoot", fields.activeRoot);
  defineFrozenEnumerableDataV1(
    snapshot,
    "activeRootMetadata",
    fields.activeRootMetadata,
  );
  defineFrozenEnumerableDataV1(
    snapshot,
    "distributionRootBinding",
    fields.distributionRootBinding,
  );
  defineFrozenEnumerableDataV1(
    snapshot,
    "fixtureCorpusManifest",
    fields.fixtureCorpusManifest,
  );
  defineFrozenEnumerableDataV1(
    snapshot,
    "publicSupportTaxonomy",
    fields.publicSupportTaxonomy,
  );
  defineFrozenEnumerableDataV1(
    snapshot,
    "releaseMatrix",
    fields.releaseMatrix,
  );
  defineFrozenEnumerableDataV1(
    snapshot,
    "strictCryptoCapability",
    fields.strictCryptoCapability,
  );
  defineFrozenEnumerableDataV1(
    snapshot,
    "suiteManifest",
    fields.suiteManifest,
  );
  defineFrozenEnumerableDataV1(
    snapshot,
    "targetDiscoveryFixtureManifest",
    fields.targetDiscoveryFixtureManifest,
  );
  defineFrozenEnumerableDataV1(
    snapshot,
    "targetDiscoveryResult",
    fields.targetDiscoveryResult,
  );
  defineFrozenEnumerableDataV1(
    snapshot,
    "targetDiscoveryRunnerRun",
    fields.targetDiscoveryRunnerRun,
  );
  return CapturedObjectFreezeV1(
    snapshot,
  ) as unknown as ProviderTargetDiscoveryPointSnapshotV1;
}

/** Registers the explicit one-shot C09-1K -> C09-1G handoff. @internal */
export function registerProviderTargetDiscoveryPointPreSnapshotV1(
  inputIdentity: object,
  snapshot: ProviderTargetDiscoveryPointSnapshotV1,
): void {
  if (weakMapHasV1(preSnapshotsV1, inputIdentity)) {
    throw new CapturedTypeErrorV1(
      "target discovery pre-snapshot already registered",
    );
  }
  weakMapSetV1(preSnapshotsV1, inputIdentity, snapshot);
}

/** Atomically reads and deletes one explicit pre-snapshot handoff. @internal */
export function takeProviderTargetDiscoveryPointPreSnapshotV1(
  inputIdentity: unknown,
): ProviderTargetDiscoveryPointSnapshotV1 | undefined {
  if (!isObjectIdentityV1(inputIdentity)) return undefined;
  if (!weakMapHasV1(preSnapshotsV1, inputIdentity)) return undefined;
  const snapshot = weakMapGetV1(preSnapshotsV1, inputIdentity);
  if (snapshot === undefined || !weakMapDeleteV1(preSnapshotsV1, inputIdentity)) {
    throw new CapturedTypeErrorV1(
      "target discovery pre-snapshot state is inconsistent",
    );
  }
  return snapshot;
}

/** Registers a successful opted-in closure for one-shot C09-1K consumption. @internal */
export function registerProviderTargetDiscoveryPointClosureSnapshotV1(
  closure: ProviderTargetDiscoveryPointClosureValidationV1,
  snapshot: ProviderTargetDiscoveryPointSnapshotV1,
): void {
  if (weakMapHasV1(closureSnapshotsV1, closure)) {
    throw new CapturedTypeErrorV1(
      "target discovery closure snapshot already registered",
    );
  }
  weakMapSetV1(closureSnapshotsV1, closure, snapshot);
}

/** Atomically reads and deletes a successful closure sidecar. @internal */
export function takeProviderTargetDiscoveryPointClosureSnapshotV1(
  closure: unknown,
): ProviderTargetDiscoveryPointSnapshotV1 | undefined {
  if (!isObjectIdentityV1(closure)) return undefined;
  if (!weakMapHasV1(closureSnapshotsV1, closure)) return undefined;
  const snapshot = weakMapGetV1(closureSnapshotsV1, closure);
  if (
    snapshot === undefined ||
    !weakMapDeleteV1(closureSnapshotsV1, closure)
  ) {
    throw new CapturedTypeErrorV1(
      "target discovery closure sidecar is inconsistent",
    );
  }
  return snapshot;
}

CapturedObjectFreezeV1(createProviderTargetDiscoveryPointSnapshotV1);
CapturedObjectFreezeV1(registerProviderTargetDiscoveryPointPreSnapshotV1);
CapturedObjectFreezeV1(takeProviderTargetDiscoveryPointPreSnapshotV1);
CapturedObjectFreezeV1(registerProviderTargetDiscoveryPointClosureSnapshotV1);
CapturedObjectFreezeV1(takeProviderTargetDiscoveryPointClosureSnapshotV1);
