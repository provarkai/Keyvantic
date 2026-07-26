"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TopBar } from "@/components/topbar";
import { api, ApiError } from "@/lib/api";
import { ConfidentialityLevel } from "@keyvantic/types";
import type { DocumentDetail } from "@/types/api";

function NewDocumentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const categoryId = searchParams.get("categoryId") ?? "";

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [confidentiality, setConfidentiality] = useState<ConfidentialityLevel>(ConfidentialityLevel.INTERNAL);
  const [tags, setTags] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const doc = await api.post<DocumentDetail>("/documents", {
        title,
        summary,
        categoryId,
        confidentiality,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      });
      router.push(`/documents/${doc.id}/edit`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create document");
      setSubmitting(false);
    }
  }

  return (
    <>
      <TopBar title="New Document" />
      <div className="flex-1 overflow-y-auto p-6">
        <form onSubmit={handleSubmit} className="kv-card max-w-xl space-y-4 p-6">
          <div>
            <label className="mb-1 block text-xs font-medium text-kv-slate">Title</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-kv-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-kv-gold"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-kv-slate">Summary</label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-kv-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-kv-gold"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-kv-slate">Confidentiality</label>
            <select
              value={confidentiality}
              onChange={(e) => setConfidentiality(e.target.value as ConfidentialityLevel)}
              className="w-full rounded-md border border-kv-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-kv-gold"
            >
              {Object.values(ConfidentialityLevel).map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-kv-slate">Tags (comma separated)</label>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="strategy, brand, 2026"
              className="w-full rounded-md border border-kv-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-kv-gold"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting || !categoryId}
            className="rounded-md bg-kv-navy px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60 dark:bg-kv-gold dark:text-kv-navy"
          >
            {submitting ? "Creating…" : "Create & Open Editor"}
          </button>
          {!categoryId && <p className="text-xs text-red-600">Missing categoryId — create documents from a Master Library folder.</p>}
        </form>
      </div>
    </>
  );
}

export default function NewDocumentPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-kv-slate">Loading…</div>}>
      <NewDocumentForm />
    </Suspense>
  );
}
