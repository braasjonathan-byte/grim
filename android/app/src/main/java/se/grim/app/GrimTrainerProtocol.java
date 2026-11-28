package se.grim.app;

/** Pure FTMS packet logic; kept Android-free for host regression tests. */
public final class GrimTrainerProtocol {
    private GrimTrainerProtocol(){}
    public static int u16(byte[] b,int o){return (b[o]&255)|((b[o+1]&255)<<8);}
    public static int s16(byte[] b,int o){return (short)u16(b,o);}
    public static class Reading { public Double speed,cadence,power,distance,heart; }
    public static Reading parse(byte[] b){
        int f=u16(b,0),o=2;Reading r=new Reading();
        if((f&1)==0){r.speed=u16(b,o)/100.0;o+=2;}if((f&2)!=0)o+=2;
        if((f&4)!=0){r.cadence=u16(b,o)/2.0;o+=2;}if((f&8)!=0)o+=2;
        if((f&16)!=0){r.distance=(double)((b[o]&255)|((b[o+1]&255)<<8)|((b[o+2]&255)<<16));o+=3;}
        if((f&32)!=0)o+=2;if((f&64)!=0){r.power=(double)s16(b,o);o+=2;}if((f&128)!=0)o+=2;
        if((f&256)!=0)o+=5;if((f&512)!=0){r.heart=(double)(b[o]&255);o++;}
        if(o>b.length)throw new IllegalArgumentException("Truncated FTMS packet");return r;
    }
    public static byte[] command(int op,int v){
        if(op==0||op==7)return new byte[]{(byte)op};
        if(op==8)return new byte[]{8,(byte)v};
        if(op==17)return new byte[]{17,0,0,(byte)(v&255),(byte)((v>>8)&255),40,51};
        return new byte[]{(byte)op,(byte)(v&255),(byte)((v>>8)&255)};
    }
    public static int heartTarget(int current,Double bpm,long ageMs,Double cadence,int goal,int cap,int minimum){
        int target;
        if(bpm==null||ageMs>10000||cadence==null||cadence<30)target=Math.min(current,Math.min(50,cap));
        else{double d=goal-bpm;target=current+(d>3?3:d< -3?-5:0);}
        return Math.max(minimum,Math.min(cap,target));
    }
}
