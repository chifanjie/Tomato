import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

import {
  PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_CASE_IDS_V1,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_FIXTURE_MAX_BYTES_V1,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_RESOURCE_PATH_V1,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_RESOURCE_SHA256_HEX_V1,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_SEMANTIC_CONTENT_DIGEST_V1,
  ProviderRegistryManifestHistoryFixtureError,
  ProviderRegistryManifestHistoryInvalidManifestV1Schema,
  verifyProviderRegistryManifestHistoryInvalidResourceV1,
} from "../src/provider-registry-manifest-fixtures.js";

const resourceBytes = new Uint8Array(
  readFileSync(
    fileURLToPath(
      new URL(
        `../${PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_RESOURCE_PATH_V1}`,
        import.meta.url,
      ),
    ),
  ),
);

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

interface MutableInvalidCase {
  caseId?: string;
  mutation?: {
    dialect?: string;
    goldenResourcePath?: string;
    steps?: Array<{
      operation?: string;
      targetJsonPointer?: string;
      operands?: string[];
      [key: string]: unknown;
    }>;
    [key: string]: unknown;
  };
  expected?: unknown;
  [key: string]: unknown;
}

function mutableInvalidCase(value: unknown): MutableInvalidCase {
  return cloneJson(value) as MutableInvalidCase;
}

interface InvalidRunnerModule {
  assertProviderRegistryManifestInvalidRecipeV1(
    invalidCase: unknown,
  ): void;
  materializeProviderRegistryManifestInvalidCandidateV1(
    golden: unknown,
    invalidCase: unknown,
    strictCryptoCapability: unknown,
  ): unknown;
}

let invalidRunner: InvalidRunnerModule;

beforeAll(async () => {
  const runnerUrl = new URL(
    "../scripts/lib/provider-registry-manifest-invalid-runner.mjs",
    import.meta.url,
  );
  invalidRunner = (await import(runnerUrl.href)) as InvalidRunnerModule;
});

describe("provider Registry Manifest executable invalid corpus", () => {
  it("accepts only the anchored 89-case ordered tuple and freezes it", () => {
    const resource =
      verifyProviderRegistryManifestHistoryInvalidResourceV1(resourceBytes);

    expect(resource.caseCount).toBe(89);
    expect(resource.cases).toHaveLength(89);
    expect(resource.caseIds).toEqual(
      PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_CASE_IDS_V1,
    );
    expect(new Set(resource.caseIds).size).toBe(89);
    expect(
      new Set(
        resource.cases.map(
          ({ expected }) => expected.materializedRequestSemanticDigest,
        ),
      ).size,
    ).toBe(89);
    expect(resource.fixtureAuthority).toBe("none_rejection_only");
    expect(
      resource.cases.filter(
        ({ expected }) => expected.wrongDomainProofCount === 1,
      ).map(({ caseId }) => caseId),
    ).toEqual([
      "manifest-signature-wrong-domain",
      "runtime-signature-wrong-domain",
      "key-signature-wrong-domain",
      "entry-signature-wrong-domain",
    ]);
    expect(Object.isFrozen(resource)).toBe(true);
    expect(Object.isFrozen(resource.cases)).toBe(true);
    expect(Object.isFrozen(resource.cases[88]?.mutation.steps)).toBe(true);
    expect(PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_RESOURCE_BYTE_LENGTH_V1)
      .toBe(104_226);
    expect(PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_RESOURCE_SHA256_HEX_V1)
      .toBe(
        "ef53018092032c1fc355b5f8f06bd40fa6f65fb868038ab484e1ad8836a1b401",
      );
    expect(
      PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_SEMANTIC_CONTENT_DIGEST_V1,
    ).toBe(
      "sha256:3d53130fdc8c9aa7703bb3946a3f14ef7f8f395235eaf199b1ab968d78a8ec13",
    );
  });

  it("rejects raw, semantic, order, tuple, and strict-shape tampering", () => {
    const text = new TextDecoder().decode(resourceBytes);
    const compact = new TextEncoder().encode(
      JSON.stringify(JSON.parse(text) as unknown),
    );
    const reordered = cloneJson(
      verifyProviderRegistryManifestHistoryInvalidResourceV1(resourceBytes),
    ) as unknown as { cases: unknown[]; [key: string]: unknown };
    [reordered.cases[0], reordered.cases[1]] = [
      reordered.cases[1]!,
      reordered.cases[0]!,
    ];
    const extraField = {
      ...cloneJson(
        verifyProviderRegistryManifestHistoryInvalidResourceV1(resourceBytes),
      ),
      callerPath: "latest.json",
    };
    const digestTampered = cloneJson(
      verifyProviderRegistryManifestHistoryInvalidResourceV1(resourceBytes),
    ) as unknown as {
      cases: Array<{
        expected: { materializedRequestSemanticDigest: string };
      }>;
    };
    digestTampered.cases[0]!.expected.materializedRequestSemanticDigest =
      `sha256:${"0".repeat(64)}`;

    expect(
      ProviderRegistryManifestHistoryInvalidManifestV1Schema.safeParse(
        reordered,
      ).success,
    ).toBe(false);
    expect(
      ProviderRegistryManifestHistoryInvalidManifestV1Schema.safeParse(
        extraField,
      ).success,
    ).toBe(false);
    expect(
      ProviderRegistryManifestHistoryInvalidManifestV1Schema.safeParse(
        digestTampered,
      ).success,
    ).toBe(false);
    expect(() =>
      verifyProviderRegistryManifestHistoryInvalidResourceV1(compact),
    ).toThrow(ProviderRegistryManifestHistoryFixtureError);
    expect(() =>
      verifyProviderRegistryManifestHistoryInvalidResourceV1(
        new Uint8Array([...resourceBytes, 0x0a]),
      ),
    ).toThrow(ProviderRegistryManifestHistoryFixtureError);
    expect(() =>
      verifyProviderRegistryManifestHistoryInvalidResourceV1(
        new Uint8Array([0xef, 0xbb, 0xbf, ...resourceBytes]),
      ),
    ).toThrow(ProviderRegistryManifestHistoryFixtureError);
    expect(() =>
      verifyProviderRegistryManifestHistoryInvalidResourceV1(
        new Uint8Array(
          PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_FIXTURE_MAX_BYTES_V1 + 1,
        ),
      ),
    ).toThrow(ProviderRegistryManifestHistoryFixtureError);
  });

  it("independently rejects every altered recipe tuple before materialization", () => {
    const resource =
      verifyProviderRegistryManifestHistoryInvalidResourceV1(resourceBytes);
    const poisonGolden = new Proxy(
      {},
      {
        get() {
          throw new Error("golden data was read before recipe rejection");
        },
      },
    );
    let reorderedOperandCases = 0;

    function rejectRecipe(invalidCase: MutableInvalidCase): void {
      expect(() =>
        invalidRunner.assertProviderRegistryManifestInvalidRecipeV1(
          invalidCase,
        ),
      ).toThrow(TypeError);
      expect(() =>
        invalidRunner.materializeProviderRegistryManifestInvalidCandidateV1(
          poisonGolden,
          invalidCase,
          undefined,
        ),
      ).toThrow(TypeError);
    }

    for (const frozenCase of resource.cases) {
      invalidRunner.assertProviderRegistryManifestInvalidRecipeV1(frozenCase);

      const targetTamper = mutableInvalidCase(frozenCase);
      targetTamper.mutation!.steps![0]!.targetJsonPointer += "/tampered";
      rejectRecipe(targetTamper);

      const targetMissing = mutableInvalidCase(frozenCase);
      delete targetMissing.mutation!.steps![0]!.targetJsonPointer;
      rejectRecipe(targetMissing);

      const operandExtra = mutableInvalidCase(frozenCase);
      operandExtra.mutation!.steps![0]!.operands!.push("unexpected");
      rejectRecipe(operandExtra);

      const operandDeleted = mutableInvalidCase(frozenCase);
      const deletedOperands =
        operandDeleted.mutation!.steps![0]!.operands!;
      if (deletedOperands.length === 0) {
        deletedOperands.length = 1;
      } else {
        deletedOperands.splice(0, 1);
      }
      rejectRecipe(operandDeleted);

      if (frozenCase.mutation.steps[0].operands.length > 1) {
        const operandReordered = mutableInvalidCase(frozenCase);
        operandReordered.mutation!.steps![0]!.operands!.reverse();
        rejectRecipe(operandReordered);
        reorderedOperandCases += 1;
      }

      const operationTamper = mutableInvalidCase(frozenCase);
      operationTamper.mutation!.steps![0]!.operation = "history-empty";
      if (operationTamper.caseId === "history-empty") {
        operationTamper.mutation!.steps![0]!.operation = "unknown-operation";
      }
      rejectRecipe(operationTamper);

      const dialectTamper = mutableInvalidCase(frozenCase);
      dialectTamper.mutation!.dialect = "invalid_recipe_v2";
      rejectRecipe(dialectTamper);

      const dialectMissing = mutableInvalidCase(frozenCase);
      delete dialectMissing.mutation!.dialect;
      rejectRecipe(dialectMissing);

      const goldenPathTamper = mutableInvalidCase(frozenCase);
      goldenPathTamper.mutation!.goldenResourcePath =
        "fixtures/v1/golden/latest.json";
      rejectRecipe(goldenPathTamper);

      const goldenPathMissing = mutableInvalidCase(frozenCase);
      delete goldenPathMissing.mutation!.goldenResourcePath;
      rejectRecipe(goldenPathMissing);

      const extraStep = mutableInvalidCase(frozenCase);
      extraStep.mutation!.steps!.push(
        cloneJson(extraStep.mutation!.steps![0]!),
      );
      rejectRecipe(extraStep);

      const stepExtraField = mutableInvalidCase(frozenCase);
      stepExtraField.mutation!.steps![0]!.callerPath = "latest.json";
      rejectRecipe(stepExtraField);

      const mutationExtraField = mutableInvalidCase(frozenCase);
      mutationExtraField.mutation!.callerPath = "latest.json";
      rejectRecipe(mutationExtraField);

      const caseExtraField = mutableInvalidCase(frozenCase);
      caseExtraField.callerPath = "latest.json";
      rejectRecipe(caseExtraField);

      const expectedMissing = mutableInvalidCase(frozenCase);
      delete expectedMissing.expected;
      rejectRecipe(expectedMissing);
    }

    const unknownCase = mutableInvalidCase(resource.cases[0]);
    unknownCase.caseId = "unknown-case";
    unknownCase.mutation!.steps![0]!.operation = "unknown-case";
    rejectRecipe(unknownCase);
    expect(reorderedOperandCases).toBeGreaterThan(0);
  });
});
