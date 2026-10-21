import type * as THREE from "three";

export type AnimatedScene = {
  group: THREE.Group;
  update: (time: number, aspect: number, scrollProgress?: number) => void;
  dispose: () => void;
};

export type VisualMode = 0 | 1 | 2;
