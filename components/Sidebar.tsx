"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import { checkHealth, listPendingApprovals } from "@/lib/api";
import { APPROVALS_POLL_INTERVAL, HEALTH_POLL_INTERVAL } from "@/lib/constants";
import { usePolling } from "@/lib/hooks";

const NAV_ITEMS = [
  { href: "/executions", label: "Executions", icon: "executions" },
  { href: "/approvals", label: "Approvals", icon: "approvals" },
  { href: "/agents", label: "Agents", icon: "agents" },
  { href: "/metrics", label: "Metrics", icon: "metrics" },
] as const;

function NavIcon({ name }: { name: (typeof NAV_ITEMS)[number]["icon"] }) {
  const paths = {
    executions: (
      <>
        <path d="M5 4.75h14v5.5H5zM5 13.75h14v5.5H5z" />
        <path d="M8 7.5h.01M8 16.5h.01" />
      </>
    ),
    approvals: (
      <>
        <path d="M12 3.75 19 6.5v5.25c0 4.2-2.75 7.2-7 8.5-4.25-1.3-7-4.3-7-8.5V6.5L12 3.75Z" />
        <path d="m8.75 12 2.1 2.1 4.4-4.45" />
      </>
    ),
    agents: (
      <>
        <circle cx="12" cy="8" r="3.25" />
        <path d="M5.5 20c.45-3.55 2.55-5.5 6.5-5.5s6.05 1.95 6.5 5.5" />
      </>
    ),
    metrics: (
      <path d="M5 19.25V12.5h3.25v6.75H5ZM10.4 19.25V8h3.2v11.25h-3.2ZM15.75 19.25V4.75H19v14.5h-3.25Z" />
    ),
  };

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.55"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px] shrink-0"
    >
      {paths[name]}
    </svg>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  usePolling(async () => {
    setConnected(await checkHealth());
  }, HEALTH_POLL_INTERVAL);

  usePolling(async () => {
    try {
      const approvals = await listPendingApprovals();
      setPendingCount(approvals.length);
    } catch {
      // Leave the last known count on a transient error.
    }
  }, APPROVALS_POLL_INTERVAL);

  function navLink(item: (typeof NAV_ITEMS)[number], mobile = false) {
    const active =
      pathname === item.href || pathname.startsWith(`${item.href}/`);

    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        aria-label={mobile ? item.label : undefined}
        title={mobile ? item.label : undefined}
        className={`group relative flex items-center rounded-md text-sm transition-colors ${
          mobile ? "h-9 gap-2 px-2 sm:px-3" : "h-10 justify-between px-3"
        } ${
          active
            ? "bg-accent-wash text-accent"
            : "text-ink-muted hover:bg-surface-muted hover:text-ink"
        }`}
      >
        <span className="flex items-center gap-3">
          <NavIcon name={item.icon} />
          <span className={mobile ? "hidden sm:inline" : undefined}>
            {item.label}
          </span>
        </span>
        {item.href === "/approvals" && pendingCount > 0 && (
          <span
            className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white ${
              mobile ? "absolute -right-0.5 -top-0.5 sm:static" : ""
            }`}
          >
            {pendingCount}
          </span>
        )}
      </Link>
    );
  }

  const connectionLabel =
    connected === null
      ? "Connecting"
      : connected
        ? "Kernel connected"
        : "Kernel disconnected";

  return (
    <>
      <aside className="hidden w-56 shrink-0 flex-col border-r border-line bg-surface md:flex">
        <div className="flex h-16 items-center px-5">
          <Image
            src="/rebuno-light.svg"
            alt="Rebuno"
            width={1200}
            height={548}
            className="h-7 w-auto dark:hidden"
            priority
          />
          <Image
            src="/rebuno-dark.svg"
            alt="Rebuno"
            width={1200}
            height={548}
            className="hidden h-7 w-auto dark:block"
            priority
          />
        </div>

        <nav
          className="flex-1 space-y-1 px-3 py-3"
          aria-label="Main navigation"
        >
          {NAV_ITEMS.map((item) => navLink(item))}
        </nav>

        <div className="space-y-1 border-t border-line p-3">
          <ThemeToggle />
          <div
            className="flex items-center gap-2.5 px-3 py-2 text-xs text-ink-muted"
            title={connectionLabel}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                connected === null
                  ? "bg-ink-faint"
                  : connected
                    ? "bg-emerald-500"
                    : "bg-red-500"
              }`}
            />
            {connectionLabel}
          </div>
        </div>
      </aside>

      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-3 md:hidden">
        <Link
          href="/executions"
          aria-label="Rebuno executions"
          className="mr-auto"
        >
          <Image
            src="/rebuno-light.svg"
            alt="Rebuno"
            width={1200}
            height={548}
            className="h-6 w-auto dark:hidden"
            priority
          />
          <Image
            src="/rebuno-dark.svg"
            alt="Rebuno"
            width={1200}
            height={548}
            className="hidden h-6 w-auto dark:block"
            priority
          />
        </Link>
        <nav className="flex items-center gap-0.5" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => navLink(item, true))}
        </nav>
        <ThemeToggle compact />
      </header>
    </>
  );
}
