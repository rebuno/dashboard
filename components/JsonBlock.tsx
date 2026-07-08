"use client";

import { useState } from "react";

export default function JsonBlock({ label, value }: { label: string; value: unknown }) {
  const [open, setOpen] = useState(false);
  if (value == null) return null;
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-xs font-medium text-gray-500 uppercase tracking-wide hover:text-gray-700"
      >
        {open ? "▾" : "▸"} {label}
      </button>
      {open && (
        <pre className="mt-1 text-xs bg-gray-50 border border-gray-200 rounded p-2 whitespace-pre-wrap break-all max-h-64 overflow-y-auto">
          {JSON.stringify(value, null, 2)}
        </pre>
      )}
    </div>
  );
}
