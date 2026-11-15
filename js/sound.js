// SPDX-License-Identifier: Apache-2.0
// Original four-lane score. Integer PCM comes from VANILLAJS audio2d.
// OPT-INV-001: reuse only when the immutable music recipe + seed + arrangement match.
import {createSound2D,AUDIO2D_RATE} from '../vendor/vanillajs/modules/audio2d/index.js';
import {DEFAULT_PACK} from './mod.js';
import {createSoundtrack} from '../vendor/vanillajs/modules/soundtrack/index.js';
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
export function compileSoundtrack(pack=DEFAULT_PACK,seed=1988,arrangement='road'){
  return createSoundtrack({phrases:Array.from({length:4},(_,variation)=>{
    const score=compileScore(pack,(seed+variation*313)>>>0,arrangement,variation);
    return {frames:Math.ceil(score.frames/800)*800,events:score.eventSummary()};
  })});
}
export class Sound {
  constructor(){this.enabled=true;this.context=null;this.music=null;this.active='';this.effects=new Set();this.tracks=new Map();this.failed=false;}
  fail(error){
    this.failed=true;this.stop();console.warn('Outruin audio unavailable for this session:',error);
    // Enabled is the saved preference. A failed device never rewrites it.
  }
  async unlock(){
    if(!this.enabled)return;this.failed=false;
    try{
      const AC=globalThis.AudioContext||globalThis.webkitAudioContext;if(!AC)return;
      if(!this.context){this.context=new AC();this.master=this.context.createGain();this.master.gain.value=.32;this.master.connect(this.context.destination);}
      await this.context.resume();
    }catch(error){this.fail(error);}
  }
  stop(){
    try{this.music?.dispose();}catch{}this.music=null;this.active='';
    for(const source of this.effects){try{source.stop();source.disconnect();}catch{}}this.effects.clear();
  }
  setEnabled(value){this.enabled=value;if(!value)this.stop();}
  sync(s,paused=false){
    if(!this.enabled||this.failed||!this.context||this.context.state!=='running'||paused||!['road','foot'].includes(s.mode)){this.stop();return;}
    try{
      const arrangement=s.mode==='foot'?'foot':s.bossSpawned&&!s.bossDefeated?'boss':'road';
      if(this.pack!==s.pack||this.seed!==s.seed){this.stop();this.music?.dispose();this.music=null;this.tracks.clear();this.pack=s.pack;this.seed=s.seed;}
      if(this.active!==arrangement){
        this.music?.dispose();this.music=null;this.active=arrangement;
        if(!this.tracks.has(arrangement))this.tracks.set(arrangement,compileSoundtrack(s.pack,s.seed,arrangement));
        const context=this.context,master=this.master;
        this.music=createSoundtrackPlayer({get state(){return context.state;},get currentTime(){return context.currentTime;},destination:master,
          createBuffer:(...args)=>context.createBuffer(...args),createBufferSource:()=>context.createBufferSource()},this.tracks.get(arrangement));
      }
      this.music.sync(s.tick);
    }catch(error){this.fail(error);}
  }
  event(e){
    if(!this.enabled||this.failed||!this.context||this.context.state!=='running'||this.effects.size>=12)return;
    try{
      const types={shot:[95,.05,'sawtooth',.08],hit:[65,.13,'square',.16],explode:[44,.32,'sawtooth',.15],pickup:[660,.12,'triangle',.17],'enemy-shot':[140,.08,'square',.07]};
      const spec=types[e.type];if(!spec)return;
      const [pitch,duration,wave,volume]=spec,t=this.context.currentTime,osc=this.context.createOscillator(),gain=this.context.createGain();
      osc.type=wave;osc.frequency.setValueAtTime(pitch,t);osc.frequency.exponentialRampToValueAtTime(Math.max(30,pitch*.45),t+duration);
      gain.gain.setValueAtTime(volume,t);gain.gain.exponentialRampToValueAtTime(.001,t+duration);osc.connect(gain);gain.connect(this.master);
      this.effects.add(osc);osc.onended=()=>{this.effects.delete(osc);osc.disconnect();gain.disconnect();};osc.start(t);osc.stop(t+duration);
    }catch(error){this.fail(error);}
  }
}
