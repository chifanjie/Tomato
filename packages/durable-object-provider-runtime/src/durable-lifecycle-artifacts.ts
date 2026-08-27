import type { ProviderRuntimeIpcJsonValueV1 } from "@understand-code/durable-object-provider-contracts/provider-runtime-ipc-v1";

export const PROVIDER_RUNTIME_DURABLE_LIFECYCLE_ARTIFACT_KEYS_V1 =
  Object.freeze([
    "preparedCatalogSuccessor",
    "registryManifest",
    "supportCatalog",
    "formalPlan",
    "formalPlanPin",
    "formalReservation",
    "reservationRecord",
    "compoundPublicationReceipt",
    "migrationOnlyAcceptance",
    "rebindingRegistry",
    "executionProgress",
    "destinationObjectPublications",
    "zeroLive",
    "sourceDrainedRegistry",
    "steadyRegistry",
    "terminalJournal",
    "finalStrongReadyAcceptance",
  ] as const);

export const PROVIDER_RUNTIME_DURABLE_BUSINESS_HEAD_ARTIFACT_KEY_V1 =
  "providerProductionStrongOperation" as const;
export const PROVIDER_RUNTIME_DURABLE_BUSINESS_HEAD_PROFILE_V1 =
  "provider_production_strong_operation_v1" as const;

export interface ProviderRuntimeDurableBusinessHeadV1 {
  readonly profile: typeof PROVIDER_RUNTIME_DURABLE_BUSINESS_HEAD_PROFILE_V1;
  readonly phase: "strong_change_check_v1" | "strong_verification_v1";
  readonly artifacts: Readonly<Record<string, ProviderRuntimeIpcJsonValueV1>>;
}

export interface ProviderRuntimeDurableLifecycleArtifactSetProjectionV1 {
  readonly lifecycleArtifacts: Readonly<
    Record<string, ProviderRuntimeIpcJsonValueV1>
  >;
  readonly businessHead?: ProviderRuntimeDurableBusinessHeadV1;
}

function asRecordV1(value: unknown, label: string): Record<string, unknown> {
  if (
    value === null || typeof value !== "object" || Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new TypeError(`${label} must be a record`);
  }
  return value as Record<string, unknown>;
}

function exactKeysV1(
  value: Record<string, unknown>,
  expected: readonly string[],
): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (
    actual.length !== wanted.length ||
    actual.some((key, index) => key !== wanted[index])
  ) {
    throw new TypeError("durable lifecycle artifact keys are not exact");
  }
}

/**
 * Separates the immutable terminal lifecycle basis from the sole mutable,
 * namespaced business head. Both the Runtime Store and production client use
 * this exact projection, so neither can silently drop or invent lifecycle
 * artifacts while wrapping a business compare.
 */
export function projectProviderRuntimeDurableLifecycleArtifactSetV1(
  artifactsInput: unknown,
): ProviderRuntimeDurableLifecycleArtifactSetProjectionV1 {
  const artifacts = asRecordV1(artifactsInput, "durable journal artifacts");
  const hasBusinessHead = Object.prototype.hasOwnProperty.call(
    artifacts,
    PROVIDER_RUNTIME_DURABLE_BUSINESS_HEAD_ARTIFACT_KEY_V1,
  );
  const businessHead = artifacts[
    PROVIDER_RUNTIME_DURABLE_BUSINESS_HEAD_ARTIFACT_KEY_V1
  ];
  const lifecycleArtifacts = Object.fromEntries(
    Object.entries(artifacts).filter(
      ([key]) =>
        key !== PROVIDER_RUNTIME_DURABLE_BUSINESS_HEAD_ARTIFACT_KEY_V1,
    ),
  ) as Record<string, ProviderRuntimeIpcJsonValueV1>;
  exactKeysV1(
    lifecycleArtifacts,
    PROVIDER_RUNTIME_DURABLE_LIFECYCLE_ARTIFACT_KEYS_V1,
  );

  let parsedBusinessHead: ProviderRuntimeDurableBusinessHeadV1 | undefined;
  if (hasBusinessHead) {
    const envelope = asRecordV1(businessHead, "durable business head");
    exactKeysV1(envelope, ["profile", "phase", "artifacts"]);
    const businessArtifacts = asRecordV1(
      envelope.artifacts,
      "durable business head artifacts",
    );
    if (
      envelope.profile !== PROVIDER_RUNTIME_DURABLE_BUSINESS_HEAD_PROFILE_V1 ||
      (envelope.phase !== "strong_change_check_v1" &&
        envelope.phase !== "strong_verification_v1") ||
      Object.prototype.hasOwnProperty.call(
        businessArtifacts,
        "finalStrongReadyAcceptance",
      ) ||
      Object.prototype.hasOwnProperty.call(
        businessArtifacts,
        PROVIDER_RUNTIME_DURABLE_BUSINESS_HEAD_ARTIFACT_KEY_V1,
      )
    ) {
      throw new TypeError("durable business head is invalid");
    }
    parsedBusinessHead = businessHead as unknown as
      ProviderRuntimeDurableBusinessHeadV1;
  }

  return Object.freeze({
    lifecycleArtifacts: Object.freeze({ ...lifecycleArtifacts }),
    ...(parsedBusinessHead === undefined
      ? {}
      : { businessHead: parsedBusinessHead }),
  });
}
