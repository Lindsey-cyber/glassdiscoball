import { BufferGeometry, Float32BufferAttribute, Vector3, Quaternion } from 'three/webgpu';
import { random } from './random.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

/** Dense manufactured mirror tiles, with fracture cuts matching the existing
 * spherical Voronoi collider cells. Before fracture, the cut portions meet as
 * one tiny mirror; afterwards each portion follows its actual rigid body. */
export function createMirrorTiles(pieces,seed,bands=60) {
  const rng=random(seed^0x39fa8102),tiles=[];
  const buffers=pieces.map(()=>({glass:[],silver:[],glassR:[],silverR:[]}));
  let radius=0,tileCount=0,sourceArea=0;
  const axis=new Vector3(),tilt=new Quaternion(),point=new Vector3();
  function owner(p){let parent=0,best=-Infinity;for(let i=0;i<pieces.length;i++){const dot=p.dot(pieces[i].normal);if(dot>best){best=dot;parent=i;}}return parent;}
  function clip(polygon,A,B,C){
    const out=[];
    for(let i=0;i<polygon.length;i++){
      const a=polygon[i],b=polygon[(i+1)%polygon.length],da=A*a.x+B*a.y+C,db=A*b.x+B*b.y+C;
      if(da>=0)out.push(a);
      if((da>=0)!==(db>=0)){const t=da/(da-db);out.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}
    }
    return out;
  }
  function solid(target,roughnessTarget,center,u,v,n,polygon,cx,cy,depth,bevel,roughness){
    const ring=[],m=polygon.length;
    const extent=Math.max(.003,Math.min(Math.max(...polygon.map(p=>p.x))-Math.min(...polygon.map(p=>p.x)),Math.max(...polygon.map(p=>p.y))-Math.min(...polygon.map(p=>p.y))));
    const inset=1-Math.min(.13,2*bevel/extent);
    const levels=bevel?[[inset,depth/2],[1,depth/2-bevel],[1,-depth/2]]:[[1,depth/2],[1,-depth/2]];
    for(const [factor,z] of levels)for(const p of polygon)ring.push(center.clone().addScaledVector(u,cx+(p.x-cx)*factor).addScaledVector(v,cy+(p.y-cy)*factor).addScaledVector(n,z));
    function tri(a,b,c){for(const i of [a,b,c]){target.push(...ring[i].toArray());roughnessTarget.push(roughness);}}
    const back=(levels.length-1)*m;
    for(let j=1;j<m-1;j++){tri(0,j,j+1);tri(back,back+j+1,back+j);}
    for(let k=0;k<levels.length-1;k++)for(let j=0;j<m;j++){
      const a=k*m+j,b=k*m+(j+1)%m,c=(k+1)*m+(j+1)%m,d=(k+1)*m+j;tri(a,d,b);tri(b,d,c);
    }
  }
  for(let row=0;row<bands;row++){
    const theta=Math.PI*(row+.5)/bands,columns=Math.max(6,Math.round(2*bands*Math.sin(theta))),phase=(row%2)*.08+rng()*.045;
    for(let column=0;column<columns;column++){
      tileCount++;
      const phi=2*Math.PI*(column+phase)/columns;
      const radial=new Vector3(Math.sin(theta)*Math.cos(phi),Math.cos(theta),Math.sin(theta)*Math.sin(phi));
      const n=radial.clone(),u=new Vector3(-Math.sin(phi),0,Math.cos(phi)),v=new Vector3().crossVectors(n,u);
      axis.copy(u).multiplyScalar(rng.normal()).addScaledVector(v,rng.normal()).normalize();
      tilt.setFromAxisAngle(axis,rng.normal()*.025);n.applyQuaternion(tilt);u.applyQuaternion(tilt);v.applyQuaternion(tilt);
      const w=2*Math.sin(Math.PI/columns)*Math.sin(theta)*(.971-rng()*.012),h=2*Math.sin(Math.PI/(2*bands))*(.974-rng()*.012);
      sourceArea+=w*h;
      const center=radial.clone().multiplyScalar(.995),corners=[{x:-w/2,y:-h/2},{x:w/2,y:-h/2},{x:w/2,y:h/2},{x:-w/2,y:h/2}];
      const parents=new Set([owner(center)]);
      for(const p of corners)parents.add(owner(point.copy(center).addScaledVector(u,p.x).addScaledVector(v,p.y)));
      const roughness=.052+rng()*.028,glassR=.026+rng()*.012;
      for(const parent of parents){
        let polygon=corners;
        if(parents.size>1)for(let j=0;j<pieces.length&&polygon.length>2;j++){
          if(j===parent)continue;
          point.subVectors(pieces[parent].normal,pieces[j].normal);
          polygon=clip(polygon,point.dot(u),point.dot(v),point.dot(center));
        }
        if(polygon.length<3)continue;
        let twiceArea=0,cx=0,cy=0;
        for(let j=0;j<polygon.length;j++){const a=polygon[j],b=polygon[(j+1)%polygon.length],cross=a.x*b.y-b.x*a.y;twiceArea+=cross;cx+=(a.x+b.x)*cross;cy+=(a.y+b.y)*cross;}
        if(twiceArea<1e-8)continue;cx/=3*twiceArea;cy/=3*twiceArea;
        const local=center.clone().sub(pieces[parent].center),b=buffers[parent];
        solid(b.silver,b.silverR,local,u,v,n,polygon,cx,cy,.008,0,roughness);
        solid(b.glass,b.glassR,local.clone().addScaledVector(n,.006),u,v,n,polygon,cx,cy,.006,.0011,glassR);
        const position=local.clone().addScaledVector(u,cx).addScaledVector(v,cy).addScaledVector(n,.009);
        const width=Math.max(...polygon.map(p=>p.x))-Math.min(...polygon.map(p=>p.x)),height=Math.max(...polygon.map(p=>p.y))-Math.min(...polygon.map(p=>p.y));
        tiles.push({parent,position,normal:n,u,v,width,height,area:twiceArea/2});
      }
      for(const p of corners)radius=Math.max(radius,point.copy(center).addScaledVector(u,p.x).addScaledVector(v,p.y).addScaledVector(n,.009).length());
    }
  }
  function geometry(positions,roughness){const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions,3));g.setAttribute('tileRoughness',new Float32BufferAttribute(roughness,1));g.computeVertexNormals();const indexed=mergeVertices(g,1e-5);g.dispose();return indexed;}
  return {groups:buffers.map(b=>({glass:geometry(b.glass,b.glassR),silver:geometry(b.silver,b.silverR)})),tiles,radius,tileCount,sourceArea};
}
