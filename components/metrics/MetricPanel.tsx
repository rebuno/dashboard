"use client";

import { useState, useEffect } from "react";

interface MetricPanelProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  expandedChildren?: React.ReactNode;
  className?: string;
}

export default function MetricPanel({ title, subtitle, children, expandedChildren, className = "" }: MetricPanelProps) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setExpanded(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [expanded]);

  return (
    <>
      <div
        onClick={() => setExpanded(true)}
        className={`bg-surface-1/30 border border-border p-4 flex flex-col overflow-hidden cursor-pointer hover:border-border-hover transition-colors duration-150 ${className}`}
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-[10px] font-mono text-gray-500 uppercase tracking-[0.2em]">
              {title}
            </h3>
            {subtitle && (
              <p className="text-[9px] font-mono text-gray-600 mt-0.5">{subtitle}</p>
            )}
          </div>
          <svg className="w-3 h-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9m11.25-5.25v4.5m0-4.5h-4.5m4.5 0L15 9m-11.25 11.25v-4.5m0 4.5h4.5m-4.5 0L9 15m11.25 5.25v-4.5m0 4.5h-4.5m4.5 0L15 15" />
          </svg>
        </div>
        <div className="flex-1 min-h-0">{children}</div>
      </div>

      {expanded && (
        <div
          className="fixed inset-0 z-40 bg-surface-0/90 flex items-center justify-center p-8 animate-fade-in"
          onClick={() => setExpanded(false)}
        >
          <div
            className="bg-surface-1 border border-border p-6 w-full max-w-5xl max-h-[85vh] flex flex-col animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 shrink-0">
              <div>
                <h3 className="text-[11px] font-mono text-gray-400 uppercase tracking-[0.2em]">
                  {title}
                </h3>
                {subtitle && (
                  <p className="text-[9px] font-mono text-gray-600 mt-0.5">{subtitle}</p>
                )}
              </div>
              <button
                onClick={() => setExpanded(false)}
                className="btn-ghost p-1.5"
                aria-label="Close"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 min-h-0">
              {expandedChildren || children}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
