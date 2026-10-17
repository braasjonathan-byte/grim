import { describe, it, expect } from "vitest";
import { searchFoods } from "@/lib/foodSearch";

const names = [
  "Mjölk fett 3% berikad", "Mjöl vete", "Öl lättöl vol. % 2,3", "Öl starköl el. exportöl vol. % 5,4",
  "Apelsinjuice kris", "Ris basmati okokt", "Socker", "Sockerärtor", "Lasagne m. cottage cheese veg.",
  "Färskost cottage cheese naturell fett 4%", "Nöt färs rå fett 10%", "Fläsk färs", "Kyckling lår rå u. skinn",
  "Hårt bröd fullkorn råg fibrer ca 13%", "Crème fraiche fett 32%", "Räka kokt", "Sötmandel", "Banan",
].map((name, i) => ({ id: String(i), name, source: "food" }));
const first = (q: string) => searchFoods(names, q)[0]?.name;

describe("searchFoods", () => {
  it("hittar baslivsmedel först", () => {
    expect(first("socker")).toBe("Socker");
    expect(first("keso")).toMatch(/^Färskost cottage/);
    expect(first("nötfärs")).toMatch(/^Nöt färs/);
    expect(first("kycklinglår")).toMatch(/^Kyckling lår/);
    expect(first("knäckebröd")).toMatch(/^Hårt bröd/);
    expect(first("creme fraiche")).toMatch(/^Crème fraiche/);
    expect(first("räkor")).toBe("Räka kokt");
    expect(first("mandlar")).toBe("Sötmandel");
  });
  it("öl före mjöl, ris före apelsinjuice", () => {
    const ol = searchFoods(names, "öl").map((r) => r.name);
    expect(ol[0]).toMatch(/^Öl/);
    expect(ol.indexOf("Mjöl vete")).toBeGreaterThan(1);
    expect(first("ris")).toBe("Ris basmati okokt");
  });
  it("alla ord i valfri ordning", () => {
    expect(first("färs nöt")).toMatch(/^Nöt färs/);
  });
  it("butiksnamn mappas till Livsmedelsverkets namn", () => {
    const extra = [
      "Kyckling lår rå", "Mussla", "Isbergssallat", "Squash", "Champinjon", "Rödbeta", "Lök röd",
      "Bröd fullkorn", "Spagetti", "Ris basmati", "Pannkaka tunn", "Solrosfrö", "Läsk cola",
      "Mykoprotein", "Grädde visp", "Sylt hallon", "Soja", "Tortilla", "Kyckling färs", "Makaroner",
    ].map((name, i) => ({ id: `x${i}`, name, source: "food" }));
    const all = [...names, ...extra];
    const f = (q: string) => searchFoods(all, q)[0]?.name;
    expect(f("kycklinglårfilé")).toMatch(/^Kyckling lår/);
    expect(f("musslor")).toBe("Mussla");
    expect(f("isbergssallad")).toBe("Isbergssallat");
    expect(f("zucchini")).toBe("Squash");
    expect(f("champinjoner")).toBe("Champinjon");
    expect(f("rödbetor")).toBe("Rödbeta");
    expect(f("rödlök")).toBe("Lök röd");
    expect(f("fullkornsbröd")).toMatch(/^Bröd fullkorn/);
    expect(f("spaghetti")).toBe("Spagetti");
    expect(f("basmatiris")).toMatch(/^Ris basmati/); // "Ris basmati okokt" är vanlig vara och får gå först
    expect(f("pannkakor")).toMatch(/^Pannkaka/);
    expect(f("solroskärnor")).toBe("Solrosfrö");
    expect(f("coca-cola")).toBe("Läsk cola");
    expect(f("quorn")).toBe("Mykoprotein");
    expect(f("vispgrädde")).toMatch(/^Grädde visp/);
    expect(f("hallonsylt")).toBe("Sylt hallon");
    expect(f("sojasås")).toBe("Soja");
    expect(f("vetetortilla")).toBe("Tortilla");
    expect(f("kycklingfärs")).toMatch(/^Kyckling färs/);
    expect(f("makaroner")).toBe("Makaroner");
  });
  it("råvaror före rätter och inälvsmat, efterled och böjningar", () => {
    const real = [
      "Kyckling mage rå", "Kyckling lever rå", "Kyckling hjärta rå", "Kyckling bröstfilé rå u. skinn",
      "Gräddersättning pulver fett 35%", "Löksås m. grädde", "Vispgrädde fett 40%",
      "Syltlök inlagd", "Rismål m. sylt", "Hallonsylt",
      "Soja- och veteprotein färs stekt", "Sojasås",
      "Chips majs tortilla", "Taco tortilla m. köttfärs grönsaker ost", "Bröd vitt vetetortilla",
      "Pizza Funghi m. champinjoner restaurang", "Champinjon", "Rödbeta", "Pannkaka tunn hemlagad",
      "Köttfärssås Vivaldi nöt m. squash majs paprika rödlök ost", "Lök röd",
      "Gröna bönor", "Vaxbönor", "Tomat krossad konserv. m. lag", "Bröd fullkorn råg fibrer ca 7%",
    ].map((name, i) => ({ id: `r${i}`, name, source: "food" }));
    const f = (q: string) => searchFoods(real, q)[0]?.name;
    expect(f("kycklingfilé")).toBe("Kyckling bröstfilé rå u. skinn");
    expect(f("grädde")).toBe("Vispgrädde fett 40%");
    expect(f("sylt")).toBe("Hallonsylt");
    expect(f("soja")).toBe("Sojasås");
    expect(f("tortilla")).toBe("Bröd vitt vetetortilla");
    expect(f("champinjoner")).toBe("Champinjon");
    expect(f("rödbetor")).toBe("Rödbeta");
    expect(f("pannkakor")).toMatch(/^Pannkaka/);
    expect(f("rödlök")).toBe("Lök röd");
    expect(f("bönor")).toBe("Gröna bönor");
    expect(f("krossade tomater")).toMatch(/^Tomat krossad/);
    expect(f("rågbröd")).toMatch(/^Bröd fullkorn råg/);
    expect(f("kycklinglever")).toBe("Kyckling lever rå"); // inälvsmat när man ber om den
  });
  it("täcker vanligt användarbeteende (böjningar, utan å/ä/ö, engelska, märken, stavfel, påbörjade ord)", () => {
    const real = [
      "Mjölk fett 3% berikad", "Mjöl vete", "Mellanmjölk fett 1,5% berikad", "Ägg kokt", "Ägg rått", "Nudlar äggnudlar okokta",
      "Ost hårdost fett 28%", "Ostkaka", "Färskost cottage cheese naturell fett 4%", "Färskost cream cheese fett 27%",
      "Kvarg naturell fett 0,2%", "Havredryck fett 1,5% berikad", "Sojadryck berikad", "Nöt färs rå fett 10%", "Köttfärs stekt tacokryddad",
      "Kyckling bröstfilé rå u. skinn", "Kyckling lår rå u. skinn", "Kyckling vinge rå m. skinn", "Gris skinka skivad rökt fett 1-3%",
      "Lax odlad Norge fjordlax rå", "Lax kallrökt", "Morot", "Morot kokt m. salt", "Broccoli", "Squash", "Gratäng zucchinigratäng m. kalvfärs",
      "Vispgrädde fett 40%", "Gräddfil fett 12%", "Gräddtårta", "Gröna bönor", "Bön stroganoff veg.", "Banan", "Bananchips",
      "Socker", "Vin rött vol. % 14", "Läsk cola", "Läsk cola light", "Energidryck berikad", "Nötkräm chokladkräm", "Hårt bröd fullkorn råg fibrer ca 13%",
      "Knäck", "Ost hårdost parmesan fett 30% typ Parmiggiano Reggiano", "Varm choklad m. mjölk fett 3%", "Frukostflingor müsli fullkorn m. frukt",
      "Salladsost fett 22%", "Jordnötssmör", "Ris basmati okokt", "Pasta okokt", "Margarin hushållsmargarin", "Smör fett 80%",
    ].map((name, i) => ({ id: `u${i}`, name, source: "food" }));
    const f = (q: string) => searchFoods(real, q)[0]?.name;
    const top = (q: string, n = 3) => searchFoods(real, q).slice(0, n).map((r) => r.name);
    // utan å/ä/ö
    expect(f("mjolk")).toBe("Mjölk fett 3% berikad");
    expect(f("agg")).toMatch(/^Ägg/);
    expect(f("notfars")).toMatch(/^Nöt färs/);
    expect(f("smor")).toBe("Smör fett 80%");
    // böjningar och bestämd form
    expect(f("osten")).toMatch(/^Ost hårdost/);
    expect(f("morötter")).toBe("Morot");
    expect(f("kesot")).toMatch(/cottage cheese/);
    expect(f("äggen")).toMatch(/^Ägg/);
    expect(f("sockret")).toBe("Socker");
    expect(f("bönor")).toBe("Gröna bönor");
    expect(f("kycklingfiléer")).toMatch(/^Kyckling bröstfilé/);
    // engelska, märken och butiksnamn
    expect(f("chicken breast")).toMatch(/^Kyckling bröstfilé/);
    expect(f("oat milk")).toMatch(/^Havredryck/);
    expect(f("oatly")).toMatch(/^Havredryck/);
    expect(f("philadelphia")).toMatch(/cream cheese/);
    expect(f("nutella")).toBe("Nötkräm chokladkräm");
    expect(f("kesella")).toMatch(/^Kvarg/);
    expect(f("pepsi max")).toBe("Läsk cola light");
    expect(f("red bull")).toBe("Energidryck berikad");
    expect(f("rödvin")).toMatch(/^Vin rött/);
    expect(f("fetaost")).toMatch(/^Salladsost/);
    expect(f("wasa")).toMatch(/^Hårt bröd/);
    // stavfel
    expect(f("brokkoli")).toBe("Broccoli");
    expect(f("kyklling")).toMatch(/^Kyckling/);
    expect(f("zuccini")).toBe("Squash");
    expect(f("kötfärs")).toMatch(/^Nöt färs/);
    // påbörjade ord
    expect(f("zucc")).toBe("Squash");
    expect(f("parm")).toMatch(/parmesan/);
    expect(top("gräd")).toContain("Vispgrädde fett 40%");
    expect(top("knäc")).toContain("Hårt bröd fullkorn råg fibrer ca 13%");
    expect(f("parm")).not.toMatch(/^Varm/); // påbörjat ord ska inte "rättas"
    // flera ord där ett inte finns i databasen
    expect(f("bananen mogen")).toBe("Banan");
    expect(f("laxbitar")).toMatch(/^Lax/);
    expect(f("musli med frukt")).toMatch(/müsli/);
    expect(f("salmon fillet")).toMatch(/^Lax/);
    // exakta träffar påverkas inte
    expect(f("mjöl")).toBe("Mjöl vete");
    expect(f("ost")).toMatch(/^Ost hårdost/);
    expect(searchFoods(real, "mjölk").map((r) => r.name)).not.toContain("Mjöl vete");
  });
});
