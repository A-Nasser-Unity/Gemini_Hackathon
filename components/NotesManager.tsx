
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface Note {
  id: number;
  lane: number;
  z: number;
  color: string;
  willAiHit: boolean; 
  aiProcessed: boolean; // Tracks if AI already scored for this note
}

interface Particle {
  id: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  color: string;
  life: number; // 1.0 down to 0
  size: number;
}

interface NotesManagerProps {
  hitLineZ: number;
  config: {
    interval: number;
    speed: number;
    spawnZ: number;
  };
  pressedKeys: boolean[];
  onScoreUpdate: (amount: number) => void;
  onAiScoreUpdate: (amount: number) => void;
  isRacing: boolean;
  timeLeft: number;
}

const laneOffsets = [-3.7, -1.3, 1.3, 3.7];
const laneColors = [
  '#fffb00', // Yellow (Z)
  '#ff003c', // Red (C)
  '#0072ff', // Blue (ArrowLeft)
  '#00ff42'  // Green (ArrowRight)
];

const HIT_WINDOW = 0.8; // Z-axis tolerance for hitting a note
const HIT_SOUND_URL = 'https://raw.githubusercontent.com/A-Nasser-Unity/Game_Assets/main/drum-hitclap.mp3';
const MISS_SOUND_URL = 'https://raw.githubusercontent.com/A-Nasser-Unity/Game_Assets/main/Miss.mp3';

export const NotesManager: React.FC<NotesManagerProps> = ({ 
  hitLineZ, 
  config, 
  pressedKeys, 
  onScoreUpdate,
  onAiScoreUpdate,
  isRacing,
  timeLeft
}) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  
  const lastSpawnTime = useRef(0);
  const nextId = useRef(0);
  const nextParticleId = useRef(0);
  
  const hitSound = useRef<HTMLAudioElement | null>(null);
  const missSound = useRef<HTMLAudioElement | null>(null);

  // Soft circle texture for particles
  const particleTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
      gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.5)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 64, 64);
    }
    return new THREE.CanvasTexture(canvas);
  }, []);

  useEffect(() => {
    hitSound.current = new Audio(HIT_SOUND_URL);
    missSound.current = new Audio(MISS_SOUND_URL);
    hitSound.current.load();
    missSound.current.load();
  }, []);

  const playSound = (type: 'hit' | 'miss') => {
    const audio = type === 'hit' ? hitSound.current : missSound.current;
    if (audio) {
      const clone = audio.cloneNode() as HTMLAudioElement;
      clone.volume = 0.4;
      clone.play().catch(e => console.debug("Audio playback blocked", e));
    }
  };

  const spawnBurst = (lane: number, color: string) => {
    const burstCount = 15;
    const newParticles: Particle[] = [];
    const baseX = laneOffsets[lane];
    const baseZ = hitLineZ;
    const baseY = 0.2;

    for (let i = 0; i < burstCount; i++) {
      newParticles.push({
        id: nextParticleId.current++,
        x: baseX,
        y: baseY,
        z: baseZ,
        vx: (Math.random() - 0.5) * 2.5,
        vy: Math.random() * 4 + 2,
        vz: (Math.random() - 0.5) * 2.5,
        color: color,
        life: 1.0,
        size: Math.random() * 0.4 + 0.2
      });
    }
    setParticles(prev => [...prev, ...newParticles]);
  };

  const keysUsedThisFrame = useRef([false, false, false, false]);

  useFrame((state, delta) => {
    if (!isRacing) {
        // Even if not racing, we update particles for remaining effects
        if (particles.length > 0) {
            setParticles(prev => prev
              .map(p => ({
                ...p,
                x: p.x + p.vx * delta,
                y: p.y + p.vy * delta,
                z: p.z + p.vz * delta,
                life: p.life - delta * 1.5
              }))
              .filter(p => p.life > 0)
            );
        }
        return;
    }

    const currentTime = state.clock.getElapsedTime();
    keysUsedThisFrame.current = [false, false, false, false];

    const isNearEnd = timeLeft <= 3;
    // Updated: Consolidated 6s pause into a single 3s pause (at midpoint)
    const isMidRacePause = timeLeft <= 61 && timeLeft > 58;
    const canSpawn = timeLeft > 0 && !isNearEnd && !isMidRacePause;

    if (canSpawn && currentTime - lastSpawnTime.current > config.interval) {
      const hasPassed40Seconds = timeLeft <= 79;
      const isDoubleSpawn = hasPassed40Seconds && Math.random() < 0.20;

      const spawnLanes: number[] = [];
      if (isDoubleSpawn) {
        const lane1 = Math.floor(Math.random() * 4);
        const lane2 = (lane1 + 1 + Math.floor(Math.random() * 3)) % 4;
        spawnLanes.push(lane1, lane2);
      } else {
        spawnLanes.push(Math.floor(Math.random() * 4));
      }

      const newNotesToSpawn: Note[] = spawnLanes.map(lane => ({
        id: nextId.current++,
        lane: lane,
        z: config.spawnZ,
        color: laneColors[lane],
        willAiHit: Math.random() < 0.70,
        aiProcessed: false
      }));

      setNotes(prev => [...prev, ...newNotesToSpawn]);
      lastSpawnTime.current = currentTime;
    }

    // Movement and Collision logic
    setNotes(prev => {
      const nextNotes: Note[] = [];
      
      for (const note of prev) {
        let newZ = note.z + config.speed * delta;
        let keep = true;
        let currentAiProcessed = note.aiProcessed;

        const distanceToHitLine = Math.abs(newZ - hitLineZ);
        const inHitZone = distanceToHitLine < HIT_WINDOW;

        if (!currentAiProcessed && note.willAiHit && newZ >= hitLineZ) {
          onAiScoreUpdate(10);
          currentAiProcessed = true;
        }

        if (inHitZone && pressedKeys[note.lane] && !keysUsedThisFrame.current[note.lane]) {
          onScoreUpdate(10);
          playSound('hit');
          spawnBurst(note.lane, note.color);
          
          if (!currentAiProcessed && note.willAiHit) {
            onAiScoreUpdate(10);
            currentAiProcessed = true;
          }
          
          keysUsedThisFrame.current[note.lane] = true;
          keep = false;
        }

        if (keep && newZ > hitLineZ + HIT_WINDOW) {
          onScoreUpdate(-5);
          playSound('miss');
          keep = false;
        }

        if (keep) {
          nextNotes.push({ ...note, z: newZ, aiProcessed: currentAiProcessed });
        }
      }
      return nextNotes;
    });

    // Update Particles
    if (particles.length > 0) {
      setParticles(prev => prev
        .map(p => ({
          ...p,
          x: p.x + p.vx * delta,
          y: p.y + p.vy * delta,
          z: p.z + p.vz * delta,
          life: p.life - delta * 1.5 // Fade out speed
        }))
        .filter(p => p.life > 0)
      );
    }
  });

  return (
    <group>
      {/* Render Notes */}
      {notes.map(note => (
        <group key={note.id} position={[laneOffsets[note.lane], 0.1, note.z]} scale={[1.2, 1.2, 1.2]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.45, 32]} />
            <meshStandardMaterial 
              color={note.color} 
              emissive={note.color} 
              emissiveIntensity={4}
              transparent
              opacity={0.9}
            />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
            <torusGeometry args={[0.48, 0.03, 16, 32]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]}>
            <circleGeometry args={[0.5, 32]} />
            <meshBasicMaterial color="#000000" transparent opacity={0.3} />
          </mesh>
        </group>
      ))}

      {/* Render Particles */}
      {particles.map(p => (
        <mesh key={p.id} position={[p.x, p.y, p.z]} scale={[p.size, p.size, p.size]}>
          <planeGeometry />
          <meshBasicMaterial 
            map={particleTexture}
            color={p.color}
            transparent
            opacity={p.life * 0.8}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
};
