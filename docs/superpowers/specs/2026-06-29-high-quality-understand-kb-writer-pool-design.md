# 高质量知识库 Writer Pool 设计

## 背景

当前 `/understand-kb` 已经具备完整知识库生成的骨架能力：

- `/understand` 先扫描仓库并生成 `.understand-code/knowledge-graph.json`；
- `/understand-kb` 再根据图谱、源码快照、文件任务和专题任务产出 Markdown 知识库；
- 现有流程已经支持文件文档、关键函数专题、业务事实抽取、业务能力文档、覆盖报告与重试计划；
- 现有实现也已经加入了大图 deterministic 保护、源码读取上限和保守并发默认值。

问题不再是“能不能生成知识库”，而是“如何在大型仓库上稳定生成高质量知识库”。旧的并行设计虽然已经把默认并发降到了 `2`，但执行模型仍然是“一个 batch 对应一个 writer agent”。对于大仓库，这会带来几个实际问题：

- 累计派发的 writer agent 数量仍然随 batch 数线性增长；
- 文件阶段和专题阶段都会频繁创建新 agent，风格与上下文连续性较弱；
- 即使并发不高，累计起停大量 agent 仍会增加上下文和资源开销；
- 失败重试仍是 batch 级，但没有把“高质量优先”写成阶段门禁；
- 如果默认覆盖所有长尾专题，整体耗时容易被拖长，不适合大仓库日常使用。

用户对新方案的约束已经非常明确：

- 文件文档和专题文档都要以高质量为优先，而不是只保覆盖；
- 可以更慢，但不能慢到天级别；
- 默认同时运行的 writer agent 最多为 `2`；
- 不希望再看到“按 batch 派出很多短命子 agent”的模式；
- 允许保留 deterministic 能力，但它不应再被当作高质量成品的默认兜底。

## 目标

把 `/understand-kb` 改成一个“高质量优先、固定 writer 数、可恢复、小时级完成主干知识库”的流水线。

新流程需要同时满足：

- 文件文档和专题文档都继续由高质量 writer 输出主导；
- 活跃 writer 数恒定受控，默认最多 `2` 个；
- 文件阶段先完成并通过质量门禁，专题阶段才开始；
- 默认一次运行交付完整主干知识库，而不是长时间卡在长尾专题上；
- 中断后可以续跑，不重做已成功部分；
- 失败不能被静默降级成“看起来完成但其实质量不足”的最终知识库。

## 非目标

- 不追求把所有文档都改成纯确定性模板输出。
- 不追求提高并发来换取更短的总耗时。
- 不在这次设计里重做图谱扫描器 `/understand`。
- 不把 dashboard 大图渲染问题混进本次知识库编排改造。
- 不取消现有 batch 产物格式、merge 校验器和覆盖报告体系。
- 不要求一次运行默认覆盖所有长尾专题。

## 推荐方案

推荐方案是：**固定两条 writer 通道，按阶段顺序消费任务队列，并把高质量门禁写入 orchestration 规则。**

核心原则：

1. writer 数固定，不再随着 batch 数增长；
2. batch 仍保留，但它从“创建 agent 的单位”改成“任务切片、验收和重试的单位”；
3. 文件文档先完成且通过质量校验，专题阶段才启动；
4. 专题分为 `required topics` 和 `extended topics`，默认只要求前者完成；
5. deterministic 输出保留，但默认只作为诊断草稿和调试材料，不直接混入高质量最终结果。

## 总体架构

```text
/understand
  -> 生成 knowledge-graph.json

/understand-kb
  -> Phase 1: prepare-file-docs
  -> Phase 2: file writer pool (2 workers)
  -> Phase 3: merge-file-docs + file quality gate
  -> Phase 4: prepare-topics
  -> Phase 5: topic writer pool (2 workers)
  -> Phase 6: merge/finalize + top-level docs + coverage/report
  -> Phase 7: optional extended topics continuation
```

与现有流程的关键区别不是减少文档数量，而是改变执行模型：

- 现有模式：`很多 batch -> 很多短生命周期 writer agent`
- 新模式：`很多 batch -> 固定 2 个长期 worker 顺序领取任务`

这里的 “worker” 是逻辑概念。实现层可以是持久化 subagent thread、可复用会话、或等价的“复用同一写作上下文”的机制，但对外表现必须满足：

- 系统任意时刻活跃的 writer 数不超过 `PARALLEL_LIMIT`；
- 默认 `PARALLEL_LIMIT = 2`；
- worker 连续处理多个相关任务时，上下文能够被复用，而不是每个任务都从零开始。

## 文件阶段

### 输入

- `knowledge-graph.json`
- `kb-profile.json`
- `file-doc-plan.json`
- `file-doc-batches.json`
- 源码快照
- 业务事实抽取结果

### 设计要求

- 文件任务继续按现有 `FileDocTask` / `FileDocBatch` 结构准备；
- batch 规则仍然以源码长度、图谱项数量、文件关系等为依据；
- 但 batch 不再直接对应“新建一个 writer agent”；
- writer pool 从队列中逐个领取 batch，并连续输出多个文件批次结果。

### 质量要求

- 文件文档仍然必须覆盖父文件、函数卡片、类卡片、相关边和证据锚点；
- 文件文档的业务部分必须尽量吃到源代码注释、常量、分支、测试和业务事实，而不是只复述图谱摘要；
- 文件阶段完成后，所有文件任务都必须进入 `succeeded` 或 `failed_terminal`，不能停留在未决状态。

## 专题阶段

专题阶段必须建立在“文件阶段高质量完成”的前提上。

### 关键变化

- 专题 writer 不与文件 writer 混跑；
- 专题输入不只依赖图谱，还要显式读取已通过校验的文件文档摘要；
- 专题默认分层：
  - `required topics`：必须在一次默认 run 中完成；
  - `extended topics`：可选续跑，不阻塞主干交付。

### `required topics`

默认必须完成的专题包括：

- 入口到核心业务的跨文件调用链；
- 高信号业务能力或业务流程；
- 跨层桥接节点；
- 高复杂度关键函数专题；
- 与配置、实验、规则、表单、导流、召回、推荐、降级等业务信号强相关的主题。

### `extended topics`

默认不阻塞主干交付的专题包括：

- 长尾技术专题；
- 低优先级边缘节点专题；
- 对主业务价值不高但可补充阅读体验的专题；
- 仅作为知识库丰富度增强的额外聚类主题。

默认一次运行的成功标准是：

- 全部文件文档成功；
- 全部 `required topics` 成功；
- 顶层总览、索引、覆盖报告成功；
- `extended topics` 可缺席但必须出现在队列和报告中，可通过续跑完成。

## 任务队列模型

为文件阶段和专题阶段都引入显式队列文件：

- `.intermediate/file-doc-queue.json`
- `.intermediate/topic-queue.json`

每个队列项至少包含：

```json
{
  "kind": "file-doc",
  "batchIndex": 12,
  "status": "pending",
  "attempts": 0,
  "workerId": null,
  "leasedAt": null,
  "updatedAt": "2026-06-29T00:00:00.000Z"
}
```

状态定义：

- `pending`：尚未执行
- `leased`：已被某个 worker 领取
- `succeeded`：结果已通过当前阶段校验
- `needs_retry`：本轮结果失败，需要再试一次
- `failed_terminal`：超过可接受重试次数，阶段无法继续推进

### lease 规则

- orchestrator 只维护固定数量的 worker；
- 空闲 worker 才能领取新任务；
- 任务领取后先写临时输出，再原子落盘为正式 JSON；
- 写入成功后才允许把队列状态更新为 `succeeded`；
- 若进程中断，过期 lease 可在 `--resume` 模式下被回收。

### 重试规则

- 默认每个任务最多两次尝试；
- 第一次失败后进入 `needs_retry`；
- 第二次尝试应带上更聚焦的补充上下文：
  - 上次缺失的函数卡片或类卡片
  - merge/contract 校验错误
  - 缺失证据或不满足专题要求的具体提示
- 第二次仍失败则标记为 `failed_terminal`。

## 阶段门禁

阶段门禁是这次设计的硬约束。

### 文件门禁

出现以下任一情况时，不允许进入专题阶段：

- 文件队列中仍有 `pending` 或 `leased` 项；
- 文件队列中存在 `failed_terminal` 项；
- `merge-file-docs` 校验未通过；
- 文件覆盖报告未达到设计要求。

### 专题门禁

出现以下任一情况时，不允许进入最终成功态：

- `required topics` 队列中存在 `pending`、`leased` 或 `failed_terminal`；
- topic merge 校验未通过；
- 顶层覆盖报告无法证明主干知识库完整。

### fallback 规则

deterministic fallback 仍然保留，但默认只用于：

- 失败诊断草稿；
- 调试中间材料；
- 在没有 agent 能力时的保底输出；
- 对比高质量结果的差异分析。

默认高质量模式下，deterministic 文档不直接充当失败任务的“静默替身”。

## 质量控制策略

高质量模式下，writer 不应每次从零拼装上下文。为避免质量高但速度失控，orchestrator 需要预先打包证据，而不是让 writer 自己翻遍整个仓库。

### 证据打包

每个文件批次和专题批次都应包含：

- 相关源码快照；
- 图谱节点和边；
- 已抽取的业务事实；
- 已完成文件文档的摘要；
- 上下游调用关系；
- 缺口提示和上轮失败原因。

这样可以把 writer 的工作重心放在“解释与整合”，而不是“搜集原始材料”。

### 风格一致性

固定 writer pool 的一个重要收益是风格一致。连续消费相关任务时，worker 能保留：

- 文档结构习惯；
- 术语翻译一致性；
- 业务概念命名一致性；
- 对仓库主要模块的连续理解。

这是高质量方案优于“大量短命 batch agent”的关键点之一。

## 时间边界

新方案的目标不是最快，而是“高质量且可接受地慢”。

默认运行的目标时间尺度应是：

- 大型仓库主干知识库：小时级；
- 绝不把默认成功路径设计成天级运行。

为了达成这个目标，设计上必须同时满足：

- 默认只跑 `required topics`；
- `extended topics` 可续跑；
- 文件和专题都支持 `--resume`；
- worker 上下文被复用，减少频繁起新 agent 的额外开销；
- 证据预打包，减少 agent 重新阅读大段上下文的成本。

这里不写死分钟数，因为不同仓库差异太大，但实现方案必须以“主干结果可在同一工作时段内拿到”为目标。

## 命令层设计

用户接口保持简单，但含义更明确。

### 默认命令

```text
/understand-kb <path>
```

行为：

- 高质量模式
- writer 并发默认 `2`
- 先文件后专题
- 默认只要求完成 `required topics`

### 并发参数

```text
/understand-kb <path> --parallel 1
/understand-kb <path> --parallel 2
```

规则：

- 默认允许 `1` 或 `2`
- 大于 `2` 时默认直接拒绝执行
- 不允许用提高并发作为常规加速手段

### 续跑

```text
/understand-kb <path> --resume
```

行为：

- 读取队列状态
- 只处理 `pending` / `needs_retry` / 过期 `leased`
- 不重做 `succeeded`

### 补长尾专题

```text
/understand-kb <path> --include-extended-topics
```

行为：

- 在主干成功后，继续处理 `extended topics`
- 不影响默认一次 run 的成功定义

## 中间产物

保留现有中间文件，并新增以下状态文件：

```text
.understand-code/knowledge-base/.intermediate/
├── kb-profile.json
├── file-doc-plan.json
├── file-doc-batches.json
├── file-doc-queue.json
├── file-doc-batch-<n>.json
├── topic-plan.json
├── topic-batches.json
├── topic-queue.json
├── topic-batch-<n>.json
├── validation-report.json
└── retry-report.json
```

目标是让用户和后续 agent 都能清楚回答：

- 还有哪些任务没跑；
- 哪些任务失败过；
- 哪些任务已成功且不需要重做；
- 为什么当前阶段没有继续推进。

## 测试策略

### 单元测试

覆盖以下内容：

- 队列状态流转
- lease 与过期回收
- `needs_retry` / `failed_terminal` 规则
- 文件阶段和专题阶段的门禁条件
- `required topics` / `extended topics` 分层
- `--resume` 只处理未完成任务

### 集成测试

使用小型图谱验证：

- `prepare-file-docs -> file writer pool -> merge-file-docs`
- `prepare-topics -> topic writer pool -> finalize`
- 中途中断后 `--resume` 正常续跑

### 回归验证

使用合成大图或大仓库样本验证：

- 活跃 writer 数始终不超过 `2`
- 默认模式只覆盖 `required topics`
- deterministic fallback 不会静默伪装成高质量成功结果
- 主干知识库在小时级目标时间边界内完成

## 验收标准

### 运行稳定性

- 默认活跃 writer 数不超过 `2`
- 不再采用“一个 batch 一个新 writer agent”的执行模型
- 阶段之间不会混跑导致资源峰值叠加

### 文档质量

- 文件文档和 `required topics` 都由 writer 主导完成
- merge/coverage 校验必须通过
- 失败任务不能被静默降级为最终成功结果

### 时间边界

- 默认主干知识库目标为小时级完成
- `extended topics` 不阻塞主干交付
- 续跑能力可以把长尾补充与主干成功解耦

### 可恢复性

- 中断后 `--resume` 只继续未完成任务
- 已成功结果不会被重复覆盖
- 阶段失败时能从中间状态准确恢复

## 迁移策略

新方案应尽量复用现有资产：

- 保留 `FileDocTask` / `FileDocBatch` / `TopicBatch` 结构；
- 保留现有 merge validator 和 coverage report；
- 保留 deterministic 生成器；
- 保留现有 `.intermediate/file-doc-batch-<n>.json` 与 `topic-batch-<n>.json` 产物契约。

新增改造主要集中在：

- `/understand-kb` orchestration 逻辑；
- 队列状态文件；
- worker lease / resume / retry 机制；
- topic 分层规划；
- 高质量模式下的阶段门禁。

## 结论

这次改造的本质不是减少知识库内容，而是把 `/understand-kb` 从“许多短命 batch writer”升级为“固定小规模高质量 writer pool + 阶段门禁 + 可恢复队列”。

这样可以同时满足三个目标：

- 文件文档和专题文档都维持高质量；
- 大型仓库运行时资源更稳；
- 默认主干知识库在小时级可交付，而不是被长尾专题拖到天级。
