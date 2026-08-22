# feature/agent-native-change-intelligence-authority Review Brief

> 生成时间：2026-08-22 09:24 CST
> 分支：feature/agent-native-change-intelligence-authority
> 基于 commit：c376707 feat: diagnose host plugin registration

## 背景与动机

Alpha Change Check 已能把单一 unstaged 修改确定性映射为 Snapshot-bound hunk、Graph symbol 与 Workbench Source Evidence，
但用户执行 `git add` 后，相同修改会被保守降级为 `cannot_determine`。本切片在不扩大 Provider authority 的前提下，
增加一个严格受限的 staged-only modified 路径，让已暂存的单文件修改继续贯通 Check→Evidence→Workbench。

## 改动策略

- 只接受 clean baseline、相同 repository/worktree/HEAD、complete Snapshot，以及唯一一个 `staged + modified` change；
  multi-path、staged+unstaged、mode-only、binary、无效 UTF-8 与 Graph 映射不确定均整次 fail closed。
- 对当前 HEAD 与全局 relevant Git Index digest 做分析前后采样；Index digest 精确复刻 Snapshot 捕获算法并排除
  `.understand-code/**`。
- 从 stage-0 Index blob 读取权威 actual bytes，同时要求 Index、当前 worktree 与 Snapshot content digest 三方完全一致；
  deterministic diff、Graph anchor 与 Evidence `contentHash` 均使用 Index bytes。
- Git 调用固定 argv、无 shell、清除 ambient `GIT_*`，禁 prompt、replace、lazy fetch 与可选锁；path、HEAD、Index 与 blob
  均有固定格式和大小预算。
- 不宣称全 worktree execution fence，也不解锁 Provider strong writes。

## 改动范围

| 模块/职责 | 文件 | 做了什么 |
|---|---|---|
| Repository analyzer | `packages/task-engine/src/repository-context-provider.ts` | staged eligibility、Index blob authority、pre/post HEAD+Index fence 与 whole-analysis fail-closed |
| Focused regression | `packages/task-engine/test/repository-context-provider.test.ts` | staged happy、worktree/index/HEAD drift、mixed staged+unstaged；保留 unstaged happy |
| Packed browser path | `packages/preview/test/workbench-browser-packed.test.mjs` | 真实 `git add` 后验证 refresh→Check→Evidence→Verification→Workbench Source→Graph |

## Review 重点

1. **Snapshot/Index 一致性** — staged 成功不得从当前 worktree 猜测，必须使用与 Snapshot digest 一致的 stage-0 blob。
2. **竞态后的失败语义** — HEAD、全局 Index 或同路径 worktree 漂移必须返回 `unknown` 且不得保留 partial hunks。
3. **旧 unstaged 路径** — 原先的 deterministic hunk→symbol 行为应保持；新增 mode-only 处理只能收紧为 fail closed。
4. **能力边界** — 本路径仍是 Alpha 本地只读分析，不得据此宣称 execution fence 或 Provider-backed strong write。

## 已识别风险

未发现 P0、P1、current-path executable P2 或 blocking Test Gap。

残余风险仅限已冻结边界：未建立全 worktree fence，分析后仍可能存在瞬时外部竞态；这些情况不进入强授权声明，
`strongWrites` 继续保持 locked。

## 测试情况

**已覆盖：**

- task-engine typecheck。
- task-engine package：8 files / 65 tests。
- staged focused：happy exact hunk/node/hash，以及 worktree drift、独立 Index drift、live HEAD drift、mixed source fail closed。
- Preview fresh build。
- 真实 packed-browser E2E：1/1，0 skipped；tgz SHA256
  `191e550b9a953c8270b0b32bd808e0d41fe16d0ff8b44f347e44b017d6963462`，87 entries。
- `git diff --check`。

**缺失：**

- 无 blocking 缺口。multi-path staged、add/delete/rename、binary、mode-only 与正式 execution fence 明确保留在后续能力门禁。

## 结论

🟢 Effective。单一 staged modified 现在以 exact Index bytes 完成 Snapshot-bound hunk→Graph symbol→Evidence→Workbench
纵切；所有超出 Alpha 支持边界的输入保守返回 `unknown`，旧 unstaged 路径保持有效，可以精确提交。
