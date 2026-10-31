import { RESTAURANT_MENU, type MenuItem } from "@/data/restaurantMenu";

export function menuChoices(menu: MenuItem) {
  const fries = menu.parts?.[1];
  const drink = menu.parts?.[2];
  const scaled = (item: MenuItem, factor: number, name: string): MenuItem => ({ ...item, n: name, g: item.g * factor, kcal: item.kcal * factor, p: item.p * factor, f: item.f * factor, c: item.c * factor });
  const large = RESTAURANT_MENU.find((m) => m.r === menu.r && m.n === "Pommes frites stor");
  return {
    sides: fries ? [null, scaled(fries, 0.7, "Pommes liten (uppskattad)"), fries, large ?? scaled(fries, 1.3, "Pommes stor (uppskattad)")] : [],
    drinks: drink ? [null, drink, { r: menu.r, n: "Coca-Cola Zero 0,4 l (ca 0 kcal)", g: 400, kcal: 0, p: 0, f: 0, c: 0 }, { r: menu.r, n: "Vatten 0,4 l", g: 400, kcal: 0, p: 0, f: 0, c: 0 }] : [],
    extras: RESTAURANT_MENU.filter((m) => m.r === menu.r && /nuggets|onion rings/i.test(m.n) && !m.parts && m !== menu.parts?.[0]),
  };
}

export function customizedMenu(menu: MenuItem, side: MenuItem | null, drink: MenuItem | null, extra: MenuItem | null): MenuItem {
  const main = menu.parts?.[0];
  if (!main) return menu;
  const parts = [main, side, drink, extra].filter((p): p is MenuItem => p != null);
  const sum = (key: "g" | "kcal" | "p" | "f" | "c") => parts.reduce((s, p) => s + p[key], 0);
  return { ...menu, n: `${menu.n} · ${side?.n ?? "utan pommes"}, ${drink?.n ?? "utan dryck"}${extra ? `, ${extra.n}` : ""}`, g: sum("g"), kcal: sum("kcal"), p: sum("p"), f: sum("f"), c: sum("c"), parts };
}