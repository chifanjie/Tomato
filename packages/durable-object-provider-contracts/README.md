# Durable Object Provider Contracts

Portable, fail-closed wire contracts for the WP5 durable-object provider boundary.

The `WP5-C09-0` slice freezes the cryptographic format foundation,
`WP5-C09-1A` adds the public provider failure boundary, `WP5-C09-1B`
freezes strict Ed25519 host conformance, and `WP5-C09-1C` closes the
structure-only bootstrap trust bundle. `WP5-C09-1D` adds portable Root
Metadata lookup and verifies the retained successor history:

- `rfc8785-jcs-safe-integer-v1` canonical JSON and exact canonical-byte parsing;
- independent branded digest, token, provider identity, and key primitives;
- host-injected SHA-256/HMAC with no Node dependency in production source;
- real domain-specific builders for installation identity, registry root key ID,
  and installation key-check token derivation;
- immutable cross-runtime golden and negative manifests;
- versioned generated JSON Schemas and packed-distribution smoke coverage.
- the single-authority `provider_unavailable` error with six ordered reasons,
  strict privacy-minimal fixtures, and a dedicated `./provider-error` export.
- an independent raw32 public-key digest that never hashes base64 text, JCS, or
  SPKI and preserves the existing domain-specific key-ID derivations;
- a browser/worker-portable strict PureEd25519 reference primitive with
  canonical, non-identity, prime-subgroup `A` and `R`, `S < L`, and the
  unbatched cofactorless verification equation;
- one immutable 28-case signed-package resource, an exact 56-point plus
  28-signature startup KAT, and a module-private opaque capability that retains
  captured method references after successful attestation.
- the fixed Bootstrap Trust Bundle Pin/Envelope/Payload, bootstrap root and
  self-signed generation-one Root Metadata, three sorted independent recovery
  keys, the literal 2-of-3 threshold, and frozen trust-history policy;
- a signed-package identity digest and distribution-root binding that pin the
  Bundle outside the five upgradeable distribution-history chains;
- one immutable cross-language bootstrap-structure crypto manifest with eight
  literal cases covering the signed-package identity, Bundle payload, Root
  Metadata, fixed-resource and deterministic root signatures, and all three
  recovery key IDs;
- one exact 51-case bootstrap rejection manifest with 71 deterministic
  witnesses spanning fixed-resource inventory, raw/semantic Pins, domain
  separation, Envelope and key closure, wrong-message Ed25519 signatures,
  recovery ordering, opaque-capability forgery, and deterministic fixtures;
- immutable Installation Identity retained-origin fields and a conservative
  current versus historical-recovery classifier that never substitutes the
  current Bundle for missing or malformed retained trust;
- a canonical `StoreFilenameKeyV1` codec with reversible `id-` keys for short
  semantic IDs, SHA-256-bound `idh-` keys for long IDs, and exact verification
  of either branch against the trusted semantic ID;
- the only allowed Root Metadata state-relative locator,
  `provider/root-metadata/<StoreFilenameKey(rootGeneration ":" rootKeyId)>.json`,
  built from an exact plain-data locator rather than a caller-supplied path;
- immutable Root Metadata history validation for the bootstrap anchor,
  contiguous predecessor Pins, planned rollover, compromise recovery, strict
  Ed25519 point admission, recovery quorum, and historical key-material
  non-reuse;
- one three-generation bootstrap to planned-rollover to compromise-recovery
  golden resource and one exact 31-case executable rejection corpus, each
  independently bound by raw-resource and semantic JCS digests.

The arbitrary domain/prefix crypto helpers are intentionally package-internal.
Consumers use the exported domain-specific builders so a caller cannot swap a
domain or output prefix.

## Verification

```sh
pnpm --filter @understand-code/durable-object-provider-contracts build
pnpm --filter @understand-code/durable-object-provider-contracts typecheck
pnpm --filter @understand-code/durable-object-provider-contracts verify:bootstrap-trust-invalid
pnpm --filter @understand-code/durable-object-provider-contracts verify:bootstrap-trust
pnpm --filter @understand-code/durable-object-provider-contracts verify:provider-root-history
pnpm --filter @understand-code/durable-object-provider-contracts test
pnpm --filter @understand-code/durable-object-provider-contracts test:distribution
```

The tracked manifests live under `fixtures/v1`. Expected bytes and crypto results
are literal reviewable constants; tests never generate expected values with the
implementation under test.

The separate
`fixtures/v1/golden/ed25519-public-key-digest-v1.json` keeps the original
golden manifest byte-for-byte unchanged while distributing the D-31
`00..1f` raw32 digest and the unchanged legacy root key ID to every language
consumer.

The versioned provider-error reference and invalid fixtures are checked by both
the runtime Zod contract and its generated draft-2020-12 JSON Schema. The public
error deliberately contains only `schemaVersion`, `code`, and `details.reason`.

The strict host resource is fixed at
`provider/ed25519-strict-host-conformance-v1.json`. The portable attestor chooses
that path and its 4 MiB pre-materialization cap; callers provide only a package
resource resolver, not a manifest object or alternate path. The resource is
canonical JCS, exact-covers the compiled case tuple, and must match the compiled
semantic content digest before any KAT method is called.
Packed-distribution verification executes that same 56+28 KAT from the emitted
ES2022 browser bundle with Node-only globals removed, in addition to scanning
the bundle for Node runtime dependencies.

The Bundle resource is fixed at
`provider/bootstrap-trust-bundle-v1.json`, has the compiled content digest
`sha256:a9aad99fd56ce76cf315514f258965e3d77e4da9e6a13897f42a27513a5c1cbc`,
and is byte-identical to
`fixtures/v1/golden/bootstrap-trust-bundle-v1.json`. Bundle and strict-manifest
resources each have their own 4 MiB pre-materialization limit. Verification
runs the 56+28 host KAT, then rejects any otherwise self-consistent Bundle
whose derived digest does not equal the compiled Pin before consulting trust
keys. It next uses the resulting opaque capability for two
golden root-signature point/signature pairs, followed by exactly four
Bundle trust-key point admissions and one bootstrap self-signature
verification. The complete path therefore performs 62 point and 31 signature
calls in total.

The matching cross-language fixture is
`fixtures/v1/golden/provider-bootstrap-structure-crypto-v1.json`. It freezes
the exact JCS UTF-8 hex, SHA-256 result, key ID or raw Ed25519 signature for
five domains across eight cases. It also records the fixed Bundle file-byte
length and SHA-256 separately from semantic payload digests. The one published
seed is explicitly non-production, uses key material independent from the
Bundle root and recovery keys, and exists only to let every implementation
reproduce the same signer output. Node and browser distribution probes consume
this same file through the raw-resource verifier rather than copying expected
constants into runtime-specific tests. That boundary requires the exact
41,713-byte resource and its compiled SHA-256 before parsing, then independently
requires the compiled semantic-manifest digest; whitespace/key-order aliases
and fully coherent alternate fixture contents both fail closed.

The matching rejection corpus is
`fixtures/v1/invalid/provider-bootstrap-structure-crypto-v1.json`. Its schema
uses an exact ordered 51-item tuple, while matrix cases freeze 71 total
witnesses and their diagnostic boundary, stage/reason, and exact
post-attestation point/signature call counts. The manifest itself is bound by
independent raw-byte and semantic JCS digests. Every witness also carries a
closed `provider_bootstrap_invalid_recipe_v1` operation/operand tuple and an
explicit deterministic-input source: either no seed, a literal non-production
seed, or a JSON Pointer into the pinned golden resource. A cross-language
consumer can therefore reproduce each mutation from the manifest alone rather
than depending on the Node runner's source code; the prefix-mismatch signature
vector also carries its alternate root key ID as a literal recipe operand,
without hidden cross-case state. The Node reference runner
first proves each coherent-alternate or valid-under-wrong-domain precondition,
then executes the shared production diagnostics or public fail-closed
boundary. Value-returning domain derivations and deterministic fixture
comparisons are explicitly labeled `reference_oracle`, rather than being
presented as production diagnostics. The runner never treats an arbitrary
thrown message as the rejection oracle.
Packed Node and browser consumers validate the same raw manifest and generated
draft-2020-12 JSON Schema.

`StoreFilenameKeyV1` encodes the UTF-8 bytes of an already domain-validated
semantic ID. A canonical lowercase unpadded base32hex body of at most 220
characters (at most 137 UTF-8 bytes) uses the reversible `id-` branch; a
semantic ID of 138 UTF-8 bytes or more uses
`idh-<lowercase sha256(semantic-id UTF-8)>`. Hashed keys are deliberately not
decoded, and either branch must be recomputed against the trusted semantic ID
before use. The generated `short-store-filename-key-syntax` and
`store-filename-key-syntax` JSON Schemas prove only alphabet, length, branch,
and canonical unpadded-base32hex trailing-bit syntax. Full validation must
still perform fatal UTF-8 decode, exact re-encoding, canonical branch
selection, and semantic-ID recomputation; the JSON Schema documents do not
claim that authority. Root Metadata lookup exposes no arbitrary-path API: its
fixed locator derives the filename component from the exact
`rootGeneration:rootKeyId` semantic value. The short alphabet is lowercase
only, so two distinct semantic IDs cannot collapse merely because the host
filesystem compares filename case insensitively.

The retained Root Metadata validator anchors generation one exactly to the
Bootstrap Trust Bundle and requires every successor generation and predecessor
Pin to be contiguous. Planned rollover requires the new-root self-signature,
the predecessor-root cross-signature, and an exact sorted, distinct 2-of-3
recovery quorum. Compromise recovery requires the new-root self-signature and
the same recovery quorum without a predecessor cross-signature. Every active
root is strictly admitted as an Ed25519 point and may reuse neither historical
root material nor recovery material. The Bundle policy caps a retained history
at 256 generations and each canonical trust Envelope at 4 MiB.

The matching cross-language resources are
`fixtures/v1/golden/provider-registry-root-history-v1.json` and
`fixtures/v1/invalid/provider-registry-root-history-v1.json`. The golden
resource freezes bootstrap, planned-rollover, and compromise-recovery
generations, their canonical signature messages, Pins, and fixed locators. The
invalid resource freezes 31 ordered, self-contained mutation recipes together
with their exact rejection stage/reason and post-attestation crypto call
counts; the operation and seed semantics are defined in
`fixtures/v1/invalid/provider-registry-root-history-invalid-recipe-v1.md`.
The invalid resource has only `none_rejection_only` authority. Their semantic
anchors are exactly
`SHA-256(JCS(["provider-registry-root-history-golden-manifest-v1", manifest]))`
and
`SHA-256(JCS(["provider-registry-root-history-invalid-manifest-v1", manifest]))`;
both domain literals are exported so independent implementations need not infer
the preimage. `verify:provider-root-history` first checks the generators and
both raw and semantic resource anchors, then executes the valid chain and every
negative recipe. Packed Node and browser consumers verify these same resources;
the valid chain requires exactly 11 point admissions and 9 strict signatures.

These checked-in trust resources are deliberately pre-release conformance
fixtures. The standalone Bootstrap Trust Bundle's one-time signing keys were
not retained. By contrast, the Root Metadata history corpus intentionally
publishes deterministic, non-production signing seeds so independent
implementations can reproduce signatures and executable rejection recipes;
those fixture keys must never be reused or trusted outside conformance tests.
A successful Bundle validation remains `authority: "none_structure_only"`.
Successful Root Metadata history validation is likewise limited to
`authority: "none_structure_and_history_only"`. Neither result is a production
registry authority. A future signed-package resolver, offline production key
ceremony, and crash-safe installer transaction must establish that authority
before any strong provider capability can be exposed.

## Scope boundary

This package establishes the common foundation needed by AT-C21, AT-C29,
AT-C31, and AT-Q33; it does not claim those end-to-end acceptance groups are
complete. Generic set
ordering fixtures in this slice cover only the UTF-8 bytewise foundation, not
every domain-specific comparator. Path/OID/time/producer primitives,
signed-package provenance authority, atomic Installation Identity persistence,
and full cross-language provider execution remain pending.
Later WP5 slices must add all remaining stable/digest/HMAC domains, Ed25519 signer wrappers,
signed Registry Entry and Registry Manifest contracts, Catalog/Taxonomy/Release
Matrix contracts, provider runtime and real-filesystem conformance, migration
proofs, and the cross-language provider implementation that consumes these same
immutable manifests.
