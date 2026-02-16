import { useEffect, useState, useRef } from "react";

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

interface Burst {
  id: number;
  x: number;
  y: number;
  particles: Particle[];
}

const COLORS = [
  "hsl(45, 100%, 60%)",   // gold
  "hsl(0, 85%, 60%)",     // red
  "hsl(200, 90%, 60%)",   // blue
  "hsl(120, 70%, 55%)",   // green
  "hsl(280, 80%, 65%)",   // purple
  "hsl(30, 95%, 60%)",    // orange
  "hsl(330, 85%, 65%)",   // pink
];

const FireworksOverlay = ({ onComplete }: { onComplete: () => void }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const burstsRef = useRef<Burst[]>([]);
  const animFrameRef = useRef<number>(0);
  const [visible, setVisible] = useState(true);
  const burstCountRef = useRef(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    let particleId = 0;

    const createBurst = (x: number, y: number) => {
      const count = 40 + Math.floor(Math.random() * 30);
      const particles: Particle[] = [];
      const burstColor = COLORS[Math.floor(Math.random() * COLORS.length)];

      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3;
        const speed = 2 + Math.random() * 4;
        const color = Math.random() > 0.3 ? burstColor : COLORS[Math.floor(Math.random() * COLORS.length)];
        const maxLife = 60 + Math.random() * 40;
        particles.push({
          id: particleId++,
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color,
          size: 2 + Math.random() * 2,
          life: maxLife,
          maxLife,
        });
      }

      burstsRef.current.push({ id: burstCountRef.current++, x, y, particles });
    };

    // Schedule bursts
    const burstTimers: ReturnType<typeof setTimeout>[] = [];
    const totalBursts = 6;
    const burstInterval = 250;
    for (let i = 0; i < totalBursts; i++) {
      burstTimers.push(
        setTimeout(() => {
          const x = canvas.width * (0.15 + Math.random() * 0.7);
          const y = canvas.height * (0.15 + Math.random() * 0.5);
          createBurst(x, y);
        }, i * burstInterval + Math.random() * 150)
      );
    }

    // End after ~3 seconds
    const endTimer = setTimeout(() => {
      setVisible(false);
      onCompleteRef.current();
    }, 3000);

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const burst of burstsRef.current) {
        for (const p of burst.particles) {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.06;
          p.vx *= 0.98;
          p.life--;

          const alpha = Math.max(0, p.life / p.maxLife);
          ctx.globalAlpha = alpha;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
          ctx.fill();
        }

        burst.particles = burst.particles.filter((p) => p.life > 0);
      }

      burstsRef.current = burstsRef.current.filter((b) => b.particles.length > 0);

      ctx.globalAlpha = 1;
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      burstTimers.forEach(clearTimeout);
      clearTimeout(endTimer);
      window.removeEventListener("resize", resize);
    };
  }, []);

  if (!visible) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[200] pointer-events-none"
      style={{ width: "100vw", height: "100vh" }}
    />
  );
};

export default FireworksOverlay;
