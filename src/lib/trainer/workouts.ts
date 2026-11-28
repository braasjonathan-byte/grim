import { validateNumber, type RuleName } from '@/lib/inputValidation';
export type TrainerMode = 'power' | 'heart' | 'intervals' | 'ramp' | 'free';
export const TRAINER_WORKOUTS = [
  { id: 'power', title: 'Power ERG', subtitle: 'Fast watt eller procent av FTP', icon: 'Zap' },
  { id: 'heart', title: 'Pulsstyrt ERG', subtitle: 'Målpuls med begränsad effekt', icon: 'Heart' },
  { id: 'intervals', title: 'Intervaller', subtitle: 'Automatisk växling mellan arbete och vila', icon: 'Timer' },
  { id: 'ramp', title: 'Ramp / FTP-test', subtitle: 'Stegvis ökning med uppskattad FTP', icon: 'TrendingUp' },
  { id: 'free', title: 'Fri körning / lutning', subtitle: 'Välj motstånd eller simulerad lutning', icon: 'Mountain' },
] as const;
export interface TrainerConfig {
  mode: TrainerMode; watts: number; maxWatts: number; heart: number;
  useFtp: boolean; ftp: number | null; percent: number;
  workSec: number; restSec: number; repeats: number; restWatts: number;
  rampStep: number; resistance: number; slope: number; freeType: 'resistance' | 'slope';
}
export interface TrainerBlock { seconds: number; watts: number; label: string }
export function normalizedTrainerConfig(c: TrainerConfig): TrainerConfig {
  const normalized = { ...c };
  for (const key of ["watts","maxWatts","heart","percent","workSec","restSec","repeats","restWatts","rampStep","resistance","slope"] as const) {
    normalized[key] = Number(String(c[key]).replace(",", "."));
  }
  validateTrainerConfig(normalized);
  return normalized;
}
export function validateTrainerConfig(c: TrainerConfig): void {
  const fields: [number, RuleName][] = [[c.watts,'trainerWatts'],[c.maxWatts,'trainerWatts'],[c.heart,'pulseBpm'],[c.percent,'trainerPercent'],[c.workSec,'trainerSeconds'],[c.restSec,'trainerSeconds'],[c.repeats,'trainerRepeats'],[c.restWatts,'trainerWatts'],[c.rampStep,'trainerRampStep'],[c.resistance,'trainerResistance'],[c.slope,'trainerSlope']];
  for (const [v, rule] of fields) { const r = validateNumber(v, rule); if(r.error || r.value === null) throw new Error(r.error || 'Fyll i alla värden.'); }
  if(c.useFtp && !(c.ftp && c.ftp > 0)) throw new Error('Spara FTP i inställningarna eller välj watt.');
  if (c.maxWatts < 25) throw new Error('Effekttaket måste vara minst 25 W.');
}
export function targetWatts(c: TrainerConfig): number {
  return Math.round(c.useFtp && c.ftp ? c.ftp * c.percent / 100 : c.watts);
}
export function trainerBlocks(raw: TrainerConfig): TrainerBlock[] {
  const c = normalizedTrainerConfig(raw);
  const power = targetWatts(c);
  if (power > 1500 || power < 25) throw new Error('Måleffekten måste vara 25–1500 W.');
  if(c.mode === 'intervals') return Array.from({length:c.repeats},(_,i)=>[
    {seconds:c.workSec, watts:power,label:`Arbete ${i+1}/${c.repeats}`},
    ...(i+1<c.repeats?[{seconds:c.restSec,watts:c.restWatts,label:`Vila ${i+1}/${c.repeats}`}]:[]),
  ]).flat();
  if(c.mode === 'ramp') return Array.from({length: Math.min(60, Math.floor((1500-power)/c.rampStep)+1)},(_,i)=>({seconds:60,watts:power+i*c.rampStep,label:`Steg ${i+1}`}));
  return [{seconds:86400,watts:c.mode==='heart'?Math.min(power,c.maxWatts):power,label:TRAINER_WORKOUTS.find(w=>w.id===c.mode)?.title || ''}];
}
export function blockAt(blocks: TrainerBlock[], seconds: number) {
  let from = 0;
  for(let i=0;i<blocks.length;i++){const b=blocks[i]; if(seconds<from+b.seconds)return { ...b,index:i,remaining:Math.ceil(from+b.seconds-seconds)}; from+=b.seconds;}
  return null;
}
/** Slow bounded adjustments; stale HR or stopped pedalling may never raise power. */
export function heartTarget(current: number, bpm: number | null, ageSec: number, cadence: number | null, target: number, cap: number): number {
  if(bpm===null || ageSec>10 || cadence===null || cadence<30)return Math.min(current,50,cap);
  const delta=target-bpm;
  return Math.max(25,Math.min(cap,current+(delta>3?3:delta< -3?-5:0)));
}
