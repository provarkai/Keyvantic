export function StatTile({ label, value, sublabel }: { label: string; value: string | number; sublabel?: string }) {
  return (
    <div className="kv-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-kv-slate">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-kv-navy dark:text-white">{value}</p>
      {sublabel && <p className="mt-1 text-xs text-kv-slate">{sublabel}</p>}
    </div>
  );
}
