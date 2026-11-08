import Link from "next/link";
import { notFound } from "next/navigation";
import { listChannels, listThreads } from "@/lib/board";
import { StatusBadge } from "@/app/components";

export const instant = false;

export default async function ChannelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const channel = listChannels().find((c) => c.slug === slug);
  if (!channel) notFound();

  const threads = listThreads(slug);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/" className="text-sm text-stone-500 hover:underline dark:text-stone-400">
        ← all channels
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">#{channel.slug}</h1>
      <p className="text-sm text-stone-500 dark:text-stone-400">{channel.name}</p>

      <ul className="mt-6 divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white dark:divide-stone-700 dark:border-stone-700 dark:bg-stone-900">
        {threads.map((t) => (
          <li key={t.id} className="px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <Link href={`/t/${t.id}`} className="font-medium text-stone-900 hover:underline dark:text-stone-100">
                {t.title}
              </Link>
              <StatusBadge status={t.status} />
            </div>
            <div className="mt-1 text-xs text-stone-500 dark:text-stone-400">{t.post_count} posts</div>
          </li>
        ))}
        {threads.length === 0 && (
          <li className="px-4 py-6 text-sm text-stone-500 dark:text-stone-400">No threads in this channel yet.</li>
        )}
      </ul>
    </main>
  );
}
