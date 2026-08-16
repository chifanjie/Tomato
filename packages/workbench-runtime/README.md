# Workbench runtime

This package provides the minimal local Workbench session backend. It binds an
already-canonical repository root and published identity, starts a read-only
HTTP server on `127.0.0.1`, and mints one-time 60-second launch tokens in URL
fragments. The server exposes only health, launch redemption, and a read-only
task route; it does not execute commands or write Task artifacts.

The package is intentionally a local runtime candidate. Host integration,
browser UI, OS-principal isolation, and the full rendezvous/idle lifecycle are
separate hardening work.
