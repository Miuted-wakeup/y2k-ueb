// Local browser regression checks. Node 22+ and Chrome/Edge; no npm packages.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'y2k-about-'));
const chrome = process.env.CHROME_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(fs.existsSync);
assert.ok(chrome, 'Set CHROME_PATH to a Chrome/Edge executable');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404).end('Not found'); return; }
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
        setTimeout(() => {
        const opacity = element => {
          let value = 1;
          for (; element; element = element.parentElement) value *= Number(getComputedStyle(element).opacity);
          return value;
        };
        const card = document.querySelector('.sm-welcome-card');
        const panel = document.querySelector('#sm-notebook') || document.querySelector('.panel');
        window.__introSample = { card: card ? opacity(card) : 0, panel: panel ? opacity(panel) : 0 };
        }, 300);
        setTimeout(() => {
          const panel = document.querySelector('#sm-notebook') || document.querySelector('.panel');
          window.__introRevealSample = panel?.style.opacity;
        }, 800);
        setTimeout(() => {
          const selectors = ['#sm-notebook, .panel', '.sm-content-surface', '#site-header'];
          window.__introFadeSample = selectors.map(selector => {
            const element = document.querySelector(selector);
            return element ? Number(getComputedStyle(element).opacity) : null;
          });
        }, 850);
      });
    ` });
    await cdp('Network.enable');
    await cdp('Network.setBlockedURLs', { urls: ['*youtube*'] });
    await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await navigate('sobre-mi', true);
    await screenshot('sobre-mi-desktop');
    assert.equal(await evaluate(`(() => { const rgb = getComputedStyle(document.querySelector('#sm-interests .panel-title')).color.match(/\\d+/g).slice(0, 3).map(Number); return Math.max(...rgb) - Math.min(...rgb) <= 20; })()`), true, 'About chrome must use asphalt/silver neutrals instead of the old pink/lavender palette');
    const paletteSamples = await evaluate(`(() => {
      const cases = [
        ['window title', '#sm-interests .panel-title', '#sm-interests .panel-titlebar'],
        ['profile text', '#sm-profile-bio .sm-about-chunk p', '#sm-profile-bio'],
        ['navigation link', '.sm-contact-grid a', '#sm-contact'],
        ['favorite label', '.sm-favorite', '#sm-treasures'],
        ['profile serial', '.sm-card-serial', '.sm-welcome-card'],
        ['site button', '.sm-web-button', '.sm-web-button'],
        ['site button caption', '.sm-web-button span', '.sm-web-button'],
        ['second button caption', '.sm-web-button-pink span', '.sm-web-button-pink'],
        ['archive title', '.sm-archive-label', '#sm-vocal-archive > summary'],
        ['archive description', '.sm-archive-label small', '#sm-vocal-archive > summary'],
        ['active voice state', '.sm-state-pill-btn.active', '.sm-state-pill-btn.active'],
        ['active routine tab', '.sm-routine-tab-btn.active', '.sm-routine-tab-btn.active'],
        ['stamp button', '.sm-stamp-btn', '.sm-stamp-btn'],
        ['social dock', '.dock-link', '.dock-link']
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
    console.log('PASS: urban neutral chrome and 14 sampled light/dark text contrasts');
    assert.equal(await evaluate(`document.querySelector('#sm-sidebar-character') instanceof HTMLAnchorElement`), true, 'The empty sidebar area must have a real linked character image');
    assert.equal(await evaluate(`document.querySelector('#sm-sidebar-character img').getAttribute('src')`), 'assets/images/sobre-mi/sidebar-character.png', 'Keep the large character in an independent About-owned file');
    assert.equal(await evaluate(`document.querySelector('#sm-sidebar-character').getAttribute('href')`), 'music.html', 'Provide a working default destination ready to customize');
    assert.equal(await evaluate(`document.querySelector('#sm-sidebar-character').closest('.panel')`), null, 'The large character belongs outside framed panels');
    await evaluate(`document.querySelector('#sm-sidebar-character').scrollIntoView({ block: 'center', behavior: 'instant' })`);
    await evaluate(`document.querySelector('#sm-sidebar-character img').decode()`);
    const characterPoint = await evaluate(`(() => { const r = document.querySelector('#sm-sidebar-character img').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
    await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', ...characterPoint });
    await pause(350);
    assert.equal(await evaluate(`(() => { const image = document.querySelector('#sm-sidebar-character img'); const matrix = new DOMMatrix(getComputedStyle(image).transform); return matrix.b < -.05 && matrix.b > -.09; })()`), true, 'Hover must smoothly tilt the image by about four degrees');
    await screenshot('sobre-mi-character-hover');
    await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 0, y: 0 });
    await pause(350);
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('#sm-sidebar-character img')).transform`), 'none', 'The character must return upright when the pointer leaves');
    await keyboardActivate('#sm-sidebar-character');
    await waitFor(`location.pathname === '/music.html' && document.readyState === 'complete'`, 'The character link must navigate through native keyboard activation');
    await navigate('sobre-mi');
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
    await evaluate(`document.querySelector('#sm-notebook .panel-btn').click(); document.querySelector('#main-wrapper').scrollTop = 0`);
    assert.notEqual(await evaluate(`getComputedStyle(document.querySelector('#sm-notebook .panel-body')).display`), 'none');
    console.log('PASS: preserved notes, collection folds, local links/assets and window controls');
    const introSample = await evaluate(`window.__introSample`);
    assert.ok(introSample.card > 0.1 && introSample.panel === 0, `Card must precede windows: ${JSON.stringify(introSample)}`);
    assert.equal(await evaluate(`window.__introRevealSample`), '1', 'About must start revealing after the same 700ms wait as JAPAN/CANTO');
    const fadeSample = await evaluate(`window.__introFadeSample`);
    assert.ok(fadeSample.filter(value => value !== null).every(value => value > 0 && value < 1), `Windows, background surface and header must be mid-fade, not appear abruptly: ${JSON.stringify(fadeSample)}`);
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
    assert.equal(await evaluate(`document.querySelectorAll('.sm-phase-pane').length`), 5);
    await evaluate(`document.querySelector('[data-phase="3"]').click()`);
    assert.equal(await evaluate(`document.querySelector('.sm-phase-pane.active').id`), 'phase-3');
    await evaluate(`document.querySelector('[data-state="⚡ Twang Activo"]').click()`);
    assert.equal(await evaluate(`document.querySelector('#sm-active-state-txt').textContent`), '⚡ Twang Activo');
    await evaluate(`document.querySelector('.sm-routine-check').click()`);
    assert.equal(await evaluate(`document.querySelector('#sm-tracker-pct-text').textContent`), '20%');
    const stamps = await evaluate(`document.querySelectorAll('#stamp-display-wall span').length`);
    await evaluate(`document.querySelector('.sm-stamp-btn').click()`);
    assert.equal(await evaluate(`document.querySelectorAll('#stamp-display-wall span').length`), stamps + 1);
    await navigate('sobre-mi');
    assert.equal(await evaluate(`document.querySelector('.sm-routine-check').checked`), true);
    assert.equal(await evaluate(`document.querySelectorAll('#stamp-display-wall span').length`), stamps + 1);
    console.log('PASS: phases, voice state, checklist, stamps and persistence');
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
      await evaluate(`document.querySelector('#phase-${phase} .sm-cyber-tv-close').click()`);
      assert.equal(await evaluate(`document.querySelectorAll('.sm-cyber-tv-embed iframe').length`), 0);
    }
    await evaluate(`document.querySelector('#phase-5 .sm-yt-player-toggle').click(); document.querySelector('#sm-vocal-archive').open = false`);
    await pause(100);
    assert.equal(await evaluate(`document.querySelectorAll('.sm-cyber-tv-embed iframe').length`), 0, 'Collapsing the archive must unload hidden videos');
    await evaluate(`document.querySelector('#sm-vocal-archive').open = false; document.querySelector('#main-wrapper').scrollTop = 0`);
    for (const width of [1024, 1280, 1440, 1764, 1920]) {
      await cdp('Emulation.setDeviceMetricsOverride', { width, height: width === 1764 ? 1021 : 900, deviceScaleFactor: 1, mobile: false });
      const geometry = await evaluate(`(() => {
        const r = selector => { const box = document.querySelector(selector).getBoundingClientRect(); return { x: box.x, y: box.y, right: box.right, bottom: box.bottom, width: box.width }; };
        return { frame: r('#sm-layout'), sidebar: r('#sm-sidebar'), main: r('.sm-portal-main'), banner: r('#sm-banner'), poster: r('.sm-cover-poster'), interests: r('#sm-interests'), links: r('#sm-links'), blog: r('.sm-blog-column'), favorites: r('#sm-treasures'), about: r('#sm-profile-bio'), interestCells: [...document.querySelectorAll('.sm-interests-grid > section')].map(el => ({ x: Math.round(el.getBoundingClientRect().x), y: Math.round(el.getBoundingClientRect().y) })), tiles: [...document.querySelectorAll('.sm-favorite')].map(el => ({ x: Math.round(el.getBoundingClientRect().x), y: Math.round(el.getBoundingClientRect().y) })) };
      })()`);
      const near = (a, b) => Math.abs(a - b) < 2;
      assert.equal(await evaluate(`document.querySelector('#now-playing-bar').getBoundingClientRect().height`), 96);
      assert.equal(await evaluate(`(() => { const image = document.querySelector('#sm-sidebar-character img').getBoundingClientRect(); const sidebar = document.querySelector('#sm-sidebar').getBoundingClientRect(); return image.left >= sidebar.left && image.right <= sidebar.right && image.width > sidebar.width * .65 && image.height > 0; })()`), true, `The character must stay large and inside the sidebar at ${width}px`);
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
      assert.ok(near(geometry.about.x, geometry.banner.x) && near(geometry.about.right, geometry.poster.right) && geometry.about.y >= Math.max(geometry.blog.bottom, geometry.favorites.bottom), 'About text must span the main width below the middle row');
      assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('#main-wrapper .panel')).filter(el => el.getClientRects().length && el.scrollWidth > el.clientWidth + 2).map(el => el.id)`), [], `Panels must not clip horizontally at ${width}px`);
      await screenshot(`sobre-mi-${width}`);
      if (width === 1440) {
        await evaluate(`document.querySelector('#sm-notebook').scrollIntoView()`);
        await pause(500);
        await screenshot('sobre-mi-journal');
        await evaluate(`document.querySelector('#main-wrapper').scrollTop = 0`);
        await pause(400);
      }
      await evaluate(`document.querySelector('#sm-vocal-archive').open = true`);
      assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('#main-wrapper .panel')).filter(el => el.scrollWidth > el.clientWidth + 2).map(el => el.id)`), [], `Expanded archive must not clip at ${width}px`);
      if (width === 1440) {
        await evaluate(`document.querySelector('#sm-vocal-archive').scrollIntoView()`);
        await pause(400);
        await screenshot('sobre-mi-archive');
        await evaluate(`document.querySelector('#sm-vocal-archive').open = false; document.querySelector('#main-wrapper').scrollTop = document.querySelector('#main-wrapper').scrollHeight`);
        await pause(400);
        await screenshot('sobre-mi-bottom');
      }
      await evaluate(`document.querySelector('#sm-vocal-archive').open = false; document.querySelector('#main-wrapper').scrollTop = 0`);
      await pause(400);
    }
    await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await navigate('sobre-mi');
    assert.equal(await evaluate(`window.__introSample.panel`), 0, 'The background wait must remain intact');
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('#sm-sidebar-character img')).transitionDuration`), '0s', 'Reduced motion disables the decorative tilt transition, not the shared entrance');
    assert.ok(await evaluate(`window.__introSample.card > 0.1`), 'The background/card should fade in first');
    assert.equal(await evaluate(`window.__introRevealSample`), '1', 'Reduced motion must not bypass or extend the shared wait');
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('#sm-profile-bio')).transitionDuration`), '0.5s');
    const reducedFadeSample = await evaluate(`window.__introFadeSample`);
    assert.ok(reducedFadeSample.filter(value => value !== null).every(value => value > 0 && value < 1), `About must retain the requested JAPAN/CANTO opacity fade: ${JSON.stringify(reducedFadeSample)}`);
    for (const page of ['index', 'japan', 'canto', 'music']) {
      await navigate(page);
      assert.equal(await evaluate(`window.__introSample.panel`), 0, `${page} must retain its original delayed entrance`);
      assert.equal(await evaluate(`window.__introRevealSample`), '1', `${page} must retain its original 700ms wait`);
      assert.equal(await evaluate(`document.querySelector('.panel').style.transition`), 'opacity 0.5s');
    }
    assert.deepEqual(errors, [], 'No uncaught browser errors');
    console.log('PASS: shared 700ms wait and real intermediate-opacity fade, greeting/link, HOME/JAPAN/CANTO/MUSIC entrance');
    console.log('PASS: reference 25/75, 84/16 and 18/82 geometry; 2x3 interests, 4x2 favorites; 1024–1920px layout');
  } finally {
    console.log(`Screenshots: ${output}`);
    if (ws) ws.close();
    browser.kill();
    server.closeAllConnections();
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
