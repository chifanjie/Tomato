import { createPrivateKey, sign } from "node:crypto";

import { canonicalizeJcsSafeIntegerUtf8V1 } from "../../dist/jcs.js";
import {
  ProviderRealFilesystemConformanceResultEnvelopeV1Schema,
  ProviderRealFilesystemConformanceResultLocatorV1Schema,
  ProviderRealFilesystemConformanceResultPinV1Schema,
  ProviderRealFilesystemConformanceResultV1Schema,
  deriveProviderRealFilesystemConformanceResultContentDigestV1,
  deriveProviderRealFilesystemConformanceResultIdV1,
} from "../../dist/provider-real-filesystem-conformance-result.js";
import {
  StoreDurableObjectProviderRuntimeAttestationPinV1Schema,
  StoreDurableObjectProviderRuntimeAttestationV1Schema,
  createStoreDurableObjectProviderRuntimeAttestationSignatureMessageV1,
  deriveStoreDurableObjectProviderRuntimeAttestationContentDigestV1,
} from "../../dist/provider-registry-records.js";
import {
  PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_CASE_IDS_V1,
  executeProviderRuntimeAttestationPointInvalidCaseV1,
  materializeProviderRuntimeAttestationPointInvalidRequestWitnessV1,
} from "../../dist/provider-runtime-attestation-point-fixtures.js";
import {
  StoreDurableObjectProviderPolicyV1Schema,
  deriveStoreDurableObjectProviderPolicyDigestV1,
  deriveStoreProviderFilesystemProfileDigestV1,
} from "../../dist/provider-runtime-attestation-point.js";

export const GOLDEN_RESOURCE_PATH =
  "fixtures/v1/golden/provider-runtime-attestation-point-v1.json";
export const INVALID_RESOURCE_PATH =
  "fixtures/v1/invalid/provider-runtime-attestation-point-v1.json";
export const GOLDEN_SEMANTIC_DOMAIN =
  "provider-runtime-attestation-point-golden-manifest-v1";
export const INVALID_SEMANTIC_DOMAIN =
  "provider-runtime-attestation-point-invalid-manifest-v1";
export const INVALID_MATERIALIZED_REQUEST_DOMAIN =
  "provider-runtime-attestation-point-invalid-materialized-request-v1";
export const INVALID_RECIPE_DIALECT =
  "provider_runtime_attestation_point_invalid_recipe_v1";

export const INVALID_CASE_IDS =
  PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_CASE_IDS_V1;
export const executeProviderRuntimeAttestationPointInvalidCase =
  executeProviderRuntimeAttestationPointInvalidCaseV1;
export const materializeInvalidRequestWitness =
  materializeProviderRuntimeAttestationPointInvalidRequestWitnessV1;

export function jsonClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function digest(character) {
  return `sha256:${character.repeat(64)}`;
}

function privateKeyFromSeedHex(seedHex) {
  return createPrivateKey({
    key: Buffer.concat([
      Buffer.from("302e020100300506032b657004220420", "hex"),
      Buffer.from(seedHex, "hex"),
    ]),
    format: "der",
    type: "pkcs8",
  });
}

function registrySignature(rootKeyId, seedHex, message) {
  return `provider-registry-ed25519:${rootKeyId}:${sign(
    null,
    Buffer.from(message),
    privateKeyFromSeedHex(seedHex),
  ).toString("hex")}`;
}

function bitflipSignature(signature) {
  const last = signature.at(-1);
  return `${signature.slice(0, -1)}${last === "0" ? "1" : "0"}`;
}

function resultIdFields(payload) {
  const { profile: _profile, resultId: _resultId, ...fields } = payload;
  return fields;
}

function finalizeResult(base) {
  const fields = resultIdFields(base);
  const resultId = deriveProviderRealFilesystemConformanceResultIdV1(fields);
  const payload = ProviderRealFilesystemConformanceResultV1Schema.parse({
    ...fields,
    profile: "provider_real_fs_conformance_result_v1",
    resultId,
  });
  const envelope = ProviderRealFilesystemConformanceResultEnvelopeV1Schema.parse({
    schemaVersion: 1,
    recordType: "provider_real_fs_conformance_result",
    resultId,
    contentDigest:
      deriveProviderRealFilesystemConformanceResultContentDigestV1(payload),
    payload,
  });
  const locator = ProviderRealFilesystemConformanceResultLocatorV1Schema.parse({
    locatorProfile: "installation_provider_real_fs_conformance_result_v1",
    resultId,
  });
  const pin = ProviderRealFilesystemConformanceResultPinV1Schema.parse({
    ...locator,
    contentDigest: envelope.contentDigest,
  });
  return { envelope, locator, pin };
}

function runtimeUnsigned(payload) {
  const { registrySignature: _registrySignature, ...unsigned } = payload;
  return unsigned;
}

function finalizeRuntime(
  base,
  rootKeyId,
  rootSeedHex,
  options = {},
) {
  const unsigned = runtimeUnsigned(base);
  const message =
    options.message ??
    createStoreDurableObjectProviderRuntimeAttestationSignatureMessageV1(
      unsigned,
      rootKeyId,
    );
  const signatureRootKeyId = options.signatureRootKeyId ?? rootKeyId;
  const signature = registrySignature(
    signatureRootKeyId,
    options.signerSeedHex ?? rootSeedHex,
    message,
  );
  const payload = StoreDurableObjectProviderRuntimeAttestationV1Schema.parse({
    ...unsigned,
    registrySignature: signature,
  });
  return StoreDurableObjectProviderRuntimeAttestationPinV1Schema.parse({
    profile: "store_durable_object_provider_runtime_attestation_pin_v1",
    contentDigest:
      deriveStoreDurableObjectProviderRuntimeAttestationContentDigestV1(payload),
    payload,
  });
}

function basePolicy(result) {
  return StoreDurableObjectProviderPolicyV1Schema.parse({
    profile: "store_durable_object_provider_policy_v1",
    protocolVersion: 1,
    providerId: result.providerId,
    ipcPeerAuthenticationPolicyDigest: digest("d"),
    isolation: {
      kind: "separate_os_principal",
      securityBoundaryProfileDigest: digest("e"),
    },
    sourceNamespaceVisibility: "inaccessible_to_workspace_writer",
    supportedStagingObjectKinds: ["regular", "directory"],
    stagingRecovery:
      "opaque_locator_idempotent_allocate_or_reopen_exact_unpublished_object_across_restart",
    durableIdentity:
      "same_object_stable_aba_recreate_distinct_across_restart",
    publishSemantics:
      "exact_opened_object_no_replace_with_atomic_bound_root_containment",
    externalIntentStateSemantics:
      "atomic_monotonic_compare_replace_with_restart_receipt_and_handoff_cut",
    handoffJournalSemantics:
      "immutable_no_replace_compare_tip_complete_enumeration_prospective_sealed_version_atomic_seal",
    storeManifestCompareAppendReceiptLedger: {
      profile: "store_manifest_compare_append_receipt_ledger_policy_v1",
      locatorProfile: "store_manifest_compare_append_receipt_v1",
      storageBoundary: "provider_isolated_non_store_namespace",
      appendSemantics:
        "immutable_no_replace_by_repository_worktree_operation_nonce",
      maxReceiptCountPerRepositoryWorktree: 16_384,
      maxReceiptLogicalBytesPerRepositoryWorktree: 67_108_864,
      maxSingleReceiptLogicalBytes: 1_048_576,
      admission:
        "freeze_resolved_at_and_complete_signed_receipt_then_reserve_exact_count_and_canonical_bytes_before_atomic_namespace_commit",
      quotaAccounting: "excluded_from_private_store_quota_root",
    },
    deleteSemantics:
      "exact_opened_object_atomic_compare_delete_with_containment",
    stockSameUidFilesystemFallback: "forbidden",
    realFilesystemConformanceSuiteDigest: result.suiteDigest,
  });
}

function runtimeForResult(resultEnvelope, policyDigest, rootKeyId, rootSeedHex) {
  const result = resultEnvelope.payload;
  const filesystemProfileDigest = deriveStoreProviderFilesystemProfileDigestV1({
    filesystemProfileCode: result.target.filesystemProfileCode,
    filesystemFeatureProfileDigest:
      result.target.filesystemFeatureProfileDigest,
    mountOptionProfileDigest: result.target.mountOptionProfileDigest,
  });
  return finalizeRuntime(
    {
      profile: "store_durable_object_provider_runtime_attestation_v1",
      providerId: result.providerId,
      semanticProviderPolicyDigest: policyDigest,
      implementationDigest: result.implementationDigest,
      binaryAttestationDigest: result.binaryAttestationDigest,
      ipcEndpointAttestationDigest: digest("f"),
      osPlatform: result.target.osPlatform,
      osReleaseFamilyCode: result.target.osReleaseFamilyCode,
      osBuildDigest: result.target.osBuildDigest,
      architecture: result.target.architecture,
      filesystemProfileDigest,
      realFilesystemConformanceResultDigest: resultEnvelope.contentDigest,
      attestationGeneration: 1,
      issuedAt: "2026-08-04T04:00:00Z",
    },
    rootKeyId,
    rootSeedHex,
  );
}

export function buildGoldenProviderRuntimeAttestationPointFixture(
  conformanceResultGolden,
  rootSeedHex,
) {
  const originalResult = conformanceResultGolden.realFilesystemConformanceResult.payload;
  const semanticProviderPolicy = basePolicy(originalResult);
  const semanticProviderPolicyDigest =
    deriveStoreDurableObjectProviderPolicyDigestV1(semanticProviderPolicy);
  const updatedResult = finalizeResult({
    ...jsonClone(originalResult),
    semanticProviderPolicyDigest,
  });
  const rootKeyId = conformanceResultGolden.activeRoot.rootKeyId;
  const runtimeAttestation = runtimeForResult(
    updatedResult.envelope,
    semanticProviderPolicyDigest,
    rootKeyId,
    rootSeedHex,
  );
  const resultTarget = updatedResult.envelope.payload.target;
  const filesystemFields = {
    filesystemProfileCode: resultTarget.filesystemProfileCode,
    filesystemFeatureProfileDigest:
      resultTarget.filesystemFeatureProfileDigest,
    mountOptionProfileDigest: resultTarget.mountOptionProfileDigest,
  };
  return {
    schemaVersion: 1,
    profile: "provider_runtime_attestation_point_golden_v1",
    fixtureAuthority: "none_provider_runtime_attestation_structure_only",
    canonicalizationProfile: "rfc8785-jcs-safe-integer-v1",
    verificationProfile: "ed25519-rfc8032-cofactorless-prime-subgroup-v1",
    conformanceResultGolden: jsonClone(conformanceResultGolden),
    realFilesystemConformanceResult: updatedResult.envelope,
    realFilesystemConformanceResultLocator: updatedResult.locator,
    realFilesystemConformanceResultPin: updatedResult.pin,
    semanticProviderPolicy,
    runtimeAttestation,
    expected: {
      semanticProviderPolicyPreimageCanonicalUtf8Hex: Buffer.from(
        canonicalizeJcsSafeIntegerUtf8V1([
          "store-durable-object-provider-policy-v1",
          semanticProviderPolicy,
        ]),
      ).toString("hex"),
      filesystemProfilePreimageCanonicalUtf8Hex: Buffer.from(
        canonicalizeJcsSafeIntegerUtf8V1([
          "store-provider-filesystem-profile-v1",
          filesystemFields,
        ]),
      ).toString("hex"),
      runtimeSignatureMessageUtf8Hex: Buffer.from(
        createStoreDurableObjectProviderRuntimeAttestationSignatureMessageV1(
          runtimeAttestation.payload,
          rootKeyId,
        ),
      ).toString("hex"),
      semanticProviderPolicyDigest,
      filesystemProfileDigest: runtimeAttestation.payload.filesystemProfileDigest,
      runtimeAttestationContentDigest: runtimeAttestation.contentDigest,
      realFilesystemConformanceResultContentDigest:
        updatedResult.envelope.contentDigest,
      activeRootPointAdmissionCount: 1,
      signatureVerificationCount: 7,
      runtimeSignatureCount: 1,
      conformanceResultSignatureCount: 0,
    },
  };
}

export function requestFromGolden(golden, strictCryptoCapability) {
  const source = golden.conformanceResultGolden;
  return {
    activeRoot: jsonClone(source.activeRoot),
    activeRootMetadata: jsonClone(source.activeRootMetadata),
    distributionRootBinding: jsonClone(source.distributionRootBinding),
    fixtureCorpusManifest: jsonClone(source.fixtureCorpusManifest),
    publicSupportTaxonomy: jsonClone(source.publicSupportTaxonomy),
    realFilesystemConformanceResult: jsonClone(
      golden.realFilesystemConformanceResult,
    ),
    realFilesystemConformanceResultLocator: jsonClone(
      golden.realFilesystemConformanceResultLocator,
    ),
    realFilesystemConformanceResultPin: jsonClone(
      golden.realFilesystemConformanceResultPin,
    ),
    releaseMatrix: jsonClone(source.releaseMatrix),
    runtimeAttestation: jsonClone(golden.runtimeAttestation),
    semanticProviderPolicy: jsonClone(golden.semanticProviderPolicy),
    strictCryptoCapability,
    suiteManifest: jsonClone(source.suiteManifest),
    targetDiscoveryFixtureManifest: jsonClone(
      source.targetDiscoveryFixtureManifest,
    ),
    targetDiscoveryResult: jsonClone(source.targetDiscoveryResult),
    targetDiscoveryRunnerRun: jsonClone(source.targetDiscoveryRunnerRun),
  };
}

function replacementRecipe(replacements) {
  return {
    kind: "replace_artifacts",
    ...Object.fromEntries(
      Object.entries(replacements).map(([key, value]) => [
        key,
        new TextDecoder().decode(canonicalizeJcsSafeIntegerUtf8V1(value)),
      ]),
    ),
  };
}

function mutatePolicyStructure(golden, caseId) {
  const policy = jsonClone(golden.semanticProviderPolicy);
  const ledger = policy.storeManifestCompareAppendReceiptLedger;
  switch (caseId) {
    case "policy-profile-invalid": policy.profile = "store_durable_object_provider_policy_v2"; break;
    case "policy-protocol-version-invalid": policy.protocolVersion = 2; break;
    case "policy-isolation-kind-invalid": policy.isolation.kind = "same_uid_directory"; break;
    case "policy-source-namespace-visibility-invalid": policy.sourceNamespaceVisibility = "workspace_writer_visible"; break;
    case "policy-staging-kinds-order-invalid": policy.supportedStagingObjectKinds = ["directory", "regular"]; break;
    case "policy-staging-kinds-extra-invalid": policy.supportedStagingObjectKinds = ["regular", "directory", "symlink"]; break;
    case "policy-staging-recovery-invalid": policy.stagingRecovery = "best_effort"; break;
    case "policy-durable-identity-invalid": policy.durableIdentity = "path_identity"; break;
    case "policy-publish-semantics-invalid": policy.publishSemantics = "rename_replace"; break;
    case "policy-external-intent-semantics-invalid": policy.externalIntentStateSemantics = "last_writer_wins"; break;
    case "policy-handoff-journal-semantics-invalid": policy.handoffJournalSemantics = "append_unsealed"; break;
    case "ledger-profile-invalid": ledger.profile = "store_manifest_compare_append_receipt_ledger_policy_v2"; break;
    case "ledger-locator-profile-invalid": ledger.locatorProfile = "store_manifest_compare_append_receipt_v2"; break;
    case "ledger-storage-boundary-invalid": ledger.storageBoundary = "private_store_namespace"; break;
    case "ledger-append-semantics-invalid": ledger.appendSemantics = "replace_by_nonce"; break;
    case "ledger-max-receipt-count-invalid": ledger.maxReceiptCountPerRepositoryWorktree = 16_383; break;
    case "ledger-max-logical-bytes-invalid": ledger.maxReceiptLogicalBytesPerRepositoryWorktree = 67_108_863; break;
    case "ledger-max-single-bytes-invalid": ledger.maxSingleReceiptLogicalBytes = 1_048_575; break;
    case "ledger-admission-invalid": ledger.admission = "reserve_after_commit"; break;
    case "ledger-quota-accounting-invalid": ledger.quotaAccounting = "included_in_private_store_quota_root"; break;
    case "policy-delete-semantics-invalid": policy.deleteSemantics = "path_delete"; break;
    case "policy-stock-fallback-invalid": policy.stockSameUidFilesystemFallback = "allowed"; break;
    case "policy-extra-field": policy.unexpected = true; break;
    default: return undefined;
  }
  return replacementRecipe({ semanticProviderPolicy: policy });
}

function cascadePolicyDigest(golden, policy, rootSeedHex) {
  const semanticProviderPolicyDigest =
    deriveStoreDurableObjectProviderPolicyDigestV1(policy);
  const updatedResult = finalizeResult({
    ...jsonClone(golden.realFilesystemConformanceResult.payload),
    semanticProviderPolicyDigest,
  });
  const runtimeBase = {
    ...jsonClone(golden.runtimeAttestation.payload),
    semanticProviderPolicyDigest,
    realFilesystemConformanceResultDigest: updatedResult.envelope.contentDigest,
  };
  const runtimeAttestation = finalizeRuntime(
    runtimeBase,
    golden.conformanceResultGolden.activeRoot.rootKeyId,
    rootSeedHex,
  );
  return replacementRecipe({
    semanticProviderPolicy: policy,
    realFilesystemConformanceResult: updatedResult.envelope,
    realFilesystemConformanceResultLocator: updatedResult.locator,
    realFilesystemConformanceResultPin: updatedResult.pin,
    runtimeAttestation,
  });
}

function mutateRuntimeAndResign(golden, changes, rootSeedHex, options = {}) {
  const rootKeyId = golden.conformanceResultGolden.activeRoot.rootKeyId;
  const runtimeBase = {
    ...jsonClone(golden.runtimeAttestation.payload),
    ...changes,
  };
  return replacementRecipe({
    runtimeAttestation: finalizeRuntime(
      runtimeBase,
      rootKeyId,
      rootSeedHex,
      options,
    ),
  });
}

function pointRecipe(golden, caseId, rootSeedHex) {
  const structural = mutatePolicyStructure(golden, caseId);
  if (structural !== undefined) return structural;
  const rootKeyId = golden.conformanceResultGolden.activeRoot.rootKeyId;
  const result = golden.realFilesystemConformanceResult.payload;
  switch (caseId) {
    case "policy-digest-mismatch": {
      const policy = jsonClone(golden.semanticProviderPolicy);
      policy.ipcPeerAuthenticationPolicyDigest = digest("1");
      return replacementRecipe({ semanticProviderPolicy: policy });
    }
    case "policy-provider-binding-mismatch": {
      const policy = jsonClone(golden.semanticProviderPolicy);
      policy.providerId = "durable-object-provider:alternate";
      return cascadePolicyDigest(golden, policy, rootSeedHex);
    }
    case "policy-suite-binding-mismatch": {
      const policy = jsonClone(golden.semanticProviderPolicy);
      policy.realFilesystemConformanceSuiteDigest = digest("1");
      return cascadePolicyDigest(golden, policy, rootSeedHex);
    }
    case "precedence-policy-digest-before-runtime-structure": {
      const policy = jsonClone(golden.semanticProviderPolicy);
      policy.ipcPeerAuthenticationPolicyDigest = digest("1");
      const runtimeAttestation = jsonClone(golden.runtimeAttestation);
      runtimeAttestation.payload.unexpected = true;
      return replacementRecipe({ semanticProviderPolicy: policy, runtimeAttestation });
    }
    case "precedence-result-policy-binding-before-runtime-pin": {
      const policy = jsonClone(golden.semanticProviderPolicy);
      policy.providerId = "durable-object-provider:alternate";
      const cascaded = cascadePolicyDigest(golden, policy, rootSeedHex);
      const runtimeAttestation = JSON.parse(cascaded.runtimeAttestation);
      runtimeAttestation.profile =
        "store_durable_object_provider_runtime_attestation_pin_v2";
      return replacementRecipe({
        semanticProviderPolicy: JSON.parse(cascaded.semanticProviderPolicy),
        realFilesystemConformanceResult: JSON.parse(
          cascaded.realFilesystemConformanceResult,
        ),
        realFilesystemConformanceResultLocator: JSON.parse(
          cascaded.realFilesystemConformanceResultLocator,
        ),
        realFilesystemConformanceResultPin: JSON.parse(
          cascaded.realFilesystemConformanceResultPin,
        ),
        runtimeAttestation,
      });
    }
    case "runtime-pin-profile-invalid": {
      const runtimeAttestation = jsonClone(golden.runtimeAttestation);
      runtimeAttestation.profile = "store_durable_object_provider_runtime_attestation_pin_v2";
      return replacementRecipe({ runtimeAttestation });
    }
    case "runtime-pin-content-digest-missing": {
      const runtimeAttestation = jsonClone(golden.runtimeAttestation);
      delete runtimeAttestation.contentDigest;
      return replacementRecipe({ runtimeAttestation });
    }
    case "runtime-pin-extra-field": {
      const runtimeAttestation = jsonClone(golden.runtimeAttestation);
      runtimeAttestation.unexpected = true;
      return replacementRecipe({ runtimeAttestation });
    }
    case "runtime-payload-profile-invalid": {
      const runtimeAttestation = jsonClone(golden.runtimeAttestation);
      runtimeAttestation.payload.profile =
        "store_durable_object_provider_runtime_attestation_v2";
      return replacementRecipe({ runtimeAttestation });
    }
    case "runtime-payload-required-field-missing": {
      const runtimeAttestation = jsonClone(golden.runtimeAttestation);
      delete runtimeAttestation.payload.ipcEndpointAttestationDigest;
      return replacementRecipe({ runtimeAttestation });
    }
    case "runtime-payload-extra-field": {
      const runtimeAttestation = jsonClone(golden.runtimeAttestation);
      runtimeAttestation.payload.unexpected = true;
      return replacementRecipe({ runtimeAttestation });
    }
    case "runtime-generation-zero": {
      const runtimeAttestation = jsonClone(golden.runtimeAttestation);
      runtimeAttestation.payload.attestationGeneration = 0;
      return replacementRecipe({ runtimeAttestation });
    }
    case "runtime-issued-at-noncanonical": {
      const runtimeAttestation = jsonClone(golden.runtimeAttestation);
      runtimeAttestation.payload.issuedAt = "2026-08-04T04:00:00+00:00";
      return replacementRecipe({ runtimeAttestation });
    }
    case "runtime-issued-at-invalid-date": {
      const runtimeAttestation = jsonClone(golden.runtimeAttestation);
      runtimeAttestation.payload.issuedAt = "2026-02-30T04:00:00Z";
      return replacementRecipe({ runtimeAttestation });
    }
    case "runtime-os-platform-invalid": {
      const runtimeAttestation = jsonClone(golden.runtimeAttestation);
      runtimeAttestation.payload.osPlatform = "freebsd";
      return replacementRecipe({ runtimeAttestation });
    }
    case "runtime-architecture-invalid": {
      const runtimeAttestation = jsonClone(golden.runtimeAttestation);
      runtimeAttestation.payload.architecture = "riscv64";
      return replacementRecipe({ runtimeAttestation });
    }
    case "runtime-ipc-endpoint-digest-invalid": {
      const runtimeAttestation = jsonClone(golden.runtimeAttestation);
      runtimeAttestation.payload.ipcEndpointAttestationDigest =
        "unix:///private/provider.sock";
      return replacementRecipe({ runtimeAttestation });
    }
    case "runtime-signature-format-invalid": {
      const runtimeAttestation = jsonClone(golden.runtimeAttestation);
      runtimeAttestation.payload.registrySignature = "not-a-registry-signature";
      return replacementRecipe({ runtimeAttestation });
    }
    case "runtime-pin-content-digest-mismatch": {
      const runtimeAttestation = jsonClone(golden.runtimeAttestation);
      runtimeAttestation.contentDigest = digest("0");
      return replacementRecipe({ runtimeAttestation });
    }
    case "runtime-provider-binding-mismatch":
      return mutateRuntimeAndResign(
        golden,
        { providerId: "durable-object-provider:alternate" },
        rootSeedHex,
      );
    case "runtime-policy-binding-mismatch":
      return mutateRuntimeAndResign(
        golden,
        { semanticProviderPolicyDigest: digest("1") },
        rootSeedHex,
      );
    case "runtime-implementation-binding-mismatch":
      return mutateRuntimeAndResign(golden, { implementationDigest: digest("1") }, rootSeedHex);
    case "runtime-binary-binding-mismatch":
      return mutateRuntimeAndResign(golden, { binaryAttestationDigest: digest("1") }, rootSeedHex);
    case "runtime-os-platform-binding-mismatch":
      return mutateRuntimeAndResign(
        golden,
        { osPlatform: result.target.osPlatform === "darwin" ? "linux" : "darwin" },
        rootSeedHex,
      );
    case "runtime-os-family-binding-mismatch": {
      const other = golden.conformanceResultGolden.targetDiscoveryResult.payload.targets
        .map((entry) => entry.target.osReleaseFamilyCode)
        .find((value) => value !== result.target.osReleaseFamilyCode);
      if (other === undefined) throw new Error("golden has no alternate OS family");
      return mutateRuntimeAndResign(golden, { osReleaseFamilyCode: other }, rootSeedHex);
    }
    case "runtime-os-build-binding-mismatch":
      return mutateRuntimeAndResign(
        golden,
        { osBuildDigest: result.target.osBuildDigest === digest("9") ? digest("8") : digest("9") },
        rootSeedHex,
      );
    case "runtime-architecture-binding-mismatch":
      return mutateRuntimeAndResign(
        golden,
        { architecture: result.target.architecture === "arm64" ? "x86_64" : "arm64" },
        rootSeedHex,
      );
    case "runtime-filesystem-profile-binding-mismatch":
      return mutateRuntimeAndResign(golden, { filesystemProfileDigest: digest("1") }, rootSeedHex);
    case "runtime-result-digest-binding-mismatch":
      return mutateRuntimeAndResign(
        golden,
        { realFilesystemConformanceResultDigest: digest("1") },
        rootSeedHex,
      );
    case "runtime-signature-bitflip": {
      const runtimeAttestation = jsonClone(golden.runtimeAttestation);
      runtimeAttestation.payload.registrySignature = bitflipSignature(
        runtimeAttestation.payload.registrySignature,
      );
      return replacementRecipe({ runtimeAttestation });
    }
    case "runtime-signature-wrong-signer":
      return mutateRuntimeAndResign(golden, {}, rootSeedHex, {
        signerSeedHex: "31".repeat(32),
      });
    case "runtime-signature-wrong-domain":
      return mutateRuntimeAndResign(golden, {}, rootSeedHex, {
        message: canonicalizeJcsSafeIntegerUtf8V1([
          "store-provider-runtime-attestation-signature-wrong-domain-v1",
          runtimeUnsigned(golden.runtimeAttestation.payload),
        ]),
      });
    case "runtime-root-mismatch": {
      const runtimeAttestation = jsonClone(golden.runtimeAttestation);
      runtimeAttestation.payload.registrySignature =
        runtimeAttestation.payload.registrySignature.replace(
          `:${rootKeyId}:`,
          `:${"0".repeat(22)}:`,
        );
      return replacementRecipe({ runtimeAttestation });
    }
    default:
      break;
  }
  const hostileProfiles = {
    "runtime-generation-fractional": "runtime_generation_fractional",
    "runtime-generation-unsafe": "runtime_generation_unsafe",
    "point-input-extra-field": "extra_field",
    "point-input-plain-validation-dto": "plain_validation_dto",
    "point-security-top-level-proxy": "top_level_proxy",
    "point-security-nested-proxy": "nested_proxy",
    "point-security-top-level-getter": "top_level_getter",
    "point-security-nested-getter": "nested_getter",
    "point-security-top-level-hidden": "top_level_hidden",
    "point-security-nested-hidden": "nested_hidden",
    "point-security-top-level-symbol": "top_level_symbol",
    "point-security-nested-symbol": "nested_symbol",
    "point-security-sparse-array": "sparse_array",
    "point-security-cycle": "cycle",
    "point-security-alias": "alias",
    "point-security-async-mutation": "async_mutation",
  };
  const profile = hostileProfiles[caseId];
  if (profile !== undefined) return { kind: "hostile_input", profile };
  throw new Error(`unknown runtime attestation point invalid case ${caseId}`);
}

export function buildInvalidMutation(golden, caseId, rootSeedHex) {
  const recipe = caseId.startsWith("inner-")
    ? {
        kind: "inner_conformance_result",
        sourceOperation: caseId.slice("inner-".length),
      }
    : pointRecipe(golden, caseId, rootSeedHex);
  return {
    dialect: INVALID_RECIPE_DIALECT,
    goldenResourcePath: GOLDEN_RESOURCE_PATH,
    operation: caseId,
    recipe,
  };
}
