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
  // ── Avsnitt 1: Komma igång ──
  {
    element: '[data-tour="tab-workout"]',
    popover: {
      title: "1. Komma igång – Träning",
      description: "Här bor allt som rör din träning: dagens pass, veckoöversikt och din aktiva plan. Vi börjar här.",
      side: "top",
    },
  },
  {
    element: '[data-tour="workout-day"]',
    popover: {
      title: "Veckoplan & dagens pass",
      description: "Varje dag i veckan visas som ett kort. Tryck på en dag för att öppna passet och börja logga.",
      side: "bottom",
    },
  },

  // ── Avsnitt 2: Bygga & ändra pass ──
  {
    element: '[data-tour="add-exercise"]',
    popover: {
      title: "2. Bygga passet – Lägg till övning",
      description: "Tryck på 'Lägg till övning' för att öppna biblioteket. Du kan filtrera på muskelgrupp, söka, eller skapa en helt egen övning.",
      side: "top",
    },
  },
  {
    element: '[data-tour="exercise-menu"]',
    popover: {
      title: "Byt ut eller ta bort övning",
      description: "Kugghjulet bredvid varje övning öppnar en meny där du kan byta ut övningen mot en annan, redigera beskrivningen eller ta bort den helt.",
      side: "left",
    },
  },
  {
    element: '[data-tour="import-workout"]',
    popover: {
      title: "Importera färdigt pass",
      description: "Slipp bygga från grunden – importera ett färdigt pass från biblioteket eller dina sparade favoriter direkt in i dagens pass.",
      side: "top",
    },
  },
  {
    element: '[data-tour="clear-workout"]',
    popover: {
      title: "Rensa pass",
      description: "Vill du börja om? Rensa passet på alla övningar med ett klick – sen kan du importera ett nytt eller bygga eget.",
      side: "top",
    },
  },

  // ── Avsnitt 3: Statistik & framsteg ──
  {
    element: '[data-tour="tab-stats"]',
    popover: {
      title: "3. Framsteg – Statistik",
      description: "Här ser du muskelkartan, dina personbästa (PR), viktprogression och historik – inklusive arkiverade planer.",
      side: "top",
    },
  },

  // ── Avsnitt 4: Socialt ──
  {
    element: '[data-tour="tab-social"]',
    popover: {
      title: "4. Socialt – Vänner & flöde",
      description: "Vänner, leaderboard, gruppchatter och ett flöde där du kan gilla och kommentera dina vänners pass.",
      side: "top",
    },
  },
  {
    element: '[data-tour="social-friends"]',
    popover: {
      title: "Vänner",
      description: "Sök vänner via namn, eller bjud in nya med din personliga referrallänk.",
      side: "bottom",
    },
  },
  {
    element: '[data-tour="social-chat"]',
    popover: {
      title: "Chatt & gruppchatter",
      description: "Skicka meddelanden, dela pass eller starta en gruppchatt med flera vänner samtidigt.",
      side: "bottom",
    },
  },

  // ── Avsnitt 5: Verktyg & inställningar ──
  {
    element: '[data-tour="tab-calc"]',
    popover: {
      title: "5. Verktyg",
      description: "Profil, inställningar, kalkylatorer (1RM, puls, kalorier), butik, kalender och hjälp.",
      side: "top",
    },
  },
  {
    element: '[data-tour="tools-profile"]',
    popover: {
      title: "Profil",
      description: "Ladda upp avatar, ange kroppsvikt (krävs för kroppsviktsövningar) och länka sociala medier.",
      side: "bottom",
    },
  },
  {
    element: '[data-tour="tools-help"]',
    popover: {
      title: "Hjälp & tips",
      description: "Här hittar du all dokumentation – och du kan starta rundturen igen när som helst.",
      side: "bottom",
    },
  },

  // ── Avsnitt 6: Hjälp alltid nära ──
  {
    element: '[data-tour="header-help"]',
    popover: {
      title: "6. Frågetecknet uppe i hörnet",
      description: "Frågetecknet är alltid synligt – tryck där för snabb hjälp eller för att starta rundturen på nytt.",
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
