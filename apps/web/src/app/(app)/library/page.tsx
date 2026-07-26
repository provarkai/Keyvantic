"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { TopBar } from "@/components/topbar";
import { CategoryTree } from "@/components/category-tree";
import type { CategoryNode } from "@/types/api";

export default function LibraryIndexPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["categories", "tree"],
    queryFn: () => api.get<CategoryNode[]>("/categories/tree"),
  });

  return (
    <>
      <TopBar title="Master Library" />
      <div className="flex-1 overflow-y-auto p-6">
        <p className="mb-4 max-w-2xl text-sm text-kv-slate">
          The complete Keyvantic Master Library — every strategy document, brand asset, advisory framework, research
          publication, and client record, organised into a single source of truth. Select a folder to browse its
          documents.
        </p>
        <div className="kv-card max-w-2xl p-4">
          {isLoading || !data ? <p className="text-sm text-kv-slate">Loading Master Library…</p> : <CategoryTree tree={data} />}
        </div>
      </div>
    </>
  );
}
