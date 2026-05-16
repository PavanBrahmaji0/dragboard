const DEFAULT_COLS = 'Name,Value,Status';
const DEFAULT_ROWS = JSON.stringify([
  ['Alpha', '1,200', 'Active'],
  ['Beta',  '3,400', 'Pending'],
  ['Gamma', '800',   'Inactive'],
]);

const TableWidget = {
  type: 'table',
  label: 'Data Table',
  icon: '📊',
  description: 'Configurable tabular data',
  defaultConfig: {
    title: 'Data Table',
    w: 4,
    h: 3,
    bgColor: '#ffffff',
    columns: DEFAULT_COLS,
    rows: DEFAULT_ROWS,
  },
  configFields: [
    { name: 'columns', label: 'Columns (comma-separated)', type: 'text' },
    { name: 'rows',    label: 'Rows (JSON array of arrays)', type: 'textarea' },
  ],

  render(container, config) {
    container.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'db-table-wrap';
    wrap.appendChild(TableWidget._buildTable(config));
    container.appendChild(wrap);
  },

  update(container, config) {
    const wrap = container.querySelector('.db-table-wrap');
    if (!wrap) return;
    wrap.innerHTML = '';
    wrap.appendChild(TableWidget._buildTable(config));
  },

  _buildTable(config) {
    const cols = (config.columns || DEFAULT_COLS).split(',').map(s => s.trim());
    let rows = [];
    try { rows = JSON.parse(config.rows || DEFAULT_ROWS); } catch { rows = []; }

    const table = document.createElement('table');
    table.className = 'db-table';

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    cols.forEach(col => {
      const th = document.createElement('th');
      th.textContent = col;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    rows.forEach(row => {
      const tr = document.createElement('tr');
      (Array.isArray(row) ? row : [row]).forEach(cell => {
        const td = document.createElement('td');
        td.textContent = String(cell);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    return table;
  },
};

export default TableWidget;
