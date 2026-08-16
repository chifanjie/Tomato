# Durable Object Provider Runtime

This package runs the durable Provider storage boundary in a separate OS
process. Each process is permanently scoped at startup to one private root, one
Unix socket, one Provider ID, one HMAC secret, and one caller-authorized
capability digest.

The runtime is an execution target, not a trust authority. It does not select or
report Registry, Catalog, Evidence, or active-writer claims. An already verified
client may only issue the versioned fixed-locator object and durable journal
operations defined by
`@understand-code/durable-object-provider-contracts/provider-runtime-ipc-v1`.

The CLI accepts `--root`, optional `--socket`, `--provider-id`,
`--auth-key-file`, and `--capability-digest`. The key file contains exactly 32
raw bytes with mode `0600`; the runtime root is private (`0700`), while the
socket, objects, and journal state are `0600`.
