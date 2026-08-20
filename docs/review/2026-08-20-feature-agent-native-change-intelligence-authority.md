# feature/agent-native-change-intelligence-authority Review Brief

> 生成时间：2026-08-20 08:01
> 分支：feature/agent-native-change-intelligence-authority
> 基于 commit：d57e638 feat: add provider acceptance authority store

## 背景与动机

当前长期目标仍处于 Provider Gate/WP5 生产闭环步骤；本次短期交付是在不宣称正式 Release 的前提下，产出一个可安装、可冷测的 Preview Candidate。审查基线要求同一 tgz 同时提供本地 Graph/Wiki Preview 和严格冻结的三工具 MCP，且不得把后来加入的生命周期、Provider 私有入口或 native addon 带入 Preview Surface。

## 改动策略

CLI bundler 新增固定的 `full` / `preview_three_tool_v1` 编译档位。Preview 档使用独立 `preview-bin.ts` 与独立 argv parser，只保留 help、version、stdio MCP；编译期工具 profile 同时限制 `tools/list` 和 `tools/call`，并禁止复制 provider kernel-peer native asset。普通 CLI 继续使用原入口、11 工具与 native asset。Preview 构建从 clean workspace 只重建实际依赖，并由同一冻结 tgz 完成冷安装和 SHA-256 校验。

## 改动范围

| 模块/职责 | 文件 | 做了什么 |
|-----------|------|----------|
| CLI bundle profile | `packages/cli/scripts/build-bundle.mjs` | 固定 full/Preview 入口、工具 profile 与 native 复制策略 |
| Preview CLI Surface | `packages/cli/src/preview-bin.ts`, `packages/cli/src/preview-argv.ts` | 仅接受 help、version、`mcp --stdio`；拒绝 lifecycle/provider/private runtime 命令 |
| MCP 工具 Surface | `packages/cli/src/mcp/tool-registry.ts` | Preview 编译档精确限定 `get_repo_pulse`、`build_task_brief`、`get_task_brief` |
| 构建与回归门 | `packages/preview/scripts/build.mjs`, `packages/preview/test/cold-packed.test.mjs`, `packages/cli/test/*.test.ts`, `src/__tests__/quality-gate.test.mjs` | clean build、36-file tgz allowlist、命令/工具 negative gates、普通 CLI 与 root quality 回归 |

## Review 重点

1. **Surface 是否真正收窄** — Preview 必须从独立入口起包，而非只隐藏完整 CLI 的帮助文本。
2. **工具拒绝是否与广告一致** — `tools/list` 精确三个工具，额外八个 `tools/call` 也必须 fail closed。
3. **正式 CLI 是否保持兼容** — 默认 full profile 仍需保留 11 工具、生命周期命令和 native addon。
4. **artifact 是否同源可复现** — 唯一 tgz 必须在 monorepo 外完成 Demo、真实 root、MCP、CSP/安全门和 checksum 验证。

## 已识别风险

未发现 P0、P1、P2、阻塞问题或本次确认范围内的新增 Test Gap。

## 测试情况

**已覆盖：**

- root `build:all` 与 `typecheck` 通过。
- CLI full package：11 files / 80 tests 通过；默认 full Surface 与 native 冷包回归通过。
- Preview runtime：8/8 通过；CLI/tool/quality focused：12/12 与 10/10 通过。
- 唯一冻结 tgz：36 files、849,437 bytes；monorepo 外 cold test 1/1 通过。
- tgz SHA-256：`5d79aefa15bd658587ac26078b0228e16546d83f411c83b3b7dfea9d49bd6626`，checksum 校验通过。
- 独立 change-intent 终审：无 findings。

**缺失：**

- 本次确认的 Preview Candidate 范围内无缺失门禁；正式 real-browser Surface E2E 与 Provider Gate 仍按步骤 15–17 保持未完成，不能由本次 Preview 结果替代。

## 结论

🟢 Effective：Preview-only Surface、唯一 tgz 冷安装与普通 CLI 兼容性均已实证闭合，可以精确提交；该结论不等同于 tag、GitHub Release、Sites 部署或总目标完成。
