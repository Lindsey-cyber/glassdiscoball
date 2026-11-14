// Outside the hut: layered ink-wash ranges of 终南山 in morning haze, a sea of cloud below the cliff,
// the ledge the hut stands on, and a bamboo grove around it that moves in the wind.
import * as THREE from "three";
import { pbr, canvasTexture, rng } from "./assets.js";
import { poleMaterial } from "./hut.js";

export function buildOutside() {
  const g = new THREE.Group();

  /* ---------- ranges: open cylinders seen from inside, each painted with a ridge line ---------- */
  const ranges = [
    { R: 70, H: 62, y: -30, col: ["#2f5d50", "#4f7a68"], seed: 3, gold: .55 },
    { R: 190, H: 130, y: -62, col: ["#56807a", "#7d9c94"], seed: 7, gold: .35 },
    { R: 480, H: 270, y: -120, col: ["#8aa5a3", "#a9bcb7"], seed: 11, gold: .2 },
    { R: 1100, H: 560, y: -230, col: ["#b4c3c3", "#cbd5d1"], seed: 19, gold: 0 },
  ];
  for (const L of ranges.reverse()) {
    const tex = canvasTexture(4096, 512, (c, w, h) => {
      const r = rng(L.seed);
      // a ridge made of a few noise octaves, with a couple of tall peaks
      const peaks = Array.from({ length: 7 }, () => [r() * w, .25 + r() * .5, 120 + r() * 380]);
      const yAt = (x) => {
        let v = 0;
        for (let o = 0, f = .004, a = .35; o < 5; o++, f *= 2.1, a *= .48) v += a * Math.sin(x * f + L.seed * (o + 1) * 1.7 + Math.sin(x * f * .37) * 2);
        for (const [px, ph, pw] of peaks) v += ph * Math.exp(-((x - px) ** 2) / (pw * pw));
        return h * (.92 - .55 * (v * .5 + .45));
      };
      const grd = c.createLinearGradient(0, h * .15, 0, h);
      grd.addColorStop(0, L.col[0]); grd.addColorStop(.6, L.col[1]); grd.addColorStop(1, "rgba(230,232,224,0)");
      c.beginPath(); c.moveTo(0, h);
      for (let x = 0; x <= w; x += 4) c.lineTo(x, yAt(x));
      c.lineTo(w, h); c.closePath();
      c.fillStyle = grd; c.fill();
      // 皴: a few dry-brush strokes down the slopes
      c.save(); c.clip();
      c.strokeStyle = "rgba(20,40,34,.12)"; c.lineWidth = 2;
      for (let i = 0; i < 500; i++) { const x = r() * w, y = yAt(x); c.beginPath(); c.moveTo(x, y + 4); c.quadraticCurveTo(x + (r() - .5) * 30, y + 30, x + (r() - .5) * 50, y + 40 + r() * 70); c.stroke(); }
      // haze pooling in the valleys
      const haze = c.createLinearGradient(0, h * .55, 0, h);
      haze.addColorStop(0, "rgba(236,232,220,0)"); haze.addColorStop(1, "rgba(236,232,220,.9)");
      c.fillStyle = haze; c.fillRect(0, 0, w, h);
      c.restore();
      // the sun catches the ridge line
      if (L.gold) { c.beginPath(); for (let x = 0; x <= w; x += 4) c.lineTo(x, yAt(x) + 1.5); c.strokeStyle = `rgba(240,205,140,${L.gold})`; c.lineWidth = 3; c.stroke(); }
    });
    const geo = new THREE.CylinderGeometry(L.R, L.R, L.H, 160, 1, true, Math.PI * .3, Math.PI * 1.4);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.BackSide, depthWrite: false, fog: false }));
    mesh.position.y = L.y + L.H / 2;
    mesh.renderOrder = -10 + ranges.indexOf(L);
    g.add(mesh);
  }

  /* ---------- the sea of cloud ---------- */
  const cloudMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: { uTime: { value: 0 }, uSun: { value: new THREE.Vector3(.85, .42, -.32).normalize() } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform vec3 uSun; varying vec3 vW;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*n(p); p=p*2.03+vec2(1.7,9.2); a*=.5; } return s; }
      void main(){
        vec2 p = vW.xz * .012 + vec2(uTime*.004, uTime*.0015);
        float d = fbm(p) * .7 + fbm(p*3.1 + 4.) * .3;
        float c = smoothstep(.32, .78, d);
        float dist = length(vW.xz);
        vec3 lit = mix(vec3(.86,.86,.84), vec3(1.,.95,.86), c);
        lit += vec3(.25,.16,.05) * pow(max(0., dot(normalize(vec3(vW.x, 30., vW.z)), uSun)), 6.) * c;
        float a = (.55 + .45 * c) * smoothstep(8., 40., dist);
        gl_FragColor = vec4(lit, a);
      }`,
  });
  const clouds = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000, 1, 1), cloudMat);
  clouds.rotation.x = -Math.PI / 2; clouds.position.y = -18; clouds.renderOrder = -1;
  g.add(clouds);

  /* ---------- the ledge and the cliff below it ---------- */
  const groundMat = pbr("forest_ground_04", { repeat: [.25, .25], color: 0xb8ad8e });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 50, 1, 1), groundMat);
  ground.geometry.setAttribute("uv1", ground.geometry.attributes.uv.clone());
  const uv = ground.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 90, uv.getY(i) * 50);
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, -.32, 20.2);
  ground.receiveShadow = true;
  g.add(ground);
  const cliffGeo = new THREE.PlaneGeometry(90, 40, 90, 40);
  const pos = cliffGeo.attributes.pos ?? cliffGeo.attributes.position, r = rng(5);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    pos.setZ(i, Math.sin(x * .7) * .5 + Math.sin(x * .23 + y * .3) * 1.2 + (r() - .5) * .5 - (y < 18 ? (18 - y) * .12 : 0));
  }
  cliffGeo.computeVertexNormals();
  const cuv = cliffGeo.attributes.uv; for (let i = 0; i < cuv.count; i++) cuv.setXY(i, cuv.getX(i) * 90 / 4, cuv.getY(i) * 40 / 4);
  cliffGeo.setAttribute("uv1", cuv.clone());
  const cliff = new THREE.Mesh(cliffGeo, pbr("cliff_side", { repeat: [1, 1], color: 0xb0a48c }));
  cliff.position.set(0, -20.3, -4.9); cliff.rotation.x = -.06;
  cliff.receiveShadow = true;
  g.add(cliff);

  /* ---------- bamboo grove ---------- */
  const stalks = [];
  const R = rng(17);
  for (let i = 0; i < 520 && stalks.length < 170; i++) {
    const x = (R() - .5) * 44, z = -4.6 + R() * 26;
    if (Math.abs(x) < 5.4 && z < 4.6) continue;              // keep the hut clear
    if (Math.abs(x) < 1.6 && z < 9) continue;                // and a path out of the door
    stalks.push({ x, z, h: 7 + R() * 6, lean: (R() - .5) * .08, dir: R() * Math.PI * 2, ph: R() * 6.28, r: .035 + R() * .03 });
  }
  const stalkMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1.08, 1, 8, 1).translate(0, .5, 0), poleMaterial(9, true), stalks.length);
  stalkMesh.castShadow = true; stalkMesh.receiveShadow = true;
  g.add(stalkMesh);

  const leafTex = canvasTexture(512, 512, (c, w, h) => {
    const rr = rng(23);
    for (let i = 0; i < 26; i++) {
      const x = w / 2 + (rr() - .5) * w * .7, y = h * (.15 + rr() * .7), a = (rr() - .5) * 1.4 + Math.PI / 2, L = 110 + rr() * 90, W = 13 + rr() * 6;
      c.save(); c.translate(x, y); c.rotate(a);
      const gr = c.createLinearGradient(0, 0, L, 0); gr.addColorStop(0, "#3f5e2a"); gr.addColorStop(1, "#7f9a48");
      c.fillStyle = gr; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(L * .35, -W, L, 0); c.quadraticCurveTo(L * .35, W, 0, 0); c.fill();
      c.strokeStyle = "rgba(30,50,20,.4)"; c.lineWidth = 1; c.beginPath(); c.moveTo(0, 0); c.lineTo(L, 0); c.stroke();
      c.restore();
    }
  }, { srgb: true });
  const leafMat = new THREE.MeshStandardMaterial({ map: leafTex, alphaTest: .45, side: THREE.DoubleSide, roughness: .7 });
  const leaves = [];
  for (const s of stalks) {
    const n = 5 + (R() * 4 | 0);
    for (let k = 0; k < n; k++) leaves.push({ s, t: .5 + R() * .5, a: R() * Math.PI * 2, size: 1.1 + R() * .9, tilt: (R() - .5) * .9 });
  }
  const leafMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), leafMat, leaves.length);
  leafMesh.castShadow = true;
  leafMesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: leafTex, alphaTest: .45 });
  g.add(leafMesh);

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  const tipOffset = (s, t) => {
    const sway = Math.sin(t * .9 + s.ph) * .06 + Math.sin(t * 2.1 + s.ph * 2) * .015;
    return [s.lean + sway * Math.cos(s.dir), s.lean * .5 + sway * Math.sin(s.dir)];
  };
  function update(t) {
    cloudMat.uniforms.uTime.value = t;
    stalks.forEach((s, i) => {
      const [ax, az] = tipOffset(s, t);
      q.setFromEuler(e.set(az, 0, -ax));
      m4.compose(p.set(s.x, -.32, s.z), q, sc.set(s.r, s.h, s.r));
      stalkMesh.setMatrixAt(i, m4);
    });
    stalkMesh.instanceMatrix.needsUpdate = true;
    leaves.forEach((L, i) => {
      const s = L.s, [ax, az] = tipOffset(s, t);
      q.setFromEuler(e.set(az, 0, -ax));
      p.set(0, s.h * L.t, 0).applyQuaternion(q).add(new THREE.Vector3(s.x, -.32, s.z));
      p.x += Math.cos(L.a) * .45; p.z += Math.sin(L.a) * .45;
      q2.setFromEuler(e.set(L.tilt + Math.sin(t * 1.7 + i) * .08, L.a, 0));
      m4.compose(p, q2, sc.set(L.size, L.size, L.size));
      leafMesh.setMatrixAt(i, m4);
    });
    leafMesh.instanceMatrix.needsUpdate = true;
  }
  update(0);

  return { group: g, update };
}
