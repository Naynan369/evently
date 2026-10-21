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

  modeRef.current = mode;
  playingRef.current = playing;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: false,
        powerPreference: "low-power",
      });
    } catch {
      canvas.hidden = true;
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 12);
    camera.position.z = 4;

    scene.add(new THREE.HemisphereLight(0xf4f0e8, 0x353b40, 1.25));
    const keyLight = new THREE.DirectionalLight(0xf5e8d5, 2.1);
    keyLight.position.set(-2, 3, 4);
    scene.add(keyLight);

    const visuals: AnimatedScene[] = [
      createClubNightsScene(),
      createGoodCompanyScene(),
      createOpenHorizonsScene(),
    ];
    visuals.forEach((visual) => {
      visual.group.visible = false;
      scene.add(visual.group);
    });

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let aspect = 1;
    let time = 0;
    let previousFrame = 0;
    let animationFrame = 0;
    let visible = true;

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
      if (!visible || reducedMotion.matches || !playingRef.current) {
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
      if (!playingRef.current || reducedMotion.matches) {
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
      const { width, height } = canvas.getBoundingClientRect();
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

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
      else stop();
    });
    visibilityObserver.observe(canvas);

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
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      reducedMotion.removeEventListener("change", onMotionChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      visuals.forEach((visual) => visual.dispose());
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    if (playing) startRef.current?.();
    else stopRef.current?.();
  }, [mode, playing]);

  return <canvas ref={canvasRef} className="music-visualizer" aria-hidden="true" />;
}
