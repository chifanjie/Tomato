const SAFE_GIT_VERSION_STDOUT_LIMIT_V1 = 128;
const SAFE_GIT_VERSION_PREFIX_V1 = "git version ";
const SAFE_GIT_VERSION_SUFFIX_V1 =
  /^[A-Za-z0-9][A-Za-z0-9 ._()+-]{0,63}$/u;
const SAFE_GIT_VERSION_DECIMAL_V1 = /^(?:0|[1-9][0-9]*)$/u;

export interface NativeSafeGitVersionV1 {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly vendorSuffix?: string;
}

export class NativeSafeGitVersionStdoutErrorV1 extends Error {
  readonly code = "ERR_NATIVE_KERNEL_BRIDGE_SAFE_GIT_VERSION_INVALID" as const;

  constructor() {
    super("native SafeGit version output is invalid");
    this.name = "NativeSafeGitVersionStdoutErrorV1";
  }
}

function invalidSafeGitVersionStdoutV1(): never {
  throw new NativeSafeGitVersionStdoutErrorV1();
}

function parseCanonicalSafeIntegerV1(value: string): number {
  if (!SAFE_GIT_VERSION_DECIMAL_V1.test(value)) {
    return invalidSafeGitVersionStdoutV1();
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    return invalidSafeGitVersionStdoutV1();
  }
  return parsed;
}

/**
 * Parses the already-capped stdout of the handle-bound `git --version` probe.
 * This module is intentionally absent from the package's public entry point.
 */
export function parseNativeSafeGitVersionStdoutV1(
  stdout: Uint8Array,
): NativeSafeGitVersionV1 {
  if (
    !(stdout instanceof Uint8Array) ||
    stdout.byteLength === 0 ||
    stdout.byteLength > SAFE_GIT_VERSION_STDOUT_LIMIT_V1
  ) {
    return invalidSafeGitVersionStdoutV1();
  }

  for (const byte of stdout) {
    if (byte > 0x7f || byte === 0x00 || byte === 0x0d) {
      return invalidSafeGitVersionStdoutV1();
    }
  }

  const text = String.fromCharCode(...stdout);
  if (!text.endsWith("\n") || text.indexOf("\n") !== text.length - 1) {
    return invalidSafeGitVersionStdoutV1();
  }

  const line = text.slice(0, -1);
  if (!line.startsWith(SAFE_GIT_VERSION_PREFIX_V1)) {
    return invalidSafeGitVersionStdoutV1();
  }

  const version = line.slice(SAFE_GIT_VERSION_PREFIX_V1.length);
  const match = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(.*)$/u.exec(
    version,
  );
  if (match === null) {
    return invalidSafeGitVersionStdoutV1();
  }

  const major = parseCanonicalSafeIntegerV1(match[1]!);
  const minor = parseCanonicalSafeIntegerV1(match[2]!);
  const patch = parseCanonicalSafeIntegerV1(match[3]!);
  const remainder = match[4]!;

  let vendorSuffix: string | undefined;
  if (remainder !== "") {
    if (remainder.startsWith(" (") && remainder.endsWith(")")) {
      vendorSuffix = remainder.slice(2, -1);
    } else if (remainder.startsWith(".")) {
      vendorSuffix = remainder.slice(1);
    } else {
      return invalidSafeGitVersionStdoutV1();
    }
    if (!SAFE_GIT_VERSION_SUFFIX_V1.test(vendorSuffix)) {
      return invalidSafeGitVersionStdoutV1();
    }
  }

  return Object.freeze({
    major,
    minor,
    patch,
    ...(vendorSuffix === undefined ? {} : { vendorSuffix }),
  });
}
