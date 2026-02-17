import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

export interface AvatarConfig {
  body_height: string;  // short, medium, tall
  body_fat: string;     // low, medium, high
  muscle_mass: string;  // low, medium, high
  skin_color: string;   // hex
  hair_style: string;   // none, short, medium, long, mohawk, ponytail, bun
  hair_color: string;   // hex
  gender?: string;      // man, kvinna, annat
}

export interface EquippedItems {
  shoes?: { style_data: { color: string } };
  pants?: { style_data: { color: string } };
  shirt?: { style_data: { color: string } };
  hat?: { style_data: { color: string; type?: string } };
}

interface Avatar3DProps {
  config: AvatarConfig;
  equipped?: EquippedItems;
  size?: number;
}

const HEIGHTS: Record<string, number> = { short: 0.88, medium: 1, tall: 1.12 };
const FAT: Record<string, number> = { low: 0.88, medium: 1, high: 1.2 };
const MUSCLE: Record<string, number> = { low: 0.92, medium: 1, high: 1.15 };

const SEG = 32; // High segment count for smooth spheres

function AvatarCharacter({ config, equipped }: { config: AvatarConfig; equipped: EquippedItems }) {
  const groupRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const waveTimeRef = useRef(0);
  const isWavingRef = useRef(false);
  const nextWaveRef = useRef(Math.random() * 8 + 5);

  const h = HEIGHTS[config.body_height] || 1;
  const f = FAT[config.body_fat] || 1;
  const m = MUSCLE[config.muscle_mass] || 1;
  const isFemale = config.gender === "kvinna";

  const bodyWidth = isFemale ? 0.3 * f * m : 0.35 * f * m;
  const hipWidth = isFemale ? bodyWidth * 1.15 : bodyWidth;
  const waistWidth = isFemale ? bodyWidth * 0.85 : bodyWidth;

  const skinMat = useMemo(() => new THREE.MeshStandardMaterial({ 
    color: config.skin_color, roughness: 0.6, metalness: 0.05 
  }), [config.skin_color]);
  
  const hairMat = useMemo(() => new THREE.MeshStandardMaterial({ 
    color: config.hair_color, roughness: 0.8, metalness: 0.05 
  }), [config.hair_color]);

  const pantsMat = useMemo(() => {
    const c = equipped?.pants?.style_data?.color || "#1a365d";
    return new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 });
  }, [equipped?.pants]);

  const shirtMat = useMemo(() => {
    const c = equipped?.shirt?.style_data?.color || "#2d3748";
    return new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 });
  }, [equipped?.shirt]);

  const shoesMat = useMemo(() => {
    const c = equipped?.shoes?.style_data?.color || "#1a1a1a";
    return new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 });
  }, [equipped?.shoes]);

  const hatMat = useMemo(() => {
    const c = equipped?.hat?.style_data?.color || "#c53030";
    return new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 });
  }, [equipped?.hat]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const time = Date.now() * 0.001;
    groupRef.current.scale.y = h * (1 + Math.sin(time * 1.5) * 0.006);

    waveTimeRef.current += delta;
    if (!isWavingRef.current && waveTimeRef.current > nextWaveRef.current) {
      isWavingRef.current = true;
      waveTimeRef.current = 0;
    }

    if (isWavingRef.current && rightArmRef.current) {
      const t = waveTimeRef.current;
      if (t < 2.5) {
        const wave = Math.sin(t * 4) * 0.3;
        rightArmRef.current.rotation.z = -1.2 + wave;
        rightArmRef.current.rotation.x = -0.3;
      } else {
        rightArmRef.current.rotation.z = 0;
        rightArmRef.current.rotation.x = 0;
        isWavingRef.current = false;
        waveTimeRef.current = 0;
        nextWaveRef.current = Math.random() * 10 + 6;
      }
    }
  });

  const armWidth = 0.09 * m;
  const legWidth = 0.11 * f;
  const headSize = 0.24;

  return (
    <group ref={groupRef} scale={[1, h, 1]}>
      {/* Head - smooth sphere */}
      <mesh position={[0, 1.58, 0]} material={skinMat}>
        <sphereGeometry args={[headSize, SEG, SEG]} />
      </mesh>

      {/* Ears */}
      <mesh position={[-headSize * 0.92, 1.55, 0]} material={skinMat}>
        <sphereGeometry args={[0.055, SEG, SEG]} />
      </mesh>
      <mesh position={[headSize * 0.92, 1.55, 0]} material={skinMat}>
        <sphereGeometry args={[0.055, SEG, SEG]} />
      </mesh>

      {/* Eyes - glossy dark spheres */}
      <mesh position={[-0.075, 1.61, 0.19]}>
        <sphereGeometry args={[0.035, SEG, SEG]} />
        <meshStandardMaterial color="#111111" roughness={0.1} metalness={0.3} />
      </mesh>
      <mesh position={[0.075, 1.61, 0.19]}>
        <sphereGeometry args={[0.035, SEG, SEG]} />
        <meshStandardMaterial color="#111111" roughness={0.1} metalness={0.3} />
      </mesh>
      {/* Eye highlights */}
      <mesh position={[-0.065, 1.625, 0.22]}>
        <sphereGeometry args={[0.012, 12, 12]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0.065, 1.625, 0.22]}>
        <sphereGeometry args={[0.012, 12, 12]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} />
      </mesh>

      {/* Eyebrows */}
      <mesh position={[-0.075, 1.66, 0.2]} rotation={[0, 0, 0.1]}>
        <capsuleGeometry args={[0.012, 0.05, 8, 16]} />
        <meshStandardMaterial color={config.hair_color} roughness={0.8} />
      </mesh>
      <mesh position={[0.075, 1.66, 0.2]} rotation={[0, 0, -0.1]}>
        <capsuleGeometry args={[0.012, 0.05, 8, 16]} />
        <meshStandardMaterial color={config.hair_color} roughness={0.8} />
      </mesh>

      {/* Nose */}
      <mesh position={[0, 1.54, 0.22]} material={skinMat}>
        <sphereGeometry args={[0.03, SEG, SEG]} />
      </mesh>

      {/* Mouth - subtle smile */}
      <mesh position={[0, 1.48, 0.2]} rotation={[0.2, 0, 0]}>
        <torusGeometry args={[0.04, 0.008, 8, 16, Math.PI]} />
        <meshStandardMaterial color="#cc7777" roughness={0.5} />
      </mesh>

      {/* Cheeks - subtle blush */}
      <mesh position={[-0.13, 1.52, 0.14]} material={skinMat}>
        <sphereGeometry args={[0.035, SEG, SEG]} />
      </mesh>
      <mesh position={[0.13, 1.52, 0.14]} material={skinMat}>
        <sphereGeometry args={[0.035, SEG, SEG]} />
      </mesh>

      {/* Hair */}
      {config.hair_style !== "none" && (
        <group>
          {config.hair_style === "short" && (
            <mesh position={[0, 1.68, -0.02]} material={hairMat}>
              <sphereGeometry args={[headSize + 0.035, SEG, SEG, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
            </mesh>
          )}
          {config.hair_style === "medium" && (
            <>
              <mesh position={[0, 1.68, -0.02]} material={hairMat}>
                <sphereGeometry args={[headSize + 0.04, SEG, SEG, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
              </mesh>
              <mesh position={[0, 1.45, -0.14]} material={hairMat}>
                <capsuleGeometry args={[0.14, 0.15, 16, SEG]} />
              </mesh>
            </>
          )}
          {config.hair_style === "long" && (
            <>
              <mesh position={[0, 1.68, -0.02]} material={hairMat}>
                <sphereGeometry args={[headSize + 0.04, SEG, SEG, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
              </mesh>
              <mesh position={[0, 1.35, -0.14]} material={hairMat}>
                <capsuleGeometry args={[0.15, 0.35, 16, SEG]} />
              </mesh>
              {/* Side hair */}
              <mesh position={[-0.18, 1.4, -0.05]} material={hairMat}>
                <capsuleGeometry args={[0.06, 0.25, 8, 16]} />
              </mesh>
              <mesh position={[0.18, 1.4, -0.05]} material={hairMat}>
                <capsuleGeometry args={[0.06, 0.25, 8, 16]} />
              </mesh>
            </>
          )}
          {config.hair_style === "mohawk" && (
            <mesh position={[0, 1.82, 0]} material={hairMat}>
              <capsuleGeometry args={[0.04, 0.15, 8, 16]} />
            </mesh>
          )}
          {config.hair_style === "ponytail" && (
            <>
              <mesh position={[0, 1.68, -0.02]} material={hairMat}>
                <sphereGeometry args={[headSize + 0.035, SEG, SEG, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
              </mesh>
              <mesh position={[0, 1.6, -0.26]} material={hairMat}>
                <sphereGeometry args={[0.08, SEG, SEG]} />
              </mesh>
              <mesh position={[0, 1.4, -0.28]} material={hairMat}>
                <capsuleGeometry args={[0.05, 0.2, 8, 16]} />
              </mesh>
            </>
          )}
          {config.hair_style === "bun" && (
            <>
              <mesh position={[0, 1.68, -0.02]} material={hairMat}>
                <sphereGeometry args={[headSize + 0.035, SEG, SEG, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
              </mesh>
              <mesh position={[0, 1.82, -0.05]} material={hairMat}>
                <sphereGeometry args={[0.1, SEG, SEG]} />
              </mesh>
            </>
          )}
          {config.hair_style === "curly" && (
            <group>
              {[...Array(12)].map((_, i) => {
                const angle = (i / 12) * Math.PI * 2;
                const r = headSize + 0.04;
                return (
                  <mesh key={i} position={[Math.sin(angle) * r * 0.8, 1.7 + Math.cos(angle * 0.5) * 0.04, Math.cos(angle) * r * 0.6 - 0.02]} material={hairMat}>
                    <sphereGeometry args={[0.05, 16, 16]} />
                  </mesh>
                );
              })}
            </group>
          )}
        </group>
      )}

      {/* Hat */}
      {equipped?.hat && (
        <group>
          <mesh position={[0, 1.76, 0]} material={hatMat}>
            <sphereGeometry args={[0.18, SEG, SEG, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
          </mesh>
          <mesh position={[0, 1.68, 0]} material={hatMat} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.22, 0.02, 8, SEG]} />
          </mesh>
        </group>
      )}

      {/* Neck */}
      <mesh position={[0, 1.38, 0]} material={skinMat}>
        <capsuleGeometry args={[0.06, 0.06, 8, SEG]} />
      </mesh>

      {/* Torso (shirt) - capsule shape for roundness */}
      <mesh position={[0, 1.15, 0]} material={shirtMat}>
        <capsuleGeometry args={[bodyWidth * 0.65, 0.2, 16, SEG]} />
      </mesh>
      {/* Chest area for female */}
      {isFemale && (
        <>
          <mesh position={[-0.08, 1.2, 0.1]} material={shirtMat}>
            <sphereGeometry args={[0.07 * f, SEG, SEG]} />
          </mesh>
          <mesh position={[0.08, 1.2, 0.1]} material={shirtMat}>
            <sphereGeometry args={[0.07 * f, SEG, SEG]} />
          </mesh>
        </>
      )}

      {/* Waist/hip connector */}
      <mesh position={[0, 0.95, 0]} material={shirtMat}>
        <capsuleGeometry args={[waistWidth * 0.6, 0.05, 8, SEG]} />
      </mesh>

      {/* Left arm */}
      <group position={[-(bodyWidth * 0.65 + armWidth + 0.04), 1.2, 0]}>
        {/* Upper arm (shirt) */}
        <mesh material={shirtMat}>
          <capsuleGeometry args={[armWidth, 0.12, 8, SEG]} />
        </mesh>
        {/* Forearm (skin) */}
        <mesh position={[0, -0.2, 0]} material={skinMat}>
          <capsuleGeometry args={[armWidth * 0.85, 0.08, 8, SEG]} />
        </mesh>
        {/* Hand */}
        <mesh position={[0, -0.32, 0]} material={skinMat}>
          <sphereGeometry args={[0.05, SEG, SEG]} />
        </mesh>
      </group>

      {/* Right arm (waves) */}
      <group ref={rightArmRef} position={[bodyWidth * 0.65 + armWidth + 0.04, 1.2, 0]}>
        <mesh material={shirtMat}>
          <capsuleGeometry args={[armWidth, 0.12, 8, SEG]} />
        </mesh>
        <mesh position={[0, -0.2, 0]} material={skinMat}>
          <capsuleGeometry args={[armWidth * 0.85, 0.08, 8, SEG]} />
        </mesh>
        <mesh position={[0, -0.32, 0]} material={skinMat}>
          <sphereGeometry args={[0.05, SEG, SEG]} />
        </mesh>
      </group>

      {/* Hips / pants upper */}
      <mesh position={[0, 0.82, 0]} material={pantsMat}>
        <capsuleGeometry args={[hipWidth * 0.6, 0.08, 8, SEG]} />
      </mesh>

      {/* Left leg */}
      <mesh position={[-0.1, 0.65, 0]} material={pantsMat}>
        <capsuleGeometry args={[legWidth, 0.15, 8, SEG]} />
      </mesh>
      {/* Right leg */}
      <mesh position={[0.1, 0.65, 0]} material={pantsMat}>
        <capsuleGeometry args={[legWidth, 0.15, 8, SEG]} />
      </mesh>

      {/* Shoes - rounded */}
      <mesh position={[-0.1, 0.47, 0.03]} material={shoesMat}>
        <sphereGeometry args={[0.07, SEG, SEG]} />
      </mesh>
      <mesh position={[-0.1, 0.47, 0.07]} material={shoesMat}>
        <sphereGeometry args={[0.05, SEG, SEG]} />
      </mesh>
      <mesh position={[0.1, 0.47, 0.03]} material={shoesMat}>
        <sphereGeometry args={[0.07, SEG, SEG]} />
      </mesh>
      <mesh position={[0.1, 0.47, 0.07]} material={shoesMat}>
        <sphereGeometry args={[0.05, SEG, SEG]} />
      </mesh>
    </group>
  );
}

const Avatar3D = ({ config, equipped = {}, size = 200 }: Avatar3DProps) => {
  return (
    <div style={{ width: size, height: size }}>
      <Canvas camera={{ position: [0, 1.2, 2.8], fov: 35 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[2, 3, 2]} intensity={0.9} />
        <directionalLight position={[-2, 1, -1]} intensity={0.3} />
        <hemisphereLight args={["#b1e1ff", "#ffeead", 0.3]} />
        <AvatarCharacter config={config} equipped={equipped} />
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          minPolarAngle={Math.PI / 3}
          maxPolarAngle={Math.PI / 2.2}
          target={[0, 1.1, 0]}
        />
      </Canvas>
    </div>
  );
};

export default Avatar3D;
