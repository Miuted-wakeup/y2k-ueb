// Original bitmap glyphs and portrait composition. The director owns timing and text.
(function (root, factory) {
  const art = factory();
  if (typeof module === 'object' && module.exports) module.exports = art;
  else root.HomeCompanionArt = art;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const cellSize = 12;
  const sheetSize = 96;
  // These are actual atlas positions, not an ASCII code-point offset. The
  // source includes PlayStation symbols where another font might have $ or @.
  const rows = [
    '!"#□%&△(',
    ')®+,-./0',
    '12345678',
    '9:;<=>?↑',
    'ABCDEFGH',
    'IJKLMNOP',
    'QRSTUVWX',
    "YZ↓←→○'×",
  ];
  const cells = new Map();
  rows.forEach((characters, row) => {
    Array.from(characters).forEach((character, column) => cells.set(character, { column, row, character }));
  });

  // Inverted Spanish marks use the same original cell rotated, not a missing-glyph ?.
  const inverted = new Map([['¿', '?'], ['¡', '!']]);

  function normalizeText(text) {
    const normalized = String(text ?? '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
      .replace(/[‘’‹›]/g, "'").replace(/[“”«»]/g, '"')
      .replace(/[–—_]/g, '-').replace(/…/g, '...')
      .replace(/\s/g, ' ');
    return Array.from(normalized, character => character === ' ' || cells.has(character) || inverted.has(character) ? character : '?').join('');
  }

  function glyphFor(char) {
    const character = Array.from(normalizeText(char))[0];
    if (!character || character === ' ') return null;
    const base = inverted.get(character);
    return { ...cells.get(base || character), character, ...(base ? { rotate: 180 } : {}) };
  }

  function renderText(container, text) {
    const doc = container.ownerDocument;
    const glyphs = [];
    container.replaceChildren();
    const parts = normalizeText(text).match(/\S+| +/g) || [];
    for (const part of parts) {
      if (part[0] === ' ') {
        container.appendChild(doc.createTextNode(part));
        continue;
      }
      const word = doc.createElement('span');
      word.className = 'hc-word';
      for (const character of part) {
        const cell = glyphFor(character);
        const glyph = doc.createElement('span');
        glyph.className = 'hc-glyph';
        glyph.dataset.glyph = cell.character;
        if (cell.rotate) glyph.style.transform = 'rotate(' + cell.rotate + 'deg)';
        glyph.style.backgroundPosition = `${-cell.column * cellSize}px ${-cell.row * cellSize}px`;
        word.appendChild(glyph);
        glyphs.push(glyph);
      }
      container.appendChild(word);
    }
    return glyphs;
  }

  // Assemble at native resolution so a browser scales one surface, not the
  // independently clipped edges of a body aperture and its face overlay.
  function createPortraitRenderer(container, options = {}) {
    const doc = container?.ownerDocument, win = options.window || doc?.defaultView;
    if (!doc || !win || typeof win.Image !== 'function') return null;
    let canvas, context, image;
    try {
      canvas = doc.createElement('canvas');
      canvas.width = 256; canvas.height = 328;
      canvas.className = 'hc-portrait-canvas'; canvas.hidden = true;
      canvas.setAttribute('aria-hidden', 'true');
      context = canvas.getContext?.('2d');
      if (!context) return null;
      context.imageSmoothingEnabled = false;
      image = new win.Image();
    } catch (_) { return null; }
    let frame = 0, paintedFrame = -1, ready = false, disposed = false;
    const fallback = () => {
      ready = false; canvas.hidden = true;
      container.classList.remove('hc-composed');
    };
    const paint = () => {
      if (disposed || !ready) return false;
      if (paintedFrame === frame) return true;
      try {
        context.clearRect(0, 0, 256, 328);
        context.drawImage(image, 0, 184, 256, 328, 0, 0, 256, 328);
        context.drawImage(image, (frame % 4) * 64, Math.floor(frame / 4) * 56, 64, 56, 82, 76, 64, 56);
        paintedFrame = frame;
        canvas.hidden = false; container.classList.add('hc-composed');
        return true;
      } catch (_) { fallback(); return false; }
    };
    image.onload = () => {
      if (disposed) return;
      if (image.naturalWidth < 256 || image.naturalHeight < 512) { fallback(); return; }
      ready = true; paint();
    };
    image.onerror = () => { if (!disposed) fallback(); };
    try {
      container.appendChild(canvas);
      image.src = options.src || 'assets/images/home/shurelia-atlas.png';
    } catch (_) {
      image.onload = image.onerror = null; canvas.remove(); fallback();
      return null;
    }
    return Object.freeze({
      setFrame(nextFrame) {
        if (disposed || !Number.isInteger(nextFrame) || nextFrame < 0 || nextFrame > 8) return false;
        frame = nextFrame; // Image loading must not reset a newer expression to neutral.
        return ready ? paint() : true;
      },
      destroy() {
        if (disposed) return;
        disposed = true; ready = false;
        image.onload = image.onerror = null;
        container.classList.remove('hc-composed'); canvas.remove();
        canvas.width = canvas.height = 0;
      }
    });
  }

  return Object.freeze({ normalizeText, glyphFor, renderText, createPortraitRenderer, cellSize, sheetSize });
});
