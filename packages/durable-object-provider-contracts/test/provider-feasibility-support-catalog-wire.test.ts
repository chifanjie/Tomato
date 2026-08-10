import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_RESOURCE_PATH_V1,
} from "../src/provider-real-filesystem-source-fixtures.js";
import {
  PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_PATH_V1,
} from "../src/provider-registry-manifest-fixtures.js";
import {
  PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_PATH_V1,
} from "../src/provider-registry-root-history-fixtures.js";
import {
  PROVIDER_FEASIBILITY_SUPPORT_CATALOG_DOMAIN_V1,
  PROVIDER_FEASIBILITY_SUPPORT_CATALOG_LOCATOR_PROFILE_V1,
  PROVIDER_FEASIBILITY_SUPPORT_CATALOG_SIGNATURE_DOMAIN_V1,
  ProviderFeasibilityPublicSupportV1Schema,
  ProviderFeasibilitySupportCandidateArtifactV1Schema,
  ProviderFeasibilitySupportCatalogEnvelopeV1Schema,
  ProviderFeasibilitySupportCatalogPointInvalidReasonV1Schema,
  ProviderFeasibilitySupportCatalogPointInvalidStageV1Schema,
  ProviderFeasibilitySupportCatalogSignatureV1Schema,
  ProviderFeasibilitySupportCatalogV1Schema,
  buildProviderFeasibilitySupportCatalogRelativePathV1,
  createProviderFeasibilitySupportCatalogSignatureMessageV1,
  deriveProviderFeasibilitySupportCatalogContentDigestV1,
  deriveProviderFeasibilitySupportCatalogPinV1,
  projectProviderFeasibilitySupportCatalogUnsignedClaimsV1,
} from "../src/provider-feasibility-support-catalog-point.js";
import {
  buildGoldenProviderFeasibilitySupportCatalogPointFixture,
  jsonClone,
} from "../scripts/lib/provider-feasibility-support-catalog-point-fixture.mjs";

function resourceJson(relativePath: string): unknown {
  return JSON.parse(
    readFileSync(
      fileURLToPath(new URL(`../${relativePath}`, import.meta.url)),
      "utf8",
    ),
  );
}

const golden = buildGoldenProviderFeasibilitySupportCatalogPointFixture({
  rootGolden: resourceJson(
    PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_PATH_V1,
  ),
  registryGolden: resourceJson(
    PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_PATH_V1,
  ),
  sourceGolden: resourceJson(
    PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_RESOURCE_PATH_V1,
  ),
});

describe("provider feasibility support Catalog wire", () => {
  it("freezes the signature and digest domains", () => {
    expect(PROVIDER_FEASIBILITY_SUPPORT_CATALOG_DOMAIN_V1).toBe(
      "provider-feasibility-support-catalog-v1",
    );
    expect(PROVIDER_FEASIBILITY_SUPPORT_CATALOG_SIGNATURE_DOMAIN_V1).toBe(
      "provider-feasibility-support-catalog-signature-v1",
    );
    expect(PROVIDER_FEASIBILITY_SUPPORT_CATALOG_LOCATOR_PROFILE_V1).toBe(
      "distribution_provider_feasibility_support_catalog_v1",
    );
  });

  it("projects the only unsigned Catalog claims and closes digest, Pin, and path", () => {
    const envelope = ProviderFeasibilitySupportCatalogEnvelopeV1Schema.parse(
      golden.providerFeasibilitySupportCatalog,
    );
    const { catalogSignature: _catalogSignature, ...expectedClaims } =
      envelope.payload;
    expect(
      projectProviderFeasibilitySupportCatalogUnsignedClaimsV1(
        envelope.payload,
      ),
    ).toEqual(expectedClaims);
    expect(
      deriveProviderFeasibilitySupportCatalogContentDigestV1(
        envelope.payload,
      ),
    ).toBe(envelope.contentDigest);
    const pin = deriveProviderFeasibilitySupportCatalogPinV1(envelope);
    expect(pin).toEqual(golden.providerFeasibilitySupportCatalogPin);
    const relativePath =
      buildProviderFeasibilitySupportCatalogRelativePathV1(pin);
    expect(relativePath).toMatch(
      /^provider\/support-catalog\/(?:id-[0-9a-v]+|idh-[0-9a-f]{64})\.json$/u,
    );
    expect(buildProviderFeasibilitySupportCatalogRelativePathV1(pin)).toBe(
      relativePath,
    );
  });

  it("binds the signature message to both the Catalog and Root identity", () => {
    const catalog = golden.providerFeasibilitySupportCatalog.payload;
    const rootKeyId = golden.discovery.activeRoot.rootKeyId;
    const message = createProviderFeasibilitySupportCatalogSignatureMessageV1(
      catalog,
      rootKeyId,
    );
    expect(message).toBeInstanceOf(Uint8Array);
    expect(message.byteLength).toBeGreaterThan(0);
    expect(() =>
      createProviderFeasibilitySupportCatalogSignatureMessageV1(
        catalog,
        `${"0".repeat(22)}`,
      ),
    ).toThrow(/root key mismatch/u);
  });

  it("rejects noncanonical signatures, open objects, and empty target groups", () => {
    expect(
      ProviderFeasibilitySupportCatalogSignatureV1Schema.safeParse(
        `provider-support-catalog-ed25519:${"a".repeat(21)}:${"0".repeat(128)}`,
      ).success,
    ).toBe(false);
    expect(
      ProviderFeasibilitySupportCatalogSignatureV1Schema.safeParse(
        `provider-support-catalog-ed25519:${"a".repeat(22)}:${"0".repeat(127)}`,
      ).success,
    ).toBe(false);

    const openCatalog = {
      ...jsonClone(golden.providerFeasibilitySupportCatalog.payload),
      unexpected: true,
    };
    expect(ProviderFeasibilitySupportCatalogV1Schema.safeParse(openCatalog).success)
      .toBe(false);

    const emptyCandidates = jsonClone(
      golden.providerFeasibilitySupportCatalog.payload,
    );
    emptyCandidates.targets[0]!.candidates = [];
    expect(
      ProviderFeasibilitySupportCatalogV1Schema.safeParse(emptyCandidates)
        .success,
    ).toBe(false);
  });

  it("keeps candidate artifacts exact and public support privacy-preserving", () => {
    const artifact = golden.providerFeasibilitySupportCandidateArtifacts[0]!;
    expect(
      ProviderFeasibilitySupportCandidateArtifactV1Schema.safeParse({
        ...jsonClone(artifact),
        selector: "caller-controlled",
      }).success,
    ).toBe(false);

    const publicRow = golden.expected.publicSupport[0]!;
    expect(ProviderFeasibilityPublicSupportV1Schema.safeParse(publicRow).success)
      .toBe(true);
    expect(
      ProviderFeasibilityPublicSupportV1Schema.safeParse({
        ...jsonClone(publicRow),
        targetProfileId:
          golden.expected.ownerTargetCapabilities[0]!.target.targetProfileId,
      }).success,
    ).toBe(false);
  });

  it("freezes the externally observable diagnostic vocabulary", () => {
    expect(ProviderFeasibilitySupportCatalogPointInvalidStageV1Schema.options)
      .toEqual([
        "input",
        "bootstrap_distribution_binding",
        "registry_history_closure",
        "release_target_universe_closure",
        "catalog_structure",
        "candidate_artifacts_structure",
        "catalog_generation",
        "catalog_distribution_binding",
        "catalog_active_root",
        "catalog_approval_keys_binding",
        "catalog_taxonomy_pin",
        "catalog_universe_pin",
        "catalog_target_identity",
        "catalog_target_order",
        "catalog_candidate_order",
        "catalog_target_exact_cover",
        "catalog_candidate_binding",
        "candidate_deep_closure",
        "catalog_release_disposition",
        "catalog_signature_binding",
        "catalog_signature",
        "catalog_digest",
        "catalog_envelope",
        "catalog_pin",
      ]);
    expect(ProviderFeasibilitySupportCatalogPointInvalidReasonV1Schema.options)
      .toEqual([
        "schema_invalid",
        "source_invalid",
        "identity_mismatch",
        "binding_mismatch",
        "pin_mismatch",
        "root_mismatch",
        "count_mismatch",
        "digest_mismatch",
        "ordering_invalid",
        "coverage_mismatch",
        "result_not_passed",
        "signature_invalid",
        "envelope_mismatch",
      ]);
  });
});
