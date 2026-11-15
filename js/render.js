// SPDX-License-Identifier: Apache-2.0
// Original procedural art. Perspective approach informed by QSOLKCB/STREET-RACER.
import {bendAt} from './sim.js';
export const W=1280,H=720,VIEW=650000,HORIZON=245;
const poly=(c,p,color)=>{c.fillStyle=color;c.beginPath();c.moveTo(...p[0]);for(const v of p.slice(1))c.lineTo(...v);c.closePath();c.fill();};
const text=(c,label,x,y,size=16,color='#f6e5c9',align='left')=>{c.font=`700 ${size}px monospace`;c.textAlign=align;c.fillStyle=color;c.fillText(label,x,y);};
function skyline(c,p) {
  const sky=c.createLinearGradient(0,0,0,HORIZON);sky.addColorStop(0,p.sky);sky.addColorStop(1,p.haze);c.fillStyle=sky;c.fillRect(0,0,W,H);
  c.fillStyle=p.accent;c.beginPath();c.arc(950,129,57,0,Math.PI*2);c.fill();
  c.fillStyle=p.sky;for(let i=0;i<6;i++)c.fillRect(880,134+i*11,140,2+i*.75);
  for(let layer=0;layer<3;layer++){
    const points=[[0,HORIZON]];for(let x=0;x<=W+24;x+=24){let peak=Math.sin(x*.006+layer*3)*26+Math.cos(x*.018+layer)*17;
      points.push([x,195+layer*18-peak*(1-layer*.2)]);}
    points.push([W,HORIZON]);poly(c,points,layer===0?p.mountain:layer===1?p.ground:p.sand);
  }
  // Broken skyline, pylons and a silent relay. No per-frame randomness.
  for(let i=0;i<10;i++){const x=i*151+30,h=20+(i*23)%65;c.fillStyle=p.mountain;c.fillRect(x,235-h,18,h);
    if(i%3===0){c.fillRect(x-12,240-h,42,5);c.fillRect(x+6,214-h,4,25);}}
  c.fillStyle=p.ground;c.fillRect(0,HORIZON,W,H-HORIZON);
}
function aheadOffset(s,z){
  // Integrate the same authored bend sequence used by the steering simulation.
  let out=0;const stride=50000;for(let n=0;n<z;n+=stride){const len=Math.min(stride,z-n);out+=bendAt(s.distance+n,s.sector,s.route,s.pack.bends)*len*(z-n-len/2)*.00000000055;}return out;
}
export function project(s,z,lane=0){
  const f=Math.max(0,Math.min(1,1-z/VIEW)),w=8+660*Math.pow(f,1.58);
  return {x:W/2+aheadOffset(s,z)-s.x/1000*w*.76+lane/1000*w*.76,y:HORIZON+Math.pow(f,2.05)*(H-HORIZON),w,f};
}
function road(c,s,p){
  for(let i=0;i<80;i++){
    const z0=VIEW*(1-i/80),z1=VIEW*(1-(i+1)/80),a=project(s,z0),b=project(s,z1),stripe=Math.floor((s.distance+z0)/19000)%2;
    c.fillStyle=stripe?p.ground:p.sand;c.fillRect(0,a.y,W,b.y-a.y+1);
    poly(c,[[a.x-a.w*1.12,a.y],[a.x+a.w*1.12,a.y],[b.x+b.w*1.12,b.y],[b.x-b.w*1.12,b.y]],stripe?'#b6a68a':'#5c4840');
    poly(c,[[a.x-a.w,a.y],[a.x+a.w,a.y],[b.x+b.w,b.y],[b.x-b.w,b.y]],stripe?'#333c40':'#30383b');
    if(stripe)for(const l of [-.33,.33])poly(c,[[a.x+a.w*l-1,a.y],[a.x+a.w*l+1,a.y],[b.x+b.w*l+b.w*.008,b.y],[b.x+b.w*l-b.w*.008,b.y]],'#ad9e78');
    if(i%7===0){poly(c,[[a.x+a.w*.5,a.y],[a.x+a.w*.45,a.y],[b.x+b.w*.2,b.y],[b.x+b.w*.25,b.y]],'#202e33');}
  }
}
function car(c,x,y,w,color,kind='car',flash=false){
  const h=w*(kind==='bike'?.9:kind==='boss'||kind==='hauler'?.95:kind==='buggy'?.50:.62);c.save();c.translate(x,y);
  c.fillStyle='#111b20aa';c.beginPath();c.ellipse(0,2,w*.65,h*.18,0,0,Math.PI*2);c.fill();
  if(kind==='bike'){
    c.fillStyle='#121d23';c.fillRect(-w*.14,-h*.65,w*.28,h*.65);poly(c,[[-w*.38,-h*.4],[-w*.24,-h*.85],[w*.24,-h*.85],[w*.38,-h*.4]],flash?'#fff':color);
    c.fillStyle='#28363c';c.fillRect(-w*.18,-h*1.05,w*.36,h*.55);c.fillStyle='#eebd72';c.fillRect(-w*.14,-h*.98,w*.28,h*.12);
  } else {
    c.fillStyle='#111a1e';c.fillRect(-w*.52,-h*.78,w*.17,h*.75);c.fillRect(w*.35,-h*.78,w*.17,h*.75);
    poly(c,[[-w*.48,0],[-w*.49,-h*.5],[-w*.34,-h*1.16],[w*.34,-h*1.16],[w*.49,-h*.5],[w*.48,0]],flash?'#fff4d3':color);
    poly(c,[[-w*.30,-h*.63],[-w*.23,-h*1.02],[w*.23,-h*1.02],[w*.30,-h*.63]],'#18303b');
    poly(c,[[-w*.25,-h*.64],[-w*.20,-h*.95],[w*.05,-h*.95],[w*.16,-h*.64]],'#527581');
    c.fillStyle='#19262b';c.fillRect(-w*.43,-h*.39,w*.86,h*.13);c.fillRect(-w*.53,-h*.12,w*1.06,h*.1);
    c.fillStyle='#ef5c36';c.fillRect(-w*.40,-h*.33,w*.23,h*.12);c.fillRect(w*.17,-h*.33,w*.23,h*.12);
    c.fillStyle='#d9c6a1';c.fillRect(-w*.08,-h*.18,w*.16,h*.1);
    c.fillStyle='#354247';c.fillRect(-w*.13,-h*1.18,w*.26,h*.19);c.fillRect(-w*.04,-h*1.4,w*.08,h*.33);
    if(kind==='boss'||kind==='truck'||kind==='hauler')for(let i=0;i<4;i++){c.fillStyle='#17282b';c.fillRect(-w*.32+i*w*.19,-h*.61,w*.1,h*.27);}
  }
  c.restore();
}
function scenery(c,s,p){
  const start=Math.floor(s.distance/65000)*65000;
  for(let d=start+650000;d>start;d-=65000){const z=d-s.distance;if(z<6000)continue;const a=project(s,z),size=14+a.f*a.f*125;
    for(const side of [-1,1]){const x=a.x+side*a.w*1.55,y=a.y,which=(Math.floor(d/65000)+side+3)%4;
      c.fillStyle='#15252b55';c.fillRect(x-size*.6,y-3,size,6);
      if(which===0){poly(c,[[x-size*.45,y],[x-size*.3,y-size*.65],[x+size*.15,y-size*.83],[x+size*.6,y]],p.mountain);}
      else if(which===1){c.strokeStyle=p.mountain;c.lineWidth=Math.max(2,size*.05);c.beginPath();c.moveTo(x-size*.3,y);c.lineTo(x,y-size*2);c.lineTo(x+size*.3,y);c.moveTo(x-size*.5,y-size*1.2);c.lineTo(x+size*.5,y-size*1.2);c.stroke();}
      else if(which===2){c.fillStyle='#394449';c.fillRect(x-size*.04,y-size*1.2,size*.08,size*1.2);c.fillStyle='#16303a';c.fillRect(x-size*.6,y-size*1.3,size*1.2,size*.48);
        if(size>48)text(c,side===1?'COAST →':'NO RETURN',x,y-size*.99,size*.12,p.accent,'center');}
      else {c.fillStyle=p.mountain;c.fillRect(x-size*.5,y-size*.34,size,size*.34);poly(c,[[x-size*.4,y-size*.34],[x-size*.15,y-size*.6],[x+size*.4,y-size*.34]],'#29373b');}
    }
  }
}
function actors(c,s){
  const sorted=[...s.entities.filter(e=>e.z-s.distance>1000&&e.z-s.distance<VIEW).map(e=>({...e,type:'entity'})),
    ...s.particles.filter(e=>e.z-s.distance>0&&e.z-s.distance<VIEW).map(e=>({...e,type:'blast'}))].sort((a,b)=>b.z-a.z);
  for(const e of sorted){const a=project(s,e.z-s.distance,e.x),size=18+Math.pow(a.f,1.6)*(e.kind==='boss'?220:e.kind==='truck'?160:e.kind==='bike'?55:110);
    if(e.type==='blast'){c.fillStyle=e.ttl%4<2?'#ffe3a0':'#e46b36';c.beginPath();c.arc(a.x,a.y-size*.3,size*(1-e.ttl/50),0,7);c.fill();continue;}
    if(['fuel','ammo'].includes(e.kind)){c.fillStyle=e.kind==='fuel'?'#80c5b3':'#d2af6c';c.fillRect(a.x-size*.22,a.y-size*.55,size*.44,size*.55);text(c,e.kind==='fuel'?'F':'+',a.x,a.y-size*.12,size*.3,'#142f36','center');}
    else car(c,a.x,a.y,size,s.pack.enemies[e.kind].color,e.kind,e.flash>0);
    if(e.kind==='boss'){c.fillStyle='#1a2428';c.fillRect(a.x-size*.5,a.y-size*1.6,size,7);c.fillStyle='#ef895d';c.fillRect(a.x-size*.5,a.y-size*1.6,size*Math.max(0,e.hp)/s.pack.enemies.boss.hp,7);}
  }
}
function player(c,s){
  const x=W/2+s.vx*1.1,y=H-24;
  if(s.speed>600){c.fillStyle='#ddae7c22';poly(c,[[x-90,y],[x-150,H],[x-70,H]],'#ddae7c55');poly(c,[[x+90,y],[x+150,H],[x+70,H]],'#ddae7c55');}
  car(c,x,y,218,s.pack.vehicle.color,s.pack.vehicle.body,s.invulnerable>15&&s.tick%8<4);
  if(s.cooldown>s.pack.weapons.forward.interval-4){poly(c,[[x-7,y-193],[x-17,y-236],[x,y-215],[x+13,y-245],[x+9,y-193]],'#ffe3a0');
    c.strokeStyle='#ffdf94';c.lineWidth=3;c.beginPath();c.moveTo(x,y-240);c.lineTo(x,y-290);c.stroke();}
  if(s.sideCooldown>s.pack.weapons.side.interval-5){text(c,'✦',x+(s.lastMask&128?-135:135),y-80,48,'#ffd792','center');}
}
function person(c,x,y,color,facing=1,flash=false){
  c.fillStyle=flash?'#fff0bc':color;c.fillRect(x-8,y-48,16,20);c.fillRect(x-10,y-28,20,19);
  c.fillStyle='#172c34';c.fillRect(x-8,y-9,6,12);c.fillRect(x+2,y-9,6,12);c.fillRect(x-5,y-43,13,5);
  c.fillStyle='#d4c09c';c.fillRect(x+facing*12-5,y-27,18,5);
}
function foot(c,s,p){
  const f=s.foot,camera=Math.max(0,Math.min(s.pack.foot.width-W,f.x-W*.43)),ground=H-115;
  c.fillStyle=p.ground;c.fillRect(0,HORIZON,W,H-HORIZON);
  for(let i=0;i<6;i++){const x=i*380-camera*.6;c.fillStyle=p.mountain;c.fillRect(x,ground-170,240,170);
    poly(c,[[x-10,ground-170],[x+60,ground-220],[x+250,ground-170]],'#23363d');
    c.fillStyle='#152932';c.fillRect(x+25,ground-125,54,40);c.fillRect(x+120,ground-90,50,90);
    c.fillStyle=p.accent;c.fillRect(x+33,ground-118,8,28);}
  c.fillStyle='#253137';c.fillRect(0,ground,W,H-ground);c.fillStyle='#dbc398';c.fillRect(0,ground,W,3);
  for(let i=0;i<40;i++){const x=(i*83-camera)%W;c.fillStyle='#506067';c.fillRect(x,ground+30+(i*17)%74,8+i%3*6,3);}
  car(c,90-camera,ground,135,s.pack.vehicle.color,s.pack.vehicle.body);text(c,'YOUR CAR',90-camera,ground-132,15,p.accent,'center');
  for(const box of f.crates){if(box.taken)continue;const x=box.x-camera;c.fillStyle=box.kind==='fuel'?'#73b2a3':'#c69d65';c.fillRect(x-23,ground-38,46,38);
    c.strokeStyle='#283a3d';c.lineWidth=4;c.strokeRect(x-20,ground-35,40,32);text(c,box.kind.toUpperCase(),x,ground-54,13,'#fff0d2','center');
    if(Math.abs(box.x-f.x)<80)text(c,'[E] SEARCH',x,ground-78,14,p.accent,'center');}
  for(const e of f.enemies)if(e.hp>0)person(c,e.x-camera,ground,s.pack.enemies.bike.color,Math.sign(f.x-e.x));
  for(const b of f.bullets){c.fillStyle=b.enemy?'#f97956':'#ffe6b7';c.fillRect(b.x-camera,ground-b.y,12,3);}
  person(c,f.x-camera,ground-f.y,'#d4ddd0',f.facing,s.invulnerable>0&&s.tick%8<4);
  if(f.x<160)text(c,'[E] RETURN TO CAR',120-camera,ground+58,17,p.accent);
  text(c,p.outpost,40,300,38,'#f5dfb9');text(c,'SEARCH THE RUINS. KEEP SOMETHING FOR THE ROAD.',42,328,14,'#f5dfb9');
}
export class Renderer {
  constructor(canvas){this.canvas=canvas;canvas.width=W;canvas.height=H;this.ctx=canvas.getContext('2d',{alpha:false});this.backgrounds=new Map();this.pack=null;this.reference=false;}
  draw(s){
    const c=this.ctx,p=s.pack.sectors[s.sector];
    if(this.pack!==s.pack){this.backgrounds.clear();this.pack=s.pack;}
    if(this.reference)skyline(c,p);
    else {if(!this.backgrounds.has(s.sector)){const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;skyline(canvas.getContext('2d',{alpha:false}),p);this.backgrounds.set(s.sector,canvas);}
      c.drawImage(this.backgrounds.get(s.sector),0,0);}
    if(s.mode==='foot')foot(c,s,p);else {road(c,s,p);scenery(c,s,p);actors(c,s);player(c,s);}
    if(s.mode==='road'){
      const progress=Math.min(1,s.distance/p.length);c.fillStyle='#10252dbb';c.fillRect(28,26,240,58);
      text(c,p.short.toUpperCase(),42,49,16,p.accent);c.fillStyle='#43545a';c.fillRect(42,65,210,3);c.fillStyle=p.accent;c.fillRect(42,65,210*progress,3);
      text(c,`${Math.max(0,(p.length-s.distance)/1000000).toFixed(1)} KM TO ${s.sector===s.pack.sectors.length-1?'COAST':'RELAY'}`,W-32,48,17,'#f4e5ca','right');
      text(c,String(Math.round(s.speed*.216)).padStart(3,'0'),W-35,H-68,62,'#fff0cd','right');text(c,'KM/H',W-39,H-39,16,'#dfcbae','right');
      if(Math.abs(s.x)>1000)text(c,'LOOSE SHOULDER',W/2,115,20,'#ffca7d','center');
    }
    if(s.tick<s.noticeUntil&&s.mode!=='foot'){c.fillStyle='#0e222bc9';c.fillRect(240,112,800,38);text(c,s.notice,W/2,137,16,'#f7d8a2','center');}
    const vignette=c.createRadialGradient(W/2,H/2,180,W/2,H/2,760);vignette.addColorStop(0,'#00000000');vignette.addColorStop(1,'#06151a99');c.fillStyle=vignette;c.fillRect(0,0,W,H);
  }
}
