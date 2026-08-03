# Kompaktare inläggskort i Social-flödet

## Kortet

- Rundade hörn (rounded-2xl) på hela kortet, tunn ram och en subtil skugga som lyfter kortet från bakgrunden. Bild och karusell klipps snyggt mot hörnen.
- Tätare rytm: mindre luft mellan header, bild, text, statistik och reaktionsrad. Header krymper något, bildtexten ligger närmare bilden, och avdelarlinjen mellan text och reaktioner blir mer diskret. Flödet ska kännas som Instagram/Strava.
- Kommentarssektionen får samma tätare spacing.

## Träningsstatistik som chips

Passinlägg innehåller idag statistiken som textrader i bildtexten, t.ex.:

```text
💪 24 set
🏋️‍♂️ 7 800 kg volym
```

Dessa rader plockas ut ur texten vid rendering och visas i stället som små ikon-chips på en rad direkt under bildtexten:

```text
[ 24 set ]  [ 7.8k kg ]  [ 5 km ]  [ 42 min ]
```

- Chips är kompakta, med ikon + värde, dämpad bakgrund och rundad form.
- Stora volymtal kortas till k-format (7 800 → 7.8k).
- Resten av bildtexten visas som vanligt utan de utplockade raderna. Inlägg utan statistik ser ut som förut.
- Ingen ändring i hur inlägg sparas – enbart hur de visas.

## Reaktionsknappar

- Flame, kommentar och hejarop blir pill-formade knappar med ram och ikon + siffra.
- Aktivt läge får fylld bakgrundsfärg: flame i varm ton när man eldat, kommentar i primärton när kommentarerna är öppna, hejarop markerat när det skickats.
- Tryck ger en liten skal-animation samt haptik.

## Flame-animation

Vid tryck på flame (när man eldar, inte när man tar bort):
- Ikonen skalas upp och tillbaka i en snabb "pop".
- 6–8 små partiklar (gnistor) flyger uppåt/utåt från ikonen och tonar ut på ca 600 ms.
- Respekterar `prefers-reduced-motion` – då körs endast en enkel färgövergång.

## Teknisk detalj

- `src/components/SocialView.tsx`: kortets container-klasser (radie, skugga, spacing), ny caption-parser som separerar statistikrader från brödtext, chips-raden och de nya pill-knapparna.
- Ny `src/components/FlameReaction.tsx`: pill-knappen för flame med pop-skala och partikeleffekt.
- Ny hjälpare `src/lib/parseWorkoutCaption.ts`: extraherar set/volym/distans/tid ur bildtexten och returnerar chips + rensad text.
- `src/components/WorkoutCheerButton.tsx`: pill-stil så knappen matchar de övriga.
- `src/components/WorkoutPostThread.tsx`: samma pill-stil och flame-animation för reaktionsraden inne i passvyn.
- `src/index.css`: keyframes för flame-pop och partiklar.
- Endast semantiska färgtoken används, inga hårdkodade färgklasser.
