import { Vector3 } from 'three/webgpu';
import { PIXELS_PER_UNIT } from './renderer.js';
export function bindInteraction(element,physics,onFracture,onWake) {
  const controller=new AbortController(),options={signal:controller.signal};
  let drag=null;
  function impact(e) {
    const p=physics.orb.translation();
    return new Vector3((e.clientX-innerWidth/2)/PIXELS_PER_UNIT,(innerHeight/2-e.clientY)/PIXELS_PER_UNIT,p.z+physics.scale*.8);
  }
  element.addEventListener('pointerdown',e=>{
    if(!physics.orb||e.button!==0||drag) return;
    const r=element.getBoundingClientRect();
    if(Math.hypot(e.clientX-r.x-r.width/2,e.clientY-r.y-r.height/2)>r.width/2) return;
    drag={id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,time:e.timeStamp,moved:false};
    element.setPointerCapture(e.pointerId);onWake();
  },options);
  element.addEventListener('pointermove',e=>{
    if(!drag||drag.id!==e.pointerId) return;
    const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
    drag.moved ||= Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>6;
    if(drag.moved) physics.spin(dx,dy,Math.max(1/240,(e.timeStamp-drag.time)/1000));
    drag.x=e.clientX;drag.y=e.clientY;drag.time=e.timeStamp;
  },options);
  element.addEventListener('pointerup',e=>{
    if(!drag||drag.id!==e.pointerId) return;
    const click=!drag.moved;drag=null;
    if(element.hasPointerCapture(e.pointerId)) element.releasePointerCapture(e.pointerId);
    if(click&&physics.orb) onFracture(impact(e));
  },options);
  for(const type of ['pointercancel','lostpointercapture']) element.addEventListener(type,()=>{drag=null;},options);
  element.addEventListener('click',e=>{
    // Native button keyboard activation (also supports assistive technology).
    if(e.detail===0&&physics.orb) { const p=physics.orb.translation();onFracture(new Vector3(p.x,p.y,p.z+physics.scale)); }
  },options);
  return ()=>controller.abort();
}
