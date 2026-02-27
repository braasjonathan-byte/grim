import { useState } from "react";
import { ChevronDown, ChevronUp, Dumbbell, Users, BarChart3, Settings, Calculator, MessageCircle, Trophy, Calendar, HelpCircle } from "lucide-react";

interface HelpCategory {
  title: string;
  icon: React.ElementType;
  tips: string[];
}

const categories: HelpCategory[] = [
  {
    title: "Träningsplan",
    icon: Dumbbell,
    tips: [
      "Välj en färdig mall eller skapa en egen plan när du börjar.",
      "Planen delas upp i veckor – bläddra mellan veckor med pilarna.",
      "Appen räknar ut vilken vecka du är på baserat på när planen skapades.",
      "Tryck på kugghjulet (⚙️) i övre vänstra hörnet på ett pass för att byta namn.",
      "Tryck på dagförkortningen (t.ex. 'TIS') för att flytta passet till en annan veckodag.",
      "Om måldagen redan är upptagen byter passen plats med varandra automatiskt.",
      "Markera ett pass som klart med bocken – eller hoppa över det med X-knappen.",
      "All träningsdata (vikter, kommentarer, puls m.m.) följer med om du byter dag.",
      "Du kan arkivera hela planen och börja om med en ny.",
    ],
  },
  {
    title: "Övningar & loggning",
    icon: Calendar,
    tips: [
      "Tryck på '+' för att lägga till övningar från biblioteket eller skapa egna.",
      "Välj antal set, reps och vikt när du lägger till en styrkeövning.",
      "Bocka av varje set under passet genom att trycka på setknapparna.",
      "Konditionsövningar loggas med tid, distans, tempo och puls.",
      "Tryck på info-knappen (ℹ️) bredvid en övning för att se instruktioner och GIF.",
      "Redigera en befintlig övning genom att trycka på den – ändra vikt, set eller reps.",
      "Ta bort en övning genom att svepa eller trycka på papperskorgen.",
      "Vikter loggas automatiskt som personbästa (PR) och visas i statistiken.",
    ],
  },
  {
    title: "Enskilda pass",
    icon: Calendar,
    tips: [
      "Under 'Enskilda pass' kan du skapa fristående träningspass med valfritt datum.",
      "Perfekt för extra pass utanför din vanliga plan.",
      "Du kan kopiera ett tidigare pass med automatisk progressiv viktökning (+2,5 kg).",
      "Enskilda pass grupperas efter vecka baserat på datum.",
    ],
  },
  {
    title: "Vänner & socialt",
    icon: Users,
    tips: [
      "Sök efter vänner via namn och skicka en vänförfrågan.",
      "När ni är vänner kan ni se varandras träningsplaner och framsteg.",
      "Gilla och kommentera dina vänners pass för att peppa varandra.",
      "Dela ett pass direkt till en vän via chatten med dela-knappen.",
      "Appen föreslår vänner baserat på gemensamma kontakter.",
    ],
  },
  {
    title: "Chatt",
    icon: MessageCircle,
    tips: [
      "Chatta med dina vänner direkt i appen.",
      "Du får push-notiser när du får ett nytt meddelande.",
      "Du kan dela träningspass i chatten – mottagaren ser alla övningar.",
    ],
  },
  {
    title: "Statistik & PR",
    icon: BarChart3,
    tips: [
      "Under statistik ser du en muskelkarta som visar vilka muskler du tränat.",
      "Personbästa (PR) sparas automatiskt baserat på dina loggade vikter.",
      "Du kan manuellt justera ett PR om det inte stämmer.",
      "Markera favoritövningar med en stjärna för att lyfta fram dem.",
      "Sätt upp PR-mål med målvikt och datum för att följa din progression.",
      "Viktprogressionsgrafen visar din utveckling över tid per övning.",
    ],
  },
  {
    title: "Leaderboard & utmaningar",
    icon: Trophy,
    tips: [
      "Leaderboarden visar vem som genomfört flest pass – filtrera per månad eller år.",
      "Dagliga utmaningar ger dig ett nytt mål varje dag.",
      "Genomför utmaningar för att tjäna proteinbars 🥜.",
      "Proteinbars kan användas i avatarshopen.",
    ],
  },
  {
    title: "Verktyg",
    icon: Calculator,
    tips: [
      "1RM-kalkylatorn beräknar ditt maxlyft baserat på vikt och antal reps (Epleys formel).",
      "Pulszonskalkylator – beräkna dina träningszoner med Karvonens formel.",
      "Kalorikalkylatorn uppskattar ditt dagliga energibehov (BMR/TDEE) och föreslår makron.",
      "Tidtagaruret kan användas som vilotimer mellan set.",
    ],
  },
  {
    title: "Inställningar & profil",
    icon: Settings,
    tips: [
      "Din profil hittas överst i inställningsfliken.",
      "Ladda upp en profilbild som visas för dina vänner.",
      "Länka dina sociala medier (Instagram, TikTok, Snapchat).",
      "Aktivera push-notiser för att bli påmind om träning.",
      "Ställ in påminnelsetid och tidszon under notifikationsinställningar.",
      "Bjud in vänner med din unika referrallänk – ni får båda belöning!",
      "Byt lösenord och ställ in säkerhetsfrågor under inställningar.",
      "Mörkt läge kan aktiveras under inställningar.",
      "Skicka feedback och förslag via förslagslådan.",
    ],
  },
];

const HelpSection = () => {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <HelpCircle className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-bold">Hjälp & tips</h3>
      </div>
      <div className="divide-y divide-border">
        {categories.map((cat) => {
          const isOpen = expandedCategory === cat.title;
          const Icon = cat.icon;
          return (
            <div key={cat.title}>
              <button
                onClick={() => setExpandedCategory(isOpen ? null : cat.title)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/50 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{cat.title}</span>
                  <span className="text-[10px] text-muted-foreground bg-secondary rounded-full px-1.5 py-0.5">
                    {cat.tips.length}
                  </span>
                </div>
                {isOpen ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
              {isOpen && (
                <ul className="px-4 pb-3 space-y-2">
                  {cat.tips.map((tip, i) => (
                    <li key={i} className="flex gap-2 text-xs text-muted-foreground leading-relaxed">
                      <span className="text-primary mt-0.5 flex-shrink-0">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default HelpSection;
