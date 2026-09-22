import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import path from "node:path";

function displayCommand(command, args) {
  return [command, ...args].map((part) => /^[a-zA-Z0-9_./:@=-]+$/u.test(part)
    ? part : `'${part.replaceAll("'", "'\\''")}'`).join(" ");
}

export function hostInstallPlan(host, distRoot) {
  if (!new Set(["codex", "claude"]).has(host) || !path.isAbsolute(distRoot)) throw new Error("Choose --install-host codex or claude.");
  const marketplace = path.join(distRoot, "plugin-roots", host);
  const plugin = "understand-code@understand-code-alpha";
  return host === "codex" ? [
    ["codex", ["plugin", "marketplace", "add", marketplace, "--json"]],
    ["codex", ["plugin", "add", plugin, "--json"]],
  ] : [
    ["claude", ["plugin", "validate", "--strict", marketplace]],
    ["claude", ["plugin", "marketplace", "add", marketplace, "--scope", "user"]],
    ["claude", ["plugin", "install", plugin, "--scope", "user"]],
  ];
}

export function installPackagedHost(host, distRoot, run = (command, args) => execFileSync(command, args, { stdio: "inherit", timeout: 120_000 })) {
  const steps = hostInstallPlan(host, distRoot);
  try {
    if (!statSync(path.join(distRoot, "plugin-roots", host)).isDirectory()) throw new Error("not a directory");
  } catch {
    throw new Error("The packaged Host marketplace is missing or unreadable. Reinstall the Preview package, then retry --install-host.");
  }
  const doctor = [process.execPath, [path.join(distRoot, "understand-code.mjs"), "doctor", "--host", host]];
  const allSteps = [...steps, doctor];
  for (let index = 0; index < allSteps.length; index += 1) {
    const [command, args] = allSteps[index];
    try {
      run(command, args);
    } catch (error) {
      if (error?.code === "ENOENT" && command === host) {
        throw new Error(`The ${host} CLI is not available on PATH. Install or locate that Host CLI, then retry understand-code-preview --install-host ${host}.`);
      }
      const completed = index === steps.length
        ? "Plugin registration completed, but Doctor did not pass."
        : `Host installation stopped at step ${index + 1} of ${allSteps.length}.`;
      const remaining = allSteps.slice(index).map(([nextCommand, nextArgs]) => displayCommand(nextCommand, nextArgs)).join("\n");
      throw new Error(`${completed} Completed steps were preserved. Resolve the Host error above, then continue with these commands in order:\n${remaining}\nStart a new Host session only after Doctor passes.`);
    }
  }
  return `Installed and checked ${host}. Start a new Host session in the repository so its MCP tools are loaded.`;
}
