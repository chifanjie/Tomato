import * as root from "@understand-code/durable-object-provider-contracts";
import * as bindingPoint from "@understand-code/durable-object-provider-contracts/provider-registry-evidence-binding-point";
import * as bindingFixtures from "@understand-code/durable-object-provider-contracts/provider-registry-evidence-binding-point-fixtures";
import { canonicalizeJcsSafeIntegerUtf8V1 } from "@understand-code/durable-object-provider-contracts/jcs";
import { validateProviderRegistryManifestHistoryV1 } from "@understand-code/durable-object-provider-contracts/provider-registry";
import {
  STRICT_ED25519_VERIFICATION_PROFILE_V1,
  validatePrimeSubgroupPoint,
  verifyRawEd25519,
} from "@understand-code/durable-object-provider-contracts/strict-ed25519";
import {
  PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1,
  PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
  attestProviderStrictEd25519CryptoHostV1,
} from "@understand-code/durable-object-provider-contracts/strict-ed25519-conformance";

export const C09_DISTRIBUTION_REPLAY_PROFILE_V1 =
  "provider_registry_evidence_binding_distribution_replay_v1";
export const C09_DISTRIBUTION_REPLAY_LANES_V1 = Object.freeze([
  Object.freeze({ laneIndex: 0, startCaseIndex: 0, endCaseIndexExclusive: 96 }),
  Object.freeze({ laneIndex: 1, startCaseIndex: 96, endCaseIndexExclusive: 192 }),
  Object.freeze({ laneIndex: 2, startCaseIndex: 192, endCaseIndexExclusive: 288 }),
  Object.freeze({ laneIndex: 3, startCaseIndex: 288, endCaseIndexExclusive: 354 }),
]);

const EVIDENCE_ADAPTER_MATERIALIZED_REQUEST_DOMAIN_V1 =
  "provider-registry-evidence-binding-point-evidence-adapter-materialized-request-v1";
const REGISTRY_ADAPTER_MATERIALIZED_REQUEST_DOMAIN_V1 =
  "provider-registry-evidence-binding-point-registry-adapter-materialized-request-v1";
const EVIDENCE_CAPABILITY_SENTINEL_V1 = Object.freeze({
  profile:
    "provider_registry_evidence_binding_evidence_adapter_capability_sentinel_v1",
});
const REGISTRY_CAPABILITY_SENTINEL_V1 = Object.freeze({
  profile:
    "provider_registry_evidence_binding_registry_adapter_capability_sentinel_v1",
});

function assertPlainReplayInputV1(value, label) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Reflect.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new TypeError(`${label} is not a plain object`);
  }
  return value;
}

function assertExactPublicIdentityV1() {
  if (
    typeof validateProviderRegistryManifestHistoryV1 !== "function" ||
    root.validateProviderRegistryManifestHistoryV1 !==
      validateProviderRegistryManifestHistoryV1
  ) {
    throw new Error("C09 distribution replay lost Registry history registration");
  }
  const identities = [
    [
      root.validateProviderRegistryEvidenceBindingPointClosureV1,
      bindingPoint.validateProviderRegistryEvidenceBindingPointClosureV1,
    ],
    [
      root.diagnoseProviderRegistryEvidenceBindingPointClosureV1,
      bindingPoint.diagnoseProviderRegistryEvidenceBindingPointClosureV1,
    ],
    [
      root.ProviderRegistryEvidenceBindingPointClosureValidationError,
      bindingPoint.ProviderRegistryEvidenceBindingPointClosureValidationError,
    ],
    [
      root.verifyProviderRegistryEvidenceBindingPointGoldenResourceV1,
      bindingFixtures.verifyProviderRegistryEvidenceBindingPointGoldenResourceV1,
    ],
    [
      root.verifyProviderRegistryEvidenceBindingPointInvalidResourceV1,
      bindingFixtures.verifyProviderRegistryEvidenceBindingPointInvalidResourceV1,
    ],
    [
      root.materializeProviderRegistryEvidenceBindingPointGoldenRequestV1,
      bindingFixtures.materializeProviderRegistryEvidenceBindingPointGoldenRequestV1,
    ],
    [
      root.materializeProviderRegistryEvidenceBindingPointInvalidCaseV1,
      bindingFixtures.materializeProviderRegistryEvidenceBindingPointInvalidCaseV1,
    ],
    [
      root.executeProviderRegistryEvidenceBindingPointInvalidCaseV1,
      bindingFixtures.executeProviderRegistryEvidenceBindingPointInvalidCaseV1,
    ],
  ];
  if (identities.some(([left, right]) => left !== right)) {
    throw new Error("C09 distribution replay root/subpath identities diverged");
  }
}

function bytesToLowerHexV1(bytes) {
  let output = "";
  for (const byte of bytes) output += byte.toString(16).padStart(2, "0");
  return output;
}

async function semanticDigestV1(domain, value) {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    canonicalizeJcsSafeIntegerUtf8V1([domain, value]),
  );
  return `sha256:${bytesToLowerHexV1(new Uint8Array(digest))}`;
}

function canonicalEqualV1(left, right) {
  const leftBytes = canonicalizeJcsSafeIntegerUtf8V1(left);
  const rightBytes = canonicalizeJcsSafeIntegerUtf8V1(right);
  if (leftBytes.byteLength !== rightBytes.byteLength) return false;
  for (let index = 0; index < leftBytes.byteLength; index += 1) {
    if (leftBytes[index] !== rightBytes[index]) return false;
  }
  return true;
}

function snapshotMaterializedValueV1(value, recursion, completedSnapshots) {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
      throw new TypeError("materialized request has a non-JCS number");
    }
    return value;
  }
  if (typeof value !== "object" || recursion.has(value)) {
    throw new TypeError("materialized request has a non-data cycle");
  }
  const completed = completedSnapshots.get(value);
  if (completed !== undefined) return completed;
  const isArray = Array.isArray(value);
  const prototype = Reflect.getPrototypeOf(value);
  if (
    (isArray && prototype !== Array.prototype) ||
    (!isArray && prototype !== Object.prototype && prototype !== null)
  ) {
    throw new TypeError("materialized request has a non-data prototype");
  }
  recursion.add(value);
  try {
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Object.getOwnPropertySymbols(value).length !== 0) {
      throw new TypeError("materialized request has a symbol key");
    }
    if (isArray) {
      const lengthDescriptor = descriptors.length;
      const length = lengthDescriptor?.value;
      if (
        lengthDescriptor === undefined ||
        !("value" in lengthDescriptor) ||
        lengthDescriptor.enumerable !== false ||
        !Number.isSafeInteger(length) ||
        length < 0
      ) {
        throw new TypeError("materialized request has an invalid array");
      }
      for (const key of Object.keys(descriptors)) {
        if (key === "length") continue;
        const index = Number(key);
        const descriptor = descriptors[key];
        if (
          !Number.isSafeInteger(index) ||
          index < 0 ||
          index >= length ||
          String(index) !== key ||
          descriptor === undefined ||
          !("value" in descriptor) ||
          descriptor.enumerable !== true
        ) {
          throw new TypeError(
            "materialized request array requires indexed data properties",
          );
        }
      }
      const output = [];
      for (let index = 0; index < length; index += 1) {
        const descriptor = descriptors[String(index)];
        output.push(
          descriptor === undefined
            ? { fixtureInvalidArrayHole: true }
            : snapshotMaterializedValueV1(
                descriptor.value,
                recursion,
                completedSnapshots,
              ),
        );
      }
      completedSnapshots.set(value, output);
      return output;
    }
    const output = {};
    for (const key of Object.keys(descriptors).sort()) {
      const descriptor = descriptors[key];
      if (
        descriptor === undefined ||
        !("value" in descriptor) ||
        descriptor.enumerable !== true
      ) {
        throw new TypeError("materialized request requires data properties");
      }
      output[key] = snapshotMaterializedValueV1(
        descriptor.value,
        recursion,
        completedSnapshots,
      );
    }
    completedSnapshots.set(value, output);
    return output;
  } finally {
    recursion.delete(value);
  }
}

function projectMaterializedRequestV1(request, capabilitySentinel) {
  if (
    request === null ||
    typeof request !== "object" ||
    Array.isArray(request) ||
    (Reflect.getPrototypeOf(request) !== Object.prototype &&
      Reflect.getPrototypeOf(request) !== null) ||
    Object.getOwnPropertySymbols(request).length !== 0
  ) {
    throw new TypeError("materialized outer request must be a data object");
  }
  const descriptors = Object.getOwnPropertyDescriptors(request);
  const projectedRequest = {};
  const recursion = new WeakSet();
  const completedSnapshots = new WeakMap();
  for (const key of Object.keys(descriptors).sort()) {
    const descriptor = descriptors[key];
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      throw new TypeError("materialized outer request must be data-only");
    }
    projectedRequest[key] =
      key === "strictCryptoCapability"
        ? capabilitySentinel
        : snapshotMaterializedValueV1(
            descriptor.value,
            recursion,
            completedSnapshots,
          );
  }
  return projectedRequest;
}

async function deriveMaterializedRequestDigestV1(
  golden,
  invalidCase,
  prepared,
) {
  const witnessRecipe = invalidCase.mutation.witnessRecipe;
  if (invalidCase.group === "provider_feasibility_evidence_point") {
    if (
      witnessRecipe.kind === "execution_profile" &&
      invalidCase.caseId !==
        "evidence-runtime-inner-result-envelope-16mib-plus-one"
    ) {
      return semanticDigestV1(
        EVIDENCE_ADAPTER_MATERIALIZED_REQUEST_DOMAIN_V1,
        {
          caseId: invalidCase.caseId,
          executionProfile: witnessRecipe.profile,
          compatibleBaseSemanticContentDigest: golden.semanticContentDigest,
        },
      );
    }
    return semanticDigestV1(
      EVIDENCE_ADAPTER_MATERIALIZED_REQUEST_DOMAIN_V1,
      {
        profile:
          "provider_registry_evidence_binding_evidence_adapter_materialized_request_projection_v1",
        request: projectMaterializedRequestV1(
          prepared.request,
          EVIDENCE_CAPABILITY_SENTINEL_V1,
        ),
      },
    );
  }
  if (invalidCase.group === "provider_registry_manifest_history") {
    if (witnessRecipe.kind === "symbolic_budget") {
      return semanticDigestV1(
        bindingFixtures.PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1,
        { caseId: invalidCase.caseId, witnessRecipe },
      );
    }
    return semanticDigestV1(
      REGISTRY_ADAPTER_MATERIALIZED_REQUEST_DOMAIN_V1,
      {
        profile:
          "provider_registry_evidence_binding_registry_adapter_materialized_request_projection_v1",
        request: projectMaterializedRequestV1(
          prepared.request,
          REGISTRY_CAPABILITY_SENTINEL_V1,
        ),
      },
    );
  }
  if (invalidCase.group === "provider_registry_evidence_binding_point") {
    return semanticDigestV1(
      bindingFixtures.PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1,
      { caseId: invalidCase.caseId, witnessRecipe },
    );
  }
  throw new TypeError(`unknown C09 fixture group: ${invalidCase.group}`);
}

function assertFreshPreparedWitnessV1(first, second, caseId) {
  if (
    first === second ||
    first.request === second.request ||
    Reflect.getPrototypeOf(first) !== null ||
    Reflect.getPrototypeOf(second) !== null ||
    !Object.isFrozen(first) ||
    !Object.isFrozen(second)
  ) {
    throw new Error(`C09 replay reused a prepared witness: ${caseId}`);
  }
  const firstHistory = Object.getOwnPropertyDescriptor(
    first.request,
    "registryManifestHistory",
  );
  const secondHistory = Object.getOwnPropertyDescriptor(
    second.request,
    "registryManifestHistory",
  );
  if (
    firstHistory !== undefined &&
    secondHistory !== undefined &&
    "value" in firstHistory &&
    "value" in secondHistory &&
    firstHistory.value === secondHistory.value
  ) {
    throw new Error(`C09 replay reused Registry history: ${caseId}`);
  }
}

function observedOuterExpectedV1(invalidCase, execution, materializedDigest) {
  if (execution.kind === "rejection") {
    if (
      execution.boundary !== "internal_diagnostic" ||
      execution.publicFailure?.errorName !==
        "ProviderRegistryEvidenceBindingPointClosureValidationError" ||
      execution.publicFailure?.code !== "provider_unavailable" ||
      execution.publicFailure?.reason !== "attestation_invalid"
    ) {
      throw new Error(`C09 replay escaped its opaque boundary: ${invalidCase.caseId}`);
    }
    return {
      kind: "diagnostic",
      stage: execution.stage,
      reason: execution.reason,
      pointAdmissionCount: execution.pointAdmissionCount,
      signatureVerificationCount: execution.signatureVerificationCount,
      materializedRequestSemanticDigest: materializedDigest,
    };
  }
  if (execution.kind === "snapshot_acceptance") {
    const observed = {
      kind: "accepted_snapshot",
      boundary: execution.boundary,
      outcome: "accepted_frozen_snapshot",
      authority: execution.authority,
      snapshotProjection: execution.snapshotProjection,
      pointAdmissionCount: execution.pointAdmissionCount,
      signatureVerificationCount: execution.signatureVerificationCount,
      materializedRequestSemanticDigest: materializedDigest,
    };
    if (invalidCase.outerExpected.topologyRationale !== undefined) {
      observed.topologyRationale = invalidCase.outerExpected.topologyRationale;
    }
    return observed;
  }
  throw new Error(`C09 replay unexpectedly accepted: ${invalidCase.caseId}`);
}

function assertReplayLaneV1(laneIndex) {
  if (!Number.isSafeInteger(laneIndex)) {
    throw new TypeError("C09 replay lane index is invalid");
  }
  const lane = C09_DISTRIBUTION_REPLAY_LANES_V1[laneIndex];
  if (lane === undefined || lane.laneIndex !== laneIndex) {
    throw new TypeError(`C09 replay lane does not exist: ${laneIndex}`);
  }
  return lane;
}

export async function executeC09DistributionReplayLaneV1(input) {
  const parsed = assertPlainReplayInputV1(input, "C09 replay input");
  if (
    parsed.runtime !== "node" &&
    parsed.runtime !== "browser"
  ) {
    throw new TypeError("C09 replay runtime is invalid");
  }
  if (!/^[0-9a-f]{32}$/u.test(parsed.nonce)) {
    throw new TypeError("C09 replay nonce is invalid");
  }
  for (const [bytes, label] of [
    [parsed.goldenBytes, "golden"],
    [parsed.invalidBytes, "invalid"],
    [parsed.strictManifestBytes, "strict manifest"],
  ]) {
    if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) {
      throw new TypeError(`C09 replay ${label} bytes are invalid`);
    }
  }
  const lane = assertReplayLaneV1(parsed.laneIndex);
  assertExactPublicIdentityV1();

  let pointCalls = 0;
  let signatureCalls = 0;
  const capability = await attestProviderStrictEd25519CryptoHostV1({
    host: Object.freeze({
      verificationProfile: STRICT_ED25519_VERIFICATION_PROFILE_V1,
      validatePrimeSubgroupPoint(point) {
        pointCalls += 1;
        return validatePrimeSubgroupPoint(point);
      },
      verifyRawEd25519(publicKey, message, signature) {
        signatureCalls += 1;
        return verifyRawEd25519(publicKey, message, signature);
      },
    }),
    resourceHost: Object.freeze({
      readFixedSignedPackageResource(path, maxBytes) {
        if (
          path !== PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1 ||
          maxBytes !== PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1 ||
          parsed.strictManifestBytes.byteLength > maxBytes
        ) {
          throw new TypeError("C09 replay requested an unexpected fixed resource");
        }
        return parsed.strictManifestBytes;
      },
    }),
  });
  const golden =
    bindingFixtures.verifyProviderRegistryEvidenceBindingPointGoldenResourceV1(
      parsed.goldenBytes,
    );
  const invalid =
    bindingFixtures.verifyProviderRegistryEvidenceBindingPointInvalidResourceV1(
      parsed.invalidBytes,
    );
  if (
    invalid.caseCount !== 354 ||
    invalid.shardSize !== 32 ||
    invalid.maxWorkers !== 4 ||
    invalid.shards.length !== 12 ||
    invalid.caseIds.length !== 354 ||
    invalid.cases.length !== 354
  ) {
    throw new Error("C09 replay corpus topology drifted");
  }

  pointCalls = 0;
  signatureCalls = 0;
  let goldenClosure;
  try {
    goldenClosure =
      await bindingPoint.validateProviderRegistryEvidenceBindingPointClosureV1(
        bindingFixtures.materializeProviderRegistryEvidenceBindingPointGoldenRequestV1(
          golden,
          capability,
        ),
      );
  } catch (error) {
    const diagnostic =
      await bindingPoint.diagnoseProviderRegistryEvidenceBindingPointClosureV1(
        bindingFixtures.materializeProviderRegistryEvidenceBindingPointGoldenRequestV1(
          golden,
          capability,
        ),
      );
    throw new Error(
      `C09 replay golden validation rejected after ${pointCalls}/${signatureCalls}: ${diagnostic.ok ? "unexpected_success" : `${diagnostic.stage}/${diagnostic.reason}`}`,
      { cause: error },
    );
  }
  if (
    goldenClosure.authority !==
      "none_registry_entry_evidence_binding_structure_only" ||
    pointCalls !== 24 ||
    signatureCalls !== 46 ||
    !canonicalEqualV1(
      bindingFixtures.projectProviderRegistryEvidenceBindingPointClosureSnapshotV1(
        goldenClosure,
      ),
      golden.expected.successProjection,
    )
  ) {
    throw new Error(`C09 replay golden closure drifted: ${pointCalls}/${signatureCalls}`);
  }

  const firstShardIndex = lane.startCaseIndex / invalid.shardSize;
  const endShardIndexExclusive = Math.ceil(
    lane.endCaseIndexExclusive / invalid.shardSize,
  );
  const observedShards = [];
  let executedCaseCount = 0;
  for (
    let shardIndex = firstShardIndex;
    shardIndex < endShardIndexExclusive;
    shardIndex += 1
  ) {
    const expectedShard = invalid.shards[shardIndex];
    if (
      expectedShard === undefined ||
      expectedShard.startCaseIndex < lane.startCaseIndex ||
      expectedShard.endCaseIndexExclusive > lane.endCaseIndexExclusive
    ) {
      throw new Error(`C09 replay lane/shard boundary drifted: ${shardIndex}`);
    }
    const caseIds = [];
    const outcomes = [];
    const cryptoCounts = [];
    for (
      let caseIndex = expectedShard.startCaseIndex;
      caseIndex < expectedShard.endCaseIndexExclusive;
      caseIndex += 1
    ) {
      const invalidCase = invalid.cases[caseIndex];
      const caseId = invalid.caseIds[caseIndex];
      if (
        invalidCase === undefined ||
        caseId === undefined ||
        invalidCase.caseId !== caseId ||
        invalidCase.mutation.operation !== caseId
      ) {
        throw new Error(`C09 replay ordered inventory drifted at ${caseIndex}`);
      }
      const firstPrepared =
        bindingFixtures.materializeProviderRegistryEvidenceBindingPointInvalidCaseV1(
          golden,
          invalidCase,
          capability,
        );
      const secondPrepared =
        bindingFixtures.materializeProviderRegistryEvidenceBindingPointInvalidCaseV1(
          golden,
          invalidCase,
          capability,
        );
      assertFreshPreparedWitnessV1(firstPrepared, secondPrepared, caseId);
      const materializedDigest = await deriveMaterializedRequestDigestV1(
        golden,
        invalidCase,
        firstPrepared,
      );
      if (
        materializedDigest !==
        invalidCase.outerExpected.materializedRequestSemanticDigest
      ) {
        throw new Error(`C09 replay materialized request drifted: ${caseId}`);
      }
      pointCalls = 0;
      signatureCalls = 0;
      const execution =
        await bindingFixtures.executeProviderRegistryEvidenceBindingPointInvalidCaseV1(
          golden,
          invalidCase,
          capability,
          {
            readPointAdmissionCount: () => pointCalls,
            readSignatureVerificationCount: () => signatureCalls,
          },
        );
      if (
        execution.pointAdmissionCount !== pointCalls ||
        execution.signatureVerificationCount !== signatureCalls
      ) {
        throw new Error(`C09 replay counter observer drifted: ${caseId}`);
      }
      const observedOutcome = observedOuterExpectedV1(
        invalidCase,
        execution,
        materializedDigest,
      );
      if (!canonicalEqualV1(observedOutcome, invalidCase.outerExpected)) {
        throw new Error(`C09 replay outcome drifted: ${caseId}`);
      }
      caseIds.push(caseId);
      outcomes.push(observedOutcome);
      cryptoCounts.push({
        caseId,
        pointAdmissionCount: execution.pointAdmissionCount,
        signatureVerificationCount: execution.signatureVerificationCount,
      });
      executedCaseCount += 1;
    }
    const observedShard = {
      shardIndex,
      startCaseIndex: expectedShard.startCaseIndex,
      endCaseIndexExclusive: expectedShard.endCaseIndexExclusive,
      caseCount: caseIds.length,
      caseIdsContentDigest: await semanticDigestV1(
        bindingFixtures.PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_SHARD_CASE_IDS_DOMAIN_V1,
        caseIds,
      ),
      expectedOutcomesContentDigest: await semanticDigestV1(
        bindingFixtures.PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_SHARD_OUTCOMES_DOMAIN_V1,
        outcomes,
      ),
      cryptoCountsContentDigest: await semanticDigestV1(
        bindingFixtures.PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_SHARD_CRYPTO_DOMAIN_V1,
        cryptoCounts,
      ),
    };
    if (!canonicalEqualV1(observedShard, expectedShard)) {
      throw new Error(`C09 replay shard digest drifted: ${shardIndex}`);
    }
    observedShards.push(Object.freeze(observedShard));
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  if (executedCaseCount !== lane.endCaseIndexExclusive - lane.startCaseIndex) {
    throw new Error(`C09 replay lane count drifted: ${executedCaseCount}`);
  }
  return Object.freeze({
    profile: C09_DISTRIBUTION_REPLAY_PROFILE_V1,
    runtime: parsed.runtime,
    nonce: parsed.nonce,
    laneIndex: lane.laneIndex,
    startCaseIndex: lane.startCaseIndex,
    endCaseIndexExclusive: lane.endCaseIndexExclusive,
    executedCaseCount,
    aggregateContentDigest: invalid.aggregateContentDigest,
    goldenPointAdmissionCount: 24,
    goldenSignatureVerificationCount: 46,
    shards: Object.freeze(observedShards),
  });
}

Object.freeze(executeC09DistributionReplayLaneV1);
