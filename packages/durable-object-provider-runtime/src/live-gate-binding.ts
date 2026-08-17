import {
  ContentDigestV1Schema,
  DurableObjectIdentityProviderIdV1Schema,
  type ContentDigestV1,
  type DurableObjectIdentityProviderIdV1,
} from "@understand-code/durable-object-provider-contracts/primitives";
import { canonicalizeJcsSafeIntegerV1 } from "@understand-code/durable-object-provider-contracts/jcs";

import {
  projectProviderRuntimeProviderGateV1,
  type ProviderRuntimeProviderGateProjectionInputV1,
  type ProviderRuntimeProviderGateProjectionValueV1,
} from "./provider-gate-projection.js";
import type { ProviderRuntimeRealFilesystemConformanceBindingsV1 } from "./conformance-runner.js";
import {
  verifyProviderServiceHandoffConfigV1,
  readProviderServiceReadinessV1,
  type ProviderServiceHandoffConfigV1,
  type ProviderServiceHandoffInspectionV1,
} from "./service-handoff.js";
import {
  verifyProviderRuntimeLiveServiceReadinessV1,
  type ProviderRuntimeLiveServiceReadinessResultV1,
} from "./live-service-readiness.js";
import type { ProviderRuntimeTargetInspectionV1 } from "./target-inspection.js";

/**
 * This module joins independently verified Gate evidence to a verified live
 * service.  It intentionally stops at a read-only activation candidate: a
 * caller cannot turn this result into Store authority by changing a status
 * field or by substituting one of the signed installation/runtime digests.
 */

export const PROVIDER_RUNTIME_LIVE_GATE_REQUIRED_NEXT_V1 =
  "provider_acceptance_current_and_os_peer_gate" as const;

export interface ProviderRuntimeLiveGateBindingGateValuesV1
  extends ProviderRuntimeProviderGateProjectionInputV1 {
  /**
   * The service inspection is optional here.  When omitted it is derived from
   * the already verified live result and signed handoff solely to re-run the
   * structure-only projection.
   */
  readonly serviceReadiness?: ProviderServiceHandoffInspectionV1;
}

export interface ProviderRuntimeLiveGateBindingOptionsV1 {
  readonly config: ProviderServiceHandoffConfigV1;
  /** Optional caller projection; the verifier below is always authoritative. */
  readonly liveReadiness?: ProviderRuntimeLiveServiceReadinessResultV1;
  /** Private target baseline required for a fresh live continuity/IPC probe. */
  readonly targetBaseline: ProviderRuntimeTargetInspectionV1;
  /** Test/privileged override forwarded to the live verifier. */
  readonly authKey?: Uint8Array;
  readonly timeoutMs?: number;
  readonly readinessReader?: typeof readProviderServiceReadinessV1;
  readonly expectedInstallationIdentityDigest: ContentDigestV1;
  readonly expectedBinaryDigest: ContentDigestV1;
  readonly expectedCapabilityDigest: ContentDigestV1;
  readonly expectedTargetFingerprintDigest: ContentDigestV1;

  /** Preferred complete, independently adapted Gate values. */
  readonly gateValues?: ProviderRuntimeLiveGateBindingGateValuesV1;
  /** Alias accepted for callers that already name this object `values`. */
  readonly values?: ProviderRuntimeLiveGateBindingGateValuesV1;
  /** Alias useful when passing the exact projection input object. */
  readonly projectionInput?: ProviderRuntimeLiveGateBindingGateValuesV1;

  /**
   * A projection is treated as untrusted input.  It is accepted only when
   * complete Gate values are also present and the projection is byte-for-byte
   * equal to a fresh projection computed in this function.
   */
  readonly untrustedProjection?: ProviderRuntimeProviderGateProjectionValueV1;
  readonly projection?: ProviderRuntimeProviderGateProjectionValueV1;
  readonly gateProjection?: ProviderRuntimeProviderGateProjectionValueV1;

  /** Optional unsigned runner bindings; if supplied, all five fields bind. */
  readonly conformanceBindings?: ProviderRuntimeRealFilesystemConformanceBindingsV1;
  readonly candidateBindings?: ProviderRuntimeRealFilesystemConformanceBindingsV1;
}

export interface ProviderRuntimeLiveGateActivationCandidateV1 {
  readonly status: "live_activation_candidate";
  readonly authority: "none";
  readonly accessMode: "read_only";
  readonly strongWriteStatus: "locked";
  readonly requiredNext: typeof PROVIDER_RUNTIME_LIVE_GATE_REQUIRED_NEXT_V1;
  readonly bindings: Readonly<{
    readonly providerId: DurableObjectIdentityProviderIdV1;
    readonly installationIdentityDigest: ContentDigestV1;
    readonly binaryDigest: ContentDigestV1;
    readonly capabilityDigest: ContentDigestV1;
    readonly targetFingerprintDigest: ContentDigestV1;
    readonly targetProfileId: string;
    readonly conformanceResultId: string;
    readonly conformanceContentDigest: ContentDigestV1;
    readonly evidenceId: string;
    readonly evidenceContentDigest: ContentDigestV1;
    readonly catalogContentDigest: ContentDigestV1;
    readonly gateStatus: "candidate_ready";
    readonly gateAuthority: "none";
    readonly gateAccessMode: "read_only";
    readonly gateStrongWriteStatus: "locked";
    readonly liveStatus: "live_candidate";
    readonly liveAuthority: "read_only";
    readonly liveStrongWrites: "locked";
    readonly inspectedRevision: number;
  }>;
}

export interface ProviderRuntimeLiveGateBindingUnavailableV1 {
  readonly status: "unavailable";
  readonly authority: "none";
  readonly accessMode: "read_only";
  readonly strongWriteStatus: "locked";
  readonly reason: "attestation_invalid";
}

export type ProviderRuntimeLiveGateBindingResultV1 =
  | ProviderRuntimeLiveGateActivationCandidateV1
  | ProviderRuntimeLiveGateBindingUnavailableV1;

export type ProviderRuntimeLiveGateBindingDiagnosticV1 =
  | { readonly ok: true; readonly value: ProviderRuntimeLiveGateActivationCandidateV1 }
  | { readonly ok: false; readonly code: "provider_unavailable"; readonly reason: "attestation_invalid" };

export class ProviderRuntimeLiveGateBindingErrorV1 extends Error {
  readonly code = "provider_unavailable" as const;
  readonly reason = "attestation_invalid" as const;

  constructor() {
    super("Provider runtime live Gate binding rejected input");
    this.name = "ProviderRuntimeLiveGateBindingErrorV1";
  }
}

function isRecordV1(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function canonicalEqualV1(left: unknown, right: unknown): boolean {
  try {
    return canonicalizeV1(left) === canonicalizeV1(right);
  } catch {
    return false;
  }
}

function canonicalizeV1(value: unknown): string {
  return canonicalizeJcsSafeIntegerV1(value);
}

function exactKeysV1(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function unavailableV1(): ProviderRuntimeLiveGateBindingUnavailableV1 {
  return Object.freeze({
    status: "unavailable" as const,
    authority: "none" as const,
    accessMode: "read_only" as const,
    strongWriteStatus: "locked" as const,
    reason: "attestation_invalid" as const,
  });
}

function resolveProjectionInputV1(
  input: ProviderRuntimeLiveGateBindingOptionsV1,
): ProviderRuntimeLiveGateBindingGateValuesV1 {
  const aliases = [input.gateValues, input.values, input.projectionInput].filter(
    (value): value is ProviderRuntimeLiveGateBindingGateValuesV1 => value !== undefined,
  );
  if (aliases.length === 0) {
    throw new TypeError("complete Gate values are required");
  }
  const first = aliases[0]!;
  if (aliases.some((value) => !canonicalEqualV1(value, first))) {
    throw new TypeError("Gate value aliases disagree");
  }
  return first;
}

function resolveUntrustedProjectionV1(
  input: ProviderRuntimeLiveGateBindingOptionsV1,
): ProviderRuntimeProviderGateProjectionValueV1 | undefined {
  const aliases = [input.untrustedProjection, input.projection, input.gateProjection].filter(
    (value): value is ProviderRuntimeProviderGateProjectionValueV1 => value !== undefined,
  );
  if (aliases.length === 0) return undefined;
  const first = aliases[0]!;
  if (aliases.some((value) => !canonicalEqualV1(value, first))) {
    throw new TypeError("projection aliases disagree");
  }
  return first;
}

function deriveServiceInspectionV1(
  config: ProviderServiceHandoffConfigV1,
): ProviderServiceHandoffInspectionV1 {
  return {
    status: "signed_candidate",
    authority: "read_only",
    strongWrites: "locked",
    platform: config.payload.platform,
    serviceLabel: config.payload.serviceLabel,
    providerId: config.payload.providerId,
    principalUid: config.payload.principal.uid,
  };
}

function recomputeProjectionV1(
  input: ProviderRuntimeLiveGateBindingOptionsV1,
  config: ProviderServiceHandoffConfigV1,
): ProviderRuntimeProviderGateProjectionValueV1 {
  const values = resolveProjectionInputV1(input);
  const projection = projectProviderRuntimeProviderGateV1({
    ...values,
    serviceReadiness: values.serviceReadiness ?? deriveServiceInspectionV1(config),
  });
  if (
    projection.status !== "candidate_ready" ||
    projection.authority !== "none" ||
    projection.accessMode !== "read_only" ||
    projection.strongWriteStatus !== "locked" ||
    projection.requiredNext !== "signed_registry_qa_release_os_principal_gate" ||
    projection.blockers.length !== 0
  ) {
    throw new TypeError("Gate projection is not a locked candidate");
  }
  const supplied = resolveUntrustedProjectionV1(input);
  if (supplied !== undefined && !canonicalEqualV1(supplied, projection)) {
    throw new TypeError("caller projection does not match recomputed projection");
  }
  return projection;
}

function validateLiveReadinessV1(
  live: ProviderRuntimeLiveServiceReadinessResultV1,
  config: ProviderServiceHandoffConfigV1,
  expectedBinaryDigest: ContentDigestV1,
  expectedTargetFingerprintDigest: ContentDigestV1,
): ProviderRuntimeLiveServiceReadinessResultV1 & { readonly status: "live_candidate" } {
  const candidate: unknown = live;
  if (!isRecordV1(candidate)) throw new TypeError("live readiness shape is invalid");
  if (!exactKeysV1(candidate, [
    "status",
    "authority",
    "strongWrites",
    "providerId",
    "targetFingerprintDigest",
    "binaryDigest",
    "binaryIdentity",
    "inspectedRevision",
  ])) {
    throw new TypeError("live readiness fields are not exact");
  }
  if (
    candidate.status !== "live_candidate" ||
    candidate.authority !== "read_only" ||
    candidate.strongWrites !== "locked" ||
    candidate.binaryIdentity !== "verified" ||
    typeof candidate.inspectedRevision !== "number" ||
    !Number.isSafeInteger(candidate.inspectedRevision) ||
    candidate.inspectedRevision < 0
  ) {
    throw new TypeError("live readiness is unavailable or forged");
  }
  const providerId = DurableObjectIdentityProviderIdV1Schema.parse(candidate.providerId);
  const targetFingerprintDigest = ContentDigestV1Schema.parse(candidate.targetFingerprintDigest);
  const binaryDigest = ContentDigestV1Schema.parse(candidate.binaryDigest);
  if (
    providerId !== config.payload.providerId ||
    binaryDigest !== expectedBinaryDigest ||
    targetFingerprintDigest !== expectedTargetFingerprintDigest ||
    config.payload.binaryDigest !== expectedBinaryDigest
  ) {
    throw new TypeError("live/config digest binding mismatch");
  }
  return candidate as ProviderRuntimeLiveServiceReadinessResultV1 & { readonly status: "live_candidate" };
}

function validateConformanceAndEvidenceBindingsV1(
  input: ProviderRuntimeLiveGateBindingOptionsV1,
  config: ProviderServiceHandoffConfigV1,
  expectedBinaryDigest: ContentDigestV1,
  expectedCapabilityDigest: ContentDigestV1,
  expectedTargetFingerprintDigest: ContentDigestV1,
): void {
  const values = resolveProjectionInputV1(input);
  const conformancePayload = values.conformance.envelope.payload;
  if (
    conformancePayload.providerId !== config.payload.providerId ||
    conformancePayload.implementationDigest !== expectedBinaryDigest ||
    conformancePayload.binaryAttestationDigest !== expectedBinaryDigest
  ) {
    throw new TypeError("conformance/config binary binding mismatch");
  }
  const evidencePayload = values.evidence.evidence.payload;
  if (
    evidencePayload.providerId !== config.payload.providerId ||
    evidencePayload.implementationDigest !== expectedBinaryDigest ||
    evidencePayload.binaryAttestationDigest !== expectedBinaryDigest
  ) {
    throw new TypeError("Evidence/config binary binding mismatch");
  }

  const aliases = [input.conformanceBindings, input.candidateBindings].filter(
    (value): value is ProviderRuntimeRealFilesystemConformanceBindingsV1 => value !== undefined,
  );
  if (aliases.length > 1 && aliases.some((value) => !canonicalEqualV1(value, aliases[0]!))) {
    throw new TypeError("conformance binding aliases disagree");
  }
  const candidate = aliases[0];
  if (candidate === undefined) return;
  const providerId = DurableObjectIdentityProviderIdV1Schema.parse(candidate.providerId);
  const targetFingerprintDigest = ContentDigestV1Schema.parse(candidate.targetFingerprintDigest);
  const binaryDigest = ContentDigestV1Schema.parse(candidate.binaryDigest);
  const capabilityDigest = ContentDigestV1Schema.parse(candidate.capabilityDigest);
  ContentDigestV1Schema.parse(candidate.policyDigest);
  if (
    providerId !== config.payload.providerId ||
    targetFingerprintDigest !== expectedTargetFingerprintDigest ||
    binaryDigest !== expectedBinaryDigest ||
    capabilityDigest !== expectedCapabilityDigest
  ) {
    throw new TypeError("conformance candidate binding mismatch");
  }
}

async function bindInternalV1(
  input: ProviderRuntimeLiveGateBindingOptionsV1,
): Promise<ProviderRuntimeLiveGateActivationCandidateV1> {
  const expectedInstallationIdentityDigest = ContentDigestV1Schema.parse(
    input.expectedInstallationIdentityDigest,
  );
  const expectedBinaryDigest = ContentDigestV1Schema.parse(input.expectedBinaryDigest);
  const expectedCapabilityDigest = ContentDigestV1Schema.parse(input.expectedCapabilityDigest);
  const expectedTargetFingerprintDigest = ContentDigestV1Schema.parse(
    input.expectedTargetFingerprintDigest,
  );
  const config = verifyProviderServiceHandoffConfigV1(
    input.config,
    expectedInstallationIdentityDigest,
  );
  if (
    config.payload.installationIdentityDigest !== expectedInstallationIdentityDigest ||
    config.payload.binaryDigest !== expectedBinaryDigest ||
    config.payload.capabilityDigest !== expectedCapabilityDigest
  ) {
    throw new TypeError("signed handoff digest binding mismatch");
  }
  const verifiedLive = await verifyProviderRuntimeLiveServiceReadinessV1({
    config,
    targetBaseline: input.targetBaseline,
    authKey: input.authKey,
    expectedInstallationIdentityDigest,
    timeoutMs: input.timeoutMs,
    readinessReader: input.readinessReader,
  });
  if (input.liveReadiness !== undefined && !canonicalEqualV1(input.liveReadiness, verifiedLive)) {
    throw new TypeError("caller live readiness does not match fresh verification");
  }
  const projection = recomputeProjectionV1(input, config);
  const live = validateLiveReadinessV1(
    verifiedLive,
    config,
    expectedBinaryDigest,
    expectedTargetFingerprintDigest,
  );
  validateConformanceAndEvidenceBindingsV1(
    input,
    config,
    expectedBinaryDigest,
    expectedCapabilityDigest,
    expectedTargetFingerprintDigest,
  );
  if (projection.bindings.providerId !== config.payload.providerId) {
    throw new TypeError("Gate/config provider binding mismatch");
  }

  return Object.freeze({
    status: "live_activation_candidate" as const,
    authority: "none" as const,
    accessMode: "read_only" as const,
    strongWriteStatus: "locked" as const,
    requiredNext: PROVIDER_RUNTIME_LIVE_GATE_REQUIRED_NEXT_V1,
    bindings: Object.freeze({
      providerId: config.payload.providerId,
      installationIdentityDigest: expectedInstallationIdentityDigest,
      binaryDigest: expectedBinaryDigest,
      capabilityDigest: expectedCapabilityDigest,
      targetFingerprintDigest: expectedTargetFingerprintDigest,
      targetProfileId: projection.bindings.targetProfileId,
      conformanceResultId: projection.bindings.conformanceResultId,
      conformanceContentDigest: ContentDigestV1Schema.parse(
        projection.bindings.conformanceContentDigest,
      ),
      evidenceId: projection.bindings.evidenceId,
      evidenceContentDigest: ContentDigestV1Schema.parse(
        projection.bindings.evidenceContentDigest,
      ),
      catalogContentDigest: ContentDigestV1Schema.parse(
        projection.bindings.catalogContentDigest,
      ),
      gateStatus: "candidate_ready" as const,
      gateAuthority: "none" as const,
      gateAccessMode: "read_only" as const,
      gateStrongWriteStatus: "locked" as const,
      liveStatus: live.status,
      liveAuthority: live.authority,
      liveStrongWrites: live.strongWrites,
      inspectedRevision: live.inspectedRevision,
    }),
  });
}

export async function diagnoseProviderRuntimeLiveGateBindingV1(
  input: ProviderRuntimeLiveGateBindingOptionsV1,
): Promise<ProviderRuntimeLiveGateBindingDiagnosticV1> {
  try {
    return { ok: true, value: await bindInternalV1(input) };
  } catch {
    return { ok: false, code: "provider_unavailable", reason: "attestation_invalid" };
  }
}

export async function adaptProviderRuntimeLiveGateBindingV1(
  input: ProviderRuntimeLiveGateBindingOptionsV1,
): Promise<ProviderRuntimeLiveGateActivationCandidateV1> {
  const diagnostic = await diagnoseProviderRuntimeLiveGateBindingV1(input);
  if (!diagnostic.ok) throw new ProviderRuntimeLiveGateBindingErrorV1();
  return diagnostic.value;
}

export const projectProviderRuntimeLiveGateBindingV1 =
  adaptProviderRuntimeLiveGateBindingV1;
export const bindProviderRuntimeLiveGateBindingV1 =
  adaptProviderRuntimeLiveGateBindingV1;
export const verifyProviderRuntimeLiveGateBindingV1 =
  adaptProviderRuntimeLiveGateBindingV1;
export const runProviderRuntimeLiveGateBindingV1 =
  diagnoseProviderRuntimeLiveGateBindingV1;

/** Return an opaque locked result instead of throwing on unavailable input. */
export async function evaluateProviderRuntimeLiveGateBindingV1(
  input: ProviderRuntimeLiveGateBindingOptionsV1,
): Promise<ProviderRuntimeLiveGateBindingResultV1> {
  const diagnostic = await diagnoseProviderRuntimeLiveGateBindingV1(input);
  return diagnostic.ok ? diagnostic.value : unavailableV1();
}
