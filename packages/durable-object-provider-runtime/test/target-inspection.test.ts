import { chmod, mkdir, mkdtemp, rename, rm, symlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import {
  assertProviderRuntimeTargetContinuityV1,
  probeProviderRuntimeTargetV1,
} from "../src/target-inspection.js";

const temporaryRoots = new Set<string>();

afterEach(async () => {
  await Promise.all(
    [...temporaryRoots].map((path) => rm(path, { recursive: true, force: true })),
  );
  temporaryRoots.clear();
});

async function privateRootV1(prefix: string): Promise<string> {
  const parent = await mkdtemp(join(tmpdir(), `${prefix}-`));
  temporaryRoots.add(parent);
  const root = join(parent, "provider");
  await mkdir(root, { mode: 0o700 });
  return root;
}

describe("provider runtime target inspection", () => {
  it("returns a stable redacted projection and verifies unchanged continuity", async () => {
    const root = await privateRootV1("provider-target");
    const first = await probeProviderRuntimeTargetV1(root);
    const second = await probeProviderRuntimeTargetV1(root);

    // macOS may expose /var through the canonical /private/var spelling.
    expect(first.canonicalRootPath).toMatch(/\/provider$/u);
    expect(first.publicProjection).toMatchObject({
      platform: process.platform,
      architecture: process.arch,
      isolation: "same_uid_private_directory",
      rootMode: "owner_only_0700",
    });
    expect(first.publicProjection.filesystemTypeCode).toMatch(/^statfs:0x/u);
    expect(first.targetFingerprintDigest).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(second.targetFingerprintDigest).toBe(first.targetFingerprintDigest);
    expect(second.continuity).toEqual(first.continuity);
    expect(await assertProviderRuntimeTargetContinuityV1(first)).toMatchObject({
      targetFingerprintDigest: first.targetFingerprintDigest,
      continuity: first.continuity,
    });
    // The private evidence is available to the caller for continuity checks,
    // while the public projection contains no path/dev/ino/uid fields.
    expect(Object.keys(first.publicProjection).sort()).toEqual([
      "architecture",
      "filesystemTypeCode",
      "isolation",
      "platform",
      "rootMode",
    ]);
    expect(JSON.stringify(first.publicProjection)).not.toContain(root);
  });

  it("fails closed for a symlink root and a replaced continuity target", async () => {
    const parent = await mkdtemp(join(tmpdir(), "provider-target-failure-"));
    temporaryRoots.add(parent);
    const root = join(parent, "provider");
    const link = join(parent, "provider-link");
    await mkdir(root, { mode: 0o700 });
    await symlink(root, link, "dir");

    await expect(probeProviderRuntimeTargetV1(link)).rejects.toMatchObject({
      name: "ProviderRuntimeTargetInspectionErrorV1",
      code: "root_symlink",
    });

    const baseline = await probeProviderRuntimeTargetV1(root);
    const moved = join(parent, "provider-old");
    await rename(root, moved);
    await mkdir(root, { mode: 0o700 });
    await expect(assertProviderRuntimeTargetContinuityV1(baseline)).rejects.toMatchObject({
      name: "ProviderRuntimeTargetInspectionErrorV1",
      code: "target_continuity_changed",
    });
  });

  it("rejects a non-private root mode", async () => {
    const root = await privateRootV1("provider-target-mode");
    // Keep this test intentionally small; mode hardening is part of the
    // private-directory candidate and does not imply principal isolation.
    await chmod(root, 0o755);
    await expect(probeProviderRuntimeTargetV1(root)).rejects.toMatchObject({
      code: "root_mode_invalid",
    });
  });
});
