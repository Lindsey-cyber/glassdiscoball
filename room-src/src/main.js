// 竹里馆 — a bamboo hut on 终南山 in the morning, with a 多宝格 in the middle of the room.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { manager, loadHDR, setAnisotropy, rng } from "./assets.js";
import { buildHut, HUT } from "./hut.js";
import { buildShelf, CAB } from "./shelf.js";
import { buildOutside } from "./outside.js";
import { createPlayer } from "./player.js";

const canvas = document.getElementById("view");
const veil = document.getElementById("veil");
const progress = document.getElementById("progress");
const tagEl = document.getElementById("tag");
const hintEl = document.getElementById("hint");
const fadeEl = document.getElementById("fade");
const touch = matchMedia("(hover: none)").matches;
const params = new URLSearchParams(location.search);
const small = params.has("lite") || Math.min(innerWidth, innerHeight) < 700 || touch;   // ?lite forces the lighter settings
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- renderer ---------- */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
} catch (e) {
  veil.classList.add("failed");
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
setAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xdcd6c6, .0065);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, .05, 3000);

manager.onProgress = (_, loaded, total) => { progress.style.width = `${(loaded / total) * 100}%`; };

/* ---------- light: a low morning sun from the east, sky light from the haze ---------- */
const SUN_DIR = new THREE.Vector3(.85, .42, -.32).normalize();
const sun = new THREE.DirectionalLight(0xffdcae, 5.2);
sun.position.copy(SUN_DIR).multiplyScalar(20);
sun.target.position.set(0, 0, 0);
sun.castShadow = true;
sun.shadow.mapSize.set(small ? 2048 : 4096, small ? 2048 : 4096);
Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 50 });
sun.shadow.bias = -.0003; sun.shadow.normalBias = .02;
scene.add(sun, sun.target);
const sky = new THREE.HemisphereLight(0xd6e2ea, 0x6b5a40, .45);
scene.add(sky);
// a little warm bounce from the sunlit floor, which the real-time lighting does not compute
const bounce = new THREE.PointLight(0xffc890, 1.6, 7, 1.6);
bounce.position.set(1.8, .5, -.5);
scene.add(bounce);
// the lamp that wakes a compartment when you look at its object
const lamp = new THREE.PointLight(0xffe0b0, 0, 1.4, 1.5);
scene.add(lamp);

/* ---------- the world ---------- */
const hut = buildHut();
scene.add(hut.group);
const shelf = buildShelf();
scene.add(shelf.group);
const outside = buildOutside();
scene.add(outside.group);

/* light through the slats: faint striped volumes, and dust turning in them */
function lightShafts() {
  const g = new THREE.Group();
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uTime: { value: 0 }, uPitch: { value: .079 }, uStrength: { value: 1 } },
    vertexShader: `attribute float aT; attribute vec3 aSrc; varying float vT; varying vec3 vSrc; varying vec3 vW;
      void main(){ vT = aT; vSrc = aSrc; vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uPitch, uStrength; varying float vT; varying vec3 vSrc; varying vec3 vW;
      void main(){
        float stripe = smoothstep(.62, .95, fract(vSrc.z / uPitch + .5));          // the gaps between slats
        float win = step(-1.1, vSrc.z) * step(vSrc.z, .9) * step(1.0, vSrc.y) * step(vSrc.y, 2.05);
        float a = mix(stripe * .35, 1., win) * (1. - vT) * (1. - vT) * .055 * uStrength;
        a *= .75 + .25 * sin(uTime * .7 + vSrc.z * 3.);
        gl_FragColor = vec4(vec3(1., .86, .62) * a, a);
      }`,
  });
  // a sheaf of quads, each starting on the east wall and running along the sun's rays into the room
  const pos = [], tAttr = [], src = [], idx = [];
  const along = SUN_DIR.clone().multiplyScalar(-6.5);
  let v = 0;
  for (let z = HUT.z0 + .1; z < HUT.z1 - .1; z += .32) {
    for (const [y0, y1] of [[.1, 2.6]]) {
      const a = new THREE.Vector3(HUT.x1, y0, z), b = new THREE.Vector3(HUT.x1, y1, z);
      for (const p of [a, b, a.clone().add(along), b.clone().add(along)]) pos.push(p.x, p.y, p.z);
      tAttr.push(0, 0, 1, 1);
      for (const p of [a, b, a, b]) src.push(p.x, p.y, p.z);
      idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2); v += 4;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("aT", new THREE.Float32BufferAttribute(tAttr, 1));
  geo.setAttribute("aSrc", new THREE.Float32BufferAttribute(src, 3));
  geo.setIndex(idx);
  g.add(new THREE.Mesh(geo, mat));

  const N = small ? 220 : 500, r = rng(31);
  const dpos = new Float32Array(N * 3), seeds = [];
  for (let i = 0; i < N; i++) {
    const s = r(); const z = -1.1 + r() * 2;
    seeds.push({ s, z, y: 1 + r() * 1.1, ph: r() * 6.28, sp: .2 + r() * .5 });
  }
  const dgeo = new THREE.BufferGeometry(); dgeo.setAttribute("position", new THREE.BufferAttribute(dpos, 3));
  const dust = new THREE.Points(dgeo, new THREE.PointsMaterial({ color: 0xffe6b8, size: .012, transparent: true, opacity: .75, blending: THREE.AdditiveBlending, depthWrite: false }));
  g.add(dust);
  function update(t) {
    mat.uniforms.uTime.value = t;
    seeds.forEach((d, i) => {
      const k = (d.s + t * .004 * d.sp) % 1;           // drift along the beam
      dpos[i * 3] = HUT.x1 - k * 5.5 + Math.sin(t * .3 + d.ph) * .05;
      dpos[i * 3 + 1] = d.y - k * 2.7 + Math.sin(t * .4 + d.ph * 2) * .06;
      dpos[i * 3 + 2] = d.z + k * 2.1 + Math.cos(t * .25 + d.ph) * .05;
    });
    dgeo.attributes.position.needsUpdate = true;
  }
  return { group: g, update };
}
const shafts = lightShafts();
scene.add(shafts.group);

/* ---------- post: ambient occlusion, a little bloom, and a 国风 grade ---------- */
const target = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: small ? 2 : 4 });
const composer = new EffectComposer(renderer, target);
composer.setPixelRatio(renderer.getPixelRatio());
composer.addPass(new RenderPass(scene, camera));
let gtao = null;
if (!small) {
  gtao = new GTAOPass(scene, camera, innerWidth, innerHeight);
  gtao.blendIntensity = .85;
  gtao.updateGtaoMaterial({ radius: .45, distanceExponent: 1.4, thickness: 1.2, scale: 1.1 });
  composer.addPass(gtao);
}
composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .22, .55, .95));
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; varying vec2 vUv;
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(.2126,.7152,.0722));
      // painterly: shadows lean to cool jade, highlights to warm paper
      c = mix(c, c * vec3(.86, 1.0, 1.02), smoothstep(.35, 0., l) * .5);
      c = mix(c, c * vec3(1.06, 1.0, .9), smoothstep(.4, 1.5, l) * .45);
      c = mix(vec3(l), c, 1.1);
      vec2 d = vUv - .5;
      c *= 1. - dot(d, d) * .55;
      gl_FragColor = vec4(c, 1.);
    }`,
});
composer.addPass(grade);
composer.addPass(new OutputPass());

/* ---------- start ---------- */
const hdr = await loadHDR("hdri/misty_morning_2k.hdr");
hdr.mapping = THREE.EquirectangularReflectionMapping;
scene.background = hdr;
scene.backgroundIntensity = .95;
scene.backgroundRotation.y = -1.2;
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromEquirectangular(hdr).texture;
scene.environmentRotation.y = -1.2;
scene.environmentIntensity = .38;

const player = await createPlayer({
  camera, dom: canvas,
  colliders: [...hut.colliders, shelf.collider],
  start: { x: 0, z: 2.6 },
  yaw: 0,
});
player.state.target = { x: 0, z: 2.15, speed: .55 };     // step in from the doorway

// calligraphy uses a web font: redraw once it has loaded
document.fonts?.load('100px "Ma Shan Zheng"', "行到水穷处坐看云起时竹里馆王维").then(() => {
  hut.scrollTex.userData.redraw(); hut.plaqueTex.userData.redraw();
});

/* ---------- pointing at things ---------- */
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const pickables = shelf.items.map((it) => it.object);
let hovered = null;

function pick(x, y) {
  ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(pickables, true)[0];
  if (!hit || hit.distance > 6) return null;
  let o = hit.object; while (o && !o.userData.item) o = o.parent;
  return o ? o.userData.item : null;
}
function setHover(item) {
  if (item === hovered) return;
  hovered = item;
  canvas.classList.toggle("pointing", !!item);
  if (item) {
    tagEl.innerHTML = `${item.name}<small>${item.sub}</small>`;
    tagEl.classList.add("on");
    const c = item.compartment;
    lamp.position.copy(c.center).add(new THREE.Vector3(0, c.h / 2 - .06, CAB.D / 2 + .1)).add(shelf.group.position);
  } else tagEl.classList.remove("on");
}
canvas.addEventListener("pointermove", (e) => {
  if (e.pointerType === "mouse" && !player.state.locked) setHover(pick(e.clientX, e.clientY));
});

let entering = false;
function enter(item) {
  if (!item.href) {            // still being made
    tagEl.animate([{ transform: "translate(-50%,-110%) rotate(0)" }, { transform: "translate(-50%,-110%) rotate(-4deg)" }, { transform: "translate(-50%,-110%) rotate(3deg)" }, { transform: "translate(-50%,-110%) rotate(0)" }], { duration: 400 });
    return;
  }
  entering = true;
  player.state.locked = true;
  const from = camera.position.clone(), fromQ = camera.quaternion.clone();
  const focus = item.compartment.center.clone().add(shelf.group.position);
  const to = focus.clone().add(new THREE.Vector3(0, 0, .55));
  const toQ = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(to, focus, new THREE.Vector3(0, 1, 0)));
  const t0 = performance.now();
  (function fly() {
    const u = Math.min(1, (performance.now() - t0) / 1400), e = u * u * (3 - 2 * u);
    camera.position.lerpVectors(from, to, e);
    camera.quaternion.slerpQuaternions(fromQ, toQ, e);
    if (u > .55) fadeEl.classList.add("on");
    if (u < 1) requestAnimationFrame(fly);
    else setTimeout(() => { location.href = item.href; }, 350);
  })();
}

const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
canvas.addEventListener("pointerup", (e) => {
  if (entering || !player.state.wasClick()) return;
  const item = pick(e.clientX, e.clientY);
  if (item) {
    if (e.pointerType !== "mouse" && hovered !== item) { setHover(item); return; }   // first tap shows the label
    enter(item);
    return;
  }
  setHover(null);
  // tap the floor to walk there
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const p = ray.ray.intersectPlane(floorPlane, new THREE.Vector3());
  if (p && camera.position.distanceTo(p) < 9) { player.state.target = { x: p.x, z: p.z }; player.state.moved = true; }
});
// back from a project with the browser's back button: lift the fade again
addEventListener("pageshow", () => { fadeEl.classList.remove("on"); entering = false; player.state.locked = false; });

/* ---------- resize ---------- */
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.fov = w / h < .8 ? 72 : 60;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();

/* ---------- loop ---------- */
const clock = new THREE.Clock();
let acc = 0, hintTimer = 0;
const tagPos = new THREE.Vector3();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), .05);
  const t = clock.elapsedTime;
  acc += dt;
  while (acc >= 1 / 60) { player.step(1 / 60); acc -= 1 / 60; }
  player.apply();
  if (!reduce) { shelf.update(t); outside.update(t); }
  shafts.update(t);
  lamp.intensity += ((hovered ? 1.4 : 0) - lamp.intensity) * .12;
  if (hovered) {
    const c = hovered.compartment;
    tagPos.copy(c.center).add(shelf.group.position).add(new THREE.Vector3(-c.w / 2 + .05, c.h / 2, CAB.D / 2)).project(camera);
    tagEl.style.left = `${(tagPos.x * .5 + .5) * innerWidth}px`;
    tagEl.style.top = `${(-tagPos.y * .5 + .5) * innerHeight}px`;
  }
  if (player.state.moved && (hintTimer += dt) > 4) hintEl.classList.add("gone");
  composer.render(dt);
});

veil.classList.add("gone");
window.__room = { player, camera };   // for automated screenshots
