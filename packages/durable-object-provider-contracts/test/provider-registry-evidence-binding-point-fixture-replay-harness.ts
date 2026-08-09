import { Buffer } from "node:buffer";
import {
  createPublicKey,
  verify as verifyEd25519WithNodeCrypto,
} from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

import {
  PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_GOLDEN_RESOURCE_PATH_V1,
  PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_RESOURCE_PATH_V1,
  PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_SHARD_SIZE_V1,
  executeProviderRegistryEvidenceBindingPointInvalidCaseV1,
  materializeProviderRegistryEvidenceBindingPointInvalidCaseV1,
  verifyProviderRegistryEvidenceBindingPointGoldenResourceV1,
  verifyProviderRegistryEvidenceBindingPointInvalidResourceV1,
} from "../src/provider-registry-evidence-binding-point-fixtures.js";
import {
  PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1,
  PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
  attestProviderStrictEd25519CryptoHostV1,
  type ProviderStrictEd25519OpaqueCapabilityV1,
} from "../src/strict-ed25519-conformance.js";
import {
  STRICT_ED25519_VERIFICATION_PROFILE_V1,
  validatePrimeSubgroupPoint,
} from "../src/strict-ed25519.js";

const REPLAY_LANE_RANGES_V1 = Object.freeze([
  Object.freeze([0, 96] as const),
  Object.freeze([96, 192] as const),
  Object.freeze([192, 288] as const),
  Object.freeze([288, 354] as const),
]);
const NODE_ED25519_SPKI_PREFIX_V1 = Buffer.from(
  "302a300506032b6570032100",
  "hex",
);
const nodeEd25519PublicKeysV1 = new Map<
  string,
  ReturnType<typeof createPublicKey>
>();
const nodeEd25519PublicKeyAdmissionsV1 = new Map<string, boolean>();

function verifyRawEd25519WithAttestedNodeHostV1(
  publicKey: Uint8Array,
  message: Uint8Array,
  signature: Uint8Array,
  publicKeyAdmissionCacheEnabled: boolean,
): boolean {
  if (
    publicKey.byteLength !== 32 ||
    signature.byteLength !== 64
  ) {
    return false;
  }
  const cacheKey = Buffer.from(publicKey).toString("hex");
  let publicKeyAdmitted: boolean;
  if (
    publicKeyAdmissionCacheEnabled &&
    nodeEd25519PublicKeyAdmissionsV1.has(cacheKey)
  ) {
    publicKeyAdmitted = nodeEd25519PublicKeyAdmissionsV1.get(cacheKey)!;
  } else {
    publicKeyAdmitted = validatePrimeSubgroupPoint(publicKey);
    if (publicKeyAdmissionCacheEnabled) {
      nodeEd25519PublicKeyAdmissionsV1.set(cacheKey, publicKeyAdmitted);
    }
  }
  try {
    let key = nodeEd25519PublicKeysV1.get(cacheKey);
    if (key === undefined) {
      const subjectPublicKeyInfo = Buffer.concat([
        NODE_ED25519_SPKI_PREFIX_V1,
        Buffer.from(publicKey),
      ]);
      key = createPublicKey({
        key: subjectPublicKeyInfo,
        format: "der",
        type: "spki",
      });
      nodeEd25519PublicKeysV1.set(cacheKey, key);
    }
    const nativeResult = verifyEd25519WithNodeCrypto(
      null,
      message,
      key,
      signature,
    );
    return publicKeyAdmitted && nativeResult;
  } catch {
    return false;
  }
}

interface ProviderRegistryEvidenceBindingPointReplayLaneV1 {
  readonly laneIndex: 0 | 1 | 2 | 3;
  readonly startCaseIndex: number;
  readonly endCaseIndexExclusive: number;
}

function resourceBytes(relativePath: string): Uint8Array {
  return new Uint8Array(
    readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url))),
  );
}

function assertRecursivelyFrozen(
  value: object,
  seen = new Set<object>(),
): void {
  if (seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) {
    if (child !== null && typeof child === "object") {
      assertRecursivelyFrozen(child, seen);
    }
  }
}

export function registerProviderRegistryEvidenceBindingPointReplayLaneV1(
  lane: ProviderRegistryEvidenceBindingPointReplayLaneV1,
): void {
  const expectedRange = REPLAY_LANE_RANGES_V1[lane.laneIndex];
  if (
    expectedRange === undefined ||
    lane.startCaseIndex !== expectedRange[0] ||
    lane.endCaseIndexExclusive !== expectedRange[1]
  ) {
    throw new TypeError("invalid binding-point replay lane range");
  }

  const goldenBytes = resourceBytes(
    PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_GOLDEN_RESOURCE_PATH_V1,
  );
  const invalidBytes = resourceBytes(
    PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_RESOURCE_PATH_V1,
  );
  const strictManifestBytes = resourceBytes(
    PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
  );
  const firstShardIndex = Math.floor(
    lane.startCaseIndex /
      PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_SHARD_SIZE_V1,
  );
  const endShardIndexExclusive = Math.ceil(
    lane.endCaseIndexExclusive /
      PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_SHARD_SIZE_V1,
  );
  const shardIndexes = Array.from(
    { length: endShardIndexExclusive - firstShardIndex },
    (_, index) => firstShardIndex + index,
  );

  let pointCalls = 0;
  let signatureCalls = 0;
  let signatureHostAdmissionCacheEnabled = false;
  let capability: ProviderStrictEd25519OpaqueCapabilityV1;
  let golden: ReturnType<
    typeof verifyProviderRegistryEvidenceBindingPointGoldenResourceV1
  >;
  let invalid: ReturnType<
    typeof verifyProviderRegistryEvidenceBindingPointInvalidResourceV1
  >;

  beforeAll(async () => {
    capability = await attestProviderStrictEd25519CryptoHostV1({
      host: Object.freeze({
        verificationProfile: STRICT_ED25519_VERIFICATION_PROFILE_V1,
        validatePrimeSubgroupPoint(point: Uint8Array) {
          pointCalls += 1;
          return validatePrimeSubgroupPoint(point);
        },
        async verifyRawEd25519(
          publicKey: Uint8Array,
          message: Uint8Array,
          signature: Uint8Array,
        ) {
          signatureCalls += 1;
          return verifyRawEd25519WithAttestedNodeHostV1(
            publicKey,
            message,
            signature,
            signatureHostAdmissionCacheEnabled,
          );
        },
      }),
      resourceHost: Object.freeze({
        readFixedSignedPackageResource(path: string, maxBytes: number) {
          if (
            path !== PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1 ||
            maxBytes !== PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1
          ) {
            throw new TypeError("unexpected strict Ed25519 resource request");
          }
          return strictManifestBytes;
        },
      }),
    });
    signatureHostAdmissionCacheEnabled = true;
    pointCalls = 0;
    signatureCalls = 0;
    golden =
      verifyProviderRegistryEvidenceBindingPointGoldenResourceV1(goldenBytes);
    invalid =
      verifyProviderRegistryEvidenceBindingPointInvalidResourceV1(invalidBytes);
  });

  describe(`provider Registry Entry/Evidence binding point replay lane ${lane.laneIndex}`, () => {
    it.each(shardIndexes)(
      "fresh-materializes and replays exact shard %i",
      async (shardIndex) => {
        const shard = invalid.shards[shardIndex];
        expect(shard).toBeDefined();
        const expectedStart = Math.max(
          lane.startCaseIndex,
          shardIndex *
            PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_SHARD_SIZE_V1,
        );
        const expectedEnd = Math.min(
          lane.endCaseIndexExclusive,
          expectedStart +
            PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_SHARD_SIZE_V1,
        );
        expect(shard).toMatchObject({
          shardIndex,
          startCaseIndex: expectedStart,
          endCaseIndexExclusive: expectedEnd,
          caseCount: expectedEnd - expectedStart,
        });
        expect(
          invalid.cases
            .slice(expectedStart, expectedEnd)
            .map(({ caseId }) => caseId),
        ).toEqual(invalid.caseIds.slice(expectedStart, expectedEnd));

        for (
          let caseIndex = expectedStart;
          caseIndex < expectedEnd;
          caseIndex += 1
        ) {
          const caseId = invalid.caseIds[caseIndex];
          const invalidCase = invalid.cases[caseIndex];
          expect(caseId).toBeDefined();
          expect(invalidCase?.caseId, caseId).toBe(caseId);
          const prepared =
            materializeProviderRegistryEvidenceBindingPointInvalidCaseV1(
              golden,
              invalidCase!,
              capability,
            );
          expect(Object.getPrototypeOf(prepared), caseId).toBe(null);
          expect(Object.isFrozen(prepared), caseId).toBe(true);

          pointCalls = 0;
          signatureCalls = 0;
          const execution =
            await executeProviderRegistryEvidenceBindingPointInvalidCaseV1(
              golden,
              invalidCase!,
              capability,
              {
                readPointAdmissionCount: () => pointCalls,
                readSignatureVerificationCount: () => signatureCalls,
              },
            );
          expect(Object.getPrototypeOf(execution), caseId).toBe(null);
          expect(Object.isFrozen(execution), caseId).toBe(true);

          const expected = invalidCase!.outerExpected;
          expect(execution.pointAdmissionCount, caseId).toBe(
            expected.pointAdmissionCount,
          );
          expect(execution.signatureVerificationCount, caseId).toBe(
            expected.signatureVerificationCount,
          );
          if (expected.kind === "diagnostic") {
            expect(execution, caseId).toMatchObject({
              kind: "rejection",
              boundary: "internal_diagnostic",
              stage: expected.stage,
              reason: expected.reason,
              publicFailure: {
                errorName:
                  "ProviderRegistryEvidenceBindingPointClosureValidationError",
                code: "provider_unavailable",
                reason: "attestation_invalid",
              },
            });
          } else {
            expect(execution, caseId).toMatchObject({
              kind: "snapshot_acceptance",
              boundary: "snapshot_stability",
              authority: expected.authority,
              snapshotProjection: expected.snapshotProjection,
            });
            if (execution.kind === "snapshot_acceptance") {
              expect(Object.getPrototypeOf(execution.closure), caseId).toBe(
                null,
              );
              assertRecursivelyFrozen(execution.closure);
            }
          }
        }

        // Give the Vitest fork transport one macrotask between CPU-heavy
        // shards; this is not a timeout increase and keeps RPC progress live.
        await new Promise<void>((resolve) => setImmediate(resolve));
      },
      60_000,
    );
  });
}
