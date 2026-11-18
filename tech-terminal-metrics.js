// Fictional NAVI activity, not telemetry from the visitor's computer.
(function (host) {
  'use strict';
  const PROFILE_COUNT = 160;
  const MEMORY_GIB = 4;
  const DISK_GIB = 232.88;
  const BOOT_SECONDS = 6 * 3600 + 17 * 60;
  const PROFILES = Object.freeze(Array.from({ length: PROFILE_COUNT }, (_, index) => {
    const activity = ((index * 73) % PROFILE_COUNT) / (PROFILE_COUNT - 1);
    const graphics = ((index * 37) % PROFILE_COUNT) / (PROFILE_COUNT - 1);
    return Object.freeze({
      cpu: 18 + activity * 17,
      gpu: 5 + graphics * 7,
      vram: 126 + graphics * 40 + activity * 8,
      memory: 2.11 + activity * .10 + graphics * .02,
      disk: 74.60 + index / (PROFILE_COUNT - 1) * .04,
      download: 160 + activity * 1050 + graphics * 220,
      upload: 120 + activity * 610 + graphics * 100
    });
  }));
  const mounts = new WeakMap();
  const models = new WeakMap();
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

  function mount(root, win = host) {
    if (!root || win.SiteAudioShell?.isHost || win.document.body?.id !== 'section-tech') return null;
    if (mounts.has(root)) return mounts.get(root);
    const doc = win.document;
    const pane = root.querySelector('.terminal-navi');
    const status = root.querySelector('.navi-status');
    const fields = Object.fromEntries(['cpu', 'gpu', 'vram', 'memory', 'disk', 'download', 'upload', 'uptime']
      .map(name => [name, root.querySelector(`[data-navi-metric="${name}"]`)]));
    if (!pane || !status || Object.values(fields).some(field => !field)) return null;
    const memoryMeter = root.querySelector('[data-navi-meter="memory"]');
    const diskMeter = root.querySelector('[data-navi-meter="disk"]');
    const memoryFill = root.querySelector('.navi-meter-memory');
    const diskFill = root.querySelector('.navi-meter-disk');
    const feed = root.closest('#center-feed');
    const random = () => win.Math.random();
    const now = () => win.performance.now();
    let model = models.get(root);
    if (!model) {
      model = {
        bootAt: now(), target: Math.floor(random() * PROFILE_COUNT),
        changeAt: now() + 12000 + random() * 14000,
        values: { cpu: 28, gpu: 9, vram: 152, memory: 2.16, disk: 74.62, download: 228, upload: 221 }
      };
      models.set(root, model);
    }
    let timer = null, running = false, destroyed = false;
    const cleanups = [];
    const listen = (element, name, callback, options) => {
      if (!element) return;
      element.addEventListener(name, callback, options);
      cleanups.push(() => element.removeEventListener(name, callback, options));
    };
    const write = (element, value) => { if (element.textContent !== value) element.textContent = value; };
    const secondsUp = () => BOOT_SECONDS + Math.max(0, Math.floor((now() - model.bootAt) / 1000));
    const rate = value => value < 1024 ? `${Math.round(value)} B/s` : `${(value / 1024).toFixed(2)} KiB/s`;
    function meter(element, fill, value, label) {
      const percent = clamp(value, 0, 100);
      element?.setAttribute('aria-label', `${label} simulada: ${percent.toFixed(1)}%`);
      if (fill) {
        const width = `${percent.toFixed(2)}%`;
        if (fill.style.width !== width) fill.style.width = width;
      }
    }
    function render() {
      const value = model.values, up = secondsUp();
      write(fields.cpu, ` · ${value.cpu.toFixed(1)}%`);
      write(fields.gpu, ` · ${value.gpu.toFixed(1)}%`);
      write(fields.vram, `${Math.round(value.vram)} MiB / 768 MiB GDDR3`);
      write(fields.memory, `${value.memory.toFixed(2)} GiB / ${MEMORY_GIB.toFixed(2)} GiB`);
      write(fields.disk, `${value.disk.toFixed(2)} GiB / ${DISK_GIB.toFixed(2)} GiB`);
      write(fields.download, rate(value.download)); write(fields.upload, rate(value.upload));
      write(fields.uptime, `${Math.floor(up / 3600)}h ${Math.floor(up / 60) % 60}m ${up % 60}s`);
      meter(memoryMeter, memoryFill, value.memory / MEMORY_GIB * 100, 'Memoria');
      meter(diskMeter, diskFill, value.disk / DISK_GIB * 100, 'Ocupación de disco');
    }
    function visible() {
      if (destroyed || doc.hidden || !root.isConnected || status.hidden || !status.getClientRects().length) return false;
      const rect = status.getBoundingClientRect(), paneRect = pane.getBoundingClientRect();
      const feedRect = feed?.getBoundingClientRect();
      const top = Math.max(0, paneRect.top, feedRect?.top ?? 0);
      const bottom = Math.min(win.innerHeight, paneRect.bottom, feedRect?.bottom ?? win.innerHeight);
      return rect.width > 0 && rect.height > 0 && rect.bottom > top && rect.top < bottom;
    }
    function stop() {
      if (timer !== null) win.clearTimeout(timer);
      timer = null; running = false;
    }
    function nextTarget() {
      // Uniformly select another profile; no immediate repeat or enormous jumps in the UI.
      model.target = (model.target + 1 + Math.floor(random() * (PROFILE_COUNT - 1))) % PROFILE_COUNT;
      model.changeAt = now() + 12000 + random() * 14000;
    }
    function approach(name, step, noise, low, high) {
      const current = model.values[name], target = PROFILES[model.target][name];
      const change = clamp((target - current) * .18 + (random() - .5) * noise, -step, step);
      model.values[name] = clamp(current + change, low, high);
    }
    function advance() {
      if (now() >= model.changeAt) nextTarget();
      approach('cpu', 1.3, .5, 16, 38);
      approach('gpu', .8, .25, 4, 14);
      approach('vram', 2, .8, 120, 178);
      approach('memory', .003, .001, 2.10, 2.24);
      // Only temporary-file-sized disk changes, never gigabytes appearing every tick.
      approach('disk', .0007, .00015, 74.59, 74.65);
      approach('download', 90, 24, 100, 1800);
      approach('upload', 70, 18, 80, 1050);
    }
    function schedule() { timer = win.setTimeout(tick, 2200 + Math.floor(random() * 1800)); }
    function tick() {
      timer = null;
      if (!visible()) { stop(); return; }
      advance(); render(); schedule();
    }
    function syncVisibility() {
      if (destroyed) return;
      if (!visible()) { stop(); return; }
      if (!running) { running = true; render(); schedule(); }
    }
    listen(doc, 'visibilitychange', syncVisibility);
    listen(doc, 'scroll', syncVisibility, true);
    listen(win, 'resize', syncVisibility);
    for (let disclosure = root.closest('details'); disclosure; disclosure = disclosure.parentElement?.closest('details')) {
      listen(disclosure, 'toggle', syncVisibility);
    }
    if (win.MutationObserver) {
      const observer = new win.MutationObserver(syncVisibility);
      observer.observe(status, { attributes: true, attributeFilter: ['hidden'] });
      const panel = root.closest('.panel');
      for (const element of [panel, panel?.querySelector('.panel-body'), pane]) {
        if (element) observer.observe(element, { attributes: true, attributeFilter: ['hidden', 'style', 'class'] });
      }
      cleanups.push(() => observer.disconnect());
    }
    if (win.IntersectionObserver) {
      const observer = new win.IntersectionObserver(syncVisibility, { root: feed || null });
      observer.observe(status); cleanups.push(() => observer.disconnect());
    }
    const controller = Object.freeze({
      snapshot: () => ({ simulated: true, profileCount: PROFILE_COUNT, targetProfile: model.target + 1,
        running, uptimeSeconds: secondsUp(), values: { ...model.values } }),
      destroy() {
        if (destroyed) return;
        destroyed = true; stop(); cleanups.splice(0).forEach(cleanup => cleanup()); mounts.delete(root);
        // The weakly held model survives a BFCache terminal remount, not a new page visit.
      }
    });
    mounts.set(root, controller);
    render(); syncVisibility();
    return controller;
  }
  const api = Object.freeze({ mount, PROFILE_COUNT, PROFILES });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else host.TechTerminalMetrics = api;
})(typeof window === 'undefined' ? globalThis : window);
