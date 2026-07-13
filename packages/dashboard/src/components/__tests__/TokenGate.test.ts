// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TokenGate from "../TokenGate";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function mountTokenGate(onTokenValid = vi.fn()): Promise<{
  container: HTMLDivElement;
  root: Root;
  onTokenValid: ReturnType<typeof vi.fn>;
}> {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(createElement(TokenGate, { onTokenValid })));
  return { container, root, onTokenValid };
}

async function enterTokenAndSubmit(container: HTMLElement, token: string): Promise<void> {
  const input = container.querySelector<HTMLInputElement>('input[aria-label="访问令牌"]');
  if (!input) throw new Error("缺少访问令牌输入框");
  await act(async () => {
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    valueSetter?.call(input, token);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await Promise.resolve();
  });
  const form = container.querySelector("form");
  if (!form) throw new Error("缺少访问令牌表单");
  await act(async () => {
    form.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("TokenGate 简体中文交互", () => {
  it("显示中文标题、说明、输入提示和操作文案", async () => {
    const { container, root } = await mountTokenGate();

    expect(container.textContent).toContain("需要访问令牌");
    expect(container.textContent).toContain("请粘贴终端中显示的访问令牌");
    expect(container.querySelector('span[role="img"]')?.getAttribute("aria-label")).toBe("钥匙");
    expect(container.querySelector("input")?.getAttribute("placeholder")).toBe("在此粘贴访问令牌…");
    expect(container.querySelector('button[type="submit"]')?.textContent).toBe("继续");

    await act(async () => root.unmount());
  });

  it("使用中文反馈无效令牌并允许继续输入", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 403 }));
    const { container, root, onTokenValid } = await mountTokenGate();

    await enterTokenAndSubmit(container, "  invalid-token  ");

    expect(fetch).toHaveBeenCalledWith("/knowledge-graph.json?token=invalid-token");
    expect(container.textContent).toContain("访问令牌无效，请检查后重试。");
    expect(onTokenValid).not.toHaveBeenCalled();

    await act(async () => root.unmount());
  });

  it("使用中文反馈服务器异常和连接失败", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockRejectedValueOnce(new Error("offline"));
    const { container, root } = await mountTokenGate();

    await enterTokenAndSubmit(container, "server-error");
    expect(container.textContent).toContain("服务器返回异常状态（503）。请确认知识库服务正在运行。");

    await enterTokenAndSubmit(container, "offline");
    expect(container.textContent).toContain("无法连接服务器，请检查网络或确认知识库服务正在运行。");
    expect(container.textContent).not.toContain("offline");
    expect(warn).toHaveBeenCalledWith("访问令牌验证请求失败", expect.any(Error));

    await act(async () => root.unmount());
  });
});
