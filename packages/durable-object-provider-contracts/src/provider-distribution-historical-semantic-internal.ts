/**
 * Package-private, no-crypto semantic bridge for retained non-tip provider
 * distribution objects.  A caller may mint a one-shot witness only for an
 * exact frozen signed object owned by a non-tip history entry.  Successful
 * validation returns an opaque token whose semantic state is held solely in
 * this module's WeakMap; no public closure/authority DTO is manufactured.
 */

import type {
  ProviderFeasibilitySupportCatalogEnvelopeV1,
} from "./provider-feasibility-support-catalog-point.js";
import type {
  ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1,
  ProviderRealFilesystemSuiteManifestEnvelopeV1,
} from "./provider-real-filesystem-source.js";
import type {
  ProviderReleaseTargetUniverseEnvelopeV1,
} from "./provider-release-target-universe-point.js";
import type {
  ProviderPublicSupportTaxonomyEnvelopeV1,
  ProviderReleaseMatrixEnvelopeV1,
  ProviderTargetDiscoveryFixtureManifestEnvelopeV1,
  ProviderTargetDiscoveryInputBundleV1,
  ProviderTargetDiscoveryResultEnvelopeV1,
  ProviderTargetDiscoveryRunnerRunEnvelopeV1,
} from "./provider-target-discovery-point.js";

const CapturedFunctionPrototypeBindV1 = Function.prototype.bind;
const CapturedFunctionPrototypeCallV1 = Function.prototype.call;
const CapturedObjectCreateV1 = Object.create;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedObjectIsFrozenV1 = Object.isFrozen;
const CapturedNumberIsSafeIntegerV1 = Number.isSafeInteger;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedTypeErrorV1 = TypeError;
const CapturedWeakMapV1 = WeakMap;
const CapturedWeakMapDeleteV1 = CapturedWeakMapV1.prototype.delete;
const CapturedWeakMapGetV1 = CapturedWeakMapV1.prototype.get;
const CapturedWeakMapHasV1 = CapturedWeakMapV1.prototype.has;
const CapturedWeakMapSetV1 = CapturedWeakMapV1.prototype.set;
const CapturedWeakSetV1 = WeakSet;
const CapturedWeakSetAddV1 = CapturedWeakSetV1.prototype.add;
const CapturedWeakSetHasV1 = CapturedWeakSetV1.prototype.has;

function bindUncurriedAtBootstrapV1(method: Function): Function {
  return CapturedObjectFreezeV1(
    CapturedReflectApplyV1(
      CapturedFunctionPrototypeBindV1,
      CapturedFunctionPrototypeCallV1,
      CapturedObjectFreezeV1([method]),
    ) as Function,
  );
}

const weakMapDeleteV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapDeleteV1,
) as <K extends object>(map: WeakMap<K, unknown>, key: K) => boolean;
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
) as (set: WeakSet<object>, value: object) => void;
const weakSetHasV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakSetHasV1,
) as (set: WeakSet<object>, value: object) => boolean;

export type ProviderDistributionHistoricalSignedObjectKindInternalV1 =
  | "public_support_taxonomy"
  | "release_matrix"
  | "real_filesystem_fixture_corpus"
  | "real_filesystem_suite"
  | "target_discovery_input_bundle"
  | "target_discovery_result"
  | "release_target_universe"
  | "feasibility_support_catalog";

declare const ProviderDistributionHistoricalVerifiedSignatureWitnessBrandV1:
  unique symbol;
export interface ProviderDistributionHistoricalVerifiedSignatureWitnessInternalV1 {
  readonly [ProviderDistributionHistoricalVerifiedSignatureWitnessBrandV1]: true;
}

declare const ProviderDistributionHistoricalSemanticTokenBrandV1: unique symbol;
export interface ProviderDistributionHistoricalSemanticTokenInternalV1<
  TKind extends ProviderDistributionHistoricalSignedObjectKindInternalV1,
> {
  readonly [ProviderDistributionHistoricalSemanticTokenBrandV1]: TKind;
}

export type ProviderDistributionHistoricalTaxonomySemanticTokenInternalV1 =
  ProviderDistributionHistoricalSemanticTokenInternalV1<"public_support_taxonomy">;
export type ProviderDistributionHistoricalMatrixSemanticTokenInternalV1 =
  ProviderDistributionHistoricalSemanticTokenInternalV1<"release_matrix">;
export type ProviderDistributionHistoricalCorpusSemanticTokenInternalV1 =
  ProviderDistributionHistoricalSemanticTokenInternalV1<"real_filesystem_fixture_corpus">;
export type ProviderDistributionHistoricalSuiteSemanticTokenInternalV1 =
  ProviderDistributionHistoricalSemanticTokenInternalV1<"real_filesystem_suite">;
export type ProviderDistributionHistoricalBundleSemanticTokenInternalV1 =
  ProviderDistributionHistoricalSemanticTokenInternalV1<"target_discovery_input_bundle">;
export type ProviderDistributionHistoricalResultSemanticTokenInternalV1 =
  ProviderDistributionHistoricalSemanticTokenInternalV1<"target_discovery_result">;
export type ProviderDistributionHistoricalUniverseSemanticTokenInternalV1 =
  ProviderDistributionHistoricalSemanticTokenInternalV1<"release_target_universe">;
export type ProviderDistributionHistoricalCatalogSemanticTokenInternalV1 =
  ProviderDistributionHistoricalSemanticTokenInternalV1<"feasibility_support_catalog">;

interface WitnessEntryV1 {
  readonly handle: ProviderDistributionHistoricalVerifiedSignatureWitnessInternalV1;
  readonly kind: ProviderDistributionHistoricalSignedObjectKindInternalV1;
  readonly signedObject: object;
}

interface SemanticTokenEntryV1 {
  readonly kind: ProviderDistributionHistoricalSignedObjectKindInternalV1;
  readonly source: object;
  readonly state: unknown;
}

export interface ProviderDistributionCurrentTipSemanticInputInternalV1 {
  readonly publicSupportTaxonomy: ProviderPublicSupportTaxonomyEnvelopeV1;
  readonly releaseMatrix: ProviderReleaseMatrixEnvelopeV1;
  readonly fixtureCorpusManifest:
    ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1;
  readonly suiteManifest: ProviderRealFilesystemSuiteManifestEnvelopeV1;
  readonly targetDiscoveryFixtureManifest:
    ProviderTargetDiscoveryFixtureManifestEnvelopeV1;
  readonly targetDiscoveryRunnerRun:
    ProviderTargetDiscoveryRunnerRunEnvelopeV1;
  readonly targetDiscoveryResult: ProviderTargetDiscoveryResultEnvelopeV1;
  readonly releaseTargetUniverse: ProviderReleaseTargetUniverseEnvelopeV1;
  readonly providerFeasibilitySupportCatalog:
    ProviderFeasibilitySupportCatalogEnvelopeV1;
}

export interface ProviderDistributionCurrentTipSemanticTokensInternalV1 {
  readonly corpusToken: ProviderDistributionHistoricalCorpusSemanticTokenInternalV1;
  readonly suiteToken: ProviderDistributionHistoricalSuiteSemanticTokenInternalV1;
  readonly taxonomyToken: ProviderDistributionHistoricalTaxonomySemanticTokenInternalV1;
  readonly matrixToken: ProviderDistributionHistoricalMatrixSemanticTokenInternalV1;
  readonly resultToken: ProviderDistributionHistoricalResultSemanticTokenInternalV1;
  readonly universeToken: ProviderDistributionHistoricalUniverseSemanticTokenInternalV1;
}

type TaxonomySemanticCoreV1 = (
  envelope: ProviderPublicSupportTaxonomyEnvelopeV1,
) => unknown;
type MatrixSemanticCoreV1 = (
  envelope: ProviderReleaseMatrixEnvelopeV1,
  taxonomyEnvelope: ProviderPublicSupportTaxonomyEnvelopeV1,
  taxonomyState: unknown,
) => unknown;
type CorpusSemanticCoreV1 = (
  envelope: ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1,
) => unknown;
type SuiteSemanticCoreV1 = (
  envelope: ProviderRealFilesystemSuiteManifestEnvelopeV1,
  corpusEnvelope: ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1,
  corpusState: unknown,
) => unknown;
type BundleSemanticCoreV1 = (
  bundle: ProviderTargetDiscoveryInputBundleV1,
  fixtureEnvelope: ProviderTargetDiscoveryFixtureManifestEnvelopeV1,
  runnerEnvelope: ProviderTargetDiscoveryRunnerRunEnvelopeV1,
  taxonomyEnvelope: ProviderPublicSupportTaxonomyEnvelopeV1,
  taxonomyState: unknown,
  matrixEnvelope: ProviderReleaseMatrixEnvelopeV1,
  matrixState: unknown,
  suiteEnvelope: ProviderRealFilesystemSuiteManifestEnvelopeV1,
  suiteState: unknown,
) => unknown;
type ResultSemanticCoreV1 = (
  envelope: ProviderTargetDiscoveryResultEnvelopeV1,
  bundleState: unknown,
) => unknown;
type UniverseSemanticCoreV1 = (
  envelope: ProviderReleaseTargetUniverseEnvelopeV1,
  resultState: unknown,
) => unknown;
type CatalogSemanticCoreV1 = (
  envelope: ProviderFeasibilitySupportCatalogEnvelopeV1,
  universeState: unknown,
) => unknown;

let taxonomySemanticCoreV1: TaxonomySemanticCoreV1 | undefined;
let matrixSemanticCoreV1: MatrixSemanticCoreV1 | undefined;
let corpusSemanticCoreV1: CorpusSemanticCoreV1 | undefined;
let suiteSemanticCoreV1: SuiteSemanticCoreV1 | undefined;
let bundleSemanticCoreV1: BundleSemanticCoreV1 | undefined;
let resultSemanticCoreV1: ResultSemanticCoreV1 | undefined;
let universeSemanticCoreV1: UniverseSemanticCoreV1 | undefined;
let catalogSemanticCoreV1: CatalogSemanticCoreV1 | undefined;

const witnessEntriesByHandleV1 = new CapturedWeakMapV1<
  object,
  WitnessEntryV1
>();
const witnessEntriesBySignedObjectV1 = new CapturedWeakMapV1<
  object,
  WitnessEntryV1
>();
const consumedSignedObjectsV1 = new CapturedWeakSetV1<object>();
const semanticTokenEntriesV1 = new CapturedWeakMapV1<
  object,
  SemanticTokenEntryV1
>();
const validatedCurrentTipInputsByCatalogClosureV1 = new CapturedWeakMapV1<
  object,
  ProviderDistributionCurrentTipSemanticInputInternalV1
>();
const consumedCurrentTipCatalogClosuresV1 = new CapturedWeakSetV1<object>();

function isObjectIdentityV1(value: unknown): value is object {
  return value !== null &&
    (typeof value === "object" || typeof value === "function");
}

function isHistoricalSignedObjectKindV1(
  value: unknown,
): value is ProviderDistributionHistoricalSignedObjectKindInternalV1 {
  return value === "public_support_taxonomy" ||
    value === "release_matrix" ||
    value === "real_filesystem_fixture_corpus" ||
    value === "real_filesystem_suite" ||
    value === "target_discovery_input_bundle" ||
    value === "target_discovery_result" ||
    value === "release_target_universe" ||
    value === "feasibility_support_catalog";
}

function installCoreV1<TCore extends Function>(
  current: TCore | undefined,
  core: TCore,
  label: string,
): TCore {
  if (current !== undefined || typeof core !== "function") {
    throw new CapturedTypeErrorV1(`${label} semantic core is already registered`);
  }
  return CapturedObjectFreezeV1(core);
}

function deleteWitnessEntryV1(entry: WitnessEntryV1): void {
  if (weakMapGetV1(witnessEntriesByHandleV1, entry.handle) === entry) {
    weakMapDeleteV1(witnessEntriesByHandleV1, entry.handle);
  }
  if (
    weakMapGetV1(witnessEntriesBySignedObjectV1, entry.signedObject) === entry
  ) {
    weakMapDeleteV1(witnessEntriesBySignedObjectV1, entry.signedObject);
  }
}

function burnWitnessEntryV1(entry: WitnessEntryV1): void {
  deleteWitnessEntryV1(entry);
  weakSetAddV1(consumedSignedObjectsV1, entry.signedObject);
}

function burnWitnessHandleV1(handle: unknown): void {
  if (!isObjectIdentityV1(handle)) return;
  const entry = weakMapGetV1(witnessEntriesByHandleV1, handle);
  if (entry !== undefined) burnWitnessEntryV1(entry);
}

function consumeWitnessV1(
  kind: ProviderDistributionHistoricalSignedObjectKindInternalV1,
  signedObject: unknown,
  handle: unknown,
): boolean {
  const objectIdentity = isObjectIdentityV1(signedObject)
    ? signedObject
    : undefined;
  const handleIdentity = isObjectIdentityV1(handle) ? handle : undefined;
  const entryByObject = objectIdentity === undefined
    ? undefined
    : weakMapGetV1(witnessEntriesBySignedObjectV1, objectIdentity);
  const entryByHandle = handleIdentity === undefined
    ? undefined
    : weakMapGetV1(witnessEntriesByHandleV1, handleIdentity);
  if (
    entryByObject === undefined ||
    entryByObject !== entryByHandle ||
    entryByObject.kind !== kind ||
    entryByObject.signedObject !== signedObject ||
    entryByObject.handle !== handle
  ) {
    if (entryByObject !== undefined) burnWitnessEntryV1(entryByObject);
    if (entryByHandle !== undefined && entryByHandle !== entryByObject) {
      burnWitnessEntryV1(entryByHandle);
    }
    return false;
  }
  burnWitnessEntryV1(entryByObject);
  return true;
}

function tokenStateV1(
  token: unknown,
  kind: ProviderDistributionHistoricalSignedObjectKindInternalV1,
  source: object,
): unknown | undefined {
  if (!isObjectIdentityV1(token)) return undefined;
  const entry = weakMapGetV1(semanticTokenEntriesV1, token);
  return entry?.kind === kind && entry.source === source
    ? entry.state
    : undefined;
}

function createSemanticTokenV1<TKind extends ProviderDistributionHistoricalSignedObjectKindInternalV1>(
  kind: TKind,
  source: object,
  state: unknown,
): ProviderDistributionHistoricalSemanticTokenInternalV1<TKind> {
  const token = CapturedObjectFreezeV1(
    CapturedObjectCreateV1(null),
  ) as ProviderDistributionHistoricalSemanticTokenInternalV1<TKind>;
  weakMapSetV1(semanticTokenEntriesV1, token, {
    kind,
    source,
    state,
  });
  return token;
}

function invokeCoreV1<TKind extends ProviderDistributionHistoricalSignedObjectKindInternalV1>(
  kind: TKind,
  source: object,
  core: Function | undefined,
  args: readonly unknown[],
): ProviderDistributionHistoricalSemanticTokenInternalV1<TKind> | undefined {
  if (core === undefined) return undefined;
  try {
    const state = CapturedReflectApplyV1(core, undefined, args);
    if (state === undefined) return undefined;
    return createSemanticTokenV1(kind, source, state);
  } catch {
    return undefined;
  }
}

export function registerProviderDistributionHistoricalVerifiedSignatureInternalV1(
  kind: ProviderDistributionHistoricalSignedObjectKindInternalV1,
  signedObject: object,
  ownerHistoryIndex: number,
  ownerHistoryLength: number,
): ProviderDistributionHistoricalVerifiedSignatureWitnessInternalV1 {
  if (
    !isHistoricalSignedObjectKindV1(kind) ||
    !isObjectIdentityV1(signedObject) ||
    !CapturedObjectIsFrozenV1(signedObject) ||
    !CapturedNumberIsSafeIntegerV1(ownerHistoryIndex) ||
    !CapturedNumberIsSafeIntegerV1(ownerHistoryLength) ||
    ownerHistoryIndex < 0 ||
    ownerHistoryLength < 2 ||
    ownerHistoryLength > 4096 ||
    ownerHistoryIndex >= ownerHistoryLength - 1 ||
    weakSetHasV1(consumedSignedObjectsV1, signedObject) ||
    weakMapHasV1(witnessEntriesBySignedObjectV1, signedObject)
  ) {
    throw new CapturedTypeErrorV1(
      "historical verified-signature witness registration is invalid",
    );
  }
  const handle = CapturedObjectFreezeV1(
    CapturedObjectCreateV1(null),
  ) as ProviderDistributionHistoricalVerifiedSignatureWitnessInternalV1;
  const entry = CapturedObjectFreezeV1({
    handle,
    kind,
    signedObject,
  });
  weakMapSetV1(witnessEntriesByHandleV1, handle, entry);
  weakMapSetV1(witnessEntriesBySignedObjectV1, signedObject, entry);
  return handle;
}

export function registerProviderDistributionHistoricalTaxonomySemanticCoreInternalV1(
  core: TaxonomySemanticCoreV1,
): void {
  taxonomySemanticCoreV1 = installCoreV1(
    taxonomySemanticCoreV1,
    core,
    "taxonomy",
  );
}

export function registerProviderDistributionHistoricalMatrixSemanticCoreInternalV1(
  core: MatrixSemanticCoreV1,
): void {
  matrixSemanticCoreV1 = installCoreV1(matrixSemanticCoreV1, core, "matrix");
}

export function registerProviderDistributionHistoricalCorpusSemanticCoreInternalV1(
  core: CorpusSemanticCoreV1,
): void {
  corpusSemanticCoreV1 = installCoreV1(corpusSemanticCoreV1, core, "corpus");
}

export function registerProviderDistributionHistoricalSuiteSemanticCoreInternalV1(
  core: SuiteSemanticCoreV1,
): void {
  suiteSemanticCoreV1 = installCoreV1(suiteSemanticCoreV1, core, "suite");
}

export function registerProviderDistributionHistoricalBundleSemanticCoreInternalV1(
  core: BundleSemanticCoreV1,
): void {
  bundleSemanticCoreV1 = installCoreV1(bundleSemanticCoreV1, core, "bundle");
}

export function registerProviderDistributionHistoricalResultSemanticCoreInternalV1(
  core: ResultSemanticCoreV1,
): void {
  resultSemanticCoreV1 = installCoreV1(resultSemanticCoreV1, core, "result");
}

export function registerProviderDistributionHistoricalUniverseSemanticCoreInternalV1(
  core: UniverseSemanticCoreV1,
): void {
  universeSemanticCoreV1 = installCoreV1(
    universeSemanticCoreV1,
    core,
    "universe",
  );
}

export function registerProviderDistributionHistoricalCatalogSemanticCoreInternalV1(
  core: CatalogSemanticCoreV1,
): void {
  catalogSemanticCoreV1 = installCoreV1(catalogSemanticCoreV1, core, "catalog");
}

function currentTipInputObjectsAreFrozenV1(
  input: ProviderDistributionCurrentTipSemanticInputInternalV1,
): boolean {
  return isObjectIdentityV1(input) &&
    isObjectIdentityV1(input.publicSupportTaxonomy) &&
    CapturedObjectIsFrozenV1(input.publicSupportTaxonomy) &&
    isObjectIdentityV1(input.releaseMatrix) &&
    CapturedObjectIsFrozenV1(input.releaseMatrix) &&
    isObjectIdentityV1(input.fixtureCorpusManifest) &&
    CapturedObjectIsFrozenV1(input.fixtureCorpusManifest) &&
    isObjectIdentityV1(input.suiteManifest) &&
    CapturedObjectIsFrozenV1(input.suiteManifest) &&
    isObjectIdentityV1(input.targetDiscoveryFixtureManifest) &&
    CapturedObjectIsFrozenV1(input.targetDiscoveryFixtureManifest) &&
    isObjectIdentityV1(input.targetDiscoveryRunnerRun) &&
    CapturedObjectIsFrozenV1(input.targetDiscoveryRunnerRun) &&
    isObjectIdentityV1(input.targetDiscoveryResult) &&
    CapturedObjectIsFrozenV1(input.targetDiscoveryResult) &&
    isObjectIdentityV1(input.releaseTargetUniverse) &&
    CapturedObjectIsFrozenV1(input.releaseTargetUniverse) &&
    isObjectIdentityV1(input.providerFeasibilitySupportCatalog) &&
    CapturedObjectIsFrozenV1(input.providerFeasibilitySupportCatalog);
}

function currentTipInputsAreExactV1(
  left: ProviderDistributionCurrentTipSemanticInputInternalV1,
  right: ProviderDistributionCurrentTipSemanticInputInternalV1,
): boolean {
  return left.publicSupportTaxonomy === right.publicSupportTaxonomy &&
    left.releaseMatrix === right.releaseMatrix &&
    left.fixtureCorpusManifest === right.fixtureCorpusManifest &&
    left.suiteManifest === right.suiteManifest &&
    left.targetDiscoveryFixtureManifest ===
      right.targetDiscoveryFixtureManifest &&
    left.targetDiscoveryRunnerRun === right.targetDiscoveryRunnerRun &&
    left.targetDiscoveryResult === right.targetDiscoveryResult &&
    left.releaseTargetUniverse === right.releaseTargetUniverse &&
    left.providerFeasibilitySupportCatalog ===
      right.providerFeasibilitySupportCatalog;
}

/** Registers the exact detached input behind a successful current Catalog. */
export function registerProviderDistributionValidatedCurrentTipCatalogInternalV1(
  catalogClosure: object,
  input: ProviderDistributionCurrentTipSemanticInputInternalV1,
): void {
  if (
    !isObjectIdentityV1(catalogClosure) ||
    !CapturedObjectIsFrozenV1(catalogClosure) ||
    !currentTipInputObjectsAreFrozenV1(input) ||
    weakSetHasV1(consumedCurrentTipCatalogClosuresV1, catalogClosure) ||
    weakMapHasV1(validatedCurrentTipInputsByCatalogClosureV1, catalogClosure)
  ) {
    throw new CapturedTypeErrorV1(
      "validated current-tip Catalog registration is invalid",
    );
  }
  weakMapSetV1(
    validatedCurrentTipInputsByCatalogClosureV1,
    catalogClosure,
    CapturedObjectFreezeV1({
      publicSupportTaxonomy: input.publicSupportTaxonomy,
      releaseMatrix: input.releaseMatrix,
      fixtureCorpusManifest: input.fixtureCorpusManifest,
      suiteManifest: input.suiteManifest,
      targetDiscoveryFixtureManifest: input.targetDiscoveryFixtureManifest,
      targetDiscoveryRunnerRun: input.targetDiscoveryRunnerRun,
      targetDiscoveryResult: input.targetDiscoveryResult,
      releaseTargetUniverse: input.releaseTargetUniverse,
      providerFeasibilitySupportCatalog:
        input.providerFeasibilitySupportCatalog,
    }),
  );
}

/**
 * Consumes the successful current-Catalog proof before projecting dependency
 * tokens. This performs no signature verification and never issues a
 * historical verified-signature witness for a five-chain tip.
 */
export function takeProviderDistributionCurrentTipSemanticTokensInternalV1(
  catalogClosure: object,
  expectedInput: ProviderDistributionCurrentTipSemanticInputInternalV1,
): ProviderDistributionCurrentTipSemanticTokensInternalV1 | undefined {
  if (!isObjectIdentityV1(catalogClosure)) return undefined;
  const registeredInput = weakMapGetV1(
    validatedCurrentTipInputsByCatalogClosureV1,
    catalogClosure,
  );
  if (registeredInput === undefined) return undefined;
  weakMapDeleteV1(validatedCurrentTipInputsByCatalogClosureV1, catalogClosure);
  weakSetAddV1(consumedCurrentTipCatalogClosuresV1, catalogClosure);
  if (
    !currentTipInputObjectsAreFrozenV1(expectedInput) ||
    !currentTipInputsAreExactV1(registeredInput, expectedInput) ||
    taxonomySemanticCoreV1 === undefined ||
    matrixSemanticCoreV1 === undefined ||
    corpusSemanticCoreV1 === undefined ||
    suiteSemanticCoreV1 === undefined ||
    bundleSemanticCoreV1 === undefined ||
    resultSemanticCoreV1 === undefined ||
    universeSemanticCoreV1 === undefined
  ) {
    return undefined;
  }
  try {
    const taxonomyState = CapturedReflectApplyV1(
      taxonomySemanticCoreV1,
      undefined,
      [expectedInput.publicSupportTaxonomy],
    );
    if (taxonomyState === undefined) return undefined;
    const matrixState = CapturedReflectApplyV1(
      matrixSemanticCoreV1,
      undefined,
      [
        expectedInput.releaseMatrix,
        expectedInput.publicSupportTaxonomy,
        taxonomyState,
      ],
    );
    if (matrixState === undefined) return undefined;
    const corpusState = CapturedReflectApplyV1(
      corpusSemanticCoreV1,
      undefined,
      [expectedInput.fixtureCorpusManifest],
    );
    if (corpusState === undefined) return undefined;
    const suiteState = CapturedReflectApplyV1(
      suiteSemanticCoreV1,
      undefined,
      [
        expectedInput.suiteManifest,
        expectedInput.fixtureCorpusManifest,
        corpusState,
      ],
    );
    if (suiteState === undefined) return undefined;
    const bundle = expectedInput.targetDiscoveryResult.payload
      .targetDiscoveryInputBundle;
    const bundleState = CapturedReflectApplyV1(
      bundleSemanticCoreV1,
      undefined,
      [
        bundle,
        expectedInput.targetDiscoveryFixtureManifest,
        expectedInput.targetDiscoveryRunnerRun,
        expectedInput.publicSupportTaxonomy,
        taxonomyState,
        expectedInput.releaseMatrix,
        matrixState,
        expectedInput.suiteManifest,
        suiteState,
      ],
    );
    if (bundleState === undefined) return undefined;
    const resultState = CapturedReflectApplyV1(
      resultSemanticCoreV1,
      undefined,
      [expectedInput.targetDiscoveryResult, bundleState],
    );
    if (resultState === undefined) return undefined;
    const universeState = CapturedReflectApplyV1(
      universeSemanticCoreV1,
      undefined,
      [expectedInput.releaseTargetUniverse, resultState],
    );
    if (universeState === undefined) return undefined;
    return CapturedObjectFreezeV1({
      corpusToken: createSemanticTokenV1(
        "real_filesystem_fixture_corpus",
        expectedInput.fixtureCorpusManifest,
        corpusState,
      ),
      suiteToken: createSemanticTokenV1(
        "real_filesystem_suite",
        expectedInput.suiteManifest,
        suiteState,
      ),
      taxonomyToken: createSemanticTokenV1(
        "public_support_taxonomy",
        expectedInput.publicSupportTaxonomy,
        taxonomyState,
      ),
      matrixToken: createSemanticTokenV1(
        "release_matrix",
        expectedInput.releaseMatrix,
        matrixState,
      ),
      resultToken: createSemanticTokenV1(
        "target_discovery_result",
        expectedInput.targetDiscoveryResult,
        resultState,
      ),
      universeToken: createSemanticTokenV1(
        "release_target_universe",
        expectedInput.releaseTargetUniverse,
        universeState,
      ),
    });
  } catch {
    return undefined;
  }
}

export function validateProviderDistributionHistoricalTaxonomySemanticInternalV1(
  envelope: ProviderPublicSupportTaxonomyEnvelopeV1,
  witness: ProviderDistributionHistoricalVerifiedSignatureWitnessInternalV1,
): ProviderDistributionHistoricalTaxonomySemanticTokenInternalV1 | undefined {
  if (!isObjectIdentityV1(envelope)) {
    burnWitnessHandleV1(witness);
    return undefined;
  }
  let payload: unknown;
  try {
    payload = envelope.payload;
  } catch {
    burnWitnessHandleV1(witness);
    return undefined;
  }
  if (!consumeWitnessV1("public_support_taxonomy", payload, witness)) {
    return undefined;
  }
  return invokeCoreV1(
    "public_support_taxonomy",
    envelope,
    taxonomySemanticCoreV1,
    [envelope],
  );
}

export function validateProviderDistributionHistoricalMatrixSemanticInternalV1(
  envelope: ProviderReleaseMatrixEnvelopeV1,
  taxonomyEnvelope: ProviderPublicSupportTaxonomyEnvelopeV1,
  taxonomyToken: ProviderDistributionHistoricalTaxonomySemanticTokenInternalV1,
  witness: ProviderDistributionHistoricalVerifiedSignatureWitnessInternalV1,
): ProviderDistributionHistoricalMatrixSemanticTokenInternalV1 | undefined {
  if (!isObjectIdentityV1(envelope) || !isObjectIdentityV1(taxonomyEnvelope)) {
    burnWitnessHandleV1(witness);
    return undefined;
  }
  let payload: unknown;
  try {
    payload = envelope.payload;
  } catch {
    burnWitnessHandleV1(witness);
    return undefined;
  }
  const witnessed = consumeWitnessV1("release_matrix", payload, witness);
  const taxonomyState = tokenStateV1(
    taxonomyToken,
    "public_support_taxonomy",
    taxonomyEnvelope,
  );
  if (!witnessed || taxonomyState === undefined) {
    return undefined;
  }
  return invokeCoreV1("release_matrix", envelope, matrixSemanticCoreV1, [
    envelope,
    taxonomyEnvelope,
    taxonomyState,
  ]);
}

export function validateProviderDistributionHistoricalCorpusSemanticInternalV1(
  envelope: ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1,
  witness: ProviderDistributionHistoricalVerifiedSignatureWitnessInternalV1,
): ProviderDistributionHistoricalCorpusSemanticTokenInternalV1 | undefined {
  if (!isObjectIdentityV1(envelope)) {
    burnWitnessHandleV1(witness);
    return undefined;
  }
  let payload: unknown;
  try {
    payload = envelope.payload;
  } catch {
    burnWitnessHandleV1(witness);
    return undefined;
  }
  if (
    !consumeWitnessV1(
      "real_filesystem_fixture_corpus",
      payload,
      witness,
    )
  ) {
    return undefined;
  }
  return invokeCoreV1(
    "real_filesystem_fixture_corpus",
    envelope,
    corpusSemanticCoreV1,
    [envelope],
  );
}

export function validateProviderDistributionHistoricalSuiteSemanticInternalV1(
  envelope: ProviderRealFilesystemSuiteManifestEnvelopeV1,
  corpusEnvelope: ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1,
  corpusToken: ProviderDistributionHistoricalCorpusSemanticTokenInternalV1,
  witness: ProviderDistributionHistoricalVerifiedSignatureWitnessInternalV1,
): ProviderDistributionHistoricalSuiteSemanticTokenInternalV1 | undefined {
  if (!isObjectIdentityV1(envelope) || !isObjectIdentityV1(corpusEnvelope)) {
    burnWitnessHandleV1(witness);
    return undefined;
  }
  let payload: unknown;
  try {
    payload = envelope.payload;
  } catch {
    burnWitnessHandleV1(witness);
    return undefined;
  }
  const witnessed = consumeWitnessV1(
    "real_filesystem_suite",
    payload,
    witness,
  );
  const corpusState = tokenStateV1(
    corpusToken,
    "real_filesystem_fixture_corpus",
    corpusEnvelope,
  );
  if (!witnessed || corpusState === undefined) {
    return undefined;
  }
  return invokeCoreV1("real_filesystem_suite", envelope, suiteSemanticCoreV1, [
    envelope,
    corpusEnvelope,
    corpusState,
  ]);
}

export interface ProviderDistributionHistoricalBundleSemanticInputInternalV1 {
  readonly bundle: ProviderTargetDiscoveryInputBundleV1;
  readonly fixtureEnvelope: ProviderTargetDiscoveryFixtureManifestEnvelopeV1;
  readonly runnerEnvelope: ProviderTargetDiscoveryRunnerRunEnvelopeV1;
  readonly taxonomyEnvelope: ProviderPublicSupportTaxonomyEnvelopeV1;
  readonly taxonomyToken: ProviderDistributionHistoricalTaxonomySemanticTokenInternalV1;
  readonly matrixEnvelope: ProviderReleaseMatrixEnvelopeV1;
  readonly matrixToken: ProviderDistributionHistoricalMatrixSemanticTokenInternalV1;
  readonly suiteEnvelope: ProviderRealFilesystemSuiteManifestEnvelopeV1;
  readonly suiteToken: ProviderDistributionHistoricalSuiteSemanticTokenInternalV1;
}

export function validateProviderDistributionHistoricalBundleSemanticInternalV1(
  input: ProviderDistributionHistoricalBundleSemanticInputInternalV1,
  witness: ProviderDistributionHistoricalVerifiedSignatureWitnessInternalV1,
): ProviderDistributionHistoricalBundleSemanticTokenInternalV1 | undefined {
  if (!isObjectIdentityV1(input) || !isObjectIdentityV1(input.bundle)) {
    burnWitnessHandleV1(witness);
    return undefined;
  }
  const witnessed = consumeWitnessV1(
    "target_discovery_input_bundle",
    input.bundle,
    witness,
  );
  const taxonomyState = tokenStateV1(
    input.taxonomyToken,
    "public_support_taxonomy",
    input.taxonomyEnvelope,
  );
  const matrixState = tokenStateV1(
    input.matrixToken,
    "release_matrix",
    input.matrixEnvelope,
  );
  const suiteState = tokenStateV1(
    input.suiteToken,
    "real_filesystem_suite",
    input.suiteEnvelope,
  );
  if (
    !witnessed ||
    taxonomyState === undefined ||
    matrixState === undefined ||
    suiteState === undefined
  ) {
    return undefined;
  }
  return invokeCoreV1(
    "target_discovery_input_bundle",
    input.bundle,
    bundleSemanticCoreV1,
    [
      input.bundle,
      input.fixtureEnvelope,
      input.runnerEnvelope,
      input.taxonomyEnvelope,
      taxonomyState,
      input.matrixEnvelope,
      matrixState,
      input.suiteEnvelope,
      suiteState,
    ],
  );
}

export function validateProviderDistributionHistoricalResultSemanticInternalV1(
  envelope: ProviderTargetDiscoveryResultEnvelopeV1,
  bundle: ProviderTargetDiscoveryInputBundleV1,
  bundleToken: ProviderDistributionHistoricalBundleSemanticTokenInternalV1,
  witness: ProviderDistributionHistoricalVerifiedSignatureWitnessInternalV1,
): ProviderDistributionHistoricalResultSemanticTokenInternalV1 | undefined {
  if (!isObjectIdentityV1(envelope) || !isObjectIdentityV1(bundle)) {
    burnWitnessHandleV1(witness);
    return undefined;
  }
  let payload: unknown;
  try {
    payload = envelope.payload;
  } catch {
    burnWitnessHandleV1(witness);
    return undefined;
  }
  const witnessed = consumeWitnessV1(
    "target_discovery_result",
    payload,
    witness,
  );
  const bundleState = tokenStateV1(
    bundleToken,
    "target_discovery_input_bundle",
    bundle,
  );
  if (!witnessed || bundleState === undefined) {
    return undefined;
  }
  return invokeCoreV1(
    "target_discovery_result",
    envelope,
    resultSemanticCoreV1,
    [envelope, bundleState],
  );
}

export function validateProviderDistributionHistoricalUniverseSemanticInternalV1(
  envelope: ProviderReleaseTargetUniverseEnvelopeV1,
  resultEnvelope: ProviderTargetDiscoveryResultEnvelopeV1,
  resultToken: ProviderDistributionHistoricalResultSemanticTokenInternalV1,
  witness: ProviderDistributionHistoricalVerifiedSignatureWitnessInternalV1,
): ProviderDistributionHistoricalUniverseSemanticTokenInternalV1 | undefined {
  if (!isObjectIdentityV1(envelope) || !isObjectIdentityV1(resultEnvelope)) {
    burnWitnessHandleV1(witness);
    return undefined;
  }
  let payload: unknown;
  try {
    payload = envelope.payload;
  } catch {
    burnWitnessHandleV1(witness);
    return undefined;
  }
  const witnessed = consumeWitnessV1(
    "release_target_universe",
    payload,
    witness,
  );
  const resultState = tokenStateV1(
    resultToken,
    "target_discovery_result",
    resultEnvelope,
  );
  if (!witnessed || resultState === undefined) {
    return undefined;
  }
  return invokeCoreV1(
    "release_target_universe",
    envelope,
    universeSemanticCoreV1,
    [envelope, resultState],
  );
}

export function validateProviderDistributionHistoricalCatalogSemanticInternalV1(
  envelope: ProviderFeasibilitySupportCatalogEnvelopeV1,
  universeEnvelope: ProviderReleaseTargetUniverseEnvelopeV1,
  universeToken: ProviderDistributionHistoricalUniverseSemanticTokenInternalV1,
  witness: ProviderDistributionHistoricalVerifiedSignatureWitnessInternalV1,
): ProviderDistributionHistoricalCatalogSemanticTokenInternalV1 | undefined {
  if (!isObjectIdentityV1(envelope) || !isObjectIdentityV1(universeEnvelope)) {
    burnWitnessHandleV1(witness);
    return undefined;
  }
  let payload: unknown;
  try {
    payload = envelope.payload;
  } catch {
    burnWitnessHandleV1(witness);
    return undefined;
  }
  const witnessed = consumeWitnessV1(
    "feasibility_support_catalog",
    payload,
    witness,
  );
  const universeState = tokenStateV1(
    universeToken,
    "release_target_universe",
    universeEnvelope,
  );
  if (!witnessed || universeState === undefined) {
    return undefined;
  }
  return invokeCoreV1(
    "feasibility_support_catalog",
    envelope,
    catalogSemanticCoreV1,
    [envelope, universeState],
  );
}

for (const exportedFunction of [
  registerProviderDistributionHistoricalVerifiedSignatureInternalV1,
  registerProviderDistributionHistoricalTaxonomySemanticCoreInternalV1,
  registerProviderDistributionHistoricalMatrixSemanticCoreInternalV1,
  registerProviderDistributionHistoricalCorpusSemanticCoreInternalV1,
  registerProviderDistributionHistoricalSuiteSemanticCoreInternalV1,
  registerProviderDistributionHistoricalBundleSemanticCoreInternalV1,
  registerProviderDistributionHistoricalResultSemanticCoreInternalV1,
  registerProviderDistributionHistoricalUniverseSemanticCoreInternalV1,
  registerProviderDistributionHistoricalCatalogSemanticCoreInternalV1,
  registerProviderDistributionValidatedCurrentTipCatalogInternalV1,
  takeProviderDistributionCurrentTipSemanticTokensInternalV1,
  validateProviderDistributionHistoricalTaxonomySemanticInternalV1,
  validateProviderDistributionHistoricalMatrixSemanticInternalV1,
  validateProviderDistributionHistoricalCorpusSemanticInternalV1,
  validateProviderDistributionHistoricalSuiteSemanticInternalV1,
  validateProviderDistributionHistoricalBundleSemanticInternalV1,
  validateProviderDistributionHistoricalResultSemanticInternalV1,
  validateProviderDistributionHistoricalUniverseSemanticInternalV1,
  validateProviderDistributionHistoricalCatalogSemanticInternalV1,
]) {
  CapturedObjectFreezeV1(exportedFunction);
}
