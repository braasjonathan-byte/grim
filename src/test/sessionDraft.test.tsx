import { beforeEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useSessionDraft } from "@/hooks/useSessionDraft";
beforeEach(() => sessionStorage.clear());
describe("Unsaved drafts", () => {
  it("restores unsaved input after unmount", () => {
    const first = renderHook(() => useSessionDraft("user-a", { kcal: "" }));
    act(() => first.result.current[1]({ kcal: "250" })); first.unmount();
    const second = renderHook(() => useSessionDraft("user-a", { kcal: "" }));
    expect(second.result.current[0].kcal).toBe("250");
  });
  it("never restores another user's draft", () => {
    sessionStorage.setItem("user-a", JSON.stringify({ kcal: "250" }));
    const other = renderHook(() => useSessionDraft("user-b", { kcal: "" }));
    expect(other.result.current[0].kcal).toBe("");
  });
});