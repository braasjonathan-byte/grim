/**
 * Ordbaserad livsmedelssökning: alla sökord måste finnas i namnet (valfri ordning), accent-okänslig
 * (é→e; å/ä/ö matchar även utan prickar: "mjolk" → "Mjölk"), svenska böjningar ("osten", "rödbetor"),
 * sammansatta ord ("nötfärs" → "Nöt färs"), synonymer (butiksnamn, engelska, märken) och stavningsrättning.
 */

const ACCENTS: Record<string, string> = {
  é: "e", è: "e", ê: "e", ë: "e", á: "a", à: "a", â: "a", í: "i", ì: "i", î: "i", ï: "i",
  ó: "o", ò: "o", ô: "o", ú: "u", ù: "u", û: "u", ü: "u", ç: "c", ñ: "n", ø: "ö", æ: "ä",
};

export function normalizeFoodText(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[éèêëáàâíìîïóòôúùûüçñøæ]/g, (c) => ACCENTS[c] || c)
    .replace(/[^a-z0-9åäö%]+/g, " ")
    .trim();
}

/** Sökord (normaliserat) → extra söktermer. */
export const FOOD_SYNONYMS: Record<string, string[]> = {
  socker: ["socker strö", "socker"],
  keso: ["cottage cheese"],
  hushallsost: ["ost hård"],
  hushållsost: ["ost hård"],
  cheddar: ["ost hård"],
  knackebrod: ["hårt bröd"],
  knäckebröd: ["hårt bröd"],
  standardmjolk: ["mjölk fett 3%"],
  standardmjölk: ["mjölk fett 3%"],
  proteinpulver: ["proteinpulver", "vassle", "whey", "kasein", "protein pulver"],
  vassle: ["proteinpulver", "whey", "vassle"],
  vassleprotein: ["proteinpulver", "vassle", "whey"],
  kasein: ["proteinpulver", "kasein"],
  casein: ["kasein", "proteinpulver"],
  gainer: ["gainer", "proteinpulver"],
  bcaa: ["bcaa", "aminosyror"],
  kreatin: ["kreatin", "creatine"],
  creatine: ["kreatin"],
  proteinbar: ["proteinbar", "protein bar"],
  proteinpudding: ["proteinpudding", "pudding protein", "kvarg smaksatt"],
  proteindryck: ["proteindryck", "proteinshake", "måltidsersättning"],
  proteinshake: ["proteindryck", "proteinshake", "måltidsersättning"],
  räkor: ["räka"],
  rakor: ["räka"],
  mandlar: ["sötmandel"],
  mandel: ["sötmandel"],
  "creme fraiche": ["creme fraiche"],
  cremefraiche: ["creme fraiche"],
  mjolk: ["mjölk"], ost: ["ost"], agg: ["ägg"], farsk: ["färsk"], kottfars: ["nöt färs", "köttfärs"],
  kycklingfile: ["kyckling bröstfilé", "kyckling filé", "kycklingfilé"], kycklingbrost: ["kyckling bröst", "kyckling"],
  whey: ["proteinpulver", "vassle"], protein: ["proteinpulver"],
  energigel: ["sportgel", "energigel", "druvsocker"], gel: ["sportgel", "energigel"], sportdryck: ["sportdryck"],
  // Livsmedelsverkets namn skiljer sig från butiksnamnet
  cocacola: ["läsk cola"],
  pepsi: ["läsk cola"],
  herrgårdsost: ["ost hårdost"], grevé: ["ost hårdost"], greve: ["ost hårdost"], västerbottensost: ["ost hårdost fett 31%"],
  "o boy": ["chokladdryckspulver"], nesquik: ["chokladdryckspulver"],
  pumpakärnor: ["pumpafrö"],
  penne: ["pasta"], fusilli: ["pasta"], tagliatelle: ["pasta"],
  kinasoja: ["sojasås"], tortillabröd: ["vetetortilla"],
  gullök: ["lök gul"], vitlöksklyfta: ["vitlök"],
  wraps: ["vetetortilla"], wrap: ["vetetortilla", "wrap"], sylt: ["jordgubbssylt", "blåbärssylt"],
  // Engelska vardagsord
  rice: ["ris"], oatmeal: ["havregryn", "gröt havre"], oats: ["havregryn"], chicken: ["kyckling"], milk: ["mjölk"],
  egg: ["ägg"], eggs: ["ägg"], bread: ["bröd"], cheese: ["ost"], banana: ["banan"], apple: ["äpple"], potato: ["potatis"],
  pasta: ["pasta", "makaroner", "spagetti"], salmon: ["lax"], beef: ["nöt"], pork: ["fläsk"], butter: ["smör"],
  yoghurt: ["yoghurt"], yogurt: ["yoghurt"], tuna: ["tonfisk"], coffee: ["kaffe"], tea: ["te"],
  // Vanliga butiksnamn → Livsmedelsverkets namn
  fetaost: ["salladsost", "feta", "ost feta"], feta: ["salladsost", "feta"], // ren fårfeta saknas i Livsmedelsverkets data
  flaskfars: ["fläsk färs", "gris färs"], fläskfärs: ["fläsk färs", "gris färs"],
  kycklinglarfile: ["kyckling lår"], kycklinglårfilé: ["kyckling lår"],
  kycklingbrostfile: ["kyckling bröstfilé", "kyckling bröst"], kycklingbröstfilé: ["kyckling bröstfilé", "kyckling bröst"],
  kycklingfars: ["kyckling färs"], kycklingfärs: ["kyckling färs"],
  musslor: ["mussla"], isbergssallad: ["isbergssallat", "sallad isberg"],
  zucchini: ["squash"], champinjoner: ["champinjon"], champinjon: ["champinjon"],
  rodbetor: ["rödbeta"], rödbetor: ["rödbeta"], rodbeta: ["rödbeta"], rödbeta: ["rödbeta"],
  rodlok: ["lök röd"], rödlök: ["lök röd"],
  ragbrod: ["råg bröd", "bröd råg"], rågbröd: ["råg bröd", "bröd råg"],
  fullkornsbrod: ["bröd fullkorn"], fullkornsbröd: ["bröd fullkorn"],
  spaghetti: ["spagetti", "pasta"], spagetti: ["spagetti", "pasta"],
  makaroner: ["makaroner", "pasta"],
  basmatiris: ["ris basmati"], pannkakor: ["pannkaka"], pannkaka: ["pannkaka"],
  solroskarnor: ["solrosfrö"], solroskärnor: ["solrosfrö"], solrosfron: ["solrosfrö"], solrosfrön: ["solrosfrö"],
  "coca-cola": ["läsk cola", "läsk"], "coca cola": ["läsk cola", "läsk"], cola: ["läsk cola", "läsk"], lask: ["läsk"], läsk: ["läsk"],
  quorn: ["mykoprotein"],
  prastost: ["ost hårdost fett 31%", "ost hård", "ost präst"], prästost: ["ost hårdost fett 31%", "ost hård", "ost präst"],
  "krossade tomater": ["tomat krossad", "krossade tomater"], krossadetomater: ["tomat krossad"],
  oboy: ["kakaodryck", "chokladdryck", "chokladdryckspulver", "oboy"], chokladdryck: ["kakaodryck", "oboy"],
  vegoburgare: ["vego burgare", "burgare veg", "grönsaksbiff", "sojafärs"], vego: ["vego", "sojafärs"],
  vispgradde: ["grädde visp", "vispgrädde"], vispgrädde: ["grädde visp", "vispgrädde"],
  gradde: ["grädde visp", "grädde", "mellangrädde", "matlagningsgrädde"], grädde: ["grädde visp", "grädde", "mellangrädde", "matlagningsgrädde"],
  hallonsylt: ["sylt hallon"], sojasas: ["soja"], sojasås: ["soja"],
  tortilla: ["tortilla"], vetetortilla: ["tortilla"],

  // ── Utökad täckning (butiksnamn, engelska, märken, böjningar, vanliga felstavningar) ──
  // Nycklarna normaliseras och å/ä/ö-viks vid uppslag, så "smor" hittar "smör" automatiskt.
  // Mejeri
  "standard mjölk": ["mjölk fett 3%"], mjölkar: ["mjölk"],
  "laktosfri mjölk": ["mjölk laktosfri", "laktosfri"], "mjölk laktosfri": ["laktosfri"],
  fil: ["filmjölk"], afil: ["filmjölk a-fil"], "a fil": ["filmjölk a-fil"], långfil: ["filmjölk långfil"],
  joghurt: ["yoghurt"], jogurt: ["yoghurt"], yougurt: ["yoghurt"], yoghurtar: ["yoghurt"],
  "grekisk yoghurt": ["yoghurt typ grekisk", "yoghurt naturell fett 10%"], "grekisk yogurt": ["yoghurt typ grekisk", "yoghurt naturell fett 10%"],
  "turkisk yoghurt": ["yoghurt naturell fett 10%"], "turkisk yogurt": ["yoghurt naturell fett 10%"],
  vaniljyoghurt: ["yoghurt mild vanilj"], "vanilj yoghurt": ["yoghurt mild vanilj"],
  kvarg: ["kvarg"], quark: ["kvarg"], kvark: ["kvarg"], kesella: ["kvarg naturell", "kvarg färskost"],
  vaniljkvarg: ["kvarg smaksatt"], "vanilj kvarg": ["kvarg smaksatt"], proteinkvarg: ["kvarg naturell", "kvarg smaksatt"],
  proteinyoghurt: ["kvarg naturell", "kvarg smaksatt"],   keson: ["cottage cheese"], kesot: ["cottage cheese"], cottage: ["cottage cheese"], cottagecheese: ["cottage cheese"],
  "cottage cheese": ["färskost cottage cheese naturell", "cottage cheese"],
  grädden: ["grädde visp", "vispgrädde"], matgrädde: ["matlagningsgrädde"], "matlagnings grädde": ["matlagningsgrädde"],
  "creme fraish": ["crème fraiche"], "creme fresh": ["crème fraiche"], "crem fraiche": ["crème fraiche"], fraiche: ["crème fraiche"],
  smörr: ["smör"], smöret: ["smör"], bregott: ["bregott"], lätta: ["lättmargarin lätta"], "lätt och lagom": ["lätt & lagom"],
  osten: ["ost hårdost"], ostar: ["ost hårdost"], "hushålls ost": ["ost hård"], herrgård: ["ost hårdost"],
  "präst ost": ["ost hårdost fett 31%"], grevéost: ["ost hårdost"], västerbotten: ["ost hårdost fett 31%"],
  cheddarost: ["ost hårdost"], gouda: ["ost hårdost"], goudaost: ["ost hårdost"], edamer: ["ost hårdost fett 23%", "ost hårdost"],
  "riven ost": ["ost hårdost"], skivad: ["skivad"], parmigiano: ["parmesan"], "grana padano": ["parmesan"], parmesanost: ["parmesan"],
  mozarella: ["mozzarella"], mozzarellaost: ["mozzarella"], fetost: ["salladsost", "feta"], salladsost: ["salladsost"],
  halloumiost: ["halloumi"], haloumi: ["halloumi"], hallumi: ["halloumi"], getost: ["getost chèvre"], chevre: ["chèvre"],
  blåmögelost: ["ädelost blågrön mögelost"], gorgonzola: ["ädelost"], grönmögelost: ["ädelost grönmögelost"], blåmögel: ["ädelost"],
  "mjuk ost": ["mjukost"], "färsk ost": ["färskost"], philadelphia: ["färskost cream cheese"], "cream cheese": ["färskost cream cheese"],
  havremjölk: ["havredryck"], "havre dryck": ["havredryck"], havredrick: ["havredryck"], oatly: ["havredryck"], ikaffe: ["havredryck"],
  sojamjölk: ["sojadryck"], alpro: ["sojadryck", "soygurt"], mandelmjölk: ["mandeldryck"], kokosdryck: ["kokosnötdryck"],
  ägget: ["ägg"], äggen: ["ägg"], "kokta ägg": ["ägg kokt"], "stekta ägg": ["ägg stekt"], äggvitor: ["äggvita"], äggulor: ["äggula"],
  omelet: ["omelett"],
  // Kött och chark
  kötfärs: ["nöt färs", "köttfärs"], köttfärsen: ["nöt färs", "köttfärs"], "nöt färs": ["nöt färs"], "bland färs": ["blandfärs"],
  "fläsk färs": ["gris färs"], griskött: ["gris kött"], fläskkött: ["gris kött"], lammfärs: ["lamm färs"], älgfärs: ["älg färs"],
  viltfärs: ["älg färs", "hjort färs", "vilt färs"], entrecote: ["entrecôte"], entrecoten: ["entrecôte"], oxfile: ["oxfilé"],
  fläskfile: ["fläskfilé"], kotlett: ["fläskkotlett", "kotlett"], kotletter: ["fläskkotlett", "kotlett"], karré: ["fläskkarré"],
  baconet: ["bacon"], "kokt skinka": ["skinka kokt", "skinka rökt", "skinka skivad"], skinkan: ["skinka"], skinkor: ["skinka"],
  pålägg: ["skinka skivad", "kalkon rökt", "påläggskorv"], spareribs: ["revbensspjäll"], revben: ["revbensspjäll"],
stekfläsk: ["stekfläsk", "sidfläsk"], nötkött: ["nöt kött"],
  burgare: ["hamburgare", "burgare"], hamburgerkött: ["hamburgare nöt"], hamburgarna: ["hamburgare"],
  kötbullar: ["köttbullar"], köttbulle: ["köttbullar"], "falu korv": ["falukorv"], "grill korv": ["grillkorv"],
  varmkorv: ["korv varmkorv"], korvar: ["korv"], leverpastey: ["leverpastej"], kebabkött: ["kebabkött"],
  kycklingfiléer: ["kyckling bröstfilé"], "kyckling filé": ["kyckling bröstfilé"], "kyckling bröst": ["kyckling bröstfilé"],
  kycklinglårfiléer: ["kyckling lår"], kykling: ["kyckling"], kyklling: ["kyckling"], kyckling: ["kyckling"],
  grillkyckling: ["kyckling grillad"], kycklingvingar: ["kyckling vinge"], kycklingvinge: ["kyckling vinge"], "chicken wings": ["kyckling vinge"],
  nuggets: ["kyckling nugget", "nugget"], kycklingnuggets: ["kyckling nugget"], kycklingnugget: ["kyckling nugget"],
  // Fisk och skaldjur
  laxfilé: ["lax odlad", "lax vild", "lax"], "lax filé": ["lax odlad", "lax"], "rökt lax": ["lax kallrökt", "lax varmrökt"],
  gravlax: ["lax gravad"], torskfilé: ["torsk filé", "torsk"], sejfilé: ["sej"], "tonfisk på burk": ["tonfisk konserv"],
  räkorna: ["räka"], skagenröra: ["skagenröra", "räkröra"], kräftor: ["kräfta"], kräftstjärtar: ["kräfta kräftstjärtar"],
  blåmusslor: ["blåmussla", "mussla"], fiskpinne: ["fiskpinnar"], "kalles kaviar": ["påläggskaviar"], kalles: ["påläggskaviar"],
  kaviar: ["påläggskaviar", "kaviar"], crabsticks: ["surimi"], calamari: ["bläckfisk"], regnbåge: ["regnbågslax"],
  // Grönsaker, rotfrukter, baljväxter
  potates: ["potatis"], potatisar: ["potatis"], "söt potatis": ["sötpotatis"], pommes: ["pommes frites"], "pommes frittes": ["pommes frites"],
  mos: ["potatismos", "mos"], morötter: ["morot"], morötterna: ["morot"], moröt: ["morot"], morrot: ["morot"],
  cocktailtomater: ["tomat körsbärstomat"], cherrytomater: ["tomat körsbärstomat"], körsbärstomater: ["tomat körsbärstomat"],
  körsbärstomat: ["tomat körsbärstomat"], "krossad tomat": ["tomat krossad"], tomatpure: ["tomatpuré"],
  "röd paprika": ["paprika röd"], "gul lök": ["lök gul"], löken: ["lök gul", "lök"], "röd lök": ["lök röd"],
  purjo: ["purjolök"], brocoli: ["broccoli"], brokkoli: ["broccoli"], brockoli: ["broccoli"], bladspenat: ["spenat"],
  sallad: ["sallat", "isbergssallat", "huvudsallat"], sallat: ["sallat"], isberg: ["isbergssallat"], isbergsallad: ["isbergssallat"],
  rucola: ["ruccola"], ruccolasallad: ["ruccolasallat"], avocado: ["avokado"], zuccini: ["squash"], aubergin: ["aubergine"],
  kantareller: ["kantarell"], svamp: ["champinjon", "kantarell", "svamp"], "majs på burk": ["majskorn konserv"], majs: ["majskorn", "majs"],
  ärter: ["ärtor"], ärtor: ["gröna ärtor", "ärtor"], "haricots verts": ["gröna bönor"], "haricot verts": ["gröna bönor"],
  kidneybönor: ["kidneybönor", "kidney bönor"], "röda bönor": ["kidneybönor röda bönor", "röda bönor"], kikärter: ["kikärtor"], kikärta: ["kikärtor"],
  edamame: ["sojabönor färska"], edamamebönor: ["sojabönor färska"], blekselleri: ["stjälkselleri"], selleri: ["stjälkselleri", "rotselleri"],
  rädisor: ["rädisa"], chili: ["chilipeppar", "chili"], oliv: ["oliver"], groddar: ["groddar"],
  "frysta grönsaker": ["grönsaksblandning frysvara", "wokgrönsaker"], grönsaksmix: ["grönsaksblandning"], "inlagd gurka": ["gurka inlagd", "ättiksgurka"],
  sojafärs: ["sojaprotein färs", "soja- och veteprotein färs"], "soja färs": ["sojaprotein färs"],
  vegofärs: ["sojaprotein färs", "ärtprotein färs", "mykoprotein färs", "soja- och veteprotein färs"], "vego färs": ["sojaprotein färs", "ärtprotein färs"],
  vegokorv: ["korv veg"], "vegansk korv": ["korv veg"], vegetarisk: ["veg"], oumph: ["oumph"], anamma: ["sojaprotein", "soja- och veteprotein"],
  // Frukt och bär
  äple: ["äpple"], äpplen: ["äpple"], bannan: ["banan"], bananer: ["banan"],
  clementin: ["småcitrus clementin"], clementiner: ["småcitrus clementin"], klementin: ["småcitrus clementin"], mandarin: ["småcitrus mandarin", "mandarin"],
  mandariner: ["småcitrus mandarin"], satsumas: ["småcitrus"], grape: ["grapefrukt"], druvor: ["vindruvor"], vindruva: ["vindruvor"],
  jordgubbe: ["jordgubbar"], jordgubb: ["jordgubbar"], dadel: ["dadlar"], "torkad frukt": ["frukt torkad"], melon: ["vattenmelon", "honungsmelon", "melon"],
  // Spannmål, pasta, bröd
  havregrin: ["havregryn"], "havregryns gröt": ["havregrynsgröt"], musli: ["müsli"], muesli: ["müsli"], mysli: ["müsli"],
  "corn flakes": ["cornflakes"], flingor: ["frukostflingor"], riset: ["ris"], basmati: ["ris basmati"], jasminris: ["ris jasmin"], "jasmin ris": ["ris jasmin"],
  fullkornsris: ["ris råris", "råris"], spagettin: ["spagetti", "pasta"], makaron: ["makaroner", "pasta"], pastan: ["pasta"],
  fullkornspasta: ["pasta fullkorn"], lasagneplattor: ["lasagneplattor"], noodles: ["nudlar"], äggnudlar: ["nudlar äggnudlar"], risnudlar: ["nudlar risnudlar"],
  "cous cous": ["couscous"], kinoa: ["quinoa"], qinoa: ["quinoa"], knäcke: ["hårt bröd"], brödet: ["bröd"], limpa: ["bröd limpa", "bröd"],
  "råg bröd": ["bröd råg"], "fullkorns bröd": ["bröd fullkorn"], franskbröd: ["formfranska"], "vitt bröd": ["formfranska", "bröd vitt"],
  rostbröd: ["formfranska"], toast: ["formfranska"], polarbröd: ["tunnbröd"], pita: ["pitabröd"], hamburgerbrod: ["hamburgerbröd"],
  kanelbullar: ["kanelbulle"], kanelbullen: ["kanelbulle"], skorpa: ["skorpor"], riskaka: ["riskaka"], riskakor: ["riskaka"],
  mjöl: ["vetemjöl", "mjöl"], maizena: ["majsstärkelse"], surdeg: ["surdeg"],
  // Fett, nötter, frön
  "olivolja extra virgin": ["olivolja extra jungfruolja"], "oliv olja": ["olivolja"], "raps olja": ["rapsolja"],
  olja: ["rapsolja", "olivolja", "solrosolja"], matolja: ["rapsolja", "olivolja", "solrosolja"],
  jordnöt: ["jordnötter"], jordnötsmör: ["jordnötssmör"], cashew: ["cashewnötter"], cashewnöt: ["cashewnötter"],
  hasselnöt: ["hasselnötter"], valnöt: ["valnötter"], pistage: ["pistaschnötter"], pistagenötter: ["pistaschnötter"], pistaschnöt: ["pistaschnötter"],
  macadamia: ["macadamianötter"], nötmix: ["nötter blandade"], chia: ["chiafrö"], chiafrön: ["chiafrö"], linfrön: ["linfrö"],
  sesamfrön: ["sesamfrö"], pumpafrön: ["pumpafrö"],
  // Sött, snacks
  strösocker: ["socker"], florsocker: ["florsocker", "socker"], farinsocker: ["brun farin"], "brunt socker": ["brun farin"],
  kakao: ["kakaopulver"], lösgodis: ["godis", "gelégodis", "naturgodis"], potatischips: ["chips potatis"], glassen: ["glass"],
  "protein bar": ["proteinbar"], müslibar: ["bar müslibar"], nutella: ["nötkräm chokladkräm"], nötkräm: ["nötkräm"],
  marabou: ["mjölkchoklad"], daim: ["daim", "mjölkchoklad"], snickers: ["mjuk nougat m. kolasås jordnötter"],
  kexchoklad: ["kex m. mjölkchokladöverdrag"], ballerina: ["kex m. fyllning"], "cheez doodles": ["ostbågar"], olw: ["chips"], pringles: ["chips potatis"],
  // Drycker
  kaffet: ["kaffe"], bryggkaffe: ["kaffe bryggt"], teet: ["te"], "apelsin juice": ["apelsinjuice"], coke: ["läsk cola"],   "pepsi max": ["läsk cola light"], "cola zero": ["läsk cola light"], "coca cola zero": ["läsk cola light"], "cola light": ["läsk cola light"],
  fanta: ["läsk"], sprite: ["läsk"], ölen: ["öl"], rödvin: ["vin rött"], "rött vin": ["vin rött"], vitvin: ["vin vitt"], "vitt vin": ["vin vitt"],
  "red bull": ["energidryck"], redbull: ["energidryck"], monster: ["energidryck"], nocco: ["energidryck"], celsius: ["energidryck"],
  powerade: ["sportdryck"], gatorade: ["sportdryck"], festis: ["fruktdryck"], "kolsyrat vatten": ["mineralvatten", "sodavatten"], bubbelvatten: ["mineralvatten"],
  chokladmjölk: ["chokladdryck", "mjölkdryck"], "choklad mjölk": ["chokladdryck"], gainomax: ["proteindryck", "mjölkdryck"],
  // Såser, kryddor
  ketsup: ["ketchup"], kethup: ["ketchup"], majonäs: ["majonnäs"], majonnäsen: ["majonnäs"], mayo: ["majonnäs"], majo: ["majonnäs"],
  bearnaise: ["bearnaisesås"], bea: ["bearnaisesås"], remoulad: ["remouladsås"], "sweet chili": ["sweet chilisås"],
  buljongtärning: ["buljong tärning", "köttbuljong tärning"], svartpeppar: ["peppar"], tacokrydda: ["kryddblandning taco"],
  gräddsås: ["gräddsås", "brunsås m. buljong grädde"], "pytt i panna": ["pytt i panna", "pyttipanna"], taco: ["taco"], tacos: ["taco"],
  // Märken
  wasa: ["hårt bröd"], leksands: ["hårt bröd"], "finn crisp": ["finn crisp"], barilla: ["pasta"], risifrutti: ["rismål"], mannafrutti: ["mannagryns", "rismål"],
  // Engelska
  "chicken breast": ["kyckling bröstfilé"], "peanut butter": ["jordnötssmör"], "ground beef": ["nöt färs"], "minced meat": ["nöt färs", "färs"],
  spinach: ["spenat"], cucumber: ["gurka"], tomato: ["tomat"], tomatoes: ["tomat"], onion: ["lök"], garlic: ["vitlök"], carrot: ["morot"], carrots: ["morot"],
  "sweet potato": ["sötpotatis"], orange: ["apelsin"], strawberries: ["jordgubbar"], strawberry: ["jordgubbar"], blueberries: ["blåbär"],
  "greek yogurt": ["yoghurt typ grekisk", "yoghurt naturell fett 10%"], beer: ["öl"], wine: ["vin"], ham: ["skinka"], sausage: ["korv"],
  shrimp: ["räka"], shrimps: ["räka"], prawns: ["räka"], chocolate: ["choklad"], "ice cream": ["glass"], nuts: ["nötter"], almonds: ["sötmandel"],
  honey: ["honung"], sugar: ["socker"], flour: ["vetemjöl"], "rice cakes": ["riskaka"], "oat milk": ["havredryck"], "soy milk": ["sojadryck"],
  "almond milk": ["mandeldryck"], cream: ["grädde"], "sour cream": ["gräddfil"], "whipped cream": ["vispgrädde"], lentils: ["linser"],
  chickpeas: ["kikärtor"], beans: ["bönor"], mushrooms: ["champinjon"], mushroom: ["champinjon"], corn: ["majskorn"], peas: ["gröna ärtor"],
  lemon: ["citron"], grapes: ["vindruvor"], pear: ["päron"], fries: ["pommes frites"], bacon: ["bacon"], turkey: ["kalkon"], lamb: ["lamm"],
  fillet: ["filé"], filet: ["filé"], boiled: ["kokt"], cooked: ["kokt"], fried: ["stekt"], raw: ["rå"], frozen: ["frysvara"],
  smoked: ["rökt"], unsalted: ["osaltat"], salted: ["saltat"], sliced: ["skivad"], fresh: ["färsk"], dried: ["torkad"], canned: ["konserv"],
  älgkött: ["älg"], hjortkött: ["hjort"], renkött: ["ren kött"], rådjurskött: ["rådjur"], viltkött: ["älg", "hjort", "rådjur", "vildsvin", "ren kött"],
  vaniljglass: ["glass vaniljsmak", "vaniljglass"],
  frysta: ["frysvara"], fryst: ["frysvara"], frysvara: ["frysvara"], sockret: ["socker"], vattnet: ["vatten"],
  cod: ["torsk"], broccoli: ["broccoli"], };

/** Sökord där butiksbetydelsen ska rankas FÖRE direktträffar ("soja" i butiken = sojasås). */
export const FOOD_PREFERRED: Record<string, string[]> = {
  soja: ["sojasås"], tortilla: ["vetetortilla"], grädde: ["vispgrädde"], sylt: ["hallonsylt", "lingonsylt"],
  majs: ["majskorn"], chili: ["chilipeppar"], sallad: ["isbergssallat", "huvudsallat"], mos: ["potatismos"],
  olja: ["rapsolja", "olivolja"], mjöl: ["vetemjöl"], kotlett: ["fläskkotlett"], burgare: ["hamburgare"],
  flingor: ["frukostflingor"], nuggets: ["kyckling nugget"], wrap: ["vetetortilla"], wraps: ["vetetortilla"],
  "vitt bröd": ["formfranska"], ärtor: ["gröna ärtor"], ärter: ["gröna ärtor"], melon: ["vattenmelon", "honungsmelon"], svamp: ["champinjon"],
  halloumi: ["ost halloumi"], kyckling: ["kyckling bröstfilé"], högrev: ["nöt högrev"], choklad: ["mjölkchoklad", "mörk choklad"],
  godis: ["gelégodis", "naturgodis"], buljong: ["köttbuljong tärning", "hönsbuljong", "grönsaksbuljong"], vaniljglass: ["glass vaniljsmak"],
  nötter: ["nötter blandade naturella"], pizza: ["pizza capricciosa", "pizza hawaii", "pizza m ost"], lasagne: ["lasagne"], sushi: ["sushi"],
  fil: ["filmjölk"], fetaost: ["salladsost"], feta: ["salladsost"], "a fil": ["filmjölk a-fil"], afil: ["filmjölk a-fil"], pålägg: ["skinka skivad"], kaviar: ["påläggskaviar"], kakao: ["kakaopulver"], olw: ["chips"],
};

/** "mjölk" → "mjolk": å/ä→a, ö→o, för sökningar utan prickar. */
export function foldSwedish(s: string): string {
  return s.replace(/[åä]/g, "a").replace(/ö/g, "o");
}
const HAS_SWE = /[åäö]/;

type Index = Map<string, string[]>;
let synIdx: Index | null = null;
let prefIdx: Index | null = null;
function buildIndex(table: Record<string, string[]>): Index {
  const m: Index = new Map();
  for (const [k, v] of Object.entries(table)) {
    const n = normalizeFoodText(k);
    for (const key of new Set([n, foldSwedish(n), n.replace(/ /g, ""), foldSwedish(n).replace(/ /g, "")])) {
      const arr = m.get(key) || [];
      for (const x of v) if (!arr.includes(x)) arr.push(x);
      m.set(key, arr);
    }
  }
  return m;
}
function syn(): Index { return (synIdx ||= buildIndex(FOOD_SYNONYMS)); }
function pref(): Index { return (prefIdx ||= buildIndex(FOOD_PREFERRED)); }

/** Svenska böjningsändelser: "rödbetor" → "rödbet", "champinjoner" → "champinjon", "krossade" → "krossad". */
const SUFFIXES = ["ornas", "arna", "erna", "orna", "or", "ar", "er", "na", "en", "et", "e", "n", "t", "a", "r", "s"];
export function stems(w: string, min = 4): string[] {
  const out: string[] = [];
  for (const suf of SUFFIXES) {
    if (w.length - suf.length >= min && w.endsWith(suf)) out.push(w.slice(0, -suf.length));
  }
  return out;
}
const stemCache = new Map<string, string[]>();
const CONS = /[bcdfghjklmnpqrstvwxz]/;
function stems3(w: string): string[] {
  let s = stemCache.get(w);
  if (!s) {
    // Treboksstammar bara från bestämd form/-ar: "osten" → "ost", "ostar" → "ost", men inte "bönor" → "bön"
    s = stems(w, 3).filter((x) => x.length >= 4 || ["en", "et", "n", "t", "ar"].includes(w.slice(x.length)));
    // Bortfallet e: "sockret" → "socker", "vattnet" → "vatten", "dadlar" → "dadel"
    for (const suf of ["et", "en", "ar", "na"]) {
      const b = w.slice(0, -suf.length);
      if (w.endsWith(suf) && b.length >= 3 && CONS.test(b[b.length - 1]) && CONS.test(b[b.length - 2])) s.push(b.slice(0, -1) + "e" + b[b.length - 1]);
    }
    if (stemCache.size > 20000) stemCache.clear();
    stemCache.set(w, s);
  }
  return s;
}

/** Samma ord i annan böjning: "osten"~"ost", "rödbetor"~"rödbeta", "kesot"~"keso". */
function sameWord(t: string, w: string): boolean {
  if (t === w) return true;
  const sw = stems3(w);
  if (sw.includes(t)) return true;
  const st = stems3(t);
  // Sökordet är grundform av namnordet ("tomat" ~ "tomater"), men inte "skin" ~ "skinn" eller "fet" ~ "fett" vid inskrivning.
  if (st.includes(w) && (w.length >= 5 || t.length - w.length >= 2)) return true;
  for (const x of sw) if (x.length >= 4 && st.includes(x)) return true;
  return false;
}

/** Levenshtein/Damerau ≤ max (tidig avbrytning). */
function within(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return false;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length] <= max;
}

/**
 * 0 = samma ord (även böjt), 1 = efterled i sammansättning ("hallonsylt" för "sylt" – huvudordet står sist på svenska),
 * 2 = ordet börjar med sökordet, 3 = finns inne i ordet. null = ingen träff.
 */
function wordTier(t: string, w: string): number | null {
  if (sameWord(t, w)) return 0;
  if (w.length >= 4 && t.endsWith(w)) return 1;
  if (t.startsWith(w)) return 2;
  for (const x of stems(w)) {
    if (t.endsWith(x)) return 1;
    if (t.startsWith(x)) return 2;
  }
  if (t.includes(w)) return 3;
  return null;
}

/** Delar sammansatta sökord mot ordförrådet i databasen: "rödlök" → "röd lök", "fullkornsbröd" → "fullkorn bröd". */
export function splitCompound(w: string, vocab: Set<string>, depth = 0): string[] | null {
  if (depth > 2 || w.length < 6) return null;
  for (let i = w.length - 3; i >= 3; i--) {
    let head = w.slice(0, i);
    let tail = w.slice(i);
    if (!vocab.has(tail)) {
      const st = stems(tail, 3).find((s) => vocab.has(s));
      if (!st) continue;
      tail = st; // "kycklingfiléer" → "kyckling filé"
    }
    if (!vocab.has(head) && head.endsWith("s") && vocab.has(head.slice(0, -1))) head = head.slice(0, -1); // fogemorfem
    if (vocab.has(head)) return [head, tail];
    const sub = splitCompound(head, vocab, depth + 1);
    if (sub) return [...sub, tail];
  }
  return null;
}

interface Prepared { n: string; tokens: string[]; compact: string; f: string; ftokens: string[]; fcompact: string; folded: boolean; pop: boolean; penaltyBase: number }
interface Corpus { prep: Prepared[]; vocab: Set<string>; fvocab: Set<string>; words: string[] }
const corpusCache = new WeakMap<object, Corpus>();

/** Vanliga butiksvaror (normaliserade, å/ä/ö-vikta namnprefix) som rankas före ovanliga varianter inom samma träffnivå. */
const POPULAR = [
  "mjolk fett 3", "mellanmjolk", "lattmjolk", "filmjolk fett 3", "yoghurt naturell fett 3", "kvarg naturell", "farskost cottage cheese naturell",
  "vispgradde fett", "matlagningsgradde", "creme fraiche fett 32", "smor fett 80", "matfettsblandning fett 75", "ost hardost fett 28", "ost hardost fett 31",
  "ost mozzarella", "salladsost", "ost halloumi ra", "agg kokt", "agg ratt", "agg stekt", "not fars ra fett 10", "blandfars ra not 50", "gris fars ra fett 15",
  "kyckling brostfile ra u skinn", "kyckling lar ra u skinn", "gris bacon ra", "gris skinka skivad rokt", "korv falukorv fett 19", "kottbullar stekta frysvara",
  "gris flaskfile ra", "lax odlad norge fjordlax ra", "torsk ra", "tonfisk i vatten", "raka kokt", "potatis ra", "potatis kokt m salt", "sotpotatis ra",
  "morot", "gurka", "tomat", "paprika rod", "lok gul", "lok rod", "vitlok", "broccoli", "blomkal", "spenat farsk", "isbergssallat", "avokado", "squash",
  "champinjon", "majskorn konserv", "grona artor frysvara", "kikartor konserv", "banan", "apelsin", "apple m skal", "paron", "citron", "vindruvor", "jordgubbar",
  "hallon", "blabar", "mango", "havregryn fullkorn", "ris basmati okokt", "ris jasmin okokt", "pasta okokt", "pasta kokt u salt", "nudlar aggnudlar okokta",
  "quinoa okokt", "bulgur", "couscous", "hamburgerbrod", "sott vetebrod kanelbulle", "jordnotter rostade", "cashewnotter rostade u salt",
  "sotmandel", "hasselnotter", "valnotter", "jordnotssmor", "olivolja", "rapsolja", "socker", "honung", "mjolkchoklad", "mork choklad kakao 70", "kaffe bryggt",
  "te bryggt", "apelsinjuice drickf", "ol pilsner", "havredryck fett 1 5", "sojadryck berikad", "proteinpulver", "proteinbar", "ketchup",
  "majonnas fett 80", "sojasas", "chips potatis naturell", "glass fett ca 10", "brod vitt fibrer ca 5% typ formfranska", "vin rott vol % 14", "vin vitt vol % 12", "notter blandade naturella", "glass vaniljsmak", "hart brod fullkorn rag fibrer ca 13",
  "kaffegradde fett 12", "graddfil fett 12", "linser torkade", "vatten kranvatten", "kyckling kott ra u skinn", "gris kott ra",
];
const OFFAL_GROUP = "Lever, njure, tunga etc.";
const OFFAL_WORDS = /lever|njure|hjärta|tunga|mage|bräss|blod|kräs/;
const SPECIAL_WORDS = /barnmat|storhushåll|glutenfri|laktosfri|restaurang|gatukök/;

function corpusFor(items: { name: string; group_name?: string | null }[]): Corpus {
  let c = corpusCache.get(items);
  if (c) return c;
  const vocab = new Set<string>();
  const fvocab = new Set<string>();
  const prep = items.map((it) => {
    const n = normalizeFoodText(it.name);
    const tokens = n.split(" ").filter(Boolean);
    const f = foldSwedish(n);
    for (const t of tokens) if (t.length >= 3 && !/\d/.test(t)) { vocab.add(t); fvocab.add(foldSwedish(t)); }
    const raw = it.name.toLowerCase();
    let p = 0;
    if (/ m\. (?!salt|skinn|skal|svål|lag|sockerlag|juice|olja|vatten|kryddor)|hemlagad|restaurang/.test(raw) || it.group_name === "Rätter") p += 300;
    if (SPECIAL_WORDS.test(raw)) p += 150;
    return {
      n, tokens, compact: n.replace(/ /g, ""), f, ftokens: f.split(" ").filter(Boolean), fcompact: f.replace(/ /g, ""),
      folded: f !== n, pop: POPULAR.some((x) => f.startsWith(x)), penaltyBase: p,
    };
  });
  c = { prep, vocab, fvocab, words: [] };
  corpusCache.set(items, c);
  return c;
}

/** Straff inom samma träffnivå: rätter, inälvsmat, barnmat/storhushåll/glutenfritt efter råvaror (om sökningen inte ber om dem). */
function penalty(p: Prepared, it: { name: string; group_name?: string | null }, q: string): number {
  let v = p.penaltyBase;
  const n = it.name.toLowerCase();
  if ((it.group_name === OFFAL_GROUP || OFFAL_WORDS.test(n)) && !OFFAL_WORDS.test(q)) v += 400;
  if (SPECIAL_WORDS.test(n) && SPECIAL_WORDS.test(q)) v -= 150;
  if (p.pop) v -= 250;
  return v;
}

/** Lägre = bättre. null = ingen träff. */
function scoreTokens(tokens: string[], name: string, compact: string, q: string): number | null {
  const words = q.split(" ").filter(Boolean);
  if (!words.length) return null;
  let tier = 0;
  let firstPos = Infinity;
  for (const w of words) {
    let wTier: number | null = null;
    let pos = Infinity;
    for (let i = 0; i < tokens.length; i++) {
      const tt = wordTier(tokens[i], w);
      // Efterledsträff ("vaxbönor") strax efter helt ord ("gröna bönor") inom samma nivå
      if (tt != null && (wTier == null || tt < wTier)) { wTier = tt; pos = tt === 1 ? i + 3 : i; if (tt === 0) break; }
    }
    if (wTier == null) {
      // Sammansatt sökord mot delat namn: "nötfärs" ~ "nöt färs"
      const idx = compact.indexOf(w);
      if (idx < 0) return null;
      wTier = idx === 0 ? 1 : 3;
      pos = 0;
    }
    tier = Math.max(tier, wTier === 0 ? 1 : wTier); // helt ord senare i namnet ≈ efterled ("Gröna bönor", "Vaniljsås m. grädde")
    firstPos = Math.min(firstPos, pos);
  }
  // Namnet börjar med första sökordet: starkaste nivån, om övriga ord också träffar hela ord/efterled
  if (sameWord(tokens[0], words[0])) tier = tier <= 1 ? 0 : tier - 1;
  else if (name.startsWith(q) || compact.startsWith(q.replace(/ /g, ""))) tier = Math.min(tier, 1);
  return tier * 1000 + Math.min(firstPos, 50) * 10;
}

function scorePrepared(p: Prepared, queries: string[], nPreferred = 0): number | null {
  let best: number | null = null;
  queries.forEach((q, i) => {
    const foldOk = p.folded && !HAS_SWE.test(q);
    // Snabb gallring: varje sökord måste ha sina tre första bokstäver någonstans i namnet
    for (const w of q.split(" ")) {
      const k = w.slice(0, 3);
      if (k && !p.compact.includes(k) && !(foldOk && p.fcompact.includes(k))) return;
    }
    let s = scoreTokens(p.tokens, p.n, p.compact, q);
    // Sökning utan å/ä/ö: "mjolk" ~ "mjölk", strax efter exakta träffar
    if (foldOk) {
      const fs = scoreTokens(p.ftokens, p.f, p.fcompact, q);
      if (fs != null && (s == null || fs + 5 < s)) s = fs + 5;
    }
    if (s == null) return;
    // Butiksbetydelsen ("soja" → sojasås) före allt annat när alla dess ord finns som hela ord i namnet
    if (i < nPreferred && s < 2000 && q.split(" ").every((w) => p.tokens.some((t) => sameWord(t, w)) || (foldOk && p.ftokens.some((t) => sameWord(t, w))))) s = -1000;

    const v = s + i; // synonymer i angiven ordning, strax efter direktträff
    if (best == null || v < best) best = v;
  });
  return best;
}

export function foodMatchScore(name: string, queries: string[]): number | null {
  const n = normalizeFoodText(name);
  const f = foldSwedish(n);
  const p: Prepared = {
    n, tokens: n.split(" ").filter(Boolean), compact: n.replace(/ /g, ""), f, ftokens: f.split(" ").filter(Boolean),
    fcompact: f.replace(/ /g, ""), folded: f !== n, pop: false, penaltyBase: 0,
  };
  return scorePrepared(p, queries);
}

function lookup(idx: Index, q: string): string[] {
  const out: string[] = [];
  const keys = [q, foldSwedish(q)];
  if (!q.includes(" ")) for (const s of stems(q, 3)) keys.push(s, foldSwedish(s));
  for (const k of keys) for (const x of idx.get(k) || []) if (!out.includes(x)) out.push(x);
  return out;
}

export function expandQueries(query: string): string[] {
  return expand(query).queries;
}

/** Påbörjade ord ("zucc", "gräd", "parm"): fyll i från synonymtabellerna när ordet inte finns i databasen. */
function completions(q: string, vocab: Set<string> | null): string[] {
  if (q.length < 4 || q.includes(" ") || /\d/.test(q)) return [];
  if (syn().has(q) || pref().has(q) || (vocab && vocab.has(q))) return [];
  const fq = foldSwedish(q);
  const keys = new Set<string>();
  for (const idx of [pref(), syn()]) for (const k of idx.keys()) if (!k.includes(" ") && k.length > q.length && (k.startsWith(q) || k.startsWith(fq))) keys.add(k);
  const best = [...keys].sort((a, b) => a.length - b.length).slice(0, 2);
  const out: string[] = [];
  for (const k of best) for (const x of [...(pref().get(k) || []), k, ...(syn().get(k) || []).slice(0, 2)]) if (!out.includes(x)) out.push(x);
  return out;
}

function expand(query: string, vocab: Set<string> | null = null): { queries: string[]; nPreferred: number } {
  const q = normalizeFoodText(query);
  if (!q) return { queries: [], nPreferred: 0 };
  const s = [...lookup(syn(), q)];
  // Ord-för-ord-synonymer (t.ex. "chicken breast" → "kyckling breast", "kokta ägg" → "kokta ägg")
  const words = q.split(" ");
  if (words.length > 1) {
    const mapped = words.map((w) => syn().get(w)?.[0] ?? syn().get(foldSwedish(w))?.[0] ?? w).join(" ");
    if (mapped !== q) s.push(mapped);
  }
  // "kyckling med skinn" → "kyckling m skinn" (Livsmedelsverket skriver "m." och "u.")
  if (/\b(med|utan)\b/.test(q)) s.push(q.replace(/\bmed\b/g, "m").replace(/\butan\b/g, "u"));
  const preferred = Array.from(new Set(lookup(pref(), q).map(normalizeFoodText)));
  const out = [...preferred, q, ...s.map(normalizeFoodText), ...completions(q, vocab).map(normalizeFoodText)];
  return { queries: Array.from(new Set(out)).filter(Boolean), nPreferred: preferred.length };
}

/** Rättar stavfel ord för ord mot databasens ord och synonymerna: "brokkoli" → "broccoli", "kyklling" → "kyckling". */
export function correctQuery(query: string, vocab: Set<string>): string | null {
  const words = normalizeFoodText(query).split(" ").filter(Boolean);
  let changed = false;
  const known = (w: string) => {
    if (vocab.has(w) || syn().has(w) || syn().has(foldSwedish(w)) || stems(w, 3).some((s) => vocab.has(s))) return true;
    for (const v of vocab) if (v.startsWith(w)) return true; // påbörjat ord, inte stavfel
    return false;
  };
  const out = words.map((w) => {
    if (w.length < 4 || /\d/.test(w) || known(w)) return w;
    const fw = foldSwedish(w);
    const max = w.length >= 6 ? 2 : 1;
    let best: string | null = null;
    let bestD = Infinity;
    const consider = (cand: string) => {
      if (Math.abs(cand.length - w.length) > max) return;
      const fc = foldSwedish(cand);
      for (let d = 1; d <= Math.min(max, bestD - 1); d++) {
        if (within(fw, fc, d)) {
          if (d === 2 && fc[0] !== fw[0]) return; // två fel kräver samma begynnelsebokstav
          if (d < bestD || (d === bestD && best != null && cand.length < best.length)) { best = cand; bestD = d; }
          return;
        }
      }
    };
    for (const v of vocab) consider(v);
    for (const k of syn().keys()) if (!k.includes(" ")) consider(k);
    if (!best) {
      // "basmatriset" → "basmatris" → "basmatiris"
      for (const st of stems(w, 4)) {
        const sub = correctQuery(st, vocab);
        if (sub) { best = sub; break; }
      }
    }
    if (best) { changed = true; return best; }
    return w;
  });
  return changed ? out.join(" ") : null;
}

const SOURCE_ORDER: Record<string, number> = { food: 0, custom_food: 1, recipe: 2, off: 3 };

const STOPWORDS = new Set(["och", "med", "utan", "i", "på", "av", "en", "ett", "st", "g", "gram", "the", "and", "with", "of"]);

/** Ordets längsta början/slut som finns i databasen: "laxbitar" → "lax", "smörgåsmargarin" → "margarin". */
function compoundParts(w: string, vocab: Set<string>): string[] {
  const out: string[] = [];
  for (let i = w.length - 1; i >= 3; i--) if (vocab.has(w.slice(0, i))) { out.push(w.slice(0, i)); break; }
  for (let i = 1; i <= w.length - 4; i++) if (vocab.has(w.slice(i))) { out.push(w.slice(i)); break; }
  return out;
}

/**
 * Sista utväg när inget träffar: varje ord för sig (ELLER), ord som inte finns i databasen delas upp eller hoppas över.
 * "bananen mogen" → banan, "laxbitar" → lax, "salmon fillet" → lax filé.
 */
function relaxed<T extends { name: string; source: string; group_name?: string | null }>(
  items: T[], prep: Prepared[], q0: string, vocab: Set<string>,
): Scored<T>[] {
  const words = q0.split(" ").filter((w) => w && !STOPWORDS.has(w));
  if (!words.length) return [];
  const perWord: (number | null)[][] = [];
  for (const w of words) {
    const e = expand(w, vocab);
    let scores = prep.map((p) => scorePrepared(p, e.queries, e.nPreferred));
    if (!scores.some((x) => x != null && x < 3000)) {
      const parts = compoundParts(w, vocab);
      if (parts.length) {
        const qs = parts.flatMap((x) => expand(x, vocab).queries);
        scores = prep.map((p) => scorePrepared(p, qs));
      }
    }
    if (scores.some((x) => x != null)) perWord.push(scores);
  }
  if (!perWord.length) return [];
  const out: Scored<T>[] = [];
  for (let i = 0; i < items.length; i++) {
    let hits = 0;
    let worst = 0;
    for (const sc of perWord) { const v = sc[i]; if (v != null) { hits++; worst = Math.max(worst, v); } }
    if (!hits) continue;
    const t = Math.max(0, Math.floor(worst / 1000));
    out.push({ it: items[i], s: worst, t: 10 + (perWord.length - hits) * 5 + t, p: worst - Math.floor(worst / 1000) * 1000 + penalty(prep[i], items[i], q0) });
  }
  return out;
}

type Scored<T> = { it: T; s: number; t: number; p: number; pb?: boolean };

function rank<T extends { name: string; source: string; group_name?: string | null }>(
  items: T[], prep: Prepared[], qs: string[], nPreferred: number, q0: string,
): Scored<T>[] {
  const out: Scored<T>[] = [];
  for (let i = 0; i < items.length; i++) {
    const s = scorePrepared(prep[i], qs, nPreferred);
    if (s == null) continue;
    const t = Math.floor(s / 1000);
    out.push({ it: items[i], s, t, p: s - t * 1000 + penalty(prep[i], items[i], q0), pb: prep[i].penaltyBase > 0 } as Scored<T>);
  }
  // Rätter, barnmat, glutenfritt m.m. efter råvaran när den finns på toppnivån ("Ost halloumi" före "Halloumi stroganoff"),
  // men "pizza" visar fortfarande pizzor först.
  if (out.some((x) => x.t <= 1 && !x.pb)) for (const x of out) if (x.pb && x.t === 0) x.t = 1;
  return out;
}

/** Filtrerar + rangordnar: träffnivå, sedan baslivsmedel före Egna, använd före oanvänd, vanliga varor, kortare namn. */
export function searchFoods<T extends { name: string; source: string; group_name?: string | null }>(
  items: T[],
  query: string,
  isUsed: (it: T) => boolean = () => false,
): T[] {
  if (!normalizeFoodText(query)) return items;
  const { prep, vocab, fvocab } = corpusFor(items);
  const { queries: qs, nPreferred } = expand(query, HAS_SWE.test(query.toLowerCase()) ? vocab : fvocab);
  const q0 = normalizeFoodText(query);
  // Sammansatta sökord som inte finns som eget ord: lägg till delad variant ("basmatiris" → "basmati ris").
  const v = HAS_SWE.test(q0) ? vocab : fvocab;
  const split = q0.split(" ").map((w) => splitCompound(w, v) || [w]).flat().join(" ");
  if (split !== q0 && !qs.includes(split)) qs.push(split);
  let scored = rank(items, prep, qs, nPreferred, q0);
  // Inga träffar i början av något ord: prova stavningsrättning och visa de träffarna först.
  if (!scored.some((x) => x.t <= 2)) {
    const fixed = correctQuery(query, new Set([...vocab, ...fvocab]));
    if (fixed && fixed !== q0) {
      const e2 = expand(fixed, v);
      const qs2 = e2.queries;
      const split2 = fixed.split(" ").map((w) => splitCompound(w, v) || [w]).flat().join(" ");
      if (split2 !== fixed && !qs2.includes(split2)) qs2.push(split2);
      const extra = rank(items, prep, qs2, e2.nPreferred, fixed);
      const seen = new Set(extra.map((x) => x.it));
      scored = [...extra, ...scored.filter((x) => !seen.has(x.it)).map((x) => ({ ...x, t: x.t + 4 }))];
    }
  }
  if (!scored.some((x) => x.t <= 2)) {
    const extra = relaxed(items, prep, q0, v);
    const seen = new Set(scored.map((x) => x.it));
    scored = [...scored, ...extra.filter((x) => !seen.has(x.it))];
  }
  return scored
    .sort((a, b) =>
      a.t - b.t ||
      (SOURCE_ORDER[a.it.source] ?? 9) - (SOURCE_ORDER[b.it.source] ?? 9) ||
      Number(isUsed(b.it)) - Number(isUsed(a.it)) ||
      a.p - b.p ||
      a.it.name.length - b.it.name.length ||
      a.it.name.localeCompare(b.it.name, "sv"))
    .map((x) => x.it);
}
