import type { Grid } from './Grid';
import type { WidgetDefinition, ResizeHandles, CSSClasses, Icons } from './Dashboard';

export interface CardOptions {
  widgetType: string;
  widgetDef: WidgetDefinition;
  config: Record<string, unknown>;
  grid: Grid;
  draggable?: boolean;
  resizable?: boolean;
  showConfig?: boolean;
  noMove?: boolean;
  noResize?: boolean;
  locked?: boolean;
  resizeHandles?: ResizeHandles;
  cssClasses?: CSSClasses;
  icons?: Icons;
  minW?: number;
  maxW?: number;
  minH?: number;
  maxH?: number;
  onConfig?: (card: Card) => void;
  onRemove?: (card: Card) => void;
  onChange?: () => void;
  onDragStart?: (card: Card) => void;
  onDragStop?: (card: Card) => void;
  onResizeStart?: (card: Card) => void;
  onResizeStop?: (card: Card) => void;
}

export declare class Card {
  id: string;
  widgetType: string;
  widgetDef: WidgetDefinition;
  config: Record<string, unknown>;
  grid: Grid;
  locked: boolean;
  minW?: number;
  maxW?: number;
  minH?: number;
  maxH?: number;
  el: HTMLElement;

  constructor(opts: CardOptions);

  /** Apply a partial config update and re-render the widget */
  applyConfig(newConfig: Record<string, unknown>): void;

  /** Return a shallow copy of the current config */
  getConfig(): Record<string, unknown>;

  /**
   * Tear down the card: cancels any in-flight drag, calls widgetDef.destroy(),
   * and removes the element from the DOM.
   */
  destroy(): void;
}
