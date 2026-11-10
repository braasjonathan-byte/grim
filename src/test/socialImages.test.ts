import { describe, it, expect } from "vitest";
import { socialImagePath } from "@/lib/socialImages";

describe("socialImagePath", () => {
  it("extracts path from public social-images URL", () => {
    expect(socialImagePath("https://x.supabase.co/storage/v1/object/public/social-images/u1/123_0.jpg?t=1")).toBe("u1/123_0.jpg");
  });
  it("ignores other buckets and empty input", () => {
    expect(socialImagePath("https://x.supabase.co/storage/v1/object/public/avatars/u1/avatar.jpg")).toBeNull();
    expect(socialImagePath(null)).toBeNull();
    expect(socialImagePath("blob:abc")).toBeNull();
  });
});
