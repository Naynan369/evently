import * as THREE from "three";
import type { AnimatedScene } from "./types";

const ORB_SIZES = [0.29, 0.36, 0.3];
const ORB_POSITIONS = [
  [-0.5, -0.04],
  [0, 0.17],
  [0.5, -0.09],
];
const CLAY_COLORS = ["#d9c9b5", "#b9c6cc", "#c9c0b4"];
const ORBIT_COLORS = ["#cbb99f", "#aab9c5", "#d4c3a8"];

export function createGoodCompanyScene(): AnimatedScene {
  const group = new THREE.Group();
  const orbGeometry = new THREE.SphereGeometry(1, 56, 40);
  const orbMaterials = CLAY_COLORS.map(
    (color) =>
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.72,
        metalness: 0.015,
      }),
  );
  const orbs = ORB_SIZES.map((size, index) => {
    const orb = new THREE.Mesh(orbGeometry, orbMaterials[index]);
    orb.scale.setScalar(size);
    group.add(orb);
    return orb;
  });

  const orbitGeometry = new THREE.TorusGeometry(1, 0.008, 6, 120);
  const orbitMaterials = ORBIT_COLORS.map(
    (color) =>
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.58,
        depthWrite: false,
        toneMapped: false,
      }),
  );
  const orbits = ORB_SIZES.map((size, index) => {
    const orbit = new THREE.Mesh(orbitGeometry, orbitMaterials[index]);
    orbit.scale.set(size * 1.58, size * 1.12, size * 1.58);
    orbit.rotation.x = 0.78 + index * 0.13;
    group.add(orbit);
    return orbit;
  });

  const beadGeometry = new THREE.SphereGeometry(0.035, 20, 16);
  const beadMaterial = new THREE.MeshBasicMaterial({
    color: "#eee3d2",
    transparent: true,
    opacity: 0.8,
    toneMapped: false,
  });
  const satellites = Array.from({ length: 3 }, (_, index) => {
    const bead = new THREE.Mesh(beadGeometry, beadMaterial);
    group.add(bead);
    return bead;
  });

  return {
    group,
    update(time, aspect) {
      group.position.set(aspect * 0.39, 0.02, 0);
      group.scale.setScalar(Math.min(1, aspect / 1.35));
      group.rotation.z = Math.sin(time * 0.3) * 0.055;

      orbs.forEach((orb, index) => {
        const [x, y] = ORB_POSITIONS[index];
        const phase = time * (0.64 + index * 0.12) + index * 2.05;
        orb.position.set(
          x + Math.sin(phase) * 0.075,
          y + Math.sin(phase * 1.22) * 0.1,
          index * 0.035,
        );
        const breath = 1 + Math.sin(phase * 1.45) * 0.045;
        orb.scale.setScalar(ORB_SIZES[index] * breath);
        orb.rotation.set(Math.cos(phase) * 0.14, phase * 0.18, Math.sin(phase) * 0.12);

        orbits[index].position.copy(orb.position);
        orbits[index].rotation.z = phase * (index % 2 ? -0.2 : 0.2);
      });

      satellites.forEach((bead, index) => {
        const angle = time * (0.55 + index * 0.08) + index * ((Math.PI * 2) / 3);
        bead.position.set(Math.cos(angle) * 0.72, Math.sin(angle * 1.2) * 0.3, 0.24);
        bead.scale.setScalar(0.78 + (0.5 + 0.5 * Math.sin(angle * 2)) * 0.38);
      });
    },
    dispose() {
      orbGeometry.dispose();
      orbMaterials.forEach((material) => material.dispose());
      orbitGeometry.dispose();
      orbitMaterials.forEach((material) => material.dispose());
      beadGeometry.dispose();
      beadMaterial.dispose();
    },
  };
}
