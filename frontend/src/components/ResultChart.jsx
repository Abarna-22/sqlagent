import React, { useState, useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

const COLORS = ['#6366f1', '#a855f7', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#f97316', '#8b5cf6'];

export default function ResultChart({ columns, results }) {
  const [chartType, setChartType] = useState('bar');
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  const numCols = columns.filter(c => results.some(r => !isNaN(parseFloat(r[c])) && r[c] !== null));
  const labelCol = columns.find(c => !numCols.includes(c)) || columns[0];
  const valCol = numCols[0];

  useEffect(() => {
    if (!canvasRef.current || !valCol) return;

    if (chartRef.current) chartRef.current.destroy();

    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const textColor = isDark ? '#94a3b8' : '#475569';
    const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
    const isPie = chartType === 'pie';

    const labels = results.map(r => String(r[labelCol] !== null ? r[labelCol] : ''));
    const values = results.map(r => parseFloat(r[valCol]) || 0);

    chartRef.current = new Chart(canvasRef.current, {
      type: chartType,
      data: {
        labels,
        datasets: [{
          label: valCol,
          data: values,
          backgroundColor: isPie ? COLORS.slice(0, values.length) : 'rgba(99,102,241,0.55)',
          borderColor: isPie ? COLORS.slice(0, values.length) : '#6366f1',
          borderWidth: 2,
          borderRadius: chartType === 'bar' ? 4 : 0,
          fill: chartType === 'line',
          tension: 0.38,
          pointBackgroundColor: '#a855f7',
          pointRadius: chartType === 'line' ? 4 : 0,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: isPie, labels: { color: textColor, font: { family: "'Plus Jakarta Sans',sans-serif", size: 11 } } },
          tooltip: { mode: isPie ? 'point' : 'index', intersect: false }
        },
        scales: isPie ? {} : {
          x: { ticks: { color: textColor, maxRotation: 40 }, grid: { color: gridColor } },
          y: { ticks: { color: textColor }, grid: { color: gridColor } }
        }
      }
    });

    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [chartType, columns, results]);

  return (
    <div className="chart-section">
      <div className="chart-controls">
        <span style={{ fontSize: '.72rem', color: 'var(--text-dark)', fontWeight: 600, alignSelf: 'center' }}>Chart:</span>
        {['bar', 'line', 'pie'].map(type => (
          <button
            key={type}
            className={`chart-type-btn ${chartType === type ? 'active' : ''}`}
            onClick={() => setChartType(type)}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>
      <div className="chart-container">
        <canvas ref={canvasRef}></canvas>
      </div>
    </div>
  );
}
