// Actual default-scale browser checks. Component-size contracts live in sobre-mi.test.cjs.
// Node 22+ and local Chrome/Edge; no packages, accounts or external navigation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'y2k-scale-'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const pages = ['index', 'japan', 'music', 'canto', 'tech', 'sobre-mi', 'cosas'];
const near = (a, b, message) => assert.ok(Math.abs(a - b) < 1.5, `${message}: ${a} vs ${b}`);
const chrome = process.env.CHROME_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(fs.existsSync);
assert.ok(chrome, 'Set CHROME_PATH to a Chrome/Edge executable');
const mime = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.gif':'image/gif', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml' };
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, data) => {
    res.writeHead(error ? 404 : 200, { 'Content-Type':mime[path.extname(file)] || 'application/octet-stream' });
    res.end(error ? 'Not found' : data);
  });
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--mute-audio', '--remote-debugging-port=0', `--user-data-dir=${output}/profile`, 'about:blank'], { windowsHide:true, stdio:'ignore' });
  let ws;
  try {
    const portFile = path.join(output, 'profile', 'DevToolsActivePort');
    for (let i = 0; !fs.existsSync(portFile) && i < 100; i++) await pause(100);
    const port = fs.readFileSync(portFile, 'utf8').split('\n')[0];
    const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method:'PUT' })).json();
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    let id = 0;
    const pending = new Map(), errors = [], metrics = [];
    ws.onmessage = event => {
      const message = JSON.parse(event.data);
      if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
      const request = pending.get(message.id);
      if (request) { pending.delete(message.id); message.error ? request.reject(message.error) : request.resolve(message.result); }
    };
    const cdp = (method, params = {}) => new Promise((resolve, reject) => {
      pending.set(++id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async expression => {
      const result = await cdp('Runtime.evaluate', { expression, returnByValue:true, awaitPromise:true });
      assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('Network.enable');
    await cdp('Network.setBlockedURLs', { urls:['*://*.youtube.com/*', '*://youtube.com/*', '*://*.youtube-nocookie.com/*', '*://youtube-nocookie.com/*'] });
    const viewport = async (width, height) => {
      await cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor:1, mobile:false });
      await pause(100);
    };
    for (const [width, height] of [[1920,900], [1920,1080], [1768,1016], [1440,900], [1024,900]]) {
      await viewport(width, height);
      for (const page of pages) {
        await cdp('Page.navigate', { url:`${origin}/${page}.html` });
        for (let i = 0; i < 150; i++) {
          await pause(50);
          if (await evaluate(`document.readyState === 'complete' && location.pathname === '/${page}.html'`)) break;
        }
        await pause(1500);
        const state = await evaluate(`(() => {
          const box = el => { const r = el.getBoundingClientRect(); return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}; };
          const reachable = el => { const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(r.x+r.width/2,r.y+r.height/2); return el === hit || el.contains(hit); };
          const player = document.querySelector('#now-playing-bar'), dock = document.querySelector('#side-dock');
          const controls = [...document.querySelectorAll('#np-prev,#np-play,#np-next,#np-volume,#np-progress,#sm-np-stop')];
          const sidebar = document.querySelector('#sm-sidebar');
          return { scale:Number(getComputedStyle(document.documentElement).zoom), body:box(document.body), main:box(document.querySelector('#main-wrapper')), player:box(player), dock:box(dock), overflow:document.documentElement.scrollWidth>innerWidth+1, controls:controls.map(el=>({id:el.id,reachable:reachable(el)})), socials:[...dock.querySelectorAll('a[href]')].map(el=>({id:el.id,reachable:reachable(el)})), sidebar:sidebar?box(sidebar):null, banners:[...document.querySelectorAll('.sm-sidebar-banners .sm-image-slot')].map(box), thought:document.querySelector('#sm-current-thought')?.textContent };
        })()`);
        metrics.push({page,width,height,...state});
        fs.writeFileSync(path.join(output, 'metrics.json'), JSON.stringify(metrics,null,2));
        assert.ok(state.scale>=1 && state.scale<=1.3001, 'Never shrink below the original design or exceed the preferred 130%');
        if (page!=='sobre-mi' || height>=1016 || width===1024) {
          const expectedScale = Math.max(1,Math.min(1.3,width/1024));
          assert.ok(Math.abs(state.scale-expectedScale)<.001, `${page} ${width}x${height}: preferred 130% unless the canvas cannot fit; got ${state.scale}`);
        }
        near(state.body.height, height, `${page}: use the real viewport height`);
        near(state.player.bottom, height, `${page}: anchored player`);
        near(state.player.height, (page==='sobre-mi'?96:48)*state.scale, `${page}: preserve the player's logical size`);
        assert.equal(state.overflow, false, `${page}: no inaccessible horizontal overflow`);
        assert.ok(state.main.bottom<=state.player.top+2, `${page}: content must end above the player`);
        assert.ok(state.dock.top>=0 && state.dock.bottom<=state.player.top+1, `${page}: dock must remain above the player`);
        assert.ok(state.controls.length>=5 && state.controls.every(c=>c.reachable), `${page}: player controls reachable ${JSON.stringify(state.controls)}`);
        assert.ok(state.socials.every(c=>c.reachable), `${page}: social links reachable ${JSON.stringify(state.socials)}`);
        if (page==='sobre-mi') {
          assert.equal(state.thought,'desvelandome como siempre');
          assert.equal(state.banners.length,2);
          assert.ok(state.banners.every(b=>b.bottom<=state.sidebar.bottom+1), `About: keep both unchanged banners visible at ${width}x${height}`);
          const before = await evaluate(`({sidebar:document.querySelector('#sm-sidebar').getBoundingClientRect().top,player:document.querySelector('#now-playing-bar').getBoundingClientRect().top,scroll:document.querySelector('#sm-main-content').scrollTop})`);
          const point = await evaluate(`(() => {const r=document.querySelector('#sm-main-content').getBoundingClientRect();return{x:r.x+r.width*.6,y:r.y+r.height*.6};})()`);
          await cdp('Input.dispatchMouseEvent', {type:'mouseWheel',...point,deltaY:500,deltaX:0});
          await pause(300);
          const after = await evaluate(`({sidebar:document.querySelector('#sm-sidebar').getBoundingClientRect().top,player:document.querySelector('#now-playing-bar').getBoundingClientRect().top,scroll:document.querySelector('#sm-main-content').scrollTop})`);
          assert.ok(after.scroll>before.scroll, 'The right content must respond to native wheel scrolling');
          near(after.sidebar,before.sidebar,'Sidebar stays anchored'); near(after.player,before.player,'Player stays anchored');
          await evaluate(`document.querySelector('#sm-main-content').scrollTop=0`);
        }
        if (width===1768 || (page==='sobre-mi' && width===1440)) {
          const shot = await cdp('Page.captureScreenshot',{format:'png'});
          fs.writeFileSync(path.join(output,`${page}-${width}.png`),Buffer.from(shot.data,'base64'));
        }
        console.log(`PASS ${page} ${width}x${height} @ ${Math.round(state.scale*100)}%`);
      }
    }
    // Resize the same live document: scaling must not restart audio or change its selection.
    await evaluate(`window.__scaleAudio=document.querySelector('#audio-player');window.__scaleIndex=npIndex;window.__scaleAudio.currentTime=12;`);
    await viewport(1768,1016);
    assert.equal(await evaluate(`window.__scaleAudio===document.querySelector('#audio-player') && npIndex===window.__scaleIndex && Math.abs(window.__scaleAudio.currentTime-12)<1`),true);
    // The mouse trail's CSS position must be in logical, not already-scaled, coordinates.
    await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:500,y:350});
    const spark = await evaluate(`(() => { const s=document.querySelector('.cursor-spark:last-child');return{left:parseFloat(s.style.left),top:parseFloat(s.style.top),scale:Number(getComputedStyle(document.documentElement).zoom)};})()`);
    near(spark.left*spark.scale,500,'Mouse sparkle x follows the cursor');
    near(spark.top*spark.scale,350,'Mouse sparkle y follows the cursor');
    assert.deepEqual(errors,[],'No uncaught browser errors');
    console.log('PASS: 7 sections, 35 viewport cases, default 130%, smaller-window fitting, fixed controls, native scroll and cursor coordinates');
    console.log(`Evidence: ${output}`);
  } finally {
    if (ws) ws.close(); browser.kill(); server.closeAllConnections(); server.close();
  }
})().catch(error=>{console.error(error);console.error(`Evidence: ${output}`);process.exitCode=1;});
