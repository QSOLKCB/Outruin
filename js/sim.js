// SPDX-License-Identifier: Apache-2.0
// Pure 60 Hz simulation. Road position: integer millimetres; speed: mm/tick.
// Lane x is -1000..1000 at the road edges. Foot coordinates are integer pixels.
import {seededRandom,clamp} from '../vendor/vanillajs/modules/math/index.js';
import {INPUT as I,VERSION} from './config.js';
import {DEFAULT_PACK,parsePack,serializePack} from './mod.js';
export {INPUT} from './config.js';
const has=(m,k)=>(m&I[k])!==0;
export function createGame({seed=1988,difficulty='survivor',pack=DEFAULT_PACK}={}) {
  pack=parsePack(serializePack(pack));
  if(!Number.isInteger(seed)||seed<0||seed>0xffffffff||!Object.hasOwn(pack.difficulties,difficulty))throw new RangeError('Invalid run configuration');
  return {version:VERSION,seed,difficulty,pack,random:seededRandom(seed),tick:0,mode:'road',sector:0,route:'highway',distance:0,total:0,x:0,vx:0,speed:0,
    hull:pack.vehicle.armour,health:100,fuel:pack.vehicle.fuelCapacity,ammo:pack.difficulties[difficulty].ammo,boost:1000,boostLocked:false,scrap:0,score:0,kills:0,
    engine:0,gun:0,cooldown:0,sideCooldown:0,invulnerable:0,spawnIn:150,entities:[],particles:[],nextId:1,events:[],
    visited:false,stopAtEnd:false,foot:null,bossSpawned:false,bossDefeated:false,lastMask:0,
    journal:[],commands:[],notice:'Deliver the signal core. Reach the coast.',noticeUntil:240,reason:''};
}
export function bendAt(distance,sector=0,route='highway',bends=DEFAULT_PACK.bends) {
  const index=Math.floor(Math.max(0,distance)/280000);
  return bends[(index+sector*3)%bends.length]*(route==='canyon'?2:1);
}
function event(s,type,extra={}){s.events.push({type,tick:s.tick,...extra});}
function say(s,text){s.notice=text;s.noticeUntil=s.tick+210;}
function hurt(s,amount,foot=false) {
  if(s.invulnerable>0)return;
  const damage=Math.max(1,Math.round(amount*s.pack.difficulties[s.difficulty].damage/100));
  const key=foot?'health':'hull';s[key]=Math.max(0,s[key]-damage);s.invulnerable=foot?50:38;
  event(s,'hit');
}
function spawn(s) {
  const roll=s.random(),kind=roll<.48?'bike':roll<.74?'buggy':roll<.87?'truck':roll<.94?'fuel':'ammo';
  s.entities.push({id:s.nextId++,kind,z:s.distance+s.pack.rules.spawnNear+Math.floor(s.random()*s.pack.rules.spawnSpread),
    x:Math.floor(s.random()*1500)-750,speed:s.pack.enemies[kind]?.speed??0,
    hp:s.pack.enemies[kind]?.hp??1,shot:70+Math.floor(s.random()*100),phase:Math.floor(s.random()*240)});
}
function destroy(s,e) {
  e.dead=true;s.kills++;s.score+=s.pack.enemies[e.kind].score;s.scrap+=s.pack.enemies[e.kind].scrap;
  event(s,'explode',{x:e.x,z:e.z});s.particles.push({x:e.x,z:e.z,ttl:40});
  if(e.kind==='boss'){s.bossDefeated=true;say(s,'WAR RIG DOWN. The last signal is yours.');}
}
function roadShot(s,side=0) {
  const weapon=side?s.pack.weapons.side:s.pack.weapons.forward;
  if(s.ammo<weapon.ammoCost)return;
  const cooldown=side?'sideCooldown':'cooldown';if(s[cooldown]>0)return;
  s.ammo-=weapon.ammoCost;s[cooldown]=weapon.interval;event(s,'shot',{side});
  const targets=s.entities.filter(e=>!e.dead&&e.hp>0&&!['fuel','ammo'].includes(e.kind)&&
    (side?Math.abs(e.z-s.distance)<weapon.range&&Math.sign(e.x-s.x)===side:
      e.z>s.distance&&e.z-s.distance<weapon.range&&Math.abs(e.x-s.x)<240))
    .sort((a,b)=>Math.abs(a.z-s.distance)-Math.abs(b.z-s.distance)||a.id-b.id);
  if(targets[0]){targets[0].hp-=weapon.damage+(side?0:s.gun);targets[0].flash=5;if(targets[0].hp<=0)destroy(s,targets[0]);}
}
export function enterOutpost(s,atEnd=false) {
  if(s.mode!=='road'||s.visited)return false;
  s.mode='foot';s.speed=0;s.vx=0;s.visited=true;s.stopAtEnd=atEnd;s.lastMask=0;s.invulnerable=60;
  s.foot={x:90,y:0,vy:0,facing:1,shot:0,crates:s.pack.foot.crates.map(c=>({...c,taken:false})),
    enemies:s.pack.foot.enemies.map((x,i)=>({id:i+1,x,hp:s.pack.foot.enemyHealth,cooldown:90+i*15})),bullets:[]};
  say(s,'Scavenge supplies. Return to your car and press E / F.');event(s,'outpost');return true;
}
function roadTick(s,m,edge) {
  const v=s.pack.vehicle;
  if(!has(m,'boost'))s.boostLocked=false;
  const boosting=has(m,'boost')&&!s.boostLocked&&s.boost>0&&has(m,'throttle')&&s.fuel>0;
  const top=Math.round(v.topSpeed*(1+s.engine/100))+(boosting?v.boostPower:0);
  if(has(m,'throttle')&&s.fuel>0)s.speed=Math.min(top,s.speed+v.acceleration+(s.engine?1:0));
  else s.speed=Math.max(0,s.speed-v.coasting);
  if(has(m,'brake'))s.speed=Math.max(0,s.speed-v.braking);
  if(s.speed>top)s.speed=Math.max(top,s.speed-8);
  const steer=(has(m,'right')?1:0)-(has(m,'left')?1:0),target=steer*(s.speed>60?v.steering:7);
  s.vx+=Math.sign(target-s.vx)*Math.min(v.grip,Math.abs(target-s.vx));
  s.x=clamp(s.x+s.vx-Math.trunc(bendAt(s.distance,s.sector,s.route,s.pack.bends)*s.speed*s.speed/1166400),-1550,1550);
  if(Math.abs(s.x)>1000){s.speed=Math.max(0,s.speed-v.offroadDrag);if(s.tick%90===0&&s.speed>400)hurt(s,2);}
  if(boosting){s.boost=Math.max(0,s.boost-v.boostDrain);if(s.boost===0)s.boostLocked=true;}else s.boost=Math.min(1000,s.boost+v.boostRegen);
  s.distance+=s.speed;s.total+=s.speed;
  if(s.speed>0)s.fuel=Math.max(0,s.fuel-Math.round((3+s.speed/160)*s.pack.difficulties[s.difficulty].fuel*s.pack.rules.fuelDrain/10000));
  if(has(m,'fire'))roadShot(s);
  if(has(m,'leftShot'))roadShot(s,-1);
  if(has(m,'rightShot'))roadShot(s,1);
  if(--s.spawnIn<=0){spawn(s);s.spawnIn=s.pack.difficulties[s.difficulty].spawn+(s.route==='canyon'?-25:0);}
  if(s.sector===s.pack.sectors.length-1&&!s.bossSpawned&&s.distance>s.pack.rules.bossAt) {
    s.bossSpawned=true;s.entities.push({id:s.nextId++,kind:'boss',x:0,z:s.distance+220000,speed:s.pack.enemies.boss.speed,hp:s.pack.enemies.boss.hp,shot:90,phase:0});
    say(s,'WAR RIG / Break its armour. Keep the forward gun aligned.');event(s,'boss');
  }
  for(const e of s.entities){
    if(e.dead)continue;e.z+=e.speed;if(e.flash>0)e.flash--;
    let delta=e.z-s.distance;
    if(e.kind==='boss') {e.z=s.distance+clamp(delta,85000,240000);delta=e.z-s.distance;
      if(s.tick%120<60)e.x=clamp(e.x+5,-650,650);else e.x=clamp(e.x-5,-650,650);}
    if(['bike','buggy','boss'].includes(e.kind)&&delta>-25000&&delta<180000){
      if(--e.shot<=0){e.shot=s.pack.enemies[e.kind].fireInterval;event(s,'enemy-shot',{x:e.x,z:e.z});
        if(Math.abs(e.x-s.x)<(e.kind==='boss'?330:250))hurt(s,s.pack.enemies[e.kind].damage);}
    }
    if(Math.abs(delta)<10000&&Math.abs(e.x-s.x)<210){
      if(e.kind==='fuel'){s.fuel=Math.min(v.fuelCapacity,s.fuel+s.pack.rules.roadFuel);e.dead=true;event(s,'pickup');say(s,'Fuel salvaged');}
      else if(e.kind==='ammo'){s.ammo=Math.min(999,s.ammo+s.pack.rules.roadAmmo);e.dead=true;event(s,'pickup');say(s,'Ammunition salvaged');}
      else {hurt(s,e.kind==='truck'?s.pack.enemies.truck.damage:s.pack.rules.collisionDamage);s.speed=Math.trunc(s.speed*.65);e.z=s.distance-16000;}
    }
  }
  s.entities=s.entities.filter(e=>!e.dead&&e.z>s.distance-50000&&e.z<s.distance+700000);
  if(has(edge,'interact')){
    if(s.visited)say(s,'This sector has already been scavenged. Keep moving.');
    else if(s.speed>s.pack.rules.stopSpeed)say(s,`Brake below ${Math.round(s.pack.rules.stopSpeed*.216)} km/h to stop.`);
    else {enterOutpost(s,false);return;}
  }
  if(s.fuel===0&&s.speed<50){
    if(!s.visited){enterOutpost(s,false);say(s,'TANK EMPTY. Find fuel on foot, then return to your car.');}
    else {s.mode='lost';s.reason='Fuel exhausted. The wasteland keeps another machine.';}
    return;
  }
  if(s.distance>=s.pack.sectors[s.sector].length){
    if(s.sector===s.pack.sectors.length-1){if(s.bossDefeated){s.mode='won';s.score+=Math.round(s.hull*20+s.fuel/100);s.reason='Signal delivered. There is still someone out there.';}
      else {say(s,'The war rig is blocking the coast. Destroy it to finish.');}}
    else if(!s.visited)enterOutpost(s,true);
    else {s.mode='depot';s.speed=0;s.lastMask=0;event(s,'depot');}
  }
}
function collect(s,crate) {
  crate.taken=true;event(s,'pickup');s.score+=75;
  if(crate.kind==='fuel'){s.fuel=Math.min(s.pack.vehicle.fuelCapacity,s.fuel+s.pack.foot.fuel);say(s,'Fuel drums recovered');}
  if(crate.kind==='ammo'){s.ammo=Math.min(999,s.ammo+s.pack.foot.ammo);say(s,'Ammunition recovered');}
  if(crate.kind==='health'){s.health=Math.min(100,s.health+s.pack.foot.health);s.hull=Math.min(s.pack.vehicle.armour,s.hull+s.pack.foot.repair);say(s,'Medical supplies and repair parts recovered');}
  if(crate.kind==='scrap'){s.scrap+=s.pack.foot.scrap;say(s,'Salvage recovered');}
}
function footTick(s,m,edge) {
  const f=s.foot,dir=(has(m,'right')?1:0)-(has(m,'left')?1:0);
  f.x=clamp(f.x+dir*s.pack.foot.speed,40,s.pack.foot.width-30);if(dir)f.facing=dir;
  if(has(edge,'jump')&&f.y===0)f.vy=s.pack.foot.jump;
  f.y=Math.max(0,f.y+f.vy);if(f.y>0)f.vy--;else f.vy=0;
  if(f.shot>0)f.shot--;
  if(has(m,'fire')&&f.shot===0&&s.ammo>=s.pack.weapons.foot.ammoCost){f.shot=s.pack.weapons.foot.interval;s.ammo-=s.pack.weapons.foot.ammoCost;event(s,'shot',{side:0});
    f.bullets.push({x:f.x+f.facing*16,y:f.y+28,v:f.facing*18,enemy:false,ttl:s.pack.weapons.foot.range});}
  for(const e of f.enemies){if(e.hp<=0)continue;
    const d=f.x-e.x;
    if(Math.abs(d)<700){if(Math.abs(d)>220)e.x+=Math.sign(d)*2;
      if(--e.cooldown<=0){e.cooldown=s.pack.foot.enemyInterval;f.bullets.push({x:e.x,y:25,v:Math.sign(d)*7,enemy:true,ttl:120});event(s,'enemy-shot');}}
    if(Math.abs(d)<30&&f.y<28)hurt(s,7,true);
  }
  for(const b of f.bullets){b.x+=b.v;b.ttl--;
    if(b.enemy){if(Math.abs(b.x-f.x)<20&&Math.abs(b.y-(f.y+25))<28){hurt(s,s.pack.foot.enemyDamage,true);b.ttl=0;}}
    else for(const e of f.enemies){if(e.hp>0&&Math.abs(b.x-e.x)<24&&b.y<65){e.hp-=s.pack.weapons.foot.damage;b.ttl=0;if(e.hp<=0){s.kills++;s.score+=120;s.scrap+=15;event(s,'explode');}break;}}
  }
  f.bullets=f.bullets.filter(b=>b.ttl>0&&b.x>0&&b.x<s.pack.foot.width+100);
  if(has(edge,'interact')){
    if(f.x<160){
      if(s.fuel<=0){say(s,'Find a fuel crate before returning to the road.');return;}
      s.mode=s.stopAtEnd?'depot':'road';if(!s.bossDefeated)s.bossSpawned=false;s.lastMask=0;s.invulnerable=60;s.entities=[];s.spawnIn=150;event(s,'return');
      say(s,s.mode==='road'?'Back on the road. Hold throttle to move.':'Spend your scrap, then choose the next route.');return;
    }
    const crate=f.crates.find(c=>!c.taken&&Math.abs(c.x-f.x)<80);
    if(crate)collect(s,crate);else say(s,'Move close to a supply crate. E / F to search.');
  }
}
export function step(s,mask=0,{record=true}={}) {
  if(!Number.isInteger(mask)||mask<0||mask>1023)throw new RangeError('Invalid input mask');
  s.events=[];if(!['road','foot'].includes(s.mode))return;
  if(record)s.journal.push(mask);
  const edge=mask&~s.lastMask;s.lastMask=mask;s.tick++;
  if(s.cooldown>0)s.cooldown--;if(s.sideCooldown>0)s.sideCooldown--;if(s.invulnerable>0)s.invulnerable--;
  for(const p of s.particles)p.ttl--;s.particles=s.particles.filter(p=>p.ttl>0);
  if(s.mode==='road')roadTick(s,mask,edge);else footTick(s,mask,edge);
  if(s.tick>=72000&&['road','foot'].includes(s.mode)){s.mode='lost';s.reason='The signal faded after twenty minutes.';}
  if(s.hull<=0||s.health<=0){s.mode='lost';s.reason=s.hull<=0?'Your machine gave everything it had.':'The salvage run ended here.';}
}
export function command(s,type,value,{record=true}={}) {
  if(s.mode!=='depot')return false;
  if(type==='buy'&&Object.hasOwn(s.pack.shop,value)) {
    const item=s.pack.shop[value];
    if(s.scrap<item.cost||(value==='engine'&&s.engine)||(value==='gun'&&s.gun))return false;
    s.scrap-=item.cost;
    if(value==='repair')s.hull=Math.min(s.pack.vehicle.armour,s.hull+item.amount);
    if(value==='fuel')s.fuel=Math.min(s.pack.vehicle.fuelCapacity,s.fuel+item.amount);
    if(value==='ammo')s.ammo=Math.min(999,s.ammo+item.amount);
    if(value==='engine')s.engine=item.amount;if(value==='gun')s.gun=item.amount;
    event(s,'pickup');
  } else if(type==='route'&&['highway','canyon'].includes(value)&&s.sector<s.pack.sectors.length-1) {
    s.sector++;s.route=value;s.distance=0;s.speed=0;s.x=0;s.vx=0;s.entities=[];s.particles=[];s.visited=false;s.foot=null;
    s.mode='road';s.lastMask=0;s.spawnIn=150;s.invulnerable=90;s.score+=500;if(value==='canyon')s.scrap+=25;
    say(s,s.pack.sectors[s.sector].name+' / '+(value==='canyon'?'Tight bends. More raiders. +25 hazard pay.':'Open highway. Keep the signal alive.'));
  } else return false;
  if(record)s.commands.push({tick:s.tick,type,value});return true;
}
export function snapshot(s) {
  const {random,journal,commands,events,...data}=s;return JSON.parse(JSON.stringify(data));
}
export function runRecord(s){return {kind:'outruin.replay.v1',version:VERSION,seed:s.seed,difficulty:s.difficulty,pack:s.pack,inputs:[...s.journal],commands:s.commands.map(c=>({...c}))};}
export function replay(record) {
  if(!record||record.kind!=='outruin.replay.v1'||record.version!==VERSION||!Array.isArray(record.inputs)||record.inputs.length>72000||
    !Array.isArray(record.commands)||record.commands.length>100)throw new TypeError('Unsupported replay');
  const s=createGame(record);let c=0;
  for(const m of record.inputs){
    while(c<record.commands.length&&record.commands[c].tick===s.tick){const cmd=record.commands[c++];if(!command(s,cmd.type,cmd.value,{record:false}))throw new Error('Invalid replay command');}
    if(!['road','foot'].includes(s.mode))throw new Error('Input after inactive state');step(s,m,{record:false});
  }
  while(c<record.commands.length&&record.commands[c].tick===s.tick){const cmd=record.commands[c++];if(!command(s,cmd.type,cmd.value,{record:false}))throw new Error('Invalid replay command');}
  if(c!==record.commands.length)throw new Error('Unconsumed replay command');return s;
}
