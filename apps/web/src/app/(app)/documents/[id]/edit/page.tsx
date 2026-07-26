"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { api, ApiError } from "@/lib/api";
import { TopBar } from "@/components/topbar";
import type { DocumentDetail } from "@/types/api";

const RichEditor = dynamic(() => import("@/components/rich-editor/rich-editor").then((m) => m.RichEditor), {
  ssr: false,
  loading: () => <div className="kv-card p-6 text-sm text-kv-slate">Loading editor…</div>,
});

export default function EditDocumentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: doc, isLoading } = useQuery({
    queryKey: ["documents", id],
    queryFn: () => api.get<DocumentDetail>(`/documents/${id}`),
  });

  const [html, setHtml] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState("");
  const [changeSummary, setChangeSummary] = useState("");
  const [error, setError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.post(`/documents/${id}/versions`, {
        contentHtml: html,
        contentMarkdown: markdown,
        changeSummary: changeSummary || "Updated content",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", id] });
      router.push(`/documents/${id}`);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Failed to save version"),
  });

  if (isLoading || !doc) {
    return (
      <>
        <TopBar title="Editor" />
        <div className="p-6 text-sm text-kv-slate">Loading…</div>
      </>
    );
  }

  const currentHtml = html ?? doc.versions[0]?.contentHtml ?? "<p></p>";

  return (
    <>
      <TopBar title={`Editing — ${doc.title}`} />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <input
            value={changeSummary}
            onChange={(e) => setChangeSummary(e.target.value)}
            placeholder="Describe what changed in this version…"
            className="w-full max-w-md rounded-md border border-kv-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-kv-gold"
          />
          <div className="flex gap-2">
            <button
              onClick={() => router.push(`/documents/${id}`)}
              className="rounded-md border border-kv-border px-4 py-2 text-sm text-kv-slate hover:bg-kv-mist dark:hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="rounded-md bg-kv-navy px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60 dark:bg-kv-gold dark:text-kv-navy"
            >
              {saveMutation.isPending ? "Saving…" : `Save as v${doc.currentVersionNumber + 1}`}
            </button>
          </div>
        </div>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <RichEditor
          contentHtml={currentHtml}
          onChange={(nextHtml, nextMarkdown) => {
            setHtml(nextHtml);
            setMarkdown(nextMarkdown);
          }}
        />
      </div>
    </>
  );
}
