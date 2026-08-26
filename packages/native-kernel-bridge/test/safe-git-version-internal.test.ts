import { describe, expect, it } from "vitest";

import {
  NativeSafeGitVersionStdoutErrorV1,
  parseNativeSafeGitVersionStdoutV1,
} from "../src/safe-git-version-internal.js";

const bytes = (value: string): Uint8Array => Buffer.from(value, "utf8");

describe("internal native SafeGit version parser", () => {
  it.each([
    ["git version 2.50.1\n", { major: 2, minor: 50, patch: 1 }],
    [
      "git version 2.50.1 (Apple Git-155)\n",
      { major: 2, minor: 50, patch: 1, vendorSuffix: "Apple Git-155" },
    ],
    [
      "git version 2.45.2.windows.1\n",
      { major: 2, minor: 45, patch: 2, vendorSuffix: "windows.1" },
    ],
  ])("parses %j into the exact DTO", (stdout, expected) => {
    expect(parseNativeSafeGitVersionStdoutV1(bytes(stdout))).toStrictEqual(
      expected,
    );
  });

  it.each([
    "git version 2.50.1\r\n",
    "git version 2.50.1\0\n",
    "git version 2.50.1\nextra\n",
    "git version 2.50.1",
    "git version 02.50.1\n",
    "git version 2.050.1\n",
    "git version 2.50.01\n",
    "git version 9007199254740992.1.1\n",
    "git version 2.9007199254740992.1\n",
    "git version 2.1.9007199254740992\n",
    "git version 2.50.1 ()\n",
    "git version 2.50.1.bad/suffix\n",
    `git version 2.50.1.${"a".repeat(65)}\n`,
    `${"x".repeat(128)}\n`,
  ])("rejects invalid stdout %j with the stable redacted error", (stdout) => {
    expect(() => parseNativeSafeGitVersionStdoutV1(bytes(stdout))).toThrow(
      expect.objectContaining({
        name: "NativeSafeGitVersionStdoutErrorV1",
        code: "ERR_NATIVE_KERNEL_BRIDGE_SAFE_GIT_VERSION_INVALID",
        message: "native SafeGit version output is invalid",
      }),
    );
  });

  it("uses the exact internal error type", () => {
    expect(() => parseNativeSafeGitVersionStdoutV1(bytes("git version\n"))).toThrow(
      NativeSafeGitVersionStdoutErrorV1,
    );
  });
});
