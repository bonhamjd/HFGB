// Key-value store for the in-browser demo (localStorage) or quick tests (memory). Re-reads state on every call
// so the order page, staff screen and dashboard stay in sync across browser tabs.
export class MemStore {
  constructor(load, save) { this.load = () => load() || { settings: { seq: 1000 }, orders: {}, customers: {} }; this.save = save; }
  tx(fn) { const s = this.load(); const r = fn(s); this.save(s); return r; }
  async getSetting(k, def = null) { const v = this.load().settings[k]; return v === undefined ? def : v; }
  async setSetting(k, v) { this.tx(s => { s.settings[k] = v; }); }
  async nextOrderNo() { return this.tx(s => (s.settings.seq = (s.settings.seq || 1000) + 1)); }
  async findOrderByIdem(idem) { return Object.values(this.load().orders).find(o => o.idem && o.idem === idem) || null; }
  async insertOrder(o) { this.tx(s => { s.orders[o.id] = o; }); }
  async getOrder(id) { return this.load().orders[id] || null; }
  async updateOrder(o) { this.tx(s => { s.orders[o.id] = o; }); }
  async listOrders(since = 0, until = 9e15) { return Object.values(this.load().orders).filter(o => o.created >= since && o.created < until).sort((a, b) => a.created - b.created); }
  async slotCounts(from, to) { const c = {}; for (const o of Object.values(this.load().orders)) if (o.slot >= from && o.slot < to && !['cancelled', 'failed'].includes(o.status)) c[o.slot] = (c[o.slot] || 0) + 1; return c; }
  async getCustomer(phone) { return this.load().customers[phone] || null; }
  async putCustomer(c) { this.tx(s => { s.customers[c.phone] = c; }); }
  async listCustomers() { return Object.values(this.load().customers); }
}
