import { createHash } from "node:crypto";

import {
  canonicalizeJcsSafeIntegerV1,
  canonicalizeJcsSafeIntegerUtf8V1,
} from "../../dist/jcs.js";
import {
  PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_RESOURCE_PATH_V1,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_RESOURCE_SHA256_HEX_V1,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_SEMANTIC_CONTENT_DIGEST_V1,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_SEMANTIC_DOMAIN_V1,
} from "../../dist/provider-registry-manifest-fixtures.js";
import {
  materializeProviderRegistryManifestInvalidCandidateV1,
} from "./provider-registry-manifest-invalid-runner.mjs";
import {
  requestFromCompatibleBase,
} from "./provider-registry-evidence-binding-point-fixture.mjs";

export const PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_REGISTRY_ADAPTER_MATERIALIZED_REQUEST_DOMAIN_V1 =
  "provider-registry-evidence-binding-point-registry-adapter-materialized-request-v1";
export const PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_REGISTRY_ADAPTER_TABLE_DOMAIN_V1 =
  "provider-registry-evidence-binding-point-registry-adapter-table-v1";
export const PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_REGISTRY_ADAPTER_TABLE_SEMANTIC_CONTENT_DIGEST_V1 =
  "sha256:d7f380a7833086f8e654f8dc543bddcfc52247cc98af789ef26b2aa36db899ce";

const SOURCE_RESOURCE_ANCHOR_V1 = Object.freeze({
  resourcePath:
    PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_RESOURCE_PATH_V1,
  resourceByteLength:
    PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_RESOURCE_BYTE_LENGTH_V1,
  resourceSha256Hex:
    PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_RESOURCE_SHA256_HEX_V1,
  semanticDomain:
    PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_SEMANTIC_DOMAIN_V1,
  semanticContentDigest:
    PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_SEMANTIC_CONTENT_DIGEST_V1,
});

function compareUtf16V1(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function updateCanonicalJcsHashV1(hash, value, active) {
  if (value === null || typeof value !== "object") {
    hash.update(canonicalizeJcsSafeIntegerV1(value), "utf8");
    return;
  }

  const isArray = Array.isArray(value);
  const prototype = Reflect.getPrototypeOf(value);
  if (
    (isArray && prototype !== Array.prototype) ||
    (!isArray && prototype !== Object.prototype && prototype !== null)
  ) {
    throw new TypeError("streamed JCS value has a non-data prototype");
  }
  if (active.has(value)) {
    throw new TypeError("streamed JCS value contains a cycle");
  }

  active.add(value);
  try {
    if (Object.getOwnPropertySymbols(value).length !== 0) {
      throw new TypeError("streamed JCS value has a symbol key");
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (isArray) {
      const ownKeys = Reflect.ownKeys(value);
      const expectedKeys = new Set(["length"]);
      for (let index = 0; index < value.length; index += 1) {
        const key = String(index);
        expectedKeys.add(key);
        if (!Object.hasOwn(value, key)) {
          throw new TypeError("streamed JCS value has a sparse array slot");
        }
      }
      if (
        ownKeys.some(
          (key) => typeof key !== "string" || !expectedKeys.has(key),
        )
      ) {
        throw new TypeError("streamed JCS value has an extra array property");
      }

      hash.update("[", "utf8");
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = descriptors[String(index)];
        if (
          descriptor === undefined ||
          !("value" in descriptor) ||
          descriptor.enumerable !== true
        ) {
          throw new TypeError(
            "streamed JCS array requires enumerable data properties",
          );
        }
        if (index !== 0) hash.update(",", "utf8");
        updateCanonicalJcsHashV1(hash, descriptor.value, active);
      }
      hash.update("]", "utf8");
      return;
    }

    const keys = Object.keys(descriptors).sort(compareUtf16V1);
    hash.update("{", "utf8");
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index];
      const descriptor = descriptors[key];
      if (
        descriptor === undefined ||
        !("value" in descriptor) ||
        descriptor.enumerable !== true
      ) {
        throw new TypeError(
          "streamed JCS object requires enumerable data properties",
        );
      }
      if (index !== 0) hash.update(",", "utf8");
      hash.update(canonicalizeJcsSafeIntegerV1(key), "utf8");
      hash.update(":", "utf8");
      updateCanonicalJcsHashV1(hash, descriptor.value, active);
    }
    hash.update("}", "utf8");
  } finally {
    active.delete(value);
  }
}

function streamedSemanticDigestV1(domain, value) {
  const hash = createHash("sha256");
  updateCanonicalJcsHashV1(hash, [domain, value], new Set());
  return `sha256:${hash.digest("hex")}`;
}

function semanticDigestV1(domain, value) {
  return `sha256:${createHash("sha256")
    .update(canonicalizeJcsSafeIntegerUtf8V1([domain, value]))
    .digest("hex")}`;
}

function defineRegistryAdapterRowV1(
  sourceIndex,
  sourceCaseId,
  sourceOperation,
  recipeKind,
  sourceStage,
  sourceReason,
  sourcePointAdmissionCount,
  sourceSignatureVerificationCount,
  sourceMaterializedRequestSemanticDigest,
  outerStage,
  outerReason,
  outerPointAdmissionCount,
  outerSignatureVerificationCount,
) {
  const caseId = `registry-${sourceCaseId}`;
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
          PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_RESOURCE_PATH_V1,
        sourceIndex,
        sourceCaseId,
        sourceOperation,
      }),
    }),
    outerExpectedWithoutMaterializedDigest: Object.freeze({
      kind: "diagnostic",
      stage: outerStage,
      reason: outerReason,
      pointAdmissionCount: outerPointAdmissionCount,
      signatureVerificationCount: outerSignatureVerificationCount,
    }),
  });
}

/*
 * D-37 requires an explicit positional adapter for every Registry source
 * operation.  Do not replace this table with a catch-all history rule: several
 * source recipes are intentionally intercepted by the L raw boundary.
 */
export const PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_REGISTRY_ADAPTER_DEFINITIONS_V1 =
  Object.freeze([
  defineRegistryAdapterRowV1(0, "history-empty", "history-empty", "registry_manifest_history", "history_input", "history_empty", 0, 0, "sha256:78d190af677055f6d05c7d5696c63c985fe875272bc12b935e1fc66153106fd2", "registry_history_closure", "source_invalid", 0, 0),
  defineRegistryAdapterRowV1(1, "input-extra-field", "input-extra-field", "outer_extra_field", "history_input", "schema_invalid", 0, 0, "sha256:32825f829110f621ff835b13bf53e88778320f28317ed981c9aa75ab92a535de", "input", "schema_invalid", 0, 0),
  defineRegistryAdapterRowV1(2, "input-missing-installation-id", "input-missing-installation-id", "outer_missing_installation_identity", "history_input", "schema_invalid", 0, 0, "sha256:e8778060381c30b4a890c6d3204145a97dc5097482d7747b5920a4fee18b6af6", "input", "schema_invalid", 0, 0),
  defineRegistryAdapterRowV1(3, "input-bad-installation-id", "input-bad-installation-id", "outer_installation_identity", "history_input", "schema_invalid", 0, 0, "sha256:6899257c01c1a7493f3abc98ad15b0aa0752ae46fdf41ad7f4a8f08192adee49", "registry_history_closure", "source_invalid", 0, 0),
  defineRegistryAdapterRowV1(4, "history-not-array", "history-not-array", "registry_manifest_history", "history_input", "schema_invalid", 0, 0, "sha256:7a029018875139b616ce599dae7dbfb17a4f4f93ce792153269ff3026a612fbc", "input", "schema_invalid", 0, 0),
  defineRegistryAdapterRowV1(5, "history-sparse-array", "history-sparse-array", "registry_manifest_history", "history_input", "schema_invalid", 0, 0, "sha256:cf3c0e96d0b8bd1113d3cef6035fecb541c2039e13927bfac7040b87c2cd6326", "input", "schema_invalid", 0, 0),
  defineRegistryAdapterRowV1(6, "envelope-null", "envelope-null", "registry_manifest_history", "manifest_envelope", "schema_invalid", 11, 9, "sha256:f1bd079666e032a9b0245301d5b8b075499e0005d8b24c1756aae478439e68f6", "input", "schema_invalid", 0, 0),
  defineRegistryAdapterRowV1(7, "envelope-extra-field", "envelope-extra-field", "registry_manifest_history", "manifest_envelope", "schema_invalid", 11, 9, "sha256:a40e6840c07e293fba58e76404ece632d5dab423f2b2e40d2e4d9b4ca203e815", "registry_history_closure", "source_invalid", 11, 9),
  defineRegistryAdapterRowV1(8, "envelope-record-type-malformed", "envelope-record-type-malformed", "registry_manifest_history", "manifest_envelope", "schema_invalid", 11, 9, "sha256:aed0c1545958404c9e8998e194e3c1be829da98fc1c859996a310ef9e62800e5", "registry_history_closure", "source_invalid", 11, 9),
  defineRegistryAdapterRowV1(9, "envelope-generation-id-malformed", "envelope-generation-id-malformed", "registry_manifest_history", "manifest_envelope", "schema_invalid", 11, 9, "sha256:52186615819f83b6c7b47c233c293454f1b26ed1b4ab661ece49fa3b544a8f1e", "registry_history_closure", "source_invalid", 11, 9),
  defineRegistryAdapterRowV1(10, "manifest-extra-field", "manifest-extra-field", "registry_manifest_history", "manifest_envelope", "schema_invalid", 11, 9, "sha256:cf3f570f9aaccd454b2ffed7a6134a9f5566bb99e49f70f14df69246cdd16121", "registry_history_closure", "source_invalid", 11, 9),
  defineRegistryAdapterRowV1(11, "manifest-profile-malformed", "manifest-profile-malformed", "registry_manifest_history", "manifest_envelope", "schema_invalid", 11, 9, "sha256:6f4c4420620e2c73eb6f429f972c440267c0e13c180b1f4671478868dc5d4814", "registry_history_closure", "source_invalid", 11, 9),
  defineRegistryAdapterRowV1(12, "genesis-predecessor-branch-malformed", "genesis-predecessor-branch-malformed", "registry_manifest_history", "manifest_envelope", "schema_invalid", 11, 9, "sha256:8ceee763dfd0586f7e38593166323560b71530d154a369dbb08f4b1110582a80", "registry_history_closure", "source_invalid", 11, 9),
  defineRegistryAdapterRowV1(13, "successor-predecessor-branch-malformed", "successor-predecessor-branch-malformed", "registry_manifest_history", "manifest_envelope", "schema_invalid", 18, 20, "sha256:b5efabbd196d7bde40185bc64cd70e26872b70746912a550dad058bd516ad869", "registry_history_closure", "source_invalid", 18, 20),
  defineRegistryAdapterRowV1(14, "entry-extra-field", "entry-extra-field", "registry_manifest_history", "manifest_envelope", "schema_invalid", 11, 9, "sha256:ed95e4cbca05c0c72f0bf5037f17df868560027560faba9240628521d57c457d", "registry_history_closure", "source_invalid", 11, 9),
  defineRegistryAdapterRowV1(15, "entry-genesis-predecessor-branch-malformed", "entry-genesis-predecessor-branch-malformed", "registry_manifest_history", "manifest_envelope", "schema_invalid", 11, 9, "sha256:9cba572bd479e8bdd0bb80ffe1a952779af25b2c43dcd13668fc21b08c0b62af", "registry_history_closure", "source_invalid", 11, 9),
  defineRegistryAdapterRowV1(16, "entry-successor-predecessor-branch-malformed", "entry-successor-predecessor-branch-malformed", "registry_manifest_history", "manifest_envelope", "schema_invalid", 18, 20, "sha256:14916d458daff79b8fe46c1377e5762dba84345dc4fba5802ef863cf3c09712e", "registry_history_closure", "source_invalid", 18, 20),
  defineRegistryAdapterRowV1(17, "verification-key-extra-field", "verification-key-extra-field", "registry_manifest_history", "manifest_envelope", "schema_invalid", 11, 9, "sha256:a0446af59b4eff1a0e42ca6a22e85a3c7227ae6bf45fa8655f2e227e73d6ae85", "registry_history_closure", "source_invalid", 11, 9),
  defineRegistryAdapterRowV1(18, "manifest-signature-malformed", "manifest-signature-malformed", "registry_manifest_history", "manifest_envelope", "schema_invalid", 11, 9, "sha256:489e72e0fb9e980bd95842095ff855c8b9f23701aba599fcff4039861203394b", "registry_history_closure", "source_invalid", 11, 9),
  defineRegistryAdapterRowV1(19, "envelope-generation-id-mismatch", "envelope-generation-id-mismatch", "registry_manifest_history", "manifest_envelope", "envelope_mismatch", 11, 9, "sha256:52a71a4ff6a03c634ce782bd21ce03b493efe29a9ed4bb7d234fdfd9f0dbb931", "registry_history_closure", "source_invalid", 11, 9),
  defineRegistryAdapterRowV1(20, "payload-generation-id-mismatch", "payload-generation-id-mismatch", "registry_manifest_history", "manifest_envelope", "envelope_mismatch", 11, 9, "sha256:4c5b71c2899d11c32c3c09ee75605b01035605d563e20cb7513eba634b956f2c", "registry_history_closure", "source_invalid", 11, 9),
  defineRegistryAdapterRowV1(21, "envelope-content-digest-mismatch", "envelope-content-digest-mismatch", "registry_manifest_history", "manifest_envelope", "envelope_mismatch", 11, 9, "sha256:d64d5e99a743c75c68a442510c503a735cb09ddc2e5fdae02a4224e5bc8fbf35", "registry_history_closure", "source_invalid", 11, 9),
  defineRegistryAdapterRowV1(22, "manifest-installation-id-mismatch", "manifest-installation-id-mismatch", "registry_manifest_history", "manifest_envelope", "envelope_mismatch", 11, 9, "sha256:1a7a7344dfd3eaf990fa6a9d5b0368d079c043938d70f4b09809d7e597f55115", "registry_history_closure", "source_invalid", 11, 9),
  defineRegistryAdapterRowV1(23, "manifest-generation-starts-at-two", "manifest-generation-starts-at-two", "registry_manifest_history", "manifest_predecessor", "generation_not_contiguous", 11, 9, "sha256:e4c610c9ff4ca2f265095fa1de22176cf422a662b40c873d6d46467e2994a45a", "registry_history_closure", "source_invalid", 11, 9),
  defineRegistryAdapterRowV1(24, "manifest-generation-gap", "manifest-generation-gap", "registry_manifest_history", "manifest_predecessor", "generation_not_contiguous", 18, 20, "sha256:7789fa4f7af76ac4adadfe720e63cb2b405aaeafcb803369af23f714f534fe6c", "registry_history_closure", "source_invalid", 18, 20),
  defineRegistryAdapterRowV1(25, "predecessor-generation-id-mismatch", "predecessor-generation-id-mismatch", "registry_manifest_history", "manifest_predecessor", "predecessor_pin_mismatch", 18, 20, "sha256:e55a42757aab0f0327bd7bfb16a4ebba1e856542680fe4620cbbed76d963289f", "registry_history_closure", "source_invalid", 18, 20),
  defineRegistryAdapterRowV1(26, "predecessor-content-digest-mismatch", "predecessor-content-digest-mismatch", "registry_manifest_history", "manifest_predecessor", "predecessor_pin_mismatch", 18, 20, "sha256:00a52c975c1f4354f7df53076e3ab842a2ca6af978bd037b768a66b2e4c9692f", "registry_history_closure", "source_invalid", 18, 20),
  defineRegistryAdapterRowV1(27, "manifest-sibling-generation", "manifest-sibling-generation", "registry_manifest_history", "manifest_predecessor", "generation_not_contiguous", 19, 24, "sha256:88b5958e3b1f1212648bc2ba9552e68b8bd0701ccf82ad9151ab61b12b310ab4", "registry_history_closure", "source_invalid", 19, 24),
  defineRegistryAdapterRowV1(28, "root-generation-rollback", "root-generation-rollback", "registry_manifest_history", "root_binding", "root_generation_rollback", 19, 24, "sha256:e37a1bb1e08e5e545162601c1dd46d1f5a59c445bce2093283d52b60b9286731", "registry_history_closure", "source_invalid", 19, 24),
  defineRegistryAdapterRowV1(29, "unknown-root-pin", "unknown-root-pin", "registry_manifest_history", "root_binding", "root_pin_mismatch", 11, 9, "sha256:a0d11bb555c290ba113b035a669c4686840815a71383039b76141529ab2bfb1d", "registry_history_closure", "source_invalid", 11, 9),
  defineRegistryAdapterRowV1(30, "member-order-reversed", "member-order-reversed", "registry_manifest_history", "manifest_envelope", "schema_invalid", 19, 24, "sha256:00dbb2e9f2af9de5d65013398ffc492d5c23011cdfff7916c9ded0f7b8b2e7df", "registry_history_closure", "source_invalid", 19, 24),
  defineRegistryAdapterRowV1(31, "member-duplicate", "member-duplicate", "registry_manifest_history", "manifest_envelope", "schema_invalid", 19, 24, "sha256:e9bc1880f785b968a9dba632658d911794a3b453ca82a65c675d46b04514a5a4", "registry_history_closure", "source_invalid", 19, 24),
  defineRegistryAdapterRowV1(32, "tombstone-disappears", "tombstone-disappears", "registry_manifest_history", "member_set", "member_transition_invalid", 24, 38, "sha256:d22769e32e4475e9aab99ddc9b35d3da7d29ea9224face619c1db30365cf7575", "registry_history_closure", "source_invalid", 24, 38),
  defineRegistryAdapterRowV1(33, "enabled-entry-digest-mismatch", "enabled-entry-digest-mismatch", "registry_manifest_history", "registry_entry", "entry_mismatch", 11, 10, "sha256:37d0ae0849643910f1a91bfe3ea0eae5316a7f984f09c99507d4f11fe3711350", "registry_history_closure", "source_invalid", 11, 10),
  defineRegistryAdapterRowV1(34, "member-entry-provider-mismatch", "member-entry-provider-mismatch", "registry_manifest_history", "registry_entry", "entry_mismatch", 11, 10, "sha256:581d6c1ddf5dd9c1ef804950a4926ff4039b93b1366e8d2924a7feae27aa142b", "registry_history_closure", "source_invalid", 11, 10),
  defineRegistryAdapterRowV1(35, "entry-generation-jump", "entry-generation-jump", "registry_manifest_history", "registry_entry", "entry_successor_invalid", 18, 21, "sha256:a1faac35e11407a603a69be0c2f4ae233f03c74e0fbf7f35c763f1aedc9aa0a3", "registry_history_closure", "source_invalid", 18, 21),
  defineRegistryAdapterRowV1(36, "entry-predecessor-digest-mismatch", "entry-predecessor-digest-mismatch", "registry_manifest_history", "registry_entry", "entry_successor_invalid", 18, 21, "sha256:cf5f58e8c0f4ba3bbc2bf58a01ab913651b976f31c3711a99de8dbe8917e303b", "registry_history_closure", "source_invalid", 18, 21),
  defineRegistryAdapterRowV1(37, "same-entry-digest-different-bytes", "same-entry-digest-different-bytes", "registry_manifest_history", "registry_entry", "entry_successor_invalid", 18, 21, "sha256:edaea46a39f0d1eada4390bf4828d8e86428e9e240438c3b2fac3fb662619dd3", "registry_history_closure", "source_invalid", 18, 21),
  defineRegistryAdapterRowV1(38, "runtime-pin-digest-mismatch", "runtime-pin-digest-mismatch", "registry_manifest_history", "registry_entry", "entry_mismatch", 11, 10, "sha256:8f8928eba9b46841d712edeb3e129ad7f906270968b328f3c8bc259f226b0532", "registry_history_closure", "source_invalid", 11, 10),
  defineRegistryAdapterRowV1(39, "runtime-provider-mismatch", "runtime-provider-mismatch", "registry_manifest_history", "registry_entry", "entry_mismatch", 11, 10, "sha256:c6e7ee09c6e72794b719a8f8eb60f004efa7afe1b43f23cca4a82e8f2870b3af", "registry_history_closure", "source_invalid", 11, 10),
  defineRegistryAdapterRowV1(40, "provider-key-id-mismatch", "provider-key-id-mismatch", "registry_manifest_history", "key_history", "record_history_invalid", 11, 11, "sha256:de10d634015721aef06a0f259103705286373dcff94d0d73519e6c9ceadd7103", "registry_history_closure", "source_invalid", 11, 11),
  defineRegistryAdapterRowV1(41, "provider-key-raw-digest-mismatch", "provider-key-raw-digest-mismatch", "registry_manifest_history", "key_history", "record_history_invalid", 11, 11, "sha256:03728ed54b6dd9b3d7613e381fc616a7b30c1afdd1ced9e501d4495556b3a103", "registry_history_closure", "source_invalid", 11, 11),
  defineRegistryAdapterRowV1(42, "provider-key-order-reversed", "provider-key-order-reversed", "registry_manifest_history", "manifest_envelope", "schema_invalid", 11, 9, "sha256:9dfc8d7b45285f70da058740349a9c1f125745da33aaa26a954eb32e033d1289", "registry_history_closure", "source_invalid", 11, 9),
  defineRegistryAdapterRowV1(43, "active-key-missing", "active-key-missing", "registry_manifest_history", "key_history", "active_record_invalid", 11, 10, "sha256:7e7133c9dd2c8085c71f2c82233e00a5eedbc0de823ef26455e2092a208cb44f", "registry_history_closure", "source_invalid", 11, 10),
  defineRegistryAdapterRowV1(44, "active-key-wrong-usage", "active-key-wrong-usage", "registry_manifest_history", "key_history", "active_record_invalid", 11, 10, "sha256:edac0e115c29523cc203af7d2ccff2c8a30ee1a302f3f1b1ca8de67247cb0170", "registry_history_closure", "source_invalid", 11, 10),
  defineRegistryAdapterRowV1(45, "active-key-revoked", "active-key-revoked", "registry_manifest_history", "key_history", "active_record_invalid", 18, 21, "sha256:fa5462a77d9ed62e0c6a808ed23e9816734173fc309d4da0299984f04814661d", "registry_history_closure", "source_invalid", 18, 21),
  defineRegistryAdapterRowV1(46, "revoked-key-unknown", "revoked-key-unknown", "registry_manifest_history", "key_history", "revocation_invalid", 18, 21, "sha256:eb8cee28bbd4530da317d4a9ba314c68e5965a664f3f940e19b1a20d3c5ab520", "registry_history_closure", "source_invalid", 18, 21),
  defineRegistryAdapterRowV1(47, "rotated-key-backdated", "rotated-key-backdated", "registry_manifest_history", "key_history", "record_history_invalid", 18, 22, "sha256:4e25af590e83c8c208ce0e4d1bacc9c8c2c08dc8be60a411e9e2e0cb60fbb0bb", "registry_history_closure", "source_invalid", 18, 22),
  defineRegistryAdapterRowV1(48, "key-history-removal", "key-history-removal", "registry_manifest_history", "key_history", "record_history_invalid", 18, 21, "sha256:27873110d5ff0da57a91f3d72eb03bb7b847fea882e7088fe1d17765466a70c5", "registry_history_closure", "source_invalid", 18, 21),
  defineRegistryAdapterRowV1(49, "retained-key-bytes-changed", "retained-key-bytes-changed", "registry_manifest_history", "key_history", "record_history_invalid", 18, 21, "sha256:a61fdb4443e2cc568feb574b79420e2a7d71ffa216890607997f290694e45585", "registry_history_closure", "source_invalid", 18, 21),
  defineRegistryAdapterRowV1(50, "public-key-material-alias-root", "public-key-material-alias-root", "registry_manifest_history", "material_closure", "public_key_material_alias", 13, 13, "sha256:5cb2a4e5a61cdc262b38da26e969a9f392eb9eb1d4e29251d58df3a1e2240473", "registry_history_closure", "source_invalid", 13, 13),
  defineRegistryAdapterRowV1(51, "provider-key-cap-exceeded", "provider-key-cap-exceeded", "registry_manifest_history", "key_history", "record_history_invalid", 11, 10, "sha256:d7a5533223a8ccdc9cfcb9736a782368ab5e3438cc4f2ef80e4c0d88b0a749d5", "registry_history_closure", "source_invalid", 11, 10),
  defineRegistryAdapterRowV1(52, "per-usage-key-cap-exceeded", "per-usage-key-cap-exceeded", "registry_manifest_history", "key_history", "record_history_invalid", 11, 10, "sha256:2af17da21127b2c6d1bc440e78fb73b03f2d83b066754ed2aa87b85a465d78a2", "registry_history_closure", "source_invalid", 11, 10),
  defineRegistryAdapterRowV1(53, "manifest-signature-bitflip", "manifest-signature-bitflip", "registry_manifest_history", "manifest_signature", "signature_invalid", 11, 10, "sha256:20147146afa8146ef6dc2bfb601fe5728c6301707b0d14a40a954e41b6696ab1", "registry_history_closure", "source_invalid", 11, 10),
  defineRegistryAdapterRowV1(54, "manifest-signature-wrong-signer", "manifest-signature-wrong-signer", "registry_manifest_history", "manifest_signature", "signature_invalid", 19, 24, "sha256:571dff8e78ade4bad16bb03d983797966f46b1b7103f8e0cf9bb11e8954ac02f", "registry_history_closure", "source_invalid", 19, 24),
  defineRegistryAdapterRowV1(55, "manifest-signature-wrong-domain", "manifest-signature-wrong-domain", "registry_manifest_history", "manifest_signature", "signature_invalid", 11, 10, "sha256:14b7eb2d760e1d93ef7e3fe909c78a647b5fe326edd3c5cc6c54edbbfcf7bde1", "registry_history_closure", "source_invalid", 11, 10),
  defineRegistryAdapterRowV1(56, "manifest-signature-wrong-prefix", "manifest-signature-wrong-prefix", "registry_manifest_history", "manifest_envelope", "schema_invalid", 11, 9, "sha256:e7aa5c026241d800aef9d05bb56118c82bc028812bf65e493471ea892d757480", "registry_history_closure", "source_invalid", 11, 9),
  defineRegistryAdapterRowV1(57, "runtime-signature-bitflip", "runtime-signature-bitflip", "registry_manifest_history", "record_signature", "signature_invalid", 11, 11, "sha256:d1f098486315c14a2dbb8212ed9ee1bf72eddf63e5e74334585bdca9186a0140", "registry_history_closure", "source_invalid", 11, 11),
  defineRegistryAdapterRowV1(58, "runtime-signature-wrong-signer", "runtime-signature-wrong-signer", "registry_manifest_history", "record_signature", "signature_invalid", 18, 21, "sha256:a1cddb264dc37e37faf885217aa154c3ac975a2e66f0298e65b2dd103c702cac", "registry_history_closure", "source_invalid", 18, 21),
  defineRegistryAdapterRowV1(59, "runtime-signature-wrong-domain", "runtime-signature-wrong-domain", "registry_manifest_history", "record_signature", "signature_invalid", 11, 11, "sha256:12755667ca6a8bd112b8a2e94924bbf18e157ab6c90c899cf28531198252cea6", "registry_history_closure", "source_invalid", 11, 11),
  defineRegistryAdapterRowV1(60, "key-signature-bitflip", "key-signature-bitflip", "registry_manifest_history", "record_signature", "signature_invalid", 12, 12, "sha256:37431083d14dee981273158b432a5fb601904b92f560f68f3ebc8046c6c73ca7", "registry_history_closure", "source_invalid", 12, 12),
  defineRegistryAdapterRowV1(61, "key-signature-wrong-domain", "key-signature-wrong-domain", "registry_manifest_history", "record_signature", "signature_invalid", 12, 12, "sha256:51b0f7e520618d2a8d8a011c8d20ffb34834ce36cec8ec2da41e90c3f7eed1b7", "registry_history_closure", "source_invalid", 12, 12),
  defineRegistryAdapterRowV1(62, "entry-signature-bitflip", "entry-signature-bitflip", "registry_manifest_history", "record_signature", "signature_invalid", 18, 20, "sha256:7e92c7f3c3a6a3f6fcb7ea361a0e5949eb77141b4bdd96b0c25ae2b8c3e208c1", "registry_history_closure", "source_invalid", 18, 20),
  defineRegistryAdapterRowV1(63, "entry-signature-wrong-domain", "entry-signature-wrong-domain", "registry_manifest_history", "record_signature", "signature_invalid", 18, 20, "sha256:eb3fee31fa9f566d8f8dcbb974c1600ef03e666654854ab6b9a0ee2f9ad49b87", "registry_history_closure", "source_invalid", 18, 20),
  defineRegistryAdapterRowV1(64, "public-key-small-order", "public-key-small-order", "registry_manifest_history", "key_admission", "point_admission_failed", 14, 13, "sha256:204e2e761c6a966bb271890aa89e1d9584a6ab499c7560d6d8c285f5d4f438f7", "registry_history_closure", "source_invalid", 14, 13),
  defineRegistryAdapterRowV1(65, "steady-two-enabled-bypass", "steady-two-enabled-bypass", "registry_manifest_history", "routing", "routing_invalid", 19, 25, "sha256:844125b49fd51bd8c71c71c9f30f85fb87a2a1574e4df1e1c722e6a75e0dd1ca", "registry_history_closure", "source_invalid", 19, 25),
  defineRegistryAdapterRowV1(66, "migration-missing-member", "migration-missing-member", "registry_manifest_history", "routing", "routing_invalid", 19, 25, "sha256:45eb973664349bb6e4f352f6e91e02b53a887edd129ef92aa4142f5910fd0c6a", "registry_history_closure", "source_invalid", 19, 25),
  defineRegistryAdapterRowV1(67, "migration-source-equals-destination", "migration-source-equals-destination", "registry_manifest_history", "routing", "routing_invalid", 19, 25, "sha256:366c1e8afb60e0a694c4c960f15d1238e851af156ae3b92654041839c23b5d8e", "registry_history_closure", "source_invalid", 19, 25),
  defineRegistryAdapterRowV1(68, "migration-active-outsider", "migration-active-outsider", "registry_manifest_history", "routing", "routing_invalid", 19, 25, "sha256:1b7adb81038474a51ccd492df451fcf0c389d6bec5f2040b39a558708afdd4ff", "registry_history_closure", "source_invalid", 19, 25),
  defineRegistryAdapterRowV1(69, "migration-phase-skip", "migration-phase-skip", "registry_manifest_history", "routing", "routing_invalid", 24, 35, "sha256:044260fe64b95862e235c65094cd0607e02820c69dbd52ecfef3a0313b1e8fda", "registry_history_closure", "source_invalid", 24, 35),
  defineRegistryAdapterRowV1(70, "migration-id-switch", "migration-id-switch", "registry_manifest_history", "routing", "routing_invalid", 24, 35, "sha256:05519366ea366c85fbcd7be6f18d87b726694c5c36fbd0ff395125ffca054d0c", "registry_history_closure", "source_invalid", 24, 35),
  defineRegistryAdapterRowV1(71, "tombstone-generation-wrong", "tombstone-generation-wrong", "registry_manifest_history", "member_set", "member_transition_invalid", 24, 37, "sha256:b4a964f302bddc373048507e8fd7b7e372498ce53f8bfb4ea28ad7122ae52a33", "registry_history_closure", "source_invalid", 24, 37),
  defineRegistryAdapterRowV1(72, "tombstone-digest-wrong", "tombstone-digest-wrong", "registry_manifest_history", "member_set", "member_transition_invalid", 24, 37, "sha256:206fed275eefa8a05ee742dbd1e7b7f2810276f42d400918402a06e965e41cd7", "registry_history_closure", "source_invalid", 24, 37),
  defineRegistryAdapterRowV1(73, "tombstone-mutated-after-retention", "tombstone-mutated-after-retention", "registry_manifest_history", "member_set", "member_transition_invalid", 24, 38, "sha256:6648ffe6867deecde15b87a8ba925811655e106201f064bd42a88905425d62ee", "registry_history_closure", "source_invalid", 24, 38),
  defineRegistryAdapterRowV1(74, "provider-resurrection", "provider-resurrection", "registry_manifest_history", "member_set", "member_transition_invalid", 24, 38, "sha256:d448620af6310ab4f688b9d59079d4586e6c82ac300ee91b6f85c288b992588f", "registry_history_closure", "source_invalid", 24, 38),
  defineRegistryAdapterRowV1(75, "early-steady-before-drained", "early-steady-before-drained", "registry_manifest_history", "routing", "routing_invalid", 24, 36, "sha256:2a7874905ce9192aeb8116b292bb477f2b04de694ae5195f0dd2bdb376bc412a", "registry_history_closure", "source_invalid", 24, 36),
  defineRegistryAdapterRowV1(76, "locator-alias-extra-field", "locator-alias-extra-field", "registry_manifest_history", "manifest_envelope", "schema_invalid", 11, 9, "sha256:09785578112d294c988e29135073bfd3102ba0c7f97ef0ada1dd585add5a57ae", "registry_history_closure", "source_invalid", 11, 9),
  defineRegistryAdapterRowV1(77, "locator-path-extra-field", "locator-path-extra-field", "registry_manifest_history", "manifest_envelope", "schema_invalid", 11, 9, "sha256:c318b30400c336723aabd190d7248b15d3e0f677437bea4be2886293eee28b4b", "registry_history_closure", "source_invalid", 11, 9),
  defineRegistryAdapterRowV1(78, "locator-filename-key-extra-field", "locator-filename-key-extra-field", "registry_manifest_history", "manifest_envelope", "schema_invalid", 11, 9, "sha256:b0510895a1e85a4c53ce6a6581022d2dcdf5efc26957043bdc4030046ec214e0", "registry_history_closure", "source_invalid", 11, 9),
  defineRegistryAdapterRowV1(79, "history-count-cap-4097", "history-count-cap-4097", "registry_manifest_history", "history_limit", "history_generation_limit_exceeded", 0, 0, "sha256:142bfbd77a32022ff18b62b3d5741b735eb22295ef931d2183239b251aade744", "input", "schema_invalid", 0, 0),
  defineRegistryAdapterRowV1(80, "single-envelope-byte-cap", "single-envelope-byte-cap", "registry_manifest_history", "history_limit", "envelope_byte_limit_exceeded", 0, 0, "sha256:9a6615a7e9b37ab01beb0025b159ffe9cdd1cd56b0f9f3d3d30ca61fa6bda48a", "input", "schema_invalid", 0, 0),
  defineRegistryAdapterRowV1(81, "total-history-byte-cap", "total-history-byte-cap", "registry_manifest_history", "history_limit", "history_total_byte_limit_exceeded", 0, 0, "sha256:39998eec99eda594372ec18f0025505eb5478d089145908d439295812dbb469a", "input", "schema_invalid", 0, 0),
  defineRegistryAdapterRowV1(82, "approval-snapshot-diverges", "approval-snapshot-diverges", "registry_manifest_history", "key_history", "record_history_invalid", 19, 25, "sha256:f5de95a0990c2db37376886dce287b60cb420187c9962c5ca6ad1bdeefdf7f49", "registry_history_closure", "source_invalid", 19, 25),
  defineRegistryAdapterRowV1(83, "binding-active-missing", "binding-active-missing", "registry_manifest_history", "key_history", "active_record_invalid", 11, 10, "sha256:c4e61d728df543ca96c18bd9240b65d25d3a86fa8e309661af44b60065b1bedd", "registry_history_closure", "source_invalid", 11, 10),
  defineRegistryAdapterRowV1(84, "binding-revocation-unknown", "binding-revocation-unknown", "registry_manifest_history", "key_history", "revocation_invalid", 18, 21, "sha256:2817ea79ab3573f6b04905e2c642dbcd2525a8c0815e47181747e50534d13554", "registry_history_closure", "source_invalid", 18, 21),
  defineRegistryAdapterRowV1(85, "approver-active-role-mismatch", "approver-active-role-mismatch", "registry_manifest_history", "key_history", "active_record_invalid", 11, 10, "sha256:73831ad89854695560477f440b2dda49f1e4b9ab2a612c91675843bf59b637c2", "registry_history_closure", "source_invalid", 11, 10),
  defineRegistryAdapterRowV1(86, "approver-revocation-unknown", "approver-revocation-unknown", "registry_manifest_history", "key_history", "revocation_invalid", 11, 10, "sha256:f29397a056ff87f221fdfb282eace20e1d34b12b13120b7e5dd14077fba5f2b4", "registry_history_closure", "source_invalid", 11, 10),
  defineRegistryAdapterRowV1(87, "binding-record-duplicate", "binding-record-duplicate", "registry_manifest_history", "manifest_envelope", "schema_invalid", 11, 9, "sha256:6e8ac33410baeca5e9a3b29409f635f46a09dec54b9f375163335442ac5ac340", "registry_history_closure", "source_invalid", 11, 9),
  defineRegistryAdapterRowV1(88, "approver-record-order-reversed", "approver-record-order-reversed", "registry_manifest_history", "manifest_envelope", "schema_invalid", 11, 9, "sha256:8276e6f3910dd869f3f1850397660b12ff8ff2338ddef05b04ba382f33d5acde", "registry_history_closure", "source_invalid", 11, 9),
]);

function canonicalEqualV1(left, right) {
  return Buffer.from(canonicalizeJcsSafeIntegerUtf8V1(left)).equals(
    Buffer.from(canonicalizeJcsSafeIntegerUtf8V1(right)),
  );
}

function sourceExpectedProjectionV1(sourceCase) {
  return {
    kind: "diagnostic",
    stage: sourceCase.expected.stage,
    reason: sourceCase.expected.reason,
    pointAdmissionCount:
      sourceCase.expected.postAttestationPointCalls,
    signatureVerificationCount:
      sourceCase.expected.postAttestationSignatureCalls,
    materializedRequestSemanticDigest:
      sourceCase.expected.materializedRequestSemanticDigest,
  };
}

export function verifyProviderRegistryEvidenceBindingRegistryAdapterSourceV1(
  sourceBytes,
) {
  const bytes = Buffer.from(sourceBytes);
  if (
    bytes.byteLength !== SOURCE_RESOURCE_ANCHOR_V1.resourceByteLength ||
    createHash("sha256").update(bytes).digest("hex") !==
      SOURCE_RESOURCE_ANCHOR_V1.resourceSha256Hex
  ) {
    throw new TypeError("Registry adapter source raw anchor drifted");
  }
  const source = JSON.parse(bytes.toString("utf8"));
  if (
    semanticDigestV1(SOURCE_RESOURCE_ANCHOR_V1.semanticDomain, source) !==
      SOURCE_RESOURCE_ANCHOR_V1.semanticContentDigest ||
    source.caseCount !== 89 ||
    !Array.isArray(source.caseIds) ||
    !Array.isArray(source.cases) ||
    source.caseIds.length !== 89 ||
    source.cases.length !== 89 ||
    PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_REGISTRY_ADAPTER_DEFINITIONS_V1.length !==
      89
  ) {
    throw new TypeError("Registry adapter source semantic closure drifted");
  }
  for (let index = 0; index < 89; index += 1) {
    const row =
      PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_REGISTRY_ADAPTER_DEFINITIONS_V1[
        index
      ];
    const sourceCase = source.cases[index];
    const sourceOperation = sourceCase?.mutation?.steps?.[0]?.operation;
    if (
      row === undefined ||
      row.sourceIndex !== index ||
      source.caseIds[index] !== row.sourceCaseId ||
      sourceCase?.caseId !== row.sourceCaseId ||
      sourceOperation !== row.sourceOperation ||
      row.caseId !== `registry-${row.sourceCaseId}` ||
      row.mutation.operation !== row.caseId ||
      row.mutation.recipe.sourceIndex !== index ||
      row.mutation.recipe.sourceCaseId !== row.sourceCaseId ||
      row.mutation.recipe.sourceOperation !== row.sourceOperation ||
      !canonicalEqualV1(
        sourceExpectedProjectionV1(sourceCase),
        row.sourceExpected,
      )
    ) {
      throw new TypeError(`Registry adapter row ${index} drifted`);
    }
  }
  return source;
}

function snapshotMaterializedValueV1(
  value,
  recursion,
  completedSnapshots,
) {
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

export function deriveProviderRegistryEvidenceBindingRegistryAdapterMaterializedRequestDigestV1(
  request,
) {
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
              "provider_registry_evidence_binding_registry_adapter_capability_sentinel_v1",
          }
        : snapshotMaterializedValueV1(
            descriptor.value,
            recursion,
            completedSnapshots,
          );
  }
  return streamedSemanticDigestV1(
    PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_REGISTRY_ADAPTER_MATERIALIZED_REQUEST_DOMAIN_V1,
    {
      profile:
        "provider_registry_evidence_binding_registry_adapter_materialized_request_projection_v1",
      request: projectedRequest,
    },
  );
}

function compatibleRegistryGoldenV1(registryGolden, compatibleBase) {
  return {
    ...registryGolden,
    installationIdentityGenerationId:
      compatibleBase.installationIdentityGenerationId,
    bootstrapTrustBundle: compatibleBase.bootstrapTrustBundle,
    rootMetadataHistory: compatibleBase.rootMetadataHistory,
    registryManifestHistory: compatibleBase.registryManifestHistory,
  };
}

function assertSourceRequestKeysV1(sourceRequest, expectedKeys, caseId) {
  const actualKeys = Reflect.ownKeys(sourceRequest);
  if (actualKeys.some((key) => typeof key !== "string")) {
    throw new TypeError(`${caseId} source request shape drifted`);
  }
  actualKeys.sort();
  const sortedExpectedKeys = [...expectedKeys].sort();
  if (
    actualKeys.length !== sortedExpectedKeys.length ||
    actualKeys.some((key, index) => key !== sortedExpectedKeys[index])
  ) {
    throw new TypeError(`${caseId} source request shape drifted`);
  }
}

const STANDARD_SOURCE_REQUEST_KEYS_V1 = Object.freeze([
  "bootstrapTrustBundle",
  "installationIdentityGenerationId",
  "registryManifestHistory",
  "rootMetadataHistory",
  "strictCryptoCapability",
]);

const recipeHandlersV1 = Object.freeze({
  registry_manifest_history(request, sourceRequest, compatibleBase, caseId) {
    assertSourceRequestKeysV1(
      sourceRequest,
      STANDARD_SOURCE_REQUEST_KEYS_V1,
      caseId,
    );
    if (
      sourceRequest.installationIdentityGenerationId !==
      compatibleBase.installationIdentityGenerationId
    ) {
      throw new TypeError(`${caseId} changed the outer Installation Identity`);
    }
    request.installationIdentityGenerationId =
      sourceRequest.installationIdentityGenerationId;
  },
  outer_extra_field(request, sourceRequest, compatibleBase, caseId) {
    assertSourceRequestKeysV1(
      sourceRequest,
      [...STANDARD_SOURCE_REQUEST_KEYS_V1, "callerPath"],
      caseId,
    );
    if (
      sourceRequest.installationIdentityGenerationId !==
        compatibleBase.installationIdentityGenerationId ||
      sourceRequest.callerPath !== "latest.json"
    ) {
      throw new TypeError(`${caseId} outer extra-field recipe drifted`);
    }
    request.installationIdentityGenerationId =
      sourceRequest.installationIdentityGenerationId;
    request.callerPath = sourceRequest.callerPath;
  },
  outer_missing_installation_identity(
    request,
    sourceRequest,
    _compatibleBase,
    caseId,
  ) {
    assertSourceRequestKeysV1(
      sourceRequest,
      STANDARD_SOURCE_REQUEST_KEYS_V1.filter(
        (key) => key !== "installationIdentityGenerationId",
      ),
      caseId,
    );
    delete request.installationIdentityGenerationId;
  },
  outer_installation_identity(
    request,
    sourceRequest,
    compatibleBase,
    caseId,
  ) {
    assertSourceRequestKeysV1(
      sourceRequest,
      STANDARD_SOURCE_REQUEST_KEYS_V1,
      caseId,
    );
    if (
      sourceRequest.installationIdentityGenerationId ===
      compatibleBase.installationIdentityGenerationId
    ) {
      throw new TypeError(`${caseId} did not mutate Installation Identity`);
    }
    request.installationIdentityGenerationId =
      sourceRequest.installationIdentityGenerationId;
  },
});

export function materializeProviderRegistryEvidenceBindingRegistryAdapterCaseV1({
  adapterDefinition,
  source,
  registryGolden,
  compatibleBase,
  strictCryptoCapability,
}) {
  const sourceCase = source.cases[adapterDefinition.sourceIndex];
  if (
    sourceCase?.caseId !== adapterDefinition.sourceCaseId ||
    sourceCase.mutation?.steps?.[0]?.operation !==
      adapterDefinition.sourceOperation
  ) {
    throw new TypeError("Registry adapter source position drifted");
  }
  const sourceMaterialized =
    materializeProviderRegistryManifestInvalidCandidateV1(
      compatibleRegistryGoldenV1(registryGolden, compatibleBase),
      sourceCase,
      strictCryptoCapability,
    );
  const sourceRequest = sourceMaterialized.request;
  const request = requestFromCompatibleBase(
    compatibleBase,
    strictCryptoCapability,
  );

  request.bootstrapTrustBundle = sourceRequest.bootstrapTrustBundle;
  request.rootMetadataHistory = sourceRequest.rootMetadataHistory;
  request.registryManifestHistory = sourceRequest.registryManifestHistory;
  if (
    sourceRequest.strictCryptoCapability !== strictCryptoCapability ||
    !canonicalEqualV1(
      sourceRequest.bootstrapTrustBundle,
      compatibleBase.bootstrapTrustBundle,
    ) ||
    !canonicalEqualV1(
      sourceRequest.rootMetadataHistory,
      compatibleBase.rootMetadataHistory,
    )
  ) {
    throw new TypeError(`${adapterDefinition.caseId} source base drifted`);
  }
  const recipeHandler =
    recipeHandlersV1[adapterDefinition.mutation.recipe.kind];
  if (typeof recipeHandler !== "function") {
    throw new TypeError(`${adapterDefinition.caseId} recipe kind is unknown`);
  }
  recipeHandler(
    request,
    sourceRequest,
    compatibleBase,
    adapterDefinition.caseId,
  );

  return Object.freeze({
    request,
    wrongDomainProofs: sourceMaterialized.wrongDomainProofs,
    sourceCase,
  });
}

export function finalizeProviderRegistryEvidenceBindingRegistryAdapterRowV1(
  adapterDefinition,
  sourceCase,
  materializedRequestSemanticDigest,
) {
  const step = sourceCase.mutation.steps[0];
  return Object.freeze({
    sourceResource: adapterDefinition.sourceResource,
    sourceIndex: adapterDefinition.sourceIndex,
    sourceCaseId: adapterDefinition.sourceCaseId,
    sourceOperation: adapterDefinition.sourceOperation,
    sourceExpected: adapterDefinition.sourceExpected,
    caseId: adapterDefinition.caseId,
    mutation: Object.freeze({
      operation: adapterDefinition.mutation.operation,
      recipe: Object.freeze({
        ...adapterDefinition.mutation.recipe,
        targetJsonPointer: step.targetJsonPointer,
        operands: Object.freeze([...step.operands]),
      }),
    }),
    outerExpected: Object.freeze({
      ...adapterDefinition.outerExpectedWithoutMaterializedDigest,
      materializedRequestSemanticDigest,
    }),
  });
}

export function deriveProviderRegistryEvidenceBindingRegistryAdapterTableDigestV1(
  rows,
) {
  return semanticDigestV1(
    PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_REGISTRY_ADAPTER_TABLE_DOMAIN_V1,
    rows,
  );
}
