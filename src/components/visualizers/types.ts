import type * as THREE from "three";

export type AnimatedScene = {
  group: THREE.Group;
  update: (time: number, aspect: number) => void;
  dispose: () => void;
};
