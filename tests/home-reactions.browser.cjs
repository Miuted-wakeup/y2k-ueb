// Contextual HOME actions: real native input, no route interception or audio consent bypass.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {startBrowser,AUDIO_PROBE,pause}=require('./site-audio-browser-utils.cjs');
const reactions=require('../home-companion-reactions.js');
const director="document.querySelector('#home-companion').homeCompanion";
const selector=key=>'[data-hc-reaction="'+key+'"]';
(async()=>{
 const s=await startBrowser({prefix:'y2k-home-reactions-',instrument:AUDIO_PROBE});
 const key=async()=>{await s.cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await s.cdp('Input.dispatchKeyEvent',{type:'char',text:'\r'});await s.cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});};
 const check=async topic=>{
  await s.wait(director+'.snapshot().context==='+JSON.stringify(topic));
  const state=await s.page(director+'.snapshot()');assert.ok(reactions[topic].some(m=>m.text===state.message.text));assert.equal(state.expression,state.message.mood);return state;
 };
 try{
  await s.cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  for(const protocol of ['http','file']){
   const url=protocol==='http'?s.origin+'/index.html?reactions=check':pathToFileURL(path.join(s.root,'index.html')).href+'?reactions=check';
   await s.navigate(url,'none');
   if(!await s.host('SiteAudioShell.controller.snapshot().entered'))assert.equal(await s.page("[...document.querySelectorAll('.hc-reactive-button')].every(b=>b.disabled)"),true);
   await s.enter(protocol==='http'?'sound':'silent');await s.wait("[...document.querySelectorAll('.hc-reactive-button')].length===6&&[...document.querySelectorAll('.hc-reactive-button')].every(b=>!b.disabled)");
   await s.host('window.__reactionEngine=SiteAudioShell.engine;window.__reactionContext=__reactionEngine.getNativeContext()');
   const before=await s.host('({url:location.href,history:history.length})');
   await s.click(selector('avatar'));await check('avatar');let peak=0;
   for(let i=0;i<25;i++){peak=Math.max(peak,await s.host('(()=>{const p=__audioProbe.contexts[0],a=new Float32Array(p.analyser.fftSize);p.analyser.getFloatTimeDomainData(a);return Math.max(...a.map(Math.abs));})()'));await pause(35);}
   if(protocol==='http')assert.ok(peak>.05,'Context voice is audible while music stays paused: '+peak);
   else{assert.equal(peak,0);assert.equal(await s.host('SiteAudioShell.engine.snapshot().permission'),'silent');}
   const first=await s.page(director+'.snapshot()');await s.click(selector('avatar'));const repeated=await s.page(director+'.snapshot()');
   assert.equal(repeated.message.text,first.message.text);assert.ok(repeated.revealed>=first.revealed,'Spam does not reset typing');
   await s.click('.hc-portrait');assert.equal(await s.page(director+'.snapshot().phase'),'reading');await s.click('.hc-portrait');await s.wait(director+'.snapshot().context===null');
   for(const topic of ['clock','badges','mascots','visits','fortune','guestbook']){
    await pause(450);
    if(topic==='badges'){await s.page(`document.querySelector(${JSON.stringify(selector(topic))}).focus()`);await key();}
    else await s.click(selector(topic));
    await check(topic);
    if(topic==='fortune'){
     await s.wait("!document.querySelector('#omikuji-btn').disabled");
     assert.equal(await s.page("document.querySelector('#omikuji-result-lucky').style.display"),'block','Original fortune still draws a result');
     assert.equal(await s.page("document.querySelector('#omikuji-result-text').textContent.includes('Agitando')"),false);
    }
    console.log('PASS '+protocol+' contextual '+topic);
   }
   assert.deepEqual(await s.host('({url:location.href,history:history.length})'),before,'Objects do not hijack navigation');
   assert.equal(await s.host('SiteAudioShell.engine.snapshot().music.paused'),true,'Reactions never start the song');
   for(const [width,height]of[[1768,1016],[1440,900],[1024,900]]){
    await s.cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await pause(150);
    const geometry=await s.page(`(()=>{const r=document.querySelector('#home-companion').getBoundingClientRect(),p=document.querySelector('#now-playing-bar').getBoundingClientRect(),side=document.querySelector('#sidebar-right'),b=document.querySelector('#home-guestbook-note').getBoundingClientRect(),a=document.querySelector('#avatar-ring').getBoundingClientRect(),k=document.querySelector('[data-hc-reaction="mascots"] img').getBoundingClientRect(),scale=Number(getComputedStyle(document.documentElement).zoom);return{bottom:r.bottom,player:p.top,sidebar:side.getBoundingClientRect().bottom,note:b.bottom,scroll:side.scrollHeight-side.clientHeight,avatar:[a.width,a.height],mascot:k.height,scale,buttonHits:[...document.querySelectorAll('[data-hc-reaction]')].map(el=>{const q=el.getBoundingClientRect(),hit=document.elementFromPoint(q.x+q.width/2,q.y+q.height/2);return{topic:el.dataset.hcReaction,hit:hit?.id||hit?.className||hit?.tagName,ok:el===hit||el.contains(hit)}}),buttonReachable:[...document.querySelectorAll('[data-hc-reaction]')].every(el=>{const q=el.getBoundingClientRect(),hit=document.elementFromPoint(q.x+q.width/2,q.y+q.height/2);return el===hit||el.contains(hit)})};})()`);
    assert.ok(Math.abs(geometry.bottom-geometry.player)<2);assert.ok(geometry.note<=geometry.sidebar+1);assert.ok(geometry.scroll<=1,'No new hidden right scroll');assert.ok(Math.abs(geometry.avatar[0]-90*geometry.scale)<1);assert.ok(Math.abs(geometry.mascot-46*geometry.scale)<1);// The left sidebar intentionally scrolls; badges need not share a viewport with the avatar.
    for(const topic of Object.keys(reactions)){
      const reachable=await s.page(`(()=>{const el=document.querySelector(${JSON.stringify(selector(topic))});el.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit===el||el.contains(hit)})()`);
      assert.equal(reachable,true,topic+' remains reachable through its existing scroll pane');
    }
   }
   await s.screenshot(protocol+'-context.png');
   // Actual navigation remains immediate, and HOME's listener never installs on Tech.
   await s.click('a.nav-tab[href="japan.html"]');await s.wait("SiteAudioShell.controller.snapshot().route.section==='japan'&&SiteAudioShell.controller.snapshot().pageReady",true);
   assert.equal(await s.host('SiteAudioShell.engine===__reactionEngine&&SiteAudioShell.engine.getNativeContext()===__reactionContext'),true);
   assert.equal(await s.page("document.querySelector('[data-hc-reaction]')"),null);
   console.log('PASS '+protocol+' native object/keyboard actions, spam guard, original fortune, geometry, shared engine, consent; voicepeak='+peak);
  }
  assert.deepEqual(s.errors,[]);console.log('PASS contextual HOME reactions. Evidence: '+s.output);
 }catch(error){await s.screenshot('failure.png');fs.writeFileSync(path.join(s.output,'errors.json'),JSON.stringify(s.errors,null,2));console.error('Evidence: '+s.output);throw error;}
 finally{s.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
