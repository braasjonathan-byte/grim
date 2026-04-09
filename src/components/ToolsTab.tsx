import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { GripVertical, Pencil, Save, X, Loader2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import HonoraryBadge from "@/components/HonoraryBadge";
import { APP_VERSION } from "@/lib/version";

const SupporterButton = lazy(() => import("@/components/SupporterButton"));
const ProfileTab = lazy(() => import("@/components/ProfileTab"));
const AnnouncementInbox = lazy(() => import("@/components/AnnouncementInbox"));
const AdminUserList = lazy(() => import("@/components/AdminUserList"));
const ExerciseGifManager = lazy(() => import("@/components/ExerciseGifManager"));
const SettingsPanel = lazy(() => import("@/components/SettingsPanel"));
const NotificationSettings = lazy(() => import("@/components/NotificationSettings"));
const ReferralLink = lazy(() => import("@/components/ReferralLink"));
const EventCountdown = lazy(() => import("@/components/EventCountdown"));
const WorkoutTimer = lazy(() => import("@/components/WorkoutTimer"));
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
}

interface SectionDef {
  key: string;
  label: string;
  adminOnly?: boolean;
  render: () => React.ReactNode;
}

const ToolsTab = ({ userId, isAdmin, isHonorary, userRole }: ToolsTabProps) => {
  const [editMode, setEditMode] = useState(false);
  const [savedOrder, setSavedOrder] = useState<string[] | null>(null);
  const [localOrder, setLocalOrder] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const autoScrollRef = useRef<number | null>(null);

  const allSections: SectionDef[] = [
    { key: "supporter", label: "Supporter", render: () => <SupporterButton userId={userId} /> },
    { key: "profile", label: "Profil", render: () => <ProfileTab userId={userId} isAdmin={isAdmin} /> },
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
    { key: "announcements", label: "Meddelanden", render: () => <AnnouncementInbox userId={userId} isAdmin={isAdmin} /> },
    { key: "admin-users", label: "Användarlista", adminOnly: true, render: () => <AdminUserList userId={userId} /> },
    { key: "admin-exercises", label: "Övningsbibliotek", adminOnly: true, render: () => <ExerciseGifManager /> },
    { key: "settings", label: "Inställningar", render: () => <SettingsPanel userId={userId} isAdmin={isAdmin} /> },
    { key: "notifications", label: "Notiser", render: () => <NotificationSettings userId={userId} /> },
    { key: "referral", label: "Bjud in vän", render: () => <ReferralLink userId={userId} /> },
    { key: "events", label: "Nedräkning", render: () => <EventCountdown userId={userId} /> },
    { key: "timer", label: "Timer", render: () => <WorkoutTimer /> },
    { key: "1rm", label: "1RM-kalkylator", render: () => <OneRMCalculator /> },
    { key: "pulse", label: "Pulszoner", render: () => <PulseZoneCalculator /> },
    { key: "calories", label: "Kalorier", render: () => <CalorieCalculator /> },
    { key: "suggestions", label: "Förslag", render: () => <SuggestionBox userId={userId} isAdmin={isAdmin} /> },
    { key: "help", label: "Hjälp", render: () => <HelpSection /> },
  ];

  const defaultOrder = allSections.map(s => s.key);

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
    const availableKeys = new Set(available.map(s => s.key));
    
    // Order by saved order, then append any new sections not in saved order
    const ordered: SectionDef[] = [];
    for (const key of order) {
      if (!availableKeys.has(key)) continue;
      const section = available.find(s => s.key === key);
      if (section) ordered.push(section);
    }
    // Append any missing sections
    for (const s of available) {
      if (!ordered.find(o => o.key === s.key)) ordered.push(s);
    }
    return ordered;
  }, [editMode, localOrder, savedOrder, isAdmin, userId, userRole, isHonorary]);

  const handleStartEdit = () => {
    const current = savedOrder || defaultOrder;
    setLocalOrder([...current]);
    setEditMode(true);
  };

  const handleDragStart = (index: number) => {
    dragItem.current = index;
  };

  const handleDragEnter = (index: number) => {
    dragOverItem.current = index;
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
    const draggedItem = newOrder.splice(dragItem.current, 1)[0];
    newOrder.splice(dragOverItem.current, 0, draggedItem);
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
        {orderedSections.map((section, index) => (
          <div
            key={section.key}
            draggable={editMode}
            onDragStart={() => handleDragStart(index)}
            onDragEnter={() => handleDragEnter(index)}
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

      <p className="text-center text-[11px] text-muted-foreground pt-2 pb-4">Version {APP_VERSION}</p>
    </div>
  );
};

export default ToolsTab;
