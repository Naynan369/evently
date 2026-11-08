import * as THREE from "three";
import type { AnimatedScene } from "./types";

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

  float hash(vec2 point) {
    point = fract(point * vec2(123.34, 456.21));
    point += dot(point, point + 45.32);
    return fract(point.x * point.y);
  }

  float noise(vec2 point) {
    vec2 cell = floor(point);
    vec2 fraction = fract(point);
    fraction = fraction * fraction * (3.0 - 2.0 * fraction);
    float low = mix(hash(cell), hash(cell + vec2(1.0, 0.0)), fraction.x);
    float high = mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0)), fraction.x);
    return mix(low, high, fraction.y);
  }

  float atmosphereNoise(vec2 point) {
    float value = 0.0;
    float weight = 0.5;
    mat2 rotation = mat2(0.8, -0.6, 0.6, 0.8);

    for (int layer = 0; layer < 4; layer++) {
      value += noise(point) * weight;
      point = rotation * point * 1.94 + 13.7;
      weight *= 0.5;
    }
    return value;
  }

  float softShaft(vec2 point, vec2 origin, float angle, float reach) {
    vec2 direction = vec2(sin(angle), -cos(angle));
    vec2 offset = point - origin;
    float along = dot(offset, direction);
    float across = abs(offset.x * direction.y - offset.y * direction.x);
    float width = 0.055 + max(along, 0.0) * 0.18;
    float penumbra = exp(-pow(across / width, 2.0) * 1.7);
    float fadeIn = smoothstep(0.0, 0.18, along);
    float fadeOut = 1.0 - smoothstep(reach * 0.72, reach, along);
    return penumbra * fadeIn * fadeOut;
  }

  void main() {
    vec2 point = (vUv - 0.5) * vec2(uAspect, 1.0);
    float time = uTime * 0.075;

    // A low-frequency warped field gives the light a soft, atmospheric edge.
    vec2 drift = vec2(
      atmosphereNoise(point * 1.35 + vec2(time, -time * 0.58)),
      atmosphereNoise(point * 1.52 + vec2(-time * 0.66, time * 0.82))
    );
    vec2 field = point + (drift - 0.5) * 0.16;
    float cloud = atmosphereNoise(field * 2.0 + vec2(time * 0.7, -time * 0.52));

    // Broad, diffuse sources move like distant lights seen through venue haze.
    vec2 leftSource = vec2(-0.58 + sin(uTime * 0.11) * 0.13, 0.8);
    vec2 rightSource = vec2(0.54 + sin(uTime * 0.09 + 1.8) * 0.12, 0.72);
    vec2 centerSource = vec2(0.02 + sin(uTime * 0.07 + 2.2) * 0.12, 0.94);

    float leftBloom = exp(-dot((field - leftSource) * vec2(0.82, 1.35), (field - leftSource) * vec2(0.82, 1.35)) * 2.4);
    float rightBloom = exp(-dot((field - rightSource) * vec2(0.92, 1.15), (field - rightSource) * vec2(0.92, 1.15)) * 2.2);
    float centerBloom = exp(-dot((field - centerSource) * vec2(0.72, 1.2), (field - centerSource) * vec2(0.72, 1.2)) * 2.7);

    float leftShaft = softShaft(field, leftSource, -0.23 + sin(uTime * 0.1) * 0.11, 1.75);
    float rightShaft = softShaft(field, rightSource, 0.2 + sin(uTime * 0.085 + 2.0) * 0.1, 1.7);
    float shafts = leftShaft * 0.42 + rightShaft * 0.34;

    float hazePosition = (field.y + 0.2) * 0.82;
    float hazeBand = exp(-hazePosition * hazePosition);
    float haze = hazeBand * (0.42 + cloud * 0.58);
    float light = leftBloom * 0.44 + rightBloom * 0.4 + centerBloom * 0.31 + shafts * (0.72 + cloud * 0.28);
    float vignette = 1.0 - smoothstep(0.72, 1.9, length(point * vec2(0.74, 1.0)));

    vec3 slate = vec3(0.24, 0.36, 0.39);
    vec3 coolSilver = vec3(0.48, 0.64, 0.67);
    vec3 lightColor = mix(slate, coolSilver, clamp(cloud * 0.68 + shafts * 0.22, 0.0, 0.7));
    float alpha = (light * 0.105 + haze * 0.025) * vignette;

    gl_FragColor = vec4(lightColor, clamp(alpha, 0.0, 0.16));
  }
`;

export function createExploreScene(): AnimatedScene {
  const group = new THREE.Group();
  const uniforms = {
    uTime: { value: 0 },
    uAspect: { value: 1 },
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

  return {
    group,
    update(time, aspect) {
      uniforms.uTime.value = time;
      uniforms.uAspect.value = aspect;
      field.scale.x = aspect;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
