import { useEffect, useMemo, useRef, useState } from "react";
import { Heart, HeartOff, Loader2, RefreshCw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useHeartRate } from "@/hooks/useHeartRate";
import {
  connectHeartRateDevice,
  scanHeartRateDevices,
  stopHeartRateScan,
  type ScanDevice,
} from "@/lib/heartRate";

/** Kort för att söka, koppla upp och koppla ifrån en pulsmätare (Bluetooth). */
const HeartRateConnectCard = () => {
  const hr = useHeartRate();
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<ScanDevice[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [showUnknown, setShowUnknown] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      void stopHeartRateScan();
    };
  }, []);

  const startScan = async () => {
    setScanError(null);
    setDevices([]);
    setScanning(true);
    try {
      await scanHeartRateDevices((d) => {
        if (!mounted.current) return;
        setDevices((prev) =>
          prev.some((p) => p.id === d.id)
            ? prev.map((p) =>
                p.id === d.id
                  ? {
                      ...p,
                      name: p.name ?? d.name,
                      rssi: d.rssi ?? p.rssi,
                      isHeartRate: p.isHeartRate || d.isHeartRate,
                    }
                  : p
              )
            : [...prev, d]
        );
      });
    } catch (err: any) {
      if (mounted.current) setScanError(err?.message || "Sökningen misslyckades");
    } finally {
      if (mounted.current) setScanning(false);
    }
  };

  const hiddenCount = devices.filter((d) => !d.isHeartRate && !d.name).length;

  const sorted = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return devices
      .filter((d) => (showUnknown || d.isHeartRate || !!d.name))
      .filter((d) => !q || (d.name || "").toLowerCase().includes(q))
      .sort((a, b) => {
        if (!!a.isHeartRate !== !!b.isHeartRate) return a.isHeartRate ? -1 : 1;
        if (!!a.name !== !!b.name) return a.name ? -1 : 1;
        return (b.rssi ?? -999) - (a.rssi ?? -999);
      });
  }, [devices, filter, showUnknown]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <Heart className={`h-4 w-4 ${hr.connected ? "text-destructive" : "text-muted-foreground"}`} />
        <span className="text-muted-foreground">
          {hr.connected
            ? `Ansluten${hr.deviceName ? ` – ${hr.deviceName}` : ""}${hr.bpm ? ` · ${hr.bpm} bpm` : ""}`
            : "Ingen pulsmätare ansluten"}
        </span>
      </div>

      {hr.connected ? (
        <Button variant="outline" className="w-full rounded-full" onClick={() => void hr.disconnect()}>
          <HeartOff className="h-4 w-4 mr-2" />
          Koppla ifrån
        </Button>
      ) : (
        <>
          <div className="flex gap-2">
            <Button
              className="flex-1 rounded-full"
              disabled={scanning || hr.connecting || !hr.supported}
              onClick={() => void startScan()}
            >
              {scanning ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {scanning ? "Söker enheter…" : "Sök pulsmätare"}
            </Button>
            {scanning && (
              <Button variant="outline" className="rounded-full" onClick={() => void stopHeartRateScan()}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {devices.length > 0 && (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Sök på namn, t.ex. Polar eller HRM"
                  className="pl-9 rounded-full"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Tryck på din pulsmätare för att ansluta. Pulsmätare visas överst.
              </p>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {sorted.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => void connectHeartRateDevice(d)}
                    className="w-full flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      {d.isHeartRate && <Heart className="h-3.5 w-3.5 text-destructive shrink-0" />}
                      <span className="truncate">{d.name || "Okänd enhet"}</span>
                    </span>
                    <span className="text-xs text-muted-foreground ml-2 shrink-0">
                      {d.rssi != null ? `${d.rssi} dBm` : ""}
                    </span>
                  </button>
                ))}
                {sorted.length === 0 && (
                  <p className="text-xs text-muted-foreground">Ingen enhet matchar sökningen.</p>
                )}
              </div>
              {hiddenCount > 0 && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline"
                  onClick={() => setShowUnknown((v) => !v)}
                >
                  {showUnknown ? "Dölj namnlösa enheter" : `Visa ${hiddenCount} namnlösa enheter`}
                </button>
              )}
            </div>
          )}

          {scanning && devices.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Se till att pulsbandet sitter på (fuktad elektrod) och inte är anslutet till en annan app eller klocka.
            </p>
          )}
          {!scanning && sorted.length === 0 && (
            <Button
              variant="outline"
              className="w-full rounded-full"
              disabled={hr.connecting || !hr.supported}
              onClick={() => void hr.connect()}
            >
              {hr.connecting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Heart className="h-4 w-4 mr-2" />}
              Anslut automatiskt
            </Button>
          )}
        </>
      )}

      {!hr.supported && (
        <p className="text-xs text-muted-foreground">
          Bluetooth stöds inte här. Använd appen eller Chrome på Android/dator.
        </p>
      )}
      {scanError && <p className="text-xs text-destructive">{scanError}</p>}
      {hr.error && <p className="text-xs text-destructive">{hr.error}</p>}
      <p className="text-xs text-muted-foreground">
        När pulsmätaren är ansluten visas pulsen i en ruta du kan flytta runt på skärmen. ANT+ kräver särskild
        hårdvara som saknas i nästan alla moderna telefoner – har ditt band både ANT+ och Bluetooth, välj Bluetooth.
      </p>
    </div>
  );
};

export default HeartRateConnectCard;
