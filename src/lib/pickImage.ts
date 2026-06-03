import { Capacitor } from "@capacitor/core";

export type PickedImage = {
  blob: Blob;
  dataUrl: string;
  file: File;
};

/**
 * Open a unified image picker.
 * - On Capacitor (native Android/iOS) uses @capacitor/camera with a prompt
 *   that lets the user choose between camera and photo gallery. This triggers
 *   the OS permission dialog automatically.
 * - On web falls back to a hidden <input type="file"> picker.
 */
export async function pickImage(opts?: {
  /** Force only camera (no gallery). */
  source?: "camera" | "gallery" | "prompt";
  /** Quality 0-100 (native only). */
  quality?: number;
}): Promise<PickedImage | null> {
  const source = opts?.source ?? "prompt";
  const quality = opts?.quality ?? 80;

  if (Capacitor.isNativePlatform()) {
    try {
      const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
      const nativeSource =
        source === "camera"
          ? CameraSource.Camera
          : source === "gallery"
          ? CameraSource.Photos
          : CameraSource.Prompt;

      const photo = await Camera.getPhoto({
        quality,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: nativeSource,
        promptLabelHeader: "Välj bild",
        promptLabelPhoto: "Från galleri",
        promptLabelPicture: "Ta foto",
        promptLabelCancel: "Avbryt",
      });

      const dataUrl = photo.dataUrl;
      if (!dataUrl) return null;

      const blob = await (await fetch(dataUrl)).blob();
      const ext = photo.format || "jpeg";
      const file = new File([blob], `photo.${ext}`, { type: blob.type || `image/${ext}` });
      return { blob, dataUrl, file };
    } catch (e: any) {
      // User cancelled or permission denied — return null silently
      if (e?.message?.toLowerCase?.().includes("cancel")) return null;
      console.warn("Native camera failed, falling back to web picker", e);
      // fall through to web
    }
  }

  return pickImageWeb(source === "camera");
}

function pickImageWeb(captureEnv: boolean): Promise<PickedImage | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    if (captureEnv) input.setAttribute("capture", "environment");
    input.style.display = "none";

    let settled = false;
    const cleanup = () => {
      if (input.parentNode) input.parentNode.removeChild(input);
    };

    input.onchange = () => {
      const file = input.files?.[0];
      cleanup();
      if (!file) {
        if (!settled) { settled = true; resolve(null); }
        return;
      }
      const r = new FileReader();
      r.onload = () => {
        if (settled) return;
        settled = true;
        resolve({ file, blob: file, dataUrl: r.result as string });
      };
      r.onerror = () => {
        if (settled) return;
        settled = true;
        resolve(null);
      };
      r.readAsDataURL(file);
    };

    // If user dismisses dialog without picking, we won't get a change event.
    // Resolve null on window focus as best-effort fallback.
    const focusHandler = () => {
      setTimeout(() => {
        if (!settled && !input.files?.length) {
          settled = true;
          cleanup();
          resolve(null);
        }
        window.removeEventListener("focus", focusHandler);
      }, 500);
    };
    window.addEventListener("focus", focusHandler, { once: true });

    document.body.appendChild(input);
    input.click();
  });
}
