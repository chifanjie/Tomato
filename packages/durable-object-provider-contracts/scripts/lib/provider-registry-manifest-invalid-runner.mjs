import {
  createHash,
  createPrivateKey,
  sign,
} from "node:crypto";

import {
  canonicalizeJcsSafeIntegerUtf8V1,
} from "../../dist/jcs.js";
import {
  createProviderRegistryManifestSignatureMessageV1,
  createStoreDurableObjectProviderRegistryEntrySignatureMessageV1,
  createStoreDurableObjectProviderRuntimeAttestationSignatureMessageV1,
  createStoreDurableObjectProviderVerificationPublicKeySignatureMessageV1,
  deriveProviderRegistryManifestContentDigestV1,
  deriveProviderRegistryManifestGenerationIdV1,
  deriveStoreDurableObjectProviderRegistryEntryContentDigestV1,
  deriveStoreDurableObjectProviderRuntimeAttestationContentDigestV1,
  deriveStoreProviderVerificationKeyIdV1,
} from "../../dist/provider-registry-records.js";
import {
  deriveProviderEd25519PublicKeyDigestInternalV1,
} from "../../dist/provider-registry-trust.js";

const PROVIDER_A = "durable-object-provider:native-a";
const PROVIDER_B = "durable-object-provider:native-b";
const PROVIDER_C = "durable-object-provider:native-c";
const REGISTRY_PREFIX = "provider-registry-ed25519";
const MANIFEST_PREFIX = "provider-registry-manifest-ed25519";
const INVALID_RECIPE_DIALECT =
  "provider_registry_manifest_history_invalid_recipe_v1";
const GOLDEN_RESOURCE_PATH =
  "fixtures/v1/golden/provider-registry-entry-manifest-history-v1.json";

function freezeRecipeOracle(rows) {
  if (rows.length !== 89) {
    throw new TypeError("invalid recipe oracle case-count closure");
  }
  const seen = new Set();
  const frozen = rows.map((row) => {
    if (
      !Array.isArray(row) ||
      row.length !== 3 ||
      typeof row[0] !== "string" ||
      typeof row[1] !== "string" ||
      !Array.isArray(row[2]) ||
      row[2].some((operand) => typeof operand !== "string") ||
      seen.has(row[0])
    ) {
      throw new TypeError("invalid recipe oracle tuple closure");
    }
    seen.add(row[0]);
    return Object.freeze({
      caseId: row[0],
      targetJsonPointer: row[1],
      operands: Object.freeze([...row[2]]),
    });
  });
  if (seen.size !== rows.length) {
    throw new TypeError("invalid recipe oracle case-ID closure");
  }
  return Object.freeze(frozen);
}

/*
 * This is deliberately independent of the TypeScript definitions and the
 * generated JSON resource. Generator and verifier both pass through this
 * second-source tuple before any golden data is read or cloned.
 */
const INVALID_RECIPE_TUPLE_ORACLE = freezeRecipeOracle([
  ["history-empty", "/registryManifestHistory", []],
  ["input-extra-field", "", ["callerPath"]],
  ["input-missing-installation-id", "/installationIdentityGenerationId", []],
  ["input-bad-installation-id", "/installationIdentityGenerationId", ["installation-identity-generation:BAD"]],
  ["history-not-array", "/registryManifestHistory", ["object"]],
  ["history-sparse-array", "/registryManifestHistory/0", ["delete"]],
  ["envelope-null", "/registryManifestHistory/0", ["null"]],
  ["envelope-extra-field", "/registryManifestHistory/0/callerPath", ["latest.json"]],
  ["envelope-record-type-malformed", "/registryManifestHistory/0/recordType", ["provider_registry_entry"]],
  ["envelope-generation-id-malformed", "/registryManifestHistory/0/generationId", ["provider-registry-manifest:BAD"]],
  ["manifest-extra-field", "/registryManifestHistory/0/payload/callerPath", ["latest.json"]],
  ["manifest-profile-malformed", "/registryManifestHistory/0/payload/profile", ["provider_registry_manifest_v2"]],
  ["genesis-predecessor-branch-malformed", "/registryManifestHistory/0/payload/predecessor", ["manifest"]],
  ["successor-predecessor-branch-malformed", "/registryManifestHistory/1/payload/predecessor", ["genesis"]],
  ["entry-extra-field", "/registryManifestHistory/0/payload/members/0/registryEntry/callerPath", ["entry.json"]],
  ["entry-genesis-predecessor-branch-malformed", "/registryManifestHistory/0/payload/members/0/registryEntry/predecessorRegistryEntryContentDigest", ["sha256:00"]],
  ["entry-successor-predecessor-branch-malformed", "/registryManifestHistory/1/payload/members/0/registryEntry/predecessorRegistryEntryContentDigest", ["delete"]],
  ["verification-key-extra-field", "/registryManifestHistory/0/payload/members/0/registryEntry/verificationKeys/publicKeyRecords/0/path", ["key.json"]],
  ["manifest-signature-malformed", "/registryManifestHistory/0/payload/manifestSignature", ["malformed"]],
  ["envelope-generation-id-mismatch", "/registryManifestHistory/0/generationId", ["generation-2"]],
  ["payload-generation-id-mismatch", "/registryManifestHistory/0/payload/generationId", ["generation-2"]],
  ["envelope-content-digest-mismatch", "/registryManifestHistory/0/contentDigest", ["sha256:ee"]],
  ["manifest-installation-id-mismatch", "/registryManifestHistory/0/payload/installationIdentityGenerationId", ["installation-identity-generation:00"]],
  ["manifest-generation-starts-at-two", "/registryManifestHistory/0/payload/manifestGeneration", ["2"]],
  ["manifest-generation-gap", "/registryManifestHistory/1/payload/manifestGeneration", ["3"]],
  ["predecessor-generation-id-mismatch", "/registryManifestHistory/1/payload/predecessor/generationId", ["generation-2"]],
  ["predecessor-content-digest-mismatch", "/registryManifestHistory/1/payload/predecessor/contentDigest", ["sha256:ff"]],
  ["manifest-sibling-generation", "/registryManifestHistory/2", ["copy-generation-2"]],
  ["root-generation-rollback", "/registryManifestHistory/2/payload/activeRootMetadata", ["root-1"]],
  ["unknown-root-pin", "/registryManifestHistory/0/payload/activeRootMetadata/contentDigest", ["sha256:ff"]],
  ["member-order-reversed", "/registryManifestHistory/2/payload/members", ["reverse"]],
  ["member-duplicate", "/registryManifestHistory/2/payload/members", ["duplicate-0"]],
  ["tombstone-disappears", "/registryManifestHistory/6/payload/members/0", ["delete"]],
  ["enabled-entry-digest-mismatch", "/registryManifestHistory/0/payload/members/0/registryEntryContentDigest", ["sha256:ff"]],
  ["member-entry-provider-mismatch", "/registryManifestHistory/0/payload/members/0/providerId", ["native-b"]],
  ["entry-generation-jump", "/registryManifestHistory/1/payload/members/0/registryEntry/registryGeneration", ["3"]],
  ["entry-predecessor-digest-mismatch", "/registryManifestHistory/1/payload/members/0/registryEntry/predecessorRegistryEntryContentDigest", ["sha256:ff"]],
  ["same-entry-digest-different-bytes", "/registryManifestHistory/1/payload/members/0", ["reuse-digest-change-signature"]],
  ["runtime-pin-digest-mismatch", "/registryManifestHistory/0/payload/members/0/registryEntry/runtimeAttestation/contentDigest", ["sha256:ff"]],
  ["runtime-provider-mismatch", "/registryManifestHistory/0/payload/members/0/registryEntry/runtimeAttestation/payload/providerId", ["native-b"]],
  ["provider-key-id-mismatch", "/registryManifestHistory/0/payload/members/0/registryEntry/verificationKeys/publicKeyRecords/0/keyId", ["00"]],
  ["provider-key-raw-digest-mismatch", "/registryManifestHistory/0/payload/members/0/registryEntry/verificationKeys/publicKeyRecords/0/publicKeyDigest", ["sha256:ff"]],
  ["provider-key-order-reversed", "/registryManifestHistory/0/payload/members/0/registryEntry/verificationKeys/publicKeyRecords", ["reverse"]],
  ["active-key-missing", "/registryManifestHistory/0/payload/members/0/registryEntry/verificationKeys/activeKeyIds/operationReceipt", ["00"]],
  ["active-key-wrong-usage", "/registryManifestHistory/0/payload/members/0/registryEntry/verificationKeys/activeKeyIds/operationReceipt", ["containment-key"]],
  ["active-key-revoked", "/registryManifestHistory/1/payload/members/0/registryEntry/verificationKeys/compromisedRevokedKeyIds", ["active-operation"]],
  ["revoked-key-unknown", "/registryManifestHistory/1/payload/members/0/registryEntry/verificationKeys/compromisedRevokedKeyIds", ["00"]],
  ["rotated-key-backdated", "/registryManifestHistory/1/payload/members/0/registryEntry/verificationKeys/publicKeyRecords", ["generation-1"]],
  ["key-history-removal", "/registryManifestHistory/1/payload/members/0/registryEntry/verificationKeys/publicKeyRecords", ["remove-migration-key"]],
  ["retained-key-bytes-changed", "/registryManifestHistory/1/payload/members/0/registryEntry/verificationKeys/publicKeyRecords/0", ["change-signature"]],
  ["public-key-material-alias-root", "/registryManifestHistory/0/payload/members/0/registryEntry/verificationKeys/publicKeyRecords", ["usage=migration_semantic_proof", "root-1"]],
  ["provider-key-cap-exceeded", "/registryManifestHistory/0/payload/members/0/registryEntry/verificationKeys/publicKeyRecords", ["257"]],
  ["per-usage-key-cap-exceeded", "/registryManifestHistory/0/payload/members/0/registryEntry/verificationKeys/publicKeyRecords", ["operation_receipt", "65"]],
  ["manifest-signature-bitflip", "/registryManifestHistory/0/payload/manifestSignature", ["last-bit"]],
  ["manifest-signature-wrong-signer", "/registryManifestHistory/2/payload/manifestSignature", ["root-2"]],
  ["manifest-signature-wrong-domain", "/registryManifestHistory/0/payload/manifestSignature", ["provider-registry-manifest-wrong-signature-v1"]],
  ["manifest-signature-wrong-prefix", "/registryManifestHistory/0/payload/manifestSignature", ["provider-registry-ed25519"]],
  ["runtime-signature-bitflip", "/registryManifestHistory/0/payload/members/0/registryEntry/runtimeAttestation/payload/registrySignature", ["last-bit"]],
  ["runtime-signature-wrong-signer", "/registryManifestHistory/1/payload/members/0/registryEntry/runtimeAttestation/payload/registrySignature", ["root-1"]],
  ["runtime-signature-wrong-domain", "/registryManifestHistory/0/payload/members/0/registryEntry/runtimeAttestation/payload/registrySignature", ["store-provider-runtime-attestation-wrong-signature-v1"]],
  ["key-signature-bitflip", "/registryManifestHistory/0/payload/members/0/registryEntry/verificationKeys/publicKeyRecords/0/registrySignature", ["last-bit"]],
  ["key-signature-wrong-domain", "/registryManifestHistory/0/payload/members/0/registryEntry/verificationKeys/publicKeyRecords/0/registrySignature", ["store-provider-key-wrong-signature-v1"]],
  ["entry-signature-bitflip", "/registryManifestHistory/0/payload/members/0/registryEntry/registrySignature", ["last-bit"]],
  ["entry-signature-wrong-domain", "/registryManifestHistory/0/payload/members/0/registryEntry/registrySignature", ["store-provider-entry-wrong-signature-v1"]],
  ["public-key-small-order", "/registryManifestHistory/0/payload/members/0/registryEntry/verificationKeys/publicKeyRecords", ["usage=migration_semantic_proof", "identity-point"]],
  ["steady-two-enabled-bypass", "/registryManifestHistory/2/payload/routing", ["steady"]],
  ["migration-missing-member", "/registryManifestHistory/2/payload/members/1", ["delete"]],
  ["migration-source-equals-destination", "/registryManifestHistory/2/payload/routing/sourceProviderId", ["destination"]],
  ["migration-active-outsider", "/registryManifestHistory/2/payload/routing/activeForMigrationWrites", ["native-c"]],
  ["migration-phase-skip", "/registryManifestHistory/3/payload/routing/phase", ["source_drained"]],
  ["migration-id-switch", "/registryManifestHistory/3/payload/routing/migrationId", ["provider-migration:00"]],
  ["tombstone-generation-wrong", "/registryManifestHistory/5/payload/members/0/revokedAtManifestGeneration", ["5"]],
  ["tombstone-digest-wrong", "/registryManifestHistory/5/payload/members/0/lastEnabledRegistryEntryContentDigest", ["sha256:ff"]],
  ["tombstone-mutated-after-retention", "/registryManifestHistory/6/payload/members/0/reason", ["provider_compromised"]],
  ["provider-resurrection", "/registryManifestHistory/6/payload/members/0", ["enabled-a3"]],
  ["early-steady-before-drained", "/registryManifestHistory/4", ["tombstone-and-steady"]],
  ["locator-alias-extra-field", "/registryManifestHistory/0/locator", ["latest"]],
  ["locator-path-extra-field", "/registryManifestHistory/0/path", ["provider/registry-manifests/latest.json"]],
  ["locator-filename-key-extra-field", "/registryManifestHistory/0/filenameKey", ["idh-00"]],
  ["history-count-cap-4097", "/registryManifestHistory", ["4097"]],
  ["single-envelope-byte-cap", "/registryManifestHistory/0/payload/issuedAt", ["4194305", "61"]],
  ["total-history-byte-cap", "/registryManifestHistory", ["68", "4000000"]],
  ["approval-snapshot-diverges", "/registryManifestHistory/2/payload/members/1/registryEntry/feasibilityApprovalKeys/activeKeyIds", ["swap"]],
  ["binding-active-missing", "/registryManifestHistory/0/payload/members/0/registryEntry/verificationKeys/activeBindingDerivationKeyGeneration", ["2"]],
  ["binding-revocation-unknown", "/registryManifestHistory/1/payload/members/0/registryEntry/verificationKeys/compromisedRevokedBindingDerivationGenerations", ["2"]],
  ["approver-active-role-mismatch", "/registryManifestHistory/0/payload/members/0/registryEntry/feasibilityApprovalKeys/activeKeyIds", ["swap"]],
  ["approver-revocation-unknown", "/registryManifestHistory/0/payload/members/0/registryEntry/feasibilityApprovalKeys/compromisedRevokedKeyIds", ["00"]],
  ["binding-record-duplicate", "/registryManifestHistory/0/payload/members/0/registryEntry/verificationKeys/bindingDerivationGenerationRecords", ["duplicate-0"]],
  ["approver-record-order-reversed", "/registryManifestHistory/0/payload/members/0/registryEntry/feasibilityApprovalKeys/publicKeyRecords", ["reverse"]],
]);

function exactDataObjectDescriptors(value, expectedKeys, label) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    Object.getOwnPropertySymbols(value).length !== 0
  ) {
    throw new TypeError(`${label} must be a plain data object`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const actualKeys = Object.keys(descriptors).sort();
  const sortedExpected = [...expectedKeys].sort();
  if (
    actualKeys.length !== sortedExpected.length ||
    actualKeys.some((key, index) => key !== sortedExpected[index])
  ) {
    throw new TypeError(`${label} has unexpected fields`);
  }
  for (const key of expectedKeys) {
    const descriptor = descriptors[key];
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      throw new TypeError(`${label} must use enumerable data properties`);
    }
  }
  return descriptors;
}

function exactDenseArrayValues(value, expectedLength, label) {
  if (
    !Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Array.prototype ||
    Object.getOwnPropertySymbols(value).length !== 0
  ) {
    throw new TypeError(`${label} must be a plain array`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const lengthDescriptor = descriptors.length;
  if (
    lengthDescriptor === undefined ||
    !("value" in lengthDescriptor) ||
    lengthDescriptor.value !== expectedLength ||
    Object.keys(descriptors).length !== expectedLength + 1
  ) {
    throw new TypeError(`${label} has the wrong tuple length`);
  }
  const output = [];
  for (let index = 0; index < expectedLength; index += 1) {
    const descriptor = descriptors[String(index)];
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      throw new TypeError(`${label} must be a dense data tuple`);
    }
    output.push(descriptor.value);
  }
  return output;
}

export function assertProviderRegistryManifestInvalidRecipeV1(invalidCase) {
  const caseDescriptors = exactDataObjectDescriptors(
    invalidCase,
    ["caseId", "mutation", "expected"],
    "invalid case",
  );
  const caseId = caseDescriptors.caseId.value;
  const oracle = INVALID_RECIPE_TUPLE_ORACLE.find(
    (candidate) => candidate.caseId === caseId,
  );
  if (typeof caseId !== "string" || oracle === undefined) {
    throw new TypeError("invalid case is absent from the recipe oracle");
  }
  const mutationDescriptors = exactDataObjectDescriptors(
    caseDescriptors.mutation.value,
    ["dialect", "goldenResourcePath", "steps"],
    `invalid case ${caseId} mutation`,
  );
  if (
    mutationDescriptors.dialect.value !== INVALID_RECIPE_DIALECT ||
    mutationDescriptors.goldenResourcePath.value !== GOLDEN_RESOURCE_PATH
  ) {
    throw new TypeError(`invalid case ${caseId} recipe closure mismatch`);
  }
  const steps = exactDenseArrayValues(
    mutationDescriptors.steps.value,
    1,
    `invalid case ${caseId} steps`,
  );
  const stepDescriptors = exactDataObjectDescriptors(
    steps[0],
    ["operation", "targetJsonPointer", "operands"],
    `invalid case ${caseId} step`,
  );
  if (
    stepDescriptors.operation.value !== caseId ||
    stepDescriptors.operation.value !== oracle.caseId ||
    stepDescriptors.targetJsonPointer.value !== oracle.targetJsonPointer
  ) {
    throw new TypeError(`invalid case ${caseId} recipe tuple mismatch`);
  }
  const operands = exactDenseArrayValues(
    stepDescriptors.operands.value,
    oracle.operands.length,
    `invalid case ${caseId} operands`,
  );
  if (
    operands.some(
      (operand, index) =>
        typeof operand !== "string" || operand !== oracle.operands[index],
    )
  ) {
    throw new TypeError(`invalid case ${caseId} operand tuple mismatch`);
  }
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function utf8Compare(left, right) {
  return Buffer.from(left, "utf8").compare(Buffer.from(right, "utf8"));
}

function tupleCompare(left, right) {
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    const order = utf8Compare(left[index], right[index]);
    if (order !== 0) return order;
  }
  return left.length - right.length;
}

function flipLastBit(value) {
  return `${value.slice(0, -1)}${value.endsWith("0") ? "1" : "0"}`;
}

function rootSeedHex(golden, rootGeneration) {
  const seeds = golden.deterministicSeeds.rootHistoryDependencySeeds;
  const seed = [
    seeds.bootstrapRootSeedHex,
    seeds.plannedRootSeedHex,
    seeds.compromiseRootSeedHex,
  ][rootGeneration - 1];
  if (typeof seed !== "string") {
    throw new TypeError(`unknown fixture root generation: ${rootGeneration}`);
  }
  return seed;
}

function rootPrivateKey(golden, rootGeneration) {
  const seed = Buffer.from(rootSeedHex(golden, rootGeneration), "hex");
  if (seed.byteLength !== 32) {
    throw new TypeError("fixture root signing seed must be 32 bytes");
  }
  return createPrivateKey({
    key: Buffer.concat([
      Buffer.from("302e020100300506032b657004220420", "hex"),
      seed,
    ]),
    format: "der",
    type: "pkcs8",
  });
}

function rootEnvelope(golden, rootGeneration) {
  const envelope = golden.rootMetadataHistory[rootGeneration - 1];
  if (envelope === undefined) {
    throw new TypeError(`unknown fixture root: ${rootGeneration}`);
  }
  return envelope;
}

function rootKeyId(golden, rootGeneration) {
  return rootEnvelope(golden, rootGeneration).rootKeyId;
}

function signatureHex(golden, rootGeneration, message) {
  return sign(
    null,
    Buffer.from(message),
    rootPrivateKey(golden, rootGeneration),
  ).toString("hex");
}

function rootWire(golden, prefix, rootGeneration, message) {
  return `${prefix}:${rootKeyId(golden, rootGeneration)}:${signatureHex(
    golden,
    rootGeneration,
    message,
  )}`;
}

function unsignedClaims(value, signatureField) {
  const output = { ...value };
  delete output[signatureField];
  return output;
}

function resignRuntime(golden, runtime, rootGeneration) {
  const claims = unsignedClaims(runtime, "registrySignature");
  return {
    ...claims,
    registrySignature: rootWire(
      golden,
      REGISTRY_PREFIX,
      rootGeneration,
      createStoreDurableObjectProviderRuntimeAttestationSignatureMessageV1(
        claims,
        rootKeyId(golden, rootGeneration),
      ),
    ),
  };
}

function resignVerificationRecord(golden, record, rootGeneration) {
  const claims = unsignedClaims(record, "registrySignature");
  return {
    ...claims,
    registrySignature: rootWire(
      golden,
      REGISTRY_PREFIX,
      rootGeneration,
      createStoreDurableObjectProviderVerificationPublicKeySignatureMessageV1(
        claims,
        rootKeyId(golden, rootGeneration),
      ),
    ),
  };
}

function resignEntry(golden, entry, rootGeneration) {
  const claims = unsignedClaims(entry, "registrySignature");
  return {
    ...claims,
    registrySignature: rootWire(
      golden,
      REGISTRY_PREFIX,
      rootGeneration,
      createStoreDurableObjectProviderRegistryEntrySignatureMessageV1(
        claims,
        rootKeyId(golden, rootGeneration),
      ),
    ),
  };
}

function resignManifest(golden, payload, rootGeneration) {
  const oldClaims = unsignedClaims(payload, "manifestSignature");
  const generationId = deriveProviderRegistryManifestGenerationIdV1(oldClaims);
  const claims = { ...oldClaims, generationId };
  const signed = {
    ...claims,
    manifestSignature: rootWire(
      golden,
      MANIFEST_PREFIX,
      rootGeneration,
      createProviderRegistryManifestSignatureMessageV1(
        claims,
        rootKeyId(golden, rootGeneration),
      ),
    ),
  };
  return {
    schemaVersion: 1,
    recordType: "provider_registry_manifest",
    generationId,
    contentDigest: deriveProviderRegistryManifestContentDigestV1(signed),
    payload: signed,
  };
}

function history(candidate) {
  if (!Array.isArray(candidate.registryManifestHistory)) {
    throw new TypeError("candidate manifest history is not an array");
  }
  return candidate.registryManifestHistory;
}

function manifest(candidate, manifestIndex) {
  const envelope = history(candidate)[manifestIndex];
  if (envelope === undefined || envelope === null) {
    throw new TypeError(`fixture manifest ${manifestIndex + 1} is absent`);
  }
  return envelope.payload;
}

function enabledEntry(candidate, manifestIndex, providerId = PROVIDER_A) {
  const member = manifest(candidate, manifestIndex).members.find(
    (item) =>
      item.providerId === providerId && item.disposition === "enabled",
  );
  if (member === undefined) {
    throw new TypeError(`enabled fixture member is absent: ${providerId}`);
  }
  return cloneJson(member.registryEntry);
}

function resealManifestAt(golden, candidate, manifestIndex, rootGeneration) {
  const payload = cloneJson(manifest(candidate, manifestIndex));
  const generation =
    rootGeneration ?? payload.activeRootMetadata.rootGeneration;
  history(candidate)[manifestIndex] = resignManifest(golden, payload, generation);
}

function replaceEntry(
  golden,
  candidate,
  manifestIndex,
  providerId,
  entry,
  rootGeneration,
) {
  const payload = cloneJson(manifest(candidate, manifestIndex));
  const memberIndex = payload.members.findIndex(
    (member) =>
      member.providerId === providerId && member.disposition === "enabled",
  );
  if (memberIndex < 0) {
    throw new TypeError(`enabled fixture member is absent: ${providerId}`);
  }
  payload.members[memberIndex] = {
    ...payload.members[memberIndex],
    registryEntryContentDigest:
      deriveStoreDurableObjectProviderRegistryEntryContentDigestV1(entry),
    registryEntry: entry,
  };
  history(candidate)[manifestIndex] = resignManifest(
    golden,
    payload,
    rootGeneration ?? payload.activeRootMetadata.rootGeneration,
  );
}

function wrongDomainWire(
  golden,
  prefix,
  rootGeneration,
  domain,
  claims,
) {
  const keyId = rootKeyId(golden, rootGeneration);
  const message = canonicalizeJcsSafeIntegerUtf8V1([
    domain,
    { rootKeyId: keyId, domain, claims },
  ]);
  const signature = signatureHex(golden, rootGeneration, message);
  const publicKeyWire =
    rootEnvelope(golden, rootGeneration).payload.activeRoot.publicKeyBytes;
  return {
    wire: `${prefix}:${keyId}:${signature}`,
    proof: Object.freeze({
      rootGeneration,
      domain,
      publicKeyBytes: new Uint8Array(
        Buffer.from(publicKeyWire.slice("base64url:".length), "base64url"),
      ),
      messageBytes: new Uint8Array(message),
      signatureBytes: new Uint8Array(Buffer.from(signature, "hex")),
    }),
  };
}

function prefixLength(invalidCase) {
  const target = invalidCase.mutation.steps[0].targetJsonPointer;
  const match = /^\/registryManifestHistory\/(\d+)/u.exec(target);
  return match === null ? 1 : Number(match[1]) + 1;
}

function setNestedSignatureCase(
  golden,
  candidate,
  kind,
  mode,
  wrongDomainProofs,
) {
  const manifestIndex = kind === "runtime-wrong-signer" ? 1 : 0;
  const entryRoot = manifestIndex === 1 ? 2 : 1;
  const entry = enabledEntry(candidate, manifestIndex);
  if (kind.startsWith("runtime")) {
    const runtime = entry.runtimeAttestation.payload;
    if (mode === "bitflip") {
      runtime.registrySignature = flipLastBit(runtime.registrySignature);
    } else if (mode === "wrong-signer") {
      entry.runtimeAttestation.payload = resignRuntime(golden, runtime, 1);
    } else {
      const claims = unsignedClaims(runtime, "registrySignature");
      const alternate = wrongDomainWire(
        golden,
        REGISTRY_PREFIX,
        1,
        "store-provider-runtime-attestation-wrong-signature-v1",
        claims,
      );
      runtime.registrySignature = alternate.wire;
      wrongDomainProofs.push(alternate.proof);
    }
  } else if (kind.startsWith("key")) {
    const record = entry.verificationKeys.publicKeyRecords[0];
    if (mode === "bitflip") {
      record.registrySignature = flipLastBit(record.registrySignature);
    } else {
      const claims = unsignedClaims(record, "registrySignature");
      const alternate = wrongDomainWire(
        golden,
        REGISTRY_PREFIX,
        1,
        "store-provider-key-wrong-signature-v1",
        claims,
      );
      record.registrySignature = alternate.wire;
      wrongDomainProofs.push(alternate.proof);
    }
  } else {
    if (mode === "bitflip") {
      entry.registrySignature = flipLastBit(entry.registrySignature);
    } else {
      const claims = unsignedClaims(entry, "registrySignature");
      const alternate = wrongDomainWire(
        golden,
        REGISTRY_PREFIX,
        1,
        "store-provider-entry-wrong-signature-v1",
        claims,
      );
      entry.registrySignature = alternate.wire;
      wrongDomainProofs.push(alternate.proof);
    }
  }
  replaceEntry(
    golden,
    candidate,
    manifestIndex,
    PROVIDER_A,
    kind.startsWith("entry") ? entry : resignEntry(golden, entry, entryRoot),
    entryRoot,
  );
}

function syntheticProviderKeyRecord(golden, index, usage) {
  const raw = createHash("sha256")
    .update(`provider-registry-invalid-key-${index}`, "utf8")
    .digest();
  const publicKeyBytes = `base64url:${raw.toString("base64url")}`;
  const record = {
    profile: "store_durable_object_provider_verification_public_key_v1",
    providerId: PROVIDER_A,
    registryGenerationIntroduced: 1,
    keyId: "0".repeat(22),
    usage,
    algorithm: "ed25519",
    publicKeyBytes,
    publicKeyDigest:
      deriveProviderEd25519PublicKeyDigestInternalV1(publicKeyBytes),
    registrySignature:
      `provider-registry-ed25519:${rootKeyId(golden, 1)}:${"0".repeat(128)}`,
  };
  record.keyId = deriveStoreProviderVerificationKeyIdV1(record);
  return record;
}

function sortVerificationRecords(records) {
  records.sort((left, right) =>
    tupleCompare(
      [left.providerId, left.usage, left.keyId],
      [right.providerId, right.usage, right.keyId],
    ),
  );
}

function applyCase(golden, candidate, invalidCase, wrongDomainProofs) {
  const caseId = invalidCase.caseId;
  const step = invalidCase.mutation.steps[0];
  if (
    invalidCase.mutation.steps.length !== 1 ||
    step.operation !== caseId
  ) {
    throw new TypeError(`invalid mutation recipe closure: ${caseId}`);
  }
  const manifests = candidate.registryManifestHistory;
  const zeroDigest = `sha256:${"0".repeat(64)}`;
  const ffDigest = `sha256:${"f".repeat(64)}`;
  const zeroManifestId = `provider-registry-manifest:${"0".repeat(22)}`;
  const zeroInstallationId = `installation-identity-generation:${"0".repeat(22)}`;
  const zeroKeyId = "0".repeat(22);

  switch (caseId) {
    case "history-empty":
      candidate.registryManifestHistory = [];
      break;
    case "input-extra-field":
      candidate.callerPath = "latest.json";
      break;
    case "input-missing-installation-id":
      delete candidate.installationIdentityGenerationId;
      break;
    case "input-bad-installation-id":
      candidate.installationIdentityGenerationId = "installation-identity-generation:BAD";
      break;
    case "history-not-array":
      candidate.registryManifestHistory = {};
      break;
    case "history-sparse-array":
      delete manifests[0];
      break;
    case "envelope-null":
      manifests[0] = null;
      break;
    case "envelope-extra-field":
      manifests[0].callerPath = "latest.json";
      break;
    case "envelope-record-type-malformed":
      manifests[0].recordType = "provider_registry_entry";
      break;
    case "envelope-generation-id-malformed":
      manifests[0].generationId = "provider-registry-manifest:BAD";
      break;
    case "manifest-extra-field":
      manifest(candidate, 0).callerPath = "latest.json";
      break;
    case "manifest-profile-malformed":
      manifest(candidate, 0).profile = "provider_registry_manifest_v2";
      break;
    case "genesis-predecessor-branch-malformed":
      manifest(candidate, 0).predecessor = {
        state: "manifest",
        generationId: zeroManifestId,
        contentDigest: zeroDigest,
      };
      break;
    case "successor-predecessor-branch-malformed":
      manifest(candidate, 1).predecessor = { state: "genesis" };
      break;
    case "entry-extra-field":
      manifest(candidate, 0).members[0].registryEntry.callerPath = "entry.json";
      break;
    case "entry-genesis-predecessor-branch-malformed":
      manifest(candidate, 0).members[0].registryEntry
        .predecessorRegistryEntryContentDigest = zeroDigest;
      break;
    case "entry-successor-predecessor-branch-malformed":
      delete manifest(candidate, 1).members[0].registryEntry
        .predecessorRegistryEntryContentDigest;
      break;
    case "verification-key-extra-field":
      manifest(candidate, 0).members[0].registryEntry.verificationKeys
        .publicKeyRecords[0].path = "key.json";
      break;
    case "manifest-signature-malformed":
      manifest(candidate, 0).manifestSignature = "malformed";
      break;
    case "envelope-generation-id-mismatch":
      manifests[0].generationId = golden.registryManifestHistory[1].generationId;
      break;
    case "payload-generation-id-mismatch":
      manifest(candidate, 0).generationId = golden.registryManifestHistory[1].generationId;
      break;
    case "envelope-content-digest-mismatch":
      manifests[0].contentDigest = ffDigest;
      break;
    case "manifest-installation-id-mismatch":
      manifest(candidate, 0).installationIdentityGenerationId = zeroInstallationId;
      break;
    case "manifest-generation-starts-at-two": {
      const payload = manifest(candidate, 0);
      payload.manifestGeneration = 2;
      payload.predecessor = {
        state: "manifest",
        generationId: zeroManifestId,
        contentDigest: zeroDigest,
      };
      manifests[0] = resignManifest(golden, payload, 1);
      break;
    }
    case "manifest-generation-gap":
      manifest(candidate, 1).manifestGeneration = 3;
      resealManifestAt(golden, candidate, 1, 2);
      break;
    case "predecessor-generation-id-mismatch":
      manifest(candidate, 1).predecessor.generationId = zeroManifestId;
      resealManifestAt(golden, candidate, 1, 2);
      break;
    case "predecessor-content-digest-mismatch":
      manifest(candidate, 1).predecessor.contentDigest = ffDigest;
      resealManifestAt(golden, candidate, 1, 2);
      break;
    case "manifest-sibling-generation": {
      const sibling = cloneJson(golden.registryManifestHistory[1].payload);
      sibling.members[0].registryEntry.registrySignature = flipLastBit(
        sibling.members[0].registryEntry.registrySignature,
      );
      manifests[2] = resignManifest(golden, sibling, 2);
      break;
    }
    case "root-generation-rollback": {
      const payload = manifest(candidate, 2);
      payload.activeRootMetadata = cloneJson(
        golden.registryManifestHistory[0].payload.activeRootMetadata,
      );
      manifests[2] = resignManifest(golden, payload, 1);
      break;
    }
    case "unknown-root-pin":
      manifest(candidate, 0).activeRootMetadata.contentDigest = ffDigest;
      resealManifestAt(golden, candidate, 0, 1);
      break;
    case "member-order-reversed":
      manifest(candidate, 2).members.reverse();
      break;
    case "member-duplicate":
      manifest(candidate, 2).members.push(cloneJson(manifest(candidate, 2).members[0]));
      break;
    case "tombstone-disappears":
      manifest(candidate, 6).members.splice(0, 1);
      resealManifestAt(golden, candidate, 6, 3);
      break;
    case "enabled-entry-digest-mismatch":
      manifest(candidate, 0).members[0].registryEntryContentDigest = ffDigest;
      resealManifestAt(golden, candidate, 0, 1);
      break;
    case "member-entry-provider-mismatch":
      manifest(candidate, 0).members[0].providerId = PROVIDER_B;
      resealManifestAt(golden, candidate, 0, 1);
      break;
    case "entry-generation-jump": {
      const entry = enabledEntry(candidate, 1);
      entry.registryGeneration = 3;
      replaceEntry(golden, candidate, 1, PROVIDER_A, resignEntry(golden, entry, 2), 2);
      break;
    }
    case "entry-predecessor-digest-mismatch": {
      const entry = enabledEntry(candidate, 1);
      entry.predecessorRegistryEntryContentDigest = ffDigest;
      replaceEntry(golden, candidate, 1, PROVIDER_A, resignEntry(golden, entry, 2), 2);
      break;
    }
    case "same-entry-digest-different-bytes": {
      const previous = cloneJson(golden.registryManifestHistory[0].payload.members[0]);
      previous.registryEntry.registrySignature = flipLastBit(
        previous.registryEntry.registrySignature,
      );
      const payload = manifest(candidate, 1);
      payload.members[0] = previous;
      manifests[1] = resignManifest(golden, payload, 2);
      break;
    }
    case "runtime-pin-digest-mismatch": {
      const entry = enabledEntry(candidate, 0);
      entry.runtimeAttestation.contentDigest = ffDigest;
      replaceEntry(golden, candidate, 0, PROVIDER_A, resignEntry(golden, entry, 1), 1);
      break;
    }
    case "runtime-provider-mismatch": {
      const entry = enabledEntry(candidate, 0);
      entry.runtimeAttestation.payload.providerId = PROVIDER_B;
      entry.runtimeAttestation.payload = resignRuntime(
        golden,
        entry.runtimeAttestation.payload,
        1,
      );
      entry.runtimeAttestation.contentDigest =
        deriveStoreDurableObjectProviderRuntimeAttestationContentDigestV1(
          entry.runtimeAttestation.payload,
        );
      replaceEntry(golden, candidate, 0, PROVIDER_A, resignEntry(golden, entry, 1), 1);
      break;
    }
    case "provider-key-id-mismatch": {
      const entry = enabledEntry(candidate, 0);
      const record = entry.verificationKeys.publicKeyRecords[0];
      record.keyId = zeroKeyId;
      entry.verificationKeys.activeKeyIds.containmentProof = zeroKeyId;
      replaceEntry(golden, candidate, 0, PROVIDER_A, resignEntry(golden, entry, 1), 1);
      break;
    }
    case "provider-key-raw-digest-mismatch": {
      const entry = enabledEntry(candidate, 0);
      entry.verificationKeys.publicKeyRecords[0].publicKeyDigest = ffDigest;
      replaceEntry(golden, candidate, 0, PROVIDER_A, resignEntry(golden, entry, 1), 1);
      break;
    }
    case "provider-key-order-reversed":
      manifest(candidate, 0).members[0].registryEntry.verificationKeys
        .publicKeyRecords.reverse();
      break;
    case "active-key-missing": {
      const entry = enabledEntry(candidate, 0);
      entry.verificationKeys.activeKeyIds.operationReceipt = zeroKeyId;
      replaceEntry(golden, candidate, 0, PROVIDER_A, resignEntry(golden, entry, 1), 1);
      break;
    }
    case "active-key-wrong-usage": {
      const entry = enabledEntry(candidate, 0);
      entry.verificationKeys.activeKeyIds.operationReceipt =
        entry.verificationKeys.activeKeyIds.containmentProof;
      replaceEntry(golden, candidate, 0, PROVIDER_A, resignEntry(golden, entry, 1), 1);
      break;
    }
    case "active-key-revoked": {
      const entry = enabledEntry(candidate, 1);
      entry.verificationKeys.compromisedRevokedKeyIds = [
        entry.verificationKeys.activeKeyIds.operationReceipt,
      ];
      replaceEntry(golden, candidate, 1, PROVIDER_A, resignEntry(golden, entry, 2), 2);
      break;
    }
    case "revoked-key-unknown": {
      const entry = enabledEntry(candidate, 1);
      entry.verificationKeys.compromisedRevokedKeyIds = [zeroKeyId];
      replaceEntry(golden, candidate, 1, PROVIDER_A, resignEntry(golden, entry, 2), 2);
      break;
    }
    case "rotated-key-backdated": {
      const entry = enabledEntry(candidate, 1);
      const index = entry.verificationKeys.publicKeyRecords.findIndex(
        (record) => record.registryGenerationIntroduced === 2,
      );
      entry.verificationKeys.publicKeyRecords[index] = resignVerificationRecord(
        golden,
        { ...entry.verificationKeys.publicKeyRecords[index], registryGenerationIntroduced: 1 },
        1,
      );
      replaceEntry(golden, candidate, 1, PROVIDER_A, resignEntry(golden, entry, 2), 2);
      break;
    }
    case "key-history-removal": {
      const entry = enabledEntry(candidate, 1);
      entry.verificationKeys.publicKeyRecords =
        entry.verificationKeys.publicKeyRecords.filter(
          (record) => record.usage !== "migration_semantic_proof",
        );
      replaceEntry(golden, candidate, 1, PROVIDER_A, resignEntry(golden, entry, 2), 2);
      break;
    }
    case "retained-key-bytes-changed": {
      const entry = enabledEntry(candidate, 1);
      const retainedIndex = entry.verificationKeys.publicKeyRecords.findIndex(
        (record) => record.registryGenerationIntroduced === 1,
      );
      entry.verificationKeys.publicKeyRecords[retainedIndex] =
        resignVerificationRecord(
          golden,
          entry.verificationKeys.publicKeyRecords[retainedIndex],
          2,
        );
      replaceEntry(golden, candidate, 1, PROVIDER_A, resignEntry(golden, entry, 2), 2);
      break;
    }
    case "public-key-material-alias-root": {
      const entry = enabledEntry(candidate, 0);
      const keyIndex = entry.verificationKeys.publicKeyRecords.findIndex(
        (record) => record.usage === "migration_semantic_proof",
      );
      const record = entry.verificationKeys.publicKeyRecords[keyIndex];
      record.publicKeyBytes = rootEnvelope(golden, 1).payload.activeRoot.publicKeyBytes;
      record.publicKeyDigest =
        deriveProviderEd25519PublicKeyDigestInternalV1(record.publicKeyBytes);
      record.keyId = deriveStoreProviderVerificationKeyIdV1(record);
      entry.verificationKeys.publicKeyRecords[keyIndex] =
        resignVerificationRecord(golden, record, 1);
      sortVerificationRecords(entry.verificationKeys.publicKeyRecords);
      replaceEntry(golden, candidate, 0, PROVIDER_A, resignEntry(golden, entry, 1), 1);
      break;
    }
    case "provider-key-cap-exceeded": {
      const entry = enabledEntry(candidate, 0);
      const usages = [
        "containment_proof",
        "journal_version",
        "migration_semantic_proof",
        "operation_receipt",
        "state_version",
      ];
      for (let index = 0; entry.verificationKeys.publicKeyRecords.length < 257; index += 1) {
        entry.verificationKeys.publicKeyRecords.push(
          syntheticProviderKeyRecord(golden, index, usages[index % usages.length]),
        );
      }
      sortVerificationRecords(entry.verificationKeys.publicKeyRecords);
      replaceEntry(golden, candidate, 0, PROVIDER_A, resignEntry(golden, entry, 1), 1);
      break;
    }
    case "per-usage-key-cap-exceeded": {
      const entry = enabledEntry(candidate, 0);
      let index = 1000;
      while (
        entry.verificationKeys.publicKeyRecords.filter(
          (record) => record.usage === "operation_receipt",
        ).length < 65
      ) {
        entry.verificationKeys.publicKeyRecords.push(
          syntheticProviderKeyRecord(golden, index, "operation_receipt"),
        );
        index += 1;
      }
      sortVerificationRecords(entry.verificationKeys.publicKeyRecords);
      replaceEntry(golden, candidate, 0, PROVIDER_A, resignEntry(golden, entry, 1), 1);
      break;
    }
    case "manifest-signature-bitflip":
      manifest(candidate, 0).manifestSignature = flipLastBit(
        manifest(candidate, 0).manifestSignature,
      );
      break;
    case "manifest-signature-wrong-signer": {
      const payload = manifest(candidate, 2);
      const claims = unsignedClaims(payload, "manifestSignature");
      payload.manifestSignature = rootWire(
        golden,
        MANIFEST_PREFIX,
        2,
        createProviderRegistryManifestSignatureMessageV1(
          claims,
          rootKeyId(golden, 2),
        ),
      );
      break;
    }
    case "manifest-signature-wrong-domain": {
      const payload = manifest(candidate, 0);
      const alternate = wrongDomainWire(
        golden,
        MANIFEST_PREFIX,
        1,
        "provider-registry-manifest-wrong-signature-v1",
        unsignedClaims(payload, "manifestSignature"),
      );
      payload.manifestSignature = alternate.wire;
      wrongDomainProofs.push(alternate.proof);
      break;
    }
    case "manifest-signature-wrong-prefix":
      manifest(candidate, 0).manifestSignature =
        manifest(candidate, 0).manifestSignature.replace(
          MANIFEST_PREFIX,
          REGISTRY_PREFIX,
        );
      break;
    case "runtime-signature-bitflip":
      setNestedSignatureCase(golden, candidate, "runtime", "bitflip", wrongDomainProofs);
      break;
    case "runtime-signature-wrong-signer":
      setNestedSignatureCase(
        golden,
        candidate,
        "runtime-wrong-signer",
        "wrong-signer",
        wrongDomainProofs,
      );
      break;
    case "runtime-signature-wrong-domain":
      setNestedSignatureCase(golden, candidate, "runtime", "wrong-domain", wrongDomainProofs);
      break;
    case "key-signature-bitflip":
      setNestedSignatureCase(golden, candidate, "key", "bitflip", wrongDomainProofs);
      break;
    case "key-signature-wrong-domain":
      setNestedSignatureCase(golden, candidate, "key", "wrong-domain", wrongDomainProofs);
      break;
    case "entry-signature-bitflip":
      setNestedSignatureCase(golden, candidate, "entry", "bitflip", wrongDomainProofs);
      break;
    case "entry-signature-wrong-domain":
      setNestedSignatureCase(golden, candidate, "entry", "wrong-domain", wrongDomainProofs);
      break;
    case "public-key-small-order": {
      const entry = enabledEntry(candidate, 0);
      const keyIndex = entry.verificationKeys.publicKeyRecords.findIndex(
        (record) => record.usage === "migration_semantic_proof",
      );
      const record = entry.verificationKeys.publicKeyRecords[keyIndex];
      const identity = Buffer.alloc(32);
      identity[0] = 1;
      record.publicKeyBytes = `base64url:${identity.toString("base64url")}`;
      record.publicKeyDigest =
        deriveProviderEd25519PublicKeyDigestInternalV1(record.publicKeyBytes);
      record.keyId = deriveStoreProviderVerificationKeyIdV1(record);
      record.registrySignature =
        `${REGISTRY_PREFIX}:${rootKeyId(golden, 1)}:${"0".repeat(128)}`;
      sortVerificationRecords(entry.verificationKeys.publicKeyRecords);
      replaceEntry(golden, candidate, 0, PROVIDER_A, resignEntry(golden, entry, 1), 1);
      break;
    }
    case "steady-two-enabled-bypass":
      manifest(candidate, 2).routing = { state: "steady" };
      resealManifestAt(golden, candidate, 2, 3);
      break;
    case "migration-missing-member":
      manifest(candidate, 2).members.splice(1, 1);
      resealManifestAt(golden, candidate, 2, 3);
      break;
    case "migration-source-equals-destination":
      manifest(candidate, 2).routing.sourceProviderId = PROVIDER_B;
      resealManifestAt(golden, candidate, 2, 3);
      break;
    case "migration-active-outsider":
      manifest(candidate, 2).routing.activeForMigrationWrites = PROVIDER_C;
      resealManifestAt(golden, candidate, 2, 3);
      break;
    case "migration-phase-skip":
      manifest(candidate, 3).routing.phase = "source_drained";
      resealManifestAt(golden, candidate, 3, 3);
      break;
    case "migration-id-switch":
      manifest(candidate, 3).routing.migrationId = `provider-migration:${zeroKeyId}`;
      resealManifestAt(golden, candidate, 3, 3);
      break;
    case "tombstone-generation-wrong":
      manifest(candidate, 5).members[0].revokedAtManifestGeneration = 5;
      resealManifestAt(golden, candidate, 5, 3);
      break;
    case "tombstone-digest-wrong":
      manifest(candidate, 5).members[0].lastEnabledRegistryEntryContentDigest = ffDigest;
      resealManifestAt(golden, candidate, 5, 3);
      break;
    case "tombstone-mutated-after-retention":
      manifest(candidate, 6).members[0].reason = "provider_compromised";
      resealManifestAt(golden, candidate, 6, 3);
      break;
    case "provider-resurrection": {
      const enabledA = cloneJson(golden.registryManifestHistory[4].payload.members[0]);
      const payload = manifest(candidate, 6);
      payload.members[0] = enabledA;
      payload.routing = {
        state: "migration",
        migrationId: `provider-migration:${zeroKeyId}`,
        sourceProviderId: PROVIDER_B,
        destinationProviderId: PROVIDER_A,
        activeForMigrationWrites: PROVIDER_B,
        phase: "prepared",
      };
      resealManifestAt(golden, candidate, 6, 3);
      break;
    }
    case "early-steady-before-drained": {
      const payload = manifest(candidate, 4);
      const source = payload.members[0];
      payload.members[0] = {
        providerId: source.providerId,
        disposition: "revoked",
        lastEnabledRegistryEntryContentDigest: source.registryEntryContentDigest,
        revokedAtManifestGeneration: 5,
        reason: "migration_completed",
      };
      payload.routing = { state: "steady" };
      manifests[4] = resignManifest(golden, payload, 3);
      break;
    }
    case "locator-alias-extra-field":
      manifests[0].locator = "latest";
      break;
    case "locator-path-extra-field":
      manifests[0].path = "provider/registry-manifests/latest.json";
      break;
    case "locator-filename-key-extra-field":
      manifests[0].filenameKey = "idh-00";
      break;
    case "history-count-cap-4097":
      candidate.registryManifestHistory = new Array(4097).fill(
        cloneJson(golden.registryManifestHistory[0]),
      );
      break;
    case "single-envelope-byte-cap":
      manifest(candidate, 0).issuedAt = "a".repeat(4_194_305);
      break;
    case "total-history-byte-cap": {
      const largeEnvelope = cloneJson(golden.registryManifestHistory[0]);
      largeEnvelope.payload.issuedAt = "a".repeat(4_000_000);
      candidate.registryManifestHistory = new Array(68).fill(largeEnvelope);
      break;
    }
    case "approval-snapshot-diverges": {
      const entry = enabledEntry(candidate, 2, PROVIDER_B);
      const active = entry.feasibilityApprovalKeys.activeKeyIds;
      entry.feasibilityApprovalKeys.activeKeyIds = {
        qa: active.release,
        release: active.qa,
      };
      replaceEntry(golden, candidate, 2, PROVIDER_B, resignEntry(golden, entry, 3), 3);
      break;
    }
    case "binding-active-missing": {
      const entry = enabledEntry(candidate, 0);
      entry.verificationKeys.activeBindingDerivationKeyGeneration = 2;
      replaceEntry(golden, candidate, 0, PROVIDER_A, resignEntry(golden, entry, 1), 1);
      break;
    }
    case "binding-revocation-unknown": {
      const entry = enabledEntry(candidate, 1);
      entry.verificationKeys.compromisedRevokedBindingDerivationGenerations = [2];
      replaceEntry(golden, candidate, 1, PROVIDER_A, resignEntry(golden, entry, 2), 2);
      break;
    }
    case "approver-active-role-mismatch": {
      const entry = enabledEntry(candidate, 0);
      const active = entry.feasibilityApprovalKeys.activeKeyIds;
      entry.feasibilityApprovalKeys.activeKeyIds = {
        qa: active.release,
        release: active.qa,
      };
      replaceEntry(golden, candidate, 0, PROVIDER_A, resignEntry(golden, entry, 1), 1);
      break;
    }
    case "approver-revocation-unknown": {
      const entry = enabledEntry(candidate, 0);
      entry.feasibilityApprovalKeys.compromisedRevokedKeyIds = [zeroKeyId];
      replaceEntry(golden, candidate, 0, PROVIDER_A, resignEntry(golden, entry, 1), 1);
      break;
    }
    case "binding-record-duplicate": {
      const records = manifest(candidate, 0).members[0].registryEntry.verificationKeys
        .bindingDerivationGenerationRecords;
      records.push(cloneJson(records[0]));
      break;
    }
    case "approver-record-order-reversed":
      manifest(candidate, 0).members[0].registryEntry.feasibilityApprovalKeys
        .publicKeyRecords.reverse();
      break;
    default:
      throw new TypeError(`unsupported manifest invalid mutation: ${caseId}`);
  }
}

export function materializeProviderRegistryManifestInvalidCandidateV1(
  golden,
  invalidCase,
  strictCryptoCapability,
) {
  assertProviderRegistryManifestInvalidRecipeV1(invalidCase);
  const candidate = {
    installationIdentityGenerationId:
      golden.installationIdentityGenerationId,
    bootstrapTrustBundle: cloneJson(golden.bootstrapTrustBundle),
    rootMetadataHistory: cloneJson(golden.rootMetadataHistory),
    registryManifestHistory: cloneJson(
      golden.registryManifestHistory.slice(0, prefixLength(invalidCase)),
    ),
    strictCryptoCapability,
  };
  const wrongDomainProofs = [];
  applyCase(golden, candidate, invalidCase, wrongDomainProofs);
  return Object.freeze({
    request: candidate,
    wrongDomainProofs: Object.freeze(wrongDomainProofs),
  });
}
