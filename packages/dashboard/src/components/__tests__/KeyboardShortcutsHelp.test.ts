// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import KeyboardShortcutsHelp from "../KeyboardShortcutsHelp";
import { I18nProvider } from "../../contexts/I18nContext";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("KeyboardShortcutsHelp", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("owns one modal, focuses its close action, traps Tab, and closes on Escape", async () => {
    const onClose = vi.fn();
    await act(async () => {
      root.render(createElement(
        I18nProvider,
        {
          language: "zh-CN",
          children: createElement(KeyboardShortcutsHelp, {
            shortcuts: [{
              key: "k",
              metaKey: true,
              description: "搜索知识库",
              category: "General",
              action: vi.fn(),
            }],
            onClose,
          }),
        },
      ));
    });

    const dialog = container.querySelector('[role="dialog"][aria-modal="true"]');
    const closeButton = container.querySelector('[aria-label="关闭快捷键帮助"]');
    expect(dialog?.getAttribute("aria-label")).toBe("快捷键帮助");
    expect(document.activeElement).toBe(closeButton);

    const outside = document.createElement("button");
    document.body.append(outside);
    outside.focus();
    const enterEvent = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    await act(async () => document.dispatchEvent(enterEvent));
    expect(enterEvent.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(closeButton);

    const reverseEvent = new KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    await act(async () => document.dispatchEvent(reverseEvent));
    expect(reverseEvent.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(closeButton);

    await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    })));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
