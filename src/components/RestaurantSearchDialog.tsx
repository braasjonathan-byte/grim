import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Utensils, Plus } from "lucide-react";
import type { PickedItem } from "./FoodPickerDialog";
import { UNITS, toGrams } from "@/lib/nutritionCalc";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (item: PickedItem) => void;
}

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
}

export default function RestaurantSearchDialog({ open, onOpenChange, onPick }: Props) {
  const [brand, setBrand] = useState("");
  const [item, setItem] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<OFFItem[]>([]);
  const [selected, setSelected] = useState<OFFItem | null>(null);
  const [amount, setAmount] = useState("100");
  const [unit, setUnit] = useState("g");

  useEffect(() => {
    if (!open) { setBrand(""); setItem(""); setResults([]); setSelected(null); }
  }, [open]);

  async function search(brandQ: string, itemQ?: string) {
    if (!brandQ.trim()) return;
    setLoading(true);
    setSelected(null);
    try {
      const params = new URLSearchParams({
        action: "process",
        json: "1",
        page_size: "30",
        sort_by: "popularity_key",
        fields: "code,product_name,product_name_sv,brands,nutriments,image_small_url",
        tagtype_0: "brands",
        tag_contains_0: "contains",
        tag_0: brandQ.trim(),
      });
      if (itemQ?.trim()) {
        params.set("search_terms", itemQ.trim());
      }
      const res = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?${params.toString()}`);
      const data = await res.json();
      const items: OFFItem[] = (data.products || [])
        .map((p: any) => {
          const n = p.nutriments || {};
          const name = p.product_name_sv || p.product_name || "Okänd";
          return {
            code: p.code,
            product_name: name,
            brands: p.brands || brandQ,
            kcal: Number(n["energy-kcal_100g"]) || (Number(n["energy_100g"]) ? Number(n["energy_100g"]) / 4.184 : 0),
            protein_g: Number(n.proteins_100g) || 0,
            fat_g: Number(n.fat_100g) || 0,
            carbs_g: Number(n.carbohydrates_100g) || 0,
            image: p.image_small_url,
          };
        })
        .filter((p: OFFItem) => p.product_name && p.kcal > 0);
      setResults(items);
    } finally {
      setLoading(false);
    }
  }

  function pick(r: OFFItem) {
    setSelected(r);
    setAmount("100");
    setUnit("g");
  }

  function confirm() {
    if (!selected) return;
    const a = parseFloat(amount.replace(",", ".")) || 0;
    const grams = toGrams(a, unit);
    const factor = grams / 100;
    onPick({
      source: "custom_food",
      id: "off-" + selected.code,
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
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="Restaurang (t.ex. McDonald's)"
                  className="pl-9 rounded-none"
                  onKeyDown={(e) => e.key === "Enter" && search(brand, item)}
                />
              </div>
              <Input
                value={item}
                onChange={(e) => setItem(e.target.value)}
                placeholder="Maträtt (valfritt, t.ex. Big Mac)"
                className="rounded-none"
                onKeyDown={(e) => e.key === "Enter" && search(brand, item)}
              />
              <button onClick={() => search(brand, item)} className="w-full py-2 bg-primary text-primary-foreground text-sm font-bold">
                Sök
              </button>
            </div>

            {!brand && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Populära</p>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR.map((b) => (
                    <button key={b} onClick={() => { setBrand(b); search(b, item); }} className="px-2 py-1 border border-input text-xs">
                      {b}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto -mx-4 px-4">
              {loading && <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>}
              {!loading && results.length === 0 && brand && <p className="text-sm text-muted-foreground text-center py-6">Inga träffar. Pröva ett annat märke eller maträtt.</p>}
              <ul className="divide-y divide-border">
                {results.map((r) => (
                  <li key={r.code}>
                    <button onClick={() => pick(r)} className="w-full text-left py-2.5 px-1 hover:bg-accent flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{r.product_name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {r.brands.split(",")[0].trim()} · {Math.round(r.kcal)} kcal / 100 g
                        </p>
                      </div>
                      <Plus className="w-4 h-4 text-primary flex-shrink-0 mt-1" />
                    </button>
                  </li>
                ))}
              </ul>
              <p className="text-[10px] text-muted-foreground text-center mt-3">Data från Open Food Facts. Kontrollera värdena.</p>
            </div>
          </>
        )}

        {selected && (
          <div className="space-y-3">
            <div className="border border-border p-3 bg-muted/40">
              <p className="font-bold text-sm">{selected.product_name}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">{selected.brands.split(",")[0].trim()}</p>
              <div className="grid grid-cols-4 gap-2 text-center mt-2">
                <div><p className="text-[10px] text-muted-foreground">Kcal/100g</p><p className="font-bold tabular-nums">{Math.round(selected.kcal)}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Protein</p><p className="font-bold tabular-nums">{selected.protein_g.toFixed(1)}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Fett</p><p className="font-bold tabular-nums">{selected.fat_g.toFixed(1)}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Kolhydrater</p><p className="font-bold tabular-nums">{selected.carbs_g.toFixed(1)}</p></div>
              </div>
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
              <button onClick={() => setSelected(null)} className="flex-1 py-2.5 border border-input text-sm font-medium">Tillbaka</button>
              <button onClick={confirm} className="flex-1 py-2.5 bg-primary text-primary-foreground text-sm font-bold">Lägg till</button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
