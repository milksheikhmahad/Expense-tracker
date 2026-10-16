// VITE_API_URL is baked in at build time (GitHub Actions sets it to the
// Container App URL). Locally it defaults to the docker-compose API.
const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8080').replace(/\/$/, '');

export function getToken() {
  return localStorage.getItem('token');
}

export function setSession(token, user) {
  if (token) localStorage.setItem('token', token);
  else localStorage.removeItem('token');
  if (user) localStorage.setItem('user', JSON.stringify(user));
  else localStorage.removeItem('user');
}

export function getStoredUser() {
  try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
}

async function request(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: form || (body ? JSON.stringify(body) : undefined),
  });
  if (res.status === 401 && token) {
    setSession(null, null);
    window.location.href = '/login';
    return null;
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  register: (b) => request('/api/auth/register', { method: 'POST', body: b }),
  login: (b) => request('/api/auth/login', { method: 'POST', body: b }),
  me: () => request('/api/me'),
  updateMe: (b) => request('/api/me', { method: 'PUT', body: b }),
  alerts: () => request('/api/me/alerts'),
  categories: () => request('/api/expenses/categories'),
  expenses: (q = {}) => request(`/api/expenses?${new URLSearchParams(q)}`),
  addExpense: (b) => request('/api/expenses', { method: 'POST', body: b }),
  updateExpense: (id, b) => request(`/api/expenses/${id}`, { method: 'PUT', body: b }),
  deleteExpense: (id) => request(`/api/expenses/${id}`, { method: 'DELETE' }),
  receiptUrl: (id) => request(`/api/expenses/${id}/receipt`),
  uploadReceipt: (file) => {
    const form = new FormData();
    form.append('receipt', file);
    return request('/api/expenses/receipt', { method: 'POST', form });
  },
  summary: (month) => request(`/api/analytics/summary${month ? `?month=${month}` : ''}`),
  trend: (months = 6) => request(`/api/analytics/trend?months=${months}`),
  insights: () => request('/api/analytics/insights'),
};

export const inr = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
