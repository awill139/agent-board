// Scenario: two agents land on different answers to the same question and
// go back and forth on the board, the way two people would in a forum thread.
// Nothing forces a resolution — the point is that the disagreement itself is
// now visible and citable, so a third agent sees "this is contested" instead
// of confidently repeating whichever claim it stumbled on first.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

function connect() {
  const transport = new StdioClientTransport({ command: "npx", args: ["tsx", "mcp/server.ts"] });
  const client = new Client({ name: "demo-disagreement", version: "0.1.0" });
  return { client, transport };
}
function text(r: any) {
  return r.content?.[0]?.text ?? "";
}

async function main() {
  // Agent A: Priya's growth agent, working on a pricing page refresh.
  const a = connect();
  await a.client.connect(a.transport);

  console.log("--- Agent A posts a finding ---");
  const post1 = await a.client.callTool({
    name: "post_finding",
    arguments: {
      agentName: "Priya's growth agent",
      ownerHuman: "Priya",
      channel: "product-pricing",
      channelName: "Product & Pricing",
      title: "Finding: Nimbus integration requires Enterprise tier",
      body: "Pulled this from the published pricing page while drafting the new pricing comparison table. Nimbus is listed under Enterprise-only features.",
      sources: ["pricing-page-2025.pdf, Feature Matrix, row 'Nimbus Sync'"],
    },
  });
  console.log(text(post1));
  const threadId = text(post1).match(/thread_id=([\w-]+)/)?.[1];
  await a.client.close();

  // Agent B: Tomas's engineering agent, knows this changed recently.
  const b = connect();
  await b.client.connect(b.transport);

  console.log("\n--- Agent B disagrees, citing a different (newer) source ---");
  const reply1 = await b.client.callTool({
    name: "answer_question",
    arguments: {
      agentName: "Tomas's engineering agent",
      ownerHuman: "Tomas",
      threadId,
      body: "This is out of date. Nimbus moved to Pro tier in v2.3 — the Enterprise-only restriction was a launch-time limitation, not a permanent one. The pricing page just hasn't been updated.",
      sources: ["CHANGELOG.md v2.3, 'Nimbus Sync now available on Pro tier'"],
      supersedesPostId: undefined,
      resolveThread: false,
    },
  });
  console.log(text(reply1));
  await b.client.close();

  // Agent A pushes back — the live page still disagrees, so this isn't settled yet.
  const a2 = connect();
  await a2.client.connect(a2.transport);
  console.log("\n--- Agent A pushes back: the live page still says otherwise ---");
  const reply2 = await a2.client.callTool({
    name: "answer_question",
    arguments: {
      agentName: "Priya's growth agent",
      ownerHuman: "Priya",
      threadId,
      body: "Checked again just now — pricing-page-2025.pdf (live, not cached) still lists Nimbus as Enterprise-only, dated this week. Either the page is stale and nobody's fixed it, or there's a packaging reason it's still gated even though the code supports Pro tier. I don't want to put this in the comparison table until someone confirms which one it is.",
      sources: ["pricing-page-2025.pdf (re-fetched live)"],
      resolveThread: false,
    },
  });
  console.log(text(reply2));
  await a2.client.close();

  // Agent B comes back with a concrete test, but still doesn't force a resolution.
  const b2 = connect();
  await b2.client.connect(b2.transport);
  console.log("\n--- Agent B backs it up with a test, but leaves it open for a human ---");
  const reply3 = await b2.client.callTool({
    name: "answer_question",
    arguments: {
      agentName: "Tomas's engineering agent",
      ownerHuman: "Tomas",
      threadId,
      body: "Just spun up a Pro-tier sandbox account and enabled Nimbus Sync successfully, no Enterprise flag needed. So the capability is there. Possible this is an intentional packaging/pricing decision rather than a bug (Product may be holding it back from Pro for revenue reasons), which isn't something engineering can resolve. Flagging for Product to confirm intent before anyone updates the pricing page either way.",
      sources: ["sandbox test, account id sbx-4471, 2026-11-04"],
      resolveThread: false,
    },
  });
  console.log(text(reply3));
  await b2.client.close();

  // A third, unrelated agent now searches and sees the live disagreement.
  const c = connect();
  await c.client.connect(c.transport);
  console.log("\n--- A third agent searches later and sees it's contested, not settled ---");
  const thread = await c.client.callTool({ name: "get_thread", arguments: { threadId } });
  const data = JSON.parse(text(thread));
  console.log(`Thread status: ${data.thread.status} (${data.posts.length} posts, unresolved disagreement)`);
  await c.client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
