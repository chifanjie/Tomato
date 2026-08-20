# Durable Object Provider Acceptance Authority

This private, Node-only package is the installation-owner candidate for the
formal Provider Acceptance current/high-water/receipt store. It keeps the
Installation Identity key outside the provider runtime, serializes updates
across processes, and publishes each complete logical transaction through one
atomically replaced authenticated snapshot plus an independently authenticated
publication pin. Every read holds the same cross-process lock and verifies the
exact snapshot/pin relation. The only recoverable two-layer cut is snapshot
revision `N+1` whose `previousSnapshotContentDigest` equals the exact valid pin
for `N` **and** whose separately durable, authenticated publication intent is
still present and pins that exact transition. Replaying an older valid pin
without the intent, pin-ahead, and unrelated pairs all fail closed.

Because generation, complete enumeration, high-water, and receipt share that
one snapshot, `namespace_integrity_failed` is not appended as a receipt by this
backend. Snapshot, pin, HMAC, or closure corruption fails before admission with
zero writes, and Doctor reports `integrity_failed`.

The candidate deliberately reports `strongWrites: "locked"`. Replaying the
entire authority root or underlying volume remains outside this two-file
candidate's resistance boundary (a future production authority needs an
independently retained append-only/OS-backed anchor). It is not a production
strong-write grant broker and does not authorize provider I/O.
Production layout is derived from trusted OS account information; arbitrary
filesystem roots and test provisioning are available only through the explicit
internal test seam while `NODE_ENV=test`.

The package also contains a source-internal, locked strong-mutation broker
transaction candidate. It is intentionally absent from the package root,
export map, and executable. While holding the same cross-process lock as
Acceptance compare-append, `begin` independently reads the authenticated
Acceptance current and requires the structurally valid grant's Acceptance
identity to equal that fresh current exactly. It also recomputes the formal
logical request digest and same-session binding digest before recording the
strictly parsed full request.

Each new grant ID first becomes a durable `pending` intent; a later strict
provider response can only move that exact intent to `resolved` when each
request/binding identifier and each locally derivable success semantic
described below joins exactly. The complete response is retained. Identical
requests and responses replay the same record, while reuse of a grant ID with
different canonical request bytes or a different resolved response is rejected
without publishing a successor.
Broker state uses its own authenticated snapshot and independently
authenticated publication pin with deterministic crash-recovery stages. Thus
the candidate never creates a standalone durable grant burn without the full
pending request record.

This transaction substrate performs structural and self-binding validation
only. It does **not** verify the grant signature against an active
Registry-selected authority key, and it does not verify the provider response
signature. Stored records therefore say
`grantVerification: "not_established"`, resolved records say
`responseVerification: "not_established"`, and the broker store and records
say `executionFence: "not_established"`. Every public surface continues to say
`strongWrites: "locked"`. Acceptance can advance between `begin` and
`resolve`; this slice does not fence that span with provider execution or an
atomic outcome transaction. Nothing in this candidate is a consume decision,
session capability, or authorization to execute provider I/O.

For a structurally successful compare-commit response, the locked substrate
requires the proposed next revision, phase, operation nonce, and artifacts and
rejects a `mutationDigest` of `"none"`. The exact mutation-digest derivation is
currently runtime-private, so independently deriving and verifying that digest
is not established here; it remains part of the explicit execution-fence
residual rather than an authority claim.

Broker retention limits are likewise local guards, not global D-40 admission:
at most 4,096 intents, 8 MiB for each strict request or response, and a
256 MiB physical broker snapshot. Load re-derives each record's canonical size
and the complete accounting before accepting a snapshot. These bytes are not
aggregated with Acceptance, Root, Registry, or Catalog history, so satisfying
the broker-local limits does not establish global capacity authority.

Capacity enforcement in this package is deliberately Acceptance-local. The
store derives its own retained Acceptance bytes and enforces the literal
generation, receipt, single-envelope, and receipt-byte policy caps. It also
checks that the Acceptance-local contribution alone stays conservatively below
the policy's total-history ceiling and normal reserve. That contribution check
is necessary, not sufficient, for the global 256 MiB limit: this package has no
authoritative retained-byte source for Root metadata, Registry manifests, or
Support Catalog history. Callers cannot supply those totals, and global D-40
capacity admission remains unavailable for a future broker. Neither the API nor
Doctor claims global capacity authority; `strongWrites` therefore remains
`"locked"`.

Cross-process lock ownership currently binds an authenticated nonce and inode
to an OS PID, but not to a kernel-backed process-start identity. If a dead
owner's PID is reused by an unrelated long-lived process, recovery conservatively
fails closed with persistent `authority_busy` until that unrelated process
exits. This is an availability-only residual of the
locked candidate; a production broker must use kernel-backed process identity.

The installed executable accepts exactly one command, `doctor`. It takes no
path, root, key, or configuration arguments, emits one path-redacted JSON line,
and exits `0` only when the candidate is ready (`1` for unprovisioned or failed
integrity, `2` for invalid arguments). It cannot provision, read current state,
or append.
