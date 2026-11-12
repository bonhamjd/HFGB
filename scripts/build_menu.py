#!/usr/bin/env python3
"""Build static menu HTML for the homepage and /menu/ from data/menu.json.

By default this reads the committed snapshot so a build is reproducible.
Pass --fetch to refresh data/menu.json from the live ordering Worker first
(prices then match Clover). GitHub Pages has no build step, so run this
locally and commit the updated HTML.
"""
from __future__ import annotations

import argparse
import html
import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MENU_JSON = ROOT / "data" / "menu.json"
WORKER = "https://hfgb-orders.highflyersgolfbar.workers.dev/api/menu"
SUB = {"Front 9": "To start, or to share"}
LEFT = ["Flatbreads", "Wings", "Burgers"]
PHOTO = (
    '<div class="hp-photo"><img src="/assets/photos/pizza.webp" width="900" height="1164" '
    'alt="A High Flyers flatbread" loading="lazy"></div>'
)
ASIDE = """\
      <aside class="hp-aside">
        <div class="hp-aside__card" data-order-block>
          <span class="hp-eyebrow">Order ahead</span>
          <h3>Order Online for Pickup</h3>
          <p>Order 11 AM to 9 PM, pickup from 11:30 at 302 Main St. Mondays: order from 3 PM, pickup from 3:30.</p>
          <a class="btn btn--brass btn--lg hp-wide" data-order href="/order/">Start Your Order</a>
        </div>
        <div class="hp-aside__card hidden" data-soon>
          <span class="hp-eyebrow">Coming soon</span>
          <h3>Online Ordering for Pickup</h3>
          <p>Soon you'll be able to order on your phone and pick up at 302 Main St. Until then, give us a call or come on in.</p>
          <a class="btn btn--green btn--lg" href="tel:+14029230160">Call (402) 923-0160</a>
        </div>
        <div class="hp-aside__note"><b>Drinks</b>Beer, cocktails and the full drink list are at the bar. Ask for Chad's Golf Ball Old Fashioned.</div>
      </aside>"""


def money(cents) -> str:
    c = int(cents)
    if c % 100:
        return f"${c / 100:.2f}"
    return f"${c // 100}"


def note_text(n: str) -> str:
    n = n or ""
    return f"Order of {n}" if n.isdigit() else n


def slug(s: str) -> str:
    out = []
    last_dash = False
    for ch in s.lower():
        if ch.isalnum():
            out.append(ch)
            last_dash = False
        else:
            if not last_dash:
                out.append("-")
                last_dash = True
    return "".join(out).strip("-")


def esc(s: str) -> str:
    return html.escape(s or "", quote=True)


def line(name: str, price, nt: str, sold_out: bool, extra_cls: str = "") -> str:
    cls = "mline"
    if sold_out:
        cls += " out"
    if extra_cls:
        cls += extra_cls
    note_html = f'<div class="mline__note">{esc(nt)}</div>' if nt else ""
    return (
        f'<div class="{cls}"><div class="mline__top"><span class="mline__name">{esc(name)}</span>'
        f'<span class="mline__dots"></span><span class="mline__price">{money(price)}</span></div>'
        f"{note_html}</div>"
    )


def group_html(g: dict) -> str:
    name = g.get("name") or ""
    items = g.get("items") or []
    if name == "Pop":
        by = {}
        for i in items:
            if i.get("soldOut"):
                continue
            by.setdefault(int(i["price"]), []).append(i.get("name") or "")
        rows = "".join(
            line(", ".join(names), price, "", False, " mline--pop")
            for price, names in sorted(by.items())
        )
    else:
        rows = "".join(
            line(
                i.get("name") or "",
                i.get("price"),
                " · ".join(filter(None, [note_text(i.get("note") or ""), "Sold out today" if i.get("soldOut") else ""])),
                bool(i.get("soldOut")),
            )
            for i in items
        )
    sub = SUB.get(name)
    sub_html = f'<p class="mgroup__sub">{esc(sub)}</p>' if sub else ""
    return (
        f'<section class="mgroup" id="m-{slug(name)}"><div class="mgroup__head">'
        f"<h3>{esc(name)}</h3></div>{sub_html}{rows}</section>"
    )


def tabs_html(groups: list) -> str:
    return "".join(f'<a href="#m-{slug(g["name"])}">{esc(g["name"])}</a>' for g in groups)


def grid_html(groups: list) -> str:
    left = [g for g in groups if g["name"] in LEFT]
    right = [g for g in groups if g["name"] not in LEFT]
    left_parts = [group_html(g) for g in left]
    insert_at = min(1, len(left_parts))
    left_parts[insert_at:insert_at] = [PHOTO]
    return (
        f'<div class="hp-col">{"".join(left_parts)}</div>'
        f'<div class="hp-col">{"".join(group_html(g) for g in right)}{ASIDE}</div>'
    )


def price_usd(cents) -> str:
    c = int(cents)
    if c % 100:
        return f"{c / 100:.2f}"
    return str(c // 100)


def menu_jsonld(groups: list) -> str:
    sections = []
    for g in groups:
        items = []
        for i in g.get("items") or []:
            if i.get("soldOut"):
                continue
            item = {
                "@type": "MenuItem",
                "name": i.get("name") or "",
                "offers": {
                    "@type": "Offer",
                    "price": price_usd(i.get("price") or 0),
                    "priceCurrency": "USD",
                },
            }
            note = note_text(i.get("note") or "")
            if note:
                item["description"] = note
            items.append(item)
        if not items:
            continue
        sections.append({
            "@type": "MenuSection",
            "name": g.get("name") or "",
            "hasMenuItem": items,
        })
    data = {
        "@context": "https://schema.org",
        "@type": "Menu",
        "@id": "https://highflyersgolfbar.com/menu/#menu",
        "name": "High Flyers Golf Bar food menu",
        "url": "https://highflyersgolfbar.com/menu/",
        "inLanguage": "en-US",
        "hasMenuSection": sections,
    }
    return json.dumps(data, indent=2, ensure_ascii=False)


def replace_block(text: str, start: str, end: str, inner: str) -> str:
    a = text.find(start)
    b = text.find(end)
    if a < 0 or b < 0 or b < a:
        raise SystemExit(f"markers not found: {start} ... {end}")
    return text[: a + len(start)] + "\n" + inner.rstrip() + "\n" + text[b:]


def slim_from_live(live: dict) -> dict:
    groups = []
    for g in live.get("groups") or []:
        items = []
        for i in g.get("items") or []:
            items.append({
                "id": i.get("id"),
                "name": i.get("name"),
                "note": i.get("note") or "",
                "price": i.get("price"),
                "soldOut": bool(i.get("soldOut")),
            })
        groups.append({"name": g.get("name"), "items": items})
    return {
        "source": WORKER,
        "fetched": __import__("datetime").date.today().isoformat(),
        "taxRate": live.get("taxRate"),
        "groups": groups,
    }


def fetch_live() -> dict:
    req = urllib.request.Request(WORKER, headers={"User-Agent": "HFGBMenuBuild/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--fetch", action="store_true", help="refresh data/menu.json from the Worker first")
    args = p.parse_args()
    if args.fetch:
        live = fetch_live()
        slim = slim_from_live(live)
        MENU_JSON.write_text(json.dumps(slim, indent=2) + "\n")
        print(f"updated {MENU_JSON}", file=sys.stderr)

    data = json.loads(MENU_JSON.read_text())
    groups = [g for g in data.get("groups") or [] if g.get("items")]
    if not groups:
        raise SystemExit("menu.json has no groups")

    tabs = tabs_html(groups)
    home_grid = grid_html(groups)
    menu_grid = grid_html(groups)
    ld = menu_jsonld(groups)

    index = ROOT / "index.html"
    index.write_text(replace_block(
        replace_block(index.read_text(), "<!-- menu:tabs:start -->", "<!-- menu:tabs:end -->", "    " + tabs),
        "<!-- menu:static:start -->",
        "<!-- menu:static:end -->",
        "    " + home_grid,
    ))
    menu_page = ROOT / "menu" / "index.html"
    menu_page.write_text(replace_block(
        replace_block(
            replace_block(menu_page.read_text(), "<!-- menu:tabs:start -->", "<!-- menu:tabs:end -->", "    " + tabs),
            "<!-- menu:static:start -->",
            "<!-- menu:static:end -->",
            "    " + menu_grid,
        ),
        "<!-- menu:jsonld:start -->",
        "<!-- menu:jsonld:end -->",
        '<script type="application/ld+json">\n' + ld + "\n</script>",
    ))
    print(f"built static menu into {index} and {menu_page}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
