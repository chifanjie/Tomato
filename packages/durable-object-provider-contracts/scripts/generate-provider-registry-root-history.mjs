import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
} from "node:crypto";
import {
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  canonicalizeJcsSafeIntegerUtf8V1,
} from "../dist/jcs.js";
import {
  PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_PATH_V1,
  PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_SHA256_HEX_V1,
  PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
  PROVIDER_REGISTRY_ROOT_HISTORY_INVALID_CASE_IDS_V1,
  PROVIDER_REGISTRY_ROOT_HISTORY_INVALID_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_REGISTRY_ROOT_HISTORY_INVALID_RESOURCE_PATH_V1,
  PROVIDER_REGISTRY_ROOT_HISTORY_INVALID_RESOURCE_SHA256_HEX_V1,
  PROVIDER_REGISTRY_ROOT_HISTORY_INVALID_SEMANTIC_CONTENT_DIGEST_V1,
  verifyProviderRegistryRootHistoryGoldenManifestResourceV1,
  verifyProviderRegistryRootHistoryInvalidManifestResourceV1,
} from "../dist/provider-registry-root-history-fixtures.js";
import {
  PROVIDER_REGISTRY_ROOT_HISTORY_INVALID_CASE_DEFINITIONS_V1,
} from "../dist/provider-registry-root-history-invalid-definitions.js";
import {
  PROVIDER_STRICT_ED25519_CRYPTO_CAPABILITY_V1,
} from "../dist/strict-ed25519-conformance.js";
import {
  PROVIDER_TRUST_HISTORY_POLICY_V1,
} from "../dist/provider-trust-policy.js";

const packageRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
);
const goldenPath = join(
  packageRoot,
  ...PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_PATH_V1.split(
    "/",
  ),
);
const invalidPath = join(
  packageRoot,
  ...PROVIDER_REGISTRY_ROOT_HISTORY_INVALID_RESOURCE_PATH_V1.split(
    "/",
  ),
);

const domains = Object.freeze({
  rootKeyId: "provider-registry-root-key-id-v1",
  recoveryKeyId: "provider-registry-recovery-key-id-v1",
  rootMetadata: "provider-registry-root-metadata-v1",
  rootSelf: "provider-registry-root-self-signature-v1",
  rootCross: "provider-registry-root-cross-signature-v1",
  rootRecovery: "provider-registry-root-recovery-signature-v1",
  goldenManifest:
    "provider-registry-root-history-golden-manifest-v1",
  invalidManifest:
    "provider-registry-root-history-invalid-manifest-v1",
});
const base32HexLowerAlphabet =
  "0123456789abcdefghijklmnopqrstuv";

function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest();
}

function encodeBase32HexLower(bytes) {
  let output = "";
  let accumulator = 0;
  let availableBits = 0;
  for (const byte of bytes) {
    accumulator = (accumulator << 8) | byte;
    availableBits += 8;
    while (availableBits >= 5) {
      availableBits -= 5;
      output +=
        base32HexLowerAlphabet[
          (accumulator >>> availableBits) & 0x1f
        ];
      accumulator &= (1 << availableBits) - 1;
    }
  }
  if (availableBits !== 0) {
    output +=
      base32HexLowerAlphabet[
        (accumulator << (5 - availableBits)) & 0x1f
      ];
  }
  return output;
}

function semanticDigest(domain, value) {
  return `sha256:${sha256Bytes(
    canonicalizeJcsSafeIntegerUtf8V1([domain, value]),
  ).toString("hex")}`;
}

function shortId(domain, fields) {
  return sha256Bytes(
    canonicalizeJcsSafeIntegerUtf8V1([domain, fields]),
  )
    .toString("hex")
    .slice(0, 22);
}

function deterministicKey(seedHex) {
  const seed = Buffer.from(seedHex, "hex");
  const privateKey = createPrivateKey({
    key: Buffer.concat([
      Buffer.from("302e020100300506032b657004220420", "hex"),
      seed,
    ]),
    format: "der",
    type: "pkcs8",
  });
  const spki = createPublicKey(privateKey).export({
    format: "der",
    type: "spki",
  });
  const rawPublicKey = Buffer.from(
    spki.subarray(spki.byteLength - 32),
  );
  return {
    privateKey,
    publicKeyBytes: `base64url:${rawPublicKey.toString("base64url")}`,
    publicKeyDigest: `sha256:${sha256Bytes(rawPublicKey).toString("hex")}`,
  };
}

function rootRecord(key) {
  return {
    profile: "provider_registry_root_public_key_v1",
    rootKeyId: shortId(domains.rootKeyId, {
      publicKeyBytes: key.publicKeyBytes,
    }),
    algorithm: "ed25519",
    publicKeyBytes: key.publicKeyBytes,
    publicKeyDigest: key.publicKeyDigest,
  };
}

function recoveryRecord(key) {
  return {
    profile: "provider_registry_recovery_public_key_v1",
    recoveryKeyId: shortId(domains.recoveryKeyId, {
      publicKeyBytes: key.publicKeyBytes,
    }),
    algorithm: "ed25519",
    publicKeyBytes: key.publicKeyBytes,
    publicKeyDigest: key.publicKeyDigest,
  };
}

function unsignedClaims(metadata) {
  return {
    profile: metadata.profile,
    rootGeneration: metadata.rootGeneration,
    activeRoot: metadata.activeRoot,
    issuedAt: metadata.issuedAt,
    activation: metadata.activation,
    predecessor: metadata.predecessor,
  };
}

function rootMessage(domain, keyField, keyId, metadata) {
  const wrapper = {
    [keyField]: keyId,
    domain,
    claims: unsignedClaims(metadata),
  };
  return canonicalizeJcsSafeIntegerUtf8V1([domain, wrapper]);
}

function signatureHex(privateKey, message) {
  return sign(null, Buffer.from(message), privateKey).toString("hex");
}

function selfSignature(metadata, key) {
  const rootKeyId = metadata.activeRoot.rootKeyId;
  const message = rootMessage(
    domains.rootSelf,
    "rootKeyId",
    rootKeyId,
    metadata,
  );
  return {
    message,
    wire:
      `provider-root-self-ed25519:${rootKeyId}:` +
      signatureHex(key.privateKey, message),
  };
}

function crossSignature(metadata, predecessorRootKeyId, key) {
  const message = rootMessage(
    domains.rootCross,
    "rootKeyId",
    predecessorRootKeyId,
    metadata,
  );
  return {
    message,
    wire:
      `provider-root-cross-ed25519:${predecessorRootKeyId}:` +
      signatureHex(key.privateKey, message),
  };
}

function recoverySignature(metadata, recoveryKeyId, key) {
  const message = rootMessage(
    domains.rootRecovery,
    "recoveryKeyId",
    recoveryKeyId,
    metadata,
  );
  return {
    recoveryKeyId,
    message,
    wire:
      `provider-root-recovery-ed25519:${recoveryKeyId}:` +
      signatureHex(key.privateKey, message),
  };
}

function envelope(payload) {
  return {
    schemaVersion: 1,
    recordType: "provider_registry_root_metadata",
    rootGeneration: payload.rootGeneration,
    rootKeyId: payload.activeRoot.rootKeyId,
    contentDigest: semanticDigest(domains.rootMetadata, payload),
    payload,
  };
}

function pinForEnvelope(value) {
  return {
    locatorProfile:
      "installation_provider_registry_root_metadata_v1",
    rootGeneration: value.rootGeneration,
    rootKeyId: value.rootKeyId,
    contentDigest: value.contentDigest,
  };
}

function rootLocator(value) {
  const semanticComponent =
    `${value.rootGeneration}:${value.rootKeyId}`;
  const semanticBytes = Buffer.from(semanticComponent, "utf8");
  const body = encodeBase32HexLower(semanticBytes);
  const filenameKey =
    body.length <= 220
      ? `id-${body}`
      : `idh-${sha256Bytes(semanticBytes).toString("hex")}`;
  return `provider/root-metadata/${filenameKey}.json`;
}

function hex(bytes) {
  return Buffer.from(bytes).toString("hex");
}

const deterministicSeeds = {
  purpose: "non_production_fixture_only",
  bootstrapRootSeedHex: "10".repeat(32),
  plannedRootSeedHex: "20".repeat(32),
  compromiseRootSeedHex: "30".repeat(32),
  recoverySeedHexes: [
    "40".repeat(32),
    "50".repeat(32),
    "60".repeat(32),
  ],
};

const bootstrapKey = deterministicKey(
  deterministicSeeds.bootstrapRootSeedHex,
);
const plannedKey = deterministicKey(
  deterministicSeeds.plannedRootSeedHex,
);
const compromiseKey = deterministicKey(
  deterministicSeeds.compromiseRootSeedHex,
);
const recoveryKeyPairs =
  deterministicSeeds.recoverySeedHexes.map(deterministicKey);
const bootstrapRoot = rootRecord(bootstrapKey);
const plannedRoot = rootRecord(plannedKey);
const compromiseRoot = rootRecord(compromiseKey);
const recoveryEntries = recoveryKeyPairs
  .map((key, originalIndex) => ({
    key,
    originalIndex,
    record: recoveryRecord(key),
  }))
  .sort((left, right) =>
    Buffer.from(left.record.recoveryKeyId, "utf8").compare(
      Buffer.from(right.record.recoveryKeyId, "utf8"),
    ),
  );

const bootstrapCarrier = {
  profile: "provider_registry_root_metadata_v1",
  rootGeneration: 1,
  activeRoot: bootstrapRoot,
  issuedAt: "2026-08-03T00:00:00Z",
  selfSignature:
    `provider-root-self-ed25519:${bootstrapRoot.rootKeyId}:${"0".repeat(128)}`,
  activation: "bootstrap",
  predecessor: { state: "genesis" },
  recoverySignatures: [],
};
const bootstrapSelf = selfSignature(
  bootstrapCarrier,
  bootstrapKey,
);
const bootstrapPayload = {
  ...bootstrapCarrier,
  selfSignature: bootstrapSelf.wire,
};
const bootstrapEnvelope = envelope(bootstrapPayload);

const plannedCarrier = {
  profile: "provider_registry_root_metadata_v1",
  rootGeneration: 2,
  activeRoot: plannedRoot,
  issuedAt: "2026-08-03T00:01:00Z",
  selfSignature:
    `provider-root-self-ed25519:${plannedRoot.rootKeyId}:${"0".repeat(128)}`,
  activation: "planned_rollover",
  predecessor: {
    state: "root_metadata",
    rootGeneration: bootstrapEnvelope.rootGeneration,
    rootKeyId: bootstrapEnvelope.rootKeyId,
    contentDigest: bootstrapEnvelope.contentDigest,
  },
  predecessorCrossSignature:
    `provider-root-cross-ed25519:${bootstrapRoot.rootKeyId}:${"0".repeat(128)}`,
  recoverySignatures: [
    `provider-root-recovery-ed25519:${recoveryEntries[0].record.recoveryKeyId}:${"0".repeat(128)}`,
    `provider-root-recovery-ed25519:${recoveryEntries[1].record.recoveryKeyId}:${"0".repeat(128)}`,
  ],
};
const plannedSelf = selfSignature(plannedCarrier, plannedKey);
const plannedCross = crossSignature(
  plannedCarrier,
  bootstrapRoot.rootKeyId,
  bootstrapKey,
);
const plannedRecovery = recoveryEntries
  .slice(0, 2)
  .map(({ key, record }) =>
    recoverySignature(
      plannedCarrier,
      record.recoveryKeyId,
      key,
    ),
  );
const plannedPayload = {
  ...plannedCarrier,
  selfSignature: plannedSelf.wire,
  predecessorCrossSignature: plannedCross.wire,
  recoverySignatures: plannedRecovery.map(({ wire }) => wire),
};
const plannedEnvelope = envelope(plannedPayload);

const compromiseCarrier = {
  profile: "provider_registry_root_metadata_v1",
  rootGeneration: 3,
  activeRoot: compromiseRoot,
  issuedAt: "2026-08-03T00:02:00Z",
  selfSignature:
    `provider-root-self-ed25519:${compromiseRoot.rootKeyId}:${"0".repeat(128)}`,
  activation: "compromise_recovery",
  predecessor: {
    state: "root_metadata",
    rootGeneration: plannedEnvelope.rootGeneration,
    rootKeyId: plannedEnvelope.rootKeyId,
    contentDigest: plannedEnvelope.contentDigest,
  },
  recoverySignatures: [
    `provider-root-recovery-ed25519:${recoveryEntries[1].record.recoveryKeyId}:${"0".repeat(128)}`,
    `provider-root-recovery-ed25519:${recoveryEntries[2].record.recoveryKeyId}:${"0".repeat(128)}`,
  ],
};
const compromiseSelf = selfSignature(
  compromiseCarrier,
  compromiseKey,
);
const compromiseRecovery = recoveryEntries
  .slice(1, 3)
  .map(({ key, record }) =>
    recoverySignature(
      compromiseCarrier,
      record.recoveryKeyId,
      key,
    ),
  );
const compromisePayload = {
  ...compromiseCarrier,
  selfSignature: compromiseSelf.wire,
  recoverySignatures: compromiseRecovery.map(({ wire }) => wire),
};
const compromiseEnvelope = envelope(compromisePayload);

const history = [
  bootstrapEnvelope,
  plannedEnvelope,
  compromiseEnvelope,
];

function commonVector(value, selfMessage) {
  return {
    rootGeneration: value.rootGeneration,
    activation: value.payload.activation,
    unsignedClaimsCanonicalUtf8Hex: hex(
      canonicalizeJcsSafeIntegerUtf8V1(
        unsignedClaims(value.payload),
      ),
    ),
    selfSignatureMessageUtf8Hex: hex(selfMessage),
    envelopeCanonicalUtf8Hex: hex(
      canonicalizeJcsSafeIntegerUtf8V1(value),
    ),
    contentDigest: value.contentDigest,
    locator: rootLocator(value),
  };
}

const goldenManifest = {
  schemaVersion: 1,
  profile:
    "provider_registry_root_history_golden_manifest_v1",
  canonicalizationProfile:
    "rfc8785-jcs-safe-integer-v1",
  verificationProfile:
    "ed25519-rfc8032-cofactorless-prime-subgroup-v1",
  fixtureAuthority: "none_structure_and_history_only",
  deterministicSeeds,
  bootstrapTrustBundle: {
    profile: "provider_bootstrap_trust_bundle_v1",
    strictCryptoCapability:
      PROVIDER_STRICT_ED25519_CRYPTO_CAPABILITY_V1,
    bootstrapProviderRegistryRoot: bootstrapRoot,
    bootstrapProviderRegistryRootMetadata: bootstrapEnvelope,
    providerRegistryRecoveryKeys: recoveryEntries.map(
      ({ record }) => record,
    ),
    providerRegistryRecoveryThreshold: 2,
    providerTrustHistoryPolicy:
      PROVIDER_TRUST_HISTORY_POLICY_V1,
  },
  rootMetadataHistory: history,
  expected: {
    rootMetadataCount: 3,
    canonicalEnvelopeLogicalBytes: history.reduce(
      (total, value) =>
        total +
        canonicalizeJcsSafeIntegerUtf8V1(value).byteLength,
      0,
    ),
    currentRootMetadata: pinForEnvelope(compromiseEnvelope),
    vectors: [
      commonVector(bootstrapEnvelope, bootstrapSelf.message),
      {
        ...commonVector(plannedEnvelope, plannedSelf.message),
        predecessorCrossSignatureMessageUtf8Hex: hex(
          plannedCross.message,
        ),
        recoverySignatureMessages: plannedRecovery.map(
          ({ recoveryKeyId, message }) => ({
            recoveryKeyId,
            canonicalMessageUtf8Hex: hex(message),
          }),
        ),
      },
      {
        ...commonVector(
          compromiseEnvelope,
          compromiseSelf.message,
        ),
        recoverySignatureMessages: compromiseRecovery.map(
          ({ recoveryKeyId, message }) => ({
            recoveryKeyId,
            canonicalMessageUtf8Hex: hex(message),
          }),
        ),
      },
    ],
  },
};

const noSeed = Object.freeze({ source: "none" });
function goldenSeed(jsonPointer) {
  return {
    source: "golden_json_pointer",
    resourcePath:
      PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_PATH_V1,
    jsonPointer,
  };
}
function literalSeed(seedHex) {
  return {
    source: "literal_non_production",
    seedHex,
  };
}
function invalidCase(
  caseId,
  operation,
  targetJsonPointer,
  operands,
  stage,
  reason,
  deterministicSeed = noSeed,
  pointCalls = 0,
  signatureCalls = 0,
) {
  return {
    caseId,
    mutation: {
      dialect:
        "provider_registry_root_history_invalid_recipe_v1",
      operation,
      targetJsonPointer,
      operands,
      deterministicSeed,
    },
    expected: {
      boundary: "internal_diagnostic",
      stage,
      reason,
      publicFailureReason: "attestation_invalid",
      postAttestationPointCalls: pointCalls,
      postAttestationSignatureCalls: signatureCalls,
    },
  };
}

const invalidCases = [
  invalidCase(
    "history-empty",
    "replace_history_with_empty",
    "/rootMetadataHistory",
    [],
    "history_input",
    "history_empty",
  ),
  invalidCase(
    "bootstrap-anchor-substitution",
    "replace_bootstrap_active_root_and_resign_self",
    "/rootMetadataHistory/0",
    ["/rootMetadataHistory/1/payload/activeRoot"],
    "bootstrap_anchor",
    "bootstrap_metadata_mismatch",
    goldenSeed("/deterministicSeeds/plannedRootSeedHex"),
  ),
  invalidCase(
    "bootstrap-generation-substitution",
    "replace_number",
    "/rootMetadataHistory/0/rootGeneration",
    ["2"],
    "root_metadata_envelope",
    "envelope_mismatch",
  ),
  invalidCase(
    "history-generation-gap",
    "replace_number_and_reseal_envelope",
    "/rootMetadataHistory/1/payload/rootGeneration",
    ["3"],
    "history_predecessor",
    "generation_not_contiguous",
  ),
  invalidCase(
    "history-generation-rollback",
    "duplicate_history_envelope",
    "/rootMetadataHistory/2",
    ["/rootMetadataHistory/1"],
    "history_predecessor",
    "generation_not_contiguous",
  ),
  invalidCase(
    "predecessor-generation-substitution",
    "replace_number_and_resign_all",
    "/rootMetadataHistory/1/payload/predecessor/rootGeneration",
    ["2"],
    "history_predecessor",
    "predecessor_pin_mismatch",
    goldenSeed("/deterministicSeeds/plannedRootSeedHex"),
  ),
  invalidCase(
    "predecessor-root-key-substitution",
    "replace_string_and_resign_all",
    "/rootMetadataHistory/1/payload/predecessor/rootKeyId",
    [compromiseRoot.rootKeyId],
    "history_predecessor",
    "predecessor_pin_mismatch",
    goldenSeed("/deterministicSeeds/plannedRootSeedHex"),
  ),
  invalidCase(
    "predecessor-content-digest-substitution",
    "replace_string_and_resign_all",
    "/rootMetadataHistory/1/payload/predecessor/contentDigest",
    [`sha256:${"f".repeat(64)}`],
    "history_predecessor",
    "predecessor_pin_mismatch",
    goldenSeed("/deterministicSeeds/plannedRootSeedHex"),
  ),
  invalidCase(
    "self-signature-bitflip",
    "flip_signature_last_bit",
    "/rootMetadataHistory/1/payload/selfSignature",
    [],
    "root_self_signature",
    "self_signature_invalid",
  ),
  invalidCase(
    "self-signature-wrong-domain",
    "resign_with_domain",
    "/rootMetadataHistory/1/payload/selfSignature",
    [domains.rootCross],
    "root_self_signature",
    "self_signature_invalid",
    goldenSeed("/deterministicSeeds/plannedRootSeedHex"),
  ),
  invalidCase(
    "self-signature-prefix-substitution",
    "replace_signature_prefix_key_id",
    "/rootMetadataHistory/1/payload/selfSignature",
    [bootstrapRoot.rootKeyId],
    "root_metadata_envelope",
    "envelope_mismatch",
  ),
  invalidCase(
    "cross-signature-bitflip",
    "flip_signature_last_bit",
    "/rootMetadataHistory/1/payload/predecessorCrossSignature",
    [],
    "root_cross_signature",
    "cross_signature_invalid",
  ),
  invalidCase(
    "cross-signature-wrong-domain",
    "resign_with_domain",
    "/rootMetadataHistory/1/payload/predecessorCrossSignature",
    [domains.rootSelf],
    "root_cross_signature",
    "cross_signature_invalid",
    goldenSeed("/deterministicSeeds/bootstrapRootSeedHex"),
  ),
  invalidCase(
    "cross-signature-prefix-substitution",
    "replace_signature_prefix_key_id",
    "/rootMetadataHistory/1/payload/predecessorCrossSignature",
    [plannedRoot.rootKeyId],
    "root_metadata_envelope",
    "envelope_mismatch",
  ),
  invalidCase(
    "planned-cross-signature-missing",
    "delete_property",
    "/rootMetadataHistory/1/payload/predecessorCrossSignature",
    [],
    "root_metadata_envelope",
    "schema_invalid",
  ),
  invalidCase(
    "compromise-cross-signature-injected",
    "copy_property",
    "/rootMetadataHistory/2/payload/predecessorCrossSignature",
    ["/rootMetadataHistory/1/payload/predecessorCrossSignature"],
    "root_metadata_envelope",
    "schema_invalid",
  ),
  invalidCase(
    "recovery-signature-missing",
    "remove_array_item",
    "/rootMetadataHistory/1/payload/recoverySignatures",
    ["1"],
    "root_metadata_envelope",
    "schema_invalid",
  ),
  invalidCase(
    "recovery-signature-extra",
    "append_array_item",
    "/rootMetadataHistory/1/payload/recoverySignatures",
    ["/rootMetadataHistory/1/payload/recoverySignatures/0"],
    "root_metadata_envelope",
    "schema_invalid",
  ),
  invalidCase(
    "recovery-signature-duplicate-signer",
    "resign_recovery_with_key",
    "/rootMetadataHistory/1/payload/recoverySignatures/1",
    [recoveryEntries[0].record.recoveryKeyId],
    "root_metadata_envelope",
    "envelope_mismatch",
    goldenSeed(
      `/deterministicSeeds/recoverySeedHexes/${recoveryEntries[0].originalIndex}`,
    ),
  ),
  invalidCase(
    "recovery-signature-reversed",
    "reverse_array",
    "/rootMetadataHistory/1/payload/recoverySignatures",
    [],
    "root_metadata_envelope",
    "envelope_mismatch",
  ),
  invalidCase(
    "recovery-signature-unknown-signer",
    "resign_recovery_with_literal_seed",
    "/rootMetadataHistory/1/payload/recoverySignatures/0",
    [],
    "root_recovery_signature",
    "recovery_quorum_invalid",
    literalSeed("70".repeat(32)),
  ),
  invalidCase(
    "recovery-signature-bitflip",
    "flip_signature_last_bit",
    "/rootMetadataHistory/1/payload/recoverySignatures/0",
    [],
    "root_recovery_signature",
    "recovery_quorum_invalid",
  ),
  invalidCase(
    "recovery-signature-wrong-domain",
    "resign_with_domain",
    "/rootMetadataHistory/1/payload/recoverySignatures/0",
    [domains.rootSelf],
    "root_recovery_signature",
    "recovery_quorum_invalid",
    goldenSeed(
      `/deterministicSeeds/recoverySeedHexes/${recoveryEntries[0].originalIndex}`,
    ),
  ),
  invalidCase(
    "root-reuses-historical-root-material",
    "replace_active_root_and_resign_self",
    "/rootMetadataHistory/2/payload/activeRoot",
    ["/rootMetadataHistory/0/payload/activeRoot"],
    "root_material_closure",
    "root_key_material_alias",
    goldenSeed("/deterministicSeeds/bootstrapRootSeedHex"),
  ),
  invalidCase(
    "root-reuses-recovery-material",
    "replace_active_root_from_recovery_and_resign_self",
    "/rootMetadataHistory/2/payload/activeRoot",
    ["/bootstrapTrustBundle/providerRegistryRecoveryKeys/0"],
    "root_material_closure",
    "root_key_material_alias",
    goldenSeed(
      `/deterministicSeeds/recoverySeedHexes/${recoveryEntries[0].originalIndex}`,
    ),
  ),
  invalidCase(
    "root-point-invalid",
    "replace_active_root_with_small_order_point",
    "/rootMetadataHistory/2/payload/activeRoot",
    ["base64url:AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"],
    "root_key_admission",
    "point_admission_failed",
  ),
  invalidCase(
    "envelope-outer-generation-mismatch",
    "replace_number",
    "/rootMetadataHistory/1/rootGeneration",
    ["3"],
    "root_metadata_envelope",
    "envelope_mismatch",
  ),
  invalidCase(
    "envelope-outer-key-mismatch",
    "replace_string",
    "/rootMetadataHistory/1/rootKeyId",
    [bootstrapRoot.rootKeyId],
    "root_metadata_envelope",
    "envelope_mismatch",
  ),
  invalidCase(
    "envelope-content-digest-mismatch",
    "replace_string",
    "/rootMetadataHistory/1/contentDigest",
    [`sha256:${"e".repeat(64)}`],
    "root_metadata_envelope",
    "envelope_mismatch",
  ),
  invalidCase(
    "envelope-byte-cap-exceeded",
    "replace_timestamp_with_repeated_ascii",
    "/rootMetadataHistory/1/payload/issuedAt",
    ["4194305", "61"],
    "history_limit",
    "envelope_byte_limit_exceeded",
  ),
  invalidCase(
    "root-generation-count-cap-exceeded",
    "repeat_history_envelope",
    "/rootMetadataHistory",
    ["257", "/rootMetadataHistory/2"],
    "history_limit",
    "history_generation_limit_exceeded",
  ),
];

const invalidCallCounts = {
  "history-empty": [0, 0],
  "bootstrap-anchor-substitution": [5, 1],
  "bootstrap-generation-substitution": [5, 1],
  "history-generation-gap": [7, 2],
  "history-generation-rollback": [9, 6],
  "predecessor-generation-substitution": [7, 2],
  "predecessor-root-key-substitution": [7, 2],
  "predecessor-content-digest-substitution": [7, 2],
  "self-signature-bitflip": [9, 3],
  "self-signature-wrong-domain": [9, 3],
  "self-signature-prefix-substitution": [7, 2],
  "cross-signature-bitflip": [9, 4],
  "cross-signature-wrong-domain": [9, 4],
  "cross-signature-prefix-substitution": [7, 2],
  "planned-cross-signature-missing": [7, 2],
  "compromise-cross-signature-injected": [9, 6],
  "recovery-signature-missing": [7, 2],
  "recovery-signature-extra": [7, 2],
  "recovery-signature-duplicate-signer": [7, 2],
  "recovery-signature-reversed": [7, 2],
  "recovery-signature-unknown-signer": [9, 4],
  "recovery-signature-bitflip": [9, 5],
  "recovery-signature-wrong-domain": [9, 5],
  "root-reuses-historical-root-material": [9, 6],
  "root-reuses-recovery-material": [9, 6],
  "root-point-invalid": [10, 6],
  "envelope-outer-generation-mismatch": [7, 2],
  "envelope-outer-key-mismatch": [7, 2],
  "envelope-content-digest-mismatch": [7, 2],
  "envelope-byte-cap-exceeded": [7, 2],
  "root-generation-count-cap-exceeded": [0, 0],
};
for (const invalid of invalidCases) {
  const counts = invalidCallCounts[invalid.caseId];
  if (counts === undefined) {
    throw new Error(
      `missing root history call-count anchor: ${invalid.caseId}`,
    );
  }
  [
    invalid.expected.postAttestationPointCalls,
    invalid.expected.postAttestationSignatureCalls,
  ] = counts;
}

const actualInvalidIds = invalidCases.map(({ caseId }) => caseId);
if (
  JSON.stringify(actualInvalidIds) !==
  JSON.stringify(PROVIDER_REGISTRY_ROOT_HISTORY_INVALID_CASE_IDS_V1)
) {
  throw new Error(
    "root history invalid generator case catalog is not exact",
  );
}
if (
  JSON.stringify(invalidCases) !==
  JSON.stringify(
    PROVIDER_REGISTRY_ROOT_HISTORY_INVALID_CASE_DEFINITIONS_V1,
  )
) {
  throw new Error(
    "root history invalid generator definitions differ from the compiled exact contract",
  );
}

function prettyJsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const goldenBytes = prettyJsonBytes(goldenManifest);
const goldenRawSha256 = sha256Bytes(goldenBytes).toString("hex");
const goldenSemanticDigest = semanticDigest(
  domains.goldenManifest,
  goldenManifest,
);
const invalidManifest = {
  schemaVersion: 1,
  profile:
    "provider_registry_root_history_invalid_manifest_v1",
  canonicalizationProfile:
    "rfc8785-jcs-safe-integer-v1",
  verificationProfile:
    "ed25519-rfc8032-cofactorless-prime-subgroup-v1",
  fixtureAuthority: "none_rejection_only",
  goldenResource: {
    resourcePath:
      PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_PATH_V1,
    resourceByteLength: goldenBytes.byteLength,
    resourceSha256Hex: goldenRawSha256,
    semanticContentDigest: goldenSemanticDigest,
  },
  cases: invalidCases,
};
const invalidBytes = prettyJsonBytes(invalidManifest);
const invalidRawSha256 = sha256Bytes(invalidBytes).toString("hex");
const invalidSemanticDigest = semanticDigest(
  domains.invalidManifest,
  invalidManifest,
);

const anchors = {
  golden: {
    resourceByteLength: goldenBytes.byteLength,
    resourceSha256Hex: goldenRawSha256,
    semanticContentDigest: goldenSemanticDigest,
  },
  invalid: {
    resourceByteLength: invalidBytes.byteLength,
    resourceSha256Hex: invalidRawSha256,
    semanticContentDigest: invalidSemanticDigest,
  },
};

if (process.argv.includes("--anchors")) {
  process.stdout.write(`${JSON.stringify(anchors, null, 2)}\n`);
  process.exit(0);
}

if (process.argv.includes("--check")) {
  const [checkedGolden, checkedInvalid] = await Promise.all([
    readFile(goldenPath),
    readFile(invalidPath),
  ]);
  if (
    !checkedGolden.equals(goldenBytes) ||
    !checkedInvalid.equals(invalidBytes)
  ) {
    throw new Error(
      "provider registry root history fixtures differ from deterministic generation",
    );
  }
  if (
    goldenBytes.byteLength !==
      PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_BYTE_LENGTH_V1 ||
    goldenRawSha256 !==
      PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_SHA256_HEX_V1 ||
    goldenSemanticDigest !==
      PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1 ||
    invalidBytes.byteLength !==
      PROVIDER_REGISTRY_ROOT_HISTORY_INVALID_RESOURCE_BYTE_LENGTH_V1 ||
    invalidRawSha256 !==
      PROVIDER_REGISTRY_ROOT_HISTORY_INVALID_RESOURCE_SHA256_HEX_V1 ||
    invalidSemanticDigest !==
      PROVIDER_REGISTRY_ROOT_HISTORY_INVALID_SEMANTIC_CONTENT_DIGEST_V1
  ) {
    throw new Error(
      "provider registry root history compiled anchors are stale",
    );
  }
  const goldenValidation =
    verifyProviderRegistryRootHistoryGoldenManifestResourceV1(
      new Uint8Array(checkedGolden),
    );
  const invalidValidation =
    verifyProviderRegistryRootHistoryInvalidManifestResourceV1(
      new Uint8Array(checkedInvalid),
    );
  if (
    goldenValidation.rootMetadataHistory.length !== 3 ||
    invalidValidation.cases.length !== invalidCases.length
  ) {
    throw new Error(
      "provider registry root history fixture verification lost coverage",
    );
  }
  process.stdout.write(
    `Verified deterministic provider root history fixtures: 3 golden generations and ${invalidCases.length} invalid cases.\n`,
  );
  process.exit(0);
}

await Promise.all([
  mkdir(dirname(goldenPath), { recursive: true }),
  mkdir(dirname(invalidPath), { recursive: true }),
]);
await Promise.all([
  writeFile(goldenPath, goldenBytes),
  writeFile(invalidPath, invalidBytes),
]);
process.stdout.write(
  `Generated provider root history fixtures: 3 golden generations and ${invalidCases.length} invalid cases.\n`,
);
