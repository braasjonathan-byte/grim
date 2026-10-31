package se.grim.app;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Iterator;

/** Bro JS → widget: sparar kcal/makro/temafärger i SharedPreferences "se.grim.app.widget". */
@CapacitorPlugin(name = "GrimWidget")
public class GrimWidgetPlugin extends Plugin {
    static volatile String pendingTab = null;

    @PluginMethod
    public void update(PluginCall call) {
        Context ctx = getContext();
        SharedPreferences.Editor e = ctx.getSharedPreferences(GrimKcalWidget.PREFS, Context.MODE_PRIVATE).edit();
        JSObject d = call.getData();
        Iterator<String> keys = d.keys();
        while (keys.hasNext()) {
            String k = keys.next();
            Object val = d.opt(k);
            if (val instanceof Number) e.putFloat(k, ((Number) val).floatValue());
            else if (val instanceof Boolean) e.putBoolean(k, (Boolean) val);
            else if (val instanceof String) e.putString(k, (String) val);
        }
        e.apply();
        GrimKcalWidget.updateAll(ctx);
        call.resolve();
    }

    /** Flik som widgeten bad om vid kallstart (konsumeras en gång). */
    @PluginMethod
    public void consumeLaunchTab(PluginCall call) {
        JSObject r = new JSObject();
        r.put("tab", pendingTab);
        pendingTab = null;
        call.resolve(r);
    }
}
