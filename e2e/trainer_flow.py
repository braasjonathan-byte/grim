import asyncio,json,time,re
from pathlib import Path
from playwright.async_api import async_playwright,expect
from lovable_playwright_defaults import signed_in_context
NAME='QA Trainer '+str(int(time.time()))
MOCK=r'''(() => {
const uuid=s=>`0000${s}-0000-1000-8000-00805f9b34fb`;window.__trainerOps=[];
class Characteristic extends EventTarget {
 constructor(service,id){super();this.service=service;this.uuid=id;this.value=new DataView(new ArrayBuffer(0));}
 async readValue(){const a=new Uint8Array(8),v=new DataView(a.buffer);if(this.uuid===uuid('2acc'))v.setUint32(4,8|4|(1<<13),true);else if(this.uuid===uuid('2ad8')){v.setInt16(0,25,true);v.setInt16(2,1500,true);v.setUint16(4,1,true);}else{v.setInt16(0,0,true);v.setInt16(2,1000,true);v.setUint16(4,1,true);}return v;}
 emit(v){this.value=v;this.dispatchEvent(new Event('characteristicvaluechanged'));}
 async startNotifications(){if(this.uuid===uuid('2ad2')){this.start=Date.now();this.timer=setInterval(()=>{const a=new Uint8Array(12),v=new DataView(a.buffer);v.setUint16(0,4|16|64|512,true);v.setUint16(2,3000,true);v.setUint16(4,170,true);const m=Math.floor((Date.now()-this.start)/1000*8.333);a[6]=m&255;a[7]=(m>>8)&255;a[8]=(m>>16)&255;v.setInt16(9,150,true);a[11]=135;this.emit(v);},500);}if(this.uuid===uuid('2a37'))this.timer=setInterval(()=>this.emit(new DataView(new Uint8Array([0,135]).buffer)),500);return this;}
 async stopNotifications(){clearInterval(this.timer);return this;}
 async writeValueWithResponse(b){const a=b instanceof DataView?new Uint8Array(b.buffer,b.byteOffset,b.byteLength):new Uint8Array(b);window.__trainerOps.push(Array.from(a));setTimeout(()=>this.emit(new DataView(new Uint8Array([128,a[0],1]).buffer)),20);}
}
function device(kind){const d=new EventTarget();d.id='qa-'+kind;d.name=kind==='trainer'?'QA FTMS trainer':'QA pulsband';const services=new Map();d.gatt={connected:false,connect:async()=>{d.gatt.connected=true;return d.gatt;},disconnect:()=>{d.gatt.connected=false;for(const s of services.values())for(const c of s.chars.values())clearInterval(c.timer);d.dispatchEvent(new Event('gattserverdisconnected'));},getPrimaryService:async id=>{if(!services.has(id)){const s={uuid:id,device:d,chars:new Map()};s.getCharacteristic=async c=>{if(!s.chars.has(c))s.chars.set(c,new Characteristic(s,c));return s.chars.get(c);};services.set(id,s);}return services.get(id);}};return d;}
const devices={trainer:device('trainer'),heart:device('heart')};
Object.defineProperty(navigator,'bluetooth',{configurable:true,value:{getAvailability:async()=>true,requestDevice:async opts=>devices[opts.filters?.[0]?.services?.[0]===uuid('180d')?'heart':'trainer'],getDevices:async()=>[]}});
})();'''
async def cleanup(page):
 return await page.evaluate('''async name=>{const {supabase:s}=await import('/src/integrations/supabase/client.ts');const {data:{user}}=await s.auth.getUser();if(!user)return false;const {data:plans,error}=await s.from('workout_plans').select('id,week,day').eq('user_id',user.id).eq('session_name',name);if(error)throw error;for(const p of plans||[]){const c=await s.from('workout_completions').delete().eq('user_id',user.id).eq('week',p.week).eq('day',p.day);if(c.error)throw c.error;const d=await s.from('workout_plans').delete().eq('id',p.id).eq('user_id',user.id);if(d.error)throw d.error;}return true;}''',NAME)
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True);ctx=await signed_in_context(browser,viewport={'width':384,'height':675});page=await ctx.new_page();await page.add_init_script(MOCK);errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
  try:
   await page.goto('http://localhost:8080');await page.wait_for_timeout(3500);await page.get_by_role('button',name='Träning',exact=True).click();await page.get_by_role('button',name='Nytt enskilt pass',exact=True).click();await page.get_by_placeholder('Passnamn (t.ex. Styrka överkropp)').fill(NAME);await page.get_by_role('button',name='Skapa pass',exact=True).click();await page.wait_for_timeout(1600)
   await expect(page.get_by_text(NAME,exact=True)).to_be_visible();print('created test workout visible');await page.get_by_role('button',name='Lägg till övning',exact=True).click();await page.wait_for_timeout(500);print('picker inputs',await page.locator('input').evaluate_all('(xs)=>xs.map(x=>x.placeholder)'))
   await page.get_by_placeholder('Sök övning...').fill('Cykeltrainer');await page.wait_for_timeout(400);print('search buttons:',await page.get_by_role('button').all_text_contents());await page.screenshot(path='/tmp/browser/trainer/search.png');await page.get_by_role('button',name=re.compile('^Cykeltrainer')).click();await page.wait_for_timeout(1200)
   dialog=page.get_by_role('dialog');await expect(dialog).to_be_visible();print('automatic connection dialog opened')
   await dialog.screenshot(path='/tmp/browser/trainer/setup.png');await page.get_by_role('button',name='Välj trainer',exact=True).click();await page.get_by_role('button',name='Välj pulsmätare',exact=True).click();print('connection choices:',await dialog.inner_text());await page.get_by_role('button',name='Anslut',exact=True).click();await page.wait_for_timeout(1600)
   await page.get_by_role('button',name='Till livevy',exact=True).click();await page.get_by_role('button',name='Starta pass',exact=True).click();await expect(page.get_by_role('button',name='Pausa',exact=True)).to_be_visible();await page.wait_for_timeout(5000);await dialog.screenshot(path='/tmp/browser/trainer/live.png');print('live:',await dialog.inner_text())
   await page.get_by_role('button',name='Close',exact=True).click();await page.get_by_role('button',name='Öppna trainer',exact=True).click();await page.wait_for_timeout(700);print('reopened session stayed running')
   await page.wait_for_timeout(60000);await page.get_by_role('button',name='Avsluta och spara',exact=True).click();await page.wait_for_timeout(2500)
   print('saved UI:',(await page.locator('body').inner_text())[:2400]);print('commands:',await page.evaluate('window.__trainerOps'));await page.screenshot(path='/tmp/browser/trainer/saved.png')
   assert not await page.get_by_role('dialog').count(),'saving should close the dialog'
   await page.reload();await page.wait_for_timeout(3500);await page.get_by_role('button',name='Träning',exact=True).click();await page.get_by_role('button',name='Nytt enskilt pass',exact=True).click();await page.get_by_role('button',name='Avbryt',exact=True).click();await expect(page.get_by_text(NAME,exact=True)).to_be_visible();await expect(page.get_by_text('150 W',exact=True)).to_be_visible();await page.wait_for_timeout(1500);print('after reload:',(await page.locator('body').inner_text())[:2400]);print('runtime errors:',errs)
  finally:
   print('test cleanup:',await cleanup(page));await browser.close()
asyncio.run(main())
