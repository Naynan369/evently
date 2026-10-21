import * as THREE from "three";
import type { AnimatedScene } from "./types";

const GLINT_COUNT = 84;
const GLINT_COLORS = ["#d8fbff", "#9de5ef", "#97c8ef"];

function seeded(index: number, salt: number) {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

const VERTEX_SHADER = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision highp float;

  varying vec2 vUv;
  uniform float uTime;
  uniform float uAspect;
  uniform float uScroll;

  float hash(vec2 point) {
    point = fract(point * vec2(123.34, 456.21));
    point += dot(point, point + 45.32);
    return fract(point.x * point.y);
  }

  float noise(vec2 point) {
    vec2 cell = floor(point);
    vec2 fraction = fract(point);
    fraction = fraction * fraction * (3.0 - 2.0 * fraction);

    float lower = mix(hash(cell), hash(cell + vec2(1.0, 0.0)), fraction.x);
    float upper = mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0)), fraction.x);
    return mix(lower, upper, fraction.y);
  }

  float flowNoise(vec2 point) {
    float value = 0.0;
    float amplitude = 0.5;
    mat2 turn = mat2(0.8, -0.6, 0.6, 0.8);

    for (int octave = 0; octave < 3; octave++) {
      value += noise(point) * amplitude;
      point = turn * point * 2.03 + 17.17;
      amplitude *= 0.5;
    }
    return value;
  }

  float ribbonGlow(float distanceToRibbon) {
    float softHalo = exp(-distanceToRibbon * distanceToRibbon * 20.0) * 0.22;
    float silkCore = exp(-distanceToRibbon * distanceToRibbon * 95.0) * 0.34;
    return softHalo + silkCore;
  }

  void main() {
    vec2 point = (vUv - 0.5) * vec2(uAspect, 1.0);
    point.y += uScroll * 0.024;
    float driftTime = uTime * 0.13 + uScroll * 0.08;

    // Slow domain warping keeps the ribbon edges fluid instead of perfectly periodic.
    vec2 warp = vec2(
      flowNoise(point * 1.4 + vec2(driftTime, -driftTime * 0.7)),
      flowNoise(point * 1.55 + vec2(-driftTime * 0.6, driftTime))
    );
    vec2 field = point + (warp - 0.5) * vec2(0.05, 0.12);

    float firstPath = -0.18
      + sin(field.x * 1.18 + uTime * 0.34) * 0.2
      + sin(field.x * 3.1 - uTime * 0.22) * 0.055
      + (warp.y - 0.5) * 0.09;
    float secondPath = 0.28
      + sin(field.x * 1.52 - uTime * 0.29 + 1.7) * 0.16
      + sin(field.x * 3.6 + uTime * 0.17) * 0.04
      + (warp.x - 0.5) * 0.08;
    float thirdPath = -0.52
      + sin(field.x * 0.92 + uTime * 0.25 + 2.8) * 0.12
      + sin(field.x * 2.45 - uTime * 0.2) * 0.045
      + (warp.y - 0.5) * 0.07;

    float edgeFade = 1.0 - smoothstep(uAspect * 0.72, uAspect * 1.32, abs(point.x));
    float glowOne = ribbonGlow(field.y - firstPath) * edgeFade;
    float glowTwo = ribbonGlow(field.y - secondPath) * edgeFade;
    float glowThree = ribbonGlow(field.y - thirdPath) * edgeFade;

    // Faint circular interference adds depth behind the flowing sound ribbons.
    float radius = length(vec2((field.x + 0.24) * 0.7, field.y + 0.22));
    float interference = exp(-abs(sin(radius * 14.0 - uTime * 0.62 + warp.x)) * 8.0);
    interference *= exp(-radius * 0.52) * smoothstep(0.1, 0.34, radius);

    float cloud = flowNoise(field * 2.0 + vec2(uTime * 0.025, -uTime * 0.032));
    float hazeOffset = (field.y + 0.38) * 1.45;
    float haze = exp(-hazeOffset * hazeOffset) * (0.4 + cloud * 0.6);
    float beatPhase = fract(uTime * 0.76);
    float bassPulse = exp(-beatPhase * 10.0);
    float pulse = 0.87 + 0.08 * sin(uTime * 0.72 + sin(uTime * 0.16)) + bassPulse * 0.05;
    float vignette = 1.0 - smoothstep(0.52, 1.8, length(point * vec2(0.75, 1.0)));

    float ribbonEnergy = glowOne + glowTwo + glowThree;
    vec3 ribbonColor =
      vec3(0.16, 0.72, 0.8) * glowOne +
      vec3(0.32, 0.62, 0.82) * glowTwo +
      vec3(0.12, 0.48, 0.62) * glowThree;
    vec3 color = ribbonColor / max(ribbonEnergy, 0.001);
    color = mix(color, vec3(0.34, 0.66, 0.72), clamp(cloud * 0.35, 0.0, 0.28));

    float alpha = (
      ribbonEnergy * 0.7 +
      interference * 0.09 +
      haze * 0.045
    ) * pulse * vignette;
    gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.46));
  }
`;

export function createExploreScene(): AnimatedScene {
  const group = new THREE.Group();
  const uniforms = {
    uTime: { value: 0 },
    uAspect: { value: 1 },
    uScroll: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  const geometry = new THREE.PlaneGeometry(2, 2);
  const field = new THREE.Mesh(geometry, material);
  field.frustumCulled = false;
  field.position.z = -0.25;
  group.add(field);

  const glintPositions = new Float32Array(GLINT_COUNT * 3);
  const glintColors = new Float32Array(GLINT_COUNT * 3);
  const glintTracks = Array.from({ length: GLINT_COUNT }, (_, index) => ({
    track: index % 3,
    start: seeded(index, 1),
    speed: 0.075 + seeded(index, 2) * 0.045,
    phase: seeded(index, 3) * Math.PI * 2,
  }));
  glintTracks.forEach((glint, index) => {
    const baseColor = new THREE.Color(GLINT_COLORS[glint.track]);
    const brightness = 0.56 + seeded(index, 4) * 0.34;
    const offset = index * 3;
    glintColors[offset] = baseColor.r * brightness;
    glintColors[offset + 1] = baseColor.g * brightness;
    glintColors[offset + 2] = baseColor.b * brightness;
  });

  const glintGeometry = new THREE.BufferGeometry();
  glintGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(glintPositions, 3).setUsage(THREE.DynamicDrawUsage),
  );
  glintGeometry.setAttribute("color", new THREE.BufferAttribute(glintColors, 3));
  const glintMaterial = new THREE.PointsMaterial({
    size: 2.1,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.68,
    vertexColors: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const glints = new THREE.Points(glintGeometry, glintMaterial);
  glints.position.z = 0.06;
  glints.frustumCulled = false;
  group.add(glints);

  return {
    group,
    update(time, aspect, scrollProgress = 0) {
      uniforms.uTime.value = time;
      uniforms.uAspect.value = aspect;
      uniforms.uScroll.value = scrollProgress;
      field.scale.x = aspect;

      glintTracks.forEach((glint, index) => {
        const progress = (glint.start + time * glint.speed) % 1;
        const x = (progress * 2 - 1) * aspect * 1.06;
        let y: number;

        if (glint.track === 0) {
          y = -0.18
            + Math.sin(x * 1.18 + time * 0.34) * 0.2
            + Math.sin(x * 3.1 - time * 0.22) * 0.055;
        } else if (glint.track === 1) {
          y = 0.28
            + Math.sin(x * 1.52 - time * 0.29 + 1.7) * 0.16
            + Math.sin(x * 3.6 + time * 0.17) * 0.04;
        } else {
          y = -0.52
            + Math.sin(x * 0.92 + time * 0.25 + 2.8) * 0.12
            + Math.sin(x * 2.45 - time * 0.2) * 0.045;
        }

        const offset = index * 3;
        glintPositions[offset] = x;
        glintPositions[offset + 1] = y
          + scrollProgress * 0.024
          + Math.sin(time * 0.72 + glint.phase) * 0.012;
        glintPositions[offset + 2] = 0;
      });
      (glintGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      glintMaterial.opacity = 0.58 + 0.12 * (0.5 + 0.5 * Math.sin(time * 0.76));
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      glintGeometry.dispose();
      glintMaterial.dispose();
    },
  };
}
