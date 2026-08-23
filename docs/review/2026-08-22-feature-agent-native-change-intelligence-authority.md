# feature/agent-native-change-intelligence-authority Review Brief

> 生成时间：2026-08-23 CST
> 分支：`feature/agent-native-change-intelligence-authority`
> 基于 commit：`0cffd9c feat(task-engine): surface bounded staged deletions in checks`

## 背景与动机

Step15 已分别证明纯 staged added/modified 与 staged modified/deleted 批次，但真实用户经常在一次
`git add` 中同时新增、修改和删除不同文件。旧的 deletion profile 刻意排除了 added，因此这种完全由
Index 权威约束的三类组合仍会整批 `unknown`。

本切片把既有 staged-deletion profile 最小扩为 unique all-staged added|modified|deleted（至少一条
deletion），不新增公开 contract、持久化 schema或 matcher 语义。新增文件仍不会因为 current Graph
出现节点就自动满足旧计划；正常 Brief 只计划原有 modified symbol，所以真实 Check 应得到一个
`planned_completed` 与两个独立 blocking `unplanned_change`（added、deleted）。

## 改动策略

- `stagedDeletedChanges` 仍要求 actual Snapshot complete、1–16 个唯一路径、全部 source=`staged`、至少一条
  deletion；允许集合从 modified|deleted 扩为 added|modified|deleted。
- added/modified 必须有 exact `contentDigest`，deleted 必须没有 actual-side digest。无 deletion 的
  added/modified 仍优先进入旧 `stagedChanges`，其 predicate、reason与稳定 ID 输入不变。
- staged added 复用既有 HEAD tree absence + Index/worktree/Snapshot exact bytes；modified 复用 baseline HEAD
  blob + Index/worktree/Snapshot exact bytes；deleted 复用 Index exact-empty + worktree absence + baseline HEAD
  bytes。三类共同使用相同的 pre/post full live Snapshot fence、32 MiB aggregate与 1024 observations上限。
- 任一重复路径、same-path replacement、mixed source、rename/copy/conflict、路径/预算/Git失败或 live drift
  均 whole-analysis `unknown`：单一 global boundary覆盖全部 actual IDs，且 `hunks=[]`、`deletedFiles=[]`。
- `change-intelligence` 无需修改。既有 matcher继续让 exact planned modified hunk完成；Brief创建时不存在的
  added path形成 current Source Evidence的 blocking unplanned；deleted path形成 baseline-bound changed
  Evidence的 blocking unplanned，绝不成为 `planned_completed`或 `possible_omission`。
- packed user vertical复用既有 staged happy repo与同一个 Chrome profile，不新增 Browser矩阵；同时保留
  原 unstaged deletion stale/no-source纵切。

## 改动范围

| 模块/职责 | 文件 | 做了什么 |
|---|---|---|
| Repository analysis | `packages/task-engine/src/repository-context-provider.ts` | 在既有 bounded staged-deletion profile中允许 digest-bound staged added |
| Provider regression | `packages/task-engine/test/repository-context-provider.test.ts` | 真实 add+modify+delete complete、determinism、drift与same-path replacement fail-close |
| Engine regression | `packages/task-engine/test/engine.integration.test.ts` | 独立组合测试锁定1 completed + 2 unplanned及三类Evidence |
| Packed user vertical | `packages/preview/test/workbench-browser-packed.test.mjs` | 现有 staged happy扩为三路径，真实Verification与同一Workbench会话验证added/deleted语义 |

公开 contracts、`engine-types`、`change-intelligence`、MCP shape、artifact schema、Dashboard production与生命周期
实现均未修改。

## Review 重点与结论

1. **三类authority可组合而不降级** — 每种kind继续走已独立证明的bytes/absence逻辑；整批仍受同一个
   actual Snapshot及pre/post full fence约束，不以Graph或路径推断Index事实。
2. **旧profile与稳定ID不漂移** — 无delete的staged add/modify仍先命中旧profile；旧top-level
   unsupported/unsafe/budget reason与成功ID输入无diff。新增文案只描述新profile的kind allowlist。
3. **same-path replacement明确fail closed** — 真实Git产生同路径 `staged/deleted` + `untracked/added`
   （另有 staged modified）；fresh Repository Snapshot被整批判为单一 `unsupported_source`，无部分成功。
4. **新文件不会冒充计划完成** — Engine组合只计划已有TaskHandler；modified精确完成，added/deleted各自
   blocking unplanned，且actual IDs互斥、没有cannot_determine或possible_omission。
5. **Evidence路由准确** — planned modified与unplanned added都绑定actual Snapshot/current source/node/hash；
   deletion只绑定baseline Snapshot/HEAD/old range/hash、freshness changed、nodeIds=[]。
6. **真实candidate authority** — packed v1 overlay包含本轮provider production与packed gate，v2从该clean
   ephemeral commit派生；若tgz仍带旧provider，三路径Check会whole unknown并击穿exact Finding/Evidence断言。

独立 contract 与 change-intent 终审一致：P0 0、P1 0、current-path executable P2 0、
blocking Test Gap 0；结论为 Effective / SAFE TO COMMIT。

## 测试情况

**已通过：**

- task-engine provider focused：14/14 passed，14.12 秒。
- task-engine engine focused：33/33 passed，55.92 秒。
- `pnpm --filter @understand-code/task-engine typecheck`
- `pnpm --filter @understand-code/task-engine test`：包含 fresh build，8 files / 76 tests passed，55.84 秒。
- `node --check packages/preview/test/workbench-browser-packed.test.mjs`
- scoped `git diff --check`
- `pnpm --filter @understand-code/preview typecheck`
- `pnpm --filter @understand-code/preview build`（fresh dist）
- 唯一真实 packed Browser门禁：
  `UNDERSTAND_CODE_REQUIRE_REAL_BROWSER=1 pnpm --filter @understand-code/preview test:workbench-browser`
  - 受控最终运行：1 passed / 0 failed / 0 skipped，230.91 秒；
  - v1 tgz：87 entries，`sha256:73e2b9b569704c68fd24c680dd6ab84f201a4b3e45a803e226c69b6988eded22`；
  - v2 tgz：87 entries，`sha256:8d3333ddd86e5a968009cd77997f2959d620995c48f29e0aa473d5488df3464b`。

第一次同门运行在659.7秒时由v2 assembler返回脱敏 `verification_failed`；该次没有保留安全phase artifact，
因此不能把根因过度定性。冻结输入未改变，经终审允许的唯一受控重跑完整通过；只读进程观察确认重跑中的
v2 build持续推进并正常越过旧失败点。该事件作为非阻塞gate-observability residual记录；若再现，先补只输出
安全阶段码的candidate诊断，不盲目重跑、不提高production timeout。

未运行 Plugin Host、root full或cross-platform矩阵：本切片不修改这些surface，唯一packed E2E已从真实
candidate覆盖MCP→Check→Evidence→Workbench、真实外部Verification与既有upgrade/rollback链。

## 失败轨迹与最小修复

1. Pre-focused review发现三路径Snapshot不能复用先前两路径Snapshot的ordinal-based change IDs。最终测试从
   fresh三路径Snapshot分别derive并exact-assert added/modified/deleted，再仅使用fresh IDs。
2. 初版same-path replacement使用schema-valid synthetic Snapshot，未证明producer真实shape。最终改为真实
   `captureFencedSnapshot`，锁定Git/Repository State发布的 staged deleted + untracked added同路径组合。
3. provider focused首次13/14失败，因为测试把replacement错误期望为 `unstaged/added`。真实porcelain包含独立
   `?` record，public Snapshot正确为 `untracked/added`；只修两处test expectation，production未改；同一
   focused随后14/14通过。
4. packed heavy首次generic失败见上一节。未修改产品/fixture/timeout；同一冻结输入的唯一受控重跑通过。

这些修复均未放宽production边界或弱化断言。

## 可声明与不可声明

**可声明：**

- 当前Alpha能对1–16个unique all-staged added|modified|deleted变化（至少一条delete）进行 bounded、
  Snapshot-bound分析。
- added、modified、deleted分别由HEAD/Index/worktree/Snapshot的对应exact proof组成，并共享full live fence；
  任一漂移或unsupported组合都会whole-analysis fail closed。
- 正常Brief下，planned modified可以精确完成；后来新增与删除的文件保持独立blocking unplanned，Evidence
  分别为current actual与baseline changed。
- 真实tgz/MCP链完成Check、两项Finding acceptance与外部Verification；同一Chrome会话显示added current
  source/Graph，并对deleted Evidence固定stale/evidence_stale、无source/Graph。

**不可声明：**

- 不支持或配对same-path replacement、rename/copy、mixed staged/untracked/unstaged、committed delta、
  conflict、binary、mode-only、partial/oversize或Graph unavailable组合；继续unknown。
- 本切片不授权planned deletion，不证明path-only/new-file计划完成、possible omission或五维Completeness。
- 结果仍为 `legacy_summary`，不是 `evidence_backed_v1`或formal structured `diff_hunk`。
- 不证明Provider Authority、execution fence或strong write；`strongWrites`继续locked。
- 两个candidate仍是当前本机tuple的unsigned Alpha测试产物，不证明Release、signature、SBOM、provenance、
  reproducibility、CI same-SHA或cross-platform。
- 首次heavy generic失败的精确内部stage/root cause未被本切片证明。

## 结论

🟢 Effective。真实 all-staged add+modify+delete 批次现在能在各kind的精确Git authority与统一Snapshot fence下
完成bounded Change Check：只完成已计划modified，added/deleted保持独立blocking unplanned；所有mixed、
same-path replacement与live drift继续整批fail closed。旧staged与deletion路径、Evidence语义、真实Workbench及
lifecycle未回归。可以精确提交。
