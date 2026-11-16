// HOME welcome consent/readiness, native dialog and actual Web Audio evidence.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),output=fs.mkdtempSync(path.join(os.tmpdir(),'y2k-home-entry-'));
const chrome=process.env.CHROME_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
assert.ok(chrome,'Set CHROME_PATH');const pause=ms=>new Promise(r=>setTimeout(r,ms));
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.gif':'image/gif','.mp3':'audio/mpeg'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(err?'Not found':data);});});
const probe=`(() => {
  const mode=new URL(location.href).searchParams.get('entry-test');
  window.__entryProbe={contexts:[],clicks:[],firstGlyph:null,removed:null,pageshows:[]};const e=window.__entryProbe;
  addEventListener('pageshow',event=>e.pageshows.push(event.persisted));
  document.addEventListener('click',event=>{if(event.target.closest?.('#home-entry-start'))e.clicks.push({at:performance.now(),trusted:event.isTrusted});},true);
  document.addEventListener('DOMContentLoaded',()=>{document.getElementById('np-prev').inert=true;document.getElementById('np-play').focus();e.focusBefore=document.activeElement.id;});
  new MutationObserver(()=>{const r=document.getElementById('home-companion'),s=r?.homeCompanion?.snapshot();if(s?.revealed>0&&e.firstGlyph===null)e.firstGlyph=performance.now();if(!document.getElementById('home-entry')&&s?.ready&&e.removed===null)e.removed=performance.now();}).observe(document,{subtree:true,childList:true,attributes:true});
  const Native=window.AudioContext||window.webkitAudioContext;
  if(mode==='unsupported'){window.AudioContext=undefined;window.webkitAudioContext=undefined;return;}
  if(!Native)return;
  window.AudioContext=class extends Native {
    constructor(...args){super(...args);const analyser=this.createAnalyser();analyser.fftSize=256;e.contexts.push({context:this,analyser,at:performance.now()});
      for(const name of ['createGain','createBiquadFilter']){const create=this[name].bind(this);this[name]=(...a)=>{const node=create(...a),connect=node.connect.bind(node);node.connect=(dest,...b)=>dest===this.destination?(connect(analyser),analyser.connect(dest,...b)):connect(dest,...b);return node;};}}
    get state(){const real=super.state;return (mode==='pending'||mode==='reject')&&!this.__settled&&real!=='closed'?'suspended':real;}
    resume(){if(mode==='pending')return new Promise(resolve=>{window.__settleEntryResume=()=>{this.__settled=true;resolve();};});if(mode==='reject')return Promise.reject(new Error('test native rejection'));return super.resume();}
  };
})();`;
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  const browser=spawn(chrome,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--mute-audio','--remote-debugging-port=0','--user-data-dir='+output+'/profile','about:blank'],{windowsHide:true,stdio:'ignore'});let ws;
  try{
    const portFile=path.join(output,'profile','DevToolsActivePort');for(let i=0;!fs.existsSync(portFile)&&i<100;i++)await pause(100);
    const port=fs.readFileSync(portFile,'utf8').split('\n')[0],target=await(await fetch('http://127.0.0.1:'+port+'/json/new?about:blank',{method:'PUT'})).json();
    ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});let serial=0;const pending=new Map(),errors=[],metrics=[];
    ws.onmessage=event=>{const m=JSON.parse(event.data),c=pending.get(m.id);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);if(c){pending.delete(m.id);m.error?c.reject(m.error):c.resolve(m.result);}};
    const cdp=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++serial,{resolve,reject});ws.send(JSON.stringify({id:serial,method,params}));});
    const evaluate=async expression=>{const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};
    const until=async(expression,label)=>{for(let i=0;i<200;i++){if(await evaluate(expression))return;await pause(40);}assert.fail(label);};
    const click=async selector=>{const p=await evaluate(`(() => {const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);await cdp('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});};
    const key=async(key,code=key,modifiers=0)=>{const windowsVirtualKeyCode={Enter:13,Tab:9,Escape:27}[key];await cdp('Input.dispatchKeyEvent',{type:'keyDown',key,code,modifiers,windowsVirtualKeyCode});if(key==='Enter')await cdp('Input.dispatchKeyEvent',{type:'char',text:'\r'});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key,code,modifiers:0,windowsVirtualKeyCode});};
    const navigate=async suffix=>{await cdp('Page.navigate',{url:origin+'/index.html'+suffix});await until('!!document.getElementById("home-entry")&&!!document.querySelector("#home-companion").homeCompanion','Native HOME entry mounts');};
    const state=()=>evaluate(`(() => {const d=document.querySelector('#home-entry'),r=document.querySelector('#home-companion'),box=e=>{const x=e.getBoundingClientRect();return{x:x.x,y:x.y,width:x.width,height:x.height,bottom:x.bottom,right:x.right};};return {dialog:d?{open:d.open,box:box(d),phase:d.dataset.phase,animation:getComputedStyle(d).animationName}:null,focus:document.activeElement?.id,prevInert:document.getElementById('np-prev').inert,bodyInert:document.body.hasAttribute('inert'),snapshot:r.homeCompanion?.snapshot(),frame:r.querySelector('.hc-face').dataset.frame,sound:r.homeCompanion?.sound?.snapshot(),contexts:window.__entryProbe.contexts.length,paused:document.querySelector('#audio-player').paused};})()`);
    const finished=()=>until('!document.getElementById("home-entry")&&document.querySelector("#home-companion").homeCompanion.snapshot().ready','Reveal releases readiness');
    const screenshot=async name=>{const r=await cdp('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,name),Buffer.from(r.data,'base64'));};
    await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Network.enable');await cdp('Page.addScriptToEvaluateOnNewDocument',{source:probe});
    const external=['*://fonts.googleapis.com/*','*://fonts.gstatic.com/*','*://*.youtube.com/*','*://*.youtube-nocookie.com/*'];await cdp('Network.setBlockedURLs',{urls:external});
    for(const [width,height] of [[1920,1080],[1768,1016],[1440,900],[1024,900]]){
      await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await navigate('?geometry='+width);await pause(width===1768?2300:100);
      let s=await state();assert.equal(s.dialog.open,true);assert.equal(s.focus,'home-entry-start');assert.equal(s.snapshot.index,-1);assert.equal(s.snapshot.ready,false);assert.equal(s.frame,'0');assert.equal(s.contexts,0);assert.equal(s.bodyInert,false);
      assert.ok(Math.abs(s.dialog.box.x)<1&&Math.abs(s.dialog.box.y)<1&&Math.abs(s.dialog.box.width-width)<2&&Math.abs(s.dialog.box.height-height)<2,'Modal covers physical viewport without zoom drift');
      assert.equal(await evaluate(`(() => {for(const id of ['home-entry-start','home-entry-silent']){const e=document.getElementById(id),r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);if(r.x<0||r.y<0||r.right>innerWidth||r.bottom>innerHeight||!(hit===e||e.contains(hit)))return false;}return true;})()`),true,'Both choices visible/reachable');
      if(width===1768)await screenshot('welcome-entry.png');
      await click('#home-entry-silent');await finished();s=await state();assert.equal(s.focus,'np-play','Restore pre-modal focus');assert.equal(s.prevInert,true,'Preserve pre-existing inert exactly');assert.equal(s.contexts,0);assert.equal(s.snapshot.index,-1);assert.equal(s.paused,true);metrics.push({width,height,...s});console.log('PASS entry geometry, unconsumed greeting and silent focus restore '+width+'x'+height);
    }
    // A REAL trusted primary click runs native audio before any greeting glyph.
    await navigate('?audio');await pause(2200);assert.equal((await state()).snapshot.index,-1);await click('#home-entry-start');
    await until('document.querySelector("#home-companion").homeCompanion.sound.snapshot().unlocked','Confirmed native running result');await finished();assert.equal((await state()).snapshot.index,-1);assert.equal((await state()).paused,true);
    await until('document.querySelector("#home-companion").homeCompanion.snapshot().typing','First greeting starts only after release +2s');
    let peak=0;for(let i=0;i<45;i++){peak=Math.max(peak,await evaluate(`(() => {const p=window.__entryProbe.contexts[0],a=new Float32Array(p.analyser.fftSize);p.analyser.getFloatTimeDomainData(a);return Math.max(...a.map(Math.abs));})()`));await pause(20);}
    const audio=await evaluate(`({firstGlyph:__entryProbe.firstGlyph,removed:__entryProbe.removed,contextAt:__entryProbe.contexts[0].at,click:__entryProbe.clicks[0],blips:document.querySelector('#home-companion').homeCompanion.sound.snapshot().blipsPlayed})`);
    assert.ok(peak>.05,'Actual first-greeting waveform '+peak);assert.equal(audio.click.trusted,true);assert.ok(audio.contextAt<audio.firstGlyph);assert.ok(audio.firstGlyph-audio.removed>=2000,'Preserve original2s delay after reveal');assert.ok(audio.blips>0);metrics.push({audio,peak});console.log('PASS real primary click before first glyph, native waveform peak='+peak);
    await screenshot('home-after-entry.png');
    // Completed cached documents retain their accepted entry/context if eligible.
    await evaluate('window.__acceptedDirector=document.querySelector("#home-companion").homeCompanion;window.__acceptedContext=__entryProbe.contexts[0].context');
    const h=await cdp('Page.getNavigationHistory');await cdp('Page.navigate',{url:origin+'/japan.html'});await until('location.pathname==="/japan.html"&&document.readyState==="complete"','Navigate away');await cdp('Page.navigateToHistoryEntry',{entryId:h.entries[h.currentIndex].id});await until('location.pathname==="/index.html"&&!!document.querySelector("#home-companion").homeCompanion','Return HOME');await pause(150);
    const cached=await evaluate(`({persisted:__entryProbe.pageshows.at(-1),entry:!!document.querySelector('#home-entry'),sameDirector:window.__acceptedDirector===document.querySelector('#home-companion').homeCompanion,sameContext:window.__acceptedContext===__entryProbe.contexts[0]?.context})`);if(cached.persisted){assert.equal(cached.entry,false);assert.equal(cached.sameDirector,true);assert.equal(cached.sameContext,true);}metrics.push({completedBack:cached});console.log('PASS completed back restoration persisted='+cached.persisted);
    // Keyboard path and explicit Escape both retain the same consent policy.
    await navigate('?keyboard');await key('Tab');assert.equal((await state()).focus,'home-entry-silent');await key('Tab', 'Tab',1);assert.equal((await state()).focus,'home-entry-start');await key('Enter');await finished();assert.equal((await state()).sound.unlocked,true);console.log('PASS keyboard primary activation');
    await navigate('?escape');await key('Escape');await finished();assert.equal((await state()).contexts,0);assert.equal((await state()).focus,'np-play');console.log('PASS Escape is explicit silent continuation');
    await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await navigate('?reduced');await click('#home-entry-silent');assert.equal((await state()).dialog.animation,'none');await finished();await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});console.log('PASS reduced-motion static reveal');
    for(const mode of ['unsupported','reject','pending']){
      await navigate('?entry-test='+mode);await click('#home-entry-start');await until('document.getElementById("home-entry").dataset.phase==="'+(mode==='pending'?'unlocking':'failed')+'"','Explicit '+mode+' state');
      if(mode==='pending'){await pause(2600);assert.equal((await state()).dialog.phase,'failed','Bound an unresolved native resume');}
      assert.equal((await state()).snapshot.index,-1);await click('#home-entry-silent');await finished();if(mode==='pending')await evaluate('window.__settleEntryResume()');await pause(2200);
      const s=await state();assert.equal(s.snapshot.index,0);assert.equal(s.sound?.blipsPlayed||0,0);assert.ok(!s.sound?.unlocked);console.log('PASS '+mode+' → explicit silence; no late audio or duplicate greeting');
    }
    // Pending pagehide/back must return to a fresh, usable gate, not a stale promise.
    await navigate('?entry-test=pending&back');await click('#home-entry-start');const history=await cdp('Page.getNavigationHistory');await cdp('Page.navigate',{url:origin+'/japan.html'});await until('location.pathname==="/japan.html"&&document.readyState==="complete"','Pending entry pagehide');await cdp('Page.navigateToHistoryEntry',{entryId:history.entries[history.currentIndex].id});await until('location.pathname==="/index.html"&&!!document.querySelector("#home-entry")','Pending cached/reloaded entry remains reachable');
    assert.equal((await state()).snapshot.index,-1);await click('#home-entry-silent');await finished();assert.equal((await state()).bodyInert,false);metrics.push({pendingBack:await evaluate('__entryProbe.pageshows')});console.log('PASS pending navigation/back gets a fresh reachable entry');
    // Real document visibility uses native tabs; synthetic dispatch is not proof of hidden.
    await navigate('?entry-test=pending&hidden');await click('#home-entry-start');await evaluate('window.__oldEntryDirector=document.querySelector("#home-companion").homeCompanion');
    const other=await cdp('Target.createTarget',{url:'about:blank'});await cdp('Target.activateTarget',{targetId:other.targetId});await until('document.hidden','Native tab becomes hidden');
    await until('!document.getElementById("home-entry")&&!document.querySelector("#home-companion").homeCompanion','Hidden pending entry releases modal and old mount');
    await cdp('Target.activateTarget',{targetId:target.id});await until('!document.hidden&&!!document.getElementById("home-entry")','Foreground gets a new reachable gate');
    assert.equal(await evaluate('window.__oldEntryDirector===document.querySelector("#home-companion").homeCompanion'),false);await evaluate('window.__settleEntryResume()');assert.equal((await state()).snapshot.index,-1);await click('#home-entry-silent');await finished();await cdp('Target.closeTarget',{targetId:other.targetId});console.log('PASS native hidden/foreground invalidates pending work and restores a fresh gate');
    await navigate('?entry-test=pending&cancel-remount');await click('#home-entry-start');await evaluate('window.__oldEntryDirector=document.querySelector("#home-companion").homeCompanion');
    const cancelTab=await cdp('Target.createTarget',{url:'about:blank'});await cdp('Target.activateTarget',{targetId:cancelTab.targetId});await until('document.hidden&&!document.querySelector("#home-companion").homeCompanion','Native hidden teardown before public destroy');
    await evaluate('window.__oldEntryDirector.destroy()');await cdp('Target.activateTarget',{targetId:target.id});await until('!document.hidden','Return after explicit final destroy');await evaluate('window.__settleEntryResume()');await pause(700);
    assert.equal(await evaluate('!!document.getElementById("home-entry")||!!document.querySelector("#home-companion").homeCompanion'),false,'Public old destroy permanently cancels foreground replacement');assert.equal((await state()).bodyInert,false);await cdp('Target.closeTarget',{targetId:cancelTab.targetId});console.log('PASS old public destroy cancels pending foreground remount');
    await navigate('?entry-test=pending&destroy');await click('#home-entry-start');await evaluate('document.querySelector("#home-companion").homeCompanion.destroy()');assert.equal((await state()).dialog,null);await evaluate('window.__settleEntryResume()');await pause(700);assert.equal((await state()).snapshot.index,-1);assert.equal((await state()).bodyInert,false);console.log('PASS explicit destruction cleans modal/pending resume without resurrection');
    await cdp('Network.setBlockedURLs',{urls:[...external,'*home-companion.css*']});await navigate('?missing-css');await click('#home-entry-silent');await finished();console.log('PASS native modal fallback without HOME CSS');
    await cdp('Network.setBlockedURLs',{urls:[...external,'*home-companion.js*']});await cdp('Page.navigate',{url:origin+'/index.html?missing-js'});await until('document.readyState==="complete"','Missing optional HOME behavior');await pause(1000);assert.equal(await evaluate('!!document.getElementById("home-entry")'),false);assert.equal(await evaluate('getComputedStyle(document.body).opacity'),'1');
    await cdp('Network.setBlockedURLs',{urls:external});await cdp('Emulation.setScriptExecutionDisabled',{value:true});await cdp('Page.navigate',{url:origin+'/index.html?no-js'});await pause(800);assert.equal(await evaluate('!!document.getElementById("home-entry")'),false);assert.equal(await evaluate('getComputedStyle(document.body).opacity'),'1');await cdp('Emulation.setScriptExecutionDisabled',{value:false});console.log('PASS missing-JS and no-JS plain HOME fallback');
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'metrics.json'),JSON.stringify(metrics,null,2));console.log('PASS HOME entry native checks. Evidence: '+output);
  }finally{if(ws)ws.close();browser.kill();server.closeAllConnections();server.close();}
})().catch(error=>{console.error(error);console.error('Evidence: '+output);process.exitCode=1;});
