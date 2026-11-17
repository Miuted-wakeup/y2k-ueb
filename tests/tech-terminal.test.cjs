const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const terminal = require('../tech-terminal.js');

test('the Tech command module loads without a DOM and normalizes command names only', () => {
  assert.deepEqual(terminal.parse('  AsCiI   KiRbY '), { name: 'ascii', args: ['kirby'] });
  assert.deepEqual(terminal.parse('CLS'), { name: 'clear', args: [] });
  assert.equal(terminal.mount(null), null);
});

test('every implemented command has explicit help, including duration and stop controls', () => {
  for (const name of ['ascii', 'shurelia', 'talk', 'bye', 'matrix', 'theme', 'ping', 'date', 'whoami', 'specs', 'neofetch', 'quote', 'history', 'clear']) {
    assert.ok(terminal.help().includes(terminal.COMMANDS[name][0]));
    assert.equal(terminal.help(name), terminal.COMMANDS[name].join('\n'));
  }
  assert.match(terminal.help('shurelia'), /90 segundos/);
  assert.match(terminal.help('matrix'), /off/);
  assert.match(terminal.help('ping'), /sin contactar servidores/);
  assert.doesNotMatch(terminal.help(), /de prueba|simulad/i);
});

test('inherited properties never become commands or detailed help', () => {
  for (const name of ['__proto__', 'constructor', 'toString']) assert.match(terminal.help(name), /No hay ayuda/);
});

test('ASCII variants have literal narrow lines that fit the original small command pane', () => {
  assert.deepEqual(Object.keys(terminal.ART), ['cat', 'pc', 'kirby', 'flower']);
  for (const art of Object.values(terminal.ART)) {
    assert.equal(typeof art, 'string');
    assert.ok(art.split('\n').length >= 4);
    assert.ok(Math.max(...art.split('\n').map(line => line.length)) <= 27);
  }
  assert.match(terminal.ART.cat, /\( o\.o \)/);
  assert.ok(terminal.ART.pc.includes('/__________\\'));
});

test('the visitor borrows exact original pixels through section-owned Tech assets', () => {
  const root = path.resolve(__dirname, '..');
  for (const name of ['dialogue-font.png', 'shurelia-atlas.png', 'shurelia-room-books.png', 'shurelia-room-counter.png']) {
    assert.deepEqual(fs.readFileSync(path.join(root, 'assets/images/home', name)),
      fs.readFileSync(path.join(root, 'assets/images/tech/companion', name)));
  }
  const css = fs.readFileSync(path.join(root, 'tech-terminal-guest.css'), 'utf8');
  const urls = [...css.matchAll(/url\('([^']+)'\)/g)].map(match => match[1]);
  assert.equal(urls.length, 4);
  assert.ok(urls.every(url => url.startsWith('assets/images/tech/companion/')));
});
