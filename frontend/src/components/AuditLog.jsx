import React, { useState, useEffect } from 'react';
import { fetchAuditLogs } from '../api';
import { highlightSql, escapeHtml, formatDate } from '../utils';
import { showToast } from './Toast';

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [stats, setStats] = useState({ total: 0, successRate: '0%', blockedPct: '0%', correctionPct: '0%', avgAttempts: '0' });

  useEffect(() => { loadLogs(); }, []);

  useEffect(() => {
    applyFilters();
  }, [logs, search, filter]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await fetchAuditLogs();
      setLogs(data);
      updateStats(data);
    } catch (e) {
      showToast('Failed to load audit logs', 'error');
    } finally {
      setLoading(false);
    }
  };

  const updateStats = (data) => {
    const total = data.length;
    const success = data.filter(l => l.status === 'success').length;
    const blocked = data.filter(l => l.status === 'blocked' || l.status === 'refused').length;
    const corrections = data.filter(l => l.status === 'success' && l.num_attempts > 1).length;
    const avg = total > 0 ? (data.reduce((s, l) => s + (l.num_attempts || 1), 0) / total).toFixed(1) : '0';
    setStats({
      total,
      successRate: total > 0 ? Math.round(success / total * 100) + '%' : '0%',
      blockedPct: total > 0 ? Math.round(blocked / total * 100) + '%' : '0%',
      correctionPct: total > 0 ? Math.round(corrections / total * 100) + '%' : '0%',
      avgAttempts: avg,
    });
  };

  const applyFilters = () => {
    const q = search.toLowerCase();
    const result = logs.filter(log => {
      const matchText = !q || (log.question && log.question.toLowerCase().includes(q)) || (log.final_sql && log.final_sql.toLowerCase().includes(q));
      const matchFilter = filter === 'all' ||
        (filter === 'success' && log.status === 'success') ||
        (filter === 'blocked' && (log.status === 'blocked' || log.status === 'refused')) ||
        (filter === 'failed' && log.status === 'failed');
      return matchText && matchFilter;
    });
    setFiltered(result);
  };

  const toggleExpand = (id) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div>
      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-num">{stats.total}</div><div className="stat-label">Total Queries</div></div>
        <div className="stat-card"><div className="stat-num">{stats.blockedPct}</div><div className="stat-label">% Blocked</div></div>
        <div className="stat-card"><div className="stat-num">{stats.correctionPct}</div><div className="stat-label">% Self-Corrected</div></div>
        <div className="stat-card"><div className="stat-num">{stats.avgAttempts}</div><div className="stat-label">Avg Attempts</div></div>
        <div className="stat-card"><div className="stat-num">{stats.successRate}</div><div className="stat-label">Success Rate</div></div>
      </div>

      {/* Controls */}
      <div className="audit-header-actions">
        <div className="audit-controls">
          <input type="text" className="search-bar" placeholder="Search logs…" value={search} onChange={e => setSearch(e.target.value)} />
          <select className="filter-select" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="success">Success</option>
            <option value="blocked">Blocked</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        <button className="refresh-btn" onClick={loadLogs}>↻ Refresh</button>
      </div>

      {/* Table */}
      <div className="audit-table-wrapper">
        <table>
          <thead><tr><th></th><th>Time</th><th>Question</th><th>Final SQL</th><th>Attempts</th><th>Status</th></tr></thead>
          <tbody>
            {loading && (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Loading…</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No matching logs.</td></tr>
            )}
            {!loading && filtered.map(log => {
              let dotClass = 'failed', statusText = log.status;
              if (log.status === 'success') { dotClass = log.num_attempts > 1 ? 'corrected' : 'success'; statusText = log.num_attempts > 1 ? 'Self-Corrected' : 'Success'; }
              else if (log.status === 'blocked') { dotClass = 'blocked'; statusText = 'Blocked'; }
              else if (log.status === 'refused') { dotClass = 'refused'; statusText = 'Refused'; }
              const displaySql = log.final_sql || (log.status === 'refused' ? 'CANNOT_ANSWER' : 'N/A');
              const isExpanded = expandedIds.has(log.id);

              return (
                <React.Fragment key={log.id}>
                  <tr className={`audit-row ${isExpanded ? 'expanded' : ''}`} onClick={() => toggleExpand(log.id)}>
                    <td><span className="expand-chevron">▶</span></td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '.78rem' }}>{formatDate(log.timestamp)}</td>
                    <td><strong style={{ fontSize: '.83rem' }}>{log.question}</strong></td>
                    <td>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.7rem', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={displaySql}>
                        {displaySql}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{log.num_attempts}</td>
                    <td><div className="status-cell"><span className={`status-dot ${dotClass}`}></span><span style={{ fontSize: '.8rem' }}>{statusText}</span></div></td>
                  </tr>
                  {isExpanded && (
                    <tr className="audit-expand-row open">
                      <td className="audit-expand-cell" colSpan="6">
                        <div className="expand-inner">
                          <div className="section-title" style={{ marginBottom: '.6rem' }}>Attempt History</div>
                          <div className="timeline" style={{ paddingLeft: '1.25rem' }}>
                            {(log.attempts || []).map((att, i) => {
                              let ac = att.error ? 'failed' : 'success';
                              let al = att.error ? 'FAILED' : 'SUCCESS';
                              if (log.status === 'blocked' && !att.allowed) { ac = 'blocked'; al = 'BLOCKED'; }
                              return (
                                <div key={i} className={`timeline-item ${ac}`} style={{ marginBottom: '.5rem' }}>
                                  <div className="timeline-dot"></div>
                                  <div className="timeline-header">
                                    <span className="attempt-num">Attempt {att.attempt}</span>
                                    <span className="attempt-status" style={{ color: att.error ? 'var(--danger)' : 'var(--success)' }}>{al}</span>
                                  </div>
                                  <div className="timeline-sql" style={{ fontSize: '.73rem' }} dangerouslySetInnerHTML={{ __html: highlightSql(att.sql || '') }} />
                                  {att.error && <div className="timeline-error" style={{ fontSize: '.73rem' }}>{att.error}</div>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
