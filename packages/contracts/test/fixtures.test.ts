import Ajv2020 from "ajv/dist/2020.js";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  ArtifactManifestV1Schema,
  ChangeCheckArtifactV1Schema,
  ClaimLedgerArtifactV1Schema,
  EvidenceLedgerArtifactV1Schema,
  ImpactArtifactV1Schema,
  LEGACY_RAW_ARTIFACT_DESCRIPTORS_V1,
  RepoPulseArtifactV1Schema,
  RepositorySnapshotArtifactV1Schema,
  RepositorySnapshotV1Schema,
  PersistedArtifactV1Schema,
  TaskArtifactBundleV1Schema,
  TaskBriefArtifactV1Schema,
  TaskEventV1Schema,
  TaskManifestArtifactV1Schema,
  VerificationArtifactV1Schema,
  canonicalArtifactPayloadJson,
  decideLegacyCompatibility,
} from "../src/index.js";

const fixtureRoot = fileURLToPath(new URL("../fixtures/v1", import.meta.url));
const schemaRoot = fileURLToPath(new URL("../schemas/v1", import.meta.url));

function readText(section: string, fileName: string): string {
  return readFileSync(join(fixtureRoot, section, fileName), "utf8");
}

function readJson(section: string, fileName: string): unknown {
  return JSON.parse(readText(section, fileName)) as unknown;
}

function payloadDigest(artifact: { payload: unknown }): string {
  return `sha256:${createHash("sha256")
    .update(canonicalArtifactPayloadJson(artifact), "utf8")
    .digest("hex")}`;
}

const artifactParsers = {
  "repository-snapshot.json": RepositorySnapshotArtifactV1Schema,
  "repo-pulse.json": RepoPulseArtifactV1Schema,
  "task.json": TaskManifestArtifactV1Schema,
  "task-brief.json": TaskBriefArtifactV1Schema,
  "claims.json": ClaimLedgerArtifactV1Schema,
  "evidence.json": EvidenceLedgerArtifactV1Schema,
  "impact.json": ImpactArtifactV1Schema,
  "change-check.json": ChangeCheckArtifactV1Schema,
  "verification.json": VerificationArtifactV1Schema,
} as const;

const artifactSchemaNames = {
  "repository-snapshot.json": "repository-snapshot-artifact",
  "repo-pulse.json": "repo-pulse-artifact",
  "task.json": "task-manifest-artifact",
  "task-brief.json": "task-brief-artifact",
  "claims.json": "claim-ledger-artifact",
  "evidence.json": "evidence-ledger-artifact",
  "impact.json": "impact-artifact",
  "change-check.json": "change-check-artifact",
  "verification.json": "verification-artifact",
} as const;

describe("tracked V1 contract fixtures", () => {
  it("parses every reference artifact and verifies its payload digest", () => {
    for (const [fileName, parser] of Object.entries(artifactParsers)) {
      const parsed = parser.parse(readJson("reference", fileName));
      expect(parsed.contentDigest, fileName).toBe(payloadDigest(parsed));
      expect(
        PersistedArtifactV1Schema.safeParse(parsed).success,
        `${fileName} must pass the typed Artifact dispatcher`,
      ).toBe(true);
    }

    expect(
      ArtifactManifestV1Schema.safeParse(
        readJson("reference", "artifact-manifest.json"),
      ).success,
    ).toBe(true);
    expect(
      TaskArtifactBundleV1Schema.safeParse(
        readJson("reference", "task-bundle.json"),
      ).success,
    ).toBe(true);
    expect(
      RepositorySnapshotV1Schema.safeParse(
        readJson("reference", "repository-error-snapshot.json"),
      ).success,
    ).toBe(true);

    const eventLines = readText("reference", "events.jsonl")
      .trimEnd()
      .split("\n");
    expect(eventLines.length).toBeGreaterThan(1);
    for (const line of eventLines) {
      expect(TaskEventV1Schema.safeParse(JSON.parse(line)).success).toBe(true);
    }
  });

  it("does not let the base envelope disguise a payload as another Artifact type", () => {
    const repositoryArtifact = readJson(
      "reference",
      "repository-snapshot.json",
    ) as Record<string, unknown>;
    expect(
      PersistedArtifactV1Schema.safeParse({
        ...repositoryArtifact,
        artifactType: "repo_pulse",
      }).success,
    ).toBe(false);
  });

  it("validates reference artifacts with independently compiled JSON Schemas", () => {
    const ajv = new Ajv2020({
      allErrors: true,
      strict: false,
      validateFormats: false,
    });

    for (const [fileName, schemaName] of Object.entries(artifactSchemaNames)) {
      const schema = JSON.parse(
        readFileSync(join(schemaRoot, `${schemaName}.schema.json`), "utf8"),
      );
      const validate = ajv.compile(schema);
      expect(
        validate(readJson("reference", fileName)),
        `${fileName}: ${JSON.stringify(validate.errors)}`,
      ).toBe(true);
    }
  });

  it("fails closed for malformed, incompatible, dangling, and stale fixtures", () => {
    expect(() =>
      JSON.parse(readText("invalid", "corrupt-json.txt")),
    ).toThrow();
    expect(
      TaskManifestArtifactV1Schema.safeParse(
        readJson("invalid", "blocked-task-without-state.json"),
      ).success,
    ).toBe(false);
    expect(
      TaskArtifactBundleV1Schema.safeParse(
        readJson("invalid", "dangling-task-bundle.json"),
      ).success,
    ).toBe(false);
    expect(
      RepositorySnapshotArtifactV1Schema.safeParse(
        readJson("invalid", "unknown-version-artifact.json"),
      ).success,
    ).toBe(false);
    expect(
      ArtifactManifestV1Schema.safeParse(
        readJson("invalid", "stale-dependency-manifest.json"),
      ).success,
    ).toBe(false);
  });

  it("keeps digest verification distinct from structural parsing", () => {
    const parsed = RepositorySnapshotArtifactV1Schema.parse(
      readJson("invalid", "digest-mismatch-artifact.json"),
    );
    expect(parsed.contentDigest).not.toBe(payloadDigest(parsed));
  });

  it("covers every registered legacy descriptor with an exact fixture", () => {
    const legacyCases = [
      ["graph-v1.json", "graph", "graph_v1", "1.0.0"],
      ["meta-v1.json", "graph_meta", "graph_meta_v1", "1.0.0"],
      ["fingerprints-v1.json", "fingerprint", "fingerprint_v1", "1.0.0"],
      ["wiki-index-v1.json", "wiki_index", "wiki_v1", "1"],
      ["wiki-index-v2.json", "wiki_index", "wiki_v2", "2"],
      [
        "wiki-search-v2.json",
        "wiki_search_index",
        "wiki_search_v2",
        "2",
      ],
      [
        "wiki-document-traces-v2.json",
        "wiki_document_traces",
        "wiki_document_traces_v2",
        "2",
      ],
      [
        "wiki-generation-report-v2.json",
        "wiki_generation_report",
        "wiki_generation_report_v2",
        "2",
      ],
      ["diff-overlay-v1.json", "diff_overlay", "diff_overlay_v1", "1.0.0"],
    ] as const;

    expect(
      legacyCases.map(([, artifactType, format, schemaVersion]) => ({
        artifactType,
        format,
        schemaVersion,
      })),
    ).toEqual(
      LEGACY_RAW_ARTIFACT_DESCRIPTORS_V1.map(
        ({ artifactType, format, schemaVersion }) => ({
          artifactType,
          format,
          schemaVersion,
        }),
      ),
    );

    for (const [fileName, artifactType, format, schemaVersion] of legacyCases) {
      expect(readJson("legacy", fileName)).toBeTypeOf("object");
      const descriptor = LEGACY_RAW_ARTIFACT_DESCRIPTORS_V1.find(
        (candidate) =>
          candidate.artifactType === artifactType &&
          candidate.format === format &&
          candidate.schemaVersion === schemaVersion,
      );
      expect(descriptor, fileName).toBeDefined();
      if (descriptor === undefined) continue;
      expect(
        decideLegacyCompatibility(descriptor, {
          observedVersion: descriptor.schemaVersion,
        }).readable,
      ).toBe(true);
    }
  });
});
