import { useEffect, useRef, useState } from "react";

type Option = { id: number; label: string };

type Props = {
  value: number | "";
  onChange: (next: number | "") => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
};

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Selecteer",
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (e.target instanceof Node && !ref.current.contains(e.target)) {
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

      {open && (
        <ul
          role="listbox"
          className="absolute z-50 mt-2 max-h-56 w-full overflow-auto rounded-2xl border border-white/10 bg-slate-950/80 p-2 shadow-lg shadow-slate-950/40"
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
        </ul>
      )}
    </div>
  );
}
