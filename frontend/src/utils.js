// SQL syntax highlighting & utility helpers

const SQL_KEYWORDS = ['SELECT','FROM','WHERE','JOIN','INNER','LEFT','RIGHT','OUTER','ON','GROUP BY','ORDER BY','HAVING','LIMIT','OFFSET','INSERT','UPDATE','SET','DELETE','CREATE','DROP','ALTER','TABLE','AS','AND','OR','NOT','IN','IS','NULL','LIKE','BETWEEN','DISTINCT','COUNT','SUM','AVG','MIN','MAX','CASE','WHEN','THEN','ELSE','END','ASC','DESC','BY','INTO','VALUES'];
const SQL_FNS = ['COUNT','SUM','AVG','MIN','MAX','COALESCE','IFNULL','NOW','DATE','YEAR','MONTH','DAY','CONCAT','UPPER','LOWER','TRIM','LENGTH','ROUND','CAST'];

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

export function highlightSql(raw) {
  if (!raw) return '';
  let s = escapeHtml(raw);
  s = s.replace(/('[^']*')/g, '<span class="sql-str">$1</span>');
  s = s.replace(/\b(\d+(\.\d+)?)\b/g, '<span class="sql-num">$1</span>');
  SQL_FNS.forEach(fn => {
    s = s.replace(new RegExp(`\\b(${fn})\\s*(?=\\()`, 'gi'), '<span class="sql-fn">$1</span>');
  });
  SQL_KEYWORDS.forEach(kw => {
    s = s.replace(new RegExp(`\\b(${kw})\\b`, 'gi'), '<span class="sql-kw">$1</span>');
  });
  return s;
}

export function formatDate(isoStr) {
  if (!isoStr) return 'N/A';
  return new Date(isoStr).toLocaleString();
}

export function exportCsv(columns, results) {
  const esc = v => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [columns.map(esc).join(','), ...results.map(r => columns.map(c => esc(r[c] !== null ? r[c] : '')).join(','))].join('\r\n');
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: `query_results_${Date.now()}.csv` });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

export function exportJson(results) {
  const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `query_export_${Date.now()}.json` });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

export const SCHEMA_REF = [
  {
    table_name: 'departments',
    columns: [
      { column_name: 'id', type: 'int' },
      { column_name: 'name', type: 'varchar' },
    ],
  },
  {
    table_name: 'employees',
    columns: [
      { column_name: 'id', type: 'int' },
      { column_name: 'name', type: 'varchar' },
      { column_name: 'department', type: 'varchar' },
      { column_name: 'salary', type: 'decimal' },
      { column_name: 'hire_date', type: 'date' },
    ],
  },
  {
    table_name: 'products',
    columns: [
      { column_name: 'id', type: 'int' },
      { column_name: 'name', type: 'varchar' },
      { column_name: 'category', type: 'varchar' },
      { column_name: 'price', type: 'decimal' },
    ],
  },
  {
    table_name: 'orders',
    columns: [
      { column_name: 'id', type: 'int' },
      { column_name: 'customer_name', type: 'varchar' },
      { column_name: 'product_id', type: 'int' },
      { column_name: 'quantity', type: 'int' },
      { column_name: 'order_date', type: 'date' },
      { column_name: 'total', type: 'decimal' },
    ],
  },
  {
    table_name: 'query_audit_log',
    columns: [
      { column_name: 'id', type: 'int' },
      { column_name: 'timestamp', type: 'timestamp' },
      { column_name: 'question', type: 'text' },
      { column_name: 'status', type: 'varchar' },
      { column_name: 'final_sql', type: 'text' },
      { column_name: 'attempts', type: 'json' },
      { column_name: 'num_attempts', type: 'int' },
    ],
  },
];

export const SAMPLE_CHIPS = [
  'What is the average salary of employees?',
  'Show the total sales for each product category',
  'List the top 3 products ordered by quantity',
  'Delete all employee records',
  'Find products whose price is greater than 500',
];
