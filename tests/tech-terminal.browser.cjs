// Real local Chromium, no packages or external requests. Run with Node 22+.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { startBrowser, pause } = require('./site-audio-browser-utils.cjs');

(async () => {
  const browser = await startBrowser({ prefix: 'y2k-tech-terminal-', width: 1920, height: 1080 });
  const { cdp, page, wait, navigate, root, origin, output } = browser;
  const prompt = 'PS C:\\Users\\muted>';
  const text = () => page("document.querySelector('#terminal-cli-output').textContent");
  const input = '#terminal-cli-input';
  const shortcuts = ['help', 'ascii', 'shurelia', 'talk', 'matrix', 'theme amber', 'clear'];
  const key = async (key, code, keyCode) => {
    await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: keyCode });
    await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode });
  };
  async function command(value) {
    await page(`document.querySelector('${input}').focus()`);
    await cdp('Input.insertText', { text: value });
    await key('Enter', 'Enter', 13);
    assert.equal(await page(`document.querySelector('${input}').value`), '');
  }
  async function screenshot(name) {
    const clip = await page(`(() => {
      const r = document.querySelector('#panel-tech-terminal').getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, scale: 1 };
    })()`);
    const result = await cdp('Page.captureScreenshot', { format: 'png', clip });
    const file = path.join(output, name);
    fs.writeFileSync(file, Buffer.from(result.data, 'base64'));
    console.log('SCREENSHOT ' + file);
  }
  try {
    for (const url of [origin + '/tech.html', pathToFileURL(path.join(root, 'tech.html')).href]) {
      await navigate(url);
      await wait("!!document.querySelector('#panel-tech-terminal')");
      await page("document.querySelector('#panel-tech-terminal').scrollIntoView({block:'start'})");
      await pause(1200);
      if (url.startsWith('http:')) await screenshot('terminal-initial.png');
      assert.equal(await text(), '', 'PowerShell starts with a clean prompt');
      assert.deepEqual(await page("[...document.querySelectorAll('.terminal-prompt')].map(n=>n.textContent)"), [prompt, prompt]);
      assert.equal(await page("document.querySelector('.terminal-header').textContent"), 'Windows PowerShell 1.0');
      assert.deepEqual(await page("[...document.querySelectorAll('.term-btn')].map(b=>b.dataset.cmd)"), shortcuts);
      assert.equal(await page("document.querySelector('.navi-portrait img').naturalWidth"), 181);
      assert.equal(await page("getComputedStyle(document.querySelector('.navi-portrait img')).imageRendering"), 'pixelated');
      const snapshot = await page("document.querySelector('.terminal-navi').textContent");
      assert.match(snapshot, /Core 2 Duo E6600 @ 2\.40GHz/);
      assert.match(snapshot, /NVIDIA GeForce 8800 GTX/);
      assert.match(snapshot, /768 MiB GDDR3/);
      assert.match(snapshot, /2\.16 GiB \/ 4\.00 GiB/);
      assert.match(snapshot, /Windows Vista Ultimate x64/);
      assert.match(snapshot, /1680x1050 @ 60Hz/);
      assert.doesNotMatch(snapshot, /RTX|UHD|Windows 11|144Hz/);
      const hardware = await page("[...document.querySelectorAll('.aero-spec-val')].map(n=>n.textContent).join(' | ')");
      assert.match(hardware, /Core 2 Duo E6600/);
      assert.match(hardware, /8800 GTX 768MB/);
      assert.match(hardware, /4\.00 GB DDR2 800MHz/);
      assert.match(hardware, /250 GB SATA/);
      assert.doesNotMatch(hardware, /E8400|RTX|UHD/);
      assert.ok(!snapshot.includes('Gustavo'));
      for (const value of ['', '   ']) { await command(value); assert.equal(await text(), ''); }
      await command('  SpEcS  ');
      assert.ok((await text()).startsWith(prompt + '   SpEcS'));
      assert.match(await text(), /Core 2 Duo E6600/);
      assert.match(await text(), /8800 GTX/);
      assert.match(await text(), /250 GB SATA/);
      assert.doesNotMatch(await text(), /RTX|UHD|Windows 11|144Hz/);
      await command('help');
      assert.match(await text(), /ascii/);
      assert.match(await text(), /shurelia/);
      await command('neofetch');
      assert.match(await text(), /muted@navi/);
      await command('<img src=x onerror=alert(1)>');
      assert.match(await text(), /no reconocido/);
      assert.equal(await page("document.querySelector('#terminal-cli-output').childElementCount"), 0, 'Command input is text, never HTML');
      assert.ok(await page(`(() => { const s=document.querySelector('#terminal-cli-session'); return s.scrollTop>0 && s.scrollHeight-s.clientHeight-s.scrollTop<2; })()`), 'Long output scrolls to the latest prompt');
      assert.equal(await page("document.querySelector('.terminal-navi').textContent"), snapshot, 'Commands never replace NAVI');
      await command('cls');
      assert.equal(await text(), '');
      for (const cmd of shortcuts) {
        await browser.click(`[data-cmd="${cmd}"]`);
        assert.equal(await page(`document.activeElement.id`), 'terminal-cli-input');
        if (cmd === 'clear') assert.equal(await text(), '');
        else assert.ok((await text()).includes(prompt + ' ' + cmd));
      }
      assert.equal(await page("document.querySelector('#terminal-cli-session').scrollTop"), 0);
      await page(`document.querySelector('${input}').focus()`);
      assert.equal(await page(`getComputedStyle(document.querySelector('${input}')).outlineStyle`), 'none', 'Only the caret, not a focus rectangle');
      assert.equal(await page(`getComputedStyle(document.querySelector('${input}')).boxShadow`), 'none');
      assert.notEqual(await page(`getComputedStyle(document.querySelector('${input}')).caretColor`), 'transparent');
      await command('bye');
      await command('theme cyan');
      await command('clear');
      // An empty terminal and its exact split-pane layout must also work at the smallest desktop canvas.
      for (const width of [1920, 1440, 1024]) {
        await cdp('Emulation.setDeviceMetricsOverride', { width, height: 1080, deviceScaleFactor: 1, mobile: false });
        await pause(100);
        await page("document.querySelector('#panel-tech-terminal').scrollIntoView({block:'start'})");
        const layout = await page(`(() => {
          const terminal=document.querySelector('.tech-terminal'), main=document.querySelector('.terminal-main'), navi=document.querySelector('.terminal-navi');
          const m=main.getBoundingClientRect(), n=navi.getBoundingClientRect();
          return { overflow:terminal.scrollWidth>terminal.clientWidth+1, pageOverflow:document.documentElement.scrollWidth>innerWidth+1,
            split:m.right<=n.left+1, mainWidth:m.width,
            clipped:[...terminal.querySelectorAll('dd,.terminal-shortcuts')].some(el=>el.scrollWidth>el.clientWidth+1) };
        })()`);
        assert.equal(layout.overflow, false, `${width}px terminal has no horizontal overflow`);
        assert.equal(layout.pageOverflow, false, `${width}px page retains its original canvas`);
        assert.equal(layout.clipped, false, `${width}px readings and shortcuts stay readable`);
        assert.equal(layout.split, true);
        assert.ok(layout.mainWidth > 150, 'The command pane remains usable');
        assert.ok(await page(`(() => { const n=document.querySelector('.terminal-navi');return n.scrollHeight<=n.clientHeight+1; })()`), 'All reference readings remain visible without a nested scrollbar');
        await key('Tab', 'Tab', 9);
        if (url.startsWith('http:')) await screenshot(`terminal-${width}.png`);
      }
      await browser.click('#panel-tech-terminal .panel-btn');
      assert.equal(await page("getComputedStyle(document.querySelector('#panel-tech-terminal .panel-body')).display"), 'none');
      await browser.click('#panel-tech-terminal .panel-btn');
      assert.notEqual(await page("getComputedStyle(document.querySelector('#panel-tech-terminal .panel-body')).display"), 'none');
      await browser.click('#panel-tech-terminal .panel-btn:last-child');
      assert.equal(await page("getComputedStyle(document.querySelector('#panel-tech-terminal')).display"), 'none');
      console.log('PASS ' + new URL(url).protocol + ' replica, retro hardware, keyboard, all commands, safe output, scrolling, clear, panel controls and desktop sizes');
    }
    assert.deepEqual(browser.errors, [], 'No uncaught browser errors');
    console.log('PASS Tech terminal browser checks');
  } finally { browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
