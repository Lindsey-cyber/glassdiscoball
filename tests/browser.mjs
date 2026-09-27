import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync}from'node:fs';
mkdirSync('test-results',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-webgpu','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const reports=[],errors=[];
const base=process.env.TEST_URL||'http://127.0.0.1:4173';
try {
 for(const mode of ['webgl','webgpu','mobile','reduced']) {
  const mobile=mode==='mobile';
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile,reducedMotion:mode==='reduced'?'reduce':'no-preference'});
  const page=await context.newPage();
  page.on('pageerror',e=>{errors.push({mode,message:e.message});console.error(mode,e.message);});
  page.on('console',m=>{if(m.type()==='error'&&page.url().includes('/play/'))errors.push({mode,message:m.text()});});
  await page.goto(`${base}/`);await page.evaluate(()=>document.fonts.ready);
  const home=await page.locator('.portrait-button').boundingBox();
  // Collect Play errors separately from the homepage.
  errors.length=0;
  await page.goto(`${base}/play/?debug&seed=42${mode==='webgpu'?'':'&renderer=webgl'}`);
  await page.waitForFunction(()=>window.__glass,{timeout:90000});
  await page.waitForTimeout(2500);
  const slot=await page.locator('#play-experience').boundingBox();
  for(const key of ['x','y','width','height'])assert.ok(Math.abs(home[key]-slot[key])<.6,`${mode} portrait mismatch: ${key} ${home[key]} / ${slot[key]}`);
  const start=await page.evaluate(()=>window.__glass.snapshot());
  console.log(mode,start);
  async function capture(name){await page.evaluate(()=>window.__glass.pause());await page.screenshot({path:`test-results/${mode}-${name}.png`,timeout:120000});}
  await capture('intact');
  await page.evaluate(()=>window.__glass.resume());
  if(mode==='webgl')assert.equal(start.backend,'webgl2');
  if(mode==='webgpu')assert.equal(start.backend,'webgpu');
  if(mode==='reduced') {
   assert.equal(await page.evaluate(()=>Math.hypot(...Object.values(window.__glass.physics.orb.angvel()))),0);
  } else if(!mobile) {
   await page.mouse.move(slot.x+slot.width*.5,slot.y+slot.height*.5);await page.mouse.down();
   await page.mouse.move(slot.x+slot.width*.85,slot.y+slot.height*.65,{steps:8});await page.mouse.up();
   assert.equal(await page.evaluate(()=>window.__glass.snapshot().fractured),false);
   assert.ok(await page.evaluate(()=>Math.hypot(...Object.values(window.__glass.physics.orb.angvel())))>.1);
  }
  await page.locator('#play-experience').click();
  await page.waitForTimeout(400);
  await capture('fracture');
  assert.equal(await page.evaluate(()=>window.__glass.snapshot().fractured),true);
  // Integrate a fixed simulated interval; GPU software rasterization is not an
  // appropriate wall-clock FPS benchmark, but the same renderer remains active.
  const result=await page.evaluate(()=>{
   const {physics,sculpture,view}=window.__glass;
   for(let i=0;i<120*40;i++)physics.step(1/120);
   sculpture.update(physics.poses,physics.scale);view.renderer.render(view.scene,view.camera);
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
  await page.goto(base+'/');await page.goBack();await page.waitForFunction(()=>window.__glass,{timeout:90000});
  assert.equal(await page.locator('.play-canvas').count(),1);
  assert.equal(await page.evaluate(()=>window.__glass.snapshot().fractured),false);
  reports.push({mode,start,settled:result.snapshot,errors:[...errors]});
  await context.close();
 }
 writeFileSync('test-results/report.json',JSON.stringify(reports,null,2));
 assert.ok(reports.every(r=>r.errors.length===0),JSON.stringify(reports.map(r=>r.errors)));
} catch(error) {
 console.error(JSON.stringify({reports,errors,error:String(error)},null,2));
 for(const context of browser.contexts()) for(const page of context.pages()) await page.screenshot({path:'test-results/failure.png'}).catch(()=>{});
 writeFileSync('test-results/report.json',JSON.stringify({reports,errors,error:String(error)},null,2));throw error;
} finally { await browser.close(); }
