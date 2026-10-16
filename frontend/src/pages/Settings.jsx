import { useState } from 'react';
import { api, inr } from '../api';

export default function Settings({ user, onUserChange }) {
  const [name, setName] = useState(user.name);
  const [budget, setBudget] = useState(user.monthlyBudget);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  async function save(e) {
    e.preventDefault();
    setMsg('');
    setError('');
    try {
      const u = await api.updateMe({ name, monthlyBudget: Number(budget) });
      onUserChange(u);
      setMsg(`Saved. Your monthly budget is now ${inr(u.monthlyBudget)}.`);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="stack narrow">
      <h1>Budget & profile</h1>
      <form className="card stack" onSubmit={save}>
        <label>Name<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
        <label>Email (alerts go here)<input value={user.email} disabled /></label>
        <label>Monthly budget (₹)<input type="number" min="1" value={budget} onChange={(e) => setBudget(e.target.value)} required /></label>
        <p className="hint">You'll get an email at 80% and again at 100% of this amount, once per month each.</p>
        {msg && <div className="notice ok">{msg}</div>}
        {error && <div className="error">{error}</div>}
        <button className="primary">Save</button>
      </form>
    </div>
  );
}
