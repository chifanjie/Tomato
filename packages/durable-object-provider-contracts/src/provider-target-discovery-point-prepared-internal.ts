/** Package-private no-snapshot bridge for the prepared C09-G core. */

import type { PreparedDistributionVerificationContextV1 } from "./provider-real-filesystem-source-internal.js";
import type {
  ProviderTargetDiscoveryPointClosureDiagnosticResultV1,
  ValidateProviderTargetDiscoveryPointClosureV1Input,
} from "./provider-target-discovery-point.js";

const CapturedObjectFreezeV1 = Object.freeze;
const CapturedTypeErrorV1 = TypeError;

type PreparedTargetDiscoveryCoreV1 = (
  input: ValidateProviderTargetDiscoveryPointClosureV1Input,
  context: PreparedDistributionVerificationContextV1,
) => Promise<ProviderTargetDiscoveryPointClosureDiagnosticResultV1>;

let preparedTargetDiscoveryCoreV1:
  | PreparedTargetDiscoveryCoreV1
  | undefined;

export function registerProviderTargetDiscoveryPointPreparedCoreInternalV1(
  core: PreparedTargetDiscoveryCoreV1,
): void {
  if (preparedTargetDiscoveryCoreV1 !== undefined) {
    throw new CapturedTypeErrorV1(
      "prepared target-discovery core is already registered",
    );
  }
  preparedTargetDiscoveryCoreV1 = CapturedObjectFreezeV1(core);
}

export function diagnoseProviderTargetDiscoveryPointPreparedInternalV1(
  input: ValidateProviderTargetDiscoveryPointClosureV1Input,
  context: PreparedDistributionVerificationContextV1,
): Promise<ProviderTargetDiscoveryPointClosureDiagnosticResultV1> {
  if (preparedTargetDiscoveryCoreV1 === undefined) {
    throw new CapturedTypeErrorV1(
      "prepared target-discovery core is unavailable",
    );
  }
  return preparedTargetDiscoveryCoreV1(input, context);
}

CapturedObjectFreezeV1(
  registerProviderTargetDiscoveryPointPreparedCoreInternalV1,
);
CapturedObjectFreezeV1(
  diagnoseProviderTargetDiscoveryPointPreparedInternalV1,
);
