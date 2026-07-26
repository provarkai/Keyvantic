"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function NotificationBell() {
  const { data } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => api.get<number>("/notifications/unread-count"),
    refetchInterval: 30_000,
  });

  return (
    <Link
      href="/notifications"
      className="relative flex h-8 w-8 items-center justify-center rounded-md border border-kv-border text-kv-slate transition hover:bg-kv-mist dark:hover:bg-white/5"
      aria-label="Notifications"
    >
      ◔
      {Boolean(data) && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-kv-gold px-1 text-[10px] font-semibold text-kv-navy">
          {data}
        </span>
      )}
    </Link>
  );
}
