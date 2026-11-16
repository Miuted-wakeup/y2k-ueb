const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const load = () => require('../home-companion.js');

function fixture(reducedMotion = false, messages, glyphCount = 12, extra = {}) {
  let time = 0, serial = 0;
  const timers = new Map(), spoken = [], frames = [], progress = [], states = [], glyphs = [];
  const { createDirector } = load();
  const director = createDirector({ ...extra, reducedMotion, messages, random: () => .5,
    setTimer(fn, delay) { const id = ++serial; timers.set(id, { fn, at: time + delay }); return id; },
    clearTimer(id) { timers.delete(id); },
    onMessage(message) { spoken.push(message); return glyphCount; },
    onGlyph(glyph) { glyphs.push(glyph); },
    onFrame(frame) { frames.push(frame); }, onProgress(n) { progress.push(n); }, onState(s) { states.push(s); }
  });
  return { director, spoken, frames, progress, states, timers, glyphs,
    advance(ms) {
      const end = time + ms;
      for (let guard = 0; guard < 10000; guard++) {
        const next = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        time = next[1].at; timers.delete(next[0]); next[1].fn();
      }
      time = end;
    }
  };
}

test('explicit readiness holds the unconsumed neutral greeting; default callers stay automatic', () => {
  const f=fixture(false,undefined,12,{ready:false});f.director.setVisible(true);f.advance(10000);
  assert.equal(f.director.snapshot().index,-1);assert.equal(f.director.snapshot().expression,'neutral');assert.equal(f.spoken.length,0);assert.equal(f.timers.size,0);
  f.director.setReady(true);f.advance(1500);f.director.setReady(true);f.advance(499);assert.equal(f.spoken.length,0);f.advance(1);assert.equal(f.spoken.length,1,'Idempotent readiness must not restart the 2s greeting delay');
  const g=fixture();g.director.setVisible(true);g.advance(2000);assert.equal(g.spoken.length,1,'Default readiness remains compatible');
});
test('readiness suspension preserves glyph progress and destroy cannot be released again', () => {
  const f=fixture();f.director.setVisible(true);f.advance(2210);const before=f.glyphs.length;
  f.director.setReady(false);f.advance(10000);assert.equal(f.glyphs.length,before);assert.equal(f.director.snapshot().expression,'neutral');
  f.director.setReady(true);f.advance(1000);assert.deepEqual(f.glyphs.map(g=>g.index),[0,1,2,3,4,5,6,7,8,9,10,11]);
  f.director.destroy();f.director.setReady(false);f.director.setReady(true);f.advance(10000);assert.equal(f.spoken.length,1);
});

test('HOME anchors a passive character outside scrolling ancestors and loads editable local messages', () => {
  const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const start = home.indexOf('<section id="home-companion"'), end = home.indexOf('</section>', start);
  const component = home.slice(start, end);
  assert.ok(start > home.indexOf('</footer>'), 'Keep fixed portrait outside clipping scroll ancestors');
  assert.doesNotMatch(component, /<button|hc-actions|hc-next|hc-quiet|role="button"/);
  assert.match(component, /class="hc-dialogue" hidden/);
  assert.ok(home.indexOf('src="home-companion-messages.js"') < home.indexOf('src="home-companion.js"'));
  assert.match(home, /has-home-companion/);
  assert.ok(fs.existsSync(path.join(root, 'assets/images/home/character.png')));
  for (const file of ['japan','music','canto','tech','sobre-mi','cosas']) {
    assert.doesNotMatch(fs.readFileSync(path.join(root, file + '.html'), 'utf8'), /home-companion/);
  }
});

test('greeting is automatic after a short wait; mouth poses animate, then bubble disappears', () => {
  const f = fixture(); f.advance(100000); assert.equal(f.spoken.length, 0);
  f.director.setVisible(true); f.advance(1900);
  assert.equal(f.spoken.length, 0); assert.equal(f.director.snapshot().bubbleVisible, false);
  f.advance(100); assert.equal(f.spoken.length, 1); assert.equal(f.director.snapshot().typing, true);
  assert.equal(f.director.snapshot().bubbleVisible, true);
  f.advance(1600); assert.equal(f.director.snapshot().phase, 'reading');
  assert.equal(f.progress.at(-1), 12);
  assert.ok(new Set(f.frames).size >= 2);
  assert.equal(f.frames.at(-1), load().EMOTIONS[f.spoken[0].mood].rest);
  f.advance(12000); assert.equal(f.director.snapshot().bubbleVisible, false);
  assert.equal(f.director.snapshot().phase, 'waiting');
  assert.equal(typeof f.director.next, 'undefined'); assert.equal(typeof f.director.setQuiet, 'undefined');
});

test('the source-library room grounds Shurelia without enclosing her transient dialogue', () => {
  const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const component = home.slice(home.indexOf('<section id="home-companion"'), home.indexOf('<!-- ANIMATION ELEMENTS -->'));
  assert.match(component, /class="hc-room" aria-hidden="true"/);
  assert.match(component, /class="hc-counter" aria-hidden="true"/);
  assert.ok(component.indexOf('class="hc-room"') < component.indexOf('class="hc-character"'));
  assert.ok(component.indexOf('class="hc-counter"') > component.indexOf('class="hc-character"'));
  const css = fs.readFileSync(path.join(root, 'home-companion.css'), 'utf8');
  assert.match(css, /shurelia-room-books\.png/);
  assert.match(css, /shurelia-room-counter\.png/);
});

test('messages are editable data, accept custom phrases, and recover from empty or invalid entries', () => {
  const { MESSAGES, EMOTIONS } = load();
  assert.deepEqual(MESSAGES, require('../home-companion-messages.js'));
  assert.ok(MESSAGES.length >= 8);
  assert.ok(new Set(MESSAGES.map(m => m.mood)).size >= 4);
  for (const m of MESSAGES) assert.ok(EMOTIONS[m.mood]);
  const f = fixture(true, [{text:'Mi mensaje personal', mood:'sleepy'}]);
  f.director.setVisible(true); f.advance(2000);
  assert.equal(f.spoken[0].text,'Mi mensaje personal');
  const g = fixture(true, [null, {text:''}, {text:'Texto válido',mood:'invented'}]);
  g.director.setVisible(true); g.advance(2000);
  assert.deepEqual(g.spoken[0], {text:'Texto válido',mood:'calm'});
  for (const mood of ['constructor', 'toString', '__proto__']) {
    const bad = fixture(true, [{text:'Texto válido',mood}]);
    bad.director.setVisible(true); bad.advance(2000);
    assert.deepEqual(bad.spoken[0], {text:'Texto válido',mood:'calm'});
  }
  const h = fixture(true, []); h.director.setVisible(true); h.advance(2000);
  assert.ok(h.spoken[0].text.length > 0);
});

test('automatic messages do not repeat consecutively and never queue speech in hidden tabs', () => {
  const f = fixture(true); f.director.setVisible(true); f.advance(2000);
  f.advance(12000 + 47000); assert.equal(f.spoken.length,1);
  f.advance(36000); assert.equal(f.spoken.length,2);
  assert.notEqual(f.spoken[0].text,f.spoken[1].text);
  f.director.setPageVisible(false); assert.equal(f.timers.size,0);
  assert.equal(f.director.snapshot().bubbleVisible,false);
  f.advance(200000); assert.equal(f.spoken.length,2);
  f.director.setPageVisible(true); f.advance(100000);
  assert.ok(f.spoken.length>2);
});

test('typing pauses out of view and resumes the same phrase without stale timers', () => {
  const f = fixture(); f.director.setVisible(true); f.advance(2180);
  const before=f.director.snapshot().revealed;
  f.director.setVisible(false); f.advance(50000);
  assert.equal(f.director.snapshot().revealed,before);
  assert.equal(f.director.snapshot().bubbleVisible,false); assert.equal(f.timers.size,0);
  f.director.setVisible(true); f.advance(1600);
  assert.equal(f.director.snapshot().revealed,12); assert.equal(f.timers.size,1);
});

test('reduced motion keeps paced text but a static emotional face, and still hides its bubble', () => {
  const f=fixture(true); f.director.setVisible(true); f.advance(2000);
  assert.equal(f.director.snapshot().typing,true);
  assert.equal(f.progress.at(-1),0);
  const start=f.frames.length;
  f.advance(1600);
  assert.equal(f.director.snapshot().phase,'reading');
  assert.equal(new Set(f.frames.slice(start)).size,1,'No rapid face motion under reduced motion');
  const frame=f.frames.at(-1), count=f.frames.length; f.advance(3000);
  assert.equal(f.frames.length,count); assert.equal(f.frames.at(-1),frame);
  f.advance(10000); assert.equal(f.director.snapshot().bubbleVisible,false);
  const g=fixture(); g.director.setVisible(true); g.advance(2100);
  const before=g.director.snapshot().revealed;g.director.setReducedMotion(true);
  assert.equal(g.director.snapshot().typing,true); assert.equal(g.progress.at(-1),before);
  g.advance(1600);assert.equal(g.director.snapshot().typing,false);
  g.director.destroy(); assert.equal(g.timers.size,0); assert.equal(g.director.snapshot().bubbleVisible,false);
  g.director.setVisible(false); g.director.setVisible(true); g.advance(200000);
  assert.equal(g.spoken.length,1);
});

test('the neutral default changes to a greeting smile and returns to neutral after the bubble', () => {
  for (const reduced of [false, true]) {
    const f=fixture(reduced, [{text:'Hola, viajero. Puedes quedarte un rato.',mood:'warm'}]);
    f.director.setVisible(true);
    assert.equal(f.frames.at(-1),0,'Waiting must not smile before greeting');
    assert.equal(f.director.snapshot().expression,'neutral');
    f.advance(2000);
    assert.notEqual(f.frames.at(-1),0,'Greeting must visibly change from neutral even with reduced motion');
    f.advance(1600);
    assert.equal(f.frames.at(-1),load().EMOTIONS.warm.rest);
    assert.equal(f.director.snapshot().expression,'warm');
    f.advance(12000);
    assert.equal(f.frames.at(-1),0,'No permanent smile between comments');
    assert.equal(f.director.snapshot().expression,'neutral');
  }
});

test('every message mood has a contextual face while readable, never a leaked idle expression', () => {
  const { EMOTIONS }=load();
  for (const mood of Object.keys(EMOTIONS)) {
    const f=fixture(true,[{text:'Un mensaje con contexto.',mood}]);
    f.director.setVisible(true); assert.equal(f.frames.at(-1),0);
    f.advance(2000);
    assert.equal(f.frames.at(-1),EMOTIONS[mood].rest,mood);
    assert.notEqual(f.frames.at(-1),0,'Each assigned reaction differs from idle: '+mood);
    f.director.setPageVisible(false); assert.equal(f.frames.at(-1),0);
    f.director.setPageVisible(true); assert.equal(f.frames.at(-1),EMOTIONS[mood].rest);
    f.director.destroy(); assert.equal(f.frames.at(-1),0);
  }
  assert.ok(new Set(Object.values(EMOTIONS).map(e=>e.rest)).size>=4,'Contexts need visibly different original faces');
});

test('the no-JS portrait also starts at the neutral source tile', () => {
  const css=fs.readFileSync(path.join(root,'home-companion.css'),'utf8');
  const face=css.match(/(?:^|\n)\.hc-face\s*\{([^}]+)\}/)[1];
  assert.match(face,/background-position:\s*0(?:px)?\s+0(?:px)?\s*;/);
});

test('typewriter uses a prudent cadence and longer comma/sentence pauses, with one hook per glyph', () => {
  const f=fixture(false,[{text:'AB,CD.EF',mood:'warm'}],8);
  f.director.setVisible(true);f.advance(2000);
  f.advance(69);assert.equal(f.director.snapshot().revealed,0);
  f.advance(1);assert.equal(f.director.snapshot().revealed,1);
  f.advance(140);assert.equal(f.director.snapshot().revealed,3);
  f.advance(219);assert.equal(f.director.snapshot().revealed,3,'Comma pauses before next letter');
  f.advance(1);assert.equal(f.director.snapshot().revealed,4);
  f.advance(140);assert.equal(f.director.snapshot().revealed,6);
  f.advance(369);assert.equal(f.director.snapshot().revealed,6,'Sentence punctuation adds a longer pause');
  f.advance(1);assert.equal(f.director.snapshot().revealed,7);
  f.advance(70);assert.equal(f.director.snapshot().phase,'reading');
  assert.deepEqual(f.glyphs.map(g=>g.character),Array.from('AB,CD.EF'));
  assert.deepEqual(f.glyphs.map(g=>g.index),[0,1,2,3,4,5,6,7]);
  assert.ok(f.glyphs.every(g=>g.mood==='warm'));
});

test('suspension and motion preference changes never replay glyph effects or complete text abruptly', () => {
  const f=fixture(false,[{text:'ABCDEFGHIJKL',mood:'curious'}]);
  f.director.setVisible(true);f.advance(2210);
  assert.equal(f.glyphs.length,3);
  f.director.setPageVisible(false);f.advance(20000);
  assert.equal(f.glyphs.length,3);
  f.director.setReducedMotion(true);assert.equal(f.director.snapshot().revealed,3);
  f.director.setPageVisible(true);f.advance(1000);
  assert.deepEqual(f.glyphs.map(g=>g.index),[0,1,2,3,4,5,6,7,8,9,10,11]);
  f.director.destroy();f.advance(100000);assert.equal(f.glyphs.length,12);
});

test('hosted HOME uses only a voice lease, waits for parent entry and releases no parent engine/context', () => {
  let time=0,serial=0,localSpeech=0,dialogs=0,audioReads=0,releases=0,unsubscribed=0,disconnected=0;
  const timers=new Map(),listeners=new Map(),glyphs=[];
  const eventTarget=label=>({addEventListener(type,fn){const key=label+type;if(!listeners.has(key))listeners.set(key,new Set());listeners.get(key).add(fn);},removeEventListener(type,fn){listeners.get(label+type)?.delete(fn);},emit(type,value){[...(listeners.get(label+type)||[])].forEach(fn=>fn(value));}});
  let doc;
  const node=tag=>({tagName:tag,ownerDocument:doc,style:{},dataset:{},children:[],classList:{add(){}},appendChild(n){this.children.push(n);},replaceChildren(){this.children=[];}});
  doc={...eventTarget('d'),hidden:false,documentElement:{},createElement(tag){if(tag==='dialog')dialogs++;return node(tag);},createTextNode:text=>({textContent:text}),getElementById(id){if(id==='audio-player')audioReads++;return id==='sidebar-right'?{getBoundingClientRect:()=>({left:700,width:220})}:null;}};
  const plain=node('p'),visual=node('div'),portrait=node('span'),bubble=node('div');bubble.hidden=true;
  const root=node('section');root.isConnected=true;root.querySelector=s=>({'.hc-plain':plain,'.hc-glyphs':visual,'.hc-face':portrait,'.hc-dialogue':bubble}[s]);
  const state={entered:false,permission:'blocked'},subscribers=new Set();
  const speech={playGlyph:g=>glyphs.push(g),stop(){},destroy(){releases++;},unlock:()=>Promise.resolve(true),snapshot:()=>({supported:true,unlocked:state.entered})};
  const win={...eventTarget('w'),innerWidth:1024,innerHeight:900,getComputedStyle:()=>({zoom:'1'}),matchMedia:()=>({...eventTarget('m'),matches:false}),
    setTimeout(fn,delay){const id=++serial;timers.set(id,{fn,at:time+delay});return id;},clearTimeout:id=>timers.delete(id),
    HomeCompanionSpeech:{createSpeechSound(){localSpeech++;throw new Error('Hosted child must not own speech');}},
    ResizeObserver:class{observe(){}disconnect(){disconnected++;}},IntersectionObserver:class{constructor(fn){this.fn=fn;}observe(){this.fn([{isIntersecting:true,intersectionRatio:1}]);}disconnect(){disconnected++;}},
    SiteAudioClient:{isFrame:true,getPlayer:()=>({paused:true,muted:false,volume:.5,...eventTarget('p')}),createSpeechLease:name=>{assert.equal(name,'shurelia');return speech;},subscribe(fn){subscribers.add(fn);fn(state);return()=>{subscribers.delete(fn);unsubscribed++;};}}};
  const advance=ms=>{const end=time+ms;for(let i=0;i<500;i++){const next=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;time=next[1].at;timers.delete(next[0]);next[1].fn();}time=end;};
  const director=load().mount(root,win);advance(10000);assert.equal(director.snapshot().index,-1);assert.equal(director.snapshot().ready,false);assert.equal(localSpeech+dialogs+audioReads,0);
  Object.assign(state,{entered:true,permission:'active'});subscribers.forEach(fn=>fn(state));advance(1999);assert.equal(director.snapshot().index,-1);advance(71);assert.equal(glyphs.length,1);
  win.emit('pagehide',{persisted:true});advance(10000);assert.equal(glyphs.length,1);assert.equal(releases,0,'Cached child hiding must not release the persistent parent context');win.emit('pageshow',{persisted:true});advance(70);assert.equal(glyphs.length,2);
  director.destroy();director.destroy();assert.equal(releases,1,'Destroy releases only the scoped voice');assert.equal(unsubscribed,1);assert.equal(disconnected,2);assert.equal(timers.size,0);assert.equal(localSpeech+dialogs+audioReads,0);
});
