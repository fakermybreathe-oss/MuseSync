import React, { useEffect, useRef, useState, startTransition } from 'react';
import './LyricSyncPreview.css';

interface LyricLine {
  time: number;
  text: string;
}

const DEMO_LINES: LyricLine[] = [
  { time: 0, text: 'The tide folds itself into the room' },
  { time: 6, text: 'Every note leaves a trace of light' },
  { time: 12, text: 'We keep the rhythm close enough to touch' },
  { time: 18, text: 'Glass bends the ocean into a quiet signal' },
  { time: 24, text: 'I can hear your playlist crossing mine' },
  { time: 30, text: 'Line by line the chorus finds its place' },
  { time: 36, text: 'Hold the sync until the room is moving' },
  { time: 42, text: 'Drift for a while, then come back home' },
  { time: 48, text: 'The current line is waiting in the glow' },
  { time: 54, text: 'Two devices breathe inside the same second' },
  { time: 60, text: 'No more guessing where the lyric should be' },
  { time: 66, text: 'The song remembers exactly where we are' },
  { time: 72, text: 'When the last wave breaks, stay with me' },
];

const TRACK_DURATION = 78;

function getActiveIndex(currentTime: number) {
  let activeIndex = 0;

  for (let index = 0; index < DEMO_LINES.length; index += 1) {
    if (DEMO_LINES[index].time <= currentTime) {
      activeIndex = index;
    } else {
      break;
    }
  }

  return activeIndex;
}

export const LyricSyncPreview: React.FC = () => {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isDetached, setIsDetached] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const programmaticScrollRef = useRef(false);
  const activeIndex = getActiveIndex(currentTime);

  useEffect(() => {
    if (!isPlaying) return;

    const timer = window.setInterval(() => {
      startTransition(() => {
        setCurrentTime((time) => {
          const next = time + 0.25;
          return next >= TRACK_DURATION ? 0 : next;
        });
      });
    }, 250);

    return () => window.clearInterval(timer);
  }, [isPlaying]);

  useEffect(() => {
    if (isDetached) return;

    const activeLine = lineRefs.current[activeIndex];
    if (!activeLine) return;

    programmaticScrollRef.current = true;
    activeLine.scrollIntoView({ block: 'center', behavior: 'smooth' });

    const timer = window.setTimeout(() => {
      programmaticScrollRef.current = false;
    }, 420);

    return () => window.clearTimeout(timer);
  }, [activeIndex, isDetached]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const handleScroll = () => {
      if (programmaticScrollRef.current) return;

      startTransition(() => {
        setIsDetached(true);
      });
    };

    scroller.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      scroller.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const syncToCurrentLine = () => {
    programmaticScrollRef.current = true;
    setIsDetached(false);
    lineRefs.current[activeIndex]?.scrollIntoView({ block: 'center', behavior: 'smooth' });

    window.setTimeout(() => {
      programmaticScrollRef.current = false;
    }, 420);
  };

  const seekToLine = (line: LyricLine) => {
    setCurrentTime(line.time);
    setIsDetached(false);
  };

  return (
    <main className="lyrics-demo-shell">
      <section className="lyrics-demo-stage" aria-label="Lyrics sync preview">
        <button
          type="button"
          className="lyrics-demo-play"
          aria-label={isPlaying ? 'Pause preview' : 'Play preview'}
          onClick={() => setIsPlaying((value) => !value)}
        >
          {isPlaying ? 'II' : '>'}
        </button>

        <div className="lyrics-demo-panel">
          <div ref={scrollerRef} className="lyrics-demo-scroll" aria-label="Synchronized lyrics">
            <div className="lyrics-demo-fade lyrics-demo-fade-top" />
            <div className="lyrics-demo-fade lyrics-demo-fade-bottom" />
            <div className="lyrics-demo-lines">
              {DEMO_LINES.map((line, index) => {
                const distance = Math.abs(index - activeIndex);
                const isActive = index === activeIndex;

                return (
                  <button
                    key={line.time}
                    ref={(node) => {
                      lineRefs.current[index] = node;
                    }}
                    type="button"
                    className={isActive ? 'lyrics-demo-line is-active' : 'lyrics-demo-line'}
                    style={{ '--line-distance': Math.min(distance, 4) } as React.CSSProperties}
                    onClick={() => seekToLine(line)}
                  >
                    <span className="lyrics-demo-line-text">{line.text}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            className={isDetached ? 'lyrics-demo-sync is-visible' : 'lyrics-demo-sync'}
            onClick={syncToCurrentLine}
            aria-hidden={!isDetached}
            tabIndex={isDetached ? 0 : -1}
          >
            SYNC
          </button>
        </div>
      </section>
    </main>
  );
};
