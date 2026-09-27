import { Bone, Skeleton, SkinnedMesh, Uint16BufferAttribute, Float32BufferAttribute } from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
/** A GPU rigid-transform palette: one bone per independent solid, one draw per
 * material pass. Every vertex has exactly one unit weight; nothing is deformed.
 * Works identically on WebGPU and WebGL2, without hundreds of mesh submissions.
 */
export function createSculpture(pieces,material,scene) {
  const bones=pieces.map(()=>new Bone());
  pieces.forEach((p,i)=>{
    const n=p.geometry.attributes.position.count;
    const indices=new Uint16Array(n*4), weights=new Float32Array(n*4);
    for(let j=0;j<n;j++) { indices[j*4]=i; weights[j*4]=1; }
    p.geometry.setAttribute('skinIndex',new Uint16BufferAttribute(indices,4));
    p.geometry.setAttribute('skinWeight',new Float32BufferAttribute(weights,4));
  });
  const geometry=mergeGeometries(pieces.map(p=>p.geometry));
  const mesh=new SkinnedMesh(geometry,material);
  mesh.frustumCulled=false;
  bones.forEach(b=>mesh.add(b));
  const skeleton=new Skeleton(bones); mesh.bind(skeleton);
  scene.add(mesh);
  return { mesh, bones, update(poses,scale) {
    for(let i=0;i<bones.length;i++) {
      const b=bones[i],p=poses[i];
      b.position.copy(p.position); b.quaternion.copy(p.rotation); b.scale.setScalar(scale);
    }
  }, dispose() {
    scene.remove(mesh); geometry.dispose(); skeleton.dispose(); material.dispose();
    pieces.forEach(p=>p.geometry.dispose());
  } };
}
