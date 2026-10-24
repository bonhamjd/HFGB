// Time helpers in the bar's zone (America/Chicago). Works in browsers, Node 20 and Cloudflare Workers (Intl only).
const fmtCache = {};
function dtf(tz) {
  return fmtCache[tz] || (fmtCache[tz] = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short' }));
}
const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
export function parts(ms, tz) {
  const p = {}; for (const x of dtf(tz).formatToParts(new Date(ms))) p[x.type] = x.value;
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second, wd: WD[p.weekday] };
}
function offset(ms, tz) { const p = parts(ms, tz); return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(ms / 1000) * 1000; }
export function zoned(y, m, d, h, mi, tz) {
  const guess = Date.UTC(y, m - 1, d, h, mi);
  let t = guess - offset(guess, tz);
  const o2 = offset(t, tz); if (guess - o2 !== t) t = guess - o2;
  return t;
}
export const hm = s => { const [h, m] = String(s).split(':').map(Number); return h * 60 + (m || 0); };
export function dayKey(ms, tz) { const p = parts(ms, tz); return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`; }
export function label(ms, tz) {
  return new Date(ms).toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' });
}
const minLabel = m => { const h = Math.floor(m / 60) % 24, mm = m % 60; return `${h % 12 || 12}${mm ? ':' + String(mm).padStart(2, '0') : ''} ${h < 12 ? 'AM' : 'PM'}`; };

// Ordering window for "today" at time now. Returns open flag, why not, and 15 minute pickup slots with room.
export function schedule(cfg, now, slotCounts = {}, paused = false) {
  const tz = cfg.tz, p = parts(now, tz), at = (min) => zoned(p.y, p.m, p.d, Math.floor(min / 60), min % 60, tz);
  const key = dayKey(now, tz), nowMin = p.h * 60 + p.mi;
  const openMin = hm(cfg.orderOpen), lastOrderMin = hm(cfg.lastOrder), firstPickMin = hm(cfg.firstPickup), lastPickMin = hm(cfg.lastPickup);
  const out = { day: key, now, open: false, reason: '', opensLabel: minLabel(openMin), lastOrderLabel: minLabel(lastOrderMin),
    firstPickupLabel: minLabel(firstPickMin), slots: [], asap: null, cap: cfg.slotCap, prepMin: cfg.prepMin };
  if (cfg.closedWeekdays.includes(p.wd) || cfg.closedDates.includes(key)) { out.reason = 'closed_today'; return out; }
  if (paused) { out.reason = 'paused'; return out; }
  if (nowMin < openMin) out.reason = 'not_yet';
  else if (nowMin >= lastOrderMin) out.reason = 'done_for_day';
  else out.open = true;
  // slots for today (shown even before open so people can see the plan)
  const earliest = Math.max(firstPickMin, nowMin + cfg.prepMin);
  for (let m = firstPickMin; m <= lastPickMin; m += 15) {
    if (m < earliest) continue;
    const t = at(m), used = slotCounts[t] || 0;
    out.slots.push({ t, label: minLabel(m), left: Math.max(0, cfg.slotCap - used) });
  }
  if (out.open) {
    const s = out.slots.find(x => x.left > 0);
    if (s) out.asap = { t: s.t, label: s.label, readyAt: Math.max(s.t - 15 * 60000, now + cfg.prepMin * 60000) };
    else { out.open = false; out.reason = 'full'; }
  }
  return out;
}
