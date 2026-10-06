import type { PickedItem } from "@/components/FoodPickerDialog";

export interface AiFoodItem {
  name: string; grams: number;
  kcal_100g: number; protein_100g: number; fat_100g: number; carbs_100g: number; fiber_100g: number;
}

export function aiItemToPicked(it: AiFoodItem, idx: number): PickedItem {
  const g = Math.max(0, Number(it.grams) || 0);
  const f = g / 100;
  return {
    source: "custom_food", id: `ai-${idx}-${Date.now()}`, name: it.name, amount: Math.round(g), unit: "g",
    kcal: (Number(it.kcal_100g) || 0) * f, protein_g: (Number(it.protein_100g) || 0) * f,
    fat_g: (Number(it.fat_100g) || 0) * f, carbs_g: (Number(it.carbs_100g) || 0) * f, fiber_g: (Number(it.fiber_100g) || 0) * f,
  };
}

/** Scale nutrition of a picked item to a new gram amount. */
export function rescalePicked(p: PickedItem, newAmount: number): PickedItem {
  const old = p.amount || 0;
  if (old <= 0) return { ...p, amount: newAmount };
  const f = newAmount / old;
  return { ...p, amount: newAmount, kcal: p.kcal * f, protein_g: p.protein_g * f, fat_g: p.fat_g * f, carbs_g: p.carbs_g * f, fiber_g: (p.fiber_g || 0) * f };
}

function encodeWav(chunks: Float32Array[], sampleRate: number): Blob {
  const length = chunks.reduce((s, c) => s + c.length, 0);
  const buf = new ArrayBuffer(44 + length * 2);
  const v = new DataView(buf);
  const tag = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  tag(0, "RIFF"); v.setUint32(4, 36 + length * 2, true); tag(8, "WAVE"); tag(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  tag(36, "data"); v.setUint32(40, length * 2, true);
  let o = 44;
  for (const c of chunks) for (const x of c) { const s = Math.max(-1, Math.min(1, x)); v.setInt16(o, s * (s < 0 ? 32768 : 32767), true); o += 2; }
  return new Blob([buf], { type: "audio/wav" });
}

export async function recordWav(): Promise<{ stop: () => Promise<File>; cancel: () => void }> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const ctx = new AudioContext();
  await ctx.resume();
  const src = ctx.createMediaStreamSource(stream);
  const node = ctx.createScriptProcessor(4096, 1, 1);
  const chunks: Float32Array[] = [];
  node.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  src.connect(node); node.connect(ctx.destination);
  const cleanup = () => { stream.getTracks().forEach((t) => t.stop()); node.disconnect(); src.disconnect(); node.onaudioprocess = null; };
  return {
    async stop() {
      cleanup();
      const blob = encodeWav(chunks, ctx.sampleRate);
      await ctx.close();
      if (blob.size < 4096) throw new Error("Inspelningen var tom – försök igen");
      return new File([blob], "recording.wav", { type: "audio/wav" });
    },
    cancel() { cleanup(); ctx.close().catch(() => {}); },
  };
}
