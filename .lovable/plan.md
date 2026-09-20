# Slutför Health Connect-kopplingen

## Mål
Göra hela kedjan från Samsung Health via Health Connect till Grim robust: appen ska kunna visas i Health Connect, begära rätt åtkomst, läsa data och spara/importera den begripligt.

## Problem som redan är bekräftade
- Health Connects samtyckesaktivitet försöker läsa Android-strängen `privacy_policy_url`, men Grim definierar inte den. När användaren öppnar integritetslänken från Health Connect kan aktiviteten därför krascha.
- Den publika sidan `https://grim.lovable.app/privacy` finns och svarar, men Android-bygget är inte kopplat till den.
- Installerade `capacitor-health` stöder steg, kalorier, distans, puls och pass, men saknar helt stöd för sömn. Att bara lägga `READ_SLEEP` i manifestet skulle därför inte räcka.
- Dataflödet för steg/kalorier och pass finns, men behörighetsstatusen är för grov: grundbehörigheter kan visas som “ansluten” även om pass eller puls saknas.
- Pluginets Gradle-fil är kompatibel med projektets Android-versioner just nu, men ändringen ligger i installerade paketet och behöver göras reproducerbar i alla rena byggen.

## Genomförande
1. **Android och integritet**
   - Lägg till `privacy_policy_url` med den publika Grim-adressen i Android-resurserna.
   - Lägg till `READ_SLEEP` i manifestet och manifest-patchningen.
   - Utöka Android-verifieringen så bygget stoppas om pluginregistrering, hälsobehörigheter, samtyckesaktivitet eller integritetsadress saknas.

2. **Reproducerbar plugin-patch**
   - Skapa ett idempotent byggskript för `capacitor-health` som säkrar AGP/SDK/JVM-kompatibilitet och kompletterar Android-pluginet med sömnbehörighet och sömnhämtning.
   - Kör skriptet i samtliga aktuella Android-byggflöden före verifiering/synkning.

3. **Behörigheter och diagnostik i Grim**
   - Separera status för aktivitet (steg/kalorier/distans), pass, puls och sömn.
   - Visa exakt vad som saknas samt direktknappar för Health Connect eller installation på äldre Android.
   - Begär alla funktioner Grim faktiskt läser och återkontrollera resultatet efter samtycke.

4. **Datahämtning och lagring**
   - Läs steg, aktiva kalorier och sömntid per dag.
   - Läs genomförda pass med distans, kalorier, steg och puls; behåll dubblettskyddet och importen till träningsloggen.
   - Spara dagens sömntid tillsammans med daglig hälsodata och visa den där hälsosammanfattningen används.

5. **Integritetspolicy**
   - Förtydliga att Grim, efter uttryckligt samtycke, läser steg, kalorier, distans, puls, sömn och träningspass från Health Connect/Apple Health, varför de används och hur åtkomsten återkallas.

6. **Verifiering**
   - Lägg tester för behörighetstolkning och mappning av hälsodata.
   - Kör Android-pluginverifiering, TypeScript-kontroll och tester samt kontrollera senaste appbygget.

## Testgräns
Webbförhandsvisningen kan verifiera gränssnitt, sparad data och importlogik. Själva Health Connect-dialogen och verklig Samsung Health-data kan endast sluttestas i en ny installerad Android-build på en fysisk telefon där Samsung Health skriver till Health Connect.
