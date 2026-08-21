# feature/agent-native-change-intelligence-authority Review Brief

> 生成时间：2026-08-21 16:00 CST
> 分支：feature/agent-native-change-intelligence-authority
> 基于 commit：c35ab32 feat: connect Workbench evidence to source

## 背景与动机

Understand Code Alpha 已能从单一 tgz 在 monorepo 外完成安装、MCP、Graph/Wiki、
Pulse/Brief、修改、Check、externally reported Verification、Workbench、Doctor 与清理。
本切片补齐同一发行物的 Codex/Claude CLI Host 入口和统一版本身份，使两个 Agent 可以在
不同工作目录下通过同一显式仓库 Root 续接同一个持久化 Task。

## 改动策略

Preview 构建把 package version 注入 bundled CLI，并生成绑定 CLI、Preview、Host
entrypoint 的 Alpha release manifest。两个 Host bin 不查询 PATH，也不接受
`UNDERSTAND_CODE_CLI` 重定向，而是通过 `import.meta.url` 和 `process.execPath`
启动同包 CLI。现有 managed install、Doctor、Graph/Wiki 和完整 MCP happy path保持不变。

## 改动范围

| 模块/职责 | 文件 | 做了什么 |
|-----------|------|----------|
| 版本绑定 | `packages/cli/scripts/build-bundle.mjs`, `packages/cli/src/constants.ts` | 支持受校验的构建期 product version 注入，普通 CLI 构建保留 `0.1.0` fallback |
| Alpha 包装与发行清单 | `packages/preview/package.json`, `packages/preview/scripts/build.mjs`, `packages/preview/src/bin.mjs` | 发布双 Host bin、统一 Preview/CLI/MCP/managed install 版本、生成 release/Host manifests 与 executable digests |
| Host 入口 | `packages/preview/src/host-bin.mjs` | 严格解析绝对 `--root`，直接启动同包 MCP CLI，并转发 EOF/信号 |
| 仓外产品 E2E | `packages/preview/test/cold-packed.test.mjs` | 同一 tgz 验证 Codex 建 Task、Claude 不同 cwd 续读、managed wrapper、Doctor、卸载、版本与 digest |
| 用户边界 | `packages/preview/README.md` | 记录双 Host 用法、artifact traceability 与非 Release/非 strong-write 边界 |

## Review 重点

1. Host 入口必须绑定同一 tgz 的 CLI，不能被 cwd、PATH 或旧环境变量重定向。
2. 单一版本必须贯穿 package、Preview、MCP、managed installation、release/Host manifests。
3. 冷测必须消费唯一预生成 tgz，并保留原 Graph/Wiki、managed wrapper、Doctor、卸载断言。
4. 本切片不能被误报为正式 Plugin、签名发行或 Provider-backed strong write。

## 已识别风险

未发现 P0/P1/P2 或阻塞问题。

## 测试情况

**已覆盖：**

- CLI typecheck 与完整 package tests：11 files / 80 tests。
- Preview typecheck/build 与 runtime tests：8/8。
- 单一 tgz：44 entries，1,094,957 bytes，SHA-256
  `cdb2b9d1eb37f00b91981562202832b1c9e9beb1e02374ba17fe2c7c5022ac7e`。
- 该精确 tgz 的 monorepo 外 cold E2E：1/1。
- Codex Host 完成真实 Alpha Task 流程；EOF 后 Claude Host 从不同 cwd 读取同一 Task、
  baseline、revision、verified status 和当前 Snapshot。
- managed wrapper initialize/EOF、Doctor healthy、uninstall owned-file cleanup，以及
  missing/relative/unexpanded Root fail-closed。
- staged diff-check 与独立只读审查：通过，无 findings。

**缺失/后置：**

- 正式 Codex/Claude Plugin manifest 与真实 Host harness。
- 两个真实版本 tgz 的 upgrade/rollback/downgrade。
- Node/Git/repository/artifact/port 的完整 Doctor。
- 签名、SBOM、provenance、跨平台与完整 crash/security/performance gates。
- Provider Authority、execution fence、global rollback anchor 与 `strongWrites` 仍 locked。

## 结论

🟢 Effective：改动达成“单一安装产物的双 Host Alpha 生命周期”意图，可提交并推送。
它提供可运行的 CLI/MCP Host 入口和可追溯 Alpha artifact，但不构成正式 Plugin 或 Release，
也不解锁 Provider-backed `strongWrites`。
