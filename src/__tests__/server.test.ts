import { assertEquals } from "@std/assert";
import {
  createSlideAppFromEnv,
  SLIDE_MAX_MCP_REQUEST_BYTES,
} from "../server.ts";

const env = {
  TAKOS_API_URL: "http://localhost:8787",
  TAKOS_ACCESS_TOKEN: "token",
  TAKOS_SPACE_ID: "space-1",
  TAKOS_NATIVE_RENDERING: "0",
};

Deno.test("health endpoint returns ok", async () => {
  const app = createSlideAppFromEnv(env);
  const res = await app.request("/health");

  assertEquals(res.status, 200);
  assertEquals(await res.json(), { status: "ok" });
});

Deno.test("presentation collection writes require app auth when enabled", async () => {
  const app = createSlideAppFromEnv({
    ...env,
    APP_AUTH_REQUIRED: "1",
    OAUTH_ISSUER_URL: "https://takos.example",
    OAUTH_CLIENT_ID: "client",
    OAUTH_CLIENT_SECRET: "secret",
    APP_SESSION_SECRET: "session-secret",
  });
  const res = await app.request(
    new Request("http://localhost/api/presentations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Private" }),
    }),
  );

  assertEquals(res.status, 401);
  assertEquals(await res.json(), { error: "Unauthorized" });
});

Deno.test("mcp endpoint rejects oversized request bodies", async () => {
  const app = createSlideAppFromEnv(env);
  const res = await app.request(
    new Request("http://localhost/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(SLIDE_MAX_MCP_REQUEST_BYTES + 1),
      },
      body: "{}",
    }),
  );

  assertEquals(res.status, 413);
  assertEquals(await res.json(), { error: "Request body too large" });
});

Deno.test("mcp endpoint enforces optional bearer auth before handling body", async () => {
  const app = createSlideAppFromEnv({
    ...env,
    MCP_AUTH_TOKEN: "secret",
  });
  const res = await app.request(
    new Request("http://localhost/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }),
  );

  assertEquals(res.status, 401);
  assertEquals(await res.json(), { error: "Unauthorized" });
});

Deno.test("mcp endpoint fails closed when managed auth is required but token is missing", async () => {
  const app = createSlideAppFromEnv({
    ...env,
    MCP_AUTH_REQUIRED: "1",
  });
  const res = await app.request(
    new Request("http://localhost/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }),
  );

  assertEquals(res.status, 503);
  assertEquals(await res.json(), { error: "MCP_AUTH_TOKEN is required" });
});

Deno.test("health endpoint fails when managed mcp auth is required but token is missing", async () => {
  const app = createSlideAppFromEnv({
    ...env,
    MCP_AUTH_REQUIRED: "1",
  });
  const res = await app.request("/health");

  assertEquals(res.status, 503);
  assertEquals(await res.json(), { error: "MCP_AUTH_TOKEN is required" });
});
