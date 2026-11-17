// Native keyboard/DOM/audio integration plus deterministic firing of actual expiry callbacks.
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const { startBrowser, AUDIO_PROBE, pause } = require('./site-audio-browser-utils.cjs');
const timers = `(() => {
  const set=window.setTimeout.bind(window),clear=window.clearTimeout.bind(window);
  window.__longTimers=[];
  // Expiry callbacks are fired explicitly below. Hold their wall-clock fallback so slow file:// CDP checks cannot accidentally outlive a visit.
  window.setTimeout=(fn,delay,...args)=>{const tracked=delay>=20000&&delay<=180000;const id=set(fn,tracked?600000:delay,...args);if(tracked)__longTimers.push({id,fn,delay,args,cleared:false});return id;};
  window.clearTimeout=id=>{__longTimers.filter(t=>t.id===id).forEach(t=>t.cleared=true);return clear(id);};
})();`;

(async () => {
  // Full command/history stress runs over HTTP. File keyboard coverage lives in
  // tech-terminal.browser.cjs; the embedded-library HTTP/file seam has its own focused suite.
  // --file-only retains the extended file stress probe for explicit diagnostics.
  for (const protocol of process.argv.includes('--file-only') ? ['file'] : ['http']) {
  const s = await startBrowser({ prefix: 'y2k-tech-programs-', instrument: AUDIO_PROBE + timers });
  const limit = protocol === 'file' ? 300000 : 90000;
  const deadline = setTimeout(() => {
    console.error('FAIL ' + protocol + ': native command checks exceeded ' + limit / 1000 + ' seconds');
    process.exitCode = 1;
    s.close();
  }, limit);
  const actor = "TechTerminal.mount(document.querySelector('.tech-terminal'))";
  const out = () => s.page("document.querySelector('#terminal-cli-output').textContent");
  const key = async (key, code, keyCode) => {
    await s.cdp('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: keyCode });
    await s.cdp('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode });
  };
  const command = async text => {
    // The legacy suite covers native file:// typing. Exercise the same public command
    // runtime directly here to avoid hundreds of slow cross-process file input events.
    if (protocol === 'file') {
      await s.page(`document.querySelector('#terminal-cli-input').focus();${actor}.run(${JSON.stringify(text)})`);
      return;
    }
    await s.page("document.querySelector('#terminal-cli-input').focus()");
    await s.cdp('Input.insertText', { text });
    await key('Enter', 'Enter', 13);
  };
  const expire = delay => s.page(`(() => {
    const t=__longTimers.filter(t=>t.delay===${delay}&&!t.cleared).at(-1);
    if(!t)throw Error('No active timer for '+${delay});
    clearTimeout(t.id);t.fn(...t.args);
  })()`);
  try {
      const url = protocol === 'http' ? s.origin + '/tech.html' : pathToFileURL(path.join(s.root, 'tech.html')).href;
      await s.navigate(url, protocol === 'http' ? 'sound' : 'silent');
      await s.page("document.querySelector('#panel-tech-terminal').scrollIntoView({block:'start'})");
      await s.wait("!!window.TechTerminalGuest && !!window.TechTerminal");
      assert.equal(await s.page(actor + '.snapshot().guest.active'), false);
      assert.equal(await s.page("!!document.querySelector('#home-entry')"), false, 'Borrowing Home never opens its entry modal');
      assert.equal(await s.page("document.body.classList.contains('has-home-companion')"), false);
      await command('help');
      for (const name of ['ascii', 'shurelia', 'talk', 'bye', 'matrix', 'theme', 'ping', 'date', 'whoami', 'history']) assert.ok((await out()).includes(name));
      assert.doesNotMatch(await out(), /de prueba|simulad/i);
      await command('help __proto__');
      assert.match(await out(), /No hay ayuda/);
      await command('ascii cat'); assert.match(await out(), /\( o\.o \)/);
      for (const type of ['pc', 'kirby', 'flower', '__proto__']) await command('ascii ' + type);
      await command('theme amber'); assert.equal(await s.page("document.querySelector('.tech-terminal').dataset.theme"), 'amber');
      const amber = await s.page("getComputedStyle(document.querySelector('.tech-terminal')).backgroundColor");
      await command('theme green'); assert.notEqual(await s.page("getComputedStyle(document.querySelector('.tech-terminal')).backgroundColor"), amber);
      await command('theme invalid'); assert.equal(await s.page("document.querySelector('.tech-terminal').dataset.theme"), 'green');
      await command('theme cyan');
      await command('matrix');
      assert.equal(await s.page("document.querySelectorAll('.terminal-matrix span').length"), 18);
      await command('matrix on');
      assert.equal(await s.page("document.querySelectorAll('.terminal-matrix').length"), 1);
      await expire(20000);
      assert.equal(await s.page(actor + '.snapshot().matrix'), false, 'Matrix has a real finite expiry');
      await command('matrix off');
      await command('ping');
      await s.wait("document.querySelector('#terminal-cli-output').textContent.includes('PONG // navegador:')");
      assert.match(await out(), /\d+\.\d{2} ms/);
      assert.doesNotMatch(await out(), /192\.0\.2|TTL=|time=7ms/);
      await command('date'); assert.match(await out(), /America\/Bogota/);
      await command('whoami'); assert.match(await out(), /Esta sesión lleva \d+m \d+s/);
      await key('ArrowUp', 'ArrowUp', 38);
      assert.equal(await s.page("document.querySelector('#terminal-cli-input').value"), 'whoami');
      await key('ArrowDown', 'ArrowDown', 40);
      assert.equal(await s.page("document.querySelector('#terminal-cli-input').value"), '');
      await command('history'); assert.match(await out(), /ascii cat/);
      await command('clear');
      await s.page(`window.__naviBefore={html:document.querySelector('.terminal-navi').innerHTML,
        terminalHeight:document.querySelector('.tech-terminal').clientHeight};`);
      await command('shurelia 2');
      assert.equal(await s.page(actor + '.snapshot().guest.active'), false, 'Invalid duration does not summon');
      await command('shurelia');
      await s.wait(actor + '.snapshot().guest.active');
      assert.ok(await s.page(`(() => {
        const pane=document.querySelector('.terminal-navi'),guest=document.querySelector('#tech-terminal-guest');
        return guest.parentElement===pane && [...pane.children].filter(n=>n!==guest).every(n=>n.hidden) &&
          getComputedStyle(guest).position!=='fixed';
      })()`), 'Guest replaces NAVI in place, never floats above the page');
      assert.equal(await s.page("getComputedStyle(document.querySelector('.tg-room')).imageRendering"), 'pixelated');
      assert.match(await s.page("getComputedStyle(document.querySelector('.tg-room')).backgroundImage"), /assets\/images\/tech\/companion\/shurelia-room-books\.png/);
      assert.match(await s.page("getComputedStyle(document.querySelector('.tg-counter')).backgroundImage"), /shurelia-room-counter\.png/);
      assert.equal(await s.page("document.activeElement.id"), 'terminal-cli-input', 'Arrival does not steal command focus');
      await command('shurelia');
      assert.equal(await s.page("__longTimers.filter(t=>t.delay===90000&&!t.cleared).length"), 1, 'Renewed visit has one expiry');
      await pause(650);
      let peak = 0;
      for (let index = 0; index < 20; index++) {
        if (protocol === 'http') peak = Math.max(peak, await s.host(`(() => { const p=__audioProbe.contexts[0];if(!p)return 0;const data=new Float32Array(p.analyser.fftSize);p.analyser.getFloatTimeDomainData(data);return Math.max(...data.map(Math.abs)); })()`));
        await pause(25);
      }
      if (protocol === 'http') assert.ok(peak > 0.01, 'Borrowed character uses actual parent-authorized speech ' + peak);
      else assert.equal(await s.host("SiteAudioShell.engine.snapshot().permission"), 'silent');
      await command('talk');
      assert.equal(await s.page(actor + '.snapshot().guest.active'), true);
      // Long-scrollback minimize is slow in Windows file:// CDP; keep it opt-in there.
      // Native file minimize/restore remains mandatory in tech-terminal-library.browser.cjs.
      if (protocol === 'http' || process.argv.includes('--stress-file')) {
      await s.click('#panel-tech-terminal .panel-btn');
      await s.wait(actor + '.snapshot().guest.visible===false', false, 'Minimized console pauses the embedded visitor');
      const hiddenProgress = await s.page(actor + '.snapshot().guest.revealed');
      await pause(150);
      assert.equal(await s.page(actor + '.snapshot().guest.revealed'), hiddenProgress, 'Hidden dialogue cannot keep typing');
      await s.click('#panel-tech-terminal .panel-btn');
      await s.wait(actor + '.snapshot().guest.visible===true', false, 'Restoring console restores visitor visibility');
      } else console.log('SKIP file long-scrollback minimize stress (use --stress-file); focused native minimize is tested separately');
      await expire(90000);
      assert.equal(await s.page(actor + '.snapshot().guest.active'), false, 'Expiry actually removes the guest');
      assert.equal(await s.page("document.querySelector('.terminal-navi').innerHTML"), await s.page('__naviBefore.html'), 'Expiry restores the exact original NAVI markup');
      await command('shurelia 30');
      await s.wait(actor + '.snapshot().guest.active');
      assert.equal(await s.page(actor + '.snapshot().guest.durationSeconds'), 30);
      // Geometry checks can be slow in file:// headless sessions; renew explicitly, never outlive a real30s visit.
      await command('shurelia 180');
      for (const [width, height] of [[1768, 1016], [1440, 900], [1024, 900]]) {
        await s.cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
        await pause(150);
        await s.page("document.querySelector('#panel-tech-terminal').scrollIntoView({block:'start'})");
        await command('shurelia 180');
        assert.ok(await s.page(`(() => {const input=document.querySelector('#terminal-cli-input'),p=document.querySelector('#np-play');return[input,p].every(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit===el||el.contains(hit);});})()`), 'Visitor cannot cover the input or player at ' + width);
        assert.ok(await s.page(`(() => {
          const pane=document.querySelector('.terminal-navi').getBoundingClientRect(),guest=document.querySelector('#tech-terminal-guest').getBoundingClientRect();
          const t=document.querySelector('.tech-terminal'),dialogue=document.querySelector('#tech-terminal-guest .hc-dialogue');
          return guest.left>=pane.left-1&&guest.right<=pane.right+1&&guest.top>=pane.top-1&&guest.bottom<=pane.bottom+1&&
            t.scrollWidth<=t.clientWidth+1&&dialogue.scrollWidth<=dialogue.clientWidth+1;
        })()`), 'Library, portrait and dialogue stay inside the existing NAVI pane at ' + width);
      }
      console.log('SCREENSHOT ' + await s.screenshot(protocol + '-shurelia-visit.png'));
      await command('bye');
      assert.equal(await s.page(actor + '.snapshot().guest.active'), false);
      assert.equal(await s.page("document.querySelector('.terminal-navi').innerHTML"), await s.page('__naviBefore.html'), 'bye restores Lain and every original statistic');
      // Long linked messages scroll inside the dialogue; they never enlarge the console.
      await s.page(`window.__savedMessages=HOME_COMPANION_MESSAGES;
        HOME_COMPANION_MESSAGES=[{mood:'curious',text:'Un libro, una canción y un recuerdo. '.repeat(18),link:__savedMessages.find(m=>m.link).link}];`);
      await command('shurelia');
      await command('talk');
      assert.ok(await s.page(`(() => {
        const d=document.querySelector('#tech-terminal-guest .hc-dialogue');return d.scrollHeight>d.clientHeight&&d.clientHeight>60;
      })()`), 'Long dialogue has its own usable scroll area');
      assert.equal(await s.page("document.querySelector('.tech-terminal').clientHeight"), await s.page('__naviBefore.terminalHeight'));
      await s.page("document.querySelector('#tech-terminal-guest .hc-dialogue').scrollTop=10000");
      assert.equal(await s.page("document.querySelector('#tech-terminal-guest .hc-message-link').inert"), false);
      await command('bye');
      await s.page('HOME_COMPANION_MESSAGES=__savedMessages');
      await command('talk'); assert.match(await out(), /Primero escribe shurelia/);
      await command('shurelia');
      await command('matrix');
      await key('Escape', 'Escape', 27);
      assert.equal(await s.page(actor + '.snapshot().guest.active'), false);
      assert.equal(await s.page(actor + '.snapshot().matrix'), false);
      await command('matrix');
      await command('clear'); assert.equal(await s.page(actor + '.snapshot().matrix'), false);
      // Keep a reference: a cached page gets a fresh controller, never the old expiring visit.
      await command('shurelia');
      await s.page(`window.__oldTerminal=${actor}; window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));`);
      assert.equal(await s.page('__oldTerminal.snapshot().destroyed'), true);
      assert.equal(await s.page('__oldTerminal.snapshot().guest.active'), false);
      await s.page("window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}))");
      assert.equal(await s.page(actor + '===__oldTerminal'), false);
      await command('ascii'); assert.match(await out(), /\( o\.o \)/);
      console.log('PASS ' + protocol + ' local commands, timed visit, keyboard, geometry, cleanup; speech peak=' + peak);
    assert.equal(s.requests.some(url => url.includes('192.0.2.')), false);
    assert.deepEqual(s.errors, [], 'No runtime exceptions');
  } catch (error) { console.log('FAILURE SCREENSHOT ' + await s.screenshot('failure.png')); throw error; }
  finally { clearTimeout(deadline); s.close(); }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
