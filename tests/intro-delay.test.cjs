// Focused entrance contract, using the real load handler and a virtual timer.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '..', 'scripts.js'), 'utf8');
const boundary = source.indexOf('\nconst diaryEntries =');
assert.ok(boundary > 0, 'The entrance handler must have a clear module boundary');
const readiness = source.slice(source.indexOf('    const onReady ='), source.indexOf('    const getPlayer ='));
const entrance = readiness + source.slice(source.indexOf("onReady('load',"), boundary);
assert.ok(entrance.includes("onReady('load'"));

for (const section of ['', 'section-japan', 'section-canto', 'section-music', 'section-tech', 'section-sobre-mi']) {
  for (const reduced of [false, true]) {
    test(`${section || 'home/cosas'}: 700ms background-first wait, reduced motion=${reduced}`, () => {
      let onLoad;
      const timers = [];
      const panel = { style: { opacity: '0' } };
      const image = { style: {} };
      const body = { id: section, style: { opacity: '0' } };
      const host = { addEventListener: (event, callback) => { assert.equal(event, 'load'); onLoad = callback; } };
      vm.runInNewContext(entrance, {
        host,
        window: {
          addEventListener: (event, callback) => { assert.equal(event, 'load'); onLoad = callback; },
          matchMedia: () => ({ matches: reduced }),
        },
        document: { readyState: 'loading', body, querySelectorAll: selector => selector.includes('.panel img') ? [image] : [panel] },
        setTimeout: (callback, delay) => timers.push({ callback, delay }),
      });
      onLoad();
      assert.equal(body.style.opacity, '1', 'Background starts before the windows');
      assert.equal(image.style.opacity, '1');
      assert.equal(panel.style.opacity, '0', 'Windows must remain hidden during the wait');
      assert.equal(timers.length, 1);
      assert.equal(timers[0].delay, 700, 'All pages must use the JAPAN/CANTO wait');
      timers[0].callback();
      assert.equal(panel.style.opacity, '1');
      assert.equal(body.style.transition, 'opacity 0.8s ease', 'Use the same background fade as JAPAN/CANTO');
      assert.equal(panel.style.transition, 'opacity 0.5s ease', 'Use the same smooth window fade as JAPAN/CANTO');
    });
  }
}
