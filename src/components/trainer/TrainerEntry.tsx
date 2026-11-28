import { useEffect, useState } from 'react';
import { Bike, Bluetooth, Heart, Zap, Timer, TrendingUp, Mountain, Play, Pause, Square, Minus, Plus, Check, Loader2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import PulseAnalysis from '@/components/PulseAnalysis';
import { TRAINER_WORKOUTS, trainerBlocks, targetWatts, normalizedTrainerConfig, type TrainerConfig, type TrainerMode } from '@/lib/trainer/workouts';
import { chooseTrainerDevice, connectTrainer, trainerState, trainerAction, trainerResult, estimateTrainerFtp, nativeTrainer, trainerSupported, type TrainerState, type Device } from '@/lib/trainer/session';
import { validateNumber, validateCardioEntry, type RuleName } from '@/lib/inputValidation';
const icons={Zap,Heart,Timer,TrendingUp,Mountain};
const clock=(n:number)=>`${Math.floor(n/3600)>0?Math.floor(n/3600)+':':''}${String(Math.floor(n/60)%60).padStart(2,'0')}:${String(Math.floor(n)%60).padStart(2,'0')}`;
const initial:TrainerConfig={mode:'power',watts:150,maxWatts:250,heart:135,useFtp:false,ftp:null,percent:75,workSec:240,restSec:180,repeats:4,restWatts:100,rampStep:20,resistance:20,slope:2,freeType:'resistance'};
export default function TrainerEntry({planId,lineIndex,savedData,onSave,onDelete}:{planId:string;lineIndex:number;savedData:Record<string,any>|null;onSave:(d:Record<string,any>)=>Promise<void>;onDelete:()=>void}){
  const [open,setOpen]=useState(false),[view,setView]=useState<'setup'|'live'>('setup');
  const [userId,setUserId]=useState(''),[trainer,setTrainer]=useState<Device|null>(null),[band,setBand]=useState<Device|null>(null);
  const [config,setConfig]=useState(initial),[snapshot,setSnapshot]=useState<TrainerState|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[adjust,setAdjust]=useState(0),[ftpOffer,setFtpOffer]=useState<number|null>(null);
  const [saved,setSaved]=useState(savedData);
  const slot=`${userId}:${planId}:${lineIndex}`;
  useEffect(()=>{let mounted=true;supabase.auth.getUser().then(async({data})=>{
    if(!data.user||!mounted)return;setUserId(data.user.id);
    const r=await supabase.from('profiles').select('ftp_watt').eq('user_id',data.user.id).maybeSingle();
    if(mounted&&r.data?.ftp_watt)setConfig(c=>({...c,ftp:r.data.ftp_watt,maxWatts:Math.min(1500,Math.round(r.data.ftp_watt*1.2))}));
    if(sessionStorage.getItem('grim_trainer_open')===planId){sessionStorage.removeItem('grim_trainer_open');if(mounted)setOpen(true);}
  });return()=>{mounted=false;};},[planId]);
  useEffect(()=>{setSaved(savedData);},[savedData]);
  useEffect(()=>{if(!open||!userId)return;let live=true,reading=false;
    const read=async()=>{if(reading)return;reading=true;try{const s=await trainerState();if(live){setSnapshot(s);if(s.slot===slot&&['running','paused','finished','interrupted'].includes(s.phase))setView('live');}}catch(e){if(live)setError(e instanceof Error?e.message:'Kunde inte läsa passet.');}finally{reading=false;}};
    void read();const t=setInterval(()=>{void read();},1000);return()=>{live=false;clearInterval(t);};
  },[open,userId,slot]);
  const mine=snapshot?.slot===slot?snapshot:null;
  const active=mine&&['running','paused'].includes(mine.phase);
  const run=async(work:()=>Promise<void>)=>{if(busy)return;setBusy(true);setError('');try{await work();setSnapshot(await trainerState());}catch(e){setError(e instanceof Error?e.message:'Åtgärden misslyckades.');}finally{setBusy(false);}};
  const choose=(kind:'trainer'|'heart')=>run(async()=>{const d=await chooseTrainerDevice(kind);if(kind==='trainer')setTrainer(d);else setBand(d);});
  const connect=()=>run(async()=>{if(!trainer)throw new Error('Välj trainer.');
    if(nativeTrainer && band){const {disconnectHeartRate}=await import('@/lib/heartRate');await disconnectHeartRate();}
    await connectTrainer(slot,trainer,band);
  });
  const start=()=>run(async()=>{const clean=normalizedTrainerConfig(config);const blocks=trainerBlocks(clean);await trainerAction('start',{config:clean,blocks});setConfig(clean);setView('live');});
  const save=()=>run(async()=>{
    let state=await trainerState();if(state.slot!==slot)throw new Error('Mätningen hör till ett annat träningskort.');
    if(state.phase==='running'||state.phase==='paused'){await trainerAction('finish');state=await trainerState();}
    if(state.elapsed<60)throw new Error('Passet behöver minst en minuts registrering för att sparas. Mätningen finns kvar.');
    const result=trainerResult(state);const valid=validateCardioEntry({sport:'Cykeltrainer',timeMin:result.time,distanceKm:result.dist});if(!valid.valid)throw new Error(valid.error||'Kontrollera mätvärdena.');
    // Clear the native draft only after the existing completion writer confirms/queues the write.
    await onSave(result);setSaved(result);if(state.mode==='ramp')setFtpOffer(estimateTrainerFtp(state.points));
    await trainerAction('clear');setView('setup');setOpen(false);toast.success('Trainerpass sparat');
  });
  const field=(key:keyof TrainerConfig,label:string,rule:RuleName)=><label key={key} className="block min-w-0 space-y-1 text-xs text-muted-foreground"><span>{label}</span><Input aria-label={label} type="text" inputMode="decimal" value={String(config[key]??'')} onChange={e=>setConfig(c=>({...c,[key]:e.target.value}))} onBlur={()=>{const r=validateNumber(config[key] as number,rule);if(r.error||r.value===null)setError(r.error||'Fyll i värdet.');else setConfig(c=>({...c,[key]:r.value}));}} /></label>;
  const selectedSupported=!mine?.connected || (config.mode==='free'?(config.freeType==='slope'?mine.slopeSupported:mine.resistanceSupported):mine.powerSupported);
  const metric=(label:string,value:string,unit:string)=><div className="min-w-0 border-b border-border py-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl font-bold tabular-nums break-words">{value}<span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span></p></div>;
  return <div className="space-y-3 rounded-2xl border border-primary/30 bg-card p-3">
    <div className="flex items-center justify-between"><h3 className="flex items-center gap-2 font-bold"><Bike className="h-4 w-4 text-primary"/>Cykeltrainer</h3><Button variant="ghost" size="icon" aria-label="Ta bort Cykeltrainer" onClick={onDelete}><Square className="h-4 w-4"/></Button></div>
    {saved&&<div className="flex flex-wrap gap-x-3 gap-y-1 text-sm tabular-nums"><span>{saved.time} min</span><span>{saved.dist} km</span><span>{saved.avg_watt??saved.tempo} W</span>{saved.pulse&&<span>{saved.pulse} bpm</span>}</div>}
    <Button className="w-full gap-2" variant="outline" onClick={()=>setOpen(true)}><Bluetooth className="h-4 w-4"/>Öppna trainer</Button>
    {saved?.series&&<PulseAnalysis name="Cykeltrainer" cond={saved}/>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="trainer-dialog">
      <DialogTitle className="flex items-center gap-2 pr-7"><Bike className="h-5 w-5 text-primary"/>Cykeltrainer</DialogTitle>
      <DialogDescription>{view==='live'?'Pågående mätning':'Trainer och pulsmätare'}</DialogDescription>
      {view==='setup'?<div className="space-y-5">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button variant="outline" className="h-auto min-h-12 justify-between whitespace-normal gap-2 text-left" disabled={busy||!!mine?.connected} onClick={()=>choose('trainer')}><span className="flex items-center gap-2"><Bluetooth className="h-4 w-4 shrink-0"/>{trainer?.name||'Välj trainer'}</span><ChevronRight className="h-4 w-4 shrink-0"/></Button>
          <Button variant="outline" className="h-auto min-h-12 justify-between whitespace-normal gap-2 text-left" disabled={busy||!!mine?.connected} onClick={()=>choose('heart')}><span className="flex items-center gap-2"><Heart className="h-4 w-4 shrink-0"/>{band?.name||'Välj pulsmätare'}</span><ChevronRight className="h-4 w-4 shrink-0"/></Button>
        </div>
        {!trainerSupported&&<p role="alert" className="text-sm text-destructive">Bluetooth stöds inte här. Använd Android-appen eller en webbläsare med Bluetooth-stöd.</p>}
        {mine?.connected?<div className="flex items-center gap-2 text-sm text-success"><Check className="h-4 w-4"/>Trainer ansluten{mine.heartConnected?' · Pulsmätare ansluten':''}<Button className="ml-auto" variant="ghost" size="sm" onClick={()=>run(async()=>{await trainerAction('disconnect');setTrainer(null);})}>Koppla från</Button></div>:<Button disabled={!trainer||busy||!userId} onClick={connect} className="w-full gap-2">{busy?<Loader2 className="h-4 w-4 animate-spin"/>:<Bluetooth className="h-4 w-4"/>}Anslut</Button>}
        <div className="space-y-1" role="radiogroup" aria-label="Passtyp">{TRAINER_WORKOUTS.map(w=>{const Icon=icons[w.icon];return <Button key={w.id} variant={config.mode===w.id?'secondary':'ghost'} role="radio" aria-checked={config.mode===w.id} className="w-full h-auto min-h-16 justify-start gap-3 whitespace-normal text-left" onClick={()=>setConfig(c=>({...c,mode:w.id as TrainerMode}))}><Icon className="h-5 w-5 shrink-0 text-primary"/><span className="min-w-0 flex-1"><span className="block font-bold">{w.title}</span><span className="block text-xs font-normal text-muted-foreground">{w.subtitle}</span></span>{config.mode===w.id&&<Check className="h-4 w-4 shrink-0"/>}</Button>;})}</div>
        {config.mode!=='free'&&<div className="space-y-3"><div className="flex items-center gap-2"><Button size="sm" variant={!config.useFtp?'default':'outline'} onClick={()=>setConfig(c=>({...c,useFtp:false}))}>Watt</Button><Button size="sm" variant={config.useFtp?'default':'outline'} onClick={()=>setConfig(c=>({...c,useFtp:true}))}>% FTP</Button><span className="text-xs text-muted-foreground">FTP {config.ftp?`${config.ftp} W`:'saknas'}</span></div><div className="grid grid-cols-2 gap-3">{config.useFtp?field('percent','Mål (% FTP)','trainerPercent'):field('watts',config.mode==='ramp'?'Start (W)':'Mål (W)','trainerWatts')}{config.mode==='heart'&&field('maxWatts','Effekttak (W)','trainerWatts')}{config.mode==='heart'&&field('heart','Målpuls (bpm)','pulseBpm')}</div></div>}
        {config.mode==='intervals'&&<div className="grid grid-cols-2 gap-3">{field('workSec','Arbete (s)','trainerSeconds')}{field('restSec','Vila (s)','trainerSeconds')}{field('repeats','Antal intervaller','trainerRepeats')}{field('restWatts','Vila (W)','trainerWatts')}</div>}
        {config.mode==='ramp'&&field('rampStep','Ökning per minut (W)','trainerRampStep')}
        {config.mode==='free'&&<div className="space-y-3"><div className="flex gap-2"><Button variant={config.freeType==='resistance'?'default':'outline'} onClick={()=>setConfig(c=>({...c,freeType:'resistance'}))}>Motstånd</Button><Button variant={config.freeType==='slope'?'default':'outline'} onClick={()=>setConfig(c=>({...c,freeType:'slope'}))}>Lutning</Button></div>{config.freeType==='slope'?field('slope','Lutning (%)','trainerSlope'):field('resistance','Motstånd','trainerResistance')}</div>}
        {!selectedSupported&&<p role="alert" className="text-sm text-destructive">Trainern stöder inte vald styrning. Välj en annan passtyp.</p>}
        {!nativeTrainer&&<p className="text-xs text-muted-foreground">Låst skärm kräver Android-appen. Webbpass pausas när appen döljs.</p>}
        <Button disabled={!mine?.connected||!selectedSupported||busy} className="w-full gap-2" onClick={()=>{setView('live');setError('');}}><Play className="h-4 w-4"/>Till livevy</Button>
      </div>:<div className="space-y-4">
        <div className="flex items-center justify-between gap-2"><span className="text-sm text-primary">{mine?.label||TRAINER_WORKOUTS.find(w=>w.id===config.mode)?.title}</span><span className="font-mono text-xl tabular-nums">{clock(mine?.elapsed||0)}</span></div>
        <div className="border-y border-border py-5 text-center"><p className="text-xs text-muted-foreground">Effekt</p><p className="text-6xl font-bold tabular-nums">{mine?.watts===null||mine?.watts===undefined?'–':Math.round(mine.watts)}<span className="ml-2 text-lg text-muted-foreground">W</span></p><p className="mt-1 text-sm text-primary">Mål {mine?.target||targetWatts(config)} W {config.ftp?`· ${Math.round((mine?.watts||0)/config.ftp*100)} % FTP`:''}</p></div>
        <div className="grid grid-cols-2 gap-x-5">{metric('Puls',mine?.heart?String(Math.round(mine.heart)):'–','bpm')}{metric('Kadens',mine?.cadence!==null&&mine?.cadence!==undefined?String(Math.round(mine.cadence)):'–','rpm')}{metric('Hastighet',mine?.speed!==null&&mine?.speed!==undefined?mine.speed.toFixed(1):'–','km/h')}{metric('Distans',((mine?.distance||0)/1000).toFixed(2),'km')}</div>
        {active&&config.mode==='power'&&<div className="flex items-center justify-center gap-3"><Button variant="outline" size="icon" aria-label="Sänk 5 watt" onClick={()=>run(async()=>{const n=adjust-5;await trainerAction('adjust',{offset:n});setAdjust(n);})}><Minus className="h-4 w-4"/></Button><span className="text-sm">5 W</span><Button variant="outline" size="icon" aria-label="Höj 5 watt" onClick={()=>run(async()=>{const n=adjust+5;await trainerAction('adjust',{offset:n});setAdjust(n);})}><Plus className="h-4 w-4"/></Button></div>}
        {!mine||!['running','paused','finished','interrupted'].includes(mine.phase)?<Button className="w-full gap-2" disabled={busy||!mine?.connected} onClick={start}><Play className="h-4 w-4"/>Starta pass</Button>:<div className="grid grid-cols-2 gap-2">{mine.phase==='running'?<Button variant="outline" disabled={busy} onClick={()=>run(()=>trainerAction('pause'))}><Pause className="mr-2 h-4 w-4"/>Pausa</Button>:mine.phase==='paused'?<Button variant="outline" disabled={busy} onClick={()=>run(()=>trainerAction('resume'))}><Play className="mr-2 h-4 w-4"/>Återuppta</Button>:<span/>}<Button disabled={busy} onClick={save} className="h-auto min-h-11 whitespace-normal gap-2"><Square className="h-4 w-4 shrink-0"/>Avsluta och spara</Button></div>}
        {(mine?.phase==='finished'||mine?.phase==='interrupted')&&mine.elapsed<60&&<Button variant="destructive" disabled={busy} onClick={()=>run(async()=>{await trainerAction('clear');setView('setup');})}>Kasta kort mätning</Button>}
        {!active&&<Button variant="ghost" className="w-full" onClick={()=>setView('setup')}>Till anslutning och passval</Button>}
      </div>}
      {(error||snapshot?.error)&&<p role="alert" className="text-sm text-destructive break-words">{error||snapshot?.error}</p>}
    </DialogContent></Dialog>
    <Dialog open={ftpOffer!==null} onOpenChange={v=>{if(!v)setFtpOffer(null);}}><DialogContent><DialogTitle>Uppskattad FTP: {ftpOffer} W</DialogTitle><DialogDescription>75 % av bästa uppmätta minut under ramptestet. Det är en uppskattning, inte ett exakt mått.</DialogDescription><Button disabled={busy} onClick={()=>run(async()=>{if(!userId||ftpOffer===null)return;const r=await supabase.from('profiles').update({ftp_watt:ftpOffer}).eq('user_id',userId);if(r.error)throw r.error;setConfig(c=>({...c,ftp:ftpOffer}));setFtpOffer(null);toast.success('FTP uppdaterad');})}>Spara FTP i profilen</Button></DialogContent></Dialog>
  </div>;
}
