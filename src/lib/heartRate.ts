// Singleton heart-rate service using Web Bluetooth (standard GATT Heart Rate
// service 0x180D / characteristic 0x2A37). Works in Chrome on Android/Desktop
// and in the Capacitor WebView on Android when the device exposes a standard
// BLE heart rate profile (most chest straps + many smartwatches in
// "broadcast" mode such as Polar, Garmin, Wahoo, Apple Watch via HR-relay
// apps, Coros, etc.).

type Snapshot = {
  bpm: number | null;
  connected: boolean;
  connecting: boolean;
  deviceName: string | null;
  error: string | null;
  supported: boolean;
};

let snapshot: Snapshot = {
  bpm: null,
  connected: false,
  connecting: false,
  deviceName: null,
  error: null,
  supported: typeof navigator !== "undefined" && !!(navigator as any).bluetooth,
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

let device: any = null;
let characteristic: any = null;

const parseHeartRate = (value: DataView): number => {
  const flags = value.getUint8(0);
  const is16bit = (flags & 0x01) !== 0;
  return is16bit ? value.getUint16(1, true) : value.getUint8(1);
};

const onValueChanged = (event: Event) => {
  const target = event.target as any;
  const value: DataView = target.value;
  if (!value) return;
  try {
    const bpm = parseHeartRate(value);
    if (bpm > 0 && bpm < 250) setSnap({ bpm });
  } catch {
    /* ignore */
  }
};

const onDisconnected = () => {
  setSnap({ connected: false, connecting: false, bpm: null });
};

export const connectHeartRate = async (): Promise<void> => {
  if (!snapshot.supported) {
    setSnap({
      error:
        "Bluetooth stöds inte i denna webbläsare. Använd Chrome på Android/dator eller en kompatibel app.",
    });
    return;
  }
  if (snapshot.connecting || snapshot.connected) return;
  setSnap({ connecting: true, error: null });
  try {
    const nav: any = navigator;
    device = await nav.bluetooth.requestDevice({
      filters: [{ services: ["heart_rate"] }],
      optionalServices: ["battery_service"],
    });
    if (!device) {
      setSnap({ connecting: false });
      return;
    }
    device.addEventListener("gattserverdisconnected", onDisconnected);
    const server = await device.gatt.connect();
    const service = await server.getPrimaryService("heart_rate");
    characteristic = await service.getCharacteristic("heart_rate_measurement");
    await characteristic.startNotifications();
    characteristic.addEventListener("characteristicvaluechanged", onValueChanged);
    setSnap({
      connected: true,
      connecting: false,
      deviceName: device.name || "Pulsmätare",
      error: null,
    });
  } catch (err: any) {
    setSnap({
      connecting: false,
      connected: false,
      error: err?.message || "Kunde inte ansluta till pulsmätare",
    });
  }
};

export const disconnectHeartRate = async (): Promise<void> => {
  try {
    if (characteristic) {
      try {
        characteristic.removeEventListener("characteristicvaluechanged", onValueChanged);
        await characteristic.stopNotifications();
      } catch {
        /* ignore */
      }
      characteristic = null;
    }
    if (device?.gatt?.connected) device.gatt.disconnect();
  } catch {
    /* ignore */
  }
  setSnap({ connected: false, connecting: false, bpm: null, deviceName: null });
};
