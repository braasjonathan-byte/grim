import type { LucideIcon } from "lucide-react";
import {
  Apple,
  BookOpen,
  CalendarDays,
  Dumbbell,
  EyeOff,
  Flag,
  Image as ImageIcon,
  ListChecks,
  Megaphone,
  MessageSquarePlus,
  Newspaper,
  Ruler,
  Send,
  Sparkles,
  ShieldCheck,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import type { ReactNode } from "react";
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
const AdminPopularEvents = lazyRetry(() => import("@/components/admin/AdminPopularEvents"));
const AdminHiddenExercises = lazyRetry(() => import("@/components/admin/AdminHiddenExercises"));
const AdminPosts = lazyRetry(() => import("@/components/admin/AdminPosts"));
const AdminDailyChallenge = lazyRetry(() => import("@/components/admin/AdminDailyChallenge"));
const AdminReadyContent = lazyRetry(() => import("@/components/admin/AdminReadyContent"));
const AdminHelpTips = lazyRetry(() => import("@/components/admin/AdminHelpTips"));
const AdminNews = lazyRetry(() => import("@/components/admin/AdminNews"));

export type AdminToolContext = {
  userId: string;
  onViewUserPlan?: (targetUserId: string) => void;
};

export type AdminTool = {
  id: string;
  title: string;
  subtitle: string;
  keywords: string;
  icon: LucideIcon;
  content: (ctx: AdminToolContext) => ReactNode;
};

export type AdminGroup = {
  id: string;
  title: string;
  hint: string;
  items: AdminTool[];
};

/** Verktyg som skriver till samma databas som PWA:n läser. Inget här kräver en ny app. */
export function getAdminGroups(): AdminGroup[] {
  return [
    {
      id: "admin-edit",
      title: "Ändra appen",
      hint: "Det här bytte du tidigare bara via en ny version",
      items: [
        {
          id: "admin-challenge",
          title: "Dagens utmaning",
          subtitle: "Listan som visas, en ny varje dag",
          keywords: "utmaning daglig challenge",
          icon: ListChecks,
          content: ({ userId }) => <AdminDailyChallenge userId={userId} />,
        },
        {
          id: "admin-ready-content",
          title: "Innehåll i färdiga pass",
          subtitle: "Övningar, set och nya pass i biblioteket",
          keywords: "färdiga pass övningar innehåll bibliotek",
          icon: Dumbbell,
          content: ({ userId }) => <AdminReadyContent userId={userId} />,
        },
        {
          id: "admin-help",
          title: "Hjälptexter",
          subtitle: "Tipsen under Hjälp",
          keywords: "hjälp tips text",
          icon: BookOpen,
          content: ({ userId }) => <AdminHelpTips userId={userId} />,
        },
        {
          id: "admin-news",
          title: "Nyhet till alla",
          subtitle: "En ruta som öppnas en gång",
          keywords: "nyhet popup meddelande changelog",
          icon: Sparkles,
          content: ({ userId }) => <AdminNews userId={userId} />,
        },
      ],
    },
    {
      id: "admin-live",
      title: "Det alla ser",
      hint: "Syns direkt för alla, även i webbappen",
      items: [
        {
          id: "admin-app",
          title: "Appen just nu",
          subtitle: "Meddelande överst, AI-kost och Supporter-rutan",
          keywords: "banner meddelande ai kost supporter inställningar",
          icon: Megaphone,
          content: ({ userId }) => <AdminAppSettings userId={userId} />,
        },
        {
          id: "admin-announcements",
          title: "Utskick",
          subtitle: "Meddelande från Grim till alla, med avisering",
          keywords: "utskick meddelande notis announcement inkorg",
          icon: Send,
          content: ({ userId }) => <AnnouncementInbox userId={userId} isAdmin />,
        },
        {
          id: "admin-recipes",
          title: "Färdiga recept",
          subtitle: "Ändra, dölj eller lägg till recept alla kan laga",
          keywords: "recept mat kost kurerade",
          icon: UtensilsCrossed,
          content: ({ userId }) => <AdminRecipes userId={userId} />,
        },
        {
          id: "admin-foods",
          title: "Livsmedel",
          subtitle: "Rätta kcal och makron. Gäller sök och loggning",
          keywords: "livsmedel mat kcal protein kolhydrater",
          icon: Apple,
          content: () => <AdminFoods />,
        },
        {
          id: "admin-units",
          title: "Övningarnas enheter",
          subtitle: "Reps, sekunder, meter eller kroppsvikt i passen",
          keywords: "enhet reps sekunder meter kroppsvikt övning",
          icon: Ruler,
          content: ({ userId }) => <AdminExerciseUnits userId={userId} />,
        },
        {
          id: "admin-exercises",
          title: "Övningsbibliotek",
          subtitle: "Bild, instruktion och muskler på övningarna",
          keywords: "övningar gif bibliotek muskler instruktion",
          icon: ImageIcon,
          content: () => <ExerciseGifManager embedded />,
        },
        {
          id: "admin-workout-types",
          title: "Färdiga pass",
          subtitle: "Vilka färdiga pass som är cirkelpass",
          keywords: "passtyper färdiga pass cirkel",
          icon: Dumbbell,
          content: () => <ReadyWorkoutManager embedded />,
        },
        {
          id: "admin-events",
          title: "Lopp och tävlingar",
          subtitle: "Det som föreslås när någon söker en nedräkning",
          keywords: "lopp tävling event nedräkning varvet marathon",
          icon: CalendarDays,
          content: () => <AdminPopularEvents />,
        },
        {
          id: "admin-hidden-exercises",
          title: "Dolda konditionsövningar",
          subtitle: "Visa en övning igen i väljaren",
          keywords: "dold övning kondition lista",
          icon: EyeOff,
          content: () => <AdminHiddenExercises />,
        },
      ],
    },
    {
      id: "admin-people",
      title: "Användare",
      hint: "Åtkomst och vad medlemmarna har tränat",
      items: [
        {
          id: "admin-users",
          title: "Medlemmar och behörighet",
          subtitle: "Sök, ge hedersmedlemskap eller admin, öppna en plan",
          keywords: "användare medlemmar admin heder behörighet",
          icon: Users,
          content: ({ userId, onViewUserPlan }) => <AdminUserList userId={userId} onViewUserPlan={onViewUserPlan} />,
        },
        {
          id: "admin-completions",
          title: "Senaste passen",
          subtitle: "Pass som just klarmarkerats",
          keywords: "klarmarkerade pass logg träning",
          icon: ShieldCheck,
          content: () => <AdminCompletionsList />,
        },
      ],
    },
    {
      id: "admin-moderation",
      title: "Moderering",
      hint: "Sånt användarna skickat in",
      items: [
        {
          id: "admin-reports",
          title: "Rapporterade inlägg",
          subtitle: "Läs, avfärda eller ta bort inlägget",
          keywords: "rapport inlägg moderera ta bort",
          icon: Flag,
          content: () => <AdminReports />,
        },
        {
          id: "admin-posts",
          title: "Inlägg i flödet",
          subtitle: "Senaste inläggen. Ta bort det alla ser",
          keywords: "inlägg flöde social ta bort moderera",
          icon: Newspaper,
          content: () => <AdminPosts />,
        },
        {
          id: "admin-suggestions",
          title: "Förslag",
          subtitle: "Läs, svara och arkivera",
          keywords: "förslag feedback idé synpunkter",
          icon: MessageSquarePlus,
          content: ({ userId }) => <SuggestionBox userId={userId} isAdmin />,
        },
      ],
    },
  ];
}
