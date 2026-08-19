import {
  createProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1,
  openProviderAcceptanceAuthorityStoreForTestInternalV1,
} from "../dist/test-seam-internal.js";
import { chmod } from "node:fs/promises";
import { join } from "node:path";

function requiredEnvironmentV1(name) {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`missing worker environment ${name}`);
  }
  return value;
}

function sendV1(message) {
  if (typeof process.send !== "function") {
    throw new Error("authority worker requires an IPC channel");
  }
  process.send(message);
}

function waitForGoV1() {
  return new Promise((resolvePromise) => {
    process.once("message", (message) => {
      if (message !== null && typeof message === "object" &&
        message.type === "go") {
        resolvePromise();
      }
    });
  });
}

function waitForeverOnIpcBarrierV1() {
  return new Promise(() => {
    // A bare unresolved top-level await does not keep Node alive (exit 13).
    // Retain the IPC channel so the parent controls the exact SIGKILL cut.
    process.on("message", () => undefined);
  });
}

const mode = requiredEnvironmentV1("AUTHORITY_WORKER_MODE");
const root = requiredEnvironmentV1("AUTHORITY_WORKER_ROOT");
const request = JSON.parse(
  Buffer.from(
    requiredEnvironmentV1("AUTHORITY_WORKER_REQUEST_BASE64"),
    "base64",
  ).toString("utf8"),
);
const targetPhase = process.env.AUTHORITY_WORKER_TARGET_PHASE;
const capability =
  createProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1(root);
const fixedClockV1 = () => new Date("2026-08-20T00:10:00.000Z");
const store = await openProviderAcceptanceAuthorityStoreForTestInternalV1(
  capability,
  mode === "crash" || mode === "lock_crash"
    ? {
        clock: fixedClockV1,
        afterDurablePhase(phase) {
          if (phase !== targetPhase) return;
          sendV1({ type: "phase", phase });
          return waitForeverOnIpcBarrierV1();
        },
      }
    : mode === "release_error"
    ? {
        clock: fixedClockV1,
        async afterDurablePhase(phase) {
          if (phase !== "snapshot_directory_fsynced_before_response") return;
          await chmod(join(root, "runtime-state", "private"), 0o500);
          sendV1({ type: "phase", phase });
        },
      }
    : { clock: fixedClockV1 },
);

sendV1({ type: "ready" });
await waitForGoV1();

try {
  const result = await store.compareAppend(request);
  sendV1({ type: "result", result });
  process.exitCode = 0;
  process.disconnect();
} catch (error) {
  const structuredError = error !== null && typeof error === "object"
    ? {
        name: error.name,
        code: error.code,
        message: error.message,
        stack: error.stack,
        ownPropertyNames: Object.getOwnPropertyNames(error),
        hasCause: Object.hasOwn(error, "cause"),
        hasPath: Object.hasOwn(error, "path"),
        hasDestination: Object.hasOwn(error, "dest"),
        json: JSON.stringify(error),
        stringValue: String(error),
      }
    : { name: "UnknownError", message: String(error) };
  sendV1({
    type: "error",
    error: structuredError,
  });
  process.exitCode = 1;
  process.disconnect();
}
