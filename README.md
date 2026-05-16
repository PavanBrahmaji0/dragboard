# @pavanbrahmaji0/dashboard-lib

A zero-dependency, framework-agnostic drag-and-drop dashboard library with full TypeScript support.

Works in vanilla JS, React, Angular, Vue — no build step required.

## Features

- **Drag & drop** cards from a sidebar onto a responsive grid
- **Resize** cards in 8 directions (se, sw, ne, nw, n, s, e, w) — configurable per card
- **4 built-in widgets**: KPI metric, Analytics chart (Canvas), Data table, Notes
- **6 grid background patterns**: cubes, dots, lines, columns, dashed, cross
- **5 sidebar positions**: left, right, top, bottom, float
- **Lock mode**: disables all interactions, hides close buttons, fades the grid
- **Full TypeScript types** — ambient `.d.ts` declarations, zero build step
- **30+ CSS custom properties** for scoped theming
- **Custom icons** — any HTML string, SVG, or icon-font tag
- **Per-card constraints**: minW/maxW/minH/maxH, noMove, noResize, locked
- **Events**: `card:added`, `card:removed`, `card:moved`, `card:resized`, `dropped`, `change`, and more
- **Zero dependencies** — no React, no Angular, no D3, no build tools needed

## Installation

```bash
npm install @pavanbrahmaji0/dashboard-lib
```

## Quick Start

```html
<link rel="stylesheet" href="node_modules/@pavanbrahmaji0/dashboard-lib/src/dashboard.css">

<div id="root">
  <div id="sidebar"></div>
</div>

<script type="module">
  import { Dashboard } from '@pavanbrahmaji0/dashboard-lib';

  const dash = await Dashboard.create({
    container: '#root',
    sidebar:   '#sidebar',
    columns:   12,
    rowHeight: 80,
    gap:       8,
  });
</script>
```

## Options

```js
const dash = await Dashboard.create({
  container:          '#root',          // required
  sidebar:            '#sidebar',       // optional
  configPath:         './widget-config.json', // JSON defaults (optional)

  columns:            12,
  rowHeight:          80,
  gap:                8,

  sidebarPosition:    'left',           // 'left'|'right'|'top'|'bottom'|'float'
  gridPattern:        'cubes',          // 'cubes'|'dots'|'lines'|'columns'|'dashed'|'cross'|'none'
  gridBackground:     '#ffffff',
  gridPatternColor:   '#e2e8f0',

  disappearOnDrop:    true,             // sidebar item disappears after first drop
  draggable:          true,
  cardConfigurable:   false,            // show ⚙ gear button on cards
  resizeHandles:      'se',             // 'none'|'se'|'2side'|'4corners'|'all'|'n,s,e,w,...'
  showGridInEditMode: true,

  theme: {
    '--db-card-radius':      '4px',
    '--db-card-header-bg':   '#0f172a',
  },

  cssClasses: {
    card:        'my-card',
    cardHeader:  'my-header',
    cardBody:    'my-body',
    sidebarItem: 'my-item',
  },

  icons: {
    drag:   '<i class="fa fa-grip-vertical"></i>',
    close:  '<i class="fa fa-times"></i>',
    config: '<i class="fa fa-cog"></i>',
  },

  initialCards: [
    { widgetType: 'kpi',   x: 0, y: 0, w: 2, h: 2, config: { title: 'Revenue', value: '84,200' } },
    { widgetType: 'chart', x: 2, y: 0, w: 4, h: 3 },
  ],
});
```

## API

```js
// Add / remove cards
dash.addCard({ widgetType, x, y, w, h, config });
dash.removeCard(cardId);

// Layout
dash.getLayout();          // → serialisable array
dash.loadLayout(array);
dash.compact();            // pack cards upward

// Lock / unlock
dash.disable();            // view mode — no drag/resize/drop
dash.enable();

// Batch (no intermediate redraws)
dash.batchUpdate(() => {
  dash.addCard({ ... });
  dash.addCard({ ... });
});

// Query
dash.isAreaEmpty(x, y, w, h, skipId?); // → boolean

// Events
dash.on('card:added',   ({ card }) => { });
dash.on('card:removed', ({ card }) => { });
dash.on('card:moved',   ({ card }) => { });
dash.on('card:resized', ({ card }) => { });
dash.on('dropped',      ({ card, x, y }) => { });
dash.on('change',       (layout) => { });

// Teardown
dash.destroy();
```

## Custom Widget

```js
const MyWidget = {
  type:          'my-widget',
  label:         'My Widget',
  icon:          '🚀',
  description:   'Does something cool',
  defaultConfig: { w: 3, h: 2, title: 'My Widget' },
  configFields:  [
    { name: 'color', label: 'Color', type: 'color' },
  ],
  render(container, config) {
    container.innerHTML = `<div style="color:${config.color}">Hello!</div>`;
  },
  update(container, config) {
    container.querySelector('div').style.color = config.color;
  },
  destroy(container) { /* cleanup observers, timers, etc. */ },
};

const dash = await Dashboard.create({
  widgets: [MyWidget],
  // ...
});
```

## Angular Integration

```ts
import { Component, AfterViewInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';

@Component({
  template: `
    <div #root style="display:flex;flex:1;min-height:0">
      <div #sidebar></div>
    </div>
  `
})
export class DashboardComponent implements AfterViewInit, OnDestroy {
  @ViewChild('root')    rootRef!: ElementRef;
  @ViewChild('sidebar') sidebarRef!: ElementRef;
  private dash: any;

  async ngAfterViewInit() {
    const { Dashboard } = await import('@pavanbrahmaji0/dashboard-lib');
    this.dash = await Dashboard.create({
      container: this.rootRef.nativeElement,
      sidebar:   this.sidebarRef.nativeElement,
    });
  }

  ngOnDestroy() { this.dash?.destroy(); }
}
```

## CSS Custom Properties

| Variable | Default | Controls |
|---|---|---|
| `--db-card-bg` | `#ffffff` | Card background |
| `--db-card-border` | `#e2e8f0` | Card border |
| `--db-card-radius` | `10px` | Card border radius |
| `--db-card-shadow` | `0 2px 12px …` | Card shadow |
| `--db-card-header-bg` | `#1e293b` | Header background |
| `--db-card-header-color` | `#ffffff` | Header text |
| `--db-card-header-height` | `40px` | Header height |
| `--db-card-btn-size` | `26px` | Button size |
| `--db-sidebar-bg` | `#ffffff` | Sidebar background |
| `--db-sidebar-border` | `#e2e8f0` | Sidebar border |
| `--db-grid-line-color` | `#e2e8f0` | Grid pattern color |
| `--db-grid-line-width` | `1px` | Grid line thickness |

## License

MIT
