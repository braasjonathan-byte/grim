import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

export interface AvatarConfig {
  body_height: string;
  body_fat: string;
  muscle_mass: string;
  skin_color: string;
  hair_style: string;
  hair_color: string;
  gender?: string;
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
const FAT: Record<string, number> = { low: 0.85, medium: 1, high: 1.25 };
const MUSCLE: Record<string, number> = { low: 0.88, medium: 1, high: 1.2 };

const S = 48; // High segment count for ultra-smooth geometry

/* ─── Finger helper ─── */
function Finger({ position, rotation, material, length = 0.06, radius = 0.012 }: any) {
  return (
    <group position={position} rotation={rotation}>
      <mesh material={material}>
        <capsuleGeometry args={[radius, length, 6, 12]} />
      </mesh>
      <mesh position={[0, -(length / 2 + 0.015), 0]} material={material}>
        <sphereGeometry args={[radius * 0.9, 8, 8]} />
      </mesh>
    </group>
  );
}

/* ─── Hand with fingers ─── */
function Hand({ position, material, side = 1 }: any) {
  return (
    <group position={position}>
      {/* Palm */}
      <mesh material={material}>
        <boxGeometry args={[0.05, 0.04, 0.03]} />
      </mesh>
      {/* Thumb */}
      <Finger position={[side * 0.03, -0.01, 0.01]} rotation={[0, 0, side * 0.6]} material={material} length={0.04} radius={0.011} />
      {/* Index */}
      <Finger position={[-0.015 * side, -0.04, 0.008]} rotation={[0, 0, 0]} material={material} length={0.045} />
      {/* Middle */}
      <Finger position={[-0.005 * side, -0.04, 0]} rotation={[0, 0, 0]} material={material} length={0.05} />
      {/* Ring */}
      <Finger position={[0.005 * side, -0.04, -0.008]} rotation={[0, 0, 0]} material={material} length={0.045} />
      {/* Pinky */}
      <Finger position={[0.015 * side, -0.04, -0.015]} rotation={[0, 0, 0]} material={material} length={0.035} radius={0.01} />
    </group>
  );
}

function AvatarCharacter({ config, equipped }: { config: AvatarConfig; equipped: EquippedItems }) {
  const groupRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const waveTimeRef = useRef(0);
  const isWavingRef = useRef(false);
  const nextWaveRef = useRef(Math.random() * 6 + 4);

  const h = HEIGHTS[config.body_height] || 1;
  const f = FAT[config.body_fat] || 1;
  const m = MUSCLE[config.muscle_mass] || 1;
  const isFemale = config.gender === "kvinna";

  const shoulderW = isFemale ? 0.32 * m : 0.38 * m;
  const chestDepth = 0.18 * f;
  const waistW = isFemale ? shoulderW * 0.72 : shoulderW * 0.82;
  const hipW = isFemale ? shoulderW * 1.05 : shoulderW * 0.88;
  const armR = isFemale ? 0.042 * m : 0.05 * m;
  const forearmR = armR * 0.85;
  const thighR = isFemale ? 0.065 * f * m : 0.07 * f * m;
  const calfR = thighR * 0.78;
  const headR = 0.22;

  const skinMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: config.skin_color, roughness: 0.55, metalness: 0.02
  }), [config.skin_color]);

  const skinMatDarker = useMemo(() => {
    const c = new THREE.Color(config.skin_color);
    c.multiplyScalar(0.92);
    return new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.02 });
  }, [config.skin_color]);

  const hairMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: config.hair_color, roughness: 0.75, metalness: 0.08
  }), [config.hair_color]);

  const pantsMat = useMemo(() => {
    const c = equipped?.pants?.style_data?.color || "#1a365d";
    return new THREE.MeshStandardMaterial({ color: c, roughness: 0.65, metalness: 0.02 });
  }, [equipped?.pants]);

  const shirtMat = useMemo(() => {
    const c = equipped?.shirt?.style_data?.color || "#2d3748";
    return new THREE.MeshStandardMaterial({ color: c, roughness: 0.65, metalness: 0.02 });
  }, [equipped?.shirt]);

  const shoesMat = useMemo(() => {
    const c = equipped?.shoes?.style_data?.color || "#1a1a1a";
    return new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, metalness: 0.1 });
  }, [equipped?.shoes]);

  const hatMat = useMemo(() => {
    const c = equipped?.hat?.style_data?.color || "#c53030";
    return new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0.05 });
  }, [equipped?.hat]);

  const eyeWhiteMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#f0f0f0", roughness: 0.2, metalness: 0.0 }), []);
  const irisMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#4a6741", roughness: 0.15, metalness: 0.2 }), []);
  const pupilMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#0a0a0a", roughness: 0.05, metalness: 0.4 }), []);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const time = Date.now() * 0.001;

    // Breathing: chest expansion + subtle sway
    groupRef.current.scale.y = h * (1 + Math.sin(time * 1.8) * 0.005);
    groupRef.current.rotation.y = Math.sin(time * 0.4) * 0.02;

    // Idle arm sway
    if (leftArmRef.current && !isWavingRef.current) {
      leftArmRef.current.rotation.z = Math.sin(time * 0.8) * 0.04;
      leftArmRef.current.rotation.x = Math.sin(time * 0.6 + 1) * 0.03;
    }
    if (rightArmRef.current && !isWavingRef.current) {
      rightArmRef.current.rotation.z = Math.sin(time * 0.8 + Math.PI) * 0.04;
      rightArmRef.current.rotation.x = Math.sin(time * 0.6 + Math.PI + 1) * 0.03;
    }

    // Wave animation
    waveTimeRef.current += delta;
    if (!isWavingRef.current && waveTimeRef.current > nextWaveRef.current) {
      isWavingRef.current = true;
      waveTimeRef.current = 0;
    }
    if (isWavingRef.current && rightArmRef.current) {
      const t = waveTimeRef.current;
      if (t < 2.8) {
        const raise = Math.min(t * 3, 1);
        const wave = Math.sin(t * 5) * 0.25;
        rightArmRef.current.rotation.z = (-1.4 + wave) * raise;
        rightArmRef.current.rotation.x = -0.3 * raise;
      } else {
        const fade = Math.max(0, 1 - (t - 2.8) * 3);
        rightArmRef.current.rotation.z = -1.4 * fade;
        rightArmRef.current.rotation.x = -0.3 * fade;
        if (fade <= 0) {
          isWavingRef.current = false;
          waveTimeRef.current = 0;
          nextWaveRef.current = Math.random() * 8 + 5;
        }
      }
    }
  });

  const legSpacing = hipW * 0.38;

  return (
    <group ref={groupRef} scale={[1, h, 1]}>

      {/* ══════ HEAD ══════ */}
      <mesh position={[0, 1.62, 0]} material={skinMat}>
        <sphereGeometry args={[headR, S, S]} />
      </mesh>

      {/* Jaw / chin definition */}
      <mesh position={[0, 1.5, 0.04]} material={skinMat}>
        <sphereGeometry args={[headR * 0.7, S, S]} />
      </mesh>

      {/* Ears with inner detail */}
      {[-1, 1].map((side) => (
        <group key={`ear${side}`} position={[side * headR * 0.95, 1.59, 0]}>
          <mesh material={skinMat}>
            <sphereGeometry args={[0.05, S, S]} />
          </mesh>
          <mesh position={[side * -0.01, 0, 0.01]} material={skinMatDarker}>
            <sphereGeometry args={[0.03, 16, 16]} />
          </mesh>
        </group>
      ))}

      {/* ── Eyes ── */}
      {[-1, 1].map((side) => (
        <group key={`eye${side}`} position={[side * 0.075, 1.64, 0.17]}>
          {/* Eyeball white */}
          <mesh material={eyeWhiteMat}>
            <sphereGeometry args={[0.033, S, S]} />
          </mesh>
          {/* Iris */}
          <mesh position={[0, 0, 0.02]} material={irisMat}>
            <sphereGeometry args={[0.018, 16, 16]} />
          </mesh>
          {/* Pupil */}
          <mesh position={[0, 0, 0.028]} material={pupilMat}>
            <sphereGeometry args={[0.009, 12, 12]} />
          </mesh>
          {/* Highlight */}
          <mesh position={[side * 0.008, 0.008, 0.032]}>
            <sphereGeometry args={[0.005, 8, 8]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.8} />
          </mesh>
          {/* Eyelid */}
          <mesh position={[0, 0.02, 0.01]} material={skinMat} rotation={[0.3, 0, 0]}>
            <sphereGeometry args={[0.035, S, S, 0, Math.PI * 2, 0, Math.PI * 0.35]} />
          </mesh>
        </group>
      ))}

      {/* Eyebrows - thicker, more defined */}
      {[-1, 1].map((side) => (
        <group key={`brow${side}`} position={[side * 0.075, 1.69, 0.17]}>
          <mesh rotation={[0.2, 0, side * 0.15]} material={hairMat}>
            <capsuleGeometry args={[0.014, 0.055, 8, 16]} />
          </mesh>
          <mesh position={[side * -0.015, 0.005, 0.005]} rotation={[0.2, 0, side * 0.3]} material={hairMat}>
            <capsuleGeometry args={[0.011, 0.03, 6, 12]} />
          </mesh>
        </group>
      ))}

      {/* Nose - bridge + tip */}
      <mesh position={[0, 1.58, 0.2]} material={skinMat} rotation={[0.3, 0, 0]}>
        <capsuleGeometry args={[0.015, 0.04, 8, 16]} />
      </mesh>
      <mesh position={[0, 1.545, 0.22]} material={skinMat}>
        <sphereGeometry args={[0.025, S, S]} />
      </mesh>
      {/* Nostrils */}
      <mesh position={[-0.015, 1.535, 0.215]} material={skinMatDarker}>
        <sphereGeometry args={[0.01, 8, 8]} />
      </mesh>
      <mesh position={[0.015, 1.535, 0.215]} material={skinMatDarker}>
        <sphereGeometry args={[0.01, 8, 8]} />
      </mesh>

      {/* Mouth */}
      <group position={[0, 1.49, 0.18]}>
        {/* Upper lip */}
        <mesh rotation={[0.15, 0, 0]}>
          <torusGeometry args={[0.035, 0.007, 8, 20, Math.PI]} />
          <meshStandardMaterial color="#c06060" roughness={0.4} />
        </mesh>
        {/* Lower lip */}
        <mesh position={[0, -0.008, 0.003]} rotation={[-0.1, Math.PI, 0]}>
          <torusGeometry args={[0.03, 0.009, 8, 20, Math.PI]} />
          <meshStandardMaterial color="#cc6666" roughness={0.35} />
        </mesh>
      </group>

      {/* Cheeks */}
      {[-1, 1].map((side) => (
        <mesh key={`cheek${side}`} position={[side * 0.14, 1.54, 0.1]} material={skinMat}>
          <sphereGeometry args={[0.04, S, S]} />
        </mesh>
      ))}

      {/* ══════ HAIR ══════ */}
      {config.hair_style !== "none" && <HairStyle style={config.hair_style} headR={headR} hairMat={hairMat} />}

      {/* ══════ HAT ══════ */}
      {equipped?.hat && (
        <group>
          {/* Crown */}
          <mesh position={[0, 1.79, 0]} material={hatMat}>
            <sphereGeometry args={[0.19, S, S, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
          </mesh>
          {/* Brim */}
          <mesh position={[0, 1.71, 0.02]} material={hatMat} rotation={[0.1, 0, 0]}>
            <cylinderGeometry args={[0.25, 0.25, 0.015, S]} />
          </mesh>
          {/* Band */}
          <mesh position={[0, 1.74, 0]}>
            <cylinderGeometry args={[0.192, 0.192, 0.025, S]} />
            <meshStandardMaterial color="#222222" roughness={0.4} />
          </mesh>
        </group>
      )}

      {/* ══════ NECK ══════ */}
      <mesh position={[0, 1.4, 0]} material={skinMat}>
        <capsuleGeometry args={[0.055, 0.08, 12, S]} />
      </mesh>
      {/* Neck muscles (trapezius hint) */}
      {!isFemale && m > 1 && (
        <>
          <mesh position={[-0.06, 1.38, -0.01]} material={skinMat} rotation={[0, 0, 0.3]}>
            <capsuleGeometry args={[0.03, 0.06, 8, 16]} />
          </mesh>
          <mesh position={[0.06, 1.38, -0.01]} material={skinMat} rotation={[0, 0, -0.3]}>
            <capsuleGeometry args={[0.03, 0.06, 8, 16]} />
          </mesh>
        </>
      )}

      {/* ══════ TORSO ══════ */}
      {/* Shoulders */}
      {[-1, 1].map((side) => (
        <mesh key={`shoulder${side}`} position={[side * shoulderW * 0.5, 1.28, 0]} material={shirtMat}>
          <sphereGeometry args={[armR * 1.6, S, S]} />
        </mesh>
      ))}
      {/* Upper chest */}
      <mesh position={[0, 1.22, 0]} material={shirtMat}>
        <capsuleGeometry args={[shoulderW * 0.42, 0.08, 16, S]} />
      </mesh>
      {/* Mid torso */}
      <mesh position={[0, 1.12, 0]} material={shirtMat} scale={[1, 1, chestDepth / 0.18]}>
        <capsuleGeometry args={[shoulderW * 0.38, 0.06, 16, S]} />
      </mesh>
      {/* Lower torso / waist */}
      <mesh position={[0, 1.02, 0]} material={shirtMat}>
        <capsuleGeometry args={[waistW * 0.5, 0.06, 12, S]} />
      </mesh>

      {/* Chest detail for female */}
      {isFemale && (
        <>
          <mesh position={[-0.07, 1.2, 0.1]} material={shirtMat}>
            <sphereGeometry args={[0.065 * f, S, S]} />
          </mesh>
          <mesh position={[0.07, 1.2, 0.1]} material={shirtMat}>
            <sphereGeometry args={[0.065 * f, S, S]} />
          </mesh>
        </>
      )}

      {/* Pectoral definition for male */}
      {!isFemale && m >= 1 && (
        <>
          <mesh position={[-0.07, 1.22, 0.08]} material={shirtMat}>
            <sphereGeometry args={[0.05 * m, S, S]} />
          </mesh>
          <mesh position={[0.07, 1.22, 0.08]} material={shirtMat}>
            <sphereGeometry args={[0.05 * m, S, S]} />
          </mesh>
        </>
      )}

      {/* ══════ ARMS ══════ */}
      {/* Left arm */}
      <group ref={leftArmRef} position={[-(shoulderW * 0.5 + armR * 1.2), 1.28, 0]}>
        {/* Bicep */}
        <mesh position={[0, -0.08, 0]} material={shirtMat}>
          <capsuleGeometry args={[armR * 1.1, 0.1, 8, S]} />
        </mesh>
        {/* Elbow */}
        <mesh position={[0, -0.17, -0.01]} material={skinMat}>
          <sphereGeometry args={[armR * 1.05, 16, 16]} />
        </mesh>
        {/* Forearm */}
        <mesh position={[0, -0.26, 0]} material={skinMat}>
          <capsuleGeometry args={[forearmR, 0.1, 8, S]} />
        </mesh>
        {/* Wrist */}
        <mesh position={[0, -0.34, 0]} material={skinMat}>
          <sphereGeometry args={[forearmR * 0.9, 12, 12]} />
        </mesh>
        {/* Hand with fingers */}
        <Hand position={[0, -0.39, 0]} material={skinMat} side={-1} />
      </group>

      {/* Right arm (waves) */}
      <group ref={rightArmRef} position={[shoulderW * 0.5 + armR * 1.2, 1.28, 0]}>
        <mesh position={[0, -0.08, 0]} material={shirtMat}>
          <capsuleGeometry args={[armR * 1.1, 0.1, 8, S]} />
        </mesh>
        <mesh position={[0, -0.17, -0.01]} material={skinMat}>
          <sphereGeometry args={[armR * 1.05, 16, 16]} />
        </mesh>
        <mesh position={[0, -0.26, 0]} material={skinMat}>
          <capsuleGeometry args={[forearmR, 0.1, 8, S]} />
        </mesh>
        <mesh position={[0, -0.34, 0]} material={skinMat}>
          <sphereGeometry args={[forearmR * 0.9, 12, 12]} />
        </mesh>
        <Hand position={[0, -0.39, 0]} material={skinMat} side={1} />
      </group>

      {/* ══════ LOWER BODY ══════ */}
      {/* Hip area */}
      <mesh position={[0, 0.9, 0]} material={pantsMat}>
        <capsuleGeometry args={[hipW * 0.48, 0.06, 12, S]} />
      </mesh>
      {/* Glute area (back) */}
      <mesh position={[0, 0.87, -0.04]} material={pantsMat}>
        <sphereGeometry args={[hipW * 0.38, S, S]} />
      </mesh>

      {/* Legs */}
      {[-1, 1].map((side) => (
        <group key={`leg${side}`} position={[side * legSpacing, 0, 0]}>
          {/* Upper thigh */}
          <mesh position={[0, 0.76, 0]} material={pantsMat}>
            <capsuleGeometry args={[thighR, 0.12, 8, S]} />
          </mesh>
          {/* Knee */}
          <mesh position={[0, 0.61, 0.01]} material={pantsMat}>
            <sphereGeometry args={[thighR * 0.85, 16, 16]} />
          </mesh>
          {/* Calf */}
          <mesh position={[0, 0.5, 0]} material={pantsMat}>
            <capsuleGeometry args={[calfR, 0.1, 8, S]} />
          </mesh>
          {/* Shin taper */}
          <mesh position={[0, 0.4, 0.01]} material={pantsMat}>
            <capsuleGeometry args={[calfR * 0.75, 0.04, 8, S]} />
          </mesh>

          {/* ── Shoes ── */}
          {/* Ankle */}
          <mesh position={[0, 0.34, 0]} material={shoesMat}>
            <sphereGeometry args={[0.045, S, S]} />
          </mesh>
          {/* Shoe body */}
          <mesh position={[0, 0.31, 0.02]} material={shoesMat}>
            <capsuleGeometry args={[0.045, 0.06, 8, S]} />
          </mesh>
          {/* Toe box */}
          <mesh position={[0, 0.3, 0.08]} material={shoesMat}>
            <sphereGeometry args={[0.04, S, S]} />
          </mesh>
          {/* Sole */}
          <mesh position={[0, 0.275, 0.04]} material={shoesMat} scale={[1, 0.4, 1.3]}>
            <capsuleGeometry args={[0.045, 0.04, 8, 16]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ─── Shared: sculpted hair cap that covers the top/back of the head ─── */
function HairCap({ headR, hairMat, coverage = 0.52 }: { headR: number; hairMat: THREE.MeshStandardMaterial; coverage?: number }) {
  return (
    <group>
      {/* Main cap */}
      <mesh position={[0, 1.72, -0.02]} material={hairMat}>
        <sphereGeometry args={[headR + 0.025, S, S, 0, Math.PI * 2, 0, Math.PI * coverage]} />
      </mesh>
      {/* Layered volume on top */}
      <mesh position={[0, 1.74, -0.01]} material={hairMat}>
        <sphereGeometry args={[headR + 0.032, S, S, 0, Math.PI * 2, 0, Math.PI * 0.38]} />
      </mesh>
      {/* Side volume */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (headR * 0.75), 1.64, -0.03]} material={hairMat}>
          <capsuleGeometry args={[0.04, 0.06, 8, S]} />
        </mesh>
      ))}
      {/* Back volume */}
      <mesh position={[0, 1.62, -(headR * 0.7)]} material={hairMat}>
        <sphereGeometry args={[0.1, S, S]} />
      </mesh>
    </group>
  );
}

/* ─── Hair strand helper for flowing hair ─── */
function HairStrand({ position, length, radius, rotation, material }: any) {
  return (
    <mesh position={position} rotation={rotation || [0, 0, 0]} material={material}>
      <capsuleGeometry args={[radius, length, 6, 16]} />
    </mesh>
  );
}

/* ─── Hair Styles Component ─── */
function HairStyle({ style, headR, hairMat }: { style: string; headR: number; hairMat: THREE.MeshStandardMaterial }) {
  switch (style) {
    case "buzz":
      return (
        <group>
          <mesh position={[0, 1.72, -0.01]} material={hairMat}>
            <sphereGeometry args={[headR + 0.012, S, S, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
          </mesh>
          {/* Subtle texture bumps */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.12, 1.65, -0.02]} material={hairMat}>
              <sphereGeometry args={[0.04, 12, 12]} />
            </mesh>
          ))}
        </group>
      );

    case "short":
      return (
        <group>
          <HairCap headR={headR} hairMat={hairMat} coverage={0.5} />
          {/* Textured top volume */}
          <mesh position={[0, 1.76, 0.02]} material={hairMat}>
            <sphereGeometry args={[headR * 0.6, S, S]} />
          </mesh>
          {/* Parting hint */}
          <mesh position={[0.05, 1.75, 0.06]} material={hairMat} rotation={[0, 0, -0.2]}>
            <capsuleGeometry args={[0.025, 0.04, 6, 12]} />
          </mesh>
        </group>
      );

    case "medium":
      return (
        <group>
          <HairCap headR={headR} hairMat={hairMat} coverage={0.56} />
          {/* Back hair draping down to neck */}
          <mesh position={[0, 1.48, -0.13]} material={hairMat}>
            <capsuleGeometry args={[0.12, 0.14, 12, S]} />
          </mesh>
          {/* Side strands draping over ears */}
          {[-1, 1].map((s) => (
            <group key={s}>
              <HairStrand position={[s * 0.17, 1.55, 0.02]} length={0.1} radius={0.035} rotation={[0, 0, s * 0.15]} material={hairMat} />
              <HairStrand position={[s * 0.19, 1.48, -0.04]} length={0.08} radius={0.03} rotation={[0, 0, s * 0.1]} material={hairMat} />
            </group>
          ))}
          {/* Layered back strands */}
          {[-1, 0, 1].map((s) => (
            <HairStrand key={s} position={[s * 0.08, 1.42, -0.16]} length={0.1} radius={0.04} rotation={[0.15, 0, 0]} material={hairMat} />
          ))}
        </group>
      );

    case "long":
      return (
        <group>
          <HairCap headR={headR} hairMat={hairMat} coverage={0.56} />
          {/* Flowing back hair - multiple layered strands */}
          {[0, 1, 2].map((layer) => (
            <group key={layer}>
              {[-1, -0.5, 0, 0.5, 1].map((s) => (
                <HairStrand
                  key={s}
                  position={[s * 0.1, 1.4 - layer * 0.1, -0.12 - layer * 0.02]}
                  length={0.14 + layer * 0.04}
                  radius={0.035 - layer * 0.005}
                  rotation={[0.1 + layer * 0.05, s * 0.05, 0]}
                  material={hairMat}
                />
              ))}
            </group>
          ))}
          {/* Side hair flowing down */}
          {[-1, 1].map((s) => (
            <group key={`side${s}`}>
              <HairStrand position={[s * 0.2, 1.52, 0.04]} length={0.14} radius={0.032} rotation={[0, 0, s * 0.12]} material={hairMat} />
              <HairStrand position={[s * 0.21, 1.4, -0.02]} length={0.16} radius={0.028} rotation={[0.05, 0, s * 0.1]} material={hairMat} />
              <HairStrand position={[s * 0.19, 1.28, -0.04]} length={0.12} radius={0.025} rotation={[0.08, 0, s * 0.08]} material={hairMat} />
            </group>
          ))}
          {/* Front face-framing strands */}
          {[-1, 1].map((s) => (
            <HairStrand key={`front${s}`} position={[s * 0.14, 1.52, 0.12]} length={0.12} radius={0.022} rotation={[0.15, 0, s * 0.15]} material={hairMat} />
          ))}
        </group>
      );

    case "curly":
      return (
        <group>
          {/* Base cap */}
          <mesh position={[0, 1.72, -0.02]} material={hairMat}>
            <sphereGeometry args={[headR + 0.02, S, S, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
          </mesh>
          {/* Curls in organized layers */}
          {[0, 1, 2].map((layer) => {
            const count = layer === 0 ? 8 : layer === 1 ? 10 : 6;
            const r = headR + 0.04 + layer * 0.025;
            const baseY = 1.72 - layer * 0.08;
            return [...Array(count)].map((_, i) => {
              const angle = (i / count) * Math.PI * 2 + layer * 0.3;
              const curlSize = 0.032 + layer * 0.005;
              return (
                <group key={`${layer}-${i}`} position={[
                  Math.sin(angle) * r * 0.85,
                  baseY + Math.sin(i * 1.5) * 0.015,
                  Math.cos(angle) * r * 0.65 - 0.02
                ]}>
                  <mesh material={hairMat}>
                    <sphereGeometry args={[curlSize, 12, 12]} />
                  </mesh>
                  {/* Inner curl highlight */}
                  <mesh position={[0.005, 0.005, 0.01]}>
                    <sphereGeometry args={[curlSize * 0.5, 8, 8]} />
                    <meshStandardMaterial color={hairMat.color} roughness={0.5} metalness={0.15} />
                  </mesh>
                </group>
              );
            });
          })}
        </group>
      );

    case "wavy":
      return (
        <group>
          <HairCap headR={headR} hairMat={hairMat} coverage={0.55} />
          {/* Wavy strands flowing back and sides */}
          {[-1.5, -1, -0.5, 0, 0.5, 1, 1.5].map((s) => {
            const xOffset = s * 0.07;
            return (
              <group key={s}>
                <HairStrand position={[xOffset, 1.52, -0.1]} length={0.12} radius={0.028} rotation={[0.1, s * 0.08, Math.sin(s) * 0.1]} material={hairMat} />
                <HairStrand position={[xOffset * 1.1, 1.4, -0.13]} length={0.1} radius={0.025} rotation={[0.15, s * 0.05, Math.sin(s + 1) * 0.12]} material={hairMat} />
                <HairStrand position={[xOffset * 1.05, 1.3, -0.14]} length={0.08} radius={0.022} rotation={[0.18, s * 0.03, Math.sin(s + 2) * 0.1]} material={hairMat} />
              </group>
            );
          })}
          {/* Side waves */}
          {[-1, 1].map((s) => (
            <group key={`sw${s}`}>
              <HairStrand position={[s * 0.2, 1.5, 0.03]} length={0.12} radius={0.03} rotation={[0, 0, s * 0.2]} material={hairMat} />
              <HairStrand position={[s * 0.22, 1.38, -0.01]} length={0.1} radius={0.025} rotation={[0.1, 0, s * 0.15]} material={hairMat} />
            </group>
          ))}
        </group>
      );

    case "mohawk":
      return (
        <group>
          {/* Shaved sides - subtle stubble */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.15, 1.64, -0.02]} material={hairMat}>
              <sphereGeometry args={[0.06, 12, 12]} />
            </mesh>
          ))}
          {/* Mohawk ridge - tapered spikes */}
          {[0, 1, 2, 3, 4, 5, 6].map((i) => {
            const t = i / 6;
            const height = 0.06 + Math.sin(t * Math.PI) * 0.04;
            const width = 0.03 + Math.sin(t * Math.PI) * 0.015;
            return (
              <mesh key={i} position={[0, 1.76 + i * 0.02, -0.06 + i * 0.015]} material={hairMat} rotation={[0.3 - t * 0.15, 0, 0]}>
                <capsuleGeometry args={[width, height, 8, 16]} />
              </mesh>
            );
          })}
        </group>
      );

    case "ponytail":
      return (
        <group>
          <HairCap headR={headR} hairMat={hairMat} coverage={0.5} />
          {/* Hair band */}
          <mesh position={[0, 1.64, -0.2]}>
            <torusGeometry args={[0.04, 0.008, 8, 16]} />
            <meshStandardMaterial color="#333333" roughness={0.3} />
          </mesh>
          {/* Ponytail sections */}
          <HairStrand position={[0, 1.55, -0.24]} length={0.12} radius={0.045} rotation={[0.2, 0, 0]} material={hairMat} />
          <HairStrand position={[0, 1.42, -0.27]} length={0.1} radius={0.04} rotation={[0.25, 0, 0]} material={hairMat} />
          <HairStrand position={[0, 1.32, -0.28]} length={0.08} radius={0.035} rotation={[0.3, 0, 0]} material={hairMat} />
          {/* Tip */}
          <mesh position={[0, 1.24, -0.28]} material={hairMat}>
            <sphereGeometry args={[0.03, 12, 12]} />
          </mesh>
          {/* Loose side strands */}
          {[-1, 1].map((s) => (
            <HairStrand key={s} position={[s * 0.13, 1.56, 0.1]} length={0.06} radius={0.015} rotation={[0.2, 0, s * 0.2]} material={hairMat} />
          ))}
        </group>
      );

    case "bun":
      return (
        <group>
          <HairCap headR={headR} hairMat={hairMat} coverage={0.5} />
          {/* Bun base */}
          <mesh position={[0, 1.82, -0.06]} material={hairMat}>
            <sphereGeometry args={[0.08, S, S]} />
          </mesh>
          {/* Bun wrapping detail */}
          <mesh position={[0, 1.82, -0.06]} rotation={[0.5, 0, 0]}>
            <torusGeometry args={[0.055, 0.018, 8, 20]} />
            <meshStandardMaterial color={hairMat.color} roughness={0.6} metalness={0.1} />
          </mesh>
          <mesh position={[0, 1.82, -0.06]} rotation={[0, 0, 0.8]}>
            <torusGeometry args={[0.055, 0.015, 8, 20]} />
            <meshStandardMaterial color={hairMat.color} roughness={0.65} />
          </mesh>
          {/* Hair band */}
          <mesh position={[0, 1.78, -0.06]}>
            <torusGeometry args={[0.05, 0.008, 8, 16]} />
            <meshStandardMaterial color="#333333" roughness={0.3} />
          </mesh>
          {/* Wispy side strands */}
          {[-1, 1].map((s) => (
            <HairStrand key={s} position={[s * 0.14, 1.56, 0.1]} length={0.05} radius={0.012} rotation={[0.15, 0, s * 0.25]} material={hairMat} />
          ))}
        </group>
      );

    case "braids":
      return (
        <group>
          <HairCap headR={headR} hairMat={hairMat} coverage={0.52} />
          {/* Two braids */}
          {[-1, 1].map((s) => (
            <group key={s}>
              {/* Braid segments - alternating slight offsets for woven look */}
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <mesh key={i} position={[
                  s * 0.16 + Math.sin(i * Math.PI) * 0.01,
                  1.52 - i * 0.045,
                  -0.08 + Math.cos(i * Math.PI) * 0.005
                ]} material={hairMat} rotation={[0.05, 0, s * 0.08]}>
                  <sphereGeometry args={[0.025, 10, 10]} />
                </mesh>
              ))}
              {/* Braid ties */}
              <mesh position={[s * 0.16, 1.2, -0.08]}>
                <sphereGeometry args={[0.015, 8, 8]} />
                <meshStandardMaterial color="#ff6b6b" roughness={0.3} />
              </mesh>
            </group>
          ))}
        </group>
      );

    case "slickback":
      return (
        <group>
          {/* Tight, sleek hair pulled back */}
          <mesh position={[0, 1.72, -0.02]} material={hairMat}>
            <sphereGeometry args={[headR + 0.018, S, S, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
          </mesh>
          {/* Slicked top - flat, shiny */}
          <mesh position={[0, 1.74, 0.02]}>
            <sphereGeometry args={[headR * 0.65, S, S, 0, Math.PI * 2, 0, Math.PI * 0.3]} />
            <meshStandardMaterial color={hairMat.color} roughness={0.2} metalness={0.2} />
          </mesh>
          {/* Back volume where hair collects */}
          <mesh position={[0, 1.56, -0.18]} material={hairMat}>
            <capsuleGeometry args={[0.08, 0.06, 8, S]} />
          </mesh>
          <mesh position={[0, 1.48, -0.16]} material={hairMat}>
            <capsuleGeometry args={[0.07, 0.04, 8, 16]} />
          </mesh>
        </group>
      );

    case "afro":
      return (
        <group>
          {/* Large spherical volume */}
          <mesh position={[0, 1.72, 0]} material={hairMat}>
            <sphereGeometry args={[headR + 0.1, S, S]} />
          </mesh>
          {/* Extra volume on top */}
          <mesh position={[0, 1.82, 0]} material={hairMat}>
            <sphereGeometry args={[headR * 0.7, S, S]} />
          </mesh>
          {/* Texture bumps for realistic afro texture */}
          {[...Array(24)].map((_, i) => {
            const phi = Math.acos(1 - 2 * (i + 0.5) / 24);
            const theta = Math.PI * (1 + Math.sqrt(5)) * i;
            const r = headR + 0.1;
            return (
              <mesh key={i} position={[
                r * Math.sin(phi) * Math.cos(theta) * 0.85,
                1.72 + r * Math.cos(phi) * 0.7,
                r * Math.sin(phi) * Math.sin(theta) * 0.85
              ]} material={hairMat}>
                <sphereGeometry args={[0.03, 8, 8]} />
              </mesh>
            );
          })}
        </group>
      );

    case "undercut":
      return (
        <group>
          {/* Shaved sides */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.16, 1.62, -0.03]} material={hairMat}>
              <sphereGeometry args={[0.05, 12, 12]} />
            </mesh>
          ))}
          {/* Long top swept to one side */}
          <mesh position={[0, 1.74, 0]} material={hairMat}>
            <sphereGeometry args={[headR + 0.03, S, S, 0, Math.PI * 2, 0, Math.PI * 0.4]} />
          </mesh>
          <mesh position={[-0.08, 1.74, 0.04]} material={hairMat} rotation={[0, 0, 0.3]}>
            <capsuleGeometry args={[0.04, 0.08, 8, 16]} />
          </mesh>
          <mesh position={[-0.14, 1.7, 0.06]} material={hairMat} rotation={[0.1, 0, 0.5]}>
            <capsuleGeometry args={[0.03, 0.06, 6, 12]} />
          </mesh>
          {/* Volume on top */}
          <mesh position={[0.02, 1.78, 0.02]} material={hairMat}>
            <sphereGeometry args={[0.06, S, S]} />
          </mesh>
        </group>
      );

    default:
      return null;
  }
}

const Avatar3D = ({ config, equipped = {}, size = 200 }: Avatar3DProps) => {
  return (
    <div style={{ width: size, height: size }}>
      <Canvas camera={{ position: [0, 1.15, 2.6], fov: 36 }} shadows>
        <ambientLight intensity={0.5} />
        <directionalLight position={[3, 4, 3]} intensity={1.0} castShadow />
        <directionalLight position={[-2, 2, -1]} intensity={0.25} />
        <hemisphereLight args={["#c8e0ff", "#ffe8c8", 0.35]} />
        <pointLight position={[0, 1.6, 1.5]} intensity={0.15} color="#ffffff" />
        <AvatarCharacter config={config} equipped={equipped} />
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          minPolarAngle={Math.PI / 3}
          maxPolarAngle={Math.PI / 2.2}
          target={[0, 1.05, 0]}
        />
      </Canvas>
    </div>
  );
};

export default Avatar3D;
