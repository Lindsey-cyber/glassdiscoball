// 竹里馆: a bamboo hut on a ledge. Units are metres; +x is east, -z is north (the open side, facing the valley).
import * as THREE from "three";
import { pbr, canvasTexture, rng } from "./assets.js";

export const HUT = {
  x0: -4, x1: 4, z0: -3, z1: 3,      // interior footprint
  eave: 2.7, ridge: 4.05,
  deckZ: -4.6,                       // deck edge on the valley side
  door: { x0: -0.55, x1: 0.55, h: 2.05 },
  eastWindow: { z0: -1.1, z1: 0.9, y0: 1.0, y1: 2.05 },
};

/* ---------- helpers ---------- */

/** A box whose UVs are in metres on every face, so tiling textures keep their real scale. */
export function metricBox(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
    const k = f * 4 + i;
    uv.setXY(k, uv.getX(k) * dims[f][0], uv.getY(k) * dims[f][1]);
  }
  g.setAttribute("uv1", uv.clone());
  return g;
}

function bambooPoleTexture(fresh) {
  // around the stalk (u) and along it (v): base colour, fine fibres, and a node ring per tile
  return canvasTexture(128, 256, (g, w, h) => {
    const base = fresh ? ["#6f8a3e", "#8ea34f", "#5e7834"] : ["#b59a62", "#cdb57c", "#9c8150"];
    const grd = g.createLinearGradient(0, 0, w, 0);
    grd.addColorStop(0, base[2]); grd.addColorStop(.45, base[1]); grd.addColorStop(1, base[2]);
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    const r = rng(fresh ? 3 : 9);
    for (let i = 0; i < 90; i++) {
      g.fillStyle = `rgba(${r() < .5 ? "40,30,10" : "255,240,200"},${(r() * .08).toFixed(3)})`;
      g.fillRect(r() * w, 0, 1 + r() * 2, h);
    }
    // the node
    const y = h * .92;
    g.fillStyle = fresh ? "rgba(40,50,20,.55)" : "rgba(80,58,28,.6)"; g.fillRect(0, y, w, 7);
    g.fillStyle = fresh ? "rgba(220,230,180,.35)" : "rgba(250,230,180,.35)"; g.fillRect(0, y + 7, w, 3);
    g.fillStyle = "rgba(0,0,0,.18)"; g.fillRect(0, y - 6, w, 6);
  }, { repeat: [1, 1] });
}

const poleMats = new Map();
/** Dried bamboo pole material with a node every ~0.4 m. */
export function poleMaterial(length, fresh = false) {
  const key = `${fresh}:${Math.round(length * 4)}`;
  if (!poleMats.has(key)) {
    const t = bambooPoleTexture(fresh);
    t.repeat.set(1, Math.max(1, Math.round(length / 0.42)));
    poleMats.set(key, new THREE.MeshStandardMaterial({ map: t, roughness: .55, metalness: 0, envMapIntensity: .8 }));
  }
  return poleMats.get(key);
}

/** One bamboo pole from a to b. */
export function pole(a, b, r = 0.06, fresh = false) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.04, len, 12, 1), poleMaterial(len, fresh));
  m.position.copy(a).addScaledVector(dir, .5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  m.castShadow = m.receiveShadow = true;
  return m;
}

/* ---------- the hut ---------- */

export function buildHut() {
  const g = new THREE.Group();
  const colliders = [];                     // axis-aligned boxes for the physics world: [cx,cy,cz,hx,hy,hz]
  const H = HUT;

  const floorMat = pbr("old_wooden_floor_02", { repeat: [0.45, 0.45], color: 0xd9c7a8, normalScale: 0.8 });
  const wovenMat = pbr("bamboo_wall_03", { repeat: [0.7, 0.7], color: 0xf0dfb8 });
  const wovenMatD = pbr("bamboo_wall_03", { repeat: [0.7, 0.7], color: 0xf0dfb8, side: THREE.DoubleSide });
  const reedMat = pbr("reed_roof_03", { repeat: [0.6, 0.6], color: 0xd8c49a });
  const blindMat = pbr("bamboo_wall", { repeat: [1.4, 0.6], color: 0xe8d4a6, rotation: Math.PI / 2 });

  /* floor: a raised platform, with the deck running out over the cliff */
  const floorW = H.x1 - H.x0 + 0.4, floorD = H.z1 - H.deckZ + 0.2;
  const floor = new THREE.Mesh(metricBox(floorW, 0.24, floorD), floorMat);
  floor.position.set(0, -0.12, (H.z1 + H.deckZ) / 2);
  floor.receiveShadow = true; floor.castShadow = true;
  g.add(floor);
  colliders.push([0, -0.12, floor.position.z, floorW / 2, 0.12, floorD / 2]);

  // stilts under the deck, down the cliff
  for (const x of [H.x0, -1.3, 1.3, H.x1]) for (const z of [H.deckZ + .1, -3.0]) g.add(pole(new THREE.Vector3(x, -3.2, z), new THREE.Vector3(x, -0.2, z), .07));
  g.add(pole(new THREE.Vector3(H.x0, -1.2, H.deckZ + .1), new THREE.Vector3(H.x1, -1.2, H.deckZ + .1), .05));

  /* posts and beams */
  const postX = [H.x0, -2, 0, 2, H.x1];
  for (const x of [H.x0, H.x1]) for (const z of [H.z0, -1, 1, H.z1]) g.add(pole(new THREE.Vector3(x, 0, z), new THREE.Vector3(x, H.eave + .05, z), .075));
  for (const x of [-1.3, 1.3]) for (const z of [H.z0, H.z1]) g.add(pole(new THREE.Vector3(x, 0, z), new THREE.Vector3(x, H.eave + .05, z), .075));
  for (const z of [H.z0, H.z1]) g.add(pole(new THREE.Vector3(H.x0 - .3, H.eave, z), new THREE.Vector3(H.x1 + .3, H.eave, z), .07));
  for (const x of [H.x0, H.x1]) g.add(pole(new THREE.Vector3(x, H.eave, H.z0 - .3), new THREE.Vector3(x, H.eave, H.z1 + .3), .07));
  for (const x of postX.slice(1, -1)) g.add(pole(new THREE.Vector3(x, H.eave, H.z0), new THREE.Vector3(x, H.eave, H.z1), .055)); // tie beams
  g.add(pole(new THREE.Vector3(H.x0 - .5, H.ridge, 0), new THREE.Vector3(H.x1 + .5, H.ridge, 0), .08));                     // ridge
  for (const x of [H.x0, 0, H.x1]) g.add(pole(new THREE.Vector3(x, H.eave, 0), new THREE.Vector3(x, H.ridge, 0), .06));      // king posts

  /* roof: thatch slabs on bamboo rafters */
  const eaveOut = 0.95, slope = Math.atan2(H.ridge - (H.eave - .25), H.z1 + eaveOut);
  const roofLen = Math.hypot(H.z1 + eaveOut, H.ridge - (H.eave - .25));
  for (const s of [-1, 1]) {
    const slab = new THREE.Mesh(metricBox(H.x1 - H.x0 + 1.2, 0.16, roofLen + 0.1), reedMat);
    slab.position.set(0, (H.ridge + H.eave - .25) / 2 + 0.12, s * (H.z1 + eaveOut) / 2);
    slab.rotation.x = s * slope;
    slab.castShadow = slab.receiveShadow = true;
    g.add(slab);
    for (let x = H.x0 - .5; x <= H.x1 + .51; x += .5) {
      const top = new THREE.Vector3(x, H.ridge, 0), low = new THREE.Vector3(x, H.eave - .25, s * (H.z1 + eaveOut));
      g.add(pole(top, low, .035));
    }
  }

  /* walls */
  const wallT = 0.05;
  const wall = (w, h, x, y, z, ry = 0) => {
    const m = new THREE.Mesh(metricBox(w, h, wallT), wovenMat);
    m.position.set(x, y, z); m.rotation.y = ry;
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    return m;
  };
  // south wall, with the door
  const D = H.door;
  wall(D.x0 - H.x0, H.eave, (H.x0 + D.x0) / 2, H.eave / 2, H.z1);
  wall(H.x1 - D.x1, H.eave, (H.x1 + D.x1) / 2, H.eave / 2, H.z1);
  wall(D.x1 - D.x0, H.eave - D.h, 0, (H.eave + D.h) / 2, H.z1);
  colliders.push([(H.x0 + D.x0) / 2, 1.4, H.z1 + .05, (D.x0 - H.x0) / 2, 1.4, .1], [(H.x1 + D.x1) / 2, 1.4, H.z1 + .05, (H.x1 - D.x1) / 2, 1.4, .1]);
  colliders.push([0, 1.4, H.z1 + .5, .6, 1.4, .1]); // the door is for looking out of, not walking out of
  g.add(pole(new THREE.Vector3(D.x0, 0, H.z1), new THREE.Vector3(D.x0, D.h, H.z1), .05));
  g.add(pole(new THREE.Vector3(D.x1, 0, H.z1), new THREE.Vector3(D.x1, D.h, H.z1), .05));
  g.add(pole(new THREE.Vector3(D.x0 - .1, D.h, H.z1), new THREE.Vector3(D.x1 + .1, D.h, H.z1), .05));
  // the wicker door, swung open outward
  const door = new THREE.Mesh(metricBox(D.x1 - D.x0, D.h - .05, .04), wovenMat);
  door.geometry.translate((D.x1 - D.x0) / 2, 0, 0);
  door.position.set(D.x0, D.h / 2, H.z1 + .05); door.rotation.y = -1.9;
  door.castShadow = true; g.add(door);

  // west wall: solid
  wall(H.z1 - H.z0, H.eave, H.x0, H.eave / 2, 0, Math.PI / 2);
  colliders.push([H.x0 - .05, 1.4, 0, .1, 1.4, 3.2]);

  // east wall: upright bamboo slats with hairline gaps, so the morning sun comes through in stripes
  const W = H.eastWindow;
  const slatR = .036, pitch = .079;
  const slatGeo = new THREE.CylinderGeometry(slatR, slatR, 1, 10, 1);
  const slatList = [];
  for (let z = H.z0 + .05; z < H.z1 - .03; z += pitch) {
    if (z > W.z0 && z < W.z1) {
      slatList.push([z, 0, W.y0]);
      slatList.push([z, W.y1, H.eave]);
    } else slatList.push([z, 0, H.eave]);
  }
  const slats = new THREE.InstancedMesh(slatGeo, poleMaterial(2.6), slatList.length);
  const m4 = new THREE.Matrix4();
  slatList.forEach(([z, y0, y1], i) => {
    m4.compose(new THREE.Vector3(H.x1 + .02, (y0 + y1) / 2, z), new THREE.Quaternion(), new THREE.Vector3(1, y1 - y0, 1));
    slats.setMatrixAt(i, m4);
  });
  slats.castShadow = slats.receiveShadow = true;
  g.add(slats);
  for (const y of [.35, 1.5, 2.4]) g.add(pole(new THREE.Vector3(H.x1 - .05, y, H.z0), new THREE.Vector3(H.x1 - .05, y, H.z1), .04)); // binding rails
  // the window: a simple lattice of thin bamboo
  for (const y of [W.y0, W.y1]) g.add(pole(new THREE.Vector3(H.x1, y, W.z0), new THREE.Vector3(H.x1, y, W.z1), .04));
  for (let z = W.z0 + .5; z < W.z1 - .1; z += .5) g.add(pole(new THREE.Vector3(H.x1, W.y0, z), new THREE.Vector3(H.x1, W.y1, z), .018));
  g.add(pole(new THREE.Vector3(H.x1, (W.y0 + W.y1) / 2, W.z0), new THREE.Vector3(H.x1, (W.y0 + W.y1) / 2, W.z1), .018));
  colliders.push([H.x1 + .05, 1.4, 0, .1, 1.4, 3.2]);

  // gables
  for (const x of [H.x0, H.x1]) {
    const shape = new THREE.Shape();
    shape.moveTo(-(H.z1 + .05), 0); shape.lineTo(H.z1 + .05, 0); shape.lineTo(0, H.ridge - H.eave); shape.closePath();
    const geo = new THREE.ShapeGeometry(shape);
    geo.setAttribute("uv1", geo.attributes.uv.clone());
    const m = new THREE.Mesh(geo, wovenMatD);
    m.rotation.y = Math.PI / 2; m.position.set(x, H.eave, 0);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  }

  /* the open north side: half-rolled blinds, and a railing at the deck's edge */
  const bays = [[H.x0, -1.3], [-1.3, 1.3], [1.3, H.x1]];
  bays.forEach(([a, b], i) => {
    const drop = i === 1 ? .38 : .7;                 // the middle blind is rolled up highest, to frame the view
    const blind = new THREE.Mesh(metricBox(b - a - .12, drop, .02), blindMat);
    blind.position.set((a + b) / 2, H.eave - .12 - drop / 2, H.z0 - .02);
    blind.castShadow = true; g.add(blind);
    g.add(pole(new THREE.Vector3(a + .04, H.eave - .12 - drop, H.z0 - .02), new THREE.Vector3(b - .04, H.eave - .12 - drop, H.z0 - .02), .045));
    for (const x of [a + .3, b - .3]) g.add(pole(new THREE.Vector3(x, H.eave - .06, H.z0 - .04), new THREE.Vector3(x, H.eave - .14 - drop, H.z0 - .04), .006));
  });
  for (let x = H.x0; x <= H.x1 + .01; x += 1) g.add(pole(new THREE.Vector3(x, 0, H.deckZ + .08), new THREE.Vector3(x, .95, H.deckZ + .08), .04));
  for (const y of [.5, .95]) g.add(pole(new THREE.Vector3(H.x0 - .1, y, H.deckZ + .08), new THREE.Vector3(H.x1 + .1, y, H.deckZ + .08), .035));
  for (const x of [H.x0, H.x1]) for (const y of [.5, .95]) g.add(pole(new THREE.Vector3(x, y, H.deckZ + .08), new THREE.Vector3(x, y, H.z0), .035));
  colliders.push([0, .6, H.deckZ - .05, 4.3, .6, .15], [H.x0 - .1, .6, (H.deckZ + H.z0) / 2, .1, .6, 1], [H.x1 + .1, .6, (H.deckZ + H.z0) / 2, .1, .6, 1]);

  /* furniture along the west wall: a low table with a qin and tea, a cushion */
  const lacquer = new THREE.MeshStandardMaterial({ color: 0x2a1a12, roughness: .35, metalness: 0 });
  const table = new THREE.Group();
  const top = new THREE.Mesh(metricBox(.55, .05, 1.5), pbr("dark_wood", { repeat: [1, 1], color: 0x9a6a50 }));
  top.position.y = .36; table.add(top);
  for (const [x, z] of [[-.22, -.68], [.22, -.68], [-.22, .68], [.22, .68]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(.05, .34, .05), lacquer);
    leg.position.set(x, .17, z); table.add(leg);
  }
  // 古琴: a long black-lacquered board with seven strings and thirteen inlaid studs
  const qin = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(.2, .05, 1.2), new THREE.MeshPhysicalMaterial({ color: 0x120c0a, roughness: .28, clearcoat: .8, clearcoatRoughness: .25 }));
  qin.add(body);
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(.0015, .002, 1.16), new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: .4 }));
    s.position.set(-.075 + i * .025, .027, 0); qin.add(s);
  }
  for (let i = 0; i < 13; i++) {
    const hui = new THREE.Mesh(new THREE.CylinderGeometry(.005, .005, .002, 10), new THREE.MeshStandardMaterial({ color: 0xf6f0e0, roughness: .2, metalness: .3 }));
    hui.position.set(.092, .026, -.5 + i * .075); qin.add(hui);
  }
  qin.position.set(0, .41, -.12); qin.rotation.y = .03; table.add(qin);
  // tea: a little clay pot and two cups
  const clay = new THREE.MeshStandardMaterial({ color: 0x6b3a26, roughness: .55 });
  const potPts = [[0, 0], [.035, 0], [.05, .02], [.055, .045], [.045, .07], [.022, .08], [.018, .09], [0, .095]].map(([x, y]) => new THREE.Vector2(x, y));
  const pot = new THREE.Mesh(new THREE.LatheGeometry(potPts, 24), clay);
  pot.position.set(0, .385, .58); table.add(pot);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(.006, .01, .06, 8), clay);
  spout.position.set(.06, .43, .58); spout.rotation.z = -1; table.add(spout);
  const cupPts = [[0, 0], [.018, 0], [.02, .005], [.026, .03], [.024, .031], [.018, .006], [0, .006]].map(([x, y]) => new THREE.Vector2(x, y));
  const porcelain = new THREE.MeshPhysicalMaterial({ color: 0xeef0ea, roughness: .15, clearcoat: 1 });
  for (const z of [.42, .48]) { const c = new THREE.Mesh(new THREE.LatheGeometry(cupPts, 20), porcelain); c.position.set(.12, .385, z); table.add(c); }
  table.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
  table.position.set(H.x0 + .55, 0, .2);
  g.add(table);
  colliders.push([H.x0 + .55, .2, .2, .3, .2, .8]);

  const cushion = new THREE.Mesh(new THREE.CylinderGeometry(.26, .28, .1, 32), pbr("reed_roof_03", { repeat: [2, 2], color: 0xc8a86a }));
  cushion.position.set(H.x0 + 1.25, .05, .1); cushion.castShadow = cushion.receiveShadow = true;
  g.add(cushion);

  /* the hanging scroll: 行到水穷处，坐看云起时 */
  const scrollTex = canvasTexture(512, 1400, (c, w, h) => {
    c.fillStyle = "#5b6b5e"; c.fillRect(0, 0, w, h);                       // silk mounting
    c.fillStyle = "#efe6cf"; c.fillRect(40, 150, w - 80, h - 330);        // paper
    const grd = c.createLinearGradient(0, 150, 0, h - 180);
    grd.addColorStop(0, "rgba(160,130,80,.08)"); grd.addColorStop(1, "rgba(120,90,50,.16)");
    c.fillStyle = grd; c.fillRect(40, 150, w - 80, h - 330);
    c.fillStyle = "#1a1612";
    c.textAlign = "center"; c.textBaseline = "middle";
    c.font = '112px "Ma Shan Zheng","STKaiti","KaiTi",serif';
    const cols = [["行", "到", "水", "穷", "处"], ["坐", "看", "云", "起", "时"]];
    cols.forEach((col, ci) => col.forEach((ch, k) => c.fillText(ch, w * (ci === 0 ? .66 : .36), 290 + k * 158)));
    c.font = '34px "Ma Shan Zheng","STKaiti","KaiTi",serif';
    c.fillStyle = "#3a2f26";
    ["王", "维", "句"].forEach((ch, k) => c.fillText(ch, w * .16, 900 + k * 44));
    c.fillStyle = "#a8321f"; c.fillRect(w * .16 - 22, 1048, 44, 44);
    c.fillStyle = "#efe6cf"; c.font = '22px serif'; c.fillText("兰", w * .16, 1070);
  });
  const scroll = new THREE.Mesh(new THREE.PlaneGeometry(.62, 1.7), new THREE.MeshStandardMaterial({ map: scrollTex, roughness: .9 }));
  scroll.position.set(H.x0 + .04, 1.55, .2); scroll.rotation.y = Math.PI / 2;
  scroll.receiveShadow = true;
  g.add(scroll);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(.016, .016, .74, 12), lacquer);
  rod.rotation.x = Math.PI / 2; rod.position.set(H.x0 + .06, .7, .2); g.add(rod);

  /* the plaque over the door, inside: 竹里馆 (read right to left) */
  const plaqueTex = canvasTexture(1024, 300, (c, w, h) => {
    c.fillStyle = "#2b1a12"; c.fillRect(0, 0, w, h);
    c.strokeStyle = "#7a5634"; c.lineWidth = 10; c.strokeRect(14, 14, w - 28, h - 28);
    c.fillStyle = "#d8c08a"; c.textAlign = "center"; c.textBaseline = "middle";
    c.font = '170px "Ma Shan Zheng","STKaiti","KaiTi",serif';
    ["馆", "里", "竹"].forEach((ch, k) => c.fillText(ch, w * (.22 + k * .28), h * .54));
  });
  const plaque = new THREE.Mesh(metricBox(1.3, .38, .04), [lacquer, lacquer, lacquer, lacquer, new THREE.MeshStandardMaterial({ map: plaqueTex, roughness: .5 }), lacquer]);
  plaque.position.set(0, 2.35, H.z1 - .06); plaque.rotation.y = Math.PI;
  g.add(plaque);

  return { group: g, colliders, scrollTex, plaqueTex };
}
