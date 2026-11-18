// Persistent document owner. Section documents keep their original isolated UI.
(function (host, factory) {
  const Core = typeof module === 'object' && module.exports ? require('./site-audio-core.js') : host.SiteAudioCore;
  const api = factory(Core);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    const shell = host.SiteAudioShell = { isHost: false, isFrame: !!Core?.frameInfo(host) };
    if (!Core || shell.isFrame || !Core.initialRoute(host.location.href) ||
        !host.SiteAudioClient || !host.SiteAudioEngine || !host.HomeCompanionSpeech) return;
    shell.isHost = true; // Synchronous role before any legacy page script executes.
    const start = () => api.mountBrowserHost(host, shell);
    if (host.document.readyState === 'loading') host.document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
  }
})(typeof window === 'undefined' ? globalThis : window, function (defaultCore) {
  'use strict';
  const error = (name, message) => Object.assign(new Error(message), { name });
  const plain = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const bounded = value => { try { return JSON.stringify(value).length <= 4096; } catch (_) { return false; } };
  const ENTRY_INTRO = { file: 'assets/gifs/entry/portal-intro.gif', cycleMs: 3010, holdMs: 500, loadTimeoutMs: 8000 };
  const REVEAL_MS = 600;

  function createController(options) {
    const win = options.window, Core = options.Core || defaultCore, engine = options.engine;
    const initialTopURL = win.location.href;
    let route = Core.initialRoute(initialTopURL);
    if (!route) throw new TypeError('Unknown site section');
    const setTimer = win.setTimeout.bind(win), clearTimer = win.clearTimeout.bind(win);
    const onPhase = options.onPhase || (() => {}), onError = options.onError || (() => {});
    const makeToken = options.token || (() => {
      const bytes = new Uint8Array(16); win.crypto.getRandomValues(bytes);
      return Array.from(bytes, n => n.toString(16).padStart(2, '0')).join('');
    });
    let token = makeToken(), epoch = 1, frame = null, connected = false, pageReady = false;
    let entered = false, phase = 'checking', started = false, destroyed = false, frozen = false;
    let attempt = 0, timer = null, highestId = 0, introCleanup = null;
    const receipts = new Map(), cleanups = [];
    const allowed = () => {
      const state = engine.snapshot();
      return state.permission === 'silent' || state.permission === 'active' && state.contextState === 'running';
    };
    const state = () => ({ ...engine.snapshot(), entered: entered && allowed(), publicURL: route.href, section: route.section });
    const snapshot = () => ({ route: { ...route }, token, epoch, entered: entered && allowed(), phase, connected, pageReady });
    const notify = () => {
      if (!destroyed && !frozen && !win.document?.hidden) {
        engine.setAmbience?.(route.section, entered && allowed());
        onPhase(snapshot());
      }
    };
    const cancel = () => {
      if (timer !== null) clearTimer(timer); timer = null;
      const cleanup = introCleanup; introCleanup = null;
      try { cleanup?.(); } catch (_) { /* Cosmetic cleanup cannot retain the gate. */ }
    };
    const origin = () => Core.messageOrigin(route.fileHref);
    function post(kind, extra = {}, tuple = { token, epoch }) {
      if (destroyed || !frame?.contentWindow) return;
      try { frame.contentWindow.postMessage({ channel: Core.PROTOCOL, kind, ...tuple, ...extra }, origin() === 'null' ? '*' : origin()); }
      catch (_) { /* A disappearing child cannot change parent ownership. */ }
    }
    const publish = () => { if (connected) post('state', { state: state() }); };
    function listen(target, type, fn) {
      target?.addEventListener?.(type, fn);
      cleanups.push(() => target?.removeEventListener?.(type, fn));
    }
    function failed(turn) {
      if (destroyed || turn !== attempt) return;
      cancel(); attempt++; entered = false; phase = 'failed'; notify(); publish();
    }
    function finishReveal() {
      cancel(); attempt++; phase = 'revealing'; entered = false; notify(); publish();
      timer = setTimer(() => {
        timer = null;
        if (destroyed || phase !== 'revealing') return;
        entered = allowed(); phase = entered ? 'complete' : 'waiting'; notify(); publish();
      }, REVEAL_MS);
    }
    function reveal(withIntro = true) {
      if (!withIntro || typeof options.beforeReveal !== 'function') { finishReveal(); return; }
      cancel(); const turn = ++attempt;
      phase = 'intro'; entered = false; notify(); publish();
      try {
        const cleanup = options.beforeReveal(() => {
          if (destroyed || turn !== attempt || phase !== 'intro') return;
          if (allowed()) finishReveal(); else failed(turn);
        });
        if (turn === attempt && phase === 'intro') introCleanup = typeof cleanup === 'function' ? cleanup : null;
        else if (typeof cleanup === 'function') cleanup();
      } catch (_) { if (!destroyed && turn === attempt) finishReveal(); }
    }
    function checkPermission() {
      if (destroyed || frozen || win.document?.hidden) return;
      cancel(); const turn = ++attempt; entered = false; phase = 'checking'; notify(); publish();
      timer = setTimer(() => failed(turn), 2500);
      let result;
      try { result = engine.snapshot().permission === 'silent' ? Promise.resolve(true) : engine.probe(); }
      catch (_) { result = Promise.resolve(false); }
      Promise.resolve(result).then(ok => {
        if (destroyed || turn !== attempt || frozen || win.document?.hidden) return;
        cancel(); entered = ok === true && allowed(); phase = entered ? 'complete' : 'waiting'; notify(); publish();
      }, () => failed(turn));
    }
    function replaceFrame() {
      const old = frame;
      connected = false; pageReady = false; receipts.clear(); highestId = 0;
      frame = options.createFrame(route, token, epoch, Core.frameURL(route, token, epoch));
      if (old && old !== frame) old.remove();
    }
    function navigate(href, push = true) {
      if (destroyed) return false;
      const next = Core.resolveRoute(href, route.href);
      if (!next) return false;
      if (next.href === route.href) return true;
      const previous = new URL(route.fileHref), target = new URL(next.fileHref);
      const sameDocument = previous.origin === target.origin && previous.pathname === target.pathname && previous.search === target.search;
      if (push) win.history.pushState({ siteAudio: true }, '', Core.historyURL(next, initialTopURL));
      if (sameDocument) {
        route = next;
        post('replace', { href: Core.frameURL(route, token, epoch) }); publish(); notify(); return true;
      }
      engine.releaseLease('route:' + epoch);
      route = next; token = makeToken(); epoch++;
      try { replaceFrame(); notify(); }
      catch (reason) { onError(reason, snapshot()); return false; }
      if (!allowed()) { entered = false; phase = 'waiting'; notify(); }
      return true;
    }
    function locationChanged() {
      const next = Core.initialRoute(win.location.href);
      if (next) navigate(next.href, false);
    }
    function sendAck(id, result, tuple) {
      if (destroyed || tuple.frame !== frame || tuple.token !== token || tuple.epoch !== epoch || !connected) return;
      post('ack', { id, ...result, state: state() });
    }
    function receive(event) {
      if (destroyed || event.source !== frame?.contentWindow || event.origin !== origin() ||
          !Core.validEnvelope(event.data, token, epoch)) return false;
      const data = event.data;
      if (data.kind === 'hello') { connected = true; publish(); return true; }
      if (!connected) return false;
      if (data.kind === 'page-ready') { pageReady = true; notify(); return true; }
      if (data.kind === 'page-leaving') {
        connected = false; pageReady = false; engine.releaseLease('route:' + epoch);
        // Cached documents re-authenticate on pageshow; retired realms never grant permission.
        if (!data.persisted && !frozen) options.onUnexpectedLeave?.(snapshot());
        return true;
      }
      if (data.kind === 'navigate') return typeof data.href === 'string' && data.href.length <= 4096 && navigate(data.href);
      if (data.kind === 'request-activation') {
        if (allowed() && engine.snapshot().permission === 'active') { publish(); return true; }
        if (!['unlocking', 'intro', 'revealing'].includes(phase)) { cancel(); attempt++; entered = false; phase = 'waiting'; notify(); publish(); }
        return true;
      }
      if (data.kind !== 'command' || !/^c[1-9]\d{0,12}$/.test(data.id) || !plain(data.command) || !bounded(data.command)) return false;
      const tuple = { token, epoch, frame };
      const cached = receipts.get(data.id);
      if (cached) { cached.then(result => sendAck(data.id, result, tuple)); return true; }
      const number = Number(data.id.slice(1));
      if (number <= highestId || receipts.size > 256) return false;
      highestId = number;
      let job;
      const safeBeforeEntry = ['pause', 'stop', 'release', 'seek', 'volume', 'mute', 'filter'].includes(data.command.action);
      try {
        if (!state().entered && !safeBeforeEntry) throw error('NotAllowedError', 'Activate audio or continue silently first');
        job = engine.execute(data.command, 'route:' + epoch);
      } catch (reason) { job = Promise.reject(reason); }
      const receipt = Promise.resolve(job).then(value => ({ ok: true, value }), reason => ({ ok: false,
        error: { name: typeof reason?.name === 'string' ? reason.name.slice(0, 80) : 'Error',
          message: typeof reason?.message === 'string' ? reason.message.slice(0, 240) : 'Audio request failed' } }));
      receipts.set(data.id, receipt);
      receipt.then(result => {
        sendAck(data.id, result, tuple);
        if (receipts.size > 128) receipts.delete(receipts.keys().next().value);
      });
      return true;
    }
    const unsubscribe = engine.subscribe(() => {
      if (destroyed) return;
      if (entered && !allowed()) { entered = false; phase = 'waiting'; notify(); }
      publish();
    });
    listen(win, 'message', receive); listen(win, 'popstate', locationChanged); listen(win, 'hashchange', locationChanged);
    listen(win.document, 'visibilitychange', () => {
      if (win.document.hidden) { cancel(); attempt++; if (!entered) phase = 'waiting'; engine.releaseLease('route:' + epoch); }
      else if (!frozen && !entered) checkPermission();
    });
    listen(win, 'pagehide', event => {
      if (event.persisted) { frozen = true; cancel(); attempt++; engine.releaseLease('route:' + epoch); }
      else api.destroy();
    });
    listen(win, 'pageshow', event => { if (event.persisted) { frozen = false; checkPermission(); } });
    const api = {
      snapshot, receive, navigate, getFrame: () => frame,
      start() {
        if (started || destroyed) return;
        started = true;
        win.history.replaceState({ siteAudio: true }, '', Core.publicURL(initialTopURL));
        replaceFrame(); checkPermission();
      },
      activate(event) {
        if (destroyed || !started || !['waiting', 'failed'].includes(phase)) return;
        cancel(); const turn = ++attempt; phase = 'unlocking'; notify();
        let result;
        // Do not defer the native calls to a Promise callback or child message.
        try { result = engine.unlock(event); } catch (_) { failed(turn); return; }
        timer = setTimer(() => failed(turn), 2500);
        Promise.resolve(result).then(ok => { if (!destroyed && turn === attempt) ok && allowed() ? reveal() : failed(turn); }, () => failed(turn));
      },
      silence() {
        if (!destroyed && !['complete', 'revealing'].includes(phase)) {
          const skipIntro = phase === 'intro';
          engine.continueSilent(); reveal(!skipIntro);
        }
      },
      destroy() {
        if (destroyed) return;
        destroyed = true; cancel(); attempt++; unsubscribe(); cleanups.forEach(fn => fn());
        engine.releaseLease('route:' + epoch); frame?.remove(); engine.destroy();
      }
    };
    return api;
  }

  function mountBrowserHost(win, shell) {
    const doc = win.document, Core = defaultCore;
    let controller, dialog = null, previousFocus = null, revealCover = null, introSerial = 0;
    let ambientToast = null, ambientToastTitle = null, ambientToastCover = null, ambientToastTimer = null;
    let unsubscribeAmbience = null, lastAmbienceId = null;
    const setText = (id, text) => { const node = doc.getElementById(id); if (node) node.textContent = text; };
    function hideAmbientToast() {
      if (ambientToastTimer !== null) win.clearTimeout(ambientToastTimer);
      ambientToastTimer = null;
      if (ambientToast) ambientToast.hidden = true;
    }
    function themeAmbientToast(section) {
      if (ambientToast) ambientToast.dataset.section = Core.SECTIONS.some(item => item.section === section) ? section : 'home';
    }
    function showAmbientToast(track) {
      const state = controller?.snapshot();
      if (!state?.entered || doc.hidden || !ambientToast || !Number.isFinite(track?.id) ||
          track.id === lastAmbienceId || typeof track.title !== 'string' || !track.title.trim()) return;
      lastAmbienceId = track.id;
      hideAmbientToast();
      themeAmbientToast(state.route.section);
      ambientToast.hidden = false;
      ambientToastTitle.textContent = track.title;
      ambientToastCover.hidden = true;
      ambientToastCover.onload = ambientToastCover.onerror = null;
      ambientToastCover.removeAttribute('src');
      if (typeof track.cover === 'string' && track.cover) {
        const cover = track.cover;
        ambientToastCover.onload = () => {
          if (ambientToastCover?.getAttribute('src') === cover) ambientToastCover.hidden = false;
        };
        ambientToastCover.onerror = () => { if (ambientToastCover) ambientToastCover.hidden = true; };
        ambientToastCover.src = cover;
      }
      ambientToastTimer = win.setTimeout(hideAmbientToast, 4200);
    }
    function ambientVisibilityChanged() { if (doc.hidden) hideAmbientToast(); }
    function ambientPageHidden(event) {
      hideAmbientToast();
      if (!event.persisted) disposeAmbientToast();
    }
    function disposeAmbientToast() {
      hideAmbientToast();
      unsubscribeAmbience?.(); unsubscribeAmbience = null;
      doc.removeEventListener('visibilitychange', ambientVisibilityChanged);
      win.removeEventListener('pagehide', ambientPageHidden);
      if (ambientToastCover) { ambientToastCover.onload = ambientToastCover.onerror = null; ambientToastCover.removeAttribute('src'); }
      ambientToast?.remove(); ambientToast = ambientToastTitle = ambientToastCover = null;
    }
    function mountAmbientToast(engine) {
      if (typeof engine.subscribeAmbience !== 'function') return;
      ambientToast = doc.createElement('div'); ambientToast.id = 'site-ambient-toast'; ambientToast.hidden = true;
      ambientToast.setAttribute('role', 'status'); ambientToast.setAttribute('aria-live', 'polite');
      ambientToast.setAttribute('aria-atomic', 'true');
      const label = doc.createElement('span'); label.className = 'sa-ambient-label'; label.textContent = '♫ AMBIENTE';
      const content = doc.createElement('div'); content.className = 'sa-ambient-content';
      ambientToastCover = doc.createElement('img'); ambientToastCover.className = 'sa-ambient-cover';
      ambientToastCover.alt = ''; ambientToastCover.width = 44; ambientToastCover.height = 44; ambientToastCover.hidden = true;
      ambientToastCover.decoding = 'async';
      ambientToastTitle = doc.createElement('strong'); ambientToastTitle.className = 'sa-ambient-title';
      content.append(ambientToastCover, ambientToastTitle);
      ambientToast.append(label, content); doc.documentElement.appendChild(ambientToast);
      doc.addEventListener('visibilitychange', ambientVisibilityChanged);
      win.addEventListener('pagehide', ambientPageHidden);
      unsubscribeAmbience = engine.subscribeAmbience(showAmbientToast);
    }
    function closeGate(restoreFocus = true) {
      if (dialog) {
        const old = dialog; dialog = null;
        try { if (old.open) old.close(); } catch (_) {}
        old.remove();
      }
      if (restoreFocus) {
        if (previousFocus?.isConnected) previousFocus.focus?.({ preventScroll: true });
        controller?.getFrame()?.focus?.({ preventScroll: true });
      }
    }
    function clearReveal() {
      revealCover?.remove(); revealCover = null;
      controller?.getFrame()?.removeAttribute('tabindex');
    }
    function openCurtains() {
      if (!revealCover) {
        revealCover = doc.createElement('div'); revealCover.id = 'site-audio-reveal';
        revealCover.setAttribute('aria-hidden', 'true');
        revealCover.style.setProperty('--sa-reveal-ms', REVEAL_MS + 'ms');
        revealCover.innerHTML = '<div class="sa-curtain-top"></div><div class="sa-curtain-bottom"></div>';
        doc.documentElement.appendChild(revealCover);
      }
      // Release native modality BEFORE the zoomed section gets its first layout.
      // The non-modal cover blocks pointer input; entered stays false until the split ends.
      closeGate(false);
      const frame = controller?.getFrame();
      if (frame) { frame.setAttribute('tabindex', '-1'); frame.style.display = 'block'; }
    }
    function playEntryIntro(done) {
      const slot = dialog?.querySelector('#site-audio-intro');
      if (!slot) { done(); return; }
      let stopped = false, timer = null, paint = null;
      const img = doc.createElement('img');
      img.alt = ''; img.width = 600; img.height = 450; img.draggable = false;
      const clearTimer = () => { if (timer !== null) win.clearTimeout(timer); timer = null; };
      const hold = () => {
        if (stopped) return;
        clearTimer(); img.onload = img.onerror = null; img.remove(); slot.replaceChildren();
        if (dialog) dialog.dataset.intro = 'hold';
        timer = win.setTimeout(() => { timer = null; if (!stopped) done(); }, ENTRY_INTRO.holdMs);
      };
      img.onload = () => {
        if (stopped) return;
        clearTimer(); slot.replaceChildren(img);
        if (dialog) dialog.dataset.intro = 'playing';
        paint = win.requestAnimationFrame(() => {
          paint = null;
          if (!stopped) timer = win.setTimeout(hold, ENTRY_INTRO.cycleMs);
        });
      };
      img.onerror = hold;
      const url = new URL(ENTRY_INTRO.file, Core.publicURL(win.location.href));
      // A new image URL starts a fresh native GIF timeline, including file:// development.
      url.searchParams.set('entrance', Date.now() + '-' + (++introSerial));
      timer = win.setTimeout(hold, ENTRY_INTRO.loadTimeoutMs);
      img.src = url.href;
      return () => {
        stopped = true; clearTimer();
        if (paint !== null) win.cancelAnimationFrame(paint);
        img.onload = img.onerror = null; img.removeAttribute('src'); img.remove(); slot.replaceChildren();
        if (dialog) delete dialog.dataset.intro;
      };
    }
    function phaseUI(state) {
      const sectionFrame = controller?.getFrame();
      const entry = Core.SECTIONS.find(item => item.section === state.route.section);
      doc.title = entry.label + ' · mi espacio';
      themeAmbientToast(state.route.section);
      if (!state.entered || state.phase !== 'complete') hideAmbientToast();
      if (state.phase === 'revealing') { openCurtains(); return; }
      clearReveal();
      if (state.phase === 'complete') {
        closeGate(false);
        if (sectionFrame) sectionFrame.style.display = 'block';
        closeGate(); return;
      }
      if (sectionFrame) sectionFrame.style.display = 'none';
      if (state.phase === 'checking' && !dialog) return;
      if (!dialog) {
        previousFocus = doc.activeElement;
        dialog = doc.createElement('dialog'); dialog.id = 'site-audio-entry';
        dialog.setAttribute('aria-labelledby', 'site-audio-title'); dialog.setAttribute('aria-describedby', 'site-audio-description');
        Object.assign(dialog.style, { color: '#ded3e6', backgroundColor: '#150e14', padding: '0', border: '0',
          maxWidth: 'none', maxHeight: 'none', overflow: 'hidden' });
        dialog.innerHTML = `<h1 id="site-audio-title" class="sa-screen-reader">mi espacio</h1>
          <p id="site-audio-description" class="sa-screen-reader"></p>
          <span id="site-audio-destination" class="sa-screen-reader"></span>
          <div id="site-audio-intro" class="sa-intro-stage" aria-hidden="true"></div>
          <div class="sa-entry-controls">
            <button id="site-audio-activate" type="button" aria-label="Entrar y activar el audio"><span id="site-audio-activate-label">ENTRAR</span></button>
            <button id="site-audio-silent" type="button">sin sonido</button>
            <p id="site-audio-status" role="status" aria-live="polite"></p>
          </div>`;
        dialog.querySelector('#site-audio-activate').addEventListener('click', event => controller.activate(event));
        dialog.querySelector('#site-audio-silent').addEventListener('click', () => controller.silence());
        dialog.addEventListener('cancel', event => { event.preventDefault(); controller.silence(); });
        doc.documentElement.appendChild(dialog);
        try { dialog.showModal(); } catch (_) { dialog.setAttribute('open', ''); }
        dialog.querySelector('#site-audio-activate').focus({ preventScroll: true });
      }
      dialog.dataset.phase = state.phase; dialog.dataset.section = state.route.section;
      // The requested destination stays accessible without adding visible instructions.
      setText('site-audio-destination', entry.label);
      setText('site-audio-description', 'Entrar en ' + entry.label + ' y activar el audio. También puedes entrar sin sonido.');
      setText('site-audio-status', state.phase === 'failed' ? 'No se pudo activar el audio. Reintenta o entra sin sonido.' : '');
      const primary = dialog.querySelector('#site-audio-activate'), silent = dialog.querySelector('#site-audio-silent');
      dialog.setAttribute('aria-busy', String(['unlocking', 'intro'].includes(state.phase)));
      primary.disabled = ['checking', 'unlocking', 'intro', 'revealing'].includes(state.phase);
      silent.disabled = ['intro', 'revealing'].includes(state.phase);
      setText('site-audio-activate-label', state.phase === 'failed' ? 'REINTENTAR' : state.phase === 'unlocking' ? '…' : 'ENTRAR');
      primary.setAttribute('aria-label', state.phase === 'failed' ? 'Reintentar la activación del audio' : 'Entrar y activar el audio');
    }
    try {
      const engine = win.SiteAudioEngine.createEngine({ window: win, SpeechAPI: win.HomeCompanionSpeech,
        playlist: Core.PLAYLIST, ambience: Core.AMBIENCE, baseURL: Core.publicURL(win.location.href) });
      const root = doc.documentElement;
      root.classList.add('site-audio-host'); doc.body.className = 'site-audio-host-body'; doc.body.id = '';
      doc.body.replaceChildren();
      controller = createController({ window: win, Core, engine, beforeReveal: playEntryIntro,
        createFrame(route, token, epoch, src) {
          const frame = doc.createElement('iframe'); frame.className = 'site-audio-frame'; frame.id = 'site-audio-frame';
          frame.style.display = 'none';
          frame.title = 'Sección ' + Core.SECTIONS.find(item => item.section === route.section).label;
          frame.referrerPolicy = 'no-referrer'; frame.setAttribute('allow', 'autoplay');
          frame.src = src; doc.body.appendChild(frame); return frame;
        }, onPhase: phaseUI,
        onError(reason) {
          disposeAmbientToast(); clearReveal(); closeGate(); const box = doc.createElement('p'); box.className = 'site-audio-error';
          box.textContent = 'No se pudo abrir la sección. Recarga la página para reintentar. ' + (reason?.message || ''); doc.body.appendChild(box);
        },
        onUnexpectedLeave() { /* Never stream new state to an unauthenticated destination. */ }
      });
      shell.engine = engine; shell.controller = controller; shell.snapshot = () => controller.snapshot();
      shell.navigate = href => controller.navigate(href);
      mountAmbientToast(engine); controller.start();
    } catch (reason) {
      disposeAmbientToast(); clearReveal(); closeGate(); shell.isHost = false;
      doc.body.style.setProperty('opacity', '1', 'important');
      doc.querySelectorAll('.panel,#site-header,#site-nav,#main-wrapper').forEach(node => node.style.setProperty('opacity', '1', 'important'));
      const note = doc.createElement('p'); note.textContent = 'Audio compartido no disponible. Recarga para reintentar.'; note.setAttribute('role', 'alert'); doc.body.prepend(note);
    }
  }
  return { createController, mountBrowserHost };
});
