// Optional local retro blips. Text and music never depend on this audio layer.
(function (host, factory) {
  const api = factory(host);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else host.HomeCompanionSpeech = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (host) {
  'use strict';
  // Voice level only; still follows the current player volume/mute settings.
  const SPEECH_GAIN = .12;
  const pitches = Object.freeze({ warm: 700, playful: 820, sleepy: 500, curious: 900, serious: 580, calm: 640 });
  const activationTypes = new Set(['click', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchend', 'keydown']);

  function createSpeechSound(options = {}) {
    const peakGain = typeof options.gain === 'number' && Number.isFinite(options.gain)
      && options.gain >= 0 && options.gain <= .35 ? options.gain : SPEECH_GAIN;
    const bound = typeof options.contextProvider === 'function' && typeof options.authorizedProvider === 'function';
    const AudioContextCtor = Object.hasOwn(options, 'AudioContextCtor') ? options.AudioContextCtor : host.AudioContext || host.webkitAudioContext;
    const supported = bound || typeof AudioContextCtor === 'function';
    // Keep the original API policy unless a caller explicitly owns this opt-out.
    const requirePlaying = !(Object.hasOwn(options, 'requirePlaying') && options.requirePlaying === false);
    const getPlayerState = typeof options.getPlayerState === 'function' ? options.getPlayerState : () => ({ playing: false, muted: true, volume: 0 });
    const now = typeof options.now === 'function' ? options.now : () => host.performance ? host.performance.now() : Date.now();
    let context = null, consented = false, destroyed = false, pendingUnlock = null, closing = null;
    let printableCount = 0, lastPlayedAt = -Infinity, blipsPlayed = 0;
    const notes = new Set();
    const running = () => {
      if (bound && !destroyed) {
        try { context = options.contextProvider(); consented = options.authorizedProvider() === true; }
        catch (_) { consented = false; }
      }
      return !destroyed && consented && context?.state === 'running';
    };

    function dispose(note, interrupt) {
      if (note.disposed) return;
      note.disposed = true; notes.delete(note);
      if (note.oscillator) {
        note.oscillator.onended = null;
        if (interrupt && note.started) {
          try { note.oscillator.stop(note.context.currentTime); } catch (_) { /* Already ended. */ }
        }
      }
      for (const node of [note.oscillator, note.filter, note.gain]) {
        try { node?.disconnect(); } catch (_) { /* Failed/ended audio must never affect text. */ }
      }
    }

    function stop() {
      for (const note of [...notes]) dispose(note, true);
      printableCount = 0;
      // Keep the global throttle: a phrase/visibility change cannot cause a burst.
    }

    function unlock(event) {
      if (bound) return Promise.resolve(running());
      const intentional = event?.isTrusted === true && activationTypes.has(event.type)
        && (event.type !== 'keydown' || event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar');
      if (!intentional || !supported || destroyed) return Promise.resolve(false);
      if (pendingUnlock) return pendingUnlock;
      try {
        // These native calls must occur inside the trusted activation, not a timer.
        if (!context) context = new AudioContextCtor();
        if (context.state === 'closed') return Promise.resolve(false);
        if (context.state === 'running') { consented = true; return Promise.resolve(true); }
        consented = false;
        const result = context.resume();
        pendingUnlock = Promise.resolve(result).then(() => {
          consented = !destroyed && context.state === 'running';
          return consented;
        }, () => { consented = false; return false; }).finally(() => { pendingUnlock = null; });
        return pendingUnlock;
      } catch (_) {
        consented = false;
        return Promise.resolve(false);
      }
    }

    // Explicit parent-only capability probe: no resume and no test oscillator.
    // Default factories remain lazy until unlock() or this explicit probe.
    function probe() {
      if (bound) return Promise.resolve(running());
      if (!supported || destroyed) return Promise.resolve(false);
      try {
        if (!context) context = new AudioContextCtor();
        consented = context.state === 'running';
        return Promise.resolve(consented);
      } catch (_) { consented = false; return Promise.resolve(false); }
    }

    function playGlyph({ character, index = 0, mood = 'calm' } = {}) {
      if (!running()) { stop(); return false; }
      let volume, timestamp;
      try {
        const player = getPlayerState();
        volume = Number(player?.volume);
        if (!player || (requirePlaying && player.playing !== true) || player.muted || !Number.isFinite(volume) || volume <= 0) {
          stop(); return false;
        }
        timestamp = now();
      } catch (_) { stop(); return false; }
      if (typeof character !== 'string' || !/^[\p{L}\p{N}]$/u.test(character) || !Number.isFinite(timestamp)) return false;
      printableCount++;
      if (printableCount % 2 === 0 || timestamp - lastPlayedAt < 100) return false;

      const key = Object.hasOwn(pitches, mood) ? mood : 'calm';
      const position = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;
      const frequency = pitches[key] + ((character.codePointAt(0) + position) % 5 - 2) * 9;
      const start = context.currentTime, duration = .045 + position % 3 * .004;
      const note = { context, oscillator: null, filter: null, gain: null, started: false, disposed: false };
      try {
        note.oscillator = context.createOscillator();
        note.filter = context.createBiquadFilter();
        note.gain = context.createGain();
        const { oscillator, filter, gain } = note;
        oscillator.type = key === 'sleepy' || key === 'calm' ? 'triangle' : 'square';
        oscillator.frequency.setValueAtTime(frequency, start);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2200, start);
        filter.Q.setValueAtTime(.6, start);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(peakGain * Math.min(1, volume), start + .004);
        gain.gain.linearRampToValueAtTime(0, start + duration);
        oscillator.connect(filter); filter.connect(gain); gain.connect(context.destination);
        oscillator.onended = () => dispose(note, false);
        notes.add(note);
        oscillator.start(start); note.started = true;
        oscillator.stop(start + duration + .002);
        lastPlayedAt = timestamp; blipsPlayed++;
        return true;
      } catch (_) {
        dispose(note, true);
        return false;
      }
    }

    function destroy() {
      if (destroyed) return closing || Promise.resolve();
      destroyed = true; consented = false; stop();
      try { closing = context && !bound ? Promise.resolve(context.close()).catch(() => {}) : Promise.resolve(); }
      catch (_) { closing = Promise.resolve(); }
      return closing;
    }

    function snapshot() {
      return { supported, unlocked: running(), contextState: context?.state || (destroyed ? 'closed' : supported ? 'uninitialized' : 'unsupported'),
        activeNotes: notes.size, blipsPlayed };
    }
    return Object.freeze({ unlock, probe, getNativeContext: () => context, playGlyph, stop, destroy, snapshot });
  }

  function createBoundSpeechSound(options = {}) {
    if (typeof options.getContext !== 'function' || typeof options.isAuthorized !== 'function') {
      throw new TypeError('Bound voices require an owner context and authorization provider');
    }
    return createSpeechSound({ ...options, contextProvider: options.getContext,
      authorizedProvider: options.isAuthorized, AudioContextCtor: null });
  }
  return Object.freeze({ createSpeechSound, createBoundSpeechSound });
});
