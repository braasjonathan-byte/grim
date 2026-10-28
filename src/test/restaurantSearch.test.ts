import { describe, it, expect } from "vitest";
import { searchMenu } from "@/lib/restaurantSearch";
const top = (q: string) => searchMenu(q)[0]?.item;
describe("searchMenu", () => {
  it("hittar rätt utan vald restaurang", () => {
    expect(top("big mac")).toMatchObject({ n: "Big Mac", r: "McDonald's" });
    expect(top("triple cheeseburger")).toMatchObject({ n: "Triple Cheeseburger", r: "McDonald's" });
    expect(top("trippel cheeseburgare")?.n).toBe("Triple Cheeseburger");
    expect(top("whoper")?.n).toBe("Whopper");
    expect(top("tunnbrödsrulle")?.r).toBe("Sibylla");
  });
  it("restaurang i frågan filtrerar", () => {
    expect(top("cheeseburger burger king")?.r).toBe("Burger King");
    expect(top("mcdonalds triple cheese")?.n).toBe("Triple Cheeseburger");
    expect(top("max pommes")?.r).toBe("Max");
  });
  it("svenska kedjor först vid lika träff", () => {
    const rs = searchMenu("cheeseburger").map((h) => h.item.r);
    expect(rs[0]).toBe("McDonald's");
    expect(rs).toContain("Burger King");
  });
});
