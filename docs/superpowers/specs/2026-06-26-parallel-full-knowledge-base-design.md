# 并行完整知识库生成设计

## 背景

第一版 Graph-to-Knowledge Base 已经证明这个项目可以做到：

- 读取 `.understand-anything/knowledge-graph.json`；
- 构建图谱索引和项目画像；
- 根据项目规模动态规划文档，而不是写死主题数量；
- 生成 Markdown 文件；
- 校验文件、函数、类的索引覆盖；
- 报告实际生成的文档数量和覆盖状态。

这一版适合作为确定性的骨架生成器，但还不是用户想要的“完整代码库知识库”。现在生成的文档偏薄，主要原因是它只渲染图谱摘要，没有按文件重新读取源码，没有生成足够细的函数卡片，也没有为大型仓库建立稳定的文件级组织形态。

下一版应该继续把图谱作为覆盖基准，同时让多个并行 agent 读取源码、补充上下文，并生成更完整的中文知识库。

## 目标

把 `/understand-kb` 升级成一个“图谱驱动、源码佐证、并行生成”的知识库流水线。

生成结果需要按代码库结构做到完整覆盖：

- 每个 `file` 节点都有一篇独立的文件知识文档；
- 每个 `function` 节点都出现在所属文件文档的函数卡片里；
- 每个 `class` 节点都出现在所属文件文档的类卡片里；
- 重要函数和重要类额外生成专题文档；
- 默认所有说明性内容都使用中文；
- 最终覆盖报告必须证明图谱、文件文档、函数卡片、类卡片、关系、专题、源码读取和重试状态。

最终知识库要同时服务三类读者：

- 工程师接手代码；
- 产品/运营理解业务逻辑；
- 后续 AI agent 检索、问答和继续开发。

## 非目标

- 默认不为每个函数单独生成一篇 Markdown。
- 不让单个超长 agent 独自分析整个仓库。
- 不把“索引里出现过”当成“知识库完整”。
- 当任何图谱中的文件、函数、类节点缺失于文件文档时，不允许标记为 complete。
- 不依赖 dashboard UI 才能生成知识库。
- 确定性 fallback 的索引和覆盖报告不强依赖 LLM。

## 推荐方案

采用多阶段 `/understand-kb` 流水线：

```text
/understand
  -> 生成完整 knowledge-graph.json

/understand-kb
  -> Phase 1: 图谱画像和覆盖计划
  -> Phase 2: 文件文档批次规划
  -> Phase 3: 并行 kb-file-writer agents
  -> Phase 4: 合并文件文档并校验覆盖
  -> Phase 5: 并行 kb-topic-writer agents
  -> Phase 6: 生成总览、索引、覆盖报告
  -> Phase 7: 输出失败批次和重试报告
```

现有确定性生成器继续保留，用作：

- agent 生成关闭时的 fallback；
- 索引生成的稳定基础；
- 图谱索引和覆盖校验的核心逻辑；
- 部分 agent 批次失败时仍能产出可诊断的部分结果。

## 输出目录

```text
.understand-anything/knowledge-base/
├── 目录.md
├── 项目总览.md
├── 架构地图.md
├── 业务流程地图.md
├── 覆盖报告.md
├── 待确认项.md
├── 模块总览/
│   └── <layer>.md
├── 文件文档/
│   └── <stable-file-path-slug>.md
├── 关键函数专题/
│   └── <stable-function-slug>.md
├── 索引/
│   ├── 文件索引.md
│   ├── 函数索引.md
│   ├── 类索引.md
│   ├── 调用关系索引.md
│   └── AI检索索引.md
└── .intermediate/
    ├── kb-profile.json
    ├── file-doc-plan.json
    ├── file-doc-batches.json
    ├── file-doc-batch-<n>.json
    ├── topic-plan.json
    ├── topic-batch-<n>.json
    └── validation-report.json
```

`.intermediate/` 默认保留，用于调试、覆盖验证和失败重试。以后可以增加 `--clean-intermediate`，在 complete 后清理中间文件。

## 完整性定义

只有同时满足以下条件，知识库才算完整：

- 每个 `file` 节点都有且只有一篇文件知识文档。
- 每个 `function` 节点都在父文件文档中有函数卡片。
- 每个 `class` 节点都在父文件文档中有类卡片。
- 每条 file -> function/class 的 `contains` 边都在对应文件文档中体现。
- 每条 `calls` 边都出现在调用关系索引中，并至少出现在一个相关文件文档或专题文档里。
- 每条 `imports` 边都出现在文件文档的依赖部分或导入关系索引里。
- 每个 layer 都有模块总览。
- 每个入口候选节点都出现在业务流程地图或专题文档中。
- 除代码标识符和常见技术名词外，生成文档默认使用中文。
- 每篇文件文档都包含代码证据；图谱有行号时必须写出文件路径和行号范围。
- 所有跳过项、弱推断和无法确认的业务含义都记录到 `待确认项.md`。

`Coverage status: complete` 不能只表示“出现在索引里”。它必须表示文件文档层已经覆盖图谱中的结构性内容。

## Phase 1: 图谱画像和覆盖计划

输入：

- `.understand-anything/knowledge-graph.json`
- 仓库源码文件
- 可选配置 `.understand-anything/config.json`

主进程构建以下索引：

- 按 node id 建立节点索引；
- file -> function/class 子节点索引；
- function/class -> file 父节点索引；
- 按节点聚合 incoming/outgoing edges；
- `calls` / `imports` / `contains` 关系索引；
- node -> layer 映射；
- 入口候选节点；
- 关键函数候选节点；
- 代码证据缺口；
- 图谱陈旧性告警。

在派发 agent 前，主进程需要识别明显问题：

- 图谱中的文件数量明显小于仓库源码文件数量；
- 图谱 `analyzedAt` 相比当前工作区明显过旧；
- 图谱记录的 commit hash 与当前 `git rev-parse HEAD` 不一致；
- `calls` 边缺失或明显稀疏；
- function 节点缺少行号范围；
- 图谱引用的文件在当前仓库中不存在。

这些告警默认不阻塞生成，但必须写入 `覆盖报告.md`。

## Phase 2: 文件文档批次规划

完整覆盖的基本单位是“文件文档”。

每个 `file` 节点生成一个 file-doc task：

```json
{
  "batchIndex": 1,
  "fileNodeId": "file:src/service/feed.ts",
  "filePath": "src/service/feed.ts",
  "layerId": "layer:service",
  "functionNodeIds": ["function:src/service/feed.ts:BuildFeed"],
  "classNodeIds": [],
  "incomingEdges": [],
  "outgoingEdges": [],
  "neighborNodeIds": [],
  "sourceReadMode": "full"
}
```

批次规划规则：

- 大文件单独分析。
- 函数或类很多的文件单独分析。
- 普通小文件可以合并为一个批次。
- 同 layer、同目录的文件优先放在同一批次。
- 调用或导入关系紧密的文件可以放在同一批次，帮助 agent 理解上下游。
- 批次大小根据源码长度、函数数量、类数量、关系数量动态计算。
- 不允许写死固定文档数量或固定专题数量。

计划文件需要记录每个文件被这样分批的原因。

## Phase 3: 并行文件文档 Agent

新增 agent：

```text
agents/kb-file-writer.md
```

每个 `kb-file-writer` 接收一个批次，输出一个 JSON 文件：

```text
.understand-anything/knowledge-base/.intermediate/file-doc-batch-<batchIndex>.json
```

主进程可以同时运行多个 file-writer agent。并行方式应参考 `/understand` 的 file-analyzer 批次模式，而不是让一个 agent 独自写完整仓库。

### File Writer 输入

每个 agent 获取：

- 项目元信息；
- layer 上下文；
- 一个或多个 file-doc tasks；
- 每个文件的源码内容，或读取这些文件的权限；
- 这些文件对应的图谱节点；
- 触达这些节点的图谱边；
- 附近上游/下游节点作为上下文；
- 输出语言要求：中文。

### File Writer 输出契约

agent 必须输出 JSON：

```json
{
  "batchIndex": 1,
  "documents": [
    {
      "fileNodeId": "file:src/service/feed.ts",
      "filePath": "src/service/feed.ts",
      "documentPath": "文件文档/src-service-feed.ts.md",
      "title": "src/service/feed.ts 文件知识文档",
      "coveredFunctionNodeIds": ["function:src/service/feed.ts:BuildFeed"],
      "coveredClassNodeIds": [],
      "representedEdgeIds": ["edge:calls:BuildFeed->FetchCandidates"],
      "sourceEvidence": [
        {
          "filePath": "src/service/feed.ts",
          "lineRange": [30, 90],
          "nodeId": "function:src/service/feed.ts:BuildFeed"
        }
      ],
      "markdown": "# src/service/feed.ts 文件知识文档\n\n## 文件职责\n本文件负责组装 feed 结果。真实输出必须包含全部必需章节。"
    }
  ],
  "warnings": []
}
```

主进程必须先校验 JSON，再接受其中的 Markdown。

### 文件文档必需章节

每篇文件文档必须使用中文，并包含：

```text
# <filePath> 文件知识文档

## 文件职责

## 所属位置
- Layer
- 目录/模块
- 上游文件/函数
- 下游文件/函数

## 文件内结构
- 函数总数
- 类总数
- 关键函数

## 函数卡片
### <function name>
- 节点 ID
- 位置
- 职责
- 输入/依赖
- 输出/副作用
- 上游调用
- 下游调用
- 业务含义
- 注意事项
- 代码证据

## 类卡片

## 调用关系

## 风险点与待确认项

## AI 检索词
```

如果某个文件没有函数或类，也必须生成文件文档，并说明它承担的文件级职责。

## Phase 4: 合并文件文档并校验覆盖

主进程合并所有 file-doc batch JSON。

校验必须包括：

- 每个 file-doc task 都有且只有一个 accepted document；
- 每个期望的 function node id 都出现在 `coveredFunctionNodeIds`；
- 每个期望的 class node id 都出现在 `coveredClassNodeIds`；
- Markdown 包含必需章节；
- Markdown 主体基本为中文；
- Markdown 包含代码证据；
- 不包含占位符文本；
- 文件路径和 node id 与图谱一致；
- 输出路径稳定且不冲突。

如果校验失败：

- 写出 `.intermediate/file-doc-retry-plan.json`；
- 标记失败批次；
- 不允许把覆盖状态标记为 complete；
- 支持只重跑失败批次。

## Phase 5: 并行专题 Agent

新增 agent：

```text
agents/kb-topic-writer.md
```

专题选择使用项目自身信号：

- 入口候选节点；
- 高复杂度且业务相关的函数/类；
- 跨 layer 的调用桥接点；
- 入度/出度相对项目分布较高的节点；
- 触达配置、外部服务、schema、资源或数据节点的函数；
- 出现在多篇重要文件文档中的函数；
- file-writer 输出中明确标记为 important 的函数/类。

不允许固定专题数量。专题数量由覆盖、重要性和项目规模共同决定。

### Topic Writer 输出契约

```json
{
  "batchIndex": 1,
  "topics": [
    {
      "topicNodeId": "function:src/service/feed.ts:BuildFeed",
      "sourceFileNodeId": "file:src/service/feed.ts",
      "documentPath": "关键函数专题/src-service-feed-BuildFeed.md",
      "title": "BuildFeed 关键函数专题",
      "coveredNodeIds": ["function:src/service/feed.ts:BuildFeed"],
      "linkedFileDocumentPath": "文件文档/src-service-feed.ts.md",
      "evidence": [
        {
          "filePath": "src/service/feed.ts",
          "lineRange": [30, 90]
        }
      ],
      "markdown": "# BuildFeed 关键函数专题\n\n## 为什么关键\n该函数位于主要业务链路。真实输出必须包含全部必需章节。"
    }
  ],
  "warnings": []
}
```

### 专题文档必需章节

每篇专题必须包含：

- 为什么关键；
- 在业务流程中的位置；
- 主要输入、输出、副作用；
- 关键分支和算法；
- 配置和外部依赖；
- 上游调用者；
- 下游调用对象；
- 修改风险；
- 测试证据；
- 代码证据；
- AI 检索词。

## Phase 6: 生成总览、索引和覆盖报告

文件文档和专题文档通过校验后，主进程生成：

- `目录.md`；
- `项目总览.md`；
- `架构地图.md`；
- `业务流程地图.md`；
- `模块总览/*.md`；
- `索引/文件索引.md`；
- `索引/函数索引.md`；
- `索引/类索引.md`；
- `索引/调用关系索引.md`；
- `索引/AI检索索引.md`；
- `待确认项.md`；
- `覆盖报告.md`。

索引需要链接到文件文档和专题文档。

调用关系索引要支持追踪：

- function -> downstream callees；
- function -> upstream callers；
- file -> imported files；
- file -> importing files；
- `calls` 缺失时的估算关系，并明确标记为推断。

## 覆盖报告要求

`覆盖报告.md` 必须包含：

- 按类别统计的实际生成文档数量；
- graph node 按类型统计；
- graph edge 按类型统计；
- 文件文档覆盖：covered / total；
- 函数卡片覆盖：covered / total；
- 类卡片覆盖：covered / total；
- 按 edge type 统计的关系覆盖；
- 源码读取覆盖：files read / files expected；
- file-writer 批次数、通过数、重试数；
- topic 批次数、通过数、重试数；
- 中文内容校验摘要；
- 占位符校验摘要；
- 图谱陈旧性告警；
- 未完成覆盖失败项；
- 最终状态：`complete`、`complete-with-warnings` 或 `incomplete`。

状态规则：

- `complete`：所有必需覆盖校验通过，且没有严重图谱陈旧告警。
- `complete-with-warnings`：必需覆盖通过，但图谱陈旧、`calls` 稀疏，或存在需要外部确认的事实。
- `incomplete`：任何文件、函数、类覆盖要求失败。

## 错误处理和重试

失败需要局部化：

- 一个文件批次失败，只重跑该文件批次。
- 一篇文件文档漏掉函数或类，只重跑它所属的批次。
- 一个专题失败，只重跑该专题批次。
- 图谱基础校验失败时，在派发 agent 前停止。
- 源文件缺失时，可以基于图谱事实生成 fallback 文件文档，但除非该文件被明确排除，否则最终状态必须标记为 incomplete。

重试相关文件：

```text
.intermediate/file-doc-retry-plan.json
.intermediate/topic-retry-plan.json
.intermediate/validation-report.json
```

## 语言要求

默认输出语言是中文。

规则：

- 标题使用中文。
- 解释性正文使用中文。
- 技术标识符、函数名、文件路径、包名、框架名保持原样。
- 当运行时事实只能从代码推断时，使用固定措辞：

```text
根据代码推断，需线上配置确认
```

以后可以支持 `--language <lang>`，但当前工作流默认中文。

## CLI 行为

`/understand-kb` 应支持：

```text
/understand-kb [project-path]
/understand-kb --parallel <n>
/understand-kb --retry
/understand-kb --deterministic-only
/understand-kb --keep-intermediate
```

首个实现版本可以默认使用平台正常的 subagent 并行能力，不必一次性暴露所有 flags。

## 测试

增加确定性规划和合并校验测试：

- file-doc task planning 覆盖每个 file node；
- 每个文件期望的 function/class 都进入必需覆盖；
- 缺少文件文档会导致 incomplete；
- 缺少函数卡片会导致 incomplete；
- 无效 file-writer JSON 会被拒绝；
- 重复 document path 会被拒绝；
- topic selection 不使用固定数量；
- 调用关系索引覆盖所有 `calls` 边；
- 图谱 commit 与当前 commit 不一致时出现陈旧性告警；
- 关闭 agents 时，确定性 fallback 仍可工作。

手动验证包括：

- 极小 fixture 仓库；
- 当前 understand-anything 仓库在真实 `/understand` 扫描后的图谱；
- 文件和函数很多的大型仓库；
- `calls` 边稀疏的图谱；
- 源文件缺失的图谱。

## 分阶段落地

按以下阶段实现：

1. File-doc plan 和 JSON contracts。
2. `kb-file-writer` agent 与合并校验。
3. 文件文档输出目录和索引。
4. Topic plan 与 `kb-topic-writer`。
5. 总览、地图和覆盖报告。
6. 重试能力。
7. 图谱陈旧性和源码读取校验。

第一个里程碑必须证明：

- 每个 file node 都有文件文档；
- 每个 function/class 都有中文卡片；
- 多个 file-writer agents 能够并行运行；
- 不完整批次会阻止最终状态变为 complete；
- 最终文档数量来自实际输出，而不是预设常量。
