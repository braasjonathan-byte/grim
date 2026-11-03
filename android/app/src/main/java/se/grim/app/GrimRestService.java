package se.grim.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;

/**
 * GRIM_REST_SERVICE: vilotimer som tickar på låsskärmen och i bakgrunden.
 * Kör som foreground service av typen shortService (Android 14+, max ~3 min,
 * kräver ingen extra behörighet). Visar nedräkning (chronometer) och vibrerar
 * + notifierar när vilan är slut. Längre vilor täcks av JS-sidans schemalagda
 * LocalNotification som reserv.
 */
public class GrimRestService extends Service {
    static final String CH_TICK = "grim_rest_tick";
    static final String CH_DONE = "grim_rest_done";
    static final int ID_TICK = 7310;
    static final int ID_DONE = 7311;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private Runnable pending;

    static void ensureChannels(Context ctx) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        NotificationChannel tick = new NotificationChannel(CH_TICK, "Vilotimer", NotificationManager.IMPORTANCE_LOW);
        tick.setDescription("Nedräkning för vila mellan set");
        tick.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        tick.setShowBadge(false);
        nm.createNotificationChannel(tick);
        NotificationChannel done = new NotificationChannel(CH_DONE, "Vilan är slut", NotificationManager.IMPORTANCE_HIGH);
        done.setDescription("Larm när vilan mellan set är slut");
        done.enableVibration(true);
        done.setVibrationPattern(new long[]{0, 400, 200, 400, 200, 600});
        done.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        done.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
                new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT).build());
        nm.createNotificationChannel(done);
    }

    private PendingIntent openApp() {
        Intent i = new Intent(this, MainActivity.class);
        i.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(this, 0, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        ensureChannels(this);
        if (intent == null || "stop".equals(intent.getAction())) { finish(false); return START_NOT_STICKY; }
        int seconds = Math.max(1, intent.getIntExtra("seconds", 90));
        String exercise = intent.getStringExtra("exercise");
        long end = System.currentTimeMillis() + seconds * 1000L;
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CH_TICK) : new Notification.Builder(this);
        b.setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentTitle("⏱️ Vila")
                .setContentText(exercise != null && !exercise.isEmpty() ? "Nästa set: " + exercise : "Nästa set snart")
                .setWhen(end).setShowWhen(true).setUsesChronometer(true)
                .setOngoing(true).setOnlyAlertOnce(true)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setCategory(Notification.CATEGORY_ALARM)
                .setContentIntent(openApp());
        if (Build.VERSION.SDK_INT >= 24) b.setChronometerCountDown(true);
        Notification n = b.build();
        try {
            if (Build.VERSION.SDK_INT >= 34) startForeground(ID_TICK, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SHORT_SERVICE);
            else startForeground(ID_TICK, n);
        } catch (Exception e) {
            stopSelf();
            return START_NOT_STICKY;
        }
        if (pending != null) handler.removeCallbacks(pending);
        pending = () -> finish(true);
        handler.postDelayed(pending, seconds * 1000L);
        return START_NOT_STICKY;
    }

    private void finish(boolean alert) {
        if (pending != null) handler.removeCallbacks(pending);
        pending = null;
        if (alert) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CH_DONE) : new Notification.Builder(this);
            b.setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                    .setContentTitle("⏰ Vilan är slut")
                    .setContentText("Dags för nästa set!")
                    .setAutoCancel(true)
                    .setVisibility(Notification.VISIBILITY_PUBLIC)
                    .setCategory(Notification.CATEGORY_ALARM)
                    .setPriority(Notification.PRIORITY_HIGH)
                    .setContentIntent(openApp());
            nm.notify(ID_DONE, b.build());
            try {
                Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
                if (v != null && Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createWaveform(new long[]{0, 400, 200, 400, 200, 600}, -1));
            } catch (Exception ignored) { }
        }
        if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_REMOVE); else stopForeground(true);
        stopSelf();
    }

    /** shortService-timeout (Android 14+): avsluta snällt, JS-reservnotisen tar över. */
    @Override
    public void onTimeout(int startId) {
        if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_REMOVE); else stopForeground(true);
        stopSelf();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
