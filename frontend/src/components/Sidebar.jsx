import React, { useState } from 'react';
import { SCHEMA_REF } from '../utils';

export default function Sidebar({ history, savedQueries = [], schema = SCHEMA_REF, onRerun, onClearHistory, onDeleteSavedQuery }) {
  const [sections, setSections] = useState({ history: true, saved: false, schema: false, shortcuts: false });

  const toggleSection = (key) => {
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <aside className="history-sidebar" id="history-sidebar">
      {/* History Section */}
      <div className={`sidebar-section ${sections.history ? 'open' : ''}`}>
        <div className="sidebar-section-header" onClick={() => toggleSection('history')}>
          <span className="sidebar-section-title">⏱ Session History</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
            <button className="sidebar-clear" onClick={(e) => { e.stopPropagation(); onClearHistory(); }}>Clear</button>
            <span className="sidebar-chevron">▶</span>
          </span>
        </div>
        <div className="sidebar-section-body">
          <div className="history-list">
            {history.length === 0 ? (
              <div className="history-empty">No queries yet.<br />Ask something below!</div>
            ) : (
              history.map((q, i) => (
                <div key={i} className="history-item" onClick={() => onRerun(q)} title={q}>
                  {q.length > 70 ? q.slice(0, 68) + '…' : q}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Saved Queries */}
      <div className={`sidebar-section ${sections.saved ? 'open' : ''}`}>
        <div className="sidebar-section-header" onClick={() => toggleSection('saved')}>
          <span className="sidebar-section-title">💾 Saved Queries</span>
          <span className="sidebar-chevron">▶</span>
        </div>
        <div className="sidebar-section-body">
          <div className="history-list">
            {savedQueries.length === 0 ? (
              <div className="history-empty">No saved queries yet.<br />Save one from the query panel.</div>
            ) : (
              savedQueries.map((q, i) => (
                <div key={i} className="history-item saved-query-item">
                  <span className="saved-query-text" onClick={() => onRerun(q)}>{q.length > 70 ? q.slice(0, 68) + '…' : q}</span>
                  <button className="saved-delete-btn" onClick={(e) => { e.stopPropagation(); onDeleteSavedQuery(q); }}>✕</button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Schema Reference */}
      <div className={`sidebar-section ${sections.schema ? 'open' : ''}`}>
        <div className="sidebar-section-header" onClick={() => toggleSection('schema')}>
          <span className="sidebar-section-title">🗄 Schema Reference</span>
          <span className="sidebar-chevron">▶</span>
        </div>
        <div className="sidebar-section-body">
          <div style={{ padding: '.5rem' }}>
            {(Array.isArray(schema) ? schema : []).map((t, index) => {
              const tableName = t.table_name || t.name || `table-${index}`;
              const columns = Array.isArray(t.columns) ? t.columns : t.cols || [];
              return (
                <div key={tableName} className="schema-table-item">
                  <div className="schema-table-name">{tableName}</div>
                  {columns.map((col, colIndex) => {
                    const columnName = col.column_name || col[0] || `col-${colIndex}`;
                    const columnType = col.type || col[1] || 'unknown';
                    return (
                      <div key={`${tableName}-${columnName}`} className="schema-col">
                        {columnName}<span className="col-type">{columnType}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts */}
      <div className={`sidebar-section ${sections.shortcuts ? 'open' : ''}`}>
        <div className="sidebar-section-header" onClick={() => toggleSection('shortcuts')}>
          <span className="sidebar-section-title">⌨ Shortcuts</span>
          <span className="sidebar-chevron">▶</span>
        </div>
        <div className="sidebar-section-body">
          <div style={{ padding: '.6rem .8rem', display: 'flex', flexDirection: 'column', gap: '.4rem', fontSize: '.74rem', color: 'var(--text-muted)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Submit query</span><span className="kbd-hint">Ctrl+↵</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Toggle theme</span><span className="kbd-hint">T</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Close modal</span><span className="kbd-hint">Esc</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Focus input</span><span className="kbd-hint">Ctrl+K</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Toggle sidebar</span><span className="kbd-hint">Ctrl+B</span></div>
          </div>
        </div>
      </div>
    </aside>
  );
}
