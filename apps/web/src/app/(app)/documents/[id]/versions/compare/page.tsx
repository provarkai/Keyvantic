"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { TopBar } from "@/components/topbar";
import { DiffViewer } from "@/components/diff-viewer";

interface CompareResult {
  from: { versionNumber: number; changeSummary?: string | null };
  to: { versionNumber: number; changeSummary?: string | null };
  diff: { type: "equal" | "added" | "removed"; line: string }[];
}

function CompareContent() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "1";
  const to = searchParams.get("to") ?? "1";

  const { data, isLoading } = useQuery({
    queryKey: ["documents", id, "compare", from, to],
    queryFn: () => api.get<CompareResult>(`/documents/${id}/versions/compare?from=${from}&to=${to}`),
  });

  return (
    <>
      <TopBar title={`Compare v${from} → v${to}`} />
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading || !data ? (
          <p className="text-sm text-kv-slate">Loading comparison…</p>
        ) : (
          <>
            <p className="mb-4 text-sm text-kv-slate">
              Comparing v{data.from.versionNumber} ({data.from.changeSummary ?? "no summary"}) with v{data.to.versionNumber} (
              {data.to.changeSummary ?? "no summary"}).
            </p>
            <DiffViewer diff={data.diff} />
          </>
        )}
      </div>
    </>
  );
}

export default function CompareVersionsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-kv-slate">Loading…</div>}>
      <CompareContent />
    </Suspense>
  );
}
