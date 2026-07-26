"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";

interface AiSource {
  id: string;
  code: string;
  title: string;
}

interface AiResponse {
  answer: string;
  sources: AiSource[];
  modelBacked?: boolean;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: AiSource[];
  modelBacked?: boolean;
}

const SUGGESTIONS = [
  "What does our Brand Strategy say about government clients?",
  "Summarise our AI Governance Framework.",
  "What changed this month?",
];

export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "I'm the Keyvantic KOS assistant. I only answer using approved documents in the Master Library, and I always cite my sources. Ask me anything.",
    },
  ]);
  const [input, setInput] = useState("");

  const askMutation = useMutation({
    mutationFn: (question: string) => api.post<AiResponse>("/ai/ask", { question }),
    onSuccess: (res) => {
      setMessages((prev) => [...prev, { role: "assistant", content: res.answer, sources: res.sources, modelBacked: res.modelBacked }]);
    },
    onError: (err) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: err instanceof ApiError ? err.message : "Something went wrong answering that." },
      ]);
    },
  });

  function ask(question: string) {
    if (!question.trim()) return;
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");
    askMutation.mutate(question);
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-kv-border px-6 py-3">
        <h1 className="text-lg font-semibold text-kv-navy dark:text-white">AI Assistant</h1>
        <p className="text-xs text-kv-slate">Grounded only in APPROVED Master Library documents.</p>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "text-right" : ""}>
              <div
                className={`inline-block max-w-[85%] rounded-xl2 px-4 py-3 text-sm ${
                  m.role === "user" ? "bg-kv-navy text-white dark:bg-kv-gold dark:text-kv-navy" : "kv-card"
                }`}
              >
                <p className="whitespace-pre-wrap">{m.content}</p>
                {m.sources && m.sources.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5 border-t border-kv-border pt-2">
                    {m.sources.map((s) => (
                      <Link
                        key={s.id}
                        href={`/documents/${s.id}`}
                        className="rounded-full bg-kv-mist px-2 py-0.5 text-[11px] text-kv-slate hover:underline dark:bg-white/10"
                      >
                        {s.code}
                      </Link>
                    ))}
                  </div>
                )}
                {m.modelBacked === false && (
                  <p className="mt-1 text-[11px] text-kv-slate">Extractive answer — no AI model configured.</p>
                )}
              </div>
            </div>
          ))}
          {askMutation.isPending && <p className="text-sm text-kv-slate">Thinking…</p>}
        </div>
      </div>

      <div className="border-t border-kv-border p-4">
        <div className="mx-auto max-w-2xl">
          <div className="mb-2 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => ask(s)}
                className="rounded-full border border-kv-border px-3 py-1 text-xs text-kv-slate hover:bg-kv-mist dark:hover:bg-white/5"
              >
                {s}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
            className="flex gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about approved Keyvantic knowledge…"
              className="flex-1 rounded-md border border-kv-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-kv-gold"
            />
            <button
              type="submit"
              className="rounded-md bg-kv-navy px-4 py-2 text-sm font-medium text-white hover:opacity-90 dark:bg-kv-gold dark:text-kv-navy"
            >
              Ask
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
