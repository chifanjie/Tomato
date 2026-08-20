import { randomBytes } from "node:crypto";
import { lstat, readdir, unlink } from "node:fs/promises";
import { dirname } from "node:path";

import {
  InstallationIdentityGenerationIdV1Schema,
  type InstallationIdentityGenerationIdV1,
} from "@understand-code/durable-object-provider-contracts/primitives";

import {
  digestDomainInternalV1,
  hmacTokenForDomainInternalV1,
  verifyHmacTokenForDomainInternalV1,
} from "./crypto-internal.js";
import { ProviderAcceptanceAuthorityErrorV1 } from "./errors.js";
import {
  canonicalAuthorityBytesInternalV1,
  createDurableAuthorityFileInternalV1,
  ensureProviderAcceptanceAuthorityDirectoriesInternalV1,
  isMissingFileInternalV1,
  parseCanonicalAuthorityBytesInternalV1,
  readCheckedAuthorityFileInternalV1,
  syncParentDirectoryInternalV1,
} from "./filesystem-internal.js";
import type { ProviderAcceptanceAuthorityLayoutInternalV1 } from "./platform-layout.js";

const IDENTITY_STATE_PROFILE_V1 =
  "understand_code_provider_acceptance_authority_identity_state_v1";
const IDENTITY_MARKER_PROFILE_V1 =
  "understand_code_provider_acceptance_authority_identity_init_v1";
const IDENTITY_KEY_CHECK_DOMAIN_V1 =
  "understand-code-provider-acceptance-authority-key-check-v1";
const IDENTITY_STATE_DIGEST_DOMAIN_V1 =
  "understand-code-provider-acceptance-authority-identity-state-v1";
const IDENTITY_MARKER_TOKEN_DOMAIN_V1 =
  "understand-code-provider-acceptance-authority-identity-marker-v1";
const MAX_IDENTITY_RECORD_BYTES_V1 = 16 * 1024;
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
  readonly keyCheckToken: string;
}

interface InstallationIdentityAuthorityMarkerInternalV1 {
  readonly schemaVersion: 1;
  readonly profile: typeof IDENTITY_MARKER_PROFILE_V1;
  readonly installationIdentityGenerationId:
    InstallationIdentityGenerationIdV1;
  readonly identityStateDigest: string;
  readonly markerToken: string;
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

function parseIdentityStateV1(
  value: unknown,
): InstallationIdentityAuthorityStateInternalV1 {
  if (
    !exactRecordV1(value, [
      "schemaVersion",
      "profile",
      "installationIdentityGenerationId",
      "initializationNonce",
      "keyCheckToken",
    ]) ||
    value.schemaVersion !== 1 ||
    value.profile !== IDENTITY_STATE_PROFILE_V1 ||
    typeof value.initializationNonce !== "string" ||
    !/^[0-9a-f]{32}$/u.test(value.initializationNonce) ||
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
    keyCheckToken: value.keyCheckToken,
  });
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

function identityKeyCheckFieldsV1(
  state: Omit<InstallationIdentityAuthorityStateInternalV1, "keyCheckToken">,
): object {
  return Object.freeze({
    installationIdentityGenerationId:
      state.installationIdentityGenerationId,
    initializationNonce: state.initializationNonce,
  });
}

async function readOptionalIdentityFileV1(
  layout: ProviderAcceptanceAuthorityLayoutInternalV1,
  path: string,
  maximumBytes: number,
): Promise<
  Awaited<ReturnType<typeof readCheckedAuthorityFileInternalV1>> | undefined
> {
  try {
    return await readCheckedAuthorityFileInternalV1({
      path,
      layout,
      maximumBytes,
    });
  } catch (error) {
    if (isMissingFileInternalV1(error)) return undefined;
    throw error;
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
    // Identity absence is only "not provisioned" for an observed empty
    // authority namespace. An unobservable private directory fails closed.
    throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
  }
}

export interface ProviderAcceptanceInstallationIdentityInternalV1 {
  readonly installationIdentityGenerationId:
    InstallationIdentityGenerationIdV1;
  /** Callback-only custody: the key is zeroed immediately after the callback. */
  readonly withKey: <T>(operation: (key: Buffer) => Promise<T>) => Promise<T>;
}

export async function openProviderAcceptanceInstallationIdentityInternalV1(
  layout: ProviderAcceptanceAuthorityLayoutInternalV1,
): Promise<ProviderAcceptanceInstallationIdentityInternalV1> {
  const directoryState =
    await ensureProviderAcceptanceAuthorityDirectoriesInternalV1(
      layout,
      false,
    );
  if (!directoryState.privateNamespaceAvailable) {
    throw new ProviderAcceptanceAuthorityErrorV1("not_provisioned");
  }
  let stateBytes: Buffer;
  let markerBytes: Buffer;
  const [stateFile, markerFile] = await Promise.all([
    readOptionalIdentityFileV1(
      layout,
      layout.installationIdentityStatePath,
      MAX_IDENTITY_RECORD_BYTES_V1,
    ),
    readOptionalIdentityFileV1(
      layout,
      layout.installationIdentityInitializationMarkerPath,
      MAX_IDENTITY_RECORD_BYTES_V1,
    ),
  ]);
  const keyFile = await readOptionalIdentityFileV1(
    layout,
    layout.installationIdentityKeyPath,
    32,
  );
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
      keyFile === undefined || keyFile.bytes.byteLength !== 32 ||
      !directoryState.complete
    ) {
      throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
    }
    stateBytes = stateFile.bytes;
    markerBytes = markerFile.bytes;
  } finally {
    keyFile?.bytes.fill(0);
  }
  let state: InstallationIdentityAuthorityStateInternalV1;
  let marker: InstallationIdentityAuthorityMarkerInternalV1;
  try {
    state = parseIdentityStateV1(
      parseCanonicalAuthorityBytesInternalV1(stateBytes),
    );
    marker = parseIdentityMarkerV1(
      parseCanonicalAuthorityBytesInternalV1(markerBytes),
    );
  } catch (error) {
    if (error instanceof ProviderAcceptanceAuthorityErrorV1) throw error;
    throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid", {
      cause: error,
    });
  }
  if (
    marker.installationIdentityGenerationId !==
      state.installationIdentityGenerationId ||
    marker.identityStateDigest !==
      digestDomainInternalV1(IDENTITY_STATE_DIGEST_DOMAIN_V1, state)
  ) {
    throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
  }

  const withKey = async <T>(
    operation: (key: Buffer) => Promise<T>,
  ): Promise<T> => {
    let key: Buffer | undefined;
    try {
      const currentDirectoryState =
        await ensureProviderAcceptanceAuthorityDirectoriesInternalV1(
          layout,
          false,
        );
      if (!currentDirectoryState.complete) {
        throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
      }
      const [currentState, currentMarker] = await Promise.all([
        readCheckedAuthorityFileInternalV1({
          path: layout.installationIdentityStatePath,
          layout,
          maximumBytes: MAX_IDENTITY_RECORD_BYTES_V1,
        }),
        readCheckedAuthorityFileInternalV1({
          path: layout.installationIdentityInitializationMarkerPath,
          layout,
          maximumBytes: MAX_IDENTITY_RECORD_BYTES_V1,
        }),
      ]);
      if (
        Buffer.compare(currentState.bytes, stateBytes) !== 0 ||
        Buffer.compare(currentMarker.bytes, markerBytes) !== 0
      ) {
        throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
      }
      const checked = await readCheckedAuthorityFileInternalV1({
        path: layout.installationIdentityKeyPath,
        layout,
        maximumBytes: 32,
      });
      if (checked.bytes.byteLength !== 32) {
        throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
      }
      // Use the checked read buffer itself so the only in-memory raw-key copy
      // owned by this module is deterministically zeroed below.
      key = checked.bytes;
      if (
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
      return await operation(key);
    } catch (error) {
      if (isMissingFileInternalV1(error)) {
        throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
      }
      throw error;
    } finally {
      key?.fill(0);
    }
  };

  // Verify custody before returning a usable handle.
  await withKey(async () => undefined);
  return Object.freeze({
    installationIdentityGenerationId:
      state.installationIdentityGenerationId,
    withKey,
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
  const unsignedState = Object.freeze({
    schemaVersion: 1 as const,
    profile: IDENTITY_STATE_PROFILE_V1,
    installationIdentityGenerationId,
    initializationNonce,
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

  const created: string[] = [];
  try {
    await createDurableAuthorityFileInternalV1({
      path: layout.installationIdentityKeyPath,
      bytes: key,
      layout,
    });
    created.push(layout.installationIdentityKeyPath);
    await createDurableAuthorityFileInternalV1({
      path: layout.installationIdentityStatePath,
      bytes: canonicalAuthorityBytesInternalV1(state),
      layout,
    });
    created.push(layout.installationIdentityStatePath);
    await createDurableAuthorityFileInternalV1({
      path: layout.installationIdentityInitializationMarkerPath,
      bytes: canonicalAuthorityBytesInternalV1(marker),
      layout,
    });
    created.push(layout.installationIdentityInitializationMarkerPath);
  } catch (error) {
    for (let index = created.length - 1; index >= 0; index -= 1) {
      const path = created[index]!;
      await unlink(path).catch(() => undefined);
      await syncParentDirectoryInternalV1(path).catch(() => undefined);
    }
    throw error;
  } finally {
    key.fill(0);
  }
}
