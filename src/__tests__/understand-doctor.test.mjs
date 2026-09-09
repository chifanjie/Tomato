import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const doctorPath = resolve("scripts/understand-doctor.mjs");
const temporaryDirectories = [];

afterEach(async () => {
  while (temporaryDirectories.length > 0) {
    await rm(temporaryDirectories.pop(), { recursive: true, force: true });
  }
});

async function project({ graph, meta, wikiIndex, report } = {}) {
  const root = await mkdtemp(join(tmpdir(), "uc-doctor-"));
  temporaryDirectories.push(root);
  const stateDir = join(root, ".understand-code");
  await mkdir(stateDir, { recursive: true });
  if (graph !== undefined) await writeFile(join(stateDir, "knowledge-graph.json"), graph);
  if (meta !== undefined) await writeFile(join(stateDir, "meta.json"), meta);
  if (wikiIndex !== undefined) {
    await mkdir(join(stateDir, "knowledge-base"), { recursive: true });
    await writeFile(join(stateDir, "knowledge-base", "wiki-index.json"), wikiIndex);
  }
  if (report !== undefined) {
    await mkdir(join(stateDir, "knowledge-base", ".trace"), { recursive: true });
    await writeFile(join(stateDir, "knowledge-base", ".trace", "generation-report.json"), report);
  }
  return root;
}

/** Runs the doctor, returning stdout plus its exit status. */
function runDoctor(target) {
  try {
    return { output: execFileSync(process.execPath, [doctorPath, target], {
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    }), failed: false };
  } catch (error) {
    return { output: error.stdout ?? "", failed: true };
  }
}

describe("understand-doctor", () => {
  it("reports a missing graph as blocking and names the command to run", async () => {
    const { output, failed } = runDoctor(await project());

    expect(output).toContain("未生成 .understand-code/knowledge-graph.json");
    expect(output).toContain("运行 /understand 生成知识图谱");
    expect(failed).toBe(true);
  });

  it("flags an unparseable graph rather than reporting zero nodes", async () => {
    const { output } = runDoctor(await project({ graph: "{ broken" }));

    expect(output).toContain("无法解析");
    expect(output).toContain("/understand --full");
  });

  it("counts nodes and edges for a readable graph", async () => {
    const { output } = runDoctor(await project({
      graph: JSON.stringify({ nodes: [{ id: "a" }, { id: "b" }], edges: [{ source: "a", target: "b" }] }),
      wikiIndex: JSON.stringify({ version: 2, pages: [{ id: "p" }] }),
    }));

    expect(output).toContain("2 个节点 / 1 条边");
    expect(output).toContain("1 篇文档，索引版本 2");
  });

  it("identifies a legacy knowledge base that the dashboard cannot read", async () => {
    const root = await project({ graph: JSON.stringify({ nodes: [], edges: [] }) });
    // A pre-V2 layout: the directory exists but carries no wiki-index.json.
    await mkdir(join(root, ".understand-code", "knowledge-base"), { recursive: true });
    await writeFile(join(root, ".understand-code", "knowledge-base", "目录.md"), "# 目录\n");

    const { output, failed } = runDoctor(root);

    expect(output).toContain("旧版格式");
    expect(output).toContain("重新生成知识库");
    expect(failed).toBe(true);
  });

  it("reports the commit distance when the graph is behind HEAD", async () => {
    const root = await project({
      graph: JSON.stringify({ nodes: [], edges: [] }),
      meta: JSON.stringify({ gitCommitHash: "0".repeat(40) }),
      wikiIndex: JSON.stringify({ version: 2, pages: [] }),
    });
    execFileSync("git", ["init", "-q"], { cwd: root });
    execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", "commit",
      "-q", "--allow-empty", "-m", "seed"], { cwd: root });

    const { output } = runDoctor(root);

    expect(output).toContain("图谱新鲜度");
    expect(output).toContain("运行 /understand 增量更新知识图谱");
  });

  it("does not compare freshness outside a git worktree", async () => {
    const { output } = runDoctor(await project({
      graph: JSON.stringify({ nodes: [], edges: [] }),
      meta: JSON.stringify({ gitCommitHash: "0".repeat(40) }),
      wikiIndex: JSON.stringify({ version: 2, pages: [] }),
    }));

    expect(output).toContain("无法比较");
  });

  it("names generation warnings that otherwise stay in an unread report file", async () => {
    const { output } = runDoctor(await project({
      graph: JSON.stringify({ nodes: [], edges: [] }),
      wikiIndex: JSON.stringify({ version: 2, pages: [] }),
      report: JSON.stringify({
        version: 2,
        warnings: ["跳过 src/huge.ts：超出解析上限", "第二条"],
        errors: [],
      }),
    }));

    expect(output).toContain("生成警告");
    expect(output).toContain("2 条，首条：跳过 src/huge.ts：超出解析上限");
    expect(output).toContain("generation-report.json");
  });

  it("quantifies partial reference coverage instead of only labelling it", async () => {
    const { output } = runDoctor(await project({
      graph: JSON.stringify({ nodes: [], edges: [] }),
      wikiIndex: JSON.stringify({ version: 2, pages: [] }),
      report: JSON.stringify({
        version: 2,
        referenceCoverage: {
          status: "partial",
          files: { covered: 315, total: 325, missingIds: Array.from({ length: 10 }, (_, i) => `file:${i}`) },
          functions: { covered: 783, total: 795, missingIds: Array.from({ length: 12 }, (_, i) => `fn:${i}`) },
          types: { covered: 3, total: 3, missingIds: [] },
        },
        warnings: [],
        errors: [],
      }),
    }));

    expect(output).toContain("参考覆盖");
    expect(output).toContain("文件 315/325");
    expect(output).toContain("函数 783/795");
    expect(output).toContain("22 项未覆盖");
  });

  it("reports generation errors as blocking", async () => {
    const { output, failed } = runDoctor(await project({
      graph: JSON.stringify({ nodes: [], edges: [] }),
      wikiIndex: JSON.stringify({ version: 2, pages: [] }),
      report: JSON.stringify({ version: 2, warnings: [], errors: ["证据锚点缺失"] }),
    }));

    expect(output).toContain("生成错误");
    expect(output).toContain("1 条，首条：证据锚点缺失");
    expect(failed).toBe(true);
  });
});
