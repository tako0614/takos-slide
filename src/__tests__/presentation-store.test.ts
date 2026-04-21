import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import {
  createPresentationStore,
  sanitizeElementUpdateProperties,
} from "../presentation-store.ts";
import type { StorageFile, TakosStorageClient } from "../lib/takos-storage.ts";

function createMemoryStorageClient(): TakosStorageClient {
  const files = new Map<string, StorageFile>();
  const content = new Map<string, string>();

  const makeFile = (
    name: string,
    type: "file" | "folder",
    parentId?: string,
  ): StorageFile => {
    const now = new Date().toISOString();
    const file = {
      id: crypto.randomUUID(),
      name,
      parentId,
      type,
      createdAt: now,
      updatedAt: now,
    };
    files.set(file.id, file);
    return file;
  };

  return {
    list(prefix?: string) {
      const all = [...files.values()];
      if (!prefix) return Promise.resolve(all);
      const folder = all.find((file) =>
        file.type === "folder" && file.name === prefix
      );
      return Promise.resolve(
        folder ? all.filter((file) => file.parentId === folder.id) : [],
      );
    },
    get(fileId: string) {
      return Promise.resolve(files.get(fileId) ?? null);
    },
    getContent(fileId: string) {
      return Promise.resolve(content.get(fileId) ?? "");
    },
    putContent(fileId: string, value: string) {
      content.set(fileId, value);
      return Promise.resolve();
    },
    create(name: string, parentId?: string) {
      return Promise.resolve(makeFile(name, "file", parentId));
    },
    createFolder(name: string, parentId?: string) {
      return Promise.resolve(makeFile(name, "folder", parentId));
    },
    rename(fileId: string, name: string) {
      const file = files.get(fileId);
      if (file) files.set(fileId, { ...file, name });
      return Promise.resolve();
    },
    delete(fileId: string) {
      files.delete(fileId);
      content.delete(fileId);
      return Promise.resolve();
    },
  };
}

Deno.test("sanitizeElementUpdateProperties allows only valid text updates", () => {
  const patch = sanitizeElementUpdateProperties(
    {
      id: "el",
      type: "text",
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      rotation: 0,
    },
    { text: "Safe", fontSize: 32, bold: true },
  );

  assertEquals(patch, { text: "Safe", fontSize: 32, bold: true });
});

Deno.test("sanitizeElementUpdateProperties rejects cross-type and identity mutation", () => {
  const element = {
    id: "el",
    type: "text" as const,
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    rotation: 0,
  };

  assertThrows(
    () => sanitizeElementUpdateProperties(element, { id: "other" }),
    Error,
    "Cannot update id",
  );
  assertThrows(
    () => sanitizeElementUpdateProperties(element, { shapeType: "rect" }),
    Error,
    "Cannot update shapeType",
  );
});

Deno.test("PresentationStore.updateElement does not mutate on rejected properties", async () => {
  const store = createPresentationStore(createMemoryStorageClient());
  const presentation = await store.create("Deck");
  const element = await store.addTextElement(presentation.id, 0, {
    text: "Original",
    x: 10,
    y: 10,
  });

  await assertRejects(
    () =>
      store.updateElement(presentation.id, 0, element.id, {
        type: "shape",
      } as never),
    Error,
    "Cannot update type",
  );

  const after = await store.get(presentation.id);
  const storedElement = after?.slides[0].elements[0];
  assertEquals(storedElement?.id, element.id);
  assertEquals(storedElement?.type, "text");
  assertEquals(storedElement?.text, "Original");
});
