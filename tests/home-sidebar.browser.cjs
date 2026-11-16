// HOME rail regression: local Chromium, real shared handlers, no external requests.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'y2k-home-rail-'));
const chrome = process.env.CHROME_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
assert.ok(chrome, 'Set CHROME_PATH to Chrome/Edge');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const mime = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.png':'image/png', '.jpg':'image/jpeg', '.gif':'image/gif', '.mp3':'audio/mpeg' };
const server = http.createServer((req,res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file,(error,data)=>{
    res.writeHead(error?404:200,{'Content-Type':mime[path.extname(file)] || 'application/octet-stream',...(error?{}:{'Content-Length':data.length})});
    res.end(error?'Not found':data);
  });
});

(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  const browser=spawn(chrome,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--mute-audio','--remote-debugging-port=0','--user-data-dir='+output+'/profile','about:blank'],{windowsHide:true,stdio:'ignore'});
  let ws;
  try {
    const portFile=path.join(output,'profile','DevToolsActivePort');
    for(let i=0;!fs.existsSync(portFile)&&i<100;i++)await pause(100);
    const port=fs.readFileSync(portFile,'utf8').split('\n')[0];
    const target=await(await fetch('http://127.0.0.1:'+port+'/json/new?about:blank',{method:'PUT'})).json();
    ws=new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
    let serial=0;const pending=new Map(),errors=[],metrics=[];
    ws.onmessage=event=>{
      const message=JSON.parse(event.data);
      if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.text);
      const call=pending.get(message.id);
      if(call){pending.delete(message.id);message.error?call.reject(message.error):call.resolve(message.result);}
    };
    const cdp=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++serial,{resolve,reject});ws.send(JSON.stringify({id:serial,method,params}));});
    const evaluate=async expression=>{
      const result=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
      assert.ok(!result.exceptionDetails,JSON.stringify(result.exceptionDetails));return result.result.value;
    };
    const waitFor=async(expression,label)=>{
      for(let i=0;i<150;i++){if(await evaluate(expression))return;await pause(50);}assert.fail(label);
    };
    const state=()=>evaluate(`(() => {
      const side=document.querySelector('#sidebar-right');
      const box=el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
      const visible=el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(el).display!=='none';};
      const hit=el=>{const r=el.getBoundingClientRect(),at=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return at===el||el.contains(at);};
      return {sidebar:box(side),actor:box(document.querySelector('#home-companion')),player:box(document.querySelector('#now-playing-bar')),
        overflow:side.scrollHeight>side.clientHeight+1,scroll:side.scrollTop,scrollHeight:side.scrollHeight,clientHeight:side.clientHeight,
        clock:document.querySelector('#clock-time').textContent,date:document.querySelector('#clock-date').textContent,
        counter:[...document.querySelectorAll('#visitor-counter .digit')].map(el=>el.textContent).join(''),
        badges:document.querySelectorAll('#home-guestbook-note').length,guestbook:document.querySelector('#home-guestbook-note')?box(document.querySelector('#home-guestbook-note')):null,
        controls:[...side.querySelectorAll('#clock-time,#clock-date,#visitor-counter,#omikuji-result-badge,#omikuji-result-text,#omikuji-result-lucky,#omikuji-btn,#home-guestbook-note')].filter(visible).map(el=>({id:el.id,...box(el),hit:el.id!=='omikuji-btn'||hit(el)})),
        hint:document.querySelector('#home-sidebar-overflow-hint')?visible(document.querySelector('#home-sidebar-overflow-hint')):false,
        left:box(document.querySelector('#sidebar-left')),center:box(document.querySelector('#center-feed')),
        leftScroll:document.querySelector('#sidebar-left').scrollTop,centerScroll:document.querySelector('#center-feed').scrollTop,
        result:document.querySelector('#omikuji-result-text').textContent,item:document.querySelector('#omikuji-item').textContent};
    })()`);
    const verify=(s,regular,label)=>{
      assert.match(s.clock,/^\d{2}:\d{2}:\d{2}$/);assert.ok(s.date.length>8);assert.equal(s.counter,'004827');
      assert.equal(s.badges,1);assert.ok(s.actor.y>s.sidebar.y+s.sidebar.height,'Portrait remains below rail');
      assert.ok(Math.abs(s.actor.bottom-s.player.y)<2,'Portrait still meets player edge');
      assert.ok(s.left.height>s.sidebar.height+s.actor.height-4 && s.center.height>s.sidebar.height+s.actor.height-4,'Other column heights are not shortened');
      if(regular){
        assert.equal(s.overflow,false,'No independent rail scrolling '+label+': '+JSON.stringify(s));
        assert.equal(s.hint,false,'No scroll instruction where no scroll is needed');
        for(const c of s.controls){
          assert.ok(c.y>=s.sidebar.y-1&&c.bottom<=s.sidebar.bottom+1&&c.x>=s.sidebar.x-1&&c.right<=s.sidebar.right+1,'Entire '+c.id+' fits '+label+': '+JSON.stringify(c));
          assert.equal(c.hit,true,'Fortune button must be reachable');
        }
      }else if(s.overflow){assert.equal(s.hint,true,'Short-window overflow needs a visible scroll cue');}
    };
    await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Network.enable');
    await cdp('Network.setBlockedURLs',{urls:['*://fonts.googleapis.com/*','*://fonts.gstatic.com/*','*://*.youtube.com/*','*://*.youtube-nocookie.com/*']});
    await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    for(const [width,height] of [[1920,1080],[1920,900],[1768,1016],[1440,900],[1024,900],[1920,768]]){
      const regular=height>=900;
      await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
      await cdp('Page.navigate',{url:origin+'/index.html'});
      await waitFor("document.readyState==='complete'&&!!document.querySelector('#home-companion').homeCompanion",'Load local HOME');
      await evaluate("document.querySelector('#home-entry-silent').click()");
      await waitFor("!document.querySelector('#home-entry')",'Enter HOME silently before geometry checks');
      await pause(1400);
      assert.equal(await evaluate("document.querySelectorAll('#home-status-panel').length"),1,'Clock and counter must share one compact panel');
      for(const id of ['clock-time','clock-date','visitor-counter','home-omikuji-panel','omikuji-btn','omikuji-result-badge','omikuji-result-text','omikuji-result-lucky','omikuji-item']){
        assert.equal(await evaluate('document.querySelectorAll('+JSON.stringify('#'+id)+').length'),1,'Keep unique production hook '+id);
      }
      let s=await state();verify(s,regular,width+'x'+height+' initial');
      const before=s,results=new Set();
      await evaluate('window.__railRandom=Math.random');
      for(let i=0;i<6;i++){
        await evaluate('Math.random=()=>'+((i+.1)/6)+';document.querySelector("#omikuji-btn").click()');
        await waitFor('!document.querySelector("#omikuji-btn").disabled','Shared Omikuji finishes its real callback');
        s=await state();verify(s,regular,width+'x'+height+' fortune'+i);results.add(s.result);
        assert.ok(s.item.length>2&&s.item!=='-','Real lucky item is visible');
        assert.equal(s.leftScroll,before.leftScroll);assert.equal(s.centerScroll,before.centerScroll);
        metrics.push({width,height,fortune:i,...s});
      }
      await evaluate('Math.random=window.__railRandom');
      assert.equal(results.size,6,'All six distinct real fortunes were exercised');
      if(width===1920&&height===1080){
        await evaluate("document.querySelector('#home-status-panel .panel-btn').click()");
        assert.equal(await evaluate("document.querySelector('#home-status-panel .panel-body').style.display"),'none','Existing minimize handler still finds the combined panel body');
        await evaluate("document.querySelector('#home-status-panel .panel-btn').click()");
        assert.equal(await evaluate("document.querySelector('#home-status-panel .panel-body').style.display"),'','Existing restore handler remains intact');
        await evaluate("document.querySelectorAll('#home-status-panel .panel-btn')[1].click()");
        assert.equal(await evaluate("document.querySelector('#home-status-panel').style.display"),'none','Existing close handler remains intact');
      }
      if(!regular&&s.overflow){
        const p={x:s.sidebar.x+s.sidebar.width*.5,y:s.sidebar.y+s.sidebar.height*.6};
        await cdp('Input.dispatchMouseEvent',{type:'mouseWheel',...p,deltaY:10000,deltaX:0});await pause(200);
        const bottom=await state();assert.ok(bottom.scroll>0);assert.ok(bottom.controls.find(c=>c.id==='omikuji-btn').hit,'Short-window fallback can reach action');
      }
      if(width===1768){
        const shot=await cdp('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,'home-compact-rail.png'),Buffer.from(shot.data,'base64'));
        const r=s.sidebar;const crop=await cdp('Page.captureScreenshot',{format:'png',clip:{x:r.x,y:r.y,width:r.width,height:s.actor.bottom-r.y,scale:1}});
        fs.writeFileSync(path.join(output,'compact-rail-and-shurelia.png'),Buffer.from(crop.data,'base64'));
      }
      console.log('PASS compact HOME rail '+width+'x'+height+' all six fortunes');
    }
    fs.writeFileSync(path.join(output,'metrics.json'),JSON.stringify(metrics,null,2));
    assert.deepEqual(errors,[],'No uncaught page errors');
    console.log('PASS combined clock/counter, visible fortune, construction badge, no normal scroll, honest short-window fallback. Evidence: '+output);
  }finally{if(ws)ws.close();browser.kill();server.closeAllConnections();server.close();}
})().catch(error=>{console.error(error);console.error('Evidence: '+output);process.exitCode=1;});
