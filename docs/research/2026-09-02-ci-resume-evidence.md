# 2026-09-02 续跑：CI 与 unsigned Alpha candidate 证据

## 状态边界

本记录补充已有 checkpoint，不覆盖尚未提交的 PRD、G0、WP5 或 Step 16 文档。
原北京时间 2026-09-02 11:00 截止目标未达成；本记录不自动修改用户目标或
宣布 17 步完成。测试断言通过、CI job 成功、正式 Gold 通过和 Release Ready
是不同结论，必须分别有证据。

## 2026-09-03 续跑：最新提交的增量证据

当前续跑提交为 `e5e7411e6ceefad5461ef68eaf2a1aedce390fd2`，对应
[Actions run 33731876155](https://github.com/chifanjie/Tomato/actions/runs/33731876155)。
截至已取得的 job 结果，Workspace quality gate（job `100573613924`）于
2026-09-03 16:38:24（北京时间）成功，Native SafeGit bridge 的 Ubuntu 与
macOS 两个 job 也成功；Provider unit、C09 aggregate 及其下游 production
尚未取得终态，不能据此写成整轮 CI 或 Quality gate 通过。后续 GitHub API
查询遇到失效令牌/速率限制返回的 404，不能把它解释为 run 失败。

在独立、干净 clone 上以同一提交重新组装并验证了最新 unsigned Alpha candidate：
`/Users/example/understand-code-deliverables/alpha-e5e7411e`。assemble 与 verify
均返回 `ok=true`、`disposition=unsigned_alpha_candidate`、
`releaseReady=false`；tarball SHA-256 仍为
`72840d0656703996e4b4ba823141561646d3fe47ec5a30e54eaf126dc0439b12`，manifest
明确记录 source commit `e5e7411e6ceefad5461ef68eaf2a1aedce390fd2`、
source tree `5823709201b6b55ade7697334bf3beb785d27b99`。signature、SBOM、trusted
provenance 与 cross-platform 仍未提供，这个候选包不等于正式 Release。

本次续跑的本地增量门也已复核：runtime package typecheck 通过；Provider C09
focused runner 的 20/20 required assertions 通过（该命令不包含完整 aggregate、
distribution 或生产 Linux）；Step15-C `strong-production-change-intelligence.e2e`
的 3/3 通过，覆盖 deterministic/unknown Delta、TOCTOU/crash replay 与空变更
收口。对同一候选包解压运行 packaged CLI Doctor 时，package metadata、release
manifest、bundle integrity、native tuple 和 Codex/Claude payload 检查通过，
但开发环境的 artifact schema 不兼容，release authenticity/provider strong writes
仍 locked，整体 `healthy=false`/exit 1；这与 unsigned、非已安装 Release 的状态一致。

后续一次只读增量复核仍在同一提交上通过：runtime integration 为 5/5，Step15-C
垂直回归为 3/3，Provider Doctor 与 Release Doctor 定向测试合计 4/4。C09
focused runner 再次报告 20/20 required manifest assertions；这些命令都没有
替代完整 Provider aggregate、Linux production、真实 Host 或 Gold 执行，工作树
也没有因此产生新的 tracked/untracked 改动。

## 已提交的定点修复

| Commit | 范围 | 本地证据 | 远端证据/限制 |
| --- | --- | --- | --- |
| `3c1adb2` | Host stdout 暂停读取 fixture：同步写 transcript 前缀，排队 padding 后明确退出 | host-adapters：116 passed、33 平台 skip；typecheck 通过 | 后续 Workspace job 的 host-adapters 阶段通过 |
| `8ab4dc9` | 只为 cold consumer TypeScript probe 设置 4096 MiB heap；拆分 lifecycle-token source override 两类断言 | contracts `test:distribution` 通过；Provider 两个目标测试及 typecheck 通过 | 下一轮 Workspace 未运行到 distribution；Provider RPC 超时仍存在，不能视为已修好 |
| `aefd82e` | 两个完整 68-schema 矩阵显式使用 15 秒测试预算；增加 macOS 失败时只读 Git 路径/权限/ACL 诊断 | json-schema 全文件 4/4 通过，contracts typecheck 通过；workflow YAML 解析及原样本地诊断通过 | 已推送，等待同 SHA 的远端结果 |

以上未放宽生产 Guard、减少 schema/fixture 覆盖、跳过失败测试或更改主机权限。

## 最近一轮完整 CI：仍失败

运行：[33606325694](https://github.com/chifanjie/Tomato/actions/runs/33606325694)，
源码 `8ab4dc974bf9296558028ab0206e7640bf82221f`，
2026-09-02 07:59:14–08:47:47 UTC。

| Gate | 结果 | 已观察到的原因或边界 |
| --- | --- | --- |
| Native SafeGit / Ubuntu | success | 此 runner 上 native gate 通过；不外推至其他 OS/filesystem |
| Native SafeGit / macOS | failure | canonical Git admission 被拒；精确原因待新诊断，不先假定为 ACL、所有者或 Xcode 路径问题 |
| Workspace | failure | contracts 全量 structural schema example 测试 5059 ms，超过默认 5000 ms；188 passed / 1 failed |
| Provider unit | failure | 94 files、1002 tests passed，但存在一个 `[vitest-worker]: Timeout calling "onTaskUpdate"` 未处理错误；总耗时 2770.47 s |
| Provider C09 aggregate | failure | 08:47:42 UTC 结束；不能以其中通过的断言代替 aggregate success |
| Provider distribution / production Linux-ext4 / Preview candidate | skipped | 上游失败；本轮没有这些门的成功证据 |

Workspace 命令顺序为 build → verify:schemas → verify:fixtures → Vitest →
test:distribution。因此本轮在 Vitest 退出，**没有验证**此前 TypeScript
consumer probe 的 4 GiB heap 修复。已观察到远端任务实际执行，旧 CI 计费阻塞不再适用。

## 后续 macOS 诊断：unsafe namespace 已证实

后续运行：[33611504317](https://github.com/chifanjie/Tomato/actions/runs/33611504317)，
源码 `aefd82e56dc9c44b7b104bdfb4cb32a4db759b61`。
macOS job `100187485148` 在 08:58:24 UTC 失败，但 failure-only 诊断成功执行：

| 对象 | 观察值 |
| --- | --- |
| 默认 `xcrun --find git` | `/Applications/Xcode_26.6.app/Contents/Developer/usr/bin/git` |
| `/Applications` | uid 0 / gid 80 / mode 775（组可写） |
| Xcode app、Contents、Developer、usr、bin 及 Git | uid 501 / gid 20 / mode 755（runner 持有） |
| Command Line Tools Git | `/Library/Developer/CommandLineTools/usr/bin/git` |
| CLT 路径的 `/Library` 起全部祖先及 Git | uid 0 / gid 0 / mode 755 |
| CLT Git 文件 | nlink 1，7,604,272 bytes |
| 两组路径的 native ACL 检查 | 均 `accepted`，这不替代 uid/mode 等其他 admission 条件 |

因此默认 Xcode Git 不满足可信命名空间要求；不应修改 Guard 接受它。最小候选修复是
仅在 macOS CI native job 中选择系统已有的 CLT developer directory，再执行原有完整
正向和拒绝测试。此处的 metadata 不是修复后的 CI pass，也不外推 CLT 在其他机器上
必然可用。不得 chmod/chown 或全局切换用户机器的 Xcode。

Provider RPC 的根因仍待证实：另一个耗时 71 秒的 standalone 测试已经使用异步
`spawn`，因此不能单凭总时长推断它阻塞事件循环，也不应重复做“改异步”修复。

随后提交 `9f1ab38` 将 CLI Provider Doctor 测试夹具的服务目录显式设为当前测试
进程 UID/GID，并把 executable identity 固定到夹具根目录内的 0700 文件。对应 CI
运行 `33620907445` 的 Workspace quality gate 成功（25 files / 241 tests），Native
Ubuntu/macOS 也成功；这证明了此前 CI-only 的 socket group 与 hosted toolcache
executable identity 差异已被夹具修复。该运行的 Provider unit 仍为 94/94 files、
1002/1002 tests 通过但有一个未处理的 Vitest `onTaskUpdate` 超时，C09 aggregate
同样因 all-vitest 子进程 exit 1 失败。

对失败日志按单测耗时定位后，`provider-feasibility-evidence-point-fixtures.test.ts`
的“227 recipes”单测在 Ubuntu 约 95 秒，超过 Vitest worker 默认 60 秒 RPC 预算。
提交 `894ede3` 将其拆成 8 个最多 32 条的 shard（最后 3 条），保持每条原有
witness/diagnostic/opaque-error/crypto 计数和总覆盖 227 不变；本地该文件 12/12
通过，最长 shard 约 8.6 秒。新运行 `33626103056`（HEAD `894ede3`）正在等待
Workspace、Provider unit 与 C09 的远端终态，未提前宣称通过。

在修正 workflow 自检预算后，运行 `33613860801`（源码 `1a4cb4a`）已观察到
Native SafeGit Ubuntu 与 macOS 均 success；Provider unit、C09 aggregate 和
Workspace 仍在运行。本记录不把尚未结束的 job 计为通过。

当前 HEAD 的本机 Surface Release gate 也重新执行成功：Workbench browser
`1/1`，插件生命周期 `7 passed / 2 platform skips`。它由脚本自行构建当前
candidate，并不提供真实 Codex/Claude 模型会话，也不改变远端 CI、Gold 或 Release
签名状态。

当前开发工作树运行 Release Doctor 的结果为：
`{"ok":false,"status":"not_installed","root":"/Users/example/understand-code"}`。
这是预期的开发目录状态，但也直接证明这里不是已安装、可发布的 Release 根目录。

## 可交付的本地候选包

从独立、干净、固定 commit 的 clone 安装依赖并执行：

```sh
node packages/preview/scripts/alpha-candidate.mjs assemble --output <candidate-dir>
node packages/preview/scripts/alpha-candidate.mjs verify --candidate <candidate-dir>
```

assemble 和 verify 均返回：

```json
{"ok":true,"disposition":"unsigned_alpha_candidate","releaseReady":false}
```

候选包复制到以下本地持久目录后再次 verify 成功：

`/Users/example/understand-code-deliverables/alpha-aefd82e`

该目录只有合同规定的四个文件：tarball、candidate manifest、candidate schema、
`SHA256SUMS`。校验表中三个 SHA-256 条目均匹配。

| 字段 | 值 |
| --- | --- |
| 包 | `@understand-code/preview@0.1.0-preview.1` |
| Tarball | `understand-code-preview-0.1.0-preview.1.tgz`，3,231,282 bytes |
| Tarball SHA-256 | `72840d0656703996e4b4ba823141561646d3fe47ec5a30e54eaf126dc0439b12` |
| Source commit | `aefd82e56dc9c44b7b104bdfb4cb32a4db759b61` |
| Source tree | `91f72d7e6b752e29bf798836e082c76ec940e5e8` |
| Source clean | `true`（独立 clone，不代表用户原工作树无改动） |
| 构建环境 | macOS arm64；Node v26.0.0；npm 11.12.1；pnpm 11.2.2 |
| 已通过 | coldPacked、checksum、source-aware candidate verify |
| 未提供/未评估 | signature、SBOM、trusted provenance；crossPlatform 未评估 |

这不是 Node 22/Linux 冷安装证据，也不是签名正式发行物；checksum 只能校验内容，
不能代替发布者身份、可信 provenance、Gold 或 mandatory Surface Release Gate。
复制后的 source-aware verify 仍需本仓库中的源 commit 与 schema。

## 2026-09-04 当前 HEAD 的完整 C09 本地复核

在当前根仓库 `0035d2376085dcd46d3ef13fb90b7dfa2370f998` 上重新执行：

```sh
CI=true pnpm --filter @understand-code/durable-object-provider-contracts test:c09-aggregate
```

结果为退出码 `0`：package build、package typecheck、全量 Provider Vitest、packed
distribution 以及 manifest 要求的 20 个覆盖断言全部通过。distribution dedicated
gate 报告 `wallTimeMs=216319.1`、峰值同采样进程树 RSS `1477443584` bytes、4241
个样本，低于规范的 1536 MiB 上限；原三条 Node lane 与三条 browser lane 配置未
改变。该结果是当前 macOS 本地完整 aggregate 证据，不替代 Node 22/Linux CI、真实
Host、Gold 或正式 Release；远端 run `33864744556` 的最终 job 仍因 GitHub 凭证失效
无法读取。

## 2026-09-04 当前 HEAD 的 preview 包隔离回归

在不含用户未提交文件的 clean clone `/tmp/understand-code-clean-0035d23` 中执行：

```sh
CI=true pnpm --filter @understand-code/preview test
```

命令退出码 `0`。结果为 runtime 8/8 通过，plugin-clean-install 7/7 通过且 2 个
明确的 Linux-only execve 用例按平台跳过，cold-packed 1/1 通过；构建阶段也成功。
这证明当前 HEAD 的预览包在本机 clean-install 路径可复核，但不能替代 Linux CI、
真实 Host/Gold 或签名 Release 验收。

## 2026-09-04 clean clone Surface Release gate

在同一 clean clone `/tmp/understand-code-clean-0035d23` 执行：

```sh
CI=true pnpm --filter @understand-code/preview test:surface-release
```

退出码为 `0`。packed candidate surface probe `1/1` 通过（candidate commit
`0035d2376085dcd46d3ef13fb90b7dfa2370f998`、tree
`9551a756ce18ee25b219729abef2f40be8f33d7e`、tarball SHA-256
`sha256:72840d0656703996e4b4ba823141561646d3fe47ec5a30e54eaf126dc0439b12`），插件
生命周期 7/7 通过，2 个明确的 Linux-only execve 用例跳过。该 gate 是本地
candidate 的 surface/生命周期核验，不等同于真实 Codex/Claude 登录、Gold 或签名
正式发行。

## 2026-09-04 disposable Alpine Linux 诊断

在不改宿主仓库的 Lima disposable VM（Alpine Linux 3.23.3、aarch64/musl、Node
v24.18.1）中安装 `procps-ng 4.0.5-r0` 后，`ps -axo pid=,ppid=,pgid=` 的字段
兼容性校验通过；平台匹配的 Rollup optional package 补齐后，当前 HEAD 的 build
通过，并成功进入 C09 dedicated RSS monitor、Vitest replay、3 个 browser replay
lane 及 packed runtime probes。完整 gate 在 `verify:all` 前置阶段达到外层 660 秒
保护而未出终态；后续 distribution-only 诊断已进入 replay，但在约 9 分 30 秒时
按有界观察策略停止，未取得通过/失败退出码。因此这项证据只证明 Linux 启动和
replay 路径可达，不能宣称 Linux CI 或 C09 gate 通过；宿主仓库、脚本和 lockfile
均未修改。

随后用 POSIX `timeout` 在同一临时副本再做一次 distribution-only probe：
`/usr/bin/time -v /usr/bin/timeout -k 15s 720s node scripts/test-distribution.mjs`。
该次到达 12 分钟硬上限，`timeout` 退出码 `124`（不是测试自身终态），shell wall
约 `697s`，最大 RSS `1,359,844 KB`（约 1.30 GiB，低于 1.536 GiB 上限）；无自然
通过/失败输出，残留进程已清理。因此 Linux 证据仍只到“可启动并执行 replay、资源
峰值在限额内”，不构成 distribution gate pass。

## 2026-09-04 初始项目结构不偏离复核

以续跑基线 `e5e7411e6ceefad5461ef68eaf2a1aedce390fd2` 与当前 HEAD
`0035d2376085dcd46d3ef13fb90b7dfa2370f998` 做只读 Git tree 比较：顶层目录集合
完全一致，`pnpm-workspace.yaml` 字节一致（仍为 `packages/*`），递归 tracked 路径数
均为 `1737`。两者之间只有一个既有脚本文件的修改：
`packages/durable-object-provider-contracts/scripts/test-distribution.mjs`；没有新增、
删除、重命名或目录迁移。工作树中其他文档、夹具和 `site/` 变化均为用户已有的
未提交内容，未被本次候选构建覆盖或重写。

## 2026-09-04 当前 HEAD 的 unsigned Alpha candidate

为避免把用户工作树的未提交文件带入候选包，从当前 HEAD
`0035d2376085dcd46d3ef13fb90b7dfa2370f998` 建立独立 clean clone，执行：

```sh
node packages/preview/scripts/alpha-candidate.mjs assemble --output /Users/example/understand-code-deliverables/alpha-0035d23
node packages/preview/scripts/alpha-candidate.mjs verify --candidate /Users/example/understand-code-deliverables/alpha-0035d23
```

两条命令均退出码 `0`，返回 `ok:true`；候选包 manifest 明确标记
`disposition=unsigned_alpha_candidate`、`releaseReady=false`，源 commit 为上述
当前 HEAD，source tree 为 `9551a756ce18ee25b219729abef2f40be8f33d7e`，构建平台为
`darwin-arm64`。目录仅含合同规定的 schema、candidate manifest、tarball 和
`SHA256SUMS`；三项 SHA-256 校验均为 `OK`，tarball digest 为
`72840d0656703996e4b4ba823141561646d3fe47ec5a30e54eaf126dc0439b12`。

该产物是当前 HEAD 的可复核 unsigned Alpha candidate，不是签名正式发行物；manifest
仍明确记录 signature、SBOM、trusted provenance 未提供，cross-platform 未评估，不能
替代第 17 步 Release 验收。

同一 clean clone 的 `CI=true pnpm --filter @understand-code/preview test:alpha-candidate`
也退出码 `0`（1/1），再次证明 candidate assemble/verify 对 exact clean source 的
合同测试通过。

当前开发根的 `node packages/cli/dist/bin.js doctor` 仍退出码 `1`，并报告
`readiness=alpha`、`releaseReady=false`、`strongWrites=locked`、`ok=false`；artifact
schema、package/release metadata、bundle/native tuple 和两个 Plugin payload 尚未
构成已安装 Release，release authenticity 也保持 locked。这是预期的开发树状态，
不是把 unsigned candidate 宣称为正式发行的依据。

在固定 HEAD 的 clean clone `/tmp/understand-code-clean-0035d23` 中补跑原 PRD 的
Dashboard/活跃表面验收：`pnpm --filter @understand-code/dashboard audit:surface
-- --json` 报告 `forbiddenReachable=[]`；Dashboard Vitest 为 56 files / 612 tests
全部通过，Dashboard production build 和 `tsc -b --pretty false` 也通过。该组命令
没有修改宿主工作树，补齐了本地 Step 15/16 的可执行证据；仍不能替代真实多 viewport
人工验收、Host/Gold 或正式 Release。

D-43 的两个 public/wire focused 文件也在同一 clean clone 复核：2 files / 2 tests
全部通过（`--maxWorkers=1`）。这只证明当前 none-authority reference candidate 的
focused 合同实现存在；D-43 正式 implementation evidence 仍要求 externally
Root-signed Catalog，不能由本地 fixture 或测试晋级。

另外对 `packages/preview/dist/release-manifest.json` 做只读摘要核验：release schema、
package/version、CLI/Preview/native/runtime、Codex/Claude 两组 plugin digest 以及
Dashboard inventory 均与实际文件一致，共 22 个 digest 检查、15 个 Dashboard 文件，
结果 `ok:true`。这加强了构建产物完整性证据，但仍不提供签名者身份或 provenance。

`CI=true pnpm --filter @understand-code/preview test:workbench-browser` 也在 clean
clone 退出码 `0`（packed Workbench browser probe 1/1；candidate commit/tree 与
tarball digest 均被重新核对）。该 probe 仍是自动化本地 surface 证据，不替代真实
多 viewport 人工验收或 Host/Gold。

根仓库 clean clone 的 `pnpm quality` 先完成 `build:all` 与 `typecheck`，随后进入
`test:c09-aggregate` 的 all-package Vitest；运行约 1,183 秒仍未自然结束，按保护线
停止并返回 `143`（SIGTERM），没有失败输出。该结果只能记录为“构建/类型检查通过，
完整 quality 未取得终态”；单独自然退出码为 `0` 的 C09 aggregate 证据不与此混淆。

为确认该现象不是 quality 串行链专属，随后在同一 clean clone 直接重跑
`CI=true pnpm --filter @understand-code/durable-object-provider-contracts test:c09-aggregate`；
全量 Vitest 运行 20 分钟仍无终态，按有界策略以 SIGINT 停止（pnpm exit `1`，子进程
为 SIGINT），无失败断言输出。此仅是 clean-clone 诊断；此前当前开发树上自然退出码
`0` 的完整 C09 aggregate 仍是已取得的 macOS 证据，不能将本次超时诊断解释成语义
通过或语义失败。

## 仍不能代替的验收输入

- 隔离 Linux Host 的 Codex `login status` 返回 `Not logged in`；Claude
  `auth status` 返回 `loggedIn: false`。本次仅查询状态，未读取/迁移凭据或调用模型。
- 权威 `alpha-gold-task-corpus-v1.json` 仍为 `blocked_not_versioned`：
  ALPHA-A 18 个、ALPHA-B 6 个槽位尚无版本化、双人复核后的任务定义。
- ALPHA-B 固定仓库须有明确 Owner 授权，并维持 local-only；不复制源代码、
  私有证据或绝对路径。当前项目授权不自动替代该授权。
- Gold runner 要求 G2 至少 12 个真实任务/1 个 Host；G3 要求 24 个任务 × 2 个
  Host = 48 次真实执行及 Artifact/Task/revision identity 一致，禁止 synthetic 替代。
- 起草任务、子代理审查和 fixture 测试都不能冒充真人签署或正式 Gold 执行。

## 下一步与可复用入口

1. 依据 `aefd82e` CI 的 macOS metadata 验证 CLT-only CI 配置；不使用 chmod/chown、
   跳过 admission 或放宽 Guard 的方式换取绿灯。
2. 继续定位 Provider `onTaskUpdate`：拆分长测试后仍复现，需要证据证明新的修复，
   不能只增加整体 timeout 或忽略 unhandled error。
3. 用新的 CI 确认 schema 测试和 distribution probe；保持长任务运行，不因短暂
   GitHub 网络错误重启整轮 CI。
4. 准备 ALPHA-A 未批准任务草案供真实复核；获得 Host 登录、两人复核及 ALPHA-B
   Owner 授权后再激活权威任务定义和真实 Gold 执行。

相关入口：`packages/contracts/fixtures/v1/golden/alpha-gold-task-corpus-v1.json`、
`alpha-gold-runner-contract-v1.json`、`packages/preview/scripts/alpha-candidate.mjs`、
`.github/workflows/ci.yml`。

## 2026-09-04 本次续跑收口摘要

- 结构：当前 HEAD `0035d2376085dcd46d3ef13fb90b7dfa2370f998` 与最初基线的目录、
  workspace 和 tracked 路径集合一致；用户工作树既有改动未被覆盖。
- 本地：完整 C09 aggregate、preview clean-install 回归、Surface Release gate 和
  candidate checksum/verify 均退出码 `0`。
- 分发：Sites version 2 的 source commit 为
  `7379e3499472a0766af45e979a70013aa5521fed`，生产部署为 `succeeded`，公开地址保持
  `https://understand-code-demo.muresanbarkdull77.chatgpt.site`；版本归档 431 个文件、
  content hash 为 `sha256:c206b2e56dca2f4c6016feee4f78a0d6f5cb09d4428aceb1cf695c9f9bdb8c71`。
- 仍未完成：GitHub run 的 C09/distribution 终态因凭证失效不可读；Linux 诊断未获
  gate 终态；真实 Codex/Claude Host 登录、24 个 Gold task、签名/SBOM/trusted
  provenance 和正式 Release 仍未满足。上述条件没有被本次本地验证替代。

## 2026-09-05 结构约束与外部状态复核

- 用户明确要求目标不得偏离最初项目结构；本次复核将根目录拓扑、`packages/*`
  workspace、既有包边界和 `site/` 独立子仓库视为不可漂移约束。当前 HEAD
  `0035d2376085dcd46d3ef13fb90b7dfa2370f998` 与远端一致，未新增目录迁移或 workspace
  改写；相对续跑基线仍只有既有 `test-distribution.mjs` 一项 tracked 修改。
- 2026-09-05 重新查询 Actions run `33864744556`，本机 `gh` token 仍 invalid，私有
  run API/公开页面均返回 404；没有可验证的 job 终态，未把它写成通过、失败或取消。
- Mac 当前仍锁定，无法进行源 UI 捕获或交互式 Host 登录；隔离 Codex/Claude 登录、
  Gold 24 槽位版本化/复核和签名/SBOM/provenance 没有新的外部输入。Release Doctor
  仍为 `readiness=alpha`、`releaseReady=false`、`strongWrites=locked`、`ok=false`。
- 当前 Alpha candidate 的三项 `SHA256SUMS` 校验仍全部 `OK`；本次只读复核未修改
  产品代码、用户工作树或发布站点。

## 2026-09-05 ALPHA-A 草案结构复核

- 对未批准的 `docs/research/2026-09-02-alpha-a-gold-task-draft.md` 做了只读结构
  检查：A01–A18 共 18 个唯一任务标题、54 个源码行号锚点，解析通过。该结果只证明
  草案可供 Product/QA 复核，不改变 corpus 的 `blocked_not_versioned` 状态，也不构成
  两人签署、真实 Host 执行或 G2/G3 证据。

## 2026-09-05 clean-clone C09 自然终态

- 在固定 HEAD `0035d2376085dcd46d3ef13fb90b7dfa2370f998` 的隔离 clone
  `/tmp/understand-code-clean-0035d23` 中，让原始
  `CI=true pnpm --filter @understand-code/durable-object-provider-contracts test:c09-aggregate`
  自然结束（未修改代码、宿主工作树或 clone Git 状态）。package build、package
  typecheck、all package Vitest tests、packed distribution 四个 lane 全部通过，C09
  gate 通过全部 lanes 与 20 个 required coverage assertions，退出码 `0`，耗时
  `2336s`（38 分 56 秒）。
- 完整日志保留在 `/tmp/understand-code-c09-aggregate-8947.log`；此前 20 分钟 SIGINT
  诊断只是观察超时，不能与本次自然成功终态混淆。该证据加强了本地/clean-clone
  门禁，但仍不替代 Linux/远端 CI、真实 Host/Gold 或正式签名发行门。
- 本次分发阶段记录的 dedicated same-sample 指标为 `215373.3ms`、峰值进程树 RSS
  `1512505344` bytes（低于 1.536 GiB 规范上限）、`4232` samples；固定的四个
  packed-browser replay lane 与其余 Node/browser probe 均在同一自然成功终态内完成。

## 2026-09-05 clean-clone 根 quality 自然终态

- 在同一固定 HEAD clean clone 中执行原始 `CI=true pnpm quality`，未修改代码、clone
  Git 状态或宿主工作树。`build:all`、`typecheck` 和 `test` 全部通过；test 链中的
  native-kernel-bridge、C09 aggregate（含四个 lane）、runtime、client、authority、
  host-adapters、contracts、installation-lifecycle、workbench-runtime、repository-state、
  artifact-store、core、task-engine、CLI、Dashboard、Preview 均自然结束并通过。测试
  自身标记的 skipped 保持为 skipped，无失败替代。
- 精确退出码为 `0`，总耗时 `3069s`（51 分 09 秒），完整日志保留在
  `/tmp/understand-code-quality-full-73249.log`。这补足了本地 clean-clone 根质量证据，
  但仍不能替代真实 Host/Gold、远端 Linux CI 或正式签名发行门。

## 2026-09-05 初始结构约束的精确定义

- “不偏离最开始项目结构”在本次续跑中按根目录拓扑、`pnpm-workspace.yaml` 的
  `packages/*` 工作区边界、既有包的职责边界和独立 `site/` 子仓库解释。当前 HEAD
  与续跑基线的顶层目录集合和 workspace 字节内容完全一致；本轮没有新增包、目录迁移、
  workspace 改写或把项目拆到新的根目录。
- 更早的 17 步实现历史上已在同一 `packages/*` 边界内增加了 provider、host-adapters、
  installation-lifecycle、native-kernel-bridge、preview、workbench-runtime 等包；这些
  是目标范围内的能力扩展，不是本轮新引入的结构漂移。本轮相对固定续跑基线仍只有
  `packages/durable-object-provider-contracts/scripts/test-distribution.mjs` 的既有脚本
  修改，未回滚或重排用户已有结构。

## 2026-09-05 浏览器验收能力复核

- 只读检查确认项目已有 `packages/preview/test/workbench-browser-packed.test.mjs` 与
  `browser-harness.mjs`，可在有真实 Chromium 可执行文件时覆盖 headless/viewport 场景。
  当前环境未发现 `google-chrome`、`chromium` 或 `chromium-browser`，因此没有启动一个会
  产生无效结论的替代跑次；该缺口仍需解锁 Mac 后进行真实多视口/人工 UI 验收。此次复核
  未新增或修改产品文件，也未改变 `packages/*` 结构。

## 2026-09-05 clean-clone candidate / Surface / Dashboard 复核

- 在固定 HEAD `0035d2376085dcd46d3ef13fb90b7dfa2370f998` 的隔离 clone
  `/tmp/understand-code-clean-0035d23` 中重新执行候选包与界面合同门；宿主工作树和
  项目结构未改动。
- `CI=true pnpm --filter @understand-code/preview test:alpha-candidate`：`1/1` 通过；
  `CI=true pnpm --filter @understand-code/preview test:surface-release`：`1/1` 通过，
  插件生命周期 `7/7`，另有 `2` 个测试自身标记的 Linux-only skip。Surface 仍明确验证
  `releaseReady=false` 与 strong-writer lock，不把 unsigned candidate 写成正式 Release。
- Dashboard active-surface audit 的 `forbiddenReachable=[]`；`pnpm --filter
  @understand-code/dashboard test` 为 `56` 个文件、`612/612` 测试通过；build 与
  `tsc -b --pretty false` 均通过。整组命令退出码 `0`，耗时 `162s`，完整日志保留在
  `/tmp/understand-code-surface-1788546595.log`。

## 2026-09-05 D-43→D-45 集成复核

- 在同一固定 HEAD clean clone 中定向执行原有
  `provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-plan-admission-closure-reference-candidate.integration.test.ts`，覆盖 D-41、D-42、D-43 prepared Catalog successor、D-44 formal Plan、D-45 migration-only Acceptance、最终 strong-ready 与 durable migration smoke。
- `50/50` tests 通过，退出码 `0`，Vitest 总耗时 `355.45s`。这证明当前实现的
  reference/none-authority 集成链可复核，但不把它升级为真实 OS Provider、已发布
  Registry/Catalog、真实 Host/Gold 或正式 Release 证据。

## 2026-09-05 provider 合同 verify:all 复核

- 在同一固定 HEAD clean clone 中执行 `CI=true pnpm --filter
  @understand-code/durable-object-provider-contracts verify:all`，退出码 `0`，耗时
  `507s`。396 个生成 JSON Schema、6 个 reference/15 个 invalid provider-error
  fixtures、strict Ed25519、foundation/bootstrap/root/Registry golden 与 negative
  corpus、real-FS source/conformance、runtime attestation、feasibility evidence、
  target discovery/release universe、Registry↔Evidence 12-shard topology、Catalog
  point 和 distribution-history current-candidate 的生成物与执行校验全部通过。
- 该门证明当前合同/夹具在 exact clean source 上可重放且无漂移；它仍不替代真实
  OS-isolated Provider、已发布 Registry/Catalog、外部 Host/Gold、远端 CI 或签名
  Release。完整日志保留在 `/tmp/understand-code-provider-verify-all-1788547660.log`。

## 2026-09-05 exact-HEAD Linux 三主体生产 smoke 复核

- 在 Lima Alpine aarch64/Linux 临时副本
  `/tmp/understand-code-current-0035d23.F6Zp74`（HEAD
  `0035d2376085dcd46d3ef13fb90b7dfa2370f998`）中先保留了 clone 根目录的
  `0700` 权限；caller 降权后首次加载 native addon，因无法遍历 checkout，暴露为
  `ERR_PROVIDER_KERNEL_PEER_CREDENTIALS_UNAVAILABLE`。最小已连接 Unix socket 的
  `SO_PEERCRED` 探针在同一副本以 root 运行通过，故没有把该次环境权限失败误写成
  产品/协议失败。
- 仅对 VM 临时副本根目录改为 `0755`（未改宿主工作树、源码或目录结构）并重新运行
  原始 `provider-production-strong-object-three-principal-linux.mjs`；最终 JSON 报告
  `status=verified`，ext4 exact-object、caller key denial、gateway/runtime/authority
  重启与 socket 回收、CAS/nonce、trust-rotation replay、durable-current 17 项以及
  live-uninstall/double-start 生命周期门均通过。预期的第二 gateway 拒绝只出现在 stderr，
  smoke 总退出码为 `0`，耗时 `83.36s`，峰值 RSS `609684 KB`。
- 该次使用的是当前 exact HEAD 的 native addon（Linux arm64 SHA-256
  `b7e448839d298093a00aade12753867c34175b4513a87abb847b8d24b0343cea`）。这是
  OS/checkout 可遍历性修正后的本地生产 smoke 证据，不替代远端 CI、真实 Host/Gold 或
  正式签名发行门；原始失败日志仍保留在 VM
  `/tmp/understand-code-linux-provider-current-1788549454.log`，通过权限修正后的成功
  日志为 `/tmp/understand-code-linux-provider-current-perm-1788550423.log`。

## 2026-09-05 Dashboard 大仓库基准复核

- 在固定 HEAD `0035d2376085dcd46d3ef13fb90b7dfa2370f998` 的 clean clone
  `/tmp/understand-code-clean-0035d23` 中补跑根 `quality` 未覆盖的
  `CI=true pnpm --filter @understand-code/dashboard benchmark:large-repository -- --output /tmp/understand-code-benchmark-0035d23.json`。
- `self-host-shape` 与 `synthetic-10k` 的 integrity/benchmark 均通过，退出码 `0`；
  p95（bootstrap/view/layout）分别为 `35.175/1.831/42.832ms` 与
  `182.607/15.363/36.031ms`，均低于实现中 `2000/500/500ms` 限值。JSON 报告确认
  `gitDirty=false`、HEAD exact，未修改主工作树或项目结构。
- 原始输出保留在 `/tmp/understand-code-benchmark-0035d23.log`，结构化结果在
  `/tmp/understand-code-benchmark-0035d23.json`；该基准只补充性能/完整性证据，不替代
  真实 Host/Gold 或正式发行门。

## 2026-09-05 Task Engine strong vertical 复核

- 在固定 HEAD `0035d2376085dcd46d3ef13fb90b7dfa2370f998` 的 clean clone 中执行
  `CI=true pnpm --filter @understand-code/task-engine exec vitest run test/strong-production-change-intelligence.e2e.test.ts --maxWorkers=1`。
- `3/3` tests、`1` 个文件通过，退出码 `0`，耗时 `22.40s`；该门覆盖 production
  Change Intelligence 的 Check/Verification/guard 纵切。它是本地 Step15 强链路证据，
  不升级为 Gold、双 Host 或正式 Release。

## 2026-09-05 Host 登录状态复核

- 系统 Codex CLI `/Applications/ChatGPT.app/Contents/Resources/codex` 与
  `/Users/example/.local/bin/codex` 均为 `codex-cli 0.153.0-alpha.5`，`codex login status`
  返回 `Logged in using ChatGPT`；这是宿主账户状态，不等于隔离 runner 的
  `CODEX_HOME` 已授权，也不产生模型任务/Gold 收据。
- Claude CLI 仍返回 `loggedIn=false, authMethod=none, apiProvider=firstParty`；Mac
  CUA 仍锁定且自动解锁失败。故 24 Gold 任务、双人版本化与 G2/G3 仍保持阻塞，未
  调用模型、未读取或复制凭证。
- 同次远程复核确认 feature ref 与本地 HEAD 精确一致（左右计数 `0/0`），但 `gh`
  token 仍 invalid，Actions run `33864744556` 和 check-runs API 均 `404`；没有新增
  权威 CI 终态。

## 2026-09-05 用户工作树未跟踪测试隔离核验

- 按“不破坏用户工作树”约束，单独运行既有未跟踪文件
  `packages/durable-object-provider-client/test/provider-runtime-strong-mutation-client-internal.test.ts`，结果为 `10/10` 失败；共同原因是其旧 fixture 只提供部分生命周期对象，而当前
  `storage.ts` 要求完整的 17 项 durable lifecycle artifact set（错误为
  `final_strong_ready requires the exact durable lifecycle artifact set`）。
- 该文件及配套未跟踪 source 于当前 HEAD 之外已存在，未被修改、删除、暂存或带入
  clean-clone 候选；因此不能把当前脏工作树的这 10 项写成通过，也不能把 clean-clone
  `pnpm quality` 的全绿误称为包含用户未跟踪实验文件。若要收口这组 fixture，需要用户
  明确授权后再按现有 17 项生命周期合同更新，不能通过删测试或放宽 Store 校验解决。

## 2026-09-05 真实 Chrome 浏览器门复核

- 修正此前仅按 PATH 检查得出的浏览器缺口：项目自带 `browser-harness.mjs` 会发现并启动
  `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`，使用独立临时 profile、
  `--headless=new` 和 DevTools 协议；不会触碰主工作树。
- 在固定 HEAD `0035d2376085dcd46d3ef13fb90b7dfa2370f998` 的 clean clone
  `/tmp/understand-code-clean-0035d23` 中执行
  `CI=true UNDERSTAND_CODE_REQUIRE_REAL_BROWSER=1 UNDERSTAND_CODE_BROWSER_EXECUTABLE=... pnpm --filter @understand-code/preview test:workbench-browser`，真实浏览器测试 `1/1` 通过，退出码 `0`，耗时约 `69.6s`。测试输出确认 candidate tarball、Task surface 关闭和 legacy/unauthorized strong state 不泄漏。
- 完整日志保留在 `/tmp/understand-code-browser-0035d23.log`。这项通过补充了 clean-clone
  浏览器合同证据，但不改变 24 Gold task、真实双 Host 模型任务、远端 CI 和正式签名发行门
  仍未满足的状态。

## 2026-09-05 Sites 生产部署状态复核

- 通过 Sites 权威状态接口复核现有项目：`Understand Code` 仍为 `active/public`，最新版本为
  `2`；该版本对应的 production deployment 状态为 `succeeded`，无 failure message，生产地址
  为 <https://understand-code-demo.muresanbarkdull77.chatgpt.site>。
- 本次只读复核未创建新 Site、未保存新版本、未改访问策略，也未修改 `site/` 独立仓库；继续
  复用既有已验证部署。

## 2026-09-05 独立展示站源码复核

- 在独立 `site/` 子仓库执行 `npm test`（先运行 `vinext build`，再运行渲染合同）；构建成功，
  `server-renders the Understand Code showcase` 与 `keeps the product source and Sites worker output in the original shape` 两项均通过，退出码 `0`。
- 该复核只生成站点本地构建输出，没有修改主 workspace、既有包边界或 `site/` Git 提交；日志
  保留在 `/tmp/understand-code-site-test-20260905.log`。它与 Sites production `succeeded`
  状态相互印证，但不替代主项目正式签名发行门。

## 2026-09-05 Workbench 多视口与键盘 fixture 复核

- 使用项目自带 Workbench UI fixture 和真实 Chrome DevTools，在 `1280×720`、`768×1024`、
  `390×844` 三个 viewport 实际加载任务页面；三者 `document.scrollWidth` 分别精确等于
  viewport 宽度，未见横向溢出；初始页面按钮均有可见文字或 ARIA 名称。
- 通过真实 CDP 键盘事件（`Enter`，含浏览器要求的字符事件）激活“关系图谱”按钮，桌面和
  手机视口均进入 `surface=graph`；此前一次未带字符事件的探针未触发默认动作，已确认是
  探针输入序列问题而非产品结论。该结果仍只属于隔离 UI fixture，不是 Provider/Host/Gold
  或正式 Workbench E2E 证据。

## 2026-09-05 Workbench Graph 加载与网络响应复核

- 在同一隔离 UI fixture 中等待 Graph 异步资源完成后，`surface=graph` 页面出现 SVG 图谱
  （`svgCount=5`），正文显示“当前显示 3 个元素”；JS 页面异常为空，Graph、Wiki、Meta
  资源均返回 `200`。fixture 明确预期的 Evidence `409` 与 Change Check/Verification
  `404` 仍保持为未伪造数据的失败关闭路径。
- launcher 会话已正常关闭，临时浏览器 profile 已清理；没有留下产品进程或修改工作树。

## 2026-09-05 实际 Codex/Claude CLI 插件生命周期复核

- 在固定 HEAD clean clone 中，以系统实际 Codex CLI 与 Claude CLI、隔离的临时 HOME/配置和
  marketplace facade 执行原有 `real Codex and Claude plugin lifecycles preserve the public strong-writer lock` 测试；没有调用模型，也没有读取用户凭证。
- 总计 `9` 项：`7 passed / 0 failed / 2 Linux-only skipped`，退出码 `0`，耗时约 `20.2s`。
  通过内容包括两端实际插件注册、MCP argv/environment/stdio 绑定、Provider 固定 activation、
  Doctor、锁保持和清理；日志保留在 `/tmp/understand-code-real-host-lifecycle-0035d23.log`。
- 这补强了安装/Host wrapper 生命周期证据，但不等同于已登录的模型调用、24 Gold task、
  Verified 晋级或正式 Release。

## 2026-09-05 ALPHA-A 草案机器可审计性复核

- 对现有未批准草案执行只读结构解析：`A01–A18` 共 `18` 个任务，六类必备字段每项齐全；
  计划覆盖为 `cross-file=13`、`test-impact=18`、`unplanned=4`、`unknown=6`，均达到
  corpus 要求的 `8/6/4/4` 最低值。
- 该结果只说明草案已经具备交给 Product/QA 的结构完整性；没有把它写入 Gold corpus、
  没有生成 taskDefinitionDigest，也没有替代两人审阅或 Alpha-B owner 授权。

## 2026-09-05 Alpha candidate 最终校验复核

- 从固定 HEAD clean clone 对既有 candidate 目录重新执行 `alpha-candidate.mjs verify`，
  退出码 `0`，返回 `ok=true`、`disposition=unsigned_alpha_candidate`、`releaseReady=false`。
  这确认四文件候选、归档内容、源码 pin、lockfile 和 SHA-256 绑定仍未漂移；未把 unsigned
  candidate 改名或上升为正式发行物。

## 2026-09-05 ALPHA-A exact pin Core 门复核

- 在 ALPHA-A 草案指定的源码 pin `34da354968a6071d914e4e4a4fca738e6c2d8a29`
  （`perf(dashboard): add reproducible large-repository baseline`）的隔离 worktree
  `/tmp/understand-code-alpha-a-pin` 中，仅执行现有 `@understand-code/core` 的构建与测试，
  未改动主工作树、包边界或任何 Gold 定义。
- `pnpm install --frozen-lockfile --offline` 先行通过；随后 `pnpm --filter
  @understand-code/core build` 与 `pnpm --filter @understand-code/core test -- --runInBand`
  均通过。测试汇总为 `51` 个文件、`920` 项测试，`0` 失败，构建/测试流水线退出码 `0`；
  原始日志保留在 `/tmp/understand-code-alpha-a-core-gates.log`，安装日志在
  `/tmp/understand-code-alpha-a-install.log`。
- 这是对草案 A01–A18 所在 Core 代码的 exact-pin 回归证据，不能替代 Gold corpus 的版本化、
  Alpha-B 双人授权、真实 Codex/Claude 模型任务、Verified 晋级或签名发行门；临时 worktree
  与进程均不进入用户项目结构。

## 2026-09-05 原始项目结构边界复核

- 以迁移继续工作的基线提交 `e5e7411e6ceefad5461ef68eaf2a1aedce390fd2` 对比当前
  `0035d2376085dcd46d3ef13fb90b7dfa2370f998`：已跟踪差异仅为既有
  `packages/durable-object-provider-contracts/scripts/test-distribution.mjs`，本轮没有新增
  顶层目录、包目录或 workspace 配置改动。
- `pnpm-workspace.yaml` SHA-256 仍为
  `d42f6afb9997046cd19d8a9ccc811877d7aae58546b4a99e898342a263d5f9b5`；当前包仍全部位于
  原 `packages/*` 边界（`artifact-store`、`cli`、`contracts`、`core`、`dashboard`、
  `durable-object-provider-*`、`host-adapters`、`installation-lifecycle`、
  `native-kernel-bridge`、`preview`、`repository-state`、`task-engine`、
  `workbench-runtime`）。
- 最早字面初始提交 `64072804ffb73901e7ceec268d868f6f3c8f4b6c` 只有早期 `core`/`dashboard`；
  后续历史提交已在同一 `packages/*` 目录边界内扩展其他包。本轮保持当前迁移基线，不回滚这些
  已存在的历史扩展，也没有把临时 `/tmp` worktree 或独立 `site/` 仓库并入主结构。

## 2026-09-05 Surface Release 整合门复核

- 在固定 HEAD `0035d2376085dcd46d3ef13fb90b7dfa2370f998` 的 clean clone
  `/tmp/understand-code-clean-0035d23` 执行项目自带
  `CI=true UNDERSTAND_CODE_REQUIRE_REAL_BROWSER=1 UNDERSTAND_CODE_BROWSER_EXECUTABLE=/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome pnpm --filter @understand-code/preview test:surface-release`。
- 第一阶段真实 Chrome 候选导出/WorkBench 浏览器合同 `1/1` 通过（约 `70.9s`）；第二阶段
  插件 clean-install 合同 `9` 项中 `7 passed / 0 failed / 2 Linux-only skipped`（约
  `19.3s`）；整合命令退出码 `0`。输出保留在
  `/tmp/understand-code-surface-release-0035d23.log`。
- 该门确认候选 tarball、Task surface 关闭、legacy/unauthorized strong state 不泄漏，以及
  Codex/Claude wrapper 的实际生命周期绑定；Linux-only skip 仍按平台限制保留。它不等价于
  24 Gold、真实模型/Verified、远端 CI 或签名/SBOM/provenance Release；clean clone 运行未
  触碰主工作树和原始项目结构。

## 2026-09-05 Sites 发布终态再次确认

- Sites 权威接口再次返回 `Understand Code` 为 `active`、`public`、最新版本 `2`；现有生产
  deployment `appgdep_6a9a6d5dd14881919b8904eac052b2dc` 为 `publish/succeeded`，无失败信息。
- 当前生产地址仍为
  <https://understand-code-demo.muresanbarkdull77.chatgpt.site>。源码没有变化，因此按既有
  发布复用规则不创建新版本、不重复部署，也不改变访问策略；这次状态读取没有触碰主项目或
  独立 `site/` 仓库。

## 2026-09-05 Alpha candidate 组装回归复核

- 在固定 HEAD clean clone `/tmp/understand-code-clean-0035d23` 执行
  `CI=true pnpm --filter @understand-code/preview test:alpha-candidate`；项目自带的 exact
  clean-source 组装与校验测试 `1/1` 通过，退出码 `0`，耗时约 `60.3s`。
- 原始日志保留在 `/tmp/understand-code-alpha-candidate-tests-0035d23.log`。该测试只确认
  unsigned Alpha candidate 的归档、清单、源码/锁文件绑定和失败关闭语义；签名、SBOM、可信
  provenance、24 Gold 与正式 releaseReady 仍按现状未满足。

## 2026-09-05 Linux delegated SafeGit 可选门复核

- 在现有 exact-source Linux 临时环境尝试项目入口
  `pnpm --filter @understand-code/native-kernel-bridge test:linux-delegated`；运行在
  `executeSafeGitVersionV1` 能力检查处按 fail-closed 退出，错误码为
  `ERR_NATIVE_KERNEL_BRIDGE_SAFE_GIT_UNAVAILABLE`。日志保留在
  `/tmp/understand-code-safe-git-delegated-current.log`。
- 该环境缺少 `/sys/kernel/security/landlock/features`，且 runner 能力不足以提供此
  delegated SafeGit 证明；没有修改源码、阈值、固定 Git、cgroup 或主项目结构。此项仅是
  Linux adversarial proof 的环境阻塞，不影响已通过的 macOS/clean-clone 本地门，也不能被写成
  CI/Provider/Gold 通过。

## 2026-09-05 宿主机解锁状态复核

- 通过桌面状态接口复核：当前 Mac 仍处于锁定状态，自动解锁失败。未尝试绕过锁屏、读取
  凭证或启动模型任务。
- 因此隔离 Codex/Claude Host 的真实授权、24 个 Gold Task 执行和 Verified 晋级仍需用户先
  手动解锁并完成各自登录；这不是项目源码或结构回归。解锁前继续运行同一类模型任务既不
  安全也无法形成可审计的真实收据。

## 2026-09-05 Sites v2 来源绑定复核

- 只读读取现有 saved version v2 的来源元数据：source commit 为
  `7379e3499472a0766af45e979a70013aa5521fed`，归档格式为 `tar`，文件数 `431`，大小
  `27,596,800` bytes，content hash 为
  `sha256:c206b2e56dca2f4c6016feee4f78a0d6f5cb09d4428aceb1cf695c9f9bdb8c71`。
- 该来源与独立 `site/` 仓库当前 clean HEAD 一致；生产 deployment 已是 succeeded，因此
  不创建新版本、不重复部署，也不把 Site 仓库或其构建物并入主项目结构。

## 2026-09-05 Gold Gate 机器可审计复核

- 从当前构建的 `AlphaGoldTaskCorpusV1Schema` 与 `AlphaGoldRunnerContractV1Schema` 重新解析
  固定 fixtures，解析退出码 `0`；`taskCount=24`，ALPHA-A/ALPHA-B pin 均与合同一致，
  G2 为单 Host 至少 12 项，G3 为 Codex/Claude 各 24 项（共 48 次），且 synthetic substitution
  明确禁止。原始 JSON 报告保留在 `/tmp/understand-code-gold-gate-current.log`。
- 机器报告同时明确当前 blockers：`gold_task_definitions_not_versioned`、
  `alpha_b_owner_authorization_missing`、`alpha_a_not_executed`、
  `codex_gold_incomplete`、`claude_gold_incomplete`。这确认 Gold 阶段仍按合同关闭，不能用
  ALPHA-A Core 或 synthetic vertical 的通过结果替代真实 Gold。

## 2026-09-05 Host CLI 授权状态复核

- 系统 Codex CLI 的只读状态命令返回 `Logged in using ChatGPT`；这只代表宿主账户状态，
  不代表隔离 Host runner 已获得授权，也没有因此启动模型任务。
- Claude CLI 返回 `loggedIn=false`、`authMethod=none`、`apiProvider=firstParty`；本轮环境中
  没有 `UNDERSTAND_CODE_CODEX_CLI`、`UNDERSTAND_CODE_CLAUDE_CLI` 或 Gold verifier key 配置。
- 未读取、复制或注入任何认证文件；结合 Mac 仍锁定，真实双 Host/Gold 运行继续保持
  `not_run`，不以宿主 Codex 登录状态替代两端隔离授权。

## 2026-09-05 外部阻塞重复审计

- 本次继续审计确认 Mac 仍锁定、Claude 仍未授权、Gold corpus 仍为
  `blocked_not_versioned`、候选仍为 `releaseReady=false`，GitHub CLI token 仍无效；主仓库
  HEAD、远端 feature ref、独立 `site/` 仓库和生产部署均没有变化。
- 在所有不依赖用户输入的本地门已收口后，真实双 Host/Gold/Verified/签名 Release 无法在
  当前环境安全执行。相同外部条件已在连续续跑中重复确认；不再重跑相同测试、不绕过锁屏或
  复制凭证。恢复条件是用户手动解锁 Mac、完成隔离 Host 授权，并提供 Gold/CI 所需的外部
  owner/审阅与访问权限。

## 2026-09-05 GitHub/CI 访问状态复核

- `gh auth status` 仍报告默认 GitHub token 无效（退出码 `1`）；没有重试、刷新、修改计费
  或触发新的 workflow。
- 只读 `git ls-remote` 仍能确认远端 feature ref 指向当前 `0035d2376085dcd46d3ef13fb90b7dfa2370f998`，
  但这不提供 Actions job/check-run 的权威结论。CI 运行状态继续按“不可读取/外部阻塞”处理，
  不把本地 clean-clone 通过写成远端 CI green。
