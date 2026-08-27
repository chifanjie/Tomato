# Installation lifecycle

This package owns the small, local installation lifecycle used by the CLI and
host adapters.  It writes only files below an explicitly selected installation
root.  The root can be supplied as `root` or `home`, or through
`UNDERSTAND_CODE_INSTALL_ROOT` / `UNDERSTAND_CODE_HOME`.

`installInstallationV1` writes a marker, an executable wrapper, and a host MCP
configuration.  Every owned file is recorded with a SHA-256 digest in the
manifest.  `doctorInstallationV1` verifies the marker, manifest shape,
ownership, regular-file type, and digests.  Uninstall is deliberately
fail-closed: a modified or replaced owned file prevents any deletion.

Codex and Claude installations may also select one explicit canonical Provider
installation root. The selector is stored in both owned config and manifest,
is revalidated by the complete installation Doctor before every strong Host
launch, survives an ordinary upgrade, and is restored by rollback. A missing,
symlinked, changed, or mismatched selector fails closed; uninstall removes only
the Host-owned reference and never deletes Provider state.
