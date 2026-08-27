import type { Step16DualHostEligibleEvidenceV1 } from "../src/alpha-gold.js";

export function deriveStep16GoldVerifierKeyIdV1(spkiBase64: string): string;
export function step16GoldReceiptInventoryV1(
  evidence: Step16DualHostEligibleEvidenceV1,
): unknown;
export function deriveStep16GoldReceiptInventoryDigestV1(
  evidence: Step16DualHostEligibleEvidenceV1,
): string;
export function createStep16GoldRootVerificationMessageV1(
  verifierKeyId: string,
  receiptInventoryDigest: string,
): string;
export function verifyStep16DualHostEligibleEvidenceV1(
  evidence: unknown,
  trustedVerifierPublicKeySpkiBase64: string,
): boolean;
