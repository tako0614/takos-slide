/**
 * MCP Server for takos-slide presentation editing.
 *
 * Exposes:
 * - slide_list / slide_create / slide_get / slide_delete / slide_set_title
 * - slide_add / slide_remove / slide_reorder / slide_set_background / slide_duplicate
 * - slide_add_text / slide_add_shape / slide_add_image
 * - slide_remove_element / slide_update_element / slide_move_element / slide_resize_element
 * - slide_export_json / slide_get_slide_count
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { PresentationStore } from "./presentation-store.ts";

export function createSlideMcpServer(store: PresentationStore): McpServer {
  const server = new McpServer({
    name: "takos-slide",
    version: "1.0.0",
  });

  const text = (s: string) => ({
    content: [{ type: "text" as const, text: s }],
  });
  const json = (v: unknown) => text(JSON.stringify(v, null, 2));

  // =========================================================================
  // Presentation Management
  // =========================================================================

  server.tool(
    "slide_list",
    "List all presentations. Returns id, title, slideCount and updatedAt for each.",
    {},
    async () => json(store.list()),
  );

  server.tool(
    "slide_create",
    "Create a new presentation with one blank slide.",
    { title: z.string().describe("Presentation title") },
    async ({ title }: { title: string }) => json(store.create(title)),
  );

  server.tool(
    "slide_get",
    "Get full presentation data including all slides and elements.",
    { id: z.string().describe("Presentation ID") },
    async ({ id }: { id: string }) => {
      const p = store.get(id);
      if (!p) return text(`Presentation not found: ${id}`);
      return json(p);
    },
  );

  server.tool(
    "slide_delete",
    "Delete a presentation.",
    { id: z.string().describe("Presentation ID") },
    async ({ id }: { id: string }) => {
      const ok = store.delete(id);
      if (!ok) return text(`Presentation not found: ${id}`);
      return text("Deleted");
    },
  );

  server.tool(
    "slide_set_title",
    "Rename a presentation.",
    {
      id: z.string().describe("Presentation ID"),
      title: z.string().describe("New title"),
    },
    async ({ id, title }: { id: string; title: string }) => {
      try {
        return json(store.setTitle(id, title));
      } catch (e) {
        return text(String(e));
      }
    },
  );

  // =========================================================================
  // Slide Operations
  // =========================================================================

  server.tool(
    "slide_add",
    "Add a new blank slide to a presentation.",
    {
      presentationId: z.string().describe("Presentation ID"),
      index: z
        .number()
        .optional()
        .describe("Insert position (0-based). Appended if omitted."),
      background: z
        .string()
        .optional()
        .describe('CSS color or gradient (default: "#ffffff")'),
    },
    async ({
      presentationId,
      index,
      background,
    }: {
      presentationId: string;
      index?: number;
      background?: string;
    }) => {
      try {
        return json(store.addSlide(presentationId, index, background));
      } catch (e) {
        return text(String(e));
      }
    },
  );

  server.tool(
    "slide_remove",
    "Remove a slide from a presentation.",
    {
      presentationId: z.string().describe("Presentation ID"),
      slideIndex: z.number().describe("0-based slide index"),
    },
    async ({
      presentationId,
      slideIndex,
    }: {
      presentationId: string;
      slideIndex: number;
    }) => {
      try {
        store.removeSlide(presentationId, slideIndex);
        return text("Removed");
      } catch (e) {
        return text(String(e));
      }
    },
  );

  server.tool(
    "slide_reorder",
    "Move a slide from one position to another.",
    {
      presentationId: z.string().describe("Presentation ID"),
      fromIndex: z.number().describe("Current 0-based index"),
      toIndex: z.number().describe("Target 0-based index"),
    },
    async ({
      presentationId,
      fromIndex,
      toIndex,
    }: {
      presentationId: string;
      fromIndex: number;
      toIndex: number;
    }) => {
      try {
        store.reorderSlide(presentationId, fromIndex, toIndex);
        return text("Reordered");
      } catch (e) {
        return text(String(e));
      }
    },
  );

  server.tool(
    "slide_set_background",
    "Set the background of a slide (CSS color or gradient).",
    {
      presentationId: z.string().describe("Presentation ID"),
      slideIndex: z.number().describe("0-based slide index"),
      background: z.string().describe("CSS color or gradient value"),
    },
    async ({
      presentationId,
      slideIndex,
      background,
    }: {
      presentationId: string;
      slideIndex: number;
      background: string;
    }) => {
      try {
        store.setSlideBackground(presentationId, slideIndex, background);
        return text("Background updated");
      } catch (e) {
        return text(String(e));
      }
    },
  );

  server.tool(
    "slide_duplicate",
    "Duplicate a slide (inserted immediately after the original).",
    {
      presentationId: z.string().describe("Presentation ID"),
      slideIndex: z.number().describe("0-based slide index to duplicate"),
    },
    async ({
      presentationId,
      slideIndex,
    }: {
      presentationId: string;
      slideIndex: number;
    }) => {
      try {
        return json(store.duplicateSlide(presentationId, slideIndex));
      } catch (e) {
        return text(String(e));
      }
    },
  );

  // =========================================================================
  // Element Operations
  // =========================================================================

  server.tool(
    "slide_add_text",
    "Add a text box element to a slide.",
    {
      presentationId: z.string().describe("Presentation ID"),
      slideIndex: z.number().describe("0-based slide index"),
      text: z.string().describe("Text content"),
      x: z.number().describe("X position in pixels"),
      y: z.number().describe("Y position in pixels"),
      width: z.number().optional().describe("Width in pixels (default: 300)"),
      height: z.number().optional().describe("Height in pixels (default: 60)"),
      fontSize: z
        .number()
        .optional()
        .describe("Font size in pixels (default: 24)"),
      fontColor: z
        .string()
        .optional()
        .describe('Font color CSS value (default: "#333333")'),
      bold: z.boolean().optional().describe("Bold text (default: false)"),
      italic: z.boolean().optional().describe("Italic text (default: false)"),
    },
    async (args: {
      presentationId: string;
      slideIndex: number;
      text: string;
      x: number;
      y: number;
      width?: number;
      height?: number;
      fontSize?: number;
      fontColor?: string;
      bold?: boolean;
      italic?: boolean;
    }) => {
      try {
        return json(
          store.addTextElement(args.presentationId, args.slideIndex, {
            text: args.text,
            x: args.x,
            y: args.y,
            width: args.width,
            height: args.height,
            fontSize: args.fontSize,
            fontColor: args.fontColor,
            bold: args.bold,
            italic: args.italic,
          }),
        );
      } catch (e) {
        return text(String(e));
      }
    },
  );

  server.tool(
    "slide_add_shape",
    "Add a shape element to a slide.",
    {
      presentationId: z.string().describe("Presentation ID"),
      slideIndex: z.number().describe("0-based slide index"),
      shapeType: z
        .enum(["rect", "ellipse", "triangle", "arrow"])
        .describe("Shape type"),
      x: z.number().describe("X position in pixels"),
      y: z.number().describe("Y position in pixels"),
      width: z.number().describe("Width in pixels"),
      height: z.number().describe("Height in pixels"),
      fillColor: z
        .string()
        .optional()
        .describe('Fill color (default: "#4f87e0")'),
      strokeColor: z
        .string()
        .optional()
        .describe('Stroke color (default: "#2563eb")'),
    },
    async (args: {
      presentationId: string;
      slideIndex: number;
      shapeType: "rect" | "ellipse" | "triangle" | "arrow";
      x: number;
      y: number;
      width: number;
      height: number;
      fillColor?: string;
      strokeColor?: string;
    }) => {
      try {
        return json(
          store.addShapeElement(args.presentationId, args.slideIndex, {
            shapeType: args.shapeType,
            x: args.x,
            y: args.y,
            width: args.width,
            height: args.height,
            fillColor: args.fillColor,
            strokeColor: args.strokeColor,
          }),
        );
      } catch (e) {
        return text(String(e));
      }
    },
  );

  server.tool(
    "slide_add_image",
    "Add an image element to a slide.",
    {
      presentationId: z.string().describe("Presentation ID"),
      slideIndex: z.number().describe("0-based slide index"),
      imageUrl: z.string().describe("Image URL"),
      x: z.number().describe("X position in pixels"),
      y: z.number().describe("Y position in pixels"),
      width: z.number().optional().describe("Width in pixels (default: 300)"),
      height: z.number().optional().describe("Height in pixels (default: 200)"),
    },
    async (args: {
      presentationId: string;
      slideIndex: number;
      imageUrl: string;
      x: number;
      y: number;
      width?: number;
      height?: number;
    }) => {
      try {
        return json(
          store.addImageElement(args.presentationId, args.slideIndex, {
            imageUrl: args.imageUrl,
            x: args.x,
            y: args.y,
            width: args.width,
            height: args.height,
          }),
        );
      } catch (e) {
        return text(String(e));
      }
    },
  );

  server.tool(
    "slide_remove_element",
    "Remove an element from a slide.",
    {
      presentationId: z.string().describe("Presentation ID"),
      slideIndex: z.number().describe("0-based slide index"),
      elementId: z.string().describe("Element ID"),
    },
    async ({
      presentationId,
      slideIndex,
      elementId,
    }: {
      presentationId: string;
      slideIndex: number;
      elementId: string;
    }) => {
      try {
        store.removeElement(presentationId, slideIndex, elementId);
        return text("Removed");
      } catch (e) {
        return text(String(e));
      }
    },
  );

  server.tool(
    "slide_update_element",
    "Update properties of an existing element.",
    {
      presentationId: z.string().describe("Presentation ID"),
      slideIndex: z.number().describe("0-based slide index"),
      elementId: z.string().describe("Element ID"),
      properties: z
        .record(z.unknown())
        .describe(
          "Partial element properties to merge (e.g. { text, fontSize, fillColor, ... })",
        ),
    },
    async ({
      presentationId,
      slideIndex,
      elementId,
      properties,
    }: {
      presentationId: string;
      slideIndex: number;
      elementId: string;
      properties: Record<string, unknown>;
    }) => {
      try {
        return json(
          store.updateElement(
            presentationId,
            slideIndex,
            elementId,
            properties,
          ),
        );
      } catch (e) {
        return text(String(e));
      }
    },
  );

  server.tool(
    "slide_move_element",
    "Move an element to a new position.",
    {
      presentationId: z.string().describe("Presentation ID"),
      slideIndex: z.number().describe("0-based slide index"),
      elementId: z.string().describe("Element ID"),
      x: z.number().describe("New X position in pixels"),
      y: z.number().describe("New Y position in pixels"),
    },
    async ({
      presentationId,
      slideIndex,
      elementId,
      x,
      y,
    }: {
      presentationId: string;
      slideIndex: number;
      elementId: string;
      x: number;
      y: number;
    }) => {
      try {
        return json(
          store.moveElement(presentationId, slideIndex, elementId, x, y),
        );
      } catch (e) {
        return text(String(e));
      }
    },
  );

  server.tool(
    "slide_resize_element",
    "Resize an element.",
    {
      presentationId: z.string().describe("Presentation ID"),
      slideIndex: z.number().describe("0-based slide index"),
      elementId: z.string().describe("Element ID"),
      width: z.number().describe("New width in pixels"),
      height: z.number().describe("New height in pixels"),
    },
    async ({
      presentationId,
      slideIndex,
      elementId,
      width,
      height,
    }: {
      presentationId: string;
      slideIndex: number;
      elementId: string;
      width: number;
      height: number;
    }) => {
      try {
        return json(
          store.resizeElement(
            presentationId,
            slideIndex,
            elementId,
            width,
            height,
          ),
        );
      } catch (e) {
        return text(String(e));
      }
    },
  );

  // =========================================================================
  // Export
  // =========================================================================

  server.tool(
    "slide_export_json",
    "Export a presentation as JSON.",
    { id: z.string().describe("Presentation ID") },
    async ({ id }: { id: string }) => {
      try {
        return json(store.exportJson(id));
      } catch (e) {
        return text(String(e));
      }
    },
  );

  server.tool(
    "slide_get_slide_count",
    "Get the number of slides in a presentation.",
    { id: z.string().describe("Presentation ID") },
    async ({ id }: { id: string }) => {
      try {
        return json({ slideCount: store.getSlideCount(id) });
      } catch (e) {
        return text(String(e));
      }
    },
  );

  return server;
}
