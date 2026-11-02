package se.grim.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.View;
import android.widget.RemoteViews;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

/** Hemskärms-widget: kcal-ring (samma utseende som Kost/NutritionHero) + makroringar. */
public class GrimKcalWidget extends AppWidgetProvider {
    public static final String PREFS = "se.grim.app.widget";
    public static final String EXTRA_TAB = "grim_open_tab";
    public static final String ACTION_LOG_FOOD = "se.grim.app.LOG_FOOD";

    static PendingIntent openNutrition(Context ctx, String action, int req) {
        Intent open = new Intent(ctx, MainActivity.class);
        open.setAction(action);
        open.putExtra(EXTRA_TAB, "nutrition");
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(ctx, req, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static final String[] DAY_LETTERS = {"S", "M", "T", "O", "T", "F", "L"}; // Calendar.SUNDAY = 1

    /** Senaste 7 dagarna (äldst → idag): kcal-stapel mot mål + prick för genomfört pass. */
    static Bitmap weekChart(SharedPreferences p, int w, int h, float dp, float target,
                            int fg, int mutedFg, int primary, int muted, int destructive) {
        SimpleDateFormat fmt = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        float[] kcal = new float[7]; float[] burned = new float[7]; int[] sess = new int[7]; String[] letters = new String[7];
        Calendar cal = Calendar.getInstance();
        cal.add(Calendar.DAY_OF_YEAR, -6);
        for (int i = 0; i < 7; i++) {
            String key = fmt.format(cal.getTime());
            letters[i] = DAY_LETTERS[cal.get(Calendar.DAY_OF_WEEK) - 1];
            // Slå upp på datum så att gammal data (appen ej öppnad idag) hamnar på rätt dag.
            for (int j = 0; j < 7; j++) {
                if (key.equals(p.getString("wD" + j, ""))) {
                    kcal[i] = p.getFloat("wK" + j, 0); burned[i] = p.getFloat("wB" + j, 0); sess[i] = Math.round(p.getFloat("wS" + j, 0));
                }
            }
            cal.add(Calendar.DAY_OF_YEAR, 1);
        }
        float max = Math.max(target, 1);
        for (float k : kcal) max = Math.max(max, k);
        int sessions = 0, logged = 0; float sumK = 0, sumB = 0;
        for (int i = 0; i < 7; i++) { sessions += sess[i]; sumB += burned[i]; if (kcal[i] > 0) { logged++; sumK += kcal[i]; } }

        Bitmap b = Bitmap.createBitmap(Math.max(w, 1), Math.max(h, 1), Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(b);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        float labelW = 58 * dp;
        // Vänster: veckosammanfattning.
        paint.setColor(fg); paint.setTextSize(11 * dp); paint.setFakeBoldText(true);
        c.drawText(logged > 0 ? Math.round(sumK / logged) + " kcal" : "– kcal", 0, 14 * dp, paint);
        paint.setFakeBoldText(false); paint.setColor(mutedFg); paint.setTextSize(9 * dp);
        c.drawText("snitt/dag", 0, 25 * dp, paint);
        c.drawText(sessions + " pass · " + Math.round(sumB) + " brända", 0, 37 * dp, paint);
        // Höger: 7 staplar.
        float col = (w - labelW) / 7f, barW = Math.min(10 * dp, col * 0.5f);
        float top = 2 * dp, base = h - 16 * dp, tgtY = base - (base - top) * (target / max);
        paint.setColor(muted); paint.setStrokeWidth(1 * dp);
        if (target > 0) c.drawLine(labelW, tgtY, w, tgtY, paint);
        paint.setTextAlign(Paint.Align.CENTER);
        for (int i = 0; i < 7; i++) {
            float cx = labelW + col * i + col / 2f;
            float bh = Math.max(kcal[i] > 0 ? 2 * dp : 0, (base - top) * (kcal[i] / max));
            paint.setColor(muted);
            c.drawRoundRect(new RectF(cx - barW / 2, top, cx + barW / 2, base), barW / 2, barW / 2, paint);
            if (bh > 0) {
                paint.setColor(target > 0 && kcal[i] > target * 1.05f ? destructive : primary);
                c.drawRoundRect(new RectF(cx - barW / 2, base - bh, cx + barW / 2, base), barW / 2, barW / 2, paint);
            }
            boolean isToday = i == 6;
            paint.setColor(isToday ? fg : mutedFg); paint.setTextSize(8.5f * dp); paint.setFakeBoldText(isToday);
            c.drawText(letters[i], cx - (sess[i] > 0 ? 3 * dp : 0), h - 4 * dp, paint);
            if (sess[i] > 0) { // träningsprick
                paint.setColor(Color.parseColor("#eab308"));
                c.drawCircle(cx + 5 * dp, h - 7 * dp, 2.5f * dp, paint);
            }
        }
        return b;
    }

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) render(ctx, mgr, id);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context ctx, AppWidgetManager mgr, int id, Bundle opts) {
        render(ctx, mgr, id);
    }

    public static void updateAll(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, GrimKcalWidget.class));
        for (int id : ids) render(ctx, mgr, id);
    }

    private static int color(SharedPreferences p, String key, int def) {
        try { return Color.parseColor(p.getString(key, "")); } catch (Exception e) { return def; }
    }

    static void render(Context ctx, AppWidgetManager mgr, int id) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        boolean fresh = today.equals(p.getString("date", ""));
        float kcal = fresh ? p.getFloat("kcal", 0) : 0;
        float burned = fresh ? p.getFloat("burned", 0) : 0;
        float target = p.getFloat("targetKcal", 2000);
        float prot = fresh ? p.getFloat("protein", 0) : 0, fat = fresh ? p.getFloat("fat", 0) : 0, carbs = fresh ? p.getFloat("carbs", 0) : 0;
        float tProt = p.getFloat("targetProtein", 0), tFat = p.getFloat("targetFat", 0), tCarbs = p.getFloat("targetCarbs", 0);

        int bg = color(p, "card", Color.parseColor("#141414"));
        int fg = color(p, "foreground", Color.WHITE);
        int primary = color(p, "primary", Color.parseColor("#22c55e"));
        int muted = color(p, "muted", Color.parseColor("#262626"));
        int mutedFg = color(p, "mutedForeground", Color.parseColor("#a3a3a3"));
        int destructive = color(p, "destructive", Color.parseColor("#ef4444"));

        long left = Math.round(target) - Math.round(kcal);
        boolean over = left < 0;

        Bundle opts = mgr.getAppWidgetOptions(id);
        int minW = opts != null ? opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 110) : 110;
        int minH = opts != null ? opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 110) : 110;
        boolean wide = minW >= 200;
        // Veckovyn: alltid i bred layout; i 2×2 bara om widgeten dragits upp på höjden.
        boolean showWeek = wide || minH >= 200;
        // Bred men låg (4×2): veckovyn ersätter makroraden så ringen får plats.
        boolean showMacros = wide && (minH >= 170 || !showWeek);

        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.grim_kcal_widget);
        v.setInt(R.id.widget_root, "setBackgroundColor", bg);
        float dp = ctx.getResources().getDisplayMetrics().density;
        // Samma proportioner som NutritionHero: 128px ring, stroke 10.
        v.setImageViewBitmap(R.id.widget_ring, ring(Math.round(128 * dp), 10 * dp, target > 0 ? kcal / target : 0, over ? destructive : primary, muted));
        v.setTextViewText(R.id.widget_left, String.valueOf(Math.abs(left)));
        v.setTextColor(R.id.widget_left, over ? destructive : fg);
        v.setTextViewText(R.id.widget_left_label, over ? "kcal över" : "kcal kvar");
        v.setTextColor(R.id.widget_left_label, mutedFg);

        v.setViewVisibility(R.id.widget_side, wide ? View.VISIBLE : View.GONE);
        v.setViewVisibility(R.id.widget_side_r, wide ? View.VISIBLE : View.GONE);
        v.setViewVisibility(R.id.widget_macros, showMacros ? View.VISIBLE : View.GONE);
        if (wide) {
            v.setTextViewText(R.id.widget_eaten, String.valueOf(Math.round(kcal)));
            v.setTextColor(R.id.widget_eaten, fg);
            v.setTextColor(R.id.widget_eaten_label, mutedFg);
            v.setTextViewText(R.id.widget_burned, String.valueOf(Math.round(burned)));
            v.setTextColor(R.id.widget_burned, fg);
            v.setTextColor(R.id.widget_burned_label, mutedFg);
            int s = Math.round(40 * dp);
            int amber = Color.parseColor("#eab308"), blue = Color.parseColor("#3b82f6");
            v.setImageViewBitmap(R.id.widget_r_carbs, ring(s, 4 * dp, tCarbs > 0 ? carbs / tCarbs : 0, blue, muted));
            v.setImageViewBitmap(R.id.widget_r_fat, ring(s, 4 * dp, tFat > 0 ? fat / tFat : 0, amber, muted));
            v.setImageViewBitmap(R.id.widget_r_prot, ring(s, 4 * dp, tProt > 0 ? prot / tProt : 0, destructive, muted));
            v.setTextViewText(R.id.widget_t_carbs, Math.round(carbs) + "g");
            v.setTextViewText(R.id.widget_t_fat, Math.round(fat) + "g");
            v.setTextViewText(R.id.widget_t_prot, Math.round(prot) + "g");
            for (int t : new int[]{R.id.widget_t_carbs, R.id.widget_t_fat, R.id.widget_t_prot}) v.setTextColor(t, fg);
            for (int t : new int[]{R.id.widget_l_carbs, R.id.widget_l_fat, R.id.widget_l_prot}) v.setTextColor(t, mutedFg);
        }

        v.setViewVisibility(R.id.widget_week, showWeek ? View.VISIBLE : View.GONE);
        if (showWeek) {
            int wPx = Math.round(Math.max(minW - 12, 96) * dp);
            v.setImageViewBitmap(R.id.widget_week, weekChart(p, wPx, Math.round(46 * dp), dp, target, fg, mutedFg, primary, muted, destructive));
        }
        v.setTextColor(R.id.widget_kost, fg);
        v.setInt(R.id.widget_kost, "setBackgroundColor", muted);

        // Hela widgeten och snabbknappen öppnar dagens kostlogg (Kost-fliken).
        v.setOnClickPendingIntent(R.id.widget_root, openNutrition(ctx, "se.grim.app.OPEN_NUTRITION", 4711));
        v.setOnClickPendingIntent(R.id.widget_kost, openNutrition(ctx, ACTION_LOG_FOOD, 4712));
        mgr.updateAppWidget(id, v);
    }

    static Bitmap ring(int size, float stroke, float frac, int color, int track) {
        Bitmap b = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(b);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(stroke);
        paint.setStrokeCap(Paint.Cap.ROUND);
        float r = (size - stroke) / 2f;
        RectF oval = new RectF(size / 2f - r, size / 2f - r, size / 2f + r, size / 2f + r);
        paint.setColor(track);
        c.drawArc(oval, 0, 360, false, paint);
        float f = Math.max(0, Math.min(1, frac));
        if (f > 0) {
            paint.setColor(color);
            c.drawArc(oval, -90, 360 * f, false, paint);
        }
        return b;
    }
}
