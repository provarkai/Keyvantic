"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { TopBar } from "@/components/topbar";
import { GraphCanvas } from "@/components/graph-canvas";
import type { GraphEdge, GraphNode } from "@/types/api";

export default function GraphPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["graph"],
    queryFn: () => api.get<{ nodes: GraphNode[]; edges: GraphEdge[] }>("/graph"),
  });

  return (
    <>
      <TopBar title="Relationship Graph" />
      <div className="flex-1 overflow-y-auto p-6">
        <p className="mb-4 max-w-2xl text-sm text-kv-slate">
          How Keyvantic&apos;s institutional knowledge connects — from Brand Strategy through the Consulting Methodology and
          KEYSHIFT Framework to Proposal Templates and Client Deliverables. Click any node to open the document.
        </p>
        {isLoading || !data ? (
          <p className="text-sm text-kv-slate">Loading graph…</p>
        ) : (
          <GraphCanvas nodes={data.nodes} edges={data.edges} />
        )}
      </div>
    </>
  );
}
