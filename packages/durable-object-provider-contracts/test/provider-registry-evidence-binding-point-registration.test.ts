import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

import type { ValidateProviderRegistryEvidenceBindingPointClosureV1Input } from "../src/provider-registry-evidence-binding-point.js";
import {
  PROVIDER_REGISTRY_EVIDENCE_BINDING_AUTHORITY_V1,
  ProviderRegistryEvidenceBindingPointClosureValidationError,
  diagnoseProviderRegistryEvidenceBindingPointClosureV1,
  validateProviderRegistryEvidenceBindingPointClosureV1,
} from "../src/provider-registry-evidence-binding-point.js";
import {
  PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1,
  PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
  attestProviderStrictEd25519CryptoHostV1,
  type ProviderStrictEd25519OpaqueCapabilityV1,
} from "../src/strict-ed25519-conformance.js";
import {
  STRICT_ED25519_VERIFICATION_PROFILE_V1,
  validatePrimeSubgroupPoint,
  verifyRawEd25519,
} from "../src/strict-ed25519.js";

const THIS_TEST_FILE_V1 = fileURLToPath(import.meta.url);

type PreparedChainExternalPrimordialCallerV1 =
  | "node_async_hooks"
  | "zod";

function classifyPreparedChainExternalPrimordialCallerV1(
  candidateLabel: string,
): PreparedChainExternalPrimordialCallerV1 | undefined {
  const previousPrepareStackTrace = Error.prepareStackTrace;
  try {
    Error.prepareStackTrace = (_error, callSites) =>
      callSites as unknown as string;
    const callSites = new Error().stack as unknown as readonly NodeJS.CallSite[];
    if (callSites === undefined || callSites === null) return undefined;
    for (let index = 0; index < callSites.length; index += 1) {
      const callSite = callSites[index];
      const fileName = callSite?.getFileName();
      if (typeof fileName !== "string" || fileName === THIS_TEST_FILE_V1) {
        continue;
      }
      if (fileName.includes("/node_modules/zod/")) return "zod";
      if (
        candidateLabel === "Array.pop" &&
        fileName === "node:internal/async_hooks" &&
        callSite?.getFunctionName() === "popAsyncContext"
      ) {
        return "node_async_hooks";
      }
      return undefined;
    }
    return undefined;
  } finally {
    Error.prepareStackTrace = previousPrepareStackTrace;
  }
}

function isDirectZodPrimordialCallerV1(): boolean {
  return (
    classifyPreparedChainExternalPrimordialCallerV1("Array.isArray") === "zod"
  );
}

const pointSource = readFileSync(
  fileURLToPath(
    new URL(
      "../src/provider-registry-evidence-binding-point.ts",
      import.meta.url,
    ),
  ),
  "utf8",
);
function sourceTextV1(relativePath: string): string {
  return readFileSync(
    fileURLToPath(new URL(`../src/${relativePath}`, import.meta.url)),
    "utf8",
  );
}

const publicIndexSource = sourceTextV1("index.ts");
const runtimePointSource = sourceTextV1(
  "provider-runtime-attestation-point.ts",
);
const conformanceResultSource = sourceTextV1(
  "provider-real-filesystem-conformance-result.ts",
);
const targetDiscoverySource = sourceTextV1(
  "provider-target-discovery-point.ts",
);
const realFilesystemSource = sourceTextV1(
  "provider-real-filesystem-source.ts",
);
const internalModuleNamesV1 = Object.freeze([
  "provider-feasibility-evidence-point-internal",
  "provider-real-filesystem-conformance-result-internal",
  "provider-real-filesystem-source-internal",
  "provider-registry-history-prepared-handle-internal",
  "provider-registry-history-prepared-internal",
  "provider-registry-evidence-binding-point-budget-test-seam-internal",
  "provider-registry-evidence-binding-point-budget-witness-internal",
  "provider-runtime-attestation-point-internal",
  "provider-target-discovery-point-prepared-internal",
]);
const packageManifest = JSON.parse(
  readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"),
) as { readonly exports: unknown; readonly sideEffects: unknown };

const EXPECTED_SIDE_EFFECT_MODULES_V1 = Object.freeze([
  "./dist/provider-registry-root-history.js",
  "./dist/provider-registry-manifest-history.js",
  "./dist/provider-registry-history-prepared-internal.js",
  "./dist/provider-real-filesystem-source.js",
  "./dist/provider-target-discovery-point.js",
  "./dist/provider-real-filesystem-conformance-result.js",
  "./dist/provider-runtime-attestation-point.js",
]);

interface EvidenceBindingGoldenV1 {
  readonly compatibleBase: Omit<
    ValidateProviderRegistryEvidenceBindingPointClosureV1Input,
    "strictCryptoCapability"
  >;
  readonly expected: {
    readonly registryCryptoClosure: {
      readonly signatureVerificationCount: number;
    };
    readonly completeCryptoClosure: {
      readonly pointAdmissionCount: number;
      readonly signatureVerificationCount: number;
    };
  };
}

function resourceBytesV1(relativePath: string): Uint8Array {
  return new Uint8Array(
    readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url))),
  );
}

const goldenV1 = JSON.parse(
  new TextDecoder().decode(
    resourceBytesV1(
      "fixtures/v1/golden/provider-registry-evidence-binding-point-v1.json",
    ),
  ),
) as EvidenceBindingGoldenV1;
const strictManifestBytesV1 = resourceBytesV1(
  PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
);

let capabilityV1: ProviderStrictEd25519OpaqueCapabilityV1;
let pointCallsV1 = 0;
let signatureCallsV1 = 0;
let installEarlyRegistryPrimordialPoisonV1: (() => void) | undefined;
let installPreparedSuccessPrimordialPoisonV1: (() => void) | undefined;

beforeAll(async () => {
  capabilityV1 = await attestProviderStrictEd25519CryptoHostV1({
    host: Object.freeze({
      verificationProfile: STRICT_ED25519_VERIFICATION_PROFILE_V1,
      validatePrimeSubgroupPoint(encodedPoint: Uint8Array) {
        pointCallsV1 += 1;
        return validatePrimeSubgroupPoint(encodedPoint);
      },
      verifyRawEd25519(
        publicKey: Uint8Array,
        message: Uint8Array,
        signature: Uint8Array,
      ) {
        signatureCallsV1 += 1;
        const accepted = verifyRawEd25519(publicKey, message, signature);
        if (signatureCallsV1 === 1) {
          installEarlyRegistryPrimordialPoisonV1?.();
        }
        if (
          signatureCallsV1 ===
          goldenV1.expected.registryCryptoClosure.signatureVerificationCount + 1
        ) {
          installPreparedSuccessPrimordialPoisonV1?.();
        }
        return accepted;
      },
    }),
    resourceHost: Object.freeze({
      readFixedSignedPackageResource(path: string, maxBytes: number) {
        expect(path).toBe(PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1);
        expect(maxBytes).toBe(PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1);
        return strictManifestBytesV1.slice();
      },
    }),
  });
});

function expectHardenedPromiseV1(value: Promise<unknown>): void {
  expect(Object.isFrozen(value)).toBe(true);
  for (const key of ["constructor", "then", "catch", "finally"] as const) {
    expect(Object.getOwnPropertyDescriptor(value, key)).toMatchObject({
      configurable: false,
      enumerable: false,
      writable: false,
      value: expect.any(Function),
    });
  }
}

function expectRecursivelyFrozenV1(
  value: unknown,
  seen = new Set<object>(),
): void {
  if (value === null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && "value" in descriptor) {
      expectRecursivelyFrozenV1(descriptor.value, seen);
    }
  }
}

interface InstalledPreparedChainPrimordialPoisonV1 {
  readonly forgedIdentity: Readonly<{ readonly forgedByPrimordialPoison: true }>;
  readonly firstPartyCalls: number;
  readonly nodeRuntimeCalls: number;
  readonly thirdPartyZodCalls: number;
  readonly installed: boolean;
  readonly firstCall: string | undefined;
  readonly firstStack: string | undefined;
  readonly lastCall: string | undefined;
  install(): void;
  restore(): void;
}

function createPreparedChainPrimordialPoisonV1(): InstalledPreparedChainPrimordialPoisonV1 {
  const nativeDefineProperty = Object.defineProperty;
  const nativeFreeze = Object.freeze;
  const nativeGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
  const forgedIdentity = nativeFreeze({
    forgedByPrimordialPoison: true as const,
  });
  const forgedArray = nativeFreeze([forgedIdentity]);
  const forgedDescriptor = nativeFreeze({
    configurable: true,
    enumerable: true,
    writable: true,
    value: forgedIdentity,
  });
  const forgedDescriptorMap = nativeFreeze({ forged: forgedDescriptor });
  let firstPartyCalls = 0;
  let nodeRuntimeCalls = 0;
  let thirdPartyZodCalls = 0;
  let installed = false;
  let firstCall: string | undefined;
  let firstError: Error | undefined;
  let lastCall: string | undefined;

  const candidateSpecs: readonly {
    readonly owner: object;
    readonly key: PropertyKey;
    readonly label: string;
    readonly forgedResult: unknown;
    readonly constructCall?: true;
  }[] = [
    { owner: globalThis, key: "Map", label: "Map", forgedResult: forgedIdentity, constructCall: true },
    { owner: globalThis, key: "Set", label: "Set", forgedResult: forgedIdentity, constructCall: true },
    { owner: globalThis, key: "WeakSet", label: "WeakSet", forgedResult: forgedIdentity, constructCall: true },
    { owner: Array, key: "isArray", label: "Array.isArray", forgedResult: false },
    { owner: Array.prototype, key: "map", label: "Array.map", forgedResult: forgedArray },
    { owner: Array.prototype, key: "filter", label: "Array.filter", forgedResult: forgedArray },
    { owner: Array.prototype, key: "some", label: "Array.some", forgedResult: false },
    { owner: Array.prototype, key: "sort", label: "Array.sort", forgedResult: forgedArray },
    { owner: Array.prototype, key: "push", label: "Array.push", forgedResult: 0 },
    { owner: Array.prototype, key: "pop", label: "Array.pop", forgedResult: forgedIdentity },
    { owner: Array.prototype, key: "join", label: "Array.join", forgedResult: "forged" },
    { owner: Map.prototype, key: "get", label: "Map.get", forgedResult: forgedIdentity },
    { owner: Map.prototype, key: "set", label: "Map.set", forgedResult: forgedIdentity },
    { owner: Map.prototype, key: "has", label: "Map.has", forgedResult: false },
    { owner: Map.prototype, key: "keys", label: "Map.keys", forgedResult: forgedArray },
    { owner: Map.prototype, key: "values", label: "Map.values", forgedResult: forgedArray },
    { owner: Set.prototype, key: "has", label: "Set.has", forgedResult: false },
    { owner: Set.prototype, key: "add", label: "Set.add", forgedResult: forgedIdentity },
    { owner: Set.prototype, key: "delete", label: "Set.delete", forgedResult: false },
    { owner: Set.prototype, key: "keys", label: "Set.keys", forgedResult: forgedArray },
    { owner: Set.prototype, key: "values", label: "Set.values", forgedResult: forgedArray },
    { owner: WeakSet.prototype, key: "has", label: "WeakSet.has", forgedResult: false },
    { owner: WeakSet.prototype, key: "add", label: "WeakSet.add", forgedResult: forgedIdentity },
    { owner: Number, key: "isSafeInteger", label: "Number.isSafeInteger", forgedResult: false },
    { owner: Object, key: "is", label: "Object.is", forgedResult: false },
    { owner: Object, key: "isFrozen", label: "Object.isFrozen", forgedResult: false },
    { owner: Object, key: "keys", label: "Object.keys", forgedResult: forgedArray },
    { owner: Object, key: "entries", label: "Object.entries", forgedResult: forgedArray },
    { owner: Object, key: "getPrototypeOf", label: "Object.getPrototypeOf", forgedResult: forgedIdentity },
    { owner: Object, key: "getOwnPropertySymbols", label: "Object.getOwnPropertySymbols", forgedResult: forgedArray },
    { owner: Object, key: "getOwnPropertyDescriptor", label: "Object.getOwnPropertyDescriptor", forgedResult: forgedDescriptor },
    { owner: Object, key: "getOwnPropertyDescriptors", label: "Object.getOwnPropertyDescriptors", forgedResult: forgedDescriptorMap },
    { owner: Object, key: "values", label: "Object.values", forgedResult: forgedArray },
    { owner: Object, key: "freeze", label: "Object.freeze", forgedResult: forgedIdentity },
    { owner: Reflect, key: "ownKeys", label: "Reflect.ownKeys", forgedResult: forgedArray },
    { owner: RegExp.prototype, key: "exec", label: "RegExp.exec", forgedResult: null },
    { owner: RegExp.prototype, key: "test", label: "RegExp.test", forgedResult: false },
  ];
  const nativeReflectApply = Reflect.apply;
  const nativeReflectConstruct = Reflect.construct;
  const originals = candidateSpecs.map((candidate) => {
    const descriptor = nativeGetOwnPropertyDescriptor(
      candidate.owner,
      candidate.key,
    );
    if (descriptor === undefined || typeof descriptor.value !== "function") {
      throw new TypeError("prepared-chain primordial descriptor unavailable");
    }
    const original = descriptor.value as (...args: unknown[]) => unknown;
    const replacement = function poisonedPreparedChainPrimordialV1(
      this: unknown,
      ...args: unknown[]
    ): unknown {
      const externalCaller = classifyPreparedChainExternalPrimordialCallerV1(
        candidate.label,
      );
      if (externalCaller !== undefined) {
        if (externalCaller === "zod") thirdPartyZodCalls += 1;
        else nodeRuntimeCalls += 1;
        return candidate.constructCall === true
          ? nativeReflectConstruct(original, args, original)
          : nativeReflectApply(original, this, args);
      }
      firstPartyCalls += 1;
      if (firstCall === undefined) {
        firstCall = candidate.label;
        firstError = new Error("first primordial poison call");
      }
      lastCall = candidate.label;
      return candidate.forgedResult;
    };
    return { ...candidate, descriptor, replacement };
  });

  return {
    forgedIdentity,
    get firstPartyCalls() {
      return firstPartyCalls;
    },
    get nodeRuntimeCalls() {
      return nodeRuntimeCalls;
    },
    get thirdPartyZodCalls() {
      return thirdPartyZodCalls;
    },
    get installed() {
      return installed;
    },
    get firstCall() {
      return firstCall;
    },
    get firstStack() {
      return firstError?.stack;
    },
    get lastCall() {
      return lastCall;
    },
    install() {
      if (installed) return;
      installed = true;
      for (const original of originals) {
        nativeDefineProperty(original.owner, original.key, {
          ...original.descriptor,
          value: original.replacement,
        });
      }
    },
    restore() {
      if (!installed) return;
      for (const original of originals) {
        nativeDefineProperty(original.owner, original.key, original.descriptor);
      }
    },
  };
}

function expectNoIdentityV1(
  value: unknown,
  forbiddenIdentity: object,
  seen = new Set<object>(),
): void {
  expect(value).not.toBe(forbiddenIdentity);
  if (value === null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && "value" in descriptor) {
      expectNoIdentityV1(descriptor.value, forbiddenIdentity, seen);
    }
  }
}

function sourceSliceV1(
  source: string,
  start: string,
  end?: string,
): string {
  const startIndex = source.indexOf(start);
  const endIndex = end === undefined
    ? source.length
    : source.indexOf(end, startIndex + start.length);
  expect(startIndex, `missing architecture start marker: ${start}`).toBeGreaterThanOrEqual(0);
  if (end !== undefined) {
    expect(endIndex, `missing architecture end marker: ${end}`).toBeGreaterThan(startIndex);
  }
  return source.slice(startIndex, endIndex);
}

describe("provider Registry Evidence binding registration", () => {
  it("declares the exact callback-registration allowlist and Runtime bare edge", () => {
    expect(packageManifest.sideEffects).toEqual(EXPECTED_SIDE_EFFECT_MODULES_V1);
    expect(pointSource).toMatch(
      /^import "\.\/provider-runtime-attestation-point\.js";$/mu,
    );
    expect(pointSource).not.toMatch(/\bObject\.freeze\s*\(/u);
    expect(pointSource).not.toMatch(/\bString\s*\(\s*index\s*\)/u);
    const freezeCaptureIndex = pointSource.indexOf(
      "const CapturedObjectFreezeV1 = Object.freeze;",
    );
    const publicErrorIndex = pointSource.indexOf(
      "export class ProviderRegistryEvidenceBindingPointClosureValidationError",
    );
    expect(freezeCaptureIndex).toBeGreaterThanOrEqual(0);
    expect(publicErrorIndex).toBeGreaterThanOrEqual(0);
    expect(freezeCaptureIndex).toBeLessThan(publicErrorIndex);

    // Hook for the distribution KAT: once this point and its compatible fixture
    // loader are public package exports, the packed Vite consumer must import
    // the point directly and close the compatible request.  Until then, this
    // source/package assertion proves the registration edge without pretending
    // that an unreachable packed full-success path was executed.
  });

  it("keeps the prepared I-to-F call graph private and snapshot-free", () => {
    const packageExportsSource = JSON.stringify(packageManifest.exports);
    for (const internalModuleName of internalModuleNamesV1) {
      expect(publicIndexSource).not.toContain(internalModuleName);
      expect(packageExportsSource).not.toContain(internalModuleName);
    }

    const runtimePreparedRegistration = sourceSliceV1(
      runtimePointSource,
      "registerProviderRuntimeAttestationPreparedCoreInternalV1(",
    );
    expect(runtimePreparedRegistration).not.toContain(
      "snapshotRuntimePointInputV1(",
    );
    expect(runtimePreparedRegistration).not.toContain(
      "diagnoseProviderRealFilesystemConformanceResultClosureV1(",
    );
    expect(runtimePreparedRegistration).not.toContain(
      "validateProviderRuntimeAttestationPointClosureV1(",
    );
    expect(runtimePreparedRegistration).toContain(
      "diagnoseProviderRealFilesystemConformanceResultPreparedInternalV1(",
    );

    const conformancePreparedRegistration = sourceSliceV1(
      conformanceResultSource,
      "registerProviderRealFilesystemConformanceResultPreparedCoreInternalV1(",
    );
    expect(conformancePreparedRegistration).not.toContain(
      "snapshotResultClosureInputV1(",
    );
    expect(conformancePreparedRegistration).not.toContain(
      "diagnoseProviderTargetDiscoveryPointClosureV1(",
    );
    expect(conformancePreparedRegistration).toContain(
      "diagnoseProviderTargetDiscoveryPointPreparedInternalV1(",
    );

    const discoveryPreparedRegistration = sourceSliceV1(
      targetDiscoverySource,
      "registerProviderTargetDiscoveryPointPreparedCoreInternalV1(",
    );
    expect(discoveryPreparedRegistration).not.toContain(
      "prepareProviderTargetDiscoveryPointFromRawInputV1(",
    );
    expect(discoveryPreparedRegistration).not.toContain(
      "diagnoseProviderRealFilesystemSourceClosureV1(",
    );
    expect(discoveryPreparedRegistration).toContain(
      "diagnoseProviderRealFilesystemSourcePreparedInternalV1(",
    );

    const sourcePreparedRegistration = sourceSliceV1(
      realFilesystemSource,
      "registerProviderRealFilesystemSourcePreparedCoreInternalV1(",
    );
    expect(sourcePreparedRegistration).not.toContain("snapshotInputV1(");
    expect(sourcePreparedRegistration).not.toContain(
      "diagnoseProviderRealFilesystemSourceClosureV1(",
    );
    expect(sourcePreparedRegistration).not.toContain(
      "validateProviderRealFilesystemSourceClosureV1(",
    );
  });

  it("keeps hardened promises and opaque frozen errors after Object.freeze is poisoned", async () => {
    const freezeDescriptor = Object.getOwnPropertyDescriptor(Object, "freeze");
    if (freezeDescriptor === undefined) {
      throw new TypeError("Object.freeze descriptor is unavailable");
    }
    let poisonCalls = 0;
    let diagnosticPromise: Promise<unknown> | undefined;
    let publicPromise: Promise<unknown> | undefined;
    try {
      Object.defineProperty(Object, "freeze", {
        ...freezeDescriptor,
        value() {
          poisonCalls += 1;
          throw new TypeError("late-bound Object.freeze was used");
        },
      });
      diagnosticPromise =
        diagnoseProviderRegistryEvidenceBindingPointClosureV1({});
      publicPromise = validateProviderRegistryEvidenceBindingPointClosureV1(
        {} as ValidateProviderRegistryEvidenceBindingPointClosureV1Input,
      );
    } finally {
      Object.defineProperty(Object, "freeze", freezeDescriptor);
    }

    expect(poisonCalls).toBe(0);
    expectHardenedPromiseV1(diagnosticPromise!);
    await expect(diagnosticPromise).resolves.toEqual({
      ok: false,
      stage: "input",
      reason: "schema_invalid",
    });
    expectHardenedPromiseV1(publicPromise!);
    let error: unknown;
    try {
      await publicPromise;
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(
      ProviderRegistryEvidenceBindingPointClosureValidationError,
    );
    expect(Object.isFrozen(error)).toBe(true);
    expect(error).toMatchObject({
      name: "ProviderRegistryEvidenceBindingPointClosureValidationError",
      code: "provider_unavailable",
      reason: "attestation_invalid",
    });
  });

  it("fails closed without authority when the trusted Zod realm is damaged", async () => {
    const descriptor = Object.getOwnPropertyDescriptor(Array, "isArray");
    if (descriptor === undefined || typeof descriptor.value !== "function") {
      throw new TypeError("Array.isArray descriptor is unavailable");
    }
    const nativeArrayIsArray = descriptor.value as (
      value: unknown,
    ) => boolean;
    const nativeDefineProperty = Object.defineProperty;
    const nativeReflectApply = Reflect.apply;
    const diagnosticInput = {
      ...structuredClone(goldenV1.compatibleBase),
      strictCryptoCapability: capabilityV1,
    };
    const publicInput = {
      ...structuredClone(goldenV1.compatibleBase),
      strictCryptoCapability: capabilityV1,
    };
    let zodBreakCalls = 0;
    let diagnostic!: Awaited<
      ReturnType<typeof diagnoseProviderRegistryEvidenceBindingPointClosureV1>
    >;
    let publicOutcome!:
      | { readonly resolved: true }
      | { readonly resolved: false; readonly error: unknown };

    try {
      nativeDefineProperty(Array, "isArray", {
        ...descriptor,
        value: function brokenZodArrayIsArrayV1(
          this: unknown,
          value: unknown,
        ): boolean {
          if (isDirectZodPrimordialCallerV1()) {
            zodBreakCalls += 1;
            throw new TypeError("trusted Zod realm primordial unavailable");
          }
          return nativeReflectApply(nativeArrayIsArray, this, [value]) as boolean;
        },
      });
      const diagnosticPromise =
        diagnoseProviderRegistryEvidenceBindingPointClosureV1(diagnosticInput);
      const publicOutcomePromise =
        validateProviderRegistryEvidenceBindingPointClosureV1(publicInput).then(
          () => ({ resolved: true as const }),
          (error: unknown) => ({ resolved: false as const, error }),
        );
      diagnostic = await diagnosticPromise;
      publicOutcome = await publicOutcomePromise;
    } finally {
      nativeDefineProperty(Array, "isArray", descriptor);
    }

    expect(zodBreakCalls).toBeGreaterThan(0);
    expect(diagnostic.ok).toBe(false);
    expect("value" in diagnostic).toBe(false);
    expect(JSON.stringify(diagnostic)).not.toContain(
      PROVIDER_REGISTRY_EVIDENCE_BINDING_AUTHORITY_V1,
    );
    expect(publicOutcome.resolved).toBe(false);
    if (publicOutcome.resolved) {
      throw new TypeError("damaged trusted Zod realm unexpectedly authorized");
    }
    expect(publicOutcome.error).toBeInstanceOf(
      ProviderRegistryEvidenceBindingPointClosureValidationError,
    );
    expect(Object.isFrozen(publicOutcome.error)).toBe(true);
    expect(publicOutcome.error).toMatchObject({
      name: "ProviderRegistryEvidenceBindingPointClosureValidationError",
      code: "provider_unavailable",
      reason: "attestation_invalid",
    });
    expect(JSON.stringify(publicOutcome.error)).not.toContain(
      PROVIDER_REGISTRY_EVIDENCE_BINDING_AUTHORITY_V1,
    );
  });

  it("keeps the complete 24/46 success graph frozen across early Registry and signature-39 primordial replacement windows", async () => {
    for (const window of ["early_registry", "signature_39"] as const) {
      const poison = createPreparedChainPrimordialPoisonV1();
      pointCallsV1 = 0;
      signatureCallsV1 = 0;
      if (window === "early_registry") {
        installEarlyRegistryPrimordialPoisonV1 = poison.install;
      } else {
        installPreparedSuccessPrimordialPoisonV1 = poison.install;
      }

      let diagnostic: Awaited<
        ReturnType<typeof diagnoseProviderRegistryEvidenceBindingPointClosureV1>
      >;
      try {
        diagnostic = await diagnoseProviderRegistryEvidenceBindingPointClosureV1({
          ...structuredClone(goldenV1.compatibleBase),
          strictCryptoCapability: capabilityV1,
        });
      } finally {
        installEarlyRegistryPrimordialPoisonV1 = undefined;
        installPreparedSuccessPrimordialPoisonV1 = undefined;
        poison.restore();
      }

      if (!diagnostic.ok) {
        throw new TypeError(
          `${window}: ${diagnostic.stage}/${diagnostic.reason}; first=${poison.firstCall ?? "none"}; last=${poison.lastCall ?? "none"}; firstPartyCalls=${poison.firstPartyCalls}; nodeRuntimeCalls=${poison.nodeRuntimeCalls}; thirdPartyZodCalls=${poison.thirdPartyZodCalls}; stack=${poison.firstStack?.replace(/\n/gu, " | ") ?? "none"}`,
        );
      }
      const value = diagnostic.value;

      expect(poison.installed, window).toBe(true);
      expect(
        poison.firstPartyCalls,
        `${window}: first=${poison.firstCall ?? "none"}; last=${poison.lastCall ?? "none"}; stack=${poison.firstStack?.replace(/\n/gu, " | ") ?? "none"}`,
      ).toBe(0);
      expect(poison.thirdPartyZodCalls, window).toBeGreaterThan(0);
      expect(pointCallsV1, window).toBe(
        goldenV1.expected.completeCryptoClosure.pointAdmissionCount,
      );
      expect(signatureCallsV1, window).toBe(
        goldenV1.expected.completeCryptoClosure.signatureVerificationCount,
      );
      expect(value.authority, window).toBe(
        PROVIDER_REGISTRY_EVIDENCE_BINDING_AUTHORITY_V1,
      );
      expectNoIdentityV1(value, poison.forgedIdentity);
      expectRecursivelyFrozenV1(value);
    }
  });
});
