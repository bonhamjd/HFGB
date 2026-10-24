// Home preview: menu straight from the ordering Worker (same Clover data the order page uses), so prices match Clover.
(() => {
  const API = 'https://hfgb-orders.highflyersgolfbar.workers.dev/api';
  const ORDER = '/order-preview/';
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = c => '$' + (c / 100).toFixed(2);
  const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  function itemRow(i) {
    return `<div class="item${i.soldOut ? ' out' : ''}"><div class="item__main"><div class="item__name">${esc(i.name)}</div>`
      + `${i.note ? `<div class="item__note">${esc(i.note)}</div>` : ''}${i.soldOut ? '<div class="item__note">Sold out today</div>' : ''}</div>`
      + `<div class="item__price">${money(i.price)}</div></div>`;
  }
  // Pop: one row per price so the list stays short on a phone.
  function popRows(items) {
    const by = new Map();
    items.filter(i => !i.soldOut).forEach(i => { if (!by.has(i.price)) by.set(i.price, []); by.get(i.price).push(i.name); });
    return [...by.entries()].sort((a, b) => a[0] - b[0]).map(([p, names]) =>
      `<div class="item item--pop"><div class="item__main"><div class="item__name">${esc(names.join(', '))}</div></div><div class="item__price">${money(p)}</div></div>`).join('');
  }
  function render(data) {
    const groups = (data.groups || []).filter(g => g.items && g.items.length);
    if (!groups.length) throw new Error('empty menu');
    $('#tabs').innerHTML = groups.map((g, n) => `<a href="#c-${slug(g.name)}"${n ? '' : ' class="on"'}>${esc(g.name)}</a>`).join('');
    $('#menuList').innerHTML = groups.map(g => `<section class="cat" id="c-${slug(g.name)}"><div class="cat__head"><span class="cat__title">${esc(g.name)}</span>`
      + `<img src="/assets/logo-color.png" alt=""></div><div class="cat__body">${g.name === 'Pop' ? popRows(g.items) : g.items.map(itemRow).join('')}`
      + `<a class="cat__order" href="${ORDER}">Order ${esc(g.name)} for pickup &rarr;</a></div></section>`).join('');
    watchTabs();
  }
  function watchTabs() {
    const tabs = [...document.querySelectorAll('#tabs a')];
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      tabs.forEach(t => t.classList.toggle('on', t.getAttribute('href') === '#' + e.target.id));
      const on = tabs.find(t => t.classList.contains('on')); if (on) on.scrollIntoView({ block: 'nearest', inline: 'center' });
    }), { rootMargin: '-150px 0px -60% 0px' });
    document.querySelectorAll('.cat').forEach(c => io.observe(c));
  }
  function status(s) {
    if (!s) return;
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
  // Hide the sticky order bar while the big hero button is on screen.
  const bar = $('.hp-bar'), cta = $('.hp-cta');
  if (bar && cta && 'IntersectionObserver' in window) new IntersectionObserver(es => bar.classList.toggle('away', es[0].isIntersecting)).observe(cta);
  load();
})();
