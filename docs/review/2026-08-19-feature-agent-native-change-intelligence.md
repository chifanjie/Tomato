# Provider Service Lifecycle Crash-Recovery Review

- Generated: 2026-08-19 20:35:51 +0800
- Branch: `feature/agent-native-change-intelligence`
- Base commit: `ac230bd`
- Review scope: provider-service lifecycle pinned publication, crash recovery, custody, and native opened-fd access-control admission

## Background and motivation

The provider-service lifecycle could leave deterministic staging publications behind after a crash, skip a rollback snapshot when only its staged name survived, or perform pathname deletion after an exact read while the service principal still controlled the containing directory. Those states could permanently block recovery or delete a replacement inode rather than the journal-pinned artifact.

The intended result is fail-closed, crash-convergent install, upgrade, rollback, and uninstall behavior: only the exact journal- or manifest-pinned publication may be converged or removed, foreign state must be preserved, and Doctor must not report a lifecycle-created recoverable state as healthy.

## Implementation strategy

1. Treat the canonical path and deterministic staging path as one pinned publication. Recover stage-only, exact hard-link pairs, and recognized metadata-transition cuts; reject independent or foreign inodes.
2. Require an exact prior canonical digest and length before any replacement. Upgrade and rollback derive that baseline from the current manifest or rollback chain rather than trusting staged bytes alone.
3. Remove staged aliases before canonical aliases, and inspect both names before any missing-path early return in rollback and uninstall recovery.
4. Pin the runtime-root inode in the durable control journal and temporarily transfer directory custody to the lifecycle authority while exact service-owned artifacts are validated or removed.
5. Verify the complete authority-owned ancestor chain and opened inode state. The native fd seam rejects granting ACLs, immutable/append flags, kind mismatches, unsupported checks, and syscall races.

## Scope

| Area | Files | Review focus |
| --- | --- | --- |
| Native admission | `native/kernel_peer_credentials.c`, `src/native-kernel-peer.ts` | Opened-fd kind, ACL, immutable/append, snapshot stability, opaque fail-closed errors |
| Lifecycle state machine | `src/provider-service-installation-lifecycle.ts`, `src/provider-service-installation-privilege-internal.ts` | Pinned publication convergence, exact replacement baseline, journal ordering, runtime-root custody, ancestor/parent invariants |
| Regression coverage | `test/native-kernel-peer.test.ts`, `test/provider-service-installation-lifecycle.test.ts` | Stage-only and nlink=2 cuts, metadata cuts, early-return replay, foreign-inode preservation, install/uninstall custody and marker cuts |

## Review focus and result

The final independent review traced upgrade snapshot publication, rollback config/descriptor/manifest recovery, rollback snapshot deletion, uninstall validation/removal, install compensation, retained Installation Identity reuse, runtime-root creation-marker cuts, same-UID replacement races, ancestor ownership, and native ACL/flags admission.

No reproducible P0, P1, or actionable P2 remains in the reviewed scope. In particular:

- an exact canonical/stage rollback snapshot pair converges to one canonical publication before the transaction advances;
- a stage-only rollback publication is not skipped by rollback or uninstall;
- replacement is allowed only when the existing canonical artifact matches the caller-provided baseline;
- lifecycle cleanup preserves foreign or independently published inodes and retains recovery state;
- install and uninstall cleanup execute while holding the journal-pinned runtime-root fd under authority custody;
- lifecycle-owned recoverable stages do not produce a false healthy Doctor result.

## Validation

- Durable object provider runtime package: 25 files, 109 tests passed.
- Lifecycle focused suite: 27/27 passed.
- Native focused suite: 4/4 passed.
- Runtime source and test TypeScript checks passed.
- Runtime build, including the Darwin native addon, passed.
- CLI package: 70/70 tests, cold packed test, and installed dual-host Alpha test passed.
- Preview package: runtime 8/8 and cold packed test passed.
- Repository root typecheck passed.
- `git diff --check` passed.

## Residual evidence gap

The Linux native branch was reviewed against the platform APIs but was not compiled or executed locally because no Linux sysroot was available and the Docker daemon was unavailable. Linux CI/package gates must exercise real POSIX access/default ACLs, NFSv4/rich ACL xattrs, immutable/append flags, and unsupported `FS_IOC_GETFLAGS` behavior.

The local lifecycle fixture normally runs the lifecycle authority and service principal under the same UID. Privileged CI still needs a real `root -> dedicated service UID -> root` custody/restore end-to-end case. These are verification gaps, not known correctness findings; unsupported/error paths remain fail-closed.

## Conclusion

🟢 The change satisfies the reviewed crash-recovery and exact-publication intent and is suitable to commit. Production strong-write authority remains locked and outside this slice until the formal production Acceptance ABI and Root/OS authority broker are implemented.
