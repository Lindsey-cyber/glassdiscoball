import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three/webgpu';
import {createFacets} from '../play/src/geometry.js';
import {createPhysics} from '../play/src/physics.js';

const facets=createFacets(210,42);
test('Voronoi solids are irregular, reproducible and have nonzero volume',()=>{
 const again=createFacets(210,42);
 assert.equal(facets.pieces.length,210);
 assert.deepEqual(facets.pieces[14].hull,again.pieces[14].hull);
 const areas=facets.pieces.map(p=>p.area);assert.ok(Math.max(...areas)/Math.min(...areas)>2);
 for(const p of facets.pieces){
  assert.ok(p.area>0&&p.thickness>.02);
  const v=p.geometry.attributes.position.array;let volume=0;
  for(let i=0;i<v.length;i+=9){const a=new Vector3().fromArray(v,i),b=new Vector3().fromArray(v,i+3),c=new Vector3().fromArray(v,i+6);volume+=a.dot(b.cross(c))/6;}
  assert.ok(volume>0,`winding must enclose a positive volume: ${volume}`);
 }
 again.pieces.forEach(p=>p.geometry.dispose());
});
test('rigid torque retains inertia, fracture collides with floor and eventually sleeps',async()=>{
 const p=await createPhysics(facets.pieces);
 try {
  p.place(new Vector3(3,2,0),1.2);p.resize(12.8,8);
  p.spin(80,25,.03);p.step(1/60);
  const before=p.orb.angvel();assert.ok(Math.hypot(before.x,before.y,before.z)>.5);
  for(let i=0;i<120;i++)p.step(1/120);
  const after=p.orb.angvel();assert.ok(Math.hypot(after.x,after.y,after.z)>.1);
  p.fracture(new Vector3(3,2,1),3443);
  assert.equal(p.shards.length,210);
  assert.ok(p.shards.every(s=>s.body.mass()>0));
  let bounced=false;
  let velocities=p.shards.map(s=>s.body.linvel().y);
  for(let i=0;i<120*35;i++){
   p.step(1/120);
   p.shards.forEach((s,j)=>{
    const t=s.body.translation(),v=s.body.linvel();
    assert.ok(Number.isFinite(t.x)&&Number.isFinite(t.y));
    assert.ok(t.y>-4.12&&t.y<4.3&&Math.abs(t.x)<6.65&&Math.abs(t.z)<2.05,`shard escaped ${JSON.stringify(t)}`);
    if(t.y<-3.5&&velocities[j]<-1&&v.y>.3)bounced=true;
    velocities[j]=v.y;
   });
  }
  const asleep=p.shards.filter(s=>s.body.isSleeping()).length;
  console.log({asleep,total:210,bounced});
  assert.ok(bounced,'must rebound after impact');
  assert.ok(asleep>190,'most shards naturally sleep');
  p.resize(3.9,8.44);
  for(let i=0;i<120*10;i++)p.step(1/120);
  assert.ok(p.shards.every(s=>Math.abs(s.body.translation().x)<2.12));
 } finally {p.dispose();}
});
for(const [count,seed,w,h,center,scale] of [[340,8127,14.4,9,new Vector3(2.62,2.5,0),1.25],[150,98172,3.9,8.44,new Vector3(0,2.99,0),.92]]) test(`viewport budget ${count} remains contained and settles`,async()=>{
  const geometry=createFacets(count,seed),p=await createPhysics(geometry.pieces);
  try {
   p.place(center,scale);p.resize(w,h);p.fracture(center.clone().add(new Vector3(.1,.1,.8)),seed);
   for(let i=0;i<120*40;i++) {
    p.step(1/120);
    for(const s of p.shards) {
     const t=s.body.translation();
     assert.ok(t.y>=-h/2-.12&&t.y<h/2+.15&&Math.abs(t.x)<w/2+.15,`${count}: escaped ${JSON.stringify(t)}`);
    }
   }
   const asleep=p.shards.filter(s=>s.body.isSleeping()).length;console.log({count,seed,asleep});
   assert.ok(asleep>count*.85);
  } finally {p.dispose();geometry.pieces.forEach(p=>p.geometry.dispose());}
});
