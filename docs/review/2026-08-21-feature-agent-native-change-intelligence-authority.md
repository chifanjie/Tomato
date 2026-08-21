# feature/agent-native-change-intelligence-authority Review Brief

> 生成时间：2026-08-21 CST
> 分支：feature/agent-native-change-intelligence-authority
> 基于 commit：ab33666 feat: add alpha release doctor

## 背景与动机

单一 Preview tgz 已能冷安装完整 CLI/MCP、Graph/Wiki、Alpha Doctor 和双 Host Plugin，
但此前完整 Pulse→Brief→修改→Check→Verification 链只由包级 Host wrapper 证明；真实 Codex/
Claude 官方 Plugin 安装缓存只验证到 Pulse。本切片关闭这段发行证据缺口，不改变生产字节，也不
把 externally reported Verification 或 Provider candidate 误报为受信执行。

## 改动策略

扩展既有真实双 Host Plugin E2E，让 Codex CLI 从官方安装缓存启动同一 tgz 内的 MCP，完成
Brief、公开 Task 状态迁移、外部源码修改、Change Check、真实 Node 行为命令、
`record_verification` 和 `verified`；随后关闭进程，由 Claude CLI 安装缓存从不同 cwd 恢复同一
Task、Snapshot、revision，并用原请求做 exact idempotent replay。保留 marketplace
add/list/remove、Root fail-closed、ambient Git 隔离和 installed-cache containment 断言。

## 改动范围

| 模块/职责 | 文件 | 做了什么 |
|-----------|------|----------|
| 真实双 Host 发行门禁 | `packages/preview/test/plugin-clean-install.test.mjs` | 将官方 Plugin 缓存 E2E 从 Pulse 扩展为完整 Alpha Task/Check/Verification/恢复闭环 |
| Review 记录 | `docs/review/2026-08-21-feature-agent-native-change-intelligence-authority.md` | 记录本切片意图、证据与 locked residual |

## Review 重点

1. MCP executable 必须从 Codex/Claude 官方安装后的 cache root 解析，不能退回 monorepo 或全局
   `understand-code`。
2. Check 必须把真实 worktree 修改关联到 Brief planned change，且不能自动接受未知 blocking
   finding 伪造 happy path。
3. Verification 命令必须实际在 MCP 外执行，记录的 command/kind/status/digest 与执行一致；
   `record_verification` 仍只表示 externally reported evidence。
4. Claude 恢复必须保持 Task、baseline/current Snapshot 与 revision，并证明 exact replay 不生成新
   Verification 或 Task mutation。

## 已识别风险

未发现 P0/P1/current-path P2 或阻塞 Test Gap。

## 测试情况

**已覆盖：**

- Preview typecheck/build：通过；Preview runtime：8/8。
- 最终单一 tgz：54 entries，2,375,769 bytes，SHA-256
  `985c7aab56a3c5d54b7dad3897e46c2df0d8daad69a74ca541b33f7b3ed17711`。
- 强制真实 Codex/Claude Plugin E2E：1/1；两端均从官方 CLI 安装缓存启动 exact packed MCP。
- Codex 完成 Pulse→Brief→外部修改→Check→外部 Node 验证→Verification→verified。
- Claude 从不同 cwd 恢复相同 Task/revision/Snapshot，完整 Verification 与 Mutation exact replay，
  重读 Task revision 不变。
- 同一 tgz 的 monorepo 外完整 Alpha cold E2E：1/1。
- `node --check` 与 `git diff --check`：通过。

**后置边界：**

- 真实 credentialed/model-selected Host 对话中自动选择并调用 Tool 尚未证明；当前门禁证明官方
  Plugin lifecycle、缓存载荷和 MCP 协议路径。
- Verification 是外部执行后报告的结果；Provider Authority、grant trust、execution fence、
  global rollback anchor 与 Provider-backed `strongWrites` 仍 locked。
- 双版本 upgrade/downgrade/reload、签名、SBOM、provenance、跨平台和正式 Release gates 留到后续
  里程碑。

## 结论

🟢 Effective：同一可安装 tgz 的真实 Codex/Claude Plugin 缓存现在可完成并恢复 Alpha 用户闭环，
且没有扩大或误报安全能力。本切片可以精确提交并推送。
