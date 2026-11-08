"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createExploreScene } from "./visualizers/exploreScene";
import type { AnimatedScene } from "./visualizers/types";

export default function ExploreVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    const page = host?.closest(".explore-page");
    if (!canvas || !host || !page) return;

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

    let visual: AnimatedScene;
    try {
      visual = createExploreScene();
    } catch {
      renderer.dispose();
      host.dataset.fallback = "true";
      return;
    }

    host.dataset.fallback = "false";
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    scene.add(visual.group);
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 4;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let aspect = 1;
    let time = 0;
    let previousFrame = 0;
    let animationFrame = 0;
    let visible = false;

    const paint = () => {
      visual.update(time, aspect);
      renderer.render(scene, camera);
    };

    const draw = (now: number) => {
      animationFrame = 0;
      if (!visible || document.hidden || reducedMotion.matches) {
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
      if (document.hidden || reducedMotion.matches) {
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
    if (visibilityObserver) visibilityObserver.observe(page);
    else visible = true;

    const onMotionChange = () => (reducedMotion.matches ? stop() : start());
    const onVisibilityChange = () => (document.hidden ? stop() : start());
    reducedMotion.addEventListener("change", onMotionChange);
    document.addEventListener("visibilitychange", onVisibilityChange);

    resize();
    start();

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      visibilityObserver?.disconnect();
      if (!resizeObserver) window.removeEventListener("resize", resize);
      reducedMotion.removeEventListener("change", onMotionChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      visual.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div className="explore-visualizer-layer" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}
