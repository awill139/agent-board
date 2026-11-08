import Anthropic from "@anthropic-ai/sdk";
import { searchBoard, getThread } from "../lib/board";
import { QUESTION, RAW_CONTEXT_DOCS } from "./benchmark-fixtures";

const MODEL = "claude-haiku-5-5";

// Pricing as of this benchmark, per million tokens (update if it changes).
const PRICE_PER_MTOK_INPUT = 1.0;
const PRICE_PER_MTOK_OUTPUT = 5.0;

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set. Run with: node --env-file=.env.local --import tsx scripts/benchmark.ts");
  process.exit(1);
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function askFromScratch() {
  const docsBlock = RAW_CONTEXT_DOCS.map((d) => `### ${d.name}\n\n${d.text}`).join("\n\n---\n\n");
  const system =
    "You are a sales support agent. You don't have access to any shared knowledge board. " +
    "You've been handed the raw internal documents below because nobody has synthesized an " +
    "answer to this question yet. Read them and answer the question accurately and completely, " +
    "including any caveats sales needs to know.";
  const userMsg = `Internal documents:\n\n${docsBlock}\n\n---\n\nQuestion: ${QUESTION}`;

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 700,
    thinking: { type: "disabled" },
    system,
    messages: [{ role: "user", content: userMsg }],
  });

  return {
    label: "Without the board (re-derive from source docs)",
    inputTokens: res.usage.input_tokens,
    outputTokens: res.usage.output_tokens,
    answer: res.content.map((b) => (b.type === "text" ? b.text : "")).join(""),
  };
}

async function askViaBoard() {
  // Step 1: the agent searches the board first (this call itself costs ~0 tokens,
  // it's a local tool call, not an LLM call).
  const hits = searchBoard("Acme EU data residency");
  if (hits.length === 0) throw new Error("Seed data missing — run `npm run seed` first.");
  const thread = getThread(hits[0].thread_id);
  if (!thread) throw new Error("Thread not found.");

  // Step 2: pull the resolved/superseding answer post plus its cited sources —
  // that's the only context handed to the model, instead of five raw documents.
  const resolvedPost = thread.posts.find((p) => p.type === "answer") ?? thread.posts[thread.posts.length - 1];
  const sources: string[] = JSON.parse(resolvedPost.sources || "[]");

  const system =
    "You are a sales support agent. Before doing anything else you checked the agent board " +
    "and found an existing, already-verified thread that answers this. Use it to answer the " +
    "question accurately, including any caveats sales needs to know.";
  const userMsg = `Board thread: "${thread.thread.title}" (status: ${thread.thread.status})\n\nResolved answer (sources: ${sources.join(", ")}):\n${resolvedPost.body}\n\n---\n\nQuestion: ${QUESTION}`;

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 700,
    thinking: { type: "disabled" },
    system,
    messages: [{ role: "user", content: userMsg }],
  });

  return {
    label: "With the board (search_board → get_thread)",
    inputTokens: res.usage.input_tokens,
    outputTokens: res.usage.output_tokens,
    answer: res.content.map((b) => (b.type === "text" ? b.text : "")).join(""),
  };
}

function cost(inputTokens: number, outputTokens: number) {
  return (inputTokens / 1_000_000) * PRICE_PER_MTOK_INPUT + (outputTokens / 1_000_000) * PRICE_PER_MTOK_OUTPUT;
}

async function main() {
  console.log(`Model: ${MODEL}\n`);
  console.log("Scenario: Daniel's sales assistant needs to answer Acme's EU data-residency question for a renewal proposal.\n");

  const [scratch, board] = await Promise.all([askFromScratch(), askViaBoard()]);

  for (const r of [scratch, board]) {
    const totalTokens = r.inputTokens + r.outputTokens;
    console.log(`--- ${r.label} ---`);
    console.log(`  input tokens:  ${r.inputTokens}`);
    console.log(`  output tokens: ${r.outputTokens}`);
    console.log(`  total tokens:  ${totalTokens}`);
    console.log(`  est. cost:     $${cost(r.inputTokens, r.outputTokens).toFixed(5)}`);
    console.log(`  answer: ${r.answer.slice(0, 220).replace(/\n/g, " ")}...\n`);
  }

  const scratchTotal = scratch.inputTokens + scratch.outputTokens;
  const boardTotal = board.inputTokens + board.outputTokens;
  const savedTokens = scratchTotal - boardTotal;
  const savedPct = (savedTokens / scratchTotal) * 100;
  const savedCost = cost(scratch.inputTokens, scratch.outputTokens) - cost(board.inputTokens, board.outputTokens);

  console.log("=== Summary ===");
  console.log(`Tokens saved by hitting the board first: ${savedTokens} (${savedPct.toFixed(1)}% reduction)`);
  console.log(`Cost saved per question: $${savedCost.toFixed(5)}`);
  console.log(
    `At 10,000 similar questions/month, that's ~${(savedTokens * 10000).toLocaleString()} tokens and ~$${(savedCost * 10000).toFixed(2)}/month saved.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
