import asyncio,json,os
from playwright.async_api import async_playwright
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(headless=True)
  c=await b.new_context(viewport={'width':1280,'height':1800})
  page=await c.new_page(); reads=[]; errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('request',lambda r:reads.append(r.url) if '/rest/v1/workout_completions?' in r.url else None)
  await page.goto('http://localhost:8080')
  await page.evaluate('([k,v])=>{localStorage.setItem(k,v);localStorage.setItem("grim_active_tab","home")}',[os.environ['LOVABLE_BROWSER_SUPABASE_STORAGE_KEY'],os.environ['LOVABLE_BROWSER_SUPABASE_SESSION_JSON']])
  await page.reload();await page.wait_for_timeout(6000)
  await page.get_by_role('button',name='Träning',exact=True).last.click();await page.wait_for_timeout(5000)
  before=len(reads)
  await page.get_by_role('button',name='Hem',exact=True).last.click();await page.wait_for_timeout(5000)
  assert len(reads)>before
  print('PASS Hem hämtar träningsresultat igen efter återkomst')
  before=len(reads)
  await page.evaluate('window.dispatchEvent(new Event("grim:workouts-changed"))');await page.wait_for_timeout(4000)
  assert len(reads)>before
  print('PASS Hem uppdateras efter träningsändring')
  await page.get_by_role('button',name='Verktyg',exact=True).last.click();await page.wait_for_timeout(3000)
  await page.get_by_role('button',name='Inställningar',exact=False).click()
  await page.wait_for_timeout(1000)
  await page.get_by_role('button',name='Vilotimer, ljud',exact=False).click()
  await page.wait_for_timeout(1000)
  calls=[]
  async def block_archive(route):
   calls.append(True)
   await route.fulfill(status=400,content_type='application/json',body=json.dumps({'message':'Verifiering: arkivering blockerad för att skydda dina pass'}))
  await page.route('**/rest/v1/rpc/archive_current_workouts',block_archive)
  await page.get_by_role('button',name='Starta träningsplan',exact=True).click()
  await page.get_by_role('button',name='Starta plan',exact=True).click()
  await page.wait_for_timeout(4000)
  assert len(calls)==1
  assert await page.evaluate('localStorage.getItem("grim_start_plan_from_settings")') is None
  print('PASS tidigare öppnad Träning tar emot planstart exakt en gång; arkivering blockerad för att skydda kontot')
  await page.screenshot(path='/tmp/browser/tab-refresh/tools.png')
  print('ERRORS',errors)
  await b.close()
asyncio.run(main())
