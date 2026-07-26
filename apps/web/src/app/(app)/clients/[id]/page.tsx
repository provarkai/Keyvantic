"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { TopBar } from "@/components/topbar";
import { useAuth } from "@/lib/auth-context";

interface ClientDetail {
  id: string;
  name: string;
  industry?: string | null;
  primaryContact?: string | null;
  rootCategory: {
    id: string;
    name: string;
    children: { id: string; name: string; _count: { documents: number } }[];
  };
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["clients", id],
    queryFn: () => api.get<ClientDetail>(`/clients/${id}`),
  });

  if (isLoading || !data) {
    return (
      <>
        <TopBar title="Client" />
        <div className="p-6 text-sm text-kv-slate">Loading client…</div>
      </>
    );
  }

  return (
    <>
      <TopBar title={data.name} />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-kv-slate">
            {data.industry ?? "—"} {data.primaryContact ? `· Primary contact: ${data.primaryContact}` : ""}
          </p>
          {hasPermission("proposal:generate") && (
            <Link
              href={`/proposals/new?clientId=${id}`}
              className="rounded-md bg-kv-navy px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 dark:bg-kv-gold dark:text-kv-navy"
            >
              + New Proposal
            </Link>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.rootCategory.children.map((folder) => (
            <Link key={folder.id} href={`/library/${folder.id}`} className="kv-card block p-4 hover:border-kv-gold">
              <h3 className="text-sm font-semibold text-kv-navy dark:text-white">{folder.name}</h3>
              <p className="mt-1 text-xs text-kv-slate">{folder._count.documents} documents</p>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
