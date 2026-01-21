
import React, { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface FinishLineProps {
  spawnZ: number;
  hitLineZ: number;
  speed: number;
  onPassed: () => void;
}

const HORN_URL = 'https://raw.githubusercontent.com/A-Nasser-Unity/Game_Assets/main/Horn.ogg';

export const FinishLine: React.FC<FinishLineProps> = ({ spawnZ, hitLineZ, speed, onPassed }) => {
  const [currentZ, setCurrentZ] = useState(spawnZ);
  const passedRef = useRef(false);
  const hornPlayedRef = useRef(false);
  const hornSound = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    hornSound.current = new Audio(HORN_URL);
    hornSound.current.load();
  }, []);

  useFrame((_, delta) => {
    // Keep moving even after it's passed to create a "bypass" visual effect
    const newZ = currentZ + speed * delta;
    setCurrentZ(newZ);

    // Trigger logic for synchronization with the game end sequence (Hit Line crossing)
    if (newZ >= hitLineZ && !passedRef.current) {
      passedRef.current = true;
      onPassed();
    }

    // Trigger the Horn sound effect when the finish line passes the cars (Z = 0)
    if (newZ >= 0 && !hornPlayedRef.current) {
      hornPlayedRef.current = true;
      if (hornSound.current) {
        const playPromise = hornSound.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(e => console.debug("Horn audio playback delayed/blocked", e));
        }
      }
    }
  });

  return (
    <group position={[0, 0.05, currentZ]}>
      {/* Checkered Texture Strip */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, 1.5]} />
        <meshStandardMaterial 
          color="#ffffff" 
          emissive="#ffffff" 
          emissiveIntensity={0.2}
        />
      </mesh>

      {/* Checkered pattern details */}
      {[...Array(8)].map((_, i) => (
        <mesh 
          key={i} 
          position={[-5.25 + i * 1.5, 0.01, 0]} 
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[0.75, 1.5]} />
          <meshBasicMaterial color="#000000" />
        </mesh>
      ))}

      {/* Side Pillars */}
      <mesh position={[6.5, 2, 0]}>
        <boxGeometry args={[0.5, 4, 0.5]} />
        <meshStandardMaterial color="#00f2ff" emissive="#00f2ff" emissiveIntensity={2} />
      </mesh>
      <mesh position={[-6.5, 2, 0]}>
        <boxGeometry args={[0.5, 4, 0.5]} />
        <meshStandardMaterial color="#00f2ff" emissive="#00f2ff" emissiveIntensity={2} />
      </mesh>

      {/* Arch Header */}
      <mesh position={[0, 4.25, 0]}>
        <boxGeometry args={[13.5, 0.5, 0.5]} />
        <meshStandardMaterial color="#00f2ff" emissive="#00f2ff" emissiveIntensity={2} />
      </mesh>

      {/* Glow under line */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]}>
        <planeGeometry args={[12, 0.2]} />
        <meshBasicMaterial color="#00f2ff" />
      </mesh>
    </group>
  );
};
