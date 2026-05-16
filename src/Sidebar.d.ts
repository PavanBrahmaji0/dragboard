import type { WidgetDefinition, CSSClasses, Icons } from './Dashboard';

export interface SidebarOptions {
  el: HTMLElement;
  widgets: WidgetDefinition[];
  onDragStart: (type: string, event: DragEvent) => void;
  onToggleLock?: (locked: boolean) => void;
  cssClasses?: CSSClasses;
  icons?: Icons;
}

export declare class Sidebar {
  el: HTMLElement;

  constructor(opts: SidebarOptions);

  /** Mark a widget type as used (disables dragging from the sidebar) */
  markUsed(type: string): void;

  /** Mark a widget type as free (re-enables dragging from the sidebar) */
  markFree(type: string): void;

  /** Sync visual lock state from Dashboard.disable() without firing onToggleLock */
  lock(): void;

  /** Sync visual unlock state from Dashboard.enable() without firing onToggleLock */
  unlock(): void;
}
