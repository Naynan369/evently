import * as THREE from "three";
import type { AnimatedScene } from "./types";

const SEGMENTS = 180;
const RIBBONS = [
  {
    baseline: -0.43,
    amplitude: 0.11,
    thickness: 0.1,
    color: "#cf8a58",
    opacity: 0.29,
  },
  {
    baseline: -0.24,
    amplitude: 0.095,
    thickness: 0.08,
    color: "#eeb57f",
    opacity: 0.24,
  },
  {
    baseline: -0.055,
    amplitude: 0.08,
    thickness: 0.065,
    color: "#ba7246",
    opacity: 0.22,
  },
  {
    baseline: 0.12,
    amplitude: 0.065,
    thickness: 0.05,
    color: "#ffd9ab",
    opacity: 0.19,
  },
];

function createRibbonGeometry() {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array((SEGMENTS + 1) * 2 * 3);
  const indices: number[] = [];

  for (let segment = 0; segment < SEGMENTS; segment += 1) {
    const start = segment * 2;
    indices.push(start, start + 1, start + 2, start + 1, start + 3, start + 2);
  }

  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage),
  );
  geometry.setIndex(indices);
  return geometry;
}

export function createOpenHorizonsScene(): AnimatedScene {
  const group = new THREE.Group();
  const sunGlowGeometry = new THREE.CircleGeometry(0.7, 80);
  const sunGlowMaterial = new THREE.MeshBasicMaterial({
    color: "#f6bc86",
    transparent: true,
    opacity: 0.09,
    depthWrite: false,
    toneMapped: false,
  });
  const sunGlow = new THREE.Mesh(sunGlowGeometry, sunGlowMaterial);
  sunGlow.position.z = -0.24;
  group.add(sunGlow);

  const sunGeometry = new THREE.CircleGeometry(0.43, 80);
  const sunMaterial = new THREE.MeshBasicMaterial({
    color: "#ffdfb2",
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
    toneMapped: false,
  });
  const sun = new THREE.Mesh(sunGeometry, sunMaterial);
  sun.position.z = -0.2;
  group.add(sun);

  const ribbonGeometries = RIBBONS.map(() => createRibbonGeometry());
  const ribbonMaterials = RIBBONS.map(
    ({ color, opacity }) =>
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
        toneMapped: false,
      }),
  );
  ribbonGeometries.forEach((geometry, index) => {
    const ribbon = new THREE.Mesh(geometry, ribbonMaterials[index]);
    ribbon.position.z = -0.11 + index * 0.012;
    ribbon.frustumCulled = false;
    group.add(ribbon);
  });

  const crestMaterials = RIBBONS.map(
    ({ color }) =>
      new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.62,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
  );
  const crestGeometries = RIBBONS.map(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(
        new Float32Array((SEGMENTS + 1) * 3),
        3,
      ).setUsage(THREE.DynamicDrawUsage),
    );
    return geometry;
  });
  crestGeometries.forEach((geometry, index) => {
    const crest = new THREE.Line(geometry, crestMaterials[index]);
    crest.position.z = -0.045 + index * 0.005;
    crest.frustumCulled = false;
    group.add(crest);
  });

  return {
    group,
    update(time, aspect) {
      const sunX = aspect * 0.3;
      const sunY = 0.26 + Math.sin(time * 0.35) * 0.14;
      sun.position.set(sunX, sunY, -0.2);
      sun.scale.setScalar(1 + Math.sin(time * 0.52) * 0.045);
      sunGlow.position.set(sunX, sunY, -0.24);
      sunGlow.scale.setScalar(1.05 + Math.sin(time * 0.32) * 0.08);

      RIBBONS.forEach((ribbon, ribbonIndex) => {
        const positions = ribbonGeometries[ribbonIndex].attributes
          .position as THREE.BufferAttribute;
        const vertices = positions.array as Float32Array;
        const crestPositions = crestGeometries[ribbonIndex].attributes
          .position as THREE.BufferAttribute;
        const crestVertices = crestPositions.array as Float32Array;
        const phaseShift = ribbonIndex * 1.12;

        for (let segment = 0; segment <= SEGMENTS; segment += 1) {
          const progress = segment / SEGMENTS;
          const x = -aspect + progress * aspect * 2;
          const phase =
            x * 1.55 - time * (0.5 + ribbonIndex * 0.07) + phaseShift;
          const swell =
            Math.sin(phase) * ribbon.amplitude +
            Math.sin(phase * 0.43 + time * 0.24) * ribbon.amplitude * 0.42;
          const y = ribbon.baseline + swell;
          const top = segment * 2 * 3;
          const bottom = top + 3;

          vertices[top] = x;
          vertices[top + 1] = y + ribbon.thickness / 2;
          vertices[top + 2] = 0;
          vertices[bottom] = x;
          vertices[bottom + 1] = y - ribbon.thickness / 2;
          vertices[bottom + 2] = 0;

          const crestOffset = segment * 3;
          crestVertices[crestOffset] = x;
          crestVertices[crestOffset + 1] = y + ribbon.thickness / 2;
          crestVertices[crestOffset + 2] = 0;
        }

        positions.needsUpdate = true;
        crestPositions.needsUpdate = true;
      });
    },
    dispose() {
      sunGlowGeometry.dispose();
      sunGlowMaterial.dispose();
      sunGeometry.dispose();
      sunMaterial.dispose();
      ribbonGeometries.forEach((geometry) => geometry.dispose());
      ribbonMaterials.forEach((material) => material.dispose());
      crestGeometries.forEach((geometry) => geometry.dispose());
      crestMaterials.forEach((material) => material.dispose());
    },
  };
}
