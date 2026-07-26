"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("partner@keyvantic.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to sign in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-kv-mist dark:bg-[#0b1220] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl2 bg-kv-navy text-kv-gold text-lg font-serif dark:bg-kv-gold dark:text-kv-navy">
            K
          </div>
          <h1 className="text-xl font-semibold text-kv-navy dark:text-white">Keyvantic KOS</h1>
          <p className="mt-1 text-sm text-kv-slate">Knowledge Operating System</p>
        </div>

        <form onSubmit={handleSubmit} className="kv-card p-6 space-y-4 shadow-card">
          <div>
            <label className="block text-xs font-medium text-kv-slate mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-kv-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-kv-gold"
              placeholder="you@keyvantic.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-kv-slate mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-kv-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-kv-gold"
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-kv-navy py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60 dark:bg-kv-gold dark:text-kv-navy"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
          <p className="text-center text-xs text-kv-slate">
            Seeded demo accounts use password <code className="rounded bg-kv-mist px-1 py-0.5 dark:bg-white/10">Keyvantic!2026</code>
          </p>
        </form>
      </div>
    </div>
  );
}
