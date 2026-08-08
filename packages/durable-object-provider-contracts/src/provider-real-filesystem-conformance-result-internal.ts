/** Package-private no-snapshot bridge for the prepared C09-H core. */

import type {
  ProviderRealFilesystemConformanceResultClosureDiagnosticResultV1,
  ValidateProviderRealFilesystemConformanceResultClosureV1Input,
} from "./provider-real-filesystem-conformance-result.js";
import type { PreparedDistributionVerificationContextV1 } from "./provider-real-filesystem-source-internal.js";

const CapturedObjectFreezeV1 = Object.freeze;
const CapturedTypeErrorV1 = TypeError;

type PreparedConformanceResultCoreV1 = (
  input: ValidateProviderRealFilesystemConformanceResultClosureV1Input,
  context: PreparedDistributionVerificationContextV1,
) => Promise<ProviderRealFilesystemConformanceResultClosureDiagnosticResultV1>;

let preparedConformanceResultCoreV1:
  | PreparedConformanceResultCoreV1
  | undefined;

export function registerProviderRealFilesystemConformanceResultPreparedCoreInternalV1(
  core: PreparedConformanceResultCoreV1,
): void {
  if (preparedConformanceResultCoreV1 !== undefined) {
    throw new CapturedTypeErrorV1(
      "prepared real-filesystem conformance core is already registered",
    );
  }
  preparedConformanceResultCoreV1 = CapturedObjectFreezeV1(core);
}

export function diagnoseProviderRealFilesystemConformanceResultPreparedInternalV1(
  input: ValidateProviderRealFilesystemConformanceResultClosureV1Input,
  context: PreparedDistributionVerificationContextV1,
): Promise<ProviderRealFilesystemConformanceResultClosureDiagnosticResultV1> {
  if (preparedConformanceResultCoreV1 === undefined) {
    throw new CapturedTypeErrorV1(
      "prepared real-filesystem conformance core is unavailable",
    );
  }
  return preparedConformanceResultCoreV1(input, context);
}

CapturedObjectFreezeV1(
  registerProviderRealFilesystemConformanceResultPreparedCoreInternalV1,
);
CapturedObjectFreezeV1(
  diagnoseProviderRealFilesystemConformanceResultPreparedInternalV1,
);
