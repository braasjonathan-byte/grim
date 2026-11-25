import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";

const native = vi.hoisted(() => {
  const methods = {
    getSupportedVoices: vi.fn(async () => ({ voices: [{ lang: "sv-SE" }] })),
    isLanguageSupported: vi.fn(async () => ({ supported: true })),
    speak: vi.fn(async () => {}),
    stop: vi.fn(async () => {}),
  };
  const thenReads = vi.fn();
  const plugin = new Proxy(methods, {
    get(target, key, receiver) {
      if (key === "then") { thenReads(); throw new Error("TextToSpeech.then() is not implemented on android"); }
      return Reflect.get(target, key, receiver);
    },
  });
  return { methods, plugin, thenReads };
});
vi.mock("@capacitor-community/text-to-speech", () => ({ TextToSpeech: native.plugin }));
vi.mock("@capacitor/core", () => ({ CapacitorHttp: { post: vi.fn(async () => { throw new Error("AI speech unavailable"); }) } }));

it("initializes, speaks through the native fallback and stops on pause without resolving the plugin proxy", async () => {
  vi.stubGlobal("Capacitor", { isNativePlatform: () => true });
  localStorage.setItem("grim_interval_voice_prefs", JSON.stringify({ enabled: true, countdown: false }));
  const { IntervalRunner } = await import("@/components/IntervalRunner");
  // Capacitor dependencies can install the web bridge while imports resolve.
  vi.stubGlobal("Capacitor", { isNativePlatform: () => true });
  const fetchMock = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("AI speech unavailable"));
  const view = render(<IntervalRunner open onClose={() => {}} presetIntervals={[{ time: "1", dist: "0.2", tempo: "5:00" }]} />);
  try {
    fireEvent.click(screen.getByRole("button", { name: "Starta" }));
    await waitFor(() => expect(native.methods.getSupportedVoices).toHaveBeenCalled());
    await waitFor(() => expect(native.methods.speak).toHaveBeenCalled());
    expect(native.methods.isLanguageSupported).toHaveBeenCalledWith({ lang: "sv-SE" });
    fireEvent.click(await screen.findByRole("button", { name: "Paus" }));
    await waitFor(() => expect(native.methods.stop).toHaveBeenCalled());
    expect(native.thenReads).not.toHaveBeenCalled();
  } finally {
    view.unmount();
    fetchMock.mockRestore();
    localStorage.removeItem("grim_interval_voice_prefs");
    vi.unstubAllGlobals();
  }
});