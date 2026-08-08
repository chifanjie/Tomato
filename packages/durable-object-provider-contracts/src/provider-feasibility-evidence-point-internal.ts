/**
 * Package-internal prepared Evidence helpers for C09-1L.
 *
 * The public Evidence helpers intentionally accept either a complete Evidence
 * value or one of their projection DTOs.  C09-1L has a stricter staged
 * diagnostic contract: identity, signature messages, and the content digest
 * must be derived from an already detached payload without asking the public
 * helpers to strict-parse both signature wires ahead of their role-specific
 * stages.  This module supplies that narrow boundary and is deliberately not
 * present in the package export map or root barrel.
 */

import {
  createDomainPreimageBytesV1,
} from "./domain-crypto.js";
import {
  PROVIDER_FEASIBILITY_EVIDENCE_DOMAIN_V1,
  PROVIDER_FEASIBILITY_EVIDENCE_ID_DOMAIN_V1,
  PROVIDER_FEASIBILITY_EVIDENCE_QA_SIGNATURE_DOMAIN_V1,
  PROVIDER_FEASIBILITY_EVIDENCE_RELEASE_SIGNATURE_DOMAIN_V1,
  ProviderFeasibilityEvidenceIdFieldsV1Schema,
  ProviderFeasibilityEvidenceQaSignatureWrapperV1Schema,
  ProviderFeasibilityEvidenceReleaseSignatureWrapperV1Schema,
  ProviderFeasibilityEvidenceUnsignedClaimsV1Schema,
  type ProviderFeasibilityEvidenceIdFieldsV1,
  type ProviderFeasibilityEvidenceUnsignedClaimsV1,
  type ProviderFeasibilityEvidenceV1,
} from "./provider-feasibility-evidence-point.js";
import {
  ContentDigestV1Schema,
  ProviderFeasibilityApproverKeyIdV1Schema,
  ProviderFeasibilityEvidenceIdV1Schema,
  type ContentDigestV1,
  type ProviderFeasibilityApproverKeyIdV1,
  type ProviderFeasibilityEvidenceIdV1,
} from "./primitives.js";
import { sha256InternalV1 } from "./sha256.js";

const CapturedObjectCreateV1 = Object.create;
const CapturedObjectDefinePropertyV1 = Object.defineProperty;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedFunctionPrototypeBindV1 = Function.prototype.bind;
const CapturedFunctionPrototypeCallV1 = Function.prototype.call;
const CapturedNumberParseIntV1 = Number.parseInt;
const CapturedNumberPrototypeToStringV1 = Number.prototype.toString;
const CapturedStringPrototypePadStartV1 = String.prototype.padStart;
const CapturedStringPrototypeSliceV1 = String.prototype.slice;
const CapturedRegExpPrototypeExecV1 = RegExp.prototype.exec;
const CapturedTypeErrorV1 = TypeError;
const CapturedUint8ArrayV1 = Uint8Array;

function bindUncurriedEvidenceIntrinsicV1(method: Function): Function {
  const argumentsList = CapturedObjectFreezeV1([method]);
  return CapturedObjectFreezeV1(
    CapturedReflectApplyV1(
      CapturedFunctionPrototypeBindV1,
      CapturedFunctionPrototypeCallV1,
      argumentsList,
    ) as Function,
  );
}

const numberToStringV1 = bindUncurriedEvidenceIntrinsicV1(
  CapturedNumberPrototypeToStringV1,
) as (receiver: number, radix?: number) => string;
const stringPadStartV1 = bindUncurriedEvidenceIntrinsicV1(
  CapturedStringPrototypePadStartV1,
) as (receiver: string, length: number, fill?: string) => string;
const stringSliceV1 = bindUncurriedEvidenceIntrinsicV1(
  CapturedStringPrototypeSliceV1,
) as (receiver: string, start?: number, end?: number) => string;
const regExpExecV1 = bindUncurriedEvidenceIntrinsicV1(
  CapturedRegExpPrototypeExecV1,
) as (receiver: RegExp, value: string) => RegExpExecArray | null;

function defineFrozenEnumerableDataV1(
  target: object,
  key: string,
  value: unknown,
): void {
  const descriptor = CapturedObjectCreateV1(null) as Record<string, unknown>;
  descriptor.value = value;
  descriptor.enumerable = true;
  descriptor.configurable = false;
  descriptor.writable = false;
  CapturedObjectDefinePropertyV1(target, key, descriptor);
}

function createFrozenRecordV1<T extends object>(
  entries: readonly (readonly [string, unknown])[],
): T {
  const record = CapturedObjectCreateV1(null) as object;
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]!;
    defineFrozenEnumerableDataV1(record, entry[0], entry[1]);
  }
  return CapturedObjectFreezeV1(record) as T;
}

function bytesToLowerHexV1(bytes: Uint8Array): string {
  let output = "";
  for (let index = 0; index < bytes.byteLength; index += 1) {
    output += stringPadStartV1(numberToStringV1(bytes[index]!, 16), 2, "0");
  }
  return output;
}

function digestForPreparedDomainV1(
  domain: string,
  fields: object,
): ContentDigestV1 {
  return ContentDigestV1Schema.parse(
    `sha256:${bytesToLowerHexV1(
      sha256InternalV1(createDomainPreimageBytesV1(domain, fields)),
    )}`,
  );
}

/** Exact D-35 sixteen-field projection; signatures are never observed. @internal */
export function projectProviderFeasibilityEvidenceIdFieldsFromPreparedPayloadInternalV1(
  payload: ProviderFeasibilityEvidenceV1,
): ProviderFeasibilityEvidenceIdFieldsV1 {
  const projection = createFrozenRecordV1<ProviderFeasibilityEvidenceIdFieldsV1>([
    ["providerId", payload.providerId],
    ["semanticProviderPolicyDigest", payload.semanticProviderPolicyDigest],
    ["runtimeAttestationContentDigest", payload.runtimeAttestationContentDigest],
    ["implementationDigest", payload.implementationDigest],
    ["binaryAttestationDigest", payload.binaryAttestationDigest],
    ["target", payload.target],
    [
      "isolationSecurityBoundaryProfileDigest",
      payload.isolationSecurityBoundaryProfileDigest,
    ],
    ["ipcPeerAuthenticationPolicyDigest", payload.ipcPeerAuthenticationPolicyDigest],
    ["realFilesystemSuiteDigest", payload.realFilesystemSuiteDigest],
    ["realFilesystemConformanceResult", payload.realFilesystemConformanceResult],
    [
      "realFilesystemConformanceResultDigest",
      payload.realFilesystemConformanceResultDigest,
    ],
    ["fixtureManifestDigest", payload.fixtureManifestDigest],
    ["runnerProfileDigest", payload.runnerProfileDigest],
    ["crashCutCoverageDigest", payload.crashCutCoverageDigest],
    ["result", payload.result],
    ["issuedAt", payload.issuedAt],
  ]);
  if (!ProviderFeasibilityEvidenceIdFieldsV1Schema.safeParse(projection).success) {
    throw new CapturedTypeErrorV1(
      "prepared feasibility Evidence identity projection is invalid",
    );
  }
  return projection;
}

/** Reuses the original D-35 ID domain without parsing signature wires. @internal */
export function deriveProviderFeasibilityEvidenceIdFromPreparedPayloadInternalV1(
  payload: ProviderFeasibilityEvidenceV1,
): ProviderFeasibilityEvidenceIdV1 {
  const fields =
    projectProviderFeasibilityEvidenceIdFieldsFromPreparedPayloadInternalV1(
      payload,
    );
  const hex = bytesToLowerHexV1(
    sha256InternalV1(
      createDomainPreimageBytesV1(
        PROVIDER_FEASIBILITY_EVIDENCE_ID_DOMAIN_V1,
        fields,
      ),
    ),
  );
  return ProviderFeasibilityEvidenceIdV1Schema.parse(
    `provider-feasibility-evidence:${stringSliceV1(hex, 0, 22)}`,
  );
}

/** Exact unsigned claims projection from an already staged payload. @internal */
export function projectProviderFeasibilityEvidenceUnsignedClaimsFromPreparedPayloadInternalV1(
  payload: ProviderFeasibilityEvidenceV1,
): ProviderFeasibilityEvidenceUnsignedClaimsV1 {
  const claims = createFrozenRecordV1<ProviderFeasibilityEvidenceUnsignedClaimsV1>([
    ["profile", payload.profile],
    ["evidenceId", payload.evidenceId],
    ["providerId", payload.providerId],
    ["semanticProviderPolicyDigest", payload.semanticProviderPolicyDigest],
    ["runtimeAttestationContentDigest", payload.runtimeAttestationContentDigest],
    ["implementationDigest", payload.implementationDigest],
    ["binaryAttestationDigest", payload.binaryAttestationDigest],
    ["target", payload.target],
    [
      "isolationSecurityBoundaryProfileDigest",
      payload.isolationSecurityBoundaryProfileDigest,
    ],
    ["ipcPeerAuthenticationPolicyDigest", payload.ipcPeerAuthenticationPolicyDigest],
    ["realFilesystemSuiteDigest", payload.realFilesystemSuiteDigest],
    ["realFilesystemConformanceResult", payload.realFilesystemConformanceResult],
    [
      "realFilesystemConformanceResultDigest",
      payload.realFilesystemConformanceResultDigest,
    ],
    ["fixtureManifestDigest", payload.fixtureManifestDigest],
    ["runnerProfileDigest", payload.runnerProfileDigest],
    ["crashCutCoverageDigest", payload.crashCutCoverageDigest],
    ["result", payload.result],
    ["issuedAt", payload.issuedAt],
  ]);
  if (!ProviderFeasibilityEvidenceUnsignedClaimsV1Schema.safeParse(claims).success) {
    throw new CapturedTypeErrorV1(
      "prepared feasibility Evidence unsigned claims are invalid",
    );
  }
  return claims;
}

/** Builds the QA message without re-parsing complete Evidence. @internal */
export function createProviderFeasibilityEvidenceQaSignatureMessageFromPreparedPayloadInternalV1(
  payload: ProviderFeasibilityEvidenceV1,
  keyId: ProviderFeasibilityApproverKeyIdV1,
): Uint8Array {
  const parsedKeyId = ProviderFeasibilityApproverKeyIdV1Schema.parse(keyId);
  const wrapper = createFrozenRecordV1<{
    readonly role: "qa";
    readonly keyId: ProviderFeasibilityApproverKeyIdV1;
    readonly claims: ProviderFeasibilityEvidenceUnsignedClaimsV1;
  }>([
    ["role", "qa"],
    ["keyId", parsedKeyId],
    [
      "claims",
      projectProviderFeasibilityEvidenceUnsignedClaimsFromPreparedPayloadInternalV1(
        payload,
      ),
    ],
  ]);
  if (!ProviderFeasibilityEvidenceQaSignatureWrapperV1Schema.safeParse(wrapper).success) {
    throw new CapturedTypeErrorV1("prepared QA Evidence wrapper is invalid");
  }
  return createDomainPreimageBytesV1(
    PROVIDER_FEASIBILITY_EVIDENCE_QA_SIGNATURE_DOMAIN_V1,
    wrapper,
  );
}

/** Builds the Release message without re-parsing complete Evidence. @internal */
export function createProviderFeasibilityEvidenceReleaseSignatureMessageFromPreparedPayloadInternalV1(
  payload: ProviderFeasibilityEvidenceV1,
  keyId: ProviderFeasibilityApproverKeyIdV1,
): Uint8Array {
  const parsedKeyId = ProviderFeasibilityApproverKeyIdV1Schema.parse(keyId);
  const wrapper = createFrozenRecordV1<{
    readonly role: "release";
    readonly keyId: ProviderFeasibilityApproverKeyIdV1;
    readonly claims: ProviderFeasibilityEvidenceUnsignedClaimsV1;
  }>([
    ["role", "release"],
    ["keyId", parsedKeyId],
    [
      "claims",
      projectProviderFeasibilityEvidenceUnsignedClaimsFromPreparedPayloadInternalV1(
        payload,
      ),
    ],
  ]);
  if (
    !ProviderFeasibilityEvidenceReleaseSignatureWrapperV1Schema.safeParse(wrapper)
      .success
  ) {
    throw new CapturedTypeErrorV1("prepared Release Evidence wrapper is invalid");
  }
  return createDomainPreimageBytesV1(
    PROVIDER_FEASIBILITY_EVIDENCE_RELEASE_SIGNATURE_DOMAIN_V1,
    wrapper,
  );
}

/** Recomputes the D-35 content digest after both wire-binding stages. @internal */
export function deriveProviderFeasibilityEvidenceContentDigestFromPreparedPayloadInternalV1(
  payload: ProviderFeasibilityEvidenceV1,
): ContentDigestV1 {
  return digestForPreparedDomainV1(
    PROVIDER_FEASIBILITY_EVIDENCE_DOMAIN_V1,
    payload,
  );
}

export interface PreparedProviderFeasibilityEvidenceSignatureBindingV1 {
  readonly role: "qa" | "release";
  readonly keyId: ProviderFeasibilityApproverKeyIdV1;
  readonly signatureBytes: Uint8Array;
}

const QA_SIGNATURE_PATTERN_V1 =
  /^provider-feasibility-ed25519:qa:([0-9a-f]{22}):([0-9a-f]{128})$/u;
const RELEASE_SIGNATURE_PATTERN_V1 =
  /^provider-feasibility-ed25519:release:([0-9a-f]{22}):([0-9a-f]{128})$/u;

/** Performs the complete role-specific canonical wire binding. @internal */
export function parseProviderFeasibilityEvidenceSignatureBindingInternalV1(
  signature: unknown,
  role: "qa" | "release",
): PreparedProviderFeasibilityEvidenceSignatureBindingV1 {
  if (typeof signature !== "string") {
    throw new CapturedTypeErrorV1("feasibility Evidence signature must be a string");
  }
  const match = regExpExecV1(
    role === "qa" ? QA_SIGNATURE_PATTERN_V1 : RELEASE_SIGNATURE_PATTERN_V1,
    signature,
  );
  if (match?.[1] === undefined || match[2] === undefined) {
    throw new CapturedTypeErrorV1(
      "feasibility Evidence signature wire is not canonical",
    );
  }
  const bytes = new CapturedUint8ArrayV1(64);
  for (let index = 0; index < bytes.byteLength; index += 1) {
    bytes[index] = CapturedNumberParseIntV1(
      stringSliceV1(match[2], index * 2, index * 2 + 2),
      16,
    );
  }
  return createFrozenRecordV1<PreparedProviderFeasibilityEvidenceSignatureBindingV1>([
    ["role", role],
    ["keyId", ProviderFeasibilityApproverKeyIdV1Schema.parse(match[1])],
    ["signatureBytes", bytes],
  ]);
}

CapturedObjectFreezeV1(
  projectProviderFeasibilityEvidenceIdFieldsFromPreparedPayloadInternalV1,
);
CapturedObjectFreezeV1(
  deriveProviderFeasibilityEvidenceIdFromPreparedPayloadInternalV1,
);
CapturedObjectFreezeV1(
  projectProviderFeasibilityEvidenceUnsignedClaimsFromPreparedPayloadInternalV1,
);
CapturedObjectFreezeV1(
  createProviderFeasibilityEvidenceQaSignatureMessageFromPreparedPayloadInternalV1,
);
CapturedObjectFreezeV1(
  createProviderFeasibilityEvidenceReleaseSignatureMessageFromPreparedPayloadInternalV1,
);
CapturedObjectFreezeV1(
  deriveProviderFeasibilityEvidenceContentDigestFromPreparedPayloadInternalV1,
);
CapturedObjectFreezeV1(
  parseProviderFeasibilityEvidenceSignatureBindingInternalV1,
);
