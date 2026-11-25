const DEFAULT_DATA = JSON.stringify([
  { label: 'Jan', value: 30 },
  { label: 'Feb', value: 55 },
  { label: 'Mar', value: 40 },
  { label: 'Apr', value: 80 },
  { label: 'May', value: 65 },
  { label: 'Jun', value: 90 },
]);

const ChartWidget = {
  type: 'chart',
  label: 'Chart',
  icon: '📉',
  description: 'Bar or line chart',
  defaultConfig: {
    title: 'Analytics',
    w: 4,
    h: 3,
    bgColor: '#ffffff',
    chartType: 'bar',
    barColor: '#3b82f6',
    lineColor: '#3b82f6',
    data: DEFAULT_DATA,
  },
  configFields: [
    { name: 'chartType', label: 'Chart type', type: 'select', options: ['bar', 'line'] },
    { name: 'barColor',  label: 'Bar color',  type: 'color' },
    { name: 'lineColor', label: 'Line color', type: 'color' },
    { name: 'data',      label: 'Data (JSON array of {label,value})', type: 'textarea' },
  ],

  render(container, config) {
    container.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'db-chart-wrap';
    const canvas = document.createElement('canvas');
    canvas.className = 'db-chart-canvas';
    canvas._config = config;
    wrap.appendChild(canvas);
    container.appendChild(wrap);
    ChartWidget._draw(canvas, config);

    // Redraw on resize via ResizeObserver
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => ChartWidget._draw(canvas, canvas._config || config));
      ro.observe(container);
      canvas._ro = ro;
    }
  },

  update(container, config) {
    const canvas = container.querySelector('.db-chart-canvas');
    if (canvas) {
      canvas._config = config;
      ChartWidget._draw(canvas, config);
    }
  },

  destroy(container) {
    const canvas = container.querySelector('.db-chart-canvas');
    if (canvas?._ro) { canvas._ro.disconnect(); canvas._ro = null; }
  },

  _draw(canvas, config) {
    let data = [];
    if (Array.isArray(config.data)) {
      data = config.data;
    } else {
      try {
        const parsed = JSON.parse(config.data || DEFAULT_DATA);
        data = Array.isArray(parsed) ? parsed : [];
      } catch {
        data = [];
      }
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    // Subtract .db-chart-wrap horizontal (24px) & vertical (18px) padding
    const W = rect.width  > 24 ? rect.width  - 24 : 300;
    const H = rect.height > 18 ? rect.height - 18 : 160;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    if (!data.length) return;

    const pad   = { top: 16, right: 16, bottom: 28, left: 36 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top  - pad.bottom;
    const maxVal = Math.max(...data.map(d => Number(d.value) || 0), 1);

    ctx.font = '11px -apple-system, sans-serif';
    ctx.fillStyle = '#94a3b8';

    if (config.chartType === 'line') {
      ChartWidget._drawLine(ctx, data, pad, chartW, chartH, maxVal, config);
    } else {
      ChartWidget._drawBars(ctx, data, pad, chartW, chartH, maxVal, config);
    }

    // X-axis labels
    const step = chartW / data.length;
    data.forEach((d, i) => {
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText(d.label, pad.left + step * i + step / 2, H - pad.bottom + 14);
    });

    // Y-axis grid lines + labels
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    const gridLines = 4;
    for (let i = 0; i <= gridLines; i++) {
      const y = pad.top + chartH - (chartH / gridLines) * i;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + chartW, y); ctx.stroke();
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'right';
      ctx.fillText(Math.round((maxVal / gridLines) * i), pad.left - 4, y + 4);
    }
  },

  _drawBars(ctx, data, pad, chartW, chartH, maxVal, config) {
    const step    = chartW / data.length;
    const barW    = step * 0.6;
    const barOff  = step * 0.2;
    const radius  = 4;

    data.forEach((d, i) => {
      const val  = Math.max(0, Number(d.value) || 0);
      const barH = (val / maxVal) * chartH;
      const x    = pad.left + step * i + barOff;
      const y    = pad.top  + chartH - barH;
      const r    = Math.min(radius, barW / 2, barH / 2);

      ctx.fillStyle = config.barColor || '#3b82f6';
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + barW - r, y);
      ctx.quadraticCurveTo(x + barW, y, x + barW, y + r);
      ctx.lineTo(x + barW, y + barH);
      ctx.lineTo(x, y + barH);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.fill();
    });
  },

  _drawLine(ctx, data, pad, chartW, chartH, maxVal, config) {
    const step = chartW / data.length;
    const color = config.lineColor || '#3b82f6';
    const pts  = data.map((d, i) => ({
      x: pad.left + step * i + step / 2,
      y: pad.top  + chartH - (Math.max(0, Number(d.value) || 0) / maxVal) * chartH,
    }));

    // Fill area
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pad.top + chartH);
    pts.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[pts.length - 1].x, pad.top + chartH);
    ctx.closePath();
    ctx.globalAlpha = 0.13;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();

    // Line
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const mx = (pts[i - 1].x + pts[i].x) / 2;
      ctx.bezierCurveTo(mx, pts[i - 1].y, mx, pts[i].y, pts[i].x, pts[i].y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Dots
    pts.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  },
};

export default ChartWidget;
