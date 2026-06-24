#!/usr/bin/env node
/**
 * Re-apply Grim's Android system-bar/inset fixes after `npx cap add android`.
 * The release workflows delete and recreate android/, so committed native files
 * alone are not enough for AAB/APK builds.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const file = (...parts) => path.join(ROOT, ...parts);

const STYLES = file("android", "app", "src", "main", "res", "values", "styles.xml");
const LAYOUT = file("android", "app", "src", "main", "res", "layout", "activity_main.xml");
const MAIN_ACTIVITY = file("android", "app", "src", "main", "java", "se", "grim", "app", "MainActivity.java");

function writeIfChanged(target, next) {
  const prev = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";
  if (prev !== next) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, next, "utf8");
    console.log(`[patch-android-system-insets] updated ${path.relative(ROOT, target)}`);
  }
}

if (fs.existsSync(STYLES)) {
  let xml = fs.readFileSync(STYLES, "utf8");
  if (!xml.includes('xmlns:tools="http://schemas.android.com/tools"')) {
    xml = xml.replace("<resources", '<resources xmlns:tools="http://schemas.android.com/tools"');
  }

  const inserts = [
    '<item name="android:windowOptOutEdgeToEdgeEnforcement" tools:targetApi="35">true</item>',
    '<item name="android:windowDrawsSystemBarBackgrounds">true</item>',
    '<item name="android:navigationBarColor">#000000</item>',
    '<item name="android:statusBarColor">@android:color/transparent</item>',
  ];
  for (const item of inserts) {
    const itemName = item.match(/name="([^"]+)"/)?.[1];
    if (itemName && !xml.includes(`name="${itemName}"`)) {
      xml = xml.replace(
        /(<style name="AppTheme\.NoActionBar"[^>]*>)/,
        `$1\n        ${item}`,
      );
    }
  }
  writeIfChanged(STYLES, xml);
}

if (fs.existsSync(LAYOUT)) {
  let xml = fs.readFileSync(LAYOUT, "utf8");
  xml = xml.replace(
    /(android:layout_height="match_parent"\s+)(tools:context="\.MainActivity")/,
    `$1android:fitsSystemWindows="true"\n    $2`,
  );
  xml = xml.replace(
    /(<WebView[\s\S]*?android:layout_height="match_parent")\s*\/>/,
    `$1\n        android:fitsSystemWindows="true" />`,
  );
  writeIfChanged(LAYOUT, xml);
}

writeIfChanged(MAIN_ACTIVITY, `package se.grim.app;

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
`);

console.log("[patch-android-system-insets] Android system inset fixes are in place.");