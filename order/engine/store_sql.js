// SQL store for Cloudflare D1 (or any D1-shaped wrapper, like the sql.js one used locally).
export class SqlStore {
  constructor(db) { this.db = db; }
  q(sql, ...a) { return this.db.prepare(sql).bind(...a); }
  async getSetting(k, def = null) { const r = await this.q('SELECT v FROM settings WHERE k=?', k).first(); return r ? JSON.parse(r.v) : def; }
  async setSetting(k, v) { await this.q('INSERT INTO settings (k,v) VALUES (?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v', k, JSON.stringify(v)).run(); }
  async nextOrderNo() {
    const r = await this.q("UPDATE settings SET v = CAST(CAST(v AS INTEGER) + 1 AS TEXT) WHERE k='seq' RETURNING v").first();
    if (r) return +JSON.parse(r.v);
    await this.q("INSERT OR IGNORE INTO settings (k,v) VALUES ('seq','1001')").run(); return 1001;
  }
  row(r) { return r ? JSON.parse(r.data) : null; }
  async findOrderByIdem(idem) { return this.row(await this.q('SELECT data FROM orders WHERE idem=?', idem).first()); }
  async insertOrder(o) { await this.q('INSERT INTO orders (id,no,created,slot,status,phone,idem,data) VALUES (?,?,?,?,?,?,?,?)', o.id, o.no, o.created, o.slot, o.status, o.phone, o.idem || null, JSON.stringify(o)).run(); }
  async getOrder(id) { return this.row(await this.q('SELECT data FROM orders WHERE id=?', id).first()); }
  async updateOrder(o) { await this.q('UPDATE orders SET status=?, slot=?, data=? WHERE id=?', o.status, o.slot, JSON.stringify(o), o.id).run(); }
  async listOrders(since = 0, until = 9e15) { const r = await this.q('SELECT data FROM orders WHERE created>=? AND created<? ORDER BY created', since, until).all(); return (r.results || []).map(x => JSON.parse(x.data)); }
  async slotCounts(from, to) {
    const r = await this.q("SELECT slot, COUNT(*) n FROM orders WHERE slot>=? AND slot<? AND status NOT IN ('cancelled','failed') GROUP BY slot", from, to).all();
    return Object.fromEntries((r.results || []).map(x => [x.slot, x.n]));
  }
  async getCustomer(phone) { return this.row(await this.q('SELECT data FROM customers WHERE phone=?', phone).first()); }
  async putCustomer(c) { await this.q('INSERT INTO customers (phone,data) VALUES (?,?) ON CONFLICT(phone) DO UPDATE SET data=excluded.data', c.phone, JSON.stringify(c)).run(); }
  async listCustomers() { const r = await this.q('SELECT data FROM customers').all(); return (r.results || []).map(x => JSON.parse(x.data)); }
}
