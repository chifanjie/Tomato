import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  buildProviderRegistryManifestRelativePathV1,
  buildProviderRegistryRootMetadataRelativePathV1,
  decodeShortStoreFilenameKeyV1,
  encodeStoreFilenameKeyV1,
  PROVIDER_REGISTRY_MANIFEST_LOCATOR_PROFILE_V1,
  validateProviderRegistryManifestRelativePathV1,
  verifyStoreFilenameKeyForSemanticIdV1,
} from "../src/provider-fixed-locator.js";

const THIS_TEST_FILE_V1 = fileURLToPath(import.meta.url);

interface PrimordialCandidateV1 {
  readonly owner: object;
  readonly key: PropertyKey;
  readonly label: string;
  readonly forgedResult?: unknown;
  readonly kind?: "constructor" | "getter" | "method";
}

interface InstalledPrimordialPoisonV1 {
  readonly firstPartyHits: number;
  readonly firstPartyLabels: readonly string[];
  install(): void;
  restore(): void;
}

function createFixedLocatorPrimordialPoisonV1(): InstalledPrimordialPoisonV1 {
  const NativeArray = Array;
  const NativeBigInt = BigInt;
  const NativeError = Error;
  const NativeMap = Map;
  const NativeNumber = Number;
  const NativeObject = Object;
  const NativeReflect = Reflect;
  const NativeRegExp = RegExp;
  const NativeSet = Set;
  const NativeString = String;
  const NativeTextDecoder = TextDecoder;
  const NativeTextEncoder = TextEncoder;
  const NativeTypeError = TypeError;
  const NativeUint8Array = Uint8Array;
  const NativeUint32Array = Uint32Array;
  const nativeDefineProperty = NativeObject.defineProperty;
  const nativeDeleteProperty = NativeReflect.deleteProperty;
  const nativeGetOwnPropertyDescriptor =
    NativeObject.getOwnPropertyDescriptor;
  const nativeGetPrototypeOf = NativeObject.getPrototypeOf;
  const nativeReflectApply = NativeReflect.apply;
  const nativeReflectConstruct = NativeReflect.construct;
  const nativeReflectGet = NativeReflect.get;
  const nativeSetPrototypeOf = NativeObject.setPrototypeOf;
  const nativeStringIncludes = NativeString.prototype.includes;
  const iteratorKey = Symbol.iterator;
  const hasInstanceKey = Symbol.hasInstance;
  const typedArrayPrototype = nativeGetPrototypeOf(
    NativeUint8Array.prototype,
  );
  const firstPartyLabels: string[] = [];
  let firstPartyHits = 0;
  let installed = false;

  const candidates: readonly PrimordialCandidateV1[] = [
    { owner: globalThis, key: "BigInt", label: "BigInt", kind: "constructor" },
    { owner: globalThis, key: "Number", label: "Number", kind: "constructor" },
    { owner: globalThis, key: "TextDecoder", label: "TextDecoder", kind: "constructor" },
    { owner: globalThis, key: "TextEncoder", label: "TextEncoder", kind: "constructor" },
    { owner: globalThis, key: "TypeError", label: "TypeError", kind: "constructor" },
    { owner: globalThis, key: "Uint8Array", label: "Uint8Array", kind: "constructor" },
    { owner: globalThis, key: "Uint32Array", label: "Uint32Array", kind: "constructor" },
    { owner: globalThis, key: "Map", label: "Map", kind: "constructor" },
    { owner: globalThis, key: "Set", label: "Set", kind: "constructor" },
    { owner: globalThis, key: "structuredClone", label: "structuredClone" },
    { owner: NativeArray, key: "isArray", label: "Array.isArray" },
    { owner: NativeArray.prototype, key: "forEach", label: "Array.forEach" },
    { owner: NativeArray.prototype, key: "some", label: "Array.some" },
    { owner: NativeArray.prototype, key: "sort", label: "Array.sort" },
    { owner: NativeArray.prototype, key: iteratorKey, label: "Array.iterator" },
    { owner: Math, key: "ceil", label: "Math.ceil" },
    { owner: Math, key: "floor", label: "Math.floor" },
    { owner: NativeNumber, key: "isSafeInteger", label: "Number.isSafeInteger" },
    { owner: NativeNumber.prototype, key: "toString", label: "Number.toString" },
    { owner: NativeObject, key: "create", label: "Object.create" },
    { owner: NativeObject, key: "freeze", label: "Object.freeze" },
    { owner: NativeObject, key: "getOwnPropertyDescriptor", label: "Object.getOwnPropertyDescriptor" },
    { owner: NativeObject, key: "getOwnPropertyDescriptors", label: "Object.getOwnPropertyDescriptors" },
    { owner: NativeObject, key: "getOwnPropertySymbols", label: "Object.getOwnPropertySymbols" },
    { owner: NativeObject, key: "getPrototypeOf", label: "Object.getPrototypeOf" },
    { owner: NativeObject, key: "keys", label: "Object.keys" },
    { owner: NativeObject.prototype, key: "hasOwnProperty", label: "Object.hasOwnProperty" },
    { owner: NativeReflect, key: "apply", label: "Reflect.apply" },
    { owner: NativeRegExp.prototype, key: "exec", label: "RegExp.exec" },
    {
      owner: NativeRegExp.prototype,
      key: "test",
      label: "RegExp.test",
      forgedResult: true,
    },
    { owner: NativeString.prototype, key: "charCodeAt", label: "String.charCodeAt" },
    { owner: NativeString.prototype, key: "indexOf", label: "String.indexOf" },
    { owner: NativeString.prototype, key: "padStart", label: "String.padStart" },
    { owner: NativeString.prototype, key: "slice", label: "String.slice" },
    { owner: NativeString.prototype, key: iteratorKey, label: "String.iterator" },
    { owner: NativeTextDecoder.prototype, key: "decode", label: "TextDecoder.decode" },
    { owner: NativeTextEncoder.prototype, key: "encode", label: "TextEncoder.encode" },
    { owner: NativeUint8Array.prototype, key: "set", label: "Uint8Array.set" },
    { owner: NativeUint8Array.prototype, key: iteratorKey, label: "Uint8Array.iterator" },
    { owner: NativeUint8Array, key: hasInstanceKey, label: "Uint8Array.hasInstance" },
    { owner: typedArrayPrototype, key: "byteLength", label: "TypedArray.byteLength", kind: "getter" },
    { owner: NativeMap.prototype, key: "get", label: "Map.get" },
    { owner: NativeMap.prototype, key: "set", label: "Map.set" },
    { owner: NativeMap.prototype, key: "has", label: "Map.has" },
    { owner: NativeSet.prototype, key: "add", label: "Set.add" },
    {
      owner: NativeSet.prototype,
      key: "has",
      label: "Set.has",
      forgedResult: true,
    },
  ];

  function includesV1(value: string, search: string): boolean {
    return nativeReflectApply(nativeStringIncludes, value, [search]) as boolean;
  }

  function hasFirstPartyCallerV1(): boolean {
    const previousPrepareStackTrace = NativeError.prepareStackTrace;
    try {
      NativeError.prepareStackTrace = (_error, callSites) =>
        callSites as unknown as string;
      const callSites = new NativeError().stack as unknown as
        | readonly NodeJS.CallSite[]
        | undefined;
      if (callSites === undefined) return false;
      for (let index = 0; index < callSites.length; index += 1) {
        const fileName = callSites[index]?.getFileName();
        if (typeof fileName !== "string" || fileName === THIS_TEST_FILE_V1) {
          continue;
        }
        if (
          includesV1(fileName, "/src/provider-fixed-locator.ts") ||
          includesV1(fileName, "/src/sha256.ts")
        ) {
          return true;
        }
      }
      return false;
    } finally {
      NativeError.prepareStackTrace = previousPrepareStackTrace;
    }
  }

  const originals = new NativeArray<{
    readonly candidate: PrimordialCandidateV1;
    readonly descriptor: PropertyDescriptor | undefined;
    readonly replacementDescriptor: PropertyDescriptor;
  }>(candidates.length);

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index]!;
    const descriptor = nativeGetOwnPropertyDescriptor(
      candidate.owner,
      candidate.key,
    );
    const original = candidate.kind === "getter"
      ? descriptor?.get
      : descriptor?.value ?? nativeReflectGet(candidate.owner, candidate.key);
    if (typeof original !== "function") {
      throw new NativeTypeError(
        `primordial descriptor unavailable: ${candidate.label}`,
      );
    }

    const replacement = function fixedLocatorPrimordialPoisonV1(
      this: unknown,
      ...args: unknown[]
    ): unknown {
      if (hasFirstPartyCallerV1()) {
        firstPartyHits += 1;
        firstPartyLabels[firstPartyLabels.length] = candidate.label;
        if (candidate.forgedResult !== undefined) {
          return candidate.forgedResult;
        }
        throw new NativeTypeError(
          `late-bound fixed-locator primordial: ${candidate.label}`,
        );
      }
      if (candidate.forgedResult !== undefined) {
        return candidate.forgedResult;
      }
      if (new.target !== undefined) {
        return nativeReflectConstruct(original, args, original);
      }
      return nativeReflectApply(original, this, args);
    };

    if (candidate.kind === "constructor") {
      nativeSetPrototypeOf(replacement, original);
      const prototypeDescriptor = nativeGetOwnPropertyDescriptor(
        original,
        "prototype",
      );
      if (prototypeDescriptor !== undefined) {
        nativeDefineProperty(
          replacement,
          "prototype",
          prototypeDescriptor,
        );
      }
    }

    originals[index] = {
      candidate,
      descriptor,
      replacementDescriptor: candidate.kind === "getter"
        ? {
            configurable: descriptor?.configurable ?? true,
            enumerable: descriptor?.enumerable ?? false,
            get: replacement,
          }
        : {
            configurable: descriptor?.configurable ?? true,
            enumerable: descriptor?.enumerable ?? false,
            writable: descriptor === undefined || "writable" in descriptor
              ? descriptor?.writable ?? true
              : true,
            value: replacement,
          },
    };
  }

  return {
    get firstPartyHits() {
      return firstPartyHits;
    },
    get firstPartyLabels() {
      return firstPartyLabels;
    },
    install() {
      if (installed) return;
      installed = true;
      for (let index = 0; index < originals.length; index += 1) {
        const entry = originals[index]!;
        nativeDefineProperty(
          entry.candidate.owner,
          entry.candidate.key,
          entry.replacementDescriptor,
        );
      }
    },
    restore() {
      if (!installed) return;
      for (let index = originals.length - 1; index >= 0; index -= 1) {
        const entry = originals[index]!;
        if (entry.descriptor === undefined) {
          nativeDeleteProperty(entry.candidate.owner, entry.candidate.key);
        } else {
          nativeDefineProperty(
            entry.candidate.owner,
            entry.candidate.key,
            entry.descriptor,
          );
        }
      }
      installed = false;
    },
  };
}

describe("fixed locator post-load primordial closure", () => {
  it("keeps short/hashed bytes and build paths stable while malformed values fail closed", () => {
    const shortSemanticId = "provider-real-fs-result:0123456789abcdefabcdef";
    const longSemanticId = `long:${"z".repeat(300)}`;
    const generationId =
      "provider-registry-manifest:0123456789abcdefabcdef";
    const rootKeyId = "0123456789abcdefabcdef";
    const shortKeyBefore = encodeStoreFilenameKeyV1(shortSemanticId);
    const longKeyBefore = encodeStoreFilenameKeyV1(longSemanticId);
    const rootPathBefore = buildProviderRegistryRootMetadataRelativePathV1({
      locatorProfile: "installation_provider_registry_root_metadata_v1",
      rootGeneration: 1,
      rootKeyId,
    });
    const manifestLocator = {
      locatorProfile: PROVIDER_REGISTRY_MANIFEST_LOCATOR_PROFILE_V1,
      generationId,
    } as const;
    const manifestPathBefore =
      buildProviderRegistryManifestRelativePathV1(manifestLocator);
    const poison = createFixedLocatorPrimordialPoisonV1();
    let shortKeyAfter: unknown;
    let longKeyAfter: unknown;
    let decodedAfter: unknown;
    let verifiedAfter: unknown;
    let rootPathAfter: unknown;
    let manifestPathAfter: unknown;
    let validatedPathAfter: unknown;
    let malformedShortRejected = false;
    let mismatchedHashRejected = false;
    let aliasedLocatorRejected = false;
    let forgedGenerationRejected = false;
    let forgedProfileRejected = false;
    let operationFailure: unknown;

    poison.install();
    try {
      shortKeyAfter = encodeStoreFilenameKeyV1(shortSemanticId);
      longKeyAfter = encodeStoreFilenameKeyV1(longSemanticId);
      decodedAfter = decodeShortStoreFilenameKeyV1(shortKeyBefore);
      verifiedAfter = verifyStoreFilenameKeyForSemanticIdV1(
        longKeyBefore,
        longSemanticId,
      );
      rootPathAfter = buildProviderRegistryRootMetadataRelativePathV1({
        locatorProfile: "installation_provider_registry_root_metadata_v1",
        rootGeneration: 1,
        rootKeyId,
      });
      manifestPathAfter =
        buildProviderRegistryManifestRelativePathV1(manifestLocator);
      validatedPathAfter =
        validateProviderRegistryManifestRelativePathV1(manifestLocator);
      try {
        decodeShortStoreFilenameKeyV1("id-c5");
      } catch {
        malformedShortRejected = true;
      }
      try {
        verifyStoreFilenameKeyForSemanticIdV1(
          longKeyBefore,
          `long:${"y".repeat(300)}`,
        );
      } catch {
        mismatchedHashRejected = true;
      }
      try {
        buildProviderRegistryManifestRelativePathV1({
          ...manifestLocator,
          path: manifestPathBefore,
        });
      } catch {
        aliasedLocatorRejected = true;
      }
      try {
        buildProviderRegistryManifestRelativePathV1({
          ...manifestLocator,
          generationId: "evil",
        });
      } catch {
        forgedGenerationRejected = true;
      }
      try {
        buildProviderRegistryManifestRelativePathV1({
          ...manifestLocator,
          locatorProfile: "totally_wrong",
        });
      } catch {
        forgedProfileRejected = true;
      }
    } catch (error) {
      operationFailure = error;
    } finally {
      poison.restore();
    }

    expect(operationFailure).toBeUndefined();
    expect(poison.firstPartyHits, poison.firstPartyLabels.join(", ")).toBe(0);
    expect(shortKeyAfter).toBe(shortKeyBefore);
    expect(longKeyAfter).toBe(longKeyBefore);
    expect(decodedAfter).toBe(shortSemanticId);
    expect(verifiedAfter).toBe(longKeyBefore);
    expect(rootPathAfter).toBe(rootPathBefore);
    expect(manifestPathAfter).toBe(manifestPathBefore);
    expect(validatedPathAfter).toBe(manifestPathBefore);
    expect(malformedShortRejected).toBe(true);
    expect(mismatchedHashRejected).toBe(true);
    expect(aliasedLocatorRejected).toBe(true);
    expect(forgedGenerationRejected).toBe(true);
    expect(forgedProfileRejected).toBe(true);
  });
});
