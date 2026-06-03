// Heart-rate service — uses Capacitor BLE plugin on native (Android APK / iOS)
// and Web Bluetooth in the browser/PWA. Remembers the last paired device id
// in localStorage so it can silently auto-reconnect on app start and after
// disconnects.
//
// Standard GATT Heart Rate Service 0x180D / characteristic 0x2A37.

import { Capacitor } from "@capacitor/core";

type Snapshot = {
  bpm: number | null;
  connected: boolean;
  connecting: boolean;
  deviceName: string | null;
  error: string | null;
  supported: boolean;
};

const HR_SERVICE = "0000180d-0000-1000-8000-00805f9b34fb";
const HR_MEASUREMENT = "00002a37-0000-1000-8000-00805f9b34fb";
const REMEMBER_KEY = "grim_hr_device_v1";

const isNative = Capacitor.isNativePlatform();
const isWeb = !isNative;

let snapshot: Snapshot = {
  bpm: null,
  connected: false,
  connecting: false,
  deviceName: null,
  error: null,
  supported: isNative || (typeof navigator !== "undefined" && !!(navigator as any).bluetooth),
};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const setSnap = (p: Partial<Snapshot>) => {
  snapshot = { ...snapshot, ...p };
  emit();
};

export const subscribeHeartRate = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export const getHeartRateSnapshot = (): Snapshot => snapshot;

const rememberDevice = (id: string, name: string | null) => {
  try { localStorage.setItem(REMEMBER_KEY, JSON.stringify({ id, name })); } catch {}
};
const forgetDevice = () => {
  try { localStorage.removeItem(REMEMBER_KEY); } catch {}
};
const getRemembered = (): { id: string; name: string | null } | null => {
  try {
    const raw = localStorage.getItem(REMEMBER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

const parseHeartRate = (value: DataView): number => {
  const flags = value.getUint8(0);
  const is16bit = (flags & 0x01) !== 0;
  return is16bit ? value.getUint16(1, true) : value.getUint8(1);
};

// ---------------- Native (Capacitor BLE) ----------------

let nativeDeviceId: string | null = null;

const nativeNotifHandler = (value: DataView) => {
  try {
    const bpm = parseHeartRate(value);
    if (bpm > 0 && bpm < 250) setSnap({ bpm });
  } catch {}
};

const nativeStart = async (deviceId: string, deviceName: string | null) => {
  const { BleClient } = await import("@capacitor-community/bluetooth-le");
  await BleClient.connect(deviceId, () => {
    // disconnected callback
    setSnap({ connected: false, bpm: null });
    // Try to reconnect silently after a short delay
    setTimeout(() => { void autoConnectHeartRate(); }, 2000);
  });
  await BleClient.startNotifications(deviceId, HR_SERVICE, HR_MEASUREMENT, nativeNotifHandler);
  nativeDeviceId = deviceId;
  rememberDevice(deviceId, deviceName);
  setSnap({
    connected: true,
    connecting: false,
    deviceName: deviceName || "Pulsmätare",
    error: null,
  });
};

const nativeConnect = async (silent: boolean): Promise<void> => {
  const { BleClient } = await import("@capacitor-community/bluetooth-le");
  setSnap({ connecting: true, error: null });
  try {
    await BleClient.initialize({ androidNeverForLocation: true });

    // Silent path: try the remembered device id first (no scan needed)
    const remembered = getRemembered();
    if (remembered) {
      try {
        await nativeStart(remembered.id, remembered.name);
        return;
      } catch (err) {
        if (silent) {
          setSnap({ connecting: false });
          return; // don't pop UI on auto-connect failure
        }
        // fall through to picker
      }
    }

    // No remembered device — try a brief background scan for any HR device
    // (e.g. a paired smartwatch broadcasting the Heart Rate service).
    try {
      const found: { deviceId: string; name?: string } | null = await new Promise((resolve) => {
        let resolved = false;
        const timeout = setTimeout(async () => {
          if (resolved) return;
          resolved = true;
          try { await BleClient.stopLEScan(); } catch {}
          resolve(null);
        }, silent ? 6000 : 12000);
        BleClient.requestLEScan(
          { services: [HR_SERVICE], allowDuplicates: false },
          async (res) => {
            if (resolved || !res?.device?.deviceId) return;
            resolved = true;
            clearTimeout(timeout);
            try { await BleClient.stopLEScan(); } catch {}
            resolve({ deviceId: res.device.deviceId, name: res.device.name });
          }
        ).catch(() => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timeout);
          resolve(null);
        });
      });
      if (found) {
        await nativeStart(found.deviceId, found.name ?? null);
        return;
      }
    } catch {}

    if (silent) {
      setSnap({ connecting: false });
      return;
    }

    // Interactive: show native chooser filtered by HR service
    const device = await BleClient.requestDevice({
      services: [HR_SERVICE],
      optionalServices: [HR_SERVICE],
    });
    await nativeStart(device.deviceId, device.name ?? null);
  } catch (err: any) {
    setSnap({
      connecting: false,
      connected: false,
      error: silent ? null : (err?.message || "Kunde inte ansluta till pulsmätare"),
    });
  }
};

const nativeDisconnect = async () => {
  try {
    const { BleClient } = await import("@capacitor-community/bluetooth-le");
    if (nativeDeviceId) {
      try { await BleClient.stopNotifications(nativeDeviceId, HR_SERVICE, HR_MEASUREMENT); } catch {}
      try { await BleClient.disconnect(nativeDeviceId); } catch {}
    }
  } catch {}
  nativeDeviceId = null;
  forgetDevice();
  setSnap({ connected: false, connecting: false, bpm: null, deviceName: null });
};

// ---------------- Web Bluetooth ----------------

let webDevice: any = null;
let webChar: any = null;

const onWebValueChanged = (event: Event) => {
  const target = event.target as any;
  const value: DataView = target.value;
  if (!value) return;
  try {
    const bpm = parseHeartRate(value);
    if (bpm > 0 && bpm < 250) setSnap({ bpm });
  } catch {}
};

const onWebDisconnected = () => {
  setSnap({ connected: false, connecting: false, bpm: null });
  if (webDevice) {
    setTimeout(() => { attachToWebDevice(webDevice).catch(() => {}); }, 1500);
  }
};

const attachToWebDevice = async (dev: any): Promise<boolean> => {
  if (!dev?.gatt) return false;
  setSnap({ connecting: true, error: null });
  try {
    dev.removeEventListener?.("gattserverdisconnected", onWebDisconnected);
    dev.addEventListener("gattserverdisconnected", onWebDisconnected);
    const server = await dev.gatt.connect();
    const service = await server.getPrimaryService("heart_rate");
    const ch = await service.getCharacteristic("heart_rate_measurement");
    await ch.startNotifications();
    ch.addEventListener("characteristicvaluechanged", onWebValueChanged);
    webDevice = dev;
    webChar = ch;
    rememberDevice(dev.id || dev.name || "web", dev.name || null);
    setSnap({
      connected: true,
      connecting: false,
      deviceName: dev.name || "Pulsmätare",
      error: null,
    });
    return true;
  } catch (err: any) {
    setSnap({ connecting: false, error: err?.message || null });
    return false;
  }
};

const webConnect = async (silent: boolean): Promise<void> => {
  if (!snapshot.supported) {
    if (!silent) {
      setSnap({
        error:
          "Bluetooth stöds inte i denna webbläsare. Använd Chrome på Android/dator eller appen.",
      });
    }
    return;
  }
  if (snapshot.connecting || snapshot.connected) return;

  if (silent) {
    const nav: any = navigator;
    if (typeof nav.bluetooth?.getDevices !== "function") return;
    try {
      const devices: any[] = await nav.bluetooth.getDevices();
      for (const dev of devices || []) {
        const ok = await attachToWebDevice(dev);
        if (ok) return;
      }
    } catch {}
    return;
  }

  setSnap({ connecting: true, error: null });
  try {
    const nav: any = navigator;
    const dev = await nav.bluetooth.requestDevice({
      filters: [{ services: ["heart_rate"] }],
      optionalServices: ["battery_service"],
    });
    if (!dev) { setSnap({ connecting: false }); return; }
    await attachToWebDevice(dev);
  } catch (err: any) {
    setSnap({
      connecting: false,
      error: err?.message || "Kunde inte ansluta till pulsmätare",
    });
  }
};

const webDisconnect = async () => {
  try {
    if (webChar) {
      try {
        webChar.removeEventListener("characteristicvaluechanged", onWebValueChanged);
        await webChar.stopNotifications();
      } catch {}
      webChar = null;
    }
    if (webDevice?.gatt?.connected) webDevice.gatt.disconnect();
  } catch {}
  forgetDevice();
  setSnap({ connected: false, connecting: false, bpm: null, deviceName: null });
};

// ---------------- Public API ----------------

export const connectHeartRate = (): Promise<void> =>
  isNative ? nativeConnect(false) : webConnect(false);

export const disconnectHeartRate = (): Promise<void> =>
  isNative ? nativeDisconnect() : webDisconnect();

export const autoConnectHeartRate = (): Promise<void> =>
  isNative ? nativeConnect(true) : webConnect(true);
