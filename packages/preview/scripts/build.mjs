import { chmod, cp, lstat, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const exec = promisify(execFile);
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.resolve(packageRoot, "../..");
const dashboardRoot = path.resolve(packageRoot, "../dashboard");
const distRoot = path.join(packageRoot, "dist");
const hostAdapterIntegrationsRoot = path.join(
  workspaceRoot,
  "packages/host-adapters/integrations",
);
const pluginRootsSourceRoot = path.join(
  workspaceRoot,
  "packages/host-adapters/plugin-roots",
);
const packageMetadata = JSON.parse(
  await readFile(path.join(packageRoot, "package.json"), "utf8"),
);
const SEMVER_PATTERN =
  /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;
if (
  packageMetadata.name !== "@understand-code/preview" ||
  typeof packageMetadata.version !== "string" ||
  !SEMVER_PATTERN.test(packageMetadata.version)
) {
  throw new Error("Preview package identity is invalid");
}
const PRODUCT_VERSION = packageMetadata.version;

const SCRIPT_ELEMENT_PATTERN = /<script\b(?<attributes>[^>]*)>(?<body>[\s\S]*?)<\/script>/giu;
const SCRIPT_SOURCE_ATTRIBUTE_PATTERN = /(?:^|\s)src\s*=\s*(["'])(?<source>[^"']+)\1/giu;
const EXPECTED_FIRST_PAINT_THEME_BOOTSTRAP_SHA256 = "bb1806d60772d743f0dc88538ee45b10fe829a951db7a24b7131c1acdceb4e0d";
const DASHBOARD_BUNDLE_SCHEMA_VERSION = "understand-code-dashboard-bundle-v1";

function scriptSourceAttributes(attributes) {
  return [...attributes.matchAll(SCRIPT_SOURCE_ATTRIBUTE_PATTERN)].map((match) => match.groups?.source);
}

function externalizeFirstPaintThemeBootstrap(index) {
  const scripts = [...index.matchAll(SCRIPT_ELEMENT_PATTERN)];
  const openingScriptCount = index.match(/<script\b/giu)?.length ?? 0;
  const closingScriptCount = index.match(/<\/script>/giu)?.length ?? 0;
  if (scripts.length !== openingScriptCount || scripts.length !== closingScriptCount) {
    throw new Error("Preview dashboard contains a malformed script element");
  }
  const inlineScripts = scripts.filter((match) => scriptSourceAttributes(match.groups?.attributes ?? "").length === 0);
  if (inlineScripts.length !== 1) {
    throw new Error(`Preview dashboard must contain exactly one inline first-paint bootstrap; found ${inlineScripts.length}`);
  }
  const [inline] = inlineScripts;
  const attributes = inline.groups?.attributes.trim() ?? "";
  const body = inline.groups?.body ?? "";
  if (attributes !== "" || !body.includes('localStorage.getItem("uc-theme")') || !body.includes("dataset.themePreset")) {
    throw new Error("Preview dashboard inline script is not the expected first-paint theme bootstrap");
  }
  const source = `${body.trim()}\n`;
  const digest = createHash("sha256").update(source).digest("hex");
  if (digest !== EXPECTED_FIRST_PAINT_THEME_BOOTSTRAP_SHA256) {
    throw new Error("Preview dashboard first-paint theme bootstrap differs from its reviewed source contract");
  }
  const fileName = `theme-bootstrap-${digest}.js`;
  const replacement = `<script src="/assets/${fileName}"></script>`;
  const start = inline.index;
  if (start === undefined) throw new Error("Preview dashboard bootstrap has no source position");
  return {
    index: `${index.slice(0, start)}${replacement}${index.slice(start + inline[0].length)}`,
    fileName,
    source,
  };
}

function assertExternalScriptOnly(index, expectedBootstrapFileName) {
  if (/\son[a-z]+\s*=/iu.test(index) || /\b(?:href|src)\s*=\s*(["'])javascript:/iu.test(index)) {
    throw new Error("Preview dashboard contains an inline event handler or JavaScript URL");
  }
  const scripts = [...index.matchAll(SCRIPT_ELEMENT_PATTERN)];
  const openingScriptCount = index.match(/<script\b/giu)?.length ?? 0;
  const closingScriptCount = index.match(/<\/script>/giu)?.length ?? 0;
  if (scripts.length === 0 || scripts.length !== openingScriptCount || scripts.length !== closingScriptCount) {
    throw new Error("Preview dashboard script elements failed post-build validation");
  }
  const sources = scripts.map((match) => {
    if ((match.groups?.body ?? "").trim() !== "") {
      throw new Error("Preview dashboard contains inline script after bootstrap extraction");
    }
    const attributes = match.groups?.attributes ?? "";
    const sourceMatches = scriptSourceAttributes(attributes);
    if (/\bon[a-z]+\s*=/iu.test(attributes)
      || sourceMatches.length !== 1
      || !/^\/assets\/[A-Za-z0-9_.-]+\.js$/u.test(sourceMatches[0] ?? "")) {
      throw new Error("Preview dashboard scripts must use same-origin /assets sources");
    }
    return sourceMatches[0];
  });
  const expectedSource = `/assets/${expectedBootstrapFileName}`;
  if (sources.filter((source) => source === expectedSource).length !== 1) {
    throw new Error("Preview dashboard does not reference exactly one extracted theme bootstrap");
  }
}

async function run(command, args, cwd = workspaceRoot) {
  await exec(command, args, { cwd, env: { ...process.env, CI: "true" }, maxBuffer: 32 * 1024 * 1024 });
}

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function npmPurl(name, version) {
  const scoped = name.startsWith("@") ? name.slice(1).split("/") : [name];
  return `pkg:npm/${scoped.map((part) => encodeURIComponent(part)).join("/")}@${encodeURIComponent(version)}`;
}

async function buildDirectoryInventory(root, excludedRootFiles = new Set()) {
  const inventory = [];
  async function walk(current, relativeDirectory) {
    const metadata = await lstat(current);
    if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
      throw new Error("release inventory root must be a real directory");
    }
    const entries = await readdir(current, { withFileTypes: true });
    entries.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
    for (const entry of entries) {
      if (entry.isSymbolicLink()) {
        throw new Error("release inventory must not contain symbolic links");
      }
      const relativePath = relativeDirectory === ""
        ? entry.name
        : `${relativeDirectory}/${entry.name}`;
      if (relativeDirectory === "" && excludedRootFiles.has(entry.name)) {
        continue;
      }
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath, relativePath);
        continue;
      }
      if (!entry.isFile()) {
        throw new Error("release inventory must contain only directories and regular files");
      }
      const bytes = await readFile(absolutePath);
      inventory.push({ path: relativePath, sha256: sha256(bytes), bytes: bytes.byteLength });
    }
  }
  await walk(root, "");
  inventory.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  return inventory;
}

async function buildPackageComponents() {
  const seen = new Set();
  const components = [];
  const queue = [path.join(workspaceRoot, "package.json")];
  for (const name of await readdir(path.join(workspaceRoot, "packages"))) {
    queue.push(path.join(workspaceRoot, "packages", name, "package.json"));
  }
  while (queue.length > 0) {
    const manifestPath = queue.shift();
    let bytes;
    try { bytes = await readFile(manifestPath); } catch { continue; }
    let manifest;
    try { manifest = JSON.parse(bytes.toString("utf8")); } catch { continue; }
    if (!manifest || typeof manifest.name !== "string" || typeof manifest.version !== "string") continue;
    const key = `${manifest.name}@${manifest.version}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const license = typeof manifest.license === "string"
      ? { expression: manifest.license }
      : { expression: "NOASSERTION" };
    components.push({
      type: "library",
      name: manifest.name,
      version: manifest.version,
      purl: npmPurl(manifest.name, manifest.version),
      licenses: [{ license }],
      hashes: [{ alg: "SHA-256", content: createHash("sha256").update(bytes).digest("hex") }],
    });
    for (const dependencyName of Object.keys({ ...(manifest.dependencies ?? {}) })) {
      const dependencyPath = path.join(workspaceRoot, "node_modules", ...dependencyName.split("/"), "package.json");
      queue.push(dependencyPath);
    }
  }
  return components.sort((left, right) => left.name.localeCompare(right.name) || left.version.localeCompare(right.version));
}

async function writeDashboardBundleManifest() {
  const inventory = await buildDirectoryInventory(path.join(distRoot, "dashboard"));
  const manifest = {
    schemaVersion: DASHBOARD_BUNDLE_SCHEMA_VERSION,
    productVersion: PRODUCT_VERSION,
    root: "dashboard",
    fileCount: inventory.length,
    inventorySha256: sha256(Buffer.from(JSON.stringify(inventory), "utf8")),
  };
  await writeFile(
    path.join(distRoot, "dashboard-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  return Object.freeze({ manifest, inventory });
}

async function writeReleaseMetadata() {
  const packageMetadataBytes = await readFile(path.join(packageRoot, "package.json"));
  const cliPath = path.join(distRoot, "understand-code.mjs");
  const previewBinPath = path.join(distRoot, "bin.mjs");
  const hostBinPath = path.join(distRoot, "host-bin.mjs");
  const nativeTuple = `${process.platform}-${process.arch}`;
  const nativePath =
    `dist/native/${nativeTuple}/provider_kernel_peer.node`;
  const [
    cliBytes,
    previewBinBytes,
    hostBinBytes,
    nativeBytes,
    serverBytes,
    contractsBytes,
    dashboardInventory,
    dashboardManifestBytes,
  ] = await Promise.all([
    readFile(cliPath),
    readFile(previewBinPath),
    readFile(hostBinPath),
    readFile(path.join(packageRoot, nativePath)),
    readFile(path.join(distRoot, "server.mjs")),
    readFile(path.join(distRoot, "contracts.mjs")),
    buildDirectoryInventory(path.join(distRoot, "dashboard")),
    readFile(path.join(distRoot, "dashboard-manifest.json")),
  ]);
  const cli = Object.freeze({
    bin: "understand-code",
    path: "dist/understand-code.mjs",
    sha256: sha256(cliBytes),
  });
  const entrypoint = "dist/host-bin.mjs";
  const entrypointSha256 = sha256(hostBinBytes);
  const hostDefinitions = Object.freeze({
    codex: Object.freeze({
      bin: "understand-code-codex",
      placeholder: "${WORKSPACE_ROOT}",
      configs: Object.freeze([
        "dist/host-adapters/codex/mcp.json",
        "dist/host-adapters/codex/config.toml",
      ]),
    }),
    claude: Object.freeze({
      bin: "understand-code-claude",
      placeholder: "${CLAUDE_PROJECT_DIR}",
      configs: Object.freeze(["dist/host-adapters/claude/.mcp.json"]),
    }),
  });
  const hostAdapters = {};
  for (const [host, definition] of Object.entries(hostDefinitions)) {
    const manifestRelative = `dist/host-adapters/${host}/manifest.json`;
    const manifest = {
      schemaVersion: "understand-code-host-adapter-release-v1",
      product: "understand-code",
      productVersion: PRODUCT_VERSION,
      host,
      name: "understand-code",
      transport: "stdio",
      bin: definition.bin,
      entrypoint,
      entrypointSha256,
      cli,
      args: ["--root", definition.placeholder],
      root: {
        required: true,
        flag: "--root",
        placeholder: definition.placeholder,
        absolute: true,
      },
    };
    await writeFile(
      path.join(packageRoot, manifestRelative),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    hostAdapters[host] = {
      bin: definition.bin,
      entrypoint,
      entrypointSha256,
      manifest: manifestRelative,
      configs: definition.configs,
    };
  }
  // Generate a deterministic CycloneDX inventory for every regular file that
  // will be shipped in `dist` (metadata files are added immediately below).
  // This gives each shipped component an identity, version, license assertion,
  // and content digest without claiming publisher authenticity.
  const sbomInventory = await buildDirectoryInventory(
    distRoot,
    new Set(["release-manifest.json", "sbom.cdx.json", "provenance.json"]),
  );
  const fileComponents = sbomInventory.map((entry) => ({
    type: "file",
    name: entry.path,
    version: PRODUCT_VERSION,
    hashes: [{ alg: "SHA-256", content: entry.sha256.slice("sha256:".length) }],
    licenses: [{ license: { expression: "NOASSERTION" } }],
    properties: [{ name: "understand-code:bytes", value: String(entry.bytes) }],
  }));
  const packageComponent = {
    type: "application",
    name: packageMetadata.name,
    version: PRODUCT_VERSION,
    purl: npmPurl(packageMetadata.name, PRODUCT_VERSION),
    licenses: [{ license: { expression: "NOASSERTION" } }],
    hashes: [{ alg: "SHA-256", content: createHash("sha256").update(packageMetadataBytes).digest("hex") }],
  };
  const packageComponents = (await buildPackageComponents()).filter(
    (component) => !(component.name === packageMetadata.name && component.version === PRODUCT_VERSION),
  );
  const serialDigest = sha256(Buffer.from(JSON.stringify([...packageComponents, ...fileComponents]), "utf8")).slice("sha256:".length, "sha256:".length + 32);
  const sbom = {
    bomFormat: "CycloneDX",
    specVersion: "1.5",
    serialNumber: `urn:uuid:${serialDigest.slice(0, 8)}-${serialDigest.slice(8, 12)}-${serialDigest.slice(12, 16)}-${serialDigest.slice(16, 20)}-${serialDigest.slice(20)}`,
    version: 1,
    metadata: { component: packageComponent },
    components: [packageComponent, ...packageComponents, ...fileComponents],
  };
  const sbomBytes = Buffer.from(`${JSON.stringify(sbom, null, 2)}\n`, "utf8");
  await writeFile(path.join(distRoot, "sbom.cdx.json"), sbomBytes);
  const provenance = {
    schemaVersion: "understand-code-alpha-provenance-v1",
    product: "understand-code",
    package: { name: packageMetadata.name, version: PRODUCT_VERSION },
    buildType: "https://slsa.dev/provenance/v1",
    builder: { id: "understand-code-preview/scripts/build.mjs" },
    invocation: { command: "npm run build", platform: process.platform, arch: process.arch },
    source: {
      vcs: "git",
      commit: (await exec("git", ["rev-parse", "HEAD"], { cwd: workspaceRoot })).stdout.trim(),
      tree: (await exec("git", ["rev-parse", "HEAD^{tree}"], { cwd: workspaceRoot })).stdout.trim(),
      lockfile: sha256(await readFile(path.join(workspaceRoot, "pnpm-lock.yaml"))),
    },
    subject: sbomInventory.map(({ path: filePath, sha256: digest }) => ({ name: filePath, digest: { sha256: digest.slice(7) } })),
  };
  const provenanceBytes = Buffer.from(`${JSON.stringify(provenance, null, 2)}\n`, "utf8");
  await writeFile(path.join(distRoot, "provenance.json"), provenanceBytes);
  const releaseManifest = {
    schemaVersion: "understand-code-alpha-release-v1",
    product: "understand-code",
    package: {
      name: packageMetadata.name,
      version: PRODUCT_VERSION,
    },
    cli,
    preview: {
      bin: "understand-code-preview",
      path: "dist/bin.mjs",
      sha256: sha256(previewBinBytes),
    },
    native: {
      tuple: nativeTuple,
      path: nativePath,
      sha256: sha256(nativeBytes),
    },
    runtime: {
      productVersion: PRODUCT_VERSION,
      server: {
        path: "dist/server.mjs",
        sha256: sha256(serverBytes),
      },
      contracts: {
        path: "dist/contracts.mjs",
        sha256: sha256(contractsBytes),
      },
    },
    dashboard: {
      productVersion: PRODUCT_VERSION,
      root: "dist/dashboard",
      manifest: "dist/dashboard-manifest.json",
      manifestSha256: sha256(dashboardManifestBytes),
      fileCount: dashboardInventory.length,
      inventorySha256: sha256(
        Buffer.from(JSON.stringify(dashboardInventory), "utf8"),
      ),
    },
    hostAdapters,
    pluginRoots: {},
    sbom: {
      format: "CycloneDX-1.5",
      path: "dist/sbom.cdx.json",
      sha256: sha256(sbomBytes),
    },
    provenance: {
      format: "slsa-provenance-v1",
      path: "dist/provenance.json",
      sha256: sha256(provenanceBytes),
    },
  };
  const pluginDefinitions = Object.freeze({
    codex: Object.freeze({
      marketplaceRoot: "dist/plugin-roots/codex",
      marketplace: "dist/plugin-roots/codex/.agents/plugins/marketplace.json",
      pluginRoot: "dist/plugin-roots/codex/plugins/understand-code",
      manifest: "dist/plugin-roots/codex/plugins/understand-code/.codex-plugin/plugin.json",
    }),
    claude: Object.freeze({
      marketplaceRoot: "dist/plugin-roots/claude",
      marketplace: "dist/plugin-roots/claude/.claude-plugin/marketplace.json",
      pluginRoot: "dist/plugin-roots/claude/plugins/understand-code",
      manifest: "dist/plugin-roots/claude/plugins/understand-code/.claude-plugin/plugin.json",
    }),
  });
  for (const [host, definition] of Object.entries(pluginDefinitions)) {
    const mcp = `${definition.pluginRoot}/.mcp.json`;
    const entrypoint = `${definition.pluginRoot}/bin/understand-code-plugin.mjs`;
    const pluginCli = `${definition.pluginRoot}/bin/understand-code.mjs`;
    const pluginNative =
      `${definition.pluginRoot}/bin/native/${nativeTuple}/provider_kernel_peer.node`;
    const dashboardRoot = `${definition.pluginRoot}/bin/dashboard`;
    const dashboardManifest = `${definition.pluginRoot}/bin/dashboard-manifest.json`;
    const [marketplaceBytes, manifestBytes, mcpBytes, entrypointBytes, pluginCliBytes,
      pluginNativeBytes, pluginDashboardManifestBytes, pluginDashboardInventory] =
      await Promise.all([
        readFile(path.join(packageRoot, definition.marketplace)),
        readFile(path.join(packageRoot, definition.manifest)),
        readFile(path.join(packageRoot, mcp)),
        readFile(path.join(packageRoot, entrypoint)),
        readFile(path.join(packageRoot, pluginCli)),
        readFile(path.join(packageRoot, pluginNative)),
        readFile(path.join(packageRoot, dashboardManifest)),
        buildDirectoryInventory(path.join(packageRoot, dashboardRoot)),
      ]);
    const pluginCliSha256 = sha256(pluginCliBytes);
    if (pluginCliSha256 !== cli.sha256) {
      throw new Error(`${host} plugin CLI differs from the release CLI`);
    }
    if (!pluginNativeBytes.equals(nativeBytes)) {
      throw new Error(`${host} plugin native peer differs from the release native peer`);
    }
    const payloadFiles = {
      manifestSha256: sha256(manifestBytes),
      mcpSha256: sha256(mcpBytes),
      entrypointSha256: sha256(entrypointBytes),
      cliSha256: pluginCliSha256,
      nativeSha256: sha256(pluginNativeBytes),
      dashboardManifestSha256: sha256(pluginDashboardManifestBytes),
      dashboardInventorySha256: sha256(
        Buffer.from(JSON.stringify(pluginDashboardInventory), "utf8"),
      ),
    };
    if (
      pluginDashboardInventory.length !== dashboardInventory.length ||
      payloadFiles.dashboardInventorySha256 !== releaseManifest.dashboard.inventorySha256 ||
      !pluginDashboardManifestBytes.equals(dashboardManifestBytes)
    ) {
      throw new Error(`${host} plugin Dashboard differs from the release Dashboard`);
    }
    releaseManifest.pluginRoots[host] = {
      marketplaceRoot: definition.marketplaceRoot,
      marketplace: definition.marketplace,
      marketplaceSha256: sha256(marketplaceBytes),
      pluginRoot: definition.pluginRoot,
      manifest: definition.manifest,
      manifestSha256: payloadFiles.manifestSha256,
      mcp,
      mcpSha256: payloadFiles.mcpSha256,
      entrypoint,
      entrypointSha256: payloadFiles.entrypointSha256,
      cli: pluginCli,
      cliSha256: payloadFiles.cliSha256,
      native: pluginNative,
      nativeSha256: payloadFiles.nativeSha256,
      dashboardRoot,
      dashboardManifest,
      dashboardManifestSha256: payloadFiles.dashboardManifestSha256,
      dashboardFileCount: pluginDashboardInventory.length,
      dashboardInventorySha256: payloadFiles.dashboardInventorySha256,
      payloadSha256: sha256(Buffer.from(JSON.stringify(payloadFiles), "utf8")),
    };
  }
  await writeFile(
    path.join(distRoot, "release-manifest.json"),
    `${JSON.stringify(releaseManifest, null, 2)}\n`,
  );
}

async function buildPluginRoots() {
  const outputRoot = path.join(distRoot, "plugin-roots");
  await cp(pluginRootsSourceRoot, outputRoot, { recursive: true });
  const definitions = Object.freeze({
    codex: Object.freeze({
      root: path.join(outputRoot, "codex"),
      marketplace: ".agents/plugins/marketplace.json",
      manifest: "plugins/understand-code/.codex-plugin/plugin.json",
      mcp: "plugins/understand-code/.mcp.json",
      expectedCommand: "./bin/understand-code-plugin.mjs",
      expectedArgs: ["--host", "codex"],
      expectedMarketplaceSource: {
        source: "local",
        path: "./plugins/understand-code",
      },
    }),
    claude: Object.freeze({
      root: path.join(outputRoot, "claude"),
      marketplace: ".claude-plugin/marketplace.json",
      manifest: "plugins/understand-code/.claude-plugin/plugin.json",
      mcp: "plugins/understand-code/.mcp.json",
      expectedCommand: "${CLAUDE_PLUGIN_ROOT}/bin/understand-code-plugin.mjs",
      expectedArgs: ["--host", "claude"],
      expectedMarketplaceSource: "./plugins/understand-code",
    }),
  });
  for (const [host, definition] of Object.entries(definitions)) {
    const marketplace = JSON.parse(
      await readFile(path.join(definition.root, definition.marketplace), "utf8"),
    );
    const manifest = JSON.parse(
      await readFile(path.join(definition.root, definition.manifest), "utf8"),
    );
    const mcp = JSON.parse(
      await readFile(path.join(definition.root, definition.mcp), "utf8"),
    );
    if (
      marketplace.name !== "understand-code-alpha" ||
      !Array.isArray(marketplace.plugins) ||
      marketplace.plugins.length !== 1 ||
      marketplace.plugins[0]?.name !== "understand-code" ||
      JSON.stringify(marketplace.plugins[0]?.source) !==
        JSON.stringify(definition.expectedMarketplaceSource)
    ) {
      throw new Error(`${host} plugin marketplace identity is invalid`);
    }
    if (
      manifest.name !== "understand-code" ||
      manifest.version !== PRODUCT_VERSION
    ) {
      throw new Error(`${host} plugin version differs from the release version`);
    }
    if (
      host === "claude" &&
      marketplace.plugins[0]?.version !== PRODUCT_VERSION
    ) {
      throw new Error("Claude marketplace version differs from the release version");
    }
    if (
      Object.keys(mcp).length !== 1 ||
      typeof mcp["understand-code"] !== "object" ||
      mcp["understand-code"] === null ||
      "mcpServers" in mcp ||
      "mcp_servers" in mcp ||
      mcp["understand-code"].command !== definition.expectedCommand ||
      JSON.stringify(mcp["understand-code"].args) !==
        JSON.stringify(definition.expectedArgs)
    ) {
      throw new Error(`${host} plugin MCP config must be a direct server map`);
    }
    const pluginBinRoot = path.join(
      definition.root,
      "plugins/understand-code/bin",
    );
    await mkdir(pluginBinRoot, { recursive: true });
    await Promise.all([
      cp(
        path.join(packageRoot, "src/codex-plugin-bin.mjs"),
        path.join(pluginBinRoot, "understand-code-plugin.mjs"),
      ),
      cp(
        path.join(distRoot, "understand-code.mjs"),
        path.join(pluginBinRoot, "understand-code.mjs"),
      ),
      cp(
        path.join(distRoot, "native"),
        path.join(pluginBinRoot, "native"),
        { recursive: true },
      ),
      cp(
        path.join(distRoot, "dashboard"),
        path.join(pluginBinRoot, "dashboard"),
        { recursive: true },
      ),
      cp(
        path.join(distRoot, "dashboard-manifest.json"),
        path.join(pluginBinRoot, "dashboard-manifest.json"),
      ),
    ]);
    await Promise.all([
      chmod(path.join(pluginBinRoot, "understand-code-plugin.mjs"), 0o755),
      chmod(path.join(pluginBinRoot, "understand-code.mjs"), 0o755),
    ]);
  }
}

const graph = {
  version: "1.0.0",
  project: {
    name: "Preview 示例项目",
    languages: ["TypeScript"],
    frameworks: ["Understand Code"],
    description: "一个可离线查看 Graph/Wiki/Evidence 的最小示例。",
    analyzedAt: "2026-08-12T00:00:00.000Z",
    gitCommitHash: "preview-fixture",
  },
  nodes: [
    { id: "file:src/app.ts", type: "file", name: "app.ts", filePath: "src/app.ts", summary: "应用入口。", tags: ["entry"], complexity: "simple" },
    { id: "function:src/app.ts:main", type: "function", name: "main", filePath: "src/app.ts", lineRange: [1, 4], summary: "启动应用。", tags: ["entry"], complexity: "simple" },
    { id: "module:knowledge", type: "module", name: "Knowledge Layer", summary: "Graph/Wiki/Evidence 知识层。", tags: ["knowledge"], complexity: "moderate" },
  ],
  edges: [
    { source: "file:src/app.ts", target: "function:src/app.ts:main", type: "contains", direction: "forward", weight: 1 },
    { source: "function:src/app.ts:main", target: "module:knowledge", type: "documents", direction: "forward", weight: 0.8 },
  ],
  layers: [
    { id: "layer:entry", name: "入口", description: "启动与入口。", nodeIds: ["file:src/app.ts", "function:src/app.ts:main"] },
    { id: "layer:knowledge", name: "知识层", description: "可验证的 Graph/Wiki/Evidence。", nodeIds: ["module:knowledge"] },
  ],
  tour: [
    { order: 0, title: "从入口开始", description: "先阅读 app.ts 的 main。", nodeIds: ["file:src/app.ts", "function:src/app.ts:main"] },
    { order: 1, title: "进入知识层", description: "查看 Graph 与 Wiki 的关联。", nodeIds: ["module:knowledge"] },
  ],
};

function buildWiki(demoGraphDigest) {
  return {
  version: 2,
  generatedAt: "2026-08-12T00:00:00.000Z",
  projectName: "Preview 示例项目",
  source: { outputLanguage: "zh-CN", generationMode: "preview", graphDigest: demoGraphDigest, gitCommitHash: "preview-fixture", sourceRootIdentity: "/preview-demo" },
  mainReadiness: { status: "ready", reasons: [], routePageIds: ["page:overview", "page:flow"] },
  referenceCoverage: {
    status: "complete",
    files: { covered: 1, total: 1, missingIds: [] },
    functions: { covered: 1, total: 1, missingIds: [] },
    types: { covered: 0, total: 0, missingIds: [] },
  },
  pages: [
    { id: "page:overview", title: "项目总览", summary: "了解 Preview 的 Graph/Wiki/Evidence 工作面。", markdownPath: "knowledge-base/项目总览.md", role: "featured", category: "overview", quality: "generated", generationStatus: "complete", directNodeIds: ["module:knowledge"], contextNodeIds: [], evidenceIds: ["evidence:knowledge"], searchTerms: ["项目", "Preview", "知识层"], route: { order: 0, stage: "purpose" } },
    { id: "page:flow", title: "阅读与验证流程", summary: "从入口到源码证据的最短路径。", markdownPath: "knowledge-base/阅读流程.md", role: "featured", category: "flow", quality: "generated", generationStatus: "complete", directNodeIds: ["function:src/app.ts:main"], contextNodeIds: [], evidenceIds: ["evidence:main"], searchTerms: ["流程", "main", "证据"], route: { order: 1, stage: "flow" } },
    { id: "page:file", title: "app.ts 文件参考", summary: "入口源码和行号证据。", markdownPath: "knowledge-base/参考/app.ts.md", role: "reference", category: "file", quality: "generated", generationStatus: "complete", directNodeIds: ["file:src/app.ts", "function:src/app.ts:main"], contextNodeIds: [], evidenceIds: ["evidence:app"], searchTerms: ["app.ts", "main" ] },
  ],
  nodeDocumentation: [
    { nodeId: "module:knowledge", relation: "direct", quality: "generated", evidenceHealth: "source-linked", generationStatus: "complete", referenceCoverage: "anchored", directPageIds: ["page:overview"], contextPageIds: [], evidenceIds: ["evidence:knowledge"], primaryPageId: "page:overview" },
    { nodeId: "function:src/app.ts:main", relation: "direct", quality: "generated", evidenceHealth: "source-linked", generationStatus: "complete", referenceCoverage: "anchored", directPageIds: ["page:flow", "page:file"], contextPageIds: [], evidenceIds: ["evidence:main", "evidence:app"], primaryPageId: "page:file", anchor: "main" },
    { nodeId: "file:src/app.ts", relation: "direct", quality: "generated", evidenceHealth: "source-linked", generationStatus: "complete", referenceCoverage: "anchored", directPageIds: ["page:file"], contextPageIds: [], evidenceIds: ["evidence:app"], primaryPageId: "page:file" },
  ],
  evidence: [
    { id: "evidence:knowledge", nodeIds: ["module:knowledge"], filePath: "src/app.ts", lineRange: [1, 4], excerpt: "// Graph/Wiki/Evidence knowledge layer", evidenceType: "documentation" },
    { id: "evidence:main", nodeIds: ["function:src/app.ts:main"], filePath: "src/app.ts", lineRange: [1, 4], excerpt: "export function main() { return 'ready'; }", evidenceType: "production" },
    { id: "evidence:app", nodeIds: ["file:src/app.ts", "function:src/app.ts:main"], filePath: "src/app.ts", lineRange: [1, 4], excerpt: "export function main() { return 'ready'; }", evidenceType: "production" },
  ],
  };
}

function buildSearch(wiki) {
  return {
  version: 2,
  generatedAt: wiki.generatedAt,
  records: [
    { id: "search:overview", kind: "page", title: "项目总览", summary: wiki.pages[0].summary, pageId: "page:overview", role: "featured", category: "overview", relation: "direct", terms: ["项目", "Preview"], businessTerms: ["知识层"] },
    { id: "search:flow", kind: "page", title: "阅读与验证流程", summary: wiki.pages[1].summary, pageId: "page:flow", role: "featured", category: "flow", relation: "direct", terms: ["流程", "证据"], businessTerms: [] },
    { id: "search:file", kind: "page", title: "app.ts 文件参考", summary: wiki.pages[2].summary, pageId: "page:file", role: "reference", category: "file", relation: "direct", terms: ["app.ts", "main"], businessTerms: [] },
    { id: "search:main", kind: "symbol", title: "main", summary: "启动应用。", pageId: "page:file", anchor: "main", nodeId: "function:src/app.ts:main", role: "reference", category: "file", relation: "direct", terms: ["main", "app.ts"], businessTerms: [], filePath: "src/app.ts" },
  ],
  };
}
const config = { autoUpdate: false, outputLanguage: "zh-CN" };

async function main() {
  await rm(distRoot, { recursive: true, force: true });
  await mkdir(distRoot, { recursive: true });
  await run("pnpm", ["--filter", "@understand-code/native-kernel-bridge", "build"]);
  await run("pnpm", ["--filter", "@understand-code/durable-object-provider-contracts", "build"]);
  await run("pnpm", ["--filter", "@understand-code/durable-object-provider-runtime", "build"]);
  await run("pnpm", ["--filter", "@understand-code/durable-object-provider-client", "build"]);
  await run("pnpm", ["--filter", "@understand-code/durable-object-provider-authority", "build"]);
  await run("pnpm", ["--filter", "@understand-code/host-adapters", "build"]);
  await run("pnpm", ["--filter", "@understand-code/contracts", "build"]);
  await run("pnpm", ["--filter", "@understand-code/installation-lifecycle", "build"]);
  await run("pnpm", ["--filter", "@understand-code/workbench-runtime", "build"]);
  await run("pnpm", ["--filter", "@understand-code/repository-state", "build"]);
  await run("pnpm", ["--filter", "@understand-code/artifact-store", "build"]);
  await run("pnpm", ["--filter", "@understand-code/core", "build"]);
  await run("pnpm", ["--filter", "@understand-code/task-engine", "build"]);
  await run(process.execPath, [
    path.join(workspaceRoot, "packages/cli/scripts/build-bundle.mjs"),
    "--output",
    path.join(distRoot, "understand-code.mjs"),
    "--bundle-profile",
    "full",
    "--product-version",
    PRODUCT_VERSION,
  ]);
  await run("pnpm", ["exec", "vite", "build", "--config", path.join(dashboardRoot, "vite.config.preview.mjs")], dashboardRoot);
  await run("pnpm", ["exec", "vite", "build", "--config", path.join(packageRoot, "vite.config.contracts.mjs")], dashboardRoot);
  const { parseWikiIndexV2, parseWikiSearchIndexV2, validateGraph } = await import(path.join(distRoot, "contracts.mjs"));
  const graphResult = validateGraph(graph);
  if (!graphResult.success || graphResult.data === undefined || graphResult.issues.length > 0) throw new Error("Preview demo graph failed its production contract");
  const validatedGraph = graphResult.data;
  const demoGraphDigest = createHash("sha256").update(JSON.stringify(validatedGraph)).digest("hex");
  const wiki = buildWiki(demoGraphDigest);
  const search = buildSearch(wiki);
  if (!parseWikiIndexV2(wiki).ok || !parseWikiSearchIndexV2(search).ok) {
    throw new Error("Preview demo Wiki/Search failed its production V2 contract");
  }
  const meta = { lastAnalyzedAt: wiki.generatedAt, gitCommitHash: "preview-fixture", version: "1.0.0", analyzedFiles: 1, theme: { presetId: "technical-document" } };
  await cp(path.join(packageRoot, "src/bin.mjs"), path.join(distRoot, "bin.mjs"));
  await cp(path.join(packageRoot, "src/host-install.mjs"), path.join(distRoot, "host-install.mjs"));
  await cp(path.join(packageRoot, "src/host-bin.mjs"), path.join(distRoot, "host-bin.mjs"));
  await cp(path.join(packageRoot, "src/server.mjs"), path.join(distRoot, "server.mjs"));
  await Promise.all([
    chmod(path.join(distRoot, "bin.mjs"), 0o755),
    chmod(path.join(distRoot, "host-bin.mjs"), 0o755),
  ]);
  await Promise.all([
    mkdir(path.join(distRoot, "host-adapters/codex"), { recursive: true }),
    mkdir(path.join(distRoot, "host-adapters/claude"), { recursive: true }),
  ]);
  await Promise.all([
    cp(
      path.join(hostAdapterIntegrationsRoot, "codex/mcp.json"),
      path.join(distRoot, "host-adapters/codex/mcp.json"),
    ),
    cp(
      path.join(hostAdapterIntegrationsRoot, "codex/config.toml"),
      path.join(distRoot, "host-adapters/codex/config.toml"),
    ),
    cp(
      path.join(hostAdapterIntegrationsRoot, "claude/.mcp.json"),
      path.join(distRoot, "host-adapters/claude/.mcp.json"),
    ),
  ]);
  const demoRoot = path.join(distRoot, "demo/.understand-code");
  await mkdir(path.join(demoRoot, "knowledge-base/参考"), { recursive: true });
  await writeFile(path.join(demoRoot, "knowledge-graph.json"), `${JSON.stringify(validatedGraph, null, 2)}\n`);
  await writeFile(path.join(demoRoot, "meta.json"), `${JSON.stringify(meta, null, 2)}\n`);
  await writeFile(path.join(demoRoot, "config.json"), `${JSON.stringify(config, null, 2)}\n`);
  await writeFile(path.join(demoRoot, "knowledge-base/wiki-index.json"), `${JSON.stringify(wiki, null, 2)}\n`);
  await writeFile(path.join(demoRoot, "knowledge-base/search-index.json"), `${JSON.stringify(search, null, 2)}\n`);
  await writeFile(path.join(demoRoot, "knowledge-base/项目总览.md"), "# 项目总览\n\n这是一个可安装的 Graph/Wiki Preview。你可以从知识层入口开始阅读，并沿着证据回到源码。\n");
  await writeFile(path.join(demoRoot, "knowledge-base/阅读流程.md"), "# 阅读与验证流程\n\n1. 从推荐阅读开始。\n2. 打开 Graph 节点。\n3. 查看 Evidence rail 的文件与行号。\n4. 搜索 `main` 回到入口。\n");
  await mkdir(path.join(demoRoot, "knowledge-base/参考"), { recursive: true });
  await writeFile(path.join(demoRoot, "knowledge-base/参考/app.ts.md"), "# app.ts\n\n```ts\nexport function main() { return 'ready'; }\n```\n\nEvidence: `src/app.ts:1-4`.\n");
  // Keep one real persisted Task Brief in the packed demo so the Task-first
  // Dashboard route exercises the same read-only artifact projection as a
  // published worktree. The fixture is validated by the contracts package.
  const referenceFixtures = path.join(workspaceRoot, "packages/contracts/fixtures/v1/reference");
  const demoTaskId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
  const demoTaskRoot = path.join(demoRoot, "tasks", demoTaskId);
  await mkdir(demoTaskRoot, { recursive: true });
  await cp(path.join(referenceFixtures, "task.json"), path.join(demoTaskRoot, "task.json"));
  await cp(path.join(referenceFixtures, "task-brief.json"), path.join(demoTaskRoot, "task-brief.json"));
  await cp(path.join(referenceFixtures, "change-check.json"), path.join(demoTaskRoot, "change-check.json"));
  await cp(path.join(referenceFixtures, "verification.json"), path.join(demoTaskRoot, "verification.json"));
  await cp(path.join(referenceFixtures, "repo-pulse.json"), path.join(demoRoot, "repo-pulse.json"));
  await mkdir(path.join(distRoot, "demo/src"), { recursive: true });
  await writeFile(path.join(distRoot, "demo/src/app.ts"), "// Graph/Wiki/Evidence knowledge layer\nexport function main() { return 'ready'; }\n");
  await writeFile(path.join(distRoot, "README.md"), await readFile(path.join(packageRoot, "README.md")));
  const indexPath = path.join(distRoot, "dashboard/index.html");
  const sanitizedIndex = (await readFile(indexPath, "utf8"))
    .replace(/\s*<link rel="preconnect"[^>]*>/gu, "")
    .replace(/\s*<link\s+href="https:\/\/fonts\.googleapis\.com[^>]*>/gu, "")
    .replace(/\s*<link\s+href="https:\/\/fonts\.gstatic\.com[^>]*>/gu, "");
  const bootstrap = externalizeFirstPaintThemeBootstrap(sanitizedIndex);
  const bootstrapPath = path.join(distRoot, "dashboard/assets", bootstrap.fileName);
  await writeFile(bootstrapPath, bootstrap.source);
  await writeFile(indexPath, bootstrap.index);
  const packedIndex = await readFile(indexPath, "utf8");
  const packedBootstrap = await readFile(bootstrapPath, "utf8");
  if (createHash("sha256").update(packedBootstrap).digest("hex") !== bootstrap.fileName.slice("theme-bootstrap-".length, -".js".length)) {
    throw new Error("Preview dashboard theme bootstrap content hash does not match its file name");
  }
  assertExternalScriptOnly(packedIndex, bootstrap.fileName);
  await writeDashboardBundleManifest();
  await buildPluginRoots();
  await writeReleaseMetadata();
  process.stdout.write(`built ${distRoot}\n`);
}

main().catch((error) => { console.error(error); process.exit(1); });
