import { Capacitor, registerPlugin } from '@capacitor/core';
import type { TrainerConfig, TrainerBlock } from './workouts';
import { trainerBlocks, blockAt, heartTarget, normalizedTrainerConfig } from './workouts';
import { FTMS, BIKE_DATA, CONTROL, FEATURE, HR, HR_DATA, uuid, command, commandResult, parseBikeData } from './ftms';
import { buildWorkoutSeries } from '@/lib/workoutSeries';
export interface TrainerPoint { t:number; d:number; pw:number|null; cad:number|null; hr:number|null; speed:number|null }
export interface TrainerState {
  slot:string;phase:string;connected:boolean;heartConnected:boolean;powerSupported:boolean;resistanceSupported:boolean;slopeSupported:boolean;
  watts:number|null;cadence:number|null;speed:number|null;heart:number|null;target:number;elapsed:number;distance:number;startedAt:number;label:string;mode:string;error:string;points:TrainerPoint[];
}
const empty:TrainerState={slot:'',phase:'idle',connected:false,heartConnected:false,powerSupported:false,resistanceSupported:false,slopeSupported:false,watts:null,cadence:null,speed:null,heart:null,target:100,elapsed:0,distance:0,startedAt:0,label:'',mode:'power',error:'',points:[]};
interface Native { connect(o:{trainer:string;heart:string;slot:string}):Promise<void>; state():Promise<TrainerState>; action(o:Record<string,unknown>):Promise<void> }
const native=registerPlugin<Native>('GrimTrainer');
export const nativeTrainer=Capacitor.getPlatform()==='android';
export const trainerSupported=nativeTrainer || (!Capacitor.isNativePlatform() && typeof navigator!=='undefined' && 'bluetooth' in navigator);
export interface Device { id:string;name:string }
let web:TrainerState={...empty},ble:typeof import('@capacitor-community/bluetooth-le').BleClient|null=null;
let trainerId='',heartId='',timer:ReturnType<typeof setInterval>|undefined,config:TrainerConfig|undefined,blocks:TrainerBlock[]=[];
let pending:{op:number;resolve:()=>void;reject:(e:Error)=>void}|undefined;
let last=0,dataAt=0,hrAt=0,powerAt=0,cadenceAt=0,speedAt=0,lastSample=0,lastHrAdjust=0,rawDist:number|null=null,previousDist:number|null=null,offset=0;
let minPower=25,maxPower=1500,powerStep=1;let resistanceMin=0,resistanceMax=100;
const webKey='grim_trainer_web_session';
function persist(){try{sessionStorage.setItem(webKey,JSON.stringify(web));}catch{/* preserve in memory */}}
export async function chooseTrainerDevice(kind:'trainer'|'heart'):Promise<Device>{
  const {BleClient}=await import('@capacitor-community/bluetooth-le');
  await BleClient.initialize({androidNeverForLocation:true});
  const d=await BleClient.requestDevice({services:[kind==='trainer'?FTMS:HR],optionalServices:[FTMS,HR]});
  return {id:d.deviceId,name:d.name || (kind==='trainer'?'Cykeltrainer':'Pulsmätare')};
}
export async function trainerState():Promise<TrainerState>{
  if(nativeTrainer){if(!Capacitor.isPluginAvailable('GrimTrainer'))return {...empty,error:'Trainerstödet kräver en uppdaterad Android-app.'};return {...empty,...await native.state()};}
  if(web.phase==='idle'){try{const saved=sessionStorage.getItem(webKey);if(saved){web={...empty,...JSON.parse(saved),connected:false};if(web.phase==='running'||web.phase==='paused')web={...web,phase:'interrupted',error:'Webbpasset avbröts. Sparad mätning finns kvar.'};}}catch{/* invalid draft */}}
  return {...web};
}
async function send(op:number,value?:number){
  const client=ble;if(!client)throw new Error('Anslut trainern.');
  if(pending)throw new Error('Vänta på trainerns svar.');
  await new Promise<void>((resolve,reject)=>{
    const timeout=setTimeout(()=>{pending=undefined;reject(new Error('Trainern svarade inte.'));},8000);
    pending={op,resolve:()=>{clearTimeout(timeout);pending=undefined;resolve();},reject:(e)=>{clearTimeout(timeout);pending=undefined;reject(e);}};
    let v=command(op,value);
    if(op===8)v=new DataView(new Uint8Array([8,value??1]).buffer);
    if(op===17){const a=new Uint8Array([17,0,0,0,0,40,51]);v=new DataView(a.buffer);v.setInt16(3,value??0,true);}
    client.write(trainerId,FTMS,CONTROL,v).catch(e=>{pending?.reject(new Error(e?.message || 'Kunde inte styra trainern.'));});
  });
}
export async function connectTrainer(slot:string,trainer:Device,band:Device|null){
  if(nativeTrainer){await native.connect({slot,trainer:trainer.id,heart:band?.id||''});return;}
  const old=await trainerState();if(old.phase==='running'||old.phase==='paused'||old.phase==='finished'||old.phase==='interrupted')throw new Error('Spara eller avsluta det befintliga passet först.');
  const {BleClient}=await import('@capacitor-community/bluetooth-le');ble=BleClient;trainerId=trainer.id;heartId=band?.id||'';
  web={...empty,slot,phase:'connecting'};
  try{
    await BleClient.connect(trainerId,()=>{web={...web,connected:false,phase:web.phase==='running'?'paused':web.phase,error:'Anslutningen tappades. Passet har pausats.'};persist();});
    const feature=await BleClient.read(trainerId,FTMS,FEATURE);const f=feature.getUint32(4,true);
    web.powerSupported=!!(f&8);web.resistanceSupported=!!(f&4);web.slopeSupported=!!(f&(1<<13));
    if(web.powerSupported){const r=await BleClient.read(trainerId,FTMS,uuid('2ad8'));minPower=Math.max(25,r.getInt16(0,true));maxPower=Math.min(1500,r.getInt16(2,true));powerStep=Math.max(1,r.getUint16(4,true));}
    if(web.resistanceSupported){const r=await BleClient.read(trainerId,FTMS,uuid('2ad6'));resistanceMin=r.getInt16(0,true)/10;resistanceMax=r.getInt16(2,true)/10;}
    await BleClient.startNotifications(trainerId,FTMS,CONTROL,v=>{if(!pending)return;try{commandResult(v,pending.op);pending.resolve();}catch(e){pending.reject(e instanceof Error?e:new Error('Fel trainersvar'));}});
    await BleClient.startNotifications(trainerId,FTMS,BIKE_DATA,v=>{try{const r=parseBikeData(v);const now=Date.now();dataAt=now;
      if(r.watts!==undefined&&r.watts>=0&&r.watts<=2500){web.watts=r.watts;powerAt=now;}if(r.cadence!==undefined&&r.cadence<=250){web.cadence=r.cadence;cadenceAt=now;}if(r.speed!==undefined&&r.speed<=108){web.speed=r.speed;speedAt=now;}
      if(r.heart!==undefined&&!web.heartConnected&&r.heart>=30&&r.heart<=220){web.heart=r.heart;hrAt=now;}
      if(r.distance!==undefined){rawDist=r.distance;if(web.phase==='running'&&previousDist!==null){const d=rawDist-previousDist;if(d>=0&&d<=300)web.distance+=d;}previousDist=rawDist;}
    }catch{/* truncated packets ignored */}});
    if(heartId){await BleClient.connect(heartId,()=>{web.heartConnected=false;web.heart=null;});await BleClient.startNotifications(heartId,HR,HR_DATA,v=>{try{const h=v.getUint8(0)&1?v.getUint16(1,true):v.getUint8(1);if(h>=30&&h<=220){web.heart=h;hrAt=Date.now();}}catch{/* malformed packet */}});web.heartConnected=true;}
    await send(0);web.connected=true;web.phase='ready';web.error='';persist();
  }catch(e){web.error=e instanceof Error?e.message:'Anslutningen misslyckades';web.phase='idle';await BleClient.disconnect(trainerId).catch(()=>{});if(heartId)await BleClient.disconnect(heartId).catch(()=>{});throw e;}
}
async function applyBlock(b:TrainerBlock){
  if(!config)return;
  if(config.mode==='free'){if(config.freeType==='slope'){if(!web.slopeSupported)throw new Error('Trainern stöder inte lutning.');await send(17,config.slope*100);}else{if(!web.resistanceSupported || config.resistance<resistanceMin || config.resistance>resistanceMax)throw new Error('Trainern stöder inte valt motstånd.');await send(4,config.resistance*10);}return;}
  const cap=config.mode==='heart'?Math.min(maxPower,config.maxWatts):maxPower;
  const target=Math.min(cap,Math.max(minPower,minPower+Math.round((b.watts+offset-minPower)/powerStep)*powerStep));
  if(b.watts<minPower || b.watts>maxPower)throw new Error('Måleffekten ligger utanför trainerns gränser.');web.target=target;await send(5,target);
}
let ticking=false,activeBlock=-1;
async function tick(){if(ticking||web.phase!=='running'||!config)return;ticking=true;try{
  const now=Date.now(),dt=(now-last)/1000;last=now;web.elapsed+=dt;
  if(now-hrAt>10000)web.heart=null;
  if(now-powerAt>10000)web.watts=null;
  if(now-cadenceAt>10000)web.cadence=null;
  if(now-speedAt>10000)web.speed=null;
  if(!web.connected||now-dataAt>10000){web.phase='paused';web.error='Trainerdata saknas. Passet har pausats.';if(web.connected)await send(8,2);persist();return;}
  if(rawDist===null&&web.speed!==null&&dt<=10)web.distance+=web.speed/3.6*dt;
  const b=blockAt(blocks,web.elapsed);if(!b){await trainerAction('finish');return;}
  web.label=b.label;
  if(config.mode==='heart'&&now-lastHrAdjust>=10000){lastHrAdjust=now;const cap=Math.min(maxPower,config.maxWatts);web.target=heartTarget(web.target,web.heart,(now-hrAt)/1000,web.cadence,config.heart,cap);await send(5,web.target);}
  else if(config.mode!=='heart'&&activeBlock!==b.index){await applyBlock(b);activeBlock=b.index;}
  if(now-lastSample>=5000){lastSample=now;web.points.push({t:now,d:web.distance,pw:web.watts,cad:web.cadence,hr:web.heart,speed:web.speed});persist();}
}catch(e){web.phase='paused';web.error=e instanceof Error?e.message:'Styrningen misslyckades';persist();}finally{ticking=false;}}
export async function trainerAction(action:string,data:Record<string,unknown>={}){
  if(nativeTrainer){await native.action({action,...data});return;}
  if(action==='disconnect'){if(web.phase==='running'||web.phase==='paused')throw new Error('Avsluta passet först.');return trainerAction('clear');}
  if(action==='clear'){if(web.phase==='running'||web.phase==='paused')throw new Error('Avsluta passet först.');if(timer)clearInterval(timer);await ble?.disconnect(trainerId).catch(()=>{});if(heartId)await ble?.disconnect(heartId).catch(()=>{});sessionStorage.removeItem(webKey);web={...empty};return;}
  if(action==='start'){
    config=normalizedTrainerConfig(data.config as TrainerConfig);blocks=trainerBlocks(config);
    if(!web.connected)throw new Error('Anslut trainern först.');if(config.mode!=='free'&&!web.powerSupported)throw new Error('Trainern stöder inte effektstyrning.');
    if(config.mode==='heart'&&(web.heart===null||Date.now()-hrAt>10000))throw new Error('Anslut pulsmätare för pulsstyrning.');
    try{await applyBlock(blocks[0]);await send(7);}catch(e){await send(8,1).catch(()=>{});throw e;}web={...web,phase:'running',startedAt:Date.now(),elapsed:0,distance:0,points:[],mode:config.mode,error:''};previousDist=rawDist;last=Date.now();offset=0;activeBlock=0;lastSample=0;
    if(timer)clearInterval(timer);timer=setInterval(()=>{void tick();},1000);persist();return;
  }
  if(action==='pause'){await send(8,2);web.phase='paused';persist();return;}
  if(action==='resume'){if(config?.mode==='heart' && (web.heart===null||Date.now()-hrAt>10000))throw new Error('En aktuell puls krävs.');if(!web.connected)throw new Error('Anslut trainern igen.');await send(7);last=Date.now();previousDist=rawDist;web.phase='running';return;}
  if(action==='adjust'){offset=Math.max(-200,Math.min(200,Number(data.offset)||0));activeBlock=-1;return;}
  if(action==='finish'){if(web.connected)await send(8,1);web.phase='finished';if(timer)clearInterval(timer);persist();}
}
if(typeof document!=='undefined')document.addEventListener('visibilitychange',()=>{if(!nativeTrainer&&document.hidden&&web.phase==='running'){void trainerAction('pause').catch(()=>{});web.error='Webbläsarpass pausas i bakgrunden. Använd Android-appen för låst skärm.';}});
export function trainerResult(s:TrainerState){
  const average=(key:'pw'|'cad'|'hr')=>{const xs=s.points.map(p=>p[key]).filter((v):v is number=>v!==null&&Number.isFinite(v));return xs.length?Math.round(xs.reduce((a,b)=>a+b,0)/xs.length):null;};
  const end=s.points[s.points.length-1]?.t || Date.now();
  const series=buildWorkoutSeries({start:s.startedAt,end:Math.max(end,s.startedAt+1000),hr:s.points.flatMap(p=>p.hr===null?[]:[{t:p.t,v:p.hr}]),power:s.points.flatMap(p=>p.pw===null?[]:[{t:p.t,v:p.pw}]),cadence:s.points.flatMap(p=>p.cad===null?[]:[{t:p.t,v:p.cad}]),distPoints:[{t:s.startedAt,m:0},...s.points.map(p=>({t:p.t,m:p.d}))]});
  const avg=average('pw');
  return {time:String(Math.round(s.elapsed/60*100)/100),dist:String(Math.round(s.distance/1000*1000)/1000),tempo:avg===null?'':String(avg),pulse:average('hr')===null?'':String(average('hr')),pulseMax:Math.max(0,...s.points.map(p=>p.hr||0))||undefined,avg_watt:avg,max_watt:Math.max(0,...s.points.map(p=>p.pw||0)),avg_cadence:average('cad'),series,trainerSession:{id:`${s.slot}:${s.startedAt}`,mode:s.mode,startedAt:s.startedAt},distanceSource:'trainer'};
}
/** Estimate from measured, complete one-minute windows; not commanded watts. */
export function estimateTrainerFtp(points:TrainerPoint[]):number|null{
  let best=0;for(let i=0;i<points.length;i++){const from=points[i].t;const window=points.slice(i).filter(p=>p.t<=from+60000);if(window.length<12||window[window.length-1]?.t===undefined||(window[window.length-1]?.t??0)-from<55000)continue;if(window.some((p,j)=>p.pw===null||(j>0&&p.t-window[j-1].t>7500)))continue;best=Math.max(best,window.reduce((n,p)=>n+(p.pw??0),0)/window.length);}return best>0?Math.round(best*0.75):null;
}
