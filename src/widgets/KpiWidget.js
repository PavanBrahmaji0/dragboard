const KpiWidget = {
  type: 'kpi',
  label: 'KPI Metric',
  icon: '📈',
  description: 'Big number with trend',
  defaultConfig: {
    title: 'Revenue',
    w: 2,
    h: 2,
    bgColor: '#ffffff',
    value: '12,400',
    unit: '$',
    trend: 'up',
    trendValue: '+8%',
    trendColor: '#22c55e',
  },
  configFields: [
    { name: 'value',      label: 'Value',       type: 'text' },
    { name: 'unit',       label: 'Unit prefix',  type: 'text' },
    { name: 'trend',      label: 'Trend',        type: 'select', options: ['up', 'down', 'flat'] },
    { name: 'trendValue', label: 'Trend label',  type: 'text' },
  ],

  render(container, config) {
    container.innerHTML = '';
    const div = document.createElement('div');
    div.className = 'db-kpi';
    div.innerHTML = KpiWidget._html(config);
    container.appendChild(div);
  },

  update(container, config) {
    const div = container.querySelector('.db-kpi');
    if (div) div.innerHTML = KpiWidget._html(config);
  },

  _html(c) {
    const arrow = c.trend === 'up' ? '▲' : c.trend === 'down' ? '▼' : '●';
    const cls   = `db-kpi-trend--${c.trend || 'flat'}`;
    return `
      <div class="db-kpi-value">${_esc(c.unit || '')}${_esc(c.value || '0')}</div>
      <div class="db-kpi-label">${_esc(c.title || 'Metric')}</div>
      <div class="db-kpi-trend ${cls}">${arrow} ${_esc(c.trendValue || '')}</div>
    `;
  },
};

function _esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

export default KpiWidget;
