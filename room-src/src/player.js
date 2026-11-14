// Walking: a capsule moved by Rapier's kinematic character controller, so you slide along walls and furniture.
// Look by dragging; walk with WASD / arrows / the wheel, or tap the floor on a phone.
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

const EYE = 1.55, RADIUS = .26, HALF = .5;           // capsule: 1.52 m tall, eyes near the top
const SPEED = 1.5, RUN = 2.6;

export async function createPlayer({ camera, dom, colliders, start, yaw = 0 }) {
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  for (const [x, y, z, hx, hy, hz] of colliders) {
    world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z));
  }
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(start.x, HALF + RADIUS, start.z));
  const collider = world.createCollider(RAPIER.ColliderDesc.capsule(HALF, RADIUS), body);
  const ctrl = world.createCharacterController(.02);
  ctrl.setSlideEnabled(true);
  ctrl.enableAutostep(.22, .15, false);
  ctrl.enableSnapToGround(.3);
  ctrl.setMaxSlopeClimbAngle(.6);

  const state = {
    yaw, pitch: -.04,
    vel: new THREE.Vector3(),
    keys: new Set(),
    wheel: 0,
    target: null,          // a point to walk to (tap-to-walk, and the intro)
    locked: false,         // while flying into a compartment
    moved: false,
    vy: 0,
    bob: 0,
  };

  /* ---------- looking ---------- */
  let drag = null;
  dom.addEventListener("pointerdown", (e) => {
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now(), dist: 0 };
    dom.setPointerCapture(e.pointerId);
  });
  dom.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id || state.locked) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    drag.dist += Math.abs(dx) + Math.abs(dy);
    if (drag.dist > 6) {
      dom.classList.add("dragging");
      const k = e.pointerType === "touch" ? .005 : .0032;
      state.yaw += dx * k;
      state.pitch = THREE.MathUtils.clamp(state.pitch + dy * k, -1.2, 1.2);
      state.moved = true;
    }
  });
  const endDrag = (e) => { if (drag && e.pointerId === drag.id) { dom.classList.remove("dragging"); state.lastDrag = drag; drag = null; } };
  dom.addEventListener("pointerup", endDrag);
  dom.addEventListener("pointercancel", endDrag);
  /** True if the pointer-up that just happened was a click/tap rather than a drag. */
  state.wasClick = () => state.lastDrag && state.lastDrag.dist <= 6 && performance.now() - state.lastDrag.t0 < 600;

  /* ---------- walking ---------- */
  addEventListener("keydown", (e) => { if (!e.metaKey && !e.ctrlKey) { state.keys.add(e.code); state.target = null; } });
  addEventListener("keyup", (e) => state.keys.delete(e.code));
  addEventListener("blur", () => state.keys.clear());
  dom.addEventListener("wheel", (e) => { e.preventDefault(); state.wheel -= e.deltaY * .004; state.target = null; state.moved = true; }, { passive: false });

  const fwd = new THREE.Vector3(), right = new THREE.Vector3(), want = new THREE.Vector3();
  function step(dt) {
    if (state.locked) return;
    fwd.set(-Math.sin(state.yaw), 0, -Math.cos(state.yaw));
    right.set(Math.cos(state.yaw), 0, -Math.sin(state.yaw));
    want.set(0, 0, 0);
    const k = state.keys;
    if (k.has("KeyW") || k.has("ArrowUp")) want.add(fwd);
    if (k.has("KeyS") || k.has("ArrowDown")) want.sub(fwd);
    if (k.has("KeyA")) want.sub(right);
    if (k.has("KeyD")) want.add(right);
    if (k.has("ArrowLeft")) state.yaw += dt * 1.6;
    if (k.has("ArrowRight")) state.yaw -= dt * 1.6;
    if (want.lengthSq() > 0) { want.normalize().multiplyScalar(k.has("ShiftLeft") || k.has("ShiftRight") ? RUN : SPEED); state.moved = true; }
    if (Math.abs(state.wheel) > .001) {
      want.addScaledVector(fwd, THREE.MathUtils.clamp(state.wheel, -1, 1) * SPEED * 1.6);
      state.wheel *= Math.pow(.02, dt);
    }
    if (state.target) {
      const p = body.translation();
      const to = new THREE.Vector3(state.target.x - p.x, 0, state.target.z - p.z);
      const d = to.length();
      if (d < .06) state.target = null;
      else want.add(to.normalize().multiplyScalar(Math.min(state.target.speed ?? SPEED, d * 2.5)));
    }
    // ease the velocity towards what is wanted, so starts and stops are soft
    state.vel.lerp(want, 1 - Math.pow(.0008, dt));
    state.vy = Math.max(-6, state.vy - 9.81 * dt);
    const move = { x: state.vel.x * dt, y: state.vy * dt, z: state.vel.z * dt };
    ctrl.computeColliderMovement(collider, move);
    const m = ctrl.computedMovement();
    if (ctrl.computedGrounded()) state.vy = 0;
    const p = body.translation();
    body.setNextKinematicTranslation({ x: p.x + m.x, y: p.y + m.y, z: p.z + m.z });
    world.step();
    const speed = Math.hypot(state.vel.x, state.vel.z);
    state.bob += dt * speed * 6;
  }

  const look = new THREE.Euler(0, 0, 0, "YXZ");
  function apply() {
    const p = body.translation();
    const bob = Math.sin(state.bob) * .012 * Math.min(1, Math.hypot(state.vel.x, state.vel.z));
    if (!state.locked) {
      camera.position.set(p.x, p.y - (HALF + RADIUS) + EYE + bob, p.z);
      camera.quaternion.setFromEuler(look.set(state.pitch, state.yaw, 0));   // drag the scene: drag down to look up
    }
  }

  return { state, step, apply, world, body };
}
