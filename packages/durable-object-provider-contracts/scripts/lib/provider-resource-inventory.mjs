import { createHash } from "node:crypto";

export const FIXED_PROVIDER_RESOURCES = Object.freeze([
  Object.freeze({
    path: "bootstrap-trust-bundle-v1.json",
    archivePath:
      "package/provider/bootstrap-trust-bundle-v1.json",
    byteLength: 6_518,
    sha256Hex:
      "794c4d1032c249563ee43b325de6625031202a43ea1a32e783a60b79ab1bcd6d",
  }),
  Object.freeze({
    path: "ed25519-strict-host-conformance-v1.json",
    archivePath:
      "package/provider/ed25519-strict-host-conformance-v1.json",
    byteLength: 13_167,
    sha256Hex:
      "89859dd0125f3779624ef5882417351d583f87fcf41aae6e95dc5ae4b4eb1226",
  }),
]);

function failure(reason, path) {
  return Object.freeze({
    ok: false,
    stage: "fixed_resource_inventory",
    reason,
    ...(path === undefined ? {} : { path }),
  });
}

export function diagnoseExactProviderResourceEntries(
  entries,
  expectedResources,
) {
  for (const resource of expectedResources) {
    const matches = entries.filter(
      (entry) => entry.path === resource.path,
    );
    if (matches.length === 0) {
      return failure("resource_missing", resource.path);
    }
    if (matches.length !== 1) {
      return failure("resource_duplicate", resource.path);
    }
  }

  const expectedPaths = new Set(
    expectedResources.map((resource) => resource.path),
  );
  const unexpected = entries.find(
    (entry) => !expectedPaths.has(entry.path),
  );
  if (unexpected !== undefined) {
    return failure("resource_unexpected", unexpected.path);
  }

  for (const resource of expectedResources) {
    const entry = entries.find(
      (candidate) => candidate.path === resource.path,
    );
    if (entry.type !== "regular" || entry.nlink !== 1) {
      return failure("resource_type_invalid", resource.path);
    }
    const sha256Hex = createHash("sha256")
      .update(entry.bytes)
      .digest("hex");
    if (
      entry.bytes.byteLength !== resource.byteLength ||
      sha256Hex !== resource.sha256Hex
    ) {
      return failure(
        "fixed_resource_identity_mismatch",
        resource.path,
      );
    }
  }

  return Object.freeze({ ok: true });
}

export function assertExactProviderResourceEntries(
  entries,
  expectedResources,
  label,
) {
  const diagnostic = diagnoseExactProviderResourceEntries(
    entries,
    expectedResources,
  );
  if (!diagnostic.ok) {
    throw new Error(
      `${label} rejected at ${diagnostic.stage}/${diagnostic.reason}${diagnostic.path === undefined ? "" : ` (${diagnostic.path})`}`,
    );
  }
}
