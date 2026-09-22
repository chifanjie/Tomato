// @vitest-environment happy-dom
import { StrictMode, act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkbenchRouteV1Schema } from "@understand-code/contracts/mcp";
import WorkbenchLaunchGate from "../WorkbenchLaunchGate";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
let container: HTMLDivElement;
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  container?.remove();
  history.replaceState(null, "", "/");
  vi.unstubAllGlobals();
});
async function mount(reload: () => void) {
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  const tree = () => createElement(StrictMode, null, createElement(WorkbenchLaunchGate, { reload, children: createElement("p", null, "Task application") }));
  await act(async () => root!.render(tree()));
  return async () => act(async () => root!.render(tree()));
}

describe("explicit Workbench launch grants", () => {
  it("redeems a fresh grant once under StrictMode before mounting over an existing cookie", async () => {
    const token = "A".repeat(43);
    history.replaceState(null, "", `/workbench?view=tasks#${token}`);
    document.cookie = "workbench_session=old-snapshot-session; path=/";
    let resolve!: (response: Response) => void;
    const fetcher = vi.fn(() => new Promise<Response>((done) => { resolve = done; }));
    vi.stubGlobal("fetch", fetcher);
    const reload = vi.fn();
    const rerender = await mount(reload);
    await rerender();
    expect(container.textContent).toContain("正在连接");
    expect(container.textContent).not.toContain("Task application");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith("/__workbench/launch", expect.objectContaining({ method: "POST", credentials: "same-origin", body: JSON.stringify({ token }) }));
    await act(async () => resolve(new Response("{}", { status: 200 })));
    expect(reload).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe("");
    expect(container.textContent).toContain("Task application");
  });
  it("processes a new grant on same-document hash navigation and shows invalid grants explicitly", async () => {
    history.replaceState(null, "", "/workbench?view=tasks");
    let resolve!: (response: Response) => void;
    const fetcher = vi.fn().mockImplementationOnce(() => new Promise<Response>((done) => { resolve = done; }))
      .mockResolvedValue(new Response("{}", { status: 401 }));
    vi.stubGlobal("fetch", fetcher);
    const reload = vi.fn();
    await mount(reload);
    expect(fetcher).not.toHaveBeenCalled();
    await act(async () => {
      history.replaceState(null, "", `/workbench?view=tasks#${"B".repeat(43)}`);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    await act(async () => resolve(new Response("{}", { status: 401 })));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("链接已失效");
    expect(container.textContent).not.toContain("Task application");
    expect(window.location.hash).toBe("");
    expect(reload).not.toHaveBeenCalled();
  });
  it("reuses a matching authorized session when an old launch link is reopened", async () => {
    const route = { view: "graph", taskId: "6V170NHMWKT4C3A5KPQB8DCQC3" };
    expect(WorkbenchRouteV1Schema.safeParse(route).success).toBe(true);
    const target = `/workbench?view=graph&taskId=${route.taskId}`;
    history.replaceState(null, "", `${target}#${"H".repeat(43)}`);
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response("{}", { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ route }), {
        status: 200, headers: { "content-type": "application/json; charset=utf-8" },
      }));
    vi.stubGlobal("fetch", fetcher);
    const reload = vi.fn();
    await mount(reload);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenNthCalledWith(2, target, {
      credentials: "same-origin", headers: { accept: "application/json" }, cache: "no-store",
    });
    expect(reload).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe("");
    expect(container.textContent).toContain("Task application");
  });
  it("does not reuse an authorized graph session belonging to a different Task", async () => {
    const requested = { view: "graph", taskId: "6V170NHMWKT4C3A5KPQB8DCQC3" };
    const granted = { view: "graph", taskId: "01ARZ3NDEKTSV4RRFFQ69G5FAV" };
    expect(WorkbenchRouteV1Schema.safeParse(requested).success).toBe(true);
    expect(WorkbenchRouteV1Schema.safeParse(granted).success).toBe(true);
    history.replaceState(null, "", `/workbench?view=graph&taskId=${requested.taskId}#${"I".repeat(43)}`);
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response("{}", { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ route: granted }), {
        status: 200, headers: { "content-type": "application/json; charset=utf-8" },
      }));
    vi.stubGlobal("fetch", fetcher);
    const reload = vi.fn();
    await mount(reload);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(reload).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("链接已失效");
    expect(container.textContent).not.toContain("Task application");
  });
  it.each([
    { name: "another route", status: 409, body: "{}", type: "application/json" },
    { name: "expired session", status: 401, body: "{}", type: "application/json" },
    { name: "missing session returning bootstrap HTML", status: 200, body: "<!doctype html><p>Connect</p>", type: "text/html" },
    { name: "mismatched route in a JSON success", status: 200, body: '{"route":{"view":"graph"}}', type: "application/json" },
    { name: "malformed session JSON", status: 200, body: "not-json", type: "application/json" },
    { name: "session request network failure", network: true },
    { name: "launch service error", launchStatus: 503 },
    { name: "launch network failure", launchNetwork: true },
  ])("does not reuse $name after a failed launch", async (scenario) => {
    const token = Buffer.from(scenario.name).toString("base64url").padEnd(43, "X").slice(0, 43);
    history.replaceState(null, "", `/workbench?view=knowledge#${token}`);
    const fetcher = vi.fn();
    if ("launchNetwork" in scenario) fetcher.mockRejectedValueOnce(new TypeError("network error"));
    else fetcher.mockResolvedValueOnce(new Response("{}", { status: "launchStatus" in scenario ? scenario.launchStatus : 401 }));
    if ("network" in scenario) fetcher.mockRejectedValueOnce(new TypeError("network error"));
    else if ("status" in scenario && typeof scenario.type === "string") fetcher.mockResolvedValueOnce(new Response(scenario.body, { status: scenario.status, headers: { "content-type": scenario.type } }));
    vi.stubGlobal("fetch", fetcher);
    const reload = vi.fn();
    await mount(reload);
    expect(fetcher).toHaveBeenCalledTimes("launchStatus" in scenario || "launchNetwork" in scenario ? 1 : 2);
    expect(reload).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("链接已失效");
    expect(container.textContent).not.toContain("Task application");
  });
  it("does not consume cleared bootstrap tokens, Wiki anchors or tokens outside Workbench", async () => {
    history.replaceState(null, "", "/workbench#graph");
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await mount(vi.fn());
    await act(async () => {
      history.replaceState(null, "", "/workbench");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
      history.replaceState(null, "", `/other#${"C".repeat(43)}`);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(fetcher).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Task application");
  });
  it("does not clear a newer URL when an earlier grant settles before hashchange is processed", async () => {
    const first = "D".repeat(43), latest = "E".repeat(43);
    history.replaceState(null, "", `/workbench#${first}`);
    const resolvers: Array<(response: Response) => void> = [];
    const fetcher = vi.fn(() => new Promise<Response>((resolve) => resolvers.push(resolve)));
    vi.stubGlobal("fetch", fetcher);
    const reload = vi.fn(); await mount(reload);
    await act(async () => {
      history.replaceState(null, "", `/workbench#${latest}`);
      resolvers[0]!(new Response("{}", { status: 200 }));
    });
    expect(reload).not.toHaveBeenCalled();
    expect(window.location.hash).toBe(`#${latest}`);
    await act(async () => window.dispatchEvent(new HashChangeEvent("hashchange")));
    expect(fetcher).toHaveBeenCalledTimes(2);
    await act(async () => resolvers[1]!(new Response("{}", { status: 200 })));
    expect(reload).toHaveBeenCalledTimes(1);
  });
  it("serializes overlapping grants so an older response cannot overwrite the latest cookie", async () => {
    history.replaceState(null, "", `/workbench#${"F".repeat(43)}`);
    const resolvers: Array<(response: Response) => void> = [];
    const fetcher = vi.fn(() => new Promise<Response>((resolve) => resolvers.push(resolve)));
    vi.stubGlobal("fetch", fetcher);
    const reload = vi.fn(); await mount(reload);
    await act(async () => {
      history.replaceState(null, "", `/workbench#${"G".repeat(43)}`);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    await act(async () => resolvers[0]!(new Response("{}", { status: 200 })));
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(reload).not.toHaveBeenCalled();
    await act(async () => resolvers[1]!(new Response("{}", { status: 200 })));
    expect(reload).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe("");
  });
});
