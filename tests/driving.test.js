// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,step,INPUT as I,bendAt,runRecord,replay,snapshot} from '../js/sim.js';
import {DEFAULT_PACK,parsePack,serializePack} from '../js/mod.js';
import {project,forwardTarget} from '../js/render.js';
import {compileSoundtrack,Sound} from '../js/sound.js';
const advance=(s,n,mask=0)=>{for(let i=0;i<n;i++)step(s,mask);return s;};
function quiet(){const s=createGame();s.spawnIn=100000;s.invulnerable=0;return s;}
test('a stationary car can turn its wheels without sliding across the road',()=>{
  const s=quiet();advance(s,180,I.right);assert.equal(s.x,0);assert.equal(s.vx,0);assert.equal(s.speed,0);assert.equal(s.steering,1000);
  advance(s,30);assert.equal(s.steering,0);
});
test('steering builds with road speed and settles after releasing the wheel',()=>{
  const slow=quiet(),fast=quiet();slow.speed=180;fast.speed=850;
  advance(slow,25,I.right);advance(fast,25,I.right);
  assert.ok(fast.x>slow.x*3);assert.ok(slow.x>0);
  const before=fast.x;advance(fast,60);assert.ok(fast.x>before);assert.ok(Math.abs(fast.vx)<.01);assert.equal(fast.steering,0);
  advance(fast,60,I.left);assert.ok(fast.x<before);assert.ok(fast.vx<0);
});
test('braking shortens stopping distance and stops lateral movement',()=>{
  const brake=quiet(),coast=quiet();brake.speed=coast.speed=1080;brake.vx=coast.vx=8;
  advance(brake,100,I.brake);advance(coast,100);
  assert.equal(brake.speed,0);assert.equal(brake.vx,0);assert.ok(brake.distance<coast.distance/2);
});
test('continuous authored bends have no segment-boundary shove',()=>{
  for(const route of ['highway','canyon'])for(let i=1;i<20;i++){
    const a=bendAt(i*280000-1,0,route),b=bendAt(i*280000,0,route),c=bendAt(i*280000+1,0,route);
    assert.ok(Math.abs(a-b)<.00001);assert.ok(Math.abs(c-b)<.00001);
  }
});
test('drawn shoulder, player and lane positions share exact road coordinates',()=>{
  const s=quiet();for(const x of [-1000,0,1000]){
    s.x=x;const centre=project(s,0),player=project(s,0,s.x);
    assert.equal(player.x-centre.x,centre.w*x/1000);
    assert.equal(project(s,0,1000).x-centre.x,centre.w);
  }
  const nearest=project(s,20000),farther=project(s,100000);assert.ok(nearest.w>farther.w&&nearest.y>farther.y);
});
test('roadside drag and traction change actual handling without escaping bounds',()=>{
  const road=quiet(),dirt=quiet();road.speed=dirt.speed=850;dirt.x=1100;
  advance(road,15,I.right|I.throttle);advance(dirt,15,I.right|I.throttle);
  assert.ok(dirt.speed<road.speed);assert.ok(dirt.vx<road.vx);
  advance(dirt,900,I.right|I.throttle);assert.ok(dirt.x<=1550);assert.ok(Number.isFinite(dirt.x));
});
test('hostile fire travels before damage and a steering dodge avoids it',()=>{
  function encounter(){const s=quiet();s.entities=[{id:1,kind:'bike',x:0,z:120000,speed:0,hp:2,shot:1,phase:0}];return s;}
  const hit=encounter(),dodge=encounter();step(hit);step(dodge);assert.equal(hit.hull,100);assert.equal(hit.projectiles.length,1);
  dodge.speed=700;advance(dodge,60,I.right|I.throttle);advance(hit,60);
  assert.ok(hit.hull<100);assert.equal(dodge.hull,100);assert.ok(dodge.x>300);
});
test('attack warning has 42 active ticks; targeting obeys actual gun range',()=>{
  const s=quiet();s.entities=[{id:1,kind:'buggy',x:0,z:180000,speed:0,hp:3,shot:42,phase:0}];
  advance(s,41);assert.equal(s.projectiles.length,0);step(s);assert.equal(s.projectiles.length,1);
  assert.equal(forwardTarget(s)?.id,1);s.entities[0].x=241;assert.equal(forwardTarget(s),null);
  s.entities[0].x=0;s.entities[0].z=s.pack.weapons.forward.range+1;assert.equal(forwardTarget(s),null);
});
test('projectiles, tracers and new handling replay identically; old rules fail explicitly',()=>{
  const s=createGame({seed:101});for(let i=0;i<6000&&s.mode==='road';i++)step(s,I.throttle|I.fire|(i%300<90?I.left:i%300>210?I.right:0));
  assert.deepEqual(snapshot(replay(runRecord(s))),snapshot(s));assert.ok(s.projectiles.length<=48);assert.ok(s.tracers.length<=6);
  const old=runRecord(s);old.version='0.1.0';assert.throws(()=>replay(old),/Unsupported replay/);
});
test('extreme grip, steering and top-speed values stay finite and bounded',()=>{
  for(const grip of [1,60])for(const speed of [300,1800]){
    const draft=JSON.parse(serializePack(DEFAULT_PACK));Object.assign(draft.vehicle,{grip,steering:60,topSpeed:speed});
    const s=createGame({pack:parsePack(serializePack(draft))});s.spawnIn=100000;
    for(let i=0;i<1200;i++){step(s,I.throttle|I.boost|(i%80<40?I.right:I.left));assert.ok(Number.isFinite(s.x)&&Math.abs(s.x)<=1550);assert.ok(Math.abs(s.steering)<=1000);}
  }
});
test('eight-phrase soundtrack exports the complete tick-aligned loop',()=>{
  const a=compileSoundtrack(DEFAULT_PACK,0),b=compileSoundtrack(DEFAULT_PACK,0);assert.equal(a.phraseCount,8);assert.equal(a.loopTicks,1920);
  assert.notDeepEqual(a.renderPhrase(0),a.renderPhrase(1));assert.deepEqual(a.renderPhrase(2),b.renderPhrase(2));
  const wav=a.wav();assert.equal(wav.length,44+a.frames*2);assert.equal(new DataView(wav.buffer).getUint32(40,true),a.frames*2);
  assert.deepEqual(a.position(a.loopTicks),a.position(0));assert.equal(a.position(240).phrase,1);
  for(const mode of ['road','foot','boss'])for(const tempo of [80,137,160]){const draft=JSON.parse(serializePack(DEFAULT_PACK));draft.music.tempo=tempo;const score=compileSoundtrack(draft,0,mode);assert.equal(score.frames%800,0);}
});
test('audio device failure is contained and preserves the enabled preference',async()=>{
  const sound=new Sound(),oldWarn=console.warn;console.warn=()=>{};
  try{sound.buses={music:{}};sound.context={state:'running',currentTime:0,createBuffer(){throw new Error('lost device');}};
    assert.doesNotThrow(()=>sound.sync(createGame()));assert.equal(sound.failed,true);assert.equal(sound.enabled,true);assert.equal(sound.music,null);
    assert.doesNotThrow(()=>sound.sync(createGame()));
  }finally{console.warn=oldWarn;}
});
