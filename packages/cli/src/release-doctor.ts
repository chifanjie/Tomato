import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { RepoPulseArtifactV1Schema } from "@understand-code/contracts/repository";
import { validateGraph } from "@understand-code/core";
import {
  parseWikiIndexV2,
  parseWikiSearchIndexV2,
} from "@understand-code/core/knowledge-base";

import { PRODUCT_VERSION } from "./constants.js";
import { openActiveRepositoryIndexV1 } from "./runtime/repository-indexer.js";

export const RELEASE_DOCTOR_SCHEMA_VERSION =
  "understand-code-release-doctor-v1" as const;

const MAX_JSON_BYTES = 64 * 1024 * 1024;
const MAX_METADATA_BYTES = 1024 * 1024;
const MAX_NATIVE_BYTES = 32 * 1024 * 1024;
const MAX_RELEASE_INVENTORY_FILES = 16_384;
const MAX_RELEASE_INVENTORY_BYTES = 512 * 1024 * 1024;
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/u;

export type ReleaseDoctorCheckIdV1 =
  | "node_runtime"
  | "git"
  | "repository_root"
  | "artifact_schema"
  | "loopback_port"
  | "package_metadata"
  | "release_manifest"
  | "bundle_integrity"
  | "native_tuple"
  | "codex_plugin_payload"
  | "claude_plugin_payload"
  | "release_authenticity"
  | "provider_strong_writes";

export type ReleaseDoctorCheckStatusV1 = "pass" | "fail" | "locked";

export type ReleaseDoctorCheckV1 = Readonly<{
  id: ReleaseDoctorCheckIdV1;
  status: ReleaseDoctorCheckStatusV1;
  code: string;
  summary: string;
  observed?: string;
  required?: string;
  remediation?: string;
}>;

export type ReleaseDoctorResultV1 = Readonly<{
  schemaVersion: typeof RELEASE_DOCTOR_SCHEMA_VERSION;
  product: "understand-code";
  version: string;
  readiness: "alpha";
  releaseReady: false;
  strongWrites: "locked";
  hostRegistration: "not_checked";
  ok: boolean;
  status: "healthy" | "unhealthy";
  checks: readonly ReleaseDoctorCheckV1[];
}>;

/**
 * The optional roots are a read-only dependency boundary for focused tests and
 * embedders. The public CLI deliberately exposes no path option for Release
 * Doctor: `doctor --root/--home` retain their managed-install meaning.
 */
export type ReleaseDoctorOptionsV1 = Readonly<{
  packageRoot?: string;
  repositoryRoot?: string;
}>;

type DigestReferenceV1 = Readonly<{
  path: string;
  sha256: string;
}>;

type PluginReleaseReferenceV1 = Readonly<{
  marketplaceRoot: string;
  marketplace: string;
  marketplaceSha256: string;
  pluginRoot: string;
  manifest: string;
  manifestSha256: string;
  mcp: string;
  mcpSha256: string;
  entrypoint: string;
  entrypointSha256: string;
  cli: string;
  cliSha256: string;
  native: string;
  nativeSha256: string;
  dashboardRoot: string;
  dashboardManifest: string;
  dashboardManifestSha256: string;
  dashboardFileCount: number;
  dashboardInventorySha256: string;
  payloadSha256: string;
}>;

type DashboardBundleManifestV1 = Readonly<{
  schemaVersion: "understand-code-dashboard-bundle-v1";
  productVersion: string;
  root: "dashboard";
  fileCount: number;
  inventorySha256: string;
}>;

type HostAdapterReleaseReferenceV1 = Readonly<{
  bin: string;
  entrypoint: string;
  entrypointSha256: string;
  manifest: string;
  configs: readonly string[];
}>;

type ReleaseManifestV1 = Readonly<{
  schemaVersion: "understand-code-alpha-release-v1";
  product: "understand-code";
  package: Readonly<{ name: "@understand-code/preview"; version: string }>;
  cli: DigestReferenceV1 & Readonly<{ bin: "understand-code" }>;
  preview: DigestReferenceV1 & Readonly<{ bin: "understand-code-preview" }>;
  native: DigestReferenceV1 & Readonly<{ tuple: string }>;
  runtime: Readonly<{
    productVersion: string;
    server: DigestReferenceV1;
    contracts: DigestReferenceV1;
  }>;
  dashboard: Readonly<{
    productVersion: string;
    root: "dist/dashboard";
    manifest: "dist/dashboard-manifest.json";
    manifestSha256: string;
    fileCount: number;
    inventorySha256: string;
  }>;
  hostAdapters: Readonly<{
    codex: HostAdapterReleaseReferenceV1;
    claude: HostAdapterReleaseReferenceV1;
  }>;
  pluginRoots: Readonly<{
    codex: PluginReleaseReferenceV1;
    claude: PluginReleaseReferenceV1;
  }>;
  sbom: Readonly<{ format: "CycloneDX-1.5"; path: "dist/sbom.cdx.json"; sha256: string }>;
  provenance: Readonly<{ format: "slsa-provenance-v1"; path: "dist/provenance.json"; sha256: string }>;
}>;

type PackageMetadataV1 = Readonly<{
  name: "@understand-code/preview";
  version: string;
}>;

function pass(
  id: ReleaseDoctorCheckIdV1,
  summary: string,
  details: Readonly<{ observed?: string; required?: string }> = {},
): ReleaseDoctorCheckV1 {
  return Object.freeze({ id, status: "pass", code: "ok", summary, ...details });
}

function fail(
  id: ReleaseDoctorCheckIdV1,
  code: string,
  summary: string,
  remediation: string,
  details: Readonly<{ observed?: string; required?: string }> = {},
): ReleaseDoctorCheckV1 {
  return Object.freeze({
    id,
    status: "fail",
    code,
    summary,
    remediation,
    ...details,
  });
}

function locked(
  id: ReleaseDoctorCheckIdV1,
  code: string,
  summary: string,
  remediation: string,
): ReleaseDoctorCheckV1 {
  return Object.freeze({
    id,
    status: "locked",
    code,
    summary,
    remediation,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && SHA256_PATTERN.test(value);
}

function digest(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function equalJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sanitizedGitEnvironment(): NodeJS.ProcessEnv {
  const environment = { ...process.env };
  for (const name of Object.keys(environment)) {
    if (name.toUpperCase().startsWith("GIT_")) delete environment[name];
  }
  environment.GIT_OPTIONAL_LOCKS = "0";
  environment.GIT_TERMINAL_PROMPT = "0";
  environment.LC_ALL = "C";
  return environment;
}

function runGit(arguments_: readonly string[]): string {
  const stdout = execFileSync("git", arguments_, {
    encoding: "utf8",
    env: sanitizedGitEnvironment(),
    maxBuffer: 64 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
    timeout: 5_000,
    windowsHide: true,
  });
  if (typeof stdout !== "string") throw new Error("git_output_invalid");
  return stdout.trim();
}

async function canonicalDirectory(candidate: string): Promise<string> {
  if (!path.isAbsolute(candidate) || /[\u0000-\u001f\u007f]/u.test(candidate)) {
    throw new Error("directory_invalid");
  }
  const canonical = await realpath(candidate);
  const metadata = await lstat(canonical);
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    throw new Error("directory_invalid");
  }
  return canonical;
}

function safeRelativePath(relativePath: string): boolean {
  return (
    relativePath.length > 0 &&
    !path.isAbsolute(relativePath) &&
    !/[\u0000-\u001f\u007f]/u.test(relativePath) &&
    relativePath.split(/[\\/]/u).every((segment) => segment !== "" && segment !== "..")
  );
}

async function readContainedRegularFile(
  canonicalRoot: string,
  relativePath: string,
  maxBytes: number,
): Promise<Buffer> {
  if (!safeRelativePath(relativePath)) throw new Error("file_path_invalid");
  const segments = relativePath.split(/[\\/]/u);
  let candidate = canonicalRoot;
  for (let index = 0; index < segments.length; index += 1) {
    candidate = path.join(candidate, segments[index]!);
    const metadata = await lstat(candidate);
    if (metadata.isSymbolicLink()) throw new Error("file_symlink");
    if (index < segments.length - 1) {
      if (!metadata.isDirectory()) throw new Error("file_parent_invalid");
    } else if (!metadata.isFile() || metadata.size > maxBytes) {
      throw new Error("file_invalid");
    }
  }
  return readFile(candidate);
}

async function buildDashboardInventory(
  packageRoot: string,
  dashboardRoot = "dist/dashboard",
): Promise<readonly Readonly<{ path: string; sha256: string; bytes: number }>[]> {
  const inventory: Array<Readonly<{ path: string; sha256: string; bytes: number }>> = [];
  let totalBytes = 0;
  async function walk(relativeDirectory: string): Promise<void> {
    const directoryRelative = relativeDirectory === ""
      ? dashboardRoot
      : `${dashboardRoot}/${relativeDirectory}`;
    const directory = path.join(packageRoot, ...directoryRelative.split("/"));
    const metadata = await lstat(directory);
    if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
      throw new Error("dashboard_directory_invalid");
    }
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) =>
      left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
    );
    for (const entry of entries) {
      if (entry.isSymbolicLink()) throw new Error("dashboard_symlink");
      const relativePath =
        relativeDirectory === ""
          ? entry.name
          : `${relativeDirectory}/${entry.name}`;
      if (entry.isDirectory()) {
        await walk(relativePath);
        continue;
      }
      if (!entry.isFile() || inventory.length >= 4_096) {
        throw new Error("dashboard_inventory_invalid");
      }
      const bytes = await readContainedRegularFile(
        packageRoot,
        `${dashboardRoot}/${relativePath}`,
        MAX_JSON_BYTES,
      );
      totalBytes += bytes.byteLength;
      if (totalBytes > 512 * 1024 * 1024) {
        throw new Error("dashboard_inventory_too_large");
      }
      inventory.push({
        path: relativePath,
        sha256: digest(bytes),
        bytes: bytes.byteLength,
      });
    }
  }
  await walk("");
  inventory.sort((left, right) =>
    left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
  );
  return inventory;
}

function validDashboardBundleManifest(
  value: unknown,
  fileCount: number,
  inventorySha256: string,
): value is DashboardBundleManifestV1 {
  return (
    isRecord(value) &&
    Object.keys(value).sort().join(",") ===
      "fileCount,inventorySha256,productVersion,root,schemaVersion" &&
    value.schemaVersion === "understand-code-dashboard-bundle-v1" &&
    value.productVersion === PRODUCT_VERSION &&
    value.root === "dashboard" &&
    value.fileCount === fileCount &&
    value.inventorySha256 === inventorySha256
  );
}

export type ReleasePayloadInventoryEntryV1 = Readonly<{
  path: string;
  sha256: string;
  bytes: number;
}>;

/**
 * Return the exact payload that was present when build.mjs generated the
 * unsigned SBOM and provenance. The three root metadata files are generated
 * after that inventory and therefore are deliberately excluded. This check is
 * integrity evidence only; publisher authenticity still requires a signature.
 */
async function buildReleasePayloadInventory(
  packageRoot: string,
): Promise<readonly ReleasePayloadInventoryEntryV1[]> {
  const inventory: ReleasePayloadInventoryEntryV1[] = [];
  let totalBytes = 0;
  async function walk(relativeDirectory: string): Promise<void> {
    const directoryRelative = relativeDirectory === ""
      ? "dist"
      : `dist/${relativeDirectory}`;
    const directory = path.join(packageRoot, ...directoryRelative.split("/"));
    const metadata = await lstat(directory);
    if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
      throw new Error("release_payload_directory_invalid");
    }
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) =>
      left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
    );
    for (const entry of entries) {
      const relativePath = relativeDirectory === ""
        ? entry.name
        : `${relativeDirectory}/${entry.name}`;
      if (relativeDirectory === "" &&
        (entry.name === "release-manifest.json" ||
          entry.name === "sbom.cdx.json" ||
          entry.name === "provenance.json")) {
        continue;
      }
      if (entry.isSymbolicLink()) throw new Error("release_payload_symlink");
      if (entry.isDirectory()) {
        await walk(relativePath);
        continue;
      }
      if (!entry.isFile() || inventory.length >= MAX_RELEASE_INVENTORY_FILES) {
        throw new Error("release_payload_inventory_invalid");
      }
      const bytes = await readContainedRegularFile(
        packageRoot,
        `dist/${relativePath}`,
        MAX_JSON_BYTES,
      );
      totalBytes += bytes.byteLength;
      if (totalBytes > MAX_RELEASE_INVENTORY_BYTES) {
        throw new Error("release_payload_inventory_too_large");
      }
      inventory.push({
        path: relativePath,
        sha256: digest(bytes),
        bytes: bytes.byteLength,
      });
    }
  }
  await walk("");
  inventory.sort((left, right) =>
    left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
  );
  return inventory;
}

export function validReleaseAttestationPayloads(
  sbom: unknown,
  provenance: unknown,
  inventory: readonly ReleasePayloadInventoryEntryV1[],
  packageVersion: string,
): boolean {
  if (!isRecord(sbom) || sbom.bomFormat !== "CycloneDX" ||
    sbom.specVersion !== "1.5" || !Array.isArray(sbom.components) ||
    sbom.components.length === 0 || !isRecord(sbom.metadata) ||
    !isRecord(sbom.metadata.component) ||
    sbom.metadata.component.name !== "@understand-code/preview" ||
    sbom.metadata.component.version !== packageVersion) {
    return false;
  }
  const fileComponents = new Map<string, Record<string, unknown>>();
  const componentIds = new Set<string>();
  for (const component of sbom.components) {
    if (!isRecord(component) ||
      (component.type !== "file" && component.type !== "library" && component.type !== "application") ||
      typeof component.name !== "string" || component.name.length === 0 ||
      typeof component.version !== "string" || component.version.length === 0 ||
      !Array.isArray(component.licenses) || component.licenses.length === 0 ||
      !Array.isArray(component.hashes) ||
      !component.hashes.some((hash) => isRecord(hash) && hash.alg === "SHA-256" &&
        typeof hash.content === "string" && /^[0-9a-f]{64}$/u.test(hash.content))) {
      return false;
    }
    const identity = `${component.type}:${component.name}@${component.version}`;
    if (componentIds.has(identity)) return false;
    componentIds.add(identity);
    if (component.type === "file") {
      if (!safeRelativePath(component.name) || fileComponents.has(component.name)) return false;
      fileComponents.set(component.name, component);
    }
  }
  if (fileComponents.size !== inventory.length) return false;
  for (const entry of inventory) {
    const component = fileComponents.get(entry.path);
    if (component === undefined || component.version !== packageVersion) return false;
    const hashes = component.hashes;
    if (!Array.isArray(hashes)) return false;
    const hash = hashes.find((candidate: unknown) =>
      isRecord(candidate) && candidate.alg === "SHA-256" && typeof candidate.content === "string",
    );
    const bytesProperty = Array.isArray(component.properties)
      ? component.properties.find((candidate) =>
        isRecord(candidate) && candidate.name === "understand-code:bytes",
      )
      : undefined;
    if (!isRecord(hash) || hash.content !== entry.sha256.slice("sha256:".length) ||
      !isRecord(bytesProperty) || bytesProperty.value !== String(entry.bytes)) return false;
  }
  if (!isRecord(provenance) ||
    provenance.schemaVersion !== "understand-code-alpha-provenance-v1" ||
    provenance.product !== "understand-code" ||
    !isRecord(provenance.package) ||
    provenance.package.name !== "@understand-code/preview" ||
    provenance.package.version !== packageVersion ||
    !isRecord(provenance.source) || provenance.source.vcs !== "git" ||
    !Array.isArray(provenance.subject) ||
    provenance.subject.length !== inventory.length) return false;
  const subjects = new Map<string, string>();
  for (const subject of provenance.subject) {
    if (!isRecord(subject) || typeof subject.name !== "string" ||
      !safeRelativePath(subject.name) || subjects.has(subject.name) ||
      !isRecord(subject.digest) || typeof subject.digest.sha256 !== "string" ||
      !/^[0-9a-f]{64}$/u.test(subject.digest.sha256)) return false;
    subjects.set(subject.name, subject.digest.sha256);
  }
  return inventory.every((entry) =>
    subjects.get(entry.path) === entry.sha256.slice("sha256:".length),
  );
}

function parseJson(bytes: Uint8Array): unknown {
  return JSON.parse(Buffer.from(bytes).toString("utf8")) as unknown;
}

function validDigestReference(
  value: unknown,
  expectedPath: string,
  expectedBin?: string,
): boolean {
  return (
    isRecord(value) &&
    value.path === expectedPath &&
    isDigest(value.sha256) &&
    (expectedBin === undefined || value.bin === expectedBin)
  );
}

const PLUGIN_PATHS = Object.freeze({
  codex: Object.freeze({
    marketplaceRoot: "dist/plugin-roots/codex",
    marketplace: "dist/plugin-roots/codex/.agents/plugins/marketplace.json",
    pluginRoot: "dist/plugin-roots/codex/plugins/understand-code",
    manifest:
      "dist/plugin-roots/codex/plugins/understand-code/.codex-plugin/plugin.json",
    mcp: "dist/plugin-roots/codex/plugins/understand-code/.mcp.json",
    entrypoint:
      "dist/plugin-roots/codex/plugins/understand-code/bin/understand-code-plugin.mjs",
    cli: "dist/plugin-roots/codex/plugins/understand-code/bin/understand-code.mjs",
    native:
      `dist/plugin-roots/codex/plugins/understand-code/bin/native/${process.platform}-${process.arch}/provider_kernel_peer.node`,
    dashboardRoot: "dist/plugin-roots/codex/plugins/understand-code/bin/dashboard",
    dashboardManifest:
      "dist/plugin-roots/codex/plugins/understand-code/bin/dashboard-manifest.json",
  }),
  claude: Object.freeze({
    marketplaceRoot: "dist/plugin-roots/claude",
    marketplace: "dist/plugin-roots/claude/.claude-plugin/marketplace.json",
    pluginRoot: "dist/plugin-roots/claude/plugins/understand-code",
    manifest:
      "dist/plugin-roots/claude/plugins/understand-code/.claude-plugin/plugin.json",
    mcp: "dist/plugin-roots/claude/plugins/understand-code/.mcp.json",
    entrypoint:
      "dist/plugin-roots/claude/plugins/understand-code/bin/understand-code-plugin.mjs",
    cli: "dist/plugin-roots/claude/plugins/understand-code/bin/understand-code.mjs",
    native:
      `dist/plugin-roots/claude/plugins/understand-code/bin/native/${process.platform}-${process.arch}/provider_kernel_peer.node`,
    dashboardRoot: "dist/plugin-roots/claude/plugins/understand-code/bin/dashboard",
    dashboardManifest:
      "dist/plugin-roots/claude/plugins/understand-code/bin/dashboard-manifest.json",
  }),
});

function validPluginReference(
  value: unknown,
  host: keyof typeof PLUGIN_PATHS,
): value is PluginReleaseReferenceV1 {
  if (!isRecord(value)) return false;
  const expected = PLUGIN_PATHS[host];
  return (
    value.marketplaceRoot === expected.marketplaceRoot &&
    value.marketplace === expected.marketplace &&
    isDigest(value.marketplaceSha256) &&
    value.pluginRoot === expected.pluginRoot &&
    value.manifest === expected.manifest &&
    isDigest(value.manifestSha256) &&
    value.mcp === expected.mcp &&
    isDigest(value.mcpSha256) &&
    value.entrypoint === expected.entrypoint &&
    isDigest(value.entrypointSha256) &&
    value.cli === expected.cli &&
    isDigest(value.cliSha256) &&
    value.native === expected.native &&
    isDigest(value.nativeSha256) &&
    value.dashboardRoot === expected.dashboardRoot &&
    value.dashboardManifest === expected.dashboardManifest &&
    isDigest(value.dashboardManifestSha256) &&
    Number.isSafeInteger(value.dashboardFileCount) &&
    typeof value.dashboardFileCount === "number" &&
    value.dashboardFileCount > 0 &&
    value.dashboardFileCount <= 4_096 &&
    isDigest(value.dashboardInventorySha256) &&
    isDigest(value.payloadSha256)
  );
}

function validHostAdapterReference(
  value: unknown,
  host: "codex" | "claude",
): value is HostAdapterReleaseReferenceV1 {
  if (!isRecord(value)) return false;
  const expected =
    host === "codex"
      ? {
          bin: "understand-code-codex",
          manifest: "dist/host-adapters/codex/manifest.json",
          configs: [
            "dist/host-adapters/codex/mcp.json",
            "dist/host-adapters/codex/config.toml",
          ],
        }
      : {
          bin: "understand-code-claude",
          manifest: "dist/host-adapters/claude/manifest.json",
          configs: ["dist/host-adapters/claude/.mcp.json"],
        };
  return (
    value.bin === expected.bin &&
    value.entrypoint === "dist/host-bin.mjs" &&
    isDigest(value.entrypointSha256) &&
    value.manifest === expected.manifest &&
    equalJson(value.configs, expected.configs)
  );
}

function parseReleaseManifest(value: unknown): ReleaseManifestV1 | undefined {
  if (!isRecord(value)) return undefined;
  const package_ = value.package;
  const native = value.native;
  const runtime = value.runtime;
  const dashboard = value.dashboard;
  const hostAdapters = value.hostAdapters;
  const pluginRoots = value.pluginRoots;
  const sbom = value.sbom;
  const provenance = value.provenance;
  const expectedTuple = `${process.platform}-${process.arch}`;
  const expectedNativePath =
    `dist/native/${expectedTuple}/provider_kernel_peer.node`;
  if (
    value.schemaVersion !== "understand-code-alpha-release-v1" ||
    value.product !== "understand-code" ||
    !isRecord(package_) ||
    package_.name !== "@understand-code/preview" ||
    package_.version !== PRODUCT_VERSION ||
    !validDigestReference(value.cli, "dist/understand-code.mjs", "understand-code") ||
    !validDigestReference(value.preview, "dist/bin.mjs", "understand-code-preview") ||
    !isRecord(native) ||
    native.tuple !== expectedTuple ||
    !validDigestReference(native, expectedNativePath) ||
    !isRecord(runtime) ||
    runtime.productVersion !== PRODUCT_VERSION ||
    !validDigestReference(runtime.server, "dist/server.mjs") ||
    !validDigestReference(runtime.contracts, "dist/contracts.mjs") ||
    !isRecord(dashboard) ||
    dashboard.productVersion !== PRODUCT_VERSION ||
    dashboard.root !== "dist/dashboard" ||
    dashboard.manifest !== "dist/dashboard-manifest.json" ||
    !isDigest(dashboard.manifestSha256) ||
    !Number.isSafeInteger(dashboard.fileCount) ||
    typeof dashboard.fileCount !== "number" ||
    dashboard.fileCount <= 0 ||
    dashboard.fileCount > 4_096 ||
    !isDigest(dashboard.inventorySha256) ||
    !isRecord(hostAdapters) ||
    !validHostAdapterReference(hostAdapters.codex, "codex") ||
    !validHostAdapterReference(hostAdapters.claude, "claude") ||
    !isRecord(pluginRoots) ||
    !validPluginReference(pluginRoots.codex, "codex") ||
    !validPluginReference(pluginRoots.claude, "claude") ||
    !isRecord(sbom) ||
    sbom.format !== "CycloneDX-1.5" ||
    sbom.path !== "dist/sbom.cdx.json" ||
    !isDigest(sbom.sha256) ||
    !isRecord(provenance) ||
    provenance.format !== "slsa-provenance-v1" ||
    provenance.path !== "dist/provenance.json" ||
    !isDigest(provenance.sha256)
  ) {
    return undefined;
  }
  return value as unknown as ReleaseManifestV1;
}

function inspectNodeRuntime(): ReleaseDoctorCheckV1 {
  const match = /^v(?<major>[0-9]+)(?:\.[0-9]+){2}$/u.exec(process.version);
  const major = Number.parseInt(match?.groups?.major ?? "", 10);
  if (!Number.isSafeInteger(major) || major < 22) {
    return fail(
      "node_runtime",
      "node_runtime_unsupported",
      "The active Node.js runtime does not satisfy the Alpha package contract.",
      "Install Node.js 22 or newer, then reinstall and rerun Doctor.",
      { observed: process.version, required: ">=22" },
    );
  }
  return pass("node_runtime", "Node.js satisfies the Alpha runtime contract.", {
    observed: process.version,
    required: ">=22",
  });
}

function inspectGit(): ReleaseDoctorCheckV1 {
  try {
    const output = runGit(["--version"]);
    if (!/^git version [\x20-\x7e]{1,96}$/u.test(output)) {
      throw new Error("git_version_invalid");
    }
    return pass("git", "Git is available to the bundled runtime.", {
      observed: output,
      required: "available on PATH",
    });
  } catch {
    return fail(
      "git",
      "git_unavailable",
      "Git is unavailable or did not return a valid version.",
      "Install Git and make it available on PATH, then rerun Doctor.",
      { required: "available on PATH" },
    );
  }
}

async function inspectRepositoryRoot(
  candidate: string,
): Promise<Readonly<{ check: ReleaseDoctorCheckV1; canonicalRoot?: string }>> {
  try {
    const canonicalInput = await canonicalDirectory(candidate);
    const topLevel = runGit([
      "-C",
      canonicalInput,
      "rev-parse",
      "--show-toplevel",
    ]);
    if (
      topLevel.length === 0 ||
      !path.isAbsolute(topLevel) ||
      /[\u0000\r\n]/u.test(topLevel)
    ) {
      throw new Error("repository_root_invalid");
    }
    const canonicalTopLevel = await canonicalDirectory(topLevel);
    const relative = path.relative(canonicalTopLevel, canonicalInput);
    if (
      relative === ".." ||
      relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative)
    ) {
      throw new Error("repository_root_outside_worktree");
    }
    return {
      check: pass(
        "repository_root",
        "The current directory resolves to a canonical Git worktree root.",
        { observed: "canonical_git_worktree" },
      ),
      canonicalRoot: canonicalTopLevel,
    };
  } catch {
    return {
      check: fail(
        "repository_root",
        "repository_root_unavailable",
        "The current directory does not resolve to a canonical Git worktree root.",
        "Change to a directory inside the intended Git worktree and rerun Doctor.",
      ),
    };
  }
}

async function inspectArtifactSchemas(
  canonicalRoot: string | undefined,
): Promise<ReleaseDoctorCheckV1> {
  if (canonicalRoot === undefined) {
    return fail(
      "artifact_schema",
      "artifact_root_unavailable",
      "Published Artifact schemas could not be checked without a valid repository root.",
      "Run refresh_index in a valid worktree, then rerun Doctor from its canonical top-level.",
    );
  }
  try {
    const artifactRoot = path.join(canonicalRoot, ".understand-code");
    const metadata = await lstat(artifactRoot);
    if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
      throw new Error("artifact_root_invalid");
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return fail(
        "artifact_schema",
        "artifact_not_initialized",
        "Understand Code Artifacts have not been initialized in this worktree.",
        "Run refresh_index in this worktree, then rerun Doctor.",
      );
    }
    return fail(
      "artifact_schema",
      "artifact_schema_incompatible",
      "The published Artifact root is unsafe or unreadable.",
      "Preserve the Artifact root for recovery review, repair its ownership/type, then rerun Doctor.",
    );
  }
  try {
    const activeIndex = await openActiveRepositoryIndexV1(canonicalRoot);
    const [graphBytes, wikiBytes, searchBytes, pulseBytes] = await Promise.all([
      activeIndex.read("knowledge-graph.json"),
      activeIndex.read("knowledge-base/wiki-index.json"),
      activeIndex.read("knowledge-base/search-index.json"),
      readContainedRegularFile(
        canonicalRoot,
        ".understand-code/repo-pulse.json",
        MAX_JSON_BYTES,
      ),
    ]);
    const graph = validateGraph(parseJson(graphBytes));
    const wiki = parseWikiIndexV2(parseJson(wikiBytes));
    const search = parseWikiSearchIndexV2(parseJson(searchBytes));
    const pulse = RepoPulseArtifactV1Schema.safeParse(parseJson(pulseBytes));
    if (
      !graph.success ||
      graph.data === undefined ||
      graph.issues.length > 0 ||
      !wiki.ok ||
      !search.ok ||
      !pulse.success ||
      activeIndex.authority.sourceSnapshotId !==
        pulse.data.payload.evaluatedSnapshotId
    ) {
      throw new Error("artifact_schema_invalid");
    }
    return pass(
      "artifact_schema",
      "Published Graph, Wiki, Search, and Repo Pulse artifacts satisfy their bundled schemas.",
      { observed: "graph_v1+wiki_v2+search_v2+repo_pulse_v1" },
    );
  } catch {
    return fail(
      "artifact_schema",
      "artifact_schema_incompatible",
      "One or more required published Artifacts are missing, unsafe, or schema-incompatible.",
      "Run refresh_index in this worktree and rerun Doctor; preserve corrupt artifacts for recovery review.",
    );
  }
}

async function probeLoopbackPort(): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.unref();
    let settled = false;
    const timeout = setTimeout(() => finish(false), 3_000);
    timeout.unref();
    const finish = (healthy: boolean): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (server.listening) server.close(() => resolve(healthy));
      else resolve(healthy);
    };
    server.once("error", () => finish(false));
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      finish(
        address !== null &&
          typeof address === "object" &&
          address.address === "127.0.0.1" &&
          address.port > 0,
      );
    });
  });
}

async function inspectLoopbackPort(): Promise<ReleaseDoctorCheckV1> {
  if (await probeLoopbackPort()) {
    return pass(
      "loopback_port",
      "A loopback-only ephemeral port can be opened and released.",
      { observed: "127.0.0.1:ephemeral" },
    );
  }
  return fail(
    "loopback_port",
    "loopback_port_unavailable",
    "A loopback-only ephemeral port could not be opened and released.",
    "Allow this user to bind 127.0.0.1 loopback ports, then rerun Doctor.",
  );
}

async function inspectPackageMetadata(
  packageRoot: string | undefined,
): Promise<Readonly<{ check: ReleaseDoctorCheckV1; metadata?: PackageMetadataV1 }>> {
  if (packageRoot !== undefined) {
    try {
      const value = parseJson(
        await readContainedRegularFile(packageRoot, "package.json", MAX_METADATA_BYTES),
      );
      const engines = isRecord(value) ? value.engines : undefined;
      const expectedBins = {
        "understand-code-preview": "dist/bin.mjs",
        "understand-code": "dist/understand-code.mjs",
        "understand-code-codex": "dist/host-bin.mjs",
        "understand-code-claude": "dist/host-bin.mjs",
      };
      if (
        !isRecord(value) ||
        value.name !== "@understand-code/preview" ||
        value.version !== PRODUCT_VERSION ||
        value.type !== "module" ||
        !isRecord(engines) ||
        engines.node !== ">=22" ||
        !equalJson(value.bin, expectedBins)
      ) {
        throw new Error("package_metadata_invalid");
      }
      return {
        check: pass(
          "package_metadata",
          "The installed Preview package identity, version, engines, and bins are coherent.",
          { observed: PRODUCT_VERSION },
        ),
        metadata: {
          name: "@understand-code/preview",
          version: PRODUCT_VERSION,
        },
      };
    } catch {
      // The public result deliberately omits filesystem and parser details.
    }
  }
  return {
    check: fail(
      "package_metadata",
      "package_metadata_invalid",
      "The installed Preview package metadata is missing, unsafe, or inconsistent.",
      "Reinstall @understand-code/preview from the original verified tgz.",
    ),
  };
}

async function inspectReleaseManifest(
  packageRoot: string | undefined,
): Promise<Readonly<{ check: ReleaseDoctorCheckV1; manifest?: ReleaseManifestV1 }>> {
  if (packageRoot !== undefined) {
    try {
      const manifest = parseReleaseManifest(
        parseJson(
          await readContainedRegularFile(
            packageRoot,
            "dist/release-manifest.json",
            MAX_METADATA_BYTES,
          ),
        ),
      );
      if (manifest === undefined) throw new Error("release_manifest_invalid");
      return {
        check: pass(
          "release_manifest",
          "The Alpha release manifest is present and version-coherent.",
          { observed: manifest.package.version },
        ),
        manifest,
      };
    } catch {
      // The public result deliberately omits filesystem and parser details.
    }
  }
  return {
    check: fail(
      "release_manifest",
      "release_manifest_invalid",
      "The Alpha release manifest is missing, unsafe, or inconsistent.",
      "Reinstall @understand-code/preview from the original verified tgz.",
    ),
  };
}

function validHostManifest(
  value: unknown,
  host: "codex" | "claude",
  release: ReleaseManifestV1,
): boolean {
  if (!isRecord(value)) return false;
  const cli = value.cli;
  const expectedPlaceholder =
    host === "codex" ? "${WORKSPACE_ROOT}" : "${CLAUDE_PROJECT_DIR}";
  return (
    value.schemaVersion === "understand-code-host-adapter-release-v1" &&
    value.product === "understand-code" &&
    value.productVersion === PRODUCT_VERSION &&
    value.host === host &&
    value.name === "understand-code" &&
    value.transport === "stdio" &&
    value.bin === release.hostAdapters[host].bin &&
    value.entrypoint === "dist/host-bin.mjs" &&
    value.entrypointSha256 === release.hostAdapters[host].entrypointSha256 &&
    isRecord(cli) &&
    cli.bin === "understand-code" &&
    cli.path === "dist/understand-code.mjs" &&
    cli.sha256 === release.cli.sha256 &&
    equalJson(value.args, ["--root", expectedPlaceholder]) &&
    isRecord(value.root) &&
    value.root.required === true &&
    value.root.flag === "--root" &&
    value.root.placeholder === expectedPlaceholder &&
    value.root.absolute === true
  );
}

function validIntegrationConfig(
  value: unknown,
  host: "codex" | "claude",
): boolean {
  if (!isRecord(value) || !isRecord(value.mcpServers)) return false;
  const server = value.mcpServers["understand-code"];
  const expectedCommand =
    host === "codex" ? "understand-code-codex" : "understand-code-claude";
  const expectedRoot =
    host === "codex" ? "${WORKSPACE_ROOT}" : "${CLAUDE_PROJECT_DIR}";
  return (
    isRecord(server) &&
    server.command === expectedCommand &&
    equalJson(server.args, ["--root", expectedRoot])
  );
}

async function inspectBundleIntegrity(
  packageRoot: string | undefined,
  release: ReleaseManifestV1 | undefined,
): Promise<ReleaseDoctorCheckV1> {
  if (packageRoot !== undefined && release !== undefined) {
    try {
      const [
        cliBytes,
        previewBytes,
        hostBytes,
        codexManifestBytes,
        claudeManifestBytes,
        codexMcpBytes,
        codexTomlBytes,
        claudeMcpBytes,
        serverBytes,
        contractsBytes,
        sbomBytes,
        provenanceBytes,
        releasePayloadInventory,
        dashboardInventory,
        dashboardManifestBytes,
      ] = await Promise.all([
        readContainedRegularFile(packageRoot, release.cli.path, MAX_JSON_BYTES),
        readContainedRegularFile(packageRoot, release.preview.path, MAX_JSON_BYTES),
        readContainedRegularFile(
          packageRoot,
          release.hostAdapters.codex.entrypoint,
          MAX_JSON_BYTES,
        ),
        readContainedRegularFile(
          packageRoot,
          release.hostAdapters.codex.manifest,
          MAX_METADATA_BYTES,
        ),
        readContainedRegularFile(
          packageRoot,
          release.hostAdapters.claude.manifest,
          MAX_METADATA_BYTES,
        ),
        readContainedRegularFile(
          packageRoot,
          "dist/host-adapters/codex/mcp.json",
          MAX_METADATA_BYTES,
        ),
        readContainedRegularFile(
          packageRoot,
          "dist/host-adapters/codex/config.toml",
          MAX_METADATA_BYTES,
        ),
        readContainedRegularFile(
          packageRoot,
          "dist/host-adapters/claude/.mcp.json",
          MAX_METADATA_BYTES,
        ),
        readContainedRegularFile(
          packageRoot,
          release.runtime.server.path,
          MAX_JSON_BYTES,
        ),
        readContainedRegularFile(
          packageRoot,
          release.runtime.contracts.path,
          MAX_JSON_BYTES,
        ),
        readContainedRegularFile(packageRoot, release.sbom.path, MAX_METADATA_BYTES),
        readContainedRegularFile(packageRoot, release.provenance.path, MAX_METADATA_BYTES),
        buildReleasePayloadInventory(packageRoot),
        buildDashboardInventory(packageRoot),
        readContainedRegularFile(
          packageRoot,
          release.dashboard.manifest,
          MAX_METADATA_BYTES,
        ),
      ]);
      const codexToml = codexTomlBytes.toString("utf8").trim();
      if (
        digest(cliBytes) !== release.cli.sha256 ||
        digest(previewBytes) !== release.preview.sha256 ||
        digest(hostBytes) !== release.hostAdapters.codex.entrypointSha256 ||
        release.hostAdapters.codex.entrypointSha256 !==
          release.hostAdapters.claude.entrypointSha256 ||
        !validHostManifest(parseJson(codexManifestBytes), "codex", release) ||
        !validHostManifest(parseJson(claudeManifestBytes), "claude", release) ||
        !validIntegrationConfig(parseJson(codexMcpBytes), "codex") ||
        !validIntegrationConfig(parseJson(claudeMcpBytes), "claude") ||
        digest(serverBytes) !== release.runtime.server.sha256 ||
        digest(contractsBytes) !== release.runtime.contracts.sha256 ||
        digest(sbomBytes) !== release.sbom.sha256 ||
        digest(provenanceBytes) !== release.provenance.sha256 ||
        !validReleaseAttestationPayloads(
          parseJson(sbomBytes),
          parseJson(provenanceBytes),
          releasePayloadInventory,
          release.package.version,
        ) ||
        release.runtime.productVersion !== PRODUCT_VERSION ||
        release.dashboard.productVersion !== PRODUCT_VERSION ||
        dashboardInventory.length !== release.dashboard.fileCount ||
        digest(Buffer.from(JSON.stringify(dashboardInventory), "utf8")) !==
          release.dashboard.inventorySha256 ||
        digest(dashboardManifestBytes) !== release.dashboard.manifestSha256 ||
        !validDashboardBundleManifest(
          parseJson(dashboardManifestBytes),
          release.dashboard.fileCount,
          release.dashboard.inventorySha256,
        ) ||
        codexToml !==
          '[mcp_servers.understand-code]\ncommand = "understand-code-codex"\nargs = ["--root", "${WORKSPACE_ROOT}"]'
      ) {
        throw new Error("bundle_integrity_invalid");
      }
      return pass(
        "bundle_integrity",
        "CLI, Server, Dashboard, Preview, and Host adapter bundles match one release version.",
        { observed: PRODUCT_VERSION },
      );
    } catch {
      // The public result deliberately omits paths and expected/actual digests.
    }
  }
  return fail(
    "bundle_integrity",
    "bundle_integrity_invalid",
    "A bundled executable or Host adapter is missing, unsafe, modified, or version-inconsistent.",
    "Reinstall @understand-code/preview from the original verified tgz.",
  );
}

function nativeBinaryMatchesTuple(bytes: Uint8Array): boolean {
  if (
    bytes.byteLength < 64 ||
    bytes.byteLength > MAX_NATIVE_BYTES ||
    (process.arch !== "arm64" && process.arch !== "x64")
  ) {
    return false;
  }
  const view = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (process.platform === "darwin") {
    const expectedCpu = process.arch === "arm64" ? 0x0100000c : 0x01000007;
    return (
      view.subarray(0, 4).equals(Buffer.from([0xcf, 0xfa, 0xed, 0xfe])) &&
      view.readUInt32LE(4) === expectedCpu
    );
  }
  if (process.platform === "linux") {
    const expectedMachine = process.arch === "arm64" ? 183 : 62;
    return (
      view.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46])) &&
      view[4] === 2 &&
      view[5] === 1 &&
      view.readUInt16LE(18) === expectedMachine
    );
  }
  return false;
}

async function inspectNativeTuple(
  packageRoot: string | undefined,
  release: ReleaseManifestV1 | undefined,
): Promise<ReleaseDoctorCheckV1> {
  const tuple = `${process.platform}-${process.arch}`;
  if (packageRoot !== undefined && release !== undefined) {
    try {
      const nativeRoot = path.join(packageRoot, "dist/native");
      const tupleRoot = path.join(nativeRoot, tuple);
      const [nativeEntries, tupleEntries, bytes] = await Promise.all([
        readdir(nativeRoot),
        readdir(tupleRoot),
        readContainedRegularFile(packageRoot, release.native.path, MAX_NATIVE_BYTES),
      ]);
      if (
        !equalJson(nativeEntries.sort(), [tuple]) ||
        !equalJson(tupleEntries.sort(), ["provider_kernel_peer.node"]) ||
        release.native.tuple !== tuple ||
        digest(bytes) !== release.native.sha256 ||
        !nativeBinaryMatchesTuple(bytes)
      ) {
        throw new Error("native_tuple_invalid");
      }
      return pass(
        "native_tuple",
        "The package contains exactly one matching native provider peer tuple.",
        { observed: tuple },
      );
    } catch {
      // The public result deliberately omits paths and binary details.
    }
  }
  return fail(
    "native_tuple",
    "native_tuple_invalid",
    "The native provider peer is missing, unsafe, modified, or built for another tuple.",
    "Install the Preview tgz built for this operating system and architecture.",
    { observed: tuple, required: tuple },
  );
}

function validPluginDocuments(
  host: "codex" | "claude",
  manifestValue: unknown,
  marketplaceValue: unknown,
  mcpValue: unknown,
): boolean {
  if (
    !isRecord(manifestValue) ||
    manifestValue.name !== "understand-code" ||
    manifestValue.version !== PRODUCT_VERSION ||
    !isRecord(marketplaceValue) ||
    marketplaceValue.name !== "understand-code-alpha" ||
    !Array.isArray(marketplaceValue.plugins) ||
    marketplaceValue.plugins.length !== 1 ||
    !isRecord(marketplaceValue.plugins[0]) ||
    marketplaceValue.plugins[0].name !== "understand-code" ||
    !isRecord(mcpValue) ||
    Object.keys(mcpValue).length !== 1 ||
    !isRecord(mcpValue["understand-code"])
  ) {
    return false;
  }
  const plugin = marketplaceValue.plugins[0];
  const server = mcpValue["understand-code"];
  if (host === "codex") {
    return (
      equalJson(plugin.source, {
        source: "local",
        path: "./plugins/understand-code",
      }) &&
      server.command === "./bin/understand-code-plugin.mjs" &&
      equalJson(server.args, ["--host", "codex"])
    );
  }
  return (
    plugin.source === "./plugins/understand-code" &&
    plugin.version === PRODUCT_VERSION &&
    server.command === "${CLAUDE_PLUGIN_ROOT}/bin/understand-code-plugin.mjs" &&
    equalJson(server.args, ["--host", "claude"])
  );
}

async function inspectPluginPayload(
  host: "codex" | "claude",
  packageRoot: string | undefined,
  release: ReleaseManifestV1 | undefined,
): Promise<ReleaseDoctorCheckV1> {
  const id = `${host}_plugin_payload` as const;
  if (packageRoot !== undefined && release !== undefined) {
    try {
      const reference = release.pluginRoots[host];
      const [marketplace, manifest, mcp, entrypoint, cli, native, dashboardManifest,
        dashboardInventory] = await Promise.all([
        readContainedRegularFile(
          packageRoot,
          reference.marketplace,
          MAX_METADATA_BYTES,
        ),
        readContainedRegularFile(packageRoot, reference.manifest, MAX_METADATA_BYTES),
        readContainedRegularFile(packageRoot, reference.mcp, MAX_METADATA_BYTES),
        readContainedRegularFile(packageRoot, reference.entrypoint, MAX_JSON_BYTES),
        readContainedRegularFile(packageRoot, reference.cli, MAX_JSON_BYTES),
        readContainedRegularFile(packageRoot, reference.native, MAX_NATIVE_BYTES),
        readContainedRegularFile(
          packageRoot,
          reference.dashboardManifest,
          MAX_METADATA_BYTES,
        ),
        buildDashboardInventory(packageRoot, reference.dashboardRoot),
      ]);
      const payloadFiles = {
        manifestSha256: digest(manifest),
        mcpSha256: digest(mcp),
        entrypointSha256: digest(entrypoint),
        cliSha256: digest(cli),
        nativeSha256: digest(native),
        dashboardManifestSha256: digest(dashboardManifest),
        dashboardInventorySha256: digest(
          Buffer.from(JSON.stringify(dashboardInventory), "utf8"),
        ),
      };
      if (
        digest(marketplace) !== reference.marketplaceSha256 ||
        payloadFiles.manifestSha256 !== reference.manifestSha256 ||
        payloadFiles.mcpSha256 !== reference.mcpSha256 ||
        payloadFiles.entrypointSha256 !== reference.entrypointSha256 ||
        payloadFiles.cliSha256 !== reference.cliSha256 ||
        payloadFiles.cliSha256 !== release.cli.sha256 ||
        payloadFiles.nativeSha256 !== reference.nativeSha256 ||
        payloadFiles.nativeSha256 !== release.native.sha256 ||
        !nativeBinaryMatchesTuple(native) ||
        payloadFiles.dashboardManifestSha256 !== reference.dashboardManifestSha256 ||
        dashboardInventory.length !== reference.dashboardFileCount ||
        payloadFiles.dashboardInventorySha256 !== reference.dashboardInventorySha256 ||
        reference.dashboardFileCount !== release.dashboard.fileCount ||
        reference.dashboardInventorySha256 !== release.dashboard.inventorySha256 ||
        !validDashboardBundleManifest(
          parseJson(dashboardManifest),
          reference.dashboardFileCount,
          reference.dashboardInventorySha256,
        ) ||
        digest(Buffer.from(JSON.stringify(payloadFiles), "utf8")) !==
          reference.payloadSha256 ||
        !validPluginDocuments(
          host,
          parseJson(manifest),
          parseJson(marketplace),
          parseJson(mcp),
        )
      ) {
        throw new Error("plugin_payload_invalid");
      }
      return pass(
        id,
        `The bundled ${host === "codex" ? "Codex" : "Claude Code"} Plugin payload is self-contained and version-coherent.`,
        { observed: PRODUCT_VERSION },
      );
    } catch {
      // The public result deliberately omits paths and expected/actual digests.
    }
  }
  return fail(
    id,
    `${host}_plugin_payload_invalid`,
    `The bundled ${host === "codex" ? "Codex" : "Claude Code"} Plugin payload is missing, unsafe, modified, or version-inconsistent.`,
    "Reinstall @understand-code/preview from the original verified tgz before installing this Plugin.",
  );
}

async function resolvePackageRoot(
  explicit: string | undefined,
): Promise<string | undefined> {
  const candidate =
    explicit ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  try {
    return await canonicalDirectory(candidate);
  } catch {
    return undefined;
  }
}

/** Run the installed-package and current-worktree Release Doctor without writes. */
export async function runReleaseDoctorV1(
  options: ReleaseDoctorOptionsV1 = {},
): Promise<ReleaseDoctorResultV1> {
  const packageRoot = await resolvePackageRoot(options.packageRoot);
  const repository = await inspectRepositoryRoot(
    options.repositoryRoot ?? process.cwd(),
  );
  const packageMetadata = await inspectPackageMetadata(packageRoot);
  const releaseManifest = await inspectReleaseManifest(packageRoot);
  const checks: ReleaseDoctorCheckV1[] = [
    inspectNodeRuntime(),
    inspectGit(),
    repository.check,
    await inspectArtifactSchemas(repository.canonicalRoot),
    await inspectLoopbackPort(),
    packageMetadata.check,
    releaseManifest.check,
    await inspectBundleIntegrity(packageRoot, releaseManifest.manifest),
    await inspectNativeTuple(packageRoot, releaseManifest.manifest),
    await inspectPluginPayload("codex", packageRoot, releaseManifest.manifest),
    await inspectPluginPayload("claude", packageRoot, releaseManifest.manifest),
    locked(
      "release_authenticity",
      "release_attestation_unavailable",
      "Alpha hashes provide integrity inventory, not publisher authenticity.",
      "Verify the tgz SHA-256 out of band; signing, SBOM, and provenance remain a release milestone.",
    ),
    locked(
      "provider_strong_writes",
      "provider_strong_writes_locked",
      "Provider-backed strong writes remain locked in this Alpha.",
      "Use the read/check/externally-reported Verification path until Provider Authority and its execution fence pass their release gates.",
    ),
  ];
  const ok = checks.every((check) => check.status !== "fail");
  return Object.freeze({
    schemaVersion: RELEASE_DOCTOR_SCHEMA_VERSION,
    product: "understand-code",
    version: PRODUCT_VERSION,
    readiness: "alpha",
    releaseReady: false,
    strongWrites: "locked",
    hostRegistration: "not_checked",
    ok,
    status: ok ? "healthy" : "unhealthy",
    checks: Object.freeze(checks),
  });
}
