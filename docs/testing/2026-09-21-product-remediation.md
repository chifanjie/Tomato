# 产品体验问题修复记录

对应 [2026-09-21 产品审阅](../review/2026-09-21-product-experience-audit.md)。本次直接修改当前工作区，保留开始前已有改动；未提交 Git、发布版本或修改用户的全局 Host 安装。

## 问题与处理

状态针对原报告中的具体缺陷及下表说明的能力范围。2026-09-22 已补齐本轮三项交付：首次 MCP 后台索引、全文搜索 Worker 与真实浏览器抽样、Codex 的解释/修 bug/小改动完整闭环。各项边界如下；不把抽样通过扩展为所有 Host、全部仓库规模和所有性能指标均已验收。

| 原问题 | 状态 | 当前处理结果 | 边界与未完成项 |
|---|---|---|---|
| 1. 被忽略的敏感文件或链接阻断索引 | 已修复 | 先应用显式忽略规则，再检查敏感路径和链接；补回归 | 未排除的敏感文件仍拒绝，源码链接不跟随 |
| 2. 候选/历史 Wiki 证据串版本 | 已修复 | Excerpt loader 使用对应 KnowledgeFetchContext；失败请求释放缓存且可重试 | 证据绑定所选择的版本，不能跨 generation 复用 |
| 3. 长任务期间取消、ping 和进度无效 | 已修复 | 默认首次本地 MCP `build_task_brief` 缺索引时启动/复用独立后台作业，及时返回严格的 `waiting_for_index` 与 job ID；Host 可通过 `index_job` 查询/取消，完成后重放原请求幂等创建 Task；宿主退出后仍可恢复。ping、取消、作业控制保持响应 | pending 不是已创建 Task；已有索引的建任务、显式 `refresh_index` 保持同步。轮询必须等待并限制批次，终态不继续轮询或无限自动重试。阶段进度需 Host 提供 progressToken；原子提交开始后完成该提交，Provider 门槛不变 |
| 4. 正式知识写作入口断裂 | 已修复 | 安装包内置 knowledge 分阶段命令与文件/专题/主干指南；主干有真实 writer 输入，按计划校验身份、源码证据与质量；无推断架构层的小仓库也能关联真实源码 | Host 仍需实际写作，并经检查/验证后显式 stage/publish；诊断产物不能冒充正式知识，也未伪造 verification |
| 5. 候选容量不能释放 | 已修复 | 发布后归档且保留历史回放；可废弃指定候选、清理中断临时写入；升级时回收旧发布占用 | 完整草稿不自动淘汰；清理共用写入锁；历史归档仍占磁盘 |
| 6. 多语言与 TS 导入遗漏 | 已修复（限定静态范围） | TS/JS 支持部分 JSONC paths/baseUrl/相对 extends 与显式 workspace 依赖；Python/Rust 支持可证明的同文件顶层调用；Java 增加保守、唯一确定的常见静态绑定 | Java 虚分派、继承目标和歧义重载保留未解析；Python/Rust 方法及跨模块调用、其他未实现语言关系仍有明确限制，缺边不证明无影响 |
| 7. symbol 搜索无结果 | 已修复 | 从持久 Task 读取真实符号，绑定同快照源码证据并保留路径过滤 | 不用符号名称猜测调用边 |
| 8. 安装入口繁琐 | 已修复 | Preview 增加 `--install-host codex/claude`，执行官方注册及同版本 Doctor；补失败恢复；真实双 Host 在隔离配置完成安装与安装缓存 MCP 验收 | 包获取仍按实际 build/pack 渠道；不虚构公开下载地址；安装已验不等于已登录模型会话已验，见 #16 |
| 9. 搜索多点一次、Wiki 章节丢失 | 已修复 | 任务界面一次打开搜索，快捷键可用；章节锚点写入和恢复路由 | 有回归及上一轮真实浏览器操作记录；不据此推断大仓浏览器性能 |
| 10. 失败后难恢复 | 已修复 | 失败缓存可释放重试；保留最后成功列表；关联错误 ID 与脱敏步骤；新增 `recover --rebuild/--restore`、`knowledge --restart-draft`，阻止旧格式被静默重写，源码漂移后仍能查看 `--retry` | 恢复是显式离线操作；原资料完整归档，恢复本身可逆。合法 ArtifactStore 无 active index 仍可正常初始化；旧版本 Host/已有 reader 必须退出，未迁移用户当前真实仓库 |
| 11. 阅读路径不能跳转 | 已修复 | 阅读建议连接到源码证据、图谱、影响分析 | 只使用已有且可验证的目标 |
| 12. 缺少上下文反馈 | 已修复 | 知识结论和候选提供携带标识、来源上下文的 Host 反馈指令 | 用户复制回 Host，未引入隐式外发 |
| 13. 历史难找、依赖 Host 进程 | 已修复 | 任务搜索和状态筛选；轮询失败保留列表；独立 workbench 命令重开已有任务 | 浏览器需要新鉴权链接，并保持独立 reader 进程运行 |
| 14. 首页与真实覆盖不符 | 已修复 | 展示每个阅读阶段的实际文档数与待补充项 | 缺内容时明确提示，不把固定阶段图当作内容已齐全 |
| 15. 首搜和大响应慢 | 搜索阻塞已修复；浏览器抽样完成 | 97.7 MB 实际索引在 Worker 中解码、校验、准备和检索；只回传分页展示字段；可见浏览器核对全文结果、分页、正文和图谱下钻；Dashboard 737/737 通过 | 最终搜索阶段记录一次 54 ms 长任务，已消除基线连续大段解析；图谱首次初始化仍约 441 ms。页面 heap 不含 Worker/进程总内存，不能宣称整体内存预算或 INP 普遍达标；见[浏览器报告](2026-09-22-browser-performance.md) |
| 16. 产品验收证据不足 | Codex 三任务闭环完成 | 真实认证模型完成解释保存/重读，两个修改 Task 均 verified / revision 18；实际测试 5/5、6/6，独立复跑 6/6；跨模型会话重读与 Workbench API 200 | Claude 默认未认证，仍未做真实模型验收；小 fixture、有界静态分析及逐断言证据粒度的边界见[真实 Host 报告](2026-09-22-host-journey-acceptance.md)。本轮随后修复版本冲突误报并单独回归 |

## 本轮新增验证证据

各测试批次可能重叠，不相加作为独立测试总数。下方历史批次保留原记录；尚在运行的最终批次明确标记，不能提前计为通过。

| 验证范围 | 本轮结果 | 可支持的结论 |
|---|---|---|
| Core 全量 | 62 个文件、1,057 项全部通过 | 包括新增 Java 静态绑定与此前 writer、证据及规划回归；不表示所有语言调用关系均完整 |
| Artifact Store | 16 个文件、190 项全部通过 | 包括用于后台索引/恢复状态的短时跨进程锁；不宣称可在旧版本进程仍写入时安全在线迁移 |
| Java 专项与 CLI 索引整合 | Java 44 项、CLI 17 项通过 | 可证明的常见静态调用链及索引接入；动态/歧义情况保持未解析 |
| 恢复、旧格式保护与草稿重开 | 6 项通过 | 真实 legacy Task/旧 Markdown/损坏 manifest 原样归档 → 新 Task → 鉴权 HTTP 回看 → restore；逐文件 hash 一致。源码变化后经真实 Task context refresh 重开 writer，旧稿和新稿均可恢复 |
| 恢复并发边界 | 包含在上述 6 项中，通过 | in-flight 操作标记阻止切换根目录；恢复期间新本地 MCP 请求拒绝；活动索引锁、symlink 拒绝；确认已退出进程的旧锁可随旧状态保留归档 |
| 索引与本地 Task 回归 | refresh-index 35 项、本地真实 Task 全链 1 项通过；CLI 两个 tsconfig 类型检查通过 | 合法已初始化 Store 不被误判为 legacy；冷初始化、持久任务与刷新仍可用 |
| CLI 后台索引（上一轮） | 正式 bundle 回归 4/4 通过；保留历史批次 | 验证并发复用、launcher 退出后继续、取消保留上次产物、dead job/recovery lock 恢复及 symlink 拒绝；其当时默认 MCP 首次建任务仍同步的缺口由下面新批次补齐 |
| 首次 MCP 自动后台化（2026-09-22） | 正式 bundle 3/3 通过；请求控制 4/4、MCP 集成 8/8 通过 | 450 个新增源文件下两个 Host 的首次请求在 5 秒内返回同一作业；关闭 Host 后重连可追踪，完成后原参数重放只创建一个幂等 Task；MCP 取消保留此前产物，真实 worker 失败后修复可重试；拒绝跨根查询及 Provider 回退。已初始化通知不会被快速状态查询越过 |
| 后台协议与真实安装（2026-09-22） | 契约 34/34、71 个生成 schemas 与 28 个 fixtures 校验通过；真实 npm 冷安装 1/1、原 CLI 后台 4/4 通过；CLI 两个 tsconfig 检查通过 | 广告 outputSchema 接受 pending/完成分支并拒绝伪造 Task/快照身份；npm 无扩展名 `.bin` 符号链接先解析实际 bundle 再启动 worker。完成作业的 snapshotId 已与实际 active index 及后续 Task 核对一致 |
| 后台进程环境隔离（2026-09-22） | 新增真实 bundle 污染环境用例修复前失败，修复后 CLI 后台 5/5 通过；CLI 两个 tsconfig 检查通过 | worker 不继承 ambient `GIT_*` 配置/仓库覆盖变量，以及 Node preload 和动态库注入变量；配置的 Git fsmonitor 与 Node preload 测试标记均未执行，索引仍真实完成。jobs Git 目录探测复用相同净化环境 |
| Dashboard 全量与 build | 71 个文件、724 项全部通过；build 退出码 0 | 包含本轮搜索实现；测试与构建通过不替代真实大仓浏览器预算验收 |
| 最终 CLI 整合 | 11 个文件、116 项全部通过；两个 tsconfig 类型检查通过；独立冷打包 1/1 通过 | 覆盖最终后台索引、writer、恢复、并发取消、版本候选、真实 Java 索引、命令参数及独立 reader；安装到 monorepo 外执行持久任务与损坏保护 |
| 最终 Preview 整合 | 已重建并通过语法检查；runtime、真实安装入口及双 Host 生命周期共 21 项通过、2 项 Linux 专属跳过；修正冷包清单后，冷安装与恶意 tar 拒绝用例 2/2 通过 | 最终 CLI bundle SHA-256 为 `dd0bbbc378ca43da6b4e381da0a0ad7606971306db345225b1886087a5c2d9cb`。冷包验证包含实际 monorepo 外安装、MCP/Preview 生命周期；本轮由多个批次完成，不把旧失败断言计为通过 |
| Alpha 发布包解析 | 当前实际 pack 的解析器定向测试 1/1 通过；脚本语法与 diff 检查通过 | 同步合法包的文件数/体积边界，保留越界路径、链接与单文件超限拒绝；未将该定向结果表述为历史 clone 的完整 Alpha 发布 E2E 通过 |
| 隔离双 Host 安装与 MCP | 15 项中 13 项通过、0 失败、2 项 Linux 专属测试在 macOS 跳过 | 真实 Codex/Claude CLI，临时用户配置及安装缓存 MCP；不包含登录模型旅程。版本、bundle hash 与命令见[隔离 Host 验收报告](2026-09-21-isolated-host-acceptance.md) |
| 已认证 Codex 模型实际接入 | 最终包上四次 MCP 调用全部 completed，无 tool error；持久 Task `42C24JTFJGTSAA34GASS5K4K0R`，revision 2、context_ready | 实际调用 build_task_brief、get_repo_pulse、get_evidence、get_task_brief；临时样例仓库源码未改。没有 open_workbench、check_change、record_verification，也没有第二/第三 Task，三任务验收不计通过 |
| 真实大型仓库产物消费 | 18,360 节点、2,458 Wiki 页面、2,858 搜索记录；Node/HTTP 测量及优化后复测完成 | 共享行模式五个抽样查询匹配数不变，暖查询回退已消除；首次中文查询与缓存内存仍有成本。样本、机器、hash、方法和未测范围见[大仓性能报告](2026-09-21-large-repository-performance.md) |

隔离安装验收对应其报告中的具体 bundle hash。最终源码重新打包后，已使用最终包复跑上述入口和生命周期；原报告中旧 hash 的历史安装结果仍单独保留。

最后的冷包检查发现旧清单只允许 91 项，当前合法包为 272 项：增加的 181 项是安装辅助入口 1 项，以及 60 个实际使用的 Mermaid 动态模块在三个独立 Dashboard 副本中各一份。逐项核对后更新精确文件规则，没有放开任意模块、源码或敏感文件；链接、越界路径和 4 MiB 单文件界限仍拒绝。实际压缩包 9,133,147 字节，tar 展开 28,755,968 字节，其中文件内容 28,537,230 字节；相应包体积预算已同步为压缩 10 MiB、展开 32 MiB，Alpha 原始条目上限为 275。发布脚本不进入 dist，因此这些测试契约修正没有改变上述已验证 bundle。

本轮第 3、15、16 项的最新证据分别见下方首次索引复核、[浏览器报告](2026-09-22-browser-performance.md)及[真实 Host 报告](2026-09-22-host-journey-acceptance.md)。上方 2026-09-21 的旧包 hash、计数和时限仅保留为历史；最终包结果见本轮补充。

## 上一轮验证证据（保留历史）

以下计数按各测试批次记录，存在重叠，不相加作为独立测试总数。

- Dashboard 全量：71 个文件、724 项通过。
- Core 全量：61 个文件、1,038 项通过，包含主干写作契约和无架构层小仓库的源码关联。
- Python/Rust/call resolver：96 项通过；索引安全/候选/导入解析：51 项通过。
- 正式知识写作全链：真实 Task → 文件/专题/主干 writer → finalize 分片产物 → MCP stage → source-verified 候选校验通过；没有跳过质量或验证门槛。
- 主干补齐后的 CLI 整合回归：5 个文件、7 项通过，包括真实 Git Task、编辑检查、实际测试结果记录及完整 writer 候选流程。
- CLI 关键整合批次：6 个文件、32 项通过，覆盖 writer 准备、草稿保护、快照漂移、候选生命周期、取消及错误诊断。
- 独立 Workbench 进程：2 项通过。真实 MCP 子进程创建 Task 后退出；旧 HTTP 不可用；独立 reader 在 stdin 关闭后仍能鉴权读取同一 Task；未鉴权请求拒绝；SIGTERM 正常结束。
- 打包 CLI 冷启动：1 项通过，安装到 monorepo 外执行真实 Task 流程和损坏保护。
- Preview runtime 与安装计划：9 项通过。安装计划测试不修改全局 Host。
- Writer 打包指南：复制单个 bundled CLI 到临时目录，无插件源码 checkout/node_modules 依赖，--guide 正常输出文件/专题工作流。
- Writer generator：16 项通过，包括 Task 草稿路径、symlink 拒绝及原有源码保护。
- Workbench runtime 全量：27 项通过。
- Workbench gzip：压缩后解压内容完全相同、明确 gzip;q=0 保持原文，no-store 等边界保留。
- 浏览器操作：本地 Preview 首页显示真实阶段数及缺口；第一次点击搜索即打开并聚焦，输入已存在文档标题后跳转到对应正文。
- core、Workbench runtime、CLI、Dashboard、Preview 构建及相关 TypeScript/语法检查通过。

## 首次 MCP 后台索引复核（2026-09-22）

`build_task_brief` 的 pending 分支只有作业信息，不承诺已经创建 Task。Host 使用 `index_job { action: "status", jobId }`，每次至少等待 `pollAfterMs`；最多连续检查 10 次，若仍运行则报告作业 ID/阶段，并让出当前调用轮次或至少等待 10 秒后再开始下一批。没有等待能力的 Host 应直接报告 pending，不连续立即调用。失败、取消和中断是终态，停止轮询；处理原因或收到明确重试请求后才重放原始创建请求，不无限自动重启。这些是公开 instructions/nextStep 的宿主调用指导，不声称服务器能强制任意宿主遵循等待策略。

后台 worker 只有在 `localRefreshIndexV1` 完成严格成功响应及原子发布后才持久化 `completed`。`snapshotId` 表示该作业提交的快照；后续其他刷新可能发布新快照，不能把历史作业的完成状态当作仓库永远新鲜。真实 bundle 回归同时核对已发布 active index、作业 snapshotId 以及恢复创建的 Task 来源。

## 使用新增入口

下面命令的 `$PWD` 必须是实际 Git worktree 顶层目录；任务、后台任务和恢复 ID 均使用命令返回的真实值。恢复相关示例是用户显式执行入口，本轮只在临时 fixture 验证，没有在当前真实仓库运行迁移。


```bash
# 已安装 Preview 包后，选择实际使用的 Host：
understand-code-preview --install-host codex

# 大仓首次分析可先显式启动后台索引；启动命令返回后 worker 继续运行：
understand-code index --root "$PWD" --background
understand-code index --root "$PWD" --status

# 需要停止时，按返回的 job ID 请求协作取消，再查询最终状态：
understand-code index --root "$PWD" --cancel --job-id "<JOB_ULID>"
understand-code index --root "$PWD" --status --job-id "<JOB_ULID>"

# 已完成取消或处理失败原因后，再次 --background 启动新的索引任务；
# 索引完成后回到 Host 创建或刷新 Task。默认 MCP 首次建任务现在会自动走同一后台流程。

# 查看正式写作的完整步骤；替换为实际任务 ID：
understand-code knowledge --root "$PWD" --task-id "<TASK_ULID>" --guide

# Host 退出后重开本地任务；此进程需保持运行：
understand-code workbench --root "$PWD" --task-id "<TASK_ULID>"

# 旧产物恢复：先关闭此仓库的 Host/reader，停止并等待后台索引结束。
# 完整归档旧 .understand-code 后，从当前源码创建新本地 Task：
understand-code recover --root "$PWD" --rebuild

# 如需回退，使用上一命令打印的 recovery-... ID；当前状态也会先归档：
understand-code recover --root "$PWD" --restore "<RECOVERY_ID>"

# 源码变化后，先让 Host refresh_index，并 refresh_task_context/rebase_task。
# 归档该 Task 的旧 writer 草稿，再准备绑定当前源码的新草稿：
understand-code knowledge --root "$PWD" --task-id "<TASK_ULID>" --restart-draft

# 只清理中断的临时写入，不淘汰完整草稿：
understand-code knowledge --root "$PWD" --task-id "<TASK_ULID>" --cleanup-interrupted
```

恢复备份位于该 worktree 的实际 Git 管理目录下 `understand-code-recovery/<recovery-id>/`，不会进入源码索引。备份中有原资料与恢复说明；恢复旧稿不改变其源码绑定，也不会把旧验证转成新验证。移除 worktree 或 Git 管理目录前，应先把要保留的备份复制到其他位置。

完整安装、恢复和能力说明见 [CLI README](../../packages/cli/README.md) 与 [Preview README](../../packages/preview/README.md)。

## 最终整合补充（2026-09-22）

- Dashboard：73 文件、737 项通过；normal/demo/Preview 三种实际编译 Worker 都验证了无 DOM 环境启动、真实 buffer transfer 与 legacy Markdown 行为；类型检查和构建通过。
- CLI：首次后台 MCP、双宿主/退出恢复/幂等/取消/失败重试、真实 npm 冷安装、污染环境隔离和版本冲突映射均有对应回归；最后新增环境隔离 5/5、错误映射相关 11 项通过，CLI typecheck 通过。
- 最终 Preview 冷安装 2/2、当前真实 pack 的 Alpha 解析 1/1。没有将历史 clone 的完整 Alpha 测试算作通过。
- 最终 CLI SHA-256：`c532859cf2b406ed34596bef69ef25a2f68b593aa83613c8f4d86a5638b33d6d`。
- 最终包 275 个逻辑文件 / 278 raw entries：tgz 9,383,136 B、展开 29,557,248 B、payload 29,335,555 B；base 10,272,137 B、两插件合计 19,063,418 B。精确 Worker 文件规则新增三份，没有放开未知路径或模块。最大单文件 4,190,318 B，距既有 4 MiB 上限仅 3,986 B，后续增量需继续过门禁。
- 真实模型使用报告中明确记录的冻结中间包，最终追加的环境/诊断/前端修正由对应回归及最终包检查覆盖；不把中间包模型结果冒充最终 hash 的完整模型重跑。
- 实际大仓产物保持原 hash；改动在当前工作区，未提交、发布或修改全局 Host 安装。
