const API_BASE = '';

async function parseJsonResponse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || data.message || `Server returned HTTP ${res.status}`);
  }
  return data;
}

export async function postQuery(question) {
  const res = await fetch(`${API_BASE}/api/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
  return parseJsonResponse(res);
}

export async function postSignup(payload) {
  const res = await fetch(`${API_BASE}/api/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonResponse(res);
}

export async function postLogin(payload) {
  const res = await fetch(`${API_BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonResponse(res);
}

export async function postSandbox(sql) {
  const res = await fetch(`${API_BASE}/api/sandbox`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql }),
  });
  return parseJsonResponse(res);
}

export async function fetchAuditLogs() {
  const res = await fetch(`${API_BASE}/api/audit-log`);
  return parseJsonResponse(res);
}

export async function fetchSchemaMetadata() {
  const res = await fetch(`${API_BASE}/api/schema`);
  return parseJsonResponse(res);
}

export async function postExplain(sql) {
  const res = await fetch(`${API_BASE}/api/explain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql }),
  });
  return parseJsonResponse(res);
}
