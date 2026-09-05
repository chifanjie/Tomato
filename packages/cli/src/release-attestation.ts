import { createHash, createPublicKey, verify } from "node:crypto";

import { canonicalizeJson } from "@understand-code/contracts";

/** Domain separator for the external publisher authenticity boundary. */
export const RELEASE_ATTESTATION_DOMAIN_V1 =
  "understand-code-release-attestation-v1" as const;

export const RELEASE_ATTESTATION_SCHEMA_VERSION_V1 =
  "understand-code-release-attestation-v1" as const;
export const RELEASE_TRUST_BUNDLE_SCHEMA_VERSION_V1 =
  "understand-code-release-trust-bundle-v1" as const;

const ED25519_SPKI_DER_PREFIX_V1 = Buffer.from([
  0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
]);
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const KEY_ID_PATTERN = /^ed25519-spki-sha256:[0-9a-f]{64}$/u;
const SIGNATURE_PATTERN = /^ed25519:[0-9a-f]{128}$/u;

/** The exact immutable release references covered by a publisher signature. */
export type ReleaseAttestationClaimsV1 = Readonly<{
  schemaVersion: typeof RELEASE_ATTESTATION_SCHEMA_VERSION_V1;
  product: "understand-code";
  package: Readonly<{ name: "@understand-code/preview"; version: string }>;
  releaseManifest: Readonly<{ sha256: string }>;
  sbom: Readonly<{ sha256: string }>;
  provenance: Readonly<{ sha256: string }>;
  payloadInventory: Readonly<{ sha256: string; fileCount: number }>;
}>;

export type ReleaseSignatureEnvelopeV1 = Readonly<{
  schemaVersion: typeof RELEASE_ATTESTATION_SCHEMA_VERSION_V1;
  algorithm: "Ed25519";
  keyId: string;
  claims: ReleaseAttestationClaimsV1;
  signature: string;
}>;

export type ReleaseTrustBundleKeyV1 = Readonly<{
  keyId: string;
  algorithm: "Ed25519";
  publicKeySpkiBase64: string;
}>;

export type ReleaseTrustBundleV1 = Readonly<{
  schemaVersion: typeof RELEASE_TRUST_BUNDLE_SCHEMA_VERSION_V1;
  product: "understand-code";
  keys: readonly ReleaseTrustBundleKeyV1[];
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && SHA256_PATTERN.test(value);
}

function decodeCanonicalSpki(value: unknown): Buffer | undefined {
  if (typeof value !== "string" || !/^[A-Za-z0-9+/]{59}=$/u.test(value)) {
    return undefined;
  }
  let bytes: Buffer;
  try {
    bytes = Buffer.from(value, "base64");
  } catch {
    return undefined;
  }
  if (
    bytes.length !== 44 ||
    bytes.toString("base64") !== value ||
    !bytes.subarray(0, ED25519_SPKI_DER_PREFIX_V1.length).equals(
      ED25519_SPKI_DER_PREFIX_V1,
    )
  ) {
    return undefined;
  }
  return bytes;
}

function releaseClaims(value: unknown): ReleaseAttestationClaimsV1 | undefined {
  const payloadInventory = isRecord(value) && isRecord(value.payloadInventory)
    ? value.payloadInventory
    : undefined;
  if (!isRecord(value) ||
    value.schemaVersion !== RELEASE_ATTESTATION_SCHEMA_VERSION_V1 ||
    value.product !== "understand-code" ||
    !isRecord(value.package) ||
    value.package.name !== "@understand-code/preview" ||
    typeof value.package.version !== "string" ||
    value.package.version.length === 0 ||
    !isRecord(value.releaseManifest) || !isSha256(value.releaseManifest.sha256) ||
    !isRecord(value.sbom) || !isSha256(value.sbom.sha256) ||
    !isRecord(value.provenance) || !isSha256(value.provenance.sha256) ||
    payloadInventory === undefined ||
    !isSha256(payloadInventory.sha256) ||
    !Number.isSafeInteger(payloadInventory.fileCount) ||
    (payloadInventory.fileCount as number) < 1) {
    return undefined;
  }
  return value as unknown as ReleaseAttestationClaimsV1;
}

/** Canonical bytes that a publisher must sign; callers own the private key. */
export function createReleaseAttestationMessageV1(
  claims: ReleaseAttestationClaimsV1,
): Uint8Array {
  const parsed = releaseClaims(claims);
  if (parsed === undefined) throw new TypeError("release attestation claims are invalid");
  return Buffer.from(canonicalizeJson([
    RELEASE_ATTESTATION_DOMAIN_V1,
    parsed,
  ]), "utf8");
}

/** Derive the stable trust-bundle key id from a canonical Ed25519 SPKI key. */
export function deriveReleaseTrustKeyIdV1(spkiBase64: string): string {
  const bytes = decodeCanonicalSpki(spkiBase64);
  if (bytes === undefined) throw new TypeError("Ed25519 SPKI is invalid");
  return `ed25519-spki-sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function parseTrustBundle(value: unknown): readonly ReleaseTrustBundleKeyV1[] | undefined {
  if (!isRecord(value) ||
    value.schemaVersion !== RELEASE_TRUST_BUNDLE_SCHEMA_VERSION_V1 ||
    value.product !== "understand-code" ||
    !Array.isArray(value.keys) || value.keys.length === 0) {
    return undefined;
  }
  const ids = new Set<string>();
  const keys: ReleaseTrustBundleKeyV1[] = [];
  for (const candidate of value.keys) {
    if (!isRecord(candidate) || candidate.algorithm !== "Ed25519" ||
      typeof candidate.keyId !== "string" || !KEY_ID_PATTERN.test(candidate.keyId) ||
      typeof candidate.publicKeySpkiBase64 !== "string" ||
      decodeCanonicalSpki(candidate.publicKeySpkiBase64) === undefined ||
      deriveReleaseTrustKeyIdV1(candidate.publicKeySpkiBase64) !== candidate.keyId ||
      ids.has(candidate.keyId)) {
      return undefined;
    }
    ids.add(candidate.keyId);
    keys.push(candidate as unknown as ReleaseTrustBundleKeyV1);
  }
  return keys;
}

/**
 * Verify an externally supplied release signature against an externally
 * supplied trust bundle. This is intentionally fail-closed and never creates
 * a signature or promotes an Alpha candidate on its own.
 */
export function verifyReleaseAttestationV1(
  envelope: unknown,
  trustBundle: unknown,
): boolean {
  try {
    if (!isRecord(envelope) ||
      envelope.schemaVersion !== RELEASE_ATTESTATION_SCHEMA_VERSION_V1 ||
      envelope.algorithm !== "Ed25519" ||
      typeof envelope.keyId !== "string" || !KEY_ID_PATTERN.test(envelope.keyId) ||
      typeof envelope.signature !== "string" || !SIGNATURE_PATTERN.test(envelope.signature)) {
      return false;
    }
    const claims = releaseClaims(envelope.claims);
    const keys = parseTrustBundle(trustBundle);
    if (claims === undefined || keys === undefined) return false;
    const trusted = keys.find((key) => key.keyId === envelope.keyId);
    if (trusted === undefined) return false;
    const spki = decodeCanonicalSpki(trusted.publicKeySpkiBase64);
    if (spki === undefined) return false;
    const signature = Buffer.from(envelope.signature.slice("ed25519:".length), "hex");
    if (signature.length !== 64) return false;
    const publicKey = createPublicKey({ key: spki, format: "der", type: "spki" });
    return verify(null, createReleaseAttestationMessageV1(claims), publicKey, signature);
  } catch {
    return false;
  }
}
