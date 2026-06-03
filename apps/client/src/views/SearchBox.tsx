import React, { useState } from 'react';
import { LiquidSwitch } from '../components/LiquidSwitch';
import type { Platform } from '../types';
import { OpticsFilter } from '../components/OpticsFilter';

interface SearchBoxProps {
  onSearch: (keyword: string, platform: Platform) => void;
}

export const SearchBox: React.FC<SearchBoxProps> = ({ onSearch }) => {
  const [keyword, setKeyword] = useState('');
  const [platform, setPlatform] = useState<Platform>('netease');

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && keyword.trim()) {
      onSearch(keyword.trim(), platform);
    }
  };

  const containerFilterId = 'searchbox-container-filter';

  return (
    <div className="musesync-searchbox">
      {/* 搜索框主体，带液态玻璃背板 */}
      <div className="search-input-wrapper" style={{ position: 'relative' }}>
        {/* 在电脑端显示高精度 SVG 过滤器 */}
        <div className="desktop-optics-filter">
          <OpticsFilter id={containerFilterId} width={400} height={48} radius={24} />
        </div>
        
        <div className="search-glass-panel">
          <span style={{ fontSize: '1.2rem', color: 'var(--ms-text-secondary)', marginRight: '12px' }}>
            🔍
          </span>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`搜索${platform === 'netease' ? '网易云音乐' : 'QQ音乐'}...`}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--ms-text-primary)',
              fontSize: '1rem',
              fontFamily: 'inherit',
            }}
          />
        </div>
      </div>

      {/* 平台切换器 */}
      <div className="switch-wrapper">
        <LiquidSwitch
          id="search-platform-switch"
          options={[
            { id: 'netease', label: '网易云' },
            { id: 'qq', label: 'QQ' }
          ]}
          activeId={platform}
          onChange={(id) => setPlatform(id as Platform)}
          width={140}
          height={48}
          radius={24}
        />
      </div>

      {/* 局部内联样式注入以实现高拟真自适应 */}
      <style>{`
        .musesync-searchbox {
          position: fixed;
          top: 85px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 100;
          display: flex;
          align-items: center;
          gap: 12px;
          transition: all 0.3s cubic-bezier(0.25, 1, 0.5, 1);
        }

        .desktop-optics-filter {
          display: block;
        }

        .search-glass-panel {
          position: relative;
          width: 400px;
          height: 48px;
          background: var(--ms-glass-bg);
          border: 1px solid var(--ms-glass-border);
          backdrop-filter: url(#${containerFilterId});
          -webkit-backdrop-filter: url(#${containerFilterId});
          box-shadow: 0 8px 32px rgba(0,0,0,0.3), inset 0 1px 1px var(--ms-glass-highlight);
          display: flex;
          align-items: center;
          padding: 0 16px;
          border-radius: 24px;
          box-sizing: border-box;
        }

        .switch-wrapper {
          flex-shrink: 0;
        }

        @media (max-width: 768px) {
          .musesync-searchbox {
            position: fixed;
            top: 75px; /* 放在顶部导航栏下方 */
            bottom: auto;
            left: 16px;
            right: 16px;
            transform: none;
            flex-direction: row; /* 横向排版，但缩窄输入框 */
            gap: 8px;
            width: calc(100% - 32px);
          }

          .search-input-wrapper {
            flex: 1;
            width: 100%;
          }

          .desktop-optics-filter {
            display: none; /* 手机上隐藏写死 400px 的 SVG Optics，改用标准自适应 CSS 高清磨砂 */
          }

          .search-glass-panel {
            width: 100%;
            backdrop-filter: blur(20px) saturate(180%);
            -webkit-backdrop-filter: blur(20px) saturate(180%);
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.15);
            box-shadow: 0 12px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15);
          }

          .switch-wrapper {
            transform: scale(0.9); /* 手机端切换器适当缩放，更精致 */
            transform-origin: right center;
          }
        }
      `}</style>
    </div>
  );
};
