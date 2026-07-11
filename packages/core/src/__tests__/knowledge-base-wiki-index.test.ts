import { describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const generatorPath = "skills/understand-kb/generate-knowledge-base.mjs";

function writeGenerationFixture(root: string, writeSource: boolean): void {
  const stateDir = join(root, ".understand-code");
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(join(stateDir, "knowledge-graph.json"), JSON.stringify({
    version: "1.0.0",
    project: { name: "sample", languages: ["typescript"], frameworks: [], description: "示例项目", analyzedAt: "2026-07-11T00:00:00.000Z", gitCommitHash: "abc" },
    nodes: [
      { id: "file:src/a.ts", type: "file", name: "a.ts", filePath: "src/a.ts", summary: "入口文件", tags: ["entry"], complexity: "moderate" },
      { id: "function:src/a.ts:run", type: "function", name: "run", filePath: "src/a.ts", lineRange: [1, 1], summary: "运行入口", tags: ["entry"], complexity: "complex" },
    ],
    edges: [{ source: "file:src/a.ts", target: "function:src/a.ts:run", type: "contains", direction: "forward", weight: 1 }],
    layers: [{ id: "layer:main", name: "入口层", description: "入口", nodeIds: ["file:src/a.ts"] }],
    tour: [],
  }, null, 2));
  writeFileSync(join(stateDir, "config.json"), JSON.stringify({
    autoUpdate: false,
    outputLanguage: "zh-CN",
    knowledgeBase: { businessTerms: ["运行入口"] },
  }, null, 2));
  if (writeSource) {
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "src/a.ts"), "export function run() {}\n");
  }
}

function runGeneration(sourceRoot: string, outputRoot: string) {
  return spawnSync(
    "node",
    [
      generatorPath,
      sourceRoot,
      "--source-root",
      sourceRoot,
      "--output-root",
      outputRoot,
      "--deterministic-only",
    ],
    { cwd: repoRoot, encoding: "utf8" },
  );
}

function readJson(path: string): any {
  return JSON.parse(readFileSync(path, "utf8"));
}

describe("knowledge base wiki V2 artifact generation", () => {
  it("publishes all V2 wrappers to an explicit output root", () => {
    const sourceRoot = mkdtempSync(join(tmpdir(), "understand-code-source-"));
    const outputRoot = mkdtempSync(join(tmpdir(), "understand-code-output-"));
    try {
      writeGenerationFixture(sourceRoot, true);

      const result = runGeneration(sourceRoot, outputRoot);

      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
      const wikiIndex = readJson(join(outputRoot, "wiki-index.json"));
      const searchIndex = readJson(join(outputRoot, "search-index.json"));
      const documentTraces = readJson(join(outputRoot, ".trace/document-traces.json"));
      const report = readJson(join(outputRoot, ".trace/generation-report.json"));
      expect([wikiIndex.version, searchIndex.version, documentTraces.version, report.version]).toEqual([2, 2, 2, 2]);
      expect(report.source.outputLanguage).toBe("zh-CN");
      expect(report.source.sourceRootIdentity).toBe(resolve(sourceRoot));
      expect(report.sourceRead.covered).toBeGreaterThan(0);
      expect(report.mainReadiness.status).toBe("blocked");
      expect(report.mainReadiness.reasons).toContain("确定性诊断稿不能作为正式主干知识发布");
    } finally {
      rmSync(sourceRoot, { recursive: true, force: true });
      rmSync(outputRoot, { recursive: true, force: true });
    }
  }, 15_000);

  it("writes only an atomic generation report when no source is readable", () => {
    const sourceRoot = mkdtempSync(join(tmpdir(), "understand-code-zero-source-"));
    const outputRoot = mkdtempSync(join(tmpdir(), "understand-code-zero-output-"));
    try {
      writeGenerationFixture(sourceRoot, false);
      mkdirSync(join(outputRoot, ".intermediate"), { recursive: true });
      writeFileSync(join(outputRoot, ".intermediate/sentinel.json"), "{}\n");

      const result = runGeneration(sourceRoot, outputRoot);

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("未读取到任何源码，正式知识库未发布");
      expect(existsSync(join(outputRoot, "wiki-index.json"))).toBe(false);
      expect(existsSync(join(outputRoot, "search-index.json"))).toBe(false);
      expect(existsSync(join(outputRoot, ".trace/document-traces.json"))).toBe(false);
      expect(existsSync(join(outputRoot, "项目总览.md"))).toBe(false);
      expect(existsSync(join(outputRoot, ".intermediate/sentinel.json"))).toBe(true);
      const report = readJson(join(outputRoot, ".trace/generation-report.json"));
      expect(report.version).toBe(2);
      expect(report.sourceRead.covered).toBe(0);
      expect(report.mainReadiness.reasons).toContain("未读取到任何源码文件");
    } finally {
      rmSync(sourceRoot, { recursive: true, force: true });
      rmSync(outputRoot, { recursive: true, force: true });
    }
  }, 15_000);

  it("rejects an output root that could overwrite source or graph state", () => {
    const sourceRoot = mkdtempSync(join(tmpdir(), "understand-code-unsafe-output-"));
    try {
      writeGenerationFixture(sourceRoot, true);

      const result = runGeneration(sourceRoot, sourceRoot);

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("输出目录不能覆盖源码或图谱目录");
      expect(existsSync(join(sourceRoot, "src/a.ts"))).toBe(true);
      expect(existsSync(join(sourceRoot, ".understand-code/knowledge-graph.json"))).toBe(true);
    } finally {
      rmSync(sourceRoot, { recursive: true, force: true });
    }
  });

  it("rejects an output symlink whose target contains source and graph state", () => {
    const sourceRoot = mkdtempSync(join(tmpdir(), "understand-code-unsafe-symlink-"));
    const outputRoot = join(sourceRoot, ".understand-code/knowledge-base");
    try {
      writeGenerationFixture(sourceRoot, true);
      symlinkSync(sourceRoot, outputRoot, "dir");

      const result = runGeneration(sourceRoot, outputRoot);

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("输出目录不能覆盖源码或图谱目录");
      expect(existsSync(join(sourceRoot, "src/a.ts"))).toBe(true);
      expect(existsSync(join(sourceRoot, ".understand-code/knowledge-graph.json"))).toBe(true);
    } finally {
      rmSync(sourceRoot, { recursive: true, force: true });
    }
  });

  it("rejects an output whose nearest existing ancestor links into the source root", () => {
    const parent = mkdtempSync(join(tmpdir(), "understand-code-unsafe-ancestor-"));
    const sourceRoot = join(parent, "source");
    const linkedOutputBase = join(parent, "linked-output");
    const outputRoot = join(linkedOutputBase, "nested-output");
    mkdirSync(sourceRoot, { recursive: true });
    try {
      writeGenerationFixture(sourceRoot, true);
      symlinkSync(sourceRoot, linkedOutputBase, "dir");

      const result = runGeneration(sourceRoot, outputRoot);

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("输出目录不能覆盖源码或图谱目录");
      expect(existsSync(join(sourceRoot, "src/a.ts"))).toBe(true);
      expect(existsSync(join(sourceRoot, ".understand-code/knowledge-graph.json"))).toBe(true);
      expect(existsSync(join(sourceRoot, "nested-output"))).toBe(false);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("rejects symlinks already present inside the output root", () => {
    const sourceRoot = mkdtempSync(join(tmpdir(), "understand-code-output-child-source-"));
    const outputRoot = mkdtempSync(join(tmpdir(), "understand-code-output-child-output-"));
    try {
      writeGenerationFixture(sourceRoot, true);
      symlinkSync(sourceRoot, join(outputRoot, ".intermediate"), "dir");

      const result = runGeneration(sourceRoot, outputRoot);

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("输出目录包含不安全的符号链接");
      expect(existsSync(join(sourceRoot, "src/a.ts"))).toBe(true);
      expect(existsSync(join(sourceRoot, ".understand-code/knowledge-graph.json"))).toBe(true);
    } finally {
      rmSync(sourceRoot, { recursive: true, force: true });
      rmSync(outputRoot, { recursive: true, force: true });
    }
  });

  it("treats a source symlink that escapes the source root as unreadable", () => {
    const parent = mkdtempSync(join(tmpdir(), "understand-code-source-symlink-"));
    const sourceRoot = join(parent, "source");
    const outputRoot = join(parent, "output");
    mkdirSync(sourceRoot, { recursive: true });
    mkdirSync(outputRoot, { recursive: true });
    try {
      writeGenerationFixture(sourceRoot, false);
      mkdirSync(join(sourceRoot, "src"), { recursive: true });
      writeFileSync(join(parent, "outside.ts"), "export function run() {}\n");
      symlinkSync(join(parent, "outside.ts"), join(sourceRoot, "src/a.ts"), "file");

      const result = runGeneration(sourceRoot, outputRoot);

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("未读取到任何源码，正式知识库未发布");
      expect(readFileSync(join(parent, "outside.ts"), "utf8")).toBe("export function run() {}\n");
      const report = readJson(join(outputRoot, ".trace/generation-report.json"));
      expect(report.sourceRead).toEqual({ covered: 0, total: 1, missingIds: ["file:src/a.ts"] });
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  }, 15_000);

  it("treats a graph path that escapes the source root as unreadable", () => {
    const parent = mkdtempSync(join(tmpdir(), "understand-code-traversal-"));
    const sourceRoot = join(parent, "source");
    const outputRoot = join(parent, "output");
    mkdirSync(sourceRoot, { recursive: true });
    mkdirSync(outputRoot, { recursive: true });
    try {
      writeGenerationFixture(sourceRoot, false);
      const graphPath = join(sourceRoot, ".understand-code/knowledge-graph.json");
      const graph = readJson(graphPath);
      graph.nodes[0].filePath = "../outside.ts";
      graph.nodes[1].filePath = "../outside.ts";
      writeFileSync(graphPath, JSON.stringify(graph, null, 2));
      writeFileSync(join(parent, "outside.ts"), "export function run() {}\n");

      const result = runGeneration(sourceRoot, outputRoot);

      expect(result.status).not.toBe(0);
      expect(existsSync(join(parent, "outside.ts"))).toBe(true);
      const report = readJson(join(outputRoot, ".trace/generation-report.json"));
      expect(report.sourceRead).toEqual({ covered: 0, total: 1, missingIds: ["file:src/a.ts"] });
      expect(report.mainReadiness.reasons).toContain("未读取到任何源码文件");
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  }, 15_000);
});
