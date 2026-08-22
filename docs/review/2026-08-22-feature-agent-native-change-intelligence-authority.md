# feature/agent-native-change-intelligence-authority Review Brief

> 生成时间：2026-08-22 CST
> 分支：feature/agent-native-change-intelligence-authority
> 基于 commit：408a85e feat: make verification retries recoverable

## 背景与目标

单一 Preview tgz 已能安装 Codex 与 Claude Code Plugin，并从两个 Host 的真实缓存启动同版本 MCP；但用户完成安装后，
现有 Release Doctor 仍固定显示 `hostRegistration: not_checked`。当 Plugin 未注册、被禁用、版本漂移或 MCP 配置残留时，
用户无法从 Understand Code 获得明确、脱敏、可操作的诊断。

本切片新增独立的 `understand-code doctor --host codex|claude`。它只读询问目标 Host 当前报告的 Plugin 状态，验证
canonical registration、产品版本、enabled 与 bundled MCP profile；不改变 zero-argument Release Doctor、managed
installation Doctor 或 Provider Doctor，也不把 Host 注册提升为 provenance、authority 或 execution fence。

## 实现策略

- `doctor --host codex|claude` 与 `--root`、`--home`、`--provider`、`--provider-service` 和全部 service flags 互斥；
  argv 配置错误保持 exit 2。
- Host probe 使用固定 argv 的 `execFile`，无 shell，固定临时 cwd、5 秒默认超时、30 秒硬上限、1 MiB 输出上限，
  且只传递 allowlist 环境变量。
- Codex 只读取 `plugin list --json` 与 `mcp list --json`；Claude 只读取 `plugin list --json` 内的 `mcpServers`，
  不调用可能启动或健康探测 MCP 的文本命令。
- JSON 允许 additive 字段，但 canonical ID、已知字段类型、exact-one registration、版本、enabled、stdio command/args
  必须严格匹配；重复、畸形、drift 与 orphan MCP 均 fail closed。
- 稳定结果区分 `healthy`、`not_registered`、`unhealthy` 与 `unavailable`；只有 healthy 返回 `ok: true` / exit 0，
  其他诊断返回 JSON / exit 1。
- 输出不包含 source、marketplace source、install path、时间戳、原始 stdout/stderr、环境或用户路径；顶层始终明确
  `readiness: alpha`、`releaseReady: false`、`strongWrites: locked`。

## 改动范围

| 模块 | 主要文件 | 作用 |
|---|---|---|
| CLI command | `packages/cli/src/argv.ts`、`bin.ts`、`index.ts` | 新 Host Doctor 路由，保留既有 Doctor 行为 |
| Host diagnostic | `packages/cli/src/host-registration-doctor.ts` | bounded Host probes、严格投影、稳定脱敏结果 |
| Focused tests | `packages/cli/test/argv.test.ts`、`host-registration-doctor.test.ts` | healthy、absence/orphan、version drift、timeout/redaction 与 argv 互斥 |
| Packed E2E | `packages/preview/test/plugin-clean-install.test.mjs` | 同一 tgz 的双 Host install→Doctor→MCP→remove→Doctor |
| User docs | `packages/preview/README.md` | 安装后诊断命令与 capability boundary |

## Review 结论

🟢 Effective。独立跨 Host 边界复审未发现 P0、P1 或 current-surface P2 blocking finding：

1. 新 Host selector 不会误入 Release、managed 或 Provider Doctor，冲突参数全部 fail fast。
2. Codex clean absence 与 orphan MCP 被区分；duplicate、invalid JSON、版本、enabled 和 MCP drift 不会误报 healthy。
3. Claude 不执行 `mcp list/get`，不会由 Doctor 意外启动 MCP；只消费 Plugin list 的 bounded JSON 投影。
4. 子进程固定参数、无 shell、超时与输出有界；公开结果没有原始 Host 字段或本机路径。
5. 真实 E2E 从仓外安装产物运行 Doctor，随后实际启动 Host cache 内 MCP；remove 后再次得到 not_registered，
   不是只比较安装文件的 false-green。

## 门禁证据

- CLI typecheck/build。
- CLI package：13 files / 93 tests。
- Preview typecheck/build。
- 强制真实 Host packed E2E：1/1，0 skipped；Codex 与 Claude 均完成 install→healthy Doctor→cached MCP
  Alpha/Task 路径→remove/uninstall→not_registered Doctor。
- `git diff --check` 通过。

## 明确限制与后续 backlog

- `registered` 仅表示当前 PATH 命中的 Host CLI 报告一个 canonical registration；不证明 tgz provenance、签名、
  Host 二进制身份、authority 或 execution fence。
- Host CLI JSON 是外部兼容面；未来字段可 additive，但必需字段变化会保守返回 unavailable/unhealthy，需随受支持版本更新。
- 两次 Codex JSON probe 之间没有 Host 侧原子 Snapshot；外部状态竞态会产生保守失败，不会产生强注册证明。
- 真实 credentialed/model-selected Host Tool call、正式 Gold Set、Host upgrade/reload/downgrade、SBOM/provenance/signing、
  跨平台发行加固与 Provider strong-write gate 仍属后续里程碑；`strongWrites` 继续 locked。

## 最终判断

用户现在可以在安装后运行同一条 Understand Code CLI，明确知道 Codex 或 Claude Code 是否注册了正确版本、是否启用、
MCP 配置是否匹配；清理后也能得到稳定的 not_registered 结果。该能力直接关闭了安装与实际 Host 可调用之间的诊断断点，
同时没有扩大信任声明，适合精确提交。
