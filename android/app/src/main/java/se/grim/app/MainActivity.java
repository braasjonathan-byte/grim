package se.grim.app;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import androidx.core.view.WindowCompat;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Keep the WebView inside Android's system bars. This prevents both
        // content-behind-navigation-buttons and the extra gap caused by Android
        // 15 edge-to-edge when the generated Android project is rebuilt for AAB.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.BLACK);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            getWindow().setNavigationBarContrastEnforced(true);
        }
    }
}
