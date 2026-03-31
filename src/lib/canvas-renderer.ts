import type { Slide, SlideElement } from "../types";

const SLIDE_ASPECT = 16 / 9;

/**
 * Render a full slide onto a canvas context.
 */
export function renderSlide(
  ctx: CanvasRenderingContext2D,
  slide: Slide,
  width: number,
  height: number,
  options?: {
    selectedElementId?: string | null;
    showHandles?: boolean;
    scale?: number;
  },
): void {
  const scale = options?.scale ?? 1;
  ctx.save();
  ctx.clearRect(0, 0, width, height);

  // Background
  ctx.fillStyle = slide.background;
  ctx.fillRect(0, 0, width, height);

  // Scale to fit
  ctx.scale(scale, scale);

  // Render each element
  for (const element of slide.elements) {
    renderElement(ctx, element);
  }

  // Selection indicator
  if (options?.selectedElementId && options.showHandles) {
    const selected = slide.elements.find(
      (e) => e.id === options.selectedElementId,
    );
    if (selected) {
      drawSelectionHandles(ctx, selected);
    }
  }

  ctx.restore();
}

/**
 * Render an individual element.
 */
export function renderElement(
  ctx: CanvasRenderingContext2D,
  element: SlideElement,
): void {
  ctx.save();

  // Apply rotation
  if (element.rotation !== 0) {
    const cx = element.x + element.width / 2;
    const cy = element.y + element.height / 2;
    ctx.translate(cx, cy);
    ctx.rotate((element.rotation * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }

  switch (element.type) {
    case "text":
      renderTextElement(ctx, element);
      break;
    case "shape":
      renderShapeElement(ctx, element);
      break;
    case "image":
      renderImageElement(ctx, element);
      break;
  }

  ctx.restore();
}

function renderTextElement(
  ctx: CanvasRenderingContext2D,
  element: SlideElement,
): void {
  const fontSize = element.fontSize ?? 24;
  const fontFamily = element.fontFamily ?? "Inter, sans-serif";
  const bold = element.bold ? "bold " : "";
  const italic = element.italic ? "italic " : "";

  ctx.font = `${italic}${bold}${fontSize}px ${fontFamily}`;
  ctx.fillStyle = element.fontColor ?? "#333333";
  ctx.textBaseline = "top";

  const align = element.textAlign ?? "left";
  ctx.textAlign = align;

  const text = element.text ?? "";
  const lines = wrapText(ctx, text, element.width - 16);
  const lineHeight = fontSize * 1.3;

  let textX = element.x + 8;
  if (align === "center") {
    textX = element.x + element.width / 2;
  } else if (align === "right") {
    textX = element.x + element.width - 8;
  }

  for (let i = 0; i < lines.length; i++) {
    const y = element.y + 8 + i * lineHeight;
    if (y + lineHeight > element.y + element.height) break;
    ctx.fillText(lines[i], textX, y);
  }
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  if (maxWidth <= 0) return [text];
  const paragraphs = text.split("\n");
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.split(" ");
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    lines.push(currentLine);
  }

  return lines;
}

function renderShapeElement(
  ctx: CanvasRenderingContext2D,
  element: SlideElement,
): void {
  const fillColor = element.fillColor ?? "#4f87e0";
  const strokeColor = element.strokeColor ?? "#2563eb";
  const strokeWidth = element.strokeWidth ?? 2;

  ctx.fillStyle = fillColor;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth;

  switch (element.shapeType) {
    case "rect":
      ctx.beginPath();
      ctx.roundRect(
        element.x,
        element.y,
        element.width,
        element.height,
        4,
      );
      ctx.fill();
      if (strokeWidth > 0) ctx.stroke();
      break;

    case "ellipse":
      ctx.beginPath();
      ctx.ellipse(
        element.x + element.width / 2,
        element.y + element.height / 2,
        element.width / 2,
        element.height / 2,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      if (strokeWidth > 0) ctx.stroke();
      break;

    case "triangle":
      ctx.beginPath();
      ctx.moveTo(element.x + element.width / 2, element.y);
      ctx.lineTo(element.x + element.width, element.y + element.height);
      ctx.lineTo(element.x, element.y + element.height);
      ctx.closePath();
      ctx.fill();
      if (strokeWidth > 0) ctx.stroke();
      break;

    case "arrow": {
      const midY = element.y + element.height / 2;
      const shaftTop = element.y + element.height * 0.3;
      const shaftBottom = element.y + element.height * 0.7;
      const headStart = element.x + element.width * 0.6;

      ctx.beginPath();
      // Shaft
      ctx.moveTo(element.x, shaftTop);
      ctx.lineTo(headStart, shaftTop);
      // Arrow head
      ctx.lineTo(headStart, element.y);
      ctx.lineTo(element.x + element.width, midY);
      ctx.lineTo(headStart, element.y + element.height);
      ctx.lineTo(headStart, shaftBottom);
      // Back along bottom
      ctx.lineTo(element.x, shaftBottom);
      ctx.closePath();
      ctx.fill();
      if (strokeWidth > 0) ctx.stroke();
      break;
    }

    default:
      // Fallback rectangle
      ctx.fillRect(element.x, element.y, element.width, element.height);
      if (strokeWidth > 0) {
        ctx.strokeRect(element.x, element.y, element.width, element.height);
      }
  }
}

function renderImageElement(
  ctx: CanvasRenderingContext2D,
  element: SlideElement,
): void {
  // Draw a placeholder frame for images
  ctx.fillStyle = "#374151";
  ctx.fillRect(element.x, element.y, element.width, element.height);
  ctx.strokeStyle = "#6b7280";
  ctx.lineWidth = 2;
  ctx.strokeRect(element.x, element.y, element.width, element.height);

  // Image icon placeholder
  ctx.fillStyle = "#9ca3af";
  ctx.font = "14px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    "Image",
    element.x + element.width / 2,
    element.y + element.height / 2,
  );

  // If there's an actual image URL, try to load it
  if (element.imageUrl) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      ctx.drawImage(img, element.x, element.y, element.width, element.height);
    };
    img.src = element.imageUrl;
  }
}

function drawSelectionHandles(
  ctx: CanvasRenderingContext2D,
  element: SlideElement,
): void {
  const { x, y, width, height } = element;
  const handleSize = 8;

  // Selection border
  ctx.strokeStyle = "#3b82f6";
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.strokeRect(x - 1, y - 1, width + 2, height + 2);

  // Corner handles
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#3b82f6";
  ctx.lineWidth = 2;

  const handles = [
    { hx: x, hy: y },
    { hx: x + width, hy: y },
    { hx: x, hy: y + height },
    { hx: x + width, hy: y + height },
    // Edge midpoints
    { hx: x + width / 2, hy: y },
    { hx: x + width / 2, hy: y + height },
    { hx: x, hy: y + height / 2 },
    { hx: x + width, hy: y + height / 2 },
  ];

  for (const h of handles) {
    ctx.fillRect(
      h.hx - handleSize / 2,
      h.hy - handleSize / 2,
      handleSize,
      handleSize,
    );
    ctx.strokeRect(
      h.hx - handleSize / 2,
      h.hy - handleSize / 2,
      handleSize,
      handleSize,
    );
  }
}

/**
 * Generate a thumbnail canvas for a slide.
 */
export function renderThumbnail(
  slide: Slide,
  thumbWidth = 192,
): HTMLCanvasElement {
  const thumbHeight = thumbWidth / SLIDE_ASPECT;
  const canvas = document.createElement("canvas");
  canvas.width = thumbWidth;
  canvas.height = thumbHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  // The slide coordinates are in a 960x540 space
  const scaleX = thumbWidth / 960;
  const scaleY = thumbHeight / 540;

  ctx.save();
  ctx.clearRect(0, 0, thumbWidth, thumbHeight);
  ctx.fillStyle = slide.background;
  ctx.fillRect(0, 0, thumbWidth, thumbHeight);
  ctx.scale(scaleX, scaleY);

  for (const element of slide.elements) {
    renderElement(ctx, element);
  }

  ctx.restore();
  return canvas;
}

/**
 * Hit-test: find which element is at (px, py) in slide coordinates.
 * Returns the top-most element or null.
 */
export function hitTestElements(
  elements: SlideElement[],
  px: number,
  py: number,
): SlideElement | null {
  // Iterate in reverse (top-most first)
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (
      px >= el.x &&
      px <= el.x + el.width &&
      py >= el.y &&
      py <= el.y + el.height
    ) {
      return el;
    }
  }
  return null;
}

/**
 * Determine which resize handle is at the given position.
 * Returns handle id or null.
 */
export type ResizeHandle =
  | "nw"
  | "ne"
  | "sw"
  | "se"
  | "n"
  | "s"
  | "w"
  | "e";

export function hitTestHandles(
  element: SlideElement,
  px: number,
  py: number,
  handleSize = 10,
): ResizeHandle | null {
  const { x, y, width, height } = element;
  const hs = handleSize;

  const handles: { id: ResizeHandle; hx: number; hy: number }[] = [
    { id: "nw", hx: x, hy: y },
    { id: "ne", hx: x + width, hy: y },
    { id: "sw", hx: x, hy: y + height },
    { id: "se", hx: x + width, hy: y + height },
    { id: "n", hx: x + width / 2, hy: y },
    { id: "s", hx: x + width / 2, hy: y + height },
    { id: "w", hx: x, hy: y + height / 2 },
    { id: "e", hx: x + width, hy: y + height / 2 },
  ];

  for (const h of handles) {
    if (
      px >= h.hx - hs / 2 &&
      px <= h.hx + hs / 2 &&
      py >= h.hy - hs / 2 &&
      py <= h.hy + hs / 2
    ) {
      return h.id;
    }
  }
  return null;
}
