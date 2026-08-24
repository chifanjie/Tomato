import { createHash, createHmac } from "node:crypto";
import {
  mkdtemp,
  readFile,
  rename,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { canonicalizeJcsSafeIntegerUtf8V1 } from "@understand-code/durable-object-provider-contracts/jcs";
import { ProviderAcceptanceCurrentReadV1Schema } from "@understand-code/durable-object-provider-contracts/provider-acceptance";
import { afterEach, describe, expect, it } from "vitest";

import {
  classifyProviderStrongMutationBrokerAdmissionForTestInternalV1,
  createProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1,
  inspectProviderAcceptanceAuthorityCandidateForTestInternalV1,
  openProviderAcceptanceAuthorityStoreForTestInternalV1,
  openProviderStrongMutationBrokerStoreForTestInternalV1 as openProviderStrongMutationBrokerStoreWithVerifierV1,
  provisionProviderAcceptanceAuthorityForTestInternalV1,
} from "../src/test-seam-internal.js";
import {
  TEST_INSTALLATION_IDENTITY_KEY,
  cloneJsonV1,
  genesisRequestV1,
  testAuthorityClockV1,
} from "./acceptance-store-fixtures.js";
import {
  brokerResolveRequestV1,
  TEST_BROKER_INSTALLATION_IDENTITY_GENERATION_ID,
  canonicalDigestOracleV1,
  resignStrongMutationResponseV1,
  strongMutationCompareRequestV1,
  strongMutationCompareResponseV1,
  strongMutationRequestV1,
  strongMutationResponseV1,
  strongMutationTrustedConfigurationV1,
  strongMutationTrustVerifierV1,
} from "./strong-mutation-broker-fixtures.js";

const fixtureRoots = new Set<string>();
const brokerVerifierByLayoutV1 = new WeakMap<object, Awaited<
  ReturnType<typeof strongMutationTrustVerifierV1>
>>();

function verifierForLayoutV1(capability: object) {
  const verifier = brokerVerifierByLayoutV1.get(capability);
  if (verifier === undefined) throw new Error("broker verifier absent");
  return verifier;
}

function openProviderStrongMutationBrokerStoreForTestInternalV1(
  capability: Parameters<
    typeof openProviderStrongMutationBrokerStoreWithVerifierV1
  >[0],
  options: Parameters<
    typeof openProviderStrongMutationBrokerStoreWithVerifierV1
  >[2] = {},
) {
  return openProviderStrongMutationBrokerStoreWithVerifierV1(
    capability,
    verifierForLayoutV1(capability),
    options,
  );
}
const BROKER_SNAPSHOT =
  "runtime-state/private/provider-strong-mutation-broker-v1.snapshot.json";
const BROKER_PUBLICATION =
  "runtime-state/private/provider-strong-mutation-broker-v1.publication.json";
const ACCEPTANCE_SNAPSHOT =
  "runtime-state/private/provider-acceptance-authority-v1.snapshot.json";
const ACCEPTANCE_PUBLICATION =
  "runtime-state/private/provider-acceptance-authority-v1.publication.json";
const IDENTITY_ARTIFACTS = [
  "runtime-state/private/installation-identity-v1.key",
  "runtime-state/private/installation-identity-v1.json",
  "runtime-state/private/installation-identity-v1.init",
] as const;

afterEach(async () => {
  await Promise.all(
    [...fixtureRoots].map((root) => rm(root, { recursive: true, force: true })),
  );
  fixtureRoots.clear();
});

async function fixtureV1() {
  const parent = await mkdtemp(join(tmpdir(), "broker-integrity-"));
  const root = join(parent, "authority");
  fixtureRoots.add(parent);
  const capability =
    createProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1(root);
  brokerVerifierByLayoutV1.set(
    capability,
    await strongMutationTrustVerifierV1(),
  );
  await provisionProviderAcceptanceAuthorityForTestInternalV1(capability, {
    installationIdentityGenerationId:
      TEST_BROKER_INSTALLATION_IDENTITY_GENERATION_ID,
    installationIdentityKey: TEST_INSTALLATION_IDENTITY_KEY,
  });
  const acceptance =
    await openProviderAcceptanceAuthorityStoreForTestInternalV1(capability, {
      clock: testAuthorityClockV1,
    });
  await acceptance.compareAppend(genesisRequestV1({
    installationIdentityGenerationId:
      TEST_BROKER_INSTALLATION_IDENTITY_GENERATION_ID,
    configuration: strongMutationTrustedConfigurationV1(),
  }));
  const read = await acceptance.readCurrent();
  if (read.state !== "current") throw new Error("expected current");
  const current = ProviderAcceptanceCurrentReadV1Schema.parse(read.current);
  const broker =
    await openProviderStrongMutationBrokerStoreForTestInternalV1(capability, {
      clock: testAuthorityClockV1,
    });
  const request = strongMutationRequestV1(current);
  const begun = await broker.begin(request);
  if (begun.resolution !== "recorded") throw new Error("expected intent");
  return {
    root,
    capability,
    broker,
    current,
    request,
    intent: begun.intent,
    snapshotPath: join(root, BROKER_SNAPSHOT),
    publicationPath: join(root, BROKER_PUBLICATION),
  };
}

const BROKER_SNAPSHOT_DIGEST_DOMAIN =
  "understand-code-provider-strong-mutation-broker-snapshot-v1";
const BROKER_SNAPSHOT_TOKEN_DOMAIN =
  "understand-code-provider-strong-mutation-broker-snapshot-token-v1";
const BROKER_PUBLICATION_DIGEST_DOMAIN =
  "understand-code-provider-strong-mutation-broker-publication-pin-v1";
const BROKER_PUBLICATION_TOKEN_DOMAIN =
  "understand-code-provider-strong-mutation-broker-publication-pin-token-v1";

function sha256BytesOracleV1(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function domainDigestOracleV1(
  domain: string,
  value: unknown,
): `sha256:${string}` {
  return sha256BytesOracleV1(
    canonicalizeJcsSafeIntegerUtf8V1([domain, value]),
  );
}

function domainHmacOracleV1(
  domain: string,
  value: unknown,
): `hmac-sha256:${string}` {
  return `hmac-sha256:${createHmac("sha256", TEST_INSTALLATION_IDENTITY_KEY)
    .update(canonicalizeJcsSafeIntegerUtf8V1([domain, value]))
    .digest("hex")}`;
}

function accountingOracleV1(intents: readonly any[]) {
  return {
    intentCount: intents.length,
    pendingCount: intents.filter((intent) => intent.state === "pending").length,
    resolvedCount: intents.filter((intent) => intent.state === "resolved")
      .length,
    intentLogicalBytes: intents.reduce(
      (total, intent) =>
        total + canonicalizeJcsSafeIntegerUtf8V1(intent).byteLength,
      0,
    ),
  };
}

async function rewriteAuthenticatedBrokerClosureV1(
  fixture: Awaited<ReturnType<typeof fixtureV1>>,
  mutatePayload: (payload: any) => void,
  mutatePublicationPayload?: (payload: any) => void,
): Promise<void> {
  const snapshot = JSON.parse(await readFile(fixture.snapshotPath, "utf8"));
  mutatePayload(snapshot.payload);
  snapshot.snapshotContentDigest = domainDigestOracleV1(
    BROKER_SNAPSHOT_DIGEST_DOMAIN,
    snapshot.payload,
  );
  snapshot.snapshotToken = domainHmacOracleV1(
    BROKER_SNAPSHOT_TOKEN_DOMAIN,
    {
      payload: snapshot.payload,
      snapshotContentDigest: snapshot.snapshotContentDigest,
    },
  );

  const publication = JSON.parse(
    await readFile(fixture.publicationPath, "utf8"),
  );
  publication.payload.snapshotRevision = snapshot.payload.snapshotRevision;
  publication.payload.publicationRevision = snapshot.payload.snapshotRevision;
  publication.payload.snapshotContentDigest = snapshot.snapshotContentDigest;
  publication.payload.snapshotTokenDigest = sha256BytesOracleV1(
    canonicalizeJcsSafeIntegerUtf8V1(snapshot.snapshotToken),
  );
  mutatePublicationPayload?.(publication.payload);
  publication.publicationContentDigest = domainDigestOracleV1(
    BROKER_PUBLICATION_DIGEST_DOMAIN,
    publication.payload,
  );
  publication.publicationToken = domainHmacOracleV1(
    BROKER_PUBLICATION_TOKEN_DOMAIN,
    {
      payload: publication.payload,
      publicationContentDigest: publication.publicationContentDigest,
    },
  );

  expect(snapshot.snapshotToken).toBe(
    domainHmacOracleV1(BROKER_SNAPSHOT_TOKEN_DOMAIN, {
      payload: snapshot.payload,
      snapshotContentDigest: snapshot.snapshotContentDigest,
    }),
  );
  expect(publication.publicationToken).toBe(
    domainHmacOracleV1(BROKER_PUBLICATION_TOKEN_DOMAIN, {
      payload: publication.payload,
      publicationContentDigest: publication.publicationContentDigest,
    }),
  );
  await Promise.all([
    writeFile(
      fixture.snapshotPath,
      canonicalizeJcsSafeIntegerUtf8V1(snapshot),
      { mode: 0o600 },
    ),
    writeFile(
      fixture.publicationPath,
      canonicalizeJcsSafeIntegerUtf8V1(publication),
      { mode: 0o600 },
    ),
  ]);
}

async function expectIntegrityFailureV1(
  capability: Parameters<
    typeof openProviderStrongMutationBrokerStoreForTestInternalV1
  >[0],
) {
  await expect(
    openProviderStrongMutationBrokerStoreForTestInternalV1(capability, {
      clock: testAuthorityClockV1,
    }),
  ).rejects.toMatchObject({ code: "namespace_integrity_failed" });
}

describe("strong-mutation broker authenticated recovery closure", () => {
  it.each([
    { name: "snapshot", locator: BROKER_SNAPSHOT },
    { name: "publication pin", locator: BROKER_PUBLICATION },
  ])("rejects a corrupt canonical $name", async ({ locator }) => {
    const fixture = await fixtureV1();
    const path = join(fixture.root, locator);
    const bytes = await readFile(path);
    bytes[Math.floor(bytes.byteLength / 2)]! ^= 1;
    await writeFile(path, bytes, { mode: 0o600 });
    await expectIntegrityFailureV1(fixture.capability);
  });

  it("rejects byte-exact rollback of the snapshot under the current publication pin", async () => {
    const fixture = await fixtureV1();
    const olderSnapshot = await readFile(fixture.snapshotPath);
    await fixture.broker.resolve(
      brokerResolveRequestV1(
        fixture.intent,
        strongMutationResponseV1(fixture.request),
      ),
    );
    await writeFile(fixture.snapshotPath, olderSnapshot, { mode: 0o600 });
    await expectIntegrityFailureV1(fixture.capability);
  });

  it("rejects byte-exact rollback of the publication pin under the current snapshot", async () => {
    const fixture = await fixtureV1();
    const olderPublication = await readFile(fixture.publicationPath);
    await fixture.broker.resolve(
      brokerResolveRequestV1(
        fixture.intent,
        strongMutationResponseV1(fixture.request),
      ),
    );
    await writeFile(fixture.publicationPath, olderPublication, { mode: 0o600 });
    await expectIntegrityFailureV1(fixture.capability);
  });

  it.each([
    { name: "snapshot", locator: BROKER_SNAPSHOT },
    { name: "publication pin", locator: BROKER_PUBLICATION },
  ])("rejects a missing canonical $name once an intent exists", async ({ locator }) => {
    const fixture = await fixtureV1();
    await unlink(join(fixture.root, locator));
    await expectIntegrityFailureV1(fixture.capability);
  });

  it("rejects independently authenticated duplicate grant IDs", async () => {
    const fixture = await fixtureV1();
    await fixture.broker.begin(strongMutationRequestV1(fixture.current, {
      nonceDigit: "a",
      requestId: "a".repeat(32),
      body: "second independently valid broker intent",
    }));
    await rewriteAuthenticatedBrokerClosureV1(fixture, (payload) => {
      payload.intents[1] = cloneJsonV1(payload.intents[0]);
      payload.accounting = accountingOracleV1(payload.intents);
    });
    await expectIntegrityFailureV1(fixture.capability);
  });

  it("rejects independently authenticated accounting mismatch", async () => {
    const fixture = await fixtureV1();
    await rewriteAuthenticatedBrokerClosureV1(fixture, (payload) => {
      payload.accounting.pendingCount = 0;
      payload.accounting.resolvedCount = 1;
    });
    await expectIntegrityFailureV1(fixture.capability);
  });

  it("rejects an independently authenticated pending intent at impossible snapshot revision two", async () => {
    const fixture = await fixtureV1();
    await rewriteAuthenticatedBrokerClosureV1(
      fixture,
      (payload) => {
        payload.snapshotRevision = 2;
        payload.previousSnapshotContentDigest = `sha256:${"a".repeat(64)}`;
      },
      (payload) => {
        payload.previousPublicationContentDigest = `sha256:${"b".repeat(64)}`;
      },
    );
    await expectIntegrityFailureV1(fixture.capability);
  });

  it("rejects an independently authenticated resolved intent at impossible snapshot revision one", async () => {
    const fixture = await fixtureV1();
    await fixture.broker.resolve(
      brokerResolveRequestV1(
        fixture.intent,
        strongMutationResponseV1(fixture.request),
      ),
    );
    await rewriteAuthenticatedBrokerClosureV1(
      fixture,
      (payload) => {
        payload.snapshotRevision = 1;
        payload.previousSnapshotContentDigest = "genesis";
      },
      (payload) => {
        payload.previousPublicationContentDigest = "genesis";
      },
    );
    await expectIntegrityFailureV1(fixture.capability);
  });

  it("rejects an independently authenticated intent-to-request binding mismatch", async () => {
    const fixture = await fixtureV1();
    await rewriteAuthenticatedBrokerClosureV1(fixture, (payload) => {
      payload.intents[0].bindingDigest = `sha256:${"f".repeat(64)}`;
    });
    await expectIntegrityFailureV1(fixture.capability);
  });

  it.each([
    "verification certificate",
    "retained principal attestation",
    "resolved response signature",
  ] as const)(
    "rejects independently authenticated %s tamper after fresh evidence re-verification",
    async (material) => {
    const fixture = await fixtureV1();
    if (material === "resolved response signature") {
      await fixture.broker.resolve(
        brokerResolveRequestV1(
          fixture.intent,
          strongMutationResponseV1(fixture.request),
        ),
      );
    }
    await rewriteAuthenticatedBrokerClosureV1(fixture, (payload) => {
      const intent = payload.intents[0];
      if (material === "verification certificate") {
        intent.verificationCertificate.grantSigner.publicKeyDigest =
          `sha256:${"0".repeat(64)}`;
      } else if (material === "retained principal attestation") {
        const signature = Buffer.from(
          intent.principalAttestation.signature.slice("base64url:".length),
          "base64url",
        );
        signature[0] = (signature[0] ?? 0) ^ 1;
        intent.principalAttestation.signature =
          `base64url:${signature.toString("base64url")}`;
      } else {
        const signature = Buffer.from(
          intent.response.signature.slice("base64url:".length),
          "base64url",
        );
        signature[0] = (signature[0] ?? 0) ^ 1;
        intent.response.signature =
          `base64url:${signature.toString("base64url")}`;
        intent.responseContentDigest = canonicalDigestOracleV1(intent.response);
      }
    });
    await expectIntegrityFailureV1(fixture.capability);
    },
  );

  it("rejects an independently authenticated write-success digest semantic mismatch", async () => {
    const fixture = await fixtureV1();
    await fixture.broker.resolve(
      brokerResolveRequestV1(
        fixture.intent,
        strongMutationResponseV1(fixture.request),
      ),
    );
    await rewriteAuthenticatedBrokerClosureV1(fixture, (payload) => {
      const intent = payload.intents[0];
      intent.response.payload.verifiedContentDigest =
        `sha256:${"e".repeat(64)}`;
      intent.response = resignStrongMutationResponseV1(intent.response);
      intent.responseContentDigest = canonicalDigestOracleV1(intent.response);
      payload.accounting = accountingOracleV1(payload.intents);
    });
    await expectIntegrityFailureV1(fixture.capability);
  });

  it("rejects an independently authenticated compare committed state without a mutation digest", async () => {
    const fixture = await fixtureV1();
    const compareRequest = strongMutationCompareRequestV1(fixture.current);
    const begun = await fixture.broker.begin(compareRequest);
    if (begun.resolution !== "recorded") {
      throw new Error("expected compare intent");
    }
    await fixture.broker.resolve(
      brokerResolveRequestV1(
        begun.intent,
        strongMutationCompareResponseV1(compareRequest, "committed"),
      ),
    );
    await rewriteAuthenticatedBrokerClosureV1(fixture, (payload) => {
      const intent = payload.intents.find(
        (candidate: any) => candidate.request.operation === "compare_commit",
      );
      if (intent === undefined || intent.state !== "resolved") {
        throw new Error("expected resolved compare intent");
      }
      intent.response.payload.state.mutationDigest = "none";
      intent.response = resignStrongMutationResponseV1(intent.response);
      intent.responseContentDigest = canonicalDigestOracleV1(intent.response);
      payload.accounting = accountingOracleV1(payload.intents);
    });
    await expectIntegrityFailureV1(fixture.capability);
  });

  it("rejects an independently authenticated, self-bound intent whose Acceptance identity is absent from current enumeration", async () => {
    const fixture = await fixtureV1();
    const nonexistentCurrent: any = cloneJsonV1(fixture.current);
    nonexistentCurrent.highWater.payload.currentAcceptance = {
      generationId: `provider-acceptance-state:${"f".repeat(22)}`,
      contentDigest: `sha256:${"e".repeat(64)}`,
      acceptanceOrdinal: 99,
    };
    const nonexistentBasisRequest = strongMutationRequestV1(
      nonexistentCurrent,
      {
        nonceDigit: "d",
        requestId: "d".repeat(32),
        body: "self-bound request on a nonexistent Acceptance basis",
      },
    );
    await rewriteAuthenticatedBrokerClosureV1(fixture, (payload) => {
      const replacement = {
        ...payload.intents[0],
        grantId: nonexistentBasisRequest.authorityGrant.grantId,
        requestContentDigest: canonicalDigestOracleV1(nonexistentBasisRequest),
        requestDigest: nonexistentBasisRequest.requestDigest,
        bindingDigest: nonexistentBasisRequest.bindingDigest,
        acceptanceIdentity:
          nonexistentBasisRequest.authorityGrant.payload.acceptanceIdentity,
        request: nonexistentBasisRequest,
      };
      payload.intents[0] = replacement;
      payload.accounting = accountingOracleV1(payload.intents);
    });
    await expectIntegrityFailureV1(fixture.capability);
  });
});

describe("strong-mutation broker literal capacity", () => {
  const base = {
    intentCount: 1,
    requestLogicalBytes: 1,
    responseLogicalBytes: 1,
    snapshotPhysicalBytes: 1,
    isExistingReplay: false,
  } as const;

  it.each([
    {
      name: "intent count",
      field: "intentCount" as const,
      maximum: 4_096,
      reason: "intent_count",
    },
    {
      name: "single request bytes",
      field: "requestLogicalBytes" as const,
      maximum: 8 * 1024 * 1024,
      reason: "request_bytes",
    },
    {
      name: "single response bytes",
      field: "responseLogicalBytes" as const,
      maximum: 8 * 1024 * 1024,
      reason: "response_bytes",
    },
    {
      name: "snapshot physical bytes",
      field: "snapshotPhysicalBytes" as const,
      maximum: 256 * 1024 * 1024,
      reason: "snapshot_bytes",
    },
  ])("admits $name at N and rejects N+1", (testCase) => {
    expect(classifyProviderStrongMutationBrokerAdmissionForTestInternalV1({
      ...base,
      [testCase.field]: testCase.maximum,
    })).toEqual({ admitted: true });
    expect(classifyProviderStrongMutationBrokerAdmissionForTestInternalV1({
      ...base,
      [testCase.field]: testCase.maximum + 1,
    })).toEqual({ admitted: false, reason: testCase.reason });
  });

  it("allows an exact replay after every capacity boundary is exhausted", () => {
    expect(classifyProviderStrongMutationBrokerAdmissionForTestInternalV1({
      intentCount: 4_097,
      requestLogicalBytes: 8 * 1024 * 1024 + 1,
      responseLogicalBytes: 8 * 1024 * 1024 + 1,
      snapshotPhysicalBytes: 256 * 1024 * 1024 + 1,
      isExistingReplay: true,
    })).toEqual({ admitted: true });
  });
});

describe("strong-mutation broker identity presence classification", () => {
  it.each([
    {
      name: "canonical snapshot and publication pin",
      retainOnly: async (_fixture: Awaited<ReturnType<typeof fixtureV1>>) =>
        undefined,
    },
    {
      name: "deterministic snapshot stage",
      retainOnly: async (fixture: Awaited<ReturnType<typeof fixtureV1>>) => {
        await rename(
          fixture.snapshotPath,
          join(
            fixture.root,
            "runtime-state/private/.provider-strong-mutation-broker-v1.snapshot.stage",
          ),
        );
        await unlink(fixture.publicationPath);
      },
    },
    {
      name: "publication stage preparation",
      retainOnly: async (fixture: Awaited<ReturnType<typeof fixtureV1>>) => {
        await rename(
          fixture.publicationPath,
          join(
            fixture.root,
            "runtime-state/private/.provider-strong-mutation-broker-v1.publication.stage.prepare",
          ),
        );
        await unlink(fixture.snapshotPath);
      },
    },
  ])(
    "does not downgrade missing identity with only broker $name retained",
    async (testCase) => {
      const fixture = await fixtureV1();
      await testCase.retainOnly(fixture);
      await Promise.all([
        ...IDENTITY_ARTIFACTS.map((path) => unlink(join(fixture.root, path))),
        unlink(join(fixture.root, ACCEPTANCE_SNAPSHOT)),
        unlink(join(fixture.root, ACCEPTANCE_PUBLICATION)),
      ]);

      await expect(
        openProviderAcceptanceAuthorityStoreForTestInternalV1(
          fixture.capability,
          { clock: testAuthorityClockV1 },
        ),
      ).rejects.toMatchObject({
        name: "ProviderAcceptanceAuthorityErrorV1",
        code: "identity_key_invalid",
      });
      await expect(
        openProviderStrongMutationBrokerStoreForTestInternalV1(
          fixture.capability,
          { clock: testAuthorityClockV1 },
        ),
      ).rejects.toMatchObject({
        name: "ProviderAcceptanceAuthorityErrorV1",
        code: "identity_key_invalid",
      });
      await expect(
        inspectProviderAcceptanceAuthorityCandidateForTestInternalV1(
          fixture.capability,
        ),
      ).resolves.toEqual({
        status: "integrity_failed",
        authority: "installation_owner_candidate",
        strongWrites: "locked",
        namespace: "unavailable",
      });
    },
  );
});
