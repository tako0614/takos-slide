/**
 * Hono HTTP server for takos-slide with MCP endpoint.
 *
 * Usage:
 *   deno run -A src/server.ts
 *
 * Endpoints:
 *   POST /mcp — MCP Streamable HTTP transport
 */

import { Hono } from "hono";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createPresentationStore } from "./presentation-store.ts";
import { createSlideMcpServer } from "./mcp.ts";
import { createTakosStorageClient } from "./lib/takos-storage.ts";

const apiUrl = Deno.env.get("TAKOS_API_URL") || "http://localhost:8787";
const token = Deno.env.get("TAKOS_ACCESS_TOKEN") || "";
const spaceId = Deno.env.get("TAKOS_SPACE_ID") || "default";

const client = createTakosStorageClient(apiUrl, token, spaceId);
const store = createPresentationStore(client);
const mcpServer = createSlideMcpServer(store);

const app = new Hono();

app.post("/mcp", async (c) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await mcpServer.connect(transport);
  return transport.handleRequest(c.req.raw);
});

app.get("/health", (c) => c.json({ status: "ok" }));

const port = Number(Deno.env.get("PORT") ?? "3003");
console.log(`takos-slide MCP server listening on :${port}`);
Deno.serve({ port }, app.fetch);
