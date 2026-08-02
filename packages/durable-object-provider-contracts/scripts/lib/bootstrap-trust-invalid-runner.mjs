import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
  verify as verifyNodeEd25519,
} from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  PROVIDER_BOOTSTRAP_TRUST_BUNDLE_DOMAIN_V1,
  ProviderBootstrapTrustBundleEnvelopeV1Schema,
  ProviderBootstrapTrustStructureError,
  diagnoseProviderBootstrapTrustBundleCompiledAnchorInternalV1,
  diagnoseProviderBootstrapTrustBundleEnvelopeInternalV1,
  diagnoseProviderBootstrapTrustBundleRootClosureInternalV1,
  diagnoseProviderStrictManifestEnvelopeInternalV1,
  deriveProviderBootstrapTrustBundleContentDigestV1,
  validateProviderBootstrapTrustBundleStructureV1,
} from "../../dist/bootstrap-trust-bundle.js";
import {
  ProviderBootstrapTrustGoldenManifestV1Schema,
  diagnoseProviderBootstrapTrustGoldenCompiledAnchorInternalV1,
  diagnoseProviderBootstrapTrustGoldenResourceAnchorInternalV1,
  diagnoseProviderBootstrapTrustGoldenStaticContractInternalV1,
  verifyProviderBootstrapTrustGoldenManifestResourceV1,
} from "../../dist/bootstrap-trust-golden.js";
import {
  PROVIDER_BOOTSTRAP_TRUST_INVALID_MANIFEST_RESOURCE_PATH_V1,
  verifyProviderBootstrapTrustInvalidManifestResourceV1,
} from "../../dist/bootstrap-trust-invalid.js";
import {
  canonicalizeJcsSafeIntegerUtf8V1,
} from "../../dist/jcs.js";
import {
  PROVIDER_SIGNED_PACKAGE_IDENTITY_DOMAIN_V1,
  deriveProviderSignedPackageIdentityDigestV1,
} from "../../dist/provider-distribution-trust.js";
import {
  PROVIDER_REGISTRY_RECOVERY_KEY_ID_DOMAIN_V1,
  PROVIDER_REGISTRY_ROOT_CROSS_SIGNATURE_DOMAIN_V1,
  PROVIDER_REGISTRY_ROOT_METADATA_DOMAIN_V1,
  PROVIDER_REGISTRY_ROOT_SELF_SIGNATURE_DOMAIN_V1,
  ProviderRegistryRecoveryPublicKeyV1Schema,
  ProviderRegistryRootMetadataEnvelopeV1Schema,
  ProviderRegistryRootMetadataV1Schema,
  ProviderRegistryRootPublicKeyV1Schema,
  ProviderRegistryRootSelfSignatureV1Schema,
  createProviderRegistryRootSelfSignatureMessageV1,
  deriveProviderEd25519PublicKeyDigestInternalV1,
  deriveProviderRegistryRecoveryKeyIdInternalV1,
  deriveProviderRegistryRootKeyIdInternalV1,
  deriveProviderRegistryRootMetadataContentDigestV1,
  diagnoseProviderRegistryRecoveryPublicKeyInternalV1,
  diagnoseProviderRegistryRootMetadataEnvelopeStructureInternalV1,
  diagnoseProviderRegistryRootPublicKeyInternalV1,
  projectProviderRegistryRootMetadataUnsignedClaimsV1,
  verifyProviderRegistryRootSelfSignatureV1,
} from "../../dist/provider-registry-trust.js";
import {
  PROVIDER_STRICT_ED25519_ADVERSARIAL_MANIFEST_DOMAIN_V1,
  PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1,
  PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
  ProviderStrictEd25519AttestationError,
  attestProviderStrictEd25519CryptoHostV1,
  getProviderStrictEd25519CryptoCapabilityBytesV1,
  validateProviderStrictEd25519PointWithCapabilityV1,
} from "../../dist/strict-ed25519-conformance.js";
import {
  STRICT_ED25519_VERIFICATION_PROFILE_V1,
  validatePrimeSubgroupPoint,
  verifyRawEd25519,
} from "../../dist/strict-ed25519.js";
import {
  diagnoseExactProviderResourceEntries,
} from "./provider-resource-inventory.mjs";

const packageRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function bytesToHex(bytes) {
  return Buffer.from(bytes).toString("hex");
}

function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function domainDigest(domain, fields) {
  return `sha256:${sha256Hex(
    canonicalizeJcsSafeIntegerUtf8V1([domain, fields]),
  )}`;
}

function mutateLastHex(value) {
  return `${value.slice(0, -1)}${value.endsWith("0") ? "1" : "0"}`;
}

function deterministicKeyPair(seedHex) {
  const privateKey = createPrivateKey({
    key: Buffer.concat([
      Buffer.from("302e020100300506032b657004220420", "hex"),
      Buffer.from(seedHex, "hex"),
    ]),
    format: "der",
    type: "pkcs8",
  });
  const spki = createPublicKey(privateKey).export({
    format: "der",
    type: "spki",
  });
  const rawPublicKey = new Uint8Array(
    spki.subarray(spki.byteLength - 32),
  );
  return {
    privateKey,
    publicKey: createPublicKey(privateKey),
    rawPublicKey,
    publicKeyBytes:
      `base64url:${Buffer.from(rawPublicKey).toString("base64url")}`,
  };
}

function rootPublicKey(keyPair) {
  return ProviderRegistryRootPublicKeyV1Schema.parse({
    profile: "provider_registry_root_public_key_v1",
    rootKeyId: deriveProviderRegistryRootKeyIdInternalV1({
      publicKeyBytes: keyPair.publicKeyBytes,
    }),
    algorithm: "ed25519",
    publicKeyBytes: keyPair.publicKeyBytes,
    publicKeyDigest:
      deriveProviderEd25519PublicKeyDigestInternalV1(
        keyPair.publicKeyBytes,
      ),
  });
}

function signRootMetadata(
  keyPair,
  activeRoot,
  issuedAt = "2026-08-02T00:00:00Z",
) {
  const placeholder = ProviderRegistryRootMetadataV1Schema.parse({
    profile: "provider_registry_root_metadata_v1",
    rootGeneration: 1,
    activeRoot,
    issuedAt,
    selfSignature:
      `provider-root-self-ed25519:${activeRoot.rootKeyId}:${"0".repeat(128)}`,
    activation: "bootstrap",
    predecessor: { state: "genesis" },
    recoverySignatures: [],
  });
  const rawSignature = sign(
    null,
    createProviderRegistryRootSelfSignatureMessageV1(placeholder),
    keyPair.privateKey,
  ).toString("hex");
  const payload = ProviderRegistryRootMetadataV1Schema.parse({
    ...placeholder,
    selfSignature: ProviderRegistryRootSelfSignatureV1Schema.parse(
      `provider-root-self-ed25519:${activeRoot.rootKeyId}:${rawSignature}`,
    ),
  });
  const envelope =
    ProviderRegistryRootMetadataEnvelopeV1Schema.parse({
      schemaVersion: 1,
      recordType: "provider_registry_root_metadata",
      rootGeneration: 1,
      rootKeyId: activeRoot.rootKeyId,
      contentDigest:
        deriveProviderRegistryRootMetadataContentDigestV1(payload),
      payload,
    });
  return { envelope, payload, rawSignature };
}

function diagnosticFailure(
  diagnostic,
  label,
  boundary = "internal_diagnostic",
) {
  invariant(!diagnostic.ok, `${label} unexpectedly succeeded`);
  return {
    stage: diagnostic.stage,
    reason: diagnostic.reason,
    boundary,
  };
}

function diagnosticSuccess(diagnostic, label) {
  invariant(diagnostic.ok, `${label} failed its precondition`);
  return diagnostic.value;
}

async function expectStructureRejection(input, label) {
  let captured;
  try {
    await validateProviderBootstrapTrustBundleStructureV1(input);
  } catch (error) {
    captured = error;
  }
  invariant(
    captured instanceof ProviderBootstrapTrustStructureError,
    `${label} did not expose the public provider error`,
  );
  invariant(
    captured.code === "provider_unavailable" &&
      captured.reason === "attestation_invalid",
    `${label} exposed the wrong public provider error`,
  );
}

function assertResourceAnchor(bytes, resource, label) {
  invariant(
    bytes.byteLength === resource.resourceByteLength &&
      sha256Hex(bytes) === resource.resourceBytesSha256Hex,
    `${label} raw anchor mismatch`,
  );
}

function wrongSignatureMessage(profile, vector) {
  const fields = vector.fields;
  const claims =
    projectProviderRegistryRootMetadataUnsignedClaimsV1(fields);
  const normalWrapper = {
    rootKeyId: fields.activeRoot.rootKeyId,
    domain: PROVIDER_REGISTRY_ROOT_SELF_SIGNATURE_DOMAIN_V1,
    claims,
  };
  switch (profile) {
    case "verify_signature_over:wrapper_only":
      return canonicalizeJcsSafeIntegerUtf8V1(normalWrapper);
    case "verify_signature_over:claims_only":
      return canonicalizeJcsSafeIntegerUtf8V1(claims);
    case "verify_signature_over:domain_and_claims":
      return canonicalizeJcsSafeIntegerUtf8V1([
        PROVIDER_REGISTRY_ROOT_SELF_SIGNATURE_DOMAIN_V1,
        claims,
      ]);
    case "verify_signature_over:domain_and_strict_fields":
      return canonicalizeJcsSafeIntegerUtf8V1([
        PROVIDER_REGISTRY_ROOT_SELF_SIGNATURE_DOMAIN_V1,
        fields,
      ]);
    case "verify_signature_over:inner_outer_domain_mismatch":
      return canonicalizeJcsSafeIntegerUtf8V1([
        PROVIDER_REGISTRY_ROOT_SELF_SIGNATURE_DOMAIN_V1,
        {
          ...normalWrapper,
          domain: PROVIDER_REGISTRY_ROOT_CROSS_SIGNATURE_DOMAIN_V1,
        },
      ]);
    case "verify_signature_over:claims_include_self_signature":
      return canonicalizeJcsSafeIntegerUtf8V1([
        PROVIDER_REGISTRY_ROOT_SELF_SIGNATURE_DOMAIN_V1,
        { ...normalWrapper, claims: fields },
      ]);
    case "verify_signature_over:claims_omit_issued_at": {
      const { issuedAt: _issuedAt, ...claimsWithoutIssuedAt } = claims;
      return canonicalizeJcsSafeIntegerUtf8V1([
        PROVIDER_REGISTRY_ROOT_SELF_SIGNATURE_DOMAIN_V1,
        { ...normalWrapper, claims: claimsWithoutIssuedAt },
      ]);
    }
    case "verify_signature_over:raw_payload_only":
      return canonicalizeJcsSafeIntegerUtf8V1(fields);
    default: {
      const prefixMismatch =
        /^verify_signature_over:prefix_wrapper_key_mismatch:alternate_root_key_id=([0-9a-f]{22})$/u.exec(
          profile,
        );
      if (
        prefixMismatch === null ||
        prefixMismatch[1] === fields.activeRoot.rootKeyId
      ) {
        throw new Error(`unknown root signature witness ${profile}`);
      }
      return canonicalizeJcsSafeIntegerUtf8V1([
        PROVIDER_REGISTRY_ROOT_SELF_SIGNATURE_DOMAIN_V1,
        { ...normalWrapper, rootKeyId: prefixMismatch[1] },
      ]);
    }
  }
}

export async function runProviderBootstrapTrustInvalidManifestV1() {
  const invalidManifestBytes = new Uint8Array(
    await readFile(
      join(
        packageRoot,
        ...PROVIDER_BOOTSTRAP_TRUST_INVALID_MANIFEST_RESOURCE_PATH_V1.split(
          "/",
        ),
      ),
    ),
  );
  const invalidValidation =
    verifyProviderBootstrapTrustInvalidManifestResourceV1(
      invalidManifestBytes,
    );
  const invalidManifest = invalidValidation.manifest;
  invariant(
    invalidManifest.cases.length === 51 &&
      new Set(
        invalidManifest.cases.map(({ caseId }) => caseId),
      ).size === 51,
    "invalid manifest must contain exactly 51 unique cases",
  );
  for (const invalidCase of invalidManifest.cases) {
    for (const witness of invalidCase.witnesses) {
      invariant(
        witness.recipe.dialect ===
          "provider_bootstrap_invalid_recipe_v1" &&
          [
            witness.recipe.operation,
            ...witness.recipe.operands,
          ].join(":") === witness.profile,
        `${invalidCase.caseId} does not carry its executable recipe`,
      );
      if (
        witness.recipe.deterministicSeed.source ===
        "literal_non_production"
      ) {
        invariant(
          /^[0-9a-f]{64}$/u.test(
            witness.recipe.deterministicSeed.seedHex,
          ),
          `${invalidCase.caseId} carries an invalid literal seed`,
        );
      }
    }
  }

  const [bundleBytes, strictManifestBytes, goldenBytes] =
    await Promise.all([
      readFile(
        join(
          packageRoot,
          ...invalidManifest.baseResources.bootstrapBundle.resourcePath.split(
            "/",
          ),
        ),
      ),
      readFile(
        join(
          packageRoot,
          ...invalidManifest.baseResources.strictManifest.resourcePath.split(
            "/",
          ),
        ),
      ),
      readFile(
        join(
          packageRoot,
          ...invalidManifest.baseResources.bootstrapGolden.resourcePath.split(
            "/",
          ),
        ),
      ),
    ]);
  assertResourceAnchor(
    bundleBytes,
    invalidManifest.baseResources.bootstrapBundle,
    "bootstrap Bundle",
  );
  assertResourceAnchor(
    strictManifestBytes,
    invalidManifest.baseResources.strictManifest,
    "strict manifest",
  );
  assertResourceAnchor(
    goldenBytes,
    invalidManifest.baseResources.bootstrapGolden,
    "bootstrap golden",
  );

  const bundleEnvelope =
    ProviderBootstrapTrustBundleEnvelopeV1Schema.parse(
      JSON.parse(textDecoder.decode(bundleBytes)),
    );
  const strictManifestEnvelope = JSON.parse(
    textDecoder.decode(strictManifestBytes),
  );
  const goldenInput = JSON.parse(textDecoder.decode(goldenBytes));
  const golden =
    ProviderBootstrapTrustGoldenManifestV1Schema.parse(goldenInput);

  let pointCalls = 0;
  let verifyCalls = 0;
  const host = Object.freeze({
    verificationProfile: STRICT_ED25519_VERIFICATION_PROFILE_V1,
    validatePrimeSubgroupPoint(point) {
      pointCalls += 1;
      return validatePrimeSubgroupPoint(point);
    },
    verifyRawEd25519(publicKey, message, signature) {
      verifyCalls += 1;
      return verifyRawEd25519(publicKey, message, signature);
    },
  });
  const resourceHost = Object.freeze({
    readFixedSignedPackageResource(resourcePath, maxBytes) {
      invariant(
        resourcePath ===
          PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1 &&
          maxBytes === PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1,
        "strict capability requested an unexpected resource",
      );
      return new Uint8Array(strictManifestBytes);
    },
  });
  const strictCapability =
    await attestProviderStrictEd25519CryptoHostV1({
      host,
      resourceHost,
    });
  pointCalls = 0;
  verifyCalls = 0;
  await verifyProviderBootstrapTrustGoldenManifestResourceV1(
    new Uint8Array(goldenBytes),
    strictCapability,
  );
  await validateProviderBootstrapTrustBundleStructureV1({
    bundleEnvelopeBytes: new Uint8Array(bundleBytes),
    strictManifestEnvelopeBytes: new Uint8Array(
      strictManifestBytes,
    ),
    strictCryptoCapability: strictCapability,
  });
  pointCalls = 0;
  verifyCalls = 0;

  const foreignModule = await import(
    `../../dist/strict-ed25519-conformance.js?invalid-runner-foreign=${Date.now()}`
  );
  const foreignCapability =
    await foreignModule.attestProviderStrictEd25519CryptoHostV1({
      host: Object.freeze({
        verificationProfile:
          STRICT_ED25519_VERIFICATION_PROFILE_V1,
        validatePrimeSubgroupPoint,
        verifyRawEd25519,
      }),
      resourceHost,
    });

  const deterministicVector =
    golden.vectors.deterministicRootSelfSignatureSigning;
  const deterministicKey = deterministicKeyPair(
    deterministicVector.rfc8032TestSeedHex,
  );

  function resolveRecipeSeed(witness) {
    const seed = witness.recipe.deterministicSeed;
    if (seed.source === "none") return undefined;
    if (seed.source === "literal_non_production") {
      return seed.seedHex;
    }
    invariant(
      seed.resourcePath ===
        invalidManifest.baseResources.bootstrapGolden.resourcePath &&
        seed.jsonPointer ===
          "/vectors/deterministicRootSelfSignatureSigning/rfc8032TestSeedHex",
      `${witness.profile} carries an unknown fixture seed locator`,
    );
    return deterministicVector.rfc8032TestSeedHex;
  }

  function alternateTrustFixtureForWitness(witness) {
    invariant(
      witness.recipe.deterministicSeed.source ===
        "literal_non_production",
      `${witness.profile} does not carry its alternate trust seed`,
    );
    const seedHex = resolveRecipeSeed(witness);
    invariant(
      typeof seedHex === "string",
      `${witness.profile} lost its alternate trust seed`,
    );
    const keyPair = deterministicKeyPair(seedHex);
    const root = rootPublicKey(keyPair);
    return {
      root,
      metadata: signRootMetadata(keyPair, root),
    };
  }

  function baseInventory() {
    return [
      {
        path:
          invalidManifest.baseResources.bootstrapBundle.resourcePath,
        type: "regular",
        nlink: 1,
        bytes: new Uint8Array(bundleBytes),
      },
      {
        path:
          invalidManifest.baseResources.strictManifest.resourcePath,
        type: "regular",
        nlink: 1,
        bytes: new Uint8Array(strictManifestBytes),
      },
    ];
  }

  async function handleInventory(witness) {
    const entries = baseInventory();
    if (witness.profile.startsWith("remove:")) {
      const path = witness.profile.slice("remove:".length);
      entries.splice(
        entries.findIndex((entry) => entry.path === path),
        1,
      );
    } else if (witness.profile.startsWith("duplicate:")) {
      const path = witness.profile
        .slice("duplicate:".length)
        .replace(/:(?:byte_identical|semantic_equal_raw_distinct)$/u, "");
      const existing = entries.find((entry) => entry.path === path);
      invariant(existing !== undefined, "duplicate source is missing");
      const semanticAlias = witness.profile.endsWith(
        ":semantic_equal_raw_distinct",
      );
      entries.push({
        ...existing,
        bytes: semanticAlias
          ? new Uint8Array([...existing.bytes, 0x0a])
          : existing.bytes.slice(),
      });
    } else if (witness.profile.startsWith("add:")) {
      const { root: alternateRoot, metadata: alternateMetadata } =
        alternateTrustFixtureForWitness(witness);
      const alternateEnvelope = cloneJson(bundleEnvelope);
      alternateEnvelope.payload.bootstrapProviderRegistryRoot =
        alternateRoot;
      alternateEnvelope.payload.bootstrapProviderRegistryRootMetadata =
        alternateMetadata.envelope;
      alternateEnvelope.contentDigest =
        deriveProviderBootstrapTrustBundleContentDigestV1(
          alternateEnvelope.payload,
        );
      diagnosticSuccess(
        diagnoseProviderBootstrapTrustBundleEnvelopeInternalV1(
          alternateEnvelope,
        ),
        "alternate inventory Bundle envelope",
      );
      diagnosticSuccess(
        diagnoseProviderBootstrapTrustBundleRootClosureInternalV1(
          alternateEnvelope.payload,
        ),
        "alternate inventory Bundle closure",
      );
      entries.push({
        path:
          "provider/bootstrap-trust-bundle-alternate-v1.json",
        type: "regular",
        nlink: 1,
        bytes:
          canonicalizeJcsSafeIntegerUtf8V1(alternateEnvelope),
      });
    } else if (witness.profile.startsWith("replace_type:")) {
      const match =
        /^replace_type:(.+):(symlink|hardlink)$/u.exec(
          witness.profile,
        );
      invariant(match !== null, "invalid type replacement witness");
      const entry = entries.find(
        (candidate) => candidate.path === match[1],
      );
      invariant(entry !== undefined, "type replacement source missing");
      entry.type = match[2];
      entry.nlink = match[2] === "hardlink" ? 2 : 1;
    } else {
      throw new Error(`unknown inventory witness ${witness.profile}`);
    }
    return diagnosticFailure(
      diagnoseExactProviderResourceEntries(
        entries,
        [
          invalidManifest.baseResources.bootstrapBundle,
          invalidManifest.baseResources.strictManifest,
        ].map((resource) => ({
          path: resource.resourcePath,
          byteLength: resource.resourceByteLength,
          sha256Hex: resource.resourceBytesSha256Hex,
        })),
      ),
      witness.profile,
      "fixed_resource_loader",
    );
  }

  async function handleGoldenRawAlias() {
    const aliasBytes = textEncoder.encode(JSON.stringify(goldenInput));
    invariant(
      !Buffer.from(aliasBytes).equals(goldenBytes),
      "golden raw alias did not change bytes",
    );
    return diagnosticFailure(
      diagnoseProviderBootstrapTrustGoldenResourceAnchorInternalV1(
        aliasBytes,
      ),
      "golden raw alias",
      "fixture_verifier",
    );
  }

  async function handleGoldenCoherentAlternate() {
    const candidate = cloneJson(golden);
    candidate.fixedBundleResource.resourceBytesSha256Hex =
      "f".repeat(64);
    diagnosticSuccess(
      diagnoseProviderBootstrapTrustGoldenStaticContractInternalV1(
        candidate,
      ),
      "coherent alternate golden static contract",
    );
    return diagnosticFailure(
      diagnoseProviderBootstrapTrustGoldenCompiledAnchorInternalV1(
        ProviderBootstrapTrustGoldenManifestV1Schema.parse(
          candidate,
        ),
      ),
      "coherent alternate golden",
      "fixture_verifier",
    );
  }

  async function handleGoldenExpectedBytes() {
    const candidate = cloneJson(golden);
    candidate.vectors.signedPackageIdentityDigest.expected.sha256Hex =
      "0".repeat(64);
    return diagnosticFailure(
      diagnoseProviderBootstrapTrustGoldenStaticContractInternalV1(
        candidate,
      ),
      "golden expected bytes",
      "fixture_verifier",
    );
  }

  async function handleGoldenRecoveryReorder() {
    const candidate = cloneJson(golden);
    candidate.vectors.recoveryKeyIds.reverse();
    return diagnosticFailure(
      diagnoseProviderBootstrapTrustGoldenStaticContractInternalV1(
        candidate,
      ),
      "golden recovery order",
      "fixture_verifier",
    );
  }

  async function handleGoldenKeyAlias() {
    const candidate = cloneJson(golden);
    candidate.vectors.deterministicRootSelfSignatureSigning.expected.publicKeyBytes =
      candidate.vectors.bootstrapRootMetadataDigest.fields.activeRoot.publicKeyBytes;
    return diagnosticFailure(
      diagnoseProviderBootstrapTrustGoldenStaticContractInternalV1(
        candidate,
      ),
      "golden key alias",
      "fixture_verifier",
    );
  }

  async function handleGoldenAuthority() {
    const candidate = cloneJson(golden);
    candidate.fixtureAuthority = "strong_ready";
    return diagnosticFailure(
      diagnoseProviderBootstrapTrustGoldenStaticContractInternalV1(
        candidate,
      ),
      "golden authority substitution",
      "fixture_verifier",
    );
  }

  async function handleWrongDomainDigest(witness, caseId) {
    const wrongDomain = witness.recipe.operands.at(-1);
    if (caseId === "signed-package-wrong-domain-digest") {
      const vector = golden.vectors.signedPackageIdentityDigest;
      const wrong = domainDigest(
        wrongDomain,
        vector.fields,
      );
      invariant(
        wrong !==
          deriveProviderSignedPackageIdentityDigestV1(vector.fields) &&
          wrong !== vector.expected.contentDigest,
        "signed package wrong-domain witness was not separated",
      );
    } else if (caseId === "bundle-wrong-domain-digest") {
      const vector = golden.vectors.bootstrapTrustBundleDigest;
      const wrong = domainDigest(
        wrongDomain,
        vector.fields,
      );
      invariant(
        wrong !==
          deriveProviderBootstrapTrustBundleContentDigestV1(
            vector.fields,
          ) &&
          wrong !== vector.expected.contentDigest,
        "Bundle wrong-domain witness was not separated",
      );
    } else {
      const vector = golden.vectors.bootstrapRootMetadataDigest;
      const wrong = domainDigest(
        wrongDomain,
        vector.fields,
      );
      invariant(
        wrong !==
          deriveProviderRegistryRootMetadataContentDigestV1(
            vector.fields,
          ) &&
          wrong !== vector.expected.contentDigest,
        "root metadata wrong-domain witness was not separated",
      );
    }
    return {
      stage: "domain_separation",
      reason: "domain_separation_mismatch",
      boundary: "reference_oracle",
    };
  }

  async function handleWrongDomainSignature(witness) {
    invariant(
      resolveRecipeSeed(witness) ===
        deterministicVector.rfc8032TestSeedHex,
      "wrong-domain signature recipe lost its published seed",
    );
    const fields = cloneJson(deterministicVector.fields);
    const claims =
      projectProviderRegistryRootMetadataUnsignedClaimsV1(fields);
    const wrongMessage = canonicalizeJcsSafeIntegerUtf8V1([
      PROVIDER_REGISTRY_ROOT_CROSS_SIGNATURE_DOMAIN_V1,
      {
        rootKeyId: fields.activeRoot.rootKeyId,
        domain:
          PROVIDER_REGISTRY_ROOT_CROSS_SIGNATURE_DOMAIN_V1,
        claims,
      },
    ]);
    const rawSignature = sign(
      null,
      wrongMessage,
      deterministicKey.privateKey,
    );
    invariant(
      verifyNodeEd25519(
        null,
        wrongMessage,
        deterministicKey.publicKey,
        rawSignature,
      ),
      "wrong-domain signature is not valid under its declared witness",
    );
    fields.selfSignature =
      `provider-root-self-ed25519:${fields.activeRoot.rootKeyId}:${rawSignature.toString("hex")}`;
    invariant(
      !(await verifyProviderRegistryRootSelfSignatureV1(
        fields,
        strictCapability,
      )),
      "wrong-domain signature passed the production verifier",
    );
    return {
      stage: "root_self_signature",
      reason: "signature_invalid",
    };
  }

  async function handleKeyDomainConfusion(caseId) {
    if (caseId === "root-key-id-recovery-domain-confusion") {
      const candidate = cloneJson(
        bundleEnvelope.payload.bootstrapProviderRegistryRoot,
      );
      candidate.rootKeyId =
        deriveProviderRegistryRecoveryKeyIdInternalV1({
          publicKeyBytes: candidate.publicKeyBytes,
        });
      return diagnosticFailure(
        diagnoseProviderRegistryRootPublicKeyInternalV1(
          candidate,
        ),
        "root/recovery key ID domain confusion",
      );
    }
    const candidate = cloneJson(
      bundleEnvelope.payload.providerRegistryRecoveryKeys[0],
    );
    candidate.recoveryKeyId =
      deriveProviderRegistryRootKeyIdInternalV1({
        publicKeyBytes: candidate.publicKeyBytes,
      });
    return diagnosticFailure(
      diagnoseProviderRegistryRecoveryPublicKeyInternalV1(
        candidate,
      ),
      "recovery/root key ID domain confusion",
    );
  }

  async function handleNoncanonicalResource(caseId) {
    const noncanonical =
      caseId === "bundle-noncanonical-resource"
        ? new Uint8Array([...bundleBytes, 0x0a])
        : new Uint8Array([...strictManifestBytes, 0x0a]);
    await expectStructureRejection(
      {
        bundleEnvelopeBytes:
          caseId === "bundle-noncanonical-resource"
            ? noncanonical
            : new Uint8Array(bundleBytes),
        strictManifestEnvelopeBytes:
          caseId === "strict-manifest-noncanonical-resource"
            ? noncanonical
            : new Uint8Array(strictManifestBytes),
        strictCryptoCapability: strictCapability,
      },
      caseId,
    );
    return {
      stage:
        caseId === "bundle-noncanonical-resource"
          ? "bundle_envelope"
          : "strict_manifest",
      reason: "canonical_encoding_mismatch",
      boundary: "public_provider_error",
    };
  }

  async function handleBundleEnvelopeMutation(caseId) {
    const candidate = cloneJson(bundleEnvelope);
    if (caseId === "bundle-schema-version-substitution") {
      candidate.schemaVersion = 2;
    } else if (caseId === "bundle-record-type-substitution") {
      candidate.recordType =
        "provider_bootstrap_trust_bundle_alias";
    } else if (caseId === "bundle-outer-digest-stale") {
      candidate.contentDigest = `sha256:${"0".repeat(64)}`;
    } else if (caseId === "bundle-payload-profile-substitution") {
      candidate.payload.profile =
        "provider_bootstrap_trust_bundle_alias_v1";
    } else if (
      caseId === "bundle-capability-profile-substitution"
    ) {
      candidate.payload.strictCryptoCapability.profile = "alias_v1";
    } else if (
      caseId === "bundle-strict-manifest-pin-substitution"
    ) {
      candidate.payload.strictCryptoCapability.adversarialManifest.contentDigest =
        `sha256:${"a".repeat(64)}`;
      candidate.contentDigest =
        deriveProviderBootstrapTrustBundleContentDigestV1(
          candidate.payload,
        );
      diagnosticSuccess(
        diagnoseProviderBootstrapTrustBundleEnvelopeInternalV1(
          candidate,
        ),
        caseId,
      );
      return diagnosticFailure(
        diagnoseProviderBootstrapTrustBundleCompiledAnchorInternalV1(
          candidate,
        ),
        caseId,
      );
    } else if (caseId === "bundle-history-policy-substitution") {
      candidate.payload.providerTrustHistoryPolicy.maxRootMetadataGenerationCountPerInstallationIdentity =
        255;
    }
    const diagnostic =
      diagnoseProviderBootstrapTrustBundleEnvelopeInternalV1(
        candidate,
      );
    if (
      caseId === "bundle-payload-profile-substitution" ||
      caseId === "bundle-capability-profile-substitution"
    ) {
      const closure =
        diagnoseProviderBootstrapTrustBundleRootClosureInternalV1(
          candidate.payload,
        );
      return diagnosticFailure(closure, caseId);
    }
    return diagnosticFailure(diagnostic, caseId);
  }

  async function handleCoherentAlternateBundle(witness) {
    const { root: alternateRoot, metadata: alternateMetadata } =
      alternateTrustFixtureForWitness(witness);
    const candidate = cloneJson(bundleEnvelope);
    candidate.payload.bootstrapProviderRegistryRoot = alternateRoot;
    candidate.payload.bootstrapProviderRegistryRootMetadata =
      alternateMetadata.envelope;
    candidate.contentDigest =
      deriveProviderBootstrapTrustBundleContentDigestV1(
        candidate.payload,
      );
    diagnosticSuccess(
      diagnoseProviderBootstrapTrustBundleEnvelopeInternalV1(
        candidate,
      ),
      "coherent alternate Bundle envelope",
    );
    diagnosticSuccess(
      diagnoseProviderBootstrapTrustBundleRootClosureInternalV1(
        candidate.payload,
      ),
      "coherent alternate Bundle closure",
    );
    const anchorFailure = diagnosticFailure(
      diagnoseProviderBootstrapTrustBundleCompiledAnchorInternalV1(
        candidate,
      ),
      "coherent alternate Bundle compiled Pin",
      "public_provider_error",
    );
    await expectStructureRejection(
      {
        bundleEnvelopeBytes:
          canonicalizeJcsSafeIntegerUtf8V1(candidate),
        strictManifestEnvelopeBytes: new Uint8Array(
          strictManifestBytes,
        ),
        strictCryptoCapability: strictCapability,
      },
      "coherent alternate Bundle public boundary",
    );
    return anchorFailure;
  }

  async function handleRootMetadataClosure(witness) {
    const { metadata: alternateMetadata } =
      alternateTrustFixtureForWitness(witness);
    const candidate = cloneJson(bundleEnvelope.payload);
    candidate.bootstrapProviderRegistryRootMetadata =
      alternateMetadata.envelope;
    return diagnosticFailure(
      diagnoseProviderBootstrapTrustBundleRootClosureInternalV1(
        candidate,
      ),
      "Bundle root metadata closure",
    );
  }

  async function handleStrictManifest(caseId, witness) {
    const candidate = cloneJson(strictManifestEnvelope);
    if (caseId === "strict-manifest-version-substitution") {
      candidate.manifestVersion = 2;
    } else if (
      caseId === "strict-manifest-case-coverage-matrix"
    ) {
      if (witness.profile.startsWith("remove:")) {
        candidate.payload.cases.splice(0, 1);
      } else if (witness.profile.startsWith("append:")) {
        candidate.payload.cases.push(
          cloneJson(candidate.payload.cases.at(-1)),
        );
      } else {
        candidate.payload.cases.reverse();
      }
    } else {
      candidate.payload.cases[0].messageBytes = "base64url:AA";
      candidate.contentDigest = domainDigest(
        PROVIDER_STRICT_ED25519_ADVERSARIAL_MANIFEST_DOMAIN_V1,
        candidate.payload,
      );
    }
    return diagnosticFailure(
      diagnoseProviderStrictManifestEnvelopeInternalV1(candidate),
      caseId,
    );
  }

  async function handleMetadataEnvelope(caseId, witness) {
    const candidate = cloneJson(
      bundleEnvelope.payload.bootstrapProviderRegistryRootMetadata,
    );
    if (caseId === "metadata-outer-generation-substitution") {
      candidate.rootGeneration = 2;
    } else if (
      caseId === "metadata-outer-key-id-substitution"
    ) {
      const { root: alternateRoot } =
        alternateTrustFixtureForWitness(witness);
      candidate.rootKeyId = alternateRoot.rootKeyId;
    } else if (caseId === "metadata-outer-digest-substitution") {
      candidate.contentDigest = `sha256:${"c".repeat(64)}`;
    } else {
      const { root: alternateRoot } =
        alternateTrustFixtureForWitness(witness);
      const signatureParts =
        candidate.payload.selfSignature.split(":");
      candidate.payload.selfSignature =
        `provider-root-self-ed25519:${alternateRoot.rootKeyId}:${signatureParts[2]}`;
      candidate.contentDigest =
        deriveProviderRegistryRootMetadataContentDigestV1(
          candidate.payload,
        );
    }
    return diagnosticFailure(
      diagnoseProviderRegistryRootMetadataEnvelopeStructureInternalV1(
        candidate,
      ),
      caseId,
    );
  }

  async function handleKeyRecord(caseId, witness) {
    const isRoot =
      caseId === "root-key-id-mismatch" ||
      caseId === "root-public-key-digest-mismatch";
    const candidate = cloneJson(
      isRoot
        ? bundleEnvelope.payload.bootstrapProviderRegistryRoot
        : bundleEnvelope.payload.providerRegistryRecoveryKeys[0],
    );
    if (
      caseId === "root-key-id-mismatch" ||
      caseId === "recovery-key-id-mismatch"
    ) {
      const { root: alternateRoot } =
        alternateTrustFixtureForWitness(witness);
      if (isRoot) candidate.rootKeyId = alternateRoot.rootKeyId;
      else candidate.recoveryKeyId = alternateRoot.rootKeyId;
    } else {
      candidate.publicKeyDigest = `sha256:${"e".repeat(64)}`;
    }
    return diagnosticFailure(
      isRoot
        ? diagnoseProviderRegistryRootPublicKeyInternalV1(candidate)
        : diagnoseProviderRegistryRecoveryPublicKeyInternalV1(
            candidate,
          ),
      caseId,
    );
  }

  async function handleSignatureMessage(witness) {
    invariant(
      resolveRecipeSeed(witness) ===
        deterministicVector.rfc8032TestSeedHex,
      `${witness.profile} lost its published deterministic seed`,
    );
    const fields = cloneJson(deterministicVector.fields);
    const wrongMessage = wrongSignatureMessage(
      witness.profile,
      deterministicVector,
    );
    const correctMessage =
      createProviderRegistryRootSelfSignatureMessageV1(fields);
    invariant(
      !Buffer.from(wrongMessage).equals(
        Buffer.from(correctMessage),
      ),
      `${witness.profile} did not change the signed message`,
    );
    const rawSignature = sign(
      null,
      wrongMessage,
      deterministicKey.privateKey,
    );
    invariant(
      verifyNodeEd25519(
        null,
        wrongMessage,
        deterministicKey.publicKey,
        rawSignature,
      ),
      `${witness.profile} is not valid under its wrong message`,
    );
    fields.selfSignature =
      `provider-root-self-ed25519:${fields.activeRoot.rootKeyId}:${rawSignature.toString("hex")}`;
    invariant(
      !(await verifyProviderRegistryRootSelfSignatureV1(
        fields,
        strictCapability,
      )),
      `${witness.profile} passed the production message`,
    );
    return {
      stage: "root_self_signature",
      reason: "signature_message_mismatch",
    };
  }

  async function handleRawSignatureSubstitution() {
    const fields = cloneJson(deterministicVector.fields);
    fields.selfSignature = mutateLastHex(fields.selfSignature);
    invariant(
      !(await verifyProviderRegistryRootSelfSignatureV1(
        fields,
        strictCapability,
      )),
      "raw signature substitution passed",
    );
    return {
      stage: "root_self_signature",
      reason: "signature_invalid",
    };
  }

  async function handleRecoveryCount(witness) {
    const candidate = cloneJson(bundleEnvelope.payload);
    if (witness.profile.startsWith("remove:")) {
      candidate.providerRegistryRecoveryKeys.splice(2, 1);
    } else {
      candidate.providerRegistryRecoveryKeys.push(
        cloneJson(candidate.providerRegistryRecoveryKeys.at(-1)),
      );
    }
    return diagnosticFailure(
      diagnoseProviderBootstrapTrustBundleRootClosureInternalV1(
        candidate,
      ),
      witness.profile,
    );
  }

  async function handleRecoveryRecordMatrix(witness) {
    const candidate = cloneJson(
      bundleEnvelope.payload.providerRegistryRecoveryKeys[0],
    );
    if (witness.profile.includes("recoveryKeyId")) {
      const { root: alternateRoot } =
        alternateTrustFixtureForWitness(witness);
      candidate.recoveryKeyId = alternateRoot.rootKeyId;
    } else {
      candidate.publicKeyDigest = `sha256:${"e".repeat(64)}`;
    }
    return diagnosticFailure(
      diagnoseProviderRegistryRecoveryPublicKeyInternalV1(
        candidate,
      ),
      witness.profile,
    );
  }

  async function handleRecoveryClosureMatrix(witness) {
    const candidate = cloneJson(bundleEnvelope.payload);
    const keys = candidate.providerRegistryRecoveryKeys;
    if (witness.profile.startsWith("reverse:")) {
      keys.reverse();
    } else if (witness.profile.startsWith("alias:")) {
      keys[1] = cloneJson(keys[0]);
    } else {
      const root =
        candidate.bootstrapProviderRegistryRoot;
      keys[0] =
        ProviderRegistryRecoveryPublicKeyV1Schema.parse({
          profile: "provider_registry_recovery_public_key_v1",
          recoveryKeyId:
            deriveProviderRegistryRecoveryKeyIdInternalV1({
              publicKeyBytes: root.publicKeyBytes,
            }),
          algorithm: "ed25519",
          publicKeyBytes: root.publicKeyBytes,
          publicKeyDigest: root.publicKeyDigest,
        });
      keys.sort((left, right) =>
        left.recoveryKeyId.localeCompare(right.recoveryKeyId),
      );
    }
    return diagnosticFailure(
      diagnoseProviderBootstrapTrustBundleRootClosureInternalV1(
        candidate,
      ),
      witness.profile,
    );
  }

  async function handleMixedOrderPoint(witness) {
    const rawPublicKeyHex =
      witness.recipe.operands.at(-1);
    invariant(
      typeof rawPublicKeyHex === "string" &&
        /^[0-9a-f]{64}$/u.test(rawPublicKeyHex),
      "mixed-order point recipe lost its raw key",
    );
    const admitted =
      await validateProviderStrictEd25519PointWithCapabilityV1(
        strictCapability,
        new Uint8Array(
          Buffer.from(
            rawPublicKeyHex,
            "hex",
          ),
        ),
      );
    invariant(!admitted, "mixed-order point was admitted");
    return {
      stage: "recovery_key_closure",
      reason: "point_validation_failed",
    };
  }

  async function handleCapabilityForgery(witness) {
    let forged;
    if (witness.profile.endsWith(":plain_object")) {
      forged = Object.freeze({});
    } else if (
      witness.profile.endsWith(":proxy_of_real_capability")
    ) {
      forged = new Proxy(strictCapability, {});
    } else {
      forged = foreignCapability;
    }
    let capabilityError;
    try {
      getProviderStrictEd25519CryptoCapabilityBytesV1(forged);
    } catch (error) {
      capabilityError = error;
    }
    invariant(
      capabilityError instanceof
        ProviderStrictEd25519AttestationError &&
        capabilityError.code === "provider_unavailable" &&
        capabilityError.reason === "attestation_invalid",
      `${witness.profile} did not fail the opaque capability lookup`,
    );
    await expectStructureRejection(
      {
        bundleEnvelopeBytes: new Uint8Array(bundleBytes),
        strictManifestEnvelopeBytes: new Uint8Array(
          strictManifestBytes,
        ),
        strictCryptoCapability: forged,
      },
      witness.profile,
    );
    return {
      stage: "opaque_capability_lookup",
      reason: "opaque_capability_invalid",
      boundary: "public_provider_error",
    };
  }

  async function handleSeedPublicMismatch(witness) {
    const substitutedSeed = resolveRecipeSeed(witness);
    invariant(
      typeof substitutedSeed === "string",
      "seed/public mismatch recipe lost its seed",
    );
    const substituted = deterministicKeyPair(substitutedSeed);
    invariant(
      bytesToHex(substituted.rawPublicKey) !==
        deterministicVector.expected.rawPublicKeyHex,
      "seed substitution retained the published public key",
    );
    return {
      stage: "deterministic_fixture",
      reason: "deterministic_key_mismatch",
      boundary: "reference_oracle",
    };
  }

  async function handleSeedSignatureMismatch(witness) {
    invariant(
      resolveRecipeSeed(witness) ===
        deterministicVector.rfc8032TestSeedHex,
      "seed/signature mismatch recipe lost its published seed",
    );
    const reproduced = sign(
      null,
      Buffer.from(
        deterministicVector.expected.canonicalMessageUtf8Hex,
        "hex",
      ),
      deterministicKey.privateKey,
    ).toString("hex");
    invariant(
      reproduced === deterministicVector.expected.rawSignatureHex &&
        reproduced !==
          mutateLastHex(
            deterministicVector.expected.rawSignatureHex,
          ),
      "deterministic signature mismatch witness is not isolated",
    );
    return {
      stage: "deterministic_fixture",
      reason: "deterministic_signature_mismatch",
      boundary: "reference_oracle",
    };
  }

  async function handleCoherentAlternateDeterministic(witness) {
    const candidate = cloneJson(golden);
    const vector =
      candidate.vectors.deterministicRootSelfSignatureSigning;
    const alternateSeed = resolveRecipeSeed(witness);
    invariant(
      typeof alternateSeed === "string",
      "coherent deterministic recipe lost its seed",
    );
    const keyPair = deterministicKeyPair(alternateSeed);
    const root = rootPublicKey(keyPair);
    const signed = signRootMetadata(
      keyPair,
      root,
      vector.fields.issuedAt,
    );
    const claims =
      projectProviderRegistryRootMetadataUnsignedClaimsV1(
        signed.payload,
      );
    const signerWrapper = {
      rootKeyId: root.rootKeyId,
      domain: PROVIDER_REGISTRY_ROOT_SELF_SIGNATURE_DOMAIN_V1,
      claims,
    };
    const message =
      createProviderRegistryRootSelfSignatureMessageV1(
        signed.payload,
      );
    vector.rfc8032TestSeedHex = alternateSeed;
    vector.fields = cloneJson(signed.payload);
    vector.expected = {
      unsignedClaims: cloneJson(claims),
      signerWrapper: cloneJson(signerWrapper),
      canonicalMessageUtf8Hex: bytesToHex(message),
      sha256Hex: sha256Hex(message),
      rootKeyId: root.rootKeyId,
      publicKeyBytes: root.publicKeyBytes,
      rawPublicKeyHex: bytesToHex(keyPair.rawPublicKey),
      publicKeyDigest: root.publicKeyDigest,
      rawSignatureHex: signed.rawSignature,
      signature: signed.payload.selfSignature,
      expectedSignatureResult: "valid_non_authoritative_fixture",
    };
    ProviderBootstrapTrustGoldenManifestV1Schema.parse(candidate);
    diagnosticSuccess(
      diagnoseProviderBootstrapTrustGoldenStaticContractInternalV1(
        candidate,
      ),
      "coherent alternate deterministic vector",
    );
    invariant(
      verifyNodeEd25519(
        null,
        message,
        keyPair.publicKey,
        Buffer.from(signed.rawSignature, "hex"),
      ),
      "coherent alternate deterministic signature is invalid",
    );
    return diagnosticFailure(
      diagnoseProviderBootstrapTrustGoldenCompiledAnchorInternalV1(
        ProviderBootstrapTrustGoldenManifestV1Schema.parse(
          candidate,
        ),
      ),
      "coherent alternate deterministic manifest",
      "fixture_verifier",
    );
  }

  const handlers = {
    "bundle-resource-missing": handleInventory,
    "bundle-resource-duplicate-identical": handleInventory,
    "bundle-resource-duplicate-semantic-alias": handleInventory,
    "bundle-resource-non-regular": handleInventory,
    "strict-manifest-resource-missing": handleInventory,
    "strict-manifest-resource-duplicate": handleInventory,
    "strict-manifest-resource-non-regular": handleInventory,
    "golden-raw-semantic-alias": handleGoldenRawAlias,
    "golden-semantic-coherent-alternate":
      handleGoldenCoherentAlternate,
    "golden-expected-bytes-substitution":
      handleGoldenExpectedBytes,
    "golden-recovery-vector-reorder":
      handleGoldenRecoveryReorder,
    "golden-deterministic-fixed-key-alias":
      handleGoldenKeyAlias,
    "golden-authority-substitution": handleGoldenAuthority,
    "signed-package-wrong-domain-digest": (witness, _index, caseId) =>
      handleWrongDomainDigest(witness, caseId),
    "bundle-wrong-domain-digest": (witness, _index, caseId) =>
      handleWrongDomainDigest(witness, caseId),
    "root-metadata-wrong-domain-digest": (
      witness,
      _index,
      caseId,
    ) => handleWrongDomainDigest(witness, caseId),
    "root-self-signature-wrong-domain-valid":
      handleWrongDomainSignature,
    "root-key-id-recovery-domain-confusion": (
      _witness,
      _index,
      caseId,
    ) => handleKeyDomainConfusion(caseId),
    "recovery-key-id-root-domain-confusion": (
      _witness,
      _index,
      caseId,
    ) => handleKeyDomainConfusion(caseId),
    "bundle-noncanonical-resource": (
      _witness,
      _index,
      caseId,
    ) => handleNoncanonicalResource(caseId),
    "bundle-schema-version-substitution": (
      _witness,
      _index,
      caseId,
    ) => handleBundleEnvelopeMutation(caseId),
    "bundle-record-type-substitution": (
      _witness,
      _index,
      caseId,
    ) => handleBundleEnvelopeMutation(caseId),
    "bundle-outer-digest-stale": (
      _witness,
      _index,
      caseId,
    ) => handleBundleEnvelopeMutation(caseId),
    "bundle-coherent-alternate-compiled-pin":
      handleCoherentAlternateBundle,
    "bundle-payload-profile-substitution": (
      _witness,
      _index,
      caseId,
    ) => handleBundleEnvelopeMutation(caseId),
    "bundle-capability-profile-substitution": (
      _witness,
      _index,
      caseId,
    ) => handleBundleEnvelopeMutation(caseId),
    "bundle-strict-manifest-pin-substitution": (
      _witness,
      _index,
      caseId,
    ) => handleBundleEnvelopeMutation(caseId),
    "bundle-history-policy-substitution": (
      _witness,
      _index,
      caseId,
    ) => handleBundleEnvelopeMutation(caseId),
    "bundle-root-metadata-closure-substitution":
      handleRootMetadataClosure,
    "strict-manifest-noncanonical-resource": (
      _witness,
      _index,
      caseId,
    ) => handleNoncanonicalResource(caseId),
    "strict-manifest-version-substitution": (
      witness,
      _index,
      caseId,
    ) => handleStrictManifest(caseId, witness),
    "strict-manifest-case-coverage-matrix": (
      witness,
      _index,
      caseId,
    ) => handleStrictManifest(caseId, witness),
    "strict-manifest-compiled-digest-substitution": (
      witness,
      _index,
      caseId,
    ) => handleStrictManifest(caseId, witness),
    "metadata-outer-generation-substitution": (
      witness,
      _index,
      caseId,
    ) => handleMetadataEnvelope(caseId, witness),
    "metadata-outer-key-id-substitution": (
      witness,
      _index,
      caseId,
    ) => handleMetadataEnvelope(caseId, witness),
    "metadata-outer-digest-substitution": (
      witness,
      _index,
      caseId,
    ) => handleMetadataEnvelope(caseId, witness),
    "metadata-self-signature-key-id-substitution": (
      witness,
      _index,
      caseId,
    ) => handleMetadataEnvelope(caseId, witness),
    "root-key-id-mismatch": (witness, _index, caseId) =>
      handleKeyRecord(caseId, witness),
    "root-public-key-digest-mismatch": (
      witness,
      _index,
      caseId,
    ) => handleKeyRecord(caseId, witness),
    "recovery-key-id-mismatch": (witness, _index, caseId) =>
      handleKeyRecord(caseId, witness),
    "recovery-public-key-digest-mismatch": (
      witness,
      _index,
      caseId,
    ) => handleKeyRecord(caseId, witness),
    "root-self-signature-message-matrix":
      handleSignatureMessage,
    "root-self-signature-raw-substitution":
      handleRawSignatureSubstitution,
    "recovery-count-matrix": handleRecoveryCount,
    "recovery-id-digest-substitution-matrix":
      handleRecoveryRecordMatrix,
    "recovery-order-duplicate-alias-matrix":
      handleRecoveryClosureMatrix,
    "recovery-mixed-order-point": handleMixedOrderPoint,
    "opaque-capability-forgery-matrix":
      handleCapabilityForgery,
    "deterministic-seed-public-mismatch":
      handleSeedPublicMismatch,
    "deterministic-seed-signature-mismatch":
      handleSeedSignatureMismatch,
    "deterministic-coherent-alternate":
      handleCoherentAlternateDeterministic,
  };

  const caseIds = invalidManifest.cases.map(({ caseId }) => caseId);
  invariant(
    JSON.stringify(Object.keys(handlers)) ===
      JSON.stringify(caseIds),
    "invalid runner handler order/coverage differs from the exact manifest",
  );
  let witnessCount = 0;
  for (const invalidCase of invalidManifest.cases) {
    const handler = handlers[invalidCase.caseId];
    invariant(
      typeof handler === "function",
      `missing invalid handler ${invalidCase.caseId}`,
    );
    for (const [index, witness] of invalidCase.witnesses.entries()) {
      pointCalls = 0;
      verifyCalls = 0;
      const actual = await handler(
        witness,
        index,
        invalidCase.caseId,
      );
      invariant(
        actual.stage === witness.stage &&
          actual.reason === witness.reason,
        `${invalidCase.caseId}/${witness.profile} rejected as ${actual.stage}/${actual.reason}, expected ${witness.stage}/${witness.reason}`,
      );
      invariant(
        (actual.boundary ?? "internal_diagnostic") ===
          witness.boundary,
        `${invalidCase.caseId}/${witness.profile} executed at ${actual.boundary ?? "internal_diagnostic"}, expected ${witness.boundary}`,
      );
      invariant(
        pointCalls === witness.postAttestationPointCalls &&
          verifyCalls === witness.postAttestationVerifyCalls,
        `${invalidCase.caseId}/${witness.profile} used ${pointCalls}/${verifyCalls} post-attestation host calls, expected ${witness.postAttestationPointCalls}/${witness.postAttestationVerifyCalls}`,
      );
      witnessCount += 1;
    }
  }

  return Object.freeze({
    caseCount: invalidManifest.cases.length,
    witnessCount,
    authority: invalidValidation.authority,
  });
}
