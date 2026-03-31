/**
 * PresentationStore backed by the takos platform storage API.
 *
 * Each presentation is stored as a JSON file under a `/takos-slide/` folder:
 *   - File name: `{id}.json`
 *   - Content: full Presentation object serialised as JSON
 *
 * The store keeps an in-memory cache that is hydrated on first access
 * and written through on every mutation.
 */

import type { Presentation, Slide, SlideElement } from "./types/index.ts";
import type { TakosStorageClient } from "./lib/takos-storage.ts";

const FOLDER_NAME = "takos-slide";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

function createDefaultSlide(): Slide {
  return {
    id: generateId(),
    elements: [],
    background: "#ffffff",
  };
}

// ---------------------------------------------------------------------------
// PresentationStore interface (all methods are now async)
// ---------------------------------------------------------------------------

export interface PresentationStore {
  // Presentation CRUD
  list(): Promise<
    (Pick<Presentation, "id" | "title" | "updatedAt"> & { slideCount: number })[]
  >;
  create(title: string): Promise<Presentation>;
  get(id: string): Promise<Presentation | undefined>;
  delete(id: string): Promise<boolean>;
  setTitle(id: string, title: string): Promise<Presentation>;

  // Slide operations
  addSlide(
    presentationId: string,
    index?: number,
    background?: string,
  ): Promise<Slide>;
  removeSlide(presentationId: string, slideIndex: number): Promise<void>;
  reorderSlide(
    presentationId: string,
    fromIndex: number,
    toIndex: number,
  ): Promise<void>;
  setSlideBackground(
    presentationId: string,
    slideIndex: number,
    background: string,
  ): Promise<void>;
  duplicateSlide(presentationId: string, slideIndex: number): Promise<Slide>;

  // Element operations
  addTextElement(
    presentationId: string,
    slideIndex: number,
    opts: {
      text: string;
      x: number;
      y: number;
      width?: number;
      height?: number;
      fontSize?: number;
      fontColor?: string;
      bold?: boolean;
      italic?: boolean;
    },
  ): Promise<SlideElement>;

  addShapeElement(
    presentationId: string,
    slideIndex: number,
    opts: {
      shapeType: "rect" | "ellipse" | "triangle" | "arrow";
      x: number;
      y: number;
      width: number;
      height: number;
      fillColor?: string;
      strokeColor?: string;
    },
  ): Promise<SlideElement>;

  addImageElement(
    presentationId: string,
    slideIndex: number,
    opts: {
      imageUrl: string;
      x: number;
      y: number;
      width?: number;
      height?: number;
    },
  ): Promise<SlideElement>;

  removeElement(
    presentationId: string,
    slideIndex: number,
    elementId: string,
  ): Promise<void>;

  updateElement(
    presentationId: string,
    slideIndex: number,
    elementId: string,
    properties: Partial<Omit<SlideElement, "id" | "type">>,
  ): Promise<SlideElement>;

  moveElement(
    presentationId: string,
    slideIndex: number,
    elementId: string,
    x: number,
    y: number,
  ): Promise<SlideElement>;

  resizeElement(
    presentationId: string,
    slideIndex: number,
    elementId: string,
    width: number,
    height: number,
  ): Promise<SlideElement>;

  // Export
  exportJson(id: string): Promise<Presentation>;
  getSlideCount(id: string): Promise<number>;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export function createPresentationStore(
  client: TakosStorageClient,
): PresentationStore {
  /** presentation.id -> { presentation, fileId } */
  const cache = new Map<string, { p: Presentation; fileId: string }>();
  let folderId: string | null = null;
  let initialized = false;

  // -- internal helpers ----------------------------------------------------

  async function ensureInitialized(): Promise<void> {
    if (initialized) return;

    // Find or create the app folder
    const files = await client.list();
    const folder = files.find(
      (f) => f.type === "folder" && f.name === FOLDER_NAME,
    );
    if (folder) {
      folderId = folder.id;
    } else {
      const created = await client.createFolder(FOLDER_NAME);
      folderId = created.id;
    }

    // Load all presentation files
    const allFiles = await client.list(FOLDER_NAME);
    for (const file of allFiles) {
      if (file.type !== "file" || !file.name.endsWith(".json")) continue;
      try {
        const raw = await client.getContent(file.id);
        const p = JSON.parse(raw) as Presentation;
        cache.set(p.id, { p, fileId: file.id });
      } catch {
        console.warn(
          `[takos-slide] Skipping unreadable file: ${file.name}`,
        );
      }
    }

    initialized = true;
  }

  async function persist(id: string): Promise<void> {
    const entry = cache.get(id);
    if (!entry) return;
    await client.putContent(entry.fileId, JSON.stringify(entry.p));
  }

  async function mustGet(
    id: string,
  ): Promise<{ p: Presentation; fileId: string }> {
    await ensureInitialized();
    const entry = cache.get(id);
    if (!entry) throw new Error(`Presentation not found: ${id}`);
    return entry;
  }

  function mustGetSlide(p: Presentation, slideIndex: number): Slide {
    const slide = p.slides[slideIndex];
    if (!slide) {
      throw new Error(
        `Slide index ${slideIndex} out of range (0..${p.slides.length - 1})`,
      );
    }
    return slide;
  }

  function mustGetElement(slide: Slide, elementId: string): SlideElement {
    const el = slide.elements.find((e) => e.id === elementId);
    if (!el) throw new Error(`Element not found: ${elementId}`);
    return el;
  }

  function touch(p: Presentation): void {
    p.updatedAt = now();
  }

  // -- store ---------------------------------------------------------------

  const store: PresentationStore = {
    // Presentation CRUD ---------------------------------------------------

    async list() {
      await ensureInitialized();
      return [...cache.values()].map((e) => ({
        id: e.p.id,
        title: e.p.title,
        slideCount: e.p.slides.length,
        updatedAt: e.p.updatedAt,
      }));
    },

    async create(title: string) {
      await ensureInitialized();
      const ts = now();
      const p: Presentation = {
        id: generateId(),
        title,
        slides: [createDefaultSlide()],
        createdAt: ts,
        updatedAt: ts,
      };
      const file = await client.create(
        `${p.id}.json`,
        folderId ?? undefined,
      );
      await client.putContent(file.id, JSON.stringify(p));
      cache.set(p.id, { p, fileId: file.id });
      return p;
    },

    async get(id: string) {
      await ensureInitialized();
      return cache.get(id)?.p;
    },

    async delete(id: string) {
      await ensureInitialized();
      const entry = cache.get(id);
      if (!entry) return false;
      await client.delete(entry.fileId);
      cache.delete(id);
      return true;
    },

    async setTitle(id: string, title: string) {
      const { p } = await mustGet(id);
      p.title = title;
      touch(p);
      await persist(id);
      return p;
    },

    // Slide operations ----------------------------------------------------

    async addSlide(presentationId, index, background) {
      const { p } = await mustGet(presentationId);
      const slide: Slide = {
        id: generateId(),
        elements: [],
        background: background ?? "#ffffff",
      };
      if (index !== undefined && index >= 0 && index <= p.slides.length) {
        p.slides.splice(index, 0, slide);
      } else {
        p.slides.push(slide);
      }
      touch(p);
      await persist(presentationId);
      return slide;
    },

    async removeSlide(presentationId, slideIndex) {
      const { p } = await mustGet(presentationId);
      mustGetSlide(p, slideIndex);
      p.slides.splice(slideIndex, 1);
      touch(p);
      await persist(presentationId);
    },

    async reorderSlide(presentationId, fromIndex, toIndex) {
      const { p } = await mustGet(presentationId);
      mustGetSlide(p, fromIndex);
      if (toIndex < 0 || toIndex >= p.slides.length) {
        throw new Error(
          `toIndex ${toIndex} out of range (0..${p.slides.length - 1})`,
        );
      }
      const [slide] = p.slides.splice(fromIndex, 1);
      p.slides.splice(toIndex, 0, slide);
      touch(p);
      await persist(presentationId);
    },

    async setSlideBackground(presentationId, slideIndex, background) {
      const { p } = await mustGet(presentationId);
      const slide = mustGetSlide(p, slideIndex);
      slide.background = background;
      touch(p);
      await persist(presentationId);
    },

    async duplicateSlide(presentationId, slideIndex) {
      const { p } = await mustGet(presentationId);
      const src = mustGetSlide(p, slideIndex);
      const dup: Slide = {
        id: generateId(),
        background: src.background,
        elements: src.elements.map((e) => ({ ...e, id: generateId() })),
      };
      p.slides.splice(slideIndex + 1, 0, dup);
      touch(p);
      await persist(presentationId);
      return dup;
    },

    // Element operations --------------------------------------------------

    async addTextElement(presentationId, slideIndex, opts) {
      const { p } = await mustGet(presentationId);
      const slide = mustGetSlide(p, slideIndex);
      const el: SlideElement = {
        id: generateId(),
        type: "text",
        x: opts.x,
        y: opts.y,
        width: opts.width ?? 300,
        height: opts.height ?? 60,
        rotation: 0,
        text: opts.text,
        fontSize: opts.fontSize ?? 24,
        fontFamily: "Inter, sans-serif",
        fontColor: opts.fontColor ?? "#333333",
        textAlign: "center",
        bold: opts.bold ?? false,
        italic: opts.italic ?? false,
      };
      slide.elements.push(el);
      touch(p);
      await persist(presentationId);
      return el;
    },

    async addShapeElement(presentationId, slideIndex, opts) {
      const { p } = await mustGet(presentationId);
      const slide = mustGetSlide(p, slideIndex);
      const el: SlideElement = {
        id: generateId(),
        type: "shape",
        x: opts.x,
        y: opts.y,
        width: opts.width,
        height: opts.height,
        rotation: 0,
        shapeType: opts.shapeType,
        fillColor: opts.fillColor ?? "#4f87e0",
        strokeColor: opts.strokeColor ?? "#2563eb",
        strokeWidth: 2,
      };
      slide.elements.push(el);
      touch(p);
      await persist(presentationId);
      return el;
    },

    async addImageElement(presentationId, slideIndex, opts) {
      const { p } = await mustGet(presentationId);
      const slide = mustGetSlide(p, slideIndex);
      const el: SlideElement = {
        id: generateId(),
        type: "image",
        x: opts.x,
        y: opts.y,
        width: opts.width ?? 300,
        height: opts.height ?? 200,
        rotation: 0,
        imageUrl: opts.imageUrl,
      };
      slide.elements.push(el);
      touch(p);
      await persist(presentationId);
      return el;
    },

    async removeElement(presentationId, slideIndex, elementId) {
      const { p } = await mustGet(presentationId);
      const slide = mustGetSlide(p, slideIndex);
      const idx = slide.elements.findIndex((e) => e.id === elementId);
      if (idx === -1) throw new Error(`Element not found: ${elementId}`);
      slide.elements.splice(idx, 1);
      touch(p);
      await persist(presentationId);
    },

    async updateElement(presentationId, slideIndex, elementId, properties) {
      const { p } = await mustGet(presentationId);
      const slide = mustGetSlide(p, slideIndex);
      const el = mustGetElement(slide, elementId);
      Object.assign(el, properties);
      touch(p);
      await persist(presentationId);
      return el;
    },

    async moveElement(presentationId, slideIndex, elementId, x, y) {
      const { p } = await mustGet(presentationId);
      const slide = mustGetSlide(p, slideIndex);
      const el = mustGetElement(slide, elementId);
      el.x = x;
      el.y = y;
      touch(p);
      await persist(presentationId);
      return el;
    },

    async resizeElement(presentationId, slideIndex, elementId, width, height) {
      const { p } = await mustGet(presentationId);
      const slide = mustGetSlide(p, slideIndex);
      const el = mustGetElement(slide, elementId);
      el.width = width;
      el.height = height;
      touch(p);
      await persist(presentationId);
      return el;
    },

    // Export ---------------------------------------------------------------

    async exportJson(id: string) {
      const { p } = await mustGet(id);
      return p;
    },

    async getSlideCount(id: string) {
      const { p } = await mustGet(id);
      return p.slides.length;
    },
  };

  return store;
}
