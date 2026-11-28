package se.grim.app;

import android.app.*;
import android.bluetooth.*;
import android.content.*;
import android.os.*;
import androidx.core.app.NotificationCompat;
import org.json.*;
import java.util.*;

/** Native connectedDevice foreground service: survives background/locked WebView. */
public class GrimTrainerService extends Service {
    public static volatile GrimTrainerService instance;
    public final Handler handler=new Handler(Looper.getMainLooper());
    private static final String CHANNEL="grim_trainer";
    private static final int NOTIFICATION=7310;
    private static UUID id(String shortId){return UUID.fromString("0000"+shortId+"-0000-1000-8000-00805f9b34fb");}
    private static final UUID FTMS=id("1826"), DATA=id("2ad2"), CONTROL=id("2ad9"), FEATURE=id("2acc"), HR=id("180d"), HRDATA=id("2a37"), CCC=UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");
    private BluetoothGatt trainer,band;
    private BluetoothGattCharacteristic control;
    private final ArrayDeque<Runnable> queue=new ArrayDeque<>();
    private boolean busy=false,ready=false,heartReady=false,powerSupported=false,resistanceSupported=false,slopeSupported=false;
    private int pending=-1,desired=-1,current=100,reconnects=0;
    private int minPower=25,maxPower=1500,powerStep=1; private double minResistance=0,maxResistance=100,resistanceStep=0.1;
    private boolean rangeRead=false,resistanceRangeRead=false;
    private Runnable timeout;
    private String phase="connecting",slot="",trainerId="",bandId="",error="",label="",mode="power";
    private JSONObject config=new JSONObject(); private JSONArray blocks=new JSONArray(),points=new JSONArray();
    private Double watts=null,cadence=null,speed=null,heart=null,rawDistance=null,lastDistance=null;
    private long dataAt=0,heartAt=0,powerAt=0,cadenceAt=0,speedAt=0,start=0,lastTick=0,lastSample=0,lastHeartControl=0,created=0;
    private double elapsed=0,distance=0,offset=0; private int blockIndex=-1;
    private PowerManager.WakeLock lock;
    private boolean closed=false;
    public volatile boolean stopAcknowledged=false;
    private synchronized JSONObject snapshot(){
        JSONObject o=new JSONObject();try{
            o.put("slot",slot).put("phase",phase).put("error",error).put("connected",ready).put("heartConnected",heartReady)
             .put("powerSupported",powerSupported && rangeRead).put("resistanceSupported",resistanceSupported && resistanceRangeRead).put("slopeSupported",slopeSupported)
             .put("watts",watts==null?JSONObject.NULL:watts).put("cadence",cadence==null?JSONObject.NULL:cadence)
             .put("speed",speed==null?JSONObject.NULL:speed).put("heart",heart==null?JSONObject.NULL:heart)
             .put("stopAcknowledged",stopAcknowledged).put("target",current).put("elapsed",elapsed).put("distance",distance).put("startedAt",start)
             .put("mode",mode).put("label",label).put("points",new JSONArray(points.toString()));
        }catch(JSONException ignored){}return o;
    }
    public static JSONObject state(Context c){
        GrimTrainerService s=instance;if(s!=null)return s.snapshot();
        try{JSONObject o=new JSONObject(c.getSharedPreferences("grim_trainer",0).getString("session","{}"));
            if("running".equals(o.optString("phase")) || "paused".equals(o.optString("phase"))){o.put("phase","interrupted").put("error","Passet avbröts av systemet. Sparad mätning kan avslutas och sparas.");}
            o.put("connected",false);return o;
        }catch(Exception e){return new JSONObject();}
    }
    private void persist(){getSharedPreferences("grim_trainer",0).edit().putString("session",snapshot().toString()).apply();}
    @Override public void onCreate(){super.onCreate();instance=this;created=SystemClock.elapsedRealtime();
        NotificationManager nm=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);
        nm.createNotificationChannel(new NotificationChannel(CHANNEL,"Cykeltrainer",NotificationManager.IMPORTANCE_LOW));
        startForeground(NOTIFICATION,notification());
        lock=((PowerManager)getSystemService(POWER_SERVICE)).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK,"Grim:trainer");
        handler.post(tick);
    }
    @Override public int onStartCommand(Intent i,int flags,int startId){
        if(i==null){stopSelf();return START_NOT_STICKY;}
        if("STOP".equals(i.getAction())){finish();return START_NOT_STICKY;}
        trainerId=i.getStringExtra("trainer");bandId=i.getStringExtra("heart");slot=i.getStringExtra("slot");
        if(trainerId==null){stopSelf();return START_NOT_STICKY;}
        BluetoothManager manager=(BluetoothManager)getSystemService(BLUETOOTH_SERVICE);
        try {trainer=manager.getAdapter().getRemoteDevice(trainerId).connectGatt(this,false,callback,BluetoothDevice.TRANSPORT_LE);
            if(bandId!=null && !bandId.isEmpty())band=manager.getAdapter().getRemoteDevice(bandId).connectGatt(this,false,callback,BluetoothDevice.TRANSPORT_LE);
        }catch(Exception e){fail("Kunde inte ansluta Bluetooth.");}
        return START_NOT_STICKY;
    }
    private Notification notification(){
        Intent open=new Intent(this,MainActivity.class);open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi=PendingIntent.getActivity(this,7310,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        Intent stop=new Intent(this,GrimTrainerService.class).setAction("STOP");
        PendingIntent si=PendingIntent.getService(this,7311,stop,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        String text=(watts==null?"–":Math.round(watts))+" W · "+(heart==null?"–":Math.round(heart))+" bpm · "+String.format(Locale.US,"%.2f",distance/1000)+" km · "+(int)(elapsed/60)+" min";
        return new NotificationCompat.Builder(this,CHANNEL).setSmallIcon(getApplicationInfo().icon).setContentTitle("Cykeltrainer · "+phaseLabel()).setContentText(text).setContentIntent(pi).setOngoing(true).setOnlyAlertOnce(true).addAction(0,"Avsluta",si).build();
    }
    private String phaseLabel(){return "running".equals(phase)?label:"paused".equals(phase)?"Pausad":"finished".equals(phase)?"Avslutat":"Ansluter";}
    private void enqueue(Runnable r){queue.add(r);pump();}
    private void pump(){if(busy||queue.isEmpty()||closed)return;busy=true;timeout=()->{pending=-1;busy=false;queue.clear();fail("Trainern svarade inte. Passet har pausats.");};handler.postDelayed(timeout,8000);try{queue.remove().run();}catch(Exception e){fail("Bluetooth-kommandot misslyckades.");done();}}
    private void done(){if(timeout!=null)handler.removeCallbacks(timeout);busy=false;pump();}
    @SuppressWarnings("deprecation") private void subscribe(BluetoothGatt g,BluetoothGattCharacteristic c,boolean indication){
        if(c==null){fail("Nödvändig Bluetooth-tjänst saknas.");return;}
        enqueue(()->{g.setCharacteristicNotification(c,true);BluetoothGattDescriptor d=c.getDescriptor(CCC);if(d==null){fail("Bluetooth-notiser saknas.");done();return;}d.setValue(indication?BluetoothGattDescriptor.ENABLE_INDICATION_VALUE:BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);if(!g.writeDescriptor(d)){fail("Kunde inte aktivera Bluetooth-notiser.");done();}});
    }
    @SuppressWarnings("deprecation") private void read(BluetoothGatt g,BluetoothGattCharacteristic c){if(c!=null)enqueue(()->{if(!g.readCharacteristic(c)){fail("Kunde inte läsa trainerns funktioner.");done();}});}
    @SuppressWarnings("deprecation") private void send(int op,int value){
        if(control==null || trainer==null)return;
        enqueue(()->{pending=op;byte[] b=GrimTrainerProtocol.command(op,value);
            control.setWriteType(BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT);control.setValue(b);if(!trainer.writeCharacteristic(control)){pending=-1;fail("Kunde inte skicka trainerkommando.");done();}});
    }
    private void fail(String message){error=message;if("running".equals(phase)){phase="paused";releaseLock();}persist();}
    private final BluetoothGattCallback callback=new BluetoothGattCallback(){
        @Override public void onConnectionStateChange(BluetoothGatt g,int status,int state){handler.post(()->{
            if(closed)return;
            if(state==BluetoothProfile.STATE_CONNECTED && status==BluetoothGatt.GATT_SUCCESS){g.discoverServices();return;}
            if(g==band){heartReady=false;heart=null;heartAt=0;return;}
            ready=false;watts=null;cadence=null;speed=null;lastDistance=null;
            if(timeout!=null)handler.removeCallbacks(timeout);busy=false;pending=-1;queue.clear();control=null;
            fail("Traineranslutningen tappades. Återanslut och återuppta manuellt.");
            if(!"finished".equals(phase) && reconnects++<3)handler.postDelayed(()->{if(!closed)g.connect();},2000);
        });}
        @Override public void onServicesDiscovered(BluetoothGatt g,int status){handler.post(()->{
            if(status!=BluetoothGatt.GATT_SUCCESS){fail("Kunde inte läsa Bluetooth-tjänster.");return;}
            if(g==band){BluetoothGattService h=g.getService(HR);if(h==null){fail("Pulsmätaren saknar pulstjänst.");return;}subscribe(g,h.getCharacteristic(HRDATA),false);return;}
            BluetoothGattService f=g.getService(FTMS);if(f==null){fail("Trainern stöder inte FTMS.");return;}
            control=f.getCharacteristic(CONTROL);
            read(g,f.getCharacteristic(FEATURE));
            read(g,f.getCharacteristic(id("2ad8")));read(g,f.getCharacteristic(id("2ad6")));
            subscribe(g,f.getCharacteristic(DATA),false);subscribe(g,control,true);
            send(0,0);
        });}
        @Override public void onDescriptorWrite(BluetoothGatt g,BluetoothGattDescriptor d,int status){handler.post(()->{if(status!=0)fail("Kunde inte aktivera trainerdata.");else if(g==band)heartReady=true;done();});}
        @Override public void onCharacteristicRead(BluetoothGatt g,BluetoothGattCharacteristic c,int status){final byte[] b=c.getValue();handler.post(()->{
            if(status!=0){fail("Kunde inte läsa trainerns gränser.");done();return;}
            if(c.getUuid().equals(FEATURE) && b!=null && b.length>=8){long f=u32(b,4);powerSupported=(f&(1L<<3))!=0;resistanceSupported=(f&(1L<<2))!=0;slopeSupported=(f&(1L<<13))!=0;}
            if(c.getUuid().equals(id("2ad8")) && b!=null && b.length>=6){minPower=Math.max(25,s16(b,0));maxPower=Math.min(1500,s16(b,2));powerStep=Math.max(1,u16(b,4));rangeRead=true;}
            if(c.getUuid().equals(id("2ad6")) && b!=null && b.length>=6){minResistance=s16(b,0)/10.0;maxResistance=s16(b,2)/10.0;resistanceStep=Math.max(0.1,u16(b,4)/10.0);resistanceRangeRead=true;}
            done();
        });}
        @Override public void onCharacteristicWrite(BluetoothGatt g,BluetoothGattCharacteristic c,int status){handler.post(()->{if(status!=0){pending=-1;fail("Trainern avvisade skrivningen.");done();}});}
        @Override public void onCharacteristicChanged(BluetoothGatt g,BluetoothGattCharacteristic c){final byte[] b=c.getValue();handler.post(()->{
            if(b==null||closed)return;
            if(c.getUuid().equals(CONTROL)){if(b.length>=3&&(b[0]&255)==128&&(b[1]&255)==pending){int op=pending;pending=-1;
                if((b[2]&255)!=1){queue.clear();fail((b[2]&255)==5?"Trainern styrs av en annan app.":"Trainern avvisade kommandot.");}
                else if(op==8 && "finished".equals(phase)){stopAcknowledged=true;}
                else if(op==0){ready=true;if("connecting".equals(phase))phase="ready";error="";}
                done();}return;}
            if(c.getUuid().equals(HRDATA)){try{int h=(b[0]&1)==0?(b[1]&255):u16(b,1);if(h>=30&&h<=220){heart=(double)h;heartAt=SystemClock.elapsedRealtime();}}catch(Exception ignored){}return;}
            if(c.getUuid().equals(DATA))parse(b);
        });}
    };
    private static int u16(byte[] b,int o){return (b[o]&255)|((b[o+1]&255)<<8);}
    private static int s16(byte[] b,int o){return (short)u16(b,o);}
    private static long u32(byte[] b,int o){return (b[o]&255L)|((b[o+1]&255L)<<8)|((b[o+2]&255L)<<16)|((b[o+3]&255L)<<24);}
    private void parse(byte[] b){try{
        GrimTrainerProtocol.Reading r=GrimTrainerProtocol.parse(b);
        Double sp=r.speed,ca=r.cadence,pw=r.power,di=r.distance,hr=r.heart;
        long now=SystemClock.elapsedRealtime();dataAt=now;
        if(sp!=null&&sp>=0&&sp<=108){speed=sp;speedAt=now;}if(ca!=null&&ca>=0&&ca<=250){cadence=ca;cadenceAt=now;}if(pw!=null&&pw>=0&&pw<=2500){watts=pw;powerAt=now;}
        if(hr!=null&&!heartReady&&hr>=30&&hr<=220){heart=hr;heartAt=now;}
        if(di!=null){rawDistance=di;if("running".equals(phase)&&lastDistance!=null){double d=di-lastDistance;if(d>=0&&d<=300)distance+=d;}lastDistance=di;}
    }catch(Exception ignored){}}
    public void action(String a,JSONObject data)throws Exception{
        if("clear".equals(a)){if("finished".equals(phase)&&!stopAcknowledged)throw new Exception("Vänta på bekräftat stopp. Mätningen finns kvar.");if("running".equals(phase)||"paused".equals(phase))throw new Exception("Avsluta passet först.");getSharedPreferences("grim_trainer",0).edit().clear().apply();stopSelf();return;}
        if("disconnect".equals(a)){if("running".equals(phase)||"paused".equals(phase))throw new Exception("Avsluta och spara passet först.");stopSelf();return;}
        if("finish".equals(a)){finish();return;}
        if("pause".equals(a)){if(!"running".equals(phase))return;phase="paused";send(8,2);releaseLock();persist();return;}
        if("adjust".equals(a)){offset=Math.max(-200,Math.min(200,data.optInt("offset")));return;}
        if("resume".equals(a)){if(!ready||!"paused".equals(phase))throw new Exception("Anslut trainern innan du återupptar.");if("heart".equals(mode)&&(heart==null||SystemClock.elapsedRealtime()-heartAt>10000))throw new Exception("En aktuell puls krävs.");send(7,0);lastDistance=rawDistance;desired=-1;lastTick=SystemClock.elapsedRealtime();phase="running";lock.acquire(26*60*60*1000L);error="";return;}
        if(!"start".equals(a))return;
        if(!ready||"running".equals(phase)||"paused".equals(phase))throw new Exception("Trainern är inte redo för ett nytt pass.");
        config=data.getJSONObject("config");blocks=data.getJSONArray("blocks");mode=config.getString("mode");
        if(!Arrays.asList("power","heart","intervals","ramp","free").contains(mode))throw new Exception("Okänd passtyp.");
        boolean free="free".equals(mode),slope=free&&"slope".equals(config.optString("freeType"));
        if((!free&&(!powerSupported||!rangeRead))||(free&&!slope&&(!resistanceSupported||!resistanceRangeRead))||(slope&&!slopeSupported))throw new Exception("Trainern stöder inte vald styrning.");
        if(blocks.length()<1||blocks.length()>60)throw new Exception("Ogiltiga träningsblock.");
        for(int i=0;i<blocks.length();i++){JSONObject b=blocks.getJSONObject(i);int w=b.getInt("watts"),s=b.getInt("seconds");if(w<25||w>1500||s<5||s>86400)throw new Exception("Ogiltigt träningsblock.");if(!free && (w<minPower||w>maxPower))throw new Exception("Måleffekten ligger utanför trainerns gränser.");}
        int cap=config.getInt("maxWatts");if(cap<25||cap>1500)throw new Exception("Ogiltigt watt-tak.");
        if("heart".equals(mode)){int h=config.getInt("heart");if(h<30||h>220||heart==null||SystemClock.elapsedRealtime()-heartAt>10000)throw new Exception("Anslut pulsmätare för pulsstyrning.");if(cap<minPower)throw new Exception("Watt-taket ligger under trainerns minsta effekt.");}
        if(free&&!slope){double r=config.getDouble("resistance");if(r<minResistance||r>maxResistance)throw new Exception("Motståndet ligger utanför trainerns gränser.");}
        if(slope&&(config.getDouble("slope")<0||config.getDouble("slope")>20))throw new Exception("Ogiltig lutning.");
        points=new JSONArray();start=System.currentTimeMillis();elapsed=0;distance=0;lastDistance=rawDistance;lastTick=SystemClock.elapsedRealtime();lastSample=0;blockIndex=-1;desired=-1;offset=0;current=blocks.getJSONObject(0).getInt("watts");
        phase="running";error="";send(7,0);lock.acquire(26*60*60*1000L);persist();
    }
    private final Runnable tick=new Runnable(){@Override public void run(){
        if(closed)return;long now=SystemClock.elapsedRealtime();
        if(heartAt>0&&now-heartAt>10000)heart=null;
        if(now-powerAt>10000)watts=null;
        if(now-cadenceAt>10000)cadence=null;
        if(now-speedAt>10000)speed=null;
        if("running".equals(phase)){
            double dt=lastTick>0?(now-lastTick)/1000.0:0;lastTick=now;elapsed+=dt;
            if(dataAt==0||now-dataAt>10000){phase="paused";error="Trainerdata saknas. Passet har pausats.";send(8,2);releaseLock();persist();}
            else {
                if(rawDistance==null&&speed!=null&&dt<=10)distance+=speed/3.6*dt;
                try{
                    double from=0;JSONObject b=null;int index=0;for(;index<blocks.length();index++){JSONObject candidate=blocks.getJSONObject(index);if(elapsed<from+candidate.getInt("seconds")){b=candidate;break;}from+=candidate.getInt("seconds");}
                    if(b==null){finish();}else{
                        label=b.getString("label");int target=b.getInt("watts")+(int)offset;
                        if("heart".equals(mode)){
                            int cap=Math.min(maxPower,config.getInt("maxWatts"));
                            if(now-lastHeartControl>=10000){lastHeartControl=now;
                                if(heart==null||cadence==null||cadence<30)error="Puls eller kadens saknas: låg säker effekt."; else error="";
                                current=GrimTrainerProtocol.heartTarget(current,heart,now-heartAt,cadence,config.getInt("heart"),cap,minPower);

                            } target=current;
                        }
                        if("free".equals(mode)){
                            if(index!=blockIndex){if("slope".equals(config.optString("freeType"))){send(17,(int)Math.round(config.getDouble("slope")*100));}else{double r=config.getDouble("resistance");r=minResistance+Math.round((r-minResistance)/resistanceStep)*resistanceStep;send(4,(int)Math.round(r*10));}}
                        }else{
                            target=minPower+Math.round((Math.max(minPower,Math.min(maxPower,target))-minPower)/(float)powerStep)*powerStep;target=Math.min(maxPower,target);
                            if("heart".equals(mode))target=Math.min(target,config.getInt("maxWatts"));
                            current=target;if(target!=desired&&!busy){desired=target;send(5,target);}
                        }
                        blockIndex=index;
                    }
                }catch(Exception e){fail("Kunde inte styra träningsblocket.");send(8,2);}
                if("running".equals(phase)&&now-lastSample>=5000){lastSample=now;try{JSONObject p=new JSONObject().put("t",System.currentTimeMillis()).put("d",Math.round(distance)).put("pw",watts==null?JSONObject.NULL:watts).put("cad",cadence==null?JSONObject.NULL:cadence).put("hr",heart==null?JSONObject.NULL:heart).put("speed",speed==null?JSONObject.NULL:speed);if(points.length()<17280)points.put(p);}catch(Exception ignored){}persist();}
            }
        }
        if(("ready".equals(phase)||"connecting".equals(phase))&&now-created>300000){stopSelf();return;}
        ((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).notify(NOTIFICATION,notification());handler.postDelayed(this,1000);
    }};
    private void releaseLock(){if(lock!=null&&lock.isHeld())lock.release();}
    private void finish(){if("finished".equals(phase))return;phase="finished";stopAcknowledged=false;releaseLock();send(8,1);persist();handler.postDelayed(()->{stopSelf();},9000);}
    @Override public void onDestroy(){closed=true;handler.removeCallbacksAndMessages(null);releaseLock();if(trainer!=null){trainer.disconnect();trainer.close();}if(band!=null){band.disconnect();band.close();}instance=null;stopForeground(STOP_FOREGROUND_REMOVE);super.onDestroy();}
    @Override public IBinder onBind(Intent i){return null;}
}
