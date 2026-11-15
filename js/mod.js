// SPDX-License-Identifier: Apache-2.0
// Mods are bounded data, never executable scripts. All fields are required.
import {SECTORS,DIFFICULTIES,ROAD_BENDS} from './config.js';
export const MOD_KIND='outruin.mod.v1';
export const DEFAULT_PACK=freeze({
  kind:MOD_KIND,id:'last-signal',name:'The Last Signal',author:'QSOL-IMC',description:'Three regions. One signal core. A coast that might still be alive.',
  vehicle:{name:'Dust Kestrel',body:'interceptor',color:'#e0aa68',topSpeed:1080,acceleration:5,braking:14,coasting:2,steering:25,grip:4,offroadDrag:12,armour:100,fuelCapacity:100000,boostPower:400,boostDrain:5,boostRegen:1},
  weapons:{forward:{name:'Belt-fed repeater',damage:1,interval:8,range:320000,ammoCost:1},side:{name:'Door breach gun',damage:2,interval:24,range:60000,ammoCost:1},foot:{name:'Salvage carbine',damage:1,interval:15,range:65,ammoCost:1}},
  enemies:{bike:{name:'Dust rider',color:'#da7651',hp:2,speed:620,damage:5,fireInterval:150,scrap:20,score:150},buggy:{name:'Scrap hound',color:'#8eb2a2',hp:3,speed:450,damage:5,fireInterval:150,scrap:20,score:150},truck:{name:'Iron hauler',color:'#aea489',hp:5,speed:340,damage:18,fireInterval:180,scrap:30,score:300},boss:{name:'War rig',color:'#c66142',hp:45,speed:800,damage:9,fireInterval:75,scrap:150,score:2000}},
  sectors:SECTORS.map(s=>({...s})),bends:[...ROAD_BENDS],difficulties:JSON.parse(JSON.stringify(DIFFICULTIES)),
  rules:{fuelDrain:100,collisionDamage:12,bossAt:1700000,spawnNear:210000,spawnSpread:100000,roadFuel:18000,roadAmmo:45,stopSpeed:300},
  foot:{width:1900,speed:4,jump:13,enemyHealth:3,enemyDamage:6,enemyInterval:105,
    crates:[{x:310,kind:'fuel'},{x:660,kind:'ammo'},{x:970,kind:'health'},{x:1320,kind:'scrap'},{x:1650,kind:'fuel'}],enemies:[540,1130,1530],fuel:40000,ammo:100,health:45,repair:20,scrap:100},
  shop:{repair:{cost:50,amount:40},fuel:{cost:35,amount:40000},ammo:{cost:30,amount:100},engine:{cost:90,amount:12},gun:{cost:110,amount:1}},
  music:{title:'Dead Air / 88',tempo:120,gain:2700,wave:'saw',bass:[55,65,73,49],scale:[220,262,294,330,392,440,523,587],melody:[0,2,4,2,0,2,5,4,0,2,4,6,5,4,2,1]}
});
function freeze(x){if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}
const bounds=[
  [/^vehicle\.topSpeed$/,[300,1800]],[/^vehicle\.acceleration$/,[1,20]],[/^vehicle\.(braking|coasting|offroadDrag)$/,[1,40]],
  [/^vehicle\.(steering|grip)$/,[1,60]],[/^vehicle\.armour$/,[30,300]],[/^vehicle\.fuelCapacity$/,[30000,300000]],
  [/^vehicle\.boostPower$/,[0,800]],[/^vehicle\.boostDrain$/,[1,20]],[/^vehicle\.boostRegen$/,[0,10]],
  [/^weapons\..*\.damage$/,[1,20]],[/^weapons\..*\.interval$/,[3,120]],[/^weapons\..*\.ammoCost$/,[1,10]],
  [/^weapons\.foot\.range$/,[10,120]],[/^weapons\.(forward|side)\.range$/,[10000,500000]],
  [/^enemies\..*\.hp$/,[1,250]],[/^enemies\..*\.speed$/,[100,1500]],[/^enemies\..*\.damage$/,[1,40]],
  [/^enemies\..*\.fireInterval$/,[30,600]],[/^enemies\..*\.(scrap|score)$/,[0,5000]],
  [/^sectors\.\d+\.length$/,[600000,10000000]],[/^bends\.\d+$/,[ -7,7]],
  [/^difficulties\..*\.damage$/,[25,250]],[/^difficulties\..*\.spawn$/,[60,600]],[/^difficulties\..*\.fuel$/,[25,200]],[/^difficulties\..*\.ammo$/,[30,999]],
  [/^rules\.fuelDrain$/,[10,300]],[/^rules\.collisionDamage$/,[1,40]],[/^rules\.bossAt$/,[100000,9000000]],
  [/^rules\.spawnNear$/,[100000,400000]],[/^rules\.spawnSpread$/,[0,200000]],[/^rules\.roadFuel$/,[1000,100000]],[/^rules\.roadAmmo$/,[1,200]],[/^rules\.stopSpeed$/,[0,600]],
  [/^foot\.width$/,[800,6000]],[/^foot\.speed$/,[2,10]],[/^foot\.jump$/,[8,22]],[/^foot\.enemyHealth$/,[1,20]],
  [/^foot\.enemyDamage$/,[1,30]],[/^foot\.enemyInterval$/,[30,600]],[/^foot\.(crates\.\d+\.x|enemies\.\d+)$/,[200,5900]],
  [/^foot\.fuel$/,[1000,100000]],[/^foot\.(ammo|health|repair|scrap)$/,[1,500]],
  [/^shop\..*\.cost$/,[1,500]],[/^shop\.fuel\.amount$/,[1000,100000]],[/^shop\.engine\.amount$/,[1,30]],[/^shop\.gun\.amount$/,[1,5]],
  [/^shop\.(repair|ammo)\.amount$/,[1,500]],[/^music\.tempo$/,[80,160]],[/^music\.gain$/,[0,5000]],[/^music\.bass\.\d+$/,[30,200]],
  [/^music\.scale\.\d+$/,[110,1600]],[/^music\.melody\.\d+$/,[0,7]]
];
function valid(value,template,path='') {
  if(Array.isArray(template)) {
    const limits=path==='sectors'?[1,8]:path==='bends'?[8,32]:path==='foot.crates'?[1,16]:path==='foot.enemies'?[0,12]:[template.length,template.length];
    if(!Array.isArray(value)||value.length<limits[0]||value.length>limits[1])throw new Error(path+' has an invalid number of entries');
    return value.map((item,i)=>valid(item,template[0],`${path}.${i}`));
  }
  if(template&&typeof template==='object') {
    if(!value||Array.isArray(value)||typeof value!=='object')throw new Error(path+' must be an object');
    const keys=Object.keys(template);
    if(Object.keys(value).length!==keys.length||keys.some(k=>!Object.hasOwn(value,k)))throw new Error((path||'Pack')+' has missing or unknown fields');
    return Object.fromEntries(keys.map(k=>[k,valid(value[k],template[k],path?path+'.'+k:k)]));
  }
  if(typeof template==='number') {
    const limit=bounds.find(([re])=>re.test(path))?.[1];
    if(!limit||!Number.isSafeInteger(value)||value<limit[0]||value>limit[1])throw new Error(path+' must be an integer in '+(limit?.join('..')??'the documented range'));
  } else {
    if(typeof value!=='string'||value.length>180||value.length<1)throw new Error(path+' must be 1..180 characters');
    if(/(?:color|sky|haze|ground|sand|mountain|accent)$/.test(path)&&!/^#[0-9a-f]{6}$/i.test(value))throw new Error(path+' must be a six-digit hex colour');
    if(/(^id$|sectors\.\d+\.id$)/.test(path)&&!/^[a-z][a-z0-9-]{0,31}$/.test(value))throw new Error(path+' needs a simple lowercase identifier');
    if(path==='vehicle.body'&&!['interceptor','hauler','buggy'].includes(value))throw new Error('Choose interceptor, hauler or buggy body');
    if(path==='music.wave'&&!['saw','square','triangle'].includes(value))throw new Error('Unsupported music waveform');
    if(/^foot\.crates\.\d+\.kind$/.test(path)&&!['fuel','ammo','health','scrap'].includes(value))throw new Error('Unknown supply type');
  }
  return value;
}
export function parsePack(text) {
  if(typeof text!=='string'||new TextEncoder().encode(text).length>65536)throw new Error('Mod packs must be at most 64 KiB');
  const pack=valid(JSON.parse(text),DEFAULT_PACK);
  if(pack.kind!==MOD_KIND)throw new Error('Unsupported mod format');
  if(new Set(pack.sectors.map(s=>s.id)).size!==pack.sectors.length)throw new Error('Sector IDs must be unique');
  if(pack.rules.bossAt>=pack.sectors.at(-1).length)throw new Error('Boss must appear before the final finish line');
  if(pack.foot.crates.some(c=>c.x>pack.foot.width-80)||pack.foot.enemies.some(x=>x>pack.foot.width-80))throw new Error('Foot locations must be inside the outpost');
  if(!pack.foot.crates.some(c=>c.kind==='fuel'))throw new Error('Each outpost needs fuel for an empty-tank recovery');
  return freeze(pack);
}
export function serializePack(pack){return JSON.stringify(pack,null,2)+'\n';}
export function packFingerprint(pack){
  let h=2166136261;for(const c of JSON.stringify(pack))h=Math.imul(h^c.charCodeAt(0),16777619);
  return (h>>>0).toString(16).padStart(8,'0');
}
