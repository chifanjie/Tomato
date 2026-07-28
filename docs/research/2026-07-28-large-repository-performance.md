# WP0 大仓库性能基线

日期：2026-07-28

状态：**通过（Graph Pipeline Slice，不代表完整 Task Graph initial overlay）**

## 1. 结论

本次建立了可在新鲜工作区重复执行的大仓库性能基线，覆盖：

- 与 Understand Code 自举分析快照同规模、同类型分布的 `1,264 nodes / 2,299 edges / 9 scopes` 固定语料。
- P0 边界规定的 `10,000 nodes` 固定合成语料，共 `18,188 edges / 16 scopes`。
- 无缓存的 Graph Model Bootstrap。
- 复用 Hierarchy、Semantic Projection、Quick Jump 索引后的 Warm View Projection。
- 对产品 Cap 后视图执行真实 `computeLayout` 的 Warm Synchronous Layout。

Apple M3 / 16 GiB / Node v26.0.0 上的全部 p95 均通过：Bootstrap 使用 P0 `Task Graph initial overlay` 的 2s / 4s 子路径预算，Warm Projection 与 Layout 使用单项 500ms 的 WP0 hard ceiling。

| Corpus | 操作 | 状态 | 预热 / 样本 | p50 | p95 | 最大值 | p95 预算 | 结果 |
|---|---|---:|---:|---:|---:|---:|---:|---|
| Self-host shape | Graph Model Bootstrap | cold cache | 0 / 10 | 17.077 ms | 37.752 ms | 37.752 ms | 2,000 ms | PASS |
| Self-host shape | Graph View Projection | warm cache | 5 / 30 | 0.865 ms | 2.164 ms | 2.831 ms | 500 ms | PASS |
| Self-host shape | Synchronous Graph Layout | warm input | 5 / 30 | 1.024 ms | 44.622 ms | 44.764 ms | 500 ms | PASS |
| Synthetic 10k | Graph Model Bootstrap | cold cache | 0 / 10 | 135.544 ms | 179.413 ms | 179.413 ms | 4,000 ms | PASS |
| Synthetic 10k | Graph View Projection | warm cache | 5 / 30 | 6.527 ms | 15.525 ms | 16.708 ms | 500 ms | PASS |
| Synthetic 10k | Synchronous Graph Layout | warm input | 5 / 30 | 1.868 ms | 38.459 ms | 43.898 ms | 500 ms | PASS |

这里的“通过”仅表示 **Task Graph initial overlay 的 Graph Projection + 同步 Layout 子路径**通过预算，并不把 React 首次渲染、Worker 启动/消息传输、网络、Artifact 读取或未来 Workbench Shell 算作已经通过。完整 First Meaningful Render 仍须在 WP7/WP8 的浏览器 E2E 中关闭。

## 2. 为什么这份基线可复现

### 2.1 固定语料，不读取开发者本地状态

Benchmark 不读取被 `.gitignore` 排除的 `.understand-code/knowledge-graph.json`。它把 2026-07-24 自举快照的公开规模与类型分布固化为 `large-repository-v1`：

| 类型 | Self-host shape | Synthetic 10k |
|---|---:|---:|
| file | 325 | 2,571 |
| function | 795 | 6,290 |
| class | 33 | 261 |
| config | 12 | 95 |
| document | 98 | 775 |
| service | 1 | 8 |
| **合计** | **1,264** | **10,000** |

边类型分布也被显式锁定。10k 语料按自举图密度扩展到 18,188 条边；所有 ID、路径、Layer、端点和遍历顺序由纯确定性规则生成，不使用 `Math.random()`、系统时间或本地文件内容。

Self-host shape 的来源图 Commit 为 `1bd770581e16db58e763216bfeff2db34dd29711`。Fixture 只保存规模、类型计数和合成拓扑，不复制源码、Wiki 正文或本地 Artifact。

Fixture 生成后立即计算稳定 FNV-1a 32 checksum，并与代码中冻结的预期值比较；不一致时即使性能在预算内，Gate 也失败：

- Self-host shape：`fnv1a32:df6768af`
- Synthetic 10k：`fnv1a32:21f92de3`

### 2.2 直接执行生产模型

CLI 通过 Vite SSR 加载并调用生产模块：

- `buildGraphHierarchyIndex`
- `createHierarchicalGraphProjectionContext`
- `buildGraphQuickJumpIndex`
- `buildHierarchicalSemanticGraph`
- Quick Jump 的已建索引 `resolve`
- `buildGraphLayoutMessage` 与生产节点尺寸/Edge Role 映射
- `computeLayout` 与 `isValidLayoutResult`

`SemanticGraphCanvas` 与 Benchmark 复用同一个 `buildGraphLayoutMessage`，因此 Layout 输入使用实际产品 Cap 后视图、Node Size、Edge Role、方向与 Bundle Count。它没有复制 Graph 或 Layout 算法，生产实现变化会直接反映到结果。

旧的 `benchmark-layout.mjs` 未作为本次证据：它依赖当前未安装的 `elkjs`，且使用 `Math.random()` 构图。旧的 `benchmark-aggregations.mjs` 只复刻历史 Before/After 算法形状，也不代表当前 Graph Explorer 生产链路。

### 2.3 协议固定

Benchmark 协议版本为 `2`，Fixture 协议为 `large-repository-v1`：

- Cold cache：同一 Node 进程内执行 10 次；每次丢弃并重新建立 Hierarchy、Semantic Projection 和 Quick Jump 索引，再投影一个确定性导航视图。它表示“无复用索引”，不是重新启动 Node/Vite 的新进程 cold start。
- Warm：先建立一次共享索引，预热 5 次，再测 30 次确定性跨层导航投影。
- Layout：使用上述 Warm Runtime 生成产品 Cap 后视图，预热 5 次，再对 30 个固定输入执行生产 `computeLayout`；Layout Message 构造不计入 `computeLayout` 样本。
- 导航按固定步长覆盖 Overview、Scope、Cluster 和 File 层级，Mode 在 Architecture / Call 间交替。
- p50 / p95 使用 Nearest Rank；JSON 保留每个原始样本，可独立复算。
- 若任一 p95、Fixture checksum、Quick Jump 全节点覆盖、四层导航覆盖、Layout Result 校验或渲染 Cap 失败，CLI 均以非零退出码结束。

Cold 使用 P0 warm overlay 上限作为 WP0 的保守 Graph Pipeline 门禁；Warm Projection 和 Layout 各自使用 500ms hard ceiling，避免用 4 秒大预算掩盖单项退化。这不改变研制计划对正式发布基准“cold 与 warm 分开报告”的要求。

## 3. 有界性与工作负载完整性

结果除了耗时，还保存了防止“空跑”或无界渲染的完整性信号：

| Corpus | Fixture checksum | Hierarchy scopes | Clusters | Quick Jump items | 单视图 Nodes 范围 | 单视图最大 Edges | Workload checksum |
|---|---|---:|---:|---:|---:|---:|---:|
| Self-host shape | `fnv1a32:df6768af` | 9 | 307 | 1,652 | 1–33 | 100 | 176,581 |
| Synthetic 10k | `fnv1a32:21f92de3` | 16 | 552 | 10,808 | 6–33 | 100 | 305,843 |

两套 Corpus 均覆盖 Overview、Scope、Cluster、File 四级导航；Quick Jump 包含每一个原始 Graph Node；每个 Layout Result 都通过 Position/Bounds/Node ID 校验。10k Corpus 的 Quick Jump 对象数超过原始节点数，是因为索引还包含 Scope、Cluster 和 Boundary 对象。Cluster 数、Quick Jump 对象数、单视图 Nodes 范围、最大 Edges 和 Workload checksum 都必须与 Corpus 内冻结的期望值完全相等；38 nodes / 100 edges 的产品 Cap 也必须满足。上述条件全部参与最终 `passed`，因此投影意外缩小或扩张都不能靠“更快”绕过门禁。

功能正确性仍由 `largeRepositoryAcceptance.test.ts` 负责，包括全对象可达、Raw Edge 成员保真、层级 Cap 和 Quick Jump Intent。性能基线与 Acceptance 分离，避免通过放宽 5 秒测试超时来隐藏回归。

## 4. 采集环境与版本

| 项 | 值 |
|---|---|
| 采集时间 | 2026-07-28T06:29:59.857Z |
| Product | `@understand-code/skill` 2.7.5 |
| Base Git HEAD | `e6d8ae56a30201c11a9c963fd9aaa82c3e6489bd` |
| 工作树 | dirty（Benchmark 功能尚未提交） |
| Node / V8 / pnpm | v26.0.0 / 14.6.202.33-node.19 / 11.2.2 |
| `pnpm-lock.yaml` SHA-256 | `6860b4988f34f7d2259a94948abdefbdc3c37be03ea1e38d8c51b9ad33dcec87` |
| OS | Darwin 25.5.0 / arm64 |
| CPU | Apple M3，8 logical CPUs |
| Memory | 17,179,869,184 bytes（16 GiB） |

因为采集发生在本功能提交前，Raw Evidence 同时保存 Fixture、Benchmark、两个生产 Graph 模块、Layout Message 模型、Layout Algorithm 和 `pnpm-lock.yaml` 的 SHA-256；它们比单独的 dirty HEAD 更精确地标识了被测实现。发布候选仍应在 clean RC Commit 上重跑。

## 5. 复现命令

从仓库根目录执行：

```bash
pnpm benchmark:large-repository -- --output /tmp/understand-code-large-repository-baseline.json
```

命令会先构建 Core，再加载 Dashboard 生产模型；相对输出路径按最初调用目录解析。省略 `--output` 时完整 JSON 输出到 stdout。

验证 Harness 与 Fixture 契约：

```bash
pnpm --filter @understand-code/dashboard exec vitest run \
  src/graphExplorer/benchmarks/__tests__/largeRepositoryBenchmark.test.ts
```

Raw Evidence：

- `docs/research/evidence/performance/2026-07-28/large-repository-baseline.json`
- SHA-256：`b6feda0dd98aaa3a5adde2434c90038a1a50f30c3c360cee8e4013fc5757a6ac`

## 6. 当前不能由本基线证明的事项

- 浏览器 DOM、React Commit 和 CSS Paint。
- Layout Worker 的启动、Structured Clone、排队和主线程回传；本基线测的是生产同步 `computeLayout`（含 Dagre）。
- Graph、Wiki、Task Artifact 的磁盘与网络加载。
- Repo Pulse、Task Brief、Change Check 等尚未实现的 WP2–WP5 操作。
- 不同 CPU、Node LTS 和 CI Runner 的跨机器稳定区间。

因此本报告可以关闭 WP0 的“可复现大仓 Graph Projection + Synchronous Layout 性能基线”交付物，但不能替代 WP7/WP8 的 Workbench FMR、安装后 E2E 和 RC 性能报告。
