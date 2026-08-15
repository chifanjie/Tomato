/**
 * Side-effect bridge for the C09-1L prepared Registry path and its D42
 * retained direct-successor continuation.
 *
 * Loading the ordinary Registry module installs its private prepared callback
 * (and, through its Root dependency, the private Root callback) into the
 * package-private handle module.  No prepared symbol is added to an existing
 * public module or package export.
 */

import "./provider-registry-manifest-history.js";

export {
  diagnoseProviderRegistryPreparedDirectSuccessorInternalV1,
  diagnoseProviderRegistryProspectiveEntryTemporaryAdmissionInternalV1,
  mintProviderRegistryProspectiveEntryTemporaryAdmissionCapabilityInternalV1,
} from "./provider-registry-manifest-history.js";
export type {
  ProviderRegistryPreparedDirectSuccessorDiagnosticResultInternalV1,
  ProviderRegistryPreparedDirectSuccessorInputInternalV1,
  ProviderRegistryPreparedDirectSuccessorValidationInternalV1,
  ProviderRegistryProspectiveEntryTemporaryAdmissionCapabilityInternalV1,
  ProviderRegistryProspectiveEntryTemporaryAdmissionDiagnosticResultInternalV1,
  ProviderRegistryProspectiveEntryTemporaryAdmissionInputInternalV1,
  ProviderRegistryProspectiveEntryTemporaryAdmissionValidationInternalV1,
} from "./provider-registry-manifest-history.js";

export {
  bindProviderRegistryPreparedSuccessorCohortToFinalCandidateInternalV1,
  bindProviderRegistryPreparedSuccessorSeedToCohortInternalV1,
  discardProviderRegistryPreparedSuccessorCohortInternalV1,
  discardProviderRegistryPreparedSuccessorFinalInternalV1,
  discardProviderRegistryPreparedSuccessorSeedInternalV1,
  takeProviderRegistryPreparedSuccessorFinalCandidateInternalV1,
} from "./provider-registry-history-prepared-successor-handle-internal.js";
export type {
  ProviderRegistryPreparedSuccessorCohortCapabilityInternalV1,
  ProviderRegistryPreparedSuccessorFinalCapabilityInternalV1,
  ProviderRegistryPreparedSuccessorRetainedPayloadInternalV1,
  ProviderRegistryPreparedSuccessorSeedInternalV1,
} from "./provider-registry-history-prepared-successor-handle-internal.js";

export {
  assertProviderRegistryPreparedCopyLedgerZeroInternalV1,
  createPreparedRegistryHistorySnapshotInternalV1,
  createProviderRegistryPreparedCopyLedgerInternalV1,
  createRegistryHistoryVerifiedCryptoWitnessInternalV1,
  diagnoseProviderRegistryManifestHistoryPreparedInternalV1,
  discardPreparedRegistryHistoryInputInternalV1,
  discardRegistryHistoryVerifiedWitnessInternalV1,
  registerPreparedRegistryHistoryInputInternalV1,
  registerRegistryHistoryVerifiedWitnessInternalV1,
  takePreparedRegistryHistoryInputInternalV1,
  takeRegistryHistoryVerifiedWitnessInternalV1,
} from "./provider-registry-history-prepared-handle-internal.js";
export type {
  PreparedRegistryHistoryInputHandleV1,
  PreparedRegistryHistorySnapshotV1,
  ProviderRegistryManifestHistoryPreparedDiagnosticResultInternalV1,
  ProviderRegistryManifestHistoryPreparedValidationInternalV1,
  ProviderRegistryPreparedCopyLedgerV1,
  RegistryHistoryVerifiedCryptoWitnessV1,
  RegistryHistoryVerifiedTipEntryV1,
  RegistryTrustWitnessHandleV1,
} from "./provider-registry-history-prepared-handle-internal.js";
