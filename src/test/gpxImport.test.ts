import { describe, it, expect } from "vitest";
import { parseActivityFile } from "@/lib/activityFileParser";

const gpx = `<?xml version="1.0"?><gpx version="1.1"><trk><name>Tur</name><trkseg>
<trkpt lat="59.3300" lon="18.0600"><time>2026-10-09T10:00:00Z</time></trkpt>
<trkpt lat="59.3400" lon="18.0600"><time>2026-10-09T10:05:00Z</time></trkpt>
<trkpt lat="59.3500" lon="18.0600"><time>2026-10-09T10:10:00Z</time></trkpt>
</trkseg></trk></gpx>`;

describe("gpx-import", () => {
  it("fyller distans och tid", async () => {
    const a = await parseActivityFile({ name: "tur.gpx", text: async () => gpx, arrayBuffer: async () => new TextEncoder().encode(gpx).buffer } as unknown as File);
    expect(a.distanceKm).toBeGreaterThan(2);
    expect(a.durationSec).toBe(600);
  });
});
