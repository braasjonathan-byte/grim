# Plan: Sök i planväljare, gruppchatter & rundtur

## 1. Sök i planväljare (PlanPicker)
- Lägg till ett sökfält överst i `PlanPicker.tsx`.
- Filtrera planlistan live medan man skriver (case-insensitive på `name`).
- Inga taggar/filter, ingen sökknapp – resultat uppdateras direkt.

## 2. Gruppchatter

### Datamodell (migration)
- Ny tabell `chat_groups`: `id`, `name`, `created_by`, `event_group_id` (nullable, för event-grupper), `created_at`.
- Ny tabell `chat_group_members`: `group_id`, `user_id`, `joined_at`, `role` (member/admin).
- Utöka `chat_messages` med `group_id` (nullable) – när satt är meddelandet ett gruppmeddelande och `receiver_id` ignoreras.
- RLS:
  - Medlemmar kan läsa grupp + medlemmar + meddelanden.
  - Skaparen och admins kan lägga till/ta bort medlemmar.
  - Medlemmar kan skicka meddelanden till grupper de tillhör.
- Realtime aktiveras för `chat_messages` (om inte redan).
- För event-grupper: när användare öppnar chatt på en `event_group` skapas (om saknas) en `chat_groups`-rad kopplad via `event_group_id` och alla `event_group_members` läggs till automatiskt (via edge function eller trigger).

### UI
- I chatt-vyn: ny "Skapa grupp"-knapp → dialog där man namnger gruppen och väljer vänner (multi-select).
- Grupplistan visas tillsammans med 1-1 chattar, badge för olästa.
- Gruppchatt-vy: visar avsändarens nickname per meddelande, "lägg till medlem" och "lämna grupp" i en meny.
- Event-grupper får automatiskt en "Öppna chatt"-knapp.

## 3. Rundtur (onboarding tour)

### Bibliotek
- Använd `driver.js` (lättviktigt, fungerar bra med React + portals, square design passar GRIM).

### Datamodell
- Ny kolumn `profiles.tour_completed boolean default false`.
- Ny kolumn `profiles.tour_prompted boolean default false` (så vi inte frågar igen om de sa nej).

### Flöde
- Vid första inlogg efter feature-release: dialog "Vill du ha en rundtur?" med val:
  - **Kort rundtur** (~5 steg): bottennav + dagens pass + plan + sociala + profil.
  - **Lång rundtur** (~12 steg): ovanstående + skapa övning, redigera vikter, kalender, vänner, gruppchatt, butik, hjälp.
  - **Hoppa över**.
- Vald variant körs via `driver.js` med pilar och svenska beskrivningar.
- `tour_prompted` sätts oavsett val; `tour_completed` när man kör klart.
- Hjälpmenyn får två val: "Kort rundtur" och "Lång rundtur" som triggar samma flöden.

### Implementation
- Ny fil `src/lib/tour.ts` med stegdefinitioner (kort + lång).
- Ny komponent `<TourPrompt />` som mountas i app-shell och kollar `tour_prompted`.
- `data-tour="..."` attribut läggs på relevanta element (bottennav-knappar, "Skapa övning", "Vänner" osv).
- Hjälpmenyn (befintlig) får en sektion med två rundtursknappar.

## Tekniska detaljer
- driver.js installeras med `bun add driver.js`.
- Stilar för driver.js anpassas till GRIM-temat (square, primärfärg, Permanent Marker).
- Migration körs först, sedan UI/kod.

## Ordning
1. Migration (chat_groups, chat_group_members, chat_messages.group_id, profiles.tour_*).
2. PlanPicker-sök.
3. Gruppchatt UI + edge function/trigger för event-grupper.
4. Rundtur (bibliotek, steg, prompt, hjälpmeny).