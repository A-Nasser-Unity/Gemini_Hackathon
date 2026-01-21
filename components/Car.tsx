
import React, { useRef, useEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

interface CarProps {
  modelUrl: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  color?: string;
  shadowOpacity?: number;
  shadowSize?: number;
}

export const Car: React.FC<CarProps> = ({ 
  modelUrl,
  position, 
  rotation = [0, 0, 0], 
  scale = 1, 
  color,
  shadowOpacity = 0.7,
  shadowSize = 1.0
}) => {
  const { scene } = useGLTF(modelUrl);
  
  // Clone scene so materials can be modified per-instance
  const clonedScene = useMemo(() => {
    const clone = scene.clone();
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material = mesh.material.map(m => m.clone());
          } else {
            mesh.material = mesh.material.clone();
          }
        }
      }
    });
    return clone;
  }, [scene]);

  // Create a procedural soft blob shadow texture
  const shadowTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      gradient.addColorStop(0, 'rgba(0, 0, 0, 1.0)'); // Use full black in gradient, let material handle overall opacity
      gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.5)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 128, 128);
    }
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }, []);

  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (!clonedScene) return;

    clonedScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        
        // No real-time shadows or reflections
        mesh.castShadow = false;
        mesh.receiveShadow = false;

        if (mesh.material) {
          const processMaterial = (mat: THREE.Material) => {
            if (mat instanceof THREE.MeshStandardMaterial) {
              const matName = (mat.name || "").toLowerCase();
              const meshName = (mesh.name || "").toLowerCase();

              // Material Recognition Logic
              const isGlass = matName.includes('glass') || 
                             matName.includes('window') || 
                             meshName.includes('glass') ||
                             meshName.includes('window') ||
                             mat.transparent === true;

              const isWheel = matName.includes('tire') || 
                              matName.includes('wheel') || 
                              matName.includes('rubber') || 
                              meshName.includes('wheel') ||
                              meshName.includes('tire');

              const isTailLight = matName.includes('tail') || 
                                 matName.includes('back') || 
                                 matName.includes('brake') || 
                                 matName.includes('rear') ||
                                 matName.includes('red_light') ||
                                 meshName.includes('tail') || 
                                 meshName.includes('back') ||
                                 meshName.includes('brake') ||
                                 meshName.includes('rear');

              const isLight = isTailLight ||
                              matName.includes('light') || 
                              matName.includes('glow') || 
                              matName.includes('lamp') ||
                              (mat.emissive && mat.emissive.getHex() > 0);

              const isInterior = matName.includes('interior') || 
                                matName.includes('seat') ||
                                matName.includes('dash');

              // Flat look settings
              mat.envMapIntensity = 0;
              mat.metalness = 0;
              mat.roughness = 1;

              if (isGlass) {
                mat.color.set('#000000');
                mat.transparent = true;
                mat.opacity = 0.8;
              } else if (isWheel) {
                mat.color.set('#1a1a1a'); 
              } else if (isTailLight) {
                mat.color.set('#ff0000');
                mat.emissive.set('#ff0000');
                mat.emissiveIntensity = 3.0;
                mat.transparent = false;
                mat.opacity = 1.0;
              } else if (isLight) {
                mat.emissiveIntensity = 1.0;
              } else if (!isInterior) {
                if (color) {
                  mat.color.set(color);
                }
              }

              mat.needsUpdate = true;
            }
          };

          if (Array.isArray(mesh.material)) {
            mesh.material.forEach(processMaterial);
          } else {
            processMaterial(mesh.material);
          }
        }
      }
    });
  }, [clonedScene, color]);

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* Blob Shadow Image - Positioned at road level */}
      <mesh 
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, 0.015, 0]} 
        scale={[2.8 * shadowSize, 5.0 * shadowSize, 1]}
      >
        <planeGeometry />
        <meshBasicMaterial 
          map={shadowTexture} 
          transparent={true} 
          depthWrite={false}
          opacity={shadowOpacity}
        />
      </mesh>

      <primitive 
        ref={groupRef}
        object={clonedScene} 
      />
    </group>
  );
};

// Preload common assets using jsDelivr CDN to avoid CORS issues
useGLTF.preload('https://cdn.jsdelivr.net/gh/A-Nasser-Unity/Game_Assets@main/CarA.glb');
useGLTF.preload('https://cdn.jsdelivr.net/gh/A-Nasser-Unity/Game_Assets@main/Car1.glb');
