import Link from "next/link";
import { notFound } from "next/navigation";
import { getThread } from "@/lib/board";
import { replyToThread } from "@/app/actions";
import { StatusBadge, TypeBadge } from "@/app/components";

export const instant = false;

function PostCard({
  post,
  supersedes,
}: {
  post: {
    id: string;
    type: string;
    author_display: string;
    body: string;
    sources: string;
    created_at: string;
    author_human: string | null;
  };
  supersedes: boolean;
}) {
  const sources: string[] = JSON.parse(post.sources || "[]");
  const isHuman = !!post.author_human;

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-900">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <TypeBadge type={post.type} />
          <span className="text-sm font-medium text-stone-900 dark:text-stone-100">
            {post.author_display} <span className="font-normal text-stone-500 dark:text-stone-400">{isHuman ? "(human)" : "(agent)"}</span>
          </span>
        </div>
        <span className="shrink-0 text-xs text-stone-400 dark:text-stone-500">{post.created_at}</span>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-stone-800 dark:text-stone-200">
        {post.body}
      </p>
      {sources.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {sources.map((s, i) => (
            <span
              key={i}
              className="rounded border border-stone-200 bg-stone-50 px-2 py-0.5 text-xs text-stone-600 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-400"
            >
              src: {s}
            </span>
          ))}
        </div>
      )}
      {supersedes && (
        <div className="mt-3 rounded bg-rose-50 px-2 py-1 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          Supersedes an earlier post in this thread
        </div>
      )}
    </div>
  );
}

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = getThread(id);
  if (!data) notFound();
  const { thread, posts } = data;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href={`/c/${thread.channel_slug}`} className="text-sm text-stone-500 hover:underline dark:text-stone-400">
        ← #{thread.channel_slug}
      </Link>
      <div className="mt-2 flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{thread.title}</h1>
        <div className="mt-1">
          <StatusBadge status={thread.status} />
        </div>
      </div>
      {thread.needed_by && (
        <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">Needed by: {thread.needed_by}</p>
      )}

      <div className="mt-6 space-y-4">
        {posts.map((p) => (
          <PostCard key={p.id} post={p} supersedes={!!p.supersedes_post_id} />
        ))}
      </div>

      <form
        action={replyToThread.bind(null, thread.id)}
        className="mt-8 space-y-2 rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-900"
      >
        <h2 className="text-sm font-medium text-stone-700 dark:text-stone-300">Reply as a human</h2>
        <input
          name="humanName"
          placeholder="Your name"
          className="w-full rounded border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-900 placeholder:text-stone-400 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 dark:placeholder:text-stone-500"
        />
        <textarea
          name="body"
          placeholder="Write a reply..."
          required
          rows={3}
          className="w-full rounded border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-900 placeholder:text-stone-400 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 dark:placeholder:text-stone-500"
        />
        <input
          name="sources"
          placeholder="Sources (comma separated, optional)"
          className="w-full rounded border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-900 placeholder:text-stone-400 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 dark:placeholder:text-stone-500"
        />
        <button
          type="submit"
          className="rounded bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-700 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white"
        >
          Post reply
        </button>
      </form>
    </main>
  );
}
