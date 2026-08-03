# Konsekvent designsystem för GRIM

Ett gemensamt fundament för typografi, färg, spacing och hörnradie – och sedan tillämpat på grunden plus de största vyerna.

## Beslut från dina svar

- Mjuka hörn: 12–16px ersätter dagens helt kvadratiska uttryck.
- Temasystemet behålls: primärfärgen fortsätter styras av valt tema (Standard, Ljust, Neon, Ocean m.fl.). Ingen fast blå.
- Brödtext byter till Inter.
- Omfattning: tokens + baskomponenter + Träning, Statistik och Kost.

Notera: "helt kvadratiska hörn, ingen skugga" var en tidigare uttalad designregel för projektet. Den ersätts nu av mjuka hörn enligt ditt val, och jag uppdaterar projektets designminne så att framtida ändringar följer det nya.

## Typografisk hierarki

Marker-fonten (Permanent Marker) reserveras strikt för:
- GRIM-loggan och branding
- Stora sektionsrubriker (t.ex. "Statistik", "Kost", dialogtitlar på toppnivå)

Aldrig för brödtext, siffror, etiketter, listrader, knappar eller tabeller.

Skala som införs som återanvändbara klasser:

```text
display   Permanent Marker   28px   branding / vy-titel
h1        Permanent Marker   22px   sektionsrubrik
h2        Inter 600          17px   kortrubrik
h3        Inter 600          15px   underrubrik
body      Inter 400          14px   brödtext
label     Inter 500          12px   etiketter, formulärtext
caption   Inter 400          11px   hjälptext, tidsstämplar
metric    Inter 600 tabular  varierar  siffror, vikter, tempo, kcal
```

Siffror får tabulära siffror så att kolumner med vikt/reps/kcal ligger i linje.

## Tokens

- Färg: befintliga semantiska tokens städas och kompletteras med success (grön), warning (orange) och info, med korrekta foreground-par i både ljust och mörkt läge och i alla teman. Primary, background, card och border fortsätter komma från temat.
- Spacing: skala 4 / 8 / 12 / 16 / 24 / 32px som tokens, används för padding och gap.
- Radie: `--radius-sm` 8px, `--radius-md` 12px, `--radius-lg` 16px, `--radius-full` för pillerformer. Kort och dialoger använder 16px, mindre ytor 12px, chips och knappar 8–12px.

## Var det tillämpas

1. Bas: globala CSS-variabler, typografiklasser, Inter laddas, den globala kvadratiska hörn-regeln tas bort.
2. Baskomponenter (kort, knapp, input, dialog, badge, tabs, sheet) får radie och typografi från tokens – vilket ger genomslag i hela appen automatiskt.
3. Vyerna Träning, Statistik och Kost: rubriker byter till rätt nivå, siffror och etiketter byter till Inter/metric-stilen, hårdkodade färger och avvikande radie ersätts med tokens.

## Teknisk detalj

- `src/index.css`: nya variabler för färg, spacing och radie; borttagning av `border-radius: 0 !important`; typografiklasser i `@layer components`; `--font-sans` byter till Inter.
- `tailwind.config.ts`: `fontFamily.sans` → Inter, `borderRadius` mappas mot de nya variablerna, spacing-tokens exponeras.
- `index.html`: Inter läggs till bland de icke-blockerande font-länkarna.
- `src/lib/themes.ts`: varje tema kompletteras med success/warning/info så att statusfärger fungerar i alla teman.
- Vy-filer: `WorkoutView.tsx`, statistikvyn och `NutritionView.tsx` med tillhörande kort får rubriknivåer och tokens; hårdkodade `text-white`/`bg-[#...]` byts mot semantiska klasser.

## Risker

Radiebytet syns i hela appen, även i vyer utanför de tre största. Det är avsiktligt och ger ett enhetligt intryck, men jag kollar igenom nyckelvyer efteråt.
