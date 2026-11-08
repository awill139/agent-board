import Anthropic from "@anthropic-ai/sdk";
import { searchBoard, getThread } from "../lib/board";

const MODEL = "claude-haiku-5-5";
const PRICE_PER_MTOK_INPUT = 1.0;
const PRICE_PER_MTOK_OUTPUT = 5.0;

const QUESTION =
  "Customer on an annual plan purchased through a reseller is asking for a refund at day 40. Can we give it to them, or does the standard 30-day window apply?";

// Raw docs an agent would need without the board, to arrive at the same correct answer.
const RAW_DOCS = [
  {
    name: "refund-policy.md",
    text: `# Refund Policy (self-serve)

Customers on self-serve monthly or annual plans may request a full refund within
30 days of purchase. After 30 days, refunds are at the discretion of support
leadership and are rare.

This policy covers plans purchased directly through our billing page. It does
not cover enterprise contracts, which are governed by the signed order form.`,
  },
  {
    name: "support-macros.md (excerpt)",
    text: `## Macro: Refund request outside 30 days
"Thanks for reaching out. Our standard refund window is 30 days from purchase.
Since it's been longer than that, I'm not able to process a refund, but I can
offer [alternative]."

Note: this macro assumes a standard self-serve purchase. If the account looks
unusual (enterprise, reseller, custom contract), escalate instead of using this
macro — check with finance or your lead first.`,
  },
  {
    name: "reseller-msa-template.pdf (excerpt, section 8)",
    text: `Section 8 — Returns and Refunds
Notwithstanding any refund terms published on Vendor's self-serve website,
End Customers who purchase through an authorized Reseller under this Master
Services Agreement are entitled to a refund within forty-five (45) days of
the invoice date, provided the Reseller submits the refund request on the End
Customer's behalf within that window.`,
  },
];

async function askFromScratch() {
  const docsBlock = RAW_DOCS.map((d) => `### ${d.name}\n\n${d.text}`).join("\n\n---\n\n");
  const res = await (new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })).messages.create({
    model: MODEL,
    max_tokens: 400,
    thinking: { type: "disabled" },
    system:
      "You are a support agent. You don't have access to any shared knowledge board. Read the raw internal documents below and answer accurately.",
    messages: [{ role: "user", content: `Internal documents:\n\n${docsBlock}\n\n---\n\nQuestion: ${QUESTION}` }],
  });
  return { label: "Without the board", input: res.usage.input_tokens, output: res.usage.output_tokens };
}

async function askViaBoard() {
  const hits = searchBoard("reseller refund window");
  const thread = getThread(hits[0].thread_id)!;
  const answer = thread.posts.find((p) => p.type === "answer")!;
  const sources: string[] = JSON.parse(answer.sources || "[]");

  const res = await (new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })).messages.create({
    model: MODEL,
    max_tokens: 400,
    thinking: { type: "disabled" },
    system:
      "You are a support agent. You checked the agent board first and found an already-verified answer. Use it to answer accurately.",
    messages: [
      {
        role: "user",
        content: `Board thread: "${thread.thread.title}" (status: ${thread.thread.status})\n\nAnswer (sources: ${sources.join(", ")}):\n${answer.body}\n\n---\n\nQuestion: ${QUESTION}`,
      },
    ],
  });
  return { label: "With the board", input: res.usage.input_tokens, output: res.usage.output_tokens };
}

function cost(i: number, o: number) {
  return (i / 1_000_000) * PRICE_PER_MTOK_INPUT + (o / 1_000_000) * PRICE_PER_MTOK_OUTPUT;
}

async function main() {
  const [a, b] = await Promise.all([askFromScratch(), askViaBoard()]);
  for (const r of [a, b]) {
    console.log(`${r.label}: input=${r.input} output=${r.output} total=${r.input + r.output} cost=$${cost(r.input, r.output).toFixed(5)}`);
  }
  const savedTokens = a.input + a.output - (b.input + b.output);
  const savedPct = (savedTokens / (a.input + a.output)) * 100;
  console.log(`\nSaved: ${savedTokens} tokens (${savedPct.toFixed(1)}%), $${(cost(a.input, a.output) - cost(b.input, b.output)).toFixed(5)}/question`);
}

main().catch((e) => { console.error(e); process.exit(1); });
