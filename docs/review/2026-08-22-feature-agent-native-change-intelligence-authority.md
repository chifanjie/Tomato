# feature/agent-native-change-intelligence-authority Review Brief

> 生成时间：2026-08-22 CST
> 分支：feature/agent-native-change-intelligence-authority
> 基于 commit：0f67021 feat: assemble unsigned alpha candidates

## 背景与动机

现有 Change Check 会验证 persisted Actual Snapshot 中已列出的 change IDs 与目标文件
bytes，但 live fence 只覆盖 staged/live-untracked 的 HEAD 与 Index。pure unstaged 没有
全局 fence，所有 profile 也没有复核 `worktreeDigest`、`untrackedDigest` 与
`ignoreDigest`。

因此用户在捕获只含 `src/task.ts` 的 Actual Snapshot 后，可以保持该文件不变，再修改
另一个 tracked 文件或新增 untracked 文件；旧实现仍可能返回 `complete` 并持久化
`planned_completed`。这是公开 Pulse → Brief → 修改 → Check 路径上的错误成功。

本切片为所有当前可成功分析的 Alpha profile 增加完整 Repository Snapshot pre/post
fence，不扩 delete/rename/committed 等 source kind，也不解锁 strong writes。

## 改动策略

- `task-engine` 以无环依赖复用 `repository-state` 的
  `getRepositorySnapshotDetailed`，不复制另一套 worktree/untracked/ignore digest 算法。
- live capture 环境精确镜像 persisted CLI Snapshot：保留 system/global Git config 与
  `core.excludesfile`，只移除 6 个可重定向 repository authority 的 `GIT_*` 变量，并固定
  optional locks、terminal prompt 与 locale。
- 使用 Actual HEAD 作为 `baselineRef`，固定 64 MiB Git 输出预算，并要求 pre/post
  capture 均为 `complete`。
- 精确比较 canonical root、HEAD、repository/worktree/root identity、Index/Worktree/
  Untracked/Ignore 四项 digest，最后比较稳定 `snapshotId`。
- pure unstaged、bounded staged 与 bounded live-untracked 三类成功 profile 都执行
  pre/post fence；任一 fence 失败都返回一个无 `filePath` 的 global boundary，覆盖全部
  actual IDs，且 `hunks: []`。
- fence 成功时保持原语义：pure unstaged 仍可返回既有 partial semantic result；staged
  与 live-untracked 继续使用既有 whole-batch boundary collapse。
- hardened Git blob/index 读取环境保持不变；只有 Snapshot fence 使用 CLI-equivalent
  capture 环境。

## 改动范围

| 模块/职责 | 文件 | 做了什么 |
|---|---|---|
| Task Engine dependency | `packages/task-engine/package.json` | 增加 acyclic `repository-state` runtime dependency |
| Live-state fence | `packages/task-engine/src/repository-context-provider.ts` | 完整 Snapshot pre/post capture、identity/digest/snapshotId 比较、global fail-closed |
| Focused regression | `packages/task-engine/test/repository-context-provider.test.ts` | 四类 happy fixture 迁移到真实 Snapshot，并新增 unrelated tracked+untracked drift 回归 |
| Workspace lock | `pnpm-lock.yaml` | 记录 task-engine 的 workspace dependency |

## Review 重点

1. **捕获语义一致** — fence 必须复用与 public refresh 相同的 Git config/ignore 语义；
   不能用 hardened blob 环境禁掉 global excludes 后制造无漂移 false unknown。
2. **覆盖完整** — pre/post 必须覆盖 pure unstaged、staged、live-untracked 三个可成功
   profile，不能继续只包住 `boundedBatchChanges`。
3. **错误成功关闭** — selected file bytes 不变但未选中 tracked/untracked state 漂移时，
   不得保留任何 hunk 或 `complete` 结果。
4. **行为兼容** — 只有 fence failure whole-unknown；fence 成功后 pure unstaged 原有
   partial semantic behavior 必须保留。
5. **真实 fixture** — fenced happy path 必须使用 repository-state 生成的真实 identity、
   digest、snapshotId 与 change ID，不能放宽生产比较来迁就 fake Snapshot。

## 已识别风险

终审结果：P0 0、P1 0、current-path executable P2 0、blocking Test Gap 0。

非阻塞残余：post-sample 到 ArtifactStore append 之间仍不是持续 execution fence；随后
发生的新变化会使结果 stale，但本切片不提供强写授权。Graph 读取与 Git/worktree 之间
也没有正式 Provider Authority。delete/rename/intent-to-add/committed 与 formal
`evidence_backed_v1` 继续 fail closed 或留待后续；`strongWrites` 保持 locked。

## 测试情况

- Repository provider focused：11/11，0 skip，7.28s。
- Task Engine typecheck 通过；package coverage 8 files / 70 tests 全部通过。
- Fresh Preview typecheck/build 通过。
- 唯一 packed Chrome E2E：1/1，0 skip，34.729s。
- packed tgz SHA-256：`cc327fe8ab2cdcf62bc8f2e8dd72f15203b0d286bd3a9115510dbda782ce47b2`；87 entries。
- final scoped `git diff --check` 通过。

## 结论

🟢 Effective。Change Check 现在会在分析前后精确确认完整 live repository state 仍等于
persisted Actual Snapshot；任何未选中的 tracked、untracked、Index、ignore、identity 或
HEAD 漂移都会整体 fail closed，不再把过期 change set 写成 `planned_completed`。可以
精确提交。
