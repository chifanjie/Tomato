// @vitest-environment happy-dom

import { Window } from "happy-dom";
import { StrictMode } from "react";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider, useTheme } from "../ThemeContext";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: new Window().localStorage,
});

function ThemeChoice() {
  const { setPreset } = useTheme();
  return createElement("button", {
    type: "button",
    onClick: () => setPreset("sage-paper"),
  }, "选择鼠尾草纸");
}

afterEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("ThemeProvider persistence", () => {
  it("does not persist the initial theme during StrictMode replay", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(createElement(
      StrictMode,
      null,
      createElement(
        ThemeProvider,
        { initialConfig: { presetId: "mist-blueprint" } },
        createElement(ThemeChoice),
      ),
    )));

    expect(setItem).not.toHaveBeenCalled();
    await act(async () => container.querySelector("button")?.click());
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(setItem).toHaveBeenCalledWith(
      "uc-theme",
      JSON.stringify({ version: 3, presetId: "sage-paper" }),
    );
    await act(async () => root.unmount());
  });
});
