import { execFileSync } from "node:child_process";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  armTestProviderRuntimeNativeExactObjectParentFsyncFailureV1,
  armTestProviderRuntimeNativeExactObjectPreLinkParentAbaV1,
  armTestProviderRuntimeNativeExactObjectPostLinkParentChangeV1,
  closeProviderRuntimeNativeExactObjectPublisherV1,
  closeProviderRuntimeNativeExactObjectSourceV1,
  commitProviderRuntimeNativeExactObjectV1,
  openProviderRuntimeNativeExactObjectPublisherV1,
  stageProviderRuntimeNativeExactObjectV1,
  type ProviderRuntimeNativeExactObjectPublisherV1,
  type ProviderRuntimeNativeExactObjectSourceV1,
} from "../src/index.js";

const finalNameV1 = `${"a".repeat(64)}.blob`;
const ext4RootV1 = process.env.PROVIDER_EXACT_OBJECT_EXT4_TEST_ROOT;
const runRealExt4V1 =
  process.platform === "linux" &&
  typeof ext4RootV1 === "string" &&
  resolve(ext4RootV1) === ext4RootV1;

const publishersV1: ProviderRuntimeNativeExactObjectPublisherV1[] = [];
const sourcesV1: ProviderRuntimeNativeExactObjectSourceV1[] = [];
const fixturesV1: string[] = [];

afterEach(async () => {
  for (const source of sourcesV1.splice(0)) {
    try {
      closeProviderRuntimeNativeExactObjectSourceV1(source);
    } catch {
      // A committed/rejected source is already consumed.
    }
  }
  for (const publisher of publishersV1.splice(0)) {
    try {
      closeProviderRuntimeNativeExactObjectPublisherV1(publisher);
    } catch {
      // Cleanup must continue across all retained authorities.
    }
  }
  await Promise.allSettled(
    fixturesV1.splice(0).map((fixture) => rm(fixture, {
      force: true,
      recursive: true,
    })),
  );
});

async function fixtureV1(): Promise<string> {
  const fixture = await mkdtemp(join(ext4RootV1!, "exact-object-v1-"));
  await chmod(fixture, 0o700);
  fixturesV1.push(fixture);
  return fixture;
}

function openPublisherV1(path: string): ProviderRuntimeNativeExactObjectPublisherV1 {
  const publisher = openProviderRuntimeNativeExactObjectPublisherV1(path, {
    expectedOwnerUid: process.geteuid?.() ?? process.getuid!(),
    expectedOwnerGid: process.getegid?.() ?? process.getgid!(),
  });
  publishersV1.push(publisher);
  return publisher;
}

function stageV1(
  publisher: ProviderRuntimeNativeExactObjectPublisherV1,
  bytes: Buffer,
): ProviderRuntimeNativeExactObjectSourceV1 {
  const source = stageProviderRuntimeNativeExactObjectV1(publisher, bytes);
  sourcesV1.push(source);
  return source;
}

function renameExchangeV1(left: string, right: string): void {
  execFileSync("python3", [
    "-c",
    [
      "import ctypes, os, sys",
      "libc=ctypes.CDLL(None, use_errno=True)",
      "fn=libc.renameat2",
      "fn.argtypes=[ctypes.c_int,ctypes.c_char_p,ctypes.c_int,ctypes.c_char_p,ctypes.c_uint]",
      "result=fn(-100,os.fsencode(sys.argv[1]),-100,os.fsencode(sys.argv[2]),2)",
      "result == 0 or (_ for _ in ()).throw(OSError(ctypes.get_errno(),os.strerror(ctypes.get_errno())))",
    ].join(";"),
    left,
    right,
  ]);
}

describe("native exact-object architecture", () => {
  it("admits no source pathname or source-name rename/link in the commit boundary", async () => {
    const sourcePath = join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "native",
      "kernel_bridge.c",
    );
    const source = await readFile(sourcePath, "utf8");
    const start = source.indexOf("static napi_value commit_provider_exact_object");
    const end = source.indexOf(
      "static napi_value revalidate_provider_exact_object_publisher",
      start,
    );
    const commit = source.slice(start, end);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(commit).toContain(
      "linkat(source->file_descriptor, \"\", parent_descriptor,",
    );
    expect(commit).toContain("AT_EMPTY_PATH");
    expect(source).toContain("inotify_init1(IN_NONBLOCK | IN_CLOEXEC)");
    expect(source).toContain("provider_exact_object_initialize_parent_watches(source)");
    expect(commit).toContain(
      "provider_exact_object_consume_expected_link_event(source, final_name)",
    );
    expect(commit.indexOf(
      "provider_exact_object_apply_test_pre_link_parent_aba(publisher)",
    )).toBeLessThan(commit.indexOf(
      "linkat(source->file_descriptor, \"\", parent_descriptor,",
    ));
    expect(commit).not.toMatch(/\brename(?:at2)?\s*\(/u);
    expect(commit).not.toMatch(/\blink\s*\(/u);
  });
});

describe.runIf(runRealExt4V1)("native exact-object publication on real ext4", () => {
  it("publishes an unnamed retained source no-replace and reports collision", async () => {
    const parent = await fixtureV1();
    const publisher = openPublisherV1(parent);
    const bytes = Buffer.from("exact-object-v1\n", "utf8");
    expect(commitProviderRuntimeNativeExactObjectV1(
      publisher,
      stageV1(publisher, bytes),
      finalNameV1,
    )).toEqual({ status: "committed" });
    expect(await readFile(join(parent, finalNameV1))).toEqual(bytes);
    expect(commitProviderRuntimeNativeExactObjectV1(
      publisher,
      stageV1(publisher, bytes),
      finalNameV1,
    )).toEqual({
      status: "not_committed",
      reason: "final_collision",
    });
    expect(await readdir(parent)).toEqual([finalNameV1]);
  });

  it("allows only one outstanding source per publisher", async () => {
    const parent = await fixtureV1();
    const publisher = openPublisherV1(parent);
    const first = stageV1(publisher, Buffer.from("first", "utf8"));
    expect(() => stageProviderRuntimeNativeExactObjectV1(
      publisher,
      Buffer.from("second", "utf8"),
    )).toThrowError(expect.objectContaining({
      code: "ERR_PROVIDER_RUNTIME_NATIVE_EXACT_OBJECT_UNAVAILABLE",
    }));
    closeProviderRuntimeNativeExactObjectSourceV1(first);
    const replacement = stageV1(publisher, Buffer.from("replacement", "utf8"));
    closeProviderRuntimeNativeExactObjectSourceV1(replacement);
  });

  it("keeps an uninvoked source closeable after final-name validation rejects", async () => {
    const parent = await fixtureV1();
    const publisher = openPublisherV1(parent);
    const source = stageV1(
      publisher,
      Buffer.from("invalid-final-name", "utf8"),
    );
    expect(() => commitProviderRuntimeNativeExactObjectV1(
      publisher,
      source,
      "not-a-content-addressed-name.blob",
    )).toThrowError(expect.objectContaining({
      code: "ERR_PROVIDER_RUNTIME_NATIVE_EXACT_OBJECT_UNAVAILABLE",
    }));
    closeProviderRuntimeNativeExactObjectSourceV1(source);
    const replacement = stageV1(
      publisher,
      Buffer.from("replacement-after-invalid-name", "utf8"),
    );
    closeProviderRuntimeNativeExactObjectSourceV1(replacement);
    expect(await readdir(parent)).toEqual([]);
  });

  it("rolls back the exact link when the parent projection changes post-link", async () => {
    const parent = await fixtureV1();
    const publisher = openPublisherV1(parent);
    const source = stageV1(
      publisher,
      Buffer.from("post-link-projection-change", "utf8"),
    );
    armTestProviderRuntimeNativeExactObjectPostLinkParentChangeV1(publisher);
    expect(commitProviderRuntimeNativeExactObjectV1(
      publisher,
      source,
      finalNameV1,
    )).toEqual({
      status: "not_committed",
      reason: "parent_path_projection_changed",
    });
    expect(await readdir(parent)).toEqual([]);
  });

  it("keeps post-link parent-fsync failure indeterminate until durable collision recovery", async () => {
    const parent = await fixtureV1();
    const publisher = openPublisherV1(parent);
    const bytes = Buffer.from("post-link-fsync-cut\n", "utf8");
    armTestProviderRuntimeNativeExactObjectParentFsyncFailureV1(publisher);
    expect(commitProviderRuntimeNativeExactObjectV1(
      publisher,
      stageV1(publisher, bytes),
      finalNameV1,
    )).toEqual({ status: "durability_indeterminate" });
    expect(await readFile(join(parent, finalNameV1))).toEqual(bytes);
    expect(commitProviderRuntimeNativeExactObjectV1(
      publisher,
      stageV1(publisher, bytes),
      finalNameV1,
    )).toEqual({ status: "not_committed", reason: "final_collision" });
    expect(await readFile(join(parent, finalNameV1))).toEqual(bytes);
  });

  it("rejects a parent rename/replacement before any namespace side effect", async () => {
    const root = await fixtureV1();
    const parent = join(root, "parent");
    const moved = join(root, "moved");
    await mkdir(parent, { mode: 0o700 });
    const publisher = openPublisherV1(parent);
    const source = stageV1(publisher, Buffer.from("rename-race", "utf8"));
    await rename(parent, moved);
    await mkdir(parent, { mode: 0o700 });
    expect(commitProviderRuntimeNativeExactObjectV1(
      publisher,
      source,
      finalNameV1,
    )).toEqual({
      status: "not_committed",
      reason: "parent_path_projection_changed",
    });
    expect(await readdir(parent)).toEqual([]);
    expect(await readdir(moved)).toEqual([]);
  });

  it("rejects rename-exchange and a cross-authority source at zero writes", async () => {
    const root = await fixtureV1();
    const left = join(root, "left");
    const right = join(root, "right");
    await mkdir(left, { mode: 0o700 });
    await mkdir(right, { mode: 0o700 });
    const leftPublisher = openPublisherV1(left);
    const rightPublisher = openPublisherV1(right);
    const exchanged = stageV1(
      leftPublisher,
      Buffer.from("exchange-race", "utf8"),
    );
    const foreign = stageV1(
      rightPublisher,
      Buffer.from("source-swap", "utf8"),
    );
    renameExchangeV1(left, right);
    expect(commitProviderRuntimeNativeExactObjectV1(
      leftPublisher,
      exchanged,
      finalNameV1,
    )).toEqual({
      status: "not_committed",
      reason: "parent_path_projection_changed",
    });

    expect(() => commitProviderRuntimeNativeExactObjectV1(
      leftPublisher,
      foreign,
      finalNameV1,
    )).toThrowError(
      expect.objectContaining({
        code: "ERR_PROVIDER_RUNTIME_NATIVE_EXACT_OBJECT_UNAVAILABLE",
      }),
    );
    expect(() => stageProviderRuntimeNativeExactObjectV1(
      rightPublisher,
      Buffer.from("post-exchange-stage", "utf8"),
    )).toThrowError(expect.objectContaining({
      code: "ERR_PROVIDER_RUNTIME_NATIVE_EXACT_OBJECT_UNAVAILABLE",
    }));
    expect(await readdir(left)).toEqual([]);
    expect(await readdir(right)).toEqual([]);
  });

  it("rejects a double rename-exchange pathname ABA after staging", async () => {
    const root = await fixtureV1();
    const left = join(root, "left");
    const right = join(root, "right");
    await mkdir(left, { mode: 0o700 });
    await mkdir(right, { mode: 0o700 });
    const publisher = openPublisherV1(left);
    const source = stageV1(
      publisher,
      Buffer.from("double-exchange-aba", "utf8"),
    );

    renameExchangeV1(left, right);
    renameExchangeV1(left, right);

    expect(commitProviderRuntimeNativeExactObjectV1(
      publisher,
      source,
      finalNameV1,
    )).toEqual({
      status: "not_committed",
      reason: "parent_path_projection_changed",
    });
    expect(await readdir(left)).toEqual([]);
    expect(await readdir(right)).toEqual([]);
  });

  it("rejects pathname ABA in the exact precheck-to-link window", async () => {
    const root = await fixtureV1();
    const left = join(root, "left");
    const right = join(root, "right");
    await mkdir(left, { mode: 0o700 });
    await mkdir(right, { mode: 0o700 });
    const publisher = openPublisherV1(left);
    const source = stageV1(
      publisher,
      Buffer.from("prelink-double-exchange-aba", "utf8"),
    );
    armTestProviderRuntimeNativeExactObjectPreLinkParentAbaV1(
      publisher,
      right,
    );

    expect(commitProviderRuntimeNativeExactObjectV1(
      publisher,
      source,
      finalNameV1,
    )).toEqual({
      status: "not_committed",
      reason: "parent_path_projection_changed",
    });
    expect(await readdir(left)).toEqual([]);
    expect(await readdir(right)).toEqual([]);
  });
});
