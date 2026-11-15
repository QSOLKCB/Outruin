// SPDX-License-Identifier: Apache-2.0
import fs from 'node:fs';import os from 'node:os';import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {compileScore,createScoreCache} from '../js/sound.js';import {DEFAULT_PACK} from '../js/mod.js';
const cache=createScoreCache();for(const mode of ['road','foot','boss'])assert.deepEqual(cache.get(DEFAULT_PACK,1988,mode).renderAll(),compileScore(DEFAULT_PACK,1988,mode).renderAll());
const rounds=[];const count=500;
for(let r=0;r<5;r++){
  let checksum=0,t=performance.now();for(let i=0;i<count;i++)checksum+=compileScore(DEFAULT_PACK,1988,'road').eventCount;const cold=performance.now()-t;
  t=performance.now();for(let i=0;i<count;i++)checksum+=cache.get(DEFAULT_PACK,1988,'road').eventCount;const reused=performance.now()-t;
  rounds.push({requests:count,compileMs:cold,reuseMs:reused,checksum});
}
const receipt={scope:'score compilation requests only; excludes PCM rendering, playback, gameplay and startup',parity:'PASS',node:process.version,cpu:os.cpus()[0]?.model,rounds};
fs.mkdirSync('evidence',{recursive:true});fs.writeFileSync('evidence/opt-score.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt,null,2));
