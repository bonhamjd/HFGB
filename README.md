# High Flyers Golf Bar — Website

The website for **High Flyers Golf Bar**, 302 Main St, Humphrey, NE — [highflyersgolfbar.com](https://highflyersgolfbar.com).

It's a single, fast-loading page with **no build step** — just plain HTML, CSS, and a little JavaScript. That means anyone (or Claude) can edit it and push to GitHub, and it goes live automatically.

## Files

| File | What it is |
|------|-----------|
| `index.html` | The whole page — menus, events, visit info. |
| `styles.css` | All the styling. Brand colors and fonts live at the top. |
| `app.js` | Menus filter, events, mobile nav, and Google Calendar sync. **The events list you edit is here.** |
| `assets/` | Logo files. |
| `CNAME` | Tells GitHub Pages to use `highflyersgolfbar.com`. Leave it. |

---

## How to make edits (the common ones)

**Change a menu price or item** → open `index.html`, find the item (search for its name), edit the text. Save.

**Add or change an event / game** → open `app.js`, edit the `EVENTS` list near the top. Each event looks like:
```js
{ month: 'SEP', day: 6, title: 'Huskers — Season Opener', time: 'Sat · Kickoff', note: 'Doors early. GBR.' },
```

**Update hours** → search `Closes 1 AM` in `index.html` (it appears a few times) and change it.

**Just tell Claude** what you want changed — "add a $6 basket of onion rings to the Front 9," or "add Saturday's volleyball game to the calendar" — and it can make the edit and push it for you.

---

## Publishing on GitHub Pages (one-time setup)

1. Put this `site/` folder's contents in a GitHub repo (the files should be at the repo root, or set Pages to serve from `/site`).
2. In the repo: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, pick `main` and `/ (root)`.
3. Under **Custom domain**, enter `highflyersgolfbar.com` and Save. (The included `CNAME` file already sets this.)
4. At your domain registrar, point the domain at GitHub Pages:
   - An **A record** for `@` to each of: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - A **CNAME record** for `www` to `YOUR-USERNAME.github.io`
5. Wait for DNS (can take a few hours), then tick **Enforce HTTPS**.

After that, every push to the repo updates the live site within a minute.

---

## Google Calendar for events — two options

The Game Day section can show events **two ways**, and there's a toggle on the page ("Our Lineup" / "Full Calendar") so you can offer both.

### First: make a public calendar
1. In Google Calendar, create a calendar (e.g. "High Flyers Events") or use an existing one.
2. **Settings → Access permissions →** check **"Make available to public."**
3. Add your games and events to it.

### Option A — Embed (zero maintenance, easiest)
Shows Google's own calendar widget. Whatever you add in Google appears instantly.
1. In Google Calendar: **Settings → [your calendar] → Integrate calendar → Embed code.**
2. Copy the `src="..."` URL from that code.
3. In `index.html`, find `id="gcalFrame"` and replace its `src` with yours.

### Option B — Branded list (matches the site, a little setup)
Pulls your upcoming events and shows them as on-brand cards in "Our Lineup."
1. Get a **Google API key**: [console.cloud.google.com](https://console.cloud.google.com) → new project → **APIs & Services → Enable APIs → Google Calendar API** → **Credentials → Create API key.** (Restrict it to the Calendar API.)
2. Get your **Calendar ID**: Google Calendar → Settings → your calendar → "Integrate calendar" → **Calendar ID** (often your email, or an `...@group.calendar.google.com` address).
3. In `app.js`, fill in the `GCAL` block:
   ```js
   const GCAL = { calendarId: 'YOUR_CALENDAR_ID', apiKey: 'YOUR_API_KEY', maxEvents: 6 };
   ```
That's it — the "Our Lineup" cards will fill from Google automatically, and fall back to the hand-written `EVENTS` list if anything's off.

**Not sure which?** Leave both as-is for now (the page works out of the box with the built-in list), and pick once your calendar's up.

---

## Shop section

Removed (2026-06-30) — the Gift Cards / Hats / T-Shirts section and its nav links are gone. If you want gift cards or swag back on the site later, with or without online checkout through Stripe, just ask.

---

## Notes & things to confirm

- **Hours** are set to Mon through Sat 11 AM to 1 AM, and Sunday 11 AM to 10 PM. To change them, search `11 AM` in `index.html`.
- **Social links** point to `facebook.com/highflyersgolfbar` and `instagram.com/highflyersgolfbar`. Update in `index.html` (search `facebook.com`) if your handles differ.
- **Photos** live in `assets/photos/`. The hero uses `bar.png`. To swap any photo, drop a new file in that folder with the same name, or point the `src` at your new file. Bigger, brighter shots of wings, the patio, and a packed game day will only make it better.
- **Fonts** are Zilla Slab, Oswald, DM Serif Display, and Barlow from Google Fonts, chosen for a warm vintage feel. If you ever get the real logo font, we can swap it in.
- **Drink menu:** the full drink list is intentionally kept off the site for now (menu points people to ask at the bar). Say the word and we'll add a styled drink section back.
