// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import TaskHome from "../TaskHome";
import { loadTaskDiscovery } from "../../../workbench/taskDiscovery";

vi.mock("../../../workbench/taskDiscovery", () => ({ loadTaskDiscovery: vi.fn(), launchTaskWorkbench: vi.fn() }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); document.body.replaceChildren(); });
const discovery = {
  schemaVersion: 1 as const, repository: { repoId: "repo:demo", name: "订单服务", status: "fresh" }, runtime: { kind: "local_durable_v1", ready: true },
  tasks: ["取消订单", "修复支付"].map((title, index) => ({ schemaVersion: 1 as const, taskId: `task:${index}`, title, originalIntent: `解释${title}流程`, status: index === 0 ? "verified" as const : "in_progress" as const, repositoryId: "repo:demo", worktreeId: "worktree:demo", baselineSnapshotId: "snapshot:one", latestSnapshotId: "snapshot:one", createdAt: "2026-09-21T00:00:00Z", updatedAt: "2026-09-21T00:00:00Z", producerVersion: "test", revision: 1 })),
};
function button(container: HTMLElement, text: string) { return [...container.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent === text)!; }
async function input(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(element.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, "value")!.set!.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
it("prepares the actual need, filters tasks and retains the successful list on refresh failure", async () => {
  vi.mocked(loadTaskDiscovery).mockResolvedValue({ status: "ready", value: discovery });
  const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
  const copy = vi.fn().mockResolvedValue(undefined); Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: copy } });
  try {
    await act(async () => root.render(createElement(TaskHome, { accessToken: "test", onTokenInvalid: vi.fn(), onOpenGraph: vi.fn(), onOpenKnowledge: vi.fn() })));
    expect(button(container, "复制启动指令").disabled).toBe(true);
    await input(container.querySelector<HTMLTextAreaElement>('textarea[placeholder]')!, "解释取消后退款规则");
    await act(async () => button(container, "复制启动指令").click());
    expect(copy).toHaveBeenCalledWith(expect.stringContaining("解释取消后退款规则"));
    expect(copy.mock.calls[0][0]).not.toContain("<填写需求>");
    expect(container.textContent).toContain("请在宿主中粘贴并发送指令");
    await input(container.querySelector<HTMLInputElement>('input[type="search"]')!, "支付");
    expect(container.querySelector("ul")?.textContent).toContain("修复支付");
    expect(container.querySelector("ul")?.textContent).not.toContain("取消订单");
    await input(container.querySelector<HTMLInputElement>('input[type="search"]')!, "");
    const select = container.querySelector("select")!;
    await act(async () => { select.value = "verified"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(container.querySelector("ul")?.textContent).toContain("取消订单");
    expect(container.querySelector("ul")?.textContent).not.toContain("修复支付");
    vi.mocked(loadTaskDiscovery).mockResolvedValue({ status: "unavailable", message: "暂时离线" });
    await act(async () => button(container, "刷新任务列表").click());
    expect(container.querySelector("ul")?.textContent).toContain("取消订单");
    expect(container.textContent).toContain("刷新失败，保留上次成功读取的列表");
  } finally { await act(async () => root.unmount()); }
});
