import RAPIER from '@dimforge/rapier3d-compat';
/** Closed six-sided viewport container. Depth is real; the front/back walls
 * prevent shards from escaping the camera while leaving all rotations free. */
export class ViewportBoundaries {
  constructor(world) { this.world=world; this.colliders=[]; this.bounds=null; }
  resize(width,height,depth,bodies=[]) {
    const old=this.bounds;
    this.bounds={halfWidth:width/2,halfHeight:height/2,depth};
    for(const c of this.colliders) this.world.removeCollider(c,true);
    this.colliders=[];
    const w=width/2,h=height/2,d=depth,t=.6;
    const walls=[[[w+t,t,d+t],[0,-h-t,0]],[[w+t,t,d+t],[0,h+t,0]],[[t,h+t,d+t],[-w-t,0,0]],[[t,h+t,d+t],[w+t,0,0]],[[w+t,h+t,t],[0,0,-d-t]],[[w+t,h+t,t],[0,0,d+t]]];
    for(const [half,pos] of walls) {
      const c=this.world.createCollider(RAPIER.ColliderDesc.cuboid(...half).setTranslation(...pos).setFriction(.65).setRestitution(.12));
      this.colliders.push(c);
    }
    if(old) for(const {body,radius} of bodies) {
      const p=body.translation();
      // Preserve normalized horizontal location and height above the old floor.
      // Clamp only on a viewport change, never during physics integration.
      body.setTranslation({x:Math.max(-w+radius,Math.min(w-radius,p.x*w/old.halfWidth)),y:Math.max(-h+radius,Math.min(h-radius,p.y+old.halfHeight-h)),z:Math.max(-d+radius,Math.min(d-radius,p.z))},true);
    }
  }
  dispose() { for(const c of this.colliders) this.world.removeCollider(c,true); this.colliders=[]; }
}
