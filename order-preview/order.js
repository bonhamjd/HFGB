// High Flyers online ordering: menu, cart, checkout, pay, confirmation. Prices and availability come from the backend (Clover).
import { api, isDemo, money, fmtPhone, digits, fmtTime, esc } from './api.js';
import { cartTax } from './engine/tax.js?v=3';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const LS = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set: (k, v) => localStorage.setItem(k, JSON.stringify(v)), del: k => localStorage.removeItem(k) };
const UPSELL_GROUPS = ['Front 9', 'Sweets', 'Pop'];
let CFG, MENU, SCHED, ITEMS = {}, cart = LS.get('hfgb_cart', {}), me = null, when = 'asap';
const ups = { shown: new Set(), added: new Set(), dismissed: new Set(), chipFor: null, cartDone: false };
let testCard = 'approve', cloverSdk = null, idem = null, busy = false;

function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 1400); }
const device = () => LS.get('hfgb_device', null);

async function boot() {
  try {
    [CFG, MENU] = await Promise.all([api('/config'), api('/menu')]);
  } catch (e) { $('#statusTxt').textContent = 'Online ordering is not available right now. Please call (402) 923-0160.'; return; }
  SCHED = MENU.schedule;
  MENU.groups.forEach(g => g.items.forEach(i => ITEMS[i.id] = { ...i, group: g.name }));
  Object.keys(cart).forEach(k => { if (!ITEMS[k] || ITEMS[k].soldOut) delete cart[k]; }); saveCart();
  if (CFG.mode !== 'production') { const s = $('#envStrip'); s.textContent = window.HFGB_ORDER.label || ('Test mode: ' + CFG.mode); s.classList.remove('hidden'); }
  renderStatus(); renderMenu(); renderCartBar();
  const d = device();
  if (d) { try { const r = await api('/me', { method: 'POST', body: d }); if (r.known) me = { ...r, phone: d.phone }; } catch {} }
  renderWelcome(); route();
  setInterval(refreshSchedule, 60000);
}
async function refreshPrices() { try { const m = await api('/menu'); MENU = m; SCHED = m.schedule; m.groups.forEach(g => g.items.forEach(i => { if (ITEMS[i.id]) Object.assign(ITEMS[i.id], { price: i.price, taxRates: i.taxRates, soldOut: i.soldOut }); })); Object.keys(ITEMS).forEach(refreshRow); if (view() === 'checkout') renderCheckout(); } catch {} }
async function refreshSchedule() { try { const m = await api('/menu'); SCHED = m.schedule; m.groups.forEach(g => g.items.forEach(i => { if (ITEMS[i.id]) ITEMS[i.id].soldOut = i.soldOut; })); renderStatus(); if (view() === 'checkout') renderCheckout(); } catch {} }
function statusText(s) {
  if (s.open) return `Open for pickup today. Ready in about ${s.prepMin} min.`;
  return { not_yet: `Online ordering opens at ${s.opensLabel}. First pickup ${s.firstPickupLabel}.`, done_for_day: `Online orders are done for today (they stop at ${s.lastOrderLabel}). Come see us at the bar!`,
    closed_today: 'Online ordering is closed today.', paused: 'Online ordering is paused for a bit. Please call the bar.', full: 'All pickup times are full for today. Please call the bar.' }[s.reason] || 'Online ordering is closed.';
}
function renderStatus() { $('#statusTxt').textContent = statusText(SCHED); $('#statusLine').classList.toggle('closed', !SCHED.open); }

// ---------- menu ----------
function renderMenu() {
  $('#tabs').innerHTML = MENU.groups.map((g, i) => `<a href="#g-${i}" data-g="${i}" class="${i ? '' : 'on'}">${esc(g.name)}</a>`).join('');
  $('#menuList').innerHTML = MENU.groups.map((g, i) => `<div class="cat" id="g-${i}"><div class="cat__head"><span class="cat__title">${esc(g.name)}</span><img src="/assets/logo-color.png" alt=""></div>
    <div class="cat__body">${g.items.map(it => `<div class="item-wrap" data-wrap="${it.id}">${rowHTML(it.id)}</div>`).join('')}</div></div>`).join('');
  $$('.tabs a').forEach(a => a.addEventListener('click', e => { e.preventDefault(); const el = document.getElementById('g-' + a.dataset.g); window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - 140, behavior: 'smooth' }); setTab(a.dataset.g); }));
  $('#menuList').addEventListener('click', onMenuClick);
  window.addEventListener('scroll', spy, { passive: true });
}
function rowHTML(id) {
  const i = ITEMS[id], q = cart[id] || 0;
  const ctl = i.soldOut ? '<span class="sold-tag">Sold out</span>' : q ? `<div class="qty"><button data-act="dec" data-id="${id}" aria-label="Remove one">&minus;</button><span>${q}</span><button data-act="inc" data-id="${id}" aria-label="Add one">+</button></div>`
    : `<button class="add" data-act="add" data-id="${id}" aria-label="Add ${esc(i.name)}">+</button>`;
  return `<div class="item ${i.soldOut ? 'item--sold' : ''}"><div class="item__main"><div class="item__name">${esc(i.name)}</div>${i.note ? `<div class="item__note">${esc(i.note)}</div>` : ''}</div>
    <div class="item__price">${money(i.price)}</div>${ctl}</div>${ups.chipFor === id ? chipHTML(id) : ''}`;
}
function refreshRow(id) { const w = document.querySelector(`[data-wrap="${id}"]`); if (w) w.innerHTML = rowHTML(id); }
function onMenuClick(e) {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.ups) { addUpsell(b.dataset.ups, b.dataset.from); return; }
  if (b.dataset.upsx) { ups.dismissed.add(b.dataset.upsx); const f = ups.chipFor; ups.chipFor = null; refreshRow(f); return; }
  const id = b.dataset.id, act = b.dataset.act; if (!id || !act) return;
  const was = cart[id] || 0; cart[id] = was + (act === 'dec' ? -1 : 1); if (cart[id] <= 0) delete cart[id];
  saveCart();
  if (act === 'add') { toast('Added ' + ITEMS[id].name); maybeChip(id); }
  refreshRow(id); renderCartBar(true);
}
// one gentle suggestion: shown under the item you just added, based on what people order together at the bar
function pickPair(fromIds) {
  const score = {};
  for (const f of fromIds) (MENU.pairs[f] || []).forEach((p, rank) => { if (!cart[p] && ITEMS[p] && !ITEMS[p].soldOut && !ups.dismissed.has(p) && UPSELL_GROUPS.includes(ITEMS[p].group)) score[p] = (score[p] || 0) + (5 - rank); });
  return Object.entries(score).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}
function maybeChip(id) {
  if (UPSELL_GROUPS.includes(ITEMS[id].group) || ups.shown.size >= 3) return;
  const p = pickPair([id]); if (!p) return;
  const prev = ups.chipFor; ups.chipFor = id; ups.shown.add(p); ups.chipPick = p; if (prev && prev !== id) refreshRow(prev);
}
function chipHTML(from) {
  const p = ups.chipPick; if (!p || cart[p]) return '';
  return `<div class="ups" role="note"><div class="ups__txt">Goes great with <b>${esc(ITEMS[p].name)}</b>${ITEMS[p].note ? ` <small>${esc(ITEMS[p].note)} · ${money(ITEMS[p].price)}</small>` : ` <small>${money(ITEMS[p].price)}</small>`}</div>
    <button class="ups__add" data-ups="${p}" data-from="${from}">+ Add</button><button class="ups__x" data-upsx="${p}" aria-label="No thanks">&times;</button></div>`;
}
function addUpsell(p, from) {
  cart[p] = (cart[p] || 0) + 1; ups.added.add(p); if (from === 'cart') ups.cartDone = true; saveCart(); toast('Added ' + ITEMS[p].name);
  if (from && from !== 'cart') { ups.chipFor = null; refreshRow(from); }
  refreshRow(p); renderCartBar(true); if (view() === 'checkout') renderCheckout();
}
function setTab(g) { $$('.tabs a').forEach(a => a.classList.toggle('on', a.dataset.g === String(g))); const on = $('.tabs a.on'); if (on) on.scrollIntoView({ inline: 'center', block: 'nearest' }); }
let spyT; function spy() { clearTimeout(spyT); spyT = setTimeout(() => { let cur = 0; MENU.groups.forEach((g, i) => { const el = document.getElementById('g-' + i); if (el && el.getBoundingClientRect().top < 170) cur = i; }); setTab(cur); }, 60); }

// ---------- cart ----------
function saveCart() { LS.set('hfgb_cart', cart); }
// tax per item, the same way the Worker and Clover do it (pop is not taxed, food is)
function sums() { let n = 0, sub = 0; const lines = []; for (const [id, q] of Object.entries(cart)) { n += q; sub += ITEMS[id].price * q; lines.push({ price: ITEMS[id].price, qty: q, taxRates: ITEMS[id].taxRates || [] }); } const tax = cartTax(lines); return { n, sub, tax, total: sub + tax }; }
function renderCartBar(bump) {
  const s = sums(), bar = $('#cartbar'); $('#cartCount').textContent = s.n; $('#cartAmt').textContent = money(s.sub);
  bar.classList.toggle('hidden', !s.n || view() !== 'menu');
  if (bump) { bar.classList.remove('bump'); void bar.offsetWidth; bar.classList.add('bump'); }
}
$('#cartBtn').addEventListener('click', () => go('checkout'));

// ---------- welcome / reorder ----------
const usualText = u => u.filter(x => ITEMS[x.id]).map(x => `${x.qty > 1 ? x.qty + '&times; ' : ''}${esc(ITEMS[x.id].name)}${ITEMS[x.id].note ? ' (' + esc(ITEMS[x.id].note) + ')' : ''}`).join(', ');
function renderWelcome() {
  const w = $('#welcome'); if (!me || !me.known) { w.classList.add('hidden'); return; }
  const u = (me.usual || []).filter(x => ITEMS[x.id] && !ITEMS[x.id].soldOut);
  $('#welcomeName').textContent = 'Hey, ' + me.firstName + '!';
  $('#welcomeUsual').innerHTML = u.length ? 'Your usual: ' + usualText(u) : '';
  $('#welcomeCard').classList.add('hidden');
  $('#reorderBtn').classList.toggle('hidden', !u.length); w.classList.remove('hidden');
}
$('#reorderBtn').addEventListener('click', () => {
  cart = {}; (me.usual || []).forEach(x => { if (ITEMS[x.id] && !ITEMS[x.id].soldOut) cart[x.id] = x.qty; }); saveCart();
  Object.keys(ITEMS).forEach(refreshRow); ups.cartDone = true; go('checkout');
});
$('#notYou').addEventListener('click', () => { LS.del('hfgb_device'); me = null; $('#phone').value = ''; $('#name').value = ''; renderWelcome(); });

// ---------- checkout ----------
function lineHTML(id, q) { const i = ITEMS[id]; return `<div class="line"><div class="line__name">${esc(i.name)}${i.note ? `<small>${esc(i.note)}</small>` : ''}</div>
  <div class="qty"><button data-act="dec" data-id="${id}" aria-label="Remove one">&minus;</button><span>${q}</span><button data-act="inc" data-id="${id}" aria-label="Add one">+</button></div><div class="line__amt">${money(i.price * q)}</div></div>`; }
function cartUpsell() {
  if (ups.cartDone) return '';
  let p = ups.cartPick && !cart[ups.cartPick] && !ups.dismissed.has(ups.cartPick) ? ups.cartPick : pickPair(Object.keys(cart));
  if (!p) { const sweet = Object.values(ITEMS).find(i => i.group === 'Sweets' && !i.soldOut && !cart[i.id] && !ups.dismissed.has(i.id)); p = sweet && sweet.id; }
  if (!p) return ''; ups.cartPick = p; ups.shown.add(p);
  return `<div class="ups"><div class="ups__txt">Add <b>${esc(ITEMS[p].name)}</b>? <small>${ITEMS[p].note ? esc(ITEMS[p].note) + ' · ' : ''}${money(ITEMS[p].price)}</small></div><button class="ups__add" data-ups="${p}" data-from="cart">+ Add</button><button class="ups__x" data-upsx="${p}" aria-label="No thanks">&times;</button></div>`;
}
function renderCheckout() {
  const ids = Object.keys(cart); if (!ids.length) { go('menu'); return; }
  $('#cartLines').innerHTML = ids.map(id => lineHTML(id, cart[id])).join('') + cartUpsell();
  const s = sums();
  $('#totals').innerHTML = `<div class="trow"><span>Subtotal</span><span>${money(s.sub)}</span></div><div class="trow"><span>Tax</span><span>${money(s.tax)}</span></div><div class="trow trow--big"><span>Total</span><span>${money(s.total)}</span></div>`;
  // pickup
  const asapBtn = $('#whenSeg [data-when="asap"]'), sel = $('#pickupTime'), keep = sel.value;
  sel.innerHTML = SCHED.slots.map(x => `<option value="${x.t}" ${x.left < 1 ? 'disabled' : ''}>${x.label}${x.left < 1 ? ' (full)' : ''}</option>`).join('');
  if (keep) sel.value = keep;
  if (SCHED.asap) { asapBtn.disabled = false; $('#asapTime').textContent = 'about ' + fmtTime(SCHED.asap.readyAt); } else { asapBtn.disabled = true; $('#asapTime').textContent = 'n/a'; if (when === 'asap' && SCHED.slots.length) setWhen('later'); }
  const cb = $('#closedBox'); cb.classList.toggle('hidden', SCHED.open); cb.textContent = statusText(SCHED);
  // who
  const d = device();
  if (!$('#phone').value && (me?.phone || d?.phone)) $('#phone').value = fmtPhone(me?.phone || d.phone);
  if (!$('#name').value && me?.firstName) $('#name').value = me.firstName;
  if (me?.firstName && digits($('#phone').value) === me.phone) { $('#phoneHint').textContent = 'Welcome back, ' + me.firstName + '!'; $('#phoneHint').classList.add('ok'); }
  if (!idem) idem = 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  renderPay();
}
$('#cartLines').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.ups) { addUpsell(b.dataset.ups, 'cart'); return; }
  if (b.dataset.upsx) { ups.dismissed.add(b.dataset.upsx); ups.cartDone = true; renderCheckout(); return; }
  const id = b.dataset.id; if (!id) return; cart[id] = (cart[id] || 0) + (b.dataset.act === 'inc' ? 1 : -1); if (cart[id] <= 0) delete cart[id];
  saveCart(); refreshRow(id); renderCartBar(); renderCheckout();
});
function setWhen(w) { when = w; $$('#whenSeg button').forEach(x => x.classList.toggle('on', x.dataset.when === w)); $('#pickupTime').classList.toggle('hidden', w !== 'later'); }
$('#whenSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (b && !b.disabled) setWhen(b.dataset.when); });
$('#noteLink').addEventListener('click', () => { $('#noteField').classList.remove('hidden'); $('#noteLink').classList.add('hidden'); $('#notes').focus(); });
let lookT; $('#phone').addEventListener('input', e => {
  const d = digits(e.target.value); if (d.length === 10) e.target.value = fmtPhone(d);
  clearTimeout(lookT); const h = $('#phoneHint');
  if (d.length !== 10) { h.textContent = "We'll remember you next time."; h.classList.remove('ok'); return; }
  lookT = setTimeout(async () => {
    try { const r = await api('/customer/lookup', { method: 'POST', body: { phone: d, deviceToken: device()?.phone === d ? device().deviceToken : undefined } });
      if (r.known) { if (!$('#name').value) $('#name').value = r.firstName; h.textContent = 'Welcome back, ' + r.firstName + '!'; h.classList.add('ok'); lockApple(); }
      else { h.textContent = "We'll remember you next time."; h.classList.remove('ok'); } } catch {}
  }, 250);
});

// ---------- payment ----------
const payLabel = () => `Pay ${money(sums().total || 0)}`;
const liveCards = () => CFG.mode !== 'mock' && CFG.ecomPublic && CFG.sdk;
const payOff = () => CFG.paymentsEnabled === false;
// Clover's iframe Apple Pay needs real Safari (17.5+). iOS Chrome/Firefox/Edge/Opera/Google app and in-app browsers close the sheet.
const realSafari = () => { const ua = navigator.userAgent || '';
  return /Safari\//.test(ua) && /Apple/.test(navigator.vendor || '') && !/CriOS|FxiOS|EdgiOS|EdgA|OPiOS|OPT\/|GSA\/|YaBrowser|DuckDuckGo|Brave|FBAN|FBAV|Instagram|Snapchat|Line\/|Twitter|LinkedInApp|Pinterest|TikTok|musical_ly|Messenger|wv\)|Chrome\/|Chromium|Android/i.test(ua); };
const appleOk = () => { try { return realSafari() && !!(window.ApplePaySession && window.ApplePaySession.canMakePayments()); } catch { return false; } };
const contactOk = () => digits($('#phone')?.value) .length === 10 && !!($('#name')?.value || '').trim();
function lockApple() { const w = $('#applePayWrap'); if (!w) return; const ok = contactOk(); w.classList.toggle('locked', !ok); $('#appleHint')?.classList.toggle('hidden', ok); }
document.addEventListener('input', e => { if (e.target && (e.target.id === 'phone' || e.target.id === 'name')) lockApple(); });
function renderPay() {
  const box = $('#payBox'), s = sums();
  let h = '<span class="flabel">Payment</span>';
  if (payOff()) { box.innerHTML = h + '<p class="testnote">Online payments are not turned on yet. This is a preview. Please call the bar at (402) 923-0160 to order.</p>'; $('#payBtn').textContent = 'Payments off (preview)'; $('#payBtn').disabled = true; return; }
  if (liveCards() && box.querySelector('#cfNum iframe')) { // card boxes already up: never wipe what the customer typed
    if (box.dataset.total !== String(s.total) && $('#applePayBtn')) { try { cloverSdk.updateApplePaymentRequest({ amount: s.total, countryCode: 'US', currencyCode: 'USD' }); } catch {} }
    box.dataset.total = String(s.total); $('#payBtn').textContent = payLabel(); $('#payBtn').disabled = !SCHED.open || busy; lockApple(); return;
  }
  box.dataset.total = String(s.total);
  {
    if (liveCards() && appleOk()) h += '<div id="applePayWrap" class="applewrap locked"><div id="applePayBtn" class="applepay"></div></div><p class="testnote" id="appleHint">Add your phone and name above to use Apple Pay.</p><div class="paysep">or pay with card</div>';
    if (liveCards()) h += `<div class="cf"><div class="fld" id="cfNum"></div><div class="row"><div class="fld" id="cfDate"></div><div class="fld" id="cfCvv"></div><div class="fld" id="cfZip"></div></div><div class="err" id="cfErr"></div></div>`;
    else h += `<div class="testcards" id="testCards">
      <button type="button" data-tc="approve" class="${testCard === 'approve' ? 'on' : ''}"><span>&#128179;</span><span>Test Visa ending 4242<small>Approves</small></span></button>
      <button type="button" data-tc="decline" class="${testCard === 'decline' ? 'on' : ''}"><span>&#128179;</span><span>Test Visa ending 0002<small>Declines, to test the error</small></span></button></div>
      <p class="testnote">Test mode. In the live version Clover's secure card box shows here, so card numbers never touch our site.</p>`;
    h += `<div class="field" id="emailField"><label for="email">Email for receipt (optional)</label><input id="email" type="email" autocomplete="email" inputmode="email" placeholder="you@example.com" value="${esc(LS.get('hfgb_email', ''))}"></div>`;
  }
  box.innerHTML = h;
  $('#payBtn').textContent = payLabel(); $('#payBtn').disabled = !SCHED.open || busy;
  $$('#testCards button').forEach(b => b.addEventListener('click', () => { testCard = b.dataset.tc; $$('#testCards button').forEach(x => x.classList.toggle('on', x === b)); }));
  if (liveCards()) mountClover().then(lockApple, () => {});
}
async function mountClover() { // Clover hosted iframe fields (Ecommerce public key). Card data goes straight to Clover.
  if (!window.Clover) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = CFG.sdk; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  cloverSdk = cloverSdk || new window.Clover(CFG.ecomPublic, { merchantId: CFG.mid });
  const el = cloverSdk.elements(), st = { body: { fontFamily: 'Barlow, sans-serif', fontSize: '17px' } };
  el.create('CARD_NUMBER', st).mount('#cfNum'); el.create('CARD_DATE', st).mount('#cfDate'); el.create('CARD_CVV', st).mount('#cfCvv'); el.create('CARD_POSTAL_CODE', st).mount('#cfZip');
  if ($('#applePayBtn')) {
    try {
      const req = cloverSdk.createApplePaymentRequest({ amount: sums().total, countryCode: 'US', currencyCode: 'USD' });
      el.create('PAYMENT_REQUEST_BUTTON_APPLE_PAY', { applePaymentRequest: req, sessionIdentifier: CFG.mid }).mount('#applePayBtn');
    } catch (e) { $('#applePayWrap')?.remove(); $('#appleHint')?.remove(); document.querySelector('.paysep')?.remove(); }
  }
}
async function getToken() {
  if (liveCards()) { const r = await cloverSdk.createToken(); if (r.errors) throw new Error(Object.values(r.errors).join(' ')); return { token: r.token, card: { brand: r.card?.brand, last4: r.card?.last4 } }; }
  const r = await api('/dev/tokenize', { method: 'POST', body: { number: testCard === 'approve' ? '4242424242424242' : '4000000000000002' } }); return r;
}
function err(m) { const e = $('#coErr'); e.textContent = m; e.classList.toggle('hidden', !m); if (m) e.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
$('#payBtn').addEventListener('click', () => submitOrder(null));
// wallet = { token, card } from Apple Pay (Clover iframe); null = Pay button. Returns true when the order is paid.
async function submitOrder(wallet) {
  if (busy || payOff()) return false; err('');
  const phone = digits($('#phone').value), name = $('#name').value.trim(), email = ($('#email')?.value || '').trim();
  if (phone.length !== 10) { err('Please enter your 10 digit phone number' + (wallet ? ', then tap Apple Pay again.' : '.')); return false; }
  if (!name) { err('Please add a name for the order' + (wallet ? ', then tap Apple Pay again.' : '.')); return false; }
  if (email && !/^\S+@\S+\.\S+$/.test(email)) { err('That email doesn\'t look right. Fix it or leave it blank.'); return false; }
  const slot = when === 'asap' ? 'asap' : $('#pickupTime').value;
  busy = true; idem = idem || ('i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)); const b = $('#payBtn'); b.disabled = true; b.textContent = 'Paying...';
  try {
    let payment;
    if (wallet) payment = { type: 'token', token: wallet.token, card: wallet.card };
    else { const t = await getToken(); payment = { type: 'token', token: t.token, card: t.card }; }
    if (email) LS.set('hfgb_email', email);
    const d = device();
    const r = await api('/order', { method: 'POST', body: { idem, items: Object.entries(cart).map(([id, qty]) => ({ id, qty })), phone, name, email: email || undefined, expectedTotal: sums().total,
      slot, notes: $('#notes').value, payment, deviceToken: d && d.phone === phone ? d.deviceToken : undefined, upsell: { shown: [...ups.shown], added: [...ups.added] } } });
    LS.set('hfgb_device', { phone, deviceToken: r.deviceToken, firstName: name });
    me = { known: true, firstName: name, phone, usual: me?.usual };
    LS.set('hfgb_last_order', { id: r.order.id, key: r.order.key });
    cart = {}; saveCart(); Object.keys(ITEMS).forEach(refreshRow); idem = null;
    ups.shown.clear(); ups.added.clear(); ups.cartDone = false; ups.cartPick = null;
    $('#payBox').innerHTML = ''; showDone(r.order); go('done');
    try { const m2 = await api('/me', { method: 'POST', body: device() }); if (m2.known) me = { ...m2, phone }; } catch {}
    return true;
  } catch (e) {
    err(e.message || 'Something went wrong. Nothing was charged.');
    if (['slot', 'slot_full', 'sold_out'].includes(e.code)) refreshSchedule();
    if (e.code === 'declined') idem = null;
    if (e.code === 'price_changed') { idem = null; refreshPrices(); }
    return false;
  } finally { busy = false; b.disabled = !SCHED.open || payOff(); b.textContent = payOff() ? 'Payments off (preview)' : payLabel(); }
}
// Apple Pay (Clover iframe). Only on Safari/Apple devices that can pay; the card form stays as the fallback.
window.addEventListener('paymentMethod', async ev => {
  const t = ev?.detail?.tokenRecieved; if (!t?.id) { try { cloverSdk.updateApplePaymentStatus('failed'); } catch {} return; }
  const ok = await submitOrder({ token: t.id, card: { brand: 'Apple Pay', last4: t.wallet?.last4 || t.card?.last4 || '' } });
  try { cloverSdk.updateApplePaymentStatus(ok ? 'success' : 'failed'); } catch {}
});
window.addEventListener('paymentMethodEnd', ev => { const d = ev?.detail || {}; if (d.status && d.status !== 'success') console.log('Apple Pay ended:', d.status, d.eventMessage || ''); });

// ---------- confirmation ----------
let pollT;
function showDone(o) {
  $('#doneNum').textContent = '#' + o.no; $('#doneSub').textContent = `Thanks, ${o.name}! Paid ${money(o.total)} with ${o.payment.brand} ending ${o.payment.last4}.`;
  $('#doneLines').innerHTML = o.items.map(l => `<div class="line"><div class="line__name">${esc(l.name)}${l.note ? `<small>${esc(l.note)}</small>` : ''}</div><span>&times;${l.qty}</span><div class="line__amt">${money(l.price * l.qty)}</div></div>`).join('');
  $('#doneDemo').classList.toggle('hidden', CFG.mode === 'production');
  status(o); clearInterval(pollT);
  pollT = setInterval(async () => { const lo = LS.get('hfgb_last_order'); if (!lo || view() !== 'done') return; try { status(await api(`/order/${lo.id}?k=${lo.key}`)); } catch {} }, 8000);
}
function status(o) {
  const st = { new: ['Order received', 1, `Ready about ${fmtTime(o.readyAt)}`], making: ['The kitchen has it', 2, `Ready at ${fmtTime(o.readyAt)}`], ready: ['Ready for pickup!', 3, 'Come on in, it is at the bar.'],
    picked: ['Picked up. Enjoy!', 3, ''], cancelled: ['Cancelled', 0, 'Please call the bar at (402) 923-0160.'] }[o.status] || ['Order received', 1, ''];
  $('#doneStatus').textContent = st[0]; $('#doneReady').innerHTML = st[2].replace(/(\d+:\d+ [AP]M)/, '<b>$1</b>');
  $$('#doneTrack span').forEach((s, i) => s.classList.toggle('on', i < st[1]));
}
$('#newOrder').addEventListener('click', () => { renderWelcome(); go('menu'); window.scrollTo(0, 0); });

// ---------- routing ----------
const VIEWS = ['menu', 'checkout', 'done'];
const view = () => { const h = location.hash.slice(1); return VIEWS.includes(h) ? h : 'menu'; };
function go(v) { if (location.hash !== '#' + v) location.hash = v; else route(); }
async function route() {
  if (!MENU) return; let v = view();
  if (v === 'done') { const lo = LS.get('hfgb_last_order'); if (!lo) v = 'menu'; else if (!$('#doneNum').textContent) { try { showDone(await api(`/order/${lo.id}?k=${lo.key}`)); } catch { v = 'menu'; } } }
  VIEWS.forEach(x => $('#v-' + x).classList.toggle('hidden', x !== v));
  if (v === 'checkout') renderCheckout();
  if (v !== 'menu') window.scrollTo(0, 0);
  renderCartBar();
}
window.addEventListener('hashchange', route);
$$('[data-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.go)));
boot();
