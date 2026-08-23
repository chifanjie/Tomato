# feature/agent-native-change-intelligence-authority Review Brief

> 生成时间：2026-08-23 CST
> 分支：`feature/agent-native-change-intelligence-authority`
> 基于 commit：`b09a970 test(preview): verify retained historical candidates`

## 背景与动机

Step15 已能把 bounded unstaged tracked-file deletion表达为 baseline-bound、blocking observation，但真实用户
也常用 `git rm` 或 `git add -u` 把删除直接写入 Index。Snapshot能诚实发布 `staged/deleted`，旧 provider
却把它整批判为 unsupported，因此 Check无法给出具体删除路径与基线 Evidence。

本切片在不改变公开 contracts、持久化 schema或 deletion授权语义的前提下，增加一个独立 bounded staged
deletion profile。删除仍不是 actual-side hunk，也绝不会成为 `planned_completed`：同路径 legacy plan得到
blocking `cannot_determine`，删除本身始终是独立 blocking `unplanned_change`，Evidence只绑定 baseline。

## 改动策略

- 仅当 actual Snapshot为 1–16 个唯一路径、全部 source=`staged`、至少一条 deletion，且全集只含
  staged modified（有 digest）或 staged deleted（无 digest）时启用 `stagedDeletedChanges`。
- staged added+deleted、任意 staged/unstaged/untracked/committed/conflict混合、重复路径或其他 kind整批
  `unknown`；无delete的 staged modified/added继续走旧 `stagedChanges`分支与原 reason字符串。
- 删除路径必须通过安全路径校验；worktree必须确实不存在。provider以 hardened fixed-env/no-shell Git执行
  global `--literal-pathspecs ls-files --stage -z -- <path>`，只有 exact zero stdout才能证明 Index中既无
  stage-0条目也无conflict stages。
- baseline bytes只从 exact baseline HEAD blob读取；staged companion modified仍要求 Index、worktree与
  actual Snapshot digest三方逐字相等。
- 复用 full live Snapshot pre/post fence，精确比较 root、repository/worktree identity、HEAD、Index/
  worktree/untracked/ignore digests与snapshotId；任一 drift、path、预算、Git或语义失败都整批折叠成
  global boundary、全部 actual IDs、空 hunks与空 deletion observations。
- 复用每文件 8 MiB、整批 32 MiB与 1024个 hunk/observation上限。
- `change-intelligence`只把 deletion observation允许关联的 actual source从 `unstaged`扩为
  `unstaged|staged`；仍要求 exact path、kind deleted、无 contentDigest。matcher、Finding、Evidence、Claim
  与 stable-ID条件逻辑不变。
- Source Evidence继续为 `observed/changed`，绑定 baseline Snapshot/HEAD/old range/hash；Finding Claim为
  `observed/supported/changed`。Workbench固定返回 stale/evidence_stale，不读或返回已删 live source/Graph。

## 改动范围

| 模块/职责 | 文件 | 做了什么 |
|---|---|---|
| Repository analysis | `packages/task-engine/src/repository-context-provider.ts` | 新增独立 staged-deletion profile、Index exact-absence证明及既有 fence/budget/whole-unknown接线 |
| Finding consistency | `packages/task-engine/src/change-intelligence.ts` | 允许严格的 staged deleted actual关联既有 deletion observation |
| Provider regression | `packages/task-engine/test/repository-context-provider.test.ts` | 真实 staged modified+deleted happy、authority drift与 add+delete/mixed whole-unknown |
| Engine regression | `packages/task-engine/test/engine.integration.test.ts` | 将完整删除 Finding/Evidence/Claim合同分别用于 unstaged与staged source |
| Packed user vertical | `packages/preview/test/workbench-browser-packed.test.mjs` | 在唯一真实 Browser E2E中以独立repo/profile执行 unstaged与staged deletion stale/no-source纵切 |

`engine-types`、公开 contracts、MCP shape、artifact schema、Dashboard production与生命周期实现均未修改。

## Review 重点与结论

1. **Index absence是肯定证明** — helper使用literal pathspec、`-z`与有界stdout；任何非空entry、Git失败或
   budget失败都不承认删除。真实 focused与packed均直接断言 `ls-files --stage` exact empty。
2. **worktree与baseline不混淆** — worktree必须ENOENT；old range/hash只来自baseline HEAD blob。staged
   deletion不会伪装成 current source hunk。
3. **全局fence与整批失败** — pre/post Snapshot fence覆盖Index、worktree、untracked与ignore；worktree重建、
   Index restore或无关live drift都会清空所有成功结果并覆盖全部actual IDs。
4. **scope确实收窄** — 真实 fresh Snapshot加入 staged added后，exact三变化批次必须whole unknown；这会
   阻止未来无测试地扩大为 add+delete组合。
5. **旧profile不漂移** — 无delete staged added/modified仍优先走旧predicate/reason；unstaged deletion的
   Index=baseline证明、reason、Finding/Evidence/Claim ID构造均保持。
6. **真实candidate authority** — packed ephemeral v1 overlay已包含 `repository-context-provider.ts`、
   `change-intelligence.ts`与既有 `engine-types.ts`，v2从该commit派生；最终tgz真实执行本轮production字节。

独立 contract 与 change-intent 终审一致：P0 0、P1 0、current-path executable P2 0、
blocking Test Gap 0；结论为 Effective / SAFE TO COMMIT。

## 测试情况

**已通过：**

- task-engine provider focused：14/14 passed，包含真实 staged deletion与所有新authority边界。
- task-engine engine focused：32/32 passed，分别覆盖 unstaged/staged deletion完整语义。
- `pnpm --filter @understand-code/task-engine typecheck`
- `pnpm --filter @understand-code/task-engine test`：8 files / 75 tests passed。
- `node --check packages/preview/test/workbench-browser-packed.test.mjs`
- scoped `git diff --check`
- `pnpm --filter @understand-code/preview typecheck`
- `pnpm --filter @understand-code/preview build`（fresh dist）
- 唯一真实 packed Browser门禁：
  `UNDERSTAND_CODE_REQUIRE_REAL_BROWSER=1 pnpm --filter @understand-code/preview test:workbench-browser`
  - 1 passed / 0 failed / 0 skipped，190.69 秒；
  - v1 tgz：87 entries，`sha256:a6de7f8dd3099018260b050f4097491c1e635d0e26284ab2395fc61b37fa0f39`；
  - v2 tgz：87 entries，`sha256:7c141241daca18e8f9e6538ab89af83af0909e2b35713d1ea0d9fc283a28b958`。

未运行 Plugin Host、root full或cross-platform矩阵：本切片不修改这些surface，唯一packed E2E已从真实
candidate覆盖MCP→Check→Evidence→Workbench与既有upgrade/rollback链。

## Pre-focused Test Gap 与修复

终审在functional门禁前识别并关闭两处blocking Test Gap：

1. 初版没有直接断言 deleted path 的 Index inventory与worktree absence。最终 provider focused明确锁定
   `git ls-files --stage -- path`为空且 `readFile`为ENOENT；packed staged vertical也直接锁Index empty。
2. 实现被收窄为 modified+deleted，但初版没有证明 add+delete被排除。最终在同一真实Git fixture恢复合法
   staged deletion后新增并stage `src/added.ts`，fresh capture锁三条变化，再断言唯一global
   `unsupported_source`覆盖全部IDs且无hunks/deletion observations。

修复只增强测试；没有放宽production边界或新增矩阵。

## 可声明与不可声明

**可声明：**

- 当前 Alpha能对 1–16 个unique staged modified/deleted变化（至少一条delete）进行 bounded、
  Snapshot-bound分析。
- staged deleted path由 exact Index absence、worktree absence与baseline HEAD bytes三方证明；companion
  modified仍由Index/worktree/Snapshot bytes精确绑定。
- 删除不会被误报为plan完成；它形成独立blocking unplanned Finding与baseline changed Evidence/Claim。
- unsupported组合或任一live authority drift都会whole-analysis fail closed。
- 真实Chrome Workbench对unstaged与staged deleted Evidence均显示stale/evidence_stale，且不读取/展示
  live source或Graph action。

**不可声明：**

- 本切片不授权 planned deletion，不生成formal actual deletion hunk，也不证明possible omission或五维
  Completeness。
- 不支持 staged added+deleted、delete+untracked replacement、mixed staged/unstaged、rename/copy、
  committed delta、conflict、empty、binary、mode-only、oversize或Graph unavailable deletion；继续unknown。
- Workbench不会hydrated历史删除源码；baseline Evidence不是current source/Graph proof。
- 结果仍为 `legacy_summary`，不是 `evidence_backed_v1`或structured `diff_hunk`。
- 不证明Provider Authority、execution fence或strong write；`strongWrites`继续 locked。
- 两个candidate仍是当前本机tuple的unsigned Alpha测试产物，不证明Release、signature、SBOM、provenance、
  reproducibility或cross-platform。

## 结论

🟢 Effective。真实 staged tracked-file deletion现在能在严格Index/worktree/HEAD/Snapshot authority下形成
可追溯、baseline-bound、blocking observation；同路径plan仍不能授权删除，所有不受支持组合与live drift
继续整批fail closed。旧 staged added/modified、unstaged deletion与既有Workbench/lifecycle均未回归。
可以精确提交。
