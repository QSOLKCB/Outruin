// SPDX-License-Identifier: Apache-2.0
// Layered PCM16 effects and engine loops, rendered by VANILLAJS audio2d.
import {createSound2D,AUDIO2D_RATE} from '../vendor/vanillajs/modules/audio2d/index.js';
export const SFX_VERSION='outruin.sfx.v1';
export const EFFECTS=Object.freeze({forward:'Forward repeater',side:'Side breach gun',carbine:'Salvage carbine',enemy:'Raider cannon',
  hit:'Armour impact',explode:'Vehicle explosion',fuel:'Fuel recovered',ammo:'Ammo recovered',repair:'Repair supplies',scrap:'Salvage chime',
  relay:'Relay arrival',outpost:'Outpost radio',boss:'War rig warning',step:'Footstep',boost:'Boost turbine',skid:'Tyre scrub'});
const seed32=n=>{if(!Number.isInteger(n)||n<0||n>0xffffffff)throw new RangeError('Invalid sound seed');return n;};
export function effectVariant(seed,tick,kind){
  seed32(seed);if(!Number.isSafeInteger(tick)||tick<0)throw new RangeError('Invalid sound tick');
  if(!Object.hasOwn(EFFECTS,kind))throw new RangeError('Unknown effect');
  let h=seed^Math.imul(tick+1,0x45d9f3b);for(const ch of kind)h=Math.imul(h^ch.charCodeAt(0),16777619);return (h>>>0)%4;
}
export function compileEffect(kind,variant=0){
  if(!Object.hasOwn(EFFECTS,kind)||!Number.isInteger(variant)||variant<0||variant>3)throw new RangeError('Invalid effect recipe');
  const events=[],pitch=1+(variant-1)*.025;
  const add=(ms,length,channel,hz,wave,gain)=>events.push({id:events.length+1,sample:Math.round(ms*48),duration:Math.round(length*48),channel,
    frequency:Math.max(30,Math.min(8000,Math.round(hz*pitch))),wave,gain,seed:(0x5188^Math.imul(variant+1,7919)^Math.imul(events.length+1,313))>>>0});
  if(['forward','side','carbine','enemy'].includes(kind)){
    const heavy=kind==='side',hostile=kind==='enemy';
    add(0,heavy?210:80,0,4000,'noise',heavy?8200:6500);
    add(0,28,1,heavy?100:hostile?220:150,'triangle',9000);add(28,heavy?190:90,1,heavy?46:hostile?90:65,'triangle',6500);
    add(0,18,2,kind==='carbine'?1400:720,'square',2200);add(30,55,2,330,'triangle',1700);
    if(heavy)add(22,160,3,260,'noise',2700);
  }else if(kind==='hit'){
    add(0,160,0,3000,'noise',7000);add(0,60,1,180,'square',4200);add(60,150,1,65,'triangle',3900);
    add(0,90,2,630,'triangle',3000);add(22,120,3,970,'triangle',1600);
  }else if(kind==='explode'){
    add(0,620,0,1200,'noise',9000);add(0,60,1,95,'triangle',10000);add(60,680,1,39,'triangle',8000);
    add(65,340,2,2600,'noise',3000);add(120,480,3,63,'saw',2400);
  }else if(kind==='step'){
    add(0,55,0,1600,'noise',2300);add(0,45,1,90,'triangle',1700);
  }else if(kind==='boost'||kind==='skid'){
    for(let i=0;i<16;i++){const start=i*62.5;add(start,62.5,0,kind==='boost'?3500:6200,'noise',kind==='boost'?2000:1100);
      add(start,62.5,1,kind==='boost'?180+i%4*20:750+i%3*110,'triangle',kind==='boost'?1700:1000);}
  }else{
    const notes={fuel:[330,440,660],ammo:[660,440,880],repair:[392,494,587,784],scrap:[880,1174,1568],
      relay:[262,330,392,523,784],outpost:[392,294,262],boss:[110,110,82,82]}[kind];
    const spacing=kind==='boss'?180:kind==='relay'?105:80;
    notes.forEach((note,i)=>{add(i*spacing,spacing,0,note,kind==='boss'?'saw':'triangle',kind==='boss'?5800:5400);
      add(i*spacing,spacing,1,Math.round(note/2),'triangle',2700);});
    if(kind==='ammo')add(0,35,2,3400,'noise',2400);
  }
  const frames=Math.max(...events.map(e=>e.sample+e.duration));return createSound2D({frames,events});
}
export function compileEngine(band=0){
  if(!Number.isInteger(band)||band<0||band>7)throw new RangeError('Invalid engine band');
  const events=[],strokes=16+band*8;
  for(let i=0;i<strokes;i++){
    const start=Math.floor(i*AUDIO2D_RATE/strokes),end=Math.floor((i+1)*AUDIO2D_RATE/strokes);
    const add=(channel,frequency,wave,gain)=>events.push({id:events.length+1,sample:start,duration:end-start,channel,frequency,wave,gain,seed:(1988+i*313)>>>0});
    add(0,55+band*18,'triangle',5000);
    if(i%2===0)add(1,1500,'noise',850+band*70);
    if(i%4===0)add(2,110+band*36,'saw',1000);
  }
  return createSound2D({frames:AUDIO2D_RATE,events});
}
// Event descriptors do not use the frame time, audio device, or gameplay RNG.
export function describeEffect(event,state){
  let kind;
  if(event.type==='shot')kind=event.space==='foot'?'carbine':event.side?'side':'forward';
  else if(event.type==='enemy-shot')kind='enemy';
  else if(event.type==='pickup')kind=({fuel:'fuel',ammo:'ammo',health:'repair',repair:'repair',scrap:'scrap'})[event.kind]??'scrap';
  else kind=({hit:'hit',explode:'explode',outpost:'outpost',depot:'relay',boss:'boss',step:'step'})[event.type];
  if(!kind)return null;
  const tick=event.tick??state.tick;
  const pan=event.side?event.side*.75:Number.isFinite(event.x)?Math.max(-.85,Math.min(.85,(event.x-(event.listenerX??(event.space==='foot'?(state.foot?.x??0):state.x)))/1000)):0;
  return Object.freeze({kind,variant:effectVariant(state.seed,tick,kind),tick,pan});
}
