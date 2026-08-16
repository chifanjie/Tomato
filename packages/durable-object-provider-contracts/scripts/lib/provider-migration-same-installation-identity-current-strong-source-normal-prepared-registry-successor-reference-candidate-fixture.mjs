/**
 * Test-only offline signer for the D-42 prepared Registry successor.
 *
 * Production code never imports this module or receives the root private key.
 */

import {
  createPrivateKey,
  sign,
} from "node:crypto";

import {
  ProviderRegistryManifestEnvelopeV1Schema,
  ProviderRegistryManifestPinV1Schema,
  ProviderRegistryManifestV1Schema,
  createProviderRegistryManifestSignatureMessageV1,
  deriveProviderRegistryManifestContentDigestV1,
  deriveProviderRegistryManifestGenerationIdV1,
} from "../../dist/provider-registry-records.js";
import {
  ProviderMigrationIdV1Schema,
} from "../../dist/primitives.js";
import {
  ProviderFeasibilitySupportCatalogEnvelopeV1Schema,
} from "../../dist/provider-feasibility-support-catalog-point.js";
import {
  deriveProviderFeasibilitySupportCatalogPinFixture,
  resignProviderFeasibilitySupportCatalogEnvelopeFixture,
} from "./provider-feasibility-support-catalog-point-fixture.mjs";
import {
  ROOT_3_SEED_HEX,
} from "./provider-registry-evidence-binding-point-fixture.mjs";

function jsonClone(value) {
  return JSON.parse(JSON.stringify(value));
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

function manifestSignature(rootKeyId, message) {
  const signature = sign(
    null,
    Buffer.from(message),
    privateKeyFromSeedHex(ROOT_3_SEED_HEX),
  ).toString("hex");
  return `provider-registry-manifest-ed25519:${rootKeyId}:${signature}`;
}

function mutateSignature(signature) {
  const last = signature.at(-1);
  return `${signature.slice(0, -1)}${last === "0" ? "1" : "0"}`;
}

function nextIssuedAt(currentIssuedAt) {
  const milliseconds = new Date(currentIssuedAt).getTime();
  if (!Number.isFinite(milliseconds)) {
    throw new TypeError("D-42 fixture current Manifest issuedAt is invalid");
  }
  return new Date(milliseconds + 1).toISOString();
}

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

export function buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedPreparedRegistrySuccessorFixture({
  distributionRawRequest,
  prospectiveDestination,
  formalMigrationId,
  invalidSignature = false,
}) {
  const currentEnvelope =
    distributionRawRequest.registryManifestHistory.at(-1);
  if (
    currentEnvelope === undefined ||
    currentEnvelope.payload.routing.state !== "steady"
  ) {
    throw new TypeError("D-42 fixture requires a retained steady Registry tip");
  }
  const current = currentEnvelope.payload;
  const enabled = current.members.filter(
    (member) => member.disposition === "enabled",
  );
  if (enabled.length !== 1) {
    throw new TypeError("D-42 fixture requires one current enabled source");
  }
  const parsedFormalMigrationId =
    ProviderMigrationIdV1Schema.parse(formalMigrationId);
  const destinationEntry = jsonClone(
    prospectiveDestination.prospectiveRegistryEntry,
  );
  if (
    current.members.some(
      (member) => member.providerId === destinationEntry.providerId,
    )
  ) {
    throw new TypeError("D-42 fixture destination is already a Registry member");
  }
  const destinationMember = {
    providerId: destinationEntry.providerId,
    disposition: "enabled",
    registryEntryContentDigest:
      prospectiveDestination.prospectiveRegistryEntryContentDigest,
    registryEntry: destinationEntry,
  };
  const members = [...jsonClone(current.members), destinationMember].sort(
    (left, right) => compareUtf8(left.providerId, right.providerId),
  );
  const predecessor = {
    state: "manifest",
    generationId: currentEnvelope.generationId,
    contentDigest: currentEnvelope.contentDigest,
  };
  const routing = {
    state: "migration",
    migrationId: parsedFormalMigrationId,
    sourceProviderId: enabled[0].providerId,
    destinationProviderId: destinationEntry.providerId,
    activeForMigrationWrites: enabled[0].providerId,
    phase: "prepared",
  };
  const idFields = {
    installationIdentityGenerationId:
      current.installationIdentityGenerationId,
    activeRootMetadata: jsonClone(current.activeRootMetadata),
    members,
    routing,
    manifestGeneration: current.manifestGeneration + 1,
    predecessor,
  };
  const generationId =
    deriveProviderRegistryManifestGenerationIdV1(idFields);
  const unsigned = {
    profile: "provider_registry_manifest_v1",
    generationId,
    installationIdentityGenerationId:
      current.installationIdentityGenerationId,
    activeRootMetadata: jsonClone(current.activeRootMetadata),
    members,
    routing,
    issuedAt: nextIssuedAt(current.issuedAt),
    manifestGeneration: current.manifestGeneration + 1,
    predecessor,
  };
  const rootKeyId = current.activeRootMetadata.rootKeyId;
  const validManifestSignature = manifestSignature(
    rootKeyId,
    createProviderRegistryManifestSignatureMessageV1(
      unsigned,
      rootKeyId,
    ),
  );
  const payload = ProviderRegistryManifestV1Schema.parse({
    ...unsigned,
    manifestSignature: invalidSignature
      ? mutateSignature(validManifestSignature)
      : validManifestSignature,
  });
  const envelope = ProviderRegistryManifestEnvelopeV1Schema.parse({
    schemaVersion: 1,
    recordType: "provider_registry_manifest",
    generationId,
    contentDigest:
      deriveProviderRegistryManifestContentDigestV1(payload),
    payload,
  });
  const pin = ProviderRegistryManifestPinV1Schema.parse({
    locatorProfile: "installation_provider_registry_manifest_v1",
    manifestGeneration: payload.manifestGeneration,
    generationId: envelope.generationId,
    contentDigest: envelope.contentDigest,
  });
  return Object.freeze({
    envelope,
    pin,
    currentSteadyRegistryManifestEnvelope: jsonClone(currentEnvelope),
    formalMigrationId: parsedFormalMigrationId,
    sourceProviderId: enabled[0].providerId,
    destinationProviderId: destinationEntry.providerId,
    invalidSignature,
  });
}

export function buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedRebindingRegistrySuccessorFixture({
  currentPreparedRegistryManifestEnvelope,
  invalidSignature = false,
}) {
  const currentEnvelope = ProviderRegistryManifestEnvelopeV1Schema.parse(
    jsonClone(currentPreparedRegistryManifestEnvelope),
  );
  const current = currentEnvelope.payload;
  if (
    current.routing.state !== "migration" ||
    current.routing.phase !== "prepared" ||
    current.routing.activeForMigrationWrites !==
      current.routing.sourceProviderId
  ) {
    throw new TypeError(
      "source-drained fixture requires the published prepared Registry tip",
    );
  }
  const routing = {
    ...jsonClone(current.routing),
    phase: "rebinding",
    activeForMigrationWrites: current.routing.destinationProviderId,
  };
  const predecessor = {
    state: "manifest",
    generationId: currentEnvelope.generationId,
    contentDigest: currentEnvelope.contentDigest,
  };
  const idFields = {
    installationIdentityGenerationId:
      current.installationIdentityGenerationId,
    activeRootMetadata: jsonClone(current.activeRootMetadata),
    members: jsonClone(current.members),
    routing,
    manifestGeneration: current.manifestGeneration + 1,
    predecessor,
  };
  const generationId =
    deriveProviderRegistryManifestGenerationIdV1(idFields);
  const unsigned = {
    profile: "provider_registry_manifest_v1",
    generationId,
    installationIdentityGenerationId:
      current.installationIdentityGenerationId,
    activeRootMetadata: jsonClone(current.activeRootMetadata),
    members: jsonClone(current.members),
    routing,
    issuedAt: nextIssuedAt(current.issuedAt),
    manifestGeneration: current.manifestGeneration + 1,
    predecessor,
  };
  const rootKeyId = current.activeRootMetadata.rootKeyId;
  const validManifestSignature = manifestSignature(
    rootKeyId,
    createProviderRegistryManifestSignatureMessageV1(
      unsigned,
      rootKeyId,
    ),
  );
  const payload = ProviderRegistryManifestV1Schema.parse({
    ...unsigned,
    manifestSignature: invalidSignature
      ? mutateSignature(validManifestSignature)
      : validManifestSignature,
  });
  const envelope = ProviderRegistryManifestEnvelopeV1Schema.parse({
    schemaVersion: 1,
    recordType: "provider_registry_manifest",
    generationId,
    contentDigest:
      deriveProviderRegistryManifestContentDigestV1(payload),
    payload,
  });
  const pin = ProviderRegistryManifestPinV1Schema.parse({
    locatorProfile: "installation_provider_registry_manifest_v1",
    manifestGeneration: payload.manifestGeneration,
    generationId: envelope.generationId,
    contentDigest: envelope.contentDigest,
  });
  return Object.freeze({
    envelope,
    pin,
    currentPreparedRegistryManifestEnvelope: currentEnvelope,
    formalMigrationId: current.routing.migrationId,
    sourceProviderId: current.routing.sourceProviderId,
    destinationProviderId: current.routing.destinationProviderId,
    invalidSignature,
  });
}

export function buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedSourceDrainedRegistrySuccessorFixture({
  currentRebindingRegistryManifestEnvelope,
  invalidSignature = false,
}) {
  const currentEnvelope = ProviderRegistryManifestEnvelopeV1Schema.parse(
    jsonClone(currentRebindingRegistryManifestEnvelope),
  );
  const current = currentEnvelope.payload;
  if (
    current.routing.state !== "migration" ||
    current.routing.phase !== "rebinding" ||
    current.routing.activeForMigrationWrites !==
      current.routing.destinationProviderId
  ) {
    throw new TypeError(
      "source-drained fixture requires the published rebinding Registry tip",
    );
  }
  const routing = {
    ...jsonClone(current.routing),
    phase: "source_drained",
    activeForMigrationWrites: current.routing.destinationProviderId,
  };
  const predecessor = {
    state: "manifest",
    generationId: currentEnvelope.generationId,
    contentDigest: currentEnvelope.contentDigest,
  };
  const idFields = {
    installationIdentityGenerationId:
      current.installationIdentityGenerationId,
    activeRootMetadata: jsonClone(current.activeRootMetadata),
    members: jsonClone(current.members),
    routing,
    manifestGeneration: current.manifestGeneration + 1,
    predecessor,
  };
  const generationId =
    deriveProviderRegistryManifestGenerationIdV1(idFields);
  const unsigned = {
    profile: "provider_registry_manifest_v1",
    generationId,
    installationIdentityGenerationId:
      current.installationIdentityGenerationId,
    activeRootMetadata: jsonClone(current.activeRootMetadata),
    members: jsonClone(current.members),
    routing,
    issuedAt: nextIssuedAt(current.issuedAt),
    manifestGeneration: current.manifestGeneration + 1,
    predecessor,
  };
  const rootKeyId = current.activeRootMetadata.rootKeyId;
  const validManifestSignature = manifestSignature(
    rootKeyId,
    createProviderRegistryManifestSignatureMessageV1(
      unsigned,
      rootKeyId,
    ),
  );
  const payload = ProviderRegistryManifestV1Schema.parse({
    ...unsigned,
    manifestSignature: invalidSignature
      ? mutateSignature(validManifestSignature)
      : validManifestSignature,
  });
  const envelope = ProviderRegistryManifestEnvelopeV1Schema.parse({
    schemaVersion: 1,
    recordType: "provider_registry_manifest",
    generationId,
    contentDigest:
      deriveProviderRegistryManifestContentDigestV1(payload),
    payload,
  });
  const pin = ProviderRegistryManifestPinV1Schema.parse({
    locatorProfile: "installation_provider_registry_manifest_v1",
    manifestGeneration: payload.manifestGeneration,
    generationId: envelope.generationId,
    contentDigest: envelope.contentDigest,
  });
  return Object.freeze({
    envelope,
    pin,
    currentRebindingRegistryManifestEnvelope: currentEnvelope,
    formalMigrationId: current.routing.migrationId,
    sourceProviderId: current.routing.sourceProviderId,
    destinationProviderId: current.routing.destinationProviderId,
    invalidSignature,
  });
}

export function buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedSteadyRegistrySuccessorFixture({
  currentSourceDrainedRegistryManifestEnvelope,
  invalidSignature = false,
}) {
  const currentEnvelope = ProviderRegistryManifestEnvelopeV1Schema.parse(
    jsonClone(currentSourceDrainedRegistryManifestEnvelope),
  );
  const current = currentEnvelope.payload;
  if (
    current.routing.state !== "migration" ||
    current.routing.phase !== "source_drained" ||
    current.routing.activeForMigrationWrites !==
      current.routing.destinationProviderId
  ) {
    throw new TypeError(
      "steady fixture requires the published source-drained Registry tip",
    );
  }
  const source = current.members.find(
    (member) => member.providerId === current.routing.sourceProviderId,
  );
  const destination = current.members.find(
    (member) => member.providerId === current.routing.destinationProviderId,
  );
  const enabled = current.members.filter(
    (member) => member.disposition === "enabled",
  );
  if (
    enabled.length !== 2 ||
    source?.disposition !== "enabled" ||
    destination?.disposition !== "enabled"
  ) {
    throw new TypeError(
      "steady fixture requires exact enabled source and destination members",
    );
  }
  const manifestGeneration = current.manifestGeneration + 1;
  const members = jsonClone(current.members).map((member) =>
    member.providerId === current.routing.sourceProviderId
      ? {
          providerId: member.providerId,
          disposition: "revoked",
          lastEnabledRegistryEntryContentDigest:
            member.registryEntryContentDigest,
          revokedAtManifestGeneration: manifestGeneration,
          reason: "migration_completed",
        }
      : member
  );
  const routing = { state: "steady" };
  const predecessor = {
    state: "manifest",
    generationId: currentEnvelope.generationId,
    contentDigest: currentEnvelope.contentDigest,
  };
  const idFields = {
    installationIdentityGenerationId:
      current.installationIdentityGenerationId,
    activeRootMetadata: jsonClone(current.activeRootMetadata),
    members,
    routing,
    manifestGeneration,
    predecessor,
  };
  const generationId =
    deriveProviderRegistryManifestGenerationIdV1(idFields);
  const unsigned = {
    profile: "provider_registry_manifest_v1",
    generationId,
    installationIdentityGenerationId:
      current.installationIdentityGenerationId,
    activeRootMetadata: jsonClone(current.activeRootMetadata),
    members,
    routing,
    issuedAt: nextIssuedAt(current.issuedAt),
    manifestGeneration,
    predecessor,
  };
  const rootKeyId = current.activeRootMetadata.rootKeyId;
  const validManifestSignature = manifestSignature(
    rootKeyId,
    createProviderRegistryManifestSignatureMessageV1(
      unsigned,
      rootKeyId,
    ),
  );
  const payload = ProviderRegistryManifestV1Schema.parse({
    ...unsigned,
    manifestSignature: invalidSignature
      ? mutateSignature(validManifestSignature)
      : validManifestSignature,
  });
  const envelope = ProviderRegistryManifestEnvelopeV1Schema.parse({
    schemaVersion: 1,
    recordType: "provider_registry_manifest",
    generationId,
    contentDigest:
      deriveProviderRegistryManifestContentDigestV1(payload),
    payload,
  });
  const pin = ProviderRegistryManifestPinV1Schema.parse({
    locatorProfile: "installation_provider_registry_manifest_v1",
    manifestGeneration: payload.manifestGeneration,
    generationId: envelope.generationId,
    contentDigest: envelope.contentDigest,
  });
  return Object.freeze({
    envelope,
    pin,
    currentSourceDrainedRegistryManifestEnvelope: currentEnvelope,
    formalMigrationId: current.routing.migrationId,
    sourceProviderId: current.routing.sourceProviderId,
    destinationProviderId: current.routing.destinationProviderId,
    invalidSignature,
  });
}

export function buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedPreparedCatalogSuccessorFixture({
  distributionRawRequest,
  prospectiveDestination,
  invalidSignature = false,
}) {
  const currentEnvelope =
    distributionRawRequest.providerFeasibilitySupportCatalogHistory.at(-1);
  if (currentEnvelope === undefined) {
    throw new TypeError("D-43 fixture requires a retained current Catalog tip");
  }
  const current = currentEnvelope.payload;
  const targetKey = JSON.stringify(prospectiveDestination.target);
  let insertedTargetCount = 0;
  const targets = jsonClone(current.targets).map((targetEntry) => {
    if (JSON.stringify(targetEntry.target) !== targetKey) return targetEntry;
    insertedTargetCount += 1;
    if (
      targetEntry.candidates.some(
        (candidate) =>
          candidate.providerId === prospectiveDestination.providerId,
      )
    ) {
      throw new TypeError("D-43 fixture destination is already a Catalog candidate");
    }
    targetEntry.candidates = [
      ...targetEntry.candidates,
      jsonClone(prospectiveDestination.prospectiveSupportCandidate),
    ].sort((left, right) => compareUtf8(left.providerId, right.providerId));
    return targetEntry;
  });
  if (insertedTargetCount !== 1) {
    throw new TypeError("D-43 fixture requires one exact destination target group");
  }
  const unsignedEnvelope = {
    schemaVersion: 1,
    recordType: "provider_feasibility_support_catalog",
    catalogGeneration: current.catalogGeneration + 1,
    contentDigest: currentEnvelope.contentDigest,
    payload: {
      ...jsonClone(current),
      catalogGeneration: current.catalogGeneration + 1,
      predecessorCatalogContentDigest: currentEnvelope.contentDigest,
      targets,
    },
  };
  const signed = resignProviderFeasibilitySupportCatalogEnvelopeFixture(
    unsignedEnvelope,
    { rootKeyId: current.registryRootKeyId },
  );
  if (invalidSignature) {
    signed.payload.catalogSignature = mutateSignature(
      signed.payload.catalogSignature,
    );
  }
  const envelope = ProviderFeasibilitySupportCatalogEnvelopeV1Schema.parse(
    signed,
  );
  return Object.freeze({
    envelope,
    pin: deriveProviderFeasibilitySupportCatalogPinFixture(envelope),
    currentSupportCatalogEnvelope: jsonClone(currentEnvelope),
    destinationProviderId: prospectiveDestination.providerId,
    invalidSignature,
  });
}
