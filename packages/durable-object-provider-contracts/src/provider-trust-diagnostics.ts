export type ProviderTrustDiagnosticStageV1 =
  | "bundle_envelope"
  | "bundle_payload_schema"
  | "bundle_root_closure"
  | "compiled_bundle_anchor"
  | "compiled_golden_anchor"
  | "golden_schema"
  | "golden_semantic"
  | "opaque_capability_lookup"
  | "recovery_key_closure"
  | "recovery_key_record"
  | "root_key_record"
  | "root_metadata_envelope"
  | "strict_manifest";

export type ProviderTrustDiagnosticReasonV1 =
  | "bundle_root_metadata_mismatch"
  | "compiled_digest_mismatch"
  | "content_digest_mismatch"
  | "envelope_generation_mismatch"
  | "envelope_key_id_mismatch"
  | "expected_bytes_mismatch"
  | "fixed_resource_identity_mismatch"
  | "key_id_mismatch"
  | "key_material_alias"
  | "manifest_case_coverage_mismatch"
  | "manifest_version_mismatch"
  | "opaque_capability_invalid"
  | "raw_public_key_digest_mismatch"
  | "recovery_signature_order_invalid"
  | "recovery_duplicate"
  | "recovery_order_invalid"
  | "schema_invalid"
  | "self_signature_key_id_mismatch"
  | "predecessor_signature_key_id_mismatch";

export interface ProviderTrustDiagnosticSuccessV1<T> {
  readonly ok: true;
  readonly value: T;
}

export interface ProviderTrustDiagnosticFailureV1 {
  readonly ok: false;
  readonly stage: ProviderTrustDiagnosticStageV1;
  readonly reason: ProviderTrustDiagnosticReasonV1;
}

export type ProviderTrustDiagnosticResultV1<T> =
  | ProviderTrustDiagnosticSuccessV1<T>
  | ProviderTrustDiagnosticFailureV1;

export function providerTrustDiagnosticSuccessInternalV1<T>(
  value: T,
): ProviderTrustDiagnosticSuccessV1<T> {
  return { ok: true, value };
}

export function providerTrustDiagnosticFailureInternalV1(
  stage: ProviderTrustDiagnosticStageV1,
  reason: ProviderTrustDiagnosticReasonV1,
): ProviderTrustDiagnosticFailureV1 {
  return { ok: false, stage, reason };
}
