import { supabase } from "@/integrations/supabase/client";
import { summarizeCompletion, formatCardioPace, formatCardioDistance, type WorkoutSummary } from "@/lib/workoutSummary";

export interface Improvement {
  emoji: string;
  title: string;
  text: string;
}

type Kind =
  | "heavier"
  | "moreReps"
  | "exerciseVolume"
  | "faster"
  | "longerDistance"
  | "longerTime"
  | "lowerPulse"
  | "sessionVolume"
  | "moreSets";

interface Fact {
  kind: Kind;
  /** Higher = more impressive, used to rank */
  weight: number;
  vars: Record<string, string>;
}

/** Many phrasings per kind so the overlay never feels repetitive. {x} gets filled in. */
const TEMPLATES: Record<Kind, Array<{ emoji: string; title: string; text: string }>> = {
  heavier: [
    { emoji: "🏋️", title: "Tyngre än någonsin", text: "{ex}: {now} – {diff} mer än ditt förra bästa. Starkt!" },
    { emoji: "💥", title: "Ny vikt i boken", text: "Du tog {now} i {ex}. Förra toppen var {prev}." },
    { emoji: "🦍", title: "Råstyrka", text: "{diff} tyngre i {ex} än tidigare. Kroppen svarar på jobbet." },
    { emoji: "🚀", title: "Uppåt igen", text: "{ex} har gått från {prev} till {now}. Så bygger man styrka." },
    { emoji: "🔩", title: "Järnet rör sig", text: "{now} i {ex}! Det är ditt tyngsta hittills." },
    { emoji: "🧗", title: "Ny nivå", text: "Du ökade från {prev} till {now} i {ex}. Dagens nya viktbästa är ditt!" },
    {"emoji": "💪", "title": "Styrkan syns i siffrorna", "text": "Du avslutade {ex} med {now}. Det är {diff} över ditt tidigare bästa på {prev}."},
    {"emoji": "🏋️", "title": "En tyngre notering", "text": "{ex}: tidigare {prev}, nu {now}. Dagens pass gav ett nytt viktbästa!"},
    {"emoji": "🚀", "title": "Du flyttade gränsen", "text": "I {ex} lyfte du {diff} mer än din tidigare topp. {now} är den nya noteringen."},
    {"emoji": "🎯", "title": "Dagens styrkelyft", "text": "{now} i {ex}, jämfört med tidigare bästa {prev}. En konkret förbättring att ta med sig."},
    {"emoji": "🔥", "title": "Mer vikt på stången", "text": "Dagens {ex} landade på {now}. Du passerade ditt tidigare bästa med {diff}!"},
    {"emoji": "🧱", "title": "Ett starkare steg", "text": "Från {prev} till {now} i {ex}. Dagens insats flyttade ditt viktbästa framåt."},
    {"emoji": "🏆", "title": "Viktbästa i dag", "text": "Du satte {now} i {ex}. Ingen tidigare jämförd notering är tyngre."},
    {"emoji": "⚡", "title": "Där satt höjningen", "text": "{ex} blev {diff} tyngre än ditt förra bästa: {now} mot {prev}. Snyggt lyft!"},
    {"emoji": "📈", "title": "Kurvan pekar upp", "text": "Ditt bästa i {ex} gick från {prev} till {now} efter det här passet."},
    {"emoji": "🔩", "title": "Nya siffror i loggen", "text": "{now} i {ex} är dagens kvitto. Din tidigare högsta vikt var {prev}."},
    {"emoji": "🦾", "title": "Du tog nästa vikt", "text": "I dag klarade du {now} i {ex}, {diff} mer än ditt tidigare bästa."},
    {"emoji": "🌟", "title": "Ett lyft att minnas", "text": "{ex} sticker ut från dagens pass: {now}, upp från ditt tidigare bästa på {prev}."},
  ],
  moreReps: [
    { emoji: "🔁", title: "Fler reps, samma vikt", text: "{ex}: {now} reps på {kg} – tidigare bästa på samma vikt var {prev}. Det är progression!" },
    { emoji: "📈", title: "Uthålligare", text: "Du pressade ut {diff} reps mer på {kg} i {ex}." },
    { emoji: "💪", title: "Mer i tanken", text: "{now} reps på {kg} i {ex}. Det är {diff} fler än ditt tidigare bästa på samma vikt." },
    { emoji: "🎯", title: "Repsen tickar upp", text: "{ex} på {kg}: tidigare bästa {prev}, nu {now} reps. Snyggt." },
    {"emoji": "🔁", "title": "En starkare serie", "text": "{ex} på {kg}: {now} reps i dag mot ditt tidigare bästa på {prev}. Du lade till {diff} reps!"},
    {"emoji": "💪", "title": "Vikten samma, repsen fler", "text": "Du gjorde {now} reps på {kg} i {ex}. Det är {diff} fler än ditt tidigare bästa på den vikten."},
    {"emoji": "📈", "title": "Repsbästa på den vikten", "text": "{ex}: {kg} och {now} reps. Din tidigare topp på samma vikt var {prev}."},
    {"emoji": "🎯", "title": "Du fick ut mer", "text": "Med samma {kg} i {ex} ökade du från ditt tidigare bästa på {prev} till {now} reps."},
    {"emoji": "🔥", "title": "Extra reps på kontot", "text": "Dagens {ex} gav {diff} reps mer på {kg} än du tidigare registrerat som bäst."},
    {"emoji": "🏆", "title": "Ny toppserie", "text": "{now} reps med {kg} i {ex}! Du passerade ditt tidigare bästa på {prev} reps."},
    {"emoji": "🧱", "title": "Progression utan vikthöjning", "text": "I {ex} ökade du till {now} reps på {kg}. Det tidigare bästa var {prev}."},
    {"emoji": "⚡", "title": "Repsen gjorde skillnaden", "text": "{kg} i {ex}, men nu {now} reps i stället för ditt tidigare bästa på {prev}. Snyggt!"},
    {"emoji": "🦾", "title": "Samma belastning, mer gjort", "text": "Du loggade {now} reps på {kg} i {ex}. {diff} reps över ditt tidigare bästa!"},
    {"emoji": "🌟", "title": "Dagens repslyft", "text": "{ex} förbättrades från {prev} till {now} reps på {kg}. Den ökningen är din."},
    {"emoji": "🔋", "title": "Fler repetitioner i dag", "text": "På {kg} i {ex} nådde du {now} reps, jämfört med ditt tidigare bästa på {prev}."},
    {"emoji": "🪜", "title": "Ett steg till i serien", "text": "{diff} extra reps på {kg} i {ex} gav ett nytt bästa: {now} reps."},
  ],
  exerciseVolume: [
    { emoji: "📦", title: "Mer jobb gjort", text: "Total volym i {ex}: {now} – {pct} % mer än förra gången." },
    { emoji: "⚙️", title: "Volymen växer", text: "{ex} gav {now} i lyftvolym i dag mot {prev} senast. En ökning med {pct} %!" },
    { emoji: "🧱", title: "Byggsten för byggsten", text: "{pct} % mer volym i {ex} än förra passet." },
    {"emoji": "📦", "title": "Övningen fick mer volym", "text": "{ex}: {now} i total lyftvolym mot {prev} senast. En ökning med {pct} %!"},
    {"emoji": "⚙️", "title": "Mer sammanlagt i dag", "text": "Du samlade {now} i {ex}, {pct} % mer än vid senaste jämförelsen."},
    {"emoji": "📈", "title": "Volymökningen är tydlig", "text": "Dagens {ex} gick från senaste passets {prev} till {now} i lyftvolym."},
    {"emoji": "🧱", "title": "Mer arbete i just den övningen", "text": "{ex} gav {pct} % mer lyftvolym än senast: {now} mot {prev}."},
    {"emoji": "💪", "title": "Ett större jobb avklarat", "text": "Du avslutade {ex} med {now} i lyftvolym. Senaste noteringen var {prev}."},
    {"emoji": "🔥", "title": "Dagens volymlyft", "text": "{ex} sticker ut: {pct} % mer sammanlagd vikt gånger reps än senast."},
    {"emoji": "🎯", "title": "Du byggde på volymen", "text": "Från {prev} till {now} i {ex}. Dagens ökning blev {pct} %."},
    {"emoji": "🏋️", "title": "Mer lyft genom hela övningen", "text": "Totalen i {ex} nådde {now}, jämfört med {prev} vid senaste tillfället."},
    {"emoji": "🌟", "title": "En tydlig ökning i loggen", "text": "{now} i lyftvolym för {ex}. Det är {pct} % över din senaste notering."},
    {"emoji": "🔩", "title": "Alla reps räknas", "text": "Vikt gånger reps i {ex} summerar till {now} i dag, mot {prev} senast."},
    {"emoji": "🚀", "title": "Övningsvolymen tog ett kliv", "text": "{ex} ökade med {pct} % i lyftvolym under dagens pass. Totalen blev {now}."},
    {"emoji": "🏆", "title": "Mer än senaste gången", "text": "Du lyfte sammanlagt {now} i {ex}. Förra jämförda tillfället gav {prev}."},
  ],
  faster: [
    { emoji: "⚡", title: "Snabbare än förut", text: "{sport}: {now} i snitt i dag mot tidigare bästa {prev}. Snyggt genomfört!" },
    { emoji: "🏎️", title: "Tempot sitter", text: "Ditt snabbaste {sport}-pass hittills: {now}." },
    { emoji: "💨", title: "Fart i dagens pass", text: "{now} i snitt under {sport}, tidigare bästa {prev}. Din nya notering är snabbare!" },
    { emoji: "🐆", title: "Kvick idag", text: "Du höll {now} i {sport}. Det är snabbare än någon tidigare gång." },
    { emoji: "⏱️", title: "Klockan ljuger inte", text: "{sport} på {now} – en tydlig förbättring från {prev}." },
    {"emoji": "⚡", "title": "Farten fick ett lyft", "text": "{sport}: {now} i dagens pass. Ditt tidigare bästa var {prev}."},
    {"emoji": "⏱️", "title": "Ny bästa snittnotering", "text": "Dagens {sport} gav {now}, snabbare än ditt tidigare bästa på {prev}."},
    {"emoji": "🚀", "title": "Du höjde snittet", "text": "I {sport} förbättrade du din bästa snittfart från {prev} till {now}."},
    {"emoji": "🏁", "title": "Snabbare hela vägen i snitt", "text": "{now} i {sport} är bättre än din tidigare snabbaste snittnotering på {prev}."},
    {"emoji": "📈", "title": "Dagens fartförbättring", "text": "{sport} landade på {now}. Tidigare bästa var {prev}, så dagens pass sticker ut!"},
    {"emoji": "🔥", "title": "Ett snabbare pass i loggen", "text": "Du höll {now} i snitt under {sport}, jämfört med tidigare bästa {prev}."},
    {"emoji": "🎯", "title": "Du slog din snittnotering", "text": "{sport}: {now} mot {prev}. Dagens genomsnitt var snabbare än tidigare."},
    {"emoji": "🌟", "title": "En ny fart att minnas", "text": "Efter dagens {sport} är din bästa snittnotering {now}, tidigare {prev}."},
    {"emoji": "🏆", "title": "Fartbästa i dag", "text": "Din {sport} gav {now} i snitt. Det slår den tidigare toppen på {prev}."},
    {"emoji": "💨", "title": "Mer fart i dagens pass", "text": "Från tidigare bästa {prev} till {now} i {sport}. En förbättring i siffror!"},
    {"emoji": "🧭", "title": "Snabbare än din tidigare topp", "text": "Du avslutade {sport} med snittet {now}. Tidigare snabbast var {prev}."},
    {"emoji": "👏", "title": "Det gick undan i dag", "text": "{now} i {sport} är din snabbaste jämförda snittnotering, före {prev}."},
  ],
  longerDistance: [
    { emoji: "🛣️", title: "Längre än någonsin", text: "{now} {sport} – din längsta sträcka hittills!" },
    { emoji: "🗺️", title: "Ny distans", text: "{sport}: {now}, förra längsta var {prev}. Uthålligheten växer." },
    { emoji: "🧭", title: "Längre bort", text: "Du tog dig {diff} längre i {sport} än tidigare." },
    { emoji: "🏁", title: "Fler kilometer", text: "{now} {sport} i ett svep. Det är riktigt bra." },
    {"emoji": "🛣️", "title": "Du förlängde din toppsträcka", "text": "{sport}: {now} i dag, {diff} längre än ditt tidigare bästa på {prev}."},
    {"emoji": "🗺️", "title": "Mer distans avklarad", "text": "Dagens {sport} nådde {now}. Din tidigare längsta jämförda sträcka var {prev}."},
    {"emoji": "🧭", "title": "Ett nytt distansbästa", "text": "Du tog dig {diff} längre i {sport}. Den nya noteringen är {now}."},
    {"emoji": "🏁", "title": "Längre sträcka i loggen", "text": "{now} i {sport}, jämfört med tidigare längsta {prev}. Snyggt genomfört!"},
    {"emoji": "📈", "title": "Distansen tog ett kliv", "text": "Din längsta {sport}-sträcka ökade från {prev} till {now} efter dagens pass."},
    {"emoji": "🔥", "title": "Extra sträcka på kontot", "text": "{diff} längre än tidigare i {sport}! Du avslutade på {now}."},
    {"emoji": "🏆", "title": "Dagens distanslyft", "text": "{sport} gav {now}, vilket passerar ditt tidigare distansbästa på {prev}."},
    {"emoji": "🌟", "title": "Du kom längre i dag", "text": "Med {now} i {sport} flyttade du din längsta notering framåt med {diff}."},
    {"emoji": "🚀", "title": "Nya meter i ditt bästa", "text": "Dagens {sport}: {now}. Det är {diff} utöver din tidigare längsta sträcka."},
    {"emoji": "👏", "title": "Hela sträckan räknas", "text": "Du loggade {now} i {sport}. Tidigare bästa var {prev}, och nu har du passerat det."},
    {"emoji": "🪜", "title": "Distansen växte", "text": "Från {prev} till {now} i {sport}. Dagens skillnad blev {diff}."},
    {"emoji": "💪", "title": "Ett längre pass avklarat", "text": "Din {sport} nådde {now} i distans, längre än tidigare bästa {prev}."},
  ],
  longerTime: [
    { emoji: "⏳", title: "Mer tid i rörelse", text: "{now} {sport} – ditt längsta pass hittills." },
    { emoji: "🔋", title: "Batteriet räckte längre", text: "{sport} i {now}, mot {prev} som mest tidigare." },
    { emoji: "🌄", title: "Uthållig", text: "Du höll på {diff} längre i {sport} än någonsin." },
    {"emoji": "⏳", "title": "Du höll på längre", "text": "{sport} i {now} i dag. Det är {diff} mer än ditt tidigare längsta på {prev}."},
    {"emoji": "🔋", "title": "Mer träningstid avklarad", "text": "Dagens {sport} gav {now} i rörelse, jämfört med tidigare längsta {prev}."},
    {"emoji": "⏱️", "title": "Ny längsta tid", "text": "Du registrerade {now} i {sport}. Din tidigare längsta jämförda tid var {prev}."},
    {"emoji": "📈", "title": "Tiden i rörelse ökade", "text": "Från {prev} till {now} i {sport}. Dagens tidsökning blev {diff}."},
    {"emoji": "🌟", "title": "Ett längre tillfälle i dag", "text": "{sport} pågick i {now}, {diff} längre än din tidigare toppnotering."},
    {"emoji": "👏", "title": "Du fullföljde mer tid", "text": "{now} i {sport} är din längsta jämförda tid hittills. Tidigare: {prev}."},
    {"emoji": "🏆", "title": "Tidsbästa i loggen", "text": "Dagens {sport} nådde {now}. Det passerar din tidigare längsta tid på {prev}."},
    {"emoji": "🧱", "title": "Fler minuter avklarade", "text": "I {sport} lade du till {diff} jämfört med din tidigare längsta notering på {prev}."},
    {"emoji": "🧭", "title": "Mer tid med samma träningsform", "text": "Du körde {sport} i {now}. Ditt tidigare tidsbästa var {prev}."},
    {"emoji": "💪", "title": "Dagens uthållighetsnotering", "text": "{sport}: {now} mot tidigare längsta {prev}. Du höll på {diff} längre!"},
  ],
  lowerPulse: [
    { emoji: "❤️", title: "Lägre snittpuls", text: "Snittpuls {now} i {sport} mot {prev} senast – vid jämförbar eller högre snittfart. En fin notering!" },
    { emoji: "🫀", title: "Lugnare puls", text: "{diff} lägre snittpuls i {sport} vid liknande eller högre snittfart. Dagens puls var {now}." },
    { emoji: "🧘", title: "Pulsen i dagens pass", text: "{sport} gav lägre snittpuls: {now} mot {prev} senast, vid jämförbar eller högre fart." },
    {"emoji": "❤️", "title": "Lägre puls vid liknande fart", "text": "{sport}: snittpuls {now} mot {prev} senast, med samma eller snabbare snitt inom jämförelsens marginal."},
    {"emoji": "🫀", "title": "En lägre pulsnotering", "text": "Dagens {sport} gav {now} i snittpuls, {diff} lägre än senast vid jämförbar eller högre fart."},
    {"emoji": "📉", "title": "Pulsen gick ned i jämförelsen", "text": "Du loggade {now} i {sport}, mot {prev} senast, utan någon tydlig minskning av snittfarten."},
    {"emoji": "🎯", "title": "Fart och puls att notera", "text": "Vid jämförbar eller högre snittfart i {sport} blev pulsen {now}, tidigare {prev}."},
    {"emoji": "🌟", "title": "Dagens pulsskillnad", "text": "{sport} gav {diff} lägre snittpuls än senast. Farten var jämförbar eller högre."},
    {"emoji": "🧭", "title": "Lägre snitt i pulsloggen", "text": "{now} i {sport} mot {prev} vid senaste tillfället, med liknande eller bättre snittfart."},
    {"emoji": "👏", "title": "En fin jämförelse i dag", "text": "Din {sport} visar {diff} lägre puls i snitt utan en tydlig fartminskning. Dagens puls: {now}."},
    {"emoji": "⏱️", "title": "Pulsen lägre, farten kvar", "text": "I dagens {sport} noterades {now} mot {prev} senast, vid jämförbar eller högre snittfart."},
    {"emoji": "📊", "title": "Siffrorna sticker ut", "text": "Snittpulsen i {sport} gick från {prev} till {now}. Snittfarten var jämförbar eller högre."},
    {"emoji": "💚", "title": "En positiv pulsnotering", "text": "{sport}: {now} i snittpuls, {diff} lägre än senast med liknande eller snabbare snitt."},
  ],
  sessionVolume: [
    { emoji: "🏆", title: "Mer än jämförbara pass", text: "{now} totalt i dag – {pct} % mer än snittet för pass med samma övningar." },
    { emoji: "🔥", title: "Över snittet", text: "Du lyfte {now} – mer än i ditt jämförbara snitt ({prev}) för samma övningar." },
    { emoji: "🐘", title: "Mycket järn", text: "{pct} % mer total lyftvolym än snittet för pass med samma övningar. Imponerande." },
    {"emoji": "🏋️", "title": "Mer volym i ett jämförbart pass", "text": "{now} i total lyftvolym i dag, mot {prev} i snitt för pass med samma övningar."},
    {"emoji": "📦", "title": "Över ditt jämförbara snitt", "text": "Dagens lyftvolym var {pct} % högre än snittet för samma övningsuppsättning: {now}."},
    {"emoji": "🔥", "title": "Ett större styrkejobb i dag", "text": "Du samlade {now} i lyftvolym. För jämförbara pass ligger ditt snitt på {prev}."},
    {"emoji": "📈", "title": "Passvolymen gick upp", "text": "{now} totalt, {pct} % över ditt snitt för pass med samma styrkeövningar."},
    {"emoji": "🧱", "title": "Mer genom hela passet", "text": "Dagens volym nådde {now}, jämfört med {prev} i snitt för samma övningsuppsättning."},
    {"emoji": "🎯", "title": "Du passerade ditt volymsnitt", "text": "Med {now} i lyftvolym hamnade du {pct} % över ditt jämförbara passnitt."},
    {"emoji": "🏆", "title": "Dagens total sticker ut", "text": "{now} i lyftvolym mot {prev} i snitt för pass med samma övningar. Snyggt genomfört!"},
    {"emoji": "🌟", "title": "En större total i loggen", "text": "Du avslutade med {pct} % mer volym än snittet för samma styrkeövningar: {now}."},
    {"emoji": "⚙️", "title": "Summeringen visar mer", "text": "Dagens vikt gånger reps blev {now}. Snittet för jämförbara pass är {prev}."},
    {"emoji": "👏", "title": "Alla lyft gav en ökning", "text": "{pct} % över ditt jämförbara volymsnitt! Dagens total blev {now}, mot snittets {prev}."},
  ],
  moreSets: [
    { emoji: "🧮", title: "Fler set än vanligt", text: "{now} set i dag mot {prev} i snitt för pass med samma övningar. Snyggt genomfört!" },
    { emoji: "🪜", title: "Extra steg", text: "Du körde {diff} set mer än snittet för pass med samma övningar, totalt {now}." },
    {"emoji": "🧮", "title": "Fler set i ett jämförbart pass", "text": "Du avslutade {now} set. Snittet för pass med samma övningar är {prev}."},
    {"emoji": "🪜", "title": "Extra set avklarade", "text": "Dagens {now} set är {diff} fler än ditt snitt för samma övningsuppsättning."},
    {"emoji": "📈", "title": "Settotalen steg", "text": "{now} set i dag, mot {prev} i snitt för jämförbara pass. Det blev {diff} extra."},
    {"emoji": "💪", "title": "Du fullföljde fler set", "text": "Med samma övningsuppsättning loggade du {now} set. Ditt jämförbara snitt är {prev}."},
    {"emoji": "🎯", "title": "Över ditt vanliga setantal", "text": "Dagens pass gav {diff} fler set än snittet för samma övningar, totalt {now}."},
    {"emoji": "🧱", "title": "Set för set, mer avklarat", "text": "{now} avslutade set mot ditt jämförbara snitt på {prev}. Dagens skillnad är {diff}."},
    {"emoji": "🌟", "title": "Fler bockar i loggen", "text": "Du klarmarkerade {now} set. Med samma övningar brukar snittet ligga på {prev}."},
    {"emoji": "👏", "title": "Dagens setökning", "text": "{diff} set fler än snittet för jämförbara pass! Du landade på {now} set."},
    {"emoji": "🏋️", "title": "En större settotal", "text": "Passet avslutades med {now} set, jämfört med snittets {prev} för samma övningar."},
    {"emoji": "🏆", "title": "Mer avklarat i samma upplägg", "text": "{now} set i dag mot {prev} i ditt jämförbara snitt. {diff} extra set finns nu i loggen."},
  ],
};

const RECENT_KEY = "grim_recent_improvement_templates";

const readRecent = (): string[] => {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { return []; }
};
const writeRecent = (ids: string[]) => {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(ids.slice(0, 20))); } catch { /* ignore */ }
};

const fmtKg = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1).replace(".", ",")} kg`;
const fmtVol = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(".", ",")} ton` : `${Math.round(n)} kg`);
const fmtMin = (n: number) => (n >= 60 ? `${Math.floor(n / 60)} h ${Math.round(n % 60)} min` : `${Math.round(n)} min`);
const lc = (s: string) => s.toLowerCase();

/** Compares the finished session with the user's history and lists real improvements. */
function findFacts(current: WorkoutSummary, history: WorkoutSummary[]): Fact[] {
  const facts: Fact[] = [];
  if (history.length === 0) return facts;

  // Strength, per exercise
  for (const [ex, st] of Object.entries(current.exerciseStats ?? {})) {
    const prev = history.map((h) => h.exerciseStats?.[ex]).filter(Boolean) as NonNullable<WorkoutSummary["exerciseStats"]>[string][];
    if (prev.length === 0) continue;
    const bestKg = Math.max(...prev.map((p) => p.maxKg));
    if (st.maxKg > 0 && bestKg > 0 && st.maxKg > bestKg) {
      facts.push({ kind: "heavier", weight: 10 + (st.maxKg - bestKg) / bestKg * 20, vars: { ex, now: fmtKg(st.maxKg), prev: fmtKg(bestKg), diff: fmtKg(st.maxKg - bestKg) } });
      continue;
    }
    const last = prev[0];
    const sameKg = prev.filter((p) => p.maxKg === st.maxKg);
    const bestRepsAtKg = sameKg.length ? Math.max(...sameKg.map((p) => p.repsAtMax)) : 0;
    if (st.maxKg > 0 && bestRepsAtKg > 0 && st.repsAtMax > bestRepsAtKg) {
      facts.push({ kind: "moreReps", weight: 7 + (st.repsAtMax - bestRepsAtKg), vars: { ex, kg: fmtKg(st.maxKg), now: String(st.repsAtMax), prev: String(bestRepsAtKg), diff: String(st.repsAtMax - bestRepsAtKg) } });
      continue;
    }
    if (last.volumeKg > 0 && st.volumeKg > last.volumeKg * 1.1) {
      const pct = Math.round((st.volumeKg / last.volumeKg - 1) * 100);
      facts.push({ kind: "exerciseVolume", weight: 4 + pct / 10, vars: { ex, now: fmtVol(st.volumeKg), prev: fmtVol(last.volumeKg), pct: String(pct) } });
    }
  }

  // Cardio, same primary sport
  const c = current.cardio;
  // Aggregated mixed-cardio totals cannot establish a sport-specific record.
  if (c && c.count === 1) {
    const sport = c.primaryName;
    const prev = history.map((h) => h.cardio).filter((h): h is NonNullable<typeof h> => !!h && h.count === 1 && lc(h.primaryName) === lc(sport));
    if (prev.length > 0) {
      const paceOf = (x: { minutes: number; distanceKm: number }) => (x.minutes > 0 && x.distanceKm >= 0.3 ? x.minutes / x.distanceKm : Infinity);
      const nowPace = paceOf(c);
      const bestPrev = prev.reduce((b, p) => (paceOf(p) < paceOf(b) ? p : b), prev[0]);
      const bestPace = paceOf(bestPrev);
      if (isFinite(nowPace) && isFinite(bestPace) && nowPace < bestPace * 0.99) {
        facts.push({ kind: "faster", weight: 9 + (bestPace / nowPace - 1) * 40, vars: {
          sport: lc(sport),
          now: formatCardioPace(c.minutes, c.distanceKm, sport).value,
          prev: formatCardioPace(bestPrev.minutes, bestPrev.distanceKm, sport).value,
        } });
      } else {
        const lastP = prev[0];
        if (c.pulse && lastP.pulse && isFinite(nowPace) && nowPace <= paceOf(lastP) * 1.01 && c.pulse < lastP.pulse - 2) {
          facts.push({ kind: "lowerPulse", weight: 7, vars: { sport: lc(sport), now: `${c.pulse} bpm`, prev: `${lastP.pulse} bpm`, diff: `${lastP.pulse - c.pulse} slag` } });
        }
      }
      const bestKm = Math.max(...prev.map((p) => p.distanceKm));
      if (c.distanceKm > 0 && bestKm > 0 && c.distanceKm > bestKm * 1.02) {
        facts.push({ kind: "longerDistance", weight: 8 + (c.distanceKm / bestKm - 1) * 20, vars: {
          sport: lc(sport),
          now: formatCardioDistance(c.distanceKm, sport),
          prev: formatCardioDistance(bestKm, sport),
          diff: formatCardioDistance(c.distanceKm - bestKm, sport),
        } });
      } else {
        const bestMin = Math.max(...prev.map((p) => p.minutes));
        if (c.minutes > 0 && bestMin > 0 && c.minutes > bestMin * 1.05) {
          facts.push({ kind: "longerTime", weight: 6, vars: { sport: lc(sport), now: fmtMin(c.minutes), prev: fmtMin(bestMin), diff: fmtMin(c.minutes - bestMin) } });
        }
      }
    }
  }

  // Whole-session claims require the same exercise roster, not unrelated workouts.
  const exerciseRoster = (s: WorkoutSummary) => [...new Set(s.exercises.map(lc))].sort().join("|");
  const roster = exerciseRoster(current);
  const comparable = roster ? history.filter((h) => exerciseRoster(h) === roster) : [];
  const strengthHist = comparable.filter((h) => h.volumeKg > 0);
  if (current.volumeKg > 0 && strengthHist.length >= 3) {
    const avg = strengthHist.reduce((s, h) => s + h.volumeKg, 0) / strengthHist.length;
    if (current.volumeKg > avg * 1.15) {
      const pct = Math.round((current.volumeKg / avg - 1) * 100);
      facts.push({ kind: "sessionVolume", weight: 5 + pct / 15, vars: { now: fmtVol(current.volumeKg), prev: fmtVol(avg), pct: String(pct) } });
    }
  }
  const setHist = comparable.filter((h) => h.sets > 0);
  if (current.sets > 0 && setHist.length >= 3) {
    const avg = Math.round(setHist.reduce((s, h) => s + h.sets, 0) / setHist.length);
    if (current.sets >= avg + 3) {
      facts.push({ kind: "moreSets", weight: 3, vars: { now: String(current.sets), prev: String(avg), diff: String(current.sets - avg) } });
    }
  }

  return facts.sort((a, b) => b.weight - a.weight);
}

const fill = (s: string, vars: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");

/** Turns facts into messages, avoiding phrasings shown recently. */
function render(facts: Fact[], max: number): Improvement[] {
  const recent = readRecent();
  const usedKinds = new Set<Kind>();
  const out: Improvement[] = [];
  const shown: string[] = [];
  for (const f of facts) {
    if (out.length >= max) break;
    // Max one message per kind, except heavier lifts which are always worth celebrating
    if (usedKinds.has(f.kind) && f.kind !== "heavier") continue;
    const list = TEMPLATES[f.kind].map((t, i) => ({ t, id: `${f.kind}:${i}` }));
    const fresh = list.filter((x) => !recent.includes(x.id) && !shown.includes(x.id));
    const pool = fresh.length ? fresh : list;
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    shown.push(chosen.id);
    usedKinds.add(f.kind);
    out.push({ emoji: chosen.t.emoji, title: chosen.t.title, text: fill(chosen.t.text, f.vars) });
  }
  if (shown.length) writeRecent([...shown, ...recent]);
  return out;
}

const signature = (s: WorkoutSummary) => `${s.sets}|${s.volumeKg}|${Math.round(s.cardio?.minutes ?? 0)}|${(s.cardio?.distanceKm ?? 0).toFixed(2)}`;

/** Finds up to `max` real improvements in the finished workout compared with earlier sessions. */
export async function findWorkoutImprovements(userId: string, current: WorkoutSummary | null, max = 2): Promise<Improvement[]> {
  if (!userId || !current) return [];
  try {
    const [compRes, archRes] = await Promise.all([
      supabase
        .from("workout_completions")
        .select("logged_weights, updated_at")
        .eq("user_id", userId)
        .eq("done", true)
        .order("updated_at", { ascending: false })
        .limit(200),
      supabase.from("archived_plans").select("completion_data").eq("user_id", userId),
    ]);
    let history = ((compRes.data || []) as any[]).map((r) => summarizeCompletion(r.logged_weights));
    // The just-finished workout may already be saved – drop it once.
    const sig = signature(current);
    const idx = history.findIndex((h) => signature(h) === sig);
    if (idx !== -1) history.splice(idx, 1);
    for (const row of (archRes.data || []) as any[]) {
      if (!Array.isArray(row?.completion_data)) continue;
      for (const c of row.completion_data) {
        if (c?.done && c.logged_weights) history.push(summarizeCompletion(c.logged_weights));
      }
    }
    history = history.filter((h) => h.sets > 0 || h.cardio);
    return render(findFacts(current, history), max);
  } catch {
    return [];
  }
}
