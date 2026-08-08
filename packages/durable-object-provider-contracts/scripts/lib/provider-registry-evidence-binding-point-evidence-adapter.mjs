import {
  createHash,
  createPrivateKey,
  sign,
} from "node:crypto";

import {
  canonicalizeJcsSafeIntegerUtf8V1,
} from "../../dist/jcs.js";
import {
  PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_RESOURCE_PATH_V1,
  PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_RESOURCE_SHA256_HEX_V1,
  PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_SEMANTIC_CONTENT_DIGEST_V1,
  PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_SEMANTIC_DOMAIN_V1,
} from "../../dist/provider-feasibility-evidence-point-fixtures.js";
import {
  PROVIDER_FEASIBILITY_EVIDENCE_QA_SIGNATURE_DOMAIN_V1,
  PROVIDER_FEASIBILITY_EVIDENCE_RELEASE_SIGNATURE_DOMAIN_V1,
  ProviderFeasibilityEvidenceEnvelopeV1Schema,
  ProviderFeasibilityEvidenceUnsignedClaimsV1Schema,
  ProviderFeasibilityEvidenceV1Schema,
  createProviderFeasibilityEvidenceQaSignatureMessageV1,
  createProviderFeasibilityEvidenceReleaseSignatureMessageV1,
  deriveProviderFeasibilityEvidenceContentDigestV1,
  deriveProviderFeasibilityEvidenceIdV1,
  deriveProviderFeasibilityEvidencePinV1,
} from "../../dist/provider-feasibility-evidence-point.js";
import {
  materializeProviderRealFilesystemConformanceResultInvalidRequestWitnessV1,
} from "../../dist/provider-real-filesystem-conformance-result-fixtures.js";
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
  createProviderFeasibilityApproverPublicKeySignatureMessageV1,
  createStoreDurableObjectProviderRuntimeAttestationSignatureMessageV1,
  deriveStoreDurableObjectProviderRuntimeAttestationContentDigestV1,
} from "../../dist/provider-registry-records.js";
import {
  buildInvalidMutation as buildRuntimeInvalidMutationV1,
} from "./provider-runtime-attestation-point-fixture.mjs";
import {
  NATIVE_B_PROVIDER_ID,
  QA_APPROVER_SEED_HEX,
  RELEASE_APPROVER_SEED_HEX,
  ROOT_3_SEED_HEX,
  appendCompatibleBaseEntrySuccessorForGenerator,
  buildProviderFeasibilityApproverRecordForGenerator,
  jsonClone,
  reanchorCompatibleBaseCandidateForGenerator,
  requestFromCompatibleBase,
} from "./provider-registry-evidence-binding-point-fixture.mjs";

export const PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_EVIDENCE_ADAPTER_MATERIALIZED_REQUEST_DOMAIN_V1 =
  "provider-registry-evidence-binding-point-evidence-adapter-materialized-request-v1";
export const PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_EVIDENCE_ADAPTER_TABLE_DOMAIN_V1 =
  "provider-registry-evidence-binding-point-evidence-adapter-table-v1";
export const PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_EVIDENCE_ADAPTER_TABLE_SEMANTIC_CONTENT_DIGEST_V1 =
  "sha256:cee12b142aec7754b10ab7d1e4f6ab46867747bd95b53ae15c4e4ee5da43be5c";

const SOURCE_RESOURCE_ANCHOR_V1 = Object.freeze({
  resourcePath:
    PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_RESOURCE_PATH_V1,
  resourceByteLength:
    PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_RESOURCE_BYTE_LENGTH_V1,
  resourceSha256Hex:
    PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_RESOURCE_SHA256_HEX_V1,
  semanticDomain:
    PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_SEMANTIC_DOMAIN_V1,
  semanticContentDigest:
    PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_SEMANTIC_CONTENT_DIGEST_V1,
});

const WRONG_SIGNER_SEED_HEX_V1 = "31".repeat(32);
const INVALID_POINT_PUBLIC_KEY_BYTES_V1 =
  `base64url:${Buffer.alloc(32).toString("base64url")}`;
const INNER_EXECUTABLE_CASE_IDS_V1 = new Set([
  "locator-envelope-substitution",
  "security-top-level-proxy",
  "security-nested-proxy",
  "security-top-level-getter",
  "security-nested-getter",
  "security-nested-hidden",
  "security-nested-symbol",
  "security-sparse-array",
  "security-cycle",
  "security-alias",
  "security-async-mutation",
]);

function sha256HexV1(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function semanticDigestV1(domain, value) {
  return `sha256:${sha256HexV1(
    canonicalizeJcsSafeIntegerUtf8V1([domain, value]),
  )}`;
}

function canonicalEqualV1(left, right) {
  return Buffer.from(canonicalizeJcsSafeIntegerUtf8V1(left)).equals(
    Buffer.from(canonicalizeJcsSafeIntegerUtf8V1(right)),
  );
}

function digestV1(character) {
  return `sha256:${character.repeat(64)}`;
}

function otherStringV1(value) {
  const last = value.at(-1);
  return `${value.slice(0, -1)}${last === "0" ? "1" : "0"}`;
}

function privateKeyFromSeedHexV1(seedHex) {
  return createPrivateKey({
    key: Buffer.concat([
      Buffer.from("302e020100300506032b657004220420", "hex"),
      Buffer.from(seedHex, "hex"),
    ]),
    format: "der",
    type: "pkcs8",
  });
}

function rawSignatureHexV1(seedHex, message) {
  return sign(
    null,
    Buffer.from(message),
    privateKeyFromSeedHexV1(seedHex),
  ).toString("hex");
}

function evidenceSignatureV1(role, keyId, seedHex, message) {
  return `provider-feasibility-ed25519:${role}:${keyId}:${rawSignatureHexV1(
    seedHex,
    message,
  )}`;
}

function registrySignatureV1(rootKeyId, seedHex, message) {
  return `provider-registry-ed25519:${rootKeyId}:${rawSignatureHexV1(
    seedHex,
    message,
  )}`;
}

function bitflipSignatureV1(signature) {
  const last = signature.at(-1);
  return `${signature.slice(0, -1)}${last === "0" ? "1" : "0"}`;
}

function parseCanonicalRecipeJsonV1(value) {
  const parsed = JSON.parse(value);
  if (
    new TextDecoder().decode(canonicalizeJcsSafeIntegerUtf8V1(parsed)) !==
    value
  ) {
    throw new TypeError("compatible runtime recipe JSON is not canonical");
  }
  return parsed;
}

function sourceExpectedProjectionV1(sourceCase) {
  const expected = sourceCase.expected;
  if (expected.boundary === "snapshot_stability") {
    return {
      kind: "accepted_snapshot",
      boundary: expected.boundary,
      outcome: expected.outcome,
      authority: expected.authority,
      snapshotProjection: expected.snapshotProjection,
      pointAdmissionCount: expected.pointAdmissionCount,
      signatureVerificationCount: expected.signatureVerificationCount,
      materializedRequestSemanticDigest:
        expected.materializedRequestSemanticDigest,
    };
  }
  return {
    kind: "diagnostic",
    stage: expected.stage,
    reason: expected.reason,
    pointAdmissionCount: expected.pointAdmissionCount,
    signatureVerificationCount: expected.signatureVerificationCount,
    materializedRequestSemanticDigest:
      expected.materializedRequestSemanticDigest,
  };
}

export function verifyProviderRegistryEvidenceBindingEvidenceAdapterSourceV1(
  sourceBytes,
) {
  const bytes = Buffer.from(sourceBytes);
  if (
    bytes.byteLength !== SOURCE_RESOURCE_ANCHOR_V1.resourceByteLength ||
    sha256HexV1(bytes) !== SOURCE_RESOURCE_ANCHOR_V1.resourceSha256Hex
  ) {
    throw new TypeError("Evidence adapter source raw anchor drifted");
  }
  const source = JSON.parse(bytes.toString("utf8"));
  const { semanticContentDigest: _semanticContentDigest, ...semanticFields } =
    source;
  if (
    semanticDigestV1(SOURCE_RESOURCE_ANCHOR_V1.semanticDomain, semanticFields) !==
      SOURCE_RESOURCE_ANCHOR_V1.semanticContentDigest ||
    source.caseCount !== 227 ||
    source.runtimeCaseCount !== 122 ||
    source.pointCaseCount !== 105 ||
    !Array.isArray(source.caseIds) ||
    !Array.isArray(source.cases) ||
    source.caseIds.length !== 227 ||
    source.cases.length !== 227 ||
    PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_EVIDENCE_ADAPTER_DEFINITIONS_V1.length !==
      227
  ) {
    throw new TypeError("Evidence adapter source semantic closure drifted");
  }
  for (let index = 0; index < 227; index += 1) {
    const row =
      PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_EVIDENCE_ADAPTER_DEFINITIONS_V1[
        index
      ];
    const sourceCase = source.cases[index];
    if (
      row.sourceIndex !== index ||
      source.caseIds[index] !== row.sourceCaseId ||
      sourceCase.caseId !== row.sourceCaseId ||
      sourceCase.mutation.operation !== row.sourceOperation ||
      row.caseId !== `evidence-${row.sourceCaseId}` ||
      row.mutation.operation !== row.caseId ||
      row.mutation.recipe.sourceIndex !== index ||
      row.mutation.recipe.sourceCaseId !== row.sourceCaseId ||
      row.mutation.recipe.sourceOperation !== row.sourceOperation ||
      !canonicalEqualV1(
        sourceExpectedProjectionV1(sourceCase),
        row.sourceExpected,
      )
    ) {
      throw new TypeError(`Evidence adapter row ${index} drifted`);
    }
  }
  return source;
}

function snapshotMaterializedValueV1(value, recursion, completedSnapshots) {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
      throw new TypeError("materialized request has a non-JCS number");
    }
    return value;
  }
  if (typeof value !== "object" || recursion.has(value)) {
    throw new TypeError("materialized request has a non-data cycle");
  }
  const completed = completedSnapshots.get(value);
  if (completed !== undefined) return completed;
  const isArray = Array.isArray(value);
  const prototype = Reflect.getPrototypeOf(value);
  if (
    (isArray && prototype !== Array.prototype) ||
    (!isArray && prototype !== Object.prototype && prototype !== null)
  ) {
    throw new TypeError("materialized request has a non-data prototype");
  }
  recursion.add(value);
  try {
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Object.getOwnPropertySymbols(value).length !== 0) {
      throw new TypeError("materialized request has a symbol key");
    }
    if (isArray) {
      const lengthDescriptor = descriptors.length;
      const length = lengthDescriptor?.value;
      if (
        lengthDescriptor === undefined ||
        !("value" in lengthDescriptor) ||
        lengthDescriptor.enumerable !== false ||
        !Number.isSafeInteger(length) ||
        length < 0
      ) {
        throw new TypeError("materialized request has an invalid array");
      }
      for (const key of Object.keys(descriptors)) {
        if (key === "length") continue;
        const index = Number(key);
        const descriptor = descriptors[key];
        if (
          !Number.isSafeInteger(index) ||
          index < 0 ||
          index >= length ||
          String(index) !== key ||
          descriptor === undefined ||
          !("value" in descriptor) ||
          descriptor.enumerable !== true
        ) {
          throw new TypeError(
            "materialized request array requires indexed data properties",
          );
        }
      }
      const output = [];
      for (let index = 0; index < length; index += 1) {
        const descriptor = descriptors[String(index)];
        output.push(
          descriptor === undefined
            ? { fixtureInvalidArrayHole: true }
            : snapshotMaterializedValueV1(
                descriptor.value,
                recursion,
                completedSnapshots,
              ),
        );
      }
      completedSnapshots.set(value, output);
      return output;
    }
    const output = {};
    for (const key of Object.keys(descriptors).sort()) {
      const descriptor = descriptors[key];
      if (
        descriptor === undefined ||
        !("value" in descriptor) ||
        descriptor.enumerable !== true
      ) {
        throw new TypeError("materialized request requires data properties");
      }
      output[key] = snapshotMaterializedValueV1(
        descriptor.value,
        recursion,
        completedSnapshots,
      );
    }
    completedSnapshots.set(value, output);
    return output;
  } finally {
    recursion.delete(value);
  }
}

export function deriveProviderRegistryEvidenceBindingEvidenceAdapterMaterializedRequestDigestV1(
  materialized,
) {
  if (materialized.executionProfile !== undefined) {
    return semanticDigestV1(
      PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_EVIDENCE_ADAPTER_MATERIALIZED_REQUEST_DOMAIN_V1,
      {
        caseId: materialized.caseId,
        executionProfile: materialized.executionProfile,
        compatibleBaseSemanticContentDigest:
          materialized.compatibleBaseSemanticContentDigest,
      },
    );
  }
  const request = materialized.request;
  if (
    request === null ||
    typeof request !== "object" ||
    Array.isArray(request) ||
    (Reflect.getPrototypeOf(request) !== Object.prototype &&
      Reflect.getPrototypeOf(request) !== null) ||
    Object.getOwnPropertySymbols(request).length !== 0
  ) {
    throw new TypeError("materialized outer request must be a data object");
  }
  const descriptors = Object.getOwnPropertyDescriptors(request);
  const projectedRequest = {};
  const recursion = new WeakSet();
  const completedSnapshots = new WeakMap();
  for (const key of Object.keys(descriptors).sort()) {
    const descriptor = descriptors[key];
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      throw new TypeError("materialized outer request must be data-only");
    }
    projectedRequest[key] =
      key === "strictCryptoCapability"
        ? {
            profile:
              "provider_registry_evidence_binding_evidence_adapter_capability_sentinel_v1",
          }
        : snapshotMaterializedValueV1(
            descriptor.value,
            recursion,
            completedSnapshots,
          );
  }
  return semanticDigestV1(
    PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_EVIDENCE_ADAPTER_MATERIALIZED_REQUEST_DOMAIN_V1,
    {
      profile:
        "provider_registry_evidence_binding_evidence_adapter_materialized_request_projection_v1",
      request: projectedRequest,
    },
  );
}

function findNativeBEntryV1(compatibleBase) {
  const tip = compatibleBase.registryManifestHistory.at(-1);
  const member = tip?.payload.members.find(
    (candidate) =>
      candidate.providerId === NATIVE_B_PROVIDER_ID &&
      candidate.disposition === "enabled",
  );
  if (member === undefined) {
    throw new TypeError("compatible base lost native-b enabled member");
  }
  return member.registryEntry;
}

function findApproverRecordV1(entry, role) {
  const record = entry.feasibilityApprovalKeys.publicKeyRecords.find(
    (candidate) => candidate.role === role,
  );
  if (record === undefined) {
    throw new TypeError(`compatible base lost ${role} approver record`);
  }
  return record;
}

export function buildProviderRegistryEvidenceBindingEvidenceAdapterContextV1({
  compatibleBase,
  sourceGolden,
  compatibleBaseSemanticContentDigest,
}) {
  const nativeBEntry = findNativeBEntryV1(compatibleBase);
  const qaApproverPublicKey = jsonClone(
    findApproverRecordV1(nativeBEntry, "qa"),
  );
  const releaseApproverPublicKey = jsonClone(
    findApproverRecordV1(nativeBEntry, "release"),
  );
  const sourceRuntimeGolden = sourceGolden.runtimeAttestationPointGolden;
  const sourceConformanceGolden = sourceRuntimeGolden.conformanceResultGolden;
  const runtimeAttestationPointGolden = {
    ...jsonClone(sourceRuntimeGolden),
    conformanceResultGolden: {
      ...jsonClone(sourceConformanceGolden),
      activeRoot: jsonClone(compatibleBase.activeRoot),
      activeRootMetadata: jsonClone(compatibleBase.activeRootMetadata),
      distributionRootBinding: jsonClone(
        compatibleBase.distributionRootBinding,
      ),
      fixtureCorpusManifest: jsonClone(
        compatibleBase.fixtureCorpusManifest,
      ),
      publicSupportTaxonomy: jsonClone(
        compatibleBase.publicSupportTaxonomy,
      ),
      realFilesystemConformanceResult: jsonClone(
        compatibleBase.realFilesystemConformanceResult,
      ),
      realFilesystemConformanceResultLocator: jsonClone(
        compatibleBase.realFilesystemConformanceResultLocator,
      ),
      realFilesystemConformanceResultPin: jsonClone(
        compatibleBase.realFilesystemConformanceResultPin,
      ),
      releaseMatrix: jsonClone(compatibleBase.releaseMatrix),
      suiteManifest: jsonClone(compatibleBase.suiteManifest),
      targetDiscoveryFixtureManifest: jsonClone(
        compatibleBase.targetDiscoveryFixtureManifest,
      ),
      targetDiscoveryResult: jsonClone(
        compatibleBase.targetDiscoveryResult,
      ),
      targetDiscoveryRunnerRun: jsonClone(
        compatibleBase.targetDiscoveryRunnerRun,
      ),
      semanticContentDigest: compatibleBaseSemanticContentDigest,
    },
    realFilesystemConformanceResult: jsonClone(
      compatibleBase.realFilesystemConformanceResult,
    ),
    realFilesystemConformanceResultLocator: jsonClone(
      compatibleBase.realFilesystemConformanceResultLocator,
    ),
    realFilesystemConformanceResultPin: jsonClone(
      compatibleBase.realFilesystemConformanceResultPin,
    ),
    runtimeAttestation: jsonClone(compatibleBase.runtimeAttestation),
    semanticProviderPolicy: jsonClone(
      compatibleBase.semanticProviderPolicy,
    ),
    semanticContentDigest: compatibleBaseSemanticContentDigest,
  };
  return Object.freeze({
    compatibleBase,
    compatibleBaseSemanticContentDigest,
    sourceGolden,
    runtimeAttestationPointGolden,
    qaApproverPublicKey,
    releaseApproverPublicKey,
  });
}

function baseRequestV1(context, strictCryptoCapability) {
  return requestFromCompatibleBase(
    context.compatibleBase,
    strictCryptoCapability,
  );
}

function materializedExecutionV1(
  definition,
  context,
  request,
  getterCalls = () => 0,
  mutateAfterStart,
) {
  return Object.freeze({
    caseId: definition.caseId,
    executionProfile: definition.sourceOperation,
    compatibleBaseSemanticContentDigest:
      context.compatibleBaseSemanticContentDigest,
    request,
    getterCalls,
    ...(mutateAfterStart === undefined ? {} : { mutateAfterStart }),
  });
}

function materializedDataV1(definition, request) {
  return Object.freeze({
    caseId: definition.caseId,
    request,
    getterCalls: () => 0,
  });
}

const CONFORMANCE_REPLAY_KEYS_V1 = Object.freeze([
  "activeRoot",
  "activeRootMetadata",
  "distributionRootBinding",
  "fixtureCorpusManifest",
  "publicSupportTaxonomy",
  "realFilesystemConformanceResult",
  "realFilesystemConformanceResultLocator",
  "realFilesystemConformanceResultPin",
  "releaseMatrix",
  "suiteManifest",
  "targetDiscoveryFixtureManifest",
  "targetDiscoveryResult",
  "targetDiscoveryRunnerRun",
]);

function prepareInnerExecutableV1(
  definition,
  context,
  operation,
  strictCryptoCapability,
) {
  const request = baseRequestV1(context, strictCryptoCapability);
  let getterCalls = 0;
  if (operation === "locator-envelope-substitution") {
    request.realFilesystemConformanceResultLocator = jsonClone(
      request.realFilesystemConformanceResult,
    );
  } else if (operation === "security-top-level-proxy") {
    return materializedExecutionV1(
      definition,
      context,
      new Proxy(request, {}),
      () => getterCalls,
    );
  } else if (operation === "security-nested-proxy") {
    request.realFilesystemConformanceResult.payload = new Proxy(
      request.realFilesystemConformanceResult.payload,
      {},
    );
  } else if (operation === "security-top-level-getter") {
    Object.defineProperty(request, "unexpected", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return true;
      },
    });
  } else if (operation === "security-nested-getter") {
    Object.defineProperty(
      request.realFilesystemConformanceResult.payload,
      "unexpected",
      {
        enumerable: true,
        get() {
          getterCalls += 1;
          return true;
        },
      },
    );
  } else if (operation === "security-nested-hidden") {
    Object.defineProperty(
      request.realFilesystemConformanceResult.payload,
      "hidden",
      { enumerable: false, value: true },
    );
  } else if (operation === "security-nested-symbol") {
    Object.defineProperty(
      request.realFilesystemConformanceResult.payload,
      Symbol("hostile"),
      { enumerable: true, value: true },
    );
  } else if (operation === "security-sparse-array") {
    delete request.realFilesystemConformanceResult.payload.caseResults[0];
  } else if (operation === "security-cycle") {
    request.cycle = request;
  } else if (operation === "security-alias") {
    request.realFilesystemConformanceResult.payload.target =
      request.targetDiscoveryResult.payload.targets[0].target;
  } else if (operation === "security-async-mutation") {
    return materializedExecutionV1(
      definition,
      context,
      request,
      () => getterCalls,
      () => {
        request.realFilesystemConformanceResult.payload.result = "failed";
        const first =
          request.realFilesystemConformanceResult.payload.caseResults[0];
        if (first !== undefined) {
          first.outcome = "failed";
          first.resultCode = "assertion_failed";
        }
      },
    );
  } else {
    throw new TypeError(`unknown executable inner operation ${operation}`);
  }
  return materializedExecutionV1(
    definition,
    context,
    request,
    () => getterCalls,
  );
}

function prepareRuntimeHostileV1(
  definition,
  context,
  profile,
  strictCryptoCapability,
) {
  const request = baseRequestV1(context, strictCryptoCapability);
  let getterCalls = 0;
  if (profile === "extra_field") {
    request.unexpected = true;
  } else if (profile === "plain_validation_dto") {
    return materializedExecutionV1(
      definition,
      context,
      {
        conformanceResultClosure: {
          authority: "none_real_fs_conformance_result_structure_only",
        },
        runtimeAttestation: request.runtimeAttestation,
      },
      () => getterCalls,
    );
  } else if (profile === "top_level_proxy") {
    return materializedExecutionV1(
      definition,
      context,
      new Proxy(request, {}),
      () => getterCalls,
    );
  } else if (profile === "nested_proxy") {
    request.runtimeAttestation.payload = new Proxy(
      request.runtimeAttestation.payload,
      {},
    );
  } else if (profile === "top_level_getter") {
    Object.defineProperty(request, "unexpected", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return true;
      },
    });
  } else if (profile === "nested_getter") {
    Object.defineProperty(request.runtimeAttestation.payload, "unexpected", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return true;
      },
    });
  } else if (profile === "top_level_hidden") {
    Object.defineProperty(request, "hidden", {
      enumerable: false,
      value: true,
    });
  } else if (profile === "nested_hidden") {
    Object.defineProperty(request.runtimeAttestation.payload, "hidden", {
      enumerable: false,
      value: true,
    });
  } else if (profile === "top_level_symbol") {
    Object.defineProperty(request, Symbol("hostile"), {
      enumerable: true,
      value: true,
    });
  } else if (profile === "nested_symbol") {
    Object.defineProperty(
      request.runtimeAttestation.payload,
      Symbol("hostile"),
      { enumerable: true, value: true },
    );
  } else if (profile === "sparse_array") {
    delete request.semanticProviderPolicy.supportedStagingObjectKinds[0];
  } else if (profile === "cycle") {
    request.semanticProviderPolicy.cycle = request.semanticProviderPolicy;
  } else if (profile === "alias") {
    request.semanticProviderPolicy.isolation =
      request.realFilesystemConformanceResult.payload.target;
  } else if (profile === "async_mutation") {
    return materializedExecutionV1(
      definition,
      context,
      request,
      () => getterCalls,
      () => {
        request.runtimeAttestation.payload.ipcEndpointAttestationDigest =
          digestV1("7");
        request.runtimeAttestation.payload.attestationGeneration = 2;
        request.runtimeAttestation.payload.issuedAt =
          "2026-08-04T23:59:59Z";
      },
    );
  } else if (profile === "runtime_generation_unsafe") {
    request.runtimeAttestation.payload.attestationGeneration =
      Number.MAX_SAFE_INTEGER + 1;
  } else if (profile === "runtime_generation_fractional") {
    request.runtimeAttestation.payload.attestationGeneration = 1.5;
  } else {
    throw new TypeError(`unknown runtime hostile profile ${profile}`);
  }
  return materializedExecutionV1(
    definition,
    context,
    request,
    () => getterCalls,
  );
}

function materializeRuntimeInheritedV1(
  definition,
  context,
  strictCryptoCapability,
) {
  const operation = definition.mutation.recipe.adapterOperation;
  const mutation = buildRuntimeInvalidMutationV1(
    context.runtimeAttestationPointGolden,
    operation,
    ROOT_3_SEED_HEX,
  );
  const recipe = mutation.recipe;
  if (recipe.kind === "inner_conformance_result") {
    const innerOperation = recipe.sourceOperation;
    if (INNER_EXECUTABLE_CASE_IDS_V1.has(innerOperation)) {
      return prepareInnerExecutableV1(
        definition,
        context,
        innerOperation,
        strictCryptoCapability,
      );
    }
    const witness =
      materializeProviderRealFilesystemConformanceResultInvalidRequestWitnessV1(
        context.runtimeAttestationPointGolden.conformanceResultGolden,
        innerOperation,
      );
    if (witness.request === undefined) {
      throw new TypeError(`${operation} has no compatible request witness`);
    }
    const request = baseRequestV1(context, strictCryptoCapability);
    for (const key of CONFORMANCE_REPLAY_KEYS_V1) {
      if (Object.hasOwn(witness.request, key)) {
        request[key] = jsonClone(witness.request[key]);
      }
    }
    if (innerOperation === "input-extra-field") {
      request.unexpected = jsonClone(witness.request.unexpected);
    }
    if (innerOperation === "input-plain-validation-dto") {
      request.targetDiscoveryPoint = jsonClone(
        witness.request.targetDiscoveryPoint,
      );
    }
    return materializedDataV1(definition, request);
  }
  if (recipe.kind === "hostile_input") {
    return prepareRuntimeHostileV1(
      definition,
      context,
      recipe.profile,
      strictCryptoCapability,
    );
  }
  if (recipe.kind !== "replace_artifacts") {
    throw new TypeError(`${operation} has an unknown compatible recipe`);
  }
  const request = baseRequestV1(context, strictCryptoCapability);
  for (const key of [
    "semanticProviderPolicy",
    "runtimeAttestation",
    "realFilesystemConformanceResult",
    "realFilesystemConformanceResultLocator",
    "realFilesystemConformanceResultPin",
  ]) {
    const replacement = recipe[key];
    if (replacement !== undefined) {
      request[key] = parseCanonicalRecipeJsonV1(replacement);
    }
  }
  return materializedDataV1(definition, request);
}

function unsignedEvidenceFromBaseV1(context) {
  const unsigned = jsonClone(
    context.compatibleBase.providerFeasibilityEvidence.payload,
  );
  delete unsigned.qaSignature;
  delete unsigned.releaseSignature;
  return unsigned;
}

function finalizeEvidenceV1(context, unsignedDraft, options = {}) {
  const draft = jsonClone(unsignedDraft);
  const {
    profile: _profile,
    evidenceId: _oldEvidenceId,
    ...evidenceIdFields
  } = draft;
  draft.evidenceId = deriveProviderFeasibilityEvidenceIdV1(evidenceIdFields);
  const unsigned = ProviderFeasibilityEvidenceUnsignedClaimsV1Schema.parse(
    draft,
  );
  const qaMessage =
    options.qaMessage ??
    createProviderFeasibilityEvidenceQaSignatureMessageV1(
      unsigned,
      context.qaApproverPublicKey.keyId,
    );
  const releaseMessage =
    options.releaseMessage ??
    createProviderFeasibilityEvidenceReleaseSignatureMessageV1(
      unsigned,
      context.releaseApproverPublicKey.keyId,
    );
  const payload = ProviderFeasibilityEvidenceV1Schema.parse({
    ...unsigned,
    qaSignature: evidenceSignatureV1(
      "qa",
      context.qaApproverPublicKey.keyId,
      options.qaSignerSeedHex ?? QA_APPROVER_SEED_HEX,
      qaMessage,
    ),
    releaseSignature: evidenceSignatureV1(
      "release",
      context.releaseApproverPublicKey.keyId,
      options.releaseSignerSeedHex ?? RELEASE_APPROVER_SEED_HEX,
      releaseMessage,
    ),
  });
  const envelope = ProviderFeasibilityEvidenceEnvelopeV1Schema.parse({
    schemaVersion: 1,
    recordType: "provider_feasibility_evidence",
    evidenceId: payload.evidenceId,
    contentDigest: deriveProviderFeasibilityEvidenceContentDigestV1(payload),
    payload,
  });
  return Object.freeze({
    envelope,
    pin: deriveProviderFeasibilityEvidencePinV1(envelope),
  });
}

function finalizeConformanceResultVariantV1(context, result) {
  if (result !== "failed" && result !== "unsupported") {
    throw new TypeError("production result variant must be failed or unsupported");
  }
  const draft = jsonClone(
    context.compatibleBase.realFilesystemConformanceResult.payload,
  );
  const firstCaseResult = draft.caseResults[0];
  if (firstCaseResult === undefined) {
    throw new TypeError("compatible result lost its first case result");
  }
  firstCaseResult.outcome = result;
  firstCaseResult.resultCode =
    result === "failed"
      ? "assertion_failed"
      : "unsupported_by_target_profile";
  draft.result = result;
  const {
    profile: _profile,
    resultId: _oldResultId,
    ...resultIdFields
  } = draft;
  const resultId =
    deriveProviderRealFilesystemConformanceResultIdV1(resultIdFields);
  const payload = ProviderRealFilesystemConformanceResultV1Schema.parse({
    ...resultIdFields,
    profile: "provider_real_fs_conformance_result_v1",
    resultId,
  });
  const envelope =
    ProviderRealFilesystemConformanceResultEnvelopeV1Schema.parse({
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
  return Object.freeze({ envelope, locator, pin });
}

function finalizeRuntimeForResultV1(context, resultEnvelope) {
  const draft = jsonClone(context.compatibleBase.runtimeAttestation.payload);
  delete draft.registrySignature;
  draft.realFilesystemConformanceResultDigest = resultEnvelope.contentDigest;
  const message =
    createStoreDurableObjectProviderRuntimeAttestationSignatureMessageV1(
      draft,
      context.compatibleBase.activeRoot.rootKeyId,
    );
  const payload = StoreDurableObjectProviderRuntimeAttestationV1Schema.parse({
    ...draft,
    registrySignature: registrySignatureV1(
      context.compatibleBase.activeRoot.rootKeyId,
      ROOT_3_SEED_HEX,
      message,
    ),
  });
  return StoreDurableObjectProviderRuntimeAttestationPinV1Schema.parse({
    profile: "store_durable_object_provider_runtime_attestation_pin_v1",
    contentDigest:
      deriveStoreDurableObjectProviderRuntimeAttestationContentDigestV1(
        payload,
      ),
    payload,
  });
}

export function materializeProviderRegistryEvidenceBindingEvidenceAdapterProductionResultVariantV1(
  {
    context,
    result,
    strictCryptoCapability,
  },
) {
  const conformanceResult = finalizeConformanceResultVariantV1(
    context,
    result,
  );
  const runtimeAttestation = finalizeRuntimeForResultV1(
    context,
    conformanceResult.envelope,
  );
  const evidenceUnsigned = unsignedEvidenceFromBaseV1(context);
  evidenceUnsigned.realFilesystemConformanceResult = jsonClone(
    conformanceResult.pin,
  );
  evidenceUnsigned.realFilesystemConformanceResultDigest =
    conformanceResult.envelope.contentDigest;
  evidenceUnsigned.runtimeAttestationContentDigest =
    runtimeAttestation.contentDigest;
  evidenceUnsigned.result = result;
  const evidence = finalizeEvidenceV1(context, evidenceUnsigned);
  const reanchored = reanchorCompatibleBaseCandidateForGenerator({
    compatibleBase: context.compatibleBase,
    providerFeasibilityEvidencePin: evidence.pin,
    runtimeAttestation,
  });
  const request = requestFromCompatibleBase(
    reanchored.compatibleBase,
    strictCryptoCapability,
  );
  request.realFilesystemConformanceResult = jsonClone(
    conformanceResult.envelope,
  );
  request.realFilesystemConformanceResultLocator = jsonClone(
    conformanceResult.locator,
  );
  request.realFilesystemConformanceResultPin = jsonClone(
    conformanceResult.pin,
  );
  request.runtimeAttestation = jsonClone(runtimeAttestation);
  request.providerFeasibilityEvidence = jsonClone(evidence.envelope);
  request.providerFeasibilityEvidencePin = jsonClone(evidence.pin);
  return Object.freeze({
    result,
    request,
  });
}

const SUCCESSOR_QA_APPROVER_SEED_HEX_V1 = "7d".repeat(32);
const SUCCESSOR_RELEASE_APPROVER_SEED_HEX_V1 = "7e".repeat(32);

function requestWithDetachedArtifactsV1(
  compatibleBase,
  strictCryptoCapability,
  artifacts = {},
) {
  const request = requestFromCompatibleBase(
    compatibleBase,
    strictCryptoCapability,
  );
  for (const [key, value] of Object.entries(artifacts)) {
    request[key] = jsonClone(value);
  }
  return request;
}

function rotatedApproverSuccessorV1(context, revokedRole) {
  const activeRoot = context.compatibleBase.activeRoot;
  const qaSuccessor = buildProviderFeasibilityApproverRecordForGenerator({
    role: "qa",
    seedHex: SUCCESSOR_QA_APPROVER_SEED_HEX_V1,
    distributionRegistryGenerationIntroduced: 8,
    activeRoot,
  });
  const releaseSuccessor =
    buildProviderFeasibilityApproverRecordForGenerator({
      role: "release",
      seedHex: SUCCESSOR_RELEASE_APPROVER_SEED_HEX_V1,
      distributionRegistryGenerationIntroduced: 8,
      activeRoot,
    });
  const currentEntry = findNativeBEntryV1(context.compatibleBase);
  const records = [
    ...jsonClone(
      currentEntry.feasibilityApprovalKeys.publicKeyRecords,
    ),
    qaSuccessor,
    releaseSuccessor,
  ].sort((left, right) => {
    const leftKey = `${left.role}\u0000${left.keyId}`;
    const rightKey = `${right.role}\u0000${right.keyId}`;
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  });
  const revoked = [];
  if (revokedRole !== undefined) {
    revoked.push(
      revokedRole === "qa"
        ? context.qaApproverPublicKey.keyId
        : context.releaseApproverPublicKey.keyId,
    );
  }
  const feasibilityApprovalKeys = {
    profile: "provider_feasibility_approval_keys_v1",
    activeKeyIds: {
      qa: qaSuccessor.keyId,
      release: releaseSuccessor.keyId,
    },
    publicKeyRecords: records,
    compromisedRevokedKeyIds: revoked.sort(),
  };
  return appendCompatibleBaseEntrySuccessorForGenerator({
    compatibleBase: context.compatibleBase,
    entryOverrides: { feasibilityApprovalKeys },
  });
}

function runtimeSuccessorV1(context) {
  const draft = jsonClone(context.compatibleBase.runtimeAttestation.payload);
  delete draft.registrySignature;
  draft.ipcEndpointAttestationDigest = digestV1("7");
  draft.attestationGeneration += 1;
  draft.issuedAt = "2026-08-05T04:00:00Z";
  const message =
    createStoreDurableObjectProviderRuntimeAttestationSignatureMessageV1(
      draft,
      context.compatibleBase.activeRoot.rootKeyId,
    );
  const payload = StoreDurableObjectProviderRuntimeAttestationV1Schema.parse({
    ...draft,
    registrySignature: registrySignatureV1(
      context.compatibleBase.activeRoot.rootKeyId,
      ROOT_3_SEED_HEX,
      message,
    ),
  });
  return StoreDurableObjectProviderRuntimeAttestationPinV1Schema.parse({
    profile: "store_durable_object_provider_runtime_attestation_pin_v1",
    contentDigest:
      deriveStoreDurableObjectProviderRuntimeAttestationContentDigestV1(
        payload,
      ),
    payload,
  });
}

function evidenceWithOverridesV1(context, overrides) {
  const unsigned = unsignedEvidenceFromBaseV1(context);
  Object.assign(unsigned, jsonClone(overrides));
  return finalizeEvidenceV1(context, unsigned);
}

function materializePointSpecificPositiveGenesisV1(
  context,
  strictCryptoCapability,
) {
  return { request: baseRequestV1(context, strictCryptoCapability) };
}

function materializePointSpecificHistoricalApproverV1(
  context,
  strictCryptoCapability,
) {
  const successor = rotatedApproverSuccessorV1(context);
  return {
    request: requestWithDetachedArtifactsV1(
      successor.compatibleBase,
      strictCryptoCapability,
    ),
  };
}

function materializePointSpecificRuntimeSuccessorV1(
  context,
  strictCryptoCapability,
) {
  const runtimeAttestation = runtimeSuccessorV1(context);
  const evidence = evidenceWithOverridesV1(context, {
    runtimeAttestationContentDigest: runtimeAttestation.contentDigest,
    issuedAt: runtimeAttestation.payload.issuedAt,
  });
  const successor = appendCompatibleBaseEntrySuccessorForGenerator({
    compatibleBase: context.compatibleBase,
    entryOverrides: {
      providerFeasibilityEvidence: evidence.pin,
      runtimeAttestation,
    },
  });
  return {
    request: requestWithDetachedArtifactsV1(
      successor.compatibleBase,
      strictCryptoCapability,
      {
        providerFeasibilityEvidence: evidence.envelope,
        providerFeasibilityEvidencePin: evidence.pin,
        runtimeAttestation,
      },
    ),
  };
}

function materializePointSpecificBootstrapPinV1(
  context,
  strictCryptoCapability,
) {
  const request = baseRequestV1(context, strictCryptoCapability);
  request.distributionRootBinding.bootstrapTrustBundle.contentDigest =
    digestV1("0");
  return { request };
}

function materializePointSpecificBootstrapSchemaV1(
  context,
  strictCryptoCapability,
) {
  const request = baseRequestV1(context, strictCryptoCapability);
  delete request.bootstrapTrustBundle.providerTrustHistoryPolicy;
  return { request };
}

function materializePointSpecificRootRecordV1(
  context,
  strictCryptoCapability,
) {
  const request = baseRequestV1(context, strictCryptoCapability);
  request.activeRoot.publicKeyDigest = digestV1("0");
  return { request };
}

function materializePointSpecificCandidateIdentityV1(
  context,
  strictCryptoCapability,
) {
  const identity = otherStringV1(
    context.compatibleBase.installationIdentityGenerationId,
  );
  const reanchored = reanchorCompatibleBaseCandidateForGenerator({
    compatibleBase: context.compatibleBase,
    entryOverrides: { installationIdentityGenerationId: identity },
  });
  return {
    request: requestWithDetachedArtifactsV1(
      reanchored.compatibleBase,
      strictCryptoCapability,
    ),
  };
}

function materializePointSpecificMigrationTipV1(
  context,
  strictCryptoCapability,
) {
  const compatibleBase = {
    ...jsonClone(context.compatibleBase),
    registryManifestHistory: jsonClone(
      context.compatibleBase.registryManifestHistory.slice(0, 5),
    ),
  };
  return {
    request: requestWithDetachedArtifactsV1(
      compatibleBase,
      strictCryptoCapability,
    ),
  };
}

function materializePointSpecificProviderSelectorV1(
  context,
  strictCryptoCapability,
  providerId,
) {
  const evidence = evidenceWithOverridesV1(context, { providerId });
  const request = baseRequestV1(context, strictCryptoCapability);
  request.providerFeasibilityEvidence = jsonClone(evidence.envelope);
  request.providerFeasibilityEvidencePin = jsonClone(evidence.pin);
  return { request };
}

function materializePointSpecificEntryEvidencePinV1(
  context,
  strictCryptoCapability,
) {
  const request = baseRequestV1(context, strictCryptoCapability);
  request.providerFeasibilityEvidencePin.contentDigest = digestV1("0");
  return { request };
}

function materializePointSpecificEntryRuntimeV1(
  context,
  strictCryptoCapability,
) {
  const request = baseRequestV1(context, strictCryptoCapability);
  request.runtimeAttestation.contentDigest = digestV1("0");
  return { request };
}

function materializePointSpecificEntryPolicyV1(
  context,
  strictCryptoCapability,
) {
  const reanchored = reanchorCompatibleBaseCandidateForGenerator({
    compatibleBase: context.compatibleBase,
    semanticProviderPolicyDigest: digestV1("0"),
  });
  return {
    request: requestWithDetachedArtifactsV1(
      reanchored.compatibleBase,
      strictCryptoCapability,
    ),
  };
}

function materializePointSpecificStaleEvidenceV1(
  context,
  strictCryptoCapability,
) {
  const evidence = evidenceWithOverridesV1(context, {
    issuedAt: "2026-08-05T04:00:00Z",
  });
  const request = baseRequestV1(context, strictCryptoCapability);
  request.providerFeasibilityEvidence = jsonClone(evidence.envelope);
  request.providerFeasibilityEvidencePin = jsonClone(evidence.pin);
  return { request };
}

function materializePointSpecificCrossMismatchV1(
  context,
  strictCryptoCapability,
) {
  const evidence = evidenceWithOverridesV1(context, {
    implementationDigest: digestV1("0"),
  });
  return {
    request: requestWithEvidenceV1(
      context,
      strictCryptoCapability,
      evidence,
    ),
  };
}

function materializePointSpecificRevokedApproverV1(
  context,
  strictCryptoCapability,
  role,
) {
  const successor = rotatedApproverSuccessorV1(context, role);
  return {
    request: requestWithDetachedArtifactsV1(
      successor.compatibleBase,
      strictCryptoCapability,
    ),
  };
}

function materializePointSpecificSignatureBindingV1(
  context,
  strictCryptoCapability,
  role,
  mode,
) {
  const request = baseRequestV1(context, strictCryptoCapability);
  const field = role === "qa" ? "qaSignature" : "releaseSignature";
  const signature = request.providerFeasibilityEvidence.payload[field];
  if (mode === "unknown") {
    const parts = signature.split(":");
    parts[2] = "0".repeat(22);
    request.providerFeasibilityEvidence.payload[field] = parts.join(":");
  } else {
    request.providerFeasibilityEvidence.payload[field] = signature.replace(
      `:${role}:`,
      `:${role === "qa" ? "release" : "qa"}:`,
    );
  }
  return { request };
}

function materializePointSpecificTopLevelProxyV1(
  context,
  strictCryptoCapability,
) {
  return {
    request: new Proxy(baseRequestV1(context, strictCryptoCapability), {}),
  };
}

function materializePointSpecificCrossHistoryAliasV1(
  context,
  strictCryptoCapability,
) {
  const request = baseRequestV1(context, strictCryptoCapability);
  request.rootMetadataHistory[0] = request.registryManifestHistory[0];
  return { request };
}

function materializePointSpecificAsyncMutationV1(
  context,
  strictCryptoCapability,
  target,
) {
  const request = baseRequestV1(context, strictCryptoCapability);
  return {
    request,
    mutateAfterStart() {
      if (target === "evidence") {
        request.providerFeasibilityEvidence.payload.result = "failed";
      } else {
        request.registryManifestHistory.length = 0;
      }
    },
  };
}

const POINT_SPECIFIC_VARIANT_HANDLERS_V1 = Object.freeze({
  positive_genesis_entry_passed: materializePointSpecificPositiveGenesisV1,
  positive_historical_unrevoked_approver:
    materializePointSpecificHistoricalApproverV1,
  positive_runtime_evidence_entry_successor:
    materializePointSpecificRuntimeSuccessorV1,
  bootstrap_bundle_pin_mismatch: materializePointSpecificBootstrapPinV1,
  bootstrap_bundle_schema_invalid: materializePointSpecificBootstrapSchemaV1,
  candidate_root_record_mismatch: materializePointSpecificRootRecordV1,
  candidate_identity_mismatch: materializePointSpecificCandidateIdentityV1,
  routing_migration_tip: materializePointSpecificMigrationTipV1,
  provider_absent(context, capability) {
    return materializePointSpecificProviderSelectorV1(
      context,
      capability,
      "durable-object-provider:absent",
    );
  },
  provider_tombstone(context, capability) {
    return materializePointSpecificProviderSelectorV1(
      context,
      capability,
      "durable-object-provider:native-a",
    );
  },
  entry_evidence_pin_substitution: materializePointSpecificEntryEvidencePinV1,
  entry_runtime_pin_substitution: materializePointSpecificEntryRuntimeV1,
  entry_policy_digest_substitution: materializePointSpecificEntryPolicyV1,
  entry_successor_stale_evidence_pin: materializePointSpecificStaleEvidenceV1,
  valid_resign_result_cross_mismatch: materializePointSpecificCrossMismatchV1,
  qa_unknown_signer(context, capability) {
    return materializePointSpecificSignatureBindingV1(
      context,
      capability,
      "qa",
      "unknown",
    );
  },
  release_unknown_signer(context, capability) {
    return materializePointSpecificSignatureBindingV1(
      context,
      capability,
      "release",
      "unknown",
    );
  },
  qa_revoked_historical_signer(context, capability) {
    return materializePointSpecificRevokedApproverV1(
      context,
      capability,
      "qa",
    );
  },
  release_revoked_historical_signer(context, capability) {
    return materializePointSpecificRevokedApproverV1(
      context,
      capability,
      "release",
    );
  },
  qa_wrong_role_signer(context, capability) {
    return materializePointSpecificSignatureBindingV1(
      context,
      capability,
      "qa",
      "wrong_role",
    );
  },
  release_wrong_role_signer(context, capability) {
    return materializePointSpecificSignatureBindingV1(
      context,
      capability,
      "release",
      "wrong_role",
    );
  },
  hostile_top_level_proxy: materializePointSpecificTopLevelProxyV1,
  cross_history_alias: materializePointSpecificCrossHistoryAliasV1,
  after_start_evidence_mutation(context, capability) {
    return materializePointSpecificAsyncMutationV1(
      context,
      capability,
      "evidence",
    );
  },
  after_start_history_mutation(context, capability) {
    return materializePointSpecificAsyncMutationV1(
      context,
      capability,
      "history",
    );
  },
  promise_poison(context, capability) {
    return {
      request: baseRequestV1(context, capability),
      poisonPromiseBeforeStart: true,
    };
  },
});

export function materializeProviderRegistryEvidenceBindingPointSpecificVariantForGeneratorV1(
  {
    context,
    profile,
    strictCryptoCapability,
  },
) {
  const handler = POINT_SPECIFIC_VARIANT_HANDLERS_V1[profile];
  if (handler === undefined) {
    throw new TypeError(`unknown point-specific profile ${profile}`);
  }
  return Object.freeze({
    profile,
    ...handler(context, strictCryptoCapability),
  });
}

function requestWithEvidenceV1(
  context,
  strictCryptoCapability,
  evidence,
) {
  const reanchored = reanchorCompatibleBaseCandidateForGenerator({
    compatibleBase: context.compatibleBase,
    providerFeasibilityEvidencePin: evidence.pin,
  });
  const request = requestFromCompatibleBase(
    reanchored.compatibleBase,
    strictCryptoCapability,
  );
  request.providerFeasibilityEvidence = jsonClone(evidence.envelope);
  request.providerFeasibilityEvidencePin = jsonClone(evidence.pin);
  return request;
}

const EVIDENCE_STRUCTURE_MUTATIONS_V1 = Object.freeze({
  "evidence-envelope-schema-version-invalid"(envelope) {
    envelope.schemaVersion = 2;
  },
  "evidence-envelope-record-type-invalid"(envelope) {
    envelope.recordType = "provider_feasibility_evidence_v2";
  },
  "evidence-envelope-extra-field"(envelope) {
    envelope.unexpected = true;
  },
  "evidence-payload-profile-invalid"(envelope) {
    envelope.payload.profile = "provider_feasibility_evidence_v2";
  },
  "evidence-payload-required-field-missing"(envelope) {
    delete envelope.payload.issuedAt;
  },
  "evidence-payload-extra-field"(envelope) {
    envelope.payload.volumePath = "/private/provider";
  },
  "evidence-qa-signature-format-invalid"(envelope) {
    envelope.payload.qaSignature = "not-a-qa-signature";
  },
  "evidence-release-signature-format-invalid"(envelope) {
    envelope.payload.releaseSignature = "not-a-release-signature";
  },
  "evidence-payload-not-object"(envelope) {
    envelope.payload = null;
  },
});

const EVIDENCE_PIN_STRUCTURE_MUTATIONS_V1 = Object.freeze({
  "evidence-pin-profile-invalid"(pin) {
    pin.locatorProfile =
      "installation_provider_feasibility_evidence_v2";
  },
  "evidence-pin-evidence-id-missing"(pin) {
    delete pin.evidenceId;
  },
  "evidence-pin-content-digest-missing"(pin) {
    delete pin.contentDigest;
  },
  "evidence-pin-extra-field"(pin) {
    pin.latest = true;
  },
});

function mutableNativeBTipEntryV1(request) {
  const tip = request.registryManifestHistory.at(-1);
  const member = tip?.payload.members.find(
    (candidate) =>
      candidate.providerId === NATIVE_B_PROVIDER_ID &&
      candidate.disposition === "enabled",
  );
  if (member === undefined) {
    throw new TypeError("compatible request lost native-b tip member");
  }
  return member.registryEntry;
}

function mutableApproverRecordV1(request, role) {
  return findApproverRecordV1(mutableNativeBTipEntryV1(request), role);
}

function approverSignatureRootKeyIdV1(record) {
  const fields = record.registrySignature.split(":");
  if (fields.length !== 3 || fields[0] !== "provider-registry-ed25519") {
    throw new TypeError("compatible approver signature wire drifted");
  }
  return fields[1];
}

function resignApproverRecordV1(record, seedHex, message) {
  record.registrySignature = registrySignatureV1(
    approverSignatureRootKeyIdV1(record),
    seedHex,
    message,
  );
}

const APPROVER_HISTORY_MUTATIONS_V1 = Object.freeze({
  "qa-key-profile-invalid"(request) {
    mutableApproverRecordV1(request, "qa").profile =
      "provider_feasibility_approver_public_key_v2";
  },
  "qa-key-generation-zero"(request) {
    mutableApproverRecordV1(
      request,
      "qa",
    ).distributionRegistryGenerationIntroduced = 0;
  },
  "qa-key-algorithm-invalid"(request) {
    mutableApproverRecordV1(request, "qa").algorithm = "rsa";
  },
  "qa-key-public-bytes-invalid"(request) {
    mutableApproverRecordV1(request, "qa").publicKeyBytes =
      "base64url:AAAA";
  },
  "qa-key-registry-signature-format-invalid"(request) {
    mutableApproverRecordV1(request, "qa").registrySignature =
      "not-a-registry-signature";
  },
  "qa-key-extra-field"(request) {
    mutableApproverRecordV1(request, "qa").current = true;
  },
  "release-key-profile-invalid"(request) {
    mutableApproverRecordV1(request, "release").profile =
      "provider_feasibility_approver_public_key_v2";
  },
  "release-key-generation-zero"(request) {
    mutableApproverRecordV1(
      request,
      "release",
    ).distributionRegistryGenerationIntroduced = 0;
  },
  "release-key-algorithm-invalid"(request) {
    mutableApproverRecordV1(request, "release").algorithm = "rsa";
  },
  "release-key-public-bytes-invalid"(request) {
    mutableApproverRecordV1(request, "release").publicKeyBytes =
      "base64url:AAAA";
  },
  "release-key-registry-signature-format-invalid"(request) {
    mutableApproverRecordV1(request, "release").registrySignature =
      "not-a-registry-signature";
  },
  "release-key-extra-field"(request) {
    mutableApproverRecordV1(request, "release").current = true;
  },
  "qa-key-role-key-id-compound"(request) {
    const record = mutableApproverRecordV1(request, "qa");
    record.role = "release";
    record.keyId = "0".repeat(22);
  },
  "qa-key-id-mismatch"(request) {
    mutableApproverRecordV1(request, "qa").keyId = "0".repeat(22);
  },
  "qa-key-id-digest-compound"(request) {
    const record = mutableApproverRecordV1(request, "qa");
    record.keyId = "0".repeat(22);
    record.publicKeyDigest = digestV1("0");
  },
  "qa-key-digest-mismatch"(request) {
    mutableApproverRecordV1(request, "qa").publicKeyDigest = digestV1("0");
  },
  "release-key-role-key-id-compound"(request) {
    const record = mutableApproverRecordV1(request, "release");
    record.role = "qa";
    record.keyId = "0".repeat(22);
  },
  "release-key-id-mismatch"(request) {
    mutableApproverRecordV1(request, "release").keyId = "0".repeat(22);
  },
  "release-key-id-digest-compound"(request) {
    const record = mutableApproverRecordV1(request, "release");
    record.keyId = "0".repeat(22);
    record.publicKeyDigest = digestV1("0");
  },
  "release-key-digest-mismatch"(request) {
    mutableApproverRecordV1(request, "release").publicKeyDigest =
      digestV1("0");
  },
  "approver-qa-release-material-alias"(request) {
    const qa = mutableApproverRecordV1(request, "qa");
    const release = mutableApproverRecordV1(request, "release");
    release.keyId = qa.keyId;
    release.publicKeyBytes = qa.publicKeyBytes;
    release.publicKeyDigest = qa.publicKeyDigest;
  },
  "approver-qa-root-material-alias"(request) {
    const qa = mutableApproverRecordV1(request, "qa");
    qa.publicKeyBytes = request.activeRoot.publicKeyBytes;
    qa.publicKeyDigest = request.activeRoot.publicKeyDigest;
    qa.keyId = request.activeRoot.rootKeyId;
  },
  "approver-release-root-material-alias"(request) {
    const release = mutableApproverRecordV1(request, "release");
    release.publicKeyBytes = request.activeRoot.publicKeyBytes;
    release.publicKeyDigest = request.activeRoot.publicKeyDigest;
    release.keyId = request.activeRoot.rootKeyId;
  },
  "qa-key-root-mismatch"(request) {
    const record = mutableApproverRecordV1(request, "qa");
    const rootKeyId = approverSignatureRootKeyIdV1(record);
    record.registrySignature = record.registrySignature.replace(
      `:${rootKeyId}:`,
      `:${"0".repeat(22)}:`,
    );
  },
  "release-key-root-mismatch"(request) {
    const record = mutableApproverRecordV1(request, "release");
    const rootKeyId = approverSignatureRootKeyIdV1(record);
    record.registrySignature = record.registrySignature.replace(
      `:${rootKeyId}:`,
      `:${"0".repeat(22)}:`,
    );
  },
  "qa-key-point-invalid"(request) {
    mutableApproverRecordV1(request, "qa").publicKeyBytes =
      INVALID_POINT_PUBLIC_KEY_BYTES_V1;
  },
  "release-key-point-invalid"(request) {
    mutableApproverRecordV1(request, "release").publicKeyBytes =
      INVALID_POINT_PUBLIC_KEY_BYTES_V1;
  },
  "qa-key-signature-bitflip"(request) {
    const record = mutableApproverRecordV1(request, "qa");
    record.registrySignature = bitflipSignatureV1(record.registrySignature);
  },
  "qa-key-signature-wrong-signer"(request) {
    const record = mutableApproverRecordV1(request, "qa");
    const rootKeyId = approverSignatureRootKeyIdV1(record);
    resignApproverRecordV1(
      record,
      WRONG_SIGNER_SEED_HEX_V1,
      createProviderFeasibilityApproverPublicKeySignatureMessageV1(
        record,
        rootKeyId,
      ),
    );
  },
  "qa-key-signature-wrong-domain"(request) {
    const record = mutableApproverRecordV1(request, "qa");
    resignApproverRecordV1(
      record,
      ROOT_3_SEED_HEX,
      canonicalizeJcsSafeIntegerUtf8V1([
        "provider-feasibility-approver-public-key-signature-wrong-domain-v1",
        record,
      ]),
    );
  },
  "release-key-signature-bitflip"(request) {
    const record = mutableApproverRecordV1(request, "release");
    record.registrySignature = bitflipSignatureV1(record.registrySignature);
  },
  "release-key-signature-wrong-signer"(request) {
    const record = mutableApproverRecordV1(request, "release");
    const rootKeyId = approverSignatureRootKeyIdV1(record);
    resignApproverRecordV1(
      record,
      WRONG_SIGNER_SEED_HEX_V1,
      createProviderFeasibilityApproverPublicKeySignatureMessageV1(
        record,
        rootKeyId,
      ),
    );
  },
  "release-key-signature-wrong-domain"(request) {
    const record = mutableApproverRecordV1(request, "release");
    resignApproverRecordV1(
      record,
      ROOT_3_SEED_HEX,
      canonicalizeJcsSafeIntegerUtf8V1([
        "provider-feasibility-approver-public-key-signature-wrong-domain-v1",
        record,
      ]),
    );
  },
});

const EVIDENCE_UNSIGNED_MUTATIONS_V1 = Object.freeze({
  "evidence-provider-binding-mismatch"(draft) {
    draft.providerId = "durable-object-provider:alternate";
  },
  "evidence-policy-digest-binding-mismatch"(draft) {
    draft.semanticProviderPolicyDigest = digestV1("1");
  },
  "evidence-implementation-binding-mismatch"(draft) {
    draft.implementationDigest = digestV1("1");
  },
  "evidence-binary-binding-mismatch"(draft) {
    draft.binaryAttestationDigest = digestV1("1");
  },
  "evidence-target-profile-id-binding-mismatch"(draft) {
    draft.target.targetProfileId = otherStringV1(draft.target.targetProfileId);
  },
  "evidence-target-os-platform-binding-mismatch"(draft) {
    draft.target.osPlatform =
      draft.target.osPlatform === "darwin" ? "linux" : "darwin";
  },
  "evidence-target-os-family-binding-mismatch"(draft) {
    draft.target.osReleaseFamilyCode = otherStringV1(
      draft.target.osReleaseFamilyCode,
    );
  },
  "evidence-target-os-build-binding-mismatch"(draft) {
    draft.target.osBuildDigest = digestV1("9");
  },
  "evidence-target-architecture-binding-mismatch"(draft) {
    draft.target.architecture =
      draft.target.architecture === "arm64" ? "x86_64" : "arm64";
  },
  "evidence-target-filesystem-profile-binding-mismatch"(draft) {
    draft.target.filesystemProfileCode = otherStringV1(
      draft.target.filesystemProfileCode,
    );
  },
  "evidence-target-filesystem-feature-binding-mismatch"(draft) {
    draft.target.filesystemFeatureProfileDigest = digestV1("9");
  },
  "evidence-target-mount-option-binding-mismatch"(draft) {
    draft.target.mountOptionProfileDigest = digestV1("9");
  },
  "evidence-suite-binding-mismatch"(draft) {
    draft.realFilesystemSuiteDigest = digestV1("1");
  },
  "evidence-fixture-binding-mismatch"(draft) {
    draft.fixtureManifestDigest = digestV1("1");
  },
  "evidence-runner-binding-mismatch"(draft) {
    draft.runnerProfileDigest = digestV1("1");
  },
  "evidence-crash-cut-binding-mismatch"(draft) {
    draft.crashCutCoverageDigest = digestV1("1");
  },
  "evidence-result-binding-mismatch"(draft) {
    draft.result = "failed";
  },
  "evidence-ordinary-result-pin-compound"(draft) {
    draft.providerId = "durable-object-provider:alternate";
    draft.realFilesystemConformanceResult.contentDigest = digestV1("0");
  },
  "evidence-result-pin-mismatch"(draft) {
    draft.realFilesystemConformanceResult.contentDigest = digestV1("0");
  },
  "evidence-result-pin-digest-compound"(draft) {
    draft.realFilesystemConformanceResult.contentDigest = digestV1("0");
    draft.realFilesystemConformanceResultDigest = digestV1("1");
  },
  "evidence-result-digest-mismatch"(draft) {
    draft.realFilesystemConformanceResultDigest = digestV1("1");
  },
  "evidence-policy-isolation-binding-mismatch"(draft) {
    draft.isolationSecurityBoundaryProfileDigest = digestV1("1");
  },
  "evidence-policy-ipc-binding-mismatch"(draft) {
    draft.ipcPeerAuthenticationPolicyDigest = digestV1("1");
  },
  "evidence-policy-suite-binding-mismatch"(draft) {
    draft.realFilesystemSuiteDigest = digestV1("1");
  },
  "evidence-runtime-attestation-digest-mismatch"(draft) {
    draft.runtimeAttestationContentDigest = digestV1("1");
  },
  "evidence-time-before-one-nanosecond"(draft) {
    draft.issuedAt = "2026-08-03T03:59:59.999999999Z";
  },
});

const EVIDENCE_DIRECT_MUTATIONS_V1 = Object.freeze({
  "evidence-id-mismatch"(request) {
    request.providerFeasibilityEvidence.payload.evidenceId =
      `provider-feasibility-evidence:${"0".repeat(22)}`;
  },
  "evidence-qa-signature-key-id-mismatch"(request, context) {
    const payload = request.providerFeasibilityEvidence.payload;
    payload.qaSignature = payload.qaSignature.replace(
      `:qa:${context.qaApproverPublicKey.keyId}:`,
      `:qa:${"0".repeat(22)}:`,
    );
  },
  "evidence-release-signature-key-id-mismatch"(request, context) {
    const payload = request.providerFeasibilityEvidence.payload;
    payload.releaseSignature = payload.releaseSignature.replace(
      `:release:${context.releaseApproverPublicKey.keyId}:`,
      `:release:${"0".repeat(22)}:`,
    );
  },
  "evidence-qa-signature-bitflip"(request) {
    const payload = request.providerFeasibilityEvidence.payload;
    payload.qaSignature = bitflipSignatureV1(payload.qaSignature);
  },
  "evidence-release-signature-bitflip"(request) {
    const payload = request.providerFeasibilityEvidence.payload;
    payload.releaseSignature = bitflipSignatureV1(payload.releaseSignature);
  },
  "evidence-signatures-swapped"(request, context) {
    const payload = request.providerFeasibilityEvidence.payload;
    const qaHex = payload.qaSignature.split(":").at(-1);
    const releaseHex = payload.releaseSignature.split(":").at(-1);
    payload.qaSignature =
      `provider-feasibility-ed25519:qa:${context.qaApproverPublicKey.keyId}:${releaseHex}`;
    payload.releaseSignature =
      `provider-feasibility-ed25519:release:${context.releaseApproverPublicKey.keyId}:${qaHex}`;
  },
});

function signatureReanchorOptionsV1(operation, context, unsigned) {
  const role = operation.includes("-qa-") ? "qa" : "release";
  if (operation.endsWith("wrong-signer")) {
    return role === "qa"
      ? { qaSignerSeedHex: WRONG_SIGNER_SEED_HEX_V1 }
      : { releaseSignerSeedHex: WRONG_SIGNER_SEED_HEX_V1 };
  }
  if (operation.endsWith("wrong-domain")) {
    const message = canonicalizeJcsSafeIntegerUtf8V1([
      `provider-feasibility-evidence-${role}-signature-wrong-domain-v1`,
      unsigned,
    ]);
    return role === "qa" ? { qaMessage: message } : { releaseMessage: message };
  }
  if (operation.endsWith("wrong-role-wrapper")) {
    const message = canonicalizeJcsSafeIntegerUtf8V1([
      role === "qa"
        ? PROVIDER_FEASIBILITY_EVIDENCE_QA_SIGNATURE_DOMAIN_V1
        : PROVIDER_FEASIBILITY_EVIDENCE_RELEASE_SIGNATURE_DOMAIN_V1,
      {
        role: role === "qa" ? "release" : "qa",
        keyId:
          role === "qa"
            ? context.qaApproverPublicKey.keyId
            : context.releaseApproverPublicKey.keyId,
        claims: unsigned,
      },
    ]);
    return role === "qa" ? { qaMessage: message } : { releaseMessage: message };
  }
  throw new TypeError(`unknown Evidence signature reanchor ${operation}`);
}

function materializeEvidenceDirectV1(
  definition,
  context,
  strictCryptoCapability,
) {
  const operation = definition.mutation.recipe.adapterOperation;
  const request = baseRequestV1(context, strictCryptoCapability);
  const structureMutation = EVIDENCE_STRUCTURE_MUTATIONS_V1[operation];
  if (structureMutation !== undefined) {
    structureMutation(request.providerFeasibilityEvidence);
    return materializedDataV1(definition, request);
  }
  const pinMutation = EVIDENCE_PIN_STRUCTURE_MUTATIONS_V1[operation];
  if (pinMutation !== undefined) {
    pinMutation(request.providerFeasibilityEvidencePin);
    return materializedDataV1(definition, request);
  }
  const directMutation = EVIDENCE_DIRECT_MUTATIONS_V1[operation];
  if (directMutation === undefined) {
    throw new TypeError(`unknown direct Evidence operation ${operation}`);
  }
  directMutation(request, context);
  return materializedDataV1(definition, request);
}

function materializeApproverHistoryV1(
  definition,
  context,
  strictCryptoCapability,
) {
  const operation = definition.mutation.recipe.adapterOperation;
  const mutation = APPROVER_HISTORY_MUTATIONS_V1[operation];
  if (mutation === undefined) {
    throw new TypeError(`unknown approver history operation ${operation}`);
  }
  const request = baseRequestV1(context, strictCryptoCapability);
  mutation(request);
  return materializedDataV1(definition, request);
}

function materializeEvidenceUnsignedReanchorV1(
  definition,
  context,
  strictCryptoCapability,
) {
  const operation = definition.mutation.recipe.adapterOperation;
  const mutation = EVIDENCE_UNSIGNED_MUTATIONS_V1[operation];
  if (mutation === undefined) {
    throw new TypeError(`unknown unsigned Evidence operation ${operation}`);
  }
  const unsigned = unsignedEvidenceFromBaseV1(context);
  mutation(unsigned);
  const evidence = finalizeEvidenceV1(context, unsigned);
  return materializedDataV1(
    definition,
    requestWithEvidenceV1(context, strictCryptoCapability, evidence),
  );
}

function materializeEvidenceSignatureReanchorV1(
  definition,
  context,
  strictCryptoCapability,
) {
  const operation = definition.mutation.recipe.adapterOperation;
  const unsigned = unsignedEvidenceFromBaseV1(context);
  const options = signatureReanchorOptionsV1(operation, context, unsigned);
  const evidence = finalizeEvidenceV1(context, unsigned, options);
  return materializedDataV1(
    definition,
    requestWithEvidenceV1(context, strictCryptoCapability, evidence),
  );
}

function materializeEvidenceDirectRegistryReanchorV1(
  definition,
  context,
  strictCryptoCapability,
) {
  const operation = definition.mutation.recipe.adapterOperation;
  const envelope = jsonClone(
    context.compatibleBase.providerFeasibilityEvidence,
  );
  const pin = jsonClone(context.compatibleBase.providerFeasibilityEvidencePin);
  if (operation === "evidence-content-digest-mismatch") {
    envelope.contentDigest = digestV1("0");
    pin.contentDigest = digestV1("0");
  } else if (operation === "evidence-envelope-id-mismatch") {
    envelope.evidenceId =
      `provider-feasibility-evidence:${"0".repeat(22)}`;
    pin.evidenceId = envelope.evidenceId;
  } else if (operation === "evidence-pin-id-mismatch") {
    pin.evidenceId = `provider-feasibility-evidence:${"0".repeat(22)}`;
  } else if (operation === "evidence-pin-digest-mismatch") {
    pin.contentDigest = digestV1("0");
  } else {
    throw new TypeError(`unknown direct reanchor operation ${operation}`);
  }
  return materializedDataV1(
    definition,
    requestWithEvidenceV1(
      context,
      strictCryptoCapability,
      Object.freeze({ envelope, pin }),
    ),
  );
}

function materializePointHostileV1(
  definition,
  context,
  strictCryptoCapability,
) {
  const profile = definition.mutation.recipe.adapterProfile;
  const request = baseRequestV1(context, strictCryptoCapability);
  const envelope = request.providerFeasibilityEvidence;
  const evidence = envelope.payload;
  let getterCalls = 0;
  if (profile === "extra_field") {
    request.unexpected = true;
  } else if (profile === "plain_validation_dto") {
    return materializedExecutionV1(
      definition,
      context,
      { authority: "none_provider_feasibility_evidence_structure_only" },
      () => getterCalls,
    );
  } else if (profile === "top_level_proxy") {
    return materializedExecutionV1(
      definition,
      context,
      new Proxy(request, {}),
      () => getterCalls,
    );
  } else if (profile === "nested_proxy") {
    envelope.payload = new Proxy(evidence, {});
  } else if (profile === "top_level_getter") {
    Object.defineProperty(request, "unexpected", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return true;
      },
    });
  } else if (profile === "nested_getter") {
    Object.defineProperty(evidence, "unexpected", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return true;
      },
    });
  } else if (profile === "top_level_hidden") {
    Object.defineProperty(request, "hidden", {
      enumerable: false,
      value: true,
    });
  } else if (profile === "nested_hidden") {
    Object.defineProperty(evidence, "hidden", {
      enumerable: false,
      value: true,
    });
  } else if (profile === "top_level_symbol") {
    Object.defineProperty(request, Symbol("hostile"), {
      enumerable: true,
      value: true,
    });
  } else if (profile === "nested_symbol") {
    Object.defineProperty(evidence, Symbol("hostile"), {
      enumerable: true,
      value: true,
    });
  } else if (profile === "sparse_array") {
    delete request.targetDiscoveryResult.payload.targets[0];
  } else if (profile === "cycle") {
    evidence.cycle = evidence;
  } else if (profile === "alias") {
    evidence.target = request.realFilesystemConformanceResult.payload.target;
  } else if (profile === "evidence_async_mutation") {
    return materializedExecutionV1(
      definition,
      context,
      request,
      () => getterCalls,
      () => {
        evidence.result = "failed";
      },
    );
  } else if (profile === "pin_async_mutation") {
    return materializedExecutionV1(
      definition,
      context,
      request,
      () => getterCalls,
      () => {
        request.providerFeasibilityEvidencePin.contentDigest = digestV1("0");
      },
    );
  } else if (profile === "qa_key_async_mutation") {
    return materializedExecutionV1(
      definition,
      context,
      request,
      () => getterCalls,
      () => {
        mutableApproverRecordV1(request, "qa").publicKeyDigest = digestV1("0");
      },
    );
  } else if (profile === "release_key_async_mutation") {
    return materializedExecutionV1(
      definition,
      context,
      request,
      () => getterCalls,
      () => {
        mutableApproverRecordV1(request, "release").publicKeyDigest =
          digestV1("0");
      },
    );
  } else {
    throw new TypeError(`unknown point hostile profile ${profile}`);
  }
  return materializedExecutionV1(
    definition,
    context,
    request,
    () => getterCalls,
  );
}

const ADAPTER_RECIPE_HANDLERS_V1 = Object.freeze({
  runtime_inherited: materializeRuntimeInheritedV1,
  evidence_direct: materializeEvidenceDirectV1,
  registry_approver_history: materializeApproverHistoryV1,
  evidence_unsigned_reanchor: materializeEvidenceUnsignedReanchorV1,
  evidence_signature_reanchor: materializeEvidenceSignatureReanchorV1,
  evidence_direct_registry_reanchor:
    materializeEvidenceDirectRegistryReanchorV1,
  point_hostile: materializePointHostileV1,
});

export function materializeProviderRegistryEvidenceBindingEvidenceAdapterCaseV1({
  adapterDefinition,
  context,
  strictCryptoCapability,
}) {
  const handler =
    ADAPTER_RECIPE_HANDLERS_V1[adapterDefinition.mutation.recipe.kind];
  if (handler === undefined) {
    throw new TypeError(`${adapterDefinition.caseId} has an unknown recipe`);
  }
  return handler(adapterDefinition, context, strictCryptoCapability);
}

function defineDiagnosticEvidenceAdapterRowV1(
  sourceIndex,
  sourceCaseId,
  sourceOperation,
  recipeKind,
  adapterOperation,
  adapterProfile,
  sourceStage,
  sourceReason,
  sourcePointAdmissionCount,
  sourceSignatureVerificationCount,
  sourceMaterializedRequestSemanticDigest,
  outerStage,
  outerReason,
  outerPointAdmissionCount,
  outerSignatureVerificationCount,
  outerMaterializedRequestSemanticDigest,
) {
  const caseId = `evidence-${sourceCaseId}`;
  return Object.freeze({
    sourceResource: Object.freeze({ ...SOURCE_RESOURCE_ANCHOR_V1 }),
    sourceIndex,
    sourceCaseId,
    sourceOperation,
    sourceExpected: Object.freeze({
      kind: "diagnostic",
      stage: sourceStage,
      reason: sourceReason,
      pointAdmissionCount: sourcePointAdmissionCount,
      signatureVerificationCount: sourceSignatureVerificationCount,
      materializedRequestSemanticDigest:
        sourceMaterializedRequestSemanticDigest,
    }),
    caseId,
    mutation: Object.freeze({
      operation: caseId,
      recipe: Object.freeze({
        kind: recipeKind,
        sourceResourcePath:
          PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_RESOURCE_PATH_V1,
        sourceIndex,
        sourceCaseId,
        sourceOperation,
        adapterOperation,
        ...(adapterProfile === undefined ? {} : { adapterProfile }),
      }),
    }),
    outerExpected: Object.freeze({
      kind: "diagnostic",
      stage: outerStage,
      reason: outerReason,
      pointAdmissionCount: outerPointAdmissionCount,
      signatureVerificationCount: outerSignatureVerificationCount,
      materializedRequestSemanticDigest:
        outerMaterializedRequestSemanticDigest,
    }),
  });
}

const SOURCE_ACCEPTED_SNAPSHOT_PROJECTION_V1 = Object.freeze({
  runtimeAttestationContentDigest:
    "sha256:8d04daab32cf1210f7ba09440f251791d9dadbea07587e6febc553274e4ebf42",
  runtimeAttestationGeneration: 1,
  runtimeIssuedAt: "2026-08-04T04:00:00Z",
  runtimeIpcEndpointAttestationDigest:
    "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
  semanticProviderPolicyDigest:
    "sha256:9b0aa4b1cdb4e64875f22eea2d229ffeae991b29bba823b6c5f1f54433ad81e1",
  filesystemProfileDigest:
    "sha256:7f4608128952195cb5a58adb25d37353d7693081ed4ead221224dce213507e13",
  realFilesystemConformanceResultContentDigest:
    "sha256:c8a39bbd777bfc758ee04b7880e290ba896f020776b1a1cc87aa955fa91c1a0f",
  conformanceCaseResultCount: 8,
  conformancePassedCaseResultCount: 8,
  conformanceFailedCaseResultCount: 0,
  conformanceUnsupportedCaseResultCount: 0,
  evidenceId: "provider-feasibility-evidence:f806cbc11b08c73fb8697f",
  evidenceContentDigest:
    "sha256:42b8382eb460dddc75d8973b95224bd7feae8a04dc482e3db4ad1e61461ceb15",
  evidenceIssuedAt: "2026-08-03T04:00:00Z",
  evidenceResult: "passed",
  qaApproverKeyId: "0b877586ce5bf702118d9f",
  releaseApproverKeyId: "c898c81e885fb4487c8216",
  qaApproverPublicKeyDigest:
    "sha256:9a92d2b54a9a5402de3e65a07a5cb12a8dc6758bd8e8c2ec459563d6b2c081c4",
  releaseApproverPublicKeyDigest:
    "sha256:3097e2dee2cb4a34b53840cdb705aed71067c36f68db0e0f559c3f3fa043315f",
  evidenceRelativePath:
    "provider/feasibility-evidence/id-e1p6utj9chin4bb6clgn6qb2d5m6it3p5lincqb4cln66p9qcos30dj3c9hj2cb260s66dpjcph3gdhp6tj0.json",
});

const OUTER_ACCEPTED_SNAPSHOT_PROJECTION_V1 = Object.freeze({
  installationIdentityGenerationId:
    "installation-identity-generation:bef83ea31792994276733f",
  registryManifestContentDigest:
    "sha256:7d7e8aea91d4e85a5c581940904be70679b9cd4d0090aff352425c8f5667b421",
  candidateRegistryEntryContentDigest:
    "sha256:ab34219f07faa455b0c55d26f61ab53a0c1ce6b02f532b7bfb5486303e8e77a1",
  providerId: "durable-object-provider:native-b",
  runtimeAttestationContentDigest:
    "sha256:9b036f23901e1b90e6142547cb4213f5a4a7eb0b0d3666f5898cc43f45d7bee7",
  evidenceId: "provider-feasibility-evidence:b81040fc62864ca39b8326",
  evidenceContentDigest:
    "sha256:5d0d5f64722a6a6e699d2713ba4d82d81eb3e59758deca2ae86dd5a4fee7ee85",
  evidenceRelativePath:
    "provider/feasibility-evidence/id-e1p6utj9chin4bb6clgn6qb2d5m6it3p5lincqb4cln66p9qc8s32c1k61j66dhi70r38or16csm4e1j68r0.json",
  qaApproverKeyId: "30b0b875a0facf5b962dbf",
  releaseApproverKeyId: "7765facc499aff70a0a44a",
});

function defineAcceptedEvidenceAdapterRowV1(
  sourceIndex,
  sourceCaseId,
  sourceOperation,
  recipeKind,
  adapterOperation,
  adapterProfile,
  sourcePointAdmissionCount,
  sourceSignatureVerificationCount,
  sourceMaterializedRequestSemanticDigest,
  outerPointAdmissionCount,
  outerSignatureVerificationCount,
  outerMaterializedRequestSemanticDigest,
) {
  const caseId = `evidence-${sourceCaseId}`;
  return Object.freeze({
    sourceResource: Object.freeze({ ...SOURCE_RESOURCE_ANCHOR_V1 }),
    sourceIndex,
    sourceCaseId,
    sourceOperation,
    sourceExpected: Object.freeze({
      kind: "accepted_snapshot",
      boundary: "snapshot_stability",
      outcome: "accepted_frozen_snapshot",
      authority: "none_provider_feasibility_evidence_structure_only",
      snapshotProjection: SOURCE_ACCEPTED_SNAPSHOT_PROJECTION_V1,
      pointAdmissionCount: sourcePointAdmissionCount,
      signatureVerificationCount: sourceSignatureVerificationCount,
      materializedRequestSemanticDigest:
        sourceMaterializedRequestSemanticDigest,
    }),
    caseId,
    mutation: Object.freeze({
      operation: caseId,
      recipe: Object.freeze({
        kind: recipeKind,
        sourceResourcePath:
          PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_RESOURCE_PATH_V1,
        sourceIndex,
        sourceCaseId,
        sourceOperation,
        adapterOperation,
        ...(adapterProfile === undefined ? {} : { adapterProfile }),
      }),
    }),
    outerExpected: Object.freeze({
      kind: "accepted_snapshot",
      boundary: "snapshot_stability",
      outcome: "accepted_frozen_snapshot",
      authority: "none_registry_entry_evidence_binding_structure_only",
      snapshotProjection: OUTER_ACCEPTED_SNAPSHOT_PROJECTION_V1,
      pointAdmissionCount: outerPointAdmissionCount,
      signatureVerificationCount: outerSignatureVerificationCount,
      materializedRequestSemanticDigest:
        outerMaterializedRequestSemanticDigest,
    }),
  });
}

/* EXPLICIT_EVIDENCE_ADAPTER_TABLE_START */
export const PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_EVIDENCE_ADAPTER_DEFINITIONS_V1 =
  Object.freeze([
    defineDiagnosticEvidenceAdapterRowV1(0, "runtime-inner-input-extra-field", "runtime-inner-input-extra-field", "runtime_inherited", "inner-input-extra-field", undefined, "input", "schema_invalid", 0, 0, "sha256:637cee326b3c42c7523b228b4f5144c489b00ff8a435c2561eb924dbb1c66ff9", "input", "schema_invalid", 0, 0, "sha256:d6a5cf9e8286b856292bde96f52d3d4aa450269d0257b2158e352fae09ec7c40"),
    defineDiagnosticEvidenceAdapterRowV1(1, "runtime-inner-input-plain-validation-dto", "runtime-inner-input-plain-validation-dto", "runtime_inherited", "inner-input-plain-validation-dto", undefined, "input", "schema_invalid", 0, 0, "sha256:02d2df18a36ebdb1694bb2032fb58653d69cf9d085c61aecdd78b1b482701315", "input", "schema_invalid", 0, 0, "sha256:12b441ecad258ce175597398e0e446c6daac09932450235d13c7e608232cfef2"),
    defineDiagnosticEvidenceAdapterRowV1(2, "runtime-inner-result-extra-signature", "runtime-inner-result-extra-signature", "runtime_inherited", "inner-result-extra-signature", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:1e6229346b54398f1fb05ae8a413e79711ac4db2215af5595d97eae0c31bfb9f", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:4cf511bed1bb91f7738880be19a8e5a5d0f555168aea1c2716e837a29c1f4550"),
    defineDiagnosticEvidenceAdapterRowV1(3, "runtime-inner-source-suite-signature-bitflip", "runtime-inner-source-suite-signature-bitflip", "runtime_inherited", "inner-source-suite-signature-bitflip", undefined, "runtime_attestation_closure", "source_invalid", 2, 4, "sha256:de527a4717ed36af253229fe6df65aa5b36165851d8bcff8aa52caade6a44e2b", "runtime_attestation_closure", "source_invalid", 24, 40, "sha256:5f7a7c0599a48ade3ba1e7625b030e5baf98960286f0338177d03d062d6de1fa"),
    defineDiagnosticEvidenceAdapterRowV1(4, "runtime-inner-target-id-not-recomputed", "runtime-inner-target-id-not-recomputed", "runtime_inherited", "inner-target-id-not-recomputed", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:19aa99741e5180476cfa770ce9e619e3b43d072cd410655e16e4fc018b349476", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:161deeb83449de20ef3136e94cd954bb76df840bc207621a83a46121264dfadb"),
    defineDiagnosticEvidenceAdapterRowV1(5, "runtime-inner-target-not-discovered", "runtime-inner-target-not-discovered", "runtime_inherited", "inner-target-not-discovered", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:a33bf10559c9116292fd2a24c05e7ceb16f377737b22218bc28d68dfccec87e4", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:75a6100995b2932de72077fb309dcbc8140e345490655a7165fdf76cd03d5c43"),
    defineDiagnosticEvidenceAdapterRowV1(6, "runtime-inner-discovery-pin-mismatch", "runtime-inner-discovery-pin-mismatch", "runtime_inherited", "inner-discovery-pin-mismatch", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:cd61d97843454a060b6f9612fba4b69ca80ee27333693396fa8c83dccd7800db", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:ed2dcecefb25932939af4f507f54e76c549f44f79d4b66895c50d367a61ecd10"),
    defineDiagnosticEvidenceAdapterRowV1(7, "runtime-inner-bundle-digest-mismatch", "runtime-inner-bundle-digest-mismatch", "runtime_inherited", "inner-bundle-digest-mismatch", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:29e27eb034f8aedd015550831b38a9e10607637aa9677431d45c2d87a203eba0", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:4407b17f3b52dea816f09251b36f7f9fa1cbbc16e88f2b3d57e530698a3fb7a9"),
    defineDiagnosticEvidenceAdapterRowV1(8, "runtime-inner-suite-pin-mismatch", "runtime-inner-suite-pin-mismatch", "runtime_inherited", "inner-suite-pin-mismatch", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:2094a5263366b6acf82a8e742fb65c58c8da6adf2ca4fc1da2f332347bce714c", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:ef7d8b04f81e141b075afb24662f9f8539649a912f04407bdaabc1f6abc062f2"),
    defineDiagnosticEvidenceAdapterRowV1(9, "runtime-inner-suite-digest-mismatch", "runtime-inner-suite-digest-mismatch", "runtime_inherited", "inner-suite-digest-mismatch", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:49d480df345739d75e81fb0628b01253a2cda38864664ed8cc15f5f04c7304d1", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:7ab8bbd29438217cc532091ceef11c0d51f1e54c797d39a01f10e11a5695eb00"),
    defineDiagnosticEvidenceAdapterRowV1(10, "runtime-inner-fixture-digest-mismatch", "runtime-inner-fixture-digest-mismatch", "runtime_inherited", "inner-fixture-digest-mismatch", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:bba66112021e23e68105b4e83be5a4a75ec23ef6f238b4db85cc63136dc06712", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:57a9cd531f987ff61199668ad7b9e657ebe2d3e4efc03f4f40857ef823900aeb"),
    defineDiagnosticEvidenceAdapterRowV1(11, "runtime-inner-runner-digest-mismatch", "runtime-inner-runner-digest-mismatch", "runtime_inherited", "inner-runner-digest-mismatch", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:e08df2e9139aabb69d508119700c691955cf37548aadff6bef41be38d034b4fa", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:90b41041f78f96c79f8e7d519380ae15707995fbde0258366add5d0b0b50c961"),
    defineDiagnosticEvidenceAdapterRowV1(12, "runtime-inner-crash-cut-digest-mismatch", "runtime-inner-crash-cut-digest-mismatch", "runtime_inherited", "inner-crash-cut-digest-mismatch", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:c47265f5aad67cc65074f9cbea461d55914a09df97342e2ba100ea0f49dc787a", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:0b7ce9d01e3dd7b07ebbe5d721a995d718f9a4450645b2bb361e23e28c0d40ef"),
    defineDiagnosticEvidenceAdapterRowV1(13, "runtime-inner-case-results-reordered", "runtime-inner-case-results-reordered", "runtime_inherited", "inner-case-results-reordered", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:1d7d9683a14645ec448b31ed03c735acd753a49742cdbd35151ca1a4383e7631", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:aefaf47432dced44fc9645f191a523c63930d85db189234b285db58353ccee55"),
    defineDiagnosticEvidenceAdapterRowV1(14, "runtime-inner-case-result-missing", "runtime-inner-case-result-missing", "runtime_inherited", "inner-case-result-missing", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:ce36c7e58697ca8e861009f2f894aa53a10cc070dffa820322f93ab566a9b0e4", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:fa551c37e7fc35c00bd6c318bfebed64b6fc6b28004462b396288eb8ba0c36d4"),
    defineDiagnosticEvidenceAdapterRowV1(15, "runtime-inner-case-result-extra", "runtime-inner-case-result-extra", "runtime_inherited", "inner-case-result-extra", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:b85ef5a5f3a76c4c2fe69303a9e3037ec1daf77b9492fa0b8515052090f083ce", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:1b32a84f84471973d1b5c45fad339163499a555a4d6c34af2a5ae75e8a8532cd"),
    defineDiagnosticEvidenceAdapterRowV1(16, "runtime-inner-case-result-duplicate", "runtime-inner-case-result-duplicate", "runtime_inherited", "inner-case-result-duplicate", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:baaab72b97bf77ec21436d81c93bc0dd36434dfebc4177cf4fa26d74dc6f8dcf", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:39c1d86f51afdb4e75f7255a36962b19a624c04cb9774fcd3337c6bde4ffbc4e"),
    defineDiagnosticEvidenceAdapterRowV1(17, "runtime-inner-passed-code-mismatch", "runtime-inner-passed-code-mismatch", "runtime_inherited", "inner-passed-code-mismatch", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:47c526aca574415226802f0f4d1f025d4ef1e38b23d9a3dbf0cdefeaa6135465", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:31f01116a073123755d2c335416e182a46a621b2c8661e3080cb2ffedc851375"),
    defineDiagnosticEvidenceAdapterRowV1(18, "runtime-inner-unsupported-code-mismatch", "runtime-inner-unsupported-code-mismatch", "runtime_inherited", "inner-unsupported-code-mismatch", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:98469535323f46e1b71504efbbe6b303afe764db20a16582e615ba300f277080", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:204385eaf5efc220cbcdea6f511cda532d0dd6f64819576327b2aa2875aa4480"),
    defineDiagnosticEvidenceAdapterRowV1(19, "runtime-inner-failed-code-mismatch", "runtime-inner-failed-code-mismatch", "runtime_inherited", "inner-failed-code-mismatch", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:37a18359faa7d0497a1856234321d29af8142ae013cc134998ed3ff105fcbef7", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:d4a0b07ab908fb8d5a9102fae09b5bfbc1cd98628791b683d8721f4a500d72f4"),
    defineDiagnosticEvidenceAdapterRowV1(20, "runtime-inner-passed-assertion-failed-code-mismatch", "runtime-inner-passed-assertion-failed-code-mismatch", "runtime_inherited", "inner-passed-assertion-failed-code-mismatch", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:97c490977b877bd5f2f567946d1a33a7af2a856612855bb19c758aa18e69590a", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:90f2fde2ee3beb76f775d0d406fdceddd59aef9871ae6de7b4d6bb02117dd385"),
    defineDiagnosticEvidenceAdapterRowV1(21, "runtime-inner-passed-crash-recovery-failed-code-mismatch", "runtime-inner-passed-crash-recovery-failed-code-mismatch", "runtime_inherited", "inner-passed-crash-recovery-failed-code-mismatch", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:ebb8ef909bd989c227646c9028f87cf79240c3aa2f507728cb86d9c4528375c1", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:26d5a36c89d43360d43664dd6d6e611119154e4a0679d6d3eeca5165d404dfc5"),
    defineDiagnosticEvidenceAdapterRowV1(22, "runtime-inner-passed-identity-discontinuity-code-mismatch", "runtime-inner-passed-identity-discontinuity-code-mismatch", "runtime_inherited", "inner-passed-identity-discontinuity-code-mismatch", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:8d8bb60c408f99a7eeda2116e0f87e7d5fc697ee057c8c1cbe8cf77fa846fa46", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:5d09e2c1b71cc5ef6bed26bb37a4224ec96709581a6b3c7d9be21764b67566aa"),
    defineDiagnosticEvidenceAdapterRowV1(23, "runtime-inner-passed-containment-violation-code-mismatch", "runtime-inner-passed-containment-violation-code-mismatch", "runtime_inherited", "inner-passed-containment-violation-code-mismatch", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:81e5bc493bf70bef99959a837529aabdf4ebb2fd783860ba3876da04c69684f1", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:850a1a2fd60e86753206cc4f20626dc10567ef97bd76b8a1921a18b15f7aae8f"),
    defineDiagnosticEvidenceAdapterRowV1(24, "runtime-inner-passed-unsupported-by-target-profile-code-mismatch", "runtime-inner-passed-unsupported-by-target-profile-code-mismatch", "runtime_inherited", "inner-passed-unsupported-by-target-profile-code-mismatch", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:dbf1d17308569dc110d8f6488feacbcddcec4211996f2bbcab348aee60c34ae4", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:b016e8f527dd1560b7cde862cbc75f1a804737252e0dc831a0d5d1a13304e765"),
    defineDiagnosticEvidenceAdapterRowV1(25, "runtime-inner-unsupported-assertion-failed-code-mismatch", "runtime-inner-unsupported-assertion-failed-code-mismatch", "runtime_inherited", "inner-unsupported-assertion-failed-code-mismatch", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:30d7b5fb97b6192b440224919d4363b7e56b49c3729e6c1d0112b33d516a203e", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:5c7ec0781db1a99cfe87715214cdf855dec2977b3c909bf2db14fd1222f2c6af"),
    defineDiagnosticEvidenceAdapterRowV1(26, "runtime-inner-unsupported-provider-rejected-code-mismatch", "runtime-inner-unsupported-provider-rejected-code-mismatch", "runtime_inherited", "inner-unsupported-provider-rejected-code-mismatch", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:2bc4bcf59dd3798e513200175c1776ece1b9b5c0f373acd2efa62b5dc8c8bcb4", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:1ae7ad5b367cfb2fcf0d7b09257ae87c6ba4742548181f547bf7e7d956ace744"),
    defineDiagnosticEvidenceAdapterRowV1(27, "runtime-inner-unsupported-crash-recovery-failed-code-mismatch", "runtime-inner-unsupported-crash-recovery-failed-code-mismatch", "runtime_inherited", "inner-unsupported-crash-recovery-failed-code-mismatch", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:5360521d3a2465382f463cb9bfb380604373ac72181fc34313225f615f6026dc", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:8663e231a880b8fa87db0cd1613047dcec21ceb85e12902549fec6e0594f5bed"),
    defineDiagnosticEvidenceAdapterRowV1(28, "runtime-inner-unsupported-identity-discontinuity-code-mismatch", "runtime-inner-unsupported-identity-discontinuity-code-mismatch", "runtime_inherited", "inner-unsupported-identity-discontinuity-code-mismatch", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:5aeb72bba578f073d843aba290cc134f2fb8257d6e09ab07fd56ce9b93e0e2e2", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:fdb72f4f04e437e074d03330c614efdb19b4bd08171c5403bf6b605ae2ad85dd"),
    defineDiagnosticEvidenceAdapterRowV1(29, "runtime-inner-unsupported-containment-violation-code-mismatch", "runtime-inner-unsupported-containment-violation-code-mismatch", "runtime_inherited", "inner-unsupported-containment-violation-code-mismatch", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:0920fe5bc13f546de381a7ce095bb0000f6e127881c373dc661a17141fc4f04e", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:8c17cd5c0a1c87820f9d62a59c519f797067d15911d1208d465f28c8135fcc91"),
    defineDiagnosticEvidenceAdapterRowV1(30, "runtime-inner-failed-passed-code-mismatch", "runtime-inner-failed-passed-code-mismatch", "runtime_inherited", "inner-failed-passed-code-mismatch", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:83376fd78e25ee63024ed3ee1f9bcb448de387454508684975037737d918c317", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:590ca67d2fad6073b9538d75bed9d860dacb03a2d7b4e4333ee372a9bd191d5f"),
    defineDiagnosticEvidenceAdapterRowV1(31, "runtime-inner-aggregate-mismatch", "runtime-inner-aggregate-mismatch", "runtime_inherited", "inner-aggregate-mismatch", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:11aff89277bfd69631908bc6ce9ef3f9017d65e864ebd3f417ffc92191ebf205", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:7517f3aa9d85ff8e8922921cecd7fa8c7686494d9a430ef297d7b909e8a3b879"),
    defineDiagnosticEvidenceAdapterRowV1(32, "runtime-inner-result-id-mismatch", "runtime-inner-result-id-mismatch", "runtime_inherited", "inner-result-id-mismatch", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:2c5b9a06922926834e1ffe87fec30729c36da029d2ee126cd7b0d7213706ce3c", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:fdfe383b91a4a3b8e1fa0eeed475c78057f24590ed79dbc275917e54ffe1855b"),
    defineDiagnosticEvidenceAdapterRowV1(33, "runtime-inner-result-content-digest-mismatch", "runtime-inner-result-content-digest-mismatch", "runtime_inherited", "inner-result-content-digest-mismatch", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:1b490509f41e3a200399dd72ca4f4e06da195d9e07899676bda4947363f33fa8", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:5249bb1b2125a51ecc16926df6c230e3363a71d99dc4e7ecd0d4ac949a0256e6"),
    defineDiagnosticEvidenceAdapterRowV1(34, "runtime-inner-result-outer-id-mismatch", "runtime-inner-result-outer-id-mismatch", "runtime_inherited", "inner-result-outer-id-mismatch", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:435be564fbb890413ede0aae1b01f5ca440f12bad90276869256f5e04c47211e", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:9d5783568400f0677c101bfaf1b296ae9ac6543b25789c2b979ba8130ee9faa6"),
    defineDiagnosticEvidenceAdapterRowV1(35, "runtime-inner-locator-profile-mismatch", "runtime-inner-locator-profile-mismatch", "runtime_inherited", "inner-locator-profile-mismatch", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:54b6ef556d51b4e271afe53e8ef9998e5898617a13717410808360ab2e003c92", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:ea334331c75f0064f6402bb6e63567540608269f2fb383e022bb31a10175863c"),
    defineDiagnosticEvidenceAdapterRowV1(36, "runtime-inner-locator-id-mismatch", "runtime-inner-locator-id-mismatch", "runtime_inherited", "inner-locator-id-mismatch", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:5ee5c8419017d4c4850753f4b23743d470f4f96109fe2fa78bf4d2a62ed83858", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:4b43dc0aae58b8c644c825c3011c0d7e61c3c0e9dbf1cd02828ff8fe3bc82fb9"),
    defineDiagnosticEvidenceAdapterRowV1(37, "runtime-inner-pin-content-digest-mismatch", "runtime-inner-pin-content-digest-mismatch", "runtime_inherited", "inner-pin-content-digest-mismatch", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:3a59e676788999e76d9309278052072497eb6d83790ae2c3c98d5698f92bb130", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:cd80bd96daa60899c41c58a9f8d43c08d5e9983d470272cdef53c5795b23a77b"),
    defineDiagnosticEvidenceAdapterRowV1(38, "runtime-inner-result-envelope-16mib-plus-one", "runtime-inner-result-envelope-16mib-plus-one", "runtime_inherited", "inner-result-envelope-16mib-plus-one", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:7aa6558c21ac9c0452f5dfe6983ab59e81435203c361bb226d3309f939ec027c", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:c48fcbab16a0d4de18300df1156d841925c4edd9c0cdb8afea75fb1c53a67768"),
    defineDiagnosticEvidenceAdapterRowV1(39, "runtime-inner-locator-envelope-substitution", "runtime-inner-locator-envelope-substitution", "runtime_inherited", "inner-locator-envelope-substitution", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:ea1fb0c1e6efff7803e46b32dbd7ee4d9141e5ac4e89237f589cdd34360d9bb3", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:094073a4a2641bd7f2905fbe48e4aa6d8c0fc9cc93c5c370a82c6c1853774d24"),
    defineDiagnosticEvidenceAdapterRowV1(40, "runtime-inner-security-top-level-proxy", "runtime-inner-security-top-level-proxy", "runtime_inherited", "inner-security-top-level-proxy", undefined, "input", "schema_invalid", 0, 0, "sha256:e04ee229e1346411ac97b62f80577b10300585047db8e2bc4b230f6d7bb099e0", "input", "schema_invalid", 0, 0, "sha256:aa58435ba282d7a8d7f01f94ba53ad646a67cf7520466fbf2b466e52af4fd22d"),
    defineDiagnosticEvidenceAdapterRowV1(41, "runtime-inner-security-nested-proxy", "runtime-inner-security-nested-proxy", "runtime_inherited", "inner-security-nested-proxy", undefined, "input", "schema_invalid", 0, 0, "sha256:803f676c8a6f60f3e92bb051e7cf3637be96048e3999af74ff5d71e51012a057", "input", "schema_invalid", 0, 0, "sha256:f9b0cd7367a01ce81542e331986ba8fbe957a59eb2352f28c24e63a12a39a0b6"),
    defineDiagnosticEvidenceAdapterRowV1(42, "runtime-inner-security-top-level-getter", "runtime-inner-security-top-level-getter", "runtime_inherited", "inner-security-top-level-getter", undefined, "input", "schema_invalid", 0, 0, "sha256:93acecc3288338af271e3cac6a36a88ea77034b912dcfdd7ff5db9917e410007", "input", "schema_invalid", 0, 0, "sha256:da60e6525f3c1999a8ea067f134ba3da50d8635099d80e2c9fdbb7c2216e6d3d"),
    defineDiagnosticEvidenceAdapterRowV1(43, "runtime-inner-security-nested-getter", "runtime-inner-security-nested-getter", "runtime_inherited", "inner-security-nested-getter", undefined, "input", "schema_invalid", 0, 0, "sha256:36e4962c55652126ce1b06ce5f132db4f99b321c4a7412002773f6ffc799b0c7", "input", "schema_invalid", 0, 0, "sha256:0db685f62ca72ac3af30c0df9a67e998cd87ade55bb22a1fdffce703616cf138"),
    defineDiagnosticEvidenceAdapterRowV1(44, "runtime-inner-security-nested-hidden", "runtime-inner-security-nested-hidden", "runtime_inherited", "inner-security-nested-hidden", undefined, "input", "schema_invalid", 0, 0, "sha256:ce22265bd73fe9ca1c570e9f3332c3aa287dbb811b8bef253e1fe6e7eb36b01e", "input", "schema_invalid", 0, 0, "sha256:64c036abf112c8caee9618cb017e2b87f0d153950950d779fd4abf97b07d9d38"),
    defineDiagnosticEvidenceAdapterRowV1(45, "runtime-inner-security-nested-symbol", "runtime-inner-security-nested-symbol", "runtime_inherited", "inner-security-nested-symbol", undefined, "input", "schema_invalid", 0, 0, "sha256:64b498d3b1e9e6eab1282a82bc4498e4050b0c1f571a0ea07599007d2a647f8a", "input", "schema_invalid", 0, 0, "sha256:d0b8e3c3ec2cfaf39c45ac3b9994260acbc060919741c2ba35b2090202c2d2a9"),
    defineDiagnosticEvidenceAdapterRowV1(46, "runtime-inner-security-sparse-array", "runtime-inner-security-sparse-array", "runtime_inherited", "inner-security-sparse-array", undefined, "input", "schema_invalid", 0, 0, "sha256:45868c69f7d2cb444ea3aba7045ff15461c1588faa8f65e0014c1fb1e6c8bd26", "input", "schema_invalid", 0, 0, "sha256:77001fccf2ed0761569de87e487ce6f66513b26ee0643e20e897b064c14d804d"),
    defineDiagnosticEvidenceAdapterRowV1(47, "runtime-inner-security-cycle", "runtime-inner-security-cycle", "runtime_inherited", "inner-security-cycle", undefined, "input", "schema_invalid", 0, 0, "sha256:b07979c52f36228e06e09ac218f041b99eb0ca1e2f3e88fa239d209b3290843c", "input", "schema_invalid", 0, 0, "sha256:d48be71e4bbcf4ffd840f6d0b3d763ec5cab79ff42d08378c91480c9d26236f7"),
    defineDiagnosticEvidenceAdapterRowV1(48, "runtime-inner-security-alias", "runtime-inner-security-alias", "runtime_inherited", "inner-security-alias", undefined, "input", "schema_invalid", 0, 0, "sha256:499bbb874154e77e413da456c35931ca22804a6ced9a5bc3446bcc17ae094f1a", "input", "schema_invalid", 0, 0, "sha256:96c623bf560e41339a55210776b6550ba77bbdcbaca131d987b319573cd1bfb4"),
    defineAcceptedEvidenceAdapterRowV1(49, "runtime-inner-security-async-mutation", "runtime-inner-security-async-mutation", "runtime_inherited", "inner-security-async-mutation", undefined, 3, 11, "sha256:e81b3c6ae57d4fdca4cb1c49c762f564c961faa5461ef1febb91c173466d9394", 24, 46, "sha256:d40eebe8f71b2f1155b5443cc5a6b040883f665b5addb1dc51ff833a4fdc492a"),
    defineDiagnosticEvidenceAdapterRowV1(50, "runtime-policy-profile-invalid", "runtime-policy-profile-invalid", "runtime_inherited", "policy-profile-invalid", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:79c5fd27114d2668f4a49a51789ccac4dce264285dac0a46be87e57bacf301f2", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:05bcd4fc03711bdee3fa2494bb14ca2c703718dd76b8b9508314e7801d56b50e"),
    defineDiagnosticEvidenceAdapterRowV1(51, "runtime-policy-protocol-version-invalid", "runtime-policy-protocol-version-invalid", "runtime_inherited", "policy-protocol-version-invalid", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:b8baf656b2e77a676468945ad93cfe47d0471e88c77d92df4b9a9f323eb82793", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:63398e6b4a0bbf69b981c23efc2a046e92d43b2d8833dfba2b49cb34c6dc2a4c"),
    defineDiagnosticEvidenceAdapterRowV1(52, "runtime-policy-isolation-kind-invalid", "runtime-policy-isolation-kind-invalid", "runtime_inherited", "policy-isolation-kind-invalid", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:905306c36e8ae5a3358acc72f7744aad09efbb34aa7d98664fe3a26bc481355f", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:c1de5a78c48f79301275b06b7e043cb01637b5da6943028a0900e947f7d0204e"),
    defineDiagnosticEvidenceAdapterRowV1(53, "runtime-policy-source-namespace-visibility-invalid", "runtime-policy-source-namespace-visibility-invalid", "runtime_inherited", "policy-source-namespace-visibility-invalid", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:d5f17c6e348101ae807845b9a2a909cd25f8dbf50647c21a7da5baabd3e7a535", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:dd7cb59ea8dba1a034d3412d08454c1e34be4785fc68c525fc5aa5d666b48ff5"),
    defineDiagnosticEvidenceAdapterRowV1(54, "runtime-policy-staging-kinds-order-invalid", "runtime-policy-staging-kinds-order-invalid", "runtime_inherited", "policy-staging-kinds-order-invalid", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:225dd9dd98f7638efccd7cf79c8f543e79b85b9e49519969e0258de1aabdf9bf", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:aab5f7ccb1f5e586755932622108d43e0f8bef94d61ca8ae544b020938a46533"),
    defineDiagnosticEvidenceAdapterRowV1(55, "runtime-policy-staging-kinds-extra-invalid", "runtime-policy-staging-kinds-extra-invalid", "runtime_inherited", "policy-staging-kinds-extra-invalid", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:cb81f9cd04917e853ad0664b0482b22b5146688ced0eb11e1e63d2a94c50d5c6", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:02fcc7d93e46061dc1ba544998eb49f8fde159f5da7523aa02d4bf43cb5e3aa7"),
    defineDiagnosticEvidenceAdapterRowV1(56, "runtime-policy-staging-recovery-invalid", "runtime-policy-staging-recovery-invalid", "runtime_inherited", "policy-staging-recovery-invalid", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:ab38fcaa765d3d58d80bd5e8691f180e5e5faba4ba3ed975fd228ae6c3fb555a", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:e85af4f3d8e1adbae5302b0777ea0a3fb7d4abdc17da8bdd76f8d2b45b68a77a"),
    defineDiagnosticEvidenceAdapterRowV1(57, "runtime-policy-durable-identity-invalid", "runtime-policy-durable-identity-invalid", "runtime_inherited", "policy-durable-identity-invalid", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:dea12f25130fef6948bc9da59d63adb7c037b6673c927e5302f3a1d26aad012b", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:af5fdc097c642fed86ae6cfd8c579e893bc5bccf12eaac3749e4c5b46ae62c6e"),
    defineDiagnosticEvidenceAdapterRowV1(58, "runtime-policy-publish-semantics-invalid", "runtime-policy-publish-semantics-invalid", "runtime_inherited", "policy-publish-semantics-invalid", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:6f322d9910b8425e994f3d9b15335a58f2c687e27963d9034264bbe0ba2542cb", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:6bdb49a2ccf035fa809b34edb3dd71d62b117a67d31076d814530adee6bafd7c"),
    defineDiagnosticEvidenceAdapterRowV1(59, "runtime-policy-external-intent-semantics-invalid", "runtime-policy-external-intent-semantics-invalid", "runtime_inherited", "policy-external-intent-semantics-invalid", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:f49d19b01efb092bb8f1fa33efdd6e1180e289dd993a985704587632144b2494", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:c52ca99a63a6679878430536dd1710f5a74822eb414111aafaf6d5755d7f4b6e"),
    defineDiagnosticEvidenceAdapterRowV1(60, "runtime-policy-handoff-journal-semantics-invalid", "runtime-policy-handoff-journal-semantics-invalid", "runtime_inherited", "policy-handoff-journal-semantics-invalid", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:aaaed6695b0c40f5365d27dd099ac8df15292cabddaa729bb7382d684bd61f98", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:cf30f407f05a414f82e8023788f2a308ffee7219f6fe68980dcfb4f180faf1f4"),
    defineDiagnosticEvidenceAdapterRowV1(61, "runtime-ledger-profile-invalid", "runtime-ledger-profile-invalid", "runtime_inherited", "ledger-profile-invalid", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:55362e5043fe18a119f7a098d70e90af6a89c003c12157be33bb7da6625e9003", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:8e56719d9c351cdea86b382f736049dbf2aebec2832beea0f6205edf23705543"),
    defineDiagnosticEvidenceAdapterRowV1(62, "runtime-ledger-locator-profile-invalid", "runtime-ledger-locator-profile-invalid", "runtime_inherited", "ledger-locator-profile-invalid", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:07d5c23e7a8f7574b0762eac360d5c596f2a5b6151b78b16b1446bcc8a61e0fd", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:0c2fea4000e50ff4b0976f7420bc60af44d44d1434821f84407233505cab61cb"),
    defineDiagnosticEvidenceAdapterRowV1(63, "runtime-ledger-storage-boundary-invalid", "runtime-ledger-storage-boundary-invalid", "runtime_inherited", "ledger-storage-boundary-invalid", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:3cfd7179086cd687e713c6c32069afedf5522423a656b197f1e38a7a0f8a3630", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:6430575e1e4068c7d8387ea73ce9ead7523d480dac4833cbe41232874990a769"),
    defineDiagnosticEvidenceAdapterRowV1(64, "runtime-ledger-append-semantics-invalid", "runtime-ledger-append-semantics-invalid", "runtime_inherited", "ledger-append-semantics-invalid", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:048fb3cb4825ef7adf85c7dd833f347c25f5bd2c8d1d76a10883f31898e3ad7a", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:a568477609227508ad8cc69d65a2bfe4ea2da41193e030d4e9e39bcf0bcbbc1f"),
    defineDiagnosticEvidenceAdapterRowV1(65, "runtime-ledger-max-receipt-count-invalid", "runtime-ledger-max-receipt-count-invalid", "runtime_inherited", "ledger-max-receipt-count-invalid", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:ea3024534d8486d2d8df89443036f004484474083472da6ffce7d00f2c93f6ad", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:5408b3b71e0e0fd18eadb5b1067486d046def2ba8d8e83716877bb41e10a8005"),
    defineDiagnosticEvidenceAdapterRowV1(66, "runtime-ledger-max-logical-bytes-invalid", "runtime-ledger-max-logical-bytes-invalid", "runtime_inherited", "ledger-max-logical-bytes-invalid", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:21d0b3b8769fa3cc33a8776f92179ab56b598506b21c937409690f1d81caae85", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:aa648a37e3488ca16674a4a26faa5e4afaa1327787b6924ef5255750fd9cbb77"),
    defineDiagnosticEvidenceAdapterRowV1(67, "runtime-ledger-max-single-bytes-invalid", "runtime-ledger-max-single-bytes-invalid", "runtime_inherited", "ledger-max-single-bytes-invalid", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:954ebcb3c14ae2346dc78cc79650d14e3b379c717d084276a578eb2af0b777ac", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:0b1f89fb4fb5ed34ec5a7024fb0df90ba7977f872623e19959d10f77a61eb66d"),
    defineDiagnosticEvidenceAdapterRowV1(68, "runtime-ledger-admission-invalid", "runtime-ledger-admission-invalid", "runtime_inherited", "ledger-admission-invalid", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:142072a1a20f107615122778b1fab41d870dad4db25b6dcb38328ea474f1e200", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:647c548a0023c3472629df562ca85e0e31904628d20f7995436a5489571d34ad"),
    defineDiagnosticEvidenceAdapterRowV1(69, "runtime-ledger-quota-accounting-invalid", "runtime-ledger-quota-accounting-invalid", "runtime_inherited", "ledger-quota-accounting-invalid", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:97b637de7a7893b6496376349f4616101ed7ad7f2ea3b40528dd486f180b99b6", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:842aac76a81b34b7eda3a511a5d3cf6100d2a3e7d7b119f5506367a8d059f615"),
    defineDiagnosticEvidenceAdapterRowV1(70, "runtime-policy-delete-semantics-invalid", "runtime-policy-delete-semantics-invalid", "runtime_inherited", "policy-delete-semantics-invalid", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:1d49cf89bf18d6220aac54b6e2880b1362a2db08c5bb68f9e233efbd4040d5f9", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:a7c1dc8b2827e780f29e03ada698f84b5820bc0f4deb2069d961f16a1fd38199"),
    defineDiagnosticEvidenceAdapterRowV1(71, "runtime-policy-stock-fallback-invalid", "runtime-policy-stock-fallback-invalid", "runtime_inherited", "policy-stock-fallback-invalid", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:8e4e2881ac2672c834b0cf4c94d0a60f4d34d5bf3d1c26dd49e591c19f36aff8", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:b301d8a7813a60896bb6183ee35221fe25ac63d39086592cdf759a9dc338f94c"),
    defineDiagnosticEvidenceAdapterRowV1(72, "runtime-policy-extra-field", "runtime-policy-extra-field", "runtime_inherited", "policy-extra-field", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:19fb9fa19044d37e29401d4ece94a04fa3bdb06222bcd37c810934dcebc1e319", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:ac89fdd0fe3739a4d941ffa6db78c8b5f3f885dfe1159f08748a817180297ca0"),
    defineDiagnosticEvidenceAdapterRowV1(73, "runtime-policy-digest-mismatch", "runtime-policy-digest-mismatch", "runtime_inherited", "policy-digest-mismatch", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:36e3d79507d7a6f5b005fcf2b2700008c50f1d4892f1d8a96f9161654ccb7368", "runtime_attestation_closure", "source_invalid", 24, 44, "sha256:cf54b784cd8d20f72f3e8938c8498090c0e74f4bccfc8d69be02c271ad57840e"),
    defineDiagnosticEvidenceAdapterRowV1(74, "runtime-policy-provider-binding-mismatch", "runtime-policy-provider-binding-mismatch", "runtime_inherited", "policy-provider-binding-mismatch", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:ba3178354ccfe8e74383afc18de2aa2dc9836cceac15f4a0d21c0b42f5c657ab", "registry_runtime_binding", "binding_mismatch", 24, 38, "sha256:7dc772d7423c60b2af70592f777d9f83b9b6aabc321610319f273ad083e26fb5"),
    defineDiagnosticEvidenceAdapterRowV1(75, "runtime-policy-suite-binding-mismatch", "runtime-policy-suite-binding-mismatch", "runtime_inherited", "policy-suite-binding-mismatch", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:83a73d6694e8642cb253553b667795994df0f3ee46da48b2306b179489518a4e", "registry_runtime_binding", "binding_mismatch", 24, 38, "sha256:5c6d4c8f3c2edc1078dea6ec5ef815a2f5cf6c13312e0a7086fff13fd93af815"),
    defineDiagnosticEvidenceAdapterRowV1(76, "runtime-precedence-policy-digest-before-runtime-structure", "runtime-precedence-policy-digest-before-runtime-structure", "runtime_inherited", "precedence-policy-digest-before-runtime-structure", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:b4dd0f325664f01378355ea9c18ed91d8dbbd21ec0e3ae1c6f227a1bed95b776", "registry_runtime_binding", "binding_mismatch", 24, 38, "sha256:a211ad83cc36212195e503706b297513ef5b650270af6e26dabea65ff4a695f6"),
    defineDiagnosticEvidenceAdapterRowV1(77, "runtime-precedence-result-policy-binding-before-runtime-pin", "runtime-precedence-result-policy-binding-before-runtime-pin", "runtime_inherited", "precedence-result-policy-binding-before-runtime-pin", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:7edaa6d743c835ae646b4702b1fef1c5e2cfcf7927b6ecb6e90b2870a2b1e851", "registry_runtime_binding", "binding_mismatch", 24, 38, "sha256:702c7cab8e84956825ee6b20f5fd9aae409ff8026507804211966195d087ed51"),
    defineDiagnosticEvidenceAdapterRowV1(78, "runtime-runtime-pin-profile-invalid", "runtime-runtime-pin-profile-invalid", "runtime_inherited", "runtime-pin-profile-invalid", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:4ef3350dc8aa832311976d34ddeb31ce6df6fac284a5a6c5a5acf40d7097dad2", "registry_runtime_binding", "binding_mismatch", 24, 38, "sha256:97c028250cd8ab2a4675c942b16f6be89aa327ce5c1db043c33ae3b455f55c93"),
    defineDiagnosticEvidenceAdapterRowV1(79, "runtime-runtime-pin-content-digest-missing", "runtime-runtime-pin-content-digest-missing", "runtime_inherited", "runtime-pin-content-digest-missing", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:3c05a5531ed899fb8bbd1b95ad20a5c530a4ed926b5cee0d87234d3d2d82d3af", "registry_runtime_binding", "binding_mismatch", 24, 38, "sha256:380236cc47d9586c020d0be3005372079f8d881fa9b18857c5185d5e4ea481e1"),
    defineDiagnosticEvidenceAdapterRowV1(80, "runtime-runtime-pin-extra-field", "runtime-runtime-pin-extra-field", "runtime_inherited", "runtime-pin-extra-field", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:a234eac48161ea410c79e2639c40e1f09d4175b4fbd329f83f058cdb7cd4723b", "registry_runtime_binding", "binding_mismatch", 24, 38, "sha256:df47d593993c32f5642a0a64f73925c86383003b902bd4eec88dbd39aa83e1e7"),
    defineDiagnosticEvidenceAdapterRowV1(81, "runtime-runtime-payload-profile-invalid", "runtime-runtime-payload-profile-invalid", "runtime_inherited", "runtime-payload-profile-invalid", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:bed472074022d3b69b29f50c81058c1cffc39c1e7bf65ea57b815216d3f5f2ff", "registry_runtime_binding", "binding_mismatch", 24, 38, "sha256:73e90024373662921ff4bdb66e69a37c4035af6884df27d5d876cf9a012e0792"),
    defineDiagnosticEvidenceAdapterRowV1(82, "runtime-runtime-payload-required-field-missing", "runtime-runtime-payload-required-field-missing", "runtime_inherited", "runtime-payload-required-field-missing", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:068bb6b681b813bb63d829ab1e331d0c40ed4bfcfb1110d041f56c30aafe9136", "registry_runtime_binding", "binding_mismatch", 24, 38, "sha256:0993046d5b5403c8a3e7728d98481b1b06fd904d6f04edec27f5b6e1907ad2ec"),
    defineDiagnosticEvidenceAdapterRowV1(83, "runtime-runtime-payload-extra-field", "runtime-runtime-payload-extra-field", "runtime_inherited", "runtime-payload-extra-field", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:5441d6841f7581b6ce5712b9a25b56b8b56159fbc8e7901ce125be9941c4f807", "registry_runtime_binding", "binding_mismatch", 24, 38, "sha256:a47e9f15b602d0485b1cdb6e0a1c0776fe65a12bdc533c1d3892f651abcd8f1e"),
    defineDiagnosticEvidenceAdapterRowV1(84, "runtime-runtime-generation-zero", "runtime-runtime-generation-zero", "runtime_inherited", "runtime-generation-zero", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:9de6947ba45cf96d3d9eb07095f65c340d61c4f8f505909b0558e2143b67d22a", "registry_runtime_binding", "binding_mismatch", 24, 38, "sha256:db999bc41c9ddd62ac90595e8934afd98c3ef4ca7abcce5d1c7dae30b030ce6f"),
    defineDiagnosticEvidenceAdapterRowV1(85, "runtime-runtime-generation-fractional", "runtime-runtime-generation-fractional", "runtime_inherited", "runtime-generation-fractional", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:5c1a7f8caafa1748d6aaf4ddd9d263b7049ce3aa85554831c13e77d11f83637a", "registry_history_closure", "source_invalid", 24, 38, "sha256:3c6e180175c120914be2857a8ff5857e29aa50638855693f6921fa107c492ee0"),
    defineDiagnosticEvidenceAdapterRowV1(86, "runtime-runtime-generation-unsafe", "runtime-runtime-generation-unsafe", "runtime_inherited", "runtime-generation-unsafe", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:053e86080429a650764933e0cc6a72f6ed4f5efc9a59ced1c661572c37d91e0d", "registry_history_closure", "source_invalid", 24, 38, "sha256:aeba0b7cfe30f6837a06367dc72510aba3865ef6affc1a14d7128e0c1a1522b9"),
    defineDiagnosticEvidenceAdapterRowV1(87, "runtime-runtime-issued-at-noncanonical", "runtime-runtime-issued-at-noncanonical", "runtime_inherited", "runtime-issued-at-noncanonical", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:5ddf3de71fe0947f880a00aebaf45569c8fe862063c93439ec3f8b7d1e47dfb1", "registry_runtime_binding", "binding_mismatch", 24, 38, "sha256:54714888d28b5b2993423fbda630b82ccd8bc33cab74584b3aeb9011cd36d269"),
    defineDiagnosticEvidenceAdapterRowV1(88, "runtime-runtime-issued-at-invalid-date", "runtime-runtime-issued-at-invalid-date", "runtime_inherited", "runtime-issued-at-invalid-date", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:bbbde7d271bca538fcef4fcc702ca8b8a352bde9bf0879c0df293cc28fbd398c", "registry_runtime_binding", "binding_mismatch", 24, 38, "sha256:e5a52e7daf924c3cc62d6feb9200815266075600679feba30b90252b81f2172c"),
    defineDiagnosticEvidenceAdapterRowV1(89, "runtime-runtime-os-platform-invalid", "runtime-runtime-os-platform-invalid", "runtime_inherited", "runtime-os-platform-invalid", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:d5ed4d0448be992bf2f2092e132a2a7c46b1f20f8193b430ec4f84a6cba5dfaa", "registry_runtime_binding", "binding_mismatch", 24, 38, "sha256:0a1376bd9871404160258b3f4b8c8885219ca5ab9897804d0140a0b91bd57a5e"),
    defineDiagnosticEvidenceAdapterRowV1(90, "runtime-runtime-architecture-invalid", "runtime-runtime-architecture-invalid", "runtime_inherited", "runtime-architecture-invalid", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:86e1dab5636fa1d9764f71a21ce91b29284e4da663bf20cff0a6249229ab4340", "registry_runtime_binding", "binding_mismatch", 24, 38, "sha256:e2ca647cab8cfd4995467f3aa0f94705395d340b6d903ea1d8e3296354d8ce46"),
    defineDiagnosticEvidenceAdapterRowV1(91, "runtime-runtime-ipc-endpoint-digest-invalid", "runtime-runtime-ipc-endpoint-digest-invalid", "runtime_inherited", "runtime-ipc-endpoint-digest-invalid", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:d9007a7e4860782a39afdc2bd08b0b5c88db060c74d99b9b3ca6523816276e39", "registry_runtime_binding", "binding_mismatch", 24, 38, "sha256:4ac1ca31d3782768699fc01da89c0717da41cd9d3b4a1731e14d1d483c86bd66"),
    defineDiagnosticEvidenceAdapterRowV1(92, "runtime-runtime-signature-format-invalid", "runtime-runtime-signature-format-invalid", "runtime_inherited", "runtime-signature-format-invalid", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:a3bd947fc7a81e5a32f0f75fc1026041bd01edbefd2c8711e5e474d6859f3274", "registry_runtime_binding", "binding_mismatch", 24, 38, "sha256:c87c81a101dd7a1eb6a0485df7f28d170c3c7bfa75adee7ea3477be1f4f36fbf"),
    defineDiagnosticEvidenceAdapterRowV1(93, "runtime-runtime-pin-content-digest-mismatch", "runtime-runtime-pin-content-digest-mismatch", "runtime_inherited", "runtime-pin-content-digest-mismatch", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:7ca93162138169af364e80fcc1bf3a94d46b3ba8177da241835ae90e8314fa63", "registry_runtime_binding", "binding_mismatch", 24, 38, "sha256:17a99e6ca17c172d03596e6f93938eff2cbfd9beaac07922ea65891af378b757"),
    defineDiagnosticEvidenceAdapterRowV1(94, "runtime-runtime-provider-binding-mismatch", "runtime-runtime-provider-binding-mismatch", "runtime_inherited", "runtime-provider-binding-mismatch", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:d2f1b7a57391a318be503f537e3b7bd505e0ec44756da8f2673bb924f87b756e", "registry_runtime_binding", "binding_mismatch", 24, 38, "sha256:752de3ff4c759532e2dc9de1ec4ca33e2307635bd5cf04785680c29a0d33e380"),
    defineDiagnosticEvidenceAdapterRowV1(95, "runtime-runtime-policy-binding-mismatch", "runtime-runtime-policy-binding-mismatch", "runtime_inherited", "runtime-policy-binding-mismatch", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:48052a22b768052991bac7269b24566695c8bcce1851cc345baf29680d34513c", "registry_runtime_binding", "binding_mismatch", 24, 38, "sha256:53de359213228a916cfb4f276da353756bd983afdb276301fbcff1c4f227e7f9"),
    defineDiagnosticEvidenceAdapterRowV1(96, "runtime-runtime-implementation-binding-mismatch", "runtime-runtime-implementation-binding-mismatch", "runtime_inherited", "runtime-implementation-binding-mismatch", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:db2d8773dd9bc6a28d3b76320b4f3a14d1fba5402fd3d11aefc19890f5f40ccc", "registry_runtime_binding", "binding_mismatch", 24, 38, "sha256:f98ffe1a74f8e518a23fabb8d740bd2fe5995bd8d870497fc798477d1a760985"),
    defineDiagnosticEvidenceAdapterRowV1(97, "runtime-runtime-binary-binding-mismatch", "runtime-runtime-binary-binding-mismatch", "runtime_inherited", "runtime-binary-binding-mismatch", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:72c6a9f935dce73fddaa4e675a5dc8ef7f3ae5a8f28929d2d65de58571007298", "registry_runtime_binding", "binding_mismatch", 24, 38, "sha256:abb6ceee2b07cbe54459fd3f1a7eed074a7dd873196682bbda99083a9173afcb"),
    defineDiagnosticEvidenceAdapterRowV1(98, "runtime-runtime-os-platform-binding-mismatch", "runtime-runtime-os-platform-binding-mismatch", "runtime_inherited", "runtime-os-platform-binding-mismatch", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:1391804e5676181e085bf728301beff427166a92c73a19d5aac2aa9fec3297d7", "registry_runtime_binding", "binding_mismatch", 24, 38, "sha256:aca21aa6bfe51155c60558bf3879db52e81739ca3aa98385fb9fbbd2083946bb"),
    defineDiagnosticEvidenceAdapterRowV1(99, "runtime-runtime-os-family-binding-mismatch", "runtime-runtime-os-family-binding-mismatch", "runtime_inherited", "runtime-os-family-binding-mismatch", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:bf1f78d34af5cc5803a6c3a21579f54adb6f52dccb9fe2b13edb6a61ec87002c", "registry_runtime_binding", "binding_mismatch", 24, 38, "sha256:b919eca40d13ca62497f371dcac9535d970609467639490da1b6d31ec75c9abc"),
    defineDiagnosticEvidenceAdapterRowV1(100, "runtime-runtime-os-build-binding-mismatch", "runtime-runtime-os-build-binding-mismatch", "runtime_inherited", "runtime-os-build-binding-mismatch", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:85c45db74ae0422d5beba783cda28e1e64e9e3de358a991745f91b018fe33edd", "registry_runtime_binding", "binding_mismatch", 24, 38, "sha256:2ed0fd40c7e71f849f37574da42c7c27ddd32677d2c1ad5f916e4a2908a069c3"),
    defineDiagnosticEvidenceAdapterRowV1(101, "runtime-runtime-architecture-binding-mismatch", "runtime-runtime-architecture-binding-mismatch", "runtime_inherited", "runtime-architecture-binding-mismatch", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:26a8a3cb44a69de35be1c67082ad265bf9e08ada13669b68dd2ff83e90e3cbce", "registry_runtime_binding", "binding_mismatch", 24, 38, "sha256:c7f3447fe5eaf7054a9f922078ecf66ee893a95530adfd0db00ebce4b21a66f2"),
    defineDiagnosticEvidenceAdapterRowV1(102, "runtime-runtime-filesystem-profile-binding-mismatch", "runtime-runtime-filesystem-profile-binding-mismatch", "runtime_inherited", "runtime-filesystem-profile-binding-mismatch", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:d96430764a351642542382c284ab7985fd96093ae2531e72598038d990450d61", "registry_runtime_binding", "binding_mismatch", 24, 38, "sha256:ceb165e2831c045c8b6190dae0cd94e9d8ad3912b6c1a1144e48f948a233bd8b"),
    defineDiagnosticEvidenceAdapterRowV1(103, "runtime-runtime-result-digest-binding-mismatch", "runtime-runtime-result-digest-binding-mismatch", "runtime_inherited", "runtime-result-digest-binding-mismatch", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:6f3e764516bae4f3d2401496fad3f56fbbddf0cfade61d50efedc4815d3e349b", "registry_runtime_binding", "binding_mismatch", 24, 38, "sha256:0340f49ec7b5e4ad25f62777f5d037e2857e3be0dba6b8c46a2c86b30ad90b65"),
    defineDiagnosticEvidenceAdapterRowV1(104, "runtime-runtime-signature-bitflip", "runtime-runtime-signature-bitflip", "runtime_inherited", "runtime-signature-bitflip", undefined, "runtime_attestation_closure", "source_invalid", 2, 14, "sha256:54d314a432fb9e38cef18d5a6e5ed2688aaba040e61892a51180c068a9a9c3af", "registry_runtime_binding", "binding_mismatch", 24, 38, "sha256:b808d9bdd114d8e46d73460b608b49aa800cc7e7ac33c517af7f5bcbc7ef83bb"),
    defineDiagnosticEvidenceAdapterRowV1(105, "runtime-runtime-signature-wrong-signer", "runtime-runtime-signature-wrong-signer", "runtime_inherited", "runtime-signature-wrong-signer", undefined, "runtime_attestation_closure", "source_invalid", 2, 14, "sha256:cc2f9fa4230c1bdab5f25a7f84cb1272f4ff87787492612c974d0ddb4f52b133", "registry_runtime_binding", "binding_mismatch", 24, 38, "sha256:f53007195f8767236f715b251f9875284a76daa15756a2f4782ca420eea49b33"),
    defineDiagnosticEvidenceAdapterRowV1(106, "runtime-runtime-signature-wrong-domain", "runtime-runtime-signature-wrong-domain", "runtime_inherited", "runtime-signature-wrong-domain", undefined, "runtime_attestation_closure", "source_invalid", 2, 14, "sha256:e54d6d2ea8742dea44589e05861ad8f1e00b88d0c37d4db3899404e6b2eb3b26", "registry_runtime_binding", "binding_mismatch", 24, 38, "sha256:e883cfe7175a4d718f5f7a6dcbcfea3b93947393a229eca3d719efe889c35d2b"),
    defineDiagnosticEvidenceAdapterRowV1(107, "runtime-runtime-root-mismatch", "runtime-runtime-root-mismatch", "runtime_inherited", "runtime-root-mismatch", undefined, "runtime_attestation_closure", "source_invalid", 2, 12, "sha256:3ceae1ec7b6f2ef85d44026c35e3b77e9a1fbb44742919dc83a23987194ed298", "registry_runtime_binding", "binding_mismatch", 24, 38, "sha256:37a7664cea434334a76087a83f0f6bb38f36a448de7f54ade94824b30190d176"),
    defineDiagnosticEvidenceAdapterRowV1(108, "runtime-point-input-extra-field", "runtime-point-input-extra-field", "runtime_inherited", "point-input-extra-field", undefined, "input", "schema_invalid", 0, 0, "sha256:b4b731165b68bada67b795b6643fc4cf48b9b73fab0336560af7529429d42698", "input", "schema_invalid", 0, 0, "sha256:19007ba58a6a5ed0df654157edf70a28197454c0cf6bf3edc3a0176f73a4eed9"),
    defineDiagnosticEvidenceAdapterRowV1(109, "runtime-point-input-plain-validation-dto", "runtime-point-input-plain-validation-dto", "runtime_inherited", "point-input-plain-validation-dto", undefined, "input", "schema_invalid", 0, 0, "sha256:507054e1092770caceb7d2ceb2ab39124907d0ac21cc89f6ec7415d3f2e751ac", "input", "schema_invalid", 0, 0, "sha256:b993a00cd3c3baf35c98ca938b685f300f4ea82be0ac19356f68c9ba77f7a8fe"),
    defineDiagnosticEvidenceAdapterRowV1(110, "runtime-point-security-top-level-proxy", "runtime-point-security-top-level-proxy", "runtime_inherited", "point-security-top-level-proxy", undefined, "input", "schema_invalid", 0, 0, "sha256:670a8ebdc70fac4ad3ea788cdad96f6afb679de9531190ce585e69666c4d8831", "input", "schema_invalid", 0, 0, "sha256:d9b4515bee5a1fee0a7db80ae084f6ccb3e199e32c705b9e493a691dd40db009"),
    defineDiagnosticEvidenceAdapterRowV1(111, "runtime-point-security-nested-proxy", "runtime-point-security-nested-proxy", "runtime_inherited", "point-security-nested-proxy", undefined, "input", "schema_invalid", 0, 0, "sha256:b863b4d71bd87864ddde84bd5c6ca0a4e01f7c6486130752a661da917ecefa62", "input", "schema_invalid", 0, 0, "sha256:e889c5c88c19fbe4cb8ddfa6afdf7c03d7d4c41caba94184583f75fbe6db3bbe"),
    defineDiagnosticEvidenceAdapterRowV1(112, "runtime-point-security-top-level-getter", "runtime-point-security-top-level-getter", "runtime_inherited", "point-security-top-level-getter", undefined, "input", "schema_invalid", 0, 0, "sha256:38fba31ade2316ba1343aba5f9f5a883bd66ca40ee2fbefa912fe00d9c38643c", "input", "schema_invalid", 0, 0, "sha256:4fae02c96ae11a4e41d67043b8ff918c42d7a7b8bc17f05cb4943200c3348010"),
    defineDiagnosticEvidenceAdapterRowV1(113, "runtime-point-security-nested-getter", "runtime-point-security-nested-getter", "runtime_inherited", "point-security-nested-getter", undefined, "input", "schema_invalid", 0, 0, "sha256:64f720cc525f1eb50710288c4bbe9e17517399366ab25d167d09896fe65cf46c", "input", "schema_invalid", 0, 0, "sha256:27435a86035f3eeb6f2832279b80e3a4c5aa36e2174492015e45c85a08e05517"),
    defineDiagnosticEvidenceAdapterRowV1(114, "runtime-point-security-top-level-hidden", "runtime-point-security-top-level-hidden", "runtime_inherited", "point-security-top-level-hidden", undefined, "input", "schema_invalid", 0, 0, "sha256:b05c099ebb7b39b488aba8907f6f663e7c572b2385a34d5fddce1476da0c41a8", "input", "schema_invalid", 0, 0, "sha256:66c9739d914dc46dd0d227ff961cff1fce186d68c7dd1e515556dacec4ab6f60"),
    defineDiagnosticEvidenceAdapterRowV1(115, "runtime-point-security-nested-hidden", "runtime-point-security-nested-hidden", "runtime_inherited", "point-security-nested-hidden", undefined, "input", "schema_invalid", 0, 0, "sha256:9a297bccea7310698f4dd096225354748fdab52b9465e652ba1f27452c6c756b", "input", "schema_invalid", 0, 0, "sha256:a2c9b7b8d791ea8812d58149d5f46379b18d12e2113c66c4eff6ce72aeb0964d"),
    defineDiagnosticEvidenceAdapterRowV1(116, "runtime-point-security-top-level-symbol", "runtime-point-security-top-level-symbol", "runtime_inherited", "point-security-top-level-symbol", undefined, "input", "schema_invalid", 0, 0, "sha256:2cdaafd3a12b3fdc601da6a5cc13d4799708c1564accd3c9f74dcdc8feb156e8", "input", "schema_invalid", 0, 0, "sha256:aad1cc5886b606809136b8de57f56346a3e79dd0c2147033aaf6fd4728c22fbb"),
    defineDiagnosticEvidenceAdapterRowV1(117, "runtime-point-security-nested-symbol", "runtime-point-security-nested-symbol", "runtime_inherited", "point-security-nested-symbol", undefined, "input", "schema_invalid", 0, 0, "sha256:c04320c7d7410604c3fed2cf307aef521d9324ba18c7a40ed5c424f03d928ee1", "input", "schema_invalid", 0, 0, "sha256:d81b1cb41adb2a8e31c7a9c9012862df1e676c9f935a9294c0178da163be2d70"),
    defineDiagnosticEvidenceAdapterRowV1(118, "runtime-point-security-sparse-array", "runtime-point-security-sparse-array", "runtime_inherited", "point-security-sparse-array", undefined, "input", "schema_invalid", 0, 0, "sha256:4206d1f879b810d216e69a9c275761a6504577554e9b49d88586f0d01a340f42", "input", "schema_invalid", 0, 0, "sha256:6400395e8c7fb0117d275ff48ddc5d00fa7425ed785a2215bffd64be7a069fc8"),
    defineDiagnosticEvidenceAdapterRowV1(119, "runtime-point-security-cycle", "runtime-point-security-cycle", "runtime_inherited", "point-security-cycle", undefined, "input", "schema_invalid", 0, 0, "sha256:22539dd6f24e38ec1a76fa5761622247ed78fd6b404b520c483df1da3f18b4fc", "input", "schema_invalid", 0, 0, "sha256:3f5f649361c56b2dad78da34aa1e331cb8dbcbb12f2f0bf9065bd6645c7ab84d"),
    defineDiagnosticEvidenceAdapterRowV1(120, "runtime-point-security-alias", "runtime-point-security-alias", "runtime_inherited", "point-security-alias", undefined, "input", "schema_invalid", 0, 0, "sha256:84ee0e0d3b8ce4a2512cae6bb0f8610827120192d05bd1880c039d16ea3079fc", "input", "schema_invalid", 0, 0, "sha256:3952f3d5fe82d0acb850c4c99fcf3a32ad6d6fdcf065e76b15b75119c215c95e"),
    defineAcceptedEvidenceAdapterRowV1(121, "runtime-point-security-async-mutation", "runtime-point-security-async-mutation", "runtime_inherited", "point-security-async-mutation", undefined, 3, 11, "sha256:4a1a984f8521922a248f006fd9298a4d3e491d906e4a652b6e3fe8cebe834c9f", 24, 46, "sha256:b92521868bd6ed1e21e55d47c8cf0fc246b1ce74b5907b055f5559ff37ba8a80"),
    defineDiagnosticEvidenceAdapterRowV1(122, "evidence-envelope-schema-version-invalid", "evidence-envelope-schema-version-invalid", "evidence_direct", "evidence-envelope-schema-version-invalid", undefined, "evidence_structure", "schema_invalid", 2, 14, "sha256:f6f71f40c710297a455df44ccb659f2ce5091552c82396729cfe5fdb3ad731b1", "evidence_structure", "schema_invalid", 0, 0, "sha256:c6696082225a7ba0e9deebc88caa5192479fc1d7bc52b6f3946dd9c9aedd7290"),
    defineDiagnosticEvidenceAdapterRowV1(123, "evidence-envelope-record-type-invalid", "evidence-envelope-record-type-invalid", "evidence_direct", "evidence-envelope-record-type-invalid", undefined, "evidence_structure", "schema_invalid", 2, 14, "sha256:3d7b1e494308a67f058665476e61036f2dc1862ac2a0fa1202718d3b4c77dec5", "evidence_structure", "schema_invalid", 0, 0, "sha256:96c221a508f65e868b556f3059c14242291d6d65648809315b01b40c19edb298"),
    defineDiagnosticEvidenceAdapterRowV1(124, "evidence-envelope-extra-field", "evidence-envelope-extra-field", "evidence_direct", "evidence-envelope-extra-field", undefined, "evidence_structure", "schema_invalid", 2, 14, "sha256:c996382c3577aebda82b4116f7a164cd0e5298a2ced76a2bed5e156573b9ac4a", "evidence_structure", "schema_invalid", 0, 0, "sha256:a689402c56616ab561d39d287261f48fcb5a2f0eef63307550b7f1f78b308a8d"),
    defineDiagnosticEvidenceAdapterRowV1(125, "evidence-payload-profile-invalid", "evidence-payload-profile-invalid", "evidence_direct", "evidence-payload-profile-invalid", undefined, "evidence_structure", "schema_invalid", 2, 14, "sha256:714e935456ccf97b90618fa29040bb431f13efd724f07624831ac06abccf34f9", "evidence_structure", "schema_invalid", 0, 0, "sha256:71a9e09e5efd4688d1023560359a71a631ec04a8ee45a66f0534db9782937539"),
    defineDiagnosticEvidenceAdapterRowV1(126, "evidence-payload-required-field-missing", "evidence-payload-required-field-missing", "evidence_direct", "evidence-payload-required-field-missing", undefined, "evidence_structure", "schema_invalid", 2, 14, "sha256:c980b33a3463573270421ef1976cc7d8328f5051ad5ae5d3e1445ed990a38b4b", "evidence_structure", "schema_invalid", 0, 0, "sha256:75a4aac004b525e11f910c275ecc62253541920f6e6f69b6f35357035495ff14"),
    defineDiagnosticEvidenceAdapterRowV1(127, "evidence-payload-extra-field", "evidence-payload-extra-field", "evidence_direct", "evidence-payload-extra-field", undefined, "evidence_structure", "schema_invalid", 2, 14, "sha256:07a6db10c93d7c55a7696825afcde4dceea24b4f2dc3e0a41f404a11f4180c33", "evidence_structure", "schema_invalid", 0, 0, "sha256:a28b1a066352834ee800a1c05019b3f9b4a2e73cce58592fca9b5e55881fd452"),
    defineDiagnosticEvidenceAdapterRowV1(128, "evidence-qa-signature-format-invalid", "evidence-qa-signature-format-invalid", "evidence_direct", "evidence-qa-signature-format-invalid", undefined, "evidence_structure", "schema_invalid", 2, 14, "sha256:c4ac840046317704b464dc08a931acd91969ffffc98fe4deeed56c3681b4eea0", "evidence_qa_signature_binding", "binding_mismatch", 24, 44, "sha256:ec4d272cad553a3eb4232fcfe5834452af87f2d5235c830d9e2bd8b8bf969ae8"),
    defineDiagnosticEvidenceAdapterRowV1(129, "evidence-release-signature-format-invalid", "evidence-release-signature-format-invalid", "evidence_direct", "evidence-release-signature-format-invalid", undefined, "evidence_structure", "schema_invalid", 2, 14, "sha256:94f6ac28d0a59da5501f6e60837e3cd7fb4f25a4dead6c9469e07355b2e46b95", "evidence_release_signature_binding", "binding_mismatch", 24, 44, "sha256:101fa63bd158e3c0a32de8f361d26a53f4de27855086923643a22ab70861ec9d"),
    defineDiagnosticEvidenceAdapterRowV1(130, "evidence-payload-not-object", "evidence-payload-not-object", "evidence_direct", "evidence-payload-not-object", undefined, "evidence_structure", "schema_invalid", 2, 14, "sha256:95cf05d98be46c1c2a8752e762074eb8f807de722a63404bbaed3ead1357c401", "evidence_structure", "schema_invalid", 0, 0, "sha256:848b789c110dfcf29661a2305dab22d76d2ded9820b3c51fdc3999cda3a0bb6f"),
    defineDiagnosticEvidenceAdapterRowV1(131, "evidence-pin-profile-invalid", "evidence-pin-profile-invalid", "evidence_direct", "evidence-pin-profile-invalid", undefined, "evidence_pin_structure", "schema_invalid", 2, 14, "sha256:1afa83f6aeffa933ac821bd0a117ec82fbd8229e4b1746a6ce6bd57e18d89e23", "evidence_pin_structure", "schema_invalid", 0, 0, "sha256:ad6f254f69aaffd1098bd30d7790e3282397dd6c54694cd3eb8cab6ec50c9045"),
    defineDiagnosticEvidenceAdapterRowV1(132, "evidence-pin-evidence-id-missing", "evidence-pin-evidence-id-missing", "evidence_direct", "evidence-pin-evidence-id-missing", undefined, "evidence_pin_structure", "schema_invalid", 2, 14, "sha256:1ed1bdf0d0f2126d7d8c2428e1aace10a1ad514d85ddeb691c76ba0adda03f76", "evidence_pin_structure", "schema_invalid", 0, 0, "sha256:b39436ed72752c2898aa0d5efe7e3ece3373d509c9e552207dab2ea9eb57ac86"),
    defineDiagnosticEvidenceAdapterRowV1(133, "evidence-pin-content-digest-missing", "evidence-pin-content-digest-missing", "evidence_direct", "evidence-pin-content-digest-missing", undefined, "evidence_pin_structure", "schema_invalid", 2, 14, "sha256:279750b8764a20363d277a9f6d88bd6860c8d666ed5d8ee8a9c11792c89e55bc", "evidence_pin_structure", "schema_invalid", 0, 0, "sha256:1c69a248f8c0b81fb5b0a4756c4c532eb1038181d40fec2263807bd1c4b55237"),
    defineDiagnosticEvidenceAdapterRowV1(134, "evidence-pin-extra-field", "evidence-pin-extra-field", "evidence_direct", "evidence-pin-extra-field", undefined, "evidence_pin_structure", "schema_invalid", 2, 14, "sha256:80b910d1617b0c8416aac00a35f93d548466a5ea30648b188bc003e880dfd5b5", "evidence_pin_structure", "schema_invalid", 0, 0, "sha256:a1f68456256fc17731398f614af1e73f96caef52480fbb86cfe61aadba952752"),
    defineDiagnosticEvidenceAdapterRowV1(135, "qa-key-profile-invalid", "qa-key-profile-invalid", "registry_approver_history", "qa-key-profile-invalid", undefined, "qa_approver_key_structure", "schema_invalid", 2, 14, "sha256:2f2dff1dc8e469883aef9a0cbdc62840e6e6570a770d833860319bfc87f32749", "registry_history_closure", "source_invalid", 24, 37, "sha256:dc05f12dfa8e09e18a36a66fdcb8def7100a83fcd22dd62b58311bdfae067377"),
    defineDiagnosticEvidenceAdapterRowV1(136, "qa-key-generation-zero", "qa-key-generation-zero", "registry_approver_history", "qa-key-generation-zero", undefined, "qa_approver_key_structure", "schema_invalid", 2, 14, "sha256:39d29411b3a065fe6face0259c8fe20456defe24694a42269b512ba94dcf6452", "registry_history_closure", "source_invalid", 24, 37, "sha256:5809f73bc46cbe5396420599b44a7407188cf5b2bda4ca2f259181d2376d9e02"),
    defineDiagnosticEvidenceAdapterRowV1(137, "qa-key-algorithm-invalid", "qa-key-algorithm-invalid", "registry_approver_history", "qa-key-algorithm-invalid", undefined, "qa_approver_key_structure", "schema_invalid", 2, 14, "sha256:632fba33ea039e76497b7234d3ff412ea54c824e4cf05d7feb76789d66faac55", "registry_history_closure", "source_invalid", 24, 37, "sha256:645d05e62f8672dff6f4f2fb0d2ea62c671b599490aa486cb68967e8dc2d0870"),
    defineDiagnosticEvidenceAdapterRowV1(138, "qa-key-public-bytes-invalid", "qa-key-public-bytes-invalid", "registry_approver_history", "qa-key-public-bytes-invalid", undefined, "qa_approver_key_structure", "schema_invalid", 2, 14, "sha256:fcae57764ce9eab3b8ded13d77378f6474292a9cc3ed923a66fe6f35b5573da1", "registry_history_closure", "source_invalid", 24, 37, "sha256:d570841a02513db39d2d1a2f2971d9bda81ea4c207ae34ac20d2f0c30421e427"),
    defineDiagnosticEvidenceAdapterRowV1(139, "qa-key-registry-signature-format-invalid", "qa-key-registry-signature-format-invalid", "registry_approver_history", "qa-key-registry-signature-format-invalid", undefined, "qa_approver_key_structure", "schema_invalid", 2, 14, "sha256:b9fa4fad3e4c21b2309be272c879de19a46a26d92c28c6fe322faf5229177a7f", "registry_history_closure", "source_invalid", 24, 37, "sha256:00188489fb56481ef9a6f7e1fc86c0320dc75a59a7c16153e46f55164d7897ee"),
    defineDiagnosticEvidenceAdapterRowV1(140, "qa-key-extra-field", "qa-key-extra-field", "registry_approver_history", "qa-key-extra-field", undefined, "qa_approver_key_structure", "schema_invalid", 2, 14, "sha256:27d5f138f67ccf1eeb3a128f3410da2d68e58199a001e955c4ac40e00ae0cf7b", "registry_history_closure", "source_invalid", 24, 37, "sha256:79334c153b71c631c568d21b5d5fa55dd7597a9a8473a3e1ec798bfbd37dd0a3"),
    defineDiagnosticEvidenceAdapterRowV1(141, "release-key-profile-invalid", "release-key-profile-invalid", "registry_approver_history", "release-key-profile-invalid", undefined, "release_approver_key_structure", "schema_invalid", 2, 14, "sha256:860523e9fd0706399a6e167e3127b3a17ff47e8a4a6c235e98a2c00312f14af4", "registry_history_closure", "source_invalid", 24, 37, "sha256:098dfbb903172b2bb2818d7b1469f1efc02044628305f560bc87e68ca6236016"),
    defineDiagnosticEvidenceAdapterRowV1(142, "release-key-generation-zero", "release-key-generation-zero", "registry_approver_history", "release-key-generation-zero", undefined, "release_approver_key_structure", "schema_invalid", 2, 14, "sha256:5ecdb1f11f4b50d8e276eca41d2a153fe9e45fe81624e4b51450f4d1c7a307cb", "registry_history_closure", "source_invalid", 24, 37, "sha256:1b5bc458512c93ba4b8d5817258c3941cef94de4b998342f892bedbb67da4ae2"),
    defineDiagnosticEvidenceAdapterRowV1(143, "release-key-algorithm-invalid", "release-key-algorithm-invalid", "registry_approver_history", "release-key-algorithm-invalid", undefined, "release_approver_key_structure", "schema_invalid", 2, 14, "sha256:9074577113313d4bff1e0ca4651f8be56de4a3c873f8e41a6218ea53c283e1af", "registry_history_closure", "source_invalid", 24, 37, "sha256:896c4cec26200c6c38e41efb25ca864c649c190e04ebeeb96dcb52bcf19fe376"),
    defineDiagnosticEvidenceAdapterRowV1(144, "release-key-public-bytes-invalid", "release-key-public-bytes-invalid", "registry_approver_history", "release-key-public-bytes-invalid", undefined, "release_approver_key_structure", "schema_invalid", 2, 14, "sha256:8e8456f1e74bac8fc5a57b69974c8a0aa348bcd73e18c3d9808f4e915f3e5a04", "registry_history_closure", "source_invalid", 24, 37, "sha256:0fe3984ec73d114a2af98c27eb6b349283af69d9efa09a9caeedbe2c6443eebb"),
    defineDiagnosticEvidenceAdapterRowV1(145, "release-key-registry-signature-format-invalid", "release-key-registry-signature-format-invalid", "registry_approver_history", "release-key-registry-signature-format-invalid", undefined, "release_approver_key_structure", "schema_invalid", 2, 14, "sha256:d6932178b365195fd4d237509cd42dcfb20d9edcbe12f9b3268b1d95e65df166", "registry_history_closure", "source_invalid", 24, 37, "sha256:8ec55b8412fd4ea50728d79853d9ac77754f9b5d3ff0d8cfe562291056c791c2"),
    defineDiagnosticEvidenceAdapterRowV1(146, "release-key-extra-field", "release-key-extra-field", "registry_approver_history", "release-key-extra-field", undefined, "release_approver_key_structure", "schema_invalid", 2, 14, "sha256:5b4b151069b0938cd0931b979ec75681c32a0f14e97438077ab50909e174bc6e", "registry_history_closure", "source_invalid", 24, 37, "sha256:9a456b5295cb663cb5239e6d7b4cde67b7a20f849663d3be15daa0b14dae3ca4"),
    defineDiagnosticEvidenceAdapterRowV1(147, "qa-key-role-key-id-compound", "qa-key-role-key-id-compound", "registry_approver_history", "qa-key-role-key-id-compound", undefined, "qa_approver_key_identity", "binding_mismatch", 2, 14, "sha256:d4dc58f307c75ed5aebcfa1f70f08115d6c7b8642a57acb97adb524bff24d0de", "registry_history_closure", "source_invalid", 24, 37, "sha256:6a32d5bc5dfb6655c821497a9ce0e251f4b987e4232f8ec9a7b848b30ca6765f"),
    defineDiagnosticEvidenceAdapterRowV1(148, "qa-key-id-mismatch", "qa-key-id-mismatch", "registry_approver_history", "qa-key-id-mismatch", undefined, "qa_approver_key_identity", "identity_mismatch", 2, 14, "sha256:9a7093cb1aea4241706f9c836df4f5b8c110abbe6a6d8ad0ed4613aaa11a8312", "registry_history_closure", "source_invalid", 24, 37, "sha256:62b9cef321eaef79f68679fe31d8c415476d74c37405c19f0ab8e6c637f7956c"),
    defineDiagnosticEvidenceAdapterRowV1(149, "qa-key-id-digest-compound", "qa-key-id-digest-compound", "registry_approver_history", "qa-key-id-digest-compound", undefined, "qa_approver_key_identity", "identity_mismatch", 2, 14, "sha256:0bfff42cd2c6930f3f7a42aad94ce2775fc8d9d0a7ea32cf73be39f62477b2df", "registry_history_closure", "source_invalid", 24, 37, "sha256:c7c7dbf08d77ff2301fdef60d90046c26935c5381ae998959fde28ceb199f341"),
    defineDiagnosticEvidenceAdapterRowV1(150, "qa-key-digest-mismatch", "qa-key-digest-mismatch", "registry_approver_history", "qa-key-digest-mismatch", undefined, "qa_approver_key_identity", "digest_mismatch", 2, 14, "sha256:7a5938d40b9253111f79e4999fb6e496fccffbf06f1ec1e256d1a2b9ee7a7e09", "registry_history_closure", "source_invalid", 24, 37, "sha256:6b0826cad54e833be77be98ad691eb618ffe1f32ba4ceab673f887e8307d8ac8"),
    defineDiagnosticEvidenceAdapterRowV1(151, "release-key-role-key-id-compound", "release-key-role-key-id-compound", "registry_approver_history", "release-key-role-key-id-compound", undefined, "release_approver_key_identity", "binding_mismatch", 2, 14, "sha256:151a357c7fcbefecc22585dddea64296e78372a98b2e68427f06de018202277c", "registry_history_closure", "source_invalid", 24, 37, "sha256:8e1dd94ec8dc739178283e00f954580f56a23519dbe5096c17b70bb7c39e4d63"),
    defineDiagnosticEvidenceAdapterRowV1(152, "release-key-id-mismatch", "release-key-id-mismatch", "registry_approver_history", "release-key-id-mismatch", undefined, "release_approver_key_identity", "identity_mismatch", 2, 14, "sha256:6b787b3af943f5766b617816f8f9c8db781ac00882584667c637ea252d3de7a5", "registry_history_closure", "source_invalid", 24, 37, "sha256:4809c714661a306e40ddad3cb8229fac5c5ce73384891b211785789258e0db3b"),
    defineDiagnosticEvidenceAdapterRowV1(153, "release-key-id-digest-compound", "release-key-id-digest-compound", "registry_approver_history", "release-key-id-digest-compound", undefined, "release_approver_key_identity", "identity_mismatch", 2, 14, "sha256:22ec73e4cee7e37ee18fe239fb114509cab29460db31cd5233780af3a7f92cd1", "registry_history_closure", "source_invalid", 24, 37, "sha256:2033f78d5e14f392d197f38d4e457585c68a2b9369728db016b24aee62275c36"),
    defineDiagnosticEvidenceAdapterRowV1(154, "release-key-digest-mismatch", "release-key-digest-mismatch", "registry_approver_history", "release-key-digest-mismatch", undefined, "release_approver_key_identity", "digest_mismatch", 2, 14, "sha256:fedb63baca147f1383e74ef1b4f12f1c36658ba24798880e4ada07d8e0c5503e", "registry_history_closure", "source_invalid", 24, 37, "sha256:36c7fac7a11701d5a63234b306df97309e9f57ba89e142e0b5c6b4b0f67176a5"),
    defineDiagnosticEvidenceAdapterRowV1(155, "approver-qa-release-material-alias", "approver-qa-release-material-alias", "registry_approver_history", "approver-qa-release-material-alias", undefined, "approver_key_separation", "binding_mismatch", 2, 14, "sha256:37b922dd9952bb02797a1fee1c78d9adfbeba65d9f7b8e5d0f5ee8a2ab62dc58", "registry_history_closure", "source_invalid", 24, 37, "sha256:52cb776113a534e89d4dfc92847d3d8c336b4bdce958845e08e0d5f0cde67746"),
    defineDiagnosticEvidenceAdapterRowV1(156, "approver-qa-root-material-alias", "approver-qa-root-material-alias", "registry_approver_history", "approver-qa-root-material-alias", undefined, "approver_key_separation", "binding_mismatch", 2, 14, "sha256:ca4e88d445558fcb1a48f3aebb83e90d0d845603313fa12a9000174d3937d90c", "registry_history_closure", "source_invalid", 24, 37, "sha256:6c3a62759e7d29ad1d002f6e7db2104dd5b67679b1031d0b3908e07b85fdadce"),
    defineDiagnosticEvidenceAdapterRowV1(157, "approver-release-root-material-alias", "approver-release-root-material-alias", "registry_approver_history", "approver-release-root-material-alias", undefined, "approver_key_separation", "binding_mismatch", 2, 14, "sha256:c57be2c0efac1fc9b91373b5fdc8bab09f9e575ba9db195b2ee157092ab4fac4", "registry_history_closure", "source_invalid", 24, 37, "sha256:9bea8e7d3059a4a0bdbccd3dfd1f3ffdf932bba6886d81e839c47d179027aef7"),
    defineDiagnosticEvidenceAdapterRowV1(158, "qa-key-root-mismatch", "qa-key-root-mismatch", "registry_approver_history", "qa-key-root-mismatch", undefined, "qa_approver_key_root", "root_mismatch", 2, 14, "sha256:67dd7a396c9f4f1263f94fa3d73611be36e037c00d58f0209e0b8effc85dc3e6", "registry_history_closure", "source_invalid", 24, 37, "sha256:dc33145b1c1963e38cf809f68a2f2102c3a63a3587cfa96dbe9c2af061cbba05"),
    defineDiagnosticEvidenceAdapterRowV1(159, "release-key-root-mismatch", "release-key-root-mismatch", "registry_approver_history", "release-key-root-mismatch", undefined, "release_approver_key_root", "root_mismatch", 2, 14, "sha256:741ff8ff6f86d7e4ab9732538a17e6a10dffaa37d42b35f3d0a14a598899b832", "registry_history_closure", "source_invalid", 24, 37, "sha256:a073ff7c9d92a1658a15b0f56522f606436fa8f84563813445d18a333f479b30"),
    defineDiagnosticEvidenceAdapterRowV1(160, "qa-key-point-invalid", "qa-key-point-invalid", "registry_approver_history", "qa-key-point-invalid", undefined, "qa_approver_key_admission", "public_key_invalid", 4, 14, "sha256:3e4a63e08b50e68eb51300c949fc4a7142968de76fd97e543f2636db5baa21e7", "registry_history_closure", "source_invalid", 24, 37, "sha256:6dca5758652def5a255170487532551f9e696fc752155ced8dad570ddae2f3dd"),
    defineDiagnosticEvidenceAdapterRowV1(161, "release-key-point-invalid", "release-key-point-invalid", "registry_approver_history", "release-key-point-invalid", undefined, "release_approver_key_admission", "public_key_invalid", 6, 14, "sha256:0f9a5ac67124a681a329cfa24f3772f20af237b504883da3844b57328059e046", "registry_history_closure", "source_invalid", 24, 37, "sha256:2d06a3ad0b4a1d0b78c976adb700899d24478f74ad1a9947a36da469c1c94df9"),
    defineDiagnosticEvidenceAdapterRowV1(162, "qa-key-signature-bitflip", "qa-key-signature-bitflip", "registry_approver_history", "qa-key-signature-bitflip", undefined, "qa_approver_key_signature", "signature_invalid", 6, 16, "sha256:e5fc74e6145545538d1b03ce32feaa6c437e34dfd11016639b8417c4f7c632eb", "registry_history_closure", "source_invalid", 24, 37, "sha256:45a66c3c9dd375775f784eb42ceac789bf3d84bc6c11796d507047ea884a59a2"),
    defineDiagnosticEvidenceAdapterRowV1(163, "qa-key-signature-wrong-signer", "qa-key-signature-wrong-signer", "registry_approver_history", "qa-key-signature-wrong-signer", undefined, "qa_approver_key_signature", "signature_invalid", 6, 16, "sha256:471769de9d05fa179b8ccad418990c6cc11702520e9d466759bbd9aa2268c10f", "registry_history_closure", "source_invalid", 24, 37, "sha256:c59c142170aad7574662d5034997968f65d63e93e5904390e50bd39865776e10"),
    defineDiagnosticEvidenceAdapterRowV1(164, "qa-key-signature-wrong-domain", "qa-key-signature-wrong-domain", "registry_approver_history", "qa-key-signature-wrong-domain", undefined, "qa_approver_key_signature", "signature_invalid", 6, 16, "sha256:5c55cbcce7880614b93242fb5f38aa8718d341f3b365efbdcfce7e75f326fcc9", "registry_history_closure", "source_invalid", 24, 37, "sha256:6fd7d5d8c1c530f026cf85c82da29d993abdc45f598ff975de3513fd50c7df88"),
    defineDiagnosticEvidenceAdapterRowV1(165, "release-key-signature-bitflip", "release-key-signature-bitflip", "registry_approver_history", "release-key-signature-bitflip", undefined, "release_approver_key_signature", "signature_invalid", 6, 18, "sha256:39efab8bba4ac98965abed1f629c18a5601bb4fae9a8c1fe11606491b2e9cedc", "registry_history_closure", "source_invalid", 24, 37, "sha256:5b1f756597c13b9a6f7051b8ef7be0b1a07b4ac79a477c8d563f7669eee56aa5"),
    defineDiagnosticEvidenceAdapterRowV1(166, "release-key-signature-wrong-signer", "release-key-signature-wrong-signer", "registry_approver_history", "release-key-signature-wrong-signer", undefined, "release_approver_key_signature", "signature_invalid", 6, 18, "sha256:82a53b4405e951e590a0a978408597791567868a62daf69c1b263e750dc4d221", "registry_history_closure", "source_invalid", 24, 37, "sha256:7856170e9932b34e73c76e601ede281e7872fc60b713645a520b6f96b6d44667"),
    defineDiagnosticEvidenceAdapterRowV1(167, "release-key-signature-wrong-domain", "release-key-signature-wrong-domain", "registry_approver_history", "release-key-signature-wrong-domain", undefined, "release_approver_key_signature", "signature_invalid", 6, 18, "sha256:41f6901137a4571249b67108d0b3b1aa6f185eb8b3aadafe0c4297dd89b2ef12", "registry_history_closure", "source_invalid", 24, 37, "sha256:0f5f36aeec0510622895e02a00aa7410f397d20a478b98a55834c4e73c6dc137"),
    defineDiagnosticEvidenceAdapterRowV1(168, "evidence-provider-binding-mismatch", "evidence-provider-binding-mismatch", "evidence_unsigned_reanchor", "evidence-provider-binding-mismatch", undefined, "evidence_result_binding", "binding_mismatch", 6, 18, "sha256:60431c07d7df5aae6cf418fd9d17aecd898542c50284b1f526be4ef8b285c011", "candidate_member_resolution", "member_not_enabled", 24, 38, "sha256:1a48402638934ccb5de1061f01eb16bb723b6d10286a26e321a153ff362d1a73"),
    defineDiagnosticEvidenceAdapterRowV1(169, "evidence-policy-digest-binding-mismatch", "evidence-policy-digest-binding-mismatch", "evidence_unsigned_reanchor", "evidence-policy-digest-binding-mismatch", undefined, "evidence_result_binding", "binding_mismatch", 6, 18, "sha256:4993f8c59dbe912f53b2f779e849ff5d10fe514bc8aa13a106ce95e48782abdd", "evidence_result_binding", "binding_mismatch", 24, 44, "sha256:0aa44a39c17b65a3b8fdd426dc0ddeab3c71e1cf06b0df2ef2dce7a3e8739e13"),
    defineDiagnosticEvidenceAdapterRowV1(170, "evidence-implementation-binding-mismatch", "evidence-implementation-binding-mismatch", "evidence_unsigned_reanchor", "evidence-implementation-binding-mismatch", undefined, "evidence_result_binding", "binding_mismatch", 6, 18, "sha256:126427d01200c84407ab2c2d9260ca32e119c51d313bb0bb8f6cbc2bdd326119", "evidence_result_binding", "binding_mismatch", 24, 44, "sha256:8790253092fdbb7b85fa42d152ba1faadf1bd0be611725fd5dad718c187d5241"),
    defineDiagnosticEvidenceAdapterRowV1(171, "evidence-binary-binding-mismatch", "evidence-binary-binding-mismatch", "evidence_unsigned_reanchor", "evidence-binary-binding-mismatch", undefined, "evidence_result_binding", "binding_mismatch", 6, 18, "sha256:4fdeafcc4fa5bfb5bb63a0f5d7201fc4119b73431097c521c8b4b9ec37272268", "evidence_result_binding", "binding_mismatch", 24, 44, "sha256:7563184fd4ef4c91a5ccc21d0a1598d4ee241c66f798b971b425fc1a8a361fe9"),
    defineDiagnosticEvidenceAdapterRowV1(172, "evidence-target-profile-id-binding-mismatch", "evidence-target-profile-id-binding-mismatch", "evidence_unsigned_reanchor", "evidence-target-profile-id-binding-mismatch", undefined, "evidence_result_binding", "binding_mismatch", 6, 18, "sha256:bc3c17fabca134bd8fc0a8d2e3d9e1dd06c8689f9c9e4a2b5c29b57ee00ea1b7", "evidence_result_binding", "binding_mismatch", 24, 44, "sha256:0eafefc0ac3afe9cb0d428bb75b94b81e1e12b311cc091613ac2f7129fcff8a0"),
    defineDiagnosticEvidenceAdapterRowV1(173, "evidence-target-os-platform-binding-mismatch", "evidence-target-os-platform-binding-mismatch", "evidence_unsigned_reanchor", "evidence-target-os-platform-binding-mismatch", undefined, "evidence_result_binding", "binding_mismatch", 6, 18, "sha256:c6ae1a3fefa836fa5bc65c03cdbf67503ea13825d7cb398c5c94322340e57d44", "evidence_result_binding", "binding_mismatch", 24, 44, "sha256:d46888225de73e102a0bb26c89277c87dfe186d0d458a3fd59fcc93e5cc2b250"),
    defineDiagnosticEvidenceAdapterRowV1(174, "evidence-target-os-family-binding-mismatch", "evidence-target-os-family-binding-mismatch", "evidence_unsigned_reanchor", "evidence-target-os-family-binding-mismatch", undefined, "evidence_result_binding", "binding_mismatch", 6, 18, "sha256:6a138ae8d722b8ed76f0b8a142d14ad56a243e0891e3971d8c2d86df9241a1d3", "evidence_result_binding", "binding_mismatch", 24, 44, "sha256:93c1aa8ffd0b06c40a2924fea358a36a279849be411b6b32cd99d1dfa006d791"),
    defineDiagnosticEvidenceAdapterRowV1(175, "evidence-target-os-build-binding-mismatch", "evidence-target-os-build-binding-mismatch", "evidence_unsigned_reanchor", "evidence-target-os-build-binding-mismatch", undefined, "evidence_result_binding", "binding_mismatch", 6, 18, "sha256:f33b463d4fd1ba521a3b0efce16d6688c70724e449b3e5f1a1c3723a2c222e91", "evidence_result_binding", "binding_mismatch", 24, 44, "sha256:821f473224b2f54651db1d08948549fe8ac6dcdaa266ac93e265e9a45e4293f8"),
    defineDiagnosticEvidenceAdapterRowV1(176, "evidence-target-architecture-binding-mismatch", "evidence-target-architecture-binding-mismatch", "evidence_unsigned_reanchor", "evidence-target-architecture-binding-mismatch", undefined, "evidence_result_binding", "binding_mismatch", 6, 18, "sha256:631e4527a50c67c7a996ef7d6722b600c9d0a3b13285193dc3a107e6a01f7b71", "evidence_result_binding", "binding_mismatch", 24, 44, "sha256:690535c2c6a1e1f59e921de573931cc83c7c9e4c2af119ccec5af1c102ea23a3"),
    defineDiagnosticEvidenceAdapterRowV1(177, "evidence-target-filesystem-profile-binding-mismatch", "evidence-target-filesystem-profile-binding-mismatch", "evidence_unsigned_reanchor", "evidence-target-filesystem-profile-binding-mismatch", undefined, "evidence_result_binding", "binding_mismatch", 6, 18, "sha256:f270e82e6941d8b20b764d806a6683944d5edd6ea3e902be8c989771c94edf00", "evidence_result_binding", "binding_mismatch", 24, 44, "sha256:af7a183e1bdda98746daf8081fe918513902bd2f1b84448f60948ec34b436306"),
    defineDiagnosticEvidenceAdapterRowV1(178, "evidence-target-filesystem-feature-binding-mismatch", "evidence-target-filesystem-feature-binding-mismatch", "evidence_unsigned_reanchor", "evidence-target-filesystem-feature-binding-mismatch", undefined, "evidence_result_binding", "binding_mismatch", 6, 18, "sha256:586f0218e86a6ee3f6f53bb429719ab2365176c2e392f75fceda3e8e9150a5e3", "evidence_result_binding", "binding_mismatch", 24, 44, "sha256:7e32729e29d06e5c6c6e650fde371349e0fa1b8db3aabfa8bfcb0db593f76de1"),
    defineDiagnosticEvidenceAdapterRowV1(179, "evidence-target-mount-option-binding-mismatch", "evidence-target-mount-option-binding-mismatch", "evidence_unsigned_reanchor", "evidence-target-mount-option-binding-mismatch", undefined, "evidence_result_binding", "binding_mismatch", 6, 18, "sha256:0dc0bd0633f074b67d245fdb7fc045f905b7bf7ada387d9a1dff5e6a10e2cf31", "evidence_result_binding", "binding_mismatch", 24, 44, "sha256:9bfd7a5272a827cf282418ae71cccb8b6ed3e52e0fffeb5b57243fa1937e62f5"),
    defineDiagnosticEvidenceAdapterRowV1(180, "evidence-suite-binding-mismatch", "evidence-suite-binding-mismatch", "evidence_unsigned_reanchor", "evidence-suite-binding-mismatch", undefined, "evidence_result_binding", "binding_mismatch", 6, 18, "sha256:d940fc2a22997f5a39e9c01e5c149ce02341dd33f249bd258203317d949f5ea5", "evidence_result_binding", "binding_mismatch", 24, 44, "sha256:441742710f592a6951a986a6b16cfde93769c27b52214a75af0cd96b8abc99a8"),
    defineDiagnosticEvidenceAdapterRowV1(181, "evidence-fixture-binding-mismatch", "evidence-fixture-binding-mismatch", "evidence_unsigned_reanchor", "evidence-fixture-binding-mismatch", undefined, "evidence_result_binding", "binding_mismatch", 6, 18, "sha256:c2a24658ad64e9b09ac2f6cee768468951a15f716031071a320f91992800fdef", "evidence_result_binding", "binding_mismatch", 24, 44, "sha256:5546ab0b074821229798e3b61f60117fa014c2fa7113c6ed5bd804fc2e827dda"),
    defineDiagnosticEvidenceAdapterRowV1(182, "evidence-runner-binding-mismatch", "evidence-runner-binding-mismatch", "evidence_unsigned_reanchor", "evidence-runner-binding-mismatch", undefined, "evidence_result_binding", "binding_mismatch", 6, 18, "sha256:e579c16bdce74ab0f5e98b3ac4dcd11b576030b81db7965a818e687244174f1b", "evidence_result_binding", "binding_mismatch", 24, 44, "sha256:1355d8cd2531b7e35cd92c95c9536a340572c0dc97978e705945cca3837e8243"),
    defineDiagnosticEvidenceAdapterRowV1(183, "evidence-crash-cut-binding-mismatch", "evidence-crash-cut-binding-mismatch", "evidence_unsigned_reanchor", "evidence-crash-cut-binding-mismatch", undefined, "evidence_result_binding", "binding_mismatch", 6, 18, "sha256:b6d70d5ea2763945c273bc1f2b27b718b4537b27d094e275ab3e8c575e7d94cb", "evidence_result_binding", "binding_mismatch", 24, 44, "sha256:3667c8cc6db689971dc66cce0ed5e36ce7f6cf8c11a8bd91b67d6c69b3c22279"),
    defineDiagnosticEvidenceAdapterRowV1(184, "evidence-result-binding-mismatch", "evidence-result-binding-mismatch", "evidence_unsigned_reanchor", "evidence-result-binding-mismatch", undefined, "evidence_result_binding", "binding_mismatch", 6, 18, "sha256:48d5e7dc16f60f406fb96512e1996c8e3a044cf5c05e5c8cdced2231804a5cc8", "evidence_result_binding", "binding_mismatch", 24, 44, "sha256:b87e3aa8ae21fd95b25357870d4b9ef08f7739c88d0111aba87a4ce2b672178c"),
    defineDiagnosticEvidenceAdapterRowV1(185, "evidence-ordinary-result-pin-compound", "evidence-ordinary-result-pin-compound", "evidence_unsigned_reanchor", "evidence-ordinary-result-pin-compound", undefined, "evidence_result_binding", "binding_mismatch", 6, 18, "sha256:9f14234a74d1f60c4c9d889c12451823f9669d309e290f0d7b66bfe74779c17d", "candidate_member_resolution", "member_not_enabled", 24, 38, "sha256:bbcb45342d3c9490029ca88afdc4d218ef9a3d21f6388a4023863a519c821cb0"),
    defineDiagnosticEvidenceAdapterRowV1(186, "evidence-result-pin-mismatch", "evidence-result-pin-mismatch", "evidence_unsigned_reanchor", "evidence-result-pin-mismatch", undefined, "evidence_result_binding", "pin_mismatch", 6, 18, "sha256:1eb588ab291a5334f3edd6f2f3854a3acc1badf4bdeea356e77753f780bc816e", "evidence_result_binding", "pin_mismatch", 24, 44, "sha256:8112085c5a333a689b856adeb63c2d6396211a73e46a950aee737707b1510ff2"),
    defineDiagnosticEvidenceAdapterRowV1(187, "evidence-result-pin-digest-compound", "evidence-result-pin-digest-compound", "evidence_unsigned_reanchor", "evidence-result-pin-digest-compound", undefined, "evidence_result_binding", "pin_mismatch", 6, 18, "sha256:ee7db8ea9fe3e58c63cc74f455959c5dfcf07da9c12fe71e7b62440e1945da1b", "evidence_result_binding", "pin_mismatch", 24, 44, "sha256:6bdcaab06159b338f03d42462788dad3ab6b4194ca0b8284204b22b88247eecc"),
    defineDiagnosticEvidenceAdapterRowV1(188, "evidence-result-digest-mismatch", "evidence-result-digest-mismatch", "evidence_unsigned_reanchor", "evidence-result-digest-mismatch", undefined, "evidence_result_binding", "digest_mismatch", 6, 18, "sha256:907a03505cddf4ca72ca5182ed6c93f184cb75cdf1cbc996d631682c2e7caa21", "evidence_result_binding", "digest_mismatch", 24, 44, "sha256:9a63ec626e5b1b3735d526227e365bad63a0fccdc53cf719eb21bd43839ac975"),
    defineDiagnosticEvidenceAdapterRowV1(189, "evidence-policy-isolation-binding-mismatch", "evidence-policy-isolation-binding-mismatch", "evidence_unsigned_reanchor", "evidence-policy-isolation-binding-mismatch", undefined, "evidence_policy_binding", "digest_mismatch", 6, 18, "sha256:1d26255ea26e3cc355c57674da5a39c13b263f2deb7b7354a1c2514a8d9cea84", "evidence_policy_binding", "digest_mismatch", 24, 44, "sha256:9ddba7c4617715516baf356d35d35ef1644f0f81f9479ee47d5456057fca4dbf"),
    defineDiagnosticEvidenceAdapterRowV1(190, "evidence-policy-ipc-binding-mismatch", "evidence-policy-ipc-binding-mismatch", "evidence_unsigned_reanchor", "evidence-policy-ipc-binding-mismatch", undefined, "evidence_policy_binding", "digest_mismatch", 6, 18, "sha256:0d94e9f04ea4dbdc2946ef53e9d00c687859d4c990135d1c928b3995b5ad2efa", "evidence_policy_binding", "digest_mismatch", 24, 44, "sha256:5ccfc3bc1a5740201dc4c04944fe4317829a8d4cdbcdabcc191f33d45632b906"),
    defineDiagnosticEvidenceAdapterRowV1(191, "evidence-policy-suite-binding-mismatch", "evidence-policy-suite-binding-mismatch", "evidence_unsigned_reanchor", "evidence-policy-suite-binding-mismatch", undefined, "evidence_result_binding", "binding_mismatch", 6, 18, "sha256:e55bd4dc1bdb8759f31d84e52197eccaaa2e388ebfc6f3c4e3f35c93750c0e34", "evidence_result_binding", "binding_mismatch", 24, 44, "sha256:441742710f592a6951a986a6b16cfde93769c27b52214a75af0cd96b8abc99a8"),
    defineDiagnosticEvidenceAdapterRowV1(192, "evidence-runtime-attestation-digest-mismatch", "evidence-runtime-attestation-digest-mismatch", "evidence_unsigned_reanchor", "evidence-runtime-attestation-digest-mismatch", undefined, "evidence_runtime_binding", "digest_mismatch", 6, 18, "sha256:948e65a2ccadd2a35bd20626b0d4f97f52ec4e0561bfa0bbeb56d0b3a78170b0", "evidence_runtime_binding", "digest_mismatch", 24, 44, "sha256:4223f82e0c109a22a6476453275fcd4da6f9a8eb56ca518903f5d87707a87c85"),
    defineDiagnosticEvidenceAdapterRowV1(193, "evidence-time-before-one-nanosecond", "evidence-time-before-one-nanosecond", "evidence_unsigned_reanchor", "evidence-time-before-one-nanosecond", undefined, "evidence_time", "ordering_invalid", 6, 18, "sha256:15c3b578979ddcd68fd37197934aee2fe5b8a7dc6567c4e8aad6f80c1ceaad60", "evidence_time", "ordering_invalid", 24, 44, "sha256:0bda47bf595026f2ef24945eaf47501992baea8e8b8658d706ac9b86c71d561e"),
    defineDiagnosticEvidenceAdapterRowV1(194, "evidence-id-mismatch", "evidence-id-mismatch", "evidence_direct", "evidence-id-mismatch", undefined, "evidence_id", "identity_mismatch", 6, 18, "sha256:abfe57110086f2a2e49a395dc8a9fd803d3c4bb7da0f626e58b7fdb5412dd5ba", "evidence_id", "identity_mismatch", 24, 44, "sha256:7be4e5afcfd0a6a80e3b2f444b362768b48fba79a6de75698e8f810f10aa9971"),
    defineDiagnosticEvidenceAdapterRowV1(195, "evidence-qa-signature-key-id-mismatch", "evidence-qa-signature-key-id-mismatch", "evidence_direct", "evidence-qa-signature-key-id-mismatch", undefined, "evidence_qa_signature_binding", "binding_mismatch", 6, 18, "sha256:045a0130f9e36c8a9d40eaa0aee9dad8398b7b10372c6b7030814a087b88c342", "qa_approver_resolution", "approver_not_found", 24, 44, "sha256:6067cf456395dc1db86d9ab95ea63c502b9cc1080724dd4a65e8f517ea353e38"),
    defineDiagnosticEvidenceAdapterRowV1(196, "evidence-release-signature-key-id-mismatch", "evidence-release-signature-key-id-mismatch", "evidence_direct", "evidence-release-signature-key-id-mismatch", undefined, "evidence_release_signature_binding", "binding_mismatch", 6, 18, "sha256:64056cb47f7607e4aeb9f52ef5b42baec23a30da4665125ec22dd4df19096812", "release_approver_resolution", "approver_not_found", 24, 44, "sha256:781e08b0a63c6e859d5b013767c3b1bdf6e6a10b923e01c6792826ee934b12ea"),
    defineDiagnosticEvidenceAdapterRowV1(197, "evidence-qa-signature-bitflip", "evidence-qa-signature-bitflip", "evidence_direct", "evidence-qa-signature-bitflip", undefined, "evidence_qa_signature", "signature_invalid", 6, 20, "sha256:7fd7c70be4eef8ce029a1348fadea594d500a55c8940066f8e945b1ef600d3ad", "evidence_qa_signature", "signature_invalid", 24, 45, "sha256:d1d2840e99d0d55bc6c00a7e2e42d36caaf4f33064b65c55cf9caebebd9ee4c7"),
    defineDiagnosticEvidenceAdapterRowV1(198, "evidence-qa-signature-wrong-signer", "evidence-qa-signature-wrong-signer", "evidence_signature_reanchor", "evidence-qa-signature-wrong-signer", undefined, "evidence_qa_signature", "signature_invalid", 6, 20, "sha256:9c50333047926ed47182945b47d882f59ac9cc477d681c5b0d476bbfb164a332", "evidence_qa_signature", "signature_invalid", 24, 45, "sha256:9b1cace78aa03d4166a662c2a8b82fbff05c800c528c319a4b8ff2d2c146150c"),
    defineDiagnosticEvidenceAdapterRowV1(199, "evidence-qa-signature-wrong-domain", "evidence-qa-signature-wrong-domain", "evidence_signature_reanchor", "evidence-qa-signature-wrong-domain", undefined, "evidence_qa_signature", "signature_invalid", 6, 20, "sha256:223fcf64916ea67a2e8dd205cfd2ef1c725e387f9baff10bc69ab289ff77d79f", "evidence_qa_signature", "signature_invalid", 24, 45, "sha256:9406640bf12efc20a35a54cc537d1d76760467d3f0e67f2838fab548aae107b7"),
    defineDiagnosticEvidenceAdapterRowV1(200, "evidence-qa-signature-wrong-role-wrapper", "evidence-qa-signature-wrong-role-wrapper", "evidence_signature_reanchor", "evidence-qa-signature-wrong-role-wrapper", undefined, "evidence_qa_signature", "signature_invalid", 6, 20, "sha256:556d700655a75ee9a823d3d8bdea05f35388aa5f8c78d0827731ac26e0851b6c", "evidence_qa_signature", "signature_invalid", 24, 45, "sha256:a22d9a3be26f9202769c4e58241b0ec79eda344534726f7b3f1006c072901ed4"),
    defineDiagnosticEvidenceAdapterRowV1(201, "evidence-release-signature-bitflip", "evidence-release-signature-bitflip", "evidence_direct", "evidence-release-signature-bitflip", undefined, "evidence_release_signature", "signature_invalid", 6, 22, "sha256:d82cc441ab620f3e5430df016baa8f0116f4c974f8301625dcf2064240a65293", "evidence_release_signature", "signature_invalid", 24, 46, "sha256:a410b8ebf78a565ecfc7b0b8d2e5caf497390be79db4eb334e706917ab7cce85"),
    defineDiagnosticEvidenceAdapterRowV1(202, "evidence-release-signature-wrong-signer", "evidence-release-signature-wrong-signer", "evidence_signature_reanchor", "evidence-release-signature-wrong-signer", undefined, "evidence_release_signature", "signature_invalid", 6, 22, "sha256:f1178f6e4784727751ce93b525788a15dfcc99a0d5af7390808ab32acd7c5e25", "evidence_release_signature", "signature_invalid", 24, 46, "sha256:401804db6d72242c38402ffb3824d1062a89bd7f878b91882c08dd3fa8ae7134"),
    defineDiagnosticEvidenceAdapterRowV1(203, "evidence-release-signature-wrong-domain", "evidence-release-signature-wrong-domain", "evidence_signature_reanchor", "evidence-release-signature-wrong-domain", undefined, "evidence_release_signature", "signature_invalid", 6, 22, "sha256:d64e3a410f5e1c73f8a538a347343915492a99e06bc00a7637547d5668086950", "evidence_release_signature", "signature_invalid", 24, 46, "sha256:3a916e38cf88c767815065920df9371e10f7f192b5c13c3fe5b411e24a293462"),
    defineDiagnosticEvidenceAdapterRowV1(204, "evidence-release-signature-wrong-role-wrapper", "evidence-release-signature-wrong-role-wrapper", "evidence_signature_reanchor", "evidence-release-signature-wrong-role-wrapper", undefined, "evidence_release_signature", "signature_invalid", 6, 22, "sha256:94d00bc4132c87a7b2a8f276107f7bda19f98d28b06a5e03a322d577892d7a47", "evidence_release_signature", "signature_invalid", 24, 46, "sha256:7b63220e416c92b268935a55c9ec3ba90586343183f045a1f7498ff3893b59dd"),
    defineDiagnosticEvidenceAdapterRowV1(205, "evidence-signatures-swapped", "evidence-signatures-swapped", "evidence_direct", "evidence-signatures-swapped", undefined, "evidence_qa_signature", "signature_invalid", 6, 20, "sha256:0ebdb8351148ea9b004858d2886a7245c291979c36b09c508f6b6c10223ff5b3", "evidence_qa_signature", "signature_invalid", 24, 45, "sha256:41e24be399c582be35bf785c46edccac03c8f6e3bee8919544bc22647eab450b"),
    defineDiagnosticEvidenceAdapterRowV1(206, "evidence-content-digest-mismatch", "evidence-content-digest-mismatch", "evidence_direct_registry_reanchor", "evidence-content-digest-mismatch", undefined, "evidence_digest", "digest_mismatch", 6, 22, "sha256:7ebcf40bb751642fc26e57da66b649e0f5a9be459085455bf6643d459a881e5c", "evidence_digest", "digest_mismatch", 24, 46, "sha256:9cbdd117d0c8b6d79fe302400839a5ab3b5a7899d0c6a15f0ea89faab6cbd660"),
    defineDiagnosticEvidenceAdapterRowV1(207, "evidence-envelope-id-mismatch", "evidence-envelope-id-mismatch", "evidence_direct_registry_reanchor", "evidence-envelope-id-mismatch", undefined, "evidence_envelope", "envelope_mismatch", 6, 22, "sha256:90d765d69cd5abc920b26ae0bc5a7d13f4851f403c285923c09b0b91a4e38e6b", "evidence_envelope", "envelope_mismatch", 24, 46, "sha256:6da3a06c10fd74d515f40250381bdc92c1a50682f8ce52560c9176a41aeb9c4b"),
    defineDiagnosticEvidenceAdapterRowV1(208, "evidence-pin-id-mismatch", "evidence-pin-id-mismatch", "evidence_direct_registry_reanchor", "evidence-pin-id-mismatch", undefined, "evidence_pin", "pin_mismatch", 6, 22, "sha256:3deb0cd94323e8df21cc64dc7965aad3b477404b79a04b51bb917c318403f795", "evidence_pin", "pin_mismatch", 24, 46, "sha256:0016f3220b2a439172406fd7fdf565f2acfbb5475f0c73162397996f0615e750"),
    defineDiagnosticEvidenceAdapterRowV1(209, "evidence-pin-digest-mismatch", "evidence-pin-digest-mismatch", "evidence_direct_registry_reanchor", "evidence-pin-digest-mismatch", undefined, "evidence_pin", "pin_mismatch", 6, 22, "sha256:4b685db4116bbd6c479fe990de56418a6221f967c52a9d2d46cd79ed4dd62529", "evidence_pin", "pin_mismatch", 24, 46, "sha256:84d02271ee291bfb565a0fb1ab3d7d287f1b2f6ecd0c4874f42d2caf065b0b2e"),
    defineDiagnosticEvidenceAdapterRowV1(210, "point-input-extra-field", "point-input-extra-field", "point_hostile", "point-input-extra-field", "extra_field", "input", "schema_invalid", 0, 0, "sha256:3731e24df4fac83744d90a1d7c46170585410c8995d34db8dafb795bcbebac80", "input", "schema_invalid", 0, 0, "sha256:57fd69ba9083dd60201ec720bca634b5759cac563828b902d807f1f24cce6d62"),
    defineDiagnosticEvidenceAdapterRowV1(211, "point-input-plain-validation-dto", "point-input-plain-validation-dto", "point_hostile", "point-input-plain-validation-dto", "plain_validation_dto", "input", "schema_invalid", 0, 0, "sha256:7e47308cfc65cc84a79e1ca0bd2030096cb297d9398265527aa21511bb7bc90e", "input", "schema_invalid", 0, 0, "sha256:cf53b4bb6ff829869f63c7705a0c8c03493057738220d5f94f3d7041109b306a"),
    defineDiagnosticEvidenceAdapterRowV1(212, "point-security-top-level-proxy", "point-security-top-level-proxy", "point_hostile", "point-security-top-level-proxy", "top_level_proxy", "input", "schema_invalid", 0, 0, "sha256:60100165233e5562329a12ba40dd429f1e1885fa0f8777e1b1b96ce84a8347b2", "input", "schema_invalid", 0, 0, "sha256:3194ad0f1a84c60714a3769b6475bdbefd1db745a3890c47183d57c75d2c0d05"),
    defineDiagnosticEvidenceAdapterRowV1(213, "point-security-nested-proxy", "point-security-nested-proxy", "point_hostile", "point-security-nested-proxy", "nested_proxy", "input", "schema_invalid", 0, 0, "sha256:849d57c575e8249328682bd48ceda782d57ea602a62a36494fc0d072de39e2e9", "input", "schema_invalid", 0, 0, "sha256:ceb05198420028ba7fc836ee5fbc25001787963a73c9635d4b6c84492d49319a"),
    defineDiagnosticEvidenceAdapterRowV1(214, "point-security-top-level-getter", "point-security-top-level-getter", "point_hostile", "point-security-top-level-getter", "top_level_getter", "input", "schema_invalid", 0, 0, "sha256:d6d3b1a5d5e2a78b6e46f12ac6b7eddd4ef5718bb0d5dbf3a0c022aee595991b", "input", "schema_invalid", 0, 0, "sha256:766889c14eb61556b0f1a791bfdeb41baa1db77bd56ad404a1c29301bcb7918c"),
    defineDiagnosticEvidenceAdapterRowV1(215, "point-security-nested-getter", "point-security-nested-getter", "point_hostile", "point-security-nested-getter", "nested_getter", "input", "schema_invalid", 0, 0, "sha256:092a85d6043336211650c2d2f37e04e659a02ee5f36fd57016f81684e15bfcdc", "input", "schema_invalid", 0, 0, "sha256:d18cdc148729782a11469a84bd6d082412bcf8dab357cff4d63dbaf9ae4b1062"),
    defineDiagnosticEvidenceAdapterRowV1(216, "point-security-top-level-hidden", "point-security-top-level-hidden", "point_hostile", "point-security-top-level-hidden", "top_level_hidden", "input", "schema_invalid", 0, 0, "sha256:0d23ea05a680926f79c8bea4106dcede44289be46a476fda3593c29ee1d6f08c", "input", "schema_invalid", 0, 0, "sha256:396e1e508e39909e3ba2de2105499a84644b1bb50369c588558cfbfe8d20e39b"),
    defineDiagnosticEvidenceAdapterRowV1(217, "point-security-nested-hidden", "point-security-nested-hidden", "point_hostile", "point-security-nested-hidden", "nested_hidden", "input", "schema_invalid", 0, 0, "sha256:5f85b1a3d771ad8eec7930fa2479a94cf7b95c07d522dc5922d70ec860b7b79a", "input", "schema_invalid", 0, 0, "sha256:91bdd93556ef05ace967efe231ae4c883c55cf0d6ce2c590f339617d483c3b8e"),
    defineDiagnosticEvidenceAdapterRowV1(218, "point-security-top-level-symbol", "point-security-top-level-symbol", "point_hostile", "point-security-top-level-symbol", "top_level_symbol", "input", "schema_invalid", 0, 0, "sha256:dd5e0c59b071baea3367c5e1f7b7d118109182cbf7a2afcf225f580b52fc141d", "input", "schema_invalid", 0, 0, "sha256:e178262eda4b0c4d23eec7bffb31d1ede6e5d9c6d3b1d133326322107d894be1"),
    defineDiagnosticEvidenceAdapterRowV1(219, "point-security-nested-symbol", "point-security-nested-symbol", "point_hostile", "point-security-nested-symbol", "nested_symbol", "input", "schema_invalid", 0, 0, "sha256:56df0699602f7dc87d007c04346bbb00b98d48371b9da06f8fcb70aed9c762a0", "input", "schema_invalid", 0, 0, "sha256:3e95097146eead65a303fda44a1230dc1b939da1f8a4195b798165504de1ca7f"),
    defineDiagnosticEvidenceAdapterRowV1(220, "point-security-sparse-array", "point-security-sparse-array", "point_hostile", "point-security-sparse-array", "sparse_array", "input", "schema_invalid", 0, 0, "sha256:4142b7f96926b137c61a7605f9dcc4b7321b14baad9a775e675b10f0e66190a3", "input", "schema_invalid", 0, 0, "sha256:2ac841b2f0d4faba7e965b85e0df8aed2c682ae309ad201fdbc9f28337db1a2b"),
    defineDiagnosticEvidenceAdapterRowV1(221, "point-security-cycle", "point-security-cycle", "point_hostile", "point-security-cycle", "cycle", "input", "schema_invalid", 0, 0, "sha256:28f2040712cba58074a991b8dcb4b22a8ff78ff9217c1b4a1e3868c9eeff78f5", "input", "schema_invalid", 0, 0, "sha256:b4cfb6fa6f79814c6cbef6e07bc1167691fc13fc18c1ddfb6d1312a7a04c0a07"),
    defineDiagnosticEvidenceAdapterRowV1(222, "point-security-alias", "point-security-alias", "point_hostile", "point-security-alias", "alias", "input", "schema_invalid", 0, 0, "sha256:bf75c8c472afa3feef3dfd9163752d68dbe98c611784e3098e0c4b5481aef1ea", "input", "schema_invalid", 0, 0, "sha256:17e5acc9dc60b52c3a7409d8cec0beae968defb60ca37c029518b989022ea653"),
    defineAcceptedEvidenceAdapterRowV1(223, "point-security-evidence-async-mutation", "point-security-evidence-async-mutation", "point_hostile", "point-security-evidence-async-mutation", "evidence_async_mutation", 3, 11, "sha256:a98aa38acc403148bee755ac3eb08fc4df3272456e70008c010e916d9f122ce4", 24, 46, "sha256:b9e3858ab7351f14d5b93656500cdc32d0501924e2a84756f6daaecb0ed344fa"),
    defineAcceptedEvidenceAdapterRowV1(224, "point-security-pin-async-mutation", "point-security-pin-async-mutation", "point_hostile", "point-security-pin-async-mutation", "pin_async_mutation", 3, 11, "sha256:6494ce9638deced3e5cf50f57ac555a0eb441ef8606d045d160339d7b2948fb2", 24, 46, "sha256:be61a8c7da741c7796efd1f0d4e3bc3ed3996db335305d543e2a760c24bb7323"),
    defineAcceptedEvidenceAdapterRowV1(225, "point-security-qa-key-async-mutation", "point-security-qa-key-async-mutation", "point_hostile", "point-security-qa-key-async-mutation", "qa_key_async_mutation", 3, 11, "sha256:65d43b21fa4bdca0fafe681031520244ee4ea2aba16afe342082c1fdc02e7474", 24, 46, "sha256:bdb95c99eade3b4d19a93b331860f538a6adf67f83fb18e4282aa88c1b20f2f9"),
    defineAcceptedEvidenceAdapterRowV1(226, "point-security-release-key-async-mutation", "point-security-release-key-async-mutation", "point_hostile", "point-security-release-key-async-mutation", "release_key_async_mutation", 3, 11, "sha256:1588ee6cc11376a10dc603305971d1aa5df6eef067770e0bfe95ac12099d96bf", 24, 46, "sha256:d855dec93f858c14f4e67781c5a5718b0203964ed21a85db8b6484ff74c0fc56"),
  ]);
/* EXPLICIT_EVIDENCE_ADAPTER_TABLE_END */

export function deriveProviderRegistryEvidenceBindingEvidenceAdapterTableDigestV1(
  rows,
) {
  return semanticDigestV1(
    PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_EVIDENCE_ADAPTER_TABLE_DOMAIN_V1,
    rows,
  );
}
