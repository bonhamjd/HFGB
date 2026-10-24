// Owner dashboard: online sales, orders, average ticket, top items, new vs repeat, by hour/day, upsell take rate.
import { api, isDemo, money, fmtPhone, fmtTime, esc } from './api.js';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
let key = localStorage.getItem('hfgb_admin_key') || (isDemo() ? 'demo' : ''), tab = 'overview';
const H = () => ({ 'x-admin-key': key });
async function start() { try { await api('/admin/settings', { headers: H() }); $('#loginView').classList.add('hidden'); $('#appView').classList.remove('hidden'); show(); } catch { $('#loginView').classList.remove('hidden'); $('#appView').classList.add('hidden'); } }
$('#loginBtn').addEventListener('click', () => { key = $('#akey').value.trim(); localStorage.setItem('hfgb_admin_key', key); start().then(() => { if (!$('#appView').classList.contains('hidden')) return; $('#loginErr').textContent = "That key didn't work."; }); });
$('#logout').addEventListener('click', () => { localStorage.removeItem('hfgb_admin_key'); key = ''; start(); });
$$('[data-tab]').forEach(b => b.addEventListener('click', () => { tab = b.dataset.tab; $$('[data-tab]').forEach(x => x.setAttribute('aria-selected', x === b)); show(); }));
$('#range').addEventListener('change', show);
const R = () => $('#range').value, rangeTxt = () => $('#range').selectedOptions[0].textContent;
const pct = x => Math.round(x * 100) + '%';
const stat = (l, v, n) => `<div class="stat"><div class="s-label">${l}</div><div class="s-val">${v}</div>${n ? `<div class="s-note">${n}</div>` : ''}</div>`;
const bars = (arr, lab, val) => { const mx = Math.max(1, ...arr.map(val)); return `<div class="bars">${arr.map(x => `<div class="b"><em>${val(x) || ''}</em><i style="height:${Math.round(val(x) / mx * 100)}%"></i>${lab(x)}</div>`).join('')}</div>`; };
const hr = h => (h % 12 || 12) + (h < 12 ? 'a' : 'p');
async function show() {
  const p = $('#panel'); p.innerHTML = '<p class="sub">Loading...</p>';
  try {
    if (tab === 'overview') {
      const s = await api('/admin/stats?range=' + R(), { headers: H() });
      p.innerHTML = `<h2>Overview</h2><p class="sub">${rangeTxt()} · paid online orders only${s.cancelled ? ` · ${s.cancelled} cancelled not counted` : ''}</p>
      <div class="stats">${stat('Online sales', money(s.sales), `${money(s.subtotal)} food + ${money(s.tax)} tax`)}${stat('Orders', s.orders)}${stat('Average ticket', money(s.avgTicket))}
      ${stat('Repeat customers', `${s.customers.repeat} of ${s.customers.total}`, `${s.customers.new} new · ${s.customers.repeatOrders} repeat orders`)}
      ${stat('Upsell take rate', pct(s.upsell.rate), `${s.upsell.ordersTook} of ${s.upsell.ordersShown} orders · ${money(s.upsell.revenue)} added`)}</div>
      <div class="grid2"><div class="panel"><h3>Orders by hour</h3>${bars(s.byHour, x => hr(x.h), x => x.n)}</div><div class="panel"><h3>Orders by day</h3>${bars(s.byDay, x => x.d, x => x.n)}</div></div>
      <div class="panel" style="margin-bottom:1.2rem"><h3>Daily online sales</h3>${s.byDate.length ? bars(s.byDate, x => x.date, x => Math.round(x.sales / 100)) : '<p class="fine">No orders yet.</p>'}</div>
      <h3 style="font-family:var(--font-label);text-transform:uppercase;letter-spacing:.12em;font-size:13px;margin:0 0 .5rem">Top items</h3>
      <div class="table-wrap"><table><thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Sales</th></tr></thead><tbody>${s.topItems.map(i => `<tr><td>${esc(i.name)}</td><td class="num">${i.qty}</td><td class="num">${money(i.revenue)}</td></tr>`).join('') || '<tr><td colspan="3">No orders yet</td></tr>'}</tbody></table></div>`;
    }
    if (tab === 'orders') {
      const os = await api('/admin/orders?range=' + R(), { headers: H() });
      p.innerHTML = `<h2>Orders</h2><p class="sub">${rangeTxt()} · newest first · refunds are done in Clover</p><div class="table-wrap"><table><thead><tr><th>#</th><th>When</th><th>Customer</th><th>Items</th><th>Pickup</th><th class="num">Total</th><th>Status</th><th>Clover</th></tr></thead><tbody>
      ${os.map(o => `<tr><td>${o.no}</td><td>${new Date(o.created).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'numeric', day: 'numeric' })} ${fmtTime(o.created)}</td><td>${esc(o.name)}<br><span class="fine">${fmtPhone(o.phone)}${o.repeat ? ' · repeat' : ' · new'}</span></td>
        <td>${o.items.map(l => `${l.qty > 1 ? l.qty + '&times; ' : ''}${esc(l.name)}${l.note ? ' (' + esc(l.note) + ')' : ''}`).join(', ')}${o.upsell?.added?.length ? ' <span class="tag g">upsell</span>' : ''}</td>
        <td>${esc(o.pickLabel)}</td><td class="num">${money(o.total)}</td><td><span class="tag ${o.status === 'cancelled' ? 'r' : o.status === 'picked' ? 'g' : ''}">${o.status}</span></td><td class="fine">${esc(o.cloverOrderId)}<br>${o.print?.ok ? 'printed' : 'print: ' + esc(o.print?.error || '-')}</td></tr>`).join('') || '<tr><td colspan="8">No orders in this range</td></tr>'}</tbody></table></div>`;
    }
    if (tab === 'menu') {
      const m = await api('/admin/menu', { headers: H() });
      p.innerHTML = `<h2>Online menu</h2><p class="sub">Names in Clover, prices from Clover (synced ${fmtTime(m.updated)}). Turn items on or off for online ordering. Alcohol, golf and gift cards are never offered online. Tax ${(m.taxRate * 100).toFixed(1)}%.</p>
      <p style="margin-bottom:1rem"><button class="btn btn--outline btn--sm" id="syncBtn">Sync from Clover now</button></p>
      <div class="table-wrap"><table><thead><tr><th>Online</th><th>Item (shown as)</th><th>Clover name</th><th>Group</th><th class="num">Price</th><th class="num">Sold, 90 days</th></tr></thead><tbody>
      ${m.items.sort((a, b) => a.group.localeCompare(b.group) || b.sales90 - a.sales90).map(i => `<tr><td><button class="tgl ${i.online ? 'on' : ''}" data-id="${i.id}" data-on="${i.online ? 0 : 1}">${i.online ? 'On' : 'Off'}</button></td><td>${esc(i.name)}${i.note ? ` <span class="fine">${esc(i.note)}</span>` : ''}${i.soldOut ? ' <span class="tag r">sold out</span>' : ''}</td><td class="fine">${esc(i.cloverName)}</td><td>${esc(i.group)}</td><td class="num">${money(i.price)}</td><td class="num">${i.sales90}</td></tr>`).join('')}</tbody></table></div>`;
      $('#syncBtn').addEventListener('click', async () => { await api('/admin/sync', { method: 'POST', headers: H() }); show(); });
      p.querySelectorAll('.tgl').forEach(b => b.addEventListener('click', async () => { await api('/admin/online', { method: 'POST', headers: H(), body: { id: b.dataset.id, online: b.dataset.on === '1' } }); show(); }));
    }
    if (tab === 'settings') {
      const c = await api('/admin/settings', { headers: H() });
      const row = (k, v) => `<dt>${k}</dt><dd>${v}</dd>`;
      p.innerHTML = `<h2>Settings</h2><p class="sub">Changed in the backend config (Cloudflare variables). Ask HFGB Bot to change any of these.</p><div class="panel"><dl class="kv">
      ${row('Clover mode', c.mode === 'production' ? 'LIVE (production)' : c.mode === 'sandbox' ? 'Clover sandbox (test)' : 'Mock Clover (test, no money)')}
      ${row('Online ordering hours', `Opens ${c.orderOpen}, first pickup ${c.firstPickup}, last order ${c.lastOrder}, last pickup ${c.lastPickup}`)}
      ${row('Closed days', (c.closedWeekdays.length ? c.closedWeekdays.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ') : 'None') + (c.closedDates.length ? ' · ' + c.closedDates.join(', ') : ''))}
      ${row('Max orders per 15 min', c.slotCap)}${row('Default prep time', c.prepMin + ' min')}
      ${row('Clover ticket printing', c.printEnabled ? 'On' : 'Off')}${row('Text backup to bar cell', c.smsEnabled ? 'On' : 'Off (needs Twilio, see GO_LIVE.md)')}
      ${row('Online categories', c.onlineCategories.join(', '))}${row('Clover order type', esc(c.orderTypeLabel) + (c.orderTypeId ? ' (' + esc(c.orderTypeId) + ')' : ' (not set)'))}
      ${row('Customers remembered', c.customers)}</dl></div>`;
    }
  } catch (e) { p.innerHTML = `<p class="sub">Could not load: ${esc(e.message)}</p>`; }
}
start();
