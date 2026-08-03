# Provider Registry Manifest History invalid recipe dialect v1

This document defines the executable mutation dialect used by
`provider-registry-entry-manifest-history-v1.json`.

## Authority and dependency

- Dialect: `provider_registry_manifest_history_invalid_recipe_v1`
- Fixture authority: `none_rejection_only`
- Golden dependency:
  `fixtures/v1/golden/provider-registry-entry-manifest-history-v1.json`
- The corpus proves only deterministic rejection behavior. It grants no
  provider, distribution, catalog, acceptance, or runtime authority.
- Every recipe is materialized from the byte- and semantic-anchored golden
  resource. A recipe never embeds or silently substitutes another baseline.

## Recipe shape

Each ordered case has exactly one frozen step:

```json
{
  "operation": "case-id",
  "targetJsonPointer": "/registryManifestHistory/0",
  "operands": []
}
```

`operation` is identical to `caseId`. `targetJsonPointer` identifies the
semantic mutation target; `operands` is an exact ordered tuple. The checked-in
TypeScript definitions, resource case tuple, and runner switch must agree on
all three fields. Unknown operations, missing targets, extra steps, reordered
cases, duplicate IDs, or extra properties are errors in the corpus itself.

This is a closed, non-extensible fixture dialect, not a general JSON Patch
interpreter. Every operation has an explicit runner implementation. The target
and operand tuple are independently reviewed, integrity-bound metadata that
describe that implementation and must match before the runner reads golden
data.

## Execution contract

For each case the executable generator/verifier path:

1. clones the smallest golden Manifest-history prefix needed to reach the
   intended boundary, plus the complete retained Root history and trust bundle;
2. applies the sole named mutation and repairs only the enclosing digests,
   identifiers, signatures, and predecessor data necessary to avoid an earlier
   unrelated failure;
3. derives and checks the case's domain-separated canonical
   `materializedRequestSemanticDigest`, so any extra, missing, or differently
   repaired request field makes the checked-in corpus stale;
4. for a wrong-domain signature, first proves with raw Ed25519 verification
   that the signature is valid for the explicitly recorded alternate-domain
   message;
5. invokes the internal diagnostic entrypoint and requires the exact object
   `{ ok: false, stage, reason }`;
6. requires the exact post-attestation point-validation and signature-
   verification call counts recorded by the case; and
7. invokes the public validator and requires only
   `ProviderRegistryManifestHistoryValidationError` with code
   `provider_unavailable` and reason `attestation_invalid`.

An arbitrary throw, materialization exception, unexpected public error,
different diagnostic boundary, or different crypto call count never satisfies
a case.

All 89 materialized request digests must also be unique. The request digest domain is
`provider-registry-manifest-invalid-materialized-request-v1`. The canonical
projection contains every materialized request data field. The attested opaque
crypto capability is represented by a fixed out-of-band sentinel because it is
not JSON-serializable, and a deliberately sparse hostile array records each
hole with a fixed sentinel. The fixture schema contains a separately reviewed
89-item digest tuple, while the verifier independently reconstructs and hashes
the materialized request.

The runner also contains an independent frozen 89-item recipe tuple. It does
not import that tuple from the definitions or generated resource, and rejects
an unknown case, altered target, reordered operand, missing closure field,
extra field, or any step count other than one before reading golden data. Crypto
call counts are likewise held in a static reviewed generator tuple; observed
counts can only be compared with that tuple and are never auto-promoted to
expected values.

## Hostile bound recipes

The dialect includes synthetic recipes that are intentionally not serialized
as expanded candidates: 4,097 history generations, one logical envelope above
4 MiB, a retained history above the fixed total-byte cap, 257 provider keys,
and 65 keys for one usage. The runner constructs these values at execution
time so the corpus stays small while the production pre-crypto limits are
tested exactly.

## Regeneration and verification

From the package directory, after building TypeScript:

```sh
node scripts/generate-provider-registry-manifest-invalid.mjs
node scripts/generate-provider-registry-manifest-invalid.mjs --check
node scripts/verify-provider-registry-manifest-invalid.mjs
```

Regeneration is deterministic. Any intended corpus change requires reviewing
the raw byte length/SHA-256 anchor and the independent semantic JCS digest in
`src/provider-registry-manifest-fixtures.ts`.
