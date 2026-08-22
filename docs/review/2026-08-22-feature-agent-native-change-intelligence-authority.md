# feature/agent-native-change-intelligence-authority Review Brief

> 生成时间：2026-08-22 16:42 CST
> 分支：feature/agent-native-change-intelligence-authority
> 基于 commit：4373c1f fix: fail closed on legacy empty checks

## 背景与动机

单一路径的 unstaged/staged 修改以及 bounded staged added 已能产生 Snapshot-bound
Change Check，但常见的“修改一个已跟踪文件，同时新增一个未跟踪文件”仍被整体降为
unknown。该组合经公开 `refresh_index` 可达，且 Snapshot 已为安全 untracked 文件保存
content digest；它是 Step 15 当前最短的真实 availability 缺口。

本切片只扩展 Alpha source coverage，不改变 public contract，也不宣称 formal
`evidence_backed_v1`、execution fence 或 strong writes。

## 改动策略

- 当 actual Snapshot 包含 untracked change 时，启用 bounded live profile：1–16 个
  唯一路径，全部只能是 `untracked added` 或 `unstaged modified`，并且至少一个
  untracked；staged/mixed/其他 source/kind/duplicate/超限整批 unknown。
- 分析前后各核对 exact HEAD 与 Snapshot-bound global relevant Index digest，捕获同
  bytes 被 `git add`、HEAD 漂移或 Index 变化。
- 每个路径都做稳定 no-follow worktree 读取并要求 bytes digest 与 Snapshot exact；
  added 还必须由 exact HEAD 的 literal `ls-tree` 证明不存在，modified 从 exact
  `<HEAD>:path` 读取 baseline blob。
- 复用确定性 line diff、Graph symbol anchor、actual Snapshot content hash 与 Source
  Evidence 管线。
- 全批次预算固定为 32 MiB semantic bytes 与 1024 hunks；任一路径、Graph、预算或
  fence 失败都丢弃已生成 hunks，返回一个覆盖全部 actual IDs 的 global boundary。
- pure staged 与 pure unstaged 路径保持原语义和原 boundary reason，避免稳定
  Evidence/Finding ID 漂移。

## 改动范围

| 模块/职责 | 文件 | 做了什么 |
|---|---|---|
| Repository provider | `packages/task-engine/src/repository-context-provider.ts` | bounded live profile、HEAD/Index fences、aggregate fail-closed |
| Focused regression | `packages/task-engine/test/repository-context-provider.test.ts` | 逆序双路径 happy 与同 bytes `git add` Index drift whole-unknown |
| Packed E2E | `packages/preview/test/workbench-browser-packed.test.mjs` | 真实 unstaged+untracked Snapshot→Check→accept→Verification 纵切 |

## Review 重点

1. **来源边界** — 只有 untracked added + unstaged modified 的 bounded 集合可以成功；
   staged 混入或其他 change kind 必须 whole unknown。
2. **Snapshot 权威** — worktree、Snapshot digest、HEAD baseline 与 global Index fence
   必须同时成立，不能只看当前文件 bytes。
3. **全批次原子失败** — 后排序路径或 post-fence 失败时，先前 hunks 不得泄出为
   partial success。
4. **稳定兼容** — existing pure staged/unstaged reason 与 ID 语义不得变化。
5. **用户语义** — 新文件必须是 blocking `unplanned_change`；只有 foo 是
   `planned_completed`，随后必须显式 accept finding 才能继续 Verification。

## 已识别风险

未发现 P0、P1、current-path executable P2 或 blocking Test Gap。

非阻塞残余：本实现证明持久 actual Snapshot 对所列路径的 exact bytes 与前后
HEAD/Index continuity，不是全局 worktree/untracked execution fence；分析后新增的其他
live 变化仍不构成 strong current-state 证明。staged+untracked、staged+unstaged、
delete/rename/conflict/binary/超预算继续 fail closed。Provider authority、formal
Completeness 与 `strongWrites` 保持 locked。

## 测试情况

- Repository provider focused：11/11。
- Task Engine typecheck/build 与 package tests：70/70。
- Fresh Preview typecheck/build 通过。
- 唯一 packed Chrome E2E：1/1，0 skip，33.77s。
- packed E2E 保留 wrong-hunk、staged-added、Workbench 与 lifecycle 既有链路，并新增
  真实 unstaged+untracked verified 纵切。
- tgz SHA-256：`44c10323f3f5486a7ecf4a2d2d49c8593142bbdb751253cf308af11477d449c7`；87 entries。
- final `node --check` 与 scoped `git diff --check` 通过。

## 结论

🟢 Effective。常见的 unstaged 修改加 untracked 新文件现在可产生精确、
Snapshot-bound 的 planned/unplanned Findings 与 Source Evidence；任一不确定条件仍整批
fail closed，且没有改变既有 staged/unstaged 语义。可以精确提交。
