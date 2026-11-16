// Local original-art and bitmap-text contracts. Node built-ins only; no Downloads dependency.
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const zlib = require('node:zlib');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const load = () => require('../home-companion-art.js');

// Decode the supplied RGBA PNG scanlines to pin the original facial aperture,
// not merely metadata or a coordinate copied into production code.
function png(file) {
  const buffer = fs.readFileSync(path.join(root, file));
  assert.equal(buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  const width = buffer.readUInt32BE(16), height = buffer.readUInt32BE(20);
  assert.equal(buffer[24], 8);
  assert.equal(buffer[25], 6, 'Source must retain RGBA transparency');
  const compressed = [];
  for (let offset = 8; offset < buffer.length;) {
    const length = buffer.readUInt32BE(offset);
    if (buffer.toString('ascii', offset + 4, offset + 8) === 'IDAT') {
      compressed.push(buffer.subarray(offset + 8, offset + 8 + length));
    }
    offset += length + 12;
  }
  const raw = zlib.inflateSync(Buffer.concat(compressed));
  const stride = width * 4, pixels = Buffer.alloc(stride * height);
  const paeth = (a, b, c) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    assert.ok(filter <= 4);
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x;
      const a = x >= 4 ? pixels[i - 4] : 0;
      const b = y ? pixels[i - stride] : 0;
      const c = y && x >= 4 ? pixels[i - stride - 4] : 0;
      const predictor = [0, a, b, Math.floor((a + b) / 2), paeth(a, b, c)][filter];
      pixels[i] = (raw[y * (stride + 1) + 1 + x] + predictor) & 255;
    }
  }
  return { buffer, width, height, alpha: (x, y) => pixels[(y * width + x) * 4 + 3] };
}

test('S2: packaged PNGs are byte-identical originals with their original dimensions', () => {
  for (const [file, hash, dimensions] of [
    ['assets/images/home/shurelia-atlas.png', '4883fb9d114141f7d280836abecc1a23ab0d60f96dd4fec06ecc32bc6799fac2', [256, 896]],
    ['assets/images/home/dialogue-font.png', '18f37637fd3345d3e8c4f56268567dc795fc8d48802a1072c3e50525682797f9', [128, 128]],
  ]) {
    const image = png(file);
    assert.equal(createHash('sha256').update(image.buffer).digest('hex'), hash);
    assert.deepEqual([image.width, image.height], dimensions);
    assert.equal(image.alpha(image.width - 1, image.height - 1), 0);
  }
});

test('S2: the main body has its exact 64×56 aperture and nine original face tiles', () => {
  const image = png('assets/images/home/shurelia-atlas.png');
  for (let y = 260; y < 316; y++) {
    for (let x = 82; x < 146; x++) assert.equal(image.alpha(x, y), 0);
  }
  assert.ok(image.alpha(100, 259) > 0);
  assert.ok(image.alpha(100, 316) > 0);
  for (const [x, y] of [[0, 0], [64, 0], [128, 0], [192, 0], [0, 56], [64, 56], [128, 56], [192, 56], [0, 112]]) {
    assert.equal(image.alpha(x + 32, y + 28), 255);
  }
});

test('S2: actual atlas cells, including punctuation and non-ASCII symbol slots', () => {
  const art = load();
  assert.equal(art.cellSize, 12);
  assert.equal(art.sheetSize, 96);
  for (const [character, column, row] of [
    ['A', 0, 4], ['Z', 1, 7], ['0', 7, 1], ['1', 0, 2], ['8', 7, 2], ['9', 0, 3],
    ['!', 0, 0], ['"', 1, 0], [',', 3, 1], ['-', 4, 1], ['.', 5, 1], ['/', 6, 1],
    [':', 1, 3], [';', 2, 3], ['<', 3, 3], ['=', 4, 3], ['>', 5, 3], ['?', 6, 3],
    ["'", 6, 7], ['□', 3, 0], ['△', 6, 0], ['®', 1, 1],
  ]) assert.deepEqual(art.glyphFor(character), { character, column, row });
  assert.equal(art.glyphFor(' '), null);
  assert.equal(art.glyphFor(''), null);
  assert.deepEqual(art.glyphFor('$'), { character: '?', column: 6, row: 3 });
});

test('S4: readable uppercase/base-letter normalization has explicit missing-glyph fallback', () => {
  const art = load();
  assert.equal(art.normalizeText('¡Qué ilusión! ¿Niñez? Canción, pingüino… ☃'), '!QUE ILUSION! ?NINEZ? CANCION, PINGUINO... ?');
  assert.equal(art.normalizeText('“Hola” — don’t\n🙃'), '"HOLA" - DON\'T ?');
  assert.deepEqual(art.glyphFor('ñ'), { character: 'N', column: 5, row: 5 });
  assert.equal(art.normalizeText(null), '');
});

function fixture() {
  const doc = {
    createElement(tagName) {
      return {
        ownerDocument: doc, tagName: tagName.toUpperCase(), className: '', children: [], dataset: {}, style: {},
        appendChild(node) { this.children.push(node); return node; },
        replaceChildren(...nodes) { this.children = nodes; },
        set innerHTML(_) { throw new Error('Never use HTML parsing for bitmap text'); },
      };
    },
    createTextNode(text) { return { nodeType: 3, textContent: text, ownerDocument: doc }; },
  };
  return doc.createElement('div');
}

test('S4: render words as wrappable groups, preserve real spaces and return all glyphs', () => {
  const art = load(), container = fixture();
  const glyphs = art.renderText(container, '¡Hola,  tú!');
  assert.deepEqual(container.children.map(node => node.className || node.textContent), ['hc-word', '  ', 'hc-word']);
  assert.equal(container.children[1].nodeType, 3);
  assert.equal(glyphs.map(glyph => glyph.dataset.glyph).join(''), '!HOLA,TU!');
  assert.ok(glyphs.every(glyph => glyph.className === 'hc-glyph' && glyph.tagName === 'SPAN'));
  assert.equal(glyphs[0].style.backgroundPosition, '0px 0px');
  assert.equal(glyphs[1].style.backgroundPosition, '-84px -48px');
  assert.equal(glyphs[7].style.backgroundPosition, '-48px -72px');
  art.renderText(container, 'A');
  assert.equal(container.children.length, 1, 'Replace, do not accumulate, phrases');
  assert.equal(container.children[0].children[0].dataset.glyph, 'A');
  assert.deepEqual(art.renderText(container, ''), []);
  assert.deepEqual(container.children, []);
});

test('S4: angle brackets never create markup; UMD also exposes the browser API', () => {
  const art = load(), container = fixture();
  const glyphs = art.renderText(container, '<img src=x onerror=alert(1)>');
  assert.equal(glyphs.map(glyph => glyph.dataset.glyph).join(''), '<IMGSRC=XONERROR=ALERT(1)>');
  assert.ok(container.children.filter(node => node.nodeType !== 3).every(node => node.tagName === 'SPAN'));
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(root, 'home-companion-art.js'), 'utf8'), context);
  assert.equal(context.HomeCompanionArt.normalizeText('á'), 'A');
  assert.equal(typeof context.HomeCompanionArt.renderText, 'function');
});
