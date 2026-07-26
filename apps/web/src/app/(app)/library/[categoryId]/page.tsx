"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { TopBar } from "@/components/topbar";
import { CategoryTree } from "@/components/category-tree";
import { DocumentCard } from "@/components/document-card";
import { useAuth } from "@/lib/auth-context";
import type { CategoryNode, PaginatedResponse, DocumentSummary } from "@/types/api";

export default function CategoryPage() {
  const { categoryId } = useParams<{ categoryId: string }>();
  const { hasPermission } = useAuth();

  const { data: tree } = useQuery({
    queryKey: ["categories", "tree"],
    queryFn: () => api.get<CategoryNode[]>("/categories/tree"),
  });
  const { data: category } = useQuery({
    queryKey: ["categories", categoryId],
    queryFn: () => api.get<CategoryNode & { parent?: { id: string; name: string } }>(`/categories/${categoryId}`),
  });
  const { data: documents, isLoading } = useQuery({
    queryKey: ["documents", { categoryId }],
    queryFn: () => api.get<PaginatedResponse<DocumentSummary>>(`/documents?categoryId=${categoryId}&pageSize=50`),
  });

  return (
    <>
      <TopBar title={category?.name ?? "Master Library"} />
      <div className="flex flex-1 overflow-hidden">
        <div className="hidden w-64 shrink-0 overflow-y-auto border-r border-kv-border p-4 lg:block">
          {tree && <CategoryTree tree={tree} />}
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-kv-slate">{documents?.total ?? 0} documents</p>
            {hasPermission("document:create") && (
              <Link
                href={`/documents/new?categoryId=${categoryId}`}
                className="rounded-md bg-kv-navy px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 dark:bg-kv-gold dark:text-kv-navy"
              >
                + New Document
              </Link>
            )}
          </div>

          {isLoading || !documents ? (
            <p className="text-sm text-kv-slate">Loading documents…</p>
          ) : documents.data.length === 0 ? (
            <p className="text-sm text-kv-slate">No documents in this folder yet.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {documents.data.map((doc) => (
                <DocumentCard key={doc.id} doc={doc} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
