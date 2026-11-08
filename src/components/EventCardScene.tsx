"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

const vertexShader = `
  uniform float uHover;
  uniform vec2 uPointer;
  uniform float uIntro;
  varying vec2 vUv;
  varying vec3 vViewPosition;

  void main() {
    vUv = uv;
    vec3 point = position;
    vec2 focus = uv - 0.5 - uPointer * 0.18;
    float edge = sin(uv.x * 3.14159265) * sin(uv.y * 3.14159265);
    float lift = exp(-dot(focus, focus) * 8.0);
    point.z += edge * (0.018 + uHover * (0.11 + lift * 0.13));
    point.z += (1.0 - uIntro) * edge * 0.08;
    vec4 viewPosition = modelViewMatrix * vec4(point, 1.0);
    vViewPosition = viewPosition.xyz;
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const fragmentShader = `
  uniform sampler2D uTexture;
  uniform vec2 uCrop;
  uniform vec2 uPointer;
  uniform float uHover;
  varying vec2 vUv;
  varying vec3 vViewPosition;

  void main() {
    vec2 sampleUv = (vUv - 0.5) * uCrop + 0.5;
    vec3 photograph = texture2D(uTexture, sampleUv).rgb;
    vec3 normal = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
    if (normal.z < 0.0) normal = -normal;
    vec3 light = normalize(vec3(-0.45 + uPointer.x * 0.42, 0.65 - uPointer.y * 0.3, 1.0));
    float diffuse = max(dot(normal, light), 0.0);
    float grazing = pow(1.0 - max(normal.z, 0.0), 2.0);
    float sheen = pow(max(dot(reflect(-light, normal), vec3(0.0, 0.0, 1.0)), 0.0), 18.0);
    vec3 color = photograph * (0.87 + diffuse * 0.17 - grazing * 0.16);
    color += vec3(1.0, 0.76, 0.55) * sheen * uHover * 0.11;
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export default function EventCardScene({ src }: { src: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    const card = canvas?.closest<HTMLElement>(".event-card");
    if (!canvas || !host || !card) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
    } catch {
      return;
    }
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    let shaderFailed = false;
    renderer.debug.onShaderError = () => {
      shaderFailed = true;
      canvas.dataset.ready = "false";
      console.error("Event card scene shader could not compile");
    };

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 3;
    const backingGeometry = new THREE.PlaneGeometry(2, 2);
    const backingMaterial = new THREE.MeshBasicMaterial({ color: 0x24201e });
    const backing = new THREE.Mesh(backingGeometry, backingMaterial);
    backing.position.z = -0.16;
    scene.add(backing);
    const geometry = new THREE.PlaneGeometry(2, 2, 56, 36);
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTexture: { value: null },
        uHover: { value: 0 },
        uPointer: { value: new THREE.Vector2() },
        uCrop: { value: new THREE.Vector2(1, 1) },
        uIntro: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
    });
    const plane = new THREE.Mesh(geometry, material);
    scene.add(plane);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointer = new THREE.Vector2();
    const target = new THREE.Vector2();
    let hover = 0;
    let targetHover = 0;
    let intro = reducedMotion.matches ? 1 : 0;
    let previous = 0;
    let frame = 0;
    let visible = false;
    let ready = false;
    let disposed = false;
    let imageAspect = 1;

    const resize = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      if (!width || !height) return;
      const aspect = width / height;
      camera.left = -aspect;
      camera.right = aspect;
      camera.updateProjectionMatrix();
      backing.scale.set(aspect * 1.08, 1.08, 1);
      plane.scale.set(aspect * 1.015, 1.015, 1);
      material.uniforms.uCrop.value.set(
        imageAspect > aspect ? aspect / imageAspect : 1,
        imageAspect > aspect ? 1 : imageAspect / aspect,
      );
      renderer.setSize(width, height, false);
      if (ready) renderer.render(scene, camera);
    };

    const draw = (now: number) => {
      frame = 0;
      if (!visible || document.hidden || !ready) return;
      const delta = previous ? Math.min((now - previous) / 1000, 0.05) : 0.016;
      previous = now;
      const ease = Math.min(1, delta * 9);
      pointer.lerp(target, ease);
      hover += (targetHover - hover) * ease;
      intro = Math.min(1, intro + delta / 0.85);
      material.uniforms.uHover.value = hover;
      material.uniforms.uPointer.value.copy(pointer);
      material.uniforms.uIntro.value = intro;
      plane.rotation.x = -pointer.y * hover * 0.105 + (1 - intro) * 0.035;
      plane.rotation.y = pointer.x * hover * 0.15 - (1 - intro) * 0.11;
      renderer.render(scene, camera);
      const settling = intro < 1 ||
        pointer.distanceToSquared(target) > 0.00002 ||
        Math.abs(hover - targetHover) > 0.003;
      if (settling && !reducedMotion.matches) frame = requestAnimationFrame(draw);
      else previous = 0;
    };

    const start = () => {
      if (!frame && visible && ready && !document.hidden) {
        previous = 0;
        frame = requestAnimationFrame(draw);
      }
    };
    const stop = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      previous = 0;
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || reducedMotion.matches) return;
      const bounds = card.getBoundingClientRect();
      target.set(
        Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1)),
        Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1)),
      );
      targetHover = 1;
      start();
    };
    const onPointerLeave = () => {
      target.set(0, 0);
      targetHover = 0;
      start();
    };
    const onMotionChange = () => {
      if (reducedMotion.matches) {
        stop();
        intro = 1;
        pointer.set(0, 0);
        target.set(0, 0);
        hover = targetHover = 0;
        material.uniforms.uIntro.value = 1;
        material.uniforms.uHover.value = 0;
        material.uniforms.uPointer.value.set(0, 0);
        plane.rotation.set(0, 0, 0);
        renderer.render(scene, camera);
      } else start();
    };
    const onVisibilityChange = () => (document.hidden ? stop() : start());

    const texture = new THREE.TextureLoader().load(
      src,
      (loaded) => {
        if (disposed) return;
        loaded.colorSpace = THREE.SRGBColorSpace;
        loaded.minFilter = THREE.LinearFilter;
        imageAspect = loaded.image.width / loaded.image.height;
        material.uniforms.uTexture.value = loaded;
        ready = true;
        plane.rotation.x = (1 - intro) * 0.035;
        plane.rotation.y = -(1 - intro) * 0.11;
        resize();
        if (shaderFailed) return;
        canvas.dataset.ready = "true";
        start();
      },
      undefined,
      () => { canvas.dataset.ready = "false"; },
    );

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
      else stop();
    }, { rootMargin: "100px 0px" });
    visibilityObserver.observe(card);
    card.addEventListener("pointermove", onPointerMove);
    card.addEventListener("pointerleave", onPointerLeave);
    card.addEventListener("pointercancel", onPointerLeave);
    reducedMotion.addEventListener("change", onMotionChange);
    document.addEventListener("visibilitychange", onVisibilityChange);
    resize();

    return () => {
      disposed = true;
      stop();
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      card.removeEventListener("pointermove", onPointerMove);
      card.removeEventListener("pointerleave", onPointerLeave);
      card.removeEventListener("pointercancel", onPointerLeave);
      reducedMotion.removeEventListener("change", onMotionChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      texture.dispose();
      backingGeometry.dispose();
      backingMaterial.dispose();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, [src]);

  return <canvas ref={canvasRef} className="event-card-scene" aria-hidden="true" />;
}
