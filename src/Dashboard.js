import { Grid }         from './Grid.js';
import { Card }         from './Card.js';
import { Sidebar }      from './Sidebar.js';
import { ConfigPanel }  from './ConfigPanel.js';
import { EventEmitter } from './EventEmitter.js';

export const DEFAULT_ICONS = {
  drag:    '&#8999;',   // ⠿  drag handle
  close:   '&#x2715;', // ✕  remove card
  config:  '&#9881;',  // ⚙  configure card
  lock:    '&#128274;', // 🔒 sidebar locked
  unlock:  '&#128275;', // 🔓 sidebar unlocked
  menu:    '&#9776;',  // ☰  float sidebar toggle
  empty:   '&#8681;',  // ⇩  empty grid placeholder
};

import KpiWidget   from './widgets/KpiWidget.js';
import TextWidget  from './widgets/TextWidget.js';
import TableWidget from './widgets/TableWidget.js';
import ChartWidget from './widgets/ChartWidget.js';

const BUILT_IN_WIDGETS = [KpiWidget, TextWidget, TableWidget, ChartWidget];

export class Dashboard extends EventEmitter {
  /**
   * Async factory — loads widget-config.json (if configPath given) then constructs.
   *
   * @param {object}          opts
   * @param {string|Element}  opts.container
   * @param {string|Element}  [opts.sidebar]
   * @param {string}          [opts.configPath]        URL to widget-config.json
   * @param {object}          [opts.widgetConfig]      Inline config (overrides configPath)
   * @param {number}          [opts.columns=12]
   * @param {number}          [opts.rowHeight=80]
   * @param {number}          [opts.gap=8]
   * @param {'left'|'right'|'top'|'bottom'|'float'} [opts.sidebarPosition='left']
   * @param {string}          [opts.gridBackground]    Grid surface color
   * @param {'cubes'|'dots'|'lines'|'none'} [opts.gridPattern='cubes']
   * @param {string}          [opts.gridPatternColor]  Pattern line/dot color
   * @param {boolean}         [opts.disappearOnDrop=true]
   * @param {boolean}         [opts.draggable=true]    Allow card dragging
   * @param {boolean}         [opts.cardConfigurable=false] Show gear button
   * @param {Array}           [opts.widgets]           Extra widget definitions
   * @param {Array}           [opts.initialCards]
   * @param {Function}        [opts.onChange]          Legacy callback; also fires as 'change' event
   */
  static async create(opts = {}) {
    let fileConfig = {};

    if (opts.configPath && !opts.widgetConfig) {
      try {
        const res = await fetch(opts.configPath);
        fileConfig = await res.json();
      } catch (e) {
        console.warn('Dashboard: could not load config from', opts.configPath, e);
      }
    }

    const jsonDashboard = fileConfig.dashboard || {};
    const widgetConfig  = Object.assign({}, fileConfig);
    delete widgetConfig.dashboard;

    const merged = {
      sidebarPosition:  opts.sidebarPosition  ?? jsonDashboard.sidebarPosition  ?? 'left',
      gridBackground:   opts.gridBackground   ?? jsonDashboard.gridBackground   ?? undefined,
      gridPattern:      opts.gridPattern      ?? jsonDashboard.gridPattern      ?? 'cubes',
      gridPatternColor: opts.gridPatternColor ?? jsonDashboard.gridPatternColor ?? undefined,
      disappearOnDrop:  opts.disappearOnDrop  ?? jsonDashboard.disappearOnDrop  ?? true,
      draggable:        opts.draggable        ?? jsonDashboard.draggable        ?? true,
      cardConfigurable: opts.cardConfigurable ?? jsonDashboard.cardConfigurable ?? false,
      widgetConfig:     opts.widgetConfig     || widgetConfig,
    };

    return new Dashboard({ ...opts, ...merged });
  }

  constructor(opts = {}) {
    super();

    const {
      container,
      sidebar,
      columns          = 12,
      rowHeight        = 80,
      gap              = 8,
      sidebarPosition  = 'left',
      gridBackground,
      gridPattern      = 'cubes',
      gridPatternColor,
      disappearOnDrop  = true,
      draggable        = true,
      cardConfigurable = false,
      resizeHandles    = 'se',
      theme            = {},
      cssClasses       = {},
      icons            = {},
      showGridInEditMode = true,
      widgets          = [],
      initialCards     = [],
      widgetConfig     = {},
      onChange,
    } = opts;

    this._legacyOnChange   = onChange || null;
    this._widgetMap        = new Map();
    this._widgetConfig     = widgetConfig;
    this._disappearOnDrop  = disappearOnDrop;
    this._draggable        = draggable;
    this._cardConfigurable = cardConfigurable;
    this._sidebarPosition  = sidebarPosition;
    this._resizeHandles      = resizeHandles;
    this._cssClasses         = cssClasses;
    this._icons              = Object.assign({}, DEFAULT_ICONS, icons);
    this._showGridInEditMode = showGridInEditMode;
    this._gridPattern        = gridPattern;
    this._enabled            = true;

    for (const def of [...BUILT_IN_WIDGETS, ...widgets]) {
      this._widgetMap.set(def.type, def);
    }

    this._containerEl = this._resolve(container);
    this._sidebarEl   = this._resolve(sidebar);

    if (!this._containerEl) throw new Error('Dashboard: container element not found');

    // Write CSS variable overrides onto the container so they scope to this instance
    for (const [prop, val] of Object.entries(theme)) {
      this._containerEl.style.setProperty(prop, val);
    }

    this._configPanel = new ConfigPanel();

    this._initLayout(sidebarPosition);

    this._grid = new Grid({
      el: this._gridEl,
      columns,
      rowHeight,
      gap,
      gridBackground,
      gridPattern,
      gridPatternColor,
    });

    if (this._sidebarEl) {
      this._sidebar = new Sidebar({
        el: this._sidebarEl,
        widgets: [...BUILT_IN_WIDGETS, ...widgets],
        onDragStart: (type) => { this._draggingType = type; },
        onToggleLock: (locked) => { locked ? this.disable() : this.enable(); },
        cssClasses: this._cssClasses,
        icons: this._icons,
      });
    }

    // If grid should always be hidden (even in edit mode), override the pattern
    if (!this._showGridInEditMode) {
      this._gridEl.setAttribute('data-pattern', 'none');
    }

    this._bindGridDrop();

    for (const spec of initialCards) {
      this.addCard(spec);
    }

    this._onResize = () => this._grid.repositionAll();
    window.addEventListener('resize', this._onResize);
  }

  /* ── Layout shell ─────────────────────────────────────────────────────── */

  _initLayout(position) {
    const outer = this._containerEl;
    outer.classList.add('db-layout');
    outer.classList.add(`db-layout--sidebar-${position}`);

    if (this._sidebarEl) {
      this._sidebarEl.classList.add('db-sidebar');
    }

    this._gridWrap = document.createElement('div');
    this._gridWrap.className = 'db-grid-wrap';

    this._gridEl = document.createElement('div');
    this._gridEl.className = 'db-grid';

    this._emptyEl = document.createElement('div');
    this._emptyEl.className = 'db-empty';
    this._emptyEl.innerHTML = `
      <div class="db-empty-icon">${this._icons.empty}</div>
      <div class="db-empty-text">Drag widgets from the sidebar</div>
    `;
    this._gridEl.appendChild(this._emptyEl);
    this._gridWrap.appendChild(this._gridEl);

    if (this._sidebarEl && this._sidebarEl.parentElement === outer) {
      outer.appendChild(this._gridWrap);
    } else if (this._sidebarEl) {
      outer.appendChild(this._sidebarEl);
      outer.appendChild(this._gridWrap);
    } else {
      outer.appendChild(this._gridWrap);
    }

    if (position === 'float' && this._sidebarEl) {
      this._floatToggle = document.createElement('button');
      this._floatToggle.className = 'db-float-toggle';
      this._floatToggle.title = 'Widget Library';
      this._floatToggle.innerHTML = this._icons.menu;
      this._floatToggle.addEventListener('click', () => {
        const open = this._sidebarEl.classList.toggle('db-sidebar--open');
        this._floatToggle.classList.toggle('db-float-toggle--open', open);
      });
      document.body.appendChild(this._floatToggle);
    }
  }

  /* ── Grid drop events ─────────────────────────────────────────────────── */

  _bindGridDrop() {
    const grid = this._gridEl;

    grid.addEventListener('dragover', (e) => {
      if (!this._enabled) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      if (!this._draggingType) return;
      const def = this._widgetMap.get(this._draggingType);
      if (!def) return;
      const jsonCfg = this._widgetConfig[this._draggingType] || {};
      const w = jsonCfg.w || def.defaultConfig.w || 2;
      const h = jsonCfg.h || def.defaultConfig.h || 2;
      const { col, row } = this._grid.pixelToCell(e.clientX, e.clientY);
      this._grid.showDropPreview(col, row, w, h);
    });

    grid.addEventListener('dragleave', (e) => {
      if (!grid.contains(e.relatedTarget)) this._grid.hideDropPreview();
    });

    grid.addEventListener('drop', (e) => {
      if (!this._enabled) return;
      e.preventDefault();
      this._grid.hideDropPreview();
      const type = e.dataTransfer.getData('text/plain') || this._draggingType;
      this._draggingType = null;
      if (!type) return;
      const { col, row } = this._grid.pixelToCell(e.clientX, e.clientY);
      const card = this.addCard({ widgetType: type, x: col, y: row });
      if (card) this.emit('dropped', { card, x: col, y: row });
    });
  }

  /* ── Public API ───────────────────────────────────────────────────────── */

  addCard({ widgetType, x = 0, y = 0, w, h, config = {},
            noMove, noResize, locked, minW, maxW, minH, maxH,
            resizeHandles } = {}) {
    const def = this._widgetMap.get(widgetType);
    if (!def) { console.warn('Dashboard: unknown widget type', widgetType); return; }

    const mergedConfig = Object.assign(
      {},
      def.defaultConfig,
      this._widgetConfig[widgetType] || {},
      config,
    );

    const card = new Card({
      widgetType,
      widgetDef:  def,
      config:     mergedConfig,
      grid:       this._grid,
      draggable:     this._draggable,
      showConfig:    this._cardConfigurable,
      resizeHandles: resizeHandles ?? this._resizeHandles,
      cssClasses:    this._cssClasses,
      icons:         this._icons,
      noMove,
      noResize,
      locked,
      minW, maxW, minH, maxH,
      onConfig:      (c) => this._configPanel.open(c),
      onRemove:      (c) => this.removeCard(c.id),
      onChange:      () => this._notifyChange(),
      onDragStart:   (c) => this.emit('dragstart', { card: c }),
      onDragStop:    (c) => { this.emit('dragstop', { card: c }); this.emit('card:moved', { card: c }); },
      onResizeStart: (c) => this.emit('resizestart', { card: c }),
      onResizeStop:  (c) => { this.emit('resizestop', { card: c }); this.emit('card:resized', { card: c }); },
    });

    this._gridEl.appendChild(card.el);
    this._grid.placeCard(
      card,
      x,
      y,
      w || mergedConfig.w || def.defaultConfig.w || 2,
      h || mergedConfig.h || def.defaultConfig.h || 2,
    );

    if (this._sidebar && this._disappearOnDrop) {
      this._sidebar.markUsed(widgetType);
    }

    this._updateEmptyState();
    this._notifyChange();
    this.emit('card:added', { card });
    return card;
  }

  removeCard(cardId) {
    const entry = this._grid.cards.get(cardId);
    if (!entry) return;

    const { widgetType } = entry.card;
    const card = entry.card;
    card.destroy(); // cancels in-flight drag, disconnects widget observers, removes el
    this._grid.removeCard(cardId);

    if (this._sidebar && this._disappearOnDrop) {
      this._sidebar.markFree(widgetType);
    }

    this._updateEmptyState();
    this._notifyChange();
    this.emit('card:removed', { card });
  }

  getLayout() {
    return this._grid.serialize();
  }

  loadLayout(layout = []) {
    for (const [id] of [...this._grid.cards]) this.removeCard(id);
    const failed = [];
    for (const spec of layout) {
      const card = this.addCard(spec);
      if (!card) failed.push(spec.widgetType);
    }
    if (failed.length) {
      console.warn('Dashboard.loadLayout: unknown widget type(s) — cards dropped:', failed);
    }
  }

  /**
   * Pack all cards upward to eliminate empty rows.
   */
  compact() {
    this._grid.compact();
    this._notifyChange();
    this.emit('compact');
  }

  /**
   * Enable all drag and drop interactions.
   */
  enable() {
    this._enabled = true;
    this._gridEl.classList.remove('db-grid--disabled');
    // Restore pattern only if user opted in to showing it during edit
    if (this._showGridInEditMode) {
      this._gridEl.setAttribute('data-pattern', this._gridPattern || 'cubes');
    }
    this._sidebar?.unlock();
    this.emit('enable');
  }

  /**
   * Disable all drag and drop interactions (view/lock mode).
   */
  disable() {
    this._enabled = false;
    this._gridEl.classList.add('db-grid--disabled');
    this._sidebar?.lock(); // sync sidebar button without re-triggering the callback
    this.emit('disable');
  }

  /**
   * Run a batch of operations without triggering intermediate layout recalculations.
   * @param {Function} fn
   */
  batchUpdate(fn) {
    this._grid.beginBatch();
    try {
      fn();
    } finally {
      this._grid.endBatch();
      this._notifyChange();
    }
  }

  /**
   * Check whether a grid area is free of cards.
   * @param {number} x col
   * @param {number} y row
   * @param {number} w width in columns
   * @param {number} h height in rows
   * @param {string} [skipId] optional card id to exclude from the check
   * @returns {boolean}
   */
  isAreaEmpty(x, y, w, h, skipId) {
    return this._grid.isAreaEmpty(x, y, w, h, skipId);
  }

  destroy() {
    window.removeEventListener('resize', this._onResize);
    this._configPanel.close();
    if (this._floatToggle) this._floatToggle.remove();
    this._containerEl.innerHTML = '';
    this._listeners = {};
  }

  /* ── Helpers ──────────────────────────────────────────────────────────── */

  _resolve(el) {
    if (!el) return null;
    if (typeof el === 'string') return document.querySelector(el);
    return el;
  }

  _updateEmptyState() {
    this._emptyEl.style.display = this._grid.cards.size === 0 ? '' : 'none';
  }

  _notifyChange() {
    const layout = this.getLayout();
    if (this._legacyOnChange) this._legacyOnChange(layout);
    this.emit('change', layout);
  }
}

if (typeof window !== 'undefined') {
  window.Dashboard = Dashboard;
}
