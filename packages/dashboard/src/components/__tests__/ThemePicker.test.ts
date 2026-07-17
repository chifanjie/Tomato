// @vitest-environment happy-dom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Window } from "happy-dom";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "../../themes/ThemeContext";
import type { PresetId } from "../../themes/types";
import { ThemePicker } from "../ThemePicker";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: new Window().localStorage,
});

async function mountPicker(presetId: PresetId, disabled = false): Promise<{
  container: HTMLDivElement;
  root: Root;
}> {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(createElement(
      ThemeProvider,
      { initialConfig: { presetId } },
      createElement(ThemePicker, { disabled }),
    ));
  });
  return { container, root };
}

async function click(target: Element | null): Promise<void> {
  if (!(target instanceof HTMLElement)) throw new Error("missing click target");
  await act(async () => target.click());
}

async function keydown(key: string): Promise<void> {
  await act(async () => {
    const target = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : document;
    target.dispatchEvent(new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
    }));
  });
}

beforeEach(() => {
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    callback(16);
    return 1;
  });
});

afterEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("ThemePicker", () => {
it("opens a four-item radio menu and restores focus on Escape", async () => {
  const { container, root } = await mountPicker("technical-document");
  const trigger = container.querySelector('[aria-haspopup="menu"]') as HTMLButtonElement;
  expect(trigger.getAttribute("aria-label")).toBe("主题：技术文档 2.0");
  await click(trigger);

  const items = [...container.querySelectorAll('[role="menuitemradio"]')];
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  expect(items).toHaveLength(4);
  expect(items[0]?.getAttribute("aria-checked")).toBe("true");
  expect(document.activeElement).toBe(items[0]);
  expect(items.map((item) => item.getAttribute("tabindex"))).toEqual(["0", "-1", "-1", "-1"]);

  await keydown("ArrowUp");
  expect(document.activeElement).toBe(items[3]);
  expect(items.map((item) => item.getAttribute("tabindex"))).toEqual(["-1", "-1", "-1", "0"]);
  await keydown("Escape");
  expect(container.querySelector('[role="menu"]')).toBeNull();
  expect(document.activeElement).toBe(trigger);

  await act(async () => root.unmount());
});

it("removes arbitrary accent and heading controls", () => {
  const source = readFileSync(join(process.cwd(), "src/components/ThemePicker.tsx"), "utf8");
  expect(source).not.toMatch(/强调色|标题字体|衬线|等宽/);
});

it("chooses the focused theme with Enter", async () => {
  const { container, root } = await mountPicker("technical-document");
  const trigger = container.querySelector('[aria-haspopup="menu"]') as HTMLButtonElement;
  await click(trigger);
  await keydown("ArrowDown");
  await keydown("Enter");

  expect(container.querySelector('[role="menu"]')).toBeNull();
  expect(trigger.textContent).toContain("雾蓝蓝图");
  expect(document.activeElement).toBe(trigger);

  await act(async () => root.unmount());
});

it("chooses the focused theme with Space", async () => {
  const { container, root } = await mountPicker("technical-document");
  const trigger = container.querySelector('[aria-haspopup="menu"]') as HTMLButtonElement;
  await click(trigger);
  await keydown("ArrowUp");
  await keydown(" ");

  expect(container.querySelector('[role="menu"]')).toBeNull();
  expect(trigger.textContent).toContain("夜墨");
  expect(document.activeElement).toBe(trigger);
  await act(async () => root.unmount());
});

it("ignores keys from outside the menu and closes when focus leaves", async () => {
  const { container, root } = await mountPicker("technical-document");
  const trigger = container.querySelector('[aria-haspopup="menu"]') as HTMLButtonElement;
  const outside = document.createElement("button");
  document.body.append(outside);
  await click(trigger);

  const items = [...container.querySelectorAll<HTMLElement>('[role="menuitemradio"]')];
  expect(document.activeElement).toBe(items[0]);
  await act(async () => {
    outside.dispatchEvent(new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    }));
  });
  expect(document.activeElement).toBe(items[0]);

  await act(async () => outside.focus());
  expect(container.querySelector('[role="menu"]')).toBeNull();

  await act(async () => root.unmount());
});

it("closes when reverse tabbing from a menu item back to the trigger", async () => {
  const { container, root } = await mountPicker("technical-document");
  const trigger = container.querySelector('[aria-haspopup="menu"]') as HTMLButtonElement;
  await click(trigger);
  expect(document.activeElement).toBe(container.querySelector('[role="menuitemradio"]'));

  await act(async () => trigger.focus());

  expect(container.querySelector('[role="menu"]')).toBeNull();
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(trigger);
  await act(async () => root.unmount());
});

it("does not reopen when a pointer click moves focus from the menu to the trigger", async () => {
  const { container, root } = await mountPicker("technical-document");
  const trigger = container.querySelector('[aria-haspopup="menu"]') as HTMLButtonElement;
  await click(trigger);
  expect(document.activeElement).toBe(container.querySelector('[role="menuitemradio"]'));

  await act(async () => {
    trigger.dispatchEvent(new MouseEvent("mousedown", {
      bubbles: true,
      button: 0,
      detail: 1,
    }));
    trigger.focus();
    trigger.dispatchEvent(new MouseEvent("click", {
      bubbles: true,
      button: 0,
      detail: 1,
    }));
  });

  expect(container.querySelector('[role="menu"]')).toBeNull();
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(trigger);
  await act(async () => root.unmount());
});

it("removes the open menu while the surrounding header is inert", async () => {
  const { container, root } = await mountPicker("technical-document");
  const trigger = container.querySelector('[aria-haspopup="menu"]') as HTMLButtonElement;
  await click(trigger);
  expect(container.querySelector('[role="menu"]')).not.toBeNull();

  await act(async () => {
    root.render(createElement(
      ThemeProvider,
      { initialConfig: { presetId: "technical-document" } },
      createElement(ThemePicker, { disabled: true }),
    ));
  });
  expect(container.querySelector('[role="menu"]')).toBeNull();
  expect(trigger.disabled).toBe(true);

  await act(async () => root.unmount());
});
});
