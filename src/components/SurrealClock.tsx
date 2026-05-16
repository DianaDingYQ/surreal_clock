import { Suspense, useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { MeshTransmissionMaterial, Text } from '@react-three/drei';

type Point = { x: number; y: number };

interface SurrealClockProps {
  points: Point[];
  videoTexture: THREE.VideoTexture | null;
  interactionPoint: Point | null;
  interactionScale: number;
  materialConfig: {
    roughness: number;
    metalness: number;
    distortion: number;
    ior: number;
  };
}

const MIN_CONTOUR_POINTS = 12;
const MAX_CONTOUR_POINTS = 72;

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getCenter(points: Point[]) {
  return points.reduce(
    (acc, p) => ({ x: acc.x + p.x / points.length, y: acc.y + p.y / points.length }),
    { x: 0, y: 0 }
  );
}

function createEllipseFallback(points: Point[]) {
  const center = getCenter(points);
  const bounds = points.reduce(
    (acc, p) => ({
      minX: Math.min(acc.minX, p.x),
      maxX: Math.max(acc.maxX, p.x),
      minY: Math.min(acc.minY, p.y),
      maxY: Math.max(acc.maxY, p.y),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
  );

  const radiusX = Math.max((bounds.maxX - bounds.minX) * 0.55, 0.12);
  const radiusY = Math.max((bounds.maxY - bounds.minY) * 0.55, 0.12);

  return Array.from({ length: 32 }, (_, i) => {
    const angle = (i / 32) * Math.PI * 2;
    return {
      x: center.x + Math.cos(angle) * radiusX,
      y: center.y + Math.sin(angle) * radiusY,
    };
  });
}

function createStableContour(points: Point[]) {
  const cleanPoints = points
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
    .filter((p, i, arr) => i === 0 || distance(p, arr[i - 1]) > 0.004);

  if (cleanPoints.length < MIN_CONTOUR_POINTS) return createEllipseFallback(points);

  const center = getCenter(cleanPoints);
  const binCount = Math.min(MAX_CONTOUR_POINTS, Math.max(32, Math.floor(cleanPoints.length / 2)));
  const bins: Array<{ point: Point; radius: number } | null> = Array(binCount).fill(null);

  for (const point of cleanPoints) {
    const angle = Math.atan2(point.y - center.y, point.x - center.x);
    const normalizedAngle = angle < 0 ? angle + Math.PI * 2 : angle;
    const index = Math.min(binCount - 1, Math.floor((normalizedAngle / (Math.PI * 2)) * binCount));
    const radius = distance(point, center);

    if (!bins[index] || radius > bins[index].radius) {
      bins[index] = { point, radius };
    }
  }

  const contour = bins.filter((bin): bin is { point: Point; radius: number } => Boolean(bin)).map((bin) => bin.point);
  return contour.length >= MIN_CONTOUR_POINTS ? contour : createEllipseFallback(cleanPoints);
}

export function SurrealClock({ points, videoTexture, interactionPoint, interactionScale, materialConfig }: SurrealClockProps) {
  const meshRef = useRef<THREE.Group>(null);
  const materialRef = useRef<any>(null);
  const { viewport } = useThree();

  // Convert freehand input into a simple radial contour so ExtrudeGeometry cannot
  // get stuck triangulating a dense or self-intersecting hand path.
  const { shape, perimeterPoints } = useMemo(() => {
    if (points.length < 5) return { shape: null, perimeterPoints: [] };
    const contour = createStableContour(points);
    const center = getCenter(contour);

    const rawNormalizedPoints = contour.map(p => new THREE.Vector2(
      (p.x - center.x) * viewport.width,
      -(p.y - center.y) * viewport.height
    ));
    const maxRadius = rawNormalizedPoints.reduce((max, p) => Math.max(max, p.length()), 0);
    const sizeScale = maxRadius > 0 ? THREE.MathUtils.clamp(1.35 / maxRadius, 0.75, 5) : 1;
    const normalizedPoints = rawNormalizedPoints.map((p) => p.multiplyScalar(sizeScale));

    const s = new THREE.Shape();
    try {
      s.moveTo(normalizedPoints[0].x, normalizedPoints[0].y);
      for (let i = 1; i < normalizedPoints.length; i++) {
          const p = normalizedPoints[i];
          const drip = (p.y < 0) ? Math.sin(p.x * 6) * 0.03 * Math.abs(p.y) : 0;
          s.lineTo(p.x, p.y + drip);
      }
      s.closePath();
    } catch (e) {
      console.error("Shape creation failed", e);
      return { shape: null, perimeterPoints: [] };
    }

    return { shape: s, perimeterPoints: normalizedPoints };
  }, [points, viewport.width, viewport.height]);

  const geometry = useMemo(() => {
    if (!shape) return null;
    try {
      return new THREE.ExtrudeGeometry(shape, {
        depth: 0.1,
        bevelEnabled: true,
        bevelThickness: 0.05,
        bevelSize: 0.05,
        bevelOffset: 0,
        bevelSegments: 1 
      });
    } catch (e) {
      console.error("Geometry creation failed", e);
      return null;
    }
  }, [shape]);

  const rimGeometry = useMemo(() => {
    if (perimeterPoints.length < 4) return null;

    const curve = new THREE.CatmullRomCurve3(
      perimeterPoints.map((point) => new THREE.Vector3(point.x * 0.98, point.y * 0.98, 0.16)),
      true,
      'centripetal'
    );

    return new THREE.TubeGeometry(curve, Math.max(64, perimeterPoints.length * 2), 0.035, 12, true);
  }, [perimeterPoints]);

  useEffect(() => {
    return () => {
      geometry?.dispose();
    };
  }, [geometry]);

  useEffect(() => {
    return () => {
      rimGeometry?.dispose();
    };
  }, [rimGeometry]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    if (meshRef.current && points.length > 0) {
      // Combined Entry animation & pulse
      const scaleBase = interactionScale + Math.sin(t * 2) * 0.02;
      const targetScaleX = -scaleBase;
      const targetScaleY = scaleBase;
      const targetScaleZ = scaleBase;

      meshRef.current.scale.x = THREE.MathUtils.lerp(meshRef.current.scale.x, targetScaleX, 0.05);
      meshRef.current.scale.y = THREE.MathUtils.lerp(meshRef.current.scale.y, targetScaleY, 0.05);
      meshRef.current.scale.z = THREE.MathUtils.lerp(meshRef.current.scale.z, targetScaleZ, 0.05);

      // Positioning - generated center by default, then follow the hand during interaction.
      const center = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
      const len = points.length || 1;
      center.x /= len;
      center.y /= len;
      
      const targetWorldX = interactionPoint
        ? -(interactionPoint.x - 0.5) * viewport.width
        : -(center.x - 0.5) * viewport.width;
      const targetWorldY = interactionPoint
        ? -(interactionPoint.y - 0.5) * viewport.height
        : -(center.y - 0.5) * viewport.height;
      
      meshRef.current.position.x = THREE.MathUtils.lerp(meshRef.current.position.x, targetWorldX, interactionPoint ? 0.16 : 0.1);
      
      const flow = Math.sin(t * 0.5) * 0.02;
      meshRef.current.position.y = THREE.MathUtils.lerp(meshRef.current.position.y, targetWorldY + Math.sin(t) * 0.05 - flow, interactionPoint ? 0.16 : 0.1);
      
      meshRef.current.rotation.x = Math.sin(t * 0.3) * 0.03;
      meshRef.current.rotation.y = Math.cos(t * 0.3) * 0.03;

      if (interactionPoint) {
        // Interaction point also needs to be mirrored for 3D physics reaction
        const targetIX = -(interactionPoint.x - 0.5) * viewport.width; 
        const targetIY = -(interactionPoint.y - 0.5) * viewport.height;
        
        const dist = Math.sqrt(Math.pow(targetIX - meshRef.current.position.x, 2) + Math.pow(targetIY - meshRef.current.position.y, 2));
        if (dist < 1.5) {
          const force = (1.5 - dist) * 0.1;
          meshRef.current.rotation.y += (targetIX > meshRef.current.position.x ? 1 : -1) * force * 0.2;
          meshRef.current.rotation.x += (targetIY > meshRef.current.position.y ? 1 : -1) * force * 0.2;
        }
      }
    }
    
    if (materialRef.current) {
      materialRef.current.distortion = materialConfig.distortion + Math.sin(t) * 0.2;
      materialRef.current.temporalDistortion = interactionPoint ? 0.5 : 0.1;
    }
  });

  if (!geometry) return null;

  return (
    <group ref={meshRef} scale={[0.001, 0.001, 0.001]}> {/* Start small for entry animation, will lerp to mirrored -1 */}
      {/* Subtle glass mass: visible, but still transparent enough to feel like warped lensing. */}
      <mesh geometry={geometry} position={[0, 0, -0.04]}>
        <meshStandardMaterial
          color="#f8fbff"
          metalness={0}
          roughness={0.06}
          transparent
          opacity={0.12}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Main Melting Body - Viscous pale blue face */}
      <mesh geometry={geometry}>
        <MeshTransmissionMaterial
          ref={materialRef}
          backside
          samples={24}
          thickness={0.7}
          chromaticAberration={0.06}
          anisotropy={0.18}
          distortion={materialConfig.distortion * 0.45}
          distortionScale={0.22}
          temporalDistortion={0.16}
          clearcoat={1}
          clearcoatRoughness={0.02}
          attenuationDistance={2.2}
          attenuationColor="#ffffff"
          color="#ffffff"
          background={videoTexture}
          metalness={materialConfig.metalness}
          roughness={Math.min(materialConfig.roughness, 0.18)}
          transmission={1.0}
          ior={materialConfig.ior}
          opacity={0.38}
          transparent
        />
      </mesh>
      
      {/* Liquid chrome rim */}
      {rimGeometry && (
        <mesh geometry={rimGeometry}>
          <meshStandardMaterial
            color="#fff8ed"
            emissive="#ffd7a8"
            emissiveIntensity={0.45}
            metalness={0.75}
            roughness={0.08}
            envMapIntensity={3}
          />
        </mesh>
      )}
      
      {/* Classical Numbers & Hands */}
      <group position={[0, 0, 0.25]} scale={[-1, 1, 1]}>
        <Suspense fallback={null}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'].map((num, i) => {
            const val = i + 1;
            const angle = (val / 12) * Math.PI * 2;
            const index = Math.floor((1 - (angle / (Math.PI * 2))) * (perimeterPoints.length - 1));
            const point = perimeterPoints[index];
            if (!point) return null;
            
            return (
              <Text
                key={num}
                position={[point.x * 0.85, point.y * 0.85, 0.02]}
                scale={[-1, 1, 1]} // Un-mirror text inside mirrored group
                fontSize={0.16}
                color="#f9f3ea"
                anchorX="center"
                anchorY="middle"
                depthOffset={-1}
              >
                {num}
              </Text>
            );
          })}
        </Suspense>
        {/* Artistic Spade hands */}
        <group rotation={[0, 0, -Math.PI / 3.5]} scale={[-1, 1, 1]}>
           <mesh position={[0, 0.22, 0.01]}>
             <boxGeometry args={[0.015, 0.45, 0.01]} />
             <meshBasicMaterial color="#fff8ed" />
           </mesh>
           <mesh position={[0, 0.45, 0.01]}>
             <coneGeometry args={[0.03, 0.1, 12]} />
             <meshBasicMaterial color="#fff8ed" />
           </mesh>
        </group>
        <group rotation={[0, 0, -Math.PI / 1.8]} scale={[-1, 1, 1]}>
           <mesh position={[0, 0.35, 0.01]}>
             <boxGeometry args={[0.01, 0.7, 0.01]} />
             <meshBasicMaterial color="#fff8ed" />
           </mesh>
           <mesh position={[0, 0.7, 0.01]}>
             <coneGeometry args={[0.025, 0.1, 12]} />
             <meshBasicMaterial color="#fff8ed" />
           </mesh>
        </group>
        <mesh>
          <sphereGeometry args={[0.025, 16, 16]} />
          <meshBasicMaterial color="#fff8ed" />
        </mesh>
      </group>
    </group>
  );
}
