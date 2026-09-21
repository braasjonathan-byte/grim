package se.grim.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * Health Connect öppnar den här vyn när användaren trycker på länken till
 * integritetspolicyn i behörighetsdialogen.
 *
 * Pluginets egen vy (com.fit_up.health.capacitor.PermissionsRationaleActivity)
 * laddar sidan i en WebView med JavaScript avstängt. Grims policysida är en
 * React-app, så den vyn blir helt blank – därför använder vi en egen.
 *
 * Vi försöker först öppna sidan i användarens webbläsare (samma mönster som
 * andra Health Connect-appar) och faller tillbaka på en WebView med
 * JavaScript påslaget om ingen webbläsare finns.
 */
public class HealthPrivacyActivity extends Activity {

  private static final String TAG = "GrimHealthPrivacy";

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    String url = getString(R.string.privacy_policy_url);

    try {
      Intent browser = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
      browser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      startActivity(browser);
      finish();
      return;
    } catch (Exception e) {
      Log.w(TAG, "Kunde inte öppna webbläsaren, visar WebView i stället", e);
    }

    WebView webView = new WebView(this);
    WebSettings settings = webView.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    webView.setWebViewClient(new WebViewClient());
    setContentView(webView);
    webView.loadUrl(url);
  }
}
