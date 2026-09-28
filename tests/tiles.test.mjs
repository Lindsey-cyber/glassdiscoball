import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three/webgpu';
import {createFacets} from '../play/src/geometry.js';
import {createMirrorTiles} from '../play/src/tiles.js';

test('dense mirror solids retain coverage and bind their cut edges to physical cells',()=>{
 const pieces=createFacets(230,42).pieces,visual=createMirrorTiles(pieces,42);
 try {
  assert.equal(visual.tileCount,4590);
  assert.ok(visual.tiles.length>visual.tileCount,'tiles crossing a fracture boundary must be split');
  const area=visual.tiles.reduce((sum,t)=>sum+t.area,0);
  assert.ok(Math.abs(area-visual.sourceArea)/visual.sourceArea<.000001,'fracture cuts must not remove visible surface');
  for(const t of visual.tiles){
   const p=t.position.clone().add(pieces[t.parent].center);
   const distance=p.dot(pieces[t.parent].normal);
   assert.ok(pieces.every(other=>distance+.004>=p.dot(other.normal)),'tile portion belongs to its physical cell');
  }
  for(const group of visual.groups)for(const kind of ['silver','glass']){
   const g=group[kind],v=g.attributes.position.array,indices=g.index.array;
   let volume=0;const a=new Vector3(),b=new Vector3(),c=new Vector3();
   for(let i=0;i<indices.length;i+=3){a.fromArray(v,indices[i]*3);b.fromArray(v,indices[i+1]*3);c.fromArray(v,indices[i+2]*3);volume+=a.dot(b.cross(c))/6;}
   assert.ok(volume>0,'each material consists of closed, outward-facing solids');
  }
 } finally {pieces.forEach(p=>p.geometry.dispose());visual.groups.forEach(g=>{g.glass.dispose();g.silver.dispose();});}
});
