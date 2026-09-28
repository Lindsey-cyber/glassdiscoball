import { BufferGeometry, Float32BufferAttribute, Vector3, Quaternion } from 'three/webgpu';
import { random } from './random.js';

/** Tiny manufactured mirror tiles, independent of the unchanged Rapier hulls.
 * A tile's vertices have exactly one rigid fragment transform. There is no
 * normal-map tiling, texture grid, or animated highlight in this geometry. */
export function createMirrorTiles(pieces, seed, bands=60) {
  const rng=random(seed^0x39fa8102);
  const buffers=pieces.map(()=>({glass:[],silver:[],glassR:[],silverR:[]}));
  const tiles=[];let radius=0;
  const axis=new Vector3(),tilt=new Quaternion();
  function solid(target,roughnessTarget,center,u,v,n,w,h,depth,bevel,roughness) {
    const ring=[];
    const levels=bevel?[[bevel,depth/2],[0,depth/2-bevel],[0,-depth/2]]:[[0,depth/2],[0,-depth/2]];
    for(const [inset,z] of levels) {
      for(const [x,y] of [[-1,-1],[1,-1],[1,1],[-1,1]])ring.push(center.clone().addScaledVector(u,x*(w/2-inset)).addScaledVector(v,y*(h/2-inset)).addScaledVector(n,z));
    }
    function tri(a,b,c){for(const i of [a,b,c]){target.push(...ring[i].toArray());roughnessTarget.push(roughness);}}
    const back=(levels.length-1)*4;
    tri(0,1,2);tri(0,2,3);tri(back,back+2,back+1);tri(back,back+3,back+2);
    for(let k=0;k<levels.length-1;k++)for(let j=0;j<4;j++){const a=k*4+j,b=k*4+(j+1)%4,c=(k+1)*4+(j+1)%4,d=(k+1)*4+j;tri(a,d,b);tri(b,d,c);}
  }
  for(let row=0;row<bands;row++) {
    const theta=Math.PI*(row+.5)/bands;
    const columns=Math.max(6,Math.round(2*bands*Math.sin(theta)));
    const phase=(row%2)*.08+rng()*.045;
    for(let column=0;column<columns;column++) {
      const phi=2*Math.PI*(column+phase)/columns;
      const radial=new Vector3(Math.sin(theta)*Math.cos(phi),Math.cos(theta),Math.sin(theta)*Math.sin(phi));
      let parent=0,best=-Infinity;
      for(let i=0;i<pieces.length;i++){const dot=radial.dot(pieces[i].normal);if(dot>best){best=dot;parent=i;}}
      const n=radial.clone(),u=new Vector3(-Math.sin(phi),0,Math.cos(phi)),v=new Vector3().crossVectors(n,u);
      axis.copy(u).multiplyScalar(rng.normal()).addScaledVector(v,rng.normal()).normalize();
      tilt.setFromAxisAngle(axis,rng.normal()*.018);n.applyQuaternion(tilt);u.applyQuaternion(tilt);v.applyQuaternion(tilt);
      const w=2*Math.sin(Math.PI/columns)*Math.sin(theta)*(.971-rng()*.012);
      const h=2*Math.sin(Math.PI/(2*bands))*(.974-rng()*.012);
      const center=radial.clone().multiplyScalar(.995).sub(pieces[parent].center);
      const glassCenter=center.clone().addScaledVector(n,.006);
      const b=buffers[parent];
      const roughness=.052+rng()*.028;
      solid(b.silver,b.silverR,center,u,v,n,w,h,.008,0,roughness);
      solid(b.glass,b.glassR,glassCenter,u,v,n,w*.998,h*.998,.006,.0011,.026+rng()*.012);
      const position=center.clone().addScaledVector(n,.009);
      tiles.push({parent,position,normal:n,u,v,width:w,height:h,area:w*h});
      radius=Math.max(radius,position.clone().add(pieces[parent].center).length()+Math.max(w,h)**2/8);
    }
  }
  function geometry(positions,roughness) {
    const g=new BufferGeometry();
    g.setAttribute('position',new Float32BufferAttribute(positions,3));
    g.setAttribute('tileRoughness',new Float32BufferAttribute(roughness,1));
    g.computeVertexNormals();return g;
  }
  const groups=buffers.map(b=>({glass:geometry(b.glass,b.glassR),silver:geometry(b.silver,b.silverR)}));
  return {groups,tiles,radius};
}
