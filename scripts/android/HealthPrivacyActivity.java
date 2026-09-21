package se.grim.app;

// GRIM_HEALTH_PRIVACY_V2 – genereras av scripts/patch-android-manifest.cjs

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.util.TypedValue;
import android.view.Gravity;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

/**
 * Health Connect öppnar den här vyn när användaren trycker på länken till
 * integritetspolicyn i behörighetsdialogen.
 *
 * Pluginets egen vy laddar sidan i en WebView med JavaScript avstängt, och
 * Grims policysida är en React-app – då blir vyn helt blank. Vi visar i stället
 * en kort sammanfattning direkt i appen plus en tydlig knapp som öppnar hela
 * policyn i telefonens webbläsare.
 */
public class HealthPrivacyActivity extends Activity {

  private static final String TAG = "GrimHealthPrivacy";

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    final String url = getString(R.string.privacy_policy_url);
    Log.i(TAG, "rationale view opened, policy url: " + url);

    LinearLayout root = new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    root.setBackgroundColor(Color.WHITE);
    int pad = dp(24);
    root.setPadding(pad, pad, pad, pad);
    root.setGravity(Gravity.CENTER_VERTICAL);

    TextView title = new TextView(this);
    title.setText("Så använder Grim din hälsodata");
    title.setTextColor(Color.BLACK);
    title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 22);
    root.addView(title);

    TextView body = new TextView(this);
    body.setText(
        "Grim läser steg, kalorier, distans, genomförda pass, puls och sömn från Health Connect "
            + "för att visa din träning och statistik i appen. Data lagras kopplat till ditt "
            + "Grim-konto och delas inte vidare. Du kan när som helst ta bort åtkomsten i "
            + "Health Connect.\n\nHela integritetspolicyn finns på grim.lovable.app/privacy.");
    body.setTextColor(Color.DKGRAY);
    body.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
    body.setPadding(0, dp(16), 0, dp(24));
    root.addView(body);

    Button open = new Button(this);
    open.setText("Öppna integritetspolicyn");
    open.setOnClickListener(v -> openInBrowser(url));
    root.addView(open);

    Button close = new Button(this);
    close.setText("Stäng");
    close.setOnClickListener(v -> finish());
    root.addView(close);

    setContentView(root);
  }

  private void openInBrowser(String url) {
    try {
      Intent browser = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
      browser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      startActivity(browser);
    } catch (Exception e) {
      Log.w(TAG, "Kunde inte öppna webbläsaren", e);
      Toast.makeText(this, "Öppna " + url + " i din webbläsare", Toast.LENGTH_LONG).show();
    }
  }

  private int dp(int value) {
    return Math.round(value * getResources().getDisplayMetrics().density);
  }
}
