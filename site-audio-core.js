// Shared, side-effect-free URL/protocol registry. Never fetches or grants audio.
(function (host, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else host.SiteAudioCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const PROTOCOL = 'muted-audio/v1', FRAME_PARAM = '__y2k_frame', EPOCH_PARAM = '__y2k_epoch';
  const SECTIONS = Object.freeze([
    { section: 'home', file: 'index.html', label: 'HOME', accent: '#ec1732' },
    { section: 'japan', file: 'japan.html', label: 'JAPAN', accent: '#006aff' },
    { section: 'music', file: 'music.html', label: 'MUSIC', accent: '#ae00ff' },
    { section: 'canto', file: 'canto.html', label: 'CANTO', accent: '#00d9e8' },
    { section: 'tech', file: 'tech.html', label: 'TECH', accent: '#18a7cf' },
    { section: 'sobre-mi', file: 'sobre-mi.html', label: 'SOBRE MÍ', accent: '#929eae' },
    { section: 'cosas', file: 'cosas.html', label: 'COSAS', accent: '#ac47e0' }
  ].map(Object.freeze));
  const PLAYLIST = Object.freeze([
    { title: 'Onii Yuukai', artist: 'Vocaloid', src: 'assets/music/onii_yuukai.mp3' },
    { title: 'Matryoshka', artist: 'Hatsune Miku & Gumi', src: 'assets/music/matryoshka.mp3' },
    { title: 'hatachi no koi', artist: 'sped up', src: 'assets/music/hatachi.mp3' },
    { title: 'Fly, Kirby!', artist: "Kirby's Return to Dream Land", src: 'assets/music/kirby.mp3' },
    { title: 'TouhouMAD - Nitori Get Down!', artist: '小野崎人', src: 'assets/music/nitori.mp3' },
    { title: 'aishite aishite aishite', artist: 'kikuo', src: 'assets/music/aishite.mp3' }
  ].map(Object.freeze));
  const kinds = new Set(['hello', 'state', 'command', 'ack', 'navigate', 'replace', 'page-ready', 'page-leaving', 'request-activation']);
  const validToken = token => typeof token === 'string' && /^[a-f0-9]{32}$/i.test(token);
  const validEpoch = epoch => Number.isSafeInteger(epoch) && epoch > 0 && epoch <= 2147483647;

  function publicURL(href) {
    try {
      const url = new URL(href);
      // Preserve all non-reserved query bytes (URLSearchParams.delete rewrites spaces).
      const pairs = url.search.slice(1).split('&').filter(pair => {
        let key;
        try { key = decodeURIComponent(pair.split('=')[0].replace(/\+/g, ' ')); } catch (_) { return true; }
        return key !== FRAME_PARAM && key !== EPOCH_PARAM;
      });
      url.search = pairs.filter(Boolean).length ? '?' + pairs.join('&') : '';
      return url.href;
    } catch (_) { return null; }
  }

  function resolveRoute(href, base) {
    if (typeof href !== 'string' || typeof base !== 'string') return null;
    try {
      const root = new URL(base), input = new URL(href, root);
      if (!['http:', 'https:', 'file:'].includes(input.protocol) || input.protocol !== root.protocol ||
          input.origin !== root.origin || input.username || input.password || /%2f|%5c/i.test(input.pathname)) return null;
      const directory = root.pathname.slice(0, root.pathname.lastIndexOf('/') + 1);
      const entry = SECTIONS.find(section => input.pathname === directory + section.file ||
        (input.protocol !== 'file:' && input.pathname === directory + section.file.slice(0, -5)) ||
        (section.section === 'home' && input.pathname === directory));
      if (!entry) return null;
      const url = new URL(publicURL(input.href));
      const file = new URL(url.href); file.pathname = directory + entry.file;
      return { section: entry.section, href: url.href, fileHref: file.href };
    } catch (_) { return null; }
  }

  function initialRoute(href) {
    const clean = publicURL(href);
    if (!clean) return null;
    const url = new URL(clean);
    if (url.protocol === 'file:' && url.hash.startsWith('#/')) {
      const route = resolveRoute(url.hash.slice(2), clean);
      if (route) return route;
    }
    return resolveRoute(clean, clean);
  }

  function frameURL(route, token, epoch) {
    if (!route || !validToken(token) || !validEpoch(epoch)) throw new TypeError('Invalid owned frame capability');
    const url = new URL(publicURL(route.fileHref));
    url.search += (url.search ? '&' : '?') + FRAME_PARAM + '=' + token + '&' + EPOCH_PARAM + '=' + epoch;
    return url.href;
  }

  function frameInfo(win) {
    try {
      if (!win || win.parent === win) return null;
      const url = new URL(win.location.href);
      if (url.searchParams.getAll(FRAME_PARAM).length !== 1 || url.searchParams.getAll(EPOCH_PARAM).length !== 1) return null;
      const token = url.searchParams.get(FRAME_PARAM), epoch = Number(url.searchParams.get(EPOCH_PARAM));
      if (!validToken(token) || !validEpoch(epoch)) return null;
      const clean = publicURL(url.href);
      if (!resolveRoute(clean, clean)) return null;
      return { token, epoch, publicURL: clean };
    } catch (_) { return null; }
  }

  function historyURL(route, initialTopURL) {
    const top = new URL(publicURL(initialTopURL));
    if (top.protocol !== 'file:') return route.href;
    const target = new URL(route.href), entry = SECTIONS.find(item => item.section === route.section);
    top.hash = '/' + entry.file + target.search + target.hash;
    return top.href;
  }

  function validEnvelope(data, token, epoch) {
    return !!data && typeof data === 'object' && !Array.isArray(data) &&
      ['channel', 'kind', 'token', 'epoch'].every(key => Object.hasOwn(data, key)) &&
      data.channel === PROTOCOL && kinds.has(data.kind) && data.token === token && data.epoch === epoch &&
      validToken(token) && validEpoch(epoch);
  }
  return Object.freeze({ PROTOCOL, FRAME_PARAM, EPOCH_PARAM, SECTIONS, PLAYLIST,
    publicURL, resolveRoute, initialRoute, frameURL, frameInfo, historyURL, validEnvelope, validToken, validEpoch });
});
