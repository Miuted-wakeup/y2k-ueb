// Regression for the explicitly withdrawn decorative LOADING experiment.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const sections = ['home', 'japan', 'music', 'canto', 'tech', 'sobre-mi', 'cosas'];

test('all seven live pages have no loading bootstrap or overlay', () => {
  for (const section of sections) {
    const html = fs.readFileSync(path.join(root, section === 'home' ? 'index.html' : section + '.html'), 'utf8');
    assert.doesNotMatch(html, /section-loading|Section-entry loading trial/, section);
  }
});

test('withdrawn runtime, derived images and obsolete trial checks are absent', () => {
  const files = ['section-loading.js', 'section-loading.css', 'section-loading-README.md',
    'section-loading-sources.json', 'tests/section-loading.test.cjs', 'tests/section-loading.browser.cjs',
    ...sections.map(section => 'assets/images/' + section + '/section-loading.png')];
  for (const file of files) assert.equal(fs.existsSync(path.join(root, file)), false, file);
});
