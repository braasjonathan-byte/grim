import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ insert: vi.fn(), single: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ insert: mocks.insert }) },
}));
import { saveProductFood } from "@/lib/saveProductFood";

const powder = { name: "Vassleprotein", kcal: 386, protein_g: 77, fat_g: 4, carbs_g: 8 };
describe("saving scanned products to the searchable food bank", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.insert.mockReturnValue({ select: () => ({ single: mocks.single }) });
  });
  it("stores per-100g nutrition and returns a real food ID", async () => {
    mocks.single.mockResolvedValue({ data: { id: "3c2d3ab2-3ed2-4b2d-99ae-8ec5b5369920" }, error: null });
    expect(await saveProductFood("owner", powder)).toBe("3c2d3ab2-3ed2-4b2d-99ae-8ec5b5369920");
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: "owner", kcal: 386, protein_g: 77 }));
  });
  it("notifies the picker after a successful save", async () => {
    mocks.single.mockResolvedValue({ data: { id: "saved" }, error: null });
    const listener = vi.fn();
    window.addEventListener("grim:foods-changed", listener);
    await saveProductFood("owner", powder);
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener("grim:foods-changed", listener);
  });
  it("rejects failed saves instead of emitting a synthetic barcode ID", async () => {
    mocks.single.mockResolvedValue({ data: null, error: new Error("save failed") });
    await expect(saveProductFood("owner", powder)).rejects.toThrow("save failed");
  });
});