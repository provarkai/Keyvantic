"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useAuth } from "@/lib/auth-context";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "▦" },
  { href: "/library", label: "Master Library", icon: "▤" },
  { href: "/search", label: "Search", icon: "⌕" },
  { href: "/graph", label: "Relationship Graph", icon: "◉" },
  { href: "/assistant", label: "AI Assistant", icon: "✦" },
  { href: "/proposals", label: "Proposals", icon: "▣" },
  { href: "/clients", label: "Clients", icon: "◫" },
  { href: "/notifications", label: "Notifications", icon: "◔" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, hasPermission } = useAuth();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-kv-border bg-kv-mist/60 dark:bg-white/[0.02] md:flex">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-kv-navy font-serif text-sm text-kv-gold dark:bg-kv-gold dark:text-kv-navy">
          K
        </div>
        <div>
          <p className="text-sm font-semibold leading-none text-kv-navy dark:text-white">Keyvantic</p>
          <p className="text-[11px] leading-none text-kv-slate">Knowledge OS</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        {NAV_ITEMS.map((item) => {
          const active = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition",
                active
                  ? "bg-kv-navy text-white dark:bg-white/10 dark:text-white"
                  : "text-kv-slate hover:bg-white hover:text-kv-navy dark:hover:bg-white/5 dark:hover:text-white",
              )}
            >
              <span className="w-4 text-center">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}

        {hasPermission("role:manage") && (
          <Link
            href="/admin/roles"
            className={clsx(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition",
              pathname?.startsWith("/admin")
                ? "bg-kv-navy text-white dark:bg-white/10 dark:text-white"
                : "text-kv-slate hover:bg-white hover:text-kv-navy dark:hover:bg-white/5 dark:hover:text-white",
            )}
          >
            <span className="w-4 text-center">⚙</span>
            Admin &amp; Roles
          </Link>
        )}
      </nav>

      <div className="border-t border-kv-border px-4 py-4 text-xs text-kv-slate">
        <p className="font-medium text-kv-navy dark:text-white">{user?.fullName}</p>
        <p>{user?.title ?? user?.role}</p>
      </div>
    </aside>
  );
}
