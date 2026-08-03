# Bottennav med aktiv indikator + flytande timer-pill

## Bottennavigeringen

- Aktiv flik får en fylld bakgrundskapsel bakom ikonen (rundad pill i primärfärg med låg opacitet) plus en liten prick under etiketten.
- Kapseln glider/tonar mjukt mellan flikar vid byte i stället för att bara byta färg; ikon och text får en mjuk färgövergång.
- Tryck ger en subtil scale/bounce på ikonen (kort nedtryck följt av studs tillbaka) plus lätt haptik.
- Notisbadgen ligger kvar ovanpå ikonen och påverkas inte av kapseln.
- Respekterar `prefers-reduced-motion`: då sker bytet med enbart färgövergång.

```text
+------------------------------------------+
|  ( ▣ )    ○      ○      ○      ○         |
|  Träning  Mat  Social  Stats  Verktyg    |
|    •                                     |
+------------------------------------------+
```

## Flytande timer-widget

Den hopfällda timern sträcker sig idag kant till kant strax ovanför navet. Den byggs om till en flytande pill:

- Centrerad, med marginal i sidled så den inte når kanterna, och några pixlar extra luft ovanför bottennavet.
- Rundad pill-form, kortbakgrund med blur, tunn ram och tydlig men mjuk skugga så den ser ut att sväva.
- Innehållet (play/paus, tid, etikett, puls, expandera-pil) ligger kvar men får tätare, balanserad layout.
- Play/paus-knappen blir en rund knapp. När timern är aktiv får den en mjuk pulsanimation (lugn ring som andas utåt) så det syns att tiden räknar.
- Den expanderade panelen får samma flytande pill-behandling (rundade hörn, skugga, marginal) så de hänger ihop.
- Fullskärmsläget ändras inte.

## Teknisk detalj

- `src/pages/Index.tsx`: flikknapparna får ikon-wrapper med aktiv kapsel, prick under etiketten, övergångsklasser och tryck-animation.
- `src/components/MiniTimer.tsx`: collapsed- och expanded-vyerna byter från `left-0 right-0` till centrerad container med marginal, rundade hörn och skugga; play-knappen får pulsklass när `running`.
- `src/index.css`: nya keyframes för tab-bounce och timerns play-puls, båda avstängda vid `prefers-reduced-motion`.
- Endast semantiska färgtoken (primary, card, border, muted) – inga hårdkodade färger.
