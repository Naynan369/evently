import * as THREE from "three";
import type { AnimatedScene } from "./types";

type Ribbon = {
  geometry: THREE.BufferGeometry;
  material: THREE.MeshPhysicalMaterial;
  mesh: THREE.Mesh;
  positions: Float32Array;
  phase: number;
  radius: number;
};

const segments = 160;

function makeRibbon(index: number): Ribbon {
  const positions = new Float32Array((segments + 1) * 6);
  const colors = new Float32Array(positions.length);
  const indices: number[] = [];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const dark = new THREE.Color(index % 2 ? 0x9f4721 : 0x733820);
  const light = new THREE.Color(index % 2 ? 0xffd1a1 : 0xf4a967);
  for (let i = 0; i <= segments; i++) {
    const shade = light.clone().lerp(dark, i / segments * 0.52);
    for (let edge = 0; edge < 2; edge++) {
      const offset = (i * 2 + edge) * 3;
      const color = shade.clone().lerp(light, edge ? 0.3 : 0);
      colors[offset] = color.r;
      colors[offset + 1] = color.g;
      colors[offset + 2] = color.b;
    }
    if (i < segments) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  const material = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    metalness: 0.24,
    roughness: 0.34,
    clearcoat: 0.8,
    clearcoatRoughness: 0.22,
    transparent: true,
    opacity: index === 0 ? 0.92 : 0.78,
    depthWrite: false,
    emissive: 0x5b2813,
    emissiveIntensity: 0.15,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.set(index * 0.33 - 0.38, index * 0.44 - 0.62, index * 0.48);
  mesh.renderOrder = index;
  return {
    geometry,
    material,
    mesh,
    positions,
    phase: index * 1.28,
    radius: 0.58 + index * 0.115,
  };
}

function updateRibbon(ribbon: Ribbon, time: number) {
  for (let i = 0; i <= segments; i++) {
    const progress = i / segments;
    const angle = -Math.PI * 0.83 + progress * Math.PI * 1.68;
    const radius = ribbon.radius + 0.055 * Math.sin(angle * 2.2 + ribbon.phase + time * 0.42);
    const height = 0.17 * Math.sin(angle * 1.35 + ribbon.phase)
      + 0.045 * Math.sin(angle * 3.3 - time * 0.38 + ribbon.phase);
    const width = 0.105 + 0.03 * Math.sin(progress * Math.PI);
    for (let edge = 0; edge < 2; edge++) {
      const side = edge ? 1 : -1;
      const offset = (i * 2 + edge) * 3;
      const edgeRadius = radius + width * side;
      ribbon.positions[offset] = Math.cos(angle) * edgeRadius;
      ribbon.positions[offset + 1] = height + side * 0.045;
      ribbon.positions[offset + 2] = Math.sin(angle) * edgeRadius;
    }
  }
  (ribbon.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
  ribbon.geometry.computeVertexNormals();
}

export function createClubNightsScene(): AnimatedScene {
  const group = new THREE.Group();
  const ribbons = Array.from({ length: 4 }, (_, index) => makeRibbon(index));
  ribbons.forEach((ribbon) => group.add(ribbon.mesh));
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.34, 0.004, 5, 120),
    new THREE.MeshBasicMaterial({ color: 0xffd6ae, transparent: true, opacity: 0.56, depthWrite: false }),
  );
  ring.rotation.set(0.4, -0.25, -0.35);
  group.add(ring);

  return {
    group,
    update(time, aspect) {
      ribbons.forEach((ribbon, index) => {
        updateRibbon(ribbon, time);
        ribbon.mesh.rotation.y = index * 0.44 - 0.62 + time * (index % 2 ? -0.045 : 0.055);
        ribbon.mesh.rotation.z = index * 0.48 + Math.sin(time * 0.22 + index) * 0.055;
      });
      ring.rotation.z = -0.35 - time * 0.035;
      const compact = aspect < 0.9;
      group.position.set(aspect * (compact ? 0.72 : 0.6), compact ? -0.06 : 0.02, 0);
      group.scale.setScalar(Math.min(compact ? 0.59 : 0.83, aspect / 1.32));
      group.rotation.y = Math.sin(time * 0.17) * 0.12;
    },
    dispose() {
      ribbons.forEach((ribbon) => {
        ribbon.geometry.dispose();
        ribbon.material.dispose();
      });
      ring.geometry.dispose();
      (ring.material as THREE.Material).dispose();
    },
  };
}
