const { test } = require('node:test');
const assert = require('node:assert/strict');
const core = () => require('../site-audio-core.js');
const base = 'https://example.test/blog/index.html';
const local = 'file:///C:/mi%20web/index.html';
const token = '0123456789abcdef'.repeat(2);

test('seven section routes preserve their own destination, query and fragment', () => {
  for (const entry of core().SECTIONS) {
    const route = core().resolveRoute(entry.file + '?mode=retro#details', base);
    assert.equal(route.section, entry.section);
    assert.equal(route.href, 'https://example.test/blog/' + entry.file + '?mode=retro#details');
    assert.equal(route.fileHref, route.href);
  }
  assert.equal(core().initialRoute('https://example.test/blog/tech.html?q=1#hardware').section, 'tech');
  assert.equal(core().initialRoute('https://example.test/blog/').section, 'home');
  const alias = core().resolveRoute('tech?x=1#hardware', base);
  assert.equal(alias.href, 'https://example.test/blog/tech?x=1#hardware');
  assert.equal(alias.fileHref, 'https://example.test/blog/tech.html?x=1#hardware');
});

test('route allowlist rejects remote, sibling-folder, credentials and unsafe protocols', () => {
  for (const href of ['https://evil.test/tech.html', '../tech.html', 'unknown.html', 'javascript:alert(1)',
    'data:text/html,tech.html', 'https://u:p@example.test/blog/tech.html', 'a%2ftech.html', 'a%5ctech.html', '//evil.test/tech.html']) {
    assert.equal(core().resolveRoute(href, base), null, href);
  }
  assert.equal(core().resolveRoute('file:///C:/elsewhere/tech.html', local), null);
});

test('file hash routing retains the physical host file and reloads the requested section', () => {
  const tech = core().resolveRoute('tech.html?mode=a%20b#hardware', local);
  const address = core().historyURL(tech, local);
  assert.equal(new URL(address).pathname, '/C:/mi%20web/index.html');
  assert.equal(core().initialRoute(address).href, tech.href);
  assert.equal(core().initialRoute('file:///C:/mi%20web/tech.html?x=1#hardware').section, 'tech');
  assert.equal(core().historyURL(core().resolveRoute('music.html', base), base), 'https://example.test/blog/music.html');
});

test('reserved child markers are stripped publicly and can never bypass a top-level entry', () => {
  const route = core().resolveRoute('tech.html?x=1#hardware', local);
  const href = core().frameURL(route, token, 3);
  assert.equal(core().publicURL(href), route.href);
  const top = { location: { href } }; top.parent = top;
  assert.equal(core().frameInfo(top), null);
  const child = { location: { href }, parent: {} };
  assert.deepEqual(core().frameInfo(child), { token, epoch: 3, publicURL: route.href });
  assert.equal(core().frameInfo({ parent: {}, location: { href: href.replace(token, 'fake') } }), null);
  assert.equal(core().frameInfo({ parent: {}, location: { href: href.replace('__y2k_epoch=3', '__y2k_epoch=0') } }), null);
});

test('protocol envelopes need own capability fields and a known kind', () => {
  const c = core();
  const data = { channel: c.PROTOCOL, kind: 'hello', token, epoch: 1 };
  assert.equal(c.validEnvelope(data, token, 1), true);
  for (const bad of [null, [], Object.create(data), { ...data, epoch: 2 }, { ...data, token: 'fake' }, { ...data, kind: 'eval' }]) {
    assert.equal(c.validEnvelope(bad, token, 1), false);
  }
});

test('file messaging uses opaque null even when Chromium URL.origin reports file://', () => {
  const NativeURL=global.URL;
  global.URL=class extends NativeURL { get origin(){return this.protocol==='file:'?'file://':super.origin;} };
  try {
    assert.equal(core().messageOrigin('file:///C:/web/tech.html'),'null');
    assert.equal(core().messageOrigin('https://example.test/blog/tech.html'),'https://example.test');
  } finally { global.URL=NativeURL; }
});
