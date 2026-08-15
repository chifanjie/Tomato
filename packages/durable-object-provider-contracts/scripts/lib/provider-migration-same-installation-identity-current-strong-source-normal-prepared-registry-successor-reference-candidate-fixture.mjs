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
