import { z } from "zod";

import {
  STEP16_ALPHA_GOLD_BLOCKED_CORPUS_MANIFEST_DIGEST_V1,
  type AlphaGoldTaskCorpusV1,
} from "./alpha-gold.js";
import {
  IsoTimestampSchema,
  NonEmptyStringSchema,
  OpaqueIdentifierSchema,
  SchemaVersionV1Schema,
} from "./primitives.js";

const ContentDigestV1Schema = z.string().regex(/^sha256:[0-9a-f]{64}$/u);
const RelativePathV1Schema = NonEmptyStringSchema
  .refine((value) => !value.startsWith("/") && !/^[A-Za-z]:[\\/]/u.test(value),
    "task paths must be repository-relative")
  .refine((value) => !value.split(/[\\/]/u).includes(".."),
    "task paths must not escape the repository");

export const AlphaGoldCoverageTagV1Schema = z.enum([
  "cross_file",
  "test_impact",
  "unplanned_change",
  "known_unknown_boundary",
]);

const AlphaGoldTaskReviewV1Schema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("pending"),
    reviewerIds: z.tuple([]),
  }),
  z.strictObject({
    status: z.literal("approved"),
    reviewerIds: z.tuple([OpaqueIdentifierSchema, OpaqueIdentifierSchema])
      .superRefine((reviewers, context) => {
        if (reviewers[0] === reviewers[1]) {
          context.addIssue({ code: "custom", message: "reviewers must be distinct" });
        }
      }),
    reviewedAt: IsoTimestampSchema,
  }),
]);

export const AlphaGoldTaskDefinitionV1Schema = z.strictObject({
  slotId: OpaqueIdentifierSchema,
  corpus: z.enum(["alpha-a", "alpha-b"]),
  ordinal: z.number().int().min(1).max(18),
  title: NonEmptyStringSchema,
  intent: NonEmptyStringSchema,
  targetPaths: z.array(RelativePathV1Schema).min(1).max(8),
  requiredStages: z.tuple([
    z.literal("repo_pulse"),
    z.literal("task_brief"),
    z.literal("change_check"),
    z.literal("verification"),
  ]),
  coverageTags: z.array(AlphaGoldCoverageTagV1Schema).min(1).max(4),
  review: AlphaGoldTaskReviewV1Schema,
}).superRefine((task, context) => {
  if (new Set(task.coverageTags).size !== task.coverageTags.length) {
    context.addIssue({ code: "custom", path: ["coverageTags"], message: "coverage tags must be unique" });
  }
  if (!/^alpha-[ab]-slot-\d{2}$/u.test(task.slotId) || !task.slotId.startsWith(task.corpus)) {
    context.addIssue({ code: "custom", path: ["slotId"], message: "slotId must match its corpus" });
  }
  const maximum = task.corpus === "alpha-a" ? 18 : 6;
  if (task.ordinal > maximum) {
    context.addIssue({ code: "custom", path: ["ordinal"], message: "ordinal exceeds corpus count" });
  }
});

export type AlphaGoldTaskDefinitionV1 = z.infer<typeof AlphaGoldTaskDefinitionV1Schema>;

const ReviewGateV1Schema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("pending"), reviewerIds: z.tuple([]) }),
  z.strictObject({
    status: z.literal("approved"),
    reviewerIds: z.tuple([OpaqueIdentifierSchema, OpaqueIdentifierSchema])
      .superRefine((reviewers, context) => {
        if (reviewers[0] === reviewers[1]) {
          context.addIssue({ code: "custom", message: "reviewers must be distinct" });
        }
      }),
    reviewedAt: IsoTimestampSchema,
  }),
]);

export const AlphaGoldTaskDefinitionManifestV1Schema = z.strictObject({
  schemaVersion: SchemaVersionV1Schema,
  profile: z.literal("alpha_gold_task_definition_manifest_v1"),
  corpusId: z.literal("step16-alpha-gold-v1"),
  corpusManifestDigest: ContentDigestV1Schema,
  status: z.enum(["draft", "versioned_two_person_reviewed"]),
  ownerReview: ReviewGateV1Schema,
  definitions: z.array(AlphaGoldTaskDefinitionV1Schema).length(24),
}).superRefine((manifest, context) => {
  if (manifest.corpusManifestDigest !== STEP16_ALPHA_GOLD_BLOCKED_CORPUS_MANIFEST_DIGEST_V1) {
    context.addIssue({ code: "custom", path: ["corpusManifestDigest"], message: "manifest must bind the frozen blocked corpus digest" });
  }
  const expected = new Set([
    ...Array.from({ length: 18 }, (_, index) => `alpha-a-slot-${String(index + 1).padStart(2, "0")}`),
    ...Array.from({ length: 6 }, (_, index) => `alpha-b-slot-${String(index + 1).padStart(2, "0")}`),
  ]);
  const seen = new Set<string>();
  for (const [index, task] of manifest.definitions.entries()) {
    if (!expected.has(task.slotId) || seen.has(task.slotId)) {
      context.addIssue({ code: "custom", path: ["definitions", index, "slotId"], message: "definitions must cover each corpus slot exactly once" });
    }
    seen.add(task.slotId);
  }
  const minimums = { cross_file: 8, test_impact: 6, unplanned_change: 4, known_unknown_boundary: 4 } as const;
  for (const [tag, minimum] of Object.entries(minimums) as Array<[keyof typeof minimums, number]>) {
    const count = manifest.definitions.filter((task) => task.coverageTags.includes(tag)).length;
    if (count < minimum) context.addIssue({ code: "custom", path: ["definitions"], message: `${tag} coverage requires at least ${minimum} tasks` });
  }
  if (manifest.status === "versioned_two_person_reviewed") {
    if (manifest.ownerReview.status !== "approved") {
      context.addIssue({ code: "custom", path: ["ownerReview"], message: "versioned definitions require owner review approval" });
    }
    manifest.definitions.forEach((task, index) => {
      if (task.review.status !== "approved") context.addIssue({ code: "custom", path: ["definitions", index, "review"], message: "every versioned task requires two-person approval" });
    });
  }
});

export type AlphaGoldTaskDefinitionManifestV1 = z.infer<typeof AlphaGoldTaskDefinitionManifestV1Schema>;

/** Generates a deterministic, blocked draft from the frozen 18/6 slot corpus. */
export function createAlphaGoldTaskDefinitionDraftFixtureV1(
  corpus: AlphaGoldTaskCorpusV1,
): AlphaGoldTaskDefinitionManifestV1 {
  const definitions = corpus.taskSlots.map((slot, index) => ({
    slotId: slot.slotId,
    corpus: slot.corpus,
    ordinal: slot.ordinal,
    title: `Gold task ${slot.slotId}`,
    intent: `Exercise the ${slot.corpus === "alpha-a" ? "TypeScript" : "large Go"} change path for slot ${slot.ordinal}.`,
    targetPaths: [slot.corpus === "alpha-a" ? "packages/core/src" : "internal/domain"],
    requiredStages: [...slot.requiredStages] as ["repo_pulse", "task_brief", "change_check", "verification"],
    coverageTags: [
      ...(index < 8 ? ["cross_file" as const] : []),
      ...(index < 24 ? ["test_impact" as const] : []),
      ...(index < 4 ? ["unplanned_change" as const] : []),
      ...(index < 4 ? ["known_unknown_boundary" as const] : []),
    ].slice(0, 4),
    review: { status: "pending" as const, reviewerIds: [] as [] },
  }));
  return AlphaGoldTaskDefinitionManifestV1Schema.parse({
    schemaVersion: 1,
    profile: "alpha_gold_task_definition_manifest_v1",
    corpusId: corpus.corpusId,
    corpusManifestDigest: "sha256:a28d28fde25d384407b304db732d37dae4a1d7eb20b4f7ffcfb9ed7bcaaf293b",
    status: "draft",
    ownerReview: { status: "pending", reviewerIds: [] },
    definitions,
  });
}
