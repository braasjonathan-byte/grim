import { describe, expect, it, vi, afterEach } from "vitest";
import { DIALOG_TIMEOUT_MS, DIALOG_VISIBLE_TIMEOUT_MS, healthErrorRef, STEP_TIMEOUT_MS, withDialogTimeout, withTimeout } from "@/lib/healthSync";

afterEach(() => {
  vi.useRealTimers();
});

describe("withTimeout", () => {
  it("avbryter ett anrop som hänger", async () => {
    vi.useFakeTimers();
    const pending = withTimeout(new Promise(() => {}), 1000, "Hänger");
    const assertion = expect(pending).rejects.toThrow("Hänger");
    await vi.advanceTimersByTimeAsync(1001);
    await assertion;
    await pending.catch((err) => expect(healthErrorRef(err)).toBe("HC-07"));
  });

  it("släpper igenom ett svar som hinner i tid", async () => {
    await expect(withTimeout(Promise.resolve(42), 1000, "Hänger")).resolves.toBe(42);
  });

  it("kan märka en oberoende yttre gräns som dialog-timeout", async () => {
    vi.useFakeTimers();
    const pending = withTimeout(new Promise(() => {}), 500, "Dialogen hänger", "dialog-timeout");
    const assertion = pending.catch((err) => expect(healthErrorRef(err)).toBe("HC-04"));
    await vi.advanceTimersByTimeAsync(501);
    await assertion;
  });
});

describe("withDialogTimeout", () => {
  it("avbryter när appen ligger i förgrunden och inget händer", async () => {
    vi.useFakeTimers();
    const pending = withDialogTimeout(new Promise(() => {}), "Kunde inte ansluta", 500);
    const assertion = expect(pending).rejects.toThrow("Kunde inte ansluta");
    await vi.advanceTimersByTimeAsync(600);
    await assertion;
    await pending.catch((err) => expect(healthErrorRef(err)).toBe("HC-04"));
  });

  it("avbryter oberoende av om native-anropet döljer appen", async () => {
    vi.useFakeTimers();
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    const pending = withDialogTimeout<string>(
      new Promise(() => {}),
      "Kunde inte ansluta",
      500,
    );
    const assertion = expect(pending).rejects.toThrow("Kunde inte ansluta");
    await vi.advanceTimersByTimeAsync(501);
    await assertion;
    hidden.mockRestore();
  });

  it("förlänger gränsen när behörighetsrutan döljer appen, men aldrig oändligt", async () => {
    vi.useFakeTimers();
    let hiddenNow = false;
    const hidden = vi.spyOn(document, "hidden", "get").mockImplementation(() => hiddenNow);
    let settled = false;
    const pending = withDialogTimeout(new Promise(() => {}), "Kunde inte ansluta", 500, 3000);
    pending.catch(() => { settled = true; });
    await vi.advanceTimersByTimeAsync(200);
    hiddenNow = true;
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(1000); // förbi 500 ms – rutan syns, ska inte avbryta
    expect(settled).toBe(false);
    const assertion = expect(pending).rejects.toThrow("Kunde inte ansluta");
    await vi.advanceTimersByTimeAsync(1900); // totalt > 3000 ms
    await assertion;
    hidden.mockRestore();
  });

  it("avbryter efter grundgränsen om appen aldrig döljs, även med förlängning", async () => {
    vi.useFakeTimers();
    const pending = withDialogTimeout(new Promise(() => {}), "Kunde inte ansluta", 500, 3000);
    const assertion = expect(pending).rejects.toThrow("Kunde inte ansluta");
    await vi.advanceTimersByTimeAsync(501);
    await assertion;
  });

  it("ger rutan längre tid än native-lagrets skyddsnät", () => {
    expect(DIALOG_TIMEOUT_MS).toBe(12000);
    expect(DIALOG_VISIBLE_TIMEOUT_MS).toBeGreaterThan(125000);
  });

  it("använder 20 sekunder som standard", () => {
    expect(STEP_TIMEOUT_MS).toBe(20000);
  });
});
