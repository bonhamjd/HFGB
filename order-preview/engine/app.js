// High Flyers online ordering backend. One fetch-style handler used by Cloudflare Workers, the local Node server,
// and the in-browser demo. Clover is the source of truth for items, prices and tax; this file never trusts client prices.
import { schedule, parts, zoned, label, dayKey } from './time.js';
import { publicConfig } from './config.js';
import { computeStats } from './stats.js';
import { sendSms } from './sms.js';
import { itemTaxRates, cartTax, ratePct } from './tax.js';
const MENU_CACHE_V = 2; // v2: items carry their own Clover tax rates

const GROUP_ORDER = ['Flatbreads', 'Wings', 'Burgers', 'Front 9', 'Sweets', 'More Food', 'Pop'];
const hex = n => [...crypto.getRandomValues(new Uint8Array(n))].map(b => b.toString(16).padStart(2, '0')).join('');
async function sha(s) { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join(''); }
const digits = s => String(s || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
const fmtPhone = d => `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
const money = c => '$' + (c / 100).toFixed(2);
class HttpError extends Error { constructor(status, msg, code) { super(msg); this.status = status; this.code = code; } }
const cleanName = n => n.replace(/^Pizza,\s*/i, '').replace(/\s*[xX]\s*(\d+)\s*$/, '').trim();

export function createApp({ cfg, store, clover, data = {}, log = () => {}, fetchFn }) {
  const overrides = data.overrides || {}, pairings = data.pairings || { pairs: {}, sales90: {} };
  const clock = req => (cfg.allowTestClock && req && req.headers.get('x-test-now')) ? +req.headers.get('x-test-now') : Date.now();

  // ---------- menu (synced from Clover) ----------
  async function syncMenu() {
    const [items, taxes] = await Promise.all([clover.listItems(), clover.taxRates()]);
    const defaults = taxes.filter(t => t.isDefault);
    const cache = { v: MENU_CACHE_V, ts: Date.now(), taxRate: defaults.reduce((a, t) => a + t.rate, 0) / 1e7,
      items: items.map(i => ({ id: i.id, name: i.name, price: i.price || 0, priceType: i.priceType, hidden: !!i.hidden, available: i.available !== false,
        cats: (i.categories?.elements || []).map(c => c.name), taxRates: itemTaxRates(i, defaults) })) };
    await store.setSetting('menu_cache', cache); return cache;
  }
  async function menuCache(force = false) {
    let c = await store.getSetting('menu_cache');
    if (force || !c || c.v !== MENU_CACHE_V || Date.now() - c.ts > cfg.menuSyncMin * 60000) {
      try { c = await syncMenu(); } catch (e) { log('menu sync failed', e.message); if (!c) throw new HttpError(503, 'Menu is not available right now. Please call the bar.'); }
    }
    return c;
  }
  const eligible = i => i.price > 0 && i.priceType === 'FIXED' && !i.hidden && i.available &&
    i.cats.some(c => cfg.onlineCategories.includes(c)) && !i.cats.some(c => cfg.blockedCategories.includes(c));
  async function menu() {
    const c = await menuCache(), online = await store.getSetting('online', {}), sold = await store.getSetting('soldout', {});
    const all = c.items.filter(eligible).map(i => {
      const o = overrides[i.id] || {}, sales = pairings.sales90?.[i.id] ?? null;
      const on = online[i.id] !== undefined ? online[i.id] : (sales === null ? true : sales > 0);
      return { id: i.id, name: o.name || cleanName(i.name), note: o.note || '', cloverName: i.name, price: i.price, taxRates: i.taxRates || [],
        group: o.group || (i.cats.includes('Pop') ? 'Pop' : 'More Food'), online: on, soldOut: !!sold[i.id], sales90: sales || 0 };
    });
    return { cache: c, all, items: all.filter(i => i.online) };
  }
  function publicMenu(m) {
    const ids = new Set(m.items.map(i => i.id)), groups = {};
    for (const i of m.items) (groups[i.group] = groups[i.group] || []).push(i);
    const pairs = {}; for (const [k, v] of Object.entries(pairings.pairs || {})) if (ids.has(k)) { const f = v.filter(x => ids.has(x.id)); if (f.length) pairs[k] = f.map(x => x.id); }
    return { updated: m.cache.ts, taxRate: m.cache.taxRate, pairs,
      groups: GROUP_ORDER.filter(g => groups[g]).map(g => ({ name: g, items: groups[g].sort((a, b) => b.sales90 - a.sales90 || b.price - a.price)
        .map(({ id, name, note, price, soldOut, taxRates }) => ({ id, name, note, price, soldOut, taxRates, taxPct: ratePct(taxRates) })) })) };
  }

  // ---------- schedule ----------
  async function sched(now) {
    const p = parts(now, cfg.tz), from = zoned(p.y, p.m, p.d, 0, 0, cfg.tz), counts = await store.slotCounts(from, from + 36 * 3600000);
    return schedule(cfg, now, counts, await store.getSetting('paused', false));
  }

  // ---------- customers ----------
  function usualOf(c) {
    if (!c || !c.orders || !c.orders.length) return null;
    const tally = {}; c.orders.forEach((o, idx) => { const k = JSON.stringify(Object.entries(o.items).sort()); tally[k] = tally[k] || { n: 0, last: 0 }; tally[k].n++; tally[k].last = idx; });
    const best = Object.entries(tally).sort((a, b) => b[1].n - a[1].n || b[1].last - a[1].last)[0][0];
    return JSON.parse(best).map(([id, qty]) => ({ id, qty }));
  }
  async function lookup(phone, deviceToken) {
    const c = await store.getCustomer(phone); if (!c) return { known: false };
    const h = deviceToken ? await sha(deviceToken) : '', dev = !!h && (c.devices || []).includes(h);
    return { known: true, firstName: c.firstName, usual: usualOf(c), deviceVerified: dev }; // no saved cards: Clover card on file is not available
  }

  // ---------- pricing ----------
  function price(m, items) {
    const byId = Object.fromEntries(m.items.map(i => [i.id, i]));
    let qtyTotal = 0; const lines = [], problems = [];
    for (const x of items || []) {
      const qty = Math.floor(+x.qty || 0); if (qty < 1) continue; const i = byId[x.id];
      if (!i) { problems.push({ id: x.id, why: 'not_available' }); continue; }
      if (i.soldOut) { problems.push({ id: x.id, name: i.name, why: 'sold_out' }); continue; }
      qtyTotal += qty; lines.push({ id: i.id, name: i.name, note: i.note, price: i.price, qty, taxRates: i.taxRates || [] });
    }
    if (qtyTotal > cfg.maxItems) throw new HttpError(400, `For orders over ${cfg.maxItems} items please call the bar.`, 'too_many');
    const subtotal = lines.reduce((a, l) => a + l.price * l.qty, 0), tax = cartTax(lines);
    return { lines: lines.map(({ taxRates, ...l }) => ({ ...l, taxPct: ratePct(taxRates) })), problems, subtotal, tax, total: subtotal + tax };
  }

  // ---------- place order ----------
  async function placeOrder(b, now) {
    if (!cfg.paymentsEnabled) throw new HttpError(503, 'Online payments are not turned on yet. Please call the bar at (402) 923-0160 to order.', 'payments_disabled');
    if (b.idem) { const prev = await store.findOrderByIdem(String(b.idem)); if (prev) return { ok: true, order: pubOrder(prev), duplicate: true }; }
    const phone = digits(b.phone), name = String(b.name || '').trim().slice(0, 40), notes = String(b.notes || '').trim().slice(0, 240);
    if (phone.length !== 10) throw new HttpError(400, 'Please enter a 10 digit phone number.', 'phone');
    if (!name) throw new HttpError(400, 'Please add a name for the order.', 'name');
    const s = await sched(now); if (!s.open) throw new HttpError(409, closedMsg(s), s.reason);
    const m = await menu(), q = price(m, b.items);
    if (q.problems.length) throw new HttpError(409, 'Some items just sold out: ' + q.problems.map(p => p.name || 'an item').join(', '), 'sold_out');
    if (!q.lines.length) throw new HttpError(400, 'Your order is empty.', 'empty');
    if (cfg.maxTotal && q.total > cfg.maxTotal) throw new HttpError(400, "Large order? Call us at (402) 923-0160 and we'll get it ready.", 'over_cap');
    // Big orders (over BIG_ORDER_TOTAL) get BIG_ORDER_EXTRA_MIN more prep. Slot cap per 15 min still applies.
    const extra = cfg.bigOrderTotal && q.total > cfg.bigOrderTotal ? cfg.bigOrderExtraMin : 0, need = now + (cfg.prepMin + extra) * 60000;
    let slot;
    if (b.slot === 'asap' || !b.slot) {
      if (!extra) slot = s.asap;
      else { const x = s.slots.find(z => z.left > 0 && z.t >= need); slot = x && { t: x.t, label: x.label, readyAt: Math.max(x.t - 15 * 60000, need) }; }
    } else {
      slot = s.slots.find(x => x.t === +b.slot);
      if (slot && extra && slot.t < need) { const nx = s.slots.find(z => z.left > 0 && z.t >= need); throw new HttpError(409, `Big orders need about ${cfg.prepMin + extra} min. Please pick ${nx ? nx.label : 'a later time'} or later.`, 'slot'); }
    }
    if (!slot) throw new HttpError(409, 'That pickup time is no longer available. Please pick another.', 'slot');
    if (b.slot !== 'asap' && slot.left < 1) throw new HttpError(409, 'That pickup time just filled up. Please pick another.', 'slot_full');
    if (b.expectedTotal !== undefined && +b.expectedTotal !== q.total) throw new HttpError(409, `Your total is now ${money(q.total)}. Please check your order and tap Pay again.`, 'price_changed');
    const pay = b.payment || {}; const cust = await store.getCustomer(phone);
    const devHash = b.deviceToken ? await sha(String(b.deviceToken)) : '';
    if (pay.type !== 'token' || !String(pay.token || '').startsWith('clv_')) throw new HttpError(400, 'Card info is missing.', 'card');
    const email = String(b.email || '').trim().slice(0, 120);
    if (email && !/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, 'That email does not look right. Fix it or leave it blank.', 'email');

    const no = await store.nextOrderNo();
    const isAsap = b.slot === 'asap' || !b.slot, pickLabel = isAsap ? `ASAP (~${label(slot.readyAt || slot.t, cfg.tz)})` : label(slot.t, cfg.tz);
    const orderCart = { title: `Online #${no} ${name}`, note: `ONLINE PICKUP ${pickLabel} | ${name} ${fmtPhone(phone)}${notes ? ' | ' + notes : ''}`,
      lineItems: q.lines.flatMap(l => Array.from({ length: l.qty }, () => ({ item: { id: l.id } }))) };
    const otId = cfg.orderTypeId || await store.getSetting('order_type_id'); if (otId) orderCart.orderType = { id: otId };
    const co = await clover.createAtomicOrder(orderCart);
    // Clover is the authority on the amount. The customer must be charged exactly Clover's order total, and that must be
    // the total they were shown. If they differ (price or tax changed in Clover), drop the unpaid order and ask again.
    let full = co; if (typeof co.total !== 'number' || !co.lineItems?.elements) { try { full = await clover.getOrder(co.id); } catch (e) { log('could not read order back', e.message); } }
    const total = typeof full.total === 'number' ? full.total : co.total;
    const cloverLines = full.lineItems?.elements, cloverSub = cloverLines ? cloverLines.reduce((a, l) => a + (l.price || 0), 0) : q.subtotal;
    const cloverTax = typeof full.taxAmount === 'number' ? full.taxAmount : total - cloverSub;
    if (typeof total !== 'number' || total !== q.total) {
      log('total mismatch, not charging', { ours: q.total, clover: total });
      try { await clover.deleteOrder(co.id); } catch (e2) { log('could not delete unpaid order', co.id, e2.message); }
      await syncMenu().catch(() => {});
      throw new HttpError(409, 'Prices just updated. Please check your total and tap Pay again. Nothing was charged.', 'price_changed');
    }

    let paid; // one-time card token only. No Clover customers, no stored credentials, no card on file.
    try {
      paid = await clover.payOrder(co.id, { source: pay.token, amount: total, ...(email ? { email } : {}) });
    } catch (e) {
      try { await clover.deleteOrder(co.id); } catch (e2) { log('could not delete unpaid order', co.id, e2.message); }
      const declined = e.status === 402 || /declin/i.test(JSON.stringify(e.body || ''));
      throw new HttpError(402, declined ? 'Your card was declined. Please try another card.' : 'Payment did not go through. Nothing was charged. Please try again.', declined ? 'declined' : 'payment');
    }
    if (typeof paid?.amount === 'number' && paid.amount !== total) log('charged amount differs from Clover order total', { total, charged: paid.amount });
    const card = { brand: pay.card?.brand || paid?.source?.brand || 'CARD', last4: pay.card?.last4 || paid?.source?.last4 || '' };
    const o = { id: 'o' + hex(8), no, idem: b.idem ? String(b.idem) : null, created: now, status: 'new', slot: slot.t, asap: isAsap, pickLabel,
      readyAt: isAsap ? slot.readyAt : slot.t, name, phone, email: email || null, notes, items: q.lines, subtotal: cloverSub, tax: cloverTax, total, taxSource: 'clover',
      paidAmount: typeof paid?.amount === 'number' ? paid.amount : total,
      cloverOrderId: co.id, payment: { brand: card.brand, last4: card.last4, charge: paid?.charge || paid?.id || null },
      repeat: !!(cust && cust.orderCount > 0), upsell: { shown: (b.upsell?.shown || []).slice(0, 10), added: (b.upsell?.added || []).filter(id => q.lines.some(l => l.id === id)) },
      key: hex(12), mode: cfg.mode, history: [{ s: 'new', at: now }], print: null, sms: null };
    if (cfg.printEnabled) { try { const pe = await clover.printOrder(co.id); o.print = { ok: true, id: pe.id, state: pe.state }; } catch (e) { o.print = { ok: false, error: e.message }; log('print failed', e.message); } }
    else o.print = { ok: false, error: 'printing off' };
    const smsBody = `HFGB online #${no} ${name} ${money(total)} pickup ${pickLabel}: ` + q.lines.map(l => `${l.qty}x ${l.name}`).join(', ');
    try { o.sms = await sendSms(cfg, cfg.smsTo, smsBody, fetchFn); } catch (e) { o.sms = { status: 'error' }; }
    await store.insertOrder(o);

    // remember the customer
    const deviceToken = b.deviceToken && devHash ? String(b.deviceToken) : hex(24), dh = devHash || await sha(deviceToken);
    const c = cust || { phone, orders: [], devices: [], orderCount: 0, firstOrderAt: now, totalSpent: 0 };
    c.firstName = name; if (email) c.email = email; delete c.card; delete c.cardDevices; delete c.cloverCustomerId;
    if (!c.devices.includes(dh)) c.devices = [...c.devices, dh].slice(-8);
    c.orders = [...(c.orders || []), { id: o.id, ts: now, total, items: Object.fromEntries(q.lines.map(l => [l.id, l.qty])) }].slice(-10);
    c.orderCount++; c.lastOrderAt = now; c.totalSpent += total; await store.putCustomer(c);
    return { ok: true, order: pubOrder(o), deviceToken };
  }
  const pubOrder = o => ({ id: o.id, no: o.no, key: o.key, status: o.status, readyAt: o.readyAt, pickLabel: o.pickLabel, asap: o.asap, name: o.name,
    items: o.items, subtotal: o.subtotal, tax: o.tax, total: o.total, payment: { brand: o.payment.brand, last4: o.payment.last4 }, created: o.created });
  const closedMsg = s => ({ not_yet: `Online ordering opens at ${s.opensLabel}. First pickup ${s.firstPickupLabel}.`,
    done_for_day: `Online ordering is closed for today (orders stop at ${s.lastOrderLabel}). Come see us at the bar!`,
    closed_today: 'Online ordering is closed today.', paused: 'Online ordering is paused for a bit. Please call the bar.',
    full: 'All pickup times are full for today. Please call the bar.' }[s.reason] || 'Online ordering is closed.');

  async function staffAction(id, b, now) {
    const o = await store.getOrder(id); if (!o) throw new HttpError(404, 'Order not found');
    const a = b.action;
    if (a === 'accept') { const min = Math.max(5, Math.min(90, +b.minutes || cfg.prepMin)); o.status = 'making'; o.readyAt = now + min * 60000; o.acceptedAt = now; }
    else if (a === 'ready') { o.status = 'ready'; o.readyTs = now; }
    else if (a === 'picked') { o.status = 'picked'; o.pickedAt = now; }
    else if (a === 'cancel') { o.status = 'cancelled'; o.cancelledAt = now; }
    else throw new HttpError(400, 'bad action');
    o.history.push({ s: o.status, at: now }); await store.updateOrder(o); return o;
  }
  const rangeStart = (r, now) => { const p = parts(now, cfg.tz), day = zoned(p.y, p.m, p.d, 0, 0, cfg.tz);
    return r === 'today' ? day : r === 'all' ? 0 : day - (Math.max(1, +r || 7) - 1) * 86400000; };

  // ---------- router ----------
  async function route(req) {
    const u = new URL(req.url), p = u.pathname.replace(/^\/api/, ''), M = req.method, now = clock(req);
    const body = M === 'POST' ? await req.json().catch(() => ({})) : {};
    const staff = () => { if (!cfg.staffKey || req.headers.get('x-staff-key') !== cfg.staffKey) throw new HttpError(401, 'Staff key needed', 'staff_key'); };
    const admin = () => { if (!cfg.adminKey || req.headers.get('x-admin-key') !== cfg.adminKey) throw new HttpError(401, 'Admin key needed', 'admin_key'); };
    if (M === 'GET' && p === '/config') return { ...publicConfig(cfg, clover.base), schedule: await sched(now) };
    if (M === 'GET' && p === '/menu') { const m = await menu(); return { ...publicMenu(m), schedule: await sched(now) }; }
    if (M === 'POST' && p === '/customer/lookup') { const ph = digits(body.phone); return ph.length === 10 ? lookup(ph, body.deviceToken) : { known: false }; }
    if (M === 'POST' && p === '/me') { // device-only recognition on page load
      if (!body.phone || !body.deviceToken) return { known: false };
      const r = await lookup(digits(body.phone), body.deviceToken); return r.deviceVerified ? r : { known: false };
    }
    if (M === 'POST' && p === '/quote') { const m = await menu(); return price(m, body.items); }
    if (M === 'POST' && p === '/order') return placeOrder(body, now);
    let mm = p.match(/^\/order\/(\w+)$/);
    if (M === 'GET' && mm) { const o = await store.getOrder(mm[1]); if (!o || o.key !== u.searchParams.get('k')) throw new HttpError(404, 'Order not found'); return pubOrder(o); }
    if (M === 'POST' && p === '/dev/tokenize') { // mock and sandbox only: stands in for Clover's hosted card form during tests
      if (cfg.mode === 'production') throw new HttpError(404, 'not found');
      const t = await clover.tokenizeTestCard({ number: body.number, exp_month: '12', exp_year: '2030', cvv: '123', brand: 'VISA' }); return { token: t.id, card: t.card };
    }
    // staff
    if (p.startsWith('/staff/')) {
      staff();
      if (M === 'GET' && p === '/staff/orders') {
        const s = await sched(now), list = await store.listOrders(rangeStart('today', now), now + 86400000);
        const m = await menu(); return { now, schedule: s, paused: await store.getSetting('paused', false), orders: list,
          menu: m.items.map(({ id, name, note, soldOut, group }) => ({ id, name, note, soldOut, group })) };
      }
      mm = p.match(/^\/staff\/order\/(\w+)$/); if (M === 'POST' && mm) return staffAction(mm[1], body, now);
      if (M === 'POST' && p === '/staff/soldout') { const s = await store.getSetting('soldout', {}); if (body.soldOut) s[body.id] = true; else delete s[body.id]; await store.setSetting('soldout', s); return { ok: true, soldout: s }; }
      if (M === 'POST' && p === '/staff/pause') { await store.setSetting('paused', !!body.paused); return { ok: true, paused: !!body.paused }; }
    }
    if (p.startsWith('/admin/')) {
      admin(); const r = u.searchParams.get('range') || '7', since = rangeStart(r, now);
      if (M === 'GET' && p === '/admin/stats') { const list = await store.listOrders(since, now + 86400000); return computeStats(list, cfg.tz, r); }
      if (M === 'GET' && p === '/admin/orders') return (await store.listOrders(since, now + 86400000)).reverse().slice(0, 300);
      if (M === 'GET' && p === '/admin/menu') { const m = await menu(); return { updated: m.cache.ts, taxRate: m.cache.taxRate, items: m.all }; }
      if (M === 'POST' && p === '/admin/online') { const s = await store.getSetting('online', {}); s[body.id] = !!body.online; await store.setSetting('online', s); return { ok: true }; }
      if (M === 'POST' && p === '/admin/sync') { const c = await syncMenu(); return { ok: true, items: c.items.length, ts: c.ts }; }
      if (M === 'GET' && p === '/admin/settings') {
        const { apiToken, ecomPrivate, twilioToken, staffKey, adminKey, ...safe } = cfg;
        return { ...safe, orderTypeId: cfg.orderTypeId || await store.getSetting('order_type_id'), base: clover.base, customers: (await store.listCustomers()).length };
      }
    }
    throw new HttpError(404, 'Not found');
  }

  function cors(req, res) {
    const o = req.headers.get('origin'); if (o && cfg.allowedOrigins.includes(o)) {
      res.headers.set('access-control-allow-origin', o); res.headers.set('vary', 'origin');
      res.headers.set('access-control-allow-headers', 'content-type,x-staff-key,x-admin-key,x-test-now'); res.headers.set('access-control-allow-methods', 'GET,POST,OPTIONS');
    } return res;
  }
  return {
    syncMenu, menuCache,
    async ensureOrderType() { // sandbox/mock only unless JD allows production setup
      if (cfg.orderTypeId) return cfg.orderTypeId;
      const saved = await store.getSetting('order_type_id'); if (saved) return saved;
      const list = await clover.orderTypes(); let ot = list.find(t => t.label === cfg.orderTypeLabel);
      if (!ot) { if (!cfg.allowSetup) { log('Online Pickup order type missing and production setup not allowed'); return null; } ot = await clover.createOrderType(cfg.orderTypeLabel); }
      await store.setSetting('order_type_id', ot.id); return ot.id;
    },
    async handle(req) {
      if (req.method === 'OPTIONS') return cors(req, new Response(null, { status: 204 }));
      try { const out = await route(req); return cors(req, new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })); }
      catch (e) { const st = e.status && e.status < 600 && e instanceof HttpError ? e.status : 500; if (st === 500) log('error', e.stack || e.message);
        return cors(req, new Response(JSON.stringify({ error: st === 500 ? 'Something went wrong. Please try again or call the bar.' : e.message, code: e.code || null }), { status: st, headers: { 'content-type': 'application/json' } })); }
    },
    async cron() { try { await syncMenu(); } catch (e) { log('cron sync failed', e.message); } },
  };
}
