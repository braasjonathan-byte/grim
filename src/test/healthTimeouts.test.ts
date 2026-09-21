import { describe, expect, it, vi, afterEach } from "vitest";
import { STEP_TIMEOUT_MS, withDialogTimeout, withTimeout } from "@/lib/healthSync";

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
  });

  it("släpper igenom ett svar som hinner i tid", async () => {
    await expect(withTimeout(Promise.resolve(42), 1000, "Hänger")).resolves.toBe(42);
  });
});

describe("withDialogTimeout", () => {
  it("avbryter när appen ligger i förgrunden och inget händer", async () => {
    vi.useFakeTimers();
    const pending = withDialogTimeout(new Promise(() => {}), "Kunde inte ansluta", 500);
    const assertion = expect(pending).rejects.toThrow("Kunde inte ansluta");
    await vi.advanceTimersByTimeAsync(600);
    await assertion;
  });

  it("pausar klockan medan systemdialogen ligger överst", async () => {
    vi.useFakeTimers();
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    let done: (v: string) => void = () => {};
    const pending = withDialogTimeout<string>(
      new Promise((resolve) => {
        done = resolve;
      }),
      "Kunde inte ansluta",
      500,
    );
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(5000);
    hidden.mockReturnValue(false);
    done("ok");
    await expect(pending).resolves.toBe("ok");
    hidden.mockRestore();
  });

  it("använder 20 sekunder som standard", () => {
    expect(STEP_TIMEOUT_MS).toBe(20000);
  });
});
