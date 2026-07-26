"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { api, ApiError } from "@/lib/api";
import { TopBar } from "@/components/topbar";
import { StatusBadge, ConfidentialityBadge } from "@/components/badges";
import { DocumentViewer } from "@/components/document-viewer";
import { useAuth } from "@/lib/auth-context";
import type { DocumentDetail, DocumentVersion, CommentItem } from "@/types/api";
import { DocumentStatus } from "@keyvantic/types";

const NEXT_STATUS: Record<DocumentStatus, DocumentStatus[]> = {
  DRAFT: [DocumentStatus.INTERNAL_REVIEW],
  INTERNAL_REVIEW: [DocumentStatus.APPROVED, DocumentStatus.DRAFT],
  APPROVED: [DocumentStatus.ARCHIVED, DocumentStatus.INTERNAL_REVIEW],
  ARCHIVED: [DocumentStatus.DRAFT],
};

type Tab = "content" | "versions" | "comments" | "relationships";

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("content");
  const [commentBody, setCommentBody] = useState("");

  const { data: doc, isLoading, error } = useQuery({
    queryKey: ["documents", id],
    queryFn: () => api.get<DocumentDetail>(`/documents/${id}`),
  });

  const { data: versions } = useQuery({
    queryKey: ["documents", id, "versions"],
    queryFn: () => api.get<DocumentVersion[]>(`/documents/${id}/versions`),
    enabled: tab === "versions",
  });

  const { data: comments } = useQuery({
    queryKey: ["documents", id, "comments"],
    queryFn: () => api.get<CommentItem[]>(`/documents/${id}/comments`),
    enabled: tab === "comments",
  });

  const statusMutation = useMutation({
    mutationFn: (status: DocumentStatus) => api.post(`/documents/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents", id] }),
  });

  const favoriteMutation = useMutation({
    mutationFn: () => api.post(`/documents/${id}/favorite`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents", id] }),
  });

  const commentMutation = useMutation({
    mutationFn: (body: string) => api.post(`/documents/${id}/comments`, { body }),
    onSuccess: () => {
      setCommentBody("");
      queryClient.invalidateQueries({ queryKey: ["documents", id, "comments"] });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (versionNumber: number) => api.post(`/documents/${id}/versions/${versionNumber}/restore`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", id] });
      queryClient.invalidateQueries({ queryKey: ["documents", id, "versions"] });
    },
  });

  if (error) {
    return (
      <>
        <TopBar title="Document" />
        <div className="p-6 text-sm text-red-600">{error instanceof ApiError ? error.message : "Failed to load document."}</div>
      </>
    );
  }

  if (isLoading || !doc) {
    return (
      <>
        <TopBar title="Document" />
        <div className="p-6 text-sm text-kv-slate">Loading document…</div>
      </>
    );
  }

  const latestVersion = doc.versions[0];

  return (
    <>
      <TopBar title={doc.title} />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs text-kv-slate">
              <span className="font-mono">{doc.code}</span>
              <span>·</span>
              <span>{doc.category.name}</span>
            </div>
            <h1 className="text-2xl font-semibold text-kv-navy dark:text-white">{doc.title}</h1>
            {doc.summary && <p className="mt-1 max-w-2xl text-sm text-kv-slate">{doc.summary}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => favoriteMutation.mutate()}
              className="rounded-md border border-kv-border px-3 py-1.5 text-xs font-medium text-kv-slate hover:bg-kv-mist dark:hover:bg-white/5"
            >
              ★ Favorite
            </button>
            {hasPermission("document:update") && (
              <Link
                href={`/documents/${doc.id}/edit`}
                className="rounded-md bg-kv-navy px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 dark:bg-kv-gold dark:text-kv-navy"
              >
                Edit
              </Link>
            )}
            {hasPermission("document:export") && (
              <div className="flex gap-1">
                {(["PDF", "DOCX", "MARKDOWN", "HTML"] as const).map((fmt) => (
                  <a
                    key={fmt}
                    href={`${process.env.NEXT_PUBLIC_API_URL}/documents/${doc.id}/export/${fmt}`}
                    className="rounded-md border border-kv-border px-2.5 py-1.5 text-xs text-kv-slate hover:bg-kv-mist dark:hover:bg-white/5"
                  >
                    {fmt}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <div>
            <div className="mb-4 flex gap-1 border-b border-kv-border">
              {(["content", "versions", "comments", "relationships"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3 py-2 text-sm capitalize transition ${
                    tab === t ? "border-b-2 border-kv-gold font-medium text-kv-navy dark:text-white" : "text-kv-slate"
                  }`}
                >
                  {t === "versions" ? "Version History" : t}
                </button>
              ))}
            </div>

            {tab === "content" && <DocumentViewer html={latestVersion?.contentHtml ?? ""} />}

            {tab === "versions" && (
              <div className="space-y-3">
                {versions?.map((v) => (
                  <div key={v.id} className="kv-card flex items-center justify-between p-4">
                    <div>
                      <p className="text-sm font-medium text-kv-navy dark:text-white">
                        v{v.versionNumber} {v.isRestoreOf ? `(restored from v${v.isRestoreOf})` : ""}
                      </p>
                      <p className="text-xs text-kv-slate">
                        {v.author.fullName} · {formatDistanceToNow(new Date(v.createdAt), { addSuffix: true })} · {v.wordCount} words
                      </p>
                      {v.changeSummary && <p className="mt-1 text-xs text-kv-slate">{v.changeSummary}</p>}
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href={`/documents/${doc.id}/versions/compare?from=${Math.max(1, v.versionNumber - 1)}&to=${v.versionNumber}`}
                        className="rounded-md border border-kv-border px-2.5 py-1 text-xs text-kv-slate hover:bg-kv-mist dark:hover:bg-white/5"
                      >
                        Compare
                      </Link>
                      {hasPermission("document:update") && v.versionNumber !== doc.currentVersionNumber && (
                        <button
                          onClick={() => restoreMutation.mutate(v.versionNumber)}
                          className="rounded-md border border-kv-border px-2.5 py-1 text-xs text-kv-slate hover:bg-kv-mist dark:hover:bg-white/5"
                        >
                          Restore
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === "comments" && (
              <div className="space-y-4">
                {hasPermission("comment:create") && (
                  <div className="kv-card p-4">
                    <textarea
                      value={commentBody}
                      onChange={(e) => setCommentBody(e.target.value)}
                      placeholder="Leave a review comment…"
                      rows={3}
                      className="w-full rounded-md border border-kv-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-kv-gold"
                    />
                    <button
                      onClick={() => commentBody.trim() && commentMutation.mutate(commentBody)}
                      className="mt-2 rounded-md bg-kv-navy px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 dark:bg-kv-gold dark:text-kv-navy"
                    >
                      Post comment
                    </button>
                  </div>
                )}
                {comments?.map((c) => (
                  <div key={c.id} className="kv-card p-4">
                    <p className="text-sm font-medium text-kv-navy dark:text-white">{c.author.fullName}</p>
                    <p className="mt-1 text-sm text-kv-slate">{c.body}</p>
                    <p className="mt-1 text-xs text-kv-slate">{formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}</p>
                  </div>
                ))}
                {comments?.length === 0 && <p className="text-sm text-kv-slate">No comments yet.</p>}
              </div>
            )}

            {tab === "relationships" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-kv-slate">Depends on / Relates to</h3>
                  <ul className="space-y-2">
                    {doc.relationshipsFrom.map((r) => (
                      <li key={r.id} className="kv-card p-3 text-sm">
                        <Link href={`/documents/${r.targetDocument.id}`} className="hover:underline">
                          {r.targetDocument.code} — {r.targetDocument.title}
                        </Link>
                        <p className="text-xs text-kv-slate">{r.type.replace(/_/g, " ")}</p>
                      </li>
                    ))}
                    {doc.relationshipsFrom.length === 0 && <p className="text-sm text-kv-slate">None recorded.</p>}
                  </ul>
                </div>
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-kv-slate">Referenced by</h3>
                  <ul className="space-y-2">
                    {doc.relationshipsTo.map((r) => (
                      <li key={r.id} className="kv-card p-3 text-sm">
                        <Link href={`/documents/${r.sourceDocument.id}`} className="hover:underline">
                          {r.sourceDocument.code} — {r.sourceDocument.title}
                        </Link>
                        <p className="text-xs text-kv-slate">{r.type.replace(/_/g, " ")}</p>
                      </li>
                    ))}
                    {doc.relationshipsTo.length === 0 && <p className="text-sm text-kv-slate">None recorded.</p>}
                  </ul>
                </div>
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="kv-card p-4 text-sm">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-kv-slate">Document Metadata</h3>
              <dl className="space-y-2">
                <Row label="Status"><StatusBadge status={doc.status} /></Row>
                <Row label="Confidentiality"><ConfidentialityBadge level={doc.confidentiality} /></Row>
                <Row label="Author">{doc.author.fullName}</Row>
                <Row label="Approver">{doc.approver?.fullName ?? "Unassigned"}</Row>
                <Row label="Version">v{doc.currentVersionNumber}</Row>
                <Row label="Read time">{doc.readTimeMinutes} min</Row>
                <Row label="Review date">{doc.reviewDate ? new Date(doc.reviewDate).toLocaleDateString() : "—"}</Row>
                <Row label="Comments">{doc._count.comments}</Row>
                <Row label="Views">{doc.viewCount}</Row>
              </dl>
              <div className="mt-3 flex flex-wrap gap-1">
                {doc.tags.map((t) => (
                  <span key={t.tag.id} className="rounded-full bg-kv-mist px-2 py-0.5 text-[11px] text-kv-slate dark:bg-white/5">
                    #{t.tag.name}
                  </span>
                ))}
              </div>
            </div>

            {hasPermission("document:submit_review") && (
              <div className="kv-card p-4">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-kv-slate">Status</h3>
                <div className="flex flex-wrap gap-2">
                  {NEXT_STATUS[doc.status].map((next) => (
                    <button
                      key={next}
                      onClick={() => statusMutation.mutate(next)}
                      disabled={next === DocumentStatus.APPROVED && !hasPermission("document:approve")}
                      className="rounded-md border border-kv-border px-2.5 py-1.5 text-xs text-kv-slate hover:bg-kv-mist disabled:opacity-40 dark:hover:bg-white/5"
                    >
                      Move to {next.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="kv-card p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-kv-slate">Approval History</h3>
              <ul className="space-y-2 text-xs">
                {doc.approvals.map((a) => (
                  <li key={a.id}>
                    <span className="font-medium text-kv-navy dark:text-white">{a.reviewer.fullName}</span> — {a.decision.toLowerCase()}
                    <p className="text-kv-slate">{formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}</p>
                  </li>
                ))}
                {doc.approvals.length === 0 && <p className="text-kv-slate">No approval activity yet.</p>}
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-kv-slate">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
