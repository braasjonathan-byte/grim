package se.grim.app;

import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;

import com.fit_up.health.capacitor.GrimHealthRequestState;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    // GRIM_HEALTH_FOREGROUND_GUARD: MainActivity kör med launchMode="singleTask"
    // och tar emot delnings-intents. Levereras en sådan intent medan Health
    // Connects behörighetsdialog är öppen dras appen fram över dialogen och
    // resultatet når aldrig tillbaka. Skjut i så fall upp intenten tills
    // behörighetsflödet är klart.
    private Intent deferredIntent;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Keep the WebView inside Android's system bars. This prevents both
        // content-behind-navigation-buttons and the extra gap caused by Android
        // 15 edge-to-edge when the generated Android project is rebuilt for AAB.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(true);
        }
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.BLACK);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            getWindow().setNavigationBarContrastEnforced(true);
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        if (GrimHealthRequestState.isInFlight()) {
            Log.w("GrimMainActivity", "deferring intent while health permission dialog is in flight");
            deferredIntent = intent;
            return;
        }
        super.onNewIntent(intent);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (deferredIntent != null && !GrimHealthRequestState.isInFlight()) {
            Intent pending = deferredIntent;
            deferredIntent = null;
            Log.i("GrimMainActivity", "replaying deferred intent after health permission dialog");
            super.onNewIntent(pending);
            setIntent(pending);
        }
    }
}
