// Logical 100% component contracts. The default 130% viewport/controls are tested
// separately by site-scale.test.cjs, without changing these original size contracts.
// Local browser regression checks. Node 22+ and Chrome/Edge; no npm packages.
// --theme-only checks palette/layout; --sidebar-baseline FILE records pre-change banner sizes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'y2k-about-'));
const chrome = process.env.CHROME_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(fs.existsSync);
assert.ok(chrome, 'Set CHROME_PATH to a Chrome/Edge executable');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4' };
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404).end('Not found'); return; }
    if (file === path.join(root, 'style.css')) {
      data = Buffer.concat([data, Buffer.from('\n:root { --site-default-scale: 1; }\n')]);
    }
    const headers = { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Accept-Ranges': 'bytes' };
    // Browser media needs a finite length and byte ranges, not a live chunked stream.
    const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || '');
    if (range) {
      const start = Number(range[1]);
      const end = Math.min(range[2] ? Number(range[2]) : data.length - 1, data.length - 1);
      if (start > end) { res.writeHead(416, { 'Content-Range': `bytes */${data.length}` }).end(); return; }
      res.writeHead(206, { ...headers, 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${data.length}` });
      res.end(data.subarray(start, end + 1));
    } else {
      res.writeHead(200, { ...headers, 'Content-Length': data.length });
      res.end(data);
    }
  });
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--mute-audio', '--remote-debugging-port=0', `--user-data-dir=${output}/profile`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let ws;
  try {
    const portFile = path.join(output, 'profile', 'DevToolsActivePort');
    for (let i = 0; !fs.existsSync(portFile) && i < 100; i++) await pause(100);
    const port = fs.readFileSync(portFile, 'utf8').split('\n')[0];
    const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    let id = 0;
    const pending = new Map();
    const errors = [];
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
      const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true });
      assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    const waitFor = async (expression, message) => {
      for (let i = 0; i < 100; i++) {
        if (await evaluate(expression)) return;
        await pause(100);
      }
      assert.fail(message);
    };
    const keyboardActivate = async selector => {
      await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);
      await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
      await cdp('Input.dispatchKeyEvent', { type: 'char', text: '\r' });
      await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    };
    const navigate = async (page, captureIntro = false) => {
      await cdp('Page.navigate', { url: `${origin}/${page}.html` });
      for (let i = 0; i < 100; i++) {
        await pause(100);
        if (await evaluate(`document.readyState === 'complete' && location.pathname === '/${page}.html'`)) break;
      }
      if (captureIntro) {
        await pause(300);
        await screenshot('sobre-mi-greeting-intro');
        await pause(1600);
      } else {
        await pause(1900);
      }
    };
    const screenshot = async name => {
      const { data } = await cdp('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(output, name + '.png'), Buffer.from(data, 'base64'));
    };
    await cdp('Page.enable');
    await cdp('Runtime.enable');
    await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `
      window.addEventListener('load', () => {
        const started = performance.now();
        const opacity = element => {
          let value = 1;
          for (; element; element = element.parentElement) value *= Number(getComputedStyle(element).opacity);
          return value;
        };
        window.__introFadeSamples = [];
        // Observe rendered frames, not one wall-clock instant that headless can miss.
        const sampleFade = () => {
          const elapsed = performance.now() - started;
          const elements = [
            document.querySelector('#sm-notebook') || document.querySelector('.panel'),
            document.querySelector('.sm-content-surface'),
            document.querySelector('#site-header'),
          ];
          window.__introFadeSamples.push({
            elapsed,
            values: elements.map(element => element ? Number(getComputedStyle(element).opacity) : null),
            panel: elements[0] ? opacity(elements[0]) : null,
          });
          if (elapsed < 1400) requestAnimationFrame(sampleFade);
        };
        sampleFade();
        setTimeout(() => {
        const card = document.querySelector('.sm-welcome-card');
        const panel = document.querySelector('#sm-notebook') || document.querySelector('.panel');
        window.__introSample = { card: card ? opacity(card) : 0, panel: panel ? opacity(panel) : 0 };
        }, 300);
        setTimeout(() => {
          const panel = document.querySelector('#sm-notebook') || document.querySelector('.panel');
          window.__introRevealSample = panel?.style.opacity;
        }, 800);
      });
    ` });
    const assertIntroFade = async message => {
      const samples = await evaluate(`window.__introFadeSamples`);
      const diagnostic = JSON.stringify(samples);
      assert.ok(samples.length > 3, `Observe multiple animation frames: ${diagnostic}`);
      assert.ok(samples.every(sample => sample.values.length === 3 && sample.values.every(Number.isFinite)), `All three About fade targets must exist: ${diagnostic}`);
      assert.ok(samples.some(sample => sample.elapsed < 700), `Observe the background-first wait: ${diagnostic}`);
      assert.ok(samples.filter(sample => sample.elapsed < 700).every(sample => sample.panel === 0), `No window may appear before the shared 700ms wait: ${diagnostic}`);
      const intermediate = samples.findIndex(sample => sample.elapsed >= 700 && sample.panel > 0 && sample.panel < 1 && sample.values.every(value => value > 0 && value < 1));
      assert.ok(intermediate >= 0, `${message}: ${diagnostic}`);
      assert.ok(samples.slice(intermediate + 1).some(sample => sample.panel >= .999 && sample.values.every(value => value >= .999)), `The observed fade must finish after its intermediate frames: ${diagnostic}`);
    };
    await cdp('Network.enable');
    await cdp('Network.setBlockedURLs', { urls: ['*://*.youtube.com/*', '*://youtube.com/*', '*://*.youtube-nocookie.com/*', '*://youtube-nocookie.com/*'] });
    await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await navigate('sobre-mi', true);
    await screenshot('sobre-mi-desktop');
    assert.equal(await evaluate(`document.querySelector('#sm-current-thought')?.textContent`), 'desvelandome como siempre', 'Show the exact personal thought supplied by Muted');
    assert.deepEqual(await evaluate(`(() => { const card = document.querySelector('.sm-welcome-card'); return [card.querySelector('h1').firstChild.textContent.trim(), card.querySelector('.sm-card-kanji').textContent, card.querySelector('.sm-card-reading').textContent, card.querySelectorAll('.sm-card-message, .sm-card-notes, .sm-card-signature, .sm-card-serial, .sm-card-face > span').length]; })()`), ['muted', '木漏れ日', 'komorebi', 0], 'Keep just the approved identity/word/thought instead of repeating the biography');
    const assertProfileCard = async (width, height) => {
      const profile = await evaluate(`(() => {
        const box = el => { const r = el.getBoundingClientRect(); return {left:r.left, right:r.right, top:r.top, bottom:r.bottom, height:r.height}; };
        const card = document.querySelector('.sm-welcome-card');
        const images = [card.querySelector('.sm-card-face img'), document.querySelector('.sm-greeting-mascot'), document.querySelector('.sm-greeting-mascot > span')].map(box);
        const text = [...card.querySelectorAll('h1, .sm-card-kanji, .sm-card-reading, .sm-card-meaning, .sm-card-thought-label, #sm-current-thought')].flatMap(el => { const range = document.createRange(); range.selectNodeContents(el); return [...range.getClientRects()].filter(r => r.width && r.height).map(r => ({left:r.left,right:r.right,top:r.top,bottom:r.bottom})); });
        const overlap = (a,b) => Math.min(a.right,b.right)-Math.max(a.left,b.left)>1 && Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1;
        return { card:box(card), collisions:text.filter(r => images.some(image => overlap(r,image))), imageBounds:images, overflow:card.scrollWidth > card.clientWidth + 1 };
      })()`);
      assert.equal(profile.overflow, false, `Profile must not overflow at ${width}x${height}`);
      assert.ok(profile.card.height <= 244, `Keep the simplified card compact: ${JSON.stringify(profile.card)}`);
      assert.deepEqual(profile.collisions, [], `Profile text must avoid avatar and greeting at ${width}x${height}`);
      assert.ok(profile.imageBounds.every(r => r.left >= profile.card.left && r.right <= profile.card.right && r.top >= profile.card.top && r.bottom <= profile.card.bottom), 'Keep the original avatar and complete greeting inside the card');
    };
    await assertProfileCard(1440, 1000);
    const twinkle = await evaluate(`(() => { const star = document.querySelector('.sm-card-spark'); const s = getComputedStyle(star); return { duration:parseFloat(s.animationDuration), count:Number(s.animationIterationCount), delay:parseFloat(s.animationDelay), hidden:star.getAttribute('aria-hidden'), textAnimated:[document.querySelector('#sm-welcome-title'),document.querySelector('#sm-current-thought')].some(el => getComputedStyle(el).animationName !== 'none') }; })()`);
    assert.equal(twinkle.count, 3);
    assert.ok(twinkle.duration > 1 && twinkle.duration * twinkle.count + twinkle.delay <= 5, 'Only three gentle decorative glints, not an endless blinking card');
    assert.equal(twinkle.hidden, 'true');
    assert.equal(twinkle.textAnimated, false, 'The name and thought must remain steady');
    const profilePoint = await evaluate(`(() => { const r = document.querySelector('.sm-welcome-card').getBoundingClientRect(); return {x:r.left+10,y:r.top+10}; })()`);
    await cdp('Input.dispatchMouseEvent', {type:'mouseMoved',...profilePoint});
    assert.deepEqual(await evaluate(`(() => { const star = document.querySelector('.sm-card-spark'); const a = star.getAnimations()[0]; if (!a) return []; a.pause(); return [0,700].map(t => {a.currentTime=t; return Number(getComputedStyle(star).opacity)}); })()`), [.75, 1], 'Hover must replay an actual gentle star-only animation');
    await evaluate(`document.querySelector('.sm-card-spark').getAnimations().forEach(a => a.finish())`);
    await cdp('Input.dispatchMouseEvent', {type:'mouseMoved',x:0,y:0});
    await cdp('Emulation.setEmulatedMedia', {features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    assert.deepEqual(await evaluate(`(() => { const s = getComputedStyle(document.querySelector('.sm-card-spark')); return [s.animationName,s.opacity,s.visibility]; })()`), ['none','1','visible'], 'Reduced motion leaves the star visible and still');
    await cdp('Emulation.setEmulatedMedia', {features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
    const profileClip = await evaluate(`(() => { const r = document.querySelector('.sm-profile-spread').getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height,scale:1}; })()`);
    const profileShot = await cdp('Page.captureScreenshot', {format:'png',clip:profileClip});
    fs.writeFileSync(path.join(output,'sobre-mi-profile-simplified.png'),Buffer.from(profileShot.data,'base64'));
    assert.equal(await evaluate(`document.querySelectorAll('#dock-social .dock-link img').length`), 6, 'Use all six animated social icons in the About-only dock');
    await waitFor(`Array.from(document.querySelectorAll('#dock-social img')).every(img => img.complete && img.naturalWidth === 128 && img.naturalHeight === 128)`, 'All social GIFs must decode at their original processed dimensions');
    const socialDestinations = [
      ['dock-ig', 'instagram', 'https://www.instagram.com/gusaru__/'],
      ['dock-sp', 'spotify', 'https://open.spotify.com/user/wivxhqxtovedrh6km5d0wo672?si=b2c91898873a4e4a'],
      ['dock-tw', 'twitter', 'https://x.com/muted_wakeup'],
      ['dock-yt', 'youtube', 'https://www.youtube.com/watch?v=A67ZkAd1wmI'],
      ['dock-pin', 'pinterest', 'https://pin.it/18v0COEso'],
      ['dock-tt', 'tiktok', 'https://www.nyan.cat/'],
    ];
    for (const [id, image, href] of socialDestinations) {
      assert.deepEqual(await evaluate(`(() => { const a = document.getElementById('${id}'); return [a.querySelector('img').getAttribute('src'), a.getAttribute('href'), !!a.getAttribute('aria-label'), a.getAttribute('aria-disabled')]; })()`), [`assets/gifs/sobre-mi/social/${image}.gif`, href, true, href ? null : 'true']);
      if (href) assert.equal(await evaluate(`(() => { const a = document.getElementById('${id}'); return a.target === '_blank' && a.relList.contains('noopener'); })()`), true, 'External profiles and intentional meme links need safe new-tab semantics');
    }
    const assertSocialDockGeometry = async (width, height) => {
      const state = await evaluate(`(() => {
        const box = el => { const r = el.getBoundingClientRect(); return { left:r.left, right:r.right, top:r.top, bottom:r.bottom, width:r.width, height:r.height }; };
        const dock = document.querySelector('#side-dock');
        return { dock:box(dock), position:getComputedStyle(dock).position, background:getComputedStyle(dock).backgroundColor, content:box(document.querySelector('#main-wrapper')), header:box(document.querySelector('#site-nav')), player:box(document.querySelector('#now-playing-bar')), controls:[...document.querySelectorAll('#dock-social .dock-link')].map(a => ({ ...box(a), reachable:document.elementFromPoint(a.getBoundingClientRect().left + a.offsetWidth/2, a.getBoundingClientRect().top + a.offsetHeight/2) === a })) };
      })()`);
      assert.equal(state.position, 'fixed');
      assert.equal(state.background, 'rgba(0, 0, 0, 0)', 'Show the actual transparent artwork, not another black dock rectangle');
      assert.equal(state.dock.width, 40, 'Keep the original 40px gutter instead of shrinking content or banners');
      assert.ok(state.dock.left >= state.content.right - 1 && state.dock.right <= width + 1, `Dock must stay outside content at ${width}x${height}`);
      assert.ok(state.dock.top >= state.header.bottom && state.dock.bottom <= state.player.top, `Dock must fit between navigation and Winamp at ${width}x${height}: ${JSON.stringify(state.dock)}`);
      assert.ok(state.controls.every(a => a.reachable && a.top >= state.dock.top && a.bottom <= state.dock.bottom && a.width >= 40 && a.height >= 28), 'All six controls must remain visible and reachable');
    };
    await assertSocialDockGeometry(1440, 1000);
    const socialClip = await evaluate(`(() => { const r = document.querySelector('#side-dock').getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, height:r.height, scale:1 }; })()`);
    const socialShot = await cdp('Page.captureScreenshot', { format:'png', clip:socialClip });
    fs.writeFileSync(path.join(output, 'sobre-mi-social-dock.png'), Buffer.from(socialShot.data, 'base64'));
    // Exercise native keyboard activation without opening external accounts or memes.
    await evaluate(`window.__socialActivations = []; document.querySelectorAll('#dock-social a[href]').forEach(a => a.addEventListener('click', event => { event.preventDefault(); window.__socialActivations.push(a.id); }));`);
    for (const [id, , href] of socialDestinations) if (href) await keyboardActivate('#' + id);
    assert.deepEqual(await evaluate(`window.__socialActivations`), ['dock-ig', 'dock-sp', 'dock-tw', 'dock-yt', 'dock-pin', 'dock-tt']);
    assert.equal(await evaluate(`document.querySelector('.sm-greeting-mascot img').getAttribute('src')`), 'assets/gifs/sobre-mi/45050ba7_original.gif', 'Use the requested replacement only for the profile greeting character');
    await waitFor(`document.querySelector('.sm-greeting-mascot img').complete && document.querySelector('.sm-greeting-mascot img').naturalWidth === 70 && document.querySelector('.sm-greeting-mascot img').naturalHeight === 100`, 'The requested animated greeting must load in its original proportions');
    assert.equal(await evaluate(`!!document.querySelector('#sm-vocal-archive .sm-routine-poster img')`), true, 'The practice archive should include a section-owned vertical poster, outside its tool panels');
    assert.deepEqual(await evaluate(`(() => { const poster = document.querySelector('.sm-routine-poster > img'); const gif = document.querySelector('.sm-routine-motion'); return [poster.getAttribute('src'), gif.getAttribute('src'), !!poster.closest('.panel'), !!gif.closest('.panel'), document.querySelectorAll('.sm-exercise-card').length, document.querySelectorAll('.sm-routine-check').length]; })()`), ['assets/images/sobre-mi/routine-poster.webp', 'assets/gifs/sobre-mi/routine-cat-sing.gif', false, false, 24, 5], 'Keep the practice functions/content and own each new decorative asset within About');
    const assertPracticeCollage = async width => {
      const geometry = await evaluate(`(() => {
        const box = el => { const r = el.getBoundingClientRect(); return { left:r.left, right:r.right, top:r.top, bottom:r.bottom, width:r.width, height:r.height }; };
        const workspace = document.querySelector('.sm-vocal-workspace');
        const poster = document.querySelector('.sm-routine-poster > img');
        const grid = document.querySelector('.sm-phase-pane.active .sm-exercise-cards-grid');
        const cat = document.querySelector('.sm-routine-motion');
        return { workspace:box(workspace), poster:box(poster), loaded:poster.complete && poster.naturalWidth === 855 && cat.complete && cat.naturalWidth === 498, columns:getComputedStyle(grid).gridTemplateColumns.split(' ').length, overflow:workspace.scrollWidth > workspace.clientWidth + 2, cards:[...grid.children].map(box) };
      })()`);
      assert.equal(geometry.loaded, true, 'Both the original vertical image and animated sticker must decode');
      assert.ok(geometry.poster.height / geometry.poster.width > 1.4, 'Keep the portrait genuinely vertical instead of cropping it into another horizontal banner');
      assert.equal(geometry.overflow, false, `The scrapbook must not introduce horizontal scrolling at ${width}px`);
      assert.equal(geometry.columns, width <= 1280 ? 1 : 2, `Use loose notes at wide sizes and readable single-column notes at ${width}px`);
      assert.ok(geometry.cards.every(card => card.left >= geometry.workspace.left && card.right <= geometry.workspace.right && card.width > 150), 'Keep the slightly tilted notes inside the workspace');
    };
    assert.equal(await evaluate(`document.querySelectorAll('.sm-decoration-break').length`), 0, 'Remove dedicated decoration strips instead of treating the mascots as another section');
    assert.equal(await evaluate(`document.querySelector('#sm-y2k-pet') instanceof HTMLImageElement`), true, 'Keep the supplied pixel GIF as part of the existing signature');
    await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('#sm-y2k-pet')).visibility`), 'visible', 'The chosen GIF must not disappear when the browser requests reduced motion');
    await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    await waitFor(`document.querySelector('#sm-y2k-pet').complete && document.querySelector('#sm-y2k-pet').naturalWidth === 200`, 'The small GIF must load without scrolling or a test-forced decode');
    await evaluate(`document.querySelector('#sm-y2k-pet').scrollIntoView({ block: 'center', behavior: 'instant' })`);
    assert.deepEqual(await evaluate(`(() => { const img = document.querySelector('#sm-y2k-pet'); const style = getComputedStyle(img); return [img.getAttribute('src'), img.naturalWidth, img.naturalHeight, parseFloat(style.width), parseFloat(style.height), style.imageRendering, !!img.closest('.sm-page-signature'), !!img.closest('.panel'), img.getAttribute('aria-hidden'), style.pointerEvents, img.loading, style.filter]; })()`), ['assets/gifs/sobre-mi/y2k.gif', 200, 200, 72, 72, 'pixelated', true, false, 'true', 'none', 'eager', 'brightness(2)'], 'Keep the original GIF clearly visible, eagerly loaded and slightly brighter against the dark page');
    await screenshot('sobre-mi-signature-pet');
    await pause(90);
    await screenshot('sobre-mi-signature-pet-turn');
    const footerClip = await evaluate(`(() => { const r = document.querySelector('.sm-page-signature').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, scale: 1 }; })()`);
    const footerShot = await cdp('Page.captureScreenshot', { format: 'png', clip: footerClip });
    fs.writeFileSync(path.join(output, 'sobre-mi-gif-visible.png'), Buffer.from(footerShot.data, 'base64'));
    await evaluate(`document.querySelector('#sm-main-content').scrollTo({ top: 0, behavior: 'instant' })`);
    const assertPixelPetLayout = async width => {
      assert.equal(await evaluate(`(() => { const pet = document.querySelector('#sm-y2k-pet'); const r = pet.getBoundingClientRect(); const p = pet.closest('.sm-page-signature').getBoundingClientRect(); return r.width === 72 && r.height === 72 && r.left >= p.left && r.right <= p.right && r.top >= p.top && r.bottom <= p.bottom; })()`), true, `The visible pixel pet must fit its existing signature without an independent decoration row at ${width}px`);
    };
    await assertPixelPetLayout(1440);
    const mascotNames = ['skull-web', 'spider-sleepy'];
    assert.equal(await evaluate(`!!document.querySelector('.sm-profile-row [data-sm-mascot="skull-web"]') && !!document.querySelector('.sm-personal-extras [data-sm-mascot="spider-sleepy"]') && !document.querySelector('#sm-guestbook [data-sm-mascot]')`), true, 'Anchor the skull and spider to existing frames and leave the wide GIF unobstructed');
    assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('[data-sm-mascot]')).map(el => el.dataset.smMascot)`), mascotNames, 'Keep only two quiet frame ornaments instead of showing all six designs at once');
    assert.equal(await evaluate(`[...document.querySelectorAll('[data-sm-mascot]')].every(el => el.closest('#sm-main-content') && !el.closest('.panel') && el.getAttribute('aria-hidden') === 'true' && !el.matches('a, button, input') && getComputedStyle(el).pointerEvents === 'none')`), true, 'Keep decorative mascots outside panels, inaccessible to focus and unable to intercept clicks');
    assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('[data-sm-mascot]')).map(el => getComputedStyle(el, '::before').backgroundPosition)`), ['100% 100%', '50% 0%'], 'Keep the approved artwork cells while changing their integration');
    const atlas = await evaluate(`(async () => {
      const css = getComputedStyle(document.querySelector('[data-sm-mascot]'), '::before');
      const url = css.backgroundImage.slice(5, -2);
      const image = new Image(); image.src = url; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let clear = 0; let marks = 0;
      const ink = Array.from({ length: 6 }, () => [512, 512, 0, 0]);
      for (let i = 3; i < pixels.length; i += 4) {
        if (pixels[i] === 0) clear++; else marks++;
        if (pixels[i] > 40) {
          const pixel = (i - 3) / 4; const x = pixel % canvas.width; const y = Math.floor(pixel / canvas.width);
          const b = ink[Math.floor(y / 512) * 3 + Math.floor(x / 512)]; const cx = x % 512; const cy = y % 512;
          b[0] = Math.min(b[0], cx); b[1] = Math.min(b[1], cy); b[2] = Math.max(b[2], cx + 1); b[3] = Math.max(b[3], cy + 1);
        }
      }
      return { source: new URL(url).pathname, width: image.naturalWidth, height: image.naturalHeight, clear, marks, ink, size: css.backgroundSize };
    })()`);
    assert.equal(atlas.source, '/assets/images/sobre-mi/decor/spooky-mascots.png', 'The production sprite must be copied into this section, not linked to a Codex preview');
    assert.deepEqual([atlas.width, atlas.height, atlas.size], [1536, 1024, '300% 200%']);
    assert.ok(atlas.clear > atlas.width * atlas.height * .5 && atlas.marks > 10000, 'Use real transparency with visible artwork, not an opaque contact sheet');
    const assertSpookyDecorationLayout = async width => {
      const result = await evaluate(`(() => {
        const overlap = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
        const protectedRects = [];
        for (const el of document.querySelectorAll('#sm-main-content h2, #sm-main-content h3, #sm-main-content p, #sm-main-content dt, #sm-main-content dd, #sm-main-content summary, #sm-main-content a, #sm-main-content .panel-controls, #sm-main-content button, #sm-main-content input, #sm-main-content img, #sm-profile-video')) {
          // Range geometry can expose unpainted descendants of a closed details.
          let hiddenByDetails = false;
          for (let parent = el.parentElement; parent; parent = parent.parentElement) {
            if (parent.matches('details:not([open])') && !parent.querySelector(':scope > summary')?.contains(el)) { hiddenByDetails = true; break; }
          }
          if (hiddenByDetails) continue;
          let rects;
          if (el.matches('img, video, button, input, .panel-controls')) rects = [el.getBoundingClientRect()];
          else { const range = document.createRange(); range.selectNodeContents(el); rects = [...range.getClientRects()]; }
          protectedRects.push(...rects.map(r => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height, label: el.id || el.getAttribute('src') || el.textContent.trim().slice(0, 65) })));
        }
        const controls = protectedRects.filter(r => r.width && r.height);
        const ink = ${JSON.stringify(atlas.ink)}; const cells = [5, 1];
        const center = document.querySelector('.sm-center-row').getBoundingClientRect();
        const profile = document.querySelector('.sm-profile-row').getBoundingClientRect();
        const extras = document.querySelector('.sm-personal-extras').getBoundingClientRect();
        const notebook = document.querySelector('#sm-notebook').getBoundingClientRect();
        return [...document.querySelectorAll('[data-sm-mascot]')].map((el, index) => {
          const r = el.getBoundingClientRect();
          const before = getComputedStyle(el, '::before'); const artWidth = parseFloat(before.width); const artHeight = parseFloat(before.height);
          const origin = before.transformOrigin.split(' ').map(parseFloat); const matrix = new DOMMatrix(before.transform);
          const b = ink[cells[index]];
          const points = [[b[0], b[1]], [b[2], b[1]], [b[0], b[3]], [b[2], b[3]]].map(([x, y]) => {
            const point = new DOMPoint(x * artWidth / 512 - origin[0], y * artHeight / 512 - origin[1]).matrixTransform(matrix);
            return { x: point.x + origin[0] + parseFloat(before.left), y: point.y + origin[1] + parseFloat(before.top) };
          });
          const paint = { left: r.left + Math.min(...points.map(p => p.x)), right: r.left + Math.max(...points.map(p => p.x)), top: r.top + Math.min(...points.map(p => p.y)), bottom: r.top + Math.max(...points.map(p => p.y)) };
          const support = index === 0 ? profile : notebook;
          const fitsFrame = index === 0 ? paint.top >= support.top - 2 && paint.bottom <= support.top + 24 : Math.abs(paint.bottom - support.top) <= 2 && paint.top < support.top - 10;
          return { name: el.dataset.smMascot, width: r.width, height: r.height, artWidth, artHeight, inkVisible: points.every(point => point.x >= -1 && point.x <= r.width + 1 && point.y >= -1 && point.y <= r.height + 1), fitsFrame, collisions: controls.filter(c => overlap(paint, c)).map(c => c.label), gaps: [profile.top - center.bottom, notebook.top - extras.bottom], animation: getComputedStyle(el).animationName };
        });
      })()`);
      for (const [index, item] of result.entries()) {
        const artSize = [28, 50][index];
        assert.deepEqual([item.width, item.artWidth, item.artHeight], [artSize, artSize, artSize], `Keep ${item.name}'s intended artwork scale at ${width}px`);
        assert.equal(item.height, artSize, 'Keep frame ornaments proportional without dedicated strip windows');
        assert.equal(item.inkVisible, true, `Do not crop visible lines from ${item.name}`);
        assert.equal(item.fitsFrame, true, `Integrate ${item.name} as a header badge or a spider perched on the border at ${width}px`);
        assert.ok(item.gaps.every(gap => Math.abs(gap - 8) < 1), 'Restore the original 8px flow gaps, with no decoration-only spacing');
        assert.deepEqual(item.collisions, [], `${item.name} must not cover content at ${width}px: ${JSON.stringify(item.collisions)}`);
        assert.equal(item.animation, 'none', 'Static decorations must not introduce endless distracting motion');
      }
    };
    await assertSpookyDecorationLayout(1440);
    for (const width of [1024, 1100, 1148, 1150, 1280, 1440, 1490, 1500, 1560, 1764, 1920]) {
      await cdp('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
      await screenshot(`sobre-mi-perches-${width}`);
      await assertSpookyDecorationLayout(width);
      await assertPixelPetLayout(width);
    }
    await evaluate(`document.querySelector('.sm-collection-fold').open = true`);
    for (const width of [1024, 1280, 1440, 1764, 1920]) {
      await cdp('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
      await assertSpookyDecorationLayout(width);
    }
    await evaluate(`document.querySelector('.sm-collection-fold').open = false`);
    await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await screenshot('sobre-mi-spooky-top');
    await evaluate(`document.querySelector('#sm-profile-bio').scrollIntoView({ block: 'center', behavior: 'instant' })`);
    await screenshot('sobre-mi-frame-profile');
    await evaluate(`document.querySelector('#sm-notebook').scrollIntoView({ block: 'center', behavior: 'instant' })`);
    await screenshot('sobre-mi-frame-notes');
    await evaluate(`document.querySelector('#sm-main-content').scrollTo({ top: 0, behavior: 'instant' })`);
    console.log('PASS: two border-integrated ornaments, no decoration strips, original flow and protected text/images');
    assert.equal(await evaluate(`!!document.querySelector('#sm-current') && !!document.querySelector('#sm-blinkies')`), true, 'Add the compact personal update and blinkie collection beside one another below the biography');
    assert.equal(await evaluate(`document.querySelectorAll('#sm-current dl > div').length`), 3, 'Keep current notes brief and manually editable');
    const blinkieNames = ['solo-alma', 'no-algorithms', 'web-a-mano', 'y2k-soul', 'jpop-en-bucle', 'voz-propia', 'rumbo-a-japon', 'mi-pequeno-mundo'];
    assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('#sm-blinkies img')).map(image => image.getAttribute('src'))`), blinkieNames.map(name => `assets/images/sobre-mi/blinkies/${name}.svg`), 'All eight blinkies must be independent, section-owned and editable image assets');
    assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('#sm-blinkies a')).map(link => link.getAttribute('href')).sort()`), ['canto.html', 'japan.html', 'music.html', 'tech.html'], 'Keep specialized interests as short links to their full sections');
    assert.equal(await evaluate(`document.querySelectorAll('#sm-current iframe, #sm-current audio, #sm-current video, #sm-blinkies iframe, #sm-blinkies audio, #sm-blinkies video').length`), 0, 'Personal additions must not duplicate the dedicated music or singing sections');
    const assertPersonalExtrasGeometry = async width => {
      const geometry = await evaluate(`(() => {
        const box = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
        return { row: box('.sm-personal-extras'), bio: box('.sm-profile-row'), notes: box('#sm-notebook'), current: box('#sm-current'), blinkies: box('#sm-blinkies'), overflow: [...document.querySelectorAll('.sm-personal-extras, #sm-current, #sm-blinkies')].some(el => el.scrollWidth > el.clientWidth + 1) };
      })()`);
      assert.ok(Math.abs(geometry.row.x - geometry.bio.x) < 2 && Math.abs(geometry.row.width - geometry.bio.width) < 2, `Personal additions must retain the main column width at ${width}px`);
      assert.ok(geometry.row.y >= geometry.bio.bottom && geometry.row.bottom <= geometry.notes.y, 'Keep both additions between the biography and existing notes');
      assert.ok(geometry.current.right < geometry.blinkies.x && geometry.row.height < 180, `Use a compact side-by-side composition at ${width}px`);
      assert.equal(geometry.overflow, false, 'Personal text and blinkies must not clip horizontally');
    };
    await evaluate(`document.querySelector('.sm-personal-extras').scrollIntoView({ block: 'center', behavior: 'instant' })`);
    await evaluate(`Promise.all([...document.querySelectorAll('#sm-blinkies img')].map(image => image.decode()))`);
    assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('#sm-blinkies img')).map(image => [image.complete, image.naturalWidth, image.naturalHeight, image.width, image.height, !!image.alt.trim()])`), Array.from({ length: 8 }, () => [true, 150, 20, 150, 20, true]), 'Each blinkie must decode at its pixel size and have alternative text');
    await assertPersonalExtrasGeometry(1440);
    await screenshot('sobre-mi-personal-extras');
    await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    assert.equal(await evaluate(`[...document.querySelectorAll('#sm-blinkies img')].every(image => getComputedStyle(image).animationName === 'none')`), true, 'Blinkies must stop decorative motion when reduced motion is requested');
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('#sm-y2k-pet')).visibility`), 'visible', 'Keep the chosen GIF visible under reduced motion instead of hiding its content');
    await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    await evaluate(`document.querySelector('#sm-main-content').scrollTo({ top: 0, behavior: 'instant' })`);
    console.log('PASS: brief manual current notes, eight local blinkies, dedicated-section links and reduced motion');
    assert.equal(await evaluate(`document.querySelector('#sm-guestbook .sm-guestbook-gif') instanceof HTMLImageElement`), true, 'Replace the complete stamp panel with the chosen local GIF');
    assert.deepEqual(await evaluate(`(() => {
      const frame = document.querySelector('#sm-guestbook'); const image = frame.querySelector('.sm-guestbook-gif'); const link = document.querySelector('.sm-contact-grid a[href="#sm-guestbook"]');
      return [frame.classList.contains('sm-guestbook-media'), image.getAttribute('src'), !!frame.querySelector('.panel-titlebar, .panel-title, button, .panel-btn, #stamp-display-wall, .sm-stamp-picker'), !!document.querySelector('.sm-stamp-btn, #sm-clear-stamps, #stamp-count'), /gif/i.test(link.textContent) && !/sello/i.test(link.textContent)];
    })()`), [true, 'assets/gifs/sobre-mi/penne.gif', false, false, true], 'Replace all guestbook chrome and stamp controls while retaining an accurately labelled sidebar anchor');
    const assertGuestbookGifGeometry = async width => {
      const geometry = await evaluate(`(() => {
        const box = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
        const style = getComputedStyle(document.querySelector('.sm-guestbook-gif'));
        return { frame: box('#sm-guestbook'), image: box('#sm-guestbook .sm-guestbook-gif'), row: box('.sm-profile-row'), artists: box('#sm-artists'), archive: box('#sm-vocal-archive'), fit: style.objectFit, position: style.objectPosition };
      })()`);
      const near = (a, b) => Math.abs(a - b) < 2;
      assert.ok(near(geometry.frame.x, geometry.row.x) && near(geometry.frame.width, geometry.row.width), `The GIF must retain the original full main-column width at ${width}px`);
      // The original stamp panel measured 174px at every tested desktop width.
      assert.ok(near(geometry.frame.height, 174), `Keep the replaced panel's 174px footprint at ${width}px`);
      assert.ok(geometry.frame.y >= geometry.artists.bottom && geometry.archive.y >= geometry.frame.bottom, 'The GIF must remain between the music panel and vocal archive without overlap');
      assert.ok(geometry.image.x >= geometry.frame.x && geometry.image.right <= geometry.frame.right && geometry.image.y >= geometry.frame.y && geometry.image.bottom <= geometry.frame.bottom && geometry.image.height > 0, 'Keep the GIF inside its frame');
      assert.ok(near(geometry.image.width, geometry.frame.width - 2) && near(geometry.image.height, geometry.frame.height - 2), 'The image must cover the full banner inside its one-pixel border');
      assert.equal(geometry.fit, 'cover', 'Fill the wide GIF banner with a proportional crop rather than stretching the source');
      assert.equal(geometry.position, '50% 20%', 'Lower only the image inside the unchanged banner to show the character\'s face');
    };
    await evaluate(`document.querySelector('#sm-guestbook').scrollIntoView({ block: 'center', behavior: 'instant' })`);
    await evaluate(`document.querySelector('.sm-guestbook-gif').decode()`);
    const gifHeader = fs.readFileSync(path.join(root, 'assets/gifs/sobre-mi/penne.gif'));
    assert.deepEqual(await evaluate(`(() => { const image = document.querySelector('.sm-guestbook-gif'); return [image.complete, image.naturalWidth, image.naturalHeight]; })()`), [true, gifHeader.readUInt16LE(6), gifHeader.readUInt16LE(8)], 'The chosen local GIF must decode at its actual dimensions, including manual replacements');
    await assertGuestbookGifGeometry(1440);
    assert.equal(await evaluate(`(() => { const frame = document.querySelector('#sm-guestbook').getBoundingClientRect(); const main = document.querySelector('#sm-main-content').getBoundingClientRect(); const player = document.querySelector('#now-playing-bar').getBoundingClientRect(); return frame.top >= main.top && frame.bottom <= main.bottom && frame.bottom <= player.top; })()`), true, 'The scrolled GIF must be fully visible in the right reading area above the anchored player');
    await screenshot('sobre-mi-guestbook-gif');
    await evaluate(`document.querySelector('#sm-main-content').scrollTo({ top: 0, behavior: 'instant' })`);
    console.log('PASS: local GIF replaces all stamp chrome, retains 174px footprint and sidebar anchor');
    assert.equal(await evaluate(`document.querySelector('#sm-profile-video') instanceof HTMLVideoElement`), true, 'Place the chosen local video beside the compact About text');
    assert.deepEqual(await evaluate(`(() => { const v = document.querySelector('#sm-profile-video'); return [v.getAttribute('src'), v.autoplay, v.muted, v.defaultMuted, v.loop, v.playsInline, v.controls, v.preload, !!v.closest('.panel')]; })()`), ['assets/gifs/sobre-mi/character.mp4', true, true, true, true, true, true, 'metadata', false], 'Use an independent section-owned video with real controls and muted playback outside the text panel');
    assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('#sm-profile-bio .sm-about-chunk p')).map(p => p.textContent.replace(/\\s+/g, ' ').trim())`), [
      'Canto, aprendo japonés y construyo mi propio rincón de internet. Este espacio reúne lo que me mueve: la música, Japón y una web hecha a mano, con personalidad.',
      'Un lugar mío de verdad, para escribir, guardar lo que me gusta y dejar un poquito de mí. No algoritmos, solo alma. ✦'
    ], 'Compacting the About panel must preserve both complete paragraphs');
    const assertBioVideoGeometry = async width => {
      const geometry = await evaluate(`(() => {
        const box = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
        return { row: box('.sm-profile-row'), text: box('#sm-profile-bio'), frame: box('.sm-profile-media'), video: box('#sm-profile-video'), fit: getComputedStyle(document.querySelector('#sm-profile-video')).objectFit };
      })()`);
      const near = (a, b) => Math.abs(a - b) < 2;
      assert.ok(near(geometry.row.x, geometry.text.x) && near(geometry.row.y, geometry.text.y), `Keep the text at the row's left edge at ${width}px`);
      assert.ok(geometry.text.right < geometry.frame.x && near(geometry.frame.right, geometry.row.right), `The video must stay beside, not over, the text at ${width}px`);
      assert.ok(near(geometry.frame.width, 132) && near(geometry.frame.height, 132), `Keep the compact video frame square at ${width}px`);
      assert.ok(geometry.text.bottom <= geometry.row.bottom + 1 && geometry.frame.bottom <= geometry.row.bottom + 1, 'Text and video must fit in the same row without vertical overflow');
      assert.ok(geometry.video.x >= geometry.frame.x && geometry.video.right <= geometry.frame.right && geometry.video.y >= geometry.frame.y && geometry.video.bottom <= geometry.frame.bottom, 'Native video must fit inside its border without cropping');
      assert.equal(geometry.fit, 'contain', 'Keep the complete square clip visible');
    };
    await evaluate(`document.querySelector('.sm-profile-row').scrollIntoView({ block: 'center', behavior: 'instant' })`);
    await waitFor(`document.querySelector('#sm-profile-video').readyState >= 2`, 'The real local MP4 must decode');
    assert.deepEqual(await evaluate(`(() => { const v = document.querySelector('#sm-profile-video'); return [v.videoWidth, v.videoHeight, Number.isFinite(v.duration) && v.duration > 40, v.error]; })()`), [720, 720, true, null], 'The source MP4 metadata must load without changing the asset');
    if (await evaluate(`document.querySelector('#sm-profile-video').paused`)) await evaluate(`document.querySelector('#sm-profile-video').play()`);
    await waitFor(`!document.querySelector('#sm-profile-video').paused`, 'The muted video must be playable');
    const videoTime = await evaluate(`document.querySelector('#sm-profile-video').currentTime`);
    await pause(250);
    assert.ok(await evaluate(`document.querySelector('#sm-profile-video').currentTime > ${videoTime} + .05`), 'Video playback must advance, not just display a poster');
    await evaluate(`document.querySelector('#sm-profile-video').pause()`);
    assert.equal(await evaluate(`document.querySelector('#sm-profile-video').paused`), true, 'The native player must remain pausable');
    await evaluate(`document.querySelector('#sm-profile-video').play()`);
    await assertBioVideoGeometry(1440);
    await screenshot('sobre-mi-bio-video');
    await evaluate(`document.querySelector('#sm-main-content').scrollTo({ top: 0, behavior: 'instant' })`);
    console.log('PASS: local 720x720 MP4 decode/play/pause, muted controls, full biography and side-by-side placement');
    assert.equal(await evaluate(`(() => { const rgb = getComputedStyle(document.querySelector('#sm-interests .panel-title')).color.match(/\\d+/g).slice(0, 3).map(Number); return Math.max(...rgb) - Math.min(...rgb) <= 20; })()`), true, 'About chrome must use asphalt/silver neutrals instead of the old pink/lavender palette');
    assert.deepEqual(await evaluate(`['#site-header', '.sm-welcome-card', '#sm-interests', '#sm-treasures', '#sm-profile-bio', '#now-playing-bar'].filter(selector => { const rgb = getComputedStyle(document.querySelector(selector)).backgroundColor.match(/\\d+/g).slice(0, 3).map(Number); return Math.max(...rgb) > 96; })`), [], 'The About header, panels and player must use dark graphite surfaces');
    const paletteSamples = await evaluate(`(() => {
      const cases = [
        ['window title', '#sm-interests .panel-title', '#sm-interests .panel-titlebar'],
        ['profile text', '#sm-profile-bio .sm-about-chunk p', '#sm-profile-bio'],
        ['navigation link', '.sm-contact-grid a', '#sm-contact'],
        ['favorite label', '.sm-favorite', '#sm-treasures'],
        ['profile meaning', '.sm-card-meaning', '.sm-welcome-card'],
        ['profile thought', '#sm-current-thought', '.sm-welcome-card'],
        ['site button', '.sm-web-button', '.sm-web-button'],
        ['site button caption', '.sm-web-button span', '.sm-web-button'],
        ['second button caption', '.sm-web-button-pink span', '.sm-web-button-pink'],
        ['archive title', '.sm-archive-label', '#sm-vocal-archive > summary'],
        ['archive description', '.sm-archive-label small', '#sm-vocal-archive > summary'],
        ['active voice state', '.sm-state-pill-btn.active', '.sm-state-pill-btn.active'],
        ['active routine tab', '.sm-routine-tab-btn.active', '.sm-routine-tab-btn.active'],
        ['social dock', '.dock-link', '.dock-link'],
        ['masthead', '#site-title', '#site-header'],
        ['navigation tab', '.nav-tab', '.nav-tab'],
        ['greeting label', '.sm-greeting-mascot > span', '.sm-greeting-mascot > span'],
        ['player title', '#np-title', '#np-info'],
        ['player artist', '#np-artist', '#np-info'],
        ['player time', '.np-time', '#now-playing-bar'],
        ['player volume', '#vol-icon', '#now-playing-bar'],
        ['player control', '#np-play', '#np-play'],
        ['mini TV title', '.sm-cyber-tv-title', '.sm-cyber-tv-topbar'],
        ['practice checklist', '.sm-check-label', '.sm-check-row'],
        ['practice section link', '.sm-vocal-routine-desc a', '#sm-routine'],
        ['current title', '#sm-current-title', '#sm-current'],
        ['current note', '#sm-current dd', '#sm-current'],
        ['current link', '#sm-current a', '#sm-current'],
        ['blinkie title', '#sm-blinkies-title', '#sm-blinkies']
      ];
      return cases.map(([name, text, surface]) => {
        const foreground = getComputedStyle(document.querySelector(text)).color;
        const background = getComputedStyle(document.querySelector(surface));
        const stops = background.backgroundImage.match(/rgba?\\([^)]*\\)/g);
        return { name, foreground, backgrounds: stops || [background.backgroundColor] };
      });
    })()`);
    const luminance = color => {
      const rgb = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(n => n / 255);
      return rgb.map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4).reduce((sum, n, i) => sum + n * [.2126, .7152, .0722][i], 0);
    };
    for (const sample of paletteSamples) {
      for (const background of sample.backgrounds) {
        const values = [luminance(sample.foreground), luminance(background)].sort((a, b) => a - b);
        const ratio = (values[1] + .05) / (values[0] + .05);
        assert.ok(ratio >= 4.5, `${sample.name} must remain legible across its gradient: ${ratio.toFixed(2)}:1`);
      }
    }
    console.log(`PASS: dark urban chrome and ${paletteSamples.length} sampled text contrasts`);
    const sidebarBaselineIndex = process.argv.indexOf('--sidebar-baseline');
    if (sidebarBaselineIndex >= 0) {
      const baselines = [];
      for (const width of [1024, 1280, 1440, 1764, 1920]) {
        await cdp('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
        baselines.push(await evaluate(`(() => {
          const box = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
          return { viewportWidth: ${width}, banners: [...document.querySelectorAll('.sm-sidebar-banners img')].map(img => { const r = img.getBoundingClientRect(); return { src: img.getAttribute('src'), x: r.x, width: r.width, height: r.height }; }), profile: box('.sm-welcome-card'), contact: box('#sm-contact'), siteNote: box('#sm-site-note') };
        })()`));
      }
      fs.writeFileSync(process.argv[sidebarBaselineIndex + 1], JSON.stringify(baselines, null, 2));
      console.log('PASS: recorded original horizontal-banner dimensions and sidebar cards');
      return;
    }
    assert.equal(await evaluate(`!!document.querySelector('#sm-sidebar-character, .sm-character-slot, .sm-character-anchor, .sm-player-pinned')`), false, 'Remove the retired character from the page rather than hiding it');
    assert.equal(await evaluate(`document.querySelector('#sm-main-content')?.matches('main.sm-main-scroll')`), true, 'Only the right-hand main region should own reading scroll');
    const sidebarCompareIndex = process.argv.indexOf('--sidebar-compare');
    const sidebarBefore = sidebarCompareIndex >= 0 ? JSON.parse(fs.readFileSync(process.argv[sidebarCompareIndex + 1], 'utf8')) : [];
    for (const [width, height] of [[1764, 1000], [1920, 900], [1280, 800]]) {
      await cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
      await evaluate(`document.querySelector('#sm-main-content').scrollTo({ top: 0, behavior: 'instant' })`);
      const measureSidebar = () => evaluate(`(() => {
        const box = element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom }; };
        const side = document.querySelector('#sm-sidebar'); const main = document.querySelector('#sm-main-content'); const outer = document.querySelector('#main-wrapper');
        return { side: box(side), sidebarClientHeight: side.clientHeight, sidebarScrollHeight: side.scrollHeight, sidebarScrollTop: side.scrollTop, outerScrollTop: outer.scrollTop, mainScrollTop: main.scrollTop, mainClientHeight: main.clientHeight, mainScrollHeight: main.scrollHeight, content: box(document.querySelector('#sm-banner')), player: box(document.querySelector('#now-playing-bar')), banners: [...document.querySelectorAll('.sm-sidebar-banners img')].map(img => { const frame = img.closest('figure').getBoundingClientRect(); return { src: img.getAttribute('src'), frameAspect: frame.width / frame.height, ...box(img) }; }) };
      })()`);
      const initial = await measureSidebar();
      await assertProfileCard(width, height);
      assert.ok(initial.mainScrollHeight > initial.mainClientHeight, 'The right content must remain independently scrollable');
      assert.ok(initial.sidebarScrollHeight <= initial.sidebarClientHeight + 1, `Keep the compact sidebar fully visible at ${width}×${height}: ${initial.sidebarScrollHeight}/${initial.sidebarClientHeight}px`);
      assert.ok(initial.banners.every(b => b.bottom <= initial.side.bottom + 1), `Keep both unscaled banners inside the locked sidebar at ${width}×${height}`);
      assert.ok(initial.banners.every(b => Math.abs(b.frameAspect - 4) < .02), 'Preserve the horizontal-banner frame aspect ratios, including their borders');
      if (sidebarBefore.length) {
        const previous = sidebarBefore.find(row => row.viewportWidth === width);
        assert.equal(initial.banners.length, previous.banners.length);
        initial.banners.forEach((banner, i) => {
          const original = previous.banners[i];
          assert.equal(banner.src, original.src);
          assert.ok(Math.abs(banner.width - original.width) < 1 && Math.abs(banner.height - original.height) < 1, `Do not shrink the horizontal images at ${width}px`);
        });
      }
      const sidePoint = { x: initial.side.x + initial.side.width / 2, y: initial.side.y + initial.side.height / 2 };
      await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', ...sidePoint });
      await cdp('Input.dispatchMouseEvent', { type: 'mouseWheel', ...sidePoint, deltaX: 0, deltaY: 320 });
      await pause(250);
      assert.deepEqual(await evaluate(`['#sm-main-content', '#sm-sidebar', '#main-wrapper'].map(selector => document.querySelector(selector).scrollTop)`), [0, 0, 0], 'Wheeling over the locked sidebar must not move either column');
      const rightPoint = await evaluate(`(() => { const r = document.querySelector('#sm-main-content').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 3 }; })()`);
      await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', ...rightPoint });
      await cdp('Input.dispatchMouseEvent', { type: 'mouseWheel', ...rightPoint, deltaX: 0, deltaY: 320 });
      await waitFor(`document.querySelector('#sm-main-content').scrollTop > 30`, 'Wheeling over the right region must scroll its content');
      const moved = await measureSidebar();
      assert.ok(moved.content.y < initial.content.y - 20, 'Right-hand content must move under native wheel input');
      assert.deepEqual(moved.side, initial.side, 'The sidebar frame must not move with the right scroll');
      assert.deepEqual(moved.banners, initial.banners, 'The horizontal sidebar images must stay stationary');
      assert.deepEqual(moved.player, initial.player, 'The anchored player must remain stationary');
      assert.equal(moved.outerScrollTop, 0);
      assert.equal(moved.sidebarScrollTop, 0);
      await evaluate(`document.querySelector('#sm-main-content').scrollTo({ top: 0, behavior: 'instant' })`);
      await keyboardActivate('.sm-contact-grid a[href="#sm-guestbook"]');
      await waitFor(`document.querySelector('#sm-main-content').scrollTop > 30`, 'The native sidebar fragment link must reveal its target in the right scroller');
      assert.deepEqual((await measureSidebar()).banners, initial.banners, 'Following a sidebar link must not displace the sidebar');
      await evaluate(`history.replaceState(null, '', location.pathname); document.querySelector('#sm-main-content').scrollTo({ top: 0, behavior: 'instant' }); document.querySelector('#sm-main-content').focus()`);
      assert.equal(await evaluate(`document.querySelector('#sm-main-content').tabIndex`), 0, 'The right reading area must be keyboard focusable');
      await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'PageDown', code: 'PageDown', windowsVirtualKeyCode: 34 });
      await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'PageDown', code: 'PageDown', windowsVirtualKeyCode: 34 });
      await waitFor(`document.querySelector('#sm-main-content').scrollTop > 30`, 'PageDown must scroll the focused right reading area');
      assert.deepEqual((await measureSidebar()).banners, initial.banners, 'Keyboard reading must leave the sidebar fixed');
      await evaluate(`document.querySelector('#sm-main-content').scrollTo({ top: document.querySelector('#sm-main-content').scrollHeight, behavior: 'instant' })`);
      const bottom = await measureSidebar();
      assert.deepEqual(bottom.banners, initial.banners, 'The sidebar must also remain fixed at the end of the reading area');
      await screenshot(`sobre-mi-sidebar-${width}x${height}`);
    }
    await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await evaluate(`document.querySelector('#sm-main-content').scrollTo({ top: 0, behavior: 'instant' })`);
    console.log('PASS: retired character removed; compact locked sidebar, unchanged banners, right-only native scrolling');
    if (process.argv.includes('--theme-only')) {
      assert.equal(await evaluate(`window.__introRevealSample`), '1', 'Keep the shared 700ms entrance');
      assert.deepEqual(await evaluate(`['#sm-notebook', '.sm-content-surface', '#site-header'].map(selector => { const style = getComputedStyle(document.querySelector(selector)); return [style.transitionProperty, style.transitionDuration]; })`), [['opacity', '0.5s'], ['opacity', '0.5s'], ['opacity', '0.5s']], 'Keep the shared smooth fade without requiring a specific rendered frame on a busy machine');
      for (const width of [1024, 1280, 1440, 1764, 1920]) {
        await cdp('Emulation.setDeviceMetricsOverride', { width, height: width === 1764 ? 1021 : 900, deviceScaleFactor: 1, mobile: false });
        await assertBioVideoGeometry(width);
        await assertGuestbookGifGeometry(width);
        await assertPersonalExtrasGeometry(width);
        await assertSpookyDecorationLayout(width);
        await assertPixelPetLayout(width);
        assert.equal(await evaluate(`(() => { const side = document.querySelector('#sm-sidebar').getBoundingClientRect(); const frame = document.querySelector('#sm-layout').getBoundingClientRect(); return side.width / frame.width >= .24 && side.width / frame.width <= .26; })()`), true, 'Keep the 25/75 layout');
        assert.equal(await evaluate(`document.querySelector('#now-playing-bar').getBoundingClientRect().height`), 96);
        assert.equal(await evaluate(`document.querySelector('#main-wrapper').getBoundingClientRect().bottom <= document.querySelector('#now-playing-bar').getBoundingClientRect().top + 1`), true, 'Keep player clearance');
        assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('#main-wrapper .panel')).filter(el => el.getClientRects().length && el.scrollWidth > el.clientWidth + 2).map(el => el.id)`), [], 'Darkening must not change content geometry');
        await screenshot(`sobre-mi-dark-${width}`);
      }
      await evaluate(`document.querySelector('#sm-vocal-archive').open = true; document.querySelector('#sm-vocal-archive').scrollIntoView({ behavior: 'instant' })`);
      await screenshot('sobre-mi-dark-archive');
      await navigate('japan');
      assert.equal(await evaluate(`getComputedStyle(document.body).getPropertyValue('--sm-paper').trim()`), '', 'The new palette must remain About-only');
      assert.equal(await evaluate(`document.querySelector('#now-playing-bar').getBoundingClientRect().height`), 48, 'Keep the other player skins intact');
      assert.deepEqual(errors, [], 'No uncaught browser errors');
      console.log('PASS: dark theme, 1024–1920px geometry, shared entrance and other-section isolation');
      return;
    }
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.sm-sidebar-surface')).backgroundImage.includes('assets/images/sobre-mi/')`), true, 'The replaceable sidebar background must use an About-owned image');
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.sm-sidebar-surface')).backgroundRepeat`), 'no-repeat', 'The sidebar background must not repeat');
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.sm-sidebar-surface')).backgroundSize`), '100% 100%', 'Stretch the chosen image across the full sidebar width and height');
    assert.equal(await evaluate(`(async () => { const image = new Image(); image.src = getComputedStyle(document.querySelector('.sm-sidebar-surface')).backgroundImage.slice(5, -2); await image.decode(); return image.naturalWidth > 0 && image.naturalHeight > 0; })()`), true, 'The current user-chosen sidebar background must load successfully');
    assert.equal(await evaluate(`!!document.querySelector('#now-playing-bar .sm-winamp-titlebar')`), true, 'About should have the requested Winamp player skin');
    assert.equal(await evaluate(`document.querySelector('#np-play').tagName`), 'BUTTON', 'Keep transport controls keyboard accessible');
    assert.equal(await evaluate(`!!document.querySelector('#sm-np-stop')`), true, 'The Winamp stop control must be functional, not a painted button');
    assert.equal(await evaluate(`document.querySelectorAll('audio#audio-player').length`), 1, 'Keep one shared audio element');
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.sm-winamp-cover')).backgroundImage.includes('assets/images/sobre-mi/player-cover-source.jpg')`), true, 'Player artwork must have its own About asset');
    const playerIndex = await evaluate(`npIndex`);
    await keyboardActivate('#np-play');
    await waitFor(`!document.querySelector('#audio-player').paused && localStorage.getItem('isPlaying') === 'true'`, 'Play must start the real shared audio');
    await waitFor(`Number.isFinite(document.querySelector('#audio-player').duration) && document.querySelector('#audio-player').duration > 0`, 'The real playlist track must load metadata after Play');
    assert.equal(await evaluate(`document.querySelector('#np-play').getAttribute('aria-label')`), 'Pausar');
    assert.equal(await evaluate(`document.querySelector('#now-playing-bar').classList.contains('sm-winamp-playing')`), true);
    await screenshot('sobre-mi-winamp-playing');
    await keyboardActivate('#np-play');
    assert.equal(await evaluate(`document.querySelector('#audio-player').paused`), true, 'Play toggle must pause');
    assert.equal(await evaluate(`localStorage.getItem('isPlaying')`), 'false');
    await evaluate(`document.querySelector('#np-volume').value = .3; document.querySelector('#np-volume').dispatchEvent(new Event('input', { bubbles: true }))`);
    await waitFor(`document.querySelector('#sm-np-volume-value').textContent === '30%'`, 'Volume display must reflect actual audio volume');
    assert.equal(await evaluate(`document.querySelector('#audio-player').volume`), .3);
    assert.equal(await evaluate(`Number(localStorage.getItem('npVolume'))`), .3);
    await evaluate(`document.querySelector('#np-progress').value = 35; document.querySelector('#np-progress').dispatchEvent(new Event('input', { bubbles: true }))`);
    await waitFor(`!document.querySelector('#audio-player').seeking`, 'Seek must complete');
    assert.equal(await evaluate(`Math.abs(document.querySelector('#audio-player').currentTime / document.querySelector('#audio-player').duration - .35) < .02`), true, 'Seek range must move the actual audio');
    await keyboardActivate('#np-next');
    assert.equal(await evaluate(`npIndex`), (playerIndex + 1) % 6);
    assert.equal(await evaluate(`document.querySelector('#audio-player').paused`), true, 'Next must preserve paused state');
    await keyboardActivate('#np-prev');
    assert.equal(await evaluate(`npIndex`), playerIndex);
    await waitFor(`document.querySelector('#audio-player').readyState >= 1`, 'Previous track must load');
    await keyboardActivate('#np-play');
    await waitFor(`!document.querySelector('#audio-player').paused && isPlaying`, 'Playback must restart');
    await keyboardActivate('#sm-np-stop');
    assert.deepEqual(await evaluate(`(() => { const a = document.querySelector('#audio-player'); return [a.paused, a.currentTime, isPlaying, startFrom, document.querySelector('#np-progress').value, document.querySelector('#np-current-time').textContent, localStorage.getItem('isPlaying'), Number(localStorage.getItem('npTime')), npIndex, a.volume]; })()`), [true, 0, false, 0, '0', '0:00', 'false', 0, playerIndex, .3], 'Stop must reset playback and persistence without changing song or volume');
    assert.equal(await evaluate(`document.querySelector('#np-play').getAttribute('aria-label')`), 'Reproducir');
    await navigate('japan');
    assert.equal(await evaluate(`!!document.querySelector('.sm-winamp-titlebar')`), false, 'Other sections must not receive the About skin');
    assert.equal(await evaluate(`document.querySelector('#now-playing-bar').getBoundingClientRect().height`), 48);
    assert.deepEqual(await evaluate(`[npIndex, document.querySelector('#audio-player').volume, document.querySelector('#audio-player').paused, document.querySelector('#audio-player').currentTime]`), [playerIndex, .3, true, 0], 'Player state must survive navigation to another section');
    await navigate('sobre-mi');
    assert.equal(await evaluate(`document.querySelector('#sm-np-volume-value').textContent`), '30%');
    console.log('PASS: Winamp real play/pause/seek/volume/previous/next/Stop, keyboard controls and cross-section persistence');
    assert.deepEqual(await evaluate(`Array.from(new Set(Array.from(document.images).map(img => img.getAttribute('src')))).filter(src => !src.startsWith('assets/images/sobre-mi/') && !src.startsWith('assets/gifs/sobre-mi/'))`), [], 'Every About image/GIF must be stored in its own section folders');
    assert.equal(await evaluate(`getComputedStyle(document.body).backgroundImage.includes('assets/images/sobre-mi/')`), true, 'The background must also use the About asset folder regardless of its editable filename or format');
    assert.equal(await evaluate(`!!document.querySelector('.sm-welcome-card')`), true, 'Presentation should use a compact welcome card');
    assert.equal(await evaluate(`!!document.querySelector('#sm-sidebar') && !!document.querySelector('.sm-portal-main')`), true, 'Reference layout needs a left sidebar and a separate main area');
    assert.equal(await evaluate(`document.querySelector('#sm-banner figcaption').getBoundingClientRect().right <= document.querySelector('#sm-banner').getBoundingClientRect().right + 1`), true, 'Banner caption must not cover the separate poster column');
    assert.equal(await evaluate(`document.querySelector('#sm-profile-bio').matches('article')`), true, 'Keep the personal introduction as readable text');
    assert.equal(await evaluate(`document.querySelectorAll('#sm-notebook article').length >= 2`), true, 'The notebook should contain distinct personal entries');
    const personalBanners = await evaluate(`Array.from(document.querySelectorAll('[data-sm-banner] img')).map(img => img.getAttribute('src'))`);
    assert.equal(personalBanners.length, 4, 'Keep the existing horizontal banner and add three independent image slots');
    assert.equal(new Set(personalBanners).size, 4, 'Each horizontal slot must have its own file');
    assert.equal(await evaluate(`!!document.querySelector('#sm-artists img[src="assets/images/sobre-mi/vivarium1.jpg"]')`), true, 'Keep Ado artwork separate from the personal banners');
    assert.ok(!personalBanners.includes('assets/images/sobre-mi/vivarium1.jpg'));
    assert.equal(await evaluate(`!!document.querySelector('figure.sm-postcard figcaption')`), true, 'An undated aspirational postcard should accompany the journal');
    assert.equal(await evaluate(`!!document.querySelector('#sm-vocal-archive .sm-id-fields-table') && !document.querySelector('#sm-profile-bio .sm-id-fields-table')`), true, 'Technical vocal details belong in the practice archive, not the presentation');
    for (const selector of ['.sm-notebook-fold', '.sm-inspiration-fold', '.sm-collection-fold']) {
      assert.equal(await evaluate(`document.querySelector('${selector}').open`), false);
      await evaluate(`document.querySelector('${selector} summary').focus()`);
      await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
      await cdp('Input.dispatchKeyEvent', { type: 'char', text: '\r' });
      await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
      assert.equal(await evaluate(`document.querySelector('${selector}').open`), true, 'Notes and collection folds must open by keyboard');
      await evaluate(`document.querySelector('${selector}').open = false`);
    }
    assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('#sm-layout a[href^="#"]')).filter(a => !document.getElementById(a.hash.slice(1))).map(a => a.hash)`), [], 'Reading links must have real targets');
    for (const src of await evaluate(`Array.from(document.images).map(img => img.getAttribute('src'))`)) {
      assert.ok(fs.existsSync(path.join(root, src)), `Local scrapbook image must exist: ${src}`);
    }
    await evaluate(`document.querySelector('#sm-notebook .panel-btn').click()`);
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('#sm-notebook .panel-body')).display`), 'none');
    await evaluate(`document.querySelector('#sm-notebook .panel-btn').click(); document.querySelector('#sm-main-content').scrollTop = 0`);
    assert.notEqual(await evaluate(`getComputedStyle(document.querySelector('#sm-notebook .panel-body')).display`), 'none');
    console.log('PASS: preserved notes, collection folds, local links/assets and window controls');
    const introSample = await evaluate(`window.__introSample`);
    assert.ok(introSample.card > 0.1 && introSample.panel === 0, `Card must precede windows: ${JSON.stringify(introSample)}`);
    assert.equal(await evaluate(`window.__introRevealSample`), '1', 'About must start revealing after the same 700ms wait as JAPAN/CANTO');
    await assertIntroFade('Windows, background surface and header must pass through intermediate opacity, not appear abruptly');
    assert.deepEqual(await evaluate(`(() => { const a = document.querySelector('.sm-greeting-mascot'); return [a?.href, a?.target, a?.rel.includes('noopener')]; })()`), ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', '_blank', true]);
    // Exercise native link activation without opening an external video in tests.
    await evaluate(`window.__greetings = 0; document.querySelector('.sm-greeting-mascot').addEventListener('click', event => { event.preventDefault(); window.__greetings++; }); document.querySelector('.sm-greeting-mascot').focus()`);
    await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await cdp('Input.dispatchKeyEvent', { type: 'char', text: '\r' });
    await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    assert.equal(await evaluate(`window.__greetings`), 1, 'Greeting must work with the keyboard');
    const greetingPoint = await evaluate(`(() => { const r = document.querySelector('.sm-greeting-mascot').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height * 0.7 }; })()`);
    await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', ...greetingPoint, button: 'left', clickCount: 1 });
    await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', ...greetingPoint, button: 'left', clickCount: 1 });
    assert.equal(await evaluate(`window.__greetings`), 2, 'Greeting must not be covered by a window');
    if (process.argv.includes('--baseline')) {
      for (const page of ['index', 'music', 'canto', 'tech', 'japan']) { await navigate(page); await screenshot(page); }
      await navigate('sobre-mi');
    }
    // Pin the existing interactive contracts before changing the composition.
    await evaluate(`document.querySelector('#sm-vocal-archive summary')?.click()`);
    await waitFor(`document.querySelector('.sm-routine-motion').complete && document.querySelector('.sm-routine-poster > img').complete`, 'Practice decorations must load when opening the archive');
    await assertPracticeCollage(1440);
    await evaluate(`document.querySelector('#sm-vocal-archive').scrollIntoView({ behavior: 'instant', block: 'start' })`);
    await screenshot('sobre-mi-practice-collage');
    assert.equal(await evaluate(`document.querySelectorAll('.sm-phase-pane').length`), 5);
    await evaluate(`document.querySelector('[data-phase="3"]').click()`);
    assert.equal(await evaluate(`document.querySelector('.sm-phase-pane.active').id`), 'phase-3');
    await evaluate(`document.querySelector('[data-state="⚡ Twang Activo"]').click()`);
    assert.equal(await evaluate(`document.querySelector('#sm-active-state-txt').textContent`), '⚡ Twang Activo');
    await evaluate(`document.querySelector('.sm-routine-check').click()`);
    assert.equal(await evaluate(`document.querySelector('#sm-tracker-pct-text').textContent`), '20%');
    await navigate('sobre-mi');
    assert.equal(await evaluate(`document.querySelector('.sm-routine-check').checked`), true);
    assert.equal(await evaluate(`document.querySelector('.sm-guestbook-gif').getAttribute('src')`), 'assets/gifs/sobre-mi/penne.gif', 'The GIF replacement must survive navigation and saved routine state');
    console.log('PASS: phases, voice state, checklist persistence and retained GIF replacement');
    // The personal introduction must lead; the complete technical archive is opt-in.
    assert.equal(await evaluate(`!!document.querySelector('h1')`), true, 'A personal introduction should anchor the page');
    assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('[id]')).map(el => el.id).filter((id, i, ids) => ids.indexOf(id) !== i)`), [], 'IDs must stay unique');
    assert.equal(await evaluate(`!!document.querySelector('details#sm-vocal-archive:not([open])')`), true, 'Routine should be collapsed initially');
    assert.equal(await evaluate(`document.querySelector('#sm-profile').getBoundingClientRect().top < document.querySelector('#sm-vocal-archive').getBoundingClientRect().top`), true);
    assert.equal(await evaluate(`['sm-col-left','sm-col-center','sm-col-right'].some(id => { const el = document.getElementById(id); return el && ['auto','scroll'].includes(getComputedStyle(el).overflowY); })`), false, 'No three independently scrolling columns');
    await evaluate(`document.querySelector('#sm-vocal-archive summary').focus()`);
    await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await cdp('Input.dispatchKeyEvent', { type: 'char', text: '\r' });
    await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    assert.equal(await evaluate(`document.querySelector('#sm-vocal-archive').open`), true, 'Archive opens with keyboard');
    await evaluate(`document.querySelector('[data-phase="5"]').click(); document.querySelector('[data-freq="440.00"]').click()`);
    assert.equal(await evaluate(`document.querySelector('.sm-phase-pane.active').id`), 'phase-5');
    assert.equal(await evaluate(`document.querySelector('#sm-tuner-freq').textContent`), '440.0 Hz (A4)');
    assert.equal(await evaluate(`document.querySelector('#sm-tuner-wave').classList.contains('sounding')`), true);
    await evaluate(`document.querySelector('#sm-vocal-archive').open = false`);
    await pause(100);
    assert.equal(await evaluate(`document.querySelector('#sm-tuner-wave').classList.contains('sounding')`), false, 'Collapsing the archive must stop hidden audio');
    await evaluate(`document.querySelector('#sm-vocal-archive').open = true; document.querySelector('[data-freq="440.00"]').click()`);
    await evaluate(`document.querySelector('#sm-tuner-stop').click()`);
    assert.equal(await evaluate(`document.querySelector('#sm-tuner-wave').classList.contains('sounding')`), false);
    for (const phase of [1, 2, 3, 4, 5]) {
      await evaluate(`document.querySelector('[data-phase="${phase}"]').click(); document.querySelector('#phase-${phase} .sm-yt-player-toggle').click()`);
      assert.equal(await evaluate(`document.querySelectorAll('.sm-cyber-tv-embed iframe').length`), 1);
      assert.deepEqual(await evaluate(`(() => { const frame = document.querySelector('.sm-cyber-tv-embed iframe'); return [frame.referrerPolicy, new URL(frame.src).searchParams.has('autoplay'), !!frame.parentElement.querySelector('.sm-tv-help a[href^="https://www.youtube.com/watch?v="]')]; })()`), ['strict-origin-when-cross-origin', false, true], 'Keep web embeds identified, user-started and backed by a direct-video link');
      await assertPracticeCollage(1440);
      await evaluate(`document.querySelector('#phase-${phase} .sm-cyber-tv-close').click()`);
      assert.equal(await evaluate(`document.querySelectorAll('.sm-cyber-tv-embed iframe').length`), 0);
    }
    await evaluate(`document.querySelector('#phase-5 .sm-yt-player-toggle').click(); document.querySelector('#sm-vocal-archive').open = false`);
    await pause(100);
    assert.equal(await evaluate(`document.querySelectorAll('.sm-cyber-tv-embed iframe').length`), 0, 'Collapsing the archive must unload hidden videos');
    await evaluate(`document.querySelector('#sm-vocal-archive').open = false; document.querySelector('#sm-main-content').scrollTop = 0`);
    for (const width of [1024, 1280, 1440, 1764, 1920]) {
      await cdp('Emulation.setDeviceMetricsOverride', { width, height: width === 1764 ? 1021 : 900, deviceScaleFactor: 1, mobile: false });
      await assertSocialDockGeometry(width, width === 1764 ? 1021 : 900);
      await assertProfileCard(width, width === 1764 ? 1021 : 900);
      await assertBioVideoGeometry(width);
      await assertGuestbookGifGeometry(width);
      await assertPersonalExtrasGeometry(width);
      await assertSpookyDecorationLayout(width);
      await assertPixelPetLayout(width);
      const geometry = await evaluate(`(() => {
        const r = selector => { const box = document.querySelector(selector).getBoundingClientRect(); return { x: box.x, y: box.y, right: box.right, bottom: box.bottom, width: box.width }; };
        return { frame: r('#sm-layout'), sidebar: r('#sm-sidebar'), main: r('.sm-portal-main'), banner: r('#sm-banner'), poster: r('.sm-cover-poster'), interests: r('#sm-interests'), links: r('#sm-links'), blog: r('.sm-blog-column'), favorites: r('#sm-treasures'), about: r('.sm-profile-row'), interestCells: [...document.querySelectorAll('.sm-interests-grid > section')].map(el => ({ x: Math.round(el.getBoundingClientRect().x), y: Math.round(el.getBoundingClientRect().y) })), tiles: [...document.querySelectorAll('.sm-favorite')].map(el => ({ x: Math.round(el.getBoundingClientRect().x), y: Math.round(el.getBoundingClientRect().y) })) };
      })()`);
      const near = (a, b) => Math.abs(a - b) < 2;
      assert.equal(await evaluate(`document.querySelector('#now-playing-bar').getBoundingClientRect().height`), 96);
      assert.equal(await evaluate(`document.querySelector('#main-wrapper').getBoundingClientRect().bottom <= document.querySelector('#now-playing-bar').getBoundingClientRect().top + 1`), true, 'Reserve content space above the taller player');
      assert.deepEqual(await evaluate(`(() => { const bar = document.querySelector('#now-playing-bar').getBoundingClientRect(); return [...document.querySelectorAll('#now-playing-bar button, #now-playing-bar input, .sm-winamp-cover')].filter(el => { const r = el.getBoundingClientRect(); return r.left < bar.left || r.right > bar.right || r.top < bar.top || r.bottom > bar.bottom; }).map(el => el.id || el.className); })()`), [], `Player controls and cover must fit at ${width}px`);
      assert.ok(geometry.sidebar.width / geometry.frame.width >= .24 && geometry.sidebar.width / geometry.frame.width <= .26, `Reference sidebar must occupy about 25% at ${width}px`);
      assert.ok(near(geometry.main.x, geometry.sidebar.right), 'Main area must begin beside the sidebar');
      assert.ok(geometry.banner.width / (geometry.poster.right - geometry.banner.x) > .8 && geometry.banner.width / (geometry.poster.right - geometry.banner.x) < .87, 'Upper rows must retain the reference 84/16 split');
      assert.ok(near(geometry.banner.x, geometry.interests.x) && near(geometry.poster.x, geometry.links.x), 'Banner/poster columns must align with interests/links');
      assert.equal(new Set(geometry.interestCells.map(r => r.x)).size, 2);
      assert.equal(new Set(geometry.interestCells.map(r => r.y)).size, 3);
      assert.equal(geometry.tiles.length, 8);
      assert.equal(new Set(geometry.tiles.map(r => r.x)).size, 4);
      assert.equal(new Set(geometry.tiles.map(r => r.y)).size, 2);
      assert.ok(near(geometry.blog.y, geometry.favorites.y), 'Blog list and thumbnail grid must share a top edge');
      assert.ok(geometry.blog.width / (geometry.favorites.right - geometry.blog.x) >= .15 && geometry.blog.width / (geometry.favorites.right - geometry.blog.x) <= .22, 'Middle row must retain the reference 18/82 split');
      assert.ok(near(geometry.about.x, geometry.banner.x) && near(geometry.about.right, geometry.poster.right) && geometry.about.y >= Math.max(geometry.blog.bottom, geometry.favorites.bottom), 'The About text/video row must span the main width below the middle row');
      assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('#main-wrapper .panel')).filter(el => el.getClientRects().length && el.scrollWidth > el.clientWidth + 2).map(el => el.id)`), [], `Panels must not clip horizontally at ${width}px`);
      await screenshot(`sobre-mi-${width}`);
      if (width === 1440) {
        await evaluate(`document.querySelector('#sm-notebook').scrollIntoView()`);
        await pause(500);
        await screenshot('sobre-mi-journal');
        await evaluate(`document.querySelector('#sm-main-content').scrollTop = 0`);
        await pause(400);
      }
      await evaluate(`document.querySelector('#sm-vocal-archive').open = true`);
      await assertPracticeCollage(width);
      assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('#main-wrapper .panel')).filter(el => el.scrollWidth > el.clientWidth + 2).map(el => el.id)`), [], `Expanded archive must not clip at ${width}px`);
      if (width === 1440) {
        await evaluate(`document.querySelector('#sm-vocal-archive').scrollIntoView()`);
        await pause(400);
        await screenshot('sobre-mi-archive');
        await evaluate(`document.querySelector('#sm-vocal-archive').open = false; document.querySelector('#sm-main-content').scrollTop = document.querySelector('#sm-main-content').scrollHeight`);
        await pause(400);
        await screenshot('sobre-mi-bottom');
      }
      await evaluate(`document.querySelector('#sm-vocal-archive').open = false; document.querySelector('#sm-main-content').scrollTop = 0`);
      await pause(400);
    }
    await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await navigate('sobre-mi');
    assert.equal(await evaluate(`window.__introSample.panel`), 0, 'The background wait must remain intact');
    assert.ok(await evaluate(`window.__introSample.card > 0.1`), 'The background/card should fade in first');
    assert.equal(await evaluate(`window.__introRevealSample`), '1', 'Reduced motion must not bypass or extend the shared wait');
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('#sm-profile-bio')).transitionDuration`), '0.5s');
    await assertIntroFade('About must retain the requested JAPAN/CANTO opacity fade');
    for (const page of ['index', 'japan', 'canto', 'music']) {
      await navigate(page);
      assert.equal(await evaluate(`window.__introSample.panel`), 0, `${page} must retain its original delayed entrance`);
      assert.equal(await evaluate(`window.__introRevealSample`), '1', `${page} must retain its original 700ms wait`);
      assert.equal(await evaluate(`document.querySelector('.panel').style.transition`), 'opacity 0.5s');
    }
    assert.deepEqual(errors, [], 'No uncaught browser errors');
    console.log('PASS: shared 700ms wait and real intermediate-opacity fade, greeting/link, HOME/JAPAN/CANTO/MUSIC entrance');
    console.log('PASS: reference 25/75, 84/16 and 18/82 geometry; 2x3 interests, 4x2 favorites; 1024–1920px layout');
    await navigate('sobre-mi');
    for (const height of [640, 520, 480]) {
      await cdp('Emulation.setDeviceMetricsOverride', { width:1024, height, deviceScaleFactor:1, mobile:false });
      await assertSocialDockGeometry(1024, height);
      await screenshot('sobre-mi-social-height-' + height);
    }
    await cdp('Emulation.setDeviceMetricsOverride', { width:1440, height:900, deviceScaleFactor:1, mobile:false });
    await navigate('japan');
    assert.equal(await evaluate(`document.querySelectorAll('#dock-social .dock-link img').length`), 0, 'Do not replace another section’s social dock');
    console.log('PASS: six animated social links, safe keyboard activation, original gutter and short-window fit');
    await cdp('Page.navigate', { url: pathToFileURL(path.join(root, 'sobre-mi.html')).href });
    await waitFor(`location.protocol === 'file:' && document.readyState === 'complete' && !!document.querySelector('#phase-1 .sm-yt-player-toggle')`, 'The local-file route must remain usable');
    await pause(1900);
    await keyboardActivate('#sm-vocal-archive > summary');
    await keyboardActivate('#phase-1 .sm-yt-player-toggle');
    assert.deepEqual(await evaluate(`(() => { const box = document.querySelector('#tv-embed-1'); const help = box.querySelector('.sm-tv-help'); const link = help?.querySelector('a'); return [box.querySelectorAll('iframe').length, help?.textContent.includes('servidor local'), link?.href, link?.target, link?.rel, document.querySelector('#phase-1 .sm-yt-player-toggle').getAttribute('aria-expanded'), parseFloat(getComputedStyle(help).lineHeight) > 0]; })()`), [0, true, 'https://www.youtube.com/watch?v=T-XpMyNkfPU', '_blank', 'noopener', 'true', true], 'A real file:// page must show useful visible help, not another error153 iframe');
    await evaluate(`document.querySelector('#tv-embed-1').scrollIntoView({ block: 'center', behavior: 'instant' })`);
    await screenshot('sobre-mi-mini-tv-local');
    await keyboardActivate('#tv-embed-1 .sm-cyber-tv-close');
    assert.equal(await evaluate(`document.querySelector('#tv-embed-1 .sm-cyber-tv-frame-wrap').children.length`), 0);
    console.log('PASS: actual file:// Mini TV fallback, keyboard activation and close');
  } finally {
    console.log(`Screenshots: ${output}`);
    if (ws) ws.close();
    browser.kill();
    server.closeAllConnections();
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
