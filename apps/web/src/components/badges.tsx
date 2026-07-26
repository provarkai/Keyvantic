import clsx from "clsx";
import type { ConfidentialityLevel, DocumentStatus } from "@keyvantic/types";

const STATUS_STYLES: Record<DocumentStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
  INTERNAL_REVIEW: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  APPROVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  ARCHIVED: "bg-zinc-100 text-zinc-500 dark:bg-white/5 dark:text-zinc-400",
};

const STATUS_LABELS: Record<DocumentStatus, string> = {
  DRAFT: "Draft",
  INTERNAL_REVIEW: "Internal Review",
  APPROVED: "Approved",
  ARCHIVED: "Archived",
};

export function StatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_STYLES[status])}>
      {STATUS_LABELS[status]}
    </span>
  );
}

const CONFIDENTIALITY_STYLES: Record<ConfidentialityLevel, string> = {
  PUBLIC: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
  INTERNAL: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
  CONFIDENTIAL: "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300",
  RESTRICTED: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300",
};

export function ConfidentialityBadge({ level }: { level: ConfidentialityLevel }) {
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", CONFIDENTIALITY_STYLES[level])}>
      {level}
    </span>
  );
}
