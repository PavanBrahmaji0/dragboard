export class ConfigPanel {
  constructor() {
    this._backdrop = null;
  }

  open(card) {
    this.close();

    const { widgetDef, config } = card;

    const backdrop = document.createElement('div');
    backdrop.className = 'db-config-backdrop';
    this._backdrop = backdrop;

    const entry = card.grid.cards.get(card.id);
    const currentW = entry ? entry.w : config.w || 2;
    const currentH = entry ? entry.h : config.h || 2;

    backdrop.innerHTML = `
      <div class="db-config-panel">
        <div class="db-config-header">
          <h3>Configure — ${widgetDef.label}</h3>
          <button class="db-config-close" title="Close">&#x2715;</button>
        </div>
        <div class="db-config-body">
          <div class="db-config-field">
            <label>Title</label>
            <input type="text" name="title" value="${this._esc(config.title || widgetDef.label)}">
          </div>
          <div class="db-config-row">
            <div class="db-config-field">
              <label>Width (columns)</label>
              <input type="number" name="w" min="1" max="12" value="${currentW}">
            </div>
            <div class="db-config-field">
              <label>Height (rows)</label>
              <input type="number" name="h" min="1" max="20" value="${currentH}">
            </div>
          </div>
          <div class="db-config-field">
            <label>Background color</label>
            <input type="color" name="bgColor" value="${config.bgColor || '#ffffff'}">
          </div>
          ${this._renderWidgetFields(widgetDef.configFields || [], config)}
        </div>
        <div class="db-config-footer">
          <button class="db-btn db-btn--ghost db-cancel">Cancel</button>
          <button class="db-btn db-btn--primary db-apply">Apply</button>
        </div>
      </div>
    `;

    backdrop.querySelector('.db-config-close').addEventListener('click', () => this.close());
    backdrop.querySelector('.db-cancel').addEventListener('click', () => this.close());
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) this.close(); });

    backdrop.querySelector('.db-apply').addEventListener('click', () => {
      const newConfig = this._collectValues(backdrop, widgetDef.configFields || []);
      const newW = parseInt(backdrop.querySelector('[name="w"]').value, 10) || currentW;
      const newH = parseInt(backdrop.querySelector('[name="h"]').value, 10) || currentH;

      card.applyConfig(newConfig);
      card.grid.resizeCard(card, newW, newH);
      this.close();
    });

    document.body.appendChild(backdrop);
  }

  close() {
    if (this._backdrop) {
      this._backdrop.remove();
      this._backdrop = null;
    }
  }

  _renderWidgetFields(fields, config) {
    if (!fields.length) return '';
    return fields.map(f => {
      const val = config[f.name] !== undefined ? config[f.name] : (f.default || '');
      if (f.type === 'select') {
        const opts = (f.options || []).map(o =>
          `<option value="${this._esc(o)}" ${o === val ? 'selected' : ''}>${this._esc(o)}</option>`
        ).join('');
        return `<div class="db-config-field">
          <label>${this._esc(f.label)}</label>
          <select name="${this._esc(f.name)}">${opts}</select>
        </div>`;
      }
      if (f.type === 'textarea') {
        return `<div class="db-config-field">
          <label>${this._esc(f.label)}</label>
          <textarea name="${this._esc(f.name)}" rows="4">${this._esc(String(val))}</textarea>
        </div>`;
      }
      return `<div class="db-config-field">
        <label>${this._esc(f.label)}</label>
        <input type="${f.type || 'text'}" name="${this._esc(f.name)}" value="${this._esc(String(val))}">
      </div>`;
    }).join('');
  }

  _collectValues(panel, widgetFields) {
    const cfg = {};
    cfg.title   = panel.querySelector('[name="title"]').value;
    cfg.bgColor = panel.querySelector('[name="bgColor"]').value;

    for (const f of widgetFields) {
      const el = panel.querySelector(`[name="${f.name}"]`);
      if (el) cfg[f.name] = el.value;
    }
    return cfg;
  }

  _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
