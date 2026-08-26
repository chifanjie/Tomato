import { createHash } from "node:crypto";

import {
  KeyedStateTokenV1Schema,
  ContentDigestSchema,
  StrongVerificationOwnerOnlyDetailV1Schema,
  StrongRecordVerificationInputV1Schema,
  canonicalizeJson,
  type StrongRecordVerificationInputV1,
  type StrongVerificationPreparationV1,
} from "@understand-code/contracts";

const SCAN_POLICY = Object.freeze({
  version: "sensitive-request-scan-policy-v1",
  maxNormalizedInputBytes: 16_777_216,
  maxCommandArgumentCount: 256,
  maxCommandExecutableBytes: 8_192,
  maxCommandArgumentBytes: 8_192,
  maxCommandTotalBytes: 1_048_576,
  maxSummaryBytes: 65_536,
  maxRawOutputBytes: 8_388_608,
  maxClaimIds: 4_096,
});

const REDACTION_ORDER = [
  "secret_detected",
  "host_path_detected",
  "control_character",
  "invalid_utf8",
] as const;

type RedactionCode = (typeof REDACTION_ORDER)[number];

export type StrongVerificationOwnerOnlyDetailV1 = ReturnType<
  typeof StrongVerificationOwnerOnlyDetailV1Schema.parse
>;

export interface StrongVerificationDetailScanResultV1 {
  readonly sensitiveRequestScanPolicyDigest: StrongVerificationPreparationV1["sensitiveRequestScanPolicyDigest"];
  readonly fullInputEqualityTag: StrongVerificationPreparationV1["fullInputEqualityTag"];
  readonly ownerOnlyDetailCommitment?: NonNullable<StrongVerificationPreparationV1["ownerOnlyDetailCommitment"]>;
  readonly detail: StrongVerificationPreparationV1["detail"];
  readonly detailFields: StrongVerificationPreparationV1["detailFields"];
  readonly ownerOnlyDetail?: StrongVerificationOwnerOnlyDetailV1;
}

export interface StrongVerificationOwnerKeyAuthorityV1 {
  readonly provenance: "provider_installation_owner_v1";
  commit(
    domain:
      | "record-verification-full-input-v1"
      | "verification-detail-semantic-v1",
    canonicalValue: string,
  ): Promise<string>;
}

function sha256(value: string | Uint8Array): StrongVerificationPreparationV1["sensitiveRequestScanPolicyDigest"] {
  return ContentDigestSchema.parse(
    `sha256:${createHash("sha256").update(value).digest("hex")}`,
  );
}

async function ownerCommit(
  authority: StrongVerificationOwnerKeyAuthorityV1,
  domain:
    | "record-verification-full-input-v1"
    | "verification-detail-semantic-v1",
  value: unknown,
): Promise<StrongVerificationPreparationV1["fullInputEqualityTag"]> {
  if (authority.provenance !== "provider_installation_owner_v1") {
    throw new TypeError("verification equality authority has invalid provenance");
  }
  return KeyedStateTokenV1Schema.parse(
    await authority.commit(domain, canonicalizeJson([domain, value])),
  );
}

function hasControlCharacter(value: string): boolean {
  return /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value);
}

function hasHostAbsolutePath(value: string): boolean {
  return (
    /(?:^|[\s"'=(])\/(?!\/)[^\s"']+/u.test(value) ||
    /(?:^|[\s"'=(])[A-Za-z]:[\\/]/u.test(value) ||
    /(?:^|[\s"'=(])\\\\[^\\\s]+\\[^\\\s]+/u.test(value)
  );
}

function hasSecret(value: string): boolean {
  return (
    /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/u.test(value) ||
    /\bAKIA[0-9A-Z]{16}\b/u.test(value) ||
    /\b(?:authorization|password|passwd|secret|token|api[_-]?key)\s*[:=]\s*[^\s,;]{4,}/iu.test(value) ||
    /\bBearer\s+[A-Za-z0-9._~+/-]{8,}={0,2}\b/u.test(value)
  );
}

function scanText(value: string, codes: Set<RedactionCode>): void {
  if (hasSecret(value)) codes.add("secret_detected");
  if (hasHostAbsolutePath(value)) codes.add("host_path_detected");
  if (hasControlCharacter(value)) codes.add("control_character");
}

function decodeRawOutput(
  encoded: string,
  codes: Set<RedactionCode>,
): { bytes: Buffer; text: string } | undefined {
  const payload = encoded.slice("base64url:".length);
  const bytes = Buffer.from(payload, "base64url");
  if (bytes.toString("base64url") !== payload || bytes.byteLength > 8_388_608) {
    codes.add("invalid_utf8");
    return undefined;
  }
  try {
    return {
      bytes,
      text: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    };
  } catch {
    codes.add("invalid_utf8");
    return undefined;
  }
}

export async function scanStrongVerificationDetailV1(
  inputValue: StrongRecordVerificationInputV1,
  equalityAuthority: StrongVerificationOwnerKeyAuthorityV1,
): Promise<StrongVerificationDetailScanResultV1> {
  const input = StrongRecordVerificationInputV1Schema.parse(inputValue);
  const detailFields: StrongVerificationPreparationV1["detailFields"] = [
    ...(input.command === undefined ? [] : ["command" as const]),
    ...(input.exitCode === undefined ? [] : ["exit_code" as const]),
    ...(input.durationMs === undefined ? [] : ["duration_ms" as const]),
    ...(input.summary === undefined ? [] : ["summary" as const]),
    ...(input.rawOutputBase64url === undefined ? [] : ["raw_output" as const]),
  ];
  const policyDigest = sha256(canonicalizeJson(SCAN_POLICY));
  const fullInputEqualityTag = await ownerCommit(
    equalityAuthority,
    "record-verification-full-input-v1",
    input,
  );
  if (detailFields.length === 0) {
    return {
      sensitiveRequestScanPolicyDigest: policyDigest,
      fullInputEqualityTag,
      detail: { status: "none" },
      detailFields,
    };
  }

  const codes = new Set<RedactionCode>();
  if (input.command !== undefined) {
    scanText(input.command.executable, codes);
    input.command.arguments.forEach((argument) => scanText(argument, codes));
    input.command.environmentKeys.forEach((key) => scanText(key, codes));
    const commandBytes = Buffer.byteLength(
      canonicalizeJson(input.command),
      "utf8",
    );
    if (commandBytes > SCAN_POLICY.maxCommandTotalBytes) {
      throw new RangeError("verification command exceeds normalized input budget");
    }
  }
  if (input.summary !== undefined) scanText(input.summary, codes);
  const raw = input.rawOutputBase64url === undefined
    ? undefined
    : decodeRawOutput(input.rawOutputBase64url, codes);
  if (raw !== undefined) scanText(raw.text, codes);

  if (codes.size !== 0) {
    return {
      sensitiveRequestScanPolicyDigest: policyDigest,
      fullInputEqualityTag,
      detail: {
        status: "redacted",
        redactionCodes: REDACTION_ORDER.filter((code) => codes.has(code)),
      },
      detailFields,
    };
  }

  const ownerOnlyDetail = StrongVerificationOwnerOnlyDetailV1Schema.parse({
    ...(input.command === undefined ? {} : { command: input.command }),
    ...(input.exitCode === undefined ? {} : { exitCode: input.exitCode }),
    ...(input.durationMs === undefined ? {} : { durationMs: input.durationMs }),
    ...(raw === undefined ? {} : { outputDigest: sha256(raw.bytes) }),
  });
  return {
    sensitiveRequestScanPolicyDigest: policyDigest,
    fullInputEqualityTag,
    ownerOnlyDetailCommitment: KeyedStateTokenV1Schema.parse(
      await ownerCommit(
        equalityAuthority,
        "verification-detail-semantic-v1",
        ownerOnlyDetail,
      ),
    ),
    detail: { status: "stored" },
    detailFields,
    ownerOnlyDetail,
  };
}
