import { act, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SaveIndicatorProvider, useSaveIndicator } from "./SaveIndicator";

afterEach(() => vi.useRealTimers());

it("does not rerender logging consumers when only the saving indicator changes", () => {
  vi.useFakeTimers();
  const renderConsumer = vi.fn();
  let save = () => {};
  function Consumer() {
    save = useSaveIndicator().triggerSave;
    renderConsumer();
    return null;
  }
  render(<SaveIndicatorProvider><Consumer /></SaveIndicatorProvider>);
  const initialRenders = renderConsumer.mock.calls.length;
  act(() => { save(); });
  act(() => { vi.advanceTimersByTime(400); });
  act(() => { vi.advanceTimersByTime(1500); });
  expect(renderConsumer).toHaveBeenCalledTimes(initialRenders);
});