// Pure function: which thresholds did this transaction cross?
// Kept free of I/O so it can be unit tested exhaustively.

function crossedThresholds(previousTotal, newTotal, budget, thresholds) {
  if (!(budget > 0)) return [];
  return thresholds.filter((t) => previousTotal < budget * t && newTotal >= budget * t);
}

function monthKey(date) {
  const d = typeof date === 'string' ? new Date(`${date.slice(0, 10)}T00:00:00Z`) : date;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

module.exports = { crossedThresholds, monthKey };
