import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  PROVIDER_BOOTSTRAP_TRUST_INVALID_CASE_IDS_V1,
  PROVIDER_BOOTSTRAP_TRUST_INVALID_MANIFEST_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_BOOTSTRAP_TRUST_INVALID_MANIFEST_RESOURCE_SHA256_HEX_V1,
  PROVIDER_BOOTSTRAP_TRUST_INVALID_MANIFEST_SEMANTIC_CONTENT_DIGEST_V1,
  ProviderBootstrapTrustInvalidManifestV1Schema,
  verifyProviderBootstrapTrustInvalidManifestResourceV1,
  verifyProviderBootstrapTrustInvalidManifestV1,
} from "../src/bootstrap-trust-invalid.js";

const fixturePath = fileURLToPath(
  new URL(
    "../fixtures/v1/invalid/provider-bootstrap-structure-crypto-v1.json",
    import.meta.url,
  ),
);
const runnerPath = fileURLToPath(
  new URL(
    "../scripts/verify-bootstrap-trust-invalid.mjs",
    import.meta.url,
  ),
);
const fixtureBytes = readFileSync(fixturePath);
const fixtureInput: unknown = JSON.parse(
  fixtureBytes.toString("utf8"),
);

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("provider bootstrap structure/crypto invalid manifest", () => {
  it("binds exactly 51 ordered cases to raw and semantic anchors", () => {
    expect(fixtureBytes.byteLength).toBe(
      PROVIDER_BOOTSTRAP_TRUST_INVALID_MANIFEST_RESOURCE_BYTE_LENGTH_V1,
    );
    expect(
      createHash("sha256").update(fixtureBytes).digest("hex"),
    ).toBe(
      PROVIDER_BOOTSTRAP_TRUST_INVALID_MANIFEST_RESOURCE_SHA256_HEX_V1,
    );
    expect(
      PROVIDER_BOOTSTRAP_TRUST_INVALID_MANIFEST_SEMANTIC_CONTENT_DIGEST_V1,
    ).toBe(
      "sha256:64333c7b096d82d88d4232264ef11ad8946d5d646dee5f38e17ea72e95cd4a0e",
    );

    const validation =
      verifyProviderBootstrapTrustInvalidManifestResourceV1(
        new Uint8Array(fixtureBytes),
      );
    expect(validation.authority).toBe("none_rejection_only");
    expect(validation.manifest.cases).toHaveLength(51);
    expect(
      validation.manifest.cases.map(({ caseId }) => caseId),
    ).toEqual(PROVIDER_BOOTSTRAP_TRUST_INVALID_CASE_IDS_V1);
    expect(new Set(PROVIDER_BOOTSTRAP_TRUST_INVALID_CASE_IDS_V1)).toHaveProperty(
      "size",
      51,
    );
    const prefixMismatchRecipe = validation.manifest.cases
      .find(
        ({ caseId }) =>
          caseId === "root-self-signature-message-matrix",
      )
      ?.witnesses.find(({ profile }) =>
        profile.includes("prefix_wrapper_key_mismatch"),
      )?.recipe;
    expect(prefixMismatchRecipe?.operands).toEqual([
      "prefix_wrapper_key_mismatch",
      "alternate_root_key_id=661166fa4208cb1d325f30",
    ]);
    expect(
      prefixMismatchRecipe?.deterministicSeed.source,
    ).toBe("bootstrap_golden_json_pointer");
    expect(
      validation.manifest.cases
        .flatMap(({ witnesses }) => witnesses)
        .filter(
          ({ boundary }) => boundary === "reference_oracle",
        ),
    ).toHaveLength(5);
    expect(Object.isFrozen(validation)).toBe(true);
    expect(Object.isFrozen(validation.manifest.cases)).toBe(true);
  });

  it("rejects raw aliases and any case removal, insertion, or reorder", () => {
    const minified = new TextEncoder().encode(
      JSON.stringify(fixtureInput),
    );
    expect(minified).not.toEqual(new Uint8Array(fixtureBytes));
    expect(() =>
      verifyProviderBootstrapTrustInvalidManifestResourceV1(
        minified,
      ),
    ).toThrow(/byte anchor mismatch/u);

    const parsed =
      ProviderBootstrapTrustInvalidManifestV1Schema.parse(
        fixtureInput,
      );
    for (const mutate of [
      (cases: unknown[]) => cases.splice(0, 1),
      (cases: unknown[]) => cases.push(cloneJson(cases.at(-1))),
      (cases: unknown[]) => cases.reverse(),
    ]) {
      const candidate = cloneJson(parsed) as unknown as {
        cases: unknown[];
      };
      mutate(candidate.cases);
      expect(
        ProviderBootstrapTrustInvalidManifestV1Schema.safeParse(
          candidate,
        ).success,
      ).toBe(false);
      expect(() =>
        verifyProviderBootstrapTrustInvalidManifestV1(candidate),
      ).toThrow();
    }
  });

  it("executes every nested witness through the reference runner", () => {
    const execution = spawnSync(process.execPath, [runnerPath], {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
    expect(execution.status).toBe(0);
    expect(execution.stderr).toBe("");
    expect(execution.stdout).toContain(
      "Executed 51 exact provider bootstrap invalid cases across 71 deterministic rejection witnesses.",
    );
  });
});
