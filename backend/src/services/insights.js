// AI Insights module. Uses Azure OpenAI when configured; otherwise produces
// rule-based insights so the page always works in a demo.
const config = require('../config');

function ruleBasedInsights(summary) {
  const out = [];
  const { currentMonth, previousMonth, budget, byCategory } = summary;
  const total = currentMonth.total;
  const pct = budget > 0 ? Math.round((total / budget) * 100) : 0;
  const daysInMonth = summary.daysInMonth;
  const dayOfMonth = summary.dayOfMonth;
  const projected = dayOfMonth > 0 ? (total / dayOfMonth) * daysInMonth : total;

  out.push(`You have used ${pct}% of your monthly budget with ${daysInMonth - dayOfMonth} day(s) left.`);
  if (budget > 0 && total >= budget) {
    out.push(`You're already ₹${Math.round(total - budget)} over budget. Pause non-essential spending until next month, or raise the budget if it was set too low.`);
  } else if (budget > 0 && projected > budget) {
    out.push(`At your current pace you'll spend about ₹${Math.round(projected)} this month, ₹${Math.round(projected - budget)} over budget. Try to keep daily spend under ₹${Math.max(0, Math.round((budget - total) / Math.max(1, daysInMonth - dayOfMonth)))}.`);
  }
  if (byCategory.length) {
    const top = byCategory[0];
    out.push(`${top.category} is your biggest category at ₹${Math.round(top.total)} (${Math.round((top.total / Math.max(total, 1)) * 100)}% of spending).`);
  }
  for (const c of byCategory) {
    const prev = previousMonth.byCategory[c.category] || 0;
    if (prev > 0 && c.total > prev * 1.3 && c.total - prev > 500) {
      out.push(`${c.category} is up ${Math.round(((c.total - prev) / prev) * 100)}% compared with last month — worth a look.`);
    }
  }
  if (previousMonth.total > 0) {
    const diff = total - previousMonth.total;
    out.push(diff > 0
      ? `So far you've spent ₹${Math.round(diff)} more than the whole of last month.`
      : `You're ₹${Math.round(-diff)} below last month's total so far — nice.`);
  }
  return out;
}

async function aiInsights(summary) {
  if (!(config.openaiEndpoint && config.openaiKey && config.openaiDeployment)) {
    return { source: 'rules', insights: ruleBasedInsights(summary) };
  }
  const url = `${config.openaiEndpoint}/openai/deployments/${config.openaiDeployment}/chat/completions?api-version=${config.openaiApiVersion}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'api-key': config.openaiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        temperature: 0.4,
        max_tokens: 400,
        messages: [
          { role: 'system', content: 'You are a concise personal-finance assistant for Indian students and young professionals. Given aggregated monthly spending data (no personal details), return 3-5 short, specific, actionable insights as a JSON array of strings. Amounts are in INR.' },
          { role: 'user', content: JSON.stringify(summary) },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Azure OpenAI ${res.status}`);
    const body = await res.json();
    const text = body.choices?.[0]?.message?.content || '[]';
    const match = text.match(/\[[\s\S]*\]/);
    const insights = JSON.parse(match ? match[0] : '[]');
    if (!Array.isArray(insights) || !insights.length) throw new Error('empty');
    return { source: 'azure-openai', insights };
  } catch (e) {
    console.warn('[insights] falling back to rules:', e.message);
    return { source: 'rules', insights: ruleBasedInsights(summary) };
  }
}

module.exports = { aiInsights, ruleBasedInsights };
