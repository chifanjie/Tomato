# Local Release and Contract Gates Evidence — 2026-09-05

## Scope

This record covers only locally reproducible work completed while Claude authentication is intentionally paused. It does not claim dual Host execution, Gold completion, publisher signing, or formal Release.

## Completed gates

- `pnpm --filter @understand-code/contracts test`: 17 files, 194 tests; generated schema and fixture checks passed (69 schemas, 28 fixtures).
- `pnpm --filter @understand-code/contracts exec tsc --noEmit`: passed.
- `pnpm --filter @understand-code/task-engine exec vitest run test/impact.test.ts test/context-boundary.test.ts`: 17 tests passed.
- `pnpm exec vitest run src/__tests__/ci-workflow.test.mjs`: 4 tests passed, including the required `await` on the Step16 async verifier.
- `pnpm --filter @understand-code/cli exec vitest run test/release-doctor.test.ts`: passed.
- `pnpm --filter @understand-code/core test`: 53 files, 961 tests passed.
- `pnpm --filter @understand-code/cli test`: 27 files, 250 tests passed.
- CLI build followed by Preview build: passed.
- Preview Alpha candidate assembly and verification: 1/1 passed.
- Preview cold packed install lifecycle: passed; the archive contains 91 allowlisted files, including SBOM and provenance.
- Preview runtime, plugin wrapper, and browser-facing lifecycle tests remain passing from the same build.

## New evidence-bound behavior

- Impact steps retain static resolver provenance: repository-relative file path, positive source line, confidence, and `static-analysis` source.
- Alpha Gold task definitions are deterministic and cover all 24 frozen slots. The checked-in fixture is explicitly `draft` with pending owner/task review; versioning requires distinct two-person approvals.
- The Step16 CI closing gate awaits `verifyStep16DualHostEligibleEvidenceV1`; a rejected promise can no longer pass the shell gate.
- Preview release metadata contains a CycloneDX 1.5 SBOM with workspace/package dependency identities and shipped-file SHA-256 entries, plus an unsigned provenance record bound to Git commit/tree and the lockfile digest. Candidate and Release Doctor checks validate the metadata and fail closed on tampering.

## Remaining blockers

Claude remains unauthenticated by user instruction. Therefore real Claude Host execution, the 24 real Gold Task runs, Alpha-B owner authorization, trusted provenance, publisher signature, and formal Release remain open. The local candidate is an unsigned Alpha artifact and is not represented as the final product.
