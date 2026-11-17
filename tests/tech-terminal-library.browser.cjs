// Focused embedded-library regression, isolated from the full command catalogue's input/history stress.
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { startBrowser, pause } = require('./site-audio-browser-utils.cjs');

(async () => {
  for (const protocol of ['http', 'file']) {
    const s = await startBrowser({ prefix: 'y2k-library-focused-', width: 1440, height: 1000 });
    const deadline = setTimeout(() => { process.exitCode = 1; console.error('TIMEOUT library ' + protocol); s.close(); }, 60000);
    const actor = "TechTerminal.mount(document.querySelector('.tech-terminal'))";
    try {
      await s.navigate(protocol === 'http' ? s.origin + '/tech.html' : pathToFileURL(path.join(s.root, 'tech.html')).href, 'silent');
      await s.page(`document.querySelector('#panel-tech-terminal').scrollIntoView({block:'start'});
        window.__naviOriginal=document.querySelector('.terminal-navi').innerHTML;
        window.__consoleHeight=document.querySelector('.tech-terminal').clientHeight;
        ${actor}.run('shurelia');document.querySelector('#terminal-cli-input').focus();`);
      await pause(300);
      const scene = await s.page(`(() => {
        const pane=document.querySelector('.terminal-navi'),g=document.querySelector('#tech-terminal-guest');
        const p=pane.getBoundingClientRect(),r=g.getBoundingClientRect();
        return {embedded:g.parentElement===pane,hidden:[...pane.children].filter(n=>n!==g).every(n=>n.hidden),
          contained:r.left>=p.left-1&&r.right<=p.right+1&&r.top>=p.top-1&&r.bottom<=p.bottom+1,
          books:getComputedStyle(g.querySelector('.tg-room')).backgroundImage,
          counter:getComputedStyle(g.querySelector('.tg-counter')).backgroundImage,
          pixels:getComputedStyle(g.querySelector('.tg-room')).imageRendering,
          height:document.querySelector('.tech-terminal').clientHeight===__consoleHeight};
      })()`);
      assert.equal(scene.embedded, true); assert.equal(scene.hidden, true);
      assert.equal(scene.contained, true); assert.equal(scene.height, true);
      assert.match(scene.books, /tech\/companion\/shurelia-room-books\.png/);
      assert.match(scene.counter, /tech\/companion\/shurelia-room-counter\.png/);
      assert.equal(scene.pixels, 'pixelated');
      await s.click('#panel-tech-terminal .panel-btn');
      await s.wait(actor + '.snapshot().guest.visible===false');
      await s.click('#panel-tech-terminal .panel-btn');
      await s.wait(actor + '.snapshot().guest.visible===true');
      await s.click('#tech-terminal-guest .hc-portrait');
      await s.wait(actor + ".snapshot().guest.phase==='reading'");
      await s.click('#tech-terminal-guest .tg-dismiss');
      assert.equal(await s.page("document.querySelector('.terminal-navi').innerHTML===__naviOriginal"), true);
      assert.equal(await s.page(actor + '.snapshot().guest.active'), false);
      assert.deepEqual(s.errors, []);
      console.log('PASS library ' + protocol + ': original scene, contained layout, native portrait/minimize/restore/dismiss, exact NAVI restoration');
    } finally { clearTimeout(deadline); s.close(); }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
