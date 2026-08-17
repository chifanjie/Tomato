import { mkdtemp, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { describe, expect, it, beforeAll, afterEach } from "vitest";

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
  validateProviderTargetDiscoveryPointClosureV1,
  type ValidateProviderTargetDiscoveryPointClosureV1Input,
} from "@understand-code/durable-object-provider-contracts/provider-target-discovery-point";
import { ContentDigestV1Schema } from "@understand-code/durable-object-provider-contracts/primitives";
import {
  adaptProviderRuntimeRealFilesystemConformanceResultV1,
  diagnoseProviderRuntimeRealFilesystemConformanceResultAdapterV1,
} from "../src/conformance-result-adapter.js";
import {
  probeProviderRuntimeTargetV1,
  runProviderRuntimeRealFilesystemConformanceV1,
} from "../src/index.js";

function resourceBytes(relativePath: string): Uint8Array {
  return new Uint8Array(
    readFileSync(fileURLToPath(new URL(`../../durable-object-provider-contracts/${relativePath}`, import.meta.url))),
  );
}

const strictManifestBytes = new Uint8Array(
  readFileSync(fileURLToPath(new URL("../../durable-object-provider-contracts/provider/ed25519-strict-host-conformance-v1.json", import.meta.url))),
);
const discoveryGolden = JSON.parse(
  new TextDecoder().decode(resourceBytes("fixtures/v1/golden/provider-real-filesystem-conformance-result-v1.json")),
) as Record<string, any>;
let capability: ProviderStrictEd25519OpaqueCapabilityV1;
const roots: string[] = [];

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

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function fixtureOptions() {
  const targetDiscoveryPointInput = {
    distributionRootBinding: discoveryGolden.distributionRootBinding,
    activeRootMetadata: discoveryGolden.activeRootMetadata,
    activeRoot: discoveryGolden.activeRoot,
    fixtureCorpusManifest: discoveryGolden.fixtureCorpusManifest,
    suiteManifest: discoveryGolden.suiteManifest,
    publicSupportTaxonomy: discoveryGolden.publicSupportTaxonomy,
    releaseMatrix: discoveryGolden.releaseMatrix,
    targetDiscoveryFixtureManifest: discoveryGolden.targetDiscoveryFixtureManifest,
    targetDiscoveryRunnerRun: discoveryGolden.targetDiscoveryRunnerRun,
    targetDiscoveryResult: discoveryGolden.targetDiscoveryResult,
    strictCryptoCapability: capability,
  } as ValidateProviderTargetDiscoveryPointClosureV1Input;
  const verifiedTargetDiscoveryPoint = await validateProviderTargetDiscoveryPointClosureV1(targetDiscoveryPointInput);
  const target = discoveryGolden.targetDiscoveryResult.payload.targets[0].target;
  const root = await mkdtemp(`${tmpdir()}/uc-provider-adapter-`);
  roots.push(root);
  const inspection = await probeProviderRuntimeTargetV1(root);
  const candidate = await runProviderRuntimeRealFilesystemConformanceV1({
    targetInspection: inspection,
    providerId: "durable-object-provider:local-helper",
    binaryDigest: `sha256:${"1".repeat(64)}`,
    policyDigest: `sha256:${"2".repeat(64)}`,
    capabilityDigest: `sha256:${"3".repeat(64)}`,
  });
  const candidateCaseIds = [
    "exact_object_write_read",
    "immutable_no_replace_replay",
    "external_compare_and_set",
    "restart_recovery",
    "target_continuity",
  ] as const;
  const caseBindings = discoveryGolden.suiteManifest.payload.cases.flatMap((suiteCase: any, index: number) =>
    suiteCase.requiredCrashCuts.map((cut: any) => ({
      candidateCaseId: candidateCaseIds[index % candidateCaseIds.length],
      caseId: suiteCase.caseId,
      crashCutId: cut.crashCutId,
    })),
  );
  return {
    candidate,
    context: { target, targetDiscoveryPointInput, verifiedTargetDiscoveryPoint, caseBindings },
  } as const;
}

describe("runtime conformance result adapter", () => {
  it("adapts a real candidate only with supplied discovery/suite context", async () => {
    const options = await fixtureOptions();
    const adapted = await adaptProviderRuntimeRealFilesystemConformanceResultV1(options);
    expect(adapted.envelope.recordType).toBe("provider_real_fs_conformance_result");
    expect(adapted.envelope.resultId).toBe(adapted.locator.resultId);
    expect(adapted.envelope.contentDigest).toBe(adapted.pin.contentDigest);
    expect(adapted.closure.authority).toBe("none_real_fs_conformance_result_structure_only");
    expect(adapted.envelope.payload.caseResults).toHaveLength(8);
  });

  it("returns an opaque diagnostic when candidate bytes are tampered", async () => {
    const options = await fixtureOptions();
    const tampered = {
      ...options.candidate,
      executionDigest: ContentDigestV1Schema.parse(`sha256:${"f".repeat(64)}`),
    };
    const diagnostic = await diagnoseProviderRuntimeRealFilesystemConformanceResultAdapterV1({
      ...options,
      candidate: tampered,
    });
    expect(diagnostic).toEqual({ ok: false, code: "provider_unavailable", reason: "attestation_invalid" });
    const missingContext = await diagnoseProviderRuntimeRealFilesystemConformanceResultAdapterV1({
      ...options,
      context: { ...options.context, caseBindings: [] },
    });
    expect(missingContext).toEqual({ ok: false, code: "provider_unavailable", reason: "attestation_invalid" });
  });
});
