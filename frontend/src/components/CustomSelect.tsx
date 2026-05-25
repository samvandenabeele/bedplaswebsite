import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

type OptionValue = string | number;

type Option<T extends OptionValue> = { id: T; label: string };

type Props<T extends OptionValue> = {
  value: T | "";
  onChange: (next: T | "") => void;
  options: Option<T>[];
  placeholder?: string;
  disabled?: boolean;
};

export default function CustomSelect<T extends OptionValue>({
  value,
  onChange,
  options,
  placeholder = "Selecteer",
  disabled = false,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLUListElement | null>(null);
  const [panelStyle, setPanelStyle] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPanelStyle(null);
      return;
    }

    function updatePanelPosition() {
      if (!buttonRef.current) return;

      const rect = buttonRef.current.getBoundingClientRect();
      const viewportPadding = 8;
      const menuGap = 8;
      const maxMenuWidth = window.innerWidth - viewportPadding * 2;
      const estimatedMenuHeight = Math.min(224, options.length * 44 + 16);
      const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
      const spaceAbove = rect.top - viewportPadding;
      const fitsBelow = spaceBelow >= estimatedMenuHeight + menuGap;
      const fitsAbove = spaceAbove >= estimatedMenuHeight + menuGap;
      const shouldOpenAbove = !fitsBelow && fitsAbove;
      const maxHeight = Math.max(
        120,
        Math.min(
          estimatedMenuHeight,
          shouldOpenAbove ? spaceAbove - menuGap : spaceBelow - menuGap,
        ),
      );
      const width = Math.min(rect.width, maxMenuWidth);
      const left = Math.min(
        Math.max(viewportPadding, rect.left),
        window.innerWidth - viewportPadding - width,
      );
      const top = shouldOpenAbove
        ? Math.max(viewportPadding, rect.top - menuGap - maxHeight)
        : rect.bottom + menuGap;

      setPanelStyle({
        top,
        left,
        width,
        maxHeight,
      });
    }

    updatePanelPosition();
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);

    return () => {
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [open]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (
        e.target instanceof Node &&
        !ref.current.contains(e.target) &&
        !panelRef.current?.contains(e.target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const selected = options.find((o) => o.id === value);

  return (
    <div className="relative" ref={ref}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((s) => !s)}
        disabled={disabled}
        className={`w-full flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none transition focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-300/20 ${
          disabled ? "opacity-60 cursor-not-allowed" : ""
        }`}
      >
        <span className="truncate">
          {selected ? selected.label : placeholder}
        </span>

        <svg
          className="h-5 w-5 text-emerald-400"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M6 8l4 4 4-4"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && panelStyle
        ? createPortal(
            <ul
              ref={panelRef}
              role="listbox"
              className="fixed z-50 overflow-auto rounded-2xl border border-white/10 bg-slate-950/95 p-2 shadow-lg shadow-slate-950/40"
              style={{
                top: panelStyle.top,
                left: panelStyle.left,
                width: panelStyle.width,
                maxHeight: panelStyle.maxHeight,
              }}
            >
              {options.map((opt) => {
                const isSelected = opt.id === value;
                return (
                  <li
                    key={opt.id}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(opt.id);
                      setOpen(false);
                    }}
                    className={`cursor-pointer rounded-xl px-3 py-2 text-slate-100 hover:bg-white/5 ${
                      isSelected ? "bg-emerald-400/10 text-emerald-200" : ""
                    }`}
                  >
                    {opt.label}
                  </li>
                );
              })}
            </ul>,
            document.body,
          )
        : null}
    </div>
  );
}
