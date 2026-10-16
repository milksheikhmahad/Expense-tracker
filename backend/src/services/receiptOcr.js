// Azure AI Document Intelligence – prebuilt receipt model (REST, no SDK).
// Optional: if not configured, the upload still works and the user fills
// amount/merchant manually.
const config = require('../config');

const API_VERSION = '2024-11-30';

function enabled() {
  return Boolean(config.docIntelEndpoint && config.docIntelKey);
}

async function analyzeReceipt(buffer) {
  if (!enabled()) return null;
  const url = `${config.docIntelEndpoint}/documentintelligence/documentModels/prebuilt-receipt:analyze?api-version=${API_VERSION}`;
  const start = await fetch(url, {
    method: 'POST',
    headers: { 'Ocp-Apim-Subscription-Key': config.docIntelKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Source: buffer.toString('base64') }),
  });
  if (start.status !== 202) {
    throw new Error(`Document Intelligence returned ${start.status}: ${await start.text()}`);
  }
  const opUrl = start.headers.get('operation-location');
  for (let i = 0; i < 30; i += 1) {
    await new Promise((r) => setTimeout(r, 1000));
    const res = await fetch(opUrl, { headers: { 'Ocp-Apim-Subscription-Key': config.docIntelKey } });
    const body = await res.json();
    if (body.status === 'succeeded') return parseReceipt(body.analyzeResult);
    if (body.status === 'failed') throw new Error(`Receipt analysis failed: ${JSON.stringify(body.error)}`);
  }
  throw new Error('Receipt analysis timed out');
}

function parseReceipt(result) {
  const doc = result?.documents?.[0];
  if (!doc) return null;
  const f = doc.fields || {};
  const total = f.Total?.valueCurrency?.amount ?? f.Total?.valueNumber ?? null;
  const items = (f.Items?.valueArray || [])
    .map((it) => it.valueObject?.Description?.valueString)
    .filter(Boolean);
  return {
    merchant: f.MerchantName?.valueString || f.MerchantName?.content || '',
    total: total != null ? Number(total) : null,
    date: f.TransactionDate?.valueDate || null,
    items,
  };
}

module.exports = { analyzeReceipt, parseReceipt, enabled };
