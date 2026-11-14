// Public identity checks. Node built-ins only; no network or dependencies.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const formerName = /(?<![\p{L}\p{N}])gos(?![\p{L}\p{N}])|ゴス/iu;

function publicFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.name.startsWith('.') || entry.name === 'tests') return [];
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return publicFiles(file);
    return /\.(html|css|js|svg)$/i.test(file) ? [file] : [];
  });
}

test('the former public name is absent from active site text and vector assets', () => {
  const matches = publicFiles(root).filter(file => formerName.test(fs.readFileSync(file, 'utf8')));
  assert.deepEqual(matches.map(file => path.relative(root, file)), []);
});

test('each existing profile uses Muted while preserving its display style', () => {
  for (const file of ['index.html', 'japan.html', 'music.html', 'canto.html']) {
    assert.match(read(file), /☆ MUTED ☆/, file);
  }
  assert.match(read('tech.html'), /☆ MUTED \(online\) ☆/);
  const about = read('sobre-mi.html');
  assert.match(about, /El mundo de Muted/);
  assert.match(about, /id="sm-welcome-title" class="sm-card-caption">muted /);
  assert.match(about, /alt="Avatar de Muted"/);
  assert.match(about, /木漏れ日/);
  assert.match(about, /MUTED'S MIX/);
});

test('placeholder social labels use the confirmed name, not invented accounts', () => {
  const canto = read('canto.html');
  const badges = [...canto.matchAll(/class="cy-social-badge[^\"]*">([^<]+)</g)].map(match => match[1]);
  assert.deepEqual(badges, ['Muted', 'Muted', 'Spotify', 'Muted']);
  assert.match(read('tech.html'), /Muted · MSN/);
  assert.match(read('scripts.js'), /muted@frutiger-rig/);
});

test('unrelated words containing the former letter sequence stay intact', () => {
  assert.match(read('scripts.js'), /videojuegos viejos/);
  assert.match(read('canto.html'), /pequeños hallazgos/);
});
