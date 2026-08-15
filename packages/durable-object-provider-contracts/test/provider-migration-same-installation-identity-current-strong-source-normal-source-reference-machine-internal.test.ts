import { describe, expect, it } from "vitest";

import {
  CanonicalByteStringV1Schema,
  ContentDigestV1Schema,
  DurableObjectIdentityProviderIdV1Schema,
  InstallationIdentityGenerationIdV1Schema,
} from "../src/primitives.js";
import {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureReferenceCandidateV1Schema,
  checkedSumProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLogicalObjectBytesReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCanonicalObjectSetBytesReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCanonicalReferenceSetBytesReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCanonicalRootSetBytesReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCanonicalUniverseBytesReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureContentDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveObjectSetDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveReferenceSetDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveRootSetDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestCurrentCutContentDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreProviderBindingReferenceDigestReferenceCandidateV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveRootReferenceCandidateV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestCurrentCutReferenceCandidateV1,
} from "../src/provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-plan-admission-reference-candidate-wire.js";
import {
  assertProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineBindingInternalV1,
  captureProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPostSourceContinuityInternalV1,
  isProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineErrorInternalV1,
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceEofStreamEventCapabilityInternalV1,
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineInternalV1,
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamRecordEventCapabilityInternalV1,
  readProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPrivateLocatorReferenceInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalReferenceSlotInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceObjectStreamRecordInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineCapabilityInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineReasonInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineStageInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceRootStreamRecordInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamEventCapabilityInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamEventMintCapabilityInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamRecordInternalV1,
} from "../src/provider-migration-same-installation-identity-current-strong-source-normal-source-reference-machine-internal.js";

const digest = (character: string) =>
  ContentDigestV1Schema.parse(`sha256:${character.repeat(64)}`);
const installationIdentityGenerationId =
  InstallationIdentityGenerationIdV1Schema.parse(
    `installation-identity-generation:${"1".repeat(22)}`,
  );
const liveReferenceSchemaDigest = digest("2");
const sourceFreezeStateReferenceDigest = digest("3");

function sourceStoreManifestV1(): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestCurrentCutReferenceCandidateV1 {
  const bindingUnsigned = {
    targetProfileId: `provider-target-profile:${"4".repeat(64)}`,
    providerId: "durable-object-provider:native-b",
    registryEntryContentDigest: digest("5"),
    semanticProviderPolicyDigest: digest("6"),
    providerFeasibilityEvidence: {
      locatorProfile:
        "installation_provider_feasibility_evidence_v1" as const,
      evidenceId: `provider-feasibility-evidence:${"7".repeat(22)}`,
      contentDigest: digest("8"),
    },
    runtimeAttestationContentDigest: digest("9"),
    bindingDerivationKeyGeneration: 1,
  };
  const providerBinding = {
    ...bindingUnsigned,
    bindingReferenceDigest:
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreProviderBindingReferenceDigestReferenceCandidateV1(
        bindingUnsigned,
      ),
  };
  const unsigned = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_store_manifest_current_cut_reference_candidate_v1" as const,
    namespace: {
      installationIdentityGenerationId,
      repositoryId:
        `provider-migration-same-installation-identity-current-strong-source-normal-repository-reference-candidate:${"a".repeat(64)}`,
      worktreeId:
        `provider-migration-same-installation-identity-current-strong-source-normal-worktree-reference-candidate:${"b".repeat(64)}`,
    },
    providerBinding,
    namespaceRevision: 1,
    headContentDigest: digest("c"),
    currentVersionReferenceDigest: digest("d"),
    generationCount: 1,
    generationSetDigest: digest("e"),
    currentGeneration: {
      generationOrdinal: 1,
      generationReferenceId:
        `provider-migration-same-installation-identity-current-strong-source-normal-store-manifest-generation-reference-candidate:${"f".repeat(22)}`,
      contentDigest: digest("c"),
    },
  };
  return {
    ...unsigned,
    cutContentDigest:
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestCurrentCutContentDigestReferenceCandidateV1(
        unsigned,
      ),
  } as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestCurrentCutReferenceCandidateV1;
}

interface SourceMachineFixtureOptionsV1 {
  readonly cohortIdentity?: object;
  readonly continuityDrift?: boolean;
  readonly doubleMintFirstEvent?: boolean;
  readonly eventCapabilityOverride?: (readOrdinal: number) => unknown;
  readonly eventCapabilityTransform?: (
    capability: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamEventCapabilityInternalV1,
    readOrdinal: number,
  ) => unknown;
  readonly freezeToken?: object;
  readonly postContinuityDrift?: boolean;
  readonly duplicateRootKind?: boolean;
  readonly rootAttack?:
    | "missing"
    | "extra"
    | "canonical_tie"
    | "cross_branch"
    | "store_current_substitution"
    | "receipt_provider_substitution"
    | "receipt_policy_substitution"
    | "active_count_contradiction"
    | "genesis_omission";
  readonly duplicateSemanticTuple?: boolean;
  readonly duplicatePrivateLocator?: boolean;
  readonly omitAllObjects?: boolean;
  readonly omitObjectIndex?: number;
  readonly extraUnreachableObject?: boolean;
  readonly providerBindingSubstitution?: "destination" | "historical" | "other";
  readonly duplicateSlotAttack?: "exact" | "digest" | "target";
  readonly danglingSlotTarget?: boolean;
  readonly missingLastEdge?: boolean;
  readonly reverseStream?: boolean;
  readonly extraUniqueSlot?: boolean;
  readonly reverseReferenceSlotOrder?: boolean;
  readonly wrongReceiptNamespace?: boolean;
  readonly wrongStoreNamespace?: boolean;
  readonly mutateAfterStart?: boolean;
  readonly getterObjectRecord?: boolean;
  readonly proxyRoot?: boolean;
  readonly proxyPrivateLocator?: boolean;
  readonly replayFirstEventCapabilityOnSecondRead?: boolean;
  readonly oversizedReferenceSlots?: boolean;
  readonly referenceSlotAttack?:
    | "index_accessor"
    | "index_replacement"
    | "length_drift"
    | "slot_field_drift"
    | "sparse";
  readonly referenceSlotArrayExtraNameFlood?: boolean;
  readonly referenceSlotExtraNameFlood?: boolean;
  readonly mutateNestedSlotAfterSnapshot?: boolean;
  readonly hostileThenableHostReturn?:
    | "open"
    | "locator"
    | "slots"
    | "continuity";
}

interface SourceMachineCallsV1 {
  open: number;
  read: number;
  eof: number;
  locator: number;
  slots: number;
  continuity: number;
  getterReads: number;
  eventMintReplayRejects: number;
  rootOwnKeysReads: number;
  slotIndexGetterReads: number;
  slotNestedMutations: number;
  slotArrayOwnKeysReads: number;
  slotOwnKeysReads: number;
  hostReturnThenReads: number;
  readonly schemaDigests: string[];
}

interface SourceMachineFixtureV1 {
  readonly capability: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineCapabilityInternalV1;
  readonly calls: SourceMachineCallsV1;
  readonly cohortIdentity: object;
  readonly privatePathLabels: readonly string[];
}

function privateLocatorV1(
  label: string,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPrivateLocatorReferenceInternalV1 {
  return Object.freeze({ privatePath: label }) as unknown as
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPrivateLocatorReferenceInternalV1;
}

function slotPathV1(index: number) {
  return CanonicalByteStringV1Schema.parse(
    `base64url:${Buffer.from(`/slot/${index}`).toString("base64url")}`,
  );
}

function sourceMachineFixtureV1(
  options: SourceMachineFixtureOptionsV1 = {},
): SourceMachineFixtureV1 {
  const manifest = sourceStoreManifestV1();
  const privatePathLabels = [
    "private/store/a",
    "private/store/b",
    "private/receipt/c",
    "private/store/d",
  ] as const;
  const locators = privatePathLabels.map(privateLocatorV1);
  const objectRecords: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceObjectStreamRecordInternalV1[] = [
    {
      recordKind: "object",
      objectKind: "store_manifest_generation",
      locatorNamespace: "store",
      privateLocator: locators[0]!,
      contentDigest: digest("1"),
      logicalBytes: 10,
      providerBindingReferenceDigest:
        manifest.providerBinding.bindingReferenceDigest,
    },
    {
      recordKind: "object",
      objectKind: "committed_private_blob",
      locatorNamespace: "store",
      privateLocator: locators[1]!,
      contentDigest: digest("2"),
      logicalBytes: 20,
      providerBindingReferenceDigest:
        manifest.providerBinding.bindingReferenceDigest,
    },
    {
      recordKind: "object",
      objectKind: "store_manifest_compare_append_receipt",
      locatorNamespace: options.wrongReceiptNamespace === true
        ? "store"
        : "provider_isolated_store_manifest_receipt_ledger",
      privateLocator: locators[2]!,
      contentDigest: digest("3"),
      logicalBytes: 30,
      providerBindingReferenceDigest:
        manifest.providerBinding.bindingReferenceDigest,
    },
    {
      recordKind: "object",
      objectKind: "control_state",
      locatorNamespace: "store",
      privateLocator: locators[3]!,
      contentDigest: digest("4"),
      logicalBytes: 40,
      providerBindingReferenceDigest:
        manifest.providerBinding.bindingReferenceDigest,
    },
  ];
  if (options.wrongStoreNamespace === true) {
    objectRecords[0] = {
      ...objectRecords[0]!,
      locatorNamespace:
        "provider_isolated_store_manifest_receipt_ledger",
    };
  }
  if (options.duplicatePrivateLocator === true) {
    objectRecords[1] = {
      ...objectRecords[1]!,
      privateLocator: locators[0]!,
    };
  }
  if (options.providerBindingSubstitution !== undefined) {
    const substitutedBindingDigest = {
      destination: digest("d"),
      historical: digest("e"),
      other: digest("f"),
    }[options.providerBindingSubstitution];
    objectRecords[1] = {
      ...objectRecords[1]!,
      providerBindingReferenceDigest: substitutedBindingDigest,
    };
  }
  if (options.extraUnreachableObject === true) {
    const extraLocator = privateLocatorV1("private/store/extra");
    locators.push(extraLocator);
    objectRecords.push({
      recordKind: "object",
      objectKind: "repo_pulse_immutable_version",
      locatorNamespace: "store",
      privateLocator: extraLocator,
      contentDigest: digest("0"),
      logicalBytes: 50,
      providerBindingReferenceDigest:
        manifest.providerBinding.bindingReferenceDigest,
    });
  }
  const roots: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveRootReferenceCandidateV1[] = [
    { rootKind: "store_manifest_complete_set", current: manifest },
    {
      rootKind: "quota_index_and_transition_chain",
      currentQuotaIndexRootContentDigest: digest("5"),
      transitionHead: { state: "genesis" },
    },
    {
      rootKind: "artifact_descriptor_history_closure",
      rootCount: 1,
      rootSetDigest: digest("6"),
    },
    {
      rootKind: "initialization_terminal",
      terminalHeadReferenceDigest: digest("7"),
    },
    {
      rootKind: "store_manifest_compare_append_receipt_ledger",
      providerId: manifest.providerBinding.providerId,
      providerPolicyDigest:
        manifest.providerBinding.semanticProviderPolicyDigest,
      receiptCount: 0,
      receiptSetDigest: digest("8"),
      receiptLogicalBytes: 0,
    },
    {
      rootKind: "active_recovery_control",
      activeTransactionCount: 0,
      controlUniverseDigest: digest("9"),
    },
  ];
  if (options.duplicateRootKind === true) {
    roots[5] = {
      rootKind: "quota_index_and_transition_chain",
      currentQuotaIndexRootContentDigest: digest("a"),
      transitionHead: { state: "genesis" },
    };
  }
  if (options.rootAttack === "canonical_tie") {
    roots[5] = {
      rootKind: "store_manifest_complete_set",
      current: manifest,
    };
  }
  if (options.rootAttack === "cross_branch") {
    roots[3] = {
      rootKind: "initialization_terminal",
      currentQuotaIndexRootContentDigest: digest("a"),
      transitionHead: { state: "genesis" },
    } as unknown as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveRootReferenceCandidateV1;
  }
  if (options.rootAttack === "store_current_substitution") {
    const {
      cutContentDigest: _originalCutContentDigest,
      ...substitutedManifestUnsigned
    } = {
      ...manifest,
      generationSetDigest: digest("0"),
    };
    roots[0] = {
      rootKind: "store_manifest_complete_set",
      current: {
        ...substitutedManifestUnsigned,
        cutContentDigest:
          deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestCurrentCutContentDigestReferenceCandidateV1(
            substitutedManifestUnsigned,
          ),
      },
    };
  }
  if (options.rootAttack === "receipt_provider_substitution") {
    roots[4] = {
      ...roots[4] as Extract<
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveRootReferenceCandidateV1,
        { rootKind: "store_manifest_compare_append_receipt_ledger" }
      >,
      providerId: DurableObjectIdentityProviderIdV1Schema.parse(
        "durable-object-provider:native-a",
      ),
    };
  }
  if (options.rootAttack === "receipt_policy_substitution") {
    roots[4] = {
      ...roots[4] as Extract<
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveRootReferenceCandidateV1,
        { rootKind: "store_manifest_compare_append_receipt_ledger" }
      >,
      providerPolicyDigest: digest("0"),
    };
  }
  if (options.rootAttack === "active_count_contradiction") {
    roots[5] = {
      ...roots[5] as Extract<
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveRootReferenceCandidateV1,
        { rootKind: "active_recovery_control" }
      >,
      activeTransactionCount: 1,
    } as unknown as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveRootReferenceCandidateV1;
  }
  if (options.rootAttack === "genesis_omission") {
    roots[1] = {
      ...roots[1] as Extract<
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveRootReferenceCandidateV1,
        { rootKind: "quota_index_and_transition_chain" }
      >,
      transitionHead: {},
    } as unknown as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveRootReferenceCandidateV1;
  }
  const rootRecords: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceRootStreamRecordInternalV1[] =
    roots.map((root) => ({ recordKind: "root", root }));

  let getterReads = 0;
  let rootOwnKeysReads = 0;
  if (options.getterObjectRecord === true) {
    Object.defineProperty(objectRecords[2]!, "contentDigest", {
      configurable: true,
      enumerable: true,
      get() {
        getterReads += 1;
        return digest("3");
      },
    });
  }
  if (options.proxyRoot === true) {
    (rootRecords[0] as unknown as { root: unknown }).root = new Proxy(
      roots[0]!,
      {
        ownKeys(target) {
          rootOwnKeysReads += 1;
          return Reflect.ownKeys(target).concat(
            Array.from(
              { length: 1_000_000 },
              (_, index) => `legacy${index}`,
            ),
          );
        },
      },
    );
  }
  if (options.proxyPrivateLocator === true) {
    const target = Object.freeze(Object.create(null));
    const proxyLocator = Object.freeze(new Proxy(target, {})) as unknown as
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPrivateLocatorReferenceInternalV1;
    locators[2] = proxyLocator;
    (objectRecords[2] as unknown as { privateLocator: object }).privateLocator =
      proxyLocator;
  }

  const slots = new Map<
    string,
    Array<{
      schemaFieldPath: ReturnType<typeof slotPathV1>;
      occurrenceOrdinal: number;
      referenceSlotReferenceDigest: ReturnType<typeof digest>;
      targetPrivateLocator: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPrivateLocatorReferenceInternalV1;
    }>
  >();
  slots.set("root:store_manifest_complete_set", [{
    schemaFieldPath: slotPathV1(0),
    occurrenceOrdinal: 0,
    referenceSlotReferenceDigest: digest("a"),
    targetPrivateLocator: locators[0]!,
  }]);
  slots.set(`object:${digest("1")}`, [{
    schemaFieldPath: slotPathV1(1),
    occurrenceOrdinal: 0,
    referenceSlotReferenceDigest: digest("b"),
    targetPrivateLocator: locators[1]!,
  }]);
  slots.set("root:store_manifest_compare_append_receipt_ledger", [{
    schemaFieldPath: slotPathV1(2),
    occurrenceOrdinal: 0,
    referenceSlotReferenceDigest: digest("c"),
    targetPrivateLocator: locators[2]!,
  }]);
  if (options.missingLastEdge !== true) {
    slots.set(`object:${digest("3")}`, [{
      schemaFieldPath: slotPathV1(3),
      occurrenceOrdinal: 0,
      referenceSlotReferenceDigest: digest("d"),
      targetPrivateLocator: locators[3]!,
    }]);
  }
  if (options.duplicateSlotAttack !== undefined) {
    const firstSlot = slots.get("root:store_manifest_complete_set")![0]!;
    slots.get("root:store_manifest_complete_set")!.push({
      ...firstSlot,
      referenceSlotReferenceDigest:
        options.duplicateSlotAttack === "digest"
          ? digest("e")
          : firstSlot.referenceSlotReferenceDigest,
      targetPrivateLocator:
        options.duplicateSlotAttack === "target"
          ? locators[1]!
          : firstSlot.targetPrivateLocator,
    });
  }
  if (options.danglingSlotTarget === true) {
    slots.get("root:store_manifest_complete_set")![0] = {
      ...slots.get("root:store_manifest_complete_set")![0]!,
      targetPrivateLocator: privateLocatorV1("private/store/dangling"),
    };
  }
  if (options.extraUniqueSlot === true) {
    slots.get("root:store_manifest_complete_set")!.push({
      schemaFieldPath: slotPathV1(4),
      occurrenceOrdinal: 0,
      referenceSlotReferenceDigest: digest("e"),
      targetPrivateLocator: locators[3]!,
    });
  }

  const records: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamRecordInternalV1[] = [
    objectRecords[2]!,
    rootRecords[4]!,
    rootRecords[1]!,
    objectRecords[0]!,
    rootRecords[0]!,
    objectRecords[3]!,
    rootRecords[5]!,
    rootRecords[3]!,
    objectRecords[1]!,
    rootRecords[2]!,
  ];
  if (options.omitAllObjects === true) {
    for (let index = records.length - 1; index >= 0; index -= 1) {
      if (records[index]!.recordKind === "object") records.splice(index, 1);
    }
  } else if (options.omitObjectIndex !== undefined) {
    const omitted = objectRecords[options.omitObjectIndex];
    if (omitted !== undefined) {
      const recordIndex = records.indexOf(omitted);
      if (recordIndex >= 0) records.splice(recordIndex, 1);
    }
  }
  if (options.extraUnreachableObject === true) {
    records.push(objectRecords[4]!);
  }
  if (options.rootAttack === "missing") {
    const recordIndex = records.indexOf(rootRecords[5]!);
    if (recordIndex >= 0) records.splice(recordIndex, 1);
  }
  if (options.rootAttack === "extra") {
    records.push({
      recordKind: "root",
      root: {
        rootKind: "initialization_terminal",
        terminalHeadReferenceDigest: digest("0"),
      },
    });
  }
  if (options.proxyRoot === true) {
    records.splice(records.indexOf(rootRecords[0]!), 1);
    records.unshift(rootRecords[0]!);
  }
  if (options.reverseStream === true) records.reverse();
  let readIndex = 0;
  const calls: SourceMachineCallsV1 = {
    open: 0,
    read: 0,
    eof: 0,
    locator: 0,
    slots: 0,
    continuity: 0,
    getterReads: 0,
    eventMintReplayRejects: 0,
    rootOwnKeysReads: 0,
    slotIndexGetterReads: 0,
    slotNestedMutations: 0,
    slotArrayOwnKeysReads: 0,
    slotOwnKeysReads: 0,
    hostReturnThenReads: 0,
    schemaDigests: [],
  };
  function wrapHostReturnV1<T extends object>(
    kind: NonNullable<SourceMachineFixtureOptionsV1["hostileThenableHostReturn"]>,
    value: T,
  ): T {
    if (options.hostileThenableHostReturn !== kind) return value;
    return new Proxy(value, {
      get(target, key, receiver) {
        if (key === "then") {
          calls.hostReturnThenReads += 1;
          throw new Error("source host return then must not be observed");
        }
        return Reflect.get(target, key, receiver);
      },
    });
  }
  let nestedSlotMutationPerformed = false;
  let firstEventCapability:
    | ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamEventCapabilityInternalV1
    | undefined;
  const freezeToken = options.freezeToken ?? Object.freeze(Object.create(null));
  const cohortIdentity = options.cohortIdentity ??
    Object.freeze(Object.create(null));
  const streamHost = Object.freeze({
    openSourceFreeze() {
      calls.open += 1;
      return wrapHostReturnV1(
        "open",
        Object.freeze({ freezeToken, sourceFreezeStateReferenceDigest }),
      );
    },
    readNext(
      actualFreezeToken: object,
      eventMintCapability: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamEventMintCapabilityInternalV1,
    ) {
      expect(actualFreezeToken).toBe(freezeToken);
      calls.read += 1;
      const override = options.eventCapabilityOverride?.(calls.read);
      if (override !== undefined) {
        return override as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamEventCapabilityInternalV1;
      }
      const record = records[readIndex];
      readIndex += 1;
      if (
        options.replayFirstEventCapabilityOnSecondRead === true &&
        calls.read === 2 &&
        firstEventCapability !== undefined
      ) {
        return firstEventCapability;
      }
      let capability: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamEventCapabilityInternalV1;
      if (record === undefined) {
        calls.eof += 1;
        capability = mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceEofStreamEventCapabilityInternalV1(
          eventMintCapability,
        );
      } else {
        capability = mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamRecordEventCapabilityInternalV1(
          eventMintCapability,
          record,
        );
      }
      firstEventCapability ??= capability;
      if (options.doubleMintFirstEvent === true && calls.read === 1) {
        try {
          mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceEofStreamEventCapabilityInternalV1(
            eventMintCapability,
          );
        } catch (error) {
          expect(
            isProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineErrorInternalV1(
              error,
            ),
          ).toBe(true);
          calls.eventMintReplayRejects += 1;
        }
      }
      return (options.eventCapabilityTransform?.(capability, calls.read) ??
        capability) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamEventCapabilityInternalV1;
    },
    deriveLocatorCommitment(
      actualFreezeToken: object,
      actualSchemaDigest: ReturnType<typeof digest>,
      locator: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPrivateLocatorReferenceInternalV1,
    ) {
      expect(actualFreezeToken).toBe(freezeToken);
      calls.locator += 1;
      calls.schemaDigests.push(actualSchemaDigest);
      const index = locators.indexOf(locator);
      if (index < 0) throw new TypeError("unknown private locator");
      if (options.mutateAfterStart === true && index === 2) {
        const mutable = objectRecords[2] as unknown as Record<string, unknown>;
        mutable.contentDigest = digest("f");
        mutable.objectKind = "control_state";
        mutable.privateLocator = privateLocatorV1("mutated/private/locator");
      }
      const semanticIndex = options.duplicateSemanticTuple === true && index === 1
        ? 0
        : index;
      return wrapHostReturnV1(
        "locator",
        Object.freeze({
          logicalLocatorReferenceDigest: digest(
            ["5", "6", "7", "8", "d"][index]!,
          ),
          semanticLocatorDigest: digest(
            ["9", "a", "b", "c", "e"][semanticIndex]!,
          ),
        }),
      );
    },
    enumerateReferenceSlots(
      actualFreezeToken: object,
      actualSchemaDigest: ReturnType<typeof digest>,
      source: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamRecordInternalV1,
    ) {
      expect(actualFreezeToken).toBe(freezeToken);
      calls.slots += 1;
      calls.schemaDigests.push(actualSchemaDigest);
      if (
        options.oversizedReferenceSlots === true &&
        calls.slots === 1
      ) {
        return Object.freeze(
          new Array(4_000_001),
        ) as readonly ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalReferenceSlotInternalV1[];
      }
      if (
        options.referenceSlotAttack !== undefined &&
        calls.slots === 1
      ) {
        const firstSlot = slots.get("root:store_manifest_complete_set")![0]!;
        if (options.referenceSlotAttack === "length_drift") {
          let lengthDescriptorReads = 0;
          return new Proxy([], {
            getOwnPropertyDescriptor(target, property) {
              const descriptor = Reflect.getOwnPropertyDescriptor(
                target,
                property,
              );
              if (property !== "length" || descriptor === undefined) {
                return descriptor;
              }
              lengthDescriptorReads += 1;
              return {
                ...descriptor,
                value: lengthDescriptorReads === 1 ? 0 : 1,
              };
            },
          }) as readonly ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalReferenceSlotInternalV1[];
        }
        if (options.referenceSlotAttack === "index_accessor") {
          const accessorSlots: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalReferenceSlotInternalV1[] = [];
          Object.defineProperty(accessorSlots, "0", {
            configurable: true,
            enumerable: true,
            get() {
              calls.slotIndexGetterReads += 1;
              return firstSlot;
            },
          });
          return accessorSlots;
        }
        if (options.referenceSlotAttack === "sparse") {
          return new Array(1) as readonly ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalReferenceSlotInternalV1[];
        }
        if (options.referenceSlotAttack === "index_replacement") {
          const replacement = {
            ...firstSlot,
            referenceSlotReferenceDigest: digest("e"),
          };
          let indexDescriptorReads = 0;
          return new Proxy([firstSlot], {
            getOwnPropertyDescriptor(target, property) {
              const descriptor = Reflect.getOwnPropertyDescriptor(
                target,
                property,
              );
              if (property !== "0" || descriptor === undefined) {
                return descriptor;
              }
              indexDescriptorReads += 1;
              return {
                ...descriptor,
                value: indexDescriptorReads === 1
                  ? firstSlot
                  : replacement,
              };
            },
          });
        }
        const driftingSlot = { ...firstSlot };
        let digestDescriptorReads = 0;
        const driftingSlotProxy = new Proxy(driftingSlot, {
          getOwnPropertyDescriptor(target, property) {
            const descriptor = Reflect.getOwnPropertyDescriptor(
              target,
              property,
            );
            if (
              property !== "referenceSlotReferenceDigest" ||
              descriptor === undefined
            ) {
              return descriptor;
            }
            digestDescriptorReads += 1;
            return {
              ...descriptor,
              value: digestDescriptorReads === 1
                ? descriptor.value
                : digest("e"),
            };
          },
        });
        return [driftingSlotProxy];
      }
      if (options.mutateAfterStart === true && calls.slots === 1) {
        const mutableTransitionHead = (
          roots[1] as unknown as {
            transitionHead: Record<string, unknown>;
          }
        ).transitionHead;
        mutableTransitionHead.state = "mutated";
        (rootRecords[2] as unknown as { root: unknown }).root = {
          rootKind: "initialization_terminal",
          terminalHeadReferenceDigest: digest("f"),
        };
      }
      const sourceKey = source.recordKind === "root"
        ? `root:${source.root.rootKind}`
        : `object:${source.contentDigest}`;
      const selectedSlots = slots.get(sourceKey) ?? [];
      const orderedSelectedSlots =
        options.reverseReferenceSlotOrder === true
          ? [...selectedSlots].reverse()
          : selectedSlots;
      if (
        options.referenceSlotArrayExtraNameFlood === true &&
        calls.slots === 1
      ) {
        const arrayTarget = [...orderedSelectedSlots];
        return new Proxy(arrayTarget, {
          ownKeys(target) {
            calls.slotArrayOwnKeysReads += 1;
            return Reflect.ownKeys(target).concat(
              Array.from(
                { length: 1_000_000 },
                (_, index) => `legacy${index}`,
              ),
            );
          },
        });
      }
      if (
        options.referenceSlotExtraNameFlood === true &&
        calls.slots === 1 &&
        orderedSelectedSlots.length > 0
      ) {
        const [firstSelectedSlot, ...remainingSlots] = orderedSelectedSlots;
        const slotTarget = {
          ...firstSelectedSlot!,
          legacyExtra: true,
        };
        const slotProxy = new Proxy(slotTarget, {
          ownKeys(target) {
            calls.slotOwnKeysReads += 1;
            return Reflect.ownKeys(target).concat(
              Array.from(
                { length: 1_000_000 },
                (_, index) => `legacy${index}`,
              ),
            );
          },
        });
        return [slotProxy, ...remainingSlots];
      }
      if (
        options.mutateNestedSlotAfterSnapshot === true &&
        !nestedSlotMutationPerformed &&
        orderedSelectedSlots.length > 0
      ) {
        let indexDescriptorReads = 0;
        return new Proxy([...orderedSelectedSlots], {
          getOwnPropertyDescriptor(target, property) {
            const descriptor = Reflect.getOwnPropertyDescriptor(
              target,
              property,
            );
            if (property !== "0" || descriptor === undefined) {
              return descriptor;
            }
            indexDescriptorReads += 1;
            if (indexDescriptorReads === 2) {
              const mutableSlot = descriptor.value as {
                referenceSlotReferenceDigest: ReturnType<typeof digest>;
              };
              mutableSlot.referenceSlotReferenceDigest = digest("f");
              nestedSlotMutationPerformed = true;
              calls.slotNestedMutations += 1;
            }
            return descriptor;
          },
        });
      }
      return wrapHostReturnV1("slots", Object.freeze(orderedSelectedSlots));
    },
    observeSourceContinuity(actualFreezeToken: object) {
      expect(actualFreezeToken).toBe(freezeToken);
      calls.continuity += 1;
      return wrapHostReturnV1(
        "continuity",
        Object.freeze({
          sourceFreezeStateReferenceDigest:
            options.continuityDrift === true ||
                (options.postContinuityDrift === true && calls.continuity === 2)
            ? digest("4")
            : sourceFreezeStateReferenceDigest,
        }),
      );
    },
  });
  const capability =
    mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineInternalV1({
      cohortIdentity,
      sourceInstallationIdentityGenerationId:
        installationIdentityGenerationId,
      sourceTrustClosureContentDigest: digest("1"),
      sourceStoreManifest: manifest,
      verifiedLiveReferenceSchemaDigest: liveReferenceSchemaDigest,
      streamHost,
    });
  Object.defineProperty(calls, "getterReads", {
    enumerable: true,
    get: () => getterReads,
  });
  Object.defineProperty(calls, "rootOwnKeysReads", {
    enumerable: true,
    get: () => rootOwnKeysReads,
  });
  return { capability, calls, cohortIdentity, privatePathLabels };
}

async function expectSourceFailureV1(
  fixture: SourceMachineFixtureV1,
  stage: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineStageInternalV1,
  reason: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineReasonInternalV1 =
    "source_invalid",
  assertionMessage?: string,
): Promise<void> {
  try {
    await readProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureInternalV1(
      fixture.capability,
    );
    throw new Error("expected source machine failure");
  } catch (error) {
    expect(
      isProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineErrorInternalV1(
        error,
      ),
    ).toBe(true);
    if (
      isProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineErrorInternalV1(
        error,
      )
    ) {
      expect(error.stage, assertionMessage).toBe(stage);
      expect(error.reason, assertionMessage).toBe(reason);
    }
  }
}

describe("D-41 source reference machine internals", () => {
  it("builds a sorted, reachable six-root/4-object/4-edge closure from one exact EOF cut", async () => {
    const fixture = sourceMachineFixtureV1();
    expect(() =>
      assertProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineBindingInternalV1(
        fixture.capability,
        fixture.cohortIdentity,
        installationIdentityGenerationId,
      ),
    ).not.toThrow();
    const { completeSourceReadClosure: closure, continuityHandle } =
      await readProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureInternalV1(
        fixture.capability,
      );

    expect(Object.isFrozen(continuityHandle)).toBe(true);
    expect(Object.getPrototypeOf(continuityHandle)).toBeNull();
    expect(Reflect.ownKeys(continuityHandle)).toEqual([]);

    expect(
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureReferenceCandidateV1Schema.safeParse(
        closure,
      ).success,
    ).toBe(true);
    expect(closure.rootCount).toBe(6);
    expect(closure.objectCount).toBe(4);
    expect(closure.referenceCount).toBe(4);
    expect(closure.logicalObjectBytesTotal).toBe(100);
    expect(closure.roots.map(({ rootOrdinal }) => rootOrdinal)).toEqual([
      0, 1, 2, 3, 4, 5,
    ]);
    expect(closure.objects.map(({ objectOrdinal }) => objectOrdinal)).toEqual([
      0, 1, 2, 3,
    ]);
    expect(closure.references.map(({ edgeOrdinal }) => edgeOrdinal)).toEqual([
      0, 1, 2, 3,
    ]);
    expect(closure.rootSetDigest).toBe(
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveRootSetDigestReferenceCandidateV1(
        { entries: closure.roots },
      ),
    );
    expect(closure.objectSetDigest).toBe(
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveObjectSetDigestReferenceCandidateV1(
        { entries: closure.objects },
      ),
    );
    expect(closure.referenceSetDigest).toBe(
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveReferenceSetDigestReferenceCandidateV1(
        { entries: closure.references },
      ),
    );
    expect(closure.canonicalRootSetBytes).toBe(
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCanonicalRootSetBytesReferenceCandidateV1(
        { entries: closure.roots },
      ),
    );
    expect(closure.canonicalObjectSetBytes).toBe(
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCanonicalObjectSetBytesReferenceCandidateV1(
        { entries: closure.objects },
      ),
    );
    expect(closure.canonicalReferenceSetBytes).toBe(
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCanonicalReferenceSetBytesReferenceCandidateV1(
        { entries: closure.references },
      ),
    );
    expect(closure.canonicalUniverseBytes).toBe(
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCanonicalUniverseBytesReferenceCandidateV1(
        {
          roots: closure.roots,
          objects: closure.objects,
          references: closure.references,
        },
      ),
    );
    expect(closure.logicalObjectBytesTotal).toBe(
      checkedSumProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLogicalObjectBytesReferenceCandidateV1(
        closure.objects,
      ),
    );
    expect(closure.completeReadClosureContentDigest).toBe(
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureContentDigestReferenceCandidateV1(
        closure,
      ),
    );
    expect(fixture.calls).toMatchObject({
      open: 1,
      read: 11,
      eof: 1,
      locator: 4,
      slots: 10,
      continuity: 1,
    });
    expect(fixture.calls.schemaDigests).toHaveLength(14);
    expect(
      fixture.calls.schemaDigests.every(
        (value) => value === liveReferenceSchemaDigest,
      ),
    ).toBe(true);
    const serialized = JSON.stringify(closure);
    for (const privatePath of fixture.privatePathLabels) {
      expect(serialized).not.toContain(privatePath);
    }
    await expect(
      captureProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPostSourceContinuityInternalV1(
        { continuityHandle },
      ),
    ).resolves.toEqual({ sourceFreezeStateReferenceDigest });
    expect(fixture.calls.continuity).toBe(2);
    await expect(
      captureProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPostSourceContinuityInternalV1(
        { continuityHandle },
      ),
    ).rejects.toMatchObject({
      stage: "continuity",
      reason: "capability_invalid",
    });
    expect(fixture.calls.continuity).toBe(2);
    await expectSourceFailureV1(fixture, "capability", "capability_invalid");
    expect(fixture.calls.open).toBe(1);
  });

  it.each(["open", "locator", "slots", "continuity"] as const)(
    "does not read then from a hostile synchronous %s host return",
    async (kind) => {
      const fixture = sourceMachineFixtureV1({
        hostileThenableHostReturn: kind,
      });
      await expect(
        readProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureInternalV1(
          fixture.capability,
        ),
      ).resolves.toBeDefined();
      expect(fixture.calls.hostReturnThenReads).toBe(0);
    },
  );

  it("keeps read and post-continuity Promise fulfillments nonthenable", async () => {
    const previousThen = Object.getOwnPropertyDescriptor(Object.prototype, "then");
    let reads = 0;
    const fixture = sourceMachineFixtureV1();
    try {
      Object.defineProperty(Object.prototype, "then", {
        configurable: true,
        get() {
          reads += 1;
          throw new Error("prototype then must not be read");
        },
      });
      const result =
        await readProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureInternalV1(
          fixture.capability,
        );
      await captureProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPostSourceContinuityInternalV1(
        { continuityHandle: result.continuityHandle },
      );
    } finally {
      if (previousThen === undefined) {
        delete (Object.prototype as { then?: unknown }).then;
      } else {
        Object.defineProperty(Object.prototype, "then", previousThen);
      }
    }
    expect(reads).toBe(0);
  });

  it("canonicalizes stream order independently of source emission order", async () => {
    const forward = sourceMachineFixtureV1();
    const reverse = sourceMachineFixtureV1({ reverseStream: true });
    const [forwardResult, reverseResult] = await Promise.all([
      readProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureInternalV1(
        forward.capability,
      ),
      readProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureInternalV1(
        reverse.capability,
      ),
    ]);
    expect(reverseResult.completeSourceReadClosure).toEqual(
      forwardResult.completeSourceReadClosure,
    );
    await Promise.all([
      captureProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPostSourceContinuityInternalV1(
        { continuityHandle: forwardResult.continuityHandle },
      ),
      captureProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPostSourceContinuityInternalV1(
        { continuityHandle: reverseResult.continuityHandle },
      ),
    ]);
  });

  it("uses detached stable records after host awaits despite nested root, record, and private-locator replacement", async () => {
    const baseline = sourceMachineFixtureV1();
    const mutating = sourceMachineFixtureV1({ mutateAfterStart: true });
    const [baselineResult, mutatingResult] = await Promise.all([
      readProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureInternalV1(
        baseline.capability,
      ),
      readProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureInternalV1(
        mutating.capability,
      ),
    ]);
    expect(mutatingResult.completeSourceReadClosure).toEqual(
      baselineResult.completeSourceReadClosure,
    );
    await Promise.all([
      captureProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPostSourceContinuityInternalV1(
        { continuityHandle: baselineResult.continuityHandle },
      ),
      captureProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPostSourceContinuityInternalV1(
        { continuityHandle: mutatingResult.continuityHandle },
      ),
    ]);
  });

  it("rejects accessors without invoking them and snapshots Proxy-backed roots without own-key enumeration", async () => {
    const getter = sourceMachineFixtureV1({ getterObjectRecord: true });
    await expectSourceFailureV1(getter, "source_stream");
    expect(getter.calls).toMatchObject({
      getterReads: 0,
      locator: 0,
      slots: 0,
      continuity: 0,
    });

    const proxyRoot = sourceMachineFixtureV1({ proxyRoot: true });
    await expect(
      readProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureInternalV1(
        proxyRoot.capability,
      ),
    ).resolves.toBeDefined();
    expect(proxyRoot.calls.rootOwnKeysReads).toBe(0);

    const proxyPrivateLocator = sourceMachineFixtureV1({
      proxyPrivateLocator: true,
    });
    await expect(
      readProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureInternalV1(
        proxyPrivateLocator.capability,
      ),
    ).resolves.toBeDefined();
  });

  it("rejects forged, copied, extra, and Proxy event wrappers by identity without reflecting on them", async () => {
    let proxyOwnKeysReads = 0;
    let proxyGetterReads = 0;
    let proxyDescriptorReads = 0;
    const attacks: readonly (readonly [
      string,
      (
        capability: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamEventCapabilityInternalV1,
      ) => unknown,
    ])[] = [
      ["forged", () => Object.freeze(Object.create(null))],
      ["copied", (capability) => Object.freeze({ ...capability })],
      ["extra", (capability) => Object.freeze({ capability, extra: true })],
      [
        "proxy",
        (capability) => new Proxy(capability, {
          get(target, property, receiver) {
            proxyGetterReads += 1;
            return Reflect.get(target, property, receiver);
          },
          getOwnPropertyDescriptor(target, property) {
            proxyDescriptorReads += 1;
            return Reflect.getOwnPropertyDescriptor(target, property);
          },
          ownKeys(target) {
            proxyOwnKeysReads += 1;
            return Reflect.ownKeys(target).concat(
              Array.from(
                { length: 1_000_000 },
                (_, index) => `legacy${index}`,
              ),
            );
          },
        }),
      ],
    ];
    for (const [_label, attack] of attacks) {
      const fixture = sourceMachineFixtureV1({
        eventCapabilityTransform(capability, readOrdinal) {
          expect(Reflect.ownKeys(capability)).toEqual([]);
          return readOrdinal === 1 ? attack(capability) : capability;
        },
      });
      await expectSourceFailureV1(fixture, "source_stream");
      expect(fixture.calls).toMatchObject({
        read: 1,
        locator: 0,
        slots: 0,
        continuity: 0,
      });
    }
    expect(proxyOwnKeysReads).toBe(0);
    expect(proxyGetterReads).toBe(0);
    expect(proxyDescriptorReads).toBe(0);
  });

  it("burns each event mint and returned event capability exactly once", async () => {
    const doubleMint = sourceMachineFixtureV1({ doubleMintFirstEvent: true });
    await expect(
      readProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureInternalV1(
        doubleMint.capability,
      ),
    ).resolves.toBeDefined();
    expect(doubleMint.calls.eventMintReplayRejects).toBe(1);

    const replay = sourceMachineFixtureV1({
      replayFirstEventCapabilityOnSecondRead: true,
    });
    await expectSourceFailureV1(replay, "source_stream");
    expect(replay.calls).toMatchObject({
      read: 2,
      locator: 1,
      slots: 0,
      continuity: 0,
    });
  });

  it("preserves a genuine event capability after a foreign machine rejects it", async () => {
    const sharedCohort = Object.freeze(Object.create(null));
    const sharedFreeze = Object.freeze(Object.create(null));
    let foreignCapability:
      | ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamEventCapabilityInternalV1
      | undefined;
    const recipient = sourceMachineFixtureV1({
      cohortIdentity: sharedCohort,
      freezeToken: sharedFreeze,
      eventCapabilityOverride: (readOrdinal) =>
        readOrdinal === 1 ? foreignCapability : undefined,
    });
    let recipientRead:
      | ReturnType<
          typeof readProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureInternalV1
        >
      | undefined;
    const owner = sourceMachineFixtureV1({
      cohortIdentity: sharedCohort,
      freezeToken: sharedFreeze,
      eventCapabilityTransform(capability, readOrdinal) {
        if (readOrdinal !== 1) return capability;
        foreignCapability = capability;
        recipientRead =
          readProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureInternalV1(
            recipient.capability,
          );
        return capability;
      },
    });
    await expect(
      readProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureInternalV1(
        owner.capability,
      ),
    ).resolves.toBeDefined();
    if (recipientRead === undefined) throw new TypeError("missing recipient read");
    await expect(recipientRead).rejects.toMatchObject({
      stage: "source_stream",
      reason: "source_invalid",
    });
    expect(owner.calls).toMatchObject({ read: 11, continuity: 1 });
    expect(recipient.calls).toMatchObject({ read: 1, locator: 0, continuity: 0 });
  });

  it("rejects event capabilities across machine, cohort, freeze, sequence, and EOF bindings", async () => {
    const forged = () => Object.freeze(Object.create(null));
    async function stealCapabilityV1(
      options: SourceMachineFixtureOptionsV1,
      readOrdinal: number,
    ): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamEventCapabilityInternalV1> {
      let stolen:
        | ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamEventCapabilityInternalV1
        | undefined;
      const donor = sourceMachineFixtureV1({
        ...options,
        eventCapabilityTransform(capability, actualReadOrdinal) {
          if (actualReadOrdinal !== readOrdinal) return capability;
          stolen = capability;
          return forged();
        },
      });
      await expectSourceFailureV1(donor, "source_stream");
      expect(stolen).toBeDefined();
      return stolen!;
    }

    const sharedCohort = Object.freeze(Object.create(null));
    const sharedFreeze = Object.freeze(Object.create(null));
    const crossMachine = await stealCapabilityV1(
      { cohortIdentity: sharedCohort, freezeToken: sharedFreeze },
      1,
    );
    await expectSourceFailureV1(
      sourceMachineFixtureV1({
        cohortIdentity: sharedCohort,
        freezeToken: sharedFreeze,
        eventCapabilityOverride: (readOrdinal) =>
          readOrdinal === 1 ? crossMachine : undefined,
      }),
      "source_stream",
    );

    const crossFreeze = await stealCapabilityV1(
      { cohortIdentity: sharedCohort },
      1,
    );
    await expectSourceFailureV1(
      sourceMachineFixtureV1({
        cohortIdentity: sharedCohort,
        freezeToken: Object.freeze(Object.create(null)),
        eventCapabilityOverride: (readOrdinal) =>
          readOrdinal === 1 ? crossFreeze : undefined,
      }),
      "source_stream",
    );

    const crossCohort = await stealCapabilityV1(
      { freezeToken: sharedFreeze },
      1,
    );
    await expectSourceFailureV1(
      sourceMachineFixtureV1({
        cohortIdentity: Object.freeze(Object.create(null)),
        freezeToken: sharedFreeze,
        eventCapabilityOverride: (readOrdinal) =>
          readOrdinal === 1 ? crossCohort : undefined,
      }),
      "source_stream",
    );

    const sequenceBoundEof = await stealCapabilityV1({}, 11);
    await expectSourceFailureV1(
      sourceMachineFixtureV1({
        eventCapabilityOverride: (readOrdinal) =>
          readOrdinal === 1 ? sequenceBoundEof : undefined,
      }),
      "source_stream",
    );
  });

  it("rejects missing, extra, duplicate, binding-substituted, and cross-namespace objects before returning a closure", async () => {
    const attacks = [
      [{ omitAllObjects: true }, "source_stream"],
      [{ omitObjectIndex: 3 }, "reference_slot_enumeration"],
      [{ extraUnreachableObject: true }, "source_closure"],
      [{ duplicatePrivateLocator: true }, "source_stream"],
      [{ duplicateSemanticTuple: true }, "locator_derivation"],
      [{ providerBindingSubstitution: "destination" }, "source_stream"],
      [{ providerBindingSubstitution: "historical" }, "source_stream"],
      [{ providerBindingSubstitution: "other" }, "source_stream"],
      [{ wrongReceiptNamespace: true }, "source_stream"],
      [{ wrongStoreNamespace: true }, "source_stream"],
    ] as const satisfies readonly (readonly [
      SourceMachineFixtureOptionsV1,
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineStageInternalV1,
    ])[];
    for (const [options, stage] of attacks) {
      await expectSourceFailureV1(
        sourceMachineFixtureV1(options),
        stage,
        "source_invalid",
        JSON.stringify(options),
      );
    }
  });

  it("rejects non-exact, canonical-tied, cross-branch, and source-binding-substituted six-root sets", async () => {
    const attacks = [
      [{ rootAttack: "missing" }, "source_stream"],
      [{ rootAttack: "extra" }, "source_stream"],
      [{ duplicateRootKind: true }, "source_closure"],
      [{ rootAttack: "canonical_tie" }, "source_closure"],
      [{ rootAttack: "cross_branch" }, "source_stream"],
      [{ rootAttack: "store_current_substitution" }, "source_closure"],
      [{ rootAttack: "receipt_provider_substitution" }, "source_closure"],
      [{ rootAttack: "receipt_policy_substitution" }, "source_closure"],
      [{ rootAttack: "active_count_contradiction" }, "source_stream"],
      [{ rootAttack: "genesis_omission" }, "source_stream"],
    ] as const satisfies readonly (readonly [
      SourceMachineFixtureOptionsV1,
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineStageInternalV1,
    ])[];
    for (const [options, stage] of attacks) {
      await expectSourceFailureV1(
        sourceMachineFixtureV1(options),
        stage,
        "source_invalid",
        JSON.stringify(options),
      );
    }
  });

  it("rejects missing/dangling slots and same-slot digest/target multi-edges while canonicalizing complete slot order", async () => {
    const attacks = [
      [{ missingLastEdge: true }, "source_closure"],
      [{ danglingSlotTarget: true }, "reference_slot_enumeration"],
      [{ duplicateSlotAttack: "exact" }, "reference_slot_enumeration"],
      [{ duplicateSlotAttack: "digest" }, "reference_slot_enumeration"],
      [{ duplicateSlotAttack: "target" }, "reference_slot_enumeration"],
    ] as const satisfies readonly (readonly [
      SourceMachineFixtureOptionsV1,
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineStageInternalV1,
    ])[];
    for (const [options, stage] of attacks) {
      await expectSourceFailureV1(sourceMachineFixtureV1(options), stage);
    }

    const forward = sourceMachineFixtureV1({ extraUniqueSlot: true });
    const reversed = sourceMachineFixtureV1({
      extraUniqueSlot: true,
      reverseReferenceSlotOrder: true,
    });
    const [forwardResult, reversedResult] = await Promise.all([
      readProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureInternalV1(
        forward.capability,
      ),
      readProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureInternalV1(
        reversed.capability,
      ),
    ]);
    expect(forwardResult.completeSourceReadClosure.referenceCount).toBe(5);
    expect(reversedResult.completeSourceReadClosure).toEqual(
      forwardResult.completeSourceReadClosure,
    );
  });

  it("rejects the 4,000,001st reference slot before processing the sparse host array", async () => {
    const fixture = sourceMachineFixtureV1({
      oversizedReferenceSlots: true,
    });
    await expectSourceFailureV1(
      fixture,
      "reference_slot_enumeration",
    );
    expect(fixture.calls.slots).toBe(1);
    expect(fixture.calls.continuity).toBe(0);
  });

  it("rejects hostile slot-array descriptors without invoking index accessors or later host calls", async () => {
    const attacks = [
      "length_drift",
      "index_accessor",
      "sparse",
      "index_replacement",
      "slot_field_drift",
    ] as const;
    for (const referenceSlotAttack of attacks) {
      const fixture = sourceMachineFixtureV1({ referenceSlotAttack });
      await expectSourceFailureV1(
        fixture,
        "reference_slot_enumeration",
      );
      expect(fixture.calls).toMatchObject({
        slots: 1,
        continuity: 0,
        slotIndexGetterReads: 0,
      });
    }
  });

  it("normalizes slot arrays and slot records without enumerating million extra names", async () => {
    const baseline = sourceMachineFixtureV1();
    const arrayFlood = sourceMachineFixtureV1({
      referenceSlotArrayExtraNameFlood: true,
    });
    const slotFlood = sourceMachineFixtureV1({
      referenceSlotExtraNameFlood: true,
    });
    const [baselineResult, arrayFloodResult, slotFloodResult] =
      await Promise.all([
        readProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureInternalV1(
          baseline.capability,
        ),
        readProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureInternalV1(
          arrayFlood.capability,
        ),
        readProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureInternalV1(
          slotFlood.capability,
        ),
      ]);
    expect(arrayFlood.calls.slotArrayOwnKeysReads).toBe(0);
    expect(slotFlood.calls.slotOwnKeysReads).toBe(0);
    expect(arrayFloodResult.completeSourceReadClosure).toEqual(
      baselineResult.completeSourceReadClosure,
    );
    expect(slotFloodResult.completeSourceReadClosure).toEqual(
      baselineResult.completeSourceReadClosure,
    );
  });

  it("uses the frozen slot snapshot when index verification mutates the original nested slot", async () => {
    const baseline = sourceMachineFixtureV1();
    const mutating = sourceMachineFixtureV1({
      mutateNestedSlotAfterSnapshot: true,
    });
    const [baselineResult, mutatingResult] = await Promise.all([
      readProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureInternalV1(
        baseline.capability,
      ),
      readProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureInternalV1(
        mutating.capability,
      ),
    ]);
    expect(mutating.calls.slotNestedMutations).toBe(1);
    expect(mutatingResult.completeSourceReadClosure).toEqual(
      baselineResult.completeSourceReadClosure,
    );
    await Promise.all([
      captureProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPostSourceContinuityInternalV1(
        { continuityHandle: baselineResult.continuityHandle },
      ),
      captureProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPostSourceContinuityInternalV1(
        { continuityHandle: mutatingResult.continuityHandle },
      ),
    ]);
  });

  it("rejects post-EOF continuity drift and permanently burns the stream", async () => {
    const fixture = sourceMachineFixtureV1({ continuityDrift: true });
    await expectSourceFailureV1(fixture, "continuity", "continuity_changed");
    expect(fixture.calls.eof).toBe(1);
    await expectSourceFailureV1(fixture, "capability", "capability_invalid");
    expect(fixture.calls.open).toBe(1);
  });

  it("rejects late post-source continuity drift and permanently burns its one-shot handle", async () => {
    const fixture = sourceMachineFixtureV1({ postContinuityDrift: true });
    const result =
      await readProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureInternalV1(
        fixture.capability,
      );
    expect(fixture.calls.continuity).toBe(1);
    await expect(
      captureProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPostSourceContinuityInternalV1(
        { continuityHandle: result.continuityHandle },
      ),
    ).rejects.toMatchObject({
      stage: "continuity",
      reason: "continuity_changed",
    });
    expect(fixture.calls.continuity).toBe(2);
    await expect(
      captureProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPostSourceContinuityInternalV1(
        { continuityHandle: result.continuityHandle },
      ),
    ).rejects.toMatchObject({
      stage: "continuity",
      reason: "capability_invalid",
    });
    expect(fixture.calls.continuity).toBe(2);
  });

  it("rejects substituted binding assertions without burning the owner machine", async () => {
    const wrongCohort = sourceMachineFixtureV1();
    expect(() =>
      assertProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineBindingInternalV1(
        wrongCohort.capability,
        Object.freeze(Object.create(null)),
        installationIdentityGenerationId,
      ),
    ).toThrow(TypeError);
    expect(() =>
      assertProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineBindingInternalV1(
        wrongCohort.capability,
        wrongCohort.cohortIdentity,
        installationIdentityGenerationId,
      ),
    ).not.toThrow();
    await expect(
      readProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureInternalV1(
        wrongCohort.capability,
      ),
    ).resolves.toBeDefined();
    expect(wrongCohort.calls.open).toBe(1);

    const wrongIdentity = sourceMachineFixtureV1();
    expect(() =>
      assertProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineBindingInternalV1(
        wrongIdentity.capability,
        wrongIdentity.cohortIdentity,
        InstallationIdentityGenerationIdV1Schema.parse(
          `installation-identity-generation:${"0".repeat(22)}`,
        ),
      ),
    ).toThrow(TypeError);
    expect(() =>
      assertProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineBindingInternalV1(
        wrongIdentity.capability,
        wrongIdentity.cohortIdentity,
        installationIdentityGenerationId,
      ),
    ).not.toThrow();
    await expect(
      readProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureInternalV1(
        wrongIdentity.capability,
      ),
    ).resolves.toBeDefined();
    expect(wrongIdentity.calls.open).toBe(1);
  });
});
