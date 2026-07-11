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
              tags: ["entry"],
              complexity: "complex",
            },
            {
              id: "config:config/app.yaml",
              type: "config",
              name: "app.yaml",
              filePath: "config/app.yaml",
              summary: "应用配置。",
              tags: ["config"],
              complexity: "simple",
            },
            {
              id: "schema:schema/api.json",
              type: "schema",
              name: "api.json",
              filePath: "schema/api.json",
              summary: "接口结构定义。",
              tags: ["schema"],
              complexity: "simple",
            },
            {
              id: "document:docs/guide.md",
              type: "document",
              name: "guide.md",
              filePath: "docs/guide.md",
              summary: "使用说明。",
              tags: ["documentation"],
              complexity: "simple",
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
      const configuredEntryId = "function:missing:ConfiguredEntry";
      const projectOverviewPageId = `page:${encodeURIComponent("项目总览.md")}`;
      writeFileSync(join(outputDir, "config.json"), JSON.stringify({
        knowledgeBase: {
          entryNodeIds: [configuredEntryId],
          route: { hide: [projectOverviewPageId] },
        },
      }));
      mkdirSync(join(repo, "src"), { recursive: true });
      writeFileSync(join(repo, "src/a.go"), "package src\n\nfunc Build() {}\n");
      mkdirSync(join(repo, "config"), { recursive: true });
      writeFileSync(join(repo, "config/app.yaml"), "enabled: true\n");
      mkdirSync(join(repo, "schema"), { recursive: true });
      writeFileSync(join(repo, "schema/api.json"), "{\"type\":\"object\"}\n");
      mkdirSync(join(repo, "docs"), { recursive: true });
      writeFileSync(join(repo, "docs/guide.md"), "# 使用说明\n");

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

      const profile = JSON.parse(readFileSync(join(outputDir, "knowledge-base/knowledge-base-profile.json"), "utf8"));
      expect(profile.coverageReport.sourceReadCoverage).toEqual({ covered: 4, total: 4, missing: [] });
      expect(profile.topicCandidates).toEqual(expect.any(Array));
      expect(profile.validation.warnings).toEqual(expect.arrayContaining([
        `配置入口不存在：${configuredEntryId}`,
        `主阅读必需页面 ${projectOverviewPageId} 被隐藏，主阅读状态将被阻塞`,
      ]));

      const wikiIndex = JSON.parse(readFileSync(wikiIndexPath, "utf8"));
      expect(wikiIndex.version).toBe(1);
      expect(wikiIndex.projectName).toBe("sample");
      expect(wikiIndex.source).toEqual(
        expect.objectContaining({
          outputLanguage: "zh-Hans",
          gitCommitHash: "local",
          generationMode: "deterministic",
          graphDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      );
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
      expect(linkedPage.searchTerms).toEqual(expect.arrayContaining([linkedPage.title]));
      const overviewPage = wikiIndex.pages.find((page: { title: string }) => page.title === "项目总览");
      expect(overviewPage).toEqual(expect.objectContaining({ category: "overview", coverage: "partial" }));
      const topicPage = wikiIndex.pages.find((page: { markdownPath: string }) =>
        page.markdownPath.includes("关键函数专题"),
      );
      expect(topicPage).toEqual(expect.objectContaining({ category: "symbol" }));
      const capabilityPage = wikiIndex.pages.find((page: { markdownPath: string }) =>
        page.markdownPath.includes("业务能力"),
      );
      expect(capabilityPage).toBeUndefined();
      expect(wikiIndex.pages.every((page: { summary: string }) => !page.summary.includes("generated knowledge-base documentation"))).toBe(true);
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
  }, 15_000);

  it("keeps fallback node pages from hiding gaps and caps related nodes", () => {
    const repo = mkdtempSync(join(tmpdir(), "understand-code-wiki-index-fallback-"));
    try {
      const outputDir = join(repo, ".understand-code");
      mkdirSync(outputDir, { recursive: true });
      const leafNodes = Array.from({ length: 30 }, (_, index) => ({
        id: `resource:leaf-${index + 1}`,
        type: "resource",
        name: `Leaf ${index + 1}`,
        summary: `Leaf ${index + 1}.`,
        tags: [],
        complexity: "simple",
      }));
      const nodes = [
        {
          id: "resource:hub",
          type: "resource",
          name: "Hub",
          filePath: "src/hub.go",
          lineRange: [9, 2],
          summary: "Hub resource.",
          tags: [],
          complexity: "complex",
        },
        ...leafNodes,
      ];
      writeFileSync(
        join(outputDir, "knowledge-graph.json"),
        JSON.stringify({
          version: "1.0.0",
          project: {
            name: "sparse",
            languages: [],
            frameworks: [],
            description: "",
            analyzedAt: "2026-07-09T00:00:00.000Z",
            gitCommitHash: "local",
          },
          nodes,
          edges: leafNodes.map((node, index) => ({
            source: "resource:hub",
            target: node.id,
            type: "depends_on",
            direction: "forward",
            weight: (index + 1) / 100,
          })),
          layers: [],
          tour: [],
        }),
      );

      const result = spawnSync(
        "node",
        ["skills/understand-kb/generate-knowledge-base.mjs", repo, "--deterministic-only"],
        {
          cwd: repoRoot,
          encoding: "utf8",
        },
      );

      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
      const wikiIndex = JSON.parse(
        readFileSync(join(outputDir, "knowledge-base/wiki-index.json"), "utf8"),
      );
      const hubPage = wikiIndex.pages.find((page: { explainedNodeIds: string[] }) =>
        page.explainedNodeIds.includes("resource:hub"),
      );
      const hubEvidence = wikiIndex.evidence.find((item: { nodeIds: string[] }) =>
        item.nodeIds.includes("resource:hub"),
      );

      expect(hubPage).toBeDefined();
      expect(hubPage.relatedNodeIds).toHaveLength(24);
      expect(hubPage.relatedNodeIds[0]).toBe("resource:leaf-30");
      expect(hubPage.summary).toContain("尚待补充详细说明");
      expect(hubPage.quality).toBe("low-confidence");
      expect(hubEvidence).toEqual(
        expect.objectContaining({
          filePath: "src/hub.go",
        }),
      );
      expect(hubEvidence).not.toHaveProperty("lineRange");
      expect(wikiIndex.gaps.map((gap: { nodeId: string }) => gap.nodeId).sort()).toEqual(
        nodes.map((node) => node.id).sort(),
      );
      expect(wikiIndex.gaps.every((gap: { reason: string }) => gap.reason === "尚未生成能够充分解释该代码对象的 Wiki 页面。")).toBe(true);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("derives quality and coverage per page instead of applying one global status", () => {
    const repo = mkdtempSync(join(tmpdir(), "understand-code-wiki-index-quality-"));
    try {
      const outputDir = join(repo, ".understand-code");
      mkdirSync(outputDir, { recursive: true });
      writeFileSync(
        join(outputDir, "knowledge-graph.json"),
        JSON.stringify({
          version: "1.0.0",
          project: {
            name: "quality-sample",
            languages: ["go"],
            frameworks: [],
            description: "质量状态测试项目",
            analyzedAt: "2026-07-09T00:00:00.000Z",
            gitCommitHash: "quality-local",
          },
          nodes: [
            {
              id: "file:src/a.go",
              type: "file",
              name: "a.go",
              filePath: "src/a.go",
              summary: "提供示例函数并返回固定结果。",
              tags: [],
              complexity: "moderate",
            },
            {
              id: "function:src/a.go:TODO",
              type: "function",
              name: "TODO",
              filePath: "src/a.go",
              lineRange: [3, 3],
              summary: "返回固定结果的示例函数。",
              tags: [],
              complexity: "moderate",
            },
          ],
          edges: [
            {
              source: "file:src/a.go",
              target: "function:src/a.go:TODO",
              type: "contains",
              direction: "forward",
              weight: 1,
            },
          ],
          layers: [
            {
              id: "core",
              name: "核心层",
              description: "示例核心实现",
              nodeIds: ["file:src/a.go", "function:src/a.go:TODO"],
            },
          ],
          tour: [],
        }),
      );
      mkdirSync(join(repo, "src"), { recursive: true });
      writeFileSync(join(repo, "src/a.go"), "package src\n\nfunc TODO() {}\n");

      const result = spawnSync(
        "node",
        ["skills/understand-kb/generate-knowledge-base.mjs", repo, "--deterministic-only"],
        { cwd: repoRoot, encoding: "utf8" },
      );
      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);

      const wikiIndex = JSON.parse(
        readFileSync(join(outputDir, "knowledge-base/wiki-index.json"), "utf8"),
      );
      const filePage = wikiIndex.pages.find((page: { category: string }) => page.category === "file");
      const overviewPage = wikiIndex.pages.find((page: { title: string }) => page.title === "项目总览");

      expect(filePage).toEqual(
        expect.objectContaining({
          quality: "low-confidence",
          coverage: "partial",
          qualityIssues: expect.arrayContaining(["占位文本校验未通过"]),
        }),
      );
      expect(overviewPage).toEqual(
        expect.objectContaining({
          quality: "generated",
          coverage: "partial",
          qualityIssues: [],
        }),
      );
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});
