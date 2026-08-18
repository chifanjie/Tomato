import {
  createHash,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  sign,
  verify,
  type KeyObject,
} from "node:crypto";
import {
  chown,
  chmod,
  lstat,
  mkdir,
  readFile,
  rm,
  rename,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, basename, resolve } from "node:path";

import { canonicalizeJcsSafeIntegerV1 } from "@understand-code/durable-object-provider-contracts/jcs";
import {
  CanonicalByteStringV1Schema,
  ContentDigestV1Schema,
  DurableObjectIdentityProviderIdV1Schema,
  InstallationIdentityGenerationIdV1Schema,
  KeyedStateTokenV1Schema,
  LowerHex32V1Schema,
  type ContentDigestV1,
  type DurableObjectIdentityProviderIdV1,
  type InstallationIdentityGenerationIdV1,
  type KeyedStateTokenV1,
  type LowerHex32V1,
} from "@understand-code/durable-object-provider-contracts/primitives";
import {
  mintProviderServiceInstallationIdentityVerificationCapabilityInternalV1,
} from "@understand-code/durable-object-provider-contracts/provider-service-installation-identity-custody-internal";

/**
 * The service handoff is an installation boundary, not a Provider Gate by
 * itself.  A signed descriptor can be prepared by the installer, but strong
 * writes stay locked until the service emits a principal-owned readiness
 * receipt and the remaining real-filesystem/attestation checks pass.
 */
export const PROVIDER_SERVICE_HANDOFF_PROFILE_V1 =
  "understand_code_provider_service_handoff_v1" as const;
export const PROVIDER_SERVICE_HANDOFF_PAYLOAD_PROFILE_V1 =
  "understand_code_provider_service_handoff_payload_v1" as const;
export const PROVIDER_SERVICE_READINESS_PROFILE_V1 =
  "understand_code_provider_service_readiness_v1" as const;

export type ProviderServicePlatformV1 = "darwin" | "linux";
export type ProviderServiceDescriptorFormatV1 =
  | "launchd_plist"
  | "systemd_unit";

export interface ProviderServicePrincipalV1 {
  readonly kind: "dedicated_os_principal";
  readonly name: string;
  readonly uid: number;
  readonly gid: number;
}

export interface ProviderServiceInstallationIdentityCustodyV1 {
  readonly keyPath: string;
  readonly initializationNonce: LowerHex32V1;
  readonly installationIdentityGenerationId:
    InstallationIdentityGenerationIdV1;
  readonly keyCheckToken: KeyedStateTokenV1;
}

export interface ProviderServiceHandoffPayloadV1 {
  readonly schemaVersion: 1;
  readonly profile: typeof PROVIDER_SERVICE_HANDOFF_PAYLOAD_PROFILE_V1;
  readonly platform: ProviderServicePlatformV1;
  readonly serviceLabel: string;
  readonly providerId: DurableObjectIdentityProviderIdV1;
  readonly principal: ProviderServicePrincipalV1;
  readonly runtimeRoot: string;
  readonly socketPath: string;
  readonly executablePath: string;
  readonly configPath: string;
  readonly authKeyPath: string;
  readonly readinessPath: string;
  readonly signingKeyPath: string;
  readonly installationIdentityCustody?:
    ProviderServiceInstallationIdentityCustodyV1;
  readonly installationIdentityDigest: ContentDigestV1;
  readonly binaryDigest: ContentDigestV1;
  readonly capabilityDigest: ContentDigestV1;
}

export interface ProviderServiceHandoffConfigV1 {
  readonly schemaVersion: 1;
  readonly profile: typeof PROVIDER_SERVICE_HANDOFF_PROFILE_V1;
  readonly payload: ProviderServiceHandoffPayloadV1;
  readonly payloadDigest: ContentDigestV1;
  /** Canonical base64url-encoded Ed25519 SubjectPublicKeyInfo bytes. */
  readonly publicKey: `base64url:${string}`;
  /** Canonical base64url-encoded Ed25519 signature over the payload. */
  readonly signature: `base64url:${string}`;
}

export interface ProviderServiceReadinessPayloadV1 {
  readonly schemaVersion: 1;
  readonly profile: typeof PROVIDER_SERVICE_READINESS_PROFILE_V1;
  readonly serviceLabel: string;
  readonly providerId: DurableObjectIdentityProviderIdV1;
  readonly installationIdentityDigest: ContentDigestV1;
  readonly runtimeRoot: string;
  readonly socketPath: string;
  readonly observedUid: number;
  readonly observedGid: number;
  readonly handoffPayloadDigest: ContentDigestV1;
  readonly targetFingerprintDigest: ContentDigestV1;
  readonly startedAt: string;
  readonly nonce: `base64url:${string}`;
  readonly status: "ready";
}

export interface ProviderServiceReadinessReceiptV1 {
  readonly schemaVersion: 1;
  readonly profile: typeof PROVIDER_SERVICE_READINESS_PROFILE_V1;
  readonly payload: ProviderServiceReadinessPayloadV1;
  readonly payloadDigest: ContentDigestV1;
  readonly publicKey: `base64url:${string}`;
  readonly signature: `base64url:${string}`;
}

export type ProviderServiceHandoffErrorCodeV1 =
  | "unsupported_platform"
  | "invalid_config"
  | "signature_invalid"
  | "identity_mismatch"
  | "non_root_provisioning_forbidden"
  | "descriptor_path_invalid"
  | "readiness_unavailable"
  | "readiness_invalid"
  | "principal_mismatch";

export class ProviderServiceHandoffErrorV1 extends Error {
  readonly code: ProviderServiceHandoffErrorCodeV1;

  constructor(code: ProviderServiceHandoffErrorCodeV1, message: string) {
    super(message);
    this.name = "ProviderServiceHandoffErrorV1";
    this.code = code;
  }
}

export interface ProviderServiceDescriptorV1 {
  readonly platform: ProviderServicePlatformV1;
  readonly format: ProviderServiceDescriptorFormatV1;
  readonly serviceLabel: string;
  readonly descriptor: string;
  readonly descriptorDigest: ContentDigestV1;
}

export interface ProviderServiceProvisionOptionsV1 {
  readonly config: ProviderServiceHandoffConfigV1;
  /** Ed25519 key held by the dedicated service for readiness receipts. */
  readonly privateKey: KeyObject;
  /** Exact raw key required when the signed payload delegates custody. */
  readonly installationIdentityKey?: Uint8Array;
  /** Override only for a privileged installer/test fixture. */
  readonly descriptorPath?: string;
  /** Override only for a privileged installer/test fixture. */
  readonly configPath?: string;
}

export interface ProviderServiceProvisionResultV1 {
  readonly status: "provisioned";
  readonly authority: "read_only";
  readonly strongWrites: "locked";
  readonly platform: ProviderServicePlatformV1;
  readonly descriptorPath: string;
  readonly configPath: string;
  readonly descriptorDigest: ContentDigestV1;
}

export type ProviderServiceReadinessResultV1 =
  | Readonly<{
      readonly status: "signed_candidate";
      readonly authority: "read_only";
      readonly strongWrites: "locked";
      readonly platform: ProviderServicePlatformV1;
      readonly serviceLabel: string;
      readonly providerId: DurableObjectIdentityProviderIdV1;
      readonly principalUid: number;
      readonly targetFingerprintDigest: ContentDigestV1;
    }>
  | Readonly<{
      readonly status: "unavailable";
      readonly authority: "read_only";
      readonly strongWrites: "locked";
      readonly platform: ProviderServicePlatformV1 | "unknown";
      readonly reason:
        | "unsupported_platform"
        | "service_not_provisioned"
        | "attestation_invalid"
        | "principal_mismatch";
    }>;

/** Safe, path-redacted projection consumed by Provider Doctor. */
export type ProviderServiceHandoffInspectionV1 = Readonly<{
  readonly status: "valid_unprovisioned" | "signed_candidate" | "unavailable";
  readonly authority: "read_only";
  readonly strongWrites: "locked";
  readonly platform: ProviderServicePlatformV1 | "unknown";
  readonly serviceLabel?: string;
  readonly providerId?: DurableObjectIdentityProviderIdV1;
  readonly principalUid?: number;
  readonly descriptorFormat?: ProviderServiceDescriptorFormatV1;
  readonly descriptorDigest?: ContentDigestV1;
  readonly readiness?: ProviderServiceReadinessResultV1;
  readonly reason?:
    | "unsupported_platform"
    | "invalid_config"
    | "signature_invalid"
    | "identity_mismatch"
    | "service_not_provisioned"
    | "attestation_invalid"
    | "principal_mismatch";
}>;

const SUPPORTED_PLATFORMS_V1: readonly ProviderServicePlatformV1[] = [
  "darwin",
  "linux",
];
const PAYLOAD_KEYS_V1 = [
  "schemaVersion",
  "profile",
  "platform",
  "serviceLabel",
  "providerId",
  "principal",
  "runtimeRoot",
  "socketPath",
  "executablePath",
  "configPath",
  "authKeyPath",
  "readinessPath",
  "signingKeyPath",
  "installationIdentityDigest",
  "binaryDigest",
  "capabilityDigest",
] as const;
const PAYLOAD_KEYS_WITH_CUSTODY_V1 = [
  "schemaVersion",
  "profile",
  "platform",
  "serviceLabel",
  "providerId",
  "principal",
  "runtimeRoot",
  "socketPath",
  "executablePath",
  "configPath",
  "authKeyPath",
  "readinessPath",
  "signingKeyPath",
  "installationIdentityCustody",
  "installationIdentityDigest",
  "binaryDigest",
  "capabilityDigest",
] as const;
const PRINCIPAL_KEYS_V1 = ["kind", "name", "uid", "gid"] as const;
const INSTALLATION_IDENTITY_CUSTODY_KEYS_V1 = [
  "keyPath",
  "initializationNonce",
  "installationIdentityGenerationId",
  "keyCheckToken",
] as const;
const CONFIG_KEYS_V1 = [
  "schemaVersion",
  "profile",
  "payload",
  "payloadDigest",
  "publicKey",
  "signature",
] as const;
const READINESS_PAYLOAD_KEYS_V1 = [
  "schemaVersion",
  "profile",
  "serviceLabel",
  "providerId",
  "installationIdentityDigest",
  "runtimeRoot",
  "socketPath",
  "observedUid",
  "observedGid",
  "handoffPayloadDigest",
  "targetFingerprintDigest",
  "startedAt",
  "nonce",
  "status",
] as const;
const READINESS_KEYS_V1 = [
  "schemaVersion",
  "profile",
  "payload",
  "payloadDigest",
  "publicKey",
  "signature",
] as const;

function isRecordV1(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function assertExactKeysV1(
  value: Record<string, unknown>,
  keys: readonly string[],
  label: string,
): void {
  const actual = Object.keys(value);
  if (
    actual.length !== keys.length ||
    actual.some((key, index) => key !== keys[index])
  ) {
    throw new ProviderServiceHandoffErrorV1(
      "invalid_config",
      `${label} fields are not exact`,
    );
  }
}

function requireSafeStringV1(value: unknown, label: string): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 4096 ||
    /[\u0000\r\n]/u.test(value)
  ) {
    throw new ProviderServiceHandoffErrorV1(
      "invalid_config",
      `${label} is invalid`,
    );
  }
  return value;
}

function requireAbsolutePathV1(value: unknown, label: string): string {
  const path = requireSafeStringV1(value, label);
  if (!isAbsolute(path) || basename(path) === "." || path.endsWith("/")) {
    throw new ProviderServiceHandoffErrorV1(
      "invalid_config",
      `${label} must be an absolute non-directory path`,
    );
  }
  return resolve(path);
}

function requireDirectRuntimeChildV1(
  runtimeRoot: string,
  candidate: string,
  label: string,
): void {
  if (dirname(candidate) !== runtimeRoot) {
    throw new ProviderServiceHandoffErrorV1(
      "invalid_config",
      `${label} must be a direct child of runtimeRoot`,
    );
  }
}

function requirePrincipalV1(value: unknown): ProviderServicePrincipalV1 {
  if (!isRecordV1(value)) {
    throw new ProviderServiceHandoffErrorV1(
      "invalid_config",
      "principal is invalid",
    );
  }
  assertExactKeysV1(value, PRINCIPAL_KEYS_V1, "principal");
  if (value.kind !== "dedicated_os_principal") {
    throw new ProviderServiceHandoffErrorV1(
      "invalid_config",
      "principal kind is invalid",
    );
  }
  const name = requireSafeStringV1(value.name, "principal.name");
  if (!/^[a-z_][a-z0-9_-]{0,31}$/u.test(name)) {
    throw new ProviderServiceHandoffErrorV1(
      "invalid_config",
      "principal.name is invalid",
    );
  }
  const uid = value.uid;
  const gid = value.gid;
  if (
    typeof uid !== "number" ||
    !Number.isSafeInteger(uid) ||
    uid <= 0 ||
    typeof gid !== "number" ||
    !Number.isSafeInteger(gid) ||
    gid <= 0
  ) {
    throw new ProviderServiceHandoffErrorV1(
      "invalid_config",
      "principal uid/gid must be positive safe integers",
    );
  }
  return { kind: "dedicated_os_principal", name, uid, gid };
}

function requireInstallationIdentityCustodyV1(
  value: unknown,
  runtimeRoot: string,
): ProviderServiceInstallationIdentityCustodyV1 {
  if (!isRecordV1(value)) {
    throw new ProviderServiceHandoffErrorV1(
      "invalid_config",
      "installationIdentityCustody is invalid",
    );
  }
  assertExactKeysV1(
    value,
    INSTALLATION_IDENTITY_CUSTODY_KEYS_V1,
    "installationIdentityCustody",
  );
  const keyPath = requireAbsolutePathV1(
    value.keyPath,
    "installationIdentityCustody.keyPath",
  );
  requireDirectRuntimeChildV1(
    runtimeRoot,
    keyPath,
    "installationIdentityCustody.keyPath",
  );
  try {
    return {
      keyPath,
      initializationNonce: LowerHex32V1Schema.parse(
        value.initializationNonce,
      ),
      installationIdentityGenerationId:
        InstallationIdentityGenerationIdV1Schema.parse(
          value.installationIdentityGenerationId,
        ),
      keyCheckToken: KeyedStateTokenV1Schema.parse(value.keyCheckToken),
    };
  } catch {
    throw new ProviderServiceHandoffErrorV1(
      "invalid_config",
      "installationIdentityCustody tuple is invalid",
    );
  }
}

function assertSupportedPlatformV1(value: unknown): ProviderServicePlatformV1 {
  if (
    value !== "darwin" &&
    value !== "linux"
  ) {
    throw new ProviderServiceHandoffErrorV1(
      "unsupported_platform",
      "provider service platform is unsupported",
    );
  }
  return value;
}

function digestCanonicalV1(value: unknown): ContentDigestV1 {
  const canonical = canonicalizeJcsSafeIntegerV1(value);
  return ContentDigestV1Schema.parse(
    `sha256:${createHash("sha256").update(canonical, "utf8").digest("hex")}`,
  );
}

function encodeBase64UrlV1(value: Uint8Array): `base64url:${string}` {
  return `base64url:${Buffer.from(value).toString("base64url")}`;
}

function decodeBase64UrlV1(
  value: unknown,
  label: string,
): Uint8Array {
  try {
    const parsed = CanonicalByteStringV1Schema.parse(value);
    return Buffer.from(parsed.slice("base64url:".length), "base64url");
  } catch {
    throw new ProviderServiceHandoffErrorV1(
      "invalid_config",
      `${label} is not canonical base64url`,
    );
  }
}

function publicKeyFromSpkiV1(value: Uint8Array): KeyObject {
  try {
    return createPublicKey({
      key: Buffer.from(value),
      format: "der",
      type: "spki",
    });
  } catch {
    throw new ProviderServiceHandoffErrorV1(
      "invalid_config",
      "public key is not an Ed25519 SPKI key",
    );
  }
}

function privateKeyV1(value: KeyObject): KeyObject {
  if (value.type !== "private" || value.asymmetricKeyType !== "ed25519") {
    throw new ProviderServiceHandoffErrorV1(
      "invalid_config",
      "signing key must be an Ed25519 private key",
    );
  }
  return value;
}

function validatePayloadV1(
  value: unknown,
): ProviderServiceHandoffPayloadV1 {
  if (!isRecordV1(value)) {
    throw new ProviderServiceHandoffErrorV1(
      "invalid_config",
      "service handoff payload is invalid",
    );
  }
  const hasInstallationIdentityCustody = Object.prototype.hasOwnProperty.call(
    value,
    "installationIdentityCustody",
  );
  assertExactKeysV1(
    value,
    hasInstallationIdentityCustody
      ? PAYLOAD_KEYS_WITH_CUSTODY_V1
      : PAYLOAD_KEYS_V1,
    "service handoff payload",
  );
  if (
    value.schemaVersion !== 1 ||
    value.profile !== PROVIDER_SERVICE_HANDOFF_PAYLOAD_PROFILE_V1
  ) {
    throw new ProviderServiceHandoffErrorV1(
      "invalid_config",
      "service handoff payload profile is invalid",
    );
  }
  const platform = assertSupportedPlatformV1(value.platform);
  const serviceLabel = requireSafeStringV1(value.serviceLabel, "serviceLabel");
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/u.test(serviceLabel)) {
    throw new ProviderServiceHandoffErrorV1(
      "invalid_config",
      "serviceLabel is invalid",
    );
  }
  let providerId: DurableObjectIdentityProviderIdV1;
  let installationIdentityDigest: ContentDigestV1;
  let binaryDigest: ContentDigestV1;
  let capabilityDigest: ContentDigestV1;
  try {
    providerId = DurableObjectIdentityProviderIdV1Schema.parse(value.providerId);
    installationIdentityDigest = ContentDigestV1Schema.parse(
      value.installationIdentityDigest,
    );
    binaryDigest = ContentDigestV1Schema.parse(value.binaryDigest);
    capabilityDigest = ContentDigestV1Schema.parse(value.capabilityDigest);
  } catch {
    throw new ProviderServiceHandoffErrorV1(
      "invalid_config",
      "service handoff identity fields are invalid",
    );
  }
  const runtimeRoot = requireAbsolutePathV1(value.runtimeRoot, "runtimeRoot");
  const socketPath = requireAbsolutePathV1(value.socketPath, "socketPath");
  const authKeyPath = requireAbsolutePathV1(value.authKeyPath, "authKeyPath");
  const readinessPath = requireAbsolutePathV1(
    value.readinessPath,
    "readinessPath",
  );
  const signingKeyPath = requireAbsolutePathV1(
    value.signingKeyPath,
    "signingKeyPath",
  );
  const installationIdentityCustody = hasInstallationIdentityCustody
    ? requireInstallationIdentityCustodyV1(
        value.installationIdentityCustody,
        runtimeRoot,
      )
    : undefined;
  for (const [label, candidate] of [
    ["socketPath", socketPath],
    ["authKeyPath", authKeyPath],
    ["readinessPath", readinessPath],
    ["signingKeyPath", signingKeyPath],
    ...(installationIdentityCustody === undefined
      ? []
      : [[
          "installationIdentityCustody.keyPath",
          installationIdentityCustody.keyPath,
        ]] as const),
  ] as const) {
    requireDirectRuntimeChildV1(runtimeRoot, candidate, label);
  }
  const runtimeOwnedPaths = [
    socketPath,
    authKeyPath,
    readinessPath,
    signingKeyPath,
    ...(installationIdentityCustody === undefined
      ? []
      : [installationIdentityCustody.keyPath]),
  ];
  if (new Set(runtimeOwnedPaths).size !== runtimeOwnedPaths.length) {
    throw new ProviderServiceHandoffErrorV1(
      "invalid_config",
      "runtime-owned service paths must be distinct",
    );
  }
  return {
    schemaVersion: 1,
    profile: PROVIDER_SERVICE_HANDOFF_PAYLOAD_PROFILE_V1,
    platform,
    serviceLabel,
    providerId,
    principal: requirePrincipalV1(value.principal),
    runtimeRoot,
    socketPath,
    executablePath: requireAbsolutePathV1(value.executablePath, "executablePath"),
    configPath: requireAbsolutePathV1(value.configPath, "configPath"),
    authKeyPath,
    readinessPath,
    signingKeyPath,
    ...(installationIdentityCustody === undefined
      ? {}
      : { installationIdentityCustody }),
    installationIdentityDigest,
    binaryDigest,
    capabilityDigest,
  };
}

function validateConfigShapeV1(
  value: unknown,
): ProviderServiceHandoffConfigV1 {
  if (!isRecordV1(value)) {
    throw new ProviderServiceHandoffErrorV1(
      "invalid_config",
      "service handoff config is invalid",
    );
  }
  assertExactKeysV1(value, CONFIG_KEYS_V1, "service handoff config");
  if (
    value.schemaVersion !== 1 ||
    value.profile !== PROVIDER_SERVICE_HANDOFF_PROFILE_V1
  ) {
    throw new ProviderServiceHandoffErrorV1(
      "invalid_config",
      "service handoff config profile is invalid",
    );
  }
  const payload = validatePayloadV1(value.payload);
  const payloadDigest = ContentDigestV1Schema.safeParse(value.payloadDigest);
  if (!payloadDigest.success || payloadDigest.data !== digestCanonicalV1(payload)) {
    throw new ProviderServiceHandoffErrorV1(
      "signature_invalid",
      "service handoff payload digest is invalid",
    );
  }
  const publicKey = value.publicKey;
  const signature = value.signature;
  const publicKeyBytes = decodeBase64UrlV1(publicKey, "publicKey");
  const signatureBytes = decodeBase64UrlV1(signature, "signature");
  if (signatureBytes.byteLength !== 64) {
    throw new ProviderServiceHandoffErrorV1(
      "invalid_config",
      "service handoff signature must be 64 bytes",
    );
  }
  publicKeyFromSpkiV1(publicKeyBytes);
  if (typeof publicKey !== "string" || typeof signature !== "string") {
    throw new ProviderServiceHandoffErrorV1(
      "invalid_config",
      "service handoff signature fields are invalid",
    );
  }
  return {
    schemaVersion: 1,
    profile: PROVIDER_SERVICE_HANDOFF_PROFILE_V1,
    payload,
    payloadDigest: payloadDigest.data,
    publicKey: publicKey as `base64url:${string}`,
    signature: signature as `base64url:${string}`,
  };
}

function verifyConfigSignatureV1(
  config: ProviderServiceHandoffConfigV1,
): boolean {
  try {
    const publicKey = publicKeyFromSpkiV1(
      decodeBase64UrlV1(config.publicKey, "publicKey"),
    );
    return verify(
      null,
      Buffer.from(canonicalizeJcsSafeIntegerV1(config.payload), "utf8"),
      publicKey,
      Buffer.from(decodeBase64UrlV1(config.signature, "signature")),
    );
  } catch {
    return false;
  }
}

/** Generate an Ed25519 key pair for the installed service handoff. */
export function generateProviderServiceSigningKeyPairV1(): {
  readonly privateKey: KeyObject;
  readonly publicKey: `base64url:${string}`;
} {
  const pair = generateKeyPairSync("ed25519");
  const publicKey = pair.publicKey.export({ format: "der", type: "spki" });
  return {
    privateKey: pair.privateKey,
    publicKey: encodeBase64UrlV1(publicKey),
  };
}

/** Create a signed, identity-bound service handoff config. */
export function createProviderServiceHandoffConfigV1(input: {
  readonly payload: ProviderServiceHandoffPayloadV1;
  readonly privateKey: KeyObject;
}): ProviderServiceHandoffConfigV1 {
  const privateKey = privateKeyV1(input.privateKey);
  const payload = validatePayloadV1(input.payload);
  const publicKey = createPublicKey(privateKey).export({
    format: "der",
    type: "spki",
  });
  const signature = sign(
    null,
    Buffer.from(canonicalizeJcsSafeIntegerV1(payload), "utf8"),
    privateKey,
  );
  const config: ProviderServiceHandoffConfigV1 = {
    schemaVersion: 1,
    profile: PROVIDER_SERVICE_HANDOFF_PROFILE_V1,
    payload,
    payloadDigest: digestCanonicalV1(payload),
    publicKey: encodeBase64UrlV1(publicKey),
    signature: encodeBase64UrlV1(signature),
  };
  if (!verifyConfigSignatureV1(config)) {
    throw new ProviderServiceHandoffErrorV1(
      "signature_invalid",
      "service handoff signature could not be self-verified",
    );
  }
  return config;
}

/** Validate config shape, signature, platform, and installation identity. */
export function verifyProviderServiceHandoffConfigV1(
  input: unknown,
  expectedInstallationIdentityDigest?: ContentDigestV1,
): ProviderServiceHandoffConfigV1 {
  const config = validateConfigShapeV1(input);
  if (!verifyConfigSignatureV1(config)) {
    throw new ProviderServiceHandoffErrorV1(
      "signature_invalid",
      "service handoff signature is invalid",
    );
  }
  if (
    expectedInstallationIdentityDigest !== undefined &&
    config.payload.installationIdentityDigest !== expectedInstallationIdentityDigest
  ) {
    throw new ProviderServiceHandoffErrorV1(
      "identity_mismatch",
      "service handoff installation identity does not match",
    );
  }
  return config;
}

function xmlEscapeV1(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function systemdEscapeV1(value: string): string {
  if (/[\u0000\r\n]/u.test(value)) {
    throw new ProviderServiceHandoffErrorV1(
      "descriptor_path_invalid",
      "systemd descriptor value contains a control character",
    );
  }
  return value
    .replaceAll("%", "%%")
    .replaceAll("\\", "\\\\")
    .replaceAll("\"", '\\"')
    .replaceAll(" ", "\\x20")
    .replaceAll("\t", "\\x09");
}

function descriptorDigestV1(descriptor: string): ContentDigestV1 {
  return ContentDigestV1Schema.parse(
    `sha256:${createHash("sha256").update(descriptor, "utf8").digest("hex")}`,
  );
}

/** Render the exact launchd plist or systemd unit consumed by the installer. */
export function renderProviderServiceDescriptorV1(
  input: ProviderServiceHandoffConfigV1,
): ProviderServiceDescriptorV1 {
  const config = verifyProviderServiceHandoffConfigV1(input);
  const payload = config.payload;
  if (payload.platform === "darwin") {
    const args = [
      payload.executablePath,
      "--service-config",
      payload.configPath,
    ];
    const descriptor = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
      '<plist version="1.0"><dict>',
      `<key>Label</key><string>${xmlEscapeV1(payload.serviceLabel)}</string>`,
      "<key>ProgramArguments</key><array>",
      ...args.map((arg) => `<string>${xmlEscapeV1(arg)}</string>`),
      "</array>",
      `<key>UserName</key><string>${xmlEscapeV1(payload.principal.name)}</string>`,
      `<key>GroupName</key><string>${xmlEscapeV1(payload.principal.name)}</string>`,
      "<key>RunAtLoad</key><true/>",
      "<key>KeepAlive</key><true/>",
      "<key>ProcessType</key><string>Background</string>",
      "<key>Umask</key><integer>63</integer>",
      "</dict></plist>",
      "",
    ].join("\n");
    return {
      platform: "darwin",
      format: "launchd_plist",
      serviceLabel: payload.serviceLabel,
      descriptor,
      descriptorDigest: descriptorDigestV1(descriptor),
    };
  }

  const descriptor = [
    "[Unit]",
    `Description=${systemdEscapeV1(payload.serviceLabel)}`,
    "After=local-fs.target",
    "",
    "[Service]",
    "Type=simple",
    `ExecStart=${systemdEscapeV1(payload.executablePath)} --service-config ${systemdEscapeV1(payload.configPath)}`,
    `User=${systemdEscapeV1(payload.principal.name)}`,
    `Group=${systemdEscapeV1(payload.principal.name)}`,
    "UMask=0077",
    "NoNewPrivileges=true",
    "PrivateTmp=true",
    "ProtectSystem=strict",
    "ProtectHome=true",
    `ReadWritePaths=${systemdEscapeV1(payload.runtimeRoot)}`,
    "Restart=on-failure",
    "RestartSec=1s",
    "",
    "[Install]",
    "WantedBy=multi-user.target",
    "",
  ].join("\n");
  return {
    platform: "linux",
    format: "systemd_unit",
    serviceLabel: payload.serviceLabel,
    descriptor,
    descriptorDigest: descriptorDigestV1(descriptor),
  };
}

export function defaultProviderServiceDescriptorPathV1(
  platform: ProviderServicePlatformV1,
  serviceLabel: string,
): string {
  requireSafeStringV1(serviceLabel, "serviceLabel");
  if (platform === "darwin") {
    return `/Library/LaunchDaemons/${serviceLabel}.plist`;
  }
  return `/etc/systemd/system/${serviceLabel}.service`;
}

/**
 * Install config + descriptor into the system service namespace.  This API is
 * deliberately root-only: a normal workspace process cannot impersonate the
 * dedicated principal or claim that a service has been provisioned.
 */
export async function provisionProviderServiceHandoffV1(
  options: ProviderServiceProvisionOptionsV1,
): Promise<ProviderServiceProvisionResultV1> {
  const config = verifyProviderServiceHandoffConfigV1(options.config);
  if (process.platform !== config.payload.platform) {
    throw new ProviderServiceHandoffErrorV1(
      "unsupported_platform",
      "service handoff platform does not match the current platform",
    );
  }
  if (typeof process.getuid !== "function" || process.getuid() !== 0) {
    throw new ProviderServiceHandoffErrorV1(
      "non_root_provisioning_forbidden",
      "provider service provisioning requires a privileged installer",
    );
  }
  const descriptor = renderProviderServiceDescriptorV1(config);
  const descriptorPath = resolve(
    options.descriptorPath ??
      defaultProviderServiceDescriptorPathV1(
        config.payload.platform,
        config.payload.serviceLabel,
      ),
  );
  const configPath = resolve(options.configPath ?? config.payload.configPath);
  if (!isAbsolute(descriptorPath) || !isAbsolute(configPath)) {
    throw new ProviderServiceHandoffErrorV1(
      "descriptor_path_invalid",
      "service descriptor/config paths must be absolute",
    );
  }
  if (configPath !== config.payload.configPath) {
    throw new ProviderServiceHandoffErrorV1(
      "identity_mismatch",
      "config path override must match the signed handoff payload",
    );
  }
  if (descriptorPath === configPath) {
    throw new ProviderServiceHandoffErrorV1(
      "descriptor_path_invalid",
      "service descriptor and signed config must use different paths",
    );
  }
  const privateKey = privateKeyV1(options.privateKey);
  const derivedPublicKey = encodeBase64UrlV1(
    createPublicKey(privateKey).export({ format: "der", type: "spki" }),
  );
  if (derivedPublicKey !== config.publicKey) {
    throw new ProviderServiceHandoffErrorV1(
      "signature_invalid",
      "service signing key does not match handoff config",
    );
  }
  const custody = config.payload.installationIdentityCustody;
  let installationIdentityKey: Buffer | undefined;
  if (custody === undefined) {
    if (options.installationIdentityKey !== undefined) {
      throw new ProviderServiceHandoffErrorV1(
        "invalid_config",
        "installation Identity key requires signed custody metadata",
      );
    }
  } else {
    if (
      !(options.installationIdentityKey instanceof Uint8Array) ||
      options.installationIdentityKey.byteLength !== 32
    ) {
      throw new ProviderServiceHandoffErrorV1(
        "identity_mismatch",
        "signed Installation Identity custody requires an exact 32-byte key",
      );
    }
    installationIdentityKey = Buffer.from(options.installationIdentityKey);
    try {
      await mintProviderServiceInstallationIdentityVerificationCapabilityInternalV1({
        installationIdentityKey,
        initializationNonce: custody.initializationNonce,
        installationIdentityGenerationId:
          custody.installationIdentityGenerationId,
        keyCheckToken: custody.keyCheckToken,
      });
    } catch {
      installationIdentityKey.fill(0);
      installationIdentityKey = undefined;
      throw new ProviderServiceHandoffErrorV1(
        "identity_mismatch",
        "Installation Identity custody tuple does not match the supplied key",
      );
    }
  }
  const authKey = randomBytes(32);
  const signingKey = Buffer.from(
    privateKey.export({ format: "der", type: "pkcs8" }),
  );
  try {
    await mkdir(config.payload.runtimeRoot, { recursive: true, mode: 0o700 });
    const runtimeRootMetadata = await lstat(config.payload.runtimeRoot);
    if (
      !runtimeRootMetadata.isDirectory() ||
      runtimeRootMetadata.isSymbolicLink()
    ) {
      throw new ProviderServiceHandoffErrorV1(
        "descriptor_path_invalid",
        "runtimeRoot must be a non-symlink directory",
      );
    }
    await chmod(config.payload.runtimeRoot, 0o700);
    await chown(
      config.payload.runtimeRoot,
      config.payload.principal.uid,
      config.payload.principal.gid,
    );
    await mkdir(dirname(configPath), { recursive: true, mode: 0o755 });
    await mkdir(dirname(descriptorPath), { recursive: true, mode: 0o755 });
    await atomicWriteTextV1(configPath, `${JSON.stringify(config)}\n`, 0o644);
    await atomicWriteBytesV1(config.payload.authKeyPath, authKey, 0o600);
    await chown(
      config.payload.authKeyPath,
      config.payload.principal.uid,
      config.payload.principal.gid,
    );
    await atomicWriteBytesV1(
      config.payload.signingKeyPath,
      signingKey,
      0o600,
    );
    await chown(
      config.payload.signingKeyPath,
      config.payload.principal.uid,
      config.payload.principal.gid,
    );
    if (custody !== undefined && installationIdentityKey !== undefined) {
      await atomicWritePrincipalOwnedBytesV1(
        custody.keyPath,
        installationIdentityKey,
        0o600,
        config.payload.principal.uid,
        config.payload.principal.gid,
      );
    }
    await atomicWriteTextV1(descriptorPath, descriptor.descriptor, 0o644);
    return {
      status: "provisioned",
      authority: "read_only",
      strongWrites: "locked",
      platform: config.payload.platform,
      descriptorPath,
      configPath,
      descriptorDigest: descriptor.descriptorDigest,
    };
  } finally {
    authKey.fill(0);
    signingKey.fill(0);
    installationIdentityKey?.fill(0);
  }
}

async function atomicWriteBytesV1(
  path: string,
  content: Uint8Array,
  mode: number,
): Promise<void> {
  const temporary = `${path}.tmp-${process.pid}-${Date.now().toString(36)}`;
  await writeFile(temporary, content, { mode, flag: "wx" });
  try {
    await chmod(temporary, mode);
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

async function atomicWritePrincipalOwnedBytesV1(
  path: string,
  content: Uint8Array,
  mode: number,
  uid: number,
  gid: number,
): Promise<void> {
  const temporary = `${path}.tmp-${process.pid}-${Date.now().toString(36)}`;
  await writeFile(temporary, content, { mode, flag: "wx" });
  try {
    await chmod(temporary, mode);
    await chown(temporary, uid, gid);
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

async function atomicWriteTextV1(
  path: string,
  content: string,
  mode: number,
): Promise<void> {
  const temporary = `${path}.tmp-${process.pid}-${Date.now().toString(36)}`;
  await writeFile(temporary, content, { mode, flag: "wx" });
  try {
    await chmod(temporary, mode);
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

function validateReadinessPayloadV1(
  value: unknown,
): ProviderServiceReadinessPayloadV1 {
  if (!isRecordV1(value)) {
    throw new ProviderServiceHandoffErrorV1(
      "readiness_invalid",
      "readiness payload is invalid",
    );
  }
  assertExactKeysV1(value, READINESS_PAYLOAD_KEYS_V1, "readiness payload");
  if (
    value.schemaVersion !== 1 ||
    value.profile !== PROVIDER_SERVICE_READINESS_PROFILE_V1 ||
    value.status !== "ready"
  ) {
    throw new ProviderServiceHandoffErrorV1(
      "readiness_invalid",
      "readiness payload profile/status is invalid",
    );
  }
  let providerId: DurableObjectIdentityProviderIdV1;
  let installationIdentityDigest: ContentDigestV1;
  let handoffPayloadDigest: ContentDigestV1;
  let targetFingerprintDigest: ContentDigestV1;
  try {
    providerId = DurableObjectIdentityProviderIdV1Schema.parse(value.providerId);
    installationIdentityDigest = ContentDigestV1Schema.parse(
      value.installationIdentityDigest,
    );
    handoffPayloadDigest = ContentDigestV1Schema.parse(
      value.handoffPayloadDigest,
    );
    targetFingerprintDigest = ContentDigestV1Schema.parse(
      value.targetFingerprintDigest,
    );
  } catch {
    throw new ProviderServiceHandoffErrorV1(
      "readiness_invalid",
      "readiness identity fields are invalid",
    );
  }
  const serviceLabel = requireSafeStringV1(value.serviceLabel, "serviceLabel");
  const runtimeRoot = requireAbsolutePathV1(value.runtimeRoot, "runtimeRoot");
  const socketPath = requireAbsolutePathV1(value.socketPath, "socketPath");
  const observedUid = value.observedUid;
  const observedGid = value.observedGid;
  if (
    typeof observedUid !== "number" ||
    !Number.isSafeInteger(observedUid) ||
    observedUid <= 0 ||
    typeof observedGid !== "number" ||
    !Number.isSafeInteger(observedGid) ||
    observedGid <= 0
  ) {
    throw new ProviderServiceHandoffErrorV1(
      "readiness_invalid",
      "readiness observed uid/gid are invalid",
    );
  }
  const startedAt = requireSafeStringV1(value.startedAt, "startedAt");
  if (Number.isNaN(Date.parse(startedAt))) {
    throw new ProviderServiceHandoffErrorV1(
      "readiness_invalid",
      "readiness startedAt is invalid",
    );
  }
  const nonce = value.nonce;
  decodeBase64UrlV1(nonce, "nonce");
  return {
    schemaVersion: 1,
    profile: PROVIDER_SERVICE_READINESS_PROFILE_V1,
    serviceLabel,
    providerId,
    installationIdentityDigest,
    runtimeRoot,
    socketPath,
    observedUid,
    observedGid,
    handoffPayloadDigest,
    targetFingerprintDigest,
    startedAt,
    nonce: nonce as `base64url:${string}`,
    status: "ready",
  };
}

function validateReadinessShapeV1(
  value: unknown,
): ProviderServiceReadinessReceiptV1 {
  if (!isRecordV1(value)) {
    throw new ProviderServiceHandoffErrorV1(
      "readiness_invalid",
      "readiness receipt is invalid",
    );
  }
  assertExactKeysV1(value, READINESS_KEYS_V1, "readiness receipt");
  if (
    value.schemaVersion !== 1 ||
    value.profile !== PROVIDER_SERVICE_READINESS_PROFILE_V1
  ) {
    throw new ProviderServiceHandoffErrorV1(
      "readiness_invalid",
      "readiness receipt profile is invalid",
    );
  }
  const payload = validateReadinessPayloadV1(value.payload);
  const digest = ContentDigestV1Schema.safeParse(value.payloadDigest);
  if (!digest.success || digest.data !== digestCanonicalV1(payload)) {
    throw new ProviderServiceHandoffErrorV1(
      "readiness_invalid",
      "readiness payload digest is invalid",
    );
  }
  const publicKey = value.publicKey;
  const signature = value.signature;
  const publicKeyBytes = decodeBase64UrlV1(publicKey, "readiness publicKey");
  const signatureBytes = decodeBase64UrlV1(signature, "readiness signature");
  if (signatureBytes.byteLength !== 64) {
    throw new ProviderServiceHandoffErrorV1(
      "readiness_invalid",
      "readiness signature must be 64 bytes",
    );
  }
  publicKeyFromSpkiV1(publicKeyBytes);
  return {
    schemaVersion: 1,
    profile: PROVIDER_SERVICE_READINESS_PROFILE_V1,
    payload,
    payloadDigest: digest.data,
    publicKey: publicKey as `base64url:${string}`,
    signature: signature as `base64url:${string}`,
  };
}

function verifyReadinessSignatureV1(
  receipt: ProviderServiceReadinessReceiptV1,
): boolean {
  try {
    return verify(
      null,
      Buffer.from(canonicalizeJcsSafeIntegerV1(receipt.payload), "utf8"),
      publicKeyFromSpkiV1(
        decodeBase64UrlV1(receipt.publicKey, "readiness publicKey"),
      ),
      Buffer.from(decodeBase64UrlV1(receipt.signature, "readiness signature")),
    );
  } catch {
    return false;
  }
}

/** Create a principal-owned readiness receipt from the running service. */
export function createProviderServiceReadinessReceiptV1(input: {
  readonly config: ProviderServiceHandoffConfigV1;
  readonly observedUid: number;
  readonly observedGid: number;
  readonly targetFingerprintDigest: ContentDigestV1;
  readonly startedAt?: string;
  readonly nonce: Uint8Array;
  readonly privateKey: KeyObject;
}): ProviderServiceReadinessReceiptV1 {
  const config = verifyProviderServiceHandoffConfigV1(input.config);
  const privateKey = privateKeyV1(input.privateKey);
  const derivedPublicKey = encodeBase64UrlV1(
    createPublicKey(privateKey).export({ format: "der", type: "spki" }),
  );
  if (derivedPublicKey !== config.publicKey) {
    throw new ProviderServiceHandoffErrorV1(
      "signature_invalid",
      "readiness signing key does not match handoff config",
    );
  }
  const payload: ProviderServiceReadinessPayloadV1 = {
    schemaVersion: 1,
    profile: PROVIDER_SERVICE_READINESS_PROFILE_V1,
    serviceLabel: config.payload.serviceLabel,
    providerId: config.payload.providerId,
    installationIdentityDigest: config.payload.installationIdentityDigest,
    runtimeRoot: config.payload.runtimeRoot,
    socketPath: config.payload.socketPath,
    observedUid: input.observedUid,
    observedGid: input.observedGid,
    handoffPayloadDigest: config.payloadDigest,
    targetFingerprintDigest: ContentDigestV1Schema.parse(
      input.targetFingerprintDigest,
    ),
    startedAt: input.startedAt ?? new Date().toISOString(),
    nonce: encodeBase64UrlV1(input.nonce),
    status: "ready",
  };
  validateReadinessPayloadV1(payload);
  const receipt: ProviderServiceReadinessReceiptV1 = {
    schemaVersion: 1,
    profile: PROVIDER_SERVICE_READINESS_PROFILE_V1,
    payload,
    payloadDigest: digestCanonicalV1(payload),
    publicKey: config.publicKey,
    signature: encodeBase64UrlV1(
      sign(
        null,
        Buffer.from(canonicalizeJcsSafeIntegerV1(payload), "utf8"),
        privateKey,
      ),
    ),
  };
  if (!verifyReadinessSignatureV1(receipt)) {
    throw new ProviderServiceHandoffErrorV1(
      "signature_invalid",
      "readiness signature could not be self-verified",
    );
  }
  return receipt;
}

/**
 * Read the service's principal-owned readiness receipt. Missing, unsigned, or
 * wrong-owner receipts remain unavailable and never unlock strong writes.
 */
export async function readProviderServiceReadinessV1(input: {
  readonly config: ProviderServiceHandoffConfigV1;
  readonly readinessPath: string;
  readonly expectedInstallationIdentityDigest?: ContentDigestV1;
}): Promise<ProviderServiceReadinessResultV1> {
  const config = verifyProviderServiceHandoffConfigV1(
    input.config,
    input.expectedInstallationIdentityDigest,
  );
  if (resolve(input.readinessPath) !== config.payload.readinessPath) {
    return {
      status: "unavailable",
      authority: "read_only",
      strongWrites: "locked",
      platform: config.payload.platform,
      reason: "attestation_invalid",
    };
  }
  const platform = config.payload.platform;
  if (!SUPPORTED_PLATFORMS_V1.includes(platform)) {
    return {
      status: "unavailable",
      authority: "read_only",
      strongWrites: "locked",
      platform: "unknown",
      reason: "unsupported_platform",
    };
  }
  let metadata: Awaited<ReturnType<typeof lstat>>;
  let raw: string;
  try {
    metadata = await lstat(input.readinessPath);
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      return {
        status: "unavailable",
        authority: "read_only",
        strongWrites: "locked",
        platform,
        reason: "attestation_invalid",
      };
    }
    raw = await readFile(input.readinessPath, "utf8");
  } catch (error) {
    const code =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { readonly code?: unknown }).code === "ENOENT"
        ? "service_not_provisioned"
        : "attestation_invalid";
    return {
      status: "unavailable",
      authority: "read_only",
      strongWrites: "locked",
      platform,
      reason: code,
    };
  }
  if (
    (metadata.mode & 0o777) !== 0o600 ||
    metadata.uid !== config.payload.principal.uid ||
    metadata.gid !== config.payload.principal.gid
  ) {
    return {
      status: "unavailable",
      authority: "read_only",
      strongWrites: "locked",
      platform,
      reason: "principal_mismatch",
    };
  }
  // A readiness file owned by the caller's own UID is only a same-UID marker,
  // not evidence of a dedicated service principal. Keep the Provider Gate
  // locked rather than upgrading that candidate into service authority.
  if (
    typeof process.getuid === "function" &&
    process.getuid() !== 0 &&
    process.getuid() === config.payload.principal.uid
  ) {
    return {
      status: "unavailable",
      authority: "read_only",
      strongWrites: "locked",
      platform,
      reason: "principal_mismatch",
    };
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    const receipt = validateReadinessShapeV1(parsed);
    if (
      receipt.publicKey !== config.publicKey ||
      !verifyReadinessSignatureV1(receipt) ||
      receipt.payload.serviceLabel !== config.payload.serviceLabel ||
      receipt.payload.providerId !== config.payload.providerId ||
      receipt.payload.installationIdentityDigest !==
        config.payload.installationIdentityDigest ||
      receipt.payload.runtimeRoot !== config.payload.runtimeRoot ||
      receipt.payload.socketPath !== config.payload.socketPath ||
      receipt.payload.observedUid !== config.payload.principal.uid ||
      receipt.payload.observedGid !== config.payload.principal.gid ||
      receipt.payload.handoffPayloadDigest !== config.payloadDigest
    ) {
      return {
        status: "unavailable",
        authority: "read_only",
        strongWrites: "locked",
        platform,
        reason: "attestation_invalid",
      };
    }
    return {
      status: "signed_candidate",
      authority: "read_only",
      strongWrites: "locked",
      platform,
      serviceLabel: config.payload.serviceLabel,
      providerId: config.payload.providerId,
      principalUid: config.payload.principal.uid,
      targetFingerprintDigest: receipt.payload.targetFingerprintDigest,
    };
  } catch (error) {
    const reason: "attestation_invalid" = "attestation_invalid";
    void error;
    return {
      status: "unavailable",
      authority: "read_only",
      strongWrites: "locked",
      platform,
      reason,
    };
  }
}

/**
 * Public Doctor-facing projection. It validates the signed descriptor,
 * renders the platform handoff, and (when supplied) checks the principal-owned
 * readiness receipt. No path, key, or volume locator is returned.
 */
export async function inspectProviderServiceHandoffV1(input: {
  readonly config: unknown;
  readonly readinessPath?: string;
  readonly expectedInstallationIdentityDigest?: ContentDigestV1;
}): Promise<ProviderServiceHandoffInspectionV1> {
  let config: ProviderServiceHandoffConfigV1;
  try {
    config = verifyProviderServiceHandoffConfigV1(
      input.config,
      input.expectedInstallationIdentityDigest,
    );
  } catch (error) {
    const reason =
      error instanceof ProviderServiceHandoffErrorV1
        ? error.code === "identity_mismatch"
          ? "identity_mismatch"
          : error.code === "signature_invalid"
            ? "signature_invalid"
            : error.code === "unsupported_platform"
              ? "unsupported_platform"
              : "invalid_config"
        : "invalid_config";
    return {
      status: "unavailable",
      authority: "read_only",
      strongWrites: "locked",
      platform: "unknown",
      reason,
    };
  }
  let descriptor: ProviderServiceDescriptorV1;
  try {
    descriptor = renderProviderServiceDescriptorV1(config);
  } catch (error) {
    const reason =
      error instanceof ProviderServiceHandoffErrorV1 &&
      error.code === "unsupported_platform"
        ? "unsupported_platform"
        : "invalid_config";
    return {
      status: "unavailable",
      authority: "read_only",
      strongWrites: "locked",
      platform: "unknown",
      reason,
    };
  }
  const base = {
    platform: config.payload.platform,
    serviceLabel: config.payload.serviceLabel,
    providerId: config.payload.providerId,
    principalUid: config.payload.principal.uid,
    descriptorFormat: descriptor.format,
    descriptorDigest: descriptor.descriptorDigest,
  } as const;
  if (input.readinessPath === undefined) {
    return {
      status: "valid_unprovisioned",
      authority: "read_only",
      strongWrites: "locked",
      ...base,
    };
  }
  const readiness = await readProviderServiceReadinessV1({
    config,
    readinessPath: input.readinessPath,
    expectedInstallationIdentityDigest: input.expectedInstallationIdentityDigest,
  });
  if (readiness.status === "signed_candidate") {
    return {
      status: "signed_candidate",
      authority: readiness.authority,
      strongWrites: readiness.strongWrites,
      ...base,
      readiness,
    };
  }
  return {
    status: "valid_unprovisioned",
    authority: "read_only",
    strongWrites: "locked",
    ...base,
    readiness,
    reason: readiness.reason,
  };
}
