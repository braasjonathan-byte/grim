export interface ExerciseInfo {
  name: string;
  category: "styrka" | "kondition" | "rörlighet" | "core";
  muscleGroup: string;
}

/**
 * Mapping från svenska övningsnamn till engelska (och vice versa).
 * Används för att göra övningar sökbara på båda språken.
 * Övningar som redan har samma namn på båda språk (t.ex. "Hip Thrust", "Dips")
 * behöver inte finnas med här.
 */
export const exerciseTranslations: Record<string, string> = {
  // Bröst
  "Bänkpress": "Bench Press",
  "Incline Bänkpress": "Incline Bench Press",
  "Pausbänk": "Pause Bench Press",
  "Close-Grip Bänkpress": "Close-Grip Bench Press",
  "Hantlar Bänkpress": "Dumbbell Bench Press",
  "Hantlar Flyes": "Dumbbell Flyes",
  "Kabelflyes": "Cable Flyes",
  "Armhävningar": "Push-Ups",
  // Rygg
  "Marklyft": "Deadlift",
  "Rumänsk Marklyft": "Romanian Deadlift",
  "Sumo Marklyft": "Sumo Deadlift",
  "Rodd": "Row",
  "Skivstångsrodd": "Barbell Row",
  "Hantelrodd": "Dumbbell Row",
  "Kabelrodd": "Cable Row",
  "Latsdrag": "Lat Pulldown",
  "Chins": "Chin-Ups",
  // Ben
  "Knäböj": "Squat",
  "Frontböj": "Front Squat",
  "Pausböj": "Pause Squat",
  "Bulgarska Utfall": "Bulgarian Split Squat",
  "Enbensutfall": "Single-Leg Lunge",
  "Benpress": "Leg Press",
  "Bencurl": "Leg Curl",
  "Benextension": "Leg Extension",
  "Vadpress": "Calf Raise",
  "Steg-Ups": "Step-Ups",
  // Axlar
  "Axelpress": "Shoulder Press",
  "Militärpress": "Military Press",
  "Sidolyft": "Lateral Raise",
  "Framlyfning": "Front Raise",
  // Armar
  "Bicepscurl": "Bicep Curl",
  "Hammarcurl": "Hammer Curl",
  "Skallkross": "Skull Crusher",
  "Tricepspress": "Triceps Press",
  // Core
  "Planka": "Plank",
  "Kabeldrag": "Cable Crunch",
  "Hängande Benlyft": "Hanging Leg Raise",
  "Sidoplanka": "Side Plank",
  "Bålrotation": "Torso Rotation",
  // Kondition
  "Löpning": "Running",
  "Tröskellöpning": "Threshold Run",
  "Intervallträning": "Interval Training",
  "Långpass": "Long Run",
  "Cykling": "Cycling",
  "Roddmaskin": "Rowing Machine",
  "Simning": "Swimming",
  "Promenad": "Walk",
  "Trappmaskin": "Stairclimber",
  "Löpband (Life Fitness)": "Treadmill (Life Fitness)",
  "Löpband (Technogym)": "Treadmill (Technogym)",
  "Löpband (Precor)": "Treadmill (Precor)",
  "Löpband (Cybex)": "Treadmill (Cybex)",
  "Motionscykel (Life Fitness)": "Exercise Bike (Life Fitness)",
  "Motionscykel (Technogym)": "Exercise Bike (Technogym)",
  "Motionscykel (Precor)": "Exercise Bike (Precor)",
  // Rumpa
  "Rumänsk Marklyft Hantel": "Dumbbell Romanian Deadlift",
  "Stiff-Leg Marklyft": "Stiff-Leg Deadlift",
  "Single-Leg Rumänsk Marklyft": "Single-Leg Romanian Deadlift",
  "Step-Up med Knälyft": "Step-Up with Knee Raise",
  "Abduktionsmaskin": "Abduction Machine",
  "Kabelabduktion": "Cable Abduction",
  "Kickback Maskin": "Kickback Machine",
  "Benspark Bakåt": "Glute Kickback",
  // Rörlighet
  "Rörlighetspass": "Mobility Session",
  "Dynamisk Uppvärmning": "Dynamic Warm-Up",
};

// Bygg en omvänd lookup: engelska -> svenska
const reverseTranslations: Record<string, string> = Object.fromEntries(
  Object.entries(exerciseTranslations).map(([sv, en]) => [en.toLowerCase(), sv])
);

/** Returnerar engelska namnet om det finns, annars samma namn. */
export const getEnglishName = (swedishName: string): string =>
  exerciseTranslations[swedishName] ?? swedishName;

/** Returnerar svenska namnet om engelska namnet finns i mappningen. */
export const getSwedishName = (englishName: string): string =>
  reverseTranslations[englishName.toLowerCase()] ?? englishName;

export const exerciseLibrary: ExerciseInfo[] = [
  // Bröst
  { name: "Bänkpress", category: "styrka", muscleGroup: "Bröst" },
  { name: "Incline Bänkpress", category: "styrka", muscleGroup: "Bröst" },
  { name: "Pausbänk", category: "styrka", muscleGroup: "Bröst" },
  { name: "Close-Grip Bänkpress", category: "styrka", muscleGroup: "Bröst" },
  { name: "Hantlar Bänkpress", category: "styrka", muscleGroup: "Bröst" },
  { name: "Hantlar Flyes", category: "styrka", muscleGroup: "Bröst" },
  { name: "Kabelflyes", category: "styrka", muscleGroup: "Bröst" },
  { name: "Dips", category: "styrka", muscleGroup: "Bröst" },
  { name: "Armhävningar", category: "styrka", muscleGroup: "Bröst" },

  // Rygg
  { name: "Marklyft", category: "styrka", muscleGroup: "Rygg" },
  { name: "Rumänsk Marklyft", category: "styrka", muscleGroup: "Rygg" },
  { name: "Sumo Marklyft", category: "styrka", muscleGroup: "Rygg" },
  { name: "Rodd", category: "styrka", muscleGroup: "Rygg" },
  { name: "Skivstångsrodd", category: "styrka", muscleGroup: "Rygg" },
  { name: "Hantelrodd", category: "styrka", muscleGroup: "Rygg" },
  { name: "Kabelrodd", category: "styrka", muscleGroup: "Rygg" },
  { name: "Latsdrag", category: "styrka", muscleGroup: "Rygg" },
  { name: "Chins", category: "styrka", muscleGroup: "Rygg" },
  { name: "Pull-Ups", category: "styrka", muscleGroup: "Rygg" },
  { name: "Face Pulls", category: "styrka", muscleGroup: "Rygg" },
  { name: "Hyperextension", category: "styrka", muscleGroup: "Rygg" },

  // Ben
  { name: "Knäböj", category: "styrka", muscleGroup: "Ben" },
  { name: "Frontböj", category: "styrka", muscleGroup: "Ben" },
  { name: "Pausböj", category: "styrka", muscleGroup: "Ben" },
  { name: "Bulgarska Utfall", category: "styrka", muscleGroup: "Ben" },
  { name: "Enbensutfall", category: "styrka", muscleGroup: "Ben" },
  { name: "Benpress", category: "styrka", muscleGroup: "Ben" },
  { name: "Bencurl", category: "styrka", muscleGroup: "Ben" },
  { name: "Benextension", category: "styrka", muscleGroup: "Ben" },
  { name: "Vadpress", category: "styrka", muscleGroup: "Ben" },
  { name: "Hip Thrust", category: "styrka", muscleGroup: "Ben" },
  { name: "Goblet Squat", category: "styrka", muscleGroup: "Ben" },
  { name: "Box Squat", category: "styrka", muscleGroup: "Ben" },
  { name: "Steg-Ups", category: "styrka", muscleGroup: "Ben" },

  // Axlar
  { name: "Axelpress", category: "styrka", muscleGroup: "Axlar" },
  { name: "Militärpress", category: "styrka", muscleGroup: "Axlar" },
  { name: "Arnold Press", category: "styrka", muscleGroup: "Axlar" },
  { name: "Sidolyft", category: "styrka", muscleGroup: "Axlar" },
  { name: "Framlyfning", category: "styrka", muscleGroup: "Axlar" },
  { name: "Reverse Fly", category: "styrka", muscleGroup: "Axlar" },
  { name: "Upright Row", category: "styrka", muscleGroup: "Axlar" },
  { name: "Shrugs", category: "styrka", muscleGroup: "Axlar" },

  // Armar
  { name: "Bicepscurl", category: "styrka", muscleGroup: "Armar" },
  { name: "Hammarcurl", category: "styrka", muscleGroup: "Armar" },
  { name: "Skallkross", category: "styrka", muscleGroup: "Armar" },
  { name: "Tricepspress", category: "styrka", muscleGroup: "Armar" },
  { name: "Triceps Pushdown", category: "styrka", muscleGroup: "Armar" },
  { name: "Preacher Curl", category: "styrka", muscleGroup: "Armar" },
  { name: "Concentration Curl", category: "styrka", muscleGroup: "Armar" },

  // Core
  { name: "Planka", category: "core", muscleGroup: "Core" },
  { name: "Ab Wheel", category: "core", muscleGroup: "Core" },
  { name: "Kabeldrag", category: "core", muscleGroup: "Core" },
  { name: "Russian Twist", category: "core", muscleGroup: "Core" },
  { name: "Hängande Benlyft", category: "core", muscleGroup: "Core" },
  { name: "Dead Bug", category: "core", muscleGroup: "Core" },
  { name: "Sidoplanka", category: "core", muscleGroup: "Core" },
  { name: "Bålrotation", category: "core", muscleGroup: "Core" },
  { name: "Sit-Ups", category: "core", muscleGroup: "Core" },

  // Kondition
  { name: "Löpning", category: "kondition", muscleGroup: "Helkropp" },
  { name: "Tröskellöpning", category: "kondition", muscleGroup: "Helkropp" },
  { name: "Tröskellöpning – Intervaller", category: "kondition", muscleGroup: "Helkropp" },
  
  { name: "Löpning – Intervaller", category: "kondition", muscleGroup: "Helkropp" },
  { name: "Långpass", category: "kondition", muscleGroup: "Helkropp" },
  { name: "Långpass – Intervaller", category: "kondition", muscleGroup: "Helkropp" },
  { name: "Cykling", category: "kondition", muscleGroup: "Helkropp" },
  { name: "Cykling – Intervaller", category: "kondition", muscleGroup: "Helkropp" },
  { name: "Spinning", category: "kondition", muscleGroup: "Helkropp" },
  { name: "Spinning – Intervaller", category: "kondition", muscleGroup: "Helkropp" },
  { name: "Crosstrainer", category: "kondition", muscleGroup: "Helkropp" },
  { name: "Crosstrainer – Intervaller", category: "kondition", muscleGroup: "Helkropp" },
  { name: "Roddmaskin", category: "kondition", muscleGroup: "Helkropp" },
  { name: "Roddmaskin – Intervaller", category: "kondition", muscleGroup: "Helkropp" },
  { name: "SkiErg", category: "kondition", muscleGroup: "Helkropp" },
  { name: "SkiErg – Intervaller", category: "kondition", muscleGroup: "Helkropp" },
  { name: "Airbike", category: "kondition", muscleGroup: "Helkropp" },
  { name: "Airbike – Intervaller", category: "kondition", muscleGroup: "Helkropp" },
  { name: "Simning", category: "kondition", muscleGroup: "Helkropp" },
  { name: "Simning – Intervaller", category: "kondition", muscleGroup: "Helkropp" },
  { name: "Promenad", category: "kondition", muscleGroup: "Helkropp" },
  { name: "Promenad – Intervaller", category: "kondition", muscleGroup: "Helkropp" },
  { name: "Vandring", category: "kondition", muscleGroup: "Helkropp" },
  { name: "Vandring – Intervaller", category: "kondition", muscleGroup: "Helkropp" },
  { name: "Trappmaskin", category: "kondition", muscleGroup: "Helkropp" },
  { name: "Trappmaskin – Intervaller", category: "kondition", muscleGroup: "Helkropp" },
  { name: "Hopprep", category: "kondition", muscleGroup: "Helkropp" },
  { name: "Hopprep – Intervaller", category: "kondition", muscleGroup: "Helkropp" },
  { name: "Skidåkning", category: "kondition", muscleGroup: "Helkropp" },
  { name: "Skidåkning – Intervaller", category: "kondition", muscleGroup: "Helkropp" },
  { name: "Skridsko", category: "kondition", muscleGroup: "Helkropp" },
  { name: "Skridsko – Intervaller", category: "kondition", muscleGroup: "Helkropp" },
  { name: "Paddling/Kajak", category: "kondition", muscleGroup: "Helkropp" },
  { name: "Paddling/Kajak – Intervaller", category: "kondition", muscleGroup: "Helkropp" },


  // Rumpa
  { name: "Hip Thrust Maskin", category: "styrka", muscleGroup: "Rumpa" },
  { name: "Barbell Hip Thrust", category: "styrka", muscleGroup: "Rumpa" },
  { name: "Single-Leg Hip Thrust", category: "styrka", muscleGroup: "Rumpa" },
  { name: "Glute Bridge", category: "styrka", muscleGroup: "Rumpa" },
  { name: "Single-Leg Glute Bridge", category: "styrka", muscleGroup: "Rumpa" },
  { name: "Frog Pump", category: "styrka", muscleGroup: "Rumpa" },
  { name: "Cable Pull-Through", category: "styrka", muscleGroup: "Rumpa" },
  { name: "Cable Kickback", category: "styrka", muscleGroup: "Rumpa" },
  { name: "Donkey Kick", category: "styrka", muscleGroup: "Rumpa" },
  { name: "Fire Hydrant", category: "styrka", muscleGroup: "Rumpa" },
  { name: "Rumänsk Marklyft Hantel", category: "styrka", muscleGroup: "Rumpa" },
  { name: "Stiff-Leg Marklyft", category: "styrka", muscleGroup: "Rumpa" },
  { name: "Single-Leg Rumänsk Marklyft", category: "styrka", muscleGroup: "Rumpa" },
  { name: "Sumo Squat", category: "styrka", muscleGroup: "Rumpa" },
  { name: "Curtsy Lunge", category: "styrka", muscleGroup: "Rumpa" },
  { name: "Walking Lunge", category: "styrka", muscleGroup: "Rumpa" },
  { name: "Reverse Lunge", category: "styrka", muscleGroup: "Rumpa" },
  { name: "Lateral Lunge", category: "styrka", muscleGroup: "Rumpa" },
  { name: "Bulgarian Split Squat", category: "styrka", muscleGroup: "Rumpa" },
  { name: "Step-Up med Knälyft", category: "styrka", muscleGroup: "Rumpa" },
  { name: "Abduktionsmaskin", category: "styrka", muscleGroup: "Rumpa" },
  { name: "Kabelabduktion", category: "styrka", muscleGroup: "Rumpa" },
  { name: "Band Walk", category: "styrka", muscleGroup: "Rumpa" },
  { name: "Clamshell", category: "styrka", muscleGroup: "Rumpa" },
  { name: "Kickback Maskin", category: "styrka", muscleGroup: "Rumpa" },
  { name: "Good Morning", category: "styrka", muscleGroup: "Rumpa" },
  { name: "Benspark Bakåt", category: "styrka", muscleGroup: "Rumpa" },
  { name: "Smith Machine Hip Thrust", category: "styrka", muscleGroup: "Rumpa" },
  { name: "Glute Ham Raise", category: "styrka", muscleGroup: "Rumpa" },
  { name: "Pendlay Hip Extension", category: "styrka", muscleGroup: "Rumpa" },

  // Maskiner - Bröst
  { name: "Chest Press (Hammer Strength)", category: "styrka", muscleGroup: "Bröst" },
  { name: "Iso-Lateral Bench Press (Hammer Strength)", category: "styrka", muscleGroup: "Bröst" },
  { name: "Iso-Lateral Incline Press (Hammer Strength)", category: "styrka", muscleGroup: "Bröst" },
  { name: "Iso-Lateral Decline Press (Hammer Strength)", category: "styrka", muscleGroup: "Bröst" },
  { name: "Chest Press (Life Fitness)", category: "styrka", muscleGroup: "Bröst" },
  { name: "Incline Press (Life Fitness)", category: "styrka", muscleGroup: "Bröst" },
  { name: "Pec Fly (Life Fitness)", category: "styrka", muscleGroup: "Bröst" },
  { name: "Chest Press (Technogym)", category: "styrka", muscleGroup: "Bröst" },
  { name: "Incline Chest Press (Technogym)", category: "styrka", muscleGroup: "Bröst" },
  { name: "Pectoral Machine (Technogym)", category: "styrka", muscleGroup: "Bröst" },
  { name: "Chest Press (Precor)", category: "styrka", muscleGroup: "Bröst" },
  { name: "Pec Fly (Precor)", category: "styrka", muscleGroup: "Bröst" },
  { name: "Chest Press (Cybex)", category: "styrka", muscleGroup: "Bröst" },
  { name: "Incline Press (Cybex)", category: "styrka", muscleGroup: "Bröst" },

  // Maskiner - Rygg
  { name: "Iso-Lateral D.Y. Row (Hammer Strength)", category: "styrka", muscleGroup: "Rygg" },
  { name: "Iso-Lateral Row (Hammer Strength)", category: "styrka", muscleGroup: "Rygg" },
  { name: "Iso-Lateral Front Lat Pulldown (Hammer Strength)", category: "styrka", muscleGroup: "Rygg" },
  { name: "Iso-Lateral High Row (Hammer Strength)", category: "styrka", muscleGroup: "Rygg" },
  { name: "Iso-Lateral Low Row (Hammer Strength)", category: "styrka", muscleGroup: "Rygg" },
  { name: "Lat Pulldown (Life Fitness)", category: "styrka", muscleGroup: "Rygg" },
  { name: "Seated Row (Life Fitness)", category: "styrka", muscleGroup: "Rygg" },
  { name: "Lat Machine (Technogym)", category: "styrka", muscleGroup: "Rygg" },
  { name: "Low Row (Technogym)", category: "styrka", muscleGroup: "Rygg" },
  { name: "Pulldown (Technogym)", category: "styrka", muscleGroup: "Rygg" },
  { name: "Lat Pulldown (Precor)", category: "styrka", muscleGroup: "Rygg" },
  { name: "Seated Row (Precor)", category: "styrka", muscleGroup: "Rygg" },
  { name: "Lat Pulldown (Cybex)", category: "styrka", muscleGroup: "Rygg" },
  { name: "Row (Cybex)", category: "styrka", muscleGroup: "Rygg" },

  // Maskiner - Ben
  { name: "Leg Press (Hammer Strength)", category: "styrka", muscleGroup: "Ben" },
  { name: "Iso-Lateral Leg Extension (Hammer Strength)", category: "styrka", muscleGroup: "Ben" },
  { name: "Iso-Lateral Leg Curl (Hammer Strength)", category: "styrka", muscleGroup: "Ben" },
  { name: "V-Squat (Hammer Strength)", category: "styrka", muscleGroup: "Ben" },
  { name: "Hack Squat (Hammer Strength)", category: "styrka", muscleGroup: "Ben" },
  { name: "Leg Press (Life Fitness)", category: "styrka", muscleGroup: "Ben" },
  { name: "Leg Extension (Life Fitness)", category: "styrka", muscleGroup: "Ben" },
  { name: "Leg Curl (Life Fitness)", category: "styrka", muscleGroup: "Ben" },
  { name: "Calf Raise (Life Fitness)", category: "styrka", muscleGroup: "Ben" },
  { name: "Leg Press (Technogym)", category: "styrka", muscleGroup: "Ben" },
  { name: "Leg Extension (Technogym)", category: "styrka", muscleGroup: "Ben" },
  { name: "Leg Curl (Technogym)", category: "styrka", muscleGroup: "Ben" },
  { name: "Hack Squat (Technogym)", category: "styrka", muscleGroup: "Ben" },
  { name: "Leg Press (Precor)", category: "styrka", muscleGroup: "Ben" },
  { name: "Leg Extension (Precor)", category: "styrka", muscleGroup: "Ben" },
  { name: "Leg Curl (Precor)", category: "styrka", muscleGroup: "Ben" },
  { name: "Leg Press (Cybex)", category: "styrka", muscleGroup: "Ben" },
  { name: "Leg Extension (Cybex)", category: "styrka", muscleGroup: "Ben" },
  { name: "Leg Curl (Cybex)", category: "styrka", muscleGroup: "Ben" },

  // Maskiner - Axlar
  { name: "Shoulder Press (Hammer Strength)", category: "styrka", muscleGroup: "Axlar" },
  { name: "Iso-Lateral Shoulder Press (Hammer Strength)", category: "styrka", muscleGroup: "Axlar" },
  { name: "Lateral Raise (Hammer Strength)", category: "styrka", muscleGroup: "Axlar" },
  { name: "Shoulder Press (Life Fitness)", category: "styrka", muscleGroup: "Axlar" },
  { name: "Lateral Raise (Life Fitness)", category: "styrka", muscleGroup: "Axlar" },
  { name: "Shoulder Press (Technogym)", category: "styrka", muscleGroup: "Axlar" },
  { name: "Lateral Raise (Technogym)", category: "styrka", muscleGroup: "Axlar" },
  { name: "Shoulder Press (Precor)", category: "styrka", muscleGroup: "Axlar" },
  { name: "Shoulder Press (Cybex)", category: "styrka", muscleGroup: "Axlar" },

  // Maskiner - Armar
  { name: "Bicep Curl (Hammer Strength)", category: "styrka", muscleGroup: "Armar" },
  { name: "Tricep Extension (Hammer Strength)", category: "styrka", muscleGroup: "Armar" },
  { name: "Bicep Curl (Life Fitness)", category: "styrka", muscleGroup: "Armar" },
  { name: "Tricep Extension (Life Fitness)", category: "styrka", muscleGroup: "Armar" },
  { name: "Arm Curl (Technogym)", category: "styrka", muscleGroup: "Armar" },
  { name: "Tricep Press (Technogym)", category: "styrka", muscleGroup: "Armar" },
  { name: "Bicep Curl (Precor)", category: "styrka", muscleGroup: "Armar" },
  { name: "Tricep Dip (Precor)", category: "styrka", muscleGroup: "Armar" },
  { name: "Arm Curl (Cybex)", category: "styrka", muscleGroup: "Armar" },
  { name: "Tricep Extension (Cybex)", category: "styrka", muscleGroup: "Armar" },

  // Maskiner - Rumpa
  { name: "Glute Drive (Hammer Strength)", category: "styrka", muscleGroup: "Rumpa" },
  { name: "Hip Abduction (Life Fitness)", category: "styrka", muscleGroup: "Rumpa" },
  { name: "Hip Adduction (Life Fitness)", category: "styrka", muscleGroup: "Rumpa" },
  { name: "Glute (Technogym)", category: "styrka", muscleGroup: "Rumpa" },
  { name: "Hip Abduction (Technogym)", category: "styrka", muscleGroup: "Rumpa" },
  { name: "Hip Adduction (Technogym)", category: "styrka", muscleGroup: "Rumpa" },
  { name: "Glute Kickback (Precor)", category: "styrka", muscleGroup: "Rumpa" },
  { name: "Hip Abduction (Cybex)", category: "styrka", muscleGroup: "Rumpa" },

  // Maskiner - Core
  { name: "Ab Crunch (Hammer Strength)", category: "core", muscleGroup: "Core" },
  { name: "Torso Rotation (Life Fitness)", category: "core", muscleGroup: "Core" },
  { name: "Ab Crunch (Life Fitness)", category: "core", muscleGroup: "Core" },
  { name: "Rotary Torso (Technogym)", category: "core", muscleGroup: "Core" },
  { name: "Crunch (Technogym)", category: "core", muscleGroup: "Core" },
  { name: "Ab Crunch (Precor)", category: "core", muscleGroup: "Core" },
  { name: "Torso Rotation (Cybex)", category: "core", muscleGroup: "Core" },

  // Maskiner - Kondition
  { name: "Löpband (Life Fitness)", category: "kondition", muscleGroup: "Helkropp" },
  { name: "Crosstrainer (Life Fitness)", category: "kondition", muscleGroup: "Helkropp" },
  { name: "Stairclimber (Life Fitness)", category: "kondition", muscleGroup: "Helkropp" },
  { name: "Motionscykel (Life Fitness)", category: "kondition", muscleGroup: "Helkropp" },
  { name: "Löpband (Technogym)", category: "kondition", muscleGroup: "Helkropp" },
  { name: "Crosstrainer (Technogym)", category: "kondition", muscleGroup: "Helkropp" },
  { name: "Skillmill (Technogym)", category: "kondition", muscleGroup: "Helkropp" },
  { name: "Motionscykel (Technogym)", category: "kondition", muscleGroup: "Helkropp" },
  { name: "Löpband (Precor)", category: "kondition", muscleGroup: "Helkropp" },
  { name: "Crosstrainer (Precor)", category: "kondition", muscleGroup: "Helkropp" },
  { name: "Motionscykel (Precor)", category: "kondition", muscleGroup: "Helkropp" },
  { name: "Löpband (Cybex)", category: "kondition", muscleGroup: "Helkropp" },
  { name: "Arc Trainer (Cybex)", category: "kondition", muscleGroup: "Helkropp" },

  // Rörlighet
  { name: "Stretching", category: "rörlighet", muscleGroup: "Helkropp" },
  { name: "Yoga", category: "rörlighet", muscleGroup: "Helkropp" },
  { name: "Foam Rolling", category: "rörlighet", muscleGroup: "Helkropp" },
  { name: "Rörlighetspass", category: "rörlighet", muscleGroup: "Helkropp" },
  { name: "Dynamisk Uppvärmning", category: "rörlighet", muscleGroup: "Helkropp" },
];

export const getExercisesByCategory = (category: string) =>
  exerciseLibrary.filter((e) => e.category === category);

export const getExercisesByMuscle = (muscle: string) =>
  exerciseLibrary.filter((e) => e.muscleGroup === muscle);

export const searchExercises = (query: string) => {
  const q = query.toLowerCase().trim();
  if (!q) return exerciseLibrary;
  return exerciseLibrary.filter((e) => {
    const english = (exerciseTranslations[e.name] ?? "").toLowerCase();
    return (
      e.name.toLowerCase().includes(q) ||
      english.includes(q) ||
      e.category.toLowerCase().includes(q) ||
      e.muscleGroup.toLowerCase().includes(q)
    );
  });
};

export const muscleGroups = [
  "Bröst", "Rygg", "Ben", "Rumpa", "Axlar", "Armar", "Underarmar", "Core", "Helkropp"
];

/** Submuscle / sub-region options per main muscle group. Empty array = no submuscles. */
export const submusclesByGroup: Record<string, string[]> = {
  "Bröst": ["Övre", "Mellan", "Nedre"],
  "Rygg": ["Lats", "Övre rygg", "Nedre rygg", "Trapezius"],
  "Ben": ["Quadriceps", "Hamstrings", "Vader", "Adduktorer"],
  "Rumpa": ["Gluteus Maximus", "Gluteus Medius"],
  "Axlar": ["Främre delt", "Sidodelt", "Bakre delt"],
  "Armar": ["Biceps", "Triceps"],
  "Underarmar": [],
  "Core": ["Magmuskler", "Sneda magmuskler", "Nedre rygg"],
  "Helkropp": [],
};

export const categories = ["styrka", "kondition", "rörlighet", "core"] as const;
