export class Grid {
  constructor({ el, columns, rowHeight, gap, gridBackground, gridPatternColor, gridPattern }) {
    this.el = el;
    this.columns = columns;
    this.rowHeight = rowHeight;
    this.gap = gap;
    this.cards = new Map(); // id → { card, x, y, w, h }
    this.matrix = [];       // 2-D boolean occupancy

    this.el.style.setProperty('--db-cols', columns);
    this.el.style.setProperty('--db-row-height', rowHeight + 'px');
    this.el.style.setProperty('--db-gap', gap + 'px');

    if (gridBackground)    this.el.style.background = gridBackground;
    if (gridPatternColor)  this.el.style.setProperty('--db-grid-line-color', gridPatternColor);
    if (gridPattern)       this.el.setAttribute('data-pattern', gridPattern);

    this._ensureRows(8);
    this._batchDepth = 0;

    requestAnimationFrame(() => this._updateCellW());
  }

  /* ── Row management ───────────────────────────────────────────────────── */

  _ensureRows(minRows) {
    while (this.matrix.length < minRows) {
      this.matrix.push(new Array(this.columns).fill(false));
    }
  }

  _requiredRows() {
    let max = 8;
    for (const { y, h } of this.cards.values()) max = Math.max(max, y + h + 2);
    return max;
  }

  /* ── Cell-width CSS var (drives cube pattern) ────────────────────────── */

  _updateCellW() {
    const { cellW } = this._cellSize();
    this.el.style.setProperty('--db-cell-w', cellW + 'px');
  }

  /* ── Pixel ↔ grid conversion ──────────────────────────────────────────── */

  _cellSize() {
    const rect = this.el.getBoundingClientRect();
    const innerW = rect.width - this.gap * 2;
    let cellW = (innerW - this.gap * (this.columns - 1)) / this.columns;
    // Guard: container not in DOM yet or zero-width — use parent width as fallback
    if (cellW <= 0) {
      const parentW = (this.el.parentElement?.getBoundingClientRect().width || 800) - this.gap * 2;
      cellW = (parentW - this.gap * (this.columns - 1)) / this.columns;
    }
    if (cellW <= 0) cellW = 60; // absolute minimum — prevents negative widths
    const cellH = this.rowHeight;
    return { cellW, cellH };
  }

  pixelToCell(clientX, clientY) {
    const rect = this.el.getBoundingClientRect();
    const { cellW, cellH } = this._cellSize();
    const localX = clientX - rect.left - this.gap;
    const localY = clientY - rect.top  - this.gap;
    const col = Math.max(0, Math.min(this.columns - 1, Math.floor(localX / (cellW + this.gap))));
    const row = Math.max(0, Math.floor(localY / (cellH + this.gap)));
    return { col, row };
  }

  cellToPixel(col, row) {
    const { cellW, cellH } = this._cellSize();
    const x = this.gap + col * (cellW + this.gap);
    const y = this.gap + row * (cellH + this.gap);
    return { x, y };
  }

  cellSpanToPixel(w, h) {
    const { cellW, cellH } = this._cellSize();
    const pw = w * cellW + (w - 1) * this.gap;
    const ph = h * cellH + (h - 1) * this.gap;
    return { pw, ph };
  }

  /* ── Occupancy helpers ────────────────────────────────────────────────── */

  _occupy(x, y, w, h, state) {
    this._ensureRows(y + h + 1);
    for (let r = y; r < y + h; r++) {
      for (let c = x; c < x + w; c++) {
        this.matrix[r][c] = state;
      }
    }
  }

  _isFree(x, y, w, h) {
    if (x < 0 || x + w > this.columns) return false;
    this._ensureRows(y + h + 1);
    for (let r = y; r < y + h; r++) {
      for (let c = x; c < x + w; c++) {
        if (this.matrix[r][c]) return false;
      }
    }
    return true;
  }

  /* Find the nearest free position starting from (col, row) for a w×h block */
  findFreePosition(col, row, w, h, skipId = null) {
    col = Math.max(0, Math.min(this.columns - w, col));
    row = Math.max(0, row);

    this._rebuildMatrix(skipId);

    for (let distance = 0; distance < 50; distance++) {
      for (let dy = 0; dy <= distance; dy++) {
        for (let dx = 0; dx <= distance - dy; dx++) {
          const candidates = [
            [col + dx, row + dy],
            [col - dx, row + dy],
            [col + dx, row - dy],
            [col - dx, row - dy],
          ];
          for (const [cx, cy] of candidates) {
            if (cy < 0) continue;
            const clampedCx = Math.max(0, Math.min(this.columns - w, cx));
            if (this._isFree(clampedCx, cy, w, h)) {
              return { x: clampedCx, y: cy };
            }
          }
        }
      }
    }
    const bottom = this.matrix.length;
    return { x: 0, y: bottom };
  }

  _rebuildMatrix(skipId = null) {
    this.matrix = [];
    for (const [id, { x, y, w, h }] of this.cards) {
      if (id === skipId) continue;
      this._ensureRows(y + h + 1);
      this._occupy(x, y, w, h, true);
    }
  }

  /* ── Card placement ───────────────────────────────────────────────────── */

  placeCard(card, x, y, w, h) {
    // Enforce per-card size constraints
    w = this._clampW(card, w);
    h = this._clampH(card, h);

    const { x: fx, y: fy } = this.findFreePosition(x, y, w, h, card.id);
    this.cards.set(card.id, { card, x: fx, y: fy, w, h });
    this._rebuildMatrix();
    this._positionCard(card, fx, fy, w, h);
    this._commitLayout();
    return { x: fx, y: fy };
  }

  moveCard(card, toCol, toRow) {
    const entry = this.cards.get(card.id);
    if (!entry) return;
    if (card.locked) return { x: entry.x, y: entry.y };

    const { w, h } = entry;
    const { x, y } = this.findFreePosition(toCol, toRow, w, h, card.id);
    entry.x = x;
    entry.y = y;
    this._rebuildMatrix();
    this._positionCard(card, x, y, w, h);
    this._commitLayout();
    return { x, y };
  }

  resizeCard(card, newW, newH) {
    const entry = this.cards.get(card.id);
    if (!entry) return;

    newW = this._clampW(card, Math.max(1, Math.min(newW, this.columns - entry.x)));
    newH = this._clampH(card, Math.max(1, newH));

    const { x: fx, y: fy } = this.findFreePosition(entry.x, entry.y, newW, newH, card.id);
    entry.w = newW;
    entry.h = newH;
    entry.x = fx;
    entry.y = fy;
    this._rebuildMatrix();
    this._positionCard(card, fx, fy, newW, newH);
    this._commitLayout();
  }

  /* Resize with explicit position — used by N/W/NW handles */
  resizeCardBounds(card, x, y, w, h) {
    const entry = this.cards.get(card.id);
    if (!entry) return;

    w = this._clampW(card, Math.max(1, w));
    h = this._clampH(card, Math.max(1, h));
    x = Math.max(0, Math.min(x, this.columns - w));
    y = Math.max(0, y);

    const { x: fx, y: fy } = this.findFreePosition(x, y, w, h, card.id);
    entry.x = fx; entry.y = fy;
    entry.w = w;  entry.h = h;
    this._rebuildMatrix();
    this._positionCard(card, fx, fy, w, h);
    this._commitLayout();
  }

  removeCard(cardId) {
    this.cards.delete(cardId);
    this._rebuildMatrix();
    this._commitLayout();
  }

  /* Enforce per-card min/max width/height constraints */
  _clampW(card, w) {
    if (card.minW != null) w = Math.max(w, card.minW);
    if (card.maxW != null) w = Math.min(w, card.maxW);
    return w;
  }

  _clampH(card, h) {
    if (card.minH != null) h = Math.max(h, card.minH);
    if (card.maxH != null) h = Math.min(h, card.maxH);
    return h;
  }

  _positionCard(card, x, y, w, h) {
    const { x: px, y: py } = this.cellToPixel(x, y);
    const { pw, ph } = this.cellSpanToPixel(w, h);
    card.el.style.left   = px + 'px';
    card.el.style.top    = py + 'px';
    card.el.style.width  = pw + 'px';
    card.el.style.height = ph + 'px';
  }

  repositionAll() {
    this._updateCellW();
    for (const [, { card, x, y, w, h }] of this.cards) {
      this._positionCard(card, x, y, w, h);
    }
  }

  _commitLayout() {
    if (this._batchDepth > 0) return;
    this._growGrid();
  }

  _growGrid() {
    const needed = this._requiredRows();
    this._ensureRows(needed);
    const gridH = needed * (this.rowHeight + this.gap) + this.gap;
    this.el.style.minHeight = gridH + 'px';
  }

  /* ── Compact: pack all cards upward to eliminate empty rows ─────────────── */

  compact() {
    // Sort cards top-to-bottom, left-to-right
    const sorted = [...this.cards.entries()].sort(([, a], [, b]) =>
      a.y !== b.y ? a.y - b.y : a.x - b.x
    );

    this.matrix = [];

    for (const [id, entry] of sorted) {
      if (entry.card.locked) {
        // Locked cards stay in place
        this._ensureRows(entry.y + entry.h + 1);
        this._occupy(entry.x, entry.y, entry.w, entry.h, true);
        continue;
      }

      // Try to move this card as far up as possible
      let bestY = entry.y;
      for (let tryY = 0; tryY < entry.y; tryY++) {
        if (this._isFree(entry.x, tryY, entry.w, entry.h)) {
          bestY = tryY;
          break;
        }
      }

      entry.y = bestY;
      this._ensureRows(bestY + entry.h + 1);
      this._occupy(entry.x, bestY, entry.w, entry.h, true);
      this._positionCard(entry.card, entry.x, bestY, entry.w, entry.h);
    }

    this._growGrid();
  }

  /* ── Public query ─────────────────────────────────────────────────────── */

  isAreaEmpty(x, y, w, h, skipId = null) {
    this._rebuildMatrix(skipId);
    return this._isFree(x, y, w, h);
  }

  /* ── Batch update (defer layout until end) ───────────────────────────── */

  beginBatch() { this._batchDepth++; }

  endBatch() {
    if (this._batchDepth > 0) this._batchDepth--;
    if (this._batchDepth === 0) this._growGrid();
  }

  /* ── Drop preview ─────────────────────────────────────────────────────── */

  showDropPreview(col, row, w, h) {
    let preview = this.el.querySelector('.db-drop-preview');
    if (!preview) {
      preview = document.createElement('div');
      preview.className = 'db-drop-preview';
      this.el.appendChild(preview);
    }
    const clampedCol = Math.max(0, Math.min(this.columns - w, col));
    const { x, y } = this.cellToPixel(clampedCol, row);
    const { pw, ph } = this.cellSpanToPixel(w, h);
    preview.style.left   = x + 'px';
    preview.style.top    = y + 'px';
    preview.style.width  = pw + 'px';
    preview.style.height = ph + 'px';
    preview.style.display = '';
  }

  hideDropPreview() {
    const preview = this.el.querySelector('.db-drop-preview');
    if (preview) preview.style.display = 'none';
  }

  /* ── Serialise ────────────────────────────────────────────────────────── */

  serialize() {
    const layout = [];
    for (const [id, { card, x, y, w, h }] of this.cards) {
      layout.push({ id, widgetType: card.widgetType, x, y, w, h, config: card.getConfig() });
    }
    return layout;
  }
}
