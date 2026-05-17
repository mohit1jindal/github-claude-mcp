#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { repoTools } from "./tools/repo.js";
import { prTools } from "./tools/pr.js";
import { issueTools } from "./tools/issues.js";
import { commitTools } from "./tools/commits.js";

const server = new McpServer({
  name: "github-claude-mcp",
  version: "1.0.0",
});

// Register all tools
const allTools = [...repoTools, ...prTools, ...issueTools, ...commitTools];

for (const tool of allTools) {
  // Use a passthrough record schema — each tool's handler validates with zod internally
  const schema = { input: z.record(z.unknown()).optional().describe("Tool input parameters") };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (server.tool as any)(
    tool.name,
    tool.description,
    schema,
    async (args: { input?: Record<string, unknown> }) => {
      try {
        const result = await tool.handler(args.input ?? args);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text" as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    }
  );
}

async function main() {
  if (!process.env.GITHUB_TOKEN) {
    process.stderr.write("Error: GITHUB_TOKEN environment variable is required\n");
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("github-claude-mcp running on stdio\n");
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err}\n`);
  process.exit(1);
});
