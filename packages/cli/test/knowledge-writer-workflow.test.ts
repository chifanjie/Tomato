import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseFileWriterBatchOutput, parseTopicWriterBatchOutput, parseFeaturedWriterOutput } from "@understand-code/core";
import { callImplementedTool } from "../src/handlers/tools.js";
import { runKnowledgeCommand } from "../src/knowledge-command.js";
import { assertRepositoryKnowledgeWriterReadyV1, readPendingRepositoryIndexV1 } from "../src/runtime/repository-indexer.js";
import { cleanupTemporaryDirectories, createGitRepository, git } from "./helpers.js";

afterEach(cleanupTemporaryDirectories);
const source = "export function task(value: number): number {\n  if (value <= 0) return 0;\n  return value * 2;\n}\n";
const fileId = "file:src/task.ts";
const functionId = "function:src/task.ts:task";
const evidence = [
  { nodeId: fileId, lineRange: [1, 4], claim: "该文件导出一个接收数值并按条件返回计算结果的函数。" },
  { nodeId: functionId, lineRange: [1, 4], claim: "task 接收数值，非正数返回零，其余输入返回乘以二的结果。" },
  { nodeId: functionId, lineRange: [2, 2], claim: "小于等于零的输入触发提前返回，跳过之后的乘法表达式。" },
  { nodeId: functionId, lineRange: [3, 3], claim: "未触发提前返回的输入进入乘法表达式，计算输入的二倍。" },
].map((item) => ({ ...item, filePath: "src/task.ts", excerpt: source.split("\n").slice(item.lineRange[0] - 1, item.lineRange[1]).join("\n") }));

const fileMarkdown = `# task 数值分支参考

文件节点：\`${fileId}\`。

## 文件职责
src/task.ts 只导出 task 数值计算函数。调用者传入 value 后，函数按照边界条件选择返回路径；本页只解释这一段源码，不为它假定订单、金额或排序等业务含义。

## 输入、输出与关键字段
输入参数 value 在 TypeScript 签名中标记为 number，返回类型也是 number。类型标记不能替代运行时输入校验，尤其不能证明调用方永远不会传入非有限数值；调用约束需要另外核对。

## 规则、分支与状态变化
实现先判断 value 是否小于等于零。条件成立时返回零并跳过乘法；否则计算 value 乘以二。函数没有修改输入对象或持久状态，返回值由输入值和分支条件共同决定。

## 配置、依赖与副作用
文件没有导入依赖、读取配置、访问网络或写入存储。当前结论来自这个文件完整的四行实现，不能推广为仓库其他模块也不存在副作用；上游调用方式仍需结合真实使用位置确认。

## 异常、测试与改动风险
源码没有显式抛出异常或包装错误。修改小于等于判断会改变零值是否进入提前返回；修改乘法会改变正数结果。建议宿主分别执行负数、零、正数以及特殊数值用例，本测试不把建议记为已完成验证。

## 函数与类型
<a id="task"></a>
\`${functionId}\`：task 是唯一的导出函数，参数 value 为数值，返回值由提前返回条件与乘法表达式决定。没有类或其他类型声明，函数体没有可见的异步步骤。

## 函数卡片
\`${functionId}\` 接收数值后先判定非正数分支，再计算其余输入的二倍；两条返回路径可以独立核对。

## 源码证据
\`src/task.ts:1-4\` 包含完整函数，\`src/task.ts:2-2\` 是非正数提前返回，\`src/task.ts:3-3\` 是乘法返回；这些结论不依赖函数名称推断。
`;
const topicMarkdown = `# task 条件与数值返回

## 为什么关键
这段函数的边界比较决定调用者拿到零还是乘法结果。理解提前返回顺序有助于避免把所有输入都概括为乘以二，也有助于识别零值条件变化造成的接口行为差异。

## 完整条件与跳过规则
调用 task 时读取数值参数 value，首先检查其是否小于等于零。负数和零都直接返回零；这两个输入范围不会继续执行后面的乘法表达式。源码没有额外配置开关或异常捕获分支。

## 输入输出与状态变化
函数签名接受 number 并返回 number。value 没有被重新赋值，也没有对象字段写入；可见的输出仅是数值返回值。编译时类型不保证外部调用者在运行时遵守约定，输入来源仍需由调用方确认。

## 算法、分支与降级
非正数路径返回常量零；条件不成立时返回 value 乘以二。这里没有循环、递归和显式降级服务，不应把返回零自动解释为业务失败，是否代表兜底必须结合上层产品契约判断。

## 依赖、测试与可观测性
该文件没有导入语句、网络请求、日志或存储操作。建议真实执行负数、零和正数的返回断言，并核对非有限数值契约；本页只给源码事实和待验证方向，不声称任何测试已经运行成功。

## 源码证据
\`src/task.ts:1-4\` 展示完整数值函数，\`src/task.ts:2-2\` 对应提前返回条件，\`src/task.ts:3-3\` 对应乘法返回表达式。各段证据逐行来自当前仓库，解释范围限于这段实现。
`;

const featuredEvidence = [...evidence, ...[
  { nodeId: functionId, lineRange: [1, 1], claim: "导出函数的参数与返回值均以数值类型声明，函数名为 task。" },
  { nodeId: functionId, lineRange: [1, 2], claim: "函数接收 value 后立即检查非正数条件，条件成立则返回零。" },
  { nodeId: functionId, lineRange: [2, 3], claim: "提前返回位于乘法表达式之前，两个返回语句决定互斥的数值结果。" },
].map((item) => ({ ...item, filePath: "src/task.ts", excerpt: source.split("\n").slice(item.lineRange[0] - 1, item.lineRange[1]).join("\n") }))];
const overviewMarkdown = `# 数值函数项目总览

## 项目目标与边界
当前仓库只有一个可见的数值入口 task，功能是按输入符号选择零值或二倍计算。项目没有描述任何价格、配额或排序语义，阅读时应把结论限制在计算行为，不为它补充业务背景。

## 完整生命周期
调用者传入 value，函数先比较其是否小于等于零；命中时直接结束并返回零，否则执行乘法并返回结果。整个调用是同步执行的单次计算，源码没有持久化状态，也没有任务启动与关闭阶段。

## 核心模块
唯一实现文件 src/task.ts 暴露一个函数。文件完整内容没有导入语句、类定义或共享变量，因此本项目的阅读单位就是参数签名、条件返回和乘法返回这三部分。

## 配置、依赖与测试
当前输入文件中没有配置读取、外部服务或测试用例。建议分别执行负数、零、正数与非有限值检查；这些是未来验证方向，不是已经执行过的检查结果，运行时调用约束需由使用方确认。

## 推荐阅读路线
先阅读此页明确计算边界，再到源码入口核对逐行执行顺序，最后查看文件参考与函数专题中的变更风险。阅读顺序帮助区分可见代码事实与调用方尚未说明的产品语义。

## 源码证据
src/task.ts:1-1 声明入口签名；src/task.ts:1-2 连接参数读取和提前返回；src/task.ts:2-2 定义非正数分支；src/task.ts:2-3 展示互斥返回顺序；src/task.ts:3-3 给出乘法；src/task.ts:1-4 包含完整实现。
`;
const sourceEntryMarkdown = `# 数值分支源码入口

## 项目目标与边界
本页用于从计算结论返回实际实现。需要确认的入口是 src/task.ts 导出的 task，源码只提供数值条件与返回结果，没有能够证明上层业务用途的调用点，因此不推断业务场景。

## 完整生命周期
从第一行函数签名进入，第二行读取 value 并比较零边界；只有没有提前结束的调用才会到达第三行。第四行结束函数定义，整个过程没有异步等待、额外资源申请或清理逻辑。

## 核心模块
阅读时以 task 作为函数定位，以 src/task.ts 作为文件定位。该文件没有其他实现模块，修改风险主要集中在边界操作符和乘法表达式，不能仅看函数名称判断行为是否兼容。

## 配置、依赖与测试
完整四行内容不含环境变量、导入模块或测试断言。核对调用者是否允许特殊数值后才能决定是否增加校验；当前文档没有把源码检查当作运行测试，也没有给不存在的测试标记通过。

## 推荐阅读路线
先定位 src/task.ts:1-4，再单独查看第二行与第三行的返回表达式。需要更完整解释时可以读取文件参考和条件专题，对修改前后的负数、零与正数输入分别记录实际输出。

## 源码证据
入口参数见 src/task.ts:1-1，提前返回的上下文见 src/task.ts:1-2，边界判断见 src/task.ts:2-2，两个返回之间的顺序见 src/task.ts:2-3，二倍运算见 src/task.ts:3-3，完整函数边界见 src/task.ts:1-4。
`;

describe("Task writer command to candidate bridge", () => {
  it("prepares, completes file/topic writers, finalizes sharded excerpts and imports a source-verified candidate", async () => {
    const logs: string[] = [];
    const spies = [vi.spyOn(console, "log").mockImplementation((...args) => { logs.push(args.join(" ")); }),
      vi.spyOn(console, "error").mockImplementation((...args) => { logs.push(args.join(" ")); })];
    try {
      const root = await createGitRepository({ seedArtifacts: false });
      await writeFile(path.join(root, "src/task.ts"), source);
      await git(root, ["add", "src/task.ts"]);
      await git(root, ["commit", "-q", "-m", "numeric source fixture"]);
      const local = { runtimeProfile: "local_durable_v1" as const };
      const created: any = await callImplementedTool("build_task_brief", { task: "Explain task numeric boundaries", expectedRevision: 0, actor: "codex", idempotencyKey: "writer-workflow" }, root, local);
      expect(created.isError, JSON.stringify(created)).toBe(false);
      const task = created.structuredContent.result.task;
      const draft = path.join(root, ".understand-code/knowledge-drafts", task.taskId);
      const intermediate = path.join(draft, ".intermediate");
      const json = async (relative: string) => JSON.parse(await readFile(path.join(intermediate, relative), "utf8"));
      const run = (...writerArgs: string[]) => runKnowledgeCommand({ kind: "knowledge", root, taskId: task.taskId, writerArgs });
      await run("--prepare-file-docs");
      const filePlan = await json("file-doc-plan.json");
      for (const batch of filePlan.batches) {
        await run("--lease-file-batch", "--worker-id", "test-writer");
        const output = { batchIndex: batch.batchIndex, warnings: [], documents: batch.tasks.map((entry: any) => ({
          fileNodeId: entry.fileNodeId, filePath: entry.filePath, documentPath: entry.documentPath,
          referenceKind: entry.referenceKind, title: "task 数值分支参考", coveredFunctionNodeIds: entry.functionNodeIds,
          coveredClassNodeIds: entry.classNodeIds, representedEdgeIds: [...entry.incomingEdgeIds, ...entry.outgoingEdgeIds],
          sourceEvidence: evidence, importantNodeIds: entry.functionNodeIds, markdown: fileMarkdown,
        })) };
        expect(parseFileWriterBatchOutput(output)).toMatchObject({ ok: true });
        await writeFile(path.join(intermediate, `file-doc-batch-${batch.batchIndex}.json`), JSON.stringify(output));
        await run("--complete-file-batch", "--worker-id", "test-writer", "--batch-index", String(batch.batchIndex), "--result-status", "succeeded");
      }
      await run("--merge-file-docs");
      expect(await json("accepted-file-documents.json"), logs.join("\n")).toHaveLength(1);
      await run("--prepare-topics", "--include-extended-topics");
      const topics = await json("topic-plan.json");
      expect(topics.batches.length).toBeGreaterThan(0);
      for (const batch of topics.batches) {
        await run("--lease-topic-batch", "--worker-id", "test-writer");
        const output = { batchIndex: batch.batchIndex, warnings: [], topics: batch.topics.map((entry: any) => ({
          topicNodeId: entry.topicNodeId, sourceFileNodeId: entry.sourceFileNodeId, documentPath: entry.documentPath,
          title: entry.title, coveredNodeIds: entry.coveredNodeIds, linkedFileDocumentPath: entry.linkedFileDocumentPath,
          evidence, markdown: topicMarkdown,
        })) };
        expect(parseTopicWriterBatchOutput(output)).toMatchObject({ ok: true });
        await writeFile(path.join(intermediate, `topic-batch-${batch.batchIndex}.json`), JSON.stringify(output));
        await run("--complete-topic-batch", "--worker-id", "test-writer", "--batch-index", String(batch.batchIndex), "--result-status", "succeeded");
      }
      const featuredPlan = await json("featured-plan.json");
      expect(featuredPlan.documents.map((entry: any) => entry.category)).toEqual(["overview", "overview"]);
      const featured = { warnings: [], documents: featuredPlan.documents.map((entry: any) => ({
        documentId: entry.id, documentPath: entry.path, evidence: featuredEvidence,
        markdown: entry.route.order === 0 ? overviewMarkdown : sourceEntryMarkdown,
      })) };
      expect(parseFeaturedWriterOutput(featured)).toMatchObject({ ok: true });
      await writeFile(path.join(intermediate, "featured-writer-output.json"), JSON.stringify(featured));
      await run("--finalize");
      const wiki = JSON.parse(await readFile(path.join(draft, "wiki-index.json"), "utf8"));
      expect(wiki.excerptStore).toBeDefined();
      expect(wiki.evidence.every((item: any) => item.excerpt === undefined)).toBe(true);
      const staged: any = await callImplementedTool("refresh_index", { mode: "full", actor: "codex", idempotencyKey: "stage-writer-workflow",
        expectedSourceSnapshotId: task.latestSnapshotId, knowledge: { action: "stage", taskId: task.taskId, expectedTaskRevision: task.revision },
      }, root, local);
      expect(staged.isError, `${JSON.stringify(staged)}\n${logs.join("\n")}`).toBe(false);
      const candidate = await readPendingRepositoryIndexV1({ canonicalRoot: root, generationId: staged.structuredContent.result.knowledge.candidateGenerationId });
      expect(() => assertRepositoryKnowledgeWriterReadyV1(candidate), logs.join("\n")).not.toThrow();
    } catch (error) {
      throw new Error(`${error instanceof Error ? error.message : String(error)}\nWriter diagnostics:\n${logs.join("\n")}`, { cause: error });
    } finally { spies.forEach((spy) => spy.mockRestore()); }
  }, 120_000);
});
