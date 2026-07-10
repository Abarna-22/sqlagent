import React, { useState, useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { fetchAuditLogs } from '../api';

Chart.register(...registerables);

export default function Dashboard() {
  const [stats, setStats] = useState({ total: 0, success: 0, blocked: 0, corrected: 0, avg: '0' });
  const [loading, setLoading] = useState(true);
  const donutRef = useRef(null);
  const lineRef = useRef(null);
  const donutChartRef = useRef(null);
  const lineChartRef = useRef(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const logs = await fetchAuditLogs();
      const total = logs.length;
      const success = logs.filter(l => l.status === 'success').length;
      const blocked = logs.filter(l => l.status === 'blocked').length;
      const corrected = logs.filter(l => (l.num_attempts || 1) > 1 && l.status === 'success').length;
      const avg = total ? (logs.reduce((s, l) => s + (l.num_attempts || 1), 0) / total).toFixed(1) : '0';

      setStats({
        total,
        success: total ? Math.round(success / total * 100) + '%' : '0%',
        blocked,
        corrected,
        avg,
      });

      buildCharts(logs, total, success, blocked);
    } catch (e) {
      console.warn('Dashboard load error', e);
    } finally {
      setLoading(false);
    }
  };

  const buildCharts = (logs, total, success, blocked) => {
    const failed = total - success - blocked;
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.07)';

    // Donut
    if (donutRef.current) {
      if (donutChartRef.current) donutChartRef.current.destroy();
      donutChartRef.current = new Chart(donutRef.current, {
        type: 'doughnut',
        data: {
          labels: ['Success', 'Blocked', 'Failed'],
          datasets: [{
            data: [success, blocked, failed],
            backgroundColor: ['rgba(16,185,129,.8)', 'rgba(239,68,68,.8)', 'rgba(245,158,11,.8)'],
            borderWidth: 0, hoverOffset: 4
          }]
        },
        options: {
          cutout: '70%',
          plugins: { legend: { position: 'bottom', labels: { color: textColor, font: { size: 12 }, padding: 14 } } },
          animation: { animateRotate: true }
        }
      });
    }

    // Line chart — group by date
    const byDate = {};
    logs.forEach(l => { const d = (l.timestamp || '').slice(0, 10); if (d) byDate[d] = (byDate[d] || 0) + 1; });
    const labels = Object.keys(byDate).sort().slice(-14);
    const values = labels.map(d => byDate[d]);

    if (lineRef.current) {
      if (lineChartRef.current) lineChartRef.current.destroy();
      lineChartRef.current = new Chart(lineRef.current, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Queries', data: values,
            borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,.1)',
            tension: .4, fill: true, pointBackgroundColor: '#6366f1', pointRadius: 4
          }]
        },
        options: {
          scales: {
            x: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 11 } } },
            y: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 11 }, stepSize: 1 } }
          },
          plugins: { legend: { display: false } },
          animation: { duration: 600 }
        }
      });
    }
  };

  return (
    <div className="dashboard-grid">
      <div className="dash-card">
        <div className="dash-card-title">📊 Query Statistics</div>
        <div className="dash-stat-row"><span className="dash-stat-label">Total Queries</span><span className="dash-stat-value">{loading ? '—' : stats.total}</span></div>
        <div className="dash-stat-row"><span className="dash-stat-label">Success Rate</span><span className="dash-stat-value">{loading ? '—' : stats.success}</span></div>
        <div className="dash-stat-row"><span className="dash-stat-label">Blocked Queries</span><span className="dash-stat-value">{loading ? '—' : stats.blocked}</span></div>
        <div className="dash-stat-row"><span className="dash-stat-label">Self-Corrected</span><span className="dash-stat-value">{loading ? '—' : stats.corrected}</span></div>
        <div className="dash-stat-row"><span className="dash-stat-label">Avg Attempts</span><span className="dash-stat-value">{loading ? '—' : stats.avg}</span></div>
      </div>
      <div className="dash-card">
        <div className="dash-card-title">🍩 Status Breakdown</div>
        <div className="dash-chart-container"><canvas ref={donutRef}></canvas></div>
      </div>
      <div className="dash-card" style={{ gridColumn: '1 / -1' }}>
        <div className="dash-card-title">📈 Query Volume Over Time</div>
        <div className="dash-chart-container" style={{ height: '220px' }}><canvas ref={lineRef}></canvas></div>
      </div>
    </div>
  );
}
