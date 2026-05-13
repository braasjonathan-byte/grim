import { useState } from "react";
import { ChevronDown, ChevronUp, Dumbbell, Users, BarChart3, Settings, Calculator, MessageCircle, Trophy, Calendar, HelpCircle, Share2, Repeat, Weight, Sparkles } from "lucide-react";
import { startTour } from "@/lib/tour";

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
      "Planen delas upp i veckor – bläddra mellan veckor med pilarna eller svep åt sidan.",
      "Appen räknar ut vilken vecka du är på baserat på när planen skapades.",
      "När du öppnar appen landar du direkt på dagens dag i veckan.",
      "Tryck på kugghjulet (⚙️) på ett pass för att byta namn eller markera det som missat.",
      "Tryck på dagförkortningen (t.ex. 'TIS') för att flytta passet till en annan veckodag.",
      "Om måldagen redan är upptagen byter passen plats med varandra automatiskt.",
      "Markera ett pass som klart med bocken – du tjänar en proteinbar per dag du tränar.",
      "All träningsdata (vikter, kommentarer, puls m.m.) följer med om du byter dag.",
      "Använd 'Rensa pass'-knappen under 'Importera färdigt pass' för att tömma alla övningar i ett pass.",
      "Markerar du ett pass som missat kan du skapa ett anpassat ersättningspass i samma dialog.",
      "Du kan arkivera hela planen och börja om med en ny – all historik bevaras.",
      "Träningskalendern visar alla genomförda pass, även från arkiverade planer.",
    ],
  },
  {
    title: "Övningar & loggning",
    icon: Calendar,
    tips: [
      "Tryck på '+' för att lägga till övningar från biblioteket eller skapa egna.",
      "Välj antal set, reps och vikt när du lägger till en styrkeövning.",
      "Du kan markera en ny övning som 'kroppsviktsövning' – då visas en +/− vikt-toggle per set.",
      "Bocka av varje set under passet genom att trycka på setknapparna.",
      "Konditionsövningar loggas med tid, distans, tempo och puls.",
      "Tryck på info-knappen (ℹ️) bredvid en övning för att se instruktioner och GIF.",
      "Lägg till eller ta bort set med '+ Set' och '− Set'-knapparna.",
      "Vikter loggas automatiskt som personbästa (PR) och visas i statistiken.",
      "Data från förra passet hämtas automatiskt – justera själv för progression.",
      "Rader med flera övningar (separerade med '/' eller ';') delas upp automatiskt.",
    ],
  },
  {
    title: "Kroppsviktsövningar",
    icon: Weight,
    tips: [
      "Övningar som Chins, Dips m.fl. kan markeras som kroppsviktsövningar.",
      "Kroppsviktsövningar visar en toggle för att logga extra vikt (+/−).",
      "Om du inte har angett din kroppsvikt visas en prompt direkt i träningsvyn.",
      "Admins kan massredigera kroppsviktsflaggan i övningsbiblioteket.",
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
    title: "Färdiga pass",
    icon: Dumbbell,
    tips: [
      "Hämta färdiga träningspass från ett bibliotek med fördefinierade pass.",
      "Spara dina egna pass som favoriter för att enkelt hämta dem igen senare.",
      "Perfekt för att återanvända pass du gillar utan att bygga dem från grunden.",
      "Sparade pass kan hämtas till både planerade och enskilda träningspass.",
    ],
  },
  {
    title: "Cirkelträning",
    icon: Repeat,
    tips: [
      "Skapa cirkelpass med flera rundor – välj antal rundor och sekunder per övning när du skapar passet.",
      "Övningar i cirkelpass har sekunder som standardenhet istället för reps.",
      "Nya övningar som läggs till i ett cirkelpass ärver automatiskt sekundvärdet från passets inställningar.",
      "Du kan ändra tid individuellt per övning och runda.",
      "Lägg till vila mellan rundorna med 'Lägg till vila'-knappen.",
      "Starta den inbyggda cirkeltimern som räknar ner automatiskt per övning och runda.",
      "Bocka av genomförda rundor med R1, R2, R3-knapparna.",
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
      "Bjud in vänner med din personliga länk – använd dela-knappen (📤) för att skicka via SMS, chatt eller sociala medier.",
    ],
  },
  {
    title: "Chatt",
    icon: MessageCircle,
    tips: [
      "Chatta med dina vänner direkt i appen.",
      "Du får push-notiser när du får ett nytt meddelande.",
      "Du kan dela träningspass i chatten – mottagaren kan importera passet till sin egen plan.",
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
      "Statistiken inkluderar data från arkiverade planer – inget försvinner.",
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
    title: "Event & nedräkning",
    icon: Calendar,
    tips: [
      "Lägg till event (tävlingar, lopp etc.) med datum för att se en nedräkning.",
      "Passerade event försvinner automatiskt från nedräkningslistan.",
      "Gå med i eventgrupper för att träna mot samma mål som andra.",
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
    title: "Övningsbiblioteket",
    icon: Dumbbell,
    tips: [
      "Biblioteket innehåller 100+ maskiner och övningar med instruktioner.",
      "Sök och filtrera på muskelgrupp, kategori (Styrka, Kondition, Rörlighet, Core).",
      "Admins kan redigera kategori, muskelgrupp och instruktioner för alla övningar.",
      "Admins kan massmarkera övningar via 'Markera'-läget för att uppdatera kroppsviktsflaggan.",
      "Du kan skapa egna övningar med valfri kategori och muskelgrupp.",
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
      "Bjud in vänner med din unika referrallänk – du blir hedersmedlem!",
      "Byt lösenord och ställ in säkerhetsfrågor under inställningar.",
      "Mörkt läge kan aktiveras under inställningar.",
      "Skicka feedback och förslag via förslagslådan.",
      "Ange din kroppsvikt under Verktyg för att möjliggöra loggning av kroppsviktsövningar.",
    ],
  },
];

const HelpSection = () => {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  return (
    <div id="help-section" className="border border-border bg-secondary overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <HelpCircle className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-bold">Hjälp & tips</h3>
      </div>

      {/* Tour triggers */}
      <div className="px-4 py-3 border-b border-border space-y-2 bg-card">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Rundtur</span>
        </div>
        <p className="text-xs text-muted-foreground">Få en guidad tur med pilar på viktiga knappar.</p>
        <div className="flex gap-2">
          <button
            onClick={() => startTour("short")}
            className="flex-1 bg-primary text-primary-foreground text-xs font-bold px-3 py-2 active:scale-95 transition-transform"
          >
            Kort rundtur
          </button>
          <button
            onClick={() => startTour("long")}
            className="flex-1 bg-secondary text-foreground border border-border text-xs font-bold px-3 py-2 active:scale-95 transition-transform"
          >
            Lång rundtur
          </button>
        </div>
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
