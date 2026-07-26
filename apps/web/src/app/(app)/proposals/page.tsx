"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { api } from "@/lib/api";
import { TopBar } from "@/components/topbar";
import { StatusBadge } from "@/components/badges";
import { useAuth } from "@/lib/auth-context";
import type { ProposalRun } from "@/types/api";

const RUN_STATUS_LABEL: Record<ProposalRun["status"], string> = {
  GENERATING: "Generating…",
  DRAFTED: "Drafted",
  FAILED: "Failed",
};

export default function ProposalsPage() {
  const { hasPermission } = useAuth();
  const { data: runs, isLoading } = useQuery({
    queryKey: ["proposals", "runs"],
    queryFn: () => api.get<ProposalRun[]>("/proposals/runs"),
  });

  return (
    <>
      <TopBar title="Proposal Generator" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-kv-slate">Every AI-drafted proposal, and which approved documents it drew from.</p>
          {hasPermission("proposal:generate") && (
            <Link
              href="/proposals/new"
              className="rounded-md bg-kv-navy px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 dark:bg-kv-gold dark:text-kv-navy"
            >
              + New Proposal
            </Link>
          )}
        </div>

        {isLoading || !runs ? (
          <p className="text-sm text-kv-slate">Loading runs…</p>
        ) : runs.length === 0 ? (
          <p className="text-sm text-kv-slate">No proposals generated yet.</p>
        ) : (
          <div className="space-y-2">
            {runs.map((run) => (
              <div key={run.id} className="kv-card flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-kv-navy dark:text-white">
                    {run.client.name} — {run.templateDoc.title}
                  </p>
                  <p className="text-xs text-kv-slate">
                    Requested by {run.requestedBy.fullName} · {formatDistanceToNow(new Date(run.createdAt), { addSuffix: true })}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {run.status === "DRAFTED" && run.resultDocument ? (
                    <>
                      <StatusBadge status={run.resultDocument.status} />
                      <Link
                        href={`/documents/${run.resultDocument.id}`}
                        className="text-xs font-medium text-kv-navy hover:underline dark:text-kv-gold"
                      >
                        {run.resultDocument.code}
                      </Link>
                    </>
                  ) : (
                    <span className="text-xs text-kv-slate">{RUN_STATUS_LABEL[run.status]}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
