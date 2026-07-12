import { describe, expect, it } from "vitest";
import { parseWikiIndexV2 } from "@understand-code/core";
import type { WikiIndexV2, WikiPageV2 } from "@understand-code/core/knowledge-base";
import { largeWikiFixture } from "./fixtures/wikiV2Fixtures";
import { buildWikiRuntimeIndex } from "../wikiIndex";
import {
  buildWikiNavigation,
  canonicalReferenceOwnerPath,
  loadReferenceChildren,
  visibleReferenceRows,
} from "../navigationModel";

describe("Wiki navigation", () => {
  it("canonicalizes every reference owner prefix and rejects unsafe paths", () => {
    expect(canonicalReferenceOwnerPath("file:\\src\\app.ts\\")).toBe("src/app.ts");
    expect(canonicalReferenceOwnerPath("config:/config/app.yaml/")).toBe("config/app.yaml");
    expect(canonicalReferenceOwnerPath("schema:\\schemas\\event.json")).toBe("schemas/event.json");
    expect(canonicalReferenceOwnerPath("document:/docs/run.md")).toBe("docs/run.md");

    for (const ownerId of [
      "file:",
      "file:/",
      "config:.",
      "schema:..",
      "document:docs/../secret.md",
      "file:src/./app.ts",
      "file:src/\0secret.ts",
      "file:src/\u0001secret.ts",
      "schema:schemas/\u0085event.json",
      "document:docs/\u007fsecret.md",
      "module:src/app.ts",
    ]) {
      expect(canonicalReferenceOwnerPath(ownerId), ownerId).toBeNull();
    }
  });

  it("keeps 479 symbol anchors out of a 277-file reference tree", () => {
    const payload = largeWikiFixture({ files: 277, symbols: 479, featured: 18 });
    const parsed = parseWikiIndexV2(payload);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error(parsed.errors.join("\n"));

    const model = buildWikiNavigation(buildWikiRuntimeIndex(parsed.value));

    expect(model.featured.pages).toHaveLength(18);
    expect(model.reference.totalFiles).toBe(277);
    expect(model.reference.roots[0]).toMatchObject({ kind: "module", path: "src" });
    expect(
      [...model.reference.nodesById.values()].every((node) =>
        ["module", "directory", "file"].includes(node.kind),
      ),
    ).toBe(true);
    expect(model.reference.nodesById.size).toBeLessThan(277 + 479);
    expect(
      loadReferenceChildren(model, model.reference.roots[0]!.id).every(
        (node) => node.kind === "directory" || node.kind === "file",
      ),
    ).toBe(true);

    const root = model.reference.roots[0]!;
    expect(
      visibleReferenceRows(model, new Set()).every((row) => row.node.kind === "module"),
    ).toBe(true);
    const moduleRows = visibleReferenceRows(model, new Set([root.id]));
    const directory = moduleRows.find((row) => row.node.path === "src/module-0")!.node;
    expect(moduleRows.some((row) => row.node.kind === "file")).toBe(false);
    expect(
      visibleReferenceRows(model, new Set([root.id, directory.id])).some(
        (row) => row.node.kind === "file",
      ),
    ).toBe(true);
    expect(
      visibleReferenceRows(model, new Set([directory.id])).some(
        (row) => row.node.kind === "file",
      ),
    ).toBe(false);
    expect(model.maintenance.expandedByDefault).toBe(false);
  });

  it("keeps file-like config, schema, and document owners reachable", () => {
    const base = largeWikiFixture({ files: 1, symbols: 0, featured: 1 });
    const ownerFixtures = [
      ["config", "config:settings/app.yaml", "page:config", "settings/app.yaml"],
      ["schema", "schema:schemas/order.json", "page:schema", "schemas/order.json"],
      ["document", "document:docs/operations.md", "page:document", "docs/operations.md"],
    ] as const;
    const referencePages: WikiPageV2[] = ownerFixtures.map(([kind, ownerId, id]) => ({
      id,
      title: `${kind} reference`,
      summary: `${kind} owner reference`,
      markdownPath: `knowledge-base/reference/${kind}.md`,
      role: "reference",
      category: "file",
      quality: "generated",
      generationStatus: "complete",
      directNodeIds: [ownerId],
      contextNodeIds: [],
      evidenceIds: [`evidence:${kind}`],
      searchTerms: [],
    }));
    const payload: WikiIndexV2 = {
      ...base,
      pages: [...base.pages, ...referencePages],
      referenceCoverage: {
        ...base.referenceCoverage,
        files: { covered: 4, total: 4, missingIds: [] },
      },
      nodeDocumentation: [
        ...base.nodeDocumentation,
        ...ownerFixtures.map(([kind, ownerId, pageId]) => ({
          nodeId: ownerId,
          relation: "direct" as const,
          quality: "generated" as const,
          evidenceHealth: "source-linked" as const,
          generationStatus: "complete" as const,
          referenceCoverage: "anchored" as const,
          directPageIds: [pageId],
          contextPageIds: [],
          evidenceIds: [`evidence:${kind}`],
          primaryPageId: pageId,
        })),
      ],
      evidence: [
        ...base.evidence,
        ...ownerFixtures.map(([kind, ownerId, , filePath]) => ({
          id: `evidence:${kind}`,
          nodeIds: [ownerId],
          filePath,
          lineRange: [1, 2] as [number, number],
          excerpt: `${kind} source evidence`,
          evidenceType: "configuration" as const,
        })),
      ],
    };
    const parsed = parseWikiIndexV2(payload);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error(parsed.errors.join("\n"));

    const model = buildWikiNavigation(buildWikiRuntimeIndex(parsed.value));

    expect(model.reference.orphanPageIds).toEqual([]);
    expect(
      [...model.reference.nodesById.values()]
        .filter((node) => node.kind === "file")
        .map((node) => node.pageId)
        .sort(),
    ).toEqual(["page:config", "page:document", "page:file-0", "page:schema"]);
  });
});
