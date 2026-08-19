import { randomBytes } from "node:crypto";
import { constants, watch } from "node:fs";
import {
  link,
  lstat,
  open,
  readdir,
  unlink,
  type FileHandle,
} from "node:fs/promises";
import { dirname, join } from "node:path";

import {
  hmacTokenForDomainInternalV1,
  verifyHmacTokenForDomainInternalV1,
} from "./crypto-internal.js";
import { ProviderAcceptanceAuthorityErrorV1 } from "./errors.js";
import {
  canonicalAuthorityBytesInternalV1,
  isMissingFileInternalV1,
  parseCanonicalAuthorityBytesInternalV1,
  readCheckedAuthorityFileInternalV1,
  removeCheckedAuthorityFileInternalV1,
  syncParentDirectoryInternalV1,
  type ProviderAcceptanceAuthorityDurabilityHooksInternalV1,
  type ProviderAcceptanceAuthorityDurablePhaseInternalV1,
} from "./filesystem-internal.js";
import type { ProviderAcceptanceAuthorityLayoutInternalV1 } from "./platform-layout.js";

const LOCK_PROFILE_V1 =
  "understand_code_provider_acceptance_authority_lock_v1";
const LOCK_TOKEN_DOMAIN_V1 =
  "understand-code-provider-acceptance-authority-lock-v1";
const RECOVERY_PROFILE_V1 =
  "understand_code_provider_acceptance_authority_lock_recovery_v1";
const RECOVERY_TOKEN_DOMAIN_V1 =
  "understand-code-provider-acceptance-authority-lock-recovery-v1";
const MAX_LOCK_BYTES_V1 = 16 * 1024;
const NOFOLLOW_V1 = typeof constants.O_NOFOLLOW === "number"
  ? constants.O_NOFOLLOW
  : 0;
const CLOEXEC_V1 = 0;
const LOCK_WAIT_MILLISECONDS_V1 = 30_000;
const LOCK_PREPARATION_PREFIX_V1 =
  ".provider-acceptance-authority-v1.lock.prepare-";
const RECOVERY_PREPARATION_PREFIX_V1 =
  ".provider-acceptance-authority-v1.lock.recovery.prepare-";

class ProviderAcceptanceAuthorityContendedInternalV1 extends Error {
  constructor() {
    super("provider Acceptance authority lock contended");
    this.name = "ProviderAcceptanceAuthorityContendedInternalV1";
  }
}

interface LockEnvelopeInternalV1 {
  readonly schemaVersion: 1;
  readonly profile: typeof LOCK_PROFILE_V1;
  readonly pid: number;
  readonly nonce: string;
  readonly preparationName: string;
  readonly lockToken: string;
}

interface ObservedLockInternalV1 {
  readonly envelope: LockEnvelopeInternalV1;
  readonly dev: number;
  readonly ino: number;
  readonly nlink: number;
}

interface HeldLockInternalV1 {
  readonly nonce: string;
  readonly dev: number;
  readonly ino: number;
}

const FAILED_RELEASES_V1 = new Map<string, HeldLockInternalV1>();
const PROCESS_LOCAL_TURNS_V1 = new Map<string, Promise<void>>();

async function enterProcessLocalTurnV1(path: string): Promise<() => void> {
  const previous = PROCESS_LOCAL_TURNS_V1.get(path) ?? Promise.resolve();
  let finishCurrent!: () => void;
  const current = new Promise<void>((resolvePromise) => {
    finishCurrent = resolvePromise;
  });
  PROCESS_LOCAL_TURNS_V1.set(path, current);
  await previous;
  let finished = false;
  return () => {
    if (finished) return;
    finished = true;
    finishCurrent();
    if (PROCESS_LOCAL_TURNS_V1.get(path) === current) {
      PROCESS_LOCAL_TURNS_V1.delete(path);
    }
  };
}

function sameHeldLockV1(
  left: HeldLockInternalV1,
  right: HeldLockInternalV1,
): boolean {
  return left.nonce === right.nonce && left.dev === right.dev &&
    left.ino === right.ino;
}

async function sweepDeadPreparationOrphansV1(
  layout: ProviderAcceptanceAuthorityLayoutInternalV1,
): Promise<void> {
  let names: string[];
  try {
    names = await readdir(dirname(layout.transactionLockPath));
  } catch {
    throw new ProviderAcceptanceAuthorityErrorV1("io_error");
  }
  for (const name of names) {
    let match: RegExpExecArray | null;
    if (name.startsWith(LOCK_PREPARATION_PREFIX_V1)) {
      match = /^\.provider-acceptance-authority-v1\.lock\.prepare-([1-9][0-9]*)-[0-9a-f]{32}$/u.exec(
        name,
      );
    } else if (name.startsWith(RECOVERY_PREPARATION_PREFIX_V1)) {
      match = /^\.provider-acceptance-authority-v1\.lock\.recovery\.prepare-([1-9][0-9]*)-[0-9a-f]{32}$/u.exec(
        name,
      );
    } else {
      continue;
    }
    if (match === null) {
      throw new ProviderAcceptanceAuthorityErrorV1("authority_busy");
    }
    const ownerPid = Number(match[1]);
    if (
      !Number.isSafeInteger(ownerPid) ||
      ownerPid < 1 ||
      ownerPid > 0x7fffffff ||
      !processDefinitelyExitedV1(ownerPid)
    ) continue;
    const path = join(dirname(layout.transactionLockPath), name);
    let checked;
    try {
      checked = await readCheckedAuthorityFileInternalV1({
        path,
        layout,
        maximumBytes: MAX_LOCK_BYTES_V1,
        allowedLinkCounts: [1],
      });
    } catch (error) {
      if (isMissingFileInternalV1(error)) continue;
      throw new ProviderAcceptanceAuthorityErrorV1("authority_busy");
    }
    await removeCheckedAuthorityFileInternalV1({
      path,
      layout,
      expectedDev: checked.dev,
      expectedIno: checked.ino,
    });
  }
}

interface RecoveryEnvelopeInternalV1 {
  readonly schemaVersion: 1;
  readonly profile: typeof RECOVERY_PROFILE_V1;
  readonly breakerPid: number;
  readonly breakerNonce: string;
  readonly observedLockPid: number;
  readonly observedLockNonce: string;
  readonly observedLockDev: number;
  readonly observedLockIno: number;
  readonly preparationName: string;
  readonly recoveryToken: string;
}

interface ObservedRecoveryInternalV1 {
  readonly envelope: RecoveryEnvelopeInternalV1;
  readonly dev: number;
  readonly ino: number;
  readonly nlink: number;
}

async function afterLockDurablePhaseV1(
  hooks: ProviderAcceptanceAuthorityDurabilityHooksInternalV1 | undefined,
  phase: ProviderAcceptanceAuthorityDurablePhaseInternalV1,
): Promise<void> {
  try {
    await hooks?.afterDurablePhase?.(phase);
  } catch (error) {
    if (error instanceof ProviderAcceptanceAuthorityErrorV1) throw error;
    throw new ProviderAcceptanceAuthorityErrorV1("io_error");
  }
}

function exactRecordV1(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) return false;
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function lockFieldsV1(value: Omit<LockEnvelopeInternalV1, "lockToken">): object {
  return Object.freeze({
    schemaVersion: value.schemaVersion,
    profile: value.profile,
    pid: value.pid,
    nonce: value.nonce,
    preparationName: value.preparationName,
  });
}

function makeLockV1(
  key: Uint8Array,
  nonce: string,
  preparationName: string,
): LockEnvelopeInternalV1 {
  const fields = Object.freeze({
    schemaVersion: 1 as const,
    profile: LOCK_PROFILE_V1,
    pid: process.pid,
    nonce,
    preparationName,
  });
  return Object.freeze({
    ...fields,
    lockToken: hmacTokenForDomainInternalV1(
      key,
      LOCK_TOKEN_DOMAIN_V1,
      fields,
    ),
  });
}

function parseLockV1(value: unknown, key: Uint8Array): LockEnvelopeInternalV1 {
  if (
    !exactRecordV1(value, [
      "schemaVersion",
      "profile",
      "pid",
      "nonce",
      "preparationName",
      "lockToken",
    ]) ||
    value.schemaVersion !== 1 ||
    value.profile !== LOCK_PROFILE_V1 ||
    !Number.isSafeInteger(value.pid) ||
    (value.pid as number) < 1 ||
    (value.pid as number) > 0x7fffffff ||
    typeof value.nonce !== "string" ||
    !/^[0-9a-f]{32}$/u.test(value.nonce) ||
    typeof value.preparationName !== "string" ||
    !/^\.provider-acceptance-authority-v1\.lock\.prepare-[1-9][0-9]*-[0-9a-f]{32}$/u.test(
      value.preparationName,
    )
  ) {
    throw new ProviderAcceptanceAuthorityErrorV1("authority_busy");
  }
  const fields = Object.freeze({
    schemaVersion: 1 as const,
    profile: LOCK_PROFILE_V1,
    pid: value.pid as number,
    nonce: value.nonce,
    preparationName: value.preparationName,
  });
  if (
    !verifyHmacTokenForDomainInternalV1(
      key,
      LOCK_TOKEN_DOMAIN_V1,
      fields,
      value.lockToken,
    )
  ) {
    throw new ProviderAcceptanceAuthorityErrorV1("authority_busy");
  }
  return Object.freeze({ ...fields, lockToken: value.lockToken as string });
}

function processDefinitelyExitedV1(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    return typeof error === "object" && error !== null && "code" in error &&
      (error as { readonly code?: unknown }).code === "ESRCH";
  }
}

async function observeLockV1(
  layout: ProviderAcceptanceAuthorityLayoutInternalV1,
  key: Uint8Array,
  path: string,
  allowedLinkCounts: readonly number[] = [1],
): Promise<ObservedLockInternalV1 | undefined> {
  try {
    const checked = await readCheckedAuthorityFileInternalV1({
      path,
      layout,
      maximumBytes: MAX_LOCK_BYTES_V1,
      allowedLinkCounts,
    });
    return Object.freeze({
      envelope: parseLockV1(
        parseCanonicalAuthorityBytesInternalV1(checked.bytes),
        key,
      ),
      dev: checked.dev,
      ino: checked.ino,
      nlink: checked.nlink,
    });
  } catch (error) {
    if (isMissingFileInternalV1(error)) return undefined;
    throw new ProviderAcceptanceAuthorityErrorV1("authority_busy", {
      cause: error,
    });
  }
}

function sameLockV1(left: ObservedLockInternalV1, right: ObservedLockInternalV1): boolean {
  return left.dev === right.dev && left.ino === right.ino &&
    left.envelope.nonce === right.envelope.nonce &&
    left.envelope.lockToken === right.envelope.lockToken;
}

async function recoverLockPublishStageV1(
  layout: ProviderAcceptanceAuthorityLayoutInternalV1,
  key: Uint8Array,
  _hooks?: ProviderAcceptanceAuthorityDurabilityHooksInternalV1,
): Promise<void> {
  const staged = await observeLockV1(
    layout,
    key,
    layout.transactionLockStagePath,
    [1, 2],
  );
  if (staged === undefined) return;
  const canonical = await observeLockV1(
    layout,
    key,
    layout.transactionLockPath,
    [1, 2],
  );
  if (!processDefinitelyExitedV1(staged.envelope.pid)) {
    throw new ProviderAcceptanceAuthorityContendedInternalV1();
  }
  if (
    staged.nlink === 2 &&
    (canonical === undefined || !sameLockV1(staged, canonical))
  ) {
    const preparationPath = join(
      dirname(layout.transactionLockPath),
      staged.envelope.preparationName,
    );
    const preparation = await observeLockV1(
      layout,
      key,
      preparationPath,
      [2],
    );
    if (preparation === undefined || !sameLockV1(staged, preparation)) {
      throw new ProviderAcceptanceAuthorityErrorV1("authority_busy");
    }
    await removeCheckedAuthorityFileInternalV1({
      path: preparationPath,
      layout,
      expectedDev: preparation.dev,
      expectedIno: preparation.ino,
      allowedLinkCounts: [2],
    });
  }
  const latest = await observeLockV1(
    layout,
    key,
    layout.transactionLockStagePath,
    [1, 2],
  );
  if (latest === undefined || !sameLockV1(latest, staged)) {
    throw new ProviderAcceptanceAuthorityErrorV1("authority_busy");
  }
  await removeCheckedAuthorityFileInternalV1({
    path: layout.transactionLockStagePath,
    layout,
    expectedDev: latest.dev,
    expectedIno: latest.ino,
    allowedLinkCounts: [1, 2],
  });
}

function recoveryFieldsV1(input: Readonly<{
  breakerPid: number;
  breakerNonce: string;
  observed: ObservedLockInternalV1;
  preparationName: string;
}>): object {
  return Object.freeze({
    schemaVersion: 1,
    profile: RECOVERY_PROFILE_V1,
    breakerPid: input.breakerPid,
    breakerNonce: input.breakerNonce,
    observedLockPid: input.observed.envelope.pid,
    observedLockNonce: input.observed.envelope.nonce,
    observedLockDev: input.observed.dev,
    observedLockIno: input.observed.ino,
    preparationName: input.preparationName,
  });
}

function parseRecoveryV1(
  value: unknown,
  key: Uint8Array,
): RecoveryEnvelopeInternalV1 {
  if (
    !exactRecordV1(value, [
      "schemaVersion",
      "profile",
      "breakerPid",
      "breakerNonce",
      "observedLockPid",
      "observedLockNonce",
      "observedLockDev",
      "observedLockIno",
      "preparationName",
      "recoveryToken",
    ]) ||
    value.schemaVersion !== 1 ||
    value.profile !== RECOVERY_PROFILE_V1 ||
    !Number.isSafeInteger(value.breakerPid) ||
    (value.breakerPid as number) < 1 ||
    (value.breakerPid as number) > 0x7fffffff ||
    typeof value.breakerNonce !== "string" ||
    !/^[0-9a-f]{32}$/u.test(value.breakerNonce) ||
    !Number.isSafeInteger(value.observedLockPid) ||
    (value.observedLockPid as number) < 1 ||
    (value.observedLockPid as number) > 0x7fffffff ||
    typeof value.observedLockNonce !== "string" ||
    !/^[0-9a-f]{32}$/u.test(value.observedLockNonce) ||
    !Number.isSafeInteger(value.observedLockDev) ||
    (value.observedLockDev as number) < 0 ||
    !Number.isSafeInteger(value.observedLockIno) ||
    (value.observedLockIno as number) < 1 ||
    typeof value.preparationName !== "string" ||
    !/^\.provider-acceptance-authority-v1\.lock\.recovery\.prepare-[1-9][0-9]*-[0-9a-f]{32}$/u.test(
      value.preparationName,
    )
  ) throw new ProviderAcceptanceAuthorityErrorV1("authority_busy");
  const fields = Object.freeze({
    schemaVersion: 1 as const,
    profile: RECOVERY_PROFILE_V1,
    breakerPid: value.breakerPid as number,
    breakerNonce: value.breakerNonce,
    observedLockPid: value.observedLockPid as number,
    observedLockNonce: value.observedLockNonce,
    observedLockDev: value.observedLockDev as number,
    observedLockIno: value.observedLockIno as number,
    preparationName: value.preparationName,
  });
  if (
    !verifyHmacTokenForDomainInternalV1(
      key,
      RECOVERY_TOKEN_DOMAIN_V1,
      fields,
      value.recoveryToken,
    )
  ) throw new ProviderAcceptanceAuthorityErrorV1("authority_busy");
  return Object.freeze({
    ...fields,
    recoveryToken: value.recoveryToken as string,
  });
}

async function observeRecoveryAtV1(
  layout: ProviderAcceptanceAuthorityLayoutInternalV1,
  key: Uint8Array,
  path: string,
  allowedLinkCounts: readonly number[] = [1, 2],
): Promise<ObservedRecoveryInternalV1 | undefined> {
  try {
    const checked = await readCheckedAuthorityFileInternalV1({
      path,
      layout,
      maximumBytes: MAX_LOCK_BYTES_V1,
      allowedLinkCounts,
    });
    return Object.freeze({
      envelope: parseRecoveryV1(
        parseCanonicalAuthorityBytesInternalV1(checked.bytes),
        key,
      ),
      dev: checked.dev,
      ino: checked.ino,
      nlink: checked.nlink,
    });
  } catch (error) {
    if (isMissingFileInternalV1(error)) return undefined;
    throw new ProviderAcceptanceAuthorityErrorV1("authority_busy");
  }
}

function observeRecoveryV1(
  layout: ProviderAcceptanceAuthorityLayoutInternalV1,
  key: Uint8Array,
): Promise<ObservedRecoveryInternalV1 | undefined> {
  return observeRecoveryAtV1(
    layout,
    key,
    layout.transactionLockRecoveryClaimPath,
  );
}

function recoveryMatchesLockV1(
  claim: ObservedRecoveryInternalV1,
  lock: ObservedLockInternalV1,
): boolean {
  return claim.envelope.observedLockPid === lock.envelope.pid &&
    claim.envelope.observedLockNonce === lock.envelope.nonce &&
    claim.envelope.observedLockDev === lock.dev &&
    claim.envelope.observedLockIno === lock.ino;
}

async function retireRecoveryClaimV1(
  layout: ProviderAcceptanceAuthorityLayoutInternalV1,
  key: Uint8Array,
  expected: ObservedRecoveryInternalV1,
): Promise<boolean> {
  const latest = await observeRecoveryV1(layout, key);
  if (
    latest === undefined ||
    latest.dev !== expected.dev ||
    latest.ino !== expected.ino ||
    latest.envelope.breakerNonce !== expected.envelope.breakerNonce
  ) return false;
  await removeCheckedAuthorityFileInternalV1({
    path: layout.transactionLockRecoveryClaimPath,
    layout,
    expectedDev: latest.dev,
    expectedIno: latest.ino,
  });
  return true;
}

async function resumeRecoveryClaimV1(
  layout: ProviderAcceptanceAuthorityLayoutInternalV1,
  key: Uint8Array,
  claim: ObservedRecoveryInternalV1,
  allowCurrentBreaker: boolean,
  hooks?: ProviderAcceptanceAuthorityDurabilityHooksInternalV1,
): Promise<boolean> {
  if (
    !processDefinitelyExitedV1(claim.envelope.observedLockPid) ||
    (!allowCurrentBreaker &&
      !processDefinitelyExitedV1(claim.envelope.breakerPid))
  ) return false;
  if (
    allowCurrentBreaker &&
    claim.envelope.breakerPid !== process.pid
  ) return false;

  let canonical = await observeLockV1(
    layout,
    key,
    layout.transactionLockPath,
    [1, 2],
  );
  let quarantine = await observeLockV1(
    layout,
    key,
    layout.transactionLockQuarantinePath,
    [1, 2],
  );
  if (quarantine !== undefined && !recoveryMatchesLockV1(claim, quarantine)) {
    return false;
  }
  if (quarantine === undefined && canonical !== undefined) {
    if (!recoveryMatchesLockV1(claim, canonical)) {
      // The pinned target disappeared before the claim became observable and
      // a different lock won. Never touch that different inode.
      return retireRecoveryClaimV1(layout, key, claim);
    }
    try {
      await link(
        layout.transactionLockPath,
        layout.transactionLockQuarantinePath,
      );
      await syncParentDirectoryInternalV1(layout.transactionLockPath);
      await afterLockDurablePhaseV1(
        hooks,
        "recovery_quarantine_linked_before_canonical_unlink",
      );
    } catch (error) {
      if (
        typeof error !== "object" || error === null || !("code" in error) ||
        (error as { readonly code?: unknown }).code !== "EEXIST"
      ) {
        if (error instanceof ProviderAcceptanceAuthorityErrorV1) throw error;
        throw new ProviderAcceptanceAuthorityErrorV1("authority_busy");
      }
    }
    quarantine = await observeLockV1(
      layout,
      key,
      layout.transactionLockQuarantinePath,
      [2],
    );
    canonical = await observeLockV1(
      layout,
      key,
      layout.transactionLockPath,
      [2],
    );
    if (
      quarantine === undefined ||
      canonical === undefined ||
      !recoveryMatchesLockV1(claim, quarantine) ||
      !recoveryMatchesLockV1(claim, canonical)
    ) return false;
  }
  if (quarantine !== undefined) {
    canonical = await observeLockV1(
      layout,
      key,
      layout.transactionLockPath,
      [1, 2],
    );
    if (canonical !== undefined && recoveryMatchesLockV1(claim, canonical)) {
      if (canonical.nlink !== 2 || quarantine.nlink !== 2) return false;
      await removeCheckedAuthorityFileInternalV1({
        path: layout.transactionLockPath,
        layout,
        expectedDev: canonical.dev,
        expectedIno: canonical.ino,
        allowedLinkCounts: [2],
      });
      await afterLockDurablePhaseV1(
        hooks,
        "recovery_canonical_unlinked_before_quarantine_unlink",
      );
    } else if (canonical !== undefined) {
      // A different, newer canonical lock is left untouched.
    }
    const remaining = await observeLockV1(
      layout,
      key,
      layout.transactionLockQuarantinePath,
      [1],
    );
    if (remaining === undefined || !recoveryMatchesLockV1(claim, remaining)) {
      return false;
    }
    await removeCheckedAuthorityFileInternalV1({
      path: layout.transactionLockQuarantinePath,
      layout,
      expectedDev: remaining.dev,
      expectedIno: remaining.ino,
    });
    await afterLockDurablePhaseV1(
      hooks,
      "recovery_quarantine_unlinked_before_claim_retire",
    );
  } else if (canonical !== undefined && recoveryMatchesLockV1(claim, canonical)) {
    return false;
  }
  return retireRecoveryClaimV1(layout, key, claim);
}

async function normalizeRecoveryPreparationV1(
  layout: ProviderAcceptanceAuthorityLayoutInternalV1,
  key: Uint8Array,
  claim: ObservedRecoveryInternalV1,
): Promise<ObservedRecoveryInternalV1> {
  if (claim.nlink === 1) return claim;
  const preparationPath = join(
    dirname(layout.transactionLockRecoveryClaimPath),
    claim.envelope.preparationName,
  );
  const preparation = await observeRecoveryAtV1(
    layout,
    key,
    preparationPath,
    [2],
  );
  if (
    preparation === undefined ||
    preparation.dev !== claim.dev ||
    preparation.ino !== claim.ino ||
    preparation.envelope.breakerNonce !== claim.envelope.breakerNonce ||
    preparation.envelope.recoveryToken !== claim.envelope.recoveryToken
  ) throw new ProviderAcceptanceAuthorityErrorV1("authority_busy");
  if (!processDefinitelyExitedV1(claim.envelope.breakerPid)) {
    throw new ProviderAcceptanceAuthorityContendedInternalV1();
  }
  await removeCheckedAuthorityFileInternalV1({
    path: preparationPath,
    layout,
    expectedDev: preparation.dev,
    expectedIno: preparation.ino,
    allowedLinkCounts: [2],
  });
  const normalized = await observeRecoveryV1(layout, key);
  if (
    normalized === undefined ||
    normalized.nlink !== 1 ||
    normalized.dev !== claim.dev ||
    normalized.ino !== claim.ino ||
    normalized.envelope.breakerNonce !== claim.envelope.breakerNonce
  ) throw new ProviderAcceptanceAuthorityErrorV1("authority_busy");
  return normalized;
}

async function recoverExistingClaimV1(
  layout: ProviderAcceptanceAuthorityLayoutInternalV1,
  key: Uint8Array,
  hooks?: ProviderAcceptanceAuthorityDurabilityHooksInternalV1,
): Promise<"absent" | "recovered" | "contended" | "busy"> {
  const observedClaim = await observeRecoveryV1(layout, key);
  if (observedClaim === undefined) {
    const quarantineExists = await lstat(layout.transactionLockQuarantinePath)
      .then(() => true)
      .catch((error) => !isMissingFileInternalV1(error));
    return quarantineExists ? "busy" : "absent";
  }
  let claim: ObservedRecoveryInternalV1;
  try {
    claim = await normalizeRecoveryPreparationV1(
      layout,
      key,
      observedClaim,
    );
  } catch (error) {
    if (error instanceof ProviderAcceptanceAuthorityContendedInternalV1) {
      return "contended";
    }
    throw error;
  }
  if (!processDefinitelyExitedV1(claim.envelope.breakerPid)) {
    return "contended";
  }
  return await resumeRecoveryClaimV1(layout, key, claim, false, hooks)
    ? "recovered"
    : "busy";
}

async function reclaimStaleLockV1(
  layout: ProviderAcceptanceAuthorityLayoutInternalV1,
  key: Uint8Array,
  observed: ObservedLockInternalV1,
  hooks?: ProviderAcceptanceAuthorityDurabilityHooksInternalV1,
): Promise<boolean> {
  if (!processDefinitelyExitedV1(observed.envelope.pid)) return false;
  const breakerNonce = randomBytes(16).toString("hex");
  const preparationName =
    `${RECOVERY_PREPARATION_PREFIX_V1}${process.pid}-${breakerNonce}`;
  const preparationPath = join(
    dirname(layout.transactionLockRecoveryClaimPath),
    preparationName,
  );
  const recoveryFields = recoveryFieldsV1({
    breakerPid: process.pid,
    breakerNonce,
    observed,
    preparationName,
  });
  const recovery = Object.freeze({
    ...recoveryFields,
    recoveryToken: hmacTokenForDomainInternalV1(
      key,
      RECOVERY_TOKEN_DOMAIN_V1,
      recoveryFields,
    ),
  });
  let claimHandle: FileHandle | undefined;
  let preparationExists = false;
  try {
    claimHandle = await open(
      preparationPath,
      constants.O_CREAT |
        constants.O_EXCL |
        constants.O_WRONLY |
        NOFOLLOW_V1 |
        CLOEXEC_V1,
      0o600,
    );
    preparationExists = true;
    await claimHandle.chmod(0o600);
    const bytes = canonicalAuthorityBytesInternalV1(recovery);
    await claimHandle.writeFile(bytes);
    await claimHandle.sync();
    const metadata = await claimHandle.stat();
    if (
      !metadata.isFile() ||
      metadata.uid !== layout.authorityUid ||
      metadata.gid !== layout.authorityGid ||
      (metadata.mode & 0o777) !== 0o600 ||
      metadata.nlink !== 1 ||
      metadata.size !== bytes.byteLength
    ) throw new ProviderAcceptanceAuthorityErrorV1("authority_busy");
    await afterLockDurablePhaseV1(
      hooks,
      "recovery_preparation_file_fsynced",
    );
    await claimHandle.close();
    claimHandle = undefined;
    try {
      await link(preparationPath, layout.transactionLockRecoveryClaimPath);
      await syncParentDirectoryInternalV1(
        layout.transactionLockRecoveryClaimPath,
      );
      await afterLockDurablePhaseV1(
        hooks,
        "recovery_claim_linked_before_preparation_unlink",
      );
    } catch (error) {
      if (
        typeof error === "object" && error !== null && "code" in error &&
        (error as { readonly code?: unknown }).code === "EEXIST"
      ) {
        await unlink(preparationPath);
        preparationExists = false;
        await syncParentDirectoryInternalV1(preparationPath);
        return false;
      }
      throw error;
    }
    await unlink(preparationPath);
    preparationExists = false;
    await syncParentDirectoryInternalV1(
      layout.transactionLockRecoveryClaimPath,
    );
    const claim = await observeRecoveryV1(layout, key);
    if (
      claim === undefined ||
      claim.envelope.breakerPid !== process.pid ||
      claim.envelope.breakerNonce !== breakerNonce ||
      !recoveryMatchesLockV1(claim, observed)
    ) return false;
    return resumeRecoveryClaimV1(layout, key, claim, true, hooks);
  } catch (error) {
    if (error instanceof ProviderAcceptanceAuthorityErrorV1) throw error;
    throw new ProviderAcceptanceAuthorityErrorV1("authority_busy", {
      cause: error,
    });
  } finally {
    await claimHandle?.close().catch(() => undefined);
    if (preparationExists) {
      await unlink(preparationPath).catch(() => undefined);
      await syncParentDirectoryInternalV1(preparationPath).catch(
        () => undefined,
      );
    }
  }
}

async function tryCreateLockV1(
  layout: ProviderAcceptanceAuthorityLayoutInternalV1,
  key: Uint8Array,
  hooks?: ProviderAcceptanceAuthorityDurabilityHooksInternalV1,
): Promise<HeldLockInternalV1 | undefined> {
  const nonce = randomBytes(16).toString("hex");
  const preparationName = `${LOCK_PREPARATION_PREFIX_V1}${process.pid}-${nonce}`;
  const preparationPath = join(
    dirname(layout.transactionLockPath),
    preparationName,
  );
  const envelope = makeLockV1(key, nonce, preparationName);
  const bytes = canonicalAuthorityBytesInternalV1(envelope);
  let handle: FileHandle | undefined;
  let preparationExists = false;
  let stageExists = false;
  try {
    handle = await open(
      preparationPath,
      constants.O_CREAT |
        constants.O_EXCL |
        constants.O_WRONLY |
        NOFOLLOW_V1 |
        CLOEXEC_V1,
      0o600,
    );
    preparationExists = true;
    await handle.chmod(0o600);
    await handle.writeFile(bytes);
    await handle.sync();
    const metadata = await handle.stat();
    if (
      !metadata.isFile() ||
      metadata.uid !== layout.authorityUid ||
      metadata.gid !== layout.authorityGid ||
      (metadata.mode & 0o777) !== 0o600 ||
      metadata.nlink !== 1 ||
      metadata.size !== bytes.byteLength
    ) throw new ProviderAcceptanceAuthorityErrorV1("io_error");
    await afterLockDurablePhaseV1(
      hooks,
      "lock_preparation_file_fsynced",
    );
    await handle.close();
    handle = undefined;
    try {
      await link(preparationPath, layout.transactionLockStagePath);
      stageExists = true;
      await syncParentDirectoryInternalV1(layout.transactionLockStagePath);
      await afterLockDurablePhaseV1(
        hooks,
        "lock_stage_linked_before_preparation_unlink",
      );
    } catch (error) {
      if (
        typeof error === "object" && error !== null && "code" in error &&
        (error as { readonly code?: unknown }).code === "EEXIST"
      ) {
        await unlink(preparationPath);
        preparationExists = false;
        await syncParentDirectoryInternalV1(preparationPath);
        return undefined;
      }
      throw error;
    }
    await unlink(preparationPath);
    preparationExists = false;
    await syncParentDirectoryInternalV1(preparationPath);
    try {
      await link(layout.transactionLockStagePath, layout.transactionLockPath);
      await syncParentDirectoryInternalV1(layout.transactionLockPath);
      await afterLockDurablePhaseV1(
        hooks,
        "lock_canonical_linked_before_stage_unlink",
      );
    } catch (error) {
      if (
        typeof error === "object" && error !== null && "code" in error &&
        (error as { readonly code?: unknown }).code === "EEXIST"
      ) {
        await unlink(layout.transactionLockStagePath);
        stageExists = false;
        await syncParentDirectoryInternalV1(layout.transactionLockStagePath);
        return undefined;
      }
      throw error;
    }
    await unlink(layout.transactionLockStagePath);
    stageExists = false;
    await syncParentDirectoryInternalV1(layout.transactionLockStagePath);
    return Object.freeze({
      nonce: envelope.nonce,
      dev: metadata.dev,
      ino: metadata.ino,
    });
  } catch (error) {
    await handle?.close().catch(() => undefined);
    if (preparationExists) {
      await unlink(preparationPath).catch(() => undefined);
      await syncParentDirectoryInternalV1(preparationPath).catch(
        () => undefined,
      );
    }
    if (stageExists) {
      // Recovery validates the exact authenticated stage and owner PID.
    }
    if (error instanceof ProviderAcceptanceAuthorityErrorV1) throw error;
    throw new ProviderAcceptanceAuthorityErrorV1("io_error", { cause: error });
  }
}

async function acquireLockV1(
  layout: ProviderAcceptanceAuthorityLayoutInternalV1,
  key: Uint8Array,
  hooks?: ProviderAcceptanceAuthorityDurabilityHooksInternalV1,
): Promise<HeldLockInternalV1> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const gate = await recoverExistingClaimV1(layout, key, hooks);
    if (gate === "busy") {
      throw new ProviderAcceptanceAuthorityErrorV1("authority_busy");
    }
    if (gate === "contended") {
      throw new ProviderAcceptanceAuthorityContendedInternalV1();
    }
    if (gate === "recovered") continue;
    await recoverLockPublishStageV1(layout, key, hooks);
    const created = await tryCreateLockV1(layout, key, hooks);
    if (created !== undefined) return created;
    const observed = await observeLockV1(
      layout,
      key,
      layout.transactionLockPath,
      [1, 2],
    );
    if (observed?.nlink === 2) {
      const staged = await observeLockV1(
        layout,
        key,
        layout.transactionLockStagePath,
        [2],
      );
      if (staged === undefined || !sameLockV1(observed, staged)) {
        throw new ProviderAcceptanceAuthorityErrorV1("authority_busy");
      }
    }
    if (observed === undefined || !processDefinitelyExitedV1(observed.envelope.pid)) {
      // Another contender may own the complete deterministic stage but not
      // yet have linked canonical. The watcher/retry path will then inspect
      // that authenticated stage; malformed stages still fail closed there.
      throw new ProviderAcceptanceAuthorityContendedInternalV1();
    }
    if (!(await reclaimStaleLockV1(layout, key, observed, hooks))) {
      throw new ProviderAcceptanceAuthorityErrorV1("authority_busy");
    }
  }
  throw new ProviderAcceptanceAuthorityErrorV1("authority_busy");
}

async function releaseLockV1(
  layout: ProviderAcceptanceAuthorityLayoutInternalV1,
  key: Uint8Array,
  held: HeldLockInternalV1,
): Promise<void> {
  const observed = await observeLockV1(layout, key, layout.transactionLockPath);
  if (
    observed === undefined ||
    observed.dev !== held.dev ||
    observed.ino !== held.ino ||
    observed.envelope.nonce !== held.nonce
  ) {
    throw new ProviderAcceptanceAuthorityErrorV1(
      "namespace_integrity_failed",
    );
  }
  await removeCheckedAuthorityFileInternalV1({
    path: layout.transactionLockPath,
    layout,
    expectedDev: held.dev,
    expectedIno: held.ino,
  });
}

function retainFailedReleaseV1(
  layout: ProviderAcceptanceAuthorityLayoutInternalV1,
  held: HeldLockInternalV1,
): void {
  const retained = FAILED_RELEASES_V1.get(layout.transactionLockPath);
  if (retained !== undefined && !sameHeldLockV1(retained, held)) {
    throw new ProviderAcceptanceAuthorityErrorV1(
      "namespace_integrity_failed",
    );
  }
  FAILED_RELEASES_V1.set(layout.transactionLockPath, held);
}

async function recoverFailedReleaseV1(
  layout: ProviderAcceptanceAuthorityLayoutInternalV1,
  key: Uint8Array,
): Promise<void> {
  const retained = FAILED_RELEASES_V1.get(layout.transactionLockPath);
  if (retained === undefined) return;
  // releaseLockV1 re-observes the authenticated envelope and requires the
  // exact retained nonce/dev/inode. A missing or different canonical object
  // remains fail-closed: unlink may have succeeded before directory fsync.
  await releaseLockV1(layout, key, retained);
  if (FAILED_RELEASES_V1.get(layout.transactionLockPath) === retained) {
    FAILED_RELEASES_V1.delete(layout.transactionLockPath);
  }
}

export async function withProviderAcceptanceAuthorityCrossProcessLockInternalV1<T>(
  layout: ProviderAcceptanceAuthorityLayoutInternalV1,
  key: Uint8Array,
  operation: () => Promise<T>,
  hooks?: ProviderAcceptanceAuthorityDurabilityHooksInternalV1,
): Promise<T> {
  const leaveProcessLocalTurn = await enterProcessLocalTurnV1(
    layout.transactionLockPath,
  );
  try {
    await recoverFailedReleaseV1(layout, key);
    const deadline = Date.now() + LOCK_WAIT_MILLISECONDS_V1;
    let held: HeldLockInternalV1 | undefined;
    while (held === undefined) {
      try {
        held = await acquireLockV1(layout, key, hooks);
      } catch (error) {
        if (!(error instanceof ProviderAcceptanceAuthorityContendedInternalV1)) {
          throw error;
        }
        const remaining = deadline - Date.now();
        if (remaining <= 0) {
          throw new ProviderAcceptanceAuthorityErrorV1("authority_busy");
        }
        await waitForAuthorityLockChangeV1(layout, remaining);
      }
    }
    try {
      await sweepDeadPreparationOrphansV1(layout);
      return await operation();
    } finally {
      try {
        await releaseLockV1(layout, key, held);
      } catch (error) {
        retainFailedReleaseV1(layout, held);
        throw error;
      }
    }
  } finally {
    leaveProcessLocalTurn();
  }
}

function waitForAuthorityLockChangeV1(
  layout: ProviderAcceptanceAuthorityLayoutInternalV1,
  maximumWaitMilliseconds: number,
): Promise<void> {
  return new Promise<void>((resolvePromise, rejectPromise) => {
    let settled = false;
    let watcher: ReturnType<typeof watch> | undefined;
    let timeout: NodeJS.Timeout | undefined;
    const settle = (error?: unknown): void => {
      if (settled) return;
      settled = true;
      if (timeout !== undefined) clearTimeout(timeout);
      watcher?.close();
      if (error === undefined) resolvePromise();
      else rejectPromise(new ProviderAcceptanceAuthorityErrorV1("authority_busy"));
    };
    try {
      watcher = watch(
        dirname(layout.transactionLockPath),
        { persistent: true },
        () => settle(),
      );
      watcher.once("error", (error) => settle(error));
      timeout = setTimeout(
        () => settle(new Error("authority lock wait deadline elapsed")),
        Math.max(1, maximumWaitMilliseconds),
      );
    } catch {
      settle(new ProviderAcceptanceAuthorityErrorV1("authority_busy"));
      return;
    }
    // Close the observe→watch race: if the canonical lock already vanished,
    // retry immediately instead of waiting for an event that already fired.
    void lstat(layout.transactionLockPath)
      .catch((error) => {
        if (isMissingFileInternalV1(error)) settle();
      });
  });
}
