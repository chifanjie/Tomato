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
  validateProviderRegistryEvidenceBindingPointClosureV1,
} from "@understand-code/durable-object-provider-contracts/provider-registry-evidence-binding-point";
import {
  materializeProviderRegistryEvidenceBindingPointGoldenRequestV1,
  verifyProviderRegistryEvidenceBindingPointGoldenResourceV1,
} from "@understand-code/durable-object-provider-contracts/provider-registry-evidence-binding-point-fixtures";
import { ContentDigestV1Schema } from "@understand-code/durable-object-provider-contracts/primitives";
import {
  adaptProviderRuntimeRegistryEvidenceBindingV1,
  diagnoseProviderRuntimeRegistryEvidenceBindingAdapterV1,
  type AdaptProviderRuntimeRegistryEvidenceBindingOptionsV1,
} from "../src/registry-evidence-binding-adapter.js";

function resourceBytes(relativePath: string): Uint8Array {
  return new Uint8Array(
    readFileSync(
      fileURLToPath(
        new URL(
          `../../durable-object-provider-contracts/${relativePath}`,
          import.meta.url,
        ),
      ),
    ),
  );
}

const strictManifestBytes = resourceBytes(
  "provider/ed25519-strict-host-conformance-v1.json",
);
const registryBindingGoldenBytes = resourceBytes(
  "fixtures/v1/golden/provider-registry-evidence-binding-point-v1.json",
);
let capability: ProviderStrictEd25519OpaqueCapabilityV1;
let options: AdaptProviderRuntimeRegistryEvidenceBindingOptionsV1;

beforeAll(async () => {
  capability = await attestProviderStrictEd25519CryptoHostV1({
    host: Object.freeze({
      verificationProfile: STRICT_ED25519_VERIFICATION_PROFILE_V1,
      validatePrimeSubgroupPoint,
      verifyRawEd25519,
    }),
    resourceHost: Object.freeze({
      readFixedSignedPackageResource(path: string, maxBytes: number) {
        if (
          path !== PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1 ||
          maxBytes !== PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1
        ) {
          throw new TypeError("unexpected fixed resource request");
        }
        return strictManifestBytes;
      },
    }),
  });

  const manifest = verifyProviderRegistryEvidenceBindingPointGoldenResourceV1(
    registryBindingGoldenBytes,
  );
  const request = materializeProviderRegistryEvidenceBindingPointGoldenRequestV1(
    manifest,
    capability,
  );
  const registryClosure =
    await validateProviderRegistryEvidenceBindingPointClosureV1(request);
  const evidenceClosure = {
    authority: "none_provider_feasibility_evidence_structure_only" as const,
    runtimeAttestationPointClosure: registryClosure.runtimeAttestationPointClosure,
    providerFeasibilityEvidence: registryClosure.providerFeasibilityEvidence,
    providerFeasibilityEvidencePin: registryClosure.providerFeasibilityEvidencePin,
    relativePath: registryClosure.relativePath,
    qaApproverPublicKey: registryClosure.qaApproverPublicKey,
    releaseApproverPublicKey: registryClosure.releaseApproverPublicKey,
  };
  const {
    providerFeasibilityEvidence,
    providerFeasibilityEvidencePin,
    ...context
  } = request;
  options = {
    feasibilityEvidence: {
      evidence: providerFeasibilityEvidence,
      pin: providerFeasibilityEvidencePin,
      closure: evidenceClosure,
    },
    context,
  };
});

describe("runtime Registry/Evidence binding adapter", () => {
  it("binds externally validated dual-signed Evidence without minting authority", async () => {
    const adapted = await adaptProviderRuntimeRegistryEvidenceBindingV1(options);
    expect(adapted.authority).toBe(
      "none_registry_entry_evidence_binding_structure_only",
    );
    expect(adapted.accessMode).toBe("read_only");
    expect(adapted.strongWriteStatus).toBe("locked");
    expect(adapted.closure.providerFeasibilityEvidence.evidenceId).toBe(
      options.feasibilityEvidence.evidence.evidenceId,
    );
    expect(adapted.closure.candidateRegistryEntry.providerId).toBe(
      options.feasibilityEvidence.evidence.payload.providerId,
    );
  });

  it("rejects a tampered external Evidence identity opaquely", async () => {
    const diagnostic = await diagnoseProviderRuntimeRegistryEvidenceBindingAdapterV1({
      ...options,
      feasibilityEvidence: {
        ...options.feasibilityEvidence,
        evidence: {
          ...options.feasibilityEvidence.evidence,
          contentDigest: ContentDigestV1Schema.parse(`sha256:${"f".repeat(64)}`),
        },
      },
    });
    expect(diagnostic).toEqual({
      ok: false,
      code: "provider_unavailable",
      reason: "attestation_invalid",
    });
  });
});
