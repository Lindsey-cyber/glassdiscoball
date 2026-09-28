import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import {PNG} from 'pngjs';
import {mkdirSync,writeFileSync}from'node:fs';
mkdirSync('test-results',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-webgpu','--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--enable-gpu','--enable-features=Vulkan','--use-vulkan=swiftshader']});
const reports=[],errors=[];
const base=process.env.TEST_URL||'http://127.0.0.1:4173';
try {
 for(const mode of (process.env.TEST_MODES||'webgl,webgpu,mobile,reduced,fallback').split(',')) {
  const mobile=mode==='mobile';
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile,reducedMotion:mode==='reduced'?'reduce':'no-preference'});
  const page=await context.newPage();page.setDefaultTimeout(120000);
  page.on('pageerror',e=>{errors.push({mode,message:e.message});console.error(mode,e.message);});
  page.on('console',m=>{if(['warning','error'].includes(m.type())&&page.url().includes('/play/')){console.log(mode,m.type(),m.text());if(m.type()==='error')errors.push({mode,message:m.text()});}});
  if(mode==='fallback')await page.addInitScript(()=>Object.defineProperty(navigator,'gpu',{value:undefined}));
  await page.goto(`${base}/`);await page.evaluate(()=>document.fonts.ready);
  const home=await page.locator('.portrait-button').boundingBox();
  // Collect Play errors separately from the homepage.
  errors.length=0;
  await page.goto(`${base}/play/?debug&paused&seed=42${['webgpu','fallback'].includes(mode)?'':'&renderer=webgl'}`);
  await page.waitForFunction(()=>window.__glass,null,{timeout:120000});
  await page.waitForTimeout(2500);
  const slot=await page.locator('#play-experience').boundingBox();
  for(const key of ['x','y','width','height'])assert.ok(Math.abs(home[key]-slot[key])<.6,`${mode} portrait mismatch: ${key} ${home[key]} / ${slot[key]}`);
  const start=await page.evaluate(()=>window.__glass.snapshot());
  console.log(mode,start);
  async function capture(name){
   await page.evaluate(()=>window.__glass.pause());
   const bytes=await page.screenshot({path:`test-results/${mode}-${name}.png`,timeout:120000});
   if(name==='intact') {
    const png=PNG.sync.read(bytes);let visible=0,total=0;
    for(let y=Math.ceil(slot.y);y<slot.y+slot.height;y++)for(let x=Math.ceil(slot.x);x<slot.x+slot.width;x++) {
     const i=(y*png.width+x)*4;total++;
     if(Math.min(png.data[i],png.data[i+1],png.data[i+2])<235)visible++;
    }
    assert.ok(visible/total>.08,`${mode}: sculpture is absent from the rendered pixels (${visible}/${total})`);
    assert.ok(png.data[0]>248&&png.data[1]>248&&png.data[2]>248,'background must remain white');
   }
  }
  assert.ok(start.tiles>3500);
  await capture('intact');

  if(['webgl','fallback'].includes(mode))assert.equal(start.backend,'webgl2');
  if(mode==='webgpu')assert.equal(start.backend,'webgpu');
  if(mode==='reduced') {
   assert.equal(await page.evaluate(()=>Math.hypot(...Object.values(window.__glass.physics.orb.angvel()))),0);
  } else if(!mobile) {
   await page.mouse.move(slot.x+slot.width*.5,slot.y+slot.height*.5);await page.mouse.down();
   await page.mouse.move(slot.x+slot.width*.85,slot.y+slot.height*.65,{steps:8});await page.mouse.up();
   assert.equal(await page.evaluate(()=>window.__glass.snapshot().fractured),false);
   assert.ok(await page.evaluate(()=>Math.hypot(...Object.values(window.__glass.physics.orb.angvel())))>.1);
  }
  await page.evaluate(()=>window.__glass.advance(.45));
  await capture('rotating');
  if(mode==='webgpu') {
   for(const preset of ['sunset','night','neon','default']) {
    await page.locator(`[data-lighting="${preset}"]`).click();
    await page.waitForFunction(name=>window.__glass.environment.name===name,preset);
    await capture(`preset-${preset}`);
    assert.equal(await page.evaluate(()=>window.__glass.sculpture.mesh.material[0].color.getHexString()),'f4f5f6');
   }
  }
  if(mobile)await page.locator('#play-experience').tap();else await page.locator('#play-experience').click();
  await page.evaluate(()=>window.__glass.advance(.14));
  await capture('fracture');
  assert.equal(await page.evaluate(()=>window.__glass.snapshot().fractured),true);
  await page.evaluate(()=>{
   const {physics,sculpture,view,ground,environment}=window.__glass;
   for(let i=0;i<84;i++)physics.step(1/120);
   sculpture.update(physics.poses,physics.scale);ground.update(physics.poses,environment);view.render();
  });
  await capture('tumbling');
  // Integrate a fixed simulated interval; GPU software rasterization is not an
  // appropriate wall-clock FPS benchmark, but the same renderer remains active.
  const result=await page.evaluate(()=>{
   const {physics,sculpture,view,ground,environment}=window.__glass;
   for(let i=0;i<120*40;i++)physics.step(1/120);
   sculpture.update(physics.poses,physics.scale);ground.update(physics.poses,environment);view.render();
   return {snapshot:window.__glass.snapshot(),bounds:physics.boundaries.bounds,positions:physics.shards.map(s=>s.body.translation())};
  });
  await capture('settled');
  assert.ok(result.snapshot.sleeping>result.snapshot.count*.85,`${mode}: ${result.snapshot.sleeping} asleep`);
  assert.ok(result.positions.every(p=>p.y>=-result.bounds.halfHeight-.15&&Math.abs(p.x)<result.bounds.halfWidth+.15));
  if(!mobile) {
   await page.setViewportSize({width:640,height:720});await page.waitForTimeout(1000);
   assert.equal(await page.evaluate(()=>window.__glass.physics.boundaries.bounds.halfWidth),3.2);
   await capture('resize');
  }
  for(let visit=0;visit<3;visit++) {
   await page.goto(base+'/');await page.goBack();await page.waitForFunction(()=>window.__glass,null,{timeout:120000});
   await page.evaluate(()=>window.__glass.pause());
   assert.equal(await page.locator('.play-canvas').count(),1);
   assert.equal(await page.evaluate(()=>window.__glass.snapshot().fractured),false);
  }
  reports.push({mode,start,settled:result.snapshot,errors:[...errors]});
  await context.close();
 }
 console.log(JSON.stringify(reports,null,2));
 writeFileSync('test-results/report.json',JSON.stringify(reports,null,2));
 assert.ok(reports.every(r=>r.errors.length===0),JSON.stringify(reports.map(r=>r.errors)));
} catch(error) {
 console.error(JSON.stringify({reports,errors,error:String(error)},null,2));
 for(const context of browser.contexts()) for(const page of context.pages()) await page.screenshot({path:'test-results/failure.png'}).catch(()=>{});
 writeFileSync('test-results/report.json',JSON.stringify({reports,errors,error:String(error)},null,2));throw error;
} finally { await browser.close(); }
