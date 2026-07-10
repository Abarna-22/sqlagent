import React, { useState, useEffect } from 'react';
import { NavLink, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import Header from './components/Header';
import ChatPanel from './components/ChatPanel';
import Dashboard from './components/Dashboard';
import Sandbox from './components/Sandbox';
import Sidebar from './components/Sidebar';
import About from './components/About';
import Auth from './components/Auth';
import { ToastContainer } from './components/Toast';
import { fetchSchemaMetadata } from './api';
import { SCHEMA_REF } from './utils';
import './index.css';

export default function App() {
  const [theme, setTheme] = useState('light');
  const [history, setHistory] = useState([]);
  const [savedQueries, setSavedQueries] = useState([]);
  const [schema, setSchema] = useState(SCHEMA_REF);
  const [rerunQuestion, setRerunQuestion] = useState('');
  const [rerunId, setRerunId] = useState(0);

  const navigate = useNavigate();
  const location = useLocation();
  const hideSidebar = location.pathname === '/about' || location.pathname === '/signup';

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const storedHistory = window.localStorage.getItem('sqlagent_history');
    const storedSaved = window.localStorage.getItem('sqlagent_saved_queries');
    if (storedHistory) {
      try { setHistory(JSON.parse(storedHistory)); } catch (e) {}
    }
    if (storedSaved) {
      try { setSavedQueries(JSON.parse(storedSaved)); } catch (e) {}
    }

    const loadSchema = async () => {
      try {
        const data = await fetchSchemaMetadata();
        if (Array.isArray(data) && data.length > 0) setSchema(data);
      } catch (e) {
        console.warn('Schema fetch failed, using default schema reference.', e);
      }
    };
    loadSchema();
  }, []);

  useEffect(() => {
    window.localStorage.setItem('sqlagent_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    window.localStorage.setItem('sqlagent_saved_queries', JSON.stringify(savedQueries));
  }, [savedQueries]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleAddHistory = (question) => {
    setHistory(prev => {
      const next = [question, ...prev.filter(item => item !== question)];
      return next.slice(0, 20);
    });
  };

  const handleClearHistory = () => {
    setHistory([]);
  };

  const handleSaveQuery = (question) => {
    const next = [question, ...savedQueries.filter(item => item !== question)];
    setSavedQueries(next.slice(0, 20));
  };

  const handleDeleteSavedQuery = (question) => {
    setSavedQueries(prev => prev.filter(item => item !== question));
  };

  const handleRerun = (question) => {
    setRerunQuestion(question);
    setRerunId((prev) => prev + 1);
    navigate('/query-copilot');
  };

  const handleAuthSuccess = () => {
    navigate('/dashboard');
  };

  return (
    <>
      <Header theme={theme} toggleTheme={toggleTheme} />

      <div className="main-nav">
        <NavLink to="/about" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <div className="nav-icon">ℹ️</div>
          About
        </NavLink>

        <NavLink to="/signup" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <div className="nav-icon">🔐</div>
          Sign Up
        </NavLink>

        <NavLink to="/dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <div className="nav-icon">📊</div>
          Dashboard
        </NavLink>

        <NavLink to="/query-copilot" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <div className="nav-icon">💬</div>
          Query Co-pilot
        </NavLink>

        <NavLink to="/sql-sandbox" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <div className="nav-icon">⚡</div>
          SQL Sandbox
        </NavLink>
      </div>

      <div className="app-body">
        {!hideSidebar && (
          <Sidebar
            history={history}
            savedQueries={savedQueries}
            schema={schema}
            onRerun={handleRerun}
            onClearHistory={handleClearHistory}
            onDeleteSavedQuery={handleDeleteSavedQuery}
          />
        )}

        <main className={hideSidebar ? 'full-width' : ''}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<section className="tab-content active"><Dashboard /></section>} />
            <Route path="/query-copilot" element={<section className="tab-content active"><ChatPanel onAddHistory={handleAddHistory} onSaveQuery={handleSaveQuery} rerunQuestion={rerunQuestion} rerunId={rerunId} /></section>} />
            <Route path="/sql-sandbox" element={<section className="tab-content active"><Sandbox /></section>} />
            <Route path="/about" element={<section className="tab-content active"><About /></section>} />
            <Route path="/signup" element={<section className="tab-content active"><Auth onAuthSuccess={handleAuthSuccess} /></section>} />
            <Route path="/chat" element={<Navigate to="/query-copilot" replace />} />
            <Route path="/sandbox" element={<Navigate to="/sql-sandbox" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>

      <ToastContainer />
    </>
  );
}
