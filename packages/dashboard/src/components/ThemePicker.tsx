import { useCallback, useEffect, useId, useRef, useState } from "react";
import { PRESETS, useTheme } from "../themes";

export function ThemePicker() {
  const { config, preset, setPreset } = useTheme();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const pickerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();

  const closeAndRestore = useCallback(() => {
    setOpen(false);
    queueMicrotask(() => triggerRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!open) return;
    const currentIndex = Math.max(
      0,
      PRESETS.findIndex((item) => item.id === config.presetId),
    );
    setActiveIndex(currentIndex);
    const frame = requestAnimationFrame(() => itemRefs.current[currentIndex]?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAndRestore();
        return;
      }
      const activeIndex = itemRefs.current.findIndex(
        (item) => item === document.activeElement,
      );
      if ((event.key === "Enter" || event.key === " ") && activeIndex >= 0) {
        event.preventDefault();
        setPreset(PRESETS[activeIndex]!.id);
        closeAndRestore();
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      const next = (activeIndex + delta + PRESETS.length) % PRESETS.length;
      setActiveIndex(next);
      itemRefs.current[next]?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closeAndRestore, config.presetId, open, setPreset]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (event.target instanceof Node && !pickerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  return (
    <div ref={pickerRef} className="uc-theme-picker">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        className="uc-theme-trigger"
        onClick={() => setOpen((value) => !value)}
      >
        <span>主题</span>
        <span className="uc-theme-trigger-current">{preset.name}</span>
      </button>

      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="选择主题"
          className="uc-theme-menu"
        >
          {PRESETS.map((item, index) => (
            <button
              key={item.id}
              ref={(node) => { itemRefs.current[index] = node; }}
              type="button"
              role="menuitemradio"
              aria-checked={item.id === config.presetId}
              tabIndex={index === activeIndex ? 0 : -1}
              data-theme-preview={item.id}
              className="uc-theme-option"
              onClick={() => {
                setPreset(item.id);
                closeAndRestore();
              }}
            >
              <span className="uc-theme-option-copy">
                <strong>{item.name}</strong>
                <span>{item.description}</span>
              </span>
              <span className="uc-theme-swatches" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
