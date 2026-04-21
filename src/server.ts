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
import type { Context } from "hono";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createPresentationStore } from "./presentation-store.ts";
import { createSlideMcpServer } from "./mcp.ts";
import { createTakosStorageClient } from "./lib/takos-storage.ts";
import type { Presentation } from "./types/index.ts";
import {
  appAuthMisconfigured,
  registerAuthRoutes,
  requireAppAuth,
} from "./app-auth.ts";

export type SlideRuntimeEnv = Record<string, string | undefined>;
export const SLIDE_MAX_MCP_REQUEST_BYTES = 1_000_000;

function denoEnv(): SlideRuntimeEnv {
  return typeof Deno === "undefined" ? {} : Deno.env.toObject();
}

function envValue(env: SlideRuntimeEnv, name: string): string | undefined {
  const value = env[name];
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function requiredEnv(env: SlideRuntimeEnv, name: string): string {
  const value = envValue(env, name);
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function nativeRenderingEnabled(env: SlideRuntimeEnv): boolean {
  const value = envValue(env, "TAKOS_NATIVE_RENDERING");
  if (value) return ["1", "true", "yes"].includes(value.toLowerCase());
  return typeof Deno !== "undefined";
}

function envFlagEnabled(env: SlideRuntimeEnv, name: string): boolean {
  const value = envValue(env, name);
  return value ? ["1", "true", "yes"].includes(value.toLowerCase()) : false;
}

function authorizeMcpRequest(
  request: Request,
  authToken?: string,
): Response | null {
  if (!authToken) return null;
  const header = request.headers.get("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (token === authToken) return null;
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

function mcpAuthMisconfigured(env: SlideRuntimeEnv): Response | null {
  if (!envFlagEnabled(env, "MCP_AUTH_REQUIRED")) return null;
  if (envValue(env, "MCP_AUTH_TOKEN")) return null;
  return new Response(JSON.stringify({ error: "MCP_AUTH_TOKEN is required" }), {
    status: 503,
    headers: { "Content-Type": "application/json" },
  });
}

async function readBoundedJsonRequest(
  request: Request,
): Promise<{ request: Request; body: unknown } | Response> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > SLIDE_MAX_MCP_REQUEST_BYTES) {
    return new Response(JSON.stringify({ error: "Request body too large" }), {
      status: 413,
      headers: { "Content-Type": "application/json" },
    });
  }

  const raw = await request.text();
  const byteLength = new TextEncoder().encode(raw).byteLength;
  if (byteLength > SLIDE_MAX_MCP_REQUEST_BYTES) {
    return new Response(JSON.stringify({ error: "Request body too large" }), {
      status: 413,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const headers = new Headers(request.headers);
  headers.set("content-length", String(byteLength));
  return {
    request: new Request(request.url, {
      method: request.method,
      headers,
      body: raw,
    }),
    body,
  };
}

export function createSlideAppFromEnv(env: SlideRuntimeEnv = denoEnv()) {
  const apiUrl = envValue(env, "TAKOS_API_URL") || "http://localhost:8787";
  const token = requiredEnv(env, "TAKOS_ACCESS_TOKEN");
  const spaceId = requiredEnv(env, "TAKOS_SPACE_ID");
  const client = createTakosStorageClient(apiUrl, token, spaceId);
  const store = createPresentationStore(client);
  const app = new Hono();

  registerAuthRoutes(app, env);
  app.use("/api/presentations", async (c, next) => {
    const unauthorized = await requireAppAuth(env, c.req.raw);
    if (unauthorized) return unauthorized;
    await next();
  });
  app.use("/api/presentations/*", async (c, next) => {
    const unauthorized = await requireAppAuth(env, c.req.raw);
    if (unauthorized) return unauthorized;
    await next();
  });
  app.get("/api/presentations", async (c) => {
    const summaries = await store.list();
    const presentations = await Promise.all(
      summaries.map((entry) => store.get(entry.id)),
    );
    return c.json(
      presentations.filter((entry): entry is Presentation =>
        entry !== undefined
      ),
    );
  });
  app.post("/api/presentations", async (c) => {
    const body = await c.req.json<Partial<Presentation>>();
    if (body.id && body.title && body.slides) {
      return c.json(await store.replace(body as Presentation), 201);
    }
    return c.json(
      await store.create(body.title || "Untitled Presentation"),
      201,
    );
  });
  app.get("/api/presentations/:id", async (c) => {
    const presentation = await store.get(c.req.param("id"));
    return presentation
      ? c.json(presentation)
      : c.json({ error: "Presentation not found" }, 404);
  });
  app.put("/api/presentations/:id", async (c) => {
    const body = await c.req.json<Presentation>();
    return c.json(await store.replace({ ...body, id: c.req.param("id") }));
  });
  app.delete("/api/presentations/:id", async (c) => {
    return c.json({ deleted: await store.delete(c.req.param("id")) });
  });

  app.all("/mcp", async (c) => {
    const configError = mcpAuthMisconfigured(env);
    if (configError) return configError;

    const authResponse = authorizeMcpRequest(
      c.req.raw,
      envValue(env, "MCP_AUTH_TOKEN"),
    );
    if (authResponse) return authResponse;

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    const mcpServer = createSlideMcpServer(store, {
      nativeRendering: nativeRenderingEnabled(env),
    });
    await mcpServer.connect(transport);
    if (c.req.raw.method !== "POST") {
      return transport.handleRequest(c.req.raw);
    }

    const bounded = await readBoundedJsonRequest(c.req.raw);
    if (bounded instanceof Response) return bounded;
    return transport.handleRequest(bounded.request, {
      parsedBody: bounded.body,
    });
  });

  const health = (c: Context) => {
    const authError = appAuthMisconfigured(env);
    if (authError) return authError;
    const mcpAuthError = mcpAuthMisconfigured(env);
    if (mcpAuthError) return mcpAuthError;
    return c.json({ status: "ok" });
  };
  app.get("/health", health);
  app.get("/healthz", health);

  return app;
}

if (import.meta.main) {
  const env = denoEnv();
  const port = Number(envValue(env, "PORT") ?? "3003");
  const app = createSlideAppFromEnv(env);
  console.log(`takos-slide MCP server listening on :${port}`);
  Deno.serve({ port }, app.fetch);
}
