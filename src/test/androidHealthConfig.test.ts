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
});
