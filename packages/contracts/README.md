# @understand-code/contracts

`@understand-code/contracts` is the single owner of persisted artifact and
cross-process wire contracts for Understand Code.

The package is deliberately portable:

- production modules may depend on Zod, but not on filesystem, Git, crypto,
  React, or host-specific APIs;
- new V1 persisted artifacts use a strict `ArtifactEnvelopeV1`;
- existing Graph, Meta, Fingerprint, Wiki, and Diff files remain explicit
  `legacy_raw` descriptors until a versioned migration is approved;
- `ArtifactManifestV1` is a strict control index, not an unversioned payload
  substitute; the append-only task event stream is represented explicitly by
  its `jsonl_v1` descriptor;
- `contentDigest` is the lowercase `sha256:<64 hex>` digest of the UTF-8 bytes
  of the canonical JSON representation of `payload` only;
- Task Event history starts with one revision-1 `task_created` genesis Event.
  `parseTrustedTaskArtifactBundleV1` recomputes every canonical Event digest
  with a host-provided SHA-256 function before returning trusted facts;
- migrations operate on JSON values in memory. Backup, atomic replacement, and
  audit logging belong to the artifact store.

Unknown fields are rejected by new V1 schemas. Compatibility readers for
legacy formats must opt into their documented behavior rather than relying on
Zod's default unknown-field stripping.

## Public modules

- `@understand-code/contracts` exports the complete V1 surface.
- `@understand-code/contracts/repository`, `/task`, `/evidence`, `/change`,
  `/invariants`, and `/mcp` provide focused entry points.
- `@understand-code/contracts/json-schema` generates the structural
  draft-2020-12 distribution without filesystem access.

Tracked schemas live under `schemas/v1`. Reference, invalid, and legacy fixtures
live under `fixtures/v1`; their generators validate all reference values before
writing.

```bash
pnpm --filter @understand-code/contracts generate:schemas
pnpm --filter @understand-code/contracts generate:fixtures
pnpm --filter @understand-code/contracts test
```

JSON Schema covers the transport-safe structural subset. Consumers must still
run the matching Zod parser for semantic rules such as reference symmetry,
Manifest dependency freshness, and Task lifecycle consistency. Zod structural
parsing does not prove cryptographic integrity: persisted envelopes require
`verifyArtifactContentDigestV1`, and Task bundles require
`parseTrustedTaskArtifactBundleV1`, both with a host-provided SHA-256
implementation.
