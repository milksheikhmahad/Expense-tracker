import { useState } from 'react';
import { Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { getStoredUser, getToken, setSession } from './api';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Expenses from './pages/Expenses.jsx';
import Insights from './pages/Insights.jsx';
import Settings from './pages/Settings.jsx';

function Shell({ user, onLogout, children }) {
  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand"><span className="logo">₹</span> Expense Tracker</div>
        <nav>
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/expenses">Expenses</NavLink>
          <NavLink to="/insights">Insights</NavLink>
          <NavLink to="/settings">Budget</NavLink>
        </nav>
        <div className="user">
          <span>{user?.name}</span>
          <button className="ghost" onClick={onLogout}>Log out</button>
        </div>
      </header>
      <main className="content">{children}</main>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(getToken() ? getStoredUser() : null);
  const navigate = useNavigate();

  const onAuth = (token, u) => { setSession(token, u); setUser(u); navigate('/'); };
  const onLogout = () => { setSession(null, null); setUser(null); navigate('/login'); };
  const onUserChange = (u) => { setSession(getToken(), u); setUser(u); };

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login onAuth={onAuth} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Shell user={user} onLogout={onLogout}>
      <Routes>
        <Route path="/" element={<Dashboard user={user} />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="/settings" element={<Settings user={user} onUserChange={onUserChange} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
