// Dashboard numbers from stored orders. Paid orders only (cancelled ones are listed separately).
import { parts } from './time.js';
export function computeStats(orders, tz, range) {
  const paid = orders.filter(o => !['cancelled', 'failed'].includes(o.status));
  const sales = paid.reduce((a, o) => a + o.total, 0), sub = paid.reduce((a, o) => a + o.subtotal, 0);
  const items = {};
  for (const o of paid) for (const l of o.items) { const k = l.id; items[k] = items[k] || { id: k, name: l.name + (l.note ? ` (${l.note})` : ''), qty: 0, revenue: 0 }; items[k].qty += l.qty; items[k].revenue += l.qty * l.price; }
  const byHour = {}, byDay = [0, 0, 0, 0, 0, 0, 0], byDate = {};
  for (const o of paid) { const p = parts(o.created, tz); byHour[p.h] = (byHour[p.h] || 0) + 1; byDay[p.wd]++;
    const k = `${p.m}/${p.d}`; byDate[k] = byDate[k] || { date: k, orders: 0, sales: 0 }; byDate[k].orders++; byDate[k].sales += o.total; }
  // repeat customer = has ordered online more than once (counting orders before this range); new = one order so far
  const per = {}; for (const o of paid) { const c = per[o.phone] = per[o.phone] || { n: 0, before: false }; c.n++; if (o.repeat) c.before = true; }
  const phones = Object.keys(per), repeatCust = phones.filter(p => per[p].n > 1 || per[p].before).length, newCust = phones.length - repeatCust;
  const shown = paid.filter(o => o.upsell && o.upsell.shown && o.upsell.shown.length);
  const took = shown.filter(o => o.upsell.added && o.upsell.added.length);
  const upsellRev = took.reduce((a, o) => a + o.items.filter(l => o.upsell.added.includes(l.id)).reduce((b, l) => b + l.price * l.qty, 0), 0);
  return {
    range, orders: paid.length, sales, subtotal: sub, avgTicket: paid.length ? Math.round(sales / paid.length) : 0,
    tax: sales - sub, cancelled: orders.length - paid.length,
    customers: { total: phones.length, new: newCust, repeat: repeatCust, repeatOrders: paid.filter(o => o.repeat).length },
    topItems: Object.values(items).sort((a, b) => b.qty - a.qty || b.revenue - a.revenue).slice(0, 10),
    byHour: Array.from({ length: 24 }, (_, h) => ({ h, n: byHour[h] || 0 })).filter(x => x.h >= 10 && x.h <= 22),
    byDay: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => ({ d, n: byDay[i] })),
    byDate: Object.values(byDate),
    upsell: { ordersShown: shown.length, ordersTook: took.length, rate: shown.length ? took.length / shown.length : 0, revenue: upsellRev },
  };
}
