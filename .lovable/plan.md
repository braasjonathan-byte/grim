# Kodgranskning: prioriterade fynd

Ren utredning. Inga kodändringar gjorda. Alla påståenden nedan är verifierade genom filläsning, sökning i koden eller databasfrågor under granskningen.

## Prioriterad lista (13 fynd)

### Säkerhet / behörighet

**1. Testkonto har redigeringsrättigheter i produktion — `src/components/WorkoutView.tsx:1788`**
`EXERCISE_EDITOR_IDS = ["4ddd1300-…"] // test2`. En databasfråga bekräftar att det UUID:t tillhör profilen **"Test2"** med rollen `member`. Ett testkonto kan alltså redigera övningsbeskrivningar för alla användare. Ser ut som kvarglömd testkod.

**2. Privata inläggs bilder, kommentarer och likes läcker — databasfunktionen `can_view_post()`**
Funktionen kontrollerar bara att inlägget *existerar*, inte `visibility`, vänstatus, blockering eller gruppmedlemskap. SELECT-policyn på `social_post_images`, `social_post_comments` och `social_post_likes` bygger på den, så vilken inloggad användare som helst kan läsa innehåll kopplat till inlägg de inte får se. (Bekräftat fynd från säkerhetsskannern.)

**3. Medlemslistor i eventgrupper är öppna för alla inloggade — tabellen `event_group_members`**
Policyn "Members can read group members" använder `USING (true)`, så vem som helst kan lista medlemmarna i varje eventgrupp. Bör begränsas till egna grupper.

### Dataförlust / tyst felhantering

**4. Återställning av arkiverat schema kan misslyckas halvvägs — `src/components/ArchivedPlans.tsx:59-118`**
Flödet raderar `workout_plans` + `workout_completions` och infogar arkiverade rader igen — inget av stegen kontrollerar `error`. Vid ett misslyckat mellansteg visas ändå `toast.success("Schemat har återställts!")` följt av `window.location.reload()`. Värsta möjliga utfall: raderat schema, ofullständig återställning, och användaren får "allt gick bra".

**5. AI-assistentens snapshot-återställning har samma mönster — `src/components/AIChatButton.tsx:171-196`**
Åtta `delete`/`insert` mot `workout_plans`, `workout_completions`, `pr_stars`, `pr_goals` utan en enda felkontroll.

**6. Chattmeddelanden kan försvinna tyst — `src/components/ChatConversation.tsx:133-138`**
Själva `insert` av meddelandet är okontrollerad; inmatningsfältet töms oavsett. Ironiskt nog kontrolleras felet på push-notisen tre rader längre ned. Samma sak i `doImport` (rad 196-224), som alltid visar "Passet har lagts till i din plan!".

**7. Radering av grupp/event bekräftas oavsett utfall — `src/components/EventGroupPage.tsx:262-269`, `src/components/EventCountdown.tsx:214-216, 283-285`**
Kaskadraderingar och sparningar utan felkontroll, alltid följt av en success-toast.

**8. Upplåsta achievements och gruppmedlemmar sparas utan felkontroll — `src/lib/achievements.ts:189,217`, `src/lib/chatGroups.ts:34,67,81`**
En achievement kan visas en gång och sedan försvinna vid omladdning; en chattgrupp kan skapas utan alla deltagare — utan spår i loggen.

Omfattning: ~234 skrivanrop (`insert`/`update`/`delete`/`upsert`) i `src/`, varav en klar minoritet kontrollerar `error`. Tre parallella konventioner lever sida vid sida: "kontrollera + toast", "kontrollera + console.error" och "kontrollera inte alls".

### Kvarglömd debug- och testkod

**9. Debug-utskrifter i produktionsflöden — `src/components/WorkoutView.tsx:1792, 4522-4534`**
`console.log("[WorkoutView] authUser:", …)` loggar användarens auth-ID, och raderingsflödet dumpar hela passets innehåll med `JSON.stringify`. Även `src/hooks/useNativePush.ts:65` loggar hela push-token, och `src/components/InAppBrowserDialog.tsx:13` loggar user agent.

**10. Hårdkodade identiteter — `src/components/AIChatButton.tsx:7`, `src/components/ChatView.tsx:17`, `src/components/HonoraryBadge.tsx:23`, `src/pages/Index.tsx:81`, `supabase/functions/check-subscription/index.ts:10`**
En avatar-URL med inbäddat användar-UUID, magiska sträng-ID:n (`"grim-support"`) som jämförs mot riktiga `user_id`, och smeknamnslistor (`"grim"`, `"jonne"`, `"wilma02"`) som styr behörighet på flera olika ställen istället för via `user_roles`. Skör och svår att ändra.

### Duplicerad logik och inkonsekvens

**11. Datumformatering återuppfunnen på 9 ställen**
`src/lib/dateUtils.ts` finns och är skriven just för att undvika en tidszonsbugg, men `${y}-${mm}-${dd}` byggs manuellt i `ArchivedPlans.tsx:111`, `FriendsView.tsx:509`, `TriathlonWizard.tsx:29,33`, `SchemaBuilder.tsx:235`, `TrainingCalendar.tsx:253,286`, `PlanCalibrationDialog.tsx:20`, `WorkoutView.tsx:1242` och `usePushNotifications.ts:10`. Varje kopia riskerar återinföra buggen.

**12. Profilhämtning kopierad till 10 ställen**
Samma `.from("profiles").select("user_id, nickname, avatar_url…")` upprepas i `EventGroupPage`, `GroupChatConversation`, `CreateGroupDialog`, `FriendsView`, `ChatView` (två gånger), `NotificationsBell`, `WorkoutPostThread` (två gånger) och `AdminUserList`. En delad `fetchProfiles`-hjälpare skulle ersätta alla.

**13. `WorkoutView.tsx` är 11 046 rader med 70 `as any`-casts**
Den är i särklass största filen i projektet (näst största egna filen är 1 768 rader). Storleken i sig är den underliggande orsaken till flera av buggarna vi redan jagat i den, och `as any`-casterna släcker typkontrollen just där logiken är som mest komplex.

## Vad jag inte hann verifiera

- Om `EXERCISE_EDITOR_IDS` är avsiktlig betatestare-lista eller ren kvarglömd testkod — kommentaren `// test2` och att kontot heter "Test2" talar för det senare, men bara du kan bekräfta.
- Oanvända *namngivna exporter* inuti filer som i övrigt används (kräver ts-prune/knip). Inga helt oanvända filer hittades.
- Om `formatDurationMin` (`lib/workoutSummary.ts:182`) och `formatPaceDisplay` (`lib/cardioUnits.ts:128`) duplicerar samma mm:ss-matematik.

## Förslag på åtgärdsordning

Om du vill gå vidare föreslår jag tre separata omgångar, i den här ordningen:

1. **Säkerhet** (fynd 1-3) — ta bort testkontots rättigheter, skärp `can_view_post()` och policyn på `event_group_members`. Kräver en databasmigrering.
2. **Dataförlust** (fynd 4-8) — felkontroll + toast på de destruktiva flerstegsflödena först, därefter en genomgång av övriga skrivanrop.
3. **Städning** (fynd 9-12) — ta bort debug-loggar, centralisera datum- och profilhämtning, ersätt hårdkodade identiteter med rollbaserade kontroller.

Fynd 13 (uppdelning av `WorkoutView.tsx`) är ett större refaktoreringsprojekt och bör tas separat, inte i samma svep.

Säg till vilka punkter du vill att jag åtgärdar, så gör jag en konkret genomförandeplan för just dem.
