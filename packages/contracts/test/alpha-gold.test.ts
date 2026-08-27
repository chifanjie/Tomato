import {
  createHash,
  generateKeyPairSync,
  sign,
} from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";

import {
  AlphaGoldGateEvidenceV1Schema,
  AlphaGoldRunnerContractV1Schema,
  AlphaGoldTaskCorpusV1Schema,
  STEP16_ALPHA_A_REVISION_V1,
  STEP16_ALPHA_B_LOCAL_REVISION_V1,
  STEP16_ALPHA_GOLD_BLOCKED_CORPUS_MANIFEST_DIGEST_V1,
  Step16DualHostBlockedEvidenceV1Schema,
  Step16DualHostEligibleEvidenceV1Schema,
  Step16DualHostEvidenceV1Schema,
} from "../src/alpha-gold.js";
import {
  createStep16GoldRootVerificationMessageV1,
  deriveStep16GoldReceiptInventoryDigestV1,
  deriveStep16GoldVerifierKeyIdV1,
  verifyStep16DualHostEligibleEvidenceV1,
} from "../scripts/alpha-gold-verifier.mjs";
import { generateContractJsonSchemasV1 } from "../src/json-schema.js";

const corpusPath = fileURLToPath(
  new URL("../fixtures/v1/golden/alpha-gold-task-corpus-v1.json", import.meta.url),
);
const runnerPath = fileURLToPath(
  new URL("../fixtures/v1/golden/alpha-gold-runner-contract-v1.json", import.meta.url),
);
const corpusBytes = readFileSync(corpusPath);
const corpus = AlphaGoldTaskCorpusV1Schema.parse(
  JSON.parse(corpusBytes.toString("utf8")),
);
const runner = AlphaGoldRunnerContractV1Schema.parse(
  JSON.parse(readFileSync(runnerPath, "utf8")),
);
const corpusDigest = `sha256:${createHash("sha256").update(corpusBytes).digest("hex")}`;

const digest = (nibble: string) => `sha256:${nibble.repeat(64)}`;

function blockedEvidence() {
  return {
    schemaVersion: 1,
    profile: "alpha_gold_gate_evidence_v1",
    corpusManifestDigest: corpusDigest,
    generatedAt: "2026-08-27T00:00:00Z",
    taskDefinitionStatus: "blocked_not_versioned",
    syntheticVertical: {
      status: "verified",
      countsTowardG2OrG3: false,
      executionSurface: "installed_wrapper_stdio",
      hostAuthority: "trusted_installation_wrappers_only",
      hosts: ["codex", "claude"],
      toolCount: 11,
    },
    sources: {
      alphaA: {
        revision: corpus.sources.alphaA.revision,
        materializableFromRepository: true,
      },
      alphaB: {
        revision: corpus.sources.alphaB.revision,
        ownerAuthorizationObserved: false,
        localCorpusAvailable: false,
        copiedIntoRepository: false,
      },
    },
    hostRuns: {
      codex: {
        status: "blocked",
        requiredTasks: 24,
        passedTasks: 0,
        alphaAPassedTasks: 0,
        alphaBPassedTasks: 0,
      },
      claude: {
        status: "blocked",
        requiredTasks: 24,
        passedTasks: 0,
        alphaAPassedTasks: 0,
        alphaBPassedTasks: 0,
      },
    },
    g2: {
      status: "blocked",
      requiredPassedTasks: 12,
      blockers: [
        "gold_task_definitions_not_versioned",
        "alpha_b_owner_authorization_missing",
      ],
    },
    g3: {
      status: "blocked",
      requiredGoldTasksPerHost: 24,
      requiredHostTaskExecutions: 48,
      artifactTaskRevisionIdentityMatched: false,
      blockers: [
        "gold_task_definitions_not_versioned",
        "alpha_b_owner_authorization_missing",
        "codex_gold_incomplete",
        "claude_gold_incomplete",
      ],
    },
  } as const;
}

function availableEvidenceBase() {
  const base = blockedEvidence();
  const { corpusManifestDigest: _blockedManifestDigest, ...versionedBase } = base;
  return {
    ...versionedBase,
    versionedTaskDefinitionManifestDigest: digest("2"),
    taskDefinitionStatus: "versioned_two_person_reviewed",
    sources: {
      alphaA: { ...base.sources.alphaA, materializableFromRepository: true },
      alphaB: {
        ...base.sources.alphaB,
        ownerAuthorizationObserved: true,
        localCorpusAvailable: true,
      },
    },
  } as const;
}

function blockedOuterEvidence() {
  return {
    schemaVersion: 1,
    profile: "step16_dual_host_strong_alpha_linux_v1",
    status: "blocked",
    hosts: ["codex", "claude"],
    hostExecution: { status: "blocked", blocker: "real_host_clis_unavailable" },
    syntheticVertical: {
      status: "failed",
      executionSurface: "installed_wrapper_stdio",
      hostAuthority: "trusted_installation_wrappers_only",
    },
    toolCount: 11,
    rootFailClosed: "not_run",
    externalSourceMutation: "not_run",
    sharedArtifacts: "not_run",
    lifecycle: "not_run",
    goldGate: blockedEvidence(),
  } as const;
}

function passedHostTaskProof(host: "codex" | "claude", nibble: string) {
  const call = (tool: string) => ({
    status: "passed",
    tool,
    realHostCallReceiptDigest: digest(nibble),
  });
  return {
    host,
    status: "passed",
    taskRunReceiptDigest: digest(nibble),
    stages: {
      repoPulse: call("get_repo_pulse"),
      refreshBaseline: call("refresh_index"),
      taskBrief: call("build_task_brief"),
      taskUpdate: call("update_task"),
      refreshChanged: call("refresh_index"),
      changeCheck: call("check_change"),
      verification: call("record_verification"),
    },
    externalSourceMutation: {
      status: "passed",
      receiptDigest: digest(nibble),
    },
  } as const;
}

function eligibleEvidenceFixture() {
  const slots = Object.fromEntries(corpus.taskSlots.map((slot, index) => {
    const nibble = (index % 16).toString(16);
    return [slot.slotId, {
      slotId: slot.slotId,
      corpus: slot.corpus,
      ordinal: slot.ordinal,
      taskDefinitionDigest: digest(nibble),
      sharedExecutionIdentity: {
        providerIdentityDigest: digest("a"),
        taskId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
        revision: index + 1,
      },
      sharedArtifactDigest: digest(nibble),
      sharedExternalSourceMutationDigest: digest(nibble),
      hosts: {
        codex: passedHostTaskProof("codex", nibble),
        claude: passedHostTaskProof("claude", nibble),
      },
    }];
  }));
  const passedHostRun = {
    status: "passed",
    requiredTasks: 24,
    passedTasks: 24,
    alphaAPassedTasks: 18,
    alphaBPassedTasks: 6,
  } as const;
  return {
    schemaVersion: 1,
    profile: "step16_dual_host_strong_alpha_linux_v1",
    status: "eligible",
    hosts: ["codex", "claude"],
    hostExecution: {
      status: "eligible",
      executionSurface: "real_host_tool_calls",
      installations: {
        codex: {
          host: "codex",
          status: "passed",
          installationMode: "real_marketplace_plugin_installation",
          installationReceiptDigest: digest("a"),
          activationReceiptDigest: digest("b"),
          rootFailClosedReceiptDigest: digest("c"),
          passedGoldTasks: 24,
        },
        claude: {
          host: "claude",
          status: "passed",
          installationMode: "real_marketplace_plugin_installation",
          installationReceiptDigest: digest("d"),
          activationReceiptDigest: digest("e"),
          rootFailClosedReceiptDigest: digest("f"),
          passedGoldTasks: 24,
        },
      },
    },
    syntheticVertical: {
      status: "verified",
      executionSurface: "installed_wrapper_stdio",
      hostAuthority: "trusted_installation_wrappers_only",
      independentInstallations: true,
      providerBinding: "self_relative_owned_activation",
      ambientSelection: "poisoned_environment_ignored",
    },
    toolCount: 11,
    rootFailClosed: "verified_both_hosts_zero_write",
    externalSourceMutation: "verified_all_gold_tasks_both_hosts",
    sharedArtifacts: "single_shared_digest_per_task",
    lifecycle: "marketplace_install_upgrade_reinstall_remove_doctor_clean_close",
    proof: {
      versionedTaskDefinitionManifestDigest: digest("2"),
      sourceBindings: {
        alphaA: {
          repositoryKey: "understand-code",
          repositoryRevision: STEP16_ALPHA_A_REVISION_V1,
        },
        alphaB: {
          localRevision: STEP16_ALPHA_B_LOCAL_REVISION_V1,
          ownerAuthorizationObserved: true,
          ownerAuthorizationReceiptDigest: digest("1"),
          localCorpusAvailable: true,
          copiedIntoRepository: false,
          retention: "never_copy_source_private_evidence_or_absolute_paths",
        },
      },
      slots,
      rootVerification: {
        profile: "step16_gold_receipt_root_verification_v1",
        status: "verified",
        verifierKeyId: `ed25519-spki-sha256:${"0".repeat(64)}`,
        receiptInventoryDigest: digest("0"),
        signature: `ed25519:${"0".repeat(128)}`,
      },
    },
    goldGate: {
      schemaVersion: 1,
      profile: "alpha_gold_gate_evidence_v1",
      generatedAt: "2026-08-27T00:00:00Z",
      taskDefinitionStatus: "versioned_two_person_reviewed",
      syntheticVertical: {
        status: "verified",
        countsTowardG2OrG3: false,
        executionSurface: "installed_wrapper_stdio",
        hostAuthority: "trusted_installation_wrappers_only",
        hosts: ["codex", "claude"],
        toolCount: 11,
      },
      sources: {
        alphaA: {
          revision: STEP16_ALPHA_A_REVISION_V1,
          materializableFromRepository: true,
        },
        alphaB: {
          revision: STEP16_ALPHA_B_LOCAL_REVISION_V1,
          ownerAuthorizationObserved: true,
          localCorpusAvailable: true,
          copiedIntoRepository: false,
        },
      },
      hostRuns: { codex: passedHostRun, claude: passedHostRun },
      g2: { status: "eligible", requiredPassedTasks: 12, blockers: [] },
      g3: {
        status: "eligible",
        requiredGoldTasksPerHost: 24,
        requiredHostTaskExecutions: 48,
        artifactTaskRevisionIdentityMatched: true,
        blockers: [],
      },
    },
  } as const;
}

function compileSchema(name: keyof ReturnType<typeof generateContractJsonSchemasV1>) {
  return new Ajv2020({ allErrors: true, strict: false }).compile(
    generateContractJsonSchemasV1()[name],
  );
}

function mutableClone(value: unknown): any {
  return structuredClone(value);
}

describe("Step 16 Alpha Gold corpus", () => {
  it("freezes the authoritative 18/6 pins without inventing Gold task definitions", () => {
    expect(corpus.taskSlots.filter((slot) => slot.corpus === "alpha-a"))
      .toHaveLength(18);
    expect(corpus.taskSlots.filter((slot) => slot.corpus === "alpha-b"))
      .toHaveLength(6);
    expect(corpus.sources.alphaA.revision).toBe(STEP16_ALPHA_A_REVISION_V1);
    expect(corpus.sources.alphaB.revision).toBe(
      STEP16_ALPHA_B_LOCAL_REVISION_V1,
    );
    expect(corpusDigest).toBe(
      STEP16_ALPHA_GOLD_BLOCKED_CORPUS_MANIFEST_DIGEST_V1,
    );
    expect(corpus.taskDefinitionStatus).toBe("blocked_not_versioned");
    expect(new Set(corpus.taskSlots.map((slot) => slot.definitionStatus)))
      .toEqual(new Set(["blocked_not_versioned"]));
    expect(JSON.stringify(corpus)).not.toMatch(
      /(?:"intent"|"category"|\/Users\/|\/home\/|[A-Za-z]:\\)/u,
    );
  });

  it("freezes G2 at one Host/12 tasks and G3 at two Hosts/48 executions", () => {
    expect(runner.g2).toEqual({
      minimumPassedTasksOnOneHost: 12,
      requiredHostCount: 1,
    });
    expect(runner.g3).toMatchObject({
      requiredTasksPerHost: 24,
      requiredHostCount: 2,
      requiredHostTaskExecutions: 48,
      requiredHosts: ["codex", "claude"],
    });
    expect(runner.syntheticSubstitution).toBe("forbidden");
  });

  it("keeps a verified synthetic vertical outside both Gold gates", () => {
    const evidence = AlphaGoldGateEvidenceV1Schema.parse(blockedEvidence());
    expect(evidence.syntheticVertical.countsTowardG2OrG3).toBe(false);
    expect(evidence.g2.status).toBe("blocked");
    expect(evidence.g3.status).toBe("blocked");
  });

  it("accepts a 12-task G2 subset but never counts a failed Host", () => {
    const base = availableEvidenceBase();
    const validG2 = {
      ...base,
      hostRuns: {
        ...base.hostRuns,
        codex: {
          status: "g2_subset_passed",
          requiredTasks: 24,
          passedTasks: 12,
          alphaAPassedTasks: 10,
          alphaBPassedTasks: 2,
        },
      },
      g2: { status: "eligible", requiredPassedTasks: 12, blockers: [] },
    } as const;
    expect(AlphaGoldGateEvidenceV1Schema.parse(validG2).g2.status)
      .toBe("eligible");
    expect(AlphaGoldGateEvidenceV1Schema.safeParse({
      ...validG2,
      hostRuns: {
        ...validG2.hostRuns,
        codex: { ...validG2.hostRuns.codex, status: "failed" },
      },
    }).success).toBe(false);
  });

  it("structurally derives Gold eligibility from both nonzero Host runs", () => {
    const validate = compileSchema("alpha-gold-gate-evidence");
    const base = availableEvidenceBase();
    expect(validate(blockedEvidence())).toBe(true);
    expect(validate(base)).toBe(true);
    expect(validate({
      ...base,
      g2: { status: "eligible", requiredPassedTasks: 12, blockers: [] },
    })).toBe(false);
    expect(validate({
      ...base,
      g3: {
        status: "eligible",
        requiredGoldTasksPerHost: 24,
        requiredHostTaskExecutions: 48,
        artifactTaskRevisionIdentityMatched: true,
        blockers: [],
      },
    })).toBe(false);

    const dualNonzero = {
      ...base,
      hostRuns: {
        codex: {
          status: "g2_subset_passed",
          requiredTasks: 24,
          passedTasks: 12,
          alphaAPassedTasks: 10,
          alphaBPassedTasks: 2,
        },
        claude: {
          status: "failed",
          requiredTasks: 24,
          passedTasks: 7,
          alphaAPassedTasks: 6,
          alphaBPassedTasks: 1,
        },
      },
      g2: { status: "eligible", requiredPassedTasks: 12, blockers: [] },
    } as const;
    expect(AlphaGoldGateEvidenceV1Schema.safeParse(dualNonzero).success)
      .toBe(true);
    expect(validate(dualNonzero)).toBe(true);
    expect(validate({
      ...dualNonzero,
      hostRuns: {
        ...dualNonzero.hostRuns,
        claude: { ...dualNonzero.hostRuns.claude, alphaAPassedTasks: 5 },
      },
    })).toBe(false);
    expect(validate({
      ...dualNonzero,
      g2: { ...dualNonzero.g2, qualifyingHost: "codex" },
    })).toBe(false);
    expect(validate({
      ...dualNonzero,
      g2: { ...dualNonzero.g2, maxQualifyingHostPassedTasks: 12 },
    })).toBe(false);
    expect(validate({
      ...dualNonzero,
      g3: { ...dualNonzero.g3, passedHostTaskExecutions: 19 },
    })).toBe(false);

    const passed = {
      status: "passed",
      requiredTasks: 24,
      passedTasks: 24,
      alphaAPassedTasks: 18,
      alphaBPassedTasks: 6,
    } as const;
    expect(validate({
      ...base,
      hostRuns: { codex: passed, claude: passed },
      g2: { status: "eligible", requiredPassedTasks: 12, blockers: [] },
      g3: {
        status: "eligible",
        requiredGoldTasksPerHost: 24,
        requiredHostTaskExecutions: 48,
        artifactTaskRevisionIdentityMatched: true,
        blockers: [],
      },
    })).toBe(true);
  });

  it("accepts only strict blocked Step16 outer evidence", () => {
    const evidence = blockedOuterEvidence();
    expect(Step16DualHostBlockedEvidenceV1Schema.parse(evidence).status)
      .toBe("blocked");
    expect(Step16DualHostEvidenceV1Schema.parse(evidence).status)
      .toBe("blocked");
    const validate = compileSchema("step16-dual-host-evidence");
    expect(validate(evidence)).toBe(true);
    for (const invalid of [
      { ...evidence, unexpected: true },
      { ...evidence, status: "eligible" },
      {
        ...evidence,
        goldGate: {
          ...evidence.goldGate,
          g2: { status: "eligible", requiredPassedTasks: 12, blockers: [] },
        },
      },
    ]) {
      expect(Step16DualHostEvidenceV1Schema.safeParse(invalid).success)
        .toBe(false);
      expect(validate(invalid)).toBe(false);
    }
  });

  it("validates a strict eligible transport fixture without claiming execution", () => {
    const evidence = eligibleEvidenceFixture();
    expect(Step16DualHostEligibleEvidenceV1Schema.parse(evidence).status)
      .toBe("eligible");
    expect(Step16DualHostEvidenceV1Schema.parse(evidence).status)
      .toBe("eligible");
    expect(Object.keys(evidence.proof.slots)).toHaveLength(24);
    expect(compileSchema("step16-dual-host-eligible-evidence")(evidence))
      .toBe(true);
    expect(compileSchema("step16-dual-host-evidence")(evidence)).toBe(true);
  });

  it("requires the trusted root verifier to sign the complete receipt inventory", () => {
    const evidence = mutableClone(eligibleEvidenceFixture());
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const trustedSpki = publicKey.export({ format: "der", type: "spki" })
      .toString("base64");
    const receipt = evidence.proof.rootVerification;
    receipt.verifierKeyId = deriveStep16GoldVerifierKeyIdV1(trustedSpki);
    receipt.receiptInventoryDigest =
      deriveStep16GoldReceiptInventoryDigestV1(evidence);
    receipt.signature = `ed25519:${sign(
      null,
      Buffer.from(createStep16GoldRootVerificationMessageV1(
        receipt.verifierKeyId,
        receipt.receiptInventoryDigest,
      )),
      privateKey,
    ).toString("hex")}`;
    expect(verifyStep16DualHostEligibleEvidenceV1(evidence, trustedSpki))
      .toBe(true);

    const tampered = mutableClone(evidence);
    tampered.proof.slots["alpha-a-slot-01"].hosts.codex.stages.repoPulse
      .realHostCallReceiptDigest = digest("f");
    expect(verifyStep16DualHostEligibleEvidenceV1(tampered, trustedSpki))
      .toBe(false);

    const otherKey = generateKeyPairSync("ed25519").publicKey.export({
      format: "der",
      type: "spki",
    }).toString("base64");
    expect(verifyStep16DualHostEligibleEvidenceV1(evidence, otherKey))
      .toBe(false);
  });

  it("rejects incomplete or forged eligible transport in Zod and Ajv", () => {
    const validate = compileSchema("step16-dual-host-evidence");
    const reject = (invalid: unknown) => {
      expect(Step16DualHostEvidenceV1Schema.safeParse(invalid).success)
        .toBe(false);
      expect(validate(invalid)).toBe(false);
    };

    reject({ ...blockedOuterEvidence(), status: "eligible" });

    const missingSlot = mutableClone(eligibleEvidenceFixture());
    delete missingSlot.proof.slots["alpha-b-slot-06"];
    reject(missingSlot);

    const wrongSlot = mutableClone(eligibleEvidenceFixture());
    wrongSlot.proof.slots["alpha-a-slot-01-copy"] =
      wrongSlot.proof.slots["alpha-a-slot-01"];
    reject(wrongSlot);

    const duplicateSlotIdentity = mutableClone(eligibleEvidenceFixture());
    duplicateSlotIdentity.proof.slots["alpha-a-slot-01"].slotId =
      "alpha-a-slot-02";
    reject(duplicateSlotIdentity);

    const hostNotPassed = mutableClone(eligibleEvidenceFixture());
    hostNotPassed.proof.slots["alpha-a-slot-01"].hosts.codex.status = "failed";
    reject(hostNotPassed);

    const g2NotEligible = mutableClone(eligibleEvidenceFixture());
    g2NotEligible.goldGate.g2.status = "blocked";
    g2NotEligible.goldGate.g2.blockers = ["codex_gold_incomplete"];
    reject(g2NotEligible);

    const g3NotEligible = mutableClone(eligibleEvidenceFixture());
    g3NotEligible.goldGate.g3.status = "blocked";
    g3NotEligible.goldGate.g3.blockers = ["claude_gold_incomplete"];
    reject(g3NotEligible);

    const missingManifest = mutableClone(eligibleEvidenceFixture());
    delete missingManifest.proof.versionedTaskDefinitionManifestDigest;
    reject(missingManifest);

    const missingAuthorization = mutableClone(eligibleEvidenceFixture());
    delete missingAuthorization.proof.sourceBindings.alphaB
      .ownerAuthorizationReceiptDigest;
    reject(missingAuthorization);

    const unknownField = mutableClone(eligibleEvidenceFixture());
    unknownField.proof.unexpected = true;
    reject(unknownField);
  });
});
