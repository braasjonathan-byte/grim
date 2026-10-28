import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Utensils, Plus } from "lucide-react";
import type { PickedItem } from "./FoodPickerDialog";
import { UNITS, gramsForFood } from "@/lib/nutritionCalc";
import type { MenuItem } from "@/data/restaurantMenu";
import { searchMenu, tokens, chainRank } from "@/lib/restaurantSearch";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (item: PickedItem) => void;
  initial?: MenuItem | null;
}

const fromMenu = (m: MenuItem) => ({
  code: `menu-${m.r}-${m.n}`, product_name: m.n, brands: m.r, serving_g: m.g,
  kcal: (m.kcal / m.g) * 100, protein_g: (m.p / m.g) * 100, fat_g: (m.f / m.g) * 100, carbs_g: (m.c / m.g) * 100,
});

const POPULAR = [
  "McDonald's", "Subway", "Burger King", "Max", "KFC", "Sibylla", "Pizza Hut", "Domino's",
  "Starbucks", "Espresso House", "Waynes Coffee", "Joe & The Juice", "7-Eleven", "Pressbyrån",
  "O'Learys", "T.G.I. Friday's", "Hard Rock Cafe", "Vapiano", "Pan Pizza", "Pizzeria",
  "Taco Bar", "Mama's", "Greklands Matsal", "Sushi Yama", "Ichiban Sushi", "East",
  "Wok House", "Szechuan", "Pong", "Bamboo", "Indian Garden", "Curry House", "Holy Cow",
  "Hamburger Börs", "Steakhouse", "Texas Longhorn", "The Barn", "Rolfs Kök",
  "Brasserie", "Bistro", "Gastrogate", "Kunglig", "Prinsen", "Operakällaren",
  "Lidl", "Aldi", "Netto", "Willys", "ICA", "Coop", "Hemköp", "City Gross",
  "Matsmart", "Mathem", "HelloFresh", "Wolt", "Foodora", "Uber Eats",
  "Apoteket", "Hälsokost", "Gymgrossisten", "Proteinbolaget", "Kungliga",
  "Nocco", "Barebells", "Oatly", "Valio", "Arla", "Skånemejerier", "Fazer",
  "Coca-Cola", "Pepsi", "Red Bull", "Monster", "Vitamin Well", "Powerade",
  "Fanta", "Sprite", "Zingo", "Schweppes", "Loka", "Ramlösa", "Vichy",
];

interface OFFItem {
  code: string;
  product_name: string;
  brands: string;
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  image?: string;
  serving_g?: number;
}

export default function RestaurantSearchDialog({ open, onOpenChange, onPick, initial }: Props) {
  const [item, setItem] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<OFFItem[]>([]);
  const [selected, setSelected] = useState<OFFItem | null>(null);
  const [amount, setAmount] = useState("100");
  const [unit, setUnit] = useState("g");
  // Always read the latest field values — never a value captured in an older render.
  const reqRef = useRef(0);


  useEffect(() => {
    if (!open) { setItem(""); setResults([]); setSelected(null); setLoading(false); }
    else if (initial) pick(fromMenu(initial));
  }, [open, initial]);


  const local: OFFItem[] = searchMenu(item).map(({ item: m }) => fromMenu(m));

  // Fler träffar från Open Food Facts (debounce), alla ord måste matcha, svenska kedjor först.
  useEffect(() => {
    const q = item.trim();
    if (q.length < 3) { setResults([]); setLoading(false); return; }
    const reqId = ++reqRef.current;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          action: "process", json: "1", page_size: "50", sort_by: "popularity_key",
          fields: "code,product_name,product_name_sv,brands,nutriments,image_small_url", search_terms: q,
        });
        const res = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?${params.toString()}`);
        const data = await res.json();
        const qt = tokens(q);
        const items: OFFItem[] = (data.products || [])
          .map((p: any) => {
            const n = p.nutriments || {};
            return {
              code: p.code, product_name: p.product_name_sv || p.product_name || "", brands: p.brands || "",
              kcal: Number(n["energy-kcal_100g"]) || (Number(n["energy_100g"]) ? Number(n["energy_100g"]) / 4.184 : 0),
              protein_g: Number(n.proteins_100g) || 0, fat_g: Number(n.fat_100g) || 0,
              carbs_g: Number(n.carbohydrates_100g) || 0, image: p.image_small_url,
            };
          })
          .filter((p: OFFItem) => {
            if (!p.product_name || p.kcal <= 0) return false;
            const doc = tokens(`${p.product_name} ${p.brands}`);
            return qt.every((t) => doc.some((d) => d.startsWith(t) || (t.length >= 4 && d.includes(t))));
          })
          .sort((a: OFFItem, b: OFFItem) => chainRank(a.brands.split(",")[0]) - chainRank(b.brands.split(",")[0]));
        if (reqId === reqRef.current) setResults(items);
      } catch {
        if (reqId === reqRef.current) setResults([]);
      } finally {
        if (reqId === reqRef.current) setLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [item]);

  function pick(r: OFFItem) {
    setSelected(r);
    setAmount(r.serving_g ? "1" : "100");
    setUnit(r.serving_g ? "portion" : "g");
  }

  function confirm() {
    if (!selected) return;
    const a = parseFloat(amount.replace(",", ".")) || 0;
    const grams = selected.serving_g && unit === "portion" ? a * selected.serving_g : gramsForFood(a, unit, selected.product_name);
    const factor = grams / 100;
    onPick({
      source: "custom_food",
      id: (selected.serving_g ? "" : "off-") + selected.code,
      name: `${selected.product_name} (${selected.brands.split(",")[0].trim()})`,
      amount: a, unit,
      kcal: selected.kcal * factor,
      protein_g: selected.protein_g * factor,
      fat_g: selected.fat_g * factor,
      carbs_g: selected.carbs_g * factor,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col gap-3 p-4">
        <DialogHeader>
          <DialogTitle className="font-serif flex items-center gap-2"><Utensils className="w-4 h-4" /> Restaurang</DialogTitle>
        </DialogHeader>

        {!selected && (
          <>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={item}
                onChange={(e) => setItem(e.target.value)}
                placeholder="Sök maträtt, t.ex. Big Mac eller Whopper"
                className="pl-9 rounded-none"
                autoFocus
              />
            </div>

            {!item && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Populära</p>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR.slice(0, 12).map((b) => (
                    <button key={b} type="button" onPointerDown={(e) => { e.preventDefault(); setItem(b + " "); }}
                      className="px-2 py-1 border border-input text-xs">{b}</button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto -mx-4 px-4">
              {local.length > 0 && (
                <ul className="divide-y divide-border border-b border-border">
                  {local.map((r) => (
                    <li key={r.code}>
                      <button onClick={() => pick(r)} className="w-full text-left py-2.5 px-1 hover:bg-accent flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{r.product_name} <span className="text-muted-foreground font-normal">— {r.brands}</span></p>
                          <p className="text-[11px] text-muted-foreground truncate">{Math.round((r.kcal * (r.serving_g ?? 100)) / 100)} kcal / portion</p>
                        </div>
                        <Plus className="w-4 h-4 text-primary flex-shrink-0 mt-1" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {item.trim().length >= 3 && (results.length > 0 || loading) && (
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-3 mb-1">Fler träffar</p>
              )}
              {loading && <div className="flex justify-center py-2"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>}
              {!loading && item.trim().length >= 3 && local.length === 0 && results.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Inga träffar. Pröva ett annat sökord.</p>}
              <ul className="divide-y divide-border">
                {results.map((r) => (
                  <li key={r.code}>
                    <button onClick={() => pick(r)} className="w-full text-left py-2.5 px-1 hover:bg-accent flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{r.product_name}{r.brands && <span className="text-muted-foreground font-normal"> — {r.brands.split(",")[0].trim()}</span>}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{Math.round(r.kcal)} kcal / 100 g</p>
                      </div>
                      <Plus className="w-4 h-4 text-primary flex-shrink-0 mt-1" />
                    </button>
                  </li>
                ))}
              </ul>
              <p className="text-[10px] text-muted-foreground text-center mt-3">Kedjemenyer: ungefärliga värden per portion. Övrigt från Open Food Facts.</p>
            </div>
          </>
        )}

        {selected && (
          <div className="space-y-3">
            <div className="border border-border p-3 bg-muted/40">
              <p className="font-bold text-sm">{selected.product_name}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">{selected.brands.split(",")[0].trim()}</p>
              {(() => {
                const a = parseFloat(amount.replace(",", ".")) || 0;
                const g = selected.serving_g && unit === "portion" ? a * selected.serving_g : gramsForFood(a, unit, selected.product_name);
                const f = g / 100;
                return (<>
                  <p className="text-[10px] text-muted-foreground mt-2">För {amount || 0} {unit} (≈{Math.round(g)} g){selected.serving_g ? ` · 1 portion = ${selected.serving_g} g` : ""}</p>
                  <div className="grid grid-cols-4 gap-2 text-center mt-1">
                    <div><p className="text-[10px] text-muted-foreground">Kcal</p><p className="font-bold tabular-nums">{Math.round(selected.kcal * f)}</p></div>
                    <div><p className="text-[10px] text-muted-foreground">Protein</p><p className="font-bold tabular-nums">{Math.round(selected.protein_g * f)} g</p></div>
                    <div><p className="text-[10px] text-muted-foreground">Fett</p><p className="font-bold tabular-nums">{Math.round(selected.fat_g * f)} g</p></div>
                    <div><p className="text-[10px] text-muted-foreground">Kolhydrater</p><p className="font-bold tabular-nums">{Math.round(selected.carbs_g * f)} g</p></div>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 text-center">Per 100 g: {Math.round(selected.kcal)} kcal</p>
                </>);
              })()}
            </div>
            <div>
              <label className="text-xs font-medium">Mängd</label>
              <div className="flex gap-2 mt-1">
                <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" pattern="[0-9.,]*" className="rounded-none flex-1" />
                <select value={unit} onChange={(e) => setUnit(e.target.value)} className="border border-input bg-background px-2 text-sm">
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => (initial ? onOpenChange(false) : setSelected(null))} className="flex-1 py-2.5 border border-input text-sm font-medium">Tillbaka</button>
              <button onClick={confirm} className="flex-1 py-2.5 bg-primary text-primary-foreground text-sm font-bold">Lägg till</button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
