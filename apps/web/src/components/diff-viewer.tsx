interface DiffOp {
  type: "equal" | "added" | "removed";
  line: string;
}

export function DiffViewer({ diff }: { diff: DiffOp[] }) {
  return (
    <div className="kv-card overflow-x-auto p-0">
      <pre className="whitespace-pre-wrap p-4 text-xs leading-relaxed">
        {diff.map((op, i) => (
          <div
            key={i}
            className={
              op.type === "added"
                ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300"
                : op.type === "removed"
                  ? "bg-red-50 text-red-800 line-through dark:bg-red-500/10 dark:text-red-300"
                  : "text-kv-slate"
            }
          >
            {op.type === "added" ? "+ " : op.type === "removed" ? "- " : "  "}
            {op.line || " "}
          </div>
        ))}
      </pre>
    </div>
  );
}
