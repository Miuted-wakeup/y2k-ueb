// Local Chromium/CDP integration. No packages, accounts, or external requests.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { EMOTIONS, NEUTRAL_FRAME } = require('../home-companion.js');
const audioOnly = process.argv.includes('--audio-only');
const root = path.resolve(__dirname, '..');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'y2k-anchor-'));
const chrome = process.env.CHROME_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
assert.ok(chrome, 'Set CHROME_PATH to Chrome or Edge');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const mime = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.png':'image/png', '.jpg':'image/jpeg', '.gif':'image/gif', '.mp3':'audio/mpeg' };
let messagesOverride = null;
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, data) => {
    if (!error && messagesOverride && file.endsWith('home-companion-messages.js')) {
      data = Buffer.from('window.HOME_COMPANION_MESSAGES=' + JSON.stringify(messagesOverride) + ';');
    }
    res.writeHead(error ? 404 : 200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', ...(error ? {} : {'Content-Length':data.length}) });
    res.end(error ? 'Not found' : data);
  });
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--mute-audio', '--remote-debugging-port=0', '--user-data-dir=' + output + '/profile', 'about:blank'], { windowsHide:true, stdio:'ignore' });
  let ws;
  try {
    const portFile = path.join(output, 'profile', 'DevToolsActivePort');
    for (let i=0; !fs.existsSync(portFile) && i<100; i++) await pause(100);
    const port = fs.readFileSync(portFile,'utf8').split('\n')[0];
    const target = await (await fetch('http://127.0.0.1:' + port + '/json/new?about:blank', {method:'PUT'})).json();
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
    let serial=0; const pending=new Map(), errors=[];
    ws.onmessage = event => {
      const message=JSON.parse(event.data);
      if (message.method==='Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
      const request=pending.get(message.id);
      if (request) { pending.delete(message.id); message.error?request.reject(message.error):request.resolve(message.result); }
    };
    const cdp = (method,params={})=>new Promise((resolve,reject)=>{pending.set(++serial,{resolve,reject});ws.send(JSON.stringify({id:serial,method,params}));});
    const evaluate = async expression => {
      const result=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
      assert.ok(!result.exceptionDetails,JSON.stringify(result.exceptionDetails));return result.result.value;
    };
    const waitFor = async (expression,label) => {
      for(let i=0;i<200;i++){if(await evaluate(expression))return;await pause(80);}assert.fail(label);
    };
    const navigate = async (url, entryMode = 'silent') => {
      await cdp('Page.navigate',{url});
      await waitFor("document.readyState==='complete' && location.href===" + JSON.stringify(url),'Load the local page');
      if (await evaluate("!!document.querySelector('#home-entry')")) {
        if (entryMode === 'sound') await click('#home-entry-start');
        else await evaluate("document.querySelector('#home-entry-silent').click()");
        await waitFor("!document.querySelector('#home-entry')", 'Explicit HOME entry finishes');
      }
      await pause(1000);
    };
    const reading = () => waitFor("document.querySelector('#home-companion').homeCompanion.snapshot().phase==='reading'",'Automatic phrase finishes typing');
    const state = () => evaluate(`(() => {
      const r=document.querySelector('#home-companion'), b=r.querySelector('.hc-dialogue');
      const box=el=>{const q=el.getBoundingClientRect();return {x:q.x,y:q.y,width:q.width,height:q.height,right:q.right,bottom:q.bottom};};
      const side=document.querySelector('#sidebar-right'), player=document.querySelector('#now-playing-bar');
      return {actor:box(r), face:box(r.querySelector('.hc-face')), sidebar:box(side), player:box(player), bubble:b.hidden?null:box(b),
        room:box(r.querySelector('.hc-room')),counter:box(r.querySelector('.hc-counter')),
        roomPixels:getComputedStyle(r.querySelector('.hc-room')).imageRendering,
        layers:['.hc-room','.hc-character','.hc-counter','.hc-dialogue'].map(s=>Number(getComputedStyle(r.querySelector(s)).zIndex)),
        position:getComputedStyle(r).position,scale:Number(getComputedStyle(document.documentElement).zoom),
        snapshot:r.homeCompanion.snapshot(),frame:r.querySelector('.hc-face').dataset.frame,
        controls:r.querySelectorAll('button,input,a,[tabindex]').length,scroll:side.scrollTop,maxScroll:side.scrollHeight-side.clientHeight,
        center:box(document.querySelector('#center-feed')),left:box(document.querySelector('#sidebar-left')),
        centerScroll:document.querySelector('#center-feed').scrollTop,leftScroll:document.querySelector('#sidebar-left').scrollTop,
        glyphs:r.querySelectorAll('.hc-glyph,.hc-fallback-char').length,
        badGlyphs:b.hidden?0:[...r.querySelectorAll('.hc-glyph,.hc-fallback-char')].filter(el=>{const q=el.getBoundingClientRect(),p=b.getBoundingClientRect();return q.x<p.x||q.right>p.right+1||q.bottom>p.bottom+1;}).length};
    })()`);
    const near=(a,b,label)=>assert.ok(Math.abs(a-b)<2,label+': '+a+' vs '+b);
    const geometry=s=>{
      assert.equal(s.position,'fixed');assert.equal(s.controls,0);
      if(!s.snapshot.bubbleVisible) {
        assert.equal(Number(s.frame),NEUTRAL_FRAME,'Idle/hidden bubble always restores neutral');
        assert.equal(s.snapshot.expression,'neutral');
      } else if(s.snapshot.phase==='reading') {
        assert.equal(Number(s.frame),EMOTIONS[s.snapshot.mood].rest,'Hold the phrase-specific reaction while text remains readable');
        assert.equal(s.snapshot.expression,s.snapshot.mood);
      }
      near(s.actor.x,s.sidebar.x,'Portrait stays aligned with sidebar');
      near(s.actor.width,s.sidebar.width,'Portrait uses sidebar column width');
      near(s.actor.bottom,s.player.y,'Portrait ends at player top, not over controls');
      near(s.room.x,s.actor.x,'Library fills the existing character corner');
      near(s.room.width,s.actor.width,'No empty horizontal band around scene');
      near(s.room.y,s.actor.y,'Library remains inside reserved portrait area');
      near(s.room.height,s.actor.height,'Scene does not enlarge the scroll reservation');
      near(s.counter.bottom,s.actor.bottom,'Counter grounds portrait at player edge');
      near(s.counter.height,14*s.scale,'Counter height stays proportional');
      assert.deepEqual(s.layers,[0,1,2,3],'Books behind actor, wood in front, bubble free above both');
      assert.equal(s.roomPixels,'pixelated');
      near(s.sidebar.bottom+8*s.scale,s.actor.y,'Right scrolling viewport stops above portrait with its own gap');
      assert.ok(s.sidebar.height>100,'Keep right sidebar usable');
      assert.ok(s.center.height>s.sidebar.height+s.actor.height-4,'Do not shorten center feed');
      assert.ok(s.left.height>s.sidebar.height+s.actor.height-4,'Do not shorten left sidebar');
      if(s.bubble){
        assert.ok(s.bubble.right<s.face.x,'Speech balloon belongs left of head');
        near(s.bubble.y+s.bubble.height/2,s.actor.y+72*s.scale,'Balloon points at head height');
        assert.equal(s.badGlyphs,0);
      }
    };
    await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Network.enable');
    // Observe the REAL Web Audio graph before the muted test sink, not invented play counters.
    await cdp('Page.addScriptToEvaluateOnNewDocument',{source:`(() => {
      const Native=window.AudioContext||window.webkitAudioContext;window.__speechContexts=[];
      if(!Native)return;
      window.AudioContext=class extends Native {
        constructor(...args){super(...args);const analyser=this.createAnalyser();analyser.fftSize=256;
          window.__speechContexts.push({context:this,analyser});
          for(const method of ['createGain','createBiquadFilter']){
            const create=this[method].bind(this);this[method]=(...params)=>{
              const node=create(...params),connect=node.connect.bind(node);
              node.connect=(destination,...params)=>destination===this.destination?(connect(analyser),analyser.connect(destination,...params)):connect(destination,...params);
              return node;
            };
          }
        }
      };
    })()`});
    const click=async selector=>{
      const p=await evaluate("(() => {const r=document.querySelector("+JSON.stringify(selector)+").getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()");
      await cdp('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});
      await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});
    };
    const external=['*://fonts.googleapis.com/*','*://fonts.gstatic.com/*','*://*.youtube.com/*','*://*.youtube-nocookie.com/*'];
    await cdp('Network.setBlockedURLs',{urls:external});
    await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
    for(const [width,height] of (audioOnly ? [[1768,1016]] : [[1920,1080],[1768,1016],[1440,900],[1024,900]])){
      await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
      await navigate(origin+'/index.html',width===1768?'sound':'silent');
      await waitFor("document.querySelector('#home-companion').classList.contains('hc-art-ready')",'Original local font loads');
      assert.equal(await evaluate(`Promise.all(['shurelia-room-books.png','shurelia-room-counter.png'].map(file=>new Promise(resolve=>{const image=new Image();image.onload=()=>resolve(image.naturalWidth>0);image.onerror=()=>resolve(false);image.src='assets/images/home/'+file;}))).then(results=>results.every(Boolean))`),true,'Both lossless source scene crops load');
      const idle=await state();
      assert.equal(Number(idle.frame),NEUTRAL_FRAME,'Before the first greeting she must be neutral, not smiling');
      assert.equal(await evaluate('window.__speechContexts.length'),width===1768?1:0,'Only the trusted primary entry creates a sound context');
      if(width===1768){
        const a=idle.actor;
        const shot=await cdp('Page.captureScreenshot',{format:'png',clip:{x:a.x,y:a.y,width:a.width,height:a.height,scale:1}});
        fs.writeFileSync(path.join(output,'shurelia-neutral.png'),Buffer.from(shot.data,'base64'));
      }
      if(width===1768){
        await evaluate("document.querySelector('#audio-player').pause()");
        await waitFor("document.querySelector('#home-companion').homeCompanion.sound.snapshot().unlocked",'Native primary entry permits character sound without starting music');
        assert.equal(await evaluate("document.querySelector('#audio-player').paused"),true,'The song can stay paused while Shurelia talks');
        await waitFor("document.querySelector('#home-companion').homeCompanion.snapshot().typing",'Automatic typing starts without a click');
        const poses=new Set();let peak=0;const revealed=[];
        for(let i=0;i<30;i++){
          const s=await state();poses.add(s.frame);revealed.push(s.snapshot.revealed);
          peak=Math.max(peak,await evaluate('(() => {const p=window.__speechContexts[0];if(!p)return 0;const a=new Float32Array(p.analyser.fftSize);p.analyser.getFloatTimeDomainData(a);return Math.max(...a.map(Math.abs));})()'));
          await pause(30);
        }
        assert.ok(poses.size>=2,'Original talking faces alternate');
        assert.ok(new Set(revealed).size>3,'Text genuinely advances gradually');
        assert.ok(peak>.05,'Louder speech must exceed the previous ~.035 peak at 50% volume: peak='+peak);
        fs.writeFileSync(path.join(output,'speech-metrics.json'),JSON.stringify({peak,minimumPeak:.05,volume:await evaluate("document.querySelector('#audio-player').volume")},null,2));
        console.log('PASS audible speech peak='+peak.toFixed(6)+' at50%volume');
        assert.ok(await evaluate("document.querySelector('#home-companion').homeCompanion.sound.snapshot().blipsPlayed>0"));
      }
      await reading();
      const before=await state();geometry(before);assert.ok(before.glyphs>20);
      if(width!==1768)assert.equal(await evaluate("document.querySelector('#home-companion').homeCompanion.sound.snapshot().blipsPlayed"),0,'Speech remains silent before any trusted activation');
      assert.equal(Number(before.frame),2,'The welcome line changes neutral to the original clear smile');
      assert.equal(await evaluate("document.querySelector('.hc-plain').getAttribute('aria-live')"),'off','Do not interrupt with unsolicited flavour text');
      const point={x:before.sidebar.x+before.sidebar.width*.6,y:before.sidebar.y+before.sidebar.height*.5};
      await cdp('Input.dispatchMouseEvent',{type:'mouseWheel',...point,deltaY:10000,deltaX:0});
      await pause(200);
      const after=await state();geometry(after);
      if(!audioOnly)assert.ok(after.maxScroll<=1 && after.scroll===0,'Compact right rail must fit without a hidden secondary scroll');
      near(after.actor.y,before.actor.y,'Scrolling sidebar does not move character');
      assert.equal(after.centerScroll,before.centerScroll);assert.equal(after.leftScroll,before.leftScroll);
      if(!audioOnly){
        const last=await evaluate("document.querySelector('#home-guestbook-note').getBoundingClientRect().bottom");
        assert.ok(last<=after.sidebar.bottom+1,'Construction badge stays visible above portrait boundary');
        assert.equal(await evaluate("(() => {const e=document.querySelector('#omikuji-btn'),r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return e===hit||e.contains(hit);})()"),true,'Omikuji button is fully reachable without discovering scroll');
      }
      if(width===1768){
        const a=after.actor;
        const smile=await cdp('Page.captureScreenshot',{format:'png',clip:{x:a.x,y:a.y,width:a.width,height:a.height,scale:1}});
        fs.writeFileSync(path.join(output,'shurelia-smile.png'),Buffer.from(smile.data,'base64'));
        const shot=await cdp('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,'home-anchored.png'),Buffer.from(shot.data,'base64'));
        const b=after.bubble,x=Math.max(0,b.x-8),y=Math.min(b.y,a.y)-8;
        const crop=await cdp('Page.captureScreenshot',{format:'png',clip:{x,y,width:a.right-x+8,height:a.bottom-y+3,scale:1}});
        fs.writeFileSync(path.join(output,'shurelia-anchored.png'),Buffer.from(crop.data,'base64'));
      }
      await waitFor("document.querySelector('.hc-dialogue').hidden",'Bubble disappears after reading, not permanent');
      const hidden=await state();geometry(hidden);
      near(hidden.actor.y,before.actor.y,'Hidden bubble never changes portrait anchor');
      near(hidden.sidebar.height,before.sidebar.height,'Hidden bubble never changes scroll reservation');
      assert.equal(await evaluate("document.querySelector('#home-companion').homeCompanion.sound.snapshot().activeNotes"),0);
      if(width===1768){
        assert.equal(await evaluate("document.querySelector('#audio-player').paused"),true);
        assert.equal(await evaluate("document.querySelector('#home-companion').homeCompanion.sound.playGlyph({character:'A',index:200,mood:'warm'})"),true,'HOME speech can be heard even when the song is paused');
        await evaluate("document.querySelector('#home-companion').homeCompanion.sound.stop();document.querySelector('#audio-player').muted=true");
        assert.equal(await evaluate("document.querySelector('#home-companion').homeCompanion.sound.playGlyph({character:'A',index:202,mood:'warm'})"),false,'Mute always silences speech, including paused music');
        await evaluate("document.querySelector('#audio-player').muted=false");
        await click('#np-play');await waitFor("!document.querySelector('#audio-player').paused",'Native music resumes');
        await evaluate("const a=document.querySelector('#audio-player');a.volume=0");
        assert.equal(await evaluate("document.querySelector('#home-companion').homeCompanion.sound.playGlyph({character:'A',index:202,mood:'warm'})"),false,'Zero player volume silences speech');
        await evaluate("document.querySelector('#audio-player').volume=.5");
        await click('#np-play');await waitFor("document.querySelector('#audio-player').paused",'Music pause still works independently');
        assert.equal(await evaluate('window.__speechContexts.length'),1,'Repeated interactions reuse one speech context');
      }
      console.log('PASS anchored HOME '+width+'x'+height);
      if(audioOnly){console.log('PASS audio-only native policy/level checks. Evidence: '+output);return;}
    }
    // Resize the SAME document; zoom and column reservation must update together.
    await cdp('Emulation.setDeviceMetricsOverride',{width:1920,height:900,deviceScaleFactor:1,mobile:false});
    await pause(200);geometry(await state());
    await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    messagesOverride=[{text:'Hola.',mood:'warm'}];
    await navigate(origin+'/index.html?short');
    await waitFor("document.querySelector('#home-companion').homeCompanion.snapshot().typing",'Reduced motion still types the text');
    assert.ok((await state()).snapshot.revealed<(await state()).snapshot.length);
    await reading();const short=await state();geometry(short);
    assert.equal(short.snapshot.typing,false);
    const frame=short.frame;await pause(500);assert.equal((await state()).frame,frame);
    messagesOverride=[{text:'Un rincón hecho a mano guarda canciones, recuerdos y pequeñas historias. Puedes quedarte todo el tiempo que quieras.',mood:'curious'}];
    await navigate(origin+'/index.html?long');await reading();const long=await state();geometry(long);
    assert.ok(long.bubble.width>short.bubble.width+10 && long.bubble.height>short.bubble.height+10,'Bubble width/height fit actual message, not a permanent box');
    messagesOverride=[{text:'A'.repeat(100),mood:'serious'}];
    await navigate(origin+'/index.html?longword');await reading();geometry(await state());
    for(const mood of ['playful','sleepy','calm']) {
      messagesOverride=[{text:'Una frase de prueba.',mood}];
      await navigate(origin+'/index.html?emotion='+mood);
      assert.equal(Number((await state()).frame),NEUTRAL_FRAME);
      await reading();const reaction=await state();geometry(reaction);
      assert.notEqual(Number(reaction.frame),NEUTRAL_FRAME,'Reduced motion must still show semantic emotion: '+mood);
    }
    messagesOverride=null;
    await navigate(pathToFileURL(path.join(root,'index.html')).href);await reading();geometry(await state());
    assert.equal(await evaluate("document.querySelector('#home-companion').classList.contains('hc-art-ready')"),true,'Local-file message script/font still work');
    await cdp('Network.setBlockedURLs',{urls:[...external,'*dialogue-font.png*']});
    messagesOverride=[{text:'Hola, <b>viajero</b>.',mood:'warm'}];
    await navigate(origin+'/index.html?missing-font');
    await waitFor("document.querySelector('#home-companion').homeCompanion.snapshot().typing",'Fallback text also types gradually');
    assert.ok(await evaluate("document.querySelectorAll('.hc-fallback-char').length>0"));
    const progress=(await state()).snapshot.revealed;await pause(200);
    assert.ok((await state()).snapshot.revealed>progress);
    await reading();geometry(await state());
    assert.equal(await evaluate("document.querySelector('.hc-glyphs b')"),null,'Fallback creates safe text spans, never markup');
    assert.equal(await evaluate("document.querySelector('.hc-plain').textContent"),'Hola, <b>viajero</b>.');
    assert.equal(await evaluate("document.querySelector('#home-companion').classList.contains('hc-art-ready')"),false);
    await cdp('Emulation.setScriptExecutionDisabled',{value:true});
    await navigate(origin+'/index.html?no-js');
    assert.equal(await evaluate("getComputedStyle(document.body).opacity"),'1','No-JS HOME stays visible without an entry lock');
    assert.equal(await evaluate("document.querySelector('.hc-dialogue').hidden"),true);
    assert.equal(await evaluate("document.querySelector('#home-companion').querySelectorAll('button').length"),0);
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.hc-face')).backgroundPosition"),'0px 0px','No-JS default is also neutral');
    await cdp('Emulation.setScriptExecutionDisabled',{value:false});
    assert.deepEqual(errors,[],'No uncaught browser errors');
    console.log('PASS auto transient bubble, editable short/long messages, no controls, native scroll boundary, resize/zoom, reduced motion, file:// and fallback. Evidence: '+output);
  } finally {if(ws)ws.close();browser.kill();server.closeAllConnections();server.close();}
})().catch(error=>{console.error(error);console.error('Evidence: '+output);process.exitCode=1;});
