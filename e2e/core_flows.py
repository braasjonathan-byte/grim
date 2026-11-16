"""
End-to-end-kontroll av Grims kärnflöden mot den lokala förhandsvisningen.

Kör: python3 e2e/core_flows.py   (kräver en inloggad session, se AGENTS.md)
1. Måltid: snabbpost i frukost -> ladda om -> raden finns -> städas bort.
2. Pass: bocka första setet -> ladda om -> bocken finns kvar -> återställs.
3. Offline: bocka set utan internet -> kön får en rad -> online -> kön töms
   och raden finns i databasen -> återställs.
Testdata får unika namn och tas alltid bort, även när ett steg misslyckas.
"""
import asyncio, json, os, sys, time, urllib.request
from pathlib import Path
from playwright.async_api import async_playwright, expect

BASE = os.environ.get("GRIM_E2E_URL", "http://localhost:8080")
OUT = Path("/tmp/browser/e2e"); OUT.mkdir(parents=True, exist_ok=True)

def env_file():
    vals = {}
    for line in Path(".env").read_text().splitlines():
        if "=" in line:
            k, v = line.split("=", 1); vals[k.strip()] = v.strip().strip('"')
    return vals

def session():
    if os.environ.get("LOVABLE_BROWSER_AUTH_STATUS") == "injected":
        return os.environ["LOVABLE_BROWSER_SUPABASE_STORAGE_KEY"], os.environ["LOVABLE_BROWSER_SUPABASE_SESSION_JSON"]
    m = json.load(open(os.path.expanduser("~/.cache/lovable-auth/session.json")))
    return m["storage_key"], json.dumps(m["session"])

ENV = env_file()
KEY, SESSION = session()
TOKEN = json.loads(SESSION)["access_token"]
USER = json.loads(SESSION)["user"]["id"]

def rest(method, path):
    req = urllib.request.Request(f"{ENV['VITE_SUPABASE_URL']}/rest/v1/{path}", method=method, headers={
        "apikey": ENV["VITE_SUPABASE_PUBLISHABLE_KEY"], "Authorization": f"Bearer {TOKEN}"})
    with urllib.request.urlopen(req) as r:
        body = r.read(); return json.loads(body) if body else None

results = []
def check(name, ok, detail=""):
    results.append((name, ok)); print(("PASS " if ok else "FAIL ") + name + (f" – {detail}" if detail else ""))

async def open_app(ctx):
    pg = await ctx.new_page()
    await pg.goto(BASE)
    await pg.evaluate("([k,v]) => { localStorage.setItem(k,v); localStorage.setItem('grim_health_prompt_dismissed', JSON.stringify(Array.from({length:0}))) }", [KEY, SESSION])
    await pg.goto(BASE); await pg.wait_for_timeout(4000)
    await close_prompts(pg)
    return pg

async def close_prompts(pg):
    for label in ["Nej tack", "Inte nu", "Hoppa över"]:
        b = pg.get_by_role("button", name=label)
        if await b.count() and await b.first.is_visible():
            await b.first.click(); await pg.wait_for_timeout(400)

async def meal_flow(ctx):
    note = f"E2E-test {int(time.time())}"
    try:
        pg = await open_app(ctx)
        await pg.get_by_role("button", name="Kost", exact=True).last.click(); await pg.wait_for_timeout(2500)
        await pg.get_by_role("button", name="Fler val").first.click()
        await pg.get_by_role("menuitem", name="Snabbpost (bara kcal)").click()
        await pg.get_by_placeholder("Anteckning (t.ex. Lunch på stan)").fill(note)
        await pg.get_by_placeholder("Kalorier (kcal)").fill("123")
        await pg.get_by_role("button", name="Spara", exact=True).click(); await pg.wait_for_timeout(2500)
        await pg.reload(); await pg.wait_for_timeout(4000); await close_prompts(pg)
        await pg.get_by_role("button", name="Kost", exact=True).last.click(); await pg.wait_for_timeout(2500)
        visible = await pg.get_by_text(note).count() > 0
        rows = rest("GET", f"meal_logs?user_id=eq.{USER}&item_name=eq.{urllib.parse.quote(note)}&select=kcal")
        await pg.screenshot(path=str(OUT / "meal_after_reload.png"))
        check("Måltid syns efter omladdning", visible)
        check("Måltid sparad med 123 kcal", len(rows) == 1 and round(float(rows[0]["kcal"])) == 123, str(rows))
    finally:
        rest("DELETE", f"meal_logs?user_id=eq.{USER}&item_name=eq.{urllib.parse.quote(note)}")

async def first_set(pg):
    await pg.get_by_role("button", name="Träning", exact=True).last.click(); await pg.wait_for_timeout(3500)
    await close_prompts(pg)
    box = pg.get_by_role("checkbox", name="Klart set (fyller i förifyllda värden)").first
    await expect(box).to_be_visible(timeout=10000)
    return box

async def set_state(box):
    return (await box.get_attribute("data-state")) == "checked"

async def workout_flow(ctx):
    pg = await open_app(ctx)
    box = await first_set(pg)
    before = await set_state(box)
    try:
        await box.click(); await pg.wait_for_timeout(2500)
        await pg.reload(); await pg.wait_for_timeout(4000); await close_prompts(pg)
        box = await first_set(pg)
        await pg.screenshot(path=str(OUT / "workout_after_reload.png"))
        check("Bockat set finns kvar efter omladdning", await set_state(box) != before)
    finally:
        if await set_state(box) != before:
            await box.click(); await pg.wait_for_timeout(2500)
    await pg.reload(); await pg.wait_for_timeout(4000); await close_prompts(pg)
    check("Setet återställt efter testet", await set_state(await first_set(pg)) == before)

async def offline_flow(ctx):
    pg = await open_app(ctx)
    box = await first_set(pg)
    before = await set_state(box)
    try:
        await ctx.set_offline(True)
        await box.click(); await pg.wait_for_timeout(3000)
        queue = json.loads(await pg.evaluate("localStorage.getItem('grim_offline_queue') || '[]'"))
        mine = [q for q in queue if q.get("table") == "workout_completions" and q["data"].get("user_id") == USER]
        check("Offline-bock hamnar i kön för rätt konto", len(mine) >= 1, f"{len(queue)} i kön")
        await ctx.set_offline(False)
        await pg.evaluate("window.dispatchEvent(new Event('online'))")
        for _ in range(20):
            await pg.wait_for_timeout(1000)
            queue = json.loads(await pg.evaluate("localStorage.getItem('grim_offline_queue') || '[]'"))
            if not any(q.get("table") == "workout_completions" for q in queue): break
        check("Kön töms när internet kommer tillbaka", not any(q.get("table") == "workout_completions" for q in queue))
        await pg.reload(); await pg.wait_for_timeout(4000); await close_prompts(pg)
        box = await first_set(pg)
        check("Offline-bocken finns kvar efter omladdning", await set_state(box) != before)
    finally:
        await ctx.set_offline(False)
        if await set_state(box) != before:
            await box.click(); await pg.wait_for_timeout(2500)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        for flow in (meal_flow, workout_flow, offline_flow):
            ctx = await b.new_context(viewport={"width": 390, "height": 844})
            try: await flow(ctx)
            except Exception as e:
                check(flow.__name__, False, repr(e)[:300])
                pgs = ctx.pages
                if pgs: await pgs[-1].screenshot(path=str(OUT / f"{flow.__name__}_error.png"))
            await ctx.close()
        await b.close()
    failed = [n for n, ok in results if not ok]
    print(f"\n{len(results) - len(failed)}/{len(results)} godkända")
    sys.exit(1 if failed else 0)

import urllib.parse
asyncio.run(main())
