import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

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
  PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_PATH_V1,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_RESOURCE_PATH_V1,
  verifyProviderRegistryManifestHistoryGoldenResourceV1,
  verifyProviderRegistryManifestHistoryInvalidResourceV1,
} from "../dist/provider-registry-manifest-fixtures.js";
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
  PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_REGISTRY_ADAPTER_DEFINITIONS_V1,
  PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_REGISTRY_ADAPTER_TABLE_SEMANTIC_CONTENT_DIGEST_V1,
  deriveProviderRegistryEvidenceBindingRegistryAdapterMaterializedRequestDigestV1,
  deriveProviderRegistryEvidenceBindingRegistryAdapterTableDigestV1,
  finalizeProviderRegistryEvidenceBindingRegistryAdapterRowV1,
  materializeProviderRegistryEvidenceBindingRegistryAdapterCaseV1,
  verifyProviderRegistryEvidenceBindingRegistryAdapterSourceV1,
} from "./lib/provider-registry-evidence-binding-point-registry-adapter.mjs";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readResource = (relativePath) =>
  readFile(join(packageRoot, ...relativePath.split("/")));
const jsonClone = (value) => JSON.parse(JSON.stringify(value));
const canonicalEqual = (left, right) =>
  JSON.stringify(left) === JSON.stringify(right);

const [bindingGoldenBytes, registryGoldenBytes, registryInvalidBytes, strictBytes] =
  await Promise.all([
    readResource(
      PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_GOLDEN_RESOURCE_PATH_V1,
    ),
    readResource(PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_PATH_V1),
    readResource(PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_RESOURCE_PATH_V1),
    readResource(PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1),
  ]);

const bindingGolden =
  verifyProviderRegistryEvidenceBindingPointGoldenResourceV1(
    new Uint8Array(bindingGoldenBytes),
  );
const registryGolden =
  verifyProviderRegistryManifestHistoryGoldenResourceV1(
    new Uint8Array(registryGoldenBytes),
  );
const registryInvalid =
  verifyProviderRegistryEvidenceBindingRegistryAdapterSourceV1(
    registryInvalidBytes,
  );
const schemaCheckedRegistryInvalid =
  verifyProviderRegistryManifestHistoryInvalidResourceV1(
    new Uint8Array(registryInvalidBytes),
  );
if (!canonicalEqual(registryInvalid, schemaCheckedRegistryInvalid)) {
  throw new Error("Registry adapter source schema projection drifted");
}

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
      return new Uint8Array(strictBytes);
    },
  }),
});

function resetCryptoCounts() {
  pointAdmissionCount = 0;
  signatureVerificationCount = 0;
}

resetCryptoCounts();
const registryDiagnostic =
  await diagnoseProviderRegistryManifestHistoryInternalV1({
    installationIdentityGenerationId:
      bindingGolden.compatibleBase.installationIdentityGenerationId,
    bootstrapTrustBundle: jsonClone(
      bindingGolden.compatibleBase.bootstrapTrustBundle,
    ),
    rootMetadataHistory: jsonClone(
      bindingGolden.compatibleBase.rootMetadataHistory,
    ),
    registryManifestHistory: jsonClone(
      bindingGolden.compatibleBase.registryManifestHistory,
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

resetCryptoCounts();
const goldenDiagnostic =
  await diagnoseProviderRegistryEvidenceBindingPointClosureV1(
    materializeProviderRegistryEvidenceBindingPointGoldenRequestV1(
      bindingGolden,
      strictCryptoCapability,
    ),
  );
if (
  !goldenDiagnostic.ok ||
  pointAdmissionCount !== historyPointAdmissionCount ||
  signatureVerificationCount !== historySignatureVerificationCount + 8 ||
  pointAdmissionCount !==
    bindingGolden.expected.completeCryptoClosure.pointAdmissionCount ||
  signatureVerificationCount !==
    bindingGolden.expected.completeCryptoClosure.signatureVerificationCount
) {
  throw new Error(
    `compatible L dynamic prefix drifted: ${JSON.stringify({
      goldenDiagnostic,
      pointAdmissionCount,
      signatureVerificationCount,
    })}`,
  );
}
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

const finalizedRows = [];
const outerStageCounts = new Map();
const sourceStageCounts = new Map();
const executionStartedAt = performance.now();

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
      registryGolden,
      compatibleBase: bindingGolden.compatibleBase,
      strictCryptoCapability,
    });
  for (const proof of materialized.wrongDomainProofs) {
    if (
      !(await verifyRawEd25519(
        proof.publicKeyBytes,
        proof.messageBytes,
        proof.signatureBytes,
      ))
    ) {
      throw new Error(`${definition.caseId} wrong-domain proof drifted`);
    }
  }
  if (
    materialized.wrongDomainProofs.length !==
    materialized.sourceCase.expected.wrongDomainProofCount
  ) {
    throw new Error(`${definition.caseId} wrong-domain proof count drifted`);
  }

  const materializedRequestSemanticDigest =
    deriveProviderRegistryEvidenceBindingRegistryAdapterMaterializedRequestDigestV1(
      materialized.request,
    );
  const row =
    finalizeProviderRegistryEvidenceBindingRegistryAdapterRowV1(
      definition,
      materialized.sourceCase,
      materializedRequestSemanticDigest,
    );
  if (
    row.sourceIndex !== index ||
    registryInvalid.caseIds[index] !== row.sourceCaseId ||
    registryInvalid.cases[index].caseId !== row.sourceCaseId ||
    registryInvalid.cases[index].mutation.steps[0].operation !==
      row.sourceOperation ||
    row.caseId !== `registry-${row.sourceCaseId}` ||
    row.mutation.operation !== row.caseId
  ) {
    throw new Error(`${definition.caseId} positional closure drifted`);
  }

  resetCryptoCounts();
  const diagnostic =
    await diagnoseProviderRegistryEvidenceBindingPointClosureV1(
      materialized.request,
    );
  if (
    diagnostic.ok ||
    diagnostic.stage !== row.outerExpected.stage ||
    diagnostic.reason !== row.outerExpected.reason ||
    pointAdmissionCount !== row.outerExpected.pointAdmissionCount ||
    signatureVerificationCount !==
      row.outerExpected.signatureVerificationCount
  ) {
    throw new Error(
      `${row.caseId} outer diagnostic drifted: ${JSON.stringify({
        diagnostic,
        pointAdmissionCount,
        signatureVerificationCount,
        expected: row.outerExpected,
      })}`,
    );
  }
  if (row.outerExpected.stage === "registry_history_closure") {
    if (
      row.outerExpected.pointAdmissionCount !==
        row.sourceExpected.pointAdmissionCount ||
      row.outerExpected.signatureVerificationCount !==
        row.sourceExpected.signatureVerificationCount ||
      pointAdmissionCount > historyPointAdmissionCount ||
      signatureVerificationCount > historySignatureVerificationCount
    ) {
      throw new Error(`${row.caseId} did not preserve its source prefix`);
    }
  }

  finalizedRows.push(row);
  outerStageCounts.set(
    row.outerExpected.stage,
    (outerStageCounts.get(row.outerExpected.stage) ?? 0) + 1,
  );
  sourceStageCounts.set(
    row.sourceExpected.stage,
    (sourceStageCounts.get(row.sourceExpected.stage) ?? 0) + 1,
  );
}

const executionMilliseconds = performance.now() - executionStartedAt;
const caseIds = finalizedRows.map(({ caseId }) => caseId);
const operations = finalizedRows.map(({ mutation }) => mutation.operation);
if (
  finalizedRows.length !== 89 ||
  caseIds.length !== new Set(caseIds).size ||
  caseIds.some(
    (caseId, index) =>
      caseId !== finalizedRows[index].caseId ||
      caseId !== operations[index],
  )
) {
  throw new Error("Registry adapter aggregate exact-cover drifted");
}

const aggregateDigest =
  deriveProviderRegistryEvidenceBindingRegistryAdapterTableDigestV1(
    finalizedRows,
  );
if (
  (outerStageCounts.get("input") ?? 0) !== 8 ||
  (outerStageCounts.get("bootstrap_distribution_binding") ?? 0) !== 0 ||
  (outerStageCounts.get("registry_history_closure") ?? 0) !== 81
) {
  throw new Error("Registry adapter outer classification drifted");
}
const emitAnchor = process.argv.includes("--emit-anchor");
if (
  !emitAnchor &&
  aggregateDigest !==
    PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_REGISTRY_ADAPTER_TABLE_SEMANTIC_CONTENT_DIGEST_V1
) {
  throw new Error(
    `Registry adapter aggregate digest drifted: ${aggregateDigest}`,
  );
}

const summary = {
  caseCount: finalizedRows.length,
  dynamicHistoryPrefix: {
    pointAdmissionCount: historyPointAdmissionCount,
    signatureVerificationCount: historySignatureVerificationCount,
  },
  dynamicSuccessCount: {
    pointAdmissionCount:
      bindingGolden.expected.completeCryptoClosure.pointAdmissionCount,
    signatureVerificationCount:
      bindingGolden.expected.completeCryptoClosure.signatureVerificationCount,
  },
  outerStageCounts: {
    input: outerStageCounts.get("input") ?? 0,
    bootstrap_distribution_binding:
      outerStageCounts.get("bootstrap_distribution_binding") ?? 0,
    registry_history_closure:
      outerStageCounts.get("registry_history_closure") ?? 0,
  },
  sourceStageCounts: Object.fromEntries(
    [...sourceStageCounts.entries()].sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  ),
  aggregateDigest,
  executionMilliseconds: Number(executionMilliseconds.toFixed(3)),
};
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
