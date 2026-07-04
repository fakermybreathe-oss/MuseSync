import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Spring } from '../utils/spring';
import { LiquidStateProvider } from '../components/LiquidStateContext';
import { OpticsFilter } from '../components/OpticsFilter';
import type { Track } from '../types';

interface ClassicModeProps {
  currentTrack: Track | null;
  lyrics: string;
  currentTime: number;
  isPlaying: boolean;
  onSeek?: (val: number) => void;
}

/** 解析 LRC 歌词为行数组 */
const parseLyrics = (lrc: string): { time: number; text: string }[] => {
  if (!lrc) return [];
  return lrc.split('\n')
    .map(line => {
      const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
      if (!match) return null;
      const min = parseInt(match[1]);
      const sec = parseInt(match[2]);
      const ms = parseInt(match[3]);
      return { time: min * 60 + sec + ms / (match[3].length === 3 ? 1000 : 100), text: match[4].trim() };
    })
    .filter((item): item is { time: number; text: string } => item !== null && item.text.length > 0);
};

export const ClassicMode: React.FC<ClassicModeProps> = ({ 
  currentTrack, 
  lyrics, 
  currentTime, 
  isPlaying,
  onSeek 
}) => {
  const lrcLines = parseLyrics(lyrics);

  // 歌词滚动核心 Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<{ [key: number]: HTMLParagraphElement | null }>({});
  
  // 物理弹簧阻尼引擎设置 (stiffness = 180, damping = 22 可获得极佳的拟物弹性滑动与边界阻尼)
  const springRef = useRef(new Spring(0, 180, 22));
  const lastTimeRef = useRef(performance.now());

  // 手动滚动与归位状态
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [countdown, setCountdown] = useState(5);
  
  const timerRef = useRef<any>(null);
  const countdownTimerRef = useRef<any>(null);

  // 计算当前应该高亮的行
  const activeIndex = lrcLines.findIndex((line, i) => 
    currentTime >= line.time && (i === lrcLines.length - 1 || currentTime < lrcLines[i + 1].time)
  );

  // 清除全部计时器
  const clearTimers = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
  }, []);

  // 点击归位或自动返回
  const resetToAutoScroll = useCallback(() => {
    clearTimers();
    setIsUserScrolling(false);
  }, [clearTimers]);

  // 手动滚动偏量处理器（共享给滚轮、触摸、拖拽）
  const handleManualOffsetUpdate = useCallback((deltaY: number) => {
    setIsUserScrolling(true);
    setCountdown(5);

    clearTimers();

    // 开启 5s 自动归位时钟
    timerRef.current = setTimeout(() => {
      setIsUserScrolling(false);
    }, 5000);

    // 倒计时数更新
    countdownTimerRef.current = setInterval(() => {
      setCountdown(prev => Math.max(0, prev - 1));
    }, 1000);

    const spring = springRef.current;
    const container = containerRef.current;
    const content = contentRef.current;
    
    if (container && content) {
      const containerHeight = container.clientHeight;
      const contentHeight = content.scrollHeight;
      
      // 累加滚动位移目标
      let newTarget = spring.target - deltaY;

      // 弹性溢出限度：只允许越界拉伸 120 像素，越向边缘阻力越大
      const maxLimit = 120;
      const minLimit = containerHeight - contentHeight - 120;

      newTarget = Math.max(minLimit, Math.min(maxLimit, newTarget));
      spring.setTarget(newTarget);
    }
  }, [clearTimers]);

  // 1. 滚轮事件
  const handleWheel = (e: React.WheelEvent) => {
    // 阻止外层容器默认的原生滚动，转为我们自定义的弹簧平移
    e.preventDefault();
    handleManualOffsetUpdate(e.deltaY);
  };

  // 2. 触屏滑动事件 (移动端极度友好支持)
  const touchStartY = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    const clientY = e.touches[0].clientY;
    const deltaY = touchStartY.current - clientY;
    touchStartY.current = clientY;
    handleManualOffsetUpdate(deltaY * 1.5); // 乘以 1.5 放大系数更符合手指交互
  };

  // 3. 鼠标直接按住拖拽滚动 (超炫酷的直接抓取拖动交互)
  const isDragging = useRef(false);
  const lastDragY = useRef(0);
  
  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    lastDragY.current = e.clientY;
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const clientY = e.clientY;
    const deltaY = lastDragY.current - clientY;
    lastDragY.current = clientY;
    handleManualOffsetUpdate(deltaY * 1.5);
  };
  const handleMouseUpOrLeave = () => {
    isDragging.current = false;
  };

  // 物理弹簧的高频渲染刷新循环
  useEffect(() => {
    let animId: number;
    
    const updateSpring = () => {
      const now = performance.now();
      // 限制最小 dt 防止后台页静止后切换产生突变冲击
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = now;

      const spring = springRef.current;

      // 如果非手动滚动中，则自动聚焦高亮行居中偏上
      if (!isUserScrolling) {
        if (activeIndex !== -1 && containerRef.current && rowRefs.current[activeIndex]) {
          const activeRow = rowRefs.current[activeIndex]!;
          const container = containerRef.current!;
          
          // 目标居中偏量 Y 轴计算：容器中间 - 目标行offsetTop - 目标行高度的一半 - 60px (使其视觉重心黄金偏上，往上靠)
          const targetOffset = container.clientHeight / 2 - activeRow.offsetTop - activeRow.clientHeight / 2 - 60;
          spring.setTarget(targetOffset);
        } else if (lrcLines.length === 0) {
          spring.setTarget(0);
        }
      }

      // 弹簧演算更新
      const currentVal = spring.update(dt);

      // 越界边界反弹处理：在手动滚动越界之后拉回真实边界
      if (isUserScrolling && containerRef.current && contentRef.current) {
        const containerHeight = containerRef.current.clientHeight;
        const contentHeight = contentRef.current.scrollHeight;
        
        if (spring.target > 0) {
          spring.setTarget(0);
        } else if (spring.target < containerHeight - contentHeight) {
          spring.setTarget(Math.min(0, containerHeight - contentHeight));
        }
      }

      // 硬件加速 translate3d 渲染平移
      if (contentRef.current) {
        contentRef.current.style.transform = `translate3d(0, ${currentVal}px, 0)`;
      }

      animId = requestAnimationFrame(updateSpring);
    };

    lastTimeRef.current = performance.now();
    animId = requestAnimationFrame(updateSpring);

    return () => cancelAnimationFrame(animId);
  }, [activeIndex, isUserScrolling, lrcLines.length]);

  // 切歌时自动归位
  useEffect(() => {
    resetToAutoScroll();
    springRef.current.value = 0;
    springRef.current.target = 0;
    springRef.current.velocity = 0;
  }, [currentTrack?.id, resetToAutoScroll]);

  // 销毁时清理计时器
  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  return (
    <div className="classic-container">
      {/* 左区：封面 */}
      <div className="classic-left">
        <div className="classic-cover-wrapper"
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.transform = 'translateY(-8px) scale(1.02)';
            (e.currentTarget as HTMLElement).style.boxShadow = '0 40px 72px rgba(0,0,0,0.6)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.transform = 'translateY(0) scale(1)';
            (e.currentTarget as HTMLElement).style.boxShadow = '0 32px 64px rgba(0,0,0,0.5)';
          }}
        >
          {currentTrack ? (
            <img
              key={currentTrack.id}
              src={currentTrack.coverUrl}
              alt={currentTrack.title}
              referrerPolicy="no-referrer"
              style={{
                width: '100%', height: '100%', objectFit: 'cover',
                animation: 'cover-fade-in 0.5s ease',
              }}
            />
          ) : (
            <LiquidStateProvider
              initialState={{
                surfaceType: 'convex_squircle',
                bezelWidth: 18,
                glassThickness: 150,
                specularOpacity: 0.86,
                specularSaturation: 1.3,
                refractionLevel: 1.18,
                blurLevel: 0.25,
              }}
            >
              <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                <OpticsFilter id="classic-empty-cover" width={320} height={320} radius={40} />
                <div style={{
                  width: '100%', height: '100%', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(255, 255, 255, 0.018)',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15), inset 0 1.6px 16px rgba(0, 0, 0, 0.09), inset 0 -1.6px 16px rgba(255, 255, 255, 0.12)',
                  backdropFilter: 'url(#classic-empty-cover)',
                  WebkitBackdropFilter: 'url(#classic-empty-cover)',
                  color: 'var(--ms-text-muted)', fontSize: '0.9rem',
                }}>
                  等待封面
                </div>
              </div>
            </LiquidStateProvider>
          )}
        </div>

        {/* 曲目信息 */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: '10px', 
            marginBottom: '6px',
            flexWrap: 'wrap'
          }}>
            <h2 style={{
              fontSize: '1.6rem',
              fontWeight: 700,
              color: 'var(--ms-text-primary)',
              margin: 0,
            }}>
              {currentTrack?.title || '等待选择歌曲'}
            </h2>
            {currentTrack?.isFallback && (
              <span style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                color: '#10B981', // 极其饱满、高级的极光绿
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                borderRadius: '8px',
                padding: '2px 8px',
                letterSpacing: '0.05em',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.15), inset 0 1px 0 rgba(255,255,255,0.1)',
                userSelect: 'none',
              }}>
                ⇄ {currentTrack.platform === 'netease' ? 'QQ' : '网易云'}
              </span>
            )}
          </div>
          <p style={{ fontSize: '0.95rem', color: 'var(--ms-text-secondary)', fontWeight: 400, margin: 0 }}>
            {currentTrack?.artist || '搜索并选择歌曲'}
          </p>
        </div>
      </div>

      {/* 右区：歌词滚动窗口 */}
      <div 
        ref={containerRef}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        className="classic-right"
        style={{
          cursor: isDragging.current ? 'grabbing' : 'grab',
        }}
      >
        {/* 液态玻璃悬浮归位药丸 */}
        {isUserScrolling && (
          <div 
            onClick={resetToAutoScroll}
            style={{
              position: 'absolute',
              top: '12px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              borderRadius: '24px',
              padding: '8px 18px',
              fontSize: '0.78rem',
              color: '#ffffff',
              fontWeight: 600,
              boxShadow: '0 12px 32px rgba(0,0,0,0.4), inset 0 1px 1px rgba(255,255,255,0.2)',
              cursor: 'pointer',
              zIndex: 30,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              animation: 'pill-bounce 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              userSelect: 'none',
              transition: 'background 0.2s, transform 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
              e.currentTarget.style.transform = 'translateX(-50%) scale(1.03)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.transform = 'translateX(-50%) scale(1)';
            }}
          >
            <span style={{
              display: 'inline-flex',
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              border: '2px solid rgba(255,255,255,0.8)',
              borderTopColor: 'transparent',
              animation: 'spin 1s linear infinite',
              boxSizing: 'border-box'
            }} />
            <span>{countdown} 秒后自动返回</span>
            <span style={{ 
              opacity: 0.6, 
              fontSize: '0.7rem', 
              marginLeft: '4px',
              borderLeft: '1px solid rgba(255,255,255,0.3)',
              paddingLeft: '8px'
            }}>✕ 立即归位</span>
          </div>
        )}

        {/* 滚动平移包围层，配备 will-change 开启 GPU 硬件加速 */}
        <div 
          ref={contentRef}
          style={{
            marginTop: '2.5rem',
            willChange: 'transform',
            transition: 'none',
          }}
        >
          {lrcLines.length > 0 ? (
            lrcLines.map((line, i) => {
              const isActive = i === activeIndex;
              const distance = Math.abs(i - activeIndex);
              
              // 镜头景深虚化算法：离高亮行越远越模糊、越淡
              const opacity = isActive ? 1 : Math.max(0.12, 0.55 - distance * 0.07);
              const blurVal = isActive ? 0 : Math.min(2.5, distance * 0.45);
              const scale = isActive ? 1.04 : 0.96;

              return (
                <p 
                  key={i}
                  ref={el => { rowRefs.current[i] = el; }}
                  onClick={() => {
                    // 极致细节：点击这行歌词，音乐直接无缝 Seek 跳跃到这行歌词的时间点！
                    if (onSeek && currentTrack?.duration) {
                      const seekRatio = (line.time / currentTrack.duration) * 100;
                      onSeek(Math.min(100, Math.max(0, seekRatio)));
                    }
                  }}
                  style={{
                    fontSize: isActive ? '1.9rem' : '1.3rem',
                    fontWeight: isActive ? 700 : 400,
                    color: isActive ? '#ffffff' : 'rgba(255,255,255,0.7)',
                    opacity: opacity,
                    filter: blurVal > 0 ? `blur(${blurVal}px)` : 'none',
                    transform: `scale(${scale})`,
                    transformOrigin: 'left center',
                    textShadow: isActive 
                      ? '0 0 20px rgba(255,255,255,0.3), 0 2px 14px rgba(0,0,0,0.5)' 
                      : '0 2px 8px rgba(0,0,0,0.4)',
                    marginBottom: '1.1rem', 
                    lineHeight: 1.6,
                    cursor: 'pointer',
                    transition: 'opacity 0.4s ease, filter 0.4s ease, transform 0.4s cubic-bezier(0.25, 1, 0.5, 1), color 0.3s',
                    animation: isActive && isPlaying ? 'lrc-line-pulse 4s ease-in-out infinite' : 'none',
                  }}
                >
                  {line.text}
                </p>
              );
            })
          ) : (
            <div style={{
              display: 'flex', flexDirection: 'column',
              justifyContent: 'center', height: '300px', gap: '12px',
              textAlign: 'center',
            }}>
              <h3 style={{
                fontSize: '1.6rem', color: 'var(--ms-text-primary)', fontWeight: 600,
                textShadow: '0 2px 16px rgba(0,0,0,0.5)',
              }}>
                等待歌词
              </h3>
              <p style={{ color: 'var(--ms-text-muted)', fontSize: '0.9rem', textShadow: '0 1px 8px rgba(0,0,0,0.4)' }}>
                选择歌曲后歌词将在此显示
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 嵌入本组件局部专用的高级动画关键帧及响应式 CSS 样式 */}
      <style>{`
        .classic-container {
          display: grid;
          grid-template-columns: 40% 60%;
          min-height: calc(100dvh - 160px);
          padding: 80px 48px 120px 48px;
          max-width: 1400px;
          margin: 0 auto;
          gap: 48px;
          align-items: center;
          box-sizing: border-box;
        }

        .classic-left {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 24px;
          width: 100%;
        }

        .classic-cover-wrapper {
          width: 320px;
          height: 320px;
          border-radius: 2.5rem;
          overflow: hidden;
          box-shadow: 0 32px 64px rgba(0,0,0,0.5);
          transition: transform 0.4s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.4s ease;
          user-select: none;
          -webkit-user-select: none;
        }

        .classic-right {
          position: relative;
          height: 480px;
          overflow: hidden; /* 裁切外部，完全由 translate3d 弹簧接管 */
          padding: 2rem 1rem;
          user-select: none;
          -webkit-user-select: none;
          width: 100%;
          box-sizing: border-box;
        }

        @media (max-width: 768px) {
          .classic-container {
            grid-template-columns: 1fr;
            padding: 144px 16px 176px 16px;
            gap: clamp(18px, 4.5vw, 28px);
            align-items: start;
            min-height: 100dvh;
          }

          .classic-left {
            gap: 12px;
          }

          .classic-cover-wrapper {
            width: clamp(178px, 52vw, 224px);
            height: clamp(178px, 52vw, 224px);
            border-radius: clamp(1.35rem, 5vw, 1.75rem);
            box-shadow: 0 16px 36px rgba(0,0,0,0.4);
          }

          .classic-right {
            height: clamp(210px, 27dvh, 280px);
            padding: 0.5rem 0;
          }

          .classic-right p {
            font-size: 1.4rem !important; /* 手机上歌词字号适当微调以获得最佳视觉 */
          }
          
          .classic-right p[style*="font-size: 1.9rem"] {
            font-size: 1.6rem !important;
          }
        }

        @keyframes pill-bounce {
          0% { opacity: 0; transform: translate(-50%, -24px) scale(0.9); }
          80% { transform: translate(-50%, 2px) scale(1.02); }
          100% { opacity: 1; transform: translate(-50%, 0) scale(1); }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes lrc-line-pulse {
          0% { transform: scale(1.04); }
          50% { transform: scale(1.055) translate3d(2px, 0, 0); text-shadow: 0 0 25px rgba(255,255,255,0.4), 0 2px 16px rgba(0,0,0,0.6); }
          100% { transform: scale(1.04); }
        }
      `}</style>
    </div>
  );
};
