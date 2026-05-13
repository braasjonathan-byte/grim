import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

export type TourVariant = "short" | "long";

type StepMeta = {
  /** Switch the bottom-nav tab before showing this step. */
  tab?: "workout" | "stats" | "social" | "calc";
  /** When tab is 'social', also switch the SocialView sub-tab. */
  subtab?: "feed" | "friends" | "chat" | "groups";
  /** When tab is 'calc', expand a section in ToolsTab and scroll to it. */
  expand?: "settings" | "helpers" | "help";
};

type TourStep = { step: DriveStep; meta?: StepMeta };

// ════════════════════════════════════════════════════════════
// SHORT TOUR
// ════════════════════════════════════════════════════════════
const SHORT: TourStep[] = [
  {
    meta: { tab: "workout" },
    step: {
      element: '[data-tour="tab-workout"]',
      popover: {
        title: "Träning",
        description:
          "Här hittar du dagens pass. Bocka av set, logga vikt och se din veckoplan.",
        side: "top",
        align: "center",
      },
    },
  },
  {
    meta: { tab: "stats" },
    step: {
      element: '[data-tour="tab-stats"]',
      popover: {
        title: "Statistik",
        description:
          "Se muskelkartan, dina personbästa (PR) och hur du utvecklas över tid.",
        side: "top",
      },
    },
  },
  {
    meta: { tab: "social" },
    step: {
      element: '[data-tour="tab-social"]',
      popover: {
        title: "Social",
        description:
          "Vänner, leaderboard, chatt och flöde med dina vänners pass.",
        side: "top",
      },
    },
  },
  {
    meta: { tab: "calc" },
    step: {
      element: '[data-tour="tab-calc"]',
      popover: {
        title: "Verktyg",
        description: "Profil, inställningar, kalkylatorer, hjälp och mycket mer.",
        side: "top",
      },
    },
  },
  {
    step: {
      element: '[data-tour="header-help"]',
      popover: {
        title: "Hjälp finns alltid här",
        description:
          "Tryck på frågetecknet för att öppna hjälp & tips eller starta rundturen igen.",
        side: "bottom",
        align: "end",
      },
    },
  },
];

// ════════════════════════════════════════════════════════════
// LONG TOUR – navigates the user through every section
// ════════════════════════════════════════════════════════════
const LONG: TourStep[] = [
  // ── Avsnitt 1: Komma igång ──
  {
    meta: { tab: "workout" },
    step: {
      popover: {
        title: "Avsnitt 1 av 7 – Komma igång",
        description:
          "Vi börjar med grunderna: var dina pass bor, hur veckoplanen fungerar och hur du markerar pass som klara.",
      },
    },
  },
  {
    meta: { tab: "workout" },
    step: {
      element: '[data-tour="tab-workout"]',
      popover: {
        title: "Träning-fliken",
        description:
          "Här bor allt som rör din träning: dagens pass, veckoöversikt och din aktiva plan. Detta är startsidan.",
        side: "top",
      },
    },
  },
  {
    meta: { tab: "workout" },
    step: {
      popover: {
        title: "Veckans dagar",
        description:
          "Varje dag visas som ett kort i veckoöversikten. Appen landar på dagens dag.<br><br>• Bläddra mellan veckor med pilarna eller svep åt sidan.<br>• Tryck på dagförkortningen (t.ex. 'TIS') för att flytta passet till en annan dag.<br>• Är dagen upptagen byter passen plats automatiskt.<br>• Bocka i passet som klart med bocken – du tjänar en proteinbar 🥜 per träningsdag.",
      },
    },
  },

  // ── Avsnitt 2: Bygga & ändra pass ──
  {
    meta: { tab: "workout" },
    step: {
      popover: {
        title: "Avsnitt 2 av 7 – Bygga & ändra pass",
        description:
          "Nu visar vi knapparna för att lägga till, byta ut, ta bort och importera övningar.",
      },
    },
  },
  {
    meta: { tab: "workout" },
    step: {
      element: '[data-tour="add-exercise"]',
      popover: {
        title: "Lägg till övning",
        description:
          "Tryck på '+' för att öppna övningsbiblioteket. Du kan filtrera på muskelgrupp, söka via namn, växla kategori (Styrka, Kondition, Rörlighet, Core) eller skapa en helt egen övning.",
        side: "top",
      },
    },
  },
  {
    meta: { tab: "workout" },
    step: {
      popover: {
        title: "När du lägger till en övning",
        description:
          "• Välj antal set, reps och vikt direkt i dialogen.<br>• Markera 'kroppsviktsövning' om vikten ska räknas från din kroppsvikt – då får du en +/− toggle per set för extra last.<br>• Skriver du flera övningar på en rad separerade med '/' eller ';' delas de upp automatiskt.<br>• Cirkelpass använder sekunder istället för reps.",
      },
    },
  },
  {
    meta: { tab: "workout" },
    step: {
      element: '[data-tour="exercise-menu"]',
      popover: {
        title: "Byta ut, redigera eller ta bort",
        description:
          "Kugghjulet bredvid varje övning öppnar en meny:<br>• Byt ut övningen mot en annan från biblioteket<br>• Redigera namn/beskrivning/instruktioner<br>• Justera antal set<br>• Ta bort övningen från passet",
        side: "left",
      },
    },
  },
  {
    meta: { tab: "workout" },
    step: {
      element: '[data-tour="import-workout"]',
      popover: {
        title: "Importera färdigt pass",
        description:
          "Slipp bygga från grunden – välj från biblioteket av fördefinierade pass eller dina egna sparade favoriter. Du kan också spara nuvarande pass som favorit för att återanvända det senare.",
        side: "top",
      },
    },
  },
  {
    meta: { tab: "workout" },
    step: {
      element: '[data-tour="clear-workout"]',
      popover: {
        title: "Rensa pass",
        description:
          "Vill du börja om? Rensa passet på alla övningar med ett klick – sen kan du importera ett nytt eller bygga ett eget från scratch.",
        side: "top",
      },
    },
  },
  {
    meta: { tab: "workout" },
    step: {
      popover: {
        title: "Missade pass & ersättningspass",
        description:
          "Markerar du ett pass som missat (via kugghjulet ⚙️) kan du i samma dialog skapa ett anpassat ersättningspass. All historik bevaras och du tappar inte streaken.",
      },
    },
  },

  // ── Avsnitt 3: Statistik & framsteg ──
  {
    meta: { tab: "stats" },
    step: {
      popover: {
        title: "Avsnitt 3 av 7 – Framsteg",
        description:
          "Allt du loggar samlas till en personlig statistikvy. Här ser du muskelkarta, PR och progression över tid.",
      },
    },
  },
  {
    meta: { tab: "stats" },
    step: {
      element: '[data-tour="tab-stats"]',
      popover: {
        title: "Statistik-fliken",
        description:
          "Muskelkartan, dina personbästa, viktprogressionsgrafen och historik. Statistiken inkluderar arkiverade planer – inget försvinner.",
        side: "top",
      },
    },
  },
  {
    meta: { tab: "stats" },
    step: {
      popover: {
        title: "PR & mål",
        description:
          "• Personbästa (PR) sparas automatiskt.<br>• Justera ett PR manuellt om det inte stämmer.<br>• Sätt PR-mål med målvikt och datum.<br>• Markera favoritövningar med en stjärna ⭐.<br>• Muskelkartan visar vilka muskelgrupper du tränat – och vilka du missat.",
      },
    },
  },

  // ── Avsnitt 4: Socialt ──
  {
    meta: { tab: "social", subtab: "feed" },
    step: {
      popover: {
        title: "Avsnitt 4 av 7 – Socialt",
        description:
          "GRIM är roligare ihop. Lägg till vänner, peppa varandra, chatta och tävla på leaderboarden.",
      },
    },
  },
  {
    meta: { tab: "social", subtab: "feed" },
    step: {
      element: '[data-tour="tab-social"]',
      popover: {
        title: "Social-fliken",
        description:
          "Här hittar du flödet med vänners pass, leaderboarden, vänlistan och alla chattar – både 1-mot-1 och gruppchatter.",
        side: "top",
      },
    },
  },
  {
    meta: { tab: "social", subtab: "friends" },
    step: {
      element: '[data-tour="social-friends"]',
      popover: {
        title: "Vänner-fliken",
        description:
          "Tryck här för att se vänlistan. Sök vänner via namn, skicka vänförfrågningar och bjud in nya med din personliga referrallänk.",
        side: "bottom",
      },
    },
  },
  {
    meta: { tab: "social", subtab: "chat" },
    step: {
      element: '[data-tour="social-chat"]',
      popover: {
        title: "Chatt & gruppchatter",
        description:
          "Inne i chatt-fliken kan du skicka meddelanden, dela ett helt träningspass (mottagaren kan importera det direkt!) eller starta en gruppchatt med flera vänner samtidigt via 'Grupp'-knappen.",
        side: "bottom",
      },
    },
  },
  {
    meta: { tab: "social", subtab: "groups" },
    step: {
      popover: {
        title: "Eventgrupper, leaderboard & utmaningar",
        description:
          "• Leaderboarden visar vem som tränat flest pass – filtrera per månad eller år.<br>• Dagliga utmaningar belönar med proteinbars 🥜.<br>• Lägg till event (lopp, tävlingar) med datum för en nedräkning – och gå med i eventgrupper för att träna mot samma mål.",
      },
    },
  },

  // ── Avsnitt 5: Verktyg & inställningar ──
  {
    meta: { tab: "calc" },
    step: {
      popover: {
        title: "Avsnitt 5 av 7 – Verktyg",
        description:
          "Verktygsfliken samlar profil, inställningar, kalkylatorer, butik, kalender och hjälp.",
      },
    },
  },
  {
    meta: { tab: "calc" },
    step: {
      element: '[data-tour="tab-calc"]',
      popover: {
        title: "Verktyg-fliken",
        description:
          "Tryck här för att öppna allt som inte är ren träning eller statistik – inklusive 1RM-, puls- och kaloriberäknare samt din profil.",
        side: "top",
      },
    },
  },
  {
    meta: { tab: "calc", expand: "settings" },
    step: {
      element: '[data-tour="tools-profile"]',
      popover: {
        title: "Profil & inställningar",
        description:
          "I 'Inställningar'-sektionen finns Profil, Tema och Notifikationer:<br>• Ladda upp avatar och länka sociala medier<br>• Ange din kroppsvikt (krävs för kroppsviktsövningar)<br>• Aktivera push-notiser och ställ in påminnelsetid + tidszon<br>• Byt lösenord och säkerhetsfrågor",
        side: "bottom",
      },
    },
  },
  {
    meta: { tab: "calc", expand: "helpers" },
    step: {
      element: '[data-tour="tools-helpers"]',
      popover: {
        title: "Hjälpmedel & kalkylatorer",
        description:
          "Sektionen 'Hjälpmedel' innehåller:<br>• 1RM-kalkylator (Epleys formel)<br>• Pulszonskalkylator (Karvonens formel)<br>• Kalorikalkylator (BMR/TDEE + makron)<br>• Vilotimer-inställningar<br>• Eventnedräkning<br>• Tidtagaruret",
        side: "bottom",
      },
    },
  },

  // ── Avsnitt 6: Plan, enskilda pass & cirkel ──
  {
    meta: { tab: "workout" },
    step: {
      popover: {
        title: "Avsnitt 6 av 7 – Plan & passtyper",
        description:
          "Ett par smarta funktioner så GRIM passar både för en strikt plan och spontan träning.",
      },
    },
  },
  {
    meta: { tab: "workout" },
    step: {
      popover: {
        title: "Aktiv plan & arkivering",
        description:
          "• Välj en mall eller bygg en egen plan.<br>• Appen räknar ut vilken vecka du är på baserat på startdatum.<br>• Arkivera planen när du är klar och börja om med en ny – all historik bevaras under statistik.",
      },
    },
  },
  {
    meta: { tab: "workout" },
    step: {
      popover: {
        title: "Enskilda pass",
        description:
          "Behöver du ett extra pass utanför planen? Under 'Enskilda pass' skapar du fristående pass med valfritt datum. Du kan kopiera ett tidigare pass med automatisk progressiv viktökning (+2,5 kg).",
      },
    },
  },
  {
    meta: { tab: "workout" },
    step: {
      popover: {
        title: "Cirkelpass",
        description:
          "Skapar du ett cirkelpass väljer du antal rundor och sekunder per övning. Den inbyggda cirkeltimern räknar ner per övning och runda – bocka av med R1, R2, R3-knapparna och lägg till vila mellan rundor.",
      },
    },
  },

  // ── Avsnitt 7: Hjälp alltid nära ──
  {
    meta: { tab: "calc", expand: "help" },
    step: {
      element: '[data-tour="tools-help"]',
      popover: {
        title: "Avsnitt 7 av 7 – Hjälp & tips",
        description:
          "Hela manualen i kategoriserad form. Längst upp i sektionen finns knappar för att starta kort eller lång rundtur igen när som helst.",
        side: "top",
      },
    },
  },
  {
    step: {
      element: '[data-tour="header-help"]',
      popover: {
        title: "Frågetecknet uppe i hörnet",
        description:
          "Frågetecknet är alltid synligt i headern – tryck där för snabb hjälp eller för att starta rundturen på nytt. Lycka till med träningen! 💪",
        side: "bottom",
        align: "end",
      },
    },
  },
];

// ════════════════════════════════════════════════════════════
// Driver setup with per-step navigation
// ════════════════════════════════════════════════════════════

const NAV_DELAY = 350;

function applyMeta(meta?: StepMeta) {
  if (!meta) return;
  if (meta.tab) window.dispatchEvent(new CustomEvent("grim:set-tab", { detail: meta.tab }));
  if (meta.subtab) {
    // Slight delay so SocialView is mounted before the sub-tab change
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("grim:social-subtab", { detail: meta.subtab }));
    }, 150);
  }
  if (meta.expand) {
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("grim:tools-expand", { detail: meta.expand }));
    }, 150);
  }
}

export function startTour(variant: TourVariant, onDone?: () => void) {
  const all = variant === "long" ? LONG : SHORT;

  // Drop steps that target a missing element AND have no nav meta to bring it in.
  const available = all.filter(({ step, meta }) => {
    const sel = step.element as string | undefined;
    if (!sel) return true; // popover-only
    if (meta?.tab) return true; // navigation will bring it on screen
    return document.querySelector(sel) !== null;
  });

  if (available.length === 0) {
    onDone?.();
    return;
  }

  const driveSteps = available.map((s) => s.step);

  const d = driver({
    showProgress: true,
    allowClose: true,
    overlayOpacity: 0.6,
    nextBtnText: "Nästa",
    prevBtnText: "Föregående",
    doneBtnText: "Klart",
    progressText: "{{current}} / {{total}}",
    steps: driveSteps,
    onNextClick: () => {
      const idx = d.getActiveIndex() ?? 0;
      const nextIdx = idx + 1;
      if (nextIdx >= available.length) {
        d.destroy();
        return;
      }
      applyMeta(available[nextIdx].meta);
      setTimeout(() => d.moveNext(), NAV_DELAY);
    },
    onPrevClick: () => {
      const idx = d.getActiveIndex() ?? 0;
      const prevIdx = idx - 1;
      if (prevIdx < 0) return;
      applyMeta(available[prevIdx].meta);
      setTimeout(() => d.movePrevious(), NAV_DELAY);
    },
    onDestroyed: () => {
      onDone?.();
    },
  });

  // Apply meta for the first step before starting
  applyMeta(available[0].meta);
  setTimeout(() => d.drive(), NAV_DELAY);
}
