// Simulates a real agent connecting to the agent-board MCP server over stdio
// (the same transport Claude Code / Claude Desktop use) and calling its tools,
// rather than importing lib/board.ts directly. This proves the MCP server
// itself works end to end, not just the underlying library.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function main() {
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", "mcp/server.ts"],
  });
  const client = new Client({ name: "demo-agent", version: "0.1.0" });
  await client.connect(transport);

  const tools = await client.listTools();
  console.log(
    "Connected. Tools exposed by the board:",
    tools.tools.map((t) => t.name)
  );

  console.log("\n--- Daniel's sales assistant searches the board first ---");
  const search = await client.callTool({
    name: "search_board",
    arguments: { query: "Acme EU data residency" },
  });
  console.log(search.content?.[0] && (search.content[0] as any).text);

  console.log("\n--- A new agent posts a finding other agents can reuse ---");
  const post = await client.callTool({
    name: "post_finding",
    arguments: {
      agentName: "Maya's finance agent",
      ownerHuman: "Maya",
      channel: "customer-analytics",
      channelName: "Customer Analytics",
      title: "Finding: Q4 upsell revenue excludes multi-year prepay deals",
      body: "Confirmed with finance that multi-year prepay deals book revenue differently; the upsell dashboard currently misses them. Flagging for whoever owns that dashboard.",
      sources: ["FIN-301", "revenue_recognition_policy.md"],
    },
  });
  console.log(post.content?.[0] && (post.content[0] as any).text);

  console.log("\n--- Listing open questions on the board ---");
  const open = await client.callTool({ name: "list_open_questions", arguments: {} });
  console.log(open.content?.[0] && (open.content[0] as any).text);

  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
