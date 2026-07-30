# G0 Contract Freeze Record

记录 ID：`G0-2026-07-28`

状态：**Closed for implementation；WP4 Decision Amendments D-22～D-23 incorporated**

候选基线：`34da354968a6071d914e4e4a4fca738e6c2d8a29`

冻结日期：2026-07-28

WP4 修订日期：2026-07-29

编制方式：Codex 汇总版本化证据、独立审查和自动化结果；Codex 不被记录为真人签署人

Surface Release Gate：**Open**

## 1. Gate 结论

Product Mission、P0 Scope、Non-goals、Task Lifecycle V1、Root Binding Contract V1、Workbench Runtime Rendezvous Contract V1、发布逻辑标识和 WP1 入口契约已经冻结。WP1 可以开始实现共享 Schema 与 Artifact Manifest。

本记录关闭的是**工程实现入口的 Contract Freeze Gate**，不是产品发布批准：

- Codex CLI Plugin 与 Claude Code CLI Plugin 仍是 P0 Beta mandatory Surface，但当前都保持 `pending-e2e`。
- Desktop、IDE 与 VS Code Surface 仍是 conditional，未通过各自 Surface Release Gate 前不得写入支持文案。
- npm Scope、Host Marketplace、公开仓库、License、安装包和最低 Host 版本仍由 WP6/WP8 的发布证据关闭。
- 本记录不声称任何组织、公司仓库 Owner 或未具名真人已签署发布许可。

Gate 关闭依据是 `understand-code` 项目 Owner 已明确要求按本研制计划继续实施；这是单项目工程决策授权，不代表 `ALPHA-B` 或其他外部仓库 Owner 授权。未来进入团队 Alpha、外部 Beta 或公开发布时，Product、Tech、Platform/Security 与 QA 仍须在对应 Gate 留下可追踪的真人确认。

2026-07-29 的 D-22 是 WP4 实现过程中发现并关闭的契约歧义：公开
`build_task_brief(expectedRevision=0)` 必须编排 `created@1` 与
`context_ready@2` 两次合法 Mutation，而不能绕过 Genesis 或一次增加两个
revision。该修订不重新打开 G0，也不改变 D-21 的状态集合、允许转移或 Guard；
它冻结公开 Operation 与底层 Mutation 的边界，并将完整 Operation Journal /
Receipt 提升为可信持久化事实。

同日 D-23 关闭了 Persistent Task 与可变 canonical Repo Pulse 之间的存储
冲突：旧 Task 精确 Pin 的 Pulse 必须归档为不可变历史版本，新的 canonical
Pulse 通过 durable marker 与 Manifest commit point 原子切换。该修订不新增
Artifact Type 或 Lifecycle 状态，只冻结 Pulse 版本身份、历史可寻址性和恢复
边界。

## 2. 状态语义

本项目后续 Gate 记录统一使用以下正交状态，避免把“测试通过”“决策接受”和“可以发布”混为一谈：

| 维度 | 枚举 |
|---|---|
| `machineStatus` | `passed` / `failed` / `not_run` / `not_applicable` |
| `decisionStatus` | `accepted` / `deferred` / `rejected` / `superseded` |
| `evidenceStatus` | `observed` / `official` / `provisional` / `pending-e2e` |
| `gateStatus` | `open` / `closed_for_implementation` / `closed_for_release` |

`closed_for_implementation` 只允许下游研发开始；只有各 Surface 的构建产物、安装、真实 Tool Call、Root/Error、升级和清理矩阵全部通过后，才能使用 `closed_for_release`。

## 3. 冻结证据

| 范围 | 版本化证据 | Machine status | 结论 |
|---|---|---|---|
| 总研制计划 | `8eb1f49` 与本次 Contract Freeze 修订 | `passed` | Mission/P0/Non-goals 已定版 |
| Graph Quick Jump | `dfb94ec` | `passed` | 复用索引，避免重复全图构建 |
| Graph 有界性与可达性 | `5468299` | `passed` | 全对象可达，视图保持产品 Cap |
| 根级质量入口 | `b8edfa9` | `passed` | 新鲜工作区一条命令执行 build/typecheck/test |
| CI 基线 | `fdc25ad` | `passed` | Ubuntu、Node 22、pnpm 9 质量门已建立 |
| Plugin metadata 保护 | `240abcb`、`2f0cb75` | `passed` | Claude Skill metadata 保真且缺失 Manifest 会失败 |
| Host Binding | `e6d8ae5` | `passed` | 共享 Root/Error/Rendezvous 契约可冻结；Surface 仍待 E2E |
| 大仓性能 | `34da354` | `passed` | Self-host 与确定性 10k Graph Pipeline Slice 通过 |

### 3.1 质量 Closeout

在 `34da354` 上执行：

| 检查 | 环境 | 结果 |
|---|---|---|
| `pnpm quality` | macOS arm64、Node 26、pnpm 11 | Root 10 files / 94 tests；Core 51 / 920；Dashboard 49 / 558；build 与 typecheck 全部通过 |
| `pnpm benchmark:large-repository` | macOS arm64、固定 Fixture | 两个 Corpus 的预算、Fixture、Frozen Workload、布局与有界性全部 PASS |
| `claude plugin validate --strict .` | Claude Code 2.1.202 | PASS |
| Host Binding Probe tests | Root Vitest | 22 tests PASS |
| `git diff --check` | G0 文档修改前后 | PASS；提交前必须再次执行 |

远端 CI：

- Run ID：`30335147523`
- URL：<https://github.com/chifanjie/Tomato/actions/runs/30335147523>
- Commit：`34da354968a6071d914e4e4a4fca738e6c2d8a29`
- Runner：Ubuntu / Node `22.23.1` / pnpm `9.15.9`
- 结果：Root 94、Core 920、Dashboard 558 tests；workspace quality 与 active surface audit 均成功

这条 CI 是 G0 代码质量证据，不是性能、Plugin 安装或 Surface Release 证据。

### 3.2 Evidence integrity

- Host Capture Manifest SHA-256：`6ccec4488558c8953e135999bdf5695c80bb45db3db92f99b55703dca00cc3af`
- Large Repository Evidence SHA-256：`b6feda0dd98aaa3a5adde2434c90038a1a50f30c3c360cee8e4013fc5757a6ac`
- 性能 Evidence 保存生产源文件 Hash、原始样本、预热/采样数和 expected/actual 完整性字段。
- Host Evidence 保持 Surface 边界；Codex App Server provisional 结果和 Claude 未认证 Tool Call 不被提升为 supported。

## 4. D-13～D-23 冻结结果

### D-13：P0 平台

状态：`accepted`

- P0 Beta 支持 macOS 与 Linux。
- Windows Native、Windows named pipe 与 WSL 不进入 P0 Beta 支持范围。
- 最低 OS、发行版、CPU 架构与 libc 组合由 WP8 RC Evidence 冻结。
- 重新打开条件：完成 Windows Runtime lock/control/IPC 设计与 E2E，或 GA 平台评审明确要求。

### D-14：产品、CLI、Package 与 Plugin 标识

状态：`accepted`

| 对象 | 冻结值 |
|---|---|
| Product slug | `understand-code` |
| CLI command | `understand-code` |
| Codex Plugin name | `understand-code` |
| Claude Plugin name | `understand-code` |
| Marketplace logical name | `understand-code` |
| Host install selector | `understand-code@understand-code` |
| Target CLI package | `@understand-code/cli` |
| 首个 Agent-native release train | `3.0.0-alpha.1` |
| npm channel | `alpha` → `beta` → `rc` → `latest` |
| GitHub channel | Internal Alpha prerelease → Beta/Stable release |

`@understand-code/skill@2.7.5` 作为兼容包装保留，不是最终 CLI 安装合同。Alpha 只要求一个带预编译 Runtime 的 CLI 发布物；`contracts/core/mcp-server/local-server/dashboard` 在 API 稳定前可保持 workspace-internal。

公开 Registry 查询未发现上述精确 npm 名称，但本机 npm 未登录，`E404` 不等于已保留名称。`@understand-code` Scope 所有权、Marketplace 坐标和发布权限必须在首次发布前验证；若外部名称冲突，只重开外部坐标，不改变 Product slug、CLI command、Plugin 内部名或 Artifact Schema。

发布物命名：

```text
understand-code-{version}-{os}-{arch}.tar.gz
understand-code-codex-plugin-{version}.tar.gz
understand-code-claude-plugin-{version}.tar.gz
understand-code-codex-ide-{version}.tar.gz
SHA256SUMS
SBOM
```

### D-15：Task Artifact 版本控制

状态：`accepted`

- `.understand-code/tasks/**` 默认是本地私有、被忽略的运行状态。
- P0 不自动提交完整 Task、Evidence 或源码摘录。
- Installer/Doctor 不静默修改用户 `.gitignore`；只可给出建议，或在用户明确确认后维护带 marker 的 ignore block。
- 只有显式 export 且完成绝对路径、源码、凭据与主机元数据脱敏的 Artifact 才允许进入版本控制。

### D-16：Task ID

状态：`accepted`

- Canonical Task ID 使用 ULID。
- ID 不依赖本地递增计数，可跨进程、跨 Agent 与 Worktree 并发生成。
- `UC-xxxxxx` 只可作为 UI 短显示，不是持久化主键或外键。

### D-17：Embedding

状态：`accepted`

- P0 Beta 不发布 Embedding Provider。
- Task Brief 必须依靠 lexical、symbol、graph 与 deterministic evidence 完整工作。
- Embedding 属于 P1，并需要独立的数据外发、Provider 权限与无 Provider 降级评审。

### D-18：空 Task

状态：`accepted`

- P0 Workbench 不允许手工创建无原始意图的空 Task。
- Task 只由 `build_task_brief`、受支持的 resume/migrate/rebase 入口创建。
- `created` 必须已经包含非空 `originalIntent`、repository/worktree identity 和 baseline。

### D-19：Alpha Pilot 与 Gold Set

状态：`accepted`

Activation Gate：`open`

| Pilot | 语言/角色 | 固定基线 | Snapshot policy | Alpha Task |
|---|---|---|---|---:|
| `ALPHA-A` | TypeScript self-host + TS stratum | `34da354968a6071d914e4e4a4fca738e6c2d8a29` | clean commit-only；排除 index/worktree/untracked | 18 |
| `ALPHA-B` | 大型 Go domain stratum | `01aa1dac22db7d30e92818486190cef6b342fc18` | local-only clean commit materialization；排除当前 dirty/untracked | 6 |

限制：

- `ALPHA-A` 的 self-host 与 TypeScript stratum 来自同一仓库，不声称具备独立 TypeScript 仓库多样性。
- `ALPHA-B` 的固定 Commit 当前只存在于本地分支；跨机器 Fixture 在 Owner 发布该 Commit 前必须使用可获取的上游 Commit，或通过 Decision Amendment 更新 Pin。
- 两个 Pilot 都从固定 Commit 创建隔离 clean worktree，当前用户修改不得进入 Gold Set。
- 当前只证明本机可读，不代表长期产品试点、公开披露或代码复制已获仓库 Owner 许可。`ALPHA-B` 激活、Gold Task 标注和任何 Evidence 出库前必须取得 Owner 明确授权。
- 公开报告只使用 Pilot alias、语言/规模档位和聚合指标。

### D-20：Host 最低版本

状态：`deferred`

- 每个 Surface 在 WP6/WP8 通过独立 clean-install E2E 后确定最低版本。
- 当前本机版本不自动成为支持下限。
- Claude dynamic Roots 若进入支持承诺，最低版本不得低于 `2.1.203`。
- Owner：Platform / Integration；关闭 Gate：对应 Surface Release Gate。

### D-21：Task Lifecycle V1

状态：`accepted`

Lifecycle 见第 5 节。WP1 Schema 与 WP4 Task Engine 不得自行引入额外状态或绕过 Guard；如需改变，必须新增 Decision Amendment 和迁移规则。

### D-22：`build_task_brief` 两阶段编排与 Operation Journal

状态：`accepted`（2026-07-29 Decision Amendment）

- 公开 `build_task_brief` 保持 `expectedRevision=0`，并由
  `(worktreeId, createScope, idempotencyKey)` 稳定映射同一个 Task ID。
- Stage 1 原子提交最小 recovery bundle：
  `created@1 + task_created Event + task_created Receipt`。
- Stage 2 只在 Pulse、Context 和所有引用校验通过后，原子提交完整 Context
  bundle：`context_ready@2 + transition Event + build_task_brief Receipt`。
- 每一 Stage 分别且只 `+1 revision/+1 Event`；公开调用可以编排两次
  Mutation，但任何单次 Store commit 仍不得跨 revision。
- `task_operation_journal` 必须保存从 Genesis 开始的完整
  Idempotency Record 与 Operation Receipt；每个 Receipt 保存首次提交的完整
  结构化结果与 canonical result digest。
- 同 key 同 Actor 同 request digest 的重试从 Journal 返回首次结果；Task 即使
  已推进到更高 revision，也不能丢失旧结果。payload 或 Actor 不同则返回
  `idempotency_conflict`。
- Stage 1 后崩溃或 Context Gate 失败时保留 `created@1`；重试同 key 恢复
  Stage 2，不创建第二个 Task。
- `context_ready@2` 是阶段间没有其他 Mutation 的标准结果。若 Stage 1 后合法
  `block_task → resume_task`，Stage 2 从恢复后的 `created@N` 严格 CAS 到
  `context_ready@(N+1)`；不得硬编码 revision 2 或倒退 Event history。
- 旧的无 Journal Task 只允许显式兼容读取或迁移；新 writer 不得静默把最近
  idempotency cache 当成完整历史事实。

本修订解决的是编排边界，不新增状态或转移，因此 D-21 Lifecycle 无迁移；
Journal Schema 作为新的 Task-scoped V1 Artifact 需要由 Contracts、Store 和
Task Engine 同步升级。验收矩阵见
`docs/research/2026-07-29-wp4-task-intelligence-matrix.md`。

### D-23：Repo Pulse 不可变历史与 canonical 切换

状态：`accepted`（2026-07-29 Decision Amendment）

- canonical 文件固定为 `.understand-code/repo-pulse.json`；被替换的完整
  envelope 归档到 `.understand-code/pulses/<version-key>.json`。
- 历史 descriptor 保留原 `artifactId/contentDigest/sourceSnapshotId`，状态为
  `historical/stale`；新 current descriptor 使用不冲突的确定性身份。
- 生产写入顺序为 `marker → history → canonical → Manifest`，Manifest 是唯一
  commit point；所有 Manifest mutation 必须先 drain Pulse/Task transaction。
- historical Pulse 的依赖者递归 stale，但历史 bytes 与 exact Pin 继续可信可读。
- canonical 恢复失败只标记精确 committed descriptor；不得按 Artifact Type
  批量标坏历史 Pulse。
- `migrateJson` 的 Repo Pulse 历史统一留给 WP8 Migration Gate；在此之前不得
  用该入口替换已被 Task Pin 的 Pulse。

D-23 是存储与恢复语义修订，不改变 D-21 状态机，也不新增 public Artifact
Schema。验证矩阵见
`docs/research/2026-07-29-wp4-task-intelligence-matrix.md`。

## 5. Task Lifecycle V1

### 5.1 状态

| 状态 | 语义 | 类型 |
|---|---|---|
| `created` | ID、intent、repo/worktree 与 baseline 已保存；Context 尚未成功构建 | 可恢复 |
| `context_ready` | Pulse 可用，Brief/Claim/Evidence 引用有效；Unknown 已显式记录 | 活跃 |
| `planned` | Goal、Acceptance 与 Plan 已通过强类型 Action 确认 | 活跃 |
| `in_progress` | 实施已开始，Worktree Diff 可持续变化 | 活跃 |
| `check_required` | 当前实现切片完成，必须对最新 actual snapshot 执行 Change Check | 活跃 |
| `verification_required` | 最新 Check 已完成且阻断 Finding 已处理，仍需 Verification 记录 | 活跃 |
| `verified` | Check 与 Verification 均绑定最终 snapshot，验收闭环完成 | 终态 |
| `blocked` | 外部依赖使任务暂停，保存 `resumeStatus` 和结构化原因 | 可恢复异常态 |
| `stale` | 支撑计划/检查的 Snapshot 或 Artifact 失效，禁止继续作可信结论 | 可恢复异常态 |
| `superseded` | 被替代、重复或明确放弃 | 终态 |

P0 不另设 `cancelled`；放弃表示为 `superseded(reason=abandoned)`。P0 不物理删除 Task；隐藏和归档只属于 View concern。

### 5.2 允许转移

| From | To | Guard |
|---|---|---|
| `created` | `context_ready` | Context 构建成功；Pulse 非 `not_ready/unknown`；引用校验通过 |
| `context_ready` | `planned` | Goal、Acceptance、Plan 已确认；Actor 与 revision 已记录 |
| `planned` | `in_progress` | 显式开始；Task/Worktree 绑定仍有效 |
| `in_progress` | `check_required` | 已捕获最新 actual snapshot；Agent 声明本轮修改可检查 |
| `check_required` | `in_progress` | Check 发现需要继续修改或补计划 |
| `check_required` | `verification_required` | Check 绑定当前 revision/snapshot；阻断 Finding 已修复或由授权 Actor 显式接受 |
| `verification_required` | `in_progress` | Verification 失败且需要继续修改 |
| `verification_required` | `check_required` | actual snapshot 再次变化，旧 Check 自动失效 |
| `verification_required` | `verified` | Check 仍为最新；所需 Verification 已通过或被授权 Actor 接受 skip；无 unresolved failed/blocked/flaky |
| `created` / `context_ready` / `planned` / `in_progress` / `check_required` / `verification_required` | `blocked` | 使用 `block_task`；记录 `resumeStatus`、blocker、Actor 与时间 |
| `created` / `context_ready` / `planned` / `in_progress` / `check_required` / `verification_required` | `stale` | Snapshot/Artifact 失效；不得静默继续 |
| `created` / `context_ready` / `planned` / `in_progress` / `check_required` / `verification_required` | `superseded` | 使用 `supersede_task`；记录 reason；存在替代 Task 时记录 `replacementTaskId` |
| `blocked` | 原 `resumeStatus` | 使用 `resume_task`；Blocker 已解除且 Context/Check 仍 fresh |
| `blocked` | `stale` | Blocker 解除时 Context/Check 已失效，或等待期间 Snapshot/Artifact 失效 |
| `blocked` | `superseded` | 使用 `supersede_task`；记录 reason 与可选 replacement |
| `stale` | `context_ready` | `refresh_task_context` 或 `rebase_task` 成功；旧 Plan/Check/Verification 显式失效 |
| `stale` | `superseded` | 使用 `supersede_task`；记录 reason 与可选 replacement |
| `verified` / `superseded` | 无 | 终态不可重开；后续工作创建新 Task 并建立 parent/replacement link |

不允许 `created → verified` 等跨阶段跳转，也不允许 `blocked → blocked`、`stale → stale` 或 `stale → blocked`。裸 `transition_status` 不能代替 `block_task`、`resume_task`、`refresh_task_context`、`rebase_task`、`supersede_task` 等强类型 Action。

### 5.3 Revision、幂等与恢复

- `update_task` 的生命周期 Action 固定包含 `transition_status`、`block_task`、`resume_task`、`refresh_task_context`、`rebase_task` 与 `supersede_task`；`transition_status` 只执行表内普通阶段转移。
- 所有 Task Mutation 使用 `(worktreeId, taskId/create-scope, idempotencyKey)` 唯一键，并保存 canonical request digest 与 Actor。
- 服务端顺序固定为：binding/auth → idempotency lookup → same-key digest check → CAS `expectedRevision` → lifecycle guard → 原子提交 Artifact/Event/idempotency result。
- 同 key、同请求重试返回首次持久化结果，不增加 revision、不追加 Event；即使请求携带旧 revision，也先返回 replay。
- 同 key、不同 payload 或 Actor 返回 `idempotency_conflict`，不写入。
- 未见过的 key 且 revision 不匹配返回 `revision_conflict`；调用方读取最新 revision、重新决策并使用新 key。
- 成功 Mutation 恰好增加一次 revision、追加一次 Event；Schema、Guard、CAS、权限或执行失败均不增加 revision。
- Crash 后结果不确定时必须复用原 key；`build_task_brief` 的 key 稳定映射到同一 Task ID。
- `rebase_task` 更新 baseline 并使旧 Plan/Check/Verification 失效，不能原地保留旧 `verified` 语义。

### 5.4 `build_task_brief` 编排与可信回放

`build_task_brief` 是唯一允许在一个公开 Tool Call 内顺序执行两次底层 Mutation
的 P0 编排；两次提交仍分别执行第 5.3 节的 authorization、idempotency、CAS、
Guard、Artifact/Event/Journal 原子提交规则。

| 阶段 | 输入 revision | 提交后状态 | 必备持久事实 | 不得出现 |
|---|---:|---|---|---|
| Stage 1 / intent recovery | 0 | `created@1` | Manifest、唯一 `task_created` Event、创建 Idempotency Record 与完整 Receipt、Operation Journal | Brief/Claim/Evidence/Impact/Check/Verification 伪事实 |
| Stage 2 / context publication | 当前 `created@N`（标准路径 N=1） | `context_ready@(N+1)`（标准路径 @2） | Brief、Claim、Evidence、Impact、下一条 Event、公开调用 Idempotency Record 与完整 Receipt、更新后的完整 Journal | 未通过 Pulse/引用校验的 Context；空 Change Check/Verification；硬编码 revision 2 |

可信 Journal 满足：

1. 每个 Idempotency Record 恰好对应一个 Receipt，Task/Event/revision/result
   digest 全部一致；Receipt operation、Task resultingStatus、Snapshot、
   repo/worktree 与对应 Event 逐项一致。
2. Receipt 的完整 result 必须重新计算 canonical digest；只验证结构不足以
   信任历史 replay。
3. Journal、Manifest、Task Artifact 与 Event chain 必须来自同一 CAS
   revision；任一缺失、截断、悬空或 digest mismatch 时整个 Bundle fail
   closed。
4. 幂等 lookup 先于 revision conflict：旧 key 即使携带旧
   `expectedRevision`，仍返回首次结果；未见过的新 key 才执行当前 CAS。
5. `.idempotency.json`、内存 Map 或调用方单文件拼装只能作为非权威缓存/实现
   细节，不能替代 `task_operation_journal`。
6. 新 live writer 每个 revision 都必须提交完整 Journal；无 Journal 仅允许
   显式 legacy history import/migration，且不得被可信 `readTaskBundle` 读取。

WP4 关闭前至少通过以下验收：

- 正常调用固定产生同一 Task 的 `created@1 → context_ready@2` 两条连续 Event。
- Stage 1 后故障、进程退出或 Context 暂不可用，原 key 重试可恢复 Stage 2。
- Stage 1 后合法 block/resume 回到 `created@N` 时，Stage 2 只提交
  `context_ready@(N+1)`，不倒退 revision。
- 已完成调用在后续 Task revision 上仍能 replay revision 2 的首次完整结果。
- 同 key 不同 payload 或 Actor fail closed，且不追加 revision/Event。
- 20 路同 key 并发只产生一个 Task、一个 Genesis 和一个
  `context_ready` Event。
- 进程重启后仅通过可信 Store bundle/journal 继续 Task；非法
  `resume_task` 不能恢复到 `blockedState.resumeStatus` 之外的状态。
- `context_ready@2` 可在没有 Change Check/Verification Artifact 时可信读取。

## 6. Owner Matrix

角色是后续责任边界，不等于本记录声称某个未具名真人已经签字。

| 范围 | Accountable | Implementer | Verifier | Promotion approver |
|---|---|---|---|---|
| Mission/P0/Non-goals | Product Owner | — | QA | Product Owner |
| Contracts/Task lifecycle | Tech Lead / Core | Core | QA | Tech Lead |
| Root/Error Contract | Tech Lead + Platform | Platform | QA/Security | Tech Lead |
| Runtime Rendezvous | Platform / Integration | Platform + Frontend | QA/Security | Tech Lead |
| Codex CLI mandatory | Platform / Integration | Platform | QA | Product Owner |
| Claude CLI mandatory | Platform / Integration | Platform | QA | Product Owner |
| Conditional Surfaces | Platform / Integration | Platform/Frontend | QA | Product Owner |
| Workbench IA | Frontend | Frontend | Product/QA | Product Owner |
| Performance/Gold Set | Product/QA | Core/Frontend | QA | Tech Lead |
| Packaging/License/SBOM | Platform / Release | Platform | QA/Security | Product Owner |

### 6.1 Surface ownership

| Surface | P0 role | Contract owner | Adapter/Packaging | E2E/Evidence | 当前状态 | 关闭 Gate |
|---|---|---|---|---|---|---|
| Codex CLI Plugin | Mandatory | Tech Lead | Platform | QA | `pending-e2e` | WP6/WP8 Surface Release |
| Claude Code CLI Plugin | Mandatory | Tech Lead | Platform | QA | `pending-e2e` | WP6/WP8 Surface Release |
| Codex Desktop Plugin | Conditional | Tech Lead | Platform + Frontend | QA | `pending-e2e` | 独立 Desktop Release Gate |
| Codex IDE direct MCP + repo Skill | Conditional | Tech Lead | Platform | QA | `pending-e2e` | 独立 IDE Release Gate |
| Claude VS Code | Conditional | Tech Lead | Platform + Frontend | QA | `pending-e2e` | 独立 VS Code Release Gate |
| Claude Desktop local | Conditional | Tech Lead | Platform + Frontend | QA | `pending-e2e` | 独立 Desktop Release Gate |

Support 文案由 Product + QA 联签；任何一行未通过时只能保持 `pending-e2e`。

## 7. G0-01～G0-08 处置

尚未实现的项是已知 pre-P0 capability gap，不是 WP0 新引入回归。对应能力在后续 Gate 关闭前保持未支持，不能进入产品支持文案。

| ID | Contract disposition | 实现状态 | Owner | 必须关闭时间 |
|---|---|---|---|---|
| G0-01 Worktree freshness | staged/unstaged/untracked/rename/delete/error 必须进入 Snapshot；旧 fresh 结论不可信 | WP2 open | Repository State | M1；任何可信 Pulse/Task Brief 前 |
| G0-02 BODY_LOGIC 被当 cosmetic | 旧 `SKIP` 不得进入 P0；Refresh 与 Behavior Risk 分离 | WP2 open | Core | M1；Task Brief Alpha 前 |
| G0-03 Edge provenance 丢失 | Edge Evidence V1 进入 WP1；旧边只能显示 unknown provenance | WP1/WP2 open | Core | Evidence Alpha 前 |
| G0-04 非原子持久化 | Task Store 必须 atomic/CAS/lock；旧 writer 不得用于多 Agent Task | WP3 open | Core + Platform | 首次持久 Task Alpha 前 |
| G0-05 Secret hard deny | Hard deny 与内容扫描不可被 ignore negation 取消 | WP2/WP3/WP6 open | Platform / Security | 首个返回源码摘录的 MCP Alpha 前 |
| G0-06 Diff Overlay 断链 | 旧 Overlay deprecated，不作为 P0 数据源或完成证据 | WP5/WP7 open | Change Intelligence + Frontend | Change Check Workbench Alpha 前 |
| G0-07 Worktree 重定向 | Task/Store 绑定当前 canonical worktree；共享只限不可变缓存 | WP3/WP6 open | Core + Platform | 首次 Agent-native Task 写入前 |
| G0-08 Quality/Release | 根 quality、CI 已关闭；CLI/bin、统一版本、License、SBOM、allowlist、Marketplace 留后续 Gate | Partial | Platform + QA | Mandatory Surface Release / M4 |

## 8. 当前发布缺口

这些项不阻塞 WP1，但阻塞外部发布：

1. npm 当前未登录，`@understand-code` Scope 所有权未知。
2. 当前构建仓库为 private，尚无 Tag、Release 或 Release Workflow。
3. 仓库缺少可验证的 `LICENSE`，但 Claude Manifest 声明 MIT；公开发布前必须恢复完整 License 与上游归属。
4. Claude Manifest 的 author/homepage/repository 仍是历史元数据。
5. 缺少 Codex Manifest、两个 Marketplace Manifest、bundled `.mcp.json` 和 CLI `bin`。
6. 根 Package 缺少 `files`、`publishConfig`、`engines`、`packageManager`、repository/homepage/license 的一致配置。
7. 性能 Evidence 使用 Node 26 / pnpm 11，CI 使用 Node 22 / pnpm 9；WP8 必须冻结唯一支持基线并在该环境重采 RC Evidence。
8. macOS code signing/notarization、Linux Artifact 签名以及构建 provenance/attestation 尚未建立。

## 9. 用户工作区处置

提交本记录时只允许暂存 G0 文档：

- 用户所有的 `docs/prd/.qa/` 保持未跟踪、未暂存。
- 用户所有的 Graph Layout PRD `.docx` / `.md`、`assets/`、`__pycache__/` 和生成脚本保持未跟踪、未暂存。
- 用户所有的 `site/` 保持未跟踪、未暂存，不属于 Agent-native 产品研制范围。
- `.learnings/` 被忽略，不进入产品提交。
- `ALPHA-B` 当前 tracked dirty 与 untracked 内容不读取为 Gold Evidence、不复制、不提交。

## 10. Gate 计算

| 条件 | 结果 |
|---|---|
| Mission、P0、Non-goals 已冻结 | PASS |
| D-13～D-19、D-21～D-23 已接受；D-20 有 Owner/Gate | PASS |
| Task Lifecycle、Revision 与幂等语义唯一 | PASS |
| Root/Error/Rendezvous 语义唯一 | PASS |
| Surface mandatory/conditional、Owner、后续 Gate 完整 | PASS |
| G0-01～08 有处置、Owner 和 capability lock | PASS |
| 根质量、CI、Host 与性能证据可复核 | PASS |
| 用户未跟踪文件明确排除 | PASS |
| PRD/Host Spike 状态同步 | 由包含本记录的提交完成 |
| Surface Release Evidence | OPEN，不属于 Contract Freeze |

最终结论：

> `G0 Contract Freeze Gate = closed_for_implementation`
>
> `Surface Release Gate = open`
