import { useState, useRef, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ZoomIn, ZoomOut, Loader2 } from "lucide-react";

interface AvatarCropDialogProps {
  open: boolean;
  imageFile: File | null;
  onClose: () => void;
  onSave: (blob: Blob) => void;
  saving?: boolean;
}

const OUTPUT_SIZE = 512;

const AvatarCropDialog = ({ open, imageFile, onClose, onSave, saving }: AvatarCropDialogProps) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Load file into data URL
  useEffect(() => {
    if (!imageFile) { setImageSrc(null); return; }
    const url = URL.createObjectURL(imageFile);
    setImageSrc(url);
    setScale(1);
    setOffset({ x: 0, y: 0 });
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const handleImageLoad = useCallback(() => {
    if (!imgRef.current) return;
    setNaturalSize({ w: imgRef.current.naturalWidth, h: imgRef.current.naturalHeight });
  }, []);

  // Calculate the base size so the image covers the preview square
  const previewSize = 280;
  const coverScale = naturalSize.w && naturalSize.h
    ? Math.max(previewSize / naturalSize.w, previewSize / naturalSize.h)
    : 1;
  const displayW = naturalSize.w * coverScale * scale;
  const displayH = naturalSize.h * coverScale * scale;

  // Drag handlers
  const onPointerDown = (e: React.PointerEvent) => {
    setDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const maxX = Math.max(0, (displayW - previewSize) / 2);
    const maxY = Math.max(0, (displayH - previewSize) / 2);
    const nx = Math.min(maxX, Math.max(-maxX, e.clientX - dragStart.x));
    const ny = Math.min(maxY, Math.max(-maxY, e.clientY - dragStart.y));
    setOffset({ x: nx, y: ny });
  };
  const onPointerUp = () => setDragging(false);

  const handleSave = () => {
    if (!imgRef.current || !naturalSize.w) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext("2d")!;

    // Calculate source rect from the visible area
    const srcCenterX = naturalSize.w / 2 - offset.x / (coverScale * scale);
    const srcCenterY = naturalSize.h / 2 - offset.y / (coverScale * scale);
    const srcSize = previewSize / (coverScale * scale);

    ctx.drawImage(
      imgRef.current,
      srcCenterX - srcSize / 2,
      srcCenterY - srcSize / 2,
      srcSize,
      srcSize,
      0, 0,
      OUTPUT_SIZE,
      OUTPUT_SIZE
    );

    canvas.toBlob((blob) => {
      if (blob) onSave(blob);
    }, "image/jpeg", 0.9);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-[340px] p-4">
        <DialogHeader>
          <DialogTitle className="text-base">Anpassa profilbild</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3">
          {/* Preview area */}
          <div
            ref={containerRef}
            className="relative overflow-hidden rounded-full border-2 border-primary/30 cursor-grab active:cursor-grabbing touch-none"
            style={{ width: previewSize, height: previewSize }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            {imageSrc && (
              <img
                ref={imgRef}
                src={imageSrc}
                onLoad={handleImageLoad}
                alt="Förhandsvisning"
                draggable={false}
                className="absolute select-none pointer-events-none max-w-none max-h-none"
                style={{
                  width: displayW,
                  height: displayH,
                  left: `calc(50% - ${displayW / 2}px + ${offset.x}px)`,
                  top: `calc(50% - ${displayH / 2}px + ${offset.y}px)`,
                }}
              />
            )}
          </div>

          {/* Zoom slider */}
          <div className="flex items-center gap-2 w-full px-2">
            <ZoomOut className="w-4 h-4 text-muted-foreground shrink-0" />
            <Slider
              min={1}
              max={3}
              step={0.05}
              value={[scale]}
              onValueChange={([v]) => setScale(v)}
              className="flex-1"
            />
            <ZoomIn className="w-4 h-4 text-muted-foreground shrink-0" />
          </div>
          <p className="text-xs text-muted-foreground">Dra för att flytta, zooma med slidern</p>
        </div>

        <DialogFooter className="flex gap-2 mt-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Avbryt</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Spara
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AvatarCropDialog;
