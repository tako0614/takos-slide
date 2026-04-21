import type { Presentation, Slide, SlideElement } from "../types/index.ts";

const STORAGE_KEY = "takos-slide-presentations";
const API_PRESENTATIONS_PATH = "/api/presentations";

function redirectToLogin(): void {
  const location = globalThis.location;
  if (!location) return;
  const returnTo = `${location.pathname}${location.search}${location.hash}`;
  location.href = `/api/auth/login?return_to=${encodeURIComponent(returnTo)}`;
}

export function clearPresentationsCache(): void {
  localStorage.removeItem(STORAGE_KEY);
}

async function requestJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    credentials: "same-origin",
  });
  if (response.status === 401) {
    clearPresentationsCache();
    redirectToLogin();
  }
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return await response.json() as T;
}

function syncPresentationToApi(presentation: Presentation): void {
  void requestJson<Presentation>(
    `${API_PRESENTATIONS_PATH}/${encodeURIComponent(presentation.id)}`,
    {
      method: "PUT",
      body: JSON.stringify(presentation),
    },
  ).catch(() => undefined);
}

function deletePresentationFromApi(id: string): void {
  void fetch(`${API_PRESENTATIONS_PATH}/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "same-origin",
  }).then((response) => {
    if (response.status === 401) {
      clearPresentationsCache();
      redirectToLogin();
    }
  }).catch(() => undefined);
}

export async function loadPresentationsFromApi(): Promise<Presentation[]> {
  const presentations = await requestJson<Presentation[]>(
    API_PRESENTATIONS_PATH,
  );
  savePresentations(presentations);
  return presentations;
}

function generateId(): string {
  return crypto.randomUUID();
}

export function loadPresentations(): Presentation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Presentation[];
  } catch {
    return [];
  }
}

export function savePresentations(presentations: Presentation[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presentations));
}

export function createDefaultSlide(): Slide {
  return {
    id: generateId(),
    elements: [],
    background: "#ffffff",
  };
}

export function createPresentation(title: string): Presentation {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    title,
    slides: [createDefaultSlide()],
    createdAt: now,
    updatedAt: now,
  };
}

export function savePresentation(presentation: Presentation): Presentation[] {
  const presentations = loadPresentations();
  const index = presentations.findIndex((p) => p.id === presentation.id);
  const updated = {
    ...presentation,
    updatedAt: new Date().toISOString(),
  };
  if (index >= 0) {
    presentations[index] = updated;
  } else {
    presentations.push(updated);
  }
  savePresentations(presentations);
  syncPresentationToApi(updated);
  return presentations;
}

export function deletePresentation(id: string): Presentation[] {
  const presentations = loadPresentations().filter((p) => p.id !== id);
  savePresentations(presentations);
  deletePresentationFromApi(id);
  return presentations;
}

export function getPresentation(id: string): Presentation | undefined {
  return loadPresentations().find((p) => p.id === id);
}

export function createTextElement(
  x: number,
  y: number,
): SlideElement {
  return {
    id: generateId(),
    type: "text",
    x,
    y,
    width: 300,
    height: 60,
    rotation: 0,
    text: "Text",
    fontSize: 24,
    fontFamily: "Inter, sans-serif",
    fontColor: "#333333",
    textAlign: "center",
    bold: false,
    italic: false,
  };
}

export function createShapeElement(
  shapeType: "rect" | "ellipse" | "triangle" | "arrow",
  x: number,
  y: number,
): SlideElement {
  return {
    id: generateId(),
    type: "shape",
    x,
    y,
    width: 200,
    height: 150,
    rotation: 0,
    shapeType,
    fillColor: "#4f87e0",
    strokeColor: "#2563eb",
    strokeWidth: 2,
  };
}

export function createImageElement(
  imageUrl: string,
  x: number,
  y: number,
): SlideElement {
  return {
    id: generateId(),
    type: "image",
    x,
    y,
    width: 300,
    height: 200,
    rotation: 0,
    imageUrl,
  };
}
