import { EventEmitter } from './EventEmitter';
import type { Card } from './Card';

/* ── Widget definition contract ────────────────────────────────────────── */

export interface ConfigField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'color' | 'select' | 'textarea' | string;
  options?: string[];
  default?: string | number;
}

export interface WidgetDefinition {
  type: string;
  label: string;
  icon: string;
  description?: string;
  defaultConfig: Record<string, unknown> & {
    w?: number;
    h?: number;
    title?: string;
    bgColor?: string;
  };
  configFields?: ConfigField[];
  render(container: HTMLElement, config: Record<string, unknown>): void;
  update(container: HTMLElement, config: Record<string, unknown>): void;
  destroy?(container: HTMLElement): void;
}

/* ── Layout ─────────────────────────────────────────────────────────────── */

export interface CardSpec {
  widgetType: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  config?: Record<string, unknown>;
  noMove?: boolean;
  noResize?: boolean;
  locked?: boolean;
  minW?: number;
  maxW?: number;
  minH?: number;
  maxH?: number;
  resizeHandles?: ResizeHandles;
}

export interface LayoutEntry extends Required<Pick<CardSpec, 'x' | 'y' | 'w' | 'h'>> {
  id: string;
  widgetType: string;
  config: Record<string, unknown>;
}

/* ── Appearance ─────────────────────────────────────────────────────────── */

export type GridPattern = 'cubes' | 'dots' | 'lines' | 'columns' | 'dashed' | 'cross' | 'none';
export type SidebarPosition = 'left' | 'right' | 'top' | 'bottom' | 'float';
export type ResizeHandles = 'none' | 'se' | '2side' | '4corners' | 'all' | string;

export interface CSSClasses {
  card?: string;
  cardHeader?: string;
  cardBody?: string;
  cardBtn?: string;
  cardBtnClose?: string;
  cardBtnConfig?: string;
  sidebar?: string;
  sidebarHeader?: string;
  sidebarItem?: string;
}

export interface Icons {
  drag?: string;
  close?: string;
  config?: string;
  lock?: string;
  unlock?: string;
  menu?: string;
  empty?: string;
}

/* ── Events ─────────────────────────────────────────────────────────────── */

export interface DashboardEvents {
  'card:added':    { card: Card };
  'card:removed':  { card: Card };
  'card:moved':    { card: Card };
  'card:resized':  { card: Card };
  dropped:         { card: Card; x: number; y: number };
  dragstart:       { card: Card };
  dragstop:        { card: Card };
  resizestart:     { card: Card };
  resizestop:      { card: Card };
  change:          LayoutEntry[];
  compact:         void;
  enable:          void;
  disable:         void;
}

/* ── Constructor options ─────────────────────────────────────────────────── */

export interface DashboardOptions {
  container: string | HTMLElement;
  sidebar?: string | HTMLElement;
  /** URL to widget-config.json — fetched async, merged with inline widgetConfig */
  configPath?: string;
  widgetConfig?: Record<string, Record<string, unknown>>;
  columns?: number;
  rowHeight?: number;
  gap?: number;
  sidebarPosition?: SidebarPosition;
  gridBackground?: string;
  gridPattern?: GridPattern;
  gridPatternColor?: string;
  disappearOnDrop?: boolean;
  draggable?: boolean;
  cardConfigurable?: boolean;
  resizeHandles?: ResizeHandles;
  /** CSS custom property overrides scoped to this instance, e.g. `{ '--db-card-radius': '4px' }` */
  theme?: Record<string, string>;
  cssClasses?: CSSClasses;
  icons?: Icons;
  showGridInEditMode?: boolean;
  widgets?: WidgetDefinition[];
  initialCards?: CardSpec[];
  /** Legacy callback — prefer listening to the 'change' event */
  onChange?: (layout: LayoutEntry[]) => void;
}

/* ── Dashboard class ────────────────────────────────────────────────────── */

export declare const DEFAULT_ICONS: Required<Icons>;

export declare class Dashboard extends EventEmitter {
  /** Async factory that loads widget-config.json before constructing */
  static create(opts?: DashboardOptions): Promise<Dashboard>;

  constructor(opts?: DashboardOptions);

  /** Add a card to the grid. Returns the Card instance, or undefined if the widget type is unknown. */
  addCard(spec: CardSpec): Card | undefined;

  /** Remove a card by its ID */
  removeCard(cardId: string): void;

  /** Serialise the current layout to a plain array */
  getLayout(): LayoutEntry[];

  /** Replace the entire layout */
  loadLayout(layout: CardSpec[]): void;

  /** Pack all cards upward to eliminate empty rows */
  compact(): void;

  /** Enable drag/resize/drop interactions */
  enable(): void;

  /** Disable all interactions (view/lock mode) */
  disable(): void;

  /** Run multiple operations without intermediate layout recalculations */
  batchUpdate(fn: () => void): void;

  /**
   * Check whether a grid area is free of cards.
   * @param skipId  card ID to exclude from the occupancy check
   */
  isAreaEmpty(x: number, y: number, w: number, h: number, skipId?: string): boolean;

  /** Strongly-typed event subscription */
  on<K extends keyof DashboardEvents>(event: K, cb: (payload: DashboardEvents[K]) => void): this;
  off<K extends keyof DashboardEvents>(event: K, cb: (payload: DashboardEvents[K]) => void): this;
  once<K extends keyof DashboardEvents>(event: K, cb: (payload: DashboardEvents[K]) => void): this;

  /** Tear down the instance: removes event listeners, empties the container */
  destroy(): void;
}
