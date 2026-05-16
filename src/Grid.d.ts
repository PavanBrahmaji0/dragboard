import type { Card } from './Card';
import type { GridPattern } from './Dashboard';

export interface CardEntry {
  card: Card;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GridOptions {
  el: HTMLElement;
  columns: number;
  rowHeight: number;
  gap: number;
  gridBackground?: string;
  gridPatternColor?: string;
  gridPattern?: GridPattern;
}

export declare class Grid {
  el: HTMLElement;
  columns: number;
  rowHeight: number;
  gap: number;
  cards: Map<string, CardEntry>;
  matrix: boolean[][];

  constructor(opts: GridOptions);

  /** Place a new card, snapping to nearest free position */
  placeCard(card: Card, x: number, y: number, w: number, h: number): { x: number; y: number };

  /** Move an existing card to a new grid position */
  moveCard(card: Card, toCol: number, toRow: number): { x: number; y: number } | undefined;

  /** Resize a card, keeping its origin fixed */
  resizeCard(card: Card, newW: number, newH: number): void;

  /** Resize with explicit origin — used by N/W direction handles */
  resizeCardBounds(card: Card, x: number, y: number, w: number, h: number): void;

  /** Remove a card from the grid */
  removeCard(cardId: string): void;

  /** Re-position all cards after a container resize */
  repositionAll(): void;

  /** Pack all cards upward to eliminate empty rows */
  compact(): void;

  /** Check whether a rectangular area is free */
  isAreaEmpty(x: number, y: number, w: number, h: number, skipId?: string | null): boolean;

  /** Find the nearest free position for a w×h block starting at (col, row) */
  findFreePosition(col: number, row: number, w: number, h: number, skipId?: string | null): { x: number; y: number };

  /** Convert client pixel coords to grid cell coordinates */
  pixelToCell(clientX: number, clientY: number): { col: number; row: number };

  /** Convert grid cell to pixel position (top-left of cell) */
  cellToPixel(col: number, row: number): { x: number; y: number };

  /** Convert grid span to pixel dimensions */
  cellSpanToPixel(w: number, h: number): { pw: number; ph: number };

  /** Show the semi-transparent drop-target preview */
  showDropPreview(col: number, row: number, w: number, h: number): void;

  /** Hide the drop-target preview */
  hideDropPreview(): void;

  /** Defer layout recalculation — call endBatch() when done */
  beginBatch(): void;

  /** Flush deferred layout recalculation */
  endBatch(): void;

  /** Serialise the grid to a plain layout array */
  serialize(): import('./Dashboard').LayoutEntry[];
}
