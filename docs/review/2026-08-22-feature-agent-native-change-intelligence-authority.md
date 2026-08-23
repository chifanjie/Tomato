# feature/agent-native-change-intelligence-authority Review Brief

> 生成时间：2026-08-23 CST
> 分支：feature/agent-native-change-intelligence-authority
> 基于 commit：31495852830e61bda2482b0680242fae1ad2d1e5 feat(task-engine): analyze heterogeneous staged batches

## 背景与动机

Step15 已分别支持 pure live-untracked、intent-to-add、unstaged deletion，以及 all-staged
added|modified|deleted。真实用户还会在同一未暂存批次中删除旧文件、创建不同路径的新文件，并继续修改
tracked 文件。此前 untracked 与 deletion 的早期 guard 会把这种组合整批判为 unsupported。

本切片新增一个内部、互斥、bounded 的 live profile：至少一个 untracked added、至少一个 unstaged
deleted，可含 unstaged modified。它保持 clean baseline Index 不变，复用现有逐路径 authority 和完整
Snapshot fence；不新增公开 contract、artifact schema、matcher 或 MCP shape。

## 冻结合同

- actual Snapshot 必须 complete，并与 baseline 具有相同 repository、worktree、HEAD；批次为 2–16 个
  unique paths。
- 至少一个 untracked/added 且有 contentDigest，至少一个 unstaged/deleted 且无 actual-side digest；
  其余仅允许 unstaged/modified 且有 digest。
- 禁止 staged、unstaged/added（ITA）、committed、conflict及其他 kind/source。
- actual.indexDigest 必须精确等于 clean baseline.indexDigest。
- added 路径必须由 baseline HEAD tree exact absence 与安全 worktree/Snapshot digest证明。
- modified 路径必须由 baseline HEAD blob 与安全 worktree/Snapshot digest证明。
- deleted 路径必须由 baseline HEAD blob、当前 Index exact相同bytes与worktree absence证明。
- 整批共享 pre/post full live Snapshot fence、单文件/32 MiB aggregate语义预算与1024 observations上限。
- 任一路径、Graph、预算、Git、Index、worktree或Snapshot fence失败均 whole-analysis unknown：单一
  global boundary覆盖全部 actual IDs，hunks与deletedFiles均为空。

旧 pure live-untracked、ITA、pure live-deletion、staged profiles的predicate、precedence、reason与稳定ID
输入均保持不变。

## 改动范围

| 模块/职责 | 文件 | 做了什么 |
|---|---|---|
| Repository analysis | packages/task-engine/src/repository-context-provider.ts | 新增互斥 liveDeletedUntrackedChanges profile并接入现有authority/fence/budget/whole-unknown路径 |
| Provider regression | packages/task-engine/test/repository-context-provider.test.ts | 真实Git三路径happy、determinism、ITA排除、baseline Index mismatch及live drift fail-close |
| Engine regression | packages/task-engine/test/engine.integration.test.ts | 锁定1 planned modified完成、added/deleted各自blocking unplanned与current/changed Evidence |
| Packed user vertical | packages/preview/test/workbench-browser-packed.test.mjs | 扩既有unstaged deletion Task，同一MCP/Browser完成accept、外部Verification、deleted stale与untracked Source→Graph |

公开 contracts、engine-types、change-intelligence、MCP schema、Dashboard production和生命周期实现均未修改。

## Review重点与结论

1. Authority保持单一 — profile要求Index精确等于clean baseline，只组合worktree-authoritative live变化；
   ITA或staged变化不能进入。
2. 三种路径proof可组合 — added验证HEAD absence，modified验证HEAD/worktree，deleted验证HEAD=Index且
   worktree absent；整批仍受同一actual Snapshot双fence约束。
3. Whole-fail不是partial — schema-valid baseline仅改变indexDigest时，测试精确得到单一global
   content_changed、全部fresh IDs、无filePath/hunks/deletedFiles；Index、worktree、untracked inventory和
   Snapshot-ID漂移同样整批收口。
4. A2明确排除 — 同一真实fixture执行 git add -N 后，producer发布unstaged/added+deleted+modified；
   结果为单一global unsupported_source，不会误入本profile。
5. Finding/Evidence诚实 — Engine证明planned modified可完成；后来新增与删除各自blocking unplanned。
   added/modified Evidence绑定actual Snapshot/current source/node/hash，deleted Evidence绑定baseline
   Snapshot/HEAD/old range/hash、freshness changed、nodeIds为空。
6. 删除计划不被冒充完成 — packed deletion Task精确得到同path cannot_determine、独立deletion unplanned、
   独立untracked unplanned，无planned_completed或possible_omission。
7. 真实candidate authority — V1 overlay包含本轮provider production和packed gate，clean ephemeral commit
   经assemble/verify/cold install；若tgz缺少新profile，exact three-Finding断言会失败。

独立contract审查和change-intent终审一致：P0 0、P1 0、current-path executable P2 0、
blocking Test Gap 0；结论为Effective / SAFE TO COMMIT。

## 测试情况

已通过：

- provider focused：1 file / 15 tests，15.65秒。
- engine focused：1 file / 34 tests，55.73秒。
- pnpm --filter @understand-code/task-engine typecheck。
- pnpm --filter @understand-code/task-engine test：包含fresh build，8 files / 78 tests，57.68秒。
- node --check packages/preview/test/workbench-browser-packed.test.mjs。
- scoped git diff --check。
- pnpm --filter @understand-code/preview typecheck。
- pnpm --filter @understand-code/preview build（fresh dist）。
- 唯一真实packed Browser门禁：
  UNDERSTAND_CODE_REQUIRE_REAL_BROWSER=1 pnpm --filter @understand-code/preview test:workbench-browser
  - 1 passed / 0 failed / 0 skipped，224.452秒；
  - v1 tgz：87 entries，sha256:c7ae6912d2ef49e5e97b7caa0aa01980e603d0955b4efafd872129ecbe01ecac；
  - v2 tgz：87 entries，sha256:5741f50439ec71526325322cb1e38f78b80dda2940b77e98409a0fd54508eb94。

本轮没有functional或heavy首错。四文件product diff在pre-heavy与post-heavy之间无漂移，binary diff SHA-256为
333b30b1b2a3478a261937e2a8d2a99060b2791535802c7448e2e5b0196c1fa5，stat为+789/-18。

未运行Plugin Host、root full、distribution、security或cross-platform矩阵：本切片不修改这些surface，
唯一packed E2E已从真实candidate覆盖Snapshot→Check→Evidence→accept→外部Verification→Workbench及既有
upgrade/rollback链。

## Packed用户链

- Brief在删除意图下只选择baseline中的src/extra.ts / EXTRA_NODE_ID；legacy plan本身不构成正式删除授权。
  mutation同时删除该文件并创建不同路径src/untracked.ts。
- refresh_index发布exact两条变化：unstaged/deleted无digest与untracked/added有exact digest。
- Check精确产生3个blocking Findings：删除计划cannot_determine、删除独立unplanned、新增独立unplanned。
- 三个Findings均显式accept后才进入verification_required。
- 外部Node命令实际import并执行untracked export，同时验证deleted path为ENOENT；snapshot-bound记录全部
  passed后Task进入verified。
- 同一个真实Browser profile先证明deleted Evidence为stale/evidence_stale、无live source lines与Graph操作，
  再证明untracked Evidence返回current source并精确聚焦Graph node。
- 后续原有current Source、Graph/Wiki、managed upgrade/rollback、Task/Verification连续性与cleanup链未弱化。

## 失败轨迹与最小修复

Pre-focused终审发现唯一blocking Test Gap：原有Index/worktree/untracked漂移均可由通用live fence拦截，
不能直接证明新profile接入baseline Index equality guard。最终在真实A1 actual Snapshot上复制一个
schema-valid baseline，仅改变indexDigest，并精确断言新profile专属reason、单一global boundary、全部fresh
IDs、无filePath/hunks/deletedFiles；同时收紧共用drift helper。production未因此修改。

没有放宽contract、timeout、budget或测试断言，也没有为本切片增加第二条Browser矩阵。

## 可声明

- 在clean baseline、same HEAD、Index完全不变和full pre/post Snapshot fence下，Alpha可bounded分析2–16个
  unique live paths：至少一个untracked added与一个unstaged deleted，可含unstaged modified。
- added与modified生成actual Snapshot/current source hunks；deleted生成baseline-bound changed observation。
- 任一authority或live状态漂移会整批unknown，不会保留partial hunk/deletion observation。
- Engine组合可让已计划modified精确完成，同时把added/deleted保持为独立blocking unplanned。
- 真实安装tgz链完成三项Finding显式accept、snapshot-bound外部Verification和verified；Workbench对deleted
  固定stale/no-source/no-Graph，对untracked提供current Source→exact Graph。

## 不可声明

- 不支持本profile混入staged或ITA，也不支持same-path replacement、rename/copy配对、committed delta、
  conflict、binary、mode-only、partial/oversize或Graph unavailable组合。
- 不授权planned deletion；同path deletion仍为cannot_determine加独立unplanned。Finding acceptance不等于
  计划授权或自动正确性证明。
- Verification仍为externally_reported；不证明命令自动执行权威、ABA/execution fence或强写安全。
- 结果仍为legacy_summary，不是evidence_backed_v1、formal diff_hunk、required expectation或五维
  Completeness/omission证明。
- Provider Authority与strongWrites继续locked。
- 两个candidate是当前本机tuple的unsigned Alpha测试产物，不证明Release、signature、SBOM、trusted
  provenance、reproducibility、CI same-SHA或cross-platform。

## 结论

🟢 Effective。A1现在能在clean Index和完整live Snapshot fence下，对不同路径的untracked新增、
unstaged删除及可选unstaged修改进行bounded Change Check：已计划modified可完成，added/deleted保持独立
blocking unplanned；ITA、staged、same-path replacement及任一authority drift继续整批fail closed。
可以精确提交。
