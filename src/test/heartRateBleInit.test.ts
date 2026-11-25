import { describe, it, expect, vi } from "vitest";
import { initBle, androidMajorFromUserAgent, OLD_ANDROID_HR_MESSAGE } from "@/lib/heartRate";

const UA11 = "Mozilla/5.0 (Linux; Android 11; Pixel 3) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36";
const UA14 = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36";

describe("BLE-start för pulsband", () => {
  it("ber aldrig om plats", async () => {
    const initialize = vi.fn().mockResolvedValue(undefined);
    await initBle({ initialize }, UA14);
    expect(initialize).toHaveBeenCalledWith({ androidNeverForLocation: true });
  });
  it("ger en tydlig svensk text på Android 11 och äldre", async () => {
    const initialize = vi.fn().mockRejectedValue(new Error("Permission denied."));
    await expect(initBle({ initialize }, UA11)).rejects.toThrow(OLD_ANDROID_HR_MESSAGE);
  });
  it("behåller originalfelet på Android 12+", async () => {
    const initialize = vi.fn().mockRejectedValue(new Error("Bluetooth är avstängt"));
    await expect(initBle({ initialize }, UA14)).rejects.toThrow("Bluetooth är avstängt");
  });
  it("läser Android-versionen ur user agent", () => {
    expect(androidMajorFromUserAgent(UA11)).toBe(11);
    expect(androidMajorFromUserAgent("Mozilla/5.0 (iPhone)")).toBeNull();
  });
});
