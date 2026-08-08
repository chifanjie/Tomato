import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  PROVIDER_FEASIBILITY_EVIDENCE_POINT_GOLDEN_RESOURCE_PATH_V1,
  PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_RESOURCE_PATH_V1,
  PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_RESOURCE_SHA256_HEX_V1,
  PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_SEMANTIC_CONTENT_DIGEST_V1,
  PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_SEMANTIC_DOMAIN_V1,
} from "../dist/provider-feasibility-evidence-point-fixtures.js";
import {
  PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_RESOURCE_PATH_V1,
  PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_RESOURCE_SHA256_HEX_V1,
  PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
  PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_SEMANTIC_DOMAIN_V1,
} from "../dist/provider-real-filesystem-source-fixtures.js";
import {
  diagnoseProviderRegistryEvidenceBindingPointClosureV1,
} from "../dist/provider-registry-evidence-binding-point.js";
import {
  discardProviderRegistryEvidenceBindingBudgetWitnessInternalV1,
  materializeProviderRegistryEvidenceBindingBudgetWitnessInternalV1,
  takeAndVerifyProviderRegistryEvidenceBindingBudgetReplayInternalV1,
} from "../dist/provider-registry-evidence-binding-point-budget-witness-internal.js";
import {
  PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_PATH_V1,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_SHA256_HEX_V1,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_SEMANTIC_DOMAIN_V1,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_RESOURCE_PATH_V1,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_RESOURCE_SHA256_HEX_V1,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_SEMANTIC_CONTENT_DIGEST_V1,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_SEMANTIC_DOMAIN_V1,
} from "../dist/provider-registry-manifest-fixtures.js";
import {
  diagnoseProviderRegistryManifestHistoryInternalV1,
} from "../dist/provider-registry-manifest-history.js";
import {
  PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_PATH_V1,
  PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_SHA256_HEX_V1,
  PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
  PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_SEMANTIC_DOMAIN_V1,
} from "../dist/provider-registry-root-history-fixtures.js";
import {
  PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1,
  PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
  attestProviderStrictEd25519CryptoHostV1,
} from "../dist/strict-ed25519-conformance.js";
import {
  STRICT_ED25519_VERIFICATION_PROFILE_V1,
  validatePrimeSubgroupPoint,
  verifyRawEd25519,
} from "../dist/strict-ed25519.js";
import {
  GOLDEN_RESOURCE_PATH,
  GOLDEN_SEMANTIC_DOMAIN,
  NATIVE_B_PROVIDER_ID,
  QA_APPROVER_SEED_HEX,
  RELEASE_APPROVER_SEED_HEX,
  ROOT_3_SEED_HEX,
  buildCompatibleBaseFixture,
  expectedEvidenceRelativePath,
  jsonClone,
  prettyBytes,
  projectSuccessfulClosure,
  requestFromCompatibleBase,
  semanticDigest,
  sha256Hex,
} from "./lib/provider-registry-evidence-binding-point-fixture.mjs";
import {
  PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_EVIDENCE_ADAPTER_DEFINITIONS_V1,
  PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_EVIDENCE_ADAPTER_TABLE_SEMANTIC_CONTENT_DIGEST_V1,
  buildProviderRegistryEvidenceBindingEvidenceAdapterContextV1,
  deriveProviderRegistryEvidenceBindingEvidenceAdapterMaterializedRequestDigestV1,
  deriveProviderRegistryEvidenceBindingEvidenceAdapterTableDigestV1,
  materializeProviderRegistryEvidenceBindingEvidenceAdapterCaseV1,
  materializeProviderRegistryEvidenceBindingEvidenceAdapterProductionResultVariantV1,
  materializeProviderRegistryEvidenceBindingPointSpecificVariantForGeneratorV1,
  verifyProviderRegistryEvidenceBindingEvidenceAdapterSourceV1,
} from "./lib/provider-registry-evidence-binding-point-evidence-adapter.mjs";
import {
  PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_REGISTRY_ADAPTER_DEFINITIONS_V1,
  PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_REGISTRY_ADAPTER_TABLE_SEMANTIC_CONTENT_DIGEST_V1,
  deriveProviderRegistryEvidenceBindingRegistryAdapterMaterializedRequestDigestV1,
  deriveProviderRegistryEvidenceBindingRegistryAdapterTableDigestV1,
  finalizeProviderRegistryEvidenceBindingRegistryAdapterRowV1,
  materializeProviderRegistryEvidenceBindingRegistryAdapterCaseV1,
  verifyProviderRegistryEvidenceBindingRegistryAdapterSourceV1,
} from "./lib/provider-registry-evidence-binding-point-registry-adapter.mjs";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const goldenPath = join(packageRoot, ...GOLDEN_RESOURCE_PATH.split("/"));
const INVALID_RESOURCE_PATH =
  "fixtures/v1/invalid/provider-registry-evidence-binding-point-v1.json";
const invalidPath = join(packageRoot, ...INVALID_RESOURCE_PATH.split("/"));
const strictManifestPath = join(
  packageRoot,
  ...PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1.split("/"),
);

async function readAnchoredDependency({
  resourcePath,
  resourceByteLength,
  resourceSha256Hex,
  semanticDomain,
  semanticContentDigest,
  embeddedSemanticDigest = false,
}) {
  const bytes = await readFile(
    join(packageRoot, ...resourcePath.split("/")),
  );
  if (
    bytes.byteLength !== resourceByteLength ||
    sha256Hex(bytes) !== resourceSha256Hex
  ) {
    throw new Error(`${resourcePath} raw-byte anchor drifted`);
  }
  const value = JSON.parse(bytes.toString("utf8"));
  let observedSemanticDigest;
  if (embeddedSemanticDigest) {
    const {
      semanticContentDigest: embedded,
      ...semanticFields
    } = value;
    observedSemanticDigest = semanticDigest(semanticDomain, semanticFields);
    if (embedded !== observedSemanticDigest) {
      throw new Error(`${resourcePath} embedded semantic digest drifted`);
    }
  } else {
    observedSemanticDigest = semanticDigest(semanticDomain, value);
  }
  if (observedSemanticDigest !== semanticContentDigest) {
    throw new Error(`${resourcePath} semantic anchor drifted`);
  }
  return { bytes, value };
}

function dependencyAnchor(
  resourcePath,
  resourceByteLength,
  resourceSha256Hex,
  semanticContentDigest,
) {
  return {
    resourcePath,
    resourceByteLength,
    resourceSha256Hex,
    semanticContentDigest,
  };
}

function canonicalJsonEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function assertReanchoredRegistryTopology(registryGolden, generated) {
  if (
    generated.length !== 7 ||
    !canonicalJsonEqual(
      generated.slice(0, 2),
      registryGolden.registryManifestHistory.slice(0, 2),
    )
  ) {
    throw new Error("compatible Registry did not retain exact generations 1-2");
  }
  for (let index = 2; index < generated.length; index += 1) {
    const original = registryGolden.registryManifestHistory[index];
    const current = generated[index];
    if (
      current.payload.manifestGeneration !== index + 1 ||
      current.payload.members.length !== original.payload.members.length ||
      !canonicalJsonEqual(current.payload.routing, original.payload.routing) ||
      current.payload.activeRootMetadata.rootGeneration !== 3 ||
      current.payload.predecessor.state !== "manifest" ||
      current.payload.predecessor.generationId !==
        generated[index - 1].generationId ||
      current.payload.predecessor.contentDigest !==
        generated[index - 1].contentDigest
    ) {
      throw new Error(`compatible Registry generation ${index + 1} drifted`);
    }
    const nativeB = current.payload.members.find(
      ({ providerId }) => providerId === NATIVE_B_PROVIDER_ID,
    );
    if (
      nativeB?.disposition !== "enabled" ||
      nativeB.registryEntry.providerId !== NATIVE_B_PROVIDER_ID ||
      nativeB.registryEntry.registryGeneration !== 1
    ) {
      throw new Error(`compatible Registry generation ${index + 1} lost native-b`);
    }
  }
}

function assertRecursivelyFrozen(value, seen = new Set()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  if (!Object.isFrozen(value)) {
    throw new Error("C09-1L closure retained a mutable object");
  }
  for (const descriptor of Object.values(
    Object.getOwnPropertyDescriptors(value),
  )) {
    if ("value" in descriptor) assertRecursivelyFrozen(descriptor.value, seen);
  }
}

function assertClosureIdentityRetention(closure) {
  const expectedKeys = [
    "authority",
    "candidateRegistryEntry",
    "candidateRegistryEntryContentDigest",
    "providerFeasibilityEvidence",
    "providerFeasibilityEvidencePin",
    "qaApproverPublicKey",
    "registryManifestHistoryClosure",
    "relativePath",
    "releaseApproverPublicKey",
    "runtimeAttestationPointClosure",
  ];
  if (
    Object.getPrototypeOf(closure) !== null ||
    !Object.isFrozen(closure) ||
    JSON.stringify(Object.keys(closure).sort()) !== JSON.stringify(expectedKeys)
  ) {
    throw new Error("C09-1L success closure is not the exact ten-field record");
  }
  const historyClosure = closure.registryManifestHistoryClosure;
  const tip = historyClosure.registryManifestHistory.at(-1);
  const member = tip?.payload.members.find(
    ({ providerId }) => providerId === NATIVE_B_PROVIDER_ID,
  );
  if (
    member?.disposition !== "enabled" ||
    closure.candidateRegistryEntry !== member.registryEntry ||
    closure.candidateRegistryEntryContentDigest !==
      member.registryEntryContentDigest ||
    closure.runtimeAttestationPointClosure.runtimeAttestation !==
      member.registryEntry.runtimeAttestation ||
    !member.registryEntry.feasibilityApprovalKeys.publicKeyRecords.includes(
      closure.qaApproverPublicKey,
    ) ||
    !member.registryEntry.feasibilityApprovalKeys.publicKeyRecords.includes(
      closure.releaseApproverPublicKey,
    )
  ) {
    throw new Error("C09-1L success closure lost detached Registry identities");
  }
  assertRecursivelyFrozen(closure);
}

const [rootDependency, registryDependency, sourceDependency] =
  await Promise.all([
    readAnchoredDependency({
      resourcePath: PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_PATH_V1,
      resourceByteLength:
        PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
      resourceSha256Hex:
        PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_SHA256_HEX_V1,
      semanticDomain:
        PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_SEMANTIC_DOMAIN_V1,
      semanticContentDigest:
        PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
    }),
    readAnchoredDependency({
      resourcePath: PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_PATH_V1,
      resourceByteLength:
        PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
      resourceSha256Hex:
        PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_SHA256_HEX_V1,
      semanticDomain:
        PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_SEMANTIC_DOMAIN_V1,
      semanticContentDigest:
        PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
    }),
    readAnchoredDependency({
      resourcePath: PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_RESOURCE_PATH_V1,
      resourceByteLength:
        PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
      resourceSha256Hex:
        PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_RESOURCE_SHA256_HEX_V1,
      semanticDomain:
        PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_SEMANTIC_DOMAIN_V1,
      semanticContentDigest:
        PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
      embeddedSemanticDigest: true,
    }),
  ]);

const fixture = buildCompatibleBaseFixture({
  rootGolden: rootDependency.value,
  registryGolden: registryDependency.value,
  sourceGolden: sourceDependency.value,
});
assertReanchoredRegistryTopology(
  registryDependency.value,
  fixture.registryManifestHistory,
);

const strictManifestBytes = new Uint8Array(await readFile(strictManifestPath));
let pointCalls = 0;
let signatureCalls = 0;
const capability = await attestProviderStrictEd25519CryptoHostV1({
  host: Object.freeze({
    verificationProfile: STRICT_ED25519_VERIFICATION_PROFILE_V1,
    validatePrimeSubgroupPoint(point) {
      pointCalls += 1;
      return validatePrimeSubgroupPoint(point);
    },
    async verifyRawEd25519(publicKey, message, signature) {
      signatureCalls += 1;
      return verifyRawEd25519(publicKey, message, signature);
    },
  }),
  resourceHost: Object.freeze({
    readFixedSignedPackageResource(resourcePath, maxBytes) {
      if (
        resourcePath !== PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1 ||
        maxBytes !== PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1
      ) {
        throw new Error("unexpected strict Ed25519 manifest request");
      }
      return strictManifestBytes;
    },
  }),
});

pointCalls = 0;
signatureCalls = 0;
const registryDiagnostic =
  await diagnoseProviderRegistryManifestHistoryInternalV1({
    installationIdentityGenerationId:
      fixture.compatibleBase.installationIdentityGenerationId,
    bootstrapTrustBundle: jsonClone(
      fixture.compatibleBase.bootstrapTrustBundle,
    ),
    rootMetadataHistory: jsonClone(
      fixture.compatibleBase.rootMetadataHistory,
    ),
    registryManifestHistory: jsonClone(
      fixture.compatibleBase.registryManifestHistory,
    ),
    strictCryptoCapability: capability,
  });
if (!registryDiagnostic.ok) {
  throw new Error(
    `compatible Registry rejected: ${registryDiagnostic.stage}/${registryDiagnostic.reason}`,
  );
}
const registryCryptoClosure = {
  pointAdmissionCount: pointCalls,
  signatureVerificationCount: signatureCalls,
};
if (
  registryCryptoClosure.pointAdmissionCount !== 24 ||
  registryCryptoClosure.signatureVerificationCount !== 38
) {
  throw new Error(
    `compatible Registry crypto drifted: ${pointCalls}/${signatureCalls}`,
  );
}

pointCalls = 0;
signatureCalls = 0;
const bindingDiagnostic =
  await diagnoseProviderRegistryEvidenceBindingPointClosureV1(
    requestFromCompatibleBase(fixture.compatibleBase, capability),
  );
if (!bindingDiagnostic.ok) {
  throw new Error(
    `compatible C09-1L rejected: ${bindingDiagnostic.stage}/${bindingDiagnostic.reason}`,
  );
}
const completeCryptoClosure = {
  pointAdmissionCount: pointCalls,
  signatureVerificationCount: signatureCalls,
};
if (
  completeCryptoClosure.pointAdmissionCount !== 24 ||
  completeCryptoClosure.signatureVerificationCount !== 46
) {
  throw new Error(
    `compatible C09-1L crypto drifted: ${pointCalls}/${signatureCalls}`,
  );
}
const closure = bindingDiagnostic.value;
if (
  closure.authority !==
    "none_registry_entry_evidence_binding_structure_only" ||
  closure.relativePath !==
    expectedEvidenceRelativePath(
      fixture.compatibleBase.providerFeasibilityEvidencePin,
    )
) {
  throw new Error("compatible C09-1L success projection drifted");
}
assertClosureIdentityRetention(closure);
const successProjection = projectSuccessfulClosure(closure);
if (Object.keys(successProjection).length !== 10) {
  throw new Error("C09-1L projection must have exactly ten fields");
}

const manifestGenerationDigests = fixture.registryManifestHistory.map(
  (envelope) => ({
    manifestGeneration: envelope.payload.manifestGeneration,
    generationId: envelope.generationId,
    contentDigest: envelope.contentDigest,
    predecessor: envelope.payload.predecessor,
  }),
);
const goldenWithoutDigest = {
  schemaVersion: 1,
  profile: "provider_registry_evidence_binding_point_golden_v1",
  fixtureAuthority:
    "none_registry_entry_evidence_binding_structure_only",
  canonicalizationProfile: "rfc8785-jcs-safe-integer-v1",
  verificationProfile:
    "ed25519-rfc8032-cofactorless-prime-subgroup-v1",
  deterministicSeeds: {
    purpose: "non_production_fixture_only",
    root3SeedHex: ROOT_3_SEED_HEX,
    qaApproverSeedHex: QA_APPROVER_SEED_HEX,
    releaseApproverSeedHex: RELEASE_APPROVER_SEED_HEX,
  },
  compatibleBase: fixture.compatibleBase,
  expected: {
    providerId: NATIVE_B_PROVIDER_ID,
    registryManifestCount: 7,
    rootMetadataCount: 3,
    registryCryptoClosure,
    completeCryptoClosure,
    candidateRegistryEntryContentDigest:
      fixture.nativeBEntry.contentDigest,
    providerFeasibilityEvidenceId:
      fixture.evidence.envelope.evidenceId,
    providerFeasibilityEvidenceContentDigest:
      fixture.evidence.envelope.contentDigest,
    qaApproverKeyId: fixture.qaApproverPublicKey.keyId,
    releaseApproverKeyId: fixture.releaseApproverPublicKey.keyId,
    evidenceQaSignatureMessageUtf8Hex:
      Buffer.from(fixture.evidence.qaMessage).toString("hex"),
    evidenceReleaseSignatureMessageUtf8Hex:
      Buffer.from(fixture.evidence.releaseMessage).toString("hex"),
    nativeBEntrySignatureMessageUtf8Hex:
      Buffer.from(fixture.nativeBEntry.signatureMessage).toString("hex"),
    manifestGenerationDigests,
    successProjection,
  },
  semanticDomain: GOLDEN_SEMANTIC_DOMAIN,
  dependencies: {
    registryGolden: dependencyAnchor(
      PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_PATH_V1,
      PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
      PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_SHA256_HEX_V1,
      PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
    ),
    rootGolden: dependencyAnchor(
      PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_PATH_V1,
      PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
      PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_SHA256_HEX_V1,
      PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
    ),
    sourceGolden: dependencyAnchor(
      PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_RESOURCE_PATH_V1,
      PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
      PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_RESOURCE_SHA256_HEX_V1,
      PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
    ),
  },
};
const golden = {
  ...goldenWithoutDigest,
  semanticContentDigest: semanticDigest(
    GOLDEN_SEMANTIC_DOMAIN,
    goldenWithoutDigest,
  ),
};
const goldenBytes = prettyBytes(golden);
const anchors = {
  resourcePath: GOLDEN_RESOURCE_PATH,
  resourceByteLength: goldenBytes.byteLength,
  resourceSha256Hex: sha256Hex(goldenBytes),
  semanticContentDigest: golden.semanticContentDigest,
};

const INVALID_PROFILE =
  "provider_registry_evidence_binding_point_invalid_v1";
const INVALID_SEMANTIC_DOMAIN =
  "provider-registry-evidence-binding-point-invalid-manifest-v1";
const INVALID_MATERIALIZED_REQUEST_DOMAIN =
  "provider-registry-evidence-binding-point-invalid-materialized-request-v1";
const INVALID_AGGREGATE_DOMAIN =
  "provider-registry-evidence-binding-point-invalid-aggregate-v1";
const INVALID_SHARD_CASE_IDS_DOMAIN =
  "provider-registry-evidence-binding-point-invalid-shard-case-ids-v1";
const INVALID_SHARD_OUTCOMES_DOMAIN =
  "provider-registry-evidence-binding-point-invalid-shard-outcomes-v1";
const INVALID_SHARD_CRYPTO_DOMAIN =
  "provider-registry-evidence-binding-point-invalid-shard-crypto-v1";
const INVALID_RECIPE_DIALECT =
  "provider_registry_evidence_binding_point_invalid_recipe_v1";
const INVALID_SHARD_SIZE = 32;
const INVALID_MAX_WORKERS = 4;
const INVALID_MAX_BYTES = 16_777_216;
const POINT_SPECIFIC_DEFINITIONS = Object.freeze([
  ["point-positive-genesis-entry-passed", "positive_genesis_entry_passed"],
  [
    "point-positive-historical-unrevoked-approver",
    "positive_historical_unrevoked_approver",
  ],
  [
    "point-positive-runtime-evidence-entry-successor",
    "positive_runtime_evidence_entry_successor",
  ],
  ["point-bootstrap-bundle-pin-mismatch", "bootstrap_bundle_pin_mismatch"],
  [
    "point-bootstrap-bundle-schema-invalid",
    "bootstrap_bundle_schema_invalid",
  ],
  [
    "point-candidate-root-record-mismatch",
    "candidate_root_record_mismatch",
  ],
  ["point-candidate-identity-mismatch", "candidate_identity_mismatch"],
  ["point-routing-migration-tip", "routing_migration_tip"],
  ["point-provider-absent", "provider_absent"],
  ["point-provider-tombstone", "provider_tombstone"],
  [
    "point-entry-evidence-pin-substitution",
    "entry_evidence_pin_substitution",
  ],
  [
    "point-entry-runtime-pin-substitution",
    "entry_runtime_pin_substitution",
  ],
  [
    "point-entry-policy-digest-substitution",
    "entry_policy_digest_substitution",
  ],
  [
    "point-entry-successor-stale-evidence-pin",
    "entry_successor_stale_evidence_pin",
  ],
  [
    "point-valid-resign-result-cross-mismatch",
    "valid_resign_result_cross_mismatch",
  ],
  ["point-failed-production-result", "failed_production_result"],
  ["point-unsupported-production-result", "unsupported_production_result"],
  ["point-qa-unknown-signer", "qa_unknown_signer"],
  ["point-release-unknown-signer", "release_unknown_signer"],
  [
    "point-qa-revoked-historical-signer",
    "qa_revoked_historical_signer",
  ],
  [
    "point-release-revoked-historical-signer",
    "release_revoked_historical_signer",
  ],
  ["point-qa-wrong-role-signer", "qa_wrong_role_signer"],
  ["point-release-wrong-role-signer", "release_wrong_role_signer"],
  ["point-hostile-top-level-proxy", "hostile_top_level_proxy"],
  ["point-cross-history-alias", "cross_history_alias"],
  [
    "point-after-start-evidence-mutation",
    "after_start_evidence_mutation",
  ],
  [
    "point-after-start-history-mutation",
    "after_start_history_mutation",
  ],
  ["point-promise-poison", "promise_poison"],
  ["point-budget-value-b", "budget_value_b"],
  ["point-budget-value-b-plus-one", "budget_value_b_plus_one"],
  ["point-budget-key-b", "budget_key_b"],
  ["point-budget-key-b-plus-one", "budget_key_b_plus_one"],
  ["point-budget-history-bh", "budget_history_bh"],
  ["point-budget-history-bh-plus-one", "budget_history_bh_plus_one"],
  ["point-budget-identities-c", "budget_identities_c"],
  ["point-budget-identities-c-plus-one", "budget_identities_c_plus_one"],
  ["point-budget-work-w", "budget_work_w"],
  ["point-budget-work-w-plus-one", "budget_work_w_plus_one"],
]);
const BINDING_POINT_STAGES = Object.freeze([
  "input",
  "bootstrap_distribution_binding",
  "evidence_structure",
  "evidence_pin_structure",
  "registry_history_closure",
  "candidate_root_binding",
  "candidate_member_resolution",
  "registry_evidence_pin_binding",
  "registry_runtime_binding",
  "runtime_attestation_closure",
  "registry_policy_binding",
  "evidence_result_binding",
  "production_result_gate",
  "evidence_policy_binding",
  "evidence_runtime_binding",
  "evidence_time",
  "evidence_id",
  "evidence_qa_signature_binding",
  "evidence_release_signature_binding",
  "qa_approver_resolution",
  "release_approver_resolution",
  "evidence_qa_signature",
  "evidence_release_signature",
  "evidence_digest",
  "evidence_envelope",
  "evidence_pin",
]);

function fullSourceAnchor(
  resourcePath,
  resourceByteLength,
  resourceSha256Hex,
  semanticDomain,
  semanticContentDigest,
) {
  return {
    resourcePath,
    resourceByteLength,
    resourceSha256Hex,
    semanticDomain,
    semanticContentDigest,
  };
}

const bindingGoldenAnchor = fullSourceAnchor(
  GOLDEN_RESOURCE_PATH,
  goldenBytes.byteLength,
  sha256Hex(goldenBytes),
  GOLDEN_SEMANTIC_DOMAIN,
  golden.semanticContentDigest,
);
const evidenceInvalidAnchor = fullSourceAnchor(
  PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_RESOURCE_PATH_V1,
  PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_RESOURCE_SHA256_HEX_V1,
  PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_SEMANTIC_DOMAIN_V1,
  PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_SEMANTIC_CONTENT_DIGEST_V1,
);
const registryInvalidAnchor = fullSourceAnchor(
  PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_RESOURCE_PATH_V1,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_RESOURCE_SHA256_HEX_V1,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_SEMANTIC_DOMAIN_V1,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_SEMANTIC_CONTENT_DIGEST_V1,
);

function jsonBytesEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function requestPatch(baseRequest, materializedRequest) {
  if (
    materializedRequest === null ||
    typeof materializedRequest !== "object" ||
    Array.isArray(materializedRequest) ||
    Object.getOwnPropertySymbols(materializedRequest).length !== 0
  ) {
    throw new TypeError("request patch source is not a plain data request");
  }
  const descriptors = Object.getOwnPropertyDescriptors(materializedRequest);
  const setFields = {};
  const deleteFields = [];
  const baseKeys = Object.keys(baseRequest).filter(
    (key) => key !== "strictCryptoCapability",
  );
  const targetKeys = Object.keys(descriptors).filter(
    (key) => key !== "strictCryptoCapability",
  );
  for (const key of baseKeys) {
    if (!Object.hasOwn(descriptors, key)) deleteFields.push(key);
  }
  for (const key of targetKeys) {
    const descriptor = descriptors[key];
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      throw new TypeError(`request patch field ${key} is not enumerable data`);
    }
    if (
      !Object.hasOwn(baseRequest, key) ||
      !jsonBytesEqual(baseRequest[key], descriptor.value)
    ) {
      setFields[key] = jsonClone(descriptor.value);
    }
  }
  return {
    kind: "request_patch",
    setFields,
    deleteFields,
  };
}

function executionWitness(profile) {
  return {
    kind: "execution_profile",
    profile,
    setFields: {},
    deleteFields: [],
  };
}

function symbolicBudgetWitness(budget, relation) {
  return {
    kind: "symbolic_budget",
    budget,
    relation,
    witness: "runtime_compact_production_counter_v1",
  };
}

function withAcceptedTopologyRationale(expected, rationale) {
  return expected.kind === "accepted_snapshot"
    ? { ...expected, topologyRationale: rationale }
    : expected;
}

function pointTopologyRationale(caseId, pointCount, signatureCount) {
  if (caseId === "point-positive-historical-unrevoked-approver") {
    return "Historical unrevoked approver topology adds a successor Entry/Manifest and two approver-history admissions, fixing the dynamic closure at 26/50.";
  }
  if (caseId === "point-positive-runtime-evidence-entry-successor") {
    return "Runtime + Evidence + Entry successor topology adds one valid Entry/Manifest successor, retaining 24 point admissions and fixing 49 signature verifications.";
  }
  if (caseId === "point-positive-genesis-entry-passed") {
    return "Genesis Entry + passed Evidence uses the seven-manifest, three-root compatible base and fixes the complete closure at 24/46.";
  }
  return `Snapshot-stability witness retains its prepared topology and exact dynamic crypto closure ${pointCount}/${signatureCount}.`;
}

function classifyPointBudget(profile) {
  if (!profile.startsWith("budget_")) return undefined;
  const relation = profile.endsWith("_plus_one") ? "plus_one" : "equal";
  if (profile.startsWith("budget_value_")) return ["value_b", relation];
  if (profile.startsWith("budget_key_")) return ["key_b", relation];
  if (profile.startsWith("budget_history_")) return ["history_bh", relation];
  if (profile.startsWith("budget_identities_")) {
    return ["identities_c", relation];
  }
  if (profile.startsWith("budget_work_")) return ["work_w", relation];
  throw new TypeError(`unknown point budget profile ${profile}`);
}

function assertActualMatchesExpected(caseId, diagnostic, expected) {
  if (expected.kind === "accepted_snapshot") {
    if (
      !diagnostic.ok ||
      pointCalls !== expected.pointAdmissionCount ||
      signatureCalls !== expected.signatureVerificationCount ||
      !jsonBytesEqual(projectSuccessfulClosure(diagnostic.value), expected.snapshotProjection)
    ) {
      throw new Error(
        `${caseId} accepted replay drifted: ${JSON.stringify({
          diagnostic,
          pointCalls,
          signatureCalls,
          expected,
        })}`,
      );
    }
    assertClosureIdentityRetention(diagnostic.value);
    return;
  }
  if (
    diagnostic.ok ||
    diagnostic.stage !== expected.stage ||
    diagnostic.reason !== expected.reason ||
    pointCalls !== expected.pointAdmissionCount ||
    signatureCalls !== expected.signatureVerificationCount
  ) {
    throw new Error(
      `${caseId} diagnostic replay drifted: ${JSON.stringify({
        diagnostic,
        pointCalls,
        signatureCalls,
        expected,
      })}`,
    );
  }
}

async function executeSymbolicBudgetWitness(caseId, budget, relation) {
  const witnessRecipe = symbolicBudgetWitness(budget, relation);
  const prepared =
    materializeProviderRegistryEvidenceBindingBudgetWitnessInternalV1(
      requestFromCompatibleBase(fixture.compatibleBase, capability),
      witnessRecipe,
    );
  pointCalls = 0;
  signatureCalls = 0;
  let diagnostic;
  try {
    diagnostic = await diagnoseProviderRegistryEvidenceBindingPointClosureV1(
      prepared.request,
    );
  } catch (error) {
    discardProviderRegistryEvidenceBindingBudgetWitnessInternalV1(
      prepared.request,
    );
    throw error;
  }
  takeAndVerifyProviderRegistryEvidenceBindingBudgetReplayInternalV1(
    prepared.request,
    witnessRecipe,
  );
  if (prepared.getterCalls() !== 0) {
    throw new Error(`${caseId} compact budget replay executed an attacker getter`);
  }

  const materializedRequestSemanticDigest = semanticDigest(
    INVALID_MATERIALIZED_REQUEST_DOMAIN,
    { caseId, witnessRecipe },
  );
  const shouldAccept =
    relation === "equal" &&
    (budget === "identities_c" || budget === "work_w");
  if (shouldAccept) {
    if (
      !diagnostic.ok ||
      pointCalls !== completeCryptoClosure.pointAdmissionCount ||
      signatureCalls !== completeCryptoClosure.signatureVerificationCount
    ) {
      throw new Error(
        `${caseId} equal-cap replay did not retain the complete 24/46 closure`,
      );
    }
    assertClosureIdentityRetention(diagnostic.value);
    return {
      witnessRecipe,
      outerExpected: {
        kind: "accepted_snapshot",
        boundary: "snapshot_stability",
        outcome: "accepted_frozen_snapshot",
        authority: diagnostic.value.authority,
        snapshotProjection: projectSuccessfulClosure(diagnostic.value),
        pointAdmissionCount: pointCalls,
        signatureVerificationCount: signatureCalls,
        materializedRequestSemanticDigest,
        topologyRationale: pointTopologyRationale(
          caseId,
          pointCalls,
          signatureCalls,
        ),
      },
    };
  }
  if (
    diagnostic.ok ||
    diagnostic.stage !== "input" ||
    diagnostic.reason !== "schema_invalid" ||
    pointCalls !== 0 ||
    signatureCalls !== 0
  ) {
    throw new Error(
      `${caseId} compact budget replay did not reject at input/schema_invalid 0/0`,
    );
  }
  return {
    witnessRecipe,
    outerExpected: {
      kind: "diagnostic",
      stage: diagnostic.stage,
      reason: diagnostic.reason,
      pointAdmissionCount: pointCalls,
      signatureVerificationCount: signatureCalls,
      materializedRequestSemanticDigest,
    },
  };
}

const [evidenceGoldenBytes, evidenceInvalidBytes, registryInvalidBytes] =
  await Promise.all([
    readFile(
      join(
        packageRoot,
        ...PROVIDER_FEASIBILITY_EVIDENCE_POINT_GOLDEN_RESOURCE_PATH_V1.split(
          "/",
        ),
      ),
    ),
    readFile(
      join(
        packageRoot,
        ...PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_RESOURCE_PATH_V1.split(
          "/",
        ),
      ),
    ),
    readFile(
      join(
        packageRoot,
        ...PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_RESOURCE_PATH_V1.split(
          "/",
        ),
      ),
    ),
  ]);
const evidenceGolden = JSON.parse(evidenceGoldenBytes.toString("utf8"));
const evidenceInvalid =
  verifyProviderRegistryEvidenceBindingEvidenceAdapterSourceV1(
    evidenceInvalidBytes,
  );
const registryInvalid =
  verifyProviderRegistryEvidenceBindingRegistryAdapterSourceV1(
    registryInvalidBytes,
  );
const adapterContext =
  buildProviderRegistryEvidenceBindingEvidenceAdapterContextV1({
    compatibleBase: fixture.compatibleBase,
    sourceGolden: evidenceGolden,
    compatibleBaseSemanticContentDigest: golden.semanticContentDigest,
  });
const baseRequestForPatch = requestFromCompatibleBase(
  fixture.compatibleBase,
  capability,
);
const combinedCases = [];

if (
  deriveProviderRegistryEvidenceBindingEvidenceAdapterTableDigestV1(
    PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_EVIDENCE_ADAPTER_DEFINITIONS_V1,
  ) !==
  PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_EVIDENCE_ADAPTER_TABLE_SEMANTIC_CONTENT_DIGEST_V1
) {
  throw new Error("Evidence adapter table anchor drifted during combined generation");
}

for (
  let index = 0;
  index <
  PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_EVIDENCE_ADAPTER_DEFINITIONS_V1.length;
  index += 1
) {
  const definition =
    PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_EVIDENCE_ADAPTER_DEFINITIONS_V1[
      index
    ];
  const materialized =
    materializeProviderRegistryEvidenceBindingEvidenceAdapterCaseV1({
      adapterDefinition: definition,
      context: adapterContext,
      strictCryptoCapability: capability,
    });
  const observedDigest =
    deriveProviderRegistryEvidenceBindingEvidenceAdapterMaterializedRequestDigestV1(
      materialized,
    );
  if (
    observedDigest !==
    definition.outerExpected.materializedRequestSemanticDigest
  ) {
    throw new Error(`${definition.caseId} materialized Evidence digest drifted`);
  }
  pointCalls = 0;
  signatureCalls = 0;
  const pending = diagnoseProviderRegistryEvidenceBindingPointClosureV1(
    materialized.request,
  );
  materialized.mutateAfterStart?.();
  const diagnostic = await pending;
  if (materialized.getterCalls() !== 0) {
    throw new Error(`${definition.caseId} executed an attacker getter`);
  }
  assertActualMatchesExpected(
    definition.caseId,
    diagnostic,
    definition.outerExpected,
  );
  const witnessRecipe =
    index === 38
      ? executionWitness(materialized.executionProfile ?? definition.sourceOperation)
      : materialized.executionProfile === undefined
        ? requestPatch(baseRequestForPatch, materialized.request)
        : executionWitness(materialized.executionProfile);
  if (
    witnessRecipe.kind === "symbolic_budget" &&
    (definition.outerExpected.kind !== "diagnostic" ||
      definition.outerExpected.stage !== "input" ||
      definition.outerExpected.pointAdmissionCount !== 0 ||
      definition.outerExpected.signatureVerificationCount !== 0)
  ) {
    throw new Error(`${definition.caseId} symbolic witness is not input/0/0`);
  }
  combinedCases.push({
    sourceResource: definition.sourceResource,
    sourceIndex: definition.sourceIndex,
    sourceCaseId: definition.sourceCaseId,
    sourceOperation: definition.sourceOperation,
    sourceExpected: definition.sourceExpected,
    caseId: definition.caseId,
    group: "provider_feasibility_evidence_point",
    mutation: {
      dialect: INVALID_RECIPE_DIALECT,
      operation: definition.caseId,
      sourceRecipe: definition.mutation.recipe,
      witnessRecipe,
    },
    outerExpected: withAcceptedTopologyRationale(
      definition.outerExpected,
      pointTopologyRationale(
        definition.caseId,
        definition.outerExpected.pointAdmissionCount,
        definition.outerExpected.signatureVerificationCount,
      ),
    ),
  });
}

const finalizedRegistryRows = [];
for (
  let index = 0;
  index <
  PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_REGISTRY_ADAPTER_DEFINITIONS_V1.length;
  index += 1
) {
  const definition =
    PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_REGISTRY_ADAPTER_DEFINITIONS_V1[
      index
    ];
  const materialized =
    materializeProviderRegistryEvidenceBindingRegistryAdapterCaseV1({
      adapterDefinition: definition,
      source: registryInvalid,
      registryGolden: registryDependency.value,
      compatibleBase: fixture.compatibleBase,
      strictCryptoCapability: capability,
    });
  const digest =
    deriveProviderRegistryEvidenceBindingRegistryAdapterMaterializedRequestDigestV1(
      materialized.request,
    );
  const finalized =
    finalizeProviderRegistryEvidenceBindingRegistryAdapterRowV1(
      definition,
      materialized.sourceCase,
      digest,
    );
  finalizedRegistryRows.push(finalized);
  pointCalls = 0;
  signatureCalls = 0;
  const diagnostic =
    await diagnoseProviderRegistryEvidenceBindingPointClosureV1(
      materialized.request,
    );
  assertActualMatchesExpected(
    finalized.caseId,
    diagnostic,
    finalized.outerExpected,
  );
  let witnessRecipe;
  let outerExpected = finalized.outerExpected;
  if (index === 79) {
    const replay = await executeSymbolicBudgetWitness(
      finalized.caseId,
      "history_count",
      "plus_one",
    );
    witnessRecipe = replay.witnessRecipe;
    outerExpected = replay.outerExpected;
  } else if (index === 80) {
    const replay = await executeSymbolicBudgetWitness(
      finalized.caseId,
      "value_b",
      "plus_one",
    );
    witnessRecipe = replay.witnessRecipe;
    outerExpected = replay.outerExpected;
  } else if (index === 81) {
    const replay = await executeSymbolicBudgetWitness(
      finalized.caseId,
      "history_bh",
      "plus_one",
    );
    witnessRecipe = replay.witnessRecipe;
    outerExpected = replay.outerExpected;
  } else if (index === 5) {
    witnessRecipe = executionWitness("registry-history-sparse-array");
  } else {
    witnessRecipe = requestPatch(baseRequestForPatch, materialized.request);
  }
  if (
    witnessRecipe.kind === "symbolic_budget" &&
    (finalized.outerExpected.stage !== "input" ||
      finalized.outerExpected.pointAdmissionCount !== 0 ||
      finalized.outerExpected.signatureVerificationCount !== 0)
  ) {
    throw new Error(`${finalized.caseId} symbolic witness is not input/0/0`);
  }
  combinedCases.push({
    sourceResource: finalized.sourceResource,
    sourceIndex: finalized.sourceIndex,
    sourceCaseId: finalized.sourceCaseId,
    sourceOperation: finalized.sourceOperation,
    sourceExpected: finalized.sourceExpected,
    caseId: finalized.caseId,
    group: "provider_registry_manifest_history",
    mutation: {
      dialect: INVALID_RECIPE_DIALECT,
      operation: finalized.caseId,
      sourceRecipe: finalized.mutation.recipe,
      witnessRecipe,
    },
    outerExpected,
  });
}

if (
  deriveProviderRegistryEvidenceBindingRegistryAdapterTableDigestV1(
    finalizedRegistryRows,
  ) !==
  PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_REGISTRY_ADAPTER_TABLE_SEMANTIC_CONTENT_DIGEST_V1
) {
  throw new Error("Registry adapter table anchor drifted during combined generation");
}

const pointSourceExpectedDigest = semanticDigest(
  INVALID_MATERIALIZED_REQUEST_DOMAIN,
  {
    profile: "point_specific_source_golden_v1",
    goldenSemanticContentDigest: golden.semanticContentDigest,
  },
);
const pointSourceExpected = {
  kind: "accepted_snapshot",
  boundary: "snapshot_stability",
  outcome: "accepted_frozen_snapshot",
  authority: golden.fixtureAuthority,
  snapshotProjection: golden.expected.successProjection,
  pointAdmissionCount: golden.expected.completeCryptoClosure.pointAdmissionCount,
  signatureVerificationCount:
    golden.expected.completeCryptoClosure.signatureVerificationCount,
  materializedRequestSemanticDigest: pointSourceExpectedDigest,
};

for (let index = 0; index < POINT_SPECIFIC_DEFINITIONS.length; index += 1) {
  const [caseId, profile] = POINT_SPECIFIC_DEFINITIONS[index];
  const budget = classifyPointBudget(profile);
  let witnessRecipe;
  let sourceRecipe;
  let outerExpected;
  if (budget !== undefined) {
    const replay = await executeSymbolicBudgetWitness(
      caseId,
      budget[0],
      budget[1],
    );
    witnessRecipe = replay.witnessRecipe;
    sourceRecipe = { kind: "point_symbolic_budget", profile };
    outerExpected = replay.outerExpected;
  } else {
    let materialized;
    if (profile === "failed_production_result") {
      materialized =
        materializeProviderRegistryEvidenceBindingEvidenceAdapterProductionResultVariantV1(
          {
            context: adapterContext,
            result: "failed",
            strictCryptoCapability: capability,
          },
        );
    } else if (profile === "unsupported_production_result") {
      materialized =
        materializeProviderRegistryEvidenceBindingEvidenceAdapterProductionResultVariantV1(
          {
            context: adapterContext,
            result: "unsupported",
            strictCryptoCapability: capability,
          },
        );
    } else {
      materialized =
        materializeProviderRegistryEvidenceBindingPointSpecificVariantForGeneratorV1(
          {
            context: adapterContext,
            profile,
            strictCryptoCapability: capability,
          },
        );
    }
    const executionProfiles = new Set([
      "hostile_top_level_proxy",
      "cross_history_alias",
      "after_start_evidence_mutation",
      "after_start_history_mutation",
      "promise_poison",
    ]);
    witnessRecipe = executionProfiles.has(profile)
      ? executionWitness(profile)
      : requestPatch(baseRequestForPatch, materialized.request);
    sourceRecipe = { kind: "point_specific", profile };
    pointCalls = 0;
    signatureCalls = 0;
    const pending = diagnoseProviderRegistryEvidenceBindingPointClosureV1(
      materialized.request,
    );
    materialized.mutateAfterStart?.();
    const diagnostic = await pending;
    const materializedRequestSemanticDigest = semanticDigest(
      INVALID_MATERIALIZED_REQUEST_DOMAIN,
      { caseId, witnessRecipe },
    );
    if (diagnostic.ok) {
      assertClosureIdentityRetention(diagnostic.value);
      outerExpected = {
        kind: "accepted_snapshot",
        boundary: "snapshot_stability",
        outcome: "accepted_frozen_snapshot",
        authority: diagnostic.value.authority,
        snapshotProjection: projectSuccessfulClosure(diagnostic.value),
        pointAdmissionCount: pointCalls,
        signatureVerificationCount: signatureCalls,
        materializedRequestSemanticDigest,
        topologyRationale: pointTopologyRationale(
          caseId,
          pointCalls,
          signatureCalls,
        ),
      };
    } else {
      outerExpected = {
        kind: "diagnostic",
        stage: diagnostic.stage,
        reason: diagnostic.reason,
        pointAdmissionCount: pointCalls,
        signatureVerificationCount: signatureCalls,
        materializedRequestSemanticDigest,
      };
    }
  }
  combinedCases.push({
    sourceResource: bindingGoldenAnchor,
    sourceIndex: index,
    sourceCaseId: caseId,
    sourceOperation: profile,
    sourceExpected: pointSourceExpected,
    caseId,
    group: "provider_registry_evidence_binding_point",
    mutation: {
      dialect: INVALID_RECIPE_DIALECT,
      operation: caseId,
      sourceRecipe,
      witnessRecipe,
    },
    outerExpected,
  });
}

const expectedCaseIds = [
  ...PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_EVIDENCE_ADAPTER_DEFINITIONS_V1.map(
    ({ caseId }) => caseId,
  ),
  ...finalizedRegistryRows.map(({ caseId }) => caseId),
  ...POINT_SPECIFIC_DEFINITIONS.map(([caseId]) => caseId),
];
if (
  combinedCases.length !== expectedCaseIds.length ||
  combinedCases.some(
    ({ caseId, mutation }, index) =>
      caseId !== expectedCaseIds[index] || mutation.operation !== caseId,
  ) ||
  new Set(expectedCaseIds).size !== expectedCaseIds.length
) {
  throw new Error("combined invalid inventory is not an exact ordered cover");
}

const successWitnessCaseId = "point-positive-genesis-entry-passed";
const stageCoverage = BINDING_POINT_STAGES.map((stage) => {
  const rejectionCaseIds = combinedCases
    .filter(
      ({ outerExpected }) =>
        outerExpected.kind === "diagnostic" && outerExpected.stage === stage,
    )
    .map(({ caseId }) => caseId);
  const reachableRejection = rejectionCaseIds.length > 0;
  const unreachableRejections =
    stage === "candidate_root_binding"
      ? [
          {
            reason: "identity_mismatch",
            rationale:
              "Unreachable after registry_history_closure: manifest_envelope binds every retained Manifest identity to the same parsed input identity, registry_entry binds every enabled Entry identity to its Manifest, and the returned closure identity is that same parsed input.",
          },
        ]
      : stage === "registry_policy_binding"
        ? [
            {
              reason: "binding_mismatch",
              rationale:
                "Unreachable after registry_history_closure binds the Entry policy digest to its signed Runtime pin and runtime_attestation_closure binds that Runtime pin to the supplied full semantic policy.",
            },
          ]
        : [];
  return {
    stage,
    traversedBySuccess: true,
    successWitnessCaseId,
    reachableRejection,
    rejectionCaseIds,
    unreachableRejections,
    reachabilityRationale:
      stage === "registry_policy_binding"
        ? "Traversed by every accepted closure; an isolated rejection is unreachable because registry_history_closure fixes the Entry policy binding and runtime_attestation_closure fixes the full Runtime policy digest before this comparison."
        : reachableRejection
          ? "At least one explicit case reaches and rejects at this stage; the accepted witness also traverses it."
          : "The accepted witness traverses this defensive stage; no independent rejection is reachable under the preceding validated closures.",
  };
});

const shards = [];
for (
  let startCaseIndex = 0;
  startCaseIndex < combinedCases.length;
  startCaseIndex += INVALID_SHARD_SIZE
) {
  const shardIndex = shards.length;
  const endCaseIndexExclusive = Math.min(
    startCaseIndex + INVALID_SHARD_SIZE,
    combinedCases.length,
  );
  const cases = combinedCases.slice(startCaseIndex, endCaseIndexExclusive);
  shards.push({
    shardIndex,
    startCaseIndex,
    endCaseIndexExclusive,
    caseCount: cases.length,
    caseIdsContentDigest: semanticDigest(
      INVALID_SHARD_CASE_IDS_DOMAIN,
      cases.map(({ caseId }) => caseId),
    ),
    expectedOutcomesContentDigest: semanticDigest(
      INVALID_SHARD_OUTCOMES_DOMAIN,
      cases.map(({ outerExpected }) => outerExpected),
    ),
    cryptoCountsContentDigest: semanticDigest(
      INVALID_SHARD_CRYPTO_DOMAIN,
      cases.map(({ caseId, outerExpected }) => ({
        caseId,
        pointAdmissionCount: outerExpected.pointAdmissionCount,
        signatureVerificationCount: outerExpected.signatureVerificationCount,
      })),
    ),
  });
}
const aggregateContentDigest = semanticDigest(INVALID_AGGREGATE_DOMAIN, shards);
const invalidWithoutDigest = {
  schemaVersion: 1,
  profile: INVALID_PROFILE,
  fixtureAuthority: "none_fixture_replay_only",
  canonicalizationProfile: "rfc8785-jcs-safe-integer-v1",
  verificationProfile: "ed25519-rfc8032-cofactorless-prime-subgroup-v1",
  semanticDomain: INVALID_SEMANTIC_DOMAIN,
  materializedRequestSemanticDomain: INVALID_MATERIALIZED_REQUEST_DOMAIN,
  aggregateSemanticDomain: INVALID_AGGREGATE_DOMAIN,
  goldenDependency: bindingGoldenAnchor,
  evidenceInvalidDependency: evidenceInvalidAnchor,
  registryInvalidDependency: registryInvalidAnchor,
  adapterTables: {
    evidenceCaseCount:
      PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_EVIDENCE_ADAPTER_DEFINITIONS_V1.length,
    evidenceSemanticContentDigest:
      PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_EVIDENCE_ADAPTER_TABLE_SEMANTIC_CONTENT_DIGEST_V1,
    registryCaseCount:
      PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_REGISTRY_ADAPTER_DEFINITIONS_V1.length,
    registrySemanticContentDigest:
      PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_REGISTRY_ADAPTER_TABLE_SEMANTIC_CONTENT_DIGEST_V1,
  },
  mutationRecipeDialect: INVALID_RECIPE_DIALECT,
  inheritedEvidenceCaseCount:
    PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_EVIDENCE_ADAPTER_DEFINITIONS_V1.length,
  inheritedRegistryCaseCount:
    PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_REGISTRY_ADAPTER_DEFINITIONS_V1.length,
  pointSpecificCaseCount: POINT_SPECIFIC_DEFINITIONS.length,
  caseCount: combinedCases.length,
  shardSize: INVALID_SHARD_SIZE,
  maxWorkers: INVALID_MAX_WORKERS,
  caseIds: expectedCaseIds,
  cases: combinedCases,
  stageCoverage,
  shards,
  aggregateContentDigest,
};
const invalid = {
  ...invalidWithoutDigest,
  semanticContentDigest: semanticDigest(
    INVALID_SEMANTIC_DOMAIN,
    invalidWithoutDigest,
  ),
};
const invalidBytes = prettyBytes(invalid);
if (invalidBytes.byteLength > INVALID_MAX_BYTES) {
  throw new Error(
    `combined invalid fixture is ${invalidBytes.byteLength} bytes, above ${INVALID_MAX_BYTES}`,
  );
}
const invalidAnchors = {
  resourcePath: INVALID_RESOURCE_PATH,
  resourceByteLength: invalidBytes.byteLength,
  resourceSha256Hex: sha256Hex(invalidBytes),
  semanticContentDigest: invalid.semanticContentDigest,
  aggregateContentDigest,
  caseCount: combinedCases.length,
  shardCount: shards.length,
};

if (process.argv.includes("--anchors")) {
  process.stdout.write(
    `${JSON.stringify({ golden: anchors, invalid: invalidAnchors }, null, 2)}\n`,
  );
  process.exit(0);
}

if (process.argv.includes("--check")) {
  const [currentGolden, currentInvalid] = await Promise.all([
    readFile(goldenPath),
    readFile(invalidPath),
  ]);
  if (!currentGolden.equals(goldenBytes)) {
    throw new Error(
      "provider Registry Entry/Evidence binding golden differs from deterministic generation",
    );
  }
  if (!currentInvalid.equals(invalidBytes)) {
    throw new Error(
      "provider Registry Entry/Evidence binding invalid corpus differs from deterministic generation",
    );
  }
  process.stdout.write(
    `Verified deterministic provider Registry Entry/Evidence binding fixtures: 24/46 golden, ${combinedCases.length} invalid/semantic cases across ${shards.length} shards.\n`,
  );
  process.exit(0);
}

await mkdir(dirname(goldenPath), { recursive: true });
await mkdir(dirname(invalidPath), { recursive: true });
await Promise.all([
  writeFile(goldenPath, goldenBytes),
  writeFile(invalidPath, invalidBytes),
]);
process.stdout.write(
  `Generated provider Registry Entry/Evidence binding fixtures: 24/46 golden, ${combinedCases.length} invalid/semantic cases across ${shards.length} shards.\n`,
);
