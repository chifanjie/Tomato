# Workbench runtime

This package provides the minimal local Workbench session backend. It binds an
already-canonical repository root and published identity, starts a read-only
HTTP server on `127.0.0.1`, and mints one-time 24-hour launch tokens in URL
fragments. The server exposes only health, launch redemption, and read-only
Task surfaces for Brief, Graph, Knowledge, and Trace; it does not execute
commands or write Task artifacts.

An unused launch link can be opened for 24 hours after it is issued. Redemption
creates a browser session with a 24-hour absolute lifetime and a 24-hour idle
timeout. Links remain single-use, and both links and browser sessions require
the runtime process to stay running. Stopping the MCP server also closes its
Workbench runtime.

After updating this package, rebuild or install the updated runtime, restart
the MCP server, and call `open_workbench` again to get a new link. The longer
lifetime does not renew links that have already expired or been redeemed.

The package is intentionally a local runtime candidate. Host integration,
browser UI, OS-principal isolation, and the full rendezvous/idle lifecycle are
separate hardening work.
