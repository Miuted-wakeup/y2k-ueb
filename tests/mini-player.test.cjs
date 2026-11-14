// Focused Mini TV contracts: real production handlers, a minimal DOM, no network.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '..', 'scripts.js'), 'utf8');
const extract = (start, end) => {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `Keep a clear handler boundary: ${start}`);
  return source.slice(from, to);
};
const handlers = extract('// 1. Selector de Fases de la Rutina Vocal', '// 2. Selector de Estado Vocal')
  + extract('// A collapsed archive must not keep playing media behind hidden controls.', '// 5. Tablero de Estampas');

function fixture(protocol = 'https:') {
  let htmlWrites = 0;
  class Element {
    constructor(tagName, attributes = {}) {
      this.tagName = tagName.toUpperCase();
      this.attributes = { ...attributes };
      this.children = [];
      this.style = {};
      this.listeners = {};
      this._text = '';
      for (const name of ['src', 'href', 'target', 'rel', 'title', 'referrerPolicy', 'width', 'height', 'allow']) {
        Object.defineProperty(this, name, { get: () => this.getAttribute(name.toLowerCase()) || '', set: value => this.setAttribute(name.toLowerCase(), value) });
      }
      this.classList = {
        contains: value => this.className.split(/\s+/).includes(value),
        add: value => { if (!this.classList.contains(value)) this.className = `${this.className} ${value}`.trim(); },
        remove: value => { this.className = this.className.split(/\s+/).filter(token => token !== value).join(' '); },
      };
    }
    get id() { return this.attributes.id || ''; }
    get className() { return this.attributes.class || ''; }
    set className(value) { this.attributes.class = value; }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    getAttribute(name) { return this.attributes[name] ?? null; }
    appendChild(child) { child.parentElement = this; this.children.push(child); return child; }
    replaceChildren(...children) {
      this.children.forEach(child => { child.parentElement = null; });
      this.children = [];
      this._text = '';
      children.forEach(child => this.appendChild(child));
    }
    get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
    set textContent(value) { this.replaceChildren(); this._text = String(value); }
    // Model the old iframe assignment too, so RED observes the actual bad file:// path.
    set innerHTML(value) {
      htmlWrites++;
      this.replaceChildren();
      const iframe = /<iframe\b([^>]*)>/i.exec(value);
      if (iframe) {
        const frame = new Element('iframe');
        for (const attr of iframe[1].matchAll(/([\w-]+)="([^"]*)"/g)) frame.setAttribute(attr[1], attr[2]);
        this.appendChild(frame);
      }
    }
    addEventListener(name, listener) { (this.listeners[name] ||= []).push(listener); }
    dispatch(name) { (this.listeners[name] || []).forEach(listener => listener({ target: this })); }
    click() { this.dispatch('click'); }
    querySelectorAll(selector) {
      const matches = element => selector.split(',').some(part => {
        const token = part.trim();
        return token.startsWith('.') ? element.classList.contains(token.slice(1))
          : token.startsWith('#') ? element.id === token.slice(1)
            : element.tagName === token.toUpperCase();
      });
      return this.children.flatMap(child => [...(matches(child) ? [child] : []), ...child.querySelectorAll(selector)]);
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  }
  const root = new Element('body');
  const append = (parent, tag, attributes) => parent.appendChild(new Element(tag, attributes));
  const archive = append(root, 'details', { id: 'sm-vocal-archive' });
  archive.open = true;
  const videos = ['T-XpMyNkfPU', 'p6KUgtvQpv8'];
  const phases = videos.map((video, index) => {
    const phase = index + 1;
    const tab = append(archive, 'button', { class: `sm-routine-tab-btn${index ? '' : ' active'}`, 'data-phase': phase });
    const pane = append(archive, 'div', { id: `phase-${phase}`, class: `sm-phase-pane${index ? '' : ' active'}` });
    const toggle = append(pane, 'button', { class: 'sm-yt-player-toggle', 'data-video': video, 'data-target': `tv-embed-${phase}` });
    const directLink = append(pane, 'a', { class: 'sm-yt-direct', href: `https://www.youtube.com/watch?v=${video}` });
    const container = append(pane, 'div', { id: `tv-embed-${phase}`, class: 'sm-cyber-tv-embed' });
    container.style.display = 'none';
    const close = append(container, 'button', { class: 'sm-cyber-tv-close', 'data-target': container.id });
    const wrap = append(container, 'div', { class: 'sm-cyber-tv-frame-wrap' });
    return { video, tab, pane, toggle, directLink, container, close, wrap };
  });
  let tunerStops = 0;
  let windowOpens = 0;
  vm.runInNewContext(handlers, {
    document: {
      querySelectorAll: selector => root.querySelectorAll(selector),
      getElementById: id => root.querySelector(`#${id}`),
      createElement: tag => new Element(tag),
    },
    location: { protocol, origin: protocol === 'file:' ? 'null' : `${protocol}//localhost:8080` },
    window: { open: () => windowOpens++ },
    URL,
    playRetroChime: () => {},
    stopTunerTone: () => tunerStops++,
  });
  return { root, archive, phases, htmlWrites: () => htmlWrites, tunerStops: () => tunerStops, windowOpens: () => windowOpens };
}

test('file:// shows honest local-server help and a safe explicit YouTube link, never a broken iframe', () => {
  const app = fixture('file:');
  const player = app.phases[0];
  player.toggle.click();
  assert.equal(app.root.querySelectorAll('iframe').length, 0, 'A file:// page cannot supply YouTube\'s required HTTP Referer');
  assert.match(player.wrap.textContent, /Abre la página desde un servidor local para usar la Mini TV\./);
  const link = player.wrap.querySelector('a');
  assert.equal(link.href, `https://www.youtube.com/watch?v=${player.video}`);
  assert.equal(link.target, '_blank');
  assert.ok(link.rel.split(/\s+/).includes('noopener'));
  assert.equal(player.directLink.getAttribute('href'), link.href, 'Preserve the original direct link too');
  assert.equal(app.windowOpens(), 0, 'Do not open an external page without a separate link activation');
  assert.equal(app.htmlWrites(), 0, 'Build media/help with DOM APIs rather than interpolated HTML');
});

for (const protocol of ['http:', 'https:']) {
  test(`${protocol} embeds with a real browser referrer policy and always-visible escape link`, () => {
    const app = fixture(protocol);
    const player = app.phases[0];
    player.toggle.click();
    const iframe = player.wrap.querySelector('iframe');
    assert.ok(iframe);
    const url = new URL(iframe.src);
    assert.equal(url.origin, 'https://www.youtube-nocookie.com');
    assert.equal(url.pathname, `/embed/${player.video}`);
    assert.notEqual(url.searchParams.get('autoplay'), '1', 'Opening a player outside the viewport must not autoplay');
    assert.equal(url.searchParams.get('origin'), null, 'Do not invent a YouTube client origin');
    assert.equal(iframe.referrerPolicy, 'strict-origin-when-cross-origin');
    assert.ok(iframe.title);
    assert.equal(iframe.allowFullscreen, true);
    assert.ok(player.wrap.querySelector('.sm-tv-help'));
    assert.match(player.wrap.textContent, /YouTube/);
    assert.equal(player.wrap.querySelector('a').href, `https://www.youtube.com/watch?v=${player.video}`);
    assert.equal(app.htmlWrites(), 0);
  });
}

test('invalid IDs never become an embed URL, injected markup, or external link', () => {
  for (const value of ['', 'short', '../T-XpMyNkfPU', '"><script>alert(1)</script>']) {
    const app = fixture();
    const player = app.phases[0];
    player.toggle.setAttribute('data-video', value);
    player.toggle.click();
    assert.equal(player.wrap.querySelectorAll('iframe, a, script').length, 0);
    assert.ok(player.wrap.querySelector('.sm-tv-help'), 'Explain an invalid clip instead of constructing an unsafe URL');
    assert.equal(app.htmlWrites(), 0);
  }
});

test('one player at a time; toggle and close unload media and reset disclosure semantics', () => {
  const app = fixture();
  const [first, second] = app.phases;
  for (const player of app.phases) {
    assert.equal(player.toggle.getAttribute('aria-controls'), player.container.id);
    assert.equal(player.toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(player.close.getAttribute('aria-controls'), player.container.id);
    assert.equal(player.container.getAttribute('role'), 'region');
  }
  first.toggle.click();
  assert.equal(first.toggle.getAttribute('aria-expanded'), 'true');
  second.toggle.click();
  assert.equal(app.root.querySelectorAll('iframe').length, 1);
  assert.equal(first.wrap.children.length, 0);
  assert.equal(first.container.style.display, 'none');
  assert.equal(first.toggle.getAttribute('aria-expanded'), 'false');
  second.toggle.click();
  assert.equal(second.wrap.children.length, 0);
  assert.equal(second.toggle.getAttribute('aria-expanded'), 'false');
  second.toggle.click();
  second.close.click();
  assert.equal(second.container.style.display, 'none');
  assert.equal(second.wrap.children.length, 0);
  assert.equal(second.toggle.getAttribute('aria-expanded'), 'false');
});

test('phase changes and archive collapse unload hidden media; opening the archive does not close it', () => {
  const app = fixture();
  const [first, second] = app.phases;
  first.toggle.click();
  second.tab.click();
  assert.equal(first.wrap.children.length, 0, 'Changing phase must stop the previous video');
  assert.equal(first.toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(first.pane.classList.contains('active'), false);
  assert.equal(second.pane.classList.contains('active'), true);
  second.toggle.click();
  app.archive.dispatch('toggle');
  assert.equal(app.root.querySelectorAll('iframe').length, 1, 'An open archive must keep its visible player');
  app.archive.open = false;
  app.archive.dispatch('toggle');
  assert.equal(app.root.querySelectorAll('iframe').length, 0);
  assert.equal(second.wrap.children.length, 0);
  assert.equal(second.toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(app.tunerStops(), 1, 'Preserve tuner shutdown on collapse');
});
