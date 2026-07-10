import React, { useState } from 'react';
import { postSandbox, postExplain } from '../api';
import { highlightSql, exportCsv, exportJson } from '../utils';
import { showToast } from './Toast';
import Modal from './Modal';

export default function Sandbox() {
  const [sql, setSql] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null); // { status, columns, results, error, elapsed }
  const [modalOpen, setModalOpen] = useState(false);
  const [explanation, setExplanation] = useState('');

  const runQuery = async () => {
    if (!sql.trim()) { showToast('Enter a SQL query first', 'warning'); return; }
    setRunning(true);
    setResult({ status: 'loading' });
    const t0 = Date.now();
    try {
      const data = await postSandbox(sql);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
      setResult({ status: 'success', columns: data.columns || [], results: data.results || [], elapsed });
    } catch (e) {
      setResult({ status: 'error', error: e.message });
    } finally {
      setRunning(false);
    }
  };

  const handleExplain = async () => {
    try {
      const data = await postExplain(sql);
      setExplanation(data.explanation);
      setModalOpen(true);
    } catch (e) {
      showToast('Error explaining SQL: ' + e.message, 'error');
    }
  };

  return (
    <div className="sandbox-layout">
      {/* Editor Panel */}
      <div className="sandbox-panel">
        <div className="sandbox-panel-header">
          <span className="sandbox-panel-title">⚡ SQL Editor</span>
          <span style={{ fontSize: '.72rem', color: 'var(--text-dark)' }}>Safety-validated</span>
        </div>
        <div className="sandbox-panel-body">
          <textarea
            className="sql-editor"
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            placeholder={"SELECT * FROM employees WHERE salary > 80000;\nSELECT department, COUNT(*) FROM employees GROUP BY department;\n-- Write any SELECT query here…"}
            spellCheck={false}
          />
          <div className="sandbox-actions">
            <button className="run-btn" onClick={runQuery} disabled={running}>
              <svg width="13" height="13" fill="currentColor" viewBox="0 0 16 16"><path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z" /></svg>
              {running ? 'Running…' : 'Run Query'}
            </button>
            <button className="clear-sql-btn" onClick={() => { setSql(''); setResult(null); }}>Clear</button>
            <button className="clear-sql-btn" onClick={() => setSql('SELECT * FROM employees LIMIT 10;')}>Sample</button>
          </div>
        </div>
      </div>

      {/* Results Panel */}
      <div className="sandbox-panel">
        <div className="sandbox-panel-header">
          <span className="sandbox-panel-title">📄 Results</span>
          <span style={{ fontSize: '.72rem', color: 'var(--text-dark)' }}>
            {result?.status === 'success' && `${result.results.length} row${result.results.length !== 1 ? 's' : ''} · ${result.elapsed}s`}
          </span>
        </div>
        <div className="sandbox-panel-body">
          <div className="sandbox-result-area">
            {!result && (
              <div className="sandbox-placeholder">
                <div className="sandbox-placeholder-icon">⚡</div>
                <span>Results will appear here</span>
              </div>
            )}
            {result?.status === 'loading' && (
              <div className="sandbox-placeholder">
                <div className="sandbox-placeholder-icon" style={{ animation: 'spin .8s linear infinite', display: 'inline-block' }}>⚡</div>
                <span>Executing query…</span>
              </div>
            )}
            {result?.status === 'error' && (
              <div className="sandbox-error">❌ {result.error}</div>
            )}
            {result?.status === 'success' && result.results.length === 0 && (
              <div className="sandbox-placeholder"><span>✓ Query succeeded — no rows returned</span></div>
            )}
            {result?.status === 'success' && result.results.length > 0 && (
              <>
                <div className="sandbox-success-meta" style={{ marginBottom: '.5rem' }}>
                  ✓ {result.results.length} row{result.results.length !== 1 ? 's' : ''} returned in {result.elapsed}s
                </div>
                <div style={{ display: 'flex', gap: '.5rem', marginBottom: '.5rem' }}>
                  <button className="export-csv-btn" onClick={handleExplain} style={{ padding: '.3rem .6rem' }}>💡 Explain SQL</button>
                  <button className="export-csv-btn" onClick={() => exportJson(result.results)} style={{ padding: '.3rem .6rem' }}>⬇ JSON</button>
                  <button className="export-csv-btn" onClick={() => exportCsv(result.columns, result.results)} style={{ padding: '.3rem .6rem' }}>⬇ CSV</button>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', fontSize: '.8rem', borderCollapse: 'collapse' }}>
                    <thead><tr>{result.columns.map(c => <th key={c}>{c}</th>)}</tr></thead>
                    <tbody>
                      {result.results.map((row, ri) => (
                        <tr key={ri}>{result.columns.map(c => (
                          <td key={c} style={{ fontFamily: 'var(--font-mono)' }}>
                            {row[c] !== null && row[c] !== undefined ? String(row[c]) : <span style={{ opacity: .4 }}>NULL</span>}
                          </td>
                        ))}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <Modal isOpen={modalOpen} title="AI SQL Explanation" onClose={() => setModalOpen(false)}>
        <div style={{ marginBottom: '1rem', fontWeight: 'bold', fontSize: '.9rem', color: 'var(--text-muted)' }}>Query:</div>
        <div style={{ background: 'var(--input-bg)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,.1)', fontFamily: 'var(--font-mono)', fontSize: '.85rem', marginBottom: '1.5rem', wordBreak: 'break-all' }}
          dangerouslySetInnerHTML={{ __html: highlightSql(sql) }} />
        <div style={{ fontWeight: 'bold', fontSize: '.9rem', color: 'var(--text-muted)', marginBottom: '.5rem' }}>Explanation:</div>
        <div style={{ fontSize: '1rem', lineHeight: 1.6, color: 'var(--text-main)' }}>{explanation}</div>
      </Modal>
    </div>
  );
}
