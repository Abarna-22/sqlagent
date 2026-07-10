import React, { useState } from 'react';

export default function Toast() {
  return null; // Toast is managed imperatively below
}

// Imperative toast system
let toastListeners = [];

export function showToast(msg, type = 'success') {
  toastListeners.forEach(fn => fn(msg, type));
}

export function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  React.useEffect(() => {
    const handler = (msg, type) => {
      const id = Date.now() + Math.random();
      setToasts(prev => [...prev, { id, msg, type }]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 2800);
    };
    toastListeners.push(handler);
    return () => { toastListeners = toastListeners.filter(fn => fn !== handler); };
  }, []);

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`} style={{ position: 'relative' }}>
          <span className="toast-icon"></span>
          <span>{t.msg}</span>
          <div className="toast-bar"></div>
        </div>
      ))}
    </div>
  );
}
