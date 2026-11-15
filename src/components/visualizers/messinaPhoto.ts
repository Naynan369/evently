import * as THREE from "three";

const PHOTO_SEGMENTS_X = 64;
const PHOTO_SEGMENTS_Y = 40;
const FOLD_DURATION = 1.25;

type PhotoScene = {
  group: THREE.Group;
  resize: (width: number, height: number) => void;
  update: (activeIndex: number, time: number, delta: number, pointerX: number, pointerY: number, still: boolean) => void;
  dispose: () => void;
};

function visiblePhoto(aspect: number, photoAspect: number) {
  if (aspect >= photoAspect) {
    const height = photoAspect / aspect;
    return { u0: 0, u1: 1, v0: 1 - height, v1: 1 };
  }
  const width = aspect / photoAspect;
  return { u0: (1 - width) / 2, u1: (1 + width) / 2, v0: 0, v1: 1 };
}

function setPhotoCrop(geometry: THREE.PlaneGeometry, crop: ReturnType<typeof visiblePhoto>) {
  const uv = geometry.getAttribute("uv") as THREE.BufferAttribute;
  for (let index = 0; index < uv.count; index++) {
    const u = index % (PHOTO_SEGMENTS_X + 1) / PHOTO_SEGMENTS_X;
    const v = 1 - Math.floor(index / (PHOTO_SEGMENTS_X + 1)) / PHOTO_SEGMENTS_Y;
    uv.setXY(index, THREE.MathUtils.lerp(crop.u0, crop.u1, u), THREE.MathUtils.lerp(crop.v0, crop.v1, v));
  }
  uv.needsUpdate = true;
}

function addPrintShading(geometry: THREE.PlaneGeometry) {
  const colors = new Float32Array(geometry.getAttribute("position").count * 3);
  colors.fill(1);
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

export function createMessinaPhotoScene(textures: THREE.Texture[]): PhotoScene {
  textures.forEach((texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
  });

  const group = new THREE.Group();
  const photograph = new THREE.Group();
  group.add(photograph);

  const material = new THREE.MeshBasicMaterial({
    map: textures[0],
    vertexColors: true,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
  });
  const outgoingMaterial = material.clone();
  outgoingMaterial.opacity = 0;
  let geometry = new THREE.PlaneGeometry(2, 2, PHOTO_SEGMENTS_X, PHOTO_SEGMENTS_Y);
  addPrintShading(geometry);
  const surface = new THREE.Mesh(geometry, material);
  surface.renderOrder = 2;
  const outgoing = new THREE.Mesh(geometry, outgoingMaterial);
  outgoing.renderOrder = 1;
  outgoing.visible = false;
  photograph.add(outgoing, surface);

  const backgroundMaterial = new THREE.MeshBasicMaterial({ map: textures[0], color: 0x64717b });
  const background = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), backgroundMaterial);
  background.position.z = -0.24;
  group.add(background);

  const imageAspect = (texture: THREE.Texture) => {
    const image = texture.image as HTMLImageElement;
    return image.naturalWidth / image.naturalHeight;
  };
  let basePositions = geometry.getAttribute("position").array.slice() as Float32Array;
  let aspect = 1;
  let previousIndex = 0;
  let crossfade = 1;
  let foldTime = FOLD_DURATION;
  let revealTime = 0;

  const cropCurrentPhoto = () => {
    const crop = visiblePhoto(aspect, imageAspect(textures[previousIndex]));
    setPhotoCrop(geometry, crop);
    setPhotoCrop(background.geometry as THREE.PlaneGeometry, crop);
  };

  return {
    group,
    resize(width, height) {
      aspect = width / height;
      geometry.dispose();
      geometry = new THREE.PlaneGeometry(aspect * 2, 2, PHOTO_SEGMENTS_X, PHOTO_SEGMENTS_Y);
      addPrintShading(geometry);
      surface.geometry = geometry;
      outgoing.geometry = geometry;
      basePositions = geometry.getAttribute("position").array.slice() as Float32Array;

      background.geometry.dispose();
      background.geometry = new THREE.PlaneGeometry(aspect * 2 + 0.02, 2.02, PHOTO_SEGMENTS_X, PHOTO_SEGMENTS_Y);
      cropCurrentPhoto();
    },
    update(activeIndex, time, delta, pointerX, pointerY, still) {
      if (activeIndex !== previousIndex) {
        const nextIndex = Math.max(0, Math.min(textures.length - 1, activeIndex));
        outgoingMaterial.map = textures[previousIndex];
        outgoingMaterial.needsUpdate = true;
        outgoing.visible = !still;
        material.map = textures[nextIndex];
        material.needsUpdate = true;
        backgroundMaterial.map = textures[nextIndex];
        backgroundMaterial.needsUpdate = true;
        crossfade = still ? 1 : 0;
        material.opacity = still ? 1 : 0;
        outgoingMaterial.opacity = still ? 0 : 1;
        previousIndex = nextIndex;
        cropCurrentPhoto();
        foldTime = 0;
      }
      if (crossfade < 1) {
        crossfade = Math.min(1, crossfade + delta / 0.58);
        const blend = THREE.MathUtils.smoothstep(crossfade, 0, 1);
        material.opacity = blend;
        outgoingMaterial.opacity = 1 - blend;
        if (crossfade === 1) outgoing.visible = false;
      }
      foldTime = still ? FOLD_DURATION : Math.min(FOLD_DURATION, foldTime + delta);
      revealTime = still ? 1.45 : Math.min(1.45, revealTime + delta);

      const reveal = THREE.MathUtils.smoothstep(revealTime, 0, 1.38);
      const opening = 1 - reveal;
      const progress = foldTime / FOLD_DURATION;
      const foldStrength = still ? 0 : Math.sin(Math.PI * progress);
      const direction = activeIndex % 2 === 0 ? 1 : -1;
      const foldCentre = direction * THREE.MathUtils.lerp(-1.28, 1.28, progress);
      const positions = geometry.getAttribute("position") as THREE.BufferAttribute;
      const colors = geometry.getAttribute("color") as THREE.BufferAttribute;

      // A single subdivided photograph forms a traveling paper fold.
      // The dim copy behind it reveals depth only while the print is moving.
      for (let index = 0; index < positions.count; index++) {
        const offset = index * 3;
        const x = basePositions[offset];
        const y = basePositions[offset + 1];
        const nx = x / aspect;
        const distance = nx - foldCentre;
        const ridge = Math.exp(-distance * distance * 20) * foldStrength;
        const edge = 1 - Math.abs(nx);
        const arch = Math.max(0, edge) * opening;
        const highlight = Math.exp(-Math.pow(distance + 0.12, 2) * 72);
        const shadow = Math.exp(-Math.pow(distance - 0.12, 2) * 72);
        const shade = 1 - arch * 0.13 + foldStrength * (highlight * 0.24 - shadow * 0.27);
        positions.setXYZ(
          index,
          x * (1 - opening * 0.13) + distance * ridge * 0.055,
          y + Math.sin(nx * Math.PI) * opening * 0.065,
          arch * 0.52 + ridge * 0.47 + Math.sin(nx * 2.8 + time * 0.55) * 0.007 * reveal,
        );
        colors.setXYZ(index, shade, shade, shade);
      }
      positions.needsUpdate = true;
      colors.needsUpdate = true;

      const follow = still ? 1 : Math.min(1, delta * 6);
      photograph.rotation.y += (pointerX * 0.028 - photograph.rotation.y) * follow;
      photograph.rotation.x += (-pointerY * 0.018 - photograph.rotation.x) * follow;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      outgoingMaterial.dispose();
      background.geometry.dispose();
      backgroundMaterial.dispose();
      textures.forEach((texture) => texture.dispose());
    },
  };
}
