/** Strict package-private migration-only Acceptance record family. */

import { z } from "./zod-runtime.js";

import { createDomainPreimageBytesV1 } from "./domain-crypto.js";
import { canonicalizeJcsSafeIntegerV1 } from "./jcs.js";
import {
  ContentDigestV1Schema,
  InstallationIdentityGenerationIdV1Schema,
  KeyedStateTokenV1Schema,
  ProviderAcceptanceStateGenerationIdV1Schema,
  ProviderMigrationIdV1Schema,
  type ContentDigestV1,
} from "./primitives.js";
import {
  ProviderFeasibilitySupportCatalogPinV1Schema,
} from "./provider-feasibility-support-catalog-point.js";
import {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinReferenceCandidateV1Schema,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-formal-plan-reference-candidate-wire.js";
import {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveWriterProjectionReferenceCandidateV1Schema,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-plan-admission-reference-candidate-wire.js";
import {
  ProviderAcceptanceGenerationPredecessorV1Schema,
  ProviderActiveWriterSelectionV1Schema,
  ProviderActiveWriterSelectorV1Schema,
} from "./provider-strong-ready-acceptance-candidate.js";
import {
  ProviderRegistryManifestPinV1Schema,
} from "./provider-registry-records.js";
import {
  ProviderRegistryIsoTimestampV1Schema,
  ProviderRegistryRootMetadataPinV1Schema,
} from "./provider-registry-trust.js";
import {
  deepFreezeProviderPointDetachedDataTreeV1,
} from "./provider-point-raw-admission-internal.js";
import { sha256InternalV1 } from "./sha256.js";

const CapturedObjectFreezeV1 = Object.freeze;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedStringPrototypeSliceV1 = String.prototype.slice;

const GENERATION_DOMAIN_V1 =
  "provider-migration-same-installation-identity-current-strong-source-normal-migration-only-acceptance-generation-v1";
const CONTENT_DOMAIN_V1 =
  "provider-migration-same-installation-identity-current-strong-source-normal-migration-only-acceptance-content-v1";

function bytesToLowerHexV1(bytes: Uint8Array): string {
  const alphabet = "0123456789abcdef";
  let output = "";
  for (let index = 0; index < bytes.byteLength; index += 1) {
    const byte = bytes[index]!;
    output +=
      alphabet[(byte >>> 4) & 0x0f]! + alphabet[byte & 0x0f]!;
  }
  return output;
}

function digestV1(domain: string, fields: object): ContentDigestV1 {
  return ContentDigestV1Schema.parse(
    `sha256:${bytesToLowerHexV1(
      sha256InternalV1(createDomainPreimageBytesV1(domain, fields)),
    )}`,
  );
}

function canonicalEqualV1(left: unknown, right: unknown): boolean {
  return canonicalizeJcsSafeIntegerV1(left) ===
    canonicalizeJcsSafeIntegerV1(right);
}

const PositiveSafeIntegerV1Schema = z
  .number()
  .int()
  .min(1)
  .max(Number.MAX_SAFE_INTEGER);

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceConfigurationInternalV1Schema =
  z
    .strictObject({
      state: z.literal("migration_only"),
      reason: z.literal("provider_decommission"),
      publishedTrustPins: z.strictObject({
        rootMetadata: ProviderRegistryRootMetadataPinV1Schema,
        registryManifest: ProviderRegistryManifestPinV1Schema,
        supportCatalog: ProviderFeasibilitySupportCatalogPinV1Schema,
      }),
      publicStrongWriter: z.strictObject({
        state: z.literal("disabled"),
        reason: z.literal(
          "migration_only_acceptance_does_not_select_a_public_writer_v1",
        ),
        previousActiveWriterSelector: ProviderActiveWriterSelectorV1Schema,
      }),
      formalPlanPin:
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinReferenceCandidateV1Schema,
      executor: z.strictObject({
        state: z.literal("enabled_for_plan_only"),
        formalMigrationId: ProviderMigrationIdV1Schema,
      }),
      sourceWriter: ProviderActiveWriterSelectionV1Schema,
      destinationWriter:
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveWriterProjectionReferenceCandidateV1Schema,
    })
    .superRefine((configuration, context) => {
      if (
        configuration.executor.formalMigrationId !==
          configuration.formalPlanPin.formalMigrationId
      ) {
        context.addIssue({
          code: "custom",
          path: ["executor", "formalMigrationId"],
          message: "plan-only executor must bind the exact formal Plan",
        });
      }
      if (
        configuration.sourceWriter.providerId ===
          configuration.destinationWriter.providerId ||
        configuration.sourceWriter.targetProfileId !==
          configuration.destinationWriter.targetProfileId
      ) {
        context.addIssue({
          code: "custom",
          path: ["destinationWriter"],
          message:
            "migration-only source and destination must be different writers on one target",
        });
      }
      let sourceMatches = 0;
      let destinationMatches = 0;
      const selections =
        configuration.publicStrongWriter.previousActiveWriterSelector
          .selections;
      for (let index = 0; index < selections.length; index += 1) {
        if (canonicalEqualV1(selections[index], configuration.sourceWriter)) {
          sourceMatches += 1;
        }
        if (
          selections[index]!.providerId ===
            configuration.destinationWriter.providerId
        ) {
          destinationMatches += 1;
        }
      }
      if (sourceMatches !== 1 || destinationMatches !== 0) {
        context.addIssue({
          code: "custom",
          path: ["publicStrongWriter", "previousActiveWriterSelector"],
          message:
            "disabled public writer proof must retain exactly the source and exclude the destination",
        });
      }
    });
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceConfigurationInternalV1 =
  z.infer<
    typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceConfigurationInternalV1Schema
  >;

const GenerationFieldsInternalV1Schema = z.strictObject({
  installationIdentityGenerationId:
    InstallationIdentityGenerationIdV1Schema,
  acceptanceOrdinal: PositiveSafeIntegerV1Schema,
  predecessor: ProviderAcceptanceGenerationPredecessorV1Schema,
  configuration:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceConfigurationInternalV1Schema,
});

const PayloadUnsignedShapeInternalV1 = {
  profile: z.literal(
    "provider_migration_same_installation_identity_current_strong_source_normal_migration_only_acceptance_payload_reference_candidate_v1",
  ),
  generationId: ProviderAcceptanceStateGenerationIdV1Schema,
  installationIdentityGenerationId:
    InstallationIdentityGenerationIdV1Schema,
  acceptanceOrdinal: PositiveSafeIntegerV1Schema,
  predecessor: ProviderAcceptanceGenerationPredecessorV1Schema,
  configuration:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceConfigurationInternalV1Schema,
  acceptedAt: ProviderRegistryIsoTimestampV1Schema,
} as const;

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptancePayloadInternalV1Schema =
  z.strictObject({
    ...PayloadUnsignedShapeInternalV1,
    acceptanceToken: KeyedStateTokenV1Schema,
  });
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptancePayloadInternalV1 =
  z.infer<
    typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptancePayloadInternalV1Schema
  >;

export function deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceGenerationIdInternalV1(
  input: unknown,
) {
  const payload = input as Partial<
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptancePayloadInternalV1
  >;
  const fields = GenerationFieldsInternalV1Schema.parse({
    installationIdentityGenerationId:
      payload.installationIdentityGenerationId,
    acceptanceOrdinal: payload.acceptanceOrdinal,
    predecessor: payload.predecessor,
    configuration: payload.configuration,
  });
  const digest = digestV1(GENERATION_DOMAIN_V1, fields);
  const lowerHex = CapturedReflectApplyV1(
    CapturedStringPrototypeSliceV1,
    digest,
    ["sha256:".length, "sha256:".length + 22],
  ) as string;
  return ProviderAcceptanceStateGenerationIdV1Schema.parse(
    `provider-acceptance-state:${lowerHex}`,
  );
}

export function deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceContentDigestInternalV1(
  input: unknown,
): ContentDigestV1 {
  const signed =
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptancePayloadInternalV1Schema.safeParse(
      input,
    );
  const source = signed.success
    ? signed.data
    : (input as Partial<
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptancePayloadInternalV1
    >);
  const unsigned = z.strictObject(PayloadUnsignedShapeInternalV1).parse({
    profile: source.profile,
    generationId: source.generationId,
    installationIdentityGenerationId:
      source.installationIdentityGenerationId,
    acceptanceOrdinal: source.acceptanceOrdinal,
    predecessor: source.predecessor,
    configuration: source.configuration,
    acceptedAt: source.acceptedAt,
  });
  return digestV1(CONTENT_DOMAIN_V1, unsigned);
}

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceEnvelopeInternalV1Schema =
  z
    .strictObject({
      schemaVersion: z.literal(1),
      recordType: z.literal(
        "provider_migration_same_installation_identity_current_strong_source_normal_migration_only_acceptance_reference_candidate",
      ),
      generationId: ProviderAcceptanceStateGenerationIdV1Schema,
      installationIdentityGenerationId:
        InstallationIdentityGenerationIdV1Schema,
      acceptedAt: ProviderRegistryIsoTimestampV1Schema,
      contentDigest: ContentDigestV1Schema,
      payload:
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptancePayloadInternalV1Schema,
    })
    .superRefine((envelope, context) => {
      const payload = envelope.payload;
      if (
        envelope.generationId !== payload.generationId ||
        envelope.installationIdentityGenerationId !==
          payload.installationIdentityGenerationId ||
        envelope.acceptedAt !== payload.acceptedAt ||
        payload.generationId !==
          deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceGenerationIdInternalV1(
            payload,
          ) ||
        envelope.contentDigest !==
          deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceContentDigestInternalV1(
            payload,
          )
      ) {
        context.addIssue({
          code: "custom",
          path: ["payload"],
          message:
            "migration-only Acceptance Envelope must bind exact identity, generation, configuration, and content",
        });
      }
    });
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceEnvelopeInternalV1 =
  z.infer<
    typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceEnvelopeInternalV1Schema
  >;

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptancePinInternalV1Schema =
  z.strictObject({
    locatorProfile: z.literal(
      "installation_provider_migration_only_acceptance_reference_candidate_v1",
    ),
    acceptanceOrdinal: PositiveSafeIntegerV1Schema,
    generationId: ProviderAcceptanceStateGenerationIdV1Schema,
    contentDigest: ContentDigestV1Schema,
  });
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptancePinInternalV1 =
  z.infer<
    typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptancePinInternalV1Schema
  >;

export function deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptancePinInternalV1(
  input: unknown,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptancePinInternalV1 {
  const envelope =
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceEnvelopeInternalV1Schema.parse(
      input,
    );
  return deepFreezeProviderPointDetachedDataTreeV1(
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptancePinInternalV1Schema.parse(
      {
        locatorProfile:
          "installation_provider_migration_only_acceptance_reference_candidate_v1",
        acceptanceOrdinal: envelope.payload.acceptanceOrdinal,
        generationId: envelope.generationId,
        contentDigest: envelope.contentDigest,
      },
    ),
  );
}

export function validateProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceEnvelopeInternalV1(
  input: unknown,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceEnvelopeInternalV1 {
  return deepFreezeProviderPointDetachedDataTreeV1(
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceEnvelopeInternalV1Schema.parse(
      input,
    ),
  );
}

for (const exportedFunctionV1 of [
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceGenerationIdInternalV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceContentDigestInternalV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptancePinInternalV1,
  validateProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceEnvelopeInternalV1,
]) CapturedObjectFreezeV1(exportedFunctionV1);
