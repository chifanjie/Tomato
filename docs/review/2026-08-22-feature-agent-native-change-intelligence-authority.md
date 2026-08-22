# feature/agent-native-change-intelligence-authority Review Brief

> 生成时间：2026-08-22 CST
> 分支：feature/agent-native-change-intelligence-authority
> 基于 commit：b80ab62 fix: fence change checks against live state

## 背景与动机

当前真实双 Host E2E 已证明 Codex 与 Claude 官方插件安装、Doctor、缓存内 MCP、
Task 持久化、版本替换与 pinned-v1 恢复。Claude 的 official active cache 还真实打开过
cookie-auth React Workbench；Codex official active cache 只创建/恢复 Task，没有独立的
Workbench Surface 证据。

本切片补齐 Codex CLI mandatory Surface parity：从官方 `plugin add --json` 返回并由
`plugin list` 约束的 active `installedPath` 启动一个 fresh MCP，在 MCP 存活期间由真实
Chrome 打开同一 Task 的 Workbench。它是 test-only 证据补强，不改产品运行时、协议、
Provider 或强写策略。

## 改动策略

- 泛化现有 `resumeInstalledAlpha`，让同一套严格 Surface 断言分别运行于 Codex 与
  Claude official active cache；原 Claude、v2、pinned-v1、remove/Doctor 链不删减。
- Codex authority 绑定 official add 返回的 `installedPath`、唯一 active list entry、
  MCP list/get、Doctor、cache 内 CLI SHA 与 Dashboard manifest；fresh MCP executable
  必须 realpath 落在该 cache 内。
- Codex 与 Claude 使用两个全新的 Chrome profile，避免 loopback HttpOnly cookie
  因 host 共享而跨端口串会话。
- 导航前验证 exact loopback Task route、`planned_changes` section、bounded base64url
  fragment；导航后验证 fragment 被清除。
- Browser harness 只暴露窄化的 CDP `Network.getCookies` 安全投影，不返回 raw value。
  E2E 验证唯一 `workbench_session` 的 domain/path/HttpOnly/Secure/session/SameSite，且
  页面 JavaScript 不可见该 cookie。
- 从 active cache 的 Dashboard index 解析 hashed React entry，比较本地 bytes SHA 与
  Chrome 实际 fetch bytes SHA；随后闭合 exact Task revision/Snapshot、Finding、Evidence、
  Source hash/range/node、Graph focus、Wiki 与 Back-to-Task。
- Browser 始终在对应 MCP child 存活期内运行，先关闭 Browser，再由 stdin EOF 验证
  wrapper/child clean exit。

## 改动范围

| 模块/职责 | 文件 | 做了什么 |
|---|---|---|
| Browser harness | `packages/preview/test/browser-harness.mjs` | 新增 target-session `Network.getCookies` 的脱敏安全投影 |
| 双 Host packed E2E | `packages/preview/test/plugin-clean-install.test.mjs` | 新增 Codex active-cache Workbench parity、双 profile、fragment/cookie/asset authority 断言 |

## Review 重点

1. **Host authority** — Codex Surface 必须来自 official active installedPath，不能从全局包、
   marketplace source 或 managed wrapper 启动。
2. **Fresh session** — Codex/Claude 各自启动 fresh MCP 和 fresh Chrome profile；Browser
   只能在对应 MCP child 存活期内使用。
3. **会话证明** — deep link 必须先含一次性 fragment，随后清除并建立唯一 exact-policy
   HttpOnly cookie；raw token/cookie value 不得进入 assertion 或 diagnostics。
4. **同 cache bytes** — Chrome 实际执行的 hashed React asset 必须与 active cache 文件
   SHA 精确一致。
5. **用户纵切** — 同一 persisted Task 的 revision/Snapshot/Finding/Evidence/Source/Graph/
   Wiki/Back 必须全部精确闭合，不能只证明 HTML 200。
6. **无回归** — 原 Claude Surface、双版本 lifecycle、pinned-v1 recovery、remove 与
   not_registered Doctor 断言必须原样保留。

## 已识别风险

终审结果：P0 0、P1 0、current-path executable P2 0、blocking Test Gap 0。

非阻塞残余：测试从 official installedPath 直接启动 MCP wrapper，并未证明 Codex/Claude
模型或聊天 UI 实际选择、调用 Tool；不构成 credentialed/model-selected 或 Gold/G2/G3/G4
证据。为防止日志泄密，harness 不导出 raw cookie value，因此本门禁证明成功授权与 cookie
policy，不证明 token 熵、value separation、replay/expiry、TTL、并发或 crash matrix。
Workbench 仅保证 MCP 进程存活期间可用，不证明 MCP 退出后的独立 rendezvous。

该切片也不证明原子 hot upgrade/downgrade、Claude zero residue、publisher authenticity、
签名、SBOM、trusted provenance、reproducibility、cross-platform、完整 Host 版本矩阵、
Provider Authority 或 execution fence；`strongWrites` 保持 locked，`releaseReady` 保持 false。

## 测试情况

- 两个改动文件 `node --check` 通过；scoped `git diff --check` 通过。
- 唯一 mandatory real Host + Chrome gate：
  `UNDERSTAND_CODE_REQUIRE_PLUGIN_HOSTS=1 UNDERSTAND_CODE_REQUIRE_REAL_BROWSER=1 pnpm --filter @understand-code/preview test:plugins`
- 结果：1/1 pass，0 fail，0 skip，34.862 秒。
- 普通 `test:plugins` 仍允许缺 Host 时 skip、缺 Browser 时省略 Surface；只有上述双 flag、
  0-skip 命令构成本切片证据。

## 结论

🟢 Effective。当前本机真实 Codex 与 Claude CLI 的官方 active cache 都可由 fresh MCP
直接启动；Codex 新增路径在真实 Chrome 中完成一次性 fragment → HttpOnly cookie、exact
active-cache React bytes、同 Task 的 Finding → Evidence → Source → Graph → Wiki → Task
纵切，且未削弱现有 Claude 与 Host lifecycle 覆盖。可以精确提交。
