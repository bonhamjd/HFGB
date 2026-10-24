// Talks to the ordering backend, or boots the same backend code inside this browser for the preview.
let demo = null;
const testAt = (() => { const q = new URLSearchParams(location.search).get('at'); if (q) sessionStorage.setItem('hfgb_at', q); return sessionStorage.getItem('hfgb_at'); })();
function testNowHeader() {
  if (!testAt || !/^\d{1,2}:\d{2}$/.test(testAt)) return {};
  const [h, m] = testAt.split(':').map(Number); const d = new Date();
  const chi = new Date(d.toLocaleString('en-US', { timeZone: 'America/Chicago' })); const off = d - chi;
  const t = new Date(chi.getFullYear(), chi.getMonth(), chi.getDate(), h, m).getTime() + off;
  return { 'x-test-now': String(t) };
}
export const isDemo = () => window.HFGB_ORDER.apiBase === null || window.HFGB_ORDER.apiBase === undefined;
export async function api(path, { method = 'GET', body, headers = {} } = {}) {
  const init = { method, headers: { 'content-type': 'application/json', ...testNowHeader(), ...headers }, body: body ? JSON.stringify(body) : undefined };
  let r;
  if (isDemo()) { if (!demo) demo = import('./demo_engine.js').then(m => m.boot()); const app = await demo; r = await app.handle(new Request(location.origin + '/api' + path, init)); }
  else r = await fetch(window.HFGB_ORDER.apiBase + '/api' + path, init);
  const j = await r.json().catch(() => ({ error: 'Bad response' }));
  if (!r.ok) { const e = new Error(j.error || 'Request failed'); e.status = r.status; e.code = j.code; throw e; }
  return j;
}
export const money = c => '$' + (c / 100).toFixed(2);
export const fmtPhone = d => d && d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : (d || '');
export const digits = s => String(s || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '').slice(0, 10);
export const fmtTime = (t, tz = 'America/Chicago') => new Date(t).toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' });
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
