// Original bitmap glyphs only. The dialogue director owns timing and semantic text.
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

  function normalizeText(text) {
    const normalized = String(text ?? '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
      .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
      .replace(/[–—]/g, '-').replace(/…/g, '...')
      .replace(/¡/g, '!').replace(/¿/g, '?').replace(/\s/g, ' ');
    return Array.from(normalized, character => character === ' ' || cells.has(character) ? character : '?').join('');
  }

  function glyphFor(char) {
    const character = Array.from(normalizeText(char))[0];
    if (!character || character === ' ') return null;
    return { ...cells.get(character) };
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
        glyph.style.backgroundPosition = `${-cell.column * cellSize}px ${-cell.row * cellSize}px`;
        word.appendChild(glyph);
        glyphs.push(glyph);
      }
      container.appendChild(word);
    }
    return glyphs;
  }

  return Object.freeze({ normalizeText, glyphFor, renderText, cellSize, sheetSize });
});
