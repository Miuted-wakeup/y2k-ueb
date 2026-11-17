// Section-owned image audit: Node 22+ and local Chrome/Edge, no npm packages.
// --snapshot FILE records rendered asset identities, even when ownership fails.
// --compare FILE also checks image bytes/background layers against that baseline.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { contextSelector } = require('./site-audio-browser-utils.cjs');

const root = path.resolve(__dirname, '..');
const pages = ['index', 'japan', 'music', 'canto', 'tech', 'sobre-mi', 'cosas'];
const option = flag => { const i = process.argv.indexOf(flag); return i < 0 ? null : process.argv[i + 1]; };
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const sha = file => fs.existsSync(file) ? crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') : 'MISSING';
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'y2k-section-assets-'));
const chrome = process.env.CHROME_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(fs.existsSync);
assert.ok(chrome, 'Set CHROME_PATH to a Chrome/Edge executable');
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, data) => {
    res.writeHead(error ? 404 : 200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    res.end(error ? 'Not found' : data);
  });
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--mute-audio', '--remote-debugging-port=0', `--user-data-dir=${scratch}/profile`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let ws;
  try {
    const portFile = path.join(scratch, 'profile', 'DevToolsActivePort');
    for (let i = 0; !fs.existsSync(portFile) && i < 100; i++) await pause(100);
    const port = fs.readFileSync(portFile, 'utf8').split('\n')[0];
    const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    const pending = new Map();
    const errors = [];
    let id = 0;
    let selector;
    ws.onmessage = event => {
      const message = JSON.parse(event.data);
      selector?.event(message);
      if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
      const request = pending.get(message.id);
      if (request) { pending.delete(message.id); message.error ? request.reject(message.error) : request.resolve(message.result); }
    };
    const cdp = (method, params = {}) => new Promise((resolve, reject) => {
      pending.set(++id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }));
    });
    selector = contextSelector(cdp);
    const evaluate = expression => selector.run(expression);
    await cdp('Page.enable');
    await cdp('Runtime.enable');
    await cdp('Network.enable');
    // The audit needs no external fonts, images, YouTube or account/session data.
    await cdp('Network.setBlockedURLs', { urls: ['https://*'] });
    await cdp('Page.addScriptToEvaluateOnNewDocument', { source: 'Math.random = () => 0.1;' });
    await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    const snapshots = [];
    const violations = [];
    const missing = new Set();
    let imageCount = 0;
    let cssCount = 0;
    for (const page of pages) {
      const section = page === 'index' ? 'home' : page;
      await cdp('Page.navigate', { url: `${origin}/${page}.html` });
      for (let i = 0; i < 100; i++) {
        await pause(50);
        if (await selector.run(`document.readyState === 'complete' && location.pathname === '/${page}.html'`, true)) break;
      }
      await selector.enter('silent');
      await selector.wait(`document.readyState === 'complete' && location.pathname === '/${page}.html'`,false,'Requested section document loads');
      if(await evaluate("!!document.querySelector('#home-entry-silent')")){
        await evaluate("document.querySelector('#home-entry-silent').click()");
        await selector.wait("!document.querySelector('#home-entry')",false,'Standalone HOME entry releases asset audit');
      }
      await pause(300);
      const snapshot = await evaluate(`(() => {
        const images = Array.from(document.images).map((img, i) => ({ location: 'img[' + i + ']' + (img.id ? '#' + img.id : ''), url: img.getAttribute('src') }));
        document.querySelectorAll('img[srcset], source[srcset]').forEach((el, i) => el.getAttribute('srcset').split(',').forEach((candidate, n) => images.push({ location: 'srcset[' + i + '][' + n + ']', url: candidate.trim().split(/\\s+/)[0] })));
        const css = [];
        const properties = ['backgroundImage', 'borderImageSource', 'listStyleImage', 'maskImage', 'webkitMaskImage', 'content', 'cursor'];
        [document.documentElement, ...document.querySelectorAll('body, body *')].forEach((el, i) => {
          for (const pseudo of [null, '::before', '::after']) {
            const style = getComputedStyle(el, pseudo);
            for (const property of properties) {
              const value = style[property];
              if (value && value.includes('url(')) css.push({ location: i + ':' + el.tagName + (el.id ? '#' + el.id : '') + (pseudo || ''), property, value });
            }
          }
        });
        return { bodyId: document.body.id, images, css };
      })()`);
      const asset = (url, location) => {
        if (!url || url.startsWith('data:')) return { path: url, sha256: url };
        const parsed = new URL(url, origin);
        const relative = decodeURIComponent(parsed.pathname).replace(/^\//, '');
        const own = [`assets/images/${section}/`, `assets/gifs/${section}/`].some(prefix => relative.startsWith(prefix));
        if (parsed.origin !== origin || !own) violations.push(`${page}.html ${location}: ${url}`);
        const digest = parsed.origin === origin ? sha(path.join(root, relative)) : 'REMOTE';
        if (digest === 'MISSING') missing.add(`${page}.html: ${relative}`);
        return { path: relative, sha256: digest };
      };
      const images = snapshot.images.map(img => ({ location: img.location, ...asset(img.url, img.location) }));
      const css = snapshot.css.map(rule => ({ ...rule, value: rule.value.replace(/url\(["']?([^"')]+)["']?\)/g, (_, url) => `url(sha256:${asset(url, `${rule.location}.${rule.property}`).sha256})`) }));
      snapshots.push({ page, bodyId: snapshot.bodyId, images, css });
      imageCount += images.length;
      cssCount += css.length;
      console.log(`${page}: ${images.length} images, ${css.length} effective CSS image rules`);
    }
    if (option('--snapshot')) fs.writeFileSync(option('--snapshot'), JSON.stringify(snapshots, null, 2));
    if (option('--compare')) {
      const before = JSON.parse(fs.readFileSync(option('--compare'), 'utf8'));
      const restoredKirby = sha(path.join(root, 'assets/gifs/home/kirby-hang.gif'));
      snapshots.forEach((after, i) => {
        const previous = before[i];
        assert.equal(after.page, previous.page);
        assert.equal(after.bodyId, previous.bodyId, `${after.page}: do not alter page identity/JS routing`);
        assert.deepEqual(after.css, previous.css, `${after.page}: preserve effective image bytes and background layers`);
        assert.equal(after.images.length, previous.images.length, `${after.page}: preserve image count`);
        after.images.forEach((image, n) => {
          const original = previous.images[n];
          assert.equal(image.location, original.location);
          // COSAS already had a broken player image; the matching local Kirby fixes it.
          const knownRepair = after.page === 'cosas' && original.path === 'assets/gifs/kirby-hang.gif' && original.sha256 === 'MISSING' && image.path === 'assets/gifs/cosas/kirby-hang.gif';
          assert.equal(image.sha256, knownRepair ? restoredKirby : original.sha256, `${after.page} ${image.location}: preserve original image bytes`);
        });
      });
      console.log('PASS: rendered image identities, background layers and body IDs match the baseline (plus the known COSAS Kirby repair)');
    }
    for (const issue of missing) console.log(`WARNING missing asset: ${issue}`);
    assert.deepEqual(errors, [], 'No uncaught browser errors');
    assert.deepEqual(violations, [], 'Every rendered image/GIF and effective CSS image must belong to its section');
    console.log(`PASS: 7 sections, ${imageCount} image references and ${cssCount} effective CSS image rules are section-owned`);
  } finally {
    if (ws) ws.close();
    browser.kill();
    server.closeAllConnections();
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
