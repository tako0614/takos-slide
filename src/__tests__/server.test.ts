import { assert, assertEquals } from "@std/assert";
import {
  createSlideAppFromEnv,
  SLIDE_MAX_MCP_REQUEST_BYTES,
} from "../server.ts";

const env = {
  TAKOS_API_URL: "http://localhost:8787",
  TAKOS_ACCESS_TOKEN: "token",
  TAKOS_SPACE_ID: "space-1",
  TAKOS_NATIVE_RENDERING: "0",
  MCP_AUTH_TOKEN: "secret",
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
        "Authorization": "Bearer secret",
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
  const app = createSlideAppFromEnv(env);
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

Deno.test("mcp endpoint fails closed when token is missing", async () => {
  const app = createSlideAppFromEnv({
    ...env,
    MCP_AUTH_TOKEN: undefined,
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

Deno.test("health endpoint allows explicit unauthenticated access when configured", async () => {
  const app = createSlideAppFromEnv({
    ...env,
    MCP_AUTH_TOKEN: undefined,
    MCP_ALLOW_UNAUTHENTICATED: "true",
  });
  const res = await app.request("/health");

  assertEquals(res.status, 200);
  assertEquals(await res.json(), { status: "ok" });
});

Deno.test("startup does not require TAKOS_SPACE_ID", async () => {
  const app = createSlideAppFromEnv({
    ...env,
    TAKOS_SPACE_ID: undefined,
  });
  const res = await app.request("/health");

  assertEquals(res.status, 200);
  assertEquals(await res.json(), { status: "ok" });
});

Deno.test("file handler route redirects to presentation editor route", async () => {
  const app = createSlideAppFromEnv(env);
  const res = await app.request("/files/file-1?space_id=space-q");

  assertEquals(res.status, 302);
  assertEquals(res.headers.get("location"), "/slide/file-1?space_id=space-q");
});

Deno.test("presentation API opens and saves advertised file by storage id in request space", async () => {
  const originalFetch = globalThis.fetch;
  const calls: { method: string; url: string; body?: string }[] = [];
  const now = "2026-04-30T00:00:00.000Z";
  const presentation = {
    id: "pres-1",
    title: "Deck",
    slides: [{ id: "slide-1", elements: [], background: "#ffffff" }],
    createdAt: now,
    updatedAt: now,
  };

  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
    const request = input instanceof Request ? input : null;
    const url = request?.url ?? String(input);
    const method = init?.method ?? request?.method ?? "GET";
    calls.push({
      method,
      url,
      body: typeof init?.body === "string" ? init.body : undefined,
    });

    if (url.endsWith("/api/spaces/space-q/storage")) {
      return Promise.resolve(Response.json({
        files: [{
          id: "folder-1",
          name: "takos-slide",
          path: "takos-slide",
          type: "folder",
          created_at: now,
          updated_at: now,
        }],
      }));
    }
    if (url.endsWith("/api/spaces/space-q/storage?path=takos-slide")) {
      return Promise.resolve(Response.json({ files: [] }));
    }
    if (url.endsWith("/api/spaces/space-q/storage/file-1")) {
      return Promise.resolve(Response.json({
        file: {
          id: "file-1",
          name: "Deck.takosslide",
          type: "file",
          mime_type: "application/vnd.takos.slide+json",
          created_at: now,
          updated_at: now,
        },
      }));
    }
    if (url.endsWith("/api/spaces/space-q/storage/file-1/content")) {
      if (method === "PUT") return Promise.resolve(Response.json({ file: {} }));
      return Promise.resolve(
        Response.json({ content: JSON.stringify(presentation) }),
      );
    }
    return Promise.resolve(Response.json({ error: "unexpected" }, {
      status: 500,
    }));
  }) as typeof fetch;

  try {
    const app = createSlideAppFromEnv({
      ...env,
      TAKOS_SPACE_ID: undefined,
    });
    const getRes = await app.request(
      "/api/presentations/file-1?space_id=space-q",
    );
    assertEquals(getRes.status, 200);
    assertEquals(await getRes.json(), presentation);

    const putRes = await app.request(
      new Request(
        "http://localhost/api/presentations/file-1?space_id=space-q",
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...presentation, title: "Updated" }),
        },
      ),
    );
    assertEquals(putRes.status, 200);
    assertEquals((await putRes.json()).id, "pres-1");

    const saveCall = calls.find((call) =>
      call.method === "PUT" &&
      call.url.endsWith("/api/spaces/space-q/storage/file-1/content")
    );
    assert(saveCall);
    assertEquals(
      JSON.parse(saveCall.body ?? "{}").mime_type,
      "application/vnd.takos.slide+json",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("health endpoint fails when token is missing", async () => {
  const app = createSlideAppFromEnv({
    ...env,
    MCP_AUTH_TOKEN: undefined,
  });
  const res = await app.request("/health");

  assertEquals(res.status, 503);
  assertEquals(await res.json(), { error: "MCP_AUTH_TOKEN is required" });
});
