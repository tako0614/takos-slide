export type SlideElementType = "text" | "shape" | "image";

export interface SlideElement {
  id: string;
  type: SlideElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  // text
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontColor?: string;
  textAlign?: "left" | "center" | "right";
  bold?: boolean;
  italic?: boolean;
  // shape
  shapeType?: "rect" | "ellipse" | "triangle" | "arrow";
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  // image
  imageUrl?: string;
}

export interface Slide {
  id: string;
  elements: SlideElement[];
  background: string; // CSS color or gradient
}

export interface Presentation {
  id: string;
  title: string;
  slides: Slide[];
  createdAt: string;
  updatedAt: string;
}
