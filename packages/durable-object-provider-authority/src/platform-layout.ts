import { userInfo } from "node:os";
import { dirname, isAbsolute, join, normalize, parse, resolve } from "node:path";

import { resolveNativeInstallationStateRootV1 } from "@understand-code/native-kernel-bridge";

import { ProviderAcceptanceAuthorityErrorV1 } from "./errors.js";

export const PROVIDER_ACCEPTANCE_AUTHORITY_LOGICAL_LOCATORS_V1 = Object.freeze({
  installationIdentityKey:
    "runtime-state/private/installation-identity-v1.key",
  installationIdentityInitializationMarker:
    "runtime-state/private/installation-identity-v1.init",
  installationIdentityState:
    "runtime-state/private/installation-identity-v1.json",
  acceptanceGenerationPrefix: "provider/acceptance/generations/",
  acceptanceCurrent: "provider/acceptance/current.json",
  acceptanceReceiptPrefix:
    "provider/acceptance/compare-append-receipts/",
  canonicalSnapshot:
    "runtime-state/private/provider-acceptance-authority-v1.snapshot.json",
  deterministicSnapshotStage:
    "runtime-state/private/.provider-acceptance-authority-v1.snapshot.stage",
  canonicalPublicationPin:
    "runtime-state/private/provider-acceptance-authority-v1.publication.json",
  deterministicPublicationPinStage:
    "runtime-state/private/.provider-acceptance-authority-v1.publication.stage",
  transactionLock:
    "runtime-state/private/.provider-acceptance-authority-v1.lock",
  transactionLockStage:
    "runtime-state/private/.provider-acceptance-authority-v1.lock.stage",
  transactionLockRecoveryClaim:
    "runtime-state/private/.provider-acceptance-authority-v1.lock.recovery",
  transactionLockQuarantine:
    "runtime-state/private/.provider-acceptance-authority-v1.lock.stale",
} as const);

/** Source-internal only; deliberately absent from the package-root locator set. */
export const PROVIDER_STRONG_MUTATION_BROKER_LOGICAL_LOCATORS_INTERNAL_V1 =
  Object.freeze({
    canonicalSnapshot:
      "runtime-state/private/provider-strong-mutation-broker-v1.snapshot.json",
    deterministicSnapshotStage:
      "runtime-state/private/.provider-strong-mutation-broker-v1.snapshot.stage",
    canonicalPublicationPin:
      "runtime-state/private/provider-strong-mutation-broker-v1.publication.json",
    deterministicPublicationPinStage:
      "runtime-state/private/.provider-strong-mutation-broker-v1.publication.stage",
  } as const);

export interface ProviderAcceptanceAuthorityLayoutInternalV1 {
  readonly authorityRoot: string;
  readonly authorityUid: number;
  readonly authorityGid: number;
  readonly authorityResolverId: string;
  readonly trustedParentDirectories: readonly string[];
  readonly directories: readonly string[];
  readonly installationIdentityKeyPath: string;
  readonly installationIdentityInitializationMarkerPath: string;
  readonly installationIdentityStatePath: string;
  readonly installationIdentityInitializationLockPath: string;
  readonly installationIdentityMarkerStagePath: string;
  readonly canonicalSnapshotPath: string;
  readonly deterministicSnapshotStagePath: string;
  readonly canonicalPublicationPinPath: string;
  readonly deterministicPublicationPinStagePath: string;
  readonly canonicalStrongMutationBrokerSnapshotPath: string;
  readonly deterministicStrongMutationBrokerSnapshotStagePath: string;
  readonly canonicalStrongMutationBrokerPublicationPinPath: string;
  readonly deterministicStrongMutationBrokerPublicationPinStagePath: string;
  readonly transactionLockPath: string;
  readonly transactionLockStagePath: string;
  readonly transactionLockRecoveryClaimPath: string;
  readonly transactionLockQuarantinePath: string;
}

function exactEffectiveUidV1(): number {
  const value = typeof process.geteuid === "function"
    ? process.geteuid()
    : typeof process.getuid === "function"
    ? process.getuid()
    : undefined;
  if (!Number.isSafeInteger(value) || value === undefined || value < 0) {
    throw new ProviderAcceptanceAuthorityErrorV1("invalid_layout");
  }
  return value;
}

function safeAuthorityRootV1(value: string): string {
  if (
    !isAbsolute(value) ||
    value.includes("\0") ||
    Buffer.byteLength(value, "utf8") > 4096
  ) {
    throw new ProviderAcceptanceAuthorityErrorV1("invalid_layout");
  }
  const normalized = normalize(resolve(value));
  if (normalized === parse(normalized).root) {
    throw new ProviderAcceptanceAuthorityErrorV1("invalid_layout");
  }
  return normalized;
}

function createLayoutV1(
  authorityRoot: string,
  authorityUid: number,
  authorityGid: number,
  authorityResolverId: string,
): ProviderAcceptanceAuthorityLayoutInternalV1 {
  const root = safeAuthorityRootV1(authorityRoot);
  const runtimeState = join(root, "runtime-state");
  const privateRoot = join(runtimeState, "private");
  const providerRoot = join(root, "provider");
  const acceptanceRoot = join(providerRoot, "acceptance");
  const parent = dirname(root);
  const trustedParentDirectories = authorityResolverId ===
      "test-explicit-temporary-root-v1"
    ? Object.freeze([])
    : Object.freeze([
        dirname(dirname(parent)),
        dirname(parent),
        parent,
      ]);
  return Object.freeze({
    authorityRoot: root,
    authorityUid,
    authorityGid,
    authorityResolverId,
    trustedParentDirectories,
    directories: Object.freeze([
      root,
      runtimeState,
      privateRoot,
      providerRoot,
      acceptanceRoot,
    ]),
    installationIdentityKeyPath: join(
      root,
      PROVIDER_ACCEPTANCE_AUTHORITY_LOGICAL_LOCATORS_V1
        .installationIdentityKey,
    ),
    installationIdentityInitializationMarkerPath: join(
      root,
      PROVIDER_ACCEPTANCE_AUTHORITY_LOGICAL_LOCATORS_V1
        .installationIdentityInitializationMarker,
    ),
    installationIdentityStatePath: join(
      root,
      PROVIDER_ACCEPTANCE_AUTHORITY_LOGICAL_LOCATORS_V1
        .installationIdentityState,
    ),
    installationIdentityInitializationLockPath: join(
      root,
      "runtime-state/private/.installation-identity-v1.lock",
    ),
    installationIdentityMarkerStagePath: join(
      root,
      "runtime-state/private/.installation-identity-v1.init.stage",
    ),
    canonicalSnapshotPath: join(
      root,
      PROVIDER_ACCEPTANCE_AUTHORITY_LOGICAL_LOCATORS_V1.canonicalSnapshot,
    ),
    deterministicSnapshotStagePath: join(
      root,
      PROVIDER_ACCEPTANCE_AUTHORITY_LOGICAL_LOCATORS_V1
        .deterministicSnapshotStage,
    ),
    canonicalPublicationPinPath: join(
      root,
      PROVIDER_ACCEPTANCE_AUTHORITY_LOGICAL_LOCATORS_V1
        .canonicalPublicationPin,
    ),
    deterministicPublicationPinStagePath: join(
      root,
      PROVIDER_ACCEPTANCE_AUTHORITY_LOGICAL_LOCATORS_V1
        .deterministicPublicationPinStage,
    ),
    canonicalStrongMutationBrokerSnapshotPath: join(
      root,
      PROVIDER_STRONG_MUTATION_BROKER_LOGICAL_LOCATORS_INTERNAL_V1
        .canonicalSnapshot,
    ),
    deterministicStrongMutationBrokerSnapshotStagePath: join(
      root,
      PROVIDER_STRONG_MUTATION_BROKER_LOGICAL_LOCATORS_INTERNAL_V1
        .deterministicSnapshotStage,
    ),
    canonicalStrongMutationBrokerPublicationPinPath: join(
      root,
      PROVIDER_STRONG_MUTATION_BROKER_LOGICAL_LOCATORS_INTERNAL_V1
        .canonicalPublicationPin,
    ),
    deterministicStrongMutationBrokerPublicationPinStagePath: join(
      root,
      PROVIDER_STRONG_MUTATION_BROKER_LOGICAL_LOCATORS_INTERNAL_V1
        .deterministicPublicationPinStage,
    ),
    transactionLockPath: join(
      root,
      PROVIDER_ACCEPTANCE_AUTHORITY_LOGICAL_LOCATORS_V1.transactionLock,
    ),
    transactionLockStagePath: join(
      root,
      PROVIDER_ACCEPTANCE_AUTHORITY_LOGICAL_LOCATORS_V1.transactionLockStage,
    ),
    transactionLockRecoveryClaimPath: join(
      root,
      PROVIDER_ACCEPTANCE_AUTHORITY_LOGICAL_LOCATORS_V1
        .transactionLockRecoveryClaim,
    ),
    transactionLockQuarantinePath: join(
      root,
      PROVIDER_ACCEPTANCE_AUTHORITY_LOGICAL_LOCATORS_V1
        .transactionLockQuarantine,
    ),
  });
}

/** Resolve production storage without consulting HOME, XDG, cwd, or tmp. */
export function resolveProviderAcceptanceAuthorityProductionLayoutInternalV1(): ProviderAcceptanceAuthorityLayoutInternalV1 {
  try {
    const resolved = resolveNativeInstallationStateRootV1();
    if (
      resolved.profile !== "native_installation_state_resolver_v1" ||
      ![
        "darwin-user-domain-application-support-v1",
        "linux-getpwuid-effective-user-state-v1",
      ].includes(resolved.resolverId) ||
      resolved.uid !== exactEffectiveUidV1() ||
      !Number.isSafeInteger(resolved.gid) || resolved.gid < 0
    ) {
      throw new ProviderAcceptanceAuthorityErrorV1("invalid_layout");
    }
    return createLayoutV1(
      resolved.root,
      resolved.uid,
      resolved.gid,
      resolved.resolverId,
    );
  } catch (error) {
    if (error instanceof ProviderAcceptanceAuthorityErrorV1) throw error;
    throw new ProviderAcceptanceAuthorityErrorV1("invalid_layout");
  }
}

/** Package-private constructor; only the sealed test seam calls this. */
export function createProviderAcceptanceAuthorityTestLayoutInternalV1(
  root: string,
): ProviderAcceptanceAuthorityLayoutInternalV1 {
  const account = userInfo({ encoding: "utf8" });
  const effectiveUid = exactEffectiveUidV1();
  if (account.uid !== effectiveUid) {
    throw new ProviderAcceptanceAuthorityErrorV1("invalid_layout");
  }
  return createLayoutV1(
    root,
    account.uid,
    account.gid,
    "test-explicit-temporary-root-v1",
  );
}

export function providerAcceptanceGenerationLogicalLocatorInternalV1(
  generationId: string,
): string {
  return `${PROVIDER_ACCEPTANCE_AUTHORITY_LOGICAL_LOCATORS_V1.acceptanceGenerationPrefix}${encodeURIComponent(generationId)}.json`;
}

export function providerAcceptanceReceiptLogicalLocatorInternalV1(
  operationNonce: string,
): string {
  return `${PROVIDER_ACCEPTANCE_AUTHORITY_LOGICAL_LOCATORS_V1.acceptanceReceiptPrefix}${encodeURIComponent(operationNonce)}.json`;
}
