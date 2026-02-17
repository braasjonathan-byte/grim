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
  shoes?: { style_data: { color: string; type?: string } };
  pants?: { style_data: { color: string; type?: string } };
  shirt?: { style_data: { color: string; type?: string } };
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

const S = 48;

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
      <mesh material={material}>
        <boxGeometry args={[0.05, 0.04, 0.03]} />
      </mesh>
      <Finger position={[side * 0.03, -0.01, 0.01]} rotation={[0, 0, side * 0.6]} material={material} length={0.04} radius={0.011} />
      <Finger position={[-0.015 * side, -0.04, 0.008]} rotation={[0, 0, 0]} material={material} length={0.045} />
      <Finger position={[-0.005 * side, -0.04, 0]} rotation={[0, 0, 0]} material={material} length={0.05} />
      <Finger position={[0.005 * side, -0.04, -0.008]} rotation={[0, 0, 0]} material={material} length={0.045} />
      <Finger position={[0.015 * side, -0.04, -0.015]} rotation={[0, 0, 0]} material={material} length={0.035} radius={0.01} />
    </group>
  );
}

/* ─── Hat Styles ─── */
function HatStyle({ type, headR, hatMat }: { type: string; headR: number; hatMat: THREE.MeshStandardMaterial }) {
  const darkBandMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#222222", roughness: 0.4 }), []);

  switch (type) {
    case "cap":
    case "snapback":
      return (
        <group>
          {/* Fitted cap crown - follows head shape */}
          <mesh position={[0, 1.73, -0.01]} material={hatMat}>
            <sphereGeometry args={[headR + 0.03, S, S, 0, Math.PI * 2, 0, Math.PI * 0.45]} />
          </mesh>
          {/* Structured front panel - slightly raised */}
          <mesh position={[0, 1.74, 0.04]} material={hatMat}>
            <sphereGeometry args={[headR + 0.035, S, S, 0, Math.PI * 2, 0, Math.PI * 0.35]} />
          </mesh>
          {/* Curved brim - extending forward */}
          <mesh position={[0, 1.71, 0.12]} material={hatMat} rotation={[0.25, 0, 0]}>
            <boxGeometry args={[0.22, 0.012, 0.12]} />
          </mesh>
          {/* Brim curvature - rounded front edge */}
          <mesh position={[0, 1.7, 0.18]} material={hatMat} rotation={[0.3, 0, 0]}>
            <cylinderGeometry args={[0.11, 0.11, 0.012, S, 1, false, -Math.PI * 0.5, Math.PI]} />
          </mesh>
          {/* Button on top */}
          <mesh position={[0, 1.76 + headR * 0.13, -0.01]} material={hatMat}>
            <sphereGeometry args={[0.015, 12, 12]} />
          </mesh>
        </group>
      );

    case "beanie":
      return (
        <group>
          {/* Snug beanie that hugs the head */}
          <mesh position={[0, 1.72, -0.01]} material={hatMat}>
            <sphereGeometry args={[headR + 0.025, S, S, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
          </mesh>
          {/* Folded brim band */}
          <mesh position={[0, 1.68, 0]} material={hatMat}>
            <cylinderGeometry args={[headR + 0.028, headR + 0.03, 0.04, S]} />
          </mesh>
          {/* Ribbed texture lines on brim */}
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[0, 1.665 + i * 0.012, 0]}>
              <torusGeometry args={[headR + 0.03, 0.003, 6, S]} />
              <meshStandardMaterial color={hatMat.color} roughness={0.8} />
            </mesh>
          ))}
          {/* Slight slouch at top */}
          <mesh position={[0, 1.78, -0.02]} material={hatMat}>
            <sphereGeometry args={[0.06, S, S]} />
          </mesh>
        </group>
      );

    case "headband":
      return (
        <group>
          {/* Thin elastic headband */}
          <mesh position={[0, 1.72, 0]} material={hatMat}>
            <torusGeometry args={[headR + 0.015, 0.018, 12, S]} />
          </mesh>
        </group>
      );

    case "crown":
      return (
        <group>
          {/* Crown base band */}
          <mesh position={[0, 1.73, 0]} material={hatMat}>
            <cylinderGeometry args={[headR + 0.02, headR + 0.025, 0.04, S]} />
          </mesh>
          {/* Crown points */}
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
            const angle = (i / 8) * Math.PI * 2;
            return (
              <mesh key={i} position={[
                Math.sin(angle) * (headR + 0.02),
                1.78,
                Math.cos(angle) * (headR + 0.02)
              ]} material={hatMat}>
                <coneGeometry args={[0.02, 0.05, 6]} />
              </mesh>
            );
          })}
          {/* Gem accents on alternating points */}
          {[0, 2, 4, 6].map((i) => {
            const angle = (i / 8) * Math.PI * 2;
            return (
              <mesh key={`gem${i}`} position={[
                Math.sin(angle) * (headR + 0.025),
                1.755,
                Math.cos(angle) * (headR + 0.025)
              ]}>
                <sphereGeometry args={[0.01, 8, 8]} />
                <meshStandardMaterial color="#FF0000" roughness={0.1} metalness={0.8} />
              </mesh>
            );
          })}
        </group>
      );

    case "bucket_hat":
      return (
        <group>
          {/* Rounded crown */}
          <mesh position={[0, 1.74, -0.01]} material={hatMat}>
            <sphereGeometry args={[headR + 0.03, S, S, 0, Math.PI * 2, 0, Math.PI * 0.45]} />
          </mesh>
          {/* Wide downward-angled brim all around */}
          <mesh position={[0, 1.7, 0]} material={hatMat} rotation={[0.05, 0, 0]}>
            <cylinderGeometry args={[headR + 0.03, headR + 0.12, 0.015, S]} />
          </mesh>
        </group>
      );

    default:
      // Fallback generic hat
      return (
        <group>
          <mesh position={[0, 1.73, -0.01]} material={hatMat}>
            <sphereGeometry args={[headR + 0.03, S, S, 0, Math.PI * 2, 0, Math.PI * 0.45]} />
          </mesh>
          <mesh position={[0, 1.71, 0.02]} material={hatMat} rotation={[0.1, 0, 0]}>
            <cylinderGeometry args={[0.25, 0.25, 0.015, S]} />
          </mesh>
        </group>
      );
  }
}

/* ─── Hair cap base ─── */
function HairCap({ headR, hairMat, coverage = 0.52 }: { headR: number; hairMat: THREE.MeshStandardMaterial; coverage?: number }) {
  return (
    <group>
      <mesh position={[0, 1.64, 0]} material={hairMat}>
        <sphereGeometry args={[headR + 0.02, S, S, 0, Math.PI * 2, 0, Math.PI * coverage]} />
      </mesh>
      {/* Side volume flush with head */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (headR * 0.6), 1.62, -0.03]} material={hairMat}>
          <sphereGeometry args={[0.06, S, S]} />
        </mesh>
      ))}
      {/* Back volume */}
      <mesh position={[0, 1.58, -(headR * 0.65)]} material={hairMat}>
        <sphereGeometry args={[0.08, S, S]} />
      </mesh>
    </group>
  );
}

/* ─── Hair strand helper ─── */
function HairStrand({ position, length, radius, rotation, material }: any) {
  return (
    <mesh position={position} rotation={rotation || [0, 0, 0]} material={material}>
      <capsuleGeometry args={[radius, length, 6, 16]} />
    </mesh>
  );
}

/* ─── Hair Styles ─── */
function HairStyle({ style, headR, hairMat }: { style: string; headR: number; hairMat: THREE.MeshStandardMaterial }) {
  // Center Y of head is 1.62, top ~1.84
  const headY = 1.62;
  const topY = headY + headR;
  
  switch (style) {
    case "buzz":
      return (
        <mesh position={[0, headY + 0.04, -0.01]} material={hairMat}>
          <sphereGeometry args={[headR + 0.008, S, S, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
        </mesh>
      );

    case "short":
      return (
        <group>
          {/* Tight cap */}
          <mesh position={[0, headY + 0.04, 0]} material={hairMat}>
            <sphereGeometry args={[headR + 0.02, S, S, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
          </mesh>
          {/* Slight volume on top */}
          <mesh position={[0, topY - 0.02, 0.02]} material={hairMat}>
            <sphereGeometry args={[0.08, S, S]} />
          </mesh>
          {/* Side taper */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.17, headY, -0.02]} material={hairMat}>
              <sphereGeometry args={[0.04, 16, 16]} />
            </mesh>
          ))}
        </group>
      );

    case "medium":
      return (
        <group>
          <HairCap headR={headR} hairMat={hairMat} coverage={0.55} />
          {/* Back hair draping to neck */}
          <mesh position={[0, 1.46, -0.12]} material={hairMat}>
            <capsuleGeometry args={[0.1, 0.12, 12, S]} />
          </mesh>
          {/* Side strands over ears */}
          {[-1, 1].map((s) => (
            <group key={s}>
              <HairStrand position={[s * 0.18, 1.55, 0.02]} length={0.08} radius={0.03} rotation={[0, 0, s * 0.12]} material={hairMat} />
              <HairStrand position={[s * 0.19, 1.47, -0.04]} length={0.07} radius={0.025} rotation={[0, 0, s * 0.08]} material={hairMat} />
            </group>
          ))}
        </group>
      );

    case "long":
      return (
        <group>
          <HairCap headR={headR} hairMat={hairMat} coverage={0.55} />
          {/* Flowing back layers */}
          {[0, 1, 2].map((layer) => (
            <group key={layer}>
              {[-1, -0.5, 0, 0.5, 1].map((s) => (
                <HairStrand
                  key={s}
                  position={[s * 0.09, 1.38 - layer * 0.09, -0.11 - layer * 0.02]}
                  length={0.12 + layer * 0.04}
                  radius={0.03 - layer * 0.004}
                  rotation={[0.1 + layer * 0.05, s * 0.04, 0]}
                  material={hairMat}
                />
              ))}
            </group>
          ))}
          {/* Side hair flowing down */}
          {[-1, 1].map((s) => (
            <group key={`side${s}`}>
              <HairStrand position={[s * 0.2, 1.5, 0.04]} length={0.12} radius={0.028} rotation={[0, 0, s * 0.1]} material={hairMat} />
              <HairStrand position={[s * 0.21, 1.38, -0.02]} length={0.14} radius={0.024} rotation={[0.05, 0, s * 0.08]} material={hairMat} />
              <HairStrand position={[s * 0.19, 1.26, -0.04]} length={0.1} radius={0.02} rotation={[0.08, 0, s * 0.06]} material={hairMat} />
            </group>
          ))}
          {/* Face-framing strands */}
          {[-1, 1].map((s) => (
            <HairStrand key={`fr${s}`} position={[s * 0.14, 1.52, 0.12]} length={0.1} radius={0.018} rotation={[0.15, 0, s * 0.12]} material={hairMat} />
          ))}
        </group>
      );

    case "curly":
      return (
        <group>
          {/* Base cap tight to head */}
          <mesh position={[0, headY + 0.04, -0.01]} material={hairMat}>
            <sphereGeometry args={[headR + 0.015, S, S, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
          </mesh>
          {/* Curls arranged around head surface */}
          {[0, 1, 2].map((layer) => {
            const count = layer === 0 ? 8 : layer === 1 ? 10 : 7;
            const r = headR + 0.035 + layer * 0.02;
            const baseY = headY + 0.06 - layer * 0.07;
            return [...Array(count)].map((_, i) => {
              const angle = (i / count) * Math.PI * 2 + layer * 0.3;
              const curlSize = 0.028 + layer * 0.004;
              // Only show curls on top half
              const cosA = Math.cos(angle);
              if (layer > 0 && cosA > 0.5) return null;
              return (
                <mesh key={`${layer}-${i}`} position={[
                  Math.sin(angle) * r * 0.85,
                  baseY + Math.sin(i * 1.5) * 0.012,
                  Math.cos(angle) * r * 0.65 - 0.02
                ]} material={hairMat}>
                  <sphereGeometry args={[curlSize, 10, 10]} />
                </mesh>
              );
            });
          })}
        </group>
      );

    case "wavy":
      return (
        <group>
          <HairCap headR={headR} hairMat={hairMat} coverage={0.54} />
          {[-1.5, -1, -0.5, 0, 0.5, 1, 1.5].map((s) => {
            const xOffset = s * 0.065;
            return (
              <group key={s}>
                <HairStrand position={[xOffset, 1.5, -0.1]} length={0.1} radius={0.024} rotation={[0.1, s * 0.06, Math.sin(s) * 0.08]} material={hairMat} />
                <HairStrand position={[xOffset * 1.1, 1.4, -0.12]} length={0.08} radius={0.02} rotation={[0.15, s * 0.04, Math.sin(s + 1) * 0.1]} material={hairMat} />
              </group>
            );
          })}
          {[-1, 1].map((s) => (
            <HairStrand key={`sw${s}`} position={[s * 0.19, 1.5, 0.03]} length={0.1} radius={0.025} rotation={[0, 0, s * 0.15]} material={hairMat} />
          ))}
        </group>
      );

    case "mohawk":
      return (
        <group>
          {/* Shaved sides - very thin */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.16, headY, -0.02]} material={hairMat}>
              <sphereGeometry args={[0.035, 10, 10]} />
            </mesh>
          ))}
          {/* Central ridge */}
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const t = i / 5;
            const height = 0.05 + Math.sin(t * Math.PI) * 0.035;
            const width = 0.025 + Math.sin(t * Math.PI) * 0.012;
            return (
              <mesh key={i} position={[0, topY - 0.02 + i * 0.005, -0.12 * t + 0.02]} material={hairMat} rotation={[0.2 - t * 0.1, 0, 0]}>
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
          <mesh position={[0, 1.58, -0.18]}>
            <torusGeometry args={[0.035, 0.007, 8, 16]} />
            <meshStandardMaterial color="#333333" roughness={0.3} />
          </mesh>
          {/* Ponytail hanging down */}
          <HairStrand position={[0, 1.5, -0.22]} length={0.1} radius={0.04} rotation={[0.2, 0, 0]} material={hairMat} />
          <HairStrand position={[0, 1.38, -0.25]} length={0.1} radius={0.035} rotation={[0.25, 0, 0]} material={hairMat} />
          <HairStrand position={[0, 1.28, -0.26]} length={0.07} radius={0.028} rotation={[0.3, 0, 0]} material={hairMat} />
          <mesh position={[0, 1.22, -0.26]} material={hairMat}>
            <sphereGeometry args={[0.025, 10, 10]} />
          </mesh>
        </group>
      );

    case "bun":
      return (
        <group>
          <HairCap headR={headR} hairMat={hairMat} coverage={0.5} />
          {/* Bun on top-back */}
          <mesh position={[0, topY + 0.02, -0.06]} material={hairMat}>
            <sphereGeometry args={[0.07, S, S]} />
          </mesh>
          {/* Wrapping detail */}
          <mesh position={[0, topY + 0.02, -0.06]} rotation={[0.5, 0, 0]}>
            <torusGeometry args={[0.05, 0.015, 8, 20]} />
            <meshStandardMaterial color={hairMat.color} roughness={0.6} metalness={0.1} />
          </mesh>
          {/* Hair band */}
          <mesh position={[0, topY - 0.02, -0.06]}>
            <torusGeometry args={[0.04, 0.007, 8, 16]} />
            <meshStandardMaterial color="#333333" roughness={0.3} />
          </mesh>
        </group>
      );

    case "braids":
      return (
        <group>
          <HairCap headR={headR} hairMat={hairMat} coverage={0.52} />
          {[-1, 1].map((s) => (
            <group key={s}>
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <mesh key={i} position={[
                  s * 0.15 + Math.sin(i * Math.PI) * 0.008,
                  1.5 - i * 0.04,
                  -0.07 + Math.cos(i * Math.PI) * 0.004
                ]} material={hairMat} rotation={[0.04, 0, s * 0.06]}>
                  <sphereGeometry args={[0.022, 10, 10]} />
                </mesh>
              ))}
              <mesh position={[s * 0.15, 1.2, -0.07]}>
                <sphereGeometry args={[0.012, 8, 8]} />
                <meshStandardMaterial color="#ff6b6b" roughness={0.3} />
              </mesh>
            </group>
          ))}
        </group>
      );

    case "slickback": {
      const slickMat = new THREE.MeshStandardMaterial({ color: hairMat.color, roughness: 0.2, metalness: 0.2 });
      return (
        <group>
          <mesh position={[0, headY + 0.04, -0.01]} material={hairMat}>
            <sphereGeometry args={[headR + 0.015, S, S, 0, Math.PI * 2, 0, Math.PI * 0.48]} />
          </mesh>
          {/* Shiny slicked top */}
          <mesh position={[0, topY - 0.06, 0.02]} material={slickMat}>
            <sphereGeometry args={[headR * 0.6, S, S, 0, Math.PI * 2, 0, Math.PI * 0.3]} />
          </mesh>
          {/* Back collection */}
          <mesh position={[0, 1.52, -0.16]} material={hairMat}>
            <capsuleGeometry args={[0.07, 0.05, 8, S]} />
          </mesh>
        </group>
      );
    }

    case "afro":
      return (
        <group>
          {/* Large spherical volume centered on head */}
          <mesh position={[0, headY + 0.06, 0]} material={hairMat}>
            <sphereGeometry args={[headR + 0.09, S, S]} />
          </mesh>
          {/* Extra top volume */}
          <mesh position={[0, topY + 0.04, 0]} material={hairMat}>
            <sphereGeometry args={[headR * 0.6, S, S]} />
          </mesh>
          {/* Texture bumps */}
          {[...Array(20)].map((_, i) => {
            const phi = Math.acos(1 - 2 * (i + 0.5) / 20);
            const theta = Math.PI * (1 + Math.sqrt(5)) * i;
            const r = headR + 0.09;
            const y = r * Math.cos(phi) * 0.65;
            if (y < -0.05) return null;
            return (
              <mesh key={i} position={[
                r * Math.sin(phi) * Math.cos(theta) * 0.8,
                headY + 0.06 + y,
                r * Math.sin(phi) * Math.sin(theta) * 0.8
              ]} material={hairMat}>
                <sphereGeometry args={[0.025, 8, 8]} />
              </mesh>
            );
          })}
        </group>
      );

    case "undercut":
      return (
        <group>
          {/* Shaved sides - very subtle */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.17, headY, -0.03]} material={hairMat}>
              <sphereGeometry args={[0.035, 10, 10]} />
            </mesh>
          ))}
          {/* Long top swept to one side */}
          <mesh position={[0, topY - 0.05, 0]} material={hairMat}>
            <sphereGeometry args={[headR + 0.025, S, S, 0, Math.PI * 2, 0, Math.PI * 0.38]} />
          </mesh>
          <mesh position={[-0.08, topY - 0.06, 0.04]} material={hairMat} rotation={[0, 0, 0.3]}>
            <capsuleGeometry args={[0.035, 0.07, 8, 16]} />
          </mesh>
          <mesh position={[-0.14, topY - 0.1, 0.06]} material={hairMat} rotation={[0.1, 0, 0.5]}>
            <capsuleGeometry args={[0.025, 0.05, 6, 12]} />
          </mesh>
        </group>
      );

    default:
      return null;
  }
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

  const shirtType = equipped?.shirt?.style_data?.type || "tshirt";
  const pantsType = equipped?.pants?.style_data?.type || "pants";
  const hatType = equipped?.hat?.style_data?.type || "cap";

  // Determine if arms should show skin (sleeveless garments)
  const isSleeveless = shirtType === "tank_top" || shirtType === "sports_bra" || shirtType === "crop_top";
  // Determine if torso is cropped (sports bra / crop top)
  const isCropped = shirtType === "sports_bra" || shirtType === "crop_top";
  // Determine if pants are shorts
  const isShorts = pantsType === "shorts";

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

    groupRef.current.scale.y = h * (1 + Math.sin(time * 1.8) * 0.005);
    groupRef.current.rotation.y = Math.sin(time * 0.4) * 0.02;

    if (leftArmRef.current && !isWavingRef.current) {
      leftArmRef.current.rotation.z = Math.sin(time * 0.8) * 0.04;
      leftArmRef.current.rotation.x = Math.sin(time * 0.6 + 1) * 0.03;
    }
    if (rightArmRef.current && !isWavingRef.current) {
      rightArmRef.current.rotation.z = Math.sin(time * 0.8 + Math.PI) * 0.04;
      rightArmRef.current.rotation.x = Math.sin(time * 0.6 + Math.PI + 1) * 0.03;
    }

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

  // Upper arm material: skin if sleeveless, shirt if not
  const upperArmMat = isSleeveless ? skinMat : shirtMat;
  // Lower torso material: skin if cropped, shirt if not
  const lowerTorsoMat = isCropped ? skinMat : shirtMat;

  return (
    <group ref={groupRef} scale={[1, h, 1]}>

      {/* ══════ HEAD ══════ */}
      <mesh position={[0, 1.62, 0]} material={skinMat}>
        <sphereGeometry args={[headR, S, S]} />
      </mesh>
      <mesh position={[0, 1.5, 0.04]} material={skinMat}>
        <sphereGeometry args={[headR * 0.7, S, S]} />
      </mesh>

      {/* Ears */}
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

      {/* Eyes */}
      {[-1, 1].map((side) => (
        <group key={`eye${side}`} position={[side * 0.075, 1.64, 0.17]}>
          <mesh material={eyeWhiteMat}>
            <sphereGeometry args={[0.033, S, S]} />
          </mesh>
          <mesh position={[0, 0, 0.02]} material={irisMat}>
            <sphereGeometry args={[0.018, 16, 16]} />
          </mesh>
          <mesh position={[0, 0, 0.028]} material={pupilMat}>
            <sphereGeometry args={[0.009, 12, 12]} />
          </mesh>
          <mesh position={[side * 0.008, 0.008, 0.032]}>
            <sphereGeometry args={[0.005, 8, 8]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.8} />
          </mesh>
          <mesh position={[0, 0.02, 0.01]} material={skinMat} rotation={[0.3, 0, 0]}>
            <sphereGeometry args={[0.035, S, S, 0, Math.PI * 2, 0, Math.PI * 0.35]} />
          </mesh>
        </group>
      ))}

      {/* Eyebrows */}
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

      {/* Nose */}
      <mesh position={[0, 1.58, 0.2]} material={skinMat} rotation={[0.3, 0, 0]}>
        <capsuleGeometry args={[0.015, 0.04, 8, 16]} />
      </mesh>
      <mesh position={[0, 1.545, 0.22]} material={skinMat}>
        <sphereGeometry args={[0.025, S, S]} />
      </mesh>
      <mesh position={[-0.015, 1.535, 0.215]} material={skinMatDarker}>
        <sphereGeometry args={[0.01, 8, 8]} />
      </mesh>
      <mesh position={[0.015, 1.535, 0.215]} material={skinMatDarker}>
        <sphereGeometry args={[0.01, 8, 8]} />
      </mesh>

      {/* Mouth */}
      <group position={[0, 1.49, 0.18]}>
        <mesh rotation={[0.15, 0, 0]}>
          <torusGeometry args={[0.035, 0.007, 8, 20, Math.PI]} />
          <meshStandardMaterial color="#c06060" roughness={0.4} />
        </mesh>
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
      {equipped?.hat && <HatStyle type={hatType} headR={headR} hatMat={hatMat} />}

      {/* ══════ NECK ══════ */}
      <mesh position={[0, 1.4, 0]} material={skinMat}>
        <capsuleGeometry args={[0.055, 0.08, 12, S]} />
      </mesh>
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
      {/* Shoulders - always visible with shirt material */}
      {[-1, 1].map((side) => (
        <mesh key={`shoulder${side}`} position={[side * shoulderW * 0.5, 1.28, 0]} material={isSleeveless ? skinMat : shirtMat}>
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
      {/* Lower torso / waist - skin if cropped */}
      <mesh position={[0, 1.02, 0]} material={lowerTorsoMat}>
        <capsuleGeometry args={[waistW * 0.5, 0.06, 12, S]} />
      </mesh>

      {/* Hoodie hood */}
      {shirtType === "hoodie" && (
        <group>
          {/* Hood draped behind head/neck */}
          <mesh position={[0, 1.52, -0.14]} material={shirtMat}>
            <sphereGeometry args={[0.12, S, S, 0, Math.PI * 2, Math.PI * 0.3, Math.PI * 0.5]} />
          </mesh>
          {/* Hood fabric sides */}
          {[-1, 1].map((s) => (
            <mesh key={`hood${s}`} position={[s * 0.08, 1.46, -0.12]} material={shirtMat}>
              <sphereGeometry args={[0.06, 12, 12]} />
            </mesh>
          ))}
          {/* Hood collar around neck */}
          <mesh position={[0, 1.38, -0.04]} material={shirtMat} rotation={[0.3, 0, 0]}>
            <torusGeometry args={[0.08, 0.025, 8, S]} />
          </mesh>
        </group>
      )}

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

      {/* Pectoral for male */}
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
        {/* Bicep - skin if sleeveless */}
        <mesh position={[0, -0.08, 0]} material={upperArmMat}>
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
        <Hand position={[0, -0.39, 0]} material={skinMat} side={-1} />
      </group>

      {/* Right arm (waves) */}
      <group ref={rightArmRef} position={[shoulderW * 0.5 + armR * 1.2, 1.28, 0]}>
        <mesh position={[0, -0.08, 0]} material={upperArmMat}>
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
      <mesh position={[0, 0.9, 0]} material={pantsMat}>
        <capsuleGeometry args={[hipW * 0.48, 0.06, 12, S]} />
      </mesh>
      <mesh position={[0, 0.87, -0.04]} material={pantsMat}>
        <sphereGeometry args={[hipW * 0.38, S, S]} />
      </mesh>

      {/* Legs */}
      {[-1, 1].map((side) => (
        <group key={`leg${side}`} position={[side * legSpacing, 0, 0]}>
          {/* Upper thigh - always pants */}
          <mesh position={[0, 0.76, 0]} material={pantsMat}>
            <capsuleGeometry args={[thighR, 0.12, 8, S]} />
          </mesh>
          {/* Knee - skin if shorts, pants if not */}
          <mesh position={[0, 0.61, 0.01]} material={isShorts ? skinMat : pantsMat}>
            <sphereGeometry args={[thighR * 0.85, 16, 16]} />
          </mesh>
          {/* Calf - skin if shorts */}
          <mesh position={[0, 0.5, 0]} material={isShorts ? skinMat : pantsMat}>
            <capsuleGeometry args={[calfR, 0.1, 8, S]} />
          </mesh>
          {/* Shin taper - skin if shorts */}
          <mesh position={[0, 0.4, 0.01]} material={isShorts ? skinMat : pantsMat}>
            <capsuleGeometry args={[calfR * 0.75, 0.04, 8, S]} />
          </mesh>

          {/* Shoes */}
          <mesh position={[0, 0.34, 0]} material={shoesMat}>
            <sphereGeometry args={[0.045, S, S]} />
          </mesh>
          <mesh position={[0, 0.31, 0.02]} material={shoesMat}>
            <capsuleGeometry args={[0.045, 0.06, 8, S]} />
          </mesh>
          <mesh position={[0, 0.3, 0.08]} material={shoesMat}>
            <sphereGeometry args={[0.04, S, S]} />
          </mesh>
          <mesh position={[0, 0.275, 0.04]} material={shoesMat} scale={[1, 0.4, 1.3]}>
            <capsuleGeometry args={[0.045, 0.04, 8, 16]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

const Avatar3D = ({ config, equipped = {}, size = 200 }: Avatar3DProps) => {
  const h = HEIGHTS[config.body_height] || 1;
  // Zoom out camera for taller avatars so they stay in frame
  const camZ = 2.6 + (h - 1) * 1.2;
  const camY = 1.15 + (h - 1) * 0.15;

  return (
    <div style={{ width: size, height: size }}>
      <Canvas camera={{ position: [0, camY, camZ], fov: 36 }} shadows>
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
