import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AppErrorBoundary from "@/components/AppErrorBoundary";
import { isChunkLoadError } from "@/lib/lazyRetry";

const Boom = () => { throw new Error("Failed to fetch dynamically imported module: /assets/Index-old.js"); };

describe("AppErrorBoundary", () => {
  it("visar återställningsskärm i stället för tom skärm vid renderfel", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    localStorage.setItem("grim_active_tab", "workout");
    render(<AppErrorBoundary><Boom /></AppErrorBoundary>);
    expect(screen.getByText("Något gick fel")).toBeTruthy();
    expect(screen.getByText(/ny version/)).toBeTruthy();
    expect(screen.getByText("Rensa cache och ladda om")).toBeTruthy();
    expect(localStorage.getItem("grim_active_tab")).toBeNull();
  });
  it("känner igen chunk-fel", () => {
    expect(isChunkLoadError(new Error("Importing a module script failed."))).toBe(true);
    expect(isChunkLoadError(new Error("x is undefined"))).toBe(false);
  });
});
