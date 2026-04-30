import { assertEquals } from "@std/assert";
import { savePresentation } from "../lib/storage.ts";
import type { Presentation } from "../types/index.ts";

const STORAGE_KEY = "takos-slide-presentations";

function makePresentation(): Presentation {
  const now = "2026-04-30T00:00:00.000Z";
  return {
    id: "presentation-1",
    title: "Deck",
    slides: [{ id: "slide-1", elements: [], background: "#ffffff" }],
    createdAt: now,
    updatedAt: now,
  };
}

Deno.test("client storage normalizes spaceId query to space_id", async () => {
  const originalLocation = Object.getOwnPropertyDescriptor(
    globalThis,
    "location",
  );
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";

  localStorage.removeItem(STORAGE_KEY);
  Object.defineProperty(globalThis, "location", {
    value: new URL("http://localhost/editor?spaceId=space-camel"),
    configurable: true,
  });
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    requestedUrl = input instanceof Request ? input.url : String(input);
    return Promise.resolve(
      new Response(String(init?.body ?? "{}"), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  }) as typeof fetch;

  try {
    await savePresentation(makePresentation()).remote;
    assertEquals(
      requestedUrl,
      "/api/presentations/presentation-1?space_id=space-camel",
    );
  } finally {
    globalThis.fetch = originalFetch;
    localStorage.removeItem(STORAGE_KEY);
    if (originalLocation) {
      Object.defineProperty(globalThis, "location", originalLocation);
    } else {
      delete (globalThis as { location?: Location }).location;
    }
  }
});
