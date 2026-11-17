const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const api=()=>require('../site-audio-client.js');
const token='a'.repeat(32),epoch=2;
function snapshot(extra={}){const media={src:'http://local/assets/music/a.mp3',paused:true,playing:false,ended:false,currentTime:0,duration:null,volume:.5,muted:false};return {revision:1,permission:'active',contextState:'running',music:{...media,index:0,title:'A',artist:'B'},favorite:{...media},speech:{supported:true,unlocked:true,activeNotes:0,blipsPlayed:0},entered:true,publicURL:'http://local/tech.html',section:'tech',...extra};}
function fixture(file=false){
  const events=new Map(),sent=[],timers=new Map();let serial=0;
  const parent={postMessage:(message,origin)=>sent.push({message,origin})};
  const win={parent,location:{href:file?'file:///C:/site/tech.html?__y2k_frame='+token+'&__y2k_epoch=2':'http://local/tech.html?__y2k_frame='+token+'&__y2k_epoch=2',replace:href=>{win.replaced=href;}},Event,EventTarget,
    setTimeout(fn,ms){const id=++serial;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),
    addEventListener(type,fn){if(!events.has(type))events.set(type,new Set());events.get(type).add(fn);},removeEventListener:(type,fn)=>events.get(type)?.delete(fn),
    document:{head:{children:[],appendChild(node){this.children.push(node);}},createElement:()=>({setAttribute(k,v){this[k]=v;}}),addEventListener(type,fn){if(!events.has('doc:'+type))events.set('doc:'+type,new Set());events.get('doc:'+type).add(fn);},removeEventListener:(type,fn)=>events.get('doc:'+type)?.delete(fn)}};
  const Core={messageOrigin:require('../site-audio-core.js').messageOrigin,PROTOCOL:'muted-audio/v1',FRAME_PARAM:'__y2k_frame',EPOCH_PARAM:'__y2k_epoch',PLAYLIST:[{src:'assets/music/a.mp3'}],frameInfo:()=>({token,epoch,publicURL:file?'file:///C:/site/tech.html':'http://local/tech.html'}),resolveRoute(href,base){try{const url=new URL(href,base);return /\/(index|tech|music|japan|canto|sobre-mi|cosas)\.html$/.test(url.pathname)?{href:url.href,section:'tech',fileHref:url.href}:null;}catch{return null;}}};
  const client=api().createClient({window:win,Core});
  const receive=(message,overrides={})=>{for(const fn of events.get('message')||[])fn({source:parent,origin:file?'null':'http://local',data:{channel:Core.PROTOCOL,token,epoch,...message},...overrides});};
  return {client,win,Core,parent,sent,timers,events,receive};
}
test('ready waits for a validated parent state; spoofed/stale/malformed envelopes have no effect',async()=>{
  const f=fixture();let ready=false;f.client.ready.then(()=>ready=true);assert.equal(f.sent[0].message.kind,'hello');
  f.receive({kind:'state',state:snapshot()},{source:{}});f.receive({kind:'state',state:snapshot()},{origin:'http://evil'});f.receive({kind:'state',state:snapshot(),epoch:1});f.receive({kind:'state',state:{entered:true}});await Promise.resolve();assert.equal(ready,false);
  f.receive({kind:'state',state:snapshot()});await f.client.ready;assert.equal(ready,true);assert.equal(f.client.getPlayer().duration,NaN);assert.equal(f.client.state().section,'tech');
  const s=f.client.state();s.music.currentTime=999;assert.equal(f.client.getPlayer().currentTime,0,'Callers cannot mutate authority');
});
test('media play resolves/rejects only matching actual native ACK; state events do not fake success',async()=>{
  const f=fixture();f.receive({kind:'state',state:snapshot()});await f.client.ready;const player=f.client.getPlayer();let resolved=false,plays=0;player.addEventListener('play',()=>plays++);
  const promise=player.play().then(()=>resolved=true);const id=f.sent.at(-1).message.id;
  f.receive({kind:'state',state:snapshot({revision:2,music:{...snapshot().music,paused:false,playing:true}})});await Promise.resolve();assert.equal(resolved,false);assert.equal(plays,1);
  f.receive({kind:'ack',id:'wrong',ok:true,state:snapshot()});await Promise.resolve();assert.equal(resolved,false);
  f.receive({kind:'ack',id,ok:true,state:snapshot({revision:2,music:{...snapshot().music,paused:false,playing:true}})});await promise;assert.equal(resolved,true);
  const rejected=player.play();f.receive({kind:'ack',id:f.sent.at(-1).message.id,ok:false,error:{name:'NotAllowedError',message:'Blocked'},state:snapshot({revision:3})});await assert.rejects(rejected,{name:'NotAllowedError'});
});
test('facade setters send commands without optimistic state or local media/storage',async()=>{
  const f=fixture();f.receive({kind:'state',state:snapshot()});await f.client.ready;const p=f.client.getPlayer();p.currentTime=20;p.volume=.7;p.muted=true;p.pause();
  assert.equal(p.currentTime,0);assert.equal(p.volume,.5);assert.equal(p.muted,false);assert.deepEqual(f.sent.slice(-4).map(x=>x.message.command),[{type:'music',action:'seek',value:20},{type:'music',action:'volume',value:.7},{type:'music',action:'mute',value:true},{type:'music',action:'pause'}]);
  const favorite=f.client.getFavorite();favorite.src='assets/music/vivarium.mp3';const playing=favorite.play();assert.equal(f.sent.at(-1).message.command.value,'assets/music/vivarium.mp3');f.receive({kind:'ack',id:f.sent.at(-1).message.id,ok:true,state:snapshot()});await playing;
});
test('file origin requires exact source/capability; replace validates next frame URL',async()=>{
  const f=fixture(true);f.receive({kind:'state',state:snapshot()},{origin:'file://'});assert.equal(f.client.state().entered,false);f.receive({kind:'state',state:snapshot()});await f.client.ready;assert.equal(f.sent[0].origin,'*');
  f.receive({kind:'replace',href:'https://evil/test.html'});assert.equal(f.win.replaced,undefined);const next='file:///C:/site/music.html?__y2k_frame='+token+'&__y2k_epoch=3';f.receive({kind:'replace',href:next});assert.equal(f.win.replaced,next);
});
test('speech leases gate glyphs on actual parent entry/permission/mute and destroy only their voice',async()=>{
  const f=fixture();f.receive({kind:'state',state:snapshot({entered:false})});await f.client.ready;const voice=f.client.createSpeechLease('shurelia');assert.equal(voice.playGlyph({character:'A',index:0,mood:'warm'}),false);assert.equal(await voice.unlock({isTrusted:true}),false);assert.equal(f.sent.at(-1).message.kind,'request-activation');
  f.receive({kind:'state',state:snapshot({revision:2})});assert.equal(await voice.unlock(),true);assert.equal(voice.playGlyph({character:'A',index:0,mood:'warm'}),true);assert.equal(f.sent.at(-1).message.command.voiceId,'shurelia');
  f.receive({kind:'state',state:snapshot({revision:3,music:{...snapshot().music,muted:true}})});assert.equal(voice.playGlyph({character:'B',index:1,mood:'warm'}),false);voice.destroy();assert.equal(f.sent.at(-1).message.command.action,'release');assert.equal(voice.playGlyph({character:'C'}),false);
});
test('ordinary approved routes are intercepted; modifiers/targets/downloads/external/hash placeholders are native',()=>{
  const f=fixture();const handler=[...f.events.get('doc:click')][0];
  const click=(href,attrs={},mods={})=>{let prevented=false;const a={getAttribute:k=>k==='href'?href:attrs[k]||null,hasAttribute:k=>Object.hasOwn(attrs,k),setAttribute:(k,v)=>attrs[k]=v};handler({button:0,defaultPrevented:false,target:{closest:()=>a},preventDefault:()=>{prevented=true;},...mods});return prevented;};
  assert.equal(click('music.html?mix=1#songs'),true);assert.equal(f.sent.at(-1).message.kind,'navigate');const sent=f.sent.length;assert.equal(click('#'),true);assert.equal(f.sent.length,sent,'Placeholder does not become a route');assert.equal(click('music.html',{}, {ctrlKey:true}),false);assert.equal(click('music.html',{target:'_blank'}),false);assert.equal(click('music.html',{download:''}),false);const external={};assert.equal(click('https://outside/a',external),false);assert.equal(external.target,'_top');assert.equal(click('#real-anchor'),true);
});
test('owned documents suppress capability referrers and report cached page leaving without destroying bridge',async()=>{
  const f=fixture();assert.equal(f.win.document.head.children[0].name,'referrer');assert.equal(f.win.document.head.children[0].content,'no-referrer');f.receive({kind:'state',state:snapshot()});await f.client.ready;
  for(const fn of f.events.get('pagehide'))fn({persisted:true});assert.ok(f.sent.some(x=>x.message.kind==='page-leaving'&&x.message.persisted===true));assert.ok(f.events.get('message').size>0);
  for(const fn of f.events.get('pageshow'))fn({persisted:true});assert.equal(f.sent.at(-1).message.kind,'hello');
});
test('late bridge initialization is DOM-ready aware, does not read music storage/create media, and preserves classic globals',async()=>{
  const state=snapshot(),commands=[],events={},children=[],intervals=[];
  const media=new EventTarget();Object.assign(media,state.music);media.play=()=>Promise.resolve();media.pause=()=>{};
  const context={console,Promise,Event,EventTarget,URL,Math,Date,CSS:{supports:()=>true},innerWidth:1768,innerHeight:1016,
    getComputedStyle:()=>({zoom:'1.3',getPropertyValue:name=>name==='--site-default-scale'?'1.3':'#f00'}),
    setTimeout:()=>1,clearTimeout(){},setInterval:fn=>{intervals.push(fn);return 1;},Audio(){throw new Error('child native media');},
    localStorage:{getItem(){throw new Error('child stale storage read');},setItem(){throw new Error('child music storage write');}},
    addEventListener(type,fn){events[type]=fn;},removeEventListener(){}};
  context.window=context;
  const doc={readyState:'complete',body:{id:'section-tech',appendChild:n=>children.push(n),style:{},classList:{toggle(){}}},documentElement:{style:{setProperty(){}},classList:{toggle(){}}},
    getElementById:()=>null,querySelectorAll:()=>[],addEventListener(){},createElement:()=>({style:{},appendChild(){}})};
  context.document=doc;context.SiteAudioClient={isFrame:true,ready:Promise.resolve(),state:()=>state,getPlayer:()=>media,getFavorite:()=>media,subscribe:fn=>{fn(state);return()=>{};},command:cmd=>{commands.push(cmd);return Promise.resolve();},pageReady:()=>{context.pageReady=true;}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'scripts.js'),'utf8'),context);for(let i=0;i<6;i++)await Promise.resolve();
  assert.equal(context.pageReady,true);assert.equal(context.npIndex,0);assert.equal(context.isPlaying,false);assert.equal(context.startFrom,0);assert.equal(context.npVolume,.5);assert.equal(context.playlist.length,6);assert.equal(typeof context.updateNP,'function');assert.equal(doc.body.style.opacity,'1');assert.equal(children.length,15);assert.equal(intervals.length,1);assert.deepEqual(commands,[],'Rendering does not command playback or advance ended');
  context.npIndex=3;assert.equal(commands.at(-1).action,'select');context.startNote(440);context.stopNote();assert.deepEqual(commands.slice(-2).map(cmd=>cmd.type+':'+cmd.action),['synth:start','synth:stop']);
});
test('teardown rejects outstanding ACK promises and stops scoped notes, never destroys parent engine',async()=>{
  const f=fixture();f.receive({kind:'state',state:snapshot()});await f.client.ready;const voice=f.client.createSpeechLease('shurelia');const pending=f.client.getPlayer().play();f.client.destroy();await assert.rejects(pending,{name:'AbortError'});assert.ok(f.sent.some(x=>x.message.command?.type==='speech'&&x.message.command.action==='release'));assert.ok(!f.sent.some(x=>x.message.command?.action==='destroy'));assert.equal(f.events.get('message').size,0);assert.equal(voice.playGlyph({character:'A'}),false);
});
test('legacy host guard and bridge readiness prevent all legacy DOM/media effects',async()=>{
  const code=fs.readFileSync(path.join(root,'scripts.js'),'utf8');let resolve;
  const blocked=new Proxy({}, {get(){throw new Error('legacy DOM accessed');}});const context={window:{SiteAudioShell:{isHost:true}},document:blocked,Audio(){throw new Error('native media constructed');}};
  assert.doesNotThrow(()=>vm.runInNewContext(code,context));
  const context2={window:{SiteAudioClient:{isFrame:true,ready:new Promise(r=>resolve=r)}},document:blocked,Audio(){throw new Error('before ready');}};
  assert.doesNotThrow(()=>vm.runInNewContext(code,context2));assert.ok(resolve);
  for(const filename of ['player-skins.js','home-companion.js'])assert.doesNotThrow(()=>vm.runInNewContext(fs.readFileSync(path.join(root,filename),'utf8'),{window:{SiteAudioShell:{isHost:true}},document:blocked}));
});
