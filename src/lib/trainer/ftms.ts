export const uuid = (short: string) => `0000${short}-0000-1000-8000-00805f9b34fb`;
export const FTMS = uuid('1826');
export const BIKE_DATA = uuid('2ad2');
export const CONTROL = uuid('2ad9');
export const FEATURE = uuid('2acc');
export const HR = uuid('180d');
export const HR_DATA = uuid('2a37');
export interface BikeReading { speed?: number; watts?: number; cadence?: number; distance?: number; heart?: number }
/** FTMS optional-field flags determine offsets; absent fields are not zeroes. */
export function parseBikeData(v: DataView): BikeReading {
  if(v.byteLength<2)throw new Error('Ofullständigt trainerpaket');
  const f=v.getUint16(0,true); let o=2;
  const read=(n:number,signed=false)=>{if(o+n>v.byteLength)throw new Error('Ofullständigt trainerpaket'); let x=n===1?v.getUint8(o):n===3?v.getUint8(o)|(v.getUint8(o+1)<<8)|(v.getUint8(o+2)<<16):signed?v.getInt16(o,true):v.getUint16(o,true);o+=n;return x;};
  const skip=(n:number)=>{read(n);};
  const r: BikeReading={};
  if(!(f&1))r.speed=read(2)/100;
  if(f&2)skip(2);
  if(f&4)r.cadence=read(2)/2;
  if(f&8)skip(2);
  if(f&16)r.distance=read(3);
  if(f&32)skip(2);
  if(f&64)r.watts=read(2,true);
  if(f&128)skip(2);
  if(f&256){skip(2);skip(2);skip(1);}
  if(f&512)r.heart=read(1);
  return r;
}
export function command(opcode:number,value?:number): DataView {
  const a=new Uint8Array(value===undefined?1:3);a[0]=opcode;
  const v=new DataView(a.buffer);if(value!==undefined)v.setInt16(1,Math.round(value),true);return v;
}
export function commandResult(v: DataView,opcode:number): void {
  if(v.byteLength<3 || v.getUint8(0)!==0x80 || v.getUint8(1)!==opcode)throw new Error('Felaktigt trainersvar');
  if(v.getUint8(2)!==1)throw new Error(v.getUint8(2)===5?'Trainern styrs av en annan app. Koppla från den först.':'Trainern avvisade kommandot.');
}
