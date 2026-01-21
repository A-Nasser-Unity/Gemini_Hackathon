
import React from 'react';

interface HitZoneProps {
  position: [number, number, number];
  pressedKeys: boolean[];
}

export const HitZone: React.FC<HitZoneProps> = ({ position, pressedKeys }) => {
  const roadWidth = 12;
  const buttonXOffsets = [-3.7, -1.3, 1.3, 3.7];
  
  const buttonColors = [
    '#fffb00', // Yellow (Z) - Far Left
    '#ff003c', // Red (C) - Left
    '#0072ff', // Blue (ArrowLeft) - Right
    '#00ff42'  // Green (ArrowRight) - Far Right
  ];

  return (
    <group position={position}>
      {/* Horizontal Hit Line */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <planeGeometry args={[roadWidth, 0.15]} />
        <meshStandardMaterial 
          color="#00f2ff" 
          emissive="#00f2ff" 
          emissiveIntensity={6} 
          transparent={true}
          opacity={0.8}
        />
      </mesh>

      {/* 3D Mechanical Buttons (Scaled 20% in X,Z axis) */}
      {buttonXOffsets.map((x, index) => {
        const isPressed = pressedKeys[index];
        const height = 0.3; // Scaling the buttons in Y axis to 0.3 units (Keep original Y)
        
        return (
          <group key={index} position={[x, 0, 0]}>
            
            {/* 1. The Fixed Rim (Scaled 20% in World X,Z) */}
            <mesh 
              rotation={[Math.PI / 2, 0, 0]} 
              position={[0, 0.05, 0]} 
              scale={[1.2, 1.2, 2.5]} // 1.2 for X/Y local (World X/Z), 2.5 for local Z (World Y thickness)
            >
              <torusGeometry args={[0.55, 0.03, 16, 48]} />
              <meshStandardMaterial 
                color="#ffffff" 
                emissive={buttonColors[index]} 
                emissiveIntensity={isPressed ? 15 : 5} 
                roughness={0.2}
                metalness={0.8}
              />
            </mesh>
            
            {/* 2. The Interactive Plunger (Scaled 20% in World X,Z) */}
            <mesh position={[0, isPressed ? 0.05 : 0.15, 0]} scale={[1.2, 1, 1.2]}>
              <cylinderGeometry args={[0.48, 0.48, height, 32]} />
              <meshStandardMaterial 
                color={buttonColors[index]} 
                emissive={buttonColors[index]} 
                emissiveIntensity={isPressed ? 10 : 3} 
                transparent={true}
                opacity={0.9}
                roughness={0.1}
              />
            </mesh>

            {/* 3. Base Shadow Glow (Scaled 20% in World X,Z) */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} scale={[1.2, 1.2, 1]}>
              <circleGeometry args={[0.65, 32]} />
              <meshBasicMaterial 
                color={buttonColors[index]} 
                transparent 
                opacity={isPressed ? 0.5 : 0.2} 
              />
            </mesh>

            {/* 4. Directional visual marker (Scaled 20% in World X,Z) */}
            <mesh position={[0, 0.005, 0.7]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.2, 1.2, 1]}>
               <planeGeometry args={[0.3, 0.06]} />
               <meshBasicMaterial 
                 color={buttonColors[index]} 
                 transparent 
                 opacity={isPressed ? 1.0 : 0.5} 
               />
            </mesh>

          </group>
        );
      })}
    </group>
  );
};
