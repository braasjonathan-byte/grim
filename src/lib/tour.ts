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
  ...SHORT_STEPS.slice(0, 1),
  {
    element: '[data-tour="workout-day"]',
    popover: {
      title: "Dagens pass",
      description: "Tryck på en dag för att öppna passet. Bocka rutorna när du gjort ett set.",
      side: "bottom",
    },
  },
  {
    element: '[data-tour="tab-stats"]',
    popover: {
      title: "Statistik",
      description: "Här ser du muskelkartan och alla dina personbästa.",
      side: "top",
    },
  },
  {
    element: '[data-tour="tab-social"]',
    popover: {
      title: "Social",
      description: "Vänner, chatt, gruppchatter, leaderboard och flöde.",
      side: "top",
    },
  },
  {
    element: '[data-tour="social-friends"]',
    popover: {
      title: "Vänner",
      description: "Lägg till vänner via namn eller din referrallänk.",
      side: "bottom",
    },
  },
  {
    element: '[data-tour="social-chat"]',
    popover: {
      title: "Chatt & gruppchatter",
      description: "Skicka meddelanden, dela pass eller starta en gruppchatt med dina vänner.",
      side: "bottom",
    },
  },
  {
    element: '[data-tour="tab-calc"]',
    popover: {
      title: "Verktyg",
      description: "Profil, inställningar, kalkylatorer, butik och hjälp.",
      side: "top",
    },
  },
  {
    element: '[data-tour="tools-profile"]',
    popover: {
      title: "Profil",
      description: "Ladda upp avatar, ange kroppsvikt och länka sociala medier.",
      side: "bottom",
    },
  },
  {
    element: '[data-tour="tools-help"]',
    popover: {
      title: "Hjälp & tips",
      description: "Här finns all hjälp – och du kan starta rundturen igen när som helst.",
      side: "bottom",
    },
  },
  {
    element: '[data-tour="header-help"]',
    popover: {
      title: "Frågetecknet alltid synligt",
      description: "Klicka på frågetecknet uppe i högra hörnet för snabb hjälp.",
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
