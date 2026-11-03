package se.grim.app;

import android.content.Context;
import android.content.Intent;
import android.os.Build;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** GRIM_WORKOUT_PLUGIN: JS → vilotimer-service och GPS-foreground-service. */
@CapacitorPlugin(name = "GrimWorkout")
public class GrimWorkoutPlugin extends Plugin {
    private void start(Intent i) {
        Context ctx = getContext();
        if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(i); else ctx.startService(i);
    }

    @PluginMethod
    public void startRest(PluginCall call) {
        Intent i = new Intent(getContext(), GrimRestService.class);
        i.putExtra("seconds", call.getInt("seconds", 90));
        i.putExtra("exercise", call.getString("exercise", ""));
        try { start(i); call.resolve(); } catch (Exception e) { call.reject(e.getMessage()); }
    }

    @PluginMethod
    public void stopRest(PluginCall call) {
        try { getContext().stopService(new Intent(getContext(), GrimRestService.class)); } catch (Exception ignored) { }
        call.resolve();
    }

    @PluginMethod
    public void startGps(PluginCall call) {
        Intent i = new Intent(getContext(), GrimGpsService.class);
        i.putExtra("text", call.getString("text", "Spelar in din rutt"));
        try { start(i); call.resolve(); } catch (Exception e) { call.reject(e.getMessage()); }
    }

    @PluginMethod
    public void stopGps(PluginCall call) {
        try { getContext().stopService(new Intent(getContext(), GrimGpsService.class)); } catch (Exception ignored) { }
        call.resolve();
    }
}
