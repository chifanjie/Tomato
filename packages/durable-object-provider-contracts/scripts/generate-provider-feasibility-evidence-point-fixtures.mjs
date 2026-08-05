import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
} from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { canonicalizeJcsSafeIntegerUtf8V1 } from "../dist/jcs.js";
import {
  PROVIDER_FEASIBILITY_EVIDENCE_DOMAIN_V1,
  PROVIDER_FEASIBILITY_EVIDENCE_ID_DOMAIN_V1,
  PROVIDER_FEASIBILITY_EVIDENCE_QA_SIGNATURE_DOMAIN_V1,
  PROVIDER_FEASIBILITY_EVIDENCE_RELEASE_SIGNATURE_DOMAIN_V1,
  ProviderFeasibilityEvidenceEnvelopeV1Schema,
  ProviderFeasibilityEvidenceUnsignedClaimsV1Schema,
  ProviderFeasibilityEvidenceV1Schema,
  buildProviderFeasibilityEvidenceRelativePathV1,
  createProviderFeasibilityEvidenceQaSignatureMessageV1,
  createProviderFeasibilityEvidenceReleaseSignatureMessageV1,
  deriveProviderFeasibilityEvidenceContentDigestV1,
  deriveProviderFeasibilityEvidenceIdV1,
  deriveProviderFeasibilityEvidencePinV1,
  projectProviderFeasibilityEvidenceIdFieldsV1,
  validateProviderFeasibilityEvidencePointClosureV1,
} from "../dist/provider-feasibility-evidence-point.js";
import {
  PROVIDER_FEASIBILITY_EVIDENCE_POINT_GOLDEN_RESOURCE_PATH_V1,
  PROVIDER_FEASIBILITY_EVIDENCE_POINT_GOLDEN_SEMANTIC_DOMAIN_V1,
  PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_CASE_IDS_V1,
  PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1,
  PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_RECIPE_DIALECT_V1,
  PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_RESOURCE_PATH_V1,
  PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_SEMANTIC_DOMAIN_V1,
  executeProviderFeasibilityEvidencePointInvalidCaseV1,
  materializeProviderFeasibilityEvidencePointInvalidRequestWitnessV1,
} from "../dist/provider-feasibility-evidence-point-fixtures.js";
import {
  ProviderRealFilesystemConformanceResultEnvelopeV1Schema,
  ProviderRealFilesystemConformanceResultLocatorV1Schema,
  ProviderRealFilesystemConformanceResultPinV1Schema,
  ProviderRealFilesystemConformanceResultV1Schema,
  deriveProviderRealFilesystemConformanceResultContentDigestV1,
  deriveProviderRealFilesystemConformanceResultIdV1,
} from "../dist/provider-real-filesystem-conformance-result.js";
import {
  ProviderFeasibilityApproverPublicKeyV1Schema,
  ProviderFeasibilityEvidencePinV1Schema,
  StoreDurableObjectProviderRuntimeAttestationPinV1Schema,
  StoreDurableObjectProviderRuntimeAttestationV1Schema,
  createProviderFeasibilityApproverPublicKeySignatureMessageV1,
  createStoreDurableObjectProviderRuntimeAttestationSignatureMessageV1,
  deriveProviderFeasibilityApproverKeyIdV1,
  deriveStoreDurableObjectProviderRuntimeAttestationContentDigestV1,
} from "../dist/provider-registry-records.js";
import {
  deriveProviderEd25519PublicKeyDigestInternalV1,
} from "../dist/provider-registry-trust.js";
import {
  PROVIDER_RUNTIME_ATTESTATION_POINT_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_RUNTIME_ATTESTATION_POINT_GOLDEN_RESOURCE_PATH_V1,
  PROVIDER_RUNTIME_ATTESTATION_POINT_GOLDEN_RESOURCE_SHA256_HEX_V1,
  PROVIDER_RUNTIME_ATTESTATION_POINT_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
  PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_RESOURCE_PATH_V1,
  PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_RESOURCE_SHA256_HEX_V1,
  PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_SEMANTIC_CONTENT_DIGEST_V1,
} from "../dist/provider-runtime-attestation-point-fixtures.js";
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

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const targetDiscoveryGoldenPath =
  "fixtures/v1/golden/provider-target-discovery-point-v1.json";
const QA_SEED_HEX = "41".repeat(32);
const RELEASE_SEED_HEX = "42".repeat(32);
const WRONG_SEED_HEX = "43".repeat(32);
const INVALID_POINT_PUBLIC_KEY_BYTES =
  `base64url:${Buffer.alloc(32).toString("base64url")}`;

function jsonClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function semanticDigest(domain, value) {
  return `sha256:${sha256Hex(canonicalizeJcsSafeIntegerUtf8V1([domain, value]))}`;
}

function digest(character) {
  return `sha256:${character.repeat(64)}`;
}

function prettyBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeOrCheck(relativePath, value, check) {
  const filePath = join(packageRoot, ...relativePath.split("/"));
  const bytes = prettyBytes(value);
  if (check) {
    const current = await readFile(filePath);
    if (!current.equals(bytes)) {
      throw new Error(`${relativePath} is stale; regenerate fixtures`);
    }
    return;
  }
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, bytes);
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

function publicKeyBytesFromSeedHex(seedHex) {
  const der = createPublicKey(privateKeyFromSeedHex(seedHex)).export({
    format: "der",
    type: "spki",
  });
  const raw = der.subarray(der.byteLength - 32);
  return `base64url:${raw.toString("base64url")}`;
}

function rawSignatureHex(seedHex, message) {
  return sign(
    null,
    Buffer.from(message),
    privateKeyFromSeedHex(seedHex),
  ).toString("hex");
}

function registrySignature(rootKeyId, seedHex, message) {
  return `provider-registry-ed25519:${rootKeyId}:${rawSignatureHex(
    seedHex,
    message,
  )}`;
}

function bitflipSignature(signature) {
  const last = signature.at(-1);
  return `${signature.slice(0, -1)}${last === "0" ? "1" : "0"}`;
}

function canonicalRecipeValue(value) {
  return new TextDecoder().decode(canonicalizeJcsSafeIntegerUtf8V1(value));
}

function replacementRecipe(replacements) {
  return {
    kind: "replace_artifacts",
    ...Object.fromEntries(
      Object.entries(replacements).map(([key, value]) => [
        key,
        canonicalRecipeValue(value),
      ]),
    ),
  };
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

function finalizeRuntime(base, rootKeyId, rootSeedHex, options = {}) {
  const unsigned = runtimeUnsigned(base);
  const message =
    options.message ??
    createStoreDurableObjectProviderRuntimeAttestationSignatureMessageV1(
      unsigned,
      rootKeyId,
    );
  const payload = StoreDurableObjectProviderRuntimeAttestationV1Schema.parse({
    ...unsigned,
    registrySignature: registrySignature(
      options.signatureRootKeyId ?? rootKeyId,
      options.signerSeedHex ?? rootSeedHex,
      message,
    ),
  });
  return StoreDurableObjectProviderRuntimeAttestationPinV1Schema.parse({
    profile: "store_durable_object_provider_runtime_attestation_pin_v1",
    contentDigest:
      deriveStoreDurableObjectProviderRuntimeAttestationContentDigestV1(payload),
    payload,
  });
}

function finalizeApproverRecord(
  role,
  publicKeyBytes,
  rootKeyId,
  rootSeedHex,
  options = {},
) {
  const unsigned = {
    profile: "provider_feasibility_approver_public_key_v1",
    distributionRegistryGenerationIntroduced: 1,
    role,
    keyId: deriveProviderFeasibilityApproverKeyIdV1({ role, publicKeyBytes }),
    algorithm: "ed25519",
    publicKeyBytes,
    publicKeyDigest:
      deriveProviderEd25519PublicKeyDigestInternalV1(publicKeyBytes),
  };
  const message =
    options.message ??
    createProviderFeasibilityApproverPublicKeySignatureMessageV1(
      unsigned,
      rootKeyId,
    );
  return ProviderFeasibilityApproverPublicKeyV1Schema.parse({
    ...unsigned,
    registrySignature: registrySignature(
      options.signatureRootKeyId ?? rootKeyId,
      options.signerSeedHex ?? rootSeedHex,
      message,
    ),
  });
}

function evidenceSignature(role, keyId, seedHex, message) {
  return `provider-feasibility-ed25519:${role}:${keyId}:${rawSignatureHex(
    seedHex,
    message,
  )}`;
}

function evidenceUnsignedFromSources(
  resultEnvelope,
  resultPin,
  runtimeAttestation,
  policy,
  issuedAt,
) {
  const result = resultEnvelope.payload;
  return {
    profile: "provider_feasibility_evidence_v1",
    evidenceId: "provider-feasibility-evidence:0000000000000000000000",
    providerId: result.providerId,
    semanticProviderPolicyDigest: result.semanticProviderPolicyDigest,
    runtimeAttestationContentDigest: runtimeAttestation.contentDigest,
    implementationDigest: result.implementationDigest,
    binaryAttestationDigest: result.binaryAttestationDigest,
    target: jsonClone(result.target),
    isolationSecurityBoundaryProfileDigest:
      policy.isolation.securityBoundaryProfileDigest,
    ipcPeerAuthenticationPolicyDigest:
      policy.ipcPeerAuthenticationPolicyDigest,
    realFilesystemSuiteDigest: result.suiteDigest,
    realFilesystemConformanceResult: jsonClone(resultPin),
    realFilesystemConformanceResultDigest: resultEnvelope.contentDigest,
    fixtureManifestDigest: result.fixtureManifestDigest,
    runnerProfileDigest: result.runnerProfileDigest,
    crashCutCoverageDigest: result.crashCutCoverageDigest,
    result: result.result,
    issuedAt,
  };
}

function finalizeEvidenceUnsigned(
  unsignedInput,
  qaRecord,
  releaseRecord,
  options = {},
) {
  const draft = jsonClone(unsignedInput);
  if (options.recomputeEvidenceId !== false) {
    const {
      profile: _profile,
      evidenceId: _evidenceId,
      ...evidenceIdFields
    } = draft;
    draft.evidenceId = deriveProviderFeasibilityEvidenceIdV1(evidenceIdFields);
  }
  const unsigned = ProviderFeasibilityEvidenceUnsignedClaimsV1Schema.parse(draft);
  const qaMessage =
    options.qaMessage ??
    createProviderFeasibilityEvidenceQaSignatureMessageV1(
      unsigned,
      qaRecord.keyId,
    );
  const releaseMessage =
    options.releaseMessage ??
    createProviderFeasibilityEvidenceReleaseSignatureMessageV1(
      unsigned,
      releaseRecord.keyId,
    );
  const qaSignature =
    options.qaSignature ??
    evidenceSignature(
      "qa",
      options.qaWireKeyId ?? qaRecord.keyId,
      options.qaSignerSeedHex ?? QA_SEED_HEX,
      qaMessage,
    );
  const releaseSignature =
    options.releaseSignature ??
    evidenceSignature(
      "release",
      options.releaseWireKeyId ?? releaseRecord.keyId,
      options.releaseSignerSeedHex ?? RELEASE_SEED_HEX,
      releaseMessage,
    );
  const payload = ProviderFeasibilityEvidenceV1Schema.parse({
    ...unsigned,
    qaSignature,
    releaseSignature,
  });
  const envelope = ProviderFeasibilityEvidenceEnvelopeV1Schema.parse({
    schemaVersion: 1,
    recordType: "provider_feasibility_evidence",
    evidenceId: payload.evidenceId,
    contentDigest: deriveProviderFeasibilityEvidenceContentDigestV1(payload),
    payload,
  });
  const pin = deriveProviderFeasibilityEvidencePinV1(envelope);
  return { envelope, pin };
}

function buildPositiveVector(
  runtimeGolden,
  qaRecord,
  releaseRecord,
  rootSeedHex,
  vectorId,
  resultOutcome,
  completedAt,
  issuedAt,
) {
  const resultBase = jsonClone(runtimeGolden.realFilesystemConformanceResult.payload);
  if (resultOutcome !== "passed") {
    const first = resultBase.caseResults[0];
    first.outcome = resultOutcome;
    first.resultCode =
      resultOutcome === "failed"
        ? "assertion_failed"
        : "unsupported_by_target_profile";
  }
  resultBase.result = resultOutcome;
  resultBase.completedAt = completedAt;
  const result = finalizeResult(resultBase);
  const activeRoot = runtimeGolden.conformanceResultGolden.activeRoot;
  const runtimeAttestation = finalizeRuntime(
    {
      ...jsonClone(runtimeGolden.runtimeAttestation.payload),
      realFilesystemConformanceResultDigest: result.envelope.contentDigest,
    },
    activeRoot.rootKeyId,
    rootSeedHex,
  );
  const evidence = finalizeEvidenceUnsigned(
    evidenceUnsignedFromSources(
      result.envelope,
      result.pin,
      runtimeAttestation,
      runtimeGolden.semanticProviderPolicy,
      issuedAt,
    ),
    qaRecord,
    releaseRecord,
  );
  return {
    vectorId,
    result: resultOutcome,
    issuedAt,
    realFilesystemConformanceResult: result.envelope,
    realFilesystemConformanceResultLocator: result.locator,
    realFilesystemConformanceResultPin: result.pin,
    runtimeAttestation,
    providerFeasibilityEvidence: evidence.envelope,
    providerFeasibilityEvidencePin: evidence.pin,
  };
}

function requestFromGolden(golden, capability) {
  const runtime = golden.runtimeAttestationPointGolden;
  const source = runtime.conformanceResultGolden;
  return {
    activeRoot: jsonClone(source.activeRoot),
    activeRootMetadata: jsonClone(source.activeRootMetadata),
    distributionRootBinding: jsonClone(source.distributionRootBinding),
    fixtureCorpusManifest: jsonClone(source.fixtureCorpusManifest),
    providerFeasibilityEvidence: jsonClone(golden.providerFeasibilityEvidence),
    providerFeasibilityEvidencePin: jsonClone(golden.providerFeasibilityEvidencePin),
    publicSupportTaxonomy: jsonClone(source.publicSupportTaxonomy),
    qaApproverPublicKey: jsonClone(golden.qaApproverPublicKey),
    realFilesystemConformanceResult: jsonClone(runtime.realFilesystemConformanceResult),
    realFilesystemConformanceResultLocator: jsonClone(
      runtime.realFilesystemConformanceResultLocator,
    ),
    realFilesystemConformanceResultPin: jsonClone(
      runtime.realFilesystemConformanceResultPin,
    ),
    releaseApproverPublicKey: jsonClone(golden.releaseApproverPublicKey),
    releaseMatrix: jsonClone(source.releaseMatrix),
    runtimeAttestation: jsonClone(runtime.runtimeAttestation),
    semanticProviderPolicy: jsonClone(runtime.semanticProviderPolicy),
    strictCryptoCapability: capability,
    suiteManifest: jsonClone(source.suiteManifest),
    targetDiscoveryFixtureManifest: jsonClone(source.targetDiscoveryFixtureManifest),
    targetDiscoveryResult: jsonClone(source.targetDiscoveryResult),
    targetDiscoveryRunnerRun: jsonClone(source.targetDiscoveryRunnerRun),
  };
}

function mutateEvidenceAndReanchor(golden, mutate, options = {}) {
  const unsigned = jsonClone(golden.providerFeasibilityEvidence.payload);
  delete unsigned.qaSignature;
  delete unsigned.releaseSignature;
  mutate(unsigned);
  const evidence = finalizeEvidenceUnsigned(
    unsigned,
    golden.qaApproverPublicKey,
    golden.releaseApproverPublicKey,
    options,
  );
  return replacementRecipe({
    providerFeasibilityEvidence: evidence.envelope,
    providerFeasibilityEvidencePin: evidence.pin,
  });
}

function mutateEvidenceDirect(golden, mutateEnvelope, mutatePin) {
  const envelope = jsonClone(golden.providerFeasibilityEvidence);
  const pin = jsonClone(golden.providerFeasibilityEvidencePin);
  mutateEnvelope(envelope);
  if (mutatePin !== undefined) mutatePin(pin, envelope);
  return replacementRecipe({
    providerFeasibilityEvidence: envelope,
    providerFeasibilityEvidencePin: pin,
  });
}

function mutateApproverDirect(golden, key, mutate) {
  const record = jsonClone(golden[key]);
  mutate(record);
  return replacementRecipe({ [key]: record });
}

function otherString(value) {
  const last = value.at(-1);
  return `${value.slice(0, -1)}${last === "0" ? "1" : "0"}`;
}

function pointRecipe(golden, caseId, rootSeedHex) {
  const evidence = golden.providerFeasibilityEvidence;
  const result = golden.runtimeAttestationPointGolden.realFilesystemConformanceResult;
  const activeRoot = golden.runtimeAttestationPointGolden.conformanceResultGolden.activeRoot;
  const policy = golden.runtimeAttestationPointGolden.semanticProviderPolicy;
  const structureMutations = {
    "evidence-envelope-schema-version-invalid": (draft) => { draft.schemaVersion = 2; },
    "evidence-envelope-record-type-invalid": (draft) => { draft.recordType = "provider_feasibility_evidence_v2"; },
    "evidence-envelope-extra-field": (draft) => { draft.unexpected = true; },
    "evidence-payload-profile-invalid": (draft) => { draft.payload.profile = "provider_feasibility_evidence_v2"; },
    "evidence-payload-required-field-missing": (draft) => { delete draft.payload.issuedAt; },
    "evidence-payload-extra-field": (draft) => { draft.payload.volumePath = "/private/provider"; },
    "evidence-qa-signature-format-invalid": (draft) => { draft.payload.qaSignature = "not-a-qa-signature"; },
    "evidence-release-signature-format-invalid": (draft) => { draft.payload.releaseSignature = "not-a-release-signature"; },
    "evidence-payload-not-object": (draft) => { draft.payload = null; },
  };
  if (structureMutations[caseId] !== undefined) {
    const draft = jsonClone(evidence);
    structureMutations[caseId](draft);
    return replacementRecipe({ providerFeasibilityEvidence: draft });
  }
  const pinMutations = {
    "evidence-pin-profile-invalid": (draft) => { draft.locatorProfile = "installation_provider_feasibility_evidence_v2"; },
    "evidence-pin-evidence-id-missing": (draft) => { delete draft.evidenceId; },
    "evidence-pin-content-digest-missing": (draft) => { delete draft.contentDigest; },
    "evidence-pin-extra-field": (draft) => { draft.latest = true; },
  };
  if (pinMutations[caseId] !== undefined) {
    const draft = jsonClone(golden.providerFeasibilityEvidencePin);
    pinMutations[caseId](draft);
    return replacementRecipe({ providerFeasibilityEvidencePin: draft });
  }
  const keyStructure = /^(qa|release)-key-(profile-invalid|generation-zero|algorithm-invalid|public-bytes-invalid|registry-signature-format-invalid|extra-field)$/u.exec(caseId);
  if (keyStructure !== null) {
    const key = keyStructure[1] === "qa" ? "qaApproverPublicKey" : "releaseApproverPublicKey";
    return mutateApproverDirect(golden, key, (draft) => {
      switch (keyStructure[2]) {
        case "profile-invalid": draft.profile = "provider_feasibility_approver_public_key_v2"; break;
        case "generation-zero": draft.distributionRegistryGenerationIntroduced = 0; break;
        case "algorithm-invalid": draft.algorithm = "rsa"; break;
        case "public-bytes-invalid": draft.publicKeyBytes = "base64url:AAAA"; break;
        case "registry-signature-format-invalid": draft.registrySignature = "not-a-registry-signature"; break;
        case "extra-field": draft.current = true; break;
      }
    });
  }
  const identityMutations = {
    "qa-key-role-key-id-compound": ["qaApproverPublicKey", (draft) => { draft.role = "release"; draft.keyId = "0".repeat(22); }],
    "qa-key-id-mismatch": ["qaApproverPublicKey", (draft) => { draft.keyId = "0".repeat(22); }],
    "qa-key-id-digest-compound": ["qaApproverPublicKey", (draft) => { draft.keyId = "0".repeat(22); draft.publicKeyDigest = digest("0"); }],
    "qa-key-digest-mismatch": ["qaApproverPublicKey", (draft) => { draft.publicKeyDigest = digest("0"); }],
    "release-key-role-key-id-compound": ["releaseApproverPublicKey", (draft) => { draft.role = "qa"; draft.keyId = "0".repeat(22); }],
    "release-key-id-mismatch": ["releaseApproverPublicKey", (draft) => { draft.keyId = "0".repeat(22); }],
    "release-key-id-digest-compound": ["releaseApproverPublicKey", (draft) => { draft.keyId = "0".repeat(22); draft.publicKeyDigest = digest("0"); }],
    "release-key-digest-mismatch": ["releaseApproverPublicKey", (draft) => { draft.publicKeyDigest = digest("0"); }],
  };
  if (identityMutations[caseId] !== undefined) {
    const [key, mutate] = identityMutations[caseId];
    return mutateApproverDirect(golden, key, mutate);
  }
  if (caseId === "approver-qa-release-material-alias") {
    const release = finalizeApproverRecord(
      "release",
      golden.qaApproverPublicKey.publicKeyBytes,
      activeRoot.rootKeyId,
      rootSeedHex,
    );
    return replacementRecipe({ releaseApproverPublicKey: release });
  }
  if (caseId === "approver-qa-root-material-alias") {
    const qa = finalizeApproverRecord(
      "qa",
      activeRoot.publicKeyBytes,
      activeRoot.rootKeyId,
      rootSeedHex,
    );
    return replacementRecipe({ qaApproverPublicKey: qa });
  }
  if (caseId === "approver-release-root-material-alias") {
    const release = finalizeApproverRecord(
      "release",
      activeRoot.publicKeyBytes,
      activeRoot.rootKeyId,
      rootSeedHex,
    );
    return replacementRecipe({ releaseApproverPublicKey: release });
  }
  if (caseId === "qa-key-root-mismatch" || caseId === "release-key-root-mismatch") {
    const key = caseId.startsWith("qa-") ? "qaApproverPublicKey" : "releaseApproverPublicKey";
    return mutateApproverDirect(golden, key, (draft) => {
      draft.registrySignature = draft.registrySignature.replace(
        `:${activeRoot.rootKeyId}:`,
        `:${"0".repeat(22)}:`,
      );
    });
  }
  if (caseId === "qa-key-point-invalid" || caseId === "release-key-point-invalid") {
    const role = caseId.startsWith("qa-") ? "qa" : "release";
    const key = role === "qa" ? "qaApproverPublicKey" : "releaseApproverPublicKey";
    const record = finalizeApproverRecord(
      role,
      INVALID_POINT_PUBLIC_KEY_BYTES,
      activeRoot.rootKeyId,
      rootSeedHex,
    );
    return replacementRecipe({ [key]: record });
  }
  const recordSignature = /^(qa|release)-key-signature-(bitflip|wrong-signer|wrong-domain)$/u.exec(caseId);
  if (recordSignature !== null) {
    const role = recordSignature[1];
    const key = role === "qa" ? "qaApproverPublicKey" : "releaseApproverPublicKey";
    if (recordSignature[2] === "bitflip") {
      return mutateApproverDirect(golden, key, (draft) => {
        draft.registrySignature = bitflipSignature(draft.registrySignature);
      });
    }
    const source = golden[key];
    const message =
      recordSignature[2] === "wrong-domain"
        ? canonicalizeJcsSafeIntegerUtf8V1([
            "provider-feasibility-approver-public-key-signature-wrong-domain-v1",
            source,
          ])
        : createProviderFeasibilityApproverPublicKeySignatureMessageV1(
            source,
            activeRoot.rootKeyId,
          );
    return mutateApproverDirect(golden, key, (draft) => {
      draft.registrySignature = registrySignature(
        activeRoot.rootKeyId,
        recordSignature[2] === "wrong-signer" ? WRONG_SEED_HEX : rootSeedHex,
        message,
      );
    });
  }

  const evidenceBindingMutations = {
    "evidence-provider-binding-mismatch": (draft) => { draft.providerId = "durable-object-provider:alternate"; },
    "evidence-policy-digest-binding-mismatch": (draft) => { draft.semanticProviderPolicyDigest = digest("1"); },
    "evidence-implementation-binding-mismatch": (draft) => { draft.implementationDigest = digest("1"); },
    "evidence-binary-binding-mismatch": (draft) => { draft.binaryAttestationDigest = digest("1"); },
    "evidence-target-profile-id-binding-mismatch": (draft) => { draft.target.targetProfileId = otherString(draft.target.targetProfileId); },
    "evidence-target-os-platform-binding-mismatch": (draft) => { draft.target.osPlatform = draft.target.osPlatform === "darwin" ? "linux" : "darwin"; },
    "evidence-target-os-family-binding-mismatch": (draft) => { draft.target.osReleaseFamilyCode = otherString(draft.target.osReleaseFamilyCode); },
    "evidence-target-os-build-binding-mismatch": (draft) => { draft.target.osBuildDigest = digest("9"); },
    "evidence-target-architecture-binding-mismatch": (draft) => { draft.target.architecture = draft.target.architecture === "arm64" ? "x86_64" : "arm64"; },
    "evidence-target-filesystem-profile-binding-mismatch": (draft) => { draft.target.filesystemProfileCode = otherString(draft.target.filesystemProfileCode); },
    "evidence-target-filesystem-feature-binding-mismatch": (draft) => { draft.target.filesystemFeatureProfileDigest = digest("9"); },
    "evidence-target-mount-option-binding-mismatch": (draft) => { draft.target.mountOptionProfileDigest = digest("9"); },
    "evidence-suite-binding-mismatch": (draft) => { draft.realFilesystemSuiteDigest = digest("1"); },
    "evidence-fixture-binding-mismatch": (draft) => { draft.fixtureManifestDigest = digest("1"); },
    "evidence-runner-binding-mismatch": (draft) => { draft.runnerProfileDigest = digest("1"); },
    "evidence-crash-cut-binding-mismatch": (draft) => { draft.crashCutCoverageDigest = digest("1"); },
    "evidence-result-binding-mismatch": (draft) => { draft.result = "failed"; },
    "evidence-policy-isolation-binding-mismatch": (draft) => { draft.isolationSecurityBoundaryProfileDigest = digest("1"); },
    "evidence-policy-ipc-binding-mismatch": (draft) => { draft.ipcPeerAuthenticationPolicyDigest = digest("1"); },
    "evidence-policy-suite-binding-mismatch": (draft) => { draft.realFilesystemSuiteDigest = digest("1"); },
    "evidence-runtime-attestation-digest-mismatch": (draft) => { draft.runtimeAttestationContentDigest = digest("1"); },
    "evidence-time-before-one-nanosecond": (draft) => { draft.issuedAt = "2026-08-03T03:59:59.999999999Z"; },
  };
  if (evidenceBindingMutations[caseId] !== undefined) {
    return mutateEvidenceAndReanchor(golden, evidenceBindingMutations[caseId]);
  }
  if (caseId === "evidence-ordinary-result-pin-compound") {
    return mutateEvidenceAndReanchor(golden, (draft) => {
      draft.providerId = "durable-object-provider:alternate";
      draft.realFilesystemConformanceResult.contentDigest = digest("0");
    });
  }
  if (caseId === "evidence-result-pin-mismatch") {
    return mutateEvidenceAndReanchor(golden, (draft) => {
      draft.realFilesystemConformanceResult.contentDigest = digest("0");
    });
  }
  if (caseId === "evidence-result-pin-digest-compound") {
    return mutateEvidenceAndReanchor(golden, (draft) => {
      draft.realFilesystemConformanceResult.contentDigest = digest("0");
      draft.realFilesystemConformanceResultDigest = digest("1");
    });
  }
  if (caseId === "evidence-result-digest-mismatch") {
    return mutateEvidenceAndReanchor(golden, (draft) => {
      draft.realFilesystemConformanceResultDigest = digest("1");
    });
  }
  if (caseId === "evidence-id-mismatch") {
    return mutateEvidenceDirect(golden, (draft) => {
      draft.payload.evidenceId = "provider-feasibility-evidence:0000000000000000000000";
    });
  }
  if (caseId === "evidence-qa-signature-key-id-mismatch") {
    return mutateEvidenceDirect(golden, (draft) => {
      draft.payload.qaSignature = draft.payload.qaSignature.replace(
        `:qa:${golden.qaApproverPublicKey.keyId}:`,
        `:qa:${"0".repeat(22)}:`,
      );
    });
  }
  if (caseId === "evidence-release-signature-key-id-mismatch") {
    return mutateEvidenceDirect(golden, (draft) => {
      draft.payload.releaseSignature = draft.payload.releaseSignature.replace(
        `:release:${golden.releaseApproverPublicKey.keyId}:`,
        `:release:${"0".repeat(22)}:`,
      );
    });
  }
  if (caseId === "evidence-qa-signature-bitflip") {
    return mutateEvidenceDirect(golden, (draft) => {
      draft.payload.qaSignature = bitflipSignature(draft.payload.qaSignature);
    });
  }
  if (caseId === "evidence-release-signature-bitflip") {
    return mutateEvidenceDirect(golden, (draft) => {
      draft.payload.releaseSignature = bitflipSignature(draft.payload.releaseSignature);
    });
  }
  if (
    [
      "evidence-qa-signature-wrong-signer",
      "evidence-qa-signature-wrong-domain",
      "evidence-qa-signature-wrong-role-wrapper",
      "evidence-release-signature-wrong-signer",
      "evidence-release-signature-wrong-domain",
      "evidence-release-signature-wrong-role-wrapper",
    ].includes(caseId)
  ) {
    const role = caseId.includes("-qa-") ? "qa" : "release";
    const unsigned = jsonClone(evidence.payload);
    delete unsigned.qaSignature;
    delete unsigned.releaseSignature;
    const wrongMessage = caseId.endsWith("wrong-domain")
      ? canonicalizeJcsSafeIntegerUtf8V1([
          `provider-feasibility-evidence-${role}-signature-wrong-domain-v1`,
          unsigned,
        ])
      : caseId.endsWith("wrong-role-wrapper")
        ? canonicalizeJcsSafeIntegerUtf8V1([
            role === "qa"
              ? PROVIDER_FEASIBILITY_EVIDENCE_QA_SIGNATURE_DOMAIN_V1
              : PROVIDER_FEASIBILITY_EVIDENCE_RELEASE_SIGNATURE_DOMAIN_V1,
            {
              role: role === "qa" ? "release" : "qa",
              keyId:
                role === "qa"
                  ? golden.qaApproverPublicKey.keyId
                  : golden.releaseApproverPublicKey.keyId,
              claims: unsigned,
            },
          ])
        : undefined;
    const options = role === "qa"
      ? {
          qaSignerSeedHex: caseId.endsWith("wrong-signer")
            ? WRONG_SEED_HEX
            : QA_SEED_HEX,
          ...(wrongMessage === undefined ? {} : { qaMessage: wrongMessage }),
        }
      : {
          releaseSignerSeedHex: caseId.endsWith("wrong-signer")
            ? WRONG_SEED_HEX
            : RELEASE_SEED_HEX,
          ...(wrongMessage === undefined ? {} : { releaseMessage: wrongMessage }),
        };
    return mutateEvidenceAndReanchor(golden, () => {}, options);
  }
  if (caseId === "evidence-signatures-swapped") {
    return mutateEvidenceDirect(golden, (draft) => {
      const qaHex = draft.payload.qaSignature.split(":").at(-1);
      const releaseHex = draft.payload.releaseSignature.split(":").at(-1);
      draft.payload.qaSignature = `provider-feasibility-ed25519:qa:${golden.qaApproverPublicKey.keyId}:${releaseHex}`;
      draft.payload.releaseSignature = `provider-feasibility-ed25519:release:${golden.releaseApproverPublicKey.keyId}:${qaHex}`;
    });
  }
  if (caseId === "evidence-content-digest-mismatch") {
    return mutateEvidenceDirect(
      golden,
      (draft) => { draft.contentDigest = digest("0"); },
      (pin) => { pin.contentDigest = digest("0"); },
    );
  }
  if (caseId === "evidence-envelope-id-mismatch") {
    return mutateEvidenceDirect(
      golden,
      (draft) => { draft.evidenceId = "provider-feasibility-evidence:0000000000000000000000"; },
      (pin, draft) => { pin.evidenceId = draft.evidenceId; },
    );
  }
  if (caseId === "evidence-pin-id-mismatch") {
    return mutateEvidenceDirect(
      golden,
      () => {},
      (pin) => { pin.evidenceId = "provider-feasibility-evidence:0000000000000000000000"; },
    );
  }
  if (caseId === "evidence-pin-digest-mismatch") {
    return mutateEvidenceDirect(
      golden,
      () => {},
      (pin) => { pin.contentDigest = digest("0"); },
    );
  }
  const hostileProfiles = {
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
    "point-security-evidence-async-mutation": "evidence_async_mutation",
    "point-security-pin-async-mutation": "pin_async_mutation",
    "point-security-qa-key-async-mutation": "qa_key_async_mutation",
    "point-security-release-key-async-mutation": "release_key_async_mutation",
  };
  if (hostileProfiles[caseId] !== undefined) {
    return { kind: "hostile_input", profile: hostileProfiles[caseId] };
  }
  throw new Error(`unknown provider feasibility evidence point case ${caseId}`);
}

const runtimeGoldenBytes = await readFile(
  join(packageRoot, ...PROVIDER_RUNTIME_ATTESTATION_POINT_GOLDEN_RESOURCE_PATH_V1.split("/")),
);
const runtimeInvalidBytes = await readFile(
  join(packageRoot, ...PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_RESOURCE_PATH_V1.split("/")),
);
if (
  runtimeGoldenBytes.byteLength !==
    PROVIDER_RUNTIME_ATTESTATION_POINT_GOLDEN_RESOURCE_BYTE_LENGTH_V1 ||
  sha256Hex(runtimeGoldenBytes) !==
    PROVIDER_RUNTIME_ATTESTATION_POINT_GOLDEN_RESOURCE_SHA256_HEX_V1 ||
  runtimeInvalidBytes.byteLength !==
    PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_RESOURCE_BYTE_LENGTH_V1 ||
  sha256Hex(runtimeInvalidBytes) !==
    PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_RESOURCE_SHA256_HEX_V1
) {
  throw new Error("C09-1I dependency bytes drifted");
}
const runtimeGolden = JSON.parse(runtimeGoldenBytes.toString("utf8"));
const runtimeInvalid = JSON.parse(runtimeInvalidBytes.toString("utf8"));
if (
  runtimeGolden.semanticContentDigest !==
    PROVIDER_RUNTIME_ATTESTATION_POINT_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1 ||
  runtimeInvalid.semanticContentDigest !==
    PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_SEMANTIC_CONTENT_DIGEST_V1
) {
  throw new Error("C09-1I dependency semantic anchor drifted");
}
const targetDiscoveryGolden = JSON.parse(
  await readFile(
    join(packageRoot, ...targetDiscoveryGoldenPath.split("/")),
    "utf8",
  ),
);
const rootSeedHex = targetDiscoveryGolden.deterministicRootSeedHex;
const activeRoot = runtimeGolden.conformanceResultGolden.activeRoot;
const qaApproverPublicKey = finalizeApproverRecord(
  "qa",
  publicKeyBytesFromSeedHex(QA_SEED_HEX),
  activeRoot.rootKeyId,
  rootSeedHex,
);
const releaseApproverPublicKey = finalizeApproverRecord(
  "release",
  publicKeyBytesFromSeedHex(RELEASE_SEED_HEX),
  activeRoot.rootKeyId,
  rootSeedHex,
);
const mainUnsigned = evidenceUnsignedFromSources(
  runtimeGolden.realFilesystemConformanceResult,
  runtimeGolden.realFilesystemConformanceResultPin,
  runtimeGolden.runtimeAttestation,
  runtimeGolden.semanticProviderPolicy,
  runtimeGolden.realFilesystemConformanceResult.payload.completedAt,
);
const mainEvidence = finalizeEvidenceUnsigned(
  mainUnsigned,
  qaApproverPublicKey,
  releaseApproverPublicKey,
);
const positiveVectors = [
  {
    vectorId: "passed-exact-equal",
    result: "passed",
    issuedAt: mainEvidence.envelope.payload.issuedAt,
    realFilesystemConformanceResult: runtimeGolden.realFilesystemConformanceResult,
    realFilesystemConformanceResultLocator:
      runtimeGolden.realFilesystemConformanceResultLocator,
    realFilesystemConformanceResultPin:
      runtimeGolden.realFilesystemConformanceResultPin,
    runtimeAttestation: runtimeGolden.runtimeAttestation,
    providerFeasibilityEvidence: mainEvidence.envelope,
    providerFeasibilityEvidencePin: mainEvidence.pin,
  },
  buildPositiveVector(
    runtimeGolden,
    qaApproverPublicKey,
    releaseApproverPublicKey,
    rootSeedHex,
    "failed-after-one-nanosecond",
    "failed",
    "2026-08-03T04:00:00Z",
    "2026-08-03T04:00:00.000000001Z",
  ),
  buildPositiveVector(
    runtimeGolden,
    qaApproverPublicKey,
    releaseApproverPublicKey,
    rootSeedHex,
    "unsupported-equal-different-fraction-length",
    "unsupported",
    "2026-08-03T04:00:00.1Z",
    "2026-08-03T04:00:00.100000000Z",
  ),
];
const mainClaims = mainEvidence.envelope.payload;
const goldenWithoutDigest = {
  schemaVersion: 1,
  profile: "provider_feasibility_evidence_point_golden_v1",
  fixtureAuthority: "none_provider_feasibility_evidence_structure_only",
  canonicalizationProfile: "rfc8785-jcs-safe-integer-v1",
  verificationProfile: "ed25519-rfc8032-cofactorless-prime-subgroup-v1",
  runtimeAttestationPointGolden: runtimeGolden,
  providerFeasibilityEvidence: mainEvidence.envelope,
  providerFeasibilityEvidencePin: mainEvidence.pin,
  qaApproverPublicKey,
  releaseApproverPublicKey,
  positiveVectors,
  expected: {
    evidenceIdPreimageCanonicalUtf8Hex: Buffer.from(
      canonicalizeJcsSafeIntegerUtf8V1([
        PROVIDER_FEASIBILITY_EVIDENCE_ID_DOMAIN_V1,
        projectProviderFeasibilityEvidenceIdFieldsV1(mainClaims),
      ]),
    ).toString("hex"),
    qaSignatureMessageUtf8Hex: Buffer.from(
      createProviderFeasibilityEvidenceQaSignatureMessageV1(
        mainClaims,
        qaApproverPublicKey.keyId,
      ),
    ).toString("hex"),
    releaseSignatureMessageUtf8Hex: Buffer.from(
      createProviderFeasibilityEvidenceReleaseSignatureMessageV1(
        mainClaims,
        releaseApproverPublicKey.keyId,
      ),
    ).toString("hex"),
    evidenceId: mainEvidence.envelope.evidenceId,
    evidenceContentDigest: mainEvidence.envelope.contentDigest,
    evidenceRelativePath: buildProviderFeasibilityEvidenceRelativePathV1(
      mainEvidence.pin,
    ),
    qaApproverKeyId: qaApproverPublicKey.keyId,
    releaseApproverKeyId: releaseApproverPublicKey.keyId,
    qaApproverPublicKeyDigest: qaApproverPublicKey.publicKeyDigest,
    releaseApproverPublicKeyDigest: releaseApproverPublicKey.publicKeyDigest,
    activeRootPointAdmissionCount: 3,
    signatureVerificationCount: 11,
    approverRecordSignatureCount: 2,
    evidenceSignatureCount: 2,
  },
  semanticDomain:
    PROVIDER_FEASIBILITY_EVIDENCE_POINT_GOLDEN_SEMANTIC_DOMAIN_V1,
  dependencies: {
    runtimeGoldenResourcePath:
      PROVIDER_RUNTIME_ATTESTATION_POINT_GOLDEN_RESOURCE_PATH_V1,
    runtimeGoldenResourceByteLength:
      PROVIDER_RUNTIME_ATTESTATION_POINT_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
    runtimeGoldenResourceSha256Hex:
      PROVIDER_RUNTIME_ATTESTATION_POINT_GOLDEN_RESOURCE_SHA256_HEX_V1,
    runtimeGoldenSemanticContentDigest:
      PROVIDER_RUNTIME_ATTESTATION_POINT_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
    runtimeInvalidResourcePath:
      PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_RESOURCE_PATH_V1,
    runtimeInvalidResourceByteLength:
      PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_RESOURCE_BYTE_LENGTH_V1,
    runtimeInvalidResourceSha256Hex:
      PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_RESOURCE_SHA256_HEX_V1,
    runtimeInvalidSemanticContentDigest:
      PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_SEMANTIC_CONTENT_DIGEST_V1,
  },
};
const golden = {
  ...goldenWithoutDigest,
  semanticContentDigest: semanticDigest(
    PROVIDER_FEASIBILITY_EVIDENCE_POINT_GOLDEN_SEMANTIC_DOMAIN_V1,
    goldenWithoutDigest,
  ),
};

let pointCalls = 0;
let verifyCalls = 0;
const strictManifestBytes = new Uint8Array(
  await readFile(
    join(
      packageRoot,
      ...PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1.split("/"),
    ),
  ),
);
const capability = await attestProviderStrictEd25519CryptoHostV1({
  host: Object.freeze({
    verificationProfile: STRICT_ED25519_VERIFICATION_PROFILE_V1,
    validatePrimeSubgroupPoint(encodedPoint) {
      pointCalls += 1;
      return validatePrimeSubgroupPoint(encodedPoint);
    },
    async verifyRawEd25519(publicKey, message, signature) {
      verifyCalls += 1;
      return verifyRawEd25519(publicKey, message, signature);
    },
  }),
  resourceHost: Object.freeze({
    readFixedSignedPackageResource(path, maxBytes) {
      if (
        path !== PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1 ||
        maxBytes !== PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1
      ) {
        throw new Error("unexpected strict manifest request");
      }
      return strictManifestBytes;
    },
  }),
});

pointCalls = 0;
verifyCalls = 0;
const mainClosure = await validateProviderFeasibilityEvidencePointClosureV1(
  requestFromGolden(golden, capability),
);
if (
  mainClosure.authority !== golden.fixtureAuthority ||
  mainClosure.relativePath !== golden.expected.evidenceRelativePath ||
  pointCalls !== 3 ||
  verifyCalls !== 11
) {
  throw new Error(`golden self-validation drifted: ${pointCalls}/${verifyCalls}`);
}
for (const vector of positiveVectors) {
  pointCalls = 0;
  verifyCalls = 0;
  const request = requestFromGolden(golden, capability);
  const closure = await validateProviderFeasibilityEvidencePointClosureV1({
    ...request,
    realFilesystemConformanceResult: jsonClone(
      vector.realFilesystemConformanceResult,
    ),
    realFilesystemConformanceResultLocator: jsonClone(
      vector.realFilesystemConformanceResultLocator,
    ),
    realFilesystemConformanceResultPin: jsonClone(
      vector.realFilesystemConformanceResultPin,
    ),
    runtimeAttestation: jsonClone(vector.runtimeAttestation),
    providerFeasibilityEvidence: jsonClone(vector.providerFeasibilityEvidence),
    providerFeasibilityEvidencePin: jsonClone(
      vector.providerFeasibilityEvidencePin,
    ),
  });
  if (
    closure.providerFeasibilityEvidence.payload.result !== vector.result ||
    closure.providerFeasibilityEvidence.payload.issuedAt !== vector.issuedAt ||
    pointCalls !== 3 ||
    verifyCalls !== 11
  ) {
    throw new Error(`positive vector ${vector.vectorId} drifted`);
  }
}

const draftInvalid = {
  runtimeInvalidDependency: runtimeInvalid,
};
const frozenSnapshotProjection = {
  runtimeAttestationContentDigest:
    mainClosure.runtimeAttestationPointClosure.runtimeAttestation.contentDigest,
  runtimeAttestationGeneration:
    mainClosure.runtimeAttestationPointClosure.runtimeAttestation.payload
      .attestationGeneration,
  runtimeIssuedAt:
    mainClosure.runtimeAttestationPointClosure.runtimeAttestation.payload.issuedAt,
  runtimeIpcEndpointAttestationDigest:
    mainClosure.runtimeAttestationPointClosure.runtimeAttestation.payload
      .ipcEndpointAttestationDigest,
  semanticProviderPolicyDigest:
    mainClosure.runtimeAttestationPointClosure.semanticProviderPolicyDigest,
  filesystemProfileDigest:
    mainClosure.runtimeAttestationPointClosure.filesystemProfileDigest,
  realFilesystemConformanceResultContentDigest:
    mainClosure.runtimeAttestationPointClosure.conformanceResultClosure.result
      .contentDigest,
  conformanceCaseResultCount:
    mainClosure.runtimeAttestationPointClosure.conformanceResultClosure.caseResultCount,
  conformancePassedCaseResultCount:
    mainClosure.runtimeAttestationPointClosure.conformanceResultClosure
      .passedCaseResultCount,
  conformanceFailedCaseResultCount:
    mainClosure.runtimeAttestationPointClosure.conformanceResultClosure
      .failedCaseResultCount,
  conformanceUnsupportedCaseResultCount:
    mainClosure.runtimeAttestationPointClosure.conformanceResultClosure
      .unsupportedCaseResultCount,
  evidenceId: mainClosure.providerFeasibilityEvidence.evidenceId,
  evidenceContentDigest: mainClosure.providerFeasibilityEvidence.contentDigest,
  evidenceIssuedAt: mainClosure.providerFeasibilityEvidence.payload.issuedAt,
  evidenceResult: mainClosure.providerFeasibilityEvidence.payload.result,
  qaApproverKeyId: mainClosure.qaApproverPublicKey.keyId,
  releaseApproverKeyId: mainClosure.releaseApproverPublicKey.keyId,
  qaApproverPublicKeyDigest: mainClosure.qaApproverPublicKey.publicKeyDigest,
  releaseApproverPublicKeyDigest:
    mainClosure.releaseApproverPublicKey.publicKeyDigest,
  evidenceRelativePath: mainClosure.relativePath,
};

const invalidCases = [];
for (const caseId of PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_CASE_IDS_V1) {
  const runtimePrefix = "runtime-";
  const recipe = caseId.startsWith(runtimePrefix)
    ? {
        kind: "runtime_attestation_point",
        sourceOperation: caseId.slice(runtimePrefix.length),
      }
    : pointRecipe(golden, caseId, rootSeedHex);
  const draftCase = {
    caseId,
    group: caseId.startsWith(runtimePrefix)
      ? "runtime_attestation_point"
      : "provider_feasibility_evidence_point",
    mutation: {
      dialect:
        PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_RECIPE_DIALECT_V1,
      goldenResourcePath:
        PROVIDER_FEASIBILITY_EVIDENCE_POINT_GOLDEN_RESOURCE_PATH_V1,
      operation: caseId,
      recipe,
    },
    expected: {},
  };
  pointCalls = 0;
  verifyCalls = 0;
  const outcome = await executeProviderFeasibilityEvidencePointInvalidCaseV1(
    golden,
    draftInvalid,
    draftCase,
    capability,
  );
  const observedPointCalls = pointCalls;
  const observedVerifyCalls = verifyCalls;
  if (outcome.kind === "unexpected_acceptance") {
    throw new Error(`${caseId} was unexpectedly accepted`);
  }
  const witness =
    materializeProviderFeasibilityEvidencePointInvalidRequestWitnessV1(
      golden,
      draftInvalid,
      draftCase,
    );
  const materializedRequestSemanticDigest = semanticDigest(
    PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1,
    witness,
  );
  let expected;
  if (outcome.kind === "snapshot_acceptance") {
    if (
      outcome.authority !== golden.fixtureAuthority ||
      JSON.stringify(outcome.snapshotProjection) !==
        JSON.stringify(frozenSnapshotProjection) ||
      observedPointCalls !== 3 ||
      observedVerifyCalls !== 11
    ) {
      throw new Error(`${caseId} snapshot projection or crypto drifted`);
    }
    expected = {
      boundary: "snapshot_stability",
      outcome: "accepted_frozen_snapshot",
      authority: outcome.authority,
      snapshotProjection: frozenSnapshotProjection,
      pointAdmissionCount: observedPointCalls,
      signatureVerificationCount: observedVerifyCalls,
      materializedRequestSemanticDigest,
    };
  } else {
    if (
      outcome.publicFailure?.errorName !==
        "ProviderFeasibilityEvidencePointClosureValidationError" ||
      outcome.publicFailure.code !== "provider_unavailable" ||
      outcome.publicFailure.reason !== "attestation_invalid"
    ) {
      throw new Error(`${caseId} public failure drifted`);
    }
    expected = {
      boundary: "internal_diagnostic",
      stage: outcome.stage,
      reason: outcome.reason,
      publicFailureReason: "attestation_invalid",
      publicFailure: outcome.publicFailure,
      pointAdmissionCount: observedPointCalls,
      signatureVerificationCount: observedVerifyCalls,
      materializedRequestSemanticDigest,
    };
  }
  invalidCases.push({ ...draftCase, expected });
}

const goldenBytes = prettyBytes(golden);
const runtimeCaseCount = invalidCases.filter(
  (entry) => entry.group === "runtime_attestation_point",
).length;
const pointCaseCount = invalidCases.length - runtimeCaseCount;
const invalidWithoutDigest = {
  schemaVersion: 1,
  profile: "provider_feasibility_evidence_point_invalid_v1",
  fixtureAuthority: "none_rejection_only",
  canonicalizationProfile: "rfc8785-jcs-safe-integer-v1",
  verificationProfile: "ed25519-rfc8032-cofactorless-prime-subgroup-v1",
  semanticDomain:
    PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_SEMANTIC_DOMAIN_V1,
  materializedRequestSemanticDomain:
    PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1,
  goldenDependency: {
    resourcePath:
      PROVIDER_FEASIBILITY_EVIDENCE_POINT_GOLDEN_RESOURCE_PATH_V1,
    resourceByteLength: goldenBytes.byteLength,
    resourceSha256Hex: sha256Hex(goldenBytes),
    semanticContentDigest: golden.semanticContentDigest,
  },
  runtimeInvalidDependency: runtimeInvalid,
  mutationRecipeDialect:
    PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_RECIPE_DIALECT_V1,
  runtimeCaseCount,
  pointCaseCount,
  caseCount: invalidCases.length,
  caseIds: [...PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_CASE_IDS_V1],
  cases: invalidCases,
};
const invalid = {
  ...invalidWithoutDigest,
  semanticContentDigest: semanticDigest(
    PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_SEMANTIC_DOMAIN_V1,
    invalidWithoutDigest,
  ),
};

const check = process.argv.includes("--check");
await writeOrCheck(
  PROVIDER_FEASIBILITY_EVIDENCE_POINT_GOLDEN_RESOURCE_PATH_V1,
  golden,
  check,
);
await writeOrCheck(
  PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_RESOURCE_PATH_V1,
  invalid,
  check,
);
process.stdout.write(
  `${check ? "Verified" : "Generated"} provider feasibility evidence point ` +
    `${runtimeCaseCount} runtime + ${pointCaseCount} point = ${invalidCases.length} invalid cases; ` +
    `golden ${goldenBytes.byteLength}/${sha256Hex(goldenBytes)}, ` +
    `invalid ${prettyBytes(invalid).byteLength}/${sha256Hex(prettyBytes(invalid))}.\n`,
);
