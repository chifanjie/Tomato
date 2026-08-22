# feature/agent-native-change-intelligence-authority Review Brief

> 生成时间：2026-08-23 CST
> 分支：`feature/agent-native-change-intelligence-authority`
> 基于 commit：`1abfe495 test: prove two-package managed continuity`

## 背景与动机

权威 Step16/WP6 要求 mandatory Codex、Claude Host 的 Root E2E 覆盖 linked worktree、
空格/中文路径，以及 Claude 进程 cwd 与 `CLAUDE_PROJECT_DIR` 分离。现有真实 Host 门禁虽已覆盖
官方 cache、Task、Verification、Workbench 与版本生命周期，但仍只在普通 ASCII repository root
上运行；linked worktree 仅有低层 identity 测试，不能证明官方安装产物的完整用户路径。

本切片不改生产实现，只把现有双 Host + Chrome 全链迁移到更强的 detached linked-worktree fixture，
并补齐测试自身对 gitfile、独立 index、common-dir、污染 Git authority 与 primary/ambient 隔离的
精确证明。

## 改动策略

- 在隔离 sandbox 中创建名称同时含空格和中文的 primary repository，再创建同样含空格和中文的
  detached linked worktree；Host 选择入口位于 linked root 下的 nested 中文/空格目录。
- 用 fixed argv、无 shell、清除 ambient `GIT_*` 的 Git helper 检查：linked `.git` 是 gitfile，
  `show-toplevel` 精确为 linked root，HEAD detached，git-dir 与 common-dir 分离，common-dir 精确指向
  primary `.git`。
- 不再假设 `<root>/.git/index`。通过 `rev-parse --path-format=absolute --git-path index` 解析
  linked index，要求它等于 `linkedGitDir/index` 且不同于 primary index；Alpha 执行前后复核同一路径。
- 为 ambient repository 使用确定性不同的源码、HEAD 与 index，并在 7 次 fresh MCP 启动中统一注入
  `GIT_DIR`、`GIT_WORK_TREE`、`GIT_COMMON_DIR`、`GIT_INDEX_FILE`、
  `GIT_OBJECT_DIRECTORY`、`GIT_ALTERNATE_OBJECT_DIRECTORIES`。只有 Host wrapper 正确清除这些 authority
  才能选中 linked root。
- Codex v1 创建、Workbench 恢复、v2 恢复和 pinned-v1 恢复全部从 nested cwd 启动；Claude v1、v2、
  pinned-v1 全部从无关 cwd 启动，并把 nested 路径放入 `CLAUDE_PROJECT_DIR`。
- 从首次 refresh 起冻结非空 `repositoryId`、`worktreeId`，贯穿 Pulse、Task、changed Snapshot 与每次
  fresh active-cache MCP 的 taskId/status/revision/baseline/current Snapshot exact replay。
- 保留原 Task→Check→Verification、Codex/Claude 独立 Chrome profile、cookie Workbench、
  Evidence/Source→Graph/Wiki→Back、v2 update、pinned-v1 reinstall、remove 与 Doctor 全部断言。
- 最终要求 artifact 只存在于 linked root；primary source/index 原始字节不变且 Git status clean，
  primary 与 poisoned ambient repository 都没有 `.understand-code`。
- `mkdtemp` 后所有有副作用的 repository/worktree/Host/browser setup 都位于同一 `try/finally` cleanup
  authority 内，setup 任一步失败也会删除 exact sandbox。

## 改动范围

| 模块/职责 | 文件 | 做了什么 |
|---|---|---|
| Mandatory Host Root E2E | `packages/preview/test/plugin-clean-install.test.mjs` | 将现有真实双 Host + Chrome 全链迁移到 spaces/CJK detached linked worktree；补 gitfile/index/common-dir、六类 poisoned Git authority、身份连续性、primary/ambient 隔离与 setup cleanup 断言 |

## Review 重点

1. **Root authority** — Codex 必须从 nested cwd、Claude 必须从 divergent cwd + nested
   `CLAUDE_PROJECT_DIR` 选择同一个 linked top-level；poisoned `GIT_*` 不能改写 authority。
2. **Linked identity** — gitfile、git-dir/common-dir、detached HEAD、linked index 与 Task
   `repositoryId/worktreeId` 必须形成连续证据，不能用普通 `.git/index` 假设。
3. **产品全链未弱化** — 原 install/Doctor、Task/Check/Verification、双 Workbench、v2/pinned-v1、
   remove/not_registered 的调用与断言必须全部保留。
4. **隔离** — 源码变更与 `.understand-code` 只能落在 linked root；primary 必须保持 source/index/status
   clean，ambient repository 不得出现产品 artifact。
5. **失败清理** — linked worktree 注册、node_modules/cache、Chrome profile 或 Host setup 失败时，
   不得因 `try/finally` 起点过晚而遗留 sandbox。

## 已识别风险

终审结果：P0 0、P1 0、current-path executable P2 0、blocking Test Gap 0。

终审前关闭的防假绿问题包括：setup 原先位于 cleanup authority 之前；linked index 未精确绑定
linked git-dir；Git poison 变量不足；ambient repository 可能与 primary 生成相同 HEAD/index，且
alternate object DB 曾指向合法 primary objects。最终 fixture 使用确定性不同 ambient source/HEAD/index，
六类 authority 都指向 unrelated ambient Git state，并在全部 7 次 MCP 启动中复用。

非阻塞残余：本 E2E 不独立计算 primary checkout 的 public `worktreeId`；已有 repository-state
identity 测试覆盖底层计算，本门禁以 gitdir/common-dir/index/source/artifact 隔离证明 Host 实际选中
linked worktree。本切片不扩为 full Root/error/symlink/dynamic Roots 矩阵，也不增加第二条普通 repo
Host 重门；普通路径继续由既有 CLI root-binding、installed-host 与 packed-browser 证据覆盖。

## 测试情况

**已覆盖：**

- `node --check packages/preview/test/plugin-clean-install.test.mjs`：通过。
- scoped `git diff --check`：通过。
- Preview `typecheck`：通过。
- Preview fresh `build`：通过，fresh `packages/preview/dist` 已生成。
- 唯一真实 Host + Browser 门禁：
  `UNDERSTAND_CODE_REQUIRE_PLUGIN_HOSTS=1 UNDERSTAND_CODE_REQUIRE_REAL_BROWSER=1 pnpm --filter @understand-code/preview test:plugins`
- 结果：1/1 pass，0 fail，0 skip；test 34.809 秒，总计 34.900 秒。
- 双 flag 同时强制，因此 Codex CLI、Claude CLI 或 Chrome 缺失都会失败，不能静默 skip。

**不可声明：**

- 不是 credentialed/model-selected Codex/Claude chat 或 Gold/G2/G3 质量证据。
- 不是 full Root/六 reason/dynamic Roots/additional-root/list-changed、多 worktree 并发矩阵。
- 不外推到所有 Host/Git 版本、其他 OS/filesystem、Windows 或 cross-platform Release。
- 不证明 RC、signature、SBOM、SLSA/trusted provenance、reproducibility、CI 发布或 publisher authenticity。
- 不证明 Provider Authority、execution fence 或 strong writes；`strongWrites` 继续 locked。
- 这是 test-only 证据增强，不宣称新增 runtime 安全机制。

## 结论

🟢 Effective。当前本机真实 Codex、Claude 与 Chrome tuple 上，两套官方 active plugin cache 已在一条
spaces/CJK detached linked worktree 上完成同一 Alpha Task 的完整闭环：Codex nested cwd 创建并验证，
Claude divergent cwd + nested project root 精确恢复；两 Host 保持 repository/worktree/Task/Snapshot/revision
identity，并完成 Evidence/Source→Graph/Wiki→Back、v2 与 pinned-v1 恢复及最终 remove/Doctor。primary 和
poisoned ambient repository 保持隔离。可以精确提交。
