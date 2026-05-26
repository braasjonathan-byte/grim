import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Shield } from "lucide-react";

interface DisclaimerItem {
  title: string;
  text: string;
}

const disclaimers: DisclaimerItem[] = [
  {
    title: "Medicinsk rådgivning",
    text: "Grim är inte en medicinsk tjänst och ger inte medicinsk rådgivning. All information i appen är av allmän karaktär och ska inte ses som en ersättning för professionell medicinsk rådgivning, diagnos eller behandling.",
  },
  {
    title: "Träningsplaner & övningar",
    text: "Grim tar inget ansvar för eventuella felskrivningar, felaktigheter eller brister i träningsplaner, övningar eller instruktioner. Användaren bär själv det fulla ansvaret för hur träningsplanerna följs och anpassas efter individuella förutsättningar.",
  },
  {
    title: "Kost & näringsplaner",
    text: "Grim tar inget ansvar för eventuella felskrivningar, felaktigheter eller brister i kostplaner, recept, kaloriberäkningar eller makronäringsrekommendationer. Näringsvärden och recept är vägledande och kan avvika från verkliga värden.",
  },
  {
    title: "Träning på egen risk",
    text: "All fysisk aktivitet och träning sker på egen risk. Grim ansvarar inte för skador, överbelastning eller hälsoproblem som kan uppstå vid användning av appens träningsinnehåll. Rådgör alltid med en läkare innan du påbörjar ett nytt träningsprogram.",
  },
  {
    title: "Kost på egen risk",
    text: "All kosthantering och näringsintag sker på egen risk. Grim ansvarar inte för allergiska reaktioner, matintoleranser, näringsbrister eller andra hälsobesvär som kan uppstå vid följandet av appens kostinnehåll. Rådgör alltid med en dietist eller läkare vid specifika kostbehov.",
  },
  {
    title: "AI-genererat innehåll",
    text: "Appen kan innehålla AI-genererade förslag och rekommendationer. Dessa är automatgenererade och har inte granskats av människor. Grim tar inget ansvar för riktigheten, lämpligheten eller fullständigheten i AI-genererat innehåll.",
  },
  {
    title: "Data & näringsvärden",
    text: "Näringsvärden i livsmedelsdatabasen (inklusive Open Food Facts) kommer från tredje part och kan vara ofullständiga, föråldrade eller felaktiga. Grim garanterar inte riktigheten i någon näringsinformation och rekommenderar att användaren verifierar värden mot produktens förpackning.",
  },
  {
    title: "Personliga förutsättningar",
    text: "Alla individers kroppar, hälsotillstånd och förutsättningar är olika. Recept, träningsplaner och rekommendationer i appen är generiska och kanske inte lämpliga för alla. Anpassa alltid innehållet efter dina egna behov, mål och förmågor.",
  },
  {
    title: "Inga garantier",
    text: "Grim lämnar inga garantier för resultat, varken vad gäller träningsframsteg, viktminskning, muskelökning eller hälsomål. Resultat varierar stort mellan individer och beror på många faktorer utanför appens kontroll.",
  },
  {
    title: "Tredjepartsinnehåll",
    text: "Appen kan innehålla länkar, data eller funktioner från tredje part (ex. Open Food Facts). Grim har ingen kontroll över och tar inget ansvar för innehåll, riktighet eller tillgänglighet hos tredje parter.",
  },
  {
    title: "Användning av kalkylatorer",
    text: "Appens kalkylatorer (1RM, pulszone, kaloribehov) ger uppskattade värden baserade på generiska formler. Resultaten är vägledande och inte exakta. Grim ansvarar inte för beslut som fattas baserat på kalkylatorernas utdata.",
  },
  {
    title: "Juridisk ansvarsbegränsning",
    text: "I den utsträckning lagen tillåter tar Grim, dess utvecklare och ägare inget ansvar för direkta, indirekta, tillfälliga, följd- eller straffskadestånd som uppstår vid användning av appen, oavsett om de baseras på kontrakt, skadestånd, försummelse eller annan rättslig grund.",
  },
];

const DisclaimerSection = () => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-border bg-secondary overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/60 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Shield className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-bold">Friskrivningar</span>
          <span className="text-[10px] text-muted-foreground bg-secondary rounded-full px-1.5 py-0.5 border border-border">
            {disclaimers.length}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3">
            <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-xs text-destructive leading-relaxed font-medium">
              Grim tar inget ansvar för eventuella felskrivningar i vare sig kostplaner eller träningsplaner.
              Användning av appen sker på egen risk.
            </p>
          </div>

          {disclaimers.map((item, i) => (
            <div key={i} className="space-y-1">
              <h4 className="text-xs font-bold text-foreground">{item.title}</h4>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{item.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DisclaimerSection;
