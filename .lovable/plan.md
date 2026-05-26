# Kostloggning

Stor ny funktion – jag delar upp i tydliga byggblock. Bekräfta så bygger jag allt i ordning.

## Översikt
- Ny flik **Kost** i footern, direkt till höger om **Träning**
- Layout liknar träningssidan: ett "kort" per loggad dag
- Fyra makroringar (kcal/protein/fett/kolhydrater) som visar % av dagsmål
- Importerar Livsmedelsverkets databas (2 577 livsmedel) som global tabell

## Databas (nya tabeller)

**`foods`** – global livsmedelslista (read-only för users, admin kan editera)
- name, food_number, group, kcal, protein_g, fat_g, carbs_g, fiber_g per 100 g
- Seedas från excel-filen via migration

**`custom_foods`** – användarens egna livsmedel (samma fält som foods)

**`recipes`** – recept
- user_id, name, servings, instructions, visibility (private/public), kcal/protein/fett/kolhydrater per portion (beräknas)
- Publika recept syns för alla, likt publika saved_workouts

**`recipe_ingredients`** – kopplar food/custom_food till recept med mängd och enhet

**`nutrition_goals`** – användarens dagsmål
- user_id, daily_kcal, protein_g, fat_g, carbs_g, activity_level, goal_type (styrka/bibehålla/uthållighet/eget)

**`meal_logs`** – loggade måltider
- user_id, log_date, meal_type (frukost/lunch/middag/mellanmål), food_id/custom_food_id/recipe_id, amount, unit, beräknade makros (snapshot)

## UI

**Huvudvy (`NutritionView`)**
- Veckokarusell + dagskort (liknar `WorkoutView`)
- Överst på dagen: 4 ringar (SVG) – kcal/protein/fett/kolhydrater i procent mot mål
- Lista med dagens måltider grupperade per måltidstyp
- "+ Lägg till" → bottom sheet med val: Livsmedel / Recept / Eget livsmedel

**Livsmedelsväljare (`FoodPickerDialog`)**
- Sökbart, liknar `ExercisePickerDialog`
- Visar livsmedel + recept (egna och publika)
- Vid val → enhet/mängd-dialog (gram, portion, st) → räknar makros

**Receptbyggare (`RecipeEditor`)**
- Namn, portioner, instruktioner
- Lägg till ingredienser via samma `FoodPickerDialog`
- Live-beräkning av makros per portion
- "Dela publikt"-toggle

**Måluppsättning (`NutritionGoalsDialog`)**
- Om ålder/vikt saknas i `profiles`: be om dem och spara
- Välj aktivitetsnivå (stillasittande → mycket aktiv)
- Välj mål: Bli starkare / Bibehålla vikt / Optimera uthållighet / Egna makros
- Beräknar BMR (Mifflin-St Jeor) × aktivitet → kcal, fördelar protein/fett/kolhydrater enligt mål
- Användaren kan justera siffrorna manuellt

## Tekniska detaljer
- Återanvänder design tokens, Permanent Marker headers, flat/square corners (per memory)
- Autosave-mönster (800ms refs)
- RLS: egna meal_logs/custom_foods/goals; publika recept synliga för alla
- Footer: lägger till knapp i samma komponent som "Träning"

## Filer som skapas
- `supabase/migrations/...sql` – tabeller + RLS + seed av Livsmedelsverket
- `src/components/NutritionView.tsx`
- `src/components/FoodPickerDialog.tsx`
- `src/components/RecipeEditor.tsx`
- `src/components/NutritionGoalsDialog.tsx`
- `src/components/MacroRings.tsx`
- `src/lib/nutritionCalc.ts` (BMR, makrofördelning)
- Edit: `src/pages/Index.tsx` (footer + route)

## Att bekräfta innan jag börjar
1. **Måltidstyper**: Frukost / Lunch / Middag / Mellanmål – ok, eller vill du ha andra?
2. **Enheter**: gram, st, dl, msk, tsk, portion – ok som standard?
3. **Recept-delning**: publika recept syns för alla användare (som publika saved_workouts) – ok?

Säg bara "kör" så bygger jag allt, eller justera ovanstående punkter.
