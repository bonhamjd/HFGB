// Homepage: menu straight from the ordering Worker (same Clover data the order page uses), so prices match Clover.
// ONLINE ORDERING SWITCH: set ORDERING_LIVE to false to hide every Order Online button and show "coming soon" instead.
const ORDERING_LIVE = true;
const ORDER_URL = '/order/';
(() => {
  const API = 'https://hfgb-orders.highflyersgolfbar.workers.dev/api';
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = c => '$' + (c % 100 ? (c / 100).toFixed(2) : String(c / 100));
  const note = n => (/^\d+$/.test(n || '') ? `Order of ${n}` : n);
  const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const SUB = { 'Front 9': 'To start, or to share' };
  const LEFT = ['Flatbreads', 'Wings', 'Burgers']; // desktop left column; everything else goes right, with the order card

  // Apply the ordering switch to everything on the page (and to anything rendered later).
  function applyOrdering(root = document) {
    root.querySelectorAll('[data-order]').forEach(a => { if (ORDERING_LIVE) { a.href = ORDER_URL; a.classList.remove('hidden'); } else a.remove(); });
    root.querySelectorAll('[data-order-alt],[data-order-block]').forEach(e => e.classList.toggle('hidden', !ORDERING_LIVE));
    root.querySelectorAll('[data-soon]').forEach(e => ORDERING_LIVE ? e.remove() : e.classList.remove('hidden'));
  }

  const line = (name, price, nt, out, cls = '') =>
    `<div class="mline${out ? ' out' : ''}${cls}"><div class="mline__top"><span class="mline__name">${esc(name)}</span><span class="mline__dots"></span>`
    + `<span class="mline__price">${money(price)}</span></div>${nt ? `<div class="mline__note">${esc(nt)}</div>` : ''}</div>`;
  function groupHtml(g) {
    let rows;
    if (g.name === 'Pop') {
      const by = new Map();
      g.items.filter(i => !i.soldOut).forEach(i => { if (!by.has(i.price)) by.set(i.price, []); by.get(i.price).push(i.name); });
      rows = [...by.entries()].sort((a, b) => a[0] - b[0]).map(([p, n]) => line(n.join(', '), p, '', false, ' mline--pop')).join('');
    } else rows = g.items.map(i => line(i.name, i.price, [note(i.note), i.soldOut ? 'Sold out today' : ''].filter(Boolean).join(' · '), i.soldOut)).join('');
    return `<section class="mgroup" id="m-${slug(g.name)}"><div class="mgroup__head"><h3>${esc(g.name)}</h3></div>`
      + `${SUB[g.name] ? `<p class="mgroup__sub">${SUB[g.name]}</p>` : ''}${rows}</section>`;
  }
  const PHOTO = '<div class="hp-photo"><img src="assets/photos/pizza.webp" width="900" height="1164" alt="A High Flyers flatbread" loading="lazy"></div>';
  function render(d) {
    const groups = (d.groups || []).filter(g => g.items && g.items.length);
    if (!groups.length) throw new Error('empty menu');
    $('#tabs').innerHTML = groups.map(g => `<a href="#m-${slug(g.name)}">${esc(g.name)}</a>`).join('');
    const left = groups.filter(g => LEFT.includes(g.name)), right = groups.filter(g => !LEFT.includes(g.name));
    // Phone: one column, photo after Flatbreads. Desktop: two balanced columns, order card fills the right side.
    const L = left.map(groupHtml); L.splice(Math.min(1, L.length), 0, PHOTO);
    $('#menuList').innerHTML = `<div class="hp-col">${L.join('')}</div><div class="hp-col">${right.map(groupHtml).join('')}${$('#asideTpl').innerHTML}</div>`;
    applyOrdering($('#menuList'));
  }
  function status(s) {
    if (!s || !ORDERING_LIVE) return;
    const txt = s.open ? `Open for pickup now. Ready in about ${s.prepMin} min.`
      : ({ not_yet: `Online ordering opens at ${s.opensLabel} today.`, done_for_day: 'Online orders are done for today. Come see us at the bar!',
        closed_today: 'Online ordering is closed today.', paused: 'Online ordering is paused for a bit. Please call the bar.',
        full: 'All pickup times are full for today. Please call the bar.' })[s.reason] || '';
    if (!txt) return;
    $('#statusTxt').textContent = txt; $('#statusLine').classList.remove('hidden'); $('#statusLine').classList.toggle('closed', !s.open);
  }
  async function load() {
    try {
      const r = await fetch(API + '/menu', { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      render(d); status(d.schedule);
    } catch (e) {
      $('#tabs').classList.add('hidden');
      $('#menuList').innerHTML = '<div class="hp-err"><b>The menu did not load.</b> Please try again in a minute, or give us a call and we will read it to you.'
        + '<a class="btn btn--brass" href="tel:+14029230160">Call (402) 923-0160</a></div>';
    }
  }
  applyOrdering();
  // Sticky order button (only when ordering is live): shows after the hero, hides while another big order button is on screen.
  const sticky = $('#sticky');
  if (sticky && ORDERING_LIVE) {
    sticky.classList.remove('hidden');
    const heroBtn = $('.hp-hero [data-order]');
    const upd = () => {
      const past = heroBtn ? heroBtn.getBoundingClientRect().bottom < 0 : true;
      const card = $('.hp-aside [data-order]'), r = card && card.getBoundingClientRect();
      const cardOn = r && r.top < innerHeight && r.bottom > 0;
      sticky.classList.toggle('away', !past || !!cardOn);
    };
    addEventListener('scroll', upd, { passive: true }); addEventListener('resize', upd); upd();
  } else if (sticky) sticky.remove();
  load();
})();
