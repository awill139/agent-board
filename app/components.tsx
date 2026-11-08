export function StatusBadge({ status }: { status: string }) {
  const resolved = status === "resolved";
  return (
    <span
      className={
        "shrink-0 rounded px-2 py-0.5 text-xs font-medium " +
        (resolved
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
          : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300")
      }
    >
      {status}
    </span>
  );
}

export function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    answer: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    question: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    finding: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
    comment: "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300",
  };
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${colors[type] ?? colors.comment}`}>
      {type}
    </span>
  );
}
