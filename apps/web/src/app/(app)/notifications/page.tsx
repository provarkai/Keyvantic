"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { api } from "@/lib/api";
import { TopBar } from "@/components/topbar";
import type { NotificationItem } from "@/types/api";

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get<NotificationItem[]>("/notifications"),
  });

  const markAllRead = useMutation({
    mutationFn: () => api.patch("/notifications/read-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    },
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    },
  });

  return (
    <>
      <TopBar title="Notifications" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-4 flex justify-end">
          <button
            onClick={() => markAllRead.mutate()}
            className="rounded-md border border-kv-border px-3 py-1.5 text-xs text-kv-slate hover:bg-kv-mist dark:hover:bg-white/5"
          >
            Mark all as read
          </button>
        </div>
        {isLoading || !data ? (
          <p className="text-sm text-kv-slate">Loading notifications…</p>
        ) : data.length === 0 ? (
          <p className="text-sm text-kv-slate">You&apos;re all caught up.</p>
        ) : (
          <div className="space-y-2">
            {data.map((n) => (
              <div
                key={n.id}
                className={`kv-card flex items-start justify-between gap-4 p-4 ${!n.readAt ? "border-kv-gold" : ""}`}
              >
                <div>
                  <p className="text-sm font-medium text-kv-navy dark:text-white">{n.title}</p>
                  {n.body && <p className="mt-0.5 text-xs text-kv-slate">{n.body}</p>}
                  <div className="mt-1 flex items-center gap-2 text-xs text-kv-slate">
                    <span>{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</span>
                    {n.document && (
                      <Link href={`/documents/${n.document.id}`} className="hover:underline">
                        {n.document.code}
                      </Link>
                    )}
                  </div>
                </div>
                {!n.readAt && (
                  <button
                    onClick={() => markRead.mutate(n.id)}
                    className="shrink-0 rounded-md border border-kv-border px-2 py-1 text-xs text-kv-slate hover:bg-kv-mist dark:hover:bg-white/5"
                  >
                    Mark read
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
