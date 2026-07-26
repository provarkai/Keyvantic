import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { StatusBadge, ConfidentialityBadge } from "./badges";
import type { DocumentSummary } from "@/types/api";

export function DocumentCard({ doc }: { doc: DocumentSummary }) {
  return (
    <Link href={`/documents/${doc.id}`} className="kv-card block p-4 transition hover:border-kv-gold">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-xs text-kv-slate">{doc.code}</span>
        <StatusBadge status={doc.status} />
      </div>
      <h3 className="mb-1 line-clamp-2 text-sm font-semibold text-kv-navy dark:text-white">{doc.title}</h3>
      {doc.summary && <p className="mb-3 line-clamp-2 text-xs text-kv-slate">{doc.summary}</p>}
      <div className="flex items-center justify-between text-xs text-kv-slate">
        <span>{doc.author.fullName}</span>
        <ConfidentialityBadge level={doc.confidentiality} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {doc.tags.slice(0, 3).map((t) => (
          <span key={t.tag.id} className="rounded-full bg-kv-mist px-2 py-0.5 text-[11px] text-kv-slate dark:bg-white/5">
            #{t.tag.name}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-kv-slate">
        Updated {formatDistanceToNow(new Date(doc.updatedAt), { addSuffix: true })} · v{doc.currentVersionNumber} · {doc.readTimeMinutes} min read
      </p>
    </Link>
  );
}
