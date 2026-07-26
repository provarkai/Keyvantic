"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { GraphEdge, GraphNode } from "@/types/api";

const TYPE_COLORS: Record<string, string> = {
  RELATES_TO: "#5B6B7C",
  DEPENDS_ON: "#C9A24B",
  DERIVED_FROM: "#0B1D33",
  SUPERSEDES: "#B45309",
  REFERENCES: "#2563EB",
};

const NODE_W = 168;
const NODE_H = 56;
const COL_GAP = 240;
const ROW_GAP = 96;

/** Deterministic layered layout: nodes are grouped by category (column) and stacked (row) — simple and legible for a few hundred nodes, without a physics simulation dependency. */
function layout(nodes: GraphNode[]) {
  const categories = Array.from(new Set(nodes.map((n) => n.categoryId)));
  const columnIndex = new Map(categories.map((c, i) => [c, i]));
  const rowCounters = new Map<string, number>();

  return nodes.map((node) => {
    const col = columnIndex.get(node.categoryId) ?? 0;
    const row = rowCounters.get(node.categoryId) ?? 0;
    rowCounters.set(node.categoryId, row + 1);
    return { ...node, x: col * COL_GAP + 40, y: row * ROW_GAP + 40 };
  });
}

export function GraphCanvas({ nodes, edges }: { nodes: GraphNode[]; edges: GraphEdge[] }) {
  const router = useRouter();
  const [hovered, setHovered] = useState<string | null>(null);
  const positioned = useMemo(() => layout(nodes), [nodes]);
  const positionById = useMemo(() => new Map(positioned.map((n) => [n.id, n])), [positioned]);

  const width = Math.max(600, (Math.max(...positioned.map((n) => n.x)) || 0) + NODE_W + 40);
  const height = Math.max(400, (Math.max(...positioned.map((n) => n.y)) || 0) + NODE_H + 40);

  return (
    <div className="kv-card overflow-auto p-4" style={{ maxHeight: "70vh" }}>
      <svg width={width} height={height} className="min-w-full">
        <defs>
          {Object.entries(TYPE_COLORS).map(([type, color]) => (
            <marker key={type} id={`arrow-${type}`} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill={color} />
            </marker>
          ))}
        </defs>

        {edges.map((edge) => {
          const source = positionById.get(edge.source);
          const target = positionById.get(edge.target);
          if (!source || !target) return null;
          const x1 = source.x + NODE_W / 2;
          const y1 = source.y + NODE_H;
          const x2 = target.x + NODE_W / 2;
          const y2 = target.y;
          const dimmed = hovered && hovered !== edge.source && hovered !== edge.target;
          return (
            <path
              key={edge.id}
              d={`M${x1},${y1} C${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2}`}
              stroke={TYPE_COLORS[edge.type] ?? "#5B6B7C"}
              strokeWidth={1.5}
              fill="none"
              opacity={dimmed ? 0.12 : 0.8}
              markerEnd={`url(#arrow-${edge.type})`}
            />
          );
        })}

        {positioned.map((node) => (
          <g
            key={node.id}
            transform={`translate(${node.x}, ${node.y})`}
            className="cursor-pointer"
            onMouseEnter={() => setHovered(node.id)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => router.push(`/documents/${node.id}`)}
          >
            <rect
              width={NODE_W}
              height={NODE_H}
              rx={8}
              fill="var(--bg-elevated)"
              stroke={hovered === node.id ? "#C9A24B" : "var(--border)"}
              strokeWidth={hovered === node.id ? 2 : 1}
            />
            <text x={10} y={20} fontSize={10} fill="var(--text-muted)" fontFamily="monospace">
              {node.code}
            </text>
            <text x={10} y={38} fontSize={12} fill="var(--text)" fontWeight={500}>
              {node.title.length > 22 ? `${node.title.slice(0, 22)}…` : node.title}
            </text>
          </g>
        ))}
      </svg>

      <div className="mt-4 flex flex-wrap gap-3 text-xs text-kv-slate">
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <span key={type} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
            {type.replace(/_/g, " ")}
          </span>
        ))}
      </div>
    </div>
  );
}
