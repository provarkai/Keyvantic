"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ThemeToggle } from "./theme-toggle";
import { NotificationBell } from "./notification-bell";
import { useAuth } from "@/lib/auth-context";

export function TopBar({ title }: { title?: string }) {
  const { logout } = useAuth();
  const router = useRouter();
  const [q, setQ] = useState("");

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <header className="flex items-center justify-between gap-4 border-b border-kv-border px-6 py-3">
      <div className="min-w-0">
        {title && <h1 className="truncate text-lg font-semibold text-kv-navy dark:text-white">{title}</h1>}
      </div>

      <form onSubmit={handleSearch} className="mx-auto hidden max-w-md flex-1 md:block">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search the Master Library…"
          className="w-full rounded-md border border-kv-border bg-transparent px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-kv-gold"
        />
      </form>

      <div className="flex items-center gap-2">
        <NotificationBell />
        <ThemeToggle />
        <button
          onClick={() => logout()}
          className="rounded-md border border-kv-border px-3 py-1.5 text-xs font-medium text-kv-slate transition hover:bg-kv-mist dark:hover:bg-white/5"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
