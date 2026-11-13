import { useOfflineStatus } from "@/hooks/useOfflineSync";
import { WifiOff, CloudUpload } from "lucide-react";

export default function ConnectionNotice() {
  const { online, pending } = useOfflineStatus();
  if (online && !pending) return null;
  return <div role="status" className="border-b border-border bg-muted px-4 py-2 text-xs text-foreground flex items-start gap-2">
    {online ? <CloudUpload className="h-4 w-4 shrink-0" /> : <WifiOff className="h-4 w-4 shrink-0" />}
    <span>{online ? `${pending} träningsändringar väntar på att sparas. Synkningen försöker igen automatiskt.` : "Ingen internetanslutning. Träningsändringar väntar på synkning. Mat och andra ändringar är inte sparade förrän du får en bekräftelse."}</span>
  </div>;
}