// Texture loading. PBR sets from Poly Haven (CC0): diffuse, OpenGL normal, and ARM (AO / roughness / metalness).
import * as THREE from "three";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";

export const manager = new THREE.LoadingManager();
const texLoader = new THREE.TextureLoader(manager);
const hdrLoader = new HDRLoader(manager);
const url = (p) => `./assets/${p}`;

let maxAniso = 8;
export function setAnisotropy(n) { maxAniso = n; }

/**
 * A tiling PBR material. `repeat` is in texture tiles per unit of UV; geometry UVs are set up in metres
 * where it matters, so `repeat` is effectively "tiles per metre".
 */
export function pbr(name, { repeat = [1, 1], color = 0xffffff, rotation = 0, normalScale = 1, roughness = 1, envMapIntensity = 1, side } = {}) {
  const set = (suffix, srgb) => {
    const t = texLoader.load(url(`tex/${name}_${suffix}.jpg`));
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
    t.rotation = rotation;
    t.anisotropy = maxAniso;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const arm = set("arm", false);
  return new THREE.MeshStandardMaterial({
    map: set("diff", true),
    normalMap: set("nor", false),
    normalScale: new THREE.Vector2(normalScale, normalScale),
    aoMap: arm,
    roughnessMap: arm,
    metalnessMap: arm,
    metalness: 1, // scaled by the map's blue channel (all ~0 for these materials)
    roughness,
    color,
    envMapIntensity,
    side,
  });
}

export function loadHDR(path) {
  return new Promise((resolve, reject) => hdrLoader.load(url(path), resolve, undefined, reject));
}

/** Draw into a canvas and get a texture back. */
export function canvasTexture(w, h, draw, { srgb = true, repeat } = {}) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  // redraw once web fonts have arrived (calligraphy is drawn with a web font)
  t.userData.redraw = () => { ctx.clearRect(0, 0, w, h); draw(ctx, w, h); t.needsUpdate = true; };
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = maxAniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

export function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
