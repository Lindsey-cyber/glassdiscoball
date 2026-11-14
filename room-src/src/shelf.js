// The 多宝格: a double-sided 紫檀 cabinet standing in the middle of the room, with staggered compartments,
// 开光 openings (委角 cut-corner, 圆光 round, arched), 拐子纹 corner frets, a 回纹 frieze, drawers and feet.
// Each compartment holds one object; most of them lead to a project.
import * as THREE from "three";
import { ParametricGeometry } from "three/addons/geometries/ParametricGeometry.js";
import { pbr, canvasTexture, rng } from "./assets.js";
import { metricBox } from "./hut.js";

export const CAB = { x: 0, z: -0.45, W: 2.4, D: 0.42, yBot: 0.48, yTop: 2.28, cols: 6, rows: 5 };

// compartments: [col0,row0,col1,row1] counted from the top-left, plus the opening shape and what is inside
const COMPARTMENTS = [
  { id: "ball", r: [0, 0, 2, 3], shape: "wj" },
  { id: "qinglv", r: [2, 0, 5, 2], shape: "wj" },
  { id: "vase", r: [5, 0, 6, 1], shape: "round" },
  { id: "yubi", r: [5, 1, 6, 4], shape: "arch" },
  { id: "tianqing", r: [2, 2, 3, 5], shape: "round" },
  { id: "fenqiang", r: [3, 2, 5, 4], shape: "wj" },
  { id: "topo", r: [0, 3, 2, 5], shape: "wj" },
  { id: "empty1", r: [3, 4, 5, 5], shape: "wj" },
  { id: "empty2", r: [5, 4, 6, 5], shape: "wj" },
];

const ITEMS = {
  ball: { name: "流光", sub: "Mirror ball", href: "../liuguang.html" },
  qinglv: { name: "青绿", sub: "A walkable handscroll", href: "../qinglv.html" },
  yubi: { name: "玉璧", sub: "Bi", href: "../yubi.html" },
  tianqing: { name: "天青", sub: "Ru cup", href: "../tianqing.html" },
  fenqiang: { name: "粉墙", sub: "Garden wall", href: "../fenqiang.html" },
  topo: { name: "拓扑", sub: "制作中", href: null },
};

export function buildShelf(envReady) {
  const g = new THREE.Group();
  g.position.set(CAB.x, 0, CAB.z);
  const cw = CAB.W / CAB.cols, rh = (CAB.yTop - CAB.yBot) / CAB.rows, T = 0.028, D = CAB.D;
  const X = (c) => -CAB.W / 2 + c * cw;
  const Y = (r) => CAB.yTop - r * rh;

  const zitan = pbr("dark_wood", { repeat: [1.6, 1.6], color: 0xb27a62, normalScale: .7, envMapIntensity: .9 });
  zitan.roughness = 0.75;
  const zitanSmooth = zitan.clone(); zitanSmooth.roughness = .55;
  const add = (mesh) => { mesh.castShadow = mesh.receiveShadow = true; g.add(mesh); return mesh; };
  const box = (w, h, d, x, y, z, mat = zitan) => { const m = add(new THREE.Mesh(metricBox(w, h, d), mat)); m.position.set(x, y, z); return m; };

  /* boards: every compartment edge, de-duplicated */
  const seen = new Set();
  for (const { r: [c0, r0, c1, r1] } of COMPARTMENTS) {
    const edges = [["h", r0, c0, c1], ["h", r1, c0, c1], ["v", c0, r0, r1], ["v", c1, r0, r1]];
    for (const [k, a, b0, b1] of edges) {
      for (let b = b0; b < b1; b++) {               // unit segments, so shared edges are only built once
        const key = `${k}${a}:${b}`;
        if (seen.has(key)) continue; seen.add(key);
        if (k === "h") box(cw + T, T, D, X(b) + cw / 2, Y(a), 0);
        else box(T, rh + T, D, X(a), Y(b) - rh / 2, 0);
      }
    }
  }

  /* 开光: a face panel on both sides of every compartment, with the opening cut through it */
  const panelMat = zitanSmooth;
  for (const cp of COMPARTMENTS) {
    const [c0, r0, c1, r1] = cp.r;
    const x0 = X(c0) + T / 2, x1 = X(c1) - T / 2, y0 = Y(r1) + T / 2, y1 = Y(r0) - T / 2;
    const w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    cp.center = new THREE.Vector3(cx, cy, 0); cp.w = w; cp.h = h;
    const outer = new THREE.Shape();
    outer.moveTo(x0, y0); outer.lineTo(x1, y0); outer.lineTo(x1, y1); outer.lineTo(x0, y1); outer.closePath();
    const hole = new THREE.Path(), m = .032;
    if (cp.shape === "round") {
      const rad = Math.min(w, h) / 2 - m;
      hole.absarc(cx, cy, rad, 0, Math.PI * 2, true);
      cp.opening = rad * 2;
    } else if (cp.shape === "arch") {
      const a0 = x0 + m, a1 = x1 - m, b0 = y0 + m, rr = (a1 - a0) / 2, b1 = y1 - m - rr * .6;
      hole.moveTo(a0, b0); hole.lineTo(a0, b1);
      hole.absellipse(cx, b1, rr, rr * .6, Math.PI, 0, true);
      hole.lineTo(a1, b0); hole.closePath();
    } else {
      const k = .05, a0 = x0 + m, a1 = x1 - m, b0 = y0 + m, b1 = y1 - m;
      hole.moveTo(a0 + k, b0); hole.lineTo(a1 - k, b0); hole.lineTo(a1, b0 + k); hole.lineTo(a1, b1 - k);
      hole.lineTo(a1 - k, b1); hole.lineTo(a0 + k, b1); hole.lineTo(a0, b1 - k); hole.lineTo(a0, b0 + k); hole.closePath();
    }
    outer.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(outer, { depth: .018, bevelEnabled: true, bevelThickness: .004, bevelSize: .004, bevelSegments: 2, curveSegments: 40 });
    geo.scale(1, 1, 1);
    for (const s of [1, -1]) {
      const p = add(new THREE.Mesh(geo, panelMat));
      p.position.z = s * (D / 2) - (s > 0 ? 0 : .018);
    }
    // 拐子纹 frets in the two upper corners of square openings, on both faces
    if (cp.shape === "wj") for (const s of [1, -1]) for (const side of [-1, 1]) {
      const fx = side < 0 ? x0 + m + .02 : x1 - m - .02, fy = y1 - m - .02, dz = s * (D / 2 - .012);
      const L = .11, t = .012;
      box(L, t, .014, fx - side * L / 2, fy, dz, panelMat);
      box(t, L, .014, fx, fy - L / 2, dz, panelMat);
      box(L * .55, t, .014, fx - side * L * .55 / 2, fy - L * .5, dz, panelMat);
      box(t, L * .3, .014, fx - side * L * .55, fy - L * .5 + L * .15, dz, panelMat);
    }
  }

  /* frame, frieze, cornice, base, feet */
  for (const s of [-1, 1]) box(.06, CAB.yTop + .14, D + .02, s * (CAB.W / 2 + .03), (CAB.yTop + .14) / 2, 0);
  box(CAB.W + .12, .03, D + .02, 0, CAB.yTop + .015, 0);
  const friezeTex = canvasTexture(1024, 64, (c, w, h) => {
    c.fillStyle = "#3a1d15"; c.fillRect(0, 0, w, h);
    c.strokeStyle = "#a07558"; c.lineWidth = 4;
    for (let x = -10; x < w; x += 64) {                 // 回纹: a continuous key-fret
      c.beginPath(); c.moveTo(x, 54); c.lineTo(x + 12, 54); c.lineTo(x + 12, 12); c.lineTo(x + 44, 12); c.lineTo(x + 44, 40); c.lineTo(x + 26, 40); c.lineTo(x + 26, 26); c.lineTo(x + 34, 26); c.stroke();
      c.beginPath(); c.moveTo(x + 44, 54); c.lineTo(x + 76, 54); c.stroke();
    }
  });
  const friezeMat = new THREE.MeshStandardMaterial({ map: friezeTex, roughness: .6 });
  const frieze = box(CAB.W + .12, .09, D + .02, 0, CAB.yTop + .075, 0, [zitan, zitan, zitan, zitan, friezeMat, friezeMat]);
  box(CAB.W + .24, .05, D + .14, 0, CAB.yTop + .145, 0, zitanSmooth);
  // base with two drawers
  box(CAB.W + .12, CAB.yBot - .12, D + .02, 0, (CAB.yBot + .12) / 2, 0);
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9a258, metalness: 1, roughness: .32 });
  for (const s of [-1, 1]) for (const f of [1, -1]) {
    box(CAB.W / 2 - .1, CAB.yBot - .22, .015, s * CAB.W / 4, (CAB.yBot + .12) / 2, f * (D / 2 + .015), zitanSmooth);
    const plate = add(new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, .006, 24, 1, false, 0, Math.PI), brass));
    plate.rotation.x = Math.PI / 2; plate.rotation.y = f > 0 ? 0 : Math.PI;
    plate.position.set(s * CAB.W / 4, (CAB.yBot + .12) / 2 + .01, f * (D / 2 + .025));
    const ring = add(new THREE.Mesh(new THREE.TorusGeometry(.022, .004, 8, 24), brass));
    ring.position.set(s * CAB.W / 4, (CAB.yBot + .12) / 2 - .02, f * (D / 2 + .03));
  }
  // apron and 马蹄足
  box(CAB.W + .08, .05, D - .02, 0, .095, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = add(new THREE.Mesh(new THREE.CylinderGeometry(.04, .03, .12, 4, 1), zitan));
    leg.rotation.y = Math.PI / 4; leg.position.set(sx * (CAB.W / 2 + .02), .06, sz * (D / 2 - .02));
  }

  /* ---------- the objects ---------- */
  const items = [];
  const byId = Object.fromEntries(COMPARTMENTS.map((c) => [c.id, c]));
  const place = (id, obj) => {
    const cp = byId[id];
    obj.position.add(cp.center);
    obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.add(obj);
    if (ITEMS[id]) {
      const it = { ...ITEMS[id], id, object: obj, compartment: cp };
      obj.userData.item = it;
      items.push(it);
    }
    return obj;
  };

  /* 流光: a mirror ball on a chain, turning, with a lamp that throws its spots into the room */
  const ballR = .19;
  const ball = new THREE.Group();
  const tileGeo = new THREE.BoxGeometry(1, 1, 1);
  const tilePos = [];
  const rings = 20;
  for (let i = 1; i < rings; i++) {
    const th = (i + .5) / rings * Math.PI, s = Math.sin(th), n = Math.max(4, Math.round(2 * Math.PI * s * rings / Math.PI));
    for (let j = 0; j < n; j++) tilePos.push([th, (j + (i % 2) * .5) / n * Math.PI * 2, s, n]);
  }
  const tiles = new THREE.InstancedMesh(tileGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: .08 }), tilePos.length);
  const r = rng(4), q = new THREE.Quaternion(), e = new THREE.Euler();
  tilePos.forEach(([th, ph, s, n], k) => {
    const nrm = new THREE.Vector3(s * Math.cos(ph), Math.cos(th), s * Math.sin(ph));
    const east = new THREE.Vector3(-Math.sin(ph), 0, Math.cos(ph)), north = new THREE.Vector3().crossVectors(nrm, east);
    q.setFromRotationMatrix(new THREE.Matrix4().makeBasis(east, north, nrm));
    q.multiply(new THREE.Quaternion().setFromEuler(e.set((r() - .5) * .05, (r() - .5) * .05, (r() - .5) * .05)));
    const a = Math.PI / rings * ballR * .86;
    tiles.setMatrixAt(k, new THREE.Matrix4().compose(nrm.multiplyScalar(ballR + .002), q, new THREE.Vector3(Math.min(2 * Math.PI * ballR * s / n * .86, a * 1.2), a, .004)));
    const shade = .85 + r() * .15; tiles.setColorAt(k, new THREE.Color(shade, shade, shade * 1.01));
  });
  tiles.castShadow = false;
  const core = new THREE.Mesh(new THREE.SphereGeometry(ballR, 48, 32), new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: .6 }));
  ball.add(core, tiles);
  const chainLen = byId.ball.h / 2 - ballR - .03;
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(.003, .003, chainLen, 6), new THREE.MeshStandardMaterial({ color: 0xbfbfc4, metalness: 1, roughness: .3 }));
  chain.position.y = ballR + chainLen / 2;
  const ballHolder = new THREE.Group(); ballHolder.add(ball, chain);
  ballHolder.position.y = .06;
  place("ball", ballHolder);
  ball.traverse((o) => { o.castShadow = false; });   // the lamp sits in front of it
  // the lamp: a spotlight projecting a sheet of small squares, turned with the ball
  const dots = canvasTexture(512, 512, (c, w, h) => {
    c.fillStyle = "#000"; c.fillRect(0, 0, w, h);
    const rr = rng(21);
    for (let i = 0; i < 260; i++) {
      const x = rr() * w, y = rr() * h, s = 3 + rr() * 5, d = Math.hypot(x - w / 2, y - h / 2) / (w / 2);
      if (d > 1) continue;
      c.fillStyle = `rgba(255,${230 + rr() * 25 | 0},${200 + rr() * 40 | 0},${(.6 + rr() * .4) * (1 - d * .5)})`;
      c.fillRect(x, y, s, s);
    }
  });
  const spot = new THREE.SpotLight(0xfff1dc, 7, 9, 1.05, .25, 1.2);
  spot.map = dots;
  spot.castShadow = true;
  spot.shadow.mapSize.set(512, 512);
  spot.shadow.camera.near = .25;
  spot.position.copy(byId.ball.center).add(new THREE.Vector3(0, .06, .26));
  const spotTarget = new THREE.Object3D(); g.add(spotTarget); spot.target = spotTarget;
  g.add(spot);

  /* 青绿: an unrolled handscroll */
  const paintTex = canvasTexture(1024, 380, (c, w, h) => {
    const sky = c.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, "#efe3c4"); sky.addColorStop(1, "#dccaa0");
    c.fillStyle = sky; c.fillRect(0, 0, w, h);
    c.fillStyle = "#c9553a"; c.globalAlpha = .85; c.beginPath(); c.arc(w * .8, h * .22, 18, 0, 7); c.fill(); c.globalAlpha = 1;
    const ridge = (base, amp, seed, fill, gold) => {
      const rr = rng(seed); c.beginPath(); c.moveTo(0, h);
      for (let x = 0; x <= w; x += 8) { const y = base - amp * (Math.sin(x * .011 + seed) * .5 + Math.sin(x * .027 + seed * 2) * .3 + rr() * .06 + .5); c.lineTo(x, y); }
      c.lineTo(w, h); c.closePath(); c.fillStyle = fill; c.fill();
      if (gold) { c.strokeStyle = "#d2a752"; c.lineWidth = 3; c.stroke(); }
    };
    ridge(h * .6, h * .35, 1, "rgba(159,184,160,.75)");
    ridge(h * .75, h * .4, 2, "#3f8a7c", true);
    ridge(h * .9, h * .3, 3, "#1d5b6a", true);
    ridge(h * 1.02, h * .12, 4, "#b5803f");
  });
  const scroll = new THREE.Group();
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(.92, .34), new THREE.MeshStandardMaterial({ map: paintTex, roughness: .85, side: THREE.DoubleSide }));
  scroll.add(paper);
  const rollerMat = new THREE.MeshStandardMaterial({ color: 0x4a2a1b, roughness: .5 });
  for (const s of [-1, 1]) { const ro = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, .4, 16), rollerMat); ro.position.x = s * .47; scroll.add(ro); }
  scroll.rotation.x = -.06;
  place("qinglv", scroll);

  /* 梅瓶 with a branch of plum */
  const vaseTex = canvasTexture(256, 256, (c, w, h) => {
    c.fillStyle = "#eef2f2"; c.fillRect(0, 0, w, h);
    c.strokeStyle = "#2f5a8a"; c.lineWidth = 4;
    for (const y of [40, 60, 190, 205]) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    c.lineWidth = 3;
    for (let x = 0; x < w; x += 64) { c.beginPath(); c.moveTo(x + 10, 150); c.bezierCurveTo(x + 20, 90, x + 50, 140, x + 40, 100); c.stroke(); c.beginPath(); c.arc(x + 40, 100, 9, 0, 7); c.stroke(); }
  });
  const vasePts = [[0, 0], [.03, 0], [.034, .01], [.045, .06], [.06, .13], [.058, .16], [.04, .18], [.016, .19], [.015, .2], [.02, .205], [0, .205]].map(([x, y]) => new THREE.Vector2(x, y));
  const vase = new THREE.Group();
  vase.add(new THREE.Mesh(new THREE.LatheGeometry(vasePts, 40), new THREE.MeshPhysicalMaterial({ map: vaseTex, roughness: .12, clearcoat: 1 })));
  const twig = new THREE.MeshStandardMaterial({ color: 0x2a1a12, roughness: .8 });
  const blossom = new THREE.MeshStandardMaterial({ color: 0xf6dfe2, roughness: .6 });
  const rb = rng(8);
  [[[0, .2, 0], [.04, .3, .01], [.09, .34, 0]], [[0, .2, 0], [-.05, .28, 0], [-.08, .31, .01]]].forEach((pts) => {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    vase.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 12, .0035, 5), twig));
    for (let k = 0; k < 5; k++) { const p = curve.getPoint(.4 + rb() * .6); const b = new THREE.Mesh(new THREE.SphereGeometry(.007, 8, 6), blossom); b.position.copy(p).add(new THREE.Vector3((rb() - .5) * .02, (rb() - .5) * .02, (rb() - .5) * .02)); vase.add(b); }
  });
  vase.position.y = -.15;
  place("vase", vase);

  /* 玉璧 on a small stand */
  const biShape = new THREE.Shape(); biShape.absarc(0, 0, .14, 0, Math.PI * 2, false);
  const biHole = new THREE.Path(); biHole.absarc(0, 0, .047, 0, Math.PI * 2, true); biShape.holes.push(biHole);
  const biGeo = new THREE.ExtrudeGeometry(biShape, { depth: .02, bevelEnabled: true, bevelThickness: .006, bevelSize: .006, bevelSegments: 4, curveSegments: 64 });
  biGeo.translate(0, 0, -.01);
  const grainTex = canvasTexture(512, 512, (c, w, h) => {
    c.fillStyle = "#b9d0b4"; c.fillRect(0, 0, w, h);
    const rr = rng(13);
    for (let i = 0; i < 40; i++) { const x = rr() * w, y = rr() * h, s = 30 + rr() * 90; const grd = c.createRadialGradient(x, y, 0, x, y, s); grd.addColorStop(0, `rgba(${rr() < .3 ? "220,226,205" : "120,160,120"},.35)`); grd.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = grd; c.fillRect(x - s, y - s, s * 2, s * 2); }
    c.fillStyle = "rgba(255,255,255,.22)";
    for (let y = 0; y < h; y += 22) for (let x = (y / 22) % 2 ? 11 : 0; x < w; x += 22) { c.beginPath(); c.arc(x, y, 4, 0, 7); c.fill(); } // 谷纹
  });
  grainTex.repeat.set(3, 3); grainTex.wrapS = grainTex.wrapT = THREE.RepeatWrapping;
  const jade = new THREE.MeshPhysicalMaterial({ map: grainTex, color: 0xd6e8d0, roughness: .32, transmission: .35, thickness: .04, ior: 1.6, clearcoat: .6, clearcoatRoughness: .2, attenuationColor: new THREE.Color(0x6f9a72), attenuationDistance: .08 });
  const bi = new THREE.Group();
  const disc = new THREE.Mesh(biGeo, jade); disc.position.y = .03; bi.add(disc);
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(.07, .09, .05, 24, 1, false, 0, Math.PI * 2), new THREE.MeshStandardMaterial({ color: 0x3b2116, roughness: .5 }));
  stand.position.y = -.135; stand.scale.z = .45; bi.add(stand);
  bi.position.y = -.08;
  place("yubi", bi);

  /* 天青: a Ru cup with crackle */
  const crackTex = canvasTexture(1024, 512, (c, w, h) => {
    c.fillStyle = "#a9c3be"; c.fillRect(0, 0, w, h);
    const rr = rng(5);
    c.strokeStyle = "rgba(240,250,246,.65)"; c.lineWidth = 1.6;
    for (let i = 0; i < 260; i++) { let x = rr() * w, y = rr() * h; c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (rr() - .5) * 60; y += (rr() - .5) * 40; c.lineTo(x, y); } c.stroke(); }
    c.strokeStyle = "rgba(120,100,70,.35)"; c.lineWidth = 1.2;
    for (let i = 0; i < 60; i++) { let x = rr() * w, y = rr() * h; c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 3; k++) { x += (rr() - .5) * 80; y += (rr() - .5) * 50; c.lineTo(x, y); } c.stroke(); }
  });
  const cupPts = [[0, 0], [.03, 0], [.033, .008], [.034, .02], [.05, .03], [.085, .06], [.108, .095], [.112, .1], [.106, .1], [.08, .068], [.045, .042], [0, .036]].map(([x, y]) => new THREE.Vector2(x, y));
  const cup = new THREE.Mesh(new THREE.LatheGeometry(cupPts, 64), new THREE.MeshPhysicalMaterial({ map: crackTex, roughness: .22, clearcoat: 1, clearcoatRoughness: .12, sheen: .3, sheenColor: new THREE.Color(0xd8ece6) }));
  const cupG = new THREE.Group(); cupG.add(cup); cupG.position.y = -.08; cupG.rotation.x = .12;
  place("tianqing", cupG);

  /* 粉墙: a table screen painted with a fan window in a garden wall */
  const wallTex = canvasTexture(640, 480, (c, w, h) => {
    c.fillStyle = "#ebe6dc"; c.fillRect(0, 0, w, h);
    c.fillStyle = "#2f3134"; c.fillRect(0, 0, w, 28);
    c.save(); c.filter = "blur(4px)"; c.fillStyle = "rgba(110,108,100,.35)";
    c.fillRect(70, 30, 10, h); for (let i = 0; i < 6; i++) { c.beginPath(); c.ellipse(120 + i * 8, 120 + i * 30, 60, 9, .4 + i * .15, 0, 7); c.fill(); }
    c.restore();
    const cx = w / 2, cy = h * 1.02, ro = h * .7, ri = h * .3, a0 = -Math.PI / 2 - .9, a1 = -Math.PI / 2 + .9;
    c.beginPath(); c.arc(cx, cy, ro, a0, a1); c.arc(cx, cy, ri, a1, a0, true); c.closePath();
    const gg = c.createLinearGradient(0, cy - ro, 0, cy - ri); gg.addColorStop(0, "#e8ebe0"); gg.addColorStop(.5, "#9fb187"); gg.addColorStop(1, "#3c4f38");
    c.fillStyle = gg; c.fill(); c.lineWidth = 14; c.strokeStyle = "#2e2724"; c.stroke();
    c.save(); c.clip(); c.lineWidth = 6; const rr = rng(2);
    for (let i = 0; i < 16; i++) { const a = a0 + rr() * (a1 - a0), d = ri + rr() * (ro - ri); c.beginPath(); c.moveTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d); c.lineTo(cx + Math.cos(a + .2) * (d + 30), cy + Math.sin(a + .2) * (d + 30)); c.stroke(); }
    c.restore();
  });
  const screen = new THREE.Group();
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(.5, .375), new THREE.MeshStandardMaterial({ map: wallTex, roughness: .9, side: THREE.DoubleSide }));
  screen.add(panel);
  const frameMat = zitanSmooth;
  for (const [w2, h2, x, y] of [[.54, .025, 0, .2], [.54, .025, 0, -.2], [.025, .42, -.26, 0], [.025, .42, .26, 0]]) { const f = new THREE.Mesh(metricBox(w2, h2, .03), frameMat); f.position.set(x, y, 0); screen.add(f); }
  const foot = new THREE.Mesh(metricBox(.36, .04, .12), frameMat); foot.position.y = -.24; screen.add(foot);
  screen.position.y = -.05;
  place("fenqiang", screen);

  /* 拓扑: a Möbius strip, turning slowly — in progress */
  const mob = new ParametricGeometry((u, v, target) => {
    u *= Math.PI * 2; v = (v - .5) * .09;
    const R0 = .17;
    target.set((R0 + v * Math.cos(u / 2)) * Math.cos(u), v * Math.sin(u / 2), (R0 + v * Math.cos(u / 2)) * Math.sin(u));
  }, 160, 8);
  const mobius = new THREE.Mesh(mob, new THREE.MeshPhysicalMaterial({ color: 0x5c8f86, roughness: .25, clearcoat: 1, side: THREE.DoubleSide }));
  const topo = new THREE.Group(); topo.add(mobius); topo.rotation.x = .5; topo.position.y = .02;
  place("topo", topo);

  /* ---------- per-frame motion ---------- */
  const tmp = new THREE.Vector3();
  function update(t) {
    ball.rotation.y = t * .5;
    ballHolder.rotation.z = Math.sin(t * .9) * .015;
    mobius.rotation.y = t * .35;
    tmp.set(Math.sin(t * .5) * 1.2, -.25 + Math.sin(t * .23) * .12, Math.cos(t * .5) * 1.2 + 1.4);   // sweep the spots around the front of the room
    spotTarget.position.copy(byId.ball.center).add(tmp);
    dots.rotation = t * .5; dots.center.set(.5, .5);
  }

  const collider = [CAB.x, 1.2, CAB.z, CAB.W / 2 + .1, 1.25, CAB.D / 2 + .08];
  return { group: g, items, collider, update, compartments: byId, spot };
}
