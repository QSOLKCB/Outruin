// SPDX-License-Identifier: Apache-2.0
// Original, bounded, eight-phrase score. Only authored data and integer seeds
// reach VANILLAJS; Web Audio scheduling never chooses a note or noise sample.
import {createSoundtrack} from '../vendor/vanillajs/modules/soundtrack/index.js';
import {DEFAULT_PACK} from './mod.js';
export const RADIO_VERSION='outruin.radio.v2';
export const RADIO_MIXES=Object.freeze([
  Object.freeze({id:'rust',label:'Rust / Dead Air',arrangement:'road',sector:0}),
  Object.freeze({id:'salt',label:'Salt / White Noise',arrangement:'road',sector:1}),
  Object.freeze({id:'glass',label:'Glass / Last Light',arrangement:'road',sector:2}),
  Object.freeze({id:'outpost',label:'Outpost / Static Shelter',arrangement:'foot',sector:0}),
  Object.freeze({id:'war-rig',label:'War Rig / Redline',arrangement:'boss',sector:0})
]);
export function composeRadio(pack=DEFAULT_PACK,seed=1988,arrangement='road',sector=0){
  if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw new RangeError('Invalid radio seed');
  if(!['road','foot','boss'].includes(arrangement)||!Number.isInteger(sector)||sector<0||sector>7)throw new RangeError('Invalid radio arrangement');
  const m=pack.music,foot=arrangement==='foot',boss=arrangement==='boss',region=arrangement==='road'?sector%3:0;
  const tempo=foot?Math.max(80,m.tempo-24):boss?Math.min(160,m.tempo+20):m.tempo;
  // Each phrase is two bars. Eight phrases form intro / drive / reply / fill /
  // breakdown / build / drive / turnaround. Every boundary is an integer tick.
  return createSoundtrack({phrases:Array.from({length:8},(_,phrase)=>{
    const boundary=i=>Math.round(i*1800/tempo)*800,frames=boundary(16),events=[];
    const add=(sample,duration,channel,frequency,wave,gain)=>{
      if(gain<=0||duration<=0)return;
      events.push({id:events.length+1,sample,duration:Math.min(duration,frames-sample),channel,
        frequency:Math.max(30,Math.min(8000,Math.round(frequency))),wave,gain:Math.max(0,Math.min(12000,Math.round(gain))),
        seed:(seed^Math.imul(phrase+1,0x45d9f3b)^Math.imul(events.length+1,0x9e3779b9)^Math.imul(region+1,313))>>>0});
    };
    for(let i=0;i<16;i++){
      const start=boundary(i),step=boundary(i+1)-start,breakdown=phrase===4,fill=(phrase===3||phrase===7)&&i>=12;
      const melody=m.melody[(i+phrase*2+region*4)%16],note=m.scale[(melody+region)%8];
      const lead=foot?i%4===0:breakdown?i%4===0:phrase===0?i%2===0:true;
      if(lead)add(start,Math.floor(step*(foot?.92:.63)),0,note*((boss&&phrase>=5&&i%4===3)?2:1),foot?'triangle':m.wave,m.gain*(breakdown?.48:phrase===0?.65:.88));
      const bass=m.bass[(Math.floor(i/4)+Math.floor(phrase/2)+region)%4];
      if(!foot||i%2===0)add(start,Math.floor(step*.78),1,bass*(region===1&&i%4===3?2:1),boss?'saw':'triangle',m.gain*(foot?.80:1.22));
      const snare=i%4===2;
      if(!foot||i%2===0)add(start,Math.min(step,Math.round(snare?4800:fill?1600:850)),2,snare?180:5200,'noise',m.gain*(snare?.72:fill?.30:.13));
      if((i%4===0&&!breakdown)||(boss&&i%4===3)||(fill&&i%2===0)){
        add(start,720,3,110,'triangle',m.gain*1.75);
        add(start+720,1440,3,65,'triangle',m.gain*1.45);
        add(start+2160,Math.min(step-2160,3800),3,42,'triangle',m.gain*.95);
      }
    }
    return {frames,events};
  })});
}
