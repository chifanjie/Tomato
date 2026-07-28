# Host Binding Evidence — 2026-07-28

本目录是 `docs/research/2026-07-28-host-binding-spike.md` 的版本化证据。`*-probe.json` 由当前分支的 `scripts/host-binding-probe.mjs` 生成；`*-session.json` 是受控 Host 启动器生成的最小化运行摘要，只保留启动配置、状态和 Tool Call 结果，不保留 Host stdout/stderr 原文。Session 摘要属于可复核的运行 attestation，不等同于 Host 自签名记录。

## 证据清单

| 文件 | Surface | 结论 |
|---|---|---|
| `capture-manifest.json` | 全部 | 固定 Probe 脚本 hash、Host/OS/Runtime 版本、artifact 配对与 operator-attested 启动配置 |
| `codex-app-server-probe.json` | Codex App Server `0.146.0-alpha.3.1` | handshake、tool list、真实 `report_host_binding` 调用成功；Client 未 advertise Roots |
| `codex-app-server-session.json` | 同上 | App Server 从 `/tmp` 启动、thread 指向仓库时，Probe cwd 跟随 thread cwd；该结论仅为当前路径 provisional evidence |
| `claude-code-probe.json` | Claude Code CLI `2.1.202` | handshake、tool/resource list、`CLAUDE_PROJECT_DIR` 与 primary Root 成功；未完成认证后的 Tool Call |
| `claude-code-add-dir-probe.json` | Claude Code CLI `2.1.202` + `--add-dir` | Roots 仍只含 launch directory，与官方 `<2.1.203` 兼容说明一致 |
| `claude-code-session.json` | Claude Code CLI `2.1.202` | 主 workspace 启动摘要；固定枚举记录 `not_logged_in`，故 authenticated Tool Call 未执行 |
| `claude-code-add-dir-session.json` | Claude Code CLI `2.1.202` + `--add-dir` | 记录 additional directory 已配置、basename/path digest 与同一认证失败类别，和 add-dir Probe 配对 |

Probe 有意保留 cwd、显式 Root、白名单 Host path 环境变量和 `file:` Roots，作为本 Spike 的路径证据。它不保留 argv、output path、未知环境变量、`_meta`、error data 或 Host 输出原文。该证据是最小化但未匿名的：绝对路径、PID 与精确时间仍属于主机元数据，不能依赖 Git checkout 权限保护；公开仓库发布前必须生成路径占位版。

## SHA-256

```text
14c57dabce6393af5529ddecb80a255ca8bb9bcc1aa89bb0a1220641efa2fe6d  claude-code-add-dir-probe.json
6fa24eed324a9f608c9c4c16df73ce11b4671fb5a322db2d77db7bf46fb4822f  claude-code-add-dir-session.json
507d7b52b12a780c11559d5c817da92551c8e78c3c45f40618c280f21c01b5d3  claude-code-probe.json
c91efbeb7fc72db65b9b189f19117c514f9671089b7fca630c4e93eb313891dc  claude-code-session.json
7697237dae1c95e5ff4115d57f3a2672748ee1b6a2331f40b43ab47b4e7e067c  codex-app-server-probe.json
67b14c2144756e96a4553d84b4d0f34854082bfaefaf4bac13eb6da5cb4caf4c  codex-app-server-session.json
6ccec4488558c8953e135999bdf5695c80bb45db3db92f99b55703dca00cc3af  capture-manifest.json
```

## 复核边界

- Codex 证据只覆盖当前 App Server 内部路径，不覆盖 Plugin clean install、CLI、Desktop UI 或 IDE。
- Claude 证据覆盖真实 CLI 启动和协议枚举，但本机未登录，因此不声称 authenticated Tool Call 成功。
- 绝对路径与 PID 只描述本次本机观测，不是产品最低版本或跨机器契约。
- 每个正式支持 Surface 仍需在 WP6/WP8 留存独立 clean-install、Root、Tool、upgrade 和 remove 证据。
