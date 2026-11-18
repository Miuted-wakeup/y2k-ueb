// HOME only. Local automatic and requested dialogue; never controls the site's music playback.
(function (host) {
  'use strict';
  const NEUTRAL_FRAME = 0;
  const GLYPH_DELAY = 70;
  const ART = typeof module !== 'undefined' && module.exports
    ? require('./home-companion-art.js') : host.HomeCompanionArt;
  const displayText = text => ART ? ART.normalizeText(text) : String(text);
  // `rest` is the held reaction while its message is readable, NOT the idle face.
  // The sheet has no dedicated sleepy pose; frame 1 is its subdued/tired option.
  const EMOTIONS = {
    warm: { rest: 2, talk: [2, 7] },
    playful: { rest: 2, talk: [7, 2] },
    sleepy: { rest: 1, talk: [4, 1] },
    curious: { rest: 3, talk: [5, 3] },
    serious: { rest: 3, talk: [4, 3] },
    calm: { rest: 6, talk: [6, 0] }
  };
  const MESSAGES = typeof module !== 'undefined' && module.exports
    ? require('./home-companion-messages.js') : host.HOME_COMPANION_MESSAGES;
  const REACTIONS = typeof module !== 'undefined' && module.exports
    ? require('./home-companion-reactions.js') : host.HOME_COMPANION_REACTIONS;
  const fallback = { text: 'Hola, viajero. Puedes quedarte un rato.', mood: 'warm' };
  function normalizeMessageLink(input) {
    if (!input || typeof input.url !== 'string' || input.url.length > 2048) return null;
    try {
      const url = new URL(input.url);
      if (url.protocol !== 'https:' || url.username || url.password) return null;
      const label = typeof input.label === 'string' ? input.label.trim().slice(0, 64) : 'Ver el vídeo';
      return { url: url.href, label: label || 'Ver el vídeo' };
    } catch (_) { return null; }
  }
  function validMessages(input, useFallback = true) {
    const result = (Array.isArray(input) ? input : []).filter(m => m && typeof m.text === 'string' && m.text.trim())
      .map(m => {
        const message = { text: m.text, mood: Object.hasOwn(EMOTIONS, m.mood) ? m.mood : 'calm' };
        const link = normalizeMessageLink(m.link);
        if (link) message.link = link;
        return message;
      });
    return result.length ? result : useFallback ? [fallback] : [];
  }

  function createDirector(options = {}) {
    const messages = validMessages(options.messages === undefined ? MESSAGES : options.messages);
    const reactionData = options.reactions === undefined ? REACTIONS : options.reactions;
    const reactions = Object.create(null), reactionHistory = new Map();
    if (reactionData && typeof reactionData === 'object' && !Array.isArray(reactionData)) {
      for (const [key, values] of Object.entries(reactionData)) {
        if (/^[a-z][a-z0-9_-]{0,47}$/.test(key)) {
          const entries = validMessages(values, false);
          if (entries.length) reactions[key] = entries;
        }
      }
    }
    let lastReactionAt = -Infinity;
    const { random = Math.random, now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout,
      onMessage = () => 0, onProgress = () => {}, onFrame = () => {}, onState = () => {}, onGlyph = () => {} } = options;
    let reducedMotion = !!options.reducedMotion;
    let visible = false, pageVisible = true, destroyed = false, ready = options.ready !== false, readingHeld = false;
    let index = -1, revealed = 0, length = 0, phase = 'waiting', timer = null, characters = [], currentMessage = null, context = null;
    const active = () => ready && visible && pageVisible && !destroyed;
    const snapshot = () => ({ index, revealed, length, phase, typing: phase === 'typing',
      bubbleVisible: active() && phase !== 'waiting', reducedMotion, ready, readingHeld, visible: active(),
      context: phase === 'waiting' ? null : context,
      expression: active() && phase !== 'waiting' ? currentMessage.mood : 'neutral',
      mood: currentMessage?.mood || 'warm', message: currentMessage ? { ...currentMessage, ...(currentMessage.link ? { link: { ...currentMessage.link } } : {}) } : null });
    const state = () => onState(snapshot());
    const cancel = () => { if (timer !== null) clearTimer(timer); timer = null; };
    const face = (talking = false) => {
      const current = snapshot();
      // Reduced motion suppresses cycling, not the meaningful emotional reaction.
      // A finished/hidden comment must never leave its emotion as the idle face.
      if (current.expression === 'neutral') { onFrame(NEUTRAL_FRAME); return; }
      const emotion = EMOTIONS[current.expression];
      onFrame(talking && !reducedMotion ? emotion.talk[Math.floor(revealed / 4) % 2] : emotion.rest);
    };
    function nextIndex() {
      const step = 1 + Math.floor(Math.max(0, Math.min(.99999, random())) * (messages.length - 1));
      return index < 0 ? 0 : (index + step) % messages.length;
    }
    function wait() {
      cancel(); phase = 'waiting'; face(); state();
      if (!active()) return;
      const delay = currentMessage === null ? 2000 : 48000 + Math.floor(random() * 34000);
      timer = setTimer(() => speak(nextIndex()), delay);
    }
    function read() {
      cancel(); phase = 'reading'; revealed = length;
      onProgress(revealed); face(); state();
      if (active() && !readingHeld) timer = setTimer(wait, Math.max(4200, Math.min(12000, currentMessage.text.length * 65)));
    }
    function tick() {
      if (!active() || phase !== 'typing') return;
      const previous = characters[revealed - 1], next = characters[revealed];
      let delay = GLYPH_DELAY;
      if (revealed > 1 && /[,;:]/.test(previous)) delay += 150;
      if (revealed > 1 && /[.!?]/.test(previous) && previous !== next) delay += 300;
      timer = setTimer(() => {
        const character = characters[revealed] || '';
        revealed++; onProgress(revealed); face(/[A-Z0-9]/i.test(character));
        onGlyph({ character, index: revealed - 1, mood: currentMessage.mood }); state();
        if (revealed >= length) read(); else tick();
      }, delay);
    }
    function speak(selectedIndex, manual = false) {
      index = selectedIndex; context = null;
      startMessage(messages[index], manual);
    }
    function startMessage(message, manual) {
      cancel(); currentMessage = message; revealed = 0; phase = 'typing';
      characters = Array.from(displayText(message.text).replace(/\s/g, ''));
      length = onMessage(message, { manual }); onProgress(0);
      if (!length) read(); else { face(); state(); tick(); }
    }
    function reconcile() {
      cancel();
      if (!active()) { face(); state(); return; }
      if (phase === 'typing') {
        face(/[A-Z0-9]/i.test(characters[revealed - 1] || '')); state(); tick();
      } else if (phase === 'reading') read();
      else wait();
    }
    return {
      snapshot,
      interact() {
        if (!active()) return false;
        if (phase === 'typing') read(); // First click finishes the line; no replayed glyph sound.
        else speak(nextIndex(), true);
        return true;
      },
      react(topic) {
        if (!active() || readingHeld || typeof topic !== 'string' || !Object.hasOwn(reactions, topic)) return false;
        const at = now(), previous = reactionHistory.get(topic);
        if (!Number.isFinite(at) || at - lastReactionAt < 400 || previous && at - previous.at < 6000) return false;
        const pool = reactions[topic];
        const choice = previous && pool.length > 1
          ? (previous.index + 1 + Math.floor(Math.max(0, Math.min(.99999, random())) * (pool.length - 1))) % pool.length
          : Math.floor(Math.max(0, Math.min(.99999, random())) * pool.length);
        lastReactionAt = at; reactionHistory.set(topic, { at, index: choice }); context = topic;
        startMessage(pool[choice], true);
        return true;
      },
      setReadingHeld(value) {
        if (destroyed || readingHeld === !!value) return;
        readingHeld = !!value;
        if (phase === 'reading') reconcile();
      },
      setReady(value) { if (ready !== !!value) { ready = !!value; reconcile(); } },
      setVisible(value) { if (visible !== !!value) { visible = !!value; reconcile(); } },
      setPageVisible(value) { if (pageVisible !== !!value) { pageVisible = !!value; reconcile(); } },
      setReducedMotion(value) { reducedMotion = !!value; reconcile(); },
      destroy() { destroyed = true; readingHeld = false; cancel(); phase = 'waiting'; face(); state(); }
    };
  }

  // Consent/readiness is separate from dialogue timing and from the site's music.
  function createEntryController(options = {}) {
    const { unlock = () => Promise.resolve(false), onPhase = () => {}, onRelease = () => {},
      onAbandonSound = () => {}, setTimer = setTimeout, clearTimer = clearTimeout } = options;
    let phase = 'waiting', attempt = 0, timer = null, abandoned = false;
    const snapshot = () => ({ phase, reducedMotion: !!options.reducedMotion });
    const notify = () => onPhase(snapshot());
    const cancel = () => { if (timer !== null) clearTimer(timer); timer = null; };
    const abandon = () => { if (!abandoned) { abandoned = true; onAbandonSound(); } };
    function fail(turn) {
      if (turn !== attempt || phase !== 'unlocking') return;
      cancel(); attempt++; phase = 'failed'; notify();
    }
    function reveal(sound) {
      cancel(); attempt++; phase = 'revealing'; notify();
      timer = setTimer(() => {
        timer = null;
        if (phase !== 'revealing') return;
        phase = 'complete'; notify(); onRelease({ sound });
      }, 600);
    }
    const api = {
      snapshot,
      requestSound(event) {
        if (phase !== 'waiting' && phase !== 'failed') return;
        const turn = ++attempt;
        phase = 'unlocking'; notify();
        let result;
        // Must remain synchronous in the native button event's activation stack.
        try { result = unlock(event); } catch (_) { fail(turn); return; }
        timer = setTimer(() => fail(turn), 2500);
        Promise.resolve(result).then(running => {
          if (turn !== attempt || phase !== 'unlocking') return;
          if (running === true) reveal(true); else fail(turn);
        }, () => fail(turn));
      },
      enterSilent() {
        if (!['waiting', 'unlocking', 'failed'].includes(phase)) return;
        abandon(); reveal(false);
      },
      destroy() {
        if (phase === 'destroyed') return;
        cancel(); attempt++; phase = 'destroyed'; abandon(); notify();
      }
    };
    notify();
    return api;
  }

  function mountEntry(win, speech, onRelease) {
    const doc = win.document, previousFocus = doc.activeElement;
    const dialog = doc.createElement('dialog');
    dialog.id = 'home-entry';
    dialog.setAttribute('aria-labelledby', 'home-entry-title');
    dialog.setAttribute('aria-describedby', 'home-entry-description');
    // Critical fallback remains visible even if optional HOME styling fails.
    Object.assign(dialog.style, { position: 'fixed', left: '0', top: '0', margin: '0',
      maxWidth: 'none', maxHeight: 'none', boxSizing: 'border-box', color: '#fff2e8', backgroundColor: '#1b080a' });
    dialog.innerHTML = `<div class="he-collage" aria-hidden="true"></div>
      <div class="he-shell">
        <div class="he-titlebar"><span>★ MUTED'S DIGITAL SANCTUARY</span><span aria-hidden="true">─ □ ×</span></div>
        <header class="he-heading"><p class="he-kicker">PERSONAL WEB / Y2K MODE</p><h1 id="home-entry-title">★ mi espacio ★</h1><p>わたしのせかい · un pequeño rincón de internet</p></header>
        <div class="he-stage"><div class="he-copy"><p class="he-label">BIENVENIDO A CASA</p><h2>Fuera del algoritmo,<br>dentro de mi mundo.</h2>
          <p id="home-entry-description">Entra, ponte cómodo y deja que Shurelia te dé la bienvenida. El sonido del personaje es opcional; la música no se iniciará.</p>
          <button id="home-entry-start" type="button">ENTRAR <span>▶ activar sonido</span></button>
          <button id="home-entry-silent" type="button">Entrar sin sonido</button>
          <p id="home-entry-status" role="status" aria-live="polite">Tú eliges cómo entrar.</p></div>
          <div class="he-host" aria-hidden="true"><span class="he-host-body"></span><span class="he-host-face"></span><span class="he-host-counter"></span></div></div>
        <footer class="he-footer"><span>HTML HECHO A MANO</span><span>JAPÓN · MÚSICA · RECUERDOS</span><span>NO ALGORITHMS</span></footer>
      </div>`;
    const primary = dialog.querySelector('#home-entry-start'), silent = dialog.querySelector('#home-entry-silent');
    const status = dialog.querySelector('#home-entry-status');
    let removed = false, observer;
    const size = () => {
      const zoom = Number(win.getComputedStyle(doc.documentElement).zoom) || 1;
      dialog.style.width = win.innerWidth / zoom + 'px'; dialog.style.height = win.innerHeight / zoom + 'px';
    };
    function remove() {
      if (removed) return;
      removed = true; observer?.disconnect(); win.removeEventListener('resize', size);
      dialog.removeEventListener('cancel', escape); dialog.removeEventListener('close', closed);
      dialog.removeEventListener('keydown', trap);
      if (dialog.open) dialog.close(); dialog.remove();
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    }
    const entry = createEntryController({ reducedMotion: win.matchMedia('(prefers-reduced-motion: reduce)').matches,
      setTimer: win.setTimeout.bind(win), clearTimer: win.clearTimeout.bind(win),
      unlock: event => speech?.unlock(event) || Promise.resolve(false),
      onAbandonSound: () => speech?.destroy(),
      onPhase({ phase }) {
        dialog.dataset.phase = phase;
        primary.disabled = phase === 'unlocking' || phase === 'revealing';
        silent.disabled = phase === 'revealing';
        status.textContent = phase === 'unlocking' ? 'Permitiendo el sonido… Puedes entrar sin él.' : phase === 'failed'
          ? 'El sonido no se pudo activar. Reintenta o entra sin sonido.' : phase === 'revealing' ? 'Bienvenido a mi espacio.' : 'Tú eliges cómo entrar.';
        if (phase === 'failed') { primary.textContent = 'REINTENTAR SONIDO'; primary.focus({ preventScroll: true }); }
        if (phase === 'destroyed') remove();
      },
      onRelease(choice) { remove(); onRelease(choice); }
    });
    const escape = event => { event.preventDefault(); entry.enterSilent(); };
    const closed = () => entry.enterSilent();
    const trap = event => {
      if (event.key !== 'Tab') return;
      event.preventDefault();
      const choices = [primary, silent].filter(button => !button.disabled);
      if (!choices.length) return;
      const at = choices.indexOf(doc.activeElement);
      const next = at < 0 ? (event.shiftKey ? choices.length - 1 : 0) : (at + (event.shiftKey ? choices.length - 1 : 1)) % choices.length;
      choices[next].focus({ preventScroll: true });
    };
    primary.addEventListener('click', event => entry.requestSound(event));
    silent.addEventListener('click', () => entry.enterSilent());
    dialog.addEventListener('cancel', escape); dialog.addEventListener('close', closed);
    dialog.addEventListener('keydown', trap);
    try {
      size(); doc.documentElement.appendChild(dialog); dialog.showModal(); primary.focus({ preventScroll: true });
      win.addEventListener('resize', size);
      if (win.MutationObserver) { observer = new win.MutationObserver(size); observer.observe(doc.documentElement, { attributes: true, attributeFilter: ['style', 'class'] }); }
      return entry;
    } catch (_) { entry.destroy(); return null; }
  }

  function renderFallbackText(container, text) {
    const doc = container.ownerDocument, glyphs = [];
    container.replaceChildren();
    for (const part of text.match(/\S+|\s+/g) || []) {
      if (/^\s/.test(part)) { container.appendChild(doc.createTextNode(part)); continue; }
      const word = doc.createElement('span'); word.className = 'hc-word';
      for (const character of Array.from(part)) {
        const glyph = doc.createElement('span'); glyph.className = 'hc-fallback-char';
        glyph.textContent = character; word.appendChild(glyph); glyphs.push(glyph);
      }
      container.appendChild(word);
    }
    return glyphs;
  }

  function mount(root, win = host) {
    if (!root || root.homeCompanion) return root?.homeCompanion;
    const doc = root.ownerDocument, art = win.HomeCompanionArt;
    const sidebar = doc.getElementById('sidebar-right');
    const plain = root.querySelector('.hc-plain'), visual = root.querySelector('.hc-glyphs');
    const portrait = root.querySelector('.hc-face'), bubble = root.querySelector('.hc-dialogue');
    const interactButton = root.querySelector('.hc-portrait'), messageLink = root.querySelector('.hc-message-link');
    const reduced = win.matchMedia('(prefers-reduced-motion: reduce)');
    const bridge = win.SiteAudioClient?.isFrame ? win.SiteAudioClient : null;
    const player = bridge ? bridge.getPlayer() : doc.getElementById('audio-player');
    const speech = bridge ? bridge.createSpeechLease('shurelia') : win.HomeCompanionSpeech?.createSpeechSound({
      AudioContextCtor: win.AudioContext || win.webkitAudioContext,
      requirePlaying: false, // A paused song must not silence this independent character voice.
      getPlayerState: () => ({ playing: !!player && !player.paused, muted: !player || player.muted, volume: player?.volume || 0 })
    });
    let glyphs = [], fontReady = false, disposed = false, entry = null, soundAllowed = false, fontImage, cancelResume;
    const cleanups = [];
    const listen = (target, type, callback, options) => {
      target?.addEventListener(type, callback, options);
      cleanups.push(() => target?.removeEventListener(type, callback, options));
    };
    root.classList.add('hc-script-ready');
    const reactionButtons = [...(doc.querySelectorAll?.('.hc-reactive-button') || [])];
    const paint = count => glyphs.forEach((glyph, i) => { glyph.style.visibility = i < count ? 'visible' : 'hidden'; });
    const director = createDirector({ reducedMotion: reduced.matches, ready: false,
      setTimer: win.setTimeout.bind(win), clearTimer: win.clearTimeout.bind(win),
      now: () => win.performance?.now() ?? Date.now(),
      onMessage(message, { manual }) {
        speech?.stop();
        plain.setAttribute('aria-live', manual ? 'polite' : 'off');
        if (messageLink) {
          messageLink.hidden = !message.link;
          if (message.link) { messageLink.href = message.link.url; messageLink.textContent = message.link.label + ' ▶'; }
          else messageLink.removeAttribute('href');
        }
        plain.textContent = message.text;
        glyphs = fontReady ? art.renderText(visual, message.text) : renderFallbackText(visual, displayText(message.text));
        return glyphs.length;
      },
      onProgress: paint,
      onGlyph: glyph => { if (soundAllowed) speech?.playGlyph(glyph); },
      onFrame(frame) {
        portrait.style.backgroundPosition = -(frame % 4) * 64 + 'px ' + -Math.floor(frame / 4) * 56 + 'px';
        portrait.dataset.frame = frame;
      },
      onState(s) {
        root.dataset.mood = s.mood; root.dataset.speaking = s.typing && s.visible;
        root.dataset.expression = s.expression;
        root.dataset.visible = s.visible; root.dataset.phase = s.phase;
        bubble.hidden = !s.bubbleVisible;
        if (interactButton) interactButton.disabled = !s.visible;
        for (const button of reactionButtons) if (button.disabled !== !s.visible) button.disabled = !s.visible;
        if (messageLink) {
          const canFollow = s.bubbleVisible && s.phase === 'reading' && !!s.message?.link;
          messageLink.style.visibility = canFollow ? 'visible' : 'hidden';
          messageLink.tabIndex = canFollow ? 0 : -1;
          messageLink.inert = !canFollow;
          messageLink.setAttribute('aria-hidden', String(!canFollow));
        }
        if (!s.bubbleVisible) speech?.stop();
      }
    });
    root.homeCompanion = director;
    director.sound = speech;
    const unlock = event => {
      if (disposed || !soundAllowed || (entry && entry.snapshot().phase !== 'complete')) return;
      speech?.unlock(event).catch(() => {});
    };
    const stopSound = () => speech?.stop();
    listen(interactButton, 'click', () => {
      if (!director.snapshot().visible) return;
      stopSound(); plain.setAttribute('aria-live', 'polite');
      director.interact();
    });
    listen(doc, 'click', event => {
      if (event.defaultPrevented || event.button !== undefined && event.button !== 0) return;
      const control = event.target?.closest?.('[data-hc-reaction]');
      if (control && doc.body?.contains(control)) director.react(control.dataset.hcReaction);
      // Never preventDefault, stopPropagation, or delay an existing page action.
    });
    // A focused/hovered video link must not disappear while someone is using it.
    let linkHovered = false, linkFocused = false;
    const holdReading = () => director.setReadingHeld(linkHovered || linkFocused);
    listen(messageLink, 'mouseenter', () => { linkHovered = true; holdReading(); });
    listen(messageLink, 'mouseleave', () => { linkHovered = false; holdReading(); });
    listen(messageLink, 'focus', () => { linkFocused = true; holdReading(); });
    listen(messageLink, 'blur', () => { linkFocused = false; holdReading(); });
    listen(doc, 'pointerdown', unlock, { passive: true });
    listen(doc, 'keydown', unlock);
    listen(player, 'volumechange', stopSound);
    const destroy = director.destroy;
    director.destroy = () => {
      cancelResume?.(); cancelResume = null;
      if (disposed) return;
      disposed = true; soundAllowed = false;
      entry?.destroy(); destroy(); speech?.destroy();
      cleanups.forEach(cleanup => cleanup());
      if (fontImage) fontImage.onload = fontImage.onerror = null;
    };
    // Fixed coordinates must use logical CSS pixels, not already-zoomed client pixels.
    const align = () => {
      if (disposed) return;
      const r = sidebar.getBoundingClientRect();
      const scale = Number(win.getComputedStyle(doc.documentElement).zoom) || 1;
      root.style.left = r.left / scale + 'px';
      root.style.width = r.width / scale + 'px';
    };
    align(); listen(win, 'resize', align);
    if (win.ResizeObserver) {
      const observer = new win.ResizeObserver(align); observer.observe(sidebar);
      cleanups.push(() => observer.disconnect());
    }
    // A cached/background return receives a new reachable entry, never an old promise.
    const suspend = () => {
      director.destroy();
      if (root.homeCompanion === director) delete root.homeCompanion;
      const resume = () => {
        if (doc.hidden || !root.isConnected) return;
        cancelResume(); cancelResume = null;
        mount(root, win);
      };
      win.addEventListener('pageshow', resume);
      doc.addEventListener('visibilitychange', resume);
      cancelResume = () => { win.removeEventListener('pageshow', resume); doc.removeEventListener('visibilitychange', resume); };
    };
    listen(win, 'pagehide', event => {
      if (event.persisted && (bridge || entry?.snapshot().phase === 'complete')) {
        speech?.stop(); director.setPageVisible(false);
      } else if (event.persisted) suspend();
      else director.destroy();
    });
    listen(win, 'pageshow', event => { if (event.persisted && !disposed) director.setPageVisible(!doc.hidden); });
    listen(doc, 'visibilitychange', () => {
      if (doc.hidden && entry && entry.snapshot().phase !== 'complete') suspend();
      else director.setPageVisible(!doc.hidden);
    });
    director.setPageVisible(!doc.hidden);
    listen(reduced, 'change', event => director.setReducedMotion(event.matches));
    if (win.IntersectionObserver) {
      const observer = new win.IntersectionObserver(entries => {
        if (disposed) return;
        director.setVisible(entries[0].isIntersecting && entries[0].intersectionRatio >= .45);
      }, { threshold: [0, .45, 1] });
      observer.observe(root);
      cleanups.push(() => observer.disconnect());
    } else {
      const check = () => {
        const r = root.getBoundingClientRect();
        director.setVisible(r.right > 0 && r.left < win.innerWidth && r.bottom > 0 && r.top < win.innerHeight);
      };
      listen(win, 'resize', check); check();
    }
    if (art) {
      fontImage = new win.Image();
      fontImage.onload = () => {
        if (disposed) return;
        fontReady = true; root.classList.add('hc-art-ready');
        const s = director.snapshot();
        if (s.message) { glyphs = art.renderText(visual, s.message.text); paint(s.revealed); }
      };
      // Failed font keeps the equivalent normal text; local-file preview needs no fetch.
      fontImage.src = 'assets/images/home/dialogue-font.png';
    }
    if (bridge) {
      cleanups.push(bridge.subscribe(state => {
        if (disposed) return;
        soundAllowed = state.entered && state.permission === 'active';
        director.setReady(state.entered);
      }));
    } else entry = mountEntry(win, speech, ({ sound }) => {
        if (disposed) return;
        soundAllowed = sound; director.setReady(true);
      });
    director.entry = entry;
    if (!entry && !bridge) { soundAllowed = true; director.setReady(true); }
    if (doc.hidden && !bridge) suspend();
    return director;
  }
  const api = { NEUTRAL_FRAME, GLYPH_DELAY, EMOTIONS, MESSAGES, REACTIONS, normalizeMessageLink, createDirector, createEntryController, mount, renderFallbackText };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else {
    host.HomeCompanion = api;
    if (host.SiteAudioShell?.isHost) return;
    const init = () => mount(host.document.getElementById('home-companion'));
    const ready = () => {
      if (host.document.readyState === 'loading') host.document.addEventListener('DOMContentLoaded', init, { once: true });
      else init();
    };
    const bridge = host.SiteAudioClient?.isFrame ? host.SiteAudioClient : null;
    if (bridge) bridge.ready.then(ready, ready); else ready();
  }
})(typeof window === 'undefined' ? globalThis : window);
