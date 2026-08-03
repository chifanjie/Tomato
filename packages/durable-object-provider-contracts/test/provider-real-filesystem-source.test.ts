import {
  createPrivateKey,
  createPublicKey,
  sign,
  type KeyObject,
} from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

import { ProviderBootstrapTrustGoldenManifestV1Schema } from "../src/bootstrap-trust-golden.js";
import {
  ContentDigestV1Schema,
  ProviderRealFilesystemCrashCutIdV1Schema,
} from "../src/primitives.js";
import {
  ProviderRegistryRootPublicKeyV1Schema,
  deriveProviderEd25519PublicKeyDigestInternalV1,
  deriveProviderRegistryRootKeyIdInternalV1,
} from "../src/provider-registry-trust.js";
import {
  ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1Schema,
  ProviderRealFilesystemFixtureCorpusManifestV1Schema,
  ProviderRealFilesystemSuiteManifestEnvelopeV1Schema,
  ProviderRealFilesystemSuiteManifestV1Schema,
  ProviderRealFilesystemSourceClosureValidationError,
  buildProviderRealFilesystemFixtureCorpusManifestRelativePathV1,
  buildProviderRealFilesystemSuiteManifestRelativePathV1,
  createProviderRealFilesystemFixtureCorpusManifestSignatureMessageV1,
  createProviderRealFilesystemSuiteManifestSignatureMessageV1,
  deriveProviderRealFilesystemCaseIdV1,
  deriveProviderRealFilesystemCrashCutIdV1,
  deriveProviderRealFilesystemFixtureCaseRecordSetDigestV1,
  deriveProviderRealFilesystemFixtureCorpusManifestContentDigestV1,
  deriveProviderRealFilesystemFixtureCorpusRecordSetDigestV1,
  deriveProviderRealFilesystemFixtureManifestDigestV1,
  deriveProviderRealFilesystemFixtureProgramContentDigestV1,
  deriveProviderRealFilesystemRecoveryAssertionContentDigestV1,
  deriveProviderRealFilesystemRequiredCaseCutSetDigestV1,
  deriveProviderRealFilesystemRunnerProfileDigestV1,
  deriveProviderRealFilesystemSuiteCaseSetDigestV1,
  deriveProviderRealFilesystemSuiteDigestV1,
  deriveProviderRealFilesystemSuiteManifestContentDigestV1,
  diagnoseProviderRealFilesystemSourceClosureV1,
  validateProviderRealFilesystemSourceClosureV1,
  type ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1,
  type ProviderRealFilesystemFixtureCorpusRecordV1,
  type ProviderRealFilesystemRequiredCaseCutEntryV1,
  type ProviderRealFilesystemSuiteCaseV1,
  type ProviderRealFilesystemSuiteManifestEnvelopeV1,
  type ValidateProviderRealFilesystemSourceClosureV1Input,
} from "../src/provider-real-filesystem-source.js";
import {
  PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1,
  PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
  attestProviderStrictEd25519CryptoHostV1,
  type ProviderStrictEd25519OpaqueCapabilityV1,
} from "../src/strict-ed25519-conformance.js";
import {
  STRICT_ED25519_VERIFICATION_PROFILE_V1,
  validatePrimeSubgroupPoint,
  verifyRawEd25519,
} from "../src/strict-ed25519.js";

const strictManifestBytes = new Uint8Array(
  readFileSync(
    fileURLToPath(
      new URL(
        "../provider/ed25519-strict-host-conformance-v1.json",
        import.meta.url,
      ),
    ),
  ),
);
const bootstrapGolden = ProviderBootstrapTrustGoldenManifestV1Schema.parse(
  JSON.parse(
    readFileSync(
      fileURLToPath(
        new URL(
          "../fixtures/v1/golden/provider-bootstrap-structure-crypto-v1.json",
          import.meta.url,
        ),
      ),
      "utf8",
    ),
  ),
);

interface DeterministicRootV1 {
  readonly privateKey: KeyObject;
  readonly publicKey: ReturnType<
    typeof ProviderRegistryRootPublicKeyV1Schema.parse
  >;
}

function deterministicRootV1(): DeterministicRootV1 {
  const privateKey = createPrivateKey({
    key: Buffer.concat([
      Buffer.from("302e020100300506032b657004220420", "hex"),
      Buffer.alloc(32, 61),
    ]),
    format: "der",
    type: "pkcs8",
  });
  const publicDer = createPublicKey(privateKey).export({
    format: "der",
    type: "spki",
  });
  const publicKeyBytes = `base64url:${Buffer.from(
    publicDer.subarray(publicDer.byteLength - 32),
  ).toString("base64url")}`;
  return {
    privateKey,
    publicKey: ProviderRegistryRootPublicKeyV1Schema.parse({
      profile: "provider_registry_root_public_key_v1",
      rootKeyId: deriveProviderRegistryRootKeyIdInternalV1({
        publicKeyBytes,
      }),
      algorithm: "ed25519",
      publicKeyBytes,
      publicKeyDigest:
        deriveProviderEd25519PublicKeyDigestInternalV1(publicKeyBytes),
    }),
  };
}

function canonicalBytes(value: string): `base64url:${string}` {
  return `base64url:${Buffer.from(value, "utf8").toString("base64url")}`;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

const root = deterministicRootV1();
const signedPackageVector =
  bootstrapGolden.vectors.signedPackageIdentityDigest;
const distributionRootBinding = {
  profile: "provider_signed_distribution_root_binding_v1" as const,
  signedPackageIdentityDigest:
    signedPackageVector.expected.contentDigest,
  ...clone(signedPackageVector.fields),
};
const activeRootMetadata = {
  locatorProfile: "installation_provider_registry_root_metadata_v1" as const,
  rootGeneration: 1,
  rootKeyId: root.publicKey.rootKeyId,
  contentDigest: ContentDigestV1Schema.parse(`sha256:${"9".repeat(64)}`),
};

let capability: ProviderStrictEd25519OpaqueCapabilityV1;

beforeAll(async () => {
  capability = await attestProviderStrictEd25519CryptoHostV1({
    host: Object.freeze({
      verificationProfile: STRICT_ED25519_VERIFICATION_PROFILE_V1,
      validatePrimeSubgroupPoint,
      verifyRawEd25519,
    }),
    resourceHost: Object.freeze({
      readFixedSignedPackageResource(
        path: typeof PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
        maxBytes: typeof PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1,
      ) {
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

function signSource(
  prefix:
    | "provider-real-fs-fixture-corpus-ed25519"
    | "provider-real-fs-suite-manifest-ed25519",
  message: Uint8Array,
): string {
  return `${prefix}:${root.publicKey.rootKeyId}:${sign(
    null,
    Buffer.from(message),
    root.privateKey,
  ).toString("hex")}`;
}

function fixtureRecord(
  caseKey: string,
  fixtureOrdinal: number,
  fixtureRole: "setup" | "operation" | "assertion",
  program: string,
): ProviderRealFilesystemFixtureCorpusRecordV1 {
  const fixtureProgramBytes = canonicalBytes(program);
  return {
    caseKey: caseKey as ProviderRealFilesystemFixtureCorpusRecordV1["caseKey"],
    fixtureOrdinal,
    fixtureRole,
    fixtureProgramProfile: "provider_real_fs_fixture_program_v1",
    fixtureProgramBytes:
      fixtureProgramBytes as ProviderRealFilesystemFixtureCorpusRecordV1["fixtureProgramBytes"],
    fixtureProgramContentDigest:
      deriveProviderRealFilesystemFixtureProgramContentDigestV1({
        fixtureProgramProfile: "provider_real_fs_fixture_program_v1",
        fixtureProgramBytes,
      }),
    fixtureProgramLogicalBytes: Buffer.byteLength(program, "utf8"),
  };
}

function buildCorpus(): ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1 {
  const records = [
    fixtureRecord("atomic-publish", 0, "setup", "setup:empty-root"),
    fixtureRecord("atomic-publish", 1, "operation", "publish:alpha"),
    fixtureRecord("atomic-publish", 2, "assertion", "assert:alpha-visible"),
    fixtureRecord("restart-recovery", 0, "setup", "setup:journal"),
    fixtureRecord("restart-recovery", 1, "operation", "commit:journal"),
    fixtureRecord("restart-recovery", 2, "assertion", "assert:recovered"),
  ];
  const recordSetDigest =
    deriveProviderRealFilesystemFixtureCorpusRecordSetDigestV1({ records });
  const fixtureManifestDigest =
    deriveProviderRealFilesystemFixtureManifestDigestV1({
      corpusVersion: "1.0.0",
      recordCount: records.length,
      recordSetDigest,
      records,
    });
  const unsigned = {
    profile: "provider_real_fs_fixture_corpus_manifest_v1" as const,
    distributionRootBinding,
    activeRootMetadata,
    registryRootKeyId: root.publicKey.rootKeyId,
    releaseRevisionDigest: distributionRootBinding.releaseRevisionDigest,
    corpusVersion: "1.0.0",
    recordCount: records.length,
    recordSetDigest,
    records,
    fixtureManifestDigest,
  };
  const corpusSignature = signSource(
    "provider-real-fs-fixture-corpus-ed25519",
    createProviderRealFilesystemFixtureCorpusManifestSignatureMessageV1(
      unsigned,
      root.publicKey.rootKeyId,
    ),
  );
  const payload = ProviderRealFilesystemFixtureCorpusManifestV1Schema.parse({
    ...unsigned,
    corpusSignature,
  });
  return ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1Schema.parse({
    schemaVersion: 1,
    recordType: "provider_real_fs_fixture_corpus_manifest",
    contentDigest:
      deriveProviderRealFilesystemFixtureCorpusManifestContentDigestV1(
        payload,
      ),
    payload,
  });
}

function buildSuite(
  corpus: ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1,
): ProviderRealFilesystemSuiteManifestEnvelopeV1 {
  const recordsByCase = new Map<string, ProviderRealFilesystemFixtureCorpusRecordV1[]>();
  for (const record of corpus.payload.records) {
    const records = recordsByCase.get(record.caseKey) ?? [];
    records.push(record);
    recordsByCase.set(record.caseKey, records);
  }
  const cases: ProviderRealFilesystemSuiteCaseV1[] = [];
  for (const [caseKey, records] of recordsByCase) {
    const fixtureRecordSetDigest =
      deriveProviderRealFilesystemFixtureCaseRecordSetDigestV1({
        caseKey,
        records,
      });
    const caseId = deriveProviderRealFilesystemCaseIdV1({
      caseKey,
      fixtureRecordCount: records.length,
      fixtureRecordSetDigest,
    });
    const recoveryAssertionBytes = canonicalBytes(`recover:${caseKey}`);
    const recoveryAssertionContentDigest =
      deriveProviderRealFilesystemRecoveryAssertionContentDigestV1({
        recoveryAssertionProfile:
          "provider_real_fs_recovery_assertion_v1",
        recoveryAssertionBytes,
      });
    const injection = {
      state: "after_fixture_operation" as const,
      afterFixtureOrdinal: 1,
    };
    const crashCutId = deriveProviderRealFilesystemCrashCutIdV1({
      caseId,
      crashCutOrdinal: 1,
      injection,
      recoveryAssertionContentDigest,
    });
    cases.push({
      caseId,
      caseKey: caseKey as ProviderRealFilesystemSuiteCaseV1["caseKey"],
      fixtureRecordCount: records.length,
      fixtureRecordSetDigest,
      requiredCrashCuts: [
        {
          crashCutId:
            ProviderRealFilesystemCrashCutIdV1Schema.parse("no-crash"),
          crashCutOrdinal: 0,
          injection: { state: "none" },
        },
        {
          crashCutId,
          crashCutOrdinal: 1,
          injection,
          recoveryAssertionProfile:
            "provider_real_fs_recovery_assertion_v1",
          recoveryAssertionBytes:
            recoveryAssertionBytes as ProviderRealFilesystemFixtureCorpusRecordV1["fixtureProgramBytes"],
          recoveryAssertionContentDigest,
        },
      ] as ProviderRealFilesystemSuiteCaseV1["requiredCrashCuts"],
    });
  }
  cases.sort((left, right) => left.caseId.localeCompare(right.caseId));
  const requiredEntries = cases
    .flatMap((suiteCase) =>
      suiteCase.requiredCrashCuts.map((cut) => ({
        caseId: suiteCase.caseId,
        crashCutId: cut.crashCutId,
      })),
    )
    .sort((left, right) =>
      left.caseId === right.caseId
        ? left.crashCutId.localeCompare(right.crashCutId)
        : left.caseId.localeCompare(right.caseId),
    ) as ProviderRealFilesystemRequiredCaseCutEntryV1[];
  const runnerProfile = {
    profile: "provider_real_fs_runner_profile_v1" as const,
    protocolVersion: "provider-real-fs-runner-v1" as const,
    canonicalProfileBytes: canonicalBytes("runner:v1:no-network"),
  };
  const runnerProfileDigest =
    deriveProviderRealFilesystemRunnerProfileDigestV1(runnerProfile);
  const caseSetDigest =
    deriveProviderRealFilesystemSuiteCaseSetDigestV1({ cases });
  const requiredCaseCutSetDigest =
    deriveProviderRealFilesystemRequiredCaseCutSetDigestV1({
      entries: requiredEntries,
    });
  const fixtureCorpusManifest = {
    locatorProfile:
      "distribution_provider_real_fs_fixture_corpus_manifest_v1" as const,
    distributionRootBinding: clone(distributionRootBinding),
    fixtureManifestDigest: corpus.payload.fixtureManifestDigest,
    contentDigest: corpus.contentDigest,
  };
  const definition = {
    suiteVersion: "1.0.0",
    fixtureManifestDigest: fixtureCorpusManifest.fixtureManifestDigest,
    runnerProfileDigest,
    caseCount: cases.length,
    caseSetDigest,
    requiredCaseCutCount: requiredEntries.length,
    requiredCaseCutSetDigest,
    cases,
  };
  const unsigned = {
    profile: "provider_real_fs_suite_manifest_v1" as const,
    distributionRootBinding: clone(distributionRootBinding),
    activeRootMetadata: clone(activeRootMetadata),
    registryRootKeyId: root.publicKey.rootKeyId,
    releaseRevisionDigest: distributionRootBinding.releaseRevisionDigest,
    suiteVersion: definition.suiteVersion,
    fixtureCorpusManifest,
    runnerProfile,
    runnerProfileDigest,
    caseCount: definition.caseCount,
    caseSetDigest,
    requiredCaseCutCount: definition.requiredCaseCutCount,
    requiredCaseCutSetDigest,
    cases,
    suiteDigest: deriveProviderRealFilesystemSuiteDigestV1(definition),
  };
  const suiteSignature = signSource(
    "provider-real-fs-suite-manifest-ed25519",
    createProviderRealFilesystemSuiteManifestSignatureMessageV1(
      unsigned,
      root.publicKey.rootKeyId,
    ),
  );
  const payload = ProviderRealFilesystemSuiteManifestV1Schema.parse({
    ...unsigned,
    suiteSignature,
  });
  return ProviderRealFilesystemSuiteManifestEnvelopeV1Schema.parse({
    schemaVersion: 1,
    recordType: "provider_real_fs_suite_manifest",
    contentDigest:
      deriveProviderRealFilesystemSuiteManifestContentDigestV1(payload),
    payload,
  });
}

function sourceInput(): ValidateProviderRealFilesystemSourceClosureV1Input {
  const fixtureCorpusManifest = buildCorpus();
  return {
    distributionRootBinding,
    activeRootMetadata,
    activeRoot: root.publicKey,
    fixtureCorpusManifest,
    suiteManifest: buildSuite(fixtureCorpusManifest),
    strictCryptoCapability: capability,
  };
}

describe("signed real filesystem source closure", () => {
  it("validates Corpus -> Suite without promoting execution authority", async () => {
    const result = await validateProviderRealFilesystemSourceClosureV1(
      sourceInput(),
    );
    expect(result.authority).toBe("none_real_fs_source_structure_only");
    expect(result.recordCount).toBe(6);
    expect(result.caseCount).toBe(2);
    expect(result.requiredCaseCutCount).toBe(4);
    expect(result.fixtureCorpusManifestRelativePath).toMatch(
      /^provider\/real-fs-fixture-corpus-manifests\/id-[0-9a-v]+\.json$/u,
    );
    expect(result.suiteManifestRelativePath).toMatch(
      /^provider\/real-fs-suite-manifests\/id-[0-9a-v]+\.json$/u,
    );
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("uses only full signed-payload content digests in locators", () => {
    const input = sourceInput();
    expect(
      buildProviderRealFilesystemFixtureCorpusManifestRelativePathV1(
        input.fixtureCorpusManifest,
      ),
    ).toContain("provider/real-fs-fixture-corpus-manifests/");
    expect(
      buildProviderRealFilesystemSuiteManifestRelativePathV1(
        input.suiteManifest,
      ),
    ).toContain("provider/real-fs-suite-manifests/");
    const semanticDigestSubstitution = clone(input.suiteManifest);
    semanticDigestSubstitution.contentDigest =
      input.suiteManifest.payload.suiteDigest;
    expect(() =>
      buildProviderRealFilesystemSuiteManifestRelativePathV1(
        semanticDigestSubstitution,
      ),
    ).toThrow();
    expect(() =>
      buildProviderRealFilesystemSuiteManifestRelativePathV1({
        locatorProfile: "distribution_provider_real_fs_suite_manifest_v1",
        contentDigest: input.suiteManifest.payload.suiteDigest,
      }),
    ).toThrow();
  });

  it("rejects a stale Envelope digest after a valid-looking signature change", async () => {
    const input = sourceInput();
    const changed: ValidateProviderRealFilesystemSourceClosureV1Input = {
      ...input,
      fixtureCorpusManifest: clone(input.fixtureCorpusManifest),
      suiteManifest: clone(input.suiteManifest),
    };
    const signature = changed.fixtureCorpusManifest.payload.corpusSignature;
    changed.fixtureCorpusManifest.payload.corpusSignature =
      `${signature.slice(0, -1)}${signature.endsWith("0") ? "1" : "0"}` as typeof signature;
    const diagnostic =
      await diagnoseProviderRealFilesystemSourceClosureV1(changed);
    expect(diagnostic).toEqual({
      ok: false,
      stage: "corpus_signature",
      reason: "signature_invalid",
    });
    await expect(
      validateProviderRealFilesystemSourceClosureV1(changed),
    ).rejects.toBeInstanceOf(
      ProviderRealFilesystemSourceClosureValidationError,
    );
  });

  it("rejects Corpus ordering and Suite exact-cover substitutions", async () => {
    const reordered = sourceInput();
    [
      reordered.fixtureCorpusManifest.payload.records[0],
      reordered.fixtureCorpusManifest.payload.records[1],
    ] = [
      reordered.fixtureCorpusManifest.payload.records[1]!,
      reordered.fixtureCorpusManifest.payload.records[0]!,
    ];
    await expect(
      diagnoseProviderRealFilesystemSourceClosureV1(reordered),
    ).resolves.toMatchObject({
      ok: false,
      stage: "corpus_structure",
      reason: "ordering_invalid",
    });

    const omitted = sourceInput();
    omitted.suiteManifest.payload.cases.pop();
    await expect(
      diagnoseProviderRealFilesystemSourceClosureV1(omitted),
    ).resolves.toMatchObject({
      ok: false,
      stage: "suite_structure",
    });
  });

  it("rejects duplicate flattened required case-cut tuples before digest use", async () => {
    const duplicated = sourceInput();
    const repeatedCut = clone(
      duplicated.suiteManifest.payload.cases[0]!.requiredCrashCuts[1]!,
    );
    repeatedCut.crashCutOrdinal = 2;
    duplicated.suiteManifest.payload.cases[0]!.requiredCrashCuts.push(
      repeatedCut,
    );
    await expect(
      diagnoseProviderRealFilesystemSourceClosureV1(duplicated),
    ).resolves.toEqual({
      ok: false,
      stage: "suite_structure",
      reason: "ordering_invalid",
    });
  });

  it("rejects a Suite pin that preserves semantic digest but changes full locator", async () => {
    const changed = sourceInput();
    changed.suiteManifest.payload.fixtureCorpusManifest.contentDigest =
      ContentDigestV1Schema.parse(`sha256:${"0".repeat(64)}`);
    await expect(
      diagnoseProviderRealFilesystemSourceClosureV1(changed),
    ).resolves.toEqual({
      ok: false,
      stage: "suite_corpus_pin",
      reason: "binding_mismatch",
    });
  });
});
