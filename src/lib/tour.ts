import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

export type TourVariant = "short" | "long";

const SHORT_STEPS: DriveStep[] = [
  {
    element: '[data-tour="tab-workout"]',
    popover: {
      title: "Träning",
      description: "Här hittar du dagens pass. Bocka av set, logga vikt och se din veckoplan.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="tab-stats"]',
    popover: {
      title: "Statistik",
      description: "Se muskelkartan, dina personbästa (PR) och hur du utvecklas över tid.",
      side: "top",
    },
  },
  {
    element: '[data-tour="tab-social"]',
    popover: {
      title: "Social",
      description: "Vänner, leaderboard, chatt och flöde med dina vänners pass.",
      side: "top",
    },
  },
  {
    element: '[data-tour="tab-calc"]',
    popover: {
      title: "Verktyg",
      description: "Profil, inställningar, kalkylatorer, hjälp och mycket mer.",
      side: "top",
    },
  },
  {
    element: '[data-tour="header-help"]',
    popover: {
      title: "Hjälp finns alltid här",
      description: "Tryck på frågetecknet för att öppna hjälp & tips eller starta rundturen igen.",
      side: "bottom",
      align: "end",
    },
  },
];

const LONG_STEPS: DriveStep[] = [
  // ══════════════════════════════════════════
  // AVSNITT 1: KOMMA IGÅNG
  // ══════════════════════════════════════════
  {
    popover: {
      title: "Avsnitt 1 av 7 – Komma igång",
      description:
        "Vi börjar med grunderna: var dina pass bor, hur veckoplanen fungerar och hur du markerar pass som klara. Tryck 'Nästa' för att fortsätta.",
    },
  },
  {
    element: '[data-tour="tab-workout"]',
    popover: {
      title: "Träning-fliken",
      description:
        "Här bor allt som rör din träning: dagens pass, veckoöversikt och din aktiva plan. Detta är startsidan när du öppnar appen.",
      side: "top",
    },
  },
  {
    element: '[data-tour="workout-day"]',
    popover: {
      title: "Veckoplan – dagskort",
      description:
        "Varje dag i veckan visas som ett kort. Appen landar automatiskt på dagens dag. Tryck på en dag för att öppna passet och börja logga.",
      side: "bottom",
    },
  },
  {
    popover: {
      title: "Bra att veta om veckan",
      description:
        "• Bläddra mellan veckor med pilarna eller svep åt sidan.\n• Tryck på dagförkortningen (t.ex. 'TIS') för att flytta passet till en annan veckodag – är dagen upptagen byter passen plats automatiskt.\n• Tryck på kugghjulet (⚙️) på ett pass för att byta namn eller markera det som missat.\n• Bocka i passet som klart med bocken – du tjänar en proteinbar 🥜 per träningsdag.",
    },
  },

  // ══════════════════════════════════════════
  // AVSNITT 2: BYGGA & ÄNDRA PASS
  // ══════════════════════════════════════════
  {
    popover: {
      title: "Avsnitt 2 av 7 – Bygga & ändra pass",
      description:
        "Nu går vi igenom hur du fyller passet med övningar, byter ut, tar bort och importerar färdiga pass.",
    },
  },
  {
    element: '[data-tour="add-exercise"]',
    popover: {
      title: "Lägg till övning",
      description:
        "Tryck på '+' för att öppna övningsbiblioteket. Du kan filtrera på muskelgrupp, söka via namn, växla kategori (Styrka, Kondition, Rörlighet, Core) eller skapa en helt egen övning.",
      side: "top",
    },
  },
  {
    popover: {
      title: "När du lägger till en övning",
      description:
        "• Välj antal set, reps och vikt direkt i dialogen.\n• Markera 'kroppsviktsövning' om vikten ska räknas från din kroppsvikt – då får du en +/− toggle per set för extra last.\n• Skriver du flera övningar på en rad separerade med '/' eller ';' delas de upp automatiskt.\n• Cirkelpass använder sekunder istället för reps – nya övningar ärver tiden från passets inställningar.",
    },
  },
  {
    element: '[data-tour="exercise-menu"]',
    popover: {
      title: "Byta ut, redigera eller ta bort en övning",
      description:
        "Kugghjulet bredvid varje övning öppnar en meny där du kan:\n• Byta ut övningen mot en annan från biblioteket\n• Redigera namn/beskrivning/instruktioner\n• Justera antal set\n• Ta bort övningen från passet helt",
      side: "left",
    },
  },
  {
    popover: {
      title: "Logga set & data",
      description:
        "• Bocka av varje set genom att trycka på setknapparna.\n• '+ Set' / '− Set' lägger till eller tar bort set under passet.\n• Vikter sparas automatiskt som personbästa (PR) och syns i statistiken.\n• Förra passets siffror hämtas automatiskt – du kan justera för progression.\n• Konditionsövningar loggar tid, distans, tempo och puls istället.",
    },
  },
  {
    element: '[data-tour="import-workout"]',
    popover: {
      title: "Importera färdigt pass",
      description:
        "Slipp bygga från grunden – välj från biblioteket av fördefinierade pass eller dina egna sparade favoriter. Du kan också spara nuvarande pass som favorit för att återanvända det senare.",
      side: "top",
    },
  },
  {
    element: '[data-tour="clear-workout"]',
    popover: {
      title: "Rensa pass",
      description:
        "Vill du börja om? Rensa passet på alla övningar med ett klick – sen kan du importera ett nytt eller bygga ett eget från scratch.",
      side: "top",
    },
  },
  {
    popover: {
      title: "Missade pass & ersättningspass",
      description:
        "Markerar du ett pass som missat (via kugghjulet ⚙️) kan du i samma dialog skapa ett anpassat ersättningspass. All historik bevaras och du tappar inte streaken.",
    },
  },

  // ══════════════════════════════════════════
  // AVSNITT 3: STATISTIK & FRAMSTEG
  // ══════════════════════════════════════════
  {
    popover: {
      title: "Avsnitt 3 av 7 – Framsteg",
      description:
        "Allt du loggar samlas till en personlig statistikvy. Här ser du muskelkarta, PR och progression över tid.",
    },
  },
  {
    element: '[data-tour="tab-stats"]',
    popover: {
      title: "Statistik-fliken",
      description:
        "Tryck här för att öppna muskelkartan, dina personbästa, viktprogressionsgrafen och historik. Statistiken inkluderar arkiverade planer – inget försvinner.",
      side: "top",
    },
  },
  {
    popover: {
      title: "PR & mål",
      description:
        "• Personbästa (PR) sparas automatiskt baserat på loggade vikter.\n• Du kan manuellt justera ett PR om det inte stämmer.\n• Sätt upp PR-mål med målvikt och datum för att följa progression.\n• Markera favoritövningar med en stjärna ⭐ för att lyfta fram dem överst.\n• Muskelkartan visar vilka muskelgrupper du tränat senaste tiden – och vilka du missat.",
    },
  },

  // ══════════════════════════════════════════
  // AVSNITT 4: SOCIALT
  // ══════════════════════════════════════════
  {
    popover: {
      title: "Avsnitt 4 av 7 – Socialt",
      description:
        "GRIM är roligare ihop. Lägg till vänner, peppa varandra, chatta och tävla på leaderboarden.",
    },
  },
  {
    element: '[data-tour="tab-social"]',
    popover: {
      title: "Social-fliken",
      description:
        "Här hittar du flödet med vänners pass, leaderboarden, vänlistan och alla chattar – både 1-mot-1 och gruppchatter.",
      side: "top",
    },
  },
  {
    element: '[data-tour="social-friends"]',
    popover: {
      title: "Vänner",
      description:
        "Sök vänner via namn och skicka vänförfrågan. När ni är vänner kan ni se varandras planer, gilla och kommentera pass. Bjud in nya med din personliga referrallänk – varje invite ger dig hedersmedlemskap närmare.",
      side: "bottom",
    },
  },
  {
    element: '[data-tour="social-chat"]',
    popover: {
      title: "Chatt & gruppchatter",
      description:
        "Skicka meddelanden, dela ett helt träningspass (mottagaren kan importera det direkt!) eller starta en gruppchatt med flera vänner samtidigt. Du får push-notiser vid nya meddelanden.",
      side: "bottom",
    },
  },
  {
    popover: {
      title: "Leaderboard, utmaningar & event",
      description:
        "• Leaderboarden visar vem som tränat flest pass – filtrera per månad eller år.\n• Dagliga utmaningar ger dig ett nytt mål varje dag och belönar med proteinbars 🥜.\n• Lägg till event (lopp, tävlingar) med datum för en nedräkning – och gå med i eventgrupper för att träna mot samma mål.",
    },
  },

  // ══════════════════════════════════════════
  // AVSNITT 5: VERKTYG & KALKYLATORER
  // ══════════════════════════════════════════
  {
    popover: {
      title: "Avsnitt 5 av 7 – Verktyg",
      description:
        "Verktygsfliken samlar profil, inställningar, kalkylatorer, butik, kalender och hjälp.",
    },
  },
  {
    element: '[data-tour="tab-calc"]',
    popover: {
      title: "Verktyg-fliken",
      description:
        "Tryck här för att öppna allt som inte är ren träning eller statistik – inklusive 1RM-, puls- och kaloriberäknare samt din profil.",
      side: "top",
    },
  },
  {
    element: '[data-tour="tools-profile"]',
    popover: {
      title: "Profil",
      description:
        "Ladda upp avatar, ange din kroppsvikt (krävs för kroppsviktsövningar), länka sociala medier (Instagram, TikTok, Snapchat) och hantera ditt konto.",
      side: "bottom",
    },
  },
  {
    popover: {
      title: "Kalkylatorer & timer",
      description:
        "• 1RM-kalkylator: räknar maxlyft baserat på vikt × reps (Epleys formel).\n• Pulszonskalkylator: dina träningszoner via Karvonens formel.\n• Kalorikalkylator: BMR/TDEE och förslag på makron.\n• Tidtaguret kan användas som vilotimer mellan set.",
    },
  },
  {
    popover: {
      title: "Inställningar & notiser",
      description:
        "• Aktivera push-notiser och ställ in påminnelsetid + tidszon.\n• Mörkt läge och temaval.\n• Byt lösenord och ställ in säkerhetsfrågor.\n• Skicka feedback via förslagslådan.",
    },
  },

  // ══════════════════════════════════════════
  // AVSNITT 6: PLAN, ENSKILDA PASS & CIRKEL
  // ══════════════════════════════════════════
  {
    popover: {
      title: "Avsnitt 6 av 7 – Plan & passtyper",
      description:
        "Ett par smarta funktioner som gör att GRIM passar både för en strikt plan och för spontan träning.",
    },
  },
  {
    popover: {
      title: "Aktiv plan & arkivering",
      description:
        "• Välj en mall eller bygg en egen plan från start.\n• Appen räknar ut vilken vecka du är på baserat på startdatum.\n• Arkivera planen när du är klar och börja om med en ny – all historik bevaras under statistik.",
    },
  },
  {
    popover: {
      title: "Enskilda pass",
      description:
        "Behöver du ett extra pass utanför planen? Under 'Enskilda pass' skapar du fristående pass med valfritt datum. Du kan kopiera ett tidigare pass med automatisk progressiv viktökning (+2,5 kg).",
    },
  },
  {
    popover: {
      title: "Cirkelpass",
      description:
        "Skapar du ett cirkelpass väljer du antal rundor och sekunder per övning. Den inbyggda cirkeltimern räknar ner per övning och runda – bocka av med R1, R2, R3-knapparna och lägg till vila mellan rundor.",
    },
  },

  // ══════════════════════════════════════════
  // AVSNITT 7: HJÄLP ALLTID NÄRA
  // ══════════════════════════════════════════
  {
    popover: {
      title: "Avsnitt 7 av 7 – Hjälp",
      description:
        "Du behöver aldrig gissa. Hjälp finns på två ställen och rundturen kan startas om när du vill.",
    },
  },
  {
    element: '[data-tour="tools-help"]',
    popover: {
      title: "Hjälp & tips i Verktyg",
      description:
        "Hela manualen i kategoriserad form – och högst upp finns knappar för att starta kort eller lång rundtur igen.",
      side: "bottom",
    },
  },
  {
    element: '[data-tour="header-help"]',
    popover: {
      title: "Frågetecknet uppe i hörnet",
      description:
        "Frågetecknet är alltid synligt i headern – tryck där för snabb hjälp eller för att starta rundturen på nytt. Lycka till med träningen! 💪",
      side: "bottom",
      align: "end",
    },
  },
];

export function startTour(variant: TourVariant, onDone?: () => void) {
  const steps = variant === "long" ? LONG_STEPS : SHORT_STEPS;

  // Filter out steps whose target isn't currently in the DOM (e.g. if user is on a different tab).
  // We still keep the "tab-*" steps because the bottom nav is always present.
  const available = steps.filter((s) => {
    const sel = (s.element as string) || "";
    if (!sel.startsWith("[")) return true;
    return document.querySelector(sel) !== null;
  });

  if (available.length === 0) {
    onDone?.();
    return;
  }

  const d = driver({
    showProgress: true,
    allowClose: true,
    overlayOpacity: 0.6,
    nextBtnText: "Nästa",
    prevBtnText: "Föregående",
    doneBtnText: "Klart",
    progressText: "{{current}} / {{total}}",
    steps: available,
    onDestroyed: () => {
      onDone?.();
    },
  });

  d.drive();
}
