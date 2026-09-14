import { lazyRetry } from "@/lib/lazyRetry";
import { useState, useEffect, useMemo, Suspense } from "react";
import {
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Loader2,
  LogOut,
  SlidersHorizontal,
  Wrench,
  RefreshCw,
  
  Search,
  Users,
  Dumbbell,
  Calendar,
  Sparkles,
  Heart,
  UserCog,
  ShieldCheck,
  Image as ImageIcon,
  X,
  ArrowUp,
  ArrowDown,
  Check,
  Move,
  Link,
  MessageSquarePlus,
  Camera,
  Activity,
} from "lucide-react";
import { useToolLayout, applyOrder, move } from "@/hooks/useToolLayout";
import type { LucideIcon } from "lucide-react";

import { updateApp } from "@/lib/appUpdate";
import { APP_VERSION } from "@/lib/version";
import HonoraryBadge from "@/components/HonoraryBadge";
import { helpCategories } from "@/data/helpTopics";
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
import HeartRateConnectCard from "@/components/HeartRateConnectCard";
import FormCheckCard from "@/components/FormCheckCard";
import HealthConnectCard from "@/components/HealthConnectCard";
import { toast } from "sonner";

const SupporterButton = lazyRetry(() => import("@/components/SupporterButton"));
const ProfileTab = lazyRetry(() => import("@/components/ProfileTab"));
const AdminUserList = lazyRetry(() => import("@/components/AdminUserList"));
const ExerciseGifManager = lazyRetry(() => import("@/components/ExerciseGifManager"));
const AdminCompletionsList = lazyRetry(() => import("@/components/AdminCompletionsList"));
const ReadyWorkoutManager = lazyRetry(() => import("@/components/ReadyWorkoutManager"));
const SettingsPanel = lazyRetry(() => import("@/components/SettingsPanel"));
const NotificationSettings = lazyRetry(() => import("@/components/NotificationSettings"));
const EventCountdown = lazyRetry(() => import("@/components/EventCountdown"));
const WorkoutTimer = lazyRetry(() => import("@/components/WorkoutTimer"));
const RestTimerSettings = lazyRetry(() => import("@/components/RestTimerSettings"));
const OneRMCalculator = lazyRetry(() => import("@/components/OneRMCalculator"));
const PulseZoneCalculator = lazyRetry(() => import("@/components/PulseZoneCalculator"));
const CalorieCalculator = lazyRetry(() => import("@/components/CalorieCalculator"));
const DisclaimerSection = lazyRetry(() => import("@/components/DisclaimerSection"));
const GuidedTourCard = lazyRetry(() => import("@/components/GuidedTourCard"));
const ReferralLink = lazyRetry(() => import("@/components/ReferralLink"));
const SuggestionBox = lazyRetry(() => import("@/components/SuggestionBox"));

interface ToolsTabProps {
  userId: string;
  isAdmin: boolean;
  isHonorary: boolean;
  userRole: string;
  onViewUserPlan?: (targetUserId: string) => void;
  onLogout?: () => void;
  onStartPlan?: () => void;
}

interface ToolItem {
  id: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  keywords?: string;
  /** Direkt åtgärd (öppnar undervy/dialog) */
  onSelect?: () => void;
  /** Innehåll som fälls ut inne i kortet */
  content?: () => React.ReactNode;
  featured?: boolean;
}

interface ToolGroup {
  id: string;
  title: string;
  items: ToolItem[];
}

const STORAGE_KEY = "grim:tools-collapsed-groups";

const normalize = (s: string) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const topic = (title: string) => helpCategories.find((c) => c.title === title);

const topicItem = (
  title: string,
  subtitle: string,
  icon: LucideIcon,
  id?: string
): ToolItem => {
  const cat = topic(title);
  return {
    id: id ?? `topic-${normalize(title).replace(/\s+/g, "-")}`,
    title,
    subtitle,
    icon,
    keywords: cat?.tips.join(" "),
    content: () => (
      <ul className="space-y-2">
        {(cat?.tips ?? []).map((tip, i) => (
          <li key={i} className="flex gap-2 text-xs text-muted-foreground leading-relaxed">
            <span className="text-primary mt-0.5 flex-shrink-0">•</span>
            <span>{tip}</span>
          </li>
        ))}
      </ul>
    ),
  };
};

const ToolsTab = ({ userId, isAdmin, isHonorary, userRole, onViewUserPlan, onLogout, onStartPlan }: ToolsTabProps) => {
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [subView, setSubView] = useState<"home" | "helpers" | "settings">("home");
  const [query, setQuery] = useState("");
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [editLayout, setEditLayout] = useState(false);
  const { order, save: saveLayout } = useToolLayout();
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return new Set<string>(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set<string>();
    }
  });

  const toggleGroup = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  // Tour navigation – open the relevant subpage when requested
  useEffect(() => {
    const handler = (e: Event) => {
      const target = (e as CustomEvent).detail as "settings" | "helpers" | "help";
      if (target === "settings") setSubView("settings");
      else if (target === "helpers") setSubView("helpers");
      else if (target === "help") {
        setSubView("home");
        setCollapsed((prev) => {
          if (!prev.has("start")) return prev;
          const next = new Set(prev);
          next.delete("start");
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
          } catch {
            /* ignore */
          }
          return next;
        });
        setOpenItem("tour");
        requestAnimationFrame(() => {
          document.querySelector('[data-tour="tools-help"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
      }
    };
    window.addEventListener("grim:tools-expand", handler);
    return () => window.removeEventListener("grim:tools-expand", handler);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [subView]);

  const groups: ToolGroup[] = useMemo(() => {
    const list: ToolGroup[] = [
      {
        id: "start",
        title: "Kom igång",
        items: [
          {
            id: "tour",
            title: "Rundtur",
            subtitle: "Guidad genomgång av appens funktioner",
            icon: Sparkles,
            keywords: "tour guide hjälp introduktion",
            content: () => <GuidedTourCard />,
          },
        ],
      },
      {
        id: "helpers",
        title: "Hjälpmedel",
        items: [
          {
            id: "helpers-page",
            title: "Hjälpmedel",
            subtitle: "Timer, kalkylatorer och nedräkning",
            icon: Wrench,
            keywords: "1rm puls kalorier timer event nedräkning",
            featured: true,
            onSelect: () => setSubView("helpers"),
          },
          {
            id: "form-check",
            title: "Formkoll",
            subtitle: "Filma ett set och få feedback på djup, tempo och symmetri",
            icon: Camera,
            keywords: "teknik form video kamera djup tempo symmetri",
            content: () => <FormCheckCard />,
          },
          {
            id: "health-sync",
            title: "Hälsodata",
            subtitle: "Hämta steg och aktiva kalorier från Apple Health eller Health Connect",
            icon: Activity,
            keywords: "hälsa health connect apple health steg kalorier klocka",
            content: () => <HealthConnectCard />,
          },
          {
            id: "heart-rate",
            title: "Pulsmätare",
            subtitle: "Anslut pulsband och visa pulsen i en flyttbar ruta",
            icon: Heart,
            keywords: "puls pulsband bluetooth hjärtfrekvens bpm",
            content: () => <HeartRateConnectCard />,
          },
          topicItem("Verktyg", "Så fungerar kalkylatorerna", Sparkles, "topic-verktyg"),
          topicItem("Event & nedräkning", "Tävlingar, lopp och eventgrupper", Calendar, "topic-event"),
        ],
      },
      {
        id: "account",
        title: "Konto",
        items: [
          {
            id: "settings-page",
            title: "Inställningar",
            subtitle: "Profil, tema och notiser",
            icon: SlidersHorizontal,
            keywords: "profil tema notiser lösenord kroppsvikt",
            featured: true,
            onSelect: () => setSubView("settings"),
          },
          {
            id: "supporter",
            title: "Hantera medlemskap",
            subtitle: "Stöd appen och se din prenumeration",
            icon: Heart,
            keywords: "supporter prenumeration betalning stripe",
            content: () => <SupporterButton userId={userId} />,
          },
          {
            id: "referral",
            title: "Bjud in en vän",
            subtitle: "Din personliga länk och QR-kod",
            icon: Link,
            keywords: "invite vän referral qr kod bjud in",
            content: () => <ReferralLink userId={userId} />,
          },
          {
            id: "suggestions",
            title: "Förslagslåda",
            subtitle: "Skicka idéer och feedback",
            icon: MessageSquarePlus,
            keywords: "förslag feedback idé synpunkter",
            content: () => <SuggestionBox userId={userId} isAdmin={isAdmin} />,
          },
          topicItem("Inställningar & profil", "Tips om profil och inställningar", UserCog),
        ],
      },
    ];

    if (isAdmin) {
      list.push({
        id: "admin",
        title: "Admin",
        items: [
          {
            id: "admin-users",
            title: "Alla användare",
            subtitle: "Sök medlemmar och visa deras planer",
            icon: Users,
            keywords: "användare medlemmar admin",
            content: () => <AdminUserList userId={userId} onViewUserPlan={onViewUserPlan} />,
          },
          {
            id: "admin-exercises",
            title: "Övningsbibliotek",
            subtitle: "Redigera övningar, GIF:ar och kategorier",
            icon: ImageIcon,
            keywords: "övningar gif bibliotek admin",
            content: () => <ExerciseGifManager />,
          },
          {
            id: "admin-workout-types",
            title: "Passtyper",
            subtitle: "Hantera färdiga pass",
            icon: Dumbbell,
            keywords: "passtyper färdiga pass admin",
            content: () => <ReadyWorkoutManager />,
          },
          {
            id: "admin-completions",
            title: "Senaste klarmarkerade",
            subtitle: "De senaste registrerade passen",
            icon: ShieldCheck,
            keywords: "klarmarkerade pass logg admin",
            content: () => <AdminCompletionsList />,
          },
        ],
      });
    }

    return list;
  }, [isAdmin, userId, onViewUserPlan]);

  /** Gruppordning, flyttade kort och kortordning enligt den delade layouten (satt av admin) */
  const orderedGroups: ToolGroup[] = useMemo(() => {
    const sorted = applyOrder(groups, order.groups);
    const valid = new Set(sorted.map((g) => g.id));
    const buckets = new Map<string, ToolItem[]>(sorted.map((g) => [g.id, []]));
    for (const g of sorted) {
      for (const item of g.items) {
        const target = order.assign[item.id];
        const groupId = target && valid.has(target) ? target : g.id;
        buckets.get(groupId)!.push(item);
      }
    }
    return sorted.map((g) => ({ ...g, items: applyOrder(buckets.get(g.id) ?? [], order.items[g.id] ?? []) }));
  }, [groups, order]);

  const persist = async (next: {
    groups: string[];
    items: Record<string, string[]>;
    assign: Record<string, string>;
  }) => {
    try {
      await saveLayout(next);
    } catch {
      toast.error("Kunde inte spara layouten");
    }
  };

  const currentOrder = () => ({
    groups: orderedGroups.map((g) => g.id),
    items: { ...order.items, ...Object.fromEntries(orderedGroups.map((g) => [g.id, g.items.map((i) => i.id)])) },
    assign: { ...order.assign },
  });

  const moveItemToGroup = (itemId: string, fromGroupId: string, toGroupId: string) => {
    if (fromGroupId === toGroupId) return;
    const base = currentOrder();
    const items = { ...base.items };
    items[fromGroupId] = (items[fromGroupId] ?? []).filter((id) => id !== itemId);
    items[toGroupId] = [...(items[toGroupId] ?? []), itemId];
    persist({ ...base, items, assign: { ...base.assign, [itemId]: toGroupId } });
  };

  const moveGroup = (index: number, dir: -1 | 1) => {
    const base = currentOrder();
    const groupIds = move(base.groups, index, index + dir);
    if (groupIds === base.groups) return;
    persist({ ...base, groups: groupIds });
  };

  const moveItem = (groupId: string, index: number, dir: -1 | 1) => {
    const base = currentOrder();
    const ids = move(base.items[groupId] ?? [], index, index + dir);
    if (ids === base.items[groupId]) return;
    persist({ ...base, items: { ...base.items, [groupId]: ids } });
  };

  const q = normalize(query.trim());
  const matches = (item: ToolItem) =>
    !q ||
    normalize(item.title).includes(q) ||
    normalize(item.subtitle).includes(q) ||
    normalize(item.keywords ?? "").includes(q);

  const searchResults = useMemo(() => {
    if (!q) return [];
    return groups.flatMap((g) => g.items.filter(matches).map((item) => ({ group: g.title, item })));
  }, [q, groups]);

  const renderCard = (
    item: ToolItem,
    groupLabel?: string,
    reorder?: {
      onUp: () => void;
      onDown: () => void;
      first: boolean;
      last: boolean;
      groupId: string;
      onMoveToGroup: (groupId: string) => void;
    }
  ) => {
    const Icon = item.icon;
    const expanded = openItem === item.id && !reorder;
    if (reorder) {
      const Ico = item.icon;
      return (
        <div
          key={item.id}
          className="space-y-2 rounded-2xl bg-card shadow-soft border border-dashed border-primary/40 p-3"
        >
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Ico className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-bold text-foreground">{item.title}</span>
            <button
              type="button"
              aria-label="Flytta upp"
              disabled={reorder.first}
              onClick={reorder.onUp}
              className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center disabled:opacity-30"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Flytta ner"
              disabled={reorder.last}
              onClick={reorder.onDown}
              className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center disabled:opacity-30"
            >
              <ArrowDown className="h-4 w-4" />
            </button>
          </div>
          <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Kategori
            <select
              value={reorder.groupId}
              onChange={(e) => reorder.onMoveToGroup(e.target.value)}
              className="flex-1 rounded-xl bg-secondary px-2 py-1.5 text-xs font-semibold normal-case tracking-normal text-foreground outline-none"
            >
              {orderedGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
          </label>
        </div>
      );
    }
    return (
      <div
        key={item.id}
        id={item.id === "tour" ? "help-section" : undefined}
        data-tour={item.id === "tour" ? "tools-help" : undefined}
        className="rounded-2xl bg-card shadow-soft border border-border/40 overflow-hidden"
      >
        <button
          type="button"
          data-tour={
            item.id === "settings-page" ? "tools-profile" : item.id === "helpers-page" ? "tools-helpers" : undefined
          }
          onClick={() => (item.onSelect ? item.onSelect() : setOpenItem(expanded ? null : item.id))}
          className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-muted/40 active:bg-muted/60 active:scale-[0.99] transition-all"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span
              className={`flex shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ${
                item.featured ? "h-11 w-11" : "h-9 w-9"
              }`}
            >
              <Icon className={item.featured ? "h-5 w-5" : "h-4 w-4"} />
            </span>
            <span className="min-w-0">
              {groupLabel && (
                <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {groupLabel}
                </span>
              )}
              <span className={`block font-bold text-foreground ${item.featured ? "text-base" : "text-sm"}`}>
                {item.title}
              </span>
              <span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span>
            </span>
          </span>
          {item.onSelect ? (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          )}
        </button>
        {expanded && item.content && (
          <div className="px-4 pb-4">
            <Suspense
              fallback={
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              }
            >
              {item.content()}
            </Suspense>
          </div>
        )}
      </div>
    );
  };

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
              <SettingsPanel userId={userId} isAdmin={isAdmin} isHonorary={isHonorary} onStartPlan={onStartPlan} />
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
    <div className="py-2 space-y-5">
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

      {/* Sök */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Sök verktyg och inställningar"
          className="w-full rounded-2xl bg-card border border-border/40 shadow-soft py-3 pl-10 pr-10 text-sm outline-none focus:border-primary/50"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Rensa sökning"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>


      {isAdmin && !q && (
        <button
          type="button"
          onClick={() => setEditLayout((v) => !v)}
          className={`w-full flex items-center justify-center gap-2 py-2 px-4 text-sm font-semibold rounded-full shadow-soft active:scale-[0.97] transition-all ${
            editLayout ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
          }`}
        >
          {editLayout ? <Check className="w-4 h-4" /> : <Move className="w-4 h-4" />}
          {editLayout ? "Klar med ordningen" : "Ändra ordning (syns för alla)"}
        </button>
      )}

      {q ? (
        <div className="space-y-2">
          {searchResults.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Inget verktyg matchar "{query}".</p>
          ) : (
            searchResults.map(({ group, item }) => renderCard(item, group))
          )}
        </div>
      ) : (
        orderedGroups.map((group, gIndex) => {
          const isCollapsed = collapsed.has(group.id) && !editLayout;
          return (
            <section key={group.id} className="space-y-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className="flex-1 flex items-center justify-between gap-2 px-1 py-1"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-bold uppercase tracking-wider text-foreground">{group.title}</span>
                    <span className="text-[10px] text-muted-foreground bg-secondary rounded-full px-1.5 py-0.5">
                      {group.items.length}
                    </span>
                  </span>
                  {!editLayout && (
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform ${isCollapsed ? "" : "rotate-180"}`}
                    />
                  )}
                </button>
                {editLayout && (
                  <>
                    <button
                      type="button"
                      aria-label="Flytta gruppen upp"
                      disabled={gIndex === 0}
                      onClick={() => moveGroup(gIndex, -1)}
                      className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center disabled:opacity-30"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Flytta gruppen ner"
                      disabled={gIndex === orderedGroups.length - 1}
                      onClick={() => moveGroup(gIndex, 1)}
                      className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center disabled:opacity-30"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
              {!isCollapsed && (
                <div className="space-y-2">
                  {group.items.map((item, iIndex) =>
                    renderCard(
                      item,
                      undefined,
                      editLayout
                        ? {
                            onUp: () => moveItem(group.id, iIndex, -1),
                            onDown: () => moveItem(group.id, iIndex, 1),
                            first: iIndex === 0,
                            last: iIndex === group.items.length - 1,
                            groupId: group.id,
                            onMoveToGroup: (target: string) => moveItemToGroup(item.id, group.id, target),
                          }
                        : undefined
                    )
                  )}
                </div>
              )}
            </section>
          );
        })
      )}

      {onLogout && (
        <div className="space-y-2 pt-2">
          <button
            onClick={() => setConfirmLogout(true)}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 text-sm font-semibold text-destructive bg-secondary rounded-full shadow-soft active:scale-[0.97] hover:opacity-90 transition-opacity"
          >
            <LogOut className="w-4 h-4" />
            Logga ut
          </button>
        </div>
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

      <Suspense fallback={null}>
        <DisclaimerSection />
      </Suspense>

      <button
        type="button"
        onClick={updateApp}
        className="w-full flex items-center justify-center gap-2 py-2 px-4 text-sm font-semibold bg-secondary rounded-full shadow-soft active:scale-[0.97] hover:opacity-90 transition-opacity"
      >
        <RefreshCw className="w-4 h-4" />
        Uppdatera appen
      </button>

      <p className="text-center text-[11px] text-muted-foreground pt-2 pb-4">Version {APP_VERSION}</p>
    </div>
  );
};

export default ToolsTab;
