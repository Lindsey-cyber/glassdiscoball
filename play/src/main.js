import { Vector3 } from 'three/webgpu';
import { createRenderer, PIXELS_PER_UNIT } from './renderer.js';
import { createFacets } from './geometry.js';
import { createMirrorTiles } from './tiles.js';
import { createGroundLight } from './ground-light.js';
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
    const {pieces}=createFacets(policy.count,seed);
    const tiles=createMirrorTiles(pieces,seed,policy.bands),radius=tiles.radius;
    const sculpture=createSculpture(pieces,tiles,createGlass(),view.scene);cleanup.push(()=>sculpture.dispose());
    const physics=await createPhysics(pieces);cleanup.push(()=>physics.dispose());
    const environment=await createEnvironment(view.renderer,view.scene);cleanup.push(()=>environment.dispose());
    const ground=createGroundLight(view.scene,tiles.tiles);cleanup.push(()=>ground.dispose());
    const anchor=new Vector3();
    const motion=matchMedia('(prefers-reduced-motion: reduce)');physics.setReduced(motion.matches);
    const events=new AbortController();cleanup.push(()=>events.abort());
    let raf=0,last=0,stopped=false;
    const resize=()=>{
      const rect=mount.getBoundingClientRect(),w=innerWidth,h=innerHeight;
      view.resize(w,h,policy.ratio);
      anchor.set((rect.x+rect.width/2-w/2)/PIXELS_PER_UNIT,(h/2-rect.y-rect.height/2)/PIXELS_PER_UNIT,0);
      physics.place(anchor,rect.width/(2*PIXELS_PER_UNIT*radius));
      environment.place(anchor,physics.scale);
      ground.place(anchor,physics.scale,h/PIXELS_PER_UNIT,!physics.orb);
      physics.resize(w/PIXELS_PER_UNIT,h/PIXELS_PER_UNIT);wake();
    };
    function frame(time) {
      raf=0;if(stopped||document.hidden)return;
      const dt=last?Math.min(.05,(time-last)/1000):1/60;last=time;
      physics.step(dt);sculpture.update(physics.poses,physics.scale);ground.update(physics.poses,environment);
      view.render();
      if(!motion.matches&&!physics.settled)policy.sample(dt,()=>view.resize(innerWidth,innerHeight,policy.ratio));
      if(!physics.settled&&(!motion.matches||!physics.orb))raf=requestAnimationFrame(frame);
    }
    function wake(){if(!raf&&!stopped&&!document.hidden){last=0;raf=requestAnimationFrame(frame);}}
    cleanup.push(()=>{stopped=true;cancelAnimationFrame(raf);});
    cleanup.push(bindInteraction(mount,physics,hit=>{
      physics.fracture(hit,seed^0xa1f3892b);mount.disabled=true;
      ground.place(anchor,physics.scale,innerHeight/PIXELS_PER_UNIT,true);
      status.textContent='The mirror ball has fractured.';wake();
    },wake));
    async function setPreset(name){
      await environment.setPreset(name);
      document.querySelectorAll('[data-lighting]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.lighting===environment.name)));
      ground.update(physics.poses,environment);wake();
    }
    document.querySelectorAll('[data-lighting]').forEach(button=>button.addEventListener('click',()=>setPreset(button.dataset.lighting).catch(console.error),{signal:events.signal}));
    motion.addEventListener('change',()=>{physics.setReduced(motion.matches);wake();},{signal:events.signal});
    window.addEventListener('resize',resize,{signal:events.signal,passive:true});
    window.visualViewport?.addEventListener('resize',resize,{signal:events.signal,passive:true});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;last=0;}else wake();},{signal:events.signal});
    const observer=new ResizeObserver(resize);observer.observe(mount);cleanup.push(()=>observer.disconnect());
    await document.fonts.ready;resize();
    cancelAnimationFrame(raf);raf=0;
    physics.step(1/120);sculpture.update(physics.poses,physics.scale);ground.update(physics.poses,environment);
    await view.renderer.compileAsync(view.scene,view.camera);
    wake();
    mount.disabled=false;mount.dataset.ready='true';
    if(new URLSearchParams(location.search).has('debug')) {
      window.__glass={seed,physics,view,sculpture,policy,resize,environment,ground,setPreset,pause:async()=>{cancelAnimationFrame(raf);raf=0;last=0;await view.renderer.compileAsync(view.scene,view.camera);view.render();await view.renderer.backend.device?.queue.onSubmittedWorkDone();},resume:wake, snapshot:()=>({seed,backend:view.renderer.backend.isWebGPUBackend?'webgpu':'webgl2',count:pieces.length,tiles:tiles.tiles.length,preset:environment.name,lightDeposits:ground.count,fractured:!physics.orb,sleeping:physics.shards.filter(s=>s.body.isSleeping()).length,ratio:policy.ratio,drawCalls:view.renderer.info.render.drawCalls,geometries:view.renderer.info.memory.geometries,memoryBytes:view.renderer.info.memory.total})};
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
