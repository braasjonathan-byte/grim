import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdaptiveTdeeCard from "@/components/AdaptiveTdeeCard";

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from } }));

describe("Adaptive expenditure loading and disabled states", () => {
  beforeEach(() => {
    from.mockReset();
    const pending = new Promise(() => {});
    const query = { select: vi.fn(), eq: vi.fn(), gte: vi.fn(), lt: vi.fn(), order: vi.fn(), limit: vi.fn(), maybeSingle: vi.fn() };
    for (const method of [query.select, query.eq, query.gte, query.lt]) method.mockReturnValue(query);
    for (const method of [query.order, query.limit, query.maybeSingle]) method.mockReturnValue(pending);
    from.mockReturnValue(query);
  });
  afterEach(cleanup);

  const props = { userId: "user-1", currentKcal: 2000, hasGoals: true, onApplied: vi.fn() };

  it("does not crash or query data when disabled before any result exists", () => {
    expect(() => render(<AdaptiveTdeeCard {...props} enabled={false} />)).not.toThrow();
    expect(from).not.toHaveBeenCalled();
  });

  it("can be disabled while the initial queries are still pending", () => {
    const view = render(<AdaptiveTdeeCard {...props} enabled />);
    expect(from).toHaveBeenCalledTimes(3);
    expect(() => view.rerender(<AdaptiveTdeeCard {...props} enabled={false} />)).not.toThrow();
    expect(from).toHaveBeenCalledTimes(3);
  });
});