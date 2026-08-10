import {
  createPrivateKey,
  createPublicKey,
  sign,
  verify,
} from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

const cryptoCallbacks = vi.hoisted(() => ({
  point: vi.fn(() => true),
  signature: vi.fn(async () => true),
}));

vi.mock("../src/strict-ed25519-conformance.js", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../src/strict-ed25519-conformance.js")
  >();
  return {
    ...actual,
    validateProviderStrictEd25519PointWithCapabilityV1:
      cryptoCallbacks.point,
    verifyRawEd25519WithCapabilityV1: cryptoCallbacks.signature,
  };
});

import {
  deriveProviderFeasibilitySupportCatalogContentDigestV1,
  type ProviderFeasibilitySupportCatalogEnvelopeV1,
} from "../src/provider-feasibility-support-catalog-point.js";
import type {
  ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1,
  ProviderRealFilesystemSuiteManifestEnvelopeV1,
} from "../src/provider-real-filesystem-source.js";
import type {
  ProviderReleaseTargetUniverseEnvelopeV1,
} from "../src/provider-release-target-universe-point.js";
import {
  createProviderPublicSupportTaxonomySignatureMessageV1,
  deriveProviderPublicSupportTaxonomyContentDigestV1,
  type ProviderPublicSupportTaxonomyEnvelopeV1,
  type ProviderReleaseMatrixEnvelopeV1,
  type ProviderTargetDiscoveryFixtureManifestEnvelopeV1,
  type ProviderTargetDiscoveryResultEnvelopeV1,
  type ProviderTargetDiscoveryRunnerRunEnvelopeV1,
} from "../src/provider-target-discovery-point.js";
import {
  registerProviderDistributionHistoricalVerifiedSignatureInternalV1,
  registerProviderDistributionValidatedCurrentTipCatalogInternalV1,
  takeProviderDistributionCurrentTipSemanticTokensInternalV1,
  validateProviderDistributionHistoricalBundleSemanticInternalV1,
  validateProviderDistributionHistoricalCatalogSemanticInternalV1,
  validateProviderDistributionHistoricalCorpusSemanticInternalV1,
  validateProviderDistributionHistoricalMatrixSemanticInternalV1,
  validateProviderDistributionHistoricalResultSemanticInternalV1,
  validateProviderDistributionHistoricalSuiteSemanticInternalV1,
  validateProviderDistributionHistoricalTaxonomySemanticInternalV1,
  validateProviderDistributionHistoricalUniverseSemanticInternalV1,
  type ProviderDistributionHistoricalSignedObjectKindInternalV1,
} from "../src/provider-distribution-historical-semantic-internal.js";

interface SemanticFixtureV1 {
  readonly fixtureCorpusManifest: ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1;
  readonly providerFeasibilitySupportCatalog: ProviderFeasibilitySupportCatalogEnvelopeV1;
  readonly publicSupportTaxonomy: ProviderPublicSupportTaxonomyEnvelopeV1;
  readonly releaseMatrix: ProviderReleaseMatrixEnvelopeV1;
  readonly releaseTargetUniverse: ProviderReleaseTargetUniverseEnvelopeV1;
  readonly suiteManifest: ProviderRealFilesystemSuiteManifestEnvelopeV1;
  readonly targetDiscoveryFixtureManifest: ProviderTargetDiscoveryFixtureManifestEnvelopeV1;
  readonly targetDiscoveryResult: ProviderTargetDiscoveryResultEnvelopeV1;
  readonly targetDiscoveryRunnerRun: ProviderTargetDiscoveryRunnerRunEnvelopeV1;
}

function loadJsonV1(relativePath: string): unknown {
  return JSON.parse(
    readFileSync(
      fileURLToPath(new URL(`../${relativePath}`, import.meta.url)),
      "utf8",
    ),
  ) as unknown;
}

const catalogGolden = loadJsonV1(
  "fixtures/v1/golden/provider-feasibility-support-catalog-point-v1.json",
) as {
  readonly positiveVectors: readonly [
    { readonly request: SemanticFixtureV1 },
    ...unknown[],
  ];
};
const targetDiscoveryGolden = loadJsonV1(
  "fixtures/v1/golden/provider-target-discovery-point-v1.json",
) as { readonly deterministicRootSeedHex: string };

function cloneV1<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepFreezeV1<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) deepFreezeV1(child);
    Object.freeze(value);
  }
  return value;
}

function fixtureV1(): SemanticFixtureV1 {
  const request = catalogGolden.positiveVectors[0].request;
  return deepFreezeV1({
    fixtureCorpusManifest: cloneV1(request.fixtureCorpusManifest),
    providerFeasibilitySupportCatalog: cloneV1(
      request.providerFeasibilitySupportCatalog,
    ),
    publicSupportTaxonomy: cloneV1(request.publicSupportTaxonomy),
    releaseMatrix: cloneV1(request.releaseMatrix),
    releaseTargetUniverse: cloneV1(request.releaseTargetUniverse),
    suiteManifest: cloneV1(request.suiteManifest),
    targetDiscoveryFixtureManifest: cloneV1(
      request.targetDiscoveryFixtureManifest,
    ),
    targetDiscoveryResult: cloneV1(request.targetDiscoveryResult),
    targetDiscoveryRunnerRun: cloneV1(request.targetDiscoveryRunnerRun),
  });
}

function witnessV1(
  kind: ProviderDistributionHistoricalSignedObjectKindInternalV1,
  signedObject: object,
) {
  return registerProviderDistributionHistoricalVerifiedSignatureInternalV1(
    kind,
    signedObject,
    0,
    2,
  );
}

function requireTokenV1<T>(token: T | undefined, label: string): T {
  if (token === undefined) throw new TypeError(`${label} semantic token missing`);
  return token;
}

function validateFullHistoricalCutV1(fixture: SemanticFixtureV1): void {
  const taxonomyToken = requireTokenV1(
    validateProviderDistributionHistoricalTaxonomySemanticInternalV1(
      fixture.publicSupportTaxonomy,
      witnessV1(
        "public_support_taxonomy",
        fixture.publicSupportTaxonomy.payload,
      ),
    ),
    "taxonomy",
  );
  const matrixToken = requireTokenV1(
    validateProviderDistributionHistoricalMatrixSemanticInternalV1(
      fixture.releaseMatrix,
      fixture.publicSupportTaxonomy,
      taxonomyToken,
      witnessV1("release_matrix", fixture.releaseMatrix.payload),
    ),
    "matrix",
  );
  const corpusToken = requireTokenV1(
    validateProviderDistributionHistoricalCorpusSemanticInternalV1(
      fixture.fixtureCorpusManifest,
      witnessV1(
        "real_filesystem_fixture_corpus",
        fixture.fixtureCorpusManifest.payload,
      ),
    ),
    "corpus",
  );
  const suiteToken = requireTokenV1(
    validateProviderDistributionHistoricalSuiteSemanticInternalV1(
      fixture.suiteManifest,
      fixture.fixtureCorpusManifest,
      corpusToken,
      witnessV1("real_filesystem_suite", fixture.suiteManifest.payload),
    ),
    "suite",
  );
  const bundle = fixture.targetDiscoveryResult.payload
    .targetDiscoveryInputBundle;
  const bundleToken = requireTokenV1(
    validateProviderDistributionHistoricalBundleSemanticInternalV1(
      {
        bundle,
        fixtureEnvelope: fixture.targetDiscoveryFixtureManifest,
        runnerEnvelope: fixture.targetDiscoveryRunnerRun,
        taxonomyEnvelope: fixture.publicSupportTaxonomy,
        taxonomyToken,
        matrixEnvelope: fixture.releaseMatrix,
        matrixToken,
        suiteEnvelope: fixture.suiteManifest,
        suiteToken,
      },
      witnessV1("target_discovery_input_bundle", bundle),
    ),
    "bundle",
  );
  const resultToken = requireTokenV1(
    validateProviderDistributionHistoricalResultSemanticInternalV1(
      fixture.targetDiscoveryResult,
      bundle,
      bundleToken,
      witnessV1(
        "target_discovery_result",
        fixture.targetDiscoveryResult.payload,
      ),
    ),
    "result",
  );
  const universeToken = requireTokenV1(
    validateProviderDistributionHistoricalUniverseSemanticInternalV1(
      fixture.releaseTargetUniverse,
      fixture.targetDiscoveryResult,
      resultToken,
      witnessV1(
        "release_target_universe",
        fixture.releaseTargetUniverse.payload,
      ),
    ),
    "universe",
  );
  requireTokenV1(
    validateProviderDistributionHistoricalCatalogSemanticInternalV1(
      fixture.providerFeasibilitySupportCatalog,
      fixture.releaseTargetUniverse,
      universeToken,
      witnessV1(
        "feasibility_support_catalog",
        fixture.providerFeasibilitySupportCatalog.payload,
      ),
    ),
    "catalog",
  );
}

function resignOrderingInvalidTaxonomyV1(
  source: ProviderPublicSupportTaxonomyEnvelopeV1,
): ProviderPublicSupportTaxonomyEnvelopeV1 {
  const envelope = cloneV1(source);
  envelope.payload.osReleaseFamilies.reverse();
  const privateKey = createPrivateKey({
    key: Buffer.concat([
      Buffer.from("302e020100300506032b657004220420", "hex"),
      Buffer.from(targetDiscoveryGolden.deterministicRootSeedHex, "hex"),
    ]),
    format: "der",
    type: "pkcs8",
  });
  envelope.payload.taxonomySignature =
    `provider-public-support-taxonomy-ed25519:${envelope.payload.registryRootKeyId}:${"00".repeat(64)}` as typeof envelope.payload.taxonomySignature;
  const message = createProviderPublicSupportTaxonomySignatureMessageV1(
    envelope.payload,
    envelope.payload.registryRootKeyId,
  );
  const signature = sign(null, Buffer.from(message), privateKey);
  envelope.payload.taxonomySignature =
    `provider-public-support-taxonomy-ed25519:${envelope.payload.registryRootKeyId}:${signature.toString("hex")}` as typeof envelope.payload.taxonomySignature;
  envelope.contentDigest = deriveProviderPublicSupportTaxonomyContentDigestV1(
    envelope.payload,
  );
  expect(
    verify(
      null,
      Buffer.from(
        createProviderPublicSupportTaxonomySignatureMessageV1(
          envelope.payload,
          envelope.payload.registryRootKeyId,
        ),
      ),
      createPublicKey(privateKey),
      signature,
    ),
  ).toBe(true);
  return deepFreezeV1(envelope);
}

describe("retained historical no-crypto semantic bridge", () => {
  it("validates the complete legal retained cut with zero crypto callbacks", () => {
    cryptoCallbacks.point.mockClear();
    cryptoCallbacks.signature.mockClear();
    validateFullHistoricalCutV1(fixtureV1());
    expect(cryptoCallbacks.point).toHaveBeenCalledTimes(0);
    expect(cryptoCallbacks.signature).toHaveBeenCalledTimes(0);
  });

  it("rejects a validly re-signed taxonomy whose record order is semantic-invalid", () => {
    cryptoCallbacks.point.mockClear();
    cryptoCallbacks.signature.mockClear();
    const taxonomy = resignOrderingInvalidTaxonomyV1(
      fixtureV1().publicSupportTaxonomy,
    );
    const token = validateProviderDistributionHistoricalTaxonomySemanticInternalV1(
      taxonomy,
      witnessV1("public_support_taxonomy", taxonomy.payload),
    );
    expect(token).toBeUndefined();
    expect(cryptoCallbacks.point).toHaveBeenCalledTimes(0);
    expect(cryptoCallbacks.signature).toHaveBeenCalledTimes(0);
  });

  it("burns wrong-handle entries, rejects replay, and fails closed on core throw", () => {
    const left = fixtureV1().publicSupportTaxonomy;
    const right = fixtureV1().publicSupportTaxonomy;
    const leftWitness = witnessV1("public_support_taxonomy", left.payload);
    const rightWitness = witnessV1("public_support_taxonomy", right.payload);
    expect(
      validateProviderDistributionHistoricalTaxonomySemanticInternalV1(
        left,
        rightWitness,
      ),
    ).toBeUndefined();
    expect(
      validateProviderDistributionHistoricalTaxonomySemanticInternalV1(
        left,
        leftWitness,
      ),
    ).toBeUndefined();
    expect(
      validateProviderDistributionHistoricalTaxonomySemanticInternalV1(
        right,
        rightWitness,
      ),
    ).toBeUndefined();

    const replay = fixtureV1().publicSupportTaxonomy;
    const replayWitness = witnessV1(
      "public_support_taxonomy",
      replay.payload,
    );
    expect(
      validateProviderDistributionHistoricalTaxonomySemanticInternalV1(
        replay,
        replayWitness,
      ),
    ).toBeDefined();
    expect(
      validateProviderDistributionHistoricalTaxonomySemanticInternalV1(
        replay,
        replayWitness,
      ),
    ).toBeUndefined();

    const malformed = deepFreezeV1({ payload: {} });
    const malformedWitness = witnessV1(
      "public_support_taxonomy",
      malformed.payload,
    );
    expect(
      validateProviderDistributionHistoricalTaxonomySemanticInternalV1(
        malformed as ProviderPublicSupportTaxonomyEnvelopeV1,
        malformedWitness,
      ),
    ).toBeUndefined();
    expect(
      validateProviderDistributionHistoricalTaxonomySemanticInternalV1(
        malformed as ProviderPublicSupportTaxonomyEnvelopeV1,
        malformedWitness,
      ),
    ).toBeUndefined();

    const earlyFailure = fixtureV1().publicSupportTaxonomy;
    const earlyFailureWitness = witnessV1(
      "public_support_taxonomy",
      earlyFailure.payload,
    );
    expect(
      validateProviderDistributionHistoricalTaxonomySemanticInternalV1(
        undefined as unknown as ProviderPublicSupportTaxonomyEnvelopeV1,
        earlyFailureWitness,
      ),
    ).toBeUndefined();
    expect(
      validateProviderDistributionHistoricalTaxonomySemanticInternalV1(
        earlyFailure,
        earlyFailureWitness,
      ),
    ).toBeUndefined();

    const dependencyFailure = fixtureV1();
    const matrixWitness = witnessV1(
      "release_matrix",
      dependencyFailure.releaseMatrix.payload,
    );
    expect(
      validateProviderDistributionHistoricalMatrixSemanticInternalV1(
        dependencyFailure.releaseMatrix,
        dependencyFailure.publicSupportTaxonomy,
        Object.freeze({}) as never,
        matrixWitness,
      ),
    ).toBeUndefined();
    const dependencyTaxonomyToken = requireTokenV1(
      validateProviderDistributionHistoricalTaxonomySemanticInternalV1(
        dependencyFailure.publicSupportTaxonomy,
        witnessV1(
          "public_support_taxonomy",
          dependencyFailure.publicSupportTaxonomy.payload,
        ),
      ),
      "dependency taxonomy",
    );
    expect(
      validateProviderDistributionHistoricalMatrixSemanticInternalV1(
        dependencyFailure.releaseMatrix,
        dependencyFailure.publicSupportTaxonomy,
        dependencyTaxonomyToken,
        matrixWitness,
      ),
    ).toBeUndefined();
  });

  it("refuses to issue a witness for the history tip", () => {
    const taxonomy = fixtureV1().publicSupportTaxonomy;
    expect(() =>
      registerProviderDistributionHistoricalVerifiedSignatureInternalV1(
        "public_support_taxonomy",
        taxonomy.payload,
        1,
        2,
      )
    ).toThrow(TypeError);
    expect(() =>
      registerProviderDistributionHistoricalVerifiedSignatureInternalV1(
        "forged_kind" as ProviderDistributionHistoricalSignedObjectKindInternalV1,
        taxonomy.payload,
        0,
        2,
      )
    ).toThrow(TypeError);
  });

  it("burns a cross-wired current-Catalog proof, rejects replay, and binds dependency tokens to exact tip identity", () => {
    cryptoCallbacks.point.mockClear();
    cryptoCallbacks.signature.mockClear();
    const left = fixtureV1();
    const right = fixtureV1();
    const crossWiredClosure = Object.freeze(Object.create(null)) as object;
    registerProviderDistributionValidatedCurrentTipCatalogInternalV1(
      crossWiredClosure,
      left,
    );
    expect(
      takeProviderDistributionCurrentTipSemanticTokensInternalV1(
        crossWiredClosure,
        right,
      ),
    ).toBeUndefined();
    expect(
      takeProviderDistributionCurrentTipSemanticTokensInternalV1(
        crossWiredClosure,
        left,
      ),
    ).toBeUndefined();

    const validClosure = Object.freeze(Object.create(null)) as object;
    registerProviderDistributionValidatedCurrentTipCatalogInternalV1(
      validClosure,
      left,
    );
    const tokens = takeProviderDistributionCurrentTipSemanticTokensInternalV1(
      validClosure,
      left,
    );
    expect(tokens).toBeDefined();
    expect(Object.isFrozen(tokens)).toBe(true);
    expect(
      takeProviderDistributionCurrentTipSemanticTokensInternalV1(
        validClosure,
        left,
      ),
    ).toBeUndefined();
    if (tokens === undefined) throw new TypeError("current tip tokens missing");

    const matrixWitness = witnessV1(
      "release_matrix",
      left.releaseMatrix.payload,
    );
    expect(
      validateProviderDistributionHistoricalMatrixSemanticInternalV1(
        left.releaseMatrix,
        right.publicSupportTaxonomy,
        tokens.taxonomyToken,
        matrixWitness,
      ),
    ).toBeUndefined();
    expect(
      validateProviderDistributionHistoricalMatrixSemanticInternalV1(
        left.releaseMatrix,
        left.publicSupportTaxonomy,
        tokens.taxonomyToken,
        matrixWitness,
      ),
    ).toBeUndefined();
    expect(cryptoCallbacks.point).toHaveBeenCalledTimes(0);
    expect(cryptoCallbacks.signature).toHaveBeenCalledTimes(0);
  });
});

void deriveProviderFeasibilitySupportCatalogContentDigestV1;
