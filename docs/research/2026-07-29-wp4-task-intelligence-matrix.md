# WP4 Task Intelligence Research and Traceability Matrix

记录日期：2026-07-29

范围：WP4 `packages/task-engine`、其依赖的 Contracts/Artifact Store 修订，以及
WP4 关闭所需的测试、审查和发布证据

状态：**WP4 Completed**

权威决策：

- `docs/prd/2026-07-27-agent-native-change-intelligence-rd-plan.md` D-21～D-23
- `docs/research/2026-07-28-g0-contract-freeze-record.md` 第 5 节
- WP1 Contracts 与 WP3 Artifact Store 已冻结的 Event/CAS/atomic bundle 规则

本矩阵是研发追踪证据，不是发布批准。最终本地 source tree 已关闭 Artifact
Store 互审发现的 durability、Snapshot trust、Repo Pulse liveness 与精确恢复
问题；focused regressions、Store/Task Engine 全包、根级 `pnpm quality`、
两轮独立复审和最终 clean-checkout 远端 CI 均通过，且无未关闭 P0/P1。分层
commit 已推送，WP4 功能树、CI 修复树和可追溯证据均已冻结，因此本矩阵正式
关闭 WP4。

## 1. WP4 目标与实际产品结果

WP4 的产品结果不是“再生成一段代码说明”，而是：

> Host Agent 用一个稳定 idempotency key 创建可跨进程恢复的 Persistent Task
> Brief；系统用真实仓库 Snapshot、可解释候选、Evidence、定向 Impact 和显式
> Unknown 形成修改前决策包，并把每次状态变化及其完整返回结果保存为可验证的
> 历史事实。

当前 `buildTaskBrief()` 的标准成功结果是一个 `context_ready@2` Task，包含：

- 与 canonical worktree 严格绑定的 baseline/latest Snapshot；
- 真实存在且经 Host 文件资格过滤的候选文件/符号；
- 可解释 Ranking signals、候选等级和有序 reading path；
- 带方向、预算边界和 Unknown Boundary 的 impact paths；
- Goal/Acceptance/Recommendation/Risk/Unknown Claims；
- Evidence 的认知状态与 freshness，不把 stale/unknown 提升为 fresh fact；
- verification plan Draft；
- 两条连续 Event 及完整 Operation Journal；
- 可分页读取的结构化结果和确定性 Markdown 投影。

Lifecycle 已能从 `context_ready` 经确认进入 `planned/in_progress/check_required`，
并能处理 block/resume、Snapshot drift、stale、supersede 和历史 replay。进入
`check_required` 时，Task Engine 会发布真实 actual Snapshot，并清理旧
Check/Verification 的 current projection 与 Claim backlinks。

但 WP4 **不宣称完整生产变更闭环已经完成**：

- `checkChange()` 与 `recordVerification()` 的生产 API 属于 WP5；
- 当前完整生命周期回归在受信任 Store fixture 中验证 Check/Verification
  语义，不是面向 Host 的生产 API；
- `refresh_task_context` / `rebase_task` 已显式 capability lock，Owner 为 WP5。

## 2. Contract Amendment 与持久化模型

### 2.1 `build_task_brief` 为什么必须采用两阶段

冻结契约同时要求：

1. 唯一 Genesis 是 `task_created`，结果为 `created@1`；
2. `created → context_ready` 是一次独立、受 Guard 约束的合法转移；
3. 每次成功 Mutation 恰好 `+1 revision/+1 Event`；
4. 公开 `build_task_brief` 创建新 Task，输入 `expectedRevision=0`。

冻结实现把公开 Tool Operation 与底层 Mutation 分开：

```text
build_task_brief(expectedRevision=0, idempotencyKey=K)
  ├─ Stage 1: CAS 0 → 1
  │    created@1
  │    task_created Event
  │    internal creation Record + complete Receipt
  │
  └─ Stage 2: CAS 1 → 2
       context_ready@2
       transition Event
       public K Record + complete build_task_brief Receipt
```

公开 Operation 可以顺序编排两个 Mutation；每个 Mutation 自身仍严格 `+1`。
Stage 1 后进程中断、Pulse Gate 失败或 Context Provider 失败，都留下可恢复
`created@1`。同 key 重试稳定命中同一 Task，并只尝试继续 Stage 2。

若 Stage 1 后发生合法 block/resume，Stage 2 从恢复后的当前
`created@N` 推进到 `context_ready@(N+1)`，不硬编码 revision 2。

### 2.2 Operation Journal 是事实，不是缓存

只持久化 `idempotencyKey → latest revision` 无法满足：

- Task 继续更新后，旧 key 仍返回最初提交的完整结果；
- 进程重启后不依赖内存 Map 判定 same-key replay/conflict；
- 重算完整 result digest，发现历史返回被篡改；
- 证明 Record、Receipt、Event、Task revision 属于同一 Mutation。

因此 `task_operation_journal` 保存：

- 从 Genesis 开始的全部 `IdempotencyRecordV1`；
- 与 Record 一一对应的完整 `TaskOperationReceiptV1`；
- Receipt 的完整结构化 result 与 canonical result digest；
- Envelope taskId/revision、Event ID、action、resultingStatus、Snapshot、
  repo/worktree identity 的交叉一致关系。

`.idempotency.json` 或内存索引只可加速 lookup，不具备可信事实地位。Store
必须从完整 Task Bundle 验证 Journal、Artifact、Event chain、Manifest 和
Snapshot dependency 后才能 replay。

### 2.3 原子提交与 durability ambiguity

Atomic writer 区分：

- `committed`：canonical files 与新 Manifest 已完成 rename；
- `durabilityConfirmed`：Manifest 所在目录 fsync 已确认。

若进程在 Manifest rename 后、目录 fsync 前失败，transaction marker 保留：

- recovery 读到新 Manifest：补 fsync Manifest parent，再清 marker；
- recovery 读到旧 Manifest：回滚 canonical Task files 与 Manifest。

读取方因此只会看到旧完整 revision 或新完整 revision，不会把“可能已经提交”
错误回报成可安全盲重试的普通失败。

### 2.4 兼容与迁移边界

- 新 writer 创建的 Task 必须从 revision 1 起带 Operation Journal。
- 旧 Task 缺少 Journal 时只能进入显式 legacy compatibility/migration 分支。
- History import 只允许显式 `historyImport` 路径验证连续历史；正常 live
  Mutation 必须严格 `expectedRevision + 1`。
- Import 会逐 revision、逐 action 重放 Task，校验 immutable parent、
  baseline、blocked/stale、rebase、supersession 等事实。
- D-22 不改变 Lifecycle 状态或允许转移；它新增 Task-scoped Artifact 与公开
  Operation 编排语义。

### 2.5 Repo Pulse 不可变历史与持续发布

Task Context descriptor 精确依赖构建时的 Repo Pulse ID、digest 和 Snapshot。
Store 因此不能用单一 descriptor 覆盖所有 Pulse revision。D-23 的实现是：

- old canonical envelope 写入 `.understand-code/pulses/<version-key>.json`；
- old descriptor 保留精确身份并切为 `historical/stale`；
- 新 current Pulse 在调用方复用逻辑 ID 时获得确定性版本身份；
- durable marker 覆盖 history、canonical 与 Manifest，Manifest 是 commit
  point；所有 Manifest mutation 先 drain Pulse/Task marker；
- stale 沿依赖图传递，但 historical bytes 仍通过旧 Task Pin 验证；
- current Pulse 恢复失败只精确标坏其 committed descriptor。

这使新 Snapshot、新 Pulse 和新 Task 可以在任意存量/终态 Task 后继续发布，
同时保留历史 Task 的可验证性。

## 3. Contract-to-implementation traceability

状态枚举：

- `verified locally`：最终 source tree 上存在针对性自动化证据。
- `capability locked`：该能力不对外暴露，调用在写入前 fail closed，并有明确
  Owner/Gate。
- `verified remotely`：对应提交已推送，并由 clean-checkout GitHub Actions
  对同一 source tree 完成质量门禁。

| ID | 目标/Contract | 实现定位 | 最终本地证据 | 状态 |
|---|---|---|---|---|
| WP4-C01 | Lifecycle 状态、Action、Guard 复用冻结 Contract，不增加捷径 | `packages/contracts/src/task.ts`；`packages/task-engine/src/mutation.ts` | Contracts lifecycle + Engine normal/blocked/stale/terminal integration | verified locally |
| WP4-C02 | `build_task_brief` 两阶段 `created@1 → context_ready@2` | `packages/task-engine/src/engine.ts` | build/restart/failure recovery/block-resume integration | verified locally |
| WP4-C03 | 每次 live commit 严格 `revision=expectedRevision+1` 且一条 Event | Contracts + Artifact Store + Engine mutation path | two-stage、lifecycle、history replay tests | verified locally |
| WP4-C04 | 同 create-scope/key 稳定 Task ID，跨重试不重复创建 | `packages/task-engine/src/ids.ts`；`engine.ts` | deterministic Stores + 20 路并发 integration | verified locally |
| WP4-C05 | 完整 Operation Journal/Receipt 是可信事实 | Contracts journal；Artifact Store bundle validation | digest/双向映射/corruption/large journal/restart | verified locally |
| WP4-C06 | lookup 先于 CAS；旧 key 回放首次结果 | Artifact Store + Task Engine | old build/update receipt after later revisions | verified locally |
| WP4-C07 | `context_ready` 不要求 Check/Verification；Verification 仍依赖 Check | `packages/artifact-store/src/store.ts` | optional Artifact、伪 current、snapshot cleanup regressions | verified locally |
| WP4-C08 | `resume_task` 只能恢复 `blockedState.resumeStatus` | Contracts invariants + Engine mutation | legal/illegal resume、wait-time drift integration | verified locally |
| WP4-C09 | Actor 来自 Host authorization context | `packages/task-engine/src/engine-types.ts`；`engine.ts` | actor/payload/capability/repo/worktree mismatch negatives | verified locally |
| WP4-C10 | actual Snapshot 发布后旧 Check/Verification 与 backlinks 失效 | Engine Snapshot capture + Store semantic validation | in-progress→check-required、drift、supersede cleanup | verified locally |
| WP4-C11 | Repo Pulse 历史可寻址，canonical 切换不破坏旧 Task Pin | Artifact Store layout/history transaction/recovery | multi-state Task、same-Snapshot rotation、restart、fault、corrupt-current regressions | verified locally |
| WP4-F01 | 无 Embedding 的可解释 Candidate Ranking | `packages/task-engine/src/ranking.ts` | exact/lexical/Graph/entry/test signals + stable tie-break | verified locally |
| WP4-F02 | scope/maxCandidates/tokenBudget/cursor 可控确定 | Ranking + Engine paging | pre-rank Host eligibility、empty scope、budget/query cursor | verified locally |
| WP4-F03 | stale/invalid Graph/Wiki/Evidence 不形成 fresh 结论 | Ranking + Context Builder | partial alignment downgrade、stale/unknown Claim propagation | verified locally |
| WP4-F04 | 有方向、有预算、有 Unknown Boundary 的 Impact | `packages/task-engine/src/impact.ts` | BFS/direction/depth/node/path/cycle/dangling/coverage tests | verified locally |
| WP4-F05 | 稳定 Claims 与双向 Evidence 引用 | Context Builder + IDs | assumption、boundary、freshness、reference integration | verified locally |
| WP4-F06 | 强类型 Action 推进 Task Lifecycle | Engine mutation | confirmations、block/resume、stale、supersede、historical replay | verified locally |
| WP4-F07 | Task Brief 分页读取，cursor 绑定 revision/section | `packages/task-engine/src/engine.ts` | paging + stale/malformed cursor integration | verified locally |
| WP4-F08 | 确定性 Markdown，显示边界且不泄露 Host path/source | `packages/task-engine/src/renderer.ts` | byte identity + POSIX/Windows/UNC/file URI redaction | verified locally |
| WP4-F09 | 真实 self-host Benchmark Dataset | fixture + `self-host-benchmark.test.ts` | 3 个声明目标均命中 ranking/reading/planned，预算与 digest 稳定 | verified locally |
| WP4-F10 | Repository provider 只发布可信 Source anchor | `repository-context-provider.ts` | comment/string/substring/duplicate/call-site/regex/symlink/path negatives | verified locally |
| WP4-I01 | 根 build/typecheck/test/clean 集成 | root scripts、lockfile、quality gate | 最终 `git diff --check && pnpm quality` exit 0 | verified locally |
| WP4-I02 | 远端 CI 与独立审查 | feature commits / GitHub Actions | Task Engine 与 Store 最终复审均无 P0/P1；最终修复树通过 run `30510573063` | verified remotely |

## 4. 最终本地自动化证据

以下结果来自全部 P0/P1 修复后的同一最终本地 source tree：

| 范围 | 结果 | 主要证明内容 |
|---|---|---|
| Contracts | 13 files / 132 tests；52 Schema、28 Fixture、14 distribution checks | Journal、Receipt digest、Lifecycle Guard、Verification exact time、Snapshot cleanup |
| Artifact Store | 12 files / 125 tests | CAS/Event、Task/Pulse atomic transaction、durability recovery、history import、large journal、semantic guards |
| Task Engine | 8 files / 60 tests | 两阶段恢复、并发、授权、完整 Lifecycle、ranking/impact/renderer/provider/self-host |
| Repository State | 67 passed / 1 skipped | Snapshot/Pulse 依赖不回归 |
| Root skill package | 10 files / 94 tests | Agent skill 与 CLI 不回归 |
| Core | 52 files / 923 tests | parser/graph/wiki/knowledge pipeline 不回归 |
| Dashboard | 50 files / 560 tests | 现有前端不回归 |
| Root gate | build、all typechecks、all tests、clean audit、`git diff --check` 全通过 | WP4 已纳入 monorepo 质量门 |

最终命令：

```bash
git diff --check
pnpm quality
```

预期且非失败的输出只有 Node `module.register` deprecation、Dashboard
localStorage experimental warning，以及 invalid YAML/JSON 负例的 parser stderr。

远端第一次运行 `30508509703` 暴露了两项仅在 clean checkout / 较慢 runner
可见的测试环境问题：self-host benchmark 依赖 ignored 本地产物，以及 20 路
并发测试沿用 1 秒 acquisition budget。修复提交 `6a6fd742` 没有放宽生产锁
或跳过测试，而是：

- 将最小 self-host Graph corpus 作为版本化 fixture 提交，同时继续用当前
  仓库源码核验符号、行区间、source bytes 与 digest；
- 只给 20 路并发压力用例设置 10 秒有界 lock budget，并在成功后断言 Task 与
  repository 两条 lock path 均已删除；
- 在本地连续运行 8 轮、每轮 20 并发，再执行完整 `pnpm quality`；
- 在 clean checkout 的 GitHub Actions run `30510573063` 重跑相同根级门禁，
  最终成功。

## 5. Required acceptance matrix

| Test ID | 场景 | 本地验证结果 | 状态 |
|---|---|---|---|
| AT-01 | 正常 `buildTaskBrief` | 同 Task `context_ready@2`；两条 Event；两组 Journal Record/Receipt；真实候选 | verified locally |
| AT-02 | Stage 1 后 Pulse/Context 失败再恢复 | 保留 `created@1`；同 key/new Engine 继续 Stage 2；不重复 Genesis | verified locally |
| AT-03 | 后续多次 update 后重试旧 build/update key | 返回首次完整 result/revision，current revision/Event 不变 | verified locally |
| AT-04 | same key different payload/Actor | `idempotency_conflict`，零写入 | verified locally |
| AT-05 | 20 路相同 key 并发创建 | 一个 Task、两条 committed Event/Receipt，无 lost update | verified locally |
| AT-06 | 进程重启/新 Store instance | 从 Manifest/full bundle/Journal 恢复并继续 Mutation | verified locally |
| AT-07 | Lifecycle optional Artifact | `context_ready` 无 Check/Verification 可读；伪 current/无 Check Verification 被拒 | verified locally |
| AT-08 | 正常 Lifecycle 与 Gate | Task Engine 到 `check_required` 生产路径已验证；Check/Verification Store 语义用受信任 fixture 验证，生产 API 留 WP5 | verified to WP4 boundary |
| AT-09 | block/resume | 保存并只恢复 exact status；等待期间 drift 进入 stale | verified locally |
| AT-10 | stale/unknown inputs | Ranking/Impact/Claim 降级，无 fresh conclusion，边界不丢失 | verified locally |
| AT-11 | pagination/cursor | budget 生效；cursor 绑定 query/task/revision/section；错误/过期拒绝 | verified locally |
| AT-12 | Markdown renderer | byte deterministic；显示 freshness/unknown/recovery/truncation；无 Host path/source | verified locally |
| AT-13 | large Journal | 超过 2000 条历史后旧 key 可 replay，Journal 不被缓存截断 | verified locally |
| AT-14 | fault injection | pre/post Manifest crash、durability ambiguity、Journal corruption 均 fail closed/recover | verified locally |
| AT-15 | Benchmark Dataset | 固定 Snapshot/Task 的 ID、候选、Impact、digest 稳定，3 个 self-host 目标命中 | verified locally |
| AT-16 | root closeout | build/typecheck/all tests/schema/fixtures/diff/clean audit 全过 | verified locally |
| AT-17 | remote/independent closeout | Task Engine 与 Store 最终复审无 P0/P1；分层 commits 已推送；最终修复树的 clean-checkout CI 成功 | verified remotely |

## 6. Capability locks、P2 与 Owner/Gate

这些项目不阻断 WP4，但不得被文档、API 或 UI 误报为已完成：

| 项目 | 当前事实 | Owner | Gate |
|---|---|---|---|
| Production `checkChange` / `recordVerification` | Store Contract/语义已验证，Task Engine 未暴露生产 API | WP5 Change Intelligence | MCP/Host 宣称完整 Task→Check→Verification 闭环前 |
| `refresh_task_context` / `rebase_task` | `TASK_ENGINE_CAPABILITIES` 标为 unavailable；公开 update 在任何写入前返回 `capability_unavailable` | WP5 | stale recovery 对外开放前 |
| `mutation.artifactIds` exact projection | 当前完整性与引用安全已冻结，exact projection 集合语义仍待版本化钉死 | WP8 Contracts hardening | V1 release candidate / compatibility review |
| legacy no-Journal Task | 新 writer fail closed；没有生产迁移工具和 Receipt replay 保证 | WP8 Migration | 升级/兼容承诺发布前 |
| Repo Pulse `migrateJson` | 生产 `persistArtifact` 已使用 D-23 历史事务；显式迁移入口尚未统一，禁止替换已有 Task Pin 的 Pulse | WP8 Migration | Repo Pulse schema/data migration 对外启用前 |
| Store upgrade fixture | `initialize` 会创建新增 history/transaction 目录，但旧 Store 缺目录的显式升级 fixture 留待 hardening | WP8 Migration | 升级兼容声明前 |
| 跨进程 CAS stress | 已有真实第二进程 lock exclusion 与同进程并发 CAS；多进程 writer stress 留待 hardening | WP8 QA | Beta concurrency gate |
| Snapshot allow/deny 扩展矩阵 | 高风险 live/history 分支与完整历史 replay 已覆盖；逐 Action 全排列和精确错误文案留待 hardening | WP8 QA | V1 compatibility review |
| 24-task Alpha Gold Set | WP4 只有最小真实 self-host benchmark，不等于 Gold Set 激活 | WP8 / M2 G2 | Alpha KPI 判定前 |

## 7. 独立审查结论

Task Engine 最终复审已经确认原始 3 个 P0 与后续 P1 全部关闭，无新 P0/P1。
重点复核项包括：

- provider/store canonical root binding；
- actual Snapshot 正确时序与零写入失败路径；
- 所有普通状态的 drift→stale；
- partial Snapshot、Graph/Pulse alignment 与 pre-rank eligibility；
- Source anchor 对 comment/string/regex/duplicate/call-site 的 fail closed；
- capability lock 与 self-host 三目标命中。

Artifact Store reciprocal audit 发现并已关闭：

- committed-but-not-durable Task marker 未在其它 Manifest mutation 前排空，
  可能在后续恢复时误回滚已经发布的 Task revision；marker unlink 的 ENOENT
  重试及后续空目录 drain 都必须再次 fsync parent；
- 普通 Lifecycle Action 未禁止 Snapshot delta，可把旧 Context payload 原样
  重封到新 Snapshot 并绕过 normal→stale；live 与 historyImport 都必须使用
  Action/status allowlist；
- 单一 canonical Repo Pulse 替换会删除旧 descriptor，而已有 Task 仍精确 pin
  旧 Pulse 的 ID/digest/Snapshot；因此已有 Task 后新 Snapshot 可以发布、新
  Pulse 却会永久失败，终态 Task 也无法通过 stale sweep 解锁。旧 Pulse 必须
  历史可寻址，并在原子切换 current Pulse 时保留旧 pin；
- `verification_required → check_required` 必须有真实 actual Snapshot 变化；
  `rebase_task` 必须真正改变 baseline，两个约束都要覆盖 live/historyImport。
- canonical Pulse 与备份同时损坏时，只能精确标坏 current descriptor，完整
  historical Pulse 及其旧 Task Pin 仍须可验证。

修复后的 focused gate、Artifact Store 125/125、Task Engine 60/60 与根级
`pnpm quality` 均通过。最终 focused re-audit 确认无新增 P0/P1；Local Gate
和远端 Gate 均已关闭。第 6 节 P2 已有明确 Owner/Gate，不阻断 WP4，也不得
被包装成 WP4 已交付能力。

## 8. WP4 完成判定与关闭记录

以下关闭条件已全部满足：

- D-22～D-23 在 PRD 与 G0 Freeze Record 中一致；
- Journal、Store 与 Engine 语义一致；
- AT-01～AT-16 本地证据通过；
- 最终测试不依赖进程内状态来证明 replay；
- Check/Verification 的 WP5 边界被如实保留；
- 分层 commits 全部 push，远端 CI 基于对应 source tree 成功；
- 独立审查无未关闭 P0/P1；
- 用户未跟踪的 QA/历史 PRD/site 文件未被暂存或提交。

| 证据 | 值 |
|---|---|
| Contracts/Store commit | `862c5061611dd812ef07a58259c19e8fcb5a189d` |
| Task Engine commit | `81d55760e2afbce3e35dea472459653f126ceb6a` |
| CI remediation commit | `6a6fd742bb7ca55a23fb6a5a17d067d7f2396fc6` |
| Feature tree hash | `cfe271908a8a1345dab6b823cc06aeef37e8b441`（`6a6fd742^{tree}`；不含本证据文档的后继 tree） |
| Contracts/Store CI | run `30508030920`，success |
| 首次 Task Engine CI | run `30508509703`，failure；失败原因与修复见第 4 节，不作为通过证据 |
| 最终 feature tree CI | run `30510573063`，success；head SHA 精确匹配 `6a6fd742...` |
| 本地最终门禁 | `git diff --check && pnpm quality`，exit 0 |
| Independent audit | Task Engine passed；Artifact Store passed；no open P0/P1 |
| 用户文件保护 | 未跟踪的 `docs/prd/.qa/`、历史 PRD 产物、`assets/`、builder、`site/` 均未进入任何 WP4 commit |

本证据文档是 feature tree 之后的 evidence-only closeout，不反向修改或冒充
上表的已验证 tree。第 6 节 Owner/Gate 继续有效，避免把 WP5/WP8 能力提前
包装成 WP4 产物。
