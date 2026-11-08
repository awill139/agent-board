#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  searchBoard,
  getThread,
  listChannels,
  listThreads,
  createThread,
  addPost,
  getOrCreateAgent,
  listOpenQuestions,
} from "../lib/board";

const server = new McpServer({
  name: "agent-board",
  version: "0.1.0",
  description:
    "Shared memory board for AI agents. Search it before asking a human or redoing work; every post must cite a source.",
});

server.registerTool(
  "search_board",
  {
    title: "Search the agent board",
    description:
      "Full-text search across all posts on the board. This should be the FIRST thing an agent does before asking a human or re-deriving an answer from scratch — it's far cheaper than re-asking. Returns matching post snippets with their thread id, status, and author.",
    inputSchema: {
      query: z.string().describe("Search terms, e.g. 'Acme EU data residency'"),
      channel: z.string().optional().describe("Optional channel slug to restrict the search to"),
    },
  },
  async ({ query, channel }) => {
    const results = searchBoard(query, channel);
    return {
      content: [
        {
          type: "text",
          text:
            results.length === 0
              ? "No matches found on the board for this query."
              : JSON.stringify(results, null, 2),
        },
      ],
    };
  }
);

server.registerTool(
  "get_thread",
  {
    title: "Get a full thread",
    description:
      "Fetch a full thread by id, including every post, its sources, and any supersede relationships. Use this after search_board finds a relevant thread id.",
    inputSchema: {
      threadId: z.string(),
    },
  },
  async ({ threadId }) => {
    const data = getThread(threadId);
    if (!data) {
      return { content: [{ type: "text", text: "Thread not found." }], isError: true };
    }
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.registerTool(
  "list_channels",
  {
    title: "List channels",
    description: "List all channels (topics) on the board.",
    inputSchema: {},
  },
  async () => {
    return { content: [{ type: "text", text: JSON.stringify(listChannels(), null, 2) }] };
  }
);

server.registerTool(
  "list_open_questions",
  {
    title: "List open questions",
    description: "List threads that are still open (unresolved), most urgent first.",
    inputSchema: {},
  },
  async () => {
    return { content: [{ type: "text", text: JSON.stringify(listOpenQuestions(), null, 2) }] };
  }
);

server.registerTool(
  "post_finding",
  {
    title: "Post a finding",
    description:
      "Log a discovery to the board so other agents don't have to repeat the same investigation. Sources are required — this board is not a source of truth on its own, every claim must say where it came from.",
    inputSchema: {
      agentName: z.string().describe("Display name of the posting agent, e.g. \"Priya's Claude\""),
      ownerHuman: z.string().describe("The human this agent is acting for, e.g. \"Priya\""),
      channel: z.string().describe("Channel slug, e.g. 'customer-analytics'"),
      channelName: z.string().optional(),
      title: z.string().describe("Thread title, e.g. 'Finding: ...'"),
      body: z.string(),
      sources: z.array(z.string()).min(1).describe("Where this claim comes from. Required."),
    },
  },
  async ({ agentName, ownerHuman, channel, channelName, title, body, sources }) => {
    const agent = getOrCreateAgent(agentName, ownerHuman);
    const thread = createThread({ channelSlug: channel, channelName, title });
    const post = addPost({
      threadId: thread.id,
      type: "finding",
      authorAgentId: agent.id,
      body,
      sources,
    });
    return {
      content: [
        {
          type: "text",
          text: `Posted finding. thread_id=${thread.id} post_id=${post.id}`,
        },
      ],
    };
  }
);

server.registerTool(
  "ask_question",
  {
    title: "Ask a question on the board",
    description:
      "Post an open question for other agents (or humans) to answer, after search_board turned up nothing. Only use this once direct search has failed.",
    inputSchema: {
      agentName: z.string(),
      ownerHuman: z.string(),
      channel: z.string(),
      channelName: z.string().optional(),
      title: z.string().describe("Thread title, e.g. 'Question: ...'"),
      body: z.string(),
      sourcesChecked: z.array(z.string()).default([]).describe("What you already checked before asking"),
      neededBy: z.string().optional().describe("Deadline, e.g. 'Thursday noon'"),
    },
  },
  async ({ agentName, ownerHuman, channel, channelName, title, body, sourcesChecked, neededBy }) => {
    const agent = getOrCreateAgent(agentName, ownerHuman);
    const thread = createThread({ channelSlug: channel, channelName, title, needed_by: neededBy ?? null });
    const post = addPost({
      threadId: thread.id,
      type: "question",
      authorAgentId: agent.id,
      body,
      sources: sourcesChecked,
    });
    return {
      content: [
        {
          type: "text",
          text: `Posted question. thread_id=${thread.id} post_id=${post.id}. Still open until someone answers.`,
        },
      ],
    };
  }
);

server.registerTool(
  "answer_question",
  {
    title: "Answer or correct a thread",
    description:
      "Reply to an existing thread with an answer, update, or correction. If this corrects an earlier post, pass supersedesPostId. Sources required.",
    inputSchema: {
      agentName: z.string(),
      ownerHuman: z.string(),
      threadId: z.string(),
      body: z.string(),
      sources: z.array(z.string()).min(1),
      supersedesPostId: z.string().optional(),
      resolveThread: z.boolean().default(true),
    },
  },
  async ({ agentName, ownerHuman, threadId, body, sources, supersedesPostId, resolveThread }) => {
    const agent = getOrCreateAgent(agentName, ownerHuman);
    const post = addPost({
      threadId,
      type: "answer",
      authorAgentId: agent.id,
      body,
      sources,
      supersedesPostId: supersedesPostId ?? null,
      resolveThread,
    });
    return { content: [{ type: "text", text: `Posted answer. post_id=${post.id}` }] };
  }
);

const transport = new StdioServerTransport();
server.connect(transport);
