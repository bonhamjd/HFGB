// Mock Clover that answers the same URLs and JSON shapes as the real APIs, so the real client code is exercised.
// State is a plain object; the caller supplies load/save (memory, a JSON file, or browser localStorage).
import { itemTaxRates, cartTax } from './tax.js';
const rid = (n = 13) => { const a = 'ABCDEFGHJKMNPQRSTVWXYZ0123456789'; let s = ''; const r = crypto.getRandomValues(new Uint8Array(n)); for (const x of r) s += a[x % a.length]; return s; };
const J = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
const brandOf = n => /^4/.test(n) ? 'VISA' : /^5[1-5]/.test(n) ? 'MC' : /^3[47]/.test(n) ? 'AMEX' : /^6/.test(n) ? 'DISCOVER' : 'UNKNOWN';
export const TEST_CARDS = { approve: '4242424242424242', decline: '4000000000000002' };

export function createMockClover({ seed, load, save, cfg }) {
  const init = () => ({ items: seed.items, categories: seed.categories, tax_rates: seed.tax_rates, order_types: seed.order_types,
    orders: {}, payments: {}, customers: {}, tokens: {}, prints: [], multiPay: true });
  const state = () => { let s = load(); if (!s) { s = init(); save(s); } return s; };

  return async function mockFetch(url, init = {}) {
    const u = new URL(url), method = (init.method || 'GET').toUpperCase(), path = u.pathname;
    const auth = (init.headers?.authorization || '').replace('Bearer ', '');
    const body = init.body ? JSON.parse(init.body) : {};
    const s = state();
    const done = (status, obj) => { save(s); return J(status, obj); };
    // ---- token host (browser-side tokenization in real life) ----
    if (u.host.startsWith('mock-token')) {
      if ((init.headers?.apikey || '') !== cfg.ecomPublic) return J(401, { message: 'invalid apikey' });
      if (method === 'POST' && path === '/v1/tokens') {
        const n = String(body.card?.number || '').replace(/\D/g, '');
        if (n.length < 13) return J(400, { error: { type: 'invalid_request_error', message: 'card number invalid' } });
        const id = 'clv_1TST' + rid(20); s.tokens[id] = { number: n, used: false, created: Date.now() };
        return done(200, { id, object: 'token', card: { exp_month: body.card.exp_month, exp_year: body.card.exp_year, first6: n.slice(0, 6), last4: n.slice(-4), brand: brandOf(n) } });
      }
    }
    // ---- ecommerce host ----
    if (u.host.startsWith('mock-scl')) {
      if (auth !== cfg.ecomPrivate) return J(401, { message: '401 Unauthorized' });
      if (method === 'POST' && path === '/v1/customers') {
        if (!s.multiPay) return J(400, { error: { message: 'Multi-pay tokens are not enabled for this merchant' } });
        if (!body.email) return J(400, { error: { message: 'email is required' } });
        const t = s.tokens[body.source]; if (!t || t.used) return J(400, { error: { code: 'invalid_source', message: 'invalid or used token' } });
        t.used = true; const cardId = rid(); const id = rid();
        s.customers[id] = { id, email: body.email, firstName: body.firstName, phone: body.phone, cards: { [cardId]: t.number } };
        return done(200, { id, object: 'customer', created: Date.now(), currency: 'USD', email: body.email, sources: { object: 'list', data: [cardId] } });
      }
      let m = path.match(/^\/v1\/customers\/(\w+)$/);
      if (m && method === 'PUT') {
        const c = s.customers[m[1]]; if (!c) return J(404, { message: 'customer not found' });
        const t = s.tokens[body.source]; if (!t || t.used) return J(400, { error: { code: 'invalid_source' } });
        t.used = true; c.cards = { [rid()]: t.number }; return done(200, { id: c.id, object: 'customer', sources: { data: Object.keys(c.cards) } });
      }
      m = path.match(/^\/v1\/orders\/(\w+)\/pay$/);
      if (m && method === 'POST') {
        const o = s.orders[m[1]]; if (!o) return J(404, { message: 'order not found' });
        if (o.paymentState === 'PAID') return J(400, { error: { message: 'order already paid' } });
        let number;
        if (String(body.source).startsWith('clv_')) { const t = s.tokens[body.source]; if (!t || t.used) return J(400, { error: { code: 'invalid_source', message: 'invalid or used token' } }); t.used = true; number = t.number; }
        else { const c = s.customers[body.source]; if (!c) return J(400, { error: { code: 'invalid_source', message: 'unknown source' } }); number = Object.values(c.cards)[0];
          if (!body.stored_credentials) return J(400, { error: { message: 'stored_credentials required for card on file' } }); }
        if (number === TEST_CARDS.decline) return done(402, { error: { type: 'card_error', code: 'card_declined', message: 'Card was declined.' } });
        if (body.amount !== undefined && body.amount !== o.total) return J(400, { error: { message: `amount ${body.amount} does not match order total ${o.total}` } });
        const pid = rid(); o.paymentState = 'PAID'; o.state = 'locked';
        s.payments[pid] = { id: pid, order: o.id, amount: o.total, created: Date.now() }; s.lastPayBody = body;
        return done(200, { id: o.id, object: 'order', amount: o.total, currency: 'usd', status: 'paid', charge: pid,
          source: { last4: number.slice(-4), brand: brandOf(number) }, created: o.createdTime });
      }
    }
    // ---- platform API ----
    if (u.host.startsWith('mock-api')) {
      if (auth !== cfg.apiToken) return J(401, { message: '401 Unauthorized' });
      const pre = `/v3/merchants/${cfg.mid}`; if (!path.startsWith(pre)) return J(404, { message: 'merchant not found' });
      const p = path.slice(pre.length);
      const page = arr => { const lim = +(u.searchParams.get('limit') || 100), off = +(u.searchParams.get('offset') || 0); return { elements: arr.slice(off, off + lim), href: url }; };
      if (method === 'GET' && p === '/items') return J(200, page(s.items));
      if (method === 'GET' && p === '/categories') return J(200, page(s.categories));
      if (method === 'GET' && p === '/tax_rates') return J(200, page(s.tax_rates));
      if (method === 'GET' && p === '/order_types') return J(200, page(s.order_types));
      if (method === 'POST' && p === '/order_types') { const ot = { id: rid(), label: body.label, taxable: body.taxable !== false, isDefault: false, isHidden: !!body.isHidden }; s.order_types.push(ot); return done(200, ot); }
      if (method === 'POST' && p === '/atomic_order/orders') {
        const cart = body.orderCart || {}; const byId = Object.fromEntries(s.items.map(i => [i.id, i]));
        const defaults = s.tax_rates.filter(t => t.isDefault);
        const lines = []; for (const li of cart.lineItems || []) { const it = byId[li.item?.id]; if (!it) return J(400, { message: `item ${li.item?.id} not found` }); lines.push({ id: rid(), item: { id: it.id }, name: it.name, price: it.price, note: li.note || null, taxRates: { elements: itemTaxRates(it, defaults) } }); }
        if (cart.orderType?.id && !s.order_types.find(t => t.id === cart.orderType.id)) return J(400, { message: 'order type not found' });
        const sub = lines.reduce((a, l) => a + l.price, 0), tax = cartTax(lines.map(l => ({ price: l.price, qty: 1, taxRates: l.taxRates.elements })));
        const o = { id: rid(), currency: 'USD', title: cart.title || null, note: cart.note || null, orderType: cart.orderType || null, state: 'open', paymentState: 'OPEN',
          total: sub + tax, taxAmount: tax, createdTime: Date.now(), lineItems: { elements: lines } };
        s.orders[o.id] = o; return done(200, o);
      }
      let m = p.match(/^\/orders\/(\w+)$/);
      if (m && method === 'GET') { const o = s.orders[m[1]]; return o ? J(200, o) : J(404, { message: 'not found' }); }
      if (m && method === 'DELETE') { if (!s.orders[m[1]]) return J(404, { message: 'not found' }); if (s.orders[m[1]].paymentState === 'PAID') return J(400, { message: 'paid order' }); delete s.orders[m[1]]; return done(200, {}); }
      if (method === 'POST' && p === '/print_event') {
        const o = s.orders[body.orderRef?.id]; if (!o) return J(400, { message: 'order not found' });
        const ev = { id: rid(), orderRef: { id: o.id }, deviceRef: { id: 'mock-station-duo' }, state: 'CREATED', createdTime: Date.now() };
        s.prints.push({ ...ev, title: o.title, note: o.note, lines: o.lineItems.elements.map(l => l.name) }); return done(200, ev);
      }
    }
    return J(404, { message: `mock: no route ${method} ${u.host}${path}` });
  };
}
