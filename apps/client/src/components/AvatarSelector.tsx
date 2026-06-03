import React from 'react';

export interface AvatarItem {
  id: number;
  name: string;
  bgColor: string;
  renderSvg: () => React.ReactNode;
}

// 🎨 精选 10 款殿堂级可爱卡通大头贴（纯 SVG 扁平化矢量自渲染，100% 离线免请求秒开）
export const CARTOON_AVATARS: AvatarItem[] = [
  {
    id: 0,
    name: '皮卡丘 ⚡',
    bgColor: '#FFE135',
    renderSvg: () => (
      <svg viewBox="0 0 100 100" width="100%" height="100%">
        {/* 耳朵 */}
        <path d="M 18 5 L 35 32 L 15 38 Z" fill="#FFE135" />
        <path d="M 18 5 L 24 18 L 15 38 Z" fill="#222" />
        <path d="M 82 5 L 65 32 L 85 38 Z" fill="#FFE135" />
        <path d="M 82 5 L 76 18 L 85 38 Z" fill="#222" />
        {/* 脸部底圆 */}
        <circle cx="50" cy="55" r="36" fill="#FFE135" />
        {/* 眼睛 */}
        <circle cx="34" cy="48" r="5.5" fill="#2D2D2D" />
        <circle cx="32" cy="45" r="2" fill="#FFF" />
        <circle cx="66" cy="48" r="5.5" fill="#2D2D2D" />
        <circle cx="64" cy="45" r="2" fill="#FFF" />
        {/* 腮红 */}
        <circle cx="20" cy="62" r="7.5" fill="#FF3B30" opacity="0.9" />
        <circle cx="80" cy="62" r="7.5" fill="#FF3B30" opacity="0.9" />
        {/* 嘴巴 */}
        <path d="M 44 56 Q 47 59 50 56 Q 53 59 56 56" fill="none" stroke="#222" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    )
  },
  {
    id: 1,
    name: '哆啦A梦 🐱',
    bgColor: '#3A9AD9',
    renderSvg: () => (
      <svg viewBox="0 0 100 100" width="100%" height="100%">
        {/* 蓝色大头 */}
        <circle cx="50" cy="50" r="38" fill="#3A9AD9" />
        {/* 白色脸庞 */}
        <circle cx="50" cy="56" r="30" fill="#FFF" />
        {/* 眼睛 */}
        <ellipse cx="43" cy="32" rx="5.5" ry="7.5" fill="#FFF" stroke="#222" strokeWidth="2" />
        <circle cx="45" cy="32" r="2.5" fill="#000" />
        <circle cx="46" cy="30" r="0.8" fill="#fff" />
        <ellipse cx="57" cy="32" rx="5.5" ry="7.5" fill="#FFF" stroke="#222" strokeWidth="2" />
        <circle cx="55" cy="32" r="2.5" fill="#000" />
        <circle cx="54" cy="30" r="0.8" fill="#fff" />
        {/* 红色鼻子 */}
        <circle cx="50" cy="41" r="5" fill="#E82C0C" />
        <circle cx="48.2" cy="39" r="1.5" fill="#FFF" />
        {/* 嘴巴与胡须中线 */}
        <line x1="50" y1="46" x2="50" y2="72" stroke="#222" strokeWidth="2" />
        <path d="M 26 53 Q 50 78 74 53" fill="none" stroke="#222" strokeWidth="2" strokeLinecap="round" />
        {/* 胡须 */}
        <line x1="24" y1="45" x2="38" y2="48" stroke="#222" strokeWidth="1.5" />
        <line x1="22" y1="53" x2="38" y2="53" stroke="#222" strokeWidth="1.5" />
        <line x1="24" y1="61" x2="38" y2="58" stroke="#222" strokeWidth="1.5" />
        <line x1="76" y1="45" x2="62" y2="48" stroke="#222" strokeWidth="1.5" />
        <line x1="78" y1="53" x2="62" y2="53" stroke="#222" strokeWidth="1.5" />
        <line x1="76" y1="61" x2="62" y2="58" stroke="#222" strokeWidth="1.5" />
      </svg>
    )
  },
  {
    id: 2,
    name: '龙猫 🍃',
    bgColor: '#8E8E93',
    renderSvg: () => (
      <svg viewBox="0 0 100 100" width="100%" height="100%">
        {/* 灰身子 */}
        <circle cx="50" cy="50" r="38" fill="#8E8E93" />
        {/* 耳朵 */}
        <path d="M 32 18 Q 36 2 40 22 Z" fill="#8E8E93" />
        <path d="M 68 18 Q 64 2 60 22 Z" fill="#8E8E93" />
        {/* 白肚子 */}
        <ellipse cx="50" cy="66" rx="28" ry="20" fill="#F2F2F7" />
        {/* 眼睛 */}
        <circle cx="34" cy="38" r="5" fill="#FFF" stroke="#222" strokeWidth="1.5" />
        <circle cx="34" cy="38" r="2" fill="#000" />
        <circle cx="66" cy="38" r="5" fill="#FFF" stroke="#222" strokeWidth="1.5" />
        <circle cx="66" cy="38" r="2" fill="#000" />
        {/* 鼻子 */}
        <polygon points="46,41 54,41 50,45" fill="#222" />
        {/* 肚花 */}
        <path d="M 40 56 Q 44 52 48 56" fill="none" stroke="#8E8E93" strokeWidth="2" strokeLinecap="round" />
        <path d="M 52 56 Q 56 52 60 56" fill="none" stroke="#8E8E93" strokeWidth="2" strokeLinecap="round" />
        <path d="M 46 64 Q 50 60 54 64" fill="none" stroke="#8E8E93" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  },
  {
    id: 3,
    name: '蜡笔小新 🖍️',
    bgColor: '#FFCCCC',
    renderSvg: () => (
      <svg viewBox="0 0 100 100" width="100%" height="100%">
        {/* 小新标志性侧脸肉色轮廓 */}
        <path d="M 25 35 C 25 22, 75 22, 75 35 C 75 52, 78 54, 75 62 C 72 74, 28 74, 25 62 C 22 54, 25 52, 25 35 Z" fill="#FFE0B2" />
        {/* 头发 */}
        <path d="M 24 35 C 24 22, 76 22, 76 35 C 76 30, 68 24, 50 24 C 32 24, 24 30, 24 35 Z" fill="#2D2D2D" />
        {/* 招牌粗眉毛（极具灵魂） */}
        <path d="M 30 38 Q 38 32 46 38" fill="none" stroke="#000" strokeWidth="5.5" strokeLinecap="round" />
        <path d="M 54 38 Q 62 32 70 38" fill="none" stroke="#000" strokeWidth="5.5" strokeLinecap="round" />
        {/* 呆萌大眼睛 */}
        <ellipse cx="38" cy="49" rx="5" ry="6.5" fill="#FFF" stroke="#222" strokeWidth="1.5" />
        <circle cx="38" cy="49" r="3" fill="#000" />
        <ellipse cx="62" cy="49" rx="5" ry="6.5" fill="#FFF" stroke="#222" strokeWidth="1.5" />
        <circle cx="62" cy="49" r="3" fill="#000" />
        {/* 腮红 */}
        <circle cx="30" cy="58" r="6" fill="#FF8A80" opacity="0.8" />
        <circle cx="70" cy="58" r="6" fill="#FF8A80" opacity="0.8" />
        {/* 纯真微嘟的嘴 */}
        <circle cx="50" cy="58" r="3.5" fill="#E57373" stroke="#222" strokeWidth="1.5" />
      </svg>
    )
  },
  {
    id: 4,
    name: '海绵宝宝 🧽',
    bgColor: '#FFF59D',
    renderSvg: () => (
      <svg viewBox="0 0 100 100" width="100%" height="100%">
        {/* 黄色方形海绵 */}
        <rect x="16" y="16" width="68" height="68" rx="14" fill="#FFEB3B" />
        {/* 绿色坑洞 */}
        <circle cx="26" cy="26" r="4.5" fill="#AFB42B" opacity="0.4" />
        <circle cx="74" cy="74" r="5" fill="#AFB42B" opacity="0.4" />
        <circle cx="28" cy="70" r="3" fill="#AFB42B" opacity="0.4" />
        {/* 蓝亮眼睛 */}
        <circle cx="36" cy="44" r="9" fill="#FFF" stroke="#222" strokeWidth="1.5" />
        <circle cx="36" cy="44" r="4.5" fill="#00B0FF" />
        <circle cx="36" cy="44" r="2" fill="#000" />
        <circle cx="64" cy="44" r="9" fill="#FFF" stroke="#222" strokeWidth="1.5" />
        <circle cx="64" cy="44" r="4.5" fill="#00B0FF" />
        <circle cx="64" cy="44" r="2" fill="#000" />
        {/* 鼻子 */}
        <path d="M 50 44 Q 50 36 53 44" fill="none" stroke="#222" strokeWidth="2.5" strokeLinecap="round" />
        {/* 龅牙嘴巴 */}
        <path d="M 28 55 Q 50 68 72 55" fill="none" stroke="#222" strokeWidth="2.5" strokeLinecap="round" />
        <rect x="43" y="58" width="5" height="5" fill="#FFF" stroke="#222" strokeWidth="1.5" />
        <rect x="52" y="58" width="5" height="5" fill="#FFF" stroke="#222" strokeWidth="1.5" />
        {/* 雀斑 */}
        <circle cx="28" cy="52" r="1" fill="#FF5722" />
        <circle cx="31" cy="54" r="1" fill="#FF5722" />
        <circle cx="69" cy="54" r="1" fill="#FF5722" />
        <circle cx="72" cy="52" r="1" fill="#FF5722" />
      </svg>
    )
  },
  {
    id: 5,
    name: '史迪奇 🐨',
    bgColor: '#1E88E5',
    renderSvg: () => (
      <svg viewBox="0 0 100 100" width="100%" height="100%">
        {/* 大耳朵 */}
        <path d="M 20 40 Q -8 18 10 18 Z" fill="#0D47A1" />
        <path d="M 20 40 Q -2 24 12 24 Z" fill="#F48FB1" />
        <path d="M 80 40 Q 108 18 90 18 Z" fill="#0D47A1" />
        <path d="M 80 40 Q 102 24 88 24 Z" fill="#F48FB1" />
        {/* 蓝色圆脸 */}
        <circle cx="50" cy="52" r="35" fill="#1E88E5" />
        {/* 浅蓝色眼眶 */}
        <ellipse cx="36" cy="46" rx="10" ry="8" fill="#90CAF9" transform="rotate(-15, 36, 46)" />
        <ellipse cx="64" cy="46" rx="10" ry="8" fill="#90CAF9" transform="rotate(15, 64, 46)" />
        {/* 黑色大眼睛 */}
        <circle cx="37" cy="46" r="4.5" fill="#1A1A1A" />
        <circle cx="35" cy="44" r="1.5" fill="#FFF" />
        <circle cx="63" cy="46" r="4.5" fill="#1A1A1A" />
        <circle cx="61" cy="44" r="1.5" fill="#FFF" />
        {/* 深蓝色大鼻子 */}
        <ellipse cx="50" cy="52" rx="7.5" ry="5.5" fill="#0D47A1" />
        {/* 坏笑的宽嘴巴 */}
        <path d="M 28 60 Q 50 76 72 60" fill="none" stroke="#0D47A1" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    )
  },
  {
    id: 6,
    name: '无脸男 👤',
    bgColor: '#212121',
    renderSvg: () => (
      <svg viewBox="0 0 100 100" width="100%" height="100%">
        {/* 黑色兜帽背景 */}
        <rect width="100" height="100" rx="24" fill="#1A1A1A" />
        {/* 白色面具椭圆 */}
        <ellipse cx="50" cy="50" rx="25" ry="34" fill="#EEEEEE" />
        {/* 缝隙小眼睛 */}
        <line x1="39" y1="42" x2="45" y2="42" stroke="#000" strokeWidth="3" strokeLinecap="round" />
        <line x1="55" y1="42" x2="61" y2="42" stroke="#000" strokeWidth="3" strokeLinecap="round" />
        {/* 紫色面部条纹（无脸男精髓） */}
        <polygon points="40,24 44,24 42,34" fill="#7B1FA2" />
        <polygon points="58,24 60,24 60,34" fill="#7B1FA2" />
        <polygon points="40,64 44,64 42,50" fill="#7B1FA2" />
        <polygon points="58,64 60,64 60,50" fill="#7B1FA2" />
        {/* 极小嘴巴 */}
        <line x1="47" y1="62" x2="53" y2="62" stroke="#000" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  },
  {
    id: 7,
    name: '小黄人 🧸',
    bgColor: '#FBC02D',
    renderSvg: () => (
      <svg viewBox="0 0 100 100" width="100%" height="100%">
        {/* 黄色胶囊头 */}
        <rect x="20" y="20" width="60" height="60" rx="30" fill="#FFEB3B" />
        {/* 眼镜皮带 */}
        <rect x="18" y="40" width="64" height="8" fill="#212121" />
        {/* 银色大护目镜框 */}
        <circle cx="50" cy="44" r="15" fill="#B0BEC5" stroke="#212121" strokeWidth="1.5" />
        <circle cx="50" cy="44" r="11" fill="#FFF" />
        {/* 褐色瞳孔 */}
        <circle cx="50" cy="44" r="4.5" fill="#795548" />
        <circle cx="50" cy="44" r="2" fill="#000" />
        <circle cx="48" cy="42" r="1.5" fill="#FFF" />
        {/* 傻傻的坏笑 */}
        <path d="M 38 60 Q 52 70 62 56" fill="none" stroke="#212121" strokeWidth="3.5" strokeLinecap="round" />
      </svg>
    )
  },
  {
    id: 8,
    name: 'Hello Kitty 🎀',
    bgColor: '#FFF0F5',
    renderSvg: () => (
      <svg viewBox="0 0 100 100" width="100%" height="100%">
        {/* 猫耳朵 */}
        <path d="M 28 32 Q 22 10 38 18 Z" fill="#FFF" stroke="#222" strokeWidth="2" />
        <path d="M 72 32 Q 78 10 62 18 Z" fill="#FFF" stroke="#222" strokeWidth="2" />
        {/* 猫脸底圆 */}
        <ellipse cx="50" cy="52" rx="36" ry="28" fill="#FFF" stroke="#222" strokeWidth="2" />
        {/* 标志性红色蝴蝶结（Kitty 的精髓） */}
        <circle cx="68" cy="30" r="5.5" fill="#E53935" />
        <path d="M 68 30 Q 78 20 74 34 Z" fill="#E53935" stroke="#222" strokeWidth="1.5" />
        <path d="M 68 30 Q 58 20 62 34 Z" fill="#E53935" stroke="#222" strokeWidth="1.5" />
        {/* 小黑眼 */}
        <ellipse cx="38" cy="48" rx="2.5" ry="4" fill="#000" />
        <ellipse cx="62" cy="48" rx="2.5" ry="4" fill="#000" />
        {/* 黄色小鼻子 */}
        <ellipse cx="50" cy="54" rx="3.5" ry="2.5" fill="#FDD835" stroke="#222" strokeWidth="1.5" />
        {/* 猫胡须 */}
        <line x1="18" y1="48" x2="30" y2="50" stroke="#222" strokeWidth="2" />
        <line x1="16" y1="55" x2="28" y2="55" stroke="#222" strokeWidth="2" />
        <line x1="70" y1="50" x2="82" y2="48" stroke="#222" strokeWidth="2" />
        <line x1="72" y1="55" x2="84" y2="55" stroke="#222" strokeWidth="2" />
      </svg>
    )
  },
  {
    id: 9,
    name: '毛毛 👧',
    bgColor: '#E1BEE7',
    renderSvg: () => (
      <svg viewBox="0 0 100 100" width="100%" height="100%">
        {/* 飞天小女警-毛毛的绿色大头贴 */}
        <circle cx="50" cy="50" r="38" fill="#FFE0B2" />
        {/* 标志性黑色短发 */}
        <path d="M 12 50 C 12 25, 88 25, 88 50 C 88 40, 78 30, 50 30 C 22 30, 12 40, 12 50 Z" fill="#1A1A1A" />
        {/* 中分翘刘海 */}
        <path d="M 50 30 L 40 42 L 50 36 L 60 42 Z" fill="#1A1A1A" />
        {/* 震撼的绿色大眼睛 */}
        <circle cx="33" cy="54" r="12" fill="#FFF" stroke="#222" strokeWidth="1.5" />
        <circle cx="33" cy="54" r="8" fill="#4CAF50" />
        <circle cx="33" cy="54" r="4.5" fill="#000" />
        <circle cx="35.5" cy="51.5" r="1.5" fill="#FFF" />
        <circle cx="67" cy="54" r="12" fill="#FFF" stroke="#222" strokeWidth="1.5" />
        <circle cx="67" cy="54" r="8" fill="#4CAF50" />
        <circle cx="67" cy="54" r="4.5" fill="#000" />
        <circle cx="69.5" cy="51.5" r="1.5" fill="#FFF" />
        {/* 倔强自信的斜线小嘴 */}
        <line x1="45" y1="72" x2="55" y2="70" stroke="#222" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    )
  }
];

interface AvatarSelectorProps {
  selectedId: number;
  onSelect: (id: number) => void;
}

export const AvatarSelector: React.FC<AvatarSelectorProps> = ({ selectedId, onSelect }) => {
  return (
    <div className="avatar-selector-container">
      <div className="selector-title">选择舱内卡通化身</div>
      <div className="avatar-grid-layout">
        {CARTOON_AVATARS.map((avatar) => {
          const isSelected = avatar.id === selectedId;
          return (
            <button
              key={avatar.id}
              type="button"
              className={`avatar-grid-item ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelect(avatar.id)}
              title={avatar.name}
            >
              <div className="avatar-svg-wrapper">
                {avatar.renderSvg()}
              </div>
              <span className="avatar-item-name">{avatar.name.split(' ')[0]}</span>
              {isSelected && <div className="avatar-check-dot">✓</div>}
            </button>
          );
        })}
      </div>

      <style>{`
        .avatar-selector-container {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 8px;
        }

        .selector-title {
          font-size: 0.68rem;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.45);
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .avatar-grid-layout {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 8px;
          background: rgba(0, 0, 0, 0.25);
          border-radius: 16px;
          padding: 12px;
          border: 1px solid rgba(255, 255, 255, 0.05);
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
        }

        .avatar-grid-item {
          position: relative;
          background: transparent;
          border: none;
          outline: none;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 4px;
          border-radius: 12px;
          transition: all 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275); /* Q弹阻尼回弹 */
        }

        .avatar-svg-wrapper {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          overflow: visible; /* 允许耳朵等部分微突起 */
          filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.35));
          transition: all 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .avatar-item-name {
          font-size: 0.58rem;
          color: rgba(255, 255, 255, 0.4);
          font-weight: 600;
          transition: color 0.3s;
        }

        /* 悬浮动效 */
        .avatar-grid-item:hover .avatar-svg-wrapper {
          transform: translateY(-4px) scale(1.1);
          filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.5));
        }

        .avatar-grid-item:hover .avatar-item-name {
          color: rgba(255, 255, 255, 0.8);
        }

        /* 选中态：极速液态高折射霓虹描边 */
        .avatar-grid-item.selected .avatar-svg-wrapper {
          transform: scale(1.08);
          filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.65));
        }

        .avatar-grid-item.selected::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 12px;
          border: 1.5px solid rgba(255, 255, 255, 0.45);
          box-shadow: 0 0 10px rgba(255, 255, 255, 0.2);
          pointer-events: none;
          animation: border-glow 2s infinite alternate;
        }

        .avatar-grid-item.selected .avatar-item-name {
          color: #FFF;
          font-weight: 700;
        }

        .avatar-check-dot {
          position: absolute;
          top: 0px;
          right: 0px;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #FFF;
          color: #000;
          font-size: 0.55rem;
          font-weight: 900;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          border: 1px solid rgba(0,0,0,0.1);
        }

        @keyframes border-glow {
          0% { border-color: rgba(255, 255, 255, 0.25); }
          100% { border-color: rgba(255, 255, 255, 0.75); }
        }

        /* 手机端视口适配优化 */
        @media (max-width: 480px) {
          .avatar-grid-layout {
            gap: 6px;
            padding: 8px;
          }
          .avatar-svg-wrapper {
            width: 36px;
            height: 36px;
          }
          .avatar-item-name {
            font-size: 0.5rem;
          }
        }
      `}</style>
    </div>
  );
};
