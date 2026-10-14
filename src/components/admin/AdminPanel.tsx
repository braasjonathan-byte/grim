import { useState, Suspense, type ReactNode } from "react";
import { ChevronDown, Shield, Loader2 } from "lucide-react";
import { lazyRetry } from "@/lib/lazyRetry";

const AdminUserList = lazyRetry(() => import("@/components/AdminUserList"));
const ExerciseGifManager = lazyRetry(() => import("@/components/ExerciseGifManager"));
const ReadyWorkoutManager = lazyRetry(() => import("@/components/ReadyWorkoutManager"));
const AdminCompletionsList = lazyRetry(() => import("@/components/AdminCompletionsList"));
const SuggestionBox = lazyRetry(() => import("@/components/SuggestionBox"));
const AnnouncementInbox = lazyRetry(() => import("@/components/AnnouncementInbox"));
const AdminAppSettings = lazyRetry(() => import("@/components/admin/AdminAppSettings"));
const AdminRecipes = lazyRetry(() => import("@/components/admin/AdminRecipes"));
const AdminFoods = lazyRetry(() => import("@/components/admin/AdminFoods"));
const AdminExerciseUnits = lazyRetry(() => import("@/components/admin/AdminExerciseUnits"));
const AdminReports = lazyRetry(() => import("@/components/admin/AdminReports"));

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: () => ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-border bg-card">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-3 pb-3">
          <Suspense fallback={<Loader2 className="w-4 h-4 animate-spin mx-auto my-3" />}>{children()}</Suspense>
        </div>
      )}
    </div>
  );
}

export default function AdminPanel({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-primary/40 bg-primary/5 p-3 space-y-2">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-bold"><Shield className="w-4 h-4 text-primary" /> Adminverktyg</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground">Ändringar här slår igenom för alla användare direkt, utan ny app.</p>
          <p className="text-xs font-semibold text-muted-foreground pt-1">Användare</p>
          <Section title="Användare & behörighet" subtitle="Sök medlemmar, ge hedersmedlemskap eller admin">{() => <AdminUserList userId={userId} />}</Section>
          <Section title="Senaste klarmarkerade pass" subtitle="Vad användarna har tränat">{() => <AdminCompletionsList />}</Section>

          <p className="text-xs font-semibold text-muted-foreground pt-1">Kost</p>
          <Section title="Färdiga recept" subtitle="Ändra, dölj eller lägg till recept">{() => <AdminRecipes userId={userId} />}</Section>
          <Section title="Livsmedel & AI-rättning" subtitle="Rätta näringsvärden, hitta felaktiga livsmedel">{() => <AdminFoods />}</Section>

          <p className="text-xs font-semibold text-muted-foreground pt-1">Träning</p>
          <Section title="Övningarnas enheter" subtitle="Reps, sekunder, meter och kroppsvikt">{() => <AdminExerciseUnits userId={userId} />}</Section>
          <Section title="Övningsbibliotek" subtitle="Bilder, instruktioner och muskelgrupper">{() => <ExerciseGifManager />}</Section>
          <Section title="Färdiga pass" subtitle="Passtyper och cirkelpass">{() => <ReadyWorkoutManager />}</Section>

          <p className="text-xs font-semibold text-muted-foreground pt-1">Innehåll & moderering</p>
          <Section title="Rapporterade inlägg" subtitle="Granska och ta bort">{() => <AdminReports />}</Section>
          <Section title="Utskick till alla" subtitle="Meddelanden från Grim med avisering">{() => <AnnouncementInbox userId={userId} isAdmin />}</Section>
          <Section title="Förslag från användare" subtitle="Läs och svara">{() => <SuggestionBox userId={userId} isAdmin />}</Section>

          <p className="text-xs font-semibold text-muted-foreground pt-1">App</p>
          <Section title="App-inställningar" subtitle="Meddelanden och funktioner för alla">{() => <AdminAppSettings userId={userId} />}</Section>
        </div>
      )}
    </div>
  );
}
