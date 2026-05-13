import { describe, expect, it, vi } from "vitest";
import { installSelectionGuard } from "./selectionGuard";

describe("selectionGuard", () => {
  it("clears accidental selection outside editable fields", () => {
    document.body.innerHTML = `<p id="text">Genomförda Varje rep räknas</p>`;
    installSelectionGuard(document);

    const textNode = document.getElementById("text")!.firstChild!;
    const range = document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, 10);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    document.dispatchEvent(new Event("selectionchange"));

    expect(selection.toString()).toBe("");
  });

  it("clears collapsed Android selection handles outside editable fields", () => {
    document.body.innerHTML = `<p id="text">Genomförda Varje rep räknas</p>`;
    installSelectionGuard(document);

    const textNode = document.getElementById("text")!.firstChild!;
    const range = document.createRange();
    range.setStart(textNode, 5);
    range.collapse(true);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    document.dispatchEvent(new Event("selectionchange"));

    expect(selection.rangeCount).toBe(0);
  });

  it("keeps selection inside editable fields", () => {
    document.body.innerHTML = `<textarea>Redigerbar text</textarea>`;
    installSelectionGuard(document);
    const textarea = document.querySelector("textarea")!;
    const event = new Event("selectstart", { bubbles: true, cancelable: true });

    const preventDefault = vi.spyOn(event, "preventDefault");
    textarea.dispatchEvent(event);

    expect(preventDefault).not.toHaveBeenCalled();
  });

  it("blocks selectstart on non-editable elements", () => {
    document.body.innerHTML = `<p id="text">Genomförda Varje rep räknas</p>`;
    installSelectionGuard(document);
    const text = document.getElementById("text")!;

    const event = new Event("selectstart", { bubbles: true, cancelable: true });
    const preventDefault = vi.spyOn(event, "preventDefault");
    text.dispatchEvent(event);

    expect(preventDefault).toHaveBeenCalled();
  });
});
