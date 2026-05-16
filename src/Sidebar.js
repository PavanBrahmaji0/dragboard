export class Sidebar {
  constructor({ el, widgets, onDragStart, onToggleLock, cssClasses = {}, icons = {} }) {
    this.el = el;
    this.widgets = widgets;
    this.onDragStart = onDragStart;
    this.onToggleLock = onToggleLock || (() => {});
    this._cssClasses = cssClasses;
    this._icons = icons;
    this._items = new Map(); // type → DOM element
    this._locked = false;
    this._render();
  }

  _render() {
    this.el.innerHTML = `
      <div class="db-sidebar-header${this._cssClasses.sidebarHeader ? ' ' + this._cssClasses.sidebarHeader : ''}">
        <span class="db-sidebar-title">Widget Library</span>
        <button class="db-sidebar-lock-btn" title="Lock layout">
          <span class="db-sidebar-lock-icon">${this._icons.unlock ?? '&#128275;'}</span>
        </button>
      </div>
    `;

    if (this._cssClasses.sidebar) this.el.classList.add(...this._cssClasses.sidebar.split(' '));

    this._lockBtn = this.el.querySelector('.db-sidebar-lock-btn');
    this._lockIcon = this.el.querySelector('.db-sidebar-lock-icon');

    this._lockBtn.addEventListener('click', () => {
      this._locked = !this._locked;
      this._applyLockState();
      this.onToggleLock(this._locked);
    });

    for (const def of this.widgets) {
      const item = document.createElement('div');
      item.className = 'db-sidebar-item' + (this._cssClasses.sidebarItem ? ' ' + this._cssClasses.sidebarItem : '');
      item.draggable = true;
      item.dataset.widgetType = def.type;

      item.innerHTML = `
        <div class="db-sidebar-item-icon">${def.icon}</div>
        <div class="db-sidebar-item-info">
          <div class="db-sidebar-item-label">${def.label}</div>
          <div class="db-sidebar-item-sub">${def.description || ''}</div>
        </div>
      `;

      item.addEventListener('dragstart', (e) => {
        if (item.classList.contains('db-sidebar-item--used') || this._locked) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/plain', def.type);
        this.onDragStart(def.type, e);
      });

      this._items.set(def.type, item);
      this.el.appendChild(item);
    }
  }

  _applyLockState() {
    this.el.classList.toggle('db-sidebar--locked', this._locked);
    this._lockIcon.innerHTML = this._locked
      ? (this._icons.lock   ?? '&#128274;')
      : (this._icons.unlock ?? '&#128275;');
    this._lockBtn.title = this._locked ? 'Unlock layout' : 'Lock layout';
  }

  /* Called by Dashboard.enable() / disable() to keep visual in sync */
  lock() {
    this._locked = true;
    this._applyLockState();
  }

  unlock() {
    this._locked = false;
    this._applyLockState();
  }

  markUsed(type) {
    const item = this._items.get(type);
    if (!item) return;
    item.classList.add('db-sidebar-item--used');
    item.draggable = false;
  }

  markFree(type) {
    const item = this._items.get(type);
    if (!item) return;
    item.classList.remove('db-sidebar-item--used');
    item.draggable = true;
  }
}
