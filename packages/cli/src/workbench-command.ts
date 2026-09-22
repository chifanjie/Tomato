import { execFile } from "node:child_process";
import { OpenWorkbenchOutputV1Schema } from "@understand-code/contracts";
import { closeAllWorkbenchSessionsV1 } from "@understand-code/workbench-runtime";
import type { CliInvocation } from "./argv.js";
import { resolveInitialBinding } from "./binding/root-binding.js";
import { callImplementedTool } from "./handlers/tools.js";

/** An explicit local reader process, independent of the chat Host's stdin. */
export async function runWorkbenchCommand(invocation: Extract<CliInvocation, { kind: "workbench" }>): Promise<void> {
  const binding = await resolveInitialBinding([invocation.root]);
  if (binding.kind !== "bound") throw new Error("workbench_root_unavailable: use the absolute Git worktree root");
  const output = await callImplementedTool("open_workbench", {
    route: { view: "tasks", section: "summary", ...(invocation.taskId ? { taskId: invocation.taskId } : {}) },
  }, binding.canonicalRoot, { runtimeProfile: "local_durable_v1" });
  const parsed = OpenWorkbenchOutputV1Schema.safeParse(output);
  if (!parsed.success) {
    process.stdout.write(`${JSON.stringify(output)}\n`);
    process.exitCode = 1;
    return;
  }
  const url = parsed.data.structuredContent.result.deepLink;
  process.stdout.write(`${JSON.stringify({ url, taskId: invocation.taskId ?? null, message: "Keep this process running while reading. Run the same command later to reopen persisted tasks. Stop with Ctrl+C." })}\n`);
  if (!invocation.noOpen) {
    const command = process.platform === "darwin" ? "open" : "xdg-open";
    const child = execFile(command, [url], (error) => {
      if (error) process.stderr.write("Could not open the browser; open the printed local URL.\n");
    });
    child.unref();
  }
  const stop = () => { void closeAllWorkbenchSessionsV1(); };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}
