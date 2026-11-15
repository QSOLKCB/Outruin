// SPDX-License-Identifier: Apache-2.0
import {FixedClock} from '../vendor/vanillajs/modules/time/index.js';
import {createGame,command,runRecord,snapshot} from './sim.js';
import {DEFAULT_PACK,parsePack,serializePack,packFingerprint} from './mod.js';
import {Renderer} from './render.js';
import {Sound,compileSoundtrack,DEFAULT_MIX} from './sound.js';
import {RADIO_MIXES} from './radio.js';
import {EFFECTS,compileEffect,effectVariant} from './sfx.js';
import {Controls,ACTIONS,PROFILES,validBindings} from './input.js';
import {advanceFrame} from './frame.js';
import {Display} from './display.js';
const $=id=>document.getElementById(id);
const read=key=>{try{return localStorage.getItem('outruin.'+key);}catch{return null;}};
const save=(key,value)=>{try{localStorage.setItem('outruin.'+key,value);}catch{/* Optional persistence must not stop a run. */}};
let pack=DEFAULT_PACK,importToken=0;
try{const stored=read('pack');if(stored)pack=parsePack(stored);}catch{ $('menu-error').textContent='Saved mod could not be loaded. Original campaign restored.'; }
let state=createGame({pack}),started=false,paused=false,last=0,uiAt=0,lastMode='road',resultRecorded=false;
let renderedShopPack=null;
const renderer=new Renderer($('game')),sound=new Sound(),clock=new FixedClock({step:1/60,maxFrame:.1,maxSteps:6});
const dialogs=()=>document.querySelector('dialog[open]')!==null;
const controls=new Controls({playing:()=>started&&['road','foot'].includes(state.mode)&&!dialogs(),
  onPause:force=>togglePause(force===true?true:!paused),onPad:name=>$('pad-status').textContent=name,onBinding:()=>{save('bindings',JSON.stringify(controls.custom));renderBindings();$('binding-status').textContent='Binding saved. Release controls before resuming.';}});
const oldProfile=read('profile');if(oldProfile==='snes')controls.profile='snes';$('profile').value=controls.profile;
try{const bindings=JSON.parse(read('bindings'));if(validBindings(bindings))controls.custom=bindings;}catch{}
sound.setEnabled(read('sound')!=='off');updateSound();
try{const stored=JSON.parse(read('mix'));if(stored)sound.setMix(stored);}catch{}
for(const name of Object.keys(DEFAULT_MIX)){const input=$('mix-'+name),output=$('mix-'+name+'-value');input.value=sound.mix[name];output.value=sound.mix[name]+'%';
  input.addEventListener('input',()=>{sound.setMix({...sound.mix,[name]:Number(input.value)});output.value=input.value+'%';save('mix',JSON.stringify(sound.mix));});}
for(const mix of RADIO_MIXES){const option=document.createElement('option');option.value=mix.id;option.textContent=mix.label;$('radio-mix').append(option);}
for(const [id,label] of Object.entries(EFFECTS)){const option=document.createElement('option');option.value=id;option.textContent=label;$('effect-mix').append(option);}
$('touch-toggle').checked=read('touch')==='on';document.body.classList.toggle('show-touch',$('touch-toggle').checked);
const display=new Display({select:$('display-mode'),button:$('fullscreen'),feedback:$('display-status'),initial:read('display'),
  save:mode=>save('display',mode),onChange:()=>{clear();sound.stop();if(started&&['road','foot'].includes(state.mode))togglePause(true);}});
function download(name,blob){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function clear(){controls.clear();clock.reset();clock.presentation=null;clock.renderAlpha=1;last=0;}
function updateSound(){$('sound').textContent=sound.enabled?'SOUND ON':'SOUND OFF';$('sound').setAttribute('aria-pressed',String(sound.enabled));}
function togglePause(value){
  if(!started||!['road','foot'].includes(state.mode))return;
  paused=value;clear();clock.setPaused(paused);sound.stop();updateUI();if(!paused){sound.unlock();$('game').focus({preventScroll:true});}else $('resume').focus({preventScroll:true});
}
function start(){
  if(!$('seed').checkValidity()||$('seed').value===''){$('menu-error').textContent='Choose a whole-number seed from 0 to 4294967295.';return;}
  try{state=createGame({seed:Number($('seed').value),difficulty:$('difficulty').value,pack});}catch(e){$('menu-error').textContent=e.message;return;}
  started=true;paused=false;lastMode='road';resultRecorded=false;clear();clock.setPaused(false);sound.stop();sound.unlock();
  document.body.classList.add('playing');display.refresh();$('menu-error').textContent='';updateUI();$('game').focus({preventScroll:true});
}
function garage(){started=false;paused=false;sound.stop();clear();state=createGame({pack});document.body.classList.remove('playing');updateUI();$('start').focus({preventScroll:true});}
function updatePackUI(){
  $('pack-label').textContent='CAMPAIGN / '+pack.name.toUpperCase()+' / '+packFingerprint(pack);
  document.querySelector('.brief').textContent=pack.description;
  document.querySelector('.route-line').textContent=pack.sectors.map((s,i)=>`${String(i+1).padStart(2,'0')} — ${s.short.toUpperCase()}`).join('\n');
  for(const opt of $('difficulty').options)opt.textContent=pack.difficulties[opt.value].label.toUpperCase()+' / '+pack.difficulties[opt.value].description;
}
function updateUI(){
  $('menu').hidden=started;$('paused').hidden=!started||!paused||dialogs();$('depot').hidden=!started||state.mode!=='depot';$('result').hidden=!started||!['won','lost'].includes(state.mode);
  $('pause').disabled=!started||!['road','foot'].includes(state.mode);$('pause').textContent=paused?'RESUME ▶':'PAUSE II';
  const fuel=Math.ceil(state.fuel/state.pack.vehicle.fuelCapacity*100),boost=Math.round(state.boost/10);
  $('hull').textContent=state.mode==='foot'?state.health+' HP':state.hull;$('hull-meter').max=state.mode==='foot'?100:state.pack.vehicle.armour;
  $('hull-meter').value=state.mode==='foot'?state.health:state.hull;$('fuel').textContent=fuel+'%';$('fuel-meter').value=fuel;
  $('ammo').textContent=String(state.ammo).padStart(3,'0');$('scrap').textContent=String(state.scrap).padStart(3,'0');$('boost').textContent=boost+'%';$('boost-meter').value=boost;$('score').textContent=String(state.score).padStart(6,'0');
  const objective=!started?'A machine. A signal. One last run to the coast.':paused?'Paused. Your supplies and the signal are safe.':
    state.mode==='foot'?(state.tick<state.noticeUntil?state.notice:'Walk to supplies. E / F to search. J to jump. Return to your car with E.'):
    state.mode==='depot'?'Repair, refuel, and choose your route to the next region.':state.mode==='won'||state.mode==='lost'?state.reason:
    state.tick<state.noticeUntil?state.notice:`${state.pack.sectors[state.sector].name} / Hold W or ↑ to drive. Space fires forward. Q / C fire to the sides.`;
  if($('objective').textContent!==objective)$('objective').textContent=objective;
  if(state.mode==='depot'){const signature=[state.sector,state.scrap,state.engine,state.gun,state.hull,state.fuel,state.ammo].join(':');if(renderedShopPack!==state.pack||$('shop').dataset.signature!==signature){renderedShopPack=state.pack;$('shop').dataset.signature=signature;renderShop();}}
  if(['won','lost'].includes(state.mode)&&!resultRecorded){
    resultRecorded=true;sound.stop();const won=state.mode==='won';$('result-tag').textContent=won?'TRANSMISSION RECEIVED':'SIGNAL LOST';
    $('result-title').textContent=won?'You made it through.':'The road remembers.';$('result-reason').textContent=state.reason;
    $('result-stats').textContent=`${state.score.toLocaleString()} POINTS · ${state.kills} TAKEDOWNS · ${(state.total/1000000).toFixed(1)} KM`;
    const key='best.'+packFingerprint(pack)+'.'+state.difficulty,previous=Number(read(key))||0;if(state.score>previous)save(key,String(state.score));
    $('again').focus({preventScroll:true});
  }
}
function renderShop(){
  const grid=$('shop');grid.replaceChildren();
  const names={repair:'HULL REPAIR',fuel:'FUEL DRUMS',ammo:'AMMUNITION',engine:'ENGINE TUNE',gun:'TWIN FEED'};
  for(const [key,item] of Object.entries(state.pack.shop)){
    const b=document.createElement('button');b.dataset.buy=key;b.textContent=names[key];
    const d=document.createElement('small');d.textContent=item.cost+' SCRAP / '+(key==='fuel'?Math.round(item.amount/1000)+' FUEL':key==='engine'?'+'+item.amount+'% SPEED':key==='gun'?'+'+item.amount+' DAMAGE':'+'+item.amount);b.append(d);
    b.disabled=state.scrap<item.cost||(key==='engine'&&Boolean(state.engine))||(key==='gun'&&Boolean(state.gun));
    b.addEventListener('click',()=>{if(command(state,'buy',key)){sound.event({type:'pickup',kind:key,tick:state.tick,space:'ui'},state);renderShop();updateUI();}});grid.append(b);
  }
}
function nextRoute(route){if(command(state,'route',route)){clear();paused=false;clock.setPaused(false);lastMode=state.mode;updateUI();$('game').focus({preventScroll:true});}}
function showDialog(id){if(started&&['road','foot'].includes(state.mode))togglePause(true);clear();sound.stop();$(id).showModal();updateUI();}
for(const d of document.querySelectorAll('dialog'))d.addEventListener('close',()=>{importToken++;sound.stopPreview();controls.cancelBind();clear();updateUI();});
for(const d of document.querySelectorAll('dialog'))d.addEventListener('cancel',()=>sound.stopPreview());
for(const button of document.querySelectorAll('[data-close]'))button.addEventListener('click',()=>{sound.stopPreview();$(button.dataset.close).close();});
$('start').onclick=start;$('again').onclick=start;$('restart').onclick=start;$('garage').onclick=garage;$('result-garage').onclick=garage;
$('pause').onclick=()=>togglePause(!paused);$('resume').onclick=()=>togglePause(false);
$('highway').onclick=()=>nextRoute('highway');$('canyon').onclick=()=>nextRoute('canyon');
$('sound').onclick=()=>{sound.setEnabled(!sound.enabled);save('sound',sound.enabled?'on':'off');updateSound();if(sound.enabled)sound.unlock();};
$('settings').onclick=()=>{showDialog('controls-dialog');renderBindings();};
$('touch-toggle').onchange=()=>{document.body.classList.toggle('show-touch',$('touch-toggle').checked);save('touch',$('touch-toggle').checked?'on':'off');};
$('profile').onchange=()=>{controls.profile=$('profile').value;controls.custom=null;controls.cancelBind();controls.clear();save('profile',controls.profile);save('bindings','null');renderBindings();};
$('reset-bindings').onclick=()=>{controls.custom=null;controls.cancelBind();controls.clear();save('bindings','null');renderBindings();$('binding-status').textContent='Profile reset.';};
function renderBindings(){const container=$('bindings');container.replaceChildren();const bindings=controls.custom??PROFILES[controls.profile];
  for(const action of ACTIONS){const button=document.createElement('button');button.textContent=action.toUpperCase();const val=document.createElement('span'),b=bindings[action];val.textContent=b.button!==undefined?'BTN '+b.button:'AXIS '+b.axis+(b.sign>0?' +':' −');button.append(val);
    button.onclick=()=>{controls.bind(action);$('binding-status').textContent='Release the pad, then press a button or move an axis for '+action+'.';};container.append(button);}}
$('journal').onclick=()=>download('outruin-run-'+state.seed+'.json',new Blob([JSON.stringify(runRecord(state))],{type:'application/json'}));
function fillWorkshop(p){sound.stopPreview();$('pack-source').value=serializePack(p);$('edit-name').value=p.name;$('edit-car').value=p.vehicle.name;$('edit-color').value=p.vehicle.color;$('edit-speed').value=Math.round(p.vehicle.topSpeed*.216);}
$('workshop').onclick=()=>{importToken++;$('example-pack').value='';fillWorkshop(pack);$('mod-status').textContent='Edit any value, then validate and apply.';showDialog('workshop-dialog');};
$('default-pack').onclick=()=>{importToken++;fillWorkshop(DEFAULT_PACK);$('mod-status').textContent='Original pack loaded into the editor. Apply to activate.';};
$('quick-apply').onclick=()=>{importToken++;try{const draft=JSON.parse($('pack-source').value);draft.name=$('edit-name').value;draft.vehicle.name=$('edit-car').value;draft.vehicle.color=$('edit-color').value;draft.vehicle.topSpeed=Math.round(Number($('edit-speed').value)/.216);const valid=parsePack(serializePack(draft));fillWorkshop(valid);$('mod-status').textContent='Quick edits added. Apply to activate.';}catch(e){$('mod-status').textContent=e.message;}};
$('apply-pack').onclick=()=>{try{const next=parsePack($('pack-source').value);pack=next;save('pack',serializePack(pack));$('workshop-dialog').close();updatePackUI();garage();}catch(e){$('mod-status').textContent='Pack rejected: '+e.message;}};
$('export-pack').onclick=()=>{try{const draft=parsePack($('pack-source').value);download('outruin-'+draft.id+'.json',new Blob([serializePack(draft)],{type:'application/json'}));$('mod-status').textContent='Validated mod pack exported.';}catch(e){$('mod-status').textContent='Export rejected: '+e.message;}};
$('import-pack').onclick=()=>$('pack-file').click();
$('pack-file').onchange=async()=>{const file=$('pack-file').files[0];if(!file)return;const token=++importToken;try{if(file.size>65536)throw new Error('File exceeds 64 KiB');const next=parsePack(await file.text());if(token!==importToken||!$('workshop-dialog').open)return;fillWorkshop(next);$('mod-status').textContent='Imported '+next.name+'. Apply to start a new campaign.';}catch(e){$('mod-status').textContent='Import rejected: '+e.message;}finally{$('pack-file').value='';}};
$('pack-source').addEventListener('input',()=>{importToken++;sound.stopPreview();});
$('example-pack').onchange=async()=>{const id=$('example-pack').value;if(!['the-last-signal','heavy-metal','night-courier'].includes(id))return;const token=++importToken;try{const response=await fetch('mods/'+id+'.json');if(!response.ok)throw new Error('Example could not be loaded');const next=parsePack(await response.text());if(token!==importToken||!$('workshop-dialog').open)return;fillWorkshop(next);$('mod-status').textContent='Example loaded. Edit or Apply to drive it.';}catch(e){if(token===importToken)$('mod-status').textContent=e.message;}};
function workshopAudio(){
  const draft=parsePack($('pack-source').value),seedInput=$('seed');
  if(seedInput.value===''||!seedInput.checkValidity())throw new RangeError('Choose a whole-number seed from 0 to 4294967295.');
  return {draft,seed:Number(seedInput.value),mix:RADIO_MIXES.find(m=>m.id===$('radio-mix').value)};
}
$('export-wav').onclick=()=>{try{const {draft,seed,mix}=workshopAudio(),score=compileSoundtrack(draft,seed,mix.arrangement,mix.sector);
  download('outruin-'+draft.id+'-'+mix.id+'-radio.wav',new Blob([score.wav()],{type:'audio/wav'}));$('audio-status').textContent='Complete eight-phrase '+mix.label+' loop exported.';
}catch(e){$('audio-status').textContent=e.message;}};
$('preview-radio').onclick=async()=>{try{const {draft,seed,mix}=workshopAudio(),score=compileSoundtrack(draft,seed,mix.arrangement,mix.sector);
  const pending=sound.audition(score),token=sound.previewToken,played=await pending;if((token===sound.previewToken||sound.failed)&&$('workshop-dialog').open)$('audio-status').textContent=played?'Auditioning '+mix.label+'.':sound.enabled?'Audio preview unavailable.':'Turn SOUND ON to audition.';
}catch(e){$('audio-status').textContent=e.message;}};
function workshopEffect(){const {seed}=workshopAudio(),kind=$('effect-mix').value;return {kind,score:compileEffect(kind,effectVariant(seed,0,kind))};}
$('preview-effect').onclick=async()=>{try{const {kind,score}=workshopEffect(),pending=sound.audition(score),token=sound.previewToken,played=await pending;
  if((token===sound.previewToken||sound.failed)&&$('workshop-dialog').open)$('audio-status').textContent=played?'Auditioning '+EFFECTS[kind]+'.':sound.enabled?'Audio preview unavailable.':'Turn SOUND ON to audition.';
}catch(e){$('audio-status').textContent=e.message;}};
$('export-effect').onclick=()=>{try{const {kind,score}=workshopEffect();download('outruin-'+kind+'.wav',new Blob([score.wav()],{type:'audio/wav'}));$('audio-status').textContent=EFFECTS[kind]+' WAV exported.';}catch(e){$('audio-status').textContent=e.message;}};
$('stop-preview').onclick=()=>{sound.stopPreview();$('audio-status').textContent='Audition stopped.';};
for(const id of ['radio-mix','effect-mix'])$(id).addEventListener('change',()=>{sound.stopPreview();$('audio-status').textContent='Ready to audition or export.';});

addEventListener('blur',()=>{sound.stopPreview();if(started&&['road','foot'].includes(state.mode))togglePause(true);});
document.addEventListener('visibilitychange',()=>{if(document.hidden)sound.stopPreview();if(document.hidden&&started)togglePause(true);});
addEventListener('pagehide',()=>{sound.stop();controls.clear();clock.setPaused(true);});
addEventListener('pageshow',e=>{if(e.persisted){last=0;if(started)togglePause(true);}});
function frame(now){
  const elapsed=last?Math.max(0,(now-last)/1000):0;last=now;const pm=controls.poll();
  if(started&&!paused&&!dialogs()&&['road','foot'].includes(state.mode)){
    if(clock.paused)clock.setPaused(false);const beforeTick=state.tick;const events=advanceFrame(clock,state,controls.mask(pm),elapsed);if(state.tick>beforeTick)controls.consume();sound.playEvents(events,state);
    if(state.mode!==lastMode){controls.clear();lastMode=state.mode;updateUI();}
  }
  renderer.draw(state,paused||dialogs()?1:clock.renderAlpha??1,clock.presentation?.state===state?clock.presentation.previous:null);sound.sync(state,!started||paused||dialogs());
  if(now-uiAt>100){updateUI();uiAt=now;}requestAnimationFrame(frame);
}
updatePackUI();updateUI();renderBindings();requestAnimationFrame(frame);
if('serviceWorker' in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('./sw.js').then(async reg=>{
  const update=()=>{$('offline-status').textContent=navigator.serviceWorker.controller?'OFFLINE READY':'PREPARING OFFLINE CACHE';};update();navigator.serviceWorker.addEventListener('controllerchange',update);
  if(reg.installing)reg.installing.addEventListener('statechange',update);
}).catch(()=>{$('offline-status').textContent='LOCAL SERVER / ONLINE MODE';});
// Explicit test mode exposes observations and bounded fixture stepping, never enabled by default.
if(new URLSearchParams(location.search).has('test'))Object.defineProperty(window,'outruinTest',{value:{
  snapshot:()=>snapshot(state),state:()=>state,renderer,clock,controls,sound,stepFrame:(seconds,mask=0)=>{const events=advanceFrame(clock,state,mask,seconds);updateUI();return events;},
  load:s=>{state=s;started=true;paused=false;lastMode=s.mode;clear();clock.setPaused(false);document.body.classList.add('playing');display.refresh();updateUI();},
  setPaused:togglePause,pack:()=>pack,started:()=>started
}});
