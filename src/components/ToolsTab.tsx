import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { ChevronRight, ChevronLeft, GripVertical, Pencil, Save, X, Loader2, Check, LogOut, SlidersHorizontal, Wrench, RefreshCw, Trash2, Route as RouteIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { updateApp } from "@/lib/appUpdate";
import { APP_VERSION } from "@/lib/version";
import { supabase } from "@/integrations/supabase/client";
import HonoraryBadge from "@/components/HonoraryBadge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import ProfileCompletenessBanner from "@/components/ProfileCompletenessBanner";
const SupporterButton = lazy(() => import("@/components/SupporterButton"));
const ProfileTab = lazy(() => import("@/components/ProfileTab"));
const AdminUserList = lazy(() => import("@/components/AdminUserList"));
const ExerciseGifManager = lazy(() => import("@/components/ExerciseGifManager"));
const AdminCompletionsList = lazy(() => import("@/components/AdminCompletionsList"));
const RouteBuilderDialog = lazy(() => import("@/components/RouteBuilderDialog"));

const ReadyWorkoutManager = lazy(() => import("@/components/ReadyWorkoutManager"));
const TriathlonView = lazy(() => import("@/components/TriathlonView"));
const SettingsPanel = lazy(() => import("@/components/SettingsPanel"));
const NotificationSettings = lazy(() => import("@/components/NotificationSettings"));
const ReferralLink = lazy(() => import("@/components/ReferralLink"));
const EventCountdown = lazy(() => import("@/components/EventCountdown"));
const WorkoutTimer = lazy(() => import("@/components/WorkoutTimer"));
const RestTimerSettings = lazy(() => import("@/components/RestTimerSettings"));
const OneRMCalculator = lazy(() => import("@/components/OneRMCalculator"));
const PulseZoneCalculator = lazy(() => import("@/components/PulseZoneCalculator"));
const CalorieCalculator = lazy(() => import("@/components/CalorieCalculator"));
const SuggestionBox = lazy(() => import("@/components/SuggestionBox"));
const HelpSection = lazy(() => import("@/components/HelpSection"));
const DisclaimerSection = lazy(() => import("@/components/DisclaimerSection"));

interface ToolsTabProps {
  userId: string;
  isAdmin: boolean;
  isHonorary: boolean;
  userRole: string;
  onViewUserPlan?: (targetUserId: string) => void;
  onLogout?: () => void;
}

interface SectionDef {
  key: string;
  label: string;
  adminOnly?: boolean;
  render: () => React.ReactNode;
}

const ToolsTab = ({ userId, isAdmin, isHonorary, userRole, onViewUserPlan, onLogout }: ToolsTabProps) => {
  const [editMode, setEditMode] = useState(false);
  const [savedOrder, setSavedOrder] = useState<string[] | null>(null);
  const [localOrder, setLocalOrder] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [confirmDelete1, setConfirmDelete1] = useState(false);
  const [confirmDelete2, setConfirmDelete2] = useState(false);
  const navigate = useNavigate();
  const [subView, setSubView] = useState<"home" | "helpers" | "settings">("home");
  const [routeBuilderOpen, setRouteBuilderOpen] = useState(false);
  const dragItem = useRef<string | null>(null);
  const dragOverItem = useRef<string | null>(null);
  const autoScrollRef = useRef<number | null>(null);

  // Tour navigation – open the relevant subpage when requested
  useEffect(() => {
    const handler = (e: Event) => {
      const target = (e as CustomEvent).detail as "settings" | "helpers" | "help";
      if (target === "settings") setSubView("settings");
      else if (target === "helpers") setSubView("helpers");
      else if (target === "help") {
        setSubView("home");
        requestAnimationFrame(() => {
          document.querySelector('[data-tour="tools-help"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
      }
    };
    window.addEventListener("grim:tools-expand", handler);
    return () => window.removeEventListener("grim:tools-expand", handler);
  }, []);

  // Reset scroll when entering/leaving a subpage
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [subView]);

  const helperToolKeys = new Set(["events", "timer", "1rm", "pulse", "calories"]);
  const settingsToolKeys = new Set(["profile", "settings", "notifications"]);

  const allSections: SectionDef[] = [
    { key: "supporter", label: "Supporter", render: () => <SupporterButton userId={userId} /> },
    { key: "role-badge", label: "Roll", render: () => (
      <div className="flex items-center gap-2">
        {userRole === "admin" ? (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/20 text-primary">👑 Admin</span>
        ) : isHonorary ? (
          <HonoraryBadge size="md" />
        ) : (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-secondary text-muted-foreground">👤 Medlem</span>
        )}
      </div>
    )},
    { key: "admin-users", label: "Användarlista", adminOnly: true, render: () => <AdminUserList userId={userId} onViewUserPlan={onViewUserPlan} /> },
    { key: "admin-exercises", label: "Övningsbibliotek", adminOnly: true, render: () => <ExerciseGifManager /> },
    
    { key: "admin-workout-types", label: "Passtyper", adminOnly: true, render: () => <ReadyWorkoutManager /> },
    { key: "admin-completions", label: "Senaste klarmarkerade", adminOnly: true, render: () => <AdminCompletionsList /> },
    { key: "settings-group", label: "Inställningar", render: () => (
      <button
        type="button"
        data-tour="tools-profile"
        onClick={() => setSubView("settings")}
        className="w-full flex items-center justify-between gap-3 p-4 text-left rounded-2xl bg-card shadow-soft border border-border/40 hover:bg-muted/40 active:bg-muted/60 active:scale-[0.99] transition-all"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <SlidersHorizontal className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-foreground">Inställningar</span>
            <span className="block truncate text-xs text-muted-foreground">Profil, tema och notiser</span>
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
    )},
    { key: "helpers", label: "Hjälpmedel", render: () => (
      <button
        type="button"
        data-tour="tools-helpers"
        onClick={() => setSubView("helpers")}
        className="w-full flex items-center justify-between gap-3 p-4 text-left rounded-2xl bg-card shadow-soft border border-border/40 hover:bg-muted/40 active:bg-muted/60 active:scale-[0.99] transition-all"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Wrench className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-foreground">Hjälpmedel</span>
            <span className="block truncate text-xs text-muted-foreground">Timer, kalkylatorer och nedräkning</span>
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
    )},
    { key: "route-builder", label: "Skapa runda", render: () => (
      <button
        type="button"
        onClick={() => setRouteBuilderOpen(true)}
        className="w-full flex items-center justify-between gap-3 p-4 text-left rounded-2xl bg-card shadow-soft border border-border/40 hover:bg-muted/40 active:bg-muted/60 active:scale-[0.99] transition-all"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <RouteIcon className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-foreground">Skapa runda</span>
            <span className="block truncate text-xs text-muted-foreground">Slingförslag på riktiga vägar och stigar</span>
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
    )},
    

    { key: "suggestions", label: "Förslag", adminOnly: true, render: () => <SuggestionBox userId={userId} isAdmin={isAdmin} /> },
    { key: "help", label: "Hjälp", render: () => <HelpSection /> },
  ];

  const hiddenSectionKeys = new Set(["role-badge"]);
  const defaultOrder = allSections.map(s => s.key).filter(key => !hiddenSectionKeys.has(key));

  // Fetch global layout
  useEffect(() => {
    supabase
      .from("tool_layout" as any)
      .select("section_order")
      .limit(1)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data?.section_order && Array.isArray(data.section_order) && data.section_order.length > 0) {
          setSavedOrder(data.section_order);
        } else {
          setSavedOrder(defaultOrder);
        }
      });
  }, []);

  // Compute ordered sections
  const getOrderedSections = useCallback(() => {
    const order = editMode ? localOrder : (savedOrder || defaultOrder);
    // Filter admin-only for non-admins
    const available = allSections.filter(s => !s.adminOnly || isAdmin);
    const unpinnedAvailable = available.filter(s => !hiddenSectionKeys.has(s.key));
    const availableKeys = new Set(unpinnedAvailable.map(s => s.key));
    
    // Order by saved order, then append any new sections not in saved order
    const ordered: SectionDef[] = [];
    for (const key of order) {
      const normalizedKey = helperToolKeys.has(key) ? "helpers" : settingsToolKeys.has(key) ? "settings-group" : key;
      if (ordered.find(s => s.key === normalizedKey)) continue;
      if (!availableKeys.has(normalizedKey)) continue;
      const section = unpinnedAvailable.find(s => s.key === normalizedKey);
      if (section) ordered.push(section);
    }
    // Append any missing sections
    for (const s of unpinnedAvailable) {
      if (!ordered.find(o => o.key === s.key)) ordered.push(s);
    }
    return ordered;
  }, [editMode, localOrder, savedOrder, isAdmin, userId, userRole, isHonorary]);

  const handleStartEdit = () => {
    const current = savedOrder || defaultOrder;
    setLocalOrder([...current]);
    setEditMode(true);
  };

  const handleDragStart = (key: string) => {
    dragItem.current = key;
  };

  const handleDragEnter = (key: string) => {
    dragOverItem.current = key;
  };

  const stopAutoScroll = () => {
    if (autoScrollRef.current !== null) {
      cancelAnimationFrame(autoScrollRef.current);
      autoScrollRef.current = null;
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    const threshold = 80;
    const speed = 8;
    const y = e.clientY;
    const vh = window.innerHeight;

    stopAutoScroll();

    const scroll = () => {
      if (y < threshold) {
        window.scrollBy(0, -speed);
      } else if (y > vh - threshold) {
        window.scrollBy(0, speed);
      } else {
        return;
      }
      autoScrollRef.current = requestAnimationFrame(scroll);
    };

    if (y < threshold || y > vh - threshold) {
      autoScrollRef.current = requestAnimationFrame(scroll);
    }
  };

  const handleDragEnd = () => {
    stopAutoScroll();
    if (dragItem.current === null || dragOverItem.current === null) return;
    const newOrder = [...localOrder];
    const draggedIndex = newOrder.indexOf(dragItem.current);
    const targetIndex = newOrder.indexOf(dragOverItem.current);
    if (draggedIndex === -1 || targetIndex === -1) return;
    const draggedItem = newOrder.splice(draggedIndex, 1)[0];
    newOrder.splice(targetIndex, 0, draggedItem);
    setLocalOrder(newOrder);
    dragItem.current = null;
    dragOverItem.current = null;
  };

  const handleSave = async () => {
    setSaving(true);
    // Update the single row
    const { data: existing } = await supabase
      .from("tool_layout" as any)
      .select("id")
      .limit(1)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("tool_layout" as any)
        .update({ section_order: localOrder, updated_at: new Date().toISOString(), updated_by: userId } as any)
        .eq("id", (existing as any).id);
    }
    
    setSavedOrder(localOrder);
    setSaving(false);
    setSaved(true);
    setTimeout(() => { setSaved(false); setEditMode(false); }, 1200);
  };

  const orderedSections = getOrderedSections();

  if (subView !== "home") {
    const title = subView === "settings" ? "Inställningar" : "Hjälpmedel";
    return (
      <div className="py-2 space-y-4">
        <div className="flex items-center gap-2 -mx-1">
          <button
            type="button"
            onClick={() => setSubView("home")}
            className="flex items-center gap-1 py-2 px-2 text-sm font-semibold text-primary hover:opacity-80 transition-opacity"
          >
            <ChevronLeft className="h-4 w-4" />
            Tillbaka
          </button>
          <h2 className="text-base font-bold text-foreground">{title}</h2>
        </div>
        <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>}>
          {subView === "settings" ? (
            <div className="space-y-3">
              <ProfileTab userId={userId} isAdmin={isAdmin} />
              <SettingsPanel userId={userId} isAdmin={isAdmin} isHonorary={isHonorary} />
              <NotificationSettings userId={userId} />
            </div>
          ) : (
            <div className="space-y-3">
              <RestTimerSettings />
              <EventCountdown userId={userId} />
              <CalorieCalculator />
              <OneRMCalculator />
              <PulseZoneCalculator />
              <WorkoutTimer />
            </div>
          )}
        </Suspense>
      </div>
    );
  }

  return (
    <div className="py-2 space-y-4">
      <h2 className="sr-only">Verktyg och inställningar</h2>
      <div className="flex items-center gap-2">
        {userRole === "admin" ? (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/20 text-primary">👑 Admin</span>
        ) : isHonorary ? (
          <HonoraryBadge size="md" />
        ) : (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-secondary text-muted-foreground">👤 Medlem</span>
        )}
      </div>

      <ProfileCompletenessBanner userId={userId} />

      {routeBuilderOpen && (
        <Suspense fallback={null}>
          <RouteBuilderDialog open={routeBuilderOpen} onOpenChange={setRouteBuilderOpen} />
        </Suspense>
      )}

      <Suspense fallback={null}>
        <ReferralLink userId={userId} />
      </Suspense>

      {/* Admin edit mode toggle */}
      {isAdmin && !editMode && (
        <button
          onClick={handleStartEdit}
          className="w-full flex items-center justify-center gap-2 py-2 px-4 text-sm font-semibold text-primary bg-primary/10 rounded-full shadow-soft active:scale-[0.97] hover:bg-primary/20 transition-colors"
        >
          <Pencil className="w-4 h-4" />
          Redigera ordning
        </button>
      )}

      {editMode && (
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-4 text-sm font-semibold text-primary-foreground bg-primary rounded-full shadow-soft active:scale-[0.97] hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <><Check className="w-4 h-4" /> Sparat!</> : <><Save className="w-4 h-4" /> Spara för alla</>}
          </button>
          <button
            onClick={() => setEditMode(false)}
            className="py-2 px-4 text-sm font-semibold text-muted-foreground bg-secondary rounded-full shadow-soft active:scale-[0.97] hover:bg-secondary/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {editMode && (
        <p className="text-xs text-muted-foreground text-center">
          Dra och släpp för att ändra ordning. Sparar för alla användare.
        </p>
      )}

      <Suspense fallback={null}>
        {orderedSections.map((section) => (
          <div
            key={section.key}
            draggable={editMode}
            onDragStart={() => handleDragStart(section.key)}
            onDragEnter={() => handleDragEnter(section.key)}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            className={editMode ? "relative cursor-grab active:cursor-grabbing" : ""}
          >
            {editMode && (
              <div className="absolute -left-1 top-1/2 -translate-y-1/2 z-10 p-1 text-muted-foreground">
                <GripVertical className="w-4 h-4" />
              </div>
            )}
            <div className={editMode ? "ml-5 border border-dashed border-border rounded-lg p-1" : ""}>
              {section.render()}
            </div>
          </div>
        ))}
      </Suspense>

      {onLogout && (
        <>
          <button
            onClick={() => setConfirmDelete1(true)}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 text-sm font-semibold text-destructive bg-secondary rounded-full shadow-soft active:scale-[0.97] hover:opacity-90 transition-opacity"
          >
            <Trash2 className="w-4 h-4" />
            Radera konto
          </button>
          <button
            onClick={() => setConfirmLogout(true)}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 text-sm font-semibold text-destructive bg-secondary rounded-full shadow-soft active:scale-[0.97] hover:opacity-90 transition-opacity"
          >
            <LogOut className="w-4 h-4" />
            Logga ut
          </button>
        </>
      )}

      <AlertDialog open={confirmDelete1} onOpenChange={setConfirmDelete1}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Radera konto?</AlertDialogTitle>
            <AlertDialogDescription>
              Detta tar bort hela ditt konto och all data (pass, vänner, meddelanden, prenumeration). Åtgärden kan inte ångras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setConfirmDelete1(false); setConfirmDelete2(true); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Fortsätt
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete2} onOpenChange={setConfirmDelete2}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Är du helt säker?</AlertDialogTitle>
            <AlertDialogDescription>
              Sista chansen att avbryta. Vill du verkligen radera kontot permanent?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Nej, behåll kontot</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setConfirmDelete2(false); navigate("/delete-account"); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Ja, radera permanent
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmLogout} onOpenChange={setConfirmLogout}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Logga ut?</AlertDialogTitle>
            <AlertDialogDescription>
              Är du säker på att du vill logga ut?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setConfirmLogout(false); onLogout?.(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Logga ut
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Suspense fallback={null}>
        <DisclaimerSection />
      </Suspense>

      <button
        type="button"
        onClick={updateApp}
        className="w-full py-2.5 mt-2 bg-secondary text-foreground text-sm font-bold border border-border flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
      >
        <RefreshCw className="w-4 h-4" />
        Uppdatera appen
      </button>

      <p className="text-center text-[11px] text-muted-foreground pt-2 pb-4">Version {APP_VERSION}</p>
    </div>
  );
};

export default ToolsTab;
