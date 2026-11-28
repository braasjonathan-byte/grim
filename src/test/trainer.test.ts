import { buildWorkoutSeries, parseWorkoutSeries } from '@/lib/workoutSeries';
import { describe,it,expect } from 'vitest';
import { parseBikeData,command,commandResult } from '@/lib/trainer/ftms';
import { TRAINER_WORKOUTS,trainerBlocks,blockAt,heartTarget,normalizedTrainerConfig,type TrainerConfig } from '@/lib/trainer/workouts';
import { trainerResult,estimateTrainerFtp,type TrainerState } from '@/lib/trainer/session';
import { getWorkoutDistanceKm,getWorkoutDistanceByCategory } from '@/lib/workoutDistance';
import { summarizeCompletion } from '@/lib/workoutSummary';
import { grimExerciseType } from '@/lib/healthWriteSync';
import { getCardioModes } from '@/lib/cardioUnits';
const c:TrainerConfig={mode:'power',watts:150,maxWatts:250,heart:135,useFtp:false,ftp:200,percent:75,workSec:240,restSec:180,repeats:4,restWatts:100,rampStep:20,resistance:20,slope:2,freeType:'resistance'};
describe('trainerkrav',()=>{
 it('alla fem passtyper har egna styrbara konfigurationer',()=>{expect(TRAINER_WORKOUTS.map(w=>w.id)).toEqual(['power','heart','intervals','ramp','free']);for(const w of TRAINER_WORKOUTS)expect(trainerBlocks({...c,mode:w.id})).not.toHaveLength(0);});
 it('FTP-mål använder sparad FTP',()=>{expect(trainerBlocks({...c,useFtp:true,ftp:200,percent:75})[0].watts).toBe(150);expect(()=>trainerBlocks({...c,useFtp:true,ftp:null})).toThrow();});
 it('intervaller växlar automatiskt arbete och vila',()=>{const blocks=trainerBlocks({...c,mode:'intervals'});expect(blocks).toHaveLength(7);expect(blockAt(blocks,240)?.watts).toBe(100);expect(blockAt(blocks,420)?.label).toBe('Arbete 2/4');expect(blockAt(blocks,1500)).toBeNull();});
 it('inmatning blir numerisk före schemaläggning',()=>{const raw={...c,workSec:'240',repeats:'4'} as unknown as TrainerConfig;expect(normalizedTrainerConfig(raw).workSec).toBe(240);expect(blockAt(trainerBlocks({...raw,mode:'intervals'}),420)?.watts).toBe(150);});
 it('ramp ökar med 20 W varje minut',()=>{const b=trainerBlocks({...c,mode:'ramp'});expect(blockAt(b,60)?.watts).toBe(170);});
 it('pulsstyrning kan aldrig överskrida watt-taket',()=>{expect(heartTarget(249,100,1,85,135,250)).toBe(250);});
 it('saknad puls kan inte öka motståndet',()=>{expect(heartTarget(200,null,0,85,135,250)).toBe(50);});
 it('gammal puls sänker till säker effekt',()=>{expect(heartTarget(200,100,11,85,135,250)).toBe(50);});
 it('stoppad trampning sänker motståndet',()=>{expect(heartTarget(200,100,0,0,135,250)).toBe(50);});
 it('pulsreglering är långsam och har dödband',()=>{expect(heartTarget(100,130,0,85,135,250)).toBe(103);expect(heartTarget(100,136,0,85,135,250)).toBe(100);});
 it('cykeltrainer är cykeldistans tillsammans med vanlig cykel',()=>{const lw={'__cond__Cykeltrainer':JSON.stringify({time:'60',dist:'30',tempo:'200',distanceSource:'trainer'}),'__cond__Cykling':JSON.stringify({time:'30',dist:'15',tempo:'30'})};expect(getWorkoutDistanceByCategory({loggedWeights:lw,loggedDistanceKm:null,planDetails:'Cykeltrainer; Cykling'})).toEqual({cykling:45});expect(getWorkoutDistanceKm({loggedWeights:lw,loggedDistanceKm:45,planDetails:'Cykeltrainer; Cykling'})).toBe(45);});
 it('watt utan uppmätt distans blir inte påhittade kilometer',()=>{const lw={'__cond__Cykeltrainer':JSON.stringify({time:'60',dist:'0',tempo:'200',distanceSource:'trainer'})};expect(getWorkoutDistanceByCategory({loggedWeights:lw,loggedDistanceKm:0,planDetails:'Cykeltrainer'})).toEqual({});expect(summarizeCompletion(lw).cardio?.distanceKm).toBe(0);});
 it('trainer visas i watt och exporteras som stationär cykling',()=>{expect(getCardioModes('Cykeltrainer')[0]).toBe('watt');expect(grimExerciseType('Cykeltrainer')).toBe('biking_stationary');});
});
describe('FTMS',()=>{
 it('tolkar valfria fält efter flaggorna',()=>{const v=new DataView(new ArrayBuffer(13));v.setUint16(0,4|16|64|512,true);v.setUint16(2,3000,true);v.setUint16(4,170,true);v.setUint8(6,0x10);v.setUint8(7,0x27);v.setInt16(9,220,true);v.setUint8(11,135);expect(parseBikeData(v)).toEqual({speed:30,cadence:85,distance:10000,watts:220,heart:135});});
 it('saknade fält blir inte nollor',()=>{expect(parseBikeData(new DataView(new Uint8Array([1,0]).buffer))).toEqual({});});
 it('avvisar trasiga paket',()=>{expect(()=>parseBikeData(new DataView(new Uint8Array([64,0,0]).buffer))).toThrow();});
 it('skriver ERG-mål i little endian',()=>{const v=command(5,300);expect([...new Uint8Array(v.buffer)]).toEqual([5,44,1]);});
 it('kontrollkonflikt är ett fel, inte en lyckad anslutning',()=>{expect(()=>commandResult(new DataView(new Uint8Array([128,0,5]).buffer),0)).toThrow('annan app');});
});
describe('sparad tränarmätning',()=>{
 const start=Date.UTC(2026,10,28,7);const points=Array.from({length:13},(_,i)=>({t:start+i*5000,d:i*50,pw:200,cad:85,hr:135,speed:36}));
 it('tidsserie och aggregerat resultat följer samma mätning',()=>{const s={slot:'u:p:0',startedAt:start,elapsed:60,distance:600,mode:'power',points} as TrainerState;const r=trainerResult(s);expect(r.time).toBe('1');expect(r.dist).toBe('0.6');expect(r.avg_watt).toBe(200);expect(r.series?.pw?.[0]).toBe(200);expect(r.series?.hr?.[0]).toBe(135);expect(r.series?.cad?.[0]).toBe(85);expect(r.series?.hr.length).toBeLessThanOrEqual(600);});
 it('wattserier bevaras även utan puls eller distans',()=>{const series=buildWorkoutSeries({start,end:start+60000,power:points.map(p=>({t:p.t,v:200}))});expect(series?.pw?.[0]).toBe(200);expect(parseWorkoutSeries(series)?.pw?.[0]).toBe(200);});
 it('FTP-test baseras på uppmätt minut, inte måleffekt',()=>{expect(estimateTrainerFtp(points)).toBe(150);expect(estimateTrainerFtp(points.slice(0,4))).toBeNull();expect(estimateTrainerFtp(points.map((p,i)=>i===5?{...p,pw:null}:p))).toBeNull();});
});
