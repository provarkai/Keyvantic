"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { TopBar } from "@/components/topbar";
import type { ClientSummary, ProposalRun, ProposalTemplate } from "@/types/api";

function NewProposalWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [clientId, setClientId] = useState(searchParams.get("clientId") ?? "");
  const [templateDocId, setTemplateDocId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: () => api.get<ClientSummary[]>("/clients"),
  });
  const { data: templates } = useQuery({
    queryKey: ["proposal-templates"],
    queryFn: () => api.get<ProposalTemplate[]>("/proposal-templates"),
  });

  const selectedTemplate = templates?.find((t) => t.id === templateDocId);
  const selectedClient = clients?.find((c) => c.id === clientId);

  const generateMutation = useMutation({
    mutationFn: () => api.post<ProposalRun>("/proposals/runs", { templateDocId, clientId }),
    onSuccess: (run) => {
      if (run.resultDocument) router.push(`/documents/${run.resultDocument.id}/edit`);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Failed to generate proposal"),
  });

  return (
    <>
      <TopBar title="New Proposal" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-xl space-y-6">
          <p className="text-sm text-kv-slate">
            Drafts a first-pass proposal from a template, using this client&apos;s approved Discovery Notes plus
            firm‑wide Methodology and Framework documents. Commercial terms are never AI‑drafted — you&apos;ll fill
            those in yourself before it goes for review.
          </p>

          <div className="kv-card space-y-4 p-5">
            <div>
              <label className="mb-1 block text-xs font-medium text-kv-slate">Client</label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full rounded-md border border-kv-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-kv-gold"
              >
                <option value="">Select a client…</option>
                {clients?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-kv-slate">Template</label>
              <select
                value={templateDocId}
                onChange={(e) => setTemplateDocId(e.target.value)}
                className="w-full rounded-md border border-kv-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-kv-gold"
              >
                <option value="">Select a template…</option>
                {templates?.map((t) => (
                  <option key={t.id} value={t.id} disabled={t.templateSections.length === 0}>
                    {t.code} — {t.title}
                    {t.templateSections.length === 0 ? " (no sections defined)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {selectedTemplate && (
              <div>
                <p className="mb-2 text-xs font-medium text-kv-slate">Sections this will draft</p>
                <ul className="space-y-1.5">
                  {selectedTemplate.templateSections.map((s) => (
                    <li key={s.key} className="flex items-center justify-between text-sm">
                      <span>{s.title}</span>
                      {s.requiresHuman ? (
                        <span className="rounded-full bg-kv-mist px-2 py-0.5 text-[11px] text-kv-slate dark:bg-white/10">
                          You fill this in
                        </span>
                      ) : (
                        <span className="rounded-full bg-kv-mist px-2 py-0.5 text-[11px] text-kv-slate dark:bg-white/10">
                          AI-drafted
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              onClick={() => {
                setError(null);
                generateMutation.mutate();
              }}
              disabled={!clientId || !templateDocId || generateMutation.isPending}
              className="w-full rounded-md bg-kv-navy py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 dark:bg-kv-gold dark:text-kv-navy"
            >
              {generateMutation.isPending
                ? `Drafting for ${selectedClient?.name ?? "client"}…`
                : "Generate draft proposal"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function NewProposalPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-kv-slate">Loading…</div>}>
      <NewProposalWizard />
    </Suspense>
  );
}
