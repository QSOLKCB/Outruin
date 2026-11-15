// SPDX-License-Identifier: Apache-2.0
// Original procedural wasteland art, with a shared road-local coordinate frame.
import {bendAt} from './sim.js';
import {clamp} from '../vendor/vanillajs/modules/math/index.js';
export const W=1280,H=720,VIEW=900000,HORIZON=230;
const BASE=H-40,CAMERA=90000,FAR=CAMERA/(CAMERA+VIEW);
const poly=(c,p,color)=>{c.fillStyle=color;c.beginPath();c.moveTo(...p[0]);for(const v of p.slice(1))c.lineTo(...v);c.closePath();c.fill();};
const text=(c,label,x,y,size=16,color='#f6e5c9',align='left')=>{c.font=`700 ${size}px monospace`;c.textAlign=align;c.fillStyle=color;c.fillText(label,x,y);};
const line=(c,points,color,width=2)=>{c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(...points[0]);for(const p of points.slice(1))c.lineTo(...p);c.stroke();};
const shade=(color,amount)=>{const n=parseInt(color.slice(1),16);return '#'+[n>>16,(n>>8)&255,n&255].map(v=>Math.round(clamp(v+amount,0,255)).toString(16).padStart(2,'0')).join('');};
function skyline(c,p){
  const sky=c.createLinearGradient(0,0,0,HORIZON+30);sky.addColorStop(0,shade(p.sky,-10));sky.addColorStop(.6,p.sky);sky.addColorStop(1,p.haze);c.fillStyle=sky;c.fillRect(0,0,W,H);
  const glow=c.createRadialGradient(1000,128,12,1000,128,225);glow.addColorStop(0,p.accent+'99');glow.addColorStop(1,p.accent+'00');c.fillStyle=glow;c.fillRect(750,0,530,380);
  c.fillStyle=p.accent;c.beginPath();c.arc(1000,128,39,0,Math.PI*2);c.fill();
  for(let layer=0;layer<4;layer++){
    const points=[[0,HORIZON+10]];
    for(let x=0;x<=W+16;x+=16){const peak=Math.sin(x*.007+layer*3)*27+Math.cos(x*.019+layer)*18+Math.sin(x*.043+layer)*6;points.push([x,HORIZON-42+layer*12-peak*(1-layer*.19)]);}
    points.push([W,HORIZON+10]);poly(c,points,layer===0?shade(p.mountain,14):layer===1?p.mountain:layer===2?p.ground:p.sand);
  }
  c.fillStyle=shade(p.mountain,-22);
  for(let i=0;i<20;i++){const x=(i*117+37)%W,h=16+(i*31)%70;c.fillRect(x,HORIZON-h,12+(i%4)*6,h);if(i%3===0){c.fillRect(x-10,HORIZON-h+10,38,4);c.fillRect(x+7,HORIZON-h-20,3,20);}}
  c.fillStyle=p.ground;c.fillRect(0,HORIZON,W,H-HORIZON);
}
// Integrate continuous curvature into the same coordinate used by vehicles.
// Road half-width is exactly x=1000, including the visible edge paint.
function aheadOffset(s,z){
  let out=0;const stride=40000;
  for(let n=0;n<z;n+=stride){const len=Math.min(stride,z-n);out+=bendAt(s.distance+n+len/2,s.sector,s.route,s.pack.bends)*len*(z-n-len/2)*.000000003;}
  return out;
}
export function project(s,z,lane=0){
  z=clamp(z,-15000,VIEW);
  const scale=(CAMERA/(CAMERA+z)-FAR)/(1-FAR),w=700*scale;
  // Forty percent of lateral position follows the car on screen; the rest moves
  // the road. Their relative displacement still represents the full lane offset.
  return {x:W/2+(aheadOffset(s,Math.max(0,z))+lane-s.x*.60)/1000*w,y:HORIZON+(BASE-HORIZON)*scale,w,f:scale};
}
function road(c,s,p){
  for(let i=0;i<112;i++){
    const z0=VIEW*(1-i/112)**2,z1=VIEW*(1-(i+1)/112)**2,a=project(s,z0),b=project(s,z1);
    // Snap shared scanline boundaries to avoid terrain-coloured AA seams.
    a.y=Math.floor(a.y);b.y=Math.ceil(b.y);
    const stripe=Math.floor((s.distance+z0)/18000)%2;
    c.fillStyle=stripe?p.ground:shade(p.ground,3);c.fillRect(0,a.y,W,b.y-a.y+1);
    const quad=(l,r,color)=>poly(c,[[a.x+a.w*l,a.y],[a.x+a.w*r,a.y],[b.x+b.w*r,b.y],[b.x+b.w*l,b.y]],color);
    quad(-1.22,1.22,stripe?p.sand:shade(p.sand,-8));
    quad(-1.06,1.06,stripe?'#857764':'#c4b498');quad(-1,1,stripe?'#30383b':'#323a3c');
    quad(-1,-.982,'#d4c5a6');quad(.982,1,'#d4c5a6');
    if(stripe){quad(-.342,-.326,'#b9b59e');quad(.326,.342,'#b9b59e');}
    // Long asphalt seams and occasional repairs are anchored to road distance.
    quad(-.68,-.674,'#202d32');quad(.64,.648,'#263136');
    if(Math.floor((s.distance+z0)/6000)%29===0)quad(-.25,.12,'#222e32');
    if(z0>250000){c.globalAlpha=clamp((z0-250000)/700000,0,.72);quad(-1.22,1.22,p.haze);c.globalAlpha=1;}
  }
  const a=project(s,0);c.fillStyle='#30383b';poly(c,[[a.x-a.w,a.y],[a.x+a.w,a.y],[a.x+a.w*1.16,H],[a.x-a.w*1.16,H]],'#30383b');
}
function car(c,x,y,w,color,kind='car',flash=false,{yaw=0,brake=false,boost=false,tick=0,speed=0}={}){
  const heavy=kind==='boss'||kind==='truck'||kind==='hauler',bike=kind==='bike',buggy=kind==='buggy';
  const h=w*(bike?1.1:heavy?.91:buggy?.57:.62);c.save();c.translate(x,y);c.transform(1,0,yaw,1,0,0);
  c.fillStyle='#080f15a0';c.beginPath();c.ellipse(0,4,w*.62,h*.14,0,0,Math.PI*2);c.fill();
  if(boost){for(const side of [-1,1])poly(c,[[side*w*.28,-h*.04],[side*w*.38,h*.40+(tick%3)*3],[side*w*.18,h*.10]],'#78edffbb');}
  const wheel=(wx,wy,ww,hh)=>{c.fillStyle='#10191f';c.fillRect(wx,wy,ww,hh);c.fillStyle='#3b4345';c.fillRect(wx+ww*.18,wy+2,ww*.64,hh-4);c.fillStyle='#151e22';for(let j=0;j<4;j++)c.fillRect(wx,wy+((j*hh/4+tick*speed/300)%hh),ww,Math.max(1,hh*.07));};
  if(bike){wheel(-w*.18,-h*.73,w*.36,h*.75);poly(c,[[-w*.4,-h*.4],[-w*.22,-h*.85],[w*.22,-h*.85],[w*.4,-h*.4]],flash?'#fff':color);c.fillStyle='#253038';c.fillRect(-w*.2,-h*1.05,w*.4,h*.55);c.fillStyle='#f4c075';c.fillRect(-w*.16,-h*.99,w*.32,h*.15);c.restore();return;}
  for(const side of [-1,1]){wheel(side<0?-w*.55:w*.35,-h*.75,w*.20,h*.77);if(heavy)wheel(side<0?-w*.54:w*.36,-h*1.1,w*.18,h*.34);}
  const paint=flash?'#fff0c0':color;
  poly(c,[[-w*.47,0],[-w*.50,-h*.45],[-w*.38,-h*1.05],[w*.38,-h*1.05],[w*.5,-h*.45],[w*.47,0]],shade(paint,-35));
  poly(c,[[-w*.45,-h*.13],[-w*.41,-h*.64],[-w*.29,-h*1.12],[w*.29,-h*1.12],[w*.41,-h*.64],[w*.45,-h*.13]],paint);
  poly(c,[[-w*.31,-h*.63],[-w*.24,-h*.98],[w*.24,-h*.98],[w*.31,-h*.63]],'#0a202d');
  poly(c,[[-w*.28,-h*.65],[-w*.22,-h*.95],[w*.05,-h*.95],[w*.14,-h*.65]],'#547c86');
  line(c,[[-w*.23,-h*.97],[w*.23,-h*.97]],'#bdd9d7',Math.max(1,w*.012));
  c.fillStyle=shade(paint,32);c.fillRect(-w*.40,-h*.52,w*.80,h*.11);
  c.fillStyle=shade(paint,-48);c.fillRect(-w*.06,-h*.60,w*.12,h*.45);
  c.fillStyle='#13232c';c.fillRect(-w*.47,-h*.23,w*.94,h*.17);
  for(let i=0;i<7;i++){c.fillStyle='#667071';c.fillRect(-w*.28+i*w*.085,-h*.20,w*.045,h*.08);}
  c.fillStyle='#a5a18e';c.fillRect(-w*.52,-h*.08,w*1.04,h*.08);c.fillStyle='#1a292f';c.fillRect(-w*.40,-h*.06,w*.07,h*.15);c.fillRect(w*.33,-h*.06,w*.07,h*.15);
  c.fillStyle=brake?'#fff0d3':'#f34f33';for(const side of [-1,1]){c.fillRect(side<0?-w*.43:w*.25,-h*.33,w*.18,h*.09);if(brake){c.fillStyle='#ff422966';c.fillRect(side<0?-w*.48:w*.20,-h*.37,w*.28,h*.2);c.fillStyle='#fff0d3';}}
  // Armour rivets, engine vents, roof rails and visible weapon barrels.
  c.fillStyle='#26353c';for(let i=0;i<5;i++)c.fillRect(-w*.28+i*w*.12,-h*.47,w*.07,h*.08);
  for(const side of [-1,1]){c.fillStyle='#9c9b89';c.fillRect(side*w*.36,-h*.64,w*.018,h*.32);c.fillStyle='#23363c';c.fillRect(side*w*.26-w*.025,-h*1.10,w*.05,h*.30);c.fillStyle='#8b9690';c.fillRect(side*w*.26-w*.012,-h*1.25,w*.024,h*.20);}
  if(heavy){c.fillStyle='#24353b';c.fillRect(-w*.31,-h*1.15,w*.62,h*.38);for(let i=0;i<5;i++){c.fillStyle=shade(paint,-15);c.fillRect(-w*.27+i*w*.11,-h*1.12,w*.07,h*.28);}}
  if(buggy){line(c,[[-w*.4,-h*.1],[-w*.32,-h*1.15],[w*.32,-h*1.15],[w*.4,-h*.1]],'#9eaa9c',w*.035);}
  c.restore();
}
function scenery(c,s,p){
  const start=Math.floor(s.distance/30000)*30000;
  for(let d=start+VIEW;d>start;d-=30000){const z=d-s.distance;if(z<3000||z>VIEW)continue;const a=project(s,z),size=a.w*.20,id=Math.floor(d/30000);
    for(const side of [-1,1]){const x=a.x+side*a.w*(1.25+(id%3)*.35),y=a.y,which=(id+side+9)%7;
      if(size<3)continue;c.globalAlpha=clamp(a.f*3,.25,1);
      if(which===0){const ht=size*(s.sector===2?2.8:1.5);poly(c,[[x-size*.7,y],[x-size*.3,y-ht],[x+size*.2,y-ht*.9],[x+size*.7,y]],p.mountain);poly(c,[[x-size*.3,y-ht],[x+size*.2,y-ht*.9],[x+size*.7,y],[x,y]],shade(p.mountain,-16));}
      else if(which===1){line(c,[[x-size*.4,y],[x,y-size*3],[x+size*.4,y]],shade(p.mountain,-20),Math.max(1,size*.045));for(let j=1;j<4;j++)line(c,[[x-size*.6,y-size*j*.7],[x+size*.6,y-size*j*.7]],shade(p.mountain,-18),Math.max(1,size*.04));}
      else if(which===2){c.fillStyle='#465452';c.fillRect(x-size*.04,y-size*1.7,size*.08,size*1.7);c.fillStyle='#18343d';c.fillRect(x-size*.8,y-size*1.8,size*1.6,size*.7);line(c,[[x-size*.75,y-size*1.75],[x+size*.75,y-size*1.75]],p.accent,Math.max(1,size*.035));if(size>27)text(c,side>0?'COAST →':'RELAY 09',x,y-size*1.39,size*.19,p.accent,'center');}
      else if(which===3){car(c,x,y,size*1.6,shade(p.ground,-22),'buggy');}
      else if(which===4){line(c,[[x,y],[x-size*.12,y-size*1.1],[x+size*.08,y-size*2]],p.mountain,size*.09);line(c,[[x,y-size*.7],[x-size*.5,y-size*1.2],[x-size*.55,y-size*1.5]],p.mountain,size*.08);}
      else if(which===5){c.fillStyle=shade(p.mountain,-10);c.fillRect(x-size,y-size*.8,size*2,size*.8);poly(c,[[x-size*1.1,y-size*.8],[x-size*.4,y-size*1.3],[x+size*1.1,y-size*.8]],p.mountain);c.fillStyle='#182b31';c.fillRect(x-size*.5,y-size*.6,size*.4,size*.6);}
      else {for(let j=0;j<3;j++)poly(c,[[x+j*size*.3,y],[x+(j*.3-.1)*size,y-size*(.2+j*.12)],[x+(j*.3+.2)*size,y]],shade(p.sand,16));}
      c.globalAlpha=1;
    }
  }
  // Reflective roadside delineators show motion and the true shoulder boundary.
  for(let d=Math.ceil(s.distance/12000)*12000;d<s.distance+260000;d+=12000){const a=project(s,d-s.distance);for(const side of [-1,1]){const x=a.x+side*a.w*1.08,ht=a.w*.055;c.fillStyle='#192b32';c.fillRect(x,a.y-ht,Math.max(1,a.w*.007),ht);c.fillStyle=p.accent;c.fillRect(x,a.y-ht,Math.max(1,a.w*.007),ht*.3);}}
}
export function forwardTarget(s){return s.entities.filter(e=>e.hp>0&&!['fuel','ammo'].includes(e.kind)&&e.z>s.distance&&e.z-s.distance<s.pack.weapons.forward.range&&Math.abs(e.x-s.x)<240).sort((a,b)=>a.z-b.z||a.id-b.id)[0]??null;}
function actors(c,s){
  const target=forwardTarget(s),sorted=[...s.entities.filter(e=>e.z-s.distance>-12000&&e.z-s.distance<VIEW).map(e=>({...e,type:'entity'})),...s.particles.filter(e=>e.z-s.distance>-12000&&e.z-s.distance<VIEW).map(e=>({...e,type:'blast'}))].sort((a,b)=>b.z-a.z);
  for(const e of sorted){const a=project(s,e.z-s.distance,e.x),size=a.w*(e.kind==='boss'?.52:e.kind==='truck'?.40:e.kind==='bike'?.11:.27);
    if(e.type==='blast'){const age=40-e.ttl;for(let i=0;i<8;i++){const angle=i*2.4,spread=age*a.f*2.5;c.fillStyle=i%2?'#ffd48a':'#ff713c';c.globalAlpha=e.ttl/40;c.beginPath();c.arc(a.x+Math.cos(angle)*spread,a.y-a.w*.1+Math.sin(angle)*spread,Math.max(1,a.w*.09*(e.ttl/40)),0,Math.PI*2);c.fill();}c.globalAlpha=1;continue;}
    if(e.kind==='fuel'||e.kind==='ammo'){const w=Math.max(5,a.w*.12);c.fillStyle=e.kind==='fuel'?'#81cbbb':'#dfae68';c.fillRect(a.x-w/2,a.y-w,w,w);line(c,[[a.x-w/2,a.y-w*.8],[a.x+w/2,a.y-w*.8]],'#16313a',w*.12);if(a.f>.12)text(c,e.kind.toUpperCase(),a.x,a.y-w-12,12,'#c8efda','center');continue;}
    car(c,a.x,a.y,Math.max(2,size),s.pack.enemies[e.kind].color,e.kind,e.flash>0,{tick:s.tick,speed:e.speed});
    if(e.shot<=42&&e.z-s.distance>10000&&e.z-s.distance<240000){const radius=Math.max(8,size*.22);line(c,[[a.x-radius,a.y-size*1.35],[a.x,a.y-size*1.35-radius*1.5],[a.x+radius,a.y-size*1.35]],'#ff795d',3);if(a.f>.2)text(c,'INCOMING',a.x,a.y-size*1.35-radius*1.7,11,'#ffaf78','center');}
    if(target?.id===e.id){const w=size*.7,h=size*1.3;for(const side of [-1,1])line(c,[[a.x+side*w*.7,a.y-h],[a.x+side*w,a.y-h],[a.x+side*w,a.y+4],[a.x+side*w*.7,a.y+4]],'#a9edce',2);if(a.f>.12)text(c,'IN RANGE',a.x,a.y+18,10,'#a9edce','center');}
    if(e.kind==='boss'||e.flash>0){const w=Math.max(30,size);c.fillStyle='#111f29';c.fillRect(a.x-w/2,a.y-size*1.7,w,5);c.fillStyle='#f38e62';c.fillRect(a.x-w/2,a.y-size*1.7,w*Math.max(0,e.hp)/s.pack.enemies[e.kind].hp,5);}
  }
}
function combat(c,s){
  const player=project(s,0,s.x);
  for(const t of s.tracers){const end=project(s,t.z-s.distance,t.x);c.globalAlpha=t.ttl/6;line(c,[[player.x-34,BASE-118],[end.x,end.y-15]],'#ffdf8d',2);line(c,[[player.x+34,BASE-118],[end.x,end.y-15]],'#ffdf8d',2);if(t.hit){line(c,[[end.x-8,end.y-20],[end.x+8,end.y-4]],'#fff8d3',3);line(c,[[end.x+8,end.y-20],[end.x-8,end.y-4]],'#fff8d3',3);}c.globalAlpha=1;}
  for(const b of s.projectiles){const a=project(s,b.z-s.distance,b.x),tail=project(s,b.z-s.distance+16000,b.x);line(c,[[tail.x,tail.y-12],[a.x,a.y-12]],'#ff835f',Math.max(2,a.f*6));c.fillStyle='#fff0bc';c.beginPath();c.arc(a.x,a.y-12,Math.max(2,a.f*4),0,Math.PI*2);c.fill();}
}
function player(c,s){
  const a=project(s,0,s.x),x=a.x,y=BASE,boost=Boolean((s.lastMask&32)&&s.boost>0&&!s.boostLocked&&(s.lastMask&4)&&s.fuel>0),brake=Boolean(s.lastMask&8);
  if(s.speed>100){for(let i=0;i<10;i++){const life=((s.tick*3+i*13)%50)/50;c.globalAlpha=(1-life)*(Math.abs(s.x)>1000?.5:.16);c.fillStyle=s.pack.sectors[s.sector].sand;for(const side of [-1,1]){c.beginPath();c.ellipse(x+side*(78+life*70),y+life*50,8+life*25,4+life*14,0,0,Math.PI*2);c.fill();}}c.globalAlpha=1;}
  car(c,x,y,195,s.pack.vehicle.color,s.pack.vehicle.body,s.tick-s.hitTick<14&&s.tick%4<2,{yaw:-s.steering/1000*.10,brake,boost,tick:s.tick,speed:s.speed});
  if(s.cooldown>s.pack.weapons.forward.interval-4){for(const side of [-1,1])poly(c,[[x+side*51-5,y-145],[x+side*51,y-175-(s.tick%3)*6],[x+side*51+5,y-145]],'#fff1b9');}
  if(s.sideCooldown>s.pack.weapons.side.interval-5){const side=s.lastMask&128?-1:1;poly(c,[[x+side*93,y-43],[x+side*160,y-55],[x+side*96,y-63]],'#ffce78');}
}
function cockpit(c,s,p){
  c.fillStyle='#081d29cc';c.fillRect(24,22,258,70);text(c,`${String(s.sector+1).padStart(2,'0')} / ${p.short.toUpperCase()}`,38,46,15,p.accent);text(c,s.route==='canyon'?'CANYON CUT':'COASTBOUND HIGHWAY',38,65,10,'#b9c5bb');
  c.fillStyle='#455658';c.fillRect(38,79,229,3);c.fillStyle=p.accent;c.fillRect(38,79,229*clamp(s.distance/p.length,0,1),3);
  text(c,`${Math.max(0,(p.length-s.distance)/1000000).toFixed(1)} KM TO ${s.sector===s.pack.sectors.length-1?'COAST':'RELAY'}`,W-28,42,15,'#f6e6c4','right');
  // A compact 400 m route preview; curvature comes from the same authored road.
  c.fillStyle='#0b202ba8';c.fillRect(W-177,64,150,190);text(c,'ROAD AHEAD',W-102,85,10,'#bccabe','center');
  const points=[];for(let z=0;z<=400000;z+=10000)points.push([W-102+clamp(aheadOffset(s,z)/80,-56,56),232-z/3000]);line(c,points,'#738e8c',7);line(c,points,'#d8c9a1',1);
  for(const e of s.entities){const z=e.z-s.distance;if(z<0||z>400000)continue;const x=W-102+clamp(aheadOffset(s,z)/80,-56,56)+e.x/180;c.fillStyle=['fuel','ammo'].includes(e.kind)?'#a3e3c8':'#f4936e';c.fillRect(x-2,232-z/3000-2,4,4);}
  poly(c,[[W-102+s.x/180,226],[W-107+s.x/180,237],[W-97+s.x/180,237]],'#edcf93');
  c.fillStyle='#0a1b26d9';c.fillRect(W-227,H-137,202,110);text(c,String(Math.round(s.speed*.216)).padStart(3,'0'),W-42,H-65,58,'#fff0d0','right');text(c,'KM/H',W-44,H-43,13,p.accent,'right');
  text(c,s.speed<5?'N':'D',W-204,H-72,30,p.accent);text(c,'AUTO',W-204,H-48,10,'#97aca8');
  for(let i=0;i<16;i++){c.fillStyle=i<Math.round(s.speed/(s.pack.vehicle.topSpeed+s.pack.vehicle.boostPower)*16)?i>12?'#ec895e':p.accent:'#31414a';c.fillRect(W-209+i*10,H-122,6,6);}
  text(c,forwardTarget(s)?'TARGET IN RANGE / FIRE':'ALIGN THE FORWARD GUNS',28,H-48,12,forwardTarget(s)?'#b0ebcd':'#b5c2b8');
  if(Math.abs(s.x)>1000)text(c,'LOOSE SHOULDER / EASE BACK ON',W/2,113,17,'#ffd08b','center');
  else if(s.speed<10&&s.tick<240)text(c,'HOLD W / ↑ TO DRIVE',W/2,420,21,'#ffda96','center');
  else if(s.fuel<s.pack.vehicle.fuelCapacity*.15)text(c,'LOW FUEL / BRAKE + E TO SCAVENGE',W/2,113,17,'#ffd08b','center');
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
  constructor(canvas){this.canvas=canvas;canvas.width=W;canvas.height=H;this.ctx=canvas.getContext('2d',{alpha:false});this.backgrounds=new Map();this.pack=null;this.reference=false;this.reducedMotion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;}
  draw(state,alpha=1,previous=null){
    // Interpolate presentation only. Simulation/replay always retain exact ticks.
    const s={...state};if(previous&&previous.mode===state.mode&&previous.sector===state.sector){for(const k of ['x','distance','vx','steering'])s[k]=previous[k]+(state[k]-previous[k])*alpha;}
    const c=this.ctx,p=s.pack.sectors[s.sector];
    if(this.pack!==s.pack){this.backgrounds.clear();this.pack=s.pack;}
    if(this.reference)skyline(c,p);else{if(!this.backgrounds.has(s.sector)){const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;skyline(canvas.getContext('2d',{alpha:false}),p);this.backgrounds.set(s.sector,canvas);}c.drawImage(this.backgrounds.get(s.sector),0,0);}
    c.save();
    if(!this.reducedMotion&&s.mode==='road'&&s.tick-s.hitTick<14){const amplitude=(14-(s.tick-s.hitTick))*.22;c.translate(Math.sin(s.tick*2.1)*amplitude,Math.cos(s.tick*1.7)*amplitude);}
    if(s.mode==='foot')foot(c,s,p);else{road(c,s,p);scenery(c,s,p);actors(c,s);combat(c,s);player(c,s);}
    c.restore();
    const vignette=c.createRadialGradient(W/2,H/2,220,W/2,H/2,780);vignette.addColorStop(0,'#00000000');vignette.addColorStop(1,'#06151a8c');c.fillStyle=vignette;c.fillRect(0,0,W,H);
    if(s.mode==='road')cockpit(c,s,p);
    if(s.tick<s.noticeUntil&&s.mode!=='foot'){c.fillStyle='#0e222bdb';c.fillRect(300,27,680,34);text(c,s.notice,W/2,49,13,'#f7d8a2','center');}
  }
}
