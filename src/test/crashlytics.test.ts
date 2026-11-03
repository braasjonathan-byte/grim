import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({ enabled: true, available: true }));
const calls = vi.hoisted(() => ({
  then: vi.fn(),
  log: vi.fn(async () => {}),
  setUserId: vi.fn(async () => {}),
  setEnabled: vi.fn(async () => {}),
  recordException: vi.fn(async () => {}),
}));

vi.mock("@capacitor/core", () => ({ Capacitor: {
  isNativePlatform: () => native.enabled,
  isPluginAvailable: () => native.available,
} }));
vi.mock("@capacitor-firebase/crashlytics", () => ({
  // Matches the native proxy's unknown-property behavior, including `then`.
  FirebaseCrashlytics: new Proxy(calls, {
    get: (target, key) => target[key as keyof typeof calls] ?? vi.fn(async () => {}),
  }),
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  native.enabled = true;
  native.available = true;
});
afterEach(() => vi.restoreAllMocks());

describe("native crash reporting", () => {
  it("logs and identifies the user without assimilating the plugin proxy", async () => {
    const { logCrashlyticsMessage, setCrashlyticsUserId, recordError } = await import("@/lib/crashlytics");
    await logCrashlyticsMessage("loadUserData:start");
    await setCrashlyticsUserId("test-user");
    await recordError(new Error("test failure"));
    expect(calls.then).not.toHaveBeenCalled();
    expect(calls.log).toHaveBeenCalledWith({ message: "loadUserData:start" });
    expect(calls.setUserId).toHaveBeenCalledWith({ userId: "test-user" });
    expect(calls.recordException).toHaveBeenCalledWith(expect.objectContaining({ message: "test failure" }));
  });

  it("safely skips reporting in installed builds without the native plugin", async () => {
    native.available = false;
    const { initCrashlytics, logCrashlyticsMessage } = await import("@/lib/crashlytics");
    await initCrashlytics();
    await logCrashlyticsMessage("test");
    expect(calls.log).not.toHaveBeenCalled();
    expect(calls.setEnabled).not.toHaveBeenCalled();
    expect(calls.then).not.toHaveBeenCalled();
  });

  it("registers global handlers even while native initialization is pending", async () => {
    calls.setEnabled.mockImplementationOnce(() => new Promise(() => {}));
    const listener = vi.spyOn(window, "addEventListener").mockImplementation(() => {});
    const { initCrashlytics } = await import("@/lib/crashlytics");
    void initCrashlytics();
    await vi.waitFor(() => expect(calls.setEnabled).toHaveBeenCalledWith({ enabled: true }));
    expect(listener).toHaveBeenCalledWith("error", expect.any(Function));
    expect(listener).toHaveBeenCalledWith("unhandledrejection", expect.any(Function));
  });

  it("does not call native methods on the web", async () => {
    native.enabled = false;
    const { logCrashlyticsMessage } = await import("@/lib/crashlytics");
    await logCrashlyticsMessage("test");
    expect(calls.log).not.toHaveBeenCalled();
  });
});