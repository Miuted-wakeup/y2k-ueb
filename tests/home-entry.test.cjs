const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createEntryController } = require('../home-companion.js');
function fixture(unlock = () => Promise.resolve(true), reducedMotion = false) {
  let time=0,serial=0;const timers=new Map(),phases=[],released=[],abandoned=[];
  const controller=createEntryController({unlock,reducedMotion,
    setTimer(fn,delay){const id=++serial;timers.set(id,{fn,at:time+delay});return id;},clearTimer:id=>timers.delete(id),
    onPhase:s=>phases.push(s),onRelease:s=>released.push(s),onAbandonSound:()=>abandoned.push(true)});
  return {controller,timers,phases,released,abandoned,advance(ms){const end=time+ms;for(let i=0;i<30;i++){const next=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;time=next[1].at;timers.delete(next[0]);next[1].fn();}time=end;}};
}
const flush=async()=>{await Promise.resolve();await Promise.resolve();};
test('trusted primary unlock is invoked synchronously, release waits for running result and 600ms reveal',async()=>{
  const calls=[];let resolve;const f=fixture(event=>{calls.push(event);return new Promise(r=>resolve=r);});const event={isTrusted:true,type:'click'};
  f.controller.requestSound(event);assert.deepEqual(calls,[event]);assert.equal(f.controller.snapshot().phase,'unlocking');f.advance(2000);assert.equal(f.released.length,0);
  resolve(true);await flush();assert.equal(f.controller.snapshot().phase,'revealing');f.advance(599);assert.equal(f.released.length,0);f.advance(1);assert.deepEqual(f.released,[{sound:true}]);assert.equal(f.timers.size,0);
});
test('silent path does not call unlock; abandons sound and releases once',()=>{
  let calls=0;const f=fixture(()=>{calls++;return true;});f.controller.enterSilent();f.controller.enterSilent();f.controller.requestSound({});f.advance(6000);
  assert.equal(calls,0);assert.equal(f.abandoned.length,1);assert.deepEqual(f.released,[{sound:false}]);assert.equal(f.controller.snapshot().phase,'complete');assert.equal(f.timers.size,0);
});
test('failed/unsupported audio keeps entry reachable and permits retry or explicit silence',async()=>{
  let calls=0;const f=fixture(()=>Promise.resolve(++calls>1));f.controller.requestSound({});await flush();assert.equal(f.controller.snapshot().phase,'failed');assert.equal(f.released.length,0);
  f.controller.requestSound({});await flush();f.advance(600);assert.deepEqual(f.released,[{sound:true}]);
  const g=fixture(()=>{throw new Error('unsupported');});g.controller.requestSound({});assert.equal(g.controller.snapshot().phase,'failed');g.controller.enterSilent();g.advance(600);assert.deepEqual(g.released,[{sound:false}]);
});
test('pending native resume times out to an escapeable entry; old promise cannot override silence',async()=>{
  let resolve;const f=fixture(()=>new Promise(r=>resolve=r));f.controller.requestSound({});f.advance(2500);assert.equal(f.controller.snapshot().phase,'failed');assert.equal(f.timers.size,0);
  f.controller.enterSilent();resolve(true);await flush();f.advance(600);assert.deepEqual(f.released,[{sound:false}]);assert.equal(f.abandoned.length,1);assert.equal(f.timers.size,0);
});
test('duplicate requests and stale attempts never consume/release twice',async()=>{
  let resolve,calls=0;const f=fixture(()=>{calls++;return new Promise(r=>resolve=r);});f.controller.requestSound({});f.controller.requestSound({});assert.equal(calls,1);
  f.advance(2500);f.controller.requestSound({});assert.equal(calls,2);resolve(true);await flush();f.advance(600);f.controller.requestSound({});f.controller.enterSilent();assert.equal(f.released.length,1);assert.equal(calls,2);
});
test('destroy/pagehide/hidden invalidation prevents all late reveals/releases and is idempotent',async()=>{
  let resolve;const f=fixture(()=>new Promise(r=>resolve=r));f.controller.requestSound({});f.controller.destroy();f.controller.destroy();resolve(true);await flush();f.advance(10000);
  assert.equal(f.controller.snapshot().phase,'destroyed');assert.equal(f.released.length,0);assert.equal(f.timers.size,0);assert.equal(f.abandoned.length,1);f.controller.enterSilent();f.controller.requestSound({});assert.equal(f.released.length,0);
});
test('reduced-motion entry retains a brief static reveal, without changing consent policy',async()=>{
  const f=fixture(()=>Promise.resolve(true),true);f.controller.requestSound({});await flush();assert.equal(f.controller.snapshot().reducedMotion,true);f.advance(599);assert.equal(f.released.length,0);f.advance(1);assert.equal(f.released.length,1);
});
