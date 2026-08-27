import { RefreshIndexInputV1Schema } from "@understand-code/contracts";

import {
  ToolFailure,
  invalidArgumentsFailure,
  strongStoreUnavailableFailure,
} from "../errors/tool-errors.js";
import { strongRefreshIndexV1 } from "./strong-refresh-index.js";

/**
 * Only an explicit verified production installation selector can unlock the
 * strong writer. There is deliberately no legacy Snapshot/Pulse write path.
 */
export async function refreshIndex(
  argumentsValue: unknown,
  canonicalRoot: string,
  canonicalInstallationRoot?: string,
  canonicalHostInstallationRoot?: string,
): Promise<unknown> {
  const parsed = RefreshIndexInputV1Schema.safeParse(argumentsValue ?? {});
  if (!parsed.success) {
    throw new ToolFailure(invalidArgumentsFailure(parsed.error));
  }
  if (canonicalInstallationRoot === undefined) failStrongStoreUnavailableV1();
  if (canonicalHostInstallationRoot === undefined) failStrongStoreUnavailableV1();
  return strongRefreshIndexV1(
    parsed.data,
    canonicalRoot,
    canonicalInstallationRoot,
    canonicalHostInstallationRoot,
  );
}

/**
 * Shared public Task/mutation gate while the accepted strong Store authority
 * is unavailable. Callers validate public input first, then invoke this before
 * opening legacy Store state, reading private Task data, or causing a side
 * effect. Strict redacted Repository reads use their separate Surface path.
 */
export function failStrongStoreUnavailableV1(): never {
  throw new ToolFailure(strongStoreUnavailableFailure());
}
