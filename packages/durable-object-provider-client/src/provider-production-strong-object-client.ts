import {
  createHash,
  createHmac,
  createPublicKey,
  timingSafeEqual,
  verify,
  type KeyObject,
} from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { lstat, open, readFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";

import {
  deriveStoreDurableObjectProviderRegistryEntryContentDigestV1,
  validateProviderRegistryManifestHistoryV1,
} from "@understand-code/durable-object-provider-contracts/provider-registry";
import {
  canonicalizeJcsSafeIntegerV1,
  parseCanonicalJcsSafeIntegerUtf8V1,
} from "@understand-code/durable-object-provider-contracts/jcs";
import {
  CanonicalByteStringV1Schema,
  CanonicalPublicKeyBytes32V1Schema,
  ContentDigestV1Schema,
  KeyedStateTokenV1Schema,
  LowerHex32V1Schema,
  ProviderTargetProfileIdV1Schema,
  type ContentDigestV1,
  type DurableObjectIdentityProviderIdV1,
  type KeyedStateTokenV1,
} from "@understand-code/durable-object-provider-contracts/primitives";
import {
  ProviderRuntimeIpcAcceptanceIdentityProofV1Schema,
  ProviderRuntimeIpcCompareCommitResultV1Schema,
  ProviderRuntimeIpcFixedObjectLocatorV1Schema,
  ProviderRuntimeIpcInspectStateResultV1Schema,
  ProviderRuntimeIpcReadObjectResultV1Schema,
  ProviderRuntimeIpcStrongMutationAuthorityGrantIdFieldsV1Schema,
  ProviderRuntimeIpcStrongMutationRequestClaimsV1Schema,
  ProviderRuntimeIpcWriteObjectResultV1Schema,
  type ProviderRuntimeIpcAcceptanceIdentityProofV1,
  type ProviderRuntimeIpcCompareCommitResultV1,
  type ProviderRuntimeIpcFixedObjectLocatorV1,
  type ProviderRuntimeIpcJsonValueV1,
  type ProviderRuntimeIpcJournalStateV1,
  type ProviderRuntimeIpcInspectStateResultV1,
  type ProviderRuntimeIpcStrongMutationAuthorityGrantIdFieldsV1,
  type ProviderRuntimeIpcStrongMutationRequestClaimsV1,
  type ProviderRuntimeIpcStrongMutationResponseV1,
  type ProviderRuntimeIpcWriteObjectResultV1,
  type ProviderRuntimeIpcReadObjectResultV1,
} from "@understand-code/durable-object-provider-contracts/provider-runtime-ipc-v1";
import {
  ProviderAcceptanceGenerationPinV1Schema,
  ProviderAcceptanceStateEnvelopeV1Schema,
  deriveProviderAcceptanceStateContentDigestV1,
  deriveProviderAcceptanceStateGenerationIdV1,
} from "@understand-code/durable-object-provider-contracts/provider-acceptance";
import {
  attestProviderStrictEd25519CryptoHostV1,
  PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1,
  PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
  type ProviderStrictEd25519OpaqueCapabilityV1,
} from "@understand-code/durable-object-provider-contracts/strict-ed25519-conformance";
import {
  STRICT_ED25519_VERIFICATION_PROFILE_V1,
  validatePrimeSubgroupPoint,
  verifyRawEd25519,
} from "@understand-code/durable-object-provider-contracts/strict-ed25519";
import {
  readProviderServiceReadinessV1,
  verifyProviderServiceHandoffConfigV1,
  type ProviderServiceHandoffConfigV1,
} from "@understand-code/durable-object-provider-runtime/service-handoff";
import {
  providerProductionStrongClientGatewaySocketPathV1,
} from "@understand-code/durable-object-provider-runtime/provider-production-strong-client-trust-lifecycle";
import {
  projectProviderRuntimeDurableLifecycleArtifactsV1,
  type ProviderRuntimeDurableLifecycleProjectionV1,
} from "@understand-code/durable-object-provider-runtime/durable-acceptance-current";
import {
  PROVIDER_RUNTIME_DURABLE_BUSINESS_HEAD_ARTIFACT_KEY_V1,
  PROVIDER_RUNTIME_DURABLE_BUSINESS_HEAD_PROFILE_V1,
} from "@understand-code/durable-object-provider-runtime/durable-lifecycle-artifacts";

import {
  mintProviderRuntimeStrongMutationAuthorityGrantSignerCapabilityInternalV1,
} from "./provider-runtime-strong-mutation-authority-grant-signer-internal.js";
import {
  ProviderRuntimeStrongMutationClientErrorInternalV1,
  exchangeProviderRuntimeStrongMutationSameSocketInternalV1,
} from "./provider-runtime-strong-mutation-transport-internal.js";
import {
  createDurableObjectProviderRuntimeClientV1,
  type DurableObjectProviderRuntimeClientV1,
} from "./provider-runtime-client.js";

const DEFAULT_TIMEOUT_MS_V1 = 5_000;
const MAXIMUM_TIMEOUT_MS_V1 = 60_000;
const ED25519_SIGNATURE_BYTES_V1 = 64;

type StrongMutationSuccessPayloadInternalV1 = Extract<
  ProviderRuntimeIpcStrongMutationResponseV1,
  { readonly ok: true }
>["payload"];

function exactCanonicalEqualV1(left: unknown, right: unknown): boolean {
  try {
    return canonicalizeJcsSafeIntegerV1(left) === canonicalizeJcsSafeIntegerV1(right);
  } catch {
    return false;
  }
}

function positiveTimeoutV1(value: number | undefined): number {
  const timeout = value ?? DEFAULT_TIMEOUT_MS_V1;
  if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > MAXIMUM_TIMEOUT_MS_V1) {
    throw new ProviderRuntimeStrongMutationClientErrorInternalV1(
      "invalid_input",
      "strong mutation timeout is invalid",
    );
  }
  return timeout;
}

function sha256DigestV1(bytes: Uint8Array): ContentDigestV1 {
  return ContentDigestV1Schema.parse(
    `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
  );
}

function decodeExactSignatureV1(value: string): Uint8Array | undefined {
  try {
    const encoded = CanonicalByteStringV1Schema.parse(value);
    const bytes = Uint8Array.from(
      Buffer.from(encoded.slice("base64url:".length), "base64url"),
    );
    return bytes.byteLength === ED25519_SIGNATURE_BYTES_V1 ? bytes : undefined;
  } catch {
    return undefined;
  }
}

function exactEd25519PublicKeyV1(value: unknown): {
  readonly key: KeyObject;
} {
  try {
    const encoded = CanonicalByteStringV1Schema.parse(value);
    const bytes = Buffer.from(encoded.slice("base64url:".length), "base64url");
    const key = createPublicKey({ key: bytes, format: "der", type: "spki" });
    const canonical = Buffer.from(key.export({ format: "der", type: "spki" }));
    if (key.type !== "public" || key.asymmetricKeyType !== "ed25519" || !canonical.equals(bytes)) {
      throw new TypeError("invalid Ed25519 key");
    }
    return { key };
  } catch (error) {
    throw new ProviderRuntimeStrongMutationClientErrorInternalV1(
      "invalid_input",
      "strong mutation service public key is invalid",
      { cause: error },
    );
  }
}

const PRODUCTION_TRUST_SNAPSHOT_PROFILE_V1 =
  "provider_production_strong_client_trust_snapshot_v1" as const;
const PRODUCTION_TRUST_SNAPSHOT_BASENAME_V1 =
  "provider-production-strong-client-trust-v1.json" as const;
const PRODUCTION_INSTALLATION_MANIFEST_BASENAME_V1 =
  "provider-service-installation-manifest-v1.json" as const;
const PRODUCTION_INSTALLATION_MANIFEST_PROFILE_V1 =
  "understand_code_provider_service_installation_manifest_v1" as const;
const PRODUCTION_INSTALLATION_MANIFEST_DIGEST_DOMAIN_V1 =
  "understand-code-provider-service-installation-manifest-v1" as const;
const PRODUCTION_STRONG_RUNTIME_PHASE_V1 = "final_strong_ready" as const;
const PRODUCTION_STRONG_BUSINESS_UNINITIALIZED_PHASE_V1 =
  "provider_business_uninitialized_v1" as const;
const PRODUCTION_STRONG_INDEX_PUBLICATION_AUTHORITY_PROFILE_V1 =
  "provider_production_strong_index_publication_authority_v1" as const;
const PRODUCTION_STRONG_INDEX_PUBLICATION_AUTHORITY_ARTIFACT_KEY_V1 =
  "__understand_code_reserved_index_publication_authority_v1" as const;
const MAX_PRODUCTION_ACCEPTANCE_HISTORY_GENERATIONS_V1 = 4_096;
const MAX_PRODUCTION_TOTAL_TRUST_HISTORY_LOGICAL_BYTES_V1 =
  256 * 1024 * 1024;
const MAX_PRODUCTION_SINGLE_TRUST_ENVELOPE_LOGICAL_BYTES_V1 =
  4 * 1024 * 1024;
// Match the Acceptance authority's physical snapshot cap: 300 MiB carries the
// frozen 256 MiB retained history plus current projections/signature wrapper.
const MAX_PRODUCTION_TRUST_SNAPSHOT_BYTES_V1 = 300 * 1024 * 1024;
const MAX_PRODUCTION_INSTALLATION_MANIFEST_BYTES_V1 = 1024 * 1024;
const MAX_GRANT_KEY_BYTES_V1 = 512;
const O_CLOEXEC_V1 =
  (fsConstants as Readonly<Record<string, number>>)["O_CLOEXEC"] ?? 0;

export interface OpenProviderProductionStrongObjectClientV1Input {
  /** The only selector. Authority comes from its signed installation closure. */
  readonly canonicalInstallationRoot: string;
}

export interface ProviderProductionStrongWriteExactObjectV1Input {
  readonly locator: ProviderRuntimeIpcFixedObjectLocatorV1;
  readonly logicalBytes: number;
  readonly bytes: string;
  /** Explicit request identity; the client never invents or retries it. */
  readonly operationNonce: string;
}

export interface ProviderProductionStrongCompareCommitV1Input {
  readonly expectedRevision: number;
  readonly operationNonce: string;
  readonly phase: string;
  readonly artifacts: Readonly<Record<string, ProviderRuntimeIpcJsonValueV1>>;
}

export interface ProviderProductionStrongIndexPublicationAuthorityV1 {
  readonly profile:
    typeof PRODUCTION_STRONG_INDEX_PUBLICATION_AUTHORITY_PROFILE_V1;
  readonly finalizedProviderRevision: number;
  readonly generationId: `generation-${string}`;
  readonly generationManifestDigest: ContentDigestV1;
  readonly sourceInventoryDigest: ContentDigestV1;
  readonly sourceSnapshotId: string;
}

export type ProviderProductionStrongIndexPublicationAuthorityInputV1 = Omit<
  ProviderProductionStrongIndexPublicationAuthorityV1,
  "finalizedProviderRevision"
>;

export interface ProviderProductionStrongCompareCommitIndexPublicationV1Input
  extends ProviderProductionStrongCompareCommitV1Input {
  readonly authority: ProviderProductionStrongIndexPublicationAuthorityInputV1;
}

export type ProviderProductionOwnerCommitmentDomainV1 =
  | "record-verification-full-input-v1"
  | "verification-detail-semantic-v1"
  | "repository-index-state-v1"
  | "repository-worktree-state-v1"
  | "repository-untracked-state-v1"
  | "repository-ignore-state-v1"
  | "repository-state-semantic-v1";

export type ProviderProductionStrongBusinessHeadV1 =
  ProviderRuntimeIpcJournalStateV1;

export interface ProviderProductionStrongObjectClientV1 {
  /** Read-only identity derived from the verified signed installation. */
  readonly verifiedProviderId: DurableObjectIdentityProviderIdV1;
  /** Minimal journal observation; artifacts never cross the public gateway. */
  inspectState(): Promise<Readonly<{ revision: number }>>;
  /** Read-only, Acceptance-validated projection of the current business head. */
  inspectBusinessHead(): Promise<ProviderProductionStrongBusinessHeadV1>;
  inspectIndexPublicationAuthority(): Promise<
    ProviderProductionStrongIndexPublicationAuthorityV1 | undefined
  >;
  readExactObject(
    locator: ProviderRuntimeIpcFixedObjectLocatorV1,
  ): Promise<ProviderRuntimeIpcReadObjectResultV1>;
  writeExactObject(
    input: ProviderProductionStrongWriteExactObjectV1Input,
  ): Promise<ProviderRuntimeIpcWriteObjectResultV1>;
  compareCommit(
    input: ProviderProductionStrongCompareCommitV1Input,
  ): Promise<ProviderRuntimeIpcCompareCommitResultV1>;
  compareCommitIndexPublication(
    input: ProviderProductionStrongCompareCommitIndexPublicationV1Input,
  ): Promise<ProviderRuntimeIpcCompareCommitResultV1>;
  commitOwnerOnlyState(
    domain: ProviderProductionOwnerCommitmentDomainV1,
    canonicalValue: string,
  ): Promise<KeyedStateTokenV1>;
  close(): void;
}

export interface ProviderProductionStrongObjectHostInternalV1 {
  readonly verifiedProviderId: DurableObjectIdentityProviderIdV1;
  readonly verifiedInstallationRoot: string;
  readonly servicePrincipal: Readonly<{ readonly uid: number; readonly gid: number }>;
  readonly callerPrincipal: Readonly<{ readonly uid: number; readonly gid: number }>;
  readonly gatewaySocketPath: string;
  readonly serviceConfigPayloadDigest: ContentDigestV1;
  readonly trustSnapshotDigest: ContentDigestV1;
  inspectState(): Promise<Readonly<{ revision: number }>>;
  inspectBusinessHead(): Promise<ProviderProductionStrongBusinessHeadV1>;
  inspectIndexPublicationAuthority(): Promise<
    ProviderProductionStrongIndexPublicationAuthorityV1 | undefined
  >;
  readExactObject(
    locator: ProviderRuntimeIpcFixedObjectLocatorV1,
  ): Promise<ProviderRuntimeIpcReadObjectResultV1>;
  writeExactObject(
    input: ProviderProductionStrongWriteExactObjectV1Input,
  ): Promise<ProviderRuntimeIpcWriteObjectResultV1>;
  compareCommit(
    input: ProviderProductionStrongCompareCommitV1Input,
  ): Promise<ProviderRuntimeIpcCompareCommitResultV1>;
  compareCommitIndexPublication(
    input: ProviderProductionStrongCompareCommitIndexPublicationV1Input,
  ): Promise<ProviderRuntimeIpcCompareCommitResultV1>;
  commitOwnerOnlyState(
    domain: ProviderProductionOwnerCommitmentDomainV1,
    canonicalValue: string,
  ): KeyedStateTokenV1;
  close(): void;
}

interface ProductionSelectionV1 {
  readonly canonicalInstallationRoot: string;
  readonly serviceConfig: ProviderServiceHandoffConfigV1;
  readonly canonicalTargetRoot: string;
  readonly targetProfileId:
    ProviderRuntimeIpcStrongMutationAuthorityGrantIdFieldsV1["targetProfileId"];
  readonly targetFingerprintDigest: ContentDigestV1;
  readonly acceptanceIdentity: ProviderRuntimeIpcAcceptanceIdentityProofV1;
  readonly acceptanceEnvelope: ReturnType<
    typeof ProviderAcceptanceStateEnvelopeV1Schema.parse
  >;
  readonly acceptancePin: ReturnType<
    typeof ProviderAcceptanceGenerationPinV1Schema.parse
  >;
  readonly acceptanceHistory: readonly Readonly<{
    envelope: ReturnType<
      typeof ProviderAcceptanceStateEnvelopeV1Schema.parse
    >;
    pin: ReturnType<
      typeof ProviderAcceptanceGenerationPinV1Schema.parse
    >;
  }>[];
  readonly signerKeyId:
    ProviderRuntimeIpcStrongMutationAuthorityGrantIdFieldsV1["signerKeyId"];
  readonly signerPublicKeyBytes: ReturnType<
    typeof CanonicalPublicKeyBytes32V1Schema.parse
  >;
  readonly registryManifest:
    ProviderRuntimeIpcStrongMutationAuthorityGrantIdFieldsV1["registryManifest"];
  /** Signed path to caller-owned 0600/nlink=1 Ed25519 PKCS#8 custody. */
  readonly grantKeyPath: string;
  readonly installationIdentityKeyPath: string;
  readonly installationIdentityKeyDigest: ContentDigestV1;
  readonly installationIdentityKeyCheck: Readonly<{
    readonly generationId: string;
    readonly initializationNonce: string;
    readonly token: KeyedStateTokenV1;
  }>;
  readonly callerPrincipal: Readonly<{ readonly uid: number; readonly gid: number }>;
  readonly gatewaySocketPath: string;
  readonly trustSnapshotDigest: ContentDigestV1;
}

interface ProductionStrongBusinessHeadInternalV1 {
  readonly profile: typeof PROVIDER_RUNTIME_DURABLE_BUSINESS_HEAD_PROFILE_V1;
  readonly phase:
    | "strong_change_check_v1"
    | "strong_verification_v1"
    | "strong_refresh_index_v1";
  readonly artifacts: Readonly<Record<string, ProviderRuntimeIpcJsonValueV1>>;
}

interface ProductionClientStateV1 {
  readonly selection: ProductionSelectionV1;
  readonly runtimeClient: DurableObjectProviderRuntimeClientV1;
  readonly grantKey: Uint8Array;
  readonly ownerCommitmentKey: Uint8Array;
  readonly timeoutMs: number;
}

const productionClientStatesV1 = new WeakMap<object, ProductionClientStateV1>();
let strictCryptoCapabilityPromiseV1:
  | Promise<ProviderStrictEd25519OpaqueCapabilityV1>
  | undefined;

function productionFailV1(message: string, cause?: unknown): never {
  throw new ProviderRuntimeStrongMutationClientErrorInternalV1(
    "invalid_input",
    message,
    { cause },
  );
}

function exactAbsolutePathV1(value: unknown, label: string): string {
  if (
    typeof value !== "string" || value.includes("\0") ||
    !isAbsolute(value) || resolve(value) !== value || value === "/"
  ) return productionFailV1(`${label} is invalid`);
  return value;
}

function kernelPrincipalV1(
  value: unknown,
  label: string,
): Readonly<{ readonly uid: number; readonly gid: number }> {
  const record = dataRecordV1(value, label);
  if (
    !exactKeysV1(record, ["uid", "gid"]) ||
    !Number.isSafeInteger(record.uid) || (record.uid as number) < 0 ||
    (record.uid as number) > 0xffff_ffff ||
    !Number.isSafeInteger(record.gid) || (record.gid as number) < 0 ||
    (record.gid as number) > 0xffff_ffff
  ) return productionFailV1(`${label} is invalid`);
  return Object.freeze({
    uid: record.uid as number,
    gid: record.gid as number,
  });
}

function productionTrustSnapshotPathV1(installationRoot: string): string {
  return exactAbsolutePathV1(
    join(installationRoot, PRODUCTION_TRUST_SNAPSHOT_BASENAME_V1),
    "production trust snapshot path",
  );
}

function strictCryptoCapabilityV1(): Promise<ProviderStrictEd25519OpaqueCapabilityV1> {
  strictCryptoCapabilityPromiseV1 ??= (async () => {
    const resourceBytes = await readFile(new URL(
      "../../durable-object-provider-contracts/provider/ed25519-strict-host-conformance-v1.json",
      import.meta.url,
    ));
    if (
      resourceBytes.byteLength < 1 ||
      resourceBytes.byteLength > PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1
    ) return productionFailV1("strict Ed25519 package resource is invalid");
    try {
      return await attestProviderStrictEd25519CryptoHostV1({
        host: {
          verificationProfile: STRICT_ED25519_VERIFICATION_PROFILE_V1,
          validatePrimeSubgroupPoint,
          verifyRawEd25519,
        },
        resourceHost: {
          readFixedSignedPackageResource(path, maximumBytes) {
            if (
              path !== PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1 ||
              maximumBytes !== PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1
            ) return productionFailV1("strict Ed25519 package resource is invalid");
            return new Uint8Array(resourceBytes);
          },
        },
      });
    } finally {
      resourceBytes.fill(0);
    }
  })();
  return strictCryptoCapabilityPromiseV1;
}

function dataRecordV1(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return productionFailV1(`${label} is invalid`);
  }
  return value as Record<string, unknown>;
}

function exactKeysV1(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
}

function exactSnapshotIdV1(value: unknown): value is string {
  return typeof value === "string" &&
    value.length >= 1 && value.length <= 256 &&
    value === value.trim() &&
    !/[\u0000-\u001f\u007f]/u.test(value);
}

export function providerProductionStrongIndexPublicationAuthorityInternalV1(
  value: unknown,
): ProviderProductionStrongIndexPublicationAuthorityV1 {
  const authority = dataRecordV1(
    value,
    "strong index publication authority",
  );
  if (
    !exactKeysV1(authority, [
      "profile",
      "finalizedProviderRevision",
      "generationId",
      "generationManifestDigest",
      "sourceInventoryDigest",
      "sourceSnapshotId",
    ]) ||
    authority.profile !==
      PRODUCTION_STRONG_INDEX_PUBLICATION_AUTHORITY_PROFILE_V1 ||
    !Number.isSafeInteger(authority.finalizedProviderRevision) ||
    (authority.finalizedProviderRevision as number) < 1 ||
    typeof authority.generationId !== "string" ||
    !/^generation-[0-9a-f]{64}$/u.test(authority.generationId) ||
    !exactSnapshotIdV1(authority.sourceSnapshotId)
  ) return productionFailV1("strong index publication authority is invalid");
  let generationManifestDigest: ContentDigestV1;
  let sourceInventoryDigest: ContentDigestV1;
  try {
    generationManifestDigest = ContentDigestV1Schema.parse(
      authority.generationManifestDigest,
    );
    sourceInventoryDigest = ContentDigestV1Schema.parse(
      authority.sourceInventoryDigest,
    );
  } catch (error) {
    return productionFailV1(
      "strong index publication authority is invalid",
      error,
    );
  }
  return Object.freeze({
    profile: PRODUCTION_STRONG_INDEX_PUBLICATION_AUTHORITY_PROFILE_V1,
    finalizedProviderRevision: authority.finalizedProviderRevision as number,
    generationId: authority.generationId as `generation-${string}`,
    generationManifestDigest,
    sourceInventoryDigest,
    sourceSnapshotId: authority.sourceSnapshotId,
  });
}

function parseProductionStrongIndexPublicationAuthorityInputV1(
  value: unknown,
  finalizedProviderRevision: number,
): ProviderProductionStrongIndexPublicationAuthorityV1 {
  const authority = dataRecordV1(
    value,
    "strong index publication authority input",
  );
  if (
    !exactKeysV1(authority, [
      "profile",
      "generationId",
      "generationManifestDigest",
      "sourceInventoryDigest",
      "sourceSnapshotId",
    ])
  ) return productionFailV1("strong index publication authority input is invalid");
  return providerProductionStrongIndexPublicationAuthorityInternalV1({
    ...authority,
    finalizedProviderRevision,
  });
}

function projectProductionStrongBusinessArtifactsV1(
  artifactsInput: Readonly<Record<string, ProviderRuntimeIpcJsonValueV1>>,
): Readonly<{
  publicArtifacts: Readonly<Record<string, ProviderRuntimeIpcJsonValueV1>>;
  authority?: ProviderProductionStrongIndexPublicationAuthorityV1;
}> {
  const artifacts = dataRecordV1(
    artifactsInput,
    "strong business head artifacts",
  ) as Record<string, ProviderRuntimeIpcJsonValueV1>;
  const reserved = artifacts[
    PRODUCTION_STRONG_INDEX_PUBLICATION_AUTHORITY_ARTIFACT_KEY_V1
  ];
  const publicArtifacts = Object.freeze(Object.fromEntries(
    Object.entries(artifacts).filter(
      ([key]) =>
        key !== PRODUCTION_STRONG_INDEX_PUBLICATION_AUTHORITY_ARTIFACT_KEY_V1,
    ),
  ));
  if (reserved === undefined) return Object.freeze({ publicArtifacts });
  return Object.freeze({
    publicArtifacts,
    authority:
      providerProductionStrongIndexPublicationAuthorityInternalV1(reserved),
  });
}

function createProductionStrongDurableBusinessArtifactsV1(
  currentArtifacts:
    | Readonly<Record<string, ProviderRuntimeIpcJsonValueV1>>
    | undefined,
  publicArtifacts: Readonly<Record<string, ProviderRuntimeIpcJsonValueV1>>,
  replacementAuthority?: ProviderProductionStrongIndexPublicationAuthorityV1,
): Readonly<Record<string, ProviderRuntimeIpcJsonValueV1>> {
  const currentAuthority = currentArtifacts === undefined
    ? undefined
    : projectProductionStrongBusinessArtifactsV1(currentArtifacts).authority;
  const authority = replacementAuthority ?? currentAuthority;
  const durableAuthority: ProviderRuntimeIpcJsonValueV1 | undefined =
    authority === undefined
      ? undefined
      : Object.freeze({
          profile: authority.profile,
          finalizedProviderRevision: authority.finalizedProviderRevision,
          generationId: authority.generationId,
          generationManifestDigest: authority.generationManifestDigest,
          sourceInventoryDigest: authority.sourceInventoryDigest,
          sourceSnapshotId: authority.sourceSnapshotId,
        });
  return Object.freeze({
    ...publicArtifacts,
    ...(durableAuthority === undefined
      ? {}
      : {
          [PRODUCTION_STRONG_INDEX_PUBLICATION_AUTHORITY_ARTIFACT_KEY_V1]:
            durableAuthority,
        }),
  });
}

/** Focused-test seam; the reserved artifact key remains private. */
export function providerProductionStrongIndexPublicationLaneInternalV1(
  input: Readonly<{
    currentArtifacts?: Readonly<
      Record<string, ProviderRuntimeIpcJsonValueV1>
    >;
    publicArtifacts: Readonly<Record<string, ProviderRuntimeIpcJsonValueV1>>;
    replacementAuthority?: ProviderProductionStrongIndexPublicationAuthorityV1;
    currentRevision: number;
  }>,
): Readonly<{
  durableArtifacts: Readonly<Record<string, ProviderRuntimeIpcJsonValueV1>>;
  publicArtifacts: Readonly<Record<string, ProviderRuntimeIpcJsonValueV1>>;
  authority?: ProviderProductionStrongIndexPublicationAuthorityV1;
}> {
  const durableArtifacts = createProductionStrongDurableBusinessArtifactsV1(
    input.currentArtifacts,
    input.publicArtifacts,
    input.replacementAuthority,
  );
  const projection = projectProductionStrongBusinessArtifactsV1(
    durableArtifacts,
  );
  assertProductionStrongIndexPublicationRevisionV1(
    projection.authority,
    input.currentRevision,
  );
  return Object.freeze({
    durableArtifacts,
    publicArtifacts: projection.publicArtifacts,
    ...(projection.authority === undefined
      ? {}
      : { authority: projection.authority }),
  });
}

function assertProductionStrongIndexPublicationRevisionV1(
  authority: ProviderProductionStrongIndexPublicationAuthorityV1 | undefined,
  currentRevision: number,
): void {
  if (
    authority !== undefined &&
    authority.finalizedProviderRevision > currentRevision
  ) productionFailV1("strong index publication authority revision is invalid");
}

async function readStableFileV1(input: {
  readonly path: string;
  readonly expectedUid: number;
  readonly expectedGid?: number;
  readonly exactMode?: number;
  readonly rejectWriteBits?: boolean;
  readonly minimumBytes: number;
  readonly maximumBytes: number;
  readonly label: string;
}): Promise<Buffer> {
  const path = exactAbsolutePathV1(input.path, input.label);
  const handle = await open(
    path,
    fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW | O_CLOEXEC_V1,
  );
  try {
    const before = await handle.stat({ bigint: true });
    if (
      !before.isFile() || before.nlink !== 1n ||
      before.uid !== BigInt(input.expectedUid) ||
      (input.expectedGid !== undefined &&
        before.gid !== BigInt(input.expectedGid)) ||
      (input.exactMode !== undefined &&
        (before.mode & 0o777n) !== BigInt(input.exactMode)) ||
      (input.rejectWriteBits === true && (before.mode & 0o022n) !== 0n) ||
      before.size < BigInt(input.minimumBytes) ||
      before.size > BigInt(input.maximumBytes)
    ) return productionFailV1(`${input.label} is invalid`);
    const bytes = await handle.readFile();
    const after = await handle.stat({ bigint: true });
    const projected = await lstat(path, { bigint: true });
    if (
      after.dev !== before.dev || after.ino !== before.ino ||
      after.mode !== before.mode || after.uid !== before.uid ||
      after.gid !== before.gid || after.nlink !== before.nlink ||
      after.size !== before.size || after.mtimeNs !== before.mtimeNs ||
      after.ctimeNs !== before.ctimeNs ||
      projected.dev !== before.dev || projected.ino !== before.ino ||
      projected.isSymbolicLink() || bytes.byteLength !== Number(before.size)
    ) return productionFailV1(`${input.label} changed during read`);
    return bytes;
  } finally {
    await handle.close();
  }
}

async function readRootJsonV1(
  path: string,
  label: string,
): Promise<unknown> {
  const bytes = await readStableFileV1({
    path,
    expectedUid: 0,
    rejectWriteBits: true,
    minimumBytes: 1,
    maximumBytes: MAX_PRODUCTION_TRUST_SNAPSHOT_BYTES_V1,
    label,
  });
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (error) {
    return productionFailV1(`${label} is invalid`, error);
  } finally {
    bytes.fill(0);
  }
}

interface ProductionInstallationSelectionInternalV1 {
  readonly installationRoot: string;
  readonly serviceConfigPath: string;
  readonly trustSnapshotPath: string;
  readonly manifestPayload: Record<string, unknown>;
}

async function readProductionInstallationSelectionV1(
  rootInput: string,
): Promise<ProductionInstallationSelectionInternalV1> {
  const installationRoot = exactAbsolutePathV1(
    rootInput,
    "provider installation root",
  );
  const manifestPath = exactAbsolutePathV1(
    join(installationRoot, PRODUCTION_INSTALLATION_MANIFEST_BASENAME_V1),
    "provider installation manifest path",
  );
  const manifest = dataRecordV1(
    await readRootJsonV1(manifestPath, "provider installation manifest"),
    "provider installation manifest",
  );
  if (!exactKeysV1(manifest, ["payload", "contentDigest"])) {
    return productionFailV1("provider installation manifest is invalid");
  }
  const payload = dataRecordV1(
    manifest.payload,
    "provider installation manifest payload",
  );
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
    payload.profile !== PRODUCTION_INSTALLATION_MANIFEST_PROFILE_V1 ||
    payload.installationRoot !== installationRoot ||
    payload.platform !== "linux" ||
    !Number.isSafeInteger(payload.manifestGeneration) ||
    (payload.manifestGeneration as number) < 1 ||
    manifest.contentDigest !== sha256DigestV1(Buffer.from(
      canonicalizeJcsSafeIntegerV1([
        PRODUCTION_INSTALLATION_MANIFEST_DIGEST_DOMAIN_V1,
        payload,
      ]),
      "utf8",
    )) ||
    !Array.isArray(payload.managedArtifacts) ||
    payload.managedArtifacts.length !== 4
  ) return productionFailV1("provider installation manifest is invalid");
  const artifacts = payload.managedArtifacts.map((candidate) =>
    dataRecordV1(candidate, "provider installation managed artifact")
  );
  const expectedKinds = [
    "service_config",
    "service_descriptor",
    "runtime_auth_key",
    "runtime_signing_key",
  ] as const;
  for (const [index, artifact] of artifacts.entries()) {
    if (
      !exactKeysV1(artifact, [
        "kind",
        "path",
        "contentDigest",
        "byteLength",
        "mode",
        "owner",
      ]) ||
      artifact.kind !== expectedKinds[index] ||
      !Number.isSafeInteger(artifact.byteLength) ||
      (artifact.byteLength as number) < 1 ||
      !Number.isSafeInteger(artifact.mode) ||
      (artifact.mode as number) < 0 ||
      (artifact.mode as number) > 0o777 ||
      (artifact.owner !== "authority" && artifact.owner !== "service_principal")
    ) return productionFailV1("provider installation manifest is invalid");
    exactAbsolutePathV1(
      artifact.path,
      "provider installation managed artifact path",
    );
    ContentDigestV1Schema.parse(artifact.contentDigest);
  }
  const configArtifact = artifacts[0]!;
  if (
    configArtifact.owner !== "authority" || configArtifact.mode !== 0o644 ||
    (configArtifact.byteLength as number) > MAX_PRODUCTION_INSTALLATION_MANIFEST_BYTES_V1
  ) return productionFailV1("provider installation service config is invalid");
  const serviceConfigPath = exactAbsolutePathV1(
    configArtifact.path,
    "provider installation service config path",
  );
  const configBytes = await readStableFileV1({
    path: serviceConfigPath,
    expectedUid: 0,
    exactMode: 0o644,
    minimumBytes: configArtifact.byteLength as number,
    maximumBytes: configArtifact.byteLength as number,
    label: "provider installation service config",
  });
  try {
    if (sha256DigestV1(configBytes) !== configArtifact.contentDigest) {
      return productionFailV1("provider installation service config is invalid");
    }
  } finally {
    configBytes.fill(0);
  }
  return Object.freeze({
    installationRoot,
    serviceConfigPath,
    trustSnapshotPath: productionTrustSnapshotPathV1(installationRoot),
    manifestPayload: payload,
  });
}

function verifySnapshotSignatureV1(
  snapshot: Record<string, unknown>,
  serviceConfig: ProviderServiceHandoffConfigV1,
): Record<string, unknown> {
  if (
    !exactKeysV1(snapshot, [
      "schemaVersion",
      "profile",
      "payload",
      "payloadDigest",
      "signature",
    ]) ||
    snapshot.schemaVersion !== 1 ||
    snapshot.profile !== PRODUCTION_TRUST_SNAPSHOT_PROFILE_V1
  ) return productionFailV1("production trust snapshot is invalid");
  const payload = dataRecordV1(
    snapshot.payload,
    "production trust snapshot payload",
  );
  const canonical = canonicalizeJcsSafeIntegerV1(payload);
  if (snapshot.payloadDigest !== sha256DigestV1(Buffer.from(canonical, "utf8"))) {
    return productionFailV1("production trust snapshot digest is invalid");
  }
  const signature = typeof snapshot.signature === "string"
    ? decodeExactSignatureV1(snapshot.signature)
    : undefined;
  const publicKey = exactEd25519PublicKeyV1(serviceConfig.publicKey);
  if (
    signature === undefined ||
    !verify(null, Buffer.from(canonical, "utf8"), publicKey.key, signature)
  ) return productionFailV1("production trust snapshot signature is invalid");
  return payload;
}

function validateAcceptanceHistoryV1(
  value: unknown,
  currentValue: unknown,
) {
  if (
    !Array.isArray(value) || value.length < 1 ||
    value.length > MAX_PRODUCTION_ACCEPTANCE_HISTORY_GENERATIONS_V1
  ) {
    return productionFailV1("production Acceptance history is invalid");
  }
  const history: Array<Readonly<{
    envelope: ReturnType<
      typeof ProviderAcceptanceStateEnvelopeV1Schema.parse
    >;
    pin: ReturnType<
      typeof ProviderAcceptanceGenerationPinV1Schema.parse
    >;
  }>> = [];
  let acceptanceCanonicalBytes = 0;
  for (const [index, candidate] of value.entries()) {
    const canonicalBytes = acceptanceEnvelopeCanonicalBytesV1(candidate);
    if (
      acceptanceCanonicalBytes >
        MAX_PRODUCTION_TOTAL_TRUST_HISTORY_LOGICAL_BYTES_V1 - canonicalBytes
    ) {
      return productionFailV1(
        "production retained trust history exceeds the logical byte budget",
      );
    }
    acceptanceCanonicalBytes += canonicalBytes;
    const envelope =
      ProviderAcceptanceStateEnvelopeV1Schema.parse(
        candidate,
      );
    const previous = history[index - 1]?.envelope;
    if (
      envelope.generationId !== envelope.payload.generationId ||
      envelope.installationIdentityGenerationId !==
        envelope.payload.installationIdentityGenerationId ||
      envelope.acceptedAt !== envelope.payload.acceptedAt ||
      envelope.generationId !==
        deriveProviderAcceptanceStateGenerationIdV1({
          installationIdentityGenerationId:
            envelope.installationIdentityGenerationId,
          acceptanceOrdinal: envelope.payload.acceptanceOrdinal,
          predecessor: envelope.payload.predecessor,
          configuration: envelope.payload.configuration,
        }) ||
      envelope.contentDigest !==
        deriveProviderAcceptanceStateContentDigestV1(
          envelope.payload,
        ) ||
      (index === 0 &&
        (envelope.payload.acceptanceOrdinal !== 1 ||
          envelope.payload.predecessor.state !== "genesis")) ||
      (previous !== undefined &&
        (envelope.payload.acceptanceOrdinal !==
            previous.payload.acceptanceOrdinal + 1 ||
          envelope.installationIdentityGenerationId !==
            previous.installationIdentityGenerationId ||
          envelope.acceptedAt <= previous.acceptedAt ||
          !exactCanonicalEqualV1(envelope.payload.predecessor, {
            state: "acceptance",
            generationId: previous.generationId,
            contentDigest: previous.contentDigest,
          })))
    ) return productionFailV1("production Acceptance history is invalid");
    history.push(Object.freeze({
      envelope,
      pin: ProviderAcceptanceGenerationPinV1Schema.parse({
        locatorProfile: "installation_provider_acceptance_state_v1",
        acceptanceOrdinal: envelope.payload.acceptanceOrdinal,
        generationId: envelope.generationId,
        contentDigest: envelope.contentDigest,
      }),
    }));
  }
  const current = dataRecordV1(currentValue, "production current Acceptance");
  if (
    !exactKeysV1(current, [
      "generationId",
      "contentDigest",
      "acceptanceOrdinal",
      "installationIdentityGenerationId",
    ])
  ) return productionFailV1("production current Acceptance is invalid");
  const tip = history.at(-1)!;
  if (
    current.generationId !== tip.envelope.generationId ||
    current.contentDigest !== tip.envelope.contentDigest ||
    current.acceptanceOrdinal !== tip.envelope.payload.acceptanceOrdinal ||
    current.installationIdentityGenerationId !==
      tip.envelope.installationIdentityGenerationId
  ) return productionFailV1("production current Acceptance is invalid");
  return Object.freeze({
    history: Object.freeze(history),
    tip,
    acceptanceCanonicalBytes,
  });
}

function acceptanceEnvelopeCanonicalBytesV1(value: unknown): number {
  let canonical: string;
  try {
    canonical = canonicalizeJcsSafeIntegerV1(value);
  } catch {
    return productionFailV1("production Acceptance history is invalid");
  }
  const bytes = Buffer.byteLength(canonical, "utf8");
  if (
    !Number.isSafeInteger(bytes) || bytes < 1 ||
    bytes > MAX_PRODUCTION_SINGLE_TRUST_ENVELOPE_LOGICAL_BYTES_V1
  ) {
    return productionFailV1(
      "production Acceptance envelope exceeds the logical byte budget",
    );
  }
  return bytes;
}

function validateRetainedTrustLogicalBytesV1(
  registryCanonicalBytes: number,
  acceptanceCanonicalBytes: number,
): void {
  if (
    !Number.isSafeInteger(registryCanonicalBytes) ||
    registryCanonicalBytes < 0 ||
    !Number.isSafeInteger(acceptanceCanonicalBytes) ||
    acceptanceCanonicalBytes < 0 ||
    registryCanonicalBytes >
      MAX_PRODUCTION_TOTAL_TRUST_HISTORY_LOGICAL_BYTES_V1 ||
    acceptanceCanonicalBytes >
      MAX_PRODUCTION_TOTAL_TRUST_HISTORY_LOGICAL_BYTES_V1 -
        registryCanonicalBytes
  ) {
    return productionFailV1(
      "production retained trust history exceeds the logical byte budget",
    );
  }
}

/** Internal focused-test seam for the signed, retained Acceptance chain. */
export function providerProductionStrongAcceptanceHistoryInternalV1(
  input: Readonly<{ history: unknown; current: unknown }>,
): Readonly<{ generationIds: readonly string[]; tipGenerationId: string }> {
  const validated = validateAcceptanceHistoryV1(input.history, input.current);
  return Object.freeze({
    generationIds: Object.freeze(
      validated.history.map((candidate) => candidate.envelope.generationId),
    ),
    tipGenerationId: validated.tip.envelope.generationId,
  });
}

/** Internal focused-test seam over the exact production canonical meter. */
export function providerProductionStrongAcceptanceCanonicalBytesInternalV1(
  value: unknown,
): number {
  return acceptanceEnvelopeCanonicalBytesV1(value);
}

/** Internal focused-test seam over the cross-history Installation budget. */
export function providerProductionStrongRetainedTrustBudgetInternalV1(
  input: Readonly<{
    registryCanonicalBytes: number;
    acceptanceCanonicalBytes: number;
  }>,
): true {
  validateRetainedTrustLogicalBytesV1(
    input.registryCanonicalBytes,
    input.acceptanceCanonicalBytes,
  );
  return true;
}

/** Internal focused-test seam for the frozen retained-history/file ceilings. */
export function providerProductionStrongAcceptanceLimitsInternalV1() {
  return Object.freeze({
    maxAcceptanceHistoryGenerations:
      MAX_PRODUCTION_ACCEPTANCE_HISTORY_GENERATIONS_V1,
    maxTotalTrustHistoryLogicalBytes:
      MAX_PRODUCTION_TOTAL_TRUST_HISTORY_LOGICAL_BYTES_V1,
    maxSingleTrustEnvelopeLogicalBytes:
      MAX_PRODUCTION_SINGLE_TRUST_ENVELOPE_LOGICAL_BYTES_V1,
    maxTrustSnapshotBytes: MAX_PRODUCTION_TRUST_SNAPSHOT_BYTES_V1,
  });
}

async function verifyProductionSelectionV1(
  input: OpenProviderProductionStrongObjectClientV1Input,
): Promise<ProductionSelectionV1> {
  const installation = await readProductionInstallationSelectionV1(
    input.canonicalInstallationRoot,
  );
  const serviceConfigPath = installation.serviceConfigPath;
  const serviceConfig = verifyProviderServiceHandoffConfigV1(
    await readRootJsonV1(serviceConfigPath, "service config"),
  );
  if (
    process.platform !== "linux" || serviceConfig.payload.platform !== "linux" ||
    serviceConfig.payload.configPath !== serviceConfigPath ||
    installation.manifestPayload.handoffPayloadDigest !==
      serviceConfig.payloadDigest ||
    installation.manifestPayload.servicePublicKey !== serviceConfig.publicKey ||
    installation.manifestPayload.runtimeRoot !== serviceConfig.payload.runtimeRoot ||
    installation.manifestPayload.providerId !== serviceConfig.payload.providerId ||
    installation.manifestPayload.capabilityDigest !==
      serviceConfig.payload.capabilityDigest ||
    !exactCanonicalEqualV1(
      installation.manifestPayload.principal,
      serviceConfig.payload.principal,
    )
  ) return productionFailV1("service config selector is invalid");
  const snapshot = dataRecordV1(
    await readRootJsonV1(
      installation.trustSnapshotPath,
      "production trust snapshot",
    ),
    "production trust snapshot",
  );
  const trustSnapshotDigest = sha256DigestV1(Buffer.from(
    canonicalizeJcsSafeIntegerV1(snapshot),
    "utf8",
  ));
  const payload = verifySnapshotSignatureV1(snapshot, serviceConfig);
  if (
    !exactKeysV1(payload, [
      "serviceConfig",
      "canonicalTargetRoot",
      "targetProfileId",
      "targetFingerprintDigest",
      "acceptanceHistory",
      "currentAcceptance",
      "registryHistory",
      "grantKeyPath",
      "callerPrincipal",
    ]) ||
    !exactCanonicalEqualV1(payload.serviceConfig, serviceConfig)
  ) return productionFailV1("production trust snapshot binding is invalid");
  const canonicalTargetRoot = exactAbsolutePathV1(
    payload.canonicalTargetRoot,
    "canonical target root",
  );
  const grantKeyPath = exactAbsolutePathV1(
    payload.grantKeyPath,
    "strong mutation grant key path",
  );
  const callerPrincipal = kernelPrincipalV1(
    payload.callerPrincipal,
    "production strong client caller principal",
  );
  if (
    callerPrincipal.uid === 0 ||
    callerPrincipal.uid === serviceConfig.payload.principal.uid
  ) return productionFailV1("production strong client caller principal is invalid");
  const targetProfileId = ProviderTargetProfileIdV1Schema.parse(
    payload.targetProfileId,
  );
  const targetFingerprintDigest = ContentDigestV1Schema.parse(
    payload.targetFingerprintDigest,
  );
  const acceptance = validateAcceptanceHistoryV1(
    payload.acceptanceHistory,
    payload.currentAcceptance,
  );
  const acceptanceEnvelope = acceptance.tip.envelope;
  const readiness = await readProviderServiceReadinessV1({
    config: serviceConfig,
    readinessPath: serviceConfig.payload.readinessPath,
  });
  if (
    readiness.status !== "signed_candidate" ||
    readiness.providerId !== serviceConfig.payload.providerId ||
    readiness.principalUid !== serviceConfig.payload.principal.uid ||
    readiness.targetFingerprintDigest !== targetFingerprintDigest
  ) return productionFailV1("production runtime readiness is unavailable");
  const registryHistory = dataRecordV1(
    payload.registryHistory,
    "production Registry history",
  );
  const registryClosure = await validateProviderRegistryManifestHistoryV1({
    ...registryHistory,
    strictCryptoCapability: await strictCryptoCapabilityV1(),
  });
  validateRetainedTrustLogicalBytesV1(
    registryClosure.retainedTrustHistoryCanonicalBytes,
    acceptance.acceptanceCanonicalBytes,
  );
  const acceptanceConfiguration = acceptanceEnvelope.payload.configuration;
  if (
    acceptanceConfiguration.state !== "strong_ready" ||
    acceptanceConfiguration.activation.origin !==
      "completed_provider_migration"
  ) {
    return productionFailV1(
      "production current Acceptance is not completed strong-ready",
    );
  }
  const core = acceptanceConfiguration.core;
  if (
    registryClosure.authority !== "none_registry_structure_and_history_only" ||
    registryClosure.installationIdentityGenerationId !==
      acceptanceEnvelope.installationIdentityGenerationId ||
    !exactCanonicalEqualV1(
      registryClosure.currentRootMetadata,
      core.activeRootMetadata,
    ) ||
    !exactCanonicalEqualV1(
      registryClosure.currentRegistryManifest,
      core.providerRegistryManifest,
    )
  ) return productionFailV1("production Registry binding is invalid");
  const selections = core.activeWriterSelector.selections.filter(
    (candidate) =>
      candidate.targetProfileId === targetProfileId &&
      candidate.providerId === serviceConfig.payload.providerId,
  );
  if (selections.length !== 1) {
    return productionFailV1("production active writer is unavailable");
  }
  const manifest = registryClosure.registryManifestHistory.at(-1);
  const member = manifest?.payload.members.find(
    (candidate) => candidate.providerId === serviceConfig.payload.providerId,
  );
  const selection = selections[0]!;
  if (
    manifest === undefined || member === undefined ||
    member.disposition !== "enabled" ||
    member.registryEntryContentDigest !== selection.registryEntryContentDigest ||
    deriveStoreDurableObjectProviderRegistryEntryContentDigestV1(
      member.registryEntry,
    ) !== selection.registryEntryContentDigest ||
    member.registryEntry.semanticProviderPolicyDigest !==
      selection.semanticProviderPolicyDigest ||
    !exactCanonicalEqualV1(
      member.registryEntry.providerFeasibilityEvidence,
      selection.providerFeasibilityEvidence,
    ) ||
    member.registryEntry.runtimeAttestation.contentDigest !==
      selection.runtimeAttestationContentDigest ||
    member.registryEntry.verificationKeys
      .activeBindingDerivationKeyGeneration !==
      selection.bindingDerivationKeyGeneration
  ) return productionFailV1("production active writer is invalid");
  const keys = member.registryEntry.verificationKeys;
  const signerKeyId = keys.activeKeyIds.strongMutationAuthorityGrant;
  const records = keys.publicKeyRecords.filter((record) =>
    record.providerId === serviceConfig.payload.providerId &&
    record.usage === "strong_mutation_authority_grant" &&
    record.algorithm === "ed25519" && record.keyId === signerKeyId
  );
  if (
    signerKeyId === undefined ||
    keys.compromisedRevokedKeyIds.includes(signerKeyId) || records.length !== 1
  ) return productionFailV1("production grant key is unavailable");
  const custody = serviceConfig.payload.installationIdentityCustody;
  const retainedState = dataRecordV1(
    installation.manifestPayload.retainedState,
    "provider installation retained state",
  );
  if (
    custody === undefined ||
    !exactKeysV1(retainedState, [
      "runtimeRoot",
      "installationIdentityKeyPath",
    ]) ||
    retainedState.runtimeRoot !== serviceConfig.payload.runtimeRoot ||
    retainedState.installationIdentityKeyPath !== custody.keyPath ||
    installation.manifestPayload.installationIdentityDigest !==
      serviceConfig.payload.installationIdentityDigest
  ) return productionFailV1("production Installation Identity is unavailable");
  return Object.freeze({
    canonicalInstallationRoot: installation.installationRoot,
    serviceConfig,
    canonicalTargetRoot,
    targetProfileId,
    targetFingerprintDigest,
    acceptanceIdentity:
      ProviderRuntimeIpcAcceptanceIdentityProofV1Schema.parse({
        generationId: acceptanceEnvelope.generationId,
        contentDigest: acceptanceEnvelope.contentDigest,
        acceptanceOrdinal: acceptanceEnvelope.payload.acceptanceOrdinal,
        installationIdentityGenerationId:
          acceptanceEnvelope.installationIdentityGenerationId,
      }),
    acceptanceEnvelope,
    acceptancePin: acceptance.tip.pin,
    acceptanceHistory: acceptance.history,
    signerKeyId,
    signerPublicKeyBytes: CanonicalPublicKeyBytes32V1Schema.parse(
      records[0]!.publicKeyBytes,
    ),
    registryManifest: core.providerRegistryManifest,
    grantKeyPath,
    installationIdentityKeyPath: exactAbsolutePathV1(
      custody.keyPath,
      "Installation Identity key path",
    ),
    installationIdentityKeyDigest: ContentDigestV1Schema.parse(
      serviceConfig.payload.installationIdentityDigest,
    ),
    installationIdentityKeyCheck: Object.freeze({
      generationId: custody.installationIdentityGenerationId,
      initializationNonce: custody.initializationNonce,
      token: KeyedStateTokenV1Schema.parse(custody.keyCheckToken),
    }),
    callerPrincipal,
    gatewaySocketPath: exactAbsolutePathV1(
      providerProductionStrongClientGatewaySocketPathV1(
        installation.installationRoot,
      ),
      "production strong object gateway socket path",
    ),
    trustSnapshotDigest,
  });
}

async function readRuntimeAuthKeyV1(
  serviceConfig: ProviderServiceHandoffConfigV1,
): Promise<Uint8Array> {
  const uid = typeof process.geteuid === "function"
    ? process.geteuid()
    : process.getuid!();
  if (uid !== 0 && uid !== serviceConfig.payload.principal.uid) {
    return productionFailV1("runtime read authority is unavailable");
  }
  return new Uint8Array(await readStableFileV1({
    path: serviceConfig.payload.authKeyPath,
    expectedUid: serviceConfig.payload.principal.uid,
    expectedGid: serviceConfig.payload.principal.gid,
    exactMode: 0o600,
    minimumBytes: 32,
    maximumBytes: 32,
    label: "runtime auth key",
  }));
}

async function readGrantKeyV1(
  pathInput: string,
  principal: Readonly<{ readonly uid: number; readonly gid: number }>,
): Promise<Uint8Array> {
  return new Uint8Array(await readStableFileV1({
    path: pathInput,
    expectedUid: principal.uid,
    expectedGid: principal.gid,
    exactMode: 0o600,
    minimumBytes: 32,
    maximumBytes: MAX_GRANT_KEY_BYTES_V1,
    label: "strong mutation grant key",
  }));
}

function exactTokenEqualV1(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, "utf8");
  const rightBytes = Buffer.from(right, "utf8");
  return leftBytes.byteLength === rightBytes.byteLength &&
    timingSafeEqual(leftBytes, rightBytes);
}

async function readInstallationIdentityKeyV1(
  selection: ProductionSelectionV1,
): Promise<Uint8Array> {
  const key = new Uint8Array(await readStableFileV1({
    path: selection.installationIdentityKeyPath,
    expectedUid: selection.serviceConfig.payload.principal.uid,
    expectedGid: selection.serviceConfig.payload.principal.gid,
    exactMode: 0o600,
    minimumBytes: 32,
    maximumBytes: 32,
    label: "Installation Identity key",
  }));
  const check = selection.installationIdentityKeyCheck;
  const expectedCheck = KeyedStateTokenV1Schema.parse(
    `hmac-sha256:${createHmac("sha256", key).update(Buffer.from(
      canonicalizeJcsSafeIntegerV1([
        "installation-identity-key-check-v1",
        {
          generationId: check.generationId,
          initializationNonce: check.initializationNonce,
        },
      ]),
      "utf8",
    )).digest("hex")}`,
  );
  if (
    sha256DigestV1(key) !== selection.installationIdentityKeyDigest ||
    !exactTokenEqualV1(expectedCheck, check.token)
  ) {
    key.fill(0);
    return productionFailV1("Installation Identity key is invalid");
  }
  return key;
}

function validateOwnerCommitmentInputV1(
  domain: string,
  canonicalValue: string,
): Buffer {
  if (![
    "record-verification-full-input-v1",
    "verification-detail-semantic-v1",
    "repository-index-state-v1",
    "repository-worktree-state-v1",
    "repository-untracked-state-v1",
    "repository-ignore-state-v1",
    "repository-state-semantic-v1",
  ].includes(domain)) {
    return productionFailV1("owner-only commitment domain is invalid");
  }
  if (
    typeof canonicalValue !== "string" ||
    Buffer.byteLength(canonicalValue, "utf8") > 16 * 1024 * 1024
  ) return productionFailV1("owner-only commitment value is invalid");
  const bytes = Buffer.from(canonicalValue, "utf8");
  let parsed: unknown;
  try {
    parsed = parseCanonicalJcsSafeIntegerUtf8V1(bytes);
  } catch (error) {
    return productionFailV1("owner-only commitment value is invalid", error);
  }
  if (
    !Array.isArray(parsed) || parsed.length !== 2 || parsed[0] !== domain ||
    canonicalizeJcsSafeIntegerV1(parsed) !== canonicalValue
  ) return productionFailV1("owner-only commitment binding is invalid");
  return bytes;
}

function productionStateV1(
  client: object,
): ProductionClientStateV1 {
  const state = productionClientStatesV1.get(client);
  if (state === undefined) return productionFailV1("strong object client is closed");
  return state;
}

async function strongExchangeV1(
  state: ProductionClientStateV1,
  requestInput:
    | ProviderRuntimeIpcStrongMutationRequestClaimsV1
    | ((trusted: ReturnType<typeof validateTrustedProductionStateV1>) =>
        ProviderRuntimeIpcStrongMutationRequestClaimsV1),
): Promise<StrongMutationSuccessPayloadInternalV1> {
  const trusted = await inspectTrustedProductionStateV1(state);
  const request = typeof requestInput === "function"
    ? requestInput(trusted)
    : requestInput;
  return exchangeProviderRuntimeStrongMutationSameSocketInternalV1({
    socketPath: state.selection.serviceConfig.payload.socketPath,
    timeoutMs: state.timeoutMs,
    expectedPrincipal: {
      providerId: state.selection.serviceConfig.payload.providerId,
      capabilityDigest: state.selection.serviceConfig.payload.capabilityDigest,
      handoffPayloadDigest: state.selection.serviceConfig.payloadDigest,
      servicePublicKey: CanonicalByteStringV1Schema.parse(
        state.selection.serviceConfig.publicKey,
      ),
      journalHead: {
        revision: trusted.inspected.state.revision,
        phase: trusted.inspected.state.phase,
        mutationDigest: trusted.inspected.state.mutationDigest,
      },
      acceptanceIdentity: state.selection.acceptanceIdentity,
    },
    grantStaticFields: {
      signerKeyId: state.selection.signerKeyId,
      targetProfileId: state.selection.targetProfileId,
      targetFingerprintDigest: state.selection.targetFingerprintDigest,
      registryManifest: state.selection.registryManifest,
    },
    request,
    async mintSigner(grantFields) {
      return mintProviderRuntimeStrongMutationAuthorityGrantSignerCapabilityInternalV1({
        privateKeyPkcs8: new Uint8Array(state.grantKey),
        expectedPublicKeyBytes: state.selection.signerPublicKeyBytes,
        grantFields,
      });
    },
  });
}

function validateTrustedProductionStateV1(
  inspectedInput: unknown,
  binding: Readonly<{
    acceptanceEnvelope: ProductionSelectionV1["acceptanceEnvelope"];
    acceptancePin: ProductionSelectionV1["acceptancePin"];
  }>,
): Readonly<{
  inspected: ProviderRuntimeIpcInspectStateResultV1;
  lifecycleArtifacts:
    ProviderRuntimeDurableLifecycleProjectionV1["lifecycleArtifacts"];
  businessHead?: ProductionStrongBusinessHeadInternalV1;
}> {
  const inspected = ProviderRuntimeIpcInspectStateResultV1Schema.parse(
    inspectedInput,
  );
  let projected: ProviderRuntimeDurableLifecycleProjectionV1;
  try {
    projected = projectProviderRuntimeDurableLifecycleArtifactsV1({
      journalState: inspected.state,
      expectedAcceptanceEnvelope: binding.acceptanceEnvelope,
      expectedAcceptancePin: binding.acceptancePin,
    });
  } catch {
    return productionFailV1("runtime current Acceptance binding is invalid");
  }
  const businessHead = projected.businessHead === undefined
    ? undefined
    : projected.businessHead as unknown as
      ProductionStrongBusinessHeadInternalV1;
  if (businessHead !== undefined) {
    const projection = projectProductionStrongBusinessArtifactsV1(
      businessHead.artifacts,
    );
    assertProductionStrongIndexPublicationRevisionV1(
      projection.authority,
      inspected.state.revision,
    );
  }
  return Object.freeze({
    inspected,
    lifecycleArtifacts: projected.lifecycleArtifacts,
    ...(businessHead === undefined
      ? {}
      : { businessHead }),
  });
}

function validateTrustedProductionReplayStateV1(
  inspectedInput: unknown,
  selection: ProductionSelectionV1,
): ReturnType<typeof validateTrustedProductionStateV1> {
  // Equivalent formal successors may all bridge to the same immutable
  // lifecycle basis. The signed trust snapshot already identifies one exact
  // current Acceptance, so prefer it and retain uniqueness only for fallback
  // to an older, semantically different replay basis.
  try {
    return validateTrustedProductionStateV1(inspectedInput, {
      acceptanceEnvelope: selection.acceptanceEnvelope,
      acceptancePin: selection.acceptancePin,
    });
  } catch {
    // Fall through to retained-history replay.
  }
  const matches = selection.acceptanceHistory.flatMap((candidate) => {
    if (
      candidate.envelope.generationId ===
        selection.acceptanceEnvelope.generationId &&
      candidate.envelope.contentDigest ===
        selection.acceptanceEnvelope.contentDigest
    ) return [];
    try {
      return [validateTrustedProductionStateV1(inspectedInput, {
        acceptanceEnvelope: candidate.envelope,
        acceptancePin: candidate.pin,
      })];
    } catch {
      return [];
    }
  });
  if (matches.length !== 1) {
    return productionFailV1(
      "replayed runtime Acceptance binding is not retained exactly once",
    );
  }
  return matches[0]!;
}

/** Internal focused-test seam; only the revision crosses the public boundary. */
export function providerProductionStrongJournalRevisionInternalV1(
  input: Readonly<{
    inspected: unknown;
    acceptanceEnvelope: unknown;
    acceptancePin: unknown;
  }>,
): Readonly<{ revision: number }> {
  const trusted = validateTrustedProductionStateV1(input.inspected, {
    acceptanceEnvelope:
      ProviderAcceptanceStateEnvelopeV1Schema.parse(
        input.acceptanceEnvelope,
      ),
    acceptancePin:
      ProviderAcceptanceGenerationPinV1Schema.parse(
        input.acceptancePin,
      ),
  });
  return Object.freeze({ revision: trusted.inspected.state.revision });
}

async function inspectTrustedProductionStateV1(
  state: ProductionClientStateV1,
): Promise<ReturnType<typeof validateTrustedProductionStateV1>> {
  return validateTrustedProductionReplayStateV1(
    await state.runtimeClient.inspectState(),
    state.selection,
  );
}

function projectTrustedProductionBusinessHeadV1(
  trusted: ReturnType<typeof validateTrustedProductionStateV1>,
): ProviderRuntimeIpcJournalStateV1 {
  const businessHead = trusted.businessHead;
  const artifacts = businessHead === undefined
    ? {}
    : projectProductionStrongBusinessArtifactsV1(
        businessHead.artifacts,
      ).publicArtifacts;
  return {
    profile: trusted.inspected.state.profile,
    revision: trusted.inspected.state.revision,
    phase: businessHead?.phase ??
      PRODUCTION_STRONG_BUSINESS_UNINITIALIZED_PHASE_V1,
    operationNonce: businessHead === undefined
      ? "none"
      : trusted.inspected.state.operationNonce,
    mutationDigest: businessHead === undefined
      ? "none"
      : trusted.inspected.state.mutationDigest,
    artifacts,
  };
}

type ProductionStrongCompareClaimsInternalV1 = Extract<
  ProviderRuntimeIpcStrongMutationRequestClaimsV1,
  { readonly operation: "compare_commit" }
>;

function parseProductionStrongBusinessCompareV1(
  input: ProviderProductionStrongCompareCommitV1Input,
): ProductionStrongCompareClaimsInternalV1 {
  const inputRecord = dataRecordV1(input, "strong compare input");
  if (
    !exactKeysV1(inputRecord, [
      "expectedRevision",
      "operationNonce",
      "phase",
      "artifacts",
    ])
  ) return productionFailV1("strong compare input is invalid");
  const request = ProviderRuntimeIpcStrongMutationRequestClaimsV1Schema.parse({
    operation: "compare_commit",
    operationNonce: input.operationNonce,
    payload: {
      expectedRevision: input.expectedRevision,
      operationNonce: input.operationNonce,
      phase: input.phase,
      artifacts: input.artifacts,
    },
  });
  if (request.operation !== "compare_commit") {
    return productionFailV1("strong compare request is invalid");
  }
  if (
    request.payload.phase === PRODUCTION_STRONG_RUNTIME_PHASE_V1 ||
    Object.prototype.hasOwnProperty.call(
      request.payload.artifacts,
      "finalStrongReadyAcceptance",
    ) ||
    Object.prototype.hasOwnProperty.call(
      request.payload.artifacts,
      PROVIDER_RUNTIME_DURABLE_BUSINESS_HEAD_ARTIFACT_KEY_V1,
    ) ||
    Object.prototype.hasOwnProperty.call(
      request.payload.artifacts,
      PRODUCTION_STRONG_INDEX_PUBLICATION_AUTHORITY_ARTIFACT_KEY_V1,
    )
  ) return productionFailV1("strong compare reserved authority is invalid");
  return request;
}

export function providerProductionStrongBusinessCompareInputInternalV1(
  input: unknown,
): ProviderProductionStrongCompareCommitV1Input {
  const business = parseProductionStrongBusinessCompareV1(
    input as ProviderProductionStrongCompareCommitV1Input,
  );
  return Object.freeze({
    expectedRevision: business.payload.expectedRevision,
    operationNonce: business.operationNonce,
    phase: business.payload.phase,
    artifacts: business.payload.artifacts,
  });
}

function parseProductionStrongIndexPublicationCompareV1(
  input: ProviderProductionStrongCompareCommitIndexPublicationV1Input,
): Readonly<{
  business: ProductionStrongCompareClaimsInternalV1;
  authority: ProviderProductionStrongIndexPublicationAuthorityV1;
}> {
  const inputRecord = dataRecordV1(
    input,
    "strong index publication compare input",
  );
  if (
    !exactKeysV1(inputRecord, [
      "expectedRevision",
      "operationNonce",
      "phase",
      "artifacts",
      "authority",
    ])
  ) {
    return productionFailV1(
      "strong index publication compare input is invalid",
    );
  }
  const business = parseProductionStrongBusinessCompareV1({
    expectedRevision: input.expectedRevision,
    operationNonce: input.operationNonce,
    phase: input.phase,
    artifacts: input.artifacts,
  });
  const authority = parseProductionStrongIndexPublicationAuthorityInputV1(
    input.authority,
    business.payload.expectedRevision + 1,
  );
  return Object.freeze({ business, authority });
}

export function providerProductionStrongIndexPublicationCompareInputInternalV1(
  input: unknown,
): ProviderProductionStrongCompareCommitIndexPublicationV1Input {
  const { business, authority } =
    parseProductionStrongIndexPublicationCompareV1(
      input as ProviderProductionStrongCompareCommitIndexPublicationV1Input,
    );
  return Object.freeze({
    expectedRevision: business.payload.expectedRevision,
    operationNonce: business.operationNonce,
    phase: business.payload.phase,
    artifacts: business.payload.artifacts,
    authority: Object.freeze({
      profile: authority.profile,
      generationId: authority.generationId,
      generationManifestDigest: authority.generationManifestDigest,
      sourceInventoryDigest: authority.sourceInventoryDigest,
      sourceSnapshotId: authority.sourceSnapshotId,
    }),
  });
}

function createProductionStrongRuntimeCompareV1(
  trusted: ReturnType<typeof validateTrustedProductionStateV1>,
  business: ProductionStrongCompareClaimsInternalV1,
  replacementAuthority?: ProviderProductionStrongIndexPublicationAuthorityV1,
): ProductionStrongCompareClaimsInternalV1 {
  const durableBusinessArtifacts =
    createProductionStrongDurableBusinessArtifactsV1(
      trusted.businessHead?.artifacts,
      business.payload.artifacts,
      replacementAuthority,
    );
  const request = ProviderRuntimeIpcStrongMutationRequestClaimsV1Schema.parse({
    operation: "compare_commit",
    operationNonce: business.operationNonce,
    payload: {
      expectedRevision: business.payload.expectedRevision,
      operationNonce: business.operationNonce,
      phase: PRODUCTION_STRONG_RUNTIME_PHASE_V1,
      artifacts: {
        ...trusted.lifecycleArtifacts,
        [PROVIDER_RUNTIME_DURABLE_BUSINESS_HEAD_ARTIFACT_KEY_V1]: {
          profile: PROVIDER_RUNTIME_DURABLE_BUSINESS_HEAD_PROFILE_V1,
          phase: business.payload.phase,
          artifacts: durableBusinessArtifacts,
        },
      },
    },
  });
  if (request.operation !== "compare_commit") {
    return productionFailV1("strong compare request is invalid");
  }
  return request;
}

function projectProductionStrongCompareResultV1(
  resultInput: unknown,
  business: ProductionStrongCompareClaimsInternalV1,
  runtimeRequest: ProductionStrongCompareClaimsInternalV1,
  selection: ProductionSelectionV1,
): ProviderRuntimeIpcCompareCommitResultV1 {
  const result = ProviderRuntimeIpcCompareCommitResultV1Schema.parse(resultInput);
  const replayObservation = {
    operation: "inspect_state" as const,
    state: result.state,
  };
  const trusted = validateTrustedProductionReplayStateV1(
    replayObservation,
    selection,
  );
  if (result.resolution === "stale") {
    const businessHead = trusted.businessHead;
    const artifacts = businessHead === undefined
      ? {}
      : projectProductionStrongBusinessArtifactsV1(
          businessHead.artifacts,
        ).publicArtifacts;
    return ProviderRuntimeIpcCompareCommitResultV1Schema.parse({
      operation: "compare_commit",
      resolution: "stale",
      state: {
        profile: trusted.inspected.state.profile,
        revision: trusted.inspected.state.revision,
        phase: businessHead?.phase ??
          PRODUCTION_STRONG_BUSINESS_UNINITIALIZED_PHASE_V1,
        operationNonce: businessHead === undefined
          ? "none"
          : trusted.inspected.state.operationNonce,
        mutationDigest: businessHead === undefined
          ? "none"
          : trusted.inspected.state.mutationDigest,
        artifacts,
      },
    });
  }
  if (
    result.state.revision !== runtimeRequest.payload.expectedRevision + 1 ||
    result.state.operationNonce !== runtimeRequest.operationNonce ||
    result.state.phase !== PRODUCTION_STRONG_RUNTIME_PHASE_V1 ||
    !exactCanonicalEqualV1(
      result.state.artifacts,
      runtimeRequest.payload.artifacts,
    )
  ) return productionFailV1("strong compare runtime projection is invalid");
  return ProviderRuntimeIpcCompareCommitResultV1Schema.parse({
    ...result,
    state: {
      ...result.state,
      phase: business.payload.phase,
      artifacts: business.payload.artifacts,
    },
  });
}

function projectTrustedProductionIndexPublicationAuthorityV1(
  trusted: ReturnType<typeof validateTrustedProductionStateV1>,
): ProviderProductionStrongIndexPublicationAuthorityV1 | undefined {
  const authority = trusted.businessHead === undefined
    ? undefined
    : projectProductionStrongBusinessArtifactsV1(
        trusted.businessHead.artifacts,
      ).authority;
  assertProductionStrongIndexPublicationRevisionV1(
    authority,
    trusted.inspected.state.revision,
  );
  return authority;
}

async function compareProductionStrongBusinessV1(
  state: ProductionClientStateV1,
  business: ProductionStrongCompareClaimsInternalV1,
  replacementAuthority?: ProviderProductionStrongIndexPublicationAuthorityV1,
): Promise<ProviderRuntimeIpcCompareCommitResultV1> {
  let runtimeRequest: ProductionStrongCompareClaimsInternalV1 | undefined;
  const result = await strongExchangeV1(
    state,
    (inspected) => {
      runtimeRequest = createProductionStrongRuntimeCompareV1(
        inspected,
        business,
        replacementAuthority,
      );
      return runtimeRequest;
    },
  );
  if (runtimeRequest === undefined) {
    return productionFailV1("strong compare runtime projection is unavailable");
  }
  return projectProductionStrongCompareResultV1(
    result,
    business,
    runtimeRequest,
    state.selection,
  );
}

/**
 * Opens the only public production strong-object boundary. Structural DTOs do
 * not unlock it: verified selection lives solely in a private WeakMap and is
 * derived from stable root-owned signed files plus strict Registry history.
 */
export async function openProviderProductionStrongObjectHostInternalV1(
  input: OpenProviderProductionStrongObjectClientV1Input,
): Promise<ProviderProductionStrongObjectHostInternalV1> {
  const selection = await verifyProductionSelectionV1(input);
  const timeoutMs = positiveTimeoutV1(undefined);
  // Admission reads the caller-owned key only after a live signed principal;
  // here we validate only the exact selector and runtime read authority.
  const authKey = await readRuntimeAuthKeyV1(selection.serviceConfig);
  let runtimeClient: DurableObjectProviderRuntimeClientV1;
  try {
    runtimeClient = createDurableObjectProviderRuntimeClientV1({
      socketPath: selection.serviceConfig.payload.socketPath,
      sharedSecret: authKey,
      verifiedSelection: {
        verification: "caller_verified_registry_selection_v1",
        providerId: selection.serviceConfig.payload.providerId,
        capabilityDigest: selection.serviceConfig.payload.capabilityDigest as
          `sha256:${string}`,
      },
      timeoutMs,
      transportRetryCount: 0,
    });
  } finally {
    authKey.fill(0);
  }
  const client = Object.freeze({
    verifiedProviderId: selection.serviceConfig.payload.providerId,
    verifiedInstallationRoot: selection.canonicalInstallationRoot,
    servicePrincipal: selection.serviceConfig.payload.principal,
    callerPrincipal: selection.callerPrincipal,
    gatewaySocketPath: selection.gatewaySocketPath,
    serviceConfigPayloadDigest: selection.serviceConfig.payloadDigest,
    trustSnapshotDigest: selection.trustSnapshotDigest,
    async inspectState() {
      const inspected = await inspectTrustedProductionStateV1(
        productionStateV1(client),
      );
      return { revision: inspected.inspected.state.revision };
    },
    async inspectBusinessHead() {
      return projectTrustedProductionBusinessHeadV1(
        await inspectTrustedProductionStateV1(productionStateV1(client)),
      );
    },
    async inspectIndexPublicationAuthority() {
      return projectTrustedProductionIndexPublicationAuthorityV1(
        await inspectTrustedProductionStateV1(productionStateV1(client)),
      );
    },
    async readExactObject(locatorInput: ProviderRuntimeIpcFixedObjectLocatorV1) {
      const state = productionStateV1(client);
      const locator = ProviderRuntimeIpcFixedObjectLocatorV1Schema.parse(
        locatorInput,
      );
      if (locator.providerId !== state.selection.serviceConfig.payload.providerId) {
        return productionFailV1("exact object provider binding is invalid");
      }
      const result = ProviderRuntimeIpcReadObjectResultV1Schema.parse(
        await state.runtimeClient.readObject(locator),
      );
      if (
        !exactCanonicalEqualV1(result.locator, locator) ||
        result.verifiedContentDigest !== locator.contentDigest
      ) return productionFailV1("exact object response is invalid");
      return result;
    },
    async writeExactObject(inputValue: ProviderProductionStrongWriteExactObjectV1Input) {
      const state = productionStateV1(client);
      const locator = ProviderRuntimeIpcFixedObjectLocatorV1Schema.parse(
        inputValue.locator,
      );
      const operationNonce = LowerHex32V1Schema.parse(inputValue.operationNonce);
      if (locator.providerId !== state.selection.serviceConfig.payload.providerId) {
        return productionFailV1("exact object provider binding is invalid");
      }
      const request = ProviderRuntimeIpcStrongMutationRequestClaimsV1Schema.parse({
        operation: "write_object",
        operationNonce,
        payload: {
          locator,
          logicalBytes: inputValue.logicalBytes,
          bytes: inputValue.bytes,
        },
      });
      return ProviderRuntimeIpcWriteObjectResultV1Schema.parse(
        await strongExchangeV1(state, request),
      );
    },
    async compareCommit(inputValue: ProviderProductionStrongCompareCommitV1Input) {
      const state = productionStateV1(client);
      const business = parseProductionStrongBusinessCompareV1(inputValue);
      return compareProductionStrongBusinessV1(state, business);
    },
    async compareCommitIndexPublication(
      inputValue: ProviderProductionStrongCompareCommitIndexPublicationV1Input,
    ) {
      const state = productionStateV1(client);
      const { business, authority } =
        parseProductionStrongIndexPublicationCompareV1(inputValue);
      return compareProductionStrongBusinessV1(
        state,
        business,
        authority,
      );
    },
    commitOwnerOnlyState(
      domain: ProviderProductionOwnerCommitmentDomainV1,
      canonicalValue: string,
    ) {
      const state = productionStateV1(client);
      const message = validateOwnerCommitmentInputV1(domain, canonicalValue);
      try {
        return KeyedStateTokenV1Schema.parse(
          `hmac-sha256:${createHmac("sha256", state.ownerCommitmentKey)
            .update(message).digest("hex")}`,
        );
      } finally {
        message.fill(0);
      }
    },
    close(): void {
      productionClientStatesV1.get(client)?.ownerCommitmentKey.fill(0);
      productionClientStatesV1.get(client)?.grantKey.fill(0);
      productionClientStatesV1.delete(client);
    },
  }) as ProviderProductionStrongObjectHostInternalV1;
  let ownerCommitmentKey: Uint8Array | undefined;
  let grantKey: Uint8Array | undefined;
  try {
    ownerCommitmentKey = await readInstallationIdentityKeyV1(selection);
    grantKey = await readGrantKeyV1(
      selection.grantKeyPath,
      selection.serviceConfig.payload.principal,
    );
  } catch (error) {
    ownerCommitmentKey?.fill(0);
    grantKey?.fill(0);
    throw error;
  }
  productionClientStatesV1.set(client, Object.freeze({
    selection,
    runtimeClient,
    grantKey,
    ownerCommitmentKey,
    timeoutMs,
  }));
  return client;
}
