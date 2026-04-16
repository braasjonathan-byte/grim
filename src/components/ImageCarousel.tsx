import { useState, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CarouselImage {
  image_url: string;
  caption: string | null;
}

interface ImageCarouselProps {
  images: CarouselImage[];
}

const ImageCarousel = ({ images }: ImageCarouselProps) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const touchRef = useRef<number | null>(null);

  if (images.length === 0) return null;
  if (images.length === 1) {
    return (
      <div>
        <img src={images[0].image_url} alt="" className="w-full max-h-96 object-cover" loading="lazy" />
        {images[0].caption && (
          <p className="px-4 py-1.5 text-xs text-muted-foreground italic">{images[0].caption}</p>
        )}
      </div>
    );
  }

  const prev = () => setActiveIdx(i => Math.max(0, i - 1));
  const next = () => setActiveIdx(i => Math.min(images.length - 1, i + 1));

  return (
    <div className="relative">
      <div
        className="overflow-hidden"
        onTouchStart={(e) => { touchRef.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touchRef.current == null) return;
          const dx = e.changedTouches[0].clientX - touchRef.current;
          if (dx < -40) next();
          else if (dx > 40) prev();
          touchRef.current = null;
        }}
      >
        <img
          src={images[activeIdx].image_url}
          alt=""
          className="w-full max-h-96 object-cover transition-opacity duration-200"
          loading="lazy"
        />
      </div>

      {/* Navigation arrows */}
      {activeIdx > 0 && (
        <button
          onClick={prev}
          className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}
      {activeIdx < images.length - 1 && (
        <button
          onClick={next}
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* Dots indicator */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
        {images.map((_, i) => (
          <button
            key={i}
            onClick={() => setActiveIdx(i)}
            className={`w-2 h-2 rounded-full transition-all ${
              i === activeIdx ? "bg-white scale-110" : "bg-white/50"
            }`}
          />
        ))}
      </div>

      {/* Per-image caption */}
      {images[activeIdx].caption && (
        <p className="px-4 py-1.5 text-xs text-muted-foreground italic">{images[activeIdx].caption}</p>
      )}
    </div>
  );
};

export default ImageCarousel;
