# Step16 续跑检查点（非需求扩展）

本文件只记录实际实现断点，不新增验收项，不代替真实运行证据。范围仍以 `151b106` 冻结基线及目标附件为准。

## 当前游标

- 第15步已完成；第16步进行中；第17步未完成。不要从旧 goal 元数据中的 Preview/第15步游标重新开始。
- 本切片基于 `38a70ae`；所属提交用 `git log -1 -- docs/research/2026-08-31-step16-resume-checkpoint.md` 查询。
- 默认生产入口仍保持 `providerReceiptBinding: "not_bound"`。新增的是内部监督组合能力，真实 Alpha runner 尚未完成接线；不得将以下测试写成 Step16 Gold。

## 本轮已实现并验证

- 内部 root supervisor 串联实际 Host executor、start/complete、operation observer 和 witness client；固定计划校验、逐调用窗口、跨 session/Host 全局顺序、实际 executor 成功后才允许全程 finalize。
- Witness client 使用原生 root peer 身份、严格序列、超时和取消。UDS 已区分合法 Host 思考空闲与未认证/半帧/挂起 RPC 超时，避免 5 秒静默误杀。
- Durable authority composition 在实际 broker lease 内打开 journal；arm 固定运行/计划/会话/调用身份，操作必须先落盘后 ACK，完成时验证真实 broker prefix/suffix。
- Journal 新增 whole-run finalized 状态：跨 Host/session 调用保持全局顺序，只有完整运行结束才能换新 runNonce、重置本运行预算；不完整运行不算完成。
- 关闭和 helper 失锁同步撤销回执能力，等待写入排空后才释放父 fd 持有的真实 flock。complete/finalize 挂起期间撤权不能迟到成功。修复 Alpine BusyBox flock/cat 兼容性。
- Host executor 内部 root 启动必须显式非 root UID/GID，保护并固定 native 入口路径/摘要，实际降权并清除 supplementary groups，外部取消终止子进程。Codex 新支持只读沙箱内精确 verification command；source mutation 仍拒绝，未开放泛化写权限。
- 本切片最终 typecheck/build：Authority、Host 均通过。完整包测试：Authority 453 passed / 6 skipped；Host 111 passed / 12 skipped。Client 未改，未重复其完整门禁，也未纳入受保护的用户未跟踪源码/测试。
- 实际 Linux/root/ext4：既有 Lima `understand-code-alpine-proof` 内，启动隔离 12/12、真实 broker lease 2/2 通过；不是 macOS skip 替代，也不是实际 Codex/Claude Gold session。
- 一轮分工独立复审及同一 lease finding 定向复核已收口；无新失败证据时，不重复全面审计或未变化的长测试。

## 从这里继续

- 下一实际实现点是 Alpha runner 的 root 纵向接线与完整真实任务闭环；两个 Linux runner 仍未接入新内部 composition，现有手工 MCP 驱动和分段 smoke 不算完整 Host workflow。
- 完整任务后续参数含运行中才产生的 snapshot/context/finding ID。需在可信 Provider 产物核验后冻结下一次精确参数，不能靠预填未来 ID 或把该实现缺口当成用户缺输入；现有固定 closing plan 不能直接宣称覆盖动态工作流。
- Codex source edit 的原生 JSONL 只有 path/kind、不包含 patch bytes，尚需受限实际写入及内容核验闭环；不以笼统 workspace-write 代替。
- Claude 2.1.202 已从官方源验签安装到 VM `/opt/understand-code/hosts/claude/2.1.202/claude`，root:root/0555、nlink1，父目录 root:root/0755；SHA256 `80405fead329dd67d786b2a3d49bb121797a157937c99dedae2e36fcc77b55e6`。官方 key fingerprint、manifest 签名及大小均验证，普通 uid601 的 `--version`/`--help` 成功，尚未登录或调用模型。验签材料在 VM `/var/tmp/step16-claude-2.1.202.eGLLBH`。
- Codex 0.151.0 官方 musl-arm64 完整 bundle 隔离安装仍在推进。真实 CLI 还需配置、登录和完整会话；不复制 Mac 凭证、不以 root 身份运行模型。准备环境不等于真实 session 通过。
- Linux 已有工作区 `/var/tmp/understand-code-step16.OlMGFa`（提交基线 38a70ae 加有限测试文件），不能当作本切片完整已提交候选。VM 保持运行，不重复创建。Mac CLI 和用户配置未改。
- 新 SHA CI 必须单独核验。基线 38a70ae 的 Actions run 33355268029 在 jobs 启动前因账户付款/额度限制失败，不能记成代码失败或通过，不自行更改计费。
- 双 Agent 冷安装/升级、真实任务与恢复、Workbench/Graph/Wiki 的 Product Design 和多屏交互验收、双人 Product/QA、ALPHA-B/owner、发行门仍按原冻结范围推进；没有增加新的步骤或验收项。
- 原有三份脏文档、`site/`、`.learnings/`、`.pnpm-store/`、topology-proof 和用户未跟踪源码/测试继续保持不动。
