import { atom } from "jotai";
import type { Presentation } from "../types";
import { loadPresentations, savePresentations } from "../lib/storage";

/**
 * All presentations list.
 */
export const presentationsAtom = atom<Presentation[]>(loadPresentations());

/**
 * Writable atom that persists to localStorage on write.
 */
export const persistedPresentationsAtom = atom(
  (get) => get(presentationsAtom),
  (_get, set, update: Presentation[]) => {
    set(presentationsAtom, update);
    savePresentations(update);
  },
);

/**
 * Currently open presentation (by id).
 */
export const currentPresentationIdAtom = atom<string | null>(null);

export const currentPresentationAtom = atom(
  (get) => {
    const id = get(currentPresentationIdAtom);
    if (!id) return null;
    return get(presentationsAtom).find((p) => p.id === id) ?? null;
  },
);

/**
 * Selected slide index within current presentation.
 */
export const selectedSlideIndexAtom = atom<number>(0);

/**
 * Selected element id within current slide.
 */
export const selectedElementIdAtom = atom<string | null>(null);

/**
 * Undo/redo history for the current presentation.
 */
export interface HistoryEntry {
  presentation: Presentation;
}

export const undoStackAtom = atom<HistoryEntry[]>([]);
export const redoStackAtom = atom<HistoryEntry[]>([]);
