import { z } from "zod";

import {
  createDomainPreimageBytesV1,
  deriveKeyedStateTokenForDomainV1,
  deriveSemanticHashV1,
  type ProviderCryptoHostV1,
} from "./domain-crypto.js";
import {
  canonicalizeJcsSafeIntegerUtf8V1,
  canonicalizeJcsSafeIntegerV1,
  parseCanonicalJcsSafeIntegerUtf8V1,
  RFC8785_JCS_SAFE_INTEGER_PROFILE_V1,
} from "./jcs.js";
import {
  INSTALLATION_IDENTITY_GENERATION_DOMAIN_V1,
  INSTALLATION_IDENTITY_KEY_CHECK_DOMAIN_V1,
  InstallationIdentityGenerationFieldsV1Schema,
  InstallationIdentityKeyCheckFieldsV1Schema,
  PROVIDER_REGISTRY_ROOT_KEY_ID_DOMAIN_V1,
  ProviderRegistryRootKeyIdFieldsV1Schema,
  deriveInstallationIdentityGenerationIdV1,
  deriveInstallationIdentityKeyCheckTokenV1,
  deriveProviderRegistryRootKeyIdV1,
} from "./provider-foundation.js";
import {
  CanonicalByteStringV1Schema,
  ContentDigestV1Schema,
  DurableObjectIdentityProviderIdV1Schema,
  DurableObjectIdentityProviderSlugV1Schema,
  InstallationIdentityGenerationIdV1Schema,
  KeyedStateTokenV1Schema,
  ProviderRegistryRootKeyIdV1Schema,
} from "./primitives.js";

const EvenLowerHexBytesV1Schema = z
  .string()
  .regex(/^(?:[0-9a-f]{2})+$/u);
const Sha256HexV1Schema = z.string().regex(/^[0-9a-f]{64}$/u);
const TestKeyHexV1Schema = z.string().regex(/^[0-9a-f]{64}$/u);

const ExpectedStableDerivationV1Schema = z.strictObject({
  canonicalPreimageUtf8Hex: EvenLowerHexBytesV1Schema,
  sha256Hex: Sha256HexV1Schema,
  id: z.string().min(1),
});

const InstallationIdentityStableVectorV1Schema = z.strictObject({
  caseId: z.literal("installation-identity-generation-v1"),
  domain: z.literal(INSTALLATION_IDENTITY_GENERATION_DOMAIN_V1),
  outputPrefix: z.literal("installation-identity-generation"),
  fields: InstallationIdentityGenerationFieldsV1Schema,
  expected: ExpectedStableDerivationV1Schema.extend({
    id: InstallationIdentityGenerationIdV1Schema,
  }),
});

const ProviderRegistryRootKeyStableVectorV1Schema = z.strictObject({
  caseId: z.literal("provider-registry-root-key-id-v1"),
  domain: z.literal(PROVIDER_REGISTRY_ROOT_KEY_ID_DOMAIN_V1),
  outputEncoding: z.literal("lower_hex_22"),
  fields: ProviderRegistryRootKeyIdFieldsV1Schema,
  expected: ExpectedStableDerivationV1Schema.extend({
    id: ProviderRegistryRootKeyIdV1Schema,
  }),
});

const InstallationIdentityKeyCheckHmacVectorV1Schema = z.strictObject({
  caseId: z.literal("installation-identity-key-check-v1"),
  domain: z.literal(INSTALLATION_IDENTITY_KEY_CHECK_DOMAIN_V1),
  keyHex: TestKeyHexV1Schema,
  fields: InstallationIdentityKeyCheckFieldsV1Schema,
  expected: z.strictObject({
    canonicalMessageUtf8Hex: EvenLowerHexBytesV1Schema,
    sha256Hex: Sha256HexV1Schema,
    hmacSha256Hex: Sha256HexV1Schema,
    token: z
      .string()
      .regex(/^hmac-sha256:[0-9a-f]{64}$/u),
  }),
});

const CanonicalJsonVectorV1Schema = z.strictObject({
  caseId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*-v1$/u),
  input: z.json(),
  expectedUtf8Hex: EvenLowerHexBytesV1Schema,
});

export const ProviderContractGoldenManifestV1Schema = z.strictObject({
  schemaVersion: z.literal(1),
  profile: z.literal(RFC8785_JCS_SAFE_INTEGER_PROFILE_V1),
  stableIdVectors: z.tuple([
    InstallationIdentityStableVectorV1Schema,
    ProviderRegistryRootKeyStableVectorV1Schema,
  ]),
  hmacVectors: z.tuple([InstallationIdentityKeyCheckHmacVectorV1Schema]),
  canonicalJsonVectors: z
    .array(CanonicalJsonVectorV1Schema)
    .min(5),
});
export type ProviderContractGoldenManifestV1 = z.infer<
  typeof ProviderContractGoldenManifestV1Schema
>;

const CanonicalBytesNegativeCaseV1Schema = z.strictObject({
  caseId: z.string().min(1),
  kind: z.literal("canonical_bytes"),
  inputHex: z.string().regex(/^(?:[0-9a-f]{2})+$/u),
});

const UnsupportedValueNegativeCaseV1Schema = z.strictObject({
  caseId: z.string().min(1),
  kind: z.literal("unsupported_value"),
  representation: z.enum([
    "nan",
    "positive_infinity",
    "negative_infinity",
    "undefined",
    "bigint",
    "function",
    "symbol",
    "sparse_array",
    "getter",
    "non_enumerable",
    "array_accessor",
    "array_extra_property",
    "map",
    "class_instance",
    "cycle",
  ]),
});

const SchemaNegativeCaseV1Schema = z.strictObject({
  caseId: z.string().min(1),
  kind: z.literal("schema"),
  target: z.enum([
    "canonical_byte_string",
    "content_digest",
    "installation_identity_generation_fields",
    "installation_identity_generation_id",
    "installation_identity_key_check_fields",
    "keyed_state_token",
    "provider_registry_root_key_id",
    "provider_registry_root_key_id_fields",
    "provider_slug",
    "provider_id",
  ]),
  input: z.json(),
});

const SetNegativeCaseV1Schema = z.strictObject({
  caseId: z.string().min(1),
  kind: z.literal("utf8_bytewise_string_set"),
  input: z.array(z.string()).min(2),
});

const DomainSubstitutionNegativeCaseV1Schema = z.strictObject({
  caseId: z.string().min(1),
  kind: z.literal("substitution"),
  target: z.literal("domain"),
  substitutedDomain: z.literal(
    "installation-identity-generation-substitute-v1",
  ),
});

const PrefixSubstitutionNegativeCaseV1Schema = z.strictObject({
  caseId: z.string().min(1),
  kind: z.literal("substitution"),
  target: z.literal("prefix"),
  substitutedValue: z.string().min(1),
});

const KeyIdSubstitutionNegativeCaseV1Schema = z.strictObject({
  caseId: z.string().min(1),
  kind: z.literal("substitution"),
  target: z.literal("key_id"),
  substitutedFields: ProviderRegistryRootKeyIdFieldsV1Schema,
});

const HmacKeySubstitutionNegativeCaseV1Schema = z.strictObject({
  caseId: z.string().min(1),
  kind: z.literal("substitution"),
  target: z.literal("hmac_key"),
  substitutedKeyHex: TestKeyHexV1Schema,
});

const GenerationIdSubstitutionNegativeCaseV1Schema = z.strictObject({
  caseId: z.string().min(1),
  kind: z.literal("substitution"),
  target: z.literal("generation_id"),
  substitutedFields: InstallationIdentityKeyCheckFieldsV1Schema,
});

const SubstitutionNegativeCaseV1Schema = z.discriminatedUnion("target", [
  DomainSubstitutionNegativeCaseV1Schema,
  PrefixSubstitutionNegativeCaseV1Schema,
  KeyIdSubstitutionNegativeCaseV1Schema,
  HmacKeySubstitutionNegativeCaseV1Schema,
  GenerationIdSubstitutionNegativeCaseV1Schema,
]);

export const ProviderContractNegativeManifestV1Schema = z.strictObject({
  schemaVersion: z.literal(1),
  profile: z.literal(RFC8785_JCS_SAFE_INTEGER_PROFILE_V1),
  cases: z
    .array(
      z.union([
        CanonicalBytesNegativeCaseV1Schema,
        UnsupportedValueNegativeCaseV1Schema,
        SchemaNegativeCaseV1Schema,
        SetNegativeCaseV1Schema,
        SubstitutionNegativeCaseV1Schema,
      ]),
    )
    .min(20),
}).superRefine((manifest, context) => {
  const seen = new Set<string>();
  for (const [index, negativeCase] of manifest.cases.entries()) {
    if (seen.has(negativeCase.caseId)) {
      context.addIssue({
        code: "custom",
        message: `duplicate negative caseId ${negativeCase.caseId}`,
        path: ["cases", index, "caseId"],
      });
    }
    seen.add(negativeCase.caseId);
  }
});
export type ProviderContractNegativeManifestV1 = z.infer<
  typeof ProviderContractNegativeManifestV1Schema
>;

function bytesToLowerHex(bytes: Uint8Array): string {
  let output = "";
  for (const byte of bytes) output += byte.toString(16).padStart(2, "0");
  return output;
}

function lowerHexToBytes(hex: string): Uint8Array {
  if (!/^(?:[0-9a-f]{2})+$/u.test(hex)) {
    throw new TypeError("hex fixture must contain complete lowercase octets");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function assertEqual(actual: string, expected: string, context: string): void {
  if (actual !== expected) {
    throw new Error(`${context} mismatch: expected ${expected}, received ${actual}`);
  }
}

export async function verifyProviderContractGoldenManifestV1(
  input: unknown,
  cryptoHost: ProviderCryptoHostV1,
): Promise<ProviderContractGoldenManifestV1> {
  const manifest = ProviderContractGoldenManifestV1Schema.parse(input);
  const [installationVector, rootKeyVector] = manifest.stableIdVectors;

  const installationHash = await deriveSemanticHashV1(
    cryptoHost,
    installationVector.domain,
    installationVector.fields,
  );
  assertEqual(
    bytesToLowerHex(installationHash.canonicalPreimageUtf8),
    installationVector.expected.canonicalPreimageUtf8Hex,
    installationVector.caseId,
  );
  assertEqual(
    installationHash.sha256Hex,
    installationVector.expected.sha256Hex,
    installationVector.caseId,
  );
  assertEqual(
    await deriveInstallationIdentityGenerationIdV1(
      installationVector.fields,
      cryptoHost,
    ),
    installationVector.expected.id,
    installationVector.caseId,
  );

  const rootKeyHash = await deriveSemanticHashV1(
    cryptoHost,
    rootKeyVector.domain,
    rootKeyVector.fields,
  );
  assertEqual(
    bytesToLowerHex(rootKeyHash.canonicalPreimageUtf8),
    rootKeyVector.expected.canonicalPreimageUtf8Hex,
    rootKeyVector.caseId,
  );
  assertEqual(
    rootKeyHash.sha256Hex,
    rootKeyVector.expected.sha256Hex,
    rootKeyVector.caseId,
  );
  assertEqual(
    await deriveProviderRegistryRootKeyIdV1(rootKeyVector.fields, cryptoHost),
    rootKeyVector.expected.id,
    rootKeyVector.caseId,
  );

  const [hmacVector] = manifest.hmacVectors;
  const hmacMessage = createDomainPreimageBytesV1(
    hmacVector.domain,
    hmacVector.fields,
  );
  assertEqual(
    bytesToLowerHex(hmacMessage),
    hmacVector.expected.canonicalMessageUtf8Hex,
    hmacVector.caseId,
  );
  const hmacMessageDigest = await cryptoHost.sha256(hmacMessage.slice());
  assertEqual(
    bytesToLowerHex(hmacMessageDigest),
    hmacVector.expected.sha256Hex,
    hmacVector.caseId,
  );
  const token = await deriveInstallationIdentityKeyCheckTokenV1(
    hmacVector.fields,
    lowerHexToBytes(hmacVector.keyHex),
    cryptoHost,
  );
  assertEqual(token, hmacVector.expected.token, hmacVector.caseId);
  assertEqual(
    token.slice("hmac-sha256:".length),
    hmacVector.expected.hmacSha256Hex,
    hmacVector.caseId,
  );

  for (const vector of manifest.canonicalJsonVectors) {
    assertEqual(
      bytesToLowerHex(canonicalizeJcsSafeIntegerUtf8V1(vector.input)),
      vector.expectedUtf8Hex,
      vector.caseId,
    );
  }
  return manifest;
}

function expectFailure(operation: () => unknown, context: string): void {
  try {
    operation();
  } catch {
    return;
  }
  throw new Error(`${context} unexpectedly succeeded`);
}

async function expectAsyncFailure(
  operation: () => Promise<unknown>,
  context: string,
): Promise<void> {
  try {
    await operation();
  } catch {
    return;
  }
  throw new Error(`${context} unexpectedly succeeded`);
}

function unsupportedFixtureValue(
  representation: z.infer<
    typeof UnsupportedValueNegativeCaseV1Schema
  >["representation"],
): unknown {
  switch (representation) {
    case "nan":
      return Number.NaN;
    case "positive_infinity":
      return Number.POSITIVE_INFINITY;
    case "negative_infinity":
      return Number.NEGATIVE_INFINITY;
    case "undefined":
      return undefined;
    case "bigint":
      return BigInt(1);
    case "function":
      return () => undefined;
    case "symbol":
      return Symbol("fixture");
    case "sparse_array": {
      const value = [1, 2];
      delete value[0];
      return value;
    }
    case "getter":
      return Object.defineProperty({}, "value", {
        enumerable: true,
        get() {
          throw new Error("getter must never execute");
        },
      });
    case "non_enumerable":
      return Object.defineProperty({}, "value", {
        enumerable: false,
        value: 1,
      });
    case "array_accessor": {
      const value: unknown[] = [];
      Object.defineProperty(value, "0", {
        enumerable: true,
        get() {
          throw new Error("array accessor must never execute");
        },
      });
      return value;
    }
    case "array_extra_property": {
      const value = [1] as unknown[] & { extra?: number };
      value.extra = 2;
      return value;
    }
    case "map":
      return new Map([["value", 1]]);
    case "class_instance": {
      class FixtureClass {
        readonly value = 1;
      }
      return new FixtureClass();
    }
    case "cycle": {
      const value: Record<string, unknown> = {};
      value.self = value;
      return value;
    }
  }
}

function parseSchemaNegativeCase(
  target: z.infer<typeof SchemaNegativeCaseV1Schema>["target"],
  input: unknown,
): unknown {
  switch (target) {
    case "canonical_byte_string":
      return CanonicalByteStringV1Schema.parse(input);
    case "content_digest":
      return ContentDigestV1Schema.parse(input);
    case "installation_identity_generation_fields":
      return InstallationIdentityGenerationFieldsV1Schema.parse(input);
    case "installation_identity_generation_id":
      return InstallationIdentityGenerationIdV1Schema.parse(input);
    case "installation_identity_key_check_fields":
      return InstallationIdentityKeyCheckFieldsV1Schema.parse(input);
    case "provider_registry_root_key_id_fields":
      return ProviderRegistryRootKeyIdFieldsV1Schema.parse(input);
    case "provider_registry_root_key_id":
      return ProviderRegistryRootKeyIdV1Schema.parse(input);
    case "keyed_state_token":
      return KeyedStateTokenV1Schema.parse(input);
    case "provider_slug":
      return DurableObjectIdentityProviderSlugV1Schema.parse(input);
    case "provider_id":
      return DurableObjectIdentityProviderIdV1Schema.parse(input);
  }
}

function assertSortedUniqueUtf8Strings(values: string[]): void {
  for (let index = 0; index < values.length; index += 1) {
    canonicalizeJcsSafeIntegerV1(values[index]);
    if (index === 0) continue;
    const previous = new TextEncoder().encode(values[index - 1]!);
    const current = new TextEncoder().encode(values[index]!);
    const length = Math.min(previous.length, current.length);
    let order = 0;
    for (let offset = 0; offset < length; offset += 1) {
      if (previous[offset] === current[offset]) continue;
      order = previous[offset]! < current[offset]! ? -1 : 1;
      break;
    }
    if (order === 0) {
      order = previous.length < current.length ? -1 : previous.length === current.length ? 0 : 1;
    }
    if (order >= 0) throw new TypeError("set must be UTF-8 bytewise sorted and unique");
  }
}

export async function verifyProviderContractNegativeManifestV1(
  input: unknown,
  goldenInput: unknown,
  cryptoHost: ProviderCryptoHostV1,
): Promise<ProviderContractNegativeManifestV1> {
  const manifest = ProviderContractNegativeManifestV1Schema.parse(input);
  const golden = ProviderContractGoldenManifestV1Schema.parse(goldenInput);
  const installation = golden.stableIdVectors[0];
  const rootKey = golden.stableIdVectors[1];
  const hmac = golden.hmacVectors[0];

  for (const negativeCase of manifest.cases) {
    switch (negativeCase.kind) {
      case "canonical_bytes":
        expectFailure(
          () => parseCanonicalJcsSafeIntegerUtf8V1(lowerHexToBytes(negativeCase.inputHex)),
          negativeCase.caseId,
        );
        break;
      case "unsupported_value":
        expectFailure(
          () => canonicalizeJcsSafeIntegerV1(unsupportedFixtureValue(negativeCase.representation)),
          negativeCase.caseId,
        );
        break;
      case "schema":
        expectFailure(
          () => parseSchemaNegativeCase(negativeCase.target, negativeCase.input),
          negativeCase.caseId,
        );
        break;
      case "utf8_bytewise_string_set":
        expectFailure(
          () => assertSortedUniqueUtf8Strings(negativeCase.input),
          negativeCase.caseId,
        );
        break;
      case "substitution":
        switch (negativeCase.target) {
          case "domain": {
            const substituted = await deriveSemanticHashV1(
              cryptoHost,
              negativeCase.substitutedDomain,
              installation.fields,
            );
            if (substituted.sha256Hex === installation.expected.sha256Hex) {
              throw new Error(`${negativeCase.caseId} failed to separate domains`);
            }
            break;
          }
          case "prefix":
            expectFailure(
              () =>
                InstallationIdentityGenerationIdV1Schema.parse(
                  negativeCase.substitutedValue,
                ),
              negativeCase.caseId,
            );
            break;
          case "key_id": {
            const substituted = await deriveProviderRegistryRootKeyIdV1(
              negativeCase.substitutedFields,
              cryptoHost,
            );
            if (substituted === rootKey.expected.id) {
              throw new Error(`${negativeCase.caseId} failed to bind key material`);
            }
            break;
          }
          case "hmac_key": {
            const substituted = await deriveKeyedStateTokenForDomainV1(
              cryptoHost,
              lowerHexToBytes(negativeCase.substitutedKeyHex),
              hmac.domain,
              hmac.fields,
            );
            if (substituted === hmac.expected.token) {
              throw new Error(`${negativeCase.caseId} failed to bind the HMAC key`);
            }
            break;
          }
          case "generation_id":
            await expectAsyncFailure(
              () =>
                deriveInstallationIdentityKeyCheckTokenV1(
                  negativeCase.substitutedFields,
                  lowerHexToBytes(hmac.keyHex),
                  cryptoHost,
                ),
              negativeCase.caseId,
            );
            break;
        }
        break;
    }
  }

  return manifest;
}
