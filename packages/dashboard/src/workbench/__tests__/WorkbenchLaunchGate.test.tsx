// @vitest-environment happy-dom
import { StrictMode, act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
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
    const fetcher = vi.fn(() => new Promise<Response>((done) => { resolve = done; }));
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
