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
// Schedules verified Oct 12, 2026. Times are Central. TBA = not announced yet.
const EVENTS = [
  { date: '2026-10-15', title: 'Husker Volleyball at Northwestern', time: 'Thu · 7 PM · B1G+', note: '' },
  { date: '2026-10-17', title: 'Husker Volleyball vs Purdue',       time: 'Sat · 4 PM', note: '' },
  { date: '2026-10-17', title: 'Husker Football at Oregon',         time: 'Sat · 10 PM · FOX', note: '' },
  { date: '2026-10-22', title: 'Husker Volleyball vs UCLA',         time: 'Thu · 6 PM · FS1', note: '' },
  { date: '2026-10-24', title: 'Husker Volleyball vs USC',          time: 'Sat · 8 PM', note: '' },
  { date: '2026-10-30', title: 'Husker Volleyball at Michigan',     time: 'Fri · 5:30 PM', note: '' },
  { date: '2026-10-31', title: 'Husker Volleyball at Michigan State', time: 'Sat · 3:30 PM', note: '' },
  { date: '2026-10-31', title: 'Halloween + Husker Football vs Washington', time: 'Sat · Kickoff TBA', note: 'Costume night.' },
  { date: '2026-11-06', title: 'Husker Football at Illinois',       time: 'Fri · 7 PM · FOX', note: '' },
  { date: '2026-11-07', title: 'Husker Volleyball at Oregon',       time: 'Sat · 9 PM', note: '' },
  { date: '2026-11-08', title: 'Husker Volleyball at Washington',   time: 'Sun · Time TBA', note: '' },
  { date: '2026-11-12', title: 'Husker Volleyball vs Illinois',     time: 'Thu · 6 PM', note: '' },
  { date: '2026-11-14', title: 'Husker Football at Rutgers',        time: 'Sat · Kickoff TBA', note: '' },
  { date: '2026-11-14', title: 'Husker Volleyball vs Iowa',         time: 'Sat · Time TBA', note: '' },
  { date: '2026-11-17', title: 'Husker Volleyball vs Minnesota',    time: 'Tue · 7:30 PM', note: '' },
  { date: '2026-11-21', title: 'Husker Football vs Ohio State',     time: 'Sat · Kickoff TBA', note: '' },
  { date: '2026-11-25', title: 'Thanksgiving Eve',                  time: 'Wed', note: '' },
  { date: '2026-11-27', title: 'Husker Football at Iowa',           time: 'Fri · 11 AM · CBS', note: '' },
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
    .sort((a, b) => a._d - b._d)
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

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('year').textContent = new Date().getFullYear();
  setupMobileMenu();
  setupDrinkTabs();
  setupEventsToggle();
  renderEvents(upcoming(EVENTS));
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
    if (!allItems.length) return; // keep the built-in EVENTS list

    const list = allItems
      .map(it => {
        const startStr = it.start.dateTime || it.start.date;
        const d = new Date(startStr);
        const allDay = !it.start.dateTime;
        const time = allDay
          ? d.toLocaleDateString('en-US', { weekday: 'short' })
          : d.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' });
        return { _sort: d, month: months[d.getMonth()], day: d.getDate(), title: it.summary || 'Event', time, note: it.description || '' };
      })
      .sort((a, b) => a._sort - b._sort)
      .slice(0, GCAL.maxEvents);

    renderEvents(list);
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
