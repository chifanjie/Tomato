import {
  runProviderMigrationDurableExecutionV1,
  type ProviderMigrationDurableExecutionEntrypointResultV1,
  type ProviderMigrationDurableExecutionLifecycleInputV1,
} from "@understand-code/durable-object-provider-contracts/provider-migration-durable-execution";
import type {
  DurableObjectProviderRuntimeClientV1,
  ProviderRuntimeVerifiedSelectionV1,
} from "./provider-runtime-client.js";
import { createProviderMigrationDurableExecutionHostV1 } from "./provider-migration-durable-execution-host.js";

export interface RunProviderMigrationDurableExecutionWithTwoRuntimeClientsInputV1 {
  /** Original lifecycle build input; a prior/reference lifecycle result is not accepted. */
  readonly lifecycleInput: ProviderMigrationDurableExecutionLifecycleInputV1;
  readonly sourceClient: DurableObjectProviderRuntimeClientV1;
  readonly destinationClient: DurableObjectProviderRuntimeClientV1;
  readonly sourceVerifiedSelection: ProviderRuntimeVerifiedSelectionV1;
  readonly destinationVerifiedSelection: ProviderRuntimeVerifiedSelectionV1;
  readonly expectedDurableJournalRevision: number;
  readonly durableOperationNonceSeed: string;
}

/**
 * Runnable package-level bridge: compose two caller-verified runtime clients,
 * then invoke the contracts façade that executes the exact lifecycle itself.
 */
export function runProviderMigrationDurableExecutionWithTwoRuntimeClientsV1(
  input: RunProviderMigrationDurableExecutionWithTwoRuntimeClientsInputV1,
): Promise<ProviderMigrationDurableExecutionEntrypointResultV1> {
  const durableHost = createProviderMigrationDurableExecutionHostV1({
    sourceClient: input.sourceClient,
    destinationClient: input.destinationClient,
    sourceVerifiedSelection: input.sourceVerifiedSelection,
    destinationVerifiedSelection: input.destinationVerifiedSelection,
  });
  return runProviderMigrationDurableExecutionV1({
    lifecycleInput: input.lifecycleInput,
    durableHost,
    expectedDurableJournalRevision: input.expectedDurableJournalRevision,
    durableOperationNonceSeed: input.durableOperationNonceSeed,
  });
}
