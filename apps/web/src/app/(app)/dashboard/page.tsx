"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { api } from "@/lib/api";
import { TopBar } from "@/components/topbar";
import { StatTile } from "@/components/stat-tile";
import { StatusBadge } from "@/components/badges";
import type { DashboardStats } from "@/types/api";

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<DashboardStats>("/documents/dashboard"),
  });
  const { data: completion } = useQuery({
    queryKey: ["categories", "completion"],
    queryFn: () => api.get<{ percentage: number; completedFolders: number; totalFolders: number }>("/categories/completion"),
  });

  const maxCategoryCount = Math.max(1, ...(data?.byCategory.map((c) => c.count) ?? [1]));

  return (
    <>
      <TopBar title="Dashboard" />
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading || !data ? (
          <p className="text-sm text-kv-slate">Loading dashboard…</p>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <StatTile label="Total Documents" value={data.totalDocuments} />
              <StatTile label="Awaiting Approval" value={data.awaitingApproval.length} />
              <StatTile
                label="Master Library Completion"
                value={completion ? `${completion.percentage}%` : "—"}
                sublabel={completion ? `${completion.completedFolders}/${completion.totalFolders} folders have an approved doc` : undefined}
              />
              <StatTile label="Upcoming Reviews" value={data.upcomingReviews.length} sublabel="Next 30 days" />
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <section className="kv-card p-5 lg:col-span-1">
                <h2 className="mb-4 text-sm font-semibold text-kv-navy dark:text-white">Documents by Category</h2>
                <div className="space-y-3">
                  {data.byCategory.map((c) => (
                    <div key={c.categoryId}>
                      <div className="mb-1 flex justify-between text-xs text-kv-slate">
                        <span>{c.categoryName}</span>
                        <span>{c.count}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-kv-mist dark:bg-white/5">
                        <div
                          className="h-1.5 rounded-full bg-kv-gold"
                          style={{ width: `${(c.count / maxCategoryCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="kv-card p-5 lg:col-span-2">
                <h2 className="mb-4 text-sm font-semibold text-kv-navy dark:text-white">Recent Edits</h2>
                <ul className="divide-y divide-kv-border">
                  {data.recentEdits.map((doc) => (
                    <li key={doc.id} className="flex items-center justify-between py-2.5 text-sm">
                      <Link href={`/documents/${doc.id}`} className="min-w-0 truncate hover:underline">
                        <span className="mr-2 font-mono text-xs text-kv-slate">{doc.code}</span>
                        {doc.title}
                      </Link>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-xs text-kv-slate">{doc.author.fullName}</span>
                        <StatusBadge status={doc.status} />
                      </div>
                    </li>
                  ))}
                  {data.recentEdits.length === 0 && <p className="py-4 text-sm text-kv-slate">No recent activity yet.</p>}
                </ul>
              </section>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <section className="kv-card p-5">
                <h2 className="mb-4 text-sm font-semibold text-kv-navy dark:text-white">Awaiting Approval</h2>
                <ul className="space-y-2">
                  {data.awaitingApproval.map((doc) => (
                    <li key={doc.id} className="text-sm">
                      <Link href={`/documents/${doc.id}`} className="hover:underline">
                        <span className="mr-2 font-mono text-xs text-kv-slate">{doc.code}</span>
                        {doc.title}
                      </Link>
                      <p className="text-xs text-kv-slate">Approver: {doc.approver?.fullName ?? "Unassigned"}</p>
                    </li>
                  ))}
                  {data.awaitingApproval.length === 0 && <p className="text-sm text-kv-slate">Nothing pending review.</p>}
                </ul>
              </section>

              <section className="kv-card p-5">
                <h2 className="mb-4 text-sm font-semibold text-kv-navy dark:text-white">Recently Viewed</h2>
                <ul className="space-y-2">
                  {data.recentlyViewed.map((doc) => (
                    <li key={doc.id} className="text-sm">
                      <Link href={`/documents/${doc.id}`} className="hover:underline">
                        <span className="mr-2 font-mono text-xs text-kv-slate">{doc.code}</span>
                        {doc.title}
                      </Link>
                    </li>
                  ))}
                  {data.recentlyViewed.length === 0 && <p className="text-sm text-kv-slate">Browse the library to populate this.</p>}
                </ul>
              </section>

              <section className="kv-card p-5">
                <h2 className="mb-4 text-sm font-semibold text-kv-navy dark:text-white">Upcoming Reviews</h2>
                <ul className="space-y-2">
                  {data.upcomingReviews.map((doc) => (
                    <li key={doc.id} className="text-sm">
                      <Link href={`/documents/${doc.id}`} className="hover:underline">
                        <span className="mr-2 font-mono text-xs text-kv-slate">{doc.code}</span>
                        {doc.title}
                      </Link>
                      <p className="text-xs text-kv-slate">
                        Due {doc.reviewDate ? formatDistanceToNow(new Date(doc.reviewDate), { addSuffix: true }) : "—"}
                      </p>
                    </li>
                  ))}
                  {data.upcomingReviews.length === 0 && <p className="text-sm text-kv-slate">No reviews scheduled.</p>}
                </ul>
              </section>
            </div>

            <section className="kv-card p-5">
              <h2 className="mb-4 text-sm font-semibold text-kv-navy dark:text-white">Activity Feed</h2>
              <ul className="space-y-2">
                {data.activityFeed.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between text-sm">
                    <span>
                      <span className="font-medium text-kv-navy dark:text-white">{entry.actor?.fullName ?? "System"}</span>{" "}
                      <span className="text-kv-slate">{entry.action.toLowerCase().replace(/_/g, " ")}</span>{" "}
                      <span className="text-kv-slate">{entry.entityType}</span>
                    </span>
                    <span className="text-xs text-kv-slate">{formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}</span>
                  </li>
                ))}
                {data.activityFeed.length === 0 && <p className="text-sm text-kv-slate">No activity yet.</p>}
              </ul>
            </section>
          </div>
        )}
      </div>
    </>
  );
}
