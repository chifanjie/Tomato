import {
  createPrivateKey,
  sign,
} from "node:crypto";

import {
  canonicalizeJcsSafeIntegerUtf8V1,
} from "../../dist/jcs.js";
import {
  ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1Schema,
  ProviderRealFilesystemFixtureCorpusManifestV1Schema,
  ProviderRealFilesystemSuiteManifestEnvelopeV1Schema,
  ProviderRealFilesystemSuiteManifestV1Schema,
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
} from "../../dist/provider-real-filesystem-source.js";

export const GOLDEN_RESOURCE_PATH =
  "fixtures/v1/golden/provider-real-filesystem-source-v1.json";
export const INVALID_RESOURCE_PATH =
  "fixtures/v1/invalid/provider-real-filesystem-source-v1.json";
export const GOLDEN_SEMANTIC_DOMAIN =
  "provider-real-fs-source-golden-manifest-v1";
export const INVALID_SEMANTIC_DOMAIN =
  "provider-real-fs-source-invalid-manifest-v1";
export const INVALID_RECIPE_DIALECT =
  "provider_real_fs_source_invalid_recipe_v1";

export function jsonClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function canonicalBytes(value) {
  return `base64url:${Buffer.from(value, "utf8").toString("base64url")}`;
}

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function privateKeyFromSeedHex(seedHex) {
  return createPrivateKey({
    key: Buffer.concat([
      Buffer.from("302e020100300506032b657004220420", "hex"),
      Buffer.from(seedHex, "hex"),
    ]),
    format: "der",
    type: "pkcs8",
  });
}

function sourceSignature(prefix, rootKeyId, privateKey, message) {
  return `${prefix}:${rootKeyId}:${sign(
    null,
    Buffer.from(message),
    privateKey,
  ).toString("hex")}`;
}

function fixtureRecord(caseKey, fixtureOrdinal, fixtureRole, program) {
  const fixtureProgramBytes = canonicalBytes(program);
  return {
    caseKey,
    fixtureOrdinal,
    fixtureRole,
    fixtureProgramProfile: "provider_real_fs_fixture_program_v1",
    fixtureProgramBytes,
    fixtureProgramContentDigest:
      deriveProviderRealFilesystemFixtureProgramContentDigestV1({
        fixtureProgramProfile: "provider_real_fs_fixture_program_v1",
        fixtureProgramBytes,
      }),
    fixtureProgramLogicalBytes: Buffer.byteLength(program, "utf8"),
  };
}

export function buildGoldenSourceFixture({
  distributionRootBinding,
  rootMetadataEnvelope,
  rootSeedHex,
}) {
  const activeRoot = jsonClone(rootMetadataEnvelope.payload.activeRoot);
  const activeRootMetadata = {
    locatorProfile: "installation_provider_registry_root_metadata_v1",
    rootGeneration: rootMetadataEnvelope.rootGeneration,
    rootKeyId: rootMetadataEnvelope.rootKeyId,
    contentDigest: rootMetadataEnvelope.contentDigest,
  };
  const rootPrivateKey = privateKeyFromSeedHex(rootSeedHex);
  const records = [
    fixtureRecord("atomic-publish", 0, "setup", "setup:empty-root"),
    fixtureRecord("atomic-publish", 1, "operation", "publish:alpha"),
    fixtureRecord("atomic-publish", 2, "assertion", "assert:alpha-visible"),
    fixtureRecord("compare-delete", 0, "setup", "setup:existing-object"),
    fixtureRecord("compare-delete", 1, "operation", "delete:expected-version"),
    fixtureRecord("compare-delete", 2, "assertion", "assert:object-absent"),
    fixtureRecord("restart-recovery", 0, "setup", "setup:journal"),
    fixtureRecord("restart-recovery", 1, "operation", "commit:journal"),
    fixtureRecord("restart-recovery", 2, "assertion", "assert:recovered"),
    fixtureRecord("root-containment", 0, "setup", "setup:bound-root"),
    fixtureRecord("root-containment", 1, "operation", "publish:unicode-\u8def\u5f84"),
    fixtureRecord("root-containment", 2, "assertion", "assert:no-escape\ncontrol"),
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
  const corpusUnsigned = {
    profile: "provider_real_fs_fixture_corpus_manifest_v1",
    distributionRootBinding: jsonClone(distributionRootBinding),
    activeRootMetadata: jsonClone(activeRootMetadata),
    registryRootKeyId: activeRoot.rootKeyId,
    releaseRevisionDigest: distributionRootBinding.releaseRevisionDigest,
    corpusVersion: "1.0.0",
    recordCount: records.length,
    recordSetDigest,
    records,
    fixtureManifestDigest,
  };
  const corpusSignatureMessage =
    createProviderRealFilesystemFixtureCorpusManifestSignatureMessageV1(
      corpusUnsigned,
      activeRoot.rootKeyId,
    );
  const corpusPayload =
    ProviderRealFilesystemFixtureCorpusManifestV1Schema.parse({
      ...corpusUnsigned,
      corpusSignature: sourceSignature(
        "provider-real-fs-fixture-corpus-ed25519",
        activeRoot.rootKeyId,
        rootPrivateKey,
        corpusSignatureMessage,
      ),
    });
  const fixtureCorpusManifest =
    ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1Schema.parse({
      schemaVersion: 1,
      recordType: "provider_real_fs_fixture_corpus_manifest",
      contentDigest:
        deriveProviderRealFilesystemFixtureCorpusManifestContentDigestV1(
          corpusPayload,
        ),
      payload: corpusPayload,
    });

  const recordsByCase = new Map();
  for (const record of records) {
    const caseRecords = recordsByCase.get(record.caseKey) ?? [];
    caseRecords.push(record);
    recordsByCase.set(record.caseKey, caseRecords);
  }
  const cases = [];
  for (const [caseKey, caseRecords] of recordsByCase) {
    const fixtureRecordSetDigest =
      deriveProviderRealFilesystemFixtureCaseRecordSetDigestV1({
        caseKey,
        records: caseRecords,
      });
    const caseId = deriveProviderRealFilesystemCaseIdV1({
      caseKey,
      fixtureRecordCount: caseRecords.length,
      fixtureRecordSetDigest,
    });
    const recoveryAssertionBytes = canonicalBytes(`recover:${caseKey}`);
    const recoveryAssertionContentDigest =
      deriveProviderRealFilesystemRecoveryAssertionContentDigestV1({
        recoveryAssertionProfile: "provider_real_fs_recovery_assertion_v1",
        recoveryAssertionBytes,
      });
    const injection = {
      state: "after_fixture_operation",
      afterFixtureOrdinal: 1,
    };
    cases.push({
      caseId,
      caseKey,
      fixtureRecordCount: caseRecords.length,
      fixtureRecordSetDigest,
      requiredCrashCuts: [
        {
          crashCutId: "no-crash",
          crashCutOrdinal: 0,
          injection: { state: "none" },
        },
        {
          crashCutId: deriveProviderRealFilesystemCrashCutIdV1({
            caseId,
            crashCutOrdinal: 1,
            injection,
            recoveryAssertionContentDigest,
          }),
          crashCutOrdinal: 1,
          injection,
          recoveryAssertionProfile:
            "provider_real_fs_recovery_assertion_v1",
          recoveryAssertionBytes,
          recoveryAssertionContentDigest,
        },
      ],
    });
  }
  cases.sort((left, right) => compareUtf8(left.caseId, right.caseId));
  const requiredEntries = cases
    .flatMap((suiteCase) =>
      suiteCase.requiredCrashCuts.map((cut) => ({
        caseId: suiteCase.caseId,
        crashCutId: cut.crashCutId,
      })),
    )
    .sort((left, right) => {
      const caseOrder = compareUtf8(left.caseId, right.caseId);
      return caseOrder !== 0
        ? caseOrder
        : compareUtf8(left.crashCutId, right.crashCutId);
    });
  const fixtureCorpusPin = {
    locatorProfile:
      "distribution_provider_real_fs_fixture_corpus_manifest_v1",
    distributionRootBinding: jsonClone(distributionRootBinding),
    fixtureManifestDigest,
    contentDigest: fixtureCorpusManifest.contentDigest,
  };
  const runnerProfile = {
    profile: "provider_real_fs_runner_profile_v1",
    protocolVersion: "provider-real-fs-runner-v1",
    canonicalProfileBytes: canonicalBytes(
      "runner:v1:no-network:no-follow:crash-injection",
    ),
  };
  const runnerProfileDigest =
    deriveProviderRealFilesystemRunnerProfileDigestV1(runnerProfile);
  const caseSetDigest =
    deriveProviderRealFilesystemSuiteCaseSetDigestV1({ cases });
  const requiredCaseCutSetDigest =
    deriveProviderRealFilesystemRequiredCaseCutSetDigestV1({
      entries: requiredEntries,
    });
  const suiteDefinition = {
    suiteVersion: "1.0.0",
    fixtureManifestDigest,
    runnerProfileDigest,
    caseCount: cases.length,
    caseSetDigest,
    requiredCaseCutCount: requiredEntries.length,
    requiredCaseCutSetDigest,
    cases,
  };
  const suiteUnsigned = {
    profile: "provider_real_fs_suite_manifest_v1",
    distributionRootBinding: jsonClone(distributionRootBinding),
    activeRootMetadata: jsonClone(activeRootMetadata),
    registryRootKeyId: activeRoot.rootKeyId,
    releaseRevisionDigest: distributionRootBinding.releaseRevisionDigest,
    suiteVersion: "1.0.0",
    fixtureCorpusManifest: fixtureCorpusPin,
    runnerProfile,
    runnerProfileDigest,
    caseCount: cases.length,
    caseSetDigest,
    requiredCaseCutCount: requiredEntries.length,
    requiredCaseCutSetDigest,
    cases,
    suiteDigest: deriveProviderRealFilesystemSuiteDigestV1(suiteDefinition),
  };
  const suiteSignatureMessage =
    createProviderRealFilesystemSuiteManifestSignatureMessageV1(
      suiteUnsigned,
      activeRoot.rootKeyId,
    );
  const suitePayload = ProviderRealFilesystemSuiteManifestV1Schema.parse({
    ...suiteUnsigned,
    suiteSignature: sourceSignature(
      "provider-real-fs-suite-manifest-ed25519",
      activeRoot.rootKeyId,
      rootPrivateKey,
      suiteSignatureMessage,
    ),
  });
  const suiteManifest =
    ProviderRealFilesystemSuiteManifestEnvelopeV1Schema.parse({
      schemaVersion: 1,
      recordType: "provider_real_fs_suite_manifest",
      contentDigest:
        deriveProviderRealFilesystemSuiteManifestContentDigestV1(suitePayload),
      payload: suitePayload,
    });

  return {
    schemaVersion: 1,
    profile: "provider_real_fs_source_golden_v1",
    fixtureAuthority: "none_real_fs_source_structure_only",
    canonicalizationProfile: "rfc8785-jcs-safe-integer-v1",
    verificationProfile: "ed25519-rfc8032-cofactorless-prime-subgroup-v1",
    deterministicRootSeedHex: rootSeedHex,
    distributionRootBinding: jsonClone(distributionRootBinding),
    activeRootMetadata,
    activeRoot,
    fixtureCorpusManifest,
    suiteManifest,
    expected: {
      fixtureCorpusSignatureMessageUtf8Hex: Buffer.from(
        corpusSignatureMessage,
      ).toString("hex"),
      suiteSignatureMessageUtf8Hex: Buffer.from(
        suiteSignatureMessage,
      ).toString("hex"),
      fixtureCorpusPayloadCanonicalUtf8Hex: Buffer.from(
        canonicalizeJcsSafeIntegerUtf8V1(corpusPayload),
      ).toString("hex"),
      suitePayloadCanonicalUtf8Hex: Buffer.from(
        canonicalizeJcsSafeIntegerUtf8V1(suitePayload),
      ).toString("hex"),
      fixtureCorpusManifestRelativePath:
        buildProviderRealFilesystemFixtureCorpusManifestRelativePathV1(
          fixtureCorpusManifest,
        ),
      suiteManifestRelativePath:
        buildProviderRealFilesystemSuiteManifestRelativePathV1(suiteManifest),
      recordCount: records.length,
      caseCount: cases.length,
      requiredCaseCutCount: requiredEntries.length,
    },
  };
}

function definition(caseId, targetJsonPointer, operands, stage, reason) {
  return Object.freeze({
    caseId,
    mutation: Object.freeze({
      dialect: INVALID_RECIPE_DIALECT,
      goldenResourcePath: GOLDEN_RESOURCE_PATH,
      steps: Object.freeze([
        Object.freeze({
          operation: caseId,
          targetJsonPointer,
          operands: Object.freeze(operands),
        }),
      ]),
    }),
    expected: Object.freeze({
      boundary: "internal_diagnostic",
      stage,
      reason,
      publicFailureReason: "attestation_invalid",
    }),
  });
}

const d = definition;
export const INVALID_DEFINITIONS = Object.freeze([
  d("input-extra-field", "", ["callerPath"], "input", "schema_invalid"),
  d("input-missing-suite", "/suiteManifest", ["delete"], "input", "schema_invalid"),
  d("corpus-envelope-extra-field", "/fixtureCorpusManifest/callerPath", ["latest.json"], "corpus_structure", "schema_invalid"),
  d("corpus-profile-malformed", "/fixtureCorpusManifest/payload/profile", ["v2"], "corpus_structure", "schema_invalid"),
  d("corpus-record-order-reversed", "/fixtureCorpusManifest/payload/records", ["swap:0:1"], "corpus_structure", "ordering_invalid"),
  d("corpus-record-duplicate", "/fixtureCorpusManifest/payload/records", ["copy:0:1"], "corpus_structure", "ordering_invalid"),
  d("corpus-ordinal-gap", "/fixtureCorpusManifest/payload/records/1/fixtureOrdinal", ["2"], "corpus_structure", "ordering_invalid"),
  d("fixture-program-digest-mismatch", "/fixtureCorpusManifest/payload/records/0/fixtureProgramContentDigest", ["zero-digest"], "corpus_digest", "digest_mismatch"),
  d("fixture-program-length-mismatch", "/fixtureCorpusManifest/payload/records/0/fixtureProgramLogicalBytes", ["+1"], "corpus_digest", "digest_mismatch"),
  d("corpus-record-count-mismatch", "/fixtureCorpusManifest/payload/recordCount", ["+1"], "corpus_structure", "count_mismatch"),
  d("corpus-record-set-digest-mismatch", "/fixtureCorpusManifest/payload/recordSetDigest", ["zero-digest"], "corpus_digest", "digest_mismatch"),
  d("fixture-manifest-digest-mismatch", "/fixtureCorpusManifest/payload/fixtureManifestDigest", ["zero-digest"], "corpus_digest", "digest_mismatch"),
  d("corpus-distribution-binding-mismatch", "/fixtureCorpusManifest/payload/releaseRevisionDigest", ["zero-digest"], "distribution_binding", "binding_mismatch"),
  d("corpus-active-root-mismatch", "/fixtureCorpusManifest/payload/registryRootKeyId", ["zero-key-id"], "active_root", "root_mismatch"),
  d("corpus-signature-bitflip", "/fixtureCorpusManifest/payload/corpusSignature", ["last-bit"], "corpus_signature", "signature_invalid"),
  d("corpus-signature-wrong-domain", "/fixtureCorpusManifest/payload/corpusSignature", ["independently-valid-wrong-domain"], "corpus_signature", "signature_invalid"),
  d("corpus-signature-wrong-signer", "/fixtureCorpusManifest/payload/corpusSignature", ["alternate-key"], "corpus_signature", "signature_invalid"),
  d("corpus-signature-prefix-substitution", "/fixtureCorpusManifest/payload/corpusSignature", ["suite-prefix"], "corpus_structure", "schema_invalid"),
  d("corpus-envelope-content-digest-mismatch", "/fixtureCorpusManifest/contentDigest", ["zero-digest"], "corpus_envelope", "envelope_mismatch"),
  d("suite-envelope-extra-field", "/suiteManifest/callerPath", ["latest.json"], "suite_structure", "schema_invalid"),
  d("suite-profile-malformed", "/suiteManifest/payload/profile", ["v2"], "suite_structure", "schema_invalid"),
  d("suite-distribution-binding-mismatch", "/suiteManifest/payload/releaseRevisionDigest", ["zero-digest"], "distribution_binding", "binding_mismatch"),
  d("suite-active-root-mismatch", "/suiteManifest/payload/registryRootKeyId", ["zero-key-id"], "active_root", "root_mismatch"),
  d("suite-corpus-content-pin-mismatch", "/suiteManifest/payload/fixtureCorpusManifest/contentDigest", ["zero-digest"], "suite_corpus_pin", "binding_mismatch"),
  d("suite-corpus-semantic-pin-mismatch", "/suiteManifest/payload/fixtureCorpusManifest/fixtureManifestDigest", ["zero-digest"], "suite_corpus_pin", "binding_mismatch"),
  d("suite-runner-profile-digest-mismatch", "/suiteManifest/payload/runnerProfileDigest", ["zero-digest"], "suite_digest", "digest_mismatch"),
  d("suite-case-count-mismatch", "/suiteManifest/payload/caseCount", ["+1"], "suite_structure", "count_mismatch"),
  d("suite-case-order-reversed", "/suiteManifest/payload/cases", ["reverse"], "suite_structure", "ordering_invalid"),
  d("suite-case-coverage-omitted", "/suiteManifest/payload/cases", ["pop-and-decrement"], "suite_structure", "coverage_mismatch"),
  d("suite-case-id-mismatch", "/suiteManifest/payload/cases/0/caseId", ["alternate-valid-id"], "suite_digest", "digest_mismatch"),
  d("suite-case-fixture-count-mismatch", "/suiteManifest/payload/cases/0/fixtureRecordCount", ["+1"], "suite_digest", "digest_mismatch"),
  d("suite-crash-cut-ordinal-gap", "/suiteManifest/payload/cases/0/requiredCrashCuts/1/crashCutOrdinal", ["2"], "suite_structure", "ordering_invalid"),
  d("suite-crash-cut-injection-not-operation", "/suiteManifest/payload/cases/0/requiredCrashCuts/1/injection/afterFixtureOrdinal", ["0"], "suite_structure", "coverage_mismatch"),
  d("suite-recovery-assertion-digest-mismatch", "/suiteManifest/payload/cases/0/requiredCrashCuts/1/recoveryAssertionContentDigest", ["zero-digest"], "suite_digest", "digest_mismatch"),
  d("suite-crash-cut-id-mismatch", "/suiteManifest/payload/cases/0/requiredCrashCuts/1/crashCutId", ["alternate-valid-id"], "suite_digest", "digest_mismatch"),
  d("suite-required-cut-count-mismatch", "/suiteManifest/payload/requiredCaseCutCount", ["+1"], "suite_digest", "digest_mismatch"),
  d("suite-required-cut-set-digest-mismatch", "/suiteManifest/payload/requiredCaseCutSetDigest", ["zero-digest"], "suite_digest", "digest_mismatch"),
  d("suite-semantic-digest-mismatch", "/suiteManifest/payload/suiteDigest", ["zero-digest"], "suite_digest", "digest_mismatch"),
  d("suite-signature-bitflip", "/suiteManifest/payload/suiteSignature", ["last-bit"], "suite_signature", "signature_invalid"),
  d("suite-signature-wrong-domain", "/suiteManifest/payload/suiteSignature", ["independently-valid-wrong-domain"], "suite_signature", "signature_invalid"),
  d("suite-signature-wrong-signer", "/suiteManifest/payload/suiteSignature", ["alternate-key"], "suite_signature", "signature_invalid"),
  d("suite-signature-prefix-substitution", "/suiteManifest/payload/suiteSignature", ["corpus-prefix"], "suite_structure", "schema_invalid"),
  d("suite-envelope-content-digest-mismatch", "/suiteManifest/contentDigest", ["zero-digest"], "suite_envelope", "envelope_mismatch"),
]);

function bitflip(signature) {
  const last = signature.at(-1);
  return `${signature.slice(0, -1)}${last === "0" ? "1" : "0"}`;
}

function zeroDigest() {
  return `sha256:${"0".repeat(64)}`;
}

function alternateValidId(prefix) {
  return `${prefix}:${"f".repeat(22)}`;
}

function wrongDomainSignature(prefix, rootKeyId, claims, privateKey, domain) {
  const message = canonicalizeJcsSafeIntegerUtf8V1([
    domain,
    { rootKeyId, domain, claims },
  ]);
  return sourceSignature(prefix, rootKeyId, privateKey, message);
}

export function materializeInvalidRequest(golden, caseId, strictCryptoCapability) {
  const request = {
    distributionRootBinding: jsonClone(golden.distributionRootBinding),
    activeRootMetadata: jsonClone(golden.activeRootMetadata),
    activeRoot: jsonClone(golden.activeRoot),
    fixtureCorpusManifest: jsonClone(golden.fixtureCorpusManifest),
    suiteManifest: jsonClone(golden.suiteManifest),
    strictCryptoCapability,
  };
  const corpus = request.fixtureCorpusManifest;
  const suite = request.suiteManifest;
  const rootKeyId = golden.activeRoot.rootKeyId;
  const privateKey = privateKeyFromSeedHex(golden.deterministicRootSeedHex);
  const alternateKey = privateKeyFromSeedHex("7e".repeat(32));
  switch (caseId) {
    case "input-extra-field": request.callerPath = "latest.json"; break;
    case "input-missing-suite": delete request.suiteManifest; break;
    case "corpus-envelope-extra-field": corpus.callerPath = "latest.json"; break;
    case "corpus-profile-malformed": corpus.payload.profile = "provider_real_fs_fixture_corpus_manifest_v2"; break;
    case "corpus-record-order-reversed": [corpus.payload.records[0], corpus.payload.records[1]] = [corpus.payload.records[1], corpus.payload.records[0]]; break;
    case "corpus-record-duplicate": corpus.payload.records[1] = jsonClone(corpus.payload.records[0]); break;
    case "corpus-ordinal-gap": corpus.payload.records[1].fixtureOrdinal = 2; break;
    case "fixture-program-digest-mismatch": corpus.payload.records[0].fixtureProgramContentDigest = zeroDigest(); break;
    case "fixture-program-length-mismatch": corpus.payload.records[0].fixtureProgramLogicalBytes += 1; break;
    case "corpus-record-count-mismatch": corpus.payload.recordCount += 1; break;
    case "corpus-record-set-digest-mismatch": corpus.payload.recordSetDigest = zeroDigest(); break;
    case "fixture-manifest-digest-mismatch": corpus.payload.fixtureManifestDigest = zeroDigest(); break;
    case "corpus-distribution-binding-mismatch": corpus.payload.releaseRevisionDigest = zeroDigest(); break;
    case "corpus-active-root-mismatch": corpus.payload.registryRootKeyId = "0".repeat(22); break;
    case "corpus-signature-bitflip": corpus.payload.corpusSignature = bitflip(corpus.payload.corpusSignature); break;
    case "corpus-signature-wrong-domain": {
      const { corpusSignature: _signature, ...claims } = corpus.payload;
      corpus.payload.corpusSignature = wrongDomainSignature("provider-real-fs-fixture-corpus-ed25519", rootKeyId, claims, privateKey, "provider-real-fs-fixture-corpus-wrong-signature-v1");
      break;
    }
    case "corpus-signature-wrong-signer": corpus.payload.corpusSignature = sourceSignature("provider-real-fs-fixture-corpus-ed25519", rootKeyId, alternateKey, createProviderRealFilesystemFixtureCorpusManifestSignatureMessageV1(corpus.payload, rootKeyId)); break;
    case "corpus-signature-prefix-substitution": corpus.payload.corpusSignature = corpus.payload.corpusSignature.replace("provider-real-fs-fixture-corpus-ed25519", "provider-real-fs-suite-manifest-ed25519"); break;
    case "corpus-envelope-content-digest-mismatch": corpus.contentDigest = zeroDigest(); break;
    case "suite-envelope-extra-field": suite.callerPath = "latest.json"; break;
    case "suite-profile-malformed": suite.payload.profile = "provider_real_fs_suite_manifest_v2"; break;
    case "suite-distribution-binding-mismatch": suite.payload.releaseRevisionDigest = zeroDigest(); break;
    case "suite-active-root-mismatch": suite.payload.registryRootKeyId = "0".repeat(22); break;
    case "suite-corpus-content-pin-mismatch": suite.payload.fixtureCorpusManifest.contentDigest = zeroDigest(); break;
    case "suite-corpus-semantic-pin-mismatch": suite.payload.fixtureCorpusManifest.fixtureManifestDigest = zeroDigest(); break;
    case "suite-runner-profile-digest-mismatch": suite.payload.runnerProfileDigest = zeroDigest(); break;
    case "suite-case-count-mismatch": suite.payload.caseCount += 1; break;
    case "suite-case-order-reversed": suite.payload.cases.reverse(); break;
    case "suite-case-coverage-omitted": suite.payload.cases.pop(); suite.payload.caseCount -= 1; break;
    case "suite-case-id-mismatch": suite.payload.cases[0].caseId = alternateValidId("provider-real-fs-case"); break;
    case "suite-case-fixture-count-mismatch": suite.payload.cases[0].fixtureRecordCount += 1; break;
    case "suite-crash-cut-ordinal-gap": suite.payload.cases[0].requiredCrashCuts[1].crashCutOrdinal = 2; break;
    case "suite-crash-cut-injection-not-operation": suite.payload.cases[0].requiredCrashCuts[1].injection.afterFixtureOrdinal = 0; break;
    case "suite-recovery-assertion-digest-mismatch": suite.payload.cases[0].requiredCrashCuts[1].recoveryAssertionContentDigest = zeroDigest(); break;
    case "suite-crash-cut-id-mismatch": suite.payload.cases[0].requiredCrashCuts[1].crashCutId = alternateValidId("provider-crash-cut"); break;
    case "suite-required-cut-count-mismatch": suite.payload.requiredCaseCutCount += 1; break;
    case "suite-required-cut-set-digest-mismatch": suite.payload.requiredCaseCutSetDigest = zeroDigest(); break;
    case "suite-semantic-digest-mismatch": suite.payload.suiteDigest = zeroDigest(); break;
    case "suite-signature-bitflip": suite.payload.suiteSignature = bitflip(suite.payload.suiteSignature); break;
    case "suite-signature-wrong-domain": {
      const { suiteSignature: _signature, ...claims } = suite.payload;
      suite.payload.suiteSignature = wrongDomainSignature("provider-real-fs-suite-manifest-ed25519", rootKeyId, claims, privateKey, "provider-real-fs-suite-manifest-wrong-signature-v1");
      break;
    }
    case "suite-signature-wrong-signer": suite.payload.suiteSignature = sourceSignature("provider-real-fs-suite-manifest-ed25519", rootKeyId, alternateKey, createProviderRealFilesystemSuiteManifestSignatureMessageV1(suite.payload, rootKeyId)); break;
    case "suite-signature-prefix-substitution": suite.payload.suiteSignature = suite.payload.suiteSignature.replace("provider-real-fs-suite-manifest-ed25519", "provider-real-fs-fixture-corpus-ed25519"); break;
    case "suite-envelope-content-digest-mismatch": suite.contentDigest = zeroDigest(); break;
    default: throw new TypeError(`unknown real filesystem invalid case ${caseId}`);
  }
  return request;
}
