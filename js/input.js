// SPDX-License-Identifier: Apache-2.0
import {INPUT} from './config.js';
export const ACTIONS=['left','right','throttle','brake','fire','boost','interact','jump','leftShot','rightShot','pause'];
const keymap={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowUp:'throttle',KeyW:'throttle',ArrowDown:'brake',KeyS:'brake',Space:'fire',KeyX:'boost',ShiftLeft:'boost',ShiftRight:'boost',KeyF:'interact',KeyE:'interact',KeyQ:'leftShot',KeyC:'rightShot',KeyJ:'jump'};
export const PROFILES={
  xbox:{left:{axis:0,sign:-1},right:{axis:0,sign:1},throttle:{button:7},brake:{button:6},fire:{button:0},boost:{button:1},interact:{button:2},jump:{button:3},leftShot:{button:4},rightShot:{button:5},pause:{button:9}},
  snes:{left:{axis:0,sign:-1},right:{axis:0,sign:1},throttle:{axis:1,sign:-1},brake:{axis:1,sign:1},fire:{button:0},boost:{button:1},interact:{button:3},jump:{button:2},leftShot:{button:4},rightShot:{button:5},pause:{button:9}}
};
export function bindingActive(pad,b){return Boolean(b&&(b.button!==undefined?pad.buttons[b.button]?.pressed:((pad.axes[b.axis]??0)*b.sign>.35)));}
export function padState(pad,profile){
  if(!pad||!pad.connected)return {mask:0,pause:false};
  let mask=0;for(const action of ACTIONS)if(INPUT[action]&&bindingActive(pad,profile[action]))mask|=INPUT[action];
  // Standard pads also expose a standard digital D-pad.
  if(pad.mapping==='standard'){if(pad.buttons[14]?.pressed)mask|=INPUT.left;if(pad.buttons[15]?.pressed)mask|=INPUT.right;
    if(pad.buttons[12]?.pressed)mask|=INPUT.throttle;if(pad.buttons[13]?.pressed)mask|=INPUT.brake;}
  return {mask,pause:bindingActive(pad,profile.pause)};
}
export function validBindings(value){
  if(!value||typeof value!=='object'||Object.keys(value).some(k=>!ACTIONS.includes(k)))return false;
  return ACTIONS.every(k=>{const b=value[k];return b&&((Object.keys(b).length===1&&Number.isInteger(b.button)&&b.button>=0&&b.button<40)||
    (Object.keys(b).length===2&&Number.isInteger(b.axis)&&b.axis>=0&&b.axis<12&&[-1,1].includes(b.sign)));});
}
export class Controls {
  constructor({playing,onPause,onPad,onBinding}) {
    Object.assign(this,{playing,onPause,onPad,onBinding,profile:'xbox',custom:null,pad:null,padName:'',waiting:null,armed:false,blocked:true,previousPause:false,pending:0});
    this.keys=new Set();this.touch=new Map();
    addEventListener('keydown',e=>{
      if(e.target.closest('input,textarea,select,[contenteditable="true"]'))return;
      if(['Escape','KeyP'].includes(e.code)&&playing()){e.preventDefault();if(!e.repeat)onPause();return;}
      const action=keymap[e.code];if(!action||!playing())return;
      // Combat owns Space even after a toolbar click; menus retain native activation.
      e.preventDefault();this.keys.add(e.code);this.pending|=INPUT[action]??0;
    });
    addEventListener('keyup',e=>{const action=keymap[e.code];if(action)this.keys.delete(e.code);});
    addEventListener('blur',()=>this.clear());
    addEventListener('gamepaddisconnected',()=>{this.clear();if(playing())onPause(true);});
    for(const button of document.querySelectorAll('[data-control]')) {
      button.addEventListener('pointerdown',e=>{if(!playing())return;e.preventDefault();button.setPointerCapture(e.pointerId);this.touch.set(e.pointerId,button.dataset.control);this.pending|=INPUT[button.dataset.control]??0;button.classList.add('held');});
      const release=e=>{this.touch.delete(e.pointerId);button.classList.remove('held');};
      button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
    }
  }
  clear(){this.pending=0;this.keys.clear();this.touch.clear();this.blocked=true;document.querySelectorAll('.held').forEach(b=>b.classList.remove('held'));}
  bind(action){this.clear();this.waiting=action;this.armed=false;}
  cancelBind(){this.waiting=null;this.armed=false;}
  poll(){
    const pads=navigator.getGamepads?.()??[];this.pad=Array.from(pads).find(p=>p?.connected)??null;
    const name=this.pad?.id??'No controller connected';if(name!==this.padName){this.padName=name;this.onPad(name);}
    if(!this.pad){this.previousPause=false;return 0;}
    const bindings=this.custom??PROFILES[this.profile];
    if(this.waiting){
      const b=this.pad.buttons.findIndex(b=>b.pressed),a=this.pad.axes.findIndex(v=>Math.abs(v)>.6);
      if(b<0&&a<0){this.armed=true;return 0;}
      if(this.armed){const binding=b>=0?{button:b}:{axis:a,sign:Math.sign(this.pad.axes[a])},action=this.waiting;
        this.custom={...bindings,[action]:binding};this.waiting=null;this.clear();this.onBinding(action,binding);}
      return 0;
    }
    const state=padState(this.pad,bindings);
    if(this.blocked){if(state.mask===0&&!state.pause)this.blocked=false;this.previousPause=state.pause;return 0;}
    if(state.pause&&!this.previousPause)this.onPause();this.previousPause=state.pause;
    return state.mask;
  }
  consume(){this.pending=0;}
  mask(padMask){let m=padMask|this.pending;for(const k of this.keys)m|=INPUT[keymap[k]]??0;for(const k of this.touch.values())m|=INPUT[k]??0;return m;}
}
