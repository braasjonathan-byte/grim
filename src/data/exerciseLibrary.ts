export interface ExerciseInfo {
  name: string;
  category: "styrka" | "kondition" | "rörlighet" | "core";
  muscleGroup: string;
}

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
  { name: "Intervallträning", category: "kondition", muscleGroup: "Helkropp" },
  { name: "Långpass", category: "kondition", muscleGroup: "Helkropp" },
  { name: "Cykling", category: "kondition", muscleGroup: "Helkropp" },
  { name: "Crosstrainer", category: "kondition", muscleGroup: "Helkropp" },
  { name: "Roddmaskin", category: "kondition", muscleGroup: "Helkropp" },
  { name: "Simning", category: "kondition", muscleGroup: "Helkropp" },
  { name: "Promenad", category: "kondition", muscleGroup: "Helkropp" },
  { name: "Trappmaskin", category: "kondition", muscleGroup: "Helkropp" },

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
  const q = query.toLowerCase();
  return exerciseLibrary.filter(
    (e) =>
      e.name.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q) ||
      e.muscleGroup.toLowerCase().includes(q)
  );
};

export const muscleGroups = [
  "Bröst", "Rygg", "Ben", "Rumpa", "Axlar", "Armar", "Underarmar", "Core", "Helkropp"
];

export const categories = ["styrka", "kondition", "rörlighet", "core"] as const;
