# Durable Object Provider Client

Package-private, mutually authenticated Unix-socket client for the
separate-process, private-filesystem durable Provider candidate. Trust
selection is supplied by the caller; the runtime is never accepted as an
authority for its own selection. The current same-UID process boundary is not
proof of an OS service-principal isolation boundary, and the strong-write
capability remains locked to the caller-verified runtime selection.
