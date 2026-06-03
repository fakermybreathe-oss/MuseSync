import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Track } from '../types';

interface WaveModeProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  lyrics: string;
  currentTime: number;
  audioRef?: React.RefObject<HTMLAudioElement | null>;
}

interface LyricLine {
  time: number;
  text: string;
}

const parseLyrics = (lrc: string): LyricLine[] => {
  if (!lrc) return [];

  return lrc.split('\n')
    .map((line) => {
      const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
      if (!match) return null;

      const minutes = Number.parseInt(match[1], 10);
      const seconds = Number.parseInt(match[2], 10);
      const millis = Number.parseInt(match[3], 10);
      const time = minutes * 60 + seconds + millis / (match[3].length === 3 ? 1000 : 100);
      const text = match[4].trim();

      return text ? { time, text } : null;
    })
    .filter((line): line is LyricLine => Boolean(line));
};

const getActiveIndex = (lines: LyricLine[], time: number) => {
  if (lines.length === 0) return -1;

  let activeIndex = 0;
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].time <= time) activeIndex = index;
    else break;
  }
  return activeIndex;
};

const getProjectionText = (track: Track | null, fallback: string) => {
  const source = (track?.title || fallback || 'MUSESYNC')
    .replace(/\s*\(.*?\)\s*/g, '')
    .replace(/\s*（.*?）\s*/g, '')
    .replace(/[《》"'“”‘’]/g, '')
    .trim();

  if (!source) return 'MUSESYNC';
  return source.length > 10 ? source.slice(0, 10) : source;
};

const getKeywordProjectionText = (track: Track | null, fallback: string) => {
  const source = (fallback || track?.title || 'MUSESYNC')
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(/[，。！？、,.!?;:：；"'“”‘’（）()《》【】[\]\-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!source) return 'MUSESYNC';

  const candidates = source
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  const phrase = candidates[0] || source;
  const compact = phrase.replace(/[的了着过和与在是我你他她它们啊呀吗呢吧就都也很更还]/g, '');
  const keyword = compact.length >= 2 ? compact : phrase;

  return keyword.length > 8 ? keyword.slice(0, 8) : keyword;
};

interface RippleFront {
  x: number;
  y: number;
  born: number;
  speed: number;
  amplitude: number;
  decay: number;
  flatten: number;
  width: number;
  hue: number;
  wavelength: number;
  source: 'left' | 'right' | 'center' | 'ambient';
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const averageBins = (data: Uint8Array<ArrayBuffer>, start: number, end: number) => {
  const safeStart = clamp(start, 0, data.length - 1);
  const safeEnd = clamp(end, safeStart + 1, data.length);
  let sum = 0;
  for (let index = safeStart; index < safeEnd; index += 1) {
    sum += data[index];
  }
  return sum / (safeEnd - safeStart) / 255;
};

interface AudioAnalysisGraph {
  context: AudioContext;
  source: MediaElementAudioSourceNode;
  analyser: AnalyserNode;
  spectrum: Uint8Array<ArrayBuffer>;
}

const audioAnalysisGraphs = new WeakMap<HTMLAudioElement, AudioAnalysisGraph>();

const PhysicalRippleField: React.FC<{
  isPlaying: boolean;
  currentTime: number;
  audioRef?: React.RefObject<HTMLAudioElement | null>;
}> = ({ isPlaying, currentTime, audioRef }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frontsRef = useRef<RippleFront[]>([]);
  const lastEmitRef = useRef(0);
  const lastBeatEmitRef = useRef(0);
  const energyRef = useRef(0.14);
  const currentTimeRef = useRef(currentTime);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const spectrumRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const analyserFailedRef = useRef(false);

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let frameId = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let lastDrawTime = 0;
    const frameInterval = isPlaying ? 1000 / 42 : 1000 / 24;

    const ensureAnalyser = () => {
      const audioElement = audioRef?.current;
      if (!audioElement || analyserRef.current || analyserFailedRef.current) return;

      try {
        const cachedGraph = audioAnalysisGraphs.get(audioElement);
        if (cachedGraph) {
          audioContextRef.current = cachedGraph.context;
          sourceRef.current = cachedGraph.source;
          analyserRef.current = cachedGraph.analyser;
          spectrumRef.current = cachedGraph.spectrum;
          return;
        }

        const AudioContextConstructor = window.AudioContext
          || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextConstructor) return;

        const context = audioContextRef.current || new AudioContextConstructor();
        const source = context.createMediaElementSource(audioElement);
        const analyser = context.createAnalyser();

        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.82;
        source.connect(analyser);
        analyser.connect(context.destination);

        const spectrum = new Uint8Array(analyser.frequencyBinCount);
        const graph = { context, source, analyser, spectrum };
        audioAnalysisGraphs.set(audioElement, graph);
        audioContextRef.current = context;
        analyserRef.current = analyser;
        sourceRef.current = source;
        spectrumRef.current = spectrum;
      } catch (error) {
        analyserFailedRef.current = true;
        console.warn('Wave audio analyser unavailable, falling back to timeline rhythm.', error);
      }
    };

    const readEnergy = (now: number) => {
      if (isPlaying) {
        ensureAnalyser();
      }

      const context = audioContextRef.current;
      if (isPlaying && context?.state === 'suspended') {
        context.resume().catch(() => {});
      }

      const analyser = analyserRef.current;
      const spectrum = spectrumRef.current;

      if (isPlaying && analyser && spectrum && context?.state === 'running') {
        analyser.getByteFrequencyData(spectrum);
        const subBass = averageBins(spectrum, 2, 10);
        const bass = averageBins(spectrum, 10, 28);
        const lowMid = averageBins(spectrum, 28, 72);
        const measured = clamp(subBass * 0.46 + bass * 0.38 + lowMid * 0.2, 0, 1);
        energyRef.current += (measured - energyRef.current) * 0.18;
        return energyRef.current;
      }

      const timeline = currentTimeRef.current;
      const beat = Math.max(0, Math.sin(timeline * Math.PI * 2 * 1.85));
      const secondary = Math.max(0, Math.sin(timeline * Math.PI * 2 * 0.72 + 1.7));
      const fallback = isPlaying
        ? 0.2 + beat * 0.34 + secondary * 0.16
        : 0.09 + Math.sin(now * 0.00048) * 0.025 + Math.sin(now * 0.00021 + 2.1) * 0.018;

      energyRef.current += (fallback - energyRef.current) * 0.08;
      return clamp(energyRef.current, 0.06, 0.78);
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 1.15);
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const emitFront = (now: number, source: RippleFront['source'], energy = 0.16) => {
      const isAmbient = source === 'ambient';
      const fromLeft = isAmbient ? Math.floor(now / 1800) % 2 === 0 : source !== 'right';
      const pressure = clamp(energy, 0.08, 1);

      frontsRef.current.push({
        x: fromLeft ? 0 : width,
        y: height * 0.5,
        born: now,
        speed: isAmbient ? 90 : 132 + pressure * 106,
        amplitude: isAmbient ? 0.18 : 0.34 + pressure * 0.84,
        decay: isAmbient ? 0.3 : 0.42,
        flatten: 0.58,
        width: isAmbient ? 12 : 16 + pressure * 22,
        hue: fromLeft ? 190 : 176,
        wavelength: isAmbient ? 82 : 116 + pressure * 58,
        source,
      });

      const maxFronts = isPlaying ? 10 : 4;
      if (frontsRef.current.length > maxFronts) {
        frontsRef.current.splice(0, frontsRef.current.length - maxFronts);
      }
    };

    const drawGlassArc = (
      side: 'left' | 'right',
      radius: number,
      alpha: number,
      thickness: number,
      hue: number,
      flatten = 0.58,
    ) => {
      const sourceX = side === 'left' ? 0 : width;
      const sourceY = height * 0.5;
      const startAngle = side === 'left' ? -Math.PI * 0.52 : Math.PI * 0.48;
      const endAngle = side === 'left' ? Math.PI * 0.52 : Math.PI * 1.52;

      ctx.save();
      ctx.translate(sourceX, sourceY);
      ctx.scale(1, flatten);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.globalCompositeOperation = 'source-over';
      ctx.beginPath();
      ctx.arc(0, 0, radius, startAngle, endAngle);
      ctx.strokeStyle = `rgba(0, 15, 22, ${alpha * 0.42})`;
      ctx.lineWidth = thickness * 1.18;
      ctx.shadowBlur = 0;
      ctx.stroke();

      ctx.globalCompositeOperation = 'screen';
      ctx.shadowBlur = Math.min(26, thickness * 0.9);
      ctx.shadowColor = `hsla(${hue}, 96%, 78%, ${alpha * 0.64})`;

      ctx.beginPath();
      ctx.arc(0, 0, radius, startAngle, endAngle);
      ctx.strokeStyle = `hsla(${hue}, 96%, 82%, ${alpha * 0.34})`;
      ctx.lineWidth = thickness;
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(0, radius - thickness * 0.34), startAngle, endAngle);
      ctx.strokeStyle = `rgba(246, 255, 255, ${alpha * 0.82})`;
      ctx.lineWidth = Math.max(1.1, thickness * 0.09);
      ctx.stroke();

      const glintStart = side === 'left' ? -0.24 : Math.PI + 0.24;
      ctx.beginPath();
      ctx.arc(0, 0, radius + thickness * 0.16, glintStart, glintStart + Math.PI * 0.22);
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.78})`;
      ctx.lineWidth = Math.max(1.6, thickness * 0.12);
      ctx.shadowBlur = Math.min(30, thickness * 1.1);
      ctx.shadowColor = `rgba(206, 255, 255, ${alpha})`;
      ctx.stroke();

      ctx.restore();
    };

    const drawConcentricBanks = (now: number, energy: number) => {
      const spacing = clamp(width * 0.105, 96, 172);
      const speed = isPlaying ? 0.046 + energy * 0.11 : 0.012;
      const travel = (now * speed) % spacing;
      const ringCount = 5;

      for (const side of ['left', 'right'] as const) {
        const hue = side === 'left' ? 190 : 176;
        const sidePhase = side === 'left' ? 0 : spacing * 0.45;

        for (let index = 0; index < ringCount; index += 1) {
          const radius = spacing * (index + 1) + ((travel + sidePhase) % spacing);
          const depth = index / (ringCount - 1);
          const fade = clamp(1 - radius / (width * 0.88), 0.14, 1);
          const breath = 0.78 + Math.sin(now * 0.0012 + index * 0.7 + (side === 'left' ? 0 : 1.3)) * 0.16;
          const alpha = (isPlaying ? 0.11 + energy * 0.24 : 0.07) * fade * breath * (1 - depth * 0.22);
          const thickness = (isPlaying ? 16 + energy * 22 : 14) * (1 - depth * 0.1);

          drawGlassArc(side, radius, alpha, thickness, hue, 0.56 + depth * 0.035);
        }
      }
    };

    const drawSidePressure = (now: number, energy: number) => {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const pulse = isPlaying ? 0.42 + energy * 0.78 : 0.18;
      const points = [
        { x: -width * 0.04, y: height * 0.5, hue: 190 },
        { x: width * 1.04, y: height * 0.51, hue: 176 },
      ];

      for (const point of points) {
        const radius = width * (0.22 + pulse * 0.08);
        const gradient = ctx.createRadialGradient(point.x, point.y, 1, point.x, point.y, radius);
        gradient.addColorStop(0, `hsla(${point.hue}, 96%, 72%, ${0.12 + pulse * 0.12})`);
        gradient.addColorStop(0.34, `hsla(${point.hue}, 92%, 56%, ${0.05 + pulse * 0.06})`);
        gradient.addColorStop(1, `hsla(${point.hue}, 88%, 50%, 0)`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(point.x, point.y, radius, radius * 0.74, Math.sin(now * 0.0004) * 0.08, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    };

    const drawEllipticalFront = (front: RippleFront, now: number) => {
      const age = Math.max(0, (now - front.born) / 1000);
      const radius = front.speed * age;
      const maxRadius = Math.max(width, height) * 0.86;
      if (radius <= 0 || radius > maxRadius) return;

      const damping = front.amplitude * Math.exp(-front.decay * age);
      if (damping < 0.018) return;

      const side = front.x < width * 0.5 ? 'left' : 'right';
      const shimmer = 0.7 + 0.3 * Math.sin(age * 4.2 + front.hue);
      const alpha = Math.min(0.42, damping * 0.32 * shimmer);
      drawGlassArc(side, radius, alpha, front.width, front.hue, front.flatten);
    };

    const draw = (now: number) => {
      if (now - lastDrawTime < frameInterval) {
        frameId = requestAnimationFrame(draw);
        return;
      }
      lastDrawTime = now;

      ctx.clearRect(0, 0, width, height);
      const energy = readEnergy(now);
      drawSidePressure(now, energy);
      drawConcentricBanks(now, energy);

      const ambientInterval = isPlaying ? Math.max(760, 1120 - energy * 420) : 2600;
      if (now - lastEmitRef.current > ambientInterval) {
        const sideSource = Math.floor(now / ambientInterval) % 2 === 0 ? 'left' : 'right';
        emitFront(now, isPlaying ? sideSource : 'ambient', energy);
        lastEmitRef.current = now;
      }

      if (isPlaying && energy > 0.48 && now - lastBeatEmitRef.current > 620) {
        emitFront(now, 'left', energy);
        emitFront(now, 'right', energy * 0.92);
        lastBeatEmitRef.current = now;
      }

      frontsRef.current = frontsRef.current.filter((front) => {
        const age = (now - front.born) / 1000;
        return age >= 0 && age < 5.2;
      });

      for (const front of frontsRef.current) {
        drawEllipticalFront(front, now);
      }

      frameId = requestAnimationFrame(draw);
    };

    resize();
    const start = performance.now();
    frontsRef.current = [];
    emitFront(start - 300, 'left', 0.22);
    emitFront(start - 850, 'right', 0.18);
    emitFront(start - 1350, 'ambient', 0.12);
    lastEmitRef.current = start;
    lastBeatEmitRef.current = start;

    window.addEventListener('resize', resize);
    frameId = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(frameId);
    };
  }, [audioRef, isPlaying]);

  return <canvas ref={canvasRef} className="wave-ripple-canvas" aria-hidden="true" />;
};

export const WaveMode: React.FC<WaveModeProps> = ({
  currentTrack,
  isPlaying,
  lyrics,
  currentTime,
  audioRef,
}) => {
  const lrcLines = useMemo(() => parseLyrics(lyrics), [lyrics]);
  const activeIndex = useMemo(() => getActiveIndex(lrcLines, currentTime), [lrcLines, currentTime]);
  const activeLine = activeIndex >= 0 ? lrcLines[activeIndex]?.text : '';
  const fallbackTitle = currentTrack?.title || '等待选择歌曲';
  const fallbackArtist = currentTrack?.artist || '搜索并播放一首歌';
  const displayLyric = activeLine || fallbackTitle;
  const projectionText = useMemo(
    () => getKeywordProjectionText(currentTrack, displayLyric),
    [currentTrack, displayLyric],
  );
  const lyricIdRef = useRef(0);
  const [lyricLayers, setLyricLayers] = useState<Array<{ id: number; text: string; state: 'enter' | 'exit' }>>([
    { id: 0, text: displayLyric, state: 'enter' },
  ]);

  useEffect(() => {
    setLyricLayers((layers) => {
      const current = layers[layers.length - 1];
      if (current?.text === displayLyric) return layers;

      lyricIdRef.current += 1;
      return [
        ...(current ? [{ ...current, state: 'exit' as const }] : []),
        { id: lyricIdRef.current, text: displayLyric, state: 'enter' as const },
      ];
    });

    const cleanup = window.setTimeout(() => {
      setLyricLayers((layers) => layers.slice(-1));
    }, 820);

    return () => window.clearTimeout(cleanup);
  }, [displayLyric]);

  return (
    <section className={isPlaying ? 'wave-stage is-playing' : 'wave-stage'} aria-label="Wave immersive player">
      <div className="wave-field" aria-hidden="true">
        <PhysicalRippleField isPlaying={isPlaying} currentTime={currentTime} audioRef={audioRef} />
        <div className="wave-source wave-source-left">
          <span className="wave-drop-core" />
        </div>
        <div className="wave-source wave-source-right">
          <span className="wave-drop-core" />
        </div>
        <div className="wave-ribbon wave-ribbon-a" />
        <div className="wave-ribbon wave-ribbon-b" />
        <div className="wave-ribbon wave-ribbon-c" />
        <div className="wave-particles">
          {Array.from({ length: 8 }).map((_, index) => (
            <span key={index} style={{ '--i': index } as React.CSSProperties} />
          ))}
        </div>
      </div>

      <div className="wave-ghost" aria-hidden="true">
        {projectionText}
      </div>

      <div className="wave-content">
        <p className="wave-artist">{fallbackArtist}</p>
        <div className="wave-lyric-frame" title={displayLyric} aria-live="polite">
          {lyricLayers.map((layer) => (
            <h1
              key={layer.id}
              className={`wave-lyric is-${layer.state}`}
              aria-hidden={layer.state === 'exit'}
            >
              <span>{layer.text}</span>
            </h1>
          ))}
        </div>
      </div>

      <style>{`
        .wave-stage {
          position: relative;
          min-height: 100dvh;
          overflow: hidden;
          display: grid;
          place-items: center;
          isolation: isolate;
          padding: 96px 40px 150px;
          background:
            radial-gradient(circle at 2% 48%, rgba(0, 24, 32, 0.96) 0 14%, rgba(5, 80, 94, 0.66) 32%, transparent 54%),
            radial-gradient(circle at 98% 52%, rgba(84, 234, 255, 0.34) 0 16%, rgba(20, 160, 190, 0.24) 35%, transparent 58%),
            radial-gradient(circle at 50% 30%, rgba(128, 237, 255, 0.18), transparent 42%),
            linear-gradient(105deg, #04121a 0%, #0b4f60 45%, #24a8bf 100%);
        }

        .wave-stage::after {
          content: '';
          position: absolute;
          inset: 0;
          z-index: 5;
          pointer-events: none;
          background:
            linear-gradient(180deg, rgba(1, 9, 15, 0.62), transparent 20%, transparent 72%, rgba(1, 9, 15, 0.62)),
            radial-gradient(circle at 50% 54%, transparent 0 42%, rgba(0, 15, 22, 0.28) 100%);
        }

        .wave-field {
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          transform: translateZ(0);
        }

        .wave-ripple-canvas {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          z-index: 4;
          opacity: 0.96;
          filter: saturate(112%) contrast(106%);
          mix-blend-mode: normal;
        }

        .wave-source {
          --source-size: clamp(190px, 18vw, 320px);
          position: absolute;
          top: 50%;
          width: var(--source-size);
          aspect-ratio: 1;
          border-radius: 50%;
          transform: translateY(-50%);
          border: 1px solid rgba(218, 255, 255, 0.18);
          opacity: 0.74;
          background:
            radial-gradient(circle at 36% 28%, rgba(255, 255, 255, 0.42) 0 6%, transparent 7%),
            radial-gradient(circle at 50% 50%, rgba(180, 252, 255, 0.12) 0 18%, rgba(6, 110, 130, 0.18) 44%, rgba(0, 13, 20, 0.42) 76%, transparent 77%);
          box-shadow:
            inset -18px -16px 38px rgba(0, 0, 0, 0.36),
            inset 18px 12px 36px rgba(220, 255, 255, 0.1),
            0 0 72px rgba(85, 230, 255, 0.18);
          perspective: 900px;
          transform-style: preserve-3d;
        }

        .wave-source-left {
          left: calc(var(--source-size) * -0.5);
          transform: translateY(-50%) rotateY(18deg) rotateX(2deg);
        }

        .wave-source-right {
          right: calc(var(--source-size) * -0.5);
          opacity: 0.58;
          transform: translateY(-50%) rotateY(-20deg) rotateX(2deg);
        }

        .wave-source::before,
        .wave-source::after {
          content: '';
          position: absolute;
          inset: 8%;
          border-radius: 50%;
          border: 1px solid rgba(162, 247, 255, 0.16);
          transform: translateZ(34px) scale(0.9);
          box-shadow:
            inset 0 0 38px rgba(124, 236, 255, 0.09),
            0 0 28px rgba(54, 220, 246, 0.08);
        }

        .wave-source::after {
          inset: 19%;
          opacity: 0.72;
          transform: translateZ(62px) scale(0.78);
          filter: blur(0.4px);
        }

        .wave-drop-core {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 34%;
          aspect-ratio: 1;
          border-radius: 50%;
          transform: translate(-50%, -50%) translateZ(90px);
          background:
            radial-gradient(circle at 34% 28%, rgba(238, 255, 255, 0.42) 0 8%, transparent 9%),
            radial-gradient(circle at 50% 55%, rgba(17, 166, 190, 0.26), rgba(0, 17, 24, 0.52) 62%, rgba(0, 8, 13, 0.72));
          border: 1px solid rgba(189, 250, 255, 0.18);
          box-shadow:
            inset -14px -18px 28px rgba(0, 0, 0, 0.34),
            inset 10px 8px 22px rgba(211, 255, 255, 0.13),
            0 18px 38px rgba(0, 9, 16, 0.38),
            0 0 44px rgba(100, 236, 255, 0.14);
          opacity: 0.72;
        }

        .wave-ring {
          display: none;
        }

        .wave-ring-2 {
          animation-delay: 1.15s;
        }

        .wave-ring-3 {
          animation-delay: 2.3s;
        }

        .wave-drop-center {
          display: none;
        }

        .wave-drop-center span {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 20%;
          aspect-ratio: 1;
          border-radius: 50%;
          transform: translate(-50%, -50%) rotateX(-58deg);
          background:
            radial-gradient(circle at 35% 28%, rgba(255, 255, 255, 0.42) 0 13%, transparent 14%),
            radial-gradient(circle, rgba(106, 236, 255, 0.24), rgba(0, 25, 34, 0.12) 70%);
          border: 1px solid rgba(210, 255, 255, 0.18);
          box-shadow:
            inset -9px -10px 16px rgba(0, 0, 0, 0.18),
            0 14px 34px rgba(0, 21, 31, 0.36),
            0 0 50px rgba(109, 234, 255, 0.18);
        }

        .wave-ribbon {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 128vw;
          height: 18vh;
          border-radius: 999px;
          transform: translate(-50%, -50%) rotate(var(--r));
          background: linear-gradient(90deg, transparent, rgba(145, 246, 255, var(--a)), transparent);
          filter: blur(var(--b));
          opacity: 0.76;
          animation: none;
        }

        .wave-ribbon-a {
          --r: -8deg;
          --a: 0.3;
          --b: 18px;
          --d: 7s;
        }

        .wave-ribbon-b {
          --r: 5deg;
          --a: 0.18;
          --b: 26px;
          --d: 9s;
          top: 57%;
        }

        .wave-ribbon-c {
          --r: 0deg;
          --a: 0.12;
          --b: 34px;
          --d: 11s;
          top: 43%;
        }

        .wave-particles span {
          position: absolute;
          left: calc((var(--i) * 6vw) - 4vw);
          top: calc(18vh + (var(--i) % 7) * 9vh);
          width: 3px;
          height: 3px;
          border-radius: 999px;
          background: rgba(218, 253, 255, 0.72);
          box-shadow: 0 0 18px rgba(111, 233, 255, 0.8);
          opacity: 0.28;
          animation: wave-float calc(5s + var(--i) * 0.23s) ease-in-out infinite alternate;
        }

        .wave-ghost {
          position: absolute;
          left: 50%;
          top: 49%;
          z-index: 3;
          width: 100%;
          transform: translate3d(-50%, -50%, 0);
          padding: 0 4vw;
          color: rgba(232, 255, 255, 0.045);
          -webkit-text-stroke: 1px rgba(172, 249, 255, 0.055);
          text-shadow:
            0 22px 42px rgba(0, 20, 28, 0.22),
            0 0 82px rgba(142, 242, 255, 0.08);
          filter: blur(1.4px);
          font-size: clamp(6.2rem, 18vw, 20rem);
          font-weight: 900;
          letter-spacing: 0;
          line-height: 0.82;
          text-align: center;
          text-transform: uppercase;
          white-space: nowrap;
          user-select: none;
          pointer-events: none;
          transform-style: preserve-3d;
          opacity: 1;
          animation: wave-ghost-drift 18s ease-in-out infinite alternate;
        }

        .wave-content {
          position: relative;
          z-index: 6;
          width: min(1220px, calc(100vw - 40px));
          text-align: center;
        }

        .wave-artist {
          margin: 0 0 clamp(18px, 3vh, 32px);
          color: rgba(212, 249, 255, 0.68);
          font-size: clamp(0.72rem, 1vw, 0.92rem);
          font-weight: 740;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .wave-lyric-frame {
          max-width: 14em;
          min-height: clamp(6.2rem, 10vw, 9.8rem);
          margin: 0 auto;
          position: relative;
          display: grid;
          place-items: center;
          overflow: hidden;
        }

        .wave-lyric {
          grid-area: 1 / 1;
          width: 100%;
          margin: 0;
          display: grid;
          place-items: center;
          color: rgba(255, 255, 255, 0.96);
          font-size: clamp(2.7rem, 7.2vw, 7.3rem);
          font-weight: 830;
          letter-spacing: 0;
          line-height: 1.05;
          white-space: nowrap;
          text-shadow:
            0 0 30px rgba(111, 233, 255, 0.44),
            0 18px 64px rgba(0, 29, 39, 0.58);
        }

        .wave-lyric.is-enter {
          animation: wave-lyric-enter 820ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .wave-lyric.is-exit {
          animation: wave-lyric-exit 820ms cubic-bezier(0.7, 0, 0.3, 1) both;
        }

        .wave-lyric span {
          display: block;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          transform: translate3d(0, 0, 0);
          animation: ${isPlaying ? 'wave-line 2.8s ease-in-out infinite' : 'none'};
        }

        @keyframes wave-drift {
          from { transform: translate(-51%, -50%) rotate(var(--r)) scaleX(0.98); }
          to { transform: translate(-49%, -50%) rotate(var(--r)) scaleX(1.04); }
        }

        @keyframes wave-float {
          from { transform: translate3d(0, -10px, 0); opacity: 0.16; }
          to { transform: translate3d(18px, 14px, 0); opacity: 0.56; }
        }

        @keyframes wave-ripple-3d {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) translateZ(42px) scale(0.42);
          }
          14% {
            opacity: 0.72;
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) translateZ(8px) scale(2.22);
          }
        }

        @keyframes wave-center-breathe {
          0%, 100% {
            opacity: 0.36;
            transform: translate(-50%, -50%) rotateX(58deg) scale(0.94);
          }
          50% {
            opacity: 0.62;
            transform: translate(-50%, -50%) rotateX(58deg) scale(1.06);
          }
        }

        @keyframes wave-line {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); opacity: 0.96; }
          50% { transform: translate3d(0, -6px, 0) scale(1.015); opacity: 1; }
        }

        @keyframes wave-ghost-drift {
          from {
            transform: translate3d(-51.5%, -50%, 0) rotate(-0.6deg) scale(1.02);
          }
          to {
            transform: translate3d(-48.5%, -51.4%, 0) rotate(0.5deg) scale(1.055);
          }
        }

        @keyframes wave-lyric-enter {
          from {
            opacity: 0;
            filter: blur(10px);
            transform: translate3d(0, 42px, 0) scale(0.985);
          }
          to {
            opacity: 1;
            filter: blur(0);
            transform: translate3d(0, 0, 0) scale(1);
          }
        }

        @keyframes wave-lyric-exit {
          from {
            opacity: 1;
            filter: blur(0);
            transform: translate3d(0, 0, 0) scale(1);
          }
          to {
            opacity: 0;
            filter: blur(12px);
            transform: translate3d(0, -44px, 0) scale(1.012);
          }
        }

        @media (max-width: 820px) {
          .wave-stage {
            padding: 92px 18px 136px;
          }

          .wave-lyric-frame {
            max-width: 10em;
            min-height: clamp(4.8rem, 20vw, 7.2rem);
          }

          .wave-lyric {
            font-size: clamp(2.15rem, 12vw, 4.6rem);
            white-space: normal;
          }

          .wave-ghost {
            font-size: 22vw;
            white-space: normal;
          }

        }
      `}</style>
    </section>
  );
};
