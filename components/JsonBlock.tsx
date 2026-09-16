"use client";

import { useState } from "react";

export default function JsonBlock({
  label,
  value,
}: {
  label: string;
  value: unknown;
}) {
  const [open, setOpen] = useState(false);
  if (value == null) return null;
  return (
    <div className="text-xs">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 py-0.5 font-medium text-ink-muted transition-colors hover:text-ink"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className={`h-3 w-3 transition-transform ${open ? "rotate-90" : ""}`}
        >
          <path d="m4.25 2.5 3.5 3.5-3.5 3.5" />
        </svg>
        {label}
      </button>
      {open && (
        <pre className="mt-1.5 max-h-64 overflow-y-auto whitespace-pre-wrap break-all rounded-md border border-line bg-canvas p-3 font-mono text-[11px] leading-relaxed text-ink-soft">
          {JSON.stringify(value, null, 2)}
        </pre>
      )}
    </div>
  );
}
