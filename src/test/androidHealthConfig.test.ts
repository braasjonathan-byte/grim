import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("Android-konfiguration för Health Connect", () => {
  const manifest = read("android/app/src/main/AndroidManifest.xml");

  it("har rationale-filtret med kategorin HEALTH_PERMISSIONS", () => {
    const filter = manifest.match(
      /<intent-filter>(?:(?!<\/intent-filter>)[\s\S])*ACTION_SHOW_PERMISSIONS_RATIONALE[\s\S]*?<\/intent-filter>/,
    );
    expect(filter).not.toBeNull();
    expect(filter![0]).toContain("android.intent.category.HEALTH_PERMISSIONS");
  });

  it("pekar rationale-vyn på Grims egen aktivitet", () => {
    expect(manifest).toContain("se.grim.app.HealthPrivacyActivity");
  });

  it("deklarerar alla hälsobehörigheter appen ber om", () => {
    for (const perm of [
      "READ_STEPS",
      "READ_ACTIVE_CALORIES_BURNED",
      "READ_DISTANCE",
      "READ_EXERCISE",
      "READ_HEART_RATE",
      "READ_SLEEP",
    ]) {
      expect(manifest).toContain(`android.permission.health.${perm}`);
    }
  });

  it("har en publik integritetsadress i strings.xml", () => {
    expect(read("android/app/src/main/res/values/strings.xml")).toContain(
      "https://grim.lovable.app/privacy",
    );
  });

  it("håller den installerade rationale-vyn identisk med mallen", () => {
    expect(read("android/app/src/main/java/se/grim/app/HealthPrivacyActivity.java")).toBe(
      read("scripts/android/HealthPrivacyActivity.java"),
    );
  });

  it("kan se om Health Connect-appen är installerad", () => {
    expect(manifest).toContain("com.google.android.apps.healthdata");
  });

  it("kräver minst Android 8 som Health Connect behöver", () => {
    const variables = read("android/variables.gradle");
    const match = variables.match(/minSdkVersion\s*=\s*(\d+)/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBeGreaterThanOrEqual(26);
  });

  it("patchar launchern tidigt och öppnar Grims egen behörighetssida", () => {
    const patch = read("scripts/patch-capacitor-health.cjs");
    expect(patch).toContain("GRIM_EARLY_PERMISSION_LAUNCHER");
    expect(patch).toContain("HC_NATIVE_03");
    expect(patch).toContain("GRIM_APP_HEALTH_PERMISSIONS");
    expect(patch).toContain("ACTION_MANAGE_HEALTH_PERMISSIONS");
    expect(patch).toContain("SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED");
  });

  it("använder Googles dokumenterade launcher först och skiljer tomt svar från uteblivet", () => {
    const patch = read("scripts/patch-capacitor-health.cjs");
    expect(patch).toContain("GRIM_PERMISSION_PROXY_ACTIVITY");
    expect(patch).toContain("registerForActivityResult(contract)");
    expect(patch).toContain("HC_NATIVE_06");
    expect(patch).toContain("proxy-result-raw");
    expect(patch).toContain('call.reject("HC_NATIVE_05: \\$launchReason")');
    const verify = read("scripts/verify-android-plugins.cjs");
    expect(verify).toContain("GRIM_PERMISSION_PROXY_ACTIVITY");
    expect(verify).toContain("HealthPermissionProxyActivity");
  });

  it("deklarerar den separata behörighetsskärmen i pluginets manifest", () => {
    expect(read("node_modules/capacitor-health/android/src/main/AndroidManifest.xml")).toContain(
      'android:name=".HealthPermissionProxyActivity"',
    );
  });

  it("låter native-lagret rapportera den specifika koden före det yttre skyddsnätet", () => {
    expect(read("src/components/HealthConnectCard.tsx")).toContain("SYNC_HARD_TIMEOUT_MS = 180000");
  });

  it("har en native watchdog som aldrig pausas av tappat fönsterfokus", () => {
    const patch = read("scripts/patch-capacitor-health.cjs");
    expect(patch).toContain("hard deadline independent of activity focus");
    expect(patch).not.toContain('healthTrace("dialog-wait"');
    expect(patch).toMatch(
      /call\.reject\(\"HC_NATIVE_04: permission dialog returned no callback\"\)\s*\n\s*bridge\.releaseCall\(call\)/,
    );
  });

  it("låter ändringar i native-patcharna bryta Gradle-cachen", () => {
    for (const workflow of [".github/workflows/main.yml", ".github/workflows/release-aab.yml"]) {
      const source = read(workflow);
      expect(source).toContain("scripts/patch-capacitor-health.cjs");
      expect(source).toContain("scripts/patch-send-intent-gradle.cjs");
    }
  });
  it("startar aldrig dialogen utan fönsterfokus och skyddar den mot singleTask-intents", () => {
    const patch = read("scripts/patch-capacitor-health.cjs");
    expect(patch).toContain("GRIM_FOREGROUND_LAUNCH");
    expect(patch).toContain("activity.hasWindowFocus()");
    expect(patch).toContain("GRIM_HEALTH_REQUEST_STATE");
    expect(patch).toContain("CoroutineScope(Dispatchers.Main).launch {");

    const mainActivity = read("android/app/src/main/java/se/grim/app/MainActivity.java");
    expect(mainActivity).toContain("GrimHealthRequestState.isInFlight()");
    expect(mainActivity).toContain("protected void onNewIntent(Intent intent)");
    expect(mainActivity).toContain("deferredIntent");
  });

  it("isolerar Health Connect-dialogen från MainActivity och återställer patchen efter npm install", () => {
    const pkg = JSON.parse(read("package.json"));
    expect(pkg.scripts.postinstall).toContain("patch-capacitor-health.cjs");

    const patch = read("scripts/patch-capacitor-health.cjs");
    expect(patch).toContain("GRIM_PERMISSION_PROXY_ACTIVITY");
    expect(patch).toContain("HealthPermissionProxyActivity");
    expect(patch).toContain('healthTrace("dialog-launch-attempt", "route=proxy")');
    expect(patch).toContain("PermissionController.createRequestPermissionResultContract()");
    expect(patch).toContain("registerForActivityResult(contract)");
  });
});
