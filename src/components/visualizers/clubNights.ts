import * as THREE from "three";
import type { AnimatedScene } from "./types";

type Membrane = {
  geometry: THREE.BufferGeometry;
  material: THREE.MeshPhysicalMaterial;
  mesh: THREE.Mesh;
  original: Float32Array;
  phase: number;
  movement: number;
};

function makeMembrane(
  geometry: THREE.BufferGeometry,
  color: number,
  opacity: number,
  phase: number,
  movement: number,
): Membrane {
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;
  const material = new THREE.MeshPhysicalMaterial({
    color,
    side: THREE.DoubleSide,
    transparent: true,
    opacity,
    depthWrite: false,
    metalness: 0.08,
    roughness: 0.29,
    clearcoat: 0.95,
    clearcoatRoughness: 0.16,
    emissive: 0x444444,
    emissiveIntensity: 0.22,
  });
  const mesh = new THREE.Mesh(geometry, material);
  return {
    geometry,
    material,
    mesh,
    original: new Float32Array(position.array),
    phase,
    movement,
  };
}

function moveMembrane(membrane: Membrane, time: number) {
  const position = membrane.geometry.getAttribute("position") as THREE.BufferAttribute;
  const vertices = position.array as Float32Array;
  const { original, phase, movement } = membrane;
  const breath = 1 + Math.sin(time * 0.82 + phase) * 0.025;

  for (let i = 0; i < original.length; i += 3) {
    const x = original[i];
    const y = original[i + 1];
    const z = original[i + 2];
    const rolling =
      Math.sin(x * 3.4 + y * 2.6 + time * 0.62 + phase) *
        Math.cos(z * 3.7 - time * 0.43) * 0.075 +
      Math.sin(y * 4.6 - x * 2.1 - time * 0.37 + phase) * 0.055 +
      Math.cos(z * 4.2 + x * 2.3 + time * 0.51 + phase) * 0.035;
    const radius = breath + rolling * movement;
    vertices[i] = x * radius;
    vertices[i + 1] = y * radius;
    vertices[i + 2] = z * radius;
  }

  position.needsUpdate = true;
  membrane.geometry.computeVertexNormals();
}

export function createClubNightsScene(): AnimatedScene {
  const group = new THREE.Group();
  const inner = makeMembrane(
    new THREE.SphereGeometry(0.5, 48, 36),
    0xe8e8e8,
    0.16,
    1.6,
    0.65,
  );
  const outer = makeMembrane(
    new THREE.TorusGeometry(0.44, 0.29, 48, 128),
    0xbcbcbc,
    0.56,
    0,
    1,
  );
  inner.mesh.renderOrder = 1;
  outer.mesh.renderOrder = 2;
  outer.mesh.rotation.x = -0.32;
  outer.mesh.rotation.y = 0.24;
  group.add(inner.mesh, outer.mesh);

  return {
    group,
    update(time, aspect) {
      moveMembrane(inner, time);
      moveMembrane(outer, time);
      const compact = aspect < 0.9;
      group.position.set(
        aspect * (compact ? 0.7 : 0.59),
        Math.sin(time * 0.48) * 0.045,
        0,
      );
      group.scale.setScalar(Math.min(compact ? 0.62 : 0.83, aspect / 1.3));
      group.rotation.set(
        0.16 + Math.sin(time * 0.23) * 0.075,
        time * 0.12,
        -0.1 + Math.sin(time * 0.27) * 0.075,
      );
      inner.mesh.rotation.y = -time * 0.07;
    },
    dispose() {
      for (const membrane of [inner, outer]) {
        membrane.geometry.dispose();
        membrane.material.dispose();
      }
    },
  };
}
