import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  ProviderRuntimeIpcStrongMutationAuthorityGrantIdV1Schema,
} from "@understand-code/durable-object-provider-contracts/provider-runtime-ipc-v1";

import {
  ProviderRuntimeStrongMutationGrantReplayLedgerInternalV1,
  type ProviderRuntimeStrongMutationGrantReplayLedgerOptionsInternalV1,
} from "../src/strong-mutation-grant-replay-ledger-internal.js";

const cleanupPathsV1: string[] = [];

afterEach(async () => {
  await Promise.all(
    cleanupPathsV1.splice(0).map((path) =>
      rm(path, { recursive: true, force: true }),
    ),
  );
});

function grantIdV1(hexDigit: string) {
  return ProviderRuntimeIpcStrongMutationAuthorityGrantIdV1Schema.parse(
    `sha256:${hexDigit.repeat(64)}`,
  );
}

async function privateRootOptionsV1(
  overrides: Readonly<{
    maximumEntryCount?: number;
    maximumLedgerBytes?: number;
  }> = {},
): Promise<ProviderRuntimeStrongMutationGrantReplayLedgerOptionsInternalV1> {
  const created = await mkdtemp(join(tmpdir(), "provider-grant-ledger-"));
  cleanupPathsV1.push(created);
  await chmod(created, 0o700);
  const ledgerRoot = await realpath(created);
  const metadata = await lstat(ledgerRoot);
  return {
    ledgerRoot,
    expectedUid: metadata.uid,
    expectedGid: metadata.gid,
    ...overrides,
  };
}

describe("durable strong mutation GrantId replay ledger", () => {
  it("commits once, replays without appending, and survives re-instantiation", async () => {
    const options = await privateRootOptionsV1();
    const grantId = grantIdV1("a");
    const firstLedger =
      new ProviderRuntimeStrongMutationGrantReplayLedgerInternalV1(options);
    await firstLedger.initialize();

    const committed = await firstLedger.consume(grantId);
    expect(committed).toMatchObject({
      resolution: "committed",
      grantId,
      ordinal: 1,
    });
    await expect(firstLedger.consume(grantId)).resolves.toEqual({
      ...committed,
      resolution: "replayed",
    });
    expect(await readdir(options.ledgerRoot)).toEqual([
      "0000000000000001.json",
    ]);
    const serialized = await readFile(
      join(options.ledgerRoot, "0000000000000001.json"),
      "utf8",
    );
    expect(serialized.endsWith("\n")).toBe(true);
    expect(JSON.parse(serialized)).toMatchObject({
      ordinal: 1,
      grantId,
      previousRecordDigest: "none",
      recordDigest: committed.recordDigest,
    });

    const restarted =
      new ProviderRuntimeStrongMutationGrantReplayLedgerInternalV1(options);
    await restarted.initialize();
    await expect(restarted.consume(grantId)).resolves.toEqual({
      ...committed,
      resolution: "replayed",
    });
  });

  it("serializes concurrent consumers and preserves distinct GrantIds", async () => {
    const options = await privateRootOptionsV1();
    const first = grantIdV1("1");
    const ledgerA =
      new ProviderRuntimeStrongMutationGrantReplayLedgerInternalV1(options);
    const ledgerB =
      new ProviderRuntimeStrongMutationGrantReplayLedgerInternalV1(options);
    const sameGrantResults = await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        (index % 2 === 0 ? ledgerA : ledgerB).consume(first),
      ),
    );
    expect(
      sameGrantResults.filter((result) => result.resolution === "committed"),
    ).toHaveLength(1);
    expect(
      sameGrantResults.filter((result) => result.resolution === "replayed"),
    ).toHaveLength(11);

    const [second, third] = await Promise.all([
      ledgerA.consume(grantIdV1("2")),
      ledgerB.consume(grantIdV1("3")),
    ]);
    expect([second.resolution, third.resolution]).toEqual([
      "committed",
      "committed",
    ]);
    expect([second.ordinal, third.ordinal]).toEqual([2, 3]);
    expect(await readdir(options.ledgerRoot)).toHaveLength(3);
    const firstCommitted = sameGrantResults.find(
      (result) => result.resolution === "committed",
    )!;
    expect(
      JSON.parse(
        await readFile(
          join(options.ledgerRoot, "0000000000000002.json"),
          "utf8",
        ),
      ),
    ).toMatchObject({ previousRecordDigest: firstCommitted.recordDigest });
    expect(
      JSON.parse(
        await readFile(
          join(options.ledgerRoot, "0000000000000003.json"),
          "utf8",
        ),
      ),
    ).toMatchObject({ previousRecordDigest: second.recordDigest });
  });

  it("fails closed for corrupt records and unexpected directory entries", async () => {
    const corruptOptions = await privateRootOptionsV1();
    const corruptLedger =
      new ProviderRuntimeStrongMutationGrantReplayLedgerInternalV1(
        corruptOptions,
      );
    await corruptLedger.consume(grantIdV1("4"));
    await writeFile(
      join(corruptOptions.ledgerRoot, "0000000000000001.json"),
      "{}\n",
    );
    await expect(corruptLedger.consume(grantIdV1("5"))).rejects.toMatchObject({
      code: "ledger_corrupt",
    });

    const extraOptions = await privateRootOptionsV1();
    await writeFile(join(extraOptions.ledgerRoot, "notes.txt"), "unexpected", {
      mode: 0o600,
    });
    const extraLedger =
      new ProviderRuntimeStrongMutationGrantReplayLedgerInternalV1(
        extraOptions,
      );
    await expect(extraLedger.initialize()).rejects.toMatchObject({
      code: "ledger_corrupt",
    });
  });

  it("rejects symlink roots, symlink records, and permissive record modes", async () => {
    const targetOptions = await privateRootOptionsV1();
    const link = join(
      dirname(targetOptions.ledgerRoot),
      `provider-grant-ledger-link-${process.pid}-${Date.now()}`,
    );
    cleanupPathsV1.push(link);
    await symlink(targetOptions.ledgerRoot, link, "dir");
    const linkedLedger =
      new ProviderRuntimeStrongMutationGrantReplayLedgerInternalV1({
        ...targetOptions,
        ledgerRoot: link,
      });
    await expect(linkedLedger.initialize()).rejects.toMatchObject({
      code: "root_invalid",
    });

    const symlinkOptions = await privateRootOptionsV1();
    const symlinkTarget = join(
      dirname(symlinkOptions.ledgerRoot),
      `provider-grant-ledger-target-${process.pid}-${Date.now()}`,
    );
    cleanupPathsV1.push(symlinkTarget);
    await writeFile(symlinkTarget, "{}\n", { mode: 0o600 });
    await symlink(
      symlinkTarget,
      join(symlinkOptions.ledgerRoot, "0000000000000001.json"),
    );
    const symlinkLedger =
      new ProviderRuntimeStrongMutationGrantReplayLedgerInternalV1(
        symlinkOptions,
      );
    await expect(symlinkLedger.initialize()).rejects.toMatchObject({
      code: "storage_security_violation",
    });

    const modeOptions = await privateRootOptionsV1();
    const modeLedger =
      new ProviderRuntimeStrongMutationGrantReplayLedgerInternalV1(modeOptions);
    await modeLedger.consume(grantIdV1("6"));
    await chmod(
      join(modeOptions.ledgerRoot, "0000000000000001.json"),
      0o644,
    );
    await expect(modeLedger.consume(grantIdV1("7"))).rejects.toMatchObject({
      code: "storage_security_violation",
    });
  });

  it("detects rollback below the process-observed high-water", async () => {
    const options = await privateRootOptionsV1();
    const ledger =
      new ProviderRuntimeStrongMutationGrantReplayLedgerInternalV1(options);
    await ledger.consume(grantIdV1("8"));
    await ledger.consume(grantIdV1("9"));
    await unlink(join(options.ledgerRoot, "0000000000000002.json"));

    const reinstantiated =
      new ProviderRuntimeStrongMutationGrantReplayLedgerInternalV1(options);
    await expect(
      reinstantiated.consume(grantIdV1("a")),
    ).rejects.toMatchObject({ code: "rollback_detected" });
  });

  it("rejects replacement of the observed ledger root inode", async () => {
    const options = await privateRootOptionsV1();
    const ledger =
      new ProviderRuntimeStrongMutationGrantReplayLedgerInternalV1(options);
    await ledger.consume(grantIdV1("e"));
    const movedRoot = `${options.ledgerRoot}-moved`;
    cleanupPathsV1.push(movedRoot);
    await rename(options.ledgerRoot, movedRoot);
    await mkdir(options.ledgerRoot, { mode: 0o700 });

    await expect(ledger.consume(grantIdV1("f"))).rejects.toMatchObject({
      code: "storage_security_violation",
    });
  });

  it("never evicts and fails closed at entry and byte caps", async () => {
    const entryOptions = await privateRootOptionsV1({
      maximumEntryCount: 1,
    });
    const entryLedger =
      new ProviderRuntimeStrongMutationGrantReplayLedgerInternalV1(
        entryOptions,
      );
    const firstId = grantIdV1("b");
    await expect(entryLedger.consume(firstId)).resolves.toMatchObject({
      resolution: "committed",
    });
    await expect(entryLedger.consume(firstId)).resolves.toMatchObject({
      resolution: "replayed",
    });
    await expect(entryLedger.consume(grantIdV1("c"))).rejects.toMatchObject({
      code: "ledger_capacity_exceeded",
    });
    expect(await readdir(entryOptions.ledgerRoot)).toEqual([
      "0000000000000001.json",
    ]);

    const byteOptions = await privateRootOptionsV1({
      maximumLedgerBytes: 1,
    });
    const byteLedger =
      new ProviderRuntimeStrongMutationGrantReplayLedgerInternalV1(byteOptions);
    await expect(byteLedger.consume(grantIdV1("d"))).rejects.toMatchObject({
      code: "ledger_capacity_exceeded",
    });
    expect(await readdir(byteOptions.ledgerRoot)).toEqual([]);
  });

  it("requires a pre-provisioned exact private root and never creates it", async () => {
    const base = await privateRootOptionsV1();
    const missingRoot = join(base.ledgerRoot, "missing");
    const ledger =
      new ProviderRuntimeStrongMutationGrantReplayLedgerInternalV1({
        ...base,
        ledgerRoot: missingRoot,
      });
    await expect(ledger.initialize()).rejects.toMatchObject({
      code: "root_invalid",
    });
    await expect(lstat(missingRoot)).rejects.toMatchObject({ code: "ENOENT" });

    const permissiveRoot = await privateRootOptionsV1();
    await chmod(permissiveRoot.ledgerRoot, 0o755);
    const permissiveLedger =
      new ProviderRuntimeStrongMutationGrantReplayLedgerInternalV1(
        permissiveRoot,
      );
    await expect(permissiveLedger.initialize()).rejects.toMatchObject({
      code: "root_invalid",
    });
  });
});
