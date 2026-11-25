import test from 'node:test';
import assert from 'node:assert/strict';
import { installDomEnv } from './dom-mock.js';
import { Grid } from '../src/Grid.js';

const env = installDomEnv();

function makeGrid(opts = {}) {
  env.reset();
  const el = env.document.createElement('div');
  el.className = 'db-grid';
  el._rect = { left: 0, top: 0, width: 1000, height: 800, right: 1000, bottom: 800 };
  env.document.body.appendChild(el);
  return new Grid({
    el,
    columns: opts.columns ?? 12,
    rowHeight: opts.rowHeight ?? 80,
    gap: opts.gap ?? 8,
    gridBackground: opts.gridBackground,
    gridPattern: opts.gridPattern,
    gridPatternColor: opts.gridPatternColor,
  });
}

let cardSeq = 1;
function makeFakeCard(overrides = {}) {
  const el = env.document.createElement('div');
  return {
    id: overrides.id || `fake-${cardSeq++}`,
    widgetType: overrides.widgetType || 'kpi',
    locked: Boolean(overrides.locked),
    minW: overrides.minW,
    maxW: overrides.maxW,
    minH: overrides.minH,
    maxH: overrides.maxH,
    el,
    getConfig: () => overrides.config || {},
  };
}

test('Grid: pixel/cell coordinate conversions round-trip accurately', () => {
  const grid = makeGrid({ columns: 12, rowHeight: 80, gap: 8 });
  const { cellW, cellH } = grid._cellSize();
  // innerW = 1000 - 16 = 984; 11 gaps = 88; cellW = (984 - 88) / 12 = 74.666...
  assert.ok(Math.abs(cellW - (984 - 88) / 12) < 1e-6);
  assert.equal(cellH, 80);

  const p = grid.cellToPixel(3, 2);
  const cell = grid.pixelToCell(p.x + 5, p.y + 5);
  assert.deepEqual(cell, { col: 3, row: 2 });

  const span = grid.cellSpanToPixel(2, 3);
  assert.ok(Math.abs(span.pw - (2 * cellW + 8)) < 1e-6);
  assert.equal(span.ph, 3 * 80 + 2 * 8);
});

test('Grid: placeCard resolves collisions and clamps out-of-bounds widths', () => {
  const grid = makeGrid({ columns: 4 });
  const c1 = makeFakeCard();
  const c2 = makeFakeCard();
  const c3 = makeFakeCard({ minW: 6 }); // exceeds columns=4 -> clamped to 4

  const p1 = grid.placeCard(c1, 0, 0, 2, 2);
  assert.deepEqual(p1, { x: 0, y: 0 });

  const p2 = grid.placeCard(c2, 0, 0, 2, 2);
  assert.deepEqual(p2, { x: 2, y: 0 });

  const p3 = grid.placeCard(c3, 2, 0, 6, 1);
  assert.deepEqual(p3, { x: 0, y: 2 });
  assert.equal(grid.cards.get(c3.id).w, 4);
});

test('Grid: isAreaEmpty does not mutate matrix rows', () => {
  const grid = makeGrid({ columns: 6 });
  const c1 = makeFakeCard();
  grid.placeCard(c1, 0, 0, 2, 2);

  assert.equal(grid.isAreaEmpty(0, 0, 2, 2), false);
  const lenBeforeDeepQuery = grid.matrix.length;
  assert.equal(grid.isAreaEmpty(0, 0, 2, 2, c1.id), true);
  assert.equal(grid.isAreaEmpty(2, 40, 2, 2), true);
  assert.ok(grid.matrix.length <= lenBeforeDeepQuery);
});

test('Grid: moveCard, resizeCard, resizeCardBounds respect constraints and locked state', () => {
  const grid = makeGrid({ columns: 6 });
  const c1 = makeFakeCard({ minW: 2, maxW: 4, minH: 1, maxH: 3 });
  grid.placeCard(c1, 0, 0, 2, 2);

  // Resize beyond maxW/maxH clamps
  grid.resizeCard(c1, 10, 10);
  assert.equal(grid.cards.get(c1.id).w, 4);
  assert.equal(grid.cards.get(c1.id).h, 3);

  // Resize near right edge shifts left cleanly instead of failing
  grid.moveCard(c1, 4, 0);
  assert.equal(grid.cards.get(c1.id).x, 2); // 6 - 4 = 2

  // Resize bounds with explicit origin
  grid.resizeCardBounds(c1, 1, 1, 3, 2);
  const entry = grid.cards.get(c1.id);
  assert.deepEqual({ x: entry.x, y: entry.y, w: entry.w, h: entry.h }, { x: 1, y: 1, w: 3, h: 2 });

  // Locked card ignores moveCard, resizeCard, resizeCardBounds
  const locked = makeFakeCard({ locked: true });
  grid.placeCard(locked, 0, 5, 2, 2);
  assert.deepEqual(grid.moveCard(locked, 3, 0), { x: 0, y: 5 });
  grid.resizeCard(locked, 4, 4);
  grid.resizeCardBounds(locked, 2, 0, 4, 4);
  const le = grid.cards.get(locked.id);
  assert.deepEqual({ x: le.x, y: le.y, w: le.w, h: le.h }, { x: 0, y: 5, w: 2, h: 2 });
});

test('Grid: compact packs unlocked cards upward while keeping locked cards fixed', () => {
  const grid = makeGrid({ columns: 6 });
  const locked = makeFakeCard({ locked: true });
  const c1 = makeFakeCard();
  const c2 = makeFakeCard();

  grid.placeCard(locked, 0, 1, 2, 2); // occupies rows 1..2 at cols 0..1
  grid.placeCard(c1, 0, 5, 2, 1);     // can move up to y=0!
  grid.placeCard(c2, 2, 4, 2, 2);     // can move up to y=0!

  grid.compact();

  assert.equal(grid.cards.get(locked.id).y, 1);
  assert.equal(grid.cards.get(c1.id).y, 0);
  assert.equal(grid.cards.get(c2.id).y, 0);
});

test('Grid: findFreePosition handles dense layouts quickly', () => {
  const grid = makeGrid({ columns: 12 });
  // Fill 5 rows completely
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 12; col += 2) {
      grid.placeCard(makeFakeCard(), col, row, 2, 1);
    }
  }
  const t0 = performance.now();
  const pos = grid.findFreePosition(0, 0, 2, 1);
  const dt = performance.now() - t0;
  assert.deepEqual(pos, { x: 0, y: 5 });
  assert.ok(dt < 50, `Expected findFreePosition to be fast, took ${dt}ms`);
});

test('Grid: batchUpdate defers _growGrid until endBatch', () => {
  const grid = makeGrid({ columns: 12, rowHeight: 80, gap: 8 });
  const initialMinH = grid.el.style.minHeight;

  grid.beginBatch();
  grid.placeCard(makeFakeCard(), 0, 15, 2, 2);
  // minHeight not updated yet during batch
  assert.equal(grid.el.style.minHeight, initialMinH);
  grid.endBatch();

  assert.ok(parseFloat(grid.el.style.minHeight) > 1000);
});

test('Grid: showDropPreview and hideDropPreview clamp and toggle visibility', () => {
  const grid = makeGrid({ columns: 6 });
  grid.showDropPreview(10, -2, 3, 2);
  const preview = grid.el.querySelector('.db-drop-preview');
  assert.ok(preview);
  assert.equal(preview.style.display, '');
  // Clamped col = 6 - 3 = 3, clamped row = 0
  const expectedPos = grid.cellToPixel(3, 0);
  assert.equal(preview.style.left, expectedPos.x + 'px');
  assert.equal(preview.style.top, expectedPos.y + 'px');

  grid.hideDropPreview();
  assert.equal(preview.style.display, 'none');
});
