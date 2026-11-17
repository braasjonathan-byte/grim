export interface WeightPoint {
  log_date: string;
  weight_kg: number;
}

const DAY_MS = 864e5;

const parseDay = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
};

/**
 * Släpande 7-dagars glidande medelvärde, ett värde per vägning i samma
 * ordning som indatan. Dagsvikt brusar mycket – trendlinjen visar den
 * verkliga riktningen. Null tills minst två vägningar finns i fönstret,
 * så linjen aldrig ritas på ett enda mätvärde.
 */
export function rollingAverage7(weights: WeightPoint[]): (number | null)[] {
  const times = weights.map((w) => parseDay(w.log_date));
  return weights.map((_, i) => {
    const from = times[i] - 6 * DAY_MS;
    let sum = 0;
    let n = 0;
    for (let j = 0; j <= i; j++) {
      if (times[j] >= from) {
        sum += weights[j].weight_kg;
        n++;
      }
    }
    return n >= 2 ? Math.round((sum / n) * 10) / 10 : null;
  });
}
