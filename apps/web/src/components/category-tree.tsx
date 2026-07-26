"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import type { CategoryNode } from "@/types/api";

function TreeNode({ node, depth }: { node: CategoryNode; depth: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(depth < 1);
  const active = pathname === `/library/${node.id}`;
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className={clsx(
          "flex items-center gap-1 rounded-md px-2 py-1.5 text-sm",
          active ? "bg-kv-navy text-white dark:bg-white/10" : "text-kv-navy hover:bg-kv-mist dark:text-white dark:hover:bg-white/5",
        )}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
      >
        {hasChildren ? (
          <button onClick={() => setOpen((v) => !v)} className="w-4 text-xs text-kv-slate">
            {open ? "▾" : "▸"}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <Link href={`/library/${node.id}`} className="flex-1 truncate">
          {node.name}
        </Link>
        <span className="text-xs text-kv-slate">{node._count.documents}</span>
      </div>
      {hasChildren && open && (
        <div>
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function CategoryTree({ tree }: { tree: CategoryNode[] }) {
  return (
    <div className="space-y-0.5">
      {tree.map((node) => (
        <TreeNode key={node.id} node={node} depth={0} />
      ))}
    </div>
  );
}
