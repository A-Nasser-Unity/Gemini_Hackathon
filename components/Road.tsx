
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

interface RoadProps {
  scrollSpeed: number;
  isRacing: boolean;
  raceId: number;
}

export const Road: React.FC<RoadProps> = ({ scrollSpeed, isRacing, raceId }) => {
  const roadWidth = 12;
  const roadLength = 1000;

  // 1. Main Metallic Texture
  const mainTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#444444';
      ctx.fillRect(0, 0, 512, 512);

      for (let i = 0; i < 2000; i++) {
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.05})`;
        ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
      }

      ctx.fillStyle = '#333333';
      ctx.fillRect(0, 0, 60, 512);
      ctx.fillRect(452, 0, 60, 512);

      ctx.strokeStyle = '#222222';
      ctx.lineWidth = 4;
      for (let y = 0; y <= 512; y += 128) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(512, y);
        ctx.stroke();
      }

      ctx.strokeStyle = '#555555';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(250, 0); ctx.lineTo(250, 512);
      ctx.moveTo(262, 0); ctx.lineTo(262, 512);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 100);
    return tex;
  }, []);

  // 2. Emissive Texture (Golden bars)
  const emissiveTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, 512, 512);

      ctx.fillStyle = '#b8860b';
      const barHeight = 80;
      const gap = 48;
      const barWidth = 15;
      
      for (let y = gap/2; y < 512; y += (barHeight + gap)) {
        ctx.fillRect(22.5, y, barWidth, barHeight);
        ctx.fillRect(474.5, y, barWidth, barHeight);
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 100);
    return tex;
  }, []);

  // 3. Random Road Line Colors (Re-calculated on Replay/Race Start)
  const lineColors = useMemo(() => {
    const getRandomNeon = () => {
      // Pick a random vibrant hue, full saturation, and 0.5 lightness for neon look
      const color = new THREE.Color().setHSL(Math.random(), 1, 0.5);
      return color.getStyle();
    };

    return {
      side: getRandomNeon(),
      mid: getRandomNeon(),
    };
  }, [raceId]);

  useFrame((state, delta) => {
    if (isRacing) {
      const step = delta * scrollSpeed * 0.5;
      mainTexture.offset.y += step;
      emissiveTexture.offset.y += step;
    }
  });

  return (
    <group position={[0, 0, -roadLength / 2 + 10]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[roadWidth, roadLength]} />
        <meshStandardMaterial 
          map={mainTexture}
          emissiveMap={emissiveTexture}
          emissive="#ffffff"
          emissiveIntensity={2}
          roughness={1} 
          metalness={0}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Far Right Line */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[roadWidth / 2 + 0.1, 0.01, 0]}>
        <planeGeometry args={[0.2, roadLength]} />
        <meshStandardMaterial color={lineColors.side} emissive={lineColors.side} emissiveIntensity={1} />
      </mesh>
      
      {/* Far Left Line */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-roadWidth / 2 - 0.1, 0.01, 0]}>
        <planeGeometry args={[0.2, roadLength]} />
        <meshStandardMaterial color={lineColors.side} emissive={lineColors.side} emissiveIntensity={1} />
      </mesh>

      {/* Middle Thin Line */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[0.06, roadLength]} />
        <meshStandardMaterial color={lineColors.mid} emissive={lineColors.mid} emissiveIntensity={2} />
      </mesh>

      <gridHelper 
        args={[roadLength, 150, 0x44aaff, 0x0a1122]} 
        rotation={[Math.PI / 2, 0, 0]} 
        position={[0, 0.005, 0]}
      />
    </group>
  );
};
