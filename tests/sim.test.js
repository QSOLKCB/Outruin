// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';import assert from 'node:assert/strict';
import {createGame,step,INPUT as I,enterOutpost,command,snapshot,runRecord,replay} from '../js/sim.js';
import {DEFAULT_PACK,parsePack,serializePack} from '../js/mod.js';
import {FixedClock} from '../vendor/vanillajs/modules/time/index.js';
import {advanceFrame} from '../js/frame.js';
const ticks=(s,n,m=0)=>{for(let i=0;i<n;i++)step(s,m);return s;};
const enemy=(s,extra={})=>({id:90,kind:'bike',z:s.distance+60000,x:s.x,speed:0,hp:2,shot:999,phase:0,...extra});
test('same seed and tick inputs replay exactly, including the owned mod',()=>{const a=createGame({seed:42});for(let i=0;i<1200;i++)step(a,I.throttle|(i%80<20?I.left:i%80>60?I.right:0));assert.deepEqual(snapshot(replay(runRecord(a))),snapshot(a));const b=createGame({seed:43});ticks(b,1200,I.throttle);assert.notDeepEqual(a.entities,b.entities);});
test('steering moves laterally; brake, drag and boost change speed',()=>{const s=createGame();ticks(s,100,I.throttle|I.right);assert.ok(s.x>500);s.x=0;ticks(s,200,I.throttle);const normal=s.speed;ticks(s,100,I.throttle|I.boost);assert.ok(s.speed>normal);ticks(s,80,I.brake);assert.ok(s.speed<300);s.x=1400;ticks(s,50,I.throttle);assert.ok(s.speed<normal);});
test('forward fire respects magazine cost, cooldown and damage',()=>{const s=createGame();s.entities=[enemy(s)];const ammo=s.ammo;step(s,I.fire);assert.equal(s.entities[0].hp,1);assert.equal(s.ammo,ammo-1);step(s,I.fire);assert.equal(s.ammo,ammo-1);ticks(s,8,I.fire);assert.equal(s.kills,1);assert.ok(s.scrap>0);s.ammo=0;s.cooldown=0;step(s,I.fire);assert.equal(s.ammo,0);});
test('side guns target only the requested side and nearby vehicles',()=>{const s=createGame();s.entities=[enemy(s,{z:10000,x:-700}),enemy(s,{id:91,z:10000,x:700}),enemy(s,{id:92,z:200000,x:-600})];step(s,I.leftShot);assert.equal(s.kills,1);assert.ok(s.entities.some(e=>e.id===91));assert.ok(s.entities.some(e=>e.id===92));});
test('contact damage is bounded by invulnerability; harder mode hits harder',()=>{const a=createGame({difficulty:'drifter'}),b=createGame({difficulty:'wastelord'});for(const s of [a,b]){s.entities=[enemy(s,{z:0})];step(s);const hull=s.hull;s.entities=[enemy(s,{z:0})];step(s);assert.equal(s.hull,hull);}assert.ok(b.hull<a.hull);});
test('fuel exhaustion opens a recoverable foot stop; loot is single-use',()=>{const s=createGame();s.fuel=0;step(s);assert.equal(s.mode,'foot');s.foot.x=310;step(s,I.interact);assert.equal(s.fuel,40000);step(s,0);step(s,I.interact);assert.equal(s.fuel,40000);s.foot.x=90;step(s,0);step(s,I.interact);assert.equal(s.mode,'road');assert.equal(s.visited,true);assert.equal(enterOutpost(s),false);});
test('a spent stop and empty tank ends the run without a softlock',()=>{const s=createGame();s.visited=true;s.fuel=0;step(s);assert.equal(s.mode,'lost');const before=s.tick;step(s,I.throttle);assert.equal(s.tick,before);});
test('outposts only open at low speed and interact is edge-triggered',()=>{const s=createGame();s.speed=700;step(s,I.interact);assert.equal(s.mode,'road');s.speed=0;step(s,I.interact);assert.equal(s.mode,'road');step(s,0);step(s,I.interact);assert.equal(s.mode,'foot');});
test('jump, on-foot fire, pickups and return operate independently of rendering',()=>{const s=createGame();enterOutpost(s);const y=s.foot.y;step(s,I.jump);assert.ok(s.foot.y>y);ticks(s,40);assert.equal(s.foot.y,0);s.foot.x=400;s.foot.enemies=[{id:1,x:500,hp:1,cooldown:900}];step(s,I.fire);ticks(s,7);assert.equal(s.foot.enemies[0].hp,0);s.foot.x=1320;step(s,I.interact);assert.ok(s.scrap>=100);});
test('checkpoint, shop and route choices preserve earned resources',()=>{const s=createGame();s.distance=s.pack.sectors[0].length;step(s);assert.equal(s.mode,'foot');s.scrap=200;s.foot.x=90;step(s,I.interact);assert.equal(s.mode,'depot');assert.equal(command(s,'buy','engine'),true);assert.equal(command(s,'buy','engine'),false);assert.equal(command(s,'buy','__proto__'),false);assert.equal(command(s,'route','canyon'),true);assert.equal(s.sector,1);assert.equal(s.route,'canyon');assert.equal(s.engine,12);assert.equal(s.visited,false);});
test('final war rig is required and survives roadside-stop lifecycle',()=>{const s=createGame();s.sector=2;s.distance=1800000;step(s);assert.ok(s.bossSpawned);enterOutpost(s);s.foot.x=90;step(s,I.interact);assert.equal(s.mode,'road');step(s);assert.equal(s.entities.filter(e=>e.kind==='boss').length,1);s.distance=s.pack.sectors[2].length;s.entities=[enemy(s,{kind:'boss',hp:1,z:s.distance+100000})];s.cooldown=0;step(s,I.fire);assert.equal(s.mode,'won');});
test('catch-up aborts immediately on mode change and retains shot events',()=>{const s=createGame(),clock=new FixedClock({step:1/60,maxSteps:10});s.distance=s.pack.sectors[0].length;const events=advanceFrame(clock,s,I.fire,.1);assert.equal(s.tick,1);assert.equal(s.mode,'foot');assert.equal(events.filter(e=>e.type==='shot').length,1);assert.ok(clock.paused);});
test('render-frame chunking does not change tick outcomes',()=>{const a=createGame(),b=createGame();const ca=new FixedClock({step:1/60}),cb=new FixedClock({step:1/60});for(let i=0;i<120;i++)advanceFrame(ca,a,I.throttle,1/60);for(let i=0;i<60;i++)advanceFrame(cb,b,I.throttle,1/30);assert.deepEqual(snapshot(a),snapshot(b));});
test('modded car, gun, enemy, level and difficulty take effect',()=>{const draft=JSON.parse(serializePack(DEFAULT_PACK));draft.vehicle.topSpeed=600;draft.weapons.forward.damage=5;draft.enemies.truck.hp=4;draft.sectors[0].length=700000;draft.difficulties.survivor.ammo=77;const s=createGame({pack:parsePack(serializePack(draft))});ticks(s,140,I.throttle);assert.equal(s.speed,600);assert.equal(s.ammo,77);s.entities=[enemy(s,{kind:'truck',hp:4,z:s.distance+100000})];step(s,I.fire);assert.equal(s.kills,1);s.distance=700000;step(s);assert.equal(s.mode,'foot');});
test('invalid replay records fail closed',()=>{assert.throws(()=>replay({}));const r=runRecord(createGame());r.inputs=[NaN];assert.throws(()=>replay(r));r.inputs=[];r.commands=[{tick:99,type:'route',value:'highway'}];assert.throws(()=>replay(r));});
test('replay captures the time limit on its final recorded tick',()=>{const s=createGame();s.tick=71999;step(s);assert.equal(s.mode,'lost');assert.equal(s.tick,72000);});
export function driveCampaign(seed=1988,difficulty='drifter',pack=DEFAULT_PACK){
  const s=createGame({seed,difficulty,pack});
  for(let i=0;i<35000&&!['won','lost'].includes(s.mode);i++){
    if(s.mode==='depot'){
      if(!s.gun)command(s,'buy','gun');if(s.hull<s.pack.vehicle.armour-30)command(s,'buy','repair');
      if(s.fuel<65000)command(s,'buy','fuel');if(s.ammo<100)command(s,'buy','ammo');command(s,'route','highway');continue;
    }
    let m=0;
    if(s.mode==='road'){
      m=I.throttle;const targets=s.entities.filter(e=>!['fuel','ammo'].includes(e.kind)&&e.z>s.distance&&e.z-s.distance<300000).sort((a,b)=>a.z-b.z);
      const target=targets[0]?.x??0;if(s.x<target-15)m|=I.right;if(s.x>target+15)m|=I.left;
      if(targets.some(e=>Math.abs(e.x-s.x)<200))m|=I.fire;
    }else{
      const f=s.foot,target=f.crates.find(c=>!c.taken)?.x??90;
      if(f.x<target-20)m|=I.right;if(f.x>target+20)m|=I.left;
      if(Math.abs(f.x-target)<60&&s.tick%2===0)m|=I.interact;
      if(f.enemies.some(e=>e.hp>0&&Math.sign(e.x-f.x)===f.facing&&Math.abs(e.x-f.x)<600))m|=I.fire;
    }
    step(s,m);
  }
  return s;
}
test('a complete original campaign can be won and replayed from real input decisions',()=>{const s=driveCampaign();assert.equal(s.mode,'won',JSON.stringify({mode:s.mode,reason:s.reason,tick:s.tick,ammo:s.ammo,hull:s.hull,health:s.health}));assert.equal(s.sector,2);assert.ok(s.bossDefeated);assert.deepEqual(snapshot(replay(runRecord(s))),snapshot(s));});
test('both example vehicle packs complete a full Drifter campaign',async()=>{const {readFileSync}=await import('node:fs');for(const id of ['heavy-metal','night-courier']){const pack=parsePack(readFileSync(new URL('../mods/'+id+'.json',import.meta.url),'utf8')),s=driveCampaign(1988,'drifter',pack);assert.equal(s.mode,'won',id+': '+s.reason);assert.deepEqual(snapshot(replay(runRecord(s))),snapshot(s));}});
test('default campaign survives an input-driven Survivor run',()=>{const s=driveCampaign(1988,'survivor');assert.equal(s.mode,'won',s.reason);});
