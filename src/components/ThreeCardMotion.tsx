"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const PARTICLE_COUNT = 48;
const OUTLINE_STEPS = 44;
const BUILD_DURATION = 1120;

function seeded(index: number, salt: number) {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

export default function ThreeCardMotion({ delay }: { delay: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!canvas || !host || reducedMotion.matches) {
      setFinished(true);
      return;
    }

    let renderer: THREE.WebGLRenderer;
    try {
      const context = canvas.getContext("webgl2", {
        alpha: true,
        antialias: true,
      });
      if (!context) {
        setFinished(true);
        return;
      }
      renderer = new THREE.WebGLRenderer({
        canvas,
        context,
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
    } catch {
      setFinished(true);
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 3;

    const outlineGeometry = new THREE.BufferGeometry();
    const outlineMaterial = new THREE.LineBasicMaterial({
      color: 0xd7dfeb,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false,
    });
    const outline = new THREE.Line(outlineGeometry, outlineMaterial);
    outline.position.z = 0.24;
    scene.add(outline);

    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(PARTICLE_COUNT * 3);
    const particleStarts = new Float32Array(PARTICLE_COUNT * 3);
    const particleTargets = new Float32Array(PARTICLE_COUNT * 3);
    particleGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(particlePositions, 3),
    );
    const particleMaterial = new THREE.PointsMaterial({
      color: 0xe4d4b4,
      size: 3.2,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false,
    });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    particles.position.z = 0.2;
    scene.add(particles);

    let outlinePointCount = 0;
    let animationFrame = 0;
    let startTimer: number | undefined;
    let hasFinished = false;
    let resourcesDisposed = false;
    let resizeObserver: ResizeObserver | undefined;

    const render = () => renderer.render(scene, camera);
    const dispose = (releaseContext = false) => {
      if (resourcesDisposed) return;
      resourcesDisposed = true;
      resizeObserver?.disconnect();
      outlineGeometry.dispose();
      outlineMaterial.dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();
      renderer.dispose();
      if (releaseContext) renderer.forceContextLoss();
    };

    const resize = () => {
      const { width, height } = host.getBoundingClientRect();
      if (!width || !height) return;

      const aspect = width / height;
      camera.left = -aspect;
      camera.right = aspect;
      camera.top = 1;
      camera.bottom = -1;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);

      const halfWidth = aspect * 0.94;
      const halfHeight = 0.91;
      const points: THREE.Vector3[] = [];
      const addSide = (
        x1: number,
        y1: number,
        x2: number,
        y2: number,
      ) => {
        for (let step = 0; step <= OUTLINE_STEPS; step += 1) {
          const progress = step / OUTLINE_STEPS;
          points.push(
            new THREE.Vector3(
              THREE.MathUtils.lerp(x1, x2, progress),
              THREE.MathUtils.lerp(y1, y2, progress),
              0,
            ),
          );
        }
      };
      addSide(-halfWidth, halfHeight, halfWidth, halfHeight);
      addSide(halfWidth, halfHeight, halfWidth, -halfHeight);
      addSide(halfWidth, -halfHeight, -halfWidth, -halfHeight);
      addSide(-halfWidth, -halfHeight, -halfWidth, halfHeight);
      outlineGeometry.setFromPoints(points);
      outlinePointCount = points.length;

      const columns = 8;
      const rows = 6;
      for (let index = 0; index < PARTICLE_COUNT; index += 1) {
        const offset = index * 3;
        particleStarts[offset] = (seeded(index, 1) * 2.8 - 1.4) * aspect;
        particleStarts[offset + 1] = seeded(index, 2) * 2.8 - 1.4;
        particleStarts[offset + 2] = 0;

        const column = index % columns;
        const row = Math.floor(index / columns);
        particleTargets[offset] =
          THREE.MathUtils.lerp(-halfWidth * 0.78, halfWidth * 0.78, column / (columns - 1));
        particleTargets[offset + 1] =
          THREE.MathUtils.lerp(halfHeight * 0.68, -halfHeight * 0.68, row / (rows - 1));
        particleTargets[offset + 2] = 0;
      }
      render();
    };

    const finish = () => {
      if (hasFinished) return;
      hasFinished = true;
      if (animationFrame) cancelAnimationFrame(animationFrame);
      if (startTimer !== undefined) window.clearTimeout(startTimer);
      dispose(true);
      setFinished(true);
    };

    const draw = (now: number, startedAt: number) => {
      if (reducedMotion.matches) {
        finish();
        return;
      }

      const rawProgress = Math.min((now - startedAt) / BUILD_DURATION, 1);
      const progress = 1 - Math.pow(1 - rawProgress, 3);
      outlineGeometry.setDrawRange(0, Math.floor(outlinePointCount * progress));
      outlineMaterial.opacity =
        rawProgress < 0.76 ? 0.86 : 0.86 * (1 - (rawProgress - 0.76) / 0.24);
      particleMaterial.opacity =
        rawProgress < 0.64 ? 0.82 : 0.82 * (1 - (rawProgress - 0.64) / 0.36);

      for (let index = 0; index < PARTICLE_COUNT; index += 1) {
        const offset = index * 3;
        const drift = Math.sin(rawProgress * Math.PI) * 0.12;
        particlePositions[offset] = THREE.MathUtils.lerp(
          particleStarts[offset],
          particleTargets[offset],
          progress,
        ) + Math.cos(index * 1.7) * drift;
        particlePositions[offset + 1] = THREE.MathUtils.lerp(
          particleStarts[offset + 1],
          particleTargets[offset + 1],
          progress,
        ) + Math.sin(index * 1.3) * drift;
        particlePositions[offset + 2] = 0;
      }
      (particleGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      render();

      if (rawProgress < 1) {
        animationFrame = requestAnimationFrame((frameTime) => draw(frameTime, startedAt));
      } else {
        finish();
      }
    };

    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();
    startTimer = window.setTimeout(() => {
      const startedAt = performance.now();
      animationFrame = requestAnimationFrame((frameTime) => draw(frameTime, startedAt));
    }, Math.max(0, delay));

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      if (startTimer !== undefined) window.clearTimeout(startTimer);
      dispose();
    };
  }, [delay]);

  if (finished) return null;
  return <canvas ref={canvasRef} className="three-card-motion" aria-hidden="true" />;
}
