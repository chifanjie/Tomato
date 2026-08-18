import { createHash, createHmac } from "node:crypto";
import {
  chmod,
  mkdir,
  mkdtemp,
  realpath,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import {
  INSTALLATION_IDENTITY_GENERATION_DOMAIN_V1,
  INSTALLATION_IDENTITY_KEY_CHECK_DOMAIN_V1,
} from "@understand-code/durable-object-provider-contracts";

import { canonicalizeJcsSafeIntegerV1 } from "@understand-code/durable-object-provider-contracts/jcs";
import {
  InstallationIdentityGenerationIdV1Schema,
  KeyedStateTokenV1Schema,
  LowerHex32V1Schema,
} from "@understand-code/durable-object-provider-contracts/primitives";
import {
  PROVIDER_ACCEPTANCE_STATE_TOKEN_DOMAIN_V1,
  ProviderStrongReadyAcceptanceGenerationPinCandidateV1Schema,
  ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema,
  deriveProviderStrongReadyAcceptanceStateContentDigestV1,
  deriveProviderStrongReadyAcceptanceStateGenerationIdV1,
  type ProviderAcceptancePredecessorV1,
  type ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1,
} from "@understand-code/durable-object-provider-contracts/provider-strong-ready-acceptance-candidate";
import {
  mintProviderServiceInstallationIdentityVerificationCapabilityInternalV1,
} from "@understand-code/durable-object-provider-contracts/provider-service-installation-identity-custody-internal";

import {
  PROVIDER_INSTALLATION_ACCEPTANCE_STORE_SUBSTRATE_GENERATION_PROFILE_V1,
  PROVIDER_INSTALLATION_ACCEPTANCE_STORE_SUBSTRATE_HEAD_PROFILE_V1,
  deriveProviderInstallationAcceptanceStoreSubstrateGenerationSetDigestV1,
  diagnoseProviderInstallationAcceptanceStoreSubstrateCurrentV1,
  diagnoseProviderInstallationAcceptanceStoreSubstrateExpectedCurrentV1,
  mintProviderInstallationAcceptanceStoreSubstrateReaderCapabilityV1,
} from "../src/installation-acceptance-store-substrate.js";

const digestV1 = (nibble: string) => `sha256:${nibble.repeat(64)}` as const;
const INITIALIZATION_NONCE = LowerHex32V1Schema.parse(
  "000102030405060708090a0b0c0d0e0f",
);
const INSTALLATION_IDENTITY_KEY = new Uint8Array(
  Array.from({ length: 32 }, (_value, index) => index),
);
const FOREIGN_INSTALLATION_IDENTITY_KEY = new Uint8Array(
  Array.from({ length: 32 }, (_value, index) => 255 - index),
);
const INSTALLATION_IDENTITY = InstallationIdentityGenerationIdV1Schema.parse(
  `installation-identity-generation:${createHash("sha256")
    .update(canonicalizeJcsSafeIntegerV1([
      INSTALLATION_IDENTITY_GENERATION_DOMAIN_V1,
      { initializationNonce: INITIALIZATION_NONCE },
    ]))
    .digest("hex")
    .slice(0, 22)}`,
);
const PROVIDER_ID = "durable-object-provider:acceptance-store-substrate-test";
const TARGET_PROFILE_ID = `provider-target-profile:${"4".repeat(64)}`;

let rootsV1: string[] = [];

function keyedTokenV1(
  domain: string,
  fields: object,
  key: Uint8Array,
) {
  return KeyedStateTokenV1Schema.parse(
    `hmac-sha256:${createHmac("sha256", key)
      .update(canonicalizeJcsSafeIntegerV1([domain, fields]))
      .digest("hex")}`,
  );
}

function mintIdentityCapabilityV1(
  key: Uint8Array = INSTALLATION_IDENTITY_KEY,
) {
  return mintProviderServiceInstallationIdentityVerificationCapabilityInternalV1({
    installationIdentityKey: key.slice(),
    initializationNonce: INITIALIZATION_NONCE,
    installationIdentityGenerationId: INSTALLATION_IDENTITY,
    keyCheckToken: keyedTokenV1(
      INSTALLATION_IDENTITY_KEY_CHECK_DOMAIN_V1,
      {
        generationId: INSTALLATION_IDENTITY,
        initializationNonce: INITIALIZATION_NONCE,
      },
      key,
    ),
  });
}

function configurationV1() {
  return {
    state: "strong_ready" as const,
    core: {
      activeRootMetadata: {
        locatorProfile:
          "installation_provider_registry_root_metadata_v1" as const,
        rootGeneration: 1,
        rootKeyId: "1".repeat(22),
        contentDigest: digestV1("1"),
      },
      providerRegistryManifest: {
        locatorProfile:
          "installation_provider_registry_manifest_v1" as const,
        manifestGeneration: 1,
        generationId: `provider-registry-manifest:${"2".repeat(22)}`,
        contentDigest: digestV1("2"),
      },
      providerSupportCatalog: {
        locatorProfile:
          "distribution_provider_feasibility_support_catalog_v1" as const,
        catalogGeneration: 1,
        contentDigest: digestV1("3"),
      },
      activeWriterSelector: {
        profile: "provider_active_writer_selector_v1" as const,
        selections: [{
          targetProfileId: TARGET_PROFILE_ID,
          providerId: PROVIDER_ID,
          registryEntryContentDigest: digestV1("5"),
          semanticProviderPolicyDigest: digestV1("6"),
          providerFeasibilityEvidence: {
            locatorProfile:
              "installation_provider_feasibility_evidence_v1" as const,
            evidenceId: `provider-feasibility-evidence:${"7".repeat(22)}`,
            contentDigest: digestV1("7"),
          },
          runtimeAttestationContentDigest: digestV1("8"),
          bindingDerivationKeyGeneration: 1,
        }],
      },
    },
    activation: { origin: "bootstrap_or_steady_successor" as const },
  };
}

function envelopeV1(
  acceptanceOrdinal: number,
  predecessor: ProviderAcceptancePredecessorV1,
  installationIdentityKey: Uint8Array,
): ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1 {
  const configuration = configurationV1();
  const generationId = deriveProviderStrongReadyAcceptanceStateGenerationIdV1({
    installationIdentityGenerationId: INSTALLATION_IDENTITY,
    acceptanceOrdinal,
    predecessor,
    configuration,
  });
  const unsigned = {
    profile: "provider_acceptance_state_v1" as const,
    generationId,
    installationIdentityGenerationId: INSTALLATION_IDENTITY,
    acceptanceOrdinal,
    predecessor,
    configuration,
    acceptedAt: `2026-08-18T09:00:0${acceptanceOrdinal - 1}Z`,
  };
  const payload = {
    ...unsigned,
    acceptanceToken: keyedTokenV1(
      PROVIDER_ACCEPTANCE_STATE_TOKEN_DOMAIN_V1,
      unsigned,
      installationIdentityKey,
    ),
  };
  return ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema.parse({
    schemaVersion: 1,
    recordType: "provider_acceptance_state",
    generationId,
    installationIdentityGenerationId: INSTALLATION_IDENTITY,
    acceptedAt: payload.acceptedAt,
    contentDigest: deriveProviderStrongReadyAcceptanceStateContentDigestV1(
      payload,
    ),
    payload,
  });
}

function envelopesV1(
  count: number,
  installationIdentityKey: Uint8Array = INSTALLATION_IDENTITY_KEY,
) {
  const values: ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1[] = [];
  for (let index = 0; index < count; index += 1) {
    const previous = values[index - 1];
    values.push(envelopeV1(
      index + 1,
      previous === undefined
        ? { state: "genesis" }
        : {
            state: "acceptance",
            generationId: previous.generationId,
            contentDigest: previous.contentDigest,
          },
      installationIdentityKey,
    ));
  }
  return values;
}

function canonicalFileV1(value: unknown): string {
  return `${canonicalizeJcsSafeIntegerV1(value)}\n`;
}

async function writeSnapshotV1(
  authorityRoot: string,
  envelopes: readonly ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1[],
): Promise<void> {
  const generationsRoot = join(authorityRoot, "generations");
  await mkdir(generationsRoot, { recursive: true, mode: 0o700 });
  await chmod(authorityRoot, 0o700);
  await chmod(generationsRoot, 0o700);
  for (let index = 0; index < envelopes.length; index += 1) {
    const envelope = envelopes[index]!;
    const path = join(
      generationsRoot,
      `${String(index + 1).padStart(16, "0")}.json`,
    );
    await chmod(path, 0o600).catch(() => undefined);
    await writeFile(path, canonicalFileV1({
      schemaVersion: 1,
      profile:
        PROVIDER_INSTALLATION_ACCEPTANCE_STORE_SUBSTRATE_GENERATION_PROFILE_V1,
      installationIdentityGenerationId: INSTALLATION_IDENTITY,
      envelope,
    }), { mode: 0o600 });
    await chmod(path, 0o400);
  }
  const enumeration = envelopes.map((envelope) => ({
    acceptanceOrdinal: envelope.payload.acceptanceOrdinal,
    generationId: envelope.generationId,
    contentDigest: envelope.contentDigest,
    predecessor: envelope.payload.predecessor,
  }));
  const current = envelopes.at(-1)!;
  const currentAcceptance =
    ProviderStrongReadyAcceptanceGenerationPinCandidateV1Schema.parse({
      locatorProfile: "installation_provider_acceptance_state_v1",
      acceptanceOrdinal: current.payload.acceptanceOrdinal,
      generationId: current.generationId,
      contentDigest: current.contentDigest,
    });
  await writeFile(join(authorityRoot, "current.json"), canonicalFileV1({
    schemaVersion: 1,
    profile: PROVIDER_INSTALLATION_ACCEPTANCE_STORE_SUBSTRATE_HEAD_PROFILE_V1,
    installationIdentityGenerationId: INSTALLATION_IDENTITY,
    highWaterRevision: envelopes.length,
    generationCount: envelopes.length,
    generationSetDigest:
      deriveProviderInstallationAcceptanceStoreSubstrateGenerationSetDigestV1(
        INSTALLATION_IDENTITY,
        enumeration,
      ),
    currentAcceptance,
  }), { mode: 0o600 });
  await chmod(join(authorityRoot, "current.json"), 0o600);
}

async function fixtureRootV1(
  count: number,
  installationIdentityKey: Uint8Array = INSTALLATION_IDENTITY_KEY,
): Promise<{
  authorityRoot: string;
  envelopes: readonly ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1[];
}> {
  const authorityRoot = await realpath(await mkdtemp(
    join(tmpdir(), "understand-code-acceptance-authority-"),
  ));
  rootsV1.push(authorityRoot);
  const envelopes = envelopesV1(count, installationIdentityKey);
  await writeSnapshotV1(authorityRoot, envelopes);
  return { authorityRoot, envelopes };
}

function readerInputV1(
  authorityRoot: string,
  identityVerificationCapability: Awaited<
    ReturnType<typeof mintIdentityCapabilityV1>
  >,
) {
  return {
    authorityRoot,
    expectedAuthorityUid: process.getuid!(),
    expectedAuthorityGid: process.getgid!(),
    identityVerificationCapability,
  };
}

afterEach(async () => {
  const current = rootsV1;
  rootsV1 = [];
  await Promise.all(current.map((root) => rm(root, {
    recursive: true,
    force: true,
  })));
});

describe.skipIf(
  process.getuid === undefined || process.getgid === undefined,
)("Installation Acceptance durable-store substrate", () => {
  it("verifies a complete token-bound enumeration through an opaque reader and remains locked", async () => {
    const fixture = await fixtureRootV1(2);
    const identityCapability = await mintIdentityCapabilityV1();
    const reader =
      await mintProviderInstallationAcceptanceStoreSubstrateReaderCapabilityV1(
        readerInputV1(fixture.authorityRoot, identityCapability),
      );
    const current = fixture.envelopes.at(-1)!;

    await expect(
      diagnoseProviderInstallationAcceptanceStoreSubstrateCurrentV1(reader),
    ).resolves.toMatchObject({
      ok: true,
      value: {
        status: "installation_acceptance_store_substrate_candidate",
        authority: "none",
        accessMode: "read_only",
        strongWriteStatus: "locked",
        headSemantics:
          "filesystem_pointer_not_contract_high_water_envelope",
        rollbackResistance: "process_observed_high_water_only",
        crossRestartRollbackResistance: "not_established",
        completeEnumerationStatus: "verified",
        bindings: {
          generationCount: 2,
          highWaterRevision: 2,
          acceptanceOrdinal: 2,
          acceptanceGenerationId: current.generationId,
          acceptanceContentDigest: current.contentDigest,
        },
      },
    });
    await expect(
      diagnoseProviderInstallationAcceptanceStoreSubstrateExpectedCurrentV1(
        reader,
        {
          installationIdentityGenerationId: INSTALLATION_IDENTITY,
          acceptanceOrdinal: 2,
          acceptanceGenerationId: current.generationId,
          acceptanceContentDigest: current.contentDigest,
        },
      ),
    ).resolves.toMatchObject({ ok: true });
    expect(Object.keys(reader)).toEqual([]);
  });

  it("rejects a foreign-key Acceptance token behind the opaque failure", async () => {
    const invalidToken = await fixtureRootV1(
      1,
      FOREIGN_INSTALLATION_IDENTITY_KEY,
    );
    const identityCapability = await mintIdentityCapabilityV1();
    await expect(
      mintProviderInstallationAcceptanceStoreSubstrateReaderCapabilityV1(
        readerInputV1(invalidToken.authorityRoot, identityCapability),
      ),
    ).rejects.toThrow(/^Installation Acceptance store is unavailable$/u);
  });

  it("shares store high-water across readers and fixes its owner capability while another root stays independent", async () => {
    const fixture = await fixtureRootV1(2);
    const identityCapability = await mintIdentityCapabilityV1();
    const reader =
      await mintProviderInstallationAcceptanceStoreSubstrateReaderCapabilityV1(
        readerInputV1(fixture.authorityRoot, identityCapability),
      );
    await unlink(join(
      fixture.authorityRoot,
      "generations",
      "0000000000000002.json",
    ));
    await writeSnapshotV1(fixture.authorityRoot, fixture.envelopes.slice(0, 1));

    await expect(
      diagnoseProviderInstallationAcceptanceStoreSubstrateCurrentV1(reader),
    ).resolves.toEqual({
      ok: false,
      code: "provider_unavailable",
      reason: "attestation_invalid",
      stage: "observed_high_water",
    });

    await expect(
      mintProviderInstallationAcceptanceStoreSubstrateReaderCapabilityV1(
        readerInputV1(fixture.authorityRoot, identityCapability),
      ),
    ).rejects.toThrow(/^Installation Acceptance store is unavailable$/u);

    const equivalentIdentityCapability = await mintIdentityCapabilityV1();
    await expect(
      mintProviderInstallationAcceptanceStoreSubstrateReaderCapabilityV1(
        readerInputV1(
          fixture.authorityRoot,
          equivalentIdentityCapability,
        ),
      ),
    ).rejects.toThrow(/^Installation Acceptance store is unavailable$/u);

    await expect(
      mintProviderInstallationAcceptanceStoreSubstrateReaderCapabilityV1({
        ...readerInputV1(fixture.authorityRoot, identityCapability),
        expectedAuthorityUid: process.getuid!() + 1,
      }),
    ).rejects.toThrow(/^Installation Acceptance store is unavailable$/u);

    await writeSnapshotV1(
      fixture.authorityRoot,
      envelopesV1(1, FOREIGN_INSTALLATION_IDENTITY_KEY),
    );
    const foreignIdentityCapability = await mintIdentityCapabilityV1(
      FOREIGN_INSTALLATION_IDENTITY_KEY,
    );
    await expect(
      mintProviderInstallationAcceptanceStoreSubstrateReaderCapabilityV1(
        readerInputV1(
          fixture.authorityRoot,
          foreignIdentityCapability,
        ),
      ),
    ).rejects.toThrow(/^Installation Acceptance store is unavailable$/u);

    const anotherRoot = await fixtureRootV1(1);
    await expect(
      mintProviderInstallationAcceptanceStoreSubstrateReaderCapabilityV1(
        readerInputV1(anotherRoot.authorityRoot, identityCapability),
      ),
    ).resolves.toBeDefined();
  });

  it("does not accept a DTO or foreign object as the reader capability", async () => {
    await expect(
      diagnoseProviderInstallationAcceptanceStoreSubstrateCurrentV1(
        Object.freeze(Object.create(null)),
      ),
    ).resolves.toEqual({
      ok: false,
      code: "provider_unavailable",
      reason: "attestation_invalid",
      stage: "reader_capability",
    });
  });
});
