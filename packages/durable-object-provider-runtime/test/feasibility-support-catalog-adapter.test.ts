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
  validateProviderFeasibilitySupportCatalogPointClosureV1,
  type ValidateProviderFeasibilitySupportCatalogPointClosureV1Input,
} from "@understand-code/durable-object-provider-contracts/provider-feasibility-support-catalog-point";
import {
  verifyProviderFeasibilitySupportCatalogPointGoldenResourceV1,
} from "@understand-code/durable-object-provider-contracts/provider-feasibility-support-catalog-point-fixtures";
import {
  adaptProviderRuntimeFeasibilitySupportCatalogV1,
  diagnoseProviderRuntimeFeasibilitySupportCatalogAdapterV1,
} from "../src/feasibility-support-catalog-adapter.js";

const golden = verifyProviderFeasibilitySupportCatalogPointGoldenResourceV1(
  new Uint8Array(
    readFileSync(
      fileURLToPath(
        new URL(
          "../../durable-object-provider-contracts/fixtures/v1/golden/provider-feasibility-support-catalog-point-v1.json",
          import.meta.url,
        ),
      ),
    ),
  ),
);
const strictManifestBytes = new Uint8Array(
  readFileSync(
    fileURLToPath(
      new URL(
        `../../durable-object-provider-contracts/${PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1}`,
        import.meta.url,
      ),
    ),
  ),
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
});

async function runtimeOptionsV1() {
  const request = golden.positiveVectors[0]!.request;
  const validatedClosure =
    await validateProviderFeasibilitySupportCatalogPointClosureV1({
      ...request,
      strictCryptoCapability: capability,
    } as ValidateProviderFeasibilitySupportCatalogPointClosureV1Input);
  return {
    context: {
      ...request,
      strictCryptoCapability: capability,
      validatedClosure,
    },
  } as const;
}

describe("runtime feasibility support Catalog adapter", () => {
  it("binds signed Catalog history and validated Registry/Evidence closures without authority", async () => {
    const adapted = await adaptProviderRuntimeFeasibilitySupportCatalogV1(
      await runtimeOptionsV1(),
    );
    expect(adapted.authority).toBe(
      "none_provider_feasibility_support_catalog_structure_only",
    );
    expect(adapted.accessMode).toBe("read_only");
    expect(adapted.strongWriteStatus).toBe("locked");
    expect(adapted.closure.authority).toBe(
      "none_provider_feasibility_support_catalog_structure_only",
    );
    expect(adapted.closure.targetCount).toBe(2);
    expect(adapted.closure.candidateCount).toBe(2);
    expect(adapted.closure.publicSupportRowCount).toBe(1);
  });

  it("rejects tampered Registry/Evidence closure opaquely", async () => {
    const options = await runtimeOptionsV1();
    const diagnostic = await diagnoseProviderRuntimeFeasibilitySupportCatalogAdapterV1(
      {
        ...options,
        context: {
          ...options.context,
          validatedClosure: {
            ...options.context.validatedClosure,
            targetCount: 3,
          },
        },
      },
    );
    expect(diagnostic).toEqual({
      ok: false,
      code: "provider_unavailable",
      reason: "attestation_invalid",
    });
  });
});
