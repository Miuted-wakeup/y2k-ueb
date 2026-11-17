// Real local mouse/keyboard interaction; external video navigation is observed, not opened.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {startBrowser,AUDIO_PROBE,pause}=require('./site-audio-browser-utils.cjs');
const messages=require('../home-companion-messages.js');
const videoIndex=messages.findIndex(m=>m.link?.url.includes('XFg5rAAG4Tk'));
const actor="document.querySelector('#home-companion').homeCompanion";
const button='#home-companion .hc-portrait',link='#home-companion .hc-message-link';
(async()=>{
  const s=await startBrowser({prefix:'y2k-shurelia-interaction-',instrument:AUDIO_PROBE+';Math.random=()=>window.__testRandom??.1;'});
  const key=async(key,code,keyCode,modifiers=0)=>{
    await s.cdp('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:keyCode,modifiers});
    if(key==='Enter'||key===' ')await s.cdp('Input.dispatchKeyEvent',{type:'char',text:key==='Enter'?'\r':' ',modifiers});
    await s.cdp('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:keyCode,modifiers:0});
  };
  const targetMessage=async target=>{
    const current=await s.page(actor+'.snapshot().index');
    const step=(target-current+messages.length)%messages.length;
    assert.ok(step>0,'Next requested phrase differs');
    await s.page('window.__testRandom='+((step-.5)/(messages.length-1)));
  };
  try{
    await s.cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
    for(const protocol of ['http','file']){
      const url=protocol==='http'?s.origin+'/index.html?dialogue=interaction':pathToFileURL(path.join(s.root,'index.html')).href+'?dialogue=interaction';
      await s.navigate(url,'none');
      if(!await s.host('SiteAudioShell.controller.snapshot().entered'))assert.equal(await s.page(`document.querySelector(${JSON.stringify(button)}).disabled`),true,'No portrait action can bypass entry');
      await s.enter(protocol==='http'?'sound':'silent');
      await s.wait(`!document.querySelector(${JSON.stringify(button)}).disabled`);
      assert.equal(await s.page(`document.querySelector(${JSON.stringify(button)}).tagName`),'BUTTON');
      assert.equal(await s.page(`document.querySelector(${JSON.stringify(button)}).getAttribute('aria-hidden')`),null);
      assert.equal(await s.page(`document.querySelector(${JSON.stringify(button)}).getAttribute('title')`),null,'No native tooltip over the face');
      await s.click(button);await s.wait(actor+'.snapshot().typing');
      const poses=new Set();let peak=0;
      for(let n=0;n<30;n++){
        poses.add(await s.page("document.querySelector('#home-companion .hc-face').dataset.frame"));
        peak=Math.max(peak,await s.host('(()=>{const p=__audioProbe.contexts[0],a=new Float32Array(p.analyser.fftSize);p.analyser.getFloatTimeDomainData(a);return Math.max(...a.map(Math.abs));})()'));
        await pause(30);
      }
      if(protocol==='http'){assert.ok(peak>.05,'Manual line has actual retro voice waveform '+peak);assert.ok(poses.size>1,'Talking frames still animate');}
      else {assert.equal(peak,0);assert.equal(await s.host('SiteAudioShell.engine.snapshot().permission'),'silent');}
      const glyphs=await s.page(actor+'.snapshot().revealed');await s.click(button);
      assert.equal(await s.page(actor+'.snapshot().phase'),'reading','Click while typing completes current line');
      assert.ok(await s.page(actor+'.snapshot().revealed')>glyphs);
      await targetMessage(videoIndex);await s.click(button);
      assert.equal(await s.page(actor+'.snapshot().index'),videoIndex);
      assert.equal(await s.page(`document.querySelector(${JSON.stringify(link)}).tabIndex`),-1,'Video cannot steal focus while its line types');
      assert.equal(await s.page(`document.querySelector(${JSON.stringify(link)}).inert`),true);
      await s.page(`document.querySelector(${JSON.stringify(button)}).focus()`);await key('Enter','Enter',13);
      await s.wait(actor+".snapshot().phase==='reading'");
      const metadata=await s.page(`(()=>{const a=document.querySelector(${JSON.stringify(link)});return{href:a.href,target:a.target,rel:a.rel,hidden:a.hidden,visibility:getComputedStyle(a).visibility,inert:a.inert};})()`);
      assert.equal(metadata.href,messages[videoIndex].link.url);assert.equal(metadata.target,'_blank');
      assert.match(metadata.rel,/noopener/);assert.match(metadata.rel,/noreferrer/);assert.equal(metadata.visibility,'visible');assert.equal(metadata.inert,false);
      await pause(120); // Commit visibility/inert changes before native sequential focus navigation.
      await key('Tab','Tab',9,8); // CDP Shift bit is8 (Alt is1).
      await s.wait(`document.activeElement===document.querySelector(${JSON.stringify(link)})`,false,'Native Shift+Tab focus commits inside child');
      assert.equal(await s.page(`document.activeElement===document.querySelector(${JSON.stringify(link)})`),true,'Real Shift+Tab reaches the link; focus='+await s.page('document.activeElement?.outerHTML.slice(0,300)'));
      assert.equal(await s.page(actor+'.snapshot().readingHeld'),true,'Focused link cannot auto-disappear');
      // Test actual pointer hit without contacting YouTube or creating an external tab.
      await s.page(`document.querySelector(${JSON.stringify(link)}).addEventListener('click',event=>{window.__videoIntent={trusted:event.isTrusted,href:event.currentTarget.href};event.preventDefault();},{once:true})`);
      await s.click(link);assert.deepEqual(await s.page('__videoIntent'),{trusted:true,href:messages[videoIndex].link.url});
      assert.equal(await s.page(actor+'.snapshot().index'),videoIndex,'Link does not request another phrase');
      for(const [width,height]of[[1768,1016],[1440,900],[1024,900]]){
        await s.cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await pause(150);
        const geo=await s.page(`(()=>{const r=document.querySelector('#home-companion').getBoundingClientRect(),p=document.querySelector('#now-playing-bar').getBoundingClientRect(),b=document.querySelector('.hc-dialogue').getBoundingClientRect(),a=document.querySelector('.hc-message-link').getBoundingClientRect(),play=document.querySelector('#np-play'),q=play.getBoundingClientRect(),hit=document.elementFromPoint(q.x+q.width/2,q.y+q.height/2);return{portraitBottom:r.bottom,playerTop:p.top,bubble:{x:b.x,y:b.y,right:b.right,bottom:b.bottom},link:{x:a.x,right:a.right,bottom:a.bottom},playerReachable:hit===play||play.contains(hit)};})()`);
        assert.ok(Math.abs(geo.portraitBottom-geo.playerTop)<2);assert.equal(geo.playerReachable,true);
        assert.ok(geo.bubble.x>=0&&geo.bubble.y>=0&&geo.bubble.right<=width);
        assert.ok(geo.link.x>=geo.bubble.x&&geo.link.right<=geo.bubble.right&&geo.link.bottom<=geo.bubble.bottom);
      }
      await s.screenshot(protocol+'-linked-dialogue.png');
      await s.page(`document.querySelector(${JSON.stringify(button)}).focus()`);
      const point=await s.page(`(()=>{const r=document.querySelector(${JSON.stringify(button)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
      await s.cdp('Input.dispatchMouseEvent',{type:'mouseMoved',...point});
      await s.wait(actor+'.snapshot().readingHeld===false');
      const before=await s.page(actor+'.snapshot().index');await key(' ','Space',32);
      await s.wait(actor+'.snapshot().index!=='+before);assert.equal(await s.page(actor+'.snapshot().typing'),true,'Space starts another paced line');
      await s.click(button); // Complete the current line before selecting the screenshot's phrase.
      const bookIndex=messages.findIndex(message=>message.text.includes('libros de visitas'));
      await targetMessage(bookIndex);await s.click(button);await s.click(button);
      const book=await s.page("({plain:document.querySelector('.hc-plain').textContent,glyphs:[...document.querySelectorAll('.hc-glyph')].map(g=>g.dataset.glyph).join('')})");
      assert.equal(book.plain,messages[bookIndex].text,'Semantic Spanish retains the original guillemets');
      assert.equal(book.glyphs.includes('?'),false,'No spurious question marks in the screenshot phrase');
      assert.equal((book.glyphs.match(/"/g)||[]).length,2,'Actual original quote cells surround the phrase');
      await s.screenshot(protocol+'-book-dialogue-fixed.png');
      assert.equal(s.requests.some(url=>/^https:\/\/(youtu\.be|(?:www\.)?youtube\.com)\//.test(url)),false,'Dialogue never requests the video automatically');
      console.log('PASS '+protocol+' native click/Enter/Space, semantic expressions, video link/focus/geometry, consent; peak='+peak);
    }
    assert.deepEqual(s.errors,[],'No runtime exceptions');console.log('PASS Shurelia interaction. Evidence: '+s.output);
  }catch(error){await s.screenshot('failure.png');console.error('Evidence: '+s.output);throw error;}
  finally{s.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
