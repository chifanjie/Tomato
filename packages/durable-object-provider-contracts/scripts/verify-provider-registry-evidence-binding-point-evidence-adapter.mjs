import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

import {
  canonicalizeJcsSafeIntegerUtf8V1,
} from "../dist/jcs.js";
import {
  diagnoseProviderRegistryEvidenceBindingPointClosureV1,
} from "../dist/provider-registry-evidence-binding-point.js";
import {
  PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_GOLDEN_RESOURCE_PATH_V1,
  materializeProviderRegistryEvidenceBindingPointGoldenRequestV1,
  projectProviderRegistryEvidenceBindingPointClosureSnapshotV1,
  verifyProviderRegistryEvidenceBindingPointGoldenResourceV1,
} from "../dist/provider-registry-evidence-binding-point-fixtures.js";
import {
  PROVIDER_FEASIBILITY_EVIDENCE_POINT_GOLDEN_RESOURCE_PATH_V1,
  PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_RESOURCE_PATH_V1,
  verifyProviderFeasibilityEvidencePointGoldenResourceV1,
  verifyProviderFeasibilityEvidencePointInvalidResourceV1,
} from "../dist/provider-feasibility-evidence-point-fixtures.js";
import {
  diagnoseProviderRegistryManifestHistoryInternalV1,
} from "../dist/provider-registry-manifest-history.js";
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
  PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_EVIDENCE_ADAPTER_DEFINITIONS_V1,
  PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_EVIDENCE_ADAPTER_TABLE_SEMANTIC_CONTENT_DIGEST_V1,
  buildProviderRegistryEvidenceBindingEvidenceAdapterContextV1,
  deriveProviderRegistryEvidenceBindingEvidenceAdapterMaterializedRequestDigestV1,
  deriveProviderRegistryEvidenceBindingEvidenceAdapterTableDigestV1,
  materializeProviderRegistryEvidenceBindingEvidenceAdapterCaseV1,
  materializeProviderRegistryEvidenceBindingEvidenceAdapterProductionResultVariantV1,
  verifyProviderRegistryEvidenceBindingEvidenceAdapterSourceV1,
} from "./lib/provider-registry-evidence-binding-point-evidence-adapter.mjs";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readResource = (relativePath) =>
  readFile(join(packageRoot, ...relativePath.split("/")));
const jsonClone = (value) => JSON.parse(JSON.stringify(value));
const canonicalEqual = (left, right) =>
  Buffer.from(canonicalizeJcsSafeIntegerUtf8V1(left)).equals(
    Buffer.from(canonicalizeJcsSafeIntegerUtf8V1(right)),
  );

const EXPECTED_CLOSURE_FIELDS_V1 = Object.freeze([
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
]);
const EXPECTED_ACCEPTED_SOURCE_INDEXES_V1 = Object.freeze([
  49,
  121,
  223,
  224,
  225,
  226,
]);
const EXPECTED_RECIPE_KIND_COUNTS_V1 = Object.freeze({
  evidence_direct: 19,
  evidence_direct_registry_reanchor: 4,
  evidence_signature_reanchor: 6,
  evidence_unsigned_reanchor: 26,
  point_hostile: 17,
  registry_approver_history: 33,
  runtime_inherited: 122,
});
const EXPECTED_STAGE_PAIR_COUNTS_V1 = Object.freeze({
  "accepted -> accepted": 6,
  "approver_key_separation -> registry_history_closure": 3,
  "evidence_digest -> evidence_digest": 1,
  "evidence_envelope -> evidence_envelope": 1,
  "evidence_id -> evidence_id": 1,
  "evidence_pin -> evidence_pin": 2,
  "evidence_pin_structure -> evidence_pin_structure": 4,
  "evidence_policy_binding -> evidence_policy_binding": 2,
  "evidence_qa_signature -> evidence_qa_signature": 5,
  "evidence_qa_signature_binding -> qa_approver_resolution": 1,
  "evidence_release_signature -> evidence_release_signature": 4,
  "evidence_release_signature_binding -> release_approver_resolution": 1,
  "evidence_result_binding -> candidate_member_resolution": 2,
  "evidence_result_binding -> evidence_result_binding": 20,
  "evidence_runtime_binding -> evidence_runtime_binding": 1,
  "evidence_structure -> evidence_qa_signature_binding": 1,
  "evidence_structure -> evidence_release_signature_binding": 1,
  "evidence_structure -> evidence_structure": 7,
  "evidence_time -> evidence_time": 1,
  "input -> input": 37,
  "qa_approver_key_admission -> registry_history_closure": 1,
  "qa_approver_key_identity -> registry_history_closure": 4,
  "qa_approver_key_root -> registry_history_closure": 1,
  "qa_approver_key_signature -> registry_history_closure": 3,
  "qa_approver_key_structure -> registry_history_closure": 6,
  "release_approver_key_admission -> registry_history_closure": 1,
  "release_approver_key_identity -> registry_history_closure": 4,
  "release_approver_key_root -> registry_history_closure": 1,
  "release_approver_key_signature -> registry_history_closure": 3,
  "release_approver_key_structure -> registry_history_closure": 6,
  "runtime_attestation_closure -> registry_history_closure": 2,
  "runtime_attestation_closure -> registry_runtime_binding": 32,
  "runtime_attestation_closure -> runtime_attestation_closure": 62,
});

function incrementCountV1(counts, key) {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function sortedCountObjectV1(counts) {
  return Object.fromEntries(
    [...counts.entries()].sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  );
}

function expectedClassificationV1(expected) {
  return expected.kind === "accepted_snapshot" ? "accepted" : expected.stage;
}

function assertRecursivelyFrozenV1(value, seen = new WeakSet()) {
  if (
    value === null ||
    (typeof value !== "object" && typeof value !== "function")
  ) {
    return;
  }
  if (seen.has(value)) {
    return;
  }
  seen.add(value);
  if (!Object.isFrozen(value)) {
    throw new Error("accepted L closure is not recursively frozen");
  }
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.get !== undefined ||
      descriptor.set !== undefined
    ) {
      throw new Error("accepted L closure is not a data-only snapshot");
    }
    assertRecursivelyFrozenV1(descriptor.value, seen);
  }
}

function assertExactClosureShapeV1(closure) {
  const fields = Object.keys(closure).sort();
  if (!canonicalEqual(fields, EXPECTED_CLOSURE_FIELDS_V1)) {
    throw new Error(`accepted L closure fields drifted: ${fields.join(",")}`);
  }
}

const [
  bindingGoldenBytes,
  sourceGoldenBytes,
  sourceInvalidBytes,
  strictManifestBytes,
] = await Promise.all([
  readResource(
    PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_GOLDEN_RESOURCE_PATH_V1,
  ),
  readResource(PROVIDER_FEASIBILITY_EVIDENCE_POINT_GOLDEN_RESOURCE_PATH_V1),
  readResource(PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_RESOURCE_PATH_V1),
  readResource(PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1),
]);

const bindingGolden =
  verifyProviderRegistryEvidenceBindingPointGoldenResourceV1(
    new Uint8Array(bindingGoldenBytes),
  );

let pointAdmissionCount = 0;
let signatureVerificationCount = 0;
const strictCryptoCapability = await attestProviderStrictEd25519CryptoHostV1({
  host: Object.freeze({
    verificationProfile: STRICT_ED25519_VERIFICATION_PROFILE_V1,
    validatePrimeSubgroupPoint(point) {
      pointAdmissionCount += 1;
      return validatePrimeSubgroupPoint(point);
    },
    async verifyRawEd25519(publicKey, message, signature) {
      signatureVerificationCount += 1;
      return verifyRawEd25519(publicKey, message, signature);
    },
  }),
  resourceHost: Object.freeze({
    readFixedSignedPackageResource(resourcePath, maxBytes) {
      if (
        resourcePath !== PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1 ||
        maxBytes !== PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1
      ) {
        throw new TypeError("unexpected strict Ed25519 resource request");
      }
      return new Uint8Array(strictManifestBytes);
    },
  }),
});

function resetCryptoCountsV1() {
  pointAdmissionCount = 0;
  signatureVerificationCount = 0;
}

resetCryptoCountsV1();
const sourceGoldenVerification =
  await verifyProviderFeasibilityEvidencePointGoldenResourceV1(
    new Uint8Array(sourceGoldenBytes),
    strictCryptoCapability,
  );
if (
  pointAdmissionCount !==
    sourceGoldenVerification.manifest.expected.activeRootPointAdmissionCount ||
  signatureVerificationCount !==
    sourceGoldenVerification.manifest.expected.signatureVerificationCount
) {
  throw new Error("C09-1J Evidence golden crypto closure drifted");
}

const sourceInvalid =
  verifyProviderRegistryEvidenceBindingEvidenceAdapterSourceV1(
    sourceInvalidBytes,
  );
const schemaCheckedSourceInvalid =
  verifyProviderFeasibilityEvidencePointInvalidResourceV1(
    new Uint8Array(sourceInvalidBytes),
  );
if (!canonicalEqual(sourceInvalid, schemaCheckedSourceInvalid)) {
  throw new Error("Evidence adapter source schema projection drifted");
}

const context =
  buildProviderRegistryEvidenceBindingEvidenceAdapterContextV1({
    compatibleBase: bindingGolden.compatibleBase,
    sourceGolden: sourceGoldenVerification.manifest,
    compatibleBaseSemanticContentDigest: bindingGolden.semanticContentDigest,
  });
const compatibleBaseBefore = canonicalizeJcsSafeIntegerUtf8V1(
  context.compatibleBase,
);
const enabledNativeB = context.compatibleBase.registryManifestHistory
  .at(-1)
  .payload.members.find(
    (member) =>
      member.providerId === "durable-object-provider:native-b" &&
      member.disposition === "enabled",
  );
if (enabledNativeB === undefined) {
  throw new Error("Evidence adapter compatible base is not native-b enabled");
}

resetCryptoCountsV1();
const registryDiagnostic =
  await diagnoseProviderRegistryManifestHistoryInternalV1({
    installationIdentityGenerationId:
      context.compatibleBase.installationIdentityGenerationId,
    bootstrapTrustBundle: jsonClone(
      context.compatibleBase.bootstrapTrustBundle,
    ),
    rootMetadataHistory: jsonClone(context.compatibleBase.rootMetadataHistory),
    registryManifestHistory: jsonClone(
      context.compatibleBase.registryManifestHistory,
    ),
    strictCryptoCapability,
  });
const historyPointAdmissionCount = pointAdmissionCount;
const historySignatureVerificationCount = signatureVerificationCount;
if (
  !registryDiagnostic.ok ||
  historyPointAdmissionCount !==
    bindingGolden.expected.registryCryptoClosure.pointAdmissionCount ||
  historySignatureVerificationCount !==
    bindingGolden.expected.registryCryptoClosure.signatureVerificationCount
) {
  throw new Error(
    `compatible Registry dynamic prefix drifted: ${JSON.stringify({
      registryDiagnostic,
      pointAdmissionCount: historyPointAdmissionCount,
      signatureVerificationCount: historySignatureVerificationCount,
    })}`,
  );
}

resetCryptoCountsV1();
const goldenDiagnostic =
  await diagnoseProviderRegistryEvidenceBindingPointClosureV1(
    materializeProviderRegistryEvidenceBindingPointGoldenRequestV1(
      bindingGolden,
      strictCryptoCapability,
    ),
  );
const successPointAdmissionCount = pointAdmissionCount;
const successSignatureVerificationCount = signatureVerificationCount;
if (
  !goldenDiagnostic.ok ||
  successPointAdmissionCount !== historyPointAdmissionCount ||
  successSignatureVerificationCount !== historySignatureVerificationCount + 8 ||
  successPointAdmissionCount !==
    bindingGolden.expected.completeCryptoClosure.pointAdmissionCount ||
  successSignatureVerificationCount !==
    bindingGolden.expected.completeCryptoClosure.signatureVerificationCount
) {
  throw new Error(
    `compatible L dynamic prefix drifted: ${JSON.stringify({
      goldenDiagnostic,
      pointAdmissionCount: successPointAdmissionCount,
      signatureVerificationCount: successSignatureVerificationCount,
    })}`,
  );
}
assertRecursivelyFrozenV1(goldenDiagnostic.value);
assertExactClosureShapeV1(goldenDiagnostic.value);
if (
  !canonicalEqual(
    projectProviderRegistryEvidenceBindingPointClosureSnapshotV1(
      goldenDiagnostic.value,
    ),
    bindingGolden.expected.successProjection,
  )
) {
  throw new Error("compatible L flat ten-field projection drifted");
}

const aggregateDigest =
  deriveProviderRegistryEvidenceBindingEvidenceAdapterTableDigestV1(
    PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_EVIDENCE_ADAPTER_DEFINITIONS_V1,
  );
if (
  aggregateDigest !==
  PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_EVIDENCE_ADAPTER_TABLE_SEMANTIC_CONTENT_DIGEST_V1
) {
  throw new Error(`Evidence adapter aggregate digest drifted: ${aggregateDigest}`);
}

const caseIds = new Set();
const operations = new Set();
const materializedRequests = new WeakSet();
const recipeKindCounts = new Map();
const sourceStageCounts = new Map();
const outerStageCounts = new Map();
const stagePairCounts = new Map();
const cryptoCountTupleCounts = new Map();
const acceptedSourceIndexes = [];
let bindingPointInvocationCount = 0;
const executionStartedAt = performance.now();

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
  if (
    definition.sourceIndex !== index ||
    sourceInvalid.caseIds[index] !== definition.sourceCaseId ||
    sourceInvalid.cases[index].caseId !== definition.sourceCaseId ||
    definition.caseId !== `evidence-${definition.sourceCaseId}` ||
    definition.mutation.operation !== definition.caseId ||
    caseIds.has(definition.caseId) ||
    operations.has(definition.mutation.operation)
  ) {
    throw new Error(`${definition.caseId} exact-cover closure drifted`);
  }
  caseIds.add(definition.caseId);
  operations.add(definition.mutation.operation);

  const materialized =
    materializeProviderRegistryEvidenceBindingEvidenceAdapterCaseV1({
      adapterDefinition: definition,
      context,
      strictCryptoCapability,
    });
  if (
    materialized.request === null ||
    (typeof materialized.request !== "object" &&
      typeof materialized.request !== "function") ||
    materializedRequests.has(materialized.request)
  ) {
    throw new Error(`${definition.caseId} did not fresh-materialize a request`);
  }
  materializedRequests.add(materialized.request);
  const materializedRequestSemanticDigest =
    deriveProviderRegistryEvidenceBindingEvidenceAdapterMaterializedRequestDigestV1(
      materialized,
    );
  if (
    materializedRequestSemanticDigest !==
    definition.outerExpected.materializedRequestSemanticDigest
  ) {
    throw new Error(
      `${definition.caseId} materialized request digest drifted: ${materializedRequestSemanticDigest}`,
    );
  }

  resetCryptoCountsV1();
  const invocationCountBefore = bindingPointInvocationCount;
  bindingPointInvocationCount += 1;
  const pending = diagnoseProviderRegistryEvidenceBindingPointClosureV1(
    materialized.request,
  );
  if (materialized.mutateAfterStart !== undefined) {
    materialized.mutateAfterStart();
  }
  const diagnostic = await pending;
  if (bindingPointInvocationCount !== invocationCountBefore + 1) {
    throw new Error(`${definition.caseId} did not invoke L exactly once`);
  }
  if (materialized.getterCalls() !== 0) {
    throw new Error(`${definition.caseId} executed an attacker getter`);
  }

  const expected = definition.outerExpected;
  if (expected.kind === "accepted_snapshot") {
    if (
      !diagnostic.ok ||
      pointAdmissionCount !== expected.pointAdmissionCount ||
      signatureVerificationCount !== expected.signatureVerificationCount ||
      pointAdmissionCount !== successPointAdmissionCount ||
      signatureVerificationCount !== successSignatureVerificationCount
    ) {
      throw new Error(
        `${definition.caseId} accepted snapshot drifted: ${JSON.stringify({
          diagnostic,
          pointAdmissionCount,
          signatureVerificationCount,
          expected,
        })}`,
      );
    }
    assertRecursivelyFrozenV1(diagnostic.value);
    assertExactClosureShapeV1(diagnostic.value);
    if (
      !canonicalEqual(diagnostic.value, goldenDiagnostic.value) ||
      !canonicalEqual(
        projectProviderRegistryEvidenceBindingPointClosureSnapshotV1(
          diagnostic.value,
        ),
        expected.snapshotProjection,
      )
    ) {
      throw new Error(`${definition.caseId} full or flat snapshot drifted`);
    }
    acceptedSourceIndexes.push(index);
  } else if (
    diagnostic.ok ||
    diagnostic.stage !== expected.stage ||
    diagnostic.reason !== expected.reason ||
    pointAdmissionCount !== expected.pointAdmissionCount ||
    signatureVerificationCount !== expected.signatureVerificationCount
  ) {
    throw new Error(
      `${definition.caseId} outer diagnostic drifted: ${JSON.stringify({
        diagnostic,
        pointAdmissionCount,
        signatureVerificationCount,
        expected,
      })}`,
    );
  }

  const sourceClassification = expectedClassificationV1(
    definition.sourceExpected,
  );
  const outerClassification = expectedClassificationV1(expected);
  incrementCountV1(
    recipeKindCounts,
    definition.mutation.recipe.kind,
  );
  incrementCountV1(sourceStageCounts, sourceClassification);
  incrementCountV1(outerStageCounts, outerClassification);
  incrementCountV1(
    stagePairCounts,
    `${sourceClassification} -> ${outerClassification}`,
  );
  incrementCountV1(
    cryptoCountTupleCounts,
    `${pointAdmissionCount}/${signatureVerificationCount}`,
  );
}

const executionMilliseconds = performance.now() - executionStartedAt;
if (
  PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_EVIDENCE_ADAPTER_DEFINITIONS_V1.length !==
    227 ||
  caseIds.size !== 227 ||
  operations.size !== 227 ||
  bindingPointInvocationCount !== 227 ||
  !canonicalEqual(
    acceptedSourceIndexes,
    EXPECTED_ACCEPTED_SOURCE_INDEXES_V1,
  ) ||
  !canonicalEqual(
    sortedCountObjectV1(recipeKindCounts),
    EXPECTED_RECIPE_KIND_COUNTS_V1,
  ) ||
  !canonicalEqual(
    sortedCountObjectV1(stagePairCounts),
    EXPECTED_STAGE_PAIR_COUNTS_V1,
  )
) {
  throw new Error("Evidence adapter aggregate exact-cover or D-37 mapping drifted");
}
if (
  !Buffer.from(compatibleBaseBefore).equals(
    Buffer.from(canonicalizeJcsSafeIntegerUtf8V1(context.compatibleBase)),
  )
) {
  throw new Error("Evidence adapter mutated its compatible base");
}

const productionResultGate = {};
let productionVariantInvocationCount = 0;
for (const result of ["failed", "unsupported"]) {
  const materialized =
    materializeProviderRegistryEvidenceBindingEvidenceAdapterProductionResultVariantV1(
      { context, result, strictCryptoCapability },
    );
  resetCryptoCountsV1();
  productionVariantInvocationCount += 1;
  const diagnostic =
    await diagnoseProviderRegistryEvidenceBindingPointClosureV1(
      materialized.request,
    );
  if (
    diagnostic.ok ||
    diagnostic.stage !== "production_result_gate" ||
    diagnostic.reason !== "result_not_passed" ||
    pointAdmissionCount !== historyPointAdmissionCount ||
    signatureVerificationCount !== historySignatureVerificationCount + 6
  ) {
    throw new Error(
      `${result} production result gate drifted: ${JSON.stringify({
        diagnostic,
        pointAdmissionCount,
        signatureVerificationCount,
      })}`,
    );
  }
  productionResultGate[result] = Object.freeze({
    stage: diagnostic.stage,
    reason: diagnostic.reason,
    pointAdmissionCount,
    signatureVerificationCount,
  });
}
if (productionVariantInvocationCount !== 2) {
  throw new Error("production result variants did not invoke L exactly once each");
}

const summary = {
  caseCount: caseIds.size,
  bindingPointInvocationCount,
  acceptedSourceIndexes,
  acceptedSnapshotCount: acceptedSourceIndexes.length,
  dynamicHistoryPrefix: {
    pointAdmissionCount: historyPointAdmissionCount,
    signatureVerificationCount: historySignatureVerificationCount,
  },
  dynamicSuccessCount: {
    pointAdmissionCount: successPointAdmissionCount,
    signatureVerificationCount: successSignatureVerificationCount,
  },
  productionResultGate,
  recipeKindCounts: sortedCountObjectV1(recipeKindCounts),
  sourceStageCounts: sortedCountObjectV1(sourceStageCounts),
  outerStageCounts: sortedCountObjectV1(outerStageCounts),
  stagePairCounts: sortedCountObjectV1(stagePairCounts),
  cryptoCountTupleCounts: sortedCountObjectV1(cryptoCountTupleCounts),
  aggregateDigest,
  executionMilliseconds: Number(executionMilliseconds.toFixed(3)),
};
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
