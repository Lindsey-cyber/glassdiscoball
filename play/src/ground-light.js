import { Vector3, Matrix4, Quaternion, Color, PlaneGeometry, InstancedMesh, Mesh, MeshBasicNodeMaterial, AdditiveBlending, DoubleSide, DynamicDrawUsage } from 'three/webgpu';
import { uv, float, smoothstep, uniform } from 'three/tsl';

/** Single-bounce specular transport. Each deposit is the intersection of a
 * real mirror-reflected lamp ray with the receiver, broadened by finite emitter
 * size and mirror footprint. No time/noise/animation input enters this system. */
export function createGroundLight(scene,tiles) {
  const normal=new Vector3(0,.95,.312).normalize(),u=new Vector3(1,0,0),v=new Vector3().crossVectors(normal,u);
  const origin=new Vector3(),basis=new Matrix4().makeBasis(u,v,normal),orientation=new Quaternion().setFromRotationMatrix(basis);
  const strength=uniform(.16);
  const baseMaterial=new MeshBasicNodeMaterial({color:0x82868c,transparent:true,depthWrite:false,side:DoubleSide,toneMapped:false});
  const edge=uv().sub(.5).mul(2).length();
  baseMaterial.opacityNode=smoothstep(float(1),float(.16),edge).mul(strength);
  const surface=new Mesh(new PlaneGeometry(1,1),baseMaterial);surface.quaternion.copy(orientation);surface.renderOrder=-1;scene.add(surface);
  const lightMaterial=new MeshBasicNodeMaterial({transparent:true,depthWrite:false,blending:AdditiveBlending,side:DoubleSide,toneMapped:false});
  const r=uv().sub(.5).mul(2).length();
  lightMaterial.opacityNode=r.mul(r).mul(-5).exp().mul(smoothstep(float(1),float(.72),r));
  const deposits=new InstancedMesh(new PlaneGeometry(1,1),lightMaterial,tiles.length*3);
  deposits.instanceMatrix.setUsage(DynamicDrawUsage);deposits.frustumCulled=false;deposits.renderOrder=2;deposits.count=0;scene.add(deposits);
  const p=new Vector3(),n=new Vector3(),toLight=new Vector3(),ray=new Vector3(),hit=new Vector3(),delta=new Vector3(),s=new Vector3(),matrix=new Matrix4(),color=new Color();
  let scale=1,width=1,height=1,lastCount=0;
  return {place(center,radius,viewportHeight,fractured){
    scale=radius;origin.set(center.x,fractured?-viewportHeight/2+.08:center.y-radius*1.23,0);
    width=radius*5.6;height=radius*4.2;
    surface.position.copy(origin);surface.scale.set(width,height,1);
  },update(poses,environment){
    const settings=environment.settings;strength.value=settings.ground;
    let count=0;
    for(const tile of tiles){
      const pose=poses[tile.parent];p.copy(tile.position).multiplyScalar(scale).applyQuaternion(pose.rotation).add(pose.position);n.copy(tile.normal).applyQuaternion(pose.rotation);
      for(const source of environment.sources){
        toLight.subVectors(source.position,p);const distanceSq=toLight.lengthSq();toLight.normalize();const incidence=n.dot(toLight);
        if(incidence<=.025)continue;
        const cone=source.direction.dot(delta.copy(toLight).negate());if(cone<Math.cos(source.angle))continue;
        ray.copy(toLight).negate().addScaledVector(n,2*incidence);
        const cosine=-ray.dot(normal);if(cosine<.035)continue;
        const distance=delta.subVectors(origin,p).dot(normal)/ray.dot(normal);if(distance<.02||distance>scale*12)continue;
        hit.copy(p).addScaledVector(ray,distance);delta.subVectors(hit,origin);
        const x=delta.dot(u)/(width*.5),y=delta.dot(v)/(height*.5),edge=x*x+y*y;if(edge>.94)continue;
        const blur=source.spread*distance;
        const footprint=Math.max(tile.width,tile.height)*scale;
        const a=Math.min(scale*.8,footprint+blur),b=Math.min(scale*.9,(footprint+blur)/Math.sqrt(cosine));
        // Energy falls with lamp distance, spreads over the receiver footprint,
        // and is modulated by both incidence and receiving cosines.
        const irradiance=source.power*scale*scale/Math.max(1,distanceSq);
        const power=Math.min(.8,irradiance*incidence*cosine*tile.area*scale*scale/(a*b)*settings.projection*(1-edge)**2);
        if(power<.00008)continue;
        hit.addScaledVector(normal,.003);s.set(a*2.8,b*2.8,1);matrix.compose(hit,orientation,s);deposits.setMatrixAt(count,matrix);
        color.copy(source.color).multiplyScalar(power);deposits.setColorAt(count,color);count++;
      }
    }
    deposits.count=count;lastCount=count;deposits.instanceMatrix.needsUpdate=true;if(deposits.instanceColor)deposits.instanceColor.needsUpdate=true;
  },get count(){return lastCount;},dispose(){scene.remove(surface,deposits);surface.geometry.dispose();baseMaterial.dispose();deposits.geometry.dispose();lightMaterial.dispose();deposits.dispose();}};
}
