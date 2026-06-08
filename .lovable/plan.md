
## Batch 1 — Snabba UI/native-fixar (utan databasändringar)

1. **Portrait-lås (Android)**
   - `android/app/src/main/AndroidManifest.xml`: lägg `android:screenOrientation="portrait"` på `MainActivity`.
   - Skapa `scripts/patch-android-orientation.cjs` så det överlever `npx cap sync`. Lägg in i `release-aab.yml` patch-steget.

2. **App-ikon i AAB**
   - Generera ny ikongrafik (foreground 432×432 + bakgrund) från Grim-loggan via imagegen (premium).
   - Skapa adaptive icon-XML + PNG i alla mipmap-mappar (mdpi → xxxhdpi) + `mipmap-anydpi-v26/ic_launcher.xml`.
   - Lägg in i `scripts/patch-android-icons.cjs` (kopierar från `android-icons-source/` till `android/app/src/main/res/`) så ikonerna återställs efter `npx cap add android` i GitHub Actions.
   - Hooka in scriptet i `release-aab.yml`.

3. **AI-foto-dialog (AIFoodScanDialog)**
   - Ta bort den generiska placeholder-bilden när dialog är öppen utan eget foto.
   - Lägg knapp "Öppna kameran igen" som triggar samma kameraflöde som första gången.

4. **Lås klarmarkerat pass**
   - I `WorkoutLogDialog` / set-redigerings-UI: när `completion.done === true`, gör alla inputs/textareas `disabled` och knappar grå.
   - Visa banner överst: "Passet är klarmarkerat. Avmarkera bocken för att redigera."

## Batch 2 — Nya sidor/dialoger

5. **/delete-account (inloggad self-service)**
   - Ny route i `App.tsx` → `src/pages/DeleteAccount.tsx`.
   - Kräver inlogg. Bekräftelse + lösenord. Anropar ny edge-funktion `delete-account` som tar bort `auth.users`-rad via service-role (CASCADE rensar profiles/övriga tabeller).
   - Länka från ProfileSection och från Privacy-sidan. Sätt också länken som "Account deletion URL" i Play Console-instruktionerna i README.

6. **Dela-pass-dialog efter klarmarkering**
   - I samma flöde som idag auto-skapar social_post (`ensure_workout_social_post` trigger): lägg en frontend-dialog som öppnas när användaren bockar i "klar" och frågar "Dela passet med dina vänner?".
   - Ja → låt triggern göra sitt + visa toast "Delat".
   - Nej → kör en edge-funktion (eller direkt DELETE) som tar bort det auto-skapade `social_posts`-inlägget för det passet.
   - Spara val i `localStorage` som "kom-ihåg" (med "fråga alltid")-toggle i inställningar — separat task om tid finns.

7. **Blockera vän från profil**
   - Migration: lägg `status = 'blocked'` (redan tillåtet i enum/text?) och ny tabell **endast om** `friendships.status` inte räcker. Standardplan: använd befintlig friendships med ny status `'blocked'` + `blocked_by` kolumn.
   - RLS-policy: blockerad användare ser inte den blockerandes inlägg/profil. Uppdatera SELECT-policies på `social_posts`, `social_post_comments`, `chat_messages`, `friendships`.
   - UI: knapp "Blockera" i `FriendProfileView` med bekräftelse. "Avblockera" från ny lista i inställningar.

## Batch 3 — Play Store-beskrivningar (textfil, ingen kod)

8. **Skapa `store/play-store-listing.md`** med:
   - Kort beskrivning (max 80 tecken).
   - Lång beskrivning (max 4000 tecken) — funktioner, målgrupp, USP.
   - Skrivs på svenska eftersom appen är på svenska.

## Batch 4 — Google Play Billing-migration (STÖRSTA jobbet)

9. **Ersätt Stripe på Android med Play Billing**
   - Installera `@capacitor-community/in-app-purchases` (eller RevenueCat om vi vill ha enklare server-validering — rekommenderar RevenueCat för subscription-state-hantering).
   - Lägg till plugin i `capacitor.config.ts` includePlugins.
   - Ny tjänst `src/lib/playBilling.ts` som wrappar plugin: `getProducts()`, `purchase(productId)`, `restorePurchases()`.
   - Ny edge-funktion `validate-play-purchase`: tar emot purchase token från klient, validerar mot Google Play Developer API (kräver service account JSON som secret `GOOGLE_PLAY_SERVICE_ACCOUNT`), skriver entitlement till ny tabell `play_entitlements` (user_id, product_id, expiry_time, original_purchase_token).
   - Uppdatera `check-subscription` så den i Android-app-kontext läser från `play_entitlements` istället för Stripe.
   - I `SettingsPanel`: när `Capacitor.isNativePlatform() && platform === 'android'`, dölj "Hantera medlemskap" (Stripe-portalen) och visa istället knapp "Hantera prenumeration" som öppnar `https://play.google.com/store/account/subscriptions?sku=...&package=se.grim.app` via `Browser.open`.
   - Fixa även den befintliga kundportal-buggen: lägg in proper error-toast + console-log på `customer-portal`-anropet så vi ser varför den inte öppnas idag (sannolikt popup blockerad i Capacitor WebView — behöver `Browser.open(url)` istället för `window.open`).
   - **Krav från användaren:** Skapa produkt i Play Console med samma `product_id` som vi använder i koden (förslag: `grim_pro_monthly`), och ladda upp service account-JSON till Lovable secrets.

## Teknisk detalj — påverkade filer

```
android/app/src/main/AndroidManifest.xml
android/app/src/main/res/mipmap-*/ic_launcher*.png  (genererade)
android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml
android/app/src/main/res/drawable/ic_launcher_foreground.xml
scripts/patch-android-orientation.cjs              (ny)
scripts/patch-android-icons.cjs                    (ny)
.github/workflows/release-aab.yml                  (kalla nya patch-scripts)

src/App.tsx                                        (route /delete-account)
src/pages/DeleteAccount.tsx                        (ny)
src/components/AIFoodScanDialog.tsx                (ta bort placeholder + ny knapp)
src/components/WorkoutLogDialog.tsx                (disable-state)
src/components/FriendProfileView.tsx               (blockera-knapp)
src/components/SettingsPanel.tsx                   (Play Billing-portal, avblockera-lista)
src/components/ProfileSection.tsx                  (länk till /delete-account)
src/components/WorkoutShareCard.tsx eller motsv.   (dela-dialog efter klar)
src/lib/playBilling.ts                             (ny)

supabase/functions/delete-account/index.ts         (ny)
supabase/functions/validate-play-purchase/index.ts (ny)
supabase/functions/check-subscription/index.ts     (Android-läge)

migration: friendships.blocked_by, blocked-policies, play_entitlements-tabell

store/play-store-listing.md                        (ny)
```

## Ordning och leverans

Jag levererar i 4 separata commits/svarsrundor:
- **Runda 1:** Batch 1 (portrait + ikoner + AI-foto + lås pass) — minimal risk, du kan tagga ny AAB direkt.
- **Runda 2:** Batch 2 (delete-account, dela-pass-dialog, blockera vän + migration).
- **Runda 3:** Batch 3 (Play Store-beskrivningar).
- **Runda 4:** Batch 4 (Play Billing — kräver att du skapar produkt i Play Console och laddar upp Google service account-JSON innan validate-funktionen fungerar).

Säg till om ordningen ska ändras, eller om vi ska skippa något. Annars kör jag igång med Runda 1 direkt efter ditt OK.
