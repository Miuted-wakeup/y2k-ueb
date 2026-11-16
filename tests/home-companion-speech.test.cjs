// S7: isolated Web Audio consent, live player gates and scheduled-node lifetime.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const load = () => require('../home-companion-speech.js');
const trusted = { type: 'pointerdown', isTrusted: true };

function fixture(config = {}, speechOptions = {}) {
  let clock = 0;
  const contexts = [], nodes = [], player = { playing: true, muted: false, volume: .5 };
  function param() {
    return { value: 0, calls: [], setValueAtTime(value, time) { this.calls.push(['set', value, time]); },
      linearRampToValueAtTime(value, time) { this.calls.push(['linear', value, time]); } };
  }
  function node(kind) {
    const n = { kind, connections: [], disconnects: 0,
      connect(target) { this.connections.push(target); return target; },
      disconnect() { this.disconnects++; } };
    nodes.push(n); return n;
  }
  class AudioContext {
    constructor() {
      if (config.constructorFails) throw new Error('Unavailable');
      contexts.push(this); this.state = config.initialState || 'suspended';
      this.currentTime = 10; this.destination = {}; this.resumes = 0; this.closes = 0;
    }
    resume() {
      this.resumes++;
      if (config.resumeThrows) throw new Error('Policy');
      if (config.resumeRejects) return Promise.reject(new Error('Policy'));
      if (config.resumePending) return new Promise(resolve => { this.finishResume = () => { this.state = 'running'; resolve(); }; });
      if (!config.remainSuspended) this.state = 'running';
      return Promise.resolve();
    }
    close() { this.closes++; this.state = 'closed'; return config.closeRejects ? Promise.reject(new Error('Close failed')) : Promise.resolve(); }
    createOscillator() {
      if (config.nodeFails) throw new Error('Audio resource unavailable');
      const n = node('oscillator'); n.frequency = param(); n.starts = []; n.stops = [];
      n.start = time => n.starts.push(time); n.stop = time => n.stops.push(time); return n;
    }
    createBiquadFilter() { if (config.filterFails) throw new Error('Filter unavailable'); const n = node('filter'); n.frequency = param(); n.Q = param(); return n; }
    createGain() { if (config.gainFails) throw new Error('Gain unavailable'); const n = node('gain'); n.gain = param(); return n; }
  }
  const options = Object.assign(Object.create(Object.getPrototypeOf(speechOptions)), speechOptions, {
    AudioContextCtor: AudioContext,
    getPlayerState: Object.hasOwn(config, 'playerState') ? () => config.playerState : () => player,
    now: () => clock,
  });
  const speech = load().createSpeechSound(options);
  return { speech, contexts, nodes, player, setTime(ms) { clock = ms; },
    end() { for (const n of nodes.filter(n => n.kind === 'oscillator')) if (n.onended) n.onended(); } };
}

test('S7: no context before trusted activation intent; resume lazily and record only real running state', async () => {
  const f = fixture();
  assert.equal(f.contexts.length, 0);
  assert.equal(f.speech.snapshot().supported, true);
  assert.equal(f.speech.snapshot().unlocked, false);
  assert.equal(f.speech.playGlyph({ character: 'A', index: 0, mood: 'warm' }), false);
  for (const event of [undefined, {}, { type: 'click', isTrusted: false }, { type: 'mousemove', isTrusted: true }, { type: 'keydown', key: 'Tab', isTrusted: true }]) {
    assert.equal(await f.speech.unlock(event), false);
  }
  assert.equal(f.contexts.length, 0);
  const unlocking = f.speech.unlock(trusted);
  assert.equal(f.contexts.length, 1, 'Constructor stays inside the activation call');
  assert.equal(f.contexts[0].resumes, 1);
  assert.equal(f.speech.playGlyph({ character: 'A', index: 0 }), false, 'Never replay glyphs while resume is pending');
  assert.equal(await unlocking, true);
  assert.equal(f.speech.snapshot().contextState, 'running');
  assert.equal(f.speech.snapshot().unlocked, true);
  assert.equal(f.speech.snapshot().blipsPlayed, 0, 'No deferred backlog');
  f.contexts[0].state = 'suspended';
  assert.equal(f.speech.snapshot().unlocked, false);
  assert.equal(f.speech.playGlyph({ character: 'A', index: 0 }), false);
});

test('S7: unsupported, constructor/resume failures and suspended resume fail silently without nodes', async () => {
  const unsupported = load().createSpeechSound({ AudioContextCtor: null });
  assert.equal(unsupported.snapshot().supported, false);
  assert.equal(await unsupported.unlock(trusted), false);
  assert.equal(unsupported.playGlyph({ character: 'A', index: 0 }), false);
  for (const config of [{ constructorFails: true }, { resumeRejects: true }, { resumeThrows: true }, { remainSuspended: true }]) {
    const f = fixture(config);
    assert.equal(await f.speech.unlock(trusted), false);
    for (let i = 0; i < 10; i++) assert.equal(f.speech.playGlyph({ character: 'A', index: i }), false);
    assert.equal(f.nodes.length, 0); assert.equal(f.speech.snapshot().blipsPlayed, 0);
    await f.speech.destroy();
  }
});

test('S7: overlapping trusted unlocks share one resume; destruction cannot resurrect pending audio', async () => {
  const f = fixture({ resumePending: true });
  const first = f.speech.unlock(trusted), second = f.speech.unlock({ type: 'keydown', key: 'Enter', isTrusted: true });
  assert.equal(f.contexts.length, 1); assert.equal(f.contexts[0].resumes, 1);
  await f.speech.destroy(); f.contexts[0].finishResume();
  assert.equal(await first, false); assert.equal(await second, false);
  assert.equal(f.speech.snapshot().unlocked, false);
  assert.equal(await f.speech.unlock(trusted), false);
  assert.equal(f.speech.playGlyph({ character: 'A', index: 0 }), false);
  assert.equal(f.nodes.length, 0); assert.equal(f.contexts[0].closes, 1);
});

test('S7: only running context plus live playing/unmuted/nonzero volume may sound', async () => {
  const f = fixture(); await f.speech.unlock(trusted);
  for (const state of [{ playing: false, muted: false, volume: .5 }, { playing: true, muted: true, volume: .5 },
    { playing: true, muted: false, volume: 0 }, { playing: true, muted: false, volume: -1 },
    { playing: true, muted: false, volume: NaN }]) {
    Object.assign(f.player, state);
    assert.equal(f.speech.playGlyph({ character: 'A', index: 0 }), false);
    assert.equal(f.nodes.length, 0);
  }
  Object.assign(f.player, { playing: true, muted: false, volume: .25 });
  assert.equal(f.speech.playGlyph({ character: 'A', index: 0 }), true);
  const gain = f.nodes.find(n => n.kind === 'gain');
  assert.equal(Math.max(...gain.gain.calls.map(c => c[1])), .12 * .25);
  f.end(); f.speech.stop(); f.setTime(150); f.player.volume = .75;
  assert.equal(f.speech.playGlyph({ character: 'B', index: 2 }), true);
  assert.equal(Math.max(...f.nodes.filter(n => n.kind === 'gain').at(-1).gain.calls.map(c => c[1])), .12 * .75);
  f.player.muted = true;
  assert.equal(f.speech.playGlyph({ character: 'C', index: 4 }), false);
  assert.equal(f.speech.snapshot().activeNotes, 0, 'Invalid live gate also stops a current note');
});

test('S7: skip punctuation/spaces, at most every second printable letter and minimum 100ms', async () => {
  const f = fixture(); await f.speech.unlock(trusted);
  for (const character of [' ', '.', ',', '?', '!', '…', '🙃', '', 'AB']) {
    assert.equal(f.speech.playGlyph({ character, index: 0 }), false);
  }
  assert.equal(f.nodes.length, 0);
  assert.equal(f.speech.playGlyph({ character: 'A', index: 0 }), true);
  f.end(); f.setTime(70);
  assert.equal(f.speech.playGlyph({ character: 'B', index: 1 }), false);
  f.setTime(99); assert.equal(f.speech.playGlyph({ character: 'C', index: 2 }), false);
  f.setTime(110); assert.equal(f.speech.playGlyph({ character: 'D', index: 3 }), false);
  f.setTime(140); assert.equal(f.speech.playGlyph({ character: '2', index: 4 }), true);
  assert.equal(f.speech.snapshot().blipsPlayed, 2);
  f.end(); f.speech.stop(); f.setTime(150);
  assert.equal(f.speech.playGlyph({ character: 'E', index: 0 }), false, 'Stop must not erase the global 100ms throttle');
});

test('S7/S9: six bounded contextual pitches, own-key fallback and soft filtered click-free envelopes', async () => {
  const frequencies = new Set();
  for (const mood of ['warm', 'playful', 'sleepy', 'curious', 'serious', 'calm', 'constructor', 'toString', '__proto__']) {
    const f = fixture({ initialState: 'running' }); await f.speech.unlock(trusted);
    assert.equal(f.contexts[0].resumes, 0);
    assert.equal(f.speech.playGlyph({ character: 'A', index: 0, mood }), true);
    const [oscillator, filter, gain] = f.nodes;
    assert.ok(['square', 'triangle'].includes(oscillator.type));
    assert.equal(filter.type, 'lowpass');
    assert.deepEqual(oscillator.connections, [filter]); assert.deepEqual(filter.connections, [gain]);
    assert.deepEqual(gain.connections, [f.contexts[0].destination]);
    const frequency = oscillator.frequency.calls[0][1]; assert.ok(frequency >= 480 && frequency <= 920);
    if (['constructor', 'toString', '__proto__'].includes(mood)) assert.equal(frequency, [...frequencies].at(-1));
    else frequencies.add(frequency);
    const start = oscillator.starts[0], end = oscillator.stops[0];
    assert.ok(end - start >= .045 && end - start <= .055 + 1e-9);
    assert.deepEqual(gain.gain.calls[0], ['set', 0, start]);
    assert.equal(gain.gain.calls.at(-1)[1], 0);
    assert.ok(gain.gain.calls[1][2] > start && gain.gain.calls[1][2] - start <= .006);
    assert.ok(gain.gain.calls.every(c => c[1] >= 0 && c[1] <= .12 * .5));
    assert.ok(gain.gain.calls.at(-1)[2] < end, 'Fade reaches zero before oscillator stops');
    await f.speech.destroy();
  }
  assert.equal(frequencies.size, 6);
});

test('S7: onended/stop/destroy release only owned nodes; failures never propagate to text', async () => {
  const f = fixture({ closeRejects: true }); await f.speech.unlock(trusted);
  f.speech.playGlyph({ character: 'A', index: 0 }); assert.equal(f.speech.snapshot().activeNotes, 1);
  f.end(); assert.equal(f.speech.snapshot().activeNotes, 0);
  assert.ok(f.nodes.every(n => n.disconnects === 1));
  f.speech.stop(); f.setTime(150); f.speech.playGlyph({ character: 'B', index: 0 });
  const oscillator = f.nodes.filter(n => n.kind === 'oscillator').at(-1);
  f.speech.stop(); assert.equal(f.speech.snapshot().activeNotes, 0); assert.equal(oscillator.stops.length, 2);
  assert.ok(f.nodes.every(n => n.disconnects === 1));
  await f.speech.destroy(); await f.speech.destroy();
  assert.equal(f.contexts[0].closes, 1); assert.equal(await f.speech.unlock(trusted), false);
  assert.equal(f.speech.playGlyph({ character: 'C', index: 0 }), false);
  for (const config of [{ nodeFails: true }, { filterFails: true }, { gainFails: true }]) {
    const failed = fixture(config); await failed.speech.unlock(trusted);
    assert.equal(failed.speech.playGlyph({ character: 'A', index: 0 }), false);
    assert.equal(failed.speech.snapshot().activeNotes, 0);
    assert.ok(failed.nodes.every(n => n.disconnects === 1), 'Release a partially allocated graph too');
  }
});

test('S7: classic browser export is side-effect free and never installs DOM handlers', () => {
  const source = fs.readFileSync(path.join(__dirname, '../home-companion-speech.js'), 'utf8');
  assert.doesNotMatch(source, /addEventListener|document\./);
  const context = vm.createContext({ AudioContext() { throw new Error('No eager construction'); } });
  vm.runInContext(source, context);
  assert.equal(typeof context.HomeCompanionSpeech.createSpeechSound, 'function');
  assert.equal(context.HomeCompanionSpeech.createSpeechSound().snapshot().activeNotes, 0);
});

test('S9: prior paused-player default remains; inherited or non-false options cannot opt out', async () => {
  const inherited = Object.create({ requirePlaying: false });
  for (const options of [{}, { requirePlaying: true }, { requirePlaying: undefined },
    { requirePlaying: null }, { requirePlaying: 0 }, { requirePlaying: 'false' }, inherited]) {
    const f = fixture({}, options); f.player.playing = false;
    await f.speech.unlock(trusted);
    assert.equal(f.speech.playGlyph({ character: 'A', index: 0 }), false);
    assert.equal(f.nodes.length, 0);
    f.player.playing = true;
    assert.equal(f.speech.playGlyph({ character: 'A', index: 0 }), true, 'Default still permits ordinary playing music');
    await f.speech.destroy();
  }
});

test('S9: own explicit false permits paused music but mute/zero/missing player always gate and clean up', async () => {
  const f = fixture({}, { requirePlaying: false }); f.player.playing = false;
  await f.speech.unlock(trusted);
  assert.equal(f.speech.playGlyph({ character: 'A', index: 0 }), true, 'HOME can speak with its song paused');
  f.player.muted = true;
  assert.equal(f.speech.playGlyph({ character: 'B', index: 1 }), false);
  assert.equal(f.speech.snapshot().activeNotes, 0, 'Mute interrupts the paused-song voice too');
  f.player.muted = false; f.player.volume = 0; f.setTime(150);
  assert.equal(f.speech.playGlyph({ character: 'C', index: 2 }), false);
  f.player.volume = .25;
  assert.equal(f.speech.playGlyph({ character: 'D', index: 3 }), true);
  const gain = f.nodes.filter(n => n.kind === 'gain').at(-1);
  assert.equal(Math.max(...gain.gain.calls.map(c => c[1])), .12 * .25, 'Use current shared volume, not a forced speech volume');
  f.player.volume = 0;
  assert.equal(f.speech.playGlyph({ character: 'E', index: 4 }), false);
  assert.equal(f.speech.snapshot().activeNotes, 0);
  assert.ok(f.nodes.every(n => n.disconnects === 1));
  await f.speech.destroy();
  for (const playerState of [null, undefined, {}, { playing: false, muted: false }]) {
    const missing = fixture({ playerState }, { requirePlaying: false });
    await missing.speech.unlock(trusted);
    assert.equal(missing.speech.playGlyph({ character: 'A', index: 0 }), false);
    assert.equal(missing.nodes.length, 0);
    await missing.speech.destroy();
  }
});

test('S10: doubled nominal speech gain at 50% volume, bounded pitches and soft short envelopes', async () => {
  for (const mood of ['warm', 'playful', 'sleepy', 'curious', 'serious', 'calm']) {
    const f = fixture({ initialState: 'running' }); await f.speech.unlock(trusted);
    f.speech.playGlyph({ character: 'A', index: 0, mood });
    const [oscillator, filter, gain] = f.nodes;
    const peak = Math.max(...gain.gain.calls.map(c => c[1]));
    assert.ok(peak >= .059 && peak <= .06, 'Requested step doubles the prior .03 nominal peak without changing shared volume');
    assert.ok(filter.frequency.calls[0][1] >= 2000 && filter.frequency.calls[0][1] <= 2400);
    assert.ok(oscillator.frequency.calls[0][1] >= 480 && oscillator.frequency.calls[0][1] <= 920);
    const duration = oscillator.stops[0] - oscillator.starts[0];
    assert.ok(duration >= .045 && duration <= .055 + 1e-9);
    assert.equal(gain.gain.calls[0][1], 0); assert.equal(gain.gain.calls.at(-1)[1], 0);
    await f.speech.destroy();
  }
});

test('S9: paused opt-out never bypasses trusted consent, suspension or destroy', async () => {
  const f = fixture({}, { requirePlaying: false }); f.player.playing = false;
  assert.equal(f.speech.playGlyph({ character: 'A', index: 0 }), false);
  assert.equal(await f.speech.unlock({ type: 'click', isTrusted: false }), false);
  assert.equal(f.contexts.length, 0);
  await f.speech.unlock(trusted); f.contexts[0].state = 'suspended';
  assert.equal(f.speech.playGlyph({ character: 'A', index: 0 }), false);
  assert.equal(f.nodes.length, 0);
  await f.speech.destroy(); f.contexts[0].state = 'running';
  assert.equal(await f.speech.unlock(trusted), false);
  assert.equal(f.speech.playGlyph({ character: 'A', index: 0 }), false);
});

test('persistent owner probe observes native running without resume, notes or eager creation', async () => {
  const allowed = fixture({ initialState: 'running' });
  assert.equal(allowed.speech.getNativeContext(), null);
  assert.equal(await allowed.speech.probe(), true);
  assert.equal(allowed.contexts.length, 1); assert.equal(allowed.contexts[0].resumes, 0);
  assert.equal(allowed.speech.getNativeContext(), allowed.contexts[0]); assert.equal(allowed.nodes.length, 0);
  const blocked = fixture(); assert.equal(await blocked.speech.probe(), false);
  assert.equal(blocked.contexts[0].resumes, 0); assert.equal(blocked.nodes.length, 0);
  await blocked.speech.destroy(); assert.equal(await blocked.speech.probe(), false);
});

test('bound voice shares an authorized owner without creating, resuming or closing its context', async () => {
  const owner = fixture({ initialState: 'running' });
  await owner.speech.probe();
  const voice = load().createBoundSpeechSound({ getContext: () => owner.speech.getNativeContext(),
    isAuthorized: () => owner.speech.snapshot().unlocked, getPlayerState: () => owner.player, now: () => 200 });
  assert.equal(await voice.unlock(), true);
  assert.equal(voice.playGlyph({ character: 'A', index: 0 }), true);
  assert.equal(owner.contexts.length, 1); assert.equal(owner.contexts[0].resumes, 0);
  await voice.destroy(); assert.equal(voice.snapshot().activeNotes, 0);
  assert.equal(owner.contexts[0].closes, 0); assert.equal(owner.contexts[0].state, 'running');
  await owner.speech.destroy(); assert.equal(owner.contexts[0].closes, 1);
  assert.throws(() => load().createBoundSpeechSound({}), TypeError);
});
