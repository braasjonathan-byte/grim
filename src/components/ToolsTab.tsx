import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { ChevronDown, GripVertical, Pencil, Save, X, Loader2, Check, LogOut, SlidersHorizontal, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import HonoraryBadge from "@/components/HonoraryBadge";
import { APP_VERSION } from "@/lib/version";
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
const ReadyWorkoutManager = lazy(() => import("@/components/ReadyWorkoutManager"));
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
  const [toolsOpen, setToolsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const dragItem = useRef<string | null>(null);
  const dragOverItem = useRef<string | null>(null);
  const autoScrollRef = useRef<number | null>(null);

  // Tour navigation – expand sections + scroll into view when requested
  useEffect(() => {
    const handler = (e: Event) => {
      const target = (e as CustomEvent).detail as "settings" | "helpers" | "help";
      if (target === "settings") setSettingsOpen(true);
      if (target === "helpers") setToolsOpen(true);
      // Scroll the related anchor into view
      requestAnimationFrame(() => {
        const sel =
          target === "settings" ? '[data-tour="tools-profile"]' :
          target === "helpers" ? '[data-tour="tools-helpers"]' :
          target === "help" ? '[data-tour="tools-help"]' : null;
        if (sel) document.querySelector(sel)?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    };
    window.addEventListener("grim:tools-expand", handler);
    return () => window.removeEventListener("grim:tools-expand", handler);
  }, []);

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
    { key: "settings-group", label: "Inställningar", render: () => (
      <div className="rounded-lg border border-border overflow-hidden shadow-none bg-secondary">
        <button
          type="button"
          onClick={() => setSettingsOpen((open) => !open)}
          className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-secondary/60 transition-colors"
          aria-expanded={settingsOpen}
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <SlidersHorizontal className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-foreground">Inställningar</span>
              <span className="block truncate text-xs text-muted-foreground">Profil, tema och notiser</span>
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary">
            {settingsOpen ? "Stäng" : "Öppna"}
            <ChevronDown className={`h-4 w-4 transition-transform ${settingsOpen ? "rotate-180" : ""}`} />
          </span>
        </button>
        {settingsOpen && (
          <div className="space-y-3 border-t border-border bg-background/50 p-3">
            <ProfileTab userId={userId} isAdmin={isAdmin} />
            <SettingsPanel userId={userId} isAdmin={isAdmin} isHonorary={isHonorary} />
            <NotificationSettings userId={userId} />
          </div>
        )}
      </div>
    )},
    { key: "helpers", label: "Hjälpmedel", render: () => (
      <div className="rounded-lg border border-border overflow-hidden bg-secondary">
        <button
          type="button"
          onClick={() => setToolsOpen((open) => !open)}
          className="w-full flex items-center justify-between gap-3 p-4 text-left"
          aria-expanded={toolsOpen}
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Wrench className="h-4 w-4 text-primary" />
            Hjälpmedel
          </span>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${toolsOpen ? "rotate-180" : ""}`} />
        </button>
        {toolsOpen && (
          <div className="space-y-3 border-t border-border p-3">
            <RestTimerSettings />
            <EventCountdown userId={userId} />
            <CalorieCalculator />
            <OneRMCalculator />
            <PulseZoneCalculator />
            <WorkoutTimer />
          </div>
        )}
      </div>
    )},
    { key: "suggestions", label: "Förslag", render: () => <SuggestionBox userId={userId} isAdmin={isAdmin} /> },
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
  }, [editMode, localOrder, savedOrder, isAdmin, userId, userRole, isHonorary, toolsOpen, settingsOpen]);

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

  return (
    <div className="py-2 space-y-4">
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

      <Suspense fallback={null}>
        <ReferralLink userId={userId} />
      </Suspense>

      {/* Admin edit mode toggle */}
      {isAdmin && !editMode && (
        <button
          onClick={handleStartEdit}
          className="w-full flex items-center justify-center gap-2 py-2 px-4 text-sm font-semibold text-primary bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors"
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
            className="flex-1 flex items-center justify-center gap-2 py-2 px-4 text-sm font-semibold text-primary-foreground bg-primary rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <><Check className="w-4 h-4" /> Sparat!</> : <><Save className="w-4 h-4" /> Spara för alla</>}
          </button>
          <button
            onClick={() => setEditMode(false)}
            className="py-2 px-4 text-sm font-semibold text-muted-foreground bg-secondary rounded-lg hover:bg-secondary/80 transition-colors"
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
        <button
          onClick={() => setConfirmLogout(true)}
          className="w-full flex items-center justify-center gap-2 py-2 px-4 text-sm font-semibold text-destructive bg-secondary rounded-lg hover:opacity-90 transition-opacity"
        >
          <LogOut className="w-4 h-4" />
          Logga ut
        </button>
      )}

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

      <p className="text-center text-[11px] text-muted-foreground pt-2 pb-4">Version {APP_VERSION}</p>
    </div>
  );
};

export default ToolsTab;
