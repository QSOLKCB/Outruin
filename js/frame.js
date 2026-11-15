// SPDX-License-Identifier: Apache-2.0
// Adapted lifecycle pattern: QSOLKCB/STREET-RACER shared/racer/frame.js.
// Collect every tick's events and abort catch-up at each mode transition.
import {step} from './sim.js';
export function advanceFrame(clock,state,mask,elapsed){
  const events=[];
  if(!['road','foot'].includes(state.mode))return events;
  const mode=state.mode;
  clock.advance(elapsed,()=>{step(state,mask);events.push(...state.events);if(state.mode!==mode)clock.setPaused(true);});
  return events;
}
