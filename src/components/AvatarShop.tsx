import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShoppingBag, Loader2, Check, Crown } from "lucide-react";

interface AvatarShopProps {
  userId: string;
  isAdmin?: boolean;
  onEquipChange?: () => void;
}

interface ShopItem {
  id: string;
  name: string;
  category: string;
  price: number;
  style_data: { color: string; type?: string };
  is_active: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  shoes: "👟 Skor",
  pants: "👖 Byxor",
  shirt: "👕 Tröjor",
  hat: "🎩 Hattar",
};

const CATEGORIES = ["shirt", "pants", "shoes", "hat"];

const AvatarShop = ({ userId, isAdmin, onEquipChange }: AvatarShopProps) => {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set());
  const [equippedMap, setEquippedMap] = useState<Record<string, string>>({});
  const [proteinBars, setProteinBars] = useState(0);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [equipping, setEquipping] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState("shirt");
  const [isJonne, setIsJonne] = useState(false);

  // Admin state
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [addingItem, setAddingItem] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", category: "shirt", price: 1, color: "#3B82F6" });

  const load = async () => {
    const [{ data: shopItems }, { data: owned }, { data: equipped }, { data: profile }, { data: jonneCheck }] = await Promise.all([
      supabase.from("avatar_shop_items").select("*").order("category").order("name"),
      supabase.from("avatar_owned_items").select("item_id").eq("user_id", userId),
      supabase.from("avatar_equipped_items").select("slot, item_id").eq("user_id", userId),
      supabase.from("profiles").select("protein_bars").eq("user_id", userId).single(),
      supabase.rpc("is_jonne"),
    ]);

    if (shopItems) setItems(shopItems as any);
    if (owned) setOwnedIds(new Set(owned.map((o) => o.item_id)));
    if (equipped) {
      const map: Record<string, string> = {};
      equipped.forEach((e) => { map[e.slot] = e.item_id; });
      setEquippedMap(map);
    }
    if (profile) setProteinBars((profile as any).protein_bars || 0);
    if (jonneCheck === true) setIsJonne(true);
    setLoading(false);
  };

  useEffect(() => { load(); }, [userId]);

  const isFreeUser = isJonne || !!isAdmin;

  const handleBuy = async (item: ShopItem) => {
    setBuying(item.id);
    if (isFreeUser) {
      await supabase.from("avatar_owned_items").insert({ user_id: userId, item_id: item.id });
      setOwnedIds((prev) => new Set([...prev, item.id]));
    } else {
      const { data } = await supabase.rpc("purchase_avatar_item", { p_item_id: item.id });
      if (data) {
        setOwnedIds((prev) => new Set([...prev, item.id]));
        setProteinBars((prev) => prev - item.price);
      }
    }
    setBuying(null);
  };

  const handleEquip = async (item: ShopItem) => {
    setEquipping(item.id);
    const slot = item.category;
    const currentEquipped = equippedMap[slot];

    if (currentEquipped === item.id) {
      await supabase.from("avatar_equipped_items").delete().eq("user_id", userId).eq("slot", slot);
      setEquippedMap((prev) => { const n = { ...prev }; delete n[slot]; return n; });
    } else {
      if (currentEquipped) {
        await supabase.from("avatar_equipped_items").update({ item_id: item.id }).eq("user_id", userId).eq("slot", slot);
      } else {
        await supabase.from("avatar_equipped_items").insert({ user_id: userId, item_id: item.id, slot });
      }
      setEquippedMap((prev) => ({ ...prev, [slot]: item.id }));
    }
    setEquipping(null);
    onEquipChange?.();
  };

  const handleUpdatePrice = async (itemId: string) => {
    const price = parseInt(editPrice);
    if (isNaN(price) || price < 0) return;
    await supabase.from("avatar_shop_items").update({ price }).eq("id", itemId);
    setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, price } : i));
    setEditingItem(null);
  };

  const handleAddItem = async () => {
    const { data } = await supabase.from("avatar_shop_items").insert({
      name: newItem.name,
      category: newItem.category,
      price: newItem.price,
      style_data: { color: newItem.color },
    }).select().single();
    if (data) {
      setItems((prev) => [...prev, data as any]);
      setNewItem({ name: "", category: "shirt", price: 1, color: "#3B82F6" });
      setAddingItem(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    await supabase.from("avatar_shop_items").update({ is_active: false }).eq("id", itemId);
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  }

  const filteredItems = items.filter((i) => i.category === activeCategory && i.is_active);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Butik</span>
        </div>
        <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
          {isJonne || isAdmin ? "⭐ Gratis!" : `🍫 ${proteinBars}`}
        </span>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1">
        {CATEGORIES.map((cat) => (
          <button key={cat} onClick={() => setActiveCategory(cat)}
            className={`flex-1 text-xs py-1.5 rounded-lg transition-colors ${activeCategory === cat ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Items grid */}
      <div className="grid grid-cols-2 gap-2">
        {filteredItems.map((item) => {
          const owned = ownedIds.has(item.id);
          const isEquipped = equippedMap[item.category] === item.id;
          return (
            <div key={item.id} className={`bg-secondary rounded-xl p-3 space-y-2 border-2 transition-colors ${isEquipped ? "border-primary" : "border-transparent"}`}>
              <div className="w-full h-16 rounded-lg flex items-center justify-center" style={{ backgroundColor: item.style_data.color + "33" }}>
                <div className="w-10 h-10 rounded-lg" style={{ backgroundColor: item.style_data.color }} />
              </div>
              <p className="text-xs font-semibold truncate">{item.name}</p>

              {isAdmin && editingItem === item.id ? (
                <div className="flex gap-1">
                  <input type="number" value={editPrice} onChange={(e) => setEditPrice(e.target.value)}
                    className="w-full bg-background text-xs p-1 rounded" />
                  <button onClick={() => handleUpdatePrice(item.id)} className="text-xs bg-primary text-primary-foreground px-2 rounded">OK</button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{isFreeUser ? "⭐ Gratis" : `🍫 ${item.price}`}</span>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <button onClick={() => { setEditingItem(item.id); setEditPrice(item.price.toString()); }}
                        className="text-[10px] text-primary">Pris</button>
                      <button onClick={() => handleDeleteItem(item.id)}
                        className="text-[10px] text-destructive">Ta bort</button>
                    </div>
                  )}
                </div>
              )}

              {owned ? (
                <button onClick={() => handleEquip(item)} disabled={equipping === item.id}
                  className={`w-full text-xs py-1.5 rounded-lg font-semibold transition-colors ${isEquipped ? "bg-primary/20 text-primary" : "bg-secondary border border-border text-foreground hover:bg-primary/10"}`}>
                  {equipping === item.id ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : isEquipped ? "✓ Utrustad" : "Utrusta"}
                </button>
              ) : (
                <button onClick={() => handleBuy(item)} disabled={buying === item.id || (!isFreeUser && proteinBars < item.price)}
                  className="w-full text-xs py-1.5 rounded-lg font-semibold bg-primary text-primary-foreground disabled:opacity-40 hover:opacity-90 transition-opacity">
                  {buying === item.id ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : isFreeUser ? "Hämta gratis" : `Köp (🍫 ${item.price})`}
                </button>
              )}
            </div>
          );
        })}
        {filteredItems.length === 0 && (
          <p className="col-span-2 text-xs text-muted-foreground text-center py-4">Inga varor i denna kategori ännu.</p>
        )}
      </div>

      {/* Admin: Add item */}
      {isAdmin && (
        <div className="border-t border-border pt-3">
          <div className="flex items-center gap-2 mb-2">
            <Crown className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold">Admin: Hantera butik</span>
          </div>
          {addingItem ? (
            <div className="space-y-2 bg-secondary rounded-lg p-3">
              <input placeholder="Namn" value={newItem.name} onChange={(e) => setNewItem((p) => ({ ...p, name: e.target.value }))}
                className="w-full bg-background text-xs p-2 rounded-lg" />
              <select value={newItem.category} onChange={(e) => setNewItem((p) => ({ ...p, category: e.target.value }))}
                className="w-full bg-background text-xs p-2 rounded-lg">
                {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </select>
              <div className="flex gap-2">
                <input type="number" placeholder="Pris" value={newItem.price} onChange={(e) => setNewItem((p) => ({ ...p, price: parseInt(e.target.value) || 0 }))}
                  className="flex-1 bg-background text-xs p-2 rounded-lg" />
                <input type="color" value={newItem.color} onChange={(e) => setNewItem((p) => ({ ...p, color: e.target.value }))}
                  className="w-10 h-9 rounded-lg cursor-pointer" />
              </div>
              <div className="flex gap-2">
                <button onClick={handleAddItem} disabled={!newItem.name.trim()}
                  className="flex-1 text-xs py-1.5 bg-primary text-primary-foreground rounded-lg font-semibold disabled:opacity-40">Lägg till</button>
                <button onClick={() => setAddingItem(false)}
                  className="flex-1 text-xs py-1.5 bg-secondary border border-border text-foreground rounded-lg">Avbryt</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAddingItem(true)}
              className="w-full text-xs py-2 bg-secondary text-foreground rounded-lg font-semibold hover:bg-primary/10 transition-colors">
              + Lägg till vara
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default AvatarShop;
