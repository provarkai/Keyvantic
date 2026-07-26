"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { TopBar } from "@/components/topbar";
import { useAuth } from "@/lib/auth-context";

interface SearchHit {
  id: string;
  code: string;
  title: string;
  summary?: string | null;
  categoryName?: string;
  status: string;
  confidentiality: string;
  authorName: string;
  score?: number;
}

function SearchContent() {
  const searchParams = useSearchParams();
  const { hasPermission } = useAuth();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [mode, setMode] = useState<"fulltext" | "semantic">("fulltext");

  const { data, isFetching } = useQuery({
    queryKey: ["search", mode, q],
    queryFn: () => api.get<SearchHit[]>(`/search${mode === "semantic" ? "/semantic" : ""}?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length > 0,
  });

  return (
    <>
      <TopBar title="Enterprise Search" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by title, content, tag, framework name, or Document ID…"
            className="w-full max-w-lg rounded-md border border-kv-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-kv-gold"
          />
          <div className="flex rounded-md border border-kv-border p-0.5 text-xs">
            <button
              onClick={() => setMode("fulltext")}
              className={`rounded px-3 py-1.5 ${mode === "fulltext" ? "bg-kv-navy text-white dark:bg-kv-gold dark:text-kv-navy" : "text-kv-slate"}`}
            >
              Full-text
            </button>
            <button
              onClick={() => setMode("semantic")}
              disabled={!hasPermission("search:semantic")}
              className={`rounded px-3 py-1.5 disabled:opacity-40 ${mode === "semantic" ? "bg-kv-navy text-white dark:bg-kv-gold dark:text-kv-navy" : "text-kv-slate"}`}
            >
              Semantic
            </button>
          </div>
        </div>

        {isFetching && <p className="text-sm text-kv-slate">Searching…</p>}
        {!isFetching && q.trim() && data?.length === 0 && <p className="text-sm text-kv-slate">No results for &quot;{q}&quot;.</p>}

        <div className="space-y-3">
          {data?.map((hit) => (
            <Link key={hit.id} href={`/documents/${hit.id}`} className="kv-card block p-4 hover:border-kv-gold">
              <div className="mb-1 flex items-center justify-between text-xs text-kv-slate">
                <span className="font-mono">{hit.code}</span>
                <span>{hit.categoryName}</span>
              </div>
              <h3 className="text-sm font-semibold text-kv-navy dark:text-white">{hit.title}</h3>
              {hit.summary && <p className="mt-1 text-xs text-kv-slate">{hit.summary}</p>}
              <p className="mt-2 text-[11px] text-kv-slate">
                {hit.authorName} · {hit.status} · {hit.confidentiality}
                {typeof hit.score === "number" && ` · relevance ${(hit.score * 100).toFixed(0)}%`}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-kv-slate">Loading search…</div>}>
      <SearchContent />
    </Suspense>
  );
}
