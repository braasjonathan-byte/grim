package se.grim.app;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** The service, not the WebView, owns GATT and workout timing. */
@CapacitorPlugin(name="GrimTrainer")
public class GrimTrainerPlugin extends Plugin {
    @PluginMethod public void connect(PluginCall call) {
        if (Build.VERSION.SDK_INT < 31) { call.reject("Cykeltrainer kräver Android 12 eller senare."); return; }
        if (getContext().checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
            call.reject("Tillåt Bluetooth innan du ansluter."); return;
        }
        if (GrimTrainerService.instance != null) { call.reject("Avsluta den befintliga traineranslutningen först."); return; }
        String device=call.getString("trainer"), slot=call.getString("slot");
        if(device==null || slot==null){call.reject("Trainer och pass saknas.");return;}
        Intent i=new Intent(getContext(),GrimTrainerService.class);
        i.putExtra("trainer",device);i.putExtra("heart",call.getString("heart", ""));i.putExtra("slot",slot);
        try{getContext().startForegroundService(i);call.resolve();}catch(Exception e){call.reject("Kunde inte starta traineranslutningen.");}
    }
    @PluginMethod public void state(PluginCall call) {
        try { call.resolve(JSObject.fromJSONObject(GrimTrainerService.state(getContext()))); }
        catch(Exception e){call.reject("Kunde inte läsa trainerpasset.");}
    }
    @PluginMethod public void action(PluginCall call) {
        GrimTrainerService s=GrimTrainerService.instance;
        String action=call.getString("action", "");
        if(s==null){
            if("clear".equals(action)){getContext().getSharedPreferences("grim_trainer",0).edit().clear().apply();call.resolve();return;}
            call.reject("Anslut trainern igen. Sparad mätning finns kvar.");return;
        }
        s.handler.post(()->{try{s.action(action,call.getData());if("finish".equals(action)){waitForStop(s,call,android.os.SystemClock.elapsedRealtime()+8500);}else call.resolve();}catch(Exception e){call.reject(e.getMessage());}});
    }
    private void waitForStop(GrimTrainerService s,PluginCall call,long deadline){
        if(s.stopAcknowledged){call.resolve();return;}
        if(android.os.SystemClock.elapsedRealtime()>deadline){call.reject("Trainern bekräftade inte stopp. Mätningen finns kvar.");return;}
        s.handler.postDelayed(()->waitForStop(s,call,deadline),100);
    }
}
