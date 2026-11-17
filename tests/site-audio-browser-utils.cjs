// Fresh local Chromium sessions, plus default-world selection inside the section frame.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const assert=require('node:assert/strict');const{spawn}=require('node:child_process');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function contextSelector(cdp){
  const contexts=new Map();
  function event(m){
    if(m.method==='Runtime.executionContextCreated')contexts.set(m.params.context.id,m.params.context);
    if(m.method==='Runtime.executionContextDestroyed')contexts.delete(m.params.executionContextId);
    if(m.method==='Runtime.executionContextsCleared')contexts.clear();
  }
  async function pageContext(){
    const tree=(await cdp('Page.getFrameTree')).frameTree;
    const child=tree.childFrames?.find(item=>item.frame.url.includes('__y2k_frame='));
    if(!child)return undefined;
    return [...contexts.values()].find(ctx=>ctx.auxData?.frameId===child.frame.id&&ctx.auxData?.isDefault)?.id;
  }
  async function run(expression,host=false){
    const contextId=host?undefined:await pageContext();
    const result=await cdp('Runtime.evaluate',{expression,contextId,returnByValue:true,awaitPromise:true});
    assert.ok(!result.exceptionDetails,JSON.stringify(result.exceptionDetails));return result.result.value;
  }
  async function wait(expression,host=false,label=expression){
    for(let i=0;i<180;i++){try{if(await run(expression,host))return;}catch(error){if(!/context|destroyed|Execution was terminated/i.test(String(error?.message||error)))throw error;}await pause(50);}
    assert.fail('Timed out: '+label);
  }
  async function click(selector,host=false){
    const p=await run(`(()=>{const n=document.querySelector(${JSON.stringify(selector)});if(!n)throw Error('Missing '+${JSON.stringify(selector)});const r=n.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`,host);
    await cdp('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});
    await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});
  }
  async function enter(mode='silent'){
    await wait("!window.SiteAudioShell?.isHost||!!window.SiteAudioShell.controller",true,'Host starts');
    if(await run('!!window.SiteAudioShell?.isHost',true)){
      await wait("!['checking'].includes(window.SiteAudioShell.controller.snapshot().phase)",true,'Native audio probe settles');
      const pending=await run("!window.SiteAudioShell.controller.snapshot().entered",true);
      if(pending){
        if(mode==='sound')await click('#site-audio-activate',true);
        else if(mode==='silent')await run("document.querySelector('#site-audio-silent').click()",true);
        if(mode!=='none')await wait('window.SiteAudioShell.controller.snapshot().entered',true,'Entry releases requested route');
      }
      await wait('window.SiteAudioShell.controller.snapshot().pageReady',true,'Section bridge/page initialized');
    }
  }
  return{event,run,wait,click,enter,pageContext};
}
async function startBrowser({root=path.resolve(__dirname,'..'),width=1768,height=1016,instrument='',prefix='y2k-persistent-native-'}={}){
  const output=fs.mkdtempSync(path.join(os.tmpdir(),prefix)),requests=[],errors=[];
  const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.gif':'image/gif','.mp3':'audio/mpeg','.json':'application/json'};
  const server=http.createServer((req,res)=>{
    const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    fs.readFile(file,(e,data)=>{res.writeHead(e?404:200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(e?'Not found':data);});
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const chrome=process.env.CHROME_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
  assert.ok(chrome,'Set CHROME_PATH');
  const browser=spawn(chrome,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--mute-audio','--remote-debugging-port=0','--user-data-dir='+output+'/profile','about:blank'],{windowsHide:true,stdio:'ignore'});
  let ws;
  try{
    const portFile=path.join(output,'profile','DevToolsActivePort');
    for(let i=0;!fs.existsSync(portFile)&&i<120;i++)await pause(100);
    const port=fs.readFileSync(portFile,'utf8').split('\n')[0];
    const target=await(await fetch('http://127.0.0.1:'+port+'/json/new?about:blank',{method:'PUT'})).json();
    ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
    let serial=0;const pending=new Map();
    const cdp=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++serial,{resolve,reject});ws.send(JSON.stringify({id:serial,method,params}));});
    const selector=contextSelector(cdp);
    ws.onmessage=event=>{const m=JSON.parse(event.data);selector.event(m);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(m.method==='Network.requestWillBeSent')requests.push(m.params.request.url);const call=pending.get(m.id);if(call){pending.delete(m.id);m.error?call.reject(m.error):call.resolve(m.result);}};
    await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Network.enable');
    await cdp('Network.setBlockedURLs',{urls:['https://*']});
    await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    if(instrument)await cdp('Page.addScriptToEvaluateOnNewDocument',{source:instrument});
    const origin='http://127.0.0.1:'+server.address().port;
    return{root,origin,output,requests,errors,cdp,...selector,
      host:expression=>selector.run(expression,true),page:expression=>selector.run(expression,false),
      async navigate(url,mode='silent'){
        await cdp('Page.navigate',{url});await selector.wait('document.readyState===\'complete\'&&location.href==='+JSON.stringify(url),true,'Top document loads');await selector.enter(mode);
      },
      async screenshot(name){const r=await cdp('Page.captureScreenshot',{format:'png'});const file=path.join(output,name);fs.writeFileSync(file,Buffer.from(r.data,'base64'));return file;},
      close(){ws.close();browser.kill();server.closeAllConnections();server.close();}
    };
  }catch(error){if(ws)ws.close();browser.kill();server.closeAllConnections();server.close();throw error;}
}
const AUDIO_PROBE=`(()=>{Math.random=()=>.1;window.__audioProbe={contexts:[]};const Native=window.AudioContext||window.webkitAudioContext;if(!Native)return;window.AudioContext=new Proxy(Native,{construct(C,args){const ctx=new C(...args),analyser=ctx.createAnalyser();analyser.fftSize=2048;analyser.connect(ctx.destination);const original=ctx.createGain.bind(ctx);ctx.createGain=()=>{const g=original(),connect=g.connect.bind(g);g.connect=(node,...rest)=>connect(node===ctx.destination?analyser:node,...rest);return g;};window.__audioProbe.contexts.push({context:ctx,analyser});return ctx;}});})();`;
module.exports={startBrowser,contextSelector,AUDIO_PROBE,pause};
