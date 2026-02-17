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
          {/* Full cap from top flowing back */}
          <mesh position={[0, HEAD_Y + 0.04, -0.02]} material={hairMat}>
            <sphereGeometry args={[headR + 0.03, S, S, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
          </mesh>
          {/* Connected back curtain - single wide shape */}
          <mesh position={[0, HEAD_Y - 0.08, -(headR + 0.02)]} material={hairMat}>
            <cylinderGeometry args={[0.12, 0.10, 0.16, S]} />
          </mesh>
          <mesh position={[0, HEAD_Y - 0.22, -(headR + 0.025)]} material={hairMat}>
            <cylinderGeometry args={[0.10, 0.08, 0.14, S]} />
          </mesh>
          <mesh position={[0, HEAD_Y - 0.34, -(headR + 0.03)]} material={hairMat}>
            <cylinderGeometry args={[0.08, 0.06, 0.12, S]} />
          </mesh>
          {/* Side curtains flowing from temples */}
          {[-1, 1].map((s) => (
            <group key={`side${s}`}>
              <mesh position={[s * (headR + 0.02), HEAD_Y - 0.04, -0.03]} material={hairMat}>
                <cylinderGeometry args={[0.03, 0.025, 0.14, 12]} />
              </mesh>
              <mesh position={[s * (headR + 0.02), HEAD_Y - 0.18, -0.04]} material={hairMat}>
                <cylinderGeometry args={[0.025, 0.02, 0.14, 12]} />
              </mesh>
            </group>
          ))}
        </group>
      );

    case "wavy":
      return (
        <group>
          {/* Top cap */}
          <mesh position={[0, HEAD_Y + 0.04, -0.01]} material={hairMat}>
            <sphereGeometry args={[headR + 0.035, S, S, 0, Math.PI * 2, 0, Math.PI * 0.56]} />
          </mesh>
          {/* Connected back flow - wide curtain with wave */}
          <mesh position={[0, HEAD_Y - 0.06, -(headR + 0.025)]} material={hairMat}>
            <cylinderGeometry args={[0.11, 0.10, 0.12, S]} />
          </mesh>
          <mesh position={[0, HEAD_Y - 0.16, -(headR + 0.035)]} material={hairMat} rotation={[0.08, 0, 0]}>
            <cylinderGeometry args={[0.10, 0.09, 0.1, S]} />
          </mesh>
          {/* Wavy tips */}
          {[-0.06, -0.02, 0.02, 0.06].map((x) => (
            <mesh key={x} position={[x, HEAD_Y - 0.24, -(headR + 0.04)]} material={hairMat} rotation={[0.1, x * 2, Math.sin(x * 20) * 0.15]}>
              <capsuleGeometry args={[0.022, 0.06, 6, 12]} />
            </mesh>
          ))}
          {/* Side volume connected to cap */}
          {[-1, 1].map((s) => (
            <mesh key={`sw${s}`} position={[s * (headR + 0.025), HEAD_Y - 0.04, -0.02]} material={hairMat}>
              <cylinderGeometry args={[0.03, 0.025, 0.12, 12]} />
            </mesh>
          ))}
        </group>
      );

    case "mohawk":
      return (
        <group>
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const t = i / 5;
            const spikeH = 0.05 + Math.sin(t * Math.PI) * 0.04;
            const spikeW = 0.025 + Math.sin(t * Math.PI) * 0.012;
            const z = 0.08 - t * 0.25;
            const surfaceY = HEAD_Y + Math.sqrt(Math.max(0, headR * headR - z * z));
            return (
              <mesh key={i} position={[0, surfaceY + spikeH * 0.5, z]} material={hairMat}>
                <capsuleGeometry args={[spikeW, spikeH, 8, 16]} />
              </mesh>
            );
          })}
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
          {/* Full cap pulled back tightly */}
          <mesh position={[0, HEAD_Y + 0.04, -0.01]} material={hairMat}>
            <sphereGeometry args={[headR + 0.025, S, S, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
          </mesh>
          {/* Hair gathering at back of head */}
          <mesh position={[0, HEAD_Y - 0.02, -(headR + 0.01)]} material={hairMat}>
            <sphereGeometry args={[0.05, S, S]} />
          </mesh>
          {/* Hair band */}
          <mesh position={[0, HEAD_Y - 0.02, -(headR + 0.02)]}>
            <torusGeometry args={[0.035, 0.007, 8, 16]} />
            <meshStandardMaterial color="#333333" roughness={0.3} />
          </mesh>
          {/* Connected ponytail - smooth continuous tube */}
          <mesh position={[0, HEAD_Y - 0.12, -(headR + 0.04)]} material={hairMat} rotation={[0.15, 0, 0]}>
            <cylinderGeometry args={[0.035, 0.03, 0.14, S]} />
          </mesh>
          <mesh position={[0, HEAD_Y - 0.24, -(headR + 0.06)]} material={hairMat} rotation={[0.2, 0, 0]}>
            <cylinderGeometry args={[0.03, 0.025, 0.12, S]} />
          </mesh>
          <mesh position={[0, HEAD_Y - 0.34, -(headR + 0.07)]} material={hairMat}>
            <sphereGeometry args={[0.025, 10, 10]} />
          </mesh>
        </group>
      );

    case "bun":
      return (
        <group>
          <mesh position={[0, HEAD_Y + 0.04, -0.01]} material={hairMat}>
            <sphereGeometry args={[headR + 0.03, S, S, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
          </mesh>
          <mesh position={[0, HEAD_TOP + 0.04, -0.06]} material={hairMat}>
            <sphereGeometry args={[0.07, S, S]} />
          </mesh>
          <mesh position={[0, HEAD_TOP + 0.04, -0.06]} rotation={[0.5, 0, 0]}>
            <torusGeometry args={[0.05, 0.015, 8, 20]} />
            <meshStandardMaterial color={hairMat.color} roughness={0.6} metalness={0.1} />
          </mesh>
          <mesh position={[0, HEAD_TOP, -0.06]}>
            <torusGeometry args={[0.04, 0.007, 8, 16]} />
            <meshStandardMaterial color="#333333" roughness={0.3} />
          </mesh>
        </group>
      );

    case "braids":
      return (
        <group>
          {/* Cap pulled back */}
          <mesh position={[0, HEAD_Y + 0.04, -0.01]} material={hairMat}>
            <sphereGeometry args={[headR + 0.025, S, S, 0, Math.PI * 2, 0, Math.PI * 0.54]} />
          </mesh>
          {/* Hair parting lines from cap to braid start */}
          {[-1, 1].map((s) => (
            <mesh key={`part${s}`} position={[s * headR * 0.5, HEAD_Y + 0.06, -(headR * 0.3)]} material={hairMat} rotation={[0.3, 0, s * 0.4]}>
              <capsuleGeometry args={[0.02, 0.08, 6, 12]} />
            </mesh>
          ))}
          {/* Two braids - connected chain of segments */}
          {[-1, 1].map((s) => (
            <group key={s}>
              {/* Braid start connecting to head */}
              <mesh position={[s * (headR + 0.01), HEAD_Y - 0.02, -(headR * 0.2)]} material={hairMat}>
                <sphereGeometry args={[0.028, 10, 10]} />
              </mesh>
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <mesh key={i} position={[
                  s * (headR + 0.02) + Math.sin(i * Math.PI) * 0.006,
                  HEAD_Y - 0.06 - i * 0.04,
                  -(headR * 0.25) + Math.cos(i * Math.PI) * 0.003
                ]} material={hairMat} rotation={[0.04, 0, s * 0.06]}>
                  <sphereGeometry args={[0.02 - i * 0.001, 10, 10]} />
                </mesh>
              ))}
              <mesh position={[s * (headR + 0.02), HEAD_Y - 0.36, -(headR * 0.25)]}>
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
          {/* Tight cap swept back */}
          <mesh position={[0, HEAD_Y + 0.04, -0.01]} material={slickMat}>
            <sphereGeometry args={[headR + 0.018, S, S, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
          </mesh>
          {/* Connected back shape flowing from cap */}
          <mesh position={[0, HEAD_Y - 0.04, -(headR + 0.015)]} material={slickMat}>
            <cylinderGeometry args={[0.08, 0.06, 0.1, S]} />
          </mesh>
          <mesh position={[0, HEAD_Y - 0.12, -(headR + 0.02)]} material={hairMat}>
            <cylinderGeometry args={[0.06, 0.04, 0.08, S]} />
          </mesh>
        </group>
      );
    }

    case "afro":
      return (
        <group>
          {/* Main volume - only top and sides, open face */}
          <mesh position={[0, HEAD_Y + 0.08, -0.04]} material={hairMat}>
            <sphereGeometry args={[headR + 0.09, S, S, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
          </mesh>
          {/* Side volume */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * (headR + 0.05), HEAD_Y + 0.04, -0.05]} material={hairMat}>
              <sphereGeometry args={[0.07, S, S]} />
            </mesh>
          ))}
          {/* Top extra volume */}
          <mesh position={[0, HEAD_TOP + 0.08, -0.03]} material={hairMat}>
            <sphereGeometry args={[headR * 0.55, S, S]} />
          </mesh>
          {/* Texture bumps - back and sides only */}
          {[...Array(14)].map((_, i) => {
            const angle = (i / 14) * Math.PI * 1.6 + Math.PI * 0.2; // back half only
            const r = headR + 0.1;
            const x = Math.sin(angle) * r;
            const z = -Math.abs(Math.cos(angle) * r) - 0.02;
            return (
              <mesh key={i} position={[x, HEAD_Y + 0.06 + Math.sin(i * 1.5) * 0.04, z]} material={hairMat}>
                <sphereGeometry args={[0.022, 8, 8]} />
              </mesh>
            );
          })}
        </group>
      );

    default:
      return null;
  }
}

/* ─── Mouth Expressions ─── */
const MOUTH_POS: [number, number, number] = [0, 1.48, 0.24];

function MouthExpression({ expression, lipMat }: { expression: string; lipMat: THREE.MeshStandardMaterial }) {
  const teethMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#f5f0e8", roughness: 0.3 }), []);
  const tongueMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#cc5555", roughness: 0.5 }), []);
  const mouthDarkMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#3a1010", roughness: 0.8 }), []);

  switch (expression) {
    case "smile":
      return (
        <group position={MOUTH_POS}>
          {/* Upper lip - curved smile */}
          <mesh rotation={[0.2, 0, 0]}>
            <torusGeometry args={[0.045, 0.01, 8, 24, Math.PI]} />
            <meshStandardMaterial color={lipMat.color} roughness={0.4} />
          </mesh>
          {/* Lower lip */}
          <mesh position={[0, -0.012, 0.004]} rotation={[-0.15, Math.PI, 0]}>
            <torusGeometry args={[0.038, 0.013, 8, 24, Math.PI]} />
            <meshStandardMaterial color={lipMat.color} roughness={0.35} />
          </mesh>
          {/* Smile corners */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.044, 0.008, 0.005]}>
              <sphereGeometry args={[0.008, 6, 6]} />
              <meshStandardMaterial color={lipMat.color} roughness={0.4} />
            </mesh>
          ))}
        </group>
      );

    case "big_smile":
      return (
        <group position={MOUTH_POS}>
          {/* Wide upper lip */}
          <mesh rotation={[0.25, 0, 0]}>
            <torusGeometry args={[0.05, 0.01, 8, 24, Math.PI]} />
            <meshStandardMaterial color={lipMat.color} roughness={0.4} />
          </mesh>
          {/* Lower lip */}
          <mesh position={[0, -0.016, 0.004]} rotation={[-0.2, Math.PI, 0]}>
            <torusGeometry args={[0.045, 0.013, 8, 24, Math.PI]} />
            <meshStandardMaterial color={lipMat.color} roughness={0.35} />
          </mesh>
          {/* Teeth showing */}
          <mesh position={[0, -0.004, 0.01]} material={teethMat}>
            <boxGeometry args={[0.06, 0.016, 0.006]} />
          </mesh>
          {/* Raised cheek corners */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.05, 0.012, 0.005]}>
              <sphereGeometry args={[0.009, 6, 6]} />
              <meshStandardMaterial color={lipMat.color} roughness={0.4} />
            </mesh>
          ))}
        </group>
      );

    case "neutral":
      return (
        <group position={MOUTH_POS}>
          {/* Flat straight line */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <capsuleGeometry args={[0.009, 0.06, 6, 12]} />
            <meshStandardMaterial color={lipMat.color} roughness={0.4} />
          </mesh>
          {/* Lower lip hint */}
          <mesh position={[0, -0.015, 0.003]}>
            <capsuleGeometry args={[0.01, 0.05, 6, 12]} />
            <meshStandardMaterial color={lipMat.color} roughness={0.35} />
          </mesh>
        </group>
      );

    case "surprised":
      return (
        <group position={MOUTH_POS}>
          {/* Round O-shape */}
          <mesh>
            <torusGeometry args={[0.028, 0.01, 12, 24]} />
            <meshStandardMaterial color={lipMat.color} roughness={0.4} />
          </mesh>
          {/* Dark mouth interior */}
          <mesh position={[0, 0, 0.004]} material={mouthDarkMat}>
            <circleGeometry args={[0.022, 20]} />
          </mesh>
        </group>
      );

    case "sad":
      return (
        <group position={MOUTH_POS}>
          {/* Downturned upper lip */}
          <mesh rotation={[Math.PI + 0.2, 0, 0]}>
            <torusGeometry args={[0.04, 0.009, 8, 24, Math.PI]} />
            <meshStandardMaterial color={lipMat.color} roughness={0.4} />
          </mesh>
          {/* Lower lip */}
          <mesh position={[0, -0.018, 0.004]} rotation={[Math.PI - 0.15, Math.PI, 0]}>
            <torusGeometry args={[0.035, 0.012, 8, 24, Math.PI]} />
            <meshStandardMaterial color={lipMat.color} roughness={0.35} />
          </mesh>
          {/* Drooping corners */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.04, -0.014, 0.005]}>
              <sphereGeometry args={[0.007, 6, 6]} />
              <meshStandardMaterial color={lipMat.color} roughness={0.4} />
            </mesh>
          ))}
        </group>
      );

    case "smirk":
      return (
        <group position={MOUTH_POS}>
          {/* Asymmetric smile - tilted */}
          <mesh rotation={[0.12, 0, 0.2]}>
            <torusGeometry args={[0.04, 0.009, 8, 24, Math.PI]} />
            <meshStandardMaterial color={lipMat.color} roughness={0.4} />
          </mesh>
          {/* Lower lip slightly off-center */}
          <mesh position={[0.005, -0.01, 0.004]} rotation={[-0.08, Math.PI, -0.15]}>
            <torusGeometry args={[0.035, 0.012, 8, 24, Math.PI]} />
            <meshStandardMaterial color={lipMat.color} roughness={0.35} />
          </mesh>
          {/* Raised corner on one side */}
          <mesh position={[0.045, 0.016, 0.006]}>
            <sphereGeometry args={[0.008, 6, 6]} />
            <meshStandardMaterial color={lipMat.color} roughness={0.4} />
          </mesh>
        </group>
      );

    case "tongue_out":
      return (
        <group position={MOUTH_POS}>
          {/* Open smile */}
          <mesh rotation={[0.2, 0, 0]}>
            <torusGeometry args={[0.045, 0.009, 8, 24, Math.PI]} />
            <meshStandardMaterial color={lipMat.color} roughness={0.4} />
          </mesh>
          {/* Lower lip */}
          <mesh position={[0, -0.012, 0.004]} rotation={[-0.15, Math.PI, 0]}>
            <torusGeometry args={[0.038, 0.012, 8, 24, Math.PI]} />
            <meshStandardMaterial color={lipMat.color} roughness={0.35} />
          </mesh>
          {/* Tongue sticking out */}
          <mesh position={[0, -0.028, 0.02]} material={tongueMat} rotation={[0.5, 0, 0]}>
            <capsuleGeometry args={[0.016, 0.025, 8, 12]} />
          </mesh>
        </group>
      );

    default:
      return (
        <group position={MOUTH_POS}>
          <mesh rotation={[0.2, 0, 0]}>
            <torusGeometry args={[0.045, 0.01, 8, 24, Math.PI]} />
            <meshStandardMaterial color={lipMat.color} roughness={0.4} />
          </mesh>
          <mesh position={[0, -0.012, 0.004]} rotation={[-0.15, Math.PI, 0]}>
            <torusGeometry args={[0.038, 0.013, 8, 24, Math.PI]} />
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
        <cylinderGeometry args={[0.05, 0.06, 0.1, S]} />
      </mesh>

      {/* ══════ TORSO ══════ */}
      {/* Smooth Simpsons-style torso: single tapered cylinder shape */}
      {/* Shoulder line */}
      {[-1, 1].map((side) => (
        <mesh key={`shoulder${side}`} position={[side * shoulderW * 0.5, 1.3, 0]} material={isSleeveless ? skinMat : shirtMat}>
          <sphereGeometry args={[armR * 1.4, S, S]} />
        </mesh>
      ))}
      {/* Main torso - one smooth cylinder from shoulders to waist */}
      <mesh position={[0, 1.15, 0]} material={shirtMat}>
        <cylinderGeometry args={[shoulderW * 0.44, waistW * 0.48, 0.34, S]} />
      </mesh>
      {/* Slight chest rounding at front */}
      <mesh position={[0, 1.22, 0.06]} material={shirtMat}>
        <sphereGeometry args={[shoulderW * 0.32, S, S, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
      </mesh>
      {/* Lower belly area - smooth transition to hips */}
      <mesh position={[0, 0.96, 0]} material={lowerTorsoMat}>
        <cylinderGeometry args={[waistW * 0.48, hipW * 0.46, 0.08, S]} />
      </mesh>
      {/* Belly roundness for higher fat */}
      {f > 1 && (
        <mesh position={[0, 1.06, 0.06]} material={lowerTorsoMat}>
          <sphereGeometry args={[waistW * 0.35 * f, S, S]} />
        </mesh>
      )}

      {/* Hoodie hood - hanging down on back */}
      {shirtType === "hoodie" && (
        <group>
          <mesh position={[0, 1.28, -0.12]} material={shirtMat} rotation={[0.6, 0, 0]}>
            <capsuleGeometry args={[0.08, 0.06, 12, S]} />
          </mesh>
          <mesh position={[0, 1.22, -0.14]} material={shirtMat} rotation={[0.4, 0, 0]}>
            <capsuleGeometry args={[0.07, 0.04, 12, S]} />
          </mesh>
          <mesh position={[0, 1.34, -0.08]} material={shirtMat} rotation={[0.5, 0, 0]}>
            <torusGeometry args={[0.065, 0.02, 8, S, Math.PI]} />
          </mesh>
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
            <sphereGeometry args={[0.06 * f, S, S]} />
          </mesh>
          <mesh position={[0.07, 1.2, 0.1]} material={shirtMat}>
            <sphereGeometry args={[0.06 * f, S, S]} />
          </mesh>
        </>
      )}

      {/* Pectoral hint for muscular male */}
      {!isFemale && m > 1 && (
        <>
          {[-1, 1].map((s) => (
            <mesh key={`pec${s}`} position={[s * 0.065, 1.22, 0.1]} material={shirtMat}>
              <sphereGeometry args={[0.04 * m, S, S]} />
            </mesh>
          ))}
        </>
      )}

      {/* ══════ ARMS ══════ */}
      {/* Simpsons arms: smooth tubes, no extra elbow/wrist spheres */}
      <group ref={leftArmRef} position={[-(shoulderW * 0.5 + armR * 1.2), 1.28, 0]}>
        {/* Upper arm */}
        <mesh position={[0, -0.08, 0]} material={upperArmMat}>
          <cylinderGeometry args={[armR * 1.05, armR, 0.18, S]} />
        </mesh>
        {/* Forearm */}
        <mesh position={[0, -0.26, 0]} material={skinMat}>
          <cylinderGeometry args={[forearmR, forearmR * 0.85, 0.18, S]} />
        </mesh>
        <Hand position={[0, -0.37, 0]} material={skinMat} side={-1} />
      </group>

      <group ref={rightArmRef} position={[shoulderW * 0.5 + armR * 1.2, 1.28, 0]}>
        {/* Upper arm */}
        <mesh position={[0, -0.08, 0]} material={upperArmMat}>
          <cylinderGeometry args={[armR * 1.05, armR, 0.18, S]} />
        </mesh>
        {/* Forearm */}
        <mesh position={[0, -0.26, 0]} material={skinMat}>
          <cylinderGeometry args={[forearmR, forearmR * 0.85, 0.18, S]} />
        </mesh>
        <Hand position={[0, -0.37, 0]} material={skinMat} side={1} />
      </group>

      {/* ══════ LOWER BODY ══════ */}
      {/* Hip area - smooth cylinder */}
      <mesh position={[0, 0.90, 0]} material={pantsMat}>
        <cylinderGeometry args={[hipW * 0.46, hipW * 0.42, 0.1, S]} />
      </mesh>

      {/* Legs - Simpsons style: smooth tapered tubes */}
      {[-1, 1].map((side) => (
        <group key={`leg${side}`} position={[side * legSpacing, 0, 0]}>
          {/* Thigh - single smooth cylinder */}
          <mesh position={[0, 0.72, 0]} material={pantsMat}>
            <cylinderGeometry args={[thighR, thighR * 0.85, 0.26, S]} />
          </mesh>
          {/* Calf - smooth taper */}
          <mesh position={[0, 0.50, 0]} material={isShorts ? skinMat : pantsMat}>
            <cylinderGeometry args={[calfR, calfR * 0.65, 0.22, S]} />
          </mesh>

          {/* Shoes - simple rounded shape */}
          <mesh position={[0, 0.37, 0]} material={shoesMat}>
            <sphereGeometry args={[0.04, S, S]} />
          </mesh>
          <mesh position={[0, 0.35, 0.03]} material={shoesMat} rotation={[Math.PI / 2, 0, 0]}>
            <capsuleGeometry args={[0.04, 0.08, 8, S]} />
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
