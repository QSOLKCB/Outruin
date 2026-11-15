// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {composeRadio,RADIO_MIXES} from '../js/radio.js';
import {EFFECTS,compileEffect,compileEngine,describeEffect,effectVariant} from '../js/sfx.js';
import {Sound,DEFAULT_MIX,validateMix} from '../js/sound.js';
import {createGame,step,INPUT as I,enterOutpost,snapshot,runRecord,replay} from '../js/sim.js';
import {advanceFrame} from '../js/frame.js';import {FixedClock} from '../vendor/vanillajs/modules/time/index.js';
import {DEFAULT_PACK,parsePack,serializePack} from '../js/mod.js';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
test('regional and combat scores are distinct, complete, reproducible PCM',()=>{
  const hashes=[];
  for(const mix of RADIO_MIXES){const a=composeRadio(DEFAULT_PACK,0,mix.arrangement,mix.sector),b=composeRadio(DEFAULT_PACK,0,mix.arrangement,mix.sector);
    assert.equal(a.phraseCount,8);assert.deepEqual(a.renderPhrase(7),b.renderPhrase(7));
    assert.equal(a.position(a.loopTicks).cycleSample,0);assert.equal(a.wav().length,44+a.frames*2);hashes.push(hash(a.wav()));}
  assert.equal(new Set(hashes).size,5);
  assert.notEqual(hash(composeRadio(DEFAULT_PACK,0).renderPhrase(0)),hash(composeRadio(DEFAULT_PACK,1).renderPhrase(0)));
});
test('radio PCM is identical when rendered across phrase and arbitrary chunk boundaries',()=>{
  const score=composeRadio(DEFAULT_PACK,1988),whole=score.renderRange(0,score.frames),chunked=new Int16Array(score.frames);
  for(let i=0;i<score.frames;i+=7777)chunked.set(score.renderRange(i,Math.min(7777,score.frames-i)),i);
  assert.deepEqual(chunked,whole);assert.ok(whole.some(v=>v!==0));assert.ok(whole.every(v=>Math.abs(v)<32767));
  const draft=JSON.parse(serializePack(DEFAULT_PACK));draft.music.gain=0;const silent=composeRadio(parsePack(serializePack(draft)),0);
  assert.ok(silent.renderPhrase(0).every(v=>v===0));
});
test('all bounded effect variants have repeatable WAVs and chunk-identical PCM',()=>{
  const identities=[];
  for(const kind of Object.keys(EFFECTS))for(let variant=0;variant<4;variant++){
    const a=compileEffect(kind,variant),pcm=a.renderAll(),split=Math.floor(a.frames/3),parts=new Int16Array(a.frames);
    parts.set(a.renderRange(0,split));parts.set(a.renderRange(split,a.frames-split),split);assert.deepEqual(pcm,parts);assert.ok(pcm.some(v=>v!==0));
    assert.equal(hash(a.wav()),hash(compileEffect(kind,variant).wav()));assert.equal(a.wav().length,44+a.frames*2);if(variant===0)identities.push(hash(a.wav()));
  }
  assert.equal(new Set(identities).size,Object.keys(EFFECTS).length);
});
test('engine bands stay within the donor event limit and produce distinct exact loops',()=>{
  const hashes=[];for(let i=0;i<8;i++){const s=compileEngine(i);assert.equal(s.frames,48000);assert.ok(s.eventCount<=128);hashes.push(hash(s.wav()));}
  assert.equal(new Set(hashes).size,8);
  for(const bad of [-1,8,NaN,.5])assert.throws(()=>compileEngine(bad));assert.throws(()=>compileEffect('script'));assert.throws(()=>effectVariant(-1,0,'hit'));
});
test('tick events carry their listener position, independently of frame batching',()=>{
  function run(frameTicks){const s=createGame({seed:42}),clock=new FixedClock({step:1/60,maxFrame:.1,maxSteps:6}),journal=[];
    for(let i=0;i<600/frameTicks;i++)for(const e of advanceFrame(clock,s,I.throttle|I.fire|I.right,frameTicks/60)){const d=describeEffect(e,s);if(d)journal.push(d);}return journal;}
  assert.deepEqual(run(1),run(6));
  const e={type:'enemy-shot',tick:41,x:700,listenerX:200,space:'road'};
  assert.deepEqual(describeEffect(e,{seed:0,tick:42,x:0}),describeEffect(e,{seed:0,tick:46,x:500}));
  assert.equal(describeEffect({type:'shot',tick:1,side:-1},{seed:0,x:0}).pan,-.75);
});
test('foot weapons, steps and supply pickups have distinct descriptors without changing replay',()=>{
  const s=createGame();step(s,I.interact);assert.equal(s.mode,'foot');
  const log=[];for(let i=0;i<70;i++){step(s,I.right|I.fire);log.push(...s.events.map(e=>describeEffect(e,s)).filter(Boolean));}
  assert.ok(log.some(e=>e.kind==='carbine'));assert.ok(log.some(e=>e.kind==='step'));
  assert.deepEqual(snapshot(replay(runRecord(s))),snapshot(s));
  assert.equal(describeEffect({type:'pickup',kind:'fuel',tick:1},s).kind,'fuel');assert.equal(describeEffect({type:'pickup',kind:'ammo',tick:1},s).kind,'ammo');
});
function context(){
  const c={currentTime:0,state:'running',sources:[],failStart:false,failBuffer:false,resume:async()=>{}};
  const param=()=>({value:0,setValueAtTime(value){this.value=value;},setTargetAtTime(value){this.value=value;}});
  const node=()=>({connect(){},disconnect(){this.disconnected=true;}});
  c.createGain=()=>({...node(),gain:param()});c.createStereoPanner=()=>({...node(),pan:param()});
  c.createBuffer=(_channels,length,rate)=>{if(c.failBuffer)throw new Error('buffer failure');return {length,duration:length/rate,data:new Float32Array(length),getChannelData(){return this.data;}};};
  c.createBufferSource=()=>{const s={...node(),onended:null,start(...args){if(c.failStart)throw new Error('start failure');this.started=args;},stop(when){this.stopped=when??c.currentTime;}};c.sources.push(s);return s;};
  return c;
}
function sound(){const a=new Sound();a.context=context();a.master=a.context.createGain();a.buses=Object.fromEntries(Object.keys(DEFAULT_MIX).map(k=>[k,a.context.createGain()]));return a;}
test('mix validation, independent mute and master mute stop all owned voices',()=>{
  assert.deepEqual(validateMix(DEFAULT_MIX),DEFAULT_MIX);for(const v of [null,{},[],{...DEFAULT_MIX,music:NaN},{...DEFAULT_MIX,extra:1}])assert.throws(()=>validateMix(v));
  const a=sound(),s=createGame();s.speed=700;s.lastMask=I.throttle|I.boost;a.sync(s);assert.ok(a.music);assert.equal(a.loops.size,2);
  a.event({type:'shot',tick:0},s);assert.equal(a.effects.size,1);
  a.setMix({...a.mix,music:0});assert.equal(a.music,null);assert.equal(a.loops.size,2);
  a.setMix({...a.mix,engine:0});assert.equal(a.loops.size,0);assert.equal(a.effects.size,1);
  a.setEnabled(false);assert.equal(a.effects.size,0);assert.equal(a.retiring.size,0);assert.equal(a.music,null);
});
test('pause, run replacement and arrangements use the current simulation tick',()=>{
  const a=sound(),s=createGame();s.tick=300;a.sync(s);assert.equal(a.music.snapshot().tick,300);const old=a.music;
  a.sync(s,true);assert.equal(old.snapshot().disposed,true);assert.equal(a.music,null);assert.equal(a.loops.size,0);
  s.tick=340;a.context.currentTime=2;a.sync(s);assert.equal(a.music.snapshot().tick,340);
  s.sector=1;a.sync(s);assert.equal(a.active,'road:1');assert.equal(a.tracks.size,2);
  const next=createGame({seed:9});a.sync(next);assert.equal(a.tracks.size,1);assert.equal(a.music.snapshot().tick,0);
});
test('one-shot voices and buffer reuse remain bounded under sustained combat',()=>{
  const a=sound(),s=createGame();const kinds=Object.keys(EFFECTS);
  for(let i=0;i<80;i++){const kind=kinds[i%kinds.length];a.buffer(kind+':'+(i%4),()=>compileEffect(kind,i%4));a.event({type:'shot',tick:0},s);}
  assert.ok(a.buffers.size<=64);assert.equal(a.effects.size,12);a.stop();assert.equal(a.effects.size,0);
  assert.ok(a.context.sources.every(v=>v.disconnected));
});
test('effects preserve tick spacing inside a catch-up frame and skip expired audio',()=>{
  const a=sound(),s=createGame();s.tick=100;
  a.playEvents([{type:'shot',tick:98},{type:'shot',tick:100}],s);
  const played=a.context.sources.filter(v=>v.started);assert.equal(played.length,2);
  assert.ok(Math.abs(played[1].started[0]-played[0].started[0]-2/60)<1e-9);
  a.stopEffects();a.playEvents([{type:'shot',tick:0}],s);assert.equal(a.effects.size,0);
});
test('audition cancellation wins over a late audio-unlock promise',async()=>{
  const a=sound();let resolve;a.context.resume=()=>new Promise(r=>{resolve=r;});
  const pending=a.audition(compileEffect('hit'));a.stopPreview();resolve();assert.equal(await pending,false);assert.equal(a.preview,null);assert.equal(a.context.sources.length,0);
});
test('audition survives a paused game but stops on lifecycle cancellation',async()=>{
  const a=sound(),s=createGame();assert.equal(await a.audition(compileEffect('relay')),true);const source=a.preview.source;
  a.sync(s,true);assert.ok(a.preview);a.stop();assert.equal(a.preview,null);assert.ok(source.disconnected);
});
test('device exceptions release partial nodes and preserve saved mix and enable choices',()=>{
  const a=sound(),s=createGame(),warn=console.warn;console.warn=()=>{};
  try{a.context.failStart=true;a.event({type:'shot',tick:0},s);assert.equal(a.failed,true);assert.equal(a.enabled,true);assert.deepEqual(a.mix,DEFAULT_MIX);
    assert.equal(a.effects.size,0);assert.ok(a.context.sources.every(v=>v.disconnected));assert.doesNotThrow(()=>a.sync(s));
  }finally{console.warn=warn;}
});
test('a gain-node allocation failure releases the source already allocated for that effect',()=>{
  const a=sound(),s=createGame(),warn=console.warn;console.warn=()=>{};
  try{a.context.createGain=()=>{throw new Error('gain allocation failed');};a.event({type:'shot',tick:0},s);
    assert.equal(a.failed,true);assert.equal(a.context.sources.length,1);assert.ok(a.context.sources[0].disconnected);
  }finally{console.warn=warn;}
});
test('partial audio-device initialization can be retried from a fresh user gesture',async()=>{
  const saved=Object.getOwnPropertyDescriptor(globalThis,'AudioContext'),warn=console.warn;console.warn=()=>{};
  const first=context(),second=context();let opened=0;first.createGain=()=>{throw new Error('device initialization failed');};first.close=async()=>{first.closed=true;};
  Object.defineProperty(globalThis,'AudioContext',{configurable:true,value:function(){return opened++===0?first:second;}});
  try{const a=new Sound();assert.equal(await a.unlock(),false);assert.equal(a.context,null);assert.equal(first.closed,true);
    assert.equal(await a.unlock(),true);assert.equal(a.failed,false);assert.ok(a.buses.music);assert.deepEqual(a.mix,DEFAULT_MIX);
  }finally{console.warn=warn;if(saved)Object.defineProperty(globalThis,'AudioContext',saved);else delete globalThis.AudioContext;}
});
