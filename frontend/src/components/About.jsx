import React from 'react';

export default function About() {
  return (
    <div className="page-card about-page">
      <div className="page-hero">
        <div>
          <h2>About SQL Query Agent</h2>
          <p>SQL Query Agent is a lightweight AI co-pilot for safe, read-only data exploration. Ask questions in plain English and get instant MySQL results without writing SQL manually.</p>
        </div>
      </div>

      <div className="page-content">
        <section>
          <h3>Project summary</h3>
          <p>This project combines FastAPI, a Groq-powered query agent, and a React dashboard to provide an intelligent SQL interface. It is designed for analytics workflows, auditability, and safe database access through natural language.</p>
        </section>

        <section>
          <h3>Key features</h3>
          <ul>
            <li>Dashboard-first interface for query metrics and audit history</li>
            <li>Natural language-to-SQL conversion with safety validation</li>
            <li>Built-in SQL sandbox for manual query testing</li>
            <li>Login/signup page to support auth flows in the UI</li>
            <li>Schema reference and query history for faster results</li>
          </ul>
        </section>

        <section>
          <h3>How to use</h3>
          <ol>
            <li>Open the dashboard to review analytics and recent queries.</li>
            <li>Use the Query Co-pilot tab to ask questions in plain English.</li>
            <li>Run SQL directly in the sandbox for custom data exploration.</li>
            <li>Switch to Login / Sign Up to simulate account access for future auth support.</li>
          </ol>
        </section>
      </div>
    </div>
  );
}
