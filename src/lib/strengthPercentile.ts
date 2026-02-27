/**
 * Estimates the percentage of the global population that can lift a given weight
 * for common exercises, based on gender.
 *
 * Uses approximate normal-distribution models based on population-level data
 * (not gym-goers — general population including untrained individuals).
 *
 * Returns a string like "Top 5%" or "Starkare än 92% av alla"
 */

// Mean and SD (kg) for general population (adults, including untrained)
// Sources: approximate aggregates from strength standards research
interface ExerciseStats {
  maleMean: number;
  maleSD: number;
  femaleMean: number;
  femaleSD: number;
}

const exerciseStats: Record<string, ExerciseStats> = {
  // Upper body push
  "bänkpress": { maleMean: 50, maleSD: 25, femaleMean: 25, femaleSD: 12 },
  "bench press": { maleMean: 50, maleSD: 25, femaleMean: 25, femaleSD: 12 },
  "incline bänkpress": { maleMean: 45, maleSD: 22, femaleMean: 22, femaleSD: 11 },
  "close grip bänkpress": { maleMean: 45, maleSD: 22, femaleMean: 22, femaleSD: 11 },
  "hantelpress": { maleMean: 22, maleSD: 11, femaleMean: 10, femaleSD: 5 },
  "axelpress": { maleMean: 35, maleSD: 17, femaleMean: 18, femaleSD: 9 },
  "militärpress": { maleMean: 35, maleSD: 17, femaleMean: 18, femaleSD: 9 },
  "overhead press": { maleMean: 35, maleSD: 17, femaleMean: 18, femaleSD: 9 },
  "dips": { maleMean: 20, maleSD: 15, femaleMean: 5, femaleSD: 8 },

  // Lower body
  "knäböj": { maleMean: 70, maleSD: 35, femaleMean: 40, femaleSD: 20 },
  "squat": { maleMean: 70, maleSD: 35, femaleMean: 40, femaleSD: 20 },
  "front squat": { maleMean: 55, maleSD: 28, femaleMean: 35, femaleSD: 17 },
  "benpress": { maleMean: 100, maleSD: 50, femaleMean: 60, femaleSD: 30 },
  "leg press": { maleMean: 100, maleSD: 50, femaleMean: 60, femaleSD: 30 },
  "rumänsk marklyft": { maleMean: 60, maleSD: 30, femaleMean: 35, femaleSD: 17 },
  "bulgarsk split squat": { maleMean: 30, maleSD: 15, femaleMean: 18, femaleSD: 9 },
  "utfall": { maleMean: 25, maleSD: 13, femaleMean: 15, femaleSD: 8 },
  "hip thrust": { maleMean: 70, maleSD: 35, femaleMean: 50, femaleSD: 25 },
  "benspark": { maleMean: 50, maleSD: 25, femaleMean: 30, femaleSD: 15 },
  "bencurl": { maleMean: 35, maleSD: 18, femaleMean: 20, femaleSD: 10 },
  "leg curl": { maleMean: 35, maleSD: 18, femaleMean: 20, femaleSD: 10 },
  "leg extension": { maleMean: 50, maleSD: 25, femaleMean: 30, femaleSD: 15 },

  // Deadlift variants
  "marklyft": { maleMean: 80, maleSD: 40, femaleMean: 45, femaleSD: 22 },
  "deadlift": { maleMean: 80, maleSD: 40, femaleMean: 45, femaleSD: 22 },
  "sumo marklyft": { maleMean: 80, maleSD: 40, femaleMean: 45, femaleSD: 22 },

  // Back
  "rodd": { maleMean: 40, maleSD: 20, femaleMean: 22, femaleSD: 11 },
  "skivstångsrodd": { maleMean: 45, maleSD: 22, femaleMean: 25, femaleSD: 12 },
  "hantelrodd": { maleMean: 22, maleSD: 11, femaleMean: 12, femaleSD: 6 },
  "latsdrag": { maleMean: 45, maleSD: 22, femaleMean: 25, femaleSD: 12 },
  "lat pulldown": { maleMean: 45, maleSD: 22, femaleMean: 25, femaleSD: 12 },
  "chins": { maleMean: 15, maleSD: 15, femaleMean: 3, femaleSD: 8 },
  "pullups": { maleMean: 15, maleSD: 15, femaleMean: 3, femaleSD: 8 },
  "facepull": { maleMean: 20, maleSD: 10, femaleMean: 10, femaleSD: 5 },

  // Arms
  "bicepscurl": { maleMean: 18, maleSD: 9, femaleMean: 8, femaleSD: 4 },
  "curl": { maleMean: 18, maleSD: 9, femaleMean: 8, femaleSD: 4 },
  "hammarcurl": { maleMean: 18, maleSD: 9, femaleMean: 8, femaleSD: 4 },
  "triceps pushdown": { maleMean: 22, maleSD: 11, femaleMean: 10, femaleSD: 5 },
  "tricepspress": { maleMean: 22, maleSD: 11, femaleMean: 10, femaleSD: 5 },
  "skullcrusher": { maleMean: 20, maleSD: 10, femaleMean: 10, femaleSD: 5 },

  // Shoulders / misc
  "sidolyft": { maleMean: 8, maleSD: 4, femaleMean: 4, femaleSD: 2 },
  "lateral raise": { maleMean: 8, maleSD: 4, femaleMean: 4, femaleSD: 2 },
  "framlift": { maleMean: 10, maleSD: 5, femaleMean: 5, femaleSD: 3 },
  "shrugs": { maleMean: 40, maleSD: 20, femaleMean: 20, femaleSD: 10 },
};

/**
 * Standard normal CDF approximation (Abramowitz & Stegun)
 */
function normalCDF(z: number): number {
  if (z < -6) return 0;
  if (z > 6) return 1;
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + p * x);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

function findStats(exerciseName: string): ExerciseStats | null {
  const lower = exerciseName.toLowerCase().trim();
  
  // Direct match
  if (exerciseStats[lower]) return exerciseStats[lower];
  
  // Partial match
  for (const [key, stats] of Object.entries(exerciseStats)) {
    if (lower.includes(key) || key.includes(lower)) return stats;
  }
  
  return null;
}

export interface StrengthPercentile {
  percentile: number; // 0-100, percentage of people you're stronger than
  emoji: string;
  description: string;
}

export function getStrengthPercentile(
  exerciseName: string,
  weightKg: number,
  gender: string | null
): StrengthPercentile | null {
  const stats = findStats(exerciseName);
  if (!stats) return null;

  const isFemale = gender === "kvinna" || gender === "female" || gender === "f";
  const mean = isFemale ? stats.femaleMean : stats.maleMean;
  const sd = isFemale ? stats.femaleSD : stats.maleSD;

  const z = (weightKg - mean) / sd;
  const percentile = Math.round(normalCDF(z) * 100);

  // Clamp
  const clamped = Math.max(1, Math.min(99, percentile));

  let emoji: string;
  let description: string;

  if (clamped >= 99) {
    emoji = "🏆";
    description = "Elit – starkare än 99% av alla";
  } else if (clamped >= 95) {
    emoji = "💪";
    description = `Top ${100 - clamped}% – starkare än ${clamped}%`;
  } else if (clamped >= 85) {
    emoji = "🔥";
    description = `Starkare än ${clamped}% av alla`;
  } else if (clamped >= 70) {
    emoji = "⚡";
    description = `Starkare än ${clamped}% av alla`;
  } else if (clamped >= 50) {
    emoji = "👍";
    description = `Starkare än ${clamped}% av alla`;
  } else {
    emoji = "🌱";
    description = `Starkare än ${clamped}% av alla`;
  }

  return { percentile: clamped, emoji, description };
}
