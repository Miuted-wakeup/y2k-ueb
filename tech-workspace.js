// Blog navigation, an optional laboratory and a manual filmstrip. No autoplay or network calls.
(function (win) {
  'use strict';
  if (win.SiteAudioShell?.isHost) return;
  function mount() {
    const doc = win.document;
    if (doc.body.id !== 'section-tech') return;
    const workspace = doc.querySelector('.tech-workspace');
    if (!workspace || workspace.dataset.workbenchReady) return;
    workspace.dataset.workbenchReady = 'true';
    const cleanup = [];
    const listen = (element, name, handler, options) => {
      element.addEventListener(name, handler, options);
      cleanup.push(() => element.removeEventListener(name, handler, options));
    };
    const motion = () => win.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    const content = doc.getElementById('center-feed');
    workspace.querySelectorAll('[data-tech-section]').forEach(button => {
      listen(button, 'click', () => {
        const target = doc.getElementById(button.dataset.techSection);
        if (!target) return;
        // An explicit jump to a tool reveals its closed laboratory first.
        for (let disclosure = target.closest('details'); disclosure; disclosure = disclosure.parentElement?.closest('details')) {
          disclosure.open = true;
        }
        if (content?.contains(target)) {
          // Scroll the blog column only, never its fixed author rail or masthead.
          const zoom = Number(win.getComputedStyle(doc.documentElement).zoom) || 1;
          const inset = parseFloat(win.getComputedStyle(content).scrollPaddingTop) || 0;
          const top = content.scrollTop + (target.getBoundingClientRect().top - content.getBoundingClientRect().top) / zoom - inset;
          content.scrollTo({ top: Math.max(0, top), behavior: motion() });
        }
        const focus = target.id === 'panel-tech-terminal' ? doc.getElementById('terminal-cli-input')
          : target.matches('details') ? target.querySelector('summary') : target;
        focus?.focus({ preventScroll: true });
      });
    });
    const track = doc.getElementById('tech-gadget-track');
    if (track) {
      const cards = Array.from(track.querySelectorAll('.gadget-card'));
      const previous = workspace.querySelector('[data-carousel-step="-1"]');
      const next = workspace.querySelector('[data-carousel-step="1"]');
      const position = workspace.querySelector('.tech-carousel-position');
      const controls = workspace.querySelector('.tech-carousel-controls');
      let active = 0, frame = 0, announced = '';
      cards.forEach((card, index) => {
        card.setAttribute('role', 'group');
        card.setAttribute('aria-roledescription', 'diapositiva');
        card.setAttribute('aria-label', `${index + 1} de ${cards.length}`);
      });
      function update() {
        frame = 0;
        if (!cards.length || !track.getClientRects().length) return;
        const bounds = track.getBoundingClientRect();
        const left = bounds.left;
        active = cards.reduce((best, card, index) =>
          Math.abs(card.getBoundingClientRect().left - left) < Math.abs(cards[best].getBoundingClientRect().left - left) ? index : best, 0);
        cards.forEach((card, index) => card.classList.toggle('is-current', index === active));
        const end = track.scrollWidth - track.clientWidth;
        previous.disabled = track.scrollLeft <= 2;
        next.disabled = track.scrollLeft >= end - 2;
        const visible = cards.map((card, index) => ({ rect: card.getBoundingClientRect(), index }))
          .filter(({ rect }) => Math.min(rect.right, bounds.right) - Math.max(rect.left, bounds.left) >= rect.width / 2);
        const start = (visible[0]?.index ?? active) + 1;
        const finish = (visible[visible.length - 1]?.index ?? active) + 1;
        const range = `${String(start).padStart(2, '0')}–${String(finish).padStart(2, '0')} / ${String(cards.length).padStart(2, '0')}`;
        if (range !== announced) {
          position.textContent = range;
          announced = range;
        }
      }
      function queueUpdate() {
        if (!frame) frame = win.requestAnimationFrame(update);
      }
      function move(step) {
        const width = cards[0]?.getBoundingClientRect().width || track.clientWidth;
        // Client rects include the site's zoom; scrollLeft uses unzoomed CSS pixels.
        const zoom = Number(win.getComputedStyle(doc.documentElement).zoom) || 1;
        track.scrollBy({ left: step * (width / zoom + 10), behavior: motion() });
      }
      listen(previous, 'click', () => move(-1));
      listen(next, 'click', () => move(1));
      listen(track, 'scroll', queueUpdate, { passive: true });
      listen(win, 'resize', queueUpdate);
      const laboratory = track.closest('details');
      if (laboratory) listen(laboratory, 'toggle', queueUpdate);
      if (win.ResizeObserver) {
        const observer = new win.ResizeObserver(queueUpdate);
        observer.observe(track);
        cleanup.push(() => observer.disconnect());
      }
      listen(track, 'keydown', event => {
        if (event.target !== track || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        if (event.key === 'Home' || event.key === 'End') track.scrollTo({ left: event.key === 'Home' ? 0 : track.scrollWidth, behavior: motion() });
        else move(event.key === 'ArrowLeft' ? -1 : 1);
      });
      controls.hidden = false;
      queueUpdate();
      cleanup.push(() => { if (frame) win.cancelAnimationFrame(frame); });
    }
    const stop = event => {
      cleanup.splice(0).forEach(remove => remove());
      delete workspace.dataset.workbenchReady;
      win.removeEventListener('pagehide', stop);
      if (event.persisted) win.addEventListener('pageshow', mount, { once: true });
    };
    win.addEventListener('pagehide', stop);
  }
  if (win.document.readyState === 'loading') win.document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})(window);
