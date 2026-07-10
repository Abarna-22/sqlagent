import React, { useState, useEffect } from 'react';

export default function Header({ theme, toggleTheme }) {
  const [time, setTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }));
    };
    
    updateTime();
    const timerId = setInterval(updateTime, 1000);
    return () => clearInterval(timerId);
  }, []);

  return (
    <header>
      <div className="logo-container">
        <div className="logo-icon">SQL</div>
        <div className="logo-text">
          <h1>SQL Query Agent</h1>
          <p>AI Governance &amp; Co-pilot</p>
        </div>
      </div>
      <div className="header-right">
        <div className="header-clock">{time}</div>
        <div className="kbd-hint">Alt + /</div>
        <div className="theme-toggle" onClick={toggleTheme}>
          {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
        </div>
      </div>
    </header>
  );
}
