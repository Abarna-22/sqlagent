import React, { useState, useRef, useEffect } from 'react';
import { postQuery, postExplain } from '../api';
import { highlightSql, escapeHtml, exportCsv, exportJson, SAMPLE_CHIPS } from '../utils';
import { showToast } from './Toast';
import Modal from './Modal';
import ResultChart from './ResultChart';

const PAGE_SIZE = 15;

const STEPS = [
  { key: 'schema', label: 'Retrieving relevant schema…' },
  { key: 'generate', label: 'Generating SQL query…' },
  { key: 'validate', label: 'Validating query (safety check)…' },
  { key: 'execute', label: 'Executing against database…' },
];

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

export default function ChatPanel({ onAddHistory, onSaveQuery, rerunQuestion, rerunId }) {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]); // array of response cards
  const [progress, setProgress] = useState(null); // { question, steps, timer, correctionMsg }
  const [modalOpen, setModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState({ title: '', body: '' });
  const inputRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (rerunQuestion && rerunId) {
      setQuestion(rerunQuestion);
      inputRef.current?.focus();
      setTimeout(() => {
        if (rerunQuestion) {
          handleSubmit();
        }
      }, 0);
    }
  }, [rerunQuestion, rerunId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); handleSubmit(); }
      if (e.ctrlKey && e.key === 'k') { e.preventDefault(); inputRef.current?.focus(); }
      if (e.key === 'Escape') setModalOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  });

  const handleSubmit = async () => {
    const q = question.trim();
    if (!q || loading) return;
    setLoading(true);

    const stepStates = {};
    STEPS.forEach(s => stepStates[s.key] = 'waiting');

    const startTime = Date.now();
    setProgress({ question: q, steps: { ...stepStates }, timer: '0.0s', correctionMsg: '' });

    timerRef.current = setInterval(() => {
      setProgress(prev => prev ? { ...prev, timer: ((Date.now() - startTime) / 1000).toFixed(1) + 's' } : prev);
    }, 100);

    const updateStep = (key, state) => {
      setProgress(prev => prev ? { ...prev, steps: { ...prev.steps, [key]: state } } : prev);
    };

    updateStep('schema', 'active');
    await delay(300);
    updateStep('schema', 'done');
    updateStep('generate', 'active');

    try {
      const fetchPromise = postQuery(q);
      await delay(480);
      updateStep('generate', 'done');
      updateStep('validate', 'active');
      await delay(380);
      updateStep('validate', 'done');
      updateStep('execute', 'active');

      const data = await fetchPromise;

      if (data.attempts && data.attempts.length > 1) {
        for (let i = 1; i < data.attempts.length; i++) {
          setProgress(prev => prev ? { ...prev, correctionMsg: `Attempt ${i} failed — self-correcting…` } : prev);
          await delay(280);
        }
      }

      updateStep('execute', 'done');
      clearInterval(timerRef.current);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      await delay(150);

      setProgress(null);
      setResults(prev => [{ ...data, elapsed, id: Date.now() }, ...prev]);
      onAddHistory(q);
      onSaveQuery(q);
      setQuestion('');
    } catch (err) {
      clearInterval(timerRef.current);
      updateStep('execute', 'failed');
      setProgress(prev => prev ? { ...prev, correctionMsg: err.message } : prev);
      showToast('Query failed: ' + err.message, 'error');
      setTimeout(() => setProgress(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { showToast('Voice input not supported in this browser.', 'warning'); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      setQuestion(event.results[0][0].transcript);
      inputRef.current?.focus();
    };
    recognition.onerror = (event) => showToast('Voice error: ' + event.error, 'warning');
    recognition.start();
  };

  const handleExplain = async (sql) => {
    try {
      const data = await postExplain(sql);
      setModalContent({ title: 'AI SQL Explanation', body: data.explanation });
      setModalOpen(true);
    } catch (e) {
      showToast('Error explaining SQL: ' + e.message, 'error');
    }
  };

  const handleCopy = (sql) => {
    navigator.clipboard.writeText(sql).then(() => showToast('SQL copied to clipboard'))
      .catch(() => showToast('Could not copy', 'error'));
  };

  const handleSaveCurrentQuery = () => {
    const q = question.trim();
    if (!q) {
      showToast('Type a question before saving.', 'warning');
      return;
    }
    onSaveQuery(q);
    showToast('Saved current query.');
  };

  return (
    <div className="chat-container">
      {/* Input Panel */}
      <div className="input-panel">
        <div className="textarea-wrapper" style={{ position: 'relative' }}>
          <textarea
            ref={inputRef}
            id="question-input"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question about employees, departments, products, or orders… (Ctrl+Enter to submit)"
            maxLength={500}
            disabled={loading}
          />
          <button className="mic-btn" onClick={handleVoiceInput} title="Speak your question">🎙️</button>
          <span className="char-counter" style={{ color: question.length > 450 ? 'var(--warning)' : 'var(--text-dark)' }}>
            {question.length}/500
          </span>
        </div>
        <div className="input-actions">
          <div className="chips-container">
            {SAMPLE_CHIPS.map((chip, i) => (
              <span key={i} className="chip" onClick={() => { setQuestion(chip); inputRef.current?.focus(); }}>{chip}</span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '.65rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="clear-sql-btn" onClick={handleSaveCurrentQuery} disabled={!question.trim() || loading}>Save Query</button>
            <button className="ask-btn" onClick={handleSubmit} disabled={loading}>
              <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M15.964.686a.5.5 0 0 0-.65-.65L.767 5.855H.766l-.452.18a.5.5 0 0 0-.082.887l.41.26.001.002 4.995 3.178 3.178 4.995.002.002.26.41a.5.5 0 0 0 .886-.083zm-1.833 1.89L6.637 10.07l-.215-.338L.767 6.5z" /></svg>
              <span>Ask Agent</span>
            </button>
          </div>
        </div>
      </div>

      {/* Progress Card */}
      {progress && (
        <div className="progress-card">
          <div className="progress-header">
            <div style={{ fontSize: '.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '.5rem' }}>
              <span style={{ color: 'var(--primary)' }}>Q:</span>
              <span>{progress.question.length > 80 ? progress.question.slice(0, 78) + '…' : progress.question}</span>
            </div>
            <div className="progress-timer">{progress.timer}</div>
          </div>
          <div className="progress-steps">
            {STEPS.map(s => {
              const state = progress.steps[s.key];
              const icon = state === 'active' ? '●' : state === 'done' ? '✓' : state === 'failed' ? '✕' : '○';
              return (
                <div key={s.key} className={`progress-step ${state}`}>
                  <div className="step-icon">{icon}</div>
                  <span className="step-label">{s.label}</span>
                  {state === 'active' && <div className="step-spinner"></div>}
                </div>
              );
            })}
          </div>
          {progress.correctionMsg && (
            <div style={{ marginTop: '.6rem', fontSize: '.82rem', color: 'var(--warning)', fontWeight: 600 }}>
              {progress.correctionMsg}
            </div>
          )}
        </div>
      )}

      {/* Results Feed */}
      <div className="results-feed">
        {results.length === 0 && !progress && (
          <div className="empty-state">
            <div className="empty-state-icon">🤖</div>
            <h3>Ask your first question</h3>
            <p>Type a question in plain English and the agent will<br />translate it to SQL, execute it, and show results.</p>
            <div className="kbd-row">Press <span className="kbd-hint">Ctrl+Enter</span> to submit</div>
          </div>
        )}

        {results.map((data) => (
          <ResponseCard key={data.id} data={data} onExplain={handleExplain} onCopy={handleCopy} />
        ))}
      </div>

      <Modal isOpen={modalOpen} title={modalContent.title} onClose={() => setModalOpen(false)}>
        <div style={{ fontSize: '1rem', lineHeight: 1.6, color: 'var(--text-main)' }}>
          {modalContent.body}
        </div>
      </Modal>
    </div>
  );
}

function ResponseCard({ data, onExplain, onCopy }) {
  const [page, setPage] = useState(1);

  let badgeClass = 'badge-success', statusText = data.status;
  if (data.status === 'blocked') { badgeClass = 'badge-danger'; statusText = 'Blocked'; }
  else if (data.status === 'refused') { badgeClass = 'badge-danger'; statusText = 'Refused'; }
  else if (data.status === 'failed') { badgeClass = 'badge-danger'; statusText = 'Failed'; }
  else if (data.attempts && data.attempts.length > 1 && data.status === 'success') {
    badgeClass = 'badge-warning'; statusText = 'Self-Corrected';
  }

  const attCount = data.attempts ? data.attempts.length : 0;
  const hasResults = data.status === 'success' && data.results && data.results.length > 0;
  const columns = data.columns || [];
  const rows = data.results || [];
  const totalPages = Math.ceil(rows.length / PAGE_SIZE);
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const numCols = columns.filter(c => rows.some(r => !isNaN(parseFloat(r[c])) && r[c] !== null));
  const hasChart = numCols.length > 0 && rows.length > 1;

  return (
    <div className="response-card">
      <div className="card-header">
        <div className="card-question">
          <span className="question-prefix">Q:</span>
          <span className="card-question-text">{data.question}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', flexShrink: 0 }}>
          {data.elapsed && <span className="card-meta">{data.elapsed}s · {attCount} attempt{attCount !== 1 ? 's' : ''}</span>}
          <span className={`badge ${badgeClass}`}>{statusText}</span>
        </div>
      </div>
      <div className="card-body">
        {/* Timeline */}
        <div>
          <div className="section-title">Execution Timeline</div>
          <div className="timeline">
            {(data.attempts || []).map((att, i) => {
              let attClass = att.error ? 'failed' : 'success';
              let attLabel = att.error ? 'FAILED' : 'SUCCESS';
              if (data.status === 'blocked' && !att.allowed) { attClass = 'blocked'; attLabel = 'BLOCKED (Safety Filter)'; }
              if (data.status === 'refused' && att.sql === 'CANNOT_ANSWER') { attClass = 'blocked'; attLabel = 'REFUSED'; }
              return (
                <div key={i} className={`timeline-item ${attClass}`}>
                  <div className="timeline-dot"></div>
                  <div className="timeline-header">
                    <span className="attempt-num">Attempt {att.attempt}</span>
                    <span className="attempt-status" style={{ color: att.error ? 'var(--danger)' : 'var(--success)' }}>{attLabel}</span>
                  </div>
                  <div className="timeline-sql" dangerouslySetInnerHTML={{ __html: highlightSql(att.sql) }} />
                  {att.error && <div className="timeline-error">{att.error}</div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Final SQL */}
        {data.final_sql && (
          <div className="final-query-section">
            <div className="section-title">Executed SQL</div>
            <div className="sql-box-wrapper">
              <div className="sql-box" dangerouslySetInnerHTML={{ __html: highlightSql(data.final_sql) }} />
              <button className="copy-sql-btn" style={{ right: '120px' }} onClick={() => onExplain(data.final_sql)}>💡 Explain</button>
              <button className="copy-sql-btn" onClick={() => onCopy(data.final_sql)}>📋 Copy</button>
            </div>
          </div>
        )}

        {/* Results Table */}
        {hasResults && (
          <div className="final-query-section">
            <div className="section-title">Query Results</div>

            {hasChart && <ResultChart columns={columns} results={rows} />}

            <div className="table-actions">
              <span className="table-row-info">{rows.length} row{rows.length !== 1 ? 's' : ''}</span>
              <div style={{ display: 'flex', gap: '.5rem' }}>
                <button className="export-csv-btn" onClick={() => exportJson(rows)}>⬇ JSON</button>
                <button className="export-csv-btn" onClick={() => exportCsv(columns, rows)}>⬇ CSV</button>
              </div>
            </div>
            <div className="table-wrapper">
              <table>
                <thead><tr>{columns.map(c => <th key={c}>{c}</th>)}</tr></thead>
                <tbody>
                  {pageRows.map((row, ri) => (
                    <tr key={ri}>{columns.map(c => <td key={c}>{row[c] !== null && row[c] !== undefined ? String(row[c]) : <span style={{ opacity: .4 }}>NULL</span>}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="pagination">
                <button className="pg-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
                {Array.from({ length: totalPages }, (_, i) => (
                  <button key={i} className={`pg-btn ${page === i + 1 ? 'active' : ''}`} onClick={() => setPage(i + 1)}>{i + 1}</button>
                ))}
                <button className="pg-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</button>
                <span className="pg-info">Page {page}/{totalPages}</span>
              </div>
            )}
          </div>
        )}
        {data.status === 'success' && (!data.results || data.results.length === 0) && (
          <div className="final-query-section">
            <div className="section-title">Query Results</div>
            <div className="table-wrapper"><div className="no-data-msg">Query completed but returned 0 rows.</div></div>
          </div>
        )}
      </div>
    </div>
  );
}
