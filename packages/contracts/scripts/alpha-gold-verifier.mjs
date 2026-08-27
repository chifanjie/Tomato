import {
  createHash,
  createPublicKey,
  verify as verifySignature,
} from "node:crypto";

import { canonicalizeJson } from "../dist/canonical-json.js";
import {
  Step16DualHostEligibleEvidenceV1Schema,
} from "../dist/alpha-gold.js";

const VERIFICATION_DOMAIN =
  "understand-code-step16-gold-receipt-root-verification-v1";

function trustedEd25519PublicKey(spkiBase64) {
  const der = Buffer.from(spkiBase64, "base64");
  if (der.length === 0 || der.toString("base64") !== spkiBase64) {
    throw new TypeError("trusted verifier SPKI must be canonical base64");
  }
  const key = createPublicKey({ key: der, format: "der", type: "spki" });
  if (key.asymmetricKeyType !== "ed25519") {
    throw new TypeError("trusted verifier key must be Ed25519");
  }
  return { der, key };
}

export function deriveStep16GoldVerifierKeyIdV1(spkiBase64) {
  const { der } = trustedEd25519PublicKey(spkiBase64);
  return `ed25519-spki-sha256:${createHash("sha256").update(der).digest("hex")}`;
}

export function step16GoldReceiptInventoryV1(evidence) {
  const parsed = Step16DualHostEligibleEvidenceV1Schema.parse(evidence);
  const { rootVerification: _rootVerification, ...proof } = parsed.proof;
  return {
    ...parsed,
    proof,
  };
}

export function deriveStep16GoldReceiptInventoryDigestV1(evidence) {
  return `sha256:${createHash("sha256")
    .update(canonicalizeJson(step16GoldReceiptInventoryV1(evidence)))
    .digest("hex")}`;
}

export function createStep16GoldRootVerificationMessageV1(
  verifierKeyId,
  receiptInventoryDigest,
) {
  return canonicalizeJson([
    VERIFICATION_DOMAIN,
    verifierKeyId,
    receiptInventoryDigest,
  ]);
}

export function verifyStep16DualHostEligibleEvidenceV1(
  evidence,
  trustedVerifierPublicKeySpkiBase64,
) {
  const parsed = Step16DualHostEligibleEvidenceV1Schema.safeParse(evidence);
  if (!parsed.success) return false;
  try {
    const { key } = trustedEd25519PublicKey(
      trustedVerifierPublicKeySpkiBase64,
    );
    const expectedKeyId = deriveStep16GoldVerifierKeyIdV1(
      trustedVerifierPublicKeySpkiBase64,
    );
    const receipt = parsed.data.proof.rootVerification;
    if (receipt.verifierKeyId !== expectedKeyId) return false;
    const expectedInventoryDigest =
      deriveStep16GoldReceiptInventoryDigestV1(parsed.data);
    if (receipt.receiptInventoryDigest !== expectedInventoryDigest) {
      return false;
    }
    return verifySignature(
      null,
      Buffer.from(createStep16GoldRootVerificationMessageV1(
        receipt.verifierKeyId,
        receipt.receiptInventoryDigest,
      )),
      key,
      Buffer.from(receipt.signature.slice("ed25519:".length), "hex"),
    );
  } catch {
    return false;
  }
}
