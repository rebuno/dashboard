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
  { href: "/executions", label: "Executions" },
  { href: "/approvals", label: "Approvals" },
  { href: "/agents", label: "Agents" },
  { href: "/metrics", label: "Metrics" },
] as const;

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

  return (
    <aside className="w-56 shrink-0 border-r border-gray-200 bg-white flex flex-col dark:border-gray-800 dark:bg-gray-900">
      <div className="h-14 flex items-center px-4 border-b border-gray-200 dark:border-gray-800">
        <Image
          src="/rebuno-light.svg"
          alt="Rebuno"
          width={1200}
          height={548}
          className="h-8 w-auto dark:hidden"
          priority
        />
        <Image
          src="/rebuno-dark.svg"
          alt="Rebuno"
          width={1200}
          height={548}
          className="hidden h-8 w-auto dark:block"
          priority
        />
      </div>
      <nav className="flex-1 py-2">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between px-4 py-2 text-sm ${
                active
                  ? "bg-blue-50 text-blue-700 font-medium dark:bg-blue-950/50 dark:text-blue-300"
                  : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
              }`}
            >
              <span>{item.label}</span>
              {item.href === "/approvals" && pendingCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-red-600 text-white text-xs">
                  {pendingCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-gray-200 p-2 dark:border-gray-800">
        <ThemeToggle />
        <div className="flex items-center gap-2 px-2 py-2 text-xs text-gray-500 dark:text-gray-400">
          <span
            className={`w-2 h-2 rounded-full ${
              connected === null
                ? "bg-gray-300 dark:bg-gray-600"
                : connected
                  ? "bg-green-500"
                  : "bg-red-500"
            }`}
          />
          {connected === null
            ? "Connecting"
            : connected
              ? "Connected"
              : "Disconnected"}
        </div>
      </div>
    </aside>
  );
}
