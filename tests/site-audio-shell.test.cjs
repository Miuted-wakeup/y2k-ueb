const { test } = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../site-audio-core.js');
const load = () => require('../site-audio-shell.js');
const flush = async () => { for (let i=0;i<8;i++) await Promise.resolve(); };
function fixture({allowed=false,href='https://example.test/blog/tech.html?view=retro#hardware'}={}) {
  const listeners=new Map(), timers=new Map(), frames=[], phases=[], commands=[], releases=[], history=[];
  let serial=0, sequence=0, subscriber, unlockEvent, destroyed=0;
  const media={src:'https://example.test/blog/assets/music/kirby.mp3',paused:true,playing:false,ended:false,currentTime:0,duration:null,volume:.5,muted:false};
  let permission=allowed?'active':'blocked';
  const engine={snapshot:()=>({revision:0,permission,contextState:permission==='active'?'running':'suspended',music:{...media,index:0,title:'x',artist:'y'},favorite:{...media},speech:{supported:true,unlocked:permission==='active',activeNotes:0,blipsPlayed:0}}),
    subscribe(fn){subscriber=fn;return()=>{subscriber=null;};},probe:()=>Promise.resolve(allowed),
    unlock(event){unlockEvent=event;permission=event.isTrusted?'active':'blocked';subscriber?.();return Promise.resolve(permission==='active');},
    continueSilent(){permission='silent';subscriber?.();},execute(cmd,lease){commands.push({cmd,lease});return Promise.resolve(true);},releaseLease:name=>releases.push(name),destroy(){destroyed++;return Promise.resolve();}};
  const win={location:{href},document:{hidden:false},history:{pushState(_,__,url){history.push(url);win.location.href=url;},replaceState(_,__,url){win.location.href=url;}},
    addEventListener(name,fn){listeners.set(name,fn);},removeEventListener(name){listeners.delete(name);},
    setTimeout(fn,delay){const id=++serial;timers.set(id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id)};
  const controller=load().createController({window:win,Core,engine,token:()=>String(++sequence).padStart(32,'0'),
    createFrame(route,token,epoch){const frame={route,token,epoch,sent:[],removed:false,contentWindow:{postMessage(data,origin){frame.sent.push({data,origin});}},remove(){this.removed=true;}};frames.push(frame);return frame;},
    onPhase:s=>phases.push(s)});
  const message=(kind,extra={},frame=frames.at(-1))=>({source:frame.contentWindow,origin:new URL(href).origin,data:{channel:Core.PROTOCOL,kind,token:frame.token,epoch:frame.epoch,...extra}});
  return {controller,engine,win,frames,phases,commands,releases,history,message,listeners,
    unlockEvent:()=>unlockEvent,destroyed:()=>destroyed,advance(delay){for(const[id,t]of[...timers])if(t.delay===delay){timers.delete(id);t.fn();}}};
}
test('direct TECH is held until actual activation then reveal, with original query/hash',async()=>{
  const f=fixture();f.controller.start();await flush();assert.equal(f.controller.snapshot().route.section,'tech');assert.equal(f.controller.snapshot().entered,false);
  f.controller.receive(f.message('hello'));assert.equal(f.frames[0].sent.at(-1).data.state.entered,false);
  const event={isTrusted:true,type:'click'};f.controller.activate(event);assert.equal(f.unlockEvent(),event);await flush();
  assert.equal(f.controller.snapshot().phase,'revealing');assert.equal(f.controller.snapshot().entered,false);f.advance(600);
  assert.equal(f.controller.snapshot().entered,true);assert.match(f.controller.snapshot().route.href,/tech\.html\?view=retro#hardware$/);f.controller.destroy();
});
test('native-allowed startup does not require another button; synthetic activation cannot grant',async()=>{
  const good=fixture({allowed:true});good.controller.start();await flush();assert.equal(good.controller.snapshot().phase,'complete');assert.equal(good.controller.snapshot().entered,true);assert.equal(good.unlockEvent(),undefined);good.controller.destroy();
  const bad=fixture();bad.controller.start();await flush();bad.controller.activate({isTrusted:false,type:'click'});await flush();assert.equal(bad.controller.snapshot().entered,false);bad.controller.destroy();
});
test('one parent history entry replaces the child realm, not the engine; stale source/token rejected',async()=>{
  const f=fixture({allowed:true});f.controller.start();await flush();const old=f.frames[0];
  assert.equal(f.controller.navigate('music.html'),true);assert.equal(f.history.length,1);assert.equal(f.frames.length,2);assert.equal(old.removed,true);assert.deepEqual(f.releases,['route:1']);
  const fresh=f.frames[1];assert.notEqual(fresh.contentWindow,old.contentWindow);assert.notEqual(fresh.token,old.token);
  assert.equal(f.controller.receive(f.message('command',{id:'c1',command:{type:'music',action:'next'}},old)),false);
  const wrong=f.message('command',{id:'c1',command:{type:'music',action:'next'}});wrong.data.token='0'.repeat(32);assert.equal(f.controller.receive(wrong),false);assert.equal(f.commands.length,0);f.controller.destroy();
});
test('native command ACK waits for completion and duplicate request IDs never execute twice',async()=>{
  const f=fixture({allowed:true});f.controller.start();await flush();f.controller.receive(f.message('hello'));
  let done;f.engine.execute=(cmd,lease)=>{f.commands.push({cmd,lease});return new Promise(resolve=>done=resolve);};
  const request=f.message('command',{id:'c1',command:{type:'music',action:'play'}});f.controller.receive(request);f.controller.receive(request);await flush();
  assert.equal(f.commands.length,1);assert.equal(f.frames[0].sent.filter(m=>m.data.kind==='ack').length,0);done(true);await flush();
  assert.equal(f.frames[0].sent.filter(m=>m.data.kind==='ack').length,2);assert.ok(f.frames[0].sent.filter(m=>m.data.kind==='ack').every(m=>m.data.ok));f.controller.destroy();
});
test('file hash route reloads destination and hash-only navigation keeps its child/lease',async()=>{
  const f=fixture({allowed:true,href:'file:///C:/mi%20web/index.html#/tech.html?x=1#hardware'});f.controller.start();await flush();assert.equal(f.controller.snapshot().route.section,'tech');
  f.controller.navigate('music.html');assert.equal(Core.initialRoute(f.win.location.href).section,'music');const frame=f.frames.at(-1),epoch=frame.epoch;
  f.controller.navigate('#synth');assert.equal(f.frames.at(-1),frame);assert.equal(f.controller.snapshot().epoch,epoch);assert.equal(frame.sent.at(-1).data.kind,'replace');f.controller.destroy();
});
test('silent continuation and final destroy invalidate late unlocks and future messages',async()=>{
  const f=fixture();f.controller.start();await flush();let resolve;f.engine.unlock=()=>new Promise(r=>resolve=r);
  f.controller.activate({isTrusted:true});f.controller.silence();f.advance(600);assert.equal(f.controller.snapshot().entered,true);resolve(true);await flush();assert.equal(f.controller.snapshot().phase,'complete');
  f.controller.destroy();f.controller.destroy();assert.equal(f.destroyed(),1);assert.equal(f.controller.receive(f.message('hello')),false);
});
