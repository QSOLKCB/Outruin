// SPDX-License-Identifier: Apache-2.0
export const VERSION = '0.1.0';
export const TICK_RATE = 60;
export const INPUT = Object.freeze({left:1,right:2,throttle:4,brake:8,fire:16,boost:32,interact:64,leftShot:128,rightShot:256,jump:512});
export const DIFFICULTIES = Object.freeze({
  drifter: Object.freeze({label:'Drifter',damage:65,spawn:230,fuel:80,ammo:320,description:'More supplies. A little room to breathe.'}),
  survivor: Object.freeze({label:'Survivor',damage:100,spawn:175,fuel:100,ammo:240,description:'The road does not owe you anything.'}),
  wastelord: Object.freeze({label:'Wastelord',damage:145,spawn:130,fuel:120,ammo:200,description:'Fast raiders. Thin margins. No mercy.'})
});
export const SECTORS = Object.freeze([
  Object.freeze({id:'rust',name:'THE RUST REACH',short:'Rust Reach',length:2400000,sky:'#132d37',haze:'#dd8751',ground:'#986143',sand:'#b47a4b',mountain:'#6c4840',accent:'#f1b766',outpost:'RELAY 09'}),
  Object.freeze({id:'salt',name:'THE SALT GRAVE',short:'Salt Grave',length:2800000,sky:'#243b48',haze:'#d6c6a2',ground:'#a49e84',sand:'#b7b298',mountain:'#5a6f71',accent:'#a4e2d0',outpost:'DEAD FREQUENCY'}),
  Object.freeze({id:'black',name:'BLACK GLASS',short:'Black Glass',length:3200000,sky:'#181d32',haze:'#b56e68',ground:'#493a43',sand:'#62505a',mountain:'#303040',accent:'#ff8c65',outpost:'THE LAST SIGNAL'})
]);
export const UPGRADES = Object.freeze({repair:{name:'Hull repair',cost:50,detail:'+40 armour'},fuel:{name:'Fuel drums',cost:35,detail:'+40 fuel'},ammo:{name:'Ammo crate',cost:30,detail:'+100 rounds'},engine:{name:'Engine tune',cost:90,detail:'+12% top speed'},gun:{name:'Twin feed',cost:110,detail:'Double forward damage'}});
export const ROAD_BENDS = Object.freeze([0,0,2,4,2,-3,-5,-2,0,3,5,1,-2,-4,0,1]);
