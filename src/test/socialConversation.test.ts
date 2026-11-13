import { describe, expect, it } from "vitest";
import { challengePhase, confirmMessageWrite, mergeMessages, MESSAGE_PAGE_SIZE, socialAudience } from "@/lib/socialConversation";

describe("Social conversation reliability", () => {
  it("does not confirm a failed send", async () => {
    await expect(confirmMessageWrite(async () => ({ data: null, error: new Error("offline") }))).rejects.toThrow("offline");
  });
  it("requires a returned message before confirming", async () => {
    await expect(confirmMessageWrite(async () => ({ data: null, error: null }))).rejects.toThrow();
  });
  it("confirms the actual saved message", async () => {
    expect(await confirmMessageWrite(async () => ({ data: { id: "saved" }, error: null }))).toEqual({ id: "saved" });
  });
  it("deduplicates realtime and saved messages and preserves older history", () => {
    expect(mergeMessages([{ id: "b", created_at: "2026-11-13" }], [{ id: "a", created_at: "2026-11-12" }, { id: "b", created_at: "2026-11-13" }]).map(m => m.id)).toEqual(["a", "b"]);
    expect(MESSAGE_PAGE_SIZE).toBe(50);
  });
  it("distinguishes future, current and ended challenges using UTC date boundaries", () => {
    expect(challengePhase("2026-11-14", "2026-11-20", "2026-11-13")).toBe("upcoming");
    expect(challengePhase("2026-11-13", "2026-11-13", "2026-11-13")).toBe("active");
    expect(challengePhase("2026-11-01", "2026-11-12", "2026-11-13")).toBe("finished");
  });
  it("does not label publicly readable posts as member-only", () => {
    expect(socialAudience("public")).toBe("Offentligt");
    expect(socialAudience("friends")).toBe("Bara vänner");
    expect(socialAudience("group", "Loppet")).toBe("Loppet");
  });
});