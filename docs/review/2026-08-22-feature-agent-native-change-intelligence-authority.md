# feature/agent-native-change-intelligence-authority Review Brief

> 生成时间：2026-08-22 CST
> 分支：feature/agent-native-change-intelligence-authority
> 基于 commit：9361c3e test: prove Codex active-cache workbench parity

## 背景与动机

现有 managed lifecycle 浏览器门禁虽然覆盖 install、upgrade、rollback 与 Task 恢复，但 v2
只是复制 v1 已安装目录后替换版本字符串、注入 Dashboard marker 的 synthetic release，没有
跨越第二个真实 npm tgz 边界。因此它无法证明“由另一份实际可安装包执行升级，再回滚到原包”
这一 mandatory package lifecycle。

本切片把 synthetic v2 替换为两个独立组装、校验和冷安装的
`unsigned_alpha_candidate`。它只增强真实发布包边界与恢复证据，不改生产 lifecycle、协议、
Provider 或强写策略。

## 改动策略

- 在隔离的 `--no-local` clean clone 中，把当前两份 reviewed packed tests 固化为诚实的
  ephemeral v1 commit；无论 overlay 是否为空都创建同一形态的 clean commit，并将 candidate
  manifest 绑定其 commit/tree，不冒充 direct HEAD provenance。
- 复用 `alpha-candidate.mjs assemble/verify` 分别生成 v1、v2：每份都执行 sanitized build、
  单次 pack、同一 tgz cold gate、自校验和 exact-four sidecars。
- v2 只允许五个 source delta：Preview package version、Codex plugin version、Claude plugin
  version、Claude marketplace version，以及 Dashboard source HTML lifecycle marker；禁止 patch
  dist 或打包后 manifest。
- `cold-packed.test.mjs` 从 tgz 内有界 `package/package.json` 解析 strict SemVer，使同一冷门禁
  能验证不同合法版本，同时继续把 CLI、MCP、release manifest、native、Dashboard 与双 Host
  payload 绑定到该版本和 tgz bytes。
- 两份 tgz 分别安装到独立 prefix。初始 v1 CLI 安装 managed root；停止 v1 MCP 后，必须由
  v2 cold-installed CLI 执行 upgrade，再启动 fresh v2 MCP；随后停止 v2 并显式 rollback。
- install、upgrade、rollback 三阶段逐字节比较 managed CLI、当前 native tuple、Dashboard
  manifest/inventory；rollback 额外恢复 installation manifest 和全部 v1-owned bytes。
- v1 首次冻结完整 Brief、Change Check、Verification artifact、Trace、Evidence/Source HTTP
  projection；v2 与 rollback 对五个完整对象 `deepEqual`，并继续验证 Task revision/Snapshot、
  Finding/Evidence/Verification 语义。
- Chrome 对 v2 与 rollback 后的当前 hashed React asset 主动 `no-store` fetch，并与各自 tgz
  冷安装目录中的本地 bytes SHA 精确比较，避免缓存或累计 network response 假绿。
- helper 失败时清理 clone/candidate；成功后删除 clone/node_modules，仅保留并输出两份已通过
  全链的 candidate tgz。

## 改动范围

| 模块/职责 | 文件 | 做了什么 |
|---|---|---|
| Packed cold gate | `packages/preview/test/cold-packed.test.mjs` | 从 tgz 解析有界 strict SemVer，移除三处 v1 版本硬编码 |
| Managed browser lifecycle | `packages/preview/test/workbench-browser-packed.test.mjs` | 组装/校验/冷装两份真实 candidate，执行 v1→v2→v1 exact continuity，并保留既有 Task/Workbench/stale/uninstall 全链 |

## Review 重点

1. **真实包 authority** — v1/v2 必须分别来自 clean source-bound Alpha Candidate 和独立
   cold install；upgrade executable 的 realpath 必须位于 v2 prefix。
2. **v2 source 边界** — 只有冻结的五个 source files 可变化，Dashboard marker 必须从 source
   build 进入 tgz，不能再次 patch dist。
3. **managed bytes** — CLI、native、Dashboard、manifest 在 upgrade 后必须等于 v2 tgz，在
   rollback 后必须等于 v1 tgz；rollback descriptor 必须消失。
4. **完整状态连续性** — 不能只比较 taskId 或 Finding ID；Brief/Check/Verification/Trace/
   Evidence 五个完整稳定 projection 必须在 v1、v2、rollback 间相等。
5. **浏览器 cache 防假绿** — v2 与 rollback 后都需从当前 origin 主动 fetch hashed asset，
   SHA 分别绑定 v2/v1 冷安装 bytes。
6. **失败与产物生命周期** — 失败不得遗留 clone/node_modules；成功日志指向的两份 tgz 必须
   仍存在并能独立复核 SHA/entry count。

## 已识别风险

终审结果：P0 0、P1 0、current-path executable P2 0、blocking Test Gap 0。

首轮重门在 v2 candidate build 后、cold 前失败：原测试版本
`0.1.0-preview.2+workbench.lifecycle-v2` 会让 npm 把 `+` 原样写入 tgz basename，而 Alpha
Candidate 的生产/schema 安全文件名合同禁止 `+`。修复选择 npm-safe 的合法 prerelease
`0.1.0-preview.2.workbench.lifecycle-v2`，并在 helper 入口增加同合同 fail-fast 断言；未放宽
assembler 或 schema。完整重门随后从头通过。

非阻塞残余：两份产物只是在当前本机 tuple 上生成的 unsigned Alpha test candidates；不是
正式 RC/Release，也不证明 signature、SBOM、SLSA/trusted provenance、reproducibility、
cross-platform 或 CI 发布。删除隔离 clone 后，ephemeral source commit 不是长期独立 verify
锚点。本切片也不证明 schema migration、原子/hot upgrade、crash recovery、官方 Host
marketplace upgrade、Provider authority 或 execution fence；`strongWrites` 保持 locked，
`releaseReady` 保持 false。

## 测试情况

**已覆盖：**

- Preview `typecheck`：通过。
- Preview fresh `build`：通过。
- 两个改动测试文件 `node --check`：通过。
- Scoped `git diff --check`：通过。
- 唯一真实浏览器门禁：
  `UNDERSTAND_CODE_REQUIRE_REAL_BROWSER=1 pnpm --filter @understand-code/preview test:workbench-browser`
- 结果：1/1 pass，0 fail，0 skip，385.958 秒。
- v1 tgz：87 entries，SHA256
  `cc327fe8ab2cdcf62bc8f2e8dd72f15203b0d286bd3a9115510dbda782ce47b2`。
- v2 tgz：87 entries，SHA256
  `03bd319743a0e8811eaa5c3fe931afa633c764d52df30b81bd84053bde519de5`。
- 独立 `shasum -a 256` 与 `tar -tzf | wc -l` 复核和测试输出一致。

**缺失：**

- 无本切片 blocking Test Gap；上述 nonclaims 继续作为后续 release/authority 工作，而不是本次
  Alpha continuity 的隐含声明。

## 结论

🟢 Effective。当前本机 tuple 上，两份独立、真实可安装且自校验的 unsigned Alpha tgz 已在
同一真实 Chrome 门禁中完成 v1 managed install → v2 cold-installed CLI upgrade → fresh
MCP/Workbench exact continuity → explicit rollback to exact v1，并保留原 Task、Verification、
Evidence、Graph/Wiki、stale 与 uninstall 链。可以精确提交。
