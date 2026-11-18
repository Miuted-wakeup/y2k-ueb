// Continuous right-to-left ribbon. Copy stays in HTML; there are no slide controls.
(function (win) {
  'use strict';
  if (win.SiteAudioShell?.isHost) return;
  const SPEED = 32; // Logical CSS pixels per second, independent of the site's zoom.

  function mount() {
    const doc = win.document;
    if (doc.body.id !== 'section-tech') return;
    const root = doc.querySelector('#header-marquee.tech-header-ticker');
    if (!root || root.dataset.headerTickerReady) return;
    const viewport = root.querySelector('.tech-header-viewport');
    const track = root.querySelector('.tech-header-track');
    const original = track?.querySelector('.tech-header-copy');
    if (!viewport || !track || !original) return;
    const copy = original.cloneNode(true);
    copy.setAttribute('aria-hidden', 'true');
    track.append(copy);
    const cleanup = [];
    let frame = 0, previousTime = null, offset = 0, cycle = 0, observer = null;
    let focused = viewport.contains(doc.activeElement), suspended = false, destroyed = false;
    root.dataset.headerTickerReady = 'true';
    const listen = (target, type, handler) => {
      target.addEventListener(type, handler);
      cleanup.push(() => target.removeEventListener(type, handler));
    };
    function stop() {
      if (frame) win.cancelAnimationFrame(frame);
      frame = 0; previousTime = null;
    }
    function measure() {
      if (destroyed) return;
      cycle = original.offsetWidth;
      if (cycle > 0) offset %= cycle;
      track.style.transform = `translateX(${-offset}px)`;
    }
    function tick(timestamp) {
      frame = 0;
      if (destroyed || suspended || focused || doc.hidden || cycle <= 0) { previousTime = null; return; }
      if (previousTime !== null) offset = (offset + Math.min(100, timestamp - previousTime) * SPEED / 1000) % cycle;
      previousTime = timestamp;
      track.style.transform = `translateX(${-offset}px)`;
      frame = win.requestAnimationFrame(tick);
    }
    function start() {
      if (!frame && !destroyed && !suspended && !focused && !doc.hidden && cycle > 0) {
        previousTime = null;
        frame = win.requestAnimationFrame(tick);
      }
    }

    listen(viewport, 'focusin', () => { focused = true; stop(); });
    listen(viewport, 'focusout', () => { focused = false; start(); });
    listen(doc, 'visibilitychange', () => {
      if (doc.hidden) stop();
      else { measure(); start(); }
    });
    if (typeof win.ResizeObserver === 'function') {
      observer = new win.ResizeObserver(() => { measure(); start(); });
      observer.observe(original); observer.observe(viewport);
    } else listen(win, 'resize', () => { measure(); start(); });
    doc.fonts?.ready.then(() => { if (!destroyed) { measure(); start(); } }, () => {});
    function destroy() {
      if (destroyed) return;
      destroyed = true; stop(); observer?.disconnect();
      cleanup.splice(0).forEach(remove => remove());
      copy.remove(); track.style.removeProperty('transform');
      delete root.dataset.headerTickerReady;
    }
    listen(win, 'pagehide', event => {
      suspended = true; stop();
      if (!event.persisted) destroy();
    });
    listen(win, 'pageshow', event => {
      if (event.persisted) { suspended = false; focused = viewport.contains(doc.activeElement); measure(); start(); }
    });
    measure(); start();
  }
  if (win.document.readyState === 'loading') win.document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})(window);
