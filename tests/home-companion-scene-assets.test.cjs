// Source-faithful scene crop contracts. Local Node built-ins only; no Downloads dependency.
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { test } = require('node:test');
const directory = path.resolve(__dirname, '../assets/images/home');
const hash = buffer => createHash('sha256').update(buffer).digest('hex');
const expected = {
  books: {
    file: 'shurelia-room-books.png', box: [1980, 496, 2132, 736], width: 152, height: 240, byteLength: 11972,
    sha256: '262881d87000e10f50f312b9ee58bcfc852eab47141837667e618297aff64269',
    rgbaSha256: '9ca06452c2ca1d854dd717afd0adbe4baeb7fee85958f460078acf118227cacd',
    topLeft: [24, 8, 0, 255], bottomRight: [96, 48, 24, 255], minimumColors: 40,
  },
  counter: {
    file: 'shurelia-room-counter.png', box: [1840, 1152, 2256, 1166], width: 416, height: 14, byteLength: 936,
    sha256: '73c7b2c57653a091bf322ed8a51a3eb4733f976a05ce8cbd38d668979fbe17a1',
    rgbaSha256: '84db67a6b56d9efbcda4762aacc94c93b1005b8ee4ddaeff929f9b9068ae1830',
    topLeft: [24, 8, 0, 255], bottomRight: [24, 8, 0, 255], minimumColors: 8,
  },
};

function decode(buffer) {
  assert.equal(buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  const width = buffer.readUInt32BE(16), height = buffer.readUInt32BE(20);
  assert.equal(buffer[24], 8);
  assert.equal(buffer[25], 6, 'Keep original 8-bit RGBA pixels');
  assert.equal(buffer[28], 0, 'Use non-interlaced deterministic PNG output');
  const chunks = [];
  for (let offset = 8; offset < buffer.length;) {
    const length = buffer.readUInt32BE(offset);
    if (buffer.toString('ascii', offset + 4, offset + 8) === 'IDAT') chunks.push(buffer.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const raw = zlib.inflateSync(Buffer.concat(chunks)), stride = width * 4;
  assert.equal(raw.length, height * (stride + 1));
  const rgba = Buffer.alloc(width * height * 4);
  const paeth = (a, b, c) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    assert.ok(filter <= 4);
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x, a = x >= 4 ? rgba[i - 4] : 0;
      const b = y ? rgba[i - stride] : 0, c = y && x >= 4 ? rgba[i - stride - 4] : 0;
      rgba[i] = (raw[y * (stride + 1) + x + 1] + [0, a, b, Math.floor((a + b) / 2), paeth(a, b, c)][filter]) & 255;
    }
  }
  return { width, height, rgba };
}

test('S5: provenance pins the supplied atlas and exact reproducible lossless crop rectangles', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'shurelia-room-sources.json'), 'utf8'));
  assert.equal(manifest.formatVersion, 1);
  assert.equal(manifest.source.basename, 'DS _ DSi - Castlevania_ Order of Ecclesia - Backgrounds - Library.png');
  assert.equal(manifest.source.sha256, 'e92fe2738aeb51cb1d1e3fd0f1ee0ac470b0f95d5616ad1b2a877af63cc054c0');
  assert.deepEqual([manifest.source.width, manifest.source.height, manifest.source.byteLength], [4512, 8064, 2267112]);
  assert.match(manifest.source.game, /Castlevania: Order of Ecclesia/);
  assert.match(manifest.source.attribution, /KONAMI/);
  assert.match(manifest.source.licensingNote, /not a license grant/);
  assert.equal(manifest.extraction.resized, false);
  assert.equal(manifest.extraction.recolored, false);
  assert.equal(manifest.extraction.chromaReplaced, false);
  for (const [key, crop] of Object.entries(expected)) {
    for (const field of ['file', 'box', 'width', 'height', 'byteLength', 'sha256', 'rgbaSha256']) {
      assert.deepEqual(manifest.crops[key][field], crop[field], `${key}: ${field}`);
    }
    assert.equal(crop.box[2] - crop.box[0], crop.width);
    assert.equal(crop.box[3] - crop.box[1], crop.height);
  }
});

for (const [key, crop] of Object.entries(expected)) {
  test(`S5: ${key} retains exact native pixels without chroma holes or sheet margins`, () => {
    const buffer = fs.readFileSync(path.join(directory, crop.file));
    assert.equal(buffer.length, crop.byteLength);
    assert.equal(hash(buffer), crop.sha256);
    const image = decode(buffer);
    assert.deepEqual([image.width, image.height], [crop.width, crop.height]);
    assert.equal(hash(image.rgba), crop.rgbaSha256, 'Decoded pixels match the pinned source rectangle');
    assert.deepEqual([...image.rgba.subarray(0, 4)], crop.topLeft);
    assert.deepEqual([...image.rgba.subarray(-4)], crop.bottomRight);
    const colors = new Set();
    for (let i = 0; i < image.rgba.length; i += 4) {
      const [r, g, b, a] = image.rgba.subarray(i, i + 4);
      assert.equal(a, 255, `No transparent source-sheet holes at pixel ${i / 4}`);
      assert.ok(!(r < 40 && g >= 96 && b < 40), 'No green sheet/door chroma');
      assert.ok(!(r < 40 && g >= 96 && b >= 96), 'No cyan sheet chroma');
      assert.ok(!(r > 240 && g > 240 && b > 240), 'No white sheet margin');
      colors.add(`${r},${g},${b},${a}`);
    }
    assert.ok(colors.size >= crop.minimumColors, 'Retain textured original art, not a flat placeholder');
  });
}
