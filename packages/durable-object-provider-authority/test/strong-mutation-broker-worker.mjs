import {
  createProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1,
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

function retainIpcUntilKilledV1() {
  return new Promise(() => {
    process.on("message", () => undefined);
  });
}

const root = requiredEnvironmentV1("AUTHORITY_BROKER_WORKER_ROOT");
const action = requiredEnvironmentV1("AUTHORITY_BROKER_WORKER_ACTION");
const input = JSON.parse(
  Buffer.from(
    requiredEnvironmentV1("AUTHORITY_BROKER_WORKER_INPUT_BASE64"),
    "base64",
  ).toString("utf8"),
);
const targetPhase = process.env.AUTHORITY_BROKER_WORKER_TARGET_PHASE;
const capability =
  createProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1(root);
const options = {
  clock: () => new Date("2026-08-20T00:10:00.000Z"),
  afterDurablePhase(phase) {
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
      options,
    );

sendV1({ type: "ready" });
await waitForGoV1();

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
