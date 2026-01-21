
import React, { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { useProgress } from '@react-three/drei';
import { GameScene } from './components/GameScene';
import { GoogleGenAI, Modality } from "@google/genai";

type Scene = 'MAIN' | 'LOADING' | 'RACE';

const RACE_TRACKS = [
  'https://raw.githubusercontent.com/A-Nasser-Unity/Game_Assets/main/Alkome.ogg',
  'https://raw.githubusercontent.com/A-Nasser-Unity/Game_Assets/main/Astronaut.ogg',
  'https://raw.githubusercontent.com/A-Nasser-Unity/Game_Assets/main/Queen_Bee.ogg'
];

const RESULT_SOUNDS = {
  WIN: 'https://raw.githubusercontent.com/A-Nasser-Unity/Game_Assets/main/Win.ogg',
  LOSE: 'https://raw.githubusercontent.com/A-Nasser-Unity/Game_Assets/main/Lose.ogg',
  DRAW: 'https://raw.githubusercontent.com/A-Nasser-Unity/Game_Assets/main/Draw.ogg'
};

// CDN URLs for models to avoid CORS issues
const MODEL_PLAYER = 'https://cdn.jsdelivr.net/gh/A-Nasser-Unity/Game_Assets@main/CarA.glb';
const MODEL_AI = 'https://cdn.jsdelivr.net/gh/A-Nasser-Unity/Game_Assets@main/Car1.glb';

function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2);
  const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < dataInt16.length; i++) {
    channelData[i] = dataInt16[i] / 32768.0;
  }
  return buffer;
}

interface LoadingScreenProps {
  onFinished: () => void;
  isAudioReady: boolean;
  news: string;
  sourceUrl?: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ onFinished, isAudioReady, news, sourceUrl }) => {
  const { active, progress, total, loaded } = useProgress();
  const isAssetsReady = !active || (total > 0 && loaded === total);
  const isReady = isAssetsReady && isAudioReady && news !== "INITIALIZING...";

  useEffect(() => {
    if (isReady) {
      const timer = setTimeout(onFinished, 2000);
      return () => clearTimeout(timer);
    }
  }, [isReady, onFinished]);

  return (
    <div className="w-screen h-screen bg-[#020617] flex flex-col items-center justify-center relative overflow-hidden font-['Orbitron'] p-8">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500 rounded-full blur-[150px]"></div>
      </div>
      <div className="z-10 text-center max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="mb-8">
          <div className="inline-block px-3 py-1 border border-blue-500/30 rounded text-[10px] text-blue-400 uppercase tracking-widest mb-4">
            Live Global Feed
          </div>
          <h2 className="text-white text-xl md:text-2xl font-bold italic leading-relaxed">
            {news}
          </h2>
          {sourceUrl && (
            <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 mt-2 block hover:underline">
              Source: {new URL(sourceUrl).hostname}
            </a>
          )}
        </div>
        <div className="w-64 h-1 bg-gray-800 rounded-full overflow-hidden mx-auto mb-4">
          <div className="h-full bg-blue-500 transition-all duration-300 shadow-[0_0_10px_#3b82f6]" style={{ width: `${progress}%` }}></div>
        </div>
        <div className="text-blue-500/50 text-[10px] uppercase tracking-[0.5em] animate-pulse">
          {isReady ? 'SYNCHRONIZATION COMPLETE' : `UPDATING NEWS ${Math.round(progress)}%`}
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [currentScene, setCurrentScene] = useState<Scene>('MAIN');
  const [playerName, setPlayerName] = useState('');
  const [playerScore, setPlayerScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [playerCarZ, setPlayerCarZ] = useState(0);
  const [aiCarZ, setAiCarZ] = useState(0);
  const [isScorePenaltyActive, setIsScorePenaltyActive] = useState(false);
  const [pressedKeys, setPressedKeys] = useState([false, false, false, false]);
  const [hudVisible, setHudVisible] = useState(true);
  const [isRacing, setIsRacing] = useState(false);
  const [countdownImg, setCountdownImg] = useState<string | null>(null);
  const [scrollSpeed, setScrollSpeed] = useState(0);
  const [noteSpeed, setNoteSpeed] = useState(35);
  const [spawnInterval, setSpawnInterval] = useState(0.8);
  const [timeLeft, setTimeLeft] = useState(119); 
  const [gameResult, setGameResult] = useState<'WIN' | 'LOSE' | 'DRAW' | null>(null);
  const [isGameFinished, setIsGameFinished] = useState(false);
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [aiCommentary, setAiCommentary] = useState<string>("SYSTEMS ONLINE.");
  const [loadingNews, setLoadingNews] = useState<string>("INITIALIZING...");
  const [newsSource, setNewsSource] = useState<string | undefined>(undefined);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [randomCommentaryTimes, setRandomCommentaryTimes] = useState<number[]>([]);
  const [commentaryHistory, setCommentaryHistory] = useState<string[]>([]);
  const [isMenuMusicMuted, setIsMenuMusicMuted] = useState(false);
  const [isQuotaExhausted, setIsQuotaExhausted] = useState(false);
  const [raceId, setRaceId] = useState(0);

  const countdownAudio = useRef<HTMLAudioElement | null>(null);
  const menuAudio = useRef<HTMLAudioElement | null>(null);
  const raceAudio = useRef<HTMLAudioElement | null>(null);
  const winAudio = useRef<HTMLAudioElement | null>(null);
  const loseAudio = useRef<HTMLAudioElement | null>(null);
  const drawAudio = useRef<HTMLAudioElement | null>(null);
  const scorePenaltyTimeout = useRef<number | null>(null);
  const ttsAudioContext = useRef<AudioContext | null>(null);
  const currentTtsSource = useRef<AudioBufferSourceNode | null>(null);
  const quotaTimeoutRef = useRef<number | null>(null);
  const lastCommentaryTime = useRef<number>(0);

  const stopAllVoice = useCallback(() => {
    if (currentTtsSource.current) {
      try {
        currentTtsSource.current.stop();
      } catch (e) {}
      currentTtsSource.current = null;
    }
    setIsAiThinking(false);
  }, []);

  const speakCommentary = async (rawPrompt: string, pScore: number, rScore: number) => {
    if (isQuotaExhausted) return;
    
    const now = Date.now();
    // Throttle to 15s to protect quota
    if (now - lastCommentaryTime.current < 15000) return;
    lastCommentaryTime.current = now;

    stopAllVoice();
    setIsAiThinking(true);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const historyStr = commentaryHistory.length > 0 ? `Don't repeat: ${commentaryHistory.join(', ')}.` : '';
      
      const leadStatus = pScore > rScore ? "WINNING" : pScore < rScore ? "LOSING" : "TIED";
      const scoreDiff = Math.abs(pScore - rScore);

      const systemPrompt = `
        Persona: Energetic, cutthroat cyber-race announcer.
        Context: ${rawPrompt}
        Stats: ${playerName} ${pScore}, Rival ${rScore}.
        Status: ${playerName} is ${leadStatus} by ${scoreDiff}.
        Limit: 4 words max.
        ${historyStr}
      `;
      
      const textResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: systemPrompt,
      });
      
      const commentaryText = textResponse.text?.replace(/"/g, '').trim() || "Push the limit!";
      setAiCommentary(commentaryText);
      setCommentaryHistory(prev => [...prev, commentaryText].slice(-10));

      const ttsResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts: [{ text: `Announce: ${commentaryText}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
        },
      });

      const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (base64Audio) {
        if (!ttsAudioContext.current) {
          ttsAudioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        const ctx = ttsAudioContext.current;
        if (ctx.state === 'suspended') await ctx.resume();
        
        const audioBuffer = await decodeAudioData(decodeBase64(base64Audio), ctx);
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        
        currentTtsSource.current = source;
        source.onended = () => {
          if (currentTtsSource.current === source) {
            currentTtsSource.current = null;
          }
        };
        source.start();
      }
    } catch (error: any) {
      console.error("Commentary Error:", error);
      
      const isQuotaError = 
        error?.status === 'RESOURCE_EXHAUSTED' || 
        error?.message?.includes('429') || 
        JSON.stringify(error).includes('429');

      if (isQuotaError) {
        setIsQuotaExhausted(true);
        setAiCommentary("NEURAL LINK SATURATED.");
        
        if (quotaTimeoutRef.current) window.clearTimeout(quotaTimeoutRef.current);
        quotaTimeoutRef.current = window.setTimeout(() => {
          setIsQuotaExhausted(false);
          setAiCommentary("LINK RESTORED.");
        }, 60000);
      } else {
        setAiCommentary("DATA STREAM ERROR.");
      }
    } finally {
      setIsAiThinking(false);
    }
  };

  const fetchLoadingNews = async () => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: "One short exciting headline about anime, movies or games today. Max 15 words.",
        config: { tools: [{ googleSearch: {} }] },
      });
      setLoadingNews(response.text || "NO NEW DATA.");
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks?.[0]?.web?.uri) setNewsSource(chunks[0].web.uri);
    } catch (error) {
      setLoadingNews("SATELLITE OFFLINE.");
    }
  };

  useEffect(() => {
    countdownAudio.current = new Audio('https://raw.githubusercontent.com/A-Nasser-Unity/Game_Assets/main/Coundown.mp3');
    menuAudio.current = new Audio('https://raw.githubusercontent.com/A-Nasser-Unity/Game_Assets/main/Menu2.mp3');
    menuAudio.current.loop = true;
    winAudio.current = new Audio(RESULT_SOUNDS.WIN);
    loseAudio.current = new Audio(RESULT_SOUNDS.LOSE);
    drawAudio.current = new Audio(RESULT_SOUNDS.DRAW);
    
    return () => {
      [menuAudio, countdownAudio, raceAudio, winAudio, loseAudio, drawAudio].forEach(ref => {
        if (ref.current) { ref.current.pause(); ref.current.src = ""; }
      });
      if (ttsAudioContext.current) ttsAudioContext.current.close();
      if (quotaTimeoutRef.current) window.clearTimeout(quotaTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (currentScene === 'MAIN') {
      stopAllVoice();
      setAiCommentary("SYSTEMS ONLINE.");
      [countdownAudio, raceAudio, winAudio, loseAudio, drawAudio].forEach(ref => {
        if (ref.current) { ref.current.pause(); ref.current.currentTime = 0; }
      });
      if (menuAudio.current) {
        menuAudio.current.volume = isMenuMusicMuted ? 0 : 1;
        menuAudio.current.play().catch(() => {});
      }
      setCommentaryHistory([]); 
    } else {
      menuAudio.current?.pause();
    }
  }, [currentScene, isMenuMusicMuted, stopAllVoice]);

  useEffect(() => {
    if (gameResult) {
      const audio = gameResult === 'WIN' ? winAudio.current : gameResult === 'LOSE' ? loseAudio.current : drawAudio.current;
      audio?.play().catch(() => {});
      speakCommentary(`Race Finished: ${gameResult}.`, playerScore, aiScore);
    }
  }, [gameResult]);

  useEffect(() => {
    if (!isRacing || timeLeft <= 5) return;
    
    if (randomCommentaryTimes.includes(timeLeft)) {
      speakCommentary(`Update at ${timeLeft}s.`, playerScore, aiScore);
      setRandomCommentaryTimes(prev => prev.filter(t => t !== timeLeft));
    }
  }, [isRacing, timeLeft, randomCommentaryTimes, playerScore, aiScore]);

  const resetGameState = useCallback(() => {
    setPlayerScore(0);
    setAiScore(0);
    setPlayerCarZ(0);
    setAiCarZ(0);
    setIsScorePenaltyActive(false);
    setPressedKeys([false, false, false, false]);
    setIsRacing(false);
    setCountdownImg(null);
    setScrollSpeed(0);
    setNoteSpeed(35);
    setSpawnInterval(0.8);
    setTimeLeft(119);
    setGameResult(null);
    setIsGameFinished(false);
    setAiCommentary(isQuotaExhausted ? "RECALIBRATING..." : "READY.");
    setCommentaryHistory([]); 
    setRaceId(prev => prev + 1);

    if (raceAudio.current) {
        raceAudio.current.pause();
        raceAudio.current.currentTime = 0;
    }

    const count = Math.floor(Math.random() * 3) + 3; 
    const times: number[] = [];
    while(times.length < count) {
      const r = Math.floor(Math.random() * 100) + 10;
      if (!times.includes(r)) times.push(r);
    }
    setRandomCommentaryTimes(times);
  }, [isQuotaExhausted]);

  const handleStartRequest = () => {
    if (!playerName.trim()) return;
    const randomTrack = RACE_TRACKS[Math.floor(Math.random() * RACE_TRACKS.length)];
    setIsAudioReady(false);
    const audio = new Audio(randomTrack);
    audio.addEventListener('canplaythrough', () => setIsAudioReady(true), { once: true });
    audio.load();
    raceAudio.current = audio;
    
    setLoadingNews("INITIALIZING...");
    fetchLoadingNews();
    setCurrentScene('LOADING');
  };

  const handleLoadingFinished = () => {
    setCurrentScene('RACE');
    resetGameState();
    speakCommentary(`Pilot ${playerName} online.`, 0, 0);
  };

  useEffect(() => {
    if (currentScene !== 'RACE') return;
    const timers: number[] = [];
    // Reset visual state before countdown
    setCountdownImg(null);
    setIsRacing(false);

    const startSequence = setTimeout(() => {
      countdownAudio.current?.play().catch(() => {});
      setCountdownImg('https://raw.githubusercontent.com/A-Nasser-Unity/Game_Assets/main/3.png');
      timers.push(window.setTimeout(() => setCountdownImg('https://raw.githubusercontent.com/A-Nasser-Unity/Game_Assets/main/2.png'), 1000));
      timers.push(window.setTimeout(() => setCountdownImg('https://raw.githubusercontent.com/A-Nasser-Unity/Game_Assets/main/1.png'), 2000));
      timers.push(window.setTimeout(() => setCountdownImg('https://raw.githubusercontent.com/A-Nasser-Unity/Game_Assets/main/Go.png'), 3000));
      timers.push(window.setTimeout(() => {
        setCountdownImg(null);
        setIsRacing(true);
        if (raceAudio.current) {
            raceAudio.current.currentTime = 0;
            raceAudio.current.play().catch(() => {});
        }
      }, 4000));
    }, 3000);
    return () => timers.forEach(t => clearTimeout(t));
  }, [currentScene, raceId]);

  useEffect(() => {
    if (!isRacing || timeLeft <= 0) return;
    const intervalId = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(intervalId);
  }, [isRacing, timeLeft]);

  useEffect(() => {
    if (!isRacing) return;
    let startTimestamp: number | null = null;
    let animationFrame: number;
    const rampSpeed = (time: number) => {
      if (!startTimestamp) startTimestamp = time;
      const elapsed = time - startTimestamp;
      setScrollSpeed(Math.min(elapsed / 7000, 1) * 10);
      const progression = Math.min(elapsed / 80000, 1);
      setNoteSpeed(35 + (progression * 25));
      setSpawnInterval(0.8 - (progression * 0.3));
      animationFrame = requestAnimationFrame(rampSpeed);
    };
    animationFrame = requestAnimationFrame(rampSpeed);
    return () => cancelAnimationFrame(animationFrame);
  }, [isRacing]);

  useEffect(() => {
    if (currentScene !== 'RACE' || isGameFinished) return;
    const handleKey = (e: KeyboardEvent, isDown: boolean) => {
      let index = -1;
      if (e.code === 'KeyZ') index = 0;
      if (e.code === 'KeyC') index = 1;
      if (e.code === 'ArrowLeft') index = 2;
      if (e.code === 'ArrowRight') index = 3;
      if (index !== -1) setPressedKeys(prev => {
        if (prev[index] === isDown) return prev;
        const next = [...prev]; next[index] = isDown; return next;
      });
    };
    const down = (e: KeyboardEvent) => handleKey(e, true);
    const up = (e: KeyboardEvent) => handleKey(e, false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [currentScene, isGameFinished, isRacing]);

  const handleFinishLinePassed = useCallback(() => {
    setTimeout(() => {
      setIsGameFinished(true);
      setIsRacing(false);
      setScrollSpeed(0);
      if (raceAudio.current) raceAudio.current.pause();
      if (playerScore > aiScore) setGameResult('WIN');
      else if (aiScore > playerScore) setGameResult('LOSE');
      else setGameResult('DRAW');
    }, 3000);
  }, [playerScore, aiScore]);

  const handleScoreUpdate = useCallback((amt: number) => {
    setPlayerScore(p => Math.max(0, p + amt));
    if (amt < 0) {
      setIsScorePenaltyActive(true);
      if (scorePenaltyTimeout.current) window.clearTimeout(scorePenaltyTimeout.current);
      scorePenaltyTimeout.current = window.setTimeout(() => setIsScorePenaltyActive(false), 200);
    }
  }, []);

  const handleExitToMain = () => {
    setCurrentScene('MAIN');
  };

  if (currentScene === 'MAIN') {
    return (
      <div className="w-screen h-screen bg-[#020617] flex flex-col items-center justify-center relative overflow-hidden font-['Orbitron']">
        <div className="absolute top-6 right-6 z-[100]">
          <button 
            onClick={() => setIsMenuMusicMuted(!isMenuMusicMuted)}
            className={`flex items-center gap-2 px-3 py-1.5 border transition-all duration-300 ${isMenuMusicMuted ? 'border-red-500/50 bg-red-950/20 text-red-500' : 'border-blue-500/50 bg-blue-950/20 text-blue-400'}`}
          >
            <div className={`w-2 h-2 rounded-full ${isMenuMusicMuted ? 'bg-red-500' : 'bg-blue-400 animate-pulse'}`}></div>
            <span className="text-[10px] font-black tracking-[0.2em] uppercase">
              {isMenuMusicMuted ? 'Music: Off' : 'Music: On'}
            </span>
          </button>
        </div>

        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/10 rounded-full blur-[120px] animate-pulse"></div>
        </div>
        <div className="z-10 text-center flex flex-col items-center">
          <h1 className="text-white text-6xl md:text-8xl font-black italic tracking-tighter mb-4 drop-shadow-[0_0_30px_rgba(59,130,246,0.5)]">
            RHYTHM<span className="text-blue-500">RACE</span>
          </h1>
          <div className="mb-8 w-64 group">
            <label className="block text-blue-400 text-[10px] font-bold tracking-[0.3em] uppercase mb-2 text-left">Pilot Registration</label>
            <input 
              type="text" 
              placeholder="ENTER NICKNAME" 
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value.toUpperCase().slice(0, 12))}
              className="w-full bg-black/40 border-b-2 border-blue-500/30 focus:border-blue-400 text-white p-2 text-center outline-none transition-all placeholder:text-blue-900/50 font-bold tracking-widest uppercase"
            />
          </div>
          <button 
            onClick={handleStartRequest} 
            disabled={!playerName.trim()}
            className={`group relative px-12 py-4 bg-transparent overflow-hidden transition-all duration-500 ${!playerName.trim() ? 'opacity-30 cursor-not-allowed grayscale' : 'hover:scale-105'}`}
          >
            <div className="absolute inset-0 border border-blue-500/30 group-hover:border-blue-400"></div>
            <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-blue-500"></div>
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-blue-500"></div>
            <span className="relative text-white text-2xl font-black tracking-[0.2em] uppercase group-hover:tracking-[0.4em] transition-all">Launch Race</span>
          </button>
        </div>
      </div>
    );
  }

  if (currentScene === 'LOADING') {
    return <LoadingScreen onFinished={handleLoadingFinished} isAudioReady={isAudioReady} news={loadingNews} sourceUrl={newsSource} />;
  }

  return (
    <div className="w-screen h-screen bg-[#020617] flex flex-col items-center justify-center relative overflow-hidden">
      {hudVisible && (
        <div style={{ left: '14%', top: '65%', transform: 'translate(-50%, -50%)' }} className="absolute z-[150] w-[320px] pointer-events-none font-['Orbitron']">
          <div className="bg-black/80 border-l-8 border-blue-500 p-5 rounded-r-xl backdrop-blur-xl shadow-[0_0_40px_rgba(0,0,0,0.5)] relative overflow-hidden transition-all duration-500">
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-3 h-3 rounded-full ${isAiThinking ? 'bg-yellow-500 shadow-[0_0_10px_#eab308]' : isQuotaExhausted ? 'bg-red-900 shadow-[0_0_10px_#7f1d1d]' : 'bg-red-500 shadow-[0_0_10px_#ef4444]'} animate-pulse`}></div>
              <span className="text-[11px] text-blue-400 font-black tracking-[0.4em] uppercase opacity-80">VOICE SYNTH V.2</span>
            </div>
            <p className={`text-lg md:text-xl font-black italic leading-tight transition-opacity duration-300 ${isAiThinking ? 'opacity-30' : 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]'}`}>
              {isAiThinking ? 'SYNTHESIZING...' : isQuotaExhausted ? 'NEURAL LINK SATURATED' : `"${aiCommentary}"`}
            </p>
          </div>
        </div>
      )}

      <div className="absolute top-4 left-4 z-[60] flex gap-2">
        <button onClick={handleExitToMain} className="bg-black/80 border border-red-500/40 p-2 rounded-lg text-[10px] text-red-400 font-bold uppercase hover:bg-red-500/20 transition-colors">Exit</button>
        <button onClick={() => setHudVisible(!hudVisible)} className="bg-black/80 border border-blue-500/40 p-2 rounded-lg text-[10px] text-blue-400 font-bold uppercase transition-colors">{hudVisible ? 'Hide HUD' : 'Show HUD'}</button>
      </div>

      <div className={`absolute top-8 z-50 transition-all duration-1000 ease-in-out pointer-events-none ${isRacing ? 'left-[28%] -translate-x-0' : 'left-1/2 -translate-x-1/2'}`}>
        <div className="px-8 py-2 bg-black/40 border border-white/10 rounded-full backdrop-blur-md">
           <span className={`text-4xl font-black italic tracking-widest ${timeLeft < 10 && timeLeft > 0 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
             {Math.floor(timeLeft / 60).toString().padStart(2, '0')}:{(timeLeft % 60).toString().padStart(2, '0')}
           </span>
        </div>
      </div>

      {gameResult && (
        <div className="absolute inset-0 z-[200] flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-1000 font-['Orbitron']">
          <h2 className={`text-7xl md:text-9xl font-black uppercase italic tracking-tighter mb-8 ${gameResult === 'WIN' ? 'text-blue-500 shadow-blue-500' : gameResult === 'LOSE' ? 'text-red-500 shadow-red-500' : 'text-gray-400'}`}>
            {gameResult === 'WIN' ? 'Winner' : gameResult === 'LOSE' ? 'Defeat' : 'Draw'}
          </h2>
          <div className="flex gap-4">
             <button 
                onClick={() => {
                    resetGameState();
                    speakCommentary(`Re-initiating sequence for ${playerName}.`, 0, 0);
                }} 
                className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded font-black uppercase tracking-widest transition-colors"
             >
                Replay
             </button>
             <button onClick={handleExitToMain} className="bg-transparent border border-white/20 hover:border-white text-white px-8 py-3 rounded font-black uppercase tracking-widest transition-colors">Menu</button>
          </div>
        </div>
      )}

      {countdownImg && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center pointer-events-none animate-in fade-in zoom-in duration-150">
          <img src={countdownImg} alt="Countdown" className="w-64 h-64 md:w-96 md:h-96 object-contain drop-shadow-[0_0_50px_rgba(255,255,255,0.5)]" />
        </div>
      )}

      {hudVisible && (
        <>
          <div style={{ left: '12%', top: '45%', transform: 'translate(-50%, -50%)' }} className="absolute z-10 pointer-events-none animate-in slide-in-from-left duration-500 font-['Orbitron']">
            <div className="bg-black/60 border-l-4 border-blue-500 px-6 py-4 rounded-r-xl shadow-lg flex flex-col">
              <p className="text-blue-400/80 text-[10px] font-black uppercase tracking-[0.3em] mb-1">{playerName || 'PLAYER'}</p>
              <span className={`text-4xl font-black tabular-nums ${isScorePenaltyActive ? 'text-red-500' : 'text-white'}`}>{playerScore.toString().padStart(4, '0')}</span>
            </div>
          </div>
          <div style={{ right: '12%', top: '45%', transform: 'translate(50%, -50%)' }} className="absolute z-10 pointer-events-none animate-in slide-in-from-right duration-500 font-['Orbitron']">
            <div className="bg-black/60 border-r-4 border-red-500 px-6 py-4 rounded-l-xl shadow-lg flex flex-col items-end">
              <p className="text-red-400/80 text-[10px] font-black uppercase tracking-[0.3em] mb-1">RIVAL AI</p>
              <span className="text-white text-4xl font-black tabular-nums">{aiScore.toString().padStart(4, '0')}</span>
            </div>
          </div>
        </>
      )}

      <Canvas gl={{ antialias: true }}>
        <Suspense fallback={null}>
          <GameScene 
            cameraPosition={[0, 8, 14]} cameraRotation={[-20, 0, 0]} 
            scrollSpeed={scrollSpeed} carScale={1.5} carPos={[2.5, 0.5, 0]} 
            shadowOpacity={1} shadowSize={0.8} fov={40} hitLineZ={-10} 
            pressedKeys={pressedKeys} isRacing={isRacing} timeLeft={timeLeft} 
            isGameFinished={isGameFinished} onFinishPassed={handleFinishLinePassed}
            noteConfig={{ interval: spawnInterval, speed: noteSpeed, spawnZ: -90 }}
            onScoreUpdate={handleScoreUpdate}
            onAiScoreUpdate={(amt) => setAiScore(p => Math.max(0, p + amt))}
            playerScore={playerScore}
            aiScore={aiScore}
            onPlayerZUpdate={setPlayerCarZ}
            onAiZUpdate={setAiCarZ}
            raceId={raceId}
          />
        </Suspense>
      </Canvas>
      
      <div className="absolute bottom-6 left-6 flex flex-col gap-1 pointer-events-none opacity-40 font-['Orbitron']">
        <div className="h-1 w-24 bg-blue-500"></div>
        <p className="text-white text-[10px] font-bold tracking-[0.5em] uppercase">{isRacing ? `V: ${(scrollSpeed * 10).toFixed(0)}` : 'IDLE'}</p>
      </div>
    </div>
  );
};

export default App;
