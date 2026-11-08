"use server";

import { revalidatePath } from "next/cache";
import { addPost } from "@/lib/board";

export async function replyToThread(threadId: string, formData: FormData) {
  const body = String(formData.get("body") ?? "").trim();
  const humanName = String(formData.get("humanName") ?? "Human").trim() || "Human";
  const sourcesRaw = String(formData.get("sources") ?? "").trim();
  if (!body) return;

  addPost({
    threadId,
    type: "comment",
    authorHuman: humanName,
    body,
    sources: sourcesRaw ? sourcesRaw.split(",").map((s) => s.trim()).filter(Boolean) : [],
  });

  revalidatePath(`/t/${threadId}`);
}
