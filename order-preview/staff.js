// Staff screen: polls the backend, chimes and flashes until each new order is accepted.
import { api, isDemo, money, fmtPhone, fmtTime, esc } from './api.js';
const $ = s => document.querySelector(s);
let key = localStorage.getItem('hfgb_staff_key') || (isDemo() ? 'demo' : ''), ctx = null, chimeT = null, seen = null, data = null, lastOk = 0;
const H = () => ({ 'x-staff-key': key });
$('#key').value = key;
function chime() {
  if (!ctx) return;
  [0, 0.18, 0.36].forEach((t, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = [880, 1175, 1568][i];
    g.gain.setValueAtTime(0.0001, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.6, ctx.currentTime + t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.3);
    o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.32); });
}
$('#start').addEventListener('click', async () => {
  key = $('#key').value.trim();
  try { await api('/staff/orders', { headers: H() }); } catch (e) { $('#keyErr').classList.remove('hidden'); return; }
  localStorage.setItem('hfgb_staff_key', key);
  try { ctx = new (window.AudioContext || window.webkitAudioContext)(); chime(); } catch {}
  try { await navigator.wakeLock?.request('screen'); } catch {}
  $('#gate').classList.add('hidden'); poll(); setInterval(poll, 4000);
});
async function poll() {
  try { data = await api('/staff/orders', { headers: H() }); lastOk = Date.now(); render(); }
  catch (e) { $('#conn').textContent = 'Offline, retrying'; $('#conn').className = 'pill bad'; }
}
function tix(o) {
  const items = o.items.map(i => `<li><b>${i.qty}&times;</b><span>${esc(i.name)}${i.note ? ` <small>${esc(i.note)}</small>` : ''}</span></li>`).join('');
  let act = '';
  if (o.status === 'new') act = `<span class="lbl">Accept, ready in:</span>${[10, 15, 20, 30].map(m => `<button class="st-btn st-btn--go" data-a="accept" data-id="${o.id}" data-min="${m}">${m} min</button>`).join('')}`;
  if (o.status === 'making') act = `<span class="lbl">Promised ${fmtTime(o.readyAt)}</span><button class="st-btn st-btn--ready" data-a="ready" data-id="${o.id}">Mark Ready</button>`;
  if (o.status === 'ready') act = `<span class="lbl">Ready since ${fmtTime(o.readyTs)}</span><button class="st-btn st-btn--done" data-a="picked" data-id="${o.id}">Picked Up</button>`;
  const pr = o.print ? (o.print.ok ? 'Ticket sent to Clover printer' : 'Clover print failed: read it here') : '';
  return `<div class="tix ${o.status === 'new' ? 'tix--new' : ''}"><div class="tix__top"><span class="tix__num">#${o.no}</span><span class="tix__name">${esc(o.name)}</span><span class="tix__when">${o.asap ? 'ASAP' : 'At ' + fmtTime(o.slot)}</span></div>
    <ul>${items}</ul>${o.notes ? `<div class="tix__notes">${esc(o.notes)}</div>` : ''}
    <div class="tix__meta"><span>${fmtPhone(o.phone)} · in ${fmtTime(o.created)}</span><span>Paid ${money(o.total)}</span></div>
    <div class="tix__print">${pr}${o.repeat ? ' · Repeat customer' : ' · First online order'}</div><div class="tix__act">${act}</div></div>`;
}
function render() {
  const now = data.now, list = data.orders.filter(o => !['picked', 'cancelled', 'failed'].includes(o.status));
  const cols = { new: [], making: [], ready: [] }; list.forEach(o => cols[o.status] && cols[o.status].push(o));
  for (const [k, c, n] of [['new', 'colNew', 'nNew'], ['making', 'colMaking', 'nMaking'], ['ready', 'colReady', 'nReady']]) {
    $('#' + c).innerHTML = cols[k].map(tix).join('') || '<div class="empty">None right now</div>'; $('#' + n).textContent = cols[k].length; }
  const nNew = cols.new.length; $('#alert').classList.toggle('hidden', !nNew);
  $('#alertTxt').textContent = nNew === 1 ? `New order #${cols.new[0].no} from ${cols.new[0].name}!` : `${nNew} new orders!`;
  clearInterval(chimeT); if (nNew) chimeT = setInterval(chime, 8000);
  const ids = new Set(data.orders.map(o => o.id)); if (seen) { for (const id of ids) if (!seen.has(id)) { chime(); break; } } seen = ids;
  $('#conn').textContent = 'Live'; $('#conn').className = 'pill ok';
  const s = data.schedule; $('#schedTxt').textContent = data.paused ? 'Online orders PAUSED' : s.open ? `Taking orders · next pickup ${s.asap?.label || '-'} · max ${s.cap} per 15 min` : 'Not taking online orders right now';
  $('#pause').checked = !!data.paused;
  $('#clock').textContent = fmtTime(now);
  if (!$('#soldDrawer').classList.contains('hidden')) renderSold();
}
document.addEventListener('click', async e => {
  const b = e.target.closest('button[data-a]'); if (!b) return; b.disabled = true;
  try { await api('/staff/order/' + b.dataset.id, { method: 'POST', headers: H(), body: { action: b.dataset.a, minutes: +b.dataset.min || undefined } }); } catch (er) { alert(er.message); }
  poll();
});
$('#pause').addEventListener('change', async e => { if (e.target.checked && !confirm('Pause online orders? Customers will see "paused, please call the bar".')) { e.target.checked = false; return; }
  await api('/staff/pause', { method: 'POST', headers: H(), body: { paused: e.target.checked } }); poll(); });
function renderSold() {
  const G = ['Flatbreads', 'Wings', 'Burgers', 'Front 9', 'Sweets', 'More Food', 'Pop'];
  $('#soldList').innerHTML = [...data.menu].sort((a, b) => G.indexOf(a.group) - G.indexOf(b.group) || a.name.localeCompare(b.name)).map(i => `<div class="so ${i.soldOut ? 'out' : ''}"><span>${esc(i.name)} ${i.note ? `<small>${esc(i.note)}</small>` : ''}</span>
    <button class="st-btn ${i.soldOut ? 'st-btn--x' : 'st-btn--ghost'}" data-so="${i.id}" data-v="${i.soldOut ? 0 : 1}">${i.soldOut ? 'Sold out' : 'Available'}</button></div>`).join('');
}
$('#soldBtn').addEventListener('click', () => { if (!data) return; renderSold(); $('#soldDrawer').classList.remove('hidden'); });
$('#soldClose').addEventListener('click', () => $('#soldDrawer').classList.add('hidden'));
$('#soldList').addEventListener('click', async e => { const b = e.target.closest('button[data-so]'); if (!b) return; b.disabled = true;
  await api('/staff/soldout', { method: 'POST', headers: H(), body: { id: b.dataset.so, soldOut: b.dataset.v === '1' } }); await poll(); renderSold(); });
setInterval(() => { if (lastOk && Date.now() - lastOk > 15000) { $('#conn').textContent = 'Offline, retrying'; $('#conn').className = 'pill bad'; } }, 5000);
