const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const{pathToFileURL}=require('node:url');
const{startBrowser,AUDIO_PROBE,pause}=require('./site-audio-browser-utils.cjs');
(async()=>{
  const s=await startBrowser({instrument:AUDIO_PROBE});
  try{
    for(const protocol of ['http','file']){
      const direct=protocol==='http'?s.origin+'/tech.html?mode=retro#hardware':pathToFileURL(path.join(s.root,'tech.html')).href+'?mode=retro#hardware';
      await s.navigate(direct,'none');
      const initial=await s.host('window.SiteAudioShell.controller.snapshot()');
      assert.equal(initial.route.section,'tech');assert.ok(initial.route.href.endsWith('?mode=retro#hardware'));
      console.log(protocol+' initial '+JSON.stringify(initial));
      if(!initial.entered){assert.equal(await s.host('window.SiteAudioShell.engine.snapshot().contextState'),'suspended');await s.click('#site-audio-activate',true);await s.wait('window.SiteAudioShell.controller.snapshot().entered',true);}
      assert.equal(await s.host("window.SiteAudioShell.engine.snapshot().music.paused"),true,'Activation must not force music');
      await s.host('window.__engineRef=window.SiteAudioShell.engine;window.__contextRef=__engineRef.getNativeContext();window.__musicRef=__engineRef.getNativeMedia().music');
      await s.click('#np-play');await s.wait('window.SiteAudioShell.engine.snapshot().music.playing',true);
      await pause(350);let previous=await s.host('window.SiteAudioShell.engine.snapshot().music.currentTime');assert.ok(previous>.05);
      const historyStart=await s.host('history.length');
      for(const[section,file]of[['music','music'],['japan','japan'],['canto','canto'],['sobre-mi','sobre-mi'],['cosas','cosas'],['home','index']]){
        await s.click('a.nav-tab[href="'+file+'.html"]');
        await s.wait('window.SiteAudioShell.controller.snapshot().route.section==='+JSON.stringify(section)+'&&window.SiteAudioShell.controller.snapshot().pageReady',true,'Navigate '+section);
        await s.wait("document.readyState==='complete'",false);await pause(200);
        const refs=await s.host('({same:__engineRef===SiteAudioShell.engine&&__contextRef===SiteAudioShell.engine.getNativeContext()&&__musicRef===SiteAudioShell.engine.getNativeMedia().music,playing:SiteAudioShell.engine.snapshot().music.playing,time:SiteAudioShell.engine.snapshot().music.currentTime,gate:!!document.querySelector("#site-audio-entry")})');
        assert.equal(refs.same,true);assert.equal(refs.playing,true);assert.equal(refs.gate,false);assert.ok(refs.time>=previous-.05);previous=refs.time;
        assert.equal(await s.page('window.__audioProbe.contexts.length'),0,'Children must not create native contexts');
        console.log('PASS '+protocol+' continuous '+section);
      }
      assert.equal(await s.host('history.length'),historyStart+6);
      await s.host('history.back()');await s.wait("SiteAudioShell.controller.snapshot().route.section==='cosas'&&SiteAudioShell.controller.snapshot().pageReady",true);
      await s.host('history.forward()');await s.wait("SiteAudioShell.controller.snapshot().route.section==='home'&&SiteAudioShell.controller.snapshot().pageReady",true);
      assert.equal(await s.host('SiteAudioShell.engine.getNativeContext()===__contextRef'),true);
      await s.host("SiteAudioShell.engine.execute({type:'music',action:'pause'})");
      await s.wait("document.querySelector('#home-companion')?.homeCompanion?.snapshot().typing",false,'First HOME greeting after shared activation');
      let peak=0;for(let i=0;i<35;i++){peak=Math.max(peak,await s.host('(()=>{const p=__audioProbe.contexts[0],a=new Float32Array(p.analyser.fftSize);p.analyser.getFloatTimeDomainData(a);return Math.max(...a.map(Math.abs));})()'));await pause(35);}
      assert.ok(peak>.05,'Shared voice actual waveform '+peak);
      console.log('PASS '+protocol+' same context, one-step history, automatic first voice peak='+peak);
      await s.screenshot(protocol+'-home.png');
      await s.cdp('Page.reload');await s.wait("document.readyState==='complete'&&!!window.SiteAudioShell?.controller&&SiteAudioShell.controller.snapshot().route.section==='home'",true);await s.enter('none');
      const reload=await s.host('({permission:SiteAudioShell.engine.snapshot().permission,entered:SiteAudioShell.controller.snapshot().entered,gate:!!document.querySelector("#site-audio-entry"),route:SiteAudioShell.controller.snapshot().route.section})');
      assert.equal(reload.route,'home');assert.equal(reload.gate,!reload.entered);console.log('PASS '+protocol+' reload validates '+JSON.stringify(reload));
      // Silence is durable across routes/probes, but a later explicit button may re-enable FX.
      if(!reload.entered)await s.host("document.querySelector('#site-audio-silent').click()");
      await s.wait('SiteAudioShell.controller.snapshot().entered',true);
      await s.host('SiteAudioShell.engine.continueSilent()');
      await s.wait("SiteAudioClient.state().permission==='silent'");
      await s.page('SiteAudioClient.requestActivation()');
      await s.wait("!!document.querySelector('#site-audio-entry')",true);
      await s.click('#site-audio-activate',true);
      await s.wait("SiteAudioShell.controller.snapshot().entered&&SiteAudioShell.engine.snapshot().permission==='active'",true);
      assert.equal(await s.host('SiteAudioShell.engine.snapshot().music.paused'),true,'Explicit FX reactivation must not force music');
      await s.wait("SiteAudioClient.state().permission==='active'");
      assert.equal(await s.page("SiteAudioClient.command({type:'chime',frequency:520})"),true,'A new document can use automatic shared effects after real activation');
      console.log('PASS '+protocol+' silent choice and later explicit native reactivation');
      // Regression: a fully loaded, zoomed child must scroll even after a slow decision.
      const about=protocol==='http'?s.origin+'/sobre-mi.html?entry=delayed':pathToFileURL(path.join(s.root,'sobre-mi.html')).href+'?entry=delayed';
      await s.navigate(about,'none');await pause(1600);
      if(!await s.host('SiteAudioShell.controller.snapshot().entered'))assert.equal(await s.host("getComputedStyle(document.querySelector('#site-audio-frame')).display"),'none');
      await s.enter('silent');await pause(150);
      const point=await s.page("(()=>{const e=document.querySelector('#sm-main-content'),r=e.getBoundingClientRect();return{x:r.x+r.width*.6,y:r.y+r.height*.6,before:e.scrollTop};})()");
      await s.cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x,y:point.y});
      await s.cdp('Input.dispatchMouseEvent',{type:'mouseWheel',x:point.x,y:point.y,deltaY:500,deltaX:0});
      await s.wait("document.querySelector('#sm-main-content').scrollTop>"+point.before,false,'Native scroll after delayed entry');
      console.log('PASS '+protocol+' delayed entry retains native child scrolling');
    }
    assert.deepEqual(s.errors,[],'No native runtime exceptions');fs.writeFileSync(path.join(s.output,'requests.json'),JSON.stringify(s.requests,null,2));console.log('PASS persistent audio native integration. Evidence: '+s.output);
  }catch(error){await s.screenshot('failure.png');fs.writeFileSync(path.join(s.output,'errors.json'),JSON.stringify(s.errors,null,2));console.error('Evidence: '+s.output);throw error;}
  finally{s.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
