# Durable Object Provider Contracts

Portable, fail-closed wire contracts for the WP5 durable-object provider boundary.

This first `WP5-C09-0` slice freezes the cryptographic format foundation:

- `rfc8785-jcs-safe-integer-v1` canonical JSON and exact canonical-byte parsing;
- independent branded digest, token, provider identity, and key primitives;
- host-injected SHA-256/HMAC with no Node dependency in production source;
- real domain-specific builders for installation identity, registry root key ID,
  and installation key-check token derivation;
- immutable cross-runtime golden and negative manifests;
- versioned generated JSON Schemas and packed-distribution smoke coverage.

The arbitrary domain/prefix crypto helpers are intentionally package-internal.
Consumers use the exported domain-specific builders so a caller cannot swap a
domain or output prefix.

## Verification

```sh
pnpm --filter @understand-code/durable-object-provider-contracts build
pnpm --filter @understand-code/durable-object-provider-contracts typecheck
pnpm --filter @understand-code/durable-object-provider-contracts test
pnpm --filter @understand-code/durable-object-provider-contracts test:distribution
```

The tracked manifests live under `fixtures/v1`. Expected bytes and crypto results
are literal reviewable constants; tests never generate expected values with the
implementation under test.

## Scope boundary

This package establishes the common foundation needed by AT-C21 and AT-C29; it
does not claim those end-to-end acceptance groups are complete. Generic set
ordering fixtures in this slice cover only the UTF-8 bytewise foundation, not
every domain-specific comparator. Ed25519/signature substitution, path/OID/time/
producer primitives, and full cross-language provider execution remain pending.
Later WP5 slices must add all remaining stable/digest/HMAC domains, Ed25519 signer wrappers,
provider Registry/Catalog/Taxonomy/Release Matrix contracts, provider runtime and
real-filesystem conformance, migration proofs, and the cross-language provider
implementation that consumes these same immutable manifests.
