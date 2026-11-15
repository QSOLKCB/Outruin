// SPDX-License-Identifier: Apache-2.0
// Original four-lane score. Integer PCM comes from VANILLAJS audio2d.
// OPT-INV-001: reuse only when the immutable music recipe + seed + arrangement match.
import {createSound2D,AUDIO2D_RATE} from '../vendor/vanillajs/modules/audio2d/index.js';
import {DEFAULT_PACK} from './mod.js';
import {composeRadio} from './radio.js';
import {compileEffect,compileEngine,describeEffect} from './sfx.js';
import {createSoundtrackPlayer} from '../vendor/vanillajs/api/audio/index.js';
export function compileScore(pack=DEFAULT_PACK,seed=1988,arrangement='road',variation=0) {
  if(!['road','foot','boss'].includes(arrangement))throw new Error('Unknown arrangement');
  const m=pack.music,tempo=arrangement==='foot'?Math.max(80,m.tempo-30):arrangement==='boss'?Math.min(160,m.tempo+20):m.tempo;
  const boundary=i=>Math.floor(i*AUDIO2D_RATE*30/tempo),frames=boundary(16),events=[];
  const add=(step,channel,frequency,wave,gain,length=1)=>events.push({id:events.length+1,sample:boundary(step),
    duration:Math.floor((boundary(Math.min(16,step+length))-boundary(step))*.8),channel,frequency,wave,gain,seed:(seed+step*17)>>>0});
  for(let i=0;i<16;i++){
    if(arrangement!=='foot'||i%2===0)add(i,0,m.scale[m.melody[(i+variation*4)%16]],arrangement==='foot'?'triangle':m.wave,m.gain);
    if(i%2===0)add(i,1,m.bass[(Math.floor(i/4)+variation)%4],'triangle',Math.min(6000,m.gain+1700),2);
    add(i,2,i%4===2?180:4000,'noise',i%4===2?2200:700);
    if(i%4===0||(arrangement==='boss'&&i%4===3))add(i,3,55,'triangle',5000);
  }
  return createSound2D({frames,events});
}
export function createScoreCache(){
  let packRef=null,runSeed=null;const cache=new Map();
  return {get(pack,seed,arrangement){if(pack!==packRef||seed!==runSeed){cache.clear();packRef=pack;runSeed=seed;}
    if(!cache.has(arrangement))cache.set(arrangement,compileScore(pack,seed,arrangement));return cache.get(arrangement);},get size(){return cache.size;}};
}
export const compileSoundtrack=composeRadio;
export const DEFAULT_MIX=Object.freeze({music:65,effects:85,engine:40});
export function validateMix(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==3||
    !Object.keys(DEFAULT_MIX).every(k=>Number.isInteger(value[k])&&value[k]>=0&&value[k]<=100))throw new TypeError('Invalid audio levels');
  return Object.freeze({...value});
}
export class Sound {
  constructor(){
    Object.assign(this,{enabled:true,failed:false,context:null,music:null,active:'',preview:null,previewToken:0,
      anchor:null,pack:null,seed:null,mix:DEFAULT_MIX});
    this.effects=new Set();this.tracks=new Map();this.buffers=new Map();this.loops=new Map();this.retiring=new Set();
  }
  fail(error){this.failed=true;this.stop();console.warn('Outruin audio unavailable for this session:',error);}
  async unlock(){
    if(!this.enabled)return false;this.failed=false;
    try{
      const AC=globalThis.AudioContext||globalThis.webkitAudioContext;if(!this.context&&!AC)return false;
      if(!this.context){
        this.context=new AC();
        try{
          this.master=this.context.createGain();this.master.gain.value=.65;
          if(this.context.createDynamicsCompressor){const limiter=this.context.createDynamicsCompressor();limiter.threshold.value=-10;limiter.knee.value=12;limiter.ratio.value=5;this.master.connect(limiter);limiter.connect(this.context.destination);}
          else this.master.connect(this.context.destination);
          this.buses={};for(const name of Object.keys(DEFAULT_MIX)){const bus=this.context.createGain();bus.connect(this.master);this.buses[name]=bus;}
          this.applyMix();
        }catch(error){try{Promise.resolve(this.context.close()).catch(()=>{});}catch{}this.context=null;this.master=null;this.buses=null;throw error;}
      }
      await this.context.resume();return this.context.state==='running';
    }catch(error){this.fail(error);return false;}
  }
  applyMix(){if(!this.buses)return;const t=this.context.currentTime;
    for(const [key,bus] of Object.entries(this.buses)){const scale=key==='music'?.50:key==='engine'?.35:.85;bus.gain.setTargetAtTime(this.mix[key]/100*scale,t,.02);}
  }
  setMix(value){this.mix=validateMix(value);try{this.applyMix();if(!this.mix.music)this.stopMusic();if(!this.mix.engine)this.stopLoops();if(!this.mix.effects)this.stopEffects();}catch(error){this.fail(error);}}
  setEnabled(value){this.enabled=Boolean(value);if(!value)this.stop();}
  disposeVoice(voice){
    if(!voice)return;if(voice.source)voice.source.onended=null;
    try{voice.source?.stop();}catch{}
    for(const node of [voice.source,voice.gain,voice.pan])try{node?.disconnect();}catch{}
    this.effects.delete(voice);this.retiring.delete(voice);
  }
  stopMusic(){try{this.music?.dispose();}catch{}this.music=null;this.active='';}
  stopEffects(){for(const voice of [...this.effects])this.disposeVoice(voice);}
  stopLoops(){for(const voice of [...this.loops.values(),...this.retiring])this.disposeVoice(voice);this.loops.clear();this.retiring.clear();}
  stopPreview(){this.previewToken++;this.disposeVoice(this.preview);this.preview=null;}
  stopGame(){this.stopMusic();this.stopEffects();this.stopLoops();this.anchor=null;}
  stop(){this.stopGame();this.stopPreview();}
  buffer(key,compile){
    if(this.buffers.has(key)){const b=this.buffers.get(key);this.buffers.delete(key);this.buffers.set(key,b);return b;}
    const score=compile(),pcm=score.renderAll(),b=this.context.createBuffer(1,pcm.length,AUDIO2D_RATE);
    const out=b.getChannelData(0);for(let i=0;i<pcm.length;i++)out[i]=pcm[i]/32768;
    if(this.buffers.size>=64)this.buffers.delete(this.buffers.keys().next().value);this.buffers.set(key,b);return b;
  }
  voice(buffer,bus,{pan=0,loop=false,gain=1,when=this.context.currentTime,offset=0}={}){
    const voice={source:null,gain:null,pan:null};
    try{
      const source=voice.source=this.context.createBufferSource(),level=voice.gain=this.context.createGain();
      source.buffer=buffer;source.loop=loop;level.gain.setValueAtTime(gain,this.context.currentTime);source.connect(level);
      if(this.context.createStereoPanner){const panner=voice.pan=this.context.createStereoPanner();panner.pan.value=pan;level.connect(panner);panner.connect(bus);}
      else level.connect(bus);
      source.onended=()=>this.disposeVoice(voice);source.start(when,offset);return voice;
    }catch(error){this.disposeVoice(voice);throw error;}
  }
  bindRun(s){
    if(this.pack===s.pack&&this.seed===s.seed)return;
    this.stopGame();this.tracks.clear();this.pack=s.pack;this.seed=s.seed;
  }
  align(tick){
    const now=this.context.currentTime;
    if(!this.anchor||tick<this.anchor.tick||Math.abs((tick-this.anchor.tick)/60-(now-this.anchor.time))>.12)this.anchor={tick,time:now+.04};
    return this.anchor.time+(tick-this.anchor.tick)/60;
  }
  playEvents(events,s){
    if(!this.enabled||this.failed||!this.mix.effects||this.context?.state!=='running')return;
    try{
      this.bindRun(s);this.align(s.tick);
      for(const event of events){const d=describeEffect(event,s);if(!d)continue;
        const buffer=this.buffer(d.kind+':'+d.variant,()=>compileEffect(d.kind,d.variant));
        const intended=this.anchor.time+(d.tick-this.anchor.tick)/60,now=this.context.currentTime,offset=Math.max(0,now-intended);
        if(offset>=buffer.duration)continue;
        if(this.effects.size>=12)this.disposeVoice(this.effects.values().next().value);
        const voice=this.voice(buffer,this.buses.effects,{pan:d.pan,when:Math.max(now,intended),offset});this.effects.add(voice);
      }
    }catch(error){this.fail(error);}
  }
  event(e,s){if(s)this.playEvents([e],s);}
  loop(name,key,compile,tick,level){
    const current=this.loops.get(name);if(current?.key===key)return;
    if(current){this.loops.delete(name);current.gain.gain.setTargetAtTime(0,this.context.currentTime,.012);current.source.stop(this.context.currentTime+.05);this.retiring.add(current);
      if(this.retiring.size>6)this.disposeVoice(this.retiring.values().next().value);}
    if(!key)return;
    const buffer=this.buffer(key,compile),voice=this.voice(buffer,this.buses.engine,{loop:true,gain:0,offset:(tick*800%buffer.length)/AUDIO2D_RATE});
    voice.key=key;voice.gain.gain.setTargetAtTime(level,this.context.currentTime,.025);this.loops.set(name,voice);
  }
  sync(s,paused=false){
    if(!this.enabled||this.failed){this.stop();return;}
    if(this.context?.state!=='running'){this.stopGame();return;}
    if(paused){this.stopGame();return;}
    try{
      this.bindRun(s);
      if(!['road','foot'].includes(s.mode)){this.stopMusic();this.stopLoops();this.anchor=null;return;}
      this.align(s.tick);
      const arrangement=s.mode==='foot'?'foot':s.bossSpawned&&!s.bossDefeated?'boss':'road',region=arrangement==='road'?s.sector%3:0,key=arrangement+':'+region;
      if(this.mix.music){
        if(this.active!==key){this.stopMusic();
          if(!this.tracks.has(key))this.tracks.set(key,compileSoundtrack(s.pack,s.seed,arrangement,region));
          const context=this.context,bus=this.buses.music;
          this.music=createSoundtrackPlayer({get state(){return context.state;},get currentTime(){return context.currentTime;},destination:bus,
            createBuffer:(...args)=>context.createBuffer(...args),createBufferSource:()=>context.createBufferSource()},this.tracks.get(key));this.active=key;
        }
        this.music.sync(s.tick);
      }else this.stopMusic();
      if(s.mode==='road'&&this.mix.engine&&s.fuel>0){
        const band=Math.max(0,Math.min(7,Math.floor(s.speed/s.pack.vehicle.topSpeed*7)));
        this.loop('motor','engine:'+band,()=>compileEngine(band),s.tick,1);
        const boost=(s.lastMask&32)&&(s.lastMask&4)&&s.boost>0&&!s.boostLocked;
        this.loop('boost',boost?'boost:0':null,()=>compileEffect('boost'),s.tick,.9);
        const skid=s.speed>220&&(Math.abs(s.x)>1000||s.slip>3||((s.lastMask&8)&&Math.abs(s.vx)>1));
        this.loop('skid',skid?'skid:0':null,()=>compileEffect('skid'),s.tick,.7);
      }else this.stopLoops();
    }catch(error){this.fail(error);}
  }
  async audition(score){
    this.stopPreview();const token=this.previewToken;
    if(!await this.unlock()||token!==this.previewToken||!this.enabled)return false;
    try{
      const pcm=score.renderRange(0,score.frames),buffer=this.context.createBuffer(1,pcm.length,AUDIO2D_RATE),data=buffer.getChannelData(0);
      for(let i=0;i<pcm.length;i++)data[i]=pcm[i]/32768;
      const voice=this.voice(buffer,this.master,{gain:.55});this.preview=voice;
      voice.source.onended=()=>{if(this.preview===voice)this.preview=null;this.disposeVoice(voice);};return true;
    }catch(error){this.fail(error);return false;}
  }
  snapshot(){return {enabled:this.enabled,failed:this.failed,mix:{...this.mix},effectVoices:this.effects.size,loops:this.loops.size,
    retiring:this.retiring.size,buffers:this.buffers.size,tracks:this.tracks.size,preview:!!this.preview,active:this.active,music:this.music?.snapshot()??null};}
}
