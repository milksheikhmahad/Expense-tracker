// Fixed colour per category so charts stay consistent across pages.
export const CATEGORY_COLORS = {
  Food: '#e8590c',
  Groceries: '#2f9e44',
  Travel: '#1c7ed6',
  Bills: '#7048e8',
  Shopping: '#d6336c',
  Health: '#0c8599',
  Entertainment: '#f59f00',
  Education: '#5c7cfa',
  Other: '#868e96',
};

export const colorFor = (c) => CATEGORY_COLORS[c] || '#868e96';
