import { Vector3, Quaternion } from 'three/webgpu';
import RAPIER from '@dimforge/rapier3d-compat';
import { random } from './random.js';
/** Stochastic fracture initial conditions; Rapier owns all subsequent movement. */
export function fracture(world,pieces,orb,scale,hit,seed,reducedMotion=false) {
  const rng=random(seed), rotation=new Quaternion().copy(orb.rotation());
  const origin=new Vector3().copy(orb.translation()), spin=new Vector3().copy(orb.angvel());
  const impact=new Vector3().copy(hit).sub(origin).multiplyScalar(.22).add(new Vector3(rng.normal(),rng.normal(),rng.normal()).multiplyScalar(.085*scale));
  const bias=new Vector3(rng.normal(),rng.normal()*.45,rng.normal()*.3).multiplyScalar(.9);
  const result=pieces.map(p=>{
    const offset=p.center.clone().multiplyScalar(scale).applyQuaternion(rotation);
    const position=origin.clone().add(offset);
    const desc=RAPIER.RigidBodyDesc.dynamic().setTranslation(...position.toArray()).setRotation(rotation)
      .setLinearDamping(.09).setAngularDamping(.65).setCcdEnabled(true).setCanSleep(true);
    const body=world.createRigidBody(desc);
    const vertices=Float32Array.from(p.hull,x=>x*scale);
    const collider=RAPIER.ColliderDesc.roundConvexHull(vertices,.003*scale);
    if(!collider) throw new Error('Invalid convex glass hull');
    // Density determines mass AND the full geometric inertia tensor.
    world.createCollider(collider.setDensity(2.5).setFriction(.35+rng()*.3).setRestitution(.18+rng()*.3).setContactSkin(.003),body);
    body.recomputeMassPropertiesFromColliders();
    const dir=offset.clone().sub(impact).normalize().add(new Vector3(rng.normal(),rng.normal(),rng.normal()).multiplyScalar(.34)).normalize();
    const roll=rng();
    // Mixture: near-drop shards, a broad log-normal body, and a sparse fast tail.
    const speed=roll<.16 ? .15+rng()*.65 : roll>.91 ? 9+rng()*7 : Math.min(9,Math.exp(1.12+.62*rng.normal()));
    // Similar pressure impulse over area -> smaller/thinner shards accelerate more.
    const massFactor=Math.max(.7,Math.min(1.4,.035/p.thickness));
    const velocity=dir.multiplyScalar(speed*massFactor).add(bias).add(new Vector3().crossVectors(spin,offset));
    velocity.z*=.48;
    if(reducedMotion) velocity.multiplyScalar(.10);
    body.applyImpulse(velocity.multiplyScalar(body.mass()),true);
    const torqueScale=body.mass()*p.radius*p.radius*scale*scale*(reducedMotion?.5:9);
    body.applyTorqueImpulse({x:rng.normal()*torqueScale,y:rng.normal()*torqueScale,z:rng.normal()*torqueScale},true);
    return {body,radius:p.radius*scale,position:position.clone(),rotation:rotation.clone(),previousPosition:position.clone(),previousRotation:rotation.clone()};
  });
  world.removeRigidBody(orb);
  return result;
}
