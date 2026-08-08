import { z } from "./zod-runtime.js";

export const PROVIDER_CAPABILITY_FAILURE_REASONS_V1 = Object.freeze([
  "unavailable",
  "unsupported_filesystem_profile",
  "attestation_invalid",
  "revoked",
  "migration_required",
  "initialization_not_terminalized",
] as const);

export const ProviderCapabilityFailureReasonV1Schema = z.enum(
  PROVIDER_CAPABILITY_FAILURE_REASONS_V1,
);

export type ProviderCapabilityFailureReasonV1 = z.infer<
  typeof ProviderCapabilityFailureReasonV1Schema
>;

export const ProviderUnavailableToolErrorV1Schema = z.strictObject({
  schemaVersion: z.literal(1),
  code: z.literal("provider_unavailable"),
  details: z.strictObject({
    reason: ProviderCapabilityFailureReasonV1Schema,
  }),
});

export type ProviderUnavailableToolErrorV1 = z.infer<
  typeof ProviderUnavailableToolErrorV1Schema
>;

export function createProviderUnavailableToolErrorV1(
  reason: ProviderCapabilityFailureReasonV1,
): ProviderUnavailableToolErrorV1 {
  return {
    schemaVersion: 1,
    code: "provider_unavailable",
    details: {
      reason: ProviderCapabilityFailureReasonV1Schema.parse(reason),
    },
  };
}
