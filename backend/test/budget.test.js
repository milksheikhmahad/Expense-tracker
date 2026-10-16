const test = require('node:test');
const assert = require('node:assert');
const { crossedThresholds, monthKey } = require('../src/services/budget');

const T = [0.8, 1.0];

test('no threshold crossed below 80%', () => {
  assert.deepStrictEqual(crossedThresholds(1000, 7000, 10000, T), []);
});

test('crossing 80% fires warning only', () => {
  assert.deepStrictEqual(crossedThresholds(7000, 8500, 10000, T), [0.8]);
});

test('landing exactly on the budget fires 100%', () => {
  assert.deepStrictEqual(crossedThresholds(9000, 10000, 10000, T), [1.0]);
});

test('one big expense can cross both thresholds', () => {
  assert.deepStrictEqual(crossedThresholds(5000, 12000, 10000, T), [0.8, 1.0]);
});

test('already over budget does not re-fire', () => {
  assert.deepStrictEqual(crossedThresholds(11000, 12000, 10000, T), []);
});

test('zero budget never fires', () => {
  assert.deepStrictEqual(crossedThresholds(0, 500, 0, T), []);
});

test('monthKey handles ISO strings and dates', () => {
  assert.strictEqual(monthKey('2026-10-16'), '2026-10');
  assert.strictEqual(monthKey(new Date(Date.UTC(2026, 0, 31))), '2026-01');
});
