"use client";

import { useEffect, useState } from "react";
import { getSessionUser } from "@/lib/api";

export default function SignOut({ compact = false }: { compact?: boolean }) {
  const [user, setUser] = useState<string | null>(null);

  useEffect(() => {
    getSessionUser()
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  if (!user) return null;

  return (
    <form method="post" action="/auth/logout">
      <button
        type="submit"
        aria-label={`Sign out ${user}`}
        title={compact ? `Sign out ${user}` : undefined}
        className={`flex h-10 items-center rounded-md text-sm text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink ${
          compact ? "w-9 justify-center" : "w-full gap-3 px-3"
        }`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          className="h-4 w-4 shrink-0"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 4.5H5.75A1.75 1.75 0 0 0 4 6.25v11.5c0 .97.78 1.75 1.75 1.75H9M15 16.5l4.5-4.5L15 7.5M19.5 12H9"
          />
        </svg>
        {!compact && (
          <span className="min-w-0 text-left">
            <span className="block">Sign out</span>
            <span className="block truncate text-xs text-ink-faint">
              {user}
            </span>
          </span>
        )}
      </button>
    </form>
  );
}
