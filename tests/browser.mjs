// SPDX-License-Identifier: Apache-2.0
// Browser dependency is test-only. No runtime install or bundle is required.
import {createRequire} from 'node:module';import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
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
  const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
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
  await check('stationary steering, road projection and interpolated frames agree',async()=>{
    await page.evaluate(async()=>{const {createGame}=await import('./js/sim.js');outruinTest.load(createGame());});
    await page.keyboard.down('KeyD');await page.waitForTimeout(180);await page.keyboard.up('KeyD');
    assert.equal(await page.evaluate(()=>outruinTest.state().x),0);
    await page.keyboard.down('KeyW');await page.keyboard.down('KeyD');await page.waitForFunction(()=>outruinTest.state().x>220);await page.keyboard.up('KeyD');await page.keyboard.up('KeyW');
    const stable=await page.evaluate(()=>{const s=outruinTest.state(),before=JSON.stringify(outruinTest.snapshot());outruinTest.renderer.draw(s,.5,outruinTest.clock.presentation.previous);return before===JSON.stringify(outruinTest.snapshot());});assert.equal(stable,true);
  });
  await check('road surface has no terrain-coloured seams between depth strips',async()=>{
    const clean=await page.evaluate(async()=>{const {createGame}=await import('./js/sim.js');const s=createGame();s.tick=500;s.noticeUntil=0;outruinTest.renderer.draw(s);const c=outruinTest.renderer.ctx;for(let y=350;y<500;y++)if(c.getImageData(640,y,1,1).data[0]>70)return false;return true;});assert.equal(clean,true);
  });
  await check('upgraded road, target warnings and all three biomes render',async()=>{
    const captures=await page.evaluate(async()=>{const {createGame}=await import('./js/sim.js');const captures=[];
      for(let sector=0;sector<3;sector++){const s=createGame();s.sector=sector;s.distance=550000;s.tick=480;s.noticeUntil=0;s.speed=960;s.x=130;
        s.entities=[{id:1,kind:'buggy',x:120,z:690000,speed:450,hp:3,shot:35,phase:0},{id:2,kind:'bike',x:-530,z:590000,speed:620,hp:2,shot:100,phase:0},{id:3,kind:'truck',x:650,z:820000,speed:340,hp:5,shot:90,phase:0}];
        s.projectiles=[{id:9,x:-100,z:620000,vx:0,damage:5,ttl:60}];s.tracers=[{fromX:130,fromZ:550000,x:120,z:690000,ttl:4,hit:true,side:0}];
        outruinTest.renderer.draw(s);captures.push(outruinTest.renderer.canvas.toDataURL().split(',')[1]);}
      return captures;});for(let i=0;i<captures.length;i++)fs.writeFileSync(path.join(out,'road-'+i+'.png'),Buffer.from(captures[i],'base64'));
    assert.equal(new Set(captures).size,3);
  });
  await check('a failed audio device cannot stop the render loop or overwrite preferences',async()=>{
    await page.click('#sound');assert.equal(await page.locator('#sound').getAttribute('aria-pressed'),'true');
    await page.waitForFunction(()=>outruinTest.sound.context?.state==='running');
    const result=await page.evaluate(()=>{const a=outruinTest.sound;a.stop();window.savedAudioBuffer=a.context.createBuffer;a.context.createBuffer=()=>{throw new Error('injected device failure');};a.sync(outruinTest.state());return {failed:a.failed,enabled:a.enabled,tick:outruinTest.state().tick};});
    assert.equal(result.failed,true);assert.equal(result.enabled,true);await page.waitForFunction(t=>outruinTest.state().tick>t,result.tick);
    assert.equal(await page.evaluate(()=>localStorage.getItem('outruin.sound')),'on');
    await page.evaluate(()=>{outruinTest.sound.context.createBuffer=window.savedAudioBuffer;});
    await page.click('#sound');await page.click('#sound');await page.waitForFunction(()=>outruinTest.sound.music?.snapshot().active);
    await page.keyboard.press('KeyP');assert.equal(await page.evaluate(()=>outruinTest.sound.music),null);await page.click('#resume');
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
  await check('WAV export uses seed zero rather than the default seed',async()=>{
    await page.click('#result-garage');await page.locator('#seed').fill('0');await page.click('#workshop');
    const downloading=page.waitForEvent('download');await page.click('#export-wav');const wav=await downloading;
    assert.equal(wav.suggestedFilename(),'outruin-last-signal-radio.wav');
    const expected=await page.evaluate(async()=>{
      const {compileSoundtrack}=await import('./js/sound.js'),{DEFAULT_PACK}=await import('./js/mod.js');
      const digest=await crypto.subtle.digest('SHA-256',compileSoundtrack(DEFAULT_PACK,0).wav());
      return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
    });
    assert.equal(createHash('sha256').update(fs.readFileSync(await wav.path())).digest('hex'),expected);
    await page.locator('[data-close="workshop-dialog"]').click();
  });
  await check('shop cache invalidates when modded prices change without changing resources',async()=>{
    await page.evaluate(async()=>{const {createGame}=await import('./js/sim.js');const s=createGame();s.mode='depot';s.scrap=15;outruinTest.load(s);});
    assert.match(await page.locator('[data-buy="ammo"] small').innerText(),/30 SCRAP/);
    assert.equal(await page.locator('[data-buy="ammo"]').isDisabled(),true);
    await page.evaluate(async()=>{
      const {createGame}=await import('./js/sim.js'),{DEFAULT_PACK,parsePack,serializePack}=await import('./js/mod.js');
      const draft=JSON.parse(serializePack(DEFAULT_PACK));draft.shop.ammo.cost=1;
      const s=createGame({pack:parsePack(serializePack(draft))});s.mode='depot';s.scrap=15;outruinTest.load(s);
    });
    assert.match(await page.locator('[data-buy="ammo"] small').innerText(),/1 SCRAP/);
    assert.equal(await page.locator('[data-buy="ammo"]').isEnabled(),true);
    await page.locator('[data-buy="ammo"]').click();
    assert.equal(await page.evaluate(()=>outruinTest.state().scrap),14);
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
    await page.locator('#bindings button').filter({hasText:/^FIRE/}).click();await page.waitForFunction(()=>outruinTest.controls.armed);await page.evaluate(()=>window.testPad.buttons[6].pressed=true);await page.waitForFunction(()=>outruinTest.controls.custom?.fire?.button===6);await page.evaluate(()=>window.testPad.buttons[6].pressed=false);
    await page.locator('[data-close="controls-dialog"]').click();await page.click('#resume');await page.waitForFunction(()=>!outruinTest.controls.blocked);const a=await page.evaluate(()=>outruinTest.state().ammo);await page.evaluate(()=>window.testPad.buttons[6].pressed=true);await page.waitForFunction(n=>outruinTest.state().ammo<n,a);await page.evaluate(()=>window.testPad.buttons[6].pressed=false);
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
