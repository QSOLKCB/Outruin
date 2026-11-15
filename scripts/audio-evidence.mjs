// SPDX-License-Identifier: Apache-2.0
// Reproducible reference-byte identities; no audio device or clock is involved.
import fs from 'node:fs';import {createHash} from 'node:crypto';
import {composeRadio,RADIO_MIXES,RADIO_VERSION} from '../js/radio.js';
import {compileEffect,compileEngine,EFFECTS,SFX_VERSION} from '../js/sfx.js';
import {DEFAULT_PACK,serializePack} from '../js/mod.js';
const hash=data=>createHash('sha256').update(data).digest('hex');
const sourceFiles=['js/radio.js','js/sfx.js','js/mod.js','vendor/vanillajs/modules/audio2d/index.js','vendor/vanillajs/modules/soundtrack/index.js','scripts/audio-evidence.mjs'];
const describe=score=>{
  const wav=score.wav(),view=new DataView(wav.buffer,wav.byteOffset,wav.byteLength);let peak=0,clipped=0,squared=0;
  for(let i=44;i<wav.length;i+=2){const value=view.getInt16(i,true);peak=Math.max(peak,Math.abs(value));squared+=value*value;if(value===32767||value===-32768)clipped++;}
  return {frames:score.frames,seconds:score.frames/48000,wavBytes:wav.length,wavSHA256:hash(wav),peak,clippedSamples:clipped,rms:Math.round(Math.sqrt(squared/score.frames))};
};
const receipt={kind:'outruin.audio-evidence.v1',radioVersion:RADIO_VERSION,sfxVersion:SFX_VERSION,seed:1988,
  format:'48000 Hz mono PCM16LE WAV',packSHA256:hash(serializePack(DEFAULT_PACK)),
  sources:Object.fromEntries(sourceFiles.map(file=>[file,hash(fs.readFileSync(new URL('../'+file,import.meta.url)))])),
  radio:RADIO_MIXES.map(mix=>({...mix,...describe(composeRadio(DEFAULT_PACK,1988,mix.arrangement,mix.sector))})),
  effects:Object.keys(EFFECTS).flatMap(kind=>Array.from({length:4},(_,variant)=>({kind,variant,...describe(compileEffect(kind,variant))}))),
  engines:Array.from({length:8},(_,band)=>({band,...describe(compileEngine(band))}))};
fs.mkdirSync('evidence',{recursive:true});fs.writeFileSync('evidence/audio-pcm.json',JSON.stringify(receipt,null,2)+'\n');
console.log(`Recorded ${receipt.radio.length} complete scores, ${receipt.effects.length} effect variants and ${receipt.engines.length} engine loops in evidence/audio-pcm.json`);
