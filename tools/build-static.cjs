// Zero-dependency static publication copy. Source files are never modified.
const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomBytes } = require('node:crypto');

const OWNER = 'y2k-static-build-v1';
const MANIFEST_NAME = '.static-build-manifest.json';
const PAGES = ['index.html', 'japan.html', 'music.html', 'canto.html', 'tech.html', 'sobre-mi.html', 'cosas.html'];
const ASSET_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.apng', '.svg', '.ico', '.bmp', '.tif', '.tiff', '.cur', '.ani',
  '.mp3', '.ogg', '.oga', '.wav', '.m4a', '.aac', '.flac', '.opus',
  '.mp4', '.webm', '.ogv', '.mov', '.m4v', '.woff', '.woff2', '.ttf', '.otf', '.eot', '.wasm', '.bin', '.css', '.js',
]);
const lstat = file => { try { return fs.lstatSync(file); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } };
const digest = file => {
  const hash = createHash('sha256'), buffer = Buffer.allocUnsafe(65536), fd = fs.openSync(file, 'r');
  try { let count; while ((count = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) hash.update(buffer.subarray(0, count)); }
  finally { fs.closeSync(fd); }
  return hash.digest('hex');
};

function regular(file, stat = lstat(file), output = false) {
  if (!stat) throw new Error(`Owned output missing/deleted: ${file}`);
  if (stat.isSymbolicLink()) throw new Error(`Refusing symbolic link/junction: ${file}`);
  if (!stat.isFile()) throw new Error(`Expected a regular file: ${file}`);
  if (output && stat.nlink > 1) throw new Error(`Refusing hardlinked output: ${file}`);
  return stat;
}

function relativePath(value) {
  if (typeof value !== 'string' || !value || value.includes('\\') || value.includes(':') || value.includes('\0')
    || path.posix.isAbsolute(value) || path.posix.normalize(value) !== value
    || value.split('/').some(part => !part || part === '.' || part === '..')
    || value.toLowerCase() === MANIFEST_NAME.toLowerCase()) throw new Error('Invalid relative ownership path');
  return value;
}

function within(parent, file) {
  const rel = path.relative(parent, file);
  if (!rel || rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) throw new Error('Output path escapes its fixed directory');
  return file;
}

function collect(root) {
  const files = new Map();
  function add(relative) {
    relativePath(relative);
    const source = path.join(root, ...relative.split('/'));
    const stat = regular(source);
    files.set(relative, { source, hash: digest(source), bytes: stat.size });
  }
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || !/\.(?:html|css|js)$/i.test(entry.name)) continue;
    if (!entry.isDirectory()) add(entry.name);
  }
  for (const page of PAGES) if (!files.has(page)) throw new Error(`Missing required destination page: ${page}`);
  const assets = path.join(root, 'assets');
  function walk(directory, prefix) {
    const stat = lstat(directory);
    if (stat?.isSymbolicLink()) throw new Error(`Refusing symbolic link/junction: ${directory}`);
    if (!stat?.isDirectory()) throw new Error(`Expected an assets directory: ${directory}`);
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name), childStat = lstat(file);
      if (childStat.isSymbolicLink()) throw new Error(`Refusing symbolic link/junction: ${file}`);
      if (entry.name.startsWith('.') || entry.name.toLowerCase() === 'concepts') continue;
      const relative = `${prefix}/${entry.name}`;
      if (childStat.isDirectory()) walk(file, relative);
      else if (ASSET_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) add(relative);
    }
  }
  if (lstat(assets)) walk(assets, 'assets');
  return new Map([...files].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
}

function buildStatic({ fixtureRoot } = {}) {
  const requestedRoot = path.resolve(fixtureRoot || path.join(__dirname, '..'));
  const rootStat = lstat(requestedRoot);
  if (!rootStat?.isDirectory() || rootStat.isSymbolicLink()) throw new Error('Build root must be a real directory, not a symbolic link');
  const root = fs.realpathSync(requestedRoot);
  const output = within(root, path.resolve(root, 'dist'));
  if (path.basename(output) !== 'dist') throw new Error('Only the fixed dist output is permitted');
  const marker = path.join(output, MANIFEST_NAME);
  const verifyOutputDirectory = required => {
    const stat = lstat(output);
    if (!stat) { if (required) throw new Error('Output directory disappeared during build'); return; }
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('Refusing output symbolic link/junction or non-directory');
    const realOutput = within(root, fs.realpathSync(output));
    if (path.basename(realOutput).toLowerCase() !== 'dist') throw new Error('Resolved output escapes its named dist directory');
  };
  const planned = collect(root);
  let previous = Object.create(null), previousMarkerHash = null;
  const outputStat = lstat(output);
  if (outputStat) {
    if (outputStat.isSymbolicLink()) throw new Error('Refusing output symbolic link/junction');
    if (!outputStat.isDirectory()) throw new Error('Existing output is not a managed directory');
    if (!lstat(marker)) throw new Error('Refusing existing unowned dist: ownership manifest required');
    regular(marker, undefined, true);
    const parsed = JSON.parse(fs.readFileSync(marker, 'utf8'));
    if (parsed.owner !== OWNER || Object.keys(parsed).sort().join(',') !== 'files,owner'
      || !parsed.files || typeof parsed.files !== 'object' || Array.isArray(parsed.files)) throw new Error('Invalid/unowned output manifest');
    previousMarkerHash = digest(marker);
    previous = parsed.files;
    for (const [relative, hash] of Object.entries(previous)) {
      relativePath(relative);
      if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash)) throw new Error('Invalid owned file hash');
    }
    const seen = new Set();
    function checkOutput(directory, prefix = '') {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const file = within(output, path.resolve(directory, entry.name));
        const stat = lstat(file), relative = prefix + entry.name;
        if (stat.isSymbolicLink()) throw new Error(`Refusing output symbolic link/junction: ${file}`);
        if (stat.isDirectory()) checkOutput(file, `${relative}/`);
        else {
          regular(file, stat, true);
          if (relative === MANIFEST_NAME) continue;
          if (!Object.hasOwn(previous, relative)) throw new Error(`Unowned output file: ${relative}`);
          if (digest(file) !== previous[relative]) throw new Error(`Owned output edited/modified (hash mismatch): ${relative}`);
          seen.add(relative);
        }
      }
    }
    checkOutput(output);
    for (const relative of Object.keys(previous)) if (!seen.has(relative)) throw new Error(`Owned output missing/deleted: ${relative}`);
  }

  // Preflight every destination/parent before the first mutation.
  function target(relative, createParents = false) {
    verifyOutputDirectory(createParents);
    relativePath(relative);
    const file = within(output, path.resolve(output, ...relative.split('/')));
    const segments = relative.split('/'); segments.pop();
    let directory = output;
    for (const segment of segments) {
      directory = within(output, path.join(directory, segment));
      const stat = lstat(directory);
      if (stat && (stat.isSymbolicLink() || !stat.isDirectory())) throw new Error('Output parent is a link or file, not a directory');
      if (!stat && createParents) fs.mkdirSync(directory);
    }
    const stat = lstat(file);
    if (stat) regular(file, stat, true);
    return file;
  }
  for (const relative of planned.keys()) target(relative);
  if (!outputStat) fs.mkdirSync(output);

  function atomicWrite(file, writeTemporary, expectedHash = null) {
    verifyOutputDirectory(true);
    within(output, file);
    const temp = within(output, path.join(path.dirname(file), `.${path.basename(file)}.static-build-${randomBytes(8).toString('hex')}.tmp`));
    let created = false;
    try {
      // Reserve with wx before copying, so even a failed partial copy is ours
      // to clean; a pre-existing name can never be claimed or unlinked.
      const fd = fs.openSync(temp, 'wx'); created = true; fs.closeSync(fd);
      writeTemporary(temp);
      verifyOutputDirectory(true);
      const stat = lstat(file);
      if (stat) {
        regular(file, stat, true);
        if (!expectedHash || digest(file) !== expectedHash) throw new Error('Output changed during build; refusing overwrite');
      } else if (expectedHash) throw new Error('Owned output deleted during build');
      fs.renameSync(temp, file); created = false;
    } finally {
      if (created && lstat(temp)) { within(output, temp); fs.unlinkSync(temp); }
    }
  }

  let totalBytes = 0;
  const nextFiles = Object.create(null);
  for (const [relative, source] of planned) {
    const file = target(relative, true);
    const oldHash = Object.hasOwn(previous, relative) ? previous[relative] : null;
    if (oldHash !== source.hash) {
      atomicWrite(file, temp => {
        fs.copyFileSync(source.source, temp);
        if (digest(temp) !== source.hash) { fs.unlinkSync(temp); throw new Error('Source changed during build; copied bytes do not match the plan'); }
      }, oldHash);
    }
    nextFiles[relative] = source.hash; totalBytes += source.bytes;
  }

  const removedFiles = Object.keys(previous).filter(relative => !planned.has(relative)).sort();
  for (const relative of removedFiles) {
    const file = target(relative);
    if (digest(file) !== previous[relative]) throw new Error('Stale owned output was edited during build');
    within(output, file); fs.unlinkSync(file);
    let directory = path.dirname(file);
    while (directory !== output) {
      within(output, directory);
      const stat = lstat(directory);
      if (!stat || stat.isSymbolicLink() || !stat.isDirectory() || fs.readdirSync(directory).length) break;
      fs.rmdirSync(directory); directory = path.dirname(directory);
    }
  }
  const contents = JSON.stringify({ owner: OWNER, files: nextFiles }, null, 2) + '\n';
  atomicWrite(marker, temp => fs.writeFileSync(temp, contents), previousMarkerHash);
  return { outputDirectory: output, fileCount: planned.size, totalBytes, removedFiles };
}

module.exports = { buildStatic, OWNER, MANIFEST_NAME };
if (require.main === module) {
  try {
    const result = buildStatic();
    process.stdout.write(`Built ${result.fileCount} public files (${result.totalBytes} bytes) into ${result.outputDirectory}\n`);
  } catch (error) { process.stderr.write(`Static build refused: ${error.message}\n`); process.exitCode = 1; }
}
