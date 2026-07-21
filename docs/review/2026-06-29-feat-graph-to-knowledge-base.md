# feat-graph-to-knowledge-base Review Brief

> 生成时间：2026-06-29 19:51
> 分支：feat/graph-to-knowledge-base
> 基于当前工作区文件：`skills/understand-kb/generate-knowledge-base.mjs`

## 背景与动机

这次是 queue-aware CLI phase 的再次复查，重点验证上轮剩下的 stale `accepted-file-documents.json` 问题是否已经通过 completion 时的下游产物失效解决，同时确认没有留下新的状态机裂缝。

## 改动策略

当前版本在 `completeBatch()` 成功写回 queue 后，会按阶段删除下游中间产物：文件阶段变化会清理 accepted-file / topic 相关状态，topic 阶段变化会清理 topic retry plan；同时保留此前的 merge->queue 回写、missing queue/no-op 报错、以及 core freshness rebuild。

## 改动范围

| 模块/职责 | 文件 | 做了什么 |
|-----------|------|----------|
| CLI phases | `skills/understand-kb/generate-knowledge-base.mjs` | 增加下游产物失效、merge->queue 回写、retry-plan 清理、core freshness rebuild |

## Review 重点

1. **文件阶段重跑后是否还会消费过期下游状态** — accepted-file / topic metadata / topic outputs 是否一起失效。
2. **finalize 是否只读取当前阶段的有效 writer outputs** — 是否还会把旧 topic output 带入新的 finalize。
3. **freshness 与显式失败路径** — core rebuild 和 missing queue/no-op failure 是否保持可靠。

## 已识别风险

| Tag | Summary | Location |
|-----|---------|----------|
| 🟡 Risk | 文件阶段 queue 变化虽然会删除 `topic-plan.json`、`topic-batches.json`、`topic-queue.json` 和 retry plan，但不会删除已生成的 `topic-batch-*.json`。`finalizeKnowledgeBase()` 之后仍会通过 `readBatchOutputs(..., "topic-batch", ...)` 读取 `.intermediate` 中所有 topic batch 文件。如果文件阶段重跑发生在已有 topic outputs 之后，这些旧 topic outputs 仍可能在下一轮 finalize 中被读到：最轻会制造“额外未计划输出”导致假失败，最差会在 batch index/contract恰好仍匹配时把基于旧 file-doc 上下文生成的 topic output 当成当前结果。 | `skills/understand-kb/generate-knowledge-base.mjs:171`, `skills/understand-kb/generate-knowledge-base.mjs:481`, `skills/understand-kb/generate-knowledge-base.mjs:551` |

## 测试情况

**已覆盖：**
- `node --check skills/understand-kb/generate-knowledge-base.mjs` 通过。
- 你描述的 repro 路径现在会在未重新 merge 时被 `prepare-topics` 正确阻断。
- missing queue/no-op transition、merge retry 回写 queue、finalize 阻断、以及 core freshness rebuild 这几条主修复路径从代码上看都已收紧。

**缺失：**
- ⚪ 缺少“topic outputs 已存在后，文件阶段重跑会清理或隔离旧 `topic-batch-*.json`”的集成测试。

## 结论

🟡 上一轮那个 stale `accepted-file-documents.json` 阻断点现在修好了，core freshness 也够用；但我还会留意一个新的下游失效缺口：文件阶段变化没有清掉旧 topic batch payloads，下一轮 finalize 仍可能把它们读回来。
