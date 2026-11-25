import test from 'node:test';
import assert from 'node:assert/strict';
import { installDomEnv } from './dom-mock.js';
import { Grid } from '../src/Grid.js';
import { Card } from '../src/Card.js';
import KpiWidget from '../src/widgets/KpiWidget.js';

const env = installDomEnv();

function setupGridAndCard(cardOpts = {}) {
  env.reset();
  const gridEl = env.document.createElement('div');
  gridEl.className = 'db-grid';
  gridEl._rect = { left: 0, top: 0, width: 1000, height: 800, right: 1000, bottom: 800 };
  env.document.body.appendChild(gridEl);

  const grid = new Grid({ el: gridEl, columns: 12, rowHeight: 80, gap: 8 });
  const events = {
    dragStart: 0, dragStop: 0, resizeStart: 0, resizeStop: 0, change: 0, remove: 0, config: 0,
  };

  const card = new Card({
    widgetType: 'kpi',
    widgetDef: KpiWidget,
    config: { title: 'Rev', value: '100' },
    grid,
    onConfig: () => events.config++,
    onRemove: () => events.remove++,
    onChange: () => events.change++,
    onDragStart: () => events.dragStart++,
    onDragStop: () => events.dragStop++,
    onResizeStart: () => events.resizeStart++,
    onResizeStop: () => events.resizeStop++,
    ...cardOpts,
  });

  gridEl.appendChild(card.el);
  grid.placeCard(card, cardOpts.x ?? 0, cardOpts.y ?? 0, cardOpts.w ?? 2, cardOpts.h ?? 2);
  return { grid, card, events };
}

test('Card: resizeHandles presets and custom strings', () => {
  const se = setupGridAndCard({ resizeHandles: 'se' });
  assert.equal(se.card.el.querySelectorAll('.db-card-resize').length, 1);

  const two = setupGridAndCard({ resizeHandles: '2side' });
  assert.equal(two.card.el.querySelectorAll('.db-card-resize').length, 3);

  const four = setupGridAndCard({ resizeHandles: '4corners' });
  assert.equal(four.card.el.querySelectorAll('.db-card-resize').length, 4);

  const all = setupGridAndCard({ resizeHandles: 'all' });
  assert.equal(all.card.el.querySelectorAll('.db-card-resize').length, 8);

  const custom = setupGridAndCard({ resizeHandles: 'n, w, bogus' });
  assert.equal(custom.card.el.querySelectorAll('.db-card-resize').length, 2);

  const none = setupGridAndCard({ resizeHandles: 'none' });
  assert.equal(none.card.el.querySelectorAll('.db-card-resize').length, 0);
});

test('Card: mouse drag moves card and Escape cancels drag', () => {
  const { grid, card, events } = setupGridAndCard();
  const header = card.el.querySelector('.db-card-header');
  const { cellW, cellH } = grid._cellSize();

  // Drag from (10, 10) by 2 cells right, 1 cell down
  header.dispatchEvent({ type: 'mousedown', clientX: 10, clientY: 10, target: header });
  assert.equal(events.dragStart, 1);
  assert.ok(card.el.classList.contains('db-card--dragging'));

  const targetPos = grid.cellToPixel(2, 1);
  env.document.dispatchEvent({ type: 'mousemove', clientX: targetPos.x + 15, clientY: targetPos.y + 15 });
  env.document.dispatchEvent({ type: 'mouseup', clientX: targetPos.x + 15, clientY: targetPos.y + 15 });

  assert.equal(events.dragStop, 1);
  assert.equal(events.change, 1);
  assert.ok(!card.el.classList.contains('db-card--dragging'));
  const entry = grid.cards.get(card.id);
  assert.deepEqual({ x: entry.x, y: entry.y }, { x: 2, y: 1 });

  // Start another drag and cancel with Escape
  const startPx = grid.cellToPixel(2, 1);
  header.dispatchEvent({ type: 'mousedown', clientX: startPx.x + 10, clientY: startPx.y + 10, target: header });
  env.document.dispatchEvent({ type: 'mousemove', clientX: startPx.x + 2 * (cellW + 8), clientY: startPx.y + cellH + 8 });
  env.document.dispatchEvent({ type: 'keydown', key: 'Escape' });

  // Position restored, dragStop not incremented
  assert.equal(events.dragStop, 1);
  assert.equal(card.el.style.left, startPx.x + 'px');
  assert.equal(card.el.style.top, startPx.y + 'px');
});

test('Card: touchmove on header does not preventDefault when not dragging', () => {
  const { card } = setupGridAndCard();
  const header = card.el.querySelector('.db-card-header');
  const closeBtn = card.el.querySelector('.db-card-btn--close');

  // Touchstart on close button does not start drag
  header.dispatchEvent({ type: 'touchstart', touches: [{ clientX: 5, clientY: 5 }], target: closeBtn });
  const moveEvt = { type: 'touchmove', touches: [{ clientX: 20, clientY: 20 }], target: header };
  header.dispatchEvent(moveEvt);
  assert.equal(moveEvt.defaultPrevented, false);
});

test('Card: multi-direction resize (SE and NW) snaps to grid and clamps at left/top boundary', () => {
  const { grid, card, events } = setupGridAndCard({ resizeHandles: 'all', x: 1, y: 1, w: 2, h: 2 });
  const { cellW, cellH } = grid._cellSize();

  // SE handle: grow by +1 col, +1 row
  const se = card.el.querySelector('.db-card-resize--se');
  se.dispatchEvent({ type: 'mousedown', clientX: 100, clientY: 100, target: se });
  assert.equal(events.resizeStart, 1);
  env.document.dispatchEvent({ type: 'mousemove', clientX: 100 + cellW + 8, clientY: 100 + cellH + 8 });
  env.document.dispatchEvent({ type: 'mouseup' });

  assert.equal(events.resizeStop, 1);
  let entry = grid.cards.get(card.id);
  assert.deepEqual({ x: entry.x, y: entry.y, w: entry.w, h: entry.h }, { x: 1, y: 1, w: 3, h: 3 });

  // NW handle: drag far past top-left boundary (-500, -500) -> clamps cleanly at x=0, y=0 without overflowing right/bottom!
  const nw = card.el.querySelector('.db-card-resize--nw');
  nw.dispatchEvent({ type: 'mousedown', clientX: 100, clientY: 100, target: nw });
  env.document.dispatchEvent({ type: 'mousemove', clientX: -500, clientY: -500 });
  env.document.dispatchEvent({ type: 'mouseup' });

  entry = grid.cards.get(card.id);
  assert.equal(entry.x, 0);
  assert.equal(entry.y, 0);
  assert.equal(entry.w, 4); // original right edge was 1 + 3 = 4
  assert.equal(entry.h, 4); // original bottom edge was 1 + 3 = 4
});

test('Card: locked, noMove, noResize, custom cssClasses with extra whitespace, and destroy cleanup', () => {
  const { card, events } = setupGridAndCard({
    locked: true,
    resizeHandles: 'all',
    cssClasses: { card: '  foo   bar  ', cardHeader: 'hdr', cardBtn: 'btn-x' },
  });

  assert.ok(card.el.classList.contains('db-card--locked'));
  assert.ok(card.el.classList.contains('db-card--no-drag'));
  assert.ok(card.el.classList.contains('foo'));
  assert.ok(card.el.classList.contains('bar'));
  assert.equal(card.el.querySelectorAll('.db-card-resize').length, 0);

  // Destroy cleans up active resize listeners
  const active = setupGridAndCard({ resizeHandles: 'se' });
  const se = active.card.el.querySelector('.db-card-resize--se');
  se.dispatchEvent({ type: 'mousedown', clientX: 10, clientY: 10, target: se });
  assert.ok(env.docListeners.get('mousemove')?.size > 0);
  active.card.destroy();
  assert.equal(env.docListeners.get('mousemove')?.size || 0, 0);
  assert.equal(active.events.resizeStop, 0);

  // applyConfig clears bgColor when empty
  card.applyConfig({ title: 'Updated', bgColor: '' });
  assert.equal(card.el.querySelector('.db-card-title').textContent, 'Updated');
  assert.equal(card.el.querySelector('.db-card-body').style.background, '');
  assert.equal(events.change, 1);
});
