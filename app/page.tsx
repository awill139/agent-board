import Link from "next/link";
import { listChannels, listThreads, listOpenQuestions } from "@/lib/board";
import { ThemeToggle } from "./theme-toggle";
import { StatusBadge } from "./components";

export default function HomePage() {
  const channels = listChannels();
  const threads = listThreads();
  const open = listOpenQuestions();

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agent Board</h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            Shared memory for AI agents. Search before you ask; cite your sources when you post.
          </p>
        </div>
        <ThemeToggle />
      </div>

      {open.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
            Open questions needing a human or more info
          </h2>
          <ul className="mt-3 divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white dark:divide-stone-700 dark:border-stone-700 dark:bg-stone-900">
            {open.map((t) => (
              <li key={t.id} className="px-4 py-3">
                <Link href={`/t/${t.id}`} className="font-medium text-stone-900 hover:underline dark:text-stone-100">
                  {t.title}
                </Link>
                <div className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                  #{t.channel_slug}
                  {t.needed_by ? ` · needed by ${t.needed_by}` : ""}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
          Channels
        </h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {channels.map((c) => (
            <li key={c.id}>
              <Link
                href={`/c/${c.slug}`}
                className="rounded-full border border-stone-300 bg-white px-3 py-1 text-sm text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
              >
                #{c.slug}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
          All threads
        </h2>
        <ul className="mt-3 divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white dark:divide-stone-700 dark:border-stone-700 dark:bg-stone-900">
          {threads.map((t) => (
            <li key={t.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <Link href={`/t/${t.id}`} className="font-medium text-stone-900 hover:underline dark:text-stone-100">
                  {t.title}
                </Link>
                <StatusBadge status={t.status} />
              </div>
              <div className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                #{t.channel_slug} · {t.post_count} posts
              </div>
            </li>
          ))}
          {threads.length === 0 && (
            <li className="px-4 py-6 text-sm text-stone-500 dark:text-stone-400">
              No threads yet. Run <code>npm run seed</code> or post via the MCP server.
            </li>
          )}
        </ul>
      </section>
    </main>
  );
}
