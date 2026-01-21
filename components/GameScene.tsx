
import React, { Suspense, useMemo, useRef } from 'react';
import { Road } from './Road';
import { Car } from './Car';
import { HitZone } from './HitZone';
import { NotesManager } from './NotesManager';
import { FinishLine } from './FinishLine';
import { PerspectiveCamera } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface GameSceneProps {
  cameraPosition: [number, number, number];
  cameraRotation: [number, number, number];
  scrollSpeed: number;
  carScale: number;
  carPos: [number, number, number];
  shadowOpacity: number;
  shadowSize: number;
  fov: number;
  hitLineZ: number;
  pressedKeys: boolean[];
  isRacing: boolean;
  timeLeft: number;
  isGameFinished: boolean;
  onFinishPassed: () => void;
  noteConfig: {
    interval: number;
    speed: number;
    spawnZ: number;
  };
  onScoreUpdate: (amount: number) => void;
  onAiScoreUpdate: (amount: number) => void;
  playerScore: number;
  aiScore: number;
  onPlayerZUpdate?: (z: number) => void;
  onAiZUpdate?: (z: number) => void;
  raceId: number;
}

const BackgroundStars = () => {
  const count = 10000;
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const side = Math.random() > 0.5 ? 1 : -1;
      pos[i * 3] = side * (25 + Math.random() * 250); 
      pos[i * 3 + 1] = (Math.random() - 0.2) * 250; 
      pos[i * 3 + 2] = -Math.random() * 700 - 100;
    }
    return pos;
  }, []);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.35}
        color="#ffffff"
        transparent
        opacity={0.7}
        sizeAttenuation={true}
        depthWrite={false}
      />
    </points>
  );
};

export const GameScene: React.FC<GameSceneProps> = ({ 
  cameraPosition, 
  cameraRotation, 
  scrollSpeed, 
  carScale,
  carPos,
  shadowOpacity,
  shadowSize,
  fov,
  hitLineZ,
  pressedKeys,
  isRacing,
  timeLeft,
  isGameFinished,
  onFinishPassed,
  noteConfig,
  onScoreUpdate,
  onAiScoreUpdate,
  playerScore,
  aiScore,
  onPlayerZUpdate,
  onAiZUpdate,
  raceId
}) => {
  const radRotation: [number, number, number] = [
    (cameraRotation[0] * Math.PI) / 180,
    (cameraRotation[1] * Math.PI) / 180,
    (cameraRotation[2] * Math.PI) / 180
  ];

  // Scoring-based positioning refs
  const playerZ = useRef(0);
  const aiZ = useRef(0);
  const maxScoreDiff = 200;
  // UPDATED: Dynamic range set to 1.2 as requested
  const maxZOffset = 1.2;
  const minZOffset = -1.2;
  const carMoveSpeed = 3;

  useFrame((_, delta) => {
    // 1. Calculate Score Difference
    const scoreDiff = playerScore - aiScore;
    
    // 2. Normalize and Clamp Difference (-1 to 1)
    const normalizedDiff = Math.max(-1, Math.min(1, scoreDiff / maxScoreDiff));

    // 3. Determine Target Z positions
    // When player leads (diff > 0), playerTargetZ moves toward maxZOffset, aiTargetZ moves toward minZOffset
    const playerTargetZ = normalizedDiff * maxZOffset;
    const aiTargetZ = -normalizedDiff * maxZOffset;

    // 4. Smoothly Interpolate Z positions
    playerZ.current = THREE.MathUtils.lerp(playerZ.current, playerTargetZ, delta * carMoveSpeed);
    aiZ.current = THREE.MathUtils.lerp(aiZ.current, aiTargetZ, delta * carMoveSpeed);

    // 5. Report positions back to UI
    onPlayerZUpdate?.(playerZ.current);
    onAiZUpdate?.(aiZ.current);
  });

  return (
    <>
      <ambientLight intensity={1.5} />
      
      <color attach="background" args={['#010413']} />
      <fog attach="fog" args={['#010413', 30, 250]} />

      <BackgroundStars />

      <PerspectiveCamera
        makeDefault
        position={cameraPosition}
        rotation={radRotation}
        fov={fov}
      />

      <Road scrollSpeed={scrollSpeed} isRacing={isRacing} raceId={raceId} />

      <Suspense fallback={null}>
        <HitZone position={[0, 0.05, hitLineZ]} pressedKeys={pressedKeys} />

        <NotesManager 
          hitLineZ={hitLineZ}
          config={noteConfig}
          pressedKeys={pressedKeys}
          onScoreUpdate={onScoreUpdate}
          onAiScoreUpdate={onAiScoreUpdate}
          isRacing={isRacing}
          timeLeft={timeLeft}
        />

        {timeLeft === 0 && !isGameFinished && (
          <FinishLine 
            spawnZ={-150} 
            hitLineZ={hitLineZ} 
            speed={noteConfig.speed * 2.5} 
            onPassed={onFinishPassed} 
          />
        )}

        {/* Using CDN URLs for models to ensure they load reliably */}
        <Car 
          modelUrl="https://cdn.jsdelivr.net/gh/A-Nasser-Unity/Game_Assets@main/CarA.glb"
          position={[carPos[0], carPos[1], playerZ.current]} 
          scale={carScale} 
          rotation={[0, Math.PI, 0]} 
          shadowOpacity={shadowOpacity}
          shadowSize={shadowSize}
        />
        
        <Car 
          modelUrl="https://cdn.jsdelivr.net/gh/A-Nasser-Unity/Game_Assets@main/Car1.glb"
          position={[-carPos[0], carPos[1], aiZ.current]} 
          scale={carScale} 
          rotation={[0, Math.PI, 0]} 
          shadowOpacity={shadowOpacity}
          shadowSize={shadowSize}
        />
      </Suspense>
    </>
  );
};
