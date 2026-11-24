import { beforeEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => {
  const notifications = {
    createChannel: vi.fn(async () => {}),
    checkPermissions: vi.fn(async () => ({ display: "granted" })),
    requestPermissions: vi.fn(async () => ({ display: "granted" })),
    schedule: vi.fn(async (_options: { notifications: Array<{ id: number; schedule?: { at: Date } }> }) => {}),
    cancel: vi.fn(async () => {}),
  };
  const crashlytics = {
    setEnabled: vi.fn(async () => {}),
    setCustomKey: vi.fn(async () => {}),
    recordException: vi.fn(async () => {}),
    setUserId: vi.fn(async () => {}),
    log: vi.fn(async () => {}),
  };
  // Capacitor proxies treat property access as a native method lookup.
  const thenReads = vi.fn();
  const proxy = <T extends object>(name: string, methods: T) => new Proxy(methods, {
    get(target, key, receiver) {
      if (key === "then") {
        thenReads(name);
        throw new Error(`${name}.then() is not implemented on android`);
      }
      return Reflect.get(target, key, receiver);
    },
  });
  return {
    notifications, crashlytics, thenReads,
    notificationProxy: proxy("LocalNotifications", notifications),
    crashlyticsProxy: proxy("FirebaseCrashlytics", crashlytics),
    isNative: vi.fn(() => true),
    startRest: vi.fn(async () => false),
    stopRest: vi.fn(async () => {}),
  };
});

vi.mock("@capacitor/core", () => ({ Capacitor: {
  isNativePlatform: native.isNative,
  isPluginAvailable: () => true,
  getPlatform: () => "android",
} }));
vi.mock("@capacitor/local-notifications", () => ({ LocalNotifications: native.notificationProxy }));
vi.mock("@capacitor-firebase/crashlytics", () => ({ FirebaseCrashlytics: native.crashlyticsProxy }));
vi.mock("@/lib/grimWorkoutNative", () => ({
  nativeStartRest: native.startRest, nativeStopRest: native.stopRest, NATIVE_REST_MAX_SEC: 170,
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  native.isNative.mockReturnValue(true);
  native.startRest.mockResolvedValue(false);
  localStorage.clear();
});

describe("Android plugin promises", () => {
  it("schedules the ongoing workout and fallback rest alert, then cancels both", async () => {
    const { touchOngoingWorkout, endOngoingWorkout } = await import("@/lib/workoutOngoing");
    const start = Date.now();
    await touchOngoingWorkout({ exercise: "Knäböj", restSeconds: 60 });
    expect(native.notifications.schedule).toHaveBeenCalledOnce();
    const { notifications } = native.notifications.schedule.mock.calls[0][0];
    expect(notifications.map((n) => n.id)).toEqual([7301, 7302]);
    expect(notifications[1].schedule?.at.getTime()).toBeGreaterThanOrEqual(start + 60_000);
    await endOngoingWorkout();
    expect(native.notifications.cancel).toHaveBeenLastCalledWith({ notifications: [{ id: 7301 }, { id: 7302 }] });
    expect(native.thenReads).not.toHaveBeenCalled();
  });

  it("does not duplicate the rest alert when the native timer handles it", async () => {
    native.startRest.mockResolvedValue(true);
    const { touchOngoingWorkout } = await import("@/lib/workoutOngoing");
    await touchOngoingWorkout({ restSeconds: 60 });
    expect(native.notifications.schedule).toHaveBeenCalledWith({ notifications: [expect.objectContaining({ id: 7301 })] });
  });

  it("enables Crashlytics and sends errors, context, user identity and logs", async () => {
    const c = await import("@/lib/crashlytics");
    const listener = vi.spyOn(window, "addEventListener");
    await c.initCrashlytics();
    expect(native.crashlytics.setEnabled).toHaveBeenCalledWith({ enabled: true });
    await c.recordError(new Error("Regression probe"), { step: "test" });
    expect(native.crashlytics.setCustomKey).toHaveBeenCalledWith({ key: "step", value: "test", type: "string" });
    expect(native.crashlytics.recordException).toHaveBeenCalledWith(expect.objectContaining({ message: "Regression probe" }));
    await c.setCrashlyticsUserId("regression-user");
    expect(native.crashlytics.setUserId).toHaveBeenCalledWith({ userId: "regression-user" });
    await c.logCrashlyticsMessage("probe");
    expect(native.crashlytics.log).toHaveBeenCalledWith({ message: "probe" });
    expect(native.thenReads).not.toHaveBeenCalled();
    for (const [event, handler] of listener.mock.calls) window.removeEventListener(event, handler);
    listener.mockRestore();
  });

  it("keeps both integrations inactive on the web", async () => {
    native.isNative.mockReturnValue(false);
    const w = await import("@/lib/workoutOngoing");
    const c = await import("@/lib/crashlytics");
    await w.touchOngoingWorkout({ restSeconds: 60 });
    await c.initCrashlytics();
    expect(native.notifications.schedule).not.toHaveBeenCalled();
    expect(native.crashlytics.setEnabled).not.toHaveBeenCalled();
    expect(native.thenReads).not.toHaveBeenCalled();
  });
});