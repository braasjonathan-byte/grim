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
