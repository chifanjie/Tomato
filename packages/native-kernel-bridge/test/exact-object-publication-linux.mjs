import { execFileSync } from "node:child_process";
import { strict as assert } from "node:assert";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
} from "node:fs";
import { join, resolve } from "node:path";

import {
  armTestProviderRuntimeNativeExactObjectParentFsyncFailureV1,
  armTestProviderRuntimeNativeExactObjectPreLinkParentAbaV1,
  armTestProviderRuntimeNativeExactObjectPostLinkParentChangeV1,
  closeProviderRuntimeNativeExactObjectPublisherV1,
  closeProviderRuntimeNativeExactObjectSourceV1,
  commitProviderRuntimeNativeExactObjectV1,
  openProviderRuntimeNativeExactObjectPublisherV1,
  stageProviderRuntimeNativeExactObjectV1,
} from "../dist/index.js";

const ext4Root = process.env.PROVIDER_EXACT_OBJECT_EXT4_TEST_ROOT;
if (
  process.platform !== "linux" ||
  typeof ext4Root !== "string" ||
  resolve(ext4Root) !== ext4Root
) {
  throw new Error("exact-object proof requires an absolute ext4 test root");
}

const finalName = `${"a".repeat(64)}.blob`;
const fixture = mkdtempSync(join(ext4Root, "exact-object-script-v1-"));
chmodSync(fixture, 0o700);
const publishers = [];
const sources = [];
const open = (path) => {
  const publisher = openProviderRuntimeNativeExactObjectPublisherV1(path, {
    expectedOwnerUid: process.geteuid(),
    expectedOwnerGid: process.getegid(),
  });
  publishers.push(publisher);
  return publisher;
};
const stage = (publisher, value) => {
  const source = stageProviderRuntimeNativeExactObjectV1(
    publisher,
    Buffer.from(value, "utf8"),
  );
  sources.push(source);
  return source;
};
const exchange = (left, right) => {
  execFileSync("/usr/bin/python3", [
    "-c",
    "import ctypes,os,sys;libc=ctypes.CDLL(None,use_errno=True);r=libc.renameat2(-100,os.fsencode(sys.argv[1]),-100,os.fsencode(sys.argv[2]),2);r==0 or (_ for _ in ()).throw(OSError(ctypes.get_errno(),os.strerror(ctypes.get_errno())))",
    left,
    right,
  ]);
};

try {
  const committedParent = join(fixture, "committed");
  mkdirSync(committedParent, { mode: 0o700 });
  const committedPublisher = open(committedParent);
  const bytes = "exact-object-v1\n";
  assert.deepEqual(
    commitProviderRuntimeNativeExactObjectV1(
      committedPublisher,
      stage(committedPublisher, bytes),
      finalName,
    ),
    { status: "committed" },
  );

  const outstandingParent = join(fixture, "single-outstanding");
  mkdirSync(outstandingParent, { mode: 0o700 });
  const outstandingPublisher = open(outstandingParent);
  const outstandingSource = stage(outstandingPublisher, "first-source");
  assert.throws(() => stage(outstandingPublisher, "second-source"));
  closeProviderRuntimeNativeExactObjectSourceV1(outstandingSource);
  closeProviderRuntimeNativeExactObjectSourceV1(
    stage(outstandingPublisher, "replacement-source"),
  );

  const invalidNameParent = join(fixture, "invalid-final-name");
  mkdirSync(invalidNameParent, { mode: 0o700 });
  const invalidNamePublisher = open(invalidNameParent);
  const invalidNameSource = stage(invalidNamePublisher, "invalid-final-name");
  assert.throws(() =>
    commitProviderRuntimeNativeExactObjectV1(
      invalidNamePublisher,
      invalidNameSource,
      "not-a-content-addressed-name.blob",
    )
  );
  closeProviderRuntimeNativeExactObjectSourceV1(invalidNameSource);
  closeProviderRuntimeNativeExactObjectSourceV1(
    stage(invalidNamePublisher, "replacement-after-invalid-name"),
  );
  assert.deepEqual(readdirSync(invalidNameParent), []);

  const postLinkParent = join(fixture, "post-link-change");
  mkdirSync(postLinkParent, { mode: 0o700 });
  const postLinkPublisher = open(postLinkParent);
  const postLinkSource = stage(postLinkPublisher, "post-link-change");
  armTestProviderRuntimeNativeExactObjectPostLinkParentChangeV1(
    postLinkPublisher,
  );
  assert.deepEqual(
    commitProviderRuntimeNativeExactObjectV1(
      postLinkPublisher,
      postLinkSource,
      finalName,
    ),
    { status: "not_committed", reason: "parent_path_projection_changed" },
  );
  assert.deepEqual(readdirSync(postLinkParent), []);

  const indeterminateParent = join(fixture, "indeterminate");
  mkdirSync(indeterminateParent, { mode: 0o700 });
  const indeterminatePublisher = open(indeterminateParent);
  const indeterminateBytes = "post-link-fsync-cut\n";
  armTestProviderRuntimeNativeExactObjectParentFsyncFailureV1(
    indeterminatePublisher,
  );
  assert.deepEqual(
    commitProviderRuntimeNativeExactObjectV1(
      indeterminatePublisher,
      stage(indeterminatePublisher, indeterminateBytes),
      finalName,
    ),
    { status: "durability_indeterminate" },
  );
  assert.equal(
    readFileSync(join(indeterminateParent, finalName), "utf8"),
    indeterminateBytes,
  );
  assert.deepEqual(
    commitProviderRuntimeNativeExactObjectV1(
      indeterminatePublisher,
      stage(indeterminatePublisher, indeterminateBytes),
      finalName,
    ),
    { status: "not_committed", reason: "final_collision" },
  );
  assert.equal(readFileSync(join(committedParent, finalName), "utf8"), bytes);
  assert.deepEqual(
    commitProviderRuntimeNativeExactObjectV1(
      committedPublisher,
      stage(committedPublisher, bytes),
      finalName,
    ),
    { status: "not_committed", reason: "final_collision" },
  );

  const renameRoot = join(fixture, "rename");
  const renameParent = join(renameRoot, "parent");
  const movedParent = join(renameRoot, "moved");
  mkdirSync(renameParent, { mode: 0o700, recursive: true });
  const renamePublisher = open(renameParent);
  const renameSource = stage(renamePublisher, "rename-race");
  renameSync(renameParent, movedParent);
  mkdirSync(renameParent, { mode: 0o700 });
  assert.deepEqual(
    commitProviderRuntimeNativeExactObjectV1(
      renamePublisher,
      renameSource,
      finalName,
    ),
    { status: "not_committed", reason: "parent_path_projection_changed" },
  );
  assert.deepEqual(readdirSync(renameParent), []);
  assert.deepEqual(readdirSync(movedParent), []);

  const exchangeRoot = join(fixture, "exchange");
  const left = join(exchangeRoot, "left");
  const right = join(exchangeRoot, "right");
  mkdirSync(left, { mode: 0o700, recursive: true });
  mkdirSync(right, { mode: 0o700 });
  const leftPublisher = open(left);
  const rightPublisher = open(right);
  const exchangeSource = stage(leftPublisher, "exchange-race");
  const foreignSource = stage(rightPublisher, "source-swap");
  exchange(left, right);
  assert.deepEqual(
    commitProviderRuntimeNativeExactObjectV1(
      leftPublisher,
      exchangeSource,
      finalName,
    ),
    { status: "not_committed", reason: "parent_path_projection_changed" },
  );
  assert.throws(
    () =>
      commitProviderRuntimeNativeExactObjectV1(
        leftPublisher,
        foreignSource,
        finalName,
      ),
    (error) =>
      error?.code === "ERR_PROVIDER_RUNTIME_NATIVE_EXACT_OBJECT_UNAVAILABLE",
  );
  assert.throws(
    () => stage(rightPublisher, "post-exchange-stage"),
    (error) =>
      error?.code === "ERR_PROVIDER_RUNTIME_NATIVE_EXACT_OBJECT_UNAVAILABLE",
  );
  assert.deepEqual(readdirSync(left), []);
  assert.deepEqual(readdirSync(right), []);

  const abaRoot = join(fixture, "double-exchange-aba");
  const abaLeft = join(abaRoot, "left");
  const abaRight = join(abaRoot, "right");
  mkdirSync(abaLeft, { mode: 0o700, recursive: true });
  mkdirSync(abaRight, { mode: 0o700 });
  const abaPublisher = open(abaLeft);
  const abaSource = stage(abaPublisher, "double-exchange-aba");
  exchange(abaLeft, abaRight);
  exchange(abaLeft, abaRight);
  assert.deepEqual(
    commitProviderRuntimeNativeExactObjectV1(
      abaPublisher,
      abaSource,
      finalName,
    ),
    { status: "not_committed", reason: "parent_path_projection_changed" },
  );
  assert.deepEqual(readdirSync(abaLeft), []);
  assert.deepEqual(readdirSync(abaRight), []);

  const preLinkAbaRoot = join(fixture, "prelink-double-exchange-aba");
  const preLinkAbaLeft = join(preLinkAbaRoot, "left");
  const preLinkAbaRight = join(preLinkAbaRoot, "right");
  mkdirSync(preLinkAbaLeft, { mode: 0o700, recursive: true });
  mkdirSync(preLinkAbaRight, { mode: 0o700 });
  const preLinkAbaPublisher = open(preLinkAbaLeft);
  const preLinkAbaSource = stage(
    preLinkAbaPublisher,
    "prelink-double-exchange-aba",
  );
  armTestProviderRuntimeNativeExactObjectPreLinkParentAbaV1(
    preLinkAbaPublisher,
    preLinkAbaRight,
  );
  assert.deepEqual(
    commitProviderRuntimeNativeExactObjectV1(
      preLinkAbaPublisher,
      preLinkAbaSource,
      finalName,
    ),
    { status: "not_committed", reason: "parent_path_projection_changed" },
  );
  assert.deepEqual(readdirSync(preLinkAbaLeft), []);
  assert.deepEqual(readdirSync(preLinkAbaRight), []);

  process.stdout.write(
    `${JSON.stringify({
      profile: "provider_runtime_native_exact_object_ext4_v1",
      status: "verified",
      noReplace: "verified",
      parentRename: "rejected_zero_write",
      parentExchange: "rejected_zero_write",
      pathnameAba: "rejected_zero_write",
      preLinkPathnameAba: "rejected_zero_write",
      sourceSwap: "rejected_zero_write",
      postLinkFsyncRecovery: "verified",
      postLinkProjectionRollback: "verified",
      singleOutstandingSource: "verified",
      invalidFinalNameSourceRelease: "verified",
    })}\n`,
  );
} finally {
  for (const source of sources) {
    try {
      closeProviderRuntimeNativeExactObjectSourceV1(source);
    } catch {
      // Commit and rejection consume the retained source.
    }
  }
  for (const publisher of publishers) {
    try {
      closeProviderRuntimeNativeExactObjectPublisherV1(publisher);
    } catch {
      // Continue releasing independent native authorities.
    }
  }
  rmSync(fixture, { force: true, recursive: true });
}
