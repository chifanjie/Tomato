# feature/agent-native-change-intelligence-authority Review Brief

> 生成时间：2026-08-24 CST
> 分支：feature/agent-native-change-intelligence-authority
> 当前增量基于 commit：c31be2a4d5c0710ad441d99de6a8ca7faae05a0a `feat(repository-state): bind SafeGit bootstrap to native descriptors`

## 背景与动机

D-29 要求 strong Repository Snapshot/Pulse 使用 path-safe profile，并要求 raw legacy
Snapshot/Pulse 仅保留 owner-only lossless reader；通用 MCP、Workbench、Preview 与日志只能看到
strict aggregate redacted Surface。accepted Provider、HMAC identity、SafeGit、安全扫描、strong Store
writer 与 strong Task baseline 尚未闭合，因此任何公开 Task 读写、Workbench 或 legacy refresh 成功路径
都会虚报 strong authority。

本切片冻结合同并关闭这些不具备 authority 的能力：定义 strong persisted profile 和 public
Surface；只保留严格脱敏的 `get_repo_pulse`；让所有公开 Task 读取、Task 变更、Workbench 与 Preview
Task endpoint fail closed；同时保留 Graph/Wiki 的安全公开投影。它不实现或解锁 strong writer、
Provider ownership、HMAC key lifecycle、SafeGit 或 strong Task baseline。

后续 Step 15 增量新增 filesystem-only SafeGit bootstrap candidate：在任何 Git 调用之前，对普通
`.git` directory layout 或真实 linked-worktree 的 `.git → worktrees/<entry> → commondir` 与反向
`gitdir` backpointer 做有界、路径脱敏的 point-in-time preflight。它只返回可关闭的 opaque capability；
descriptor-relative traversal、ACL/control-shape/local ODB、handle-bound execution、OS sandbox、HMAC
identity 与 strong writer 继续显式锁定，不接入 legacy Snapshot producer，也不解锁任何 public capability。

本轮继续把该 preflight 升级为独立版本的 descriptor-bound candidate：Darwin/Linux combined N-API
bridge 逐组件使用 `openat/fstatat + O_NOFOLLOW + O_CLOEXEC`，原生持有 opaque descriptors，并在
发布与每次显式 `revalidate()` 时核验 namespace、pointer bytes、owner/mode/nlink、extended ACL 与
immutable/append flags。descriptor traversal、native handle custody 与 ACL admission 现在可声明
`verified`；repository control reader、local ODB/ref、HMAC、handle-bound Git execution、sandbox 与
strong writes 仍保持 `locked`。

本轮再把该 opaque binding 以显式 promotion 升级为 repository-control candidate：native 只经已保留
descriptor 读取并 pin common/worktree config，绑定 local `objects/info/pack` layout 与 files refs backend，
拒绝 alternate/http-alternate、grafts、replace refs、promisor/partial clone/shallow、reftable/unknown extension
以及非固定 allowlist 配置。promotion 前后与后续 `revalidate()` 都重验 descriptor、control bytes、absence
proof 和 bounded directory snapshot；投影只公开 object format 与固定 verification labels。empty hooks、
handle-bound Git execution、sandbox、HMAC identity 与 strong writer 仍锁定。

## 改动策略

1. **persisted 与 Surface 分离**：Snapshot/Pulse 各自使用 `legacy | strong` persisted union；public
   response 使用独立 discriminated Surface union，projector 逐字段构造，禁止 spread raw Envelope。
2. **legacy strict redaction**：legacy Snapshot/Pulse Surface 仅保留 aggregate status/count/safe time 和
   `strongOperationSupported=false`；MCP Pulse meta 精确限制为 `durationMs` 与 `cacheHit`。
3. **strong structural closure**：冻结 path-safe HMAC/ID/token grammar、UTF-8 scalar path、Git object
   format、accounting/order/capture invariants、Snapshot ID recomputation 和 Pulse-to-Snapshot binding。
   legacy path reader 不继承 strong UTF-8 scalar 限制，继续保持历史接受与 canonical bytes。
4. **统一公开能力锁**：`build_task_brief`、三类 `update_task`（普通、context refresh、rebase）、
   `check_change`、`record_verification`、`refresh_index`，以及全部 Task reads、Evidence/search/impact 和
   `open_workbench`，都在 private Store read、Git capture 或写入之前返回同一 exact
   `provider_unavailable/{reason:"unavailable"}`。
5. **Task Engine 边界**：公开 context refresh/rebase capability 显式为 false；底层 rebuild/rebase
   correctness 仅由内部完整性测试保留。legacy Engine/Change Check 对 strong Snapshot/Pulse 在 analyzer、
   context load 与 manifest write 前拒绝。
6. **Preview/Workbench 边界**：Task brief/check/verification HTTP endpoint 返回 exact HTTP 503；UI 保持
   error state且不泄漏 persisted canary。Graph/Wiki smoke 保留，Wiki 移除 legacy root identity，只公开
   安全相对路径和允许的 provenance 字段。
7. **同一候选发布链**：仓内 `test:surface-release` 强制真实 Browser 先组装、校验并导出唯一 candidate，
   再把同一私有 candidate directory 交给强制 Codex/Claude Host gate；禁止任意 tarball override、
   ambient/stale dist 替代和 host/browser skip。

## 改动范围

| 模块/职责 | 文件 | 做了什么 |
|---|---|---|
| Contracts primitives | `packages/contracts/src/primitives.ts` | 新增 path-safe ID/token grammar、Unicode scalar helper 与仅 strong 使用的 path-safe path schema |
| Snapshot/Pulse contracts | `packages/contracts/src/repository.ts` | 新增 legacy/strong persisted unions、strong invariants/trusted validators、strict Surface unions |
| MCP/JSON Schema | `packages/contracts/src/mcp.ts`、`src/json-schema.ts`、`schemas/v1/*` | `get_repo_pulse` 改用 strict Surface/meta；发布 6 个新 Schema 并更新 3 个既有 Schema |
| Surface projector | `packages/repository-state/src/surface.ts`、`src/index.ts` | 逐字段投影 legacy redacted/strong safe view |
| Native kernel bridge | `packages/native-kernel-bridge/*`、Provider Runtime re-export、CLI native asset wiring | 单一 N-API asset 保留 peer/ACL ABI，并新增 opaque descriptor-bound SafeGit open/control-promotion/revalidate/close |
| SafeGit bootstrap/control candidate | `packages/repository-state/src/safe-git-bootstrap.ts`、testing internal、package export | 逐组件 no-follow、真实 linked-worktree 双向绑定、ACL/flags admission、strict config/local ODB/files refs promotion 与显式 remaining locks |
| CLI capability boundary | `packages/cli/src/errors/tool-errors.ts`、handlers、runtime、registry | 统一 exact provider error；公开 Task 读写、refresh 和 Workbench 在副作用前锁定；工具描述与能力一致 |
| Task quarantine | `packages/task-engine/src/engine.ts`、`src/change-intelligence.ts` | public context recovery capability lock；底层强 Artifact 拒绝与零写保护 |
| Workbench/Preview | Dashboard component/loader、`packages/preview/src/server.mjs` | Task fail closed；legacy/unauthorized strong state 不进入 HTTP/HTML/DOM；保留安全 Graph/Wiki |
| Distribution gates | CLI/Preview/Contracts/Repository State/Task Engine tests | 覆盖 cold pack、双 Host lifecycle、真实 Browser、泄漏 canary、7 类 mutation、Task reads 与逐次零写 |

## Review 意图与重点

Review baseline 由 D-29 accepted authority 明确：

- legacy persisted bytes 必须 lossless，但不能进入 strong Basis；
- 非 owner Surface 不得泄露 legacy/unauthorized strong ID、branch、path、OID、digest 或 free-text；
- Provider/strong Store 未闭合时 public Task read/write 与 Workbench 必须 fail closed 且零写；
- structural strong contract 不能被表述成已具备 strong authority；
- packed、installed、Browser 证据必须消费同一份完整候选，不能靠 stale dist 或 skip 假绿。

重点核验：

1. **兼容性** — legacy reference JSON、canonical payload 和 digest 不变；strong path 的额外 Unicode
   scalar 要求不得误加到 legacy reader。
2. **隐私边界** — MCP meta、Pulse DTO、Task Workbench、Preview HTTP/HTML/DOM 均无 raw persisted
   canary；schema-valid 但无 terminal authority 的 strong Pulse 也不能宣称 supported。
3. **副作用顺序** — 所有公开 capability lock 位于 runtime/private Store、capture/index 与 repository
   write 之前；安装、升级、回滚后的每次调用都保持 source、Git index 与 Store tree 不变。
4. **能力诚实性** — context refresh/rebase 的 public capability 与实际实现一致，不从测试开关、旧
   runtime overlay 或隐藏入口恢复。
5. **候选忠实性** — Browser exact overlay 为 29 个路径（28 个生产/分发路径加 1 个 candidate cold
   acceptance test）；clean commit/tree、单一 tgz/checksum、manifest inventory 与安装后 runtime bytes
   均可复核，双 Host 只消费 Browser 导出的同一 candidate。

## 已识别并修复的风险

1. Browser gate 曾只 overlay 部分文件，可能形成“新测试 + 旧 bundle”混合候选；现为 exact
   29-path closure，并核验 untracked/staged/commit/tree 一致。
2. Preview 曾把任意 schema-valid strong Pulse 投影为 supported；现由 server authority boundary
   返回不透明 unavailable，并补 HTTP/DOM 负例。
3. Contracts packed distribution 没有 `TextEncoder` global；UTF-8 排序改用对 Unicode scalar 序列
   等价的 code-point lexicographic ordering，lone surrogate 在 strong path schema 前置拒绝。
4. Unicode scalar 校验一度放在通用 `RepositoryRelativePath`，会缩窄 legacy reader；现拆成
   `PathSafeRepositoryRelativePathV1Schema`，并补“legacy 接受、strong 拒绝”回归。
5. plugin clean-install 曾假设 public refresh 成功；已替换为 6 个 Codex/Claude install/upgrade/
   rollback lifecycle 点上的 7-case capability matrix，并逐次校验零写。
6. Browser 与 plugin 曾可消费不同 candidate，且默认条件允许 skip；现有 checked-in orchestrator
   强制 real Browser、同一 verified candidate 与 real Hosts，任一阶段非零即整体失败。
7. 首次最终 gate 暴露 strong canary 前置自检只读取 Pulse、却同时检查 Task baseline；修复为与
   legacy 夹具相同的 Task/Brief/Pulse 三文件合并自检，保留全部 canary，完整重跑通过。
8. SafeGit bootstrap 最初会把相对 root 隐式绑定到 ambient cwd；现 public root 必须是绝对路径，
   OS 缺少 `O_NOFOLLOW/O_DIRECTORY` 时 fail closed。
9. `.git` 首次 `lstat` 与实际 open 之间曾可被同类型对象替换；现 ordinary directory 与 linked
   pointer 都把首次 identity exact 比对 opened handle，并用两个确定性 race 用例覆盖。
10. 初版 fault-injection hook 会进入 public export，且 close failure 会被吞成假 closed；现 hook 仅存
    package-internal test seam，失败 handle 保留并可重试，成功后才撤销 capability authenticity。
11. Native binding 与 legacy descriptor 交接最初在关闭 legacy handles 之前完成最后重验，留下发布窗口；
    现关闭后再做同步 native revalidate，之后无 `await` 才发布 capability，并补 namespace swap 用例。
12. Revalidate 失败最初只 poison capability、不释放 descriptors；现同步关闭并进入 `closed`，只有 close
    失败时才保留 genuine binding 供重试。
13. 旧 filesystem V1 名称一度被复用于新语义；现删除旧 public alias/type/function，使用独立
    `descriptor_bound_safe_git_bootstrap_candidate_v1` profile 与 API。
14. Directory revalidate 一度把正常 worktree/index churn 误判为 binding drift；现 directory 只比较稳定
    dev/ino/uid/gid/mode identity，regular pointer 仍比较完整 stat 与 exact bytes。
15. Regular-file `fstatat → openat` 替换成 FIFO 曾可阻塞主线程；native 与 legacy open 均强制
    `O_NONBLOCK|O_NOCTTY`，并补 special-file rejection 门禁。
16. Preview fresh runner 最初不会先构建新 native package；现 Preview build 首步构建 bridge，cold-packed
    CLI 从安装包真实加载 profile 并执行 descriptor open/revalidate/close。
17. Directory snapshot 最初用 duplicated fd 读取并共享 open-file-description offset；现 descriptor-relative
    reopen `.` 获得独立 offset，并覆盖连续 promotion/revalidate。
18. Config parser 曾把 quoted/escaped trailing whitespace误 trim，并以 denylist 漏过 executable-valued key；
    现保留 Git 语义、拒绝 control whitespace，并使用 scope-aware fail-closed allowlist。
19. packed-refs 曾漏拒 packed replace ref 与 component-level `.lock`/dot prefix；现按 files ref component
    grammar校验并覆盖 hostile fixtures。
20. promotion 中途失败曾可能保留 partial directory snapshot，使同一 binding 重试越界；现失败永久
    poison native binding、释放 partial state，重复 bind/revalidate稳定 fail closed。
21. Directory snapshot entry 数组曾逐项 realloc 形成同步 O(n²) 风险；现使用有 hard cap 的几何扩容。

没有使用测试侧 unlock、旧 runtime overlay、放宽 Schema/timeout、恢复 legacy writer 或 skip 取得
绿色结果。

## 测试情况

已通过：

- Contracts：typecheck；58 generated schemas；28 fixtures；13 files / 147 tests；14 packed entry
  points distribution smoke。
- Native Kernel Bridge：Darwin arm64 build/typecheck、14/14；覆盖 ordinary、SHA-256、真实 linked worktree、strict
  config/local ODB/files refs、hostile control、snapshot cap、promotion poison、symlink/namespace drift/FIFO；
  Provider native compatibility 4/4 复跑通过。
- Repository State：typecheck/build；6 files / 118 passed、1 个既有 Linux-only skip；descriptor-bound SafeGit
  focused 31/31，覆盖 bootstrap、control promotion、真实 linked worktree、worktree config、
  alternate/reftable/include 与 config replacement。
- Provider Runtime：typecheck/build；25 files / 109 tests；最终 native compatibility 4/4 复跑通过。
- CLI：typecheck/build；cold-packed install 1/1，并从 tgz 内唯一 native asset 真实执行 profile、
  descriptor open/control-promotion/revalidate/close。
- Preview：从 `clean:build` 开始 build/typecheck；runtime 8/8，证明独立 runner 不依赖 stale native dist。
- CI：新增 Ubuntu/macOS native descriptor-binding matrix，并纳入最终 `quality` 汇总阻断。
- CLI：typecheck；15 files / 93 tests，包含 cold packed、installed dual-host、全部公开 capability
  locks 与 runtime-context negatives。
- Task Engine：typecheck/build；8 files / 84 tests。并发运行产生的 5 秒资源竞争超时已在无竞争
  串行完整复跑中全部通过，未修改 timeout。
- Dashboard：production build；affected loader/component 2 files / 9 tests。
- Artifact Store、Workbench Runtime：typecheck。
- Preview：typecheck/build；runtime 8/8；cold packed 1/1。
- checked-in `test:surface-release`（exit 0）：
  - Browser：1 passed / 0 failed / 0 skipped；
  - Codex + Claude plugin lifecycle：1 passed / 0 failed / 0 skipped；
  - candidate commit：`c18fb3c9d7ee18e241320023c47c272acd1208e2`；
  - candidate tree：`bbdd73389fa0145619ce748b19a285dcd2c20930`；
  - tgz：`sha256:751e16577934c20414f6df56af050d1e49ce6fa0eb2029b38923a5bd817c6823`；
  - regular files：87。
- Preview gate `node --check`、`git diff --check`。
- 最终独立 change-intent review：剩余 P0/P1 为 0。

## 可声明

- Contracts 能 lossless 读取 legacy Snapshot/Pulse，并识别 strict path-safe strong variants。
- `get_repo_pulse` 只返回 strict aggregate legacy redacted Surface；missing/strong Store 仍返回 exact
  opaque provider error。
- 全部公开 Task reads/writes、Evidence/search/impact 与 Workbench 在 strong Store unavailable 时稳定
  fail closed，且在 source、Git index、Store 层面零副作用。
- Preview Task endpoint 返回 exact HTTP 503，Graph/Wiki 仍可安全使用，legacy/unauthorized strong
  persisted state 不进入 HTTP/HTML/DOM。
- 当前源码的 cold pack、真实 Browser 与 Codex/Claude lifecycle 已在同一 verified candidate 上通过。
- SafeGit descriptor-bound candidate 可在不调用 Git 的情况下逐组件 no-follow 验证 ordinary layout 与
  真实 linked worktree 双向 backpointer；native handles、ACL/flags 与 namespace 可重验，错误和 inspection
  均不含 Host path/fd/inode/digest，capability close 或失败重验后失效。
- repository-control promotion 可 descriptor-relative 验证 strict common/worktree config、完整 local ODB
  layout 与 files ref backend；alternate/promisor/replace/shallow/reftable 和 drift 均 fail closed，projection
  不含 config bytes、ref/OID 或 Host locator。

## 不可声明与剩余边界

- 不得声称 HMAC identity/key lifecycle、完整 SafeGit adapter、security scanner、strong Snapshot/Pulse writer、
  Provider Store bootstrap/ownership/recovery 已实现。
- SafeGit candidate 仍不是完整 adapter；不得声称 empty-hooks proof、object/ref content reader、pinned
  binary/handle exec、fixed env/argv、OS sandbox/resource containment 或八类 control read-set 已全部闭合。
- 不得声称 `strongWrites`、strong Task baseline、formal Actual/Hunk/Check 或
  `evidence_backed_v1` 已开放。
- strong Surface projector 是冻结的结构投影；当前 public runtime 仍拒绝无 terminal Store authority
  的 strong payload。
- 本切片不证明 model-selected 双 Host、cross-platform、same-SHA CI、签名、SBOM、provenance 或
  正式 Release Gate。
- Step 16 仍受真实 model/Claude 凭证与授权语料阻塞；Step 17 GitHub Actions 仍受 billing/payment
  阻塞。

## 结论

最终独立 review 未发现剩余 P0/P1。本 bounded D-29 security/capability + SafeGit descriptor-bound
bootstrap/control slice 可提交；总体目标保持 active，继续 Step 15 的 empty-hooks、handle-bound execution、
OS sandbox、HMAC identity、path-safe writer、Task baseline 与 strong Check，不得将总目标标记 complete。
