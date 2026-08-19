import {
  createHash,
  createPublicKey,
  randomBytes,
  randomUUID,
  type KeyObject,
} from "node:crypto";
import { constants } from "node:fs";
import {
  chmod,
  chown,
  lstat,
  link,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  rmdir,
  unlink,
  type FileHandle,
} from "node:fs/promises";
import {
  basename,
  dirname,
  isAbsolute,
  relative,
  resolve,
} from "node:path";

import { canonicalizeJcsSafeIntegerV1 } from "@understand-code/durable-object-provider-contracts/jcs";
import {
  CanonicalByteStringV1Schema,
  ContentDigestV1Schema,
  type ContentDigestV1,
} from "@understand-code/durable-object-provider-contracts/primitives";
import {
  mintProviderServiceInstallationIdentityVerificationCapabilityInternalV1,
} from "@understand-code/durable-object-provider-contracts/provider-service-installation-identity-custody-internal";

import {
  mintProviderServiceInstallationPrivilegeInternalV1,
  requireProviderServiceInstallationPrivilegeInternalV1,
  type ProviderServiceInstallationPrivilegeCapabilityInternalV1,
} from "./provider-service-installation-privilege-internal.js";
import {
  assertProviderRuntimeNativeFdHasNoExtendedAccessControlV1,
} from "./native-kernel-peer.js";
import {
  defaultProviderServiceDescriptorPathV1,
  renderProviderServiceDescriptorV1,
  verifyProviderServiceHandoffConfigV1,
  type ProviderServiceHandoffConfigV1,
  type ProviderServicePlatformV1,
  type ProviderServicePrincipalV1,
} from "./service-handoff.js";

export const PROVIDER_SERVICE_INSTALLATION_MANIFEST_FILE_V1 =
  "provider-service-installation-manifest-v1.json" as const;
export const PROVIDER_SERVICE_INSTALLATION_ROLLBACK_FILE_V1 =
  "provider-service-installation-rollback-v1.json" as const;
export const PROVIDER_SERVICE_INSTALLATION_LOCK_FILE_V1 =
  ".provider-service-lifecycle.lock" as const;
export const PROVIDER_SERVICE_INSTALLATION_CONTROL_JOURNAL_FILE_V1 =
  ".provider-service-lifecycle-control-v1.json" as const;
export const PROVIDER_SERVICE_INSTALLATION_MANIFEST_PROFILE_V1 =
  "understand_code_provider_service_installation_manifest_v1" as const;
export const PROVIDER_SERVICE_INSTALLATION_ROLLBACK_PROFILE_V1 =
  "understand_code_provider_service_installation_rollback_v1" as const;
export const PROVIDER_SERVICE_INSTALLATION_LOCK_PROFILE_V1 =
  "understand_code_provider_service_installation_lock_v1" as const;
export const PROVIDER_SERVICE_INSTALLATION_CONTROL_JOURNAL_PROFILE_V1 =
  "understand_code_provider_service_installation_control_journal_v1" as const;

const MANIFEST_DIGEST_DOMAIN_V1 =
  "understand-code-provider-service-installation-manifest-v1";
const ROLLBACK_DIGEST_DOMAIN_V1 =
  "understand-code-provider-service-installation-rollback-v1";
const LOCK_DIGEST_DOMAIN_V1 =
  "understand-code-provider-service-installation-lock-v1";
const LOCK_RECOVERY_CLAIM_DIGEST_DOMAIN_V1 =
  "understand-code-provider-service-installation-lock-recovery-claim-v1";
const CONTROL_JOURNAL_DIGEST_DOMAIN_V1 =
  "understand-code-provider-service-installation-control-journal-v1";
const RUNTIME_ROOT_CREATION_MARKER_DIGEST_DOMAIN_V1 =
  "understand-code-provider-service-runtime-root-creation-marker-v1";
const MAX_PATH_BYTES_V1 = 4_096;
const MAX_MANIFEST_BYTES_V1 = 1024 * 1024;
const MAX_CONFIG_BYTES_V1 = 1024 * 1024;
const MAX_DESCRIPTOR_BYTES_V1 = 1024 * 1024;
const MAX_KEY_BYTES_V1 = 16 * 1024;
const MAX_ROLLBACK_BYTES_V1 = 4 * 1024 * 1024;
const MAX_LOCK_BYTES_V1 = 16 * 1024;
const MAX_CONTROL_JOURNAL_BYTES_V1 = 4 * 1024 * 1024;
const LIFECYCLE_LOCK_RECOVERY_CLAIM_FILE_V1 =
  ".provider-service-lifecycle.lock.recovery" as const;
const LIFECYCLE_LOCK_STALE_QUARANTINE_FILE_V1 =
  ".provider-service-lifecycle.lock.stale" as const;
const LIFECYCLE_LOCK_RECOVERY_RETIRING_FILE_V1 =
  ".provider-service-lifecycle.lock.recovery.retiring" as const;
const RUNTIME_ROOT_CREATION_MARKER_PROFILE_V1 =
  "understand_code_provider_service_runtime_root_creation_marker_v1" as const;

export type ProviderServiceInstallationManagedArtifactKindV1 =
  | "service_config"
  | "service_descriptor"
  | "runtime_auth_key"
  | "runtime_signing_key";

type ManagedArtifactKindV1 = ProviderServiceInstallationManagedArtifactKindV1;

type ManagedArtifactOwnerV1 = "authority" | "service_principal";

interface ManagedArtifactV1 {
  readonly kind: ManagedArtifactKindV1;
  readonly path: string;
  readonly contentDigest: ContentDigestV1;
  readonly byteLength: number;
  readonly mode: number;
  readonly owner: ManagedArtifactOwnerV1;
}

interface PreviousSnapshotPinV1 {
  readonly path: typeof PROVIDER_SERVICE_INSTALLATION_ROLLBACK_FILE_V1;
  readonly contentDigest: ContentDigestV1;
  readonly fromManifestGeneration: number;
  readonly fromHandoffPayloadDigest: ContentDigestV1;
}

interface ProviderServiceInstallationManifestPayloadV1 {
  readonly schemaVersion: 1;
  readonly profile: typeof PROVIDER_SERVICE_INSTALLATION_MANIFEST_PROFILE_V1;
  readonly installationRoot: string;
  readonly manifestGeneration: number;
  readonly platform: ProviderServicePlatformV1;
  readonly serviceLabel: string;
  readonly providerId: string;
  readonly principal: ProviderServicePrincipalV1;
  readonly runtimeRoot: string;
  readonly installationIdentityDigest: ContentDigestV1;
  readonly handoffPayloadDigest: ContentDigestV1;
  readonly binaryDigest: ContentDigestV1;
  readonly capabilityDigest: ContentDigestV1;
  readonly servicePublicKey: `base64url:${string}`;
  readonly managedArtifacts: readonly ManagedArtifactV1[];
  /** Paths are pinned, but their process-lifetime contents are never hashed. */
  readonly ephemeralPaths: Readonly<{
    readonly socketPath: string;
    readonly readinessPath: string;
  }>;
  /** These paths are deliberately never included in rollback or uninstall. */
  readonly retainedState: Readonly<{
    readonly runtimeRoot: string;
    readonly installationIdentityKeyPath: string | null;
  }>;
  readonly previous: PreviousSnapshotPinV1 | null;
}

interface ProviderServiceInstallationManifestEnvelopeV1 {
  readonly payload: ProviderServiceInstallationManifestPayloadV1;
  readonly contentDigest: ContentDigestV1;
}

interface RollbackFileV1 {
  readonly kind: "service_config" | "service_descriptor";
  readonly path: string;
  readonly contentDigest: ContentDigestV1;
  readonly mode: number;
  readonly bytes: `base64url:${string}`;
}

interface ProviderServiceInstallationRollbackPayloadV1 {
  readonly schemaVersion: 1;
  readonly profile: typeof PROVIDER_SERVICE_INSTALLATION_ROLLBACK_PROFILE_V1;
  readonly installationRoot: string;
  readonly fromManifest:
    ProviderServiceInstallationManifestEnvelopeV1;
  readonly files: readonly RollbackFileV1[];
}

interface ProviderServiceInstallationRollbackEnvelopeV1 {
  readonly payload: ProviderServiceInstallationRollbackPayloadV1;
  readonly contentDigest: ContentDigestV1;
}

interface ProviderServiceInstallationLockPayloadV1 {
  readonly schemaVersion: 1;
  readonly profile: typeof PROVIDER_SERVICE_INSTALLATION_LOCK_PROFILE_V1;
  readonly pid: number;
  readonly nonce: `base64url:${string}`;
}

interface ProviderServiceInstallationLockEnvelopeV1 {
  readonly payload: ProviderServiceInstallationLockPayloadV1;
  readonly contentDigest: ContentDigestV1;
}

interface ProviderServiceInstallationLockRecoveryClaimPayloadV1 {
  readonly schemaVersion: 1;
  readonly profile:
    "understand_code_provider_service_installation_lock_recovery_claim_v1";
  readonly breakerPid: number;
  readonly breakerNonce: `base64url:${string}`;
  readonly observedLockPid: number;
  readonly observedLockNonce: `base64url:${string}`;
  readonly observedLockDev: number;
  readonly observedLockIno: number;
}

interface ProviderServiceInstallationLockRecoveryClaimEnvelopeV1 {
  readonly payload: ProviderServiceInstallationLockRecoveryClaimPayloadV1;
  readonly contentDigest: ContentDigestV1;
}

type ProviderServiceInstallationControlOperationV1 =
  | "install"
  | "upgrade"
  | "uninstall";

type ProviderServiceInstallationControlPhaseV1 =
  | "files_pending"
  | "control_invoked"
  | "control_confirmed"
  | "compensation_confirmed";

interface ProviderServiceInstallationControlJournalPayloadV1 {
  readonly schemaVersion: 1;
  readonly profile:
    typeof PROVIDER_SERVICE_INSTALLATION_CONTROL_JOURNAL_PROFILE_V1;
  readonly installationRoot: string;
  readonly operation: ProviderServiceInstallationControlOperationV1;
  readonly phase: ProviderServiceInstallationControlPhaseV1;
  readonly sourceManifest:
    ProviderServiceInstallationManifestEnvelopeV1 | null;
  readonly targetManifest:
    ProviderServiceInstallationManifestEnvelopeV1 | null;
  readonly rollbackContentDigest: ContentDigestV1 | null;
  /** Upgrade baseline bytes required to rebuild the one-level snapshot. */
  readonly rollbackSnapshot:
    ProviderServiceInstallationRollbackEnvelopeV1 | null;
  readonly installationIdentityKeyDigest: ContentDigestV1 | null;
  readonly installationIdentityDisposition: "create" | "reuse" | null;
  readonly createdRuntimeRoot: boolean;
  readonly runtimeRootCreationNonce: `base64url:${string}` | null;
  readonly runtimeRootCustodyPin: Readonly<{
    readonly dev: number;
    readonly ino: number;
  }> | null;
}

interface ProviderServiceInstallationControlJournalEnvelopeV1 {
  readonly payload: ProviderServiceInstallationControlJournalPayloadV1;
  readonly contentDigest: ContentDigestV1;
}

interface RuntimeRootCreationMarkerPayloadV1 {
  readonly schemaVersion: 1;
  readonly profile: typeof RUNTIME_ROOT_CREATION_MARKER_PROFILE_V1;
  readonly runtimeRoot: string;
  readonly nonce: `base64url:${string}`;
}

interface RuntimeRootCreationMarkerEnvelopeV1 {
  readonly payload: RuntimeRootCreationMarkerPayloadV1;
  readonly contentDigest: ContentDigestV1;
}

export type ProviderServiceInstallationLifecycleErrorCodeV1 =
  | "privilege_required"
  | "invalid_target"
  | "manifest_invalid"
  | "installation_tampered"
  | "path_conflict"
  | "service_control_failed"
  | "io_error"
  | "unsupported_platform";

export class ProviderServiceInstallationLifecycleErrorV1 extends Error {
  readonly code: ProviderServiceInstallationLifecycleErrorCodeV1;

  constructor(
    code: ProviderServiceInstallationLifecycleErrorCodeV1,
    message: string,
    options?: { readonly cause?: unknown },
  ) {
    super(message, options);
    this.name = "ProviderServiceInstallationLifecycleErrorV1";
    this.code = code;
  }
}

export interface ProviderServiceInstallationInstallOptionsV1 {
  readonly installationRoot: string;
  readonly expectedRuntimeRoot: string;
  readonly config: ProviderServiceHandoffConfigV1;
  readonly privateKey: KeyObject;
  readonly installationIdentityKey?: Uint8Array;
  readonly descriptorPath?: string;
}

export interface ProviderServiceInstallationUpgradeOptionsV1 {
  readonly installationRoot: string;
  readonly expectedRuntimeRoot: string;
  readonly config: ProviderServiceHandoffConfigV1;
}

export interface ProviderServiceInstallationTargetOptionsV1 {
  readonly installationRoot: string;
  readonly expectedRuntimeRoot: string;
}

interface ProviderServiceInstallationResultBaseV1 {
  readonly authority: "read_only";
  readonly strongWrites: "locked";
  readonly installationRoot: string;
  readonly manifestPath: string;
  readonly runtimeRoot: string;
}

export type ProviderServiceInstallationArtifactStateV1 =
  | "ok"
  | "missing"
  | "modified"
  | "symlink"
  | "wrong_type"
  | "wrong_owner"
  | "wrong_mode"
  | "busy";

export type ProviderServiceInstallationArtifactKindV1 =
  | ProviderServiceInstallationManagedArtifactKindV1
  | "manifest"
  | "rollback"
  | "runtime_root"
  | "runtime_socket"
  | "readiness_receipt"
  | "installation_identity_key"
  | "lifecycle_lock"
  | "control_journal";

export interface ProviderServiceInstallationArtifactCheckV1 {
  readonly kind: ProviderServiceInstallationArtifactKindV1;
  readonly path: string;
  readonly state: ProviderServiceInstallationArtifactStateV1;
  readonly expectedDigest?: ContentDigestV1;
  readonly actualDigest?: ContentDigestV1;
}

export interface ProviderServiceInstallationDoctorResultV1
  extends ProviderServiceInstallationResultBaseV1 {
  readonly ok: boolean;
  readonly status:
    | "healthy"
      | "not_installed"
      | "invalid_manifest"
      | "tampered"
      | "busy"
      | "recovery_required";
  readonly artifacts: readonly ProviderServiceInstallationArtifactCheckV1[];
  readonly reason?: string;
  readonly manifestGeneration?: number;
  readonly handoffPayloadDigest?: ContentDigestV1;
  readonly rollbackAvailable?: boolean;
}

export interface ProviderServiceInstallationInstallResultV1
  extends ProviderServiceInstallationResultBaseV1 {
  readonly status:
    | "installed"
    | "already_installed"
    | "refused"
    | "recovery_required";
  readonly configPath?: string;
  readonly descriptorPath?: string;
  readonly reason?: string;
}

export interface ProviderServiceInstallationUpgradeResultV1
  extends ProviderServiceInstallationResultBaseV1 {
  readonly status:
    | "updated"
    | "already_current"
    | "not_installed"
    | "refused"
    | "recovery_required";
  readonly fromPayloadDigest?: ContentDigestV1;
  readonly payloadDigest?: ContentDigestV1;
  readonly rollbackAvailable?: boolean;
  readonly reason?: string;
}

export interface ProviderServiceInstallationRollbackResultV1
  extends ProviderServiceInstallationResultBaseV1 {
  readonly status:
    | "rolled_back"
    | "not_available"
    | "not_installed"
    | "refused"
    | "partial";
  readonly removedPaths: readonly string[];
  readonly refusedPaths: readonly string[];
  readonly payloadDigest?: ContentDigestV1;
  readonly reason?: string;
}

export interface ProviderServiceInstallationUninstallResultV1
  extends ProviderServiceInstallationResultBaseV1 {
  readonly status:
    | "removed_with_retained_state"
    | "not_installed"
    | "refused"
    | "partial"
    | "recovery_required";
  readonly removedPaths: readonly string[];
  readonly refusedPaths: readonly string[];
  readonly retainedState?: readonly ProviderServiceInstallationRetainedStateKindV1[];
  readonly reason?: string;
}

export type ProviderServiceInstallationRetainedStateKindV1 =
  | "runtime_root"
  | "provider_durable_state"
  | "installation_identity_key";

interface AuthorityStateV1 {
  readonly authorityUid: number;
  readonly authorityGid: number;
  readonly platform: ProviderServicePlatformV1;
  readonly allowTestDescriptorOverride: boolean;
  readonly afterDurablePhase?: (
    phase:
      | "install_journal_published"
      | "install_runtime_root_marker_published"
      | "install_runtime_root_removed"
      | "install_runtime_root_marker_removed"
      | "upgrade_snapshot_published"
      | "uninstall_first_artifact_removed"
      | "rollback_publish_stage_removed"
      | "uninstall_runtime_root_custody_acquired"
      | "install_runtime_root_custody_acquired",
  ) => void | Promise<void>;
  readonly controlService: ReturnType<
    typeof requireProviderServiceInstallationPrivilegeInternalV1
  >["controlService"];
}

interface FileObservationV1 {
  readonly bytes: Buffer;
  readonly contentDigest: ContentDigestV1;
  readonly mode: number;
  readonly uid: number;
  readonly gid: number;
  readonly dev: number;
  readonly ino: number;
  readonly nlink: number;
}

type AtomicStageMetadataTransitionV1 =
  | "ready"
  | "complete_owner_then_mode"
  | "complete_owner"
  | "complete_mode"
  | "invalid";

/** Internal deterministic seam for distinct authority/principal crash cuts. */
export function classifyProviderServiceAtomicStageMetadataForTestInternalV1(
  input: Readonly<{
    readonly authorityUid: number;
    readonly authorityGid: number;
    readonly ownerUid: number;
    readonly ownerGid: number;
    readonly finalMode: number;
    readonly observedUid: number;
    readonly observedGid: number;
    readonly observedMode: number;
  }>,
): AtomicStageMetadataTransitionV1 {
  const authorityOwner = input.observedUid === input.authorityUid &&
    input.observedGid === input.authorityGid;
  const finalOwner = input.observedUid === input.ownerUid &&
    input.observedGid === input.ownerGid;
  if (finalOwner && input.observedMode === input.finalMode) return "ready";
  if (authorityOwner && input.observedMode === 0o400) {
    return "complete_owner_then_mode";
  }
  if (authorityOwner && input.observedMode === input.finalMode) {
    return "complete_owner";
  }
  if (finalOwner && input.observedMode === 0o400) return "complete_mode";
  return "invalid";
}

class ProviderServiceInstallationCrashCutInternalV1 extends Error {
  constructor(cause: unknown) {
    super("provider service lifecycle test crash cut", { cause });
    this.name = "ProviderServiceInstallationCrashCutInternalV1";
  }
}

async function observeCrashCutPhaseInternalV1(
  authority: AuthorityStateV1,
  phase: "install_journal_published" |
    "install_runtime_root_marker_published" |
    "install_runtime_root_removed" |
    "install_runtime_root_marker_removed",
): Promise<void> {
  try {
    await authority.afterDurablePhase?.(phase);
  } catch (error) {
    throw new ProviderServiceInstallationCrashCutInternalV1(error);
  }
}

function enqueueInstallationOperationV1<T>(
  _root: string,
  operation: () => Promise<T>,
): Promise<T> {
  // Cross-process exclusion is enforced by the durable O_EXCL lock below;
  // in-process queuing would hide contention instead of reporting `busy`.
  return operation();
}

function exactKeysV1(
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

function safeAbsolutePathV1(value: string, label: string): string {
  if (
    typeof value !== "string" ||
    !isAbsolute(value) ||
    Buffer.byteLength(value, "utf8") > MAX_PATH_BYTES_V1 ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    throw new ProviderServiceInstallationLifecycleErrorV1(
      "invalid_target",
      `${label} must be one bounded absolute path`,
    );
  }
  const normalized = resolve(value);
  if (normalized === dirname(normalized)) {
    throw new ProviderServiceInstallationLifecycleErrorV1(
      "invalid_target",
      `${label} must not be a filesystem root`,
    );
  }
  return normalized;
}

function isMissingV1(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error &&
    (error as { readonly code?: unknown }).code === "ENOENT";
}

function digestBytesV1(bytes: Uint8Array): ContentDigestV1 {
  return ContentDigestV1Schema.parse(
    `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
  );
}

function digestDomainV1(domain: string, value: unknown): ContentDigestV1 {
  return digestBytesV1(
    Buffer.from(canonicalizeJcsSafeIntegerV1([domain, value]), "utf8"),
  );
}

function canonicalFileV1(value: unknown): Buffer {
  return Buffer.from(`${canonicalizeJcsSafeIntegerV1(value)}\n`, "utf8");
}

function encodeBytesV1(bytes: Uint8Array): `base64url:${string}` {
  return `base64url:${Buffer.from(bytes).toString("base64url")}`;
}

function decodeBytesV1(value: unknown): Buffer {
  const parsed = CanonicalByteStringV1Schema.parse(value);
  return Buffer.from(parsed.slice("base64url:".length), "base64url");
}

function manifestPathV1(root: string): string {
  return resolve(root, PROVIDER_SERVICE_INSTALLATION_MANIFEST_FILE_V1);
}

function rollbackPathV1(root: string): string {
  return resolve(root, PROVIDER_SERVICE_INSTALLATION_ROLLBACK_FILE_V1);
}

function lifecycleLockPathV1(root: string): string {
  return resolve(root, PROVIDER_SERVICE_INSTALLATION_LOCK_FILE_V1);
}

function lifecycleLockRecoveryClaimPathV1(root: string): string {
  return resolve(root, LIFECYCLE_LOCK_RECOVERY_CLAIM_FILE_V1);
}

function lifecycleLockStaleQuarantinePathV1(root: string): string {
  return resolve(root, LIFECYCLE_LOCK_STALE_QUARANTINE_FILE_V1);
}

function lifecycleLockRecoveryRetiringPathV1(root: string): string {
  return resolve(root, LIFECYCLE_LOCK_RECOVERY_RETIRING_FILE_V1);
}

function controlJournalPathV1(root: string): string {
  return resolve(root, PROVIDER_SERVICE_INSTALLATION_CONTROL_JOURNAL_FILE_V1);
}

function runtimeRootCreationMarkerPathV1(runtimeRoot: string): string {
  return resolve(
    dirname(runtimeRoot),
    `.${basename(runtimeRoot)}.provider-service-runtime-root-creation-v1`,
  );
}

function atomicPublishStagingPathV1(path: string): string {
  return resolve(
    dirname(path),
    `.${basename(path)}.provider-service-publish-v1`,
  );
}

function makeRuntimeRootCreationMarkerV1(
  runtimeRoot: string,
  nonce: `base64url:${string}`,
): RuntimeRootCreationMarkerEnvelopeV1 {
  const payload: RuntimeRootCreationMarkerPayloadV1 = Object.freeze({
    schemaVersion: 1,
    profile: RUNTIME_ROOT_CREATION_MARKER_PROFILE_V1,
    runtimeRoot,
    nonce,
  });
  return Object.freeze({
    payload,
    contentDigest: digestDomainV1(
      RUNTIME_ROOT_CREATION_MARKER_DIGEST_DOMAIN_V1,
      payload,
    ),
  });
}

function makeLockV1(): ProviderServiceInstallationLockEnvelopeV1 {
  const payload: ProviderServiceInstallationLockPayloadV1 = Object.freeze({
    schemaVersion: 1,
    profile: PROVIDER_SERVICE_INSTALLATION_LOCK_PROFILE_V1,
    pid: process.pid,
    nonce: encodeBytesV1(randomBytes(16)),
  });
  return Object.freeze({
    payload,
    contentDigest: digestDomainV1(LOCK_DIGEST_DOMAIN_V1, payload),
  });
}

function parseLockValueV1(
  value: unknown,
): ProviderServiceInstallationLockEnvelopeV1 {
  if (!exactKeysV1(value, ["payload", "contentDigest"])) {
    throw new TypeError("lifecycle lock envelope is invalid");
  }
  const payload = value.payload;
  if (
    !exactKeysV1(payload, ["schemaVersion", "profile", "pid", "nonce"]) ||
    payload.schemaVersion !== 1 ||
    payload.profile !== PROVIDER_SERVICE_INSTALLATION_LOCK_PROFILE_V1 ||
    !Number.isSafeInteger(payload.pid) ||
    (payload.pid as number) < 1 ||
    (payload.pid as number) > 0x7fffffff
  ) throw new TypeError("lifecycle lock payload is invalid");
  const parsedPayload: ProviderServiceInstallationLockPayloadV1 = Object.freeze({
    schemaVersion: 1,
    profile: PROVIDER_SERVICE_INSTALLATION_LOCK_PROFILE_V1,
    pid: payload.pid as number,
    nonce: CanonicalByteStringV1Schema.parse(payload.nonce) as `base64url:${string}`,
  });
  if (decodeBytesV1(parsedPayload.nonce).byteLength !== 16) {
    throw new TypeError("lifecycle lock nonce is invalid");
  }
  const contentDigest = ContentDigestV1Schema.parse(value.contentDigest);
  if (contentDigest !== digestDomainV1(LOCK_DIGEST_DOMAIN_V1, parsedPayload)) {
    throw new TypeError("lifecycle lock digest is invalid");
  }
  return Object.freeze({ payload: parsedPayload, contentDigest });
}

function makeLockRecoveryClaimV1(
  inspected: NonNullable<Awaited<ReturnType<typeof inspectLifecycleLockV1>>>,
): ProviderServiceInstallationLockRecoveryClaimEnvelopeV1 {
  const payload: ProviderServiceInstallationLockRecoveryClaimPayloadV1 =
    Object.freeze({
      schemaVersion: 1,
      profile:
        "understand_code_provider_service_installation_lock_recovery_claim_v1",
      breakerPid: process.pid,
      breakerNonce: encodeBytesV1(randomBytes(16)),
      observedLockPid: inspected.envelope.payload.pid,
      observedLockNonce: inspected.envelope.payload.nonce,
      observedLockDev: inspected.observation.dev,
      observedLockIno: inspected.observation.ino,
    });
  return Object.freeze({
    payload,
    contentDigest: digestDomainV1(
      LOCK_RECOVERY_CLAIM_DIGEST_DOMAIN_V1,
      payload,
    ),
  });
}

function parseLockRecoveryClaimValueV1(
  value: unknown,
): ProviderServiceInstallationLockRecoveryClaimEnvelopeV1 {
  if (!exactKeysV1(value, ["payload", "contentDigest"])) {
    throw new TypeError("lifecycle lock recovery claim envelope is invalid");
  }
  const payload = value.payload;
  if (
    !exactKeysV1(payload, [
      "schemaVersion",
      "profile",
      "breakerPid",
      "breakerNonce",
      "observedLockPid",
      "observedLockNonce",
      "observedLockDev",
      "observedLockIno",
    ]) ||
    payload.schemaVersion !== 1 ||
    payload.profile !==
      "understand_code_provider_service_installation_lock_recovery_claim_v1" ||
    !Number.isSafeInteger(payload.breakerPid) ||
    (payload.breakerPid as number) < 1 ||
    (payload.breakerPid as number) > 0x7fffffff ||
    !Number.isSafeInteger(payload.observedLockPid) ||
    (payload.observedLockPid as number) < 1 ||
    (payload.observedLockPid as number) > 0x7fffffff ||
    !Number.isSafeInteger(payload.observedLockDev) ||
    (payload.observedLockDev as number) < 0 ||
    !Number.isSafeInteger(payload.observedLockIno) ||
    (payload.observedLockIno as number) < 1
  ) throw new TypeError("lifecycle lock recovery claim payload is invalid");
  const parsedPayload: ProviderServiceInstallationLockRecoveryClaimPayloadV1 =
    Object.freeze({
      schemaVersion: 1,
      profile:
        "understand_code_provider_service_installation_lock_recovery_claim_v1",
      breakerPid: payload.breakerPid as number,
      breakerNonce: CanonicalByteStringV1Schema.parse(
        payload.breakerNonce,
      ) as `base64url:${string}`,
      observedLockPid: payload.observedLockPid as number,
      observedLockNonce: CanonicalByteStringV1Schema.parse(
        payload.observedLockNonce,
      ) as `base64url:${string}`,
      observedLockDev: payload.observedLockDev as number,
      observedLockIno: payload.observedLockIno as number,
    });
  if (
    decodeBytesV1(parsedPayload.breakerNonce).byteLength !== 16 ||
    decodeBytesV1(parsedPayload.observedLockNonce).byteLength !== 16
  ) throw new TypeError("lifecycle lock recovery claim nonce is invalid");
  const contentDigest = ContentDigestV1Schema.parse(value.contentDigest);
  if (
    contentDigest !== digestDomainV1(
      LOCK_RECOVERY_CLAIM_DIGEST_DOMAIN_V1,
      parsedPayload,
    )
  ) throw new TypeError("lifecycle lock recovery claim digest is invalid");
  return Object.freeze({ payload: parsedPayload, contentDigest });
}

interface HeldLifecycleLockV1 {
  readonly path: string;
  readonly nonce: `base64url:${string}`;
  readonly dev: number;
  readonly ino: number;
}

type LifecycleLockAttemptV1 =
  | Readonly<{ readonly status: "acquired"; readonly lock: HeldLifecycleLockV1 }>
  | Readonly<{ readonly status: "busy" }>;

function processDefinitelyExitedV1(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    return typeof error === "object" && error !== null && "code" in error &&
      (error as { readonly code?: unknown }).code === "ESRCH";
  }
}

async function inspectLifecycleLockV1(
  root: string,
  authority: AuthorityStateV1,
  path = lifecycleLockPathV1(root),
  allowedLinkCounts: readonly number[] = [1, 2],
): Promise<Readonly<{
  readonly envelope: ProviderServiceInstallationLockEnvelopeV1;
  readonly observation: FileObservationV1;
}> | undefined> {
  try {
    const observation = await readCheckedFileV1({
      path,
      uid: authority.authorityUid,
      gid: authority.authorityGid,
      mode: 0o600,
      maximumBytes: MAX_LOCK_BYTES_V1,
      // A crash between publishing the fsynced inode and unlinking its
      // staging name leaves exactly two links to the complete lock record.
      // That shape is safe to inspect/reclaim; additional links stay busy.
      allowedLinkCounts,
    });
    const envelope = parseLockValueV1(
      parseCanonicalFileV1(observation.bytes, MAX_LOCK_BYTES_V1),
    );
    const aliases = [
      lifecycleLockPathV1(root),
      atomicPublishStagingPathV1(lifecycleLockPathV1(root)),
      lifecycleLockStaleQuarantinePathV1(root),
    ];
    let matchingAliases = 0;
    for (const alias of aliases) {
      try {
        const metadata = await lstat(alias);
        if (metadata.dev === observation.dev && metadata.ino === observation.ino) {
          if (
            metadata.isSymbolicLink() ||
            !metadata.isFile() ||
            metadata.uid !== authority.authorityUid ||
            metadata.gid !== authority.authorityGid ||
            exactModeV1(metadata.mode) !== 0o600 ||
            metadata.size !== observation.bytes.byteLength ||
            metadata.nlink !== observation.nlink
          ) throw new Error("lifecycle lock alias metadata mismatch");
          matchingAliases += 1;
        }
      } catch (error) {
        if (!isMissingV1(error)) throw error;
      }
    }
    if (matchingAliases !== observation.nlink) {
      throw new Error("lifecycle lock has an unknown hard-link alias");
    }
    return Object.freeze({ envelope, observation });
  } catch {
    // Unsafe, malformed, EPERM-owned, or racing locks are conservatively busy.
    return undefined;
  }
}

interface ObservedLifecycleRecoveryClaimV1 {
  readonly envelope: ProviderServiceInstallationLockRecoveryClaimEnvelopeV1;
  readonly observation: FileObservationV1;
}

async function inspectLifecycleRecoveryClaimV1(
  root: string,
  authority: AuthorityStateV1,
  path = lifecycleLockRecoveryClaimPathV1(root),
): Promise<ObservedLifecycleRecoveryClaimV1 | undefined> {
  try {
    const observation = await readCheckedFileV1({
      path,
      uid: authority.authorityUid,
      gid: authority.authorityGid,
      mode: 0o600,
      maximumBytes: MAX_LOCK_BYTES_V1,
      allowedLinkCounts: [1, 2, 3],
    });
    const envelope = parseLockRecoveryClaimValueV1(
      parseCanonicalFileV1(observation.bytes, MAX_LOCK_BYTES_V1),
    );
    const aliases = [
      lifecycleLockRecoveryClaimPathV1(root),
      atomicPublishStagingPathV1(lifecycleLockRecoveryClaimPathV1(root)),
      lifecycleLockRecoveryRetiringPathV1(root),
    ];
    let matchingAliases = 0;
    for (const alias of aliases) {
      try {
        const metadata = await lstat(alias);
        if (metadata.dev === observation.dev && metadata.ino === observation.ino) {
          if (
            metadata.isSymbolicLink() ||
            !metadata.isFile() ||
            metadata.uid !== authority.authorityUid ||
            metadata.gid !== authority.authorityGid ||
            exactModeV1(metadata.mode) !== 0o600 ||
            metadata.size !== observation.bytes.byteLength ||
            metadata.nlink !== observation.nlink
          ) throw new Error("lifecycle recovery claim alias metadata mismatch");
          matchingAliases += 1;
        }
      } catch (error) {
        if (!isMissingV1(error)) throw error;
      }
    }
    if (matchingAliases !== observation.nlink) {
      throw new Error("lifecycle recovery claim has an unknown hard-link alias");
    }
    return Object.freeze({ envelope, observation });
  } catch {
    return undefined;
  }
}

function lockMatchesRecoveryClaimV1(
  lock: NonNullable<Awaited<ReturnType<typeof inspectLifecycleLockV1>>>,
  claim: ObservedLifecycleRecoveryClaimV1,
): boolean {
  return lock.envelope.payload.pid === claim.envelope.payload.observedLockPid &&
    lock.envelope.payload.nonce ===
      claim.envelope.payload.observedLockNonce &&
    lock.observation.dev === claim.envelope.payload.observedLockDev &&
    lock.observation.ino === claim.envelope.payload.observedLockIno;
}

function sameRecoveryClaimV1(
  left: ObservedLifecycleRecoveryClaimV1,
  right: ObservedLifecycleRecoveryClaimV1,
): boolean {
  return left.envelope.contentDigest === right.envelope.contentDigest &&
    left.observation.dev === right.observation.dev &&
    left.observation.ino === right.observation.ino;
}

async function pathExistsV1(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (isMissingV1(error)) return false;
    return true;
  }
}

async function tryPublishLifecycleRecordV1(
  root: string,
  authority: AuthorityStateV1,
  path: string,
  bytes: Uint8Array,
  nonce: `base64url:${string}`,
): Promise<HeldLifecycleLockV1 | undefined> {
  const temporary = atomicPublishStagingPathV1(path);
  let handle: FileHandle | undefined;
  let temporaryExists = false;
  let temporaryDurable = false;
  let finalPublished = false;
  try {
    try {
      handle = await open(
        temporary,
        constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
        0o400,
      );
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { readonly code?: unknown }).code === "EEXIST"
      ) return undefined;
      throw error;
    }
    temporaryExists = true;
    await handle.chmod(0o400);
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.chmod(0o600);
    await handle.chown(authority.authorityUid, authority.authorityGid);
    await handle.sync();
    temporaryDurable = true;
    const metadata = await handle.stat();
    await handle.close();
    handle = undefined;
    try {
      await link(temporary, path);
      finalPublished = true;
      await syncDirectoryV1(root);
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { readonly code?: unknown }).code === "EEXIST"
      ) {
        await unlink(temporary);
        temporaryExists = false;
        return undefined;
      }
      throw error;
    }
    await unlink(temporary);
    temporaryExists = false;
    await syncDirectoryV1(root);
    return Object.freeze({
      path,
      nonce,
      dev: metadata.dev,
      ino: metadata.ino,
    });
  } catch (error) {
    await handle?.close().catch(() => undefined);
    if (temporaryExists && !temporaryDurable) {
      await unlink(temporary).catch(() => undefined);
    }
    void finalPublished;
    throw new ProviderServiceInstallationLifecycleErrorV1(
      "io_error",
      "provider service lifecycle lock record could not be created",
      { cause: error },
    );
  }
}

async function tryCreateLifecycleLockRecordV1(
  root: string,
  authority: AuthorityStateV1,
  path: string,
): Promise<HeldLifecycleLockV1 | undefined> {
  const envelope = makeLockV1();
  return tryPublishLifecycleRecordV1(
    root,
    authority,
    path,
    canonicalFileV1(envelope),
    envelope.payload.nonce,
  );
}

async function recoverLifecycleLockPublishStageV1(
  root: string,
  authority: AuthorityStateV1,
): Promise<ExistingRecoveryGateResultV1> {
  const canonicalPath = lifecycleLockPathV1(root);
  const stagingPath = atomicPublishStagingPathV1(canonicalPath);
  await discardIncompleteAuthorityStageV1({
    path: stagingPath,
    authorityUid: authority.authorityUid,
    authorityGid: authority.authorityGid,
    maximumBytes: MAX_LOCK_BYTES_V1,
  });
  if (!(await pathExistsV1(stagingPath))) return "absent";
  const staged = await inspectLifecycleLockV1(
    root,
    authority,
    stagingPath,
    [1, 2, 3],
  );
  if (staged === undefined) return "busy";
  const canonical = await inspectLifecycleLockV1(
    root,
    authority,
    canonicalPath,
    [1, 2, 3],
  );
  if (staged.observation.nlink === 2) {
    if (
      canonical === undefined ||
      canonical.observation.dev !== staged.observation.dev ||
      canonical.observation.ino !== staged.observation.ino ||
      canonical.envelope.contentDigest !== staged.envelope.contentDigest
    ) return "busy";
    if (!processDefinitelyExitedV1(staged.envelope.payload.pid)) return "busy";
  } else if (
    canonical !== undefined &&
    canonical.observation.dev === staged.observation.dev &&
    canonical.observation.ino === staged.observation.ino
  ) {
    return "busy";
  } else if (!processDefinitelyExitedV1(staged.envelope.payload.pid)) {
    return "busy";
  }
  const latest = await inspectLifecycleLockV1(
    root,
    authority,
    stagingPath,
    [1, 2, 3],
  );
  if (
    latest === undefined ||
    latest.observation.dev !== staged.observation.dev ||
    latest.observation.ino !== staged.observation.ino ||
    latest.envelope.contentDigest !== staged.envelope.contentDigest
  ) return "busy";
  await unlinkAndSyncV1(stagingPath);
  return "cleared";
}

async function recoverLifecycleClaimPublishStageV1(
  root: string,
  authority: AuthorityStateV1,
): Promise<ExistingRecoveryGateResultV1> {
  const canonicalPath = lifecycleLockRecoveryClaimPathV1(root);
  const stagingPath = atomicPublishStagingPathV1(canonicalPath);
  await discardIncompleteAuthorityStageV1({
    path: stagingPath,
    authorityUid: authority.authorityUid,
    authorityGid: authority.authorityGid,
    maximumBytes: MAX_LOCK_BYTES_V1,
  });
  if (!(await pathExistsV1(stagingPath))) return "absent";
  const staged = await inspectLifecycleRecoveryClaimV1(
    root,
    authority,
    stagingPath,
  );
  if (staged === undefined) return "busy";
  const canonical = await inspectLifecycleRecoveryClaimV1(root, authority);
  if (staged.observation.nlink === 2) {
    if (
      canonical === undefined ||
      !sameRecoveryClaimV1(canonical, staged)
    ) return "busy";
    if (!processDefinitelyExitedV1(staged.envelope.payload.breakerPid)) {
      return "busy";
    }
  } else if (
    canonical !== undefined &&
    canonical.observation.dev === staged.observation.dev &&
    canonical.observation.ino === staged.observation.ino
  ) {
    return "busy";
  } else if (!processDefinitelyExitedV1(staged.envelope.payload.breakerPid)) {
    return "busy";
  }
  const latest = await inspectLifecycleRecoveryClaimV1(
    root,
    authority,
    stagingPath,
  );
  if (latest === undefined || !sameRecoveryClaimV1(latest, staged)) {
    return "busy";
  }
  await unlinkAndSyncV1(stagingPath);
  return "cleared";
}

async function removePinnedStaleLockStageV1(
  root: string,
  authority: AuthorityStateV1,
  claim: ObservedLifecycleRecoveryClaimV1,
): Promise<boolean> {
  const stagingPath = atomicPublishStagingPathV1(lifecycleLockPathV1(root));
  const staged = await inspectLifecycleLockV1(
    root,
    authority,
    stagingPath,
    [1, 2, 3],
  );
  if (staged === undefined) return !(await pathExistsV1(stagingPath));
  if (!lockMatchesRecoveryClaimV1(staged, claim)) return false;
  const latest = await inspectLifecycleLockV1(
    root,
    authority,
    stagingPath,
    [1, 2, 3],
  );
  if (latest === undefined || !lockMatchesRecoveryClaimV1(latest, claim)) {
    return false;
  }
  await unlinkAndSyncV1(stagingPath);
  return true;
}

async function tryCreateLifecycleRecoveryClaimV1(
  root: string,
  authority: AuthorityStateV1,
  inspected: NonNullable<Awaited<ReturnType<typeof inspectLifecycleLockV1>>>,
): Promise<ObservedLifecycleRecoveryClaimV1 | undefined> {
  const envelope = makeLockRecoveryClaimV1(inspected);
  const published = await tryPublishLifecycleRecordV1(
    root,
    authority,
    lifecycleLockRecoveryClaimPathV1(root),
    canonicalFileV1(envelope),
    envelope.payload.breakerNonce,
  );
  if (published === undefined) return undefined;
  const observed = await inspectLifecycleRecoveryClaimV1(root, authority);
  if (
    observed === undefined ||
    observed.envelope.contentDigest !== envelope.contentDigest ||
    observed.observation.dev !== published.dev ||
    observed.observation.ino !== published.ino
  ) {
    // The published claim is the fail-closed gate.  Never remove a record that
    // cannot be re-observed as the exact fsynced generation just published.
    throw new ProviderServiceInstallationLifecycleErrorV1(
      "installation_tampered",
      "provider service lifecycle recovery claim changed after publish",
    );
  }
  return observed;
}

type RecoveryTargetResultV1 = "reclaimed" | "target_changed" | "gated";

async function resumeLifecycleRecoveryTargetV1(
  root: string,
  authority: AuthorityStateV1,
  claim: ObservedLifecycleRecoveryClaimV1,
): Promise<RecoveryTargetResultV1> {
  if (!processDefinitelyExitedV1(claim.envelope.payload.observedLockPid)) {
    return "gated";
  }
  const lockPath = lifecycleLockPathV1(root);
  const quarantinePath = lifecycleLockStaleQuarantinePathV1(root);
  let quarantined = await inspectLifecycleLockV1(
    root,
    authority,
    quarantinePath,
    [1, 2, 3],
  );
  if (quarantined === undefined && await pathExistsV1(quarantinePath)) {
    return "gated";
  }
  if (quarantined !== undefined && !lockMatchesRecoveryClaimV1(quarantined, claim)) {
    return "gated";
  }

  let current = await inspectLifecycleLockV1(
    root,
    authority,
    lockPath,
    [1, 2, 3],
  );
  if (current === undefined && await pathExistsV1(lockPath)) return "gated";
  if (current !== undefined && !lockMatchesRecoveryClaimV1(current, claim)) {
    if (quarantined === undefined) return "target_changed";
    // A contender may have passed the pre-claim gate check, then publish a
    // newer canonical generation after the old inode was quarantined.  The
    // claim proves the quarantine is the old target, so retire only that inode
    // and leave the different canonical generation untouched.
    const latestQuarantine = await inspectLifecycleLockV1(
      root,
      authority,
      quarantinePath,
      [1, 2, 3],
    );
    if (
      latestQuarantine === undefined ||
      !lockMatchesRecoveryClaimV1(latestQuarantine, claim)
    ) return "gated";
    if (!(await removePinnedStaleLockStageV1(root, authority, claim))) {
      return "gated";
    }
    try {
      await unlinkAndSyncV1(quarantinePath);
    } catch (error) {
      if (!isMissingV1(error)) throw error;
    }
    return "reclaimed";
  }
  if (current !== undefined && quarantined === undefined) {
    try {
      await link(lockPath, quarantinePath);
      await syncDirectoryV1(root);
    } catch (error) {
      if (
        !isMissingV1(error) &&
        !(
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          (error as { readonly code?: unknown }).code === "EEXIST"
        )
      ) throw error;
    }
    quarantined = await inspectLifecycleLockV1(
      root,
      authority,
      quarantinePath,
      [1, 2, 3],
    );
    if (
      quarantined === undefined ||
      !lockMatchesRecoveryClaimV1(quarantined, claim)
    ) return "gated";
  }
  if (quarantined !== undefined) {
    current = await inspectLifecycleLockV1(root, authority, lockPath, [1, 2, 3]);
    if (current !== undefined) {
      if (!lockMatchesRecoveryClaimV1(current, claim)) return "gated";
      try {
        await unlinkAndSyncV1(lockPath);
      } catch (error) {
        if (!isMissingV1(error)) throw error;
      }
    } else if (await pathExistsV1(lockPath)) {
      return "gated";
    }
    if (!(await removePinnedStaleLockStageV1(root, authority, claim))) {
      return "gated";
    }
    const latestQuarantine = await inspectLifecycleLockV1(
      root,
      authority,
      quarantinePath,
      [1, 2, 3],
    );
    if (latestQuarantine === undefined) {
      return await pathExistsV1(quarantinePath) ? "gated" : "reclaimed";
    }
    if (!lockMatchesRecoveryClaimV1(latestQuarantine, claim)) return "gated";
    try {
      await unlinkAndSyncV1(quarantinePath);
    } catch (error) {
      if (!isMissingV1(error)) throw error;
    }
  }
  return "reclaimed";
}

async function retireLifecycleRecoveryClaimV1(
  root: string,
  authority: AuthorityStateV1,
  expected: ObservedLifecycleRecoveryClaimV1,
): Promise<boolean> {
  const claimPath = lifecycleLockRecoveryClaimPathV1(root);
  const retiringPath = lifecycleLockRecoveryRetiringPathV1(root);
  let retiring = await inspectLifecycleRecoveryClaimV1(
    root,
    authority,
    retiringPath,
  );
  if (retiring === undefined && await pathExistsV1(retiringPath)) return false;
  if (retiring === undefined) {
    try {
      await link(claimPath, retiringPath);
      await syncDirectoryV1(root);
    } catch (error) {
      if (
        !isMissingV1(error) &&
        !(
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          (error as { readonly code?: unknown }).code === "EEXIST"
        )
      ) throw error;
    }
    retiring = await inspectLifecycleRecoveryClaimV1(
      root,
      authority,
      retiringPath,
    );
  }
  if (retiring === undefined || !sameRecoveryClaimV1(retiring, expected)) {
    return false;
  }
  const canonical = await inspectLifecycleRecoveryClaimV1(root, authority);
  if (canonical !== undefined) {
    if (!sameRecoveryClaimV1(canonical, expected)) return false;
    try {
      await unlinkAndSyncV1(claimPath);
    } catch (error) {
      if (!isMissingV1(error)) throw error;
    }
  } else if (await pathExistsV1(claimPath)) {
    return false;
  }
  const latestRetiring = await inspectLifecycleRecoveryClaimV1(
    root,
    authority,
    retiringPath,
  );
  if (latestRetiring === undefined) return !(await pathExistsV1(retiringPath));
  if (!sameRecoveryClaimV1(latestRetiring, expected)) return false;
  try {
    await unlinkAndSyncV1(retiringPath);
  } catch (error) {
    if (!isMissingV1(error)) throw error;
  }
  return true;
}

type ExistingRecoveryGateResultV1 = "absent" | "cleared" | "busy";

async function recoverExistingLifecycleGateV1(
  root: string,
  authority: AuthorityStateV1,
): Promise<ExistingRecoveryGateResultV1> {
  const retiringPath = lifecycleLockRecoveryRetiringPathV1(root);
  if (await pathExistsV1(retiringPath)) {
    const retiring = await inspectLifecycleRecoveryClaimV1(
      root,
      authority,
      retiringPath,
    );
    if (
      retiring === undefined ||
      !processDefinitelyExitedV1(retiring.envelope.payload.breakerPid) ||
      await pathExistsV1(lifecycleLockStaleQuarantinePathV1(root))
    ) return "busy";
    const canonical = await inspectLifecycleRecoveryClaimV1(root, authority);
    if (canonical !== undefined && !sameRecoveryClaimV1(canonical, retiring)) {
      return "busy";
    }
    return await retireLifecycleRecoveryClaimV1(root, authority, retiring)
      ? "cleared"
      : "busy";
  }

  const claimPath = lifecycleLockRecoveryClaimPathV1(root);
  if (!(await pathExistsV1(claimPath))) {
    const claimPublish = await recoverLifecycleClaimPublishStageV1(
      root,
      authority,
    );
    if (claimPublish !== "absent") return claimPublish;
    return await pathExistsV1(lifecycleLockStaleQuarantinePathV1(root))
      ? "busy"
      : "absent";
  }
  const claim = await inspectLifecycleRecoveryClaimV1(root, authority);
  if (
    claim === undefined ||
    !processDefinitelyExitedV1(claim.envelope.payload.breakerPid)
  ) return "busy";
  const targetResult = await resumeLifecycleRecoveryTargetV1(
    root,
    authority,
    claim,
  );
  if (targetResult === "gated") return "busy";
  return await retireLifecycleRecoveryClaimV1(root, authority, claim)
    ? "cleared"
    : "busy";
}

async function reclaimDefinitelyStaleLockV1(
  root: string,
  authority: AuthorityStateV1,
  inspected: NonNullable<Awaited<ReturnType<typeof inspectLifecycleLockV1>>>,
): Promise<boolean> {
  if (!processDefinitelyExitedV1(inspected.envelope.payload.pid)) return false;
  const claim = await tryCreateLifecycleRecoveryClaimV1(
    root,
    authority,
    inspected,
  );
  if (claim === undefined) return false;
  const targetResult = await resumeLifecycleRecoveryTargetV1(
    root,
    authority,
    claim,
  );
  if (targetResult === "gated") return false;
  if (!(await retireLifecycleRecoveryClaimV1(root, authority, claim))) {
    return false;
  }
  return targetResult === "reclaimed";
}

async function acquireLifecycleLockV1(
  root: string,
  authority: AuthorityStateV1,
): Promise<LifecycleLockAttemptV1> {
  const path = lifecycleLockPathV1(root);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const gate = await recoverExistingLifecycleGateV1(root, authority);
    if (gate === "busy") return Object.freeze({ status: "busy" as const });
    if (gate === "cleared") continue;
    const lockPublish = await recoverLifecycleLockPublishStageV1(
      root,
      authority,
    );
    if (lockPublish === "busy") {
      return Object.freeze({ status: "busy" as const });
    }
    if (lockPublish === "cleared") continue;
    const created = await tryCreateLifecycleLockRecordV1(
      root,
      authority,
      path,
    );
    if (created !== undefined) {
      if (
        await pathExistsV1(lifecycleLockRecoveryClaimPathV1(root)) ||
        await pathExistsV1(lifecycleLockRecoveryRetiringPathV1(root)) ||
        await pathExistsV1(lifecycleLockStaleQuarantinePathV1(root))
      ) {
        await releaseLifecycleLockV1(root, authority, created);
        return Object.freeze({ status: "busy" as const });
      }
      return Object.freeze({ status: "acquired" as const, lock: created });
    }
    const inspected = await inspectLifecycleLockV1(root, authority);
    if (
      inspected === undefined ||
      !processDefinitelyExitedV1(inspected.envelope.payload.pid)
    ) return Object.freeze({ status: "busy" as const });
    if (!(await reclaimDefinitelyStaleLockV1(root, authority, inspected))) {
      return Object.freeze({ status: "busy" as const });
    }
  }
  return Object.freeze({ status: "busy" as const });
}

async function releaseLifecycleLockV1(
  root: string,
  authority: AuthorityStateV1,
  held: HeldLifecycleLockV1,
): Promise<void> {
  const inspected = await inspectLifecycleLockV1(root, authority, held.path);
  if (
    inspected === undefined ||
    inspected.envelope.payload.nonce !== held.nonce ||
    inspected.observation.dev !== held.dev ||
    inspected.observation.ino !== held.ino
  ) {
    throw new ProviderServiceInstallationLifecycleErrorV1(
      "installation_tampered",
      "provider service lifecycle lock changed while held",
    );
  }
  await unlinkAndSyncV1(held.path);
}

async function runWithLifecycleLockV1<T>(
  root: string,
  authority: AuthorityStateV1,
  onBusy: () => T,
  operation: () => Promise<T>,
): Promise<T> {
  const attempt = await acquireLifecycleLockV1(root, authority);
  if (attempt.status === "busy") return onBusy();
  try {
    return await operation();
  } finally {
    await releaseLifecycleLockV1(root, authority, attempt.lock);
  }
}

function isInsideV1(parent: string, candidate: string): boolean {
  const value = relative(parent, candidate);
  return value === "" || (!value.startsWith("..") && !isAbsolute(value));
}

function exactModeV1(mode: number): number {
  return mode & 0o777;
}

async function checkedDirectoryV1(
  path: string,
  uid: number,
  gid: number,
  mode: number,
  label: string,
): Promise<void> {
  let handle: FileHandle | undefined;
  try {
    const before = await lstat(path);
    if (
      before.isSymbolicLink() ||
      !before.isDirectory() ||
      before.uid !== uid ||
      before.gid !== gid ||
      exactModeV1(before.mode) !== mode ||
      await realpath(path) !== path
    ) {
      throw new Error("metadata mismatch");
    }
    handle = await open(
      path,
      constants.O_RDONLY |
        (typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0) |
        (typeof constants.O_DIRECTORY === "number" ? constants.O_DIRECTORY : 0),
    );
    const opened = await handle.stat();
    assertProviderRuntimeNativeFdHasNoExtendedAccessControlV1(handle.fd, {
      expectedKind: "directory",
    });
    const after = await lstat(path);
    if (
      !opened.isDirectory() ||
      opened.dev !== before.dev ||
      opened.ino !== before.ino ||
      opened.uid !== before.uid ||
      opened.gid !== before.gid ||
      exactModeV1(opened.mode) !== exactModeV1(before.mode) ||
      after.isSymbolicLink() ||
      !after.isDirectory() ||
      after.dev !== opened.dev ||
      after.ino !== opened.ino ||
      after.uid !== opened.uid ||
      after.gid !== opened.gid ||
      exactModeV1(after.mode) !== exactModeV1(opened.mode)
    ) throw new Error("directory changed while checking");
  } catch (error) {
    throw new ProviderServiceInstallationLifecycleErrorV1(
      "invalid_target",
      `${label} is not the exact owned directory`,
      { cause: error },
    );
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function installationRootPresentV1(
  root: string,
  authority: AuthorityStateV1,
): Promise<boolean> {
  try {
    await checkedDirectoryV1(
      root,
      authority.authorityUid,
      authority.authorityGid,
      0o700,
      "provider service installation root",
    );
    await checkedWritableParentV1(
      root,
      authority.authorityUid,
      authority.authorityGid,
    );
    return true;
  } catch (error) {
    try {
      await lstat(root);
      throw error;
    } catch (metadataError) {
      if (!isMissingV1(metadataError)) throw error;
    }
    // A missing root is only an honest `not_installed` state beneath the
    // authority's exact, non-writable parent.  This also closes symlinked
    // ancestor aliases before install creates the direct child.
    await checkedWritableParentV1(
      root,
      authority.authorityUid,
      authority.authorityGid,
    );
    return false;
  }
}

async function ensureInstallationRootV1(
  root: string,
  authority: AuthorityStateV1,
): Promise<boolean> {
  if (await installationRootPresentV1(root, authority)) return false;
  try {
    await mkdir(root, { mode: 0o700 });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { readonly code?: unknown }).code === "EEXIST"
    ) {
      await checkedDirectoryV1(
        root,
        authority.authorityUid,
        authority.authorityGid,
        0o700,
        "provider service installation root",
      );
      await checkedWritableParentV1(
        root,
        authority.authorityUid,
        authority.authorityGid,
      );
      return false;
    }
    throw error;
  }
  await chmod(root, 0o700);
  await chown(root, authority.authorityUid, authority.authorityGid);
  await syncDirectoryV1(dirname(root));
  await checkedDirectoryV1(
    root,
    authority.authorityUid,
    authority.authorityGid,
    0o700,
    "provider service installation root",
  );
  await checkedWritableParentV1(
    root,
    authority.authorityUid,
    authority.authorityGid,
  );
  return true;
}

async function checkedAuthorityPathChainV1(
  directoryPath: string,
  uid: number,
  gid: number,
): Promise<void> {
  if (!isAbsolute(directoryPath) || resolve(directoryPath) !== directoryPath) {
    throw new Error("directory path is not canonical absolute syntax");
  }
  const components = directoryPath.split("/").filter((item) => item.length > 0);
  const chain = [
    "/",
    ...components.map((_item, index) =>
      `/${components.slice(0, index + 1).join("/")}`
    ),
  ];
  for (const [index, candidate] of chain.entries()) {
    const final = index === chain.length - 1;
    let handle: FileHandle | undefined;
    try {
      const before = await lstat(candidate);
      const ownerAllowed = final
        ? before.uid === uid && before.gid === gid
        : before.uid === 0 ||
          (before.uid === uid && before.gid === gid);
      if (
        before.isSymbolicLink() ||
        !before.isDirectory() ||
        !ownerAllowed ||
        (exactModeV1(before.mode) & 0o022) !== 0
      ) throw new Error("unsafe authority path component");
      handle = await open(
        candidate,
        constants.O_RDONLY |
          (typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0) |
          (typeof constants.O_DIRECTORY === "number" ? constants.O_DIRECTORY : 0),
      );
      const opened = await handle.stat();
      assertProviderRuntimeNativeFdHasNoExtendedAccessControlV1(handle.fd, {
        expectedKind: "directory",
      });
      const after = await lstat(candidate);
      if (
        !opened.isDirectory() ||
        opened.dev !== before.dev ||
        opened.ino !== before.ino ||
        opened.uid !== before.uid ||
        opened.gid !== before.gid ||
        exactModeV1(opened.mode) !== exactModeV1(before.mode) ||
        after.isSymbolicLink() ||
        !after.isDirectory() ||
        after.dev !== opened.dev ||
        after.ino !== opened.ino ||
        after.uid !== opened.uid ||
        after.gid !== opened.gid ||
        exactModeV1(after.mode) !== exactModeV1(opened.mode)
      ) throw new Error("authority path component changed");
    } finally {
      await handle?.close().catch(() => undefined);
    }
  }
  if (await realpath(directoryPath) !== directoryPath) {
    throw new Error("authority path chain is not canonical");
  }
}

async function checkedWritableParentV1(
  path: string,
  uid: number,
  gid: number,
): Promise<void> {
  const parent = dirname(path);
  try {
    await checkedAuthorityPathChainV1(parent, uid, gid);
  } catch (error) {
    throw new ProviderServiceInstallationLifecycleErrorV1(
      "invalid_target",
      "provider service owned file has an unsafe parent",
      { cause: error },
    );
  }
}

async function syncDirectoryV1(path: string): Promise<void> {
  let handle: FileHandle | undefined;
  try {
    handle = await open(path, constants.O_RDONLY);
    await handle.sync();
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function discardIncompleteAuthorityStageV1(input: {
  readonly path: string;
  readonly authorityUid: number;
  readonly authorityGid: number;
  readonly maximumBytes: number;
}): Promise<boolean> {
  let before: Awaited<ReturnType<typeof lstat>>;
  try {
    before = await lstat(input.path);
  } catch (error) {
    if (isMissingV1(error)) return false;
    throw error;
  }
  if (
    before.isSymbolicLink() ||
    !before.isFile() ||
    before.nlink !== 1 ||
    before.uid !== input.authorityUid ||
    before.gid !== input.authorityGid ||
    exactModeV1(before.mode) !== 0o400 ||
    before.size > input.maximumBytes
  ) return false;
  let handle: FileHandle | undefined;
  try {
    handle = await open(
      input.path,
      constants.O_RDONLY |
        (typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0),
    );
    const opened = await handle.stat();
    assertProviderRuntimeNativeFdHasNoExtendedAccessControlV1(handle.fd, {
      expectedKind: "regular-file",
    });
    if (
      !opened.isFile() ||
      opened.dev !== before.dev ||
      opened.ino !== before.ino ||
      opened.nlink !== 1 ||
      opened.uid !== input.authorityUid ||
      opened.gid !== input.authorityGid ||
      exactModeV1(opened.mode) !== 0o400 ||
      opened.size !== before.size
    ) return false;
  } finally {
    await handle?.close().catch(() => undefined);
  }
  const latest = await lstat(input.path);
  if (
    latest.dev !== before.dev ||
    latest.ino !== before.ino ||
    latest.nlink !== 1 ||
    latest.uid !== input.authorityUid ||
    latest.gid !== input.authorityGid ||
    exactModeV1(latest.mode) !== 0o400 ||
    latest.size !== before.size
  ) return false;
  await unlinkAndSyncV1(input.path);
  return true;
}

async function convergePinnedAtomicStageMetadataV1(input: {
  readonly path: string;
  readonly bytes: Uint8Array;
  readonly authorityUid: number;
  readonly authorityGid: number;
  readonly ownerUid: number;
  readonly ownerGid: number;
  readonly finalMode: number;
}): Promise<boolean> {
  let before: Awaited<ReturnType<typeof lstat>>;
  try {
    before = await lstat(input.path);
  } catch (error) {
    if (isMissingV1(error)) return false;
    throw error;
  }
  if (before.isSymbolicLink() || !before.isFile() || before.nlink !== 1) {
    return false;
  }
  const transition = classifyProviderServiceAtomicStageMetadataForTestInternalV1({
    authorityUid: input.authorityUid,
    authorityGid: input.authorityGid,
    ownerUid: input.ownerUid,
    ownerGid: input.ownerGid,
    finalMode: input.finalMode,
    observedUid: before.uid,
    observedGid: before.gid,
    observedMode: exactModeV1(before.mode),
  });
  if (transition === "ready" || transition === "invalid") return false;

  let handle: FileHandle | undefined;
  try {
    handle = await open(
      input.path,
      constants.O_RDONLY |
        (typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0),
    );
    const opened = await handle.stat();
    assertProviderRuntimeNativeFdHasNoExtendedAccessControlV1(handle.fd, {
      expectedKind: "regular-file",
    });
    if (
      !opened.isFile() ||
      opened.dev !== before.dev ||
      opened.ino !== before.ino ||
      opened.nlink !== 1 ||
      opened.uid !== before.uid ||
      opened.gid !== before.gid ||
      exactModeV1(opened.mode) !== exactModeV1(before.mode) ||
      opened.size !== input.bytes.byteLength
    ) return false;
    const observedBytes = await handle.readFile();
    if (!observedBytes.equals(Buffer.from(input.bytes))) {
      if (transition === "complete_owner_then_mode") return false;
      throw new ProviderServiceInstallationLifecycleErrorV1(
        "path_conflict",
        "provider service publish staging transition content changed",
      );
    }
    // A cut after chown or chmod is classified and resumed above.  The
    // read-only descriptor is sufficient for fchown/fchmod even when the
    // service-owned intermediate is deliberately 0400.
    if (opened.uid !== input.ownerUid || opened.gid !== input.ownerGid) {
      await handle.chown(input.ownerUid, input.ownerGid);
    }
    if (exactModeV1(opened.mode) !== input.finalMode) {
      await handle.chmod(input.finalMode);
    }
    const transitioned = await handle.stat();
    if (
      !transitioned.isFile() ||
      transitioned.dev !== before.dev ||
      transitioned.ino !== before.ino ||
      transitioned.nlink !== 1 ||
      transitioned.uid !== input.ownerUid ||
      transitioned.gid !== input.ownerGid ||
      exactModeV1(transitioned.mode) !== input.finalMode ||
      transitioned.size !== input.bytes.byteLength
    ) {
      throw new ProviderServiceInstallationLifecycleErrorV1(
        "path_conflict",
        "provider service publish staging metadata did not converge",
      );
    }
    await handle.close();
    handle = await open(
      input.path,
      constants.O_RDWR |
        (typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0),
    );
    const completed = await handle.stat();
    if (
      completed.dev !== transitioned.dev ||
      completed.ino !== transitioned.ino ||
      completed.nlink !== 1 ||
      completed.uid !== input.ownerUid ||
      completed.gid !== input.ownerGid ||
      exactModeV1(completed.mode) !== input.finalMode ||
      completed.size !== input.bytes.byteLength
    ) {
      throw new ProviderServiceInstallationLifecycleErrorV1(
        "path_conflict",
        "provider service publish staging changed after metadata transition",
      );
    }
    await handle.sync();
    return true;
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function readAtomicStageTransitionCandidateV1(input: {
  readonly path: string;
  readonly authorityUid: number;
  readonly authorityGid: number;
  readonly ownerUid: number;
  readonly ownerGid: number;
  readonly finalMode: number;
  readonly maximumBytes: number;
}): Promise<FileObservationV1 | undefined> {
  let before: Awaited<ReturnType<typeof lstat>>;
  try {
    before = await lstat(input.path);
  } catch (error) {
    if (isMissingV1(error)) return undefined;
    throw error;
  }
  if (
    before.isSymbolicLink() ||
    !before.isFile() ||
    before.nlink !== 1 ||
    before.size < 1 ||
    before.size > input.maximumBytes
  ) return undefined;
  const transition = classifyProviderServiceAtomicStageMetadataForTestInternalV1({
    authorityUid: input.authorityUid,
    authorityGid: input.authorityGid,
    ownerUid: input.ownerUid,
    ownerGid: input.ownerGid,
    finalMode: input.finalMode,
    observedUid: before.uid,
    observedGid: before.gid,
    observedMode: exactModeV1(before.mode),
  });
  if (
    transition !== "complete_owner_then_mode" &&
    transition !== "complete_owner" &&
    transition !== "complete_mode"
  ) return undefined;
  let handle: FileHandle | undefined;
  try {
    handle = await open(
      input.path,
      constants.O_RDONLY |
        (typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0),
    );
    const opened = await handle.stat();
    assertProviderRuntimeNativeFdHasNoExtendedAccessControlV1(handle.fd, {
      expectedKind: "regular-file",
    });
    if (
      !opened.isFile() ||
      opened.dev !== before.dev ||
      opened.ino !== before.ino ||
      opened.nlink !== 1 ||
      opened.uid !== before.uid ||
      opened.gid !== before.gid ||
      exactModeV1(opened.mode) !== exactModeV1(before.mode) ||
      opened.size !== before.size
    ) return undefined;
    const bytes = await handle.readFile();
    const contentDigest = digestBytesV1(bytes);
    const after = await lstat(input.path);
    if (
      after.dev !== opened.dev ||
      after.ino !== opened.ino ||
      after.nlink !== 1 ||
      after.uid !== opened.uid ||
      after.gid !== opened.gid ||
      exactModeV1(after.mode) !== exactModeV1(opened.mode) ||
      after.size !== opened.size
    ) return undefined;
    return Object.freeze({
      bytes,
      contentDigest,
      mode: exactModeV1(opened.mode),
      uid: opened.uid,
      gid: opened.gid,
      dev: opened.dev,
      ino: opened.ino,
      nlink: opened.nlink,
    });
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function readPinnedAtomicStageTransitionV1(input: {
  readonly path: string;
  readonly expectedDigest: ContentDigestV1;
  readonly expectedByteLength: number;
  readonly authorityUid: number;
  readonly authorityGid: number;
  readonly ownerUid: number;
  readonly ownerGid: number;
  readonly finalMode: number;
  readonly maximumBytes: number;
}): Promise<FileObservationV1 | undefined> {
  const observation = await readAtomicStageTransitionCandidateV1(input);
  if (observation === undefined) return undefined;
  if (
    observation.bytes.byteLength !== input.expectedByteLength ||
    observation.contentDigest !== input.expectedDigest
  ) {
    throw new ProviderServiceInstallationLifecycleErrorV1(
      "installation_tampered",
      "provider service publish staging transition is not transaction-pinned",
    );
  }
  return observation;
}

async function atomicWriteOwnedFileV1(input: {
  readonly path: string;
  readonly bytes: Uint8Array;
  readonly mode: number;
  readonly ownerUid: number;
  readonly ownerGid: number;
  readonly parentUid: number;
  readonly parentGid: number;
  readonly replace: boolean;
}): Promise<void> {
  await checkedWritableParentV1(input.path, input.parentUid, input.parentGid);
  const staging = atomicPublishStagingPathV1(input.path);
  const authorityUid = process.geteuid?.() ?? input.parentUid;
  const authorityGid = process.getegid?.() ?? input.parentGid;
  await convergePinnedAtomicStageMetadataV1({
    path: staging,
    bytes: input.bytes,
    authorityUid,
    authorityGid,
    ownerUid: input.ownerUid,
    ownerGid: input.ownerGid,
    finalMode: input.mode,
  });
  await discardIncompleteAuthorityStageV1({
    path: staging,
    authorityUid,
    authorityGid,
    maximumBytes: Math.max(input.bytes.byteLength, MAX_CONTROL_JOURNAL_BYTES_V1),
  });
  const expectedDigest = digestBytesV1(input.bytes);
  const exactExpectedV1 = (observation: FileObservationV1): boolean =>
    observation.contentDigest === expectedDigest &&
    observation.bytes.byteLength === input.bytes.byteLength;
  const observeV1 = async (
    path: string,
    allowedLinkCounts: readonly number[],
  ): Promise<FileObservationV1 | undefined> => {
    try {
      return await readCheckedFileV1({
        path,
        uid: input.ownerUid,
        gid: input.ownerGid,
        mode: input.mode,
        maximumBytes: Math.max(
          input.bytes.byteLength,
          MAX_CONTROL_JOURNAL_BYTES_V1,
        ),
        allowedLinkCounts,
      });
    } catch (error) {
      if (isMissingV1(error)) return undefined;
      throw new ProviderServiceInstallationLifecycleErrorV1(
        "path_conflict",
        "provider service publish path is unsafe",
        { cause: error },
      );
    }
  };

  let staged = await observeV1(staging, [1, 2]);
  let target = await observeV1(input.path, [1, 2]);
  if (staged !== undefined) {
    if (!exactExpectedV1(staged)) {
      throw new ProviderServiceInstallationLifecycleErrorV1(
        "path_conflict",
        "provider service publish staging content changed",
      );
    }
    if (staged.nlink === 2) {
      if (
        target === undefined ||
        target.dev !== staged.dev ||
        target.ino !== staged.ino ||
        target.nlink !== 2 ||
        !exactExpectedV1(target)
      ) {
        throw new ProviderServiceInstallationLifecycleErrorV1(
          "path_conflict",
          "provider service publish hard-link pair is inconsistent",
        );
      }
      await unlinkAndSyncV1(staging);
      return;
    }
    if (target !== undefined) {
      if (!input.replace) {
        throw new ProviderServiceInstallationLifecycleErrorV1(
          "path_conflict",
          "provider service no-replace destination changed",
        );
      }
      if (target.nlink !== 1) {
        throw new ProviderServiceInstallationLifecycleErrorV1(
          "path_conflict",
          "provider service replace destination is multiply linked",
        );
      }
      await rename(staging, input.path);
      await syncDirectoryV1(dirname(input.path));
      return;
    }
    if (input.replace) {
      throw new ProviderServiceInstallationLifecycleErrorV1(
        "path_conflict",
        "provider service replace destination disappeared",
      );
    }
    await link(staging, input.path);
    await syncDirectoryV1(dirname(input.path));
    await unlink(staging);
    await syncDirectoryV1(dirname(input.path));
    return;
  }

  if (target !== undefined) {
    if (target.nlink !== 1) {
      throw new ProviderServiceInstallationLifecycleErrorV1(
        "path_conflict",
        "provider service destination has an unproven hard link",
      );
    }
    if (!input.replace) {
      throw new ProviderServiceInstallationLifecycleErrorV1(
        "path_conflict",
        "provider service owned path already exists",
      );
    }
    if (exactExpectedV1(target)) return;
  } else if (input.replace) {
    throw new ProviderServiceInstallationLifecycleErrorV1(
      "path_conflict",
      "provider service replace destination is missing",
    );
  }

  let handle: FileHandle | undefined;
  let stagingCreated = false;
  let stagingDurable = false;
  try {
    handle = await open(
      staging,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
      0o400,
    );
    stagingCreated = true;
    await handle.chmod(0o400);
    await handle.writeFile(input.bytes);
    // Content first becomes durable while the inode is still in the strict
    // authority-owned 0400 "incomplete" state.  Only then may it acquire the
    // final owner/mode and become publishable.
    await handle.sync();
    await handle.chown(input.ownerUid, input.ownerGid);
    await handle.chmod(input.mode);
    await handle.sync();
    stagingDurable = true;
    await handle.close();
    handle = undefined;
    if (input.replace) {
      await rename(staging, input.path);
    } else {
      // POSIX rename would silently replace a racing destination.  Linking the
      // fsynced same-directory inode gives an atomic no-clobber publish.
      await link(staging, input.path);
      await syncDirectoryV1(dirname(input.path));
      await unlink(staging);
    }
    await syncDirectoryV1(dirname(input.path));
  } catch (error) {
    await handle?.close().catch(() => undefined);
    if (stagingCreated && !stagingDurable) {
      await unlink(staging).catch(() => undefined);
      await syncDirectoryV1(dirname(staging)).catch(() => undefined);
    }
    if (error instanceof ProviderServiceInstallationLifecycleErrorV1) throw error;
    throw new ProviderServiceInstallationLifecycleErrorV1(
      "io_error",
      "provider service atomic owned-file write failed",
      { cause: error },
    );
  }
}

async function readExactPinnedAtomicStageIfPresentV1(input: {
  readonly path: string;
  readonly expectedDigest: ContentDigestV1;
  readonly expectedByteLength: number;
  readonly uid: number;
  readonly gid: number;
  readonly mode: number;
  readonly maximumBytes: number;
  readonly label: string;
  readonly authorityUid: number;
  readonly authorityGid: number;
}): Promise<FileObservationV1 | undefined> {
  let observation: FileObservationV1 | undefined;
  try {
    observation = await readCheckedFileV1({
      path: input.path,
      uid: input.uid,
      gid: input.gid,
      mode: input.mode,
      maximumBytes: input.maximumBytes,
      allowedLinkCounts: [1, 2],
    });
  } catch (error) {
    if (isMissingV1(error)) return undefined;
    try {
      observation = await readPinnedAtomicStageTransitionV1({
        path: input.path,
        expectedDigest: input.expectedDigest,
        expectedByteLength: input.expectedByteLength,
        authorityUid: input.authorityUid,
        authorityGid: input.authorityGid,
        ownerUid: input.uid,
        ownerGid: input.gid,
        finalMode: input.mode,
        maximumBytes: input.maximumBytes,
      });
    } catch (transitionError) {
      throw new ProviderServiceInstallationLifecycleErrorV1(
        "installation_tampered",
        `${input.label} staging transition is not transaction-pinned`,
        { cause: transitionError },
      );
    }
    if (observation === undefined) {
      throw new ProviderServiceInstallationLifecycleErrorV1(
        "installation_tampered",
        `${input.label} staging metadata is unsafe`,
        { cause: error },
      );
    }
  }
  if (
    observation.contentDigest !== input.expectedDigest ||
    observation.bytes.byteLength !== input.expectedByteLength
  ) {
    throw new ProviderServiceInstallationLifecycleErrorV1(
      "installation_tampered",
      `${input.label} staging content is not transaction-pinned`,
    );
  }
  return observation;
}

async function convergePinnedAtomicPublicationStageIfPresentV1(input: {
  readonly path: string;
  readonly bytes: Uint8Array;
  readonly uid: number;
  readonly gid: number;
  readonly mode: number;
  readonly maximumBytes: number;
  readonly label: string;
  readonly authorityUid: number;
  readonly authorityGid: number;
  readonly allowCreate: boolean;
  readonly expectedReplaceBaseline?: Readonly<{
    readonly contentDigest: ContentDigestV1;
    readonly byteLength: number;
  }>;
}): Promise<boolean> {
  const expectedDigest = digestBytesV1(input.bytes);
  const stagingPath = atomicPublishStagingPathV1(input.path);
  const staging = await readExactPinnedAtomicStageIfPresentV1({
    path: stagingPath,
    expectedDigest,
    expectedByteLength: input.bytes.byteLength,
    uid: input.uid,
    gid: input.gid,
    mode: input.mode,
    maximumBytes: input.maximumBytes,
    label: input.label,
    authorityUid: input.authorityUid,
    authorityGid: input.authorityGid,
  });
  if (staging === undefined) return false;

  let target: FileObservationV1 | undefined;
  try {
    target = await readCheckedFileV1({
      path: input.path,
      uid: input.uid,
      gid: input.gid,
      mode: input.mode,
      maximumBytes: input.maximumBytes,
    });
  } catch (error) {
    if (!isMissingV1(error)) {
      throw new ProviderServiceInstallationLifecycleErrorV1(
        "installation_tampered",
        `${input.label} canonical metadata is unsafe during recovery`,
        { cause: error },
      );
    }
  }

  if (staging.nlink === 2 || target?.nlink === 2) {
    if (
      target === undefined ||
      staging.nlink !== 2 ||
      target.nlink !== 2 ||
      staging.dev !== target.dev ||
      staging.ino !== target.ino ||
      target.contentDigest !== expectedDigest ||
      target.bytes.byteLength !== input.bytes.byteLength
    ) {
      throw new ProviderServiceInstallationLifecycleErrorV1(
        "installation_tampered",
        `${input.label} publish pair is not the pinned inode`,
      );
    }
  } else if (target === undefined) {
    if (!input.allowCreate) {
      throw new ProviderServiceInstallationLifecycleErrorV1(
        "installation_tampered",
        `${input.label} replacement baseline disappeared`,
      );
    }
  } else {
    const targetIsExpected = target.contentDigest === expectedDigest &&
      target.bytes.byteLength === input.bytes.byteLength;
    if (targetIsExpected) {
      throw new ProviderServiceInstallationLifecycleErrorV1(
        "installation_tampered",
        `${input.label} has independent canonical and staging inodes`,
      );
    }
    if (
      input.expectedReplaceBaseline === undefined ||
      target.contentDigest !== input.expectedReplaceBaseline.contentDigest ||
      target.bytes.byteLength !== input.expectedReplaceBaseline.byteLength
    ) {
      throw new ProviderServiceInstallationLifecycleErrorV1(
        "installation_tampered",
        `${input.label} replacement baseline is not transaction-pinned`,
      );
    }
  }

  await atomicWriteOwnedFileV1({
    path: input.path,
    bytes: input.bytes,
    mode: input.mode,
    ownerUid: input.uid,
    ownerGid: input.gid,
    parentUid: input.authorityUid,
    parentGid: input.authorityGid,
    replace: target !== undefined && staging.nlink === 1,
  });
  return true;
}

/** Test-only filesystem seam; unavailable from the runtime package index. */
export async function writeProviderServiceAtomicOwnedFileForTestInternalV1(
  capability: ProviderServiceInstallationPrivilegeCapabilityInternalV1,
  input: Readonly<{
    readonly path: string;
    readonly bytes: Uint8Array;
    readonly mode: number;
    readonly ownerUid: number;
    readonly ownerGid: number;
    readonly replace: boolean;
  }>,
): Promise<void> {
  const authority = requireProviderServiceInstallationPrivilegeInternalV1(
    capability,
  );
  await atomicWriteOwnedFileV1({
    ...input,
    parentUid: authority.authorityUid,
    parentGid: authority.authorityGid,
  });
}

async function readCheckedFileV1(input: {
  readonly path: string;
  readonly uid: number;
  readonly gid: number;
  readonly mode: number;
  readonly maximumBytes: number;
  readonly allowedLinkCounts?: readonly number[];
}): Promise<FileObservationV1> {
  let handle: FileHandle | undefined;
  try {
    const before = await lstat(input.path);
    const atomicPublishPair = input.allowedLinkCounts === undefined;
    const allowedLinkCounts = input.allowedLinkCounts ?? [1, 2];
    if (
      before.isSymbolicLink() ||
      !before.isFile() ||
      !allowedLinkCounts.includes(before.nlink)
    ) {
      throw new Error("unsafe file type");
    }
    handle = await open(
      input.path,
      constants.O_RDONLY |
        (typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0),
    );
    const opened = await handle.stat();
    assertProviderRuntimeNativeFdHasNoExtendedAccessControlV1(handle.fd, {
      expectedKind: "regular-file",
    });
    if (
      !opened.isFile() ||
      opened.dev !== before.dev ||
      opened.ino !== before.ino ||
      !allowedLinkCounts.includes(opened.nlink) ||
      opened.uid !== input.uid ||
      opened.gid !== input.gid ||
      exactModeV1(opened.mode) !== input.mode ||
      opened.size < 1 ||
      opened.size > input.maximumBytes
    ) throw new Error("file metadata mismatch");
    let publishedStaging: Awaited<ReturnType<typeof lstat>> | undefined;
    if (atomicPublishPair && opened.nlink === 2) {
      publishedStaging = await lstat(atomicPublishStagingPathV1(input.path));
      if (
        publishedStaging.isSymbolicLink() ||
        !publishedStaging.isFile() ||
        publishedStaging.dev !== opened.dev ||
        publishedStaging.ino !== opened.ino ||
        publishedStaging.nlink !== 2 ||
        publishedStaging.uid !== input.uid ||
        publishedStaging.gid !== input.gid ||
        exactModeV1(publishedStaging.mode) !== input.mode
      ) throw new Error("atomic publish pair is invalid");
    }
    const bytes = await handle.readFile();
    const after = await lstat(input.path);
    if (
      after.isSymbolicLink() ||
      !after.isFile() ||
      after.dev !== opened.dev ||
      after.ino !== opened.ino ||
      after.size !== opened.size ||
      after.uid !== input.uid ||
      after.gid !== input.gid ||
      !allowedLinkCounts.includes(after.nlink) ||
      exactModeV1(after.mode) !== input.mode ||
      bytes.byteLength !== opened.size
    ) throw new Error("file changed while reading");
    if (publishedStaging !== undefined) {
      const stagingAfter = await lstat(atomicPublishStagingPathV1(input.path));
      if (
        stagingAfter.dev !== publishedStaging.dev ||
        stagingAfter.ino !== publishedStaging.ino ||
        stagingAfter.nlink !== 2 ||
        stagingAfter.size !== publishedStaging.size ||
        stagingAfter.uid !== publishedStaging.uid ||
        stagingAfter.gid !== publishedStaging.gid ||
        exactModeV1(stagingAfter.mode) !== input.mode
      ) throw new Error("atomic publish pair changed while reading");
    }
    assertProviderRuntimeNativeFdHasNoExtendedAccessControlV1(handle.fd, {
      expectedKind: "regular-file",
    });
    return Object.freeze({
      bytes,
      contentDigest: digestBytesV1(bytes),
      mode: input.mode,
      uid: input.uid,
      gid: input.gid,
      dev: opened.dev,
      ino: opened.ino,
      nlink: opened.nlink,
    });
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

function managedArtifactV1(
  kind: ManagedArtifactKindV1,
  path: string,
  bytes: Uint8Array,
  mode: number,
  owner: ManagedArtifactOwnerV1,
): ManagedArtifactV1 {
  return Object.freeze({
    kind,
    path,
    contentDigest: digestBytesV1(bytes),
    byteLength: bytes.byteLength,
    mode,
    owner,
  });
}

function makeManifestV1(
  payload: ProviderServiceInstallationManifestPayloadV1,
): ProviderServiceInstallationManifestEnvelopeV1 {
  const frozenPayload = Object.freeze(payload);
  return Object.freeze({
    payload: frozenPayload,
    contentDigest: digestDomainV1(MANIFEST_DIGEST_DOMAIN_V1, frozenPayload),
  });
}

function makeRollbackV1(
  payload: ProviderServiceInstallationRollbackPayloadV1,
): ProviderServiceInstallationRollbackEnvelopeV1 {
  const frozenPayload = Object.freeze(payload);
  return Object.freeze({
    payload: frozenPayload,
    contentDigest: digestDomainV1(ROLLBACK_DIGEST_DOMAIN_V1, frozenPayload),
  });
}

function parseArtifactV1(value: unknown): ManagedArtifactV1 {
  if (
    !exactKeysV1(value, [
      "kind",
      "path",
      "contentDigest",
      "byteLength",
      "mode",
      "owner",
    ]) ||
    ![
      "service_config",
      "service_descriptor",
      "runtime_auth_key",
      "runtime_signing_key",
    ].includes(String(value.kind)) ||
    (value.owner !== "authority" && value.owner !== "service_principal") ||
    !Number.isSafeInteger(value.byteLength) ||
    (value.byteLength as number) < 1 ||
    !Number.isSafeInteger(value.mode) ||
    (value.mode as number) < 0 ||
    (value.mode as number) > 0o777
  ) throw new TypeError("managed artifact is invalid");
  return Object.freeze({
    kind: value.kind as ManagedArtifactKindV1,
    path: safeAbsolutePathV1(value.path as string, "managed artifact path"),
    contentDigest: ContentDigestV1Schema.parse(value.contentDigest),
    byteLength: value.byteLength as number,
    mode: value.mode as number,
    owner: value.owner,
  });
}

function parsePreviousV1(value: unknown): PreviousSnapshotPinV1 | null {
  if (value === null) return null;
  if (
    !exactKeysV1(value, [
      "path",
      "contentDigest",
      "fromManifestGeneration",
      "fromHandoffPayloadDigest",
    ]) ||
    value.path !== PROVIDER_SERVICE_INSTALLATION_ROLLBACK_FILE_V1 ||
    !Number.isSafeInteger(value.fromManifestGeneration) ||
    (value.fromManifestGeneration as number) < 1
  ) throw new TypeError("previous snapshot pin is invalid");
  return Object.freeze({
    path: PROVIDER_SERVICE_INSTALLATION_ROLLBACK_FILE_V1,
    contentDigest: ContentDigestV1Schema.parse(value.contentDigest),
    fromManifestGeneration: value.fromManifestGeneration as number,
    fromHandoffPayloadDigest: ContentDigestV1Schema.parse(
      value.fromHandoffPayloadDigest,
    ),
  });
}

function parseManifestValueV1(
  value: unknown,
): ProviderServiceInstallationManifestEnvelopeV1 {
  if (!exactKeysV1(value, ["payload", "contentDigest"])) {
    throw new TypeError("manifest envelope is invalid");
  }
  const payload = value.payload;
  if (
    !exactKeysV1(payload, [
      "schemaVersion",
      "profile",
      "installationRoot",
      "manifestGeneration",
      "platform",
      "serviceLabel",
      "providerId",
      "principal",
      "runtimeRoot",
      "installationIdentityDigest",
      "handoffPayloadDigest",
      "binaryDigest",
      "capabilityDigest",
      "servicePublicKey",
      "managedArtifacts",
      "ephemeralPaths",
      "retainedState",
      "previous",
    ]) ||
    payload.schemaVersion !== 1 ||
    payload.profile !== PROVIDER_SERVICE_INSTALLATION_MANIFEST_PROFILE_V1 ||
    !Number.isSafeInteger(payload.manifestGeneration) ||
    (payload.manifestGeneration as number) < 1 ||
    (payload.platform !== "darwin" && payload.platform !== "linux") ||
    typeof payload.serviceLabel !== "string" ||
    typeof payload.providerId !== "string" ||
    !Array.isArray(payload.managedArtifacts) ||
    payload.managedArtifacts.length !== 4 ||
    !exactKeysV1(payload.principal, ["kind", "name", "uid", "gid"]) ||
    payload.principal.kind !== "dedicated_os_principal" ||
    typeof payload.principal.name !== "string" ||
    !Number.isSafeInteger(payload.principal.uid) ||
    !Number.isSafeInteger(payload.principal.gid) ||
    !exactKeysV1(payload.ephemeralPaths, ["socketPath", "readinessPath"]) ||
    !exactKeysV1(payload.retainedState, [
      "runtimeRoot",
      "installationIdentityKeyPath",
    ]) ||
    (payload.retainedState.installationIdentityKeyPath !== null &&
      typeof payload.retainedState.installationIdentityKeyPath !== "string")
  ) throw new TypeError("manifest payload is invalid");
  const artifacts = payload.managedArtifacts.map(parseArtifactV1);
  const expectedKinds: readonly ManagedArtifactKindV1[] = [
    "service_config",
    "service_descriptor",
    "runtime_auth_key",
    "runtime_signing_key",
  ];
  if (!expectedKinds.every((kind, index) => artifacts[index]?.kind === kind)) {
    throw new TypeError("manifest artifact inventory is invalid");
  }
  const parsedPayload: ProviderServiceInstallationManifestPayloadV1 = Object.freeze({
    schemaVersion: 1,
    profile: PROVIDER_SERVICE_INSTALLATION_MANIFEST_PROFILE_V1,
    installationRoot: safeAbsolutePathV1(
      payload.installationRoot as string,
      "manifest installationRoot",
    ),
    manifestGeneration: payload.manifestGeneration as number,
    platform: payload.platform,
    serviceLabel: payload.serviceLabel,
    providerId: payload.providerId,
    principal: Object.freeze({
      kind: "dedicated_os_principal" as const,
      name: payload.principal.name,
      uid: payload.principal.uid as number,
      gid: payload.principal.gid as number,
    }),
    runtimeRoot: safeAbsolutePathV1(
      payload.runtimeRoot as string,
      "manifest runtimeRoot",
    ),
    installationIdentityDigest: ContentDigestV1Schema.parse(
      payload.installationIdentityDigest,
    ),
    handoffPayloadDigest: ContentDigestV1Schema.parse(
      payload.handoffPayloadDigest,
    ),
    binaryDigest: ContentDigestV1Schema.parse(payload.binaryDigest),
    capabilityDigest: ContentDigestV1Schema.parse(payload.capabilityDigest),
    servicePublicKey: CanonicalByteStringV1Schema.parse(
      payload.servicePublicKey,
    ) as `base64url:${string}`,
    managedArtifacts: Object.freeze(artifacts),
    ephemeralPaths: Object.freeze({
      socketPath: safeAbsolutePathV1(
        payload.ephemeralPaths.socketPath as string,
        "manifest socketPath",
      ),
      readinessPath: safeAbsolutePathV1(
        payload.ephemeralPaths.readinessPath as string,
        "manifest readinessPath",
      ),
    }),
    retainedState: Object.freeze({
      runtimeRoot: safeAbsolutePathV1(
        payload.retainedState.runtimeRoot as string,
        "manifest retained runtimeRoot",
      ),
      installationIdentityKeyPath:
        payload.retainedState.installationIdentityKeyPath === null
          ? null
          : safeAbsolutePathV1(
              payload.retainedState.installationIdentityKeyPath,
              "manifest retained identity key",
            ),
    }),
    previous: parsePreviousV1(payload.previous),
  });
  const contentDigest = ContentDigestV1Schema.parse(value.contentDigest);
  if (contentDigest !== digestDomainV1(MANIFEST_DIGEST_DOMAIN_V1, parsedPayload)) {
    throw new TypeError("manifest content digest is invalid");
  }
  return Object.freeze({ payload: parsedPayload, contentDigest });
}

function parseRollbackValueV1(
  value: unknown,
): ProviderServiceInstallationRollbackEnvelopeV1 {
  if (!exactKeysV1(value, ["payload", "contentDigest"])) {
    throw new TypeError("rollback envelope is invalid");
  }
  const payload = value.payload;
  if (
    !exactKeysV1(payload, [
      "schemaVersion",
      "profile",
      "installationRoot",
      "fromManifest",
      "files",
    ]) ||
    payload.schemaVersion !== 1 ||
    payload.profile !== PROVIDER_SERVICE_INSTALLATION_ROLLBACK_PROFILE_V1 ||
    !Array.isArray(payload.files) ||
    payload.files.length !== 2
  ) throw new TypeError("rollback payload is invalid");
  const fromManifest = parseManifestValueV1(payload.fromManifest);
  if (fromManifest.payload.previous !== null) {
    throw new TypeError("rollback snapshot must be single-level");
  }
  const files = payload.files.map((item): RollbackFileV1 => {
    if (
      !exactKeysV1(item, [
        "kind",
        "path",
        "contentDigest",
        "mode",
        "bytes",
      ]) ||
      (item.kind !== "service_config" && item.kind !== "service_descriptor") ||
      !Number.isSafeInteger(item.mode) ||
      (item.mode as number) < 0 ||
      (item.mode as number) > 0o777
    ) throw new TypeError("rollback file is invalid");
    const bytes = decodeBytesV1(item.bytes);
    const contentDigest = ContentDigestV1Schema.parse(item.contentDigest);
    if (digestBytesV1(bytes) !== contentDigest) {
      throw new TypeError("rollback file digest is invalid");
    }
    return Object.freeze({
      kind: item.kind,
      path: safeAbsolutePathV1(item.path as string, "rollback file path"),
      contentDigest,
      mode: item.mode as number,
      bytes: encodeBytesV1(bytes),
    });
  });
  if (
    files[0]?.kind !== "service_config" ||
    files[1]?.kind !== "service_descriptor"
  ) throw new TypeError("rollback file inventory is invalid");
  const parsedPayload: ProviderServiceInstallationRollbackPayloadV1 = Object.freeze({
    schemaVersion: 1,
    profile: PROVIDER_SERVICE_INSTALLATION_ROLLBACK_PROFILE_V1,
    installationRoot: safeAbsolutePathV1(
      payload.installationRoot as string,
      "rollback installationRoot",
    ),
    fromManifest,
    files: Object.freeze(files),
  });
  const contentDigest = ContentDigestV1Schema.parse(value.contentDigest);
  if (contentDigest !== digestDomainV1(ROLLBACK_DIGEST_DOMAIN_V1, parsedPayload)) {
    throw new TypeError("rollback content digest is invalid");
  }
  return Object.freeze({ payload: parsedPayload, contentDigest });
}

function parseCanonicalFileV1(bytes: Uint8Array, maximumBytes: number): unknown {
  if (bytes.byteLength < 2 || bytes.byteLength > maximumBytes) {
    throw new TypeError("canonical file size is invalid");
  }
  const serialized = Buffer.from(bytes).toString("utf8");
  if (!serialized.endsWith("\n") || serialized.indexOf("\n") !== serialized.length - 1) {
    throw new TypeError("canonical file must contain one line");
  }
  const value = JSON.parse(serialized.slice(0, -1)) as unknown;
  if (`${canonicalizeJcsSafeIntegerV1(value)}\n` !== serialized) {
    throw new TypeError("file JSON is not canonical");
  }
  return value;
}

async function readManifestV1(
  root: string,
  authority: AuthorityStateV1,
): Promise<ProviderServiceInstallationManifestEnvelopeV1 | undefined> {
  const path = manifestPathV1(root);
  let observation: FileObservationV1;
  try {
    observation = await readCheckedFileV1({
      path,
      uid: authority.authorityUid,
      gid: authority.authorityGid,
      mode: 0o600,
      maximumBytes: MAX_MANIFEST_BYTES_V1,
    });
  } catch (error) {
    if (isMissingV1(error) || isMissingV1((error as { cause?: unknown }).cause)) {
      return undefined;
    }
    throw new ProviderServiceInstallationLifecycleErrorV1(
      "manifest_invalid",
      "provider service installation manifest is unavailable or unsafe",
      { cause: error },
    );
  }
  try {
    return parseManifestValueV1(
      parseCanonicalFileV1(observation.bytes, MAX_MANIFEST_BYTES_V1),
    );
  } catch (error) {
    throw new ProviderServiceInstallationLifecycleErrorV1(
      "manifest_invalid",
      "provider service installation manifest is invalid",
      { cause: error },
    );
  }
}

async function readRollbackV1(
  root: string,
  authority: AuthorityStateV1,
): Promise<ProviderServiceInstallationRollbackEnvelopeV1 | undefined> {
  const path = rollbackPathV1(root);
  let observation: FileObservationV1;
  try {
    observation = await readCheckedFileV1({
      path,
      uid: authority.authorityUid,
      gid: authority.authorityGid,
      mode: 0o600,
      maximumBytes: MAX_ROLLBACK_BYTES_V1,
    });
  } catch (error) {
    if (isMissingV1(error) || isMissingV1((error as { cause?: unknown }).cause)) {
      return undefined;
    }
    throw new ProviderServiceInstallationLifecycleErrorV1(
      "manifest_invalid",
      "provider service rollback snapshot is unavailable or unsafe",
      { cause: error },
    );
  }
  try {
    return parseRollbackValueV1(
      parseCanonicalFileV1(observation.bytes, MAX_ROLLBACK_BYTES_V1),
    );
  } catch (error) {
    throw new ProviderServiceInstallationLifecycleErrorV1(
      "manifest_invalid",
      "provider service rollback snapshot is invalid",
      { cause: error },
    );
  }
}

interface RollbackPublicationCandidateV1 {
  readonly snapshot: ProviderServiceInstallationRollbackEnvelopeV1;
  readonly observation: FileObservationV1;
}

async function readRollbackPublicationCandidateV1(
  path: string,
  authority: AuthorityStateV1,
  staged: boolean,
): Promise<RollbackPublicationCandidateV1 | undefined> {
  let observation: FileObservationV1 | undefined;
  try {
    observation = await readCheckedFileV1({
      path,
      uid: authority.authorityUid,
      gid: authority.authorityGid,
      mode: 0o600,
      maximumBytes: MAX_ROLLBACK_BYTES_V1,
      ...(staged ? { allowedLinkCounts: [1, 2] } : {}),
    });
  } catch (error) {
    if (isMissingV1(error) || isMissingV1((error as { cause?: unknown }).cause)) {
      return undefined;
    }
    if (staged) {
      observation = await readAtomicStageTransitionCandidateV1({
        path,
        authorityUid: authority.authorityUid,
        authorityGid: authority.authorityGid,
        ownerUid: authority.authorityUid,
        ownerGid: authority.authorityGid,
        finalMode: 0o600,
        maximumBytes: MAX_ROLLBACK_BYTES_V1,
      });
    }
    if (observation === undefined) {
      throw new ProviderServiceInstallationLifecycleErrorV1(
        "manifest_invalid",
        "provider service rollback publication is unavailable or unsafe",
        { cause: error },
      );
    }
  }
  try {
    const snapshot = parseRollbackValueV1(
      parseCanonicalFileV1(observation.bytes, MAX_ROLLBACK_BYTES_V1),
    );
    return Object.freeze({ snapshot, observation });
  } catch (error) {
    throw new ProviderServiceInstallationLifecycleErrorV1(
      "manifest_invalid",
      "provider service rollback publication is invalid",
      { cause: error },
    );
  }
}

function makeControlJournalV1(
  payload: ProviderServiceInstallationControlJournalPayloadV1,
): ProviderServiceInstallationControlJournalEnvelopeV1 {
  const frozenPayload = Object.freeze(payload);
  return Object.freeze({
    payload: frozenPayload,
    contentDigest: digestDomainV1(
      CONTROL_JOURNAL_DIGEST_DOMAIN_V1,
      frozenPayload,
    ),
  });
}

function parseNullableManifestV1(
  value: unknown,
): ProviderServiceInstallationManifestEnvelopeV1 | null {
  return value === null ? null : parseManifestValueV1(value);
}

function parseNullableRollbackV1(
  value: unknown,
): ProviderServiceInstallationRollbackEnvelopeV1 | null {
  return value === null ? null : parseRollbackValueV1(value);
}

function parseControlJournalValueV1(
  value: unknown,
): ProviderServiceInstallationControlJournalEnvelopeV1 {
  if (!exactKeysV1(value, ["payload", "contentDigest"])) {
    throw new TypeError("control journal envelope is invalid");
  }
  const payload = value.payload;
  if (
    !exactKeysV1(payload, [
      "schemaVersion",
      "profile",
      "installationRoot",
      "operation",
      "phase",
      "sourceManifest",
      "targetManifest",
      "rollbackContentDigest",
      "rollbackSnapshot",
      "installationIdentityKeyDigest",
      "installationIdentityDisposition",
      "createdRuntimeRoot",
      "runtimeRootCreationNonce",
      "runtimeRootCustodyPin",
    ]) ||
    payload.schemaVersion !== 1 ||
    payload.profile !==
      PROVIDER_SERVICE_INSTALLATION_CONTROL_JOURNAL_PROFILE_V1 ||
    !["install", "upgrade", "uninstall"].includes(
      String(payload.operation),
    ) ||
    ![
      "files_pending",
      "control_invoked",
      "control_confirmed",
      "compensation_confirmed",
    ].includes(String(payload.phase)) ||
    typeof payload.createdRuntimeRoot !== "boolean"
  ) throw new TypeError("control journal payload is invalid");
  const installationRoot = safeAbsolutePathV1(
    payload.installationRoot as string,
    "control journal installationRoot",
  );
  const sourceManifest = parseNullableManifestV1(payload.sourceManifest);
  const targetManifest = parseNullableManifestV1(payload.targetManifest);
  const rollbackContentDigest = payload.rollbackContentDigest === null
    ? null
    : ContentDigestV1Schema.parse(payload.rollbackContentDigest);
  const rollbackSnapshot = parseNullableRollbackV1(payload.rollbackSnapshot);
  const installationIdentityKeyDigest =
    payload.installationIdentityKeyDigest === null
      ? null
      : ContentDigestV1Schema.parse(payload.installationIdentityKeyDigest);
  const installationIdentityDisposition = payload.installationIdentityDisposition;
  if (
    installationIdentityDisposition !== null &&
    installationIdentityDisposition !== "create" &&
    installationIdentityDisposition !== "reuse"
  ) throw new TypeError("control journal Identity disposition is invalid");
  const runtimeRootCreationNonce = payload.runtimeRootCreationNonce === null
    ? null
    : CanonicalByteStringV1Schema.parse(
      payload.runtimeRootCreationNonce,
    ) as `base64url:${string}`;
  if (
    runtimeRootCreationNonce !== null &&
    decodeBytesV1(runtimeRootCreationNonce).byteLength !== 16
  ) throw new TypeError("control journal runtime root nonce is invalid");
  const runtimeRootCustodyPin = payload.runtimeRootCustodyPin;
  if (
    runtimeRootCustodyPin !== null &&
    (!exactKeysV1(runtimeRootCustodyPin, ["dev", "ino"]) ||
      !Number.isSafeInteger(runtimeRootCustodyPin.dev) ||
      (runtimeRootCustodyPin.dev as number) < 0 ||
      !Number.isSafeInteger(runtimeRootCustodyPin.ino) ||
      (runtimeRootCustodyPin.ino as number) < 0)
  ) throw new TypeError("control journal runtime root custody pin is invalid");
  const operation = payload.operation as
    ProviderServiceInstallationControlOperationV1;
  const phase = payload.phase as ProviderServiceInstallationControlPhaseV1;
  if (
    sourceManifest?.payload.installationRoot !== undefined &&
    sourceManifest.payload.installationRoot !== installationRoot
  ) throw new TypeError("control journal source root is invalid");
  if (
    targetManifest?.payload.installationRoot !== undefined &&
    targetManifest.payload.installationRoot !== installationRoot
  ) throw new TypeError("control journal target root is invalid");
  if (
    (operation === "install" && (
      sourceManifest !== null ||
      targetManifest === null ||
      rollbackContentDigest !== null ||
      rollbackSnapshot !== null ||
      (!payload.createdRuntimeRoot && runtimeRootCustodyPin === null) ||
      (phase !== "files_pending" && runtimeRootCustodyPin === null) ||
      (phase === "compensation_confirmed" && targetManifest === null)
    )) ||
    (operation === "upgrade" && (
      sourceManifest === null ||
      targetManifest === null ||
      rollbackContentDigest === null ||
      rollbackSnapshot === null ||
      installationIdentityKeyDigest !== null ||
      installationIdentityDisposition !== null ||
      payload.createdRuntimeRoot ||
      runtimeRootCreationNonce !== null ||
      runtimeRootCustodyPin !== null ||
      phase === "compensation_confirmed"
    )) ||
    (operation === "uninstall" && (
      sourceManifest === null ||
      targetManifest !== null ||
      rollbackSnapshot !== null ||
      installationIdentityKeyDigest !== null ||
      installationIdentityDisposition !== null ||
      payload.createdRuntimeRoot ||
      runtimeRootCreationNonce !== null ||
      runtimeRootCustodyPin === null ||
      phase === "compensation_confirmed"
    ))
  ) throw new TypeError("control journal operation tuple is invalid");
  if (payload.createdRuntimeRoot !== (runtimeRootCreationNonce !== null)) {
    throw new TypeError("control journal runtime root creation tuple is invalid");
  }
  if (
    operation === "install" &&
    ((targetManifest?.payload.retainedState.installationIdentityKeyPath === null) !==
      (installationIdentityKeyDigest === null) ||
      (installationIdentityKeyDigest === null) !==
        (installationIdentityDisposition === null))
  ) throw new TypeError("control journal Identity tuple is invalid");
  if (
    (operation === "install" && (
      targetManifest!.payload.manifestGeneration !== 1 ||
      targetManifest!.payload.previous !== null
    )) ||
    (operation === "upgrade" && (
      targetManifest!.payload.manifestGeneration !==
        sourceManifest!.payload.manifestGeneration + 1 ||
      !manifestsKeepUpgradeIdentityV1(
        sourceManifest!.payload,
        targetManifest!.payload,
      ) ||
      targetManifest!.payload.previous?.contentDigest !==
        rollbackContentDigest ||
      rollbackSnapshot!.contentDigest !== rollbackContentDigest ||
      rollbackSnapshot!.payload.installationRoot !== installationRoot ||
      rollbackSnapshot!.payload.fromManifest.contentDigest !==
        makeManifestV1(Object.freeze({
          ...sourceManifest!.payload,
          previous: null,
        })).contentDigest ||
      rollbackSnapshot!.payload.files[0]?.path !==
        sourceManifest!.payload.managedArtifacts[0]?.path ||
      rollbackSnapshot!.payload.files[0]?.contentDigest !==
        sourceManifest!.payload.managedArtifacts[0]?.contentDigest ||
      rollbackSnapshot!.payload.files[0]?.mode !==
        sourceManifest!.payload.managedArtifacts[0]?.mode ||
      rollbackSnapshot!.payload.files[1]?.path !==
        sourceManifest!.payload.managedArtifacts[1]?.path ||
      rollbackSnapshot!.payload.files[1]?.contentDigest !==
        sourceManifest!.payload.managedArtifacts[1]?.contentDigest ||
      rollbackSnapshot!.payload.files[1]?.mode !==
        sourceManifest!.payload.managedArtifacts[1]?.mode ||
      targetManifest!.payload.previous.fromManifestGeneration !==
        sourceManifest!.payload.manifestGeneration ||
      targetManifest!.payload.previous.fromHandoffPayloadDigest !==
        sourceManifest!.payload.handoffPayloadDigest
    )) ||
    (operation === "uninstall" &&
      rollbackContentDigest !==
        (sourceManifest!.payload.previous?.contentDigest ?? null))
  ) throw new TypeError("control journal manifest binding is invalid");
  const parsedPayload: ProviderServiceInstallationControlJournalPayloadV1 =
    Object.freeze({
      schemaVersion: 1,
      profile: PROVIDER_SERVICE_INSTALLATION_CONTROL_JOURNAL_PROFILE_V1,
      installationRoot,
      operation,
      phase,
      sourceManifest,
      targetManifest,
      rollbackContentDigest,
      rollbackSnapshot,
      installationIdentityKeyDigest,
      installationIdentityDisposition,
      createdRuntimeRoot: payload.createdRuntimeRoot,
      runtimeRootCreationNonce,
      runtimeRootCustodyPin: runtimeRootCustodyPin === null
        ? null
        : Object.freeze({
          dev: runtimeRootCustodyPin.dev as number,
          ino: runtimeRootCustodyPin.ino as number,
        }),
    });
  const contentDigest = ContentDigestV1Schema.parse(value.contentDigest);
  if (
    contentDigest !== digestDomainV1(
      CONTROL_JOURNAL_DIGEST_DOMAIN_V1,
      parsedPayload,
    )
  ) throw new TypeError("control journal digest is invalid");
  return Object.freeze({ payload: parsedPayload, contentDigest });
}

async function readControlJournalCandidateV1(
  path: string,
  authority: AuthorityStateV1,
  staged: boolean,
): Promise<Readonly<{
  readonly journal: ProviderServiceInstallationControlJournalEnvelopeV1;
  readonly observation: FileObservationV1;
}> | undefined> {
  let observation: FileObservationV1;
  try {
    observation = await readCheckedFileV1({
      path,
      uid: authority.authorityUid,
      gid: authority.authorityGid,
      mode: 0o600,
      maximumBytes: MAX_CONTROL_JOURNAL_BYTES_V1,
      ...(staged ? { allowedLinkCounts: [1, 2] } : {}),
    });
  } catch (error) {
    if (isMissingV1(error) || isMissingV1((error as { cause?: unknown }).cause)) {
      return undefined;
    }
    throw new ProviderServiceInstallationLifecycleErrorV1(
      "manifest_invalid",
      "provider service control journal is unavailable or unsafe",
      { cause: error },
    );
  }
  try {
    const journal = parseControlJournalValueV1(
      parseCanonicalFileV1(
        observation.bytes,
        MAX_CONTROL_JOURNAL_BYTES_V1,
      ),
    );
    return Object.freeze({ journal, observation });
  } catch (error) {
    throw new ProviderServiceInstallationLifecycleErrorV1(
      "manifest_invalid",
      "provider service control journal is invalid",
      { cause: error },
    );
  }
}

function sameControlJournalTransactionV1(
  left: ProviderServiceInstallationControlJournalEnvelopeV1,
  right: ProviderServiceInstallationControlJournalEnvelopeV1,
): boolean {
  return canonicalizeJcsSafeIntegerV1({ ...left.payload, phase: null }) ===
    canonicalizeJcsSafeIntegerV1({ ...right.payload, phase: null });
}

function validInstallRuntimeRootPinAdvanceV1(
  previous: ProviderServiceInstallationControlJournalEnvelopeV1,
  next: ProviderServiceInstallationControlJournalEnvelopeV1,
): boolean {
  if (
    previous.payload.operation !== "install" ||
    next.payload.operation !== "install" ||
    previous.payload.phase !== "files_pending" ||
    next.payload.phase !== "files_pending" ||
    previous.payload.runtimeRootCustodyPin !== null ||
    next.payload.runtimeRootCustodyPin === null
  ) return false;
  return canonicalizeJcsSafeIntegerV1({
    ...previous.payload,
    runtimeRootCustodyPin: null,
  }) === canonicalizeJcsSafeIntegerV1({
    ...next.payload,
    runtimeRootCustodyPin: null,
  });
}

function validControlJournalPhaseAdvanceV1(
  previous: ProviderServiceInstallationControlPhaseV1,
  next: ProviderServiceInstallationControlPhaseV1,
): boolean {
  return (previous === "files_pending" && next === "control_invoked") ||
    (previous === "control_invoked" && (
      next === "control_confirmed" ||
      next === "compensation_confirmed"
    ));
}

async function readControlJournalV1(
  root: string,
  authority: AuthorityStateV1,
  convergePublication = false,
): Promise<ProviderServiceInstallationControlJournalEnvelopeV1 | undefined> {
  const canonicalPath = controlJournalPathV1(root);
  const stagingPath = atomicPublishStagingPathV1(canonicalPath);
  await discardIncompleteAuthorityStageV1({
    path: stagingPath,
    authorityUid: authority.authorityUid,
    authorityGid: authority.authorityGid,
    maximumBytes: MAX_CONTROL_JOURNAL_BYTES_V1,
  });
  const canonical = await readControlJournalCandidateV1(
    canonicalPath,
    authority,
    false,
  );
  const staged = await readControlJournalCandidateV1(
    stagingPath,
    authority,
    true,
  );
  if (staged === undefined) return canonical?.journal;
  if (staged.observation.nlink === 2) {
    if (
      canonical === undefined ||
      canonical.observation.dev !== staged.observation.dev ||
      canonical.observation.ino !== staged.observation.ino ||
      canonical.journal.contentDigest !== staged.journal.contentDigest
    ) {
      throw new ProviderServiceInstallationLifecycleErrorV1(
        "manifest_invalid",
        "provider service control journal publish pair is invalid",
      );
    }
  } else if (canonical === undefined) {
    if (staged.journal.payload.phase !== "files_pending") {
      throw new ProviderServiceInstallationLifecycleErrorV1(
        "manifest_invalid",
        "provider service staged control journal has no baseline",
      );
    }
  } else if (!(
    (sameControlJournalTransactionV1(canonical.journal, staged.journal) &&
      validControlJournalPhaseAdvanceV1(
        canonical.journal.payload.phase,
        staged.journal.payload.phase,
      )) ||
    validInstallRuntimeRootPinAdvanceV1(
      canonical.journal,
      staged.journal,
    )
  )) {
    throw new ProviderServiceInstallationLifecycleErrorV1(
      "manifest_invalid",
      "provider service staged control journal transition is invalid",
    );
  }
  if (convergePublication) {
    await atomicWriteOwnedFileV1({
      path: canonicalPath,
      bytes: staged.observation.bytes,
      mode: 0o600,
      ownerUid: authority.authorityUid,
      ownerGid: authority.authorityGid,
      parentUid: authority.authorityUid,
      parentGid: authority.authorityGid,
      replace: canonical !== undefined && staged.observation.nlink === 1,
    });
  }
  return staged.journal;
}

async function writeControlJournalV1(
  root: string,
  authority: AuthorityStateV1,
  journal: ProviderServiceInstallationControlJournalEnvelopeV1,
  replace: boolean,
): Promise<void> {
  await atomicWriteOwnedFileV1({
    path: controlJournalPathV1(root),
    bytes: canonicalFileV1(journal),
    mode: 0o600,
    ownerUid: authority.authorityUid,
    ownerGid: authority.authorityGid,
    parentUid: authority.authorityUid,
    parentGid: authority.authorityGid,
    replace,
  });
}

async function advanceControlJournalV1(
  root: string,
  authority: AuthorityStateV1,
  journal: ProviderServiceInstallationControlJournalEnvelopeV1,
  phase: ProviderServiceInstallationControlPhaseV1,
): Promise<ProviderServiceInstallationControlJournalEnvelopeV1> {
  const next = makeControlJournalV1(Object.freeze({
    ...journal.payload,
    phase,
  }));
  await writeControlJournalV1(root, authority, next, true);
  return next;
}

async function removeControlJournalV1(
  root: string,
  authority: AuthorityStateV1,
): Promise<void> {
  const journal = await readControlJournalV1(root, authority, true);
  if (journal === undefined) return;
  const bytes = canonicalFileV1(journal);
  await removeExactAtomicPublicationIfPresentV1({
    path: controlJournalPathV1(root),
    expectedDigest: digestBytesV1(bytes),
    expectedByteLength: bytes.byteLength,
    uid: authority.authorityUid,
    gid: authority.authorityGid,
    mode: 0o600,
    maximumBytes: MAX_CONTROL_JOURNAL_BYTES_V1,
    label: "provider service control journal",
    authorityUid: authority.authorityUid,
    authorityGid: authority.authorityGid,
  });
}

function commonResultV1(root: string, runtimeRoot: string): ProviderServiceInstallationResultBaseV1 {
  return {
    authority: "read_only",
    strongWrites: "locked",
    installationRoot: root,
    manifestPath: manifestPathV1(root),
    runtimeRoot,
  };
}

function ownerForArtifactV1(
  artifact: ManagedArtifactV1,
  manifest: ProviderServiceInstallationManifestPayloadV1,
  authority: AuthorityStateV1,
): { readonly uid: number; readonly gid: number } {
  return artifact.owner === "authority"
    ? { uid: authority.authorityUid, gid: authority.authorityGid }
    : { uid: manifest.principal.uid, gid: manifest.principal.gid };
}

async function checkManagedArtifactParentV1(
  artifact: ManagedArtifactV1,
  authority: AuthorityStateV1,
): Promise<void> {
  if (artifact.owner === "authority") {
    await checkedWritableParentV1(
      artifact.path,
      authority.authorityUid,
      authority.authorityGid,
    );
  }
}

function maximumForKindV1(kind: ManagedArtifactKindV1): number {
  if (kind === "service_config") return MAX_CONFIG_BYTES_V1;
  if (kind === "service_descriptor") return MAX_DESCRIPTOR_BYTES_V1;
  return MAX_KEY_BYTES_V1;
}

async function validateIdentityKeyV1(
  config: ProviderServiceHandoffConfigV1,
  bytes: Uint8Array,
): Promise<void> {
  const custody = config.payload.installationIdentityCustody;
  if (custody === undefined || bytes.byteLength !== 32) {
    throw new ProviderServiceInstallationLifecycleErrorV1(
      "installation_tampered",
      "Installation Identity custody is unavailable",
    );
  }
  const copy = Buffer.from(bytes);
  try {
    await mintProviderServiceInstallationIdentityVerificationCapabilityInternalV1({
      installationIdentityKey: copy,
      initializationNonce: custody.initializationNonce,
      installationIdentityGenerationId: custody.installationIdentityGenerationId,
      keyCheckToken: custody.keyCheckToken,
    });
  } catch (error) {
    throw new ProviderServiceInstallationLifecycleErrorV1(
      "installation_tampered",
      "Installation Identity custody tuple is invalid",
      { cause: error },
    );
  } finally {
    copy.fill(0);
  }
}

async function installationIdentityDispositionV1(
  config: ProviderServiceHandoffConfigV1,
  bytes: Uint8Array,
): Promise<"create" | "reuse"> {
  const custody = config.payload.installationIdentityCustody;
  if (custody === undefined) {
    throw new ProviderServiceInstallationLifecycleErrorV1(
      "invalid_target",
      "Installation Identity custody is not configured",
    );
  }
  let observed: FileObservationV1;
  try {
    observed = await readCheckedFileV1({
      path: custody.keyPath,
      uid: config.payload.principal.uid,
      gid: config.payload.principal.gid,
      mode: 0o600,
      maximumBytes: 32,
    });
  } catch (error) {
    if (isMissingV1(error)) return "create";
    throw new ProviderServiceInstallationLifecycleErrorV1(
      "path_conflict",
      "retained Installation Identity custody is unsafe",
      { cause: error },
    );
  }
  if (
    observed.bytes.byteLength !== bytes.byteLength ||
    !Buffer.from(observed.bytes).equals(Buffer.from(bytes))
  ) {
    throw new ProviderServiceInstallationLifecycleErrorV1(
      "installation_tampered",
      "retained Installation Identity custody does not match the signed config",
    );
  }
  await validateIdentityKeyV1(config, observed.bytes);
  const stagingPath = atomicPublishStagingPathV1(custody.keyPath);
  if (await pathExistsV1(stagingPath)) {
    if (observed.nlink !== 2) {
      throw new ProviderServiceInstallationLifecycleErrorV1(
        "path_conflict",
        "retained Installation Identity has an independent publish staging inode",
      );
    }
  }
  return "reuse";
}

async function convergeRetainedInstallationIdentityUnderCustodyV1(
  config: ProviderServiceHandoffConfigV1,
  bytes: Uint8Array,
  authority: AuthorityStateV1,
): Promise<void> {
  const custody = config.payload.installationIdentityCustody;
  if (
    custody === undefined ||
    await installationIdentityDispositionV1(config, bytes) !== "reuse"
  ) {
    throw new ProviderServiceInstallationLifecycleErrorV1(
      "installation_tampered",
      "retained Installation Identity changed before install custody",
    );
  }
  const stagingPath = atomicPublishStagingPathV1(custody.keyPath);
  if (await pathExistsV1(stagingPath)) {
    await atomicWriteOwnedFileV1({
      path: custody.keyPath,
      bytes,
      mode: 0o600,
      ownerUid: config.payload.principal.uid,
      ownerGid: config.payload.principal.gid,
      parentUid: authority.authorityUid,
      parentGid: authority.authorityGid,
      replace: false,
    });
  }
  if (
    await installationIdentityDispositionV1(config, bytes) !== "reuse" ||
    await pathExistsV1(stagingPath)
  ) {
    throw new ProviderServiceInstallationLifecycleErrorV1(
      "installation_tampered",
      "retained Installation Identity did not converge exactly",
    );
  }
}

function configMatchesManifestV1(
  config: ProviderServiceHandoffConfigV1,
  manifest: ProviderServiceInstallationManifestPayloadV1,
): boolean {
  const payload = config.payload;
  const configArtifact = manifest.managedArtifacts[0];
  const authArtifact = manifest.managedArtifacts[2];
  const signingArtifact = manifest.managedArtifacts[3];
  return config.payloadDigest === manifest.handoffPayloadDigest &&
    payload.platform === manifest.platform &&
    payload.serviceLabel === manifest.serviceLabel &&
    payload.providerId === manifest.providerId &&
    canonicalizeJcsSafeIntegerV1(payload.principal) ===
      canonicalizeJcsSafeIntegerV1(manifest.principal) &&
    payload.runtimeRoot === manifest.runtimeRoot &&
    payload.installationIdentityDigest === manifest.installationIdentityDigest &&
    payload.binaryDigest === manifest.binaryDigest &&
    payload.capabilityDigest === manifest.capabilityDigest &&
    config.publicKey === manifest.servicePublicKey &&
    payload.configPath === configArtifact?.path &&
    payload.authKeyPath === authArtifact?.path &&
    payload.signingKeyPath === signingArtifact?.path &&
    payload.socketPath === manifest.ephemeralPaths.socketPath &&
    payload.readinessPath === manifest.ephemeralPaths.readinessPath &&
    manifest.retainedState.runtimeRoot === payload.runtimeRoot &&
    manifest.retainedState.installationIdentityKeyPath ===
      (payload.installationIdentityCustody?.keyPath ?? null);
}

async function inspectInstallationV1(
  root: string,
  expectedRuntimeRoot: string,
  authority: AuthorityStateV1,
  ignoreControlJournal = false,
  runtimeRootUnderAuthorityCustody = false,
): Promise<ProviderServiceInstallationDoctorResultV1> {
  const base = commonResultV1(root, expectedRuntimeRoot);
  if (!ignoreControlJournal) {
    let journal:
      ProviderServiceInstallationControlJournalEnvelopeV1 | undefined;
    try {
      journal = await readControlJournalV1(root, authority);
    } catch (error) {
      return {
        ...base,
        ok: false,
        status: "invalid_manifest",
        artifacts: Object.freeze([{
          kind: "control_journal" as const,
          path: controlJournalPathV1(root),
          state: "modified" as const,
        }]),
        reason: error instanceof Error ? error.message : "journal_invalid",
      };
    }
    if (journal !== undefined) {
      const pinned = journal.payload.targetManifest ??
        journal.payload.sourceManifest;
      if (
        journal.payload.installationRoot !== root ||
        pinned === null ||
        pinned.payload.runtimeRoot !== expectedRuntimeRoot ||
        pinned.payload.platform !== authority.platform
      ) {
        return {
          ...base,
          ok: false,
          status: "tampered",
          artifacts: Object.freeze([{
            kind: "control_journal" as const,
            path: controlJournalPathV1(root),
            state: "modified" as const,
          }]),
          reason: "control_journal_identity_mismatch",
        };
      }
      return {
        ...base,
        ok: false,
        status: "recovery_required",
        artifacts: Object.freeze([{
          kind: "control_journal" as const,
          path: controlJournalPathV1(root),
          state: "ok" as const,
          expectedDigest: journal.contentDigest,
          actualDigest: journal.contentDigest,
        }]),
        reason: `${journal.payload.operation}_${journal.payload.phase}`,
        manifestGeneration: pinned.payload.manifestGeneration,
        handoffPayloadDigest: pinned.payload.handoffPayloadDigest,
        rollbackAvailable:
          (journal.payload.targetManifest ?? journal.payload.sourceManifest)
            ?.payload.previous !== null,
      };
    }
  }
  let manifest: ProviderServiceInstallationManifestEnvelopeV1 | undefined;
  try {
    manifest = await readManifestV1(root, authority);
  } catch (error) {
    return {
      ...base,
      ok: false,
      status: "invalid_manifest",
      artifacts: Object.freeze([{
        kind: "manifest" as const,
        path: manifestPathV1(root),
        state: "modified" as const,
      }]),
      reason: error instanceof Error ? error.message : "manifest_invalid",
    };
  }
  if (manifest === undefined) {
    return {
      ...base,
      ok: true,
      status: "not_installed",
      artifacts: Object.freeze([]),
    };
  }
  if (
    manifest.payload.installationRoot !== root ||
    manifest.payload.runtimeRoot !== expectedRuntimeRoot ||
    manifest.payload.retainedState.runtimeRoot !== expectedRuntimeRoot ||
    manifest.payload.platform !== authority.platform
  ) {
    return {
      ...base,
      ok: false,
      status: "tampered",
      artifacts: Object.freeze([]),
      reason: "manifest_identity_mismatch",
      manifestGeneration: manifest.payload.manifestGeneration,
      handoffPayloadDigest: manifest.payload.handoffPayloadDigest,
      rollbackAvailable: manifest.payload.previous !== null,
    };
  }
  if (!ignoreControlJournal) {
    const stagedArtifacts: Array<Readonly<{
      readonly path: string;
      readonly kind: ProviderServiceInstallationArtifactKindV1;
    }>> = [
      { path: manifestPathV1(root), kind: "manifest" },
      { path: rollbackPathV1(root), kind: "rollback" },
      ...manifest.payload.managedArtifacts.map((artifact) => ({
        path: artifact.path,
        kind: artifact.kind,
      })),
      ...(manifest.payload.retainedState.installationIdentityKeyPath === null
        ? []
        : [{
          path: manifest.payload.retainedState.installationIdentityKeyPath,
          kind: "installation_identity_key" as const,
        }]),
    ];
    for (const staged of stagedArtifacts) {
      const stagingPath = atomicPublishStagingPathV1(staged.path);
      if (await pathExistsV1(stagingPath)) {
        return {
          ...base,
          ok: false,
          status: "tampered",
          artifacts: Object.freeze([{
            kind: staged.kind,
            path: staged.path,
            state: "modified" as const,
          }]),
          reason: "unexpected_atomic_publish_staging",
          manifestGeneration: manifest.payload.manifestGeneration,
          handoffPayloadDigest: manifest.payload.handoffPayloadDigest,
          rollbackAvailable: manifest.payload.previous !== null,
        };
      }
    }
  }
  const checks: ProviderServiceInstallationArtifactCheckV1[] = [];
  let healthy = true;
  for (const artifact of manifest.payload.managedArtifacts) {
    const owner = ownerForArtifactV1(artifact, manifest.payload, authority);
    try {
      await checkManagedArtifactParentV1(artifact, authority);
      const observed = await readCheckedFileV1({
        path: artifact.path,
        uid: owner.uid,
        gid: owner.gid,
        mode: artifact.mode,
        maximumBytes: maximumForKindV1(artifact.kind),
      });
      const state =
        observed.bytes.byteLength === artifact.byteLength &&
          observed.contentDigest === artifact.contentDigest
          ? "ok" as const
          : "modified" as const;
      if (state !== "ok") healthy = false;
      checks.push(Object.freeze({
        kind: artifact.kind,
        path: artifact.path,
        state,
        expectedDigest: artifact.contentDigest,
        actualDigest: observed.contentDigest,
      }));
    } catch (error) {
      healthy = false;
      let state: ProviderServiceInstallationArtifactStateV1 = "wrong_type";
      try {
        const metadata = await lstat(artifact.path);
        if (metadata.isSymbolicLink()) state = "symlink";
        else if (!metadata.isFile()) state = "wrong_type";
        else if (metadata.uid !== owner.uid || metadata.gid !== owner.gid) {
          state = "wrong_owner";
        } else if (exactModeV1(metadata.mode) !== artifact.mode) {
          state = "wrong_mode";
        } else state = "modified";
      } catch (metadataError) {
        state = isMissingV1(metadataError) ? "missing" : "wrong_type";
      }
      void error;
      checks.push(Object.freeze({
        kind: artifact.kind,
        path: artifact.path,
        state,
        expectedDigest: artifact.contentDigest,
      }));
    }
  }

  try {
    await checkedDirectoryV1(
      expectedRuntimeRoot,
      runtimeRootUnderAuthorityCustody
        ? authority.authorityUid
        : manifest.payload.principal.uid,
      runtimeRootUnderAuthorityCustody
        ? authority.authorityGid
        : manifest.payload.principal.gid,
      0o700,
      "provider runtime root",
    );
    await checkedWritableParentV1(
      expectedRuntimeRoot,
      authority.authorityUid,
      authority.authorityGid,
    );
    checks.push(Object.freeze({
      kind: "runtime_root" as const,
      path: expectedRuntimeRoot,
      state: "ok" as const,
    }));
  } catch {
    healthy = false;
    checks.push(Object.freeze({
      kind: "runtime_root" as const,
      path: expectedRuntimeRoot,
      state: "wrong_owner" as const,
    }));
  }

  const configArtifact = manifest.payload.managedArtifacts[0];
  if (configArtifact === undefined) healthy = false;
  else {
    try {
      const raw = await readFile(configArtifact.path, "utf8");
      const config = verifyProviderServiceHandoffConfigV1(
        JSON.parse(raw) as unknown,
        manifest.payload.installationIdentityDigest,
      );
      if (!configMatchesManifestV1(config, manifest.payload)) healthy = false;
      const descriptorArtifact = manifest.payload.managedArtifacts[1];
      const descriptor = renderProviderServiceDescriptorV1(config);
      if (
        descriptorArtifact === undefined ||
        digestBytesV1(Buffer.from(descriptor.descriptor, "utf8")) !==
          descriptorArtifact.contentDigest
      ) healthy = false;
      const custody = config.payload.installationIdentityCustody;
      if (custody !== undefined) {
        try {
          const identity = await readCheckedFileV1({
            path: custody.keyPath,
            uid: manifest.payload.principal.uid,
            gid: manifest.payload.principal.gid,
            mode: 0o600,
            maximumBytes: 32,
          });
          await validateIdentityKeyV1(config, identity.bytes);
          checks.push(Object.freeze({
            kind: "installation_identity_key" as const,
            path: custody.keyPath,
            state: "ok" as const,
          }));
        } catch {
          healthy = false;
          checks.push(Object.freeze({
            kind: "installation_identity_key" as const,
            path: custody.keyPath,
            state: "modified" as const,
          }));
        }
      }
    } catch {
      healthy = false;
    }
  }

  if (manifest.payload.previous === null) {
    try {
      await lstat(rollbackPathV1(root));
      healthy = false;
      checks.push(Object.freeze({
        kind: "rollback" as const,
        path: rollbackPathV1(root),
        state: "modified" as const,
      }));
    } catch (error) {
      if (!isMissingV1(error)) healthy = false;
    }
  } else {
    try {
      const rollback = await readRollbackV1(root, authority);
      if (
        rollback === undefined ||
        rollback.contentDigest !== manifest.payload.previous.contentDigest ||
        rollback.payload.installationRoot !== root ||
        rollback.payload.fromManifest.payload.manifestGeneration !==
          manifest.payload.previous.fromManifestGeneration ||
        rollback.payload.fromManifest.payload.handoffPayloadDigest !==
          manifest.payload.previous.fromHandoffPayloadDigest
      ) throw new Error("rollback binding mismatch");
      checks.push(Object.freeze({
        kind: "rollback" as const,
        path: rollbackPathV1(root),
        state: "ok" as const,
        expectedDigest: manifest.payload.previous.contentDigest,
        actualDigest: rollback.contentDigest,
      }));
    } catch {
      healthy = false;
      checks.push(Object.freeze({
        kind: "rollback" as const,
        path: rollbackPathV1(root),
        state: "modified" as const,
        expectedDigest: manifest.payload.previous.contentDigest,
      }));
    }
  }

  return {
    ...base,
    ok: healthy,
    status: healthy ? "healthy" : "tampered",
    artifacts: Object.freeze(checks),
    ...(healthy ? {} : { reason: "installation_tampered" }),
    manifestGeneration: manifest.payload.manifestGeneration,
    handoffPayloadDigest: manifest.payload.handoffPayloadDigest,
    rollbackAvailable: manifest.payload.previous !== null,
  };
}

function exactImmutableUpgradeBindingsV1(
  previous: ProviderServiceHandoffConfigV1,
  next: ProviderServiceHandoffConfigV1,
): boolean {
  const before = previous.payload;
  const after = next.payload;
  return previous.publicKey === next.publicKey &&
    before.platform === after.platform &&
    before.serviceLabel === after.serviceLabel &&
    before.providerId === after.providerId &&
    canonicalizeJcsSafeIntegerV1(before.principal) ===
      canonicalizeJcsSafeIntegerV1(after.principal) &&
    before.runtimeRoot === after.runtimeRoot &&
    before.socketPath === after.socketPath &&
    before.configPath === after.configPath &&
    before.authKeyPath === after.authKeyPath &&
    before.readinessPath === after.readinessPath &&
    before.signingKeyPath === after.signingKeyPath &&
    canonicalizeJcsSafeIntegerV1(before.installationIdentityCustody ?? null) ===
      canonicalizeJcsSafeIntegerV1(after.installationIdentityCustody ?? null) &&
    before.installationIdentityDigest === after.installationIdentityDigest;
}

function buildManifestPayloadV1(input: {
  readonly root: string;
  readonly generation: number;
  readonly config: ProviderServiceHandoffConfigV1;
  readonly descriptorPath: string;
  readonly configBytes: Uint8Array;
  readonly descriptorBytes: Uint8Array;
  readonly authBytes: Uint8Array;
  readonly signingBytes: Uint8Array;
  readonly previous: PreviousSnapshotPinV1 | null;
}): ProviderServiceInstallationManifestPayloadV1 {
  const payload = input.config.payload;
  return Object.freeze({
    schemaVersion: 1 as const,
    profile: PROVIDER_SERVICE_INSTALLATION_MANIFEST_PROFILE_V1,
    installationRoot: input.root,
    manifestGeneration: input.generation,
    platform: payload.platform,
    serviceLabel: payload.serviceLabel,
    providerId: payload.providerId,
    principal: Object.freeze({ ...payload.principal }),
    runtimeRoot: payload.runtimeRoot,
    installationIdentityDigest: payload.installationIdentityDigest,
    handoffPayloadDigest: input.config.payloadDigest,
    binaryDigest: payload.binaryDigest,
    capabilityDigest: payload.capabilityDigest,
    servicePublicKey: input.config.publicKey,
    managedArtifacts: Object.freeze([
      managedArtifactV1("service_config", payload.configPath, input.configBytes, 0o644, "authority"),
      managedArtifactV1("service_descriptor", input.descriptorPath, input.descriptorBytes, 0o644, "authority"),
      managedArtifactV1("runtime_auth_key", payload.authKeyPath, input.authBytes, 0o600, "service_principal"),
      managedArtifactV1("runtime_signing_key", payload.signingKeyPath, input.signingBytes, 0o600, "service_principal"),
    ]),
    ephemeralPaths: Object.freeze({
      socketPath: payload.socketPath,
      readinessPath: payload.readinessPath,
    }),
    retainedState: Object.freeze({
      runtimeRoot: payload.runtimeRoot,
      installationIdentityKeyPath:
        payload.installationIdentityCustody?.keyPath ?? null,
    }),
    previous: input.previous,
  });
}

async function ensureInstallPathsAbsentV1(
  paths: readonly string[],
): Promise<void> {
  const reserved = paths.flatMap((path) => [
    path,
    atomicPublishStagingPathV1(path),
  ]);
  if (new Set(reserved).size !== reserved.length) {
    throw new ProviderServiceInstallationLifecycleErrorV1(
      "path_conflict",
      "provider service install publish paths overlap",
    );
  }
  for (const path of paths) {
    for (const candidate of [path, atomicPublishStagingPathV1(path)]) {
      try {
        await lstat(candidate);
        throw new ProviderServiceInstallationLifecycleErrorV1(
          "path_conflict",
          "provider service install path already exists",
        );
      } catch (error) {
        if (error instanceof ProviderServiceInstallationLifecycleErrorV1) throw error;
        if (!isMissingV1(error)) {
          throw new ProviderServiceInstallationLifecycleErrorV1(
            "io_error",
            "provider service install path could not be inspected",
            { cause: error },
          );
        }
      }
    }
  }
}

async function runtimeRootNeedsCreationV1(
  config: ProviderServiceHandoffConfigV1,
  authority: AuthorityStateV1,
): Promise<boolean> {
  const root = config.payload.runtimeRoot;
  try {
    await checkedDirectoryV1(
      root,
      config.payload.principal.uid,
      config.payload.principal.gid,
      0o700,
      "provider runtime root",
    );
    await checkedWritableParentV1(
      root,
      authority.authorityUid,
      authority.authorityGid,
    );
    return false;
  } catch (error) {
    try {
      await lstat(root);
      throw error;
    } catch (metadataError) {
      if (!isMissingV1(metadataError)) throw error;
    }
  }
  await checkedWritableParentV1(
    root,
    authority.authorityUid,
    authority.authorityGid,
  );
  return true;
}

async function createRuntimeRootV1(
  config: ProviderServiceHandoffConfigV1,
  authority: AuthorityStateV1,
  nonce: `base64url:${string}`,
): Promise<void> {
  const root = config.payload.runtimeRoot;
  await checkedWritableParentV1(
    root,
    authority.authorityUid,
    authority.authorityGid,
  );
  const marker = makeRuntimeRootCreationMarkerV1(root, nonce);
  await atomicWriteOwnedFileV1({
    path: runtimeRootCreationMarkerPathV1(root),
    bytes: canonicalFileV1(marker),
    mode: 0o600,
    ownerUid: authority.authorityUid,
    ownerGid: authority.authorityGid,
    parentUid: authority.authorityUid,
    parentGid: authority.authorityGid,
    replace: false,
  });
  await observeCrashCutPhaseInternalV1(
    authority,
    "install_runtime_root_marker_published",
  );
  await mkdir(root, { mode: 0o700 });
  await chmod(root, 0o700);
  if (
    authority.authorityUid !== (process.geteuid?.() ?? authority.authorityUid) ||
    authority.authorityGid !== (process.getegid?.() ?? authority.authorityGid)
  ) {
    await chown(root, authority.authorityUid, authority.authorityGid);
  }
  await syncDirectoryV1(dirname(root));
  await checkedDirectoryV1(
    root,
    authority.authorityUid,
    authority.authorityGid,
    0o700,
    "provider runtime root",
  );
}

async function unlinkAndSyncV1(path: string): Promise<void> {
  await unlink(path);
  await syncDirectoryV1(dirname(path));
}

async function removeExactAtomicPublicationIfPresentV1(input: {
  readonly path: string;
  readonly expectedDigest: ContentDigestV1;
  readonly expectedByteLength: number;
  readonly uid: number;
  readonly gid: number;
  readonly mode: number;
  readonly maximumBytes: number;
  readonly label: string;
  readonly authorityUid: number;
  readonly authorityGid: number;
  readonly remove?: boolean;
  readonly afterStagingRemoved?: () => void | Promise<void>;
}): Promise<void> {
  const stagingPath = atomicPublishStagingPathV1(input.path);
  await discardIncompleteAuthorityStageV1({
    path: stagingPath,
    authorityUid: input.authorityUid,
    authorityGid: input.authorityGid,
    maximumBytes: input.maximumBytes,
  });
  const observeV1 = async (
    path: string,
    staged: boolean,
  ): Promise<FileObservationV1 | undefined> => {
    try {
      return await readCheckedFileV1({
        path,
        uid: input.uid,
        gid: input.gid,
        mode: input.mode,
        maximumBytes: input.maximumBytes,
        ...(staged ? { allowedLinkCounts: [1, 2] } : {}),
      });
    } catch (error) {
      if (isMissingV1(error)) return undefined;
      if (staged) {
        try {
          const transition = await readPinnedAtomicStageTransitionV1({
            path,
            expectedDigest: input.expectedDigest,
            expectedByteLength: input.expectedByteLength,
            authorityUid: input.authorityUid,
            authorityGid: input.authorityGid,
            ownerUid: input.uid,
            ownerGid: input.gid,
            finalMode: input.mode,
            maximumBytes: input.maximumBytes,
          });
          if (transition !== undefined) return transition;
        } catch (transitionError) {
          throw new ProviderServiceInstallationLifecycleErrorV1(
            "installation_tampered",
            `${input.label} staging transition is not transaction-pinned`,
            { cause: transitionError },
          );
        }
      }
      throw new ProviderServiceInstallationLifecycleErrorV1(
        "installation_tampered",
        `${input.label} is unsafe during recovery`,
        { cause: error },
      );
    }
  };
  const target = await observeV1(input.path, false);
  const staging = await observeV1(stagingPath, true);
  for (const observed of [target, staging]) {
    if (
      observed !== undefined &&
      (observed.contentDigest !== input.expectedDigest ||
        observed.bytes.byteLength !== input.expectedByteLength)
    ) {
      throw new ProviderServiceInstallationLifecycleErrorV1(
        "installation_tampered",
        `${input.label} changed during recovery`,
      );
    }
  }
  if (
    (target?.nlink === 2 || staging?.nlink === 2) &&
    (target === undefined ||
      staging === undefined ||
      target.dev !== staging.dev ||
      target.ino !== staging.ino ||
      target.nlink !== 2 ||
      staging.nlink !== 2)
  ) {
    throw new ProviderServiceInstallationLifecycleErrorV1(
      "installation_tampered",
      `${input.label} publish pair changed during recovery`,
    );
  }
  if (
    target !== undefined &&
    staging !== undefined &&
    target.nlink === 1 &&
    staging.nlink === 1
  ) {
    throw new ProviderServiceInstallationLifecycleErrorV1(
      "installation_tampered",
      `${input.label} has independent canonical and staging inodes`,
    );
  }
  if (input.remove === false) return;
  if (staging !== undefined) {
    const latest = await lstat(stagingPath);
    if (latest.dev !== staging.dev || latest.ino !== staging.ino) {
      throw new ProviderServiceInstallationLifecycleErrorV1(
        "installation_tampered",
        `${input.label} staging changed during recovery`,
      );
    }
    await unlinkAndSyncV1(stagingPath);
    await input.afterStagingRemoved?.();
  }
  // For a published nlink=2 pair, removing the deterministic stage first
  // leaves the canonical name as the durable recovery anchor.  A crash at
  // this boundary therefore retries from canonical-only nlink=1 instead of
  // stranding a stage-only snapshot that ordinary exact reads cannot see.
  if (target !== undefined) await unlinkAndSyncV1(input.path);
}

async function validatePinnedArtifactPublicationV1(
  artifact: ManagedArtifactV1,
  manifest: ProviderServiceInstallationManifestPayloadV1,
  authority: AuthorityStateV1,
): Promise<void> {
  await checkManagedArtifactParentV1(artifact, authority);
  const owner = ownerForArtifactV1(artifact, manifest, authority);
  await removeExactAtomicPublicationIfPresentV1({
    path: artifact.path,
    expectedDigest: artifact.contentDigest,
    expectedByteLength: artifact.byteLength,
    uid: owner.uid,
    gid: owner.gid,
    mode: artifact.mode,
    maximumBytes: maximumForKindV1(artifact.kind),
    label: "provider service managed artifact",
    authorityUid: authority.authorityUid,
    authorityGid: authority.authorityGid,
    remove: false,
  });
}

async function removePinnedArtifactIfPresentV1(
  artifact: ManagedArtifactV1,
  manifest: ProviderServiceInstallationManifestPayloadV1,
  authority: AuthorityStateV1,
): Promise<void> {
  await checkManagedArtifactParentV1(artifact, authority);
  const owner = ownerForArtifactV1(artifact, manifest, authority);
  await removeExactAtomicPublicationIfPresentV1({
    path: artifact.path,
    expectedDigest: artifact.contentDigest,
    expectedByteLength: artifact.byteLength,
    uid: owner.uid,
    gid: owner.gid,
    mode: artifact.mode,
    maximumBytes: maximumForKindV1(artifact.kind),
    label: "provider service managed artifact",
    authorityUid: authority.authorityUid,
    authorityGid: authority.authorityGid,
  });
}

async function removePinnedIdentityIfPresentV1(
  manifest: ProviderServiceInstallationManifestPayloadV1,
  identityDigest: ContentDigestV1 | null,
  authority: AuthorityStateV1,
): Promise<void> {
  const path = manifest.retainedState.installationIdentityKeyPath;
  if (path === null || identityDigest === null) return;
  await removeExactAtomicPublicationIfPresentV1({
    path,
    expectedDigest: identityDigest,
    expectedByteLength: 32,
    uid: manifest.principal.uid,
    gid: manifest.principal.gid,
    mode: 0o600,
    maximumBytes: 32,
    label: "Installation Identity custody",
    authorityUid: authority.authorityUid,
    authorityGid: authority.authorityGid,
  });
}

async function removePinnedManifestIfPresentV1(
  root: string,
  authority: AuthorityStateV1,
  expected: ProviderServiceInstallationManifestEnvelopeV1,
): Promise<void> {
  const bytes = canonicalFileV1(expected);
  await removeExactAtomicPublicationIfPresentV1({
    path: manifestPathV1(root),
    expectedDigest: digestBytesV1(bytes),
    expectedByteLength: bytes.byteLength,
    uid: authority.authorityUid,
    gid: authority.authorityGid,
    mode: 0o600,
    maximumBytes: MAX_MANIFEST_BYTES_V1,
    label: "provider service manifest",
    authorityUid: authority.authorityUid,
    authorityGid: authority.authorityGid,
  });
}

async function removePinnedRollbackIfPresentV1(
  root: string,
  authority: AuthorityStateV1,
  manifest: ProviderServiceInstallationManifestEnvelopeV1,
  expected: ProviderServiceInstallationRollbackEnvelopeV1,
): Promise<void> {
  await readPinnedRollbackPublicationV1({
    root,
    authority,
    manifest,
    expectedDigest: expected.contentDigest,
    expectedEnvelope: expected,
    action: "remove",
  });
}

function runtimeRootCreationMarkerBytesV1(
  journal: ProviderServiceInstallationControlJournalEnvelopeV1,
): Uint8Array | undefined {
  const target = journal.payload.targetManifest;
  const nonce = journal.payload.runtimeRootCreationNonce;
  if (!journal.payload.createdRuntimeRoot) return undefined;
  if (target === null || nonce === null) {
    throw new ProviderServiceInstallationLifecycleErrorV1(
      "manifest_invalid",
      "runtime root creation marker tuple is invalid",
    );
  }
  return canonicalFileV1(
    makeRuntimeRootCreationMarkerV1(target.payload.runtimeRoot, nonce),
  );
}

async function inspectRuntimeRootCreationMarkerV1(
  journal: ProviderServiceInstallationControlJournalEnvelopeV1,
  authority: AuthorityStateV1,
): Promise<boolean> {
  const bytes = runtimeRootCreationMarkerBytesV1(journal);
  if (bytes === undefined) return false;
  const markerPath = runtimeRootCreationMarkerPathV1(
    journal.payload.targetManifest!.payload.runtimeRoot,
  );
  const stagingPath = atomicPublishStagingPathV1(markerPath);
  await discardIncompleteAuthorityStageV1({
    path: stagingPath,
    authorityUid: authority.authorityUid,
    authorityGid: authority.authorityGid,
    maximumBytes: bytes.byteLength,
  });
  const observeV1 = async (
    path: string,
    staged: boolean,
  ): Promise<FileObservationV1 | undefined> => {
    try {
      return await readCheckedFileV1({
        path,
        uid: authority.authorityUid,
        gid: authority.authorityGid,
        mode: 0o600,
        maximumBytes: bytes.byteLength,
        ...(staged ? { allowedLinkCounts: [1, 2] } : {}),
      });
    } catch (error) {
      if (isMissingV1(error)) return undefined;
      throw new ProviderServiceInstallationLifecycleErrorV1(
        "installation_tampered",
        "runtime root creation marker is unsafe",
        { cause: error },
      );
    }
  };
  const canonical = await observeV1(markerPath, false);
  const staged = await observeV1(stagingPath, true);
  const expectedDigest = digestBytesV1(bytes);
  for (const observed of [canonical, staged]) {
    if (
      observed !== undefined &&
      (observed.contentDigest !== expectedDigest ||
        observed.bytes.byteLength !== bytes.byteLength)
    ) {
      throw new ProviderServiceInstallationLifecycleErrorV1(
        "installation_tampered",
        "runtime root creation marker changed",
      );
    }
  }
  if (canonical !== undefined && staged !== undefined) {
    if (
      canonical.nlink !== 2 ||
      staged.nlink !== 2 ||
      canonical.dev !== staged.dev ||
      canonical.ino !== staged.ino
    ) {
      throw new ProviderServiceInstallationLifecycleErrorV1(
        "installation_tampered",
        "runtime root creation marker publication is inconsistent",
      );
    }
  } else if (canonical?.nlink === 2 || staged?.nlink === 2) {
    throw new ProviderServiceInstallationLifecycleErrorV1(
      "installation_tampered",
      "runtime root creation marker alias is missing",
    );
  }
  return canonical !== undefined;
}

async function removeRuntimeRootCreationMarkerV1(
  journal: ProviderServiceInstallationControlJournalEnvelopeV1,
  authority: AuthorityStateV1,
): Promise<void> {
  const bytes = runtimeRootCreationMarkerBytesV1(journal);
  if (bytes === undefined) return;
  await removeExactAtomicPublicationIfPresentV1({
    path: runtimeRootCreationMarkerPathV1(
      journal.payload.targetManifest!.payload.runtimeRoot,
    ),
    expectedDigest: digestBytesV1(bytes),
    expectedByteLength: bytes.byteLength,
    uid: authority.authorityUid,
    gid: authority.authorityGid,
    mode: 0o600,
    maximumBytes: bytes.byteLength,
    label: "runtime root creation marker",
    authorityUid: authority.authorityUid,
    authorityGid: authority.authorityGid,
  });
}

async function cleanupInstallJournalV1(
  root: string,
  authority: AuthorityStateV1,
  journal: ProviderServiceInstallationControlJournalEnvelopeV1,
  removeEphemeral: boolean,
  existingCustody?: FileHandle,
): Promise<void> {
  let pinnedJournal = journal;
  const initialTarget = pinnedJournal.payload.targetManifest;
  if (pinnedJournal.payload.operation !== "install" || initialTarget === null) {
    throw new ProviderServiceInstallationLifecycleErrorV1(
      "manifest_invalid",
      "install recovery journal is invalid",
    );
  }
  pinnedJournal = await ensureInstallRuntimeRootPinV1(
    root,
    authority,
    pinnedJournal,
  );
  const target = pinnedJournal.payload.targetManifest!;
  const custodyPin = pinnedJournal.payload.runtimeRootCustodyPin;
  if (custodyPin === null) {
    // A null pin is authorized only before a fresh runtime root exists.  No
    // runtime-root service pathname has been published yet.  Historical cuts
    // may have published exact authority-owned config/descriptor/manifest
    // stages, which remain journal-pinned and safe to converge by deletion.
    await removePinnedManifestIfPresentV1(root, authority, target);
    for (const artifact of target.payload.managedArtifacts) {
      if (artifact.owner === "authority") {
        await removePinnedArtifactIfPresentV1(
          artifact,
          target.payload,
          authority,
        );
      }
    }
    await removeRuntimeRootCreationMarkerV1(pinnedJournal, authority);
    return;
  }
  if (pinnedJournal.payload.createdRuntimeRoot) {
    let runtimeRootMissing = false;
    try {
      await lstat(target.payload.runtimeRoot);
    } catch (error) {
      if (!isMissingV1(error)) throw error;
      runtimeRootMissing = true;
    }
    if (runtimeRootMissing) {
      await ensureInstallPathsAbsentV1([
        manifestPathV1(root),
        ...target.payload.managedArtifacts.map((artifact) => artifact.path),
        target.payload.ephemeralPaths.socketPath,
        target.payload.ephemeralPaths.readinessPath,
        ...(pinnedJournal.payload.installationIdentityDisposition === "create" &&
            target.payload.retainedState.installationIdentityKeyPath !== null
          ? [target.payload.retainedState.installationIdentityKeyPath]
          : []),
      ]);
      // A pinned fresh root can be absent only after this transaction durably
      // removed it.  All transaction-owned publications must already be gone;
      // the exact marker (if the cut preceded its unlink) is the last anchor.
      await removeRuntimeRootCreationMarkerV1(pinnedJournal, authority);
      await observeCrashCutPhaseInternalV1(
        authority,
        "install_runtime_root_marker_removed",
      );
      return;
    }
  }
  if (
    pinnedJournal.payload.createdRuntimeRoot &&
    !(await inspectRuntimeRootCreationMarkerV1(pinnedJournal, authority))
  ) {
    throw new ProviderServiceInstallationLifecycleErrorV1(
      "installation_tampered",
      "created runtime root has no exact creation marker",
    );
  }
  let custody = existingCustody;
  if (custody === undefined) {
    custody = await acquireRuntimeRootCustodyV1(
      target,
      authority,
      custodyPin,
      "install_runtime_root_custody_acquired",
    );
  } else {
    await assertRuntimeRootCustodyV1(custody, target, authority, custodyPin);
  }
  try {
    await removePinnedManifestIfPresentV1(root, authority, target);
    for (const artifact of [...target.payload.managedArtifacts].reverse()) {
      await removePinnedArtifactIfPresentV1(artifact, target.payload, authority);
    }
    if (pinnedJournal.payload.installationIdentityDisposition === "create") {
      await removePinnedIdentityIfPresentV1(
        target.payload,
        pinnedJournal.payload.installationIdentityKeyDigest,
        authority,
      );
    }
    if (removeEphemeral) {
      for (const item of [
        { path: target.payload.ephemeralPaths.socketPath, kind: "socket" as const },
        { path: target.payload.ephemeralPaths.readinessPath, kind: "readiness" as const },
      ]) {
        if (!(await validateEphemeralForRemovalV1(
          item.path,
          item.kind,
          target.payload.principal,
        ))) {
          throw new ProviderServiceInstallationLifecycleErrorV1(
            "installation_tampered",
            "provider service ephemeral path is unsafe during recovery",
          );
        }
        await unlinkAndSyncV1(item.path).catch((error) => {
          if (!isMissingV1(error)) throw error;
        });
      }
    }
    await assertRuntimeRootCustodyV1(custody, target, authority, custodyPin);
    if (pinnedJournal.payload.createdRuntimeRoot) {
      await rmdir(target.payload.runtimeRoot);
      await syncDirectoryV1(dirname(target.payload.runtimeRoot));
      await observeCrashCutPhaseInternalV1(
        authority,
        "install_runtime_root_removed",
      );
    } else {
      await restoreRuntimeRootCustodyV1(
        custody,
        target,
        authority,
        custodyPin,
      );
    }
  } finally {
    await custody.close().catch(() => undefined);
  }
  if (pinnedJournal.payload.createdRuntimeRoot) {
    await removeRuntimeRootCreationMarkerV1(pinnedJournal, authority);
    await observeCrashCutPhaseInternalV1(
      authority,
      "install_runtime_root_marker_removed",
    );
  }
}

function controlContextFromManifestV1(
  manifest: ProviderServiceInstallationManifestEnvelopeV1,
): Readonly<{
  readonly platform: ProviderServicePlatformV1;
  readonly serviceLabel: string;
  readonly descriptorPath: string;
}> {
  return Object.freeze({
    platform: manifest.payload.platform,
    serviceLabel: manifest.payload.serviceLabel,
    descriptorPath: manifest.payload.managedArtifacts[1]!.path,
  });
}

async function resumeInstallJournalV1(
  root: string,
  expectedRuntimeRoot: string,
  authority: AuthorityStateV1,
  options: ProviderServiceInstallationInstallOptionsV1,
  journal: ProviderServiceInstallationControlJournalEnvelopeV1,
): Promise<ProviderServiceInstallationInstallResultV1 | undefined> {
  const base = commonResultV1(root, expectedRuntimeRoot);
  const target = journal.payload.targetManifest;
  let supplied: ProviderServiceHandoffConfigV1;
  try {
    supplied = verifyProviderServiceHandoffConfigV1(options.config);
  } catch {
    return { ...base, status: "recovery_required", reason: "install_recovery_input_invalid" };
  }
  if (
    journal.payload.operation !== "install" ||
    target === null ||
    target.payload.runtimeRoot !== expectedRuntimeRoot ||
    target.payload.handoffPayloadDigest !== supplied.payloadDigest ||
    target.payload.servicePublicKey !== supplied.publicKey
  ) {
    return { ...base, status: "recovery_required", reason: "install_recovery_identity_mismatch" };
  }
  if (journal.payload.phase === "files_pending") {
    try {
      await cleanupInstallJournalV1(root, authority, journal, false);
      await removeControlJournalV1(root, authority);
      return undefined;
    } catch {
      return { ...base, status: "recovery_required", reason: "install_cleanup_pending" };
    }
  }
  if (journal.payload.phase === "compensation_confirmed") {
    try {
      await cleanupInstallJournalV1(root, authority, journal, true);
      await removeControlJournalV1(root, authority);
      return { ...base, status: "refused", reason: "service_control_failed" };
    } catch {
      return { ...base, status: "recovery_required", reason: "install_cleanup_pending" };
    }
  }
  if (journal.payload.phase === "control_confirmed") {
    const exact = await inspectInstallationV1(
      root,
      expectedRuntimeRoot,
      authority,
      true,
    );
    if (
      exact.status !== "healthy" ||
      exact.handoffPayloadDigest !== target.payload.handoffPayloadDigest
    ) {
      return { ...base, status: "recovery_required", reason: "install_files_incomplete" };
    }
    await removeRuntimeRootCreationMarkerV1(journal, authority);
    await removeControlJournalV1(root, authority);
    return {
      ...base,
      status: "installed",
      configPath: target.payload.managedArtifacts[0]!.path,
      descriptorPath: target.payload.managedArtifacts[1]!.path,
    };
  }

  // `control_invoked` is ambiguous across a process cut.  First force an
  // idempotent absent state, then perform one fresh activation attempt.
  try {
    await authority.controlService(
      "deactivate",
      controlContextFromManifestV1(target),
    );
  } catch {
    return { ...base, status: "recovery_required", reason: "deactivation_unconfirmed" };
  }
  const runtimeRootCustodyPin = journal.payload.runtimeRootCustodyPin;
  if (runtimeRootCustodyPin === null) {
    return { ...base, status: "recovery_required", reason: "install_cleanup_pending" };
  }
  let resumeCustody: FileHandle | undefined;
  let exact: ProviderServiceInstallationDoctorResultV1;
  try {
    resumeCustody = await acquireRuntimeRootCustodyV1(
      target,
      authority,
      runtimeRootCustodyPin,
      "install_runtime_root_custody_acquired",
    );
    exact = await inspectInstallationV1(
      root,
      expectedRuntimeRoot,
      authority,
      true,
      true,
    );
    if (
      exact.status === "healthy" &&
      exact.handoffPayloadDigest === target.payload.handoffPayloadDigest
    ) {
      await restoreRuntimeRootCustodyV1(
        resumeCustody,
        target,
        authority,
        runtimeRootCustodyPin,
      );
    }
  } catch {
    return { ...base, status: "recovery_required", reason: "install_cleanup_pending" };
  } finally {
    await resumeCustody?.close().catch(() => undefined);
  }
  if (
    exact.status !== "healthy" ||
    exact.handoffPayloadDigest !== target.payload.handoffPayloadDigest
  ) {
    try {
      const compensated = await advanceControlJournalV1(
        root,
        authority,
        journal,
        "compensation_confirmed",
      );
      await cleanupInstallJournalV1(root, authority, compensated, true);
      await removeControlJournalV1(root, authority);
      return { ...base, status: "refused", reason: "install_files_incomplete" };
    } catch {
      return { ...base, status: "recovery_required", reason: "install_cleanup_pending" };
    }
  }
  try {
    await authority.controlService(
      "activate",
      controlContextFromManifestV1(target),
    );
    const confirmed = await advanceControlJournalV1(
      root,
      authority,
      journal,
      "control_confirmed",
    );
    await removeRuntimeRootCreationMarkerV1(confirmed, authority);
    await removeControlJournalV1(root, authority);
    return {
      ...base,
      status: "installed",
      configPath: target.payload.managedArtifacts[0]!.path,
      descriptorPath: target.payload.managedArtifacts[1]!.path,
    };
  } catch {
    try {
      await authority.controlService(
        "deactivate",
        controlContextFromManifestV1(target),
      );
    } catch {
      return { ...base, status: "recovery_required", reason: "deactivation_unconfirmed" };
    }
    try {
      const compensated = await advanceControlJournalV1(
        root,
        authority,
        journal,
        "compensation_confirmed",
      );
      await cleanupInstallJournalV1(root, authority, compensated, true);
      await removeControlJournalV1(root, authority);
      return { ...base, status: "refused", reason: "service_control_failed" };
    } catch {
      return { ...base, status: "recovery_required", reason: "install_cleanup_pending" };
    }
  }
}

async function installInternalV1(
  capability: ProviderServiceInstallationPrivilegeCapabilityInternalV1,
  options: ProviderServiceInstallationInstallOptionsV1,
): Promise<ProviderServiceInstallationInstallResultV1> {
  const authority = requireProviderServiceInstallationPrivilegeInternalV1(
    capability,
  ) as AuthorityStateV1;
  const root = safeAbsolutePathV1(options.installationRoot, "installationRoot");
  const expectedRuntimeRoot = safeAbsolutePathV1(
    options.expectedRuntimeRoot,
    "expectedRuntimeRoot",
  );
  return enqueueInstallationOperationV1(root, async () => {
    const createdInstallationRoot = await ensureInstallationRootV1(root, authority);
    let retainInstallationRoot = false;
    try {
    const base = commonResultV1(root, expectedRuntimeRoot);
    return await runWithLifecycleLockV1<ProviderServiceInstallationInstallResultV1>(
      root,
      authority,
      () => ({
        ...base,
        status: "refused" as const,
        reason: "lifecycle_busy",
      }),
      async () => {
    const pendingJournal = await readControlJournalV1(root, authority, true);
    if (pendingJournal !== undefined) {
      const resumed = await resumeInstallJournalV1(
        root,
        expectedRuntimeRoot,
        authority,
        options,
        pendingJournal,
      );
      if (resumed !== undefined) {
        if (
          resumed.status === "installed" ||
          resumed.status === "recovery_required"
        ) retainInstallationRoot = true;
        return resumed;
      }
    }
    const existing = await inspectInstallationV1(root, expectedRuntimeRoot, authority);
    if (existing.status !== "not_installed") {
      if (
        existing.status === "healthy" &&
        existing.handoffPayloadDigest === options.config.payloadDigest
      ) {
        const manifest = await readManifestV1(root, authority);
        return {
          ...base,
          status: "already_installed",
          configPath: manifest?.payload.managedArtifacts[0]?.path,
          descriptorPath: manifest?.payload.managedArtifacts[1]?.path,
        };
      }
      return {
        ...base,
        status: "refused",
        reason: existing.reason ?? "installation_already_exists",
      };
    }
    let config: ProviderServiceHandoffConfigV1;
    try {
      config = verifyProviderServiceHandoffConfigV1(options.config);
    } catch (error) {
      throw new ProviderServiceInstallationLifecycleErrorV1(
        "invalid_target",
        "provider service handoff config is invalid",
        { cause: error },
      );
    }
    if (
      config.payload.platform !== authority.platform ||
      config.payload.runtimeRoot !== expectedRuntimeRoot ||
      isInsideV1(expectedRuntimeRoot, root) ||
      isInsideV1(root, expectedRuntimeRoot) ||
      isInsideV1(expectedRuntimeRoot, config.payload.configPath)
    ) {
      throw new ProviderServiceInstallationLifecycleErrorV1(
        "invalid_target",
        "provider service lifecycle identity or path binding is invalid",
      );
    }
    const descriptor = renderProviderServiceDescriptorV1(config);
    const defaultDescriptorPath = defaultProviderServiceDescriptorPathV1(
      config.payload.platform,
      config.payload.serviceLabel,
    );
    const descriptorPath = safeAbsolutePathV1(
      options.descriptorPath ?? defaultDescriptorPath,
      "descriptorPath",
    );
    const lifecyclePaths = [
      manifestPathV1(root),
      rollbackPathV1(root),
      lifecycleLockPathV1(root),
      lifecycleLockRecoveryClaimPathV1(root),
      lifecycleLockStaleQuarantinePathV1(root),
      lifecycleLockRecoveryRetiringPathV1(root),
      controlJournalPathV1(root),
      runtimeRootCreationMarkerPathV1(expectedRuntimeRoot),
      config.payload.configPath,
      descriptorPath,
      config.payload.authKeyPath,
      config.payload.signingKeyPath,
      config.payload.socketPath,
      config.payload.readinessPath,
      ...(config.payload.installationIdentityCustody === undefined
        ? []
        : [config.payload.installationIdentityCustody.keyPath]),
    ];
    const lifecyclePublishPaths = lifecyclePaths.flatMap((path) => [
      path,
      atomicPublishStagingPathV1(path),
    ]);
    if (
      (!authority.allowTestDescriptorOverride &&
        descriptorPath !== defaultDescriptorPath) ||
      isInsideV1(expectedRuntimeRoot, descriptorPath) ||
      new Set(lifecyclePublishPaths).size !== lifecyclePublishPaths.length
    ) {
      throw new ProviderServiceInstallationLifecycleErrorV1(
        "path_conflict",
        "provider service lifecycle paths overlap",
      );
    }
    if (
      options.privateKey.type !== "private" ||
      options.privateKey.asymmetricKeyType !== "ed25519" ||
      `base64url:${createPublicKey(options.privateKey)
        .export({ format: "der", type: "spki" })
        .toString("base64url")}` !== config.publicKey
    ) {
      throw new ProviderServiceInstallationLifecycleErrorV1(
        "invalid_target",
        "provider service signing key does not match the signed config",
      );
    }
    const custody = config.payload.installationIdentityCustody;
    if (
      (custody === undefined) !== (options.installationIdentityKey === undefined)
    ) {
      throw new ProviderServiceInstallationLifecycleErrorV1(
        "invalid_target",
        "Installation Identity custody input does not match the signed config",
      );
    }
    if (custody !== undefined && options.installationIdentityKey !== undefined) {
      await validateIdentityKeyV1(config, options.installationIdentityKey);
    }
    const identityDisposition = custody === undefined ||
        options.installationIdentityKey === undefined
      ? null
      : await installationIdentityDispositionV1(
        config,
        options.installationIdentityKey,
      );
    await ensureInstallPathsAbsentV1([
      config.payload.configPath,
      descriptorPath,
      config.payload.authKeyPath,
      config.payload.signingKeyPath,
      config.payload.socketPath,
      config.payload.readinessPath,
      runtimeRootCreationMarkerPathV1(expectedRuntimeRoot),
      ...(custody === undefined || identityDisposition === "reuse"
        ? []
        : [custody.keyPath]),
    ]);
    await checkedWritableParentV1(
      config.payload.configPath,
      authority.authorityUid,
      authority.authorityGid,
    );
    await checkedWritableParentV1(
      descriptorPath,
      authority.authorityUid,
      authority.authorityGid,
    );
    const createdRuntimeRoot = await runtimeRootNeedsCreationV1(
      config,
      authority,
    );
    const runtimeRootCreationNonce = createdRuntimeRoot
      ? encodeBytesV1(randomBytes(16))
      : null;
    const configBytes = Buffer.from(`${JSON.stringify(config)}\n`, "utf8");
    const descriptorBytes = Buffer.from(descriptor.descriptor, "utf8");
    const authBytes = randomBytes(32);
    const signingBytes = Buffer.from(
      options.privateKey.export({ format: "der", type: "pkcs8" }),
    );
    const identityBytes =
      options.installationIdentityKey === undefined
        ? undefined
        : Buffer.from(options.installationIdentityKey);
    const manifest = makeManifestV1(buildManifestPayloadV1({
      root,
      generation: 1,
      config,
      descriptorPath,
      configBytes,
      descriptorBytes,
      authBytes,
      signingBytes,
      previous: null,
    }));
    const initialRuntimeRootCustodyPin = createdRuntimeRoot
      ? null
      : await pinRuntimeRootForJournalV1(manifest, authority, "principal");
    let controlJournal = makeControlJournalV1(Object.freeze({
      schemaVersion: 1 as const,
      profile: PROVIDER_SERVICE_INSTALLATION_CONTROL_JOURNAL_PROFILE_V1,
      installationRoot: root,
      operation: "install" as const,
      phase: "files_pending" as const,
      sourceManifest: null,
      targetManifest: manifest,
      rollbackContentDigest: null,
      rollbackSnapshot: null,
      installationIdentityKeyDigest:
        identityBytes === undefined ? null : digestBytesV1(identityBytes),
      installationIdentityDisposition: identityDisposition,
      createdRuntimeRoot,
      runtimeRootCreationNonce,
      runtimeRootCustodyPin: initialRuntimeRootCustodyPin,
    }));
    let journalWritten = false;
    let activationReturned = false;
    let runtimeRootCustody: FileHandle | undefined;
    try {
      await writeControlJournalV1(root, authority, controlJournal, false);
      journalWritten = true;
      await observeCrashCutPhaseInternalV1(
        authority,
        "install_journal_published",
      );
      if (createdRuntimeRoot) {
        await createRuntimeRootV1(
          config,
          authority,
          runtimeRootCreationNonce!,
        );
      }
      controlJournal = await ensureInstallRuntimeRootPinV1(
        root,
        authority,
        controlJournal,
      );
      const runtimeRootCustodyPin = controlJournal.payload.runtimeRootCustodyPin;
      if (runtimeRootCustodyPin === null) {
        throw new ProviderServiceInstallationLifecycleErrorV1(
          "installation_tampered",
          "provider runtime root was not durably pinned before install writes",
        );
      }
      runtimeRootCustody = await acquireRuntimeRootCustodyV1(
        manifest,
        authority,
        runtimeRootCustodyPin,
        "install_runtime_root_custody_acquired",
      );
      if (
        identityDisposition === "reuse" &&
        identityBytes !== undefined
      ) {
        await convergeRetainedInstallationIdentityUnderCustodyV1(
          config,
          identityBytes,
          authority,
        );
      }
      await ensureInstallPathsAbsentV1([
        config.payload.authKeyPath,
        config.payload.signingKeyPath,
        config.payload.socketPath,
        config.payload.readinessPath,
        ...(custody === undefined || identityDisposition === "reuse"
          ? []
          : [custody.keyPath]),
      ]);
      await atomicWriteOwnedFileV1({
        path: config.payload.authKeyPath,
        bytes: authBytes,
        mode: 0o600,
        ownerUid: config.payload.principal.uid,
        ownerGid: config.payload.principal.gid,
        parentUid: authority.authorityUid,
        parentGid: authority.authorityGid,
        replace: false,
      });
      await atomicWriteOwnedFileV1({
        path: config.payload.signingKeyPath,
        bytes: signingBytes,
        mode: 0o600,
        ownerUid: config.payload.principal.uid,
        ownerGid: config.payload.principal.gid,
        parentUid: authority.authorityUid,
        parentGid: authority.authorityGid,
        replace: false,
      });
      if (
        custody !== undefined &&
        identityBytes !== undefined &&
        identityDisposition === "create"
      ) {
        await atomicWriteOwnedFileV1({
          path: custody.keyPath,
          bytes: identityBytes,
          mode: 0o600,
          ownerUid: config.payload.principal.uid,
          ownerGid: config.payload.principal.gid,
          parentUid: authority.authorityUid,
          parentGid: authority.authorityGid,
          replace: false,
        });
        // Custody becomes retained only after the manifest and service
        // activation commit.  A failed fresh install must remain retryable.
      }
      await atomicWriteOwnedFileV1({
        path: config.payload.configPath,
        bytes: configBytes,
        mode: 0o644,
        ownerUid: authority.authorityUid,
        ownerGid: authority.authorityGid,
        parentUid: authority.authorityUid,
        parentGid: authority.authorityGid,
        replace: false,
      });
      await atomicWriteOwnedFileV1({
        path: descriptorPath,
        bytes: descriptorBytes,
        mode: 0o644,
        ownerUid: authority.authorityUid,
        ownerGid: authority.authorityGid,
        parentUid: authority.authorityUid,
        parentGid: authority.authorityGid,
        replace: false,
      });
      await atomicWriteOwnedFileV1({
        path: manifestPathV1(root),
        bytes: canonicalFileV1(manifest),
        mode: 0o600,
        ownerUid: authority.authorityUid,
        ownerGid: authority.authorityGid,
        parentUid: authority.authorityUid,
        parentGid: authority.authorityGid,
        replace: false,
      });
      await assertRuntimeRootCustodyV1(
        runtimeRootCustody,
        manifest,
        authority,
        runtimeRootCustodyPin,
      );
      await restoreRuntimeRootCustodyV1(
        runtimeRootCustody,
        manifest,
        authority,
        runtimeRootCustodyPin,
      );
      await runtimeRootCustody.close();
      runtimeRootCustody = undefined;
      controlJournal = await advanceControlJournalV1(
        root,
        authority,
        controlJournal,
        "control_invoked",
      );
      try {
        await authority.controlService("activate", {
          platform: config.payload.platform,
          serviceLabel: config.payload.serviceLabel,
          descriptorPath,
        });
        activationReturned = true;
      } catch {
        try {
          await authority.controlService("deactivate", {
            platform: config.payload.platform,
            serviceLabel: config.payload.serviceLabel,
            descriptorPath,
          });
        } catch {
          retainInstallationRoot = true;
          return {
            ...base,
            status: "recovery_required",
            reason: "deactivation_unconfirmed",
          };
        }
        controlJournal = await advanceControlJournalV1(
          root,
          authority,
          controlJournal,
          "compensation_confirmed",
        );
        try {
          await cleanupInstallJournalV1(root, authority, controlJournal, true);
          await removeControlJournalV1(root, authority);
          return {
            ...base,
            status: "refused",
            reason: "service_control_failed",
          };
        } catch {
          retainInstallationRoot = true;
          return {
            ...base,
            status: "recovery_required",
            reason: "install_cleanup_pending",
          };
        }
      }
      controlJournal = await advanceControlJournalV1(
        root,
        authority,
        controlJournal,
        "control_confirmed",
      );
      await removeRuntimeRootCreationMarkerV1(controlJournal, authority);
      await removeControlJournalV1(root, authority);
      retainInstallationRoot = true;
      return {
        ...base,
        status: "installed",
        configPath: config.payload.configPath,
        descriptorPath,
      };
    } catch (error) {
      if (error instanceof ProviderServiceInstallationCrashCutInternalV1) {
        await runtimeRootCustody?.close().catch(() => undefined);
        runtimeRootCustody = undefined;
        retainInstallationRoot = true;
        return {
          ...base,
          status: "recovery_required",
          reason: "install_files_pending",
        };
      }
      if (activationReturned) {
        retainInstallationRoot = true;
        return {
          ...base,
          status: "recovery_required",
          reason: "activation_confirmation_pending",
        };
      }
      if (journalWritten) {
        try {
          const cleanupCustody = runtimeRootCustody;
          runtimeRootCustody = undefined;
          await cleanupInstallJournalV1(
            root,
            authority,
            controlJournal,
            controlJournal.payload.phase !== "files_pending",
            cleanupCustody,
          );
          await removeControlJournalV1(root, authority);
        } catch {
          retainInstallationRoot = true;
          return {
            ...base,
            status: "recovery_required",
            reason: "install_cleanup_pending",
          };
        }
      }
      throw error;
    } finally {
      await runtimeRootCustody?.close().catch(() => undefined);
      authBytes.fill(0);
      signingBytes.fill(0);
      identityBytes?.fill(0);
    }
      },
    );
    } finally {
      if (createdInstallationRoot && !retainInstallationRoot) {
        await rmdir(root).catch(() => undefined);
      }
    }
  });
}

async function doctorInternalV1(
  capability: ProviderServiceInstallationPrivilegeCapabilityInternalV1,
  options: ProviderServiceInstallationTargetOptionsV1,
): Promise<ProviderServiceInstallationDoctorResultV1> {
  const authority = requireProviderServiceInstallationPrivilegeInternalV1(
    capability,
  ) as AuthorityStateV1;
  const root = safeAbsolutePathV1(options.installationRoot, "installationRoot");
  const expectedRuntimeRoot = safeAbsolutePathV1(
    options.expectedRuntimeRoot,
    "expectedRuntimeRoot",
  );
  return enqueueInstallationOperationV1(root, async () => {
    const base = commonResultV1(root, expectedRuntimeRoot);
    if (!(await installationRootPresentV1(root, authority))) {
      return {
        ...base,
        ok: true,
        status: "not_installed",
        artifacts: Object.freeze([]),
      };
    }
    return runWithLifecycleLockV1<ProviderServiceInstallationDoctorResultV1>(
      root,
      authority,
      () => ({
        ...base,
        ok: false,
        status: "busy" as const,
        artifacts: Object.freeze([{
          kind: "lifecycle_lock" as const,
          path: lifecycleLockPathV1(root),
          state: "busy" as const,
        }]),
        reason: "lifecycle_busy",
      }),
      () => inspectInstallationV1(root, expectedRuntimeRoot, authority),
    );
  });
}

function manifestsKeepUpgradeIdentityV1(
  source: ProviderServiceInstallationManifestPayloadV1,
  target: ProviderServiceInstallationManifestPayloadV1,
): boolean {
  return source.platform === target.platform &&
    source.serviceLabel === target.serviceLabel &&
    source.providerId === target.providerId &&
    canonicalizeJcsSafeIntegerV1(source.principal) ===
      canonicalizeJcsSafeIntegerV1(target.principal) &&
    source.runtimeRoot === target.runtimeRoot &&
    source.installationIdentityDigest === target.installationIdentityDigest &&
    source.servicePublicKey === target.servicePublicKey &&
    canonicalizeJcsSafeIntegerV1(source.ephemeralPaths) ===
      canonicalizeJcsSafeIntegerV1(target.ephemeralPaths) &&
    canonicalizeJcsSafeIntegerV1(source.retainedState) ===
      canonicalizeJcsSafeIntegerV1(target.retainedState) &&
    source.managedArtifacts.length === target.managedArtifacts.length &&
    source.managedArtifacts.every((artifact, index) => {
      const next = target.managedArtifacts[index];
      return next !== undefined &&
        artifact.kind === next.kind &&
        artifact.path === next.path &&
        artifact.mode === next.mode &&
        artifact.owner === next.owner &&
        (artifact.kind === "service_config" ||
          artifact.kind === "service_descriptor" ||
          (artifact.contentDigest === next.contentDigest &&
            artifact.byteLength === next.byteLength));
    });
}

function upgradeJournalTupleValidV1(
  journal: ProviderServiceInstallationControlJournalEnvelopeV1,
): boolean {
  const source = journal.payload.sourceManifest;
  const target = journal.payload.targetManifest;
  const rollbackDigest = journal.payload.rollbackContentDigest;
  return journal.payload.operation === "upgrade" &&
    source !== null &&
    target !== null &&
    rollbackDigest !== null &&
    target.payload.manifestGeneration ===
      source.payload.manifestGeneration + 1 &&
    manifestsKeepUpgradeIdentityV1(source.payload, target.payload) &&
    target.payload.previous?.contentDigest === rollbackDigest &&
    target.payload.previous.fromManifestGeneration ===
      source.payload.manifestGeneration &&
    target.payload.previous.fromHandoffPayloadDigest ===
      source.payload.handoffPayloadDigest;
}

async function ensureUpgradeRollbackSnapshotV1(
  root: string,
  authority: AuthorityStateV1,
  journal: ProviderServiceInstallationControlJournalEnvelopeV1,
): Promise<ProviderServiceInstallationRollbackEnvelopeV1> {
  const source = journal.payload.sourceManifest!;
  const expectedDigest = journal.payload.rollbackContentDigest!;
  const snapshot = journal.payload.rollbackSnapshot;
  if (
    snapshot === null ||
    snapshot.contentDigest !== expectedDigest
  ) {
    throw new ProviderServiceInstallationLifecycleErrorV1(
      "manifest_invalid",
      "upgrade rollback journal is incomplete",
    );
  }
  const snapshotBytes = canonicalFileV1(snapshot);
  const canonical = await readRollbackPublicationCandidateV1(
    rollbackPathV1(root),
    authority,
    false,
  );
  let expectedReplaceBaseline: Readonly<{
    readonly contentDigest: ContentDigestV1;
    readonly byteLength: number;
  }> | undefined;
  if (canonical !== undefined && !canonical.observation.bytes.equals(snapshotBytes)) {
    if (
      source.payload.previous === null ||
      canonical.snapshot.contentDigest !== source.payload.previous.contentDigest ||
      !rollbackSnapshotMatchesManifestV1(root, source, canonical.snapshot)
    ) {
      throw new ProviderServiceInstallationLifecycleErrorV1(
        "installation_tampered",
        "upgrade rollback replacement baseline is not manifest-pinned",
      );
    }
    expectedReplaceBaseline = Object.freeze({
      contentDigest: canonical.observation.contentDigest,
      byteLength: canonical.observation.bytes.byteLength,
    });
  } else if (canonical === undefined && source.payload.previous !== null) {
    throw new ProviderServiceInstallationLifecycleErrorV1(
      "installation_tampered",
      "upgrade rollback replacement baseline disappeared",
    );
  }
  await convergePinnedAtomicPublicationStageIfPresentV1({
    path: rollbackPathV1(root),
    bytes: snapshotBytes,
    uid: authority.authorityUid,
    gid: authority.authorityGid,
    mode: 0o600,
    maximumBytes: MAX_ROLLBACK_BYTES_V1,
    label: "provider service rollback snapshot",
    authorityUid: authority.authorityUid,
    authorityGid: authority.authorityGid,
    allowCreate: source.payload.previous === null,
    ...(expectedReplaceBaseline === undefined
      ? {}
      : { expectedReplaceBaseline }),
  });
  const existing = await readRollbackV1(root, authority);
  if (
    existing !== undefined &&
    existing.contentDigest === expectedDigest &&
    existing.payload.fromManifest.contentDigest ===
      snapshot.payload.fromManifest.contentDigest
  ) {
    // An exact canonical read may still be the nlink=2 publish cut.  Drive the
    // deterministic stage/canonical pair to its single-name committed form
    // before allowing the upgrade journal to advance or disappear.
    await atomicWriteOwnedFileV1({
      path: rollbackPathV1(root),
      bytes: canonicalFileV1(snapshot),
      mode: 0o600,
      ownerUid: authority.authorityUid,
      ownerGid: authority.authorityGid,
      parentUid: authority.authorityUid,
      parentGid: authority.authorityGid,
      replace: true,
    });
    return existing;
  }
  if (
    existing !== undefined &&
    (source.payload.previous === null ||
      existing.contentDigest !== source.payload.previous.contentDigest)
  ) {
    throw new ProviderServiceInstallationLifecycleErrorV1(
      "installation_tampered",
      "upgrade rollback path changed during recovery",
    );
  }
  await atomicWriteOwnedFileV1({
    path: rollbackPathV1(root),
    bytes: canonicalFileV1(snapshot),
    mode: 0o600,
    ownerUid: authority.authorityUid,
    ownerGid: authority.authorityGid,
    parentUid: authority.authorityUid,
    parentGid: authority.authorityGid,
    replace: existing !== undefined,
  });
  await authority.afterDurablePhase?.("upgrade_snapshot_published");
  return snapshot;
}

async function resumeUpgradeJournalV1(
  root: string,
  expectedRuntimeRoot: string,
  authority: AuthorityStateV1,
  options: ProviderServiceInstallationUpgradeOptionsV1,
  initialJournal: ProviderServiceInstallationControlJournalEnvelopeV1,
): Promise<ProviderServiceInstallationUpgradeResultV1> {
  const base = commonResultV1(root, expectedRuntimeRoot);
  if (!upgradeJournalTupleValidV1(initialJournal)) {
    return { ...base, status: "recovery_required", reason: "upgrade_journal_invalid" };
  }
  const source = initialJournal.payload.sourceManifest!;
  const target = initialJournal.payload.targetManifest!;
  let next: ProviderServiceHandoffConfigV1;
  try {
    next = verifyProviderServiceHandoffConfigV1(options.config);
  } catch {
    return { ...base, status: "recovery_required", reason: "upgrade_recovery_input_invalid" };
  }
  if (
    expectedRuntimeRoot !== target.payload.runtimeRoot ||
    next.payloadDigest !== target.payload.handoffPayloadDigest ||
    next.publicKey !== target.payload.servicePublicKey
  ) {
    return { ...base, status: "recovery_required", reason: "upgrade_recovery_identity_mismatch" };
  }
  let journal = initialJournal;
  if (journal.payload.phase === "files_pending") {
    try {
      await ensureUpgradeRollbackSnapshotV1(root, authority, journal);
      const configBytes = Buffer.from(`${JSON.stringify(next)}\n`, "utf8");
      const descriptorBytes = Buffer.from(
        renderProviderServiceDescriptorV1(next).descriptor,
        "utf8",
      );
      if (
        digestBytesV1(configBytes) !==
          target.payload.managedArtifacts[0]!.contentDigest ||
        digestBytesV1(descriptorBytes) !==
          target.payload.managedArtifacts[1]!.contentDigest
      ) throw new Error("upgrade target bytes do not match journal");
      await atomicWriteOwnedFileV1({
        path: target.payload.managedArtifacts[0]!.path,
        bytes: configBytes,
        mode: 0o644,
        ownerUid: authority.authorityUid,
        ownerGid: authority.authorityGid,
        parentUid: authority.authorityUid,
        parentGid: authority.authorityGid,
        replace: true,
      });
      await atomicWriteOwnedFileV1({
        path: target.payload.managedArtifacts[1]!.path,
        bytes: descriptorBytes,
        mode: 0o644,
        ownerUid: authority.authorityUid,
        ownerGid: authority.authorityGid,
        parentUid: authority.authorityUid,
        parentGid: authority.authorityGid,
        replace: true,
      });
      await atomicWriteOwnedFileV1({
        path: manifestPathV1(root),
        bytes: canonicalFileV1(target),
        mode: 0o600,
        ownerUid: authority.authorityUid,
        ownerGid: authority.authorityGid,
        parentUid: authority.authorityUid,
        parentGid: authority.authorityGid,
        replace: true,
      });
      journal = await advanceControlJournalV1(
        root,
        authority,
        journal,
        "control_invoked",
      );
    } catch {
      return { ...base, status: "recovery_required", reason: "upgrade_files_pending" };
    }
  }
  const exact = await inspectInstallationV1(
    root,
    expectedRuntimeRoot,
    authority,
    true,
  );
  if (
    exact.status !== "healthy" ||
    exact.handoffPayloadDigest !== target.payload.handoffPayloadDigest
  ) return { ...base, status: "recovery_required", reason: "upgrade_target_incomplete" };
  if (journal.payload.phase !== "control_confirmed") {
    try {
      await authority.controlService(
        "restart",
        controlContextFromManifestV1(target),
      );
      journal = await advanceControlJournalV1(
        root,
        authority,
        journal,
        "control_confirmed",
      );
    } catch {
      return { ...base, status: "recovery_required", reason: "restart_unconfirmed" };
    }
  }
  try {
    await removeControlJournalV1(root, authority);
  } catch {
    return { ...base, status: "recovery_required", reason: "upgrade_finalize_pending" };
  }
  return {
    ...base,
    status: "updated",
    fromPayloadDigest: source.payload.handoffPayloadDigest,
    payloadDigest: target.payload.handoffPayloadDigest,
    rollbackAvailable: true,
  };
}

async function upgradeInternalV1(
  capability: ProviderServiceInstallationPrivilegeCapabilityInternalV1,
  options: ProviderServiceInstallationUpgradeOptionsV1,
): Promise<ProviderServiceInstallationUpgradeResultV1> {
  const authority = requireProviderServiceInstallationPrivilegeInternalV1(
    capability,
  ) as AuthorityStateV1;
  const root = safeAbsolutePathV1(options.installationRoot, "installationRoot");
  const expectedRuntimeRoot = safeAbsolutePathV1(
    options.expectedRuntimeRoot,
    "expectedRuntimeRoot",
  );
  const base = commonResultV1(root, expectedRuntimeRoot);
  if (!(await installationRootPresentV1(root, authority))) {
    return { ...base, status: "not_installed" };
  }
  return runWithLifecycleLockV1<ProviderServiceInstallationUpgradeResultV1>(
    root,
    authority,
    () => ({ ...base, status: "refused", reason: "lifecycle_busy" }),
    async () => {
      const pending = await readControlJournalV1(root, authority, true);
      if (pending !== undefined) {
        if (pending.payload.operation !== "upgrade") {
          return { ...base, status: "recovery_required", reason: "other_recovery_pending" };
        }
        return resumeUpgradeJournalV1(
          root,
          expectedRuntimeRoot,
          authority,
          options,
          pending,
        );
      }
      const doctor = await inspectInstallationV1(
        root,
        expectedRuntimeRoot,
        authority,
      );
      if (doctor.status === "not_installed") return { ...base, status: "not_installed" };
      if (doctor.status !== "healthy") {
        return { ...base, status: "refused", reason: doctor.reason ?? "installation_tampered" };
      }
      const source = await readManifestV1(root, authority);
      if (source === undefined) return { ...base, status: "not_installed" };
      let current: ProviderServiceHandoffConfigV1;
      let next: ProviderServiceHandoffConfigV1;
      try {
        current = verifyProviderServiceHandoffConfigV1(JSON.parse(
          await readFile(source.payload.managedArtifacts[0]!.path, "utf8"),
        ) as unknown);
        next = verifyProviderServiceHandoffConfigV1(options.config);
      } catch {
        return { ...base, status: "refused", reason: "upgrade_config_invalid" };
      }
      if (
        next.payload.runtimeRoot !== expectedRuntimeRoot ||
        next.payload.platform !== authority.platform ||
        !exactImmutableUpgradeBindingsV1(current, next)
      ) return { ...base, status: "refused", reason: "identity_mismatch" };
      if (next.payloadDigest === current.payloadDigest) {
        return {
          ...base,
          status: "already_current",
          fromPayloadDigest: current.payloadDigest,
          payloadDigest: next.payloadDigest,
          rollbackAvailable: source.payload.previous !== null,
        };
      }
      const configObservation = await readCheckedFileV1({
        path: source.payload.managedArtifacts[0]!.path,
        uid: authority.authorityUid,
        gid: authority.authorityGid,
        mode: 0o644,
        maximumBytes: MAX_CONFIG_BYTES_V1,
      });
      const descriptorObservation = await readCheckedFileV1({
        path: source.payload.managedArtifacts[1]!.path,
        uid: authority.authorityUid,
        gid: authority.authorityGid,
        mode: 0o644,
        maximumBytes: MAX_DESCRIPTOR_BYTES_V1,
      });
      const normalizedSource = makeManifestV1(Object.freeze({
        ...source.payload,
        previous: null,
      }));
      const rollback = makeRollbackV1(Object.freeze({
        schemaVersion: 1 as const,
        profile: PROVIDER_SERVICE_INSTALLATION_ROLLBACK_PROFILE_V1,
        installationRoot: root,
        fromManifest: normalizedSource,
        files: Object.freeze([
          Object.freeze({
            kind: "service_config" as const,
            path: source.payload.managedArtifacts[0]!.path,
            contentDigest: configObservation.contentDigest,
            mode: 0o644,
            bytes: encodeBytesV1(configObservation.bytes),
          }),
          Object.freeze({
            kind: "service_descriptor" as const,
            path: source.payload.managedArtifacts[1]!.path,
            contentDigest: descriptorObservation.contentDigest,
            mode: 0o644,
            bytes: encodeBytesV1(descriptorObservation.bytes),
          }),
        ]),
      }));
      const configBytes = Buffer.from(`${JSON.stringify(next)}\n`, "utf8");
      const descriptorBytes = Buffer.from(
        renderProviderServiceDescriptorV1(next).descriptor,
        "utf8",
      );
      const auth = await readCheckedFileV1({
        path: source.payload.managedArtifacts[2]!.path,
        uid: source.payload.principal.uid,
        gid: source.payload.principal.gid,
        mode: 0o600,
        maximumBytes: MAX_KEY_BYTES_V1,
      });
      const signing = await readCheckedFileV1({
        path: source.payload.managedArtifacts[3]!.path,
        uid: source.payload.principal.uid,
        gid: source.payload.principal.gid,
        mode: 0o600,
        maximumBytes: MAX_KEY_BYTES_V1,
      });
      const target = makeManifestV1(buildManifestPayloadV1({
        root,
        generation: source.payload.manifestGeneration + 1,
        config: next,
        descriptorPath: source.payload.managedArtifacts[1]!.path,
        configBytes,
        descriptorBytes,
        authBytes: auth.bytes,
        signingBytes: signing.bytes,
        previous: Object.freeze({
          path: PROVIDER_SERVICE_INSTALLATION_ROLLBACK_FILE_V1,
          contentDigest: rollback.contentDigest,
          fromManifestGeneration: source.payload.manifestGeneration,
          fromHandoffPayloadDigest: source.payload.handoffPayloadDigest,
        }),
      }));
      const journal = makeControlJournalV1(Object.freeze({
        schemaVersion: 1 as const,
        profile: PROVIDER_SERVICE_INSTALLATION_CONTROL_JOURNAL_PROFILE_V1,
        installationRoot: root,
        operation: "upgrade" as const,
        phase: "files_pending" as const,
        sourceManifest: source,
        targetManifest: target,
        rollbackContentDigest: rollback.contentDigest,
        rollbackSnapshot: rollback,
        installationIdentityKeyDigest: null,
        installationIdentityDisposition: null,
        createdRuntimeRoot: false,
        runtimeRootCreationNonce: null,
        runtimeRootCustodyPin: null,
      }));
      await writeControlJournalV1(root, authority, journal, false);
      return resumeUpgradeJournalV1(
        root,
        expectedRuntimeRoot,
        authority,
        options,
        journal,
      );
    },
  );
}

function rollbackSnapshotMatchesManifestV1(
  root: string,
  manifest: ProviderServiceInstallationManifestEnvelopeV1,
  snapshot: ProviderServiceInstallationRollbackEnvelopeV1,
): boolean {
  if (
    snapshot.payload.installationRoot !== root ||
    snapshot.payload.fromManifest.payload.installationRoot !== root
  ) return false;
  const target = snapshot.payload.fromManifest;
  const targetConfig = target.payload.managedArtifacts[0];
  const targetDescriptor = target.payload.managedArtifacts[1];
  const configFile = snapshot.payload.files[0];
  const descriptorFile = snapshot.payload.files[1];
  if (
    targetConfig === undefined ||
    targetDescriptor === undefined ||
    configFile === undefined ||
    descriptorFile === undefined ||
    configFile.path !== targetConfig.path ||
    configFile.contentDigest !== targetConfig.contentDigest ||
    configFile.mode !== targetConfig.mode ||
    descriptorFile.path !== targetDescriptor.path ||
    descriptorFile.contentDigest !== targetDescriptor.contentDigest ||
    descriptorFile.mode !== targetDescriptor.mode
  ) return false;

  const pin = manifest.payload.previous;
  const committedRollback = pin !== null &&
    snapshot.contentDigest === pin.contentDigest &&
    target.payload.manifestGeneration === pin.fromManifestGeneration &&
    target.payload.handoffPayloadDigest === pin.fromHandoffPayloadDigest;
  // Upgrade writes the strict snapshot before replacing any managed file.  If
  // the process dies before the new manifest commit, the current manifest is
  // still the snapshot baseline (with its former one-level pin consumed).
  const interruptedUpgradeBaseline = makeManifestV1(Object.freeze({
    ...manifest.payload,
    previous: null,
  }));
  return committedRollback ||
    target.contentDigest === interruptedUpgradeBaseline.contentDigest;
}

type PinnedRollbackPublicationActionV1 =
  | "inspect"
  | "converge"
  | "remove";

async function readPinnedRollbackPublicationV1(input: {
  readonly root: string;
  readonly authority: AuthorityStateV1;
  readonly manifest: ProviderServiceInstallationManifestEnvelopeV1;
  readonly expectedDigest?: ContentDigestV1;
  readonly expectedEnvelope?: ProviderServiceInstallationRollbackEnvelopeV1;
  readonly action: PinnedRollbackPublicationActionV1;
}): Promise<ProviderServiceInstallationRollbackEnvelopeV1 | undefined> {
  const canonicalPath = rollbackPathV1(input.root);
  const stagingPath = atomicPublishStagingPathV1(canonicalPath);
  const canonical = await readRollbackPublicationCandidateV1(
    canonicalPath,
    input.authority,
    false,
  );
  const staged = await readRollbackPublicationCandidateV1(
    stagingPath,
    input.authority,
    true,
  );
  if (canonical === undefined && staged === undefined) return undefined;

  const expectedBytes = input.expectedEnvelope === undefined
    ? undefined
    : canonicalFileV1(input.expectedEnvelope);
  for (const candidate of [canonical, staged]) {
    if (candidate === undefined) continue;
    if (
      (input.expectedDigest !== undefined &&
        candidate.snapshot.contentDigest !== input.expectedDigest) ||
      (expectedBytes !== undefined &&
        !candidate.observation.bytes.equals(expectedBytes)) ||
      !rollbackSnapshotMatchesManifestV1(
        input.root,
        input.manifest,
        candidate.snapshot,
      )
    ) {
      throw new ProviderServiceInstallationLifecycleErrorV1(
        "installation_tampered",
        "provider service rollback publication is not manifest-pinned",
      );
    }
  }

  if (
    canonical !== undefined &&
    staged !== undefined &&
    canonical.observation.nlink === 1 &&
    staged.observation.nlink === 1
  ) {
    throw new ProviderServiceInstallationLifecycleErrorV1(
      "installation_tampered",
      "provider service rollback has independent canonical and staging inodes",
    );
  }
  if (
    canonical?.observation.nlink === 2 ||
    staged?.observation.nlink === 2
  ) {
    if (
      canonical === undefined ||
      staged === undefined ||
      canonical.observation.nlink !== 2 ||
      staged.observation.nlink !== 2 ||
      canonical.observation.dev !== staged.observation.dev ||
      canonical.observation.ino !== staged.observation.ino ||
      !canonical.observation.bytes.equals(staged.observation.bytes)
    ) {
      throw new ProviderServiceInstallationLifecycleErrorV1(
        "installation_tampered",
        "provider service rollback publish pair is not one pinned inode",
      );
    }
  }

  const selected = staged ?? canonical!;
  if (input.action === "converge" && staged !== undefined) {
    await atomicWriteOwnedFileV1({
      path: canonicalPath,
      bytes: selected.observation.bytes,
      mode: 0o600,
      ownerUid: input.authority.authorityUid,
      ownerGid: input.authority.authorityGid,
      parentUid: input.authority.authorityUid,
      parentGid: input.authority.authorityGid,
      replace: canonical !== undefined && staged.observation.nlink === 1,
    });
  } else if (input.action === "remove") {
    await removeExactAtomicPublicationIfPresentV1({
      path: canonicalPath,
      expectedDigest: digestBytesV1(selected.observation.bytes),
      expectedByteLength: selected.observation.bytes.byteLength,
      uid: input.authority.authorityUid,
      gid: input.authority.authorityGid,
      mode: 0o600,
      maximumBytes: MAX_ROLLBACK_BYTES_V1,
      label: "provider service rollback snapshot",
      authorityUid: input.authority.authorityUid,
      authorityGid: input.authority.authorityGid,
      afterStagingRemoved: () => input.authority.afterDurablePhase?.(
        "rollback_publish_stage_removed",
      ),
    });
  }
  return selected.snapshot;
}

async function assertRollbackPublicationAbsentV1(
  root: string,
): Promise<void> {
  for (const path of [
    rollbackPathV1(root),
    atomicPublishStagingPathV1(rollbackPathV1(root)),
  ]) {
    try {
      await lstat(path);
    } catch (error) {
      if (isMissingV1(error)) continue;
      throw error;
    }
    throw new ProviderServiceInstallationLifecycleErrorV1(
      "installation_tampered",
      "unexpected provider service rollback publication appeared",
    );
  }
}

function doctorAllowsRollbackRecoveryV1(
  doctor: ProviderServiceInstallationDoctorResultV1,
): boolean {
  if (doctor.status === "healthy") return true;
  if (
    doctor.status !== "tampered" ||
    doctor.reason === "manifest_identity_mismatch"
  ) return false;
  const failed = doctor.artifacts.filter((item) => item.state !== "ok");
  return failed.length > 0 && failed.every((item) =>
    item.kind === "service_config" ||
    item.kind === "service_descriptor" ||
    item.kind === "rollback"
  );
}

async function rollbackInternalV1(
  capability: ProviderServiceInstallationPrivilegeCapabilityInternalV1,
  options: ProviderServiceInstallationTargetOptionsV1,
): Promise<ProviderServiceInstallationRollbackResultV1> {
  const authority = requireProviderServiceInstallationPrivilegeInternalV1(capability) as AuthorityStateV1;
  const root = safeAbsolutePathV1(options.installationRoot, "installationRoot");
  const expectedRuntimeRoot = safeAbsolutePathV1(options.expectedRuntimeRoot, "expectedRuntimeRoot");
  return enqueueInstallationOperationV1(root, async () => {
    const base = commonResultV1(root, expectedRuntimeRoot);
    if (!(await installationRootPresentV1(root, authority))) {
      return { ...base, status: "not_installed", removedPaths: [], refusedPaths: [] };
    }
    return runWithLifecycleLockV1<ProviderServiceInstallationRollbackResultV1>(
      root,
      authority,
      () => ({
        ...base,
        status: "refused" as const,
        removedPaths: Object.freeze([]),
        refusedPaths: Object.freeze([lifecycleLockPathV1(root)]),
        reason: "lifecycle_busy",
      }),
      async () => {
    const pendingJournal = await readControlJournalV1(root, authority, true);
    if (pendingJournal !== undefined) {
      return {
        ...base,
        status: "refused",
        removedPaths: [],
        refusedPaths: [controlJournalPathV1(root)],
        reason: "control_recovery_pending",
      };
    }
    let manifest: ProviderServiceInstallationManifestEnvelopeV1 | undefined;
    try {
      manifest = await readManifestV1(root, authority);
    } catch {
      return { ...base, status: "refused", removedPaths: [], refusedPaths: [manifestPathV1(root)], reason: "rollback_snapshot_invalid" };
    }
    if (manifest === undefined) return { ...base, status: "not_installed", removedPaths: [], refusedPaths: [] };
    if (
      manifest.payload.installationRoot !== root ||
      manifest.payload.runtimeRoot !== expectedRuntimeRoot ||
      manifest.payload.retainedState.runtimeRoot !== expectedRuntimeRoot ||
      manifest.payload.platform !== authority.platform
    ) {
      return { ...base, status: "refused", removedPaths: [], refusedPaths: [manifestPathV1(root)], reason: "rollback_snapshot_invalid" };
    }
    let snapshot: ProviderServiceInstallationRollbackEnvelopeV1 | undefined;
    try {
      snapshot = await readPinnedRollbackPublicationV1({
        root,
        authority,
        manifest,
        ...(manifest.payload.previous === null
          ? {}
          : { expectedDigest: manifest.payload.previous.contentDigest }),
        action: "converge",
      });
    } catch {
      return { ...base, status: "refused", removedPaths: [], refusedPaths: [rollbackPathV1(root)], reason: "rollback_snapshot_invalid" };
    }
    let doctor = await inspectInstallationV1(root, expectedRuntimeRoot, authority);
    if (snapshot === undefined) {
      if (doctor.status === "healthy" && manifest.payload.previous === null) {
        return { ...base, status: "not_available", removedPaths: [], refusedPaths: [], reason: "rollback_not_available" };
      }
      return { ...base, status: "refused", removedPaths: [], refusedPaths: doctor.artifacts.filter((item) => item.state !== "ok").map((item) => item.path), reason: doctor.reason ?? "installation_tampered" };
    }
    const configFile = snapshot.payload.files[0]!;
    const descriptorFile = snapshot.payload.files[1]!;
    try {
      const currentConfig = manifest.payload.managedArtifacts[0]!;
      const currentDescriptor = manifest.payload.managedArtifacts[1]!;
      const currentManifestBytes = canonicalFileV1(manifest);
      for (const publication of [
        {
          path: configFile.path,
          bytes: decodeBytesV1(configFile.bytes),
          mode: configFile.mode,
          maximumBytes: MAX_CONFIG_BYTES_V1,
          label: "provider service rollback config",
          expectedReplaceBaseline: Object.freeze({
            contentDigest: currentConfig.contentDigest,
            byteLength: currentConfig.byteLength,
          }),
        },
        {
          path: descriptorFile.path,
          bytes: decodeBytesV1(descriptorFile.bytes),
          mode: descriptorFile.mode,
          maximumBytes: MAX_DESCRIPTOR_BYTES_V1,
          label: "provider service rollback descriptor",
          expectedReplaceBaseline: Object.freeze({
            contentDigest: currentDescriptor.contentDigest,
            byteLength: currentDescriptor.byteLength,
          }),
        },
        {
          path: manifestPathV1(root),
          bytes: canonicalFileV1(snapshot.payload.fromManifest),
          mode: 0o600,
          maximumBytes: MAX_MANIFEST_BYTES_V1,
          label: "provider service rollback manifest",
          expectedReplaceBaseline: Object.freeze({
            contentDigest: digestBytesV1(currentManifestBytes),
            byteLength: currentManifestBytes.byteLength,
          }),
        },
      ]) {
        await convergePinnedAtomicPublicationStageIfPresentV1({
          ...publication,
          uid: authority.authorityUid,
          gid: authority.authorityGid,
          authorityUid: authority.authorityUid,
          authorityGid: authority.authorityGid,
          allowCreate: false,
        });
      }
      manifest = await readManifestV1(root, authority);
    } catch {
      return { ...base, status: "refused", removedPaths: [], refusedPaths: [rollbackPathV1(root)], reason: "rollback_snapshot_invalid" };
    }
    if (manifest === undefined) {
      return { ...base, status: "refused", removedPaths: [], refusedPaths: [manifestPathV1(root)], reason: "rollback_snapshot_invalid" };
    }
    doctor = await inspectInstallationV1(root, expectedRuntimeRoot, authority);
    if (
      !doctorAllowsRollbackRecoveryV1(doctor) ||
      !rollbackSnapshotMatchesManifestV1(root, manifest, snapshot)
    ) {
      return { ...base, status: "refused", removedPaths: [], refusedPaths: doctor.artifacts.filter((item) => item.state !== "ok").map((item) => item.path), reason: "rollback_snapshot_invalid" };
    }
    try {
      await atomicWriteOwnedFileV1({ path: configFile.path, bytes: decodeBytesV1(configFile.bytes), mode: configFile.mode, ownerUid: authority.authorityUid, ownerGid: authority.authorityGid, parentUid: authority.authorityUid, parentGid: authority.authorityGid, replace: true });
      await atomicWriteOwnedFileV1({ path: descriptorFile.path, bytes: decodeBytesV1(descriptorFile.bytes), mode: descriptorFile.mode, ownerUid: authority.authorityUid, ownerGid: authority.authorityGid, parentUid: authority.authorityUid, parentGid: authority.authorityGid, replace: true });
      await atomicWriteOwnedFileV1({ path: manifestPathV1(root), bytes: canonicalFileV1(snapshot.payload.fromManifest), mode: 0o600, ownerUid: authority.authorityUid, ownerGid: authority.authorityGid, parentUid: authority.authorityUid, parentGid: authority.authorityGid, replace: true });
      await authority.controlService("restart", {
        platform: snapshot.payload.fromManifest.payload.platform,
        serviceLabel: snapshot.payload.fromManifest.payload.serviceLabel,
        descriptorPath: descriptorFile.path,
      });
      await removePinnedRollbackIfPresentV1(
        root,
        authority,
        snapshot.payload.fromManifest,
        snapshot,
      );
    } catch {
      // The strict snapshot remains the only recovery authority.  Retrying
      // rollback is idempotent across every config/descriptor/manifest cut.
      return { ...base, status: "partial", removedPaths: [], refusedPaths: [rollbackPathV1(root)], reason: "rollback_failed" };
    }
    return { ...base, status: "rolled_back", removedPaths: [rollbackPathV1(root)], refusedPaths: [], payloadDigest: snapshot.payload.fromManifest.payload.handoffPayloadDigest };
      },
    );
  });
}

async function validateEphemeralForRemovalV1(
  path: string,
  kind: "socket" | "readiness",
  principal: ProviderServicePrincipalV1,
): Promise<boolean> {
  try {
    const metadata = await lstat(path);
    if (metadata.isSymbolicLink() || metadata.uid !== principal.uid || metadata.gid !== principal.gid) return false;
    return kind === "socket"
      ? metadata.isSocket()
      : metadata.isFile() && exactModeV1(metadata.mode) === 0o600 && metadata.nlink === 1;
  } catch (error) {
    return isMissingV1(error);
  }
}

async function pinRuntimeRootForJournalV1(
  manifest: ProviderServiceInstallationManifestEnvelopeV1,
  authority: AuthorityStateV1,
  expectedOwner: "principal" | "authority",
): Promise<Readonly<{ readonly dev: number; readonly ino: number }>> {
  const root = manifest.payload.runtimeRoot;
  const owner = expectedOwner === "authority"
    ? { uid: authority.authorityUid, gid: authority.authorityGid }
    : manifest.payload.principal;
  await checkedWritableParentV1(
    root,
    authority.authorityUid,
    authority.authorityGid,
  );
  const before = await lstat(root);
  if (
    before.isSymbolicLink() ||
    !before.isDirectory() ||
    before.uid !== owner.uid ||
    before.gid !== owner.gid ||
    exactModeV1(before.mode) !== 0o700 ||
    !Number.isSafeInteger(before.dev) ||
    !Number.isSafeInteger(before.ino) ||
    await realpath(root) !== root
  ) {
    throw new ProviderServiceInstallationLifecycleErrorV1(
      "installation_tampered",
      "provider runtime root cannot be pinned for the control journal",
    );
  }
  let handle: FileHandle | undefined;
  try {
    handle = await open(
      root,
      constants.O_RDONLY |
        (typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0) |
        (typeof constants.O_DIRECTORY === "number" ? constants.O_DIRECTORY : 0),
    );
    const opened = await handle.stat();
    assertProviderRuntimeNativeFdHasNoExtendedAccessControlV1(handle.fd, {
      expectedKind: "directory",
    });
    const after = await lstat(root);
    if (
      !opened.isDirectory() ||
      opened.dev !== before.dev ||
      opened.ino !== before.ino ||
      opened.uid !== before.uid ||
      opened.gid !== before.gid ||
      exactModeV1(opened.mode) !== 0o700 ||
      after.isSymbolicLink() ||
      !after.isDirectory() ||
      after.dev !== opened.dev ||
      after.ino !== opened.ino ||
      after.uid !== opened.uid ||
      after.gid !== opened.gid ||
      exactModeV1(after.mode) !== 0o700
    ) {
      throw new ProviderServiceInstallationLifecycleErrorV1(
        "installation_tampered",
        "provider runtime root changed while pinning the control journal",
      );
    }
    return Object.freeze({ dev: opened.dev, ino: opened.ino });
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function pinRuntimeRootForUninstallV1(
  manifest: ProviderServiceInstallationManifestEnvelopeV1,
  authority: AuthorityStateV1,
): Promise<Readonly<{ readonly dev: number; readonly ino: number }>> {
  return pinRuntimeRootForJournalV1(manifest, authority, "principal");
}

async function ensureInstallRuntimeRootPinV1(
  root: string,
  authority: AuthorityStateV1,
  journal: ProviderServiceInstallationControlJournalEnvelopeV1,
): Promise<ProviderServiceInstallationControlJournalEnvelopeV1> {
  const target = journal.payload.targetManifest;
  if (
    journal.payload.operation !== "install" ||
    target === null
  ) {
    throw new ProviderServiceInstallationLifecycleErrorV1(
      "manifest_invalid",
      "install runtime root pin transition is invalid",
    );
  }
  if (journal.payload.runtimeRootCustodyPin !== null) return journal;
  if (
    journal.payload.phase !== "files_pending" ||
    !journal.payload.createdRuntimeRoot
  ) {
    throw new ProviderServiceInstallationLifecycleErrorV1(
      "manifest_invalid",
      "reused install runtime root has no durable pin",
    );
  }
  try {
    await lstat(target.payload.runtimeRoot);
  } catch (error) {
    if (isMissingV1(error)) return journal;
    throw error;
  }
  if (!(await inspectRuntimeRootCreationMarkerV1(journal, authority))) {
    throw new ProviderServiceInstallationLifecycleErrorV1(
      "installation_tampered",
      "created runtime root exists without its creation marker",
    );
  }
  const runtimeRootCustodyPin = await pinRuntimeRootForJournalV1(
    target,
    authority,
    "authority",
  );
  const next = makeControlJournalV1(Object.freeze({
    ...journal.payload,
    runtimeRootCustodyPin,
  }));
  await writeControlJournalV1(root, authority, next, true);
  return next;
}

async function assertRuntimeRootCustodyV1(
  handle: FileHandle,
  manifest: ProviderServiceInstallationManifestEnvelopeV1,
  authority: AuthorityStateV1,
  pin: Readonly<{ readonly dev: number; readonly ino: number }>,
): Promise<void> {
  const root = manifest.payload.runtimeRoot;
  await checkedWritableParentV1(
    root,
    authority.authorityUid,
    authority.authorityGid,
  );
  const opened = await handle.stat();
  assertProviderRuntimeNativeFdHasNoExtendedAccessControlV1(handle.fd, {
    expectedKind: "directory",
  });
  const path = await lstat(root);
  if (
    !opened.isDirectory() ||
    opened.dev !== pin.dev ||
    opened.ino !== pin.ino ||
    opened.uid !== authority.authorityUid ||
    opened.gid !== authority.authorityGid ||
    exactModeV1(opened.mode) !== 0o700 ||
    path.isSymbolicLink() ||
    !path.isDirectory() ||
    path.dev !== opened.dev ||
    path.ino !== opened.ino ||
    path.uid !== opened.uid ||
    path.gid !== opened.gid ||
    exactModeV1(path.mode) !== 0o700 ||
    await realpath(root) !== root
  ) {
    throw new ProviderServiceInstallationLifecycleErrorV1(
      "installation_tampered",
      "provider runtime root custody path changed",
    );
  }
}

async function acquireRuntimeRootCustodyV1(
  manifest: ProviderServiceInstallationManifestEnvelopeV1,
  authority: AuthorityStateV1,
  pin: Readonly<{ readonly dev: number; readonly ino: number }>,
  phase:
    | "uninstall_runtime_root_custody_acquired"
    | "install_runtime_root_custody_acquired",
): Promise<FileHandle> {
  const root = manifest.payload.runtimeRoot;
  await checkedWritableParentV1(
    root,
    authority.authorityUid,
    authority.authorityGid,
  );
  const before = await lstat(root);
  const principal = manifest.payload.principal;
  const ownerAllowed =
    (before.uid === principal.uid && before.gid === principal.gid) ||
    (before.uid === authority.authorityUid && before.gid === authority.authorityGid);
  if (
    before.isSymbolicLink() ||
    !before.isDirectory() ||
    before.dev !== pin.dev ||
    before.ino !== pin.ino ||
    !ownerAllowed ||
    exactModeV1(before.mode) !== 0o700 ||
    await realpath(root) !== root
  ) {
    throw new ProviderServiceInstallationLifecycleErrorV1(
      "installation_tampered",
      "provider runtime root no longer matches the control journal pin",
    );
  }
  let handle: FileHandle | undefined;
  try {
    handle = await open(
      root,
      constants.O_RDONLY |
        (typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0) |
        (typeof constants.O_DIRECTORY === "number" ? constants.O_DIRECTORY : 0),
    );
    const opened = await handle.stat();
    assertProviderRuntimeNativeFdHasNoExtendedAccessControlV1(handle.fd, {
      expectedKind: "directory",
    });
    const openedOwnerAllowed =
      (opened.uid === principal.uid && opened.gid === principal.gid) ||
      (opened.uid === authority.authorityUid && opened.gid === authority.authorityGid);
    if (
      !opened.isDirectory() ||
      opened.dev !== before.dev ||
      opened.ino !== before.ino ||
      !openedOwnerAllowed ||
      exactModeV1(opened.mode) !== 0o700
    ) {
      throw new ProviderServiceInstallationLifecycleErrorV1(
        "installation_tampered",
        "provider runtime root changed before custody",
      );
    }
    if (
      opened.uid !== authority.authorityUid ||
      opened.gid !== authority.authorityGid
    ) {
      await handle.chown(authority.authorityUid, authority.authorityGid);
    }
    if (exactModeV1(opened.mode) !== 0o700) await handle.chmod(0o700);
    await handle.sync();
    await syncDirectoryV1(dirname(root));
    await assertRuntimeRootCustodyV1(handle, manifest, authority, pin);
    await authority.afterDurablePhase?.(phase);
    await assertRuntimeRootCustodyV1(handle, manifest, authority, pin);
    const result = handle;
    handle = undefined;
    return result;
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function restoreRuntimeRootCustodyV1(
  handle: FileHandle,
  manifest: ProviderServiceInstallationManifestEnvelopeV1,
  authority: AuthorityStateV1,
  pin: Readonly<{ readonly dev: number; readonly ino: number }>,
): Promise<void> {
  await assertRuntimeRootCustodyV1(handle, manifest, authority, pin);
  const principal = manifest.payload.principal;
  const before = await handle.stat();
  if (before.uid !== principal.uid || before.gid !== principal.gid) {
    await handle.chown(principal.uid, principal.gid);
  }
  if (exactModeV1(before.mode) !== 0o700) await handle.chmod(0o700);
  await handle.sync();
  await syncDirectoryV1(dirname(manifest.payload.runtimeRoot));
  const restored = await handle.stat();
  assertProviderRuntimeNativeFdHasNoExtendedAccessControlV1(handle.fd, {
    expectedKind: "directory",
  });
  const path = await lstat(manifest.payload.runtimeRoot);
  if (
    restored.dev !== pin.dev ||
    restored.ino !== pin.ino ||
    restored.uid !== principal.uid ||
    restored.gid !== principal.gid ||
    exactModeV1(restored.mode) !== 0o700 ||
    path.dev !== restored.dev ||
    path.ino !== restored.ino ||
    path.uid !== restored.uid ||
    path.gid !== restored.gid ||
    exactModeV1(path.mode) !== 0o700
  ) {
    throw new ProviderServiceInstallationLifecycleErrorV1(
      "installation_tampered",
      "provider runtime root custody did not restore exactly",
    );
  }
}

function uninstallJournalTupleValidV1(
  journal: ProviderServiceInstallationControlJournalEnvelopeV1,
): boolean {
  const source = journal.payload.sourceManifest;
  return journal.payload.operation === "uninstall" &&
    source !== null &&
    journal.payload.runtimeRootCustodyPin !== null &&
    journal.payload.targetManifest === null &&
    journal.payload.rollbackContentDigest ===
      (source.payload.previous?.contentDigest ?? null);
}

async function validateUninstallJournalArtifactsV1(
  root: string,
  authority: AuthorityStateV1,
  journal: ProviderServiceInstallationControlJournalEnvelopeV1,
): Promise<void> {
  const source = journal.payload.sourceManifest!;

  // Validate the complete removal set before the first unlink.  Missing is an
  // idempotent replay state; every path that still exists must remain the
  // exact inode class/owner/mode/digest authorized by the journal.
  const manifest = await readManifestV1(root, authority);
  if (manifest !== undefined && manifest.contentDigest !== source.contentDigest) {
    throw new ProviderServiceInstallationLifecycleErrorV1(
      "installation_tampered",
      "provider service manifest changed during uninstall recovery",
    );
  }
  const manifestBytes = canonicalFileV1(source);
  await removeExactAtomicPublicationIfPresentV1({
    path: manifestPathV1(root),
    expectedDigest: digestBytesV1(manifestBytes),
    expectedByteLength: manifestBytes.byteLength,
    uid: authority.authorityUid,
    gid: authority.authorityGid,
    mode: 0o600,
    maximumBytes: MAX_MANIFEST_BYTES_V1,
    label: "provider service manifest",
    authorityUid: authority.authorityUid,
    authorityGid: authority.authorityGid,
    remove: false,
  });
  for (const artifact of source.payload.managedArtifacts) {
    await validatePinnedArtifactPublicationV1(
      artifact,
      source.payload,
      authority,
    );
    const owner = ownerForArtifactV1(artifact, source.payload, authority);
    let observed: FileObservationV1;
    try {
      observed = await readCheckedFileV1({
        path: artifact.path,
        uid: owner.uid,
        gid: owner.gid,
        mode: artifact.mode,
        maximumBytes: maximumForKindV1(artifact.kind),
      });
    } catch (error) {
      if (isMissingV1(error)) continue;
      throw new ProviderServiceInstallationLifecycleErrorV1(
        "installation_tampered",
        "provider service managed artifact is unsafe during uninstall recovery",
        { cause: error },
      );
    }
    if (
      observed.contentDigest !== artifact.contentDigest ||
      observed.bytes.byteLength !== artifact.byteLength
    ) {
      throw new ProviderServiceInstallationLifecycleErrorV1(
        "installation_tampered",
        "provider service managed artifact changed during uninstall recovery",
      );
    }
  }
  for (const item of [
    { path: source.payload.ephemeralPaths.socketPath, kind: "socket" as const },
    { path: source.payload.ephemeralPaths.readinessPath, kind: "readiness" as const },
  ]) {
    if (!(await validateEphemeralForRemovalV1(
      item.path,
      item.kind,
      source.payload.principal,
    ))) {
      throw new ProviderServiceInstallationLifecycleErrorV1(
        "installation_tampered",
        "provider service ephemeral path is unsafe during uninstall recovery",
      );
    }
  }
  const expectedRollback = journal.payload.rollbackContentDigest;
  if (expectedRollback === null) {
    await assertRollbackPublicationAbsentV1(root);
  } else {
    await readPinnedRollbackPublicationV1({
      root,
      authority,
      manifest: source,
      expectedDigest: expectedRollback,
      action: "inspect",
    });
  }
}

async function removeUninstallJournalArtifactsV1(
  root: string,
  authority: AuthorityStateV1,
  journal: ProviderServiceInstallationControlJournalEnvelopeV1,
  removedPaths: string[],
): Promise<void> {
  const source = journal.payload.sourceManifest!;
  const custodyPin = journal.payload.runtimeRootCustodyPin!;
  const custody = await acquireRuntimeRootCustodyV1(
    source,
    authority,
    custodyPin,
    "uninstall_runtime_root_custody_acquired",
  );
  try {
    // Custody changes the service-writable parent into an authority-owned
    // 0700 directory before the complete removal set is re-read.  No pathname
    // unlink below is authorized by an observation made before this barrier.
    await validateUninstallJournalArtifactsV1(root, authority, journal);
    let firstManagedRemovalObserved = false;
    for (const artifact of source.payload.managedArtifacts) {
      const existed = await pathExistsV1(artifact.path);
      await removePinnedArtifactIfPresentV1(artifact, source.payload, authority);
      if (existed) {
        removedPaths.push(artifact.path);
        if (!firstManagedRemovalObserved) {
          firstManagedRemovalObserved = true;
          await authority.afterDurablePhase?.(
            "uninstall_first_artifact_removed",
          );
        }
      }
    }
    for (const item of [
      { path: source.payload.ephemeralPaths.socketPath, kind: "socket" as const },
      { path: source.payload.ephemeralPaths.readinessPath, kind: "readiness" as const },
    ]) {
      if (!(await validateEphemeralForRemovalV1(
        item.path,
        item.kind,
        source.payload.principal,
      ))) {
        throw new ProviderServiceInstallationLifecycleErrorV1(
          "installation_tampered",
          "provider service ephemeral path is unsafe during uninstall recovery",
        );
      }
      try {
        await unlinkAndSyncV1(item.path);
        removedPaths.push(item.path);
      } catch (error) {
        if (!isMissingV1(error)) throw error;
      }
    }
    await assertRuntimeRootCustodyV1(custody, source, authority, custodyPin);
    await restoreRuntimeRootCustodyV1(custody, source, authority, custodyPin);
  } finally {
    await custody.close().catch(() => undefined);
  }
  const expectedRollback = journal.payload.rollbackContentDigest;
  if (expectedRollback === null) {
    await assertRollbackPublicationAbsentV1(root);
  } else {
    const rollback = await readPinnedRollbackPublicationV1({
      root,
      authority,
      manifest: source,
      expectedDigest: expectedRollback,
      action: "remove",
    });
    if (rollback !== undefined) removedPaths.push(rollbackPathV1(root));
  }
  const manifestExisted = await pathExistsV1(manifestPathV1(root));
  await removePinnedManifestIfPresentV1(root, authority, source);
  if (manifestExisted) removedPaths.push(manifestPathV1(root));
}

function successfulUninstallResultV1(
  base: ProviderServiceInstallationResultBaseV1,
  source: ProviderServiceInstallationManifestEnvelopeV1,
  removedPaths: readonly string[],
): ProviderServiceInstallationUninstallResultV1 {
  return {
    ...base,
    status: "removed_with_retained_state",
    removedPaths,
    refusedPaths: [],
    retainedState: Object.freeze([
      "runtime_root" as const,
      "provider_durable_state" as const,
      ...(source.payload.retainedState.installationIdentityKeyPath === null
        ? []
        : ["installation_identity_key" as const]),
    ]),
  };
}

async function resumeUninstallJournalV1(
  root: string,
  expectedRuntimeRoot: string,
  authority: AuthorityStateV1,
  initialJournal: ProviderServiceInstallationControlJournalEnvelopeV1,
): Promise<ProviderServiceInstallationUninstallResultV1> {
  const base = commonResultV1(root, expectedRuntimeRoot);
  if (!uninstallJournalTupleValidV1(initialJournal)) {
    return { ...base, status: "recovery_required", removedPaths: [], refusedPaths: [controlJournalPathV1(root)], reason: "uninstall_journal_invalid" };
  }
  const source = initialJournal.payload.sourceManifest!;
  if (source.payload.runtimeRoot !== expectedRuntimeRoot) {
    return { ...base, status: "recovery_required", removedPaths: [], refusedPaths: [controlJournalPathV1(root)], reason: "uninstall_recovery_identity_mismatch" };
  }
  let journal = initialJournal;
  if (
    journal.payload.phase === "files_pending" ||
    journal.payload.phase === "control_invoked"
  ) {
    if (journal.payload.phase === "files_pending") {
      journal = await advanceControlJournalV1(
        root,
        authority,
        journal,
        "control_invoked",
      );
    }
    try {
      await authority.controlService(
        "deactivate",
        controlContextFromManifestV1(source),
      );
      journal = await advanceControlJournalV1(
        root,
        authority,
        journal,
        "control_confirmed",
      );
    } catch {
      return { ...base, status: "recovery_required", removedPaths: [], refusedPaths: [controlJournalPathV1(root)], reason: "deactivation_unconfirmed" };
    }
  }
  if (journal.payload.phase !== "control_confirmed") {
    return { ...base, status: "recovery_required", removedPaths: [], refusedPaths: [controlJournalPathV1(root)], reason: "uninstall_phase_invalid" };
  }
  const removedPaths: string[] = [];
  try {
    await removeUninstallJournalArtifactsV1(
      root,
      authority,
      journal,
      removedPaths,
    );
    await removeControlJournalV1(root, authority);
  } catch {
    return {
      ...base,
      status: "recovery_required",
      removedPaths,
      refusedPaths: [controlJournalPathV1(root)],
      reason: "uninstall_cleanup_pending",
    };
  }
  return successfulUninstallResultV1(base, source, removedPaths);
}

async function uninstallInternalV1(
  capability: ProviderServiceInstallationPrivilegeCapabilityInternalV1,
  options: ProviderServiceInstallationTargetOptionsV1,
): Promise<ProviderServiceInstallationUninstallResultV1> {
  const authority = requireProviderServiceInstallationPrivilegeInternalV1(
    capability,
  ) as AuthorityStateV1;
  const root = safeAbsolutePathV1(options.installationRoot, "installationRoot");
  const expectedRuntimeRoot = safeAbsolutePathV1(
    options.expectedRuntimeRoot,
    "expectedRuntimeRoot",
  );
  const base = commonResultV1(root, expectedRuntimeRoot);
  if (!(await installationRootPresentV1(root, authority))) {
    return { ...base, status: "not_installed", removedPaths: [], refusedPaths: [] };
  }
  return runWithLifecycleLockV1<ProviderServiceInstallationUninstallResultV1>(
    root,
    authority,
    () => ({ ...base, status: "refused", removedPaths: [], refusedPaths: [lifecycleLockPathV1(root)], reason: "lifecycle_busy" }),
    async () => {
      const pending = await readControlJournalV1(root, authority, true);
      if (pending !== undefined) {
        if (pending.payload.operation !== "uninstall") {
          return { ...base, status: "recovery_required", removedPaths: [], refusedPaths: [controlJournalPathV1(root)], reason: "other_recovery_pending" };
        }
        return resumeUninstallJournalV1(
          root,
          expectedRuntimeRoot,
          authority,
          pending,
        );
      }
      let source: ProviderServiceInstallationManifestEnvelopeV1 | undefined;
      try {
        source = await readManifestV1(root, authority);
      } catch {
        return { ...base, status: "refused", removedPaths: [], refusedPaths: [manifestPathV1(root)], reason: "installation_tampered" };
      }
      if (source === undefined) {
        return { ...base, status: "not_installed", removedPaths: [], refusedPaths: [] };
      }
      if (
        source.payload.installationRoot === root &&
        source.payload.runtimeRoot === expectedRuntimeRoot &&
        source.payload.retainedState.runtimeRoot === expectedRuntimeRoot &&
        source.payload.platform === authority.platform
      ) {
        try {
          if (source.payload.previous === null) {
            await assertRollbackPublicationAbsentV1(root);
          } else {
            await readPinnedRollbackPublicationV1({
              root,
              authority,
              manifest: source,
              expectedDigest: source.payload.previous.contentDigest,
              action: "converge",
            });
          }
        } catch {
          return { ...base, status: "refused", removedPaths: [], refusedPaths: [rollbackPathV1(root)], reason: "installation_tampered" };
        }
      }
      const doctor = await inspectInstallationV1(
        root,
        expectedRuntimeRoot,
        authority,
      );
      if (doctor.status === "not_installed") {
        return { ...base, status: "not_installed", removedPaths: [], refusedPaths: [] };
      }
      if (doctor.status !== "healthy") {
        return { ...base, status: "refused", removedPaths: [], refusedPaths: doctor.artifacts.filter((item) => item.state !== "ok").map((item) => item.path), reason: doctor.reason ?? "installation_tampered" };
      }
      source = await readManifestV1(root, authority);
      if (source === undefined) {
        return { ...base, status: "not_installed", removedPaths: [], refusedPaths: [] };
      }
      let runtimeRootCustodyPin: Readonly<{
        readonly dev: number;
        readonly ino: number;
      }>;
      try {
        runtimeRootCustodyPin = await pinRuntimeRootForUninstallV1(
          source,
          authority,
        );
      } catch {
        return { ...base, status: "refused", removedPaths: [], refusedPaths: [source.payload.runtimeRoot], reason: "installation_tampered" };
      }
      const journal = makeControlJournalV1(Object.freeze({
        schemaVersion: 1 as const,
        profile: PROVIDER_SERVICE_INSTALLATION_CONTROL_JOURNAL_PROFILE_V1,
        installationRoot: root,
        operation: "uninstall" as const,
        phase: "files_pending" as const,
        sourceManifest: source,
        targetManifest: null,
        rollbackContentDigest: source.payload.previous?.contentDigest ?? null,
        rollbackSnapshot: null,
        installationIdentityKeyDigest: null,
        installationIdentityDisposition: null,
        createdRuntimeRoot: false,
        runtimeRootCreationNonce: null,
        runtimeRootCustodyPin,
      }));
      await writeControlJournalV1(root, authority, journal, false);
      return resumeUninstallJournalV1(
        root,
        expectedRuntimeRoot,
        authority,
        journal,
      );
    },
  );
}

function productionPrivilegeV1(): ProviderServiceInstallationPrivilegeCapabilityInternalV1 {
  try {
    return mintProviderServiceInstallationPrivilegeInternalV1();
  } catch (error) {
    throw new ProviderServiceInstallationLifecycleErrorV1(
      "privilege_required",
      "provider service lifecycle requires root authority",
      { cause: error },
    );
  }
}

export function installProviderServiceInstallationWithPrivilegeInternalV1(
  capability: ProviderServiceInstallationPrivilegeCapabilityInternalV1,
  options: ProviderServiceInstallationInstallOptionsV1,
): Promise<ProviderServiceInstallationInstallResultV1> {
  return installInternalV1(capability, options);
}

export function doctorProviderServiceInstallationWithPrivilegeInternalV1(
  capability: ProviderServiceInstallationPrivilegeCapabilityInternalV1,
  options: ProviderServiceInstallationTargetOptionsV1,
): Promise<ProviderServiceInstallationDoctorResultV1> {
  return doctorInternalV1(capability, options);
}

export function upgradeProviderServiceInstallationWithPrivilegeInternalV1(
  capability: ProviderServiceInstallationPrivilegeCapabilityInternalV1,
  options: ProviderServiceInstallationUpgradeOptionsV1,
): Promise<ProviderServiceInstallationUpgradeResultV1> {
  return upgradeInternalV1(capability, options);
}

export function rollbackProviderServiceInstallationWithPrivilegeInternalV1(
  capability: ProviderServiceInstallationPrivilegeCapabilityInternalV1,
  options: ProviderServiceInstallationTargetOptionsV1,
): Promise<ProviderServiceInstallationRollbackResultV1> {
  return rollbackInternalV1(capability, options);
}

export function uninstallProviderServiceInstallationWithPrivilegeInternalV1(
  capability: ProviderServiceInstallationPrivilegeCapabilityInternalV1,
  options: ProviderServiceInstallationTargetOptionsV1,
): Promise<ProviderServiceInstallationUninstallResultV1> {
  return uninstallInternalV1(capability, options);
}

export function installProviderServiceInstallationV1(
  options: ProviderServiceInstallationInstallOptionsV1,
): Promise<ProviderServiceInstallationInstallResultV1> {
  return installInternalV1(productionPrivilegeV1(), options);
}

export function doctorProviderServiceInstallationV1(
  options: ProviderServiceInstallationTargetOptionsV1,
): Promise<ProviderServiceInstallationDoctorResultV1> {
  return doctorInternalV1(productionPrivilegeV1(), options);
}

export function upgradeProviderServiceInstallationV1(
  options: ProviderServiceInstallationUpgradeOptionsV1,
): Promise<ProviderServiceInstallationUpgradeResultV1> {
  return upgradeInternalV1(productionPrivilegeV1(), options);
}

export function rollbackProviderServiceInstallationV1(
  options: ProviderServiceInstallationTargetOptionsV1,
): Promise<ProviderServiceInstallationRollbackResultV1> {
  return rollbackInternalV1(productionPrivilegeV1(), options);
}

export function uninstallProviderServiceInstallationV1(
  options: ProviderServiceInstallationTargetOptionsV1,
): Promise<ProviderServiceInstallationUninstallResultV1> {
  return uninstallInternalV1(productionPrivilegeV1(), options);
}
