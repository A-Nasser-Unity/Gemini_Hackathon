# 🏁 Rhythm Race 3D

A high-octane 3D rhythm racing game built for the Gemini API Developer Competition. Experience a cyber-industrial race track where your speed is determined by your rhythm, and the atmosphere is powered by real-time AI.

## 🚀 Features

- **Rhythm-Based Racing**: Hit notes in 4 lanes to maintain speed and outpace a rival AI.
- **Dynamic 3D Environment**: High-fidelity Three.js scene with neon aesthetics, procedural starfields, and real-time lighting.
- **Adaptive Difficulty**: Note speed and spawn rates ramp up as the race progresses.
- **Leaderboard Logic**: Real-time scoring system that physically shifts the cars' positions on the Z-axis based on the score gap.

## 🤖 Gemini API Integration

This project leverages the **Gemini 3 Flash Preview** model to create a living world:

1.  **Cyber Announcer (Text-to-Speech)**:
    - Uses Gemini to generate context-aware, energetic commentary based on current race stats (winning/losing/score diff).
    - The commentary is synthesized into high-quality audio using Gemini's native TTS capabilities (`Modality.AUDIO`).
    - Implements quota-aware error handling to ensure smooth performance.

2.  **Live News Loading Screen (Search Grounding)**:
    - During the loading phase, Gemini uses **Google Search Grounding** to fetch a real-world trending headline about anime, movies, or gaming.
    - Provides a "Live Global Feed" experience, making every race feel connected to current events.
    - Includes grounding metadata URLs for source transparency.

## 🛠️ Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS
- **3D Engine**: Three.js, @react-three/fiber, @react-three/drei
- **AI/ML**: @google/genai (Gemini 3 Flash Preview)
- **Audio**: Web Audio API for rhythm hits and background music

## 🎮 How to Play

1. Enter your Pilot Name and launch the race.
2. Use keys **Z, C, Left Arrow, and Right Arrow** to hit the corresponding notes.
3. Keep your score higher than the Rival AI to take the lead.
4. Listen to the AI Announcer for real-time feedback on your performance!

---

*Built for the Gemini API Developer Competition.*