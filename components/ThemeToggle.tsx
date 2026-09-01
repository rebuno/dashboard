"use client";

import { THEME_STORAGE_KEY } from "@/lib/theme";

export default function ThemeToggle() {
  function toggleTheme() {
    const root = document.documentElement;
    const isDark = root.classList.toggle("dark");
    root.style.colorScheme = isDark ? "dark" : "light";

    try {
      localStorage.setItem(THEME_STORAGE_KEY, isDark ? "dark" : "light");
    } catch {
      // The selected theme still applies for this page if storage is blocked.
    }
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        className="h-4 w-4 dark:hidden"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.75 6.75 0 0 0 21 12.8Z"
        />
      </svg>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        className="hidden h-4 w-4 dark:block"
      >
        <circle cx="12" cy="12" r="3.5" />
        <path
          strokeLinecap="round"
          d="M12 2.25v2M12 19.75v2M21.75 12h-2M4.25 12h-2M18.9 5.1l-1.4 1.4M6.5 17.5l-1.4 1.4M18.9 18.9l-1.4-1.4M6.5 6.5 5.1 5.1"
        />
      </svg>
      <span className="dark:hidden">Dark mode</span>
      <span className="hidden dark:inline">Light mode</span>
    </button>
  );
}
