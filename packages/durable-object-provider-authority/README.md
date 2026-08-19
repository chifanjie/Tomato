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
