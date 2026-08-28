import { constants as fsConstants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";

import {
  ContentDigestV1Schema,
  InstallationIdentityGenerationIdV1Schema,
  ProviderTargetProfileIdV1Schema,
  type InstallationIdentityGenerationIdV1,
  type ProviderTargetProfileIdV1,
} from "@understand-code/durable-object-provider-contracts/primitives";
import {
  ProviderAcceptanceGenerationPinV1Schema,
  ProviderAcceptanceStateEnvelopeV1Schema,
  type ProviderAcceptedConfigurationV1,
  type ProviderAcceptanceGenerationPinV1,
  type ProviderAcceptanceStateEnvelopeV1,
} from "@understand-code/durable-object-provider-contracts/provider-acceptance";
import type {
  ProviderStrictEd25519OpaqueCapabilityV1,
} from "@understand-code/durable-object-provider-contracts/strict-ed25519-conformance";
import {
  readProviderServiceReadinessV1,
  verifyProviderServiceHandoffConfigV1,
  type ProviderServiceHandoffConfigV1,
} from "@understand-code/durable-object-provider-runtime/service-handoff";

import {
  withProviderAcceptanceAuthorityLockedCurrentViewCoreInternalV1,
} from "./acceptance-store-core-internal.js";
import {
  assertProviderStrongMutationBrokerStoreCapabilityInternalV1,
  exportProviderStrongMutationBrokerResolvedReceiptLedgerViewInternalV1,
  exportProviderStrongMutationBrokerResolvedReceiptBundlesInternalV1,
  openProviderStrongMutationBrokerStoreWithExecutionFenceAndLayoutCoreInternalV1,
  type ProviderStrongMutationBrokerResolvedReceiptBundleInternalV1,
  type ProviderStrongMutationBrokerResolvedReceiptLedgerViewInternalV1,
  type ProviderStrongMutationBrokerStoreInternalV1,
  PROVIDER_STRONG_MUTATION_BROKER_DOMAINS_INTERNAL_V1,
} from "./strong-mutation-broker-core-internal.js";
import {
  digestDomainInternalV1,
  sha256DigestInternalV1,
} from "./crypto-internal.js";
import {
  canonicalAuthorityBytesInternalV1,
} from "./filesystem-internal.js";
import {
  ProviderStrongMutationBrokerServerInternalV1,
} from "./strong-mutation-broker-server-internal.js";
import {
  closeProviderStrongMutationLinuxExt4ExactObjectAuthorityInternalV1,
  openProviderStrongMutationLinuxExt4ExactObjectAuthorityInternalV1,
  registerProviderStrongMutationLinuxExt4ExecutionFenceInternalV1,
  PROVIDER_STRONG_MUTATION_LINUX_EXT4_FENCE_PROFILE_INTERNAL_V1,
} from "./strong-mutation-execution-fence-internal.js";
import {
  mintProviderStrongMutationTrustVerifierCapabilityInternalV1,
  type ProviderStrongMutationTrustEvidenceQueryInternalV1,
} from "./strong-mutation-trust-verifier-core-internal.js";
import {
  resolveProviderAcceptanceAuthorityProductionLayoutInternalV1,
} from "./platform-layout.js";
import { ProviderAcceptanceAuthorityErrorV1 } from "./errors.js";

const MAX_SERVICE_CONFIG_BYTES_V1 = 1024 * 1024;
const O_CLOEXEC_V1 =
  (fsConstants as Readonly<Record<string, number>>)["O_CLOEXEC"] ?? 0;
const STRONG_MUTATION_BROKER_SOCKET_BASENAME_V1 =
  "strong-mutation-broker-v1.sock" as const;
const STRONG_MUTATION_BROKER_LEASE_SUFFIX_V1 =
  ".strong-mutation-broker.lock" as const;

type ProviderProductionCompletedStrongReadyConfigurationInternalV1 =
  Extract<ProviderAcceptedConfigurationV1, { readonly state: "strong_ready" }> &
  Readonly<{
    activation: Extract<
      Extract<ProviderAcceptedConfigurationV1, {
        readonly state: "strong_ready";
      }>["activation"],
      { readonly origin: "completed_provider_migration" }
    >;
  }>;

export function assertProviderProductionCompletedStrongReadyConfigurationInternalV1(
  configuration: ProviderAcceptedConfigurationV1,
): asserts configuration is ProviderProductionCompletedStrongReadyConfigurationInternalV1 {
  if (
    configuration.state !== "strong_ready" ||
    configuration.activation.origin !== "completed_provider_migration"
  ) {
    throw new TypeError("provider strong authority writer is unavailable");
  }
}

export interface OpenProviderProductionStrongAuthorityServiceV1Input {
  /** Root-owned, signed installer handoff; a caller-supplied object is never authority. */
  readonly serviceConfigPath: string;
  /** Selects one already-current Acceptance writer; it cannot create a writer. */
  readonly targetProfileId: ProviderTargetProfileIdV1;
  readonly strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1;
  /** Transport only. Every returned byte is detached and cryptographically verified. */
  readonly readTrustEvidence: (
    query: ProviderStrongMutationTrustEvidenceQueryInternalV1,
  ) => unknown | Promise<unknown>;
}

export interface ProviderProductionStrongAuthorityServiceV1 {
  readonly profile: "provider_production_strong_authority_service_v1";
  readonly authority: "verified_current_acceptance";
  readonly executionFence:
    "linux_ext4_exact_object_dedicated_os_principal_v1";
  readonly strongWrites: "unlocked";
  close(): Promise<void>;
}

export interface ProviderProductionStrongAuthorityReceiptExportCapabilityInternalV1 {
  readonly __providerProductionStrongAuthorityReceiptExportCapabilityInternalV1:
    true;
}

export interface ProviderProductionStrongAuthorityStep16ReceiptBindingWindowCapabilityInternalV1 {
  readonly __providerProductionStrongAuthorityStep16ReceiptBindingWindowCapabilityInternalV1:
    true;
}

export interface ProviderProductionStrongAuthorityTrustedHostCallWitnessCapabilityInternalV1 {
  readonly __providerProductionStrongAuthorityTrustedHostCallWitnessCapabilityInternalV1:
    true;
}

export interface ProviderProductionStrongAuthorityStep16ExpectedOperationInternalV1 {
  readonly operation: "write_object" | "compare_commit";
  readonly operationNonce: string;
  readonly requestDigest: string;
}

export interface BeginProviderProductionStrongAuthorityStep16ReceiptBindingWindowInternalV1Input {
  readonly host: "codex" | "claude";
  readonly expectedProviderOperations:
    readonly ProviderProductionStrongAuthorityStep16ExpectedOperationInternalV1[];
}

export interface ProviderProductionStrongAuthorityTrustedHostCallWitnessInternalV1 {
  readonly host: "codex" | "claude";
  readonly sessionIdDigest: string;
  readonly callIdDigest: string;
  readonly expectedProviderOperations:
    readonly ProviderProductionStrongAuthorityStep16ExpectedOperationInternalV1[];
}

export type OpenProviderProductionStrongAuthorityTrustedHostCallWitnessInternalV1 = (
  witness:
    ProviderProductionStrongAuthorityTrustedHostCallWitnessCapabilityInternalV1,
) => ProviderProductionStrongAuthorityTrustedHostCallWitnessInternalV1 | undefined;

export interface ProviderProductionStrongAuthorityStep16TrustedProviderIdentityInternalV1 {
  readonly providerId: string;
  readonly installationIdentityDigest: string;
}

export interface ProviderProductionStrongAuthorityStep16ProviderReceiptBindingInternalV1 {
  readonly schemaVersion: 1;
  readonly profile: "step16_provider_receipt_binding_v1";
  readonly host: "codex" | "claude";
  readonly sessionIdDigest: string;
  readonly callIdDigest: string;
  readonly providerIdentityDigest: string;
  readonly receiptLedger: Readonly<{
    readonly authority: "root_owned_private_provider_receipt_ledger";
    readonly locatorPolicy: "fixed_locator_component_nofollow";
    readonly receiptBundleDigest: string;
  }>;
  readonly providerOperation: Readonly<{
    readonly operation: "write_object" | "compare_commit";
    readonly operationNonce: string;
    readonly requestDigest: string;
    readonly sessionBindingDigest: string;
    readonly principalAttestationDigest: string;
    readonly authorityGrantContentDigest: string;
    readonly responseResolution: "committed" | "replayed";
  }>;
  readonly componentDigests: Readonly<{
    readonly strongMutationRequest: string;
    readonly strongMutationResponse: string;
    readonly principalAttestation: string;
    readonly authorityGrantEnvelope: string;
    readonly authorityGrantSignature: string;
    readonly responseSignature: string;
    readonly principalAttestationSignature: string;
  }>;
  readonly privateBundleVerification: Readonly<{
    readonly status: "verified";
    readonly verifierProfile:
      "provider_runtime_ipc_full_private_bundle_verifier_v1";
    readonly verifiedBindings: readonly [
      "request_digest",
      "session_binding",
      "authority_grant_signature",
      "response_signature",
      "principal_attestation_signature",
    ];
  }>;
}

export interface OpenedProviderProductionStrongAuthorityServiceInternalV1 {
  readonly service: ProviderProductionStrongAuthorityServiceV1;
  readonly receiptExportCapability:
    ProviderProductionStrongAuthorityReceiptExportCapabilityInternalV1;
}

interface ProviderProductionStrongAuthorityReceiptExportStateInternalV1 {
  readonly exportBundles: () => Promise<
    readonly ProviderStrongMutationBrokerResolvedReceiptBundleInternalV1[]
  >;
  readonly beginStep16ReceiptBindingWindow: (
    input:
      BeginProviderProductionStrongAuthorityStep16ReceiptBindingWindowInternalV1Input,
  ) => Promise<
    ProviderProductionStrongAuthorityStep16ReceiptBindingWindowCapabilityInternalV1
  >;
}

const receiptExportCapabilityStatesV1 = new WeakMap<
  object,
  ProviderProductionStrongAuthorityReceiptExportStateInternalV1
>();

const step16ReceiptBindingWindowStatesV1 = new WeakMap<
  object,
  (
    witness:
      ProviderProductionStrongAuthorityTrustedHostCallWitnessCapabilityInternalV1,
  ) => Promise<
    readonly ProviderProductionStrongAuthorityStep16ProviderReceiptBindingInternalV1[]
  >
>();

export function exportProviderProductionStrongAuthorityResolvedReceiptBundlesInternalV1(
  capability:
    ProviderProductionStrongAuthorityReceiptExportCapabilityInternalV1,
): Promise<
  readonly ProviderStrongMutationBrokerResolvedReceiptBundleInternalV1[]
> {
  const state = receiptExportCapabilityStatesV1.get(
    capability as object,
  );
  if (state === undefined) {
    return Promise.reject(
      new ProviderAcceptanceAuthorityErrorV1("invalid_request"),
    );
  }
  return state.exportBundles();
}

export function beginProviderProductionStrongAuthorityStep16ReceiptBindingWindowInternalV1(
  capability:
    ProviderProductionStrongAuthorityReceiptExportCapabilityInternalV1,
  input:
    BeginProviderProductionStrongAuthorityStep16ReceiptBindingWindowInternalV1Input,
): Promise<
  ProviderProductionStrongAuthorityStep16ReceiptBindingWindowCapabilityInternalV1
> {
  const state = receiptExportCapabilityStatesV1.get(capability as object);
  if (state === undefined) {
    return Promise.reject(
      new ProviderAcceptanceAuthorityErrorV1("invalid_request"),
    );
  }
  return state.beginStep16ReceiptBindingWindow(input);
}

export function completeProviderProductionStrongAuthorityStep16ReceiptBindingWindowInternalV1(
  capability:
    ProviderProductionStrongAuthorityStep16ReceiptBindingWindowCapabilityInternalV1,
  witness:
    ProviderProductionStrongAuthorityTrustedHostCallWitnessCapabilityInternalV1,
): Promise<
  readonly ProviderProductionStrongAuthorityStep16ProviderReceiptBindingInternalV1[]
> {
  const complete = step16ReceiptBindingWindowStatesV1.get(
    capability as object,
  );
  if (complete === undefined) {
    return Promise.reject(
      new ProviderAcceptanceAuthorityErrorV1("invalid_request"),
    );
  }
  step16ReceiptBindingWindowStatesV1.delete(capability as object);
  return complete(witness);
}

function exactRecordKeysV1(
  value: unknown,
  expectedKeys: readonly string[],
): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const actualKeys = Object.keys(value).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();
  return actualKeys.length === sortedExpectedKeys.length &&
    actualKeys.every((key, index) => key === sortedExpectedKeys[index]);
}

function isStep16DigestV1(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[0-9a-f]{64}$/u.test(value);
}

function parseStep16ExpectedProviderOperationsV1(
  value: unknown,
): readonly ProviderProductionStrongAuthorityStep16ExpectedOperationInternalV1[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 4_096) {
    throw new ProviderAcceptanceAuthorityErrorV1("invalid_request");
  }
  const expectedProviderOperations = value.map((operation) => {
    if (
      !exactRecordKeysV1(operation, [
        "operation",
        "operationNonce",
        "requestDigest",
      ]) ||
      (operation.operation !== "write_object" &&
        operation.operation !== "compare_commit") ||
      typeof operation.operationNonce !== "string" ||
      !/^[0-9a-f]{32}$/u.test(operation.operationNonce) ||
      !isStep16DigestV1(operation.requestDigest)
    ) {
      throw new ProviderAcceptanceAuthorityErrorV1("invalid_request");
    }
    return Object.freeze({
      operation: operation.operation,
      operationNonce: operation.operationNonce,
      requestDigest: operation.requestDigest,
    });
  });
  if (
    new Set(expectedProviderOperations.map((entry) => entry.operationNonce))
      .size !== expectedProviderOperations.length
  ) {
    throw new ProviderAcceptanceAuthorityErrorV1("invalid_request");
  }
  return Object.freeze(expectedProviderOperations);
}

function parseStep16ReceiptBindingWindowBeginInputV1(
  input: BeginProviderProductionStrongAuthorityStep16ReceiptBindingWindowInternalV1Input,
): BeginProviderProductionStrongAuthorityStep16ReceiptBindingWindowInternalV1Input {
  if (
    !exactRecordKeysV1(input, [
      "host",
      "expectedProviderOperations",
    ]) ||
    (input.host !== "codex" && input.host !== "claude")
  ) {
    throw new ProviderAcceptanceAuthorityErrorV1("invalid_request");
  }
  const expectedProviderOperations = parseStep16ExpectedProviderOperationsV1(
    input.expectedProviderOperations,
  );
  return Object.freeze({
    host: input.host,
    expectedProviderOperations,
  });
}

function parseStep16TrustedHostCallWitnessV1(
  input: ProviderProductionStrongAuthorityTrustedHostCallWitnessInternalV1,
): ProviderProductionStrongAuthorityTrustedHostCallWitnessInternalV1 {
  if (
    !exactRecordKeysV1(input, [
      "host",
      "sessionIdDigest",
      "callIdDigest",
      "expectedProviderOperations",
    ]) ||
    !Object.isFrozen(input) ||
    !Array.isArray(input.expectedProviderOperations) ||
    !Object.isFrozen(input.expectedProviderOperations) ||
    input.expectedProviderOperations.some((operation) =>
      !Object.isFrozen(operation)
    ) ||
    (input.host !== "codex" && input.host !== "claude") ||
    !isStep16DigestV1(input.sessionIdDigest) ||
    !isStep16DigestV1(input.callIdDigest)
  ) {
    throw new ProviderAcceptanceAuthorityErrorV1("invalid_request");
  }
  const expectedProviderOperations = parseStep16ExpectedProviderOperationsV1(
    input.expectedProviderOperations,
  );
  return Object.freeze({
    host: input.host,
    sessionIdDigest: input.sessionIdDigest,
    callIdDigest: input.callIdDigest,
    expectedProviderOperations,
  });
}

function assertStep16ResolvedReceiptBundleIntegrityV1(
  bundle: ProviderStrongMutationBrokerResolvedReceiptBundleInternalV1,
  providerId: string,
): asserts bundle is ProviderStrongMutationBrokerResolvedReceiptBundleInternalV1 &
  Readonly<{ readonly response: Readonly<{ readonly ok: true }> }> {
  const request = bundle.request;
  const response = bundle.response;
  const grant = bundle.authorityGrant;
  const grantPayload = grant.payload;
  const componentDigests = {
    request: sha256DigestInternalV1(
      canonicalAuthorityBytesInternalV1(request),
    ),
    response: sha256DigestInternalV1(
      canonicalAuthorityBytesInternalV1(response),
    ),
    principalAttestation: sha256DigestInternalV1(
      canonicalAuthorityBytesInternalV1(bundle.principalAttestation),
    ),
    authorityGrant: sha256DigestInternalV1(
      canonicalAuthorityBytesInternalV1(grant),
    ),
  };
  const { bundleDigest: _bundleDigest, ...claims } = bundle;
  if (
    bundle.executionFence !==
      "established_linux_ext4_exact_object_dedicated_os_principal_v1" ||
    bundle.strongWrites !== "unlocked" ||
    bundle.grantId !== grant.grantId ||
    bundle.grantId !== grantPayload.grantId ||
    bundle.bindingDigest !== request.bindingDigest ||
    request.authorityGrant !== grant
  ) {
    throw new ProviderAcceptanceAuthorityErrorV1("namespace_integrity_failed");
  }
  if (
    request.principalAttestationDigest !==
      grantPayload.principalAttestationDigest ||
    request.operation !== grantPayload.operation ||
    request.operationNonce !== grantPayload.operationNonce ||
    request.requestDigest !== grantPayload.requestDigest ||
    response.requestId !== request.requestId ||
    response.principalAttestationDigest !== request.principalAttestationDigest ||
    response.bindingDigest !== request.bindingDigest ||
    response.operation !== request.operation ||
    response.operationNonce !== request.operationNonce ||
    response.requestDigest !== request.requestDigest ||
    response.ok !== true ||
    grantPayload.providerId !== providerId ||
    bundle.principalAttestation.providerId !== providerId ||
    (request.operation === "write_object" &&
      request.payload.locator.providerId !== providerId) ||
    bundle.componentDigests.request !== componentDigests.request ||
    bundle.componentDigests.response !== componentDigests.response ||
    bundle.componentDigests.principalAttestation !==
      componentDigests.principalAttestation ||
    bundle.componentDigests.authorityGrant !==
      componentDigests.authorityGrant ||
    bundle.bundleDigest !== digestDomainInternalV1(
      PROVIDER_STRONG_MUTATION_BROKER_DOMAINS_INTERNAL_V1
        .resolvedReceiptBundleDigest,
      claims,
    )
  ) {
    throw new ProviderAcceptanceAuthorityErrorV1("namespace_integrity_failed");
  }
}

function projectStep16ProviderReceiptBindingV1(
  bundle: ProviderStrongMutationBrokerResolvedReceiptBundleInternalV1,
  begin: BeginProviderProductionStrongAuthorityStep16ReceiptBindingWindowInternalV1Input,
  completion: ProviderProductionStrongAuthorityTrustedHostCallWitnessInternalV1,
  providerIdentity: Readonly<{
    readonly providerId: string;
    readonly providerIdentityDigest: string;
  }>,
): ProviderProductionStrongAuthorityStep16ProviderReceiptBindingInternalV1 {
  assertStep16ResolvedReceiptBundleIntegrityV1(
    bundle,
    providerIdentity.providerId,
  );
  const resolution = bundle.response.payload.resolution;
  if (resolution !== "committed" && resolution !== "replayed") {
    throw new ProviderAcceptanceAuthorityErrorV1("namespace_integrity_failed");
  }
  return Object.freeze({
    schemaVersion: 1 as const,
    profile: "step16_provider_receipt_binding_v1" as const,
    host: begin.host,
    sessionIdDigest: completion.sessionIdDigest,
    callIdDigest: completion.callIdDigest,
    providerIdentityDigest: providerIdentity.providerIdentityDigest,
    receiptLedger: Object.freeze({
      authority: "root_owned_private_provider_receipt_ledger" as const,
      locatorPolicy: "fixed_locator_component_nofollow" as const,
      receiptBundleDigest: bundle.bundleDigest,
    }),
    providerOperation: Object.freeze({
      operation: bundle.request.operation,
      operationNonce: bundle.request.operationNonce,
      requestDigest: bundle.request.requestDigest,
      sessionBindingDigest: bundle.request.bindingDigest,
      principalAttestationDigest:
        bundle.request.principalAttestationDigest,
      authorityGrantContentDigest: bundle.authorityGrant.contentDigest,
      responseResolution: resolution,
    }),
    componentDigests: Object.freeze({
      strongMutationRequest: bundle.componentDigests.request,
      strongMutationResponse: bundle.componentDigests.response,
      principalAttestation: bundle.componentDigests.principalAttestation,
      authorityGrantEnvelope: bundle.componentDigests.authorityGrant,
      authorityGrantSignature: sha256DigestInternalV1(
        canonicalAuthorityBytesInternalV1(
          bundle.authorityGrant.payload.signature,
        ),
      ),
      responseSignature: sha256DigestInternalV1(
        canonicalAuthorityBytesInternalV1(bundle.response.signature),
      ),
      principalAttestationSignature: sha256DigestInternalV1(
        canonicalAuthorityBytesInternalV1(
          bundle.principalAttestation.signature,
        ),
      ),
    }),
    privateBundleVerification: Object.freeze({
      status: "verified" as const,
      verifierProfile:
        "provider_runtime_ipc_full_private_bundle_verifier_v1" as const,
      verifiedBindings: Object.freeze([
        "request_digest",
        "session_binding",
        "authority_grant_signature",
        "response_signature",
        "principal_attestation_signature",
      ] as const),
    }),
  });
}

function exactStep16ReceiptLedgerSuffixV1(
  baseline: ProviderStrongMutationBrokerResolvedReceiptLedgerViewInternalV1,
  current: ProviderStrongMutationBrokerResolvedReceiptLedgerViewInternalV1,
  expected:
    readonly ProviderProductionStrongAuthorityStep16ExpectedOperationInternalV1[],
): readonly ProviderStrongMutationBrokerResolvedReceiptBundleInternalV1[] {
  if (
    baseline.pendingCount !== 0 ||
    current.pendingCount !== 0 ||
    baseline.bundles.length !== baseline.intentCount ||
    current.bundles.length !== current.intentCount ||
    current.intentCount !== baseline.intentCount + expected.length
  ) {
    throw new ProviderAcceptanceAuthorityErrorV1("namespace_integrity_failed");
  }
  for (let index = 0; index < baseline.bundles.length; index += 1) {
    const before = baseline.bundles[index]!;
    const after = current.bundles[index]!;
    if (
      before.intentOrdinal !== index + 1 ||
      after.intentOrdinal !== before.intentOrdinal ||
      after.bundleDigest !== before.bundleDigest
    ) {
      throw new ProviderAcceptanceAuthorityErrorV1(
        "namespace_integrity_failed",
      );
    }
  }
  const suffix = current.bundles.slice(baseline.intentCount);
  for (let index = 0; index < suffix.length; index += 1) {
    const bundle = suffix[index]!;
    const operation = expected[index]!;
    if (
      bundle.intentOrdinal !== baseline.intentCount + index + 1 ||
      bundle.request.operation !== operation.operation ||
      bundle.request.operationNonce !== operation.operationNonce ||
      bundle.request.requestDigest !== operation.requestDigest
    ) {
      throw new ProviderAcceptanceAuthorityErrorV1(
        "namespace_integrity_failed",
      );
    }
  }
  return Object.freeze(suffix);
}

/**
 * Internal construction boundary shared only with the NODE_ENV=test seam.
 * Both the broker and receipt exporter are identity capabilities; the public
 * service facade carries lifecycle authority only.
 */
export function createProviderProductionStrongAuthorityServiceCoreInternalV1(
  broker: ProviderStrongMutationBrokerStoreInternalV1,
  trustedProviderIdentity:
    ProviderProductionStrongAuthorityStep16TrustedProviderIdentityInternalV1,
  closeServer: () => Promise<void>,
  closeExactObjectAuthority: () => Promise<void>,
  openTrustedHostCallWitness?:
    OpenProviderProductionStrongAuthorityTrustedHostCallWitnessInternalV1,
): OpenedProviderProductionStrongAuthorityServiceInternalV1 {
  assertProviderStrongMutationBrokerStoreCapabilityInternalV1(broker);
  if (
    !exactRecordKeysV1(trustedProviderIdentity, [
      "providerId",
      "installationIdentityDigest",
    ]) ||
    typeof trustedProviderIdentity.providerId !== "string" ||
    trustedProviderIdentity.providerId.length < 1 ||
    trustedProviderIdentity.providerId.length > 512 ||
    trustedProviderIdentity.providerId.includes("\0") ||
    !isStep16DigestV1(trustedProviderIdentity.installationIdentityDigest) ||
    broker.strongWrites !== "unlocked" ||
    broker.executionFence !==
      "established_linux_ext4_exact_object_dedicated_os_principal_v1"
  ) {
    throw new ProviderAcceptanceAuthorityErrorV1("invalid_request");
  }
  const providerIdentity = Object.freeze({
    providerId: trustedProviderIdentity.providerId,
    providerIdentityDigest:
      trustedProviderIdentity.installationIdentityDigest,
  });

  let phase: "open" | "closing" | "closed" = "open";
  let closePromise: Promise<void> | undefined;
  let step16ReceiptBindingWindowOpen = false;
  const consumedTrustedHostCallWitnesses = new WeakSet<object>();
  const activeExports = new Set<Promise<unknown>>();
  const runReceiptExport = <T>(operation: () => Promise<T>): Promise<T> => {
    if (phase !== "open") {
      return Promise.reject(
        new ProviderAcceptanceAuthorityErrorV1("invalid_request"),
      );
    }
    let exporting: Promise<T>;
    try {
      exporting = operation();
    } catch (error) {
      return Promise.reject(error);
    }
    activeExports.add(exporting);
    void exporting.then(
      () => activeExports.delete(exporting),
      () => activeExports.delete(exporting),
    );
    return exporting;
  };
  const exportBundles = (): Promise<
    readonly ProviderStrongMutationBrokerResolvedReceiptBundleInternalV1[]
  > =>
    runReceiptExport(() =>
      exportProviderStrongMutationBrokerResolvedReceiptBundlesInternalV1(
        broker,
      )
    );
  const beginStep16ReceiptBindingWindow = (
    input:
      BeginProviderProductionStrongAuthorityStep16ReceiptBindingWindowInternalV1Input,
  ): Promise<
    ProviderProductionStrongAuthorityStep16ReceiptBindingWindowCapabilityInternalV1
  > => {
    if (openTrustedHostCallWitness === undefined) {
      return Promise.reject(
        new ProviderAcceptanceAuthorityErrorV1("invalid_request"),
      );
    }
    let begin:
      BeginProviderProductionStrongAuthorityStep16ReceiptBindingWindowInternalV1Input;
    try {
      begin = parseStep16ReceiptBindingWindowBeginInputV1(input);
    } catch (error) {
      return Promise.reject(error);
    }
    if (step16ReceiptBindingWindowOpen) {
      return Promise.reject(
        new ProviderAcceptanceAuthorityErrorV1("invalid_request"),
      );
    }
    step16ReceiptBindingWindowOpen = true;
    return runReceiptExport(async () => {
      try {
        const baseline =
          await exportProviderStrongMutationBrokerResolvedReceiptLedgerViewInternalV1(
            broker,
          );
        if (
          baseline.pendingCount !== 0 ||
          baseline.bundles.length !== baseline.intentCount ||
          phase !== "open"
        ) {
          throw new ProviderAcceptanceAuthorityErrorV1(
            "namespace_integrity_failed",
          );
        }
        const windowCapability = Object.freeze(Object.create(null)) as
          ProviderProductionStrongAuthorityStep16ReceiptBindingWindowCapabilityInternalV1;
        step16ReceiptBindingWindowStatesV1.set(
          windowCapability,
          async (witness) => {
            try {
              if (
                typeof witness !== "object" || witness === null ||
                consumedTrustedHostCallWitnesses.has(witness as object)
              ) {
                throw new ProviderAcceptanceAuthorityErrorV1(
                  "invalid_request",
                );
              }
              consumedTrustedHostCallWitnesses.add(witness as object);
              const openedWitness = openTrustedHostCallWitness(witness);
              if (openedWitness === undefined) {
                throw new ProviderAcceptanceAuthorityErrorV1(
                  "invalid_request",
                );
              }
              const completion = parseStep16TrustedHostCallWitnessV1(
                openedWitness,
              );
              if (completion.host !== begin.host) {
                throw new ProviderAcceptanceAuthorityErrorV1(
                  "invalid_request",
                );
              }
              if (
                !canonicalAuthorityBytesInternalV1(
                  completion.expectedProviderOperations,
                ).equals(
                  canonicalAuthorityBytesInternalV1(
                    begin.expectedProviderOperations,
                  ),
                )
              ) {
                throw new ProviderAcceptanceAuthorityErrorV1(
                  "namespace_integrity_failed",
                );
              }
              return await runReceiptExport(async () => {
                const current =
                  await exportProviderStrongMutationBrokerResolvedReceiptLedgerViewInternalV1(
                    broker,
                  );
                const suffix = exactStep16ReceiptLedgerSuffixV1(
                  baseline,
                  current,
                  begin.expectedProviderOperations,
                );
                return Object.freeze(
                  suffix.map((bundle) =>
                    projectStep16ProviderReceiptBindingV1(
                      bundle,
                      begin,
                      completion,
                      providerIdentity,
                    )
                  ),
                );
              });
            } finally {
              step16ReceiptBindingWindowOpen = false;
            }
          },
        );
        return windowCapability;
      } catch (error) {
        step16ReceiptBindingWindowOpen = false;
        throw error;
      }
    });
  };
  const close = (): Promise<void> => {
    if (closePromise !== undefined) return closePromise;
    phase = "closing";
    const closing = Promise.resolve().then(async () => {
      const errors: unknown[] = [];
      try {
        await closeServer();
      } catch (error) {
        errors.push(error);
      }
      await Promise.allSettled([...activeExports]);
      try {
        await closeExactObjectAuthority();
      } catch (error) {
        errors.push(error);
      } finally {
        phase = "closed";
      }
      if (errors.length === 1) throw errors[0];
      if (errors.length > 1) {
        throw new AggregateError(
          errors,
          "provider strong authority close failed",
        );
      }
    });
    closePromise = closing;
    return closing;
  };
  const service = Object.freeze({
    profile: "provider_production_strong_authority_service_v1" as const,
    authority: "verified_current_acceptance" as const,
    executionFence:
      "linux_ext4_exact_object_dedicated_os_principal_v1" as const,
    strongWrites: "unlocked" as const,
    close,
  });
  const receiptExportCapability = Object.freeze(Object.create(null)) as
    ProviderProductionStrongAuthorityReceiptExportCapabilityInternalV1;
  receiptExportCapabilityStatesV1.set(
    receiptExportCapability,
    Object.freeze({
      exportBundles,
      beginStep16ReceiptBindingWindow,
    }),
  );
  return Object.freeze({ service, receiptExportCapability });
}

function exactEffectiveAuthorityPrincipalV1(): Readonly<{
  readonly uid: number;
  readonly gid: number;
}> {
  const uid = typeof process.geteuid === "function"
    ? process.geteuid()
    : process.getuid?.();
  const gid = typeof process.getegid === "function"
    ? process.getegid()
    : process.getgid?.();
  if (
    !Number.isSafeInteger(uid) || uid !== 0 ||
    !Number.isSafeInteger(gid) || gid === undefined || gid < 0
  ) {
    throw new TypeError("provider strong authority root principal is unavailable");
  }
  return Object.freeze({ uid, gid });
}

async function readRootOwnedServiceConfigV1(
  pathInput: string,
): Promise<ProviderServiceHandoffConfigV1> {
  const path = resolve(pathInput);
  if (!isAbsolute(pathInput) || path !== pathInput || path.includes("\0")) {
    throw new TypeError("provider strong authority config is invalid");
  }
  const handle = await open(
    path,
    fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW | O_CLOEXEC_V1,
  );
  let raw: string;
  try {
    const before = await handle.stat({ bigint: true });
    if (
      !before.isFile() || before.uid !== 0n || before.nlink !== 1n ||
      (before.mode & 0o022n) !== 0n || before.size < 1n ||
      before.size > BigInt(MAX_SERVICE_CONFIG_BYTES_V1)
    ) {
      throw new TypeError("provider strong authority config is invalid");
    }
    raw = await handle.readFile("utf8");
    const after = await handle.stat({ bigint: true });
    const projected = await lstat(path, { bigint: true });
    if (
      after.dev !== before.dev || after.ino !== before.ino ||
      after.mode !== before.mode || after.uid !== before.uid ||
      after.gid !== before.gid || after.nlink !== before.nlink ||
      after.size !== before.size || after.mtimeNs !== before.mtimeNs ||
      projected.dev !== before.dev || projected.ino !== before.ino ||
      projected.isSymbolicLink() ||
      Buffer.byteLength(raw, "utf8") !== Number(before.size)
    ) {
      throw new TypeError("provider strong authority config changed during read");
    }
  } finally {
    await handle.close();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new TypeError("provider strong authority config is invalid");
  }
  const config = verifyProviderServiceHandoffConfigV1(parsed);
  if (
    config.payload.platform !== "linux" || process.platform !== "linux" ||
    config.payload.configPath !== path
  ) {
    throw new TypeError("provider strong authority config is invalid");
  }
  // The root authority is intentionally distinct from the signed dedicated
  // runtime principal. A same-UID broker cannot establish the isolation gate.
  exactEffectiveAuthorityPrincipalV1();
  return config;
}

async function readCurrentWriterV1(
  config: ProviderServiceHandoffConfigV1,
  targetProfileIdInput: ProviderTargetProfileIdV1,
): Promise<Readonly<{
  readonly targetProfileId: ProviderTargetProfileIdV1;
  readonly installationIdentityGenerationId:
    InstallationIdentityGenerationIdV1;
  readonly envelope: ProviderAcceptanceStateEnvelopeV1;
  readonly pin: ProviderAcceptanceGenerationPinV1;
}>> {
  const targetProfileId = ProviderTargetProfileIdV1Schema.parse(
    targetProfileIdInput,
  );
  const layout = resolveProviderAcceptanceAuthorityProductionLayoutInternalV1();
  return withProviderAcceptanceAuthorityLockedCurrentViewCoreInternalV1(
    layout,
    {},
    (view) => {
      const current = view.current;
      if (current === null) {
        throw new TypeError("provider strong authority Acceptance is unavailable");
      }
      const pin = ProviderAcceptanceGenerationPinV1Schema.parse(
        current.highWater.payload.currentAcceptance,
      );
      const matching = view.verifiedGenerationEnvelopes.filter((envelope) =>
        envelope.generationId === pin.generationId &&
        envelope.contentDigest === pin.contentDigest &&
        envelope.payload.acceptanceOrdinal === pin.acceptanceOrdinal
      );
      if (matching.length !== 1) {
        throw new TypeError("provider strong authority Acceptance is invalid");
      }
      const envelope = ProviderAcceptanceStateEnvelopeV1Schema.parse(
        matching[0],
      );
      if (
        envelope.installationIdentityGenerationId !==
          view.installationIdentityGenerationId ||
        config.payload.installationIdentityCustody === undefined ||
        config.payload.installationIdentityCustody
          .installationIdentityGenerationId !==
          view.installationIdentityGenerationId
      ) {
        throw new TypeError("provider strong authority identity is invalid");
      }
      const configuration = envelope.payload.configuration;
      assertProviderProductionCompletedStrongReadyConfigurationInternalV1(
        configuration,
      );
      const selections = configuration.core
        .activeWriterSelector.selections.filter((selection) =>
          selection.targetProfileId === targetProfileId &&
          selection.providerId === config.payload.providerId
        );
      if (selections.length !== 1) {
        throw new TypeError("provider strong authority writer is unavailable");
      }
      return Object.freeze({
        targetProfileId,
        installationIdentityGenerationId:
          InstallationIdentityGenerationIdV1Schema.parse(
            view.installationIdentityGenerationId,
          ),
        envelope,
        pin,
      });
    },
  );
}

/**
 * Start the production broker only after root-owned service config, signed
 * runtime readiness, current Acceptance, strict Registry evidence, and the
 * native exact-object authority have joined to one Linux/ext4 writer.
 */
export async function openProviderProductionStrongAuthorityServiceWithReceiptExportInternalV1(
  input: OpenProviderProductionStrongAuthorityServiceV1Input,
): Promise<OpenedProviderProductionStrongAuthorityServiceInternalV1> {
  if (typeof input.readTrustEvidence !== "function") {
    throw new TypeError("provider strong authority evidence reader is invalid");
  }
  const config = await readRootOwnedServiceConfigV1(input.serviceConfigPath);
  const readiness = await readProviderServiceReadinessV1({
    config,
    readinessPath: config.payload.readinessPath,
  });
  if (
    readiness.status !== "signed_candidate" ||
    readiness.providerId !== config.payload.providerId ||
    readiness.principalUid !== config.payload.principal.uid
  ) {
    throw new TypeError("provider strong authority readiness is unavailable");
  }
  const current = await readCurrentWriterV1(config, input.targetProfileId);
  const layout = resolveProviderAcceptanceAuthorityProductionLayoutInternalV1();
  const providerObjectsPath = join(
    config.payload.runtimeRoot,
    "objects",
    encodeURIComponent(config.payload.providerId),
  );
  const exactObjectAuthority =
    await openProviderStrongMutationLinuxExt4ExactObjectAuthorityInternalV1({
      profile: PROVIDER_STRONG_MUTATION_LINUX_EXT4_FENCE_PROFILE_INTERNAL_V1,
      providerId: config.payload.providerId,
      targetProfileId: current.targetProfileId,
      targetFingerprintDigest: ContentDigestV1Schema.parse(
        readiness.targetFingerprintDigest,
      ),
      capabilityDigest: ContentDigestV1Schema.parse(
        config.payload.capabilityDigest,
      ),
      installationIdentityGenerationId:
        current.installationIdentityGenerationId,
      principal: Object.freeze({
        uid: config.payload.principal.uid,
        gid: config.payload.principal.gid,
        handoffPayloadDigest: config.payloadDigest,
      }),
      targetDirectoryPath: providerObjectsPath,
      providerDirectoryPath: providerObjectsPath,
    });
  let server: ProviderStrongMutationBrokerServerInternalV1 | undefined;
  try {
    const executionFence =
      registerProviderStrongMutationLinuxExt4ExecutionFenceInternalV1(
        exactObjectAuthority,
      );
    const trustVerifier =
      mintProviderStrongMutationTrustVerifierCapabilityInternalV1({
        strictCryptoCapability: input.strictCryptoCapability,
        readEvidence: input.readTrustEvidence,
      });
    const broker =
      await openProviderStrongMutationBrokerStoreWithExecutionFenceAndLayoutCoreInternalV1(
        layout,
        trustVerifier,
        executionFence,
      );
    server = new ProviderStrongMutationBrokerServerInternalV1({
      socketPath: join(
        config.payload.runtimeRoot,
        STRONG_MUTATION_BROKER_SOCKET_BASENAME_V1,
      ),
      leasePath: `${input.serviceConfigPath}${STRONG_MUTATION_BROKER_LEASE_SUFFIX_V1}`,
      expectedRuntimeUid: config.payload.principal.uid,
      expectedRuntimeGid: config.payload.principal.gid,
      broker,
      readCurrentFormalAcceptance: async () => {
        const fresh = await readCurrentWriterV1(
          config,
          input.targetProfileId,
        );
        return Object.freeze({
          envelope: fresh.envelope,
          pin: fresh.pin,
        });
      },
    });
    await server.start();
    return createProviderProductionStrongAuthorityServiceCoreInternalV1(
      broker,
      Object.freeze({
        providerId: config.payload.providerId,
        installationIdentityDigest:
          config.payload.installationIdentityDigest,
      }),
      () => server!.close(),
      () =>
        closeProviderStrongMutationLinuxExt4ExactObjectAuthorityInternalV1(
          exactObjectAuthority,
        ),
      undefined,
    );
  } catch (error) {
    await server?.close().catch(() => undefined);
    await closeProviderStrongMutationLinuxExt4ExactObjectAuthorityInternalV1(
      exactObjectAuthority,
    );
    throw error;
  }
}

export async function openProviderProductionStrongAuthorityServiceV1(
  input: OpenProviderProductionStrongAuthorityServiceV1Input,
): Promise<ProviderProductionStrongAuthorityServiceV1> {
  const opened =
    await openProviderProductionStrongAuthorityServiceWithReceiptExportInternalV1(
      input,
    );
  return opened.service;
}
