// SPDX-License-Identifier: Apache-2.0
// Browser dependency is test-only. No runtime install or bundle is required.
import {createRequire} from 'node:module';import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);let playwright;
try{playwright=require('playwright');}catch{playwright=require(path.join(process.env.PLAYWRIGHT_MODULES||process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES||'', 'playwright'));}
const root=path.resolve(process.env.TEST_ROOT||'.'),out=path.resolve('evidence');fs.mkdirSync(out,{recursive:true});
const results=[],errors=[];let browser,server;
const receipt={status:'RUNNING',root,checks:results,errors};
const persist=()=>fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(receipt,null,2)+'\n');persist();
const check=async(name,fn)=>{try{await fn();results.push({name,status:'PASS'});console.log('PASS '+name);}catch(e){results.push({name,status:'FAIL',error:e.message});throw e;}finally{persist();}};
try{
  server=http.createServer((req,res)=>{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),relative=pathname.endsWith('/')?pathname+'index.html':pathname;
    const target=path.resolve(root,'.'+relative);if(!target.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
    try{const data=fs.readFileSync(target),ext=path.extname(target);res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'})[ext]||'text/html');res.end(data);}catch{res.writeHead(404);res.end('Not found');}
  });await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}`;
  const options={headless:true,args:['--no-sandbox']};if(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE)options.executablePath=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  browser=await playwright.chromium.launch(options);receipt.browser=browser.version();
  const context=await browser.newContext({viewport:{width:1440,height:1050},reducedMotion:'reduce'});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url+'/?test=1');await page.waitForFunction(()=>window.outruinTest);
  await check('garage and original presentation',async()=>{assert.ok(await page.locator('#start').isVisible());await page.screenshot({path:path.join(out,'menu.png'),fullPage:true});});
  await check('keyboard steering, throttle and toolbar-focused Space fire',async()=>{
    await page.click('#start');await page.keyboard.down('KeyW');await page.keyboard.down('KeyD');await page.waitForFunction(()=>outruinTest.state().x>350);await page.keyboard.up('KeyD');await page.keyboard.up('KeyW');
    assert.ok(await page.evaluate(()=>outruinTest.state().speed>0));await page.click('#sound');const ammo=await page.evaluate(()=>outruinTest.state().ammo);await page.keyboard.press('Space');await page.waitForFunction(n=>outruinTest.state().ammo<n,ammo);assert.equal(await page.locator('#sound').getAttribute('aria-pressed'),'false');
  });
  await check('pause cancels input and prevents simulation/audio progress',async()=>{
    await page.keyboard.press('KeyP');const t=await page.evaluate(()=>outruinTest.state().tick);await page.waitForTimeout(120);assert.equal(await page.evaluate(()=>outruinTest.state().tick),t);assert.equal(await page.evaluate(()=>outruinTest.sound.music),null);await page.click('#resume');
    const x=await page.evaluate(()=>outruinTest.state().x);await page.waitForTimeout(120);assert.ok(Math.abs(await page.evaluate(()=>outruinTest.state().x)-x)<100);
  });
  await check('OPT background cache matches reference pixels for every biome and foot view',async()=>{
    const parity=await page.evaluate(async()=>{const {createGame,enterOutpost}=await import('./js/sim.js');const r=outruinTest.renderer,results=[];
      for(let i=0;i<3;i++)for(const foot of [false,true]){const s=createGame();s.sector=i;s.distance=700000;s.tick=500;s.noticeUntil=0;if(foot)enterOutpost(s);
        r.reference=true;r.draw(s);const a=r.ctx.getImageData(0,0,1280,720).data;r.reference=false;r.draw(s);const b=r.ctx.getImageData(0,0,1280,720).data;
        results.push(a.every((v,i)=>v===b[i]));}return results;});assert.ok(parity.every(Boolean));
  });
  await check('outpost movement, loot and return through keyboard',async()=>{
    await page.evaluate(async()=>{const {createGame,enterOutpost}=await import('./js/sim.js');const s=createGame();s.fuel=1000;enterOutpost(s);s.foot.enemies=[];outruinTest.load(s);});
    await page.keyboard.down('KeyD');await page.waitForFunction(()=>outruinTest.state().foot.x>260);await page.keyboard.up('KeyD');await page.keyboard.press('KeyE');await page.waitForFunction(()=>outruinTest.state().fuel>1000);
    await page.locator('.viewport').screenshot({path:path.join(out,'outpost.png')});await page.keyboard.down('KeyA');await page.waitForFunction(()=>outruinTest.state().foot.x<140);await page.keyboard.up('KeyA');await page.keyboard.press('KeyE');await page.waitForFunction(()=>outruinTest.state().mode==='road');
  });
  await check('checkpoint shop, route and final victory UI',async()=>{
    await page.evaluate(async()=>{const {createGame}=await import('./js/sim.js');const s=createGame();s.mode='depot';s.scrap=300;outruinTest.load(s);});
    await page.locator('[data-buy="engine"]').click();assert.equal(await page.evaluate(()=>outruinTest.state().engine),12);await page.click('#canyon');await page.waitForFunction(()=>outruinTest.state().sector===1);
    await page.evaluate(async()=>{const {createGame}=await import('./js/sim.js');const s=createGame();s.sector=2;s.distance=s.pack.sectors[2].length;s.bossDefeated=true;s.bossSpawned=true;outruinTest.load(s);});await page.waitForFunction(()=>outruinTest.state().mode==='won');assert.ok(await page.locator('#result-title').isVisible());
  });
  await check('mod validation, bundled custom car and export are usable',async()=>{
    await page.click('#workshop');await page.locator('#pack-source').fill('{"kind":"unsafe"}');await page.click('#apply-pack');assert.ok((await page.locator('#mod-status').innerText()).includes('rejected'));
    await page.selectOption('#example-pack','heavy-metal');await page.waitForFunction(()=>document.querySelector('#pack-source').value.includes('Iron Gospel'));
    const downloading=page.waitForEvent('download');await page.click('#export-pack');assert.equal((await downloading).suggestedFilename(),'outruin-heavy-metal.json');
    await page.click('#apply-pack');assert.ok((await page.locator('#pack-label').innerText()).includes('HEAVY METAL'));await page.click('#start');assert.equal(await page.evaluate(()=>outruinTest.state().pack.vehicle.armour),180);
  });
  await check('controller profiles and remap capture simulated pad',async()=>{
    await page.click('#settings');await page.selectOption('#profile','snes');
    await page.evaluate(()=>{window.testPad={connected:true,id:'Synthetic SNES',mapping:'',axes:[0,0],buttons:Array.from({length:16},()=>({pressed:false}))};Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[window.testPad]});});
    await page.waitForFunction(()=>document.querySelector('#pad-status').textContent.includes('Synthetic'));
    await page.locator('#bindings button').filter({hasText:/^FIRE/}).click();await page.waitForTimeout(40);await page.evaluate(()=>window.testPad.buttons[6].pressed=true);await page.waitForFunction(()=>outruinTest.controls.custom?.fire?.button===6);await page.evaluate(()=>window.testPad.buttons[6].pressed=false);
    await page.locator('[data-close="controls-dialog"]').click();await page.click('#resume');await page.waitForTimeout(50);const a=await page.evaluate(()=>outruinTest.state().ammo);await page.evaluate(()=>window.testPad.buttons[6].pressed=true);await page.waitForFunction(n=>outruinTest.state().ammo<n,a);await page.evaluate(()=>window.testPad.buttons[6].pressed=false);
  });
  await check('focus loss and controller disconnect pause safely',async()=>{await page.evaluate(()=>dispatchEvent(new Event('blur')));assert.ok(await page.locator('#paused').isVisible());await page.click('#resume');await page.evaluate(()=>{window.testPad=null;dispatchEvent(new Event('gamepaddisconnected'));});await page.waitForFunction(()=>!document.querySelector('#paused').hidden);});
  await check('mobile layouts and simultaneous touch input',async()=>{
    await page.click('#garage');for(const width of [320,390,768]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(out,'mobile-'+width+'.png'),fullPage:true});}
    await page.setViewportSize({width:390,height:844});await page.click('#start');await page.evaluate(()=>document.body.classList.add('show-touch'));
    // Pointer identities are distinct and cancel independently.
    await page.evaluate(()=>{for(const [id,key] of [[1,'throttle'],[2,'right']]){const b=document.querySelector(`[data-control="${key}"]`);b.setPointerCapture=()=>{};b.dispatchEvent(new PointerEvent('pointerdown',{pointerId:id,bubbles:true}));}});
    await page.waitForFunction(()=>outruinTest.state().speed>100&&outruinTest.state().x>200);
    await page.evaluate(()=>{for(const [id,key] of [[1,'throttle'],[2,'right']])document.querySelector(`[data-control="${key}"]`).dispatchEvent(new PointerEvent('pointercancel',{pointerId:id,bubbles:true}));});
    assert.equal(await page.evaluate(()=>outruinTest.controls.touch.size),0);
  });
  await check('offline reload retains full game and mod examples',async()=>{
    await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));await context.setOffline(true);await page.reload();await page.waitForFunction(()=>window.outruinTest);await page.click('#workshop');await page.selectOption('#example-pack','night-courier');await page.waitForFunction(()=>document.querySelector('#pack-source').value.includes('Glass Needle'));await page.click('#apply-pack');await page.click('#start');assert.equal(await page.evaluate(()=>outruinTest.state().pack.vehicle.name),'Glass Needle');await context.setOffline(false);
  });
  await check('runtime has no uncaught browser errors',async()=>assert.deepEqual(errors,[]));
  receipt.status='PASS';
}catch(e){receipt.status='FAIL';receipt.failure=e.stack;console.error(e);process.exitCode=1;}
finally{persist();if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));}
