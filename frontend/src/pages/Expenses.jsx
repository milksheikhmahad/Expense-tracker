import { useEffect, useRef, useState } from 'react';
import { api, inr } from '../api';
import { colorFor } from '../colors';

const today = () => new Date().toLocaleDateString('en-CA'); // local YYYY-MM-DD
const thisMonth = () => today().slice(0, 7);
const EMPTY = { amount: '', description: '', merchant: '', spentOn: today(), category: '', receiptBlob: null };

export default function Expenses() {
  const [categories, setCategories] = useState([]);
  const [month, setMonth] = useState(thisMonth());
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const fileRef = useRef();

  const load = () => api.expenses({ month }).then(setItems).catch((e) => setError(e.message));
  useEffect(() => { api.categories().then(setCategories); }, []);
  useEffect(() => { load(); }, [month]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function onReceipt(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    setError('');
    setNotice(null);
    try {
      const r = await api.uploadReceipt(file);
      setForm({
        ...form,
        amount: r.draft.amount ?? form.amount,
        merchant: r.draft.merchant || form.merchant,
        description: r.draft.description,
        spentOn: r.draft.spentOn || form.spentOn,
        category: r.draft.category,
        receiptBlob: r.receiptBlob,
      });
      const msg = r.ocr === 'ok'
        ? 'Receipt read by Azure AI Document Intelligence — check the fields and save.'
        : r.ocr === 'disabled'
          ? 'Receipt stored in Azure Blob Storage. OCR is not enabled, so please fill in the amount.'
          : `Receipt stored, but it couldn't be read automatically (${r.ocrError || 'unknown error'}). Fill the amount manually.`;
      setNotice({ type: r.ocr === 'ok' ? 'ok' : 'info', text: msg });
    } catch (err) {
      setError(err.message);
    } finally {
      setScanning(false);
      fileRef.current.value = '';
    }
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api.addExpense({ ...form, amount: Number(form.amount), category: form.category || undefined });
      const { budget } = res;
      const fired = budget.fired || [];
      if (fired.length) {
        const top = Math.max(...fired.map((f) => f.threshold));
        setNotice({
          type: top >= 1 ? 'over' : 'warn',
          text: top >= 1
            ? `Budget exceeded! ${inr(budget.spent)} of ${inr(budget.budget)} spent. An alert email is on its way.`
            : `You've crossed ${Math.round(top * 100)}% of your budget (${inr(budget.spent)} of ${inr(budget.budget)}). Warning email sent.`,
        });
      } else {
        setNotice({ type: 'ok', text: `Saved as ${res.expense.category}. ${inr(budget.spent)} of ${inr(budget.budget)} spent this month.` });
      }
      setForm({ ...EMPTY, spentOn: form.spentOn });
      if (res.expense.spentOn.slice(0, 7) === month) load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    if (!confirm('Delete this expense?')) return;
    await api.deleteExpense(id);
    load();
  }

  async function openReceipt(id) {
    const { url } = await api.receiptUrl(id);
    if (url) window.open(url, '_blank', 'noopener');
  }

  async function recategorize(item, category) {
    await api.updateExpense(item.id, { category });
    load();
  }

  const total = items.reduce((s, i) => s + i.amount, 0);

  return (
    <div className="stack">
      <h1>Expenses</h1>

      <form className="card" onSubmit={submit}>
        <div className="row-between">
          <b>Add an expense</b>
          <label className={`upload ${scanning ? 'busy' : ''}`}>
            {scanning ? 'Reading receipt…' : '📷 Scan a receipt'}
            <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={onReceipt} disabled={scanning} hidden />
          </label>
        </div>
        <div className="form-grid">
          <label>Amount (₹)<input type="number" step="0.01" min="0.01" value={form.amount} onChange={set('amount')} required /></label>
          <label>Description<input value={form.description} onChange={set('description')} placeholder="e.g. Swiggy dinner" /></label>
          <label>Merchant<input value={form.merchant} onChange={set('merchant')} placeholder="optional" /></label>
          <label>Date<input type="date" value={form.spentOn} onChange={set('spentOn')} max={today()} required /></label>
          <label>Category
            <select value={form.category} onChange={set('category')}>
              <option value="">Auto-detect</option>
              {categories.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <div className="form-actions"><button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Add expense'}</button></div>
        </div>
        {form.receiptBlob && <div className="small muted">📎 Receipt attached</div>}
      </form>

      {notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}
      {error && <div className="error">{error}</div>}

      <div className="card">
        <div className="row-between">
          <b>{items.length} expenses · {inr(total)}</b>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} max={thisMonth()} />
        </div>
        {items.length === 0 ? <p className="muted">Nothing logged for this month.</p> : (
          <table className="table">
            <thead><tr><th>Date</th><th>Description</th><th>Category</th><th className="num">Amount</th><th /></tr></thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td>{i.spentOn}</td>
                  <td>{i.description || i.merchant || '—'}{i.merchant && i.description && <span className="muted small"> · {i.merchant}</span>}</td>
                  <td>
                    <select className="chip" style={{ borderColor: colorFor(i.category), color: colorFor(i.category) }} value={i.category} onChange={(e) => recategorize(i, e.target.value)}>
                      {categories.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="num">{inr(i.amount)}</td>
                  <td className="actions">
                    {i.hasReceipt && <button className="ghost" type="button" onClick={() => openReceipt(i.id)}>Receipt</button>}
                    <button className="ghost danger" type="button" onClick={() => remove(i.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
