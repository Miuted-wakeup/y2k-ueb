// Tech's in-flow Paint window. The external editor is created only on request.
(function (host) {
  'use strict';

  const EDITOR_URL = 'https://jspaint.app/';
  const USAGE = 'Usa paint, paint minimizar, paint restaurar o paint cerrar.';
  const mounts = new WeakMap();
  const ACTIONS = Object.freeze({
    open: 'open', abrir: 'open',
    close: 'close', cerrar: 'close',
    minimize: 'minimize', minimizar: 'minimize',
    restore: 'open', restaurar: 'open'
  });

  function mount(win = host) {
    const doc = win.document;
    if (!doc || doc.body?.id !== 'section-tech' || win.SiteAudioShell?.isHost) return null;
    const root = doc.getElementById('tech-paint-workspace');
    if (!root) return null;
    if (mounts.has(root)) return mounts.get(root);

    let initialized = root.dataset.paintInitialized === 'true';
    let minimized = root.classList.contains('is-minimized');
    let expanded = root.classList.contains('is-expanded');
    let destroyed = false;
    let controller;
    let resizeObserver = null;
    const feed = root.closest('#center-feed');
    const select = selector => root.querySelector(selector);
    const motion = () => win.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

    function build() {
      if (initialized) return;
      // Trusted application chrome only; user text and remote messages are never injected.
      root.innerHTML = `
        <div class="tech-paint-window" aria-labelledby="tech-paint-title">
          <div class="panel-titlebar tech-paint-titlebar">
            <h2 id="tech-paint-title" class="tech-paint-title">✦ PAINT · TU PEQUEÑO LIENZO</h2>
            <div class="tech-paint-controls" aria-label="Controles de la ventana de Paint">
              <button type="button" class="tech-paint-control tech-paint-draw" data-paint-action="focus" aria-controls="tech-paint-frame">Dibujar</button>
              <button type="button" class="tech-paint-control" data-paint-action="minimize" aria-label="Minimizar Paint" aria-controls="tech-paint-body" aria-expanded="true">─</button>
              <button type="button" class="tech-paint-control" data-paint-action="expand" aria-label="Ampliar el espacio de Paint" aria-pressed="false">□</button>
              <button type="button" class="tech-paint-control tech-paint-close" data-paint-action="close" aria-label="Cerrar la ventana de Paint sin descartar el dibujo">×</button>
            </div>
          </div>
          <div class="tech-paint-minimized" id="tech-paint-minimized" hidden>
            <span>Paint está minimizado; el editor permanece abierto.</span>
            <button type="button" class="tech-paint-button" data-paint-action="open" aria-controls="tech-paint-body">Restaurar Paint</button>
          </div>
          <div class="tech-paint-body" id="tech-paint-body">
            <div class="tech-paint-toolbar">
              <p>Un espacio propio para dibujar, fuera de la consola.</p>
              <a class="tech-paint-link" href="https://jspaint.app/" target="_blank" rel="noopener noreferrer">Abrir JSPaint en otra pestaña ↗</a>
            </div>
            <div class="tech-paint-editor" id="tech-paint-editor"></div>
            <p class="tech-paint-footer">JSPaint es un editor externo y necesita conexión. Si no aparece aquí, usa el enlace de arriba. Guarda tu dibujo desde Archivo antes de salir de Tech. Cerrar o minimizar esta ventana no recarga el editor mientras sigas en esta página.</p>
          </div>
        </div>`;

      const frame = doc.createElement('iframe');
      frame.id = 'tech-paint-frame';
      frame.className = 'tech-paint-frame';
      frame.title = 'JSPaint: editor clásico de dibujo';
      frame.referrerPolicy = 'no-referrer';
      // Keep the editor on its own origin and prevent it from navigating this site.
      // File dialogs, explicit downloads and user-opened help windows remain available.
      frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-modals allow-downloads allow-popups');
      frame.src = EDITOR_URL;
      select('#tech-paint-editor').appendChild(frame);
      initialized = true;
      root.dataset.paintInitialized = 'true';
      observeChrome();
    }

    function render() {
      if (!initialized) return;
      root.classList.toggle('is-minimized', minimized);
      root.classList.toggle('is-expanded', expanded);
      select('#tech-paint-body').hidden = minimized;
      select('#tech-paint-minimized').hidden = !minimized;
      const minimizeButton = select('[data-paint-action="minimize"]');
      minimizeButton.disabled = minimized;
      minimizeButton.setAttribute('aria-expanded', String(!minimized));
      select('[data-paint-action="focus"]').disabled = minimized;
      const expandButton = select('[data-paint-action="expand"]');
      expandButton.disabled = minimized;
      expandButton.setAttribute('aria-pressed', String(expanded));
      expandButton.setAttribute('aria-label', expanded ? 'Restaurar el tamaño de Paint' : 'Ampliar el espacio de Paint');
      expandButton.textContent = expanded ? '▣' : '□';
      fitEditor();
    }

    function fitEditor() {
      if (destroyed || !initialized || root.hidden || minimized || expanded || !feed?.clientHeight) return;
      const windowElement = select('.tech-paint-window');
      const editor = select('#tech-paint-editor');
      if (!windowElement || !editor?.offsetHeight) return;
      // offset/client sizes share unzoomed CSS pixels, unlike client rects at site zoom.
      const chromeHeight = Math.max(0, windowElement.offsetHeight - editor.offsetHeight);
      const height = Math.max(280, Math.min(680, Math.floor(feed.clientHeight - chromeHeight - 24)));
      const value = `${height}px`;
      if (root.style.getPropertyValue('--tech-paint-editor-height') !== value) {
        root.style.setProperty('--tech-paint-editor-height', value);
      }
    }

    function observeChrome() {
      if (!resizeObserver || !initialized) return;
      ['.tech-paint-titlebar', '.tech-paint-toolbar', '.tech-paint-footer'].forEach(selector => {
        const element = select(selector);
        if (element) resizeObserver.observe(element);
      });
    }

    function focusConsole() {
      const input = doc.getElementById('terminal-cli-input');
      if (!input?.isConnected) return;
      input.focus({ preventScroll: true });
      const feed = input.closest('#center-feed');
      if (!feed) return;
      const field = input.getBoundingClientRect(), viewport = feed.getBoundingClientRect();
      if (field.top < viewport.top || field.bottom > viewport.bottom) {
        input.scrollIntoView({ block: 'nearest', behavior: motion() });
      }
    }

    function open() {
      if (destroyed) return false;
      for (let disclosure = root.closest('details'); disclosure; disclosure = disclosure.parentElement?.closest('details')) {
        disclosure.open = true;
      }
      build();
      minimized = false;
      root.hidden = false;
      render();
      root.scrollIntoView({ block: 'start', behavior: motion() });
      select('[data-paint-action="focus"]').focus({ preventScroll: true });
      return true;
    }

    function close() {
      if (destroyed || root.hidden) return false;
      root.hidden = true;
      focusConsole();
      return true;
    }

    function minimize() {
      if (destroyed || !initialized || root.hidden) return false;
      minimized = true;
      render();
      focusConsole();
      return true;
    }

    function expand() {
      if (destroyed || !initialized || root.hidden || minimized) return false;
      expanded = !expanded;
      render();
      root.scrollIntoView({ block: 'start', behavior: motion() });
      return true;
    }

    function focusEditor() {
      if (destroyed || !initialized || root.hidden || minimized) return;
      // This is only focus on the iframe element, not access to its foreign document.
      select('#tech-paint-frame').focus({ preventScroll: true });
    }

    const onClick = event => {
      const button = event.target.closest?.('[data-paint-action]');
      if (!button || !root.contains(button) || button.disabled) return;
      const action = button.dataset.paintAction;
      if (action === 'open') open();
      else if (action === 'close') close();
      else if (action === 'minimize') minimize();
      else if (action === 'expand') expand();
      else if (action === 'focus') focusEditor();
    };
    const onPageHide = event => {
      // Preserve both DOM and handlers when the complete page enters BFCache.
      if (!event.persisted) controller.destroy();
    };
    root.addEventListener('click', onClick);
    win.addEventListener('pagehide', onPageHide);
    win.addEventListener('resize', fitEditor);
    if (win.ResizeObserver && feed) {
      resizeObserver = new win.ResizeObserver(fitEditor);
      resizeObserver.observe(feed);
      observeChrome();
    }

    controller = Object.freeze({
      open, close, minimize, restore: open, expand,
      snapshot: () => ({ initialized, visible: !root.hidden, minimized, expanded }),
      destroy() {
        if (destroyed) return;
        destroyed = true;
        root.removeEventListener('click', onClick);
        win.removeEventListener('pagehide', onPageHide);
        win.removeEventListener('resize', fitEditor);
        resizeObserver?.disconnect();
        mounts.delete(root);
        // Do not reset the iframe. Explicit remounts can adopt the same draft session.
      }
    });
    mounts.set(root, controller);
    return controller;
  }

  function command(args = [], win = host) {
    if (!Array.isArray(args) || args.length > 1 || args.some(argument => typeof argument !== 'string')) return USAGE;
    const name = args.length ? args[0].toLowerCase() : 'open';
    if (!Object.hasOwn(ACTIONS, name)) return USAGE;
    const controller = mount(win);
    if (!controller) return 'El espacio de Paint no está disponible en esta sección.';
    const action = ACTIONS[name];
    if (action === 'close') return controller.close()
      ? 'Ventana de Paint cerrada. El dibujo sigue en esta página; paint la vuelve a abrir.'
      : 'Paint ya está cerrado. Escribe paint para abrirlo.';
    if (action === 'minimize') return controller.minimize()
      ? 'Paint minimizado. Usa paint restaurar o el botón Restaurar Paint.'
      : 'Paint no está abierto. Escribe paint para abrirlo.';
    controller.open();
    return 'Paint abierto en su propio espacio, debajo de la consola.\nJSPaint necesita conexión; guarda el dibujo desde Archivo antes de salir de Tech.';
  }

  host.TechPaint = Object.freeze({ mount, command });
})(typeof window === 'undefined' ? globalThis : window);
