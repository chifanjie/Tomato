import { randomBytes } from "node:crypto";
import { lstat, readdir } from "node:fs/promises";
import { dirname } from "node:path";

import {
  InstallationIdentityGenerationIdV1Schema,
  type InstallationIdentityGenerationIdV1,
} from "@understand-code/durable-object-provider-contracts/primitives";
import {
  acquireNativeInstallationIdentityInitializationLockV1,
  assertNativeInstallationStateAuthorityFreshV1,
  closeNativeInstallationStateAuthorityV1,
  createNativeInstallationIdentityArtifactV1,
  openNativeInstallationStateAuthorityV1,
  openNativeTestInstallationStateAuthorityV1,
  readNativeInstallationIdentityArtifactV1,
  releaseNativeInstallationIdentityInitializationLockV1,
  replaceNativeInstallationIdentityInitStageV1,
  revalidateNativeInstallationStateAuthorityV1,
  type NativeInstallationIdentityArtifactV1,
  type NativeInstallationInitializationLockV1,
  type NativeInstallationStateAuthorityOpenResultV1,
} from "@understand-code/native-kernel-bridge";

import {
  digestDomainInternalV1,
  hmacTokenForDomainInternalV1,
  verifyHmacTokenForDomainInternalV1,
} from "./crypto-internal.js";
import { ProviderAcceptanceAuthorityErrorV1 } from "./errors.js";
import {
  canonicalAuthorityBytesInternalV1,
  ensureProviderAcceptanceAuthorityDirectoriesInternalV1,
  isMissingFileInternalV1,
  parseCanonicalAuthorityBytesInternalV1,
} from "./filesystem-internal.js";
import type { ProviderAcceptanceAuthorityLayoutInternalV1 } from "./platform-layout.js";

const IDENTITY_STATE_PROFILE_V1 =
  "understand_code_provider_acceptance_authority_identity_state_v1";
const IDENTITY_MARKER_PROFILE_V1 =
  "understand_code_provider_acceptance_authority_identity_init_v1";
const IDENTITY_INITIALIZING_MARKER_PROFILE_V1 =
  "understand_code_provider_acceptance_authority_identity_initializing_v1";
const IDENTITY_KEY_CHECK_DOMAIN_V1 =
  "installation-identity-key-check-v1";
const IDENTITY_STATE_DIGEST_DOMAIN_V1 =
  "understand-code-provider-acceptance-authority-identity-state-v1";
const IDENTITY_MARKER_TOKEN_DOMAIN_V1 =
  "understand-code-provider-acceptance-authority-identity-marker-v1";
const IDENTITY_STATE_ROOT_BINDING_DOMAIN_V1 =
  "installation-state-root-binding-v1";
const LOCK_PREPARATION_NAME_V1 =
  /^\.provider-acceptance-authority-v1\.lock\.prepare-[1-9][0-9]*-[0-9a-f]{32}$/u;
const RECOVERY_PREPARATION_NAME_V1 =
  /^\.provider-acceptance-authority-v1\.lock\.recovery\.prepare-[1-9][0-9]*-[0-9a-f]{32}$/u;

interface InstallationIdentityAuthorityStateInternalV1 {
  readonly schemaVersion: 1;
  readonly profile: typeof IDENTITY_STATE_PROFILE_V1;
  readonly installationIdentityGenerationId:
    InstallationIdentityGenerationIdV1;
  readonly initializationNonce: string;
  readonly resolverId: string;
  readonly stateRootFileIdentity: InstallationStateRootFileIdentityInternalV1;
  readonly stateRootBindingToken: string;
  readonly keyCheckToken: string;
}

interface InstallationStateRootFileIdentityInternalV1 {
  readonly platform: "posix";
  readonly device: string;
  readonly inode: string;
}

interface InstallationIdentityAuthorityMarkerInternalV1 {
  readonly schemaVersion: 1;
  readonly profile: typeof IDENTITY_MARKER_PROFILE_V1;
  readonly installationIdentityGenerationId:
    InstallationIdentityGenerationIdV1;
  readonly identityStateDigest: string;
  readonly markerToken: string;
}

interface InstallationIdentityInitializingMarkerInternalV1 {
  readonly schemaVersion: 1;
  readonly profile: typeof IDENTITY_INITIALIZING_MARKER_PROFILE_V1;
  readonly plannedState: InstallationIdentityAuthorityStateInternalV1;
  readonly markerToken: string;
}

const IDENTITY_INITIALIZING_MARKER_TOKEN_DOMAIN_V1 =
  "understand-code-provider-acceptance-authority-identity-initializing-marker-v1";

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

function parseIdentityStateV1(
  value: unknown,
): InstallationIdentityAuthorityStateInternalV1 {
  if (
    !exactRecordV1(value, [
      "schemaVersion",
      "profile",
      "installationIdentityGenerationId",
      "initializationNonce",
      "resolverId",
      "stateRootFileIdentity",
      "stateRootBindingToken",
      "keyCheckToken",
    ]) ||
    value.schemaVersion !== 1 ||
    value.profile !== IDENTITY_STATE_PROFILE_V1 ||
    typeof value.initializationNonce !== "string" ||
    !/^[0-9a-f]{32}$/u.test(value.initializationNonce) ||
    typeof value.resolverId !== "string" ||
    ![
      "darwin-user-domain-application-support-v1",
      "linux-getpwuid-effective-user-state-v1",
      "test-explicit-temporary-root-v1",
    ].includes(value.resolverId) ||
    !isStateRootIdentityV1(value.stateRootFileIdentity) ||
    typeof value.stateRootBindingToken !== "string" ||
    !/^hmac-sha256:[0-9a-f]{64}$/u.test(value.stateRootBindingToken) ||
    typeof value.keyCheckToken !== "string" ||
    !/^hmac-sha256:[0-9a-f]{64}$/u.test(value.keyCheckToken)
  ) {
    throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
  }
  return Object.freeze({
    schemaVersion: 1,
    profile: IDENTITY_STATE_PROFILE_V1,
    installationIdentityGenerationId:
      InstallationIdentityGenerationIdV1Schema.parse(
        value.installationIdentityGenerationId,
      ),
    initializationNonce: value.initializationNonce,
    resolverId: value.resolverId,
    stateRootFileIdentity: value.stateRootFileIdentity,
    stateRootBindingToken: value.stateRootBindingToken,
    keyCheckToken: value.keyCheckToken,
  });
}

function isStateRootIdentityV1(
  value: unknown,
): value is InstallationStateRootFileIdentityInternalV1 {
  return exactRecordV1(value, ["platform", "device", "inode"]) &&
    value.platform === "posix" &&
    typeof value.device === "string" && /^(0|[1-9][0-9]*)$/u.test(value.device) &&
    typeof value.inode === "string" && /^(0|[1-9][0-9]*)$/u.test(value.inode);
}

function openNativeAuthorityForLayoutV1(
  layout: ProviderAcceptanceAuthorityLayoutInternalV1,
  create: boolean,
): NativeInstallationStateAuthorityOpenResultV1 {
  try {
    const opened = layout.authorityResolverId ===
        "test-explicit-temporary-root-v1"
      ? openNativeTestInstallationStateAuthorityV1(layout.authorityRoot, {
          create,
        })
      : openNativeInstallationStateAuthorityV1({ create });
    if (
      opened.profile !== "native_installation_state_authority_v1" ||
      opened.resolverId !== layout.authorityResolverId
    ) {
      throw new ProviderAcceptanceAuthorityErrorV1("invalid_layout");
    }
    return opened;
  } catch (error) {
    if (error instanceof ProviderAcceptanceAuthorityErrorV1) throw error;
    throw new ProviderAcceptanceAuthorityErrorV1("invalid_layout");
  }
}

function stateRootIdentityV1(
  opened: NativeInstallationStateAuthorityOpenResultV1,
): InstallationStateRootFileIdentityInternalV1 {
  return Object.freeze({
    platform: "posix",
    device: opened.rootIdentity.device,
    inode: opened.rootIdentity.inode,
  });
}

function readNativeIdentityArtifactV1(
  opened: NativeInstallationStateAuthorityOpenResultV1,
  artifact: NativeInstallationIdentityArtifactV1,
): Buffer | undefined {
  try {
    return readNativeInstallationIdentityArtifactV1(opened.authority, artifact);
  } catch {
    throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
  }
}

async function hasFixedAuthorityStoreArtifactV1(
  layout: ProviderAcceptanceAuthorityLayoutInternalV1,
): Promise<boolean> {
  const paths = [
    layout.canonicalSnapshotPath,
    layout.deterministicSnapshotStagePath,
    `${layout.deterministicSnapshotStagePath}.prepare`,
    layout.canonicalPublicationPinPath,
    layout.deterministicPublicationPinStagePath,
    `${layout.deterministicPublicationPinStagePath}.prepare`,
    layout.canonicalStrongMutationBrokerSnapshotPath,
    layout.deterministicStrongMutationBrokerSnapshotStagePath,
    `${layout.deterministicStrongMutationBrokerSnapshotStagePath}.prepare`,
    layout.canonicalStrongMutationBrokerPublicationPinPath,
    layout.deterministicStrongMutationBrokerPublicationPinStagePath,
    `${layout.deterministicStrongMutationBrokerPublicationPinStagePath}.prepare`,
    layout.transactionLockPath,
    layout.transactionLockStagePath,
    layout.transactionLockRecoveryClaimPath,
    layout.transactionLockQuarantinePath,
  ];
  for (const path of paths) {
    try {
      await lstat(path);
      return true;
    } catch (error) {
      if (isMissingFileInternalV1(error)) continue;
      throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
    }
  }
  try {
    const names = await readdir(dirname(layout.transactionLockPath));
    return names.some((name) =>
      LOCK_PREPARATION_NAME_V1.test(name) ||
      RECOVERY_PREPARATION_NAME_V1.test(name)
    );
  } catch {
    throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
  }
}

function stateRootBindingFieldsV1(
  opened: NativeInstallationStateAuthorityOpenResultV1,
  stateRootFileIdentity: InstallationStateRootFileIdentityInternalV1,
): object {
  return Object.freeze({
    resolverId: opened.resolverId,
    canonicalStateRootBytes: opened.canonicalStateRootBytes,
    ownerIdentity: opened.ownerIdentity,
    stateRootFileIdentity,
  });
}

function sameStateRootIdentityV1(
  left: InstallationStateRootFileIdentityInternalV1,
  right: InstallationStateRootFileIdentityInternalV1,
): boolean {
  return left.platform === right.platform && left.device === right.device &&
    left.inode === right.inode;
}

function parseIdentityMarkerV1(
  value: unknown,
): InstallationIdentityAuthorityMarkerInternalV1 {
  if (
    !exactRecordV1(value, [
      "schemaVersion",
      "profile",
      "installationIdentityGenerationId",
      "identityStateDigest",
      "markerToken",
    ]) ||
    value.schemaVersion !== 1 ||
    value.profile !== IDENTITY_MARKER_PROFILE_V1 ||
    typeof value.identityStateDigest !== "string" ||
    !/^sha256:[0-9a-f]{64}$/u.test(value.identityStateDigest) ||
    typeof value.markerToken !== "string" ||
    !/^hmac-sha256:[0-9a-f]{64}$/u.test(value.markerToken)
  ) {
    throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
  }
  return Object.freeze({
    schemaVersion: 1,
    profile: IDENTITY_MARKER_PROFILE_V1,
    installationIdentityGenerationId:
      InstallationIdentityGenerationIdV1Schema.parse(
        value.installationIdentityGenerationId,
      ),
    identityStateDigest: value.identityStateDigest,
    markerToken: value.markerToken,
  });
}

function parseInitializingMarkerV1(
  value: unknown,
): InstallationIdentityInitializingMarkerInternalV1 {
  if (
    !exactRecordV1(value, ["schemaVersion", "profile", "plannedState", "markerToken"]) ||
    value.schemaVersion !== 1 ||
    value.profile !== IDENTITY_INITIALIZING_MARKER_PROFILE_V1 ||
    typeof value.markerToken !== "string" ||
    !/^hmac-sha256:[0-9a-f]{64}$/u.test(value.markerToken)
  ) {
    throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
  }
  return Object.freeze({
    schemaVersion: 1,
    profile: IDENTITY_INITIALIZING_MARKER_PROFILE_V1,
    plannedState: parseIdentityStateV1(value.plannedState),
    markerToken: value.markerToken,
  });
}

function identityKeyCheckFieldsV1(
  state: Omit<InstallationIdentityAuthorityStateInternalV1, "keyCheckToken">,
): object {
  return Object.freeze({
    generationId: state.installationIdentityGenerationId,
    initializationNonce: state.initializationNonce,
  });
}

export interface ProviderAcceptanceInstallationIdentityInternalV1 {
  readonly installationIdentityGenerationId:
    InstallationIdentityGenerationIdV1;
  /** Callback-only custody: the key is zeroed immediately after the callback. */
  readonly withKey: <T>(operation: (key: Buffer) => Promise<T>) => Promise<T>;
}

export interface ProviderAcceptanceInstallationIdentityOpenOptionsInternalV1 {
  readonly authorizeNativeAuthority?: (
    opened: NativeInstallationStateAuthorityOpenResultV1,
  ) => void;
}

export async function openProviderAcceptanceInstallationIdentityInternalV1(
  layout: ProviderAcceptanceAuthorityLayoutInternalV1,
  options: ProviderAcceptanceInstallationIdentityOpenOptionsInternalV1 = {},
): Promise<ProviderAcceptanceInstallationIdentityInternalV1> {
  let opened: NativeInstallationStateAuthorityOpenResultV1;
  try {
    opened = openNativeAuthorityForLayoutV1(layout, false);
    options.authorizeNativeAuthority?.(opened);
    revalidateNativeInstallationStateAuthorityV1(opened.authority);
  } catch (error) {
    if (
      error instanceof ProviderAcceptanceAuthorityErrorV1 &&
      error.code === "invalid_layout"
    ) {
      try {
        await lstat(layout.authorityRoot);
      } catch (inspectionError) {
        if (
          typeof inspectionError === "object" && inspectionError !== null &&
          "code" in inspectionError && inspectionError.code === "ENOENT"
        ) {
          throw new ProviderAcceptanceAuthorityErrorV1("not_provisioned");
        }
      }
    }
    if (error instanceof ProviderAcceptanceAuthorityErrorV1) throw error;
    throw new ProviderAcceptanceAuthorityErrorV1("not_provisioned");
  }
  let stateBytes: Buffer;
  let markerBytes: Buffer;
  try {
    const stateFile = readNativeIdentityArtifactV1(opened, "state");
    const markerFile = readNativeIdentityArtifactV1(opened, "init");
    const keyFile = readNativeIdentityArtifactV1(opened, "key");
    try {
      if (
        stateFile === undefined && markerFile === undefined &&
        keyFile === undefined
      ) {
        if (await hasFixedAuthorityStoreArtifactV1(layout)) {
          throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
        }
        throw new ProviderAcceptanceAuthorityErrorV1("not_provisioned");
      }
      if (
        stateFile === undefined || markerFile === undefined ||
        keyFile === undefined || keyFile.byteLength !== 32
      ) {
        throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
      }
      stateBytes = stateFile;
      markerBytes = markerFile;
    } finally {
      keyFile?.fill(0);
    }
  } finally {
    closeNativeInstallationStateAuthorityV1(opened.authority);
  }
  let state: InstallationIdentityAuthorityStateInternalV1;
  let marker: InstallationIdentityAuthorityMarkerInternalV1;
  try {
    state = parseIdentityStateV1(parseCanonicalAuthorityBytesInternalV1(stateBytes));
    marker = parseIdentityMarkerV1(parseCanonicalAuthorityBytesInternalV1(markerBytes));
  } catch {
    throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
  }
  if (
    marker.installationIdentityGenerationId !==
      state.installationIdentityGenerationId ||
    marker.identityStateDigest !==
      digestDomainInternalV1(IDENTITY_STATE_DIGEST_DOMAIN_V1, state)
  ) {
    throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
  }

  const withKey = async <T>(operation: (key: Buffer) => Promise<T>): Promise<T> => {
    let current: NativeInstallationStateAuthorityOpenResultV1 | undefined;
    let key: Buffer | undefined;
    let operationStarted = false;
    let operationFailed = false;
    try {
      current = openNativeAuthorityForLayoutV1(layout, false);
      options.authorizeNativeAuthority?.(current);
      revalidateNativeInstallationStateAuthorityV1(current.authority);
      const currentRootIdentity = stateRootIdentityV1(current);
      if (
        state.resolverId !== current.resolverId ||
        !sameStateRootIdentityV1(state.stateRootFileIdentity, currentRootIdentity)
      ) {
        throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
      }
      const currentState = readNativeIdentityArtifactV1(current, "state");
      const currentMarker = readNativeIdentityArtifactV1(current, "init");
      if (
        currentState === undefined || currentMarker === undefined ||
        Buffer.compare(currentState, stateBytes) !== 0 ||
        Buffer.compare(currentMarker, markerBytes) !== 0
      ) {
        throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
      }
      key = readNativeIdentityArtifactV1(current, "key");
      if (key === undefined || key.byteLength !== 32) {
        throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
      }
      if (
        !verifyHmacTokenForDomainInternalV1(
          key,
          IDENTITY_STATE_ROOT_BINDING_DOMAIN_V1,
          stateRootBindingFieldsV1(current, state.stateRootFileIdentity),
          state.stateRootBindingToken,
        ) ||
        !verifyHmacTokenForDomainInternalV1(
          key,
          IDENTITY_KEY_CHECK_DOMAIN_V1,
          identityKeyCheckFieldsV1(state),
          state.keyCheckToken,
        ) ||
        !verifyHmacTokenForDomainInternalV1(
          key,
          IDENTITY_MARKER_TOKEN_DOMAIN_V1,
          {
            installationIdentityGenerationId:
              marker.installationIdentityGenerationId,
            identityStateDigest: marker.identityStateDigest,
          },
          marker.markerToken,
        )
      ) {
        throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
      }
      operationStarted = true;
      try {
        return await operation(key);
      } catch (error) {
        operationFailed = true;
        throw error;
      }
    } finally {
      try {
        if (current !== undefined && operationStarted) {
          try {
            revalidateNativeInstallationStateAuthorityV1(current.authority);
          } catch (error) {
            // The callback's fail-closed error remains authoritative, while
            // successful callbacks cannot project a stale native authority.
            if (!operationFailed) throw error;
          }
        }
      } finally {
        key?.fill(0);
        if (current !== undefined) {
          closeNativeInstallationStateAuthorityV1(current.authority);
        }
      }
    }
  };

  await withKey(async () => undefined);
  return Object.freeze({
    installationIdentityGenerationId: state.installationIdentityGenerationId,
    withKey,
  });
}

async function createIdentityRecordsV1(
  opened: NativeInstallationStateAuthorityOpenResultV1,
  installationIdentityGenerationId: InstallationIdentityGenerationIdV1,
  key: Buffer,
  initializationNonce: string,
): Promise<Readonly<{
  state: InstallationIdentityAuthorityStateInternalV1;
  marker: InstallationIdentityAuthorityMarkerInternalV1;
  initializingMarker: InstallationIdentityInitializingMarkerInternalV1;
}>> {
  const stateRootFileIdentity = stateRootIdentityV1(opened);
  const stateRootBindingToken = hmacTokenForDomainInternalV1(
    key,
    IDENTITY_STATE_ROOT_BINDING_DOMAIN_V1,
    stateRootBindingFieldsV1(opened, stateRootFileIdentity),
  );
  const unsignedState = Object.freeze({
    schemaVersion: 1 as const,
    profile: IDENTITY_STATE_PROFILE_V1,
    installationIdentityGenerationId,
    initializationNonce,
    resolverId: opened.resolverId,
    stateRootFileIdentity,
    stateRootBindingToken,
  });
  const state: InstallationIdentityAuthorityStateInternalV1 = Object.freeze({
    ...unsignedState,
    keyCheckToken: hmacTokenForDomainInternalV1(
      key,
      IDENTITY_KEY_CHECK_DOMAIN_V1,
      identityKeyCheckFieldsV1(unsignedState),
    ),
  });
  const identityStateDigest = digestDomainInternalV1(
    IDENTITY_STATE_DIGEST_DOMAIN_V1,
    state,
  );
  const markerFields = Object.freeze({
    installationIdentityGenerationId,
    identityStateDigest,
  });
  const marker: InstallationIdentityAuthorityMarkerInternalV1 = Object.freeze({
    schemaVersion: 1,
    profile: IDENTITY_MARKER_PROFILE_V1,
    ...markerFields,
    markerToken: hmacTokenForDomainInternalV1(
      key,
      IDENTITY_MARKER_TOKEN_DOMAIN_V1,
      markerFields,
    ),
  });
  const initializingMarkerFields = Object.freeze({ plannedState: state });
  const initializingMarker: InstallationIdentityInitializingMarkerInternalV1 =
    Object.freeze({
      schemaVersion: 1,
      profile: IDENTITY_INITIALIZING_MARKER_PROFILE_V1,
      ...initializingMarkerFields,
      markerToken: hmacTokenForDomainInternalV1(
        key,
        IDENTITY_INITIALIZING_MARKER_TOKEN_DOMAIN_V1,
        initializingMarkerFields,
      ),
    });
  return Object.freeze({ state, marker, initializingMarker });
}

function generationIdFromNonceV1(
  initializationNonce: string,
): InstallationIdentityGenerationIdV1 {
  const digest = digestDomainInternalV1(
    "installation-identity-generation-v1",
    { initializationNonce },
  ).slice("sha256:".length);
  return InstallationIdentityGenerationIdV1Schema.parse(
    `installation-identity-generation:${digest.slice(0, 22)}`,
  );
}

async function initializeFreshIdentityV1(
  opened: NativeInstallationStateAuthorityOpenResultV1,
  options: ProviderAcceptanceInstallationIdentityInitializationOptionsInternalV1,
): Promise<void> {
  const key = randomBytes(32);
  try {
    const initializationNonce = randomBytes(16).toString("hex");
    const records = await createIdentityRecordsV1(
      opened,
      generationIdFromNonceV1(initializationNonce),
      key,
      initializationNonce,
    );
    createNativeInstallationIdentityArtifactV1(
      opened.authority,
      "init",
      canonicalAuthorityBytesInternalV1(records.initializingMarker),
    );
    await options.afterDurablePhase?.("initializing_marker_fsynced");
    createNativeInstallationIdentityArtifactV1(opened.authority, "key", key);
    await options.afterDurablePhase?.("identity_key_fsynced");
    createNativeInstallationIdentityArtifactV1(
      opened.authority,
      "state",
      canonicalAuthorityBytesInternalV1(records.state),
    );
    await options.afterDurablePhase?.("identity_state_fsynced");
    createNativeInstallationIdentityArtifactV1(
      opened.authority,
      "init_stage",
      canonicalAuthorityBytesInternalV1(records.marker),
    );
    replaceNativeInstallationIdentityInitStageV1(opened.authority);
  } finally {
    key.fill(0);
  }
}

export type ProviderAcceptanceInstallationIdentityInitializationPhaseInternalV1 =
  | "initializing_marker_fsynced"
  | "identity_key_fsynced"
  | "identity_state_fsynced";

export interface ProviderAcceptanceInstallationIdentityInitializationOptionsInternalV1 {
  readonly afterDurablePhase?: (
    phase: ProviderAcceptanceInstallationIdentityInitializationPhaseInternalV1,
  ) => void | Promise<void>;
  readonly authorizeNativeAuthority?: (
    opened: NativeInstallationStateAuthorityOpenResultV1,
  ) => void;
}

async function acquireNativeInitializationLockBoundedV1(
  opened: NativeInstallationStateAuthorityOpenResultV1,
): Promise<NativeInstallationInitializationLockV1> {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const lock = acquireNativeInstallationIdentityInitializationLockV1(
      opened.authority,
    );
    if (lock !== undefined) return lock;
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  }
  throw new ProviderAcceptanceAuthorityErrorV1("authority_busy");
}

async function openNativeAuthorityForBootstrapV1(
  layout: ProviderAcceptanceAuthorityLayoutInternalV1,
): Promise<NativeInstallationStateAuthorityOpenResultV1> {
  try {
    return openNativeAuthorityForLayoutV1(layout, true);
  } catch (initialError) {
    // A competing creator can win between resolution and the exclusive root
    // create, while its fixed namespace is not yet reopenable. Reopen only:
    // native create:false is a zero-write observation and never adopts a root.
    for (let attempt = 0; attempt < 200; attempt += 1) {
      await new Promise<void>((resolve) => setTimeout(resolve, 10));
      try {
        return openNativeAuthorityForLayoutV1(layout, false);
      } catch {
        // Keep observing until the bounded bootstrap publication window ends.
      }
    }
    throw initialError;
  }
}

/** Production-only marker-first, globally serialized identity bootstrap. */
export async function openOrInitializeProviderAcceptanceInstallationIdentityInternalV1(
  layout: ProviderAcceptanceAuthorityLayoutInternalV1,
  options: ProviderAcceptanceInstallationIdentityInitializationOptionsInternalV1 = {},
  bootstrapObservationRetryCount = 0,
): Promise<ProviderAcceptanceInstallationIdentityInternalV1> {
  let opened: NativeInstallationStateAuthorityOpenResultV1 | undefined;
  let lock: NativeInstallationInitializationLockV1 | undefined;
  try {
    opened = await openNativeAuthorityForBootstrapV1(layout);
    options.authorizeNativeAuthority?.(opened);
    revalidateNativeInstallationStateAuthorityV1(opened.authority);
    let observedKey: Buffer | undefined;
    let observedState: Buffer | undefined;
    let observedMarker: Buffer | undefined;
    try {
      observedKey = readNativeIdentityArtifactV1(opened, "key");
      observedState = readNativeIdentityArtifactV1(opened, "state");
      observedMarker = readNativeIdentityArtifactV1(opened, "init");
    } catch (error) {
      if (!opened.rootCreated && bootstrapObservationRetryCount < 200) {
        closeNativeInstallationStateAuthorityV1(opened.authority);
        opened = undefined;
        await new Promise<void>((resolve) => setTimeout(resolve, 10));
        return openOrInitializeProviderAcceptanceInstallationIdentityInternalV1(
          layout,
          options,
          bootstrapObservationRetryCount + 1,
        );
      }
      throw error;
    }
    try {
      if (
        !opened.rootCreated && observedKey === undefined &&
        observedState === undefined && observedMarker === undefined
      ) {
        // A concurrent first initializer may have atomically created the root
        // but not yet published its marker. Drop the stale observation and
        // reopen read-only; never acquire a lock or write into an
        // unauthenticated pre-existing empty root.
        closeNativeInstallationStateAuthorityV1(opened.authority);
        opened = undefined;
        for (let attempt = 0; attempt < 200; attempt += 1) {
          await new Promise<void>((resolve) => setTimeout(resolve, 10));
          let candidate:
            | NativeInstallationStateAuthorityOpenResultV1
            | undefined;
          let candidateKey: Buffer | undefined;
          try {
            candidate = openNativeAuthorityForLayoutV1(layout, false);
            options.authorizeNativeAuthority?.(candidate);
            revalidateNativeInstallationStateAuthorityV1(candidate.authority);
            candidateKey = readNativeIdentityArtifactV1(candidate, "key");
            const candidateState = readNativeIdentityArtifactV1(
              candidate,
              "state",
            );
            const candidateMarker = readNativeIdentityArtifactV1(
              candidate,
              "init",
            );
            if (
              candidateKey === undefined && candidateState === undefined &&
              candidateMarker === undefined
            ) {
              closeNativeInstallationStateAuthorityV1(candidate.authority);
              candidate = undefined;
              continue;
            }
            opened = candidate;
            observedKey = candidateKey;
            observedState = candidateState;
            observedMarker = candidateMarker;
            candidate = undefined;
            candidateKey = undefined;
            break;
          } catch {
            // Publication may race any individual descriptor-relative read.
          } finally {
            candidateKey?.fill(0);
            if (candidate !== undefined) {
              closeNativeInstallationStateAuthorityV1(candidate.authority);
            }
          }
        }
        if (opened === undefined) {
          throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
        }
      }
      if (
        observedMarker !== undefined && observedKey !== undefined &&
        observedState !== undefined
      ) {
        const raw = parseCanonicalAuthorityBytesInternalV1(observedMarker);
        if (
          typeof raw === "object" && raw !== null && "profile" in raw &&
          raw.profile === IDENTITY_MARKER_PROFILE_V1
        ) {
          closeNativeInstallationStateAuthorityV1(opened.authority);
          opened = undefined;
          return openProviderAcceptanceInstallationIdentityInternalV1(
            layout,
            { authorizeNativeAuthority: options.authorizeNativeAuthority },
          );
        }
      }
    } finally {
      observedKey?.fill(0);
    }

    lock = await acquireNativeInitializationLockBoundedV1(opened);
    try {
      revalidateNativeInstallationStateAuthorityV1(opened.authority);
    } catch (error) {
      if (bootstrapObservationRetryCount >= 200) throw error;
      // Another initializer may have published while this contender waited on
      // the kernel lock. Its pinned observation is intentionally stale; drop
      // it without touching artifacts and reopen the authenticated result.
      releaseNativeInstallationIdentityInitializationLockV1(lock);
      lock = undefined;
      closeNativeInstallationStateAuthorityV1(opened.authority);
      opened = undefined;
      return openOrInitializeProviderAcceptanceInstallationIdentityInternalV1(
        layout,
        options,
        bootstrapObservationRetryCount + 1,
      );
    }
    const keyFile = readNativeIdentityArtifactV1(opened, "key");
    const stateFile = readNativeIdentityArtifactV1(opened, "state");
    const markerFile = readNativeIdentityArtifactV1(opened, "init");
    const markerStageFile = readNativeIdentityArtifactV1(opened, "init_stage");
    try {
      if (markerFile !== undefined) {
        const rawMarker = parseCanonicalAuthorityBytesInternalV1(markerFile);
        if (
          typeof rawMarker === "object" && rawMarker !== null &&
          "profile" in rawMarker &&
          rawMarker.profile === IDENTITY_INITIALIZING_MARKER_PROFILE_V1
        ) {
          const initializing = parseInitializingMarkerV1(rawMarker);
          if (keyFile === undefined && stateFile === undefined) {
            throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
          }
          if (keyFile === undefined || keyFile.byteLength !== 32) {
            throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
          }
          if (
            !verifyHmacTokenForDomainInternalV1(
              keyFile,
              IDENTITY_INITIALIZING_MARKER_TOKEN_DOMAIN_V1,
              { plannedState: initializing.plannedState },
              initializing.markerToken,
            )
          ) {
            throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
          }
          const expected = await createIdentityRecordsV1(
            opened,
            initializing.plannedState.installationIdentityGenerationId,
            keyFile,
            initializing.plannedState.initializationNonce,
          );
          if (
            Buffer.compare(
              canonicalAuthorityBytesInternalV1(expected.state),
              canonicalAuthorityBytesInternalV1(initializing.plannedState),
            ) !== 0
          ) {
            throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
          }
          if (stateFile === undefined) {
            createNativeInstallationIdentityArtifactV1(
              opened.authority,
              "state",
              canonicalAuthorityBytesInternalV1(expected.state),
            );
          } else if (
            Buffer.compare(
              stateFile,
              canonicalAuthorityBytesInternalV1(expected.state),
            ) !== 0
          ) {
            throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
          }
          if (markerStageFile === undefined) {
            createNativeInstallationIdentityArtifactV1(
              opened.authority,
              "init_stage",
              canonicalAuthorityBytesInternalV1(expected.marker),
            );
          } else if (
            Buffer.compare(
              markerStageFile,
              canonicalAuthorityBytesInternalV1(expected.marker),
            ) !== 0
          ) {
            throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
          }
          replaceNativeInstallationIdentityInitStageV1(opened.authority);
        } else if (
          keyFile === undefined || stateFile === undefined ||
          markerStageFile !== undefined
        ) {
          throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
        }
      } else if (
        keyFile !== undefined || stateFile !== undefined ||
        markerStageFile !== undefined
      ) {
        throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
      } else {
        if (!opened.rootCreated) {
          throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
        }
        assertNativeInstallationStateAuthorityFreshV1(opened.authority);
        await initializeFreshIdentityV1(opened, options);
      }
    } finally {
      keyFile?.fill(0);
    }
  } finally {
    if (lock !== undefined) {
      releaseNativeInstallationIdentityInitializationLockV1(lock);
    }
    if (opened !== undefined) {
      revalidateNativeInstallationStateAuthorityV1(opened.authority);
      closeNativeInstallationStateAuthorityV1(opened.authority);
    }
  }
  return openProviderAcceptanceInstallationIdentityInternalV1(layout, {
    authorizeNativeAuthority: options.authorizeNativeAuthority,
  });
}

export async function provisionProviderAcceptanceInstallationIdentityForTestInternalV1(
  layout: ProviderAcceptanceAuthorityLayoutInternalV1,
  input: Readonly<{
    installationIdentityGenerationId: unknown;
    installationIdentityKey: Uint8Array;
  }>,
): Promise<void> {
  await ensureProviderAcceptanceAuthorityDirectoriesInternalV1(layout, true);
  if (
    !(input.installationIdentityKey instanceof Uint8Array) ||
    input.installationIdentityKey.byteLength !== 32
  ) {
    throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
  }
  let installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  try {
    installationIdentityGenerationId =
      InstallationIdentityGenerationIdV1Schema.parse(
        input.installationIdentityGenerationId,
      );
  } catch {
    throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
  }
  const key = Buffer.from(input.installationIdentityKey);
  const initializationNonce = randomBytes(16).toString("hex");
  const opened = openNativeAuthorityForLayoutV1(layout, true);
  try {
    const records = await createIdentityRecordsV1(
      opened,
      installationIdentityGenerationId,
      key,
      initializationNonce,
    );
    createNativeInstallationIdentityArtifactV1(
      opened.authority,
      "init",
      canonicalAuthorityBytesInternalV1(records.initializingMarker),
    );
    createNativeInstallationIdentityArtifactV1(opened.authority, "key", key);
    createNativeInstallationIdentityArtifactV1(
      opened.authority,
      "state",
      canonicalAuthorityBytesInternalV1(records.state),
    );
    createNativeInstallationIdentityArtifactV1(
      opened.authority,
      "init_stage",
      canonicalAuthorityBytesInternalV1(records.marker),
    );
    replaceNativeInstallationIdentityInitStageV1(opened.authority);
    revalidateNativeInstallationStateAuthorityV1(opened.authority);
  } finally {
    key.fill(0);
    closeNativeInstallationStateAuthorityV1(opened.authority);
  }
}
