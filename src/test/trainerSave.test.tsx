import { render,screen,fireEvent,waitFor } from '@testing-library/react';
import { it,expect,vi } from 'vitest';
const mocks=vi.hoisted(()=>({action:vi.fn(),state:vi.fn()}));
vi.mock('@/lib/trainer/session',()=>({nativeTrainer:true,trainerSupported:true,trainerState:mocks.state,trainerAction:mocks.action,trainerResult:()=>({time:'10',dist:'5',tempo:'150'}),estimateTrainerFtp:()=>null,chooseTrainerDevice:vi.fn(),connectTrainer:vi.fn()}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{auth:{getUser:async()=>({data:{user:{id:'u'}}})},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{ftp_watt:200}})})})})}}));
vi.mock('@/components/PulseAnalysis',()=>({default:()=>null}));
import TrainerEntry from '@/components/trainer/TrainerEntry';
it('ett misslyckat sparande behåller den färdiga trainermätningen',async()=>{
 mocks.state.mockResolvedValue({slot:'u:p:0',phase:'finished',elapsed:600,points:[],mode:'power',connected:false});
 const save=vi.fn().mockRejectedValue(new Error('Tillfälligt skrivfel'));
 render(<TrainerEntry planId="p" lineIndex={0} savedData={null} onSave={save} onDelete={vi.fn()}/>);
 fireEvent.click(screen.getByRole('button',{name:'Öppna trainer'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Avsluta och spara'})).toBeEnabled());
 fireEvent.click(screen.getByRole('button',{name:'Avsluta och spara'}));
 await waitFor(()=>expect(save).toHaveBeenCalledWith({time:'10',dist:'5',tempo:'150'}));
 await waitFor(()=>expect(mocks.action).not.toHaveBeenCalledWith('clear'));
});
