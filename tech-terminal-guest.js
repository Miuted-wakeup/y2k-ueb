// Tech's right NAVI pane hosts this temporary visitor; HOME stays untouched.
(function (host, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else host.TechTerminalGuest = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';

  const FONT = 'assets/images/tech/companion/dialogue-font.png';
  const VOICE = 'tech-shurelia';

  function create(win) {
    const doc = win.document;
    let root = null, director = null, voice = null, fontImage = null;
    let pane = null, originalChildren = [], paneScroll = 0;
    let expiryTimer = null, expiresAt = 0, durationSeconds = 0, destroyed = false;
    let fontReady = false, soundAllowed = false, previousFocus = null;
    const cleanups = [];
    const now = () => (win.Date || Date).now();
    const listen = (target, type, callback, options) => {
      target?.addEventListener(type, callback, options);
      cleanups.push(() => target?.removeEventListener(type, callback, options));
    };

    function close(restoreFocus) {
      if (!root) return false;
      const oldRoot = root, hadFocus = oldRoot.contains(doc.activeElement);
      root = null;
      win.clearTimeout(expiryTimer); expiryTimer = null; expiresAt = 0; durationSeconds = 0;
      cleanups.splice(0).forEach(cleanup => cleanup());
      if (fontImage) fontImage.onload = fontImage.onerror = null;
      fontImage = null;
      director?.destroy(); director = null;
      voice?.destroy(); voice = null; soundAllowed = false;
      oldRoot.remove();
      originalChildren.forEach(({ element, hidden }) => { element.hidden = hidden; });
      originalChildren = [];
      if (pane) {
        pane.classList.remove('terminal-navi--visiting');
        pane.scrollTop = paneScroll;
        pane = null;
      }
      // Summoning never moves focus. Only return it if a removed visitor control owned it.
      if (restoreFocus && hadFocus) {
        const target = previousFocus?.isConnected ? previousFocus : doc.getElementById('terminal-cli-input');
        target?.focus({ preventScroll: true });
      }
      previousFocus = null;
      return true;
    }

    function extend(seconds) {
      win.clearTimeout(expiryTimer);
      durationSeconds = seconds; expiresAt = now() + seconds * 1000;
      root.dataset.expiresAt = String(expiresAt);
      root.dataset.durationSeconds = String(seconds);
      root.querySelector('.tg-duration').textContent = seconds + 's';
      expiryTimer = win.setTimeout(() => close(true), seconds * 1000);
    }

    function summon(seconds = 90) {
      // Keep terminal durations bounded and unambiguous; invalid input leaves an active visit alone.
      if (destroyed || !Number.isInteger(seconds) || seconds < 30 || seconds > 180) return false;
      if (root) { extend(seconds); return true; }
      const companion = win.HomeCompanion, art = win.HomeCompanionArt;
      const targetPane = doc.querySelector('.tech-terminal .terminal-navi');
      if (!doc.body || typeof companion?.createDirector !== 'function' ||
          typeof companion.renderFallbackText !== 'function' || typeof art?.renderText !== 'function' ||
          typeof art.normalizeText !== 'function' ||
          !Array.isArray(win.HOME_COMPANION_MESSAGES) || !targetPane ||
          targetPane.querySelector('#tech-terminal-guest')) return false;

      previousFocus = doc.activeElement;
      fontReady = false;
      root = doc.createElement('section');
      const visitor = root;
      root.id = 'tech-terminal-guest'; root.className = 'tech-terminal-guest';
      root.setAttribute('aria-label', 'Shurelia: biblioteca de Home en NAVI');
      root.innerHTML = `<div class="tg-toolbar">
        <span class="hc-name">SHURELIA.EXE</span><span class="tg-duration"></span>
        <button class="tg-dismiss" type="button" aria-label="Volver a NAVI" title="Volver a NAVI">×</button>
      </div>
      <div class="tg-stage">
        <div class="tg-room" aria-hidden="true"></div>
        <div class="hc-character"><button class="hc-portrait" type="button" aria-label="Hablar con Shurelia" disabled>
          <span class="hc-body" aria-hidden="true"></span><span class="hc-face" aria-hidden="true"></span>
        </button></div>
        <div class="tg-counter" aria-hidden="true"></div>
      </div>
      <div class="hc-dialogue" tabindex="0" aria-label="Diálogo de Shurelia" hidden>
        <p class="hc-plain" aria-live="off"></p>
        <div class="hc-glyphs" aria-hidden="true"></div>
        <a class="hc-message-link" target="_blank" rel="noopener noreferrer" hidden></a>
      </div>
      <p class="tg-caption">Toca el retrato · talk · bye</p>`;
      const plain = root.querySelector('.hc-plain'), visual = root.querySelector('.hc-glyphs');
      const face = root.querySelector('.hc-face'), bubble = root.querySelector('.hc-dialogue');
      const portrait = root.querySelector('.hc-portrait'), link = root.querySelector('.hc-message-link');
      const reduced = win.matchMedia('(prefers-reduced-motion: reduce)');
      const bridge = win.SiteAudioClient?.isFrame ? win.SiteAudioClient : null;
      let glyphs = [], linkHovered = false, linkFocused = false;
      const paint = count => {
        glyphs.forEach((glyph, index) => { glyph.style.visibility = index < count ? 'visible' : 'hidden'; });
        const last = glyphs[Math.min(count, glyphs.length) - 1];
        if (last && bubble.clientHeight) {
          // Follow the text only inside the dialogue, never scroll the console or page.
          const overflow = last.getBoundingClientRect().bottom - bubble.getBoundingClientRect().bottom;
          const zoom = Number(win.getComputedStyle(doc.documentElement).zoom) || 1;
          if (overflow > 0) bubble.scrollTop += overflow / zoom + 8;
        }
      };

      function syncVisibility() {
        if (root !== visitor || !director) return;
        const rect = visitor.getBoundingClientRect();
        const feed = visitor.closest('#center-feed')?.getBoundingClientRect();
        const visible = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < win.innerHeight &&
          (!feed || rect.bottom > feed.top && rect.top < feed.bottom);
        director.setVisible(visible);
        if (!visible) voice?.stop();
      }

      try {
        pane = targetPane;
        paneScroll = pane.scrollTop;
        originalChildren = Array.from(pane.children, element => ({ element, hidden: element.hidden }));
        originalChildren.forEach(({ element }) => { element.hidden = true; });
        pane.classList.add('terminal-navi--visiting');
        pane.scrollTop = 0;
        pane.appendChild(root);
        if (bridge) voice = bridge.createSpeechLease(VOICE);
        director = companion.createDirector({
          messages: win.HOME_COMPANION_MESSAGES, reducedMotion: reduced.matches, ready: false,
          setTimer: win.setTimeout.bind(win), clearTimer: win.clearTimeout.bind(win),
          onMessage(message, { manual }) {
            plain.setAttribute('aria-live', manual ? 'polite' : 'off');
            plain.textContent = message.text;
            bubble.scrollTop = 0;
            link.hidden = !message.link;
            if (message.link) { link.href = message.link.url; link.textContent = message.link.label + ' ▶'; }
            else link.removeAttribute('href');
            glyphs = fontReady ? art.renderText(visual, message.text) : companion.renderFallbackText(visual, art.normalizeText(message.text));
            return glyphs.length;
          },
          onProgress: paint,
          onGlyph(glyph) { if (root && soundAllowed) voice?.playGlyph(glyph); },
          onFrame(frame) {
            if (!root) return;
            face.style.backgroundPosition = -(frame % 4) * 64 + 'px ' + -Math.floor(frame / 4) * 56 + 'px';
            face.dataset.frame = String(frame);
          },
          onState(state) {
            if (!root) return;
            root.dataset.mood = state.mood; root.dataset.expression = state.expression;
            root.dataset.phase = state.phase; root.dataset.speaking = String(state.typing && state.visible);
            root.dataset.visible = String(state.visible);
            bubble.hidden = !state.bubbleVisible; portrait.disabled = !state.visible;
            const follow = state.bubbleVisible && state.phase === 'reading' && !!state.message?.link;
            link.style.visibility = follow ? 'visible' : 'hidden'; link.tabIndex = follow ? 0 : -1;
            link.inert = !follow; link.setAttribute('aria-hidden', String(!follow));
            if (!state.bubbleVisible) voice?.stop();
          }
        });
        const hold = () => director?.setReadingHeld(linkHovered || linkFocused);
        listen(portrait, 'click', () => talk());
        listen(root.querySelector('.tg-dismiss'), 'click', () => close(true));
        listen(root, 'keydown', event => {
          if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); }
        });
        listen(link, 'mouseenter', () => { linkHovered = true; hold(); });
        listen(link, 'mouseleave', () => { linkHovered = false; hold(); });
        listen(link, 'focus', () => { linkFocused = true; hold(); });
        listen(link, 'blur', () => { linkFocused = false; hold(); });
        listen(reduced, 'change', event => director?.setReducedMotion(event.matches));
        listen(win, 'resize', syncVisibility);
        listen(doc, 'scroll', syncVisibility, true);
        // Collapsing the optional laboratory hides this visit without a scroll event.
        for (let disclosure = visitor.closest('details'); disclosure; disclosure = disclosure.parentElement?.closest('details')) {
          listen(disclosure, 'toggle', syncVisibility);
        }
        listen(doc, 'visibilitychange', () => {
          if (now() >= expiresAt) { close(false); return; }
          director?.setPageVisible(!doc.hidden);
          if (doc.hidden) voice?.stop();
        });
        listen(win, 'pagehide', () => close(false));
        // Native panel controls toggle display. Observe their explicit style changes;
        // scroll/resize listeners separately handle the console moving out of view.
        if (win.MutationObserver) {
          const observer = new win.MutationObserver(() => syncVisibility());
          const panel = visitor.closest('.panel');
          for (const element of [panel, panel?.querySelector('.panel-body')]) {
            if (element) observer.observe(element, { attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
          }
          cleanups.push(() => observer.disconnect());
        }

        extend(seconds);
        director.setPageVisible(!doc.hidden); syncVisibility();
        if (bridge) {
          cleanups.push(bridge.subscribe(state => {
            if (root !== visitor) return;
            soundAllowed = state.entered && state.permission === 'active';
            if (!soundAllowed || state.music?.muted || state.music?.volume === 0) voice?.stop();
            director.setReady(state.entered);
            if (state.entered && director.snapshot().index < 0) director.interact();
          }));
        } else { director.setReady(true); director.interact(); }

        fontImage = new win.Image();
        fontImage.onload = () => {
          if (root !== visitor) return;
          fontReady = true;
          const state = director.snapshot();
          if (state.message) { glyphs = art.renderText(visual, state.message.text); paint(state.revealed); }
        };
        fontImage.onerror = () => {}; // The fallback already has identical paced text.
        fontImage.src = FONT;
        return true;
      } catch (_) {
        close(false);
        return false;
      }
    }

    function talk() {
      if (!root || !director) return false;
      voice?.stop();
      return director.interact();
    }

    return {
      summon, talk, dismiss: () => close(true),
      destroy() { close(false); destroyed = true; },
      snapshot() {
        return { active: !!root, destroyed, expiresAt, durationSeconds,
          remainingSeconds: root ? Math.max(0, Math.ceil((expiresAt - now()) / 1000)) : 0,
          ...(director ? director.snapshot() : { phase: 'inactive' }) };
      }
    };
  }

  return { create };
});
