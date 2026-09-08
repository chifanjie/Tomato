# ALPHA-A Gold Task 草案（DRAFT / 未批准 / 非 Gold）

**状态：DRAFT。** 本文件只供 Product/QA 真人复核，不是已版本化的 Gold Task
定义，也不构成两人批准、G2/G3 资格或 Step 17 Release 证据。草案基于
ALPHA-A 的精确源码 pin：
`34da354968a6071d914e4e4a4fca738e6c2d8a29`（`perf(dashboard): add reproducible
large-repository baseline`）。源码与既有测试均通过该 pin 的
`git ls-tree`/`git show` 只读盘点；没有凭空引用当前工作树的后续文件。

本文件本身不修改 Gold corpus、schema、runner 或生产代码。每项任务的意图、
允许/禁止范围、预期阅读路径和验证命令，都必须由 Product/QA 复核后才能
转成真正的任务定义、任务摘要和 `taskDefinitionDigest`。任何需要真实模型、
Codex/Claude 登录、Provider 写入或 ALPHA-B 私有源的步骤都不在本草案内。

## 覆盖记号与共同验证前提

- `[cross-file]`：候选改动需要同时阅读/协调两个或更多生产文件（测试文件另列）。
- `[test-impact]`：候选变更预期影响已有行为测试或需要新增回归测试。
- `[unplanned]`：验证变体故意同时带入一个任务范围外的文件，观察系统是否显式
  识别而不是吞掉它；不把该变体写成“允许修改”。
- `[unknown]`：源码给出了现行行为，但产品预期仍需真人决定。

当前记号只是**计划覆盖**，不是 Gold 已满足项：本版草案计划标记为
`cross-file` 13 项（A01、A02、A04、A05、A07、A08、A09、A11、A13、A15、A16、A17、A18），
`test-impact` 18 项，`unplanned` 4 项（A02、A03、A04、A17），`unknown` 6 项
（A06、A09、A12、A14、A16、A18）。这些数字仅表示候选任务的覆盖意图；任务
定义尚未版本化、没有两人复核，也没有任何 G2/G3 通过含义。若 Product/QA 删除或
合并任务后少于各 coverage minimum，必须明确记录缺口，不能为了凑数保留标签。

命令中的 `PIN` 指上面的 40 字符提交。验证应在该 pin 的临时 clean worktree
中执行；不得在本轮脏工作树中把结果写成 Gold 证据。通用命令形态为：

```sh
git worktree add --detach /tmp/uc-alpha-a-task PIN
cd /tmp/uc-alpha-a-task
pnpm install --frozen-lockfile
pnpm --filter @understand-code/core test <test-file>
pnpm --filter @understand-code/core build
```

其中 `<test-file>` 是相对于 `packages/core` 的路径（例如
`src/knowledge-base/__tests__/publication-quality.test.ts`）；不要再插入额外的
`--`，否则该 pin 的 `vitest run` 会把文件参数当作分隔后的选项而退回整包运行。

下面的行号是该 pin 中的行号；若后续源码重排，必须按符号重新核对，不能沿用
旧行号作身份。

## 候选任务

### A01 — 让指纹变化与更新决策保持同一结构语义 `[cross-file] [test-impact]`

- **任务意图：** 当函数/类签名、导出状态、导入集合或实现体发生变化时，令
  `compareFingerprints` 的 `NONE/COSMETIC/STRUCTURAL` 结果与
  `classifyUpdate` 的重分析范围一致；避免只改内部实现却意外触发架构全量分析，
  也避免 API 形状变化被当成 cosmetic。
- **Pin 锚点：** `packages/core/src/fingerprint.ts:79-251`
  `extractFileFingerprint`、`compareFingerprints`；配套
  `packages/core/src/change-classifier.ts:21-91` `classifyUpdate`；既有测试
  `packages/core/src/__tests__/fingerprint.test.ts:128-330`、
  `packages/core/src/__tests__/change-classifier.test.ts:17-183`。
- **允许修改：** 上述两个生产文件及对应测试；必要时只增加现有
  `FileChangeResult.details` 的稳定描述。**禁止：** 改图谱 schema、改变阈值而不经
  Product 决策、引入网络/模型或读取绝对路径。
- **预期阅读路径/候选结果：** 内容哈希 → 结构指纹 → 变化级别 → 更新动作；候选
  产物是可排序的 `fileChanges` 和 `filesToReanalyze`，且每个结构变化有可解释
  detail。影响 `analyzeChanges` 调用方和后续增量图谱更新。
- **证据状态：** Finding—pin 已比较函数参数、返回类型、导出、类方法/属性、导入；
  Unknown—实现体变化是否应始终 cosmetic，以及边界阈值是否要产品化，尚无产品
  决策。
- **验证思路：** 在 fingerprint 与 classifier 测试中加入同一组 old/new fixture，
  覆盖仅函数体、参数、导出和 50% 行数边界；断言级别、动作、重分析文件集合
  完全一致，再运行两份定向 Vitest。

### A02 — 增量扫描正确处理删除、新增和 Git 变更列表 `[cross-file] [test-impact] [unplanned]`

- **任务意图：** 让删除文件、新文件和插件无法分析的文件在增量路径上拥有明确、
  保守且稳定的结果，并让 Git diff 错误与空 diff 可区分地呈现给上层。
- **Pin 锚点：** `packages/core/src/fingerprint.ts:253-385`
  `buildFingerprintStore`、`analyzeChanges`；`packages/core/src/staleness.ts:13-46`
  `getChangedFiles`、`isStale`；测试
  `packages/core/src/__tests__/fingerprint.test.ts:332-427`、
  `packages/core/src/__tests__/staleness.test.ts:56-111`。
- **允许修改：** 两个生产文件与上述测试；可以增加测试专用 Git 命令 mock。**禁止：**
  把 Git 错误静默改写为“干净”、删除现有 conservative structural 规则、修改持久化
  文件格式。
- **预期阅读路径/候选结果：** `git diff --name-only` → `isStale` → 指纹存储查找 →
  `newFiles/deletedFiles/structurallyChangedFiles`；候选结果应保留路径顺序契约并
  让调用方知道是否可安全重分析。影响增量知识图谱刷新。
- **证据状态：** Finding—pin 对不存在文件直接跳过，对 Git 异常返回空数组；
  Unknown—上层是否需要区分“无变化”和“Git 失败”而不破坏现有接口。
- **验证思路：** mock `execFileSync` 返回多行、空串和抛错；同时设置一个范围外
  `docs/unplanned.md`（`[unplanned]` 变体），断言它不被吞掉且分类结果可审计。

### A03 — 修正目录结构变化的边界判定 `[test-impact] [unplanned]`

- **任务意图：** 让“新增/删除顶层目录”只在目录确实出现或完全消失时触发
  `ARCHITECTURE_UPDATE`，同一目录内新增文件仍保持局部更新；目录边界判定要对
  Windows 分隔符和空路径有明确结果。
- **Pin 锚点：** `packages/core/src/change-classifier.ts:21-130`
  `classifyUpdate`、模块内函数 `detectDirectoryChanges`、`topDirectory`；测试
  `packages/core/src/__tests__/change-classifier.test.ts:72-123`。
- **允许修改：** classifier 与其测试；可在测试中引入 `src/a.ts`、`lib/b.ts` 等
  纯内存路径。**禁止：** 擅自调整 `>10`、`>30`、`>50%` 三个既有阈值，或把目录
  判定移交给外部扫描器。
- **预期阅读路径/候选结果：** changed/new/deleted files → 顶层目录集合 →
  `PARTIAL_UPDATE` 或 `ARCHITECTURE_UPDATE`；候选产物包含稳定 reason，且不重复
  触发全量 tour。影响大仓库增量成本和架构摘要新鲜度。
- **证据状态：** Finding—pin 对 deleted 文件按“目录不在 existingDirs”判断，且
  `dirname("foo.ts")` 返回 `.`；Unknown—删除目录最后一个文件时的产品期望、
  Windows 路径是否必须在核心层支持。
- **验证思路：** 补充四组矩阵：同目录新增、真正新目录、删除目录最后文件、删除
  目录但仍有兄弟文件；再加入范围外文档文件的 `[unplanned]` 变体，核对 reason。

### A04 — 增量图谱合并时保持节点、边和提交元数据一致 `[cross-file] [test-impact] [unplanned]`

- **任务意图：** 变更文件的旧节点和涉及它们的边应原子替换，未变更节点/边应保留；
  新提交哈希与时间戳更新不能留下悬空边或重复节点，并且合并后的图经
  `saveGraph/loadGraph` 往返后仍保持同一拓扑与隐私化路径。
- **Pin 锚点：** `packages/core/src/staleness.ts:54-90`
  `mergeGraphUpdate`；`packages/core/src/persistence/index.ts:38-105`
  `sanitiseFilePaths`、`saveGraph`、`loadGraph`；类型定义
  `packages/core/src/types.ts:1-80`；测试
  `packages/core/src/__tests__/staleness.test.ts:113-253` 与
  `packages/core/src/persistence/persistence.test.ts`。
- **允许修改：** `staleness.ts`、`persistence/index.ts` 及对应测试。**禁止：** 改变
  `KnowledgeGraph` 公共字段、把未变更节点按名称而非 `filePath` 删除、扩大绝对路径
  暴露、或依赖当前时间以外的隐式状态。
- **预期阅读路径/候选结果：** changed file paths → removed node IDs → retained
  nodes/edges → new nodes/edges → project metadata → save/load sanitisation；候选图应
  无指向 removed ID 的边，且可重复合并得到同一拓扑（时间字段除外）。影响所有增量
  刷新、持久化和下游搜索。
- **证据状态：** Finding—pin 已过滤 source/target 命中 changed 节点的边；
  Unknown—相同 ID 的新节点是否必须去重、重复边是否由本函数还是上游负责。
- **验证思路：** 构造跨文件边、只改 target、删除文件和空变更四类 fixture；另在
  输入列表混入 `docs/unplanned.md` 变体，断言既不误删图节点又保留可审计变更。

### A05 — 规范化节点 ID 时保留函数、类和流程步骤身份 `[cross-file] [test-impact]`

- **任务意图：** 对双前缀、项目名前缀、裸路径和 step-flow 组合统一生成唯一、幂等
  的 `type:path` ID，同时不破坏边端点重写。
- **Pin 锚点：** `packages/core/src/analyzer/normalize-graph.ts:1-132`
  `normalizeNodeId`、`stripToValidPrefix`；`packages/core/src/analyzer/graph-builder.ts:130-213`
  的 `addFileWithAnalysis`/`addCallEdge`；`packages/core/src/types.ts:1-57`
  的 `GraphNode/GraphEdge`；测试 `packages/core/src/__tests__/normalize-graph.test.ts:9-123`、
  `packages/core/src/analyzer/graph-builder.test.ts:41-196`。
- **允许修改：** normalize-graph、GraphBuilder 与对应测试；必要时只补充类型注释。**禁止：** 改变
  已冻结的 `NodeType`/前缀集合，或使用项目绝对路径产生 ID。
- **预期阅读路径/候选结果：** 原始节点 ID + node type/filePath/name/parentFlowSlug
  → canonical ID；候选结果需幂等，且同文件同名 step 仍由 flow discriminator 区分。
  影响图谱节点引用、搜索和知识文档链接。
- **证据状态：** Finding—pin 的 GraphBuilder 生成 `function:<path>:<name>`，而
  `normalizeNodeId` 对 `node.type=function` 的 canonical prefix 是 `func`，两条路径
  存在需协调的身份边界；该 pin 也明确处理 double prefix 与 step flow slug。
  Unknown—应由 Builder 直接改成 canonical ID，还是由 normalize 层统一迁移；同时
  出现多个合法前缀时应保留哪个、未知 `node.type` 是否继续原样返回。
- **验证思路：** 用 `normalizeNodeId(normalizeNodeId(x))` 断言幂等，覆盖 `file:file:`、
  项目前缀、Windows 分隔符和两个同名 flow step，并执行 normalize 定向测试。

### A06 — 批量输出的复杂度、边重写、去重和悬空边统计 `[test-impact] [unknown]`

- **任务意图：** 让 `normalizeBatchOutput` 对数值/别名 complexity、重复节点/边及
  缺失端点产生准确统计，且不因输入数组排序或复用而突变调用方数据。
- **Pin 锚点：** `packages/core/src/analyzer/normalize-graph.ts:113-329`
  `normalizeComplexity`、`normalizeBatchOutput`；测试
  `packages/core/src/__tests__/normalize-graph.test.ts:124-498`。
- **允许修改：** normalize-graph 与测试；可增加 `NormalizationStats` 的 detail，
  但不能删除现有字段。**禁止：** 将 dangling edge 静默保留、改变“keep last”规则而
  不经复核、依赖图谱全局状态。
- **预期阅读路径/候选结果：** nodes pass 1 → idMap/complexity → dedup → edges pass 2
  → droppedEdges；候选产物可直接送入 `validateGraph`，并能解释每条丢弃边。
  影响所有 LLM/批量图谱导入。
- **证据状态：** Finding—pin 已有 `idsFixed/complexityFixed/edgesRewritten/`
  `danglingEdgesDropped` 计数与 `missing-*` reason；Unknown—重复节点保留最后一项
  是否符合产品权威、边 type 是否应参与更多唯一性维度。
- **验证思路：** 追加 numeric `0/11`、别名、重复节点在边重写后相撞、source/target
  各缺失及双缺失样例；对输入深拷贝前后做相等断言。

### A07 — 调用解析在别名、多匹配和 Go 导出名场景下宁可 Unknown `[cross-file] [test-impact]`

- **任务意图：** 保持 same-file、imported-package、exact 三种置信度语义；当导入
  别名或多个候选无法唯一确定时，输出 `unresolved` 而不是制造错误调用边。
- **Pin 锚点：** `packages/core/src/analyzer/call-resolver.ts:30-104`
  `splitSelector`、`resolveCalls`；`packages/core/src/analyzer/graph-builder.ts:192-213`
  `addCallEdge`；测试 `packages/core/src/analyzer/call-resolver.test.ts:28-65`、
  `packages/core/src/analyzer/graph-builder.test.ts:164-196`。
- **允许修改：** call-resolver、GraphBuilder 的调用边接线与测试；可以增加
  path/packageName fixture。**禁止：**
  以函数名全局猜测非导出 TypeScript 调用、改变 `ResolvedCall` 公共置信度枚举、
  读取真实仓库文件。
- **预期阅读路径/候选结果：** caller file/imports/functions/callGraph → selector
  分解 → 唯一 imported/project match 或 unresolved；候选影响只应体现为 calls 与
  unresolved 数量，不改节点内容。
- **证据状态：** Finding—pin 的 qualifier 以 `specifiers` 或 packageName 匹配，
  多候选会 unresolved；Unknown—命名空间导入、默认导入和重导出应否视为 exact。
- **验证思路：** 构造同名函数的两个 imported targets、命名空间别名、唯一大写 Go
  函数和小写函数；断言只有唯一匹配才产生边，并执行 call-resolver 测试。

### A08 — GraphBuilder 对重复节点、非代码定义和语言元数据保持稳定 `[cross-file] [test-impact]`

- **任务意图：** 构建文件/函数/类及非代码子节点时，保证 ID 唯一、contains/imports/
  calls 边不重复，未知 definition kind 有明确降级而不丢失文件节点。
- **Pin 锚点：** `packages/core/src/analyzer/graph-builder.ts:60-337`
  `GraphBuilder.addFile`、`addFileWithAnalysis`、`addNonCodeFileWithAnalysis`、
  `addChildNode`、`mapKindToNodeType`、`build`；`packages/core/src/languages/language-registry.ts:9-59`
  `LanguageRegistry.getForFile`；测试
  `packages/core/src/analyzer/graph-builder.test.ts:5-420`；节点类型
  `packages/core/src/types.ts:1-57`。
- **允许修改：** graph-builder、language-registry/config（若必要）及 GraphBuilder/registry 测试。**禁止：**
  增加未冻结 NodeType、用随机 ID、改变 `build()` 的排序/元数据契约而不记录。
- **预期阅读路径/候选结果：** language registry → file node → child nodes/edges →
  project metadata；候选图应可被 schema 校验，duplicate 警告可定位到原 ID。
  影响多语言扫描和非代码文件导航。
- **证据状态：** Finding—pin 用 `nodeIds`/`edgeKeys` 去重并把未知 kind 降为 concept；
  Unknown—重复 `addFile` 是否应更新旧节点还是保持首写，需 Product/QA 决定。
- **验证思路：** 混合 TS/JSON/未知 kind，重复同一 child 与 call/import edge；断言
  节点/边数量、语言集合和警告内容稳定。

### A09 — Tree-sitter 初始化失败时保持可预期的降级 `[cross-file] [test-impact] [unknown]`

- **任务意图：** 配置驱动 grammar、TSX 特殊 grammar 和缺失 WASM 时，插件应明确处于
  已初始化/可降级状态；同步 `analyzeFile`/`extractCallGraph` 不得在未 init 时静默
  使用半成品 parser，且上层指纹构建不能把“grammar 缺失的空分析”误标成完整结构。
- **Pin 锚点：** `packages/core/src/plugins/tree-sitter-plugin.ts:31-299`
  `TreeSitterPlugin.constructor`、`init`、`languageKeyFromPath`、`getParser`、
  `analyzeFile`、`extractCallGraph`；测试
  `packages/core/src/plugins/tree-sitter-plugin.test.ts:4-307`；语言注册/配置
  `packages/core/src/languages/language-registry.ts:9-59`、
  `packages/core/src/languages/types.ts` 与
  `packages/core/src/languages/configs/index.ts`；上层
  `packages/core/src/fingerprint.ts:253-296` `buildFingerprintStore`。
- **允许修改：** plugin、fingerprint 的可用性接线、相关 language config 和 tree-sitter/fingerprint 测试；可使用假的
  extractor/grammar load rejection。**禁止：** 提高 Node 最低版本、下载未锁定依赖、
  把 grammar 缺失伪装成成功结构分析。
- **预期阅读路径/候选结果：** config → extension map → async init → parser/extractor
  → StructuralAnalysis；候选输出在 grammar 不可用时应为空且 `hasStructuralAnalysis`
  由上层保守处理。影响所有支持语言和 CI 环境。
- **证据状态：** Finding—pin 对 config grammar load 使用 catch 并返回空分析，
  但 `buildFingerprintStore` 看到非 null analysis 后会写入
  `hasStructuralAnalysis: true`，存在“不可分析却被当成已分析”的跨文件边界；
  Unknown—grammar 缺失应返回空结果还是显式诊断、TSX 回退 TS 是否可接受。
- **验证思路：** 覆盖 `.tsx`、大小写扩展名、未初始化调用、config grammar load
  rejection；确保 parser/tree 被释放，执行 tree-sitter 定向测试。

### A10 — 文件名优先于扩展名的语言注册规则 `[test-impact]`

- **任务意图：** `Dockerfile`、`Makefile`、`docker-compose.yml` 和 `.env.*` 等特殊文件
  应命中 filename config；普通扩展名、大小写和未知文件路径行为保持清楚。
- **Pin 锚点：** `packages/core/src/languages/language-registry.ts:9-64`
  `LanguageRegistry.register/getByExtension/getForFile/createDefault`；配置类型
  `packages/core/src/languages/types.ts`；测试
  `packages/core/src/__tests__/language-registry.test.ts:7-190`。
- **允许修改：** language-registry、configs 和测试。**禁止：** 删除内建语言、把
  filename 规则降级到扩展名后、改变 `LanguageConfigSchema` 约束而无迁移说明。
- **预期阅读路径/候选结果：** register config → lower-case filename lookup →
  extension fallback；候选结果是单一 `LanguageConfig|null`，供 plugin/GraphBuilder
  共享。影响非代码结构分析入口。
- **证据状态：** Finding—pin 明确 filename lookup 在 extension 前；Unknown—同一文件名
  与扩展名冲突时是否需要警告，以及复合 `.env.local` 的优先级。
- **验证思路：** 为注册表加入 filename/extension 冲突和大小写 fixture，断言内外部
  数组不被调用方突变。

### A11 — FrameworkRegistry 的 manifest 路径与重复检测 `[cross-file] [test-impact]`

- **任务意图：** 从根目录或嵌套路径 manifest 识别框架，匹配大小写不敏感关键词，
  同一框架只返回一次且 `getForLanguage` 不泄露内部数组。
- **Pin 锚点：** `packages/core/src/languages/framework-registry.ts:9-86`
  `FrameworkRegistry.register/detectFrameworks`；内建配置
  `packages/core/src/languages/frameworks/index.ts`；测试
  `packages/core/src/__tests__/framework-registry.test.ts:6-118`。
- **允许修改：** framework-registry、内建 framework config 和测试。**禁止：** 以
  manifest 文件名之外的目录猜测框架、改变 `FrameworkConfigSchema` 或返回未注册对象。
- **预期阅读路径/候选结果：** manifest key basename match → keyword scan → detected
  set → ordered FrameworkConfig[]；候选影响 project metadata 的 frameworks 列表。
- **证据状态：** Finding—pin 用 `key === manifestFile || key.endsWith('/'+manifestFile)`
  并以 `detected` 去重；Unknown—软链接/Windows `\\` 路径和无版本关键词的容错。
- **验证思路：** 使用 `src/package.json`、大小写混合内容、两个 manifest 命中同框架、
  空 manifest；断言顺序和重复注册行为。

### A12 — LLM 文件/项目响应解析只接受可审计结构 `[test-impact] [unknown]`

- **任务意图：** 让 prompt 与 parser 对 markdown fence、前后解释文本、缺字段、非法
  complexity 和错误 JSON 的处理一致；无效内容安全返回 `null` 而不伪造摘要。
- **Pin 锚点：** `packages/core/src/analyzer/llm-analyzer.ts:24-202`
  `buildFileAnalysisPrompt`、`buildProjectSummaryPrompt`、`extractJson`、
  `parseFileAnalysisResponse`、`parseProjectSummaryResponse`；测试
  `packages/core/src/analyzer/llm-analyzer.test.ts:9-285`。
- **允许修改：** llm-analyzer 与纯字符串测试。**禁止：** 在本任务接入真实模型、
  改写用户源码、把非法复杂度当作模型事实写入图谱。
- **预期阅读路径/候选结果：** prompt output-language directive → JSON extraction →
  shape/complexity normalization；候选产物为 `LLMFileAnalysis|null` 或
  `LLMProjectSummary|null`，供 GraphBuilder 读取。
- **证据状态：** Finding—pin 已支持 fence/raw object 并对未知 complexity 默认
  `moderate`；Unknown—前后多个 JSON 对象时取第一个还是最后一个、数组字段的去重
  与长度边界尚未定义。
- **验证思路：** 追加多个 fence、前后噪声、`null`/数组/超长字段和未知 complexity
  样例；确保 parser 不抛异常，执行 llm-analyzer 定向测试。

### A13 — 启发式/LLM Layer 分配保持路径与“Other”语义 `[cross-file] [test-impact]`

- **任务意图：** 统一 Unix/Windows 分隔符、复数目录匹配、LLM pattern 前缀匹配和
  未分配文件的 `Core/Other` 行为；仅 file 节点进入 layer，函数/类不误归类。
- **Pin 锚点：** `packages/core/src/analyzer/layer-detector.ts:128-355`
  `matchFileToLayer`、`detectLayers`、`parseLayerDetectionResponse`、`applyLLMLayers`；
  `packages/core/src/analyzer/tour-generator.ts:187-330` `generateHeuristicTour` 的
  layer grouping；测试 `packages/core/src/__tests__/layer-detector.test.ts:36-241`、
  `packages/core/src/__tests__/tour-generator.test.ts:168-300`；图类型
  `packages/core/src/types.ts:57-80`。
- **允许修改：** layer-detector、tour-generator 的 layer 接线与测试。**禁止：** 增加未审阅的 layer pattern、
  改变中文文案作为结构身份、把 LLM 返回的任意 node ID 直接写入图谱。
- **预期阅读路径/候选结果：** filePath → heuristic/LLM pattern → layer map →
  stable `layer:<slug>`；候选影响 tour 分组和架构阅读入口。
- **证据状态：** Finding—pin 的启发式匹配“first match wins”，LLM 未分配节点进入
  `Other`；Unknown—重叠 pattern 的产品优先级、空 layer 是否需保留。
- **验证思路：** 覆盖 `src/routes`、`src/route`、Windows `src\\routes`、重叠 pattern、
  无 filePath 节点和空 LLM layer，断言每个 file 至多归属一个 layer。

### A14 — 启发式 Tour 在环、孤立节点和多语言下可复现 `[test-impact] [unknown]`

- **任务意图：** `generateHeuristicTour` 在 DAG、环、无边图和有/无 layers 情况下覆盖
  所有 code/concept 节点，顺序和 `order` 稳定；解析 LLM tour 时过滤非法步骤而不
  抛异常。
- **Pin 锚点：** `packages/core/src/analyzer/tour-generator.ts:52-366`
  `parseTourGenerationResponse`、`generateHeuristicTour`；测试
  `packages/core/src/__tests__/tour-generator.test.ts:39-300`。
- **允许修改：** tour-generator 与测试。**禁止：** 靠随机打散节点、丢弃环中节点、
  改变既有中文 fallback 的语义；不调用模型或网络。
- **预期阅读路径/候选结果：** graph nodes/edges/layers → Kahn queue → topo order →
  layer/no-layer batching → concept final step → sequential order；候选是完整、可读、
  可重放的 `TourStep[]`。
- **证据状态：** Finding—pin 对未达 topo 的节点追加到末尾，并把 concept 单独成步；
  Unknown—同一入度节点的 tie-break 是否应按 ID 排序、环是否应单独标注。
- **验证思路：** 构造两个入度相同节点、三节点环、孤立 concept、非法 JSON steps，
  连续运行两次比较 JSON 字节，覆盖 zh-CN 与默认语言。

### A15 — Wiki V2 产物构建保持证据、覆盖率和排序一致 `[cross-file] [test-impact]`

- **任务意图：** 文档、evidence、node documentation、search index 和 generation
  report 必须来自同一输入边界；冲突证据失败关闭，函数/类引用覆盖不能被“看似有页”
  的结果绕过。
- **Pin 锚点：** `packages/core/src/knowledge-base/artifacts.ts:103-205,209-486,656-706`
  `resolveEvidence`、`registerEvidence`、`buildDocuments`、`validateInputReferences`、
  `buildReferenceCoverage`、`buildKnowledgeArtifacts`；类型
  `packages/core/src/knowledge-base/types.ts:1-120` 与
  `packages/core/src/knowledge-base/wiki-contract.ts:211-356,685-752`
  `WikiPageV2Schema/validateWikiIndexInvariants`；测试
  `packages/core/src/knowledge-base/__tests__/artifacts.test.ts:42-474`。
- **允许修改：** artifacts、wiki-contract（仅必要契约/不变量同步）及 artifacts/contract 测试。
  **禁止：** 将 pending/zero-source 变成 verified、放宽来源路径/行号校验、复制绝对
  路径或源码全文到索引。
- **预期阅读路径/候选结果：** GeneratedDocument + SourceEvidence → resolved evidence
  IDs → pages/traces → coverage/readiness → search/report；候选产物四件套应稳定按 ID
  排序且互相可追溯。影响 Dashboard/Wiki 读取和发布门。
- **证据状态：** Finding—pin 已有 evidence dedup、route readiness、reference coverage
  和 stable sort；Unknown—同一行范围但 claim 不同是否应共享 evidence ID、重复页面
  如何选主页面。
- **验证思路：** 复用现有 valid fixture，分别注入外部 node、冲突 excerpt、空 anchor、
  缺 route stage；运行 artifacts 定向测试并比较所有顶层集合排序。

### A16 — Artifact 验证拒绝路径穿越、元数据漂移和 Markdown 伪占位 `[cross-file] [test-impact] [unknown]`

- **任务意图：** 验证器应同时核对四份 JSON 的时间/语言/模式/commit/graph digest、
  节点映射和 Markdown 安全路径；代码围栏中的 TODO 不应被误判为发布占位，正文中的
  泛化占位必须失败或 needs-review。
- **Pin 锚点：** `packages/core/src/knowledge-base/artifact-verifier.ts:48-285`
  `safeMarkdownPath`、`verifyMetadata`、`verifyMappings`、`verifyMarkdown`、
  `validateKnowledgeArtifactSetV2`；其 `maskMarkdownCode` 依赖
  `packages/core/src/knowledge-base/publication-quality.ts:103-187`；测试
  `packages/core/src/knowledge-base/__tests__/artifact-verifier.test.ts:73-120`。
- **允许修改：** 两个验证/质量文件及测试。**禁止：** 接受 `../`、绝对路径、NUL、
  不同 commit 的产物，或把 verifier 变成签名/来源认证器。
- **预期阅读路径/候选结果：** artifact set → metadata/mapping/markdown checks →
  `{ok:true,errors:[]}` 或完整错误集合；候选影响正式知识库是否可发布。
- **证据状态：** Finding—pin 已拒绝空段、`.`、`..` 和 NUL markdown path，并检查
  source counts；Unknown—错误顺序是否对外稳定、needs-review 是否允许进入 Alpha。
- **验证思路：** 对同一完整 fixture 分别改 commit、generatedAt、路径分隔符、`../`
  和围栏内外 TODO；断言仅符合约定的集合通过，执行 artifact-verifier 测试。

### A17 — Writer merge 严格执行任务归属、来源证据和批次重试 `[cross-file] [test-impact] [unplanned]`

- **任务意图：** 文件/主题 writer 输出必须归属于计划任务和正确 graph node，重复文档
  或 document path 失败并进入 retry；来源 excerpt 与 snapshot 不一致不能以“结构
  有效”替代。
- **Pin 锚点：** `packages/core/src/knowledge-base/merge.ts:49-325,481-629`
  `stableSymbolAnchors`、`validateFileTaskOwnership`、`validateFileWriterIdentity`、
  `validateEvidenceAgainstSource`、`validateTopicWriterOutputs`、
  `mergeKnowledgeBaseWriterOutputs`；测试
  `packages/core/src/knowledge-base/__tests__/merge.test.ts:269-830` 和
  `packages/core/src/knowledge-base/__tests__/writer-contracts.test.ts`。
- **允许修改：** merge、writer-contracts（若接口校验必须同步）和测试。**禁止：**
  接受未知 node/path、删除 retry 记录、把失败文档放入 accepted，或把范围外文件
  当作计划任务（`[unplanned]` 只用于负向测试）。
- **预期阅读路径/候选结果：** plan/profile → candidate grouping → ownership/evidence/
  publication checks → accepted docs + retry plan；候选影响知识库生成可恢复性和
  writer 审计。
- **证据状态：** Finding—pin 已对重复 file/topic node/path、缺 source task、缺 symbol
  anchor 和 quality failure 生成 retry；Unknown—同批次同文档的优先级、retry 次数由
  谁负责持久化。
- **验证思路：** 在现有完整 writer fixture 中加入两个 batch 返回同一路径，并混入
  `docs/unplanned.md` evidence；断言 rejected/needs_retry 明确、accepted 列表不含
  越界文档，运行 merge 定向测试。

### A18 — Publication quality 阈值、证据组和中文代码遮罩可解释 `[cross-file] [test-impact] [unknown]`

- **任务意图：** 不同文档 role/category 使用正确的必需章节、汉字最小量、证据数量、
  行锚点和行为边阈值；Markdown fenced/inline code 遮罩不能污染正文质量判断。
- **Pin 锚点：** `packages/core/src/knowledge-base/publication-quality.ts:43-93,103-391`
  `REQUIRED_SECTIONS`、`maskMarkdownCode`、`requiredSectionsForDocument`、
  `isValidPublicationEvidence`、`evaluatePublication`、`evaluatePublicationCorpus`；
  测试 `packages/core/src/knowledge-base/__tests__/publication-quality.test.ts:109-438`。
- **允许修改：** publication-quality 与测试；如需同步调用方，只改
  `packages/core/src/knowledge-base/merge.ts:65-92` 的传参，不改知识契约字段。
  **禁止：** 通过降低阈值让失败文档变 verified、把代码注释当中文正文、删除
  `needs-review` 状态。
- **预期阅读路径/候选结果：** PublicationDocument/Evidence → masked prose/headings/
  anchors/edge counts → `PublicationDecision`；候选影响 merge accepted/retry 和最终
  Wiki 发布质量。
- **证据状态：** Finding—pin 已定义 featured/reference 汉字下限、category evidence
  minimum、行为 edge 集合及 repeated-line corpus 检查；Unknown—业务方是否允许短
  reference、繁体中文策略及 evidence group 去重规则。
- **验证思路：** 复用现有中文 file/topic/flow fixture，分别缺章节、缺直接 evidence、
  增加代码围栏 TODO、加入繁体正文和重复模板行；断言 quality/issue 列表稳定，运行
  publication-quality 与 merge 相关测试。

## 复核门槛与下一步

1. Product/QA 先确认每项“意图”和 Unknown，删掉不属于 ALPHA-A 的项目；确认候选
   任务不会触及 ALPHA-B 私有源、登录、签名或 Provider 写入。
2. 对保留项目补齐真正的任务定义（目标文件/符号、变更约束、预期 Finding/Unknown、
   可执行测试），再由两位真人复核并生成版本化 manifest；在此之前不能把本文件或
   任意 `taskDefinitionDigest` 当作 Gold 定义。
3. 只有定义版本化、ALPHA-A 任务实际在干净隔离 worktree 执行并取得真实
   `repo_pulse → task_brief → change_check → verification` 证据后，才可讨论 G2；
   双 Host 的 24 项、ALPHA-B owner 授权、Provider receipt binding 和签名 Release
   仍是另外的门槛。
