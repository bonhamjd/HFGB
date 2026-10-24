// Thin Clover client. Same code for sandbox, production and the mock (the mock answers the same URLs).
// Docs: Platform API v3 (inventory, atomic orders, print_event, order_types) and Ecommerce API v1 (tokens, customers, orders/{id}/pay).
export const BASES = {
  production: { api: 'https://api.clover.com', ecom: 'https://scl.clover.com', token: 'https://token.clover.com', sdk: 'https://checkout.clover.com/sdk.js' },
  sandbox: { api: 'https://apisandbox.dev.clover.com', ecom: 'https://scl-sandbox.dev.clover.com', token: 'https://token-sandbox.dev.clover.com', sdk: 'https://checkout.sandbox.dev.clover.com/sdk.js' },
  mock: { api: 'https://mock-api.clover.test', ecom: 'https://mock-scl.clover.test', token: 'https://mock-token.clover.test', sdk: '' },
};
export class CloverError extends Error {
  constructor(status, body, where) { super(`Clover ${where} ${status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`); this.status = status; this.body = body; }
}
export class CloverClient {
  constructor(cfg, fetchFn) {
    this.cfg = cfg; this.base = BASES[cfg.mode] || BASES.mock; this.f = fetchFn || ((...a) => fetch(...a)); this.calls = 0;
  }
  async req(url, { method = 'GET', body, auth, headers = {} } = {}, where = '') {
    this.calls++;
    if (method !== 'GET' && this.cfg.mode !== 'mock' && !this.cfg.paymentsEnabled && !(this.cfg.allowSetup && /\/order_types$/.test(url)))
      throw new CloverError(423, 'writes to Clover are locked while PAYMENTS_ENABLED is false', where || url);
    const h = { accept: 'application/json', ...headers };
    if (auth) h.authorization = 'Bearer ' + auth;
    if (body !== undefined) h['content-type'] = 'application/json';
    const r = await this.f(url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
    const txt = await r.text(); let j; try { j = txt ? JSON.parse(txt) : {}; } catch { j = txt; }
    if (!r.ok) throw new CloverError(r.status, j, where || url);
    return j;
  }
  v3(path, opt = {}) { return this.req(`${this.base.api}/v3/merchants/${this.cfg.mid}${path}`, { ...opt, auth: this.cfg.apiToken }, 'v3 ' + path); }
  ecom(path, opt = {}) { return this.req(`${this.base.ecom}${path}`, { ...opt, auth: this.cfg.ecomPrivate }, 'ecom ' + path); }

  async listItems() {
    const out = []; for (let off = 0; off < 20000; off += 1000) {
      const r = await this.v3(`/items?expand=categories&limit=1000&offset=${off}`); const el = r.elements || [];
      out.push(...el); if (el.length < 1000) break;
    } return out;
  }
  async taxRates() { return (await this.v3('/tax_rates?limit=100')).elements || []; }
  async orderTypes() { return (await this.v3('/order_types?limit=100')).elements || []; }
  createOrderType(label) { return this.v3('/order_types', { method: 'POST', body: { label, taxable: true, isHidden: false, filterCategories: false, isDefault: false } }); }
  createAtomicOrder(orderCart) { return this.v3('/atomic_order/orders', { method: 'POST', body: { orderCart } }); }
  getOrder(id) { return this.v3(`/orders/${id}?expand=lineItems`); }
  deleteOrder(id) { return this.v3(`/orders/${id}`, { method: 'DELETE' }); }
  printOrder(id) { return this.v3('/print_event', { method: 'POST', body: { orderRef: { id } } }); }
  // Ecommerce
  createCustomer(c) { return this.ecom('/v1/customers', { method: 'POST', body: c }); }
  updateCustomerSource(id, source) { return this.ecom(`/v1/customers/${id}`, { method: 'PUT', body: { source } }); }
  payOrder(id, body) { return this.ecom(`/v1/orders/${id}/pay`, { method: 'POST', body: { ecomind: 'ecom', ...body } }); }
  // Only for mock/sandbox test cards. Real customers type cards into Clover's hosted iframe, never into our page.
  tokenizeTestCard(card) {
    if (this.cfg.mode === 'production') throw new Error('test tokenization disabled in production');
    return this.req(`${this.base.token}/v1/tokens`, { method: 'POST', body: { card }, headers: { apikey: this.cfg.ecomPublic } }, 'token');
  }
}
