/** Registration and an initialized MCP conversation are separate observations. */
export function localRuntimeCapabilitiesV1(repositoryArtifacts: "ready" | "not_ready" | "not_checked" = "not_checked") {
  const supported = process.platform === "darwin" || process.platform === "linux";
  return {
    runtimeProfile: "local_durable_v1" as const,
    platform: process.platform,
    localTasks: supported ? "available" as const : "unsupported" as const,
    providerStrongWrites: "locked" as const,
    sessionConnection: "not_checked" as const,
    repositoryArtifacts,
    taskBackend: !supported ? "unsupported" as const : repositoryArtifacts === "ready" ? "ready" as const : "initialization_required" as const,
    nextAction: !supported
      ? "Use macOS or Linux for the local Task runtime."
      : "Open a new Codex or Claude session in the target repository and ask it to call build_task_brief for your goal. A successful tools/call confirms this session is connected; host registration alone does not.",
  };
}
