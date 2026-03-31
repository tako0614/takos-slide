/**
 * In-memory presentation store for the MCP server.
 *
 * Mirrors the data model from `types/index.ts` and the helper functions
 * from `lib/storage.ts`, but operates entirely in server memory instead of
 * browser localStorage.
 */

import type { Presentation, Slide, SlideElement } from "./types/index.ts";

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
// PresentationStore
// ---------------------------------------------------------------------------

export interface PresentationStore {
  // Presentation CRUD
  list(): (Pick<Presentation, "id" | "title" | "updatedAt"> &
    { slideCount: number })[];
  create(title: string): Presentation;
  get(id: string): Presentation | undefined;
  delete(id: string): boolean;
  setTitle(id: string, title: string): Presentation;

  // Slide operations
  addSlide(
    presentationId: string,
    index?: number,
    background?: string,
  ): Slide;
  removeSlide(presentationId: string, slideIndex: number): void;
  reorderSlide(
    presentationId: string,
    fromIndex: number,
    toIndex: number,
  ): void;
  setSlideBackground(
    presentationId: string,
    slideIndex: number,
    background: string,
  ): void;
  duplicateSlide(presentationId: string, slideIndex: number): Slide;

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
  ): SlideElement;

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
  ): SlideElement;

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
  ): SlideElement;

  removeElement(
    presentationId: string,
    slideIndex: number,
    elementId: string,
  ): void;

  updateElement(
    presentationId: string,
    slideIndex: number,
    elementId: string,
    properties: Partial<Omit<SlideElement, "id" | "type">>,
  ): SlideElement;

  moveElement(
    presentationId: string,
    slideIndex: number,
    elementId: string,
    x: number,
    y: number,
  ): SlideElement;

  resizeElement(
    presentationId: string,
    slideIndex: number,
    elementId: string,
    width: number,
    height: number,
  ): SlideElement;

  // Export
  exportJson(id: string): Presentation;
  getSlideCount(id: string): number;
}

// ---------------------------------------------------------------------------
// In-memory implementation
// ---------------------------------------------------------------------------

export function createPresentationStore(): PresentationStore {
  const presentations = new Map<string, Presentation>();

  // -- internal helpers -----------------------------------------------------

  function mustGet(id: string): Presentation {
    const p = presentations.get(id);
    if (!p) throw new Error(`Presentation not found: ${id}`);
    return p;
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

  // -- store ----------------------------------------------------------------

  const store: PresentationStore = {
    // Presentation CRUD ---------------------------------------------------

    list() {
      return [...presentations.values()].map((p) => ({
        id: p.id,
        title: p.title,
        slideCount: p.slides.length,
        updatedAt: p.updatedAt,
      }));
    },

    create(title: string) {
      const ts = now();
      const p: Presentation = {
        id: generateId(),
        title,
        slides: [createDefaultSlide()],
        createdAt: ts,
        updatedAt: ts,
      };
      presentations.set(p.id, p);
      return p;
    },

    get(id: string) {
      return presentations.get(id);
    },

    delete(id: string) {
      return presentations.delete(id);
    },

    setTitle(id: string, title: string) {
      const p = mustGet(id);
      p.title = title;
      touch(p);
      return p;
    },

    // Slide operations ----------------------------------------------------

    addSlide(presentationId, index, background) {
      const p = mustGet(presentationId);
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
      return slide;
    },

    removeSlide(presentationId, slideIndex) {
      const p = mustGet(presentationId);
      mustGetSlide(p, slideIndex);
      p.slides.splice(slideIndex, 1);
      touch(p);
    },

    reorderSlide(presentationId, fromIndex, toIndex) {
      const p = mustGet(presentationId);
      mustGetSlide(p, fromIndex);
      if (toIndex < 0 || toIndex >= p.slides.length) {
        throw new Error(
          `toIndex ${toIndex} out of range (0..${p.slides.length - 1})`,
        );
      }
      const [slide] = p.slides.splice(fromIndex, 1);
      p.slides.splice(toIndex, 0, slide);
      touch(p);
    },

    setSlideBackground(presentationId, slideIndex, background) {
      const p = mustGet(presentationId);
      const slide = mustGetSlide(p, slideIndex);
      slide.background = background;
      touch(p);
    },

    duplicateSlide(presentationId, slideIndex) {
      const p = mustGet(presentationId);
      const src = mustGetSlide(p, slideIndex);
      const dup: Slide = {
        id: generateId(),
        background: src.background,
        elements: src.elements.map((e) => ({ ...e, id: generateId() })),
      };
      p.slides.splice(slideIndex + 1, 0, dup);
      touch(p);
      return dup;
    },

    // Element operations --------------------------------------------------

    addTextElement(presentationId, slideIndex, opts) {
      const p = mustGet(presentationId);
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
      return el;
    },

    addShapeElement(presentationId, slideIndex, opts) {
      const p = mustGet(presentationId);
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
      return el;
    },

    addImageElement(presentationId, slideIndex, opts) {
      const p = mustGet(presentationId);
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
      return el;
    },

    removeElement(presentationId, slideIndex, elementId) {
      const p = mustGet(presentationId);
      const slide = mustGetSlide(p, slideIndex);
      const idx = slide.elements.findIndex((e) => e.id === elementId);
      if (idx === -1) throw new Error(`Element not found: ${elementId}`);
      slide.elements.splice(idx, 1);
      touch(p);
    },

    updateElement(presentationId, slideIndex, elementId, properties) {
      const p = mustGet(presentationId);
      const slide = mustGetSlide(p, slideIndex);
      const el = mustGetElement(slide, elementId);
      Object.assign(el, properties);
      touch(p);
      return el;
    },

    moveElement(presentationId, slideIndex, elementId, x, y) {
      const p = mustGet(presentationId);
      const slide = mustGetSlide(p, slideIndex);
      const el = mustGetElement(slide, elementId);
      el.x = x;
      el.y = y;
      touch(p);
      return el;
    },

    resizeElement(presentationId, slideIndex, elementId, width, height) {
      const p = mustGet(presentationId);
      const slide = mustGetSlide(p, slideIndex);
      const el = mustGetElement(slide, elementId);
      el.width = width;
      el.height = height;
      touch(p);
      return el;
    },

    // Export ---------------------------------------------------------------

    exportJson(id: string) {
      return mustGet(id);
    },

    getSlideCount(id: string) {
      return mustGet(id).slides.length;
    },
  };

  return store;
}
