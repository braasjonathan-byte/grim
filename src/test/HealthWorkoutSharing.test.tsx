import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const mocks = vi.hoisted(() => ({ privacy: vi.fn(), share: vi.fn(), preview: vi.fn() }));
vi.mock("@/lib/healthWorkoutImport", () => ({ HEALTH_WORKOUT_IMPORTED_EVENT: "grim:health-workout-imported" }));
vi.mock("@/lib/socialPrivacy", () => ({ loadPrivacySettings: mocks.privacy }));
vi.mock("@/lib/workoutAutoShare", () => ({ autoShareCompletion: mocks.share, previewWorkoutCaption: mocks.preview }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/ShareWorkoutPromptDialog", () => ({ default: ({ onConfirm, onSkip }: any) => <><button onClick={() => onConfirm("Cykling 60 min", undefined, "friends")}>Share</button><button onClick={onSkip}>Skip</button></> }));
import HealthWorkoutSharing from "@/components/HealthWorkoutSharing";
const imported = (userId = "u") => act(() => { window.dispatchEvent(new CustomEvent("grim:health-workout-imported", { detail: { userId, week: 7, day: "Tis_hctacx" } })); });
beforeEach(() => { cleanup(); vi.clearAllMocks(); mocks.privacy.mockResolvedValue({ auto_share_workouts: "ask", default_post_visibility: "friends" }); mocks.preview.mockResolvedValue("Cykling 60 min"); mocks.share.mockResolvedValue(true); });
describe("Health workout sharing", () => {
  it("waits for explicit sharing after an import in ask mode", async () => {
    render(<HealthWorkoutSharing userId="u" />);
    imported();
    fireEvent.click(await screen.findByText("Share"));
    await waitFor(() => expect(mocks.share).toHaveBeenCalledWith("u", 7, "Tis_hctacx", "Cykling 60 min", "friends"));
  });
  it("never publishes when the review is declined", async () => {
    render(<HealthWorkoutSharing userId="u" />);
    imported();
    fireEvent.click(await screen.findByText("Skip"));
    expect(mocks.share).not.toHaveBeenCalled();
  });
  it("publishes once with the saved slot and selected visibility for Alltid", async () => {
    mocks.privacy.mockResolvedValue({ auto_share_workouts: "always", default_post_visibility: "public" });
    render(<HealthWorkoutSharing userId="u" />);
    imported(); imported();
    await waitFor(() => expect(mocks.share).toHaveBeenCalledWith("u", 7, "Tis_hctacx", "Cykling 60 min", "public"));
    expect(mocks.share).toHaveBeenCalledTimes(1);
  });
  it("keeps the review for retry after a failed publication", async () => {
    mocks.share.mockResolvedValue(false);
    render(<HealthWorkoutSharing userId="u" />);
    imported();
    fireEvent.click(await screen.findByText("Share"));
    await waitFor(() => expect(mocks.share).toHaveBeenCalled());
    expect(screen.getByText("Share")).toBeInTheDocument();
  });
  it("ignores imports belonging to another account", async () => {
    render(<HealthWorkoutSharing userId="u" />);
    imported("other");
    expect(mocks.privacy).not.toHaveBeenCalled();
  });
});