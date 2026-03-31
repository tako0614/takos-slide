import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js";
import { useNavigate, useParams } from "@solidjs/router";
import type { Presentation } from "../types";
import { getPresentation } from "../lib/storage";
import { renderSlide } from "../lib/canvas-renderer";

const SLIDE_W = 960;
const SLIDE_H = 540;

export default function PresentPage() {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [presentation, setPresentation] = createSignal<Presentation | null>(
    null,
  );
  const [currentIndex, setCurrentIndex] = createSignal(0);
  let canvasRef: HTMLCanvasElement | undefined;

  onMount(() => {
    const pres = getPresentation(params.id);
    if (!pres) {
      navigate("/");
      return;
    }
    setPresentation(pres);

    // Request fullscreen
    document.documentElement.requestFullscreen?.().catch(() => {
      // Fullscreen might be blocked; continue anyway
    });
  });

  const exitPresentation = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    }
    navigate(`/slide/${params.id}`);
  };

  const totalSlides = () => presentation()?.slides.length ?? 0;

  const nextSlide = () => {
    if (currentIndex() < totalSlides() - 1) {
      setCurrentIndex((i) => i + 1);
    }
  };

  const prevSlide = () => {
    if (currentIndex() > 0) {
      setCurrentIndex((i) => i - 1);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
      case " ":
      case "Enter":
        e.preventDefault();
        nextSlide();
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        prevSlide();
        break;
      case "Escape":
        exitPresentation();
        break;
      case "Home":
        setCurrentIndex(0);
        break;
      case "End":
        setCurrentIndex(totalSlides() - 1);
        break;
    }
  };

  document.addEventListener("keydown", handleKeyDown);
  onCleanup(() => document.removeEventListener("keydown", handleKeyDown));

  // Handle fullscreen exit
  const handleFullscreenChange = () => {
    if (!document.fullscreenElement) {
      navigate(`/slide/${params.id}`);
    }
  };
  document.addEventListener("fullscreenchange", handleFullscreenChange);
  onCleanup(() =>
    document.removeEventListener("fullscreenchange", handleFullscreenChange),
  );

  // Render current slide
  const redraw = () => {
    const pres = presentation();
    if (!pres || !canvasRef) return;
    const slide = pres.slides[currentIndex()];
    if (!slide) return;

    const ctx = canvasRef.getContext("2d");
    if (!ctx) return;

    // Calculate optimal size to fill the screen while maintaining 16:9
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    const scaleW = screenW / SLIDE_W;
    const scaleH = screenH / SLIDE_H;
    const scale = Math.min(scaleW, scaleH);

    const canvasW = Math.floor(SLIDE_W * scale);
    const canvasH = Math.floor(SLIDE_H * scale);

    canvasRef.width = canvasW * window.devicePixelRatio;
    canvasRef.height = canvasH * window.devicePixelRatio;
    canvasRef.style.width = `${canvasW}px`;
    canvasRef.style.height = `${canvasH}px`;

    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    renderSlide(ctx, slide, canvasW, canvasH, {
      scale,
      showHandles: false,
    });
  };

  createEffect(redraw);

  // Resize handler
  const handleResize = () => redraw();
  window.addEventListener("resize", handleResize);
  onCleanup(() => window.removeEventListener("resize", handleResize));

  return (
    <div
      class="fixed inset-0 bg-black flex items-center justify-center cursor-none select-none"
      onClick={(e) => {
        // Click on left third = prev, right two-thirds = next
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        const x = e.clientX - rect.left;
        if (x < rect.width / 3) {
          prevSlide();
        } else {
          nextSlide();
        }
      }}
    >
      <Show
        when={presentation()}
        fallback={<div class="text-gray-500">Loading...</div>}
      >
        <canvas ref={canvasRef} class="shadow-2xl" />

        {/* Slide counter (shows briefly) */}
        <div class="fixed bottom-4 right-4 text-gray-600 text-sm opacity-30 hover:opacity-80 transition-opacity cursor-default">
          {currentIndex() + 1} / {totalSlides()}
        </div>

        {/* ESC hint */}
        <div class="fixed top-4 right-4 text-gray-700 text-xs opacity-0 hover:opacity-60 transition-opacity cursor-default">
          ESC to exit
        </div>
      </Show>
    </div>
  );
}
