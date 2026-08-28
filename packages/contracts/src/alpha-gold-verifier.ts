import { canonicalizeJson } from "./canonical-json.js";
import {
  Step16DualHostEligibleEvidenceV1Schema,
  type Step16DualHostEligibleEvidenceV1,
} from "./alpha-gold.js";

const STEP16_GOLD_ROOT_VERIFICATION_DOMAIN_V1 =
  "understand-code-step16-gold-receipt-root-verification-v1";

const ED25519_SPKI_DER_PREFIX_V1 = new Uint8Array([
  0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
]);

const BASE64_ALPHABET_V1 =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

const ROOT_VERIFICATION_PLACEHOLDER_V1 = {
  profile: "step16_gold_receipt_root_verification_v1",
  status: "verified",
  verifierKeyId: `ed25519-spki-sha256:${"0".repeat(64)}`,
  receiptInventoryDigest: `sha256:${"0".repeat(64)}`,
  signature: `ed25519:${"0".repeat(128)}`,
} as const;

interface PortableSubtleCryptoV1 {
  digest(algorithm: "SHA-256", data: Uint8Array): Promise<ArrayBuffer>;
  importKey(
    format: "spki",
    keyData: Uint8Array,
    algorithm: { readonly name: "Ed25519" },
    extractable: false,
    keyUsages: readonly ["verify"],
  ): Promise<unknown>;
  verify(
    algorithm: { readonly name: "Ed25519" },
    key: unknown,
    signature: Uint8Array,
    data: Uint8Array,
  ): Promise<boolean>;
}

type Step16GoldProofV1 = Step16DualHostEligibleEvidenceV1["proof"];

export type Step16GoldReceiptInventoryV1 = Omit<
  Step16DualHostEligibleEvidenceV1,
  "proof"
> & {
  proof: Omit<Step16GoldProofV1, "rootVerification">;
};

export type Step16GoldEd25519SignerV1 = (
  message: Uint8Array,
) => Uint8Array | Promise<Uint8Array>;

export interface AssembleStep16DualHostEligibleEvidenceV1Input {
  readonly receiptInventory: unknown;
  readonly trustedVerifierPublicKeySpkiBase64: string;
  readonly signer: Step16GoldEd25519SignerV1;
}

/** Opaque failure for the signing boundary; no candidate evidence is returned. */
export class Step16GoldClosingVerificationError extends Error {
  constructor() {
    super("Step 16 Gold closing verification failed");
    this.name = "Step16GoldClosingVerificationError";
  }
}

function portableSubtleCryptoV1(): PortableSubtleCryptoV1 {
  const crypto = (globalThis as unknown as {
    readonly crypto?: { readonly subtle?: PortableSubtleCryptoV1 };
  }).crypto;
  if (crypto?.subtle === undefined) {
    throw new TypeError("Web Crypto is unavailable");
  }
  return crypto.subtle;
}

function decodeCanonicalEd25519SpkiBase64V1(value: unknown): Uint8Array {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9+/]{59}=$/u.test(value)
  ) {
    throw new TypeError("trusted verifier SPKI must be canonical base64");
  }

  const bytes = new Uint8Array(44);
  let outputIndex = 0;
  for (let inputIndex = 0; inputIndex < value.length; inputIndex += 4) {
    const first = BASE64_ALPHABET_V1.indexOf(value[inputIndex] ?? "");
    const second = BASE64_ALPHABET_V1.indexOf(value[inputIndex + 1] ?? "");
    const thirdCharacter = value[inputIndex + 2] ?? "";
    const fourthCharacter = value[inputIndex + 3] ?? "";
    const third = thirdCharacter === "="
      ? 0
      : BASE64_ALPHABET_V1.indexOf(thirdCharacter);
    const fourth = fourthCharacter === "="
      ? 0
      : BASE64_ALPHABET_V1.indexOf(fourthCharacter);
    if (first < 0 || second < 0 || third < 0 || fourth < 0) {
      throw new TypeError("trusted verifier SPKI must be canonical base64");
    }

    bytes[outputIndex] = (first << 2) | (second >> 4);
    outputIndex += 1;
    if (thirdCharacter !== "=") {
      bytes[outputIndex] = ((second & 0x0f) << 4) | (third >> 2);
      outputIndex += 1;
    }
    if (fourthCharacter !== "=") {
      bytes[outputIndex] = ((third & 0x03) << 6) | fourth;
      outputIndex += 1;
    }
  }
  if (outputIndex !== bytes.length || (BASE64_ALPHABET_V1.indexOf(
    value[value.length - 2] ?? "",
  ) & 0x03) !== 0) {
    throw new TypeError("trusted verifier SPKI must be canonical base64");
  }
  for (let index = 0; index < ED25519_SPKI_DER_PREFIX_V1.length; index += 1) {
    if (bytes[index] !== ED25519_SPKI_DER_PREFIX_V1[index]) {
      throw new TypeError("trusted verifier key must be canonical Ed25519 SPKI");
    }
  }
  return bytes;
}

function encodeUtf8V1(value: string): Uint8Array {
  const bytes: number[] = [];
  for (let index = 0; index < value.length; index += 1) {
    let codePoint = value.charCodeAt(index);
    if (codePoint >= 0xd800 && codePoint <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        codePoint = 0x10000 + ((codePoint - 0xd800) << 10) + next - 0xdc00;
        index += 1;
      } else {
        codePoint = 0xfffd;
      }
    } else if (codePoint >= 0xdc00 && codePoint <= 0xdfff) {
      codePoint = 0xfffd;
    }

    if (codePoint <= 0x7f) {
      bytes.push(codePoint);
    } else if (codePoint <= 0x7ff) {
      bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint <= 0xffff) {
      bytes.push(
        0xe0 | (codePoint >> 12),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    } else {
      bytes.push(
        0xf0 | (codePoint >> 18),
        0x80 | ((codePoint >> 12) & 0x3f),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    }
  }
  return new Uint8Array(bytes);
}

function bytesToLowerHexV1(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function lowerHexToBytesV1(value: string): Uint8Array {
  if (!/^[0-9a-f]{128}$/u.test(value)) {
    throw new TypeError("Ed25519 signature must be canonical lower hex");
  }
  const bytes = new Uint8Array(64);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

async function sha256HexV1(bytes: Uint8Array): Promise<string> {
  const digest = await portableSubtleCryptoV1().digest("SHA-256", bytes.slice());
  const digestBytes = new Uint8Array(digest);
  if (digestBytes.length !== 32) {
    throw new TypeError("Web Crypto returned an invalid SHA-256 digest");
  }
  return bytesToLowerHexV1(digestBytes);
}

async function trustedEd25519PublicKeyV1(spkiBase64: string): Promise<{
  readonly key: unknown;
  readonly keyId: string;
  readonly subtle: PortableSubtleCryptoV1;
}> {
  const der = decodeCanonicalEd25519SpkiBase64V1(spkiBase64);
  const subtle = portableSubtleCryptoV1();
  const [key, digest] = await Promise.all([
    subtle.importKey(
      "spki",
      der.slice(),
      { name: "Ed25519" },
      false,
      ["verify"],
    ),
    sha256HexV1(der),
  ]);
  return {
    key,
    keyId: `ed25519-spki-sha256:${digest}`,
    subtle,
  };
}

function parseStep16GoldReceiptInventoryV1(
  value: unknown,
): Step16GoldReceiptInventoryV1 {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("receipt inventory must be an object");
  }
  const candidate = value as Record<string, unknown>;
  const proof = candidate.proof;
  if (proof === null || typeof proof !== "object" || Array.isArray(proof)) {
    throw new TypeError("receipt inventory proof must be an object");
  }
  if (Object.prototype.hasOwnProperty.call(proof, "rootVerification")) {
    throw new TypeError("receipt inventory must not contain root verification");
  }

  const parsed = Step16DualHostEligibleEvidenceV1Schema.parse({
    ...candidate,
    proof: {
      ...(proof as Record<string, unknown>),
      rootVerification: ROOT_VERIFICATION_PLACEHOLDER_V1,
    },
  });
  return step16GoldReceiptInventoryV1(parsed);
}

/**
 * Returns the complete receipt inventory covered by the closing signature.
 * This strips only the signature receipt and does not assert execution or Gold.
 */
export function step16GoldReceiptInventoryV1(
  evidence: unknown,
): Step16GoldReceiptInventoryV1 {
  const parsed = Step16DualHostEligibleEvidenceV1Schema.parse(evidence);
  const { rootVerification: _rootVerification, ...proof } = parsed.proof;
  return {
    ...parsed,
    proof,
  };
}

export async function deriveStep16GoldVerifierKeyIdV1(
  spkiBase64: string,
): Promise<string> {
  return (await trustedEd25519PublicKeyV1(spkiBase64)).keyId;
}

export async function deriveStep16GoldReceiptInventoryDigestV1(
  evidence: unknown,
): Promise<string> {
  return `sha256:${await sha256HexV1(encodeUtf8V1(canonicalizeJson(
    step16GoldReceiptInventoryV1(evidence),
  )))}`;
}

export function createStep16GoldRootVerificationMessageV1(
  verifierKeyId: string,
  receiptInventoryDigest: string,
): string {
  return canonicalizeJson([
    STEP16_GOLD_ROOT_VERIFICATION_DOMAIN_V1,
    verifierKeyId,
    receiptInventoryDigest,
  ]);
}

/** Returns false for every malformed, incomplete, untrusted, or forged input. */
export async function verifyStep16DualHostEligibleEvidenceV1(
  evidence: unknown,
  trustedVerifierPublicKeySpkiBase64: string,
): Promise<boolean> {
  try {
    const parsed = Step16DualHostEligibleEvidenceV1Schema.parse(evidence);
    const trusted = await trustedEd25519PublicKeyV1(
      trustedVerifierPublicKeySpkiBase64,
    );
    const receipt = parsed.proof.rootVerification;
    if (receipt.verifierKeyId !== trusted.keyId) return false;

    const expectedInventoryDigest =
      await deriveStep16GoldReceiptInventoryDigestV1(parsed);
    if (receipt.receiptInventoryDigest !== expectedInventoryDigest) {
      return false;
    }
    const signature = lowerHexToBytesV1(
      receipt.signature.slice("ed25519:".length),
    );
    return await trusted.subtle.verify(
      { name: "Ed25519" },
      trusted.key,
      signature,
      encodeUtf8V1(createStep16GoldRootVerificationMessageV1(
        receipt.verifierKeyId,
        receipt.receiptInventoryDigest,
      )),
    ) === true;
  } catch {
    return false;
  }
}

/**
 * Assembles a cryptographically closed eligible transport from caller-supplied
 * receipts. The external signer owns the private key and the truth of those
 * receipts; this helper neither executes a task nor establishes Gold status.
 */
export async function assembleStep16DualHostEligibleEvidenceV1(
  input: AssembleStep16DualHostEligibleEvidenceV1Input,
): Promise<Step16DualHostEligibleEvidenceV1> {
  try {
    if (typeof input.signer !== "function") {
      throw new TypeError("signer must be a function");
    }
    const inventory = parseStep16GoldReceiptInventoryV1(input.receiptInventory);
    const trusted = await trustedEd25519PublicKeyV1(
      input.trustedVerifierPublicKeySpkiBase64,
    );
    const inventoryCandidate = Step16DualHostEligibleEvidenceV1Schema.parse({
      ...inventory,
      proof: {
        ...inventory.proof,
        rootVerification: ROOT_VERIFICATION_PLACEHOLDER_V1,
      },
    });
    const receiptInventoryDigest =
      await deriveStep16GoldReceiptInventoryDigestV1(inventoryCandidate);
    const message = encodeUtf8V1(createStep16GoldRootVerificationMessageV1(
      trusted.keyId,
      receiptInventoryDigest,
    ));
    const signerResult = await input.signer(message.slice());
    if (!(signerResult instanceof Uint8Array)) {
      throw new TypeError("signer must return a Uint8Array");
    }
    const signature = new Uint8Array(signerResult);
    if (signature.length !== 64) {
      throw new TypeError("signer must return a 64-byte Ed25519 signature");
    }
    if (!await trusted.subtle.verify(
      { name: "Ed25519" },
      trusted.key,
      signature,
      message,
    )) {
      throw new TypeError("signer returned an invalid signature");
    }

    const assembled = Step16DualHostEligibleEvidenceV1Schema.parse({
      ...inventory,
      proof: {
        ...inventory.proof,
        rootVerification: {
          profile: "step16_gold_receipt_root_verification_v1",
          status: "verified",
          verifierKeyId: trusted.keyId,
          receiptInventoryDigest,
          signature: `ed25519:${bytesToLowerHexV1(signature)}`,
        },
      },
    });
    if (!await verifyStep16DualHostEligibleEvidenceV1(
      assembled,
      input.trustedVerifierPublicKeySpkiBase64,
    )) {
      throw new TypeError("assembled evidence did not verify");
    }
    return assembled;
  } catch {
    throw new Step16GoldClosingVerificationError();
  }
}
