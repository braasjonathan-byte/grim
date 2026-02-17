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
  mouth_expression?: string;
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

// Head constants - used everywhere for consistent positioning
const HEAD_Y = 1.62;
const HEAD_R = 0.22;
const HEAD_TOP = HEAD_Y + HEAD_R; // ~1.84
const HEAD_SURFACE = HEAD_R + 0.015; // minimum offset to stay outside head

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
  switch (type) {
    case "cap":
    case "snapback":
      return (
        <group>
          <mesh position={[0, HEAD_Y + 0.12, -0.01]} material={hatMat}>
            <sphereGeometry args={[headR + 0.04, S, S, 0, Math.PI * 2, 0, Math.PI * 0.45]} />
          </mesh>
          <mesh position={[0, HEAD_Y + 0.13, 0.04]} material={hatMat}>
            <sphereGeometry args={[headR + 0.045, S, S, 0, Math.PI * 2, 0, Math.PI * 0.35]} />
          </mesh>
          <mesh position={[0, HEAD_Y + 0.09, 0.14]} material={hatMat} rotation={[0.25, 0, 0]}>
            <boxGeometry args={[0.22, 0.012, 0.12]} />
          </mesh>
          <mesh position={[0, HEAD_Y + 0.08, 0.20]} material={hatMat} rotation={[0.3, 0, 0]}>
            <cylinderGeometry args={[0.11, 0.11, 0.012, S, 1, false, -Math.PI * 0.5, Math.PI]} />
          </mesh>
          <mesh position={[0, HEAD_TOP + 0.06, -0.01]} material={hatMat}>
            <sphereGeometry args={[0.015, 12, 12]} />
          </mesh>
        </group>
      );

    case "beanie":
      return (
        <group>
          <mesh position={[0, HEAD_Y + 0.11, -0.01]} material={hatMat}>
            <sphereGeometry args={[headR + 0.035, S, S, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
          </mesh>
          <mesh position={[0, HEAD_Y + 0.06, 0]} material={hatMat}>
            <cylinderGeometry args={[headR + 0.038, headR + 0.04, 0.04, S]} />
          </mesh>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[0, HEAD_Y + 0.045 + i * 0.012, 0]}>
              <torusGeometry args={[headR + 0.04, 0.003, 6, S]} />
              <meshStandardMaterial color={hatMat.color} roughness={0.8} />
            </mesh>
          ))}
          <mesh position={[0, HEAD_TOP + 0.08, -0.02]} material={hatMat}>
            <sphereGeometry args={[0.06, S, S]} />
          </mesh>
        </group>
      );

    case "headband":
      return (
        <mesh position={[0, HEAD_Y + 0.1, 0]} material={hatMat}>
          <torusGeometry args={[headR + 0.025, 0.018, 12, S]} />
        </mesh>
      );

    case "crown":
      return (
        <group>
          <mesh position={[0, HEAD_Y + 0.12, 0]} material={hatMat}>
            <cylinderGeometry args={[headR + 0.03, headR + 0.035, 0.04, S]} />
          </mesh>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
            const angle = (i / 8) * Math.PI * 2;
            return (
              <mesh key={i} position={[
                Math.sin(angle) * (headR + 0.03),
                HEAD_Y + 0.18,
                Math.cos(angle) * (headR + 0.03)
              ]} material={hatMat}>
                <coneGeometry args={[0.02, 0.05, 6]} />
              </mesh>
            );
          })}
          {[0, 2, 4, 6].map((i) => {
            const angle = (i / 8) * Math.PI * 2;
            return (
              <mesh key={`gem${i}`} position={[
                Math.sin(angle) * (headR + 0.035),
                HEAD_Y + 0.155,
                Math.cos(angle) * (headR + 0.035)
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
          <mesh position={[0, HEAD_Y + 0.13, -0.01]} material={hatMat}>
            <sphereGeometry args={[headR + 0.04, S, S, 0, Math.PI * 2, 0, Math.PI * 0.45]} />
          </mesh>
          <mesh position={[0, HEAD_Y + 0.08, 0]} material={hatMat} rotation={[0.05, 0, 0]}>
            <cylinderGeometry args={[headR + 0.04, headR + 0.14, 0.015, S]} />
          </mesh>
        </group>
      );

    default:
      return (
        <group>
          <mesh position={[0, HEAD_Y + 0.12, -0.01]} material={hatMat}>
            <sphereGeometry args={[headR + 0.04, S, S, 0, Math.PI * 2, 0, Math.PI * 0.45]} />
          </mesh>
          <mesh position={[0, HEAD_Y + 0.09, 0.02]} material={hatMat} rotation={[0.1, 0, 0]}>
            <cylinderGeometry args={[0.25, 0.25, 0.015, S]} />
          </mesh>
        </group>
      );
  }
}

/* ─── Hair Styles ─── 
   All hair positioned OUTSIDE the head sphere.
   Head: center=(0, 1.62, 0), radius=0.22
   Surface at top: y ≈ 1.84, sides: x ≈ ±0.22, back: z ≈ -0.22
*/
function HairStyle({ style, headR, hairMat }: { style: string; headR: number; hairMat: THREE.MeshStandardMaterial }) {
  // Helper: position on head surface given spherical coords
  // theta: 0=top, pi/2=equator; phi: 0=front, pi=back
  const onSurface = (theta: number, phi: number, offset: number = 0.02) => {
    const r = headR + offset;
    return [
      r * Math.sin(theta) * Math.sin(phi),
      HEAD_Y + r * Math.cos(theta),
      r * Math.sin(theta) * Math.cos(phi)
    ] as [number, number, number];
  };

  switch (style) {
    case "buzz":
      return (
        <mesh position={[0, HEAD_Y + 0.04, -0.01]} material={hairMat}>
          <sphereGeometry args={[headR + 0.012, S, S, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
        </mesh>
      );

    case "short":
      return (
        <group>
          {/* Main cap sitting on top of head */}
          <mesh position={[0, HEAD_Y + 0.04, 0]} material={hairMat}>
            <sphereGeometry args={[headR + 0.025, S, S, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
          </mesh>
          {/* Volume on top */}
          <mesh position={[0, HEAD_TOP + 0.02, 0.02]} material={hairMat}>
            <sphereGeometry args={[0.08, S, S]} />
          </mesh>
        </group>
      );

    case "medium":
      return (
        <group>
          {/* Full cap covering top and sides */}
          <mesh position={[0, HEAD_Y + 0.04, -0.01]} material={hairMat}>
            <sphereGeometry args={[headR + 0.035, S, S, 0, Math.PI * 2, 0, Math.PI * 0.58]} />
          </mesh>
          {/* Back hair draping to neck - positioned behind head surface */}
          <mesh position={[0, HEAD_Y - 0.12, -(headR + 0.04)]} material={hairMat}>
            <capsuleGeometry args={[0.1, 0.12, 12, S]} />
          </mesh>
          {/* Side volume over ears */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * (headR + 0.03), HEAD_Y - 0.06, -0.02]} material={hairMat}>
              <capsuleGeometry args={[0.03, 0.08, 8, 16]} />
            </mesh>
          ))}
        </group>
      );

    case "long":
      return (
        <group>
          {/* Top cap - only covers top/back half */}
          <mesh position={[0, HEAD_Y + 0.04, -0.02]} material={hairMat}>
            <sphereGeometry args={[headR + 0.035, S, S, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
          </mesh>
          {/* Back layers flowing down - all behind head */}
          {[0, 1, 2].map((layer) => (
            <group key={layer}>
              {[-0.08, -0.04, 0, 0.04, 0.08].map((x) => (
                <mesh
                  key={x}
                  position={[x, HEAD_Y - 0.18 - layer * 0.1, -(headR + 0.03 + layer * 0.015)]}
                  material={hairMat}
                  rotation={[0.1 + layer * 0.05, x * 0.3, 0]}
                >
                  <capsuleGeometry args={[0.028 - layer * 0.004, 0.1 + layer * 0.04, 6, 16]} />
                </mesh>
              ))}
            </group>
          ))}
          {/* Side hair flowing down - pushed far to sides, not covering face */}
          {[-1, 1].map((s) => (
            <group key={`side${s}`}>
              <mesh position={[s * (headR + 0.04), HEAD_Y - 0.06, -0.04]} material={hairMat}>
                <capsuleGeometry args={[0.025, 0.1, 8, 16]} />
              </mesh>
              <mesh position={[s * (headR + 0.035), HEAD_Y - 0.18, -0.06]} material={hairMat}>
                <capsuleGeometry args={[0.022, 0.12, 8, 16]} />
              </mesh>
              <mesh position={[s * (headR + 0.03), HEAD_Y - 0.32, -0.08]} material={hairMat}>
                <capsuleGeometry args={[0.018, 0.08, 6, 12]} />
              </mesh>
            </group>
          ))}
        </group>
      );

    case "curly":
      return (
        <group>
          {/* Base cap - only top/back */}
          <mesh position={[0, HEAD_Y + 0.04, -0.02]} material={hairMat}>
            <sphereGeometry args={[headR + 0.02, S, S, 0, Math.PI * 2, 0, Math.PI * 0.50]} />
          </mesh>
          {/* Curls placed on surface - strong face avoidance */}
          {[0, 1, 2].map((layer) => {
            const count = layer === 0 ? 10 : layer === 1 ? 12 : 8;
            const curlR = headR + 0.04 + layer * 0.025;
            return [...Array(count)].map((_, i) => {
              const theta = 0.15 + layer * 0.25;
              const phi = (i / count) * Math.PI * 2 + layer * 0.3;
              const x = curlR * Math.sin(theta) * Math.sin(phi);
              const y = HEAD_Y + curlR * Math.cos(theta);
              const z = curlR * Math.sin(theta) * Math.cos(phi);
              // Strong face clearance - no curls in front quadrant
              if (z > 0 && Math.abs(x) < headR * 0.8) return null;
              const curlSize = 0.025 + layer * 0.005;
              return (
                <mesh key={`${layer}-${i}`} position={[x, y, z]} material={hairMat}>
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
          {/* Top cap */}
          <mesh position={[0, HEAD_Y + 0.04, -0.01]} material={hairMat}>
            <sphereGeometry args={[headR + 0.035, S, S, 0, Math.PI * 2, 0, Math.PI * 0.56]} />
          </mesh>
          {/* Wavy strands flowing back - positioned outside head */}
          {[-1.5, -1, -0.5, 0, 0.5, 1, 1.5].map((s) => {
            const xOff = s * 0.055;
            return (
              <group key={s}>
                <mesh position={[xOff, HEAD_Y - 0.1, -(headR + 0.03)]} rotation={[0.1, s * 0.06, Math.sin(s) * 0.08]} material={hairMat}>
                  <capsuleGeometry args={[0.024, 0.1, 6, 16]} />
                </mesh>
                <mesh position={[xOff * 1.1, HEAD_Y - 0.2, -(headR + 0.04)]} rotation={[0.15, s * 0.04, Math.sin(s + 1) * 0.1]} material={hairMat}>
                  <capsuleGeometry args={[0.02, 0.08, 6, 12]} />
                </mesh>
              </group>
            );
          })}
          {/* Side strands */}
          {[-1, 1].map((s) => (
            <mesh key={`sw${s}`} position={[s * (headR + 0.03), HEAD_Y - 0.06, 0.03]} rotation={[0, 0, s * 0.15]} material={hairMat}>
              <capsuleGeometry args={[0.025, 0.1, 6, 16]} />
            </mesh>
          ))}
        </group>
      );

    case "mohawk":
      return (
        <group>
          {/* Central ridge - on top of head */}
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const t = i / 5;
            const spikeH = 0.05 + Math.sin(t * Math.PI) * 0.04;
            const spikeW = 0.025 + Math.sin(t * Math.PI) * 0.012;
            // Position along head from front to back, always on top
            const z = 0.08 - t * 0.25;
            const surfaceY = HEAD_Y + Math.sqrt(Math.max(0, headR * headR - z * z));
            return (
              <mesh key={i} position={[0, surfaceY + spikeH * 0.5, z]} material={hairMat}>
                <capsuleGeometry args={[spikeW, spikeH, 8, 16]} />
              </mesh>
            );
          })}
          {/* Subtle shaved sides */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * (headR + 0.005), HEAD_Y, -0.02]} material={hairMat}>
              <sphereGeometry args={[0.03, 10, 10]} />
            </mesh>
          ))}
        </group>
      );

    case "ponytail":
      return (
        <group>
          {/* Cap on top */}
          <mesh position={[0, HEAD_Y + 0.04, -0.01]} material={hairMat}>
            <sphereGeometry args={[headR + 0.03, S, S, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
          </mesh>
          {/* Hair band at back of head */}
          <mesh position={[0, HEAD_Y - 0.02, -(headR + 0.02)]}>
            <torusGeometry args={[0.035, 0.007, 8, 16]} />
            <meshStandardMaterial color="#333333" roughness={0.3} />
          </mesh>
          {/* Ponytail hanging down behind head */}
          <mesh position={[0, HEAD_Y - 0.1, -(headR + 0.06)]} material={hairMat} rotation={[0.2, 0, 0]}>
            <capsuleGeometry args={[0.04, 0.1, 8, S]} />
          </mesh>
          <mesh position={[0, HEAD_Y - 0.22, -(headR + 0.08)]} material={hairMat} rotation={[0.25, 0, 0]}>
            <capsuleGeometry args={[0.035, 0.1, 8, S]} />
          </mesh>
          <mesh position={[0, HEAD_Y - 0.34, -(headR + 0.09)]} material={hairMat} rotation={[0.3, 0, 0]}>
            <capsuleGeometry args={[0.028, 0.07, 6, S]} />
          </mesh>
          <mesh position={[0, HEAD_Y - 0.4, -(headR + 0.09)]} material={hairMat}>
            <sphereGeometry args={[0.025, 10, 10]} />
          </mesh>
        </group>
      );

    case "bun":
      return (
        <group>
          {/* Cap */}
          <mesh position={[0, HEAD_Y + 0.04, -0.01]} material={hairMat}>
            <sphereGeometry args={[headR + 0.03, S, S, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
          </mesh>
          {/* Bun sitting on top-back of head */}
          <mesh position={[0, HEAD_TOP + 0.04, -0.06]} material={hairMat}>
            <sphereGeometry args={[0.07, S, S]} />
          </mesh>
          {/* Wrap detail */}
          <mesh position={[0, HEAD_TOP + 0.04, -0.06]} rotation={[0.5, 0, 0]}>
            <torusGeometry args={[0.05, 0.015, 8, 20]} />
            <meshStandardMaterial color={hairMat.color} roughness={0.6} metalness={0.1} />
          </mesh>
          {/* Hair band */}
          <mesh position={[0, HEAD_TOP, -0.06]}>
            <torusGeometry args={[0.04, 0.007, 8, 16]} />
            <meshStandardMaterial color="#333333" roughness={0.3} />
          </mesh>
        </group>
      );

    case "braids":
      return (
        <group>
          {/* Cap */}
          <mesh position={[0, HEAD_Y + 0.04, -0.01]} material={hairMat}>
            <sphereGeometry args={[headR + 0.025, S, S, 0, Math.PI * 2, 0, Math.PI * 0.54]} />
          </mesh>
          {/* Two braids - starting at sides of head, going down */}
          {[-1, 1].map((s) => (
            <group key={s}>
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <mesh key={i} position={[
                  s * (headR + 0.02) + Math.sin(i * Math.PI) * 0.008,
                  HEAD_Y - 0.06 - i * 0.04,
                  -(headR * 0.3) + Math.cos(i * Math.PI) * 0.004
                ]} material={hairMat} rotation={[0.04, 0, s * 0.06]}>
                  <sphereGeometry args={[0.022, 10, 10]} />
                </mesh>
              ))}
              <mesh position={[s * (headR + 0.02), HEAD_Y - 0.36, -(headR * 0.3)]}>
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
          {/* Tight top layer */}
          <mesh position={[0, HEAD_Y + 0.04, -0.01]} material={slickMat}>
            <sphereGeometry args={[headR + 0.018, S, S, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
          </mesh>
          {/* Slicked top with sheen */}
          <mesh position={[0, HEAD_TOP - 0.04, 0.02]} material={slickMat}>
            <sphereGeometry args={[headR * 0.55, S, S, 0, Math.PI * 2, 0, Math.PI * 0.3]} />
          </mesh>
          {/* Back collection - behind head */}
          <mesh position={[0, HEAD_Y - 0.06, -(headR + 0.03)]} material={hairMat}>
            <capsuleGeometry args={[0.07, 0.05, 8, S]} />
          </mesh>
        </group>
      );
    }

    case "afro":
      return (
        <group>
          {/* Large volume - shifted back to not cover face */}
          <mesh position={[0, HEAD_Y + 0.06, -0.03]} material={hairMat}>
            <sphereGeometry args={[headR + 0.1, S, S, 0, Math.PI * 2, 0, Math.PI * 0.75]} />
          </mesh>
          {/* Extra top volume */}
          <mesh position={[0, HEAD_TOP + 0.06, -0.02]} material={hairMat}>
            <sphereGeometry args={[headR * 0.65, S, S]} />
          </mesh>
          {/* Side volume - pushed to sides */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * (headR + 0.06), HEAD_Y + 0.04, -0.04]} material={hairMat}>
              <sphereGeometry args={[0.08, S, S]} />
            </mesh>
          ))}
          {/* Texture bumps - only on back/sides/top */}
          {[...Array(20)].map((_, i) => {
            const phi = Math.acos(1 - 2 * (i + 0.5) / 20);
            const theta = Math.PI * (1 + Math.sqrt(5)) * i;
            const r = headR + 0.12;
            const x = r * Math.sin(phi) * Math.cos(theta) * 0.85;
            const y = r * Math.cos(phi) * 0.65;
            const z = r * Math.sin(phi) * Math.sin(theta) * 0.85;
            if (y < -0.05) return null;
            // Skip bumps in front face zone
            if (z > 0.05 && Math.abs(x) < headR) return null;
            return (
              <mesh key={i} position={[x, HEAD_Y + 0.06 + y, z - 0.03]} material={hairMat}>
                <sphereGeometry args={[0.025, 8, 8]} />
              </mesh>
            );
          })}
        </group>
      );

    case "undercut":
      return (
        <group>
          {/* Shaved sides - very subtle, on surface */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * (headR + 0.008), HEAD_Y, -0.03]} material={hairMat}>
              <sphereGeometry args={[0.03, 10, 10]} />
            </mesh>
          ))}
          {/* Long top swept to one side - sitting on top of head */}
          <mesh position={[0, HEAD_TOP - 0.03, 0]} material={hairMat}>
            <sphereGeometry args={[headR + 0.03, S, S, 0, Math.PI * 2, 0, Math.PI * 0.35]} />
          </mesh>
          <mesh position={[-0.08, HEAD_TOP - 0.04, 0.04]} material={hairMat} rotation={[0, 0, 0.3]}>
            <capsuleGeometry args={[0.035, 0.07, 8, 16]} />
          </mesh>
          <mesh position={[-0.14, HEAD_TOP - 0.08, 0.06]} material={hairMat} rotation={[0.1, 0, 0.5]}>
            <capsuleGeometry args={[0.025, 0.05, 6, 12]} />
          </mesh>
        </group>
      );

    default:
      return null;
  }
}

/* ─── Mouth Expressions ─── */
const MOUTH_POS: [number, number, number] = [0, 1.49, 0.22];

function MouthExpression({ expression, lipMat }: { expression: string; lipMat: THREE.MeshStandardMaterial }) {
  const teethMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#f5f0e8", roughness: 0.3 }), []);
  const tongueMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#cc5555", roughness: 0.5 }), []);
  const mouthDarkMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#3a1010", roughness: 0.8 }), []);

  switch (expression) {
    case "smile":
      return (
        <group position={MOUTH_POS}>
          <mesh rotation={[0.15, 0, 0]}>
            <torusGeometry args={[0.035, 0.008, 8, 20, Math.PI]} />
            <meshStandardMaterial color={lipMat.color} roughness={0.4} />
          </mesh>
          <mesh position={[0, -0.008, 0.003]} rotation={[-0.1, Math.PI, 0]}>
            <torusGeometry args={[0.03, 0.01, 8, 20, Math.PI]} />
            <meshStandardMaterial color={lipMat.color} roughness={0.35} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.035, 0.005, 0.005]}>
              <sphereGeometry args={[0.006, 6, 6]} />
              <meshStandardMaterial color={lipMat.color} roughness={0.4} />
            </mesh>
          ))}
        </group>
      );

    case "big_smile":
      return (
        <group position={MOUTH_POS}>
          <mesh rotation={[0.2, 0, 0]}>
            <torusGeometry args={[0.04, 0.008, 8, 20, Math.PI]} />
            <meshStandardMaterial color={lipMat.color} roughness={0.4} />
          </mesh>
          <mesh position={[0, -0.012, 0.003]} rotation={[-0.15, Math.PI, 0]}>
            <torusGeometry args={[0.035, 0.01, 8, 20, Math.PI]} />
            <meshStandardMaterial color={lipMat.color} roughness={0.35} />
          </mesh>
          <mesh position={[0, -0.003, 0.008]} material={teethMat}>
            <boxGeometry args={[0.045, 0.012, 0.005]} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.04, 0.008, 0.005]}>
              <sphereGeometry args={[0.007, 6, 6]} />
              <meshStandardMaterial color={lipMat.color} roughness={0.4} />
            </mesh>
          ))}
        </group>
      );

    case "neutral":
      return (
        <group position={MOUTH_POS}>
          <mesh rotation={[0, 0, 0]}>
            <capsuleGeometry args={[0.007, 0.05, 6, 12]} />
            <meshStandardMaterial color={lipMat.color} roughness={0.4} />
          </mesh>
          <mesh position={[0, -0.012, 0.002]}>
            <capsuleGeometry args={[0.008, 0.04, 6, 12]} />
            <meshStandardMaterial color={lipMat.color} roughness={0.35} />
          </mesh>
        </group>
      );

    case "surprised":
      return (
        <group position={MOUTH_POS}>
          <mesh rotation={[0, 0, 0]}>
            <torusGeometry args={[0.022, 0.008, 10, 20]} />
            <meshStandardMaterial color={lipMat.color} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0, 0.003]} material={mouthDarkMat}>
            <circleGeometry args={[0.018, 16]} />
          </mesh>
        </group>
      );

    case "sad":
      return (
        <group position={MOUTH_POS}>
          <mesh rotation={[Math.PI + 0.15, 0, 0]}>
            <torusGeometry args={[0.03, 0.007, 8, 20, Math.PI]} />
            <meshStandardMaterial color={lipMat.color} roughness={0.4} />
          </mesh>
          <mesh position={[0, -0.015, 0.003]} rotation={[Math.PI - 0.1, Math.PI, 0]}>
            <torusGeometry args={[0.025, 0.009, 8, 20, Math.PI]} />
            <meshStandardMaterial color={lipMat.color} roughness={0.35} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.03, -0.01, 0.005]}>
              <sphereGeometry args={[0.005, 6, 6]} />
              <meshStandardMaterial color={lipMat.color} roughness={0.4} />
            </mesh>
          ))}
        </group>
      );

    case "smirk":
      return (
        <group position={MOUTH_POS}>
          <mesh rotation={[0.1, 0, 0.15]}>
            <torusGeometry args={[0.032, 0.007, 8, 20, Math.PI]} />
            <meshStandardMaterial color={lipMat.color} roughness={0.4} />
          </mesh>
          <mesh position={[0, -0.008, 0.003]} rotation={[-0.05, Math.PI, -0.1]}>
            <torusGeometry args={[0.028, 0.009, 8, 20, Math.PI]} />
            <meshStandardMaterial color={lipMat.color} roughness={0.35} />
          </mesh>
          <mesh position={[0.035, 0.01, 0.005]}>
            <sphereGeometry args={[0.006, 6, 6]} />
            <meshStandardMaterial color={lipMat.color} roughness={0.4} />
          </mesh>
        </group>
      );

    case "tongue_out":
      return (
        <group position={MOUTH_POS}>
          <mesh rotation={[0.15, 0, 0]}>
            <torusGeometry args={[0.035, 0.007, 8, 20, Math.PI]} />
            <meshStandardMaterial color={lipMat.color} roughness={0.4} />
          </mesh>
          <mesh position={[0, -0.008, 0.003]} rotation={[-0.1, Math.PI, 0]}>
            <torusGeometry args={[0.03, 0.009, 8, 20, Math.PI]} />
            <meshStandardMaterial color={lipMat.color} roughness={0.35} />
          </mesh>
          <mesh position={[0, -0.02, 0.015]} material={tongueMat} rotation={[0.4, 0, 0]}>
            <capsuleGeometry args={[0.012, 0.02, 6, 12]} />
          </mesh>
        </group>
      );

    default:
      return (
        <group position={MOUTH_POS}>
          <mesh rotation={[0.15, 0, 0]}>
            <torusGeometry args={[0.035, 0.008, 8, 20, Math.PI]} />
            <meshStandardMaterial color={lipMat.color} roughness={0.4} />
          </mesh>
          <mesh position={[0, -0.008, 0.003]} rotation={[-0.1, Math.PI, 0]}>
            <torusGeometry args={[0.03, 0.01, 8, 20, Math.PI]} />
            <meshStandardMaterial color={lipMat.color} roughness={0.35} />
          </mesh>
        </group>
      );
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
  const headR = HEAD_R;

  const shirtType = equipped?.shirt?.style_data?.type || "tshirt";
  const pantsType = equipped?.pants?.style_data?.type || "pants";
  const hatType = equipped?.hat?.style_data?.type || "cap";

  const isSleeveless = shirtType === "tank_top" || shirtType === "sports_bra" || shirtType === "crop_top";
  const isCropped = shirtType === "sports_bra" || shirtType === "crop_top";
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

  const lipMat = useMemo(() => {
    const c = new THREE.Color(config.skin_color);
    c.multiplyScalar(0.75);
    c.lerp(new THREE.Color("#cc5555"), 0.35);
    return new THREE.MeshStandardMaterial({ color: c, roughness: 0.4 });
  }, [config.skin_color]);

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
  const upperArmMat = isSleeveless ? skinMat : shirtMat;
  const lowerTorsoMat = isCropped ? skinMat : shirtMat;

  return (
    <group ref={groupRef} scale={[1, h, 1]}>

      {/* ══════ HEAD ══════ */}
      <mesh position={[0, HEAD_Y, 0]} material={skinMat}>
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
      <MouthExpression expression={config.mouth_expression || "smile"} lipMat={lipMat} />

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
      {/* Collarbones */}
      {[-1, 1].map((side) => (
        <mesh key={`clavicle${side}`} position={[side * shoulderW * 0.28, 1.32, 0.06]} material={isSleeveless ? skinMat : shirtMat} rotation={[0, 0, side * 0.25]}>
          <capsuleGeometry args={[0.015, shoulderW * 0.25, 6, 12]} />
        </mesh>
      ))}
      {/* Shoulder joints */}
      {[-1, 1].map((side) => (
        <mesh key={`shoulder${side}`} position={[side * shoulderW * 0.5, 1.28, 0]} material={isSleeveless ? skinMat : shirtMat}>
          <sphereGeometry args={[armR * 1.6, S, S]} />
        </mesh>
      ))}
      {/* Upper chest */}
      <mesh position={[0, 1.26, 0.02]} material={shirtMat}>
        <capsuleGeometry args={[shoulderW * 0.42, 0.06, 16, S]} />
      </mesh>
      {/* Mid torso - ribcage area */}
      <mesh position={[0, 1.17, 0.01]} material={shirtMat} scale={[1, 1, chestDepth / 0.18]}>
        <capsuleGeometry args={[shoulderW * 0.40, 0.06, 16, S]} />
      </mesh>
      {/* Lower torso - tapers to waist */}
      <mesh position={[0, 1.08, 0]} material={shirtMat} scale={[1, 1, chestDepth / 0.19]}>
        <capsuleGeometry args={[shoulderW * 0.36, 0.06, 16, S]} />
      </mesh>
      {/* Waist/belly */}
      <mesh position={[0, 1.0, 0]} material={lowerTorsoMat}>
        <capsuleGeometry args={[waistW * 0.5, 0.06, 12, S]} />
      </mesh>
      {/* Back muscle definition */}
      <mesh position={[0, 1.2, -0.08]} material={shirtMat}>
        <capsuleGeometry args={[shoulderW * 0.35, 0.12, 12, S]} />
      </mesh>
      {/* Spine groove hint */}
      {[-1, 1].map((side) => (
        <mesh key={`back${side}`} position={[side * 0.05, 1.15, -0.09]} material={shirtMat}>
          <capsuleGeometry args={[shoulderW * 0.18, 0.14, 8, S]} />
        </mesh>
      ))}

      {/* Hoodie hood - hanging down on back */}
      {shirtType === "hoodie" && (
        <group>
          {/* Hood fabric draped on upper back */}
          <mesh position={[0, 1.28, -0.12]} material={shirtMat} rotation={[0.6, 0, 0]}>
            <capsuleGeometry args={[0.08, 0.06, 12, S]} />
          </mesh>
          <mesh position={[0, 1.22, -0.14]} material={shirtMat} rotation={[0.4, 0, 0]}>
            <capsuleGeometry args={[0.07, 0.04, 12, S]} />
          </mesh>
          {/* Hood opening at neck */}
          <mesh position={[0, 1.34, -0.08]} material={shirtMat} rotation={[0.5, 0, 0]}>
            <torusGeometry args={[0.065, 0.02, 8, S, Math.PI]} />
          </mesh>
          {/* Hood fold/drape detail */}
          {[-1, 1].map((s) => (
            <mesh key={`hoodfold${s}`} position={[s * 0.06, 1.25, -0.13]} material={shirtMat}>
              <sphereGeometry args={[0.04, 10, 10]} />
            </mesh>
          ))}
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
      <group ref={leftArmRef} position={[-(shoulderW * 0.5 + armR * 1.2), 1.28, 0]}>
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
      {/* Hip area - wider, more anatomical */}
      <mesh position={[0, 0.92, 0]} material={pantsMat}>
        <capsuleGeometry args={[hipW * 0.48, 0.04, 12, S]} />
      </mesh>
      <mesh position={[0, 0.88, 0.01]} material={pantsMat} scale={[1.05, 0.8, 0.9]}>
        <capsuleGeometry args={[hipW * 0.46, 0.04, 12, S]} />
      </mesh>
      {/* Glutes */}
      <mesh position={[0, 0.87, -0.05]} material={pantsMat}>
        <sphereGeometry args={[hipW * 0.38, S, S]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={`glute${s}`} position={[s * hipW * 0.22, 0.86, -0.04]} material={pantsMat}>
          <sphereGeometry args={[hipW * 0.26, S, S]} />
        </mesh>
      ))}

      {/* Legs */}
      {[-1, 1].map((side) => (
        <group key={`leg${side}`} position={[side * legSpacing, 0, 0]}>
          {/* Upper thigh */}
          <mesh position={[0, 0.78, 0]} material={pantsMat}>
            <capsuleGeometry args={[thighR * 1.05, 0.08, 8, S]} />
          </mesh>
          {/* Mid thigh */}
          <mesh position={[0, 0.68, 0]} material={pantsMat}>
            <capsuleGeometry args={[thighR, 0.08, 8, S]} />
          </mesh>
          {/* Knee joint */}
          <mesh position={[0, 0.60, 0.01]} material={isShorts ? skinMat : pantsMat}>
            <sphereGeometry args={[thighR * 0.82, 16, 16]} />
          </mesh>
          {/* Kneecap */}
          <mesh position={[0, 0.60, 0.03]} material={isShorts ? skinMat : pantsMat}>
            <sphereGeometry args={[thighR * 0.45, 12, 12]} />
          </mesh>
          {/* Upper calf */}
          <mesh position={[0, 0.50, 0]} material={isShorts ? skinMat : pantsMat}>
            <capsuleGeometry args={[calfR * 1.05, 0.06, 8, S]} />
          </mesh>
          {/* Lower calf - tapers */}
          <mesh position={[0, 0.42, 0]} material={isShorts ? skinMat : pantsMat}>
            <capsuleGeometry args={[calfR * 0.8, 0.05, 8, S]} />
          </mesh>
          {/* Ankle */}
          <mesh position={[0, 0.36, 0]} material={isShorts ? skinMat : pantsMat}>
            <capsuleGeometry args={[calfR * 0.55, 0.02, 8, S]} />
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
