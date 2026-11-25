import test from 'node:test';
import assert from 'node:assert/strict';
import { installDomEnv } from './dom-mock.js';
import KpiWidget from '../src/widgets/KpiWidget.js';
import TextWidget from '../src/widgets/TextWidget.js';
import TableWidget from '../src/widgets/TableWidget.js';
import ChartWidget from '../src/widgets/ChartWidget.js';

const env = installDomEnv();

test('KpiWidget: renders, escapes HTML, and updates', () => {
  env.reset();
  const container = env.document.createElement('div');
  const cfg = { title: '<script>alert(1)</script>', value: '42', unit: '$', trend: 'down', trendValue: '-5%' };
  KpiWidget.render(container, cfg);

  const html = container.querySelector('.db-kpi').innerHTML;
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('$42'));
  assert.ok(html.includes('db-kpi-trend--down'));

  KpiWidget.update(container, { ...cfg, value: '99', trend: 'up', trendValue: '+10%' });
  assert.ok(container.querySelector('.db-kpi').innerHTML.includes('$99'));
  assert.ok(container.querySelector('.db-kpi').innerHTML.includes('db-kpi-trend--up'));
});

test('TextWidget: renders textarea, updates config on input, and updates DOM', () => {
  env.reset();
  const container = env.document.createElement('div');
  const cfg = { content: 'Initial note' };
  TextWidget.render(container, cfg);

  const ta = container.querySelector('.db-text-widget');
  assert.equal(ta.value, 'Initial note');
  ta.value = 'Edited note';
  ta.dispatchEvent({ type: 'input' });
  assert.equal(cfg.content, 'Edited note');

  TextWidget.update(container, { content: 'Replaced' });
  assert.equal(ta.value, 'Replaced');
});

test('TableWidget: supports comma string/array columns, JSON/array rows, and handles invalid JSON safely', () => {
  env.reset();
  const container = env.document.createElement('div');

  TableWidget.render(container, {
    columns: ['Col A', 'Col B'],
    rows: [['r1c1', 'r1c2'], ['r2c1', 'r2c2']],
  });
  assert.equal(container.querySelectorAll('th').length, 2);
  assert.equal(container.querySelectorAll('tbody tr').length, 2);

  TableWidget.update(container, {
    columns: 'X, Y, Z',
    rows: JSON.stringify([[1, 2, 3]]),
  });
  assert.equal(container.querySelectorAll('th').length, 3);
  assert.equal(container.querySelectorAll('tbody tr').length, 1);

  // Malformed JSON or non-array JSON does not throw
  TableWidget.update(container, { columns: 'A', rows: '{bad json' });
  assert.equal(container.querySelectorAll('tbody tr').length, 0);

  TableWidget.update(container, { columns: 'A', rows: '{"not":"an array"}' });
  assert.equal(container.querySelectorAll('tbody tr').length, 0);
});

test('ChartWidget: renders bar & line charts, handles array/malformed data, updates ResizeObserver config, and disconnects', () => {
  env.reset();
  const container = env.document.createElement('div');
  env.document.body.appendChild(container);

  const cfg = {
    chartType: 'bar',
    barColor: '#ff0000',
    data: [{ label: 'Q1', value: '50' }, { label: 'Q2', value: 0 }],
  };
  ChartWidget.render(container, cfg);

  const canvas = container.querySelector('.db-chart-canvas');
  const ctx = canvas.getContext('2d');
  assert.ok(ctx.calls.some(c => c.name === 'fill'));

  // Update to line chart with named CSS color (not hex)
  ctx.calls.length = 0;
  const newCfg = {
    chartType: 'line',
    lineColor: 'rebeccapurple',
    data: JSON.stringify([{ label: 'A', value: 10 }, { label: 'B', value: 30 }]),
  };
  ChartWidget.update(container, newCfg);
  assert.ok(ctx.calls.some(c => c.name === 'bezierCurveTo'));
  assert.ok(ctx.calls.some(c => c.name === 'save'));
  assert.ok(ctx.calls.some(c => c.name === 'restore'));

  // ResizeObserver uses updated config (newCfg)
  ctx.calls.length = 0;
  assert.equal(env.resizeObservers.length, 1);
  env.resizeObservers[0].trigger();
  assert.ok(ctx.calls.some(c => c.name === 'bezierCurveTo'));

  // Malformed data does not throw
  ChartWidget.update(container, { chartType: 'bar', data: '{bad' });
  ChartWidget.update(container, { chartType: 'bar', data: '123' });

  // Destroy disconnects ResizeObserver
  ChartWidget.destroy(container);
  assert.equal(env.resizeObservers[0].disconnected, true);
});
