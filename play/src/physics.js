import RAPIER from '@dimforge/rapier3d-compat';
import { Vector3, Quaternion } from 'three/webgpu';
import { ViewportBoundaries } from './boundaries.js';
import { fracture } from './fracture.js';
let initialization;
export async function createPhysics(pieces) {
  await (initialization ??= RAPIER.init());
  const world=new RAPIER.World({x:0,y:-9.81,z:0});
  world.timestep=1/120; world.numSolverIterations=12;
  world.integrationParameters.maxCcdSubsteps=4;
  world.integrationParameters.minIslandSize=1;
  world.integrationParameters.normalizedAllowedLinearError=.001;
  world.integrationParameters.contact_natural_frequency=60;
  world.integrationParameters.numInternalPgsIterations=2;
  const boundaries=new ViewportBoundaries(world);
  let orb=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setGravityScale(0).lockTranslations().setAngularDamping(.48).setCanSleep(false));
  let orbCollider=world.createCollider(RAPIER.ColliderDesc.ball(1).setMass(1.8),orb);
  let scale=1, shards=[], accumulator=0, age=0, reduced=false;
  const poses=pieces.map(()=>({position:new Vector3(),rotation:new Quaternion()}));
  const q=new Quaternion(),pos=new Vector3();
  return {
    world,boundaries,poses,
    get orb() { return orb; }, get shards() { return shards; }, get scale() { return scale; },
    setReduced(value) { reduced=value; if(value&&orb) orb.setAngvel({x:0,y:0,z:0},true); },
    place(center,nextScale) {
      if(!orb) return;
      scale=nextScale;
      orb.setTranslation(center,true);
      // The sphere rigid body only establishes the intact mass and inertia.
      world.removeCollider(orbCollider,true);
      orbCollider=world.createCollider(RAPIER.ColliderDesc.ball(scale).setMass(1.8),orb);
      orb.recomputeMassPropertiesFromColliders();
    },
    resize(w,h) { boundaries.resize(w,h,Math.max(1.8,scale*1.5),shards); },
    spin(dx,dy,dt) {
      if(!orb||reduced) return;
      const vx=Math.max(-2400,Math.min(2400,dx/dt)),vy=Math.max(-2400,Math.min(2400,dy/dt));
      const amount=orb.mass()*scale*scale*.00024;
      orb.applyTorqueImpulse({x:vy*amount,y:vx*amount,z:-vx*amount*.13},true);
    },
    fracture(hit,seed) { if(orb) { shards=fracture(world,pieces,orb,scale,hit,seed,reduced); orb=null; accumulator=0; age=0; } },
    step(dt) {
      accumulator+=Math.min(dt,.05);
      let steps=0;
      while(accumulator>=world.timestep&&steps++<6) {
        if(orb&&!reduced) {
          // Tiny sustained torque balances drag. Drag gestures still own inertia.
          orb.addTorque({x:.005*scale*scale,y:.013*scale*scale,z:.002*scale*scale},true);
        }
        for(const s of shards) { s.previousPosition.copy(s.body.translation());s.previousRotation.copy(s.body.rotation()); }
        world.step();
        age+=world.timestep;
        // Detect persistent subpixel solver chatter by pose excursion, not
        // instantaneous velocity. Real flight, sliding and rolling reset the
        // window. Sleep remains reversible when another collider hits a shard.
        if(!orb && age>8) for(const s of shards) {
          if(s.body.isSleeping()) continue;
          const p=s.body.translation(),r=s.body.rotation();
          if(!s.restPose) s.restPose={position:new Vector3().copy(p),rotation:new Quaternion().copy(r),time:0};
          const rest=s.restPose;
          const moved=rest.position.distanceTo(p)>.008;
          const turned=2*Math.acos(Math.min(1,Math.abs(rest.rotation.x*r.x+rest.rotation.y*r.y+rest.rotation.z*r.z+rest.rotation.w*r.w)))>.07;
          if(moved||turned) {rest.position.copy(p);rest.rotation.copy(r);rest.time=0;}
          else rest.time+=world.timestep;
          if(rest.time>2.5) {
            let supported=false;
            world.contactPairsWith(s.body.collider(0),other=>{
              world.contactPair(s.body.collider(0),other,manifold=>{
                if(manifold.numSolverContacts()>0) supported=true;
              });
            });
            const v=s.body.linvel(),w=s.body.angvel();
            const kinetic=v.x*v.x+v.y*v.y+v.z*v.z+(w.x*w.x+w.y*w.y+w.z*w.z)*s.radius*s.radius;
            if(supported && kinetic<.0016) s.body.sleep();
          }
        }
        if(orb) orb.resetTorques(false);
        accumulator-=world.timestep;
      }
      if(orb) {
        q.copy(orb.rotation()); pos.copy(orb.translation());
        for(let i=0;i<pieces.length;i++) { poses[i].position.copy(pieces[i].center).multiplyScalar(scale).applyQuaternion(q).add(pos);poses[i].rotation.copy(q); }
      } else {
        const alpha=accumulator/world.timestep;
        for(let i=0;i<shards.length;i++) {
          const s=shards[i]; s.position.copy(s.body.translation());s.rotation.copy(s.body.rotation());
          poses[i].position.lerpVectors(s.previousPosition,s.position,alpha);
          poses[i].rotation.slerpQuaternions(s.previousRotation,s.rotation,alpha);
        }
      }
    },
    get settled() { return !orb&&shards.every(s=>s.body.isSleeping()); },
    dispose() { boundaries.dispose();world.free();shards=[];orb=null; },
  };
}
