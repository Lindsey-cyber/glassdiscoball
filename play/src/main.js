import { Vector3 } from 'three/webgpu';
import { createRenderer, PIXELS_PER_UNIT } from './renderer.js';
import { createFacets } from './geometry.js';
import { createGlass } from './material.js';
import { createEnvironment } from './environment.js';
import { createSculpture } from './sculpture.js';
import { createPhysics } from './physics.js';
import { bindInteraction } from './interaction.js';
import { createPerformancePolicy } from './performance.js';
import { seedFromURL } from './random.js';

const mount=document.querySelector('#play-experience'),status=document.querySelector('#play-status');
let active=null,booting=false,desired=true;
async function boot() {
  if(active||booting||!desired) return;
  booting=true;
  const cleanup=[];
  try {
    const policy=createPerformancePolicy(),seed=seedFromURL();
    const view=await createRenderer();cleanup.push(()=>view.dispose());
    const {pieces,radius}=createFacets(policy.count,seed);
    const sculpture=createSculpture(pieces,createGlass(),view.scene);cleanup.push(()=>sculpture.dispose());
    const physics=await createPhysics(pieces);cleanup.push(()=>physics.dispose());
    const disposeEnvironment=await createEnvironment(view.renderer,view.scene);cleanup.push(disposeEnvironment);
    const motion=matchMedia('(prefers-reduced-motion: reduce)');physics.setReduced(motion.matches);
    const events=new AbortController();cleanup.push(()=>events.abort());
    let raf=0,last=0,stopped=false;
    const resize=()=>{
      const rect=mount.getBoundingClientRect(),w=innerWidth,h=innerHeight;
      view.resize(w,h,policy.ratio);
      physics.place(new Vector3((rect.x+rect.width/2-w/2)/PIXELS_PER_UNIT,(h/2-rect.y-rect.height/2)/PIXELS_PER_UNIT,0),rect.width/(2*PIXELS_PER_UNIT*radius));
      physics.resize(w/PIXELS_PER_UNIT,h/PIXELS_PER_UNIT);wake();
    };
    function frame(time) {
      raf=0;if(stopped||document.hidden)return;
      const dt=last?Math.min(.05,(time-last)/1000):1/60;last=time;
      physics.step(dt);sculpture.update(physics.poses,physics.scale);
      view.renderer.render(view.scene,view.camera);
      if(!motion.matches&&!physics.settled)policy.sample(dt,()=>view.resize(innerWidth,innerHeight,policy.ratio));
      if(!physics.settled&&(!motion.matches||!physics.orb))raf=requestAnimationFrame(frame);
    }
    function wake(){if(!raf&&!stopped&&!document.hidden){last=0;raf=requestAnimationFrame(frame);}}
    cleanup.push(()=>{stopped=true;cancelAnimationFrame(raf);});
    cleanup.push(bindInteraction(mount,physics,hit=>{
      physics.fracture(hit,seed^0xa1f3892b);mount.disabled=true;
      status.textContent='The glass sculpture has fractured.';wake();
    },wake));
    motion.addEventListener('change',()=>{physics.setReduced(motion.matches);wake();},{signal:events.signal});
    window.addEventListener('resize',resize,{signal:events.signal,passive:true});
    window.visualViewport?.addEventListener('resize',resize,{signal:events.signal,passive:true});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;last=0;}else wake();},{signal:events.signal});
    const observer=new ResizeObserver(resize);observer.observe(mount);cleanup.push(()=>observer.disconnect());
    await document.fonts.ready;resize();
    mount.disabled=false;mount.dataset.ready='true';
    if(new URLSearchParams(location.search).has('debug')) {
      window.__glass={seed,physics,view,sculpture,policy,resize,pause:()=>{cancelAnimationFrame(raf);raf=0;last=0;},resume:wake, snapshot:()=>({seed,backend:view.renderer.backend.isWebGPUBackend?'webgpu':'webgl2',count:pieces.length,fractured:!physics.orb,sleeping:physics.shards.filter(s=>s.body.isSleeping()).length,ratio:policy.ratio,drawCalls:view.renderer.info.render.calls,geometries:view.renderer.info.memory.geometries})};
      cleanup.push(()=>delete window.__glass);
    }
    active=()=>{mount.disabled=true;delete mount.dataset.ready;cleanup.reverse().forEach(fn=>fn());active=null;};
    if(!desired)active();
  } catch(error) {
    cleanup.reverse().forEach(fn=>{try{fn();}catch{}});
    console.error('Glass sculpture initialization failed:',error);
    status.className='play-error';status.textContent='This experiment needs WebGPU or WebGL2. Please try an up-to-date browser.';
  } finally {booting=false;}
}
window.addEventListener('pagehide',()=>{desired=false;active?.();});
window.addEventListener('pageshow',()=>{desired=true;boot();});
boot();
