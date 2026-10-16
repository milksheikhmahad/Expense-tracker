import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { api, inr } from '../api';
import { colorFor } from '../colors';

function monthLabel(m) {
  const [y, mo] = m.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, 1)).toLocaleString('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' });
}

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.summary(), api.trend(6), api.alerts()])
      .then(([s, t, a]) => { setSummary(s); setTrend(t); setAlerts(a); })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="error">{error}</div>;
  if (!summary) return <div className="muted">Loading dashboard…</div>;

  const spent = summary.currentMonth.total;
  const budget = summary.budget;
  const pct = budget > 0 ? (spent / budget) * 100 : 0;
  const status = pct >= 100 ? 'over' : pct >= 80 ? 'warn' : 'ok';
  const daysLeft = summary.daysInMonth - summary.dayOfMonth;
  const remaining = Math.max(0, budget - spent);

  // cumulative spend vs. an even-pace budget line
  let running = 0;
  const byDay = Object.fromEntries(summary.daily.map((d) => [Number(d.day.slice(8)), d.total]));
  const cumulative = Array.from({ length: summary.daysInMonth }, (_, i) => {
    const day = i + 1;
    if (day <= summary.dayOfMonth) running += byDay[day] || 0;
    return {
      day,
      spent: day <= summary.dayOfMonth ? Math.round(running) : null,
      pace: Math.round((budget / summary.daysInMonth) * day),
    };
  });

  return (
    <div className="stack">
      <h1>{monthLabel(summary.month)} overview</h1>

      <div className="grid4">
        <div className="card stat"><div className="label">Spent this month</div><div className="value">{inr(spent)}</div><div className="muted">{summary.currentMonth.count} expenses</div></div>
        <div className="card stat"><div className="label">Monthly budget</div><div className="value">{inr(budget)}</div><Link to="/settings" className="muted">Change</Link></div>
        <div className="card stat"><div className="label">Remaining</div><div className={`value ${status}`}>{inr(remaining)}</div><div className="muted">{daysLeft} day(s) left</div></div>
        <div className="card stat"><div className="label">Last month</div><div className="value">{inr(summary.previousMonth.total)}</div><div className="muted">{monthLabel(summary.previousMonth.month)}</div></div>
      </div>

      <div className="card">
        <div className="row-between"><b>Budget used</b><span className={`pill ${status}`}>{Math.round(pct)}%</span></div>
        <div className="progress"><div className={`bar ${status}`} style={{ width: `${Math.min(pct, 100)}%` }} /></div>
        <div className="muted small">Email alerts fire at 80% and 100% of your budget.</div>
      </div>

      <div className="grid2">
        <div className="card">
          <b>Spending by category</b>
          {summary.byCategory.length === 0 ? (
            <p className="muted">No expenses yet this month. <Link to="/expenses">Add one</Link>.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={summary.byCategory} dataKey="total" nameKey="category" innerRadius={60} outerRadius={100} paddingAngle={2}>
                  {summary.byCategory.map((c) => <Cell key={c.category} fill={colorFor(c.category)} />)}
                </Pie>
                <Tooltip formatter={(v) => inr(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="card">
          <b>Cumulative spend vs. budget pace</b>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={cumulative} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₹${v / 1000}k`} />
              <Tooltip formatter={(v) => inr(v)} labelFormatter={(d) => `Day ${d}`} />
              <Legend />
              <Line type="monotone" dataKey="spent" name="Spent" stroke="#1c7ed6" strokeWidth={2} dot={false} connectNulls={false} />
              <Line type="monotone" dataKey="pace" name="Even pace" stroke="#adb5bd" strokeDasharray="5 5" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <b>Monthly trend (last 6 months)</b>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={trend.map((t) => ({ ...t, label: monthLabel(t.month) }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₹${v / 1000}k`} />
            <Tooltip formatter={(v) => inr(v)} />
            <Legend />
            <Bar dataKey="total" name="Spent" fill="#1c7ed6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="budget" name="Budget" fill="#dee2e6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <b>Recent budget alerts</b>
        {alerts.length === 0 ? <p className="muted">No alerts yet.</p> : (
          <table className="table">
            <thead><tr><th>Month</th><th>Threshold</th><th>Spent / Budget</th><th>Email</th><th>When</th></tr></thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={`${a.month}-${a.threshold}`}>
                  <td>{a.month}</td>
                  <td><span className={`pill ${a.threshold >= 1 ? 'over' : 'warn'}`}>{Math.round(a.threshold * 100)}%</span></td>
                  <td>{inr(a.spent)} / {inr(a.budget)}</td>
                  <td>{a.status}</td>
                  <td>{new Date(a.created_at).toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
