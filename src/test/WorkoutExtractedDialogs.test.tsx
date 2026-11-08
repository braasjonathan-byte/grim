import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
beforeEach(() => cleanup());
describe("extracted workout dialogs keep their existing controls", () => {
  it("keeps saved-workout import and membership locking", async () => {
    const { WorkoutImportPicker } = await import("@/components/workout/WorkoutImportDialogs");
    const choose = vi.fn();
    render(<WorkoutImportPicker
      importWorkoutTarget={{ planId: "p", week: 1, day: "Sön" }} setImportWorkoutTarget={vi.fn()}
      isHonorary={false} isAdmin={false} setShowAiScan={vi.fn()} setShowFileImport={vi.fn()}
      userId="u" savedWorkouts={[{ id: "s", user_id: "u", name: "Mitt pass", details: "Löpning", tempo: null, visibility: "private" }]}
      readyWorkoutCategories={[{ label: "Kondition", emoji: "🏃", workouts: [
        { name: "Öppet pass", details: "Löpning", tempo: null }, { name: "Låst pass", details: "Cykling", tempo: null },
      ] }]} handleImportWorkout={choose}
    />);
    fireEvent.click(screen.getByRole("button", { name: /Mitt pass/ }));
    expect(choose).toHaveBeenCalledWith({ name: "Mitt pass", details: "Löpning", tempo: null });
    expect(screen.getByRole("button", { name: /Låst pass/ })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /AI:/ })).toBeNull();
  });
  it("keeps incomplete-set confirmation callback ordering", async () => {
    const { UncheckedSetsPrompt } = await import("@/components/workout/WorkoutCompletionPrompts");
    const events: string[] = [];
    render(<UncheckedSetsPrompt uncheckedSetsDialog={{ week: 2, day: "Sön_hcabc", uncheckedCount: 2, doneCount: 1, totalCount: 3 }}
      setUncheckedSetsDialog={() => events.push("close")}
      performToggleDone={async (week, day) => { events.push(`${week}-${day}`); }} />);
    expect(screen.getByText(/Du har gjort 1 av 3 set/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Klarmarkera" }));
    expect(events).toEqual(["close", "2-Sön_hcabc"]);
  });
  it("preserves add-week source selection and disabled saving state", async () => {
    const { AddWorkoutWeekDialog } = await import("@/components/workout/WorkoutScheduleDialogs");
    const select = vi.fn();
    render(<AddWorkoutWeekDialog showAddWeekDialog setShowAddWeekDialog={vi.fn()} weeks={[1, 2]} plans={[]}
      addWeekSourceWeek={null} setAddWeekSourceWeek={select} addWeekByCopy={vi.fn()} addWeekSaving={false} />);
    expect(screen.getByRole("button", { name: "Skapa vecka 3" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "V2" }));
    expect(select).toHaveBeenCalledWith(2);
  });
});
