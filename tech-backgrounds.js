// A per-browser wallpaper choice. Never changes another section or accepts remote URLs.
(function (host) {
  'use strict';
  const KEY = 'muted:tech-wallpaper:v1';
  const mounts = new WeakMap();

  function mount(win = host) {
    if (win.SiteAudioShell?.isHost || win.document.body?.id !== 'section-tech') return null;
    const doc = win.document, panel = doc.getElementById('tech-wallpaper-settings');
    if (!panel) return null;
    if (mounts.has(panel)) return mounts.get(panel);
    const grid = doc.getElementById('tech-wallpaper-grid');
    const toggle = doc.getElementById('tech-wallpaper-toggle');
    const closeButton = doc.getElementById('tech-wallpaper-close');
    const resetButton = doc.getElementById('tech-wallpaper-reset');
    const status = doc.getElementById('tech-wallpaper-status');
    const entries = Array.from(win.TechWallpaperCatalog || []);
    const catalog = new Map(entries.map(entry => [entry.id, entry]));
    if (!grid || !toggle || !closeButton || !resetButton || !status || !catalog.has('original')) return null;
    let current = 'original', generation = 0, pendingImage = null, previousFocus = null, destroyed = false;
    const listeners = [], choices = new Map();
    const listen = (node, event, callback) => {
      node.addEventListener(event, callback);
      listeners.push(() => node.removeEventListener(event, callback));
    };
    const motion = () => win.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    function selected() {
      choices.forEach((button, id) => button.setAttribute('aria-pressed', String(id === current)));
      doc.body.dataset.techWallpaper = current;
    }
    function cancelImage() {
      generation++;
      if (pendingImage) { pendingImage.onload = null; pendingImage.onerror = null; pendingImage = null; }
    }
    function apply(id, { persist = true } = {}) {
      if (destroyed || !catalog.has(id)) return false;
      const entry = catalog.get(id);
      cancelImage();
      const turn = generation;
      const commit = () => {
        if (destroyed || turn !== generation) return;
        pendingImage = null;
        if (id === 'original') doc.body.style.removeProperty('background-image');
        else doc.body.style.backgroundImage = `url("${entry.src}")`;
        current = id;
        selected();
        let saved = true;
        if (persist) {
          try { win.localStorage.setItem(KEY, id); } catch (_) { saved = false; }
        }
        status.textContent = `Fondo actual: ${entry.title}. ` + (saved ? 'Tu elección es local a este navegador.' : 'Aplicado en esta visita; el navegador no permite guardar la preferencia.');
      };
      if (id === 'original') { commit(); return true; }
      status.textContent = `Cargando ${entry.title}…`;
      const image = new win.Image();
      pendingImage = image;
      image.onload = commit;
      image.onerror = () => {
        if (destroyed || turn !== generation) return;
        pendingImage = null;
        status.textContent = `No se pudo cargar ${entry.title}. Se mantiene el fondo anterior.`;
      };
      image.src = entry.src;
      return true;
    }
    function open() {
      if (panel.hidden) previousFocus = doc.activeElement;
      panel.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
      panel.scrollIntoView({ block: 'start', behavior: motion() });
      (choices.get(current) || closeButton).focus({ preventScroll: true });
    }
    function close() {
      panel.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
      const target = previousFocus?.isConnected ? previousFocus : toggle;
      target.focus({ preventScroll: true });
    }
    grid.replaceChildren();
    entries.forEach(entry => {
      const button = doc.createElement('button');
      button.type = 'button'; button.className = 'tech-wallpaper-choice';
      button.setAttribute('aria-pressed', String(entry.id === current));
      button.setAttribute('aria-label', `Aplicar fondo: ${entry.title}`);
      const image = doc.createElement('img');
      image.src = entry.thumbnail; image.alt = ''; image.width = 160; image.height = 100;
      image.loading = 'lazy'; image.decoding = 'async';
      const title = doc.createElement('span'); title.textContent = entry.title;
      button.append(image, title); grid.append(button); choices.set(entry.id, button);
      listen(button, 'click', () => apply(entry.id));
    });
    listen(toggle, 'click', () => panel.hidden ? open() : close());
    listen(closeButton, 'click', close);
    listen(resetButton, 'click', () => apply('original'));
    listen(panel, 'keydown', event => { if (event.key === 'Escape') { event.preventDefault(); close(); } });
    let saved = 'original';
    try { const value = win.localStorage.getItem(KEY); if (catalog.has(value)) saved = value; } catch (_) {}
    selected();
    if (saved !== 'original') apply(saved, { persist: false });
    const controller = {
      open, close, apply,
      list: () => entries.map(entry => `${entry.id.padEnd(13)} ${entry.title}`).join('\n'),
      destroy() {
        if (destroyed) return;
        destroyed = true; cancelImage(); listeners.splice(0).forEach(remove => remove()); mounts.delete(panel);
      }
    };
    listen(win, 'pagehide', event => {
      if (!event.persisted) controller.destroy();
    });
    mounts.set(panel, controller);
    return controller;
  }
  function command(args = [], win = host) {
    const controller = mount(win);
    if (!controller) return 'No se pudo abrir el selector de fondos.';
    if (!args.length) { controller.open(); return 'Propiedades de pantalla abiertas fuera de la consola. Elige un fondo o usa fondo original.'; }
    if (args.length > 1) return 'Usa fondo, fondo lista, fondo original o fondo <id>.';
    if (args[0] === 'lista') return 'Fondos disponibles:\n' + controller.list() + '\n\nEjemplo: fondo asadal-2';
    return controller.apply(args[0]) ? 'Aplicando el fondo seleccionado. Tu elección solo afecta a Tech en este navegador.' : 'Fondo desconocido. Escribe fondo lista para ver los identificadores.';
  }
  host.TechBackgrounds = Object.freeze({ mount, command });
  if (typeof host.document !== 'undefined') {
    if (host.document.readyState === 'loading') host.document.addEventListener('DOMContentLoaded', () => mount(host), { once: true });
    else mount(host);
  }
})(window);
