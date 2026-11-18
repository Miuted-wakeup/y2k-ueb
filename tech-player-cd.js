// Presentation only: observes Tech's existing player, never issues audio commands.
(function (host) {
  'use strict';
  const DIRECTORY = 'assets/images/tech/player-cd/';
  const MOVE_MS = 400, HIDDEN_MS = 1000;
  const COVERS = Object.freeze({
    'onii_yuukai.mp3': 'onii-yuukai.jpg',
    'matryoshka.mp3': 'matryoshka.webp',
    'hatachi.mp3': 'hatashi-no-koi.jpg',
    'kirby.mp3': 'kirby.webp',
    'nitori.mp3': 'nitori.jpg',
    'aishite.mp3': 'aishite.jpg',
    'yt-3agc6do-624.mp3': 'yt-3agc6do-624.jpg',
    'yt-hxrwlmloaeo.mp3': 'yt-hxrwlmloaeo.jpg',
    'yt-j9sn1nfgqq8.mp3': 'yt-j9sn1nfgqq8.jpg',
    'yt-icbdykfxpms.mp3': 'yt-icbdykfxpms.jpg',
    // Prepared artwork only: this does not add Vivarium to the shared playlist.
    'vivarium.mp3': 'vivarium.jpg'
  });
  const mounts = new WeakMap();

  function mount(win = host) {
    const doc = win.document;
    if (!doc || doc.body?.id !== 'section-tech' || win.SiteAudioShell?.isHost) return null;
    const bar = doc.querySelector('#now-playing-bar[data-player-skin="tech"]');
    if (!bar) return null;
    if (mounts.has(bar)) return mounts.get(bar);
    const client = win.SiteAudioClient?.isFrame ? win.SiteAudioClient : null;
    const nativeAudio = client ? null : bar.querySelector('#audio-player');
    const cleanup = [], timers = new Set(), paints = new Set();
    let destroyed = false, revision = 0, ringReady = false, ringFailed = false;
    let desired = null, displayedKey = '', job = null, pendingImage = null;
    let playing = false, needsResync = false, unsubscribe = null;
    let slidePosition = -1, rotationFrame = 0, rotationTime = null, angle = 0;
    const frame = doc.createElement('span');
    frame.className = 'tech-cd-window'; frame.setAttribute('aria-hidden', 'true');
    frame.innerHTML = '<span class="tech-cd-slide is-stowed"><span class="tech-cd-disc"><span class="tech-cd-print"><img class="tech-cd-cover" alt="" hidden></span><img class="tech-cd-ring" alt=""></span></span>';
    // A viewport decoration, not an enlarged child of the compact player slot.
    doc.body.append(frame);
    const slide = frame.querySelector('.tech-cd-slide');
    const disc = frame.querySelector('.tech-cd-disc');
    const print = frame.querySelector('.tech-cd-print');
    const ring = frame.querySelector('.tech-cd-ring');
    let artwork = frame.querySelector('.tech-cd-cover');
    const listen = (element, name, handler, options) => {
      element.addEventListener(name, handler, options);
      cleanup.push(() => element.removeEventListener(name, handler, options));
    };
    function later(delay, callback) {
      const timer = win.setTimeout(() => { timers.delete(timer); if (!destroyed) callback(); }, delay);
      timers.add(timer);
    }
    function afterPaint(callback) {
      const paint = win.requestAnimationFrame(timestamp => {
        paints.delete(paint);
        if (!destroyed) callback(timestamp);
      });
      paints.add(paint);
    }
    function phase(value) { frame.dataset.phase = value; bar.dataset.techCdPhase = value; }
    function cancelJob() {
      revision++;
      timers.forEach(timer => win.clearTimeout(timer)); timers.clear();
      paints.forEach(paint => win.cancelAnimationFrame(paint)); paints.clear();
      if (pendingImage) { pendingImage.onload = pendingImage.onerror = null; pendingImage = null; }
      job = null;
    }
    function setSlide(position) {
      slidePosition = position;
      slide.style.transform = `translateX(calc(${position * 100}% + ${position * 48}px))`;
    }
    function moveSlide(target, complete) {
      const from = slidePosition, turn = revision;
      let started = null;
      slide.classList.toggle('is-stowed', target < 0);
      if (Math.abs(from - target) < .0001) { setSlide(target); complete(); return; }
      const step = timestamp => {
        if (turn !== revision) return;
        if (started === null) started = timestamp;
        const progress = Math.min(1, (timestamp - started) / MOVE_MS);
        const eased = target < from ? progress * progress : 1 - Math.pow(1 - progress, 3);
        setSlide(from + (target - from) * eased);
        if (progress < 1) afterPaint(step);
        else complete();
      };
      afterPaint(step);
    }
    function syncRotation() {
      const running = !destroyed && !ringFailed && playing && !doc.hidden && !needsResync;
      frame.classList.toggle('is-playing', running);
      if (!running) {
        if (rotationFrame) win.cancelAnimationFrame(rotationFrame);
        rotationFrame = 0; rotationTime = null; return;
      }
      if (rotationFrame) return;
      const turn = timestamp => {
        rotationFrame = 0;
        if (destroyed || ringFailed || !playing || doc.hidden || needsResync) { rotationTime = null; return; }
        if (rotationTime !== null) angle = (angle + Math.min(100, timestamp - rotationTime) * .03) % 360;
        rotationTime = timestamp;
        disc.style.transform = `rotate(${angle}deg)`;
        rotationFrame = win.requestAnimationFrame(turn);
      };
      rotationFrame = win.requestAnimationFrame(turn);
    }
    setSlide(-1);
    function describe(src) {
      if (typeof src !== 'string' || !src) return null;
      try {
        const url = new win.URL(src, doc.baseURI);
        const key = decodeURIComponent(url.pathname).toLowerCase();
        const file = key.split('/').pop();
        return { key, file, cover: Object.hasOwn(COVERS, file) ? DIRECTORY + COVERS[file] : null };
      } catch (_) { return null; }
    }
    function requestTrack(track) {
      const changing = displayedKey !== '';
      cancelJob(); desired = track;
      phase(changing ? 'leaving' : 'loading');
      if (ringFailed) return;
      const turn = revision;
      const task = { held: !changing, ready: !track.cover, image: null, committed: false, commit: null };
      job = task;
      task.commit = () => {
        if (destroyed || turn !== revision || !ringReady || !task.held || !task.ready || task.committed) return;
        task.committed = true;
        if (task.image) {
          task.image.className = 'tech-cd-cover'; task.image.alt = ''; task.image.draggable = false;
          artwork.replaceWith(task.image); artwork = task.image;
        } else { artwork.hidden = true; artwork.removeAttribute('src'); }
        print.dataset.artwork = task.image ? 'cover' : 'neutral';
        displayedKey = track.key;
        doc.body.classList.add('tech-cd-mounted');
        frame.classList.add('is-ready');
        phase('entering');
        moveSlide(0, () => { if (turn === revision) { phase('visible'); job = null; } });
      };
      if (changing) {
        moveSlide(-1, () => {
          if (turn !== revision) return;
          phase('hidden');
          // One full second OUTSIDE the viewport, not including travel time.
          later(HIDDEN_MS, () => {
            if (turn !== revision) return;
            task.held = true; task.commit();
          });
        });
      } else setSlide(-1);
      task.commit();
      if (!track.cover) return;
      const image = new win.Image(); pendingImage = image;
      image.onload = () => {
        if (destroyed || turn !== revision) return;
        image.onload = image.onerror = null; pendingImage = null;
        task.image = image; task.ready = true; task.commit();
      };
      image.onerror = () => {
        if (destroyed || turn !== revision) return;
        image.onload = image.onerror = null; pendingImage = null;
        task.ready = true; task.commit();
      };
      image.src = track.cover;
    }
    function observe(media, entered = true) {
      if (destroyed) return;
      const next = entered ? describe(media?.src) : null;
      playing = !!next && media?.playing === true;
      if (!next) {
        cancelJob(); desired = null;
        displayedKey = '';
        setSlide(-1); slide.classList.add('is-stowed'); frame.classList.remove('is-ready');
        doc.body.classList.remove('tech-cd-mounted');
        phase('empty'); needsResync = false; syncRotation(); return;
      }
      const resync = needsResync; needsResync = false;
      if (next.key !== desired?.key || resync && (displayedKey !== next.key || slide.classList.contains('is-stowed'))) requestTrack(next);
      syncRotation();
    }
    function refresh() {
      if (destroyed) return;
      if (client) {
        const state = client.state(); observe(state.music, state.entered === true);
      } else if (nativeAudio) {
        observe({ src: nativeAudio.currentSrc || nativeAudio.src, playing: !nativeAudio.paused && !nativeAudio.ended && !nativeAudio.error });
      }
    }
    listen(ring, 'load', () => { ringReady = true; job?.commit(); });
    listen(ring, 'error', () => {
      ringFailed = true; cancelJob(); frame.classList.remove('is-ready', 'is-playing');
      doc.body.classList.remove('tech-cd-mounted');
      phase('ring-unavailable');
      syncRotation();
    });
    ring.draggable = false; ring.src = DIRECTORY + 'cd-ring.png';
    listen(doc, 'visibilitychange', () => { syncRotation(); if (!doc.hidden) refresh(); });
    if (client) {
      unsubscribe = client.subscribe(state => observe(state.music, state.entered === true));
      client.ready.then(refresh, () => {});
    } else if (nativeAudio) {
      ['play', 'playing', 'pause', 'ended', 'loadstart', 'loadedmetadata', 'emptied', 'error'].forEach(name => listen(nativeAudio, name, refresh));
      refresh();
    }
    const controller = Object.freeze({
      destroy() {
        if (destroyed) return;
        destroyed = true; cancelJob(); syncRotation(); unsubscribe?.(); cleanup.splice(0).forEach(remove => remove());
        doc.body.classList.remove('tech-cd-mounted');
        frame.remove(); delete bar.dataset.techCdPhase;
        mounts.delete(bar);
      }
    });
    listen(win, 'pagehide', event => {
      if (!event.persisted) controller.destroy();
      else { needsResync = true; cancelJob(); syncRotation(); }
    });
    listen(win, 'pageshow', event => { if (event.persisted) refresh(); });
    mounts.set(bar, controller);
    return controller;
  }
  host.TechPlayerCD = Object.freeze({ mount });
  if (host.document.readyState === 'loading') host.document.addEventListener('DOMContentLoaded', () => mount(host), { once: true });
  else mount(host);
})(window);
