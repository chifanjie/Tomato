import { describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

describe("knowledge base wiki index generation", () => {
  it("emits wiki-index.json with page, evidence, and gap metadata", () => {
    const repo = mkdtempSync(join(tmpdir(), "understand-code-wiki-index-"));
    try {
      const outputDir = join(repo, ".understand-code");
      mkdirSync(outputDir, { recursive: true });
      writeFileSync(
        join(outputDir, "knowledge-graph.json"),
        JSON.stringify({
          version: "1.0.0",
          project: {
            name: "sample",
            languages: ["go"],
            frameworks: [],
            description: "",
            analyzedAt: "2026-07-09T00:00:00.000Z",
            gitCommitHash: "local",
          },
          nodes: [
            {
              id: "file:src/a.go",
              type: "file",
              name: "a.go",
              filePath: "src/a.go",
              summary: "File A.",
              tags: [],
              complexity: "moderate",
            },
            {
              id: "function:src/a.go:Build",
              type: "function",
              name: "Build",
              filePath: "src/a.go",
              lineRange: [3, 3],
              summary: "Builds data.",
              tags: [],
              complexity: "complex",
            },
          ],
          edges: [
            {
              source: "file:src/a.go",
              target: "function:src/a.go:Build",
              type: "contains",
              direction: "forward",
              weight: 1,
            },
          ],
          layers: [
            {
              id: "core",
              name: "Core",
              description: "Core layer",
              nodeIds: ["file:src/a.go"],
            },
          ],
          tour: [],
        }),
      );
      mkdirSync(join(repo, "src"), { recursive: true });
      writeFileSync(join(repo, "src/a.go"), "package src\n\nfunc Build() {}\n");

      const result = spawnSync(
        "node",
        ["skills/understand-kb/generate-knowledge-base.mjs", repo, "--deterministic-only"],
        {
          cwd: repoRoot,
          encoding: "utf8",
        },
      );

      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
      const wikiIndexPath = join(outputDir, "knowledge-base/wiki-index.json");
      expect(existsSync(wikiIndexPath)).toBe(true);

      const wikiIndex = JSON.parse(readFileSync(wikiIndexPath, "utf8"));
      expect(wikiIndex.version).toBe(1);
      expect(wikiIndex.projectName).toBe("sample");
      expect(wikiIndex.pages.length).toBeGreaterThan(0);
      const linkedPage = wikiIndex.pages.find((page: { explainedNodeIds: string[] }) => page.explainedNodeIds.length > 0);
      expect(linkedPage).toBeDefined();
      expect(linkedPage).toEqual(
        expect.objectContaining({
          category: expect.stringMatching(/^(overview|capability|flow|module|file|symbol|gap|quality|other)$/),
          coverage: expect.stringMatching(/^(complete|partial)$/),
          quality: expect.stringMatching(/^(verified|generated|low-confidence)$/),
        }),
      );
      expect(linkedPage.markdownPath).toMatch(/^knowledge-base\/.+\.md$/);
      expect(existsSync(join(outputDir, linkedPage.markdownPath))).toBe(true);
      expect(linkedPage.explainedNodeIds.length).toBeGreaterThan(0);
      expect(wikiIndex.evidence.length).toBeGreaterThan(0);
      expect(wikiIndex.evidence[0]).toEqual(
        expect.objectContaining({
          nodeIds: expect.arrayContaining([expect.any(String)]),
        }),
      );
      const buildEvidence = wikiIndex.evidence.find((item: { nodeIds: string[] }) =>
        item.nodeIds.includes("function:src/a.go:Build"),
      );
      expect(buildEvidence).toEqual(
        expect.objectContaining({
          filePath: "src/a.go",
          lineRange: [3, 3],
        }),
      );
      expect(Array.isArray(wikiIndex.gaps)).toBe(true);
      for (const gap of wikiIndex.gaps) {
        expect(gap.severity).toMatch(/^(low|medium|high)$/);
      }
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});
