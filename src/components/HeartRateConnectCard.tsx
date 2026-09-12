import { Heart, HeartOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHeartRate } from "@/hooks/useHeartRate";

/** Kort för att koppla upp/koppla ifrån en Bluetooth-pulsmätare. */
const HeartRateConnectCard = () => {
  const hr = useHeartRate();

  return (
    <div className="space-y-2">
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
        <Button
          className="w-full rounded-full"
          disabled={hr.connecting || !hr.supported}
          onClick={() => void hr.connect()}
        >
          {hr.connecting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Heart className="h-4 w-4 mr-2" />}
          {hr.connecting ? "Söker pulsmätare…" : "Anslut pulsmätare"}
        </Button>
      )}

      {!hr.supported && (
        <p className="text-xs text-muted-foreground">
          Bluetooth stöds inte här. Använd appen eller Chrome på Android/dator.
        </p>
      )}
      {hr.error && <p className="text-xs text-destructive">{hr.error}</p>}
      <p className="text-xs text-muted-foreground">
        När pulsmätaren är ansluten visas pulsen i en ruta du kan flytta runt på skärmen.
      </p>
    </div>
  );
};

export default HeartRateConnectCard;
