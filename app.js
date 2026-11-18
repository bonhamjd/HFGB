/* =========================================================================
   HIGH FLYERS GOLF BAR — app.js
   Small, dependency-free. Handles: mobile menu, drink filters, events view,
   and an OPTIONAL live Google Calendar sync (falls back to the list below).
   ========================================================================= */

/* -------------------------------------------------------------------------
   1) UPCOMING EVENTS — edit this list anytime (or wire up Google Calendar
      below to fill it automatically). Keep it short; past dates auto-hide
      once you set real years.
      month: 3-letter, day: number, title, time, note.
   ------------------------------------------------------------------------- */
// date: YYYY-MM-DD (Central). Past dates hide automatically via upcoming().
// Husker, Creighton, Humphrey school and big golf games come from /assets/games.json (built daily on the
// bot's box by website/games/build_site_games.py). This hand list adds the NFL and bar nights.
const EVENTS = [
  { date: '2026-11-25', title: 'Thanksgiving Eve',                  time: 'Wed', note: '' },
  { date: '2026-12-31', title: "New Year's Eve",                    time: 'Thu', note: '' },
  // NFL Sundays and Monday Night Football (2026 schedule, kickoff times Central)
  { date: '2026-10-25', title: 'NFL Sunday', time: 'Sun · Noon and 3 PM games · CBS / FOX', note: '' },
  { date: '2026-11-01', title: 'NFL Sunday', time: 'Sun · Noon and 3 PM games · CBS / FOX', note: '' },
  { date: '2026-11-08', title: 'NFL Sunday', time: 'Sun · Noon and 3 PM games · CBS / FOX', note: '' },
  { date: '2026-11-15', title: 'NFL Sunday', time: 'Sun · Noon and 3 PM games · CBS / FOX', note: '' },
  { date: '2026-11-22', title: 'NFL Sunday', time: 'Sun · Noon and 3 PM games · CBS / FOX', note: '' },
  { date: '2026-11-29', title: 'NFL Sunday', time: 'Sun · Noon and 3 PM games · CBS / FOX', note: '' },
  { date: '2026-12-06', title: 'NFL Sunday', time: 'Sun · Noon and 3 PM games · CBS / FOX', note: '' },
  { date: '2026-12-13', title: 'NFL Sunday', time: 'Sun · Noon and 3 PM games · CBS / FOX', note: '' },
  { date: '2026-12-20', title: 'NFL Sunday', time: 'Sun · Noon and 3 PM games · CBS / FOX', note: '' },
  { date: '2026-12-27', title: 'NFL Sunday', time: 'Sun · Noon and 3 PM games · CBS / FOX', note: '' },
  { date: '2027-01-03', title: 'NFL Sunday', time: 'Sun · Noon and 3 PM games · CBS / FOX', note: '' },
  { date: '2027-01-10', title: 'NFL Sunday', time: 'Sun · Noon and 3 PM games · CBS / FOX', note: '' },
  { date: '2026-10-26', title: 'Monday Night Football: Cowboys at Eagles', time: 'Mon · 7:15 PM · ESPN', note: '' },
  { date: '2026-11-02', title: 'Monday Night Football: Bears at Seahawks', time: 'Mon · 7:15 PM · ESPN', note: '' },
  { date: '2026-11-09', title: 'Monday Night Football: Bills at Vikings', time: 'Mon · 7:15 PM · ESPN', note: '' },
  { date: '2026-11-16', title: 'Monday Night Football: Chargers at Ravens', time: 'Mon · 7:15 PM · ESPN', note: '' },
  { date: '2026-11-23', title: 'Monday Night Football: Bengals at Commanders', time: 'Mon · 7:15 PM · ESPN', note: '' },
  { date: '2026-11-30', title: 'Monday Night Football: Panthers at Buccaneers', time: 'Mon · 7:15 PM · ESPN', note: '' },
  { date: '2026-12-07', title: 'Monday Night Football: Cowboys at Seahawks', time: 'Mon · 7:15 PM · ESPN', note: '' },
  { date: '2026-12-14', title: 'Monday Night Football: Steelers at Jaguars', time: 'Mon · 7:15 PM · ESPN', note: '' },
  { date: '2026-12-21', title: 'Monday Night Football: Patriots at Chiefs', time: 'Mon · 7:15 PM · ESPN', note: '' },
  { date: '2026-12-28', title: 'Monday Night Football: Giants at Lions', time: 'Mon · 7:15 PM · ESPN', note: '' },
  { date: '2027-01-04', title: 'Monday Night Football: Texans at Packers', time: 'Mon · 7:15 PM · ESPN', note: '' },
];

// Keep only events dated today or later, add month/day for the cards.
function upcoming(list, max = 8) {
  const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const t = new Date(); const today = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  return list
    .map(ev => { const [y, m, d] = ev.date.split('-').map(Number); return { ...ev, _d: new Date(y, m - 1, d), month: MONTHS[m - 1], day: d }; })
    .filter(ev => ev._d >= today)
    .sort((a, b) => (a._d - b._d) || String(a._t || '').localeCompare(String(b._t || '')))
    .slice(0, max);
}

/* -------------------------------------------------------------------------
   2) GOOGLE CALENDAR (optional live sync)
      Leave calendars empty to use the EVENTS list above.
      Pulls from every calendar listed below, merges them into one
      chronological list, and renders them as the same branded cards.
      A calendar that fails (private, blocked, bad ID) is skipped —
      the rest still show. Full steps in README.md.
   ------------------------------------------------------------------------- */
const GCAL = {
  calendars: [
    '2d6f7caf4bd53ee8c69b453d2ad3ef0cdf78ccbef8b358b08592e78c9753517e@group.calendar.google.com', // Website Events
  ],
  apiKey: 'AIzaSyCPkfCssydAv_ed4u1A1Zzl04Sa2MQDbf0', // restricted to the Calendar API
  maxEvents: 8,
};

/* ========================================================================= */
const SHOW = 10; let ALL = EVENTS.slice();
// Add events from another source, drop exact repeats, re-render the soonest SHOW.
function addEvents(list) {
  const seen = new Set(ALL.map(e => e.date + '|' + e.title));
  ALL = ALL.concat(list.filter(e => e && /^\d{4}-\d\d-\d\d$/.test(e.date || '') && !seen.has(e.date + '|' + e.title)));
  renderEvents(upcoming(ALL, SHOW));
}
// Daily games file. If it fails, the hand list above still shows.
function loadGamesFeed() {
  fetch('/assets/games.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : Promise.reject(r.status))
    .then(d => addEvents((d.games || []).map(g => ({ date: g.date, title: g.title, time: g.time, note: g.note || '', _t: g.sort || '' }))))
    .catch(err => console.warn('games.json unavailable', err));
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('year').textContent = new Date().getFullYear();
  setupMobileMenu();
  setupDrinkTabs();
  setupEventsToggle();
  renderEvents(upcoming(EVENTS, SHOW));
  loadGamesFeed();
  if (GCAL.calendars && GCAL.calendars.length && GCAL.apiKey) loadGoogleCalendar();
});

/* ---- Mobile drawer ---- */
function setupMobileMenu() {
  const burger = document.getElementById('burger');
  const drawer = document.getElementById('drawer');
  if (!burger || !drawer) return;
  const close = () => { drawer.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); };
  burger.addEventListener('click', () => {
    const open = drawer.classList.toggle('open');
    burger.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  });
  drawer.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    close(); document.body.style.overflow = '';
  }));
}

/* ---- Drink category filter ---- */
function setupDrinkTabs() {
  const tabs = document.getElementById('drinkTabs');
  if (!tabs) return;
  const cards = document.querySelectorAll('.drinkgrid .drinkcard');
  tabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.menu-tab');
    if (!btn) return;
    tabs.querySelectorAll('.menu-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    const cat = btn.dataset.cat;
    cards.forEach(c => {
      c.classList.toggle('hidden', cat !== 'all' && c.dataset.cat !== cat);
    });
  });
}

/* ---- Events: list vs calendar embed ---- */
function setupEventsToggle() {
  const toggle = document.getElementById('evToggle');
  if (!toggle) return;
  const listView = document.getElementById('evListView');
  const calView = document.getElementById('evCalView');
  toggle.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    toggle.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const showCal = btn.dataset.view === 'cal';
    calView.classList.toggle('hidden', !showCal);
    listView.classList.toggle('hidden', showCal);
  });
}

/* ---- Render branded event cards ---- */
function renderEvents(list) {
  const el = document.getElementById('evList');
  if (!el) return;
  if (!list || !list.length) {
    el.innerHTML = '<div class="ev-empty">No games posted right now. Call us for what\'s on this week.</div>';
    return;
  }
  el.innerHTML = list.map(ev => `
    <article class="ev-card">
      <div class="ev-card__cal">
        <div class="m">${escapeHtml(ev.month)}</div>
        <div class="d">${escapeHtml(String(ev.day))}</div>
      </div>
      <div class="ev-card__body">
        <div class="ev-card__tag">On The Screens</div>
        <h3>${escapeHtml(ev.title)}</h3>
        <div class="time">${escapeHtml(ev.time || '')}</div>
        ${ev.note ? `<p>${escapeHtml(ev.note)}</p>` : ''}
      </div>
    </article>
  `).join('');
}

/* ---- Optional: pull upcoming events from one or more public Google Calendars ---- */
function loadGoogleCalendar() {
  const now = new Date().toISOString();
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

  const fetches = GCAL.calendars.map(id => {
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(id)}/events`
      + `?key=${GCAL.apiKey}&timeMin=${now}&singleEvents=true&orderBy=startTime&maxResults=${GCAL.maxEvents}`;
    return fetch(url)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => data.items || [])
      .catch(err => {
        console.warn(`Google Calendar unavailable, skipping: ${id}`, err);
        return [];
      });
  });

  Promise.all(fetches).then(results => {
    const allItems = results.flat();
    if (!allItems.length) return; // nothing extra to add

    const list = allItems
      .map(it => {
        const startStr = it.start.dateTime || it.start.date;
        const d = new Date(startStr);
        const allDay = !it.start.dateTime;
        const time = allDay
          ? d.toLocaleDateString('en-US', { weekday: 'short' })
          : d.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' });
        const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return { date: allDay ? startStr.slice(0, 10) : ymd, title: it.summary || 'Event', time, note: it.description || '', _t: startStr };
      });

    addEvents(list); // merged with the games file and the hand list
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
