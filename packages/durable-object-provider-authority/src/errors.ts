export type ProviderAcceptanceAuthorityErrorCodeV1 =
  | "invalid_layout"
  | "not_provisioned"
  | "identity_key_invalid"
  | "namespace_integrity_failed"
  | "authority_busy"
  | "capacity_exhausted"
  | "invalid_request"
  | "io_error";

const REDACTED_MESSAGES_V1: Readonly<
  Record<ProviderAcceptanceAuthorityErrorCodeV1, string>
> = Object.freeze({
  invalid_layout: "provider Acceptance authority layout is unavailable",
  not_provisioned: "provider Acceptance authority is not provisioned",
  identity_key_invalid: "provider Acceptance authority identity is invalid",
  namespace_integrity_failed:
    "provider Acceptance authority namespace integrity failed",
  authority_busy: "provider Acceptance authority is busy",
  capacity_exhausted: "provider Acceptance authority capacity is exhausted",
  invalid_request: "provider Acceptance authority request is invalid",
  io_error: "provider Acceptance authority operation failed",
});

/** A deliberately path-, key-, token-, and request-redacted authority error. */
export class ProviderAcceptanceAuthorityErrorV1 extends Error {
  readonly code: ProviderAcceptanceAuthorityErrorCodeV1;

  constructor(
    code: ProviderAcceptanceAuthorityErrorCodeV1,
    _options?: ErrorOptions,
  ) {
    // Causes from schema and filesystem failures can contain paths, request
    // fragments, or tokens. Keep them outside the observable error object.
    super(REDACTED_MESSAGES_V1[code]);
    this.name = "ProviderAcceptanceAuthorityErrorV1";
    this.code = code;
  }
}

export function isProviderAcceptanceAuthorityErrorV1(
  value: unknown,
): value is ProviderAcceptanceAuthorityErrorV1 {
  return value instanceof ProviderAcceptanceAuthorityErrorV1;
}
