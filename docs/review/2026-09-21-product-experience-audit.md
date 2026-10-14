# Understand Code 产品体验审查

日期：2026-09-21。基线：`2bb8dff` 加当前工作区已有修改。此次只增加本报告，不修改产品代码或已有知识产物。

判断：项目已经具备任务持久化、结论追证、图谱、Wiki 和版本校验等基础，但用户完成“开始分析 → 得到可信解释 → 核验/纠错 → 留下可复用知识 → 日后回来继续”的过程仍有明显断点。优先补齐使用闭环、可信度和恢复能力，再扩展功能。

**审查范围与证据边界**

- 扫描 README、安装说明、CLI/MCP、索引与调用解析、工作台主入口、任务页、Wiki、证据加载和已有验收记录；三个独立审查方向交叉核实。
- 用当前 Dashboard 源码运行本地页面，检查本仓库旧产物的过期状态、图谱、任务首页；另用仓库自带示例 Wiki 检查阅读首页和正文。示例只用于观察交互，不能代表最新真实业务知识的质量。
- 浏览器复现：任务首页第一次点击搜索只切换到 Wiki，第二次才能打开搜索。有效 Wiki 和旧格式 Wiki 两种情况下均观察到此行为。
- 只读最小实验：Python 同文件 `main → helper` 无解析调用边，同等 TypeScript 样例有一条调用边。
- 定向运行现有测试：两个测试通过，覆盖 pending 候选容量耗尽及 symlink 拒绝；32 个无关测试跳过。通过表示确认当前行为，不表示这些产品问题已修复。
- 没有重跑全量测试、重新测量大型仓库性能、安装用户全局插件，或完成真实 Codex/Claude 跨宿主闭环。历史性能数据明确注明日期。
- 9 月 20 日已有 Markdown、源码链接、Mermaid 与排版修复，本报告不重复把已修复问题当作当前缺陷。

P1 表示会阻断核心流程或损害结果可信度；P2 表示显著增加操作成本、恢复成本或长期使用成本。下述“产品缺口”不等同于程序崩溃。

## 1. P1：普通仓库可能因已排除文件而无法开始分析

文件扫描在应用 `.understandignore` 之前拒绝 symlink 和敏感路径。根目录即使有明确忽略的 `.env`，也会使整次初始化/刷新失败。拒绝读取敏感内容和跟随链接是合理边界，问题是没有安全跳过已排除文件的正常使用路径。

**用户影响：**用户需要迁就工具整理仓库，而不是直接分析日常开发中的仓库；错误又可能表现为通用内部错误。

**证据：**[repository-indexer.ts:607](../../packages/cli/src/runtime/repository-indexer.ts#L607)；[现有敏感路径测试:140](../../packages/cli/test/repository-indexer-security.test.ts#L140)。代码确证；本次实际运行了 symlink 拒绝测试。

**改进与验收：**在不读取被排除内容、不跟随链接的前提下支持跳过；带 `.env`、已忽略 symlink 的普通仓库可以完成分析，并能看到排除清单。

## 2. P1：候选/历史 Wiki 的证据请求没有绑定相同版本

正文和索引通过版本 fetcher 附带 `indexVersion/indexGenerationId`，源码片段 loader 却使用默认 `fetch` 请求普通路径。

**用户影响：**用户审阅某个候选或历史版本时，侧栏可能拿到默认版本的片段或缺失片段，削弱“每条结论可核验”的核心承诺。实际是否混用取决于具体产物；目前确证的是请求未携带版本。

**证据：**[ExcerptContext.tsx:18](../../packages/dashboard/src/wiki/ExcerptContext.tsx#L18)、[excerptLoader.ts:25](../../packages/dashboard/src/wiki/excerptLoader.ts#L25)；版本机制对照 [publishedKnowledge.ts:53](../../packages/dashboard/src/workbench/publishedKnowledge.ts#L53)。未做端到端跨版本混用复现。

**改进与验收：**证据继承相同版本 fetcher，缓存按 generation 隔离；构造内容不同的 A/B 版本，查看 A 的正文、索引、片段必须全部来自 A。

## 3. P1：首次大仓分析长时间等待，取消没有真正接通

首次 `build_task_brief` 在同一调用同步完成全仓索引。MCP 消息串行处理，当前没有取消通知分支，长任务执行期间其他消息也排队；刷新结果却声明支持 MCP 取消。

**用户影响：**用户难以判断是否仍在工作，取消不能协作式停止；默认宿主超时能否覆盖首次索引也缺少完整验证。

**证据：**[tools.ts:856](../../packages/cli/src/handlers/tools.ts#L856)、[server.ts:346](../../packages/cli/src/mcp/server.ts#L346)、[串行队列:430](../../packages/cli/src/mcp/server.ts#L430)、[取消声明:103](../../packages/cli/src/handlers/local-knowledge-refresh.ts#L103)。执行结构确证，宿主实际超时概率未测。

**改进与验收：**先返回可追踪任务，持续报告扫描/解析/生成阶段，提供真实取消和恢复；慢任务期间状态查询应有响应，取消后保留上一份有效产物。

## 4. P1：MCP 分析到正式 Wiki 的交付流程不完整

正式发布要求真实 writer 输出；实现只从 `.understand-code/knowledge-drafts/<taskId>` 导入已有草稿。缺目录时沿用诊断产物，发布阶段又会拒绝诊断产物。Preview 不包含源码 skills，公开 MCP 工具和快速开始也没有完整说明如何生成、提交该任务的 writer 草稿。

**用户影响：**用户可以完成分析，却可能无法沿着公开使用说明获得正式业务知识库。宿主有能力自行写文件，不等于产品已经提供了可发现、可重复的交付流程。

**证据：**[草稿导入:2109](../../packages/cli/src/runtime/repository-indexer.ts#L2109)、[正式发布门禁:2178](../../packages/cli/src/runtime/repository-indexer.ts#L2178)、[入口区别:7](../../README.zh-CN.md?plain=1#L7)。代码确证，用户受阻程度属于体验判断。

**改进与验收：**明确接通宿主写作、来源绑定、草稿提交、审核、发布；新用户只靠公开安装和使用说明，能生成一份有业务解释和源码依据的正式 Wiki。

## 5. P1：候选知识累计 32 份后缺少继续使用的路径

同一仓库共享 32 份 pending 容量，第 33 份不同候选被拒绝；中断遗留目录也占容量。发布流程没有清掉原 pending，未发现公开的删除、归档或清理入口。

**用户影响：**持续使用最终耗尽容量，后续 stage 无法继续；用户不应依赖手工删除内部受校验文件恢复。

**证据：**[容量限制:1936](../../packages/cli/src/runtime/repository-indexer.ts#L1936)、[中断目录:1915](../../packages/cli/src/runtime/repository-indexer.ts#L1915)、[发布流程:64](../../packages/cli/src/handlers/local-knowledge-refresh.ts#L64)。[32 份容量测试:271](../../packages/cli/test/pending-knowledge-index.test.ts#L271)已在本次运行通过，确认当前拒绝行为。

**改进与验收：**提供候选废弃/归档和清晰保留策略；超过 32 次正常审核发布仍可继续，未审草稿不会被静默删除。

## 6. P1：多语言与常见项目结构的关系分析覆盖不足

Python、Java、Rust 等 extractor 未输出解析器需要的 binding，连部分最基础的同文件直接调用也会变成 unresolved。TypeScript import resolver 只处理相对路径，不处理 `@/` 别名与 workspace 包引用。

**用户影响：**有函数节点不代表调用关系完整；用户可能把缺边误认为没有依赖，影响阅读路线和变更影响判断。

**证据：**[Python extractor:168](../../packages/core/src/plugins/extractors/python-extractor.ts#L168)、[call-resolver.ts:121](../../packages/core/src/analyzer/call-resolver.ts#L121)、[TS import 解析:89](../../packages/cli/src/runtime/repository-imports.ts#L89)。Python 与 TypeScript 对照最小实验已完成；其他语言为代码审查结论。

**改进与验收：**先公开每种语言的实际能力矩阵，再补常见静态绑定、tsconfig paths 与 workspace 解析；缺边必须明确区分外部依赖、动态行为和当前未支持的静态关系。

## 7. P2：MCP 符号搜索接受请求却永远没有符号结果

`search_context` 接受 `scopes: ["symbol"]`，但候选只构造 wiki、file、graph，并严格按 kind 过滤。

**用户影响：**宿主按函数/符号缩小搜索时收到成功的空结果，可能误以为仓库没有相关内容。这与浏览器 Wiki 的函数搜索是两条不同路径。

**证据：**[输入契约:953](../../packages/contracts/src/mcp.ts#L953)、[搜索过滤与候选构造:526](../../packages/cli/src/handlers/tools.ts#L526)。代码确证。

**改进与验收：**生成真实 symbol 候选，或暂时移除该 scope 并明确不支持；已知函数按符号范围检索应返回正确文件和证据。

## 8. P2：安装与第一次创建任务的认知成本偏高

推荐路线要求用户先获得本地 `.tgz`、查全局 npm 路径、注册宿主 marketplace，再理解技能版/MCP 版及四类就绪状态。主文档没有把包获取入口接到安装第一步。任务首页又要求复制带占位符的只读模板，到宿主修改并发送。

**用户影响：**用户在看到分析价值前，先承担了发行和集成工作；失败后很难判断该配置、重启还是重发。

**证据：**[安装命令:151](../../README.zh-CN.md?plain=1#L151)、[手工包路径:174](../../README.zh-CN.md?plain=1#L174)、[任务首页:21](../../packages/dashboard/src/components/taskFirst/TaskHome.tsx#L21)。安装说明与 UI 确证；未核查远端另有无发行渠道。

**改进与验收：**主路径收敛为选择宿主、获取对应版本、一条安装指令、实际分析；在页面输入真实需求并生成完整宿主指令，清楚显示等待任务回流的状态。

## 9. P2：任务、搜索与 Wiki 之间的导航会丢失用户意图

任务页搜索只切换 Wiki、未打开弹窗；快捷键监听也不在任务主视图。任务上下文内选择带 anchor 的 Wiki 目标时，路由只保留 pageId，后续同步又清掉 anchor。

**用户影响：**搜索要多点一次；期望直达某个函数/章节却落到整篇文章，后退、刷新无法精确还原。

**证据：**[搜索入口:752](../../packages/dashboard/src/App.tsx#L752)、[丢失 anchor:767](../../packages/dashboard/src/App.tsx#L767)、[位置同步:1197](../../packages/dashboard/src/App.tsx#L1197)。搜索二次点击已用当前源码在浏览器复现；anchor 为代码确证，未做浏览器完整任务上下文复现。

**改进与验收：**统一各视图的搜索命令，路由保留完整文档和章节；任务页一次点击或快捷键即可搜索，结果、后退和刷新均保持精确位置。

## 10. P2：失败后缺少足够信息和可用的恢复动作

搜索失败结果和证据分片失败 Promise 被缓存，关闭再开不会重试；片段失败最终可能显示成“未提供”。后端未映射异常被压成 `internal_error`，没有关联真实异常的 errorId 日志。旧版 Wiki 状态只提示重新生成，按钮却仅重新读取，不提供迁移步骤。

**用户影响：**短暂失败变成持续降级，用户分不清内容缺失、权限失效和服务异常；容易反复刷新或重装。

**证据：**[wikiArtifacts.ts:144](../../packages/dashboard/src/wiki/wikiArtifacts.ts)、[excerptLoader.ts:54](../../packages/dashboard/src/wiki/excerptLoader.ts#L54)、[server.ts:335](../../packages/cli/src/mcp/server.ts#L335)、[旧产物提示:109](../../packages/dashboard/src/App.tsx#L109)。代码确证；旧产物提示已浏览器观察。

**改进与验收：**缓存成功结果、提供局部重试；错误带脱敏类别、阶段和下一步，errorId 可关联诊断；服务恢复后无需整页刷新即可恢复搜索/证据。

## 11. P2：给了阅读建议，但没有把用户直接带到代码

任务中的 reading_path 和 planned_change 最终渲染普通文字，没有直接打开源码或定位图谱的入口。

**用户影响：**知道“应该看哪里”之后，仍要复制文件/符号、转搜索再找一遍，理解路径中断。

**证据：**[条目数据:230](../../packages/dashboard/src/components/taskFirst/TaskFirstWorkbench.tsx#L230)、[纯文本渲染:310](../../packages/dashboard/src/components/taskFirst/TaskFirstWorkbench.tsx#L310)。代码确证的产品缺口。

**改进与验收：**每条建议可查看源码、相关解释或图谱，并能返回原任务和条目。

## 12. P2：审阅结果后，意见回传缺少上下文

主张卡主要提供查看证据；候选页要求回宿主显式确认发布，但缺少自动携带 taskId、claimId、generationId 的反馈、请求补证或继续处理入口。

**用户影响：**用户发现结论错误，仍需自己描述位置并复制标识，执行者容易丢失上下文。保留只读工作台边界不妨碍提供完整反馈指令。

**证据：**[ClaimCard:268](../../packages/dashboard/src/components/taskFirst/TaskFirstWorkbench.tsx#L268)、[候选审阅:91](../../packages/dashboard/src/components/taskFirst/KnowledgeCandidateReview.tsx#L91)。产品缺口。

**改进与验收：**提供带准确定位的“反馈此结论/补充证据/继续处理”指令；宿主收到后能对应到同一任务和版本。

## 13. P2：长期积累后的查找和回看成本高

任务历史没有关键词搜索、状态筛选或分页/归档入口；一次轮询失败会覆盖旧成功数据、让原列表消失。Task 虽然持久化，Workbench 阅读服务仍依赖 MCP 进程；关闭宿主后，日后回看通常要重启正确服务并获取新入口。

**用户影响：**越用越难找到旧结论，收藏链接也不能提供稳定回看体验。一次性链接本身不是缺陷，缺口是稳定的任务发现和重新打开流程。

**证据：**[TaskHome.tsx:25](../../packages/dashboard/src/components/taskFirst/TaskHome.tsx#L25)、[任务列表:61](../../packages/dashboard/src/components/taskFirst/TaskHome.tsx#L61)、[生命周期说明:23](../../README.md?plain=1#L23)、[服务关闭:472](../../packages/cli/src/mcp/server.ts#L472)。代码和设计限制确证。

**改进与验收：**先提供任务搜索/筛选、失败时保留最近成功列表，以及稳定本地入口或按需启动阅读服务；关闭宿主后能方便地重新找到指定旧任务。

## 14. P2：首页的理解路线没有反映实际内容完整度

首页始终展示“项目做什么 → 怎样流转 → 有哪些规则 → 代码怎样实现 → 怎样核验源码”五个阶段，不根据实际 routePages 标注缺失。仓库自带示例中推荐内容只有三个“代码怎样实现”的模块页，仍展示完整五阶段叙述。

**用户影响：**界面提供了完整理解路线的预期，却没有告诉用户哪些问题已经被回答、哪些尚未完成。示例正文还有较长的原始依赖清单，容易让“有资料”被误当成“解释清楚”。后者仅为示例内容观察，不推广为所有正式 Wiki 的结论。

**证据：**[GuidedWikiHome.tsx:50](../../packages/dashboard/src/components/wiki/GuidedWikiHome.tsx#L50)。固定阶段代码确证，示例界面已观察。

**改进与验收：**阶段显示可阅读内容、缺口和下一步；首先提供少量有结论的核心问题入口，关系明细下沉。只有 implementation 内容时，首页应明确其余阶段待补充。

## 15. P2：大仓库阅读和搜索的性能仍缺少令人满意的证据

2026-09-10 验收记录中，首次 Wiki 加载 24.242 秒，完整搜索索引加载 18.102 秒，Wiki 和搜索响应分别约 206 MB、304 MB。当前搜索仍先加载完整索引，证据分片优化不能直接证明完整搜索已足够轻量。

**用户影响：**用户可能在分析完成后，打开报告和开始搜索时再次等待；“请求成功”不能作为可用速度的验收标准。

**证据：**[历史实测:65](../testing/2026-09-10-audit-remediation.md)、[搜索加载:144](../../packages/dashboard/src/wiki/wikiArtifacts.ts)。时间和体积为历史数据，本次未重新测量，不能直接当作当前性能。

**改进与验收：**在固定大小真实仓库上重新测首屏、首次搜索、峰值内存，设定明确预算；考虑按需加载、分片检索或服务端搜索。先提供可阅读内容，再补齐重数据。

## 16. P2：真实用户闭环的验收证据仍不充分

现有记录明确未完成完整 Gold 任务集，Claude 自然语言接续受登录阻断，Desktop/IDE 及默认插件冷启动未完整验收。单元测试与直接协议调用不能证明用户按推荐安装路径即可完成业务任务。

**用户影响：**实现可能在局部都成立，但真实用户仍在宿主连接、超时、接续或最后发布时遇阻。

**证据：**[验收记录:59](../testing/2026-09-10-audit-remediation.md)、[发行验收限制:90](../testing/2026-09-10-audit-remediation.md)。这是已有证据的不足，不断言后续外部绝无验证。

**改进与验收：**优先固定三类真实任务：解释陌生模块、定位问题、完成小改动并验证。逐一验证推荐安装入口、实际宿主、重启接续和正式知识交付，并记录成功率、完成时间和人工干预次数。

## 建议落地顺序

1. **先保证能用且可信：**处理 #1、#2、#3、#5、#7；同步明确 #6 的实际支持边界。
2. **完成一次有价值的交付：**接通 #4、#8，修复 #9，并打通 #11、#12。验收重点是用户能得到、核验、纠正一份解释。
3. **保证持续使用：**完善 #10、#13、#14；用 #15、#16 的真实场景数据检验改善效果。

建议把成功标准设为“新用户能独立完成一个真实任务，得到能核验的结论，并在之后方便地继续使用”，同时观察首次成功时间、需要人工干预的次数、证据打开成功率与纠错完成率。不要仅以页面数量、文档数量或单元测试数量衡量满意度。
