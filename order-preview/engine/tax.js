// Tax the way Clover does it (checked against 82 real HFGB orders, 62 of them mixed carts, all matched):
// each item carries its own tax rates (Clover "default" rates, or the item's own list, or none);
// for each tax rate, add up the prices of the lines it applies to, then round half up to the cent.
// Rates are Clover units: 750000 = 7.5%. Used by the Worker (the authority), the mock, and the order page.
export function itemTaxRates(item, defaults) {
  if (item.defaultTaxRates !== false) return defaults.map(t => ({ id: t.id, rate: t.rate }));
  return (item.taxRates?.elements || item.taxRates || []).filter(t => t && t.rate > 0).map(t => ({ id: t.id, rate: t.rate }));
}
// lines: [{ price (cents, each), qty, taxRates: [{ id, rate }] }]
export function cartTax(lines) {
  const byRate = {};
  for (const l of lines) for (const t of l.taxRates || []) {
    const b = byRate[t.id] || (byRate[t.id] = { rate: t.rate, amount: 0 }); b.amount += l.price * (l.qty || 1);
  }
  return Object.values(byRate).reduce((a, b) => a + Math.floor((b.amount * b.rate + 5000000) / 10000000), 0);
}
export const ratePct = rates => (rates || []).reduce((a, t) => a + t.rate, 0) / 1e5; // 7.5 for 7.5%
