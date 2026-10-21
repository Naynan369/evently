import * as THREE from "three";
import type { AnimatedScene } from "./types";

const BAR_COUNT = 96;
const BAR_COLORS = ["#becbd5", "#d5c1a5", "#9baebc"];

export function createClubNightsScene(): AnimatedScene {
  const group = new THREE.Group();
  const dummy = new THREE.Object3D();
  const barGeometry = new THREE.CapsuleGeometry(0.011, 1, 3, 8);
  const barMaterial = new THREE.MeshBasicMaterial({
    color: "#ffffff",
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const bars = new THREE.InstancedMesh(barGeometry, barMaterial, BAR_COUNT);
  bars.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  for (let index = 0; index < BAR_COUNT; index += 1) {
    bars.setColorAt(index, new THREE.Color(BAR_COLORS[index % BAR_COLORS.length]));
  }
  group.add(bars);

  const ringMaterials = ["#b8c7d3", "#d1bea1", "#8ea2b1"].map(
    (ringColor, index) =>
      new THREE.MeshBasicMaterial({
        color: ringColor,
        transparent: true,
        opacity: 0.22 - index * 0.035,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
  );
  const ringGeometry = new THREE.TorusGeometry(1, 0.004, 5, 180);
  const ringRadii = [0.31, 0.46, 0.63];
  const rings = ringRadii.map((radius, index) => {
    const ring = new THREE.Mesh(ringGeometry, ringMaterials[index]);
    ring.scale.setScalar(radius);
    ring.position.z = -0.03 - index * 0.01;
    group.add(ring);
    return ring;
  });

  const coreGeometry = new THREE.CircleGeometry(0.23, 64);
  const coreMaterial = new THREE.MeshBasicMaterial({
    color: "#b9c6d1",
    transparent: true,
    opacity: 0.075,
    depthWrite: false,
    toneMapped: false,
  });
  const core = new THREE.Mesh(coreGeometry, coreMaterial);
  core.position.z = -0.08;
  group.add(core);

  return {
    group,
    update(time, aspect) {
      const fit = Math.min(1, aspect / 1.25);
      group.scale.setScalar(fit);
      group.position.set(aspect * 0.24, 0.04, 0);
      group.rotation.z = Math.sin(time * 0.22) * 0.045;

      rings.forEach((ring, index) => {
        const pulse = 1 + Math.sin(time * (1.4 - index * 0.16) + index) * 0.025;
        ring.scale.setScalar(ringRadii[index] * pulse);
        ring.rotation.z = time * (index % 2 ? -0.09 : 0.07);
      });

      for (let index = 0; index < BAR_COUNT; index += 1) {
        const baseAngle = (index / BAR_COUNT) * Math.PI * 2;
        const angle = baseAngle + time * 0.19;
        const kick =
          0.5 +
          0.3 * Math.sin(index * 0.31 - time * 3.2) +
          0.2 * Math.sin(index * 0.12 - time * 1.8 + 1.2);
        const length = 0.045 + Math.pow(Math.max(0, kick), 1.5) * 0.19;
        const radius = 0.39 + Math.sin(baseAngle * 4 - time * 1.8) * 0.018;

        dummy.position.set(
          Math.cos(angle) * (radius + length / 2),
          Math.sin(angle) * (radius + length / 2),
          0.04,
        );
        dummy.rotation.set(0, 0, angle - Math.PI / 2);
        dummy.scale.set(1, length, 1);
        dummy.updateMatrix();
        bars.setMatrixAt(index, dummy.matrix);
      }
      bars.instanceMatrix.needsUpdate = true;
      core.scale.setScalar(1 + Math.sin(time * 2.4) * 0.035);
    },
    dispose() {
      barGeometry.dispose();
      barMaterial.dispose();
      ringGeometry.dispose();
      ringMaterials.forEach((material) => material.dispose());
      coreGeometry.dispose();
      coreMaterial.dispose();
    },
  };
}
