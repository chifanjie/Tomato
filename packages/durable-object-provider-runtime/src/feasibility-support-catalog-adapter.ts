import {
  diagnoseProviderFeasibilitySupportCatalogPointClosureV1,
  type ProviderFeasibilitySupportCatalogPointClosureValidationV1,
  type ValidateProviderFeasibilitySupportCatalogPointClosureV1Input,
  PROVIDER_FEASIBILITY_SUPPORT_CATALOG_AUTHORITY_V1,
} from "@understand-code/durable-object-provider-contracts/provider-feasibility-support-catalog-point";
import { canonicalizeJcsSafeIntegerV1 } from "@understand-code/durable-object-provider-contracts/jcs";

export interface ProviderRuntimeFeasibilitySupportCatalogContextV1
  extends ValidateProviderFeasibilitySupportCatalogPointClosureV1Input {
  readonly validatedClosure:
    ProviderFeasibilitySupportCatalogPointClosureValidationV1;
}

export interface AdaptProviderRuntimeFeasibilitySupportCatalogOptionsV1 {
  readonly context: ProviderRuntimeFeasibilitySupportCatalogContextV1;
}

export interface ProviderRuntimeFeasibilitySupportCatalogAdapterValueV1 {
  readonly authority: typeof PROVIDER_FEASIBILITY_SUPPORT_CATALOG_AUTHORITY_V1;
  readonly accessMode: "read_only";
  readonly strongWriteStatus: "locked";
  readonly closure: ProviderFeasibilitySupportCatalogPointClosureValidationV1;
}

export type ProviderRuntimeFeasibilitySupportCatalogAdapterDiagnosticV1 =
  | {
      readonly ok: true;
      readonly value: ProviderRuntimeFeasibilitySupportCatalogAdapterValueV1;
    }
  | {
      readonly ok: false;
      readonly code: "provider_unavailable";
      readonly reason: "attestation_invalid";
    };

export class ProviderRuntimeFeasibilitySupportCatalogAdapterErrorV1 extends Error {
  readonly code = "provider_unavailable" as const;
  readonly reason = "attestation_invalid" as const;

  constructor() {
    super("Provider runtime feasibility support Catalog adapter rejected input");
    this.name = "ProviderRuntimeFeasibilitySupportCatalogAdapterErrorV1";
  }
}

function canonicalEqualV1(left: unknown, right: unknown): boolean {
  const leftBytes = new TextEncoder().encode(canonicalizeJcsSafeIntegerV1(left));
  const rightBytes = new TextEncoder().encode(canonicalizeJcsSafeIntegerV1(right));
  return leftBytes.byteLength === rightBytes.byteLength &&
    leftBytes.every((value, index) => value === rightBytes[index]);
}

export async function diagnoseProviderRuntimeFeasibilitySupportCatalogAdapterV1(
  options: AdaptProviderRuntimeFeasibilitySupportCatalogOptionsV1,
): Promise<ProviderRuntimeFeasibilitySupportCatalogAdapterDiagnosticV1> {
  try {
    const { validatedClosure, ...input } = options.context;
    const diagnostic = await diagnoseProviderFeasibilitySupportCatalogPointClosureV1(
      input,
    );
    if (!diagnostic.ok) {
      return {
        ok: false,
        code: "provider_unavailable",
        reason: "attestation_invalid",
      };
    }
    if (!canonicalEqualV1(diagnostic.value, validatedClosure)) {
      throw new TypeError("support catalog closure mismatch");
    }
    return {
      ok: true,
      value: {
        authority: PROVIDER_FEASIBILITY_SUPPORT_CATALOG_AUTHORITY_V1,
        accessMode: "read_only",
        strongWriteStatus: "locked",
        closure: diagnostic.value,
      },
    };
  } catch {
    return {
      ok: false,
      code: "provider_unavailable",
      reason: "attestation_invalid",
    };
  }
}

export async function adaptProviderRuntimeFeasibilitySupportCatalogV1(
  options: AdaptProviderRuntimeFeasibilitySupportCatalogOptionsV1,
): Promise<ProviderRuntimeFeasibilitySupportCatalogAdapterValueV1> {
  const diagnostic = await diagnoseProviderRuntimeFeasibilitySupportCatalogAdapterV1(
    options,
  );
  if (!diagnostic.ok) {
    throw new ProviderRuntimeFeasibilitySupportCatalogAdapterErrorV1();
  }
  return diagnostic.value;
}
