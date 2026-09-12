import { useEffect, useRef, useState } from "react";
import { Heart, HeartOff, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
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
            ? prev.map((p) => (p.id === d.id ? { ...p, name: p.name ?? d.name, rssi: d.rssi ?? p.rssi } : p))
            : [...prev, d]
        );
      });
    } catch (err: any) {
      if (mounted.current) setScanError(err?.message || "Sökningen misslyckades");
    } finally {
      if (mounted.current) setScanning(false);
    }
  };

  const sorted = [...devices].sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999));

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
          <Button
            className="w-full rounded-full"
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

          {sorted.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Tryck på din pulsmätare för att ansluta:</p>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {sorted.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => void connectHeartRateDevice(d)}
                    className="w-full flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
                  >
                    <span className="truncate">{d.name || "Okänd enhet"}</span>
                    <span className="text-xs text-muted-foreground ml-2 shrink-0">
                      {d.rssi != null ? `${d.rssi} dBm` : ""}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {scanning && sorted.length === 0 && (
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
