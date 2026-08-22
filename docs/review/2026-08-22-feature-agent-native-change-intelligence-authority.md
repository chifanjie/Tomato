# feature/agent-native-change-intelligence-authority Review Brief

> 生成时间：2026-08-22 CST
> 分支：feature/agent-native-change-intelligence-authority
> 基于 commit：d478a99 feat: analyze untracked additions safely

## 背景与动机

现有 CI 可以内联构建 Preview tgz 并运行 cold gate，但本地没有一个可复用的命令把
源码身份、锁文件、唯一 tgz、内嵌 release manifest、当前 native tuple 和 gate 结果
闭合成可传输、可复核的候选目录。直接把该产物称为 RC、Release、SBOM 或 provenance
又会超出当前证据。

本切片新增一个本地 **unsigned Alpha Candidate assembler**。它只证明当前本机 tuple
上、一次 clean source 构建得到的候选目录内部自洽；`releaseReady` 继续为 false，
Provider Authority 与 `strongWrites` 继续 locked。

## 改动策略

- `assemble --output <absolute-new-dir>` 要求 clean Git commit/tree、无 tracked 或
  untracked dirt、无 assume-unchanged/skip-worktree，并精确绑定 working/committed
  `pnpm-lock.yaml`。
- 构建子进程使用最小隔离环境，剥离 ambient `VITE_*`/secret 输入，并拒绝 Preview 与
  Dashboard 根目录下的 `.env*` 文件。
- 只执行一次 build、一次 `npm pack --ignore-scripts`，再把同一 tgz 传给既有 cold
  packed gate。
- verifier 使用有界的 in-process gzip/tar parser，校验 header checksum、entry type、
  link/path、raw/logical duplicate、entry count、单文件与 aggregate bytes；不调用系统
  tar 解包不可信归档。
- 输出固定为唯一 tgz、candidate JSON、reviewed schema 和 `SHA256SUMS` 四个 regular
  files；临时目录先自验，清理 tool root，最终再次核对 `.env*` 与 source state，然后
  一次 rename 原子发布。
- `verify --candidate <absolute-dir>` 校验 exact-four、schema/checksums、tgz package 与
  release/native 绑定，以及 manifest 记录的 Git commit/tree/lock objects。
- README 明确该目录是 unsigned Alpha Candidate；协同重写并重算 unsigned metadata
  无法被检测或认证。

## 改动范围

| 模块/职责 | 文件 | 做了什么 |
|---|---|---|
| Candidate assembler | `packages/preview/scripts/alpha-candidate.mjs` | clean-source capture、隔离 build/pack/cold、bounded verify、atomic publish |
| Public schema | `packages/preview/schemas/alpha-candidate-v1.schema.json` | strict candidate contract、32 MiB 上限、OID format/length 约束 |
| Package commands | `packages/preview/package.json` | candidate assemble/verify/focused scripts与typecheck接线 |
| Focused regression | `packages/preview/test/alpha-candidate.test.mjs` | 隔离 clone、真实 build/cold、no-leak、四类 single-bit tamper |
| Packaged guide | `packages/preview/README.md` | 使用命令、exact-four 输出与 unsigned 能力边界 |

## Review 重点

1. **源码绑定** — candidate 只能从 exact clean commit/tree 与 committed lock 构建；
   工作锁文件、index flags 或最终 source recapture 不一致都必须 fail closed。
2. **未记录输入** — ambient Vite 环境与 `.env*` 不得进入 Dashboard/CLI bytes，错误输出
   不得泄露路径、环境值或 secret。
3. **归档边界** — verifier 必须在解压、entry count、type、path、payload 和 aggregate
   bytes 上有界，且拒绝 symlink/hardlink/device/duplicate/PAX alias。
4. **单一产物** — build/pack/cold 必须使用同一 tgz；候选目录只有四个 regular files，
   checksum 与 embedded release/native identity 必须精确。
5. **发布恢复** — 所有 staging setup 都在 cleanup authority 内；tool cleanup 在最终
   source fence 之前完成，rename 后不能再因 fallible cleanup 把成功报告成失败。
6. **声明诚实性** — 该能力只证明 unsigned self-consistency，不得升级为 authenticity、
   provenance、reproducibility、cross-platform、RC 或 Release 结论。

## 已识别风险

终审结果：P0 0、P1 0、current-path executable P2 0、blocking Test Gap 0。

非阻塞残余：candidate metadata 与 checksums 未签名，协同重写并重算 metadata 无法被
认证；尚无 SBOM、trusted/SLSA provenance、可复现构建、第二个历史 tgz、跨平台或正式
RC/Release 证据。只验证当前 platform/native tuple；same-user TOCTOU 与完整 execution
fence 未建立。Provider Authority 与 `strongWrites` 保持 locked。

## 测试情况

- Preview package typecheck 通过。
- 唯一 Alpha Candidate focused：1/1，0 skip，60.37s。
- focused 使用完全隔离 clone，完成 frozen install、`.env.local` fail-close、唯一
  build/pack/cold、exact-four/source/release/native 绑定与 no-leak 检查。
- tgz、candidate JSON、schema、`SHA256SUMS` 四类 single-bit tamper 均被拒绝；恢复原
  bytes 后再次 verify 通过。
- final production/test `node --check` 与 scoped `git diff --check` 通过。
- 按切片策略未重复运行 Host/browser/full-package 重门。

## 结论

🟢 Effective。当前本机 tuple 现在可以从 clean source 生成一个边界明确、可传输、可
复核的 unsigned Alpha Candidate；失败路径保持有界和 fail closed，文档没有把它误报为
正式 Release、真实性或 provenance 证明。可以精确提交。
