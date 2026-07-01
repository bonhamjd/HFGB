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
const EVENTS = [
  { month: 'SEP', day: 6,  title: 'Huskers Football — Season Opener', time: 'Sat · Kickoff on the big screen', note: 'Doors early. Drink specials all game. GBR.' },
  { month: 'SEP', day: 13, title: 'Husker Volleyball Watch Party',     time: 'Fri · 7 PM',  note: 'Sound on, wings out. Bring the crew.' },
  { month: 'SEP', day: 14, title: 'NFL Sunday',                        time: 'Sun · Noon',  note: 'Every game we can get. Buckets & baskets all afternoon.' },
  { month: 'SEP', day: 19, title: 'Patio Happy Hour',                  time: 'Fri · 4–6 PM', note: '$1 off drafts. Golden hour out back if the weather holds.' },
];

/* -------------------------------------------------------------------------
   2) GOOGLE CALENDAR (optional live sync)
      Leave blank to use the EVENTS list above.
      To go live: make a public Google Calendar, then paste its ID and a
      Google API key here. Full steps in README.md.
   ------------------------------------------------------------------------- */
const GCAL = {
  calendarId: '',   // e.g. 'highflyersgolfbar@gmail.com'  (must be a PUBLIC calendar)
  apiKey: '',       // e.g. 'AIzaSy...'  (restrict it to the Calendar API)
  maxEvents: 6,
};

/* ========================================================================= */

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('year').textContent = new Date().getFullYear();
  setupMobileMenu();
  setupDrinkTabs();
  setupEventsToggle();
  renderEvents(EVENTS);
  if (GCAL.calendarId && GCAL.apiKey) loadGoogleCalendar();
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

/* ---- Optional: pull upcoming events from a public Google Calendar ---- */
function loadGoogleCalendar() {
  const now = new Date().toISOString();
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(GCAL.calendarId)}/events`
    + `?key=${GCAL.apiKey}&timeMin=${now}&singleEvents=true&orderBy=startTime&maxResults=${GCAL.maxEvents}`;
  fetch(url)
    .then(r => r.ok ? r.json() : Promise.reject(r.status))
    .then(data => {
      if (!data.items || !data.items.length) return;
      const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
      const list = data.items.map(it => {
        const startStr = it.start.dateTime || it.start.date;
        const d = new Date(startStr);
        const allDay = !it.start.dateTime;
        const time = allDay
          ? d.toLocaleDateString('en-US', { weekday: 'short' })
          : d.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' });
        return { month: months[d.getMonth()], day: d.getDate(), title: it.summary || 'Event', time, note: it.description || '' };
      });
      renderEvents(list);
    })
    .catch(err => console.warn('Google Calendar sync unavailable, using built-in list.', err));
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
