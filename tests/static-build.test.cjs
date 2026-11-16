const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const load = () => require('../tools/build-static.cjs');
const pages = ['index', 'japan', 'music', 'canto', 'tech', 'sobre-mi', 'cosas'];

function fixture(t) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'y2k-static-test-'));
  const root = path.join(scratch, 'site'); fs.mkdirSync(root);
  const write = (relative, contents = relative) => { const file = path.join(root, relative); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, contents); };
  pages.forEach(page => write(`${page}.html`, `<html>${page}</html>`));
  write('style.css'); write('scripts.js');
  write('assets/images/home/photo.png', Buffer.from([0, 2, 255, 1]));
  write('assets/gifs/home/animation.gif', Buffer.from([3, 0, 254]));
  write('assets/music/song.mp3', Buffer.from([0, 4, 200]));
  write('assets/fonts/type.woff2', Buffer.from([0, 9, 250]));
  write('assets/video/clip.mp4', Buffer.from([0, 8, 245]));
  write('tests/private.test.cjs'); write('odd/tasks/private.md'); write('.agents/rules/private.md');
  write('.git/private'); write('private-README.md'); write('private.json'); write('.hidden.js');
  write('assets/images/home/provenance.json'); write('assets/images/home/README.md');
  write('assets/images/sobre-mi/concepts/unused.png'); write('assets/.private/secret.png');
  const outside = path.join(scratch, 'outside.txt'); fs.writeFileSync(outside, 'Never touch outside output');
  t.after(() => {
    // Only task-owned scratch roots may be recursively removed by the tests.
    assert.equal(path.dirname(scratch), path.resolve(os.tmpdir()));
    assert.ok(path.basename(scratch).startsWith('y2k-static-test-'));
    assert.equal(fs.lstatSync(scratch).isSymbolicLink(), false);
    fs.rmSync(scratch, { recursive: true, force: true });
  });
  return { scratch, root, outside, write, build: () => load().buildStatic({ fixtureRoot: root }), out: relative => path.join(root, 'dist', relative) };
}

test('Vercel uses zero-dependency static dist and real HTML paths, not a catch-all SPA', () => {
  const config = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../vercel.json'), 'utf8'));
  assert.equal(config.framework, null); assert.equal(config.buildCommand, 'node tools/build-static.cjs');
  assert.equal(config.outputDirectory, 'dist'); assert.equal(config.cleanUrls, false);
  for (const rule of config.rewrites || []) {
    assert.ok(!rule.source.includes('*') && !rule.source.includes(':'));
    assert.ok(pages.some(page => rule.destination === `/${page}.html`));
    assert.ok(!/^https?:/.test(rule.destination));
  }
});

test('public files are byte-identical; private source/provenance/concepts never enter dist', t => {
  const f = fixture(t), result = f.build();
  assert.equal(result.outputDirectory, path.join(f.root, 'dist'));
  for (const relative of [...pages.map(page => `${page}.html`), 'style.css', 'scripts.js',
    'assets/images/home/photo.png', 'assets/gifs/home/animation.gif', 'assets/music/song.mp3', 'assets/fonts/type.woff2', 'assets/video/clip.mp4']) {
    assert.deepEqual(fs.readFileSync(f.out(relative)), fs.readFileSync(path.join(f.root, relative)));
  }
  for (const relative of ['tests', 'odd', '.agents', '.git', 'private-README.md', 'private.json', '.hidden.js',
    'assets/images/home/provenance.json', 'assets/images/home/README.md', 'assets/images/sobre-mi/concepts', 'assets/.private']) {
    assert.equal(fs.existsSync(f.out(relative)), false, relative);
  }
  const manifest = JSON.parse(fs.readFileSync(f.out(load().MANIFEST_NAME), 'utf8'));
  assert.equal(manifest.owner, load().OWNER); assert.equal(Object.keys(manifest.files).length, result.fileCount);
  assert.deepEqual(Object.keys(manifest).sort(), ['files', 'owner']);
  assert.ok(!JSON.stringify(manifest).includes(f.scratch));
  for (const [relative, digest] of Object.entries(manifest.files)) {
    assert.ok(!relative.includes('\\') && !relative.includes(':') && !relative.startsWith('/'));
    assert.equal(digest, createHash('sha256').update(fs.readFileSync(f.out(relative))).digest('hex'));
  }
  assert.equal(fs.readFileSync(f.out('scripts.js'), 'utf8'), 'scripts.js');
});

test('new root runtime JS/CSS is included automatically and identical rebuild is deterministic', t => {
  const f = fixture(t); f.build(); f.write('site-new-runtime.js', 'new runtime'); f.write('feature.css', 'new CSS');
  f.build(); const before = fs.readFileSync(f.out(load().MANIFEST_NAME));
  assert.equal(fs.readFileSync(f.out('site-new-runtime.js'), 'utf8'), 'new runtime');
  f.build(); assert.deepEqual(fs.readFileSync(f.out(load().MANIFEST_NAME)), before);
});

test('rebuild removes only stale manifest-owned files and prunes only their empty directories', t => {
  const f = fixture(t); f.write('assets/old/owned.png', 'old'); f.write('old-runtime.js', 'old runtime'); f.build();
  fs.unlinkSync(path.join(f.root, 'assets/old/owned.png')); fs.unlinkSync(path.join(f.root, 'old-runtime.js'));
  const result = f.build();
  assert.equal(fs.existsSync(f.out('assets/old/owned.png')), false); assert.equal(fs.existsSync(f.out('old-runtime.js')), false);
  assert.equal(fs.existsSync(f.out('assets/old')), false);
  assert.deepEqual(result.removedFiles.sort(), ['assets/old/owned.png', 'old-runtime.js']);
  assert.equal(fs.readFileSync(f.out('index.html'), 'utf8'), '<html>index</html>');
});

test('an existing unowned dist directory is never claimed, even when empty', t => {
  const f = fixture(t); fs.mkdirSync(f.out(''));
  assert.throws(f.build, /unowned|managed|manifest/i); assert.deepEqual(fs.readdirSync(f.out('')), []);
});

test('manual edits or deletions in owned output fail before overwriting other output', t => {
  const f = fixture(t); f.build();
  fs.writeFileSync(f.out('scripts.js'), 'user edited output'); f.write('style.css', 'new source');
  assert.throws(f.build, /edited|modified|hash/i);
  assert.equal(fs.readFileSync(f.out('scripts.js'), 'utf8'), 'user edited output');
  assert.equal(fs.readFileSync(f.out('style.css'), 'utf8'), 'style.css');
  fs.writeFileSync(f.out('scripts.js'), 'scripts.js'); fs.unlinkSync(f.out('index.html'));
  assert.throws(f.build, /missing|deleted/i); assert.equal(fs.existsSync(f.out('index.html')), false);
});

test('any unowned output file blocks rebuild, including a path that becomes a new public runtime', t => {
  const f = fixture(t); f.build(); f.write('new-runtime.js', 'same content');
  fs.writeFileSync(f.out('new-runtime.js'), 'same content');
  assert.throws(f.build, /unowned/i); assert.equal(fs.readFileSync(f.out('new-runtime.js'), 'utf8'), 'same content');
});

test('public source symlinks and output directory junctions are rejected without following them', t => {
  const f = fixture(t), outsideDir = path.join(f.scratch, 'outside-directory'); fs.mkdirSync(outsideDir);
  fs.writeFileSync(path.join(outsideDir, 'secret.png'), 'outside original');
  fs.symlinkSync(outsideDir, path.join(f.root, 'assets/linked'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(f.build, /symlink|symbolic|junction/i);
  fs.unlinkSync(path.join(f.root, 'assets/linked'));
  fs.symlinkSync(outsideDir, f.out(''), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(f.build, /symlink|symbolic|junction/i);
  assert.deepEqual(fs.readdirSync(outsideDir), ['secret.png']);
  assert.equal(fs.readFileSync(path.join(outsideDir, 'secret.png'), 'utf8'), 'outside original');
});

test('escaping ownership paths and output hardlinks cannot authorize outside changes', t => {
  const f = fixture(t); f.build();
  const marker = f.out(load().MANIFEST_NAME), originalMarker = fs.readFileSync(marker);
  const manifest = JSON.parse(originalMarker); manifest.files['../outside.txt'] = createHash('sha256').update('Never touch outside output').digest('hex');
  fs.writeFileSync(marker, JSON.stringify(manifest)); assert.throws(f.build, /path|relative|escape/i);
  assert.equal(fs.readFileSync(f.out('scripts.js'), 'utf8'), 'scripts.js');
  fs.writeFileSync(marker, originalMarker);
  const outsideCopy = path.join(f.scratch, 'outside-script.js'); fs.copyFileSync(f.out('scripts.js'), outsideCopy);
  fs.unlinkSync(f.out('scripts.js')); fs.linkSync(outsideCopy, f.out('scripts.js'));
  f.write('scripts.js', 'updated source'); assert.throws(f.build, /link/i);
  assert.equal(fs.readFileSync(outsideCopy, 'utf8'), 'scripts.js');
});

test('build never changes input/private/outside files and rejects missing destination pages', t => {
  const f = fixture(t); const privateBefore = fs.readFileSync(path.join(f.root, 'odd/tasks/private.md'));
  f.build(); assert.equal(fs.readFileSync(f.out('index.html'), 'utf8'), '<html>index</html>');
  assert.equal(fs.readFileSync(path.join(f.root, 'scripts.js'), 'utf8'), 'scripts.js');
  assert.deepEqual(fs.readFileSync(path.join(f.root, 'odd/tasks/private.md')), privateBefore);
  assert.equal(fs.readFileSync(f.out(load().MANIFEST_NAME), 'utf8').includes(f.root), false);
  assert.equal(fs.readFileSync(f.out('../scripts.js'), 'utf8'), 'scripts.js');
  assert.equal(fs.readFileSync(f.out('../../outside.txt'), 'utf8'), 'Never touch outside output');
  fs.unlinkSync(path.join(f.root, 'tech.html')); assert.throws(f.build, /tech\.html|seven|page/i);
});

test('a failed copy cleans only its own reserved temporary file, never outside data', t => {
  const f = fixture(t); const copy = fs.copyFileSync;
  fs.copyFileSync = (source, target) => { fs.writeFileSync(target, 'partial copy'); throw new Error('Fixture copy failure'); };
  try { assert.throws(f.build, /Fixture copy failure/); }
  finally { fs.copyFileSync = copy; }
  function files(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
      ? files(path.join(directory, entry.name)) : [entry.name]);
  }
  assert.deepEqual(files(f.out('')), []);
  assert.equal(fs.readFileSync(f.out('../../outside.txt'), 'utf8'), 'Never touch outside output');
});
