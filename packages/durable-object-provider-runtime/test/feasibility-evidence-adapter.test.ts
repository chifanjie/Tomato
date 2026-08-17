import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

import {
  attestProviderStrictEd25519CryptoHostV1,
  PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1,
  PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
  type ProviderStrictEd25519OpaqueCapabilityV1,
} from "@understand-code/durable-object-provider-contracts/strict-ed25519-conformance";
import {
  STRICT_ED25519_VERIFICATION_PROFILE_V1,
  validatePrimeSubgroupPoint,
  verifyRawEd25519,
} from "@understand-code/durable-object-provider-contracts/strict-ed25519";
import {
  validateProviderRealFilesystemConformanceResultClosureV1,
  type ValidateProviderRealFilesystemConformanceResultClosureV1Input,
} from "@understand-code/durable-object-provider-contracts/provider-real-filesystem-conformance-result";
import {
  adaptProviderRuntimeFeasibilityEvidenceV1,
  diagnoseProviderRuntimeFeasibilityEvidenceAdapterV1,
} from "../src/feasibility-evidence-adapter.js";

function resourceBytes(relativePath: string): Uint8Array {
  return new Uint8Array(
    readFileSync(fileURLToPath(new URL(`../../durable-object-provider-contracts/${relativePath}`, import.meta.url))),
  );
}

const golden = JSON.parse(
  new TextDecoder().decode(resourceBytes("fixtures/v1/golden/provider-feasibility-evidence-point-v1.json")),
) as Record<string, any>;
const strictManifestBytes = new Uint8Array(
  readFileSync(fileURLToPath(new URL("../../durable-object-provider-contracts/provider/ed25519-strict-host-conformance-v1.json", import.meta.url))),
);
let capability: ProviderStrictEd25519OpaqueCapabilityV1;

beforeAll(async () => {
  capability = await attestProviderStrictEd25519CryptoHostV1({
    host: Object.freeze({
      verificationProfile: STRICT_ED25519_VERIFICATION_PROFILE_V1,
      validatePrimeSubgroupPoint,
      verifyRawEd25519,
    }),
    resourceHost: Object.freeze({
      readFixedSignedPackageResource(path: string, maxBytes: number) {
        if (path !== PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1 || maxBytes !== PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1) {
          throw new TypeError("unexpected fixed resource request");
        }
        return strictManifestBytes;
      },
    }),
  });
});

async function optionsV1() {
  const vector = golden.positiveVectors[0];
  const conformanceGolden = golden.runtimeAttestationPointGolden.conformanceResultGolden;
  const conformanceInput = {
    distributionRootBinding: conformanceGolden.distributionRootBinding,
    activeRootMetadata: conformanceGolden.activeRootMetadata,
    activeRoot: conformanceGolden.activeRoot,
    fixtureCorpusManifest: conformanceGolden.fixtureCorpusManifest,
    suiteManifest: conformanceGolden.suiteManifest,
    publicSupportTaxonomy: conformanceGolden.publicSupportTaxonomy,
    releaseMatrix: conformanceGolden.releaseMatrix,
    targetDiscoveryFixtureManifest: conformanceGolden.targetDiscoveryFixtureManifest,
    targetDiscoveryRunnerRun: conformanceGolden.targetDiscoveryRunnerRun,
    targetDiscoveryResult: conformanceGolden.targetDiscoveryResult,
    strictCryptoCapability: capability,
    realFilesystemConformanceResult: vector.realFilesystemConformanceResult,
    realFilesystemConformanceResultLocator: vector.realFilesystemConformanceResultLocator,
    realFilesystemConformanceResultPin: vector.realFilesystemConformanceResultPin,
  } as ValidateProviderRealFilesystemConformanceResultClosureV1Input;
  const closure = await validateProviderRealFilesystemConformanceResultClosureV1(conformanceInput);
  return {
    conformanceResult: {
      envelope: vector.realFilesystemConformanceResult,
      locator: vector.realFilesystemConformanceResultLocator,
      pin: vector.realFilesystemConformanceResultPin,
      closure,
    },
    context: {
      distributionRootBinding: conformanceGolden.distributionRootBinding,
      activeRootMetadata: conformanceGolden.activeRootMetadata,
      activeRoot: conformanceGolden.activeRoot,
      fixtureCorpusManifest: conformanceGolden.fixtureCorpusManifest,
      suiteManifest: conformanceGolden.suiteManifest,
      publicSupportTaxonomy: conformanceGolden.publicSupportTaxonomy,
      releaseMatrix: conformanceGolden.releaseMatrix,
      targetDiscoveryFixtureManifest: conformanceGolden.targetDiscoveryFixtureManifest,
      targetDiscoveryRunnerRun: conformanceGolden.targetDiscoveryRunnerRun,
      targetDiscoveryResult: conformanceGolden.targetDiscoveryResult,
      strictCryptoCapability: capability,
      semanticProviderPolicy: golden.runtimeAttestationPointGolden.semanticProviderPolicy,
      runtimeAttestation: golden.runtimeAttestationPointGolden.runtimeAttestation,
      providerFeasibilityEvidence: vector.providerFeasibilityEvidence,
      providerFeasibilityEvidencePin: vector.providerFeasibilityEvidencePin,
      qaApproverPublicKey: golden.qaApproverPublicKey,
      releaseApproverPublicKey: golden.releaseApproverPublicKey,
    },
  } as const;
}

describe("runtime feasibility Evidence adapter", () => {
  it("consumes externally signed Evidence context and preserves none authority", async () => {
    const options = await optionsV1();
    const adapted = await adaptProviderRuntimeFeasibilityEvidenceV1(options);
    expect(adapted.evidence.recordType).toBe("provider_feasibility_evidence");
    expect(adapted.evidence.evidenceId).toBe(adapted.pin.evidenceId);
    expect(adapted.evidence.contentDigest).toBe(adapted.pin.contentDigest);
    expect(adapted.closure.authority).toBe("none_provider_feasibility_evidence_structure_only");
  });

  it("rejects a tampered externally supplied Evidence envelope opaquely", async () => {
    const options = await optionsV1();
    const tampered = {
      ...options,
      context: {
        ...options.context,
        providerFeasibilityEvidence: {
          ...options.context.providerFeasibilityEvidence,
          contentDigest: `sha256:${"f".repeat(64)}`,
        },
      },
    };
    const diagnostic = await diagnoseProviderRuntimeFeasibilityEvidenceAdapterV1(tampered);
    expect(diagnostic).toEqual({ ok: false, code: "provider_unavailable", reason: "attestation_invalid" });
  });
});
