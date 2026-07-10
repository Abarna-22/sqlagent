import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { showToast } from './Toast';
import { postSignup, postLogin } from '../api';

export default function Auth({ onAuthSuccess }) {
  const [mode, setMode] = useState('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (mode === 'signup' && (!name.trim() || !email.trim() || !password.trim())) {
      showToast('Please complete all signup fields.', 'error');
      return;
    }

    if (mode === 'login' && (!email.trim() || !password.trim())) {
      showToast('Please enter email and password.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'signup') {
        const response = await postSignup({ name: name.trim(), email: email.trim(), password });
        showToast(response.message || 'Signup successful.', 'success');
      } else {
        const response = await postLogin({ email: email.trim(), password });
        showToast(response.message || 'Login successful.', 'success');
      }
      setName('');
      setEmail('');
      setPassword('');
      onAuthSuccess?.();
      navigate('/dashboard');
    } catch (err) {
      showToast(err.message || 'Failed to complete auth request.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-card auth-page">
      <div className="auth-layout">
        <div className="auth-panel">
          <div className="auth-intro">
            <h2>{mode === 'login' ? 'Welcome back' : 'Create an account'}</h2>
            <p>
              {mode === 'login'
                ? 'Sign in to continue and access your SQL query dashboard.'
                : 'Create your account to save queries, review history, and explore AI-assisted SQL insights.'}
            </p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <label>
                Full name
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Doe"
                  disabled={isSubmitting}
                />
              </label>
            )}

            <label>
              Email address
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={isSubmitting}
              />
            </label>

            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isSubmitting}
              />
            </label>

            <button type="submit" className="auth-submit-btn" disabled={isSubmitting}>
              {isSubmitting ? 'Processing...' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>

            <div className="auth-switch">
              {mode === 'login' ? (
                <span>New here? <button type="button" onClick={() => setMode('signup')} disabled={isSubmitting}>Create an account</button></span>
              ) : (
                <span>Already have an account? <button type="button" onClick={() => setMode('login')} disabled={isSubmitting}>Sign in</button></span>
              )}
            </div>
          </form>
        </div>

        <aside className="auth-info">
          <h3>Project overview</h3>
          <p>SQL Query Agent is an AI-powered dashboard that converts plain English questions into safe, read-only SQL queries against a live MySQL dataset.</p>
          <ul>
            <li>Natural language query assistant for business data</li>
            <li>Safe SELECT-only execution with audit logging</li>
            <li>Built-in query history, schema reference, and sandbox tools</li>
            <li>Login/signup experience for future authentication support</li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
