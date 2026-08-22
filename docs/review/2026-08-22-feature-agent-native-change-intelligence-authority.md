# feature/agent-native-change-intelligence-authority Review Brief

> 生成时间：2026-08-22 13:33 CST
> 分支：feature/agent-native-change-intelligence-authority
> 基于 commit：0149293 feat: analyze staged added changes exactly

## 背景与动机

同一 Preview tgz 已分别证明真实 Codex/Claude Plugin cache 可运行 MCP，以及 managed wrapper 可打开 React Workbench；但两条证据此前未汇合。真实 Host cache 创建/恢复的 Task 尚未被同一 active cache Workbench 精确投影到 Finding → Evidence → Source → Graph → Wiki。

本切片只关闭这条 credential-free mandatory Surface 证据缺口。它不把直接启动 cache MCP 误报为模型选择工具，也不关闭 Gold Set、Provider authority 或 `strongWrites`。

## 改动策略

- 保留现有真实 Codex/Claude CLI install、Doctor、version switching、pinned-v1 recovery 与 remove 链。
- 将 Codex v1 active cache 创建的 verified Task 固定为单一 `alpha` symbol plan，并返回 exact Finding/Evidence IDs。
- 从 Claude 官方 `plugin list --json` 唯一 active `installPath` 启动 fresh MCP，精确恢复同一 Task/revision/Snapshot 与 Verification replay。
- 在该 MCP 存活期间调用 `get_evidence`、`open_workbench`，用 fresh Chrome profile完成一次性 fragment → HttpOnly cookie handoff。
- 从 active Claude cache 的 Dashboard `index.html` 解析 hashed React entry，比较本地 cache SHA 与浏览器实际 HTTP response SHA，防止从 global/managed/其他 release 误取静态资源。
- 通过 cookie-auth JSON 和 UI同时验证 Task、Change Check、Finding、Evidence、Source、Graph focus、Wiki 与 canonical Back-to-Finding。

## 改动范围

| 模块/职责 | 文件 | 做了什么 |
|---|---|---|
| Mandatory Host Surface E2E | `packages/preview/test/plugin-clean-install.test.mjs` | active Codex Task → active Claude recovery → cache React Workbench Evidence/Graph/Wiki 浏览器闭环 |

## Review 重点

1. **Active cache authority** — Claude `installPath` 必须来自唯一 active官方注册；MCP executable realpath必须位于该 cache root，不能回退 global package、managed wrapper 或 release facade。
2. **Exact Dashboard bytes** — 浏览器加载的 hashed React entry pathname、HTTP 200 与 SHA-256 必须和 active cache 文件一致。
3. **Session safety** — fragment兑换后必须清空，session cookie不可从 `document.cookie` 读取；Browser必须在MCP child存活期内运行并先于MCP关闭。
4. **Cross-Host identity** — Task ID、verified revision、baseline/current Snapshot、Finding/Evidence ID、source range/hash/node及observed Snapshot必须跨Codex→Claude保持一致。
5. **Honest scope** — Graph精确聚焦、Wiki渲染、Back保留Task/Finding并退出Evidence subview；不外推为model-selected invocation、Gold或长期独立Workbench runtime。

## 已识别风险

未发现 P0、P1、current-path executable P2 或 blocking Test Gap。

非阻塞残余：测试仍是直接启动 Host cache MCP，不是 Codex/Claude 模型选择并调用工具；Workbench只在Claude active cache上打开，Codex负责创建Task；只证明MCP存活期间的session，不证明MCP退出后存活、user-level rendezvous/control、TTL/reuse/concurrency/crash。Gold/ALPHA-B Activation Gate、Provider authority 与 `strongWrites` 继续 locked。

## 测试情况

**已覆盖：**

- `node --check packages/preview/test/plugin-clean-install.test.mjs`。
- `git diff --check -- packages/preview/test/plugin-clean-install.test.mjs`。
- 强制真实双 Host + Browser gate：
  `UNDERSTAND_CODE_REQUIRE_PLUGIN_HOSTS=1 UNDERSTAND_CODE_REQUIRE_REAL_BROWSER=1 pnpm --filter @understand-code/preview test:plugins`。
- 结果：1/1 通过，0 failed，0 skipped；28.49 秒。
- active Claude cache Dashboard manifest与v1 tgz payload一致；hashed React asset网络响应与cache SHA一致。
- fragment清除、HttpOnly cookie、cookie-auth Task/Check/Evidence JSON均通过。
- exact Finding → Evidence → Source line/hash/node/Snapshot → Graph focus → Wiki → Back-to-Finding通过。
- 原v2 active cache replacement、Claude update、pinned-v1 reinstall、Task recovery、remove/uninstall与Doctor `not_registered`链保持通过。

**门禁说明：**

该新Workbench证据必须同时设置 `UNDERSTAND_CODE_REQUIRE_PLUGIN_HOSTS=1` 与 `UNDERSTAND_CODE_REQUIRE_REAL_BROWSER=1`；单独Host flag允许在无Chrome环境继续验证原Host lifecycle，但不能作为本切片Workbench通过证据。

## 结论

🟢 Effective。官方 active Codex cache 创建的verified Task已由官方 active Claude cache精确恢复，并在同一cache MCP存活期间完成React Workbench Finding → Evidence → Source → Graph → Wiki → Task纵切；可以精确提交。
