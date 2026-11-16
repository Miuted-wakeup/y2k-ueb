// Local native regression: withdrawn LOADING never mounts or downloads.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'y2k-loading-removed-'));
const chrome = process.env.CHROME_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
assert.ok(chrome, 'Set CHROME_PATH to Chrome/Edge');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.gif':'image/gif', '.mp3':'audio/mpeg' };
const server = http.createServer((req,res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file,(error,data) => { res.writeHead(error ? 404 : 200, { 'Content-Type':mime[path.extname(file)] || 'application/octet-stream' }); res.end(error ? 'Not found' : data); });
});
(async () => {
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = spawn(chrome,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--mute-audio','--remote-debugging-port=0','--user-data-dir='+output+'/profile','about:blank'],{windowsHide:true,stdio:'ignore'});
  let ws;
  try {
    const portFile = path.join(output,'profile','DevToolsActivePort');
    for(let i=0;!fs.existsSync(portFile)&&i<100;i++) await pause(100);
    const port = fs.readFileSync(portFile,'utf8').split('\n')[0];
    const target = await (await fetch('http://127.0.0.1:'+port+'/json/new?about:blank',{method:'PUT'})).json();
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve,reject) => {ws.onopen=resolve;ws.onerror=reject;});
    let serial=0; const pending=new Map(), requests=[], errors=[];
    ws.onmessage = event => {
      const m=JSON.parse(event.data), call=pending.get(m.id);
      if(m.method==='Network.requestWillBeSent') requests.push(m.params.request.url);
      if(m.method==='Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text);
      if(call){pending.delete(m.id);m.error?call.reject(m.error):call.resolve(m.result);}
    };
    const cdp=(method,params={}) => new Promise((resolve,reject) => {pending.set(++serial,{resolve,reject});ws.send(JSON.stringify({id:serial,method,params}));});
    const evaluate=async expression => {const r=await cdp('Runtime.evaluate',{expression,returnByValue:true});assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};
    await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Network.enable');
    await cdp('Network.setBlockedURLs',{urls:['https://*']});
    await cdp('Emulation.setDeviceMetricsOverride',{width:1768,height:1016,deviceScaleFactor:1,mobile:false});
    await cdp('Page.addScriptToEvaluateOnNewDocument',{source:`window.__loadingSeen=false;new MutationObserver(()=>{if(document.getElementById('section-loading-overlay'))window.__loadingSeen=true;}).observe(document,{childList:true,subtree:true});`});
    const urls=['index','japan','music','canto','tech','sobre-mi','cosas'].map(page=>origin+'/'+page+'.html');
    urls.push(pathToFileURL(path.join(root,'index.html')).href);
    for(const url of urls){
      await cdp('Page.navigate',{url});
      let ready=false;
      for(let i=0;i<160;i++){await pause(50);if(await evaluate("document.readyState==='complete'&&location.href==="+JSON.stringify(url))){ready=true;break;}}
      assert.ok(ready,'Page completes: '+url);
      if (await evaluate("!!document.querySelector('#home-entry-silent')")) {
        await evaluate("document.querySelector('#home-entry-silent').click()");
        for(let i=0;i<40;i++){if(await evaluate("!document.querySelector('#home-entry')"))break;await pause(40);}
        assert.equal(await evaluate("!!document.querySelector('#home-entry')"),false,'Explicit HOME entry releases controls');
      }
      await pause(1600);
      const state=await evaluate(`(() => {const p=document.getElementById('np-play'),r=p.getBoundingClientRect();return {seen:window.__loadingSeen,overlay:!!document.getElementById('section-loading-overlay'),opacity:getComputedStyle(document.body).opacity,reachable:p.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};})()`);
      assert.deepEqual(state,{seen:false,overlay:false,opacity:'1',reachable:true},url);
      console.log('PASS no LOADING '+url);
    }
    assert.deepEqual(requests.filter(url=>/\/section-loading\.(js|css|png)(?:[?#]|$)/.test(url)),[],'No withdrawn resources requested');
    assert.deepEqual(errors,[],'No uncaught page exceptions');
    fs.writeFileSync(path.join(output,'requests.json'),JSON.stringify(requests,null,2));
    console.log('PASS seven sections + file preview, no overlay/download/delay; controls reachable. Evidence: '+output);
  } finally {if(ws)ws.close();browser.kill();server.closeAllConnections();server.close();}
})().catch(error => {console.error(error);process.exitCode=1;});
