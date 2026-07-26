"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { TopBar } from "@/components/topbar";
import { useAuth } from "@/lib/auth-context";

interface ClientSummary {
  id: string;
  name: string;
  industry?: string | null;
  status: string;
  primaryContact?: string | null;
  rootCategory: { id: string; name: string };
}

export default function ClientsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: () => api.get<ClientSummary[]>("/clients"),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post("/clients", { name, industry }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setShowForm(false);
      setName("");
      setIndustry("");
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Failed to create client"),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    createMutation.mutate();
  }

  return (
    <>
      <TopBar title="Clients" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-kv-slate">
            Every client&apos;s Company Profile, Discovery Notes, Deliverables, Reports, Meeting Notes, AI Opportunities and
            Transformation Roadmap live here.
          </p>
          {hasPermission("client:manage") && (
            <button
              onClick={() => setShowForm((v) => !v)}
              className="rounded-md bg-kv-navy px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 dark:bg-kv-gold dark:text-kv-navy"
            >
              + New Client
            </button>
          )}
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="kv-card mb-6 max-w-md space-y-3 p-4">
            <input
              required
              placeholder="Client name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-kv-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-kv-gold"
            />
            <input
              placeholder="Industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full rounded-md border border-kv-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-kv-gold"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="rounded-md bg-kv-navy px-4 py-2 text-sm font-medium text-white hover:opacity-90 dark:bg-kv-gold dark:text-kv-navy"
            >
              Create client &amp; sub-tree
            </button>
          </form>
        )}

        {isLoading || !data ? (
          <p className="text-sm text-kv-slate">Loading clients…</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((client) => (
              <Link key={client.id} href={`/clients/${client.id}`} className="kv-card block p-4 hover:border-kv-gold">
                <h3 className="text-sm font-semibold text-kv-navy dark:text-white">{client.name}</h3>
                <p className="text-xs text-kv-slate">{client.industry ?? "—"}</p>
                <p className="mt-2 text-xs text-kv-slate">{client.status}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
