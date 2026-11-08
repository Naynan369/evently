"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createClubNightsScene } from "./visualizers/clubNights";
import { createGoodCompanyScene } from "./visualizers/goodCompany";
import { createOpenHorizonsScene } from "./visualizers/openHorizons";
import type { AnimatedScene } from "./visualizers/types";

function normalizeMode(mode: number) {
  return ((Math.trunc(mode) % 3) + 3) % 3;
}

export default function MusicVisualizer({
  mode,
  playing,
}: {
  mode: number;
  playing: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modeRef = useRef(mode);
  const playingRef = useRef(playing);
  const startRef = useRef<(() => void) | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    const section = canvas?.closest(".event-cinema");
    if (!canvas || !host || !section) return;

    let renderer: THREE.WebGLRenderer;
    try {
      const context = canvas.getContext("webgl2", {
        alpha: true,
        antialias: false,
      });
      if (!context) {
        host.dataset.fallback = "true";
        return;
      }
      renderer = new THREE.WebGLRenderer({
        canvas,
        context,
        alpha: true,
        antialias: false,
        powerPreference: "low-power",
      });
    } catch {
      host.dataset.fallback = "true";
      return;
    }

    let visuals: AnimatedScene[];
    try {
      visuals = [
        createClubNightsScene(),
        createGoodCompanyScene(),
        createOpenHorizonsScene(),
      ];
    } catch {
      renderer.dispose();
      host.dataset.fallback = "true";
      return;
    }

    host.dataset.fallback = "false";
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 12);
    camera.position.z = 4;
    scene.add(new THREE.HemisphereLight(0xf4f0e8, 0x353b40, 1.25));
    const keyLight = new THREE.DirectionalLight(0xf5e8d5, 2.1);
    keyLight.position.set(-2, 3, 4);
    scene.add(keyLight);
    visuals.forEach((visual) => {
      visual.group.visible = false;
      scene.add(visual.group);
    });

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let aspect = 1;
    let time = 0;
    let previousFrame = 0;
    let animationFrame = 0;
    let visible = false;

    const paint = () => {
      const activeIndex = normalizeMode(modeRef.current);
      visuals.forEach((visual, index) => {
        const isActive = index === activeIndex;
        visual.group.visible = isActive;
        if (isActive) visual.update(time, aspect);
      });
      renderer.render(scene, camera);
    };

    const draw = (now: number) => {
      animationFrame = 0;
      if (!visible || document.hidden || reducedMotion.matches || !playingRef.current) {
        previousFrame = 0;
        paint();
        return;
      }

      const delta = previousFrame
        ? Math.min((now - previousFrame) / 1000, 0.05)
        : 0.016;
      previousFrame = now;
      time += delta;
      paint();
      animationFrame = requestAnimationFrame(draw);
    };

    const start = () => {
      if (animationFrame || !visible) return;
      if (document.hidden || !playingRef.current || reducedMotion.matches) {
        paint();
        return;
      }
      animationFrame = requestAnimationFrame(draw);
    };

    const stop = () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      previousFrame = 0;
      paint();
    };

    const resize = () => {
      const { width, height } = host.getBoundingClientRect();
      if (!width || !height) return;

      aspect = width / height;
      camera.left = -aspect;
      camera.right = aspect;
      camera.top = 1;
      camera.bottom = -1;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      paint();
    };

    startRef.current = start;
    stopRef.current = stop;

    const resizeObserver = "ResizeObserver" in window
      ? new ResizeObserver(resize)
      : null;
    resizeObserver?.observe(host);
    if (!resizeObserver) window.addEventListener("resize", resize);

    const visibilityObserver = "IntersectionObserver" in window
      ? new IntersectionObserver(([entry]) => {
          visible = entry.isIntersecting;
          if (visible) start();
          else stop();
        }, { rootMargin: "120px 0px" })
      : null;
    if (visibilityObserver) visibilityObserver.observe(section);
    else visible = true;

    const onMotionChange = () => (reducedMotion.matches ? stop() : start());
    const onVisibilityChange = () => (document.hidden ? stop() : start());
    reducedMotion.addEventListener("change", onMotionChange);
    document.addEventListener("visibilitychange", onVisibilityChange);

    resize();
    start();

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      startRef.current = null;
      stopRef.current = null;
      resizeObserver?.disconnect();
      if (!resizeObserver) window.removeEventListener("resize", resize);
      visibilityObserver?.disconnect();
      reducedMotion.removeEventListener("change", onMotionChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      visuals.forEach((visual) => visual.dispose());
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    modeRef.current = mode;
    playingRef.current = playing;
    if (playing) startRef.current?.();
    else stopRef.current?.();
  }, [mode, playing]);

  return (
    <div className="cinema-visualizer-layer" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}
