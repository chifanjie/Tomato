import { lstat, mkdtemp, readFile, rm, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1,
  inspectProviderAcceptanceAuthorityCandidateForTestInternalV1,
  openProviderAcceptanceAuthorityStoreForTestInternalV1,
  provisionProviderAcceptanceAuthorityForTestInternalV1,
} from "../src/test-seam-internal.js";
import {
  TEST_INSTALLATION_IDENTITY_GENERATION_ID,
  TEST_INSTALLATION_IDENTITY_KEY,
  genesisRequestV1,
  operationNonceV1,
  successorRequestV1,
  testAuthorityClockV1,
} from "./acceptance-store-fixtures.js";

const fixtureRoots = new Set<string>();

afterEach(async () => {
  await Promise.all(
    [...fixtureRoots].map((root) => rm(root, { recursive: true, force: true })),
  );
  fixtureRoots.clear();
});

async function fixtureV1(committed: boolean) {
  const root = await mkdtemp(join(tmpdir(), "provider-authority-identity-"));
  fixtureRoots.add(root);
  const capability =
    createProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1(root);
  await provisionProviderAcceptanceAuthorityForTestInternalV1(capability, {
    installationIdentityGenerationId:
      TEST_INSTALLATION_IDENTITY_GENERATION_ID,
    installationIdentityKey: TEST_INSTALLATION_IDENTITY_KEY,
  });
  if (committed) {
    const store =
      await openProviderAcceptanceAuthorityStoreForTestInternalV1(capability, {
        clock: testAuthorityClockV1,
      });
    await store.compareAppend(genesisRequestV1());
    return { root, capability, store };
  }
  return { root, capability, store: undefined };
}

const integrityHealthV1 = Object.freeze({
  status: "integrity_failed" as const,
  authority: "installation_owner_candidate" as const,
  strongWrites: "locked" as const,
  namespace: "unavailable" as const,
});

const unprovisionedHealthV1 = Object.freeze({
  status: "unprovisioned" as const,
  authority: "installation_owner_candidate" as const,
  strongWrites: "locked" as const,
  namespace: "unavailable" as const,
});

async function expectFreshOpenErrorV1(
  capability: Parameters<
    typeof openProviderAcceptanceAuthorityStoreForTestInternalV1
  >[0],
  root: string,
  expectedCodes: readonly string[],
): Promise<void> {
  try {
    await openProviderAcceptanceAuthorityStoreForTestInternalV1(capability, {
      clock: testAuthorityClockV1,
    });
    throw new Error("expected fresh authority open to fail");
  } catch (error) {
    expect(error).toMatchObject({
      name: "ProviderAcceptanceAuthorityErrorV1",
    });
    const code = error !== null && typeof error === "object" &&
        "code" in error
      ? String(error.code)
      : "";
    expect(expectedCodes).toContain(code);
    const observable = `${String(error)} ${JSON.stringify(error)}`;
    expect(observable).not.toContain(root);
    expect(observable).not.toContain(
      Buffer.from(TEST_INSTALLATION_IDENTITY_KEY).toString("hex"),
    );
  }
}

const identityArtifacts = [
  {
    name: "key",
    relativePath: "runtime-state/private/installation-identity-v1.key",
  },
  {
    name: "state",
    relativePath: "runtime-state/private/installation-identity-v1.json",
  },
  {
    name: "initialization marker",
    relativePath: "runtime-state/private/installation-identity-v1.init",
  },
] as const;

describe("provider Acceptance authority identity presence classification", () => {
  for (const committed of [false, true]) {
    for (const artifact of identityArtifacts) {
      it(`classifies a missing ${artifact.name} after ${
        committed ? "commit" : "provision"
      } as integrity failure`, async () => {
        const { root, capability } = await fixtureV1(committed);
        await unlink(join(root, artifact.relativePath));

        await expectFreshOpenErrorV1(
          capability,
          root,
          ["identity_key_invalid"],
        );
        await expect(
          inspectProviderAcceptanceAuthorityCandidateForTestInternalV1(
            capability,
          ),
        ).resolves.toEqual(integrityHealthV1);
      });
    }
  }

  it.each([
    { name: "snapshot and publication pin", remove: [] },
    {
      name: "snapshot only",
      remove: [
        "runtime-state/private/provider-acceptance-authority-v1.publication.json",
      ],
    },
    {
      name: "publication pin only",
      remove: [
        "runtime-state/private/provider-acceptance-authority-v1.snapshot.json",
      ],
    },
  ])(
    "does not downgrade missing identity with $name retained to unprovisioned",
    async (testCase) => {
      const { root, capability } = await fixtureV1(true);
      await Promise.all(
        identityArtifacts.map((artifact) =>
          unlink(join(root, artifact.relativePath))
        ),
      );
      await Promise.all(
        testCase.remove.map((relativePath) => unlink(join(root, relativePath))),
      );

      await expectFreshOpenErrorV1(
        capability,
        root,
        ["identity_key_invalid"],
      );
      await expect(
        inspectProviderAcceptanceAuthorityCandidateForTestInternalV1(
          capability,
        ),
      ).resolves.toEqual(integrityHealthV1);
    },
  );

  it("reports unprovisioned only when the complete directory tree has no identity or store artifacts", async () => {
    const { root, capability } = await fixtureV1(false);
    await Promise.all(
      identityArtifacts.map((artifact) =>
        unlink(join(root, artifact.relativePath))
      ),
    );

    await expectFreshOpenErrorV1(capability, root, ["not_provisioned"]);
    await expect(
      inspectProviderAcceptanceAuthorityCandidateForTestInternalV1(capability),
    ).resolves.toEqual(unprovisionedHealthV1);
  });

  it("reports an entirely absent root as unprovisioned without creating it", async () => {
    const root = await mkdtemp(join(tmpdir(), "provider-authority-absent-"));
    const capability =
      createProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1(root);
    await rm(root, { recursive: true });

    await expectFreshOpenErrorV1(capability, root, ["not_provisioned"]);
    await expect(
      inspectProviderAcceptanceAuthorityCandidateForTestInternalV1(capability),
    ).resolves.toEqual(unprovisionedHealthV1);
    await expect(lstat(root)).rejects.toMatchObject({ code: "ENOENT" });
  });

  for (const artifact of identityArtifacts) {
    it(`revalidates a long-lived handle after deleting its ${artifact.name} without writing`, async () => {
      const { root, store } = await fixtureV1(true);
      if (store === undefined) throw new Error("expected committed store");
      const current = await store.readCurrent();
      if (current.state !== "current") throw new Error("expected current");
      const snapshotPath = join(
        root,
        "runtime-state/private/provider-acceptance-authority-v1.snapshot.json",
      );
      const publicationPath = join(
        root,
        "runtime-state/private/provider-acceptance-authority-v1.publication.json",
      );
      const [snapshotBefore, publicationBefore] = await Promise.all([
        readFile(snapshotPath),
        readFile(publicationPath),
      ]);
      const request = successorRequestV1({
        current: current.current,
        operationNonce: operationNonceV1(61),
      });
      await unlink(join(root, artifact.relativePath));

      await expect(
        store.compareAppend(request),
      ).rejects.toMatchObject({
        name: "ProviderAcceptanceAuthorityErrorV1",
        code: "identity_key_invalid",
      });
      await expect(readFile(snapshotPath)).resolves.toEqual(snapshotBefore);
      await expect(readFile(publicationPath)).resolves.toEqual(
        publicationBefore,
      );
    });
  }
});

describe("provider Acceptance authority required directory classification", () => {
  const requiredDirectories = [
    "runtime-state",
    "runtime-state/private",
    "provider",
    "provider/acceptance",
  ] as const;

  for (const committed of [false, true]) {
    for (const relativePath of requiredDirectories) {
      it(`classifies missing ${relativePath} after ${
        committed ? "commit" : "provision"
      } as integrity failure`, async () => {
        const { root, capability } = await fixtureV1(committed);
        await rm(join(root, relativePath), { recursive: true });

        await expectFreshOpenErrorV1(
          capability,
          root,
          ["invalid_layout", "identity_key_invalid"],
        );
        await expect(
          inspectProviderAcceptanceAuthorityCandidateForTestInternalV1(
            capability,
          ),
        ).resolves.toEqual(integrityHealthV1);
      });
    }
  }
});
