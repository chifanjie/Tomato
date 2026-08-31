import {
  chmod,
  copyFile,
  link,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  symlink,
  truncate,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { ProviderAcceptanceAuthorityErrorV1 } from "../src/errors.js";
import { digestDomainInternalV1 } from "../src/crypto-internal.js";
import { canonicalAuthorityBytesInternalV1 } from "../src/filesystem-internal.js";
import {
  STEP16_RECEIPT_BINDING_JOURNAL_LOGICAL_LOCATOR_INTERNAL_V1,
  STEP16_RECEIPT_BINDING_JOURNAL_STAGE_LOGICAL_LOCATOR_INTERNAL_V1,
  STEP16_RECEIPT_BINDING_MAX_OPERATIONS_INTERNAL_V1,
  finalizeStep16ReceiptBindingRunDurableInternalV1,
  type Step16ReceiptBindingJournalCallIdentityInternalV1,
} from "../src/step16-receipt-binding-journal-internal.js";
import {
  appendStep16ReceiptBindingExpectedOperationDurableForTestInternalV1,
  abortStep16ReceiptBindingDurableJournalForTestInternalV1,
  armStep16ReceiptBindingDurableJournalForTestInternalV1,
  completeStep16ReceiptBindingDurableJournalForTestInternalV1,
  createProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1,
  deriveStep16ReceiptBindingOrderedPrefixDigestForTestInternalV1,
  finalizeStep16ReceiptBindingDurableJournalForTestInternalV1,
  inspectStep16ReceiptBindingDurableJournalForTestInternalV1,
  openStep16ReceiptBindingDurableJournalForTestInternalV1,
  verifyStep16ReceiptBindingDurableJournalAgainstBrokerLedgerForTestInternalV1,
  type ProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1,
  type Step16ReceiptBindingBrokerLedgerEntryInternalV1,
  type Step16ReceiptBindingJournalCapabilityInternalV1,
  type Step16ReceiptBindingJournalExpectedOperationInternalV1,
} from "../src/test-seam-internal.js";

const fixtureRoots = new Set<string>();
const SESSION_DIGEST_V1 = `sha256:${"1".repeat(64)}` as const;
const CALL_DIGEST_V1 = `sha256:${"2".repeat(64)}` as const;
const CALL_IDENTITY_V1 = Object.freeze({
  runNonce: "e".repeat(64),
  closingPlanDigest: `sha256:${"f".repeat(64)}` as const,
  callOrdinal: 1,
  eventOrdinal: 1,
  tool: "understand_code.create_task",
  argumentsDigest: `sha256:${"0".repeat(64)}` as const,
  sessionIdDigest: SESSION_DIGEST_V1,
  callIdDigest: CALL_DIGEST_V1,
});

const BASELINE_ENTRY_V1 = Object.freeze({
  bundleDigest: `sha256:${"a".repeat(64)}` as const,
  operation: "write_object" as const,
  operationNonce: "a".repeat(32),
  requestDigest: `sha256:${"b".repeat(64)}` as const,
});
const OPERATIONS_V1 = Object.freeze([
  Object.freeze({
    operation: "write_object" as const,
    operationNonce: "1".repeat(32),
    requestDigest: `sha256:${"3".repeat(64)}` as const,
  }),
  Object.freeze({
    operation: "compare_commit" as const,
    operationNonce: "2".repeat(32),
    requestDigest: `sha256:${"4".repeat(64)}` as const,
  }),
]);

afterEach(async () => {
  await Promise.all(
    [...fixtureRoots].map((root) => rm(root, { recursive: true, force: true })),
  );
  fixtureRoots.clear();
});

interface JournalFixtureV1 {
  readonly authorityRoot: string;
  readonly canonicalPath: string;
  readonly stagePath: string;
  readonly layoutCapability:
    ProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1;
}

async function fixtureV1(): Promise<JournalFixtureV1> {
  const parent = await mkdtemp(join(tmpdir(), "step16-binding-journal-"));
  fixtureRoots.add(parent);
  const authorityRoot = join(parent, "authority");
  return Object.freeze({
    authorityRoot,
    canonicalPath: join(
      authorityRoot,
      STEP16_RECEIPT_BINDING_JOURNAL_LOGICAL_LOCATOR_INTERNAL_V1,
    ),
    stagePath: join(
      authorityRoot,
      STEP16_RECEIPT_BINDING_JOURNAL_STAGE_LOGICAL_LOCATOR_INTERNAL_V1,
    ),
    layoutCapability:
      createProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1(
        authorityRoot,
      ),
  });
}

function baselineV1() {
  return Object.freeze({
    intentCount: 1,
    orderedPrefixDigest:
      deriveStep16ReceiptBindingOrderedPrefixDigestForTestInternalV1([
        BASELINE_ENTRY_V1,
      ]) as `sha256:${string}`,
  });
}

function bindingV1(
  operation: Step16ReceiptBindingJournalExpectedOperationInternalV1,
) {
  return Object.freeze({
    schemaVersion: 1,
    profile: "step16_provider_receipt_binding_v1",
    host: "codex",
    sessionIdDigest: SESSION_DIGEST_V1,
    callIdDigest: CALL_DIGEST_V1,
    providerIdentityDigest: `sha256:${"5".repeat(64)}`,
    receiptLedger: Object.freeze({
      authority: "root_owned_private_provider_receipt_ledger",
      locatorPolicy: "fixed_locator_component_nofollow",
      receiptBundleDigest: `sha256:${(operation.operation === "write_object" ? "c" : "d").repeat(64)}`,
    }),
    providerOperation: Object.freeze({
      ...operation,
      sessionBindingDigest: `sha256:${"7".repeat(64)}`,
      principalAttestationDigest: `sha256:${"8".repeat(64)}`,
      authorityGrantContentDigest: `sha256:${"9".repeat(64)}`,
      responseResolution: "committed",
    }),
    componentDigests: Object.freeze({
      strongMutationRequest: `sha256:${"1".repeat(64)}`,
      strongMutationResponse: `sha256:${"2".repeat(64)}`,
      principalAttestation: `sha256:${"3".repeat(64)}`,
      authorityGrantEnvelope: `sha256:${"4".repeat(64)}`,
      authorityGrantSignature: `sha256:${"5".repeat(64)}`,
      responseSignature: `sha256:${"6".repeat(64)}`,
      principalAttestationSignature: `sha256:${"7".repeat(64)}`,
    }),
    privateBundleVerification: Object.freeze({
      status: "verified",
      verifierProfile: "provider_runtime_ipc_full_private_bundle_verifier_v1",
      verifiedBindings: Object.freeze([
        "request_digest", "session_binding", "authority_grant_signature",
        "response_signature", "principal_attestation_signature",
      ]),
    }),
  });
}

function ledgerEntryV1(
  operation: Step16ReceiptBindingJournalExpectedOperationInternalV1,
  digit: string,
): Step16ReceiptBindingBrokerLedgerEntryInternalV1 {
  return Object.freeze({
    bundleDigest: `sha256:${digit.repeat(64)}` as `sha256:${string}`,
    ...operation,
  });
}

async function armV1(
  fixture: JournalFixtureV1,
  hooks: Parameters<
    typeof openStep16ReceiptBindingDurableJournalForTestInternalV1
  >[1] = {},
): Promise<Step16ReceiptBindingJournalCapabilityInternalV1> {
  const journal =
    await openStep16ReceiptBindingDurableJournalForTestInternalV1(
      fixture.layoutCapability,
      hooks,
    );
  await armStep16ReceiptBindingDurableJournalForTestInternalV1(journal, {
    host: "codex",
    baseline: baselineV1(),
    callIdentity: CALL_IDENTITY_V1,
  });
  return journal;
}

async function expectAuthorityCodeV1(
  operation: Promise<unknown>,
  code: ProviderAcceptanceAuthorityErrorV1["code"],
): Promise<void> {
  try {
    await operation;
    expect.fail("expected authority failure");
  } catch (error) {
    expect(error).toBeInstanceOf(ProviderAcceptanceAuthorityErrorV1);
    expect((error as ProviderAcceptanceAuthorityErrorV1).code).toBe(code);
  }
}

async function finishCallV1(
  journal: Step16ReceiptBindingJournalCapabilityInternalV1,
  identity: Step16ReceiptBindingJournalCallIdentityInternalV1 = CALL_IDENTITY_V1,
  host: "codex" | "claude" = "codex",
  operation: Step16ReceiptBindingJournalExpectedOperationInternalV1 = OPERATIONS_V1[0]!,
): Promise<void> {
  await appendStep16ReceiptBindingExpectedOperationDurableForTestInternalV1(journal, operation);
  await completeStep16ReceiptBindingDurableJournalForTestInternalV1(journal, {
    sessionIdDigest: identity.sessionIdDigest,
    callIdDigest: identity.callIdDigest,
    publicBindings: [{ ...bindingV1(operation), host,
      sessionIdDigest: identity.sessionIdDigest, callIdDigest: identity.callIdDigest }],
  });
  await finalizeStep16ReceiptBindingDurableJournalForTestInternalV1(journal);
}

function runIdentityV1(callCount = 1) {
  return {
    runNonce: CALL_IDENTITY_V1.runNonce,
    closingPlanDigest: CALL_IDENTITY_V1.closingPlanDigest,
    callCount,
  };
}

describe("Step16 receipt-binding durable journal (internal)", () => {
  it("durably arms, appends, completes, finalizes, and exactly recovers", async () => {
    const fixture = await fixtureV1();
    const journal = await armV1(fixture);
    for (const operation of OPERATIONS_V1) {
      await appendStep16ReceiptBindingExpectedOperationDurableForTestInternalV1(
        journal,
        operation,
      );
    }
    await completeStep16ReceiptBindingDurableJournalForTestInternalV1(
      journal,
      {
        sessionIdDigest: SESSION_DIGEST_V1,
        callIdDigest: CALL_DIGEST_V1,
        publicBindings: OPERATIONS_V1.map(bindingV1),
      },
    );
    await finalizeStep16ReceiptBindingDurableJournalForTestInternalV1(journal);

    const before = await inspectStep16ReceiptBindingDurableJournalForTestInternalV1(
      journal,
    );
    expect(before?.phase).toBe("finalized");
    expect(before?.expectedProviderOperations).toEqual(OPERATIONS_V1);
    expect(before?.completion?.publicBindings).toEqual(
      OPERATIONS_V1.map(bindingV1),
    );
    expect(Object.isFrozen(before?.completion?.publicBindings)).toBe(true);
    expect(Object.isFrozen(
      before?.completion?.publicBindings[0]?.providerOperation,
    )).toBe(true);

    const reopened =
      await openStep16ReceiptBindingDurableJournalForTestInternalV1(
        fixture.layoutCapability,
      );
    expect(
      await inspectStep16ReceiptBindingDurableJournalForTestInternalV1(reopened),
    ).toEqual(before);
    const parentMetadata = await stat(join(fixture.authorityRoot, "runtime-state/private"));
    const journalMetadata = await stat(fixture.canonicalPath);
    expect(parentMetadata.mode & 0o777).toBe(0o700);
    expect(journalMetadata.mode & 0o777).toBe(0o600);
    expect(journalMetadata.nlink).toBe(1);
    expect(journalMetadata.uid).toBe(process.geteuid?.() ?? process.getuid?.());

    const ledger = Object.freeze([
      BASELINE_ENTRY_V1,
      ledgerEntryV1(OPERATIONS_V1[0]!, "c"),
      ledgerEntryV1(OPERATIONS_V1[1]!, "d"),
    ]);
    await verifyStep16ReceiptBindingDurableJournalAgainstBrokerLedgerForTestInternalV1(
      reopened,
      { pendingCount: 0, intentCount: ledger.length, bundles: ledger },
    );
  });

  it("keeps the recovered baseline behind an opaque capability", async () => {
    const fixture = await fixtureV1();
    const mutableBaseline = {
      intentCount: 1,
      orderedPrefixDigest: baselineV1().orderedPrefixDigest,
    };
    const journal =
      await openStep16ReceiptBindingDurableJournalForTestInternalV1(
        fixture.layoutCapability,
      );
    await armStep16ReceiptBindingDurableJournalForTestInternalV1(journal, {
      host: "codex",
      baseline: mutableBaseline,
      callIdentity: CALL_IDENTITY_V1,
    });
    mutableBaseline.intentCount = 999;
    expect(
      (await inspectStep16ReceiptBindingDurableJournalForTestInternalV1(journal))
        ?.baseline.intentCount,
    ).toBe(1);

    const fake = Object.freeze(Object.create(null)) as
      Step16ReceiptBindingJournalCapabilityInternalV1;
    await expectAuthorityCodeV1(
      inspectStep16ReceiptBindingDurableJournalForTestInternalV1(fake),
      "invalid_request",
    );
    expect(STEP16_RECEIPT_BINDING_MAX_OPERATIONS_INTERNAL_V1).toBe(4_096);
  });

  for (const cut of [
    "stage_file_fsynced",
    "canonical_renamed",
    "directory_fsynced",
  ] as const) {
    it(`recovers the exact acknowledged state after the ${cut} crash cut`, async () => {
      const fixture = await fixtureV1();
      await armV1(fixture);
      let tripped = false;
      const crashing =
        await openStep16ReceiptBindingDurableJournalForTestInternalV1(
          fixture.layoutCapability,
          {
            afterDurablePhase(phase) {
              if (!tripped && phase === cut) {
                tripped = true;
                throw new Error("controlled crash cut");
              }
            },
          },
        );
      await expectAuthorityCodeV1(
        appendStep16ReceiptBindingExpectedOperationDurableForTestInternalV1(
          crashing,
          OPERATIONS_V1[0]!,
        ),
        "io_error",
      );
      const reopened =
        await openStep16ReceiptBindingDurableJournalForTestInternalV1(
          fixture.layoutCapability,
        );
      const recovered =
        await inspectStep16ReceiptBindingDurableJournalForTestInternalV1(
          reopened,
        );
      expect(recovered?.expectedProviderOperations).toHaveLength(
        cut === "stage_file_fsynced" ? 0 : 1,
      );
    });
  }

  it("accepts only an exact broker prefix and ordered journaled suffix", async () => {
    const fixture = await fixtureV1();
    const journal = await armV1(fixture);
    for (const operation of OPERATIONS_V1) {
      await appendStep16ReceiptBindingExpectedOperationDurableForTestInternalV1(
        journal,
        operation,
      );
    }
    const partial = Object.freeze([
      BASELINE_ENTRY_V1,
      ledgerEntryV1(OPERATIONS_V1[0]!, "c"),
    ]);
    await verifyStep16ReceiptBindingDurableJournalAgainstBrokerLedgerForTestInternalV1(
      journal,
      { pendingCount: 0, intentCount: partial.length, bundles: partial },
    );
    const wrongOrder = Object.freeze([
      BASELINE_ENTRY_V1,
      ledgerEntryV1(OPERATIONS_V1[1]!, "d"),
    ]);
    await expectAuthorityCodeV1(
      verifyStep16ReceiptBindingDurableJournalAgainstBrokerLedgerForTestInternalV1(
        journal,
        { pendingCount: 0, intentCount: wrongOrder.length, bundles: wrongOrder },
      ),
      "namespace_integrity_failed",
    );
    const wrongPrefix = Object.freeze([
      { ...BASELINE_ENTRY_V1, bundleDigest: `sha256:${"f".repeat(64)}` as const },
      ledgerEntryV1(OPERATIONS_V1[0]!, "c"),
    ]);
    await expectAuthorityCodeV1(
      verifyStep16ReceiptBindingDurableJournalAgainstBrokerLedgerForTestInternalV1(
        journal,
        { pendingCount: 0, intentCount: wrongPrefix.length, bundles: wrongPrefix },
      ),
      "namespace_integrity_failed",
    );
  });

  it("fails closed on canonical tamper and rollback", async () => {
    const tamperedFixture = await fixtureV1();
    await armV1(tamperedFixture);
    const canonical = await readFile(tamperedFixture.canonicalPath, "utf8");
    await writeFile(
      tamperedFixture.canonicalPath,
      canonical.replace('"host":"codex"', '"host":"claude"'),
      "utf8",
    );
    await expectAuthorityCodeV1(
      openStep16ReceiptBindingDurableJournalForTestInternalV1(
        tamperedFixture.layoutCapability,
      ),
      "namespace_integrity_failed",
    );

    const rollbackFixture = await fixtureV1();
    const journal = await armV1(rollbackFixture);
    const oldBytes = await readFile(rollbackFixture.canonicalPath);
    await appendStep16ReceiptBindingExpectedOperationDurableForTestInternalV1(
      journal,
      OPERATIONS_V1[0]!,
    );
    await writeFile(rollbackFixture.canonicalPath, oldBytes);
    await expectAuthorityCodeV1(
      openStep16ReceiptBindingDurableJournalForTestInternalV1(
        rollbackFixture.layoutCapability,
      ),
      "namespace_integrity_failed",
    );
  });

  it("fails closed on stage residue and partial preparation", async () => {
    const residueFixture = await fixtureV1();
    await armV1(residueFixture);
    await copyFile(residueFixture.canonicalPath, residueFixture.stagePath);
    await chmod(residueFixture.stagePath, 0o600);
    await expectAuthorityCodeV1(
      openStep16ReceiptBindingDurableJournalForTestInternalV1(
        residueFixture.layoutCapability,
      ),
      "namespace_integrity_failed",
    );

    const partialFixture = await fixtureV1();
    await armV1(partialFixture);
    await writeFile(`${partialFixture.stagePath}.prepare`, "{", { mode: 0o600 });
    await expectAuthorityCodeV1(
      openStep16ReceiptBindingDurableJournalForTestInternalV1(
        partialFixture.layoutCapability,
      ),
      "namespace_integrity_failed",
    );
  });

  for (const mutation of ["symlink", "hardlink", "mode"] as const) {
    it(`fails closed on ${mutation} metadata`, async () => {
      const fixture = await fixtureV1();
      await armV1(fixture);
      if (mutation === "symlink") {
        const target = `${fixture.canonicalPath}.target`;
        await rename(fixture.canonicalPath, target);
        await symlink(target, fixture.canonicalPath);
      } else if (mutation === "hardlink") {
        await link(fixture.canonicalPath, `${fixture.canonicalPath}.link`);
      } else {
        await chmod(fixture.canonicalPath, 0o640);
      }
      await expectAuthorityCodeV1(
        openStep16ReceiptBindingDurableJournalForTestInternalV1(
          fixture.layoutCapability,
        ),
        "namespace_integrity_failed",
      );
    });
  }

  it("fails closed on a partial canonical write", async () => {
    const fixture = await fixtureV1();
    await armV1(fixture);
    await writeFile(fixture.canonicalPath, "{");
    await expectAuthorityCodeV1(
      openStep16ReceiptBindingDurableJournalForTestInternalV1(
        fixture.layoutCapability,
      ),
      "namespace_integrity_failed",
    );
  });

  it("pins all run/plan/call identity at arm and rejects completion retargeting", async () => {
    const fixture = await fixtureV1();
    const journal = await armV1(fixture);
    expect((await inspectStep16ReceiptBindingDurableJournalForTestInternalV1(journal))
      ?.callIdentity).toEqual(CALL_IDENTITY_V1);
    await appendStep16ReceiptBindingExpectedOperationDurableForTestInternalV1(
      journal, OPERATIONS_V1[0]!,
    );
    for (const key of ["sessionIdDigest", "callIdDigest"] as const) {
      const completion = {
        sessionIdDigest: SESSION_DIGEST_V1, callIdDigest: CALL_DIGEST_V1,
        [key]: `sha256:${"e".repeat(64)}` as const,
      };
      await expectAuthorityCodeV1(
        completeStep16ReceiptBindingDurableJournalForTestInternalV1(journal, {
          ...completion,
          publicBindings: [{ ...bindingV1(OPERATIONS_V1[0]!), ...completion }],
        }), "invalid_request",
      );
    }
    expect((await inspectStep16ReceiptBindingDurableJournalForTestInternalV1(journal))
      ?.phase).toBe("armed");
  });

  it("rejects missing arm identity, unsafe accessors, and queued input mutation", async () => {
    const fixture = await fixtureV1();
    const journal = await openStep16ReceiptBindingDurableJournalForTestInternalV1(
      fixture.layoutCapability,
    );
    const armInput = { host: "codex" as const, baseline: baselineV1(),
      callIdentity: { ...CALL_IDENTITY_V1, callOrdinal: 1 as number } };
    for (const key of Object.keys(CALL_IDENTITY_V1)) {
      const identity = { ...CALL_IDENTITY_V1 } as Record<string, unknown>;
      delete identity[key];
      await expectAuthorityCodeV1(armStep16ReceiptBindingDurableJournalForTestInternalV1(
        journal, { ...armInput, callIdentity: identity } as typeof armInput,
      ), "invalid_request");
    }
    let reads = 0;
    const accessor = { ...armInput };
    Object.defineProperty(accessor, "host", { enumerable: true,
      get() { reads += 1; return "codex"; } });
    await expectAuthorityCodeV1(armStep16ReceiptBindingDurableJournalForTestInternalV1(
      journal, accessor,
    ), "invalid_request");
    expect(reads).toBe(0);
    const armed = armStep16ReceiptBindingDurableJournalForTestInternalV1(journal, armInput);
    armInput.callIdentity.callOrdinal = 8;
    await armed;
    expect((await inspectStep16ReceiptBindingDurableJournalForTestInternalV1(journal))
      ?.callIdentity.callOrdinal).toBe(1);
  });

  it("does not reset the same-run 4096 budget after abort/re-arm or reopen", async () => {
    const fixture = await fixtureV1();
    await openStep16ReceiptBindingDurableJournalForTestInternalV1(fixture.layoutCapability);
    const unsigned = {
      profile: "step16_receipt_binding_durable_journal_v1",
      revision: 4_096, previousStateDigest: `sha256:${"9".repeat(64)}`,
      phase: "armed", host: "codex", totalOperationCount: 4_095,
      callIdentity: CALL_IDENTITY_V1, baseline: baselineV1(),
      expectedProviderOperations: [OPERATIONS_V1[0]!], completion: null,
    };
    await writeFile(fixture.canonicalPath, canonicalAuthorityBytesInternalV1({
      ...unsigned, stateDigest: digestDomainInternalV1(
        "provider-step16-receipt-binding-durable-journal-state-v1", unsigned,
      ),
    }), { mode: 0o600 });
    const journal = await openStep16ReceiptBindingDurableJournalForTestInternalV1(
      fixture.layoutCapability,
    );
    await appendStep16ReceiptBindingExpectedOperationDurableForTestInternalV1(
      journal, OPERATIONS_V1[1]!,
    );
    await abortStep16ReceiptBindingDurableJournalForTestInternalV1(journal);
    const nextIdentity = { ...CALL_IDENTITY_V1, callOrdinal: 2, eventOrdinal: 3,
      callIdDigest: `sha256:${"3".repeat(64)}` as const };
    for (const altered of [
      { runNonce: "f".repeat(64) },
      { closingPlanDigest: `sha256:${"e".repeat(64)}` as const },
      { callOrdinal: 1 }, { eventOrdinal: 1 }, { callIdDigest: CALL_DIGEST_V1 },
    ]) {
      await expectAuthorityCodeV1(armStep16ReceiptBindingDurableJournalForTestInternalV1(
        journal, { host: "codex", baseline: baselineV1(),
          callIdentity: { ...nextIdentity, ...altered } },
      ), "invalid_request");
    }
    await armStep16ReceiptBindingDurableJournalForTestInternalV1(journal, {
      host: "codex", baseline: baselineV1(), callIdentity: nextIdentity,
    });
    const reopened = await openStep16ReceiptBindingDurableJournalForTestInternalV1(
      fixture.layoutCapability,
    );
    expect((await inspectStep16ReceiptBindingDurableJournalForTestInternalV1(reopened))
      ?.totalOperationCount).toBe(4_096);
    await expectAuthorityCodeV1(
      appendStep16ReceiptBindingExpectedOperationDurableForTestInternalV1(
        reopened, OPERATIONS_V1[0]!,
      ), "capacity_exhausted",
    );
  });

  it("finalizes a run across Host/session boundaries and verifies its exact final ledger suffix", async () => {
    const fixture = await fixtureV1();
    const journal = await armV1(fixture);
    await finishCallV1(journal);
    const secondIdentity = { ...CALL_IDENTITY_V1, callOrdinal: 2, eventOrdinal: 3,
      sessionIdDigest: `sha256:${"9".repeat(64)}` as const };
    const prefix = [BASELINE_ENTRY_V1, ledgerEntryV1(OPERATIONS_V1[0]!, "c")];
    await armStep16ReceiptBindingDurableJournalForTestInternalV1(journal, {
      host: "claude", callIdentity: secondIdentity,
      baseline: { intentCount: prefix.length,
        orderedPrefixDigest: deriveStep16ReceiptBindingOrderedPrefixDigestForTestInternalV1(prefix) as `sha256:${string}` },
    });
    await finishCallV1(journal, secondIdentity, "claude", OPERATIONS_V1[1]!);
    const previous = (await inspectStep16ReceiptBindingDurableJournalForTestInternalV1(journal))!;
    await finalizeStep16ReceiptBindingRunDurableInternalV1(journal, runIdentityV1(2));
    const finalized = (await inspectStep16ReceiptBindingDurableJournalForTestInternalV1(journal))!;
    expect(finalized).toMatchObject({ phase: "run_finalized", host: "claude",
      totalOperationCount: 2, revision: previous.revision + 1,
      previousStateDigest: previous.stateDigest, callIdentity: secondIdentity });
    const bundles = [...prefix, ledgerEntryV1(OPERATIONS_V1[1]!, "d")];
    await verifyStep16ReceiptBindingDurableJournalAgainstBrokerLedgerForTestInternalV1(journal,
      { pendingCount: 0, intentCount: bundles.length, bundles });
    await expectAuthorityCodeV1(
      verifyStep16ReceiptBindingDurableJournalAgainstBrokerLedgerForTestInternalV1(journal,
        { pendingCount: 0, intentCount: prefix.length, bundles: prefix }),
      "namespace_integrity_failed",
    );
    const reopened = await openStep16ReceiptBindingDurableJournalForTestInternalV1(fixture.layoutCapability);
    expect(await inspectStep16ReceiptBindingDurableJournalForTestInternalV1(reopened)).toEqual(finalized);
  });

  it("resets an exhausted per-run budget only after durable run finalization", async () => {
    const fixture = await fixtureV1();
    await openStep16ReceiptBindingDurableJournalForTestInternalV1(fixture.layoutCapability);
    const unsigned = {
      profile: "step16_receipt_binding_durable_journal_v1",
      revision: 4_100, previousStateDigest: `sha256:${"9".repeat(64)}`,
      phase: "finalized", host: "codex", totalOperationCount: 4_096,
      callIdentity: CALL_IDENTITY_V1, baseline: baselineV1(),
      expectedProviderOperations: [OPERATIONS_V1[0]!],
      completion: { sessionIdDigest: SESSION_DIGEST_V1, callIdDigest: CALL_DIGEST_V1,
        publicBindings: [bindingV1(OPERATIONS_V1[0]!)] },
    };
    await writeFile(fixture.canonicalPath, canonicalAuthorityBytesInternalV1({
      ...unsigned, stateDigest: digestDomainInternalV1(
        "provider-step16-receipt-binding-durable-journal-state-v1", unsigned),
    }), { mode: 0o600 });
    const journal = await openStep16ReceiptBindingDurableJournalForTestInternalV1(fixture.layoutCapability);
    await finalizeStep16ReceiptBindingRunDurableInternalV1(journal, runIdentityV1());
    const previous = (await inspectStep16ReceiptBindingDurableJournalForTestInternalV1(journal))!;
    const nextIdentity = { ...CALL_IDENTITY_V1, runNonce: "a".repeat(64),
      closingPlanDigest: `sha256:${"b".repeat(64)}` as const };
    await armStep16ReceiptBindingDurableJournalForTestInternalV1(journal,
      { host: "claude", baseline: baselineV1(), callIdentity: nextIdentity });
    expect(await inspectStep16ReceiptBindingDurableJournalForTestInternalV1(journal))
      .toMatchObject({ phase: "armed", totalOperationCount: 0,
        revision: previous.revision + 1, previousStateDigest: previous.stateDigest });
    await appendStep16ReceiptBindingExpectedOperationDurableForTestInternalV1(journal, OPERATIONS_V1[1]!);
    expect((await inspectStep16ReceiptBindingDurableJournalForTestInternalV1(journal))?.totalOperationCount)
      .toBe(1);
  });

  it.each(["armed", "host_completed", "finalized", "aborted"] as const)(
    "does not let a new run hide an unfinished %s run",
    async (phase) => {
      const fixture = await fixtureV1();
      const journal = await armV1(fixture);
      if (phase === "host_completed" || phase === "finalized") {
        await appendStep16ReceiptBindingExpectedOperationDurableForTestInternalV1(journal, OPERATIONS_V1[0]!);
        await completeStep16ReceiptBindingDurableJournalForTestInternalV1(journal, {
          sessionIdDigest: SESSION_DIGEST_V1, callIdDigest: CALL_DIGEST_V1,
          publicBindings: [bindingV1(OPERATIONS_V1[0]!)],
        });
        if (phase === "finalized") await finalizeStep16ReceiptBindingDurableJournalForTestInternalV1(journal);
      } else if (phase === "aborted") await abortStep16ReceiptBindingDurableJournalForTestInternalV1(journal);
      await expectAuthorityCodeV1(armStep16ReceiptBindingDurableJournalForTestInternalV1(journal,
        { host: "claude", baseline: baselineV1(),
          callIdentity: { ...CALL_IDENTITY_V1, runNonce: "a".repeat(64) } }), "invalid_request");
      if (phase !== "finalized") await expectAuthorityCodeV1(
        finalizeStep16ReceiptBindingRunDurableInternalV1(journal, runIdentityV1()), "invalid_request");
      expect((await inspectStep16ReceiptBindingDurableJournalForTestInternalV1(journal))?.phase).toBe(phase);
    },
  );

  it("rejects mismatched or replayed run finalization and continuation of a finalized run", async () => {
    const fixture = await fixtureV1();
    const journal = await armV1(fixture);
    await finishCallV1(journal);
    for (const changed of [
      { runNonce: "a".repeat(64) },
      { closingPlanDigest: `sha256:${"a".repeat(64)}` as const },
      { callCount: 0 }, { callCount: 2 },
    ]) await expectAuthorityCodeV1(finalizeStep16ReceiptBindingRunDurableInternalV1(journal,
      { ...runIdentityV1(), ...changed }), "invalid_request");
    await finalizeStep16ReceiptBindingRunDurableInternalV1(journal, runIdentityV1());
    const finalized = await inspectStep16ReceiptBindingDurableJournalForTestInternalV1(journal);
    await expectAuthorityCodeV1(finalizeStep16ReceiptBindingRunDurableInternalV1(journal, runIdentityV1()),
      "invalid_request");
    await expectAuthorityCodeV1(armStep16ReceiptBindingDurableJournalForTestInternalV1(journal,
      { host: "codex", baseline: baselineV1(), callIdentity: { ...CALL_IDENTITY_V1,
        callOrdinal: 2, eventOrdinal: 2, callIdDigest: `sha256:${"9".repeat(64)}` as const } }),
      "invalid_request");
    expect(await inspectStep16ReceiptBindingDurableJournalForTestInternalV1(journal)).toEqual(finalized);
  });

  it("recovers staged run_finalized and new-run budget reset without resetting the hash chain", async () => {
    const fixture = await fixtureV1();
    let journal = await armV1(fixture);
    await finishCallV1(journal);
    for (const nextPhase of ["run_finalized", "armed"] as const) {
      const previous = (await inspectStep16ReceiptBindingDurableJournalForTestInternalV1(journal))!;
      const { stateDigest, ...fields } = previous;
      const unsigned = { ...fields, phase: nextPhase, revision: previous.revision + 1,
        previousStateDigest: stateDigest,
        ...(nextPhase === "armed" ? { totalOperationCount: 0,
          callIdentity: { ...CALL_IDENTITY_V1, runNonce: "a".repeat(64) },
          expectedProviderOperations: [], completion: null } : {}),
      };
      await writeFile(fixture.stagePath, canonicalAuthorityBytesInternalV1({
        ...unsigned, stateDigest: digestDomainInternalV1(
          "provider-step16-receipt-binding-durable-journal-state-v1", unsigned),
      }), { mode: 0o600 });
      journal = await openStep16ReceiptBindingDurableJournalForTestInternalV1(fixture.layoutCapability);
      expect(await inspectStep16ReceiptBindingDurableJournalForTestInternalV1(journal))
        .toMatchObject({ phase: nextPhase, revision: previous.revision + 1,
          previousStateDigest: stateDigest });
    }
  });

  it.each(["call_finalization", "run_finalization"] as const)(
    "rejects a staged transition skipping %s",
    async (skipped) => {
      const fixture = await fixtureV1();
      const journal = await armV1(fixture);
      await appendStep16ReceiptBindingExpectedOperationDurableForTestInternalV1(journal, OPERATIONS_V1[0]!);
      await completeStep16ReceiptBindingDurableJournalForTestInternalV1(journal, {
        sessionIdDigest: SESSION_DIGEST_V1, callIdDigest: CALL_DIGEST_V1,
        publicBindings: [bindingV1(OPERATIONS_V1[0]!)],
      });
      if (skipped === "run_finalization") await finalizeStep16ReceiptBindingDurableJournalForTestInternalV1(journal);
      const previous = (await inspectStep16ReceiptBindingDurableJournalForTestInternalV1(journal))!;
      const { stateDigest, ...fields } = previous;
      const unsigned = { ...fields, revision: previous.revision + 1, previousStateDigest: stateDigest,
        ...(skipped === "call_finalization" ? { phase: "run_finalized" } : {
          phase: "armed", totalOperationCount: 0, expectedProviderOperations: [], completion: null,
          callIdentity: { ...CALL_IDENTITY_V1, runNonce: "a".repeat(64) },
        }),
      };
      await writeFile(fixture.stagePath, canonicalAuthorityBytesInternalV1({
        ...unsigned, stateDigest: digestDomainInternalV1(
          "provider-step16-receipt-binding-durable-journal-state-v1", unsigned),
      }), { mode: 0o600 });
      await expectAuthorityCodeV1(openStep16ReceiptBindingDurableJournalForTestInternalV1(fixture.layoutCapability),
        "namespace_integrity_failed");
    },
  );

  it("rejects loose public bindings and mismatched broker receipt bundle digests", async () => {
    const fixture = await fixtureV1();
    const journal = await armV1(fixture);
    await appendStep16ReceiptBindingExpectedOperationDurableForTestInternalV1(
      journal, OPERATIONS_V1[0]!,
    );
    for (const binding of [
      { ...bindingV1(OPERATIONS_V1[0]!), privatePayload: "must not persist" },
      { ...bindingV1(OPERATIONS_V1[0]!), schemaVersion: 2 },
      { ...bindingV1(OPERATIONS_V1[0]!), componentDigests: {} },
      { ...bindingV1(OPERATIONS_V1[0]!), privateBundleVerification: {} },
    ]) {
      await expectAuthorityCodeV1(completeStep16ReceiptBindingDurableJournalForTestInternalV1(
        journal, { sessionIdDigest: SESSION_DIGEST_V1, callIdDigest: CALL_DIGEST_V1,
          publicBindings: [binding] },
      ), "invalid_request");
    }
    await completeStep16ReceiptBindingDurableJournalForTestInternalV1(journal, {
      sessionIdDigest: SESSION_DIGEST_V1, callIdDigest: CALL_DIGEST_V1,
      publicBindings: [bindingV1(OPERATIONS_V1[0]!)],
    });
    await expectAuthorityCodeV1(
      verifyStep16ReceiptBindingDurableJournalAgainstBrokerLedgerForTestInternalV1(
        journal, { pendingCount: 0, intentCount: 2,
          bundles: [BASELINE_ENTRY_V1, ledgerEntryV1(OPERATIONS_V1[0]!, "d")] },
      ), "namespace_integrity_failed",
    );
  });

  it("serializes separate capabilities and rejects stale observers", async () => {
    const fixture = await fixtureV1();
    const first = await openStep16ReceiptBindingDurableJournalForTestInternalV1(fixture.layoutCapability);
    const second = await openStep16ReceiptBindingDurableJournalForTestInternalV1(fixture.layoutCapability);
    const input = { host: "codex" as const, baseline: baselineV1(), callIdentity: CALL_IDENTITY_V1 };
    const outcomes = await Promise.allSettled([
      armStep16ReceiptBindingDurableJournalForTestInternalV1(first, input),
      armStep16ReceiptBindingDurableJournalForTestInternalV1(second, input),
    ]);
    expect(outcomes.map((result) => result.status)).toEqual(["fulfilled", "rejected"]);
    await expectAuthorityCodeV1(inspectStep16ReceiptBindingDurableJournalForTestInternalV1(second),
      "namespace_integrity_failed");
  });

  for (const mutation of ["symlink", "mode"] as const) {
    it(`rechecks private directory ${mutation} on an already-open capability`, async () => {
      const fixture = await fixtureV1();
      const journal = await armV1(fixture);
      const privatePath = join(fixture.authorityRoot, "runtime-state/private");
      if (mutation === "symlink") {
        await rename(privatePath, `${privatePath}.target`);
        await symlink(`${privatePath}.target`, privatePath);
      } else await chmod(privatePath, 0o750);
      await expectAuthorityCodeV1(
        appendStep16ReceiptBindingExpectedOperationDurableForTestInternalV1(journal, OPERATIONS_V1[0]!),
        "invalid_layout",
      );
    });
  }

  it("rejects oversized canonical files before parsing", async () => {
    const fixture = await fixtureV1();
    await armV1(fixture);
    await truncate(fixture.canonicalPath, 32 * 1024 * 1024 + 1);
    await expectAuthorityCodeV1(openStep16ReceiptBindingDurableJournalForTestInternalV1(
      fixture.layoutCapability,
    ), "namespace_integrity_failed");
  });

  for (const mutation of ["valid_append", "budget_reset", "call_retarget"] as const) {
    it(`checks the recovered staged transition: ${mutation}`, async () => {
      const fixture = await fixtureV1();
      const journal = await armV1(fixture);
      await appendStep16ReceiptBindingExpectedOperationDurableForTestInternalV1(
        journal, OPERATIONS_V1[0]!,
      );
      const previous = (await inspectStep16ReceiptBindingDurableJournalForTestInternalV1(journal))!;
      const { stateDigest: previousDigest, ...fields } = previous;
      const unsigned = {
        ...fields, revision: previous.revision + 1, previousStateDigest: previousDigest,
        expectedProviderOperations: mutation === "budget_reset" ? [] : [...OPERATIONS_V1],
        totalOperationCount: mutation === "budget_reset" ? 0 : 2,
        callIdentity: mutation === "call_retarget"
          ? { ...CALL_IDENTITY_V1, runNonce: "f".repeat(64) } : CALL_IDENTITY_V1,
      };
      await writeFile(fixture.stagePath, canonicalAuthorityBytesInternalV1({
        ...unsigned, stateDigest: digestDomainInternalV1(
          "provider-step16-receipt-binding-durable-journal-state-v1", unsigned,
        ),
      }), { mode: 0o600 });
      const opening = openStep16ReceiptBindingDurableJournalForTestInternalV1(fixture.layoutCapability);
      if (mutation !== "valid_append") await expectAuthorityCodeV1(opening, "namespace_integrity_failed");
      else {
        const reopened = await opening;
        expect((await inspectStep16ReceiptBindingDurableJournalForTestInternalV1(reopened))
          ?.expectedProviderOperations).toEqual(OPERATIONS_V1);
      }
    });
  }
});
