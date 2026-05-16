let _nextId = 1;

const ALL_DIRS  = ['n','ne','e','se','s','sw','w','nw'];
const PRESETS   = {
  'none'     : [],
  'se'       : ['se'],
  '2side'    : ['s','e','se'],
  '4corners' : ['nw','ne','se','sw'],
  'all'      : ALL_DIRS,
};

function parseHandles(opt) {
  if (!opt || opt === 'none') return new Set();
  if (PRESETS[opt])           return new Set(PRESETS[opt]);
  return new Set(opt.split(',').map(s => s.trim()).filter(s => ALL_DIRS.includes(s)));
}

export class Card {
  /**
   * @param {object} opts
   * @param {string}   opts.widgetType
   * @param {object}   opts.widgetDef
   * @param {object}   opts.config
   * @param {Grid}     opts.grid
   * @param {boolean}  [opts.draggable=true]
   * @param {boolean}  [opts.resizable=true]
   * @param {boolean}  [opts.showConfig=false]
   * @param {boolean}  [opts.noMove=false]
   * @param {boolean}  [opts.noResize=false]
   * @param {boolean}  [opts.locked=false]
   * @param {string}   [opts.resizeHandles='se']  'se'|'2side'|'4corners'|'all'|'n,s,e,w,...'
   * @param {number}   [opts.minW]  [opts.maxW]  [opts.minH]  [opts.maxH]
   * @param {Function} opts.onConfig
   * @param {Function} opts.onRemove
   * @param {Function} opts.onChange
   * @param {Function} opts.onDragStart
   * @param {Function} opts.onDragStop
   * @param {Function} opts.onResizeStart
   * @param {Function} opts.onResizeStop
   */
  constructor(opts) {
    const {
      widgetType, widgetDef, config, grid,
      draggable     = true,
      resizable     = true,
      showConfig    = false,
      noMove        = false,
      noResize      = false,
      locked        = false,
      resizeHandles = 'se',
      cssClasses    = {},
      icons         = {},
      minW, maxW, minH, maxH,
      onConfig, onRemove, onChange,
      onDragStart, onDragStop,
      onResizeStart, onResizeStop,
    } = opts;

    this.id          = 'card-' + (_nextId++);
    this.widgetType  = widgetType;
    this.widgetDef   = widgetDef;
    this.config      = Object.assign({}, widgetDef.defaultConfig, config);
    this.grid        = grid;
    this.locked      = locked;
    this.minW        = minW; this.maxW = maxW;
    this.minH        = minH; this.maxH = maxH;

    this._canDrag    = draggable && !noMove;
    this._canResize  = resizable && !noResize;
    this._showConfig = showConfig;
    this._handles    = this._canResize ? parseHandles(resizeHandles) : new Set();

    this.onConfig      = onConfig;
    this.onRemove      = onRemove;
    this.onChange      = onChange;
    this.onDragStart   = onDragStart   || (() => {});
    this.onDragStop    = onDragStop    || (() => {});
    this.onResizeStart = onResizeStart || (() => {});
    this.onResizeStop  = onResizeStop  || (() => {});

    this._cancelDrag = null;
    this._cssClasses = cssClasses;
    this._icons      = icons;

    this.el = this._build();
    if (this._canDrag)          this._bindDrag();
    if (this._handles.size > 0) this._bindResizeHandles();
    this.widgetDef.render(this._bodyEl, this.config);
  }

  /* ── DOM ────────────────────────────────────────────────────────────── */

  _build() {
    const el = document.createElement('div');
    el.className = 'db-card' + (this._canDrag ? '' : ' db-card--no-drag');
    el.dataset.cardId = this.id;

    const ic = this._icons;
    const configBtn = this._showConfig
      ? `<button class="db-card-btn db-card-btn--config" title="Configure">${ic.config}</button>`
      : '';

    const handlesHtml = [...this._handles]
      .map(dir => `<div class="db-card-resize db-card-resize--${dir}" data-dir="${dir}"></div>`)
      .join('');

    el.innerHTML = `
      <div class="db-card-header">
        <span class="db-card-drag-handle">${ic.drag}</span>
        <span class="db-card-title"></span>
        <div class="db-card-actions">
          ${configBtn}
          <button class="db-card-btn db-card-btn--close" title="Remove">${ic.close}</button>
        </div>
      </div>
      <div class="db-card-body"></div>
      ${handlesHtml}
    `;

    this._titleEl  = el.querySelector('.db-card-title');
    this._bodyEl   = el.querySelector('.db-card-body');
    this._headerEl = el.querySelector('.db-card-header');

    this._titleEl.textContent = this.config.title || this.widgetDef.label;
    if (this.config.bgColor) this._bodyEl.style.background = this.config.bgColor;

    // Apply custom CSS classes
    const cls = this._cssClasses;
    if (cls.card)        el.classList.add(...cls.card.split(' '));
    if (cls.cardHeader)  this._headerEl.classList.add(...cls.cardHeader.split(' '));
    if (cls.cardBody)    this._bodyEl.classList.add(...cls.cardBody.split(' '));
    el.querySelectorAll('.db-card-btn').forEach(btn => {
      if (cls.cardBtn) btn.classList.add(...cls.cardBtn.split(' '));
    });
    const closeBtn  = el.querySelector('.db-card-btn--close');
    if (closeBtn && cls.cardBtnClose) closeBtn.classList.add(...cls.cardBtnClose.split(' '));
    const cfgBtn = el.querySelector('.db-card-btn--config');
    if (cfgBtn && cls.cardBtnConfig) cfgBtn.classList.add(...cls.cardBtnConfig.split(' '));

    if (this._showConfig) {
      el.querySelector('.db-card-btn--config').addEventListener('click', e => {
        e.stopPropagation(); this.onConfig(this);
      });
    }

    el.querySelector('.db-card-btn--close').addEventListener('click', e => {
      e.stopPropagation(); this.onRemove(this);
    });

    return el;
  }

  /* ── Drag (mouse + touch) ───────────────────────────────────────────── */

  _bindDrag() {
    const header = this.el.querySelector('.db-card-header');
    let dragging = false;
    let startX, startY, origLeft, origTop;
    let cancelled = false;

    const startDrag = (clientX, clientY) => {
      dragging  = true;
      cancelled = false;
      startX    = clientX;
      startY    = clientY;
      origLeft  = parseFloat(this.el.style.left) || 0;
      origTop   = parseFloat(this.el.style.top)  || 0;
      this.el.classList.add('db-card--dragging');
      this.el.style.transition = 'none';
      this.onDragStart(this);
    };

    const moveDrag = (clientX, clientY) => {
      if (!dragging) return;
      this.el.style.left = (origLeft + clientX - startX) + 'px';
      this.el.style.top  = (origTop  + clientY - startY) + 'px';
      const { col, row } = this.grid.pixelToCell(clientX, clientY);
      const entry = this.grid.cards.get(this.id);
      if (entry) this.grid.showDropPreview(col, row, entry.w, entry.h);
    };

    const endDrag = (clientX, clientY) => {
      if (!dragging) return;
      dragging = false;
      this.el.classList.remove('db-card--dragging');
      this.el.style.transition = '';
      this.grid.hideDropPreview();

      if (!cancelled) {
        const { col, row } = this.grid.pixelToCell(clientX, clientY);
        this.grid.moveCard(this, col, row);
        this.onDragStop(this);
        this.onChange();
      } else {
        const entry = this.grid.cards.get(this.id);
        if (entry) this.grid._positionCard(this, entry.x, entry.y, entry.w, entry.h);
      }
    };

    const cancelDrag = () => {
      if (!dragging) return;
      cancelled = true;
      endDrag(startX, startY);
    };

    this._cancelDrag = cancelDrag;

    // Mouse
    header.addEventListener('mousedown', e => {
      if (e.target.closest('.db-card-btn') || e.target.closest('.db-card-resize')) return;
      e.preventDefault();
      startDrag(e.clientX, e.clientY);

      const onMove   = me => moveDrag(me.clientX, me.clientY);
      const onUp     = me => { endDrag(me.clientX, me.clientY); cleanup(); };
      const onKey    = ke => { if (ke.key === 'Escape') { cancelDrag(); cleanup(); } };
      const onResize = () => { cancelDrag(); cleanup(); };
      const cleanup  = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup',   onUp);
        document.removeEventListener('keydown',   onKey);
        window.removeEventListener('resize',      onResize);
        this._cancelDrag = null;
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup',   onUp);
      document.addEventListener('keydown',   onKey);
      window.addEventListener('resize',      onResize);
    });

    // Touch
    header.addEventListener('touchstart', e => {
      if (e.target.closest('.db-card-btn') || e.target.closest('.db-card-resize')) return;
      const t = e.touches[0];
      startDrag(t.clientX, t.clientY);
    }, { passive: true });

    header.addEventListener('touchmove', e => {
      e.preventDefault();
      const t = e.touches[0];
      moveDrag(t.clientX, t.clientY);
    }, { passive: false });

    header.addEventListener('touchend', e => {
      const t = e.changedTouches[0];
      endDrag(t.clientX, t.clientY);
    });

    header.addEventListener('touchcancel', cancelDrag);
  }

  /* ── Resize handles (all directions) ───────────────────────────────── */

  _bindResizeHandles() {
    this.el.querySelectorAll('.db-card-resize').forEach(handle => {
      this._bindOneHandle(handle, handle.dataset.dir);
    });
  }

  _bindOneHandle(handle, dir) {
    const hasN = dir.includes('n');
    const hasS = dir.includes('s');
    const hasE = dir.includes('e');
    const hasW = dir.includes('w');

    let resizing = false;
    let startX, startY, startW, startH, startLeft, startTop;

    const startResize = (clientX, clientY) => {
      resizing = true;
      const rect = this.el.getBoundingClientRect();
      startX    = clientX;
      startY    = clientY;
      startW    = rect.width;
      startH    = rect.height;
      startLeft = parseFloat(this.el.style.left) || 0;
      startTop  = parseFloat(this.el.style.top)  || 0;
      this.onResizeStart(this);
    };

    const moveResize = (clientX, clientY) => {
      if (!resizing) return;
      const { cellW, cellH } = this.grid._cellSize();
      const gap = this.grid.gap;
      const dx  = clientX - startX;
      const dy  = clientY - startY;

      let newW    = startW;
      let newH    = startH;
      let newLeft = startLeft;
      let newTop  = startTop;

      if (hasE) newW = startW + dx;
      if (hasW) { newW = startW - dx; newLeft = startLeft + (startW - newW); }
      if (hasS) newH = startH + dy;
      if (hasN) { newH = startH - dy; newTop  = startTop  + (startH - newH); }

      // Enforce minimum one cell
      newW = Math.max(cellW, newW);
      newH = Math.max(cellH, newH);

      // Enforce per-card min/max in pixels
      if (this.minW) newW = Math.max(newW, this.minW * (cellW + gap) - gap);
      if (this.maxW) newW = Math.min(newW, this.maxW * (cellW + gap) - gap);
      if (this.minH) newH = Math.max(newH, this.minH * (cellH + gap) - gap);
      if (this.maxH) newH = Math.min(newH, this.maxH * (cellH + gap) - gap);

      // Re-clamp position when min/max clamped size
      if (hasW) newLeft = startLeft + startW - newW;
      if (hasN) newTop  = startTop  + startH - newH;

      this.el.style.width  = newW    + 'px';
      this.el.style.height = newH    + 'px';
      this.el.style.left   = newLeft + 'px';
      this.el.style.top    = newTop  + 'px';
    };

    const endResize = () => {
      if (!resizing) return;
      resizing = false;

      const { cellW, cellH } = this.grid._cellSize();
      const gap = this.grid.gap;

      // Snap size to grid cells
      let newW = Math.max(1, Math.round((parseFloat(this.el.style.width)  + gap) / (cellW + gap)));
      let newH = Math.max(1, Math.round((parseFloat(this.el.style.height) + gap) / (cellH + gap)));

      if (this.minW) newW = Math.max(newW, this.minW);
      if (this.maxW) newW = Math.min(newW, this.maxW);
      if (this.minH) newH = Math.max(newH, this.minH);
      if (this.maxH) newH = Math.min(newH, this.maxH);

      // Snap position to grid cells (relevant for N/W handles)
      const entry = this.grid.cards.get(this.id);
      if (!entry) return;

      let newCol = entry.x;
      let newRow = entry.y;

      if (hasW) {
        const pixLeft = parseFloat(this.el.style.left) || 0;
        newCol = Math.max(0, Math.round((pixLeft - gap) / (cellW + gap)));
      }
      if (hasN) {
        const pixTop = parseFloat(this.el.style.top) || 0;
        newRow = Math.max(0, Math.round((pixTop - gap) / (cellH + gap)));
      }

      this.grid.resizeCardBounds(this, newCol, newRow, newW, newH);
      this.widgetDef.update(this._bodyEl, this.config);
      this.onResizeStop(this);
      this.onChange();
    };

    // Mouse
    handle.addEventListener('mousedown', e => {
      e.preventDefault(); e.stopPropagation();
      startResize(e.clientX, e.clientY);
      const onMove = me => moveResize(me.clientX, me.clientY);
      const onUp   = () => { endResize(); cleanup(); };
      const cleanup = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup',   onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup',   onUp);
    });

    // Touch
    handle.addEventListener('touchstart', e => {
      e.stopPropagation();
      const t = e.touches[0];
      startResize(t.clientX, t.clientY);
    }, { passive: true });

    handle.addEventListener('touchmove', e => {
      e.preventDefault();
      const t = e.touches[0];
      moveResize(t.clientX, t.clientY);
    }, { passive: false });

    handle.addEventListener('touchend', () => endResize());
    handle.addEventListener('touchcancel', () => { resizing = false; });
  }

  /* ── Config update ──────────────────────────────────────────────────── */

  applyConfig(newConfig) {
    Object.assign(this.config, newConfig);
    this._titleEl.textContent = this.config.title || this.widgetDef.label;
    if (this.config.bgColor) this._bodyEl.style.background = this.config.bgColor;
    this.widgetDef.update(this._bodyEl, this.config);
    this.onChange();
  }

  getConfig() { return Object.assign({}, this.config); }

  destroy() {
    if (this._cancelDrag) this._cancelDrag();
    this.widgetDef.destroy?.(this._bodyEl);
    this.el.remove();
  }
}
