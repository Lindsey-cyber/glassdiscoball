import { Bone, Skeleton, SkinnedMesh, Uint16BufferAttribute, Float32BufferAttribute } from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
/** Two material batches for thousands of genuine mirror solids. A fragment's
 * tile normals and positions follow the very same Rapier quaternion. */
export function createSculpture(pieces,tileGeometry,materials,scene) {
  const bones=pieces.map(()=>new Bone());
  const partitions=['silver','glass'].map(kind=>{
    const geometries=tileGeometry.groups.map((group,i)=>{
      const g=group[kind],count=g.attributes.position.count;
      const indices=new Uint16Array(count*4),weights=new Float32Array(count*4);
      for(let j=0;j<count;j++){indices[j*4]=i;weights[j*4]=1;}
      g.setAttribute('skinIndex',new Uint16BufferAttribute(indices,4));
      g.setAttribute('skinWeight',new Float32BufferAttribute(weights,4));return g;
    });
    return mergeGeometries(geometries);
  });
  const geometry=mergeGeometries(partitions,true);partitions.forEach(g=>g.dispose());
  tileGeometry.groups.forEach(group=>{group.glass.dispose();group.silver.dispose();});
  const mesh=new SkinnedMesh(geometry,[materials.mirror,materials.glass]);
  mesh.frustumCulled=false;bones.forEach(b=>mesh.add(b));
  const skeleton=new Skeleton(bones);mesh.bind(skeleton);scene.add(mesh);
  return {mesh,bones,tiles:tileGeometry.tiles,update(poses,scale){
    materials.worldScale.value=scale;
    bones.forEach((b,i)=>{b.position.copy(poses[i].position);b.quaternion.copy(poses[i].rotation);b.scale.setScalar(scale);});
  },dispose(){
    scene.remove(mesh);geometry.dispose();skeleton.dispose();materials.glass.dispose();materials.mirror.dispose();
    pieces.forEach(p=>p.geometry.dispose());
  }};
}
