import { createPrivateKey, sign } from "node:crypto";

import { canonicalizeJcsSafeIntegerUtf8V1 } from "../../dist/jcs.js";
import {
  ProviderFeasibilitySupportCatalogEnvelopeV1Schema,
} from "../../dist/provider-feasibility-support-catalog-point.js";
import {
  ProviderRegistryManifestEnvelopeV1Schema,
  ProviderRegistryManifestV1Schema,
  StoreDurableObjectProviderRegistryEntryV1Schema,
  createProviderRegistryManifestSignatureMessageV1,
  createStoreDurableObjectProviderRegistryEntrySignatureMessageV1,
  deriveProviderRegistryManifestContentDigestV1,
  deriveProviderRegistryManifestGenerationIdV1,
  deriveStoreDurableObjectProviderRegistryEntryContentDigestV1,
  projectStoreDurableObjectProviderRegistryEntryUnsignedClaimsV1,
} from "../../dist/provider-registry-records.js";
import {
  deriveStoreDurableObjectProviderPolicyDigestV1,
} from "../../dist/provider-runtime-attestation-point.js";
import {
  buildProviderFeasibilitySupportCandidateFixture,
  resignProviderFeasibilitySupportCatalogEnvelopeFixture,
} from "./provider-feasibility-support-catalog-point-fixture.mjs";
import {
  NATIVE_B_PROVIDER_ID,
  ROOT_3_SEED_HEX,
  buildCompatibleBaseFixture,
} from "./provider-registry-evidence-binding-point-fixture.mjs";
import {
  buildSignedUniverseEnvelope,
} from "./provider-release-target-universe-point-fixture.mjs";
import {
  buildGoldenTargetDiscoveryPointFixture,
} from "./provider-target-discovery-point-fixture.mjs";

function jsonClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function canonicalEqual(left, right) {
  return Buffer.from(canonicalizeJcsSafeIntegerUtf8V1(left)).equals(
    Buffer.from(canonicalizeJcsSafeIntegerUtf8V1(right)),
  );
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

function rawSignatureHex(seedHex, message) {
  return sign(
    null,
    Buffer.from(message),
    privateKeyFromSeedHex(seedHex),
  ).toString("hex");
}

function registryEntrySignature(rootKeyId, message) {
  return `provider-registry-ed25519:${rootKeyId}:${rawSignatureHex(
    ROOT_3_SEED_HEX,
    message,
  )}`;
}

function registryManifestSignature(rootKeyId, message) {
  return `provider-registry-manifest-ed25519:${rootKeyId}:${rawSignatureHex(
    ROOT_3_SEED_HEX,
    message,
  )}`;
}

function enabledNativeBMember(manifestEnvelope) {
  const matches = manifestEnvelope.payload.members.filter(
    (member) =>
      member.providerId === NATIVE_B_PROVIDER_ID &&
      member.disposition === "enabled",
  );
  if (matches.length !== 1) {
    throw new TypeError(
      "strong-ready fixture requires one enabled native-b Registry member",
    );
  }
  return matches[0];
}

function rebuildNativeBRegistryEntry(
  compatible,
  catalogCandidate,
  activeRoot,
) {
  const oldTip = compatible.registryManifestHistory.at(-1);
  if (oldTip === undefined) {
    throw new TypeError("strong-ready fixture Registry history is empty");
  }
  const oldEntry = enabledNativeBMember(oldTip).registryEntry;
  const semanticProviderPolicyDigest =
    deriveStoreDurableObjectProviderPolicyDigestV1(
      catalogCandidate.semanticProviderPolicy,
    );
  const draft = {
    ...jsonClone(oldEntry),
    semanticProviderPolicyDigest,
    providerFeasibilityEvidence: jsonClone(
      catalogCandidate.providerFeasibilityEvidence,
    ),
    runtimeAttestation: jsonClone(catalogCandidate.runtimeAttestation),
  };
  const unsigned =
    projectStoreDurableObjectProviderRegistryEntryUnsignedClaimsV1(draft);
  if (
    unsigned.providerId !== NATIVE_B_PROVIDER_ID ||
    unsigned.registryRootKeyId !== activeRoot.rootKeyId
  ) {
    throw new TypeError(
      "strong-ready fixture Registry Entry root/provider binding drifted",
    );
  }
  const message =
    createStoreDurableObjectProviderRegistryEntrySignatureMessageV1(
      unsigned,
      activeRoot.rootKeyId,
    );
  const entry = StoreDurableObjectProviderRegistryEntryV1Schema.parse({
    ...unsigned,
    registrySignature: registryEntrySignature(
      activeRoot.rootKeyId,
      message,
    ),
  });
  return {
    entry,
    contentDigest:
      deriveStoreDurableObjectProviderRegistryEntryContentDigestV1(entry),
  };
}

function rebuildRegistryManifest(
  originalEnvelope,
  predecessorEnvelope,
  nativeBEntry,
) {
  let replacementCount = 0;
  const members = originalEnvelope.payload.members.map((member) => {
    if (
      member.providerId !== NATIVE_B_PROVIDER_ID ||
      member.disposition !== "enabled"
    ) {
      return jsonClone(member);
    }
    replacementCount += 1;
    return {
      providerId: NATIVE_B_PROVIDER_ID,
      disposition: "enabled",
      registryEntryContentDigest: nativeBEntry.contentDigest,
      registryEntry: jsonClone(nativeBEntry.entry),
    };
  });
  if (replacementCount !== 1) {
    throw new TypeError(
      "strong-ready fixture Registry successor lost native-b",
    );
  }

  const predecessor = predecessorEnvelope === undefined
    ? { state: "genesis" }
    : {
        state: "manifest",
        generationId: predecessorEnvelope.generationId,
        contentDigest: predecessorEnvelope.contentDigest,
      };
  const original = originalEnvelope.payload;
  const idFields = {
    installationIdentityGenerationId:
      original.installationIdentityGenerationId,
    activeRootMetadata: jsonClone(original.activeRootMetadata),
    members,
    routing: jsonClone(original.routing),
    manifestGeneration: original.manifestGeneration,
    predecessor,
  };
  const generationId = deriveProviderRegistryManifestGenerationIdV1(idFields);
  const unsigned = {
    profile: "provider_registry_manifest_v1",
    generationId,
    installationIdentityGenerationId:
      original.installationIdentityGenerationId,
    activeRootMetadata: jsonClone(original.activeRootMetadata),
    members,
    routing: jsonClone(original.routing),
    issuedAt: original.issuedAt,
    manifestGeneration: original.manifestGeneration,
    predecessor,
  };
  const rootKeyId = original.activeRootMetadata.rootKeyId;
  const message = createProviderRegistryManifestSignatureMessageV1(
    unsigned,
    rootKeyId,
  );
  const payload = ProviderRegistryManifestV1Schema.parse({
    ...unsigned,
    manifestSignature: registryManifestSignature(rootKeyId, message),
  });
  return ProviderRegistryManifestEnvelopeV1Schema.parse({
    schemaVersion: 1,
    recordType: "provider_registry_manifest",
    generationId,
    contentDigest: deriveProviderRegistryManifestContentDigestV1(payload),
    payload,
  });
}

function rebuildRegistryHistory(compatible, nativeBEntry) {
  const original = compatible.registryManifestHistory;
  if (original.length < 3) {
    throw new TypeError(
      "strong-ready fixture requires the frozen three-root Registry topology",
    );
  }
  const history = [jsonClone(original[0]), jsonClone(original[1])];
  for (let index = 2; index < original.length; index += 1) {
    history.push(
      rebuildRegistryManifest(
        original[index],
        history[index - 1],
        nativeBEntry,
      ),
    );
  }
  return history;
}

function buildSingleTargetCatalog(
  discovery,
  releaseTargetUniverse,
  candidate,
  registryEntry,
) {
  const universeTarget = releaseTargetUniverse.payload.targets[0];
  if (
    universeTarget === undefined ||
    releaseTargetUniverse.payload.targets.length !== 1
  ) {
    throw new TypeError(
      "strong-ready fixture Universe is not exact single-target",
    );
  }
  const unsigned = {
    profile: "provider_feasibility_support_catalog_v1",
    distributionRootBinding: jsonClone(discovery.distributionRootBinding),
    activeRootMetadata: jsonClone(discovery.activeRootMetadata),
    registryRootKeyId: discovery.activeRoot.rootKeyId,
    catalogGeneration: 1,
    feasibilityApprovalKeys: jsonClone(
      registryEntry.entry.feasibilityApprovalKeys,
    ),
    publicSupportTaxonomy: jsonClone(
      releaseTargetUniverse.payload.publicSupportTaxonomy,
    ),
    releaseTargetUniverse: {
      locatorProfile: "distribution_provider_release_target_universe_v1",
      universeGeneration: releaseTargetUniverse.universeGeneration,
      contentDigest: releaseTargetUniverse.contentDigest,
    },
    targets: [
      {
        target: jsonClone(universeTarget.target),
        candidates: [jsonClone(candidate.catalogCandidate)],
      },
    ],
  };
  return ProviderFeasibilitySupportCatalogEnvelopeV1Schema.parse(
    resignProviderFeasibilitySupportCatalogEnvelopeFixture(
      {
        schemaVersion: 1,
        recordType: "provider_feasibility_support_catalog",
        catalogGeneration: 1,
        contentDigest: `sha256:${"0".repeat(64)}`,
        payload: unsigned,
      },
      {
        rootKeyId: discovery.activeRoot.rootKeyId,
        rootSeedHex: ROOT_3_SEED_HEX,
      },
    ),
  );
}

/**
 * Build an Acceptance-only C09 current-candidate request without changing the
 * frozen multi-target Catalog/Distribution fixtures. The returned value is a
 * plain 15-field raw request and intentionally omits the opaque crypto
 * capability, which the caller must add at materialization time.
 */
export function buildProviderStrongReadyAcceptanceSingleTargetRawRequestFixture({
  rootGolden,
  registryGolden,
  sourceGolden,
}) {
  const builtCompatible = buildCompatibleBaseFixture({
    rootGolden,
    registryGolden,
    sourceGolden,
  });
  const compatible = builtCompatible.compatibleBase;
  const registeredTargetProfileId =
    builtCompatible.evidence.envelope.payload.target.targetProfileId;
  const registeredTargets =
    builtCompatible.discovery.releaseMatrix.payload.targets.filter(
      (entry) => entry.target.targetProfileId === registeredTargetProfileId,
    );
  if (registeredTargets.length !== 1) {
    throw new TypeError(
      "strong-ready fixture cannot resolve the registered target uniquely",
    );
  }

  const discovery = buildGoldenTargetDiscoveryPointFixture(
    builtCompatible.source,
    {
      emptyObservationManifests: true,
      targets: [jsonClone(registeredTargets[0])],
    },
  );
  const releaseTargetUniverse = buildSignedUniverseEnvelope(discovery);
  const candidate = buildProviderFeasibilitySupportCandidateFixture({
    discovery,
    targetProfileId: registeredTargetProfileId,
    qaApproverPublicKey: builtCompatible.qaApproverPublicKey,
    releaseApproverPublicKey: builtCompatible.releaseApproverPublicKey,
    providerId: NATIVE_B_PROVIDER_ID,
    result: "passed",
    releaseDisposition: "strong_read_write",
    rootSeedHex: ROOT_3_SEED_HEX,
  });
  const nativeBEntry = rebuildNativeBRegistryEntry(
    builtCompatible,
    candidate.catalogCandidate,
    discovery.activeRoot,
  );
  const registryManifestHistory = rebuildRegistryHistory(
    compatible,
    nativeBEntry,
  );
  const catalog = buildSingleTargetCatalog(
    discovery,
    releaseTargetUniverse,
    candidate,
    nativeBEntry,
  );

  const tip = registryManifestHistory.at(-1);
  if (tip === undefined) {
    throw new TypeError("strong-ready fixture rebuilt an empty Registry");
  }
  const tipEntry = enabledNativeBMember(tip).registryEntry;
  if (
    !canonicalEqual(
      tipEntry.providerFeasibilityEvidence,
      candidate.catalogCandidate.providerFeasibilityEvidence,
    ) ||
    !canonicalEqual(
      tipEntry.runtimeAttestation,
      candidate.catalogCandidate.runtimeAttestation,
    )
  ) {
    throw new TypeError(
      "strong-ready fixture Registry/Catalog exact binding failed",
    );
  }

  return jsonClone({
    bootstrapTrustBundle: compatible.bootstrapTrustBundle,
    distributionRootBinding: discovery.distributionRootBinding,
    installationIdentityGenerationId:
      compatible.installationIdentityGenerationId,
    providerFeasibilitySupportCandidateArtifacts: [
      candidate.candidateArtifact,
    ],
    providerFeasibilitySupportCatalogHistory: [catalog],
    publicSupportTaxonomyHistory: [discovery.publicSupportTaxonomy],
    realFilesystemFixtureCorpusManifests: [
      discovery.fixtureCorpusManifest,
    ],
    realFilesystemSuiteManifests: [discovery.suiteManifest],
    registryManifestHistory,
    releaseMatrixHistory: [discovery.releaseMatrix],
    releaseTargetUniverseHistory: [releaseTargetUniverse],
    rootMetadataHistory: compatible.rootMetadataHistory,
    targetDiscoveryFixtureManifests: [
      discovery.targetDiscoveryFixtureManifest,
    ],
    targetDiscoveryResultHistory: [discovery.targetDiscoveryResult],
    targetDiscoveryRunnerRuns: [discovery.targetDiscoveryRunnerRun],
  });
}
