import test from 'node:test';
import assert from 'node:assert/strict';
import { installDomEnv } from './dom-mock.js';
import { Dashboard } from '../src/Dashboard.js';

const env = installDomEnv();

function setupHost() {
  env.reset();
  const root = env.document.createElement('div');
  root.id = 'root';
  const sidebar = env.document.createElement('div');
  sidebar.id = 'sidebar';
  root.appendChild(sidebar);
  env.document.body.appendChild(root);
  return { root, sidebar };
}

test('Dashboard.create loads configPath and respects inline overrides', async () => {
  const { root, sidebar } = setupHost();
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.equal(url, './widget-config.json');
    return {
      ok: true,
      async json() {
        return {
          dashboard: { gridPattern: 'dots', sidebarPosition: 'right', cardConfigurable: true },
          kpi: { title: 'FromJSON', value: '999' },
        };
      },
    };
  };

  try {
    const dash = await Dashboard.create({
      container: root,
      sidebar,
      configPath: './widget-config.json',
      sidebarPosition: 'top', // inline overrides JSON
      initialCards: [{ widgetType: 'kpi', x: 0, y: 0 }],
    });

    assert.ok(root.classList.contains('db-layout--sidebar-top'));
    assert.equal(dash._gridEl.getAttribute('data-pattern'), 'dots');
    assert.equal(dash.getLayout()[0].config.title, 'FromJSON');
    assert.ok(dash._gridEl.querySelector('.db-card-btn--config'));
    dash.destroy();
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('Dashboard.create handles configPath HTTP error gracefully', async () => {
  const { root } = setupHost();
  const origFetch = globalThis.fetch;
  const origWarn = console.warn;
  let warned = false;
  console.warn = () => { warned = true; };
  globalThis.fetch = async () => ({ ok: false, status: 404 });

  try {
    const dash = await Dashboard.create({ container: root, configPath: './missing.json' });
    assert.equal(warned, true);
    assert.equal(dash.getLayout().length, 0);
    dash.destroy();
  } finally {
    globalThis.fetch = origFetch;
    console.warn = origWarn;
  }
});

test('Dashboard: addCard, removeCard, getLayout, loadLayout, batchUpdate, compact, isAreaEmpty', () => {
  const { root, sidebar } = setupHost();
  let changeCount = 0;
  const added = [];
  const removed = [];

  const dash = new Dashboard({
    container: root,
    sidebar,
    columns: 12,
    theme: { '--db-card-radius': '4px' },
    icons: { close: 'X' },
  });

  assert.equal(root.style.getPropertyValue('--db-card-radius'), '4px');

  dash.on('change', () => changeCount++);
  dash.on('card:added', ({ card }) => added.push(card.id));
  dash.on('card:removed', ({ card }) => removed.push(card.id));

  // batchUpdate emits change only once
  dash.batchUpdate(() => {
    dash.addCard({ widgetType: 'kpi', x: 0, y: 0, w: 2, h: 2 });
    dash.addCard({ widgetType: 'text', x: 0, y: 5, w: 3, h: 2 });
  });
  assert.equal(changeCount, 1);
  assert.equal(added.length, 2);
  assert.equal(dash.isAreaEmpty(0, 0, 2, 2), false);
  assert.equal(dash.isAreaEmpty(4, 0, 2, 2), true);

  // compact packs text card up to y=2
  dash.compact();
  const layoutAfterCompact = dash.getLayout();
  const textCard = layoutAfterCompact.find(c => c.widgetType === 'text');
  assert.equal(textCard.y, 2);
  assert.equal(changeCount, 2);

  // loadLayout batches into a single change event and warns on unknown widget types
  const origWarn = console.warn;
  let warnCalled = false;
  console.warn = () => { warnCalled = true; };
  dash.loadLayout([
    { widgetType: 'table', x: 0, y: 0, w: 4, h: 3 },
    { widgetType: 'unknown-type', x: 4, y: 0 },
  ]);
  console.warn = origWarn;

  assert.equal(warnCalled, true);
  assert.equal(removed.length, 2);
  assert.equal(dash.getLayout().length, 1);
  assert.equal(dash.getLayout()[0].widgetType, 'table');
  assert.equal(changeCount, 3);

  dash.removeCard(dash.getLayout()[0].id);
  assert.equal(dash.getLayout().length, 0);
  assert.equal(dash._emptyEl.style.display, '');

  dash.destroy();
});

test('Dashboard: sidebar drag-and-drop, disappearOnDrop, lock/unlock, float toggle, and ConfigPanel', () => {
  const { root, sidebar } = setupHost();
  const dash = new Dashboard({
    container: root,
    sidebar,
    sidebarPosition: 'float',
    cardConfigurable: true,
    disappearOnDrop: true,
    showGridInEditMode: true,
  });

  // Float toggle created on body
  const floatBtn = env.document.body.querySelector('.db-float-toggle');
  assert.ok(floatBtn);
  floatBtn.dispatchEvent({ type: 'click' });
  assert.ok(sidebar.classList.contains('db-sidebar--open'));
  assert.ok(floatBtn.classList.contains('db-float-toggle--open'));

  // Sidebar dragstart -> grid dragover -> grid drop
  const kpiItem = sidebar.querySelector('[data-widget-type="kpi"]');
  const dt = {
    effectAllowed: '',
    dropEffect: '',
    _data: {},
    setData(k, v) { this._data[k] = v; },
    getData(k) { return this._data[k] || ''; },
  };

  let droppedPayload = null;
  dash.on('dropped', (p) => { droppedPayload = p; });

  kpiItem.dispatchEvent({ type: 'dragstart', dataTransfer: dt });
  assert.equal(dash._draggingType, 'kpi');

  dash._gridEl._rect = { left: 0, top: 0, width: 1000, height: 800, right: 1000, bottom: 800 };
  dash._gridEl.dispatchEvent({ type: 'dragover', clientX: 200, clientY: 100, dataTransfer: dt });
  const preview = dash._gridEl.querySelector('.db-drop-preview');
  assert.ok(preview && preview.style.display === '');

  dash._gridEl.dispatchEvent({ type: 'drop', clientX: 200, clientY: 100, dataTransfer: dt });
  assert.ok(droppedPayload);
  assert.equal(droppedPayload.card.widgetType, 'kpi');
  assert.ok(kpiItem.classList.contains('db-sidebar-item--used'));
  assert.equal(preview.style.display, 'none');

  // ConfigPanel open, apply (updates dimensions BEFORE change event!), and Escape close
  let lastLayoutOnChange = null;
  dash.on('change', (l) => { lastLayoutOnChange = l; });

  const cfgBtn = droppedPayload.card.el.querySelector('.db-card-btn--config');
  cfgBtn.dispatchEvent({ type: 'click' });

  const panel = env.document.body.querySelector('.db-config-panel');
  assert.ok(panel);
  assert.equal(panel.getAttribute('role'), 'dialog');
  panel.querySelector('[name="title"]').value = 'New Title';
  panel.querySelector('[name="w"]').value = '5';
  panel.querySelector('[name="h"]').value = '3';
  panel.querySelector('.db-apply').dispatchEvent({ type: 'click' });

  assert.equal(env.document.body.querySelector('.db-config-panel'), null);
  assert.equal(lastLayoutOnChange[0].w, 5);
  assert.equal(lastLayoutOnChange[0].h, 3);
  assert.equal(lastLayoutOnChange[0].config.title, 'New Title');

  // Reopen ConfigPanel and close via Escape
  cfgBtn.dispatchEvent({ type: 'click' });
  assert.ok(env.document.body.querySelector('.db-config-panel'));
  env.document.dispatchEvent({ type: 'keydown', key: 'Escape' });
  assert.equal(env.document.body.querySelector('.db-config-panel'), null);

  // Disable / enable syncs sidebar lock button & grid class
  dash.disable();
  assert.ok(dash._gridEl.classList.contains('db-grid--disabled'));
  assert.ok(sidebar.classList.contains('db-sidebar--locked'));
  dash.enable();
  assert.ok(!dash._gridEl.classList.contains('db-grid--disabled'));
  assert.ok(!sidebar.classList.contains('db-sidebar--locked'));

  // Destroy cleans up cards, observers, classes, float toggle
  dash.destroy();
  assert.equal(env.document.body.querySelector('.db-float-toggle'), null);
  assert.ok(!root.classList.contains('db-layout'));
  assert.ok(!root.classList.contains('db-layout--sidebar-float'));
  assert.equal(root.innerHTML, '');
});

test('Dashboard: custom widget override deduplicates sidebar item and calls widget destroy on Dashboard.destroy', () => {
  const { root, sidebar } = setupHost();
  let destroyedCount = 0;

  const CustomKpi = {
    type: 'kpi',
    label: 'Custom <KPI>',
    icon: '★',
    description: 'Overrides & escapes',
    defaultConfig: { w: 3, h: 2, title: 'Custom' },
    render(c) { c.textContent = 'rendered'; },
    update() {},
    destroy() { destroyedCount++; },
  };

  const dash = new Dashboard({
    container: root,
    sidebar,
    widgets: [CustomKpi],
    initialCards: [{ widgetType: 'kpi', x: 0, y: 0 }],
  });

  // Only 4 items total (kpi overridden, not duplicated)
  assert.equal(sidebar.querySelectorAll('.db-sidebar-item').length, 4);
  assert.equal(dash.getLayout()[0].w, 3);

  dash.destroy();
  assert.equal(destroyedCount, 1);
});
