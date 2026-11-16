// Parent-owned media, permission and FX authority. Never serializes native objects.
(function (host, factory) {
  const api = factory(host);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else host.SiteAudioEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (host) {
  'use strict';
  const moods = new Set(['warm', 'playful', 'sleepy', 'curious', 'serious', 'calm']);
  const waves = new Set(['sine', 'square', 'sawtooth', 'triangle']);
  const activationTypes = new Set(['click', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchend', 'keydown']);
  const error = (name, message) => Object.assign(new Error(message), { name });
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const trusted = event => event?.isTrusted === true && activationTypes.has(event.type)
    && (event.type !== 'keydown' || ['Enter', ' ', 'Spacebar'].includes(event.key));

  function createEngine(options = {}) {
    const win = options.window || host;
    const SpeechAPI = options.SpeechAPI || win.HomeCompanionSpeech;
    const AudioCtor = Object.hasOwn(options, 'AudioCtor') ? options.AudioCtor : win.Audio;
    const AudioContextCtor = Object.hasOwn(options, 'AudioContextCtor') ? options.AudioContextCtor : win.AudioContext || win.webkitAudioContext;
    const baseURL = options.baseURL || win.location?.href || 'http://localhost/index.html';
    const playlist = (options.playlist || []).map(track => ({ ...track, src: new URL(track.src, baseURL).href }));
    if (!playlist.length || playlist.length > 64 || playlist.some(track => !track.title || !track.artist)) throw new TypeError('A bounded local playlist is required');
    const favoriteURL = new URL('assets/music/vivarium.mp3', baseURL).href;
    const random = options.random || Math.random;
    let storage;
    try { storage = Object.hasOwn(options, 'storage') ? options.storage : win.localStorage; } catch (_) { storage = null; }
    const read = key => { try { return storage?.getItem(key); } catch (_) { return null; } };
    const write = (key, value) => { try { storage?.setItem(key, String(value)); } catch (_) {} };
    const savedNumber = (key, fallback, min, max) => {
      const value = read(key); const n = value === null || value === undefined || value === '' ? NaN : Number(value);
      return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
    };
    let index = savedNumber('npIndex', Math.floor(Math.max(0, Math.min(.99999, random())) * playlist.length), 0, playlist.length - 1);
    if (!Number.isInteger(index)) index = 0;
    let desiredPlaying = read('isPlaying') === 'true';
    let pendingSeek = savedNumber('npTime', 0, 0, 864000);
    let permission = 'blocked', revision = 0, destroyed = false, silentFX = false;
    let activationTurn = 0, musicTurn = 0, favoriteTurn = 0, favoriteLease = null, favoriteResume = false;
    let endedGuard = false, blipsPlayed = 0, contextObserved = null;
    const subscribers = new Set(), leases = new Map(), cleanups = [];
    const music = makeMedia(), favorite = makeMedia();
    function makeMedia() { try { return typeof AudioCtor === 'function' ? new AudioCtor() : null; } catch (_) { return null; } }
    if (music) { music.preload = 'metadata'; music.volume = savedNumber('npVolume', .5, 0, 1); music.muted = read('npMuted') === 'true'; }
    if (favorite) { favorite.preload = 'metadata'; favorite.src = favoriteURL; favorite.volume = savedNumber('favoriteVolume', .5, 0, 1); favorite.muted = !!music?.muted; }
    const owner = SpeechAPI?.createSpeechSound?.({ AudioContextCtor, requirePlaying: false, now: options.now,
      getPlayerState: () => ({ playing: !!music && !music.paused, muted: !music || music.muted, volume: music?.volume || 0 }) });
    const supported = !!music && !!favorite && !!owner?.snapshot().supported;
    const nativeContext = () => owner?.getNativeContext() || null;
    const contextRunning = () => nativeContext()?.state === 'running';
    const fxAllowed = () => !destroyed && !silentFX && permission === 'active' && contextRunning();
    const duration = media => finite(media?.duration) && media.duration >= 0 ? media.duration : null;
    const mediaState = (media, extra = {}) => ({ ...extra, src: media?.src || extra.src || '', paused: media?.paused !== false,
      playing: media?.paused === false && !media.ended, ended: !!media?.ended,
      currentTime: finite(media?.currentTime) ? Math.max(0, media.currentTime) : 0,
      duration: duration(media), volume: finite(media?.volume) ? media.volume : .5, muted: !!media?.muted });
    function snapshot() {
      let activeNotes = 0;
      for (const lease of leases.values()) for (const voice of lease.voices.values()) activeNotes += voice.snapshot().activeNotes;
      const ownerState = owner?.snapshot();
      return { revision, permission, contextState: ownerState?.contextState || 'unsupported',
        music: mediaState(music, { index, title: playlist[index].title, artist: playlist[index].artist, src: playlist[index].src }),
        favorite: mediaState(favorite, { src: favoriteURL }),
        speech: { supported: !!ownerState?.supported, unlocked: fxAllowed(), contextState: ownerState?.contextState || 'unsupported', activeNotes, blipsPlayed } };
    }
    function emit() {
      revision++;
      const state = snapshot();
      for (const callback of [...subscribers]) { try { callback(state); } catch (_) {} }
    }
    function listen(target, name, fn) {
      if (!target?.addEventListener) return;
      target.addEventListener(name, fn); cleanups.push(() => target.removeEventListener(name, fn));
    }
    function classifyFailure(reason) {
      if (destroyed) return;
      if (reason?.name === 'NotAllowedError' || reason?.name === 'SecurityError') { permission = 'blocked'; stopAllFX(); emit(); }
      else if (reason?.name === 'NotSupportedError') { permission = 'unsupported'; stopAllFX(); emit(); }
    }
    function observeContext() {
      const context = nativeContext();
      if (!context || context === contextObserved) return;
      contextObserved = context;
      listen(context, 'statechange', () => {
        if (destroyed) return;
        if (context.state !== 'running' && permission === 'active') { permission = context.state === 'closed' ? 'unsupported' : 'blocked'; stopAllFX(); }
        emit();
      });
    }
    function setSource(nextIndex) {
      musicTurn++; index = nextIndex; pendingSeek = 0;
      if (music) music.src = playlist[index].src;
      write('npIndex', index); write('npTime', 0); emit();
    }
    function applySeek() {
      if (!music || pendingSeek === null) return;
      try { music.currentTime = duration(music) === null ? pendingSeek : Math.min(pendingSeek, music.duration); }
      catch (_) { return; }
      if (duration(music) !== null) pendingSeek = null;
    }
    if (music) { music.src = playlist[index].src; applySeek(); }
    function playMusic() {
      if (!music) return Promise.reject(error('NotSupportedError', 'Native media unavailable'));
      const turn = ++musicTurn;
      let result;
      try { result = music.play(); } catch (reason) { classifyFailure(reason); return Promise.reject(reason); }
      return Promise.resolve(result).then(() => {
        if (destroyed || turn !== musicTurn) {
          if (!desiredPlaying || destroyed) music.pause();
          throw error('AbortError', 'Superseded music request');
        }
        if (!music.ended) endedGuard = false;
        write('isPlaying', desiredPlaying); emit(); return true;
      }, reason => { if (!destroyed && turn === musicTurn) classifyFailure(reason); throw reason; });
    }
    function pauseMusic(reset = false) {
      musicTurn++; desiredPlaying = false; favoriteResume = false; music?.pause();
      if (reset && music) { pendingSeek = 0; try { music.currentTime = 0; } catch (_) {} }
      write('isPlaying', false); if (reset) write('npTime', 0); emit();
    }
    function stopFavorite(resume, reset = true) {
      favoriteTurn++; const shouldResume = resume && favoriteResume && desiredPlaying;
      favoriteLease = null; favoriteResume = false; favorite?.pause();
      if (favorite && reset) { try { favorite.currentTime = 0; } catch (_) {} }
      emit();
      if (shouldResume && !destroyed) playMusic().catch(() => {});
    }
    function playFavorite(lease) {
      if (!favorite) return Promise.reject(error('NotSupportedError', 'Native media unavailable'));
      if (favoriteLease === null) favoriteResume = desiredPlaying;
      favoriteLease = lease; musicTurn++; music?.pause();
      const turn = ++favoriteTurn;
      let result;
      try { result = favorite.play(); } catch (reason) { classifyFailure(reason); return Promise.reject(reason); }
      return Promise.resolve(result).then(() => {
        if (destroyed || turn !== favoriteTurn) { if (destroyed || favoriteLease === null) favorite.pause(); throw error('AbortError', 'Superseded favorite request'); }
        emit(); return true;
      }, reason => { if (!destroyed && turn === favoriteTurn) classifyFailure(reason); throw reason; });
    }
    async function probe() {
      if (destroyed || silentFX) return false;
      const turn = ++activationTurn;
      if (!supported) { permission = 'unsupported'; emit(); return false; }
      const native = owner.probe(); observeContext();
      try {
        const allowed = await native;
        if (destroyed || turn !== activationTurn) return false;
        if (!allowed || !contextRunning()) { permission = nativeContext() ? 'blocked' : 'unsupported'; emit(); return false; }
        if (desiredPlaying && favoriteLease === null) await playMusic();
        if (destroyed || turn !== activationTurn) return false;
        permission = 'active'; emit(); return true;
      } catch (_) { if (turn === activationTurn && !destroyed) { if (permission !== 'unsupported') permission = 'blocked'; emit(); } return false; }
    }
    function unlock(event) {
      if (destroyed || !trusted(event)) return Promise.resolve(false);
      const turn = ++activationTurn;
      if (!supported) { permission = 'unsupported'; emit(); return Promise.resolve(false); }
      // Both calls occur before the first await, in the actual parent's gesture.
      const native = owner.unlock(event); observeContext();
      const playback = desiredPlaying && favoriteLease === null ? playMusic() : Promise.resolve(true);
      return Promise.all([native, playback]).then(([allowed]) => {
        if (destroyed || turn !== activationTurn) return false;
        permission = allowed && contextRunning() ? (silentFX ? 'silent' : 'active') : 'blocked';
        emit(); return permission === 'active' || permission === 'silent';
      }, () => { if (!destroyed && turn === activationTurn) { if (permission !== 'unsupported') permission = 'blocked'; emit(); } return false; });
    }
    function continueSilent() {
      if (destroyed) return;
      activationTurn++; silentFX = true; permission = 'silent'; stopAllFX();
      stopFavorite(false); pauseMusic(); emit();
    }
    function leaseState(name) {
      if (!leases.has(name)) {
        if (leases.size >= 64) throw error('RangeError', 'Too many effect leases');
        leases.set(name, { voices: new Map(), synth: null, tuner: null, chimes: new Set() });
      }
      return leases.get(name);
    }
    function disposeTone(note) {
      if (!note || note.disposed) return;
      note.disposed = true;
      if (note.oscillator) note.oscillator.onended = null;
      for (const oscillator of [note.oscillator, note.lfo]) { try { oscillator?.stop(); } catch (_) {} }
      for (const node of [note.oscillator, note.filter, note.gain, note.lfo, note.lfoGain]) { try { node?.disconnect(); } catch (_) {} }
      note.onDispose?.();
    }
    function stopLeaseFX(state) {
      for (const voice of state.voices.values()) voice.stop();
      disposeTone(state.synth); state.synth = null; disposeTone(state.tuner); state.tuner = null;
      for (const note of [...state.chimes]) disposeTone(note);
    }
    function stopAllFX() { for (const state of leases.values()) stopLeaseFX(state); }
    function requireFX() {
      if (silentFX) return null;
      if (!supported) { permission = 'unsupported'; emit(); throw error('NotSupportedError', 'Web Audio unavailable'); }
      if (!fxAllowed()) { permission = 'blocked'; emit(); throw error('NotAllowedError', 'Native audio activation required'); }
      if (!music || music.muted || music.volume <= 0) return null;
      return nativeContext();
    }
    function tone(kind, command, state) {
      const context = requireFX(); if (!context) return false;
      const note = { oscillator: null, filter: null, gain: null, lfo: null, lfoGain: null, disposed: false };
      try {
        note.oscillator = context.createOscillator(); note.gain = context.createGain();
        const start = context.currentTime, volume = music.volume;
        note.baseGain = kind === 'synth' ? .05 : kind === 'tuner' ? .08 : .06;
        note.oscillator.type = kind === 'synth' ? command.wave : kind === 'tuner' ? 'sine' : 'triangle';
        note.oscillator.frequency.setValueAtTime(command.frequency, start);
        note.gain.gain.setValueAtTime(kind === 'tuner' ? 0 : note.baseGain * volume, start);
        if (kind === 'tuner') note.gain.gain.linearRampToValueAtTime(note.baseGain * volume, start + .05);
        if (kind === 'synth') {
          note.filter = context.createBiquadFilter(); note.filter.type = 'lowpass';
          note.filter.frequency.setValueAtTime(command.filter, start); note.filter.Q.setValueAtTime(5, start);
          note.oscillator.connect(note.filter); note.filter.connect(note.gain);
          if (command.wave === 'sine') {
            note.lfo = context.createOscillator(); note.lfoGain = context.createGain();
            note.lfo.frequency.setValueAtTime(6, start); note.lfoGain.gain.setValueAtTime(30, start);
            note.lfo.connect(note.lfoGain); note.lfoGain.connect(note.oscillator.frequency); note.lfo.start(start);
          }
        } else note.oscillator.connect(note.gain);
        note.gain.connect(context.destination);
        note.oscillator.onended = () => { disposeTone(note); emit(); };
        note.oscillator.start(start);
        if (kind === 'chime') {
          note.gain.gain.linearRampToValueAtTime(0, start + .18);
          note.onDispose = () => state.chimes.delete(note); state.chimes.add(note); note.oscillator.stop(start + .2);
        } else state[kind] = note;
        emit(); return true;
      } catch (reason) { disposeTone(note); throw reason; }
    }
    function updateMasterFX() {
      if (!music || music.muted || music.volume <= 0) stopAllFX();
      else for (const state of leases.values()) {
        for (const voice of state.voices.values()) voice.stop();
        for (const note of state.chimes) disposeTone(note);
        for (const note of [state.synth, state.tuner]) if (note && !note.disposed) {
          try { note.gain.gain.cancelScheduledValues(nativeContext().currentTime); note.gain.gain.setValueAtTime(note.baseGain * music.volume, nativeContext().currentTime); } catch (_) {}
        }
      }
    }
    function validate(command, lease) {
      if (!command || typeof command !== 'object' || Array.isArray(command)) throw new TypeError('Command object required');
      if (typeof lease !== 'string' || !/^[A-Za-z0-9:_-]{1,96}$/.test(lease)) throw new TypeError('Invalid document lease');
      const c = { ...command };
      const keys = allowed => { if (Object.keys(c).some(key => !allowed.includes(key))) throw new TypeError('Unknown command field'); };
      const number = (value, min, max) => { if (!finite(value) || value < min || value > max) throw new RangeError('Invalid numeric command value'); return value; };
      if (c.type === 'music' || c.type === 'favorite') {
        keys(['type', 'action', 'value']);
        const actions = c.type === 'music' ? ['play', 'pause', 'toggle', 'next', 'prev', 'stop', 'select', 'seek', 'volume', 'mute'] : ['play', 'pause', 'stop', 'seek', 'volume'];
        if (!actions.includes(c.action)) throw new TypeError('Unknown media action');
        if (c.action === 'select') { number(c.value, 0, playlist.length - 1); if (!Number.isInteger(c.value)) throw new RangeError('Integer track index required'); }
        else if (c.action === 'seek') number(c.value, 0, 864000);
        else if (c.action === 'volume') number(c.value, 0, 1);
        else if (c.action === 'mute') { if (typeof c.value !== 'boolean') throw new TypeError('Boolean mute required'); }
        else if (c.type === 'favorite' && c.action === 'play' && c.value !== undefined) {
          if (typeof c.value !== 'string' || new URL(c.value, baseURL).href !== favoriteURL) throw new TypeError('Favorite source is not allowlisted');
        } else if (c.value !== undefined) throw new TypeError('Action has no value');
      } else if (c.type === 'speech') {
        keys(c.action === 'glyph' ? ['type', 'action', 'voiceId', 'character', 'index', 'mood'] : ['type', 'action', 'voiceId']);
        if (!['glyph', 'stop', 'release'].includes(c.action)) throw new TypeError('Unknown voice action');
        if (c.voiceId === undefined) c.voiceId = 'main';
        if (typeof c.voiceId !== 'string' || !/^[A-Za-z0-9_-]{1,48}$/.test(c.voiceId)) throw new TypeError('Invalid voice ID');
        if (c.action === 'glyph') {
          if (typeof c.character !== 'string' || Array.from(c.character).length !== 1) throw new TypeError('One glyph required');
          if (c.index === undefined) c.index = 0; number(c.index, 0, 1000000); if (!Number.isInteger(c.index)) throw new RangeError('Integer glyph index required');
          if (c.mood === undefined) c.mood = 'calm'; if (!moods.has(c.mood)) throw new TypeError('Unknown voice mood');
        }
      } else if (c.type === 'synth') {
        keys(c.action === 'start' ? ['type', 'action', 'frequency', 'wave', 'filter'] : c.action === 'filter' ? ['type', 'action', 'filter'] : ['type', 'action']);
        if (!['start', 'filter', 'stop'].includes(c.action)) throw new TypeError('Unknown synth action');
        if (c.action === 'start') { number(c.frequency, 20, 20000); if (c.wave === undefined) c.wave = 'sawtooth'; if (!waves.has(c.wave)) throw new TypeError('Unknown waveform'); }
        if (c.action !== 'stop') { if (c.filter === undefined && c.action === 'start') c.filter = 3000; number(c.filter, 40, 20000); }
      } else if (c.type === 'tuner') {
        keys(c.action === 'start' ? ['type', 'action', 'frequency'] : ['type', 'action']);
        if (!['start', 'stop'].includes(c.action)) throw new TypeError('Unknown tuner action');
        if (c.action === 'start') number(c.frequency, 20, 20000);
      } else if (c.type === 'chime') { keys(['type', 'frequency']); if (c.frequency === undefined) c.frequency = 520; number(c.frequency, 20, 20000); }
      else throw new TypeError('Unknown audio command');
      return c;
    }
    async function execute(command, lease = 'host') {
      if (destroyed) throw error('AbortError', 'Engine destroyed');
      const c = validate(command, lease);
      if (c.type === 'music') {
        if (c.action === 'play' || (c.action === 'toggle' && music?.paused)) {
          stopFavorite(false); desiredPlaying = true; write('isPlaying', true); return playMusic();
        }
        if (c.action === 'pause' || c.action === 'toggle' || c.action === 'stop') { pauseMusic(c.action === 'stop'); return true; }
        if (['next', 'prev', 'select'].includes(c.action)) {
          endedGuard = false;
          setSource(c.action === 'select' ? c.value : (index + (c.action === 'prev' ? playlist.length - 1 : 1)) % playlist.length);
          return desiredPlaying && favoriteLease === null ? playMusic() : true;
        }
        if (c.action === 'seek') { pendingSeek = c.value; applySeek(); write('npTime', music?.currentTime || c.value); }
        if (c.action === 'volume' && music) { music.volume = c.value; write('npVolume', c.value); updateMasterFX(); }
        if (c.action === 'mute' && music) { music.muted = c.value; if (favorite) favorite.muted = c.value; write('npMuted', c.value); updateMasterFX(); }
        emit(); return true;
      }
      if (c.type === 'favorite') {
        if (c.action === 'play') return playFavorite(lease);
        if (c.action === 'pause' || c.action === 'stop') { stopFavorite(true, c.action === 'stop'); return true; }
        if (c.action === 'volume' && favorite) { favorite.volume = c.value; write('favoriteVolume', c.value); }
        if (c.action === 'seek' && favorite) { try { favorite.currentTime = duration(favorite) === null ? c.value : Math.min(c.value, favorite.duration); } catch (_) {} }
        emit(); return true;
      }
      const state = leaseState(lease);
      if (c.type === 'speech') {
        if (c.action !== 'glyph') {
          const voice = state.voices.get(c.voiceId);
          if (c.action === 'stop') voice?.stop(); else { voice?.destroy(); state.voices.delete(c.voiceId); }
          emit(); return !!voice;
        }
        if (!requireFX()) return false;
        let voice = state.voices.get(c.voiceId);
        if (!voice) {
          if (state.voices.size >= 16) throw new RangeError('Too many document voices');
          voice = SpeechAPI.createBoundSpeechSound({ getContext: nativeContext, isAuthorized: fxAllowed,
            requirePlaying: false, now: options.now, getPlayerState: () => ({ playing: !!music && !music.paused, volume: music?.volume || 0, muted: !music || music.muted }) });
          state.voices.set(c.voiceId, voice);
        }
        const played = voice.playGlyph(c); if (played) blipsPlayed++; emit(); return played;
      }
      if (c.type === 'chime') return tone('chime', c, state);
      if (c.action === 'stop') { disposeTone(state[c.type]); state[c.type] = null; emit(); return true; }
      if (c.type === 'synth' && c.action === 'filter') {
        if (!state.synth || state.synth.disposed) return false;
        state.synth.filter.frequency.setValueAtTime(c.filter, nativeContext().currentTime); return true;
      }
      disposeTone(state[c.type]); state[c.type] = null; return tone(c.type, c, state);
    }
    function releaseLease(lease) {
      const state = leases.get(lease);
      if (state) { stopLeaseFX(state); for (const voice of state.voices.values()) voice.destroy(); leases.delete(lease); }
      if (favoriteLease === lease) stopFavorite(true);
      if (!destroyed) emit();
    }
    function destroy() {
      if (destroyed) return Promise.resolve();
      destroyed = true; activationTurn++; musicTurn++; favoriteTurn++; desiredPlaying = false;
      for (const lease of [...leases.keys()]) releaseLease(lease);
      music?.pause(); favorite?.pause(); cleanups.forEach(fn => fn()); subscribers.clear();
      return owner?.destroy() || Promise.resolve();
    }
    for (const event of ['play', 'pause', 'seeked', 'emptied', 'loadedmetadata', 'durationchange', 'timeupdate', 'volumechange']) {
      listen(music, event, () => {
        if (destroyed) return;
        if (event === 'loadedmetadata') applySeek();
        if (event === 'timeupdate') write('npTime', music.currentTime);
        if (event === 'volumechange') { write('npVolume', music.volume); write('npMuted', music.muted); if (favorite) favorite.muted = music.muted; updateMasterFX(); }
        emit();
      });
      listen(favorite, event, () => { if (!destroyed) emit(); });
    }
    listen(music, 'ended', () => {
      if (destroyed || endedGuard || !music.ended || !desiredPlaying || favoriteLease !== null) return;
      endedGuard = true; setSource((index + 1) % playlist.length); playMusic().catch(() => {});
    });
    listen(favorite, 'ended', () => { if (!destroyed && favoriteLease !== null) stopFavorite(true); });
    return Object.freeze({ snapshot, probe, unlock, continueSilent, execute, releaseLease, destroy,
      subscribe(fn) { if (typeof fn !== 'function') throw new TypeError('Subscriber required'); subscribers.add(fn); return () => subscribers.delete(fn); },
      getNativeContext: nativeContext, getNativeMedia: () => ({ music, favorite }) });
  }
  return Object.freeze({ createEngine });
});
