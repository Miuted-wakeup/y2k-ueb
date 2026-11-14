const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const directory = path.resolve(__dirname, '../assets/gifs/sobre-mi/social');
const names = ['instagram', 'youtube', 'twitter', 'pinterest', 'spotify', 'tiktok'];
const ffmpeg = process.env.FFMPEG_PATH || (process.platform === 'win32'
  ? 'C:/ProgramData/chocolatey/bin/ffmpeg.exe' : 'ffmpeg');

// Source metadata captured before processing: all six are 368x368, four
// frames of 20 centiseconds, with NETSCAPE infinite looping (800ms/cycle).
// Their decoded frame equivalence is [0, 1, 2, 1]: the fourth frame repeats
// the second in the originals, so preserve that cadence rather than inventing one.
// These checks intentionally do not require the private Downloads folder.
function gifMetadata(buffer) {
  assert.match(buffer.subarray(0, 6).toString('ascii'), /^GIF8[79]a$/);
  const result = { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8), frames: [], loop: null };
  let offset = 13;
  if (buffer[10] & 0x80) offset += 3 * (2 ** ((buffer[10] & 7) + 1));
  let control = null;
  function blocks() {
    const parts = [];
    while (buffer[offset]) {
      const length = buffer[offset++];
      parts.push(buffer.subarray(offset, offset + length));
      offset += length;
    }
    offset++;
    return Buffer.concat(parts);
  }
  while (offset < buffer.length) {
    const marker = buffer[offset++];
    if (marker === 0x3b) break;
    if (marker === 0x21) {
      const type = buffer[offset++];
      const data = blocks();
      if (type === 0xf9) control = { delay: data.readUInt16LE(1), transparent: Boolean(data[0] & 1) };
      if (type === 0xff && data.subarray(0, 11).toString('ascii') === 'NETSCAPE2.0') {
        assert.equal(data[11], 1);
        result.loop = data.readUInt16LE(12);
      }
      continue;
    }
    assert.equal(marker, 0x2c, 'Unexpected GIF block');
    const packed = buffer[offset + 8];
    offset += 9;
    if (packed & 0x80) offset += 3 * (2 ** ((packed & 7) + 1));
    offset++; // LZW minimum code size.
    blocks();
    assert.ok(control, 'Every frame must declare delay/transparency');
    result.frames.push(control);
    control = null;
  }
  return result;
}

for (const name of names) {
  test(`${name}: real alpha, complete animated cycle and unclipped artwork`, () => {
    const filename = path.join(directory, `${name}.gif`);
    assert.ok(fs.existsSync(filename), `Missing processed asset: ${filename}`);
    const buffer = fs.readFileSync(filename);
    const metadata = gifMetadata(buffer);
    assert.deepEqual([metadata.width, metadata.height], [128, 128]);
    assert.equal(metadata.frames.length, 4);
    assert.deepEqual(metadata.frames.map(frame => frame.delay), [20, 20, 20, 20]);
    assert.ok(metadata.frames.every(frame => frame.transparent));
    assert.equal(metadata.loop, 0, 'Animation must loop forever');
    assert.ok(buffer.length < 100_000, 'Small dock icons should stay compact');

    const decoded = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-nostdin',
      '-ignore_loop', '1', '-i', filename, '-fps_mode', 'passthrough',
      '-f', 'rawvideo', '-pix_fmt', 'rgba', 'pipe:1'], { maxBuffer: 2 * 1024 * 1024 });
    assert.ifError(decoded.error);
    assert.equal(decoded.status, 0, decoded.stderr.toString());
    const stride = 128 * 128 * 4;
    assert.equal(decoded.stdout.length, 4 * stride);
    const hashes = [];
    for (let frame = 0; frame < 4; frame++) {
      const pixels = decoded.stdout.subarray(frame * stride, (frame + 1) * stride);
      hashes.push(createHash('sha256').update(pixels).digest('hex'));
      let transparent = 0;
      let opaque = 0;
      let bright = 0;
      let minX = 128; let minY = 128; let maxX = -1; let maxY = -1;
      for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
        const index = 4 * (y * 128 + x);
        const alpha = pixels[index + 3];
        assert.ok(alpha === 0 || alpha === 255, 'GIF alpha must be binary');
        if (x === 0 || y === 0 || x === 127 || y === 127) assert.equal(alpha, 0, 'Outer edge must be clear');
        if (!alpha) { transparent++; continue; }
        opaque++;
        if (pixels[index] > 160 && pixels[index + 1] > 160 && pixels[index + 2] > 160) bright++;
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      }
      assert.ok(transparent > 128 * 128 * 0.3, 'Background must really be transparent');
      assert.ok(opaque > 128 * 128 * 0.08, 'Artwork must not disappear');
      assert.ok(bright > opaque * 0.2, 'Original pale chalk texture must remain');
      assert.ok(minX >= 2 && minY >= 2 && maxX <= 125 && maxY <= 125, 'Keep clear margin around original artwork');
      assert.ok(maxX - minX > 90 && maxY - minY > 90, 'Keep full icon silhouette');
    }
    assert.deepEqual(hashes.map(hash => hashes.indexOf(hash)), [0, 1, 2, 1],
      'Keep the original three distinct drawings and four-frame cadence');
  });
}
