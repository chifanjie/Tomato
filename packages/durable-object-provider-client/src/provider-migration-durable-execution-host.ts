import type {
  ProviderRuntimeIpcCompareCommitResultV1,
  ProviderRuntimeIpcFixedObjectLocatorV1,
  ProviderRuntimeIpcJsonValueV1,
  ProviderRuntimeIpcReadObjectResultV1,
  ProviderRuntimeIpcWriteObjectResultV1,
} from "@understand-code/durable-object-provider-contracts/provider-runtime-ipc-v1";
import type {
  DurableObjectProviderRuntimeClientV1,
  ProviderRuntimeVerifiedSelectionV1,
} from "./provider-runtime-client.js";

export interface CreateProviderMigrationDurableExecutionHostInputV1 {
  readonly sourceClient: DurableObjectProviderRuntimeClientV1;
  readonly destinationClient: DurableObjectProviderRuntimeClientV1;
  readonly sourceVerifiedSelection: ProviderRuntimeVerifiedSelectionV1;
  readonly destinationVerifiedSelection: ProviderRuntimeVerifiedSelectionV1;
}

/** Structural twin of the contracts-private host seam; it is not exported by contracts. */
export interface ProviderMigrationDurableExecutionHostV1 {
  readonly profile: "provider_migration_durable_execution_host_capability_v1";
  readonly sourceProviderId: string;
  readonly destinationProviderId: string;
  readSourceObject(
    locator: ProviderRuntimeIpcFixedObjectLocatorV1,
  ): Promise<ProviderRuntimeIpcReadObjectResultV1>;
  writeDestinationObject(input: {
    readonly locator: ProviderRuntimeIpcFixedObjectLocatorV1;
    readonly logicalBytes: number;
    readonly bytes: string;
  }): Promise<ProviderRuntimeIpcWriteObjectResultV1>;
  compareCommitDestinationJournal(input: {
    readonly expectedRevision: number;
    readonly operationNonce: string;
    readonly phase: string;
    readonly artifacts: Readonly<Record<string, ProviderRuntimeIpcJsonValueV1>>;
  }): Promise<ProviderRuntimeIpcCompareCommitResultV1>;
}

/**
 * Adapts two independently authenticated runtime clients to the contracts-side
 * durable execution host seam. It never accepts lifecycle DTOs or object bytes
 * from its caller.
 */
export function createProviderMigrationDurableExecutionHostV1(
  input: CreateProviderMigrationDurableExecutionHostInputV1,
): ProviderMigrationDurableExecutionHostV1 {
  if (
    input.sourceVerifiedSelection.verification !==
      "caller_verified_registry_selection_v1" ||
    input.destinationVerifiedSelection.verification !==
      "caller_verified_registry_selection_v1" ||
    input.sourceVerifiedSelection.providerId ===
      input.destinationVerifiedSelection.providerId
  ) {
    throw new TypeError("distinct caller-verified source and destination selections are required");
  }
  return Object.freeze({
    profile: "provider_migration_durable_execution_host_capability_v1" as const,
    sourceProviderId: input.sourceVerifiedSelection.providerId,
    destinationProviderId: input.destinationVerifiedSelection.providerId,
    readSourceObject: input.sourceClient.readObject.bind(input.sourceClient),
    writeDestinationObject:
      input.destinationClient.writeObject.bind(input.destinationClient),
    compareCommitDestinationJournal:
      input.destinationClient.compareCommit.bind(input.destinationClient),
  });
}
