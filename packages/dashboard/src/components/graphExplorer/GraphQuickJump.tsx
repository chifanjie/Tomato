import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  searchGraphQuickJump,
  type GraphNavigationIntent,
  type GraphQuickJumpItem,
} from "../../graphExplorer/graphQuickJump.js";

export interface GraphQuickJumpProps {
  items: readonly GraphQuickJumpItem[];
  onSelect: (intent: GraphNavigationIntent) => void;
}

export function GraphQuickJump({ items, onSelect }: GraphQuickJumpProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const inputId = useId();
  const listboxId = useId();
  const results = useMemo(() => searchGraphQuickJump(items, query), [items, query]);
  const activeResult = results[activeIndex] ?? null;
  const optionId = (index: number): string => `${listboxId}-option-${index}`;

  const closeAndRestore = useCallback(() => {
    setOpen(false);
    queueMicrotask(() => triggerRef.current?.focus());
  }, []);

  const choose = useCallback((item: GraphQuickJumpItem) => {
    onSelect(item.intent);
    setOpen(false);
    queueMicrotask(() => triggerRef.current?.focus());
  }, [onSelect]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    const onOutsidePointerDown = (event: MouseEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onOutsidePointerDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("mousedown", onOutsidePointerDown);
    };
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, items]);

  useEffect(() => {
    if (!open || !activeResult) return;
    optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, activeResult, open, results]);

  return (
    <div
      ref={rootRef}
      className="uc-graph-quick-jump"
      onBlur={(event) => {
        const nextTarget = event.relatedTarget;
        if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
        setOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        className="uc-graph-quick-jump-trigger"
        onClick={() => {
          setOpen((value) => !value);
          setQuery("");
          setActiveIndex(0);
        }}
      >
        <span>快速定位</span>
      </button>

      {open && (
        <section
          aria-label="快速定位图谱对象"
          className="uc-graph-quick-jump-popover"
        >
          <div className="uc-graph-quick-jump-search">
            <label htmlFor={inputId} className="sr-only">搜索图谱对象</label>
            <input
              ref={inputRef}
              id={inputId}
              role="combobox"
              aria-label="搜索图谱对象"
              aria-autocomplete="list"
              aria-expanded="true"
              aria-controls={listboxId}
              aria-activedescendant={activeResult ? optionId(activeIndex) : undefined}
              value={query}
              placeholder="输入名称、路径或对象 ID"
              className="uc-graph-quick-jump-input"
              onChange={(event) => setQuery(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (!["ArrowDown", "ArrowUp", "Enter", "Escape"].includes(event.key)) return;
                event.preventDefault();
                event.stopPropagation();
                if (event.key === "Escape") {
                  closeAndRestore();
                  return;
                }
                if (results.length === 0) return;
                if (event.key === "Enter") {
                  const item = results[activeIndex];
                  if (item) choose(item);
                  return;
                }
                const delta = event.key === "ArrowDown" ? 1 : -1;
                setActiveIndex((index) => (index + delta + results.length) % results.length);
              }}
            />
          </div>

          <div id={listboxId} role="listbox" aria-label="图谱对象" className="uc-graph-quick-jump-listbox">
            {results.length === 0 ? (
              <p role="status" aria-live="polite" className="uc-graph-quick-jump-empty">
                没有找到匹配的图谱对象
              </p>
            ) : results.map((item, index) => (
              <button
                key={item.id}
                ref={(node) => { optionRefs.current[index] = node; }}
                id={optionId(index)}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                tabIndex={-1}
                className="uc-graph-quick-jump-option"
                onMouseMove={() => setActiveIndex(index)}
                onClick={() => choose(item)}
              >
                <span className="uc-graph-quick-jump-type">
                  {item.typeLabel}
                </span>
                <span className="uc-graph-quick-jump-copy">
                  <strong>{item.label}</strong>
                  {item.path && <span>{item.path}</span>}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
