const { test } = require('node:test');
const assert = require('node:assert/strict');
const SpeechAPI = require('../home-companion-speech.js');
const playlist = [
  { src: 'assets/music/one.mp3', title: 'One', artist: 'Artist' },
  { src: 'assets/music/two.mp3', title: 'Two', artist: 'Artist' },
];
const trusted = { type: 'click', isTrusted: true };
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function fixture(config = {}) {
  const media = [], contexts = [], nodes = [], values = new Map(Object.entries(config.saved || {}));
  let clock = 0;
  class Media extends EventTarget {
    constructor() { super(); this.paused = true; this.ended = false; this.currentTime = 0; this.duration = NaN; this.volume = .5; this.muted = false; this.plays = 0; this.pauses = 0; this._src = ''; media.push(this); }
    get src() { return this._src; }
    set src(value) { this._src = value; this.ended = false; this.currentTime = 0; }
    play() { this.plays++; if (config.playFails) return Promise.reject(Object.assign(new Error('Blocked'), { name: config.playFailureName || 'NotAllowedError' })); this.paused = false; this.ended = false; this.dispatchEvent(new Event('play')); return config.playDeferred ? config.playDeferred.promise : Promise.resolve(); }
    pause() { this.pauses++; this.paused = true; this.dispatchEvent(new Event('pause')); }
    load() {}
  }
  const parameter = () => ({ value: 0, setValueAtTime(v) { this.value = v; }, linearRampToValueAtTime(v) { this.value = v; }, cancelScheduledValues() {} });
  function node(kind) { const n = { kind, frequency: parameter(), Q: parameter(), gain: parameter(), connects: [], disconnects: 0,
    connect(other) { this.connects.push(other); return other; }, disconnect() { this.disconnects++; }, start() { this.started = true; }, stop() { this.stopped = true; } }; nodes.push(n); return n; }
  class Context extends EventTarget {
    constructor() { super(); this.state = config.contextState || 'suspended'; this.currentTime = 0; this.destination = {}; this.resumes = 0; this.closes = 0; contexts.push(this); }
    resume() { this.resumes++; if (config.resumeFails) return Promise.reject(new Error('Blocked')); if (config.resumeDeferred) return config.resumeDeferred.promise.then(() => { this.state = 'running'; }); this.state = 'running'; return Promise.resolve(); }
    close() { this.closes++; this.state = 'closed'; return Promise.resolve(); }
    createOscillator() { if (config.oscillatorFails) throw new Error('Native oscillator unavailable'); return node('oscillator'); }
    createGain() { if (config.gainFails) throw new Error('Native gain unavailable'); return node('gain'); }
    createBiquadFilter() { if (config.filterFails) throw new Error('Native filter unavailable'); return node('filter'); }
  }
  const storage = { getItem(key) { if (config.storageFails) throw new Error('Opaque storage'); return values.get(key) ?? null; }, setItem(key, value) { if (config.storageFails) throw new Error('Opaque storage'); values.set(key, String(value)); } };
  const engine = require('../site-audio-engine.js').createEngine({ SpeechAPI, playlist,
    baseURL: 'file:///site/index.html', AudioCtor: Media, AudioContextCtor: config.unsupported ? null : Context,
    storage, now: () => clock, random: () => 0 });
  return { engine, media, contexts, nodes, values, setTime(value) { clock = value; } };
}

test('S2/S5: stable initial snapshots, one pair of native media, lazy no-note allowed/blocked probe', async () => {
  const f = fixture({ contextState: 'running' });
  const s = f.engine.snapshot(); assert.equal(s.permission, 'blocked'); assert.equal(f.contexts.length, 0);
  assert.equal(s.music.index, 0); assert.equal(s.music.duration, null); assert.equal(s.favorite.duration, null);
  assert.equal(s.favorite.paused, true); assert.equal(f.media.length, 2);
  assert.equal(await f.engine.probe(), true); assert.equal(f.engine.snapshot().permission, 'active');
  assert.equal(f.contexts.length, 1); assert.equal(f.contexts[0].resumes, 0); assert.equal(f.nodes.length, 0);
  assert.equal(f.media[0].plays, 0, 'Probe does not force paused music');
  const g = fixture(); assert.equal(await g.engine.probe(), false); assert.equal(g.contexts[0].resumes, 0);
  assert.equal(g.engine.snapshot().permission, 'blocked');
});

test('S2: trusted unlock starts native resume/music in same call; play ACK waits native promise', async () => {
  const pending = deferred(), f = fixture({ saved: { isPlaying: 'true' }, playDeferred: pending });
  assert.equal(await f.engine.unlock({ type: 'click', isTrusted: false }), false); assert.equal(f.contexts.length, 0);
  const unlocking = f.engine.unlock(trusted);
  assert.equal(f.contexts.length, 1); assert.equal(f.contexts[0].resumes, 1); assert.equal(f.media[0].plays, 1);
  let done = false; unlocking.then(() => { done = true; }); await Promise.resolve(); assert.equal(done, false);
  pending.resolve(); assert.equal(await unlocking, true); assert.equal(f.engine.snapshot().permission, 'active');
});

test('S2/S4: silent escape invalidates late unlock, disables FX, but manual music stays usable', async () => {
  const pending = deferred(), f = fixture({ resumeDeferred: pending });
  const unlock = f.engine.unlock(trusted); f.engine.continueSilent(); pending.resolve();
  assert.equal(await unlock, false); assert.equal(f.engine.snapshot().permission, 'silent');
  assert.equal(await f.engine.execute({ type: 'chime', frequency: 520 }, 'route:1'), false);
  assert.equal(f.nodes.length, 0);
  await f.engine.execute({ type: 'music', action: 'play' }, 'route:1'); assert.equal(f.media[0].paused, false);
  assert.equal(f.engine.snapshot().permission, 'silent');
});

test('S2: unsupported/rejected native audio is observable and has a silent escape', async () => {
  const unsupported = fixture({ unsupported: true }); assert.equal(await unsupported.engine.probe(), false);
  assert.equal(unsupported.engine.snapshot().permission, 'unsupported'); unsupported.engine.continueSilent();
  assert.equal(unsupported.engine.snapshot().permission, 'silent');
  const blocked = fixture({ contextState: 'running', playFails: true }); await blocked.engine.probe();
  await assert.rejects(blocked.engine.execute({ type: 'music', action: 'play' }, 'route:1'), { name: 'NotAllowedError' });
  assert.equal(blocked.engine.snapshot().permission, 'blocked');
});

test('S5: native metadata/time/volume snapshots and storage have one authority; storage failure is safe', async () => {
  const f = fixture({ saved: { npIndex: '1', npTime: '12', npVolume: '.3' } });
  assert.equal(f.engine.snapshot().music.index, 1); assert.equal(f.media[0].volume, .3);
  f.media[0].duration = 120; f.media[0].dispatchEvent(new Event('loadedmetadata'));
  assert.equal(f.media[0].currentTime, 12);
  await f.engine.execute({ type: 'music', action: 'seek', value: 200 }, 'route:1'); assert.equal(f.media[0].currentTime, 120);
  await f.engine.execute({ type: 'music', action: 'volume', value: .7 }, 'route:1'); assert.equal(f.values.get('npVolume'), '.7'.replace(/^\./, '0.'));
  f.media[0].currentTime = 45; f.media[0].dispatchEvent(new Event('timeupdate')); assert.equal(f.values.get('npTime'), '45');
  const broken = fixture({ storageFails: true }); assert.equal(broken.engine.snapshot().music.volume, .5);
  await broken.engine.execute({ type: 'music', action: 'volume', value: .2 }, 'route:1');
});

test('S5: next/prev/select are bounded; duplicate ended does not skip two tracks', async () => {
  const f = fixture({ contextState: 'running' }); await f.engine.probe(); await f.engine.execute({ type: 'music', action: 'play' }, 'route:1');
  f.media[0].ended = true; f.media[0].dispatchEvent(new Event('ended')); f.media[0].dispatchEvent(new Event('ended'));
  await Promise.resolve(); assert.equal(f.engine.snapshot().music.index, 1);
  await f.engine.execute({ type: 'music', action: 'prev' }, 'route:1'); assert.equal(f.engine.snapshot().music.index, 0);
});

test('S4/S5: native play acknowledgement and stale play failures cannot clobber newer pause/selection', async () => {
  const pending = deferred(), f = fixture({ contextState: 'running', playDeferred: pending }); await f.engine.probe();
  const play = f.engine.execute({ type: 'music', action: 'play' }, 'route:1');
  await f.engine.execute({ type: 'music', action: 'pause' }, 'route:1'); pending.resolve();
  await assert.rejects(play, { name: 'AbortError' }); assert.equal(f.engine.snapshot().music.paused, true);
});

test('S4/S5: lease navigation keeps main alive; favorite resumes only a previously requested main', async () => {
  const f = fixture({ contextState: 'running' }); await f.engine.probe();
  await f.engine.execute({ type: 'favorite', action: 'play' }, 'route:1'); assert.equal(f.media[0].paused, true);
  f.engine.releaseLease('route:1'); await Promise.resolve(); assert.equal(f.media[0].plays, 0);
  await f.engine.execute({ type: 'music', action: 'play' }, 'route:2');
  await f.engine.execute({ type: 'favorite', action: 'volume', value: .2 }, 'route:2');
  await f.engine.execute({ type: 'favorite', action: 'play' }, 'route:2'); assert.equal(f.media[1].volume, .2);
  f.engine.releaseLease('route:2'); await Promise.resolve(); assert.equal(f.media[1].paused, true); assert.equal(f.media[0].paused, false);
  const plays = f.media[0].plays; f.engine.releaseLease('route:unused'); assert.equal(f.media[0].plays, plays);
});

test('S4/S5: bound voices and synth/tuner/chime share one context; releasing one lease cannot close it', async () => {
  const f = fixture({ contextState: 'running' }); await f.engine.probe();
  assert.equal(await f.engine.execute({ type: 'speech', action: 'glyph', character: 'A', index: 0, mood: 'warm', voiceId: 'shurelia' }, 'route:1'), true);
  await f.engine.execute({ type: 'synth', action: 'start', frequency: 440, wave: 'sine', filter: 1200 }, 'route:1');
  await f.engine.execute({ type: 'tuner', action: 'start', frequency: 220 }, 'route:2');
  await f.engine.execute({ type: 'chime', frequency: 520 }, 'route:2');
  assert.equal(f.contexts.length, 1); assert.equal(f.engine.snapshot().speech.activeNotes, 1);
  f.engine.releaseLease('route:1'); assert.equal(f.engine.snapshot().speech.activeNotes, 0); assert.equal(f.contexts[0].closes, 0);
  await f.engine.destroy(); assert.equal(f.contexts[0].closes, 1); assert.ok(f.nodes.every(n => n.disconnects > 0));
});

test('S4: independently reject malformed commands, numbers, mood/prototype keys and voice IDs', async () => {
  const f = fixture({ contextState: 'running' }); await f.engine.probe();
  for (const command of [null, [], { type: 'music', action: 'select', value: 99 }, { type: 'music', action: 'volume', value: NaN },
    { type: 'music', action: 'mute', value: 'false' }, { type: 'music', action: 'play', isTrusted: true },
    { type: 'favorite', action: 'play', value: 'https://example.com/track.mp3' },
    { type: 'synth', action: 'start', frequency: Infinity }, { type: 'synth', action: 'start', frequency: 440, wave: '__proto__' },
    { type: 'speech', action: 'glyph', character: 'A', mood: 'constructor' },
    { type: 'speech', action: 'glyph', character: 'A', voiceId: '../escape' }]) {
    await assert.rejects(f.engine.execute(command, 'route:1'));
  }
  assert.equal(f.nodes.length, 0);
});

test('S2/S4: blocked FX create no context/note backlog; mute/zero stop notes; destroy is final', async () => {
  const f = fixture();
  await assert.rejects(f.engine.execute({ type: 'chime', frequency: 520 }, 'route:1'), { name: 'NotAllowedError' });
  assert.equal(f.contexts.length, 0); assert.equal(f.nodes.length, 0); await f.engine.unlock(trusted);
  await f.engine.execute({ type: 'synth', action: 'start', frequency: 440 }, 'route:1');
  await f.engine.execute({ type: 'music', action: 'mute', value: true }, 'route:1'); assert.ok(f.nodes.every(n => n.disconnects > 0));
  assert.equal(await f.engine.execute({ type: 'chime', frequency: 520 }, 'route:1'), false);
  await f.engine.destroy(); assert.equal(await f.engine.unlock(trusted), false);
  await assert.rejects(f.engine.execute({ type: 'music', action: 'play' }, 'route:1'), { name: 'AbortError' });
});

test('S5: subscriptions are disposable, monotonic and snapshots do not expose native objects', async () => {
  const f = fixture(); const revisions = []; const remove = f.engine.subscribe(s => revisions.push(s.revision));
  await f.engine.execute({ type: 'music', action: 'volume', value: .2 }, 'route:1');
  assert.ok(revisions.length > 0); assert.ok(revisions.every((n, i) => !i || n > revisions[i - 1]));
  const before = revisions.length; remove(); await f.engine.execute({ type: 'music', action: 'volume', value: .3 }, 'route:1'); assert.equal(revisions.length, before);
  const state = JSON.parse(JSON.stringify(f.engine.snapshot())); assert.equal(state.music.volume, .3); assert.equal('destination' in state.speech, false);
});

test('S5: favorite pause preserves its position; stop resets it without forcing previously paused main', async () => {
  const f = fixture({ contextState: 'running' }); await f.engine.probe();
  await f.engine.execute({ type: 'favorite', action: 'play' }, 'route:1'); f.media[1].currentTime = 23;
  await f.engine.execute({ type: 'favorite', action: 'pause' }, 'route:1');
  assert.equal(f.media[1].currentTime, 23); assert.equal(f.media[0].plays, 0);
  await f.engine.execute({ type: 'favorite', action: 'stop' }, 'route:1'); assert.equal(f.media[1].currentTime, 0);
});

test('S4: optional defaults do not accept explicit null numeric/enum/voice fields', async () => {
  const f = fixture({ contextState: 'running' }); await f.engine.probe();
  for (const command of [
    { type: 'speech', action: 'glyph', character: 'A', voiceId: null },
    { type: 'speech', action: 'glyph', character: 'A', index: null },
    { type: 'speech', action: 'glyph', character: 'A', mood: null },
    { type: 'synth', action: 'start', frequency: 440, wave: null },
    { type: 'synth', action: 'start', frequency: 440, filter: null },
    { type: 'chime', frequency: null },
  ]) await assert.rejects(f.engine.execute(command, 'route:1'));
  assert.equal(f.nodes.length, 0);
});

test('S4/S6: partial native FX allocation releases every owned node and preserves native error', async () => {
  for (const [config, message] of [[{ oscillatorFails: true }, 'Native oscillator unavailable'],
    [{ gainFails: true }, 'Native gain unavailable'], [{ filterFails: true }, 'Native filter unavailable']]) {
    const f = fixture({ contextState: 'running', ...config }); await f.engine.probe();
    await assert.rejects(f.engine.execute({ type: 'synth', action: 'start', frequency: 440 }, 'route:1'), { message });
    assert.ok(f.nodes.every(n => n.disconnects > 0)); assert.equal(f.contexts[0].closes, 0);
  }
});

test('S2/S6: native unsupported media remains unsupported through probe/unlock completion', async () => {
  const f = fixture({ contextState: 'running', saved: { isPlaying: 'true' }, playFails: true, playFailureName: 'NotSupportedError' });
  assert.equal(await f.engine.probe(), false); assert.equal(f.engine.snapshot().permission, 'unsupported');
  assert.equal(await f.engine.unlock(trusted), false); assert.equal(f.engine.snapshot().permission, 'unsupported');
});
