import React from 'react';

export const LiquidCard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div 
      className="liquid-glass" 
      style={{
        width: '340px',
        height: '420px',
        borderRadius: '40px',
        padding: '2.5rem',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.4s cubic-bezier(0.25, 1, 0.5, 1)',
        cursor: 'pointer'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-12px) scale(1.02)';
        e.currentTarget.style.boxShadow = '0 40px 64px -12px rgba(0,0,0,0.7), inset 0 2px 3px rgba(255,255,255,0.5)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0) scale(1)';
        e.currentTarget.style.boxShadow = '0 24px 48px -12px rgba(0,0,0,0.6), inset 0 1px 2px rgba(255,255,255,0.4)';
      }}
    >
      {/* 光泽涂层 */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 35%, rgba(255,255,255,0) 65%, rgba(255,255,255,0.1) 100%)',
        pointerEvents: 'none',
        borderRadius: 'inherit',
        zIndex: 1
      }} />
      <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );
};
