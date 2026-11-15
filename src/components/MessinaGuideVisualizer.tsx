"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createMessinaPhotoScene } from "./visualizers/messinaPhoto";
import { messinaAreas } from "@/lib/messina";
import { messinaAreaPhotos } from "@/lib/messina-photos";

export default function MessinaGuideVisualizer({ activeIndex }: { activeIndex: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef(activeIndex);
  const repaintRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    const stage = host?.parentElement;
    if (!canvas || !host || !stage) return;

    let renderer: THREE.WebGLRenderer;
    try {
      const context = canvas.getContext("webgl2", { alpha: true, antialias: true });
      if (!context) return;
      renderer = new THREE.WebGLRenderer({
        canvas, context, alpha: true, antialias: true, powerPreference: "low-power",
      });
    } catch {
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.4));
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 10);
    camera.position.z = 1 / Math.tan(THREE.MathUtils.degToRad(17.5));
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let disposed = false;
    let release: (() => void) | null = null;

    const initialize = async () => {
      const loader = new THREE.TextureLoader();
      const loaded = await Promise.allSettled(
        messinaAreas.map((area) => loader.loadAsync(messinaAreaPhotos[area.id].src)),
      );
      if (disposed || loaded.some((result) => result.status === "rejected")) {
        loaded.forEach((result) => {
          if (result.status === "fulfilled") result.value.dispose();
        });
        return;
      }
      const visual = createMessinaPhotoScene(loaded.map((result) => (result as PromiseFulfilledResult<THREE.Texture>).value));
      scene.add(visual.group);
      let frame = 0;
      let previousFrame = 0;
      let time = 0;
      let visible = false;
      let contextLost = false;
      let pointerX = 0;
      let pointerY = 0;

      const paint = (delta: number, still = false) => {
        if (contextLost) return;
        visual.update(activeRef.current, time, delta, pointerX, pointerY, still);
        renderer.render(scene, camera);
      };
      const stop = () => {
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        previousFrame = 0;
      };
      const draw = (now: number) => {
        frame = 0;
        if (!visible || document.hidden || reducedMotion.matches || contextLost) return;
        const delta = previousFrame ? Math.min((now - previousFrame) / 1000, 0.05) : 0.016;
        previousFrame = now;
        time += delta;
        paint(delta);
        frame = requestAnimationFrame(draw);
      };
      const start = () => {
        if (!visible || contextLost) return;
        if (document.hidden || reducedMotion.matches) {
          stop();
          paint(1, true);
        } else if (!frame) {
          frame = requestAnimationFrame(draw);
        }
      };
      const resize = () => {
        const { width, height } = host.getBoundingClientRect();
        if (!width || !height || contextLost) return;
        const aspect = width / height;
        camera.aspect = aspect;
        camera.updateProjectionMatrix();
        visual.resize(width, height);
        renderer.setSize(width, height, false);
        paint(0.016, reducedMotion.matches);
        host.dataset.ready = "true";
        stage.dataset.photo3d = "true";
      };
      const onPointerMove = (event: PointerEvent) => {
        const bounds = stage.getBoundingClientRect();
        pointerX = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1));
        pointerY = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1));
      };
      const onPointerLeave = () => { pointerX = 0; pointerY = 0; };
      const onContextLost = (event: Event) => {
        event.preventDefault();
        contextLost = true;
        stop();
        host.dataset.ready = "false";
        stage.dataset.photo3d = "false";
      };
      const onMotionChange = () => start();
      const onVisibilityChange = () => (document.hidden ? stop() : start());
      const resizeObserver = "ResizeObserver" in window ? new ResizeObserver(resize) : null;
      resizeObserver?.observe(host);
      if (!resizeObserver) window.addEventListener("resize", resize);
      const visibilityObserver = "IntersectionObserver" in window
        ? new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            if (visible) start(); else stop();
          }, { rootMargin: "120px 0px" })
        : null;
      if (visibilityObserver) visibilityObserver.observe(stage);
      else visible = true;
      stage.addEventListener("pointermove", onPointerMove);
      stage.addEventListener("pointerleave", onPointerLeave);
      canvas.addEventListener("webglcontextlost", onContextLost);
      reducedMotion.addEventListener("change", onMotionChange);
      document.addEventListener("visibilitychange", onVisibilityChange);
      repaintRef.current = () => {
        if (reducedMotion.matches || !visible) paint(1, true);
        else start();
      };
      resize();
      start();

      release = () => {
        stop();
        repaintRef.current = null;
        resizeObserver?.disconnect();
        if (!resizeObserver) window.removeEventListener("resize", resize);
        visibilityObserver?.disconnect();
        stage.removeEventListener("pointermove", onPointerMove);
        stage.removeEventListener("pointerleave", onPointerLeave);
        canvas.removeEventListener("webglcontextlost", onContextLost);
        reducedMotion.removeEventListener("change", onMotionChange);
        document.removeEventListener("visibilitychange", onVisibilityChange);
        host.dataset.ready = "false";
        stage.dataset.photo3d = "false";
        visual.dispose();
      };
    };
    void initialize();

    return () => {
      disposed = true;
      release?.();
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    activeRef.current = activeIndex;
    repaintRef.current?.();
  }, [activeIndex]);

  return <div className="messina-home-stage__three" aria-hidden="true"><canvas ref={canvasRef} /></div>;
}
