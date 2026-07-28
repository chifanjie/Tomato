# Large Repository Performance Evidence

Capture date: 2026-07-28

Fixture protocol: `large-repository-v1`

Benchmark protocol: `2`

## Files

- `large-repository-baseline.json` — machine-readable environment, source hashes, raw timing samples, nearest-rank p50/p95, budgets, integrity counters and pass/fail result.

## Reproduce

From the repository root:

```bash
pnpm benchmark:large-repository -- --output /tmp/understand-code-large-repository-baseline.json
```

The command exits non-zero when a p95 budget fails. The benchmark never reads the ignored local `.understand-code` directory.

## Integrity

```text
b6feda0dd98aaa3a5adde2434c90038a1a50f30c3c360cee8e4013fc5757a6ac  large-repository-baseline.json
```

The JSON itself records pnpm and Node versions, the lockfile SHA-256, stable corpus checksums, production source hashes, raw samples, layout validity, frozen workload signatures and bounded-view integrity gates.
