# Fixa Health Connect på fysisk Android-enhet

## Mål
Stoppa den oändliga laddningen, visa användbara fel och göra integritetslänken i Health Connect fungerande.

## Genomförande
- Spåra och rätta godkännandeflödet från knappen till Android-modulen, inklusive trådhantering, callbacks och svarformat.
- Begränsa hela anslutnings- och läsflödet till 20 sekunder per fast steg, återställ alltid laddningsläget och visa ett tydligt fel.
- Logga start, svar, fel och timeout för behörigheter och datahämtning både i appen och Androids logg.
- Ersätt den sköra integritetsvyn med en egen Android-vy som visar policyn och har en tydlig knapp som öppnar den publika sidan i webbläsaren.
- Göra Android-patchningen reproducerbar vid varje ny installation/CI-körning och skärpa verifieringsskriptet.
- Lägg till tester för timeout, felåterställning och Android-konfiguration samt kör relevanta tester, typkontroll och pluginverifiering.

## Antagande
20-sekundersgränsen gäller varje automatiskt brygg-/dataanrop. När Androids godkännandedialog är öppen får användaren fortfarande svara innan den stängs av systemet.
