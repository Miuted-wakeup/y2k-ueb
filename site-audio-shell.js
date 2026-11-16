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
    let attempt = 0, timer = null, highestId = 0;
    const receipts = new Map(), cleanups = [];
    const allowed = () => {
      const state = engine.snapshot();
      return state.permission === 'silent' || state.permission === 'active' && state.contextState === 'running';
    };
    const state = () => ({ ...engine.snapshot(), entered: entered && allowed(), publicURL: route.href, section: route.section });
    const snapshot = () => ({ route: { ...route }, token, epoch, entered: entered && allowed(), phase, connected, pageReady });
    const notify = () => { if (!destroyed && !frozen && !win.document?.hidden) onPhase(snapshot()); };
    const cancel = () => { if (timer !== null) clearTimer(timer); timer = null; };
    const origin = () => new URL(route.fileHref).origin;
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
    function reveal() {
      cancel(); attempt++; phase = 'revealing'; entered = false; notify(); publish();
      timer = setTimer(() => {
        timer = null;
        if (destroyed || phase !== 'revealing') return;
        entered = allowed(); phase = entered ? 'complete' : 'waiting'; notify(); publish();
      }, 600);
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
        if (!['unlocking', 'revealing'].includes(phase)) { cancel(); attempt++; entered = false; phase = 'waiting'; notify(); publish(); }
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
      silence() { if (!destroyed && !['complete', 'revealing'].includes(phase)) { engine.continueSilent(); reveal(); } },
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
    let controller, dialog = null, previousFocus = null;
    const setText = (id, text) => { const node = doc.getElementById(id); if (node) node.textContent = text; };
    function closeGate() {
      if (!dialog) return;
      const old = dialog; dialog = null;
      try { if (old.open) old.close(); } catch (_) {}
      old.remove();
      if (previousFocus?.isConnected) previousFocus.focus?.({ preventScroll: true });
      controller?.getFrame()?.focus?.({ preventScroll: true });
    }
    function phaseUI(state) {
      const entry = Core.SECTIONS.find(item => item.section === state.route.section);
      doc.title = entry.label + ' · mi espacio';
      if (state.phase === 'complete') { closeGate(); return; }
      if (state.phase === 'checking' && !dialog) return;
      if (!dialog) {
        previousFocus = doc.activeElement;
        dialog = doc.createElement('dialog'); dialog.id = 'site-audio-entry';
        dialog.setAttribute('aria-labelledby', 'site-audio-title'); dialog.setAttribute('aria-describedby', 'site-audio-description');
        Object.assign(dialog.style, { color: '#fff2e9', background: '#171018', padding: '0', border: '2px solid #aaa',
          maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 32px)', overflow: 'auto' });
        dialog.innerHTML = `<div class="sa-titlebar"><span>★ MUTED'S DIGITAL SANCTUARY</span><span aria-hidden="true">─ □ ×</span></div>
          <div class="sa-content"><p class="sa-kicker">PERSONAL WEB / Y2K MODE</p><h1 id="site-audio-title">★ mi espacio ★</h1>
          <p id="site-audio-description"></p><div class="sa-route" id="site-audio-destination"></div>
          <div class="sa-welcome-art" aria-hidden="true"><span class="sa-body"></span><span class="sa-face"></span><span class="sa-counter"></span></div>
          <button id="site-audio-activate" type="button">ENTRAR · activar audio ▶</button>
          <button id="site-audio-silent" type="button">Entrar sin efectos</button><p id="site-audio-status" role="status" aria-live="polite"></p></div>
          <footer class="sa-footer">HTML HECHO A MANO · NO ALGORITHMS</footer>`;
        dialog.querySelector('#site-audio-activate').addEventListener('click', event => controller.activate(event));
        dialog.querySelector('#site-audio-silent').addEventListener('click', () => controller.silence());
        dialog.addEventListener('cancel', event => { event.preventDefault(); controller.silence(); });
        doc.documentElement.appendChild(dialog);
        try { dialog.showModal(); } catch (_) { dialog.setAttribute('open', ''); }
        dialog.querySelector('#site-audio-activate').focus({ preventScroll: true });
      }
      dialog.dataset.phase = state.phase; dialog.dataset.section = state.route.section;
      dialog.style.setProperty('--sa-accent', entry.accent);
      setText('site-audio-destination', 'DESTINO · ' + entry.label);
      setText('site-audio-description', state.route.section === 'home'
        ? 'Entra, ponte cómodo y deja que Shurelia te dé la bienvenida. La música solo continuará si ya la habías puesto.'
        : 'El navegador necesita tu clic para habilitar el audio. Después seguirás en ' + entry.label + ', sin pasar por HOME.');
      setText('site-audio-status', state.phase === 'unlocking' ? 'Activando audio… También puedes entrar sin efectos.'
        : state.phase === 'revealing' ? 'Bienvenido a mi espacio.' : state.phase === 'failed'
          ? 'No se pudo activar todavía. Reintenta o continúa sin efectos.' : 'Tú eliges cómo entrar.');
      const primary = dialog.querySelector('#site-audio-activate'), silent = dialog.querySelector('#site-audio-silent');
      primary.disabled = ['checking', 'unlocking', 'revealing'].includes(state.phase);
      silent.disabled = state.phase === 'revealing';
      if (state.phase === 'failed') primary.textContent = 'REINTENTAR AUDIO';
    }
    try {
      const engine = win.SiteAudioEngine.createEngine({ window: win, SpeechAPI: win.HomeCompanionSpeech,
        playlist: Core.PLAYLIST, baseURL: Core.publicURL(win.location.href) });
      const root = doc.documentElement;
      root.classList.add('site-audio-host'); doc.body.className = 'site-audio-host-body'; doc.body.id = '';
      doc.body.replaceChildren();
      controller = createController({ window: win, Core, engine,
        createFrame(route, token, epoch, src) {
          const frame = doc.createElement('iframe'); frame.className = 'site-audio-frame'; frame.id = 'site-audio-frame';
          frame.title = 'Sección ' + Core.SECTIONS.find(item => item.section === route.section).label;
          frame.referrerPolicy = 'no-referrer'; frame.setAttribute('allow', 'autoplay');
          frame.src = src; doc.body.appendChild(frame); return frame;
        }, onPhase: phaseUI,
        onError(reason) {
          closeGate(); const box = doc.createElement('p'); box.className = 'site-audio-error';
          box.textContent = 'No se pudo abrir la sección. Recarga la página para reintentar. ' + (reason?.message || ''); doc.body.appendChild(box);
        },
        onUnexpectedLeave() { /* Never stream new state to an unauthenticated destination. */ }
      });
      shell.engine = engine; shell.controller = controller; shell.snapshot = () => controller.snapshot();
      shell.navigate = href => controller.navigate(href); controller.start();
    } catch (reason) {
      closeGate(); shell.isHost = false;
      doc.body.style.setProperty('opacity', '1', 'important');
      doc.querySelectorAll('.panel,#site-header,#site-nav,#main-wrapper').forEach(node => node.style.setProperty('opacity', '1', 'important'));
      const note = doc.createElement('p'); note.textContent = 'Audio compartido no disponible. Recarga para reintentar.'; note.setAttribute('role', 'alert'); doc.body.prepend(note);
    }
  }
  return { createController, mountBrowserHost };
});
