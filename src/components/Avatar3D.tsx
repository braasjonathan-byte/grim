import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

export interface AvatarConfig {
  body_height: string;  // short, medium, tall
  body_fat: string;     // low, medium, high
  muscle_mass: string;  // low, medium, high
  skin_color: string;   // hex
  hair_style: string;   // none, short, medium, long, mohawk
  hair_color: string;   // hex
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

const HEIGHTS: Record<string, number> = { short: 0.85, medium: 1, tall: 1.15 };
const FAT: Record<string, number> = { low: 0.85, medium: 1, high: 1.25 };
const MUSCLE: Record<string, number> = { low: 0.9, medium: 1, high: 1.2 };

function AvatarCharacter({ config, equipped }: { config: AvatarConfig; equipped: EquippedItems }) {
  const groupRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const waveTimeRef = useRef(0);
  const isWavingRef = useRef(false);
  const nextWaveRef = useRef(Math.random() * 8 + 5);

  const h = HEIGHTS[config.body_height] || 1;
  const f = FAT[config.body_fat] || 1;
  const m = MUSCLE[config.muscle_mass] || 1;

  const bodyWidth = 0.35 * f * m;
  const skinMat = useMemo(() => new THREE.MeshStandardMaterial({ color: config.skin_color }), [config.skin_color]);
  const hairMat = useMemo(() => new THREE.MeshStandardMaterial({ color: config.hair_color }), [config.hair_color]);

  const pantsMat = useMemo(() => {
    const c = equipped?.pants?.style_data?.color || "#1a365d";
    return new THREE.MeshStandardMaterial({ color: c });
  }, [equipped?.pants]);

  const shirtMat = useMemo(() => {
    const c = equipped?.shirt?.style_data?.color || "#2d3748";
    return new THREE.MeshStandardMaterial({ color: c });
  }, [equipped?.shirt]);

  const shoesMat = useMemo(() => {
    const c = equipped?.shoes?.style_data?.color || "#1a1a1a";
    return new THREE.MeshStandardMaterial({ color: c });
  }, [equipped?.shoes]);

  const hatMat = useMemo(() => {
    const c = equipped?.hat?.style_data?.color || "#c53030";
    return new THREE.MeshStandardMaterial({ color: c });
  }, [equipped?.hat]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // Breathing
    const time = Date.now() * 0.001;
    groupRef.current.scale.y = h * (1 + Math.sin(time * 1.5) * 0.008);

    // Waving logic
    waveTimeRef.current += delta;
    if (!isWavingRef.current && waveTimeRef.current > nextWaveRef.current) {
      isWavingRef.current = true;
      waveTimeRef.current = 0;
    }

    if (isWavingRef.current && rightArmRef.current) {
      const t = waveTimeRef.current;
      if (t < 2.5) {
        // Wave animation
        const wave = Math.sin(t * 4) * 0.3;
        rightArmRef.current.rotation.z = -1.2 + wave;
        rightArmRef.current.rotation.x = -0.3;
      } else {
        // Return to rest
        rightArmRef.current.rotation.z = 0;
        rightArmRef.current.rotation.x = 0;
        isWavingRef.current = false;
        waveTimeRef.current = 0;
        nextWaveRef.current = Math.random() * 10 + 6;
      }
    }
  });

  const armWidth = 0.1 * m;
  const legWidth = 0.12 * f;
  const headSize = 0.22;

  return (
    <group ref={groupRef} scale={[1, h, 1]}>
      {/* Head */}
      <mesh position={[0, 1.55, 0]} material={skinMat}>
        <sphereGeometry args={[headSize, 16, 16]} />
      </mesh>

      {/* Eyes */}
      <mesh position={[-0.07, 1.58, 0.18]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[0.07, 1.58, 0.18]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>

      {/* Mouth */}
      <mesh position={[0, 1.48, 0.19]}>
        <boxGeometry args={[0.08, 0.015, 0.02]} />
        <meshStandardMaterial color="#cc6666" />
      </mesh>

      {/* Hair */}
      {config.hair_style !== "none" && (
        <group>
          {config.hair_style === "short" && (
            <mesh position={[0, 1.65, -0.02]} material={hairMat}>
              <sphereGeometry args={[headSize + 0.03, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
            </mesh>
          )}
          {config.hair_style === "medium" && (
            <>
              <mesh position={[0, 1.65, -0.02]} material={hairMat}>
                <sphereGeometry args={[headSize + 0.04, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.65]} />
              </mesh>
              <mesh position={[0, 1.45, -0.12]} material={hairMat}>
                <boxGeometry args={[0.35, 0.2, 0.08]} />
              </mesh>
            </>
          )}
          {config.hair_style === "long" && (
            <>
              <mesh position={[0, 1.65, -0.02]} material={hairMat}>
                <sphereGeometry args={[headSize + 0.04, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.65]} />
              </mesh>
              <mesh position={[0, 1.35, -0.12]} material={hairMat}>
                <boxGeometry args={[0.38, 0.45, 0.08]} />
              </mesh>
            </>
          )}
          {config.hair_style === "mohawk" && (
            <mesh position={[0, 1.78, 0]} material={hairMat}>
              <boxGeometry args={[0.06, 0.18, 0.25]} />
            </mesh>
          )}
        </group>
      )}

      {/* Hat */}
      {equipped?.hat && (
        <group>
          <mesh position={[0, 1.72, 0]} material={hatMat}>
            <cylinderGeometry args={[0.15, 0.18, 0.12, 16]} />
          </mesh>
          <mesh position={[0, 1.67, 0]} material={hatMat}>
            <cylinderGeometry args={[0.28, 0.28, 0.02, 16]} />
          </mesh>
        </group>
      )}

      {/* Torso (shirt) */}
      <mesh position={[0, 1.15, 0]} material={shirtMat}>
        <boxGeometry args={[bodyWidth * 2, 0.4, 0.22]} />
      </mesh>

      {/* Left arm */}
      <group position={[-(bodyWidth + armWidth), 1.2, 0]}>
        <mesh material={shirtMat}>
          <boxGeometry args={[armWidth * 2, 0.35, 0.12]} />
        </mesh>
        <mesh position={[0, -0.22, 0]} material={skinMat}>
          <sphereGeometry args={[0.06, 8, 8]} />
        </mesh>
      </group>

      {/* Right arm (waves) */}
      <group ref={rightArmRef} position={[bodyWidth + armWidth, 1.2, 0]}>
        <mesh material={shirtMat}>
          <boxGeometry args={[armWidth * 2, 0.35, 0.12]} />
        </mesh>
        <mesh position={[0, -0.22, 0]} material={skinMat}>
          <sphereGeometry args={[0.06, 8, 8]} />
        </mesh>
      </group>

      {/* Pants / legs */}
      <mesh position={[-0.1, 0.72, 0]} material={pantsMat}>
        <boxGeometry args={[legWidth * 2, 0.42, 0.18]} />
      </mesh>
      <mesh position={[0.1, 0.72, 0]} material={pantsMat}>
        <boxGeometry args={[legWidth * 2, 0.42, 0.18]} />
      </mesh>

      {/* Shoes */}
      <mesh position={[-0.1, 0.47, 0.04]} material={shoesMat}>
        <boxGeometry args={[0.14, 0.08, 0.22]} />
      </mesh>
      <mesh position={[0.1, 0.47, 0.04]} material={shoesMat}>
        <boxGeometry args={[0.14, 0.08, 0.22]} />
      </mesh>
    </group>
  );
}

const Avatar3D = ({ config, equipped = {}, size = 200 }: Avatar3DProps) => {
  return (
    <div style={{ width: size, height: size }}>
      <Canvas camera={{ position: [0, 1.2, 2.8], fov: 35 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[2, 3, 2]} intensity={0.8} />
        <directionalLight position={[-2, 1, -1]} intensity={0.3} />
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
