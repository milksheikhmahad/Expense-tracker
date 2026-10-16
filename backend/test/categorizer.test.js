const test = require('node:test');
const assert = require('node:assert');
const { categorize } = require('../src/services/categorizer');
const { ruleBasedInsights } = require('../src/services/insights');
const { buildAlertEmail } = require('../src/services/email');
const { parseReceipt } = require('../src/services/receiptOcr');

test('categorizes common Indian merchants', () => {
  assert.strictEqual(categorize('Swiggy order'), 'Food');
  assert.strictEqual(categorize('Uber to Manipal'), 'Travel');
  assert.strictEqual(categorize('', 'BigBasket'), 'Groceries');
  assert.strictEqual(categorize('Airtel postpaid recharge'), 'Bills');
  assert.strictEqual(categorize('Netflix subscription'), 'Entertainment');
  assert.strictEqual(categorize('Amazon'), 'Shopping');
});

test('unknown text falls back to Other', () => {
  assert.strictEqual(categorize('xyz'), 'Other');
  assert.strictEqual(categorize(), 'Other');
});

test('rule-based insights flag overspending pace', () => {
  const out = ruleBasedInsights({
    budget: 10000, daysInMonth: 30, dayOfMonth: 10,
    currentMonth: { total: 6000, count: 12 },
    byCategory: [{ category: 'Food', total: 4000 }, { category: 'Travel', total: 2000 }],
    previousMonth: { total: 8000, byCategory: { Food: 2000 } },
  });
  assert.ok(out.some((s) => s.includes('over budget')));
  assert.ok(out.some((s) => s.startsWith('Food is your biggest')));
  assert.ok(out.some((s) => s.includes('Food is up')));
});

test('alert email content', () => {
  const mail = buildAlertEmail({
    name: 'Mahad', month: '2026-10', threshold: 1, spent: 10500, budget: 10000, currency: 'INR',
    trigger: { amount: 1200, category: 'Food', description: 'Dinner <b>' },
  });
  assert.match(mail.subject, /Budget exceeded/);
  assert.ok(!mail.html.includes('<b>Dinner'));
  assert.ok(mail.html.includes('Dinner &lt;b&gt;'));
});

test('parses Document Intelligence receipt result', () => {
  const r = parseReceipt({ documents: [{ fields: {
    MerchantName: { valueString: 'Dominos' },
    Total: { valueCurrency: { amount: 459.5 } },
    TransactionDate: { valueDate: '2026-10-12' },
    Items: { valueArray: [{ valueObject: { Description: { valueString: 'Pizza' } } }] },
  } }] });
  assert.deepStrictEqual(r, { merchant: 'Dominos', total: 459.5, date: '2026-10-12', items: ['Pizza'] });
});
