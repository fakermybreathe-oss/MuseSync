import React from 'react';
import { OpticsFilter } from '../components/OpticsFilter';
import type { Track, Platform } from '../types';

interface SearchResultsPanelProps {
  visible: boolean;
  isLoading?: boolean;
  onClose: () => void;
  results: Track[];
  onSelectTrack: (track: Track) => void;
  platform: Platform;
}

const fmtDuration = (s: number): string => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

export const SearchResultsPanel: React.FC<SearchResultsPanelProps> = ({
  visible, isLoading, onClose, results, onSelectTrack, platform
}) => {
  const panelFilterId = 'search-panel-filter';

  if (!visible) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 40,
          background: 'transparent',
        }}
      />

      {/* 搜索结果面板，完美对齐 SearchBox */}
      <div className="musesync-search-panel">
        {/* 仅在电脑端显示的高级物理光学底板 */}
        <div className="desktop-optics-filter">
          <OpticsFilter id={panelFilterId} width={552} height={380} radius={16} surfaceType="convex_squircle" />
        </div>

        <div className="search-panel-glass">
          
          <div style={{
            position: 'absolute', top: 6, right: 12, zIndex: 50
          }}>
             <button onClick={onClose} style={{
              background: 'transparent', border: 'none',
              color: 'var(--ms-text-secondary)', cursor: 'pointer',
              fontSize: '1.2rem', padding: '4px',
              transition: 'color 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--ms-text-primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--ms-text-secondary)'}
            >✕</button>
          </div>

          <div className="search-scroll-container" style={{ 
            flex: 1, 
            overflowY: 'auto', 
            padding: '16px 20px',
            // Fade Items 效果：顶部和底部渐隐
            maskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)',
          }}>
            {isLoading ? (
              <div style={{ textAlign: 'center', color: 'var(--ms-text-muted)', marginTop: '40px' }}>
                <div className="ms-spinner" style={{ fontSize: '1.5rem', marginBottom: '12px' }}>🌀</div>
                正在跨端搜索中...
              </div>
            ) : results.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--ms-text-muted)', marginTop: '40px' }}>无结果</div>
            ) : (
              results.map(track => (
                <div
                  key={track.id}
                  onClick={() => onSelectTrack(track)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '8px 12px', borderRadius: '12px', cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={e => { 
                    (e.currentTarget as HTMLElement).style.background = 'var(--ms-glass-bg-light)'; 
                  }}
                  onMouseLeave={e => { 
                    (e.currentTarget as HTMLElement).style.background = 'transparent'; 
                  }}
                >
                  <img
                    src={track.coverUrl}
                    alt={track.title}
                    style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover' }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '0.9rem', fontWeight: 600, color: 'var(--ms-text-primary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {track.title}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--ms-text-secondary)' }}>
                      {track.artist}
                    </div>
                  </div>
                  <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--ms-text-muted)' }}>
                    {fmtDuration(track.duration)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      <style>{`
        .musesync-search-panel {
          position: fixed;
          top: 145px;
          left: 50%;
          width: 552px;
          height: 380px;
          max-height: calc(100vh - 160px);
          max-width: 90vw;
          transform: translateX(-50%);
          z-index: 45;
          animation: ms-dropdown 0.5s cubic-bezier(0.16, 1, 0.3, 1);
          display: flex;
          flex-direction: column;
        }

        .desktop-optics-filter {
          position: absolute;
          inset: 0;
          border-radius: 16px;
          overflow: hidden;
          pointer-events: none;
        }

        .search-panel-glass {
          width: 100%;
          height: 100%;
          backdrop-filter: url(#\${panelFilterId});
          -webkit-backdrop-filter: url(#\${panelFilterId});
          background: rgba(30, 30, 30, 0.3);
          border: 1px solid var(--ms-glass-border);
          border-radius: 16px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 var(--ms-glass-highlight);
          display: flex;
          flex-direction: column;
          position: relative;
        }

        @media (max-width: 768px) {
          .musesync-search-panel {
            top: 135px;
            left: 16px;
            right: 16px;
            width: calc(100% - 32px);
            transform: none;
            max-width: none;
          }

          .desktop-optics-filter {
            display: none;
          }

          .search-panel-glass {
            backdrop-filter: blur(24px) saturate(180%);
            -webkit-backdrop-filter: blur(24px) saturate(180%);
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.15);
          }
        }

        @keyframes ms-dropdown {
          from { opacity: 0; transform: translate(-50%, -15px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes ms-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .ms-spinner {
          display: inline-block;
          animation: ms-spin 1s linear infinite;
        }
        /* Show Scrollbar */
        .search-scroll-container::-webkit-scrollbar {
          width: 6px;
        }
        .search-scroll-container::-webkit-scrollbar-track {
          background: transparent;
        }
        .search-scroll-container::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 4px;
        }
        .search-scroll-container::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.4);
        }
      `}</style>
    </>
  );
};
