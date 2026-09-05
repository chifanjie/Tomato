import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";

import {
  AlphaGoldTaskCorpusV1Schema,
  AlphaGoldTaskDefinitionManifestV1Schema,
  createAlphaGoldTaskDefinitionDraftFixtureV1,
} from "../src/index.js";

const fixtureRoot = fileURLToPath(new URL("../fixtures/v1/golden", import.meta.url));
const schemaRoot = fileURLToPath(new URL("../schemas/v1", import.meta.url));

function readJson(fileName: string): any {
  return JSON.parse(readFileSync(join(fixtureRoot, fileName), "utf8"));
}

describe("versioned Alpha Gold task definitions", () => {
  it("parses the deterministic draft fixture and covers every frozen slot", () => {
    const corpus = AlphaGoldTaskCorpusV1Schema.parse(readJson("alpha-gold-task-corpus-v1.json"));
    const fixture = readJson("alpha-gold-task-definition-manifest-v1.json");
    expect(AlphaGoldTaskDefinitionManifestV1Schema.parse(fixture)).toEqual(fixture);
    expect(createAlphaGoldTaskDefinitionDraftFixtureV1(corpus)).toEqual(fixture);
    expect(fixture.status).toBe("draft");
    expect(fixture.ownerReview.status).toBe("pending");
    expect(new Set(fixture.definitions.map((task: any) => task.slotId)).size).toBe(24);
    expect(fixture.definitions.filter((task: any) => task.coverageTags.includes("cross_file"))).toHaveLength(8);
    expect(fixture.definitions.filter((task: any) => task.coverageTags.includes("test_impact"))).toHaveLength(24);
    expect(fixture.definitions.filter((task: any) => task.coverageTags.includes("unplanned_change"))).toHaveLength(4);
    expect(fixture.definitions.filter((task: any) => task.coverageTags.includes("known_unknown_boundary"))).toHaveLength(4);
  });

  it("requires two distinct approvals before a manifest can be versioned", () => {
    const fixture = readJson("alpha-gold-task-definition-manifest-v1.json");
    const versioned = {
      ...fixture,
      status: "versioned_two_person_reviewed",
      ownerReview: { status: "approved", reviewerIds: ["product", "qa"], reviewedAt: "2026-09-05T00:00:00Z" },
      definitions: fixture.definitions.map((task: any) => ({
        ...task,
        review: { status: "approved", reviewerIds: ["product", "qa"], reviewedAt: "2026-09-05T00:00:00Z" },
      })),
    };
    expect(AlphaGoldTaskDefinitionManifestV1Schema.safeParse(versioned).success).toBe(true);
    expect(AlphaGoldTaskDefinitionManifestV1Schema.safeParse({
      ...versioned,
      definitions: versioned.definitions.map((task: any, index: number) => index === 0 ? { ...task, review: fixture.definitions[0].review } : task),
    }).success).toBe(false);
    expect(AlphaGoldTaskDefinitionManifestV1Schema.safeParse({
      ...versioned,
      ownerReview: { status: "approved", reviewerIds: ["product", "product"], reviewedAt: "2026-09-05T00:00:00Z" },
    }).success).toBe(false);
  });

  it("rejects absolute paths, duplicate tags, duplicate slots, and missing coverage", () => {
    const fixture = readJson("alpha-gold-task-definition-manifest-v1.json");
    expect(AlphaGoldTaskDefinitionManifestV1Schema.safeParse({
      ...fixture,
      corpusManifestDigest: "sha256:" + "f".repeat(64),
    }).success).toBe(false);
    expect(AlphaGoldTaskDefinitionManifestV1Schema.safeParse({
      ...fixture,
      definitions: fixture.definitions.map((task: any, index: number) => index === 0 ? { ...task, targetPaths: ["/tmp/private"] } : task),
    }).success).toBe(false);
    expect(AlphaGoldTaskDefinitionManifestV1Schema.safeParse({
      ...fixture,
      definitions: fixture.definitions.map((task: any, index: number) => index === 0 ? { ...task, coverageTags: ["cross_file", "cross_file"] } : task),
    }).success).toBe(false);
    expect(AlphaGoldTaskDefinitionManifestV1Schema.safeParse({
      ...fixture,
      definitions: fixture.definitions.map((task: any, index: number) => index === 1 ? { ...task, slotId: fixture.definitions[0].slotId } : task),
    }).success).toBe(false);
  });

  it("has an independently compiled JSON Schema", () => {
    const schema = JSON.parse(readFileSync(join(schemaRoot, "alpha-gold-task-definition-manifest.schema.json"), "utf8"));
    const validate = new Ajv2020({ strict: false }).compile(schema);
    expect(validate(readJson("alpha-gold-task-definition-manifest-v1.json"))).toBe(true);
  });
});
