/**
 * Side-effect bridge for the C09-1L prepared Registry path.
 *
 * Loading the ordinary Registry module installs its private prepared callback
 * (and, through its Root dependency, the private Root callback) into the
 * package-private handle module.  No prepared symbol is added to an existing
 * public module or package export.
 */

import "./provider-registry-manifest-history.js";

export {
  diagnoseProviderRegistryProspectiveEntryTemporaryAdmissionInternalV1,
  mintProviderRegistryProspectiveEntryTemporaryAdmissionCapabilityInternalV1,
} from "./provider-registry-manifest-history.js";
export type {
  ProviderRegistryProspectiveEntryTemporaryAdmissionCapabilityInternalV1,
  ProviderRegistryProspectiveEntryTemporaryAdmissionDiagnosticResultInternalV1,
  ProviderRegistryProspectiveEntryTemporaryAdmissionInputInternalV1,
  ProviderRegistryProspectiveEntryTemporaryAdmissionValidationInternalV1,
} from "./provider-registry-manifest-history.js";

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
