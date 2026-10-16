// Rule-based auto-categorization. Deterministic, explainable and free —
// good for a demo and easy to defend in a viva. Receipt OCR feeds merchant
// names and line items into the same function.

const CATEGORIES = ['Food', 'Groceries', 'Travel', 'Bills', 'Shopping', 'Health', 'Entertainment', 'Education', 'Other'];

const RULES = [
  ['Food', ['swiggy', 'zomato', 'restaurant', 'cafe', 'café', 'coffee', 'pizza', 'burger', 'biryani', 'dominos', 'kfc', 'mcdonald', 'starbucks', 'canteen', 'mess', 'dosa', 'lunch', 'dinner', 'breakfast', 'snack', 'tea', 'juice', 'bakery']],
  ['Groceries', ['grocery', 'groceries', 'bigbasket', 'blinkit', 'zepto', 'dmart', 'd-mart', 'supermarket', 'reliance fresh', 'more retail', 'vegetable', 'fruits', 'milk', 'instamart']],
  ['Travel', ['uber', 'ola', 'rapido', 'irctc', 'train', 'bus', 'flight', 'indigo', 'air india', 'redbus', 'metro', 'petrol', 'fuel', 'diesel', 'cab', 'taxi', 'auto', 'toll', 'parking', 'makemytrip', 'hotel']],
  ['Bills', ['electricity', 'water bill', 'rent', 'wifi', 'broadband', 'internet', 'recharge', 'jio', 'airtel', 'vi ', 'bsnl', 'gas', 'insurance', 'emi', 'subscription', 'postpaid', 'dth']],
  ['Shopping', ['amazon', 'flipkart', 'myntra', 'ajio', 'meesho', 'clothes', 'shoes', 'mall', 'electronics', 'nykaa', 'decathlon', 'croma']],
  ['Health', ['pharmacy', 'medical', 'medicine', 'hospital', 'clinic', 'doctor', 'apollo', '1mg', 'pharmeasy', 'gym', 'lab test']],
  ['Entertainment', ['netflix', 'spotify', 'prime video', 'hotstar', 'movie', 'pvr', 'inox', 'bookmyshow', 'concert', 'game', 'steam', 'youtube premium']],
  ['Education', ['book', 'course', 'udemy', 'coursera', 'tuition', 'stationery', 'exam fee', 'college fee', 'xerox', 'printout']],
];

// Generic words count half so a brand ("Netflix subscription") wins.
const WEAK = new Set(['subscription', 'recharge', 'book', 'game', 'auto', 'tea', 'gas']);

function categorize(...texts) {
  const haystack = ` ${texts.filter(Boolean).join(' ').toLowerCase()} `;
  if (!haystack.trim()) return 'Other';
  let best = 'Other';
  let bestScore = 0;
  for (const [category, keywords] of RULES) {
    const score = keywords.reduce((n, k) => (haystack.includes(k) ? n + (WEAK.has(k) ? 0.5 : 1) : n), 0);
    if (score > bestScore) {
      best = category;
      bestScore = score;
    }
  }
  return best;
}

module.exports = { categorize, CATEGORIES };
