// SPDX-License-Identifier: Apache-2.0
// Road-local arcade handling at 60 Hz. Millimetres forward; 1000 lateral units
// span one half-road. VANILLAJS math keeps clamping shared with presentation.
import {clamp} from '../vendor/vanillajs/modules/math/index.js';
export const ROAD_EDGE=1000;
export const BEND_LENGTH=280000;
export function roadBend(distance,sector,route,bends){
  const position=Math.max(0,distance)/BEND_LENGTH,index=Math.floor(position),t=position-index;
  const a=bends[(index+sector*3)%bends.length],b=bends[(index+sector*3+1)%bends.length];
  return (a+(b-a)*t*t*(3-2*t))*(route==='canyon'?2:1);
}
export function steerCar(s,direction,braking,bend){
  const v=s.pack.vehicle,offroad=Math.abs(s.x)>ROAD_EDGE;
  const response=clamp(v.grip*20,25,180);
  s.steering+=clamp(direction*1000-s.steering,-response,response);
  if(s.speed===0){s.vx=0;s.slip=0;return;}
  const pace=clamp(s.speed/850,0,1.2),traction=offroad?.50:braking?1.2:1;
  const target=s.steering/1000*v.steering*.68*pace;
  const grip=clamp(v.grip*.055*traction,.04,.65);
  s.vx=Math.round((s.vx+(target-s.vx)*grip)*1000)/1000;
  const corner=bend*(s.speed/1080)**2*.78;
  s.slip=Math.round(Math.abs(target-s.vx)*100)/100;
  s.x=clamp(Math.round((s.x+s.vx-corner)*1000)/1000,-1550,1550);
  // A hard shoulder boundary must not retain velocity pushing outwards.
  if(Math.abs(s.x)===1550&&Math.sign(s.vx)===Math.sign(s.x))s.vx=0;
}
