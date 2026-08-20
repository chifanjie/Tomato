import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1,
  PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
  attestProviderStrictEd25519CryptoHostV1,
} from "@understand-code/durable-object-provider-contracts/strict-ed25519-conformance";
import {
  STRICT_ED25519_VERIFICATION_PROFILE_V1,
  validatePrimeSubgroupPoint,
  verifyRawEd25519,
} from "@understand-code/durable-object-provider-contracts/strict-ed25519";

import {
  createProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1,
  mintProviderStrongMutationTrustVerifierForTestInternalV1,
  openProviderAcceptanceAuthorityStoreForTestInternalV1,
  openProviderStrongMutationBrokerStoreForTestInternalV1,
} from "../dist/test-seam-internal.js";

function requiredEnvironmentV1(name) {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`missing broker worker environment ${name}`);
  }
  return value;
}

function sendV1(message) {
  if (typeof process.send !== "function") {
    throw new Error("broker worker requires an IPC channel");
  }
  process.send(message);
}

function waitForGoV1() {
  return new Promise((resolvePromise) => {
    process.once("message", (message) => {
      if (
        message !== null &&
        typeof message === "object" &&
        message.type === "go"
      ) resolvePromise();
    });
  });
}

function waitForContinueV1() {
  return new Promise((resolvePromise) => {
    const onMessage = (message) => {
      if (
        message !== null &&
        typeof message === "object" &&
        message.type === "continue"
      ) {
        process.off("message", onMessage);
        resolvePromise();
      }
    };
    process.on("message", onMessage);
  });
}

function retainIpcUntilKilledV1() {
  return new Promise(() => {
    process.on("message", () => undefined);
  });
}

const root = requiredEnvironmentV1("AUTHORITY_BROKER_WORKER_ROOT");
const evidencePath = requiredEnvironmentV1(
  "AUTHORITY_BROKER_WORKER_EVIDENCE_PATH",
);
const action = requiredEnvironmentV1("AUTHORITY_BROKER_WORKER_ACTION");
const input = JSON.parse(
  Buffer.from(
    requiredEnvironmentV1("AUTHORITY_BROKER_WORKER_INPUT_BASE64"),
    "base64",
  ).toString("utf8"),
);
const targetPhase = process.env.AUTHORITY_BROKER_WORKER_TARGET_PHASE;
const phaseSequence =
  process.env.AUTHORITY_BROKER_WORKER_PHASE_SEQUENCE_BASE64 === undefined
    ? undefined
    : JSON.parse(Buffer.from(
        process.env.AUTHORITY_BROKER_WORKER_PHASE_SEQUENCE_BASE64,
        "base64",
      ).toString("utf8"));
let phaseIndex = 0;
let phasesArmed =
  process.env.AUTHORITY_BROKER_WORKER_ARM_PHASES_AFTER_GO !== "1";
const capability =
  createProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1(root);
const strictManifestBytes = new Uint8Array(readFileSync(fileURLToPath(new URL(
  "../../durable-object-provider-contracts/provider/ed25519-strict-host-conformance-v1.json",
  import.meta.url,
))));
const strictCryptoCapability = await attestProviderStrictEd25519CryptoHostV1({
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
      ) throw new Error("unexpected strict Ed25519 resource request");
      return strictManifestBytes.slice();
    },
  },
});
const trustEvidence = JSON.parse(readFileSync(evidencePath, "utf8"));
const verifierCapability =
  mintProviderStrongMutationTrustVerifierForTestInternalV1({
    strictCryptoCapability,
    readEvidence() {
      return structuredClone(trustEvidence);
    },
  });
const options = {
  clock: () => new Date("2026-08-20T00:10:00.000Z"),
  afterDurablePhase(phase) {
    if (!phasesArmed) return;
    if (phaseSequence !== undefined) {
      if (phase !== phaseSequence[phaseIndex]) return;
      phaseIndex += 1;
      sendV1({ type: "phase", phase });
      return waitForContinueV1();
    }
    if (targetPhase === undefined || phase !== targetPhase) return;
    sendV1({ type: "phase", phase });
    return retainIpcUntilKilledV1();
  },
};
const store = action === "acceptance_append"
  ? await openProviderAcceptanceAuthorityStoreForTestInternalV1(
      capability,
      options,
    )
  : await openProviderStrongMutationBrokerStoreForTestInternalV1(
      capability,
      verifierCapability,
      options,
    );

sendV1({ type: "ready" });
await waitForGoV1();
phasesArmed = true;

try {
  const result = action === "begin"
    ? await store.begin(input)
    : action === "resolve"
    ? await store.resolve(input)
    : action === "acceptance_append"
    ? await store.compareAppend(input)
    : (() => {
        throw new Error(`unknown broker worker action ${action}`);
      })();
  sendV1({ type: "result", result });
  process.exitCode = 0;
  process.disconnect();
} catch (error) {
  sendV1({
    type: "error",
    error: error !== null && typeof error === "object"
      ? {
          name: error.name,
          code: error.code,
          message: error.message,
          ownPropertyNames: Object.getOwnPropertyNames(error),
          hasCause: Object.hasOwn(error, "cause"),
          hasPath: Object.hasOwn(error, "path"),
          json: JSON.stringify(error),
          stringValue: String(error),
        }
      : { name: "UnknownError", message: String(error) },
  });
  process.exitCode = 1;
  process.disconnect();
}
