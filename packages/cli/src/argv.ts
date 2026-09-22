import { MAX_PATH_BYTES } from "./constants.js";

export type CliInvocation =
  | { readonly kind: "help" }
  | { readonly kind: "version" }
  | { readonly kind: "index_job"; readonly root: string; readonly action: "start" | "status" | "cancel" | "run"; readonly jobId?: string }
  | { readonly kind: "recovery"; readonly root: string; readonly action: "rebuild" | "restore"; readonly backupId?: string }
  | { readonly kind: "workbench"; readonly root: string; readonly taskId?: string; readonly noOpen: boolean }
  | { readonly kind: "knowledge"; readonly root: string; readonly taskId: string; readonly writerArgs: readonly string[]; readonly candidateGenerationId?: string }
  | {
      /** Private installed-service entrypoint; config remains root-owned. */
      readonly kind: "provider_service_runtime";
      readonly serviceConfig: string;
    }
  | {
      /** Private verifier used by an installer-owned strong Host wrapper. */
      readonly kind: "host_provider_selector";
      readonly installationRoot: string;
    }
  | {
      readonly kind: "installation";
      readonly operation:
        | "install"
        | "upgrade"
        | "downgrade"
        | "rollback"
        | "doctor"
        | "uninstall";
      readonly root?: string;
      readonly home?: string;
      readonly host?: "codex" | "claude";
      readonly providerInstallationRoot?: string;
      readonly version?: string;
      readonly cliBundlePath?: string;
      readonly provider?: true;
      /** Privileged Provider Service Handoff installation entrypoint. */
      readonly providerService?: true;
      readonly serviceConfig?: string;
      readonly serviceReadiness?: string;
      readonly serviceKey?: string;
      readonly serviceDescriptor?: string;
      readonly serviceManifest?: string;
    }
  | {
      /** Private self-spawn entrypoint used only by `doctor --provider`. */
      readonly kind: "provider_runtime";
      readonly root: string;
      readonly socket: string;
      readonly authKeyFile: string;
      readonly providerId: string;
      readonly capabilityDigest: `sha256:${string}`;
    }
  | {
      readonly kind: "mcp";
      readonly rootCandidates: readonly string[];
      /** Installer-owned Host installation resolved in-process to a Provider. */
      readonly hostInstallationRoot?: string;
    };

export class CliArgumentError extends Error {
  constructor() {
    super("Invalid CLI arguments.");
    this.name = "CliArgumentError";
  }
}

function safePathArgument(value: unknown): value is string {
  return (
    typeof value === "string" &&
    Buffer.byteLength(value, "utf8") <= MAX_PATH_BYTES &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

function safeVersionArgument(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u.exec(value);
  if (match === null) return false;
  const prerelease = match[4];
  return prerelease === undefined || prerelease.split(".").every(
    (identifier) =>
      !/^\d+$/u.test(identifier) ||
      identifier.length === 1 ||
      !identifier.startsWith("0"),
  );
}

export function parseCliArguments(values: readonly string[]): CliInvocation {
  if (values.length === 0 || (values.length === 1 && ["--help", "-h"].includes(values[0]!))) {
    return { kind: "help" };
  }
  if (values.length === 1 && ["--version", "-V"].includes(values[0]!)) {
    return { kind: "version" };
  }
  if (values[0] === "index" || values[0] === "__index-job-run" || values[0] === "recover") {
    const recovery = values[0] === "recover";
    const internal = values[0] === "__index-job-run";
    let root: string | undefined;
    let jobId: string | undefined;
    let backupId: string | undefined;
    let action: "start" | "status" | "cancel" | "run" | "rebuild" | "restore" = internal ? "run" : "start";
    let explicitAction = false;
    const seen = new Set<string>();
    for (let index = 1; index < values.length; index += 1) {
      const flag = values[index]!;
      if (seen.has(flag)) throw new CliArgumentError();
      seen.add(flag);
      const selected = recovery ? (flag === "--rebuild" ? "rebuild" : flag === "--restore" ? "restore" : undefined)
        : internal ? undefined : flag === "--background" ? "start" : flag === "--status" ? "status" : flag === "--cancel" ? "cancel" : undefined;
      if (selected) {
        if (explicitAction) throw new CliArgumentError();
        action = selected; explicitAction = true;
        if (selected !== "restore") continue;
      }
      const value = values[++index];
      if (!safePathArgument(value) || !value || value.startsWith("--")) throw new CliArgumentError();
      if (flag === "--root" && pathIsAbsolute(value)) root = value;
      else if (!recovery && flag === "--job-id" && /^[0-9A-HJKMNP-TV-Z]{26}$/u.test(value)) jobId = value;
      else if (recovery && flag === "--restore" && /^recovery-[0-9a-f]{32}$/u.test(value)) backupId = value;
      else throw new CliArgumentError();
    }
    if (!root) throw new CliArgumentError();
    if (recovery) {
      if (action !== "rebuild" && action !== "restore") throw new CliArgumentError();
      return { kind: "recovery", root, action, ...(backupId ? { backupId } : {}) };
    }
    if ((internal && !jobId) || action === "rebuild" || action === "restore" || (action === "start" && jobId)) throw new CliArgumentError();
    return { kind: "index_job", root, action, ...(jobId ? { jobId } : {}) };
  }
  if (values[0] === "workbench" || values[0] === "knowledge") {
    const kind = values[0];
    let root: string | undefined;
    let taskId: string | undefined;
    let candidateGenerationId: string | undefined;
    let noOpen = false;
    const writerArgs: string[] = [];
    const seen = new Set<string>();
    const phases = new Set(["--prepare-file-docs", "--restart-draft", "--lease-file-batch", "--complete-file-batch", "--merge-file-docs", "--prepare-topics", "--prepare-featured", "--lease-topic-batch", "--complete-topic-batch", "--finalize", "--retry", "--guide", "--discard-candidate", "--cleanup-interrupted"]);
    let phaseCount = 0;
    for (let index = 1; index < values.length; index += 1) {
      const flag = values[index]!;
      if (seen.has(flag)) throw new CliArgumentError();
      seen.add(flag);
      if (flag === "--no-open" && kind === "workbench") { noOpen = true; continue; }
      if (kind === "knowledge" && phases.has(flag)) { writerArgs.push(flag); phaseCount += 1; continue; }
      if (kind === "knowledge" && ["--resume", "--include-extended-topics"].includes(flag)) { writerArgs.push(flag); continue; }
      const value = values[++index];
      if (!safePathArgument(value) || !value || value.startsWith("--")) throw new CliArgumentError();
      if (flag === "--root" && pathIsAbsolute(value)) root = value;
      else if (flag === "--task-id" && /^[0-9A-HJKMNP-TV-Z]{26}$/u.test(value)) taskId = value;
      else if (kind === "knowledge" && flag === "--candidate" && /^generation-[0-9a-f]{64}$/u.test(value)) candidateGenerationId = value;
      else if (kind === "knowledge" && ["--worker-id", "--batch-index", "--result-status", "--max-source-mb"].includes(flag)) {
        if (flag === "--batch-index" && !/^\d+$/u.test(value)) throw new CliArgumentError();
        if (flag === "--max-source-mb" && (!Number.isFinite(Number(value)) || Number(value) <= 0)) throw new CliArgumentError();
        writerArgs.push(flag, value);
      } else throw new CliArgumentError();
    }
    if (!root) throw new CliArgumentError();
    if (kind === "workbench") return { kind, root, ...(taskId ? { taskId } : {}), noOpen };
    if (!taskId || phaseCount !== 1 || writerArgs.includes("--discard-candidate") !== Boolean(candidateGenerationId)) throw new CliArgumentError();
    return { kind, root, taskId, writerArgs, ...(candidateGenerationId ? { candidateGenerationId } : {}) };
  }
  if (values.length === 2 && values[0] === "--service-config") {
    const serviceConfig = values[1];
    if (!safePathArgument(serviceConfig) || !pathIsAbsolute(serviceConfig)) {
      throw new CliArgumentError();
    }
    return { kind: "provider_service_runtime", serviceConfig };
  }
  if (
    values.length === 3 &&
    values[0] === "__host-provider-selector" &&
    values[1] === "--installation-root"
  ) {
    const installationRoot = values[2];
    if (
      !safePathArgument(installationRoot) ||
      !pathIsAbsolute(installationRoot)
    ) {
      throw new CliArgumentError();
    }
    return { kind: "host_provider_selector", installationRoot };
  }
  if (values[0] === "__provider-runtime") {
    const parsed = new Map<string, string>();
    for (let index = 1; index < values.length; index += 2) {
      const flag = values[index];
      const value = values[index + 1];
      if (
        flag === undefined ||
        value === undefined ||
        ![
          "--root",
          "--socket",
          "--auth-key-file",
          "--provider-id",
          "--capability-digest",
        ].includes(flag) ||
        parsed.has(flag)
      ) {
        throw new CliArgumentError();
      }
      parsed.set(flag, value);
    }
    const root = parsed.get("--root");
    const socket = parsed.get("--socket");
    const authKeyFile = parsed.get("--auth-key-file");
    const providerId = parsed.get("--provider-id");
    const capabilityDigest = parsed.get("--capability-digest");
    if (
      !safePathArgument(root) ||
      !pathIsAbsolute(root) ||
      !safePathArgument(socket) ||
      !pathIsAbsolute(socket) ||
      !safePathArgument(authKeyFile) ||
      !pathIsAbsolute(authKeyFile) ||
      typeof providerId !== "string" ||
      !/^durable-object-provider:[a-z0-9][a-z0-9._-]{0,127}$/u.test(providerId) ||
      typeof capabilityDigest !== "string" ||
      !/^sha256:[0-9a-f]{64}$/u.test(capabilityDigest)
    ) {
      throw new CliArgumentError();
    }
    return {
      kind: "provider_runtime",
      root,
      socket,
      authKeyFile,
      providerId,
      capabilityDigest: capabilityDigest as `sha256:${string}`,
    };
  }
  if (
    ["install", "upgrade", "downgrade", "rollback", "doctor", "uninstall"].includes(
      values[0] ?? "",
    )
  ) {
    const operation = values[0] as
      | "install"
      | "upgrade"
      | "downgrade"
      | "rollback"
      | "doctor"
      | "uninstall";
    let root: string | undefined;
    let home: string | undefined;
    let host: "codex" | "claude" | undefined;
    let providerInstallationRoot: string | undefined;
    let version: string | undefined;
    let cliBundlePath: string | undefined;
    let provider: true | undefined;
    let providerService: true | undefined;
    let serviceConfig: string | undefined;
    let serviceReadiness: string | undefined;
    let serviceKey: string | undefined;
    let serviceDescriptor: string | undefined;
    let serviceManifest: string | undefined;
    for (let index = 1; index < values.length; index += 1) {
      const flag = values[index];
      if (flag === "--provider") {
        if (operation !== "doctor" || provider !== undefined) {
          throw new CliArgumentError();
        }
        provider = true;
        continue;
      }
      if (flag === "--version") {
        if (operation !== "downgrade" || version !== undefined) {
          throw new CliArgumentError();
        }
        const candidate = values[index + 1];
        if (!safeVersionArgument(candidate)) throw new CliArgumentError();
        version = candidate;
        index += 1;
        continue;
      }
      if (flag === "--cli-bundle") {
        if (operation !== "downgrade" || cliBundlePath !== undefined) {
          throw new CliArgumentError();
        }
        const candidate = values[index + 1];
        if (!safePathArgument(candidate) || !pathIsAbsolute(candidate)) {
          throw new CliArgumentError();
        }
        cliBundlePath = candidate;
        index += 1;
        continue;
      }
      if (flag === "--provider-service") {
        if (providerService !== undefined) {
          throw new CliArgumentError();
        }
        providerService = true;
        continue;
      }
      if (
        flag === "--service-config" ||
        flag === "--service-readiness" ||
        flag === "--service-key" ||
        flag === "--service-descriptor" ||
        flag === "--service-manifest"
      ) {
        const validForDoctor =
          operation === "doctor" &&
          (flag === "--service-config" || flag === "--service-readiness");
        // Collect lifecycle flags before the final providerService invariant
        // so argv order remains irrelevant (for example, --service-manifest
        // may precede the --provider-service marker).
        const validForProviderService =
          flag === "--service-manifest" ||
          ((operation === "install" ||
            operation === "upgrade") &&
            flag !== "--service-readiness");
        if (!validForDoctor && !validForProviderService) {
          throw new CliArgumentError();
        }
        const candidate = values[index + 1];
        if (!safePathArgument(candidate) || !pathIsAbsolute(candidate)) {
          throw new CliArgumentError();
        }
        if (flag === "--service-config") {
          if (serviceConfig !== undefined) throw new CliArgumentError();
          serviceConfig = candidate;
        } else if (flag === "--service-readiness") {
          if (serviceReadiness !== undefined) throw new CliArgumentError();
          serviceReadiness = candidate;
        } else if (flag === "--service-key") {
          if (serviceKey !== undefined) throw new CliArgumentError();
          serviceKey = candidate;
        } else if (flag === "--service-descriptor") {
          if (serviceDescriptor !== undefined) throw new CliArgumentError();
          serviceDescriptor = candidate;
        } else {
          if (serviceManifest !== undefined) throw new CliArgumentError();
          serviceManifest = candidate;
        }
        index += 1;
        continue;
      }
      if (flag === "--host") {
        if (
          operation !== "install" &&
          operation !== "upgrade" &&
          operation !== "downgrade" &&
          operation !== "doctor"
        ) {
          throw new CliArgumentError();
        }
        if (host !== undefined) throw new CliArgumentError();
        const candidate = values[index + 1];
        if (candidate !== "codex" && candidate !== "claude") {
          throw new CliArgumentError();
        }
        host = candidate;
        index += 1;
        continue;
      }
      if (flag === "--provider-installation-root") {
        if (
          (operation !== "install" &&
            operation !== "upgrade" &&
            operation !== "downgrade") ||
          providerInstallationRoot !== undefined
        ) {
          throw new CliArgumentError();
        }
        const candidate = values[index + 1];
        if (!safePathArgument(candidate) || !pathIsAbsolute(candidate)) {
          throw new CliArgumentError();
        }
        providerInstallationRoot = candidate;
        index += 1;
        continue;
      }
      if (flag !== "--root" && flag !== "--home") throw new CliArgumentError();
      const target = values[index + 1];
      if (!safePathArgument(target) || !pathIsAbsolute(target)) {
        throw new CliArgumentError();
      }
      if (flag === "--root") {
        if (root !== undefined) throw new CliArgumentError();
        root = target;
      } else {
        if (home !== undefined) throw new CliArgumentError();
        home = target;
      }
      index += 1;
    }
    if (
      provider === true &&
      (root === undefined || home !== undefined ||
        (serviceConfig === undefined && serviceReadiness !== undefined))
    ) {
      throw new CliArgumentError();
    }
    if (
      operation === "downgrade" &&
      (version === undefined || cliBundlePath === undefined)
    ) {
      throw new CliArgumentError();
    }
    if (providerService === true) {
      if (operation === "downgrade") throw new CliArgumentError();
      const installInputsInvalid =
        operation === "install" &&
        (serviceConfig === undefined || serviceKey === undefined);
      const upgradeInputsInvalid =
        operation === "upgrade" &&
        (serviceConfig === undefined ||
          serviceKey !== undefined ||
          serviceDescriptor !== undefined);
      const targetOnlyInputsInvalid =
        operation !== "install" &&
        operation !== "upgrade" &&
        (serviceConfig !== undefined ||
          serviceKey !== undefined ||
          serviceDescriptor !== undefined);
      if (
        root === undefined ||
        home !== undefined ||
        host !== undefined ||
        providerInstallationRoot !== undefined ||
        provider === true ||
        serviceManifest === undefined ||
        serviceReadiness !== undefined ||
        installInputsInvalid ||
        upgradeInputsInvalid ||
        targetOnlyInputsInvalid
      ) {
        throw new CliArgumentError();
      }
    }
    if (
      providerService !== true &&
      (serviceKey !== undefined ||
        serviceDescriptor !== undefined ||
        serviceManifest !== undefined)
    ) {
      throw new CliArgumentError();
    }
    if (
      provider !== true &&
      providerService !== true &&
      (serviceConfig !== undefined || serviceReadiness !== undefined)
    ) {
      throw new CliArgumentError();
    }
    if (
      operation === "doctor" &&
      host !== undefined &&
      (root !== undefined ||
        home !== undefined ||
        provider === true ||
        providerService === true ||
        serviceConfig !== undefined ||
        serviceReadiness !== undefined ||
        serviceKey !== undefined ||
        serviceDescriptor !== undefined ||
        serviceManifest !== undefined)
    ) {
      throw new CliArgumentError();
    }
    return {
      kind: "installation",
      operation,
      ...(root === undefined ? {} : { root }),
      ...(home === undefined ? {} : { home }),
      ...(host === undefined ? {} : { host }),
      ...(providerInstallationRoot === undefined
        ? {}
        : { providerInstallationRoot }),
      ...(version === undefined ? {} : { version }),
      ...(cliBundlePath === undefined ? {} : { cliBundlePath }),
      ...(provider === undefined ? {} : { provider }),
      ...(providerService === undefined ? {} : { providerService }),
      ...(serviceConfig === undefined ? {} : { serviceConfig }),
      ...(serviceReadiness === undefined ? {} : { serviceReadiness }),
      ...(serviceKey === undefined ? {} : { serviceKey }),
      ...(serviceDescriptor === undefined ? {} : { serviceDescriptor }),
      ...(serviceManifest === undefined ? {} : { serviceManifest }),
    };
  }
  if (values[0] !== "mcp") throw new CliArgumentError();

  let stdio = false;
  const rootCandidates: string[] = [];
  let hostInstallationRoot: string | undefined;
  for (let index = 1; index < values.length; index += 1) {
    const flag = values[index];
    if (flag === "--stdio") {
      if (stdio) throw new CliArgumentError();
      stdio = true;
      continue;
    }
    if (flag === "--root") {
      const root = values[index + 1];
      if (!safePathArgument(root) || root.startsWith("--")) {
        throw new CliArgumentError();
      }
      rootCandidates.push(root);
      index += 1;
      continue;
    }
    if (flag === "--installation-root") {
      const installationRoot = values[index + 1];
      if (
        hostInstallationRoot !== undefined ||
        !safePathArgument(installationRoot) ||
        !pathIsAbsolute(installationRoot)
      ) {
        throw new CliArgumentError();
      }
      hostInstallationRoot = installationRoot;
      index += 1;
      continue;
    }
    throw new CliArgumentError();
  }
  if (!stdio) throw new CliArgumentError();
  return {
    kind: "mcp",
    rootCandidates: Object.freeze(rootCandidates),
    ...(hostInstallationRoot === undefined
      ? {}
      : { hostInstallationRoot }),
  };
}

function pathIsAbsolute(value: string): boolean {
  // Keep argv parsing platform-neutral when the bundled CLI is exercised from
  // a different host than the build machine.
  return value.startsWith("/") || /^[A-Za-z]:[\\/]/u.test(value);
}

export function helpText(): string {
  return [
    "Understand Code",
    "",
    "Usage:",
    "  understand-code workbench --root <absolute-worktree-path> [--task-id <taskId>] [--no-open]",
    "  understand-code knowledge --root <absolute-worktree-path> --task-id <taskId> --guide",
    "  understand-code knowledge --root <absolute-worktree-path> --task-id <taskId> --prepare-file-docs",
    "  understand-code knowledge --root <absolute-worktree-path> --task-id <taskId> --discard-candidate --candidate <generationId>",
    "  understand-code knowledge --root <absolute-worktree-path> --task-id <taskId> --cleanup-interrupted",
    "  understand-code mcp --stdio --root <absolute-worktree-path> [--installation-root <absolute-host-installation-root>]",
    "  understand-code install [--root <absolute-install-root>|--home <absolute-install-home>] [--host codex|claude] [--provider-installation-root <absolute-provider-service-installation-root>]",
    "  understand-code upgrade [--root <absolute-install-root>|--home <absolute-install-home>] [--host codex|claude] [--provider-installation-root <absolute-provider-service-installation-root>]",
    "  understand-code downgrade --version <semver> --cli-bundle <absolute-cli-bundle> [--root <absolute-install-root>|--home <absolute-install-home>] [--host codex|claude] [--provider-installation-root <absolute-provider-service-installation-root>]",
    "  understand-code rollback [--root <absolute-install-root>|--home <absolute-install-home>]",
    "  understand-code doctor [--root <absolute-install-root>|--home <absolute-install-home>]",
    "  understand-code doctor --host codex|claude",
    "  understand-code doctor --provider --root <absolute-target-root> [--service-config <signed-config> [--service-readiness <path>]]",
    "  understand-code install --provider-service --root <absolute-runtime-root> --service-manifest <absolute-path> --service-config <signed-config> --service-key <pkcs8-key> [--service-descriptor <absolute-path>]",
    "  understand-code doctor --provider-service --root <absolute-runtime-root> --service-manifest <absolute-path>",
    "  understand-code upgrade --provider-service --root <absolute-runtime-root> --service-manifest <absolute-path> --service-config <signed-config>",
    "  understand-code rollback --provider-service --root <absolute-runtime-root> --service-manifest <absolute-path>",
    "  understand-code uninstall --provider-service --root <absolute-runtime-root> --service-manifest <absolute-path>",
    "  understand-code uninstall [--root <absolute-install-root>|--home <absolute-install-home>]",
    "  understand-code index --root <absolute-worktree-root> [--background|--status|--cancel] [--job-id <ULID>]",
    "  understand-code recover --root <absolute-worktree-root> --rebuild",
    "  understand-code recover --root <absolute-worktree-root> --restore <recovery-id>",
    "  understand-code knowledge --root <absolute-worktree-root> --task-id <ULID> --restart-draft",
    "  understand-code --help",
    "  understand-code --version",
    "",
  ].join("\n");
}
