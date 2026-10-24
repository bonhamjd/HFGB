// Home preview v2: menu straight from the ordering Worker (same Clover data the order page uses), so prices match Clover.
(() => {
  const API = 'https://hfgb-orders.highflyersgolfbar.workers.dev/api';
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = c => '$' + (c % 100 ? (c / 100).toFixed(2) : String(c / 100));
  const note = n => (/^\d+$/.test(n || '') ? `Order of ${n}` : n);
  const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const SUB = { 'Front 9': 'To start, or to share' };

  const line = (name, price, note, out, cls = '') =>
    `<div class="mline${out ? ' out' : ''}${cls}"><div class="mline__top"><span class="mline__name">${esc(name)}</span><span class="mline__dots"></span>`
    + `<span class="mline__price">${money(price)}</span></div>${note ? `<div class="mline__note">${esc(note)}</div>` : ''}</div>`;

  function groupHtml(g) {
    let rows;
    if (g.name === 'Pop') {
      const by = new Map();
      g.items.filter(i => !i.soldOut).forEach(i => { if (!by.has(i.price)) by.set(i.price, []); by.get(i.price).push(i.name); });
      rows = [...by.entries()].sort((a, b) => a[0] - b[0]).map(([p, n]) => line(n.join(', '), p, '', false, ' mline--pop')).join('');
    } else {
      rows = g.items.map(i => line(i.name, i.price, [note(i.note), i.soldOut ? 'Sold out today' : ''].filter(Boolean).join(' · '), i.soldOut)).join('');
    }
    return `<section class="mgroup" id="m-${slug(g.name)}"><div class="mgroup__head"><h3>${esc(g.name)}</h3></div>`
      + `${SUB[g.name] ? `<p class="mgroup__sub">${SUB[g.name]}</p>` : ''}${rows}</section>`;
  }
  function render(d) {
    const groups = (d.groups || []).filter(g => g.items && g.items.length);
    if (!groups.length) throw new Error('empty menu');
    $('#tabs').innerHTML = groups.map(g => `<a href="#m-${slug(g.name)}">${esc(g.name)}</a>`).join('');
    const html = groups.map(groupHtml);
    // pizza photo after the first group breaks up the list on a phone
    html.splice(1, 0, '<div class="hp-photo"><img src="pizza.webp" width="900" height="1164" alt="A High Flyers flatbread" loading="lazy"></div>');
    $('#menuList').innerHTML = html.join('');
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
  // Sticky order button: hidden while a big order button is on screen, shown otherwise (after the hero).
  const sticky = $('#sticky'), watched = [...document.querySelectorAll('.hp-cta,.hp-wide')], seen = new Set();
  if (sticky && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => {
      es.forEach(e => e.isIntersecting ? seen.add(e.target) : seen.delete(e.target));
      const pastHero = $('.hp-cta').getBoundingClientRect().bottom < 0;
      sticky.classList.toggle('away', seen.size > 0 || !pastHero);
    });
    watched.forEach(w => io.observe(w));
    addEventListener('scroll', () => { const past = $('.hp-cta').getBoundingClientRect().bottom < 0; sticky.classList.toggle('away', seen.size > 0 || !past); }, { passive: true });
  }
  load();
})();
