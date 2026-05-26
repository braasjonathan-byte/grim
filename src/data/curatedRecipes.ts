// Generates 100 Swedish training-friendly recipes
type Ing = { name: string; amount: number; unit: string; kcal: number; protein_g: number; fat_g: number; carbs_g: number };
export type CuratedRecipe = {
  id: string;
  name: string;
  category: string;
  servings: number;
  instructions: string;
  kcal_per_serving: number;
  protein_g_per_serving: number;
  fat_g_per_serving: number;
  carbs_g_per_serving: number;
  ingredients: Ing[];
};

// helper: compute per-serving from ingredients
function compute(ings: Ing[], servings: number) {
  const t = ings.reduce((a, i) => ({ kcal: a.kcal + i.kcal, p: a.p + i.protein_g, f: a.f + i.fat_g, c: a.c + i.carbs_g }), { kcal: 0, p: 0, f: 0, c: 0 });
  return {
    kcal_per_serving: Math.round(t.kcal / servings),
    protein_g_per_serving: +(t.p / servings).toFixed(1),
    fat_g_per_serving: +(t.f / servings).toFixed(1),
    carbs_g_per_serving: +(t.c / servings).toFixed(1),
  };
}

// Macro database for common Swedish ingredients (per 100g/ml unless unit says piece)
const M: Record<string, { kcal: number; p: number; f: number; c: number; unit?: string; pieceG?: number }> = {
  "havregryn": { kcal: 370, p: 13, f: 7, c: 60 },
  "mjölk 3%": { kcal: 60, p: 3.4, f: 3, c: 4.8 },
  "mjölk 1.5%": { kcal: 47, p: 3.4, f: 1.5, c: 4.8 },
  "kvarg vanilj": { kcal: 70, p: 11, f: 0.2, c: 6 },
  "kvarg naturell": { kcal: 60, p: 11, f: 0.2, c: 4 },
  "skyr": { kcal: 60, p: 11, f: 0.2, c: 4 },
  "grekisk yoghurt 10%": { kcal: 130, p: 6, f: 10, c: 4 },
  "blåbär": { kcal: 45, p: 0.7, f: 0.3, c: 10 },
  "hallon": { kcal: 38, p: 1, f: 0.4, c: 7 },
  "jordgubbar": { kcal: 33, p: 0.7, f: 0.3, c: 6 },
  "banan": { kcal: 90, p: 1.1, f: 0.3, c: 21, unit: "st", pieceG: 120 },
  "äpple": { kcal: 52, p: 0.3, f: 0.2, c: 12, unit: "st", pieceG: 150 },
  "ägg": { kcal: 75, p: 6.3, f: 5, c: 0.4, unit: "st", pieceG: 55 },
  "vetebröd": { kcal: 265, p: 9, f: 3, c: 50 },
  "rågbröd": { kcal: 240, p: 8, f: 2, c: 45 },
  "knäckebröd": { kcal: 330, p: 11, f: 2, c: 65 },
  "smör": { kcal: 740, p: 0.8, f: 82, c: 0.6 },
  "olivolja": { kcal: 880, p: 0, f: 100, c: 0 },
  "rapsolja": { kcal: 880, p: 0, f: 100, c: 0 },
  "kycklingfilé": { kcal: 110, p: 23, f: 1.5, c: 0 },
  "kalkonfärs": { kcal: 150, p: 22, f: 7, c: 0 },
  "nötfärs 10%": { kcal: 180, p: 20, f: 10, c: 0 },
  "nötfärs 5%": { kcal: 140, p: 21, f: 5, c: 0 },
  "fläskfilé": { kcal: 130, p: 22, f: 4, c: 0 },
  "bacon": { kcal: 540, p: 14, f: 53, c: 1 },
  "lax": { kcal: 200, p: 20, f: 13, c: 0 },
  "torsk": { kcal: 80, p: 18, f: 0.7, c: 0 },
  "räkor": { kcal: 100, p: 20, f: 1.5, c: 0 },
  "tonfisk i vatten": { kcal: 110, p: 25, f: 1, c: 0 },
  "ris": { kcal: 130, p: 2.7, f: 0.3, c: 28 },
  "fullkornsris": { kcal: 120, p: 2.6, f: 1, c: 25 },
  "pasta": { kcal: 150, p: 5, f: 1, c: 30 },
  "fullkornspasta": { kcal: 140, p: 6, f: 1.5, c: 27 },
  "potatis": { kcal: 80, p: 2, f: 0.1, c: 17 },
  "sötpotatis": { kcal: 90, p: 1.6, f: 0.1, c: 20 },
  "quinoa": { kcal: 120, p: 4.4, f: 1.9, c: 21 },
  "bulgur": { kcal: 115, p: 4, f: 0.3, c: 24 },
  "couscous": { kcal: 130, p: 4, f: 0.2, c: 27 },
  "linser röda": { kcal: 115, p: 9, f: 0.4, c: 20 },
  "kikärtor": { kcal: 165, p: 9, f: 2.6, c: 27 },
  "svarta bönor": { kcal: 130, p: 9, f: 0.5, c: 23 },
  "tofu": { kcal: 145, p: 16, f: 9, c: 2 },
  "halloumi": { kcal: 320, p: 22, f: 25, c: 2 },
  "fetaost": { kcal: 260, p: 14, f: 21, c: 4 },
  "cheddar": { kcal: 400, p: 25, f: 33, c: 1 },
  "mozzarella": { kcal: 250, p: 18, f: 19, c: 2 },
  "broccoli": { kcal: 35, p: 2.8, f: 0.4, c: 4 },
  "blomkål": { kcal: 25, p: 2, f: 0.3, c: 3 },
  "morot": { kcal: 40, p: 0.9, f: 0.2, c: 9 },
  "spenat": { kcal: 23, p: 2.9, f: 0.4, c: 2 },
  "tomat": { kcal: 18, p: 0.9, f: 0.2, c: 3 },
  "gurka": { kcal: 15, p: 0.7, f: 0.1, c: 3 },
  "paprika": { kcal: 27, p: 1, f: 0.3, c: 5 },
  "lök": { kcal: 40, p: 1.1, f: 0.1, c: 8 },
  "vitlök": { kcal: 150, p: 6, f: 0.5, c: 33 },
  "champinjoner": { kcal: 22, p: 3.1, f: 0.3, c: 1 },
  "zucchini": { kcal: 17, p: 1.2, f: 0.3, c: 2 },
  "sallad": { kcal: 15, p: 1.4, f: 0.2, c: 2 },
  "avokado": { kcal: 160, p: 2, f: 15, c: 2 },
  "krossade tomater": { kcal: 30, p: 1.5, f: 0.2, c: 5 },
  "kokosmjölk": { kcal: 180, p: 1.7, f: 18, c: 3 },
  "honung": { kcal: 305, p: 0.3, f: 0, c: 75 },
  "lönnsirap": { kcal: 260, p: 0, f: 0, c: 67 },
  "jordnötssmör": { kcal: 590, p: 25, f: 50, c: 12 },
  "mandlar": { kcal: 580, p: 21, f: 49, c: 9 },
  "valnötter": { kcal: 650, p: 15, f: 65, c: 7 },
  "cashewnötter": { kcal: 555, p: 18, f: 44, c: 18 },
  "chiafrön": { kcal: 480, p: 17, f: 31, c: 11 },
  "linfrön": { kcal: 530, p: 18, f: 42, c: 1 },
  "solrosfrön": { kcal: 580, p: 21, f: 50, c: 11 },
  "vassleprotein": { kcal: 380, p: 80, f: 5, c: 8 },
  "kakao": { kcal: 230, p: 19, f: 14, c: 9 },
  "dadlar": { kcal: 280, p: 2.5, f: 0.4, c: 67 },
  "frysta bär": { kcal: 50, p: 0.8, f: 0.4, c: 10 },
  "soja sås": { kcal: 60, p: 8, f: 0, c: 6 },
  "sweet chili": { kcal: 230, p: 0.5, f: 0, c: 56 },
  "creme fraiche": { kcal: 200, p: 2, f: 20, c: 3 },
  "matlagningsgrädde 15%": { kcal: 160, p: 2.5, f: 15, c: 3 },
  "ricotta": { kcal: 175, p: 11, f: 13, c: 3 },
  "majs": { kcal: 90, p: 3, f: 1, c: 18 },
  "ärtor": { kcal: 80, p: 5, f: 0.4, c: 14 },
  "tortillabröd": { kcal: 300, p: 8, f: 8, c: 50 },
  "hummus": { kcal: 230, p: 8, f: 17, c: 12 },
  "pesto": { kcal: 450, p: 5, f: 45, c: 4 },
  "salsa": { kcal: 35, p: 1.5, f: 0.2, c: 7 },
  "guacamole": { kcal: 150, p: 2, f: 14, c: 5 },
  "edamame": { kcal: 120, p: 11, f: 5, c: 9 },
  "limefärsk": { kcal: 30, p: 0.7, f: 0.2, c: 8 },
  "citron": { kcal: 30, p: 1, f: 0.3, c: 9 },
  "ingefära": { kcal: 80, p: 1.8, f: 0.8, c: 18 },
  "currypasta": { kcal: 100, p: 3, f: 4, c: 14 },
  "pankobröd": { kcal: 390, p: 10, f: 4, c: 75 },
};

function ing(name: string, amount: number, unit?: string): Ing {
  const m = M[name];
  if (!m) throw new Error(`Missing macro: ${name}`);
  const u = unit || m.unit || "g";
  let grams = amount;
  if (u === "st" && m.pieceG) grams = amount * m.pieceG;
  if (u === "msk") grams = amount * 15;
  if (u === "tsk") grams = amount * 5;
  if (u === "dl") grams = amount * 100; // ungefär
  if (u === "ml") grams = amount;
  if (u === "klyfta") grams = amount * 3;
  const k = grams / 100;
  return {
    name, amount, unit: u,
    kcal: Math.round(m.kcal * k),
    protein_g: +(m.p * k).toFixed(1),
    fat_g: +(m.f * k).toFixed(1),
    carbs_g: +(m.c * k).toFixed(1),
  };
}

function R(id: string, name: string, category: string, servings: number, ings: Ing[], instructions: string): CuratedRecipe {
  const macros = compute(ings, servings);
  return { id, name, category, servings, instructions, ingredients: ings, ...macros };
}

export const CURATED_RECIPES: CuratedRecipe[] = [
  // === FRUKOST (15) ===
  R("br-01", "Proteinhavregryn med bär", "frukost", 1, [
    ing("havregryn", 60), ing("mjölk 1.5%", 2, "dl"), ing("vassleprotein", 20), ing("blåbär", 50), ing("honung", 1, "msk"),
  ], "Koka havregrynen i mjölken 3-4 min. Rör ner proteinpulvret när det svalnat lite. Toppa med bär och honung."),
  R("br-02", "Skyr med granola och hallon", "frukost", 1, [
    ing("skyr", 200), ing("havregryn", 30), ing("mandlar", 15), ing("hallon", 50), ing("honung", 1, "tsk"),
  ], "Lägg skyren i en skål. Rosta havregryn och hackade mandlar lätt i panna. Toppa skyren med granola, hallon och honung."),
  R("br-03", "Äggröra med rågbröd", "frukost", 1, [
    ing("ägg", 3, "st"), ing("smör", 1, "tsk"), ing("rågbröd", 60), ing("tomat", 80),
  ], "Vispa äggen lätt. Smält smör i panna, häll i äggen och rör tills krämigt. Servera på rågbröd med tomatskivor."),
  R("br-04", "Banansmoothie med jordnötssmör", "frukost", 1, [
    ing("banan", 1, "st"), ing("mjölk 1.5%", 3, "dl"), ing("jordnötssmör", 1, "msk"), ing("havregryn", 30), ing("vassleprotein", 20),
  ], "Mixa allt i en blender tills slätt. Servera direkt."),
  R("br-05", "Overnight oats med chia", "frukost", 1, [
    ing("havregryn", 50), ing("mjölk 1.5%", 2, "dl"), ing("chiafrön", 1, "msk"), ing("frysta bär", 80), ing("honung", 1, "tsk"),
  ], "Blanda allt i en burk kvällen innan. Förvara i kylen över natten. Rör om och toppa med extra bär på morgonen."),
  R("br-06", "Kvarg med äpple och kanel", "frukost", 1, [
    ing("kvarg vanilj", 250), ing("äpple", 1, "st"), ing("valnötter", 15),
  ], "Hacka äpple och valnötter. Blanda med kvargen och strö över lite kanel."),
  R("br-07", "Tonfisksmörgås", "frukost", 1, [
    ing("rågbröd", 80), ing("tonfisk i vatten", 80), ing("creme fraiche", 1, "msk"), ing("gurka", 40),
  ], "Mosa tonfisk med creme fraiche. Bred på rågbröd och toppa med gurkskivor."),
  R("br-08", "Proteinpannkakor", "frukost", 2, [
    ing("ägg", 4, "st"), ing("havregryn", 80), ing("kvarg naturell", 200), ing("vassleprotein", 30), ing("blåbär", 100),
  ], "Mixa ägg, havregryn, kvarg och proteinpulver. Stek små pannkakor i lätt smörad panna. Servera med blåbär."),
  R("br-09", "Avokadotoast med ägg", "frukost", 1, [
    ing("rågbröd", 80), ing("avokado", 80), ing("ägg", 2, "st"), ing("citron", 0.2, "st"),
  ], "Rosta brödet. Mosa avokado med citronsaft och bred på. Koka ägg löskokt och lägg ovanpå."),
  R("br-10", "Yoghurtbowl med granola", "frukost", 1, [
    ing("grekisk yoghurt 10%", 200), ing("havregryn", 40), ing("mandlar", 15), ing("hallon", 80), ing("honung", 1, "tsk"),
  ], "Lägg yoghurt i en skål. Toppa med havregryn, mandlar, hallon och honung."),
  R("br-11", "Quinoa-frukost med bär", "frukost", 1, [
    ing("quinoa", 80), ing("mjölk 1.5%", 2, "dl"), ing("blåbär", 80), ing("mandlar", 15), ing("honung", 1, "tsk"),
  ], "Koka quinoa i mjölk 15 min tills krämig. Toppa med bär, mandlar och honung."),
  R("br-12", "Omelett med spenat och fetaost", "frukost", 1, [
    ing("ägg", 3, "st"), ing("spenat", 50), ing("fetaost", 30), ing("olivolja", 1, "tsk"),
  ], "Vispa ägg. Häll i panna med olivolja. Lägg spenat och fetaost på halva omeletten, vik ihop när nästan stelnat."),
  R("br-13", "Smörgås med kalkon och avokado", "frukost", 1, [
    ing("rågbröd", 80), ing("kalkonfärs", 0), ing("avokado", 60), ing("tomat", 50),
  ], "Rosta brödet. Bred på avokado, lägg på kalkonpålägg och tomat."),
  R("br-14", "Chiapudding med kakao", "frukost", 1, [
    ing("chiafrön", 30), ing("mjölk 1.5%", 2, "dl"), ing("kakao", 1, "msk"), ing("honung", 1, "msk"), ing("hallon", 50),
  ], "Blanda chia, mjölk, kakao och honung. Låt stå i kyl 2 tim eller över natten. Toppa med hallon."),
  R("br-15", "Knäckebröd med ägg och kaviar", "frukost", 1, [
    ing("knäckebröd", 40), ing("ägg", 2, "st"), ing("smör", 1, "tsk"),
  ], "Hårdkoka äggen 7 min. Bred smör på knäckebröd, lägg på äggskivor."),

  // === LUNCH (20) ===
  R("lu-01", "Kycklingbowl med quinoa", "lunch", 1, [
    ing("kycklingfilé", 150), ing("quinoa", 80), ing("broccoli", 100), ing("avokado", 50), ing("olivolja", 1, "msk"),
  ], "Koka quinoa enligt anvisning. Stek kyckling kryddad med salt och peppar. Ångkoka broccoli. Lägg upp i skål med avokado."),
  R("lu-02", "Tonfisksallad med ägg", "lunch", 1, [
    ing("tonfisk i vatten", 100), ing("sallad", 80), ing("ägg", 2, "st"), ing("tomat", 100), ing("olivolja", 1, "msk"),
  ], "Hårdkoka ägg. Lägg sallad, tomat, tonfisk och äggklyftor i skål. Ringla över olivolja."),
  R("lu-03", "Laxwrap med spenat", "lunch", 1, [
    ing("tortillabröd", 60), ing("lax", 100), ing("spenat", 30), ing("creme fraiche", 1, "msk"), ing("gurka", 40),
  ], "Bred creme fraiche på tortilla. Lägg på spenat, lax och gurka. Rulla ihop."),
  R("lu-04", "Linssoppa", "lunch", 4, [
    ing("linser röda", 300), ing("morot", 200), ing("lök", 100), ing("krossade tomater", 400), ing("olivolja", 2, "msk"),
  ], "Fräs lök och morot i olja. Tillsätt linser, krossade tomater och 1 liter vatten. Koka 25 min. Krydda med spiskummin, salt och peppar."),
  R("lu-05", "Räksallad med avokado", "lunch", 1, [
    ing("räkor", 150), ing("avokado", 80), ing("sallad", 80), ing("tomat", 80), ing("citron", 0.3, "st"),
  ], "Blanda räkor med citronsaft. Lägg upp sallad, tomat, avokado och räkor. Krydda med svartpeppar."),
  R("lu-06", "Kycklingwrap", "lunch", 1, [
    ing("tortillabröd", 60), ing("kycklingfilé", 120), ing("hummus", 30), ing("sallad", 30), ing("paprika", 50),
  ], "Stek kycklingen och skär i strimlor. Bred hummus på tortillan, lägg på sallad, kyckling och paprika. Rulla."),
  R("lu-07", "Kikärtcurry", "lunch", 4, [
    ing("kikärtor", 500), ing("kokosmjölk", 400), ing("krossade tomater", 400), ing("lök", 150), ing("currypasta", 50),
  ], "Fräs lök, tillsätt currypasta. Häll i kikärtor, tomater och kokosmjölk. Sjud 20 min. Servera med ris."),
  R("lu-08", "Bulgursallad med halloumi", "lunch", 2, [
    ing("bulgur", 150), ing("halloumi", 150), ing("tomat", 200), ing("gurka", 100), ing("olivolja", 2, "msk"),
  ], "Koka bulgur. Stek halloumi i skivor. Blanda bulgur med tärnade grönsaker och olivolja. Toppa med halloumi."),
  R("lu-09", "Kalkon-pastasallad", "lunch", 2, [
    ing("fullkornspasta", 150), ing("kalkonfärs", 200), ing("paprika", 100), ing("pesto", 30), ing("mozzarella", 100),
  ], "Koka pasta. Stek kalkonfärs. Blanda med paprika, pesto och tärnad mozzarella."),
  R("lu-10", "Kycklingsallad cæsar", "lunch", 1, [
    ing("kycklingfilé", 150), ing("sallad", 100), ing("rågbröd", 30), ing("cheddar", 20), ing("olivolja", 1, "msk"),
  ], "Stek kyckling, skär i strimlor. Rosta brödtärningar. Blanda sallad, kyckling, krutonger och riven cheddar. Ringla olivolja."),
  R("lu-11", "Quinoasallad med fetaost", "lunch", 2, [
    ing("quinoa", 150), ing("fetaost", 100), ing("tomat", 150), ing("gurka", 100), ing("olivolja", 2, "msk"),
  ], "Koka quinoa. Blanda med tärnade grönsaker, fetaost och olivolja."),
  R("lu-12", "Räksandwich", "lunch", 1, [
    ing("rågbröd", 80), ing("räkor", 100), ing("ägg", 1, "st"), ing("creme fraiche", 1, "msk"), ing("sallad", 20),
  ], "Hårdkoka ägg. Bred creme fraiche på bröd, lägg på sallad, räkor och äggskivor."),
  R("lu-13", "Torskbiff med potatis", "lunch", 2, [
    ing("torsk", 300), ing("potatis", 400), ing("ärtor", 200), ing("smör", 20),
  ], "Koka potatis. Stek torsk i smör 3 min/sida. Värm ärtor. Servera tillsammans."),
  R("lu-14", "Vegetarisk burrito-bowl", "lunch", 2, [
    ing("svarta bönor", 300), ing("ris", 150), ing("majs", 150), ing("salsa", 100), ing("avokado", 100),
  ], "Koka ris. Värm bönor och majs. Lägg upp i skål med salsa och avokado."),
  R("lu-15", "Pasta med tonfisk och tomat", "lunch", 2, [
    ing("fullkornspasta", 160), ing("tonfisk i vatten", 200), ing("krossade tomater", 400), ing("lök", 80), ing("olivolja", 2, "msk"),
  ], "Fräs lök i olja. Tillsätt krossade tomater och tonfisk, sjud 10 min. Blanda med kokt pasta."),
  R("lu-16", "Soppa på sötpotatis", "lunch", 4, [
    ing("sötpotatis", 600), ing("kokosmjölk", 400), ing("lök", 100), ing("ingefära", 20), ing("olivolja", 2, "msk"),
  ], "Fräs lök och ingefära. Tillsätt tärnad sötpotatis, kokosmjölk och 5 dl vatten. Koka mjukt, mixa slätt."),
  R("lu-17", "Köttbullar med potatismos", "lunch", 4, [
    ing("nötfärs 10%", 500), ing("potatis", 800), ing("mjölk 1.5%", 1, "dl"), ing("smör", 30), ing("ägg", 1, "st"),
  ], "Blanda nötfärs med ägg, salt, peppar. Forma bullar, stek i panna. Koka potatis, mosa med mjölk och smör."),
  R("lu-18", "Kycklingsoppa", "lunch", 4, [
    ing("kycklingfilé", 400), ing("morot", 200), ing("lök", 100), ing("fullkornspasta", 100), ing("olivolja", 2, "msk"),
  ], "Skär kyckling i strimlor. Fräs grönsaker, tillsätt 1.5 l buljong och kyckling. Koka 15 min. Tillsätt pasta sista 8 min."),
  R("lu-19", "Falafelbowl", "lunch", 2, [
    ing("kikärtor", 400), ing("bulgur", 150), ing("tomat", 150), ing("hummus", 60), ing("sallad", 80),
  ], "Mixa kikärtor till smet, krydda och forma bullar. Stek i olja. Servera med bulgur, sallad, tomat och hummus."),
  R("lu-20", "Lax-poké bowl", "lunch", 2, [
    ing("lax", 300), ing("ris", 160), ing("avokado", 100), ing("edamame", 150), ing("soja sås", 2, "msk"),
  ], "Koka ris. Skär lax i tärningar och marinera i soja. Lägg upp på ris med edamame och avokado."),

  // === MIDDAG (25) ===
  R("mi-01", "Lax i ugn med rotfrukter", "middag", 2, [
    ing("lax", 300), ing("sötpotatis", 400), ing("broccoli", 200), ing("olivolja", 2, "msk"), ing("citron", 0.5, "st"),
  ], "Sätt ugnen på 200°C. Lägg laxen och tärnade rotfrukter på plåt, ringla olja. Tillaga 20 min. Servera med citron."),
  R("mi-02", "Kyckling i ugn med klyftpotatis", "middag", 2, [
    ing("kycklingfilé", 300), ing("potatis", 500), ing("paprika", 150), ing("olivolja", 2, "msk"), ing("vitlök", 2, "klyfta"),
  ], "Sätt ugn 220°C. Lägg klyftor, paprika och kyckling på plåt. Ringla olja, krydda med vitlök, salt, peppar. 25 min."),
  R("mi-03", "Köttfärssås med pasta", "middag", 4, [
    ing("nötfärs 10%", 500), ing("fullkornspasta", 320), ing("krossade tomater", 400), ing("lök", 150), ing("olivolja", 2, "msk"),
  ], "Fräs lök, bryn färsen. Tillsätt tomater, sjud 20 min. Koka pasta. Servera tillsammans."),
  R("mi-04", "Stekt lax med ris", "middag", 2, [
    ing("lax", 300), ing("ris", 160), ing("broccoli", 200), ing("soja sås", 2, "msk"), ing("olivolja", 1, "msk"),
  ], "Koka ris. Stek lax i olja 4 min/sida. Ångkoka broccoli. Ringla sojasås."),
  R("mi-05", "Tikka masala med kyckling", "middag", 4, [
    ing("kycklingfilé", 600), ing("kokosmjölk", 400), ing("krossade tomater", 400), ing("currypasta", 60), ing("ris", 320),
  ], "Stek kyckling. Tillsätt currypasta, tomater och kokosmjölk. Sjud 20 min. Servera med ris."),
  R("mi-06", "Halloumiwok med ris", "middag", 2, [
    ing("halloumi", 250), ing("ris", 160), ing("paprika", 150), ing("zucchini", 150), ing("soja sås", 2, "msk"),
  ], "Koka ris. Stek halloumi i tärningar. Woka grönsaker. Blanda allt med sojasås."),
  R("mi-07", "Torsk i ugn med potatis", "middag", 2, [
    ing("torsk", 300), ing("potatis", 500), ing("morot", 200), ing("smör", 30), ing("citron", 0.5, "st"),
  ], "Skär potatis i klyftor, baka 25 min på 200°C. Lägg in torsken sista 12 min med smörklickar och citron."),
  R("mi-08", "Pulled chicken med tortilla", "middag", 4, [
    ing("kycklingfilé", 800), ing("tortillabröd", 240), ing("salsa", 200), ing("avokado", 200), ing("sallad", 100),
  ], "Koka kyckling i kryddad buljong 25 min, dra isär med gafflar. Servera i tortilla med salsa, avokado och sallad."),
  R("mi-09", "Fläskfilé med rotfruktsmos", "middag", 2, [
    ing("fläskfilé", 350), ing("sötpotatis", 400), ing("potatis", 200), ing("smör", 20), ing("broccoli", 200),
  ], "Bryn fläskfilén, tillaga klar i ugn 180°C ~15 min. Koka potatis och sötpotatis, mosa med smör. Ångkoka broccoli."),
  R("mi-10", "Vegetarisk lasagne", "middag", 4, [
    ing("linser röda", 200), ing("pasta", 150), ing("krossade tomater", 800), ing("ricotta", 250), ing("cheddar", 150),
  ], "Koka linser med tomater till sås. Varva lasagneplattor, linssås och ricotta i form. Toppa med riven cheddar. Grädda 180°C 30 min."),
  R("mi-11", "Indisk linsgryta (dal)", "middag", 4, [
    ing("linser röda", 300), ing("kokosmjölk", 400), ing("krossade tomater", 400), ing("currypasta", 40), ing("ris", 320),
  ], "Koka linser med tomater och kokosmjölk 25 min. Rör i currypasta. Servera med ris."),
  R("mi-12", "Stekt torsk med ärtmos", "middag", 2, [
    ing("torsk", 300), ing("ärtor", 300), ing("potatis", 400), ing("smör", 20), ing("citron", 0.5, "st"),
  ], "Koka potatis. Mixa ärtor med smör till mos. Stek torsk i smör. Servera med citron."),
  R("mi-13", "Kalkonfärsbiffar med couscous", "middag", 2, [
    ing("kalkonfärs", 400), ing("couscous", 150), ing("tomat", 150), ing("gurka", 100), ing("fetaost", 80),
  ], "Forma biffar av färsen, stek. Koka couscous. Blanda med tärnade grönsaker och fetaost."),
  R("mi-14", "Tonfiskpasta med olivolja", "middag", 2, [
    ing("fullkornspasta", 160), ing("tonfisk i vatten", 200), ing("olivolja", 3, "msk"), ing("vitlök", 2, "klyfta"), ing("tomat", 200),
  ], "Koka pasta. Fräs hackad vitlök i olja. Tillsätt tonfisk och tärnad tomat. Vänd ner pasta."),
  R("mi-15", "Köttbullsbowl med ris", "middag", 4, [
    ing("nötfärs 10%", 500), ing("ris", 320), ing("morot", 200), ing("ärtor", 200), ing("soja sås", 2, "msk"),
  ], "Forma och stek köttbullar. Koka ris. Servera med ångade morötter, ärtor och sojasås."),
  R("mi-16", "Sweet chili-kyckling med ris", "middag", 2, [
    ing("kycklingfilé", 300), ing("ris", 160), ing("paprika", 150), ing("sweet chili", 4, "msk"), ing("soja sås", 1, "msk"),
  ], "Stek kyckling i strimlor. Tillsätt paprika och woka. Häll på sweet chili och soja. Servera med ris."),
  R("mi-17", "Lax med pesto-pasta", "middag", 2, [
    ing("lax", 300), ing("fullkornspasta", 160), ing("pesto", 40), ing("spenat", 80), ing("mozzarella", 100),
  ], "Koka pasta. Stek lax. Vänd pasta med pesto och spenat. Toppa med flarn av lax och mozzarella."),
  R("mi-18", "Vegetariskt chili", "middag", 4, [
    ing("svarta bönor", 500), ing("kikärtor", 300), ing("krossade tomater", 800), ing("majs", 200), ing("lök", 150),
  ], "Fräs lök. Tillsätt bönor, kikärtor, tomater och majs. Krydda med chili och spiskummin. Sjud 25 min."),
  R("mi-19", "Indisk butter chicken", "middag", 4, [
    ing("kycklingfilé", 600), ing("matlagningsgrädde 15%", 400), ing("krossade tomater", 400), ing("currypasta", 60), ing("ris", 320),
  ], "Stek kyckling. Tillsätt currypasta, tomater och grädde. Sjud 20 min. Servera med ris."),
  R("mi-20", "Tofu-wok med nudlar", "middag", 2, [
    ing("tofu", 250), ing("pasta", 150), ing("paprika", 150), ing("morot", 100), ing("soja sås", 3, "msk"),
  ], "Tärna tofu, stek krispigt. Woka grönsaker. Blanda med kokt pasta och soja."),
  R("mi-21", "Biff med ugnsbakad potatis", "middag", 2, [
    ing("nötfärs 5%", 300), ing("potatis", 500), ing("broccoli", 200), ing("olivolja", 1, "msk"), ing("smör", 20),
  ], "Forma biffar av färsen, stek. Baka potatisklyftor 220°C 25 min. Ångkoka broccoli."),
  R("mi-22", "Fisk-och-chips ugnsstekt", "middag", 2, [
    ing("torsk", 300), ing("potatis", 500), ing("pankobröd", 60), ing("ägg", 1, "st"), ing("ärtor", 200),
  ], "Doppa torsk i ägg och panko. Baka 200°C 15 min med klyftpotatis. Värm ärtor."),
  R("mi-23", "Quinoa-fylld paprika", "middag", 2, [
    ing("paprika", 400), ing("quinoa", 150), ing("kalkonfärs", 250), ing("fetaost", 80), ing("krossade tomater", 200),
  ], "Halvera paprikor. Bryn färs, blanda med kokt quinoa, tomater och fetaost. Fyll paprikor, baka 200°C 25 min."),
  R("mi-24", "Pasta carbonara med kalkonbacon", "middag", 2, [
    ing("fullkornspasta", 160), ing("bacon", 80), ing("ägg", 3, "st"), ing("cheddar", 50), ing("mjölk 1.5%", 1, "dl"),
  ], "Koka pasta. Stek bacon. Vispa ägg, ost och mjölk. Vänd ner i het pasta + bacon utan värme."),
  R("mi-25", "Räkpasta med citron", "middag", 2, [
    ing("fullkornspasta", 160), ing("räkor", 250), ing("olivolja", 3, "msk"), ing("vitlök", 2, "klyfta"), ing("citron", 1, "st"),
  ], "Koka pasta. Fräs vitlök i olja, tillsätt räkor och citronsaft. Blanda med pastan."),

  // === MELLANMÅL (15) ===
  R("me-01", "Kvargbowl med honung", "mellanmål", 1, [
    ing("kvarg vanilj", 200), ing("blåbär", 80), ing("mandlar", 15), ing("honung", 1, "tsk"),
  ], "Blanda kvarg med honung. Toppa med blåbär och mandlar."),
  R("me-02", "Proteinshake banan", "mellanmål", 1, [
    ing("vassleprotein", 30), ing("banan", 1, "st"), ing("mjölk 1.5%", 3, "dl"),
  ], "Mixa allt i blender 30 sek."),
  R("me-03", "Knäckebröd med hummus", "mellanmål", 1, [
    ing("knäckebröd", 40), ing("hummus", 50), ing("paprika", 80),
  ], "Bred hummus på knäckebröd, toppa med paprikastavar."),
  R("me-04", "Skyr med nötter", "mellanmål", 1, [
    ing("skyr", 200), ing("valnötter", 15), ing("honung", 1, "tsk"),
  ], "Blanda skyr med nötter och honung."),
  R("me-05", "Energibollar", "mellanmål", 6, [
    ing("dadlar", 200), ing("havregryn", 100), ing("jordnötssmör", 60), ing("kakao", 20), ing("vassleprotein", 30),
  ], "Mixa alla ingredienser till en deg. Rulla bollar. Förvara i kyl."),
  R("me-06", "Ägg och avokado", "mellanmål", 1, [
    ing("ägg", 2, "st"), ing("avokado", 80),
  ], "Hårdkoka äggen. Servera med avokadoskivor och flingsalt."),
  R("me-07", "Frukt- och nötmix", "mellanmål", 1, [
    ing("äpple", 1, "st"), ing("mandlar", 25),
  ], "Skär äpple i klyftor, ät med mandlar."),
  R("me-08", "Cottage-knäcke", "mellanmål", 1, [
    ing("knäckebröd", 40), ing("kvarg naturell", 100), ing("gurka", 60),
  ], "Bred kvarg på knäckebröd, lägg på gurkskivor."),
  R("me-09", "Proteinpannkaka mini", "mellanmål", 1, [
    ing("ägg", 2, "st"), ing("banan", 1, "st"), ing("havregryn", 30),
  ], "Mixa, stek små pannkakor. Servera direkt."),
  R("me-10", "Smoothiebowl med chia", "mellanmål", 1, [
    ing("frysta bär", 150), ing("skyr", 150), ing("vassleprotein", 20), ing("chiafrön", 1, "msk"),
  ], "Mixa bär med skyr och protein. Toppa med chiafrön."),
  R("me-11", "Tonfiskröra med knäckebröd", "mellanmål", 1, [
    ing("tonfisk i vatten", 80), ing("creme fraiche", 1, "msk"), ing("knäckebröd", 40),
  ], "Blanda tonfisk med creme fraiche. Servera på knäckebröd."),
  R("me-12", "Banan med jordnötssmör", "mellanmål", 1, [
    ing("banan", 1, "st"), ing("jordnötssmör", 1, "msk"),
  ], "Skär banan, doppa i jordnötssmör."),
  R("me-13", "Yoghurt med granola", "mellanmål", 1, [
    ing("grekisk yoghurt 10%", 150), ing("havregryn", 30), ing("honung", 1, "tsk"),
  ], "Blanda yoghurt med havregryn och honung."),
  R("me-14", "Edamame med flingsalt", "mellanmål", 1, [
    ing("edamame", 150),
  ], "Koka edamame 4 min, strö flingsalt över."),
  R("me-15", "Proteinmuffins", "mellanmål", 6, [
    ing("havregryn", 150), ing("vassleprotein", 60), ing("ägg", 3, "st"), ing("banan", 2, "st"), ing("kakao", 20),
  ], "Mixa alla ingredienser. Häll i muffinsformar. Grädda 180°C 18 min."),

  // === PRE-WORKOUT (8) ===
  R("pre-01", "Banan-rågmacka", "pre-workout", 1, [
    ing("rågbröd", 60), ing("jordnötssmör", 1, "msk"), ing("banan", 1, "st"),
  ], "Bred jordnötssmör på bröd, lägg på bananskivor. Ät 45-60 min före träning."),
  R("pre-02", "Havregröt med honung", "pre-workout", 1, [
    ing("havregryn", 60), ing("mjölk 1.5%", 2, "dl"), ing("honung", 1, "msk"), ing("banan", 0.5, "st"),
  ], "Koka grynen i mjölken. Toppa med honung och bananskivor."),
  R("pre-03", "Risbowl med kyckling", "pre-workout", 1, [
    ing("ris", 80), ing("kycklingfilé", 100), ing("soja sås", 1, "msk"),
  ], "Koka ris, stek kyckling, ringla soja. Lätt att smälta före träning."),
  R("pre-04", "Smoothie med havre", "pre-workout", 1, [
    ing("havregryn", 40), ing("banan", 1, "st"), ing("mjölk 1.5%", 2, "dl"), ing("honung", 1, "tsk"),
  ], "Mixa allt slätt."),
  R("pre-05", "Yoghurt med müsli", "pre-workout", 1, [
    ing("grekisk yoghurt 10%", 150), ing("havregryn", 40), ing("frysta bär", 50),
  ], "Blanda yoghurt med havregryn och bär. Energi 1 tim före pass."),
  R("pre-06", "Toast med honung", "pre-workout", 1, [
    ing("vetebröd", 60), ing("honung", 1, "msk"), ing("banan", 0.5, "st"),
  ], "Rosta brödet, bred honung. Toppa med bananskivor."),
  R("pre-07", "Energiboll dadel-kakao", "pre-workout", 3, [
    ing("dadlar", 100), ing("havregryn", 50), ing("kakao", 10), ing("jordnötssmör", 1, "msk"),
  ], "Mixa, rulla bollar. Ät 1-2 st 30 min före."),
  R("pre-08", "Bananyoghurt med chia", "pre-workout", 1, [
    ing("kvarg vanilj", 150), ing("banan", 1, "st"), ing("chiafrön", 1, "tsk"), ing("honung", 1, "tsk"),
  ], "Blanda allt i en skål."),

  // === POST-WORKOUT (7) ===
  R("po-01", "Återhämtningsshake", "post-workout", 1, [
    ing("vassleprotein", 30), ing("banan", 1, "st"), ing("havregryn", 40), ing("mjölk 1.5%", 3, "dl"),
  ], "Mixa allt slätt. Drick inom 30 min efter pass."),
  R("po-02", "Kyckling med ris", "post-workout", 1, [
    ing("kycklingfilé", 180), ing("ris", 100), ing("broccoli", 150), ing("soja sås", 1, "msk"),
  ], "Klassisk post-workout: protein + snabba kolhydrater. Stek kyckling, koka ris, ångkoka broccoli."),
  R("po-03", "Skyr med protein och bär", "post-workout", 1, [
    ing("skyr", 250), ing("vassleprotein", 20), ing("blåbär", 100), ing("honung", 1, "tsk"),
  ], "Rör vassle i skyr. Toppa med bär och honung."),
  R("po-04", "Lax med sötpotatis", "post-workout", 1, [
    ing("lax", 150), ing("sötpotatis", 250), ing("spenat", 80),
  ], "Stek lax, baka sötpotatis. Servera med spenat. Bra omega-3 efter pass."),
  R("po-05", "Tonfiskpasta snabb", "post-workout", 1, [
    ing("fullkornspasta", 80), ing("tonfisk i vatten", 100), ing("krossade tomater", 150),
  ], "Koka pasta, blanda med tonfisk och tomater. Färdig på 10 min."),
  R("po-06", "Äggsmörgås med ost", "post-workout", 1, [
    ing("rågbröd", 80), ing("ägg", 3, "st"), ing("cheddar", 30),
  ], "Stek ägg, lägg på bröd med riven ost."),
  R("po-07", "Kvargbowl med protein", "post-workout", 1, [
    ing("kvarg vanilj", 250), ing("vassleprotein", 20), ing("havregryn", 30), ing("hallon", 80),
  ], "Rör protein i kvarg. Toppa med havregryn och hallon."),

  // === SMOOTHIE (5) ===
  R("sm-01", "Grön proteinsmoothie", "smoothie", 1, [
    ing("spenat", 50), ing("banan", 1, "st"), ing("vassleprotein", 25), ing("mjölk 1.5%", 3, "dl"),
  ], "Mixa allt slätt 30 sek."),
  R("sm-02", "Bärsmoothie med skyr", "smoothie", 1, [
    ing("frysta bär", 150), ing("skyr", 200), ing("mjölk 1.5%", 2, "dl"), ing("honung", 1, "tsk"),
  ], "Mixa allt slätt."),
  R("sm-03", "Choklad-jordnötssmoothie", "smoothie", 1, [
    ing("banan", 1, "st"), ing("jordnötssmör", 1, "msk"), ing("kakao", 1, "msk"), ing("vassleprotein", 25), ing("mjölk 1.5%", 3, "dl"),
  ], "Mixa allt slätt."),
  R("sm-04", "Tropisk smoothie", "smoothie", 1, [
    ing("banan", 1, "st"), ing("kokosmjölk", 1, "dl"), ing("mjölk 1.5%", 2, "dl"), ing("vassleprotein", 25),
  ], "Mixa allt slätt."),
  R("sm-05", "Kaffe-proteinsmoothie", "smoothie", 1, [
    ing("kvarg vanilj", 150), ing("banan", 1, "st"), ing("mjölk 1.5%", 2, "dl"), ing("vassleprotein", 25),
  ], "Mixa med en skvätt kallt kaffe."),

  // === DESSERT (5) ===
  R("de-01", "Proteinchokladpudding", "dessert", 2, [
    ing("kvarg vanilj", 400), ing("vassleprotein", 30), ing("kakao", 2, "msk"), ing("honung", 1, "msk"),
  ], "Rör ihop kvarg, protein, kakao och honung. Kyl 30 min."),
  R("de-02", "Yoghurtglass med bär", "dessert", 2, [
    ing("grekisk yoghurt 10%", 300), ing("frysta bär", 200), ing("honung", 1, "msk"),
  ], "Mixa frysta bär med yoghurt och honung. Servera direkt."),
  R("de-03", "Bakad äppledessert", "dessert", 2, [
    ing("äpple", 2, "st"), ing("havregryn", 50), ing("smör", 20), ing("honung", 1, "msk"),
  ], "Tärna äpplen i form. Blanda havregryn, smör, honung och smula över. Baka 180°C 20 min."),
  R("de-04", "Proteincheesecake", "dessert", 4, [
    ing("kvarg naturell", 500), ing("vassleprotein", 40), ing("havregryn", 80), ing("smör", 30), ing("hallon", 150),
  ], "Mixa havregryn med smör som botten. Blanda kvarg + protein, häll på. Kyl 2 tim. Toppa med hallon."),
  R("de-05", "Chia-jordgubbspudding", "dessert", 2, [
    ing("chiafrön", 40), ing("mjölk 1.5%", 3, "dl"), ing("jordgubbar", 150), ing("honung", 1, "msk"),
  ], "Blanda chia med mjölk och honung. Låt stå över natten. Toppa med mosade jordgubbar."),
];


export const RECIPE_CATEGORIES = [
  "frukost", "lunch", "middag", "mellanmål",
  "pre-workout", "post-workout", "smoothie", "dessert",
] as const;
export type RecipeCategory = typeof RECIPE_CATEGORIES[number];
