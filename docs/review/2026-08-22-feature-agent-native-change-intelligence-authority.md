# feature/agent-native-change-intelligence-authority Review Brief

> 生成时间：2026-08-23 CST
> 分支：`feature/agent-native-change-intelligence-authority`
> 基于 commit：`140255b feat: analyze intent-to-add changes`

## 背景与动机

权威 Step15 要求 Change Check 对当前可达的 Git 变化保持“能精确证明才陈述，不能证明就阻塞”。
用户删除一个已跟踪文件后，Snapshot 已能诚实发布 `unstaged/deleted`，但 Task Engine 只能把删除归入
泛化的 `cannot_determine`，既不能指出具体被删路径，也不能提供可追溯的基线证据。

本切片增加一个内部、有限、fail-closed 的删除 observation。删除不是 actual-side hunk，也不会被判成
`planned_completed`：即使 Brief 中存在同路径 plan，系统仍同时产生 blocking `cannot_determine` 与独立
blocking `unplanned_change`。证据只绑定基线源码；Workbench 明确显示 stale，不读取已不存在的 live 文件。
公开 contracts、MCP shape、持久化 artifact schema 与 `legacy_summary` profile 均不改变。

## 改动策略

- 仅当 actual Snapshot 含删除、总路径数为 1–16、路径唯一，且全集只包含
  `unstaged/modified`（有 digest）或 `unstaged/deleted`（无 digest）时启用 bounded deletion profile。
- 任意 staged、untracked、committed、conflict 或其他 kind 的删除混合都会整批 `unknown`；不会保留部分 hunk。
- baseline 与 actual 必须 complete、同 repository/worktree、同 HEAD，且 baseline clean；两者的
  `indexDigest` 必须完全相等。
- 每个删除路径必须通过安全路径校验；worktree 中必须确实不存在；HEAD blob 必须与当前 Index stage-0
  blob 完全相同。删除 observation 的旧行范围与 SHA-256 只从该基线 blob 计算。
- 复用 full live Snapshot pre/post fence，精确比较 root、identity、HEAD、Index/worktree/untracked/ignore
  digests 与 snapshotId。删除后重建文件、Index 漂移或任何全局 live-state 漂移都会整批返回 global
  boundary、全部 actual IDs、空 hunks 与空 deletion observations。
- 复用每文件 8 MiB、整批 32 MiB 与 1024 个 hunk/observation 上限。
- 删除 Finding 永远是独立 blocking `unplanned_change`；同路径 legacy plan 只得到
  `cannot_determine`，不产生 `planned_completed` 或 `possible_omission`。
- Source Evidence 为 `observed/changed`，绑定 baseline Snapshot、baseline HEAD、旧行范围与 hash，且
  `nodeIds=[]`。对应 Finding Claim 为 `observed/supported/changed`，仍绑定 actual Snapshot。
- Workbench 在文件读取前即因 Snapshot/freshness 不匹配返回 `stale/evidence_stale`，不返回 source
  bytes、源码行或 Graph action；MCP `get_evidence` 仍可读取完整基线元数据。

## 改动范围

| 模块/职责 | 文件 | 做了什么 |
|---|---|---|
| Internal analysis seam | `packages/task-engine/src/engine-types.ts` | 新增可选 `TaskDeletedFileObservation` 列表，保持旧 custom provider 源兼容 |
| Repository analysis | `packages/task-engine/src/repository-context-provider.ts` | 新增 bounded unstaged deletion profile、HEAD/Index/worktree 证明、预算与全量 Snapshot fence |
| Finding/Evidence projection | `packages/task-engine/src/change-intelligence.ts` | 校验 deletion coverage，生成独立 blocking Finding、baseline-bound changed Evidence 与 changed Finding Claim |
| Provider regressions | `packages/task-engine/test/repository-context-provider.test.ts` | 真实 modified+deleted happy path，以及 Index mismatch、path recreate、unsupported-source whole-unknown |
| Engine regression | `packages/task-engine/test/engine.integration.test.ts` | 锁定 exact two Findings、无 completion/omission、Evidence/Claim 双向绑定及 freshness 语义 |
| Packed user vertical | `packages/preview/test/workbench-browser-packed.test.mjs` | 真实删除 Snapshot→Check→Evidence→Workbench stale/no-source，并把三项 production 源绑定进候选 |

## Review 重点与结论

1. **删除不是伪 hunk** — provider 用独立 internal observation 表达旧文件事实；matcher 不消费它，也不能据此
   宣称计划完成。
2. **基线与当前态严格分离** — Evidence 只绑定 baseline；Claim 标记 `changed`。Workbench 在 live read 前
   fail closed，因此不会把历史字节伪装成当前源码。
3. **授权语义保守** — 同路径 plan 仍不能证明“已授权删除”；必须保留 `cannot_determine`，删除另行作为
   blocking unplanned Finding 处置。
4. **Whole-analysis fail closed** — baseline/actual Index 不一致、删除文件重现、任意 fence/预算/path/来源
   失败，都清空 hunks 与 observations并覆盖全部 actual IDs。
5. **旧结果兼容** — `deletedFiles` 对 exported provider seam 保持 optional，consumer 统一 normalize；只有
   deletion Finding 的 stable-ID payload 加入 deletion IDs，非删除 Finding/Evidence/Claim ID 与旧 reason
   字符串不漂移。
6. **真实候选 authority** — packed E2E 的 ephemeral v1 commit明确 overlay 三个 production 源；v2 从该
   commit派生，最终真实 tgz运行的是本轮实现而不是 shared HEAD 的旧字节。

独立 contract 与 change-intent 终审一致：P0 0、P1 0、current-path executable P2 0、
blocking Test Gap 0；结论为 Effective / SAFE TO COMMIT。

## 测试情况

**已通过：**

- task-engine provider focused：13/13 passed；真实 deletion happy path与三类 fail-closed regression均执行。
- task-engine engine focused：31/31 passed；删除 Finding、Evidence、Claim及 bundle invariant均通过。
- `pnpm --filter @understand-code/task-engine typecheck`
- `pnpm --filter @understand-code/task-engine test`：8 files / 73 tests passed。
- `node --check packages/preview/test/workbench-browser-packed.test.mjs`
- scoped `git diff --check`
- `pnpm --filter @understand-code/preview typecheck`
- `pnpm --filter @understand-code/preview build`（fresh dist）
- 唯一真实 packed Browser 门禁：
  `UNDERSTAND_CODE_REQUIRE_REAL_BROWSER=1 pnpm --filter @understand-code/preview test:workbench-browser`
  - 1 passed / 0 failed / 0 skipped，182.35 秒；
  - v1 tgz：87 entries，`sha256:0d8c2a0da28dfb57554f618f36088e19128e8e1edc12a989fb22edff0cfa1542`；
  - v2 tgz：87 entries，`sha256:561858953935983f96b21f4f21aff5bb483c928ca32486af2ad5aee9b8d7ec71`。

**首错与修复：**

- provider focused 首次暴露旧 exact expected 未包含内置 provider 新增的显式 `deletedFiles: []`；只更新该
  exact expected，没有改成宽松 matcher。
- engine focused 首次触发 bundle invariant：current observed Claim不能由 changed Evidence支撑。最小修复
  只把 deletion-backed Finding Claim改为 `freshness:"changed"`；非删除 Claim字节与稳定 ID不变。随后
  selector又按 `kind`、Finding双向引用与唯一性锁定真正的 Finding Claim，避免误取 goal backlink。
- packed Browser 首次到达删除 `get_evidence` 后，暴露测试误写 `.missing`；公开 strict contract一直是
  required `missingEvidenceIds`。仅改单行断言，未修改 schema/handler/production，然后从头重建两份候选，
  同一完整门禁通过。

## 可声明与不可声明

**可声明：**

- 在 clean baseline、same HEAD+Index、完整 pre/post Snapshot fence 下，当前 Alpha 能精确观察 1–16 个
  bounded unstaged tracked text deletions，并可与同批 unstaged modified变化共同分析。
- 删除路径、旧行范围与 hash绑定 baseline HEAD/Index bytes；worktree absence与 Snapshot身份得到精确证明。
- 同路径 legacy plan不会被误报完成；删除形成独立 blocking unplanned Finding，Source Evidence 与 Finding
  Claim保持明确的 changed freshness。
- `get_evidence` 可追溯基线元数据；真实 Chrome Workbench 对已删除文件固定返回 stale/evidence_stale，
  不读取或呈现 live source/Graph。
- 当前本机 tuple 的两份真实 unsigned Alpha candidate 均包含本轮 production字节，既有 ITA、untracked、
  staged、managed upgrade/rollback 与 Workbench 生命周期未回归。

**不可声明：**

- 本切片不授权 planned deletion，不生成 formal actual deletion hunk，也不证明 `possible_omission` 或五维
  Completeness。
- 不支持 staged deletion、rename/copy、committed delta、conflict、binary、empty、超预算、Graph ambiguity
  或其他 unsupported mixed profiles；这些情况继续 whole-analysis unknown。
- Workbench不会恢复/展示已删除历史源码；Evidence不是 current source或 current Graph proof。
- 结果仍是 `legacy_summary`，不是 `evidence_backed_v1` 或 structured `diff_hunk`。
- 两个 candidate仍是当前本机 tuple 的 unsigned Alpha 测试产物；不证明 RC/Release、signature、SBOM、
  SLSA/trusted provenance、reproducibility 或 cross-platform。
- 不证明 current execution fence、Provider Authority 或 strong write；`strongWrites` 继续 locked。

## 结论

🟢 Effective。当前 Alpha 能把受严格边界保护的 unstaged tracked-file deletion从泛化 unknown提升为可追溯、
baseline-bound、blocking的删除 observation，同时明确拒绝把它当作已授权计划完成。任一 identity、Index、
worktree、来源、预算或 Snapshot fence不确定性仍整批 fail closed；旧 profile、稳定 ID与生命周期未回归。
可以精确提交。
